/** 전투 이펙트 확인 페이지 (npm run fx → docs/fx-demo.html). 게임과 같은 src/ui/fx.ts를 쓴다. */
import { STATUSES } from '../src/core/enums';
import { JOBS } from '../src/core/enums';
import type { Job, SkillTarget, StatusType } from '../src/core/enums';
import { Names } from '../src/core/names';
import { ALL_SKILLS } from '../src/core/skills';
import type { SkillDef } from '../src/core/skills';
import { fxCounter, fxDefeat, fxDodge, fxEnemyCast, fxHeal, fxHit, fxSkill, fxStatus, fxStyleFor, fxSwing, fxTick, fxTierOf, isDebuff, setFxSpeed, swingsSword } from '../src/ui/fx';
import type { FxStyle, Spot, TickKind } from '../src/ui/fx';
import { spriteUrl } from '../src/ui/sprites';

const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../public/icons/status_*.png', { eager: true, import: 'default' })).map(([p, u]) => [p.slice(p.lastIndexOf('/') + 1, -4), u]));
const icon = (t: StatusType): string => ICONS[`status_${t.toLowerCase()}`] ?? '';

const $ = (id: string): HTMLElement => document.getElementById(id)!;
const stage = $('stage'), now = $('now');
let speed = 1;
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms / speed));

// ── 무대: 게임과 같은 자리 (나 [84,158] 76px · 적 3마리) ──
interface Unit { el: HTMLElement; img: HTMLImageElement; spot: Spot }
const units = new Map<number, Unit>();
let job: Job = 'Warrior';

function unit(i: number, sprite: string, cx: number, cy: number, size: number, name: string): void {
  const el = document.createElement('div');
  el.className = 'unit';
  el.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
  const img = document.createElement('img');
  img.alt = '';
  img.src = spriteUrl(sprite) ?? '';
  img.onload = () => { img.style.width = `${img.naturalWidth * 3}px`; };
  el.append(Object.assign(document.createElement('div'), { className: 'foot' }), img);
  const body = Math.max(size, 72);
  const tag = Object.assign(document.createElement('div'), { className: 'tag', textContent: name });
  tag.style.cssText = `left:${cx}px;top:${cy + size / 2 - body - 20}px`;
  stage.append(tag, el);
  units.set(i, { el, img, spot: { x: cx, y: cy + size / 2 - body / 2, size: body * 0.8 } });
}
function reset(): void {
  stage.replaceChildren();
  units.clear();
  unit(-1, job.toLowerCase(), 84, 158, 76, Names.job(job));
  unit(0, 'goblin', 242, 86, 56, '고블린');
  unit(1, 'skeleton', 338, 86, 56, '스켈레톤');
  unit(2, 'slime', 242, 230, 56, '슬라임');
}
function setJob(j: Job): void {
  if (j === job) return;
  job = j;
  const u = units.get(-1)!;
  u.img.src = spriteUrl(j.toLowerCase()) ?? '';
  stage.querySelector<HTMLElement>('.tag')!.textContent = Names.job(j);
}
// 좁은 화면에서는 무대를 줄인다 (게임과 같은 방식)
const fit = (): void => {
  const w = stage.parentElement!.clientWidth;
  stage.style.transform = w < 390 ? `scale(${w / 390})` : '';
};
addEventListener('resize', fit);

// ── 게임 battle.ts와 같은 반응 (돌진·흔들림·번쩍임·숫자) ──
const sp = (i: number): Spot => units.get(i)!.spot;
function dash(i: number): void {
  units.get(i)!.el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${i < 0 ? 34 : -28}px)` }, { transform: 'translateX(0)' }], { duration: 260 / speed, easing: 'ease-out' });
}
function react(i: number, crit: boolean): void {
  const el = units.get(i)!.el, amp = crit ? 10 : 6;
  el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-amp}px)` }, { transform: `translateX(${amp}px)` }, { transform: `translateX(${-amp / 2}px)` }, { transform: 'translateX(0)' }], { duration: 240 / speed });
  el.animate([{ filter: i >= 0 ? 'brightness(3)' : 'brightness(1.6) saturate(3) hue-rotate(-30deg)' }, { filter: 'brightness(1)' }], { duration: 260 / speed });
}
function float(i: number, text: string, color: string, size = 19): void {
  const s = sp(i);
  const el = Object.assign(document.createElement('div'), { className: 'floatup', textContent: text });
  el.style.cssText = `left:${s.x + Math.random() * 20 - 10}px;top:${s.y - s.size * 0.2}px;color:${color};font-size:${size}px`;
  stage.append(el);
  setTimeout(() => el.remove(), 1000);
}
const DMG = (crit: boolean): string => (crit ? '#F6C063' : '#fff');

// ── 사건 단위 재생 (게임의 Act → Damage/Miss/Status 순서와 같다) ──
interface Attack { from: number; to: number[]; style: FxStyle; skillId?: string; skill?: string; hits?: number; crit?: boolean; statuses?: StatusType[]; selfStatuses?: StatusType[]; noDamage?: boolean }
async function attack(a: Attack): Promise<void> {
  if (a.skill) float(a.from, a.skill, '#F6C063', 13);
  let travel = 0;
  // 게임과 같이: 전사 근접 공격은 그 자리에서 칼을 휘두르고, 나머지는 앞으로 돌진
  if (a.from < 0 && a.to.length && swingsSword(job, a.skillId ?? null)) travel = fxSwing(stage, units.get(-1)!.el, sp(-1), fxTierOf(a.skillId ?? null));
  else dash(a.from);
  if (a.from < 0) travel = Math.max(travel, fxSkill(stage, sp(-1), a.to.map(sp), job, a.skillId ?? null));
  else if (a.skill) fxEnemyCast(stage, sp(a.from));
  await wait(Math.max(192, travel + 40));
  // 게임과 같이: 한 번에 맞는 적들은 거의 동시에, 다음 타격은 한 박자 뒤
  for (let k = 0; k < (a.hits ?? 1) && !a.noDamage; k++) {
    for (const [n, t] of a.to.entries()) {
      react(t, !!a.crit);
      fxHit(stage, sp(t), a.style, !!a.crit, a.from < 0 ? fxTierOf(a.skillId ?? null) : 0);
      float(t, `${a.crit ? '치명타! ' : ''}${Math.round((a.crit ? 38 : 22) + Math.random() * 6)}`, DMG(!!a.crit), a.crit ? 26 : 19);
      await wait(n < a.to.length - 1 ? 50 : 320);
    }
  }
  for (const s of a.selfStatuses ?? []) { status(-1, s); await wait(192); }
  for (const t of a.to) for (const s of a.statuses ?? []) { status(t, s); await wait(120); }
}
function status(t: number, s: StatusType): void {
  fxStatus(stage, sp(t), s, icon(s));
  float(t, Names.status(s), '#8FB3D9', 13);
}
async function tick(t: number, k: TickKind): Promise<void> {
  react(t, false);
  fxTick(stage, sp(t), k);
  float(t, `${Names.status(k)} ${4 + Math.round(Math.random() * 4)}`, k === 'Poison' ? '#7BC86F' : k === 'Bleed' ? '#E0524A' : '#F0913A', 15);
}

const ALL = [0, 1, 2];
interface Demo { label: string; when: string; job?: Job; img?: string; run: () => Promise<void> | void }
interface Group { title: string; lead: string; items: Demo[] }

const basic = (j: Job, label: string, when: string): Demo => ({ label, when, job: j, run: () => attack({ from: -1, to: [0], style: fxStyleFor(j, null) }) });
// 스킬 40종: 표(skills.json)의 대상·타수·상태 이상 그대로 (무대의 적 0=앞 왼쪽, 1=뒤, 2=앞 아래)
const TARGET_OF: Record<SkillTarget, number[]> = { SingleEnemy: [0], AllEnemies: ALL, Self: [], Column: [0, 2], Row: [0, 1], RandomEnemies: ALL, ChainEnemies: ALL };
const skill = (d: SkillDef): Demo => {
  const j = JOBS[d.JobRestriction];
  return {
    label: `${d.Name} · ${Names.tier(d.Tier)}`, when: d.Effect, job: j,
    run: () => attack({
      from: -1, to: TARGET_OF[d.Target], style: fxStyleFor(j, d.Id), skillId: d.Id, skill: d.Name, hits: d.Hits, noDamage: !d.IsAttack,
      statuses: d.Statuses.filter((x) => !x.OnSelf).map((x) => x.Type), selfStatuses: d.Statuses.filter((x) => x.OnSelf).map((x) => x.Type),
    }),
  };
};
const JOB_LEAD: Record<Job, string> = {
  Warrior: '그 자리에서 칼을 휘둘러 금빛 궤적을 남기고 큰 충격이 터집니다. 회전 베기는 둥근 칼바람, 대지 가르기는 땅이 갈라지며 돌이 튀고 화면이 흔들립니다.',
  Archer: '화살은 빛 꼬리를 끌고, 화살비는 하늘에서 쏟아지며, 관통 사격은 한 줄을 꿰뚫는 빛줄기입니다.',
  Rogue: '도적의 보라 그림자 분신이 연기 속에서 나와 잔상을 남기며 적 뒤로 달려가 벱니다. 암살은 화면이 어두워진 뒤 적 뒤에 나타나 핏빛 X자로 베어 냅니다.',
  Mage: '시전자 앞에 마법진이 서고 빛나는 투사체가 날아갑니다. 운석은 하늘에서 큰 운석이 떨어져 모든 적을 동시에 때립니다.',
};

const GROUPS: Group[] = [
  {
    title: '기본 공격',
    lead: '전사는 그 자리에서 칼을 휘둘러 반달 궤적을 남기고, 마법사는 마법진을 세우고 빛나는 마력 창을 쏩니다.',
    items: [
      basic('Warrior', '전사 · 베기', '전사 기본 공격 · 반격'),
      basic('Archer', '궁수 · 화살', '궁수 기본 공격 (날아가는 화살)'),
      basic('Rogue', '도적 · 찌르기', '도적 기본 공격'),
      basic('Mage', '마법사 · 마력탄', '마법사 기본 공격 (날아가는 마력탄)'),
      { label: '몬스터 · 할퀴기', when: '모든 몬스터의 공격 (나를 때림)', run: () => attack({ from: 0, to: [-1], style: 'claw' }) },
    ],
  },
  ...JOBS.map((j): Group => ({ title: `${Names.job(j)} 스킬`, lead: JOB_LEAD[j], items: ALL_SKILLS.filter((d) => JOBS[d.JobRestriction] === j).sort((a, b) => fxTierOf(a.Id) - fxTierOf(b.Id)).map(skill) })),
  {
    title: '피격 · 회피 · 반격',
    lead: '맞으면 흔들림·번쩍임 위에 타격 이펙트가 겹칩니다. 치명타는 더 크게 터지고 화면이 흔들립니다.',
    items: [
      { label: '일반 피격', when: '적이 맞음', job: 'Warrior', run: () => attack({ from: -1, to: [0], style: 'slash' }) },
      { label: '치명타', when: '큰 폭발 + 흰 고리 + 화면 흔들림', job: 'Warrior', run: () => attack({ from: -1, to: [0], style: 'slash', crit: true }) },
      { label: '내가 맞음', when: '몬스터 공격 (빨간 번쩍임)', run: () => attack({ from: 1, to: [-1], style: 'claw' }) },
      { label: '빗나감', when: '내 공격이 빗나감 (적이 비켜섬)', job: 'Warrior', run: async () => { dash(-1); await wait(192); fxDodge(units.get(0)!.el, true); float(0, '빗나감', '#A49A86', 15); } },
      { label: '회피 (궁수)', when: '궁수 고유 능력치: 완전 회피', job: 'Archer', run: async () => { dash(1); await wait(192); fxDodge(units.get(-1)!.el, false); float(-1, '빗나감', '#A49A86', 15); } },
      {
        label: '반격 (전사)', when: '전사 고유 능력치·반격 태세: 피해 절반 + 되받아침', job: 'Warrior',
        run: async () => {
          await attack({ from: 1, to: [-1], style: 'claw' });
          fxCounter(stage, sp(-1));
          float(-1, '반격!', '#F6C063', 16);
          await wait(320);
          await attack({ from: -1, to: [1], style: 'slash' });
        },
      },
    ],
  },
  {
    title: '상태 이상 걸림',
    lead: '상태 아이콘이 머리 위로 튀어 오르고, 상태 색 고리와 입자가 나옵니다. 이로운 효과는 위로, 해로운 효과는 아래로 흐릅니다.',
    items: STATUSES.map((s): Demo => ({
      label: Names.status(s), img: icon(s), when: isDebuff(s) ? '해로운 효과 (적에게)' : '이로운 효과 (나에게)',
      run: () => status(isDebuff(s) ? 0 : -1, s),
    })),
  },
  {
    title: '턴 피해 · 회복 · 쓰러짐',
    lead: '독·출혈·화상은 턴마다 같은 입자가 다시 나옵니다.',
    items: [
      { label: '독 (턴 피해)', when: '초록 거품', run: () => tick(0, 'Poison') },
      { label: '출혈 (턴 피해)', when: '떨어지는 핏방울', run: () => tick(1, 'Bleed') },
      { label: '화상 (턴 피해)', when: '올라가는 불꽃', run: () => tick(2, 'Burn') },
      { label: '회복', when: '물약·불굴·재생 (초록 십자)', run: () => { fxHeal(stage, sp(-1)); float(-1, '+30', '#A8E6A0'); } },
      { label: '쓰러짐', when: '가라앉으며 흐려짐 (2초 뒤 되살림)', run: async () => { fxDefeat(units.get(2)!.el, stage, sp(2)); await wait(2000); reset(); } },
    ],
  },
];

// ── 버튼 ──
const groups = $('groups');
const all: Demo[] = [];
for (const g of GROUPS) {
  const sec = document.createElement('section');
  sec.className = 'group';
  sec.innerHTML = `<h2></h2><p></p><div class="grid"></div>`;
  sec.querySelector('h2')!.textContent = g.title;
  sec.querySelector('p')!.textContent = g.lead;
  const grid = sec.querySelector('.grid')!;
  for (const d of g.items) {
    all.push(d);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fxbtn';
    const title = document.createElement('b');
    if (d.img) title.append(Object.assign(document.createElement('img'), { src: d.img, alt: '' }));
    title.append(d.label);
    b.append(title, Object.assign(document.createElement('span'), { textContent: d.when }));
    b.addEventListener('click', () => run(d, b));
    grid.append(b);
  }
  groups.append(sec);
}
async function run(d: Demo, b?: HTMLElement): Promise<void> {
  document.querySelectorAll('.fxbtn.on').forEach((x) => x.classList.remove('on'));
  b?.classList.add('on');
  if (d.job) setJob(d.job);
  now.innerHTML = '';
  now.append(d.label, ' ', Object.assign(document.createElement('small'), { textContent: `— ${d.when}` }));
  await d.run();
}
let auto = false;
$('all').addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  if (auto) { auto = false; return; }
  auto = true;
  btn.textContent = '멈추기';
  const buttons = Array.from(document.querySelectorAll<HTMLElement>('.fxbtn'));
  for (let i = 0; i < all.length && auto; i++) {
    await run(all[i], buttons[i]);
    await wait(900);
  }
  auto = false;
  btn.textContent = '모두 차례로 보기';
});
document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.addEventListener('click', () => {
  speed = Number(b.dataset.speed);
  setFxSpeed(speed);
  document.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}));

reset();
fit();

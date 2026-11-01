/** 전투 이펙트 확인 페이지 (npm run fx → docs/fx-demo.html). 게임과 같은 src/ui/fx.ts를 쓴다. */
import { STATUSES } from '../src/core/enums';
import type { Job, StatusType } from '../src/core/enums';
import { Names } from '../src/core/names';
import { skillDef } from '../src/core/skills';
import { fxCast, fxCounter, fxDefeat, fxDodge, fxHeal, fxHit, fxShot, fxStatus, fxStyleFor, fxTick, isDebuff, setFxSpeed } from '../src/ui/fx';
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
interface Attack { from: number; to: number[]; style: FxStyle; skill?: string; hits?: number; crit?: boolean; statuses?: StatusType[]; noDamage?: boolean }
async function attack(a: Attack): Promise<void> {
  dash(a.from);
  if (a.skill) {
    float(a.from, a.skill, '#F6C063', 13);
    fxCast(stage, sp(a.from), a.style);
  }
  if (a.from < 0) fxShot(stage, sp(a.from), sp(a.to[0]), a.style);
  await wait(192);
  for (const t of a.to) {
    for (let k = 0; k < (a.hits ?? 1); k++) {
      if (!a.noDamage) {
        react(t, !!a.crit);
        fxHit(stage, sp(t), a.style, !!a.crit);
        const n = Math.round((a.crit ? 38 : 22) + Math.random() * 6);
        float(t, `${a.crit ? '치명타! ' : ''}${n}`, DMG(!!a.crit), a.crit ? 26 : 19);
        await wait(320);
      }
    }
    for (const s of a.statuses ?? []) {
      status(t, s);
      await wait(192);
    }
  }
}
function status(t: number, s: StatusType): void {
  fxStatus(stage, sp(t), s, icon(s));
  float(t, Names.status(s), '#8FB3D9', 13);
}
async function selfBuff(name: string, s: StatusType): Promise<void> {
  float(-1, name, '#F6C063', 13);
  await wait(192);
  status(-1, s);
}
async function tick(t: number, k: TickKind): Promise<void> {
  react(t, false);
  fxTick(stage, sp(t), k);
  float(t, `${Names.status(k)} ${4 + Math.round(Math.random() * 4)}`, k === 'Poison' ? '#7BC86F' : k === 'Bleed' ? '#E0524A' : '#F0913A', 15);
}

const ALL = [0, 1, 2];
const name = (id: string): string => skillDef(id)?.Name ?? id;
interface Demo { label: string; when: string; job?: Job; img?: string; run: () => Promise<void> | void }
interface Group { title: string; lead: string; items: Demo[] }

const basic = (j: Job, label: string, when: string): Demo => ({ label, when, job: j, run: () => attack({ from: -1, to: [0], style: fxStyleFor(j, null) }) });
const skill = (j: Job, id: string, when: string, a: Omit<Attack, 'from' | 'style' | 'skill'>): Demo => ({ label: name(id), when, job: j, run: () => attack({ from: -1, style: fxStyleFor(j, id), skill: name(id), ...a }) });

const GROUPS: Group[] = [
  {
    title: '기본 공격',
    lead: '직업마다 모양이 다릅니다. 궁수·마법사는 화살·마력탄이 날아가 꽂힙니다.',
    items: [
      basic('Warrior', '전사 · 베기', '전사 기본 공격 · 반격'),
      basic('Archer', '궁수 · 화살', '궁수 기본 공격 (날아가는 화살)'),
      basic('Rogue', '도적 · 찌르기', '도적 기본 공격'),
      basic('Mage', '마법사 · 마력탄', '마법사 기본 공격 (날아가는 마력탄)'),
      { label: '몬스터 · 할퀴기', when: '모든 몬스터의 공격 (나를 때림)', run: () => attack({ from: 0, to: [-1], style: 'claw' }) },
    ],
  },
  {
    title: '스킬',
    lead: '스킬을 쓰면 시전자에게 빛이 모이고, 속성(불·얼음·번개·대지·함성)이 있는 스킬은 그 모양으로 터집니다. 광역은 맞는 적마다 터집니다.',
    items: [
      skill('Warrior', 'w_bash', '전사 단일 스킬 (베기 계열)', { to: [0] }),
      skill('Warrior', 'w_whirl', '전사 광역 (적마다 베기)', { to: ALL }),
      skill('Warrior', 'w_earth', '대지 계열: 땅 갈라짐 + 파편 → 취약', { to: ALL, statuses: ['Vulnerable'] }),
      skill('Warrior', 'w_roar', '함성 계열: 퍼지는 고리 → 약화', { to: ALL, statuses: ['Weaken'], noDamage: true }),
      skill('Archer', 'a_double', '연속 타격 (화살 3발)', { to: [0], hits: 3 }),
      skill('Archer', 'a_rain', '광역 2회 (적마다 화살)', { to: ALL, hits: 2 }),
      skill('Rogue', 'r_venom', '찌르기 → 독', { to: [0], statuses: ['Poison'], noDamage: true }),
      skill('Rogue', 'r_shadow', '도적 단일 (치명타면 3연 찌르기)', { to: [0], crit: true }),
      skill('Rogue', 'r_storm', '광역 찌르기 → 출혈', { to: ALL, statuses: ['Bleed'] }),
      skill('Mage', 'm_bolt', '마력 계열 (보라 마력탄)', { to: [0] }),
      skill('Mage', 'm_fireball', '불 계열: 불꽃 폭발 → 화상', { to: [0], statuses: ['Burn'] }),
      skill('Mage', 'm_ice', '얼음 계열: 얼음 파편 → 약화', { to: [0, 1], statuses: ['Weaken'] }),
      skill('Mage', 'm_chain', '번개 계열: 내리꽂는 번개 (연쇄)', { to: ALL }),
      skill('Mage', 'm_meteor', '불 계열 광역 → 화상', { to: ALL, statuses: ['Burn'] }),
      skill('Mage', 'm_prison', '얼음 계열 → 기절', { to: [0], statuses: ['Stun'] }),
    ],
  },
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
      { label: '반격 태세 (버프)', when: '전사 스킬: 자기 강화', job: 'Warrior', run: () => selfBuff(name('w_riposte'), 'Riposte') },
      { label: '쓰러짐', when: '가라앉으며 흐려짐 (2초 뒤 되살림)', run: async () => { fxDefeat(units.get(2)!.el); await wait(2000); reset(); } },
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

import { potionButton } from '../ui/potion';
import { spriteUrl } from '../ui/sprites';
import { tutorial } from '../ui/tutorial';
import { areaDiagram } from '../ui/skillinfo';
import { B } from '../core/balance';
import type { BattleChoice, BattleEvent, DamageKind, LogTone } from '../core/battle';
import type { Battle } from '../core/battle';
import type { Combatant } from '../core/combatant';
import { themeIndex } from '../core/monsters';
import { itemNames, mergeStacks } from '../core/loot';
import { ALL_SKILLS, skillDef } from '../core/skills';
import { STATUSES } from '../core/enums';
import type { StatusType } from '../core/enums';
import { fxCounter, fxDefeat, fxDodge, fxEnemyCast, fxHeal, fxHit, fxSkill, fxStatus, fxStyleFor, fxTick, setFxSpeed } from '../ui/fx';
import type { FxStyle, Spot } from '../ui/fx';
import { showCharacterInfo, showEnemyInfo, statusIcon } from '../ui/charinfo';
import { pauseButton } from '../ui/chrome';
import { S } from '../ui/game';
import { colored } from '../ui/items';
import { assetUrl, button, h, icon, longPress, sub } from '../ui/kit';
import { modal, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { dungeonTheme, tierColor } from '../ui/theme';
import { Names } from '../core/names';
import { settings, vibrate } from '../ui/settings';
import { goDungeon, goResult, goTitle, goToCurrent } from './index';

const STEP = 320;
/** 그림 배율: 혼자 나온 보스는 4배, 나머지 3배 (그림은 24칸 이하) */
const spriteScale = (size: number): number => (size >= 90 ? 4 : 3);

interface UnitView {
  shape: HTMLElement;
  bar: HTMLElement;
  hpText: HTMLElement;
  enemyHp: boolean;
  center: [number, number];
  size: number;
  /** 보이는 몸 높이 (그림이면 24칸 × 배율). */
  body: number;
  maxHp: number;
  hp: number;
  shield: number;
  barrier: number;
}

/** 상태 이름(사건 문구) → 상태 종류. */
const STATUS_BY_NAME = new Map<string, StatusType>(STATUSES.map((t) => [Names.status(t), t]));
const DAMAGE_COLOR: Record<DamageKind, string> = { Normal: '#fff', Crit: 'var(--gold)', Poison: '#7BC86F', Bleed: '#E0524A', Burn: '#F0913A', Heal: '#A8E6A0', Counter: '#FF9A4A', Blocked: '#8FC7FF', Pierce: '#9EE6E0' };
/** 피해 숫자 앞 이름표 · 글씨 크기 (치명타·반격처럼 특별한 타격은 크게). */
const DAMAGE_TAG: Partial<Record<DamageKind, [string, number]>> = { Crit: ['치명타! ', 26], Counter: ['반격! ', 25], Blocked: ['막음 ', 20], Pierce: ['관통 ', 21] };
const TONE_COLOR: Record<LogTone, string> = { Normal: 'var(--log-ink)', Good: 'var(--gold)', Bad: 'var(--red-light)', System: 'var(--text)' };

/** 적 자리 = 배열 순서: 왼쪽 열이 전방(0·2), 오른쪽 열이 후방(1·3). */
function enemyCenters(n: number): [number, number][] {
  switch (n) {
    case 1: return [[286, 150]];
    case 2: return [[242, 150], [338, 150]];
    case 3: return [[242, 86], [338, 86], [242, 230]];
    default: return [[242, 86], [338, 86], [242, 230], [338, 230]];
  }
}

/**
 * 전투: 위쪽 전투 무대(왼쪽 나, 오른쪽 적 최대 4 — 픽셀 그림, 발밑 타원: 보스 보스 색 · 정예 금색 · 일반 그림자),
 * 적을 눌러 대상 선택, 2~3줄 기록, 아래 선택지(성공 확률, 길게 누르면 계산 내역).
 * 행동 결과는 Battle.lastEvents를 차례로 재생한다 (돌진·흔들림·번쩍임·떠오르는 피해 숫자 + 이펙트 ui/fx.ts).
 */
export class BattleScreen extends Screen {
  private b: Battle | null = null;
  private target = -1;
  private playing = false;
  private finished = false;
  private leaving = false;
  private started = false;
  private pending: BattleEvent[] | null = null;
  private hpBefore: Map<number, number> | null = null;
  private stage: HTMLElement | null = null;
  private lower: HTMLElement | null = null;
  private units = new Map<number, UnitView>();
  /** 지금 재생 중인 행동의 이펙트 계열 (행동 사건에서 정하고 이어지는 피해 사건이 쓴다). */
  private fxStyle: FxStyle = 'slash';
  private readonly wave = new Set<number>();
  private timers: number[] = [];

  onBack(): boolean {
    if (!this.playing && !this.finished && !this.leaving) this.pause();
    return true;
  }

  private get alive(): boolean {
    return router.current === this;
  }

  build(): HTMLElement {
    if (!this.b) this.b = S.battle;
    const b = this.b;
    if (!b) {
      queueMicrotask(goToCurrent);
      return h('div');
    }
    if (!this.started) {
      this.started = true;
      // 기습 등 전투 시작과 동시에 일어난 일
      if (b.lastEvents.length > 0) {
        this.pending = [...b.lastEvents];
        this.hpBefore = this.inferBefore(this.pending);
      }
    }
    this.fixTarget();
    this.units.clear();
    const th = dungeonTheme(themeIndex(b.floor));
    const stageWrap = h('div', { class: `stagewrap${b.isBoss ? ' boss' : ''}`, style: { background: th.stage } }); // 보스전: 붉은 기운이 은은하게 맥동
    this.stage = h('div', { class: 'stage' });
    stageWrap.append(h('div', { style: { position: 'absolute', left: '0', right: '0', bottom: '0', height: '70px', background: `linear-gradient(to top, ${th.line}59, transparent)` } }), this.stage);
    this.buildStage();
    this.lower = h('div', { class: 'lower' });
    if (this.finished) this.finishedView(this.lower);
    // 마지막 일격을 재생하는 동안(전투는 끝났지만 연출 중)에는 선택지를 그리지 않는다 — 물약 칸만 남았다가 사라지지 않게
    else if (!b.isOver) this.choices(this.lower);
    // 무대는 390px 기준 좌표로 그리고, 화면 폭이 더 좁으면 통째로 줄여 양옆이 잘리지 않게 한다
    const fit = (): void => {
      // 키가 작은 폰에서는 무대를 더 줄여 아래 선택지가 스크롤 없이 보이게 한다
      const tall = document.querySelector<HTMLElement>('.screen')?.clientHeight ?? 844;
      const s = Math.min(1, stageWrap.clientWidth / 390 || 1, tall < 700 ? 0.7 : tall < 780 ? 0.82 : 1);
      this.stage!.style.transform = s < 1 ? `scale(${s})` : '';
      stageWrap.style.height = `${Math.round(300 * s)}px`;
    };
    requestAnimationFrame(fit);
    return h('div', { class: 'page', style: { background: th.bg } }, this.topBar(), stageWrap, this.log(), this.lower);
  }

  afterShow(): void {
    if (this.pending) {
      const events = this.pending;
      this.pending = null;
      this.startPlayback(events);
    } else if (!this.playing && !this.finished) {
      tutorial.onBattle();
      tutorial.onBossIntent();
    }
  }

  private fixTarget(): void {
    const b = this.b!;
    if (this.target >= 0 && this.target < b.enemies.length && b.enemies[this.target].alive) return;
    this.target = b.enemies.findIndex((e) => e.alive);
  }

  // ── 머리줄: 속도 1×/2× · 캐릭터 정보 · 일시정지 ──

  private topBar(): HTMLElement {
    const b = this.b!;
    const sq = (kids: (Node | string)[], fn: () => void): HTMLElement =>
      h('button', { style: { width: '44px', height: '44px', padding: '0', fontWeight: '700', flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }, on: { click: fn } }, ...kids);
    const speed = sq([`${settings.battleSpeed}×`], () => {
      settings.battleSpeed = settings.battleSpeed === 1 ? 2 : 1;
      speed.textContent = `${settings.battleSpeed}×`;
    });
    return h('div', { class: 'header', style: { height: '60px', padding: '6px 12px 6px 16px', gap: '6px' } },
      b.isBoss ? h('span', { class: 'boss-badge', 'aria-hidden': 'true' }, icon('room_boss', 20, '#ffd2c8')) : null,
      h('b', { class: 'grow', style: { fontSize: '15px' } }, `${b.floor}층 · `, b.isBoss ? colored('보스전 ', 'var(--boss)') : '전투 ', colored(`${b.turn}턴째`, 'var(--sub)')),
      speed,
      sq([icon('character', 22)], () => {
        if (!this.playing && !this.leaving) showCharacterInfo(b);
      }),
      pauseButton(() => {
        if (!this.playing && !this.finished && !this.leaving) this.pause();
      }));
  }

  // ── 무대 ──

  private buildStage(): void {
    const b = this.b!;
    const p = b.player;
    this.unit(-1, p, [84, 158], 76, '', 130, `HP ${p.hp}/${p.maxHp}`, false);
    const centers = enemyCenters(b.enemies.length);
    b.enemies.forEach((e, i) => {
      const many = b.enemies.length > 1;
      const size = e.role === 2 ? (many ? 72 : 96) : e.role === 1 ? 62 : 56;
      // 발밑 타원 색: 보스 = 보스 색, 정예 = 금색, 일반 = 그림자
      const foot = e.role === 2 ? 'var(--boss)' : e.role === 1 ? 'var(--gold)' : '';
      this.unit(i, e, centers[Math.min(i, centers.length - 1)], size, foot, many ? 94 : 130, e.role === 1 ? `★${e.name}` : e.name, true);
    });
  }

  /** 유닛: 픽셀 그림(모든 직업·몬스터에 있음) + 발밑 타원 + 이름·HP 막대. footColor가 빈 글자면 그림자. */
  private unit(index: number, c: Combatant, center: [number, number], size: number, footColor: string, width: number, title: string, enemy: boolean): void {
    const b = this.b!;
    const stage = this.stage!;
    const spriteId = enemy ? c.species?.Id : b.character.Job.toLowerCase();
    const sprite = spriteUrl(spriteId) ?? '';
    // 이름·HP 막대는 그림(바닥 맞춤, 24칸 × 배율) 위로
    const body = Math.max(size, 24 * spriteScale(size));
    const top = center[1] + size / 2 - body;
    const hp = this.hpBefore?.get(index) ?? c.hp;
    const alive = hp > 0;
    // 보스의 다음 턴 행동 예고는 이름 자리에 주황색으로 (연출 중에는 이름)
    const intent = enemy && alive && c.kit && !this.playing && !this.pending ? c.kit.intent : '';
    const warn = !!intent;
    const name = h('div', { class: 'unit-label', 'data-anchor': warn ? 'battle.intent' : undefined, style: { left: `${center[0] - width / 2}px`, top: `${top - (enemy ? 44 : 30)}px`, width: `${width}px`, fontSize: `${enemy ? 11 : 12}px`, color: warn ? 'var(--warn)' : alive ? 'var(--text)' : 'var(--sub)', fontWeight: !enemy || warn ? '700' : '400' } }, warn ? `! ${intent}` : title);
    stage.append(name);
    let hpText = name;
    if (enemy) {
      hpText = h('div', { class: 'unit-label', style: { left: `${center[0] - width / 2}px`, top: `${top - 28}px`, width: `${width}px`, fontSize: '10px', color: 'var(--red-light)' } });
      stage.append(hpText);
    }
    const barW = Math.min(width - 10, 86);
    const barFill = h('i', { style: { background: enemy ? 'var(--red)' : 'var(--green)' } });
    stage.append(h('div', { class: 'hpbar', style: { left: `${center[0] - barW / 2}px`, top: `${top - 12}px`, width: `${barW}px` } }, barFill));

    // 픽셀 그림: 무대에 정수 배율로 세운다. 선택한 적은 발밑이 금색으로 깜빡임
    const root = h('div', { class: 'unit-shape', style: { left: `${center[0] - size / 2}px`, top: `${center[1] - size / 2}px`, width: `${size}px`, height: `${size}px`, opacity: alive ? '1' : '.3' } });
    const foot = (color: string): HTMLElement => h('div', { class: 'unit-foot', style: { background: color } });
    root.append(foot(footColor || 'var(--foot-shadow)'));
    if (enemy && index === this.target && alive && !b.isOver) root.append(Object.assign(foot('var(--gold)'), { className: 'unit-foot blink' }));
    const img = h('img', { src: sprite, alt: '', class: 'unit-sprite' }) as HTMLImageElement;
    img.onload = () => { img.style.width = `${img.naturalWidth * spriteScale(size)}px`; };
    root.append(img);
    const v: UnitView = { shape: root, bar: barFill, hpText, enemyHp: enemy, center, size, body, maxHp: c.maxHp, hp, shield: c.kit ? c.kit.shield : -1, barrier: c.kit ? c.kit.barrier : -1 };
    this.setBar(v, hp, c.kit ? c.kit.shield : -1, c.kit ? c.kit.barrier : -1);
    if (alive) {
      // 적: 누르면 대상 선택, 대상을 한 번 더 누르면 상세 · 나: 누르면 캐릭터 정보. 길게 누르면 언제나 상세
      longPress(root, () => this.showUnit(index), () => {
        if (index >= 0 && index !== this.target) this.selectTarget(index);
        else this.showUnit(index);
      });
    }
    stage.append(root);
    // 상태 이상 아이콘 (도형 아래). 1턴 남으면 천천히 깜빡인다
    const vis = c.statuses.visible();
    if (c.alive && vis.length > 0) {
      const tags = h('div', { class: 'stat-icons', style: { left: `${center[0]}px`, top: `${center[1] + size / 2 + 5}px` } });
      // 3개 이상이면 2개만 보이고 셋째 칸에 '…' (눌러서 상세 정보에서 모두 확인)
      vis.slice(0, 2).forEach((s) => tags.append(Object.assign(icon(statusIcon(s.Type), 18), s.Turns === 1 ? { className: 'ic blink' } : {})));
      if (vis.length >= 3) tags.append(h('span', { class: 'more' }, '…'));
      stage.append(tags);
    }
    this.units.set(index, v);
  }

  /** HP 막대와 숫자. 보스는 남은 보호막(+푸른 숫자)·방어막(◆횟수)을 함께 보여 준다. */
  private setBar(v: UnitView, hp: number, shield = -2, barrier = -2): void {
    v.hp = hp;
    if (shield > -2) v.shield = shield;
    if (barrier > -2) v.barrier = barrier;
    const ratio = v.maxHp <= 0 ? 0 : Math.max(0, Math.min(1, hp / v.maxHp));
    v.bar.style.transform = `scaleX(${ratio})`; // 폭 대신 transform으로 줄인다 (그리기 비용·끊김 감소)
    const el = v.hpText;
    el.replaceChildren(`${v.enemyHp ? '' : 'HP '}${Math.max(0, hp)}/${v.maxHp}`);
    if (hp > 0 && v.shield > 0) el.append(' ', colored(`+${v.shield}`, 'var(--info)'));
    if (hp > 0 && v.barrier > 0) el.append(' ', colored(`◆${v.barrier}`, 'var(--barrier)'));
  }

  /** 도형의 상세 정보: 나는 캐릭터 정보 창, 적은 HP·공격력·방어력·보호막·상태 이상. */
  private showUnit(index: number): void {
    const b = this.b!;
    if (this.playing || this.leaving) return;
    if (index < 0) return showCharacterInfo(b);
    if (index >= b.enemies.length || !b.enemies[index].alive) return;
    showEnemyInfo(b.enemies[index], index === this.target, () => this.selectTarget(index));
  }

  private selectTarget(index: number): void {
    if (this.playing || this.finished || this.leaving || index === this.target) return;
    this.target = index;
    router.rebuild();
  }

  // ── 기록 (최근 3줄) ──

  private log(): HTMLElement {
    const b = this.b!;
    const start = Math.max(0, b.log.length - 3);
    const el = h('div', { class: 'battlelog' });
    const text = h('div', { class: 'grow', style: { minWidth: '0' } });
    for (let i = start; i < b.log.length; i++) {
      const line = b.log[i];
      text.append(h('div', { style: { color: TONE_COLOR[line.tone], opacity: i === b.log.length - 1 ? '1' : '.7', minHeight: '18px' } }, line.text));
    }
    el.append(text);
    if (!b.isOver) el.append(this.potionIcon());
    return el;
  }

  // ── 선택지 ──

  private choices(parent: HTMLElement): void {
    const b = this.b!;
    const targetName = this.target >= 0 ? b.enemies[this.target].name : '';
    parent.append(h('div', { class: 'row' },
      this.target >= 0
        ? h('div', { class: 'sub grow' }, h('span', { class: 'nw' }, '대상 ', colored(targetName, 'var(--gold)')), ' · ', h('span', { class: 'nw' }, '적을 눌러 바꾸기'))
        : h('div', { class: 'sub grow' }, '모든 선택은 1턴을 사용합니다'),
      sub('길게 누르면 상세')));
    const list = h('div', { class: 'col', 'data-anchor': 'battle.choices', style: { gap: '6px', overflowY: 'auto', flex: '1', minHeight: '0', paddingTop: '2px' } });
    const bottom: HTMLElement[] = [];
    for (const ch of b.getChoices()) {
      if (ch.target >= 0 && ch.target !== this.target) continue;
      const el = this.choice(ch);
      if (ch.kind === 'Attack' && !list.querySelector('[data-anchor="battle.choice0"]')) el.dataset.anchor = 'battle.choice0';
      // 아이템 사용과 도망치기는 맨 아래 한 줄에 좌우로
      if (ch.kind === 'Item' || ch.kind === 'Flee') bottom.push(el);
      else list.append(el);
    }
    if (bottom.length > 0) list.append(h('div', { class: 'row', style: { gap: '6px', alignItems: 'stretch' } }, ...bottom.map((e) => Object.assign(e, { style: `${e.getAttribute('style')};flex:1 1 0;min-width:0` }))));
    if (this.playing) list.style.pointerEvents = 'none';
    parent.append(list);
  }

  /** 전투 로그 오른쪽 끝 물약 버튼: 마시면 한 턴을 쓴다. */
  private potionIcon(): HTMLElement {
    return potionButton((item) => {
      const ch = this.b!.getItemChoices().find((x) => x.itemUid === item.Uid);
      if (!ch || !ch.enabled) return void toast('지금은 마실 수 없습니다');
      if (this.playing || this.finished || this.leaving) return;
      this.execute(ch); // 물약을 이미 골랐으니 아이템 사용 창을 다시 띄우지 않는다
    }, 'battle-potion', {}, () => this.b!.player.hp >= this.b!.player.maxHp);
  }

  private kindStyle(ch: BattleChoice): { tag: string; bar: string; fill: string; border: string } {
    switch (ch.kind) {
      case 'Skill': {
        const def = skillDef(ch.skillId);
        return { tag: '스킬', bar: def ? tierColor(def.Tier) : 'var(--blue-sub)', fill: 'var(--c-skill-bg)', border: 'var(--c-skill-border)' };
      }
      case 'Item': return { tag: '아이템', bar: 'var(--c-item-bar)', fill: 'var(--c-item-bg)', border: 'var(--c-item-border)' };
      case 'Flee': return { tag: '도주', bar: 'var(--c-flee-bar)', fill: 'var(--c-flee-bg)', border: 'var(--c-flee-border)' };
      case 'Attack': return { tag: '기본 공격', bar: 'var(--c-attack-bar)', fill: 'var(--btn)', border: 'var(--btn-border)' };
      default: return { tag: '대기', bar: 'var(--c-wait-bar)', fill: 'var(--btn)', border: 'var(--btn-border)' };
    }
  }

  private choice(ch: BattleChoice): HTMLElement {
    const pct = ch.enabled && ch.kind !== 'Item' && ch.kind !== 'Wait';
    // 아이템·도주는 추가 설명 없이 (못 쓸 때는 눌렀을 때 알림)
    const plain = ch.kind === 'Item' || ch.kind === 'Flee';
    const right = plain ? (ch.kind === 'Flee' && ch.enabled ? `${Math.round(ch.chance * 100)}%` : '') : ch.enabled ? (ch.kind === 'Wait' ? ch.note : `${Math.round(ch.chance * 100)}%`) : ch.note;
    const skillColor = ch.kind === 'Skill' && skillDef(ch.skillId) ? tierColor(skillDef(ch.skillId)!.Tier) : null; // 스킬 이름은 등급 색 (등급 글자는 상세 창에서)
    // 여러 번 때리는 스킬의 %는 한 번 때릴 때의 확률
    const perHit = pct && ch.kind === 'Skill' && (skillDef(ch.skillId)?.Hits ?? 1) > 1;
    let label = ch.label;
    if (ch.target >= 0) {
      const cut = label.indexOf(' · ');
      if (cut > 0) label = label.slice(0, cut);
    }
    if (ch.kind === 'Attack') label = '공격';
    // 예상 피해를 바로 보여 준다 (스킬은 효과 요약도 함께)
    const subText: string | null = ch.damageNote || null;
    const st = this.kindStyle(ch);
    const el = h('div', { role: 'button', class: 'bchoice', style: { background: st.fill, border: `1px solid ${st.border}`, minHeight: subText ? '60px' : '52px', cursor: 'pointer', opacity: ch.enabled ? '1' : '.5' } },
      h('i', { class: 'kbar', style: { background: st.bar } }),
      h('div', { class: 'col grow', style: { gap: '1px' } }, h('span', { class: 'tag', style: { color: st.bar } }, st.tag), h('span', { class: 'name', style: skillColor ? { color: skillColor } : {} }, label), subText ? h('span', { class: 'dmg' }, subText) : null),
      right ? h('div', { class: 'col', style: { alignItems: 'flex-end', gap: '0' } },
        perHit ? h('span', { style: { fontSize: '11px', color: 'var(--sub)' } }, '타격당') : null,
        h('span', { style: { fontSize: pct ? '15px' : '14px', fontWeight: '700', color: pct ? 'var(--gold)' : 'var(--sub)', textAlign: 'right', whiteSpace: 'nowrap' } }, right)) : null); // 재사용 대기 'N턴'은 한 줄로 크게
    longPress(el, () => {
      if (!tutorial.running) this.showDetail(ch); // 튜토리얼 중에는 안내한 행동만
    }, () => this.pick(ch));
    return el;
  }

  private showDetail(ch: BattleChoice): void {
    const text = ch.detail || ch.note;
    const m = modal(ch.label);
    const def = ch.kind === 'Skill' ? skillDef(ch.skillId) : null;
    if (def) m.body.append(areaDiagram(def));
    m.body.append(h('div', { class: 'body', style: { whiteSpace: 'pre-line', lineHeight: '1.4', fontSize: '14px' } }, text));
  }

  private pick(ch: BattleChoice): void {
    if (this.playing || this.finished || this.leaving) return;
    if (!ch.enabled) {
      if (ch.kind === 'Flee') toast(this.b!.isBoss ? '보스에게서는 도망칠 수 없습니다' : '지금은 도망칠 수 없습니다');
      else if (ch.kind === 'Item') toast('사용할 수 있는 아이템이 없습니다');
      return;
    }
    if (ch.kind === 'Flee' && tutorial.blocks('도주')) return;
    if (ch.kind === 'Item') return this.itemMenu();
    this.execute(ch);
  }

  private itemMenu(): void {
    const m = modal('아이템 사용');
    m.body.append(sub('아이템 사용도 1턴을 씁니다.'));
    for (const ch of this.b!.getItemChoices()) {
      const bt = h('button', { class: 'card-btn row', style: { minHeight: '50px', padding: '6px 14px', borderRadius: '10px', opacity: ch.enabled ? '1' : '.5' }, on: { click: () => {
        if (!ch.enabled) return;
        m.close();
        this.execute(ch);
      } } }, h('b', { class: 'grow', style: { textAlign: 'left' } }, ch.label), h('span', { class: 'sub' }, ch.note));
      m.body.append(bt);
    }
  }

  private execute(ch: BattleChoice): void {
    const b = this.b!;
    this.hpBefore = new Map([[-1, b.player.hp]]);
    b.enemies.forEach((e, i) => this.hpBefore!.set(i, e.hp));
    S.executeBattle(ch);
    this.pending = [...b.lastEvents];
    router.rebuild();
  }

  // ── 연출 재생 ──

  /** 시작과 동시에 일어난 사건(기습)의 이전 HP를 사건에서 거꾸로 계산한다. */
  private inferBefore(events: BattleEvent[]): Map<number, number> {
    const b = this.b!;
    const d = new Map<number, number>();
    for (const e of events) {
      if (d.has(e.target)) continue;
      const who = e.target < 0 ? b.player : e.target < b.enemies.length ? b.enemies[e.target] : null;
      if (!who) continue;
      if (e.kind === 'Damage') d.set(e.target, Math.min(who.maxHp, e.hpAfter + e.amount));
      else if (e.kind === 'Heal') d.set(e.target, Math.max(0, e.hpAfter - e.amount));
      else if (e.kind === 'Miss') d.set(e.target, e.hpAfter);
    }
    return d;
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(() => {
      if (this.alive) fn();
    }, ms / settings.battleSpeed));
  }

  private startPlayback(events: BattleEvent[]): void {
    this.playing = true;
    setFxSpeed(settings.battleSpeed);
    if (this.lower) this.lower.style.pointerEvents = 'none';
    this.later(50, () => this.playNext(events, 0));
  }

  private playNext(events: BattleEvent[], i: number): void {
    if (!this.stage) return;
    if (i >= events.length) return this.endPlayback();
    const e = events[i];
    let wait = STEP;
    const unit = this.units.get(e.target);
    switch (e.kind) {
      case 'Act': {
        const actor = this.units.get(e.actor);
        if (actor) this.dash(actor.shape, e.actor < 0 ? 34 : -28);
        if (e.text) this.float(e.actor, e.text, 'var(--gold)', 13, false);
        const from = this.spot(e.actor);
        this.wave.clear();
        wait = STEP * 0.6;
        if (e.actor >= 0) {
          this.fxStyle = 'claw';
          if (from && e.text) fxEnemyCast(this.stage, from);
          break;
        }
        const job = this.b!.character.Job, id = ALL_SKILLS.find((s) => s.Name === e.text)?.Id ?? null;
        this.fxStyle = fxStyleFor(job, id);
        // 스킬마다 다른 연출: 맞을 적들을 미리 모아 넘기고, 맞는 순간까지 기다린다
        if (from) wait = Math.max(wait, fxSkill(this.stage, from, this.playerTargets(events, i), job, id) + 40);
        break;
      }
      case 'Damage':
        this.shown(e.target, e.hpAfter);
        if (unit) {
          this.shake(unit.shape, e.damage === 'Crit' || e.damage === 'Counter' ? 10 : e.damage === 'Blocked' ? 3 : 6);
          this.flashUnit(unit.shape, e.target < 0 ? 'red' : 'white');
          this.setBar(unit, e.hpAfter, e.shield, e.barrier);
          const at = this.spot(e.target)!;
          if (e.damage === 'Poison' || e.damage === 'Bleed' || e.damage === 'Burn') fxTick(this.stage, at, e.damage);
          else {
            if (e.damage === 'Counter') {
              // 반격 태세 발동: 받아친 피해는 기본 공격 계열로 보여 준다
              const me = this.spot(-1);
              if (me) fxCounter(this.stage, me);
              this.fxStyle = fxStyleFor(this.b!.character.Job, null);
            }
            fxHit(this.stage, at, this.fxStyle, e.damage === 'Crit' || e.damage === 'Counter');
          }
        }
        // 독·출혈·화상처럼 턴마다 들어가는 피해는 이름을 붙여 공격 피해와 헷갈리지 않게 한다
        if (e.damage === 'Poison' || e.damage === 'Bleed' || e.damage === 'Burn') this.float(e.target, `${Names.status(e.damage)} ${e.amount}`, DAMAGE_COLOR[e.damage], 15, true);
        else {
          const [tag, size] = DAMAGE_TAG[e.damage] ?? ['', 19];
          this.float(e.target, `${tag}${e.amount}`, DAMAGE_COLOR[e.damage], size, true);
        }
        if ((e.damage === 'Crit' || e.damage === 'Counter') && e.actor === -1) vibrate();
        if (e.target < 0 && e.actor >= 0) vibrate();
        wait = this.waveWait(events, i);
        break;
      case 'Miss':
        if (unit) fxDodge(unit.shape, e.target >= 0);
        this.float(e.target, '빗나감', 'var(--sub)', 15, false);
        wait = this.waveWait(events, i);
        break;
      case 'Heal':
        this.shown(e.target, e.hpAfter);
        if (unit) {
          this.setBar(unit, e.hpAfter);
          fxHeal(this.stage, this.spot(e.target)!);
        }
        this.float(e.target, `+${e.amount}`, DAMAGE_COLOR.Heal, 19, true);
        break;
      case 'Status': {
        const type = STATUS_BY_NAME.get(e.text ?? ''), at = this.spot(e.target);
        if (type && at) fxStatus(this.stage, at, type, assetUrl(`icons/${statusIcon(type)}.png`));
        this.float(e.target, e.text ?? '', 'var(--blue-light)', 13, false);
        wait = STEP * 0.6;
        break;
      }
      case 'Defeat':
        this.shown(e.target, 0);
        if (unit) fxDefeat(unit.shape);
        break;
      case 'Spawn':
        // 분열·소환: 그 자리에 새 적을 그린다 (다른 적은 지금 보이는 HP 그대로)
        this.shown(e.target, e.hpAfter);
        this.rebuildStage();
        this.float(e.target, '등장!', 'var(--warn)', 15, true);
        wait = STEP * 0.8;
        break;
      default: {
        // 방어막에 막힘: 남은 횟수를 바로 줄여 보여 준다
        const guarded = this.units.get(e.target);
        if (e.barrier >= 0 && guarded) this.setBar(guarded, guarded.hp, e.shield, e.barrier);
        this.float(e.actor, e.text ?? '', 'var(--gold)', 16, true);
      }
    }
    this.later(wait, () => this.playNext(events, i + 1));
  }

  /** 이번 플레이어 행동(다음 'Act' 전까지)에 맞는 적들의 자리. 턴마다 드는 피해는 뺀다. */
  private playerTargets(events: BattleEvent[], i: number): Spot[] {
    const seen = new Set<number>(), out: Spot[] = [];
    for (let j = i + 1; j < events.length && events[j].kind !== 'Act'; j++) {
      const e = events[j];
      if (e.actor !== -1 || e.target < 0 || seen.has(e.target) || !this.isPlayerHit(e)) continue;
      seen.add(e.target);
      const s = this.spot(e.target);
      if (s) out.push(s);
    }
    return out;
  }
  private isPlayerHit(e: BattleEvent): boolean {
    return e.actor === -1 && e.target >= 0 && (e.kind === 'Miss' || (e.kind === 'Damage' && e.damage !== 'Poison' && e.damage !== 'Bleed' && e.damage !== 'Burn'));
  }
  /** 광역기: 같은 공격에서 아직 안 맞은 다른 적이 이어지면 거의 동시에 맞힌다 (다음 묶음은 한 박자 쉰다). */
  private waveWait(events: BattleEvent[], i: number): number {
    const e = events[i], next = events[i + 1];
    if (!this.isPlayerHit(e)) return STEP;
    this.wave.add(e.target);
    if (next && this.isPlayerHit(next) && !this.wave.has(next.target)) return 50;
    this.wave.clear();
    return STEP;
  }

  private spot(index: number): Spot | null {
    const u = this.units.get(index);
    // 그림은 바닥에 맞춰 서 있으므로 보이는 몸통 가운데를 쓴다
    return u ? { x: u.center[0], y: u.center[1] + u.size / 2 - u.body / 2, size: u.body * 0.8 } : null;
  }

  private shown(index: number, hp: number): void {
    if (!this.hpBefore) this.hpBefore = new Map();
    this.hpBefore.set(index, hp);
  }

  private rebuildStage(): void {
    this.stage!.replaceChildren();
    this.units.clear();
    this.buildStage();
  }

  private dash(el: HTMLElement, dx: number): void {
    el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], { duration: 260 / settings.battleSpeed, easing: 'ease-out' });
  }
  private shake(el: HTMLElement, amp: number): void {
    el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-amp}px)` }, { transform: `translateX(${amp}px)` }, { transform: `translateX(${-amp / 2}px)` }, { transform: 'translateX(0)' }], { duration: 240 / settings.battleSpeed });
  }
  private flashUnit(el: HTMLElement, kind: 'red' | 'white'): void {
    el.animate([{ filter: kind === 'white' ? 'brightness(3)' : 'brightness(1.6) saturate(3) hue-rotate(-30deg)' }, { filter: 'brightness(1)' }], { duration: 260 / settings.battleSpeed });
  }

  private float(index: number, text: string, color: string, size: number, bold: boolean): void {
    const u = this.units.get(index);
    if (!text || !u) return;
    const jitter = Math.random() * 20 - 10;
    const x = Math.max(60, Math.min(330, u.center[0] + jitter));
    const y = u.center[1] - u.size * 0.15;
    this.stage!.append(h('div', { class: 'floatup', style: { left: `${x}px`, top: `${y}px`, color, fontSize: `${size}px`, fontWeight: bold ? '700' : '400' } }, text));
    window.setTimeout(() => this.stage?.querySelector('.floatup')?.remove(), 1000);
  }

  private endPlayback(): void {
    const b = this.b!;
    this.playing = false;
    this.hpBefore = null;
    switch (b.outcome) {
      case 'Victory':
        this.finished = true;
        if (S.lastLoot && S.lastLoot.LevelsGained > 0) vibrate();
        router.rebuild();
        this.later(1800 * settings.battleSpeed, () => this.continue());
        break;
      case 'Defeat':
        this.leaving = true; // 이동 전 잠깐 동안 다시 그리면 이동이 사라지므로 입력을 막는다
        this.later(800, () => goResult(S.lastDeath?.HardcoreReset ? 'Hardcore' : 'Death'));
        break;
      case 'Fled':
        this.leaving = true;
        this.later(400, () => goDungeon());
        break;
      default:
        this.fixTarget();
        router.rebuild();
    }
  }

  // ── 승리 ──

  private finishedView(parent: HTMLElement): void {
    const b = this.b!;
    const loot = S.lastLoot;
    const card = h('div', { class: 'card', role: 'button', style: { background: 'var(--accent-bg)', borderColor: 'var(--accent)', gap: '6px', padding: '12px 14px', cursor: 'pointer' }, on: { click: () => this.continue() } },
      h('div', { class: 'gold display', style: { fontSize: '20px' } }, b.isBoss ? '보스를 쓰러뜨렸다!' : '승리!'));
    if (loot) {
      if (loot.Gold !== 0) card.append(h('div', null, `· 골드 +${loot.Gold.toLocaleString('en-US')}`));
      if (loot.Exp !== 0) card.append(h('div', null, `· 경험치 +${loot.Exp.toLocaleString('en-US')}`));
      for (const i of mergeStacks(loot.Items)) card.append(h('div', null, `· ${i.Count > 1 ? `${i.Name}${i.Enhance > 0 ? ` +${i.Enhance}` : ''} ×${i.Count}` : i.Enhance > 0 ? `${i.Name} +${i.Enhance}` : i.Name}`));
      if (loot.Dropped.length > 0) card.append(h('div', { style: { color: 'var(--red-light)', fontSize: '13px' } }, `· 가방이 가득 참: ${itemNames(loot.Dropped)} (던전에서 가방 물품과 바꿀 수 있어요)`));
      if (loot.LevelsGained > 0) card.append(h('b', { class: 'gold' }, `레벨 업! Lv.${b.character.Level} · 능력치 포인트 +${loot.LevelsGained * B.PointsPerLevel}`));
    }
    parent.append(h('div', { style: { overflowY: 'auto', flex: '1' } }, card));
  }

  private continue(): void {
    if (this.leaving) return;
    this.leaving = true;
    const levels = S.lastLoot?.LevelsGained ?? 0;
    const trial = S.trialWon;
    S.closeBattle();
    if (S.justClearedGame) {
      S.justClearedGame = false;
      return goResult('Clear');
    }
    // 시련의 문: 이기면 바로 마을로 돌아간다
    if (trial) return goResult('Return');
    if (S.inDungeon && S.pendingEvent === null) return goDungeon(levels > 0);
    goToCurrent();
  }

  private pause(): void {
    const m = modal('일시정지');
    m.body.append(
      sub('전투 중에 앱을 끄면, 다시 켰을 때 이 방의 전투를 처음부터 다시 시작합니다.'),
      button('계속하기', m.close, 'primary'),
      button('설정', () => {
        m.close();
        this.speedSettings();
      }, '', ''),
      button('저장하고 타이틀로', () => {
        m.close();
        S.save();
        goTitle();
      }, 'ghost'));
  }

  private speedSettings(): void {
    const m = modal('전투 설정');
    m.body.append(
      button(`전투 속도 ${settings.battleSpeed === 1 ? '1× → 2×' : '2× → 1×'}`, () => {
        settings.battleSpeed = settings.battleSpeed === 1 ? 2 : 1;
        m.close();
        router.rebuild();
      }),
      button(`진동 ${settings.vibration ? '끄기' : '켜기'}`, () => {
        settings.vibration = !settings.vibration;
        m.close();
      }));
  }
}

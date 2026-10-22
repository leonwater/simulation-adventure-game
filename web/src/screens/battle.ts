import { tutorial } from '../ui/tutorial';
import { B } from '../core/balance';
import type { BattleChoice, BattleEvent, DamageKind, LogTone } from '../core/battle';
import type { Battle } from '../core/battle';
import type { Combatant } from '../core/combatant';
import { themeIndex } from '../core/monsters';
import { itemNames } from '../core/loot';
import { skillDef } from '../core/skills';
import { Names } from '../core/names';
import { showCharacterInfo, showEnemyInfo, statusIcon } from '../ui/charinfo';
import { pauseButton } from '../ui/chrome';
import { S } from '../ui/game';
import { colored } from '../ui/items';
import { button, h, icon, longPress, sub } from '../ui/kit';
import { modal } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { dungeonTheme } from '../ui/theme';
import { settings, vibrate } from '../ui/settings';
import { goDungeon, goResult, goTitle, goToCurrent } from './index';

const STEP = 320;
type Shape = 'circle' | 'square' | 'hexagon';
const HEX = 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)';

interface UnitView {
  shape: HTMLElement;
  fill: HTMLElement;
  bar: HTMLElement;
  hpText: HTMLElement;
  enemyHp: boolean;
  center: [number, number];
  size: number;
  maxHp: number;
  hp: number;
  shield: number;
  barrier: number;
}

const DAMAGE_COLOR: Record<DamageKind, string> = { Normal: '#fff', Crit: '#E2B657', Poison: '#7BC86F', Bleed: '#E0524A', Burn: '#F0913A', Heal: '#A8E6A0' };
const TONE_COLOR: Record<LogTone, string> = { Normal: '#C9C3B7', Good: '#E2B657', Bad: '#E38A82', System: '#ECE7DD' };

function enemyCenters(n: number): [number, number][] {
  switch (n) {
    case 1: return [[286, 150]];
    case 2: return [[242, 150], [338, 150]];
    case 3: return [[242, 86], [338, 86], [290, 230]];
    default: return [[242, 86], [338, 86], [242, 230], [338, 230]];
  }
}

/**
 * 전투: 위쪽 전투 무대(왼쪽 내 원형, 오른쪽 적 최대 4 — 일반 사각형 · 엘리트 굵은 테두리 · 보스 육각형),
 * 적을 눌러 대상 선택, 2~3줄 기록, 아래 선택지(성공 확률, 길게 누르면 계산 내역).
 * 행동 결과는 Battle.lastEvents를 차례로 재생한다 (돌진·흔들림·번쩍임·떠오르는 피해 숫자).
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
    const stageWrap = h('div', { class: 'stagewrap', style: { background: th.stage } });
    this.stage = h('div', { class: 'stage' });
    stageWrap.append(h('div', { style: { position: 'absolute', left: '0', right: '0', bottom: '0', height: '70px', background: `linear-gradient(to top, ${th.line}59, transparent)` } }), this.stage);
    this.buildStage();
    this.lower = h('div', { class: 'lower' });
    if (this.finished) this.finishedView(this.lower);
    else if (!b.isOver || this.pending) this.choices(this.lower);
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
      h('b', { class: 'grow', style: { fontSize: '15px' } }, `${b.floor}층 · ${b.isBoss ? '보스전' : '전투'} `, colored(`${b.turn}턴째`, 'var(--sub)')),
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
    this.unit(-1, p, [84, 158], 76, 'circle', '#23324A', '#9EC0E8', 3, 130, `HP ${p.hp}/${p.maxHp}`, false);
    const centers = enemyCenters(b.enemies.length);
    b.enemies.forEach((e, i) => {
      const many = b.enemies.length > 1;
      const shape: Shape = e.role === 2 ? 'hexagon' : 'square';
      const size = e.role === 2 ? (many ? 72 : 96) : e.role === 1 ? 62 : 56;
      const border = e.role === 2 ? '#E0873A' : e.role === 1 ? '#E2B657' : '#8A5A56';
      const borderW = e.role === 0 ? 2 : 5;
      const fill = e.role === 2 ? '#3A1E1A' : '#33242A';
      this.unit(i, e, centers[Math.min(i, centers.length - 1)], size, shape, fill, border, borderW, many ? 94 : 130, e.role === 1 ? `★${e.name}` : e.name, true);
    });
  }

  private unit(index: number, c: Combatant, center: [number, number], size: number, shape: Shape, fill: string, border: string, borderW: number, width: number, title: string, enemy: boolean): void {
    const b = this.b!;
    const stage = this.stage!;
    const top = center[1] - size / 2;
    const hp = this.hpBefore?.get(index) ?? c.hp;
    const alive = hp > 0;
    // 보스의 다음 턴 행동 예고는 이름 자리에 주황색으로 (연출 중에는 이름)
    const intent = enemy && alive && c.kit && !this.playing && !this.pending ? c.kit.intent : '';
    const warn = !!intent;
    const name = h('div', { class: 'unit-label', 'data-anchor': warn ? 'battle.intent' : undefined, style: { left: `${center[0] - width / 2}px`, top: `${top - (enemy ? 44 : 30)}px`, width: `${width}px`, fontSize: `${enemy ? 11 : 12}px`, color: warn ? '#FF9A4A' : alive ? 'var(--text)' : 'var(--sub)', fontWeight: !enemy || warn ? '700' : '400' } }, warn ? `! ${intent}` : title);
    stage.append(name);
    let hpText = name;
    if (enemy) {
      hpText = h('div', { class: 'unit-label', style: { left: `${center[0] - width / 2}px`, top: `${top - 28}px`, width: `${width}px`, fontSize: '10px', color: 'var(--red-light)' } });
      stage.append(hpText);
    }
    const barW = Math.min(width - 10, 86);
    const barFill = h('i', { style: { background: enemy ? 'var(--red)' : 'var(--green)' } });
    stage.append(h('div', { class: 'hpbar', style: { left: `${center[0] - barW / 2}px`, top: `${top - 12}px`, width: `${barW}px` } }, barFill));

    // 도형 (선택 표시 → 테두리 → 채움). 도형 안에는 글자를 넣지 않는다
    const root = h('div', { class: 'unit-shape', style: { left: `${center[0] - size / 2}px`, top: `${center[1] - size / 2}px`, width: `${size}px`, height: `${size}px`, opacity: alive ? '1' : '.3' } });
    const layer = (color: string, inset: number): HTMLElement => {
      const el = h('div', { style: { left: `${inset}px`, top: `${inset}px`, right: `${inset}px`, bottom: `${inset}px`, background: color, borderRadius: shape === 'circle' ? '50%' : shape === 'square' ? '8px' : '0', clipPath: shape === 'hexagon' ? HEX : '' } });
      return el;
    };
    const selected = enemy && index === this.target && alive && !b.isOver;
    if (selected) root.append(Object.assign(layer('var(--gold)', -7), { className: 'blink' }));
    root.append(layer(border, 0));
    const fillEl = layer(fill, borderW);
    root.append(fillEl);
    const v: UnitView = { shape: root, fill: fillEl, bar: barFill, hpText, enemyHp: enemy, center, size, maxHp: c.maxHp, hp, shield: c.kit ? c.kit.shield : -1, barrier: c.kit ? c.kit.barrier : -1 };
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
      vis.slice(0, enemy && b.enemies.length > 1 ? 4 : 6).forEach((s) => tags.append(Object.assign(icon(statusIcon(s.Type), 18), s.Turns === 1 ? { className: 'ic blink' } : {})));
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
    v.bar.style.width = `${ratio * 100}%`;
    const el = v.hpText;
    el.replaceChildren(`${v.enemyHp ? '' : 'HP '}${Math.max(0, hp)}/${v.maxHp}`);
    if (hp > 0 && v.shield > 0) el.append(' ', colored(`+${v.shield}`, '#8FC7FF'));
    if (hp > 0 && v.barrier > 0) el.append(' ', colored(`◆${v.barrier}`, '#C9B8FF'));
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
    for (let i = start; i < b.log.length; i++) {
      const line = b.log[i];
      el.append(h('div', { style: { color: TONE_COLOR[line.tone], opacity: i === b.log.length - 1 ? '1' : '.7', minHeight: '18px' } }, line.text));
    }
    return el;
  }

  // ── 선택지 ──

  private choices(parent: HTMLElement): void {
    const b = this.b!;
    const targetName = this.target >= 0 ? b.enemies[this.target].name : '';
    parent.append(h('div', { class: 'row' },
      this.target >= 0
        ? h('div', { class: 'sub grow' }, '대상 ', colored(targetName, 'var(--gold)'), ' · 적을 눌러 바꾸기')
        : h('div', { class: 'sub grow' }, '모든 선택은 1턴을 사용합니다'),
      sub('길게 누르면 상세')));
    const list = h('div', { class: 'col', 'data-anchor': 'battle.choices', style: { gap: '6px', overflowY: 'auto', flex: '1', minHeight: '0', paddingTop: '2px' } });
    for (const ch of b.getChoices()) {
      if (ch.target >= 0 && ch.target !== this.target) continue;
      const el = this.choice(ch);
      if (ch.kind === 'Attack' && !list.querySelector('[data-anchor="battle.choice0"]')) el.dataset.anchor = 'battle.choice0';
      list.append(el);
    }
    if (this.playing) list.style.pointerEvents = 'none';
    parent.append(list);
  }

  private kindStyle(ch: BattleChoice): { tag: string; bar: string; fill: string; border: string } {
    switch (ch.kind) {
      case 'Skill': {
        const def = skillDef(ch.skillId);
        return { tag: `스킬${def ? ` · ${Names.tier(def.Tier)}` : ''}`, bar: '#7FA8D8', fill: '#1A2130', border: '#34465C' };
      }
      case 'Item': return { tag: '아이템', bar: '#7DB38A', fill: '#1A231E', border: '#34503C' };
      case 'Flee': return { tag: '도주', bar: '#B07A70', fill: '#221C1D', border: '#4A3634' };
      case 'Attack': return { tag: '기본 공격', bar: '#A9A39A', fill: 'var(--btn)', border: 'var(--btn-border)' };
      default: return { tag: '대기', bar: '#6A6E78', fill: 'var(--btn)', border: 'var(--btn-border)' };
    }
  }

  private choice(ch: BattleChoice): HTMLElement {
    const pct = ch.enabled && ch.kind !== 'Item' && ch.kind !== 'Wait';
    const right = ch.enabled ? (ch.kind === 'Item' || ch.kind === 'Wait' ? ch.note : `${Math.round(ch.chance * 100)}%`) : ch.note;
    let label = ch.label;
    if (ch.target >= 0) {
      const cut = label.indexOf(' · ');
      if (cut > 0) label = label.slice(0, cut);
    }
    if (ch.kind === 'Attack') label = '공격';
    // 예상 피해를 바로 보여 준다 (스킬은 효과 요약도 함께)
    let subText: string | null = ch.damageNote || null;
    if (ch.kind === 'Skill') {
      const def = skillDef(ch.skillId);
      if (def) subText = subText === null ? def.Effect : `${subText} · ${def.Effect}`;
    }
    const st = this.kindStyle(ch);
    const el = h('div', { role: 'button', class: 'bchoice', style: { background: st.fill, border: `1px solid ${st.border}`, minHeight: subText ? '60px' : '52px', cursor: 'pointer', opacity: ch.enabled ? '1' : '.5' } },
      h('i', { class: 'kbar', style: { background: st.bar } }),
      h('div', { class: 'col grow', style: { gap: '1px' } }, h('span', { class: 'tag', style: { color: st.bar } }, st.tag), h('span', { class: 'name' }, label), subText ? h('span', { class: 'dmg' }, subText) : null),
      right ? h('span', { style: { fontSize: pct ? '15px' : '12px', fontWeight: pct ? '700' : '400', color: pct ? 'var(--gold)' : 'var(--sub)', textAlign: 'right' } }, right) : null);
    longPress(el, () => this.showDetail(ch), () => this.pick(ch));
    return el;
  }

  private showDetail(ch: BattleChoice): void {
    const text = ch.detail || ch.note;
    const m = modal(ch.label);
    m.body.append(h('div', { class: 'body', style: { whiteSpace: 'pre-line', lineHeight: '1.4', fontSize: '14px' } }, text));
  }

  private pick(ch: BattleChoice): void {
    if (this.playing || this.finished || this.leaving || !ch.enabled) return;
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
        if (e.text) this.float(e.actor, e.text, '#E2B657', 13, false);
        wait = STEP * 0.6;
        break;
      }
      case 'Damage':
        this.shown(e.target, e.hpAfter);
        if (unit) {
          this.shake(unit.shape, e.damage === 'Crit' ? 10 : 6);
          this.flashUnit(unit.shape, e.target < 0 ? 'red' : 'white');
          this.setBar(unit, e.hpAfter, e.shield, e.barrier);
        }
        this.float(e.target, `${e.damage === 'Crit' ? '치명타! ' : ''}${e.amount}`, DAMAGE_COLOR[e.damage], e.damage === 'Crit' ? 26 : 19, true);
        if (e.damage === 'Crit' && e.actor === -1) vibrate();
        if (e.target < 0 && e.actor >= 0) vibrate();
        break;
      case 'Miss':
        this.float(e.target, '빗나감', '#A29E95', 15, false);
        break;
      case 'Heal':
        this.shown(e.target, e.hpAfter);
        if (unit) this.setBar(unit, e.hpAfter);
        this.float(e.target, `+${e.amount}`, DAMAGE_COLOR.Heal, 19, true);
        break;
      case 'Status':
        this.float(e.target, e.text ?? '', '#9EC0E8', 13, false);
        wait = STEP * 0.6;
        break;
      case 'Defeat':
        this.shown(e.target, 0);
        if (unit) unit.shape.style.opacity = '.3';
        break;
      case 'Spawn':
        // 분열·소환: 그 자리에 새 적을 그린다 (다른 적은 지금 보이는 HP 그대로)
        this.shown(e.target, e.hpAfter);
        this.rebuildStage();
        this.float(e.target, '등장!', '#FF9A4A', 15, true);
        wait = STEP * 0.8;
        break;
      default: {
        // 방어막에 막힘: 남은 횟수를 바로 줄여 보여 준다
        const guarded = this.units.get(e.target);
        if (e.barrier >= 0 && guarded) this.setBar(guarded, guarded.hp, e.shield, e.barrier);
        this.float(e.actor, e.text ?? '', '#E2B657', 16, true);
      }
    }
    this.later(wait, () => this.playNext(events, i + 1));
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
      h('div', { class: 'gold', style: { fontSize: '20px' } }, b.isBoss ? '보스를 쓰러뜨렸다!' : '승리!'));
    if (loot) {
      if (loot.Gold !== 0) card.append(h('div', null, `· 골드 +${loot.Gold.toLocaleString('en-US')}`));
      if (loot.Exp !== 0) card.append(h('div', null, `· 경험치 +${loot.Exp.toLocaleString('en-US')}`));
      for (const i of loot.Items) card.append(h('div', null, `· ${i.Count > 1 ? `${i.Name}${i.Enhance > 0 ? ` +${i.Enhance}` : ''} ×${i.Count}` : i.Enhance > 0 ? `${i.Name} +${i.Enhance}` : i.Name}`));
      if (loot.Dropped.length > 0) card.append(h('div', { style: { color: 'var(--red-light)', fontSize: '13px' } }, `· 가방이 가득 차거나 99개라 두고 옴: ${itemNames(loot.Dropped)}`));
      if (loot.LevelsGained > 0) card.append(h('b', { class: 'gold' }, `레벨 업! Lv.${b.character.Level} · 능력치 포인트 +${loot.LevelsGained * B.PointsPerLevel}`));
    }
    const trial = S.trialWon;
    if (trial) card.append(sub(`시련 통과! ${S.run!.TrialFloor}층까지 클리어 · 돌파 층 ${b.character.HighestFloorCleared}`));
    else if (b.isBoss) card.append(sub(`돌파 층 ${b.character.HighestFloorCleared} · 다음 층이 열렸다`));
    card.append(sub(`${trial ? '잠시 후 마을로 귀환합니다' : '잠시 후 던전으로 돌아갑니다'} · 눌러서 바로 계속`));
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

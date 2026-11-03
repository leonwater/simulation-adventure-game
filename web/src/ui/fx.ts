/**
 * 전투 이펙트. 무대(stage) 위에 잠깐 떴다 사라지는 요소를 붙인다 (transform·opacity만 움직임).
 * 전투 화면과 확인 페이지(`npm run fx` → docs/fx-demo.html)가 같은 코드를 쓴다.
 */
import './fx.css';
import { STATUSES } from '../core/enums';
import type { Job, StatusType } from '../core/enums';

/** 타격 계열: 기본 공격은 직업별, 스킬은 스킬별(SKILL_STYLE), 몬스터는 할퀴기. */
export type FxStyle = 'slash' | 'arrow' | 'stab' | 'arcane' | 'fire' | 'ice' | 'bolt' | 'quake' | 'shout' | 'claw' | 'smash' | 'shadow' | 'poison';
/** 유닛 중심 좌표와 크기 (무대 px). */
export interface Spot { x: number; y: number; size: number }
export type TickKind = 'Poison' | 'Bleed' | 'Burn';

export const FX_COLOR: Record<FxStyle, string> = {
  slash: '#F1E8D6', arrow: '#E8D4A0', stab: '#C9D3E0', arcane: '#8FD3FF', fire: '#F0913A',
  ice: '#8FD3F4', bolt: '#FFE066', quake: '#C8A06A', shout: '#F6C063', claw: '#E0524A',
  smash: '#FFE7B0', shadow: '#A47CFF', poison: '#7BC86F',
};
export const STATUS_COLOR: Record<StatusType, string> = {
  Empower: '#F6C063', Fortify: '#8FB3D9', Regen: '#7BC86F', Focus: '#8FD3F4', Swift: '#A8E6A0', Keen: '#F6C063', Cruel: '#E0524A', Riposte: '#F6C063', Hawk: '#E8D4A0', Rapid: '#A8E6A0', Piercing: '#C9D3E0',
  Poison: '#7BC86F', Bleed: '#E0524A', Burn: '#F0913A', Weaken: '#B48CFF', Vulnerable: '#E06B4E', Stun: '#FFE066', Silence: '#9AA7B8', Blind: '#7A8494', Fear: '#B48CFF', Overload: '#B48CFF',
};
const HEAL = '#A8E6A0';

const BASIC: Record<Job, FxStyle> = { Warrior: 'slash', Archer: 'arrow', Rogue: 'stab', Mage: 'arcane' };
const SKILL_STYLE: Record<string, FxStyle> = {
  w_bash: 'smash', w_shield: 'smash', w_strike: 'smash', w_whirl: 'slash', w_earth: 'quake', w_roar: 'shout',
  a_flash: 'bolt', r_venom: 'poison', r_shadow: 'shadow', r_assassin: 'shadow', r_dance: 'shadow', r_storm: 'slash',
  m_fireball: 'fire', m_shard: 'fire', m_meteor: 'fire', m_apocalypse: 'fire', m_ice: 'ice', m_prison: 'ice', m_chain: 'bolt',
};

/** 기본 공격(skillId 없음)은 직업 계열, 스킬은 속성 계열 (따로 없으면 직업 계열). */
export const fxStyleFor = (job: Job, skillId: string | null): FxStyle => (skillId && SKILL_STYLE[skillId]) || BASIC[job];
export const isDebuff = (t: StatusType): boolean => STATUSES.indexOf(t) >= STATUSES.indexOf('Poison');

let speed = 1;
/** 전투 속도 (2배속이면 이펙트도 2배 빠르게). */
export const setFxSpeed = (s: number): void => { speed = s; };
const calm = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

/** (x, y)가 중심이 되게 붙인다 → transform은 중심 기준. */
function put(stage: HTMLElement, cls: string, x: number, y: number, w: number, hgt: number, color: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.style.cssText = `left:${x - w / 2}px;top:${y - hgt / 2}px;width:${w}px;height:${hgt}px;color:${color}`;
  stage.append(el);
  return el;
}
function play(el: HTMLElement, frames: Keyframe[], ms: number, delay = 0, easing = EASE): void {
  // 늦게 시작하는 조각은 시작 전까지 숨긴다 (첫 장면이 미리 보이지 않게)
  if (delay > 0) {
    el.style.visibility = 'hidden';
    window.setTimeout(() => { el.style.visibility = ''; }, delay / speed);
  }
  el.animate(frames, { duration: ms / speed, delay: delay / speed, easing, fill: 'forwards' }).onfinish = () => el.remove();
}

// ── 조각 ──

/** 사방으로 튀는 픽셀 입자. */
function burst(stage: HTMLElement, x: number, y: number, color: string, n: number, dist: number, px = 5): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), d = dist * rand(0.5, 1);
    play(put(stage, 'fx-px', x, y, px, px, color), [
      { transform: 'translate(0,0)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.4)`, opacity: 0 },
    ], rand(380, 540));
  }
}
/** 몸 폭 안에서 위(dy<0)나 아래(dy>0)로 흘러가는 입자 (거품·불꽃·핏방울·반짝임). */
function drift(stage: HTMLElement, s: Spot, color: string, n: number, dy: number, cls = 'fx-px', px = 4): void {
  for (let i = 0; i < n; i++) {
    const x = s.x + rand(-0.32, 0.32) * s.size, y = s.y + rand(-0.15, 0.25) * s.size, sway = rand(-8, 8);
    play(put(stage, cls, x, y, px, px, color), [
      { transform: 'translate(0,0) scale(.6)', opacity: 0 },
      { transform: `translate(${sway / 2}px,${dy * 0.3}px) scale(1)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${sway}px,${dy}px) scale(.5)`, opacity: 0 },
    ], rand(520, 720), i * 45, 'ease-out');
  }
}
function ring(stage: HTMLElement, x: number, y: number, d: number, color: string, ms = 440, from = 0.3, to = 1.2, delay = 0, flat = 1): void {
  play(put(stage, 'fx-ring', x, y, d, d * flat, color), [
    { transform: `scale(${from})`, opacity: 1 },
    { transform: `scale(${to})`, opacity: 0 },
  ], ms, delay);
}
/** 번쩍이는 칼날 선. */
function line(stage: HTMLElement, x: number, y: number, len: number, deg: number, color: string, ms = 300, delay = 0, thick = 6): void {
  play(put(stage, 'fx-line', x, y, len, thick, color), [
    { transform: `rotate(${deg}deg) scaleX(.1)`, opacity: 1 },
    { transform: `rotate(${deg}deg) scaleX(1)`, opacity: 1, offset: 0.35 },
    { transform: `rotate(${deg}deg) scaleX(1.05) scaleY(.4)`, opacity: 0 },
  ], ms, delay);
}
/** 위에서 내리꽂는 번개 (꺾인 선 3개). */
function lightning(stage: HTMLElement, s: Spot, color: string): void {
  const top = s.y - s.size * 0.9, seg = (s.y - top) / 3;
  [[-8, 20], [8, -24], [-6, 16]].forEach(([dx, deg], i) => line(stage, s.x + dx, top + seg * (i + 0.5), seg * 1.15, 90 + deg, color, 220, i * 25, 3));
}
/** 화면 흔들림 (무대의 scale을 건드리지 않게 translate 속성만 움직인다). */
export function fxShake(stage: HTMLElement, amp = 5): void {
  if (calm()) return;
  stage.animate([{ translate: '0 0' }, { translate: `${-amp}px ${amp / 2}px` }, { translate: `${amp}px ${-amp / 2}px` }, { translate: `${-amp / 2}px 0` }, { translate: '0 0' }], { duration: 260 / speed });
}

// ── 전투 사건별 이펙트 ──

// ── 스킬 연출 조각 (참고: 시전 마법진 → 빛나는 투사체·입자 꼬리 → 맞는 순간 번쩍임) ──

/** 무대 전체를 잠깐 물들이는 번쩍임. */
function flash(stage: HTMLElement, color: string, ms = 220, alpha = 0.45): void {
  const el = put(stage, 'fx-flash', 0, 0, 0, 0, color);
  el.style.inset = '0';
  el.style.width = el.style.height = '';
  play(el, [{ opacity: alpha }, { opacity: 0 }], ms, 0, 'ease-out');
}
/** 시전 마법진: 시전자 앞에 세로로 선 점선 고리 + 발밑 고리. big이면 더 크고 오래. */
function circle(stage: HTMLElement, s: Spot, color: string, big = false): void {
  const k = big ? 1.35 : 1, x = s.x + s.size * 0.55;
  play(put(stage, 'fx-circle', x, s.y, s.size * 0.38 * k, s.size * 1.05 * k, color), [
    { transform: 'scaleY(.1)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.3 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.7 }, { transform: 'scaleY(1.1) scaleX(.6)', opacity: 0 },
  ], big ? 620 : 460);
  play(put(stage, 'fx-circle', s.x, s.y + s.size * 0.5, s.size * 1.4 * k, s.size * 0.32 * k, color), [
    { transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 0.9, offset: 0.35 }, { transform: 'scale(1.15)', opacity: 0 },
  ], big ? 620 : 460);
  for (let i = 0; i < (big ? 8 : 5); i++) {
    const y = s.y + rand(-0.4, 0.4) * s.size * k;
    play(put(stage, 'fx-px', x + rand(-4, 4), y, 3, 3, '#FFFFFF'), [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${rand(10, 24)}px)`, opacity: 0 }], 360, i * 40);
  }
}
/** 투사체 꼬리: 지나간 자리에 남는 반짝이 입자. */
function trail(stage: HTMLElement, x0: number, y0: number, dx: number, dy: number, ms: number, color: string, n: number, px = 4): void {
  for (let i = 0; i < n; i++) {
    const t = i / n;
    play(put(stage, 'fx-px', x0 + dx * t + rand(-3, 3), y0 + dy * t + rand(-4, 4), px, px, i % 3 === 0 ? '#FFFFFF' : color), [
      { opacity: 0, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1)', offset: 0.1 }, { opacity: 0, transform: `translate(${rand(-8, 4)}px,${rand(-6, 6)}px) scale(.3)` },
    ], 380, ms * t);
  }
}
/** 빛나는 창 모양 투사체 (가운데 흰 심 + 색 빛 + 꼬리 입자 + 속도선). 비행 시간을 돌려준다. */
function shard(stage: HTMLElement, from: Spot, to: Spot, color: string, len = 34, thick = 9, ms = 200): number {
  const x0 = from.x + from.size * 0.5, y0 = from.y, dx = to.x - x0, dy = to.y - y0, deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  play(put(stage, 'fx-shard', x0, y0, len, thick, color), [
    { transform: `translate(0,0) rotate(${deg}deg) scaleX(.4)`, opacity: 0.6 },
    { transform: `translate(${dx * 0.15}px,${dy * 0.15}px) rotate(${deg}deg) scaleX(1)`, opacity: 1, offset: 0.15 },
    { transform: `translate(${dx}px,${dy}px) rotate(${deg}deg) scaleX(1.2)`, opacity: 1 },
  ], ms, 0, 'cubic-bezier(.5,0,.9,.5)');
  trail(stage, x0, y0, dx, dy, ms, color, 10);
  for (let i = 0; i < 2; i++) line(stage, x0 + dx * 0.4, y0 + dy * 0.4 + (i ? 7 : -7), len * 1.4, deg, color, ms, ms * 0.3, 2);
  return ms;
}
/** 불덩이: 큰 빛 구슬 + 불꽃 꼬리. */
function orb(stage: HTMLElement, from: Spot, to: Spot, color: string, d = 16, ms = 230): number {
  const x0 = from.x + from.size * 0.5, y0 = from.y, dx = to.x - x0, dy = to.y - y0;
  play(put(stage, 'fx-orb', x0, y0, d, d, color), [{ transform: 'translate(0,0) scale(.5)' }, { transform: `translate(${dx}px,${dy}px) scale(1.2)` }], ms, 0, 'cubic-bezier(.4,0,.9,.6)');
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    play(put(stage, 'fx-px fx-flame', x0 + dx * t, y0 + dy * t, 6, 6, i % 2 ? '#FFE066' : color), [
      { opacity: 0, transform: 'translateY(0) scale(1)' }, { opacity: 1, offset: 0.1 }, { opacity: 0, transform: `translateY(${rand(-14, -4)}px) scale(.4)` },
    ], 360, ms * t);
  }
  return ms;
}
/** 화살 (반짝이는 꼬리). */
function arrow(stage: HTMLElement, from: Spot, to: Spot, color: string, delay = 0, ms = 170): void {
  const x0 = from.x + from.size * 0.45, y0 = from.y, dx = to.x - x0 + rand(-6, 6), dy = to.y - y0 + rand(-6, 6), deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  play(put(stage, 'fx-arrow', x0, y0, 28, 3, color), [{ transform: `translate(0,0) rotate(${deg}deg)` }, { transform: `translate(${dx}px,${dy}px) rotate(${deg}deg)` }], ms, delay, 'cubic-bezier(.4,0,.9,.6)');
  line(stage, x0 + dx * 0.5, y0 + dy * 0.5, Math.hypot(dx, dy) * 0.6, deg, '#FFFFFF', ms, delay, 1);
}
/** 하늘에서 떨어지는 것 (운석·화살비): 위쪽 바깥에서 대상 쪽으로. */
function fall(stage: HTMLElement, cls: string, to: { x: number; y: number }, w: number, hgt: number, color: string, ms: number, delay = 0, from = { dx: -120, dy: -220 }): void {
  const deg = (Math.atan2(-from.dy, -from.dx) * 180) / Math.PI;
  play(put(stage, cls, to.x + from.dx, to.y + from.dy, w, hgt, color), [
    { transform: `translate(0,0) rotate(${deg}deg)`, opacity: 0.2 }, { transform: `translate(${-from.dx * 0.2}px,${-from.dy * 0.2}px) rotate(${deg}deg)`, opacity: 1, offset: 0.2 },
    { transform: `translate(${-from.dx}px,${-from.dy}px) rotate(${deg}deg)`, opacity: 1 },
  ], ms, delay, 'cubic-bezier(.4,0,.9,.6)');
}
const middle = (to: Spot[]): Spot => ({ x: to.reduce((a, t) => a + t.x, 0) / to.length, y: to.reduce((a, t) => a + t.y, 0) / to.length, size: to[0].size });
/** 버프: 몸에서 솟는 빛기둥 + 발밑 고리 + 올라가는 입자. */
function aura(stage: HTMLElement, s: Spot, color: string): void {
  play(put(stage, 'fx-pillar', s.x, s.y - s.size * 0.1, s.size * 0.9, s.size * 1.7, color), [
    { transform: 'scaleY(.2)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 0.85, offset: 0.35 }, { transform: 'scaleY(1.1) scaleX(.5)', opacity: 0 },
  ], 560);
  ring(stage, s.x, s.y + s.size * 0.5, s.size * 1.5, color, 520, 0.3, 1.1, 0, 0.3);
  drift(stage, s, color, 10, -s.size * 0.8, 'fx-px', 4);
}
/** 대상 둘레에 솟는 얼음 가시. */
function spikes(stage: HTMLElement, s: Spot, color: string): void {
  for (let i = 0; i < 6; i++) {
    const x = s.x + (i - 2.5) * s.size * 0.2, h2 = s.size * rand(0.5, 0.9);
    play(put(stage, 'fx-spike', x, s.y + s.size * 0.45 - h2 / 2, s.size * 0.18, h2, color), [
      { transform: 'scaleY(0)', opacity: 1, transformOrigin: 'bottom' }, { transform: 'scaleY(1)', opacity: 1, offset: 0.4, transformOrigin: 'bottom' }, { transform: 'scaleY(1)', opacity: 0, transformOrigin: 'bottom' },
    ], 640, i * 30);
  }
}
/** 그림자 잔상: 시전자에서 대상까지 어두운 몸 셋이 스치고 지나간다. */
function afterimage(stage: HTMLElement, from: Spot, to: Spot): number {
  for (let i = 0; i < 3; i++) {
    play(put(stage, 'fx-shadow', from.x, from.y, from.size * 0.5, from.size * 0.9, FX_COLOR.shadow), [
      { transform: 'translateX(0)', opacity: 0.7 }, { transform: `translate(${to.x - from.x - 20}px,${to.y - from.y}px)`, opacity: 0 },
    ], 220, i * 50);
  }
  return 200;
}
/** 지그재그 번개 한 줄기 (a → b). */
function zap(stage: HTMLElement, a: { x: number; y: number }, b: { x: number; y: number }, color: string, delay: number): void {
  const n = 4;
  let px = a.x, py = a.y;
  for (let i = 1; i <= n; i++) {
    const t = i / n, nx = a.x + (b.x - a.x) * t + (i < n ? rand(-12, 12) : 0), ny = a.y + (b.y - a.y) * t + (i < n ? rand(-12, 12) : 0);
    const len = Math.hypot(nx - px, ny - py), deg = (Math.atan2(ny - py, nx - px) * 180) / Math.PI;
    line(stage, (px + nx) / 2, (py + ny) / 2, len * 1.1, deg, color, 260, delay, 3);
    px = nx; py = ny;
  }
}

type SkillFx = (stage: HTMLElement, me: Spot, to: Spot[]) => number;
const ALL_DIR = { dx: 0, dy: -260 };
/**
 * 스킬마다 다른 연출. 돌려주는 값 = 맞는 순간까지의 시간(ms, 전투 속도 반영 전).
 * to = 실제로 맞는 적들 (자기 강화는 빈 배열).
 */
const SKILL_FX: Record<string, SkillFx> = {
  // 전사
  w_bash: (st, me) => { ring(st, me.x, me.y, me.size * 1.1, FX_COLOR.smash, 260, 1.2, 0.5); return 120; },
  w_shield: (st, me) => { ring(st, me.x, me.y, me.size * 1.1, FX_COLOR.smash, 260, 1.2, 0.5); return 120; },
  w_warcry: (st, me) => { aura(st, me, STATUS_COLOR.Empower); for (let i = 0; i < 3; i++) ring(st, me.x, me.y, me.size * 2.2, FX_COLOR.shout, 520, 0.3, 1.3, i * 110); return 0; },
  w_riposte: (st, me) => { aura(st, me, STATUS_COLOR.Riposte); line(st, me.x + me.size * 0.3, me.y, me.size, -50, '#FFFFFF', 260, 200); return 0; },
  w_guard: (st, me) => { aura(st, me, STATUS_COLOR.Fortify); ring(st, me.x, me.y, me.size * 1.5, STATUS_COLOR.Fortify, 600, 0.9, 1.05); return 0; },
  w_will: (st, me) => { aura(st, me, STATUS_COLOR.Regen); drift(st, me, HEAL, 8, -me.size * 0.7, 'fx-px fx-plus', 10); return 0; },
  w_whirl: (st, me) => {
    for (let i = 0; i < 4; i++) line(st, me.x, me.y, me.size * 1.6, i * 45, FX_COLOR.slash, 320, i * 40, 4);
    ring(st, me.x, me.y, me.size * 1.9, FX_COLOR.slash, 360, 0.4, 1.2);
    return 200;
  },
  w_roar: (st, me) => { flash(st, '#E0524A', 260, 0.18); for (let i = 0; i < 4; i++) ring(st, me.x, me.y, me.size * 3, FX_COLOR.shout, 600, 0.2, 1.4, i * 100); fxShake(st, 4); return 260; },
  w_earth: (st, me, to) => {
    const g = me.y + me.size * 0.45, end = Math.max(...to.map((t) => t.x)) + 30;
    play(put(st, 'fx-crack', (me.x + end) / 2, g, end - me.x, 5, FX_COLOR.quake), [{ transform: 'scaleX(0)', opacity: 1, transformOrigin: 'left' }, { transform: 'scaleX(1)', opacity: 1, offset: 0.5, transformOrigin: 'left' }, { transform: 'scaleX(1)', opacity: 0, transformOrigin: 'left' }], 520);
    for (const t of to) drift(st, { x: t.x, y: t.y + t.size * 0.4, size: t.size }, FX_COLOR.quake, 8, -t.size * 0.7, 'fx-px', 6);
    fxShake(st, 8);
    return 260;
  },
  w_strike: (st, me, to) => { circle(st, me, FX_COLOR.smash, true); if (to[0]) { flash(st, '#FFFFFF', 200, 0.4); line(st, to[0].x, to[0].y, to[0].size * 1.8, -40, '#FFFFFF', 320, 160, 8); line(st, to[0].x, to[0].y, to[0].size * 1.8, 40, '#FFFFFF', 320, 220, 8); } fxShake(st, 9); return 260; },
  // 궁수
  a_aim: (st, me) => { aura(st, me, STATUS_COLOR.Hawk); ring(st, me.x + me.size * 0.6, me.y - me.size * 0.2, me.size * 0.6, STATUS_COLOR.Hawk, 500, 1.4, 0.8); return 0; },
  a_double: (st, me) => { aura(st, me, STATUS_COLOR.Rapid); for (let i = 0; i < 3; i++) line(st, me.x, me.y + (i - 1) * 12, me.size * 1.4, 0, STATUS_COLOR.Rapid, 300, i * 60, 2); return 0; },
  a_wind: (st, me) => { aura(st, me, STATUS_COLOR.Piercing); line(st, me.x + me.size, me.y, me.size * 1.8, 0, '#FFFFFF', 340, 120, 3); return 0; },
  a_storm: (st, me) => { aura(st, me, STATUS_COLOR.Hawk); aura(st, me, STATUS_COLOR.Rapid); for (let i = 0; i < 3; i++) ring(st, me.x, me.y, me.size * 2, STATUS_COLOR.Rapid, 520, 0.3, 1.2, i * 120, 0.5); return 0; },
  a_scatter: (st, me, to) => { to.forEach((t, i) => { arrow(st, me, t, FX_COLOR.arrow, i * 30); arrow(st, me, t, FX_COLOR.arrow, i * 30 + 20); }); return 200; },
  a_flash: (st, me, to) => { if (!to[0]) return 0; const ms = shard(st, me, to[0], '#FFF3B0', 30, 6, 160); flash(st, '#FFFFFF', 200, 0.35); return ms; },
  a_weak: (st, me, to) => { if (!to[0]) return 0; play(put(st, 'fx-circle', to[0].x, to[0].y, to[0].size * 0.9, to[0].size * 0.9, '#E0524A'), [{ transform: 'scale(1.6) rotate(0)', opacity: 0 }, { transform: 'scale(1) rotate(90deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(.9) rotate(120deg)', opacity: 0 }], 420); arrow(st, me, to[0], FX_COLOR.arrow, 180); return 330; },
  a_rain: (st, _me, to) => { for (const t of to) for (let i = 0; i < 7; i++) fall(st, 'fx-arrow', { x: t.x + rand(-t.size * 0.4, t.size * 0.4), y: t.y + rand(-10, 20) }, 22, 3, FX_COLOR.arrow, 220, i * 35, { dx: -40, dy: -200 }); return 260; },
  a_pierce: (st, me, to) => { const end = Math.max(...to.map((t) => t.x)) + 60; play(put(st, 'fx-beam', (me.x + end) / 2, me.y, end - me.x, 6, '#FFFFFF'), [{ transform: 'scaleX(0)', opacity: 1, transformOrigin: 'left' }, { transform: 'scaleX(1)', opacity: 1, offset: 0.4, transformOrigin: 'left' }, { transform: 'scaleX(1) scaleY(.2)', opacity: 0, transformOrigin: 'left' }], 380); return 150; },
  a_volley: (st, me, to) => { for (let w = 0; w < 3; w++) to.forEach((t, i) => arrow(st, me, t, FX_COLOR.arrow, w * 70 + i * 15)); return 240; },
  // 도적
  r_ambush: (st, me, to) => (to[0] ? afterimage(st, me, to[0]) : 0),
  r_shadow: (st, me, to) => (to[0] ? afterimage(st, me, to[0]) : 0),
  r_venom: (st, me) => { drift(st, me, FX_COLOR.poison, 5, -me.size * 0.4, 'fx-px fx-bubble', 6); return 120; },
  r_keen: (st, me) => { aura(st, me, STATUS_COLOR.Keen); return 0; },
  r_cruel: (st, me) => { aura(st, me, STATUS_COLOR.Cruel); flash(st, '#E0524A', 220, 0.15); return 0; },
  r_shuriken: (st, me, to) => { to.forEach((t, i) => { const x0 = me.x + me.size * 0.4; play(put(st, 'fx-star', x0, me.y, 12, 12, '#DCE3EE'), [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${t.x - x0}px,${t.y - me.y}px) rotate(900deg)` }], 220, i * 40, 'linear'); }); return 220; },
  r_vital: (st, me, to) => { if (to[0]) line(st, (me.x + to[0].x) / 2, me.y, to[0].x - me.x, 0, '#FFFFFF', 160, 0, 2); return 120; },
  r_storm: (st, _me, to) => { for (const t of to) for (let i = 0; i < 4; i++) line(st, t.x + rand(-8, 8), t.y + rand(-8, 8), t.size * 1.1, rand(-70, 70), FX_COLOR.slash, 220, i * 60, 3); return 160; },
  r_assassin: (st, me, to) => { flash(st, '#140A24', 360, 0.55); const ms = to[0] ? afterimage(st, me, to[0]) : 0; if (to[0]) { line(st, to[0].x, to[0].y, to[0].size * 1.9, -45, '#E0C8FF', 300, ms, 6); line(st, to[0].x, to[0].y, to[0].size * 1.9, 45, '#E0C8FF', 300, ms + 60, 6); } fxShake(st, 8); return ms + 80; },
  r_dance: (st, me, to) => { flash(st, '#140A24', 300, 0.4); to.forEach((t, i) => afterimage(st, i === 0 ? me : to[i - 1], t)); return 220; },
  // 마법사
  m_fireball: (st, me, to) => { circle(st, me, FX_COLOR.fire); return to[0] ? 80 + orb(st, me, to[0], FX_COLOR.fire, 18) : 0; },
  m_bolt: (st, me, to) => { circle(st, me, FX_COLOR.arcane); return to[0] ? shard(st, me, to[0], FX_COLOR.arcane) : 0; },
  m_shard: (st, me, to) => { circle(st, me, FX_COLOR.fire); to.forEach((t) => shard(st, me, t, FX_COLOR.fire, 22, 6, 200)); return 200; },
  m_ice: (st, me, to) => { circle(st, me, FX_COLOR.ice, true); const far = to.reduce((a, t) => (t.x > a.x ? t : a), to[0] ?? me); return to.length ? shard(st, me, far, FX_COLOR.ice, 56, 14, 260) : 0; },
  m_chain: (st, me, to) => { circle(st, me, FX_COLOR.bolt); let prev = { x: me.x + me.size * 0.5, y: me.y }; to.forEach((t, i) => { zap(st, prev, t, FX_COLOR.bolt, i * 90); prev = t; }); flash(st, '#FFF6B0', 160, 0.25); return 140; },
  m_silence: (st, me, to) => { circle(st, me, '#9AA7B8'); if (to[0]) play(put(st, 'fx-circle', to[0].x, to[0].y, to[0].size * 1.1, to[0].size * 1.1, '#C9B8FF'), [{ transform: 'scale(.3) rotate(0)', opacity: 0 }, { transform: 'scale(1) rotate(180deg)', opacity: 1, offset: 0.5 }, { transform: 'scale(1.1) rotate(270deg)', opacity: 0 }], 520, 150); return 260; },
  m_prison: (st, me, to) => { circle(st, me, FX_COLOR.ice, true); if (to[0]) spikes(st, to[0], FX_COLOR.ice); return 240; },
  m_overload: (st, me, to) => {
    circle(st, me, '#C9B8FF', true);
    if (!to[0]) return 0;
    const x0 = me.x + me.size * 0.5, len = to[0].x - x0 + 30;
    play(put(st, 'fx-beam', x0 + len / 2, me.y, len, 18, '#C9B8FF'), [{ transform: 'scaleX(0)', opacity: 1, transformOrigin: 'left' }, { transform: 'scaleX(1)', opacity: 1, offset: 0.3, transformOrigin: 'left' }, { transform: 'scaleX(1) scaleY(1.3)', opacity: 1, offset: 0.6, transformOrigin: 'left' }, { transform: 'scaleX(1) scaleY(.1)', opacity: 0, transformOrigin: 'left' }], 520, 200);
    flash(st, '#FFFFFF', 240, 0.35);
    fxShake(st, 7);
    return 320;
  },
  m_meteor: (st, me, to) => {
    circle(st, me, FX_COLOR.fire, true);
    if (!to.length) return 0;
    const c = middle(to), fallMs = 460, d = 60, dx = -140, dy = -200;
    fall(st, 'fx-meteor', c, d, d, FX_COLOR.fire, fallMs, 160, { dx, dy });
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      play(put(st, 'fx-px fx-flame', c.x + dx * (1 - t) + rand(-8, 8), c.y + dy * (1 - t) + rand(-8, 8), 10, 10, i % 2 ? '#FFE066' : FX_COLOR.fire), [{ opacity: 1 }, { opacity: 0, transform: `translate(${rand(-10, 10)}px,${rand(-16, -4)}px) scale(.3)` }], 420, 160 + fallMs * t);
    }
    // 떨어진 순간: 번쩍 + 큰 충격파 + 흔들림
    window.setTimeout(() => { flash(st, '#FFB060', 300, 0.55); fxShake(st, 10); }, (160 + fallMs) / speed);
    ring(st, c.x, c.y + 20, 220, FX_COLOR.fire, 520, 0.2, 1.3, 160 + fallMs, 0.45);
    ring(st, c.x, c.y + 20, 160, '#FFE066', 420, 0.2, 1.2, 200 + fallMs, 0.45);
    return 160 + fallMs;
  },
  m_apocalypse: (st, me, to) => {
    circle(st, me, '#E0524A', true);
    flash(st, '#7A1410', 420, 0.35);
    to.forEach((t, i) => play(put(st, 'fx-pillar', t.x, t.y - t.size * 0.3, t.size * 0.6, t.size * 2.2, FX_COLOR.fire), [{ transform: 'scaleY(0)', opacity: 1, transformOrigin: 'bottom' }, { transform: 'scaleY(1)', opacity: 1, offset: 0.35, transformOrigin: 'bottom' }, { transform: 'scaleY(1) scaleX(.4)', opacity: 0, transformOrigin: 'bottom' }], 620, 200 + i * 60));
    for (const t of to) for (let i = 0; i < 3; i++) fall(st, 'fx-meteor', { x: t.x + rand(-14, 14), y: t.y }, 20, 20, FX_COLOR.fire, 300, 120 + i * 90, ALL_DIR);
    window.setTimeout(() => fxShake(st, 10), 340 / speed);
    return 340;
  },
};

/** 기본 공격 연출 (직업별). 마법사 에너지 볼은 참고 그림처럼 마법진 + 빛나는 창. */
function basicFx(stage: HTMLElement, job: Job, me: Spot, to: Spot[]): number {
  if (!to[0]) return 0;
  if (job === 'Mage') {
    circle(stage, me, FX_COLOR.arcane);
    return 60 + shard(stage, me, to[0], FX_COLOR.arcane, 30, 8, 180);
  }
  if (job === 'Archer') {
    arrow(stage, me, to[0], FX_COLOR.arrow);
    return 170;
  }
  return 0;
}

/**
 * 플레이어 행동 연출 (전투 'Act' 사건). skillId가 없으면 기본 공격.
 * to = 이번 행동에 맞는 적들. 맞는 순간까지의 시간(ms, 전투 속도 반영 전)을 돌려준다.
 */
export function fxSkill(stage: HTMLElement, me: Spot, to: Spot[], job: Job, skillId: string | null): number {
  if (calm()) return 0;
  if (!skillId) return basicFx(stage, job, me, to);
  const fx = SKILL_FX[skillId];
  if (fx) return fx(stage, me, to);
  circle(stage, me, FX_COLOR[fxStyleFor(job, skillId)]);
  return 120;
}
/** 몬스터 스킬: 붉은 마법진만. */
export function fxEnemyCast(stage: HTMLElement, s: Spot): void {
  if (calm()) return;
  play(put(stage, 'fx-circle', s.x - s.size * 0.55, s.y, s.size * 0.38, s.size * 1.05, '#E0524A'), [
    { transform: 'scaleY(.1)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.35 }, { transform: 'scaleY(1)', opacity: 0 },
  ], 420);
}

/** 타격: 계열별 모양 + 입자. 치명타는 더 크게 + 흰 고리 + 화면 흔들림. */
export function fxHit(stage: HTMLElement, s: Spot, style: FxStyle, crit: boolean): void {
  if (calm()) return;
  const c = FX_COLOR[style], k = crit ? 1.5 : 1, { x, y, size } = s;
  switch (style) {
    case 'slash':
      line(stage, x, y, size * 1.1 * k, -35, c);
      if (crit) line(stage, x, y, size * 1.1 * k, 35, c, 260, 60);
      break;
    case 'claw':
      for (let i = -1; i <= 1; i++) line(stage, x + i * 9, y, size * 0.7 * k, 62, c, 240, (i + 1) * 30, 3);
      break;
    case 'stab':
      for (let i = 0; i < (crit ? 3 : 1); i++) line(stage, x + rand(-6, 6), y + (i - 1) * 8 * (crit ? 1 : 0), size * 0.8, rand(-8, 8), c, 200, i * 50, 3);
      break;
    case 'bolt':
      lightning(stage, s, c);
      ring(stage, x, y, size * 0.9 * k, c);
      break;
    case 'quake':
      line(stage, x, y + size * 0.45, size * 1.4 * k, 0, c, 420, 0, 3);
      ring(stage, x, y + size * 0.45, size * 1.6 * k, c, 420, 0.3, 1.2, 0, 0.3);
      drift(stage, { x, y: y + size * 0.4, size }, c, 8, -size * 0.5);
      break;
    case 'fire':
      ring(stage, x, y, size * 1.0 * k, c);
      drift(stage, s, c, 6, -size * 0.6, 'fx-px fx-flame', 5);
      break;
    case 'ice':
      ring(stage, x, y, size * 0.9 * k, c);
      burst(stage, x, y, '#E8F7FF', 8, size * 0.55, 6);
      break;
    case 'arcane':
      // 참고 그림: 맞은 자리에서 분홍 불티가 튄다
      ring(stage, x, y, size * 0.9 * k, c);
      burst(stage, x, y, '#FF8FC8', 8, size * 0.6, 4);
      break;
    case 'smash':
      ring(stage, x, y, size * 1.3 * k, c, 320, 0.2, 1.2);
      line(stage, x, y, size * 0.9 * k, 0, '#FFFFFF', 200, 0, 5);
      line(stage, x, y, size * 0.9 * k, 90, '#FFFFFF', 200, 0, 5);
      fxShake(stage, crit ? 8 : 4);
      break;
    case 'shadow':
      line(stage, x, y, size * 1.2 * k, -45, c, 260, 0, 5);
      line(stage, x, y, size * 1.2 * k, 45, c, 260, 70, 5);
      break;
    case 'poison':
      ring(stage, x, y, size * 0.8 * k, c);
      drift(stage, s, c, 6, -size * 0.5, 'fx-px fx-bubble', 7);
      break;
    default:
      ring(stage, x, y, size * 0.8 * k, c);
  }
  // 맞는 순간 흰 빛이 터진다 (모든 타격 공통)
  play(put(stage, 'fx-orb', x, y, size * 0.5 * k, size * 0.5 * k, c), [{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], 200, 0, 'ease-out');
  burst(stage, x, y, c, crit ? 16 : 10, size * 0.75 * k, crit ? 6 : 5);
  if (crit) {
    ring(stage, x, y, size * 1.6, '#FFFFFF', 380, 0.4, 1.1, 40);
    fxShake(stage);
  }
}

/** 빗나감·회피: 대상이 옆으로 비켜섰다 돌아온다 (잔상처럼 반투명). */
export function fxDodge(el: HTMLElement, enemy: boolean): void {
  if (calm()) return;
  const dx = enemy ? 20 : -20;
  el.animate([{ translate: '0 0', opacity: 1 }, { translate: `${dx}px 0`, opacity: 0.45, offset: 0.35 }, { translate: '0 0', opacity: 1 }], { duration: 320 / speed, easing: EASE });
}

/** 반격 태세 발동: 금빛 막 + 칼날 번쩍임. */
export function fxCounter(stage: HTMLElement, s: Spot): void {
  if (calm()) return;
  const c = STATUS_COLOR.Riposte;
  ring(stage, s.x, s.y, s.size * 1.3, c, 300, 0.7, 1.15);
  line(stage, s.x + s.size * 0.3, s.y, s.size * 0.9, -50, '#FFFFFF', 220, 80);
  burst(stage, s.x + s.size * 0.3, s.y, c, 6, s.size * 0.35);
}

/** 상태 이상이 걸림: 상태 아이콘이 튀어 오르고 상태 색 고리 + 상태별 입자. */
export function fxStatus(stage: HTMLElement, s: Spot, type: StatusType, iconSrc: string): void {
  const c = STATUS_COLOR[type];
  const img = document.createElement('img');
  img.className = 'fx fx-icon';
  img.src = iconSrc;
  img.alt = '';
  img.style.cssText = `left:${s.x - 12}px;top:${s.y - s.size * 0.55 - 12}px`;
  stage.append(img);
  play(img, calm()
    ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]
    : [{ transform: 'translateY(8px) scale(.6)', opacity: 0 }, { transform: 'translateY(-6px) scale(1.15)', opacity: 1, offset: 0.25 }, { transform: 'translateY(-10px) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translateY(-16px) scale(1)', opacity: 0 }], 820);
  if (calm()) return;
  ring(stage, s.x, s.y, s.size * 1.1, c, 420, 0.5, 1.15);
  statusParticles(stage, s, type);
}

/** 턴마다 들어가는 독·출혈·화상 피해. */
export function fxTick(stage: HTMLElement, s: Spot, kind: TickKind): void {
  if (!calm()) statusParticles(stage, s, kind);
}

function statusParticles(stage: HTMLElement, s: Spot, type: StatusType): void {
  const c = STATUS_COLOR[type];
  switch (type) {
    case 'Poison': return drift(stage, s, c, 7, -s.size * 0.55, 'fx-px fx-bubble', 6);
    case 'Burn': return drift(stage, s, c, 8, -s.size * 0.65, 'fx-px fx-flame', 5);
    case 'Bleed': return drift(stage, { ...s, y: s.y - s.size * 0.2 }, c, 6, s.size * 0.5, 'fx-px fx-drop', 6);
    case 'Stun': return stars(stage, s, c);
    default: return drift(stage, s, c, 8, isDebuff(type) ? s.size * 0.45 : -s.size * 0.6, 'fx-px', 5);
  }
}
/** 기절: 머리 위를 도는 별 3개. */
function stars(stage: HTMLElement, s: Spot, color: string): void {
  const cy = s.y - s.size * 0.5, r = s.size * 0.32;
  for (let i = 0; i < 3; i++) {
    const a0 = (i / 3) * Math.PI * 2;
    const at = (t: number): string => `translate(${Math.cos(a0 + t) * r}px,${Math.sin(a0 + t) * r * 0.35}px) rotate(45deg)`;
    play(put(stage, 'fx-px', s.x, cy, 6, 6, color), [
      { transform: at(0), opacity: 0 }, { transform: at(1.6), opacity: 1, offset: 0.2 }, { transform: at(4.8), opacity: 1, offset: 0.8 }, { transform: at(6.4), opacity: 0 },
    ], 900, 0, 'linear');
  }
}

/** 회복: 초록 고리 + 올라가는 십자 입자. */
export function fxHeal(stage: HTMLElement, s: Spot): void {
  if (calm()) return;
  ring(stage, s.x, s.y + s.size * 0.35, s.size * 1.3, HEAL, 480, 0.4, 1.1, 0, 0.35);
  drift(stage, s, HEAL, 7, -s.size * 0.7, 'fx-px fx-plus', 10);
}

/** 쓰러짐: 살짝 가라앉으며 흐려진다 (끝 상태 유지). */
export function fxDefeat(el: HTMLElement): void {
  el.style.opacity = '.3';
  if (calm()) return;
  el.animate([{ translate: '0 0', opacity: 1 }, { translate: '0 6px', opacity: 0.3 }], { duration: 420 / speed, easing: EASE });
}

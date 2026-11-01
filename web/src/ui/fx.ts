/**
 * 전투 이펙트. 무대(stage) 위에 잠깐 떴다 사라지는 요소를 붙인다 (transform·opacity만 움직임).
 * 전투 화면과 확인 페이지(`npm run fx` → docs/fx-demo.html)가 같은 코드를 쓴다.
 */
import './fx.css';
import { STATUSES } from '../core/enums';
import type { Job, StatusType } from '../core/enums';

/** 공격 계열: 기본 공격은 직업별, 스킬은 속성별, 몬스터는 할퀴기. */
export type FxStyle = 'slash' | 'arrow' | 'stab' | 'arcane' | 'fire' | 'ice' | 'bolt' | 'quake' | 'shout' | 'claw';
/** 유닛 중심 좌표와 크기 (무대 px). */
export interface Spot { x: number; y: number; size: number }
export type TickKind = 'Poison' | 'Bleed' | 'Burn';

export const FX_COLOR: Record<FxStyle, string> = {
  slash: '#F1E8D6', arrow: '#E8D4A0', stab: '#C9D3E0', arcane: '#B48CFF', fire: '#F0913A',
  ice: '#8FD3F4', bolt: '#FFE066', quake: '#C8A06A', shout: '#F6C063', claw: '#E0524A',
};
export const STATUS_COLOR: Record<StatusType, string> = {
  Empower: '#F6C063', Fortify: '#8FB3D9', Regen: '#7BC86F', Focus: '#8FD3F4', Swift: '#A8E6A0', Keen: '#F6C063', Cruel: '#E0524A', Riposte: '#F6C063', Hawk: '#E8D4A0', Rapid: '#A8E6A0', Piercing: '#C9D3E0',
  Poison: '#7BC86F', Bleed: '#E0524A', Burn: '#F0913A', Weaken: '#B48CFF', Vulnerable: '#E06B4E', Stun: '#FFE066', Silence: '#9AA7B8', Blind: '#7A8494', Fear: '#B48CFF', Overload: '#B48CFF',
};
const HEAL = '#A8E6A0';

const BASIC: Record<Job, FxStyle> = { Warrior: 'slash', Archer: 'arrow', Rogue: 'stab', Mage: 'arcane' };
const SKILL_STYLE: Record<string, FxStyle> = {
  m_fireball: 'fire', m_shard: 'fire', m_meteor: 'fire', m_apocalypse: 'fire', m_ice: 'ice', m_prison: 'ice', m_chain: 'bolt', w_earth: 'quake', w_roar: 'shout',
};
const SHOTS: readonly FxStyle[] = ['arrow', 'arcane', 'fire', 'ice'];

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
  el.animate(frames, { duration: ms / speed, delay: delay / speed, easing, fill: 'both' }).onfinish = () => el.remove();
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

/** 스킬 시전: 시전자에게 빛이 모인다. 함성은 바깥으로 퍼지는 고리. */
export function fxCast(stage: HTMLElement, s: Spot, style: FxStyle): void {
  if (calm()) return;
  const c = FX_COLOR[style];
  if (style === 'shout') {
    for (let i = 0; i < 3; i++) ring(stage, s.x, s.y, s.size * 2.2, c, 520, 0.3, 1.3, i * 110);
    return;
  }
  play(put(stage, 'fx-ring fx-glow', s.x, s.y, s.size * 1.3, s.size * 1.3, c), [
    { transform: 'scale(1.3)', opacity: 0 },
    { transform: 'scale(.8)', opacity: 0.9, offset: 0.6 },
    { transform: 'scale(.5)', opacity: 0 },
  ], 300);
}

/** 투사체가 필요한 계열이면 날리고 비행 시간(ms, 전투 속도 반영 전)을 돌려준다. 근접 계열은 0. */
export function fxShot(stage: HTMLElement, from: Spot, to: Spot, style: FxStyle): number {
  if (!SHOTS.includes(style) || calm()) return 0;
  const c = FX_COLOR[style], dx = to.x - from.x, dy = to.y - from.y, deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const el = style === 'arrow' ? put(stage, 'fx-arrow', from.x, from.y, 26, 3, c) : put(stage, 'fx-orb', from.x, from.y, style === 'fire' ? 14 : 10, style === 'fire' ? 14 : 10, c);
  const ms = 170;
  play(el, [
    { transform: `translate(0,0) rotate(${deg}deg)`, opacity: 1 },
    { transform: `translate(${dx}px,${dy}px) rotate(${deg}deg)`, opacity: 1 },
  ], ms, 0, 'cubic-bezier(.4,0,.9,.6)');
  return ms;
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
      burst(stage, x, y, '#E8F7FF', 6, size * 0.45, 5);
      break;
    default:
      ring(stage, x, y, size * 0.8 * k, c);
  }
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

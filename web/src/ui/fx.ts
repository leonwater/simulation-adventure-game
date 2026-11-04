/**
 * 전투 이펙트 (v3.11): 모든 모양은 claude-pxl로 그린 픽셀 그림(art/fx.px.js → assets/fx/atlas.png)이다.
 * 코드는 프레임을 단계 재생하고 위치·회전·투명도만 움직인다 (transform·opacity·background-position).
 * 전투 화면과 확인 페이지(`npm run fx` → docs/fx-demo.html)가 같은 코드를 쓴다.
 * 기기의 '동작 줄이기'는 설정 '이펙트 항상 보기'를 끈 경우에만 따른다.
 */
import './fx.css';
import { STATUSES } from '../core/enums';
import type { Job, StatusType } from '../core/enums';
import atlasUrl from '../assets/fx/atlas.png';
import ATLAS from '../assets/fx/atlas.json';
import { skillDef } from '../core/skills';
import { spriteUrl } from './sprites';

/** 타격 계열: 기본 공격은 직업별, 스킬은 스킬별(SKILL_STYLE), 몬스터는 할퀴기. */
export type FxStyle = 'slash' | 'arrow' | 'stab' | 'arcane' | 'fire' | 'ice' | 'bolt' | 'quake' | 'shout' | 'claw' | 'smash' | 'shadow' | 'poison';
/** 유닛 중심 좌표와 크기 (무대 px). y는 보이는 몸통 가운데. */
export interface Spot { x: number; y: number; size: number }
export type TickKind = 'Poison' | 'Bleed' | 'Burn';

const BASIC: Record<Job, FxStyle> = { Warrior: 'slash', Archer: 'arrow', Rogue: 'stab', Mage: 'arcane' };
const SKILL_STYLE: Record<string, FxStyle> = {
  w_bash: 'smash', w_shield: 'smash', w_strike: 'smash', w_whirl: 'slash', w_earth: 'quake', w_roar: 'shout',
  a_flash: 'bolt', r_venom: 'poison', r_shadow: 'shadow', r_assassin: 'shadow', r_dance: 'shadow', r_storm: 'slash',
  m_fireball: 'fire', m_shard: 'fire', m_meteor: 'fire', m_apocalypse: 'fire', m_ice: 'ice', m_prison: 'ice', m_chain: 'bolt',
};
export const fxStyleFor = (job: Job, skillId: string | null): FxStyle => (skillId && SKILL_STYLE[skillId]) || BASIC[job];
export const isDebuff = (t: StatusType): boolean => STATUSES.indexOf(t) >= STATUSES.indexOf('Poison');

// 상태 이상 → 그림 색 묶음 (art/fx.px.js 의 PAL 이름)
const STATUS_PAL: Record<StatusType, string> = {
  Empower: 'gold', Fortify: 'ice', Regen: 'green', Focus: 'ice', Swift: 'green', Keen: 'gold', Cruel: 'red', Riposte: 'gold', Hawk: 'gold', Rapid: 'green', Piercing: 'white',
  Poison: 'poison', Bleed: 'blood', Burn: 'fire', Weaken: 'shadow', Vulnerable: 'red', Stun: 'bolt', Silence: 'seal', Blind: 'seal', Fear: 'shadow', Overload: 'arc',
};

let speed = 1;
/** 전투 속도 (2배속이면 이펙트도 2배 빠르게). */
export const setFxSpeed = (s: number): void => { speed = s; };
let always = true;
/** 설정 '이펙트 항상 보기' (기본 켜기). 끄면 기기의 '동작 줄이기'를 따른다. */
export const setFxAlways = (v: boolean): void => { always = v; };
const calm = (): boolean => !always && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const later = (ms: number, fn: () => void): void => { window.setTimeout(fn, ms / speed); };
/** 발끝 높이 (Spot.y는 몸통 가운데). */
const feet = (s: Spot): number => s.y + s.size * 0.62;

// ── 그림 한 장 재생 ──
type Frame = [number, number, number, number, number, number];
const A = ATLAS as unknown as Record<string, Frame>;
const [AW, AH] = A._size;
/** 그림 1픽셀 = 화면 3px (전투 유닛과 같은 배율). */
const PX = 3;

interface SpOpt {
  /** 배율 (기본 3). */ scale?: number;
  /** 시작까지 기다림 ms. */ delay?: number;
  /** 화면에 남는 시간 ms (기본: 프레임을 한 번 다 도는 시간). */ life?: number;
  /** 프레임을 계속 돈다 (투사체·빛줄기). */ loop?: boolean;
  /** 돌림(도) · 좌우 뒤집기 · 위아래로 납작하게(바닥 고리). */ rot?: number; flip?: boolean; squash?: number;
  /** 기준점: 가운데(c) 또는 아래 가운데(b, 땅에서 솟는 것). */ anchor?: 'c' | 'b';
}
/**
 * 그림을 (x, y)에 놓고 프레임을 재생한다. 남는 시간이 지나면 지운다.
 * 바깥 틀(돌려주는 것)은 자리·움직임, 안쪽은 그림·돌림·뒤집기·배율을 맡는다.
 * 그림 묶음은 늘 3배로만 깔고 더 크게는 transform으로 키운다 (휴대폰 GPU의 4096px 한도를 넘지 않게).
 */
function sp(stage: HTMLElement, name: string, x: number, y: number, o: SpOpt = {}): HTMLElement {
  const [ax, ay, w, h, n, fms] = A[name];
  const s = o.scale ?? PX, delay = o.delay ?? 0, W = w * s, H = h * s, w3 = w * PX, h3 = h * PX;
  const box = document.createElement('div');
  box.className = 'fx';
  box.style.cssText = `left:${x - W / 2}px;top:${o.anchor === 'b' ? y - H : y - H / 2}px;width:${W}px;height:${H}px`;
  const el = document.createElement('div');
  el.className = 'fx-sp';
  el.style.cssText = `left:${(W - w3) / 2}px;top:${o.anchor === 'b' ? H - h3 : (H - h3) / 2}px;width:${w3}px;height:${h3}px;background-image:url(${atlasUrl});background-size:${AW * PX}px ${AH * PX}px;background-position:${-ax * PX}px ${-ay * PX}px`;
  el.style.transformOrigin = o.anchor === 'b' ? '50% 100%' : '50% 50%';
  el.style.transform = [o.rot ? `rotate(${o.rot}deg)` : '', o.flip ? 'scaleX(-1)' : '', o.squash ? `scaleY(${o.squash})` : '', s !== PX ? `scale(${s / PX})` : ''].join(' ').trim() || 'none';
  box.append(el);
  stage.append(box);
  if (delay > 0) {
    box.style.visibility = 'hidden';
    later(delay, () => { box.style.visibility = ''; });
  }
  if (n > 1) {
    const from = `${-ax * PX}px ${-ay * PX}px`;
    if (o.loop) el.animate([{ backgroundPosition: from }, { backgroundPosition: `${-(ax + n * w) * PX}px ${-ay * PX}px` }], { duration: (n * fms) / speed, delay: delay / speed, iterations: Infinity, easing: `steps(${n})` });
    // 마지막 프레임에서 멈춰 남는 시간(life)까지 보인다
    else el.animate([{ backgroundPosition: from }, { backgroundPosition: `${-(ax + (n - 1) * w) * PX}px ${-ay * PX}px` }], { duration: ((n - 1) * fms) / speed, delay: delay / speed, easing: `steps(${n - 1})`, fill: 'forwards' });
  }
  later(delay + (o.life ?? n * fms), () => box.remove());
  return box;
}
/** 놓인 그림을 움직인다 (지우기는 sp가 맡는다). 처음 transform을 덮으니 돌림 등은 프레임에 함께 적는다. */
function move(el: HTMLElement, frames: Keyframe[], ms: number, delay = 0, easing = 'linear'): void {
  el.animate(frames, { duration: ms / speed, delay: delay / speed, easing, fill: 'both' });
}
function fadeOut(el: HTMLElement, ms: number, delay: number): void {
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms / speed, delay: delay / speed, fill: 'forwards', composite: 'replace' });
}

// ── 입자: 작은 픽셀 그림들이 흩어지거나 떠오른다 ──
/** 사방(up이면 위쪽 반)으로 튀는 입자. gravity > 0이면 끝에 떨어진다. */
function scatter(stage: HTMLElement, name: string, x: number, y: number, n: number, dist: number, o: { delay?: number; gravity?: number; scale?: number; up?: boolean } = {}): void {
  for (let i = 0; i < n; i++) {
    const a = o.up ? rand(-Math.PI * 0.9, -Math.PI * 0.1) : (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
    const d = dist * rand(0.55, 1), dx = Math.cos(a) * d, dy = Math.sin(a) * d, g = o.gravity ?? 0, ms = rand(420, 620), at = (o.delay ?? 0) + i * 12;
    const el = sp(stage, name, x, y, { delay: at, life: ms, scale: o.scale });
    move(el, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${dx * 0.7}px,${dy * 0.7}px)`, opacity: 1, offset: 0.5 }, { transform: `translate(${dx}px,${dy + g}px)`, opacity: 0 }], ms, at, 'ease-out');
  }
}
/** 몸에서 위(dy<0)나 아래(dy>0)로 흐르는 입자. */
function drift(stage: HTMLElement, s: Spot, name: string, n: number, dy: number, delay = 0): void {
  for (let i = 0; i < n; i++) {
    const x = s.x + rand(-0.36, 0.36) * s.size, y = s.y + rand(-0.2, 0.3) * s.size, sx = rand(-8, 8), ms = rand(560, 760), d = delay + i * 50;
    const el = sp(stage, name, x, y, { delay: d, life: ms });
    move(el, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: `translate(${sx / 2}px,${dy * 0.3}px)`, opacity: 1, offset: 0.25 }, { transform: `translate(${sx}px,${dy}px)`, opacity: 0 }], ms, d, 'ease-out');
  }
}
type Pt = { x: number; y: number };
/** 투사체: 그림이 a → b로 날아가며(방향에 맞춰 돌림) 꼬리 입자를 남긴다. 도착 시각(ms)을 돌려준다. */
function shoot(stage: HTMLElement, name: string, a: Pt, b: Pt, ms: number, delay = 0, o: { trail?: string; scale?: number; spin?: boolean } = {}): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const el = sp(stage, name, a.x, a.y, { delay, life: ms, loop: true, scale: o.scale, rot: o.spin ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI });
  move(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }], ms, delay, 'cubic-bezier(.45,0,.9,.6)');
  if (o.trail) for (let i = 1; i < 7; i++) {
    const t = i / 7, p = sp(stage, o.trail, a.x + dx * t + rand(-4, 4), a.y + dy * t + rand(-5, 5), { delay: delay + ms * t, life: 360 });
    move(p, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${rand(-10, 2)}px,${rand(-8, 8)}px)`, opacity: 0 }], 360, delay + ms * t, 'ease-out');
  }
  return delay + ms;
}
/** 하늘에서 떨어지는 것 (운석·화살비). rotate면 떨어지는 방향으로 돌린다. */
function fall(stage: HTMLElement, name: string, to: Pt, ms: number, delay: number, from: { dx: number; dy: number }, scale?: number, rotate = true): void {
  const el = sp(stage, name, to.x + from.dx, to.y + from.dy, { delay, life: ms, loop: true, scale, rot: rotate ? (Math.atan2(-from.dy, -from.dx) * 180) / Math.PI : 0 });
  move(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${-from.dx}px,${-from.dy}px)` }], ms, delay, 'cubic-bezier(.4,0,.9,.6)');
}
const middle = (to: Spot[]): Spot => ({ x: to.reduce((a, t) => a + t.x, 0) / to.length, y: to.reduce((a, t) => a + t.y, 0) / to.length, size: to[0].size });

export function fxShake(stage: HTMLElement, amp = 5): void {
  if (calm()) return;
  stage.animate([{ translate: '0 0' }, { translate: `${-amp}px ${amp / 2}px` }, { translate: `${amp}px ${-amp / 2}px` }, { translate: `${-amp / 2}px 0` }, { translate: '0 0' }], { duration: 260 / speed });
}
/** 무대 전체를 잠깐 물들이는 번쩍임 (모양이 아니라 색 덮개). */
function flash(stage: HTMLElement, color: string, ms = 220, alpha = 0.45, delay = 0): void {
  const el = document.createElement('div');
  el.className = 'fx fx-flash';
  el.style.color = color;
  stage.append(el);
  el.animate([{ opacity: alpha }, { opacity: 0 }], { duration: ms / speed, delay: delay / speed, fill: 'both', easing: 'ease-out' }).onfinish = () => el.remove();
}

// ── 등급 기준 (기본 공격 0 < 하급 1 < 중급 2 < 상급 3 < 최상급 4) ──
// 등급이 오를수록 겹(그림 수)·크기·입자·화면 연출이 늘어난다. 그림 질은 같고 양과 크기만 다르다.
//  기본  : 시전 없음(마법사만 작은 세로 마법진) · 타격 1겹 3배 · 입자 ×0.5 · 화면 없음
//  하급  : 세로 마법진 3배 / 빛기둥만 · 타격 + 작은 흰 번쩍(2배) · 입자 ×0.8 · 화면 없음
//  중급  : 세로+바닥 마법진 3배 + 모이는 반짝 4 · 타격 + 고리(3배) · 입자 ×1.2 · 흔들림 3
//  상급  : 마법진 4배 + 반짝 6 · 타격 4배 + 고리(4배) + 흰 번쩍(3배) · 입자 ×1.8 · 흔들림 6 · 약한 색 번쩍
//  최상급: 마법진 4배 + 바깥 바닥 고리(5배) + 반짝 8 + 무대 어둡게 · 타격 4배 + 고리(5배) + 흰 폭발(4배) + 금빛 별 · 입자 ×2.4 · 흔들림 9 · 강한 번쩍
const GRADE = [
  { castK: 3, ground: false, gather: 0, hitK: 3, ring: 0, flare: 0, parts: 0.5, shake: 0 },
  { castK: 3, ground: false, gather: 2, hitK: 3, ring: 0, flare: 2, parts: 0.8, shake: 0 },
  { castK: 3, ground: true, gather: 4, hitK: 3, ring: 3, flare: 0, parts: 1.2, shake: 3 },
  { castK: 4, ground: true, gather: 6, hitK: 4, ring: 4, flare: 3, parts: 1.8, shake: 6 },
  { castK: 4, ground: true, gather: 8, hitK: 4, ring: 5, flare: 4, parts: 2.4, shake: 9 },
];
const TIER_OF: Record<string, number> = { Low: 1, Mid: 2, High: 3, Top: 4 };
/** 스킬 등급 → 이펙트 등급 (기본 공격·없는 스킬은 0). */
export const fxTierOf = (skillId: string | null): number => TIER_OF[skillDef(skillId)?.Tier ?? ''] ?? 0;
/** 지금 연출 중인 행동의 등급 (fxSkill이 정한다). */
let cur = 0;

// ── 공통 연출 ──
/** 시전 마법진: 시전자 앞에 서는 세로 점선 타원 (+ 중급부터 발밑 마법진·모여드는 반짝이, 최상급은 바깥 고리·무대 어둡게). */
function cast(stage: HTMLElement, s: Spot, pal: string, tier = cur): void {
  const G = GRADE[tier], k = tier === 0 ? 2 : G.castK, life = 500 + tier * 40;
  sp(stage, `circlev_${pal}`, s.x + s.size * 0.6, s.y, { scale: k, life });
  if (G.ground) sp(stage, `circleg_${pal}`, s.x, feet(s), { scale: k, life });
  if (tier === 4) { sp(stage, `circleg_${pal}`, s.x, feet(s), { scale: 5, delay: 80, life }); flash(stage, '#0A0612', 600, 0.35); }
  const star = A[`star_${pal}`] ? `star_${pal}` : 'star_white';
  for (let i = 0; i < G.gather; i++) {
    const a = rand(0, Math.PI * 2), d = s.size * 0.8, el = sp(stage, star, s.x + s.size * 0.6 + Math.cos(a) * d, s.y + Math.sin(a) * d, { life: 320, delay: i * 40 });
    move(el, [{ transform: 'translate(0,0)', opacity: 0 }, { transform: `translate(${-Math.cos(a) * d}px,${-Math.sin(a) * d}px)`, opacity: 1 }], 320, i * 40, 'ease-in');
  }
}
/** 자기 강화: 빛기둥 (+ 중급부터 발밑 고리, 상급부터 두 겹 고리, 최상급은 색 번쩍·흔들림) + 떠오르는 반짝이. */
function aura(stage: HTMLElement, s: Spot, pal: 'gold' | 'ice' | 'green' | 'red' | 'white', delay = 0, tier = cur): void {
  const G = GRADE[tier];
  sp(stage, `aura_${pal}`, s.x, feet(s) + 4, { anchor: 'b', delay, life: 600, scale: tier >= 3 ? 4 : 3 });
  if (tier >= 2) sp(stage, `ring_${pal}`, s.x, feet(s), { squash: 0.35, scale: G.ring + 1, delay });
  if (tier >= 3) sp(stage, `ring_${pal}`, s.x, feet(s), { squash: 0.35, scale: G.ring + 3, delay: delay + 140 });
  if (tier === 4) { flash(stage, { gold: '#F6C063', ice: '#8FD3F4', green: '#8EE87A', red: '#E0524A', white: '#FFFFFF' }[pal], 300, 0.3, delay + 100); later(delay + 100, () => fxShake(stage, 4)); }
  drift(stage, s, `star_${pal}`, Math.round(3 + G.parts * 2), -s.size * 0.8, delay + 80);
}
/** 대상 아래 바닥에서 얼음 가시가 솟았다가 깨진다 (참고 그림). */
function iceSpikes(stage: HTMLElement, t: Spot, big: boolean, delay: number): void {
  const g = feet(t) + 6;
  sp(stage, 'circleg_ice', t.x, feet(t), { delay: Math.max(0, delay - 80), life: 760 });
  const back: [number, string][] = big ? [[-0.15, 'spike_l'], [0.3, 'spike_l'], [-0.45, 'spike_s'], [0.6, 'spike_s']] : [[0, 'spike_s']];
  const front: [number, string][] = big ? [[-0.6, 'spike_s'], [0.05, 'spike_l'], [0.45, 'spike_s'], [-0.3, 'spike_s']] : [[-0.4, 'spike_s'], [0.35, 'spike_s']];
  [...back, ...front].forEach(([dx, name], i) => sp(stage, name, t.x + dx * t.size * 1.2, g + (i >= back.length ? 4 : -2), { anchor: 'b', delay: delay + i * 35, life: 720 }));
  scatter(stage, 'snow', t.x, t.y, 6, t.size * 0.8, { delay: delay + 120 });
  scatter(stage, 'shard_ice', t.x, feet(t) - t.size * 0.3, 8, t.size, { delay: delay + 640, gravity: 30 });
}

/**
 * 도적 그림자 분신: 실제 도적 그림(19×18)을 픽셀 그대로 한 색 실루엣 + 밝은 테두리로 칠한 그림.
 * 처음 쓸 때 캔버스로 한 번 만들어 색마다 저장해 둔다.
 */
const ROGUE = 'rogue';
const tintCache = new Map<string, string>();
let rogueImg: HTMLImageElement | null = null;
// 첫 분신이 칠해진 그림으로 나오게 미리 불러 둔다
if (typeof Image !== 'undefined') { rogueImg = new Image(); rogueImg.src = spriteUrl(ROGUE) ?? ''; }
function tinted(body: string, rim: string): string {
  const key = body + rim, hit = tintCache.get(key);
  if (hit) return hit;
  if (!rogueImg) { rogueImg = new Image(); rogueImg.src = spriteUrl(ROGUE) ?? ''; }
  if (!rogueImg.complete || !rogueImg.naturalWidth) return spriteUrl(ROGUE) ?? '';
  const w = rogueImg.naturalWidth, h = rogueImg.naturalHeight, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  g.drawImage(rogueImg, 0, 0);
  const src = g.getImageData(0, 0, w, h), out = g.createImageData(w, h);
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && src.data[(y * w + x) * 4 + 3] > 0;
  const hex = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [B, Rm] = [hex(body), hex(rim)];
  // 안쪽은 원래 그림의 밝기에 따라 3단(어두움·몸색·밝음)으로 칠해 얼굴·옷 모양이 보이게 한다
  const mix = (a: number[], b: number[], t: number): number[] => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const tones = [mix(B, [0, 0, 0], 0.45), B, mix(B, Rm, 0.45)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue;
    const i = (y * w + x) * 4, lum = (src.data[i] * 0.3 + src.data[i + 1] * 0.59 + src.data[i + 2] * 0.11) / 255;
    const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
    out.data.set([...(edge ? Rm : tones[lum < 0.25 ? 0 : lum < 0.55 ? 1 : 2]), 255], i);
  }
  g.putImageData(out, 0, 0);
  const url = cv.toDataURL();
  tintCache.set(key, url);
  return url;
}
/** 분신 한 장을 발끝(at)에 세운다. */
function clone(stage: HTMLElement, at: Pt, o: { delay: number; life: number; flip?: boolean; alpha?: number; body?: string; rim?: string }): HTMLElement {
  const w = 19 * PX, h = 18 * PX;
  const el = document.createElement('img');
  el.className = 'fx fx-clone';
  el.alt = '';
  el.src = tinted(o.body ?? '#2a1450', o.rim ?? '#c77dff');
  el.style.cssText = `left:${at.x - w / 2}px;top:${at.y - h}px;width:${w}px;height:${h}px`;
  if (o.flip) el.style.transform = 'scaleX(-1)';
  if (o.alpha !== undefined) el.style.opacity = String(o.alpha);
  stage.append(el);
  if (o.delay > 0) {
    el.style.visibility = 'hidden';
    later(o.delay, () => { el.style.visibility = ''; });
  }
  later(o.delay + o.life, () => el.remove());
  return el;
}
/** 분신이 연기 속에서 나와 잔상을 남기며 대상 뒤로 달려가 벤다. 벤 시각(ms)을 돌려준다. */
function shadowStrike(stage: HTMLElement, me: Spot, t: Spot, delay: number, hit: 'slash' | 'x'): number {
  const from = { x: me.x, y: feet(me) }, to = { x: t.x + t.size * 0.55, y: feet(t) }, run = 150;
  sp(stage, 'smoke', from.x, me.y, { delay, scale: 3 });
  for (let i = 1; i <= 4; i++) {
    const f = i / 5, c = clone(stage, { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f }, { delay: delay + run * f, life: 260, alpha: 0.75 - i * 0.12, body: i % 2 ? '#56289a' : '#7a3fc8', rim: '#d08cff' });
    fadeOut(c, 260, delay + run * f);
  }
  const body = clone(stage, to, { delay: delay + run, life: 440, flip: true });
  fadeOut(body, 160, delay + run + 280);
  if (hit === 'x') sp(stage, 'xslash_shadow', t.x, t.y, { delay: delay + run + 40, scale: 4 });
  else sp(stage, 'slash_shadow', t.x, t.y, { delay: delay + run + 20, scale: 4, flip: true });
  scatter(stage, 'star_shadow', t.x, t.y, 5, t.size * 0.7, { delay: delay + run + 60 });
  sp(stage, 'smoke', to.x, t.y, { delay: delay + run + 300, scale: 3 });
  return delay + run + 60;
}
/** 줄줄이 이어 붙이는 그림 (번개 마디·빛줄기·땅 갈라짐): a → b 방향으로 seg 간격. */
function chain(stage: HTMLElement, name: string, a: Pt, b: Pt, o: { delay: number; life: number; step?: number; loop?: boolean }): HTMLElement[] {
  const dx = b.x - a.x, dy = b.y - a.y, seg = A[name][2] * PX - 3, n = Math.max(1, Math.round(Math.hypot(dx, dy) / seg)), deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Array.from({ length: n }, (_, k) => sp(stage, name, a.x + (dx * (k + 0.5)) / n, a.y + (dy * (k + 0.5)) / n, { rot: deg, delay: o.delay + k * (o.step ?? 0), life: o.life, loop: o.loop }));
}

/**
 * 빛줄기: 시전자 손(from)에서 대상(to) 쪽으로 기울여 뻗는다. 여러 대상이면 대상마다 한 줄씩 부채꼴로
 * (서로 꿰뚫지 않고 각자 대상 앞에서 멈춘다). pulse면 굵어졌다 가늘어지며 사라진다 (돌린 방향 그대로).
 */
function beams(stage: HTMLElement, name: string, from: Pt, to: Spot[], o: { delay: number; life: number; pulse?: boolean }): void {
  to.forEach((t, k) => {
    const dx = t.x - from.x, dy = t.y - from.y, len = Math.hypot(dx, dy), stop = Math.max(0, len - t.size * 0.35);
    const end = { x: from.x + (dx * stop) / len, y: from.y + (dy * stop) / len }, deg = (Math.atan2(dy, dx) * 180) / Math.PI, d = o.delay + k * 50;
    chain(stage, name, from, end, { delay: d, life: o.life, step: 15, loop: true }).forEach((el, i) => {
      if (!o.pulse) return;
      const r = `rotate(${deg}deg)`;
      el.firstElementChild!.animate([{ transform: `${r} scaleY(.2)` }, { transform: `${r} scaleY(1.5)`, offset: 0.3 }, { transform: `${r} scaleY(1.1)`, offset: 0.7 }, { transform: `${r} scaleY(0)` }], { duration: o.life / speed, delay: (d + i * 15) / speed, fill: 'both' });
    });
  });
}

type SkillFx = (st: HTMLElement, me: Spot, to: Spot[]) => number;
/**
 * 스킬마다 다른 연출. 돌려주는 값 = 맞는 순간까지의 시간(ms, 전투 속도 반영 전).
 * to = 실제로 맞는 적들 (자기 강화는 빈 배열). 전사 근접 스킬의 휘두르기는 fxSwing이 맡는다.
 */
const SKILL_FX: Record<string, SkillFx> = {
  // ── 전사 ── (강타·자루 찍기·전쟁의 일격의 휘두르기는 fxSwing이 등급에 맞춰 그린다)
  // 하급
  w_bash: () => 0,
  w_warcry: (st, me) => { aura(st, me, 'gold'); sp(st, 'ring_gold', me.x, me.y, { scale: 4, delay: 120 }); return 0; },
  w_riposte: (st, me) => { aura(st, me, 'gold'); sp(st, 'shield', me.x + me.size * 0.45, me.y, { delay: 160, life: 520 }); return 0; },
  // 중급
  w_shield: (st, _me, to) => { if (to[0]) sp(st, 'burst_white', to[0].x, to[0].y, { scale: 3, delay: 140 }); return 0; },
  w_guard: (st, me) => { aura(st, me, 'ice'); sp(st, 'shield', me.x + me.size * 0.45, me.y, { delay: 160, life: 520 }); sp(st, 'ring_ice', me.x, me.y, { scale: 4, delay: 200 }); return 0; },
  w_will: (st, me) => { aura(st, me, 'green'); drift(st, me, 'plus', 6, -me.size * 0.8, 100); return 0; },
  // 상급
  w_whirl: (st, me, to) => {
    sp(st, 'whirl', me.x, me.y, { scale: 4, life: 420 });
    sp(st, 'whirl', me.x, me.y, { scale: 5, delay: 100, life: 380 });
    sp(st, 'ring_white', me.x, me.y, { scale: 5, delay: 60 });
    to.forEach((t, i) => { sp(st, 'slash_white', t.x, t.y, { scale: 4, delay: 160 + i * 30, rot: rand(-30, 30) }); sp(st, 'slash_white', t.x, t.y, { delay: 230 + i * 30, rot: rand(150, 210) }); });
    later(180, () => fxShake(st, 5));
    return 200;
  },
  w_roar: (st, me) => { cast(st, me, 'red'); flash(st, '#E0524A', 260, 0.22); for (let i = 0; i < 4; i++) sp(st, 'ring_gold', me.x, me.y, { scale: 5 + i * 2, delay: i * 90 }); fxShake(st, 6); return 260; },
  // 최상급
  w_earth: (st, me, to) => {
    aura(st, me, 'gold');
    const g = feet(me) - 4, end = Math.max(...to.map((t) => t.x)) + 30;
    chain(st, 'crack', { x: me.x + 10, y: g }, { x: end, y: g }, { delay: 120, life: 700, step: 40 });
    for (const t of to) {
      sp(st, 'burst_earth', t.x, feet(t) - 10, { delay: 300, scale: 5 });
      sp(st, 'ring_earth', t.x, feet(t), { delay: 300, scale: 6, squash: 0.4 });
      scatter(st, 'rock', t.x, feet(t) - 10, 12, t.size, { delay: 300, up: true, gravity: 40 });
    }
    flash(st, '#C8A06A', 300, 0.4, 300);
    later(300, () => fxShake(st, 10));
    return 340;
  },
  w_strike: (st, me, to) => {
    cast(st, me, 'gold');
    if (to[0]) {
      const t = to[0];
      sp(st, 'xslash_white', t.x, t.y, { scale: 5, delay: 200 });
      sp(st, 'burst_gold', t.x, t.y, { scale: 5, delay: 230 });
      sp(st, 'ring_white', t.x, t.y, { scale: 6, delay: 240 });
      scatter(st, 'star_gold', t.x, t.y, 10, t.size * 1.1, { delay: 240 });
      flash(st, '#FFFFFF', 220, 0.5, 200);
    }
    later(200, () => fxShake(st, 9));
    return 240;
  },
  // ── 궁수 ──
  // 하급
  a_aim: (st, me) => { aura(st, me, 'gold'); sp(st, 'ring_gold', me.x + me.size * 0.6, me.y - me.size * 0.2, { scale: 2, delay: 200 }); return 0; },
  a_double: (st, me) => { aura(st, me, 'green'); for (let i = 0; i < 2; i++) sp(st, 'pierce_white', me.x + me.size * 0.9, me.y + (i - 0.5) * 12, { delay: i * 70 }); return 0; },
  a_scatter: (st, me, to) => { let t0 = 0; to.forEach((t, i) => { t0 = Math.max(t0, shoot(st, 'proj_arrow', { x: me.x + me.size * 0.4, y: me.y }, t, 170, i * 30)); }); return t0; },
  // 중급
  a_wind: (st, me) => { aura(st, me, 'white'); sp(st, 'pierce_white', me.x + me.size, me.y, { scale: 4, delay: 120 }); scatter(st, 'star_white', me.x + me.size, me.y, 4, me.size * 0.4, { delay: 160 }); return 0; },
  a_flash: (st, me, to) => { if (!to[0]) return 0; cast(st, me, 'bolt'); flash(st, '#FFFFFF', 160, 0.15, 140); return shoot(st, 'proj_light', { x: me.x + me.size * 0.4, y: me.y }, to[0], 150, 60, { trail: 'star_bolt' }); },
  a_weak: (st, me, to) => { if (!to[0]) return 0; sp(st, 'seal', to[0].x, to[0].y, { life: 420 }); return shoot(st, 'proj_arrow', { x: me.x + me.size * 0.4, y: me.y }, to[0], 170, 160, { trail: 'star_red' }); },
  // 상급
  a_rain: (st, me, to) => {
    cast(st, me, 'gold');
    for (let i = 0; i < 4; i++) shoot(st, 'proj_arrow', { x: me.x + me.size * 0.3, y: me.y }, { x: me.x + 20 + i * 8, y: me.y - 160 }, 160, i * 30);
    for (const t of to) {
      sp(st, 'circleg_gold', t.x, feet(t), { delay: 120, life: 520 });
      for (let i = 0; i < 9; i++) fall(st, 'proj_arrow', { x: t.x + rand(-t.size * 0.45, t.size * 0.45), y: t.y + rand(-10, 22) }, 200, 200 + i * 30, { dx: -40, dy: -200 });
    }
    later(400, () => fxShake(st, 5));
    return 400;
  },
  a_pierce: (st, me, to) => {
    cast(st, me, 'gold');
    const from = { x: me.x + me.size * 0.5, y: me.y };
    beams(st, 'beam_light', from, to, { delay: 200, life: 320 });
    let t0 = 0;
    to.forEach((t, i) => { t0 = Math.max(t0, shoot(st, 'proj_arrow', from, t, 160, 160 + i * 50, { scale: 4, trail: 'star_gold' })); sp(st, 'burst_gold', t.x, t.y, { scale: 4, delay: 320 + i * 50 }); });
    later(t0, () => fxShake(st, 5));
    return t0;
  },
  // 최상급
  a_storm: (st, me) => {
    aura(st, me, 'gold'); aura(st, me, 'green', 140);
    sp(st, 'whirl', me.x, me.y, { scale: 4, delay: 100, life: 420 });
    for (let i = 0; i < 3; i++) sp(st, 'ring_green', me.x, me.y, { scale: 4 + i * 2, delay: i * 120 });
    return 0;
  },
  a_volley: (st, me, to) => {
    cast(st, me, 'gold');
    for (let w = 0; w < 4; w++) to.forEach((t, i) => shoot(st, 'proj_arrow', { x: me.x + me.size * 0.4, y: me.y + rand(-10, 10) }, { x: t.x + rand(-6, 6), y: t.y + rand(-6, 6) }, 170, 160 + w * 70 + i * 15, { trail: w % 2 ? undefined : 'star_gold' }));
    for (const t of to) { sp(st, 'burst_gold', t.x, t.y, { scale: 4, delay: 560 }); sp(st, 'ring_gold', t.x, t.y, { scale: 5, delay: 580 }); }
    flash(st, '#F6C063', 260, 0.4, 560);
    later(560, () => fxShake(st, 9));
    return 330;
  },
  // ── 도적 ──
  // 하급
  r_ambush: (st, me, to) => {
    const t = to[0];
    if (!t) return 0;
    sp(st, 'smoke', me.x, me.y);
    const c = clone(st, { x: t.x + t.size * 0.55, y: feet(t) }, { delay: 120, life: 400, flip: true });
    move(c, [{ transform: 'scaleX(-1) translateY(-90px)', opacity: 0 }, { transform: 'scaleX(-1) translateY(0)', opacity: 1 }], 140, 120, 'ease-in');
    fadeOut(c, 160, 360);
    sp(st, 'slash_gold', t.x, t.y, { delay: 250, flip: true, rot: 20 });
    return 270;
  },
  r_venom: (st, me, to) => { drift(st, me, 'bubble', 4, -me.size * 0.5); if (to[0]) sp(st, 'pierce_white', to[0].x - to[0].size * 0.3, to[0].y, { delay: 100 }); return 120; },
  r_keen: (st, me) => { aura(st, me, 'gold'); scatter(st, 'star_gold', me.x + me.size * 0.4, me.y, 3, me.size * 0.5, { delay: 200 }); return 0; },
  r_shuriken: (st, me, to) => { let t0 = 0; to.forEach((t, i) => { t0 = Math.max(t0, shoot(st, 'proj_star', { x: me.x + me.size * 0.4, y: me.y }, t, 220, i * 40, { spin: true })); }); return t0; },
  // 중급
  r_vital: (st, me, to) => { if (!to[0]) return 0; sp(st, 'smoke', me.x, me.y); sp(st, 'pierce_blood', to[0].x - to[0].size * 0.2, to[0].y, { scale: 4, delay: 60 }); scatter(st, 'drop', to[0].x, to[0].y, 4, to[0].size * 0.6, { delay: 120, gravity: 24 }); return 140; },
  r_shadow: (st, me, to) => (to[0] ? shadowStrike(st, me, to[0], 0, 'x') : 0),
  // 상급
  r_storm: (st, me, to) => {
    sp(st, 'smoke', me.x, me.y, { scale: 4 });
    sp(st, 'whirl', me.x, me.y, { scale: 4, life: 380 });
    for (const t of to) { sp(st, 'ring_white', t.x, t.y, { scale: 4, delay: 120 }); for (let i = 0; i < 4; i++) sp(st, 'slash_white', t.x + rand(-8, 8), t.y + rand(-8, 8), { delay: 120 + i * 60, rot: rand(0, 360), scale: i % 2 ? 3 : 4 }); }
    later(160, () => fxShake(st, 5));
    return 160;
  },
  r_cruel: (st, me) => { aura(st, me, 'red'); flash(st, '#E0524A', 240, 0.22); drift(st, me, 'drop', 6, -me.size * 0.5, 100); return 0; },
  // 최상급
  r_assassin: (st, me, to) => {
    const t = to[0];
    if (!t) return 0;
    flash(st, '#140A24', 800, 0.65);
    sp(st, 'smoke', me.x, me.y, { scale: 4 });
    const at = { x: t.x + t.size * 0.55, y: feet(t) };
    sp(st, 'smoke', at.x, t.y, { scale: 4, delay: 180 });
    const c = clone(st, at, { delay: 220, life: 520, flip: true });
    fadeOut(c, 160, 600);
    sp(st, 'xslash_blood', t.x, t.y, { scale: 5, delay: 380 });
    sp(st, 'slash_shadow', t.x, t.y, { scale: 5, delay: 420, flip: true });
    sp(st, 'ring_blood', t.x, t.y, { scale: 6, delay: 400 });
    scatter(st, 'drop', t.x, t.y, 12, t.size, { delay: 400, gravity: 30 });
    later(380, () => fxShake(st, 10));
    return 400;
  },
  r_dance: (st, me, to) => {
    flash(st, '#140A24', 700, 0.5);
    let t0 = 0;
    to.forEach((t, i) => { t0 = Math.max(t0, shadowStrike(st, me, t, i * 70, 'slash')); });
    const c = middle(to);
    sp(st, 'xslash_shadow', c.x, c.y, { scale: 5, delay: t0 + 80 });
    sp(st, 'ring_shadow', c.x, c.y, { scale: 6, delay: t0 + 100 });
    later(t0 + 80, () => fxShake(st, 9));
    return t0;
  },
  // ── 마법사 ──
  // 하급
  m_fireball: (st, me, to) => { cast(st, me, 'fire'); return to[0] ? shoot(st, 'proj_fire', { x: me.x + me.size * 0.6, y: me.y }, to[0], 230, 160, { trail: 'ember' }) : 0; },
  m_bolt: (st, me, to) => { cast(st, me, 'arc'); return to[0] ? shoot(st, 'proj_arc', { x: me.x + me.size * 0.6, y: me.y }, to[0], 200, 160, { trail: 'star_arc' }) : 0; },
  m_shard: (st, me, to) => { cast(st, me, 'fire'); let t0 = 0; to.forEach((t) => { t0 = Math.max(t0, shoot(st, 'proj_fire', { x: me.x + me.size * 0.6, y: me.y }, t, 210, 160)); }); return t0; },
  // 중급
  m_ice: (st, me, to) => {
    cast(st, me, 'ice');
    if (!to.length) return 0;
    const far = to.reduce((a, t) => (t.x > a.x ? t : a), to[0]);
    const t0 = shoot(st, 'proj_ice', { x: me.x + me.size * 0.6, y: me.y }, far, 260, 200, { trail: 'snow', scale: 4 });
    for (const t of to) iceSpikes(st, t, false, t0 - 60);
    return t0;
  },
  m_chain: (st, me, to) => {
    cast(st, me, 'bolt');
    let prev: Pt = { x: me.x + me.size * 0.6, y: me.y };
    to.forEach((t, i) => { chain(st, 'zap_h', prev, t, { delay: 160 + i * 100, life: 260, loop: true }); prev = t; });
    flash(st, '#FFF6B0', 160, 0.15, 160);
    return 200;
  },
  m_silence: (st, me, to) => { cast(st, me, 'seal'); if (to[0]) sp(st, 'seal', to[0].x, to[0].y, { scale: 4, delay: 200 }); return 280; },
  // 상급
  m_meteor: (st, me, to) => {
    cast(st, me, 'fire');
    if (!to.length) return 0;
    const c = middle(to), fallMs = 460, hit = 160 + fallMs;
    fall(st, 'meteor', c, fallMs, 160, { dx: -150, dy: -210 }, 4, false);
    // 떨어진 순간: 모든 적이 동시에 터진다 + 번쩍 + 흔들림
    for (const t of to) { sp(st, 'explode', t.x, t.y, { delay: hit }); scatter(st, 'ember', t.x, t.y, 6, t.size * 0.9, { delay: hit, up: true }); }
    sp(st, 'ring_fire', c.x, c.y + 20, { scale: 7, squash: 0.45, delay: hit });
    flash(st, '#FFB060', 260, 0.3, hit);
    later(hit, () => fxShake(st, 7));
    return hit;
  },
  m_prison: (st, me, to) => { cast(st, me, 'ice'); if (to[0]) iceSpikes(st, to[0], true, 220); later(260, () => fxShake(st, 5)); return 300; },
  // 최상급
  m_overload: (st, me, to) => {
    cast(st, me, 'seal');
    if (!to[0]) return 0;
    beams(st, 'beam_arc', { x: me.x + me.size * 0.6, y: me.y }, [to[0]], { delay: 220, life: 520, pulse: true });
    sp(st, 'burst_arc', to[0].x, to[0].y, { scale: 5, delay: 300 });
    sp(st, 'ring_seal', to[0].x, to[0].y, { scale: 6, delay: 320 });
    scatter(st, 'star_arc', to[0].x, to[0].y, 12, to[0].size * 1.1, { delay: 320 });
    flash(st, '#FFFFFF', 260, 0.5, 280);
    later(300, () => fxShake(st, 9));
    return 320;
  },
  m_apocalypse: (st, me, to) => {
    cast(st, me, 'red');
    flash(st, '#7A1410', 620, 0.4);
    to.forEach((t, i) => {
      sp(st, 'pillar_fire', t.x, feet(t) + 6, { anchor: 'b', delay: 220 + i * 60, life: 560, scale: 4 });
      for (let k = 0; k < 3; k++) fall(st, 'meteor', { x: t.x + rand(-14, 14), y: t.y }, 260, 120 + k * 100, { dx: -40, dy: -200 }, 2, false);
      sp(st, 'explode', t.x, t.y, { delay: 380 + i * 40 });
      scatter(st, 'ember', t.x, feet(t), 10, t.size, { delay: 260 + i * 60, up: true });
    });
    flash(st, '#FFB060', 280, 0.45, 380);
    later(340, () => fxShake(st, 10));
    return 340;
  },
};
/** 전사가 그 자리에서 칼을 휘두르는 스킬 (fxSwing). */
const SWING = new Set(['w_bash', 'w_shield', 'w_strike']);
export const swingsSword = (job: Job, skillId: string | null): boolean => job === 'Warrior' && (!skillId || SWING.has(skillId));

/** 기본 공격 연출 (직업별). 맞는 순간까지의 시간을 돌려준다. 전사는 fxSwing이 맡는다. */
function basicFx(stage: HTMLElement, job: Job, me: Spot, to: Spot[]): number {
  if (!to[0]) return 0;
  if (job === 'Mage') { cast(stage, me, 'arc', 0); return shoot(stage, 'proj_arc', { x: me.x + me.size * 0.6, y: me.y }, to[0], 190, 150, { trail: 'star_arc' }); }
  if (job === 'Archer') return shoot(stage, 'proj_arrow', { x: me.x + me.size * 0.4, y: me.y }, to[0], 170);
  return 0;
}

/**
 * 플레이어 행동 연출 (전투 'Act' 사건). skillId가 없으면 기본 공격.
 * to = 이번 행동에 맞는 적들. 맞는 순간까지의 시간(ms, 전투 속도 반영 전)을 돌려준다.
 */
export function fxSkill(stage: HTMLElement, me: Spot, to: Spot[], job: Job, skillId: string | null): number {
  if (calm()) return 0;
  cur = fxTierOf(skillId);
  if (!skillId) return basicFx(stage, job, me, to);
  const fx = SKILL_FX[skillId];
  if (fx) return fx(stage, me, to);
  cast(stage, me, 'arc');
  return 120;
}
/**
 * 전사 휘두르기: 돌진하지 않고 그 자리에서 칼을 들었다 내려치며(그림을 발끝 기준으로 기울임),
 * 칼 쪽에 반달 베기 궤적이 나타난다. 맞는 순간까지의 시간을 돌려준다.
 */
export function fxSwing(stage: HTMLElement, unit: HTMLElement, me: Spot, tier = 0): number {
  const img = unit.querySelector<HTMLElement>('img') ?? unit;
  img.style.transformOrigin = '50% 100%';
  img.animate([{ rotate: '0deg' }, { rotate: `${-14 - tier * 2}deg`, offset: 0.35 }, { rotate: `${18 + tier * 2}deg`, offset: 0.6 }, { rotate: '0deg' }], { duration: 340 / speed, easing: 'ease-out' });
  if (calm()) return 120;
  // 기본: 흰 궤적 1 · 하급/중급: 금빛 궤적 · 상급 이상: 금빛 큰 궤적 + 흰 궤적 한 번 더
  const x = me.x + me.size * 0.6, y = me.y - me.size * 0.15;
  sp(stage, tier ? 'slash_gold' : 'slash_white', x, y, { scale: tier >= 3 ? 4 : 3, delay: 100 });
  if (tier >= 3) sp(stage, 'slash_white', x + 6, y + 4, { delay: 150 });
  if (tier >= 2) scatter(stage, 'star_gold', x + 10, y, Math.round(2 + tier * 1.5), me.size * 0.4, { delay: 140 });
  return 150;
}
/** 몬스터 스킬: 붉은 마법진 (몬스터는 왼쪽을 본다). */
export function fxEnemyCast(stage: HTMLElement, s: Spot): void {
  if (calm()) return;
  sp(stage, 'circlev_red', s.x - s.size * 0.6, s.y, { flip: true });
  sp(stage, 'circleg_red', s.x, feet(s));
}

// 타격 계열 → 고리·별 색
const HIT_PAL: Record<FxStyle, string> = { slash: 'white', claw: 'red', stab: 'white', arrow: 'gold', arcane: 'arc', fire: 'fire', ice: 'ice', bolt: 'bolt', quake: 'earth', shout: 'gold', smash: 'gold', shadow: 'shadow', poison: 'poison' };
/**
 * 타격: 계열별 픽셀 그림 + 입자. tier(등급 기준 GRADE)가 높을수록 크기·겹·입자가 늘어난다.
 * 치명타는 그 위에 흰 폭발 + 금빛 별 + 흔들림.
 */
export function fxHit(stage: HTMLElement, s: Spot, style: FxStyle, crit: boolean, tier = 0): void {
  if (calm()) return;
  const G = GRADE[tier], k = crit ? Math.max(4, G.hitK) : G.hitK, { x, y, size } = s;
  const n = (base: number): number => Math.max(1, Math.round(base * G.parts));
  switch (style) {
    case 'slash': sp(stage, 'slash_white', x, y, { scale: k, rot: rand(-20, 20) }); scatter(stage, 'star_white', x, y, n(4), size * 0.6); break;
    case 'claw': sp(stage, 'claw', x, y, { scale: k }); scatter(stage, 'star_red', x, y, n(3), size * 0.5); break;
    case 'stab': sp(stage, 'pierce_white', x - size * 0.25, y, { scale: k }); sp(stage, 'burst_white', x, y, { scale: 2, delay: 60 }); break;
    case 'arrow': sp(stage, 'burst_gold', x, y, { scale: k - 1 }); scatter(stage, 'feather', x, y, n(3), size * 0.5, { gravity: 20 }); break;
    case 'arcane': sp(stage, 'burst_arc', x, y, { scale: k }); scatter(stage, 'star_arc', x, y, n(5), size * 0.7); break;
    case 'fire': sp(stage, 'burst_fire', x, y, { scale: k }); scatter(stage, 'ember', x, y, n(6), size * 0.7, { up: true }); break;
    case 'ice': sp(stage, 'burst_ice', x, y, { scale: k }); scatter(stage, 'shard_ice', x, y, n(5), size * 0.7, { gravity: 24 }); scatter(stage, 'snow', x, y, n(3), size * 0.5); break;
    case 'bolt': sp(stage, 'bolt_v', x, feet(s) + 4, { anchor: 'b', scale: tier >= 3 ? 4 : 3 }); sp(stage, 'burst_bolt', x, y, { scale: k, delay: 40 }); break;
    case 'quake': sp(stage, 'burst_earth', x, feet(s) - 10, { scale: k }); scatter(stage, 'rock', x, feet(s) - 10, n(6), size * 0.7, { up: true, gravity: 40 }); break;
    case 'shout': sp(stage, 'ring_gold', x, y, { scale: k + 1 }); break;
    case 'smash': sp(stage, 'burst_gold', x, y, { scale: k + 1 }); sp(stage, 'ring_white', x, y, { scale: k, delay: 40 }); break;
    case 'shadow': sp(stage, 'xslash_shadow', x, y, { scale: k }); scatter(stage, 'star_shadow', x, y, n(4), size * 0.6); break;
    case 'poison': sp(stage, 'burst_poison', x, y, { scale: k }); scatter(stage, 'bubble', x, y, n(5), size * 0.6, { up: true }); break;
  }
  // 등급 겹: 고리(중급~) · 흰 번쩍(하급 작게, 상급~) · 금빛 별(최상급) · 흔들림(중급~)
  if (G.ring) sp(stage, `ring_${HIT_PAL[style]}`, x, y, { scale: G.ring, delay: 30 });
  if (G.flare) sp(stage, 'burst_white', x, y, { scale: G.flare, delay: 40 });
  if (tier === 4) scatter(stage, 'star_gold', x, y, 6, size, { delay: 60 });
  if (G.shake) fxShake(stage, G.shake);
  if (crit) {
    sp(stage, 'burst_white', x, y, { scale: 5, delay: 40 });
    scatter(stage, 'star_gold', x, y, 8, size * 0.9, { delay: 40 });
    fxShake(stage, Math.max(6, G.shake));
  }
}

/** 빗나감·회피: 대상이 옆으로 비켜섰다 돌아온다 (잔상처럼 반투명). */
export function fxDodge(el: HTMLElement, enemy: boolean): void {
  if (calm()) return;
  const dx = enemy ? 20 : -20;
  el.animate([{ translate: '0 0', opacity: 1 }, { translate: `${dx}px 0`, opacity: 0.45, offset: 0.35 }, { translate: '0 0', opacity: 1 }], { duration: 320 / speed, easing: EASE });
}

/** 반격 태세 발동: 금빛 방패가 번쩍이고 칼로 되받아친다. */
export function fxCounter(stage: HTMLElement, s: Spot): void {
  if (calm()) return;
  sp(stage, 'shield', s.x + s.size * 0.45, s.y, { life: 360 });
  sp(stage, 'slash_gold', s.x + s.size * 0.6, s.y - s.size * 0.1, { delay: 90 });
  scatter(stage, 'star_gold', s.x + s.size * 0.4, s.y, 5, s.size * 0.5, { delay: 60 });
}

/** 상태 이상이 걸림: 상태 아이콘이 튀어 오르고 발밑에 상태 색 고리 + 상태별 입자. */
export function fxStatus(stage: HTMLElement, s: Spot, type: StatusType, iconSrc: string): void {
  const img = document.createElement('img');
  img.className = 'fx fx-icon';
  img.src = iconSrc;
  img.alt = '';
  img.style.cssText = `left:${s.x - 12}px;top:${s.y - s.size * 0.55 - 12}px`;
  stage.append(img);
  img.animate(calm()
    ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }]
    : [{ transform: 'translateY(8px) scale(.6)', opacity: 0 }, { transform: 'translateY(-6px) scale(1.15)', opacity: 1, offset: 0.25 }, { transform: 'translateY(-10px) scale(1)', opacity: 1, offset: 0.75 }, { transform: 'translateY(-16px) scale(1)', opacity: 0 }],
  { duration: 820 / speed, easing: EASE, fill: 'forwards' }).onfinish = () => img.remove();
  if (calm()) return;
  const pal = STATUS_PAL[type];
  sp(stage, `ring_${pal}`, s.x, feet(s), { scale: 4, squash: 0.35 });
  switch (type) {
    case 'Poison': return drift(stage, s, 'bubble', 7, -s.size * 0.55);
    case 'Burn': return drift(stage, s, 'ember', 8, -s.size * 0.65);
    case 'Bleed': return drift(stage, { ...s, y: s.y - s.size * 0.2 }, 'drop', 6, s.size * 0.5);
    case 'Stun': return stunStars(stage, s);
    default: return drift(stage, s, `star_${pal}`, 7, isDebuff(type) ? s.size * 0.45 : -s.size * 0.6);
  }
}
/** 기절: 머리 위를 도는 별 3개. */
function stunStars(stage: HTMLElement, s: Spot): void {
  const cy = s.y - s.size * 0.5, r = s.size * 0.32;
  for (let i = 0; i < 3; i++) {
    const a0 = (i / 3) * Math.PI * 2;
    const at = (t: number): string => `translate(${Math.cos(a0 + t) * r}px,${Math.sin(a0 + t) * r * 0.35}px)`;
    const el = sp(stage, 'star_gold', s.x, cy, { life: 900, loop: true });
    move(el, [{ transform: at(0), opacity: 0 }, { transform: at(1.6), opacity: 1, offset: 0.2 }, { transform: at(4.8), opacity: 1, offset: 0.8 }, { transform: at(6.4), opacity: 0 }], 900);
  }
}

/** 턴마다 들어가는 독·출혈·화상 피해. */
export function fxTick(stage: HTMLElement, s: Spot, kind: TickKind): void {
  if (calm()) return;
  if (kind === 'Poison') { sp(stage, 'burst_poison', s.x, s.y, { scale: 2 }); drift(stage, s, 'bubble', 6, -s.size * 0.55); }
  else if (kind === 'Bleed') { sp(stage, 'burst_blood', s.x, s.y, { scale: 2 }); drift(stage, { ...s, y: s.y - s.size * 0.2 }, 'drop', 5, s.size * 0.5); }
  else { sp(stage, 'burst_fire', s.x, s.y, { scale: 2 }); drift(stage, s, 'ember', 7, -s.size * 0.65); }
}

/** 회복: 발밑 초록 고리 + 올라가는 십자 + 반짝이. */
export function fxHeal(stage: HTMLElement, s: Spot): void {
  if (calm()) return;
  sp(stage, 'ring_green', s.x, feet(s), { scale: 4, squash: 0.35 });
  drift(stage, s, 'plus', 6, -s.size * 0.7);
  drift(stage, s, 'star_green', 4, -s.size * 0.8, 120);
}

/** 쓰러짐: 연기가 피어오르며 살짝 가라앉고 흐려진다 (끝 상태 유지). */
export function fxDefeat(el: HTMLElement, stage?: HTMLElement, s?: Spot): void {
  el.style.opacity = '.3';
  if (calm()) return;
  if (stage && s) sp(stage, 'smoke', s.x, s.y, { scale: 4 });
  el.animate([{ translate: '0 0', opacity: 1 }, { translate: '0 6px', opacity: 0.3 }], { duration: 420 / speed, easing: EASE });
}

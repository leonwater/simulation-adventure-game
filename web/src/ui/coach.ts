import { h } from './kit';
import { router } from './router';

let current: HTMLElement | null = null;
let token = 0;

/** 튜토리얼이 가리킬 화면 요소: 요소에 data-anchor를 달아 두고 키로 찾는다. */
export const anchorEl = (key: string | null): HTMLElement | null => (key ? document.querySelector<HTMLElement>(`[data-anchor="${key}"]`) : null);

/** 화면 요소에 안내용 이름표를 붙인다. */
export function anchored<T extends HTMLElement>(el: T, key: string): T {
  el.dataset.anchor = key;
  return el;
}

/**
 * 코치 마크: 화면의 한 곳만 밝게 남기고 나머지를 어둡게 덮은 뒤 말풍선으로 설명한다.
 * - 설명(info): "다음"을 누르면 넘어간다. 가리킨 곳은 눌리지 않는다.
 * - 행동(action): 가리킨 곳만 눌린다. 플레이어가 직접 눌러야 다음으로 진행한다.
 */
export const coach = {
  get active(): boolean {
    return current !== null && current.isConnected;
  },
  clear(): void {
    token++;
    current?.remove();
    current = null;
  },
  info(anchor: string | null, title: string, html: string, onNext: (() => void) | null, onSkip: (() => void) | null = null): void {
    show(anchor, title, html, false, onNext, onSkip);
  },
  action(anchor: string | null, html: string, onSkip: (() => void) | null = null): void {
    show(anchor, '직접 해 보기', html, true, null, onSkip);
  },
};

function show(anchor: string | null, title: string, html: string, action: boolean, onNext: (() => void) | null, onSkip: (() => void) | null): void {
  coach.clear();
  const my = token;
  const holder = h('div', { class: 'coach', style: { position: 'absolute', inset: '0', zIndex: '70', pointerEvents: 'none' } });
  // 말풍선이 그려지기 전 잠깐 사이에도 다른 버튼이 눌리지 않게 화면 전체를 막아 둔다
  const guard = h('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'auto' } });
  holder.append(guard);
  router.layer.append(holder);
  current = holder;
  window.setTimeout(() => {
    if (my !== token) return;
    guard.remove();
    const target = anchorEl(anchor);
    target?.scrollIntoView({ block: 'center' });
    window.requestAnimationFrame(() => {
      if (my !== token) return;
      build(holder, anchor, title, html, action, onNext, onSkip);
    });
  }, 60);
}

function build(holder: HTMLElement, anchor: string | null, title: string, html: string, action: boolean, onNext: (() => void) | null, onSkip: (() => void) | null): void {
  const area = holder.getBoundingClientRect();
  const target = anchorEl(anchor);
  const next = (): void => {
    coach.clear();
    onNext?.();
  };
  const dim = 'rgba(0,0,0,.68)';
  const box = (l: number, t: number, w: number, hgt: number, color: string, click: (() => void) | null): HTMLElement => {
    const el = h('div', { style: { position: 'absolute', left: `${l}px`, top: `${t}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, hgt)}px`, background: color, pointerEvents: 'auto' } });
    if (click) el.addEventListener('click', click);
    return el;
  };
  let hole: { l: number; t: number; r: number; b: number } | null = null;
  if (target && target.isConnected) {
    const r = target.getBoundingClientRect();
    // 화면 밖으로 나가지 않게 테두리를 화면 안쪽으로 자른다 (큰 목록·창고 칸)
    hole = { l: Math.max(4, r.left - area.left - 4), t: Math.max(4, r.top - area.top - 4), r: Math.min(area.width - 4, r.right - area.left + 4), b: Math.min(area.height - 4, r.bottom - area.top + 4) };
    const c = action ? null : next;
    // 구멍 둘레 네 장으로 나머지를 덮는다 (행동 단계에서는 구멍만 눌린다)
    holder.append(
      box(0, 0, area.width, hole.t, dim, c),
      box(0, hole.b, area.width, area.height - hole.b, dim, c),
      box(0, hole.t, hole.l, hole.b - hole.t, dim, c),
      box(hole.r, hole.t, area.width - hole.r, hole.b - hole.t, dim, c));
    if (!action) holder.append(box(hole.l, hole.t, hole.r - hole.l, hole.b - hole.t, 'transparent', next));
    holder.append(h('div', { class: 'blink', style: { position: 'absolute', left: `${hole.l - 2}px`, top: `${hole.t - 2}px`, width: `${hole.r - hole.l + 4}px`, height: `${hole.b - hole.t + 4}px`, border: '2px solid var(--gold)', borderRadius: '10px', pointerEvents: 'none' } }));
  } else holder.append(box(0, 0, area.width, area.height, dim, action ? null : next));
  // 말풍선: 가리킨 곳이 위쪽이면 아래에, 아래쪽이면 위에 둔다
  const estimate = 170, gap = 14;
  const spaceBelow = hole ? area.height - hole.b : 0, spaceAbove = hole ? hole.t : 0;
  const below = !!hole && spaceBelow >= estimate + gap && (spaceBelow >= spaceAbove || spaceAbove < estimate + gap);
  const above = !!hole && !below && spaceAbove >= estimate + gap;
  const bubble = h('div', { style: { position: 'absolute', left: '16px', right: '16px', background: 'var(--dialog)', border: '1px solid var(--gold)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'auto' } },
    h('b', { style: { color: 'var(--gold)', fontSize: '13px' } }, title),
    h('div', { style: { fontSize: '15px', lineHeight: '1.4' } }));
  (bubble.lastElementChild as HTMLElement).innerHTML = html;
  const rowEl = h('div', { class: 'row', style: { justifyContent: 'flex-end' } });
  if (action) rowEl.append(h('b', { style: { color: 'var(--gold)', fontSize: '12px' } }, `${above ? '▼' : '▲'} 표시된 곳을 누르세요`));
  else {
    const b = h('button', { class: 'primary sm', style: { width: '88px' }, on: { click: next } }, '다음');
    rowEl.append(b);
  }
  bubble.append(rowEl);
  bubble.addEventListener('click', (e) => e.stopPropagation());
  if (hole && below) bubble.style.top = `${hole.b + gap}px`;
  else if (hole && above) bubble.style.bottom = `${area.height - hole.t + gap}px`;
  else bubble.style.top = '50%';
  holder.append(bubble);
  // 건너뛰기는 말풍선이 아니라 화면 오른쪽 위에 작게. 막는 판보다 위라 언제나 눌린다
  if (onSkip) {
    holder.append(h('button', { style: { position: 'absolute', right: '12px', top: '12px', minHeight: '30px', padding: '0 10px', fontSize: '12px', background: 'var(--dialog)', pointerEvents: 'auto' }, on: { click: () => {
      coach.clear();
      onSkip();
    } } }, '건너뛰기'));
  }
}

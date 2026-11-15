/** 작은 DOM 도우미: h('div', {class:'card'}, '글자', 자식...) */
export type Child = Node | string | number | null | undefined | false;
type Props = Record<string, any> & { class?: string; style?: Record<string, string> | Partial<CSSStyleDeclaration>; on?: Record<string, (e: Event) => void> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') {
        for (const [sk, sv] of Object.entries(v as Record<string, string>)) {
          if (sk.startsWith('--') || sk.includes('-')) el.style.setProperty(sk, String(sv));
          else (el.style as any)[sk] = sv;
        }
      } else if (k === 'on') for (const [ev, fn] of Object.entries(v as Record<string, (e: Event) => void>)) el.addEventListener(ev, fn);
      else if (k in el) (el as any)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(typeof c === 'number' ? String(c) : c);
  return el;
}

const BASE = import.meta.env.BASE_URL;
export const assetUrl = (path: string): string => `${BASE}${path}`;

/** 아이콘. color를 주면 흰색 아이콘을 그 색으로 칠한다 (칠하지 않으면 원래 색). */
export function icon(name: string, size = 20, color?: string): HTMLElement {
  const src = assetUrl(`icons/${name}.png`);
  if (!color) return h('img', { class: 'ic', src, width: size, height: size, alt: '', draggable: false });
  return h('span', { class: 'ic', style: { width: `${size}px`, height: `${size}px`, '--src': `url(${new URL(src, document.baseURI).href})`, color } });
}

export type BtnKind = '' | 'primary' | 'outline' | 'ghost' | 'danger';
export function button(label: Child | Child[], onClick: () => void, kind: BtnKind = '', extra = ''): HTMLButtonElement {
  const kids = Array.isArray(label) ? label : [label];
  return h('button', { class: `${kind} ${extra}`.trim(), on: { click: onClick } }, ...kids);
}

export const row = (...kids: Child[]): HTMLDivElement => h('div', { class: 'row' }, ...kids);
export const col = (...kids: Child[]): HTMLDivElement => h('div', { class: 'col' }, ...kids);
export const sub = (text: string): HTMLDivElement => h('div', { class: 'sub' }, text);
export const spacer = (): HTMLDivElement => h('div', { class: 'spacer' });
export const divider = (): HTMLDivElement => h('div', { class: 'divider' });
export const progress = (ratio: number, color = 'var(--blue)', width?: number): HTMLElement =>
  h('div', { class: 'progress', style: width ? { width: `${width}px` } : {} }, h('i', { style: { width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`, background: color } }));
export const dot = (): HTMLElement => h('span', { class: 'dot' });

/** 탭 줄 (구매 | 판매). */
export function tabs(labels: string[], active: number, onChange: (i: number) => void): HTMLElement {
  return h('div', { class: 'tabs' }, ...labels.map((l, i) => h('button', { class: i === active ? 'on' : '', 'data-anchor': `tab.${i}`, on: { click: () => onChange(i) } }, l)));
}

/** 짧게 누르면 onTap, 오래 누르면 onLong. */
/** 마우스·키보드로 하는 기기 (PC 웹, v3.20). 휴대폰·태블릿 터치는 false라 화면·조작이 그대로다. */
export const desktop = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/** PC에서 마우스를 올리면 잠깐 뒤 설명 말풍선 (길게 누르기의 짧은 대신). 화면을 다시 그리면 router가 지운다. */
export function hoverTip(el: HTMLElement, text: () => string): void {
  if (!desktop) return;
  let timer = 0;
  let tip: HTMLElement | null = null;
  const hide = (): void => {
    window.clearTimeout(timer);
    tip?.remove();
    tip = null;
  };
  el.addEventListener('mouseenter', () => {
    timer = window.setTimeout(() => {
      const t = text();
      if (!t || !el.isConnected) return;
      tip = h('div', { class: 'hovertip', role: 'tooltip' }, t);
      document.body.append(tip);
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
      const top = r.top - hh - 8 >= 8 ? r.top - hh - 8 : Math.min(window.innerHeight - hh - 8, r.bottom + 8);
      Object.assign(tip.style, { left: `${left}px`, top: `${top}px` });
    }, 350);
  });
  el.addEventListener('mouseleave', hide);
  el.addEventListener('pointerdown', hide);
}

export function longPress(el: HTMLElement, onLong: () => void, onTap: () => void, ms = 450): void {
  let timer = 0;
  let fired = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // 오른쪽 버튼은 contextmenu가 맡는다
    fired = false;
    timer = window.setTimeout(() => {
      fired = true;
      onLong();
      // 손을 떼며 오는 클릭 한 번만 막는다: 클릭이 이 버튼에 오든(상세 창이 떠서) 다른 곳에 가든, 뗀 직후 푼다
      const release = (): void => void window.setTimeout(() => { fired = false; });
      window.addEventListener('pointerup', release, { once: true, capture: true });
      window.addEventListener('pointercancel', release, { once: true, capture: true });
    }, ms);
  });
  const cancel = (): void => window.clearTimeout(timer);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('click', () => {
    if (!fired) onTap();
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // PC: 오른쪽 클릭 = 길게 누르기. 터치로 길게 눌러 이미 열었으면(터치 되는 노트북) 다시 열지 않는다
    if (desktop && !fired) {
      window.clearTimeout(timer);
      onLong();
    }
  });
  // 튜토리얼 말풍선 덮개 위에서 길게 누르면 덮개가 아래 요소로 'longpress'를 넘겨 준다 (coach.ts)
  el.addEventListener('longpress', () => onLong());
}

/** 여러 마디를 ' · '로 잇되, 마디 안에서는 줄을 바꾸지 않는다 ('빠른 / 재사용'처럼 갈리지 않게). */
export function phrases(parts: readonly string[], sep = ' · '): Child[] {
  return parts.flatMap((p, i) => (i ? [sep, h('span', { class: 'nw' }, p)] : [h('span', { class: 'nw' }, p)]));
}

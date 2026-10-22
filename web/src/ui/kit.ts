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
export function longPress(el: HTMLElement, onLong: () => void, onTap: () => void, ms = 450): void {
  let timer = 0;
  let fired = false;
  el.addEventListener('pointerdown', () => {
    fired = false;
    timer = window.setTimeout(() => {
      fired = true;
      onLong();
    }, ms);
  });
  const cancel = (): void => window.clearTimeout(timer);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('click', () => {
    if (!fired) onTap();
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** - 값 + 버튼 줄 (값이 바뀌어도 버튼이 움직이지 않는다). */
export function stepper(valueText: string, onMinus: () => void, minusOn: boolean, onPlus: () => void, plusOn: boolean): HTMLElement {
  const b = (label: string, fn: () => void, on: boolean): HTMLButtonElement => {
    const el = button(label, fn, 'ghost', 'sm');
    el.style.width = '40px';
    el.style.padding = '0';
    el.disabled = !on;
    return el;
  };
  return h('div', { class: 'row', style: { gap: '8px' } }, b('-', onMinus, minusOn), h('div', { style: { minWidth: '64px', textAlign: 'center', fontWeight: '700' } }, valueText), b('+', onPlus, plusOn));
}

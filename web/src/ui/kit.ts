/** 작은 DOM 도우미: h('div', {class:'card'}, '글자', 자식...) */
type Child = Node | string | null | undefined | false;
type Props = Record<string, any> & { class?: string; style?: Partial<CSSStyleDeclaration>; on?: Record<string, (e: Event) => void> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') Object.assign(el.style, v);
      else if (k === 'on') for (const [ev, fn] of Object.entries(v as Record<string, (e: Event) => void>)) el.addEventListener(ev, fn);
      else if (k in el) (el as any)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

export const button = (label: string, onClick: () => void, kind: '' | 'primary' = ''): HTMLButtonElement =>
  h('button', { class: kind, on: { click: onClick } }, label);

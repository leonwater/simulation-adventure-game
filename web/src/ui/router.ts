import { settings } from './settings';

/** 화면 하나. build()가 화면 내용을 그리고, 상태가 바뀌면 router.rebuild()로 다시 그린다. */
export abstract class Screen {
  abstract build(): HTMLElement;
  /** 뒤로 가기: 처리했으면 true. */
  onBack(): boolean {
    return false;
  }
  /** 화면이 그려진 직후 (튜토리얼 안내 등). */
  afterShow(): void {}
}

let view: HTMLElement;
let layer: HTMLElement;
let current: Screen | null = null;
const closers: (() => boolean)[] = [];

export const router = {
  mount(root: HTMLElement): void {
    view = document.createElement('div');
    view.className = 'page';
    layer = document.createElement('div');
    layer.className = 'layer';
    const frame = document.createElement('div');
    frame.className = 'screen';
    frame.append(view, layer);
    root.append(frame);
    applyTextScale();
  },
  get current(): Screen | null {
    return current;
  },
  get layer(): HTMLElement {
    return layer;
  },
  show(screen: Screen): void {
    current = screen;
    closers.length = 0;
    layer.replaceChildren();
    router.rebuild();
  },
  /** 같은 화면을 다시 그린다 (스크롤 위치는 유지). */
  rebuild(): void {
    if (!current) return;
    layer.querySelectorAll('.coach').forEach((e) => e.remove());
    const scrolls = [...view.querySelectorAll<HTMLElement>('.scroll')].map((e) => e.scrollTop);
    applyTextScale();
    view.replaceChildren(current.build());
    view.querySelectorAll<HTMLElement>('.scroll').forEach((e, i) => {
      if (scrolls[i]) e.scrollTop = scrolls[i];
    });
    current.afterShow();
  },
  /** 뒤로 가기: 열린 팝업을 먼저 닫고, 없으면 화면에 맡긴다. */
  back(): boolean {
    const top = closers[closers.length - 1];
    if (top) return top();
    return current?.onBack() ?? false;
  },
  pushCloser(fn: () => boolean): () => void {
    closers.push(fn);
    return () => {
      const i = closers.indexOf(fn);
      if (i >= 0) closers.splice(i, 1);
    };
  },
};

export function applyTextScale(): void {
  document.documentElement.style.setProperty('--text-scale', String(settings.textScale));
}

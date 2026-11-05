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
  /** 화면을 그릴 때마다 (승급 알림처럼 어느 화면에서든 띄울 팝업). main.ts가 정한다. */
  onRender: null as (() => void) | null,
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
    fitIllust();
    view.querySelectorAll<HTMLElement>('.scroll').forEach((e, i) => {
      if (scrolls[i]) e.scrollTop = scrolls[i];
    });
    current.afterShow();
    router.onRender?.();
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

/** 시설·등록 일러스트(.illust.npc, 200px): 그림의 인물 얼굴이 대사 상자 위 빈 곳 가운데에 오게 그림 위치를 맞춘다 (그림은 cover로 깔리므로 넘치는 만큼만 위아래로 옮길 수 있다). */
function fitIllust(): void {
  const ill = view?.querySelector<HTMLElement>('.illust.npc');
  const face = Number(ill?.dataset.face), ratio = Number(ill?.dataset.ratio);
  if (!ill || !face || !ratio) return;
  const W = ill.clientWidth, H = ill.clientHeight, zoom = Number(ill.dataset.zoom) || 1, imgH = Math.max(H, W / ratio) * zoom;
  if (zoom !== 1) ill.style.backgroundSize = `${Math.round(imgH * ratio)}px ${Math.round(imgH)}px`;
  // 대사 상자 위로 이름표가 16px쯤 솟아 있다
  const top = (ill.querySelector<HTMLElement>('.dialogue')?.offsetTop ?? H) - 16;
  const y = Math.min(0, Math.max(H - imgH, Math.max(14, top / 2) - face * imgH));
  ill.style.backgroundPosition = `center ${Math.round(y)}px`;
}
if (typeof window !== 'undefined') window.addEventListener('resize', () => fitIllust());

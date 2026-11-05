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

/**
 * 시설 일러스트(.illust.npc, 기준 2:1)는 아래 목록이 넘치는 만큼 줄어든다 (최소 112px) — 화면이 스크롤 없이 한눈에 보이게.
 * 그래도 넘치면(아주 낮은 화면) 목록만 스크롤된다.
 */
function fitIllust(): void {
  const ill = view?.querySelector<HTMLElement>('.illust.npc');
  if (!ill) return;
  ill.style.height = '';
  const list = ill.parentElement?.querySelector<HTMLElement>(':scope > .scroll');
  const over = list ? list.scrollHeight - list.clientHeight : 0;
  if (over > 0) ill.style.height = `${Math.max(112, ill.offsetHeight - over)}px`;
  // 얼굴을 대사 상자 위 빈 곳 가운데에 둔다 (그림은 cover로 깔리므로 넘치는 만큼만 위아래로 옮길 수 있다)
  const face = Number(ill.dataset.face), ratio = Number(ill.dataset.ratio);
  if (!face || !ratio) return;
  const W = ill.clientWidth, H = ill.clientHeight, imgH = Math.max(H, W / ratio);
  const top = ill.querySelector<HTMLElement>('.dialogue')?.offsetTop ?? H;
  const y = Math.min(0, Math.max(H - imgH, Math.max(14, top / 2) - face * imgH));
  ill.style.backgroundPosition = `center ${Math.round(y)}px`;
}
if (typeof window !== 'undefined') window.addEventListener('resize', () => fitIllust());

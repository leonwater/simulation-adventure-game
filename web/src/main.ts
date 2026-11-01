import { router } from './ui/router';
import * as screens from './screens';
import { goTitle, goToCurrent } from './screens';
import { navigate } from './screens/nav';
import { InventoryScreen } from './screens/inventory';
import { S } from './ui/game';
import * as items from './core/items';

// 화면 높이 고정: 이름 입력 등으로 키보드가 올라와 창 높이가 줄어도 화면을 줄이지 않는다 (폭이 바뀌면 다시 잰다)
let lastWidth = 0;
const fitHeight = (): void => {
  const typing = document.activeElement instanceof HTMLInputElement;
  if (typing && window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`);
};
fitHeight();
window.addEventListener('resize', fitHeight);

router.mount(document.getElementById('app')!);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') router.back();
});
goTitle();

// 화면 확인용: 주소 끝에 ?debug 를 붙이면 콘솔에서 게임 상태(__S)를 만질 수 있다.
if (location.search.includes('debug')) {
  (window as unknown as { __S: typeof S }).__S = S;
  (window as unknown as { __go: () => void }).__go = goToCurrent;
  // 화면 점검 도구(scripts/layout.mjs)가 화면을 직접 연다
  Object.assign(window, { __items: items, __screens: screens, __nav: navigate, __router: router, __bag: () => router.show(new InventoryScreen(true)) });
}

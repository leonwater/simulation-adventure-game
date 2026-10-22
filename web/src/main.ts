import { router } from './ui/router';
import { goTitle, goToCurrent } from './screens';
import { S } from './ui/game';

router.mount(document.getElementById('app')!);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') router.back();
});
goTitle();

// 화면 확인용: 주소 끝에 ?debug 를 붙이면 콘솔에서 게임 상태(__S)를 만질 수 있다.
if (location.search.includes('debug')) {
  (window as unknown as { __S: typeof S }).__S = S;
  (window as unknown as { __go: () => void }).__go = goToCurrent;
}

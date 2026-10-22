import { router } from './ui/router';
import { goTitle } from './screens';

router.mount(document.getElementById('app')!);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') router.back();
});
goTitle();

import { router } from '../ui/router';
import { toast } from '../ui/overlay';

export type Dest = 'town' | 'character' | 'inventory' | 'skills' | 'guild' | 'shop' | 'blacksmith' | 'training';

/** 화면 이동. 아직 옮기지 않은 화면은 안내만 보인다. 화면을 하나 옮길 때마다 여기에 연결한다. */
export function navigate(dest: Dest): void {
  void import('./index').then(async (m) => {
    switch (dest) {
      case 'town':
        return m.goTown();
      default:
        toast('이 화면은 아직 옮기는 중입니다');
        void router;
    }
  });
}

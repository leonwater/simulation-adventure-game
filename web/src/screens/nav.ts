import { toast } from '../ui/overlay';
import { router } from '../ui/router';
import { CharacterScreen } from './character';
import { goTown } from './index';
import { InventoryScreen } from './inventory';
import { SkillsScreen } from './skills';

export type Dest = 'town' | 'character' | 'inventory' | 'skills' | 'guild' | 'shop' | 'blacksmith' | 'training';

/** 화면 이동. 화면을 하나 옮길 때마다 여기에 연결한다 (아직 옮기지 않은 화면은 안내만 보인다). */
export function navigate(dest: Dest): void {
  switch (dest) {
    case 'town': return goTown();
    case 'character': return router.show(new CharacterScreen());
    case 'inventory': return router.show(new InventoryScreen());
    case 'skills': return router.show(new SkillsScreen());
    default: toast('이 화면은 아직 옮기는 중입니다');
  }
}

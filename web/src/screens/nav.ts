import { router } from '../ui/router';
import { BlacksmithScreen } from './blacksmith';
import { CharacterScreen } from './character';
import { GuildScreen } from './guild';
import { goTown } from './index';
import { InventoryScreen } from './inventory';
import { ShopScreen } from './shop';
import { SkillsScreen } from './skills';
import { TrainingScreen } from './training';

export type Dest = 'town' | 'character' | 'inventory' | 'skills' | 'guild' | 'shop' | 'blacksmith' | 'training';

/** 화면 이동. 화면을 하나 옮길 때마다 여기에 연결한다 (아직 옮기지 않은 화면은 안내만 보인다). */
export function navigate(dest: Dest): void {
  switch (dest) {
    case 'town': return goTown();
    case 'character': return router.show(new CharacterScreen());
    case 'inventory': return router.show(new InventoryScreen());
    case 'skills': return router.show(new SkillsScreen());
    case 'guild': return router.show(new GuildScreen());
    case 'shop': return router.show(new ShopScreen());
    case 'blacksmith': return router.show(new BlacksmithScreen());
    case 'training': return router.show(new TrainingScreen());
  }
}

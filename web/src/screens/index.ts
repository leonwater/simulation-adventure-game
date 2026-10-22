import { S } from '../ui/game';
import { router } from '../ui/router';
import { TownScreen } from './town';
import { TitleScreen } from './title';

export const goTitle = (): void => router.show(new TitleScreen());
export const goTown = (): void => router.show(new TownScreen());

/** 지금 게임 상태에 맞는 화면으로 간다 (던전 안이면 전투·이벤트·탐험, 아니면 마을). */
export function goToCurrent(): void {
  if (!S.hasGame) return goTitle();
  if (!S.inDungeon) return goTown();
  // 던전 화면은 P2d~e에서 연결한다
  goTown();
}

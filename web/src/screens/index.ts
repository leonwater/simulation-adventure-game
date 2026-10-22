import { S } from '../ui/game';
import { router } from '../ui/router';
import { BattleScreen } from './battle';
import { DungeonScreen } from './dungeon';
import { EventScreen } from './event';
import { MerchantScreen } from './merchant';
import type { ResultKind } from './result';
import { ResultScreen } from './result';
import { TitleScreen } from './title';
import { TownScreen } from './town';

export const goTitle = (): void => router.show(new TitleScreen());
export const goTown = (): void => router.show(new TownScreen());
export const goDungeon = (levelUp = false): void => router.show(new DungeonScreen(levelUp));
export const goBattle = (): void => router.show(new BattleScreen());
export const goEvent = (): void => router.show(new EventScreen());
export const goMerchant = (): void => router.show(new MerchantScreen());
export const goResult = (kind: ResultKind): void => router.show(new ResultScreen(kind));

/** 지금 게임 상태에 맞는 화면으로 간다 (던전 안이면 전투·이벤트·탐험, 아니면 마을). */
export function goToCurrent(): void {
  if (!S.hasGame) return goTitle();
  if (!S.inDungeon) return goTown();
  if (S.battle) return goBattle();
  if (S.pendingEvent) return goEvent();
  goDungeon();
}

import { themeFor } from '../core/monsters';
import { dungeonHeader } from './chrome';
import { S } from './game';
import { openPauseMenu } from './pause';

/** 던전 안의 모든 화면(전투 제외)이 같이 쓰는 위쪽 줄: 층·테마 · 이름 · 직업 · Lv · 경험치 막대 · HP · 일시정지. */
export function dungeonTop(): HTMLElement {
  const floor = S.run?.Floor ?? 1;
  return dungeonHeader(`${floor}층 · ${themeFor(floor).Name}`, S.c, () => openPauseMenu());
}

import { GameSession } from '../core/session';
import { LocalSaveStore } from '../core/save';

/** 앱 전체가 쓰는 게임 진행 객체. */
export const S = new GameSession(new LocalSaveStore());

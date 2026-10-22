import { isQuestComplete } from '../core/guild';
import { S } from './game';

/** 빨간 알림 점 조건: 남은 포인트, 새 스킬, 완료 퀘스트, 상점 갱신 (승급은 자동). */
export const alerts = {
  get points(): boolean { return S.hasGame && S.c.UnspentPoints > 0; },
  get newSkill(): boolean { return S.hasGame && S.hasUnseenSkill; },
  get questDone(): boolean { return S.hasGame && S.data!.Guild.Active.some((q) => isQuestComplete(q, S.c)); },
  /** 보고할 퀘스트가 있거나, 보스를 잡아 새 층 의뢰가 붙었는데 아직 길드에 가 보지 않았을 때. */
  get guild(): boolean { return this.questDone || (S.hasGame && S.guildNewQuests); },
  get shop(): boolean { return S.hasGame && S.shopUnseen; },
  get town(): boolean { return this.guild || this.shop; },
  /** 하단 메뉴 순서 (0 마을 · 1 캐릭터 · 2 가방 · 3 스킬). */
  nav(index: number): boolean {
    switch (index) {
      case 0: return this.town;
      case 1: return this.points;
      case 3: return this.newSkill;
      default: return false;
    }
  },
};

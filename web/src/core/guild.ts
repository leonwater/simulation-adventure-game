import { B, enemyExp, roundEven } from './balance';
import type { Character } from './character';
import { addExp, maxChallengeFloor } from './character';
import type { QuestKind, Rank } from './enums';
import { RANKS, ord } from './enums';
import { addItem, canAdd, countOf, findItem, newUid, removeTemplate, takeItem } from './items';
import { monster, themeFor } from './monsters';
import type { Rng } from './rng';

export interface Quest {
  Id: string;
  Kind: QuestKind;
  Title: string;
  Rank: Rank;
  TargetFloor: number;
  SpeciesId: string;
  MaterialId: string;
  Required: number;
  Progress: number;
  RewardGold: number;
  RewardExp: number;
}
export interface GuildState {
  Board: Quest[];
  Active: Quest[];
}
export const newGuildState = (): GuildState => ({ Board: [], Active: [] });

const rk = (r: Rank): number => ord(RANKS, r);
export const minQuestRank = (own: Rank): Rank => (own === 'F' ? 'F' : RANKS[rk(own) - 1]);
export const maxQuestRank = (own: Rank): Rank => (own === 'SS' ? 'SS' : RANKS[rk(own) + 1]);
export const inRange = (own: Rank, quest: Rank): boolean => rk(quest) >= rk(minQuestRank(own)) && rk(quest) <= rk(maxQuestRank(own));

/** 다음에 도전할 층을 목표로 하는 퀘스트는 게시판에 최소 이만큼. */
export const NEXT_FLOOR_QUESTS = 2;

/** 같은 퀘스트인지 가르는 열쇠: 종류 + 대상. */
export function questKey(q: Quest): string {
  switch (q.Kind) {
    case 'Hunt': return `hunt:${q.SpeciesId}`;
    case 'Collect': return `collect:${q.MaterialId}`;
    default: return `conquer:${q.TargetFloor}`;
  }
}

/** 퀘스트 난이도 = 목표 층 + 종류 보정. */
export function questDifficulty(q: Quest): number {
  switch (q.Kind) {
    case 'Conquer': return q.TargetFloor + 2;
    case 'Hunt': return q.TargetFloor + (q.Required - 3) * 0.5;
    default: return q.TargetFloor + (q.Required - 2) * 0.5 - 1;
  }
}

/** 난이도 → 등급. 경계는 승급 조건의 돌파 층과 같다. */
export function rankFor(difficulty: number): Rank {
  let r: Rank = 'F';
  for (let i = 1; i < RANKS.length; i++) if (difficulty >= B.PromotionRequirements[i * 3]) r = RANKS[i];
  return r;
}

const REWARD_FLOOR = [1, 4, 8, 12, 17, 22, 26, 29];
/** 등급 보상 범위: 골드 (60 + 기준 층 × 40) × 1.5, 경험치 적 1마리 × 4, 각각 ±15% 무작위. */
export function rollReward(q: Quest, rng: Rng): void {
  const f = REWARD_FLOOR[rk(q.Rank)];
  q.RewardGold = roundEven((60 + f * 40) * 1.5 * (0.85 + rng.nextDouble() * 0.3));
  q.RewardExp = roundEven(enemyExp(f) * 4 * (0.85 + rng.nextDouble() * 0.3));
}

/** 정한 층·종류의 퀘스트. 등급은 난이도로 정하고, 보상은 그 등급 범위에서 무작위. */
export function createQuest(_c: Character, rng: Rng, floor: number, kind: QuestKind): Quest {
  const q: Quest = {
    Id: newUid(), Kind: kind, Title: '', Rank: 'F', TargetFloor: floor, SpeciesId: '', MaterialId: '', Required: 0, Progress: 0, RewardGold: 0, RewardExp: 0,
  };
  const species = monster(rng.pick(themeFor(floor).SpeciesIds))!;
  switch (kind) {
    case 'Conquer':
      q.Required = 1;
      q.Title = `${floor}층 보스 토벌`;
      break;
    case 'Hunt':
      q.SpeciesId = species.Id;
      q.Required = rng.rangeInclusive(3, 6);
      q.Title = `${species.Name} 토벌`;
      break;
    default:
      q.SpeciesId = species.Id;
      q.MaterialId = species.MaterialId ?? '';
      q.Required = rng.rangeInclusive(2, 5);
      q.Title = `${species.MaterialName} 채집`;
      break;
  }
  q.Rank = rankFor(questDifficulty(q));
  rollReward(q, rng);
  return q;
}

/** 무작위 퀘스트 하나: 도전 가능 층에서 4층 아래까지, 종류는 보스 2 · 토벌 4 · 채집 4 비율. */
export function generateQuest(c: Character, rng: Rng): Quest {
  const top = Math.max(1, maxChallengeFloor(c));
  const floor = Math.max(1, top - rng.rangeInclusive(0, 4));
  const roll = rng.range(0, 10);
  const kind: QuestKind = roll < 2 ? 'Conquer' : roll < 6 ? 'Hunt' : 'Collect';
  return createQuest(c, rng, floor, kind);
}

/**
 * 게시판을 새로 채운다 (마을로 돌아올 때마다, 보스를 잡은 뒤에는 새 층 의뢰가 붙는다).
 * 1) 다음에 도전할 층의 퀘스트 2개 2) 나머지는 수락할 수 있는 등급만. 같은 대상의 퀘스트는 하나만.
 */
export function refreshBoard(g: GuildState, c: Character, rng: Rng): void {
  g.Board = [];
  const used = new Set<string>(g.Active.map(questKey));
  const next = Math.max(1, maxChallengeFloor(c));
  let nextCount = g.Active.filter((q) => q.TargetFloor === next).length;
  const kinds: QuestKind[] = ['Conquer', 'Hunt', 'Collect'];
  rng.shuffle(kinds);
  for (let pass = 0; pass < 2 && nextCount < NEXT_FLOOR_QUESTS; pass++) {
    for (const kind of kinds) {
      if (nextCount >= NEXT_FLOOR_QUESTS) break;
      for (let tries = 0; tries < 6; tries++) {
        const q = createQuest(c, rng, next, kind);
        if ((pass === 0 && !inRange(c.Rank, q.Rank)) || used.has(questKey(q))) continue;
        used.add(questKey(q));
        g.Board.push(q);
        nextCount++;
        break;
      }
    }
  }
  for (let tries = 0; g.Board.length < B.QuestBoardSize && tries < 80; tries++) {
    const q = generateQuest(c, rng);
    if (inRange(c.Rank, q.Rank) && !used.has(questKey(q))) {
      used.add(questKey(q));
      g.Board.push(q);
    }
  }
  g.Board.sort((a, b) => (b.Rank !== a.Rank ? rk(b.Rank) - rk(a.Rank) : b.TargetFloor - a.TargetFloor));
}

export function goalText(q: Quest): string {
  switch (q.Kind) {
    case 'Hunt': return `${q.Required}마리 처치`;
    case 'Collect': return `${q.Required}개 채집`;
    default: return '보스 처치';
  }
}

export function progressText(q: Quest, c: Character): string {
  switch (q.Kind) {
    case 'Hunt': return `진행 ${Math.min(q.Progress, q.Required)}/${q.Required} 처치`;
    case 'Collect': return `보유 ${Math.min(countOf(c.Inventory, q.MaterialId), q.Required)}/${q.Required}개`;
    default: return q.Progress >= q.Required ? '보스 처치 완료' : '보스 미처치';
  }
}

export function cannotAcceptReason(g: GuildState, c: Character, q: Quest | undefined): string | null {
  if (!q) return '없는 퀘스트입니다';
  if (g.Active.length >= B.MaxActiveQuests) return `동시에 ${B.MaxActiveQuests}개까지 수락할 수 있습니다`;
  if (!inRange(c.Rank, q.Rank)) return `${minQuestRank(c.Rank)} ~ ${maxQuestRank(c.Rank)} 등급만 수락할 수 있습니다`;
  return null;
}

export function acceptQuest(g: GuildState, c: Character, questId: string): { ok: boolean; error: string | null } {
  const q = g.Board.find((x) => x.Id === questId);
  const error = cannotAcceptReason(g, c, q);
  if (error || !q) return { ok: false, error };
  g.Board.splice(g.Board.indexOf(q), 1);
  g.Active.push(q);
  return { ok: true, error: null };
}

export function abandonQuest(g: GuildState, questId: string): boolean {
  const n = g.Active.length;
  g.Active = g.Active.filter((q) => q.Id !== questId);
  return g.Active.length < n;
}

export function onEnemyKilled(g: GuildState, speciesId: string, floor: number): void {
  for (const q of g.Active) if (q.Kind === 'Hunt' && q.SpeciesId === speciesId && floor >= q.TargetFloor) q.Progress++;
}
export function onBossKilled(g: GuildState, floor: number): void {
  for (const q of g.Active) if (q.Kind === 'Conquer' && q.TargetFloor === floor) q.Progress = q.Required;
}

export function isQuestComplete(q: Quest, c: Character): boolean {
  if (q.Kind === 'Collect') return countOf(c.Inventory, q.MaterialId) >= q.Required;
  return q.Progress >= q.Required;
}

/** 완료한 퀘스트를 보고하고 보상을 받는다. 오른 레벨 수를 levelsGained로 돌려준다. */
export function turnInQuest(g: GuildState, c: Character, questId: string): { ok: boolean; levelsGained: number; error: string | null } {
  const q = g.Active.find((x) => x.Id === questId);
  if (!q) return { ok: false, levelsGained: 0, error: '진행 중인 퀘스트가 아닙니다' };
  if (!isQuestComplete(q, c)) return { ok: false, levelsGained: 0, error: '아직 완료하지 않았습니다' };
  if (q.Kind === 'Collect') removeTemplate(c.Inventory, q.MaterialId, q.Required);
  g.Active.splice(g.Active.indexOf(q), 1);
  c.Gold += q.RewardGold;
  const levelsGained = addExp(c, q.RewardExp);
  c.QuestsCompleted++;
  return { ok: true, levelsGained, error: null };
}

// ── 창고: 맡길 때마다 수수료, 찾을 때는 무료 ──

export const storageFee = (c: Character): number => 10 + c.HighestFloorCleared * 5;

export function deposit(c: Character, uid: string): { ok: boolean; error: string | null } {
  const item = findItem(c.Inventory, uid);
  if (!item) return { ok: false, error: '가방에 없는 아이템입니다' };
  if (!canAdd(c.Storage, item)) return { ok: false, error: '창고가 가득 찼습니다' };
  const fee = storageFee(c);
  if (c.Gold < fee) return { ok: false, error: `수수료 ${fee}G가 부족합니다` };
  c.Gold -= fee;
  addItem(c.Storage, takeItem(c.Inventory, uid));
  return { ok: true, error: null };
}

export function withdraw(c: Character, uid: string): { ok: boolean; error: string | null } {
  const item = findItem(c.Storage, uid);
  if (!item) return { ok: false, error: '창고에 없는 아이템입니다' };
  if (!canAdd(c.Inventory, item)) return { ok: false, error: '가방이 가득 찼습니다' };
  addItem(c.Inventory, takeItem(c.Storage, uid));
  return { ok: true, error: null };
}


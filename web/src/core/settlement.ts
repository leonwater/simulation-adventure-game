import { applyDeathExpLoss, expProgress, maxHp } from './character';
import type { Character } from './character';
import { B, roundEven } from './balance';
import type { Difficulty } from './enums';
import type { ItemInstance } from './items';
import type { DungeonRun } from './dungeon';

export interface DeathReport {
  Floor: number;
  KilledBy: string;
  GoldLost: number;
  ExpLost: number;
  ItemsLost: ItemInstance[];
  EquippedKept: number;
  HardcoreReset: boolean;
  // 패배 화면 비교표 (이전 → 현재)
  GoldBefore: number; GoldAfter: number;
  ExpPctBefore: number; ExpPctAfter: number;
  BagBefore: number; BagAfter: number;
  RoomsExplored: number; RoomsTotal: number;
  StorageCount: number;
}

export interface ReturnReport {
  Floor: number;
  BossCleared: boolean;
  GoldEarned: number;
  ExpEarned: number;
  Rooms: number;
  Loot: string[];
}

/**
 * 사망 (하드코어 제외): 도달 층 유지, 그 층 진행도 초기화, 골드 -30%, 경험치 -20% (레벨 유지),
 * 장착하지 않은 가방 아이템 전부 손실. 창고와 가방 확장은 유지.
 */
export function die(c: Character, run: DungeonRun | null, difficulty: Difficulty, killedBy: string): DeathReport {
  const explored = run ? run.Map.Rooms.filter((r) => r.Visited && r.Type !== 'Start').length : 0;
  const report: DeathReport = {
    Floor: run?.Floor ?? 0, KilledBy: killedBy ?? '', GoldLost: 0, ExpLost: 0, ItemsLost: [], EquippedKept: 0, HardcoreReset: false,
    GoldBefore: c.Gold, GoldAfter: 0, ExpPctBefore: expProgress(c), ExpPctAfter: 0, BagBefore: c.Inventory.Items.length, BagAfter: 0,
    RoomsExplored: explored, RoomsTotal: run ? run.Map.Rooms.length - 1 : 0, StorageCount: c.Storage.Items.length,
  };
  if (difficulty === 'Hardcore') {
    report.HardcoreReset = true;
    return report;
  }
  report.GoldLost = roundEven(c.Gold * B.DeathGoldLoss);
  c.Gold -= report.GoldLost;
  report.ExpLost = applyDeathExpLoss(c);
  report.ItemsLost.push(...c.Inventory.Items);
  c.Inventory.Items = [];
  report.EquippedKept = c.Equipment.Slots.filter((s) => s != null).length;
  c.CurrentHp = maxHp(c);
  report.GoldAfter = c.Gold;
  report.ExpPctAfter = expProgress(c);
  report.BagAfter = c.Inventory.Items.length;
  return report;
}

/** 마을 귀환. 보스 클리어 후면 다음 층이 열려 있고, 그 외에는 그 층 진행도만 초기화된다. */
export function returnToTown(c: Character, run: DungeonRun): ReturnReport {
  const report: ReturnReport = {
    Floor: run.Floor, BossCleared: run.BossDefeated, GoldEarned: run.GoldEarned, ExpEarned: run.ExpEarned,
    Rooms: run.Map.Rooms.filter((r) => r.Visited && r.Type !== 'Start').length, Loot: [...run.Loot],
  };
  c.CurrentHp = maxHp(c);
  return report;
}

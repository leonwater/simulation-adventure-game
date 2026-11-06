import { B } from './balance';
import type { Character, SkillState } from './character';
import { defaultSlot, equipped, findEquipped, maxHp, setEquipped, skillSlots, slotFits } from './character';
import type { EquipSlot, GearType, Stat } from './enums';
import { JOBS, RANKS, TIERS, ord } from './enums';
import type { ItemInstance } from './items';
import {
  ENHANCE_STONE_ID, addItem, canAdd, canBeUsedBy, countOf, findItem, goldCost, isAccessory, isWeapon, itemValue,
  removeTemplate, stoneCost, takeItem,
} from './items';
import { jobData } from './jobs';
import { Names } from './names';
import type { Rng } from './rng';
import type { SkillDef } from './skills';
import { isUtility, skillCooldown, skillDef, skillTurns } from './skills';

// ── 장비 착용·해제 ───────────────────────────────────────

export interface StatDelta {
  label: string;
  delta: number;
}

export const isMainStat = (c: Character, stat: Stat): boolean => jobData(c.Job).mainStats.includes(stat);

/** 장신구 a가 b보다 좋으면 양수: 주요 능력치 우선, 같으면 수치. */
export function compareAccessories(c: Character, a: ItemInstance, b: ItemInstance): number {
  const ma = isMainStat(c, a.BonusStat);
  const mb = isMainStat(c, b.BonusStat);
  if (ma !== mb) return ma ? 1 : -1;
  return Math.sign(itemValue(a) - itemValue(b));
}

/** 이 장비를 낄 칸. 반지는 빈 칸을 먼저 쓰고, 둘 다 차 있으면 덜 중요한 반지를 바꾼다. */
export function slotFor(c: Character, gear: GearType): EquipSlot {
  if (gear !== 'Ring') return defaultSlot(gear);
  const r1 = equipped(c, 'Ring1');
  const r2 = equipped(c, 'Ring2');
  if (!r1) return 'Ring1';
  if (!r2) return 'Ring2';
  return compareAccessories(c, r1, r2) <= 0 ? 'Ring1' : 'Ring2';
}

/** 이 장비를 끼면 바뀌는 장비. 빈 칸이면 null. */
export function replacedBy(c: Character, item: ItemInstance | null): ItemInstance | null {
  if (!item || item.Kind !== 'Equipment') return null;
  const cur = equipped(c, slotFor(c, item.Gear));
  return cur && cur.Uid === item.Uid ? null : cur;
}

/** 지금 낀 장비와 비교한 수치 변화 (착용 중인 같은 장비면 빈 목록). */
export function compare(c: Character, item: ItemInstance | null): StatDelta[] {
  const list: StatDelta[] = [];
  if (!item || item.Kind !== 'Equipment' || findEquipped(c, item.Uid)) return list;
  const cur = replacedBy(c, item);
  if (isAccessory(item)) {
    if (cur && cur.BonusStat === item.BonusStat) list.push({ label: Names.stat(item.BonusStat), delta: itemValue(item) - itemValue(cur) });
    else {
      list.push({ label: Names.stat(item.BonusStat), delta: itemValue(item) });
      if (cur) list.push({ label: Names.stat(cur.BonusStat), delta: -itemValue(cur) });
    }
    return list;
  }
  list.push({ label: isWeapon(item) ? '공격력' : '방어력', delta: itemValue(item) - (cur ? itemValue(cur) : 0) });
  return list;
}

/** 아이템 칸에 쓰는 한 줄 판정. */
export function summary(c: Character, item: ItemInstance): StatDelta | null {
  const list = compare(c, item);
  if (list.length <= 1) return list.length === 1 ? list[0] : null;
  const cur = replacedBy(c, item)!;
  const mi = isMainStat(c, item.BonusStat);
  const mc = isMainStat(c, cur.BonusStat);
  if (mi && !mc) return list[0];
  if (!mi && mc) return list[1];
  const d = itemValue(item) - itemValue(cur);
  return { label: d >= 0 ? list[0].label : list[1].label, delta: d };
}

export function cannotEquipReason(c: Character, item: ItemInstance | undefined | null): string | null {
  if (!item || item.Kind !== 'Equipment') return '장비가 아닙니다';
  if (!canBeUsedBy(item, c.Job)) return `${Names.job(JOBS[item.JobRestriction])} 전용입니다`;
  if (c.Level < item.LevelReq) return `Lv.${item.LevelReq} 이상 착용 가능`;
  return null;
}

const clampHp = (c: Character): void => {
  c.CurrentHp = Math.min(c.CurrentHp, maxHp(c));
};

/** 가방의 장비를 착용한다. 원래 끼던 장비는 가방으로 돌아간다. */
export function equip(c: Character, uid: string, slot?: EquipSlot): { ok: boolean; error: string | null } {
  const item = findItem(c.Inventory, uid);
  const error = cannotEquipReason(c, item);
  if (error || !item) return { ok: false, error };
  const target = slot ?? slotFor(c, item.Gear);
  if (!slotFits(item.Gear, target)) return { ok: false, error: '맞지 않는 슬롯입니다' };
  takeItem(c.Inventory, uid);
  const old = equipped(c, target);
  setEquipped(c, target, item);
  if (old) addItem(c.Inventory, old);
  clampHp(c);
  return { ok: true, error: null };
}

export function unequip(c: Character, slot: EquipSlot): { ok: boolean; error: string | null } {
  const item = equipped(c, slot);
  if (!item) return { ok: false, error: '비어 있는 슬롯입니다' };
  if (!canAdd(c.Inventory, item)) return { ok: false, error: '가방이 가득 찼습니다' };
  setEquipped(c, slot, null);
  addItem(c.Inventory, item);
  clampHp(c);
  return { ok: true, error: null };
}

// ── 대장간 강화 ──────────────────────────────────────────

export type EnhanceResult = 'Success' | 'Failed' | 'Downgraded' | 'NotAllowed';

export const successRate = (i: ItemInstance): number => (i.Enhance >= B.MaxEnhance ? 0 : B.EnhanceSuccess[i.Enhance + 1]);
export const downgradeChance = (i: ItemInstance): number =>
  i.Enhance >= B.MaxEnhance ? 0 : i.Enhance + 1 >= 11 ? 0.5 : i.Enhance + 1 >= 7 ? 0.3 : 0;

/** 장착 중이거나 가방에 있는 장비를 찾는다. */
export function findGear(c: Character, uid: string): ItemInstance | null {
  const item = findEquipped(c, uid) ?? findItem(c.Inventory, uid);
  return item && item.Kind === 'Equipment' ? item : null;
}

export function cannotEnhanceReason(c: Character, item: ItemInstance | null): string | null {
  if (!item || item.Kind !== 'Equipment') return '장비가 아닙니다';
  if (item.Enhance >= B.MaxEnhance) return '최대 강화 단계입니다';
  if (c.Gold < goldCost(item)) return '골드가 부족합니다';
  if (countOf(c.Inventory, ENHANCE_STONE_ID) < stoneCost(item)) return '강화석이 부족합니다';
  return null;
}

export function enhance(c: Character, uid: string, rng: Rng): { result: EnhanceResult; error: string | null } {
  const item = findGear(c, uid);
  const error = cannotEnhanceReason(c, item);
  if (error || !item) return { result: 'NotAllowed', error };
  c.Gold -= goldCost(item);
  const stones = stoneCost(item);
  if (stones > 0) removeTemplate(c.Inventory, ENHANCE_STONE_ID, stones);
  if (!rng.chance(successRate(item))) {
    if (!rng.chance(downgradeChance(item))) return { result: 'Failed', error: null };
    item.Enhance--;
    clampHp(c);
    return { result: 'Downgraded', error: null };
  }
  item.Enhance++;
  clampHp(c);
  return { result: 'Success', error: null };
}

// ── 스킬 습득·장착·수련 ──────────────────────────────────

export const getSkillState = (c: Character, id: string): SkillState | undefined => c.Skills.Learned.find((s) => s.SkillId === id);
export const knowsSkill = (c: Character, id: string): boolean => getSkillState(c, id) != null;
export const isSkillEquipped = (c: Character, id: string): boolean => c.Skills.Equipped.includes(id);

/** 수련 배율: 등급이 높을수록 단계마다 많이 오른다 (하급 +8% ~ 최상급 +15%). */
export const powerMultiplier = (def: SkillDef, level: number): number => (isUtility(def) ? 1 : 1 + B.SkillPowerPerLevel[ord(TIERS, def.Tier)] * level);

export function learnSkill(c: Character, skillId: string): boolean {
  const def = skillDef(skillId);
  if (!def || knowsSkill(c, skillId)) return false;
  if (def.JobRestriction >= 0 && def.JobRestriction !== ord(JOBS, c.Job)) return false;
  c.Skills.Learned.push({ SkillId: skillId, Level: 0 });
  return true;
}

/** 가방의 스킬서를 읽어 스킬을 배운다. */
export function useSkillBook(c: Character, uid: string): { ok: boolean; error: string | null } {
  const book = findItem(c.Inventory, uid);
  if (!book || book.Kind !== 'SkillBook') return { ok: false, error: '스킬서가 아닙니다' };
  const def = skillDef(book.SkillId);
  if (!def) return { ok: false, error: '알 수 없는 스킬입니다' };
  if (def.JobRestriction >= 0 && def.JobRestriction !== ord(JOBS, c.Job)) {
    return { ok: false, error: `${Names.job(JOBS[def.JobRestriction])} 전용 스킬입니다` };
  }
  if (knowsSkill(c, def.Id)) return { ok: false, error: '이미 배운 스킬입니다' };
  takeItem(c.Inventory, uid, 1);
  learnSkill(c, def.Id);
  return { ok: true, error: null };
}

export function cannotEquipSkillReason(c: Character, skillId: string): string | null {
  const def = skillDef(skillId);
  if (!def || !knowsSkill(c, skillId)) return '배우지 않은 스킬입니다';
  if (isSkillEquipped(c, skillId)) return '이미 장착했습니다';
  if (c.Level < def.ReqLevel || ord(RANKS, c.Rank) < ord(RANKS, def.ReqRank)) return `장착 조건 Lv.${def.ReqLevel} · ${def.ReqRank} 등급`;
  if (c.Skills.Equipped.length >= skillSlots(c.Rank)) return '장착 슬롯이 가득 찼습니다';
  return null;
}

/** 장착 조건(레벨·등급)만 확인한다. 슬롯 여유는 보지 않는다. */
export const meetsSkillRequirement = (c: Character, def: SkillDef): boolean =>
  c.Level >= def.ReqLevel && ord(RANKS, c.Rank) >= ord(RANKS, def.ReqRank);

export function equipSkill(c: Character, skillId: string): { ok: boolean; error: string | null } {
  const error = cannotEquipSkillReason(c, skillId);
  if (error) return { ok: false, error };
  c.Skills.Equipped.push(skillId);
  return { ok: true, error: null };
}

export function unequipSkill(c: Character, skillId: string): boolean {
  const i = c.Skills.Equipped.indexOf(skillId);
  if (i < 0) return false;
  c.Skills.Equipped.splice(i, 1);
  return true;
}

/** 장착 스킬 순서 바꾸기: from 칸의 스킬을 to 칸으로 옮기고 사이는 한 칸씩 민다. */
export function moveEquippedSkill(c: Character, from: number, to: number): boolean {
  const list = c.Skills.Equipped;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return false;
  const [id] = list.splice(from, 1);
  list.splice(to, 0, id);
  return true;
}

/** 수련 최대 단계: 전투 스킬 5, 비전투 스킬(효과만 거는 스킬) 2. */
export const maxSkillLevel = (def: SkillDef | null): number => (def && isUtility(def) ? B.UtilityMaxSkillLevel : B.MaxSkillLevel);

/** 수련 비용 = 다음 단계 × 200G (비전투 스킬은 × 600G) × 스킬 등급 배율 (하급 1 · 중급 2 · 상급 4 · 최상급 8, v3.17). 최대 단계면 0. */
export function trainingCost(s: SkillState): number {
  const def = skillDef(s.SkillId);
  if (s.Level >= maxSkillLevel(def)) return 0;
  const tier = def ? (B.TrainingTierMult[def.Tier] ?? 1) : 1;
  return (def && isUtility(def) ? B.UtilityTrainingGoldPerLevel : B.TrainingGoldPerLevel) * (s.Level + 1) * tier;
}

/** 수련 효과: 전투 스킬은 단계마다 위력, 비전투 스킬은 1단계 지속 +1턴 · 2단계 재사용 -1턴. */
export function trainingEffect(def: SkillDef, level: number): string {
  if (!isUtility(def)) return `위력 +${Math.round((powerMultiplier(def, level) - 1) * 100)}%`;
  const turns = Math.max(0, ...def.Statuses.map((s) => skillTurns(def, s.Turns, level)));
  return `지속 ${turns}턴 · 재사용 ${skillCooldown(def, level)}턴`;
}

export function trainSkill(c: Character, skillId: string): { ok: boolean; error: string | null } {
  const st = getSkillState(c, skillId);
  if (!st) return { ok: false, error: '배우지 않은 스킬입니다' };
  if (st.Level >= maxSkillLevel(skillDef(skillId))) return { ok: false, error: '최대 강화 단계입니다' };
  const cost = trainingCost(st);
  if (c.Gold < cost) return { ok: false, error: '골드가 부족합니다' };
  c.Gold -= cost;
  st.Level++;
  return { ok: true, error: null };
}

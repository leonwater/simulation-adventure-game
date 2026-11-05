import consumablesJson from '../data/consumables.json';
import monstersJson from '../data/monsters.json';
import { B, clamp, roundEven } from './balance';
import type { GearType, ItemGrade, ItemKind, Job, Stat, StatusType } from './enums';
import { GEARS, GRADES, JOBS, ord } from './enums';
import { jobData, rollItemJob } from './jobs';
import { Names } from './names';
import type { Rng } from './rng';
import { skillDef } from './skills';

/** 아이템 한 칸 (저장 모양 = C# ItemInstance). 소모품·재료·강화석·스킬서는 같은 TemplateId끼리 겹친다. */
export interface ItemInstance {
  Uid: string;
  TemplateId: string;
  Kind: ItemKind;
  Name: string;
  Grade: ItemGrade;
  Gear: GearType;
  /** 무기 = 공격력, 방어구 = 방어력, 장신구 = 능력치 고정 보너스 (강화 전). */
  BaseValue: number;
  BonusStat: Stat;
  LevelReq: number;
  /** -1 = 공용, 그 외 = 직업 번호 */
  JobRestriction: number;
  Enhance: number;
  Count: number;
  Price: number;
  SkillId: string;
}

export const ENHANCE_STONE_ID = 'stone';

export function newUid(): string {
  let s = '';
  for (let i = 0; i < 16; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function blank(): ItemInstance {
  return {
    Uid: newUid(), TemplateId: '', Kind: 'Equipment', Name: '', Grade: 'Common', Gear: 'Helmet', BaseValue: 0,
    BonusStat: 'Vitality', LevelReq: 1, JobRestriction: -1, Enhance: 0, Count: 1, Price: 0, SkillId: '',
  };
}

export const isStackable = (i: ItemInstance): boolean => i.Kind !== 'Equipment';
export const isWeapon = (i: ItemInstance): boolean => i.Kind === 'Equipment' && i.Gear === 'Weapon';
export const isAccessory = (i: ItemInstance): boolean => i.Kind === 'Equipment' && (i.Gear === 'Necklace' || i.Gear === 'Ring');
export const canBeUsedBy = (i: ItemInstance, job: Job): boolean => i.JobRestriction < 0 || i.JobRestriction === ord(JOBS, job);
export const displayName = (i: ItemInstance): string => (i.Enhance > 0 ? `${i.Name} +${i.Enhance}` : i.Name);

/** 강화 단계 e까지 쌓인 보너스 단계 수 (+1~+5는 1씩, +6~+10은 2씩, +11~+15는 3씩 → 높이 갈수록 크게 오른다). */
export function enhanceSteps(e: number): number {
  let sum = 0;
  for (let t = 1; t <= e; t++) sum += B.EnhanceStepWeight[Math.min(t, B.EnhanceStepWeight.length) - 1];
  return sum;
}

/** 강화가 반영된 수치. 강화 1단계마다 기본 수치 × 등급별 2~4% × 단계 가중치 (무기·방어구 최소 +1, 장신구 2단계마다 최소 +1). */
export function valueAt(i: ItemInstance, enhance: number): number {
  const bonus = roundEven(i.BaseValue * B.EnhanceValuePerLevel[ord(GRADES, i.Grade)] * enhanceSteps(enhance));
  const min = isAccessory(i) ? Math.floor((enhance + 1) / 2) : enhance;
  return i.BaseValue + Math.max(bonus, min);
}
export const itemValue = (i: ItemInstance): number => valueAt(i, i.Enhance);

/** 판매가 = 구매가의 50% + 강화에 든 골드의 50%. */
export const sellPrice = (i: ItemInstance): number =>
  Math.max(1, roundEven(i.Price * B.SellRatio + goldSpent(i) * B.EnhanceSellRefund));

export function cloneWithCount(i: ItemInstance, count: number): ItemInstance {
  return { ...i, Uid: newUid(), Count: count };
}

/** 장비 정보 한 줄 (예: "공격력 64 · Lv.12 · 전사 전용"). */
export function statLine(i: ItemInstance): string {
  switch (i.Kind) {
    case 'Equipment': {
      const main = isWeapon(i) ? `공격력 ${itemValue(i)}` : isAccessory(i) ? `${Names.stat(i.BonusStat)} +${itemValue(i)}` : `방어력 ${itemValue(i)}`;
      const job = i.JobRestriction < 0 ? '공용' : `${Names.job(JOBS[i.JobRestriction])} 전용`;
      return `${main} · Lv.${i.LevelReq} · ${job}`;
    }
    case 'Consumable':
      return consumableDef(i.TemplateId)?.Description ?? '';
    case 'SkillBook': {
      const s = skillDef(i.SkillId);
      return s ? `${Names.tier(s.Tier)} 스킬 · ${s.Description}` : '';
    }
    case 'EnhanceStone':
      return '대장간 +6 이상 강화 재료';
    default:
      return '기타 · 퀘스트 납품이나 판매에 쓴다';
  }
}

// ── 아이템 표 ────────────────────────────────────────────

export interface ConsumableDef {
  Id: string;
  Name: string;
  Price: number;
  HealRatio: number;
  Cures: StatusType | null;
  Description: string;
}
export const CONSUMABLES = consumablesJson as unknown as ConsumableDef[];
export const consumableDef = (id: string): ConsumableDef | undefined => CONSUMABLES.find((c) => c.Id === id);

export interface MaterialDef {
  Id: string;
  Name: string;
  Price: number;
}
const MATERIALS = new Map<string, MaterialDef>();
for (const m of monstersJson.Species as any[]) {
  if (m.MaterialId && !MATERIALS.has(m.MaterialId)) {
    MATERIALS.set(m.MaterialId, { Id: m.MaterialId, Name: m.MaterialName, Price: 6 + Math.max(0, m.Tier) * 10 });
  }
}
export const materialDef = (id: string): MaterialDef | undefined => MATERIALS.get(id);

/** 회복 물약 구매가: 층이 깊을수록 비싸진다 (기본가 × (1 + (층-1) × PotionPricePerFloor)). 해독제류는 그대로. */
export function consumableAt(id: string, floor: number, count = 1): ItemInstance {
  const item = createConsumable(id, count);
  if ((consumableDef(id)?.HealRatio ?? 0) > 0) item.Price = roundEven(item.Price * (1 + (Math.max(1, floor) - 1) * B.PotionPricePerFloor));
  return item;
}

/** 상점 강화석 가격 (10층부터 판매). */
export const stonePrice = (floor: number): number => roundEven(B.StonePriceBase + B.StonePricePerFloor * Math.max(1, floor));

export function createConsumable(id: string, count = 1): ItemInstance {
  const d = consumableDef(id);
  if (!d) throw new Error(`unknown consumable ${id}`);
  return { ...blank(), TemplateId: d.Id, Kind: 'Consumable', Name: d.Name, Count: count, Price: d.Price };
}

export function createMaterial(id: string, count = 1): ItemInstance {
  const d = materialDef(id);
  if (!d) throw new Error(`unknown material ${id}`);
  return { ...blank(), TemplateId: d.Id, Kind: 'Material', Name: d.Name, Count: count, Price: d.Price };
}

export const createEnhanceStone = (count = 1): ItemInstance =>
  ({ ...blank(), TemplateId: ENHANCE_STONE_ID, Kind: 'EnhanceStone', Name: '강화석', Grade: 'Rare', Count: count, Price: 120 });

export function createSkillBook(skillId: string, count = 1): ItemInstance {
  const d = skillDef(skillId);
  if (!d) throw new Error(`unknown skill ${skillId}`);
  const tier = ['Low', 'Mid', 'High', 'Top'].indexOf(d.Tier);
  return {
    ...blank(), TemplateId: `book_${skillId}`, Kind: 'SkillBook', Name: `스킬서: ${d.Name}`,
    Grade: GRADES[Math.min(3, tier + 1)], SkillId: skillId, Count: count, Price: B.SkillBookPrice[tier], JobRestriction: d.JobRestriction,
  };
}

// ── 보관함 (가방·창고) ───────────────────────────────────

export interface ItemContainer {
  Items: ItemInstance[];
  Capacity: number;
}
export const newContainer = (capacity: number): ItemContainer => ({ Items: [], Capacity: capacity });
export const freeCells = (c: ItemContainer): number => Math.max(0, c.Capacity - c.Items.length);
export const findItem = (c: ItemContainer, uid: string): ItemInstance | undefined => c.Items.find((i) => i.Uid === uid);

export function countOf(c: ItemContainer, templateId: string): number {
  let n = 0;
  for (const i of c.Items) if (i.TemplateId === templateId) n += i.Count;
  return n;
}

/** 소모품은 종류마다 최대 99개. */
export const overConsumableLimit = (c: ItemContainer, item: ItemInstance): boolean =>
  item.Kind === 'Consumable' && countOf(c, item.TemplateId) + item.Count > B.MaxConsumable;

/** 겹치기를 포함해 아이템을 전부 넣을 수 있는지. */
export function canAdd(c: ItemContainer, item: ItemInstance): boolean {
  if (!isStackable(item)) return freeCells(c) >= 1;
  if (overConsumableLimit(c, item)) return false;
  let remaining = item.Count;
  for (const i of c.Items) if (i.TemplateId === item.TemplateId) remaining -= B.MaxStack - i.Count;
  if (remaining <= 0) return true;
  return freeCells(c) >= Math.floor((remaining + B.MaxStack - 1) / B.MaxStack);
}

/** 전부 넣을 수 있을 때만 넣는다. */
export function addItem(c: ItemContainer, item: ItemInstance | null): boolean {
  if (!item || item.Count <= 0 || !canAdd(c, item)) return false;
  if (!item.Uid) item.Uid = newUid();
  if (!isStackable(item)) {
    c.Items.push(item);
    return true;
  }
  let remaining = item.Count;
  for (const i of c.Items) {
    if (remaining <= 0) break;
    if (i.TemplateId !== item.TemplateId || i.Count >= B.MaxStack) continue;
    const moved = Math.min(remaining, B.MaxStack - i.Count);
    i.Count += moved;
    remaining -= moved;
  }
  if (remaining === item.Count && remaining <= B.MaxStack) {
    c.Items.push(item);
    return true;
  }
  while (remaining > 0) {
    const n = Math.min(remaining, B.MaxStack);
    c.Items.push(cloneWithCount(item, n));
    remaining -= n;
  }
  return true;
}

/** uid 칸에서 count개를 꺼낸다. 꺼낸 아이템(새 인스턴스일 수 있음)을 돌려준다. */
export function takeItem(c: ItemContainer, uid: string, count = Infinity): ItemInstance | null {
  const cell = findItem(c, uid);
  if (!cell) return null;
  if (count >= cell.Count) {
    c.Items.splice(c.Items.indexOf(cell), 1);
    return cell;
  }
  if (count <= 0) return null;
  cell.Count -= count;
  return cloneWithCount(cell, count);
}

/** 같은 종류를 여러 칸에 걸쳐 count개 제거한다. 모자라면 아무것도 하지 않는다. */
export function removeTemplate(c: ItemContainer, templateId: string, count: number): boolean {
  if (countOf(c, templateId) < count) return false;
  for (let idx = c.Items.length - 1; idx >= 0 && count > 0; idx--) {
    const i = c.Items[idx];
    if (i.TemplateId !== templateId) continue;
    const n = Math.min(count, i.Count);
    i.Count -= n;
    count -= n;
    if (i.Count <= 0) c.Items.splice(idx, 1);
  }
  return true;
}

// ── 장비 생성 ────────────────────────────────────────────

const ARMOR_NAMES: string[][] = [
  ['가죽 투구', '철 투구', '강철 투구', '기사 투구', '고대 투구', '영웅의 투구'],
  ['누비 갑옷', '사슬 갑옷', '판금 갑옷', '기사 갑옷', '고대 갑옷', '영웅의 갑옷'],
  ['천 바지', '가죽 바지', '사슬 각반', '강철 각반', '고대 각반', '영웅의 각반'],
  ['여행자 장화', '가죽 장화', '철 장화', '기사 장화', '고대 장화', '영웅의 장화'],
  ['늑대 이빨', '은 목걸이', '수정 목걸이', '비취 목걸이', '고대의 눈', '영웅의 목걸이'],
  ['청동 반지', '은 반지', '금 반지', '루비 반지', '고대 반지', '영웅의 반지'],
];
const WEAPON_NAMES: string[][] = [
  ['낡은 검', '강철 장검', '기사의 장검', '대검', '고대 대검', '영웅의 검'],
  ['짧은 활', '사냥꾼 활', '장궁', '합성궁', '고대 장궁', '영웅의 활'],
  ['낡은 단검', '강철 단검', '쌍날 단검', '암살자의 단검', '고대 단검', '영웅의 단검'],
  ['견습 지팡이', '참나무 지팡이', '수정 지팡이', '현자의 지팡이', '고대 지팡이', '영웅의 지팡이'],
];

/** 장비 기본 수치: 착용 레벨이 오를수록 커진다. 무기 = 공격력, 방어구 = 방어력, 장신구 = 능력치 고정 보너스. */
export function baseValueFor(gear: GearType, lv: number): number {
  switch (gear) {
    case 'Weapon': return 6 + lv * 2.0;
    case 'Helmet': return 1.6 + lv * 0.48;
    case 'Armor': return 3.2 + lv * 0.8;
    case 'Pants': return 2.0 + lv * 0.64;
    case 'Boots': return 1.2 + lv * 0.48;
    default: return 1.0 + lv * 0.12;
  }
}
/**
 * 기본 수치 = 레벨 공식 × 등급 배율(1.0~1.9). 같은 레벨에서 등급이 한 단계 오르면 반올림 때문에 값이 같아지지 않도록
 * 최소 무기 +2 · 그 밖 +1은 오르게 한다 (낮은 레벨 장신구처럼 값이 작은 장비).
 */
export function baseValue(gear: GearType, lv: number, grade: ItemGrade): number {
  const step = gear === 'Weapon' ? B.GradeMinStepWeapon : B.GradeMinStepOther;
  let v = 0;
  for (let g = 0; g <= ord(GRADES, grade); g++) v = Math.max(g === 0 ? 1 : v + step, roundEven(baseValueFor(gear, lv) * B.GradeValueMultiplier[g]));
  return v;
}
export const priceFor = (lv: number, grade: ItemGrade): number =>
  roundEven((40 + lv * 45) * B.GradePriceMultiplier[ord(GRADES, grade)]);

/** 층에 맞는 아이템 레벨 (최대 레벨 60 = 30층 기준, ±2). */
export const itemLevelForFloor = (floor: number, rng: Rng): number =>
  clamp(floor * 2 - 1 + rng.rangeInclusive(-2, 2), 1, B.MaxLevel);

export function createGear(gear: GearType, grade: ItemGrade, itemLevel: number, weaponJob: Job, accessoryStat: Stat): ItemInstance {
  const lv = clamp(itemLevel, 1, B.MaxLevel);
  const tier = Math.min(5, Math.floor(lv / 10));
  const item: ItemInstance = {
    ...blank(), Kind: 'Equipment', Gear: gear, Grade: grade, LevelReq: lv,
    BaseValue: baseValue(gear, lv, grade), Price: priceFor(lv, grade), TemplateId: `eq_${gear}_${tier}`,
  };
  if (gear === 'Weapon') {
    item.JobRestriction = ord(JOBS, weaponJob);
    item.Name = WEAPON_NAMES[ord(JOBS, weaponJob)][tier];
  } else {
    item.Name = ARMOR_NAMES[ord(GEARS, gear)][tier];
    if (isAccessory(item)) item.BonusStat = accessoryStat;
  }
  return item;
}

/** 무작위 장비. 무기 직업·장신구 보너스 능력치는 지금 직업 70%, 다른 세 직업 각 10%. */
export function createRandomGear(rng: Rng, grade: ItemGrade, itemLevel: number, forJob: Job): ItemInstance {
  const gear = rng.pick(GEARS);
  const job = rollItemJob(forJob, rng);
  return createGear(gear, grade, itemLevel, job, rng.pick(jobData(job).allocatable));
}

/** 층에서 나올 수 있는 최고 등급. */
export function maxGradeForFloor(floor: number): ItemGrade {
  let g = 0;
  for (let i = 0; i < B.GradeFirstFloor.length; i++) if (floor >= B.GradeFirstFloor[i]) g = i;
  return GRADES[g];
}

/**
 * 드롭·보상·상점 장비: 층 기준 레벨이 내 레벨보다 높으면 절반 확률로 내 레벨 -0~2로 다시 정하고,
 * 내 레벨보다 낮은 장비는 10% 확률로 한 등급 위 (그 층 최고 등급까지).
 */
export function createDrop(rng: Rng, grade: ItemGrade, floor: number, who: { Level: number; Job: Job }, promote = true): ItemInstance {
  let lv = itemLevelForFloor(floor, rng);
  if (lv > who.Level && rng.chance(B.OverLevelReroll)) lv = clamp(who.Level - rng.rangeInclusive(0, 2), 1, B.MaxLevel);
  let g = ord(GRADES, grade);
  if (promote && lv < who.Level && g < ord(GRADES, maxGradeForFloor(floor)) && rng.chance(B.UnderLevelGradeUp)) g++;
  return createRandomGear(rng, GRADES[g], lv, who.Job);
}

/** 드롭 등급 추첨. bossLevel 0 = 일반 적, 1 = 엘리트, 2 = 보스. */
export function rollDropGrade(rng: Rng, floor: number, bossLevel: number): ItemGrade {
  const weights = bossLevel === 2 ? [0, 30, 40, 22, 8] : bossLevel === 1 ? [20, 40, 28, 10, 2] : [55, 33, 10, 2, 0];
  for (let i = ord(GRADES, maxGradeForFloor(floor)) + 1; i < weights.length; i++) weights[i] = 0;
  if (bossLevel < 2) weights[4] = 0;
  const idx = rng.pickWeighted(weights);
  return idx < 0 ? 'Common' : GRADES[idx];
}

// ── 대장간 비용 ──────────────────────────────────────────

/** 목표 단계 target으로 올리는 골드 = 30 × 목표 단계 × (1 + 착용 레벨 ÷ 10) × 등급 배율 (일반 1 · 고급 1.5 · 희귀 2.5 · 영웅 4 · 전설 6, v3.17). */
const costFor = (item: ItemInstance, target: number): number =>
  roundEven(B.EnhanceGoldBase * target * (1 + item.LevelReq / 10) * B.EnhanceGradeCost[ord(GRADES, item.Grade)]);
export const goldCost = (item: ItemInstance): number => costFor(item, item.Enhance + 1);
export function goldSpent(item: ItemInstance): number {
  let sum = 0;
  for (let t = 1; t <= item.Enhance; t++) sum += costFor(item, t);
  return sum;
}
export const stoneCost = (item: ItemInstance): number => (item.Enhance >= B.MaxEnhance ? 0 : B.EnhanceStones[item.Enhance + 1]);

/** 상점·상인 진열품. Stock: 남은 수량 (-1 = 제한 없음). 마을 소모품은 제한 없음, 스킬서는 1권, 던전 상인 물건은 2~5개. */
export interface ShopGood {
  Item: ItemInstance;
  Stock: number;
}
export const goodUnlimited = (g: ShopGood): boolean => g.Stock < 0;
/** 한 번에 살 수 있는 최대 개수. */
export const goodMaxBuy = (g: ShopGood): number => (g.Stock < 0 ? B.MaxStack : g.Stock);

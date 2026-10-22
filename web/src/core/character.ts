import { B, expToNext, roundEven } from './balance';
import type { EquipSlot, GearType, Job, Rank, Stat } from './enums';
import { RANKS, SLOTS, STATS, ord } from './enums';
import type { ItemContainer, ItemInstance } from './items';
import { addItem, createConsumable, createGear, isAccessory, isWeapon, itemValue, newContainer } from './items';
import type { StatBlock } from './jobs';
import { canAllocate, getStat, jobData, setStat, startingStats } from './jobs';
import { startingSkill } from './skills';

export interface SkillState {
  SkillId: string;
  /** 수련 강화 단계 (0~5). */
  Level: number;
}
export interface SkillSet {
  Learned: SkillState[];
  Equipped: string[];
}
export interface Equipment {
  Slots: (ItemInstance | null)[];
}

/** 모험가 한 명의 영구 데이터. 저장 파일에 그대로 들어간다 (C# Character와 같은 필드 이름). */
export interface Character {
  Name: string;
  Job: Job;
  Level: number;
  Exp: number;
  UnspentPoints: number;
  BaseStats: StatBlock;
  Gold: number;
  Rank: Rank;
  HighestFloorCleared: number;
  QuestsCompleted: number;
  CurrentHp: number;
  Equipment: Equipment;
  Inventory: ItemContainer;
  Storage: ItemContainer;
  Skills: SkillSet;
  BagsBought: number;
}

// ── 등급 ─────────────────────────────────────────────────

export const badgeBonus = (rank: Rank): number => B.BadgeBonus[ord(RANKS, rank)];
export const skillSlots = (rank: Rank): number => B.SkillSlots[ord(RANKS, rank)];
export const storageCapacity = (rank: Rank): number => B.StorageBase + B.StoragePerRank * ord(RANKS, rank);

export interface PromotionStatus {
  next: Rank;
  floorRequired: number; floorCurrent: number;
  levelRequired: number; levelCurrent: number;
  questsRequired: number; questsCurrent: number;
  isMaxRank: boolean;
  floorMet: boolean; levelMet: boolean; questsMet: boolean; canPromote: boolean;
}

export function promotionStatus(c: Character): PromotionStatus {
  const s = {
    next: 'SS' as Rank, floorRequired: 0, floorCurrent: c.HighestFloorCleared, levelRequired: 0, levelCurrent: c.Level,
    questsRequired: 0, questsCurrent: c.QuestsCompleted, isMaxRank: c.Rank === 'SS',
    floorMet: false, levelMet: false, questsMet: false, canPromote: false,
  };
  if (!s.isMaxRank) {
    const idx = ord(RANKS, c.Rank) + 1;
    s.next = RANKS[idx];
    s.floorRequired = B.PromotionRequirements[idx * 3];
    s.levelRequired = B.PromotionRequirements[idx * 3 + 1];
    s.questsRequired = B.PromotionRequirements[idx * 3 + 2];
  }
  s.floorMet = s.floorCurrent >= s.floorRequired;
  s.levelMet = s.levelCurrent >= s.levelRequired;
  s.questsMet = s.questsCurrent >= s.questsRequired;
  s.canPromote = !s.isMaxRank && s.floorMet && s.levelMet && s.questsMet;
  return s;
}

/** 가방·창고 칸 수를 가방 구매 수와 등급에 맞춘다. */
export function recalculateCapacities(c: Character): void {
  c.Inventory.Capacity = Math.min(B.InventoryMax, B.InventoryStart + B.InventoryPerBag * c.BagsBought);
  c.Storage.Capacity = storageCapacity(c.Rank);
}

export function tryPromote(c: Character): boolean {
  const st = promotionStatus(c);
  if (!st.canPromote) return false;
  c.Rank = st.next;
  recalculateCapacities(c);
  return true;
}

// ── 장비 슬롯 ────────────────────────────────────────────

export const equipped = (c: Character, slot: EquipSlot): ItemInstance | null => c.Equipment.Slots[ord(SLOTS, slot)];
export const setEquipped = (c: Character, slot: EquipSlot, item: ItemInstance | null): void => {
  c.Equipment.Slots[ord(SLOTS, slot)] = item;
};
export const findEquipped = (c: Character, uid: string): ItemInstance | undefined =>
  c.Equipment.Slots.find((s) => s != null && s.Uid === uid) ?? undefined;
export const equippedCount = (c: Character): number => c.Equipment.Slots.filter((s) => s != null).length;

export function defaultSlot(gear: GearType): EquipSlot {
  switch (gear) {
    case 'Helmet': return 'Helmet';
    case 'Armor': return 'Armor';
    case 'Pants': return 'Pants';
    case 'Boots': return 'Boots';
    case 'Necklace': return 'Necklace';
    case 'Ring': return 'Ring1';
    default: return 'Weapon';
  }
}
export const slotFits = (gear: GearType, slot: EquipSlot): boolean =>
  gear === 'Ring' ? slot === 'Ring1' || slot === 'Ring2' : defaultSlot(gear) === slot;

// ── 파생 수치 ────────────────────────────────────────────

/** 배지가 적용된 캐릭터 자체 능력치 (장비 제외). */
export const ownStat = (c: Character, stat: Stat): number => Math.floor(getStat(c.BaseStats, stat) * (1 + badgeBonus(c.Rank)));

export function equipmentBonus(c: Character, stat: Stat): number {
  let sum = 0;
  for (const i of c.Equipment.Slots) if (i && isAccessory(i) && i.BonusStat === stat) sum += itemValue(i);
  return sum;
}
export const totalStat = (c: Character, stat: Stat): number => ownStat(c, stat) + equipmentBonus(c, stat);

export const weaponAttack = (c: Character): number => {
  const w = equipped(c, 'Weapon');
  return w ? itemValue(w) : 0;
};
export function armorDefense(c: Character): number {
  let sum = 0;
  for (const i of c.Equipment.Slots) if (i && !isWeapon(i) && !isAccessory(i)) sum += itemValue(i);
  return sum;
}

export const maxHp = (c: Character): number => B.BaseHp + totalStat(c, 'Vitality') * jobData(c.Job).hpPerVitality;
export const attack = (c: Character): number => totalStat(c, jobData(c.Job).attackStat) * B.AttackPerMainStat + weaponAttack(c);
export const defense = (c: Character): number => armorDefense(c);

export function evasion(c: Character): number {
  let e = totalStat(c, 'Agility') * B.EvasionPerAgility;
  if (canAllocate(jobData(c.Job), 'Finesse')) e += totalStat(c, 'Finesse') * B.EvasionPerFinesse;
  return Math.min(B.MaxEvasion, e);
}
export const damageReduction = (c: Character): number => Math.min(B.MaxReduction, totalStat(c, 'Toughness') * B.ReductionPerToughness);
export const resist = (c: Character): number => Math.min(B.MaxResist, totalStat(c, 'Spirit') * B.ResistPerSpirit);
export const skillDamageBonus = (c: Character): number => totalStat(c, 'SpellPower') * B.SkillDamagePerSpellPower;
/** 정밀은 궁수만 배분하지만 장신구로 오른 정밀도 적용된다. */
export const precisionBonus = (c: Character): number =>
  canAllocate(jobData(c.Job), 'Precision') || equipmentBonus(c, 'Precision') > 0 ? totalStat(c, 'Precision') * B.SuccessPerPrecision : 0;
export const dropBonus = (c: Character): number => 1 + totalStat(c, 'Luck') * B.DropBonusPerLuck;
export const eventLuckBonus = (c: Character): number => totalStat(c, 'Luck') * B.EventBonusPerLuck;

export function percent(v: number): string {
  const p = v * 100;
  return Math.abs(p - Math.round(p)) < 0.05 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

/** 능력치 옆에 보여 줄 효과 설명 (캐릭터 화면용). */
export function effectLabel(c: Character, stat: Stat): string {
  const atk = jobData(c.Job).attackStat;
  switch (stat) {
    case 'Vitality': return `HP ${maxHp(c)}`;
    case 'Spirit': return `저항 ${percent(resist(c))}`;
    case 'Luck': return `드롭 +${percent(dropBonus(c) - 1)} · 이벤트 +${percent(eventLuckBonus(c))}`;
    case 'Strength':
    case 'Intelligence': return atk === stat ? `공격력 ${attack(c)}` : '-';
    case 'Agility': return atk === stat ? `공격력 ${attack(c)} · 회피 ${percent(evasion(c))}` : `회피 ${percent(evasion(c))}`;
    case 'Toughness': return `받는 피해 -${percent(damageReduction(c))}`;
    case 'Precision': return `성공률 +${percent(precisionBonus(c))}`;
    case 'Finesse': return `회피 ${percent(evasion(c))}`;
    case 'SpellPower': return `스킬 피해 +${percent(skillDamageBonus(c))}`;
  }
}

// ── 생성 ─────────────────────────────────────────────────

export const allocatedPoints = (c: Character, stat: Stat): number => getStat(c.BaseStats, stat) - getStat(startingStats(c.Job), stat);
export const maxChallengeFloor = (c: Character): number => Math.min(B.MaxFloor, c.HighestFloorCleared + 1);

export function createCharacter(name: string, job: Job): Character {
  const first = startingSkill(job);
  const c: Character = {
    Name: name.trim() === '' ? '이름 없는 모험가' : name.trim(), Job: job, Level: 1, Exp: 0, UnspentPoints: 0,
    BaseStats: startingStats(job), Gold: B.StartGold, Rank: 'F', HighestFloorCleared: 0, QuestsCompleted: 0, CurrentHp: 0,
    Equipment: { Slots: SLOTS.map(() => null) },
    Inventory: newContainer(B.InventoryStart), Storage: newContainer(B.StorageBase),
    Skills: { Learned: [{ SkillId: first, Level: 0 }], Equipped: [first] }, BagsBought: 0,
  };
  addItem(c.Inventory, createConsumable('potion', 3));
  setEquipped(c, 'Weapon', createGear('Weapon', 'Common', 1, job, 'Vitality'));
  recalculateCapacities(c);
  c.CurrentHp = maxHp(c);
  return c;
}

// ── 경험치·레벨업·배분 ───────────────────────────────────

/** 경험치를 더하고 오른 레벨 수를 돌려준다. */
export function addExp(c: Character, amount: number): number {
  if (amount <= 0 || c.Level >= B.MaxLevel) return 0;
  c.Exp += amount;
  let gained = 0;
  while (c.Level < B.MaxLevel && c.Exp >= expToNext(c.Level)) {
    c.Exp -= expToNext(c.Level);
    c.Level++;
    c.UnspentPoints += B.PointsPerLevel;
    gained++;
  }
  if (c.Level >= B.MaxLevel) c.Exp = 0;
  for (let i = 0; i < gained; i++) c.CurrentHp = Math.min(maxHp(c), c.CurrentHp + roundEven(maxHp(c) * B.LevelUpHealRatio));
  return gained;
}

/** 사망 경험치 감소. 현재 레벨의 0까지만 줄어든다. 실제로 잃은 양을 돌려준다. */
export function applyDeathExpLoss(c: Character): number {
  const loss = roundEven(expToNext(c.Level) * B.DeathExpLoss);
  const actual = Math.min(loss, c.Exp);
  c.Exp -= actual;
  return actual;
}

export function expProgress(c: Character): number {
  const need = expToNext(c.Level);
  return need <= 0 ? 1 : Math.min(1, c.Exp / need);
}

export function allocate(c: Character, stat: Stat, points = 1): boolean {
  if (points <= 0 || c.UnspentPoints < points || !canAllocate(jobData(c.Job), stat)) return false;
  if (getStat(c.BaseStats, stat) + points > B.StatCap) return false;
  setStat(c.BaseStats, stat, getStat(c.BaseStats, stat) + points);
  c.UnspentPoints -= points;
  return true;
}

/** 직업별 비율로 포인트를 나눈다. 목표 비율에서 가장 모자란 능력치부터 채우고, 최대값에 닿은 능력치는 건너뛴다. */
export function planAutoAllocation(c: Character, points: number): number[] {
  const job = jobData(c.Job);
  const n = job.allocatable.length;
  const assigned = job.allocatable.map((s) => Math.max(0, allocatedPoints(c, s)));
  const plan = new Array<number>(n).fill(0);
  let total = assigned.reduce((a, b) => a + b, 0);
  for (let p = 0; p < points; p++) {
    total++;
    let best = -1;
    let bestDeficit = -Infinity;
    for (let i = 0; i < n; i++) {
      if (job.autoRatio[i] <= 0) continue;
      if (getStat(c.BaseStats, job.allocatable[i]) + plan[i] >= B.StatCap) continue;
      const deficit = (job.autoRatio[i] / 100) * total - assigned[i];
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        best = i;
      }
    }
    if (best < 0) break;
    assigned[best]++;
    plan[best]++;
  }
  return plan;
}

export function autoAllocate(c: Character): void {
  const plan = planAutoAllocation(c, c.UnspentPoints);
  plan.forEach((p, i) => {
    if (p > 0) allocate(c, jobData(c.Job).allocatable[i], p);
  });
}

/** 캐릭터 화면의 "+ 버튼 → 확정" 흐름을 위한 임시 배분. */
export class AllocationDraft {
  private pending: number[] = STATS.map(() => 0);
  constructor(private readonly c: Character) {}

  pendingOf(stat: Stat): number {
    return this.pending[ord(STATS, stat)];
  }
  get remaining(): number {
    return this.c.UnspentPoints - this.pending.reduce((a, b) => a + b, 0);
  }
  get hasChanges(): boolean {
    return this.pending.some((p) => p > 0);
  }
  canAdd(stat: Stat): boolean {
    return this.remaining > 0 && canAllocate(jobData(this.c.Job), stat) && getStat(this.c.BaseStats, stat) + this.pendingOf(stat) < B.StatCap;
  }
  add(stat: Stat): boolean {
    if (!this.canAdd(stat)) return false;
    this.pending[ord(STATS, stat)]++;
    return true;
  }
  remove(stat: Stat): boolean {
    const i = ord(STATS, stat);
    if (this.pending[i] <= 0) return false;
    this.pending[i]--;
    return true;
  }
  auto(): void {
    this.clear();
    planAutoAllocation(this.c, this.c.UnspentPoints).forEach((p, i) => {
      this.pending[ord(STATS, jobData(this.c.Job).allocatable[i])] += p;
    });
  }
  clear(): void {
    this.pending.fill(0);
  }
  commit(): void {
    this.pending.forEach((p, i) => {
      if (p > 0) allocate(this.c, STATS[i], p);
    });
    this.clear();
  }
}

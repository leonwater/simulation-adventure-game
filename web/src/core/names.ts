import type { Difficulty, EquipSlot, GearType, ItemGrade, Job, Rank, RoomType, SkillTier, Stat, StatusType } from './enums';

/** 열거형의 한국어 표시 이름 (C# Names). */
const STAT: Record<Stat, string> = {
  Vitality: '체력', Spirit: '정신', Luck: '행운', Strength: '힘', Agility: '민첩', Intelligence: '지능',
};
const JOB: Record<Job, string> = { Warrior: '전사', Archer: '궁수', Rogue: '도적', Mage: '마법사' };
const DIFF: Record<Difficulty, string> = { Easy: '쉬움', Normal: '보통', Hard: '어려움', Hardcore: '하드코어' };
const GRADE: Record<ItemGrade, string> = { Common: '일반', Uncommon: '고급', Rare: '희귀', Epic: '영웅', Legendary: '전설' };
const GEAR: Record<GearType, string> = { Helmet: '투구', Armor: '갑옷', Pants: '바지', Boots: '신발', Necklace: '목걸이', Ring: '반지', Weapon: '무기' };
const SLOT: Record<EquipSlot, string> = { Helmet: '투구', Armor: '갑옷', Pants: '바지', Boots: '신발', Necklace: '목걸이', Ring1: '반지 1', Ring2: '반지 2', Weapon: '무기' };
const TIER: Record<SkillTier, string> = { Low: '하급', Mid: '중급', High: '상급', Top: '최상급' };
const STATUS: Record<StatusType, string> = {
  Empower: '강화', Fortify: '철벽', Regen: '재생', Focus: '집중', Swift: '날렵함', Keen: '예리함', Cruel: '잔혹함', Riposte: '반격 태세', Hawk: '매의 눈', Rapid: '속사', Piercing: '관통 화살',
  Poison: '독', Bleed: '출혈', Burn: '화상', Weaken: '약화', Vulnerable: '취약', Stun: '기절', Silence: '침묵', Blind: '실명', Fear: '공포', Overload: '마력 폭주',
};
const ROOM: Record<RoomType, string> = { Start: '시작', Battle: '전투', Event: '이벤트', Treasure: '보물', Rest: '휴식', Merchant: '상인', Return: '귀환', Boss: '보스' };

export const Names = {
  stat: (s: Stat) => STAT[s],
  job: (j: Job) => JOB[j],
  rank: (r: Rank) => r as string,
  difficulty: (d: Difficulty) => DIFF[d],
  grade: (g: ItemGrade) => GRADE[g],
  gear: (g: GearType) => GEAR[g],
  slot: (s: EquipSlot) => SLOT[s],
  tier: (t: SkillTier) => TIER[t],
  status: (s: StatusType) => STATUS[s],
  room: (r: RoomType) => ROOM[r],
};

export const gold = (g: number): string => g.toLocaleString('en-US') + ' G';

/** 머리줄 골드: 99,999까지 그대로, 10만부터 "12.3만", 1억부터 "1.2억". */
export function goldCompact(g: number): string {
  if (g < 100000) return g.toLocaleString('en-US');
  if (g < 100000000) return (g < 1000000 ? String(Math.round((g / 10000) * 10) / 10) : String(Math.round(g / 10000))) + '만';
  return String(Math.round((g / 100000000) * 10) / 10) + '억';
}

/** 마지막 글자 받침 여부와 ㄹ 받침 여부. */
export function hasBatchim(word: string): { batchim: boolean; rieul: boolean } {
  if (!word) return { batchim: false, rieul: false };
  const ch = word.charCodeAt(word.length - 1);
  if (ch >= 0xac00 && ch <= 0xd7a3) {
    const jong = (ch - 0xac00) % 28;
    return { batchim: jong !== 0, rieul: jong === 8 };
  }
  const c = word[word.length - 1];
  if ('013678'.includes(c)) return { batchim: true, rieul: '178'.includes(c) };
  if ('Ll'.includes(c)) return { batchim: true, rieul: true };
  if ('MNmn'.includes(c)) return { batchim: true, rieul: false };
  return { batchim: false, rieul: false };
}

/** 조사를 붙인다. pair 예: "을/를", "이/가", "은/는", "과/와", "으로/로". */
export function josa(word: string, pair: string): string {
  const [withB, without] = pair.split('/');
  const { batchim, rieul } = hasBatchim(word);
  if (withB === '으로') return word + (batchim && !rieul ? '으로' : '로');
  return word + (batchim ? withB : without);
}

/** C# Enums.cs와 같은 순서·이름. 저장 파일에는 열거형이 이름(문자열)으로 들어간다. */
export const JOBS = ['Warrior', 'Archer', 'Rogue', 'Mage'] as const;
export const STATS = ['Vitality', 'Spirit', 'Luck', 'Strength', 'Agility', 'Intelligence', 'Toughness', 'Precision', 'Finesse', 'SpellPower'] as const;
export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'] as const;
export const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Hardcore'] as const;
export const GRADES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;
export const ITEM_KINDS = ['Equipment', 'Consumable', 'Material', 'SkillBook', 'EnhanceStone'] as const;
export const GEARS = ['Helmet', 'Armor', 'Pants', 'Boots', 'Necklace', 'Ring', 'Weapon'] as const;
export const SLOTS = ['Helmet', 'Armor', 'Pants', 'Boots', 'Necklace', 'Ring1', 'Ring2', 'Weapon'] as const;
export const TIERS = ['Low', 'Mid', 'High', 'Top'] as const;
export const TARGETS = ['SingleEnemy', 'AllEnemies', 'Self', 'MultiEnemy', 'ChainEnemies'] as const;
export const STATUSES = ['Empower', 'Fortify', 'Regen', 'Focus', 'Swift', 'Keen', 'Cruel', 'Poison', 'Bleed', 'Burn', 'Weaken', 'Vulnerable', 'Stun', 'Silence', 'Blind', 'Fear'] as const;
export const ROOM_TYPES = ['Start', 'Battle', 'Event', 'Treasure', 'Rest', 'Merchant', 'Return', 'Boss'] as const;
export const LAYOUTS = ['Branch', 'Loop', 'Grid'] as const;
export const QUEST_KINDS = ['Hunt', 'Collect', 'Conquer'] as const;

export type Job = (typeof JOBS)[number];
export type Stat = (typeof STATS)[number];
export type Rank = (typeof RANKS)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type ItemGrade = (typeof GRADES)[number];
export type ItemKind = (typeof ITEM_KINDS)[number];
export type GearType = (typeof GEARS)[number];
export type EquipSlot = (typeof SLOTS)[number];
export type SkillTier = (typeof TIERS)[number];
export type SkillTarget = (typeof TARGETS)[number];
export type StatusType = (typeof STATUSES)[number];
export type RoomType = (typeof ROOM_TYPES)[number];
export type LayoutPattern = (typeof LAYOUTS)[number];
export type QuestKind = (typeof QUEST_KINDS)[number];

/** (int)열거형 — 배열 순서가 곧 값. */
export const ord = <T extends string>(list: readonly T[], v: T): number => list.indexOf(v);

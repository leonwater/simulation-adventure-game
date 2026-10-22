import monstersJson from '../data/monsters.json';
import { clamp } from './balance';
import type { StatusApply } from './skills';

export interface EnemySkill {
  Name: string;
  DamageMult: number;
  UseChance: number;
  Status: StatusApply | null;
}
export interface MonsterSpecies {
  Id: string;
  Name: string;
  /** 0 = 1~10층, 1 = 11~20층, 2 = 21~30층, -1 = 특수 */
  Tier: number;
  HpMul: number;
  AttackMul: number;
  DefenseMul: number;
  RequirementMul: number;
  MaterialId: string | null;
  MaterialName: string | null;
  Skills: EnemySkill[];
  UniqueBoss: boolean;
  RegenPercent: number;
  /** 무리에서 서고 싶은 줄: 궁수·주술사처럼 멀리서 공격하는 종족은 후방. */
  Line?: 'Front' | 'Back';
  /** 종류별 특색 (일반·정예만): HP·공격력 배율. 단단한 방패형은 HP↑ 공격↓, 후방 딜러는 HP↓ 공격↑. 자리와는 상관없다. */
  Trait?: { Hp: number; Atk: number };
}
export interface FloorTheme {
  Name: string;
  SpeciesIds: string[];
  UniqueBossId: string;
}

export const ALL_SPECIES = monstersJson.Species as unknown as MonsterSpecies[];
export const THEMES = monstersJson.Themes as unknown as FloorTheme[];
const BY_ID = new Map(ALL_SPECIES.map((s) => [s.Id, s]));

export const monster = (id: string | null | undefined): MonsterSpecies | null => (id ? BY_ID.get(id) ?? null : null);
export const themeIndex = (floor: number): number => clamp(Math.floor((floor - 1) / 10), 0, THEMES.length - 1);
export const themeFor = (floor: number): FloorTheme => THEMES[themeIndex(floor)];
export const isUniqueBossFloor = (floor: number): boolean => floor % 10 === 0;


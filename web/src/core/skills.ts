import skillsJson from '../data/skills.json';
import { B } from './balance';
import type { Job, Rank, SkillTarget, SkillTier, StatusType } from './enums';
import { JOBS, TIERS, ord } from './enums';
import type { Rng } from './rng';

export interface StatusApply {
  Type: StatusType;
  Value: number;
  Turns: number;
  OnSelf: boolean;
  Chance: number;
}

/** 스킬 정의 (tools/export가 C# SkillDb에서 뽑은 표). 읽기 전용. */
export interface SkillDef {
  Id: string;
  Name: string;
  /** -1 = 공용, 그 외 = 직업 번호 */
  JobRestriction: number;
  Tier: SkillTier;
  Target: SkillTarget;
  TargetCount: number;
  ChainMults: number[];
  Cooldown: number;
  DamageMult: number;
  Hits: number;
  HealRatio: number;
  SuccessBonus: number;
  CritChance: number;
  GuaranteedCrit: boolean;
  FirstTurnCrit: boolean;
  ExecuteThreshold: number;
  ExecuteMult: number;
  Statuses: StatusApply[];
  Effect: string;
  Role: string;
  ReqLevel: number;
  ReqRank: Rank;
  IsAttack: boolean;
  NeedsTarget: boolean;
  SuccessText: string;
  Description: string;
}

/** 광역 종류 이름 (전투 선택지·스킬 상세). 단일·자신은 null. */
export function areaName(def: SkillDef): string | null {
  switch (def.Target) {
    case 'AllEnemies': return '전체 광역';
    case 'Column': return '좌우 광역';
    case 'Row': return '앞뒤 광역';
    case 'RandomEnemies': case 'ChainEnemies': return `인원수 광역 ${def.Target === 'ChainEnemies' ? def.ChainMults.length : def.TargetCount}명`;
    default: return null;
  }
}

/** 피해 없이 효과만 거는 비전투 스킬: 수련하면 지속 +1턴(1단계) → 재사용 -1턴(2단계). */
export const isUtility = (def: SkillDef): boolean => !def.IsAttack;
/** 수련 단계를 반영한 효과 지속 턴 (비전투 스킬 1단계부터 +1). */
export const skillTurns = (def: SkillDef, turns: number, level: number): number => turns + (isUtility(def) && level >= 1 ? 1 : 0);
/** 수련 단계를 반영한 재사용 대기 (비전투 스킬 2단계부터 -1, 언제나 지속보다 1턴 이상 길다). */
export function skillCooldown(def: SkillDef, level: number): number {
  if (!isUtility(def)) return def.Cooldown;
  const longest = Math.max(0, ...def.Statuses.map((s) => skillTurns(def, s.Turns, level)));
  return Math.max(longest + 1, def.Cooldown - (level >= 2 ? 1 : 0));
}

export const ALL_SKILLS = skillsJson as unknown as SkillDef[];
const BY_ID = new Map(ALL_SKILLS.map((s) => [s.Id, s]));

export const skillDef = (id: string | null | undefined): SkillDef | null => (id ? BY_ID.get(id) ?? null : null);

export const startingSkill = (job: Job): string => ({ Warrior: 'w_bash', Archer: 'a_scatter', Rogue: 'r_ambush', Mage: 'm_fireball' })[job];

export function skillsForJob(job: Job, tiers: readonly SkillTier[] = TIERS): SkillDef[] {
  return ALL_SKILLS.filter((s) => (s.JobRestriction < 0 || s.JobRestriction === ord(JOBS, job)) && tiers.includes(s.Tier));
}

/** 스킬서로 나올 수 있는 스킬: 그 직업, 장착 레벨 ≤ 지금 레벨 + 5. */
export function obtainableSkills(level: number, job: Job, tiers: readonly SkillTier[] = TIERS): SkillDef[] {
  return skillsForJob(job, tiers).filter((s) => s.ReqLevel <= level + B.SkillBookLevelWindow);
}

/** 지금 레벨보다 높은 스킬은 절반 확률로 뺀다 (남는 것이 있을 때만). */
export function preferOwnLevel(list: SkillDef[], level: number, rng: Rng): SkillDef[] {
  if (!rng.chance(B.OverLevelReroll)) return list;
  const own = list.filter((s) => s.ReqLevel <= level);
  return own.length > 0 ? own : list;
}


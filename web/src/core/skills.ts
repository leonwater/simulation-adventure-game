import skillsJson from '../data/skills.json';
import { B } from './balance';
import type { Job, Rank, SkillTarget, SkillTier, StatusType } from './enums';
import { JOBS, RANKS, TIERS, ord } from './enums';
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
  GrantsNextCrit: boolean;
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

export const ALL_SKILLS = skillsJson as unknown as SkillDef[];
const BY_ID = new Map(ALL_SKILLS.map((s) => [s.Id, s]));

export const skillDef = (id: string | null | undefined): SkillDef | null => (id ? BY_ID.get(id) ?? null : null);

export const startingSkill = (job: Job): string => ({ Warrior: 'w_bash', Archer: 'a_aim', Rogue: 'r_ambush', Mage: 'm_fireball' })[job];

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

export const reqRankIndex = (def: SkillDef): number => ord(RANKS, def.ReqRank);

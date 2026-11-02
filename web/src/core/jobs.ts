import { B } from './balance';
import type { Job, Stat } from './enums';
import { JOBS, STATS, ord } from './enums';
import type { Rng } from './rng';

export interface JobData {
  job: Job;
  name: string;
  mainStats: Stat[];
  attackStat: Stat;
  /** 레벨업 포인트를 줄 수 있는 능력치 (체력·공격·정신·행운). 고유 능력치는 모험가 등급으로만 오른다. */
  allocatable: Stat[];
  /** 자동 배분 비율 (allocatable 순서, 합 100). */
  autoRatio: number[];
  hpPerVitality: number;
  basicAttackMultiplier: number;
  /** Lv.1 능력치: 체력, 공격, 정신, 행운. */
  start: number[];
}

function make(job: Job, name: string, attack: Stat, start: number[], ratio: number[], hp: number, basic: number): JobData {
  return {
    job, name, attackStat: attack, mainStats: ['Vitality', attack],
    allocatable: ['Vitality', attack, 'Spirit', 'Luck'], autoRatio: ratio, hpPerVitality: hp,
    basicAttackMultiplier: basic, start,
  };
}

const ALL: JobData[] = [
  make('Warrior', '전사', 'Strength', [16, 12, 5, 5], [30, 40, 15, 15], 12, 1.0),
  make('Archer', '궁수', 'Agility', [10, 13, 6, 8], [30, 40, 15, 15], 10, B.ArcherBasicAttack),
  make('Rogue', '도적', 'Agility', [10, 12, 5, 9], [30, 40, 15, 15], 10, 1.0),
  // 마법사의 기본 공격 자리는 에너지 볼 (battle.ts basicMult) — 배율은 쓰지 않는다
  make('Mage', '마법사', 'Intelligence', [8, 14, 9, 6], [35, 40, 25, 0], 8, 1.0),
];

export const jobData = (job: Job): JobData => ALL[ord(JOBS, job)];

/** 직업 고유 능력치 표시 정보. 값은 B.JobPerk[직업][등급] (모험가 등급으로만 오름). */
export const PERKS: Record<Job, { name: string; icon: string; text: (v: string) => string; about: string }> = {
  Warrior: { name: '반격', icon: 'perk_counter', text: (v) => `맞을 때 ${v} 확률로 피해 절반 + 즉시 반격`, about: '맞을 때 그 확률로 피해를 절반으로 막고 즉시 반격' },
  Archer: { name: '관통', icon: 'perk_pierce', text: (v) => `기본 공격이 적 방어력의 ${v}를 무시`, about: '기본 공격이 적 방어력을 그 비율만큼 무시' },
  Rogue: { name: '급소', icon: 'perk_vital', text: (v) => `스킬 치명타 확률 +${v} · 치명타 피해 +${rogueCritDamage(v)}`, about: '스킬 치명타 확률과 치명타 피해가 오른다' },
  Mage: { name: '증폭', icon: 'perk_amplify', text: (v) => `스킬 피해 +${v}`, about: '스킬 피해가 그만큼 오른다' },
};

/** 도적 급소의 치명타 피해 보너스 ('4%' → '10%'). */
const rogueCritDamage = (v: string): string => `${Math.round(parseFloat(v) * B.RogueCritDamageRatio)}%`;

export const canAllocate = (j: JobData, stat: Stat): boolean => j.allocatable.includes(stat);

/** 장비·스킬서가 어느 직업용으로 나올지: 지금 직업 70%, 다른 세 직업 각 10%. */
export function rollItemJob(own: Job, rng: Rng): Job {
  if (rng.chance(B.OwnJobChance)) return own;
  const other = rng.range(0, 3);
  const o = ord(JOBS, own);
  return JOBS[other >= o ? other + 1 : other];
}

/** 능력치 묶음 (저장 모양: { Values: number[] }, 순서는 STATS). */
export interface StatBlock {
  Values: number[];
}
export const getStat = (b: StatBlock, s: Stat): number => b.Values[ord(STATS, s)];
export const setStat = (b: StatBlock, s: Stat, v: number): void => {
  b.Values[ord(STATS, s)] = v;
};

/** Lv.1 능력치. 배분할 수 없는 능력치는 5로 고정. */
export function startingStats(job: Job): StatBlock {
  const j = jobData(job);
  const b: StatBlock = { Values: STATS.map(() => B.FixedStatValue) };
  j.allocatable.forEach((s, i) => setStat(b, s, j.start[i]));
  return b;
}

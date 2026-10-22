import { B } from './balance';
import type { Job, Stat } from './enums';
import { JOBS, STATS, ord } from './enums';
import type { Rng } from './rng';

export interface JobData {
  job: Job;
  name: string;
  mainStats: Stat[];
  attackStat: Stat;
  specialStat: Stat;
  /** 레벨업 포인트를 줄 수 있는 능력치 (체력·공격·특화·정신·행운). */
  allocatable: Stat[];
  /** 자동 배분 비율 (allocatable 순서, 합 100). */
  autoRatio: number[];
  hpPerVitality: number;
  basicAttackMultiplier: number;
  /** Lv.1 능력치: 체력, 공격, 특화, 정신, 행운. */
  start: number[];
}

function make(job: Job, name: string, attack: Stat, special: Stat, start: number[], ratio: number[], hp: number, basic: number): JobData {
  return {
    job, name, attackStat: attack, specialStat: special, mainStats: ['Vitality', attack, special],
    allocatable: ['Vitality', attack, special, 'Spirit', 'Luck'], autoRatio: ratio, hpPerVitality: hp,
    basicAttackMultiplier: basic, start,
  };
}

const ALL: JobData[] = [
  make('Warrior', '전사', 'Strength', 'Toughness', [16, 12, 10, 5, 5], [30, 40, 20, 0, 10], 12, 1.0),
  make('Archer', '궁수', 'Agility', 'Precision', [10, 13, 10, 6, 8], [30, 40, 20, 0, 10], 10, 1.0),
  make('Rogue', '도적', 'Agility', 'Finesse', [10, 12, 12, 5, 9], [25, 40, 25, 0, 10], 9, 1.0),
  make('Mage', '마법사', 'Intelligence', 'SpellPower', [8, 14, 10, 9, 6], [30, 40, 20, 10, 0], 8, B.MageBasicAttack),
];

export const jobData = (job: Job): JobData => ALL[ord(JOBS, job)];

export const canAllocate = (j: JobData, stat: Stat): boolean => j.allocatable.includes(stat);

/** 장비·스킬서가 어느 직업용으로 나올지: 지금 직업 70%, 다른 세 직업 각 10%. */
export function rollItemJob(own: Job, rng: Rng): Job {
  if (rng.chance(B.OwnJobChance)) return own;
  const other = rng.range(0, 3);
  const o = ord(JOBS, own);
  return JOBS[other >= o ? other + 1 : other];
}

/** 능력치 10종 묶음 (저장 모양: { Values: number[] }, 순서는 STATS). */
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

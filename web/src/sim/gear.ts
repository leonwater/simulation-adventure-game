import { B, expToNext, roundEven } from '../core/balance';
import { Battle } from '../core/battle';
import { addExp, autoAllocate, createCharacter } from '../core/character';
import type { Character } from '../core/character';
import { createBoss } from '../core/enemies';
import { equip, equipSkill, learnSkill } from '../core/equipment';
import type { Difficulty, GearType, ItemGrade, Job } from '../core/enums';
import { JOBS, RANKS, TIERS } from '../core/enums';
import { addItem, createConsumable, createGear } from '../core/items';
import { jobData } from '../core/jobs';
import { Rng } from '../core/rng';
import { skillsForJob } from '../core/skills';
import { pickBattleChoice } from './bot';

// 장비 등급 × 강화 단계별로 보스를 잡을 수 있는지 잰다 (골드·파밍과 상관없이 "이 장비면 깨지는가").
// (실행 파일은 gearcli.ts) npm run gear -- [층=30] [난이도=Normal,Hard] [판수=60]

const GEARS: GearType[] = ['Helmet', 'Armor', 'Pants', 'Boots', 'Necklace', 'Ring', 'Ring', 'Weapon'];

export interface HeroSpec { job: Job; floor: number; grade: ItemGrade; weapon: number; armor: number; levelBy?: number; trainLevel?: number }

export function buildHero(spec: HeroSpec): Character {
  const { job, floor } = spec;
  const c = createCharacter('a', job);
  const level = Math.min(B.MaxLevel, Math.max(1, roundEven(floor * (spec.levelBy ?? 1.9) - 0.5)));
  while (c.Level < level) addExp(c, expToNext(c.Level));
  autoAllocate(c);
  c.Rank = RANKS[Math.min(RANKS.indexOf('S'), Math.floor(floor / 5))];
  // 레벨 안에서 배울 수 있는 스킬을 모두 배우고 높은 등급부터 장착
  const order = [...TIERS].reverse();
  const skills = skillsForJob(job).filter((s) => s.ReqLevel <= c.Level).sort((a, b) => order.indexOf(a.Tier) - order.indexOf(b.Tier));
  for (const s of skills) learnSkill(c, s.Id);
  for (const st of c.Skills.Learned) st.Level = Math.min(spec.trainLevel ?? 5, 5);
  c.Skills.Equipped = [];
  for (const s of skills) equipSkill(c, s.Id);
  const lv = Math.min(c.Level, floor * 2 - 1);
  for (const gear of GEARS) {
    const item = createGear(gear, spec.grade, lv, job, jobData(job).attackStat);
    item.Enhance = gear === 'Weapon' ? spec.weapon : spec.armor;
    addItem(c.Inventory, item);
    equip(c, item.Uid);
  }
  addItem(c.Inventory, createConsumable('potion', 6));
  addItem(c.Inventory, createConsumable('potion_hi', 3));
  c.CurrentHp = 1e9;
  return c;
}

/** 보스 한 판: 이기면 true. */
export function fightBoss(spec: HeroSpec, diff: Difficulty, seed: number): boolean {
  const c = buildHero(spec);
  const boss = createBoss(spec.floor, diff, seed);
  const b = new Battle(c, spec.floor, boss, true, new Rng(seed));
  let guard = 0;
  while (!b.isOver && guard++ < 400) b.execute(pickBattleChoice(b));
  return b.outcome === 'Victory';
}

export function winRate(spec: HeroSpec, diff: Difficulty, n: number, jobs: readonly Job[] = JOBS): number {
  let win = 0, total = 0;
  for (const job of jobs) for (let i = 0; i < n; i++) { total++; if (fightBoss({ ...spec, job }, diff, 7919 * (i + 1) + JOBS.indexOf(job))) win++; }
  return win / total;
}

import { maxHp, maxChallengeFloor } from '../core/character';
import { GameSession } from '../core/session';
import { MemorySaveStore } from '../core/save';
import { countOf } from '../core/items';
import { step } from './bot';

/**
 * 고정 장비로 (floor-4)층부터 floor층까지 이어서 도전해 floor층 보스를 잡는 비율.
 * 도전은 최대 tries번, 죽으면 다시 도전 (장비는 그대로, 물약은 매번 채움).
 */
export function clearRate(spec: HeroSpec, diff: Difficulty, n: number, tries = 8, jobs: readonly Job[] = JOBS): { clear: number; avgTries: number; deathsPerTry: number } {
  let clear = 0, total = 0, usedTries = 0, deaths = 0, fights = 0;
  for (const job of jobs) {
    for (let i = 0; i < n; i++) {
      total++;
      const s = new GameSession(new MemorySaveStore(), () => new Date(Date.UTC(2026, 9, 1, 9, 0, 0)), 104729 * (i + 1) + JOBS.indexOf(job));
      s.newGame('봇', job, diff);
      s.setTutorial('Done');
      const hero = buildHero({ ...spec, job });
      Object.assign(s.c, hero);
      s.c.HighestFloorCleared = spec.floor - 5;
      for (let t = 1; t <= tries; t++) {
        usedTries++;
        fights++;
        const c = s.c;
        c.Inventory.Items = c.Inventory.Items.filter((it) => it.Kind === 'Equipment');
        addItem(c.Inventory, createConsumable('potion', 6));
        addItem(c.Inventory, createConsumable('potion_hi', 3));
        s.selectFloor(maxChallengeFloor(c));
        s.enterDungeon();
        let steps = 0;
        while (s.hasGame && s.inDungeon && steps++ < 600) step(s);
        if (s.lastDeath) deaths++;
        if (s.inDungeon) s.returnToTown();
        if (s.c.HighestFloorCleared >= spec.floor) { clear++; break; }
      }
      void maxHp;
      void countOf;
    }
  }
  return { clear: clear / total, avgTries: usedTries / total, deathsPerTry: deaths / Math.max(1, fights) };
}

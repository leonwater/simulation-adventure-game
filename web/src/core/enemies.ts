import { B, difficultyMultiplier, earlyBoostScale, enemyAttack, enemyDefense, enemyExp, enemyGold, enemyHp, expToNext, lateRamp, roundEven } from './balance';
import { equipBossTraits } from './bosskit';
import { Combatant } from './combatant';
import type { MonsterSpecies } from './monsters';
import { isUniqueBossFloor, monster, themeFor } from './monsters';
import { Rng } from './rng';

const COUNT_WEIGHTS = [25, 35, 25, 15]; // 1~4마리

export function createEnemy(sp: MonsterSpecies, floor: number, diff: string, role: number): Combatant {
  const d = difficultyMultiplier(diff);
  const hpRole = role === 2 ? (sp.UniqueBoss ? B.UniqueBossHp : B.FloorBossHp) : role === 1 ? B.EliteHp : 1;
  const atkRole = role === 2 ? (sp.UniqueBoss ? B.UniqueBossAttack : B.FloorBossAttack) : role === 1 ? B.EliteAttack : 1;
  const reward = role === 2 ? (sp.UniqueBoss ? B.UniqueBossReward : B.FloorBossReward) : role === 1 ? B.EliteReward : 1;
  const early = earlyBoostScale(diff);
  const late = lateRamp(floor);
  const hp = Math.max(1, roundEven(enemyHp(floor, early) * sp.HpMul * hpRole * d * (1 + B.LateHpBonus * late)));
  let name = sp.Name;
  if (role === 1) name = `정예 ${sp.Name}`;
  else if (role === 2 && !sp.UniqueBoss) name = `${sp.Name} 우두머리`;
  const c = new Combatant();
  c.name = name;
  c.maxHp = c.hp = hp;
  c.attack = Math.max(1, roundEven(enemyAttack(floor, early) * sp.AttackMul * atkRole * d * (1 + B.LateAttackBonus * late)));
  c.defense = roundEven(enemyDefense(floor) * sp.DefenseMul);
  c.requirement = (10 + floor * 2.4) * sp.RequirementMul + (role > 0 ? 2 : 0);
  c.resist = role === 2 ? 0.3 : role === 1 ? 0.1 : 0;
  c.regenPercent = sp.RegenPercent;
  c.species = sp;
  c.skills = sp.Skills;
  c.role = role;
  c.expReward = roundEven(enemyExp(floor) * reward);
  c.goldReward = roundEven(enemyGold(floor) * reward);
  return c;
}

const sp = (id: string): MonsterSpecies => monster(id)!;

/** 같은 이름이 여럿이면 A, B, C…를 붙인다. */
export function nameDuplicates(list: Combatant[]): void {
  const counts = new Map<string, number>();
  for (const e of list) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  const used = new Map<string, number>();
  for (const e of list) {
    if ((counts.get(e.name) ?? 0) < 2) continue;
    const base = e.name;
    const u = used.has(base) ? used.get(base)! + 1 : 0;
    used.set(base, u);
    e.name = `${base} ${String.fromCharCode(65 + u)}`;
  }
}

/**
 * 진형: 적 자리는 배열 순서와 같다 — 0 전방 위 · 1 후방 위 · 2 전방 아래 · 3 후방 아래 (플레이어 쪽 왼쪽 열이 전방).
 * 궁수·주술사처럼 후방을 좋아하는 종족을 먼저 후방 칸에 넣는다. lines면 일반·정예에게 줄 보정을 준다:
 * 전방은 HP가 많고 약하게 때리며, 후방은 HP가 적고 세게 때린다 (balance.json Front/Back). 혼자 나온 적은 보정 없음.
 */
export function arrange(list: Combatant[], lines: boolean): Combatant[] {
  const n = Math.min(4, list.length);
  const back = [1, 3].filter((s) => s < n);
  const front = [0, 2].filter((s) => s < n);
  const out: Combatant[] = new Array(n);
  const rest: Combatant[] = [];
  for (const e of list.slice(0, n)) {
    if (e.species?.Line === 'Back' && back.length > 0) out[back.shift()!] = e;
    else rest.push(e);
  }
  for (const e of rest) out[(front.length > 0 ? front : back).shift()!] = e;
  if (lines && n > 1) {
    out.forEach((e, i) => {
      if (e.role >= 2) return;
      const isBack = i % 2 === 1;
      e.maxHp = e.hp = Math.max(1, roundEven(e.maxHp * (isBack ? B.BackHp : B.FrontHp)));
      e.attack = Math.max(1, roundEven(e.attack * (isBack ? B.BackAttack : B.FrontAttack)));
    });
  }
  return out;
}

/** 전투 방의 적 무리 (1~4마리, 낮은 확률로 엘리트 1마리). extra: 전쟁의 북소리 (최대 4마리). */
export function createGroup(floor: number, diff: string, seed: number, extra = 0): Combatant[] {
  const rng = new Rng(seed);
  const theme = themeFor(floor);
  let count = rng.pickWeighted(COUNT_WEIGHTS) + 1;
  if (floor <= 2) count = Math.min(count, 2);
  else if (floor <= 4) count = Math.min(count, 3);
  count = Math.min(4, count + extra);
  const list: Combatant[] = [];
  const elite = rng.chance(B.EliteChance) ? rng.range(0, count) : -1;
  for (let i = 0; i < count; i++) list.push(createEnemy(sp(rng.pick(theme.SpeciesIds)), floor, diff, i === elite ? 1 : 0));
  const arranged = arrange(list, true);
  nameDuplicates(arranged);
  return arranged;
}

/** 보스 방: 10·20·30층은 고유 보스, 그 외 층은 테마 몬스터의 강화형. 보스는 특성을 가진다. */
export function createBoss(floor: number, diff: string, seed: number): Combatant[] {
  const rng = new Rng(seed);
  const theme = themeFor(floor);
  const list: Combatant[] = [];
  if (isUniqueBossFloor(floor)) list.push(createEnemy(sp(theme.UniqueBossId), floor, diff, 2));
  else {
    list.push(createEnemy(sp(rng.pick(theme.SpeciesIds)), floor, diff, 2));
    if (floor >= 5 && rng.chance(0.5)) list.push(createEnemy(sp(rng.pick(theme.SpeciesIds)), floor, diff, 0));
  }
  equipBossTraits(list[0], floor);
  nameDuplicates(list);
  return list; // 보스가 0번(전방), 함께 나온 졸개는 1번(후방). 줄 보정 없음
}

/** 미믹: HP ×1.5 · 공격력 ×1.3, 물어뜯기(출혈). 이기면 장비 확정 + 골드 ×3. */
export function createMimic(floor: number, diff: string): Combatant[] {
  const m = createEnemy(sp('mimic'), floor, diff, 0);
  m.goldReward = roundEven(m.goldReward * B.MimicGold);
  m.guaranteedEquipment = true;
  return [m];
}

/** 도박하는 고블린에게 속임수가 들통났을 때의 전투 (고블린 2마리). */
export function createGamblers(floor: number, diff: string): Combatant[] {
  const list = arrange([createEnemy(sp('goblin'), floor, diff, 0), createEnemy(sp('goblin'), floor, diff, 0)], true);
  nameDuplicates(list);
  return list;
}

/** 떠돌이 모험가 (정예): 골드 ×4, 30% 확률로 장비 확정. */
export function createWanderer(floor: number, diff: string, seed: number): Combatant[] {
  const rng = new Rng(seed);
  const w = createEnemy(sp('wanderer'), floor, diff, 1);
  w.name = '떠돌이 모험가';
  w.goldReward *= 4;
  w.guaranteedEquipment = rng.chance(0.3);
  return [w];
}

/** 도망친 고블린이 데려온 무리: 테마 몬스터 2~3마리 (정예 1) · 보상 ×2. */
export function createGoblinChase(floor: number, diff: string, seed: number): Combatant[] {
  const rng = new Rng(seed);
  const theme = themeFor(floor);
  const count = rng.rangeInclusive(2, 3);
  const elite = rng.range(0, count);
  const list: Combatant[] = [];
  for (let i = 0; i < count; i++) {
    const e = createEnemy(sp(rng.pick(theme.SpeciesIds)), floor, diff, i === elite ? 1 : 0);
    e.expReward *= 2;
    e.goldReward *= 2;
    list.push(e);
  }
  const arranged = arrange(list, true);
  nameDuplicates(arranged);
  return arranged;
}

/** 튜토리얼 적: 1층 초반 보정을 빼고 배율을 곱한다. */
function tutorial(e: Combatant, diff: string, hp: number, attack = 1): Combatant {
  const early = earlyBoostScale(diff);
  const hpScale = (enemyHp(1, 0) / enemyHp(1, early)) * hp;
  const atkScale = (enemyAttack(1, 0) / enemyAttack(1, early)) * attack;
  e.maxHp = e.hp = Math.max(1, roundEven(e.maxHp * hpScale));
  e.attack = Math.max(1, roundEven(e.attack * atkScale));
  return e;
}

/** 튜토리얼 전투: 첫 전투는 슬라임 1마리(레벨업할 만큼 경험치), 두 번째는 고블린 2마리. */
export function createTutorialGroup(first: boolean, diff: string): Combatant[] {
  const list: Combatant[] = [];
  if (first) {
    const slime = tutorial(createEnemy(sp('slime'), 1, diff, 0), diff, 1);
    slime.expReward = Math.max(slime.expReward, expToNext(1));
    list.push(slime);
  } else {
    list.push(tutorial(createEnemy(sp('goblin'), 1, diff, 0), diff, 1));
    list.push(tutorial(createEnemy(sp('goblin'), 1, diff, 0), diff, 1));
  }
  nameDuplicates(list);
  return list;
}

/** 튜토리얼 약한 보스 (고블린 우두머리, HP 절반, 특성 없음). */
export const createTutorialBoss = (diff: string): Combatant[] => [tutorial(createEnemy(sp('goblin'), 1, diff, 2), diff, 0.5, 0.8)];

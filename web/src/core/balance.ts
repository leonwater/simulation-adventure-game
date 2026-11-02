import data from '../data/balance.json';

/**
 * 밸런스 상수 (C# GameBalance의 const·static readonly → tools/export가 만든 balance.json).
 * 공식은 아래 함수로 다시 쓴다 (C#과 같은 값이 나오는지 tests/balance.test.ts가 확인한다).
 */
export const B = data as Record<string, any> & {
  BaseHit: number; HitPerStatPoint: number; MinHit: number; MaxHit: number;
  EnemyBaseHit: number; EventBase: number; EventMin: number; EventMax: number; EventPerStatPoint: number;
  MaxLevel: number; StatCap: number;
};

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** 공격 성공률 = 81% + (주 공격 능력치 − 적 요구치) × 1% + 보정, 62~92%. */
export const hitChance = (stat: number, requirement: number, bonus = 0): number =>
  clamp(B.BaseHit + (stat - requirement) * B.HitPerStatPoint + bonus, B.MinHit, B.MaxHit);

/** 이벤트 판정 = 기본 + (능력치 − 요구치) × 1% + 행운 × 0.5%, 범위 제한. */
export const eventChance = (stat: number, requirement: number, luck: number): number =>
  clamp(B.EventBase + (stat - requirement) * B.EventPerStatPoint + luck * B.EventBonusPerLuck, B.EventMin, B.EventMax);

export const enemyRequirement = (floor: number): number => 10 + floor * 2.4;

/** C# Math.Round (짝수 쪽으로 반올림). */
export function roundEven(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/** 다음 레벨까지 필요한 경험치. */
export const expToNext = (level: number): number => (level >= B.MaxLevel ? 0 : roundEven(100 * Math.pow(level, B.ExpExponent)));

export const difficultyMultiplier = (d: string): number => (d === 'Easy' ? 0.75 : d === 'Hard' || d === 'Hardcore' ? 1.25 : 1);

/** 초반 보정: 1층 1.0 → 8층 0. 쉬움은 없음, 어려움·하드코어는 40%만. */
export const earlyBoost = (f: number): number => Math.max(0, (B.EarlyBoostUntil - f) / (B.EarlyBoostUntil - 1));
export const earlyBoostScale = (d: string): number => (d === 'Easy' ? 0 : d === 'Normal' ? 1 : 0.4);

export const enemyHp = (f: number, early = 1): number => 200 + f * 70 - f * f * 0.5 + B.EarlyBoostHp * earlyBoost(f) * early;
export const enemyAttack = (f: number, early = 1): number => (5 + f * 2.8 + f * f * 0.05) * 0.55 + B.EarlyBoostAttack * earlyBoost(f) * early;
/** 후반(LateFloorStart층~)부터 적 HP·공격력이 더 가파르게 오른다: 30층에서 1 + LateHpBonus / 1 + LateAttackBonus. */
/** 중반(강화석이 나오는 MidFloorStart층~LateFloorStart층) 동안 적이 조금씩 더 세진다: 강화 없이 레벨만으로는 버티기 어렵게. 0→1. */
export const midRamp = (f: number): number => clamp((f - B.MidFloorStart) / (B.LateFloorStart - B.MidFloorStart), 0, 1);
export const lateRamp = (f: number): number => clamp((f - B.LateFloorStart + 1) / (B.MaxFloor - B.LateFloorStart + 1), 0, 1);
export const enemyDefense = (f: number): number => 8 + f * 6;
/**
 * 층의 적정 레벨: 승급 조건의 (돌파 층, 레벨) 점들을 직선으로 잇는다 — 3층 Lv5 · 10층 Lv18 · 20층 Lv35 · 28층 Lv55, 그 뒤는 같은 기울기.
 */
export function floorLevel(f: number): number {
  const R = B.PromotionRequirements as number[];
  const pts: [number, number][] = [[1, 1]];
  for (let i = 3; i + 1 < R.length; i += 3) pts.push([R[i], R[i + 1]]);
  let k = pts.findIndex(([pf]) => pf >= f);
  if (k <= 0) k = k === 0 ? 1 : pts.length - 1;
  const [f0, l0] = pts[k - 1];
  const [f1, l1] = pts[k];
  return clamp(l0 + ((f - f0) * (l1 - l0)) / (f1 - f0), 1, B.MaxLevel);
}
/** 적정 레벨 + 여유(3)를 넘은 만큼 경험치·골드 보상이 줄어드는 배율 (1레벨마다 -10%, 최저 20%). */
export const overLevelMult = (level: number, f: number): number =>
  clamp(1 - B.OverLevelPenaltyStep * Math.max(0, level - Math.round(floorLevel(f)) - B.OverLevelGrace), B.OverLevelMinMult, 1);
/** 그 층에서 나오는 스킬서를 고를 기준 레벨: 내 레벨이 높아도 그 층 적정 레벨 + 여유까지만. */
export const rewardLevel = (level: number, f: number): number => Math.min(level, Math.round(floorLevel(f)) + B.OverLevelGrace);
export const enemyExp = (f: number): number => roundEven(10 + B.EnemyExpBase * Math.pow(f, B.EnemyExpExponent));
export const enemyGold = (f: number): number => 8 + f * 6;
export const eventRequirement = (f: number): number => roundEven(6 + f * 1.5);

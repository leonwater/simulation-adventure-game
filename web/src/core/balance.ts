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
export const expToNext = (level: number): number => (level >= B.MaxLevel ? 0 : roundEven(100 * Math.pow(level, 1.5)));

/** 강화 목표 단계 target에 실패했을 때 한 단계 내려갈 확률. */
export const enhanceDowngradeChance = (target: number): number => (target >= 11 ? 0.5 : target >= 7 ? 0.3 : 0);

export const difficultyMultiplier = (d: string): number => (d === 'Easy' ? 0.75 : d === 'Hard' || d === 'Hardcore' ? 1.25 : 1);

/** 초반 보정: 1층 1.0 → 8층 0. 쉬움은 없음, 어려움·하드코어는 40%만. */
export const earlyBoost = (f: number): number => Math.max(0, (B.EarlyBoostUntil - f) / (B.EarlyBoostUntil - 1));
export const earlyBoostScale = (d: string): number => (d === 'Easy' ? 0 : d === 'Normal' ? 1 : 0.4);

export const enemyHp = (f: number, early = 1): number => 200 + f * 70 - f * f * 0.5 + B.EarlyBoostHp * earlyBoost(f) * early;
export const enemyAttack = (f: number, early = 1): number => (5 + f * 2.8 + f * f * 0.05) * 0.55 + B.EarlyBoostAttack * earlyBoost(f) * early;
export const enemyDefense = (f: number): number => 8 + f * 6;
export const enemyExp = (f: number): number => roundEven(10 + 20 * Math.pow(f, 1.5));
export const enemyGold = (f: number): number => 8 + f * 6;
export const eventRequirement = (f: number): number => roundEven(6 + f * 1.5);

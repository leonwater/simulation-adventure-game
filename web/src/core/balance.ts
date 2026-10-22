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

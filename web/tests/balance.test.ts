import { describe, expect, it } from 'vitest';
import { B, hitChance, enemyRequirement, eventChance } from '../src/core/balance';
import { Rng } from '../src/core/rng';

// 기준값은 C# 게임(Core)에서 구한 것: 능력치 50 vs 10층 요구치 34 → 92%, 능력치 15 → 62%
describe('밸런스 공식 (C#과 같은 값)', () => {
  it('명중률: 81% + 차이 × 1%, 62~92%', () => {
    expect(hitChance(50, enemyRequirement(10))).toBeCloseTo(0.92);
    expect(hitChance(15, enemyRequirement(10))).toBeCloseTo(0.62);
    expect(hitChance(35, enemyRequirement(15))).toBeCloseTo(0.70);
    expect(hitChance(50, enemyRequirement(10), -0.12)).toBeCloseTo(0.85);
  });
  it('이벤트 판정: 62% 기본, 30~75% (v2.3)', () => {
    expect(eventChance(11, 10, 5)).toBeCloseTo(0.62 + 0.01 + 0.025);
    expect(eventChance(100, 0, 0)).toBeCloseTo(0.75);
    expect(eventChance(0, 100, 0)).toBeCloseTo(0.30);
  });
  it('내보낸 상수가 C# 값과 같다 (강인함 v2.4, 창고 v2.3)', () => {
    expect(B.ReductionPerToughness).toBeCloseTo(0.0035);
    expect(B.MaxReduction).toBeCloseTo(0.30);
    expect(B.StorageBase).toBe(4);
    expect(B.MaxConsumable).toBe(99);
  });
});

describe('Rng', () => {
  it('같은 시드는 같은 순서', () => {
    const a = new Rng(7), b = new Rng(7);
    for (let i = 0; i < 20; i++) expect(a.nextDouble()).toBe(b.nextDouble());
  });
  it('chance(0.3)은 평균 30% 근처', () => {
    const r = new Rng(1);
    let n = 0;
    for (let i = 0; i < 20000; i++) if (r.chance(0.3)) n++;
    expect(n / 20000).toBeGreaterThan(0.28);
    expect(n / 20000).toBeLessThan(0.32);
  });
});

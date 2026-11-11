import { describe, expect, it } from 'vitest';
import { B, pityBase, pityChance } from '../src/core/balance';
import { Rng } from '../src/core/rng';

// v3.18: 빗나갈수록 오르는 명중 — 같은 행동을 연달아 빗나가면 +단계, 명중하면 처음 확률로. 평균은 표시 확률과 같다.
describe('빗나갈수록 오르는 명중 (v3.18)', () => {
  it('첫 확률은 표시보다 낮고, 빗나갈 때마다 단계만큼 오르며 100%에서 멈춘다', () => {
    const p0 = pityBase(0.8);
    expect(p0).toBeLessThan(0.8);
    expect(pityChance(0.8, 1)).toBeCloseTo(p0 + B.HitPityStep);
    expect(pityChance(0.62, 10)).toBe(1);
    expect(pityChance(0.8, 0, 0)).toBe(0.8);
  });
  it('오래 하면 실제 명중률이 표시 확률과 같다 (오차 0.3%p 안)', () => {
    const rng = new Rng(7);
    for (const p of [0.62, 0.75, 0.85, 0.92]) {
      let misses = 0, hits = 0;
      const n = 200000;
      for (let i = 0; i < n; i++) {
        if (rng.chance(pityChance(p, misses))) {
          hits++;
          misses = 0;
        } else misses++;
      }
      expect(Math.abs(hits / n - p)).toBeLessThan(0.003);
    }
  });
});

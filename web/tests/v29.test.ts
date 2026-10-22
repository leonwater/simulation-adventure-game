import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import { createCharacter } from '../src/core/character';
import { Rng } from '../src/core/rng';
import { shopGrade } from '../src/core/shop';

describe('v2.9', () => {
  it('상점 장비 등급: 희귀 2%(5층~) · 영웅 0.3%(12층~) · 전설은 없다', () => {
    const count = (floor: number): Record<string, number> => {
      const rng = new Rng(3);
      const n: Record<string, number> = {};
      for (let i = 0; i < 200000; i++) {
        const g = shopGrade(rng, floor);
        n[g] = (n[g] ?? 0) + 1;
      }
      return n;
    };
    const early = count(4);
    expect(early.Rare ?? 0).toBe(0);
    expect(early.Epic ?? 0).toBe(0);
    const mid = count(8);
    expect(mid.Rare / 200000).toBeGreaterThan(B.ShopRareChance * 0.9);
    expect(mid.Rare / 200000).toBeLessThan(B.ShopRareChance * 1.1);
    expect(mid.Epic ?? 0).toBe(0);
    const late = count(25);
    expect(late.Epic / 200000).toBeGreaterThan(B.ShopEpicChance * 0.8);
    expect(late.Epic / 200000).toBeLessThan(B.ShopEpicChance * 1.2);
    expect(late.Legendary ?? 0).toBe(0);
  });

  it('강화 보너스는 +6부터 2배, +11부터 3배로 커진다', () => {
    expect(B.EnhanceStepWeight).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
  });

  it('후반 층 적은 더 강하다 (20층부터 30층까지 서서히)', () => {
    expect(B.LateFloorStart).toBe(20);
    expect(B.LateHpBonus).toBeGreaterThan(0);
  });
});

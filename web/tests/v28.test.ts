import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import { createCharacter } from '../src/core/character';
import { cannotEquipReason } from '../src/core/equipment';
import { createGear } from '../src/core/items';
import { merchantGoods } from '../src/core/generator';
import { Rng } from '../src/core/rng';
import { restock } from '../src/core/shop';
import type { ShopGood } from '../src/core/items';

describe('v2.8', () => {
  it('시작 골드 200 · 가방 8칸 (v3.11)', () => {
    const c = createCharacter('a', 'Warrior');
    expect(c.Gold).toBe(200);
    expect(c.Inventory.Capacity).toBe(8);
  });

  it('고급 회복 물약은 정해진 층부터 상점·상인에 나온다', () => {
    const ids = (floor: number): string[] => merchantGoods(new Rng(1), floor).map((g) => g.Item.TemplateId);
    expect(ids(B.HighPotionFirstFloor - 1)).not.toContain('potion_hi');
    expect(ids(B.HighPotionFirstFloor)).toContain('potion_hi');
    const c = createCharacter('a', 'Warrior');
    for (let seed = 1; seed <= 40; seed++) {
      const s = { Equipment: [], Goods: [] as ShopGood[], LastRefreshTicks: 0, RerollCount: 0, Initialized: true };
      restock(s, c, new Rng(seed));
      expect(s.Goods.some((g) => g.Item.TemplateId === 'potion_hi')).toBe(false);
    }
  });

  it('착용 팝업 대상: 직업·레벨이 안 맞는 장비는 착용 불가 사유가 있다', () => {
    const c = createCharacter('a', 'Warrior');
    const tooHigh = createGear('Helmet', 'Common', 30, 'Warrior', 'Strength');
    expect(cannotEquipReason(c, tooHigh)).not.toBeNull();
    const fine = createGear('Helmet', 'Common', 1, 'Warrior', 'Strength');
    expect(cannotEquipReason(c, fine)).toBeNull();
  });
});

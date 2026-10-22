import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import { createCharacter } from '../src/core/character';
import { consumableAt, createGear, sellPrice, stonePrice } from '../src/core/items';
import { treasure } from '../src/core/loot';
import { enemyGold } from '../src/core/balance';
import { Rng } from '../src/core/rng';
import { merchantExtras, refreshPrices, restock } from '../src/core/shop';
import type { ShopGood } from '../src/core/items';

describe('v2.7 골드 조정', () => {
  it('판매가 = 상점가 30%', () => {
    expect(B.SellRatio).toBe(0.3);
    const g = createGear('Helmet', 'Common', 5, 'Warrior', 'Strength');
    expect(sellPrice(g)).toBe(Math.round(g.Price * 0.3));
  });

  it('강화석: +6~+9 1개, +10부터 2개 · 10층부터 상점 판매 (300+15×층)', () => {
    expect(B.EnhanceStones.slice(6)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
    expect(stonePrice(10)).toBe(450);
    const c = createCharacter('a', 'Warrior');
    const s = { Equipment: [], Goods: [] as ShopGood[], LastRefreshTicks: 0, RerollCount: 0, Initialized: true };
    restock(s, c, new Rng(1));
    expect(s.Goods.some((g) => g.Item.Kind === 'EnhanceStone')).toBe(false);
    c.HighestFloorCleared = 9;
    refreshPrices(s, c);
    const stone = s.Goods.find((g) => g.Item.Kind === 'EnhanceStone');
    expect(stone?.Item.Price).toBe(stonePrice(10));
  });

  it('회복 물약 값은 층을 따라 오르고(1층 50G), 귀환하면 지금 층 가격으로 맞춰진다', () => {
    expect(consumableAt('potion', 1).Price).toBe(50);
    expect(consumableAt('potion', 30).Price).toBe(Math.round(50 * (1 + 29 * B.PotionPricePerFloor)));
    expect(consumableAt('antidote', 30).Price).toBe(40); // 해독제류는 그대로
    const c = createCharacter('a', 'Warrior');
    const s = { Equipment: [], Goods: [] as ShopGood[], LastRefreshTicks: 0, RerollCount: 0, Initialized: true };
    restock(s, c, new Rng(1));
    c.HighestFloorCleared = 19;
    refreshPrices(s, c);
    expect(s.Goods.find((g) => g.Item.TemplateId === 'potion')!.Item.Price).toBe(consumableAt('potion', 20).Price);
  });

  it('보물 골드 = 적 골드 × 3~5', () => {
    const c = createCharacter('a', 'Warrior');
    for (let i = 0; i < 200; i++) {
      const g = treasure(7, c, new Rng(i)).Gold;
      expect(g).toBeGreaterThanOrEqual(enemyGold(7) * 3);
      expect(g).toBeLessThanOrEqual(enemyGold(7) * 5);
    }
  });

  it('떠돌이 상인은 낮은 확률로 장비·스킬서를 더 판다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Level = 20;
    let equip = 0, book = 0;
    for (let i = 0; i < 400; i++) {
      const goods: ShopGood[] = [];
      merchantExtras(goods, c, 10, new Rng(i));
      equip += goods.filter((g) => g.Item.Kind === 'Equipment').length;
      book += goods.filter((g) => g.Item.Kind === 'SkillBook').length;
    }
    expect(equip / 400).toBeGreaterThan(B.MerchantEquipChance - 0.08);
    expect(equip / 400).toBeLessThan(B.MerchantEquipChance + 0.08);
    expect(book / 400).toBeGreaterThan(0.1);
    expect(book / 400).toBeLessThan(B.MerchantBookChance + 0.08);
  });
});

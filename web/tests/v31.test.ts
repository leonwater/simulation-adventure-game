import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import { createCharacter } from '../src/core/character';
import { GEARS, GRADES } from '../src/core/enums';
import { eventDef } from '../src/core/events';
import { baseValue } from '../src/core/items';
import type { ShopGood } from '../src/core/items';
import { buyGood, isSoldOut, newShopState } from '../src/core/shop';
import { createConsumable } from '../src/core/items';

describe('v3.1', () => {
  it('같은 레벨에서 등급이 다르면 기본 수치가 언제나 다르다 (등급 배율 + 최소 무기 2 · 그 밖 1)', () => {
    for (const gear of GEARS) {
      for (let lv = 1; lv <= B.MaxLevel; lv++) {
        const step = gear === 'Weapon' ? B.GradeMinStepWeapon : B.GradeMinStepOther;
        for (let g = 1; g < GRADES.length; g++) expect(baseValue(gear, lv, GRADES[g]) - baseValue(gear, lv, GRADES[g - 1]), `${gear} Lv.${lv} ${GRADES[g]}`).toBeGreaterThanOrEqual(step);
      }
    }
    // 레벨이 높으면 배율이 그대로 살아 있다 (전설 ≈ 일반 × 1.9)
    expect(baseValue('Weapon', 60, 'Legendary')).toBe(Math.round(baseValue('Weapon', 60, 'Common') * 1.9));
  });

  it('다 팔린 칸은 목록에 남고(재고 0) 더 살 수 없다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 10000;
    const s = newShopState();
    const good: ShopGood = { Item: createConsumable('potion'), Stock: 2 };
    s.Goods = [good];
    expect(buyGood(s, c, good.Item.Uid, 5).ok).toBe(true);
    expect(s.Goods).toContain(good);
    expect(isSoldOut(good)).toBe(true);
    expect(buyGood(s, c, good.Item.Uid, 1).ok).toBe(false);
  });

  it('정예와 싸우는 이벤트는 이겼을 때의 보상을 힌트에 적는다', () => {
    expect(eventDef('evt_goblin_chase')!.Choices[0].Hint).toContain('2배');
    expect(eventDef('evt_campfire')!.Choices.find((ch) => ch.Success.Battle === 'Wanderer')!.Hint).toContain('골드 4배');
  });
});

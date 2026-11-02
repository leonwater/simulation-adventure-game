import { describe, expect, it } from 'vitest';
import { B, expToNext } from '../src/core/balance';
import {
  AllocationDraft, addExp, allocate, applyDeathExpLoss, armorDefense, attack, autoAllocate, createCharacter, evasion,
  maxHp, ownStat, promotionStatus, recalculateCapacities, skillSlots, storageCapacity, totalStat, tryPromote, equipped,
  setEquipped, 
} from '../src/core/character';
import { JOBS, RANKS } from '../src/core/enums';
import type { Job } from '../src/core/enums';
import { ALL_SKILLS } from '../src/core/skills';
import {
  addItem, canAdd, countOf, createConsumable, createDrop, createEnhanceStone, createGear, createMaterial, createSkillBook,
  goldCost, goldSpent, itemValue, maxGradeForFloor, newContainer, removeTemplate, rollDropGrade, sellPrice, stoneCost, takeItem,
  valueAt,
} from '../src/core/items';
import { compare, enhance, equip, equipSkill, learnSkill, trainSkill, unequip, useSkillBook, trainingCost, successRate, downgradeChance, getSkillState } from '../src/core/equipment';
import { getStat, jobData, setStat } from '../src/core/jobs';
import { Rng } from '../src/core/rng';
import { josa } from '../src/core/names';

const give = (c: ReturnType<typeof createCharacter>, item: ReturnType<typeof createGear>) => {
  addItem(c.Inventory, item);
  return item;
};

describe('캐릭터 (CharacterTests)', () => {
  it('경험치 곡선', () => {
    expect(expToNext(1)).toBe(100);
    expect(expToNext(4)).toBe(985); // 100 × 4^1.65 (v3.9: 1.5 → 1.65)
    expect(expToNext(B.MaxLevel)).toBe(0);
  });

  it('생성: 직업별 시작 능력치·HP', () => {
    const hp: Record<Job, number> = { Warrior: 50 + 16 * 12, Archer: 50 + 10 * 10, Rogue: 50 + 10 * 10, Mage: 50 + 8 * 8 };
    for (const j of JOBS) {
      const c = createCharacter('a', j);
      expect(maxHp(c)).toBe(hp[j]);
      expect(c.CurrentHp).toBe(hp[j]);
      expect(c.Gold).toBe(200);
      expect(c.BaseStats.Values.length).toBe(6);
    }
  });

  it('생성: 빈 이름 기본값, 무기·물약 3개·시작 스킬', () => {
    const c = createCharacter('  ', 'Mage');
    expect(c.Name).toBe('이름 없는 모험가');
    expect(equipped(c, 'Weapon')!.Name).toBe('견습 지팡이');
    expect(countOf(c.Inventory, 'potion')).toBe(3);
    expect(c.Skills.Equipped).toEqual(['m_fireball']);
    expect(c.Inventory.Capacity).toBe(15);
    expect(c.Storage.Capacity).toBe(4);
  });

  it('레벨업: 여러 번 오르고 포인트 3, 최대 레벨에서 멈춘다', () => {
    const c = createCharacter('a', 'Warrior');
    expect(addExp(c, expToNext(1) + expToNext(2) + 10)).toBe(2);
    expect(c.Level).toBe(3);
    expect(c.UnspentPoints).toBe(6);
    expect(c.Exp).toBe(10);
    c.Level = B.MaxLevel - 1;
    c.Exp = 0;
    addExp(c, 1e9);
    expect(c.Level).toBe(B.MaxLevel);
    expect(c.Exp).toBe(0);
    expect(addExp(c, 100)).toBe(0);
  });

  it('레벨업마다 최대 HP 30% 회복', () => {
    const c = createCharacter('a', 'Warrior');
    c.CurrentHp = 10;
    addExp(c, 100);
    expect(c.CurrentHp).toBe(10 + Math.round(maxHp(c) * 0.3));
  });

  it('사망 경험치 감소는 레벨을 내리지 않는다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Exp = 50;
    expect(applyDeathExpLoss(c)).toBe(20);
    expect(c.Exp).toBe(30);
    c.Exp = 5;
    expect(applyDeathExpLoss(c)).toBe(5);
    expect(c.Level).toBe(1);
  });

  it('배분: 직업 능력치만, 상한 99', () => {
    const c = createCharacter('a', 'Warrior');
    c.UnspentPoints = 5;
    expect(allocate(c, 'Strength', 2)).toBe(true);
    expect(allocate(c, 'Intelligence')).toBe(false);
    expect(allocate(c, 'Strength', 4)).toBe(false);
    setStat(c.BaseStats, 'Strength', 99);
    expect(allocate(c, 'Strength')).toBe(false);
  });

  it('자동 배분은 직업 비율에 가까워진다', () => {
    for (const j of JOBS) {
      const c = createCharacter('a', j);
      c.UnspentPoints = 90;
      autoAllocate(c);
      const job = jobData(j);
      job.allocatable.forEach((s, i) => {
        expect(Math.abs(getStat(c.BaseStats, s) - getStat(createCharacter('x', j).BaseStats, s) - (job.autoRatio[i] / 100) * 90)).toBeLessThanOrEqual(1);
      });
      expect(c.UnspentPoints).toBe(0);
    }
  });

  it('배분 초안: 확정할 때만 적용', () => {
    const c = createCharacter('a', 'Archer');
    c.UnspentPoints = 3;
    const d = new AllocationDraft(c);
    d.add('Agility');
    d.add('Agility');
    expect(c.UnspentPoints).toBe(3);
    expect(d.remaining).toBe(1);
    d.remove('Agility');
    d.commit();
    expect(getStat(c.BaseStats, 'Agility')).toBe(14);
    expect(c.UnspentPoints).toBe(2);
    d.auto();
    expect(d.remaining).toBe(0);
  });

  it('공식: 공격력·회피·강인함', () => {
    const c = createCharacter('a', 'Warrior');
    expect(attack(c)).toBe(12 * 5 + itemValue(equipped(c, 'Weapon')!));
    const r = createCharacter('r', 'Rogue');
    expect(evasion(r)).toBeCloseTo(12 * 0.005, 9);
  });

  it('배지는 자체 능력치에만 곱한다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Rank = 'S';
    expect(ownStat(c, 'Vitality')).toBe(Math.floor(16 * 1.16));
    const ring = createGear('Ring', 'Common', 1, 'Warrior', 'Vitality');
    setEquipped(c, 'Ring1', ring);
    expect(totalStat(c, 'Vitality')).toBe(Math.floor(16 * 1.16) + itemValue(ring));
  });

  it('승급은 세 조건을 모두 채워야 하고 SS에서 멈춘다', () => {
    const c = createCharacter('a', 'Warrior');
    expect(promotionStatus(c).canPromote).toBe(false);
    c.HighestFloorCleared = 3;
    c.Level = 5;
    expect(tryPromote(c)).toBe(false);
    c.QuestsCompleted = 3;
    c.HighestFloorCleared = 3;
    c.Level = 5;
    const st = promotionStatus(c);
    expect([st.floorRequired, st.levelRequired, st.questsRequired]).toEqual([0, 0, 0].map((_, i) => B.PromotionRequirements[3 + i]));
    c.Rank = 'SS';
    expect(promotionStatus(c).isMaxRank).toBe(true);
    expect(tryPromote(c)).toBe(false);
  });

  it('등급에 따라 스킬 슬롯·창고가 늘어난다', () => {
    expect(RANKS.map(skillSlots)).toEqual([3, 3, 4, 4, 5, 5, 6, 6]);
    expect(storageCapacity('F')).toBe(4);
    expect(storageCapacity('SS')).toBe(18);
    const c = createCharacter('a', 'Warrior');
    c.Rank = 'C';
    c.BagsBought = 3;
    recalculateCapacities(c);
    expect([c.Inventory.Capacity, c.Storage.Capacity]).toEqual([30, 10]);
  });
});

describe('아이템 (ItemSkillTests)', () => {
  it('보관함: 99개까지 겹치고 나뉜다', () => {
    const box = newContainer(5);
    expect(addItem(box, createMaterial('mat_slime', 150))).toBe(true);
    expect(box.Items.map((i) => i.Count)).toEqual([99, 51]);
    expect(addItem(box, createMaterial('mat_slime', 48))).toBe(true);
    expect(box.Items.map((i) => i.Count)).toEqual([99, 99]);
  });

  it('소모품은 종류마다 99개 제한', () => {
    const box = newContainer(20);
    expect(addItem(box, createConsumable('potion', 90))).toBe(true);
    expect(canAdd(box, createConsumable('potion', 10))).toBe(false);
    expect(canAdd(box, createConsumable('potion', 9))).toBe(true);
  });

  it('여러 칸에 걸친 제거·일부 꺼내기', () => {
    const box = newContainer(5);
    addItem(box, createMaterial('mat_slime', 150));
    expect(removeTemplate(box, 'mat_slime', 200)).toBe(false);
    expect(removeTemplate(box, 'mat_slime', 120)).toBe(true);
    expect(countOf(box, 'mat_slime')).toBe(30);
    const taken = takeItem(box, box.Items[0].Uid, 10)!;
    expect(taken.Count).toBe(10);
    expect(countOf(box, 'mat_slime')).toBe(20);
  });

  it('장비 비교·착용 조건·반지 두 칸·해제 공간', () => {
    const c = createCharacter('a', 'Warrior');
    c.Level = 5;
    const sword = give(c, createGear('Weapon', 'Rare', 5, 'Warrior', 'Vitality'));
    const delta = compare(c, sword)[0];
    expect(delta.delta).toBe(itemValue(sword) - itemValue(equipped(c, 'Weapon')!));

    const bow = give(c, createGear('Weapon', 'Common', 1, 'Archer', 'Vitality'));
    expect(equip(c, bow.Uid).error).toBe('궁수 전용입니다');
    const high = give(c, createGear('Helmet', 'Common', 20, 'Warrior', 'Vitality'));
    expect(equip(c, high.Uid).error).toBe('Lv.20 이상 착용 가능');

    const r1 = give(c, createGear('Ring', 'Common', 1, 'Warrior', 'Vitality'));
    const r2 = give(c, createGear('Ring', 'Common', 1, 'Warrior', 'Strength'));
    expect(equip(c, r1.Uid).ok).toBe(true);
    expect(equip(c, r2.Uid).ok).toBe(true);
    expect(equipped(c, 'Ring1')).toBe(r1);
    expect(equipped(c, 'Ring2')).toBe(r2);

    expect(equip(c, sword.Uid).ok).toBe(true);
    expect(c.Inventory.Items.some((i) => i.Name === '낡은 검')).toBe(true);

    c.Inventory.Capacity = c.Inventory.Items.length;
    expect(unequip(c, 'Ring1').error).toBe('가방이 가득 찼습니다');
  });

  it('방어력은 방어구만 합친다', () => {
    const c = createCharacter('a', 'Warrior');
    const h = createGear('Helmet', 'Common', 1, 'Warrior', 'Vitality');
    const n = createGear('Necklace', 'Common', 1, 'Warrior', 'Vitality');
    setEquipped(c, 'Helmet', h);
    setEquipped(c, 'Necklace', n);
    expect(armorDefense(c)).toBe(itemValue(h));
  });

  it('층별 최고 등급과 드롭 등급 가중치', () => {
    expect([1, 4, 5, 11, 12, 19, 20].map((f) => maxGradeForFloor(f))).toEqual(['Uncommon', 'Uncommon', 'Rare', 'Rare', 'Epic', 'Epic', 'Legendary']);
    const rng = new Rng(1);
    for (let i = 0; i < 500; i++) {
      expect(['Common', 'Uncommon']).toContain(rollDropGrade(rng, 1, 0));
      expect(rollDropGrade(rng, 30, 1)).not.toBe('Legendary');
    }
  });

  it('드롭 장비는 내 직업이 70%', () => {
    const c = createCharacter('a', 'Mage');
    const rng = new Rng(7);
    let own = 0;
    let weapons = 0;
    for (let i = 0; i < 6000; i++) {
      const it = createDrop(rng, 'Common', 3, c);
      if (it.Gear === 'Weapon') {
        weapons++;
        if (it.JobRestriction === 3) own++;
      }
    }
    expect(own / weapons).toBeGreaterThan(0.65);
    expect(own / weapons).toBeLessThan(0.75);
  });

  it('강화: 값·비용·확률표', () => {
    const w = createGear('Weapon', 'Common', 10, 'Warrior', 'Vitality');
    expect(w.BaseValue).toBe(26);
    expect(valueAt(w, 1)).toBe(27);
    expect(valueAt(w, 15)).toBe(26 + 39); // 보너스 단계 30 × 5% × 26 = 39 (v3.9: 2% → 5%)
    expect(goldCost(w)).toBe(60);
    w.Enhance = 2;
    expect(goldSpent(w)).toBe(30 * 1 * 2 + 30 * 2 * 2);
    w.Enhance = 0;
    expect([1, 2, 3, 4, 5, 6, 7, 11].map((t) => (w.Enhance = t - 1, successRate(w)))).toEqual([1, 1, 1, 0.95, 0.9, 0.8, 0.7, 0.3]);
    w.Enhance = 6;
    expect(downgradeChance(w)).toBe(0.3);
    w.Enhance = 10;
    expect(downgradeChance(w)).toBe(0.5);
    w.Enhance = 5;
    expect(stoneCost(w)).toBe(1);
  });

  it('강화: +5까지 안전, 이후 강화석 필요, 판매가에 환급', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 1e6;
    const w = equipped(c, 'Weapon')!;
    const rng = new Rng(3);
    for (let i = 0; i < 3; i++) expect(enhance(c, w.Uid, rng).result).toBe('Success');
    expect(w.Enhance).toBe(3);
    w.Enhance = 5;
    expect(enhance(c, w.Uid, rng).error).toBe('강화석이 부족합니다');
    addItem(c.Inventory, createEnhanceStone(5));
    expect(enhance(c, w.Uid, rng).result).not.toBe('NotAllowed');
    expect(sellPrice(w)).toBeGreaterThan(Math.round(w.Price * 0.5));
  });

  it('스킬: 장착 조건·슬롯, 스킬서는 한 번만', () => {
    const c = createCharacter('a', 'Warrior');
    expect(equipSkill(c, 'w_bash').error).toBe('이미 장착했습니다');
    const strong = ALL_SKILLS.find((s) => s.JobRestriction === 0 && s.Tier === 'Top')!;
    learnSkill(c, strong.Id);
    expect(equipSkill(c, strong.Id).error).toBe(`장착 조건 Lv.${strong.ReqLevel} · ${strong.ReqRank} 등급`);
    expect(learnSkill(c, 'a_aim')).toBe(false);

    const book = give(c, createSkillBook('w_guard') as any);
    expect(useSkillBook(c, book.Uid).ok).toBe(true);
    expect(countOf(c.Inventory, 'book_w_guard')).toBe(0);
    const again = give(c, createSkillBook('w_guard') as any);
    expect(useSkillBook(c, again.Uid).error).toBe('이미 배운 스킬입니다');
  });

  it('수련: 비용 200×단계, 최대 5 (비전투 스킬은 따로)', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 10000;
    expect(trainingCost(getSkillState(c, 'w_bash')!)).toBe(200);
    for (let i = 0; i < 5; i++) expect(trainSkill(c, 'w_bash').ok).toBe(true);
    expect(c.Gold).toBe(10000 - 200 * 15);
    expect(trainSkill(c, 'w_bash').error).toBe('최대 강화 단계입니다');
    const onlyStatus = ALL_SKILLS.find((s) => s.JobRestriction === 0 && !s.IsAttack && s.HealRatio === 0)!;
    learnSkill(c, onlyStatus.Id);
    expect(trainSkill(c, onlyStatus.Id).ok).toBe(true); // v2.6: 비전투 스킬도 수련 (최대 2단계)
  });

  it('모든 스킬서·재료가 만들어진다', () => {
    for (const s of ALL_SKILLS) expect(createSkillBook(s.Id).Price).toBeGreaterThan(0);
    expect(() => createMaterial('mat_slime')).not.toThrow();
  });

  it('조사 붙이기', () => {
    expect(josa('검', '을/를')).toBe('검을');
    expect(josa('활', '으로/로')).toBe('활로');
    expect(josa('포션', '이/가')).toBe('포션이');
  });
});

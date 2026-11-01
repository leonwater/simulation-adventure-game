// P3 패리티: V16Tests · V17Tests · V18Tests · V19Tests 중 웹에 없던 것 (이미 덮인 것은 다른 파일 참고).
import { describe, expect, it } from 'vitest';
import { B, enemyHp, expToNext, roundEven } from '../src/core/balance';
import { Battle, damage } from '../src/core/battle';
import type { BattleChoice } from '../src/core/battle';
import { equipBossTraits } from '../src/core/bosskit';
import {
  addExp, allocate, AllocationDraft, autoAllocate, createCharacter, equipped, maxChallengeFloor, storageCapacity,
} from '../src/core/character';
import { Combatant } from '../src/core/combatant';
import { currentRoom, moveOptions, newRun } from '../src/core/dungeon';
import type { RoomEnterResult } from '../src/core/dungeon';
import { createBoss, createEnemy, createTutorialGroup } from '../src/core/enemies';
import { enhance, downgradeChance, equipSkill, learnSkill, powerMultiplier } from '../src/core/equipment';
import { JOBS, RANKS } from '../src/core/enums';
import type { Job, RoomType } from '../src/core/enums';
import { merchantGoods } from '../src/core/generator';
import { acceptQuest, inRange, newGuildState, NEXT_FLOOR_QUESTS, questKey, refreshBoard } from '../src/core/guild';
import {
  addItem, countOf, createConsumable, createEnhanceStone, createGear, createRandomGear, createSkillBook, ENHANCE_STONE_ID, goldCost, goldSpent,
  isWeapon, itemValue, sellPrice,
} from '../src/core/items';
import { getStat, jobData, rollItemJob, setStat } from '../src/core/jobs';
import { lootLines, treasure } from '../src/core/loot';
import { getRoom, newFloorMap, newRoom } from '../src/core/map';
import { monster } from '../src/core/monsters';
import { Rng } from '../src/core/rng';
import { MemorySaveStore } from '../src/core/save';
import { GameSession } from '../src/core/session';
import { buyGood, newShopState, sellMany } from '../src/core/shop';
import { ALL_SKILLS, skillDef } from '../src/core/skills';
import { isDebuff } from '../src/core/status';
import { pickBattleChoice } from '../src/sim/bot';

const clockAt = (day: number) => () => new Date(Date.UTC(2026, 9, day, 9, 0, 0));
const session = (seed = 1, day = 19, store = new MemorySaveStore()) => new GameSession(store, clockAt(day), seed);

function win(s: GameSession): void {
  let guard = 0;
  while (s.battle && !s.battle.isOver && guard++ < 200) {
    s.battle.player.hp = s.battle.player.maxHp;
    s.executeBattle(pickBattleChoice(s.battle));
  }
  expect(s.battle!.outcome).toBe('Victory');
  s.closeBattle();
}

describe('V16Tests (튜토리얼 귀환·퀘스트·초반 보정·방 알림)', () => {
  it('Tutorial_BossClearMustReturnToTown', () => {
    const s = session();
    s.newGame('a', 'Warrior', 'Normal');
    s.enterDungeon();
    expect(s.inTutorialRun).toBe(true);
    const bossId = s.run!.Map.BossId;
    s.run!.CurrentRoomId = s.run!.Map.Rooms.find((r) => r.Links.includes(bossId))!.Id;
    currentRoom(s.run!).Visited = currentRoom(s.run!).Cleared = true;
    expect(s.move(bossId) as RoomEnterResult).toBe('Boss');
    win(s);
    expect(s.run!.BossDefeated).toBe(true);
    expect(s.canDescend).toBe(false);
    expect(() => s.descend()).toThrow();
    expect(s.canReturn).toBe(true);

    // 튜토리얼을 다시 보는 중(일반 층)이어도 마찬가지
    s.returnToTown();
    s.c.HighestFloorCleared = 4;
    s.restartTutorial();
    s.selectFloor(2);
    s.enterDungeon();
    expect(s.run!.IsTutorial).toBe(false);
    expect(s.inTutorialRun).toBe(true);
    s.run!.BossDefeated = true;
    expect(s.canDescend).toBe(false);
    s.returnToTown();
    s.setTutorial('Done');
    s.enterDungeon();
    s.run!.BossDefeated = true;
    expect(s.canDescend).toBe(true);
  });

  it('Quests_NoDuplicateTargetsAndRankFollowsDifficulty', () => {
    const rng = new Rng(3);
    for (let k = 0; k < 200; k++) {
      const c = createCharacter('a', JOBS[k % 4]);
      c.Rank = RANKS[k % 8];
      c.HighestFloorCleared = k % 30;
      const g = newGuildState();
      refreshBoard(g, c, rng);
      expect(g.Board.length).toBeGreaterThan(0);
      const keys = new Set<string>();
      const titles = new Set<string>();
      const next = maxChallengeFloor(c);
      for (const q of g.Board) {
        expect(keys.has(questKey(q)), '같은 대상의 퀘스트가 둘: ' + q.Title).toBe(false);
        keys.add(questKey(q));
        expect(titles.has(q.Title), '같은 이름의 퀘스트가 여러 등급: ' + q.Title).toBe(false);
        titles.add(q.Title);
        if (q.TargetFloor !== next) expect(inRange(c.Rank, q.Rank), '다음 층 의뢰 외에는 수락할 수 있는 등급만').toBe(true);
      }
      expect(g.Board.filter((q) => q.TargetFloor === next).length, '다음에 도전할 층 의뢰는 최소 2개').toBeGreaterThanOrEqual(NEXT_FLOOR_QUESTS);
      // 진행 중인 퀘스트와도 겹치지 않는다
      acceptQuest(g, c, g.Board[0].Id);
      if (g.Active.length === 0) continue;
      const active = g.Active[0];
      refreshBoard(g, c, rng);
      expect(g.Board.some((q) => questKey(q) === questKey(active))).toBe(false);
    }
  });

  it('Quests_BossClearPostsNextFloorQuests', () => {
    const s = session(8, 19);
    s.newGame('a', 'Warrior', 'Normal');
    s.setTutorial('Done');
    s.enterDungeon();
    s.run!.BossDefeated = true;
    s.c.HighestFloorCleared = 1;
    s.returnToTown();
    expect(maxChallengeFloor(s.c)).toBe(2);
    expect(s.data!.Guild.Board.filter((q) => q.TargetFloor === 2).length, '보스를 잡고 돌아오면 새 층 의뢰가 붙는다').toBeGreaterThanOrEqual(NEXT_FLOOR_QUESTS);
  });

  it('EarlyBoost_NormalOnlyAndNotInTutorial', () => {
    const sp = { ...monster('goblin')!, Trait: undefined }; // 종류 특색(v3.0)은 빼고 초반 보정만 본다
    const normal = createEnemy(sp, 1, 'Normal', 0);
    const easy = createEnemy(sp, 1, 'Easy', 0);
    expect(enemyHp(1)).toBeGreaterThan(enemyHp(1, 0));
    expect(enemyHp(8)).toBeCloseTo(enemyHp(8, 0), 9); // 8층부터는 보정 없음
    expect(easy.maxHp).toBe(roundEven(enemyHp(1, 0) * 0.75)); // 쉬움은 보정 없음
    expect(normal.maxHp).toBe(roundEven(enemyHp(1) * 1.0));
    const tutorial = createTutorialGroup(false, 'Normal')[0];
    expect(Math.abs(tutorial.maxHp - roundEven(enemyHp(1, 0)))).toBeLessThanOrEqual(1); // 튜토리얼 적은 보정 없이
  });

  it('RoomNotice_TreasureRestBattleAndEvent', () => {
    const s = session(6, 19);
    s.newGame('a', 'Rogue', 'Normal');
    s.setTutorial('Done');
    s.enterDungeon();
    const run = s.run!;
    const adjacent = (t: RoomType) => {
      const r = run.Map.Rooms.find((x) => x.Type === t && !x.Visited)!;
      const cur = currentRoom(run);
      if (!cur.Links.includes(r.Id)) cur.Links.push(r.Id);
      if (!r.Links.includes(cur.Id)) r.Links.push(cur.Id);
      return r;
    };

    s.move(adjacent('Treasure').Id);
    expect(s.notice!.Title).toBe('보물 발견!');
    expect(lootLines(s.notice!).length, '보물 목록을 한 줄씩').toBeGreaterThan(0);

    s.c.CurrentHp = 1;
    s.move(adjacent('Rest').Id);
    expect(s.notice!.Title).toBe('모닥불에서 휴식');
    expect(s.notice!.Lines[0].startsWith('HP ')).toBe(true);

    s.move(adjacent('Battle').Id);
    expect(s.notice, '다른 방에 들어가면 알림이 바뀐다').toBeNull();
    win(s);
    expect(s.notice!.Title).toBe('전투 승리');

    const ev = adjacent('Event');
    ev.EventId = 'evt_torn_map';
    s.move(ev.Id);
    s.chooseEvent(0);
    expect(s.notice!.Title).toBe('찢어진 지도');
    expect(s.notice!.Lines.length).toBeGreaterThan(0);
  });
});

describe('V17Tests (능력치 최대값)', () => {
  const maxLevel = (job: Job) => {
    const c = createCharacter('a', job);
    while (c.Level < B.MaxLevel) addExp(c, expToNext(c.Level));
    return c;
  };

  it('StatCaps_StopAllocationAndAutoAllocation', () => {
    for (const job of JOBS) {
      const c = maxLevel(job);
      expect(c.UnspentPoints).toBe((B.MaxLevel - 1) * B.PointsPerLevel);
      const attack = jobData(job).attackStat;
      // 한 능력치에 몰아도 최대값에서 멈춘다
      while (allocate(c, attack)) { /* 최대값까지 */ }
      expect(getStat(c.BaseStats, attack)).toBe(B.StatCap);
      expect(c.UnspentPoints).toBeGreaterThan(0);
      // 나머지는 자동 배분이 최대값을 지키며 나눈다
      autoAllocate(c);
      for (const st of jobData(job).allocatable) expect(getStat(c.BaseStats, st), st).toBeLessThanOrEqual(B.StatCap);
      expect(c.UnspentPoints, '다섯 능력치 최대값 합이면 포인트를 모두 쓸 수 있다').toBe(0);
    }

    const d = maxLevel('Mage');
    const draft = new AllocationDraft(d);
    let guard = 0;
    while (draft.add('Luck') && guard++ < 500) { /* 최대값까지 */ }
    expect(getStat(d.BaseStats, 'Luck') + draft.pendingOf('Luck')).toBe(B.StatCap);
    expect(draft.canAdd('Luck')).toBe(false);
  });

  it('StatCaps_OldSaveOverCapIsRefunded', () => {
    const store = new MemorySaveStore();
    const s = session(3, 20, store);
    s.newGame('a', 'Warrior', 'Normal');
    setStat(s.c.BaseStats, 'Strength', 150);
    s.c.UnspentPoints = 2;
    s.save();
    expect(s.continueGame()).toBe(true);
    expect(getStat(s.c.BaseStats, 'Strength')).toBe(B.StatCap);
    expect(s.c.UnspentPoints).toBe(2 + 150 - B.StatCap);
  });
});

describe('V18Tests (성공률·도적·장비·드롭·상인·승급·이동 순서·복구)', () => {
  it('SuccessRates_RaisedBySevenPoints', () => {
    expect(B.BaseHit).toBeCloseTo(0.81, 9);
    expect(B.MaxHit).toBeCloseTo(0.92, 9);
    expect(B.BaseFlee).toBeCloseTo(0.67, 9);
    expect(B.MaxFlee).toBeCloseTo(0.87, 9);
    expect(B.StatCap).toBe(99);
  });

  it('Rogue_EightyPercentSkillsAndKeenCruelBuffs', () => {
    expect(B.CritMultiplier).toBeCloseTo(2.3, 9);
    expect(skillDef('r_ambush')!.DamageMult).toBeCloseTo(1.1, 9); // 기습 140% × 0.8
    expect(skillDef('r_assassin')!.DamageMult).toBeCloseTo(2.0, 9); // 암살 200% (v2.2)
    expect(skillDef('r_keen')!.Statuses[0].Type).toBe('Keen');
    expect(skillDef('r_cruel')!.Statuses[0].Type).toBe('Cruel');
    expect(isDebuff('Keen')).toBe(false);
    expect(isDebuff('Cruel')).toBe(false);

    const player = new Combatant();
    player.attack = 100;
    player.maxHp = player.hp = 100;
    const target = new Combatant();
    target.attack = 1;
    target.maxHp = target.hp = 10000;
    expect(Math.abs(damage(player, target, 1.0, true) - Math.round(100 * 2.3))).toBeLessThanOrEqual(1);
    player.statuses.apply('Cruel', 50, 3);
    expect(Math.abs(damage(player, target, 1.0, true) - Math.round(100 * 2.8))).toBeLessThanOrEqual(1); // 잔혹함 +50%
  });

  it('Keen_RaisesSkillCritChance', () => {
    const c = createCharacter('a', 'Rogue');
    c.Level = 20;
    learnSkill(c, 'r_venom');
    equipSkill(c, 'r_venom');
    const e = createEnemy(monster('goblin')!, 1, 'Normal', 0);
    e.maxHp = e.hp = 1000000;
    e.requirement = -1000;
    const b = new Battle(c, 1, [e], false, new Rng(3));
    const detail = () => b.getChoices().find((x: BattleChoice) => x.skillId === 'r_venom')!.detail;
    // F 등급 도적 급소 +2% (v3.7)
    expect(detail()).toContain('치명타 확률 22%');
    b.player.statuses.apply('Keen', 25, 3);
    expect(detail()).toContain('치명타 확률 47%');
  });

  it('Equipment_GradeGapAndEnhanceGrowth', () => {
    const common = createGear('Weapon', 'Common', 20, 'Warrior', 'Luck');
    const legend = createGear('Weapon', 'Legendary', 20, 'Warrior', 'Luck');
    expect(Math.abs(legend.BaseValue - Math.round(common.BaseValue * 1.9))).toBeLessThanOrEqual(1); // 전설은 일반의 1.9배 (v2.9)
    common.Enhance = legend.Enhance = 10;
    expect(Math.abs(itemValue(common) - Math.round(common.BaseValue * 1.3))).toBeLessThanOrEqual(1); // 일반 +10 = 보너스 단계 15 × 2% = +30%
    expect(Math.abs(itemValue(legend) - Math.round(legend.BaseValue * 1.6))).toBeLessThanOrEqual(1); // 전설 +10 = 15 × 4% = +60%
  });

  it('EnhancedGear_SellsForMore', () => {
    const item = createGear('Armor', 'Rare', 10, 'Warrior', 'Luck');
    const plain = sellPrice(item);
    item.Enhance = 5;
    const spent = goldSpent(item);
    expect(spent).toBe(Math.round(30 * 15 * 2.0 * 1.7)); // 30 × (1+2+3+4+5) × (1 + Lv.10 ÷ 10) × 희귀 1.7
    expect(Math.abs(sellPrice(item) - (plain + spent / 2))).toBeLessThanOrEqual(1); // 강화에 든 골드의 절반을 더 받는다
  });

  it('ItemJob_SeventyPercentOwnTenPercentEachOther', () => {
    const rng = new Rng(9);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 20000; i++) counts[JOBS.indexOf(rollItemJob('Archer', rng))]++;
    const archer = JOBS.indexOf('Archer');
    expect(counts[archer] / 20000).toBeGreaterThanOrEqual(0.68);
    expect(counts[archer] / 20000).toBeLessThanOrEqual(0.72);
    JOBS.forEach((j, i) => {
      if (i === archer) return;
      expect(counts[i] / 20000, j).toBeGreaterThanOrEqual(0.085);
      expect(counts[i] / 20000, j).toBeLessThanOrEqual(0.115);
    });

    let own = 0;
    let weapons = 0;
    for (let i = 0; i < 4000; i++) {
      const item = createRandomGear(rng, 'Common', 10, 'Archer');
      if (!isWeapon(item)) continue;
      weapons++;
      if (item.JobRestriction === archer) own++;
    }
    expect(own / weapons, '무기도 지금 직업 70%').toBeGreaterThanOrEqual(0.65);
    expect(own / weapons, '무기도 지금 직업 70%').toBeLessThanOrEqual(0.75);
  });

  it('DungeonMerchant_HasPurchaseLimit', () => {
    const goods = merchantGoods(new Rng(4));
    const c = createCharacter('a', 'Warrior');
    c.Inventory.Items.length = 0;
    c.Gold = 1000000;
    const state = newShopState();
    state.Goods = goods;
    const potion = goods.find((g) => g.Item.TemplateId === 'potion')!;
    const stock = potion.Stock;
    expect(stock).toBeGreaterThanOrEqual(B.MerchantStockMin);
    expect(stock).toBeLessThanOrEqual(B.MerchantStockMax);
    expect(buyGood(state, c, potion.Item.Uid, 99).ok).toBe(true);
    expect(countOf(c.Inventory, 'potion'), '남은 수량까지만 산다').toBe(stock);
    expect(potion.Stock, '다 팔리면 칸은 판매 완료(재고 0)로 남는다 (v3.1)').toBe(0);
    expect(buyGood(state, c, potion.Item.Uid, 1).ok).toBe(false);
  });

  it('ShopSellMany_SellsWholeStacks', () => {
    const c = createCharacter('a', 'Warrior');
    c.Inventory.Items.length = 0;
    const a = createConsumable('potion', 3);
    const b = createGear('Boots', 'Common', 5, 'Warrior', 'Luck');
    addItem(c.Inventory, a);
    addItem(c.Inventory, b);
    const expected = sellPrice(a) * 3 + sellPrice(b);
    expect(sellMany(c, [a.Uid, b.Uid])).toBe(expected);
    expect(c.Inventory.Items.length).toBe(0);
  });

  it('Promotion_HappensAutomaticallyOnSave', () => {
    const s = session(1, 20);
    s.newGame('a', 'Mage', 'Normal');
    s.setTutorial('Done');
    s.c.HighestFloorCleared = 6;
    s.c.Level = 10;
    s.c.QuestsCompleted = 8;
    s.save();
    expect(s.c.Rank, 'F → E → D 두 번 승급').toBe('D');
    expect(s.promotions).toEqual(['E', 'D']);
    expect(s.c.Storage.Capacity, '창고 칸 등 배지 효과가 바로 적용').toBe(storageCapacity('D'));
  });

  it('MoveOptions_FixedOrderUpLeftRightDown', () => {
    const map = newFloorMap(3, 'Branch');
    const center = newRoom(0, 1, 1);
    center.Visited = center.Cleared = true;
    map.Rooms.push(center);
    const dirs: [number, number][] = [[2, 1], [1, 2], [0, 1], [1, 0]]; // 오른쪽 · 아래 · 왼쪽 · 위 (섞어서)
    for (const [x, y] of dirs) {
      const r = newRoom(map.Rooms.length, x, y);
      r.Visited = x === 0;
      map.Rooms.push(r);
      center.Links.push(r.Id);
    }
    const run = newRun(3, map);
    run.CurrentRoomId = 0;
    const order = moveOptions(run, 'Normal').map((o) => o.Direction.split(' ')[0]);
    expect(order, '탐험한 방도 자리가 고정').toEqual(['위', '왼쪽', '오른쪽', '아래']);
    void getRoom;
  });

  it('Continue_BrokenRunAfterUpdate_StartsInTown', () => {
    const store = new MemorySaveStore();
    const s = session(2, 20, store);
    s.newGame('a', 'Warrior', 'Normal');
    s.setTutorial('Done');
    s.enterDungeon();
    const room = s.run!.Map.Rooms.find((r) => r.Type === 'Battle')!;
    s.run!.CurrentRoomId = room.Id;
    room.Cleared = false;
    s.run!.Effects.push(null as never); // 예전 버전 데이터처럼 이어 갈 수 없는 진행
    s.save();
    const level = s.c.Level;

    const again = session(2, 20, store);
    expect(again.continueGame()).toBe(true);
    expect(again.inDungeon, '던전 진행만 버리고 마을에서').toBe(false);
    expect(again.c.Level, '캐릭터는 그대로').toBe(level);
  });
});

describe('V19Tests (기본 공격 명중·스킬 등급·강화 +15·보스 체격·스킬서)', () => {
  it('BasicAttack_HasTheHighestHitChance', () => {
    for (const s of ALL_SKILLS) {
      if (s.Target === 'Self') continue;
      expect(s.SuccessBonus, s.Id + ': 모든 스킬은 기본 공격보다 덜 맞는다').toBeLessThan(0);
      expect(s.SuccessBonus, s.Id + ' 보정은 -12%까지').toBeGreaterThanOrEqual(-0.12 - 1e-9);
      const total = (s.ChainMults.length > 0 ? s.ChainMults[0] : s.DamageMult) * s.Hits;
      const strong = (['AllEnemies', 'RandomEnemies', 'Column'].includes(s.Target) && s.IsAttack) || s.GuaranteedCrit || total >= 2.5;
      if (strong) expect(s.SuccessBonus, s.Id + ' 광역·고위력 -8~12%').toBeLessThanOrEqual(-0.08 + 1e-9);
      else expect(s.SuccessBonus, s.Id + ' 저위력 -3~6%').toBeGreaterThanOrEqual(-0.06 - 1e-9);
    }
  });

  it('HigherTierSkills_HitHarderAndGrowFaster', () => {
    expect(powerMultiplier(skillDef('m_fireball')!, 3)).toBeLessThan(powerMultiplier(skillDef('m_overload')!, 3));
    expect(powerMultiplier(skillDef('m_fireball')!, 3)).toBeCloseTo(1.24, 9); // 하급 +8%/단계
    expect(powerMultiplier(skillDef('m_meteor')!, 3)).toBeCloseTo(1.36, 9); // 상급 +12%/단계
    expect(skillDef('m_overload')!.DamageMult).toBeGreaterThanOrEqual(4.0); // 최상급 기본 피해
  });

  it('Enhance_UpToFifteen_FailureCanDowngrade', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 100_000_000;
    addItem(c.Inventory, createEnhanceStone(99));
    const weapon = equipped(c, 'Weapon')!;
    weapon.Enhance = 11;
    const rng = new Rng(5);
    let downs = 0;
    let fails = 0;
    for (let i = 0; i < 400; i++) {
      weapon.Enhance = 11;
      const r = enhance(c, weapon.Uid, rng).result;
      if (r === 'Downgraded') {
        downs++;
        expect(weapon.Enhance).toBe(10);
      }
      if (r === 'Failed') fails++;
      if (countOf(c.Inventory, ENHANCE_STONE_ID) < 3) addItem(c.Inventory, createEnhanceStone(99));
    }
    expect(downs / (downs + fails), '+12 도전 실패의 절반은 강등').toBeGreaterThanOrEqual(0.4);
    expect(downs / (downs + fails), '+12 도전 실패의 절반은 강등').toBeLessThanOrEqual(0.6);
    weapon.Enhance = 5;
    expect(downgradeChance(weapon), '+6 도전은 강등 없음').toBe(0);
    weapon.Enhance = 7;
    expect(downgradeChance(weapon)).toBeCloseTo(0.3, 9);
  });

  it('BossTraits_ChangeBodyStats', () => {
    expect(createBoss(18, 'Normal', 1)).toBeTruthy();
    const sp = monster('maneater')!;
    const plain = createEnemy(sp, 20, 'Normal', 2);
    const boss = createEnemy(sp, 20, 'Normal', 2);
    equipBossTraits(boss, 20);
    expect(boss.defense, '가시 비늘 보스는 방어력이 높다').toBeGreaterThan(plain.defense);
    const orc = createEnemy(monster('orc')!, 10, 'Normal', 2);
    const atk = orc.attack;
    equipBossTraits(orc, 10);
    expect(orc.attack, '혼신의 일격 보스는 공격력이 높다').toBeGreaterThan(atk);
  });

  it('EnhanceStones_DropFromTwoFloorsBeforeTheyAreNeeded', () => {
    // RecommendedEnhance(적정 강화 = 층 ÷ 2)는 TS에 이식하지 않았다 (UI 안내 전용) — 12층 적정 +6의 강화석 필요 시작 +6, 2층 앞 = 10층
    expect(B.EnhanceStones[6]).toBeGreaterThan(0);
    expect(B.EnhanceStones[5]).toBe(0);
    expect(B.StoneFirstFloor).toBe(10);
    const c = createCharacter('a', 'Warrior');
    const rng = new Rng(4);
    for (let i = 0; i < 300; i++) expect(treasure(9, c, rng).Items.some((x) => x.Kind === 'EnhanceStone'), '9층 보물에는 강화석 없음').toBe(false);
    let seen = false;
    for (let i = 0; i < 300 && !seen; i++) seen = treasure(10, c, rng).Items.some((x) => x.Kind === 'EnhanceStone');
    expect(seen, '10층부터 강화석').toBe(true);
  });

  it('EnhanceCost_GrowsWithItemLevelAndGrade', () => {
    const low = createGear('Weapon', 'Common', 10, 'Warrior', 'Luck');
    const high = createGear('Weapon', 'Legendary', 50, 'Warrior', 'Luck');
    low.Enhance = high.Enhance = 5;
    expect(goldCost(low)).toBe(30 * 6 * 2); // 30 × +6 × (1 + 10 ÷ 10) × 일반 1.0
    expect(goldCost(high)).toBe(30 * 6 * 6 * 3); // 30 × +6 × (1 + 50 ÷ 10) × 전설 3.0
  });

  it('Shop_RefusesKnownSkillBooks', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 100000;
    const shop = newShopState();
    shop.Goods.push({ Item: createSkillBook('w_bash'), Stock: 1 });
    const r = buyGood(shop, c, shop.Goods[0].Item.Uid, 1);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('이미 배운 스킬입니다');
    expect(c.Gold).toBe(100000);
  });

  it('Repair_RemovesDuplicateEquippedSkills', () => {
    const s = session(1, 21);
    s.newGame('a', 'Warrior', 'Normal');
    s.c.Skills.Equipped.push('w_bash');
    s.save();
    expect(s.continueGame()).toBe(true);
    expect(s.c.Skills.Equipped.filter((id) => id === 'w_bash').length).toBe(1);
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import type { BattleChoice, Battle } from '../src/core/battle';
import { addExp, createCharacter, effectLabel, maxHp, skillSlots, storageCapacity } from '../src/core/character';
import { currentRoom } from '../src/core/dungeon';
import type { RoomEnterResult } from '../src/core/dungeon';
import { JOBS } from '../src/core/enums';
import type { RoomType } from '../src/core/enums';
import {
  abandonQuest, acceptQuest, createQuest, deposit, inRange, isQuestComplete, newGuildState, onBossKilled, onEnemyKilled, rankFor, refreshBoard,
  storageFee, turnInQuest, withdraw,
} from '../src/core/guild';
import { addItem, sellPrice, countOf, createConsumable, createMaterial, createGear, newContainer } from '../src/core/items';

import { Rng } from '../src/core/rng';
import { loadGame, MemorySaveStore, repair, SAVE_VERSION } from '../src/core/save';
import type { SaveData } from '../src/core/save';
import { GameSession } from '../src/core/session';
import { buyBag, bagPrice, buyEquipment, buyGood, ensureStocked, reroll, rerollCost, resetRerollCost, sell, sellMany } from '../src/core/shop';
import { newShopState } from '../src/core/shop';
import { obtainableSkills, skillDef } from '../src/core/skills';
import { highSkillBook } from '../src/core/loot';

const NOW = new Date(Date.UTC(2026, 9, 17, 9, 0, 0));
const session = (store = new MemorySaveStore(), seed = 1) => new GameSession(store, () => NOW, seed);
const pick = (b: Battle): BattleChoice => {
  const ch = b.getChoices();
  return ch.find((x) => x.kind === 'Skill' && x.enabled) ?? ch[0];
};
/** 원하는 종류의 방을 지금 방과 바로 잇고 들어간다. */
function moveInto(s: GameSession, t: RoomType): { id: number; result: RoomEnterResult } {
  const run = s.run!;
  const target = run.Map.Rooms.find((r) => r.Type === t && !r.Visited)!;
  const cur = currentRoom(run);
  if (!cur.Links.includes(target.Id)) cur.Links.push(target.Id);
  if (!target.Links.includes(cur.Id)) target.Links.push(cur.Id);
  return { id: target.Id, result: s.move(target.Id) };
}

describe('상점 (TownTests)', () => {
  it('처음 한 번만 채우고 저절로 바뀌지 않는다', () => {
    const c = createCharacter('a', 'Warrior');
    const shop = newShopState();
    const rng = new Rng(1);
    expect(ensureStocked(shop, c, NOW, rng)).toBe(true);
    expect(shop.Equipment.length).toBe(B.ShopEquipmentSlots);
    const names = shop.Equipment.map((i) => i.Uid);
    expect(ensureStocked(shop, c, new Date(NOW.getTime() + 86400000 * 30), rng)).toBe(false);
    expect(shop.Equipment.map((i) => i.Uid)).toEqual(names);
  });

  it('갱신 비용은 두 배씩, 던전 다녀오면 초기화', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 10000;
    const shop = newShopState();
    const rng = new Rng(2);
    ensureStocked(shop, c, NOW, rng);
    expect(rerollCost(shop)).toBe(100);
    expect(reroll(shop, c, rng).ok).toBe(true);
    expect(rerollCost(shop)).toBe(200);
    reroll(shop, c, rng);
    expect(rerollCost(shop)).toBe(400);
    expect(c.Gold).toBe(10000 - 300);
    resetRerollCost(shop);
    expect(rerollCost(shop)).toBe(100);
  });

  it('스킬서는 하급·중급만, 장비는 일반·고급만', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 100; i++) {
      const c = createCharacter('a', JOBS[i % 4]);
      c.HighestFloorCleared = i % 30;
      c.Level = 1 + (i % 50);
      const shop = newShopState();
      ensureStocked(shop, c, NOW, rng);
      for (const g of shop.Goods) {
        if (g.Item.Kind === 'SkillBook') {
          expect(g.Stock).toBe(1);
          expect(['Low', 'Mid']).toContain(skillDef(g.Item.SkillId)!.Tier);
        }
      }
      for (const e of shop.Equipment) expect(['Common', 'Uncommon', 'Rare']).toContain(e.Grade);
    }
  });

  it('스킬서 드롭은 장착 레벨이 지금 레벨 + 5 이하', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 400; i++) {
      const c = createCharacter('a', JOBS[i % 4]);
      c.Level = 1 + (i % 60);
      const book = highSkillBook(c, rng);
      const def = obtainableSkills(c.Level, JOBS[(book.JobRestriction + 4) % 4]).find((s) => s.Id === book.SkillId);
      expect(def, book.SkillId).toBeDefined();
    }
  });

  it('구매·판매·가방 확장', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 100000;
    const shop = newShopState();
    ensureStocked(shop, c, NOW, new Rng(5));
    const eq = shop.Equipment[0];
    const gold = c.Gold;
    expect(buyEquipment(shop, c, eq.Uid).ok).toBe(true);
    expect(c.Gold).toBe(gold - eq.Price);
    expect(shop.Equipment.length).toBe(B.ShopEquipmentSlots - 1);
    const potion = shop.Goods.find((g) => g.Item.TemplateId === 'potion')!;
    expect(buyGood(shop, c, potion.Item.Uid, 5).ok).toBe(true);
    expect(countOf(c.Inventory, 'potion')).toBe(8);
    const before = c.Gold;
    expect(sell(c, c.Inventory.Items.find((i) => i.Uid === eq.Uid)!.Uid, 1).ok).toBe(true);
    expect(c.Gold).toBe(before + sellPrice(eq));
    expect(bagPrice(c)).toBe(500);
    expect(buyBag(c).ok).toBe(true);
    expect(c.Inventory.Capacity).toBe(20);
    expect(bagPrice(c)).toBe(1000);
    const rest = c.Inventory.Items.map((i) => i.Uid);
    expect(sellMany(c, rest)).toBeGreaterThan(0);
    expect(c.Inventory.Items.length).toBe(0);
  });

  it('골드나 공간이 없으면 살 수 없다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 0;
    const shop = newShopState();
    ensureStocked(shop, c, NOW, new Rng(6));
    expect(buyEquipment(shop, c, shop.Equipment[0].Uid).error).toBe('골드가 부족합니다');
    c.Gold = 100000;
    c.Inventory.Capacity = c.Inventory.Items.length;
    expect(buyEquipment(shop, c, shop.Equipment[0].Uid).error).toBe('가방이 가득 찼습니다');
  });
});

describe('길드 (TownTests)', () => {
  it('퀘스트 등급은 층에 따르고 게시판은 수락 가능 등급 위주', () => {
    expect(rankFor(1)).toBe('F');
    expect(rankFor(3)).toBe('E');
    expect(rankFor(6)).toBe('D');
    expect(rankFor(28)).toBe('SS');
    const c = createCharacter('a', 'Warrior');
    c.HighestFloorCleared = 4;
    const g = newGuildState();
    refreshBoard(g, c, new Rng(1));
    expect(g.Board.length).toBe(B.QuestBoardSize);
    expect(g.Board.filter((q) => q.TargetFloor === 5).length).toBeGreaterThanOrEqual(2);
    for (const q of g.Board.filter((x) => x.TargetFloor !== 5)) expect(inRange(c.Rank, q.Rank)).toBe(true);
  });

  it('수락 제한과 토벌 보고', () => {
    const c = createCharacter('a', 'Warrior');
    const g = newGuildState();
    const rng = new Rng(2);
    const hunts = ['slime', 'goblin', 'bat', 'wolf'].map((id) => {
      const q = createQuest(c, rng, 1, 'Hunt');
      q.SpeciesId = id;
      q.Rank = 'F';
      g.Board.push(q);
      return q;
    });
    for (let i = 0; i < 3; i++) expect(acceptQuest(g, c, hunts[i].Id).ok).toBe(true);
    expect(acceptQuest(g, c, hunts[3].Id).error).toBe('동시에 3개까지 수락할 수 있습니다');
    const q = hunts[0];
    q.Required = 2;
    expect(turnInQuest(g, c, q.Id).error).toBe('아직 완료하지 않았습니다');
    onEnemyKilled(g, q.SpeciesId, 1);
    onEnemyKilled(g, q.SpeciesId, 1);
    expect(isQuestComplete(q, c)).toBe(true);
    const gold = c.Gold;
    expect(turnInQuest(g, c, q.Id).ok).toBe(true);
    expect(c.Gold).toBe(gold + q.RewardGold);
    expect(c.QuestsCompleted).toBe(1);
    expect(abandonQuest(g, hunts[1].Id)).toBe(true);
  });

  it('채집은 재료를 내고, 정복은 보스를 잡으면 완료', () => {
    const c = createCharacter('a', 'Warrior');
    const g = newGuildState();
    const rng = new Rng(3);
    const col = createQuest(c, rng, 1, 'Collect');
    col.Required = 3;
    g.Active.push(col);
    addItem(c.Inventory, createMaterial(col.MaterialId, 3));
    expect(isQuestComplete(col, c)).toBe(true);
    expect(turnInQuest(g, c, col.Id).ok).toBe(true);
    expect(countOf(c.Inventory, col.MaterialId)).toBe(0);
    const con = createQuest(c, rng, 2, 'Conquer');
    g.Active.push(con);
    onBossKilled(g, 1);
    expect(isQuestComplete(con, c)).toBe(false);
    onBossKilled(g, 2);
    expect(isQuestComplete(con, c)).toBe(true);
  });

  it('창고: 맡길 때만 수수료, 등급이 오르면 커진다', () => {
    const c = createCharacter('a', 'Warrior');
    c.HighestFloorCleared = 2;
    c.Gold = 100;
    const gear = createGear('Helmet', 'Common', 1, 'Warrior', 'Vitality');
    addItem(c.Inventory, gear);
    expect(storageFee(c)).toBe(20);
    expect(deposit(c, gear.Uid).ok).toBe(true);
    expect(c.Gold).toBe(80);
    expect(withdraw(c, gear.Uid).ok).toBe(true);
    expect(c.Gold).toBe(80);
    c.Gold = 5;
    addItem(c.Inventory, createConsumable('potion'));
    expect(deposit(c, c.Inventory.Items[c.Inventory.Items.length - 1].Uid).error).toBe('수수료 20G가 부족합니다');
    expect([storageCapacity('F'), storageCapacity('C'), skillSlots('B')]).toEqual([4, 10, 5]);
    void newContainer;
  });
});

describe('저장·진행 (SessionTests)', () => {
  it('JSON 왕복: 저장했다 읽으면 같다', () => {
    const store = new MemorySaveStore();
    const s = session(store);
    s.newGame('  에단 "용사"\n', 'Archer', 'Hard');
    s.enterDungeon();
    const a = store.read()!;
    const loaded = loadGame(store)!;
    expect(loaded.Difficulty).toBe('Hard');
    expect(loaded.Character.Job).toBe('Archer');
    expect(loaded.Character.Name).toBe('에단 "용사"');
    expect(loaded.Run!.Map.Rooms.length).toBe(s.run!.Map.Rooms.length);
    expect(loaded.Character.Equipment.Slots[0]).toBeNull();
    expect(loaded.Character.Equipment.Slots[7]).not.toBeNull();
    expect(JSON.parse(a).Version).toBe(SAVE_VERSION);
  });

  it('빠진 필드나 모르는 필드가 있어도 고쳐서 읽는다', () => {
    const data = JSON.parse('{"Version":0,"Unknown":[1,2,{"x":null}],"Character":{"Name":"a","Job":"Mage","Level":7,"Gold":0}}') as SaveData;
    repair(data);
    expect(data.Character.Job).toBe('Mage');
    expect(data.Character.Equipment.Slots.length).toBe(8);
    expect(data.Shop).toBeDefined();
    expect(data.Run).toBeNull();
  });

  it('깨진 저장은 null', () => {
    const store = new MemorySaveStore();
    store.content = '{"Character":';
    expect(loadGame(store)).toBeNull();
    store.content = 'not json';
    expect(loadGame(store)).toBeNull();
    expect(session(store).continueGame()).toBe(false);
  });

  it('이어하기: 마을과 전투 중 던전 상태를 되살린다', () => {
    const store = new MemorySaveStore();
    const s = session(store);
    s.newGame('에단', 'Warrior', 'Normal');
    s.setTutorial('Done');
    s.c.Gold = 1234;
    s.save();
    const s2 = session(store, 2);
    expect(s2.continueGame()).toBe(true);
    expect(s2.c.Gold).toBe(1234);
    expect(s2.inDungeon).toBe(false);
    s2.enterDungeon();
    const { id } = moveInto(s2, 'Battle');
    expect(s2.battle).not.toBeNull();
    const n = s2.battle!.enemies.length;
    const s3 = session(store, 3);
    expect(s3.continueGame()).toBe(true);
    expect(s3.inDungeon).toBe(true);
    expect(s3.battle).not.toBeNull();
    expect(s3.battle!.enemies.length).toBe(n);
    expect(s3.run!.CurrentRoomId).toBe(id);
  });

  it('튜토리얼: 고정 1층 → 귀환 후 단계', () => {
    const store = new MemorySaveStore();
    const s = session(store);
    s.newGame('에단', 'Archer', 'Normal');
    expect(s.data!.Tutorial).toBe('TownGuide');
    s.enterDungeon();
    expect(s.run!.IsTutorial).toBe(true);
    expect(s.data!.Tutorial).toBe('FirstDungeon');
    expect(s.run!.Map.Rooms.length).toBe(6);
    expect(s.move(1)).toBe('Battle');
    expect(s.battle!.enemies.length).toBe(1);
    let guard = 0;
    while (s.battle && !s.battle.isOver && guard++ < 50) s.executeBattle(pick(s.battle));
    expect(s.battle!.outcome).toBe('Victory');
    expect(s.c.Level).toBeGreaterThanOrEqual(2);
    s.closeBattle();
    expect(s.move(2)).toBe('Return');
    expect(s.canReturn).toBe(true);
    s.returnToTown();
    expect(s.data!.Tutorial).toBe('AfterReturn');
    s.setTutorial('Done');
    s.enterDungeon();
    expect(s.run!.IsTutorial).toBe(false);
    s.returnToTown();
    s.c.HighestFloorCleared = 3;
    s.restartTutorial();
    expect(s.data!.Tutorial).toBe('TownGuide');
    s.enterDungeon();
    expect(s.run!.IsTutorial).toBe(false);
    expect(s.data!.Tutorial).toBe('FirstDungeon');
  });

  it('하드코어 사망은 저장을 지운다', () => {
    const store = new MemorySaveStore();
    const s = session(store);
    s.newGame('에단', 'Mage', 'Hardcore');
    s.setTutorial('Done');
    s.enterDungeon();
    moveInto(s, 'Battle');
    for (const e of s.battle!.enemies) {
      e.attack = 100000;
      e.maxHp = e.hp = 100000;
    }
    let guard = 0;
    while (s.battle && guard++ < 50) s.executeBattle(s.battle.getChoices()[0]);
    expect(s.lastDeath!.HardcoreReset).toBe(true);
    expect(s.hasGame).toBe(false);
    expect(store.exists).toBe(false);
  });

  it('일반 사망은 페널티를 받고 마을로', () => {
    const store = new MemorySaveStore();
    const s = session(store);
    s.newGame('에단', 'Mage', 'Normal');
    s.setTutorial('Done');
    s.c.Gold = 1000;
    s.enterDungeon();
    moveInto(s, 'Battle');
    for (const e of s.battle!.enemies) {
      e.attack = 100000;
      e.maxHp = e.hp = 100000;
    }
    let guard = 0;
    while (s.battle && guard++ < 50) s.executeBattle(s.battle.getChoices()[0]);
    expect(s.lastDeath!.GoldLost).toBe(300);
    expect(s.c.Gold).toBe(700);
    expect(s.inDungeon).toBe(false);
    expect(s.c.CurrentHp).toBe(maxHp(s.c));
    expect(s.data!.Run).toBeNull();
  });

  it('던전에서 돌아오면 상점 갱신 비용이 초기화', () => {
    const s = session();
    s.newGame('에단', 'Warrior', 'Normal');
    s.setTutorial('Done');
    s.c.Gold = 5000;
    reroll(s.data!.Shop, s.c, s.rng);
    expect(rerollCost(s.data!.Shop)).toBe(200);
    s.enterDungeon();
    moveInto(s, 'Return');
    s.returnToTown();
    expect(rerollCost(s.data!.Shop)).toBe(100);
  });

  it('상인 가격: 마을 × 1.5, 구해 준 상인은 × 0.7', () => {
    const s = session();
    s.newGame('a', 'Warrior', 'Normal');
    s.setTutorial('Done');
    s.enterDungeon();
    const potion = createConsumable('potion');
    expect(s.merchantPrice(potion)).toBe(Math.round(potion.Price * 1.5));
    currentRoom(s.run!).MerchantDiscount = true;
    expect(s.merchantPrice(potion)).toBe(Math.round(potion.Price * 0.7));
  });

  it('보스를 잡고 돌아오면 길드에 새 의뢰 알림, 보면 사라진다', () => {
    const s = session(new MemorySaveStore(), 9);
    s.newGame('a', 'Warrior', 'Normal');
    s.setTutorial('Done');
    expect(s.guildNewQuests).toBe(false);
    s.enterDungeon();
    s.run!.BossDefeated = true;
    s.c.HighestFloorCleared = 1;
    s.returnToTown();
    if (s.data!.Guild.Board.some((q) => q.TargetFloor === 2)) {
      expect(s.guildNewQuests).toBe(true);
      s.markGuildSeen();
      expect(s.guildNewQuests).toBe(false);
    }
    s.enterDungeon();
    s.returnToTown();
    expect(s.guildNewQuests).toBe(false);
  });

  it('여러 던전 도전을 봇처럼 돌려도 오류가 없다', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = session(new MemorySaveStore(), seed);
      s.newGame('봇', JOBS[seed % 4], 'Normal');
      s.setTutorial('Done');
      addExp(s.c, 3000);
      for (let step = 0; step < 60 && s.hasGame && s.inDungeon; step++) {
        if (s.battle) {
          let guard = 0;
          while (s.battle && !s.battle.isOver && guard++ < 200) s.executeBattle(pick(s.battle));
          if (!s.hasGame) break;
          if (s.battle) s.closeBattle();
          continue;
        }
        const ev = s.pendingEvent;
        if (ev) {
          s.chooseEvent(ev.Choices.length - 1);
          continue;
        }
        const run = s.run!;
        const next = currentRoom(run).Links.map((id) => run.Map.Rooms[id]).find((r) => !r.Visited);
        if (!next) break;
        s.move(next.Id);
      }

    }
  });
});

describe('Unity 저장 호환', () => {
  it('Unity가 만든 저장 파일을 읽는다', () => {
    const store = new MemorySaveStore();
    store.content = readFileSync(new URL('./fixtures/unity-save.json', import.meta.url), 'utf8');
    const data = loadGame(store)!;
    expect(data).not.toBeNull();
    expect(data.Character.Name).toBe('검사');
    expect(data.Character.Job).toBe('Warrior');
    expect(data.Character.Level).toBe(5);
    expect(data.Character.Gold).toBe(4321);
    expect(data.Run).not.toBeNull();
    expect(data.Run!.Floor).toBe(2);
    expect(data.Character.Skills.Learned.map((x) => x.SkillId)).toContain('w_guard');
    expect(countOf(data.Character.Inventory, 'stone')).toBe(3);
    expect(countOf(data.Character.Storage, 'potion_hi')).toBe(2);
    expect(effectLabel(data.Character, 'Vitality')).toContain('HP');
    // 읽은 뒤 이어하기까지 된다
    const s = session(store);
    expect(s.continueGame()).toBe(true);
    expect(s.c.Name).toBe('검사');
    expect(s.inDungeon).toBe(true);
    // 다시 저장해도 같은 필드 이름·값 (열거형은 이름 문자열)
    s.save();
    const again = JSON.parse(store.read()!);
    expect(again.Character.Job).toBe('Warrior');
    expect(again.Run.Map.Pattern).toMatch(/Branch|Loop|Grid/);
    expect(Object.keys(again).sort()).toEqual(Object.keys(JSON.parse(readFileSync(new URL('./fixtures/unity-save.json', import.meta.url), 'utf8'))).sort());
  });
});


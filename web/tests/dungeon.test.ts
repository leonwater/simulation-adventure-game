import { describe, expect, it } from 'vitest';
import { B, enemyGold, roundEven } from '../src/core/balance';
import { Battle } from '../src/core/battle';
import { addExp, createCharacter, maxChallengeFloor, maxHp } from '../src/core/character';
import {
  canGoDeeper, canLeave, clearCurrent, currentRoom, descend, fleeToPrevious, moveOptions, movePad, moveTo, newRun, onBossDefeated,
  openTreasure, padSlot, rest, returnRoomFound, situation, startRun, teleport,
} from '../src/core/dungeon';
import type { DungeonRun } from '../src/core/dungeon';
import { createEnemy, createGroup } from '../src/core/enemies';
import type { Difficulty, RoomType } from '../src/core/enums';
import { JOBS, LAYOUTS } from '../src/core/enums';
import { ALL_EVENTS, eventDef, pickEvent } from '../src/core/events';
import {
  BLOOD_RISK, choiceHint, choiceLabel, choiceUnavailable, eventBody, resolveEvent, specialHint, startsBattle, successChance, unavailableReason,
  visibleChoices, sphinxRemoved,
} from '../src/core/eventrules';
import { addEffect, afterBattleEffects, applyEffectsToBattle, hasEffect, onRestEffects } from '../src/core/explore';
import { generateFloor, rollRoomTypes, violations } from '../src/core/generator';
import { newGuildState, onBossKilled } from '../src/core/guild';
import { addItem, countOf, createConsumable } from '../src/core/items';
import { collectRewards } from '../src/core/loot';
import { branchesOnBossPath, deadEnds, distances, getRoom, countOfType, isConnected } from '../src/core/map';
import type { FloorMap, Room } from '../src/core/map';
import { becomeMerchant, chainEvent, findReturn, linkBoss, revealRooms, spawnTreasure } from '../src/core/mapevents';
import { monster } from '../src/core/monsters';
import { Rng } from '../src/core/rng';
import { die } from '../src/core/settlement';

const forceAdjacent = (run: DungeonRun, target: Room) => {
  const cur = currentRoom(run);
  if (!cur.Links.includes(target.Id)) cur.Links.push(target.Id);
  if (!target.Links.includes(cur.Id)) target.Links.push(cur.Id);
};
const countT = (list: RoomType[], t: RoomType) => list.filter((x) => x === t).length;
const find = (run: DungeonRun, t: RoomType) => run.Map.Rooms.find((r) => r.Type === t)!;
const extraEdges = (m: FloorMap) => m.Rooms.reduce((a, r) => a + r.Links.length, 0) / 2 - (m.Rooms.length - 1);

describe('던전 생성 (DungeonTests)', () => {
  it('방 종류 규칙과 평균 개수', () => {
    const rng = new Rng(100);
    let merchants = 0, treasures = 0;
    const runs = 5000;
    for (let i = 0; i < runs; i++) {
      const t = rollRoomTypes(rng);
      expect(t.length).toBeGreaterThanOrEqual(8);
      expect(t.length).toBeLessThanOrEqual(13);
      expect(countT(t, 'Battle')).toBeGreaterThanOrEqual(4);
      expect(countT(t, 'Event')).toBeGreaterThanOrEqual(1);
      expect(countT(t, 'Treasure')).toBeLessThanOrEqual(2);
      expect(countT(t, 'Rest')).toBeGreaterThanOrEqual(1);
      expect(countT(t, 'Rest')).toBeLessThanOrEqual(3);
      expect(countT(t, 'Return')).toBe(1);
      expect(countT(t, 'Merchant')).toBeLessThanOrEqual(1);
      expect(countT(t, 'Boss')).toBe(0);
      merchants += countT(t, 'Merchant');
      treasures += countT(t, 'Treasure');
    }
    expect(treasures / runs).toBeGreaterThan(0.65);
    expect(treasures / runs).toBeLessThan(0.9);
    expect(merchants / runs).toBeGreaterThan(0.56);
    expect(merchants / runs).toBeLessThan(0.64);
  });

  it('모든 배치에서 연결·보스 거리·좌표·규칙', () => {
    const rng = new Rng(2024);
    let failures = 0;
    let violated = 0;
    for (const p of LAYOUTS) {
      for (let i = 0; i < 400; i++) {
        const floor = 1 + (i % 30);
        const map = generateFloor(floor, rng, p);
        expect(isConnected(map)).toBe(true);
        expect(countOfType(map, 'Boss')).toBe(1);
        expect(countOfType(map, 'Start')).toBe(1);
        expect(getRoom(map, map.StartId)!.Type).toBe('Start');
        expect(getRoom(map, map.BossId)!.Type).toBe('Boss');
        const dist = distances(map, map.StartId);
        expect(dist[map.BossId]).toBe(Math.max(...dist));
        const seen = new Set<string>();
        for (const r of map.Rooms) {
          expect(seen.has(`${r.X},${r.Y}`)).toBe(false);
          seen.add(`${r.X},${r.Y}`);
          for (const l of r.Links) {
            const o = getRoom(map, l)!;
            expect(Math.abs(o.X - r.X) + Math.abs(o.Y - r.Y)).toBe(1);
            expect(o.Links.includes(r.Id)).toBe(true);
          }
          if (r.Type === 'Event') expect(eventDef(r.EventId)).not.toBeNull();
        }
        if (branchesOnBossPath(map) < 2 || deadEnds(map) < 1) failures++;
        if (violations(map) > 0) violated++;
      }
    }
    expect(failures).toBeLessThanOrEqual(3);
    expect(violated).toBeLessThan(60);
  });

  it('배치 모양이 서로 다르다', () => {
    const rng = new Rng(5);
    let loop = 0, grid = 0, branch = 0;
    for (let i = 0; i < 200; i++) {
      branch += extraEdges(generateFloor(5, rng, 'Branch'));
      loop += extraEdges(generateFloor(5, rng, 'Loop'));
      grid += extraEdges(generateFloor(5, rng, 'Grid'));
    }
    expect(branch).toBe(0);
    expect(loop).toBeGreaterThan(150);
    expect(grid).toBeGreaterThan(0);
  });
});

describe('탐험 (DungeonTests)', () => {
  it('이동 규칙·텔레포트·도주', () => {
    const c = createCharacter('a', 'Warrior');
    const run = startRun(c, 1, new Rng(8));
    expect(run.CurrentRoomId).toBe(run.Map.StartId);
    expect(canLeave(run)).toBe(true);
    const options = moveOptions(run, 'Normal');
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      expect(o.Known).toBe(false);
      expect(o.Direction.endsWith('로 간다')).toBe(true);
    }
    for (const o of moveOptions(run, 'Easy')) expect(o.Known).toBe(true);

    const battleRoom = find(run, 'Battle');
    forceAdjacent(run, battleRoom);
    expect(moveTo(run, battleRoom.Id)).toBe('Battle');
    expect(canLeave(run)).toBe(false);
    expect(teleport(run, run.Map.StartId)).toBe(false);
    fleeToPrevious(run);
    expect(run.CurrentRoomId).toBe(run.Map.StartId);
    expect(battleRoom.Visited).toBe(true);
    expect(battleRoom.Cleared).toBe(false);
    expect(moveTo(run, battleRoom.Id)).toBe('Battle');
    clearCurrent(run);
    expect(moveTo(run, run.Map.StartId)).toBe('Nothing');
    expect(teleport(run, battleRoom.Id)).toBe(true);
    expect(run.CurrentRoomId).toBe(battleRoom.Id);
  });

  it('휴식·보물·귀환 방', () => {
    const c = createCharacter('a', 'Warrior');
    const run = startRun(c, 3, new Rng(9));
    c.HighestFloorCleared = 5;
    const restRoom = find(run, 'Rest');
    forceAdjacent(run, restRoom);
    c.CurrentHp = 10;
    expect(moveTo(run, restRoom.Id)).toBe('Rest');
    expect(rest(run, c)).toBe(roundEven(maxHp(c) * 0.4));
    expect(restRoom.Cleared).toBe(true);
    const t = run.Map.Rooms.find((r) => r.Type === 'Treasure');
    if (t) {
      forceAdjacent(run, t);
      const gold = c.Gold;
      expect(moveTo(run, t.Id)).toBe('Treasure');
      const loot = openTreasure(run, c);
      expect(loot.Gold).toBeGreaterThan(0);
      expect(c.Gold).toBe(gold + loot.Gold);
      expect(run.GoldEarned).toBe(loot.Gold);
    }
    expect(returnRoomFound(run)).toBe(false);
    const ret = find(run, 'Return');
    forceAdjacent(run, ret);
    expect(moveTo(run, ret.Id)).toBe('Return');
    expect(returnRoomFound(run)).toBe(true);
  });

  it('보스 처치로 다음 층이 열리고 내려가도 HP 유지', () => {
    const c = createCharacter('a', 'Warrior');
    const guild = newGuildState();
    const run = startRun(c, 1, new Rng(3));
    expect(maxChallengeFloor(c)).toBe(1);
    forceAdjacent(run, getRoom(run.Map, run.Map.BossId)!);
    expect(moveTo(run, run.Map.BossId)).toBe('Boss');
    expect(canGoDeeper(run)).toBe(false);
    onBossDefeated(run, c, guild);
    expect(c.HighestFloorCleared).toBe(1);
    expect(maxChallengeFloor(c)).toBe(2);
    c.CurrentHp = 33;
    descend(run, new Rng(4));
    expect(run.Floor).toBe(2);
    expect(c.CurrentHp).toBe(33);
    expect(run.BossDefeated).toBe(false);
    expect(run.CurrentRoomId).toBe(run.Map.StartId);
  });

  it('도전 층 범위 제한', () => {
    const c = createCharacter('a', 'Warrior');
    expect(startRun(c, 9, new Rng(1)).Floor).toBe(1);
    c.HighestFloorCleared = 30;
    expect(startRun(c, 99, new Rng(1)).Floor).toBe(30);
  });

  it('사망: 골드·경험치·가방만 잃는다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 1240;
    addExp(c, 300);
    addItem(c.Storage, createConsumable('potion_hi', 2));
    c.BagsBought = 2;
    c.Inventory.Capacity = 30;
    const run = startRun(c, 1, new Rng(1));
    const report = die(c, run, 'Normal', '고블린 궁수');
    expect(report.GoldLost).toBe(372);
    expect(c.Gold).toBe(868);
    expect(report.ExpLost).toBe(57);
    expect(c.Level).toBe(2);
    expect(report.ItemsLost.length).toBe(1);
    expect(c.Inventory.Items.length).toBe(0);
    expect(report.EquippedKept).toBe(1);
    expect(countOf(c.Storage, 'potion_hi')).toBe(2);
    expect(c.Inventory.Capacity).toBe(30);
    expect(c.CurrentHp).toBe(maxHp(c));
  });

  it('하드코어 사망은 초기화 표시', () => {
    expect(die(createCharacter('a', 'Warrior'), null, 'Hardcore', '드래곤').HardcoreReset).toBe(true);
  });

  it('상황 설명', () => {
    const run = startRun(createCharacter('a', 'Warrior'), 1, new Rng(12));
    const s = situation(run);
    expect(s.text).not.toBe('');
    expect(s.title).not.toBe('');
  });
});

describe('이벤트 (DungeonTests·SpecialEventTests)', () => {
  it('모든 이벤트의 모든 선택지가 오류 없이 처리된다', () => {
    const rng = new Rng(77);
    for (const e of ALL_EVENTS) {
      for (let choice = 0; choice < e.Choices.length; choice++) {
        for (let k = 0; k < 30; k++) {
          const c = createCharacter('a', JOBS[k % 4]);
          if (!visibleChoices(e, c).includes(choice)) continue;
          c.Gold = 50000;
          const ch = e.Choices[choice];
          if (ch.RequiresItem) addItem(c.Inventory, createConsumable(ch.RequiresItem));
          c.HighestFloorCleared = k % 30;
          const run = startRun(c, 1 + (k % 30), rng);
          const room = find(run, 'Event');
          room.EventId = e.Id;
          forceAdjacent(run, room);
          moveTo(run, room.Id);
          if (!visibleChoices(e, c, run).includes(choice)) continue;
          expect(unavailableReason(e, choice, run, c), `${e.Id}/${choice}`).toBeNull();
          expect(choiceLabel(e, choice, run, c)).not.toBe('');
          expect(eventBody(e, run, c)).not.toBe('');
          specialHint(e, choice, run, c);
          const p = successChance(ch, c, run.Floor);
          expect(p).toBeGreaterThanOrEqual(0.05);
          expect(p).toBeLessThanOrEqual(1);
          const result = resolveEvent(run, c, choice, rng);
          expect(result.Text).not.toBe('');
          expect(c.CurrentHp).toBeGreaterThanOrEqual(1);
          expect(c.Gold).toBeGreaterThanOrEqual(0);
          expect(room.Cleared, `${e.Id}/${choice}`).toBe(!startsBattle(result) && !result.Continues);
          expect(result.Battle === 'Trial').toBe(result.TrialFloor > 0);
        }
      }
    }
  });

  it('직업 전용 선택지는 그 직업에게만 보인다', () => {
    const warrior = createCharacter('a', 'Warrior');
    const mage = createCharacter('a', 'Mage');
    expect(visibleChoices(eventDef('ceiling')!, warrior).length).toBe(4);
    expect(visibleChoices(eventDef('ceiling')!, mage).length).toBe(3);
    expect(visibleChoices(eventDef('chest')!, createCharacter('a', 'Archer')).length).toBe(4);
    expect(visibleChoices(eventDef('gamble')!, createCharacter('a', 'Rogue')).length).toBe(3);
    expect(visibleChoices(eventDef('tablet')!, mage).length).toBe(4);
  });

  it('궁수의 상자: 미믹이거나 보물', () => {
    let mimic = 0, treasure = 0;
    const rng = new Rng(4);
    for (let k = 0; k < 200; k++) {
      const c = createCharacter('a', 'Archer');
      const run = startRun(c, 1, rng);
      const room = find(run, 'Event');
      room.EventId = 'chest';
      forceAdjacent(run, room);
      moveTo(run, room.Id);
      const idx = eventDef('chest')!.Choices.findIndex((ch) => ch.JobOnly === 1);
      const r = resolveEvent(run, c, idx, rng);
      if (r.Battle === 'MimicNoAmbush') mimic++;
      else {
        expect(r.Battle).toBe('None');
        expect(r.Loot.Items.length + r.Loot.Dropped.length).toBe(1);
        treasure++;
      }
    }
    expect(mimic).toBeGreaterThan(0);
    expect(treasure).toBeGreaterThan(mimic);
  });

  it('선택 조건이 모자라면 막힌다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Inventory.Items = [];
    c.Gold = 0;
    expect(choiceUnavailable(eventDef('wounded')!.Choices[0], c, 1)).not.toBeNull();
    expect(choiceUnavailable(eventDef('gamble')!.Choices[0], c, 1)).not.toBeNull();
    expect(choiceHint(eventDef('swordsman')!.Choices[0], c, 1)).toBe('힘 판정');
  });

  it('이벤트 뽑기: 후속·이른 시련·중복 제외', () => {
    const rng = new Rng(3);
    const used = new Set<string>(['altar']);
    for (let i = 0; i < 2000; i++) {
      const e = pickEvent(rng, 1, used);
      expect(e.Followup).toBe(false);
      expect(e.MinFloor).toBeLessThanOrEqual(1);
      expect(used.has(e.Id)).toBe(false);
    }
    const ids = new Set<string>();
    for (let i = 0; i < 3000; i++) ids.add(pickEvent(rng, 10).Id);
    expect(ids.has('evt_trial_gate')).toBe(true);
  });

  it('보물 더미: 계속 줍다가 함정이거나 챙기고 떠난다', () => {
    const rng = new Rng(11);
    for (let t = 0; t < 40; t++) {
      const c = createCharacter('a', 'Warrior');
      const run = startRun(c, 1, rng);
      const room = find(run, 'Event');
      room.EventId = 'evt_treasure_pile';
      forceAdjacent(run, room);
      moveTo(run, room.Id);
      const first = resolveEvent(run, c, 0, rng);
      if (first.Success) {
        expect(first.Continues).toBe(true);
        expect(room.EventBank).toBe(enemyGold(1) * 2);
        const leave = resolveEvent(run, c, 1, rng);
        expect(leave.Loot.Gold).toBe(enemyGold(1) * 2);
        expect(room.Cleared).toBe(true);
        return;
      }
      expect(room.Cleared).toBe(true);
    }
    throw new Error('성공한 적이 없다');
  });

  it('피의 우물: 5번까지, 바칠수록 경험치가 커진다', () => {
    const rng = new Rng(12);
    const c = createCharacter('a', 'Warrior');
    c.Level = 10;
    c.CurrentHp = 100000;
    const run = startRun(c, 1, rng);
    const room = find(run, 'Event');
    room.EventId = 'evt_blood_well';
    forceAdjacent(run, room);
    moveTo(run, room.Id);
    const exps: number[] = [];
    for (let i = 0; i < 5; i++) {
      c.CurrentHp = maxHp(c);
      const r = resolveEvent(run, c, 0, rng);
      exps.push(r.Loot.Exp);
      expect(r.Continues).toBe(i < 4);
    }
    expect(exps).toEqual([1, 1, 3, 3, 6].map((m) => roundEven(m * 30)));
    expect(room.Cleared).toBe(true);
    expect(BLOOD_RISK.length).toBe(5);
  });

  it('스핑크스: 지능이 높으면 오답 하나를 지워 준다', () => {
    const rng = new Rng(2);
    const c = createCharacter('a', 'Mage');
    c.BaseStats.Values[5] = 90;
    const run = startRun(c, 1, rng);
    const room = find(run, 'Event');
    room.EventId = 'evt_sphinx';
    forceAdjacent(run, room);
    moveTo(run, room.Id);
    const removed = sphinxRemoved(run, c);
    expect(removed).toBeGreaterThanOrEqual(0);
    expect(visibleChoices(eventDef('evt_sphinx')!, c, run).includes(removed)).toBe(false);
  });

  it('부상 입은 상인: 후속 이벤트가 이어지고 상인이 된다', () => {
    const rng = new Rng(21);
    const c = createCharacter('a', 'Warrior');
    const run = startRun(c, 1, rng);
    const room = find(run, 'Event');
    room.EventId = 'evt_wounded_merchant';
    forceAdjacent(run, room);
    moveTo(run, room.Id);
    chainEvent(run, 'evt_merchant_reward', rng);
    expect(run.Map.Rooms.some((r) => r.Chain && r.EventId === 'evt_merchant_reward')).toBe(true);
    becomeMerchant(run, rng);
    expect(room.Type).toBe('Merchant');
    expect(room.MerchantDiscount).toBe(true);
    expect(room.MerchantGoods.length).toBe(4); // 1층: 고급 회복 물약은 아직 팔지 않는다
  });

  it('지도 이벤트: 공개·보스 통로·귀환 방·숨은 보물 방', () => {
    const rng = new Rng(31);
    const c = createCharacter('a', 'Warrior');
    const run = startRun(c, 1, rng);
    revealRooms(run, 'ReturnAndBoss', false, rng);
    expect(find(run, 'Return').Revealed).toBe(true);
    expect(getRoom(run.Map, run.Map.BossId)!.Revealed).toBe(true);
    linkBoss(run);
    expect(currentRoom(run).Links.includes(run.Map.BossId)).toBe(true);
    findReturn(run);
    expect(returnRoomFound(run)).toBe(true);
    const n = run.Map.Rooms.length;
    expect(spawnTreasure(run, rng)).toBe(true);
    expect(run.Map.Rooms.length).toBe(n + 1);
    expect(run.Map.Rooms[n].Type).toBe('Treasure');
  });

  it('탐험 효과: 전투에 적용되고 횟수가 줄어 사라진다', () => {
    const c = createCharacter('a', 'Warrior');
    const run = newRun(1, generateFloor(1, new Rng(1)));
    addEffect(run.Effects, 'Regen', 2);
    addEffect(run.Effects, 'Curse', -1);
    addEffect(run.Effects, 'DemonPact', -1);
    addEffect(run.Effects, 'Regen', 1);
    expect(run.Effects.find((e) => e.Type === 'Regen')!.Battles).toBe(2);
    const b = new Battle(c, 1, [createEnemy(monster('goblin')!, 1, 'Normal', 0)], false, new Rng(1));
    const atk = b.player.attack;
    applyEffectsToBattle(run.Effects, b);
    expect(b.player.statuses.has('Regen')).toBe(true);
    expect(b.player.attack).toBe(roundEven(atk * 1.2));
    expect(b.dropMultiplier).toBe(0.5);
    afterBattleEffects(run.Effects, true);
    afterBattleEffects(run.Effects, true);
    expect(hasEffect(run.Effects, 'Regen')).toBe(false);
    expect(hasEffect(run.Effects, 'Curse')).toBe(true);
    onRestEffects(run.Effects);
    expect(hasEffect(run.Effects, 'Curse')).toBe(false);
    expect(hasEffect(run.Effects, 'DemonPact')).toBe(true);
  });
});

describe('이동 패드 (V23Tests)', () => {
  const handMade = (...rooms: [number, number][]): DungeonRun => {
    const map = generateFloor(1, new Rng(1));
    map.Rooms = rooms.map(([x, y], i) => ({ ...map.Rooms[0], Id: i, X: x, Y: y, Type: 'Battle' as RoomType, Links: [], Visited: false, Cleared: false, Revealed: false }));
    map.StartId = 0;
    map.BossId = 0;
    return newRun(1, map);
  };
  const link = (run: DungeonRun, a: number, b: number) => {
    run.Map.Rooms[a].Links.push(b);
    run.Map.Rooms[b].Links.push(a);
  };

  it('이웃은 방향 칸에 놓이고 길 없는 쪽은 막힘', () => {
    const run = handMade([5, 5], [5, 4], [4, 5], [6, 5]);
    link(run, 0, 1);
    link(run, 0, 2);
    link(run, 0, 3);
    run.PreviousRoomId = 2;
    const pad = movePad(run, 'Normal');
    expect(padSlot(pad, 'Up').Room!.Id).toBe(1);
    expect(padSlot(pad, 'Left').Room!.Id).toBe(2);
    expect(padSlot(pad, 'Right').Room!.Id).toBe(3);
    expect(padSlot(pad, 'Down').Room).toBeNull();
    expect(padSlot(pad, 'Left').IsPrevious).toBe(true);
    expect(padSlot(pad, 'Up').IsPrevious).toBe(false);
    expect(padSlot(pad, 'Up').Known).toBe(false);
    expect(padSlot(movePad(run, 'Easy' as Difficulty), 'Up').Known).toBe(true);
    expect(pad.Extra.length).toBe(0);
  });

  it('대각선 지름길은 더 긴 축 칸, 자리가 없으면 Extra', () => {
    const run = handMade([5, 5], [5, 4], [4, 5], [6, 5], [5, 6], [8, 4]);
    link(run, 0, 1);
    link(run, 0, 4);
    link(run, 0, 5);
    let pad = movePad(run, 'Normal');
    expect(padSlot(pad, 'Right').Room!.Id).toBe(5);
    link(run, 0, 3);
    pad = movePad(run, 'Normal');
    expect(padSlot(pad, 'Right').Room!.Id).toBe(3);
    expect(padSlot(pad, 'Up').Room!.Id).toBe(1);
    expect(pad.Extra.map((r) => r.Id)).toEqual([5]);
  });

  it('실제 층의 모든 길이 칸이나 Extra에 있다', () => {
    const rng = new Rng(77);
    for (let i = 0; i < 60; i++) {
      const c = createCharacter('a', 'Warrior');
      const run = startRun(c, 1, rng);
      for (const room of run.Map.Rooms) {
        run.CurrentRoomId = room.Id;
        const pad = movePad(run, 'Normal');
        const placed = pad.Extra.length + pad.Slots.filter((s) => s.Room).length;
        expect(placed).toBe(room.Links.length);
      }
    }
  });
});

describe('보상 (V23Tests · BattleTests)', () => {
  it('한 층을 끝까지 돌면 장비 평균 약 2개', () => {
    const rng = new Rng(23);
    let equip = 0;
    const floors = 1500;
    const luck = 1.025;
    for (let i = 0; i < floors; i++) {
      for (const t of rollRoomTypes(rng)) {
        if (t === 'Treasure' && rng.chance(0.6)) equip++;
        if (t !== 'Battle') continue;
        for (const e of createGroup(3, 'Normal', rng.range(0, 2147483647))) {
          if (rng.chance((e.role === 1 ? B.EquipDropElite : B.EquipDropNormal) * luck)) equip++;
        }
      }
      equip++; // 보스
    }
    expect(equip / floors).toBeGreaterThan(1.8);
    expect(equip / floors).toBeLessThan(2.25);
  });

  it('승리 보상: 경험치·골드·퀘스트 진행', () => {
    const c = createCharacter('a', 'Warrior');
    const list = [createEnemy(monster('goblin')!, 1, 'Normal', 0), createEnemy(monster('goblin')!, 1, 'Normal', 0)];
    list[0].name = '고블린 A';
    list[1].name = '고블린 B';
    for (const e of list) e.hp = 1;
    const b = new Battle(c, 1, list, false, new Rng(4));
    const guild = newGuildState();
    guild.Active.push({ Id: 'q', Kind: 'Hunt', Title: '', Rank: 'F', TargetFloor: 1, SpeciesId: 'goblin', MaterialId: '', Required: 2, Progress: 0, RewardGold: 0, RewardExp: 0 });
    let guard = 0;
    while (!b.isOver && guard++ < 50) b.execute(b.getChoices()[0]);
    expect(b.outcome).toBe('Victory');
    const run = startRun(c, 1, new Rng(1));
    const goldBefore = c.Gold;
    const loot = collectRewards(b, guild, run);
    expect(b.defeated.length).toBe(2);
    expect(guild.Active[0].Progress).toBe(2);
    expect(loot.Gold).toBe(enemyGold(1) * 2);
    expect(c.Gold).toBe(goldBefore + loot.Gold);
    expect(run.EnemiesDefeated).toBe(2);
  });

  it('보스 처치는 정복 퀘스트를 완료', () => {
    const g = newGuildState();
    g.Active.push({ Id: 'q', Kind: 'Conquer', Title: '', Rank: 'F', TargetFloor: 2, SpeciesId: '', MaterialId: '', Required: 1, Progress: 0, RewardGold: 0, RewardExp: 0 });
    onBossKilled(g, 1);
    expect(g.Active[0].Progress).toBe(0);
    onBossKilled(g, 2);
    expect(g.Active[0].Progress).toBe(1);
  });
});


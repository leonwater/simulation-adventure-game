import { describe, expect, it } from 'vitest';
import { B, enemyDefense, enemyHp, expToNext, roundEven } from '../src/core/balance';
import { Battle } from '../src/core/battle';
import {
  addExp, attack, autoAllocate, createCharacter, damageReduction, defense, equipmentBonus, equipped, maxChallengeFloor, maxHp, setEquipped,
  storageCapacity, totalStat, weaponAttack,
} from '../src/core/character';
import type { Character } from '../src/core/character';
import { currentRoom, moveTo, startRun } from '../src/core/dungeon';
import type { DungeonRun } from '../src/core/dungeon';
import { createEnemy } from '../src/core/enemies';
import { canTrain, equip, equipSkill, learnSkill, moveEquippedSkill, slotFor, summary, trainSkill } from '../src/core/equipment';
import { GEARS, GRADES, JOBS, RANKS } from '../src/core/enums';
import type { GearType, ItemGrade, Job, Stat } from '../src/core/enums';
import { eventDef, eventsGrantingActiveEffects } from '../src/core/events';
import type { ExploreEffect } from '../src/core/explore';
import { BLOOD_RISK, choiceLabel, resolveEvent, successChance, visibleChoices } from '../src/core/eventrules';
import { generateFloor, rollRoomTypes, violations } from '../src/core/generator';
import { deposit, withdraw } from '../src/core/guild';
import { addItem, baseValue, createDrop, createGear, valueAt } from '../src/core/items';
import type { ItemInstance } from '../src/core/items';
import { setStat } from '../src/core/jobs';
import { getRoom } from '../src/core/map';
import { monster } from '../src/core/monsters';
import { Rng } from '../src/core/rng';
import { loadGame, MemorySaveStore } from '../src/core/save';
import { GameSession } from '../src/core/session';
import { ALL_SKILLS, obtainableSkills, preferOwnLevel, skillDef, skillsForJob } from '../src/core/skills';
import { jobData } from '../src/core/jobs';

const NOW = new Date(Date.UTC(2026, 9, 21, 9, 0, 0));
const session = (seed: number, clock = NOW) => new GameSession(new MemorySaveStore(), () => clock, seed);

/** C# GameBalance.FairGrade / RecommendedEnhance. */
const fairGrade = (floor: number): ItemGrade => (floor >= 20 ? 'Epic' : floor >= 12 ? 'Rare' : 'Uncommon');
const recommendedEnhance = (floor: number): number => Math.min(B.MaxEnhance, Math.floor(Math.max(0, floor) / 2));
const levelUpTo = (c: Character, level: number) => {
  while (c.Level < level) addExp(c, expToNext(c.Level));
};

// ── V20Tests ──────────────────────────────────────────────

/** 그 층 적정 장비(층 등급 · 층 ÷ 2 강화, 장신구 3개 모두 주 공격 능력치)를 낀 캐릭터. */
function fairHero(job: Job, floor: number): Character {
  const c = createCharacter('a', job);
  levelUpTo(c, Math.max(1, roundEven(floor * 1.9 - 0.5)));
  autoAllocate(c);
  c.Rank = RANKS[Math.min(RANKS.indexOf('S'), Math.floor(floor / 5))];
  const lv = Math.min(c.Level, floor * 2 - 1);
  const gears: GearType[] = ['Helmet', 'Armor', 'Pants', 'Boots', 'Necklace', 'Ring', 'Ring', 'Weapon'];
  for (const gear of gears) {
    const item = createGear(gear, fairGrade(floor), lv, job, jobData(job).attackStat);
    item.Enhance = recommendedEnhance(floor);
    addItem(c.Inventory, item);
    const r = equip(c, item.Uid);
    expect(r.ok, r.error ?? '').toBe(true);
  }
  return c;
}

describe('기획서 v2.0 (V20Tests)', () => {
  it('적정 장비의 비중은 40%를 넘지 않는다', () => {
    for (const job of JOBS) {
      for (let f = 1; f <= B.MaxFloor; f++) {
        const c = fairHero(job, f);
        const main = jobData(c.Job).attackStat;
        const weapon = weaponAttack(c) / attack(c);
        const armor = 1 - B.DefenseConstant / (B.DefenseConstant + defense(c));
        const acc = equipmentBonus(c, main) / totalStat(c, main);
        const at = `${job} ${f}층`;
        expect(weapon, `${at} 무기 몫`).toBeLessThanOrEqual(B.MaxGearShare);
        expect(armor, `${at} 방어구 피해 감소`).toBeLessThanOrEqual(B.MaxGearShare + 1e-9);
        expect(acc, `${at} 장신구 몫`).toBeLessThanOrEqual(B.MaxGearShare);
      }
    }
  });

  it('적정 장비로도 가장 센 스킬 한 번에 정예가 쓰러지지 않는다', () => {
    for (let f = 1; f <= B.MaxFloor; f++) {
      const c = fairHero('Warrior', f);
      const hit = (attack(c) * B.DefenseConstant) / (B.DefenseConstant + enemyDefense(f));
      let best = 1;
      for (const s of skillsForJob(c.Job)) if (s.ReqLevel <= c.Level && s.Target === 'SingleEnemy') best = Math.max(best, s.DamageMult * s.Hits);
      expect(enemyHp(f) * B.EliteHp, `${f}층 정예는 가장 센 스킬 한 번에 쓰러지지 않음`).toBeGreaterThan(hit * best);
      expect(enemyHp(f), `${f}층 일반 몬스터는 기본 공격 세 번쯤`).toBeGreaterThan(hit * 2.5);
    }
  });

  it('레벨 차이가 크면 낮은 등급이어도 레벨이 앞선다', () => {
    for (const gear of GEARS) {
      for (let lv = 20; lv <= B.MaxLevel; lv += 10) {
        const high = baseValue(gear, lv, 'Uncommon');
        const low = baseValue(gear, lv - 10, 'Rare');
        expect(high, `${gear} Lv.${lv} 고급 ≥ Lv.${lv - 10} 희귀`).toBeGreaterThanOrEqual(low);
      }
      // 레벨 차이가 적으면 높은 등급이 앞설 수 있다
      expect(baseValue(gear, 59, 'Legendary'), `${gear} 1레벨 차이`).toBeGreaterThan(baseValue(gear, 60, 'Common'));
    }
  });

  it('강화는 높은 등급일수록 더 오르고 항상 오른다', () => {
    let prev = 0;
    for (const g of GRADES) {
      const w = createGear('Weapon', g, 30, 'Warrior', 'Strength');
      const growth = (valueAt(w, 15) - w.BaseValue) / w.BaseValue;
      expect(growth, `${g} 강화 상승폭`).toBeGreaterThan(prev);
      prev = growth;
    }
    for (const gear of GEARS) {
      const item = createGear(gear, 'Common', 1, 'Warrior', 'Strength');
      const accessory = gear === 'Necklace' || gear === 'Ring';
      for (let e = 0; e < B.MaxEnhance; e++) {
        if (accessory) expect(valueAt(item, e + 2), `${gear} 2단계마다 최소 +1`).toBeGreaterThanOrEqual(valueAt(item, e) + 1);
        else expect(valueAt(item, e + 1), `${gear} +${e + 1}은 항상 오른다`).toBeGreaterThan(valueAt(item, e));
      }
    }
  });

  it('반지: 덜 중요한 쪽을 바꾸고 솔직하게 비교한다', () => {
    const ring = (stat: Stat, value: number): ItemInstance => {
      const r = createGear('Ring', 'Common', 10, 'Warrior', stat);
      r.BaseValue = value;
      return r;
    };
    const c = createCharacter('a', 'Warrior'); // 주요 능력치: 체력·힘·강인함
    setEquipped(c, 'Ring1', ring('Strength', 6));
    setEquipped(c, 'Ring2', ring('Luck', 3));
    const luckBig = ring('Luck', 9);
    const strSmall = ring('Strength', 2);
    const vitSmall = ring('Vitality', 2);
    c.Level = 30;

    // 주요 능력치가 아닌 행운 반지를 먼저 바꾼다 (반지 1의 수치가 더 커도)
    expect(slotFor(c, 'Ring')).toBe('Ring2');
    expect(summary(c, luckBig)!.delta).toBe(6);
    // 주요 능력치 반지로 비주요 반지를 바꾸면 좋아짐
    const s = summary(c, vitSmall)!;
    expect(s.delta).toBeGreaterThan(0);
    expect(s.label).toBe('체력');

    // 둘 다 주요 능력치면 수치가 낮은 반지를 바꾸고, 수치 차이로 판단한다
    setEquipped(c, 'Ring2', ring('Vitality', 4));
    expect(slotFor(c, 'Ring')).toBe('Ring2');
    expect(summary(c, strSmall)!.delta).toBe(-2);

    // 비주요 능력치 반지로 주요 반지를 바꾸면 수치가 커도 나빠짐
    setEquipped(c, 'Ring1', ring('Strength', 2));
    setEquipped(c, 'Ring2', ring('Strength', 3));
    const d = summary(c, luckBig)!;
    expect(d.delta).toBeLessThan(0);
    expect(d.label).toBe('힘');

    addItem(c.Inventory, luckBig);
    expect(equip(c, luckBig.Uid).ok).toBe(true);
    expect(equipped(c, 'Ring1')).toBe(luckBig);
  });

  it('드롭은 내 레벨에 맞춘다', () => {
    const c = createCharacter('a', 'Warrior');
    levelUpTo(c, 10);
    const rng = new Rng(3);
    let above = 0, upgraded = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const item = createDrop(rng, 'Common', 6, c); // 층 기준 9~13레벨
      if (item.LevelReq > c.Level) above++;
      else if (item.LevelReq < c.Level && item.Grade === 'Uncommon') upgraded++;
    }
    expect(above / n, '내 레벨보다 높은 장비는 절반으로 (원래 약 40%)').toBeGreaterThanOrEqual(0.15);
    expect(above / n).toBeLessThanOrEqual(0.35);
    expect(upgraded, '낮은 레벨 장비는 가끔 한 등급 위').toBeGreaterThan(0);

    levelUpTo(c, 14); // 상급(Lv.18)이 +5 안에 들어옴
    let over = 0;
    for (let i = 0; i < 2000; i++) {
      const list = preferOwnLevel(obtainableSkills(c.Level, 'Warrior'), c.Level, rng);
      if (list.some((s) => s.ReqLevel > c.Level)) over++;
    }
    expect(over / 2000, '레벨 위 스킬서는 절반 확률로 빠짐').toBeGreaterThanOrEqual(0.4);
    expect(over / 2000).toBeLessThanOrEqual(0.6);
  });

  it('피의 우물: 바칠수록 대가 확률이 커진다', () => {
    for (let i = 1; i < BLOOD_RISK.length; i++) expect(BLOOD_RISK[i]).toBeGreaterThan(BLOOD_RISK[i - 1]);
    let cursed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const s = session(seed);
      s.newGame('a', 'Warrior', 'Normal');
      s.setTutorial('Done');
      s.enterDungeon();
      const c = s.c;
      const room = currentRoom(s.run!);
      room.EventId = 'evt_blood_well';
      levelUpTo(c, 30);
      for (let step = 0; step < BLOOD_RISK.length; step++) {
        c.CurrentHp = maxHp(c);
        room.Cleared = false;
        room.EventStep = step;
        const r = resolveEvent(s.run!, c, 0, new Rng(seed * 7 + step));
        if (r.Text.includes('\n')) cursed++;
      }
    }
    const rate = cursed / (200 * BLOOD_RISK.length);
    const expected = BLOOD_RISK.reduce((a, p) => a + p / BLOOD_RISK.length, 0);
    expect(Math.abs(rate - expected), '평균 대가 확률').toBeLessThanOrEqual(0.06);
  });

  it('예전 저장의 장비 수치는 새 공식을 따른다', () => {
    const store = new MemorySaveStore();
    const s = new GameSession(store, () => NOW, 1);
    s.newGame('a', 'Warrior', 'Normal');
    const item = createGear('Armor', 'Rare', 30, 'Warrior', 'Strength');
    item.BaseValue = 999; // 예전 공식으로 만든 장비
    addItem(s.c.Inventory, item);
    s.save();
    const loaded = loadGame(store)!;
    expect(loaded.Character.Inventory.Items.find((i) => i.Uid === item.Uid)!.BaseValue).toBe(baseValue('Armor', 30, 'Rare'));
  });
});

// ── V24Tests ──────────────────────────────────────────────

describe('기획서 v2.4 (V24Tests)', () => {
  it('방 배치: 같은 종류가 붙지 않고(전투 제외) 시작 방 옆에 휴식 방이 없다', () => {
    const rng = new Rng(24);
    let bad = 0;
    const floors = 400;
    for (let i = 0; i < floors; i++) {
      const map = generateFloor(1 + (i % 30), rng);
      if (violations(map) > 0) bad++;
      for (const l of getRoom(map, map.StartId)!.Links) expect(getRoom(map, l)!.Type, '시작 방 바로 옆에는 휴식 방이 없다').not.toBe('Rest');
    }
    expect(bad, '규칙을 어긴 층은 거의 없다 (방 종류가 모자란 드문 경우만)').toBeLessThanOrEqual(floors / 100);
  });

  it('강인함: 피해 감소는 낮아지고 상한이 있다', () => {
    const w = createCharacter('a', 'Warrior');
    setStat(w.BaseStats, 'Toughness', 40);
    expect(damageReduction(w), '강인함 40 = 14%').toBeCloseTo(0.14, 9);
    setStat(w.BaseStats, 'Toughness', 99);
    expect(damageReduction(w), '최대 30%').toBeCloseTo(0.3, 9);
  });

  it('상태만 거는 스킬은 수련할 수 없다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Gold = 100_000;
    learnSkill(c, 'w_warcry');
    expect(canTrain(skillDef('w_warcry'))).toBe(false);
    const r = trainSkill(c, 'w_warcry');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('바뀌는 것이 없는');
    expect(canTrain(skillDef('w_bash'))).toBe(true);
    for (const s of ALL_SKILLS) expect(canTrain(s), s.Id).toBe(s.IsAttack || s.HealRatio > 0);
  });

  it('상태 이상 실제 확률 = 명중률 × 효과 확률 × (1 - 저항)', () => {
    const c = createCharacter('a', 'Warrior');
    c.Level = 20;
    learnSkill(c, 'w_shield');
    const boss = createEnemy(monster('goblin')!, 1, 'Normal', 2);
    const b = new Battle(c, 1, [boss], true, new Rng(1));
    const def = skillDef('w_shield')!;
    const stun = def.Statuses[0];
    const hit = b.hitChance(boss, def.SuccessBonus);
    expect(b.statusLandChance(def, stun, boss)).toBeCloseTo(hit * stun.Chance * (1 - boss.resist), 9);
    expect(b.statusLandChance(def, stun, boss), '표기 명중률보다 실제 기절 확률이 낮다').toBeLessThan(hit);
  });

  it('효과를 주는 이벤트는 다음 층에 다시 나오지 않는다', () => {
    const effects: ExploreEffect[] = [{ Type: 'DemonPact', Battles: -1 }];
    const ids = eventsGrantingActiveEffects(effects);
    expect(ids).toContain('evt_demon_whisper');
    const rng = new Rng(9);
    for (let i = 0; i < 200; i++) {
      const map = generateFloor(5, rng, undefined, ids);
      for (const r of map.Rooms) expect(r.EventId).not.toBe('evt_demon_whisper');
    }
  });

  it('장착한 스킬의 순서를 바꿀 수 있다', () => {
    const c = createCharacter('a', 'Mage');
    c.Level = 40;
    c.Rank = 'SS';
    for (const id of ['m_bolt', 'm_shard']) {
      learnSkill(c, id);
      equipSkill(c, id);
    }
    const before = [...c.Skills.Equipped];
    expect(moveEquippedSkill(c, 0, before.length - 1)).toBe(true);
    expect(c.Skills.Equipped[before.length - 1]).toBe(before[0]);
    expect(c.Skills.Equipped[0]).toBe(before[1]);
    expect(moveEquippedSkill(c, 0, 99)).toBe(false);
  });
});

// ── V23Tests 중 웹에 없던 것 ───────────────────────────────

describe('기획서 v2.3 (V23Tests)', () => {
  it('보물 방은 예전보다 드물다', () => {
    const rng = new Rng(5);
    let treasure = 0, none = 0;
    const runs = 4000;
    for (let i = 0; i < runs; i++) {
      const n = rollRoomTypes(rng).filter((t) => t === 'Treasure').length;
      treasure += n;
      if (n === 0) none++;
    }
    expect(treasure / runs, '예전 평균은 1.14개').toBeLessThan(0.95);
    expect(none, '보물 방이 없는 층도 꽤 있다').toBeGreaterThan(runs / 5);
  });

  it('위험한 이벤트에는 공짜 탈출구가 있다', () => {
    for (const id of ['ceiling', 'evt_demon_whisper', 'evt_goblin_chase']) {
      const def = eventDef(id)!;
      const c = createCharacter('a', 'Mage');
      const pass = def.Choices.find(
        (ch) => ch.Check == null && !ch.CheckAttackStat && ch.FixedChance >= 1.0 && ch.JobOnly < 0
          && ch.Success != null && ch.Success.HpRatio >= 0 && ch.Success.GoldMult >= 0 && ch.Success.Battle === 'None',
      );
      expect(pass, `${id}: 100% 성공하고 대가 없는 선택지`).toBeDefined();
      expect(successChance(pass!, c, 5)).toBeCloseTo(1.0, 9);
    }
  });

  it('창고가 줄어도 이미 맡긴 물건은 남는다', () => {
    const c = createCharacter('a', 'Warrior');
    c.Storage.Capacity = 10;
    for (let i = 0; i < 8; i++) addItem(c.Storage, createGear('Helmet', 'Common', 1, 'Warrior', 'Strength'));
    c.Storage.Capacity = storageCapacity('F');
    expect(c.Storage.Capacity).toBe(4);
    expect(c.Storage.Items.length, '이미 맡긴 물건은 지우지 않는다').toBe(8);
    expect(Math.max(0, c.Storage.Capacity - c.Storage.Items.length)).toBe(0);
    c.Gold = 100_000;
    const extra = createGear('Helmet', 'Common', 1, 'Warrior', 'Strength');
    addItem(c.Inventory, extra);
    expect(deposit(c, extra.Uid).ok, '새로 맡기는 것만 막힌다').toBe(false);
    expect(withdraw(c, c.Storage.Items[0].Uid).ok, '찾는 것은 된다').toBe(true);
  });
});

// ── SpecialEventTests 중 웹에 없던 것 ───────────────────────

/** 이벤트 방을 지금 방과 잇고 들어간 던전 (C# RunAt). */
function runAt(c: Character, eventId: string, floor: number, rng: Rng): DungeonRun {
  c.HighestFloorCleared = Math.max(c.HighestFloorCleared, floor - 1);
  const run = startRun(c, floor, rng);
  const room = run.Map.Rooms.find((r) => r.Type === 'Event')!;
  room.EventId = eventId;
  const cur = currentRoom(run);
  if (!cur.Links.includes(room.Id)) cur.Links.push(room.Id);
  if (!room.Links.includes(cur.Id)) room.Links.push(cur.Id);
  moveTo(run, room.Id);
  return run;
}

describe('특수 이벤트 (SpecialEventTests)', () => {
  it('시련의 문: 보스전은 클리어로 치고 마을로 돌아간다', () => {
    const s = session(4, new Date(Date.UTC(2026, 9, 19, 9, 0, 0)));
    s.newGame('a', 'Warrior', 'Normal');
    s.setTutorial('Done');
    s.c.HighestFloorCleared = 3;
    s.selectFloor(4);
    s.enterDungeon();
    const run = s.run!;
    const room = run.Map.Rooms.find((r) => r.Type === 'Event')!;
    room.EventId = 'evt_trial_gate';
    run.CurrentRoomId = room.Id;
    room.Visited = true;
    const def = s.pendingEvent!;
    expect(def.Special).toBe('TrialGate');
    expect(choiceLabel(def, 2, run, s.c)).toContain('·');

    s.chooseEvent(2); // 다다음 층 (6층)
    expect(s.battle).not.toBeNull();
    expect(s.battle!.isBoss).toBe(true);
    expect(s.battle!.canFlee, '시련의 보스에게서는 도망칠 수 있다').toBe(true);
    expect(s.battle!.floor).toBe(6);
    expect(run.TrialFloor).toBe(6);

    // 이긴 것으로 만든다
    for (let i = 0; i < 400 && !s.battle!.isOver; i++) {
      for (const e of s.battle!.enemies) e.hp = Math.min(e.hp, 1);
      s.battle!.player.hp = s.battle!.player.maxHp;
      const atk = s.battle!.getChoices().find((ch) => ch.kind === 'Attack')!;
      s.executeBattle(atk);
    }
    expect(s.battle!.outcome).toBe('Victory');
    expect(s.trialWon).toBe(true);
    expect(s.c.HighestFloorCleared).toBe(6);
    s.closeBattle();
    expect(s.inDungeon).toBe(false);
    expect(s.lastReturn!.Floor).toBe(6);
    expect(s.lastReturn!.BossCleared).toBe(true);
    expect(maxChallengeFloor(s.c)).toBe(7);
  });

  it('시련의 문: 이미 깬 층과 너무 깊은 층은 숨긴다', () => {
    const rng = new Rng(2);
    const c = createCharacter('a', 'Mage');
    c.HighestFloorCleared = 29;
    const run = runAt(c, 'evt_trial_gate', 29, rng);
    const def = eventDef('evt_trial_gate')!;
    const visible = visibleChoices(def, c, run);
    expect(visible).toContain(0);
    expect(visible).toContain(1);
    expect(visible.includes(2), '31층 시련은 없다').toBe(false);
    run.BossDefeated = true;
    expect(visibleChoices(def, c, run).includes(0)).toBe(false);
  });

  it('이벤트 전투에서 도망치면 이벤트가 끝난다', () => {
    const s = session(6, new Date(Date.UTC(2026, 9, 19, 9, 0, 0)));
    s.newGame('a', 'Archer', 'Normal');
    s.setTutorial('Done');
    s.enterDungeon();
    const run = s.run!;
    const room = run.Map.Rooms.find((r) => r.Type === 'Event')!;
    room.EventId = 'evt_campfire';
    run.CurrentRoomId = room.Id;
    room.Visited = true;
    const def = s.pendingEvent!;
    const fight = def.Choices.findIndex((ch) => ch.Success.Battle === 'Wanderer');
    s.chooseEvent(fight);
    expect(s.battle).not.toBeNull();
    expect(s.battle!.enemies[0].name).toBe('떠돌이 모험가');
    for (let i = 0; i < 200 && s.battle != null && !s.battle.isOver; i++) {
      s.battle.player.hp = s.battle.player.maxHp;
      s.executeBattle(s.battle.getChoices().find((ch) => ch.kind === 'Flee')!);
    }
    expect(s.battle).toBeNull();
    expect(room.Cleared).toBe(true);
    expect(s.pendingEvent).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import { Battle, ENERGY_BALL } from '../src/core/battle';
import { createCharacter } from '../src/core/character';
import { currentRoom } from '../src/core/dungeon';
import { createEnemy } from '../src/core/enemies';
import { DIFFICULTIES, JOBS } from '../src/core/enums';
import type { Difficulty, Job } from '../src/core/enums';
import { monster } from '../src/core/monsters';
import { Rng } from '../src/core/rng';
import { MemorySaveStore, newSaveData, repair } from '../src/core/save';
import { GameSession } from '../src/core/session';

const session = (seed: number) => new GameSession(new MemorySaveStore(), () => new Date(2026, 0, 1), seed);

/** 0층 튜토리얼을 무작위 공격·스킬만으로 끝까지 (물약·대기 없음). */
function playTutorial(job: Job, diff: Difficulty, seed: number) {
  const s = session(seed);
  s.newGame('t', job, diff);
  const gold = s.c.Gold, items = s.c.Inventory.Items.length;
  s.enterDungeon();
  const pick = new Rng(seed * 7 + 3);
  for (const t of ['Battle', 'Rest', 'Battle', 'Boss']) {
    const run = s.run!;
    s.move(currentRoom(run).Links.map((i) => run.Map.Rooms[i]).find((r) => r.Type === t && !r.Visited)!.Id);
    while (s.battle && !s.battle.isOver) {
      const list = s.battle.getChoices().filter((c) => c.enabled && (c.kind === 'Attack' || c.kind === 'Skill'));
      s.executeBattle(list[pick.range(0, list.length)]);
    }
    if (!s.inDungeon) return { s, dead: true, gold, items };
    s.closeBattle();
  }
  return { s, dead: false, gold, items };
}

describe('v3.15 튜토리얼 0층', () => {
  it('모든 직업·난이도에서 튜토리얼 보스를 반드시 잡는다 (명중 100% · 쉬움 능력치)', () => {
    for (const job of JOBS) for (const diff of DIFFICULTIES) for (let seed = 1; seed <= 25; seed++) {
      const { s, dead } = playTutorial(job, diff, seed);
      expect(dead, `${job} ${diff} ${seed}`).toBe(false);
      expect(s.run!.BossDefeated).toBe(true);
    }
  });

  it('0층은 클리어 보상만 주고 경험치·전투 골드·돌파 층·퀘스트에 들어가지 않는다', () => {
    const { s, gold, items } = playTutorial('Warrior', 'Normal', 3);
    expect(s.run!.Floor).toBe(0);
    expect(s.c.Exp).toBe(0);
    expect(s.c.Level).toBe(1);
    expect(s.c.HighestFloorCleared).toBe(0);
    expect(s.c.Gold).toBe(gold + B.TutorialRewardGold);
    expect(s.c.Inventory.Items.length).toBe(items + 1); // 갑옷 + (물약은 기존 묶음에 합쳐짐)
    expect(s.c.Inventory.Items.some((i) => i.Gear === 'Armor' && i.Grade === 'Uncommon')).toBe(true);
    expect(s.data!.Guild.Active.every((q) => q.Progress === 0)).toBe(true);
    s.returnToTown();
    expect(s.data!.SelectedFloor).toBe(1);
    expect(s.data!.Tutorial).toBe('AfterReturn');
  });

  it('건너뛰기는 같은 보상을 한 번만 주고, 0층 안이면 바로 마을로 돌아간다', () => {
    const a = playTutorial('Mage', 'Normal', 5).s.c;
    const s = session(9);
    s.newGame('t', 'Mage', 'Normal');
    s.enterDungeon();
    const reward = s.skipTutorial()!;
    expect(reward.Gold).toBe(B.TutorialRewardGold);
    expect(reward.Items.map((i) => i.Name)).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(s.inDungeon).toBe(false);
    expect(s.data!.Tutorial).toBe('Done');
    expect(s.c.Gold).toBe(a.Gold); // 출발선이 같다
    expect(s.c.Level).toBe(a.Level);
    // 설정에서 튜토리얼을 다시 봐도 보상은 다시 없다
    s.restartTutorial();
    expect(s.skipTutorial()).toBeNull();
  });

  it('예전 저장: 튜토리얼을 지난 모험가는 보상을 받은 것으로 친다', () => {
    const d = newSaveData('Normal', createCharacter('a', 'Warrior'), 'Done') as any;
    delete d.TutorialReward;
    repair(d);
    expect(d.TutorialReward).toBe(true);
    const e = newSaveData('Normal', createCharacter('a', 'Warrior'), 'TownGuide') as any;
    delete e.TutorialReward;
    repair(e);
    expect(e.TutorialReward).toBe(false);
  });
});

describe('v3.15 마법사 에너지 볼', () => {
  it('에너지 볼로 마지막 적을 잡아도 다음 전투 첫 턴에 바로 쓸 수 있다 (재사용은 전투가 끝나면 풀림)', () => {
    const mk = (hp: number) => { const e = createEnemy(monster('goblin')!, 1, 'Normal', 0); e.maxHp = e.hp = hp; e.attack = 1; e.requirement = -1000; return e; };
    const c = createCharacter('t', 'Mage');
    const b1 = new Battle(c, 1, [mk(1)], false, new Rng(1));
    b1.execute(b1.getChoices().find((x) => x.kind === 'Attack')!);
    expect(b1.isOver).toBe(true);
    const b2 = new Battle(c, 1, [mk(9999)], false, new Rng(2), { cooldowns: b1.cooldownState() });
    const eb = b2.getChoices().find((x) => x.kind === 'Attack')!;
    expect(eb.enabled).toBe(true);
    expect(eb.label.startsWith('에너지 볼')).toBe(true);
    expect(b2.cooldown(ENERGY_BALL)).toBe(0);
  });
});

describe('v3.16 층 보상 배율 · 궁수', () => {
  it('처음 클리어 전 ×1.5, 클리어할수록 ×0.8씩 줄고 최저 ×0.5', async () => {
    const { floorClearMult } = await import('../src/core/balance');
    expect([0, 1, 2, 3, 4, 5, 9].map(floorClearMult)).toEqual([1.5, 1, 0.8, expect.closeTo(0.64), expect.closeTo(0.512), 0.5, 0.5]);
  });

  it('보스를 잡으면 그 층 클리어 횟수가 오르고, 예전 저장은 돌파한 층을 한 번씩 클리어한 것으로 친다', () => {
    const d = newSaveData('Normal', createCharacter('a', 'Archer'), 'Done') as any;
    expect(d.Character.Skills.Equipped).toEqual(['a_scatter']); // 궁수 시작 스킬
    d.Character.HighestFloorCleared = 3;
    delete d.Character.FloorClears;
    repair(d);
    expect(d.Character.FloorClears).toEqual({ 1: 1, 2: 1, 3: 1 });
  });
});

describe('v3.16 창고 나눠 맡기기', () => {
  it('여러 개짜리 물품을 고른 개수만큼만 맡기고 찾는다', async () => {
    const { deposit, withdraw } = await import('../src/core/guild');
    const c = createCharacter('a', 'Warrior');
    c.Gold = 1000;
    const potion = c.Inventory.Items.find((i) => i.TemplateId === 'potion')!;
    expect(potion.Count).toBe(3);
    expect(deposit(c, potion.Uid, 2).ok).toBe(true);
    expect(c.Inventory.Items.find((i) => i.TemplateId === 'potion')!.Count).toBe(1);
    const stored = c.Storage.Items.find((i) => i.TemplateId === 'potion')!;
    expect(stored.Count).toBe(2);
    expect(withdraw(c, stored.Uid, 1).ok).toBe(true);
    expect(c.Inventory.Items.find((i) => i.TemplateId === 'potion')!.Count).toBe(2);
    expect(c.Storage.Items.find((i) => i.TemplateId === 'potion')!.Count).toBe(1);
  });
});

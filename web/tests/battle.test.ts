import { describe, expect, it } from 'vitest';
import { B, expToNext } from '../src/core/balance';
import { Battle, damage } from '../src/core/battle';
import type { BattleChoice, BattleEventKind } from '../src/core/battle';
import { equipBossTraits, traitsFor } from '../src/core/bosskit';
import { addExp, autoAllocate, createCharacter, maxHp, totalStat } from '../src/core/character';
import { Combatant } from '../src/core/combatant';
import { createBoss, createEnemy, createGroup, createTutorialBoss, nameDuplicates } from '../src/core/enemies';
import { learnSkill, equipSkill } from '../src/core/equipment';
import type { Job } from '../src/core/enums';
import { JOBS } from '../src/core/enums';
import { countOf } from '../src/core/items';
import { monster, themeIndex, THEMES } from '../src/core/monsters';
import { Rng } from '../src/core/rng';
import { skillsForJob } from '../src/core/skills';
import { StatusContainer } from '../src/core/status';

const goblin = () => monster('goblin')!;

function newBattle(job: Job, floor: number, seed: number, enemies = 2) {
  const c = createCharacter('에단', job);
  const list: Combatant[] = [];
  for (let i = 0; i < enemies; i++) list.push(createEnemy(goblin(), floor, 'Normal', 0));
  nameDuplicates(list);
  return { b: new Battle(c, floor, list, false, new Rng(seed)), c };
}

describe('상태 이상 중첩 (BattleTests)', () => {
  it('다른 효과는 함께 적용', () => {
    const s = new StatusContainer();
    s.apply('Empower', 20, 3);
    s.apply('Fortify', 20, 2);
    expect(s.value('Empower')).toBe(20);
    expect(s.value('Fortify')).toBe(20);
    expect(s.visible().length).toBe(2);
  });
  it('같은 수치는 남은 턴이 긴 쪽, 같으면 나중에 건 쪽', () => {
    const s = new StatusContainer();
    s.apply('Poison', 4, 3);
    s.apply('Poison', 4, 1);
    expect(s.active('Poison')!.Turns).toBe(3);
    s.apply('Poison', 4, 5);
    expect(s.active('Poison')!.Turns).toBe(5);
    expect(s.all.length).toBe(1);
    const w = new StatusContainer();
    w.apply('Weaken', 20, 2);
    const first = w.active('Weaken');
    w.apply('Weaken', 20, 2);
    expect(w.active('Weaken')).not.toBe(first);
  });
  it('높은 수치가 먼저 적용되고 끝나면 낮은 쪽이 이어진다', () => {
    const s = new StatusContainer();
    s.apply('Empower', 10, 4, true);
    s.apply('Empower', 30, 1, true);
    expect(s.value('Empower')).toBe(30);
    s.tick();
    s.tick();
    expect(s.value('Empower')).toBe(10);
    expect(s.active('Empower')!.Turns).toBe(3);
  });
  it('스스로 건 효과는 그 차례 끝에 줄지 않는다', () => {
    const s = new StatusContainer();
    s.apply('Empower', 20, 3, true);
    s.tick();
    expect(s.active('Empower')!.Turns).toBe(3);
    s.tick();
    s.tick();
    expect(s.active('Empower')!.Turns).toBe(1);
    s.tick();
    expect(s.has('Empower')).toBe(false);
  });
});

describe('적 생성', () => {
  it('무리 크기·이름·테마', () => {
    for (let seed = 0; seed < 500; seed++) {
      const floor = 1 + (seed % 30);
      const g = createGroup(floor, 'Normal', seed);
      expect(g.length).toBeGreaterThanOrEqual(1);
      expect(g.length).toBeLessThanOrEqual(4);
      const names = new Set<string>();
      for (const e of g) {
        expect(names.has(e.name)).toBe(false);
        names.add(e.name);
        expect(e.species!.Tier).toBe(themeIndex(floor));
        expect(e.maxHp).toBeGreaterThan(0);
        expect(e.attack).toBeGreaterThan(0);
      }
    }
    const mk = (n: string) => Object.assign(new Combatant(), { name: n });
    const dup = [mk('고블린'), mk('고블린'), mk('고블린 궁수')];
    nameDuplicates(dup);
    expect(dup.map((d) => d.name)).toEqual(['고블린 A', '고블린 B', '고블린 궁수']);
  });
  it('10·20·30층은 고유 보스', () => {
    expect(createBoss(10, 'Normal', 1)[0].name).toBe('고블린 왕');
    expect(createBoss(20, 'Normal', 1)[0].name).toBe('저승사자');
    expect(createBoss(30, 'Normal', 1)[0].name).toBe('고대 골렘');
    expect(createBoss(7, 'Normal', 1)[0].name.endsWith('우두머리')).toBe(true);
  });
  it('난이도 배율', () => {
    const normal = createEnemy(goblin(), 10, 'Normal', 0);
    const easy = createEnemy(goblin(), 10, 'Easy', 0);
    const hard = createEnemy(goblin(), 10, 'Hard', 0);
    expect(Math.abs(easy.maxHp - normal.maxHp * 0.75)).toBeLessThanOrEqual(1);
    expect(Math.abs(hard.maxHp - normal.maxHp * 1.25)).toBeLessThanOrEqual(1);
    expect(Math.abs(hard.attack - normal.attack * 1.25)).toBeLessThanOrEqual(1);
  });
});

describe('전투 진행', () => {
  it('선택지: 적마다 공격, 스킬, 아이템, 도주', () => {
    const { b } = newBattle('Warrior', 1, 1);
    const ch = b.getChoices();
    expect(ch[0].label).toBe('공격 · 고블린 A');
    expect(ch[1].label).toBe('공격 · 고블린 B');
    expect(ch.some((x) => x.label === '강타 · 고블린 A')).toBe(true);
    expect(ch.some((x) => x.kind === 'Item')).toBe(true);
    expect(ch.find((x) => x.kind === 'Flee')!.enabled).toBe(true);
    for (const x of ch) {
      expect(x.chance).toBeGreaterThanOrEqual(0.05);
      expect(x.chance).toBeLessThanOrEqual(1);
    }
  });

  it('스킬 재사용 대기', () => {
    const { b } = newBattle('Warrior', 1, 2, 1);
    b.enemies[0].maxHp = b.enemies[0].hp = 100000;
    b.execute(b.getChoices().find((x) => x.skillId === 'w_bash')!);
    expect(b.cooldown('w_bash')).toBe(4);
    const again = b.getChoices().find((x) => x.skillId === 'w_bash')!;
    expect(again.enabled).toBe(false);
    expect(again.note).toBe('4턴');
    for (let i = 3; i >= 0; i--) {
      b.execute(b.getChoices()[0]);
      expect(b.cooldown('w_bash')).toBe(i);
    }
    expect(b.getChoices().some((x) => x.skillId === 'w_bash' && x.enabled)).toBe(true);
  });

  it('모든 선택은 1턴', () => {
    const { b } = newBattle('Warrior', 1, 3, 1);
    b.enemies[0].maxHp = b.enemies[0].hp = 100000;
    expect(b.turn).toBe(1);
    b.execute(b.getChoices()[0]);
    expect(b.turn).toBe(2);
  });

  it('승리: 적을 모두 쓰러뜨린다', () => {
    const { b } = newBattle('Warrior', 1, 4, 2);
    for (const e of b.enemies) e.hp = 1;
    let guard = 0;
    while (!b.isOver && guard++ < 50) b.execute(b.getChoices()[0]);
    expect(b.outcome).toBe('Victory');
    expect(b.defeated.length).toBe(2);
  });

  it('패배: HP가 0이 되면 끝, 동기화하면 HP 0', () => {
    const { b, c } = newBattle('Mage', 30, 5, 4);
    for (const e of b.enemies) e.maxHp = e.hp = 1_000_000;
    let guard = 0;
    while (!b.isOver && guard++ < 200) b.execute(b.getChoices()[0]);
    expect(b.outcome).toBe('Defeat');
    expect(b.killedBy).not.toBe('');
    b.syncHp();
    expect(c.CurrentHp).toBe(0);
  });

  it('보스에게서는 도망칠 수 없다', () => {
    const c = createCharacter('a', 'Rogue');
    const b = new Battle(c, 10, createBoss(10, 'Normal', 1), true, new Rng(1));
    expect(b.getChoices().find((x) => x.kind === 'Flee')!.enabled).toBe(false);
    expect(b.fleeChance()).toBe(0);
  });

  it('도주는 결국 성공한다', () => {
    const { b } = newBattle('Rogue', 1, 6, 1);
    b.enemies[0].attack = 0;
    let guard = 0;
    while (!b.isOver && guard++ < 100) b.execute(b.getChoices().find((x) => x.kind === 'Flee')!);
    expect(b.outcome).toBe('Fled');
  });

  it('물약은 회복하고 소모된다', () => {
    const { b, c } = newBattle('Warrior', 1, 7, 1);
    b.enemies[0].attack = 0;
    b.player.hp = 10;
    const potion = b.getItemChoices().find((x) => x.enabled)!;
    b.execute(potion);
    expect(b.player.hp).toBeGreaterThan(10);
    expect(countOf(c.Inventory, 'potion')).toBe(2);
  });

  it('기절하면 대기 선택지 하나', () => {
    const { b } = newBattle('Warrior', 1, 8, 1);
    b.enemies[0].attack = 0;
    b.player.statuses.apply('Stun', 1, 1);
    const ch = b.getChoices();
    expect(ch.length).toBe(1);
    expect(ch[0].kind).toBe('Wait');
    const hp = b.enemies[0].hp;
    b.execute(ch[0]);
    expect(b.enemies[0].hp).toBe(hp);
    expect(b.player.statuses.has('Stun')).toBe(false);
  });

  it('침묵하면 스킬을 쓸 수 없다', () => {
    const { b } = newBattle('Warrior', 1, 9, 1);
    b.player.statuses.apply('Silence', 1, 2);
    const bash = b.getChoices().find((x) => x.skillId === 'w_bash')!;
    expect(bash.enabled).toBe(false);
    expect(bash.note).toBe('침묵 상태');
  });

  it('성공률 보정: 집중·실명·공포, 도주', () => {
    const { b, c } = newBattle('Warrior', 3, 10, 1);
    const e = b.enemies[0];
    const raw = B.BaseHit + (totalStat(c, 'Strength') - e.requirement) * 0.01;
    const clampHit = (v: number) => Math.max(B.MinHit, Math.min(B.MaxHit, v));
    expect(b.hitChance(e)).toBeCloseTo(clampHit(raw), 9);
    b.player.statuses.apply('Focus', 10, 3);
    expect(b.hitChance(e)).toBeCloseTo(clampHit(raw + 0.1), 9);
    b.player.statuses.clear();
    b.player.statuses.apply('Blind', 15, 3);
    expect(b.hitChance(e)).toBeCloseTo(clampHit(raw - 0.15), 9);
    b.player.statuses.clear();
    const flee = b.fleeChance();
    expect(flee).toBeCloseTo(Math.min(B.MaxFlee, 0.67 + b.player.evasion), 9);
    b.player.statuses.apply('Fear', 10, 3);
    expect(b.hitChance(e)).toBeCloseTo(clampHit(raw - 0.1), 9);
    expect(b.fleeChance()).toBeCloseTo(flee, 9);
    const attack = b.getChoices()[0];
    expect(attack.detail).toContain('기본 78%');
    expect(attack.detail).toContain('피해 계산');
    expect(attack.damageNote).toBe(`피해 약 ${damage(b.player, e, 1, false)}`);
    const bash = b.getChoices().find((x) => x.skillId === 'w_bash')!;
    expect(bash.detail).toContain('재사용 4턴');
    expect(bash.detail).toContain('치명타');
    expect(bash.damageNote.startsWith('단일 · 피해 약 ')).toBe(true);
  });

  it('피해 공식: 방어·버프·취약·감소', () => {
    const a = Object.assign(new Combatant(), { attack: 100, critDamage: 1.5 });
    const t = Object.assign(new Combatant(), { defense: 400 });
    expect(damage(a, t, 1, false)).toBe(50);
    expect(damage(a, t, 1, true)).toBe(75);
    a.statuses.apply('Empower', 20, 3);
    expect(damage(a, t, 1, false)).toBe(60);
    t.statuses.apply('Vulnerable', 20, 3);
    expect(damage(a, t, 1, false)).toBe(72);
    t.damageReduction = 0.5;
    expect(damage(a, t, 1, false)).toBe(36);
  });

  it('독·화상은 턴 시작에 피해', () => {
    const { b } = newBattle('Warrior', 1, 11, 1);
    b.enemies[0].attack = 0;
    b.enemies[0].maxHp = b.enemies[0].hp = 100000;
    b.player.statuses.apply('Poison', 4, 2);
    b.player.statuses.apply('Burn', 5, 2);
    b.enemies[0].statuses.apply('Stun', 1, 1);
    const max = b.player.maxHp;
    const hp = b.player.hp;
    b.execute(b.getChoices().find((x) => x.kind === 'Attack')!);
    expect(b.player.hp).toBe(hp - Math.max(1, Math.round(max * 0.04)) - 5);
  });

  it('여러 전투를 돌려도 예외가 없고 끝난다', () => {
    const rng = new Rng(99);
    let wins = 0;
    for (let i = 0; i < 400; i++) {
      const c = createCharacter('봇', JOBS[i % 4]);
      const floor = 1 + (i % 30);
      addExp(c, 200 * Math.floor(Math.pow(floor * 2, 2.5)));
      autoAllocate(c);
      const pool = skillsForJob(c.Job, ['Low', 'Mid']);
      for (let k = 0; k < 4; k++) learnSkill(c, pool[k].Id);
      c.Rank = 'C';
      for (const s of c.Skills.Learned) equipSkill(c, s.SkillId);
      c.CurrentHp = maxHp(c);
      const boss = i % 5 === 0;
      const enemies = boss ? createBoss(floor, 'Normal', i) : createGroup(floor, 'Normal', i);
      const b = new Battle(c, floor, enemies, boss, rng);
      let guard = 0;
      while (!b.isOver && guard++ < 300) {
        const ch = b.getChoices();
        b.execute(ch.find((x) => x.enabled && x.kind === 'Skill') ?? ch[0]);
      }
      expect(b.isOver).toBe(true);
      if (b.outcome === 'Victory') wins++;
    }
    expect(wins).toBeGreaterThan(100);
  });
});

// ── 보스 특성 (BossTests) ──

function hero(floor: number) {
  const c = createCharacter('a', 'Warrior');
  while (c.Level < floor * 2) addExp(c, expToNext(c.Level));
  autoAllocate(c);
  c.CurrentHp = maxHp(c);
  return c;
}
function mkBoss(id: string, floor: number) {
  const b = createEnemy(monster(id)!, floor, 'Normal', 2);
  equipBossTraits(b, floor);
  return b;
}
function fight(id: string, floor: number, seed: number) {
  const boss = mkBoss(id, floor);
  return { boss, b: new Battle(hero(floor), floor, [boss], true, new Rng(seed)) };
}
function hit(b: Battle, turns = 1) {
  for (let i = 0; i < turns && !b.isOver; i++) {
    b.player.hp = b.player.maxHp;
    const ch = b.getChoices();
    b.execute(ch.find((x: BattleChoice) => x.kind === 'Attack') ?? ch[0]);
  }
}
const count = (b: Battle, kind: BattleEventKind, text?: string) => b.lastEvents.filter((e) => e.kind === kind && (text === undefined || e.text === text)).length;

describe('보스 특성 (BossTests)', () => {
  it('모든 종족 보스는 특성이 있고 고유 보스는 2개 이상', () => {
    for (const t of THEMES) {
      for (const id of t.SpeciesIds) expect(traitsFor(id).length).toBeGreaterThan(0);
      expect(traitsFor(t.UniqueBossId).length).toBeGreaterThanOrEqual(2);
    }
    expect(createBoss(7, 'Normal', 3)[0].kit).not.toBeNull();
    expect(createTutorialBoss()[0].kit).toBeNull();
  });

  it('수치는 층이 깊을수록 커진다', () => {
    expect(mkBoss('rat', 2).kit!.barrier).toBe(1);
    expect(mkBoss('rat', 2).kit!.barrier).toBeLessThan(mkBoss('living_armor', 28).kit!.barrier);
    const low = mkBoss('orc_shaman', 11);
    const high = mkBoss('eye', 29);
    expect(low.kit!.maxShield / low.maxHp).toBeLessThan(high.kit!.maxShield / high.maxHp);
    expect(mkBoss('goblin_archer', 3).kit!.flurryHits).toBeLessThan(mkBoss('snake', 27).kit!.flurryHits);
    expect(mkBoss('orc', 12).kit!.smashMult).toBeLessThan(mkBoss('imp', 28).kit!.smashMult);
    expect(mkBoss('blood_leech', 21).kit!.ritualUses).toBeLessThan(mkBoss('blood_leech', 29).kit!.ritualUses);
    expect(mkBoss('slime', 2).kit!.splitCount).toBeLessThan(mkBoss('slime', 9).kit!.splitCount);
  });

  it('방어막은 피해 전에 타격을 막는다', () => {
    const { b, boss } = fight('skeleton', 16, 1);
    const charges = boss.kit!.barrier;
    const hp = boss.hp;
    let blocked = 0;
    for (let i = 0; i < 40 && boss.kit!.barrier > 0; i++) {
      hit(b);
      blocked += count(b, 'Text', '방어막');
      if (boss.kit!.barrier > 0) expect(boss.hp).toBe(hp);
    }
    expect(blocked).toBe(charges);
    for (let i = 0; i < 20 && boss.hp === hp; i++) hit(b);
    expect(boss.hp).toBeLessThan(hp);
  });

  it('보호막이 먼저 피해를 받는다', () => {
    const { b, boss } = fight('orc_shaman', 15, 2);
    const hp = boss.hp;
    const shield = boss.kit!.shield;
    expect(shield).toBeGreaterThan(0);
    for (let i = 0; i < 30 && boss.kit!.shield === shield; i++) hit(b);
    expect(boss.kit!.shield).toBeLessThan(shield);
    if (boss.kit!.shield > 0) expect(boss.hp).toBe(hp);
  });

  it('가시 비늘은 반사하지만 쓰러뜨리지 않는다', () => {
    const { b, boss } = fight('maneater', 25, 3);
    boss.statuses.apply('Stun', 1, 99);
    let reflected = 0;
    for (let i = 0; i < 20 && !b.isOver; i++) {
      b.player.hp = 2;
      b.execute(b.getChoices().find((x) => x.kind === 'Attack')!);
      reflected += b.lastEvents.filter((e) => e.kind === 'Damage' && e.actor === 0 && e.target === -1).length;
      expect(b.player.hp).toBeGreaterThanOrEqual(1);
    }
    expect(reflected).toBeGreaterThan(0);
  });

  it('혼신의 일격: 기 모으기 → 강타 → 탈진', () => {
    const { b, boss } = fight('orc', 12, 4);
    const seen: string[] = [];
    for (let i = 0; i < 12 && !b.isOver; i++) {
      boss.hp = boss.maxHp;
      hit(b);
      if (count(b, 'Text', '기를 모은다') > 0) {
        seen.push('charge');
        expect(boss.kit!.intent).toContain('강타');
      }
      if (b.lastEvents.some((e) => e.kind === 'Act' && e.text === '혼신의 일격')) seen.push('smash');
      if (count(b, 'Text', '탈진') > 0) seen.push('rest');
    }
    const c = seen.indexOf('charge');
    expect(c).toBeGreaterThanOrEqual(0);
    expect(seen[c + 1]).toBe('smash');
    expect(seen[c + 2]).toBe('rest');
  });

  it('연속 공격은 여러 번 때린다', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { b, boss } = fight('snake', 25, seed);
      for (let i = 0; i < 8 && !b.isOver; i++) {
        boss.hp = boss.maxHp;
        hit(b);
        if (!b.lastEvents.some((e) => e.kind === 'Act' && e.text === '연속 공격')) continue;
        const hits = b.lastEvents.filter((e) => e.actor === 0 && e.target === -1 && (e.kind === 'Damage' || e.kind === 'Miss')).length;
        expect(hits).toBe(boss.kit!.flurryHits);
        return;
      }
    }
    throw new Error('연속 공격이 한 번도 나오지 않음');
  });

  it('흡혈은 준 피해로 회복', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { b, boss } = fight('ghoul', 15, seed);
      boss.hp = Math.floor(boss.maxHp / 2);
      hit(b, 3);
      if (b.lastEvents.some((e) => e.kind === 'Heal' && e.target === 0)) return;
    }
    throw new Error('흡혈 회복이 없음');
  });

  it('광폭화는 HP 절반에서 한 번', () => {
    const { b, boss } = fight('goblin', 6, 5);
    const atk = boss.attack;
    boss.hp = Math.floor(boss.maxHp / 2) + 1;
    for (let i = 0; i < 10 && !boss.kit!.enraged && !b.isOver; i++) hit(b);
    expect(boss.kit!.enraged).toBe(true);
    expect(boss.attack).toBeGreaterThan(atk);
    const raged = boss.attack;
    hit(b, 2);
    expect(boss.attack).toBe(raged);
  });

  it('분열: 2페이즈, 보상 없는 작은 개체', () => {
    const { b, boss } = fight('slime', 6, 6);
    boss.hp = 1;
    for (let i = 0; i < 10 && boss.alive; i++) hit(b);
    expect(boss.alive).toBe(false);
    expect(b.isOver).toBe(false);
    const kids = b.enemies.filter((e) => e.alive);
    expect(kids.length).toBe(boss.kit!.splitCount);
    expect(kids.every((e) => e.noReward && e.name.startsWith('작은 슬라임'))).toBe(true);
    expect(b.lastEvents.filter((e) => e.kind === 'Spawn').length).toBe(kids.length);
    expect(b.enemies.length).toBeLessThanOrEqual(4);
    for (let i = 0; i < 80 && !b.isOver; i++) hit(b);
    expect(b.outcome).toBe('Victory');
  });

  it('재생 의식: 영창 뒤 회복', () => {
    const { b, boss } = fight('blood_leech', 22, 7);
    boss.hp = Math.floor(boss.maxHp * 0.25);
    boss.defense = 100000;
    hit(b);
    expect(boss.kit!.chanting).toBe(true);
    expect(boss.kit!.intent).toContain('회복');
    const hp = boss.hp;
    hit(b);
    expect(boss.hp).toBeGreaterThan(hp);
    expect(boss.kit!.ritualUses).toBe(0);
    expect(boss.kit!.chanting).toBe(false);
  });

  it('부활은 처음 쓰러질 때만', () => {
    const { b, boss } = fight('zombie', 15, 8);
    boss.hp = 1;
    for (let i = 0; i < 10 && boss.kit!.revives > 0; i++) hit(b);
    expect(boss.kit!.revives).toBe(0);
    expect(boss.alive).toBe(true);
    expect(b.defeated.includes(boss)).toBe(false);
    boss.hp = 1;
    for (let i = 0; i < 10 && !b.isOver; i++) hit(b);
    expect(b.outcome).toBe('Victory');
  });

  it('부하 소환: 졸개는 보스와 함께 흩어진다', () => {
    const { b, boss } = fight('reaper', 20, 9);
    boss.kit!.shield = 0;
    boss.kit!.ritualUses = 0;
    for (let i = 0; i < 12 && boss.kit!.minions.length === 0; i++) {
      boss.hp = boss.maxHp;
      hit(b);
    }
    expect(boss.kit!.minions.length).toBeGreaterThan(0);
    expect(boss.kit!.minions[0].noReward).toBe(true);
    expect(b.enemies.includes(boss.kit!.minions[0])).toBe(true);
    expect(b.enemies.length).toBeLessThanOrEqual(4);
    boss.hp = 1;
    for (let i = 0; i < 20 && !b.isOver; i++) {
      b.player.hp = b.player.maxHp;
      const ch = b.getChoices().find((x) => x.kind === 'Attack' && x.target === b.enemies.indexOf(boss));
      b.execute(ch ?? b.getChoices()[0]);
    }
    expect(b.outcome).toBe('Victory');
    expect(boss.kit!.minions.every((m) => !m.alive)).toBe(true);
  });
});

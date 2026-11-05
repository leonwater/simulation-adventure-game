import { describe, expect, it } from 'vitest';
import { B, enemyAttack, enemyHp, expToNext } from '../src/core/balance';
import { Battle, ENERGY_BALL, damage } from '../src/core/battle';
import type { BattleChoice } from '../src/core/battle';
import { addExp, autoAllocate, createCharacter, maxHp } from '../src/core/character';
import type { Character } from '../src/core/character';
import type { Combatant } from '../src/core/combatant';
import { createBoss, createEnemy, createMimic, nameDuplicates } from '../src/core/enemies';
import { equip, equipSkill, learnSkill, knowsSkill, meetsSkillRequirement } from '../src/core/equipment';
import type { Difficulty, ItemGrade, Job, SkillTier } from '../src/core/enums';
import { GEARS, JOBS, TIERS } from '../src/core/enums';
import { applyEffectsToBattle } from '../src/core/explore';
import { createGear, createSkillBook, maxGradeForFloor } from '../src/core/items';
import { collectRewards } from '../src/core/loot';
import { newGuildState } from '../src/core/guild';
import { monster, themeFor } from '../src/core/monsters';
import { Rng } from '../src/core/rng';
import { jobData } from '../src/core/jobs';
import { loadGame, MemorySaveStore, SAVE_VERSION } from '../src/core/save';
import { GameSession } from '../src/core/session';
import { ALL_SKILLS, skillDef, skillsForJob } from '../src/core/skills';
import { pickBattleChoice, prepareInTown, step } from '../src/sim/bot';

const goblin = () => monster('goblin')!;

// ── SkillV12Tests (기획서 v1.2 스킬·전투 규칙) ──

function setup12(job: Job, skill: string | null, enemies: number, seed = 1, ambush = false) {
  const c = createCharacter('테스트', job);
  c.Level = 40;
  c.Rank = 'SS';
  if (skill) {
    learnSkill(c, skill);
    equipSkill(c, skill);
  }
  const list: Combatant[] = [];
  for (let i = 0; i < enemies; i++) {
    const e = createEnemy(goblin(), 1, 'Normal', 0);
    e.maxHp = e.hp = 100000;
    e.attack = 1;
    e.requirement = -1000; // 항상 명중 (95%)
    list.push(e);
  }
  nameDuplicates(list);
  return { b: new Battle(c, 1, list, false, new Rng(seed), { ambush }), c };
}
const choice12 = (b: Battle, skill: string, target = 0): BattleChoice =>
  b.getChoices().find((x) => x.skillId === skill && (x.target === target || x.target < 0))!;

describe('스킬·전투 규칙 v1.2 (SkillV12Tests)', () => {
  it('기본 공격은 치명타가 없다', () => {
    const { b } = setup12('Warrior', null, 1);
    for (let i = 0; i < 30; i++) {
      b.execute(b.getChoices().find((x) => x.kind === 'Attack')!);
      for (const ev of b.lastEvents) expect(ev.damage).not.toBe('Crit');
    }
  });

  it('마법사 (v3.8): 에너지 볼은 재사용 1턴, 쓸 공격이 없으면 마력 폭주로 쏘고 약해진다', () => {
    const { b, c } = setup12('Mage', 'm_meteor', 1);
    c.Skills.Equipped = ['m_meteor']; // 긴 스킬 하나만 → 폭주를 피할 수 없는 조합
    const attack = () => b.getChoices().find((x) => x.kind === 'Attack')!;
    expect(attack().label.startsWith('에너지 볼')).toBe(true);
    b.execute(attack());
    expect(b.cooldown(ENERGY_BALL)).toBe(B.EnergyBallCooldown);
    expect(attack().enabled).toBe(false); // 운석이 남아 있으면 에너지 볼은 기다린다
    b.execute(choice12(b, 'm_meteor'));
    expect(attack().label.startsWith('에너지 볼')).toBe(true); // 한 턴 걸러 다시 쓸 수 있다
    b.execute(attack());
    // 에너지 볼·운석 모두 재사용 대기 → 마력 폭주
    expect(attack().enabled).toBe(true);
    expect(attack().label.startsWith('마력 폭주')).toBe(true);
    b.execute(attack());
    expect(b.player.statuses.has('Overload')).toBe(true);
    // 스킬 재사용 대기만 다음 전투로 넘긴다 (v3.15: 에너지 볼은 전투가 끝나면 풀림 — 마지막 적을 에너지 볼로 잡으면 다음 전투 첫 턴에 못 쓰던 문제)
    expect(b.cooldownState()[ENERGY_BALL]).toBeUndefined();
    expect(b.cooldownState()['m_meteor']).toBeGreaterThan(0);
  });

  it('마법사 (v3.9): 화염구·마력 화살(재사용 2턴)을 함께 끼면 에너지 볼과 번갈아 써서 마력 폭주를 끝까지 피할 수 있다', () => {
    const mage = skillsForJob('Mage').map((s) => s.Id).filter((id) => id !== 'm_fireball' && id !== 'm_bolt');
    for (const other of [null, ...mage]) {
      const { b, c } = setup12('Mage', 'm_fireball', 1);
      learnSkill(c, 'm_bolt');
      c.Skills.Equipped = ['m_fireball', 'm_bolt'];
      if (other) { learnSkill(c, other); equipSkill(c, other); }
      for (let t = 0; t < 30; t++) {
        const list = b.getChoices();
        const pick = list.find((x) => x.kind === 'Attack' && x.label.startsWith('에너지 볼') && x.enabled)
          ?? list.find((x) => x.kind === 'Skill' && x.enabled && (x.target === 0 || x.target < 0))!;
        expect(pick, `${other} ${t}턴`).toBeTruthy();
        b.execute(pick);
        expect(b.player.statuses.has('Overload')).toBe(false);
      }
    }
  });

  it('반격 태세 (v3.10): 다음 직접 공격 한 번을 반드시 막고 반격, 그 뒤로는 사라진다', () => {
    const { b } = setup12('Warrior', null, 1);
    b.enemies[0].attack = 50;
    b.player.counter = 0; // 고유 반격 확률은 빼고 반격 태세만
    b.player.statuses.apply('Riposte', 40, 2);
    const attack = () => b.getChoices().find((x) => x.kind === 'Attack')!;
    b.execute(attack());
    expect(b.lastEvents.some((e) => e.kind === 'Damage' && e.target === -1 && e.damage === 'Blocked')).toBe(true);
    expect(b.lastEvents.some((e) => e.kind === 'Damage' && e.actor === -1 && e.damage === 'Counter')).toBe(true);
    expect(b.player.statuses.has('Riposte')).toBe(false);
    b.execute(attack());
    expect(b.lastEvents.some((e) => e.damage === 'Blocked' || e.damage === 'Counter')).toBe(false);
  });

  it('여러 번 때리는 스킬은 타격마다 판정', () => {
    const { b } = setup12('Archer', 'a_flash', 1);
    b.execute(choice12(b, 'a_flash'));
    const hits = b.lastEvents.filter((ev) => ev.actor === -1 && (ev.kind === 'Damage' || ev.kind === 'Miss')).length;
    expect(hits).toBe(2); // 섬광 화살 2회 각각 판정
  });

  it('궁수 (v3.16): 속사는 기본 공격을 2회 맞히되 한 발당 90%', () => {
    const { b } = setup12('Archer', 'a_double', 1);
    const before = b.getChoices().find((x) => x.kind === 'Attack')!.damageNote;
    b.execute(choice12(b, 'a_double'));
    const atk = b.getChoices().find((x) => x.kind === 'Attack')!;
    const one = (n: string) => Number(/피해 약 (\d+)/.exec(n)![1]);
    expect(atk.damageNote).toContain('× 2회');
    expect(one(atk.damageNote) / one(before)).toBeCloseTo(0.9, 1);
    b.execute(atk);
    const hits = b.lastEvents.filter((ev) => ev.actor === -1 && (ev.kind === 'Damage' || ev.kind === 'Miss')).length;
    expect(hits).toBe(2);
  });

  it('기습: 첫 턴 확정 치명타', () => {
    const { b } = setup12('Rogue', 'r_ambush', 1);
    b.execute(choice12(b, 'r_ambush'));
    expect(b.lastEvents.some((e) => e.damage === 'Crit')).toBe(true);
  });

  it('암살: HP 낮은 대상 처형', () => {
    const { b } = setup12('Rogue', 'r_assassin', 2);
    b.enemies[0].hp = 100000;
    b.enemies[1].hp = 20000; // 20%
    const target = b.enemies[0];
    const normal = damage(b.player, target, 2.0, true);
    const execute = damage(b.player, target, 2.0 * 1.5, true);
    b.execute(choice12(b, 'r_assassin', 1));
    const hit = b.lastEvents.find((e) => e.kind === 'Damage' && e.actor === -1)!;
    expect(hit.amount).toBeGreaterThanOrEqual(execute - 2); // HP 30% 이하면 ×1.5
    expect(hit.amount).toBeLessThanOrEqual(execute + 2 + Math.trunc(execute / 10));
    expect(execute).toBeGreaterThan(normal);
  });

  it('연쇄 번개는 3명(감쇠), 얼음 창은 2명', () => {
    const { b, c } = setup12('Mage', 'm_chain', 4);
    learnSkill(c, 'm_ice');
    equipSkill(c, 'm_ice');
    b.execute(choice12(b, 'm_chain', 2));
    const dmg = b.lastEvents.filter((e) => e.kind === 'Damage' && e.actor === -1);
    const targets = new Set(dmg.map((d) => d.target));
    expect(targets.size + b.lastEvents.filter((e) => e.kind === 'Miss' && e.actor === -1).length).toBe(3);
    expect(b.lastEvents.find((e) => e.kind === 'Act' && e.actor === -1)!.target).toBe(2); // 고른 적부터

    const { b: b2 } = setup12('Mage', 'm_ice', 4);
    b2.execute(choice12(b2, 'm_ice', 3));
    const touched = b2.lastEvents.filter((e) => e.actor === -1 && (e.kind === 'Damage' || e.kind === 'Miss')).length;
    expect(touched).toBe(2); // 얼음 창은 적 2명
  });

  it('미믹: 기습하고 장비를 확정으로 준다', () => {
    const c = createCharacter('a', 'Warrior');
    const mimic = createMimic(5, 'Normal');
    const normal = createEnemy(goblin(), 5, 'Normal', 0);
    expect(mimic[0].name).toBe('미믹');
    expect(Math.abs(Math.round(enemyHp(5) * 1.5) - mimic[0].maxHp)).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.round(enemyAttack(5) * 1.3) - mimic[0].attack)).toBeLessThanOrEqual(1);
    expect(mimic[0].goldReward).toBe(normal.goldReward * 3);
    const b = new Battle(c, 5, mimic, false, new Rng(3), { ambush: true });
    expect(b.lastEvents.some((e) => e.actor === 0)).toBe(true); // 미믹이 먼저 행동
    expect(b.turn).toBe(1);
    mimic[0].hp = 1;
    let guard = 0;
    while (!b.isOver && guard++ < 50) b.execute(b.getChoices().find((x) => x.kind === 'Attack') ?? b.getChoices()[0]);
    expect(b.outcome).toBe('Victory');
    const loot = collectRewards(b, newGuildState(), null);
    expect(loot.Items.some((i) => i.Kind === 'Equipment') || loot.Dropped.some((i) => i.Kind === 'Equipment')).toBe(true);
  });

  it('자기 대상 스킬은 항상 성공하고 성공률 100% 표시', () => {
    const { b } = setup12('Warrior', 'w_guard', 1);
    const ch = choice12(b, 'w_guard');
    expect(ch.chance).toBe(1.0);
    b.execute(ch);
    expect(b.player.statuses.has('Fortify')).toBe(true);
  });

  // 기획서 '밸런스 확인' 표와 비교하기 위한 시뮬레이션: 적 2마리, 레벨 = 층 × 2 - 1, 자동 배분, 층 등급 장비.
  // 전투가 지나치게 길거나 짧지 않은지만 확인한다.
  it('밸런스 확인: 적 2마리 전투 턴 수', () => {
    for (const floor of [1, 10, 30]) {
      for (const job of JOBS) {
        let turns = 0, n = 0;
        for (let seed = 0; seed < 60; seed++) {
          const c = createCharacter('봇', job);
          addExp(c, 0);
          c.Level = floor * 2 - 1;
          c.UnspentPoints = (c.Level - 1) * 3;
          autoAllocate(c);
          c.Rank = 'SS';
          for (const s of skillsForJob(job)) if (meetsSkillRequirement(c, s) && s.Tier !== 'Top') learnSkill(c, s.Id);
          for (const st of c.Skills.Learned) equipSkill(c, st.SkillId);
          const rng = new Rng(seed);
          const lv = Math.max(1, floor * 2 - 1);
          const grade: ItemGrade = ['Rare', 'Epic', 'Legendary'].includes(maxGradeForFloor(floor)) ? 'Rare' : 'Uncommon';
          for (const g of GEARS) {
            const item = createGear(g, grade, lv, job, jobData(job).attackStat);
            c.Inventory.Items.push(item);
            equip(c, item.Uid);
          }
          c.CurrentHp = maxHp(c);
          const sp = monster(themeFor(floor).SpeciesIds[1])!;
          const enemies = [createEnemy(sp, floor, 'Normal', 0), createEnemy(sp, floor, 'Normal', 0)];
          const b = new Battle(c, floor, enemies, false, rng);
          let guard = 0;
          while (!b.isOver && guard++ < 60) {
            const choices = b.getChoices().filter((x) => x.enabled && x.kind !== 'Flee' && x.kind !== 'Item');
            const best = choices.find((x) => x.kind === 'Skill' && x.skillId != null && skillDef(x.skillId)!.IsAttack) ??
              choices.find((x) => x.kind === 'Skill') ?? choices[0];
            b.execute(best);
          }
          turns += b.turn;
          n++;
        }
        const avg = Math.trunc(turns / n);
        expect(avg, `${job} ${floor}층 전투 턴 수`).toBeGreaterThanOrEqual(2);
        expect(avg, `${job} ${floor}층 전투 턴 수`).toBeLessThanOrEqual(15);
      }
    }
  });
});

// ── V21Tests (상태 이상 지속 턴은 걸린 쪽의 실제 차례 수) ──

function newBattle21(job: Job, seed: number) {
  const c = createCharacter('에단', job);
  const list = [createEnemy(goblin(), 1, 'Normal', 0)];
  return { b: new Battle(c, 1, list, false, new Rng(seed)), c };
}
const attackChoice = (b: Battle) => b.getChoices().find((x) => x.kind === 'Attack')!;

describe('상태 이상 지속 턴 v2.1.1 (V21Tests)', () => {
  it('기절한 플레이어는 정확히 한 번 쉰다', () => {
    const { b } = newBattle21('Warrior', 1);
    b.enemies[0].attack = 0;
    b.enemies[0].maxHp = b.enemies[0].hp = 100000;
    b.player.statuses.apply('Stun', 1, 1); // 적 차례에 걸린 기절 1턴
    b.execute(b.getChoices()[0]); // 기절로 한 번 못 움직임
    expect(b.player.statuses.has('Stun')).toBe(false); // 기절 1턴은 한 번 쉬고 끝
    expect(b.getChoices()[0].kind).toBe('Attack'); // 다음 차례는 평소처럼 고를 수 있다
  });

  it('독 3턴 = 피해 3번', () => {
    const { b } = newBattle21('Warrior', 2);
    b.enemies[0].attack = 0;
    b.enemies[0].maxHp = b.enemies[0].hp = 100000;
    b.player.statuses.apply('Poison', 4, 3);
    let hits = 0;
    for (let i = 0; i < 5 && !b.isOver; i++) {
      const before = b.player.hp;
      b.execute(b.getChoices()[0]);
      if (before - b.player.hp >= 5) hits++; // 독 피해 (적의 최소 피해 1은 제외)
    }
    expect(hits).toBe(3);
    expect(b.player.statuses.has('Poison')).toBe(false);
  });

  it('자기 강화는 이어지는 2차례를 덮는다 (v2.6 기본 2턴)', () => {
    const c0 = createCharacter('에단', 'Warrior');
    learnSkill(c0, 'w_warcry');
    c0.Skills.Equipped.push('w_warcry');
    const b = new Battle(c0, 1, [createEnemy(goblin(), 1, 'Normal', 0)], false, new Rng(3));
    b.enemies[0].attack = 0;
    b.enemies[0].maxHp = b.enemies[0].hp = 100000;
    const cry = b.getChoices().find((x) => x.skillId === 'w_warcry');
    expect(cry).toBeDefined();
    b.execute(cry!);
    expect(b.player.statuses.active('Empower')!.Turns).toBe(2); // 자기 차례에 건 강화는 그 차례 끝에 줄지 않는다
    for (let i = 0; i < 2; i++) {
      expect(b.player.statuses.has('Empower'), `강화 ${i + 1}번째 차례`).toBe(true);
      b.execute(attackChoice(b));
    }
    expect(b.player.statuses.has('Empower')).toBe(false);
  });

  it('기절한 적은 정확히 한 번 쉰다', () => {
    const { b } = newBattle21('Warrior', 4);
    const e = b.enemies[0];
    e.maxHp = e.hp = 100000;
    e.attack = 50;
    e.statuses.apply('Stun', 1, 1); // 내 차례에 건 기절 1턴
    const hp = b.player.hp;
    b.execute(attackChoice(b));
    expect(b.player.hp).toBe(hp); // 기절한 적은 이번 차례에 공격하지 못한다
    expect(e.statuses.has('Stun')).toBe(false);
  });

  it('공포는 정확히 플레이어 차례 3번', () => {
    const { b } = newBattle21('Warrior', 5);
    b.enemies[0].attack = 0;
    b.enemies[0].maxHp = b.enemies[0].hp = 100000;
    applyEffectsToBattle([{ Type: 'Fear', Battles: 1 } as any], b);
    let fearTurns = 0;
    for (let i = 0; i < 6; i++) {
      if (b.player.statuses.has('Fear')) fearTurns++;
      b.execute(attackChoice(b));
    }
    expect(fearTurns).toBe(3);
  });
});

// ── V22Tests (스킬 40개 · 역할 태그 · 새 스킬 효과 · 저장 변환 4 → 5) ──

// (id, 등급, 재사용, 성공률 보정) — 기획서 스킬 표
const TABLE: [string, SkillTier, number, number][] = [
  ['w_bash', 'Low', 4, -0.10], ['w_warcry', 'Low', 6, 0], ['w_riposte', 'Low', 5, 0],
  ['w_shield', 'Mid', 5, -0.04], ['w_guard', 'Mid', 6, 0], ['w_will', 'Mid', 7, 0],
  ['w_whirl', 'High', 6, -0.08], ['w_roar', 'High', 7, -0.04],
  ['w_earth', 'Top', 8, -0.12], ['w_strike', 'Top', 8, -0.12],
  // v3.7 궁수: 기본 공격 강화(자신) + 광역, 재사용 보통
  ['a_aim', 'Low', 4, 0], ['a_double', 'Low', 5, 0], ['a_scatter', 'Low', 2, -0.08],
  ['a_wind', 'Mid', 5, 0], ['a_flash', 'Mid', 4, -0.04], ['a_weak', 'Mid', 4, -0.04],
  ['a_rain', 'High', 4, -0.08], ['a_pierce', 'High', 4, -0.04],
  ['a_storm', 'Top', 7, 0], ['a_volley', 'Top', 6, -0.12],
  ['r_ambush', 'Low', 2, -0.04], ['r_venom', 'Low', 3, -0.03], ['r_keen', 'Low', 5, 0], ['r_shuriken', 'Low', 3, -0.08],
  ['r_vital', 'Mid', 4, -0.08], ['r_shadow', 'Mid', 4, -0.08],
  ['r_storm', 'High', 5, -0.08], ['r_cruel', 'High', 6, 0],
  ['r_assassin', 'Top', 6, -0.12], ['r_dance', 'Top', 7, -0.12],
  ['m_fireball', 'Low', 2, -0.04], ['m_bolt', 'Low', 2, -0.03], ['m_shard', 'Low', 3, -0.08],
  ['m_ice', 'Mid', 4, -0.04], ['m_chain', 'Mid', 4, -0.04], ['m_silence', 'Mid', 5, -0.04],
  ['m_meteor', 'High', 6, -0.10], ['m_prison', 'High', 6, -0.06],
  ['m_overload', 'Top', 8, -0.12], ['m_apocalypse', 'Top', 10, -0.12],
];

function setup22(job: Job, skill: string, enemies: number, seed: number) {
  const c = createCharacter('테스트', job);
  c.Level = 40;
  c.Rank = 'SS';
  learnSkill(c, skill);
  equipSkill(c, skill);
  const list: Combatant[] = [];
  for (let i = 0; i < enemies; i++) {
    const e = createEnemy(goblin(), 1, 'Normal', 0);
    e.maxHp = e.hp = 100000;
    e.attack = 0;
    list.push(e);
  }
  nameDuplicates(list);
  return { b: new Battle(c, 1, list, false, new Rng(seed)), c };
}

describe('스킬 40개 v2.2 (V22Tests)', () => {
  it('40개 스킬이 기획서 표와 같다', () => {
    expect(TABLE.length).toBe(40);
    expect(ALL_SKILLS.length).toBe(40);
    for (const [id, tier, cd, success] of TABLE) {
      const def = skillDef(id);
      expect(def, id).not.toBeNull();
      expect(def!.Tier, `${id} 등급`).toBe(tier);
      expect(def!.Cooldown, `${id} 재사용`).toBe(cd);
      expect(def!.Target === 'Self' ? 0 : def!.SuccessBonus, `${id} 성공률`).toBeCloseTo(success, 9);
    }
  });

  it('모든 스킬에 역할 태그가 있고 마법사는 보조 스킬이 없다', () => {
    const roles = new Set(['단일', '광역', '상태', '보조', '방어', '회복', '광역 상태', '단일 상태']);
    for (const s of ALL_SKILLS) expect(roles.has(s.Role), `${s.Id} 역할 '${s.Role}'`).toBe(true);
    for (const s of skillsForJob('Mage', TIERS)) {
      expect(['보조', '방어', '회복'].includes(s.Role), `${s.Id}: 마법사는 방어·회복·보조 스킬이 없다`).toBe(false);
    }
    expect(skillDef('w_roar')!.Role).toBe('광역 상태');
    expect(skillDef('w_will')!.Role).toBe('회복');
  });

  it('위협의 포효: 피해 없이 모든 적을 약화', () => {
    let weakened = 0;
    for (let seed = 0; seed < 30; seed++) {
      const { b } = setup22('Warrior', 'w_roar', 3, seed);
      b.player.counter = 0; // 적 차례의 반격 피해는 빼고 본다
      const ch = b.getChoices().find((x) => x.skillId === 'w_roar');
      expect(ch).toBeDefined();
      b.execute(ch!);
      for (const e of b.enemies) {
        expect(e.hp, '위협의 포효는 피해를 주지 않는다').toBe(100000);
        if (e.statuses.has('Weaken')) weakened++;
      }
    }
    expect(weakened).toBeGreaterThan(30 * 3 * 0.5); // 대부분의 적에게 약화가 걸린다
  });

  it('전쟁의 일격: 명중하면 나에게 강화 3턴', () => {
    let buffed = false;
    for (let seed = 0; seed < 20 && !buffed; seed++) {
      const { b } = setup22('Warrior', 'w_strike', 1, seed);
      b.execute(b.getChoices().find((x) => x.skillId === 'w_strike')!);
      if (b.enemies[0].hp < 100000) {
        expect(b.player.statuses.has('Empower'), '명중하면 강화 3턴').toBe(true);
        expect(b.enemies[0].statuses.has('Empower'), '강화는 적이 아니라 나에게').toBe(false);
        expect(b.player.statuses.active('Empower')!.Turns).toBe(3);
        buffed = true;
      }
    }
    expect(buffed).toBe(true);
  });

  it('침묵한 적은 스킬을 쓰지 않는다', () => {
    const c = createCharacter('테스트', 'Warrior');
    const e = createEnemy(goblin(), 1, 'Normal', 0);
    e.maxHp = e.hp = 100000;
    e.skills = [{ Name: '독 단검', DamageMult: 1.0, UseChance: 1.0, Status: null }];
    const b = new Battle(c, 1, [e], false, new Rng(3));
    b.execute(attackChoice(b));
    expect(b.log.some((l) => l.text.includes('독 단검')), '침묵 전에는 스킬을 쓴다').toBe(true);
    const before = b.log.length;
    e.statuses.apply('Silence', 1, 2);
    b.execute(attackChoice(b));
    for (let i = before; i < b.log.length; i++) expect(b.log[i].text, '침묵한 적은 스킬 대신 기본 공격').not.toContain('독 단검');
  });

  it('저장 변환 4 → 5: 스킬은 유지하고 사라진 스킬은 환급', () => {
    const store = new MemorySaveStore();
    const s = new GameSession(store, () => new Date(), 1);
    s.newGame('a', 'Mage', 'Normal');
    const c = s.c;
    learnSkill(c, 'm_chain');
    c.Skills.Equipped.push('m_chain');
    c.Skills.Learned.push({ SkillId: 'm_barrier', Level: 2 }); // 예전 스킬 (사라짐)
    c.Skills.Equipped.push('m_barrier');
    const oldBook = createSkillBook('m_chain');
    oldBook.SkillId = 'm_barrier';
    c.Inventory.Items.push(oldBook);
    const gold = c.Gold;
    s.data!.Version = 4;
    s.save();
    store.write(store.read()!.replace(`"Version":${SAVE_VERSION}`, '"Version":4'));
    const loaded = loadGame(store)!;
    expect(loaded.Version).toBe(SAVE_VERSION);
    const lc = loaded.Character;
    expect(knowsSkill(lc, 'm_chain'), '기존 스킬은 그대로').toBe(true);
    expect(lc.Skills.Equipped).toContain('m_chain');
    expect(knowsSkill(lc, 'm_barrier')).toBe(false);
    expect(lc.Skills.Equipped).not.toContain('m_barrier');
    expect(lc.Inventory.Items.some((i) => i.Kind === 'SkillBook' && i.SkillId === 'm_barrier'), '사라진 스킬서도 정리').toBe(false);
    expect(lc.Gold, '스킬 1개 + 스킬서 1개 = 600G × 2 환급').toBe(gold + 2 * B.SkillBookPrice[0]);
    // 두 번 불러와도 다시 환급되지 않는다
    store.write(JSON.stringify(loaded));
    expect(loadGame(store)!.Character.Gold).toBe(lc.Gold);
  });

  it('새 스킬로도 봇이 초반 층을 넘는다', () => {
    JOBS.forEach((job, ji) => {
      const s = new GameSession(new MemorySaveStore(), () => new Date(Date.UTC(2026, 9, 1, 9, 0, 0)), 100 + ji);
      s.newGame('봇', job, 'Normal');
      s.setTutorial('Done');
      for (let run = 0; run < 40 && s.hasGame; run++) {
        prepareInTown(s);
        s.enterDungeon();
        let steps = 0;
        while (s.hasGame && s.inDungeon && steps++ < 600) step(s);
        if (s.inDungeon) s.returnToTown();
      }
      expect(s.c.HighestFloorCleared, `${job} 봇이 3층은 넘는다`).toBeGreaterThanOrEqual(3);
    });
  });
});

// ── BossTests / ItemSkillTests 중 빠진 것 ──

function hero(floor: number): Character {
  const c = createCharacter('a', 'Warrior');
  while (c.Level < floor * 2) addExp(c, expToNext(c.Level));
  autoAllocate(c);
  c.CurrentHp = maxHp(c);
  return c;
}

describe('보스·스킬 설명 (BossTests · ItemSkillTests)', () => {
  it('보스는 층 레벨 영웅이 이길 수 있다', () => {
    let wins = 0, total = 0;
    for (let floor = 2; floor <= 30; floor += 4) {
      for (let i = 0; i < 6; i++) {
        const rng = new Rng(floor * 13 + i);
        const b = new Battle(hero(floor), floor, createBoss(floor, 'Normal' as Difficulty, i), true, rng);
        let guard = 0;
        while (!b.isOver && guard++ < 300) b.execute(pickBattleChoice(b));
        expect(b.isOver, '보스전이 끝나지 않음').toBe(true);
        total++;
        if (b.outcome === 'Victory') wins++;
      }
    }
    console.log(`보스 승률 ${wins}/${total}`);
    expect(wins).toBeGreaterThan(0);
  });

  it('스킬 설명이 자연스럽게 읽힌다', () => {
    expect(skillDef('w_bash')!.Description).toBe('단일 250% · 재사용 4턴');
    expect(skillDef('w_shield')!.Description).toBe('단일 150% + 60% 확률로 기절 1턴 · 재사용 5턴');
    expect(skillDef('w_warcry')!.Description).toBe('2턴 동안 공격력 +20% · 재사용 6턴');
    expect(skillDef('w_whirl')!.Description).toBe('전체 광역 180% · 재사용 6턴');
    expect(skillDef('w_bash')!.SuccessText).toBe('성공률 -10%');
    expect(skillDef('w_shield')!.SuccessText).toBe('성공률 -4%');
    expect(skillDef('a_scatter')!.SuccessText).toBe('성공률 -8%');
    expect(skillDef('w_guard')!.SuccessText).toBe('성공률 100%');
  });
});

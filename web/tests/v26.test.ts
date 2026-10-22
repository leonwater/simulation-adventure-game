import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import { Battle } from '../src/core/battle';
import { createCharacter } from '../src/core/character';
import { arrange, createEnemy, createGroup } from '../src/core/enemies';
import { learnSkill } from '../src/core/equipment';
import { monster } from '../src/core/monsters';
import { Rng } from '../src/core/rng';
import { areaName, skillDef } from '../src/core/skills';

const make = (id: string) => createEnemy(monster(id)!, 5, 'Normal', 0);

describe('v2.6 진형 (왼쪽 열 전방 · 오른쪽 열 후방)', () => {
  it('후방을 좋아하는 종족은 후방 칸(1·3)에, 줄 보정은 HP·공격에 곱한다', () => {
    const raw = [make('goblin_archer'), make('goblin'), make('bat'), make('kobold')];
    const base = raw.map((e) => ({ name: e.species!.Id, hp: e.maxHp, atk: e.attack }));
    const out = arrange(raw, true);
    expect(out[1].species!.Line).toBe('Back');
    expect(out[3].species!.Line).toBe('Back');
    for (let i = 0; i < 4; i++) {
      const b0 = base.find((x) => x.name === out[i].species!.Id)!;
      const back = i % 2 === 1;
      expect(out[i].maxHp).toBe(Math.round(b0.hp * (back ? B.BackHp : B.FrontHp)));
      expect(out[i].attack).toBe(Math.round(b0.atk * (back ? B.BackAttack : B.FrontAttack)));
    }
    expect(B.FrontHp).toBeGreaterThan(1);
    expect(B.FrontAttack).toBeLessThan(1);
    expect(B.BackHp).toBeLessThan(1);
    expect(B.BackAttack).toBeGreaterThan(1);
  });

  it('혼자 나온 적과 보스는 줄 보정이 없다', () => {
    const one = make('goblin');
    const hp = one.maxHp;
    expect(arrange([one], true)[0].maxHp).toBe(hp);
    const boss = createEnemy(monster('goblin')!, 5, 'Normal', 2);
    const bhp = boss.maxHp;
    arrange([boss, make('goblin')], true);
    expect(boss.maxHp).toBe(bhp);
  });

  it('실제 무리도 진형을 따른다', () => {
    for (let s = 0; s < 200; s++) {
      const g = createGroup(3, 'Normal', s);
      g.forEach((e, i) => {
        if (e.species?.Line === 'Back' && i % 2 === 0) expect(g.filter((_x, j) => j % 2 === 1).every((x) => x.species?.Line === 'Back')).toBe(true);
      });
    }
  });
});

describe('v2.6 광역 종류', () => {
  const battle = (skill: string, job: 'Rogue' | 'Archer' | 'Mage', seed = 1) => {
    const c = createCharacter('a', job);
    c.Level = 40;
    learnSkill(c, skill);
    c.Skills.Equipped.push(skill);
    const enemies = arrange([make('goblin'), make('goblin'), make('goblin'), make('goblin')], false);
    for (const e of enemies) e.maxHp = e.hp = 1_000_000;
    return new Battle(c, 5, enemies, false, new Rng(seed));
  };
  const hitCount = (b: Battle) => b.enemies.filter((e) => e.hp < e.maxHp).length;
  const use = (b: Battle, skill: string, target: number) => {
    const ch = b.getChoices().find((x) => x.skillId === skill && (x.target === target || x.target < 0))!;
    for (let tries = 0; tries < 50 && hitCount(b) === 0; tries++) b.execute(ch); // 빗나가면 다시
  };

  it('좌우 = 같은 열 위·아래, 앞뒤 = 같은 가로줄 앞·뒤', () => {
    expect(areaName(skillDef('m_shard')!)).toBe('좌우 광역');
    expect(areaName(skillDef('m_ice')!)).toBe('앞뒤 광역');
    const hits = (skill: string): Set<number> => {
      const seen = new Set<number>();
      for (let t = 0; t < 40; t++) {
        const bt = battle(skill, 'Mage', t + 1);
        const ch = bt.getChoices().find((x) => x.skillId === skill && x.target === 0)!;
        expect(ch.damageNote.startsWith(`${areaName(skillDef(skill)!)} · 피해 약`)).toBe(true);
        bt.execute(ch);
        bt.enemies.forEach((e, i) => e.hp < e.maxHp && seen.add(i));
      }
      return seen;
    };
    expect([...hits('m_shard')].sort()).toEqual([0, 2]); // 대상 0(전방 위)의 좌우 = 2(전방 아래)
    expect([...hits('m_ice')].sort()).toEqual([0, 1]); // 앞뒤 = 1(후방 위)
  });

  it('인원수 광역 = 대상 + 무작위, 전체 = 모두', () => {
    expect(areaName(skillDef('a_scatter')!)).toBe('인원수 광역 3명');
    expect(areaName(skillDef('m_chain')!)).toBe('인원수 광역 3명');
    expect(areaName(skillDef('a_rain')!)).toBe('전체 광역');
    expect(areaName(skillDef('w_bash')!)).toBeNull();
    const b = battle('a_scatter', 'Archer');
    use(b, 'a_scatter', 1);
    expect(b.enemies[1].hp).toBeLessThan(b.enemies[1].maxHp);
    expect(hitCount(b)).toBeLessThanOrEqual(3);
  });
});

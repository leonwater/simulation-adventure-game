import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import { Battle } from '../src/core/battle';
import { createEnemy } from '../src/core/enemies';
import { JOBS } from '../src/core/enums';
import type { ItemGrade } from '../src/core/enums';
import { ALL_SPECIES, monster, themeFor } from '../src/core/monsters';
import { Rng } from '../src/core/rng';
import { skillDef } from '../src/core/skills';
import { buildHero } from '../src/sim/gear';

const grade = (f: number): ItemGrade => (f >= 20 ? 'Epic' : f >= 12 ? 'Rare' : 'Uncommon');

describe('v3.0', () => {
  it('기본 공격은 적정 스펙에서 보스 외 몬스터에게 90% 이상 (최대 92%)', () => {
    for (const job of JOBS) {
      for (const f of [1, 2, 3, 5, 8, 10, 12, 15, 20, 25, 30]) {
        const c = buildHero({ job, floor: f, grade: grade(f), weapon: Math.floor(f / 3), armor: Math.floor(f / 5), levelBy: 1.7, trainLevel: 0 });
        for (const id of themeFor(f).SpeciesIds) {
          for (const role of [0, 1]) {
            const e = createEnemy(monster(id)!, f, 'Normal', role);
            const hit = new Battle(c, f, [e], false, new Rng(1)).hitChance(e, B.BasicAttackBonus);
            expect(hit, `${job} ${f}층 ${id} 기본 공격 명중`).toBeGreaterThanOrEqual(0.895);
            expect(hit).toBeLessThanOrEqual(B.MaxHit + 1e-9);
          }
        }
      }
    }
  });

  it('몬스터 종류마다 특색: 방패형은 HP↑ 공격↓, 후방 딜러는 HP↓ 공격↑ (자리와 무관)', () => {
    for (const sp of ALL_SPECIES) {
      if (!sp.Trait) continue;
      if (sp.Line === 'Back') expect(sp.Trait.Atk, sp.Id).toBeGreaterThan(1);
      expect(sp.Trait.Hp * sp.Trait.Atk, `${sp.Id} 균형`).toBeGreaterThan(0.75);
      expect(sp.Trait.Hp * sp.Trait.Atk, `${sp.Id} 균형`).toBeLessThan(1.25);
    }
    expect(B.FrontHp).toBeUndefined();
  });

  it('도적 스킬 설명은 치명타 확률과 치명타 피해량을 구분해서 쓴다', () => {
    expect(skillDef('r_ambush')!.Effect).toContain('치명타 확률 50%');
    expect(skillDef('r_cruel')!.Effect).toContain('치명타 피해량 +50%');
    for (const id of ['r_venom', 'r_shuriken', 'r_storm', 'r_dance']) expect(skillDef(id)!.Effect).toMatch(/치명타 확률 \d+%/);
  });
});

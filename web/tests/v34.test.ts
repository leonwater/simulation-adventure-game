import { describe, expect, it } from 'vitest';
import { B } from '../src/core/balance';
import { damage } from '../src/core/battle';
import { createCharacter, jobPerk } from '../src/core/character';
import { Combatant } from '../src/core/combatant';
import { addItem, createMaterial } from '../src/core/items';
import { ALL_SPECIES, monster, themeFor } from '../src/core/monsters';
import { newSaveData, repair } from '../src/core/save';

describe('v3.4 몬스터 교체', () => {
  it('예전 저장의 의뢰 종류 Id·제목과 재료 이름을 새 몬스터로 바꾼다', () => {
    const d = newSaveData('Normal', createCharacter('테스트', 'Warrior'), 'Done');
    const q = { Id: 'q1', Kind: 'Hunt', Title: '드래곤 토벌', Rank: 'F', TargetFloor: 25, SpeciesId: 'dragon', MaterialId: '', Required: 3, Progress: 1, RewardGold: 10, RewardExp: 10 };
    const c = { ...q, Id: 'q2', Kind: 'Collect', Title: '코볼트 이빨 채집', SpeciesId: 'kobold', MaterialId: 'mat_kobold' };
    d.Guild.Active.push(q as never, c as never);
    const mat = createMaterial('mat_kobold', 2);
    mat.Name = '코볼트 이빨';
    addItem(d.Character.Inventory, mat);
    repair(d);
    expect(d.Guild.Active[0].SpeciesId).toBe('ancient_golem');
    expect(d.Guild.Active[0].Title).toBe('고대 골렘 토벌');
    expect(d.Guild.Active[1].SpeciesId).toBe('rat');
    expect(d.Guild.Active[1].Title).toBe('쥐 꼬리 채집');
    expect(d.Character.Inventory.Items.find((i) => i?.TemplateId === 'mat_kobold')!.Name).toBe('쥐 꼬리');
  });

  it('층 테마의 몬스터·보스가 모두 표에 있다', () => {
    for (const f of [1, 15, 25]) for (const id of themeFor(f).SpeciesIds) expect(monster(id), id).toBeTruthy();
    expect(themeFor(30).Name).toBe('고대 유적');
    expect(monster(themeFor(30).UniqueBossId!)!.Name).toBe('고대 골렘');
    expect(monster(themeFor(20).UniqueBossId!)!.Name).toBe('저승사자');
  });
});

describe('v3.5 몬스터 상성 없음', () => {
  it('특정 무기·직업에만 강하거나 약한 몬스터가 없다: 직업별 보정 필드가 없고, 방어 배율은 0.7~1.4 안', () => {
    const allowed = ['AttackMul', 'DefenseMul', 'HpMul', 'Id', 'Line', 'MaterialId', 'MaterialName', 'Name', 'RegenPercent', 'RequirementMul', 'Skills', 'Tier', 'Trait', 'UniqueBoss'];
    for (const sp of ALL_SPECIES) {
      for (const k of Object.keys(sp)) expect(allowed, `${sp.Id}.${k}`).toContain(k);
      if (!sp.UniqueBoss && sp.Tier >= 0) {
        expect(sp.DefenseMul, sp.Id).toBeGreaterThanOrEqual(0.7);
        expect(sp.DefenseMul, sp.Id).toBeLessThanOrEqual(1.4);
      }
    }
  });
});

describe('v3.5 직업 고유 능력치·저장 변환', () => {
  it('예전 특수 능력치 칸: 찍은 포인트를 돌려주고 칸을 없앤다, 바뀐 스킬은 새 Id로', () => {
    const d = newSaveData('Normal', createCharacter('테스트', 'Warrior'), 'Done');
    d.Character.BaseStats.Values = [16, 5, 5, 12, 5, 5, 30, 5, 5, 5]; // 강인함 Lv.1 값 10 → 30 (20점 찍음)
    d.Character.UnspentPoints = 1;
    d.Character.Skills.Learned.push({ SkillId: 'w_ram', Level: 2 } as never);
    d.Character.Skills.Equipped.push('w_ram');
    repair(d);
    expect(d.Character.BaseStats.Values.length).toBe(6);
    expect(d.Character.UnspentPoints).toBe(21);
    expect(d.Character.Skills.Learned.some((s) => s.SkillId === 'w_riposte' && s.Level === 2)).toBe(true);
    expect(d.Character.Skills.Equipped).toContain('w_riposte');
  });

  it('도적 관통: 치명타는 방어력을 관통 비율만큼 무시한다 (치명타가 아니면 그대로)', () => {
    const a = new Combatant(); a.attack = 100; a.critDamage = 1; a.critPierce = 1;
    const t = new Combatant(); t.defense = 400;
    const noDef = new Combatant();
    expect(damage(a, t, 1, true)).toBe(damage(a, noDef, 1, true));
    expect(damage(a, t, 1, false)).toBeLessThan(damage(a, noDef, 1, false));
  });

  it('고유 능력치는 모험가 등급으로만 오른다', () => {
    const c = createCharacter('a', 'Archer');
    const f = jobPerk(c);
    c.Rank = 'SS';
    expect(jobPerk(c)).toBeGreaterThan(f);
    c.Level = 50;
    expect(jobPerk(c)).toBe(B.JobPerk.Archer[7]);
  });
});

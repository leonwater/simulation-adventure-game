import { describe, expect, it } from 'vitest';
import { createCharacter } from '../src/core/character';
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

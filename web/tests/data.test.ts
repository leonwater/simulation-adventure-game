import { describe, expect, it } from 'vitest';
import skills from '../src/data/skills.json';
import monsters from '../src/data/monsters.json';
import events from '../src/data/events.json';
import consumables from '../src/data/consumables.json';

// 데이터 표(v2.6부터 웹 JSON이 원본)가 빠짐없이 들어 있는지 확인한다. 직업 수치는 src/core/jobs.ts.
describe('데이터 표', () => {
  it('스킬 40개', () => {
    expect(skills.length).toBe(40);
    expect(new Set(skills.map((s: any) => s.Id)).size).toBe(40);
  });
  it('몬스터·이벤트·소모품이 들어 있다', () => {
    expect(monsters.Species.length).toBeGreaterThan(10);
    expect(monsters.Themes.length).toBe(3);
    expect(events.length).toBe(34);
    expect(consumables.length).toBeGreaterThanOrEqual(5);
  });
});

import { describe, expect, it } from 'vitest';
import skills from '../src/data/skills.json';
import monsters from '../src/data/monsters.json';
import events from '../src/data/events.json';
import jobs from '../src/data/jobs.json';
import consumables from '../src/data/consumables.json';

// 데이터 표는 tools/export/run.sh가 C#에서 뽑는다. 개수가 맞는지 확인한다.
describe('C#에서 내보낸 데이터', () => {
  it('스킬 40개 · 직업 4개', () => {
    expect(skills.length).toBe(40);
    expect(jobs.length).toBe(4);
    expect(new Set(skills.map((s: any) => s.Id)).size).toBe(40);
  });
  it('몬스터·이벤트·소모품이 들어 있다', () => {
    expect(monsters.Species.length).toBeGreaterThan(10);
    expect(monsters.Themes.length).toBe(3);
    expect(events.length).toBe(34);
    expect(consumables.length).toBeGreaterThanOrEqual(5);
  });
});

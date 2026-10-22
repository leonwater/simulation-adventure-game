import { B } from '../core/balance';
import type { AllocationDraft } from '../core/character';
import { effectLabel, equipmentBonus, ownStat } from '../core/character';
import type { Stat } from '../core/enums';
import { getStat } from '../core/jobs';
import { Names } from '../core/names';
import { S } from './game';
import { colored } from './items';
import { button, h, icon } from './kit';

export const statIcon = (s: Stat): string => `stat_${s.toLowerCase()}`;

/** 능력치 배분 한 줄 (캐릭터 화면·던전 레벨 업 창 공통): 아이콘 · 이름/효과 · - 값 + . */
export function statRow(draft: AllocationDraft, stat: Stat, line: boolean, onChange: () => void): HTMLElement {
  const c = S.c;
  const pending = draft.pendingOf(stat);
  const own = getStat(c.BaseStats, stat) + pending;
  const extra = equipmentBonus(c, stat);
  const step = (label: string, enabled: boolean, fn: () => void): HTMLElement => {
    const b = button(label, () => {
      fn();
      onChange();
    }, 'ghost', 'sm');
    b.style.width = '40px';
    b.style.padding = '0';
    b.disabled = !enabled;
    return b;
  };
  return h('div', { class: 'row statrow', style: { height: '60px', borderBottom: line ? '1px solid var(--line-soft)' : '' } },
    icon(statIcon(stat), 24),
    h('div', { class: 'col grow', style: { gap: '1px' } },
      h('b', null, Names.stat(stat), own >= B.StatCap ? colored(' 최대', 'var(--gold)') : null),
      h('div', { class: 'sub', style: { fontSize: '11px' } }, effectLabel(c, stat))),
    step('-', pending > 0, () => draft.remove(stat)),
    h('div', { style: { minWidth: '64px', textAlign: 'center', fontWeight: '700' } }, String(ownStat(c, stat)),
      extra > 0 ? colored(`(+${extra})`, 'var(--green)') : null, pending > 0 ? colored(` +${pending}`, 'var(--gold)') : null),
    step('+', draft.canAdd(stat), () => draft.add(stat)));
}

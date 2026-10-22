import type { SkillDef } from '../core/skills';
import { h } from './kit';

/**
 * 광역 범위 그림: 적 자리 2×2 (왼쪽 열 전방 · 오른쪽 열 후방). 금색 = 고른 대상, 주황 = 함께 맞는 칸, '?' = 무작위로 맞을 수 있는 칸.
 * 자신에게 거는 스킬은 그림 대신 '자신'.
 */
export function areaDiagram(def: SkillDef): HTMLElement {
  if (def.Target === 'Self') return h('span', { class: 'sub' }, '자신에게 사용');
  // 대상은 0번 칸(전방 위)으로 놓고 그린다
  const hit = (i: number): 'target' | 'hit' | 'maybe' | '' => {
    if (i === 0) return 'target';
    switch (def.Target) {
      case 'AllEnemies': return 'hit';
      case 'Column': return i === 2 ? 'hit' : '';
      case 'Row': return i === 1 ? 'hit' : '';
      case 'RandomEnemies': case 'ChainEnemies': return 'maybe';
      default: return '';
    }
  };
  const cell = (i: number): HTMLElement => {
    const k = hit(i);
    const bg = k === 'target' ? 'var(--gold)' : k === 'hit' ? '#D9823B' : k === 'maybe' ? '#5A4A2A' : 'var(--btn)';
    return h('div', { style: { width: '26px', height: '26px', borderRadius: '6px', background: bg, border: '1px solid var(--btn-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#1B1813' } }, k === 'maybe' ? '?' : '');
  };
  const n = def.Target === 'RandomEnemies' ? def.TargetCount : def.Target === 'ChainEnemies' ? def.ChainMults.length : 0;
  return h('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } },
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 26px)', gap: '4px' } }, cell(0), cell(1), cell(2), cell(3)),
    h('div', { class: 'sub', style: { fontSize: '12px', lineHeight: '1.4' } }, '왼쪽 열 전방 · 오른쪽 열 후방', h('br'),
      n > 0 ? `대상 + 무작위 ${n - 1}명` : def.Target === 'AllEnemies' ? '모든 적' : def.Target === 'Column' ? '대상과 같은 열' : def.Target === 'Row' ? '대상과 같은 가로줄' : '대상 하나'));
}

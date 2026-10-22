import { powerMultiplier } from '../core/equipment';
import { Names } from '../core/names';
import type { SkillDef } from '../core/skills';
import { skillTurns } from '../core/skills';
import { h } from './kit';
import { tierColor } from './theme';

/** 스킬 이름 (등급 색) + 수련 단계 '(+0)'. */
export function skillNameEl(def: SkillDef, level: number, size = 14): HTMLElement {
  return h('span', { style: { fontSize: `${size}px`, fontWeight: '700', whiteSpace: 'nowrap' } },
    h('span', { style: { color: tierColor(def.Tier) } }, def.Name), h('span', { style: { color: 'var(--gold)', fontWeight: '400' } }, ` (+${level})`));
}

/** 한 줄 요약: '단일 · 피해 130%' · 여러 번이면 '피해 60%×3' · 피해 없는 스킬은 '자신 · 예리함 2턴'. 수련 단계의 위력 상승을 반영한다. */
export function skillBrief(def: SkillDef, level: number): string {
  if (def.IsAttack) {
    const power = powerMultiplier(def, level);
    const mults = def.ChainMults.length > 0 ? def.ChainMults : [def.DamageMult];
    const pct = (x: number): number => Math.round(x * power * 100);
    const dmg = def.ChainMults.length > 0 ? mults.map(pct).join('→') : `${pct(def.DamageMult)}${def.Hits > 1 ? `×${def.Hits}` : ''}`;
    return `${def.Role} · 피해 ${dmg}%`;
  }
  const s = def.Statuses[0];
  if (def.HealRatio > 0) return `${def.Role} · 회복 ${Math.round(def.HealRatio * 100)}%`;
  return s ? `${def.Role} · ${Names.status(s.Type)} ${skillTurns(def, s.Turns, level)}턴` : def.Role;
}

/**
 * 광역 범위 그림: 적 자리 2×2 (왼쪽 열 전방 · 오른쪽 열 후방). 금색 = 고른 대상, 주황 = 함께 맞는 칸, '?' = 무작위로 맞을 수 있는 칸.
 * 자신에게 거는 스킬은 그림 대신 '자신'.
 */
export function areaDiagram(def: SkillDef, caption = true): HTMLElement {
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
    caption ? h('div', { class: 'sub', style: { fontSize: '12px', lineHeight: '1.4' } }, '왼쪽 열 전방 · 오른쪽 열 후방', h('br'),
      n > 0 ? `대상 + 무작위 ${n - 1}명` : def.Target === 'AllEnemies' ? '모든 적' : def.Target === 'Column' ? '대상과 같은 열' : def.Target === 'Row' ? '대상과 같은 가로줄' : '대상 하나') : null);
}

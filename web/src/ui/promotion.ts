import { badgeBonus, skillSlots, storageCapacity } from '../core/character';
import type { Rank } from '../core/enums';
import { RANKS } from '../core/enums';
import { PERKS } from '../core/jobs';
import { S } from './game';
import { perkValue } from './jobinfo';
import { button, h, icon, row } from './kit';
import { modal } from './overlay';
import { rankIcon } from './theme';

/** 모험가 등급이 오르면 (던전 안이든 마을이든) 다음 화면을 그릴 때 한 번 알린다. 여러 등급이 한꺼번에 오르면 마지막 등급만. */
export function showPromotions(): void {
  if (!S.hasGame || S.promotions.length === 0) return;
  const to = S.promotions[S.promotions.length - 1];
  const from: Rank = RANKS[Math.max(0, RANKS.indexOf(S.promotions[0]) - 1)];
  S.promotions.length = 0;
  const job = S.c.Job;
  const line = (k: string, a: string, b: string): HTMLElement[] =>
    [h('span', { class: 'jf-label' }, k), h('b', { class: 'jf-value' }, a === b ? b : `${a} → ${b}`)];
  const m = modal(`${to} 등급 승급!`);
  m.body.append(
    h('div', { class: 'promo-hero' }, icon(rankIcon(to), 56), h('b', null, `${to} 등급 모험가가 되었습니다`)),
    h('div', { class: 'job-facts' },
      ...line('기본 능력치', `+${Math.round(badgeBonus(from) * 100)}%`, `+${Math.round(badgeBonus(to) * 100)}%`),
      ...line(PERKS[job].name, perkValue(job, RANKS.indexOf(from)), perkValue(job, RANKS.indexOf(to))),
      ...line('스킬 장착 칸', String(skillSlots(from)), String(skillSlots(to))),
      ...line('창고 칸', String(storageCapacity(from)), String(storageCapacity(to)))),
    row(button('확인', m.close, 'primary', 'grow')));
}

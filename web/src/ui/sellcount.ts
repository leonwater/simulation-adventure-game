import type { ItemInstance } from '../core/items';
import { displayName, sellPrice, statLine } from '../core/items';
import { gearText, gradeTag } from './items';
import { button, h, row } from './kit';
import { modal } from './overlay';

/**
 * 판매 팝업: 개수를 고르고(여러 개일 때) 합계를 보며 판다. 상점·떠돌이 상인 공통.
 * extra: 설명 아래에 덧붙일 줄 (진행 중 퀘스트 재료 안내 등).
 */
export function sellCountDialog(item: ItemInstance, onSell: (count: number) => void, extra: (HTMLElement | null)[] = []): void {
  const m = modal(displayName(item));
  if (item.Kind === 'Equipment') m.body.append(h('div', { style: { fontSize: '13px' } }, gradeTag(item), ' ', gearText(item)));
  m.body.append(h('div', null, statLine(item)));
  for (const e of extra) if (e) m.body.append(e);
  const unit = sellPrice(item);
  let n = 1;
  const sellBtn = button('', () => {
    m.close();
    onSell(n);
  }, 'primary');
  const countEl = h('div', { style: { minWidth: '56px', textAlign: 'center', fontWeight: '700', fontSize: '18px' } });
  const minus = button('-', () => set(n - 1), 'ghost', 'sm');
  const plus = button('+', () => set(n + 1), 'ghost', 'sm');
  const max = button('최대', () => set(item.Count), 'outline', 'sm');
  for (const b of [minus, plus]) { b.style.width = '44px'; b.style.padding = '0'; }
  max.style.width = '64px';
  function set(v: number): void {
    n = Math.max(1, Math.min(item.Count, v));
    countEl.textContent = `${n} / ${item.Count}`;
    sellBtn.textContent = `판매 · ${(unit * n).toLocaleString('en-US')}G`;
    minus.disabled = n <= 1;
    plus.disabled = n >= item.Count;
    max.disabled = n >= item.Count;
  }
  if (item.Count > 1) {
    m.body.append(row(h('span', { class: 'sub grow' }, '판매 개수'), minus, countEl, plus, max));
    set(1);
  } else sellBtn.textContent = `판매 · ${unit.toLocaleString('en-US')}G`;
  m.body.append(sellBtn);
}

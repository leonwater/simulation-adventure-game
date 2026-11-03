import { addItem, displayName, takeItem } from '../core/items';
import type { ItemInstance } from '../core/items';
import { S } from './game';
import { cardGrid, itemCard, itemGrid } from './items';
import { button, h, row, sub } from './kit';
import { modal, toast } from './overlay';
import { router } from './router';

let open = false;

/**
 * 던전에서 가방이 가득 차 못 가진 물품(run.PendingDrops)을 하나씩 묻는다:
 * 두고 간다 / 버리고 가져간다 → 가방에서 버릴 물품 고르기 → 확인 → 교체. 던전 화면에서만 (전투·이벤트 중엔 기다린다).
 */
export function showPendingDrops(): void {
  const run = S.inDungeon ? S.run : null;
  if (open || !run || S.battle || !run.PendingDrops?.length || !(router.current as { dropsHere?: boolean } | null)?.dropsHere) return;
  open = true;
  const item = run.PendingDrops[0];
  const m = modal('가방이 가득 찼어요', false);
  const head = m.body.firstChild!;
  const done = (): void => {
    run.PendingDrops!.shift();
    if (run.PendingDrops!.length === 0) delete run.PendingDrops;
    S.save();
    m.close();
    open = false;
    router.rebuild(); // 남은 물품이 있으면 다음 것을 다시 묻는다
  };
  const name = (i: ItemInstance): string => `${displayName(i)}${i.Count > 1 ? ` ×${i.Count}` : ''}`;
  const ask = (): void => {
    m.body.replaceChildren(head,
      cardGrid(itemCard(item, { owner: S.c })),
      sub('가방의 물품 하나를 버리고 이 물품을 가져갈까요? 두고 가면 사라집니다.'),
      row(button('두고 간다', done, 'ghost', 'grow'), button('버리고 가져간다', pick, 'primary', 'grow')));
  };
  const pick = (): void => {
    m.body.replaceChildren(head, sub(`버릴 물품을 고르세요 (가져올 것: ${name(item)})`),
      itemGrid(S.c.Inventory, S.c, confirm, { showEmpty: false }), button('뒤로', ask, 'ghost'));
  };
  const confirm = (old: ItemInstance): void => {
    m.body.replaceChildren(head, h('div', { class: 'body', style: { lineHeight: '1.5' } }, `${name(old)}을(를) 버리고 ${name(item)}을(를) 가져갑니다.`),
      row(button('다시 고르기', pick, 'ghost', 'grow'), button('버리기', () => {
        const removed = takeItem(S.c.Inventory, old.Uid);
        if (!addItem(S.c.Inventory, item)) {
          if (removed) addItem(S.c.Inventory, removed); // 못 넣으면 되돌린다 (물품을 잃지 않게)
          return void toast('가방에 넣지 못했습니다');
        }
        toast(`${name(item)} 획득 · ${name(old)} 버림`);
        done();
      }, 'primary', 'grow')));
  };
  ask();
}

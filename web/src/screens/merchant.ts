
import { consumableDef, countOf } from '../core/items';

import * as dungeon from '../core/dungeon';
import { gold } from '../core/names';
import { dungeonSubBar } from '../ui/chrome';
import { S } from '../ui/game';
import { button, h, icon, row, sub } from '../ui/kit';
import { flash, toast } from '../ui/overlay';
import { openPauseMenu } from '../ui/pause';
import { Screen, router } from '../ui/router';
import { dungeonTheme } from '../ui/theme';
import { themeIndex } from '../core/monsters';
import { goDungeon } from './index';


/** 던전 상인: 전체 화면. 맨 위에 보유 골드와 가방을 크게, 물건마다 가격·보유·재고를 카드로. 사면 숫자가 바로 바뀐다. */
export class MerchantScreen extends Screen {
  onBack(): boolean {
    this.leave();
    return true;
  }
  private leave(): void {
    goDungeon();
  }

  build(): HTMLElement {
    const run = S.run;
    if (!run) {
      queueMicrotask(() => goDungeon());
      return h('div');
    }
    const c = S.c;
    const room = dungeon.currentRoom(run);
    const rescued = room.MerchantDiscount;
    const th = dungeonTheme(themeIndex(run.Floor));
    const cards = room.MerchantGoods.map((g) => {
      const price = S.merchantPrice(g.Item);
      const can = c.Gold >= price;
      const def = consumableDef(g.Item.TemplateId);
      const b = h('button', { class: 'card-btn row', style: { minHeight: '68px', padding: '8px 14px', gap: '10px', borderRadius: '12px', background: 'var(--btn)' }, on: { click: () => this.buy(g.Item.Uid, g.Item.Name) } },
        h('div', { class: 'col grow', style: { gap: '2px', alignItems: 'flex-start' } },
          h('b', { style: { fontSize: '16px' } }, g.Item.Name), def ? sub(def.Description) : null,
          h('span', { class: 'body', style: { fontSize: '12px' } }, `보유 ${countOf(c.Inventory, g.Item.TemplateId)} · 재고 ${g.Stock}`)),
        icon('gold', 18), h('b', { style: { fontSize: '16px', color: can ? '#fff' : 'var(--red-light)' } }, price.toLocaleString('en-US')));
      if (!can) b.style.opacity = '.45';
      return b;
    });
    return h('div', { class: 'page', style: { background: th.bg } },
      dungeonSubBar('', '던전', () => this.leave(), c, () => openPauseMenu()),
      h('div', { class: 'scroll', style: { gap: '10px' } },
        // 제목은 위 막대가 아니라 화면 위쪽 가운데에 크게
        h('div', { class: 'center', style: { fontSize: '22px', fontWeight: '700', color: 'var(--gold)', padding: '4px 0 2px', textAlign: 'center' } }, rescued ? '구해 준 상인' : '떠돌이 상인'),
        h('div', { class: 'card', style: { flexDirection: 'row', alignItems: 'center', height: '64px', padding: '0 14px' } },
          row(icon('gold', 28), h('b', { style: { fontSize: '20px' } }, gold(c.Gold))),
          h('span', { class: 'spacer' }),
          row(icon('bag', 28), h('b', { style: { fontSize: '20px' } }, `${c.Inventory.Items.length} / ${c.Inventory.Capacity}`))),
        sub(rescued ? '은인에게는 마을보다 30% 싸게 팝니다.' : '마을보다 50% 비싸게 팝니다. 필요한 것만 사 가세요.'),
        ...(cards.length ? cards : [sub('물건이 모두 팔렸습니다.')])),
      h('div', { style: { padding: '8px 16px', background: 'var(--bar)', borderTop: '1px solid var(--line)' } }, button('거래를 마친다', () => this.leave(), 'primary', 'lg')));
  }

  private buy(uid: string, name: string): void {
    const r = S.buyFromMerchant(uid, 1);
    if (!r.ok) return toast(r.error ?? '');
    flash(`${name} 구매`, 'var(--gold)');
    router.rebuild();
  }
}

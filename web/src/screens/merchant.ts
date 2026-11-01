import * as dungeon from '../core/dungeon';
import { cannotEquipReason } from '../core/equipment';
import { knowsSkill } from '../core/equipment';
import type { ItemInstance, ShopGood } from '../core/items';
import { countOf, displayName, sellPrice, statLine } from '../core/items';
import { themeIndex } from '../core/monsters';
import { gold } from '../core/names';
import { dungeonTop } from '../ui/dungeonbar';
import { S } from '../ui/game';
import { offerBetterGear } from '../ui/gearoffer';
import { colored, compareLine, equipLine, infoText, itemTitle, kindLine, nameColor, soldOut } from '../ui/items';
import { isSoldOut } from '../core/shop';
import { button, h, icon, row, tabs } from '../ui/kit';
import { flash, modal, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { sellCountDialog } from '../ui/sellcount';
import { dungeonTheme } from '../ui/theme';
import { goDungeon } from './index';

/**
 * 떠돌이 상인: 상점과 같은 모양(구매 / 판매 탭, 3열 카드)이지만 일러스트가 없다.
 * 소모품 + 낮은 확률로 장비·스킬서. 판매 가격은 마을 상점과 같다.
 */
export class MerchantScreen extends Screen {
  private tab = 0;

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
    S.openMerchant();
    const c = S.c;
    const room = dungeon.currentRoom(run);
    const th = dungeonTheme(themeIndex(run.Floor));
    const grid = (cells: HTMLElement[]): HTMLElement => h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' } }, ...cells);
    const body = this.tab === 0 ? grid(room.MerchantGoods.map((g) => this.goodCell(g))) : grid(c.Inventory.Items.map((i) => this.sellCell(i)));
    return h('div', { class: 'page', style: { background: th.bg } },
      dungeonTop(),
      h('div', { style: { fontSize: '22px', fontWeight: '700', color: 'var(--gold)', textAlign: 'center', padding: '20px 0 14px', flexShrink: '0' } }, room.MerchantDiscount ? '구해 준 상인' : '떠돌이 상인'),
      tabs(['구매', '판매'], this.tab, (i) => {
        this.tab = i;
        router.rebuild();
      }),
      h('div', { class: 'scroll', style: { gap: '12px' } },
        row(row(icon('gold', 22), h('b', { style: { fontSize: '16px' } }, gold(c.Gold))), h('span', { class: 'spacer' }),
          row(icon('bag', 22), h('b', { style: { fontSize: '16px' } }, `${c.Inventory.Items.length} / ${c.Inventory.Capacity}`))),
        body),
      h('div', { style: { padding: '8px 16px', background: 'var(--bar)', borderTop: '1px solid var(--line)', flexShrink: '0' } }, Object.assign(button('거래를 마친다', () => this.leave(), 'primary', 'lg'), { style: 'width:100%' })));
  }

  private card(onClick: () => void, ...kids: (Node | string | null)[]): HTMLButtonElement {
    return h('button', { class: 'card-btn', style: { height: '112px', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', minWidth: '0', overflow: 'hidden' }, on: { click: onClick } }, ...kids);
  }

  private goodCell(g: ShopGood): HTMLElement {
    const c = S.c;
    const item = g.Item;
    const price = S.merchantPrice(item);
    const known = item.Kind === 'SkillBook' && knowsSkill(c, item.SkillId);
    const cell = this.card(() => this.buyDialog(g),
      kindLine(item, 12),
      h('b', { style: { fontSize: '14px', textAlign: 'left', color: nameColor(item), maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, itemTitle(item)),
      // 소모품은 보유·재고를 색으로 구분해 눈에 띄게 (보유 = 파랑 · 재고 = 금색)
      h('span', { class: 'sub', style: { textAlign: 'left', fontSize: '12px', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
        ...(item.Kind === 'Consumable' ? [colored(`보유 ${countOf(c.Inventory, item.TemplateId)}`, 'var(--info)'), ' · ', colored(`재고 ${g.Stock}`, 'var(--gold)')] : [item.Kind === 'Equipment' ? equipLine(c, item) : infoText(c, item)])),
      h('span', { class: 'spacer' }),
      h('b', { style: { fontSize: '14px', color: c.Gold >= price ? 'var(--gold)' : 'var(--red-light)' } }, `${price.toLocaleString('en-US')} G`));
    if (known) cell.style.opacity = '.5';
    if (isSoldOut(g)) return soldOut(cell);
    return cell;
  }

  private buyDialog(g: ShopGood): void {
    const c = S.c;
    const item = g.Item;
    const m = modal(displayName(item));
    m.body.append(h('div', null, statLine(item)));
    const cl = item.Kind === 'Equipment' ? compareLine(c, item) : null;
    if (cl) m.body.append(cl);
    const reason = item.Kind === 'Equipment' ? cannotEquipReason(c, item) : null;
    if (reason) m.body.append(h('div', { style: { color: 'var(--red-light)', fontSize: '13px' } }, reason));
    m.body.append(button(`구매 · ${S.merchantPrice(item).toLocaleString('en-US')}G`, () => {
      const r = S.buyFromMerchant(item.Uid, 1);
      if (!r.ok) return toast(r.error ?? '');
      m.close();
      router.rebuild();
      // 산 장비가 지금보다 좋으면 바로 착용할지 묻는다
      const bought = item.Kind === 'Equipment' ? c.Inventory.Items[c.Inventory.Items.length - 1] : null;
      if (bought) offerBetterGear([bought], () => router.rebuild());
      else flash(`${item.Name} 구매`, 'var(--gold)');
    }, 'primary'));
  }

  private sellCell(item: ItemInstance): HTMLElement {
    const c = S.c;
    return this.card(() => this.sellDialog(item),
      kindLine(item, 12),
      h('div', { style: { fontSize: '13px', lineHeight: '1.1', maxHeight: '2.2em', overflow: 'hidden', color: nameColor(item), textAlign: 'left' } }, itemTitle(item)),
      h('div', { class: 'sub', style: { textAlign: 'left', fontSize: '12px', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, item.Kind === 'Equipment' ? equipLine(c, item) : infoText(c, item)),
      h('span', { class: 'spacer' }),
      h('div', { class: 'row', style: { width: '100%', fontSize: '12px' } }, h('span', { class: 'grow gold', style: { textAlign: 'left' } }, `${sellPrice(item).toLocaleString('en-US')} G`), item.Count > 1 ? h('b', null, `×${item.Count}`) : null));
  }

  private sellDialog(item: ItemInstance): void {
    sellCountDialog(item, (n) => {
      const r = S.sellToMerchant(item.Uid, n);
      if (!r.ok) return toast(r.error ?? '');
      router.rebuild();
    });
  }
}

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
import { cardGrid, colored, compareLine, infoText, itemCard, price, soldOut } from '../ui/items';
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
    const grid = (cells: HTMLElement[]): HTMLElement => cardGrid(...cells);
    const body = this.tab === 0 ? grid(room.MerchantGoods.map((g) => this.goodCell(g))) : grid(c.Inventory.Items.map((i) => this.sellCell(i)));
    return h('div', { class: 'page', style: { background: th.bg } },
      dungeonTop(),
      h('div', { class: 'display', style: { fontSize: '22px', fontWeight: '700', color: 'var(--gold)', textAlign: 'center', padding: '20px 0 14px', flexShrink: '0' } }, room.MerchantDiscount ? '구해 준 상인' : '떠돌이 상인'),
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

  private goodCell(g: ShopGood): HTMLElement {
    const c = S.c;
    const item = g.Item;
    const cost = S.merchantPrice(item);
    const known = item.Kind === 'SkillBook' && knowsSkill(c, item.SkillId);
    const cell = itemCard(item, {
      onClick: () => this.buyDialog(g),
      // 소모품은 보유·재고를 색으로 구분해 눈에 띄게 (보유 = 파랑 · 재고 = 금색)
      // 소모품: 보유는 정보 줄(파랑), 재고는 그림 칸 오른쪽 위(금색, 무제한이면 표시 안 함)
      info: item.Kind === 'Consumable' ? colored(`보유 ${countOf(c.Inventory, item.TemplateId)}`, 'var(--info)') : infoText(c, item),
      owner: c,
      corner: item.Kind === 'Consumable' && g.Stock >= 0 ? colored(`재고 ${g.Stock}`, 'var(--gold)') : undefined,
      foot: price(cost, c.Gold >= cost),
    });
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
    return itemCard(item, { onClick: () => this.sellDialog(item), info: infoText(c, item), owner: c, foot: price(sellPrice(item)) });
  }

  private sellDialog(item: ItemInstance): void {
    sellCountDialog(item, (n) => {
      const r = S.sellToMerchant(item.Uid, n);
      if (!r.ok) return toast(r.error ?? '');
      router.rebuild();
    });
  }
}

import { B } from '../core/balance';
import { cannotEquipReason } from '../core/equipment';
import { JOBS } from '../core/enums';

import type { ItemInstance } from '../core/items';
import { canBeUsedBy, countOf, sellPrice, statLine } from '../core/items';
import { skillDef } from '../core/skills';
import { knowsSkill } from '../core/equipment';
import { Names } from '../core/names';
import { buyEquipment, buyGood, reroll, rerollCost, sell, sellMany, isSold, isSoldOut } from '../core/shop';
import type { ShopGood } from '../core/items';
import { goodUnlimited } from '../core/items';
import { jobLine, npcIllustration, townBar } from '../ui/chrome';
import { S } from '../ui/game';
import { offerBetterGear, isBetter } from '../ui/gearoffer';
import { colored, compareLine, equipLine, gearText, gradeTag, infoText, itemTitle, kindLine, levelChip, nameColor } from '../ui/items';
import { button, h, longPress, row, sub, tabs } from '../ui/kit';
import { sellCountDialog } from '../ui/sellcount';
import { tierColor } from '../ui/theme';
import { soldOut } from '../ui/items';
import { confirmBox, modal, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { tutorial } from '../ui/tutorial';
import { navigate } from './nav';


/** 상점: 상점 주인 일러스트·대사, 구매 탭(갱신·장비·소모품) / 판매 탭(가방 물건을 구매와 같은 카드로). */
export class ShopScreen extends Screen {
  private tab = 0;
  /** 판매 선택 모드에서 고른 칸 (null = 선택 모드가 아님). */
  private selected: Set<string> | null = null;
  private line = '어서 오시게, 손님. 좋은 물건이 많다네. 골드만 있다면야 뭐든지!';

  onBack(): boolean {
    if (this.selected) {
      this.setSelecting(false);
      return true;
    }
    navigate('town');
    return true;
  }

  build(): HTMLElement {
    S.markShopSeen();
    const c = S.c;
    return h('div', { class: 'page' },
      townBar('상점', '마을', () => navigate('town'), c),
      npcIllustration('shop', '상점 주인', this.line, 260),
      tabs(['구매', '판매'], this.tab, (i) => {
        this.tab = i;
        this.selected = null;
        router.rebuild();
      }),
      h('div', { class: 'scroll', style: { gap: '14px' } }, ...(this.tab === 0 ? this.buyTab() : this.sellTab())),
      this.selected ? this.sellBar() : null);
  }

  afterShow(): void {
    tutorial.onFacility('shop');
  }

  private buyTab(): HTMLElement[] {
    const shop = S.data!.Shop;
    const grid = (...cells: HTMLElement[]): HTMLElement => h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } }, ...cells);
    return [
      h('div', { class: 'card', style: { flexDirection: 'row', alignItems: 'center', gap: '8px', borderRadius: '10px', padding: '6px 8px 6px 12px' } },
        h('b', { class: 'grow', style: { fontSize: '15px' } }, '물건 갱신'),
        h('b', { class: 'gold', style: { fontSize: '13px' } }, `${rerollCost(shop).toLocaleString('en-US')}G`),
        (() => { const b = button('갱신', () => this.confirmReroll(), 'outline', 'sm'); b.style.width = '64px'; b.style.minHeight = '34px'; b.style.height = '34px'; return b; })()),
      h('div', { class: 'col', 'data-anchor': 'shop.equip' },
        h('b', null, '장비'),
        shop.Equipment.length === 0 ? sub("장비가 모두 팔렸습니다. '갱신'으로 새 물건을 들여올 수 있어요.") : null,
        grid(...shop.Equipment.map((i) => this.equipCell(i)))),
      h('div', { class: 'col' }, h('b', null, '소모품 · 스킬'), grid(...shop.Goods.map((g) => this.goodCell(g)))),
    ];
  }

  private cardButton(onClick: () => void, ...kids: (Node | string | null)[]): HTMLButtonElement {
    return h('button', { class: 'card-btn', style: { height: '104px', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }, on: { click: onClick } }, ...kids);
  }

  /** 장비 카드: 종류 색 원·부위 · 이름(등급 색) · 착용 레벨과 지금 장비 대비 · 가격. */
  private equipCell(item: ItemInstance): HTMLElement {
    const c = S.c;
    const usable = canBeUsedBy(item, c.Job);
    const cell = this.cardButton(() => this.buyEquipDialog(item),
      kindLine(item, 12),
      h('b', { style: { fontSize: '14px', color: nameColor(item), textAlign: 'left' } }, item.Name),
      // 착용 레벨 · 능력치 변화(또는 직업 전용)를 한 줄에
      h('span', { class: 'sub', style: { whiteSpace: 'nowrap' } }, ...(usable ? [equipLine(c, item)] : [levelChip(c, item), ' ', colored(`${Names.job(JOBS[item.JobRestriction])} 전용`, '#E38A82')])),
      h('span', { class: 'spacer' }),
      h('b', { class: 'gold', style: { fontSize: '14px' } }, `${item.Price.toLocaleString('en-US')} G`));
    if (!usable) cell.style.opacity = '.55';
    if (isSold(S.data!.Shop, item.Uid)) return soldOut(cell);
    return cell;
  }

  private buyEquipDialog(item: ItemInstance): void {
    const c = S.c;
    const m = modal(item.Name);
    m.body.append(h('div', { style: { fontSize: '13px' } }, gradeTag(item), ' ', gearText(item)), h('div', null, statLine(item)));
    const cl = compareLine(c, item);
    if (cl) m.body.append(cl);
    const reason = cannotEquipReason(c, item);
    if (reason) m.body.append(h('div', { style: { color: '#E38A82', fontSize: '13px' } }, reason));
    m.body.append(button(`구매 · ${item.Price.toLocaleString('en-US')}G`, () => {
      const r = buyEquipment(S.data!.Shop, c, item.Uid);
      if (!r.ok) return toast(r.error ?? '');
      m.close();
      S.save();
      this.line = `탁월한 선택이야, 손님! ${item.Name}에 어울리는 모험이 기다리겠군.`;
      router.rebuild();
      // 지금 장비보다 좋으면 바로 착용할지 묻는다 (가방에 들어간 것은 새 번호를 단 같은 장비)
      const bought = c.Inventory.Items[c.Inventory.Items.length - 1];
      if (isBetter(c, bought)) offerBetterGear([bought], () => router.rebuild());
      else toast(`${item.Name} 구매 완료`);
    }, 'primary'));
  }

  private skillBookJob(item: ItemInstance, size: number): HTMLElement | string {
    const def = skillDef(item.SkillId);
    if (!def) return '';
    if (def.JobRestriction < 0) return '모든 직업';
    const job = JOBS[def.JobRestriction];
    return jobLine(job, `${Names.job(job)} 전용`, size, job === S.c.Job ? 'var(--sub)' : '#E38A82');
  }

  private goodCell(g: ShopGood): HTMLElement {
    const c = S.c;
    const item = g.Item;
    const known = item.Kind === 'SkillBook' && knowsSkill(c, item.SkillId);
    const cell = this.cardButton(() => this.buyGoodDialog(g),
      kindLine(item, 12),
      h('b', { style: { fontSize: '14px', textAlign: 'left' } }, itemTitle(item)),
      item.Kind === 'Consumable' ? h('span', { class: 'sub' }, `보유 ${countOf(c.Inventory, item.TemplateId)}`) : known ? colored('이미 배움', '#E38A82') : h('span', { class: 'sub' }, this.skillBookJob(item, 12)),
      h('span', { class: 'spacer' }),
      h('b', { class: 'gold', style: { fontSize: '14px' } }, `${item.Price.toLocaleString('en-US')} G`));
    if (known) {
      cell.disabled = true;
      cell.style.opacity = '.5';
    }
    if (isSoldOut(g)) return soldOut(cell);
    return cell;
  }

  private buyGoodDialog(g: ShopGood): void {
    const c = S.c;
    const item = g.Item;
    const m = modal(item.Name);
    if (item.Kind === 'SkillBook') {
      // 스킬서 이름 / 장착 조건 / 등급·직업 / 효과 / 재사용 — 한 줄씩
      const def = skillDef(item.SkillId)!;
      m.body.append(
        h('div', { class: 'col', style: { gap: '6px', lineHeight: '1.4' } },
          h('div', null, `장착 조건: Lv.${def.ReqLevel} · ${def.ReqRank} 등급`),
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { style: { color: tierColor(def.Tier) } }, `${Names.tier(def.Tier)} 스킬`), this.skillBookJob(item, 14)),
          h('div', null, def.Effect),
          h('div', { class: 'sub' }, `재사용 ${def.Cooldown}턴`)));
      if (knowsSkill(c, def.Id)) m.body.append(h('div', { style: { color: '#E38A82', fontSize: '13px' } }, '이미 배운 스킬입니다.'));
    } else m.body.append(h('div', null, statLine(item)));
    let count = 1;
    const countEl = h('div', { style: { minWidth: '64px', textAlign: 'center', fontWeight: '700' } });
    const buy = button('', () => {
      const r = buyGood(S.data!.Shop, c, item.Uid, count);
      if (!r.ok) return toast(r.error ?? '');
      m.close();
      S.save();
      toast(`${item.Name}${count > 1 ? ` ×${count}` : ''} 구매 완료`);
      this.line = '고맙네! 또 필요하면 언제든 들르시게.';
      router.rebuild();
    }, 'primary');
    const refresh = (): void => {
      countEl.textContent = `${count}개`;
      buy.textContent = `구매 · ${(item.Price * count).toLocaleString('en-US')}G`;
    };
    const set = (d: number): void => {
      count = Math.max(1, Math.min(B.MaxStack, count + d));
      refresh();
    };
    if (goodUnlimited(g)) {
      const mk = (label: string, fn: () => void, kind: '' | 'ghost' | 'outline', w: number): HTMLButtonElement => {
        const b = button(label, fn, kind, 'sm');
        b.style.width = `${w}px`;
        b.style.padding = '0';
        return b;
      };
      m.body.append(h('div', { class: 'row', style: { justifyContent: 'center' } }, mk('-', () => set(-1), 'ghost', 40), countEl, mk('+', () => set(1), 'ghost', 40), mk('+10', () => set(10), 'outline', 64)));
    }
    m.body.append(buy);
    refresh();
  }

  private confirmReroll(): void {
    const cost = rerollCost(S.data!.Shop);
    confirmBox('상점 갱신', `${cost.toLocaleString('en-US')}G를 소모하여 즉시 갱신하겠습니까?`, '갱신', () => {
      const r = reroll(S.data!.Shop, S.c, S.rng);
      if (!r.ok) return toast(r.error ?? '');
      this.line = '자, 새 물건이 들어왔다네. 천천히 골라 보시게.';
      S.save();
      router.rebuild();
    });
  }

  // ── 판매 ──

  private sellTab(): HTMLElement[] {
    const c = S.c;
    const any = c.Inventory.Items.length > 0;
    const out: HTMLElement[] = [];
    const head = row(h('b', { class: 'grow' }, '가방 ', colored(`${c.Inventory.Items.length} / ${c.Inventory.Capacity}`, 'var(--sub)')));
    if (!this.selected) {
      const multi = button('선택 판매', () => this.setSelecting(true), 'outline', 'sm');
      multi.disabled = !any;
      const junk = button('일괄 판매', () => this.sellMaterials(), 'ghost', 'sm');
      junk.disabled = !c.Inventory.Items.some((i) => i.Kind === 'Material');
      head.append(multi, junk);
      out.push(head);
    } else {
      const all = this.selected.size === c.Inventory.Items.length;
      head.append(
        button(all ? '모두 해제' : '모두 선택', () => {
          if (all) this.selected!.clear();
          else c.Inventory.Items.forEach((i) => this.selected!.add(i.Uid));
          router.rebuild();
        }, 'ghost', 'sm'),
        button('장비만 선택', () => {
          this.selected!.clear();
          c.Inventory.Items.filter((i) => i.Kind === 'Equipment').forEach((i) => this.selected!.add(i.Uid));
          router.rebuild();
        }, 'ghost', 'sm'));
      out.push(head);
    }
    if (!any) {
      out.push(sub('가방이 비어 있습니다.'));
      return out;
    }
    out.push(h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } }, ...c.Inventory.Items.map((i) => this.sellCell(i))));
    return out;
  }

  private sellCell(item: ItemInstance): HTMLElement {
    const c = S.c;
    const sel = !!this.selected && this.selected.has(item.Uid);
    const cell = h('button', { class: 'card-btn', style: { height: '118px', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', position: 'relative', background: sel ? 'var(--accent-bg)' : 'var(--card)', borderColor: sel ? 'var(--accent)' : 'var(--card-border)' } },
      kindLine(item, 12),
      h('div', { style: { fontSize: '13px', lineHeight: '1.05', maxHeight: '2.2em', overflow: 'hidden', color: nameColor(item), textAlign: 'left' } }, itemTitle(item)),
      h('div', { class: 'sub', style: { textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' } }, item.Kind === 'Equipment' ? equipLine(c, item) : infoText(c, item)),
      h('span', { class: 'spacer' }),
      h('div', { class: 'row', style: { width: '100%', fontSize: '12px' } }, h('span', { class: 'grow gold', style: { textAlign: 'left' } }, `${sellPrice(item).toLocaleString('en-US')} G`), item.Count > 1 ? h('b', null, `×${item.Count}`) : null),
      sel ? h('span', { class: 'chip' }, '√') : null);
    longPress(cell, () => {
      if (!this.selected) this.selected = new Set();
      this.selected.add(item.Uid);
      router.rebuild();
    }, () => {
      if (!this.selected) return this.sellDialog(item);
      if (!this.selected.delete(item.Uid)) this.selected.add(item.Uid);
      router.rebuild();
    });
    return cell;
  }

  private setSelecting(on: boolean): void {
    this.selected = on ? new Set() : null;
    router.rebuild();
  }

  /** 선택 모드 아래 고정 줄: "N개 선택 · 합계" + 취소 · 판매. */
  private sellBar(): HTMLElement {
    const c = S.c;
    const sel = this.selected!;
    const total = c.Inventory.Items.filter((i) => sel.has(i.Uid)).reduce((a, i) => a + sellPrice(i) * i.Count, 0);
    const sellBtn = button('판매', () => confirmBox('한 번에 판매', `${sel.size}칸을 ${total.toLocaleString('en-US')}G에 팝니다.`, '판매', () => {
      const got = sellMany(c, [...sel]);
      this.selected = null;
      this.line = '흠, 이 정도면 값을 쳐 주지. 거래 고맙네.';
      S.save();
      toast(`${got.toLocaleString('en-US')}G를 받았다`);
      router.rebuild();
    }), 'primary');
    sellBtn.disabled = sel.size === 0;
    sellBtn.style.width = '84px';
    const cancel = button('취소', () => this.setSelecting(false), 'ghost');
    cancel.style.width = '64px';
    return h('div', { class: 'row', style: { padding: '10px 16px', background: 'var(--bar)', borderTop: '1px solid var(--line)', flexShrink: '0' } },
      h('div', { class: 'col grow', style: { gap: '2px' } }, h('b', null, `${sel.size}칸 선택`), h('b', { class: 'gold', style: { fontSize: '13px' } }, `합계 ${total.toLocaleString('en-US')} G`)),
      cancel, sellBtn);
  }

  private sellDialog(item: ItemInstance): void {
    const c = S.c;
    const needed = S.data!.Guild.Active.some((q) => q.MaterialId === item.TemplateId);
    sellCountDialog(item, (n) => {
      const r = sell(c, item.Uid, n);
      if (!r.ok) return toast(r.error ?? '');
      this.line = '흠, 이 정도면 값을 쳐 주지. 거래 고맙네.';
      S.save();
      router.rebuild();
    }, [needed ? h('div', { class: 'gold', style: { fontSize: '13px' } }, '진행 중인 채집 퀘스트에 필요한 아이템입니다.') : null]);
  }

  private sellMaterials(): void {
    const c = S.c;
    const sellable = (i: ItemInstance): boolean => i.Kind === 'Material' && !S.data!.Guild.Active.some((q) => q.MaterialId === i.TemplateId);
    const total = c.Inventory.Items.filter(sellable).reduce((a, i) => a + sellPrice(i) * i.Count, 0);
    confirmBox('일괄 판매', `진행 중인 퀘스트에 필요한 것을 빼고 기타 아이템을 모두 팝니다. (${total.toLocaleString('en-US')}G)`, '판매', () => {
      for (const i of [...c.Inventory.Items].filter(sellable)) sell(c, i.Uid, i.Count);
      S.save();
      router.rebuild();
    });
  }
}

import { B } from '../core/balance';
import { findEquipped } from '../core/character';
import { cannotEnhanceReason, downgradeChance, enhance, findGear, successRate } from '../core/equipment';
import { SLOTS } from '../core/enums';
import type { ItemInstance } from '../core/items';
import { ENHANCE_STONE_ID, countOf, displayName, goldCost, isAccessory, isWeapon, itemValue, stoneCost, valueAt } from '../core/items';
import { Names } from '../core/names';
import { npcIllustration, townBar } from '../ui/chrome';
import { S } from '../ui/game';
import { artImg, cardGrid, colored, compareLine, emptyCard, gearText, gradeTag, itemArt, itemCard } from '../ui/items';
import { button, h, row, sub } from '../ui/kit';
import { flash, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { GRADE_COLOR } from '../ui/theme';
import { tutorial } from '../ui/tutorial';
import { navigate } from './nav';

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** 대장간: 장착 중·가방의 장비를 +15까지 강화. 장비는 부서지지 않고, +7 이상 실패 시 일정 확률로 한 단계 내려간다. */
export class BlacksmithScreen extends Screen {
  private selected: string | null = null;
  private line = '망치는 정직하지. 실패해도 장비가 부서지진 않으니 걱정 말게.';

  onBack(): boolean {
    navigate('town');
    return true;
  }

  build(): HTMLElement {
    const c = S.c;
    const bag = c.Inventory.Items.filter((i) => i.Kind === 'Equipment');
    if (!this.selected || !findGear(c, this.selected)) {
      const first = c.Equipment.Slots.find((s) => s != null) ?? null;
      this.selected = first ? first.Uid : bag.length > 0 ? bag[0].Uid : null;
    }
    const sel = this.selected ? findGear(c, this.selected) : null;
    // 장비 선택은 가방의 장착 장비 칸과 같은 4열 작은 카드: 장착 장비(8칸 모두) → 가방 장비
    const grid = cardGrid;
    return h('div', { class: 'page' },
      townBar('대장간', '마을', () => navigate('town'), c),
      npcIllustration('blacksmith', '대장장이', this.line, 220),
      h('div', { class: 'scroll', style: { gap: '8px' } },
        sel ? this.detail(sel) : null,
        row(h('b', { class: 'grow' }, '장착 장비'), artImg('enhance_stone', 32), h('b', { style: { fontSize: '15px' } }, '강화석 ', colored(`${countOf(c.Inventory, ENHANCE_STONE_ID)}개`, 'var(--blue-light)'))),
        grid(...SLOTS.map((slot, i) => this.cell(c.Equipment.Slots[i], Names.slot(slot)))),
        h('b', null, '가방 장비'),
        bag.length > 0 ? grid(...bag.map((i) => this.cell(i, Names.gear(i.Gear)))) : sub('가방에 장비가 없습니다.')));
  }

  afterShow(): void {
    tutorial.onFacility('blacksmith');
  }

  /** 장비 칸: 작은 카드 (그림·강화 단계·이름), 비어 있으면 부위 이름. 고른 장비는 금색 테두리 */
  private cell(item: ItemInstance | null, part: string): HTMLElement {
    if (!item) return emptyCard(part, true);
    return itemCard(item, { mini: true, selected: item.Uid === this.selected, onClick: () => {
      this.selected = item.Uid;
      router.rebuild();
    } });
  }

  private detail(item: ItemInstance): HTMLElement {
    const c = S.c;
    const card = h('div', { class: 'card', 'data-anchor': 'smith.detail', style: { background: 'var(--btn)', borderColor: 'var(--btn-border)', gap: '6px', padding: '12px 14px' } },
      row(itemArt(item), h('b', { class: 'grow', style: { fontSize: '16px', color: GRADE_COLOR[item.Grade] } }, displayName(item)), h('span', { class: 'nw', style: { fontSize: '12px' } }, gradeTag(item), ' ', colored(gearText(item), 'var(--sub)'))));
    const cl = compareLine(c, item);
    if (cl && !findEquipped(c, item.Uid)) card.append(cl);
    if (item.Enhance >= B.MaxEnhance) {
      card.append(h('div', { class: 'gold' }, `최대 강화(+${B.MaxEnhance})에 도달했습니다.`));
      return card;
    }
    const what = isWeapon(item) ? '공격력' : isAccessory(item) ? Names.stat(item.BonusStat) : '방어력';
    card.append(
      row(
        h('div', { class: 'col grow', style: { gap: '2px' } }, h('span', { class: 'nw' }, `+${item.Enhance} → +${item.Enhance + 1}`), h('span', { class: 'nw' }, `${what} ${itemValue(item)} → `, colored(String(valueAt(item, item.Enhance + 1)), 'var(--green)'))),
        h('div', { class: 'col', style: { gap: '2px', alignItems: 'flex-end' } }, h('b', null, `성공률 ${pct(successRate(item))}`), h('b', null, `${goldCost(item).toLocaleString('en-US')} G`))));
    const down = downgradeChance(item);
    if (down > 0) card.append(h('div', { style: { color: 'var(--red-light)', fontSize: '13px' } }, `실패하면 ${pct(down)} 확률로 +${item.Enhance - 1}로 내려갑니다.`));
    const stones = stoneCost(item);
    const have = countOf(c.Inventory, ENHANCE_STONE_ID);
    if (stones > 0) card.append(row(artImg('enhance_stone', 32), h('b', null, '강화석 ', colored(`${have} / ${stones}`, have >= stones ? 'var(--green)' : 'var(--red-light)'))));
    const reason = cannotEnhanceReason(c, item);
    // 강화 버튼에도 강화할 장비 그림
    const b = button([itemArt(item), reason ?? `강화하기 +${item.Enhance} → +${item.Enhance + 1}`], () => this.doEnhance(item), 'primary', 'row');
    b.disabled = reason !== null;
    card.append(b);
    return card;
  }

  private doEnhance(item: ItemInstance): void {
    const r = enhance(S.c, item.Uid, S.rng);
    switch (r.result) {
      case 'Success':
        this.line = `좋아, 잘 붙었군! ${displayName(item)} 완성이다.`;
        flash('강화 성공', 'var(--green)');
        break;
      case 'Failed':
        this.line = '쯧, 이번엔 안 됐네. 장비는 멀쩡하니 다시 해 보게.';
        flash('강화 실패', 'var(--sub)');
        break;
      case 'Downgraded':
        this.line = '이런, 손이 미끄러졌군. 한 단계 깎였지만 부서지진 않았네.';
        flash('등급 하락', 'var(--red-light)');
        break;
      default:
        return toast(r.error ?? '');
    }
    S.save();
    router.rebuild();
  }
}

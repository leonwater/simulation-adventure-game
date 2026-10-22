import { B } from '../core/balance';
import { maxHp } from '../core/character';
import { cannotEquipReason, equip, replacedBy, unequip, useSkillBook } from '../core/equipment';
import type { EquipSlot } from '../core/enums';
import { JOBS, SLOTS } from '../core/enums';
import type { ItemInstance } from '../core/items';
import { consumableDef, displayName, sellPrice, statLine, takeItem } from '../core/items';
import { Names, josa } from '../core/names';
import { skillDef } from '../core/skills';
import { bagPrice, buyBag, canBuyBag, sell } from '../core/shop';
import { bottomNav, jobLine, townBar } from '../ui/chrome';
import { dungeonTop } from '../ui/dungeonbar';
import { S } from '../ui/game';
import { button, h, icon, row, sub } from '../ui/kit';
import { compareLine, gearText, gradeTag, itemGrid, kindLine } from '../ui/items';
import { confirmBox, modal, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { GRADE_COLOR } from '../ui/theme';
import { goToCurrent } from './index';
import { navigate } from './nav';

/** 가방·장비: 장비 8칸, 4열 가방. 칸을 누르면 화면 가운데 팝업에 정보와 착용·해제·사용·판매(던전에서는 버리기)가 뜬다. */
export class InventoryScreen extends Screen {
  constructor(private readonly fromDungeon = false) {
    super();
  }

  onBack(): boolean {
    this.back();
    return true;
  }
  private back(): void {
    if (this.fromDungeon) goToCurrent();
    else navigate('town');
  }

  build(): HTMLElement {
    const c = S.c;
    // 던전에서 연 가방은 던전 머리줄(HP·일시정지) + 캐릭터 정보 줄
    const bar = this.fromDungeon ? dungeonTop() : townBar('가방', '마을', () => this.back(), c);
    const expand = button(icon('plus', 20, 'var(--gold)'), () => this.buyBag(), '', '');
    expand.style.cssText = 'width:40px;min-height:40px;height:40px;padding:0;border-color:var(--accent);background:var(--bg)';
    expand.disabled = !canBuyBag(c);
    return h('div', { class: 'page' },
      bar,
      h('div', { class: 'scroll', style: { gap: '10px' } },
        h('b', null, '장착 장비'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' } }, ...SLOTS.map((s) => this.slotCell(s))),
        row(h('b', { class: 'grow' }, '가방 ', h('span', { class: 'sub', style: { fontSize: '14px' } }, `${c.Inventory.Items.length} / ${c.Inventory.Capacity}`)), this.fromDungeon ? null : expand),
        itemGrid(c.Inventory, c, (item) => this.showItem(item, null)),
        sub('사망하면 장착하지 않은 아이템을 모두 잃습니다. 길드 창고에 맡겨 두세요.')),
      this.fromDungeon
        ? h('div', { style: { padding: '8px 16px', background: 'var(--bar)', borderTop: '1px solid var(--line)', flexShrink: '0' } }, button('던전으로 돌아가기', () => this.back(), 'primary', 'lg'))
        : bottomNav(2, (i) => navigate(['town', 'character', 'inventory', 'skills'][i] as never)));
  }

  private slotCell(slot: EquipSlot): HTMLElement {
    const c = S.c;
    const item = c.Equipment.Slots[SLOTS.indexOf(slot)];
    const cell = h('button', {
      class: 'card-btn', style: { height: '66px', padding: '8px 6px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: item ? 'var(--card)' : 'var(--bg)', borderColor: item ? GRADE_COLOR[item.Grade] : 'var(--card-border)' },
      on: { click: () => item && this.showItem(item, slot) },
    }, h('span', { class: 'sub' }, Names.slot(slot)), h('span', { class: 'spacer' }),
    item ? h('span', { style: { fontSize: '12px', color: GRADE_COLOR[item.Grade], textAlign: 'left' } }, displayName(item)) : sub('비어 있음'));
    return cell;
  }

  /** 아이템 팝업: 이름·종류·수치·지금 장비와 비교, 착용·해제·사용·습득·판매/버리기. */
  private showItem(item: ItemInstance, equippedSlot: EquipSlot | null): void {
    const c = S.c;
    const equipped = equippedSlot !== null;
    const m = modal(item.Count > 1 ? `${displayName(item)} ×${item.Count}` : displayName(item));
    const done = (): void => {
      m.close();
      S.save();
      router.rebuild();
    };
    m.body.append(row(kindLine(item, 13), item.Kind === 'Equipment' ? gradeTag(item) : null));
    if (item.Kind === 'Equipment') m.body.append(h('div', { class: 'sub' }, gearText(item)));
    m.body.append(h('div', null, statLine(item)));
    if (item.Kind === 'Equipment' && !equipped) {
      const cl = compareLine(c, item);
      if (cl) m.body.append(cl);
    }
    const book = item.Kind === 'SkillBook' ? skillDef(item.SkillId) : null;
    if (book && book.JobRestriction >= 0) m.body.append(jobLine(JOBS[book.JobRestriction], `${Names.job(JOBS[book.JobRestriction])} 전용`, 13, book.JobRestriction === JOBS.indexOf(c.Job) ? 'var(--sub)' : '#E38A82'));
    const actions = row();
    m.body.append(actions);
    const act = (label: string, kind: '' | 'primary' | 'ghost', fn: () => void): HTMLButtonElement => {
      const b = button(label, fn, kind, 'grow');
      actions.append(b);
      return b;
    };
    if (equipped) {
      act('해제', '', () => {
        const r = unequip(c, equippedSlot!);
        if (!r.ok) toast(r.error ?? '');
        done();
      });
      return;
    }
    switch (item.Kind) {
      case 'Equipment': {
        const reason = cannotEquipReason(c, item);
        if (reason) m.body.insertBefore(h('div', { style: { color: '#E38A82', fontSize: '13px' } }, reason), actions);
        const cur = replacedBy(c, item);
        const eq = act(cur ? '교체' : '착용', 'primary', () => {
          const r = equip(c, item.Uid);
          toast(r.ok ? `${displayName(item)} 착용` : r.error ?? '');
          done();
        });
        eq.disabled = reason !== null;
        break;
      }
      case 'Consumable': {
        const def = consumableDef(item.TemplateId);
        const use = act('사용', 'primary', () => {
          const r = S.useConsumable(item.Uid);
          toast(r.message);
          done();
        });
        use.disabled = !(this.fromDungeon && def && def.HealRatio > 0 && c.CurrentHp < maxHp(c));
        break;
      }
      case 'SkillBook':
        act('습득', 'primary', () => {
          const r = useSkillBook(c, item.Uid);
          toast(r.ok ? `${skillDef(item.SkillId)!.Name} 스킬을 배웠다! 스킬 화면에서 장착하세요` : r.error ?? '');
          done();
        });
        break;
    }
    if (this.fromDungeon) {
      act('버리기', 'ghost', () => confirmBox('버리기', `${josa(displayName(item), '을/를')} 버릴까요? 되찾을 수 없습니다.`, '버리기', () => {
        takeItem(c.Inventory, item.Uid);
        done();
      }));
    } else {
      act(`${item.Count > 1 ? '판매 · 개당 ' : '판매 · '}${sellPrice(item).toLocaleString('en-US')}G`, 'ghost', () => {
        sell(c, item.Uid, item.Count);
        done();
      });
    }
  }

  private buyBag(): void {
    const c = S.c;
    const price = bagPrice(c);
    const after = Math.min(B.InventoryMax, c.Inventory.Capacity + B.InventoryPerBag);
    confirmBox('가방 확장', `${price.toLocaleString('en-US')}G를 소모하여 가방을 ${after - c.Inventory.Capacity}칸 확장하겠습니까?\n(${c.Inventory.Capacity} → ${after}칸)`, `확장 · ${price.toLocaleString('en-US')}G`, () => {
      const r = buyBag(c);
      if (!r.ok) return toast(r.error ?? '');
      S.save();
      toast(`가방이 ${c.Inventory.Capacity}칸이 됐다`);
      router.rebuild();
    });
  }
}


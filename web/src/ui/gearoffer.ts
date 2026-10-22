import type { Character } from '../core/character';
import { cannotEquipReason, equip, replacedBy, summary } from '../core/equipment';
import type { ItemInstance } from '../core/items';
import { displayName, findItem } from '../core/items';
import { Names } from '../core/names';
import { S } from './game';
import { compareText } from './items';
import { button, h, row } from './kit';
import { modal, toast } from './overlay';
import { router } from './router';

const asked = new Set<string>();

/** 착용할 수 있고(직업·레벨), 빈 칸이거나 한 줄 판정이 +인 장비. */
export function isBetter(c: Character, item: ItemInstance | null): boolean {
  if (!item || item.Kind !== 'Equipment' || !findItem(c.Inventory, item.Uid)) return false;
  if (cannotEquipReason(c, item) != null) return false;
  if (replacedBy(c, item) == null) return true;
  return (summary(c, item)?.delta ?? 0) > 0;
}

/** 지금 장비보다 좋은 장비를 사거나 얻으면 바로 착용할지 묻는다. 같은 장비는 한 번만 묻고, 여럿이면 차례로 묻는다. */
export function offerBetterGear(items: (ItemInstance | null)[], after?: () => void): void {
  const c = S.c;
  const queue = items.filter((i): i is ItemInstance => !!i && !asked.has(i.Uid) && isBetter(c, i));
  next(queue, after);
}

function next(queue: ItemInstance[], after?: () => void): void {
  const c = S.c;
  while (queue.length > 0 && !isBetter(c, queue[0])) queue.shift();
  const item = queue.shift();
  if (!item) {
    after?.();
    return;
  }
  asked.add(item.Uid);
  const cur = replacedBy(c, item);
  const m = modal('더 좋은 장비', false);
  const cmp = compareText(c, item);
  m.body.append(
    h('div', { style: { lineHeight: '1.5' } }, h('b', null, displayName(item)), h('br'),
      cur == null ? `${Names.gear(item.Gear)} 칸이 비어 있습니다` : `착용 중 ${displayName(cur)} 대비 `, cmp, h('br'), '바로 착용할까요?'),
    row(
      button('나중에', () => {
        m.close();
        next(queue, after);
      }, 'ghost', 'grow'),
      button('착용', () => {
        m.close();
        const r = equip(c, item.Uid);
        if (r.ok) {
          S.save();
          toast(`${displayName(item)} 착용`);
          router.rebuild();
        } else toast(r.error ?? '');
        next(queue, after);
      }, 'primary', 'grow')));
}

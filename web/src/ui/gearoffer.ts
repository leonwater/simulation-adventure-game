import type { Character } from '../core/character';
import { cannotEquipReason, compare, equip, replacedBy, summary } from '../core/equipment';
import type { ItemInstance } from '../core/items';
import { displayName, findItem } from '../core/items';
import { josa } from '../core/names';
import { S } from './game';
import { colored, delta, deltaColor, nameColor } from './items';
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
  if (queue.length === 0) return; // 물을 것이 없으면 after(화면 다시 그리기)를 부르지 않는다: 부르면 afterShow가 다시 물으러 와 끝없이 돈다
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
  // 제목 없이: '…을(를) 획득했습니다. / 바로 착용하시겠습니까? / 장착 시 능력치 변화: …'
  const m = modal(null, false);
  const changes = compare(c, item);
  m.body.append(
    h('div', { style: { lineHeight: '1.6', fontSize: '15px' } },
      h('b', { style: { color: nameColor(item) } }, displayName(item)), `${josa(displayName(item), '을/를').slice(displayName(item).length)} 획득했습니다.`, h('br'),
      '바로 착용하시겠습니까?', h('br'),
      '장착 시 능력치 변화: ', ...(changes.length === 0 ? ['없음'] : changes.flatMap((d, i) => [i > 0 ? ', ' : '', `${d.label} `, colored(delta(d.delta), deltaColor(d.delta))]))),
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
          router.rebuild();
        } else toast(r.error ?? '');
        next(queue, after);
      }, 'primary', 'grow')));
}

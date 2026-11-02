import { maxHp } from '../core/character';
import type { ItemInstance } from '../core/items';
import { consumableDef, countOf } from '../core/items';
import { S } from './game';
import { artImg } from './items';
import { button, h } from './kit';
import { modal, toast } from './overlay';

/** 가방의 회복 물약을 종류마다 하나씩 (약한 것부터). */
export function healPotions(): ItemInstance[] {
  const seen = new Set<string>();
  const list: ItemInstance[] = [];
  for (const item of S.c.Inventory.Items) {
    const def = consumableDef(item.TemplateId);
    if (!def || def.HealRatio <= 0 || seen.has(item.TemplateId)) continue;
    seen.add(item.TemplateId);
    list.push(item);
  }
  return list.sort((a, b) => consumableDef(a.TemplateId)!.HealRatio - consumableDef(b.TemplateId)!.HealRatio);
}

/**
 * 모든 화면 공통 물약 버튼. 누르면: 물약이 없으면 알림, HP가 가득이면 알림,
 * 종류가 하나뿐이면 바로 마시고, 여러 종류면 어떤 물약을 마실지 고르는 팝업을 띄운다.
 * use(item): 실제로 마시는 동작 (던전은 바로 사용, 전투는 한 턴을 쓴다).
 * full(): HP가 가득인지 — 전투 중에는 전투 속 HP를 봐야 한다 (캐릭터 HP는 전투가 끝나야 바뀐다).
 */
export function potionButton(use: (item: ItemInstance) => void, className = 'potion', style: Record<string, string> = {}, full = (): boolean => S.c.CurrentHp >= maxHp(S.c)): HTMLElement {
  const potions = healPotions();
  const total = potions.reduce((a, p) => a + countOf(S.c.Inventory, p.TemplateId), 0);
  const b = h('button', { class: className, 'aria-label': '회복 물약', style, on: { click: () => click(use, full) } },
    artImg('potion', 30), h('span', { class: 's' }, potions.length > 0 ? `×${total}` : '없음'));
  if (potions.length === 0 || full()) b.classList.add('off');
  return b;
}

function click(use: (item: ItemInstance) => void, full: () => boolean): void {
  const potions = healPotions();
  if (potions.length === 0) return void toast('회복 물약이 없습니다');
  if (full()) return void toast('HP가 가득 찼습니다');
  if (potions.length === 1) return use(potions[0]);
  const m = modal('어떤 물약을 마실까요?');
  for (const p of potions) {
    const def = consumableDef(p.TemplateId)!;
    m.body.append(button(`${def.Name} ×${countOf(S.c.Inventory, p.TemplateId)} · HP +${Math.round(def.HealRatio * 100)}%`, () => {
      m.close();
      use(p);
    }, '', ''));
  }
}

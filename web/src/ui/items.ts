import type { Character } from '../core/character';
import { findEquipped } from '../core/character';
import { compare, replacedBy, summary } from '../core/equipment';
import type { ItemInstance, ItemContainer } from '../core/items';
import { displayName, isAccessory, isWeapon } from '../core/items';
import { Names } from '../core/names';
import { skillDef } from '../core/skills';
import type { Child } from './kit';
import { h } from './kit';
import { GRADE_COLOR } from './theme';

export type ItemCategory = 'Weapon' | 'Armor' | 'Accessory' | 'Consumable' | 'Other' | 'SkillBook' | 'Stone';
const LEGEND: ItemCategory[] = ['Weapon', 'Armor', 'Accessory', 'Consumable', 'Other', 'SkillBook', 'Stone'];
const CAT_COLOR: Record<ItemCategory, string> = {
  Weapon: '#E8894A', Armor: '#7FA8D8', Accessory: '#C08BE8', Consumable: '#6CC48A', SkillBook: '#5CCAD8', Stone: '#E2B657', Other: '#B08F6A',
};
const CAT_NAME: Record<ItemCategory, string> = { Weapon: '무기', Armor: '방어구', Accessory: '장신구', Consumable: '소모품', SkillBook: '스킬서', Stone: '강화석', Other: '기타' };

/** 글자 한 조각에 색을 입힌다. */
export const colored = (text: string, color: string): HTMLElement => h('span', { style: { color } }, text);
export const RED = 'var(--red-light)';
export const GREEN = 'var(--green)';

export function category(item: ItemInstance): ItemCategory {
  switch (item.Kind) {
    case 'Equipment': return isWeapon(item) ? 'Weapon' : isAccessory(item) ? 'Accessory' : 'Armor';
    case 'Consumable': return 'Consumable';
    case 'SkillBook': return 'SkillBook';
    case 'EnhanceStone': return 'Stone';
    default: return 'Other';
  }
}
export const categoryName = (c: ItemCategory): string => CAT_NAME[c];
export const categoryColor = (c: ItemCategory): string => CAT_COLOR[c];

/** 장비 상세에 쓰는 종류: "방어구 · 투구", "장신구 · 반지", "무기". */
export function gearText(item: ItemInstance): string {
  const cat = category(item);
  return cat === 'Weapon' ? CAT_NAME[cat] : `${CAT_NAME[cat]} · ${Names.gear(item.Gear)}`;
}

/** 장비는 등급 색, 그 외는 기본 글자색. */
export const nameColor = (item: ItemInstance): string => (item.Kind === 'Equipment' ? GRADE_COLOR[item.Grade] : 'var(--text)');

const circle = (color: string, size: number): HTMLElement => h('i', { style: { display: 'inline-block', width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: color, flexShrink: '0' } });

/** 종류 줄: 색 원 + 종류. */
export function kindLine(item: ItemInstance, size = 12): HTMLElement {
  const cat = category(item);
  return h('div', { class: 'row', style: { gap: '4px', fontSize: `${size}px`, color: 'var(--body)', height: `${Math.round(size * 1.4)}px` } }, circle(CAT_COLOR[cat], size * 0.8), CAT_NAME[cat]);
}

const delta = (d: number): string => (d > 0 ? `+${d}` : d < 0 ? `-${-d}` : '±0');
const deltaColor = (d: number): string => (d > 0 ? GREEN : d < 0 ? RED : 'var(--sub)');

/** 착용 중인 장비와 비교 (+초록 / -빨강). 비교할 것이 없으면 null. */
export function compareText(c: Character, item: ItemInstance, withLabel = true): HTMLElement | null {
  const list = compare(c, item);
  if (list.length === 0) return null;
  const el = h('span');
  list.forEach((d, i) => el.append(i ? ' ' : '', colored(`${withLabel ? `${d.label} ` : ''}${delta(d.delta)}`, deltaColor(d.delta))));
  return el;
}

/** 장비 상세에 넣는 비교 줄: "착용 중 강철 장검 대비 공격력 +5". */
export function compareLine(c: Character, item: ItemInstance): HTMLElement | null {
  if (item.Kind !== 'Equipment' || findEquipped(c, item.Uid)) return null;
  const list = compare(c, item);
  if (list.length === 0) return null;
  const cur = replacedName(c, item);
  const head = cur === null ? `${Names.gear(item.Gear)} 칸 비어 있음 · ` : `착용 중 ${cur} 대비 `;
  return h('div', { style: { fontSize: '13px' } }, colored(head, 'var(--sub)'), compareText(c, item));
}
const replacedName = (c: Character, item: ItemInstance): string | null => {
  const cur = replacedBy(c, item);
  return cur ? displayName(cur) : null;
};

/** 장비: "Lv.12 · +5" (레벨이 모자라면 빨강, 비교는 +초록 / -빨강). */
export function levelCompare(c: Character, item: ItemInstance, withLabel = false): HTMLElement {
  const el = h('span');
  el.append(c.Level < item.LevelReq ? colored(`Lv.${item.LevelReq}`, RED) : `Lv.${item.LevelReq}`);
  if (findEquipped(c, item.Uid)) {
    el.append(' · 착용 중');
    return el;
  }
  if (compare(c, item).length === 0) return el;
  const d = summary(c, item);
  if (d) el.append(' · ', colored(`${withLabel ? `${d.label} ` : ''}${delta(d.delta)}`, deltaColor(d.delta)));
  return el;
}

/** 칸의 정보 한 줄: 장비는 착용 레벨과 지금 장비 대비, 스킬서는 등급 · 쓸 수 있는 직업 (내 직업이 아니면 빨강). */
export function infoText(c: Character | null, item: ItemInstance): Child {
  if (item.Kind === 'Equipment' && c) return levelCompare(c, item);
  const def = item.Kind === 'SkillBook' ? skillDef(item.SkillId) : null;
  if (!def) return '';
  if (def.JobRestriction < 0) return `${Names.tier(def.Tier)} · 공용`;
  const jobs = ['Warrior', 'Archer', 'Rogue', 'Mage'] as const;
  const job = Names.job(jobs[def.JobRestriction]);
  const el = h('span', null, `${Names.tier(def.Tier)} · `);
  el.append(c && def.JobRestriction !== jobs.indexOf(c.Job) ? colored(job, RED) : job);
  return el;
}

export const gradeTag = (item: ItemInstance): HTMLElement => colored(`[${Names.grade(item.Grade)}]`, GRADE_COLOR[item.Grade]);

/** 이름 (스킬서는 스킬 이름만). */
export const itemTitle = (item: ItemInstance): string =>
  item.Kind === 'SkillBook' && skillDef(item.SkillId) ? skillDef(item.SkillId)!.Name : displayName(item);

/** 종류 색 안내. */
export function legend(): HTMLElement {
  return h('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, ...LEGEND.map((c) =>
    h('span', { class: 'row', style: { gap: '3px', fontSize: '10px', color: 'var(--sub)' } }, circle(CAT_COLOR[c], 7), CAT_NAME[c])));
}

/** 가방·창고 4열 격자. 칸마다 종류 색 원 + 종류 · 이름(두 줄까지) · 아래 줄(왼쪽 정보 / 오른쪽 개수). */
export function itemGrid(container: ItemContainer, owner: Character | null, onTap: (item: ItemInstance) => void, opts: { selectedUid?: string | null; showEmpty?: boolean } = {}): HTMLElement {
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' } });
  for (const item of container.Items) {
    const sel = item.Uid === opts.selectedUid;
    grid.append(h('button', {
      class: 'card-btn', style: { height: '96px', padding: '6px 6px 10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '3px', borderColor: sel ? 'var(--accent)' : 'var(--card-border)', borderWidth: sel ? '2px' : '1px', overflow: 'hidden' },
      on: { click: () => onTap(item) },
    },
    kindLine(item, 12),
    h('div', { style: { fontSize: '13px', lineHeight: '1.05', maxHeight: '2.2em', overflow: 'hidden', color: nameColor(item), fontWeight: item.Kind === 'Equipment' ? '700' : '400', wordBreak: 'keep-all' } }, itemTitle(item)),
    h('div', { class: 'spacer' }),
    h('div', { class: 'row', style: { gap: '4px', fontSize: '12px', color: 'var(--sub)', height: '16px' } },
      h('span', { class: 'grow', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' } }, infoText(owner, item)),
      item.Count > 1 ? h('b', { style: { color: 'var(--text)' } }, `×${item.Count}`) : null)));
  }
  if (opts.showEmpty !== false) {
    for (let i = container.Items.length; i < container.Capacity; i++) {
      grid.append(h('div', { style: { height: '96px', border: '1px solid var(--card-border)', borderRadius: '8px', background: 'var(--bg)', opacity: '.6' } }));
    }
  }
  return grid;
}

import type { Character } from '../core/character';
import { findEquipped } from '../core/character';
import { compare, replacedBy, summary } from '../core/equipment';
import type { ItemInstance, ItemContainer } from '../core/items';
import { consumableDef, displayName, isAccessory, isWeapon } from '../core/items';
import { JOBS } from '../core/enums';
import { Names } from '../core/names';
import { skillDef } from '../core/skills';
import type { Child } from './kit';
import { h } from './kit';
import { GRADE_COLOR } from './theme';

export type ItemCategory = 'Weapon' | 'Armor' | 'Accessory' | 'Consumable' | 'Other' | 'SkillBook' | 'Stone';
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

/** 장비 상세에 쓰는 종류: "방어구 · 투구", "장신구 · 반지", "무기". */
export function gearText(item: ItemInstance): string {
  const cat = category(item);
  return cat === 'Weapon' ? CAT_NAME[cat] : `${CAT_NAME[cat]} · ${Names.gear(item.Gear)}`;
}

/** 장비는 등급 색, 그 외는 기본 글자색. */
export const nameColor = (item: ItemInstance): string => (item.Kind === 'Equipment' ? GRADE_COLOR[item.Grade] : 'var(--text)');

const circle = (color: string, size: number): HTMLElement => h('i', { style: { display: 'inline-block', width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: color, flexShrink: '0' } });

/** 물품 픽셀 그림 (art/items.px.js → scripts/sprites.sh). 파일 이름 = 부위·무기 직업·소모품 Id·종류 */
const ART: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../assets/items/*.png', { eager: true, import: 'default' })).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]));
const CONSUMABLE_ART = ['potion', 'potion_hi', 'antidote', 'bandage', 'salve'];

export function itemArtKey(item: ItemInstance): string {
  switch (item.Kind) {
    case 'Equipment': return item.Gear === 'Weapon' ? `weapon_${JOBS[Math.max(0, item.JobRestriction)].toLowerCase()}` : item.Gear.toLowerCase();
    case 'Consumable': return CONSUMABLE_ART.includes(item.TemplateId) ? item.TemplateId : 'potion';
    case 'Material': return 'material';
    case 'SkillBook': return 'skillbook';
    default: return 'enhance_stone';
  }
}

/** 물품 그림 (기본 32px = 2배). key = itemArtKey 값 (예: 'potion'). */
export const artImg = (key: string, size = 32): HTMLElement =>
  h('img', { class: 'item-art', src: ART[key] ?? '', alt: '', width: size, height: size, style: { width: `${size}px`, height: `${size}px` } });
export const itemArt = (item: ItemInstance, size = 32): HTMLElement => artImg(itemArtKey(item), size);

/** 카드 바닥 줄 가격 (돈이 모자라면 빨강). */
export const price = (g: number, affordable = true): HTMLElement => h('b', { style: { color: affordable ? 'var(--gold)' : 'var(--red-light)' } }, `${g.toLocaleString('en-US')} G`);

export interface CardOpts {
  /** 이름 아래 한 줄 (장비 비교·효과·보유 수 등). */
  info: Child | Child[];
  /** 맨 아래 줄 (가격 등). 없으면 종류 줄. */
  foot?: Child | Child[];
  onClick?: () => void;
  selected?: boolean;
  /** 그림 칸 오른쪽 위 표시 (선택 √ 등). */
  badge?: Child;
}

/** 물품 카드 (B안 · 등급 배경): 위 = 등급 색 바탕 + 큰 그림(강화 +N · 개수 ×N), 아래 = 이름 · 정보 · 바닥 줄. */
export function itemCard(item: ItemInstance, o: CardOpts): HTMLButtonElement {
  const grade = item.Kind === 'Equipment' ? GRADE_COLOR[item.Grade] : 'var(--card-border)';
  // 스킬서는 스킬 이름만, 강화 수치는 그림 칸에 따로
  const name = item.Kind === 'SkillBook' ? skillDef(item.SkillId)?.Name ?? item.Name : item.Name;
  const list = (c: Child | Child[]): Child[] => (Array.isArray(c) ? c : [c]);
  return h('button', { class: `card-btn icard${o.selected ? ' sel' : ''}`, style: { '--g': grade }, on: o.onClick ? { click: o.onClick } : undefined },
    h('div', { class: 'icard-top' },
      itemArt(item, 48),
      item.Enhance > 0 ? h('b', { class: 'icard-enh' }, `+${item.Enhance}`) : null,
      item.Count > 1 ? h('b', { class: 'icard-cnt' }, `×${item.Count}`) : null,
      o.badge ? h('span', { class: 'icard-badge' }, o.badge) : null),
    h('div', { class: 'icard-body' },
      h('b', { class: 'icard-name', style: { color: nameColor(item) } }, name),
      h('div', { class: 'icard-info' }, ...list(o.info)),
      h('div', { class: 'icard-foot' }, ...(o.foot === undefined ? [kindLine(item, 11)] : list(o.foot)))));
}

/** 종류 줄: 색 원 + 종류. */
export function kindLine(item: ItemInstance, size = 12): HTMLElement {
  const cat = category(item);
  // 스킬서는 등급까지: '하급 스킬서'
  const book = item.Kind === 'SkillBook' ? skillDef(item.SkillId) : null;
  return h('div', { class: 'row', style: { gap: '4px', fontSize: `${size}px`, color: 'var(--body)', height: `${Math.round(size * 1.4)}px`, whiteSpace: 'nowrap' } }, circle(CAT_COLOR[cat], size * 0.8), book ? `${Names.tier(book.Tier)} ${CAT_NAME[cat]}` : CAT_NAME[cat]);
}

export const delta = (d: number): string => (d > 0 ? `+${d}` : d < 0 ? `-${-d}` : '0');
export const deltaColor = (d: number): string => (d > 0 ? GREEN : d < 0 ? RED : 'var(--sub)');

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

/** 장비 칸 위쪽 줄: 지금 장비와 비교한 능력치 변화 ('방어 +6' · 변화 없으면 '방어 0', 착용 중이면 '착용 중'). */
export function compareChip(c: Character, item: ItemInstance): Child {
  if (findEquipped(c, item.Uid)) return '착용 중';
  const d = summary(c, item);
  if (!d) return '';
  const label = d.label === '공격력' ? '공격' : d.label === '방어력' ? '방어' : d.label;
  return colored(`${label} ${delta(d.delta)}`, deltaColor(d.delta));
}

/** 장비 칸 아래쪽 줄의 착용 레벨 (레벨이 모자라면 빨강). 장비가 아니면 빈 글자. */
export function levelChip(c: Character | null, item: ItemInstance): Child {
  if (item.Kind !== 'Equipment') return '';
  return c && c.Level < item.LevelReq ? colored(`Lv.${item.LevelReq}`, RED) : `Lv.${item.LevelReq}`;
}

/** 장비 카드 한 줄: 착용 레벨 먼저, 이어서 지금 장비 대비 능력치 변화 ('Lv.26 방어 +6'). */
export function equipLine(c: Character | null, item: ItemInstance): HTMLElement {
  const el = h('span', { style: { whiteSpace: 'nowrap' } }, levelChip(c, item));
  const cmp = c ? compareChip(c, item) : '';
  if (typeof cmp === 'string' && cmp !== '') el.append(' ', cmp);
  else if (cmp instanceof Node) el.append(' ', cmp);
  return el;
}

/** 소모품 효과 한 줄: 'HP 30% 회복', '독 해제'. */
function shortConsumable(id: string): string {
  const d = consumableDef(id);
  if (!d) return '';
  return d.HealRatio > 0 ? `HP +${Math.round(d.HealRatio * 100)}%` : d.Description;
}

/** 칸의 정보 한 줄: 장비는 착용 레벨과 지금 장비 대비, 스킬서는 등급 · 쓸 수 있는 직업 (내 직업이 아니면 빨강). */
export function infoText(c: Character | null, item: ItemInstance): Child {
  if (item.Kind === 'Equipment') return c ? compareChip(c, item) : '';
  // 능력치 증감이 없는 물품은 짧은 설명 (소모품 효과 · 재료 · 강화석)
  if (item.Kind === 'Consumable') return shortConsumable(item.TemplateId);
  if (item.Kind === 'Material') return '퀘스트 재료';
  if (item.Kind === 'EnhanceStone') return '+6 이상 강화 재료';
  const def = item.Kind === 'SkillBook' ? skillDef(item.SkillId) : null;
  if (!def) return '';
  if (def.JobRestriction < 0) return '공용';
  const jobs = ['Warrior', 'Archer', 'Rogue', 'Mage'] as const;
  const job = Names.job(jobs[def.JobRestriction]);
  return c && def.JobRestriction !== jobs.indexOf(c.Job) ? colored(`${job} 전용`, RED) : `${job} 전용`;
}

export const gradeTag = (item: ItemInstance): HTMLElement => colored(`[${Names.grade(item.Grade)}]`, GRADE_COLOR[item.Grade]);


/** 팔린 칸: 누를 수 없게 어둡게 하고 가운데에 '판매 완료' (상점·떠돌이 상인). */
export function soldOut(cell: HTMLButtonElement): HTMLButtonElement {
  cell.disabled = true;
  cell.style.position = 'relative';
  for (const ch of Array.from(cell.children)) (ch as HTMLElement).style.opacity = '.3';
  cell.append(h('span', { style: { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', color: 'var(--body)', background: 'rgba(15,17,21,.55)', borderRadius: 'inherit', pointerEvents: 'none' } }, '판매 완료'));
  return cell;
}

/** 가방·창고 3열 격자 (상점 카드와 같은 물품 카드). */
export function itemGrid(container: ItemContainer, owner: Character | null, onTap: (item: ItemInstance) => void, opts: { selectedUid?: string | null; showEmpty?: boolean } = {}): HTMLElement {
  // 상점 카드와 같은 크기·배열: 가로 3칸
  const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' } });
  for (const item of container.Items) {
    grid.append(itemCard(item, { info: item.Kind === 'Equipment' ? equipLine(owner, item) : infoText(owner, item), selected: item.Uid === opts.selectedUid, onClick: () => onTap(item) }));
  }
  if (opts.showEmpty !== false) {
    for (let i = container.Items.length; i < container.Capacity; i++) {
      grid.append(h('div', { class: 'icard-empty' }));
    }
  }
  return grid;
}

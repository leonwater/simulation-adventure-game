import { B, rewardLevel, roundEven } from './balance';
import type { Character } from './character';
import { maxChallengeFloor, recalculateCapacities } from './character';
import { createDrop, consumableAt, createConsumable, createEnhanceStone, createSkillBook, rollDropGrade, stonePrice, addItem, canAdd, cloneWithCount, findItem, overConsumableLimit, sellPrice, takeItem, goodMaxBuy, goodUnlimited, newUid } from './items';
import type { ItemInstance, ShopGood } from './items';
import type { ItemGrade } from './enums';
import { rollItemJob } from './jobs';
import { knowsSkill } from './equipment';
import type { Rng } from './rng';
import { obtainableSkills, preferOwnLevel } from './skills';

export interface ShopState {
  Equipment: ItemInstance[];
  Goods: ShopGood[];
  /** 마지막 자동 갱신 시각 (UTC ticks). */
  LastRefreshTicks: number;
  /** 갱신 비용 배수 횟수. */
  RerollCount: number;
  Initialized: boolean;
  /** 이번 진열에서 팔린 장비 (칸은 '판매 완료'로 남는다). 갱신하면 비운다. */
  SoldUids?: string[];
}
export const newShopState = (): ShopState => ({ Equipment: [], Goods: [], LastRefreshTicks: 0, RerollCount: 0, Initialized: false, SoldUids: [] });
/** 장비 칸이 팔렸는지. */
export const isSold = (s: ShopState, uid: string): boolean => !!s.SoldUids && s.SoldUids.includes(uid);
/** 소모품·스킬서 칸이 다 팔렸는지 (재고 0). */
export const isSoldOut = (g: ShopGood): boolean => g.Stock === 0;

/** C# DateTime.Ticks (0001-01-01 기준 100ns 단위). 값이 커서 아래 자릿수는 부정확하다. */
export const toTicks = (d: Date): number => (d.getTime() + 62135596800000) * 10000;

const OPTIONAL = ['potion_hi', 'bandage', 'salve'];
/** 고급 회복 물약은 일정 층부터 상점·상인에 나온다 (그 전에는 드롭으로만). */
export const sellsHighPotion = (floor: number): boolean => floor >= B.HighPotionFirstFloor;

/** 처음 한 번만 물건을 채운다 (시간이 지나도 저절로 바뀌지 않는다). 채웠으면 true. */
export function ensureStocked(s: ShopState, c: Character, now: Date, rng: Rng): boolean {
  if (s.Initialized) return false;
  s.Initialized = true;
  s.LastRefreshTicks = toTicks(now);
  s.RerollCount = 0;
  restock(s, c, rng);
  return true;
}

/** 던전에서 돌아오면 갱신 비용이 처음 값(100G)으로 돌아간다. */
export const resetRerollCost = (s: ShopState): void => {
  s.RerollCount = 0;
};
export const rerollCost = (s: ShopState): number => B.ShopRerollBaseCost * Math.pow(2, Math.min(20, s.RerollCount));

export function reroll(s: ShopState, c: Character, rng: Rng): { ok: boolean; error: string | null } {
  const cost = rerollCost(s);
  if (c.Gold < cost) return { ok: false, error: '골드가 부족합니다' };
  c.Gold -= cost;
  s.RerollCount++;
  s.LastRefreshTicks += 1000; // 알림 점: 바뀐 물건을 아직 보지 않았다
  restock(s, c, rng);
  return { ok: true, error: null };
}

/** 상점 장비 등급: 보통 일반·고급, 아주 가끔 희귀(5층~)·영웅(12층~). 상점에서는 레벨이 낮다고 등급이 오르지 않고 전설은 나오지 않는다. */
export function shopGrade(rng: Rng, floor: number): ItemGrade {
  if (floor >= B.GradeFirstFloor[3] && rng.chance(B.ShopEpicChance)) return 'Epic';
  if (floor >= B.GradeFirstFloor[2] && rng.chance(B.ShopRareChance)) return 'Rare';
  return rng.chance(0.3) ? 'Uncommon' : 'Common';
}

export function restock(s: ShopState, c: Character, rng: Rng): void {
  const floor = Math.max(1, maxChallengeFloor(c));
  s.Equipment = [];
  s.SoldUids = [];
  for (let i = 0; i < B.ShopEquipmentSlots; i++) {
    s.Equipment.push(createDrop(rng, shopGrade(rng, floor), floor, c, false));
  }
  s.Goods = [];
  s.Goods.push({ Item: consumableAt('potion', floor), Stock: -1 });
  s.Goods.push({ Item: createConsumable('antidote'), Stock: -1 });
  const optional = OPTIONAL.filter((id) => id !== 'potion_hi' || sellsHighPotion(floor));
  rng.shuffle(optional);
  s.Goods.push({ Item: consumableAt(optional[0], floor), Stock: -1 });
  // 강화석은 필요해지는 층(10층)부터 상점에서 판다
  if (floor >= B.StoneFirstFloor) s.Goods.push({ Item: { ...createEnhanceStone(), Price: stonePrice(floor) }, Stock: -1 });
  // 하급·중급 스킬서 2권: 권마다 지금 직업 70%·다른 직업 각 10%, 아직 배우지 않은 것 · 같은 책은 한 권만
  for (let i = 0; i < 2; i++) {
    let books = obtainableSkills(c.Level, rollItemJob(c.Job, rng), ['Low', 'Mid']);
    books = books.filter((b) => !knowsSkill(c, b.Id) && !s.Goods.some((g) => g.Item.SkillId === b.Id));
    books = preferOwnLevel(books, c.Level, rng);
    if (books.length > 0) s.Goods.push({ Item: createSkillBook(rng.pick(books).Id), Stock: 1 });
  }
  for (let i = 1; s.Goods.length < B.ShopGoodsSlots + (floor >= B.StoneFirstFloor ? 1 : 0) && i < optional.length; i++) s.Goods.push({ Item: consumableAt(optional[i], floor), Stock: -1 });
}

/** 떠돌이 상인의 덤: 낮은 확률로 장비 1점(정예 드롭 등급)·스킬서 1권 (아직 배우지 않은 하급~상급). 재고 1. */
export function merchantExtras(goods: ShopGood[], c: Character, floor: number, rng: Rng): void {
  if (rng.chance(B.MerchantEquipChance)) goods.push({ Item: createDrop(rng, rollDropGrade(rng, floor, 1), floor, c), Stock: 1 });
  if (rng.chance(B.MerchantBookChance)) {
    const lv = rewardLevel(c.Level, floor);
    let books = obtainableSkills(lv, rollItemJob(c.Job, rng), ['Low', 'Mid', 'High']).filter((b) => !knowsSkill(c, b.Id));
    books = preferOwnLevel(books, lv, rng);
    if (books.length > 0) goods.push({ Item: createSkillBook(rng.pick(books).Id), Stock: 1 });
  }
}

/**
 * 마을에 돌아올 때마다 물약·강화석 칸만 지금 도전 층 가격으로 맞춘다 (장비는 그대로).
 * 갱신을 하지 않아도 물약 값이 층을 따라가고, 10층에 닿으면 강화석이 진열된다.
 */
export function refreshPrices(s: ShopState, c: Character): void {
  const floor = Math.max(1, maxChallengeFloor(c));
  for (const g of s.Goods) {
    if (g.Item.Kind === 'Consumable') g.Item.Price = consumableAt(g.Item.TemplateId, floor).Price;
    else if (g.Item.Kind === 'EnhanceStone') g.Item.Price = stonePrice(floor);
  }
  if (floor >= B.StoneFirstFloor && !s.Goods.some((g) => g.Item.Kind === 'EnhanceStone')) s.Goods.push({ Item: { ...createEnhanceStone(), Price: stonePrice(floor) }, Stock: -1 });
}

/** 가방 확장 값: 200G에서 시작해 늘릴 때마다 1.6배 (12→16칸보다 16→20칸이 비싸다). */
export const bagPrice = (c: Character): number => roundEven(B.BagBasePrice * Math.pow(B.BagPriceGrowth, Math.min(30, c.BagsBought)));
export const canBuyBag = (c: Character): boolean => c.Inventory.Capacity < B.InventoryMax;

export function buyBag(c: Character): { ok: boolean; error: string | null } {
  if (!canBuyBag(c)) return { ok: false, error: '가방을 더 늘릴 수 없습니다' };
  const price = bagPrice(c);
  if (c.Gold < price) return { ok: false, error: '골드가 부족합니다' };
  c.Gold -= price;
  c.BagsBought++;
  recalculateCapacities(c);
  return { ok: true, error: null };
}

function pay(c: Character, price: number, item: ItemInstance): { ok: boolean; error: string | null } {
  if (c.Gold < price) return { ok: false, error: '골드가 부족합니다' };
  if (!canAdd(c.Inventory, item)) {
    return { ok: false, error: overConsumableLimit(c.Inventory, item) ? `소모품은 종류마다 ${B.MaxConsumable}개까지 가질 수 있습니다` : '가방이 가득 찼습니다' };
  }
  c.Gold -= price;
  return { ok: true, error: null };
}

export function buyEquipment(s: ShopState, c: Character, uid: string): { ok: boolean; error: string | null } {
  const item = s.Equipment.find((i) => i.Uid === uid);
  if (!item || isSold(s, uid)) return { ok: false, error: '이미 팔린 물건입니다' };
  const r = pay(c, item.Price, item);
  if (!r.ok) return r;
  // 칸은 '판매 완료'로 남기고, 가방에는 새 번호를 붙인 같은 장비를 넣는다
  (s.SoldUids ??= []).push(uid);
  addItem(c.Inventory, { ...item, Uid: newUid() });
  return r;
}

export function buyGood(s: ShopState, c: Character, uid: string, count: number, priceMultiplier = 1): { ok: boolean; error: string | null } {
  const good = s.Goods.find((g) => g.Item.Uid === uid);
  if (!good || isSoldOut(good)) return { ok: false, error: '이미 팔린 물건입니다' };
  if (good.Item.Kind === 'SkillBook' && knowsSkill(c, good.Item.SkillId)) return { ok: false, error: '이미 배운 스킬입니다' };
  count = Math.max(1, Math.min(count, goodMaxBuy(good)));
  const item = cloneWithCount(good.Item, count);
  const price = roundEven(good.Item.Price * priceMultiplier) * count;
  const r = pay(c, price, item);
  if (!r.ok) return r;
  addItem(c.Inventory, item);
  if (!goodUnlimited(good)) {
    good.Stock = Math.max(0, good.Stock - count); // 0이 되면 칸은 '판매 완료'로 남는다
  }
  return r;
}

/** 가방의 아이템을 판다 (장착 중인 장비는 팔 수 없음). */
export function sell(c: Character, uid: string, count: number): { ok: boolean; error: string | null } {
  const item = findItem(c.Inventory, uid);
  if (!item) return { ok: false, error: '가방에 없는 아이템입니다' };
  count = Math.max(1, Math.min(count, item.Count));
  const taken = takeItem(c.Inventory, uid, count)!;
  c.Gold += sellPrice(taken) * taken.Count;
  return { ok: true, error: null };
}

/** 여러 칸을 한 번에 판다 (칸마다 전부). 받은 골드 합계를 돌려준다. */
export function sellMany(c: Character, uids: Iterable<string>): number {
  const before = c.Gold;
  for (const uid of uids) {
    const item = findItem(c.Inventory, uid);
    if (item) sell(c, uid, item.Count);
  }
  return c.Gold - before;
}

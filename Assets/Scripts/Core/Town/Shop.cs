using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    [Serializable]
    public class ShopGood
    {
        public ItemInstance Item;
        /// <summary>남은 수량 (−1 = 제한 없음). 마을 소모품은 제한 없음, 스킬서는 1권, 던전 상인 물건은 2~5개.</summary>
        public int Stock = -1;

        public bool Unlimited => Stock < 0;

        /// <summary>한 번에 살 수 있는 최대 개수.</summary>
        public int MaxBuy => Unlimited ? GameBalance.MaxStack : Stock;
    }

    [Serializable]
    public class ShopState
    {
        public List<ItemInstance> Equipment = new List<ItemInstance>();
        public List<ShopGood> Goods = new List<ShopGood>();
        /// <summary>마지막 자동 갱신 시각 (UTC ticks).</summary>
        public long LastRefreshTicks;
        /// <summary>자동 갱신 이후 즉시 갱신한 횟수.</summary>
        public int RerollCount;
        public bool Initialized;
    }

    /// <summary>
    /// 상점: 장비 6칸 + 소모품·스킬서 6칸 + 가방.
    /// 실제 시간 30분마다 자동 갱신(앱 종료 시간 포함), 골드로 즉시 갱신 가능 (100G부터 2배, 자동 갱신 시 초기화).
    /// </summary>
    public static class ShopSystem
    {
        private static readonly string[] OptionalConsumables = { "potion_hi", "bandage", "salve" };

        public static TimeSpan TimeUntilRefresh(ShopState s, DateTime nowUtc)
        {
            var next = new DateTime(s.LastRefreshTicks, DateTimeKind.Utc) + GameBalance.ShopRefreshInterval;
            var left = next - nowUtc;
            return left < TimeSpan.Zero ? TimeSpan.Zero : left;
        }

        /// <summary>자동 갱신 시각이 지났으면 재고를 바꾼다. 갱신했으면 true.</summary>
        public static bool EnsureFresh(ShopState s, Character c, DateTime nowUtc, Rng rng)
        {
            if (!s.Initialized)
            {
                s.Initialized = true;
                s.LastRefreshTicks = nowUtc.Ticks;
                s.RerollCount = 0;
                Restock(s, c, rng);
                return true;
            }
            long interval = GameBalance.ShopRefreshInterval.Ticks;
            long elapsed = nowUtc.Ticks - s.LastRefreshTicks;
            if (elapsed < 0)
            {
                // 기기 시계가 뒤로 간 경우: 기준 시각만 맞춘다.
                s.LastRefreshTicks = nowUtc.Ticks;
                return false;
            }
            if (elapsed < interval) return false;
            s.LastRefreshTicks += elapsed / interval * interval;
            s.RerollCount = 0;
            Restock(s, c, rng);
            return true;
        }

        public static int RerollCost(ShopState s) => GameBalance.ShopRerollBaseCost << Math.Min(20, s.RerollCount);

        public static bool Reroll(ShopState s, Character c, Rng rng, out string error)
        {
            int cost = RerollCost(s);
            if (c.Gold < cost)
            {
                error = "골드가 부족합니다";
                return false;
            }
            c.Gold -= cost;
            s.RerollCount++;
            Restock(s, c, rng);
            error = null;
            return true;
        }

        public static void Restock(ShopState s, Character c, Rng rng)
        {
            int floor = Math.Max(1, c.MaxChallengeFloor);
            s.Equipment.Clear();
            for (int i = 0; i < GameBalance.ShopEquipmentSlots; i++)
            {
                var grade = rng.Chance(0.3) ? ItemGrade.Uncommon : ItemGrade.Common;
                s.Equipment.Add(EquipmentFactory.CreateDrop(rng, grade, floor, c));
            }

            s.Goods.Clear();
            s.Goods.Add(new ShopGood { Item = ItemDb.CreateConsumable("potion") });
            s.Goods.Add(new ShopGood { Item = ItemDb.CreateConsumable("antidote") });
            var optional = new List<string>(OptionalConsumables);
            rng.Shuffle(optional);
            s.Goods.Add(new ShopGood { Item = ItemDb.CreateConsumable(optional[0]) });

            // 하급·중급 스킬서 2권: 권마다 지금 직업 70%·다른 직업 각 10%, 아직 배우지 않은 것 · 같은 책은 한 권만
            for (int i = 0; i < 2; i++)
            {
                var books = SkillDb.Obtainable(c, JobData.RollItemJob(c.Job, rng), SkillTier.Low, SkillTier.Mid);
                books.RemoveAll(b => c.Skills.Knows(b.Id) || s.Goods.Exists(g => g.Item.SkillId == b.Id));
                books = SkillDb.PreferOwnLevel(books, c, rng);
                if (books.Count > 0) s.Goods.Add(new ShopGood { Item = ItemDb.CreateSkillBook(rng.Pick(books).Id), Stock = 1 });
            }
            for (int i = 1; s.Goods.Count < GameBalance.ShopGoodsSlots && i < optional.Count; i++)
                s.Goods.Add(new ShopGood { Item = ItemDb.CreateConsumable(optional[i]) });
        }

        public static int BagPrice(Character c) => GameBalance.BagBasePrice << Math.Min(20, c.BagsBought);

        public static bool CanBuyBag(Character c) => c.Inventory.Capacity < GameBalance.InventoryMax;

        public static bool BuyBag(Character c, out string error)
        {
            if (!CanBuyBag(c))
            {
                error = "가방을 더 늘릴 수 없습니다";
                return false;
            }
            int price = BagPrice(c);
            if (c.Gold < price)
            {
                error = "골드가 부족합니다";
                return false;
            }
            c.Gold -= price;
            c.BagsBought++;
            c.RecalculateCapacities();
            error = null;
            return true;
        }

        public static bool BuyEquipment(ShopState s, Character c, string uid, out string error)
        {
            var item = s.Equipment.Find(i => i.Uid == uid);
            if (item == null)
            {
                error = "이미 팔린 물건입니다";
                return false;
            }
            if (!Pay(c, item.Price, item, out error)) return false;
            s.Equipment.Remove(item);
            c.Inventory.Add(item);
            return true;
        }

        public static bool BuyGood(ShopState s, Character c, string uid, int count, out string error, double priceMultiplier = 1.0)
        {
            var good = s.Goods.Find(g => g.Item.Uid == uid);
            if (good == null)
            {
                error = "이미 팔린 물건입니다";
                return false;
            }
            if (good.Item.Kind == ItemKind.SkillBook && c.Skills.Knows(good.Item.SkillId))
            {
                error = "이미 배운 스킬입니다";
                return false;
            }
            count = Math.Max(1, Math.Min(count, good.MaxBuy));
            var item = good.Item.CloneWithCount(count);
            int price = (int)Math.Round(good.Item.Price * priceMultiplier) * count;
            if (!Pay(c, price, item, out error)) return false;
            c.Inventory.Add(item);
            if (!good.Unlimited)
            {
                good.Stock -= count;
                if (good.Stock <= 0) s.Goods.Remove(good);
            }
            return true;
        }

        private static bool Pay(Character c, int price, ItemInstance item, out string error)
        {
            if (c.Gold < price)
            {
                error = "골드가 부족합니다";
                return false;
            }
            if (!c.Inventory.CanAdd(item))
            {
                error = "가방이 가득 찼습니다";
                return false;
            }
            c.Gold -= price;
            error = null;
            return true;
        }

        /// <summary>여러 칸을 한 번에 판다 (칸마다 전부). 받은 골드 합계를 돌려준다.</summary>
        public static long SellMany(Character c, IEnumerable<string> uids)
        {
            long before = c.Gold;
            foreach (var uid in uids)
            {
                var item = c.Inventory.Find(uid);
                if (item != null) Sell(c, uid, item.Count, out _);
            }
            return c.Gold - before;
        }

        /// <summary>가방의 아이템을 판다 (장착 중인 장비는 팔 수 없음).</summary>
        public static bool Sell(Character c, string uid, int count, out string error)
        {
            var item = c.Inventory.Find(uid);
            if (item == null)
            {
                error = "가방에 없는 아이템입니다";
                return false;
            }
            count = Math.Max(1, Math.Min(count, item.Count));
            var taken = c.Inventory.Take(uid, count);
            c.Gold += (long)taken.SellPrice * taken.Count;
            error = null;
            return true;
        }
    }
}

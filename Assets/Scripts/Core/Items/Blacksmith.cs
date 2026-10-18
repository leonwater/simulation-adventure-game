using System;

namespace Adventure.Core
{
    public enum EnhanceResult
    {
        Success,
        Failed,
        NotAllowed
    }

    /// <summary>대장간 장비 강화 +0 ~ +10. 실패해도 장비는 파괴되지 않고 재료·골드만 소모한다.</summary>
    public static class Blacksmith
    {
        public static int GoldCost(ItemInstance item) =>
            GameBalance.EnhanceGoldPerLevel * (item.Enhance + 1) * ((int)item.Grade + 1);

        public static int StoneCost(ItemInstance item) =>
            item.Enhance >= GameBalance.MaxEnhance ? 0 : GameBalance.EnhanceStones[item.Enhance + 1];

        public static double SuccessRate(ItemInstance item) =>
            item.Enhance >= GameBalance.MaxEnhance ? 0 : GameBalance.EnhanceSuccess[item.Enhance + 1];

        /// <summary>장착 중이거나 가방에 있는 장비를 찾는다.</summary>
        public static ItemInstance FindGear(Character c, string uid)
        {
            var item = c.Equipment.Find(uid) ?? c.Inventory.Find(uid);
            return item != null && item.Kind == ItemKind.Equipment ? item : null;
        }

        public static string CannotEnhanceReason(Character c, ItemInstance item)
        {
            if (item == null || item.Kind != ItemKind.Equipment) return "장비가 아닙니다";
            if (item.Enhance >= GameBalance.MaxEnhance) return "최대 강화 단계입니다";
            if (c.Gold < GoldCost(item)) return "골드가 부족합니다";
            if (c.Inventory.CountOf(ItemDb.EnhanceStoneId) < StoneCost(item)) return "강화석이 부족합니다";
            return null;
        }

        public static EnhanceResult Enhance(Character c, string uid, Rng rng, out string error)
        {
            var item = FindGear(c, uid);
            error = CannotEnhanceReason(c, item);
            if (error != null) return EnhanceResult.NotAllowed;
            c.Gold -= GoldCost(item);
            int stones = StoneCost(item);
            if (stones > 0) c.Inventory.RemoveTemplate(ItemDb.EnhanceStoneId, stones);
            if (!rng.Chance(SuccessRate(item))) return EnhanceResult.Failed;
            item.Enhance++;
            c.CurrentHp = Math.Min(c.CurrentHp, CharacterStats.MaxHp(c));
            return EnhanceResult.Success;
        }
    }
}

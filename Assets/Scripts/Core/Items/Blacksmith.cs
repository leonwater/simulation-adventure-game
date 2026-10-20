using System;

namespace Adventure.Core
{
    public enum EnhanceResult
    {
        Success,
        Failed,
        /// <summary>실패하고 한 단계 내려감 (+7 이상 도전).</summary>
        Downgraded,
        NotAllowed
    }

    /// <summary>
    /// 대장간 장비 강화 +0 ~ +15. 장비는 파괴되지 않는다. +7 이상에 도전해 실패하면 일정 확률(30%, +11부터 50%)로 한 단계 내려간다 (v1.9).
    /// </summary>
    public static class Blacksmith
    {
        public static int GoldCost(ItemInstance item) => CostFor(item, item.Enhance + 1);

        /// <summary>목표 단계 target으로 올리는 비용 = 30 × 목표 단계 × (1 + 착용 레벨 ÷ 10) × 등급 배율.</summary>
        private static int CostFor(ItemInstance item, int target) =>
            (int)Math.Round(GameBalance.EnhanceGoldBase * target * (1 + item.LevelReq / 10.0) * GameBalance.EnhanceGradeCost[(int)item.Grade]);

        /// <summary>지금 강화 단계까지 들어간 골드 (성공한 단계 기준).</summary>
        public static int GoldSpent(ItemInstance item)
        {
            int sum = 0;
            for (int t = 1; t <= item.Enhance; t++) sum += CostFor(item, t);
            return sum;
        }

        public static int StoneCost(ItemInstance item) =>
            item.Enhance >= GameBalance.MaxEnhance ? 0 : GameBalance.EnhanceStones[item.Enhance + 1];

        /// <summary>이번 도전에 실패하면 한 단계 내려갈 확률.</summary>
        public static double DowngradeChance(ItemInstance item) =>
            item.Enhance >= GameBalance.MaxEnhance ? 0 : GameBalance.EnhanceDowngradeChance(item.Enhance + 1);

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
            if (!rng.Chance(SuccessRate(item)))
            {
                if (!rng.Chance(DowngradeChance(item))) return EnhanceResult.Failed;
                item.Enhance--;
                c.CurrentHp = Math.Min(c.CurrentHp, CharacterStats.MaxHp(c));
                return EnhanceResult.Downgraded;
            }
            item.Enhance++;
            c.CurrentHp = Math.Min(c.CurrentHp, CharacterStats.MaxHp(c));
            return EnhanceResult.Success;
        }
    }
}

using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    public class LootReport
    {
        public long Gold;
        public long Exp;
        public List<ItemInstance> Items = new List<ItemInstance>();
        /// <summary>가방이 가득 차 줍지 못한 아이템.</summary>
        public List<ItemInstance> Dropped = new List<ItemInstance>();
        public int LevelsGained;

        public bool IsEmpty => Gold == 0 && Exp == 0 && Items.Count == 0;

        /// <summary>예: "골드 120 · 경험치 300 · 강철 장검, 회복 물약 ×2"</summary>
        public string Describe()
        {
            var parts = new List<string>();
            if (Gold != 0) parts.Add("골드 " + Gold.ToString("#,0"));
            if (Exp != 0) parts.Add("경험치 " + Exp.ToString("#,0"));
            if (Items.Count > 0) parts.Add(LootSystem.Names(Items));
            if (Dropped.Count > 0) parts.Add("가방이 가득 차 " + Names.Josa(LootSystem.Names(Dropped), "을/를") + " 두고 왔다");
            return parts.Count == 0 ? "아무것도 얻지 못했다" : string.Join(" · ", parts);
        }
    }

    /// <summary>보물 방·이벤트·적 처치 보상.</summary>
    public static class LootSystem
    {
        public static string Names(List<ItemInstance> items, int max = 99)
        {
            var names = new List<string>();
            foreach (var i in items)
            {
                if (names.Count >= max) break;
                names.Add(i.Count > 1 ? i.DisplayName + " ×" + i.Count : i.DisplayName);
            }
            string s = string.Join(", ", names);
            if (items.Count > max) s += " 외 " + (items.Count - max) + "개";
            return s;
        }

        public static ItemInstance RandomEquipment(int floor, Character c, Rng rng, int bossLevel)
        {
            var grade = EquipmentFactory.RollDropGrade(rng, floor, bossLevel);
            int lv = EquipmentFactory.ItemLevelForFloor(floor, rng);
            return EquipmentFactory.CreateRandom(rng, grade, lv, c.Job, 0.7);
        }

        /// <summary>
        /// 스킬서 드롭: 자기 직업 스킬 중 장착 레벨이 지금 레벨 + 5 이하인 것만 (기획서 v1.4).
        /// 그중 가장 높은 단계를 우선하고(최상급은 25% 확률로만), 아직 배우지 않은 스킬을 먼저 고른다.
        /// </summary>
        public static ItemInstance HighSkillBook(Character c, Rng rng)
        {
            var list = SkillDb.Obtainable(c);
            var best = SkillTier.Low;
            foreach (var s in list)
                if (s.Tier > best && (s.Tier != SkillTier.Top || rng.Chance(0.25))) best = s.Tier;
            var pick = list.FindAll(s => s.Tier == best);
            var unknown = pick.FindAll(s => !c.Skills.Knows(s.Id));
            return ItemDb.CreateSkillBook(rng.Pick(unknown.Count > 0 ? unknown : pick).Id);
        }

        public static LootReport Treasure(int floor, Character c, Rng rng)
        {
            var r = new LootReport { Gold = GameBalance.EnemyGold(floor) * rng.RangeInclusive(5, 8) };
            if (rng.Chance(0.6)) r.Items.Add(RandomEquipment(floor, c, rng, 1));
            if (rng.Chance(0.35)) r.Items.Add(ItemDb.CreateConsumable(rng.Chance(0.7) ? "potion" : "potion_hi", rng.RangeInclusive(1, 2)));
            if (rng.Chance(0.15)) r.Items.Add(ItemDb.CreateEnhanceStone());
            if (rng.Chance(0.05)) r.Items.Add(HighSkillBook(c, rng));
            return r;
        }

        public static ItemInstance CreateEventReward(EventReward reward, int floor, Character c, Rng rng)
        {
            switch (reward)
            {
                case EventReward.Potion: return ItemDb.CreateConsumable("potion");
                case EventReward.HighPotion: return ItemDb.CreateConsumable("potion_hi");
                case EventReward.Equipment: return RandomEquipment(floor, c, rng, 1);
                case EventReward.HighSkillBook: return HighSkillBook(c, rng);
                case EventReward.EnhanceStone: return ItemDb.CreateEnhanceStone();
                default: return null;
            }
        }

        /// <summary>보상을 캐릭터에 넣는다. 들어가지 않는 아이템은 Dropped로 옮긴다.</summary>
        public static void Apply(Character c, DungeonRun run, LootReport report)
        {
            if (report.Gold != 0)
            {
                c.Gold = Math.Max(0, c.Gold + report.Gold);
                if (run != null && report.Gold > 0) run.GoldEarned += report.Gold;
            }
            if (report.Exp > 0)
            {
                report.LevelsGained += Leveling.AddExp(c, report.Exp);
                if (run != null) run.ExpEarned += report.Exp;
            }
            var kept = new List<ItemInstance>();
            foreach (var item in report.Items)
            {
                string label = item.Count > 1 ? item.DisplayName + " ×" + item.Count : item.DisplayName;
                if (c.Inventory.Add(item))
                {
                    kept.Add(item);
                    run?.Loot.Add(label);
                }
                else report.Dropped.Add(item);
            }
            report.Items = kept;
        }
    }
}

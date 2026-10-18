using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    public class DeathReport
    {
        public int Floor;
        public string KilledBy = "";
        public long GoldLost;
        public long ExpLost;
        public List<ItemInstance> ItemsLost = new List<ItemInstance>();
        public int EquippedKept;
        public bool HardcoreReset;
        // 패배 화면 비교표 (이전 → 현재)
        public long GoldBefore, GoldAfter;
        public double ExpPctBefore, ExpPctAfter;
        public int BagBefore, BagAfter;
        public int RoomsExplored, RoomsTotal;
        public int StorageCount;
    }

    public class ReturnReport
    {
        public int Floor;
        public bool BossCleared;
        public long GoldEarned;
        public long ExpEarned;
        public int Rooms;
        public List<string> Loot = new List<string>();
    }

    /// <summary>귀환·사망 정산.</summary>
    public static class Settlement
    {
        /// <summary>
        /// 사망 (하드코어 제외): 도달 층 유지, 그 층 진행도 초기화, 골드 −30%, 경험치 −20% (레벨 유지),
        /// 장착하지 않은 가방 아이템 전부 손실. 창고와 가방 확장은 유지.
        /// </summary>
        public static DeathReport Die(Character c, DungeonRun run, Difficulty difficulty, string killedBy)
        {
            var report = new DeathReport
            {
                Floor = run?.Floor ?? 0,
                KilledBy = killedBy ?? "",
                GoldBefore = c.Gold,
                ExpPctBefore = Leveling.ExpProgress(c),
                BagBefore = c.Inventory.Items.Count,
                RoomsExplored = run?.RoomsExplored ?? 0,
                RoomsTotal = run == null ? 0 : run.Map.Rooms.Count - 1,
                StorageCount = c.Storage.Items.Count,
            };
            if (difficulty == Difficulty.Hardcore)
            {
                report.HardcoreReset = true;
                return report;
            }
            report.GoldLost = (long)Math.Round(c.Gold * GameBalance.DeathGoldLoss);
            c.Gold -= report.GoldLost;
            report.ExpLost = Leveling.ApplyDeathExpLoss(c);
            report.ItemsLost.AddRange(c.Inventory.Items);
            c.Inventory.Clear();
            report.EquippedKept = c.Equipment.EquippedCount;
            c.CurrentHp = CharacterStats.MaxHp(c);
            report.GoldAfter = c.Gold;
            report.ExpPctAfter = Leveling.ExpProgress(c);
            report.BagAfter = c.Inventory.Items.Count;
            return report;
        }

        /// <summary>마을 귀환. 보스 클리어 후면 다음 층이 열려 있고, 그 외에는 그 층 진행도만 초기화된다.</summary>
        public static ReturnReport Return(Character c, DungeonRun run)
        {
            var report = new ReturnReport
            {
                Floor = run.Floor,
                BossCleared = run.BossDefeated,
                GoldEarned = run.GoldEarned,
                ExpEarned = run.ExpEarned,
                Rooms = run.RoomsExplored,
                Loot = new List<string>(run.Loot),
            };
            c.CurrentHp = CharacterStats.MaxHp(c);
            return report;
        }
    }
}

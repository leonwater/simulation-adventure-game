namespace Adventure.Core
{
    /// <summary>승급 조건 하나의 진행 상황.</summary>
    public struct PromotionStatus
    {
        public Rank Next;
        public int FloorRequired, FloorCurrent;
        public int LevelRequired, LevelCurrent;
        public int QuestsRequired, QuestsCurrent;
        public bool IsMaxRank;

        public bool FloorMet => FloorCurrent >= FloorRequired;
        public bool LevelMet => LevelCurrent >= LevelRequired;
        public bool QuestsMet => QuestsCurrent >= QuestsRequired;
        public bool CanPromote => !IsMaxRank && FloorMet && LevelMet && QuestsMet;
    }

    /// <summary>모험가 등급 F~SS. 세 조건을 모두 충족하면 자동으로 승급한다 (v1.8, GameSession.Save). 강등 없음.</summary>
    public static class RankSystem
    {
        public const Rank MaxRank = Rank.SS;

        public static double BadgeBonus(Rank rank) => GameBalance.BadgeBonus[(int)rank];

        public static int SkillSlots(Rank rank) => GameBalance.SkillSlots[(int)rank];

        public static int StorageCapacity(Rank rank) => GameBalance.StorageBase + GameBalance.StoragePerRank * (int)rank;

        public static PromotionStatus GetStatus(Character c)
        {
            var s = new PromotionStatus
            {
                FloorCurrent = c.HighestFloorCleared,
                LevelCurrent = c.Level,
                QuestsCurrent = c.QuestsCompleted,
            };
            if (c.Rank >= MaxRank)
            {
                s.IsMaxRank = true;
                s.Next = MaxRank;
                return s;
            }
            s.Next = c.Rank + 1;
            int idx = (int)s.Next;
            s.FloorRequired = GameBalance.PromotionRequirements[idx, 0];
            s.LevelRequired = GameBalance.PromotionRequirements[idx, 1];
            s.QuestsRequired = GameBalance.PromotionRequirements[idx, 2];
            return s;
        }

        public static bool TryPromote(Character c)
        {
            if (!GetStatus(c).CanPromote) return false;
            c.Rank++;
            c.RecalculateCapacities();
            return true;
        }
    }
}

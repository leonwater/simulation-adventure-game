using System;

namespace Adventure.Core
{
    /// <summary>모험가 한 명의 영구 데이터. 저장 파일에 그대로 들어간다.</summary>
    [Serializable]
    public class Character
    {
        public string Name = "";
        public Job Job;
        public int Level = 1;
        /// <summary>현재 레벨에서 쌓인 경험치.</summary>
        public long Exp;
        public int UnspentPoints;
        /// <summary>시작 능력치 + 레벨업으로 배분한 능력치. 배지·장비는 포함하지 않는다.</summary>
        public StatBlock BaseStats = new StatBlock();
        public long Gold;
        public Rank Rank = Rank.F;
        /// <summary>보스를 처치해 돌파한 가장 깊은 층 (0 = 없음).</summary>
        public int HighestFloorCleared;
        public int QuestsCompleted;
        public int CurrentHp;

        public Equipment Equipment = new Equipment();
        public ItemContainer Inventory = new ItemContainer { Capacity = GameBalance.InventoryStart };
        /// <summary>길드 창고. 사망해도 잃지 않는다.</summary>
        public ItemContainer Storage = new ItemContainer { Capacity = GameBalance.StorageBase };
        public SkillSet Skills = new SkillSet();
        /// <summary>구매한 가방 수 (1개당 5칸).</summary>
        public int BagsBought;

        public JobData JobData => JobData.Get(Job);

        public static StatBlock StartingStats(Job job)
        {
            return JobData.Get(job).StartingStats();
        }

        public static Character Create(string name, Job job)
        {
            var c = new Character
            {
                Name = string.IsNullOrWhiteSpace(name) ? "이름 없는 모험가" : name.Trim(),
                Job = job,
                BaseStats = StartingStats(job),
                Gold = GameBalance.StartGold,
            };
            string first = SkillDb.StartingSkill(job);
            SkillSystem.Learn(c, first);
            c.Skills.Equipped.Add(first);
            c.Inventory.Add(ItemDb.CreateConsumable("potion", 3));
            c.Equipment[EquipSlot.Weapon] = EquipmentFactory.Create(GearType.Weapon, ItemGrade.Common, 1, job, Stat.Vitality);
            c.RecalculateCapacities();
            c.CurrentHp = CharacterStats.MaxHp(c);
            return c;
        }

        /// <summary>가방·창고 칸 수를 가방 구매 수와 등급에 맞춘다.</summary>
        public void RecalculateCapacities()
        {
            Inventory.Capacity = Math.Min(GameBalance.InventoryMax, GameBalance.InventoryStart + GameBalance.InventoryPerBag * BagsBought);
            Storage.Capacity = RankSystem.StorageCapacity(Rank);
        }

        /// <summary>지금까지 레벨업으로 배분한 포인트 (능력치별).</summary>
        public int AllocatedPoints(Stat stat) => BaseStats[stat] - StartingStats(Job)[stat];

        /// <summary>지금 도전할 수 있는 가장 깊은 층.</summary>
        public int MaxChallengeFloor => Math.Min(GameBalance.MaxFloor, HighestFloorCleared + 1);
    }
}

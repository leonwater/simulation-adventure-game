using System;

namespace Adventure.Core
{
    /// <summary>직업별 고정 정보: 주력 능력치, 공격 능력치, 자동 배분 비율.</summary>
    public sealed class JobData
    {
        public readonly Job Job;
        public readonly string Name;
        /// <summary>간략 화면에 보이는 능력치 3종 (체력 + 공격 + 특화).</summary>
        public readonly Stat[] MainStats;
        /// <summary>공격력 계산에 쓰는 능력치.</summary>
        public readonly Stat AttackStat;
        /// <summary>레벨업 포인트를 줄 수 있는 능력치 (주력 3종 + 공통).</summary>
        public readonly Stat[] AllocatableStats;
        /// <summary>자동 배분 비율 (AllocatableStats 순서, 합 100).</summary>
        public readonly int[] AutoRatio;
        public readonly string WeaponNames;

        private JobData(Job job, string name, Stat[] main, Stat attack, Stat[] allocatable, int[] ratio, string weapons)
        {
            Job = job;
            Name = name;
            MainStats = main;
            AttackStat = attack;
            AllocatableStats = allocatable;
            AutoRatio = ratio;
            WeaponNames = weapons;
        }

        private static readonly JobData[] All =
        {
            new JobData(Job.Warrior, "전사",
                new[] { Stat.Vitality, Stat.Strength, Stat.Toughness }, Stat.Strength,
                new[] { Stat.Vitality, Stat.Strength, Stat.Toughness, Stat.Spirit, Stat.Luck },
                new[] { 30, 40, 20, 0, 10 }, "검·도끼"),
            new JobData(Job.Archer, "궁수",
                new[] { Stat.Vitality, Stat.Agility, Stat.Precision }, Stat.Agility,
                new[] { Stat.Vitality, Stat.Agility, Stat.Precision, Stat.Spirit, Stat.Luck },
                new[] { 30, 40, 20, 0, 10 }, "활"),
            new JobData(Job.Rogue, "도적",
                new[] { Stat.Vitality, Stat.Agility, Stat.Vital }, Stat.Agility,
                new[] { Stat.Vitality, Stat.Agility, Stat.Vital, Stat.Spirit, Stat.Luck },
                new[] { 25, 40, 25, 0, 10 }, "단검"),
            new JobData(Job.Mage, "마법사",
                new[] { Stat.Vitality, Stat.Intelligence, Stat.SpellPower }, Stat.Intelligence,
                new[] { Stat.Vitality, Stat.Intelligence, Stat.SpellPower, Stat.Spirit, Stat.Luck },
                new[] { 30, 40, 20, 10, 0 }, "지팡이"),
        };

        public static JobData Get(Job job) => All[(int)job];

        public bool CanAllocate(Stat stat) => Array.IndexOf(AllocatableStats, stat) >= 0;
    }
}

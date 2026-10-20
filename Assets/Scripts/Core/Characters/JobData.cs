using System;

namespace Adventure.Core
{
    /// <summary>
    /// 직업별 고정 정보 (기획서 v1.2 '직업'): 주력 능력치, 시작 능력치, HP 계수, 기본 공격 배율, 자동 배분 비율.
    /// 직업 차이는 시작 능력치·HP 계수·스킬 구성으로 낸다.
    /// </summary>
    public sealed class JobData
    {
        public readonly Job Job;
        public readonly string Name;
        /// <summary>간략 화면 능력치 3종 (체력 + 공격 + 특화).</summary>
        public readonly Stat[] MainStats;
        /// <summary>공격력 계산에 쓰는 능력치.</summary>
        public readonly Stat AttackStat;
        /// <summary>특화 능력치 (강인함·정밀·기교·주문력).</summary>
        public readonly Stat SpecialStat;
        /// <summary>레벨업 포인트를 줄 수 있는 능력치 (주력 3종 + 정신·행운). 캐릭터 화면의 5줄.</summary>
        public readonly Stat[] AllocatableStats;
        /// <summary>자동 배분 비율 (AllocatableStats 순서, 합 100).</summary>
        public readonly int[] AutoRatio;
        /// <summary>HP = 50 + 체력 × 계수.</summary>
        public readonly int HpPerVitality;
        /// <summary>기본 공격 피해 배율 (마법사 60%).</summary>
        public readonly double BasicAttackMultiplier;
        /// <summary>Lv.1 능력치: 체력, 공격, 특화, 정신, 행운.</summary>
        private readonly int[] _start;

        private JobData(Job job, string name, Stat attack, Stat special, int[] start, int[] ratio, int hpCoef,
            double basicMult)
        {
            Job = job;
            Name = name;
            AttackStat = attack;
            SpecialStat = special;
            MainStats = new[] { Stat.Vitality, attack, special };
            AllocatableStats = new[] { Stat.Vitality, attack, special, Stat.Spirit, Stat.Luck };
            _start = start;
            AutoRatio = ratio;
            HpPerVitality = hpCoef;
            BasicAttackMultiplier = basicMult;
        }

        private static readonly JobData[] All =
        {
            new JobData(Job.Warrior, "전사", Stat.Strength, Stat.Toughness, new[] { 16, 12, 10, 5, 5 },
                new[] { 30, 40, 20, 0, 10 }, 12, 1.0),
            new JobData(Job.Archer, "궁수", Stat.Agility, Stat.Precision, new[] { 10, 13, 10, 6, 8 },
                new[] { 30, 40, 20, 0, 10 }, 10, 1.0),
            new JobData(Job.Rogue, "도적", Stat.Agility, Stat.Finesse, new[] { 10, 12, 12, 5, 9 },
                new[] { 25, 40, 25, 0, 10 }, 9, 1.0),
            new JobData(Job.Mage, "마법사", Stat.Intelligence, Stat.SpellPower, new[] { 8, 14, 10, 9, 6 },
                new[] { 30, 40, 20, 10, 0 }, 8, GameBalance.MageBasicAttack),
        };

        public static JobData Get(Job job) => All[(int)job];

        /// <summary>장비·스킬서가 어느 직업용으로 나올지: 지금 직업 70%, 다른 세 직업 각 10%.</summary>
        public static Job RollItemJob(Job own, Rng rng)
        {
            if (rng.Chance(GameBalance.OwnJobChance)) return own;
            int other = rng.Range(0, 3);
            return (Job)(other >= (int)own ? other + 1 : other);
        }

        public bool CanAllocate(Stat stat) => Array.IndexOf(AllocatableStats, stat) >= 0;

        /// <summary>Lv.1 능력치. 배분할 수 없는 능력치는 5로 고정.</summary>
        public StatBlock StartingStats()
        {
            var stats = new StatBlock();
            for (int i = 0; i < StatBlock.Count; i++) stats.Values[i] = GameBalance.FixedStatValue;
            for (int i = 0; i < AllocatableStats.Length; i++) stats[AllocatableStats[i]] = _start[i];
            return stats;
        }
    }
}

using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>층·난이도에 맞춰 적을 만든다. 같은 시드면 같은 구성.</summary>
    public static class EnemyFactory
    {
        private static readonly int[] CountWeights = { 25, 35, 25, 15 }; // 1~4마리

        public static Combatant Create(MonsterSpecies sp, int floor, Difficulty diff, int role)
        {
            double d = GameBalance.DifficultyMultiplier(diff);
            double hpRole = role == 2 ? (sp.UniqueBoss ? GameBalance.UniqueBossHp : GameBalance.FloorBossHp) : role == 1 ? GameBalance.EliteHp : 1.0;
            double atkRole = role == 2 ? (sp.UniqueBoss ? GameBalance.UniqueBossAttack : GameBalance.FloorBossAttack) : role == 1 ? GameBalance.EliteAttack : 1.0;
            double reward = role == 2 ? (sp.UniqueBoss ? GameBalance.UniqueBossReward : GameBalance.FloorBossReward) : role == 1 ? GameBalance.EliteReward : 1.0;
            int hp = Math.Max(1, (int)Math.Round(GameBalance.EnemyHp(floor) * sp.HpMul * hpRole * d));
            string name = sp.Name;
            if (role == 1) name = "정예 " + sp.Name;
            else if (role == 2 && !sp.UniqueBoss) name = sp.Name + " 우두머리";
            return new Combatant
            {
                Name = name,
                MaxHp = hp,
                Hp = hp,
                Attack = Math.Max(1, (int)Math.Round(GameBalance.EnemyAttack(floor) * sp.AttackMul * atkRole * d)),
                Defense = (int)Math.Round(GameBalance.EnemyDefense(floor) * sp.DefenseMul),
                Requirement = GameBalance.EnemyRequirement(floor) * sp.RequirementMul + (role > 0 ? 2 : 0),
                Resist = role == 2 ? 0.3 : role == 1 ? 0.1 : 0,
                CritChance = 0.05,
                RegenPercent = sp.RegenPercent,
                Species = sp,
                Skills = sp.Skills,
                Role = role,
                ExpReward = (long)Math.Round(GameBalance.EnemyExp(floor) * reward),
                GoldReward = (long)Math.Round(GameBalance.EnemyGold(floor) * reward),
            };
        }

        /// <summary>전투 방의 적 무리 (1~4마리, 낮은 확률로 엘리트 1마리).</summary>
        public static List<Combatant> CreateGroup(int floor, Difficulty diff, int seed)
        {
            var rng = new Rng(seed);
            var theme = MonsterDb.ThemeFor(floor);
            int count = rng.PickWeighted(CountWeights) + 1;
            // 낮은 층은 적 수를 줄인다
            if (floor <= 2) count = Math.Min(count, 2);
            else if (floor <= 4) count = Math.Min(count, 3);
            var list = new List<Combatant>();
            int elite = rng.Chance(GameBalance.EliteChance) ? rng.Range(0, count) : -1;
            for (int i = 0; i < count; i++)
            {
                var sp = MonsterDb.Get(rng.Pick(theme.SpeciesIds));
                list.Add(Create(sp, floor, diff, i == elite ? 1 : 0));
            }
            NameDuplicates(list);
            return list;
        }

        /// <summary>보스 방: 10·20·30층은 고유 보스, 그 외 층은 테마 몬스터의 강화형.</summary>
        public static List<Combatant> CreateBoss(int floor, Difficulty diff, int seed)
        {
            var rng = new Rng(seed);
            var theme = MonsterDb.ThemeFor(floor);
            var list = new List<Combatant>();
            if (MonsterDb.IsUniqueBossFloor(floor))
            {
                list.Add(Create(MonsterDb.Get(theme.UniqueBossId), floor, diff, 2));
            }
            else
            {
                list.Add(Create(MonsterDb.Get(rng.Pick(theme.SpeciesIds)), floor, diff, 2));
                if (floor >= 5 && rng.Chance(0.5)) list.Add(Create(MonsterDb.Get(rng.Pick(theme.SpeciesIds)), floor, diff, 0));
            }
            NameDuplicates(list);
            return list;
        }

        /// <summary>이벤트 상자에서 나온 미믹 (엘리트급).</summary>
        public static List<Combatant> CreateMimic(int floor, Difficulty diff)
        {
            var sp = new MonsterSpecies { Id = "mimic", Name = "미믹", Tier = MonsterDb.ThemeIndex(floor), HpMul = 1.2, AttackMul = 1.1 };
            var m = Create(sp, floor, diff, 1);
            m.Name = "미믹";
            return new List<Combatant> { m };
        }

        /// <summary>같은 이름이 여럿이면 A, B, C…를 붙인다.</summary>
        public static void NameDuplicates(List<Combatant> list)
        {
            var counts = new Dictionary<string, int>();
            foreach (var e in list) counts[e.Name] = counts.TryGetValue(e.Name, out int n) ? n + 1 : 1;
            var used = new Dictionary<string, int>();
            foreach (var e in list)
            {
                if (counts[e.Name] < 2) continue;
                string baseName = e.Name;
                used[baseName] = used.TryGetValue(baseName, out int u) ? u + 1 : 0;
                e.Name = baseName + " " + (char)('A' + used[baseName]);
            }
        }
    }
}

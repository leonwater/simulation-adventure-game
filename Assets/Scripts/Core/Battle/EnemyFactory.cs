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
            double early = GameBalance.EarlyBoostScale(diff);
            int hp = Math.Max(1, (int)Math.Round(GameBalance.EnemyHp(floor, early) * sp.HpMul * hpRole * d));
            string name = sp.Name;
            if (role == 1) name = "정예 " + sp.Name;
            else if (role == 2 && !sp.UniqueBoss) name = sp.Name + " 우두머리";
            return new Combatant
            {
                Name = name,
                MaxHp = hp,
                Hp = hp,
                Attack = Math.Max(1, (int)Math.Round(GameBalance.EnemyAttack(floor, early) * sp.AttackMul * atkRole * d)),
                Defense = (int)Math.Round(GameBalance.EnemyDefense(floor) * sp.DefenseMul),
                Requirement = GameBalance.EnemyRequirement(floor) * sp.RequirementMul + (role > 0 ? 2 : 0),
                Resist = role == 2 ? 0.3 : role == 1 ? 0.1 : 0,
                RegenPercent = sp.RegenPercent,
                Species = sp,
                Skills = sp.Skills,
                Role = role,
                ExpReward = (long)Math.Round(GameBalance.EnemyExp(floor) * reward),
                GoldReward = (long)Math.Round(GameBalance.EnemyGold(floor) * reward),
            };
        }

        /// <summary>전투 방의 적 무리 (1~4마리, 낮은 확률로 엘리트 1마리).</summary>
        /// <param name="extra">전쟁의 북소리: 적을 더 부른다 (최대 4마리).</param>
        public static List<Combatant> CreateGroup(int floor, Difficulty diff, int seed, int extra = 0)
        {
            var rng = new Rng(seed);
            var theme = MonsterDb.ThemeFor(floor);
            int count = rng.PickWeighted(CountWeights) + 1;
            // 낮은 층은 적 수를 줄인다
            if (floor <= 2) count = Math.Min(count, 2);
            else if (floor <= 4) count = Math.Min(count, 3);
            count = Math.Min(4, count + extra);
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

        /// <summary>보스 방: 10·20·30층은 고유 보스, 그 외 층은 테마 몬스터의 강화형. 보스는 특성을 가진다.</summary>
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
            BossTraits.Equip(list[0], floor); // 보스 특성 (종족별, 층에 따라 수치가 커진다)
            NameDuplicates(list);
            return list;
        }

        /// <summary>
        /// 미믹: 그 층 일반 몬스터 기준 HP ×1.5 · 공격력 ×1.3, 물어뜯기(출혈). 이기면 장비 확정 + 골드 ×3.
        /// </summary>
        public static List<Combatant> CreateMimic(int floor, Difficulty diff)
        {
            var m = Create(MonsterDb.Get("mimic"), floor, diff, 0);
            m.GoldReward = (long)Math.Round(m.GoldReward * GameBalance.MimicGold);
            m.GuaranteedEquipment = true;
            return new List<Combatant> { m };
        }

        /// <summary>도박하는 고블린에게 속임수가 들통났을 때의 전투 (고블린 2마리, 층 수치).</summary>
        public static List<Combatant> CreateGamblers(int floor, Difficulty diff)
        {
            var sp = MonsterDb.Get("goblin");
            var list = new List<Combatant> { Create(sp, floor, diff, 0), Create(sp, floor, diff, 0) };
            NameDuplicates(list);
            return list;
        }

        /// <summary>떠돌이 모험가 (정예): 골드 ×4, 30% 확률로 장비 확정.</summary>
        public static List<Combatant> CreateWanderer(int floor, Difficulty diff, int seed)
        {
            var rng = new Rng(seed);
            var w = Create(MonsterDb.Get("wanderer"), floor, diff, 1);
            w.Name = "떠돌이 모험가";
            w.GoldReward *= 4;
            w.GuaranteedEquipment = rng.Chance(0.3);
            return new List<Combatant> { w };
        }

        /// <summary>도망친 고블린이 데려온 무리: 테마 몬스터 2~3마리 (정예 1) · 보상 ×2.</summary>
        public static List<Combatant> CreateGoblinChase(int floor, Difficulty diff, int seed)
        {
            var rng = new Rng(seed);
            var theme = MonsterDb.ThemeFor(floor);
            int count = rng.RangeInclusive(2, 3);
            int elite = rng.Range(0, count);
            var list = new List<Combatant>();
            for (int i = 0; i < count; i++)
            {
                var e = Create(MonsterDb.Get(rng.Pick(theme.SpeciesIds)), floor, diff, i == elite ? 1 : 0);
                e.ExpReward *= 2;
                e.GoldReward *= 2;
                list.Add(e);
            }
            NameDuplicates(list);
            return list;
        }

        /// <summary>튜토리얼 전투: 첫 전투는 슬라임 1마리(레벨업할 만큼 경험치), 두 번째는 고블린 2마리. 초반 보정 없이 약하게.</summary>
        public static List<Combatant> CreateTutorialGroup(bool first, Difficulty diff)
        {
            var list = new List<Combatant>();
            if (first)
            {
                var slime = Tutorial(Create(MonsterDb.Get("slime"), 1, diff, 0), diff, 1.0);
                slime.ExpReward = Math.Max(slime.ExpReward, GameBalance.ExpToNext(1));
                list.Add(slime);
            }
            else
            {
                list.Add(Tutorial(Create(MonsterDb.Get("goblin"), 1, diff, 0), diff, 1.0));
                list.Add(Tutorial(Create(MonsterDb.Get("goblin"), 1, diff, 0), diff, 1.0));
            }
            NameDuplicates(list);
            return list;
        }

        /// <summary>튜토리얼 약한 보스 (고블린 우두머리, HP 절반, 특성 없음).</summary>
        public static List<Combatant> CreateTutorialBoss(Difficulty diff) =>
            new List<Combatant> { Tutorial(Create(MonsterDb.Get("goblin"), 1, diff, 2), diff, 0.5, 0.8) };

        /// <summary>튜토리얼 적: 1층 초반 보정을 빼고 배율을 곱한다.</summary>
        private static Combatant Tutorial(Combatant e, Difficulty diff, double hp, double attack = 1.0)
        {
            double early = GameBalance.EarlyBoostScale(diff);
            double hpScale = GameBalance.EnemyHp(1, 0) / GameBalance.EnemyHp(1, early) * hp;
            double atkScale = GameBalance.EnemyAttack(1, 0) / GameBalance.EnemyAttack(1, early) * attack;
            e.MaxHp = e.Hp = Math.Max(1, (int)Math.Round(e.MaxHp * hpScale));
            e.Attack = Math.Max(1, (int)Math.Round(e.Attack * atkScale));
            return e;
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

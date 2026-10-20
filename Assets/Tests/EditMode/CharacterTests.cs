using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    public class CharacterTests
    {
        [Test]
        public void ExpToNext_FollowsFormula()
        {
            Assert.AreEqual(100, GameBalance.ExpToNext(1));
            Assert.AreEqual(283, GameBalance.ExpToNext(2));
            Assert.AreEqual(3162, GameBalance.ExpToNext(10));
            Assert.AreEqual(0, GameBalance.ExpToNext(GameBalance.MaxLevel));
        }

        [Test]
        public void Create_AppliesJobStartingStatsAndHp()
        {
            // 기획서 v1.2 직업별 시작 능력치 · 시작 HP 242 / 150 / 140 / 114
            var w = Character.Create("에단", Job.Warrior);
            Assert.AreEqual(16, w.BaseStats[Stat.Vitality]);
            Assert.AreEqual(12, w.BaseStats[Stat.Strength]);
            Assert.AreEqual(10, w.BaseStats[Stat.Toughness]);
            Assert.AreEqual(5, w.BaseStats[Stat.Agility], "배분할 수 없는 능력치는 5 고정");
            Assert.AreEqual(242, CharacterStats.MaxHp(w));
            Assert.AreEqual(150, CharacterStats.MaxHp(Character.Create("a", Job.Archer)));
            Assert.AreEqual(140, CharacterStats.MaxHp(Character.Create("a", Job.Rogue)));
            Assert.AreEqual(114, CharacterStats.MaxHp(Character.Create("a", Job.Mage)));
            Assert.AreEqual(CharacterStats.MaxHp(w), w.CurrentHp);
            Assert.AreEqual(GameBalance.StartGold, w.Gold);
            foreach (Job j in System.Enum.GetValues(typeof(Job)))
            {
                var c = Character.Create("a", j);
                int sum = 0;
                foreach (var st in c.JobData.AllocatableStats) sum += c.BaseStats[st];
                Assert.That(sum, Is.InRange(47, 48), j + " 시작 능력치 합");
            }
        }

        [Test]
        public void Create_BlankNameGetsDefault()
        {
            Assert.IsNotEmpty(Character.Create("   ", Job.Mage).Name);
        }

        [Test]
        public void AddExp_LevelsUpMultipleTimesAndGivesPoints()
        {
            var c = Character.Create("a", Job.Archer);
            int gained = Leveling.AddExp(c, 100 + 283 + 10);
            Assert.AreEqual(2, gained);
            Assert.AreEqual(3, c.Level);
            Assert.AreEqual(10, c.Exp);
            Assert.AreEqual(6, c.UnspentPoints);
        }

        [Test]
        public void AddExp_StopsAtMaxLevel()
        {
            var c = Character.Create("a", Job.Rogue);
            Leveling.AddExp(c, long.MaxValue / 4);
            Assert.AreEqual(GameBalance.MaxLevel, c.Level);
            Assert.AreEqual(0, c.Exp);
            Assert.AreEqual(0, Leveling.AddExp(c, 1000));
        }

        [Test]
        public void DeathExpLoss_NeverDropsLevel()
        {
            var c = Character.Create("a", Job.Warrior);
            Leveling.AddExp(c, 100 + 10); // Lv2, exp 10
            long lost = Leveling.ApplyDeathExpLoss(c);
            Assert.AreEqual(2, c.Level);
            Assert.AreEqual(0, c.Exp);
            Assert.AreEqual(10, lost);

            Leveling.AddExp(c, 200); // Lv2 need 283
            lost = Leveling.ApplyDeathExpLoss(c);
            Assert.AreEqual(57, lost); // 283 × 20%
            Assert.AreEqual(143, c.Exp);
        }

        [Test]
        public void Allocate_OnlyAllowsJobStats()
        {
            var c = Character.Create("a", Job.Warrior);
            c.UnspentPoints = 3;
            Assert.IsFalse(Leveling.Allocate(c, Stat.Intelligence));
            Assert.IsFalse(Leveling.Allocate(c, Stat.Precision));
            Assert.IsTrue(Leveling.Allocate(c, Stat.Strength));
            Assert.IsTrue(Leveling.Allocate(c, Stat.Luck));
            Assert.IsTrue(Leveling.Allocate(c, Stat.Spirit));
            Assert.IsFalse(Leveling.Allocate(c, Stat.Strength));
            Assert.AreEqual(13, c.BaseStats[Stat.Strength]);
        }

        [Test]
        public void AutoAllocate_ApproachesJobRatioOverManyLevels()
        {
            var c = Character.Create("a", Job.Warrior);
            for (int i = 0; i < 30; i++)
            {
                c.UnspentPoints += 3;
                Leveling.AutoAllocate(c);
            }
            Assert.AreEqual(0, c.UnspentPoints);
            // 90포인트: 체력 30% · 힘 40% · 강인함 20% · 행운 10%
            Assert.AreEqual(27, c.AllocatedPoints(Stat.Vitality));
            Assert.AreEqual(36, c.AllocatedPoints(Stat.Strength));
            Assert.AreEqual(18, c.AllocatedPoints(Stat.Toughness));
            Assert.AreEqual(9, c.AllocatedPoints(Stat.Luck));
            Assert.AreEqual(0, c.AllocatedPoints(Stat.Spirit));
        }

        [Test]
        public void AllocationDraft_CommitsOnlyOnConfirm()
        {
            var c = Character.Create("a", Job.Mage);
            c.UnspentPoints = 3;
            var draft = new AllocationDraft(c);
            Assert.IsTrue(draft.Add(Stat.Intelligence));
            Assert.IsTrue(draft.Add(Stat.Intelligence));
            Assert.IsFalse(draft.Add(Stat.Strength));
            Assert.AreEqual(1, draft.Remaining);
            Assert.AreEqual(14, c.BaseStats[Stat.Intelligence]);
            draft.Commit();
            Assert.AreEqual(16, c.BaseStats[Stat.Intelligence]);
            Assert.AreEqual(1, c.UnspentPoints);
            Assert.IsFalse(draft.HasChanges);
        }

        [Test]
        public void AllocationDraft_AutoUsesAllPoints()
        {
            var c = Character.Create("a", Job.Rogue);
            c.UnspentPoints = 6;
            var draft = new AllocationDraft(c);
            draft.Auto();
            Assert.AreEqual(0, draft.Remaining);
            draft.Commit();
            Assert.AreEqual(0, c.UnspentPoints);
        }

        [Test]
        public void Formulas_MatchDesign()
        {
            var c = Character.Create("a", Job.Rogue);
            c.BaseStats[Stat.Luck] = 8;
            c.BaseStats[Stat.Agility] = 20;
            c.BaseStats[Stat.Finesse] = 10;
            c.BaseStats[Stat.Spirit] = 6;
            Assert.AreEqual(0.15, CharacterStats.Evasion(c), 1e-9, "민첩 20 × 0.5% + 기교 10 × 0.5%");
            Assert.AreEqual(2.3, new Combatant().CritDamage, 1e-9);
            Assert.AreEqual(0.06, CharacterStats.Resist(c), 1e-9);
            Assert.AreEqual(0.04, CharacterStats.EventLuckBonus(c), 1e-9);
            Assert.AreEqual(1.04, CharacterStats.DropBonus(c), 1e-9);
            Assert.AreEqual(40 + 8, CharacterStats.Attack(c)); // 민첩 20 × 2 + 시작 무기 8
            c.BaseStats[Stat.Agility] = 200;
            Assert.AreEqual(0.40, CharacterStats.Evasion(c), 1e-9, "회피 최대 40%");

            var w = Character.Create("a", Job.Warrior);
            w.BaseStats[Stat.Toughness] = 200;
            Assert.AreEqual(0.40, CharacterStats.DamageReduction(w), 1e-9, "강인함 감소율 최대 40%");
            w.BaseStats[Stat.Finesse] = 100;
            Assert.AreEqual(0.025, CharacterStats.Evasion(w), 1e-9, "기교는 도적만 회피에 반영");

            var m = Character.Create("a", Job.Mage);
            Assert.AreEqual(0.05, CharacterStats.SkillDamageBonus(m), 1e-9, "주문력 10 × 0.5%");
        }

        [Test]
        public void LevelUp_HealsThirtyPercentPerLevel()
        {
            var c = Character.Create("a", Job.Warrior);
            c.CurrentHp = 10;
            Leveling.AddExp(c, 100);
            Assert.AreEqual(10 + (int)System.Math.Round(242 * 0.3), c.CurrentHp);
            c.CurrentHp = 1;
            Leveling.AddExp(c, 283 + 520);
            Assert.AreEqual(4, c.Level);
            Assert.AreEqual(1 + 73 + 73, c.CurrentHp, "레벨마다 30%");
            c.CurrentHp = 240;
            Leveling.AddExp(c, 800);
            Assert.AreEqual(CharacterStats.MaxHp(c), c.CurrentHp, "최대 HP를 넘지 않음");
        }

        [Test]
        public void Badge_MultipliesOwnStatsOnly()
        {
            var c = Character.Create("a", Job.Warrior);
            c.BaseStats[Stat.Strength] = 50;
            c.Rank = Rank.SS; // +20%
            Assert.AreEqual(60, CharacterStats.OwnStat(c, Stat.Strength));
            c.Rank = Rank.E; // +2% → 51
            Assert.AreEqual(51, CharacterStats.OwnStat(c, Stat.Strength));
        }

        [Test]
        public void Promotion_RequiresAllThreeConditions()
        {
            var c = Character.Create("a", Job.Warrior);
            var s = RankSystem.GetStatus(c);
            Assert.AreEqual(Rank.E, s.Next);
            Assert.IsFalse(s.CanPromote);

            c.HighestFloorCleared = 3;
            c.Level = 5;
            c.QuestsCompleted = 2;
            Assert.IsFalse(RankSystem.TryPromote(c));
            c.QuestsCompleted = 3;
            Assert.IsTrue(RankSystem.TryPromote(c));
            Assert.AreEqual(Rank.E, c.Rank);

            var next = RankSystem.GetStatus(c);
            Assert.AreEqual(Rank.D, next.Next);
            Assert.AreEqual(6, next.FloorRequired);
            Assert.AreEqual(10, next.LevelRequired);
            Assert.AreEqual(8, next.QuestsRequired);
        }

        [Test]
        public void Promotion_StopsAtSS()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Rank = Rank.SS;
            c.HighestFloorCleared = 30;
            c.Level = 60;
            c.QuestsCompleted = 999;
            Assert.IsTrue(RankSystem.GetStatus(c).IsMaxRank);
            Assert.IsFalse(RankSystem.TryPromote(c));
        }

        [Test]
        public void SkillSlotsAndStorage_GrowWithRank()
        {
            Assert.AreEqual(3, RankSystem.SkillSlots(Rank.F));
            Assert.AreEqual(3, RankSystem.SkillSlots(Rank.E));
            Assert.AreEqual(4, RankSystem.SkillSlots(Rank.D));
            Assert.AreEqual(5, RankSystem.SkillSlots(Rank.B));
            Assert.AreEqual(6, RankSystem.SkillSlots(Rank.SS));
            Assert.AreEqual(20, RankSystem.StorageCapacity(Rank.F));
            Assert.AreEqual(55, RankSystem.StorageCapacity(Rank.SS));
        }

        [Test]
        public void HitChance_StartsHighAndClamps()
        {
            Assert.AreEqual(0.74, GameBalance.HitChance(10, 10), 1e-9);
            Assert.AreEqual(0.85, GameBalance.HitChance(100, 0), 1e-9);
            Assert.AreEqual(0.55, GameBalance.HitChance(0, 100), 1e-9);
            // 시작 시 기본 공격은 70~80%대 (1층 요구치 12.4)
            double req = GameBalance.EnemyRequirement(1);
            foreach (var job in new[] { Job.Warrior, Job.Archer, Job.Rogue, Job.Mage })
            {
                var c = Character.Create("a", job);
                double hit = GameBalance.HitChance(CharacterStats.Total(c, c.JobData.AttackStat), req, CharacterStats.PrecisionBonus(c));
                Assert.That(hit, Is.InRange(0.70, 0.80), job.ToString());
            }
        }

        [Test]
        public void EventChance_UsesLuckAndClamps()
        {
            Assert.AreEqual(0.72 + 0.01 + 0.025, GameBalance.EventChance(11, 10, 5), 1e-9);
            Assert.AreEqual(0.85, GameBalance.EventChance(100, 0, 0), 1e-9);
            Assert.AreEqual(0.40, GameBalance.EventChance(0, 100, 0), 1e-9);
            // 1층에서 주력 능력치 판정은 70~85%
            var w = Character.Create("a", Job.Warrior);
            double main = GameBalance.EventChance(CharacterStats.Total(w, Stat.Strength), GameBalance.EventRequirement(1), CharacterStats.Total(w, Stat.Luck));
            Assert.That(main, Is.InRange(0.70, 0.85));
        }
    }
}

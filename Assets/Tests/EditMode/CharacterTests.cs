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
        public void Create_AppliesStartingStatsAndFullHp()
        {
            var c = Character.Create("에단", Job.Warrior);
            Assert.AreEqual(8, c.BaseStats[Stat.Strength]);
            Assert.AreEqual(8, c.BaseStats[Stat.Toughness]);
            Assert.AreEqual(8, c.BaseStats[Stat.Vitality]);
            Assert.AreEqual(5, c.BaseStats[Stat.Agility]);
            Assert.AreEqual(50 + 8 * 10, CharacterStats.MaxHp(c));
            Assert.AreEqual(CharacterStats.MaxHp(c), c.CurrentHp);
            Assert.AreEqual(GameBalance.StartGold, c.Gold);
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
            Assert.AreEqual(9, c.BaseStats[Stat.Strength]);
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
            Assert.AreEqual(8, c.BaseStats[Stat.Intelligence]);
            draft.Commit();
            Assert.AreEqual(10, c.BaseStats[Stat.Intelligence]);
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
            c.BaseStats[Stat.Vital] = 10;
            c.BaseStats[Stat.Spirit] = 6;
            Assert.AreEqual(0.05 + 8 * 0.003, CharacterStats.CritChance(c), 1e-9);
            Assert.AreEqual(0.10, CharacterStats.Evasion(c), 1e-9);
            Assert.AreEqual(1.6, CharacterStats.CritDamage(c), 1e-9);
            Assert.AreEqual(0.06, CharacterStats.Resist(c), 1e-9);
            Assert.AreEqual(40 + 8, CharacterStats.Attack(c)); // 민첩 20 × 2 + 시작 무기 8
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
        public void SuccessChance_ClampedBetween5And95()
        {
            Assert.AreEqual(0.5, GameBalance.SuccessChance(10, 10), 1e-9);
            Assert.AreEqual(0.8, GameBalance.SuccessChance(24, 18), 1e-9);
            Assert.AreEqual(0.95, GameBalance.SuccessChance(100, 0), 1e-9);
            Assert.AreEqual(0.05, GameBalance.SuccessChance(0, 100), 1e-9);
        }
    }
}

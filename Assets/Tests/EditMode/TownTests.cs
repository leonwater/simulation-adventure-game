using System;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    public class TownTests
    {
        private static readonly DateTime T0 = new DateTime(2026, 10, 17, 12, 0, 0, DateTimeKind.Utc);

        [Test]
        public void Shop_AutoRefreshesEvery30MinutesIncludingOfflineTime()
        {
            var c = Character.Create("a", Job.Warrior);
            var s = new ShopState();
            var rng = new Rng(3);
            Assert.IsTrue(ShopSystem.EnsureFresh(s, c, T0, rng));
            Assert.AreEqual(6, s.Equipment.Count);
            Assert.AreEqual(6, s.Goods.Count);
            string first = s.Equipment[0].Uid;

            Assert.IsFalse(ShopSystem.EnsureFresh(s, c, T0.AddMinutes(29), rng));
            Assert.AreEqual(TimeSpan.FromMinutes(1), ShopSystem.TimeUntilRefresh(s, T0.AddMinutes(29)));
            Assert.AreEqual(first, s.Equipment[0].Uid);

            // 앱을 95분 동안 꺼 두었다가 켜도 한 번 갱신되고, 다음 갱신은 기존 주기(120분)에 맞춰진다.
            Assert.IsTrue(ShopSystem.EnsureFresh(s, c, T0.AddMinutes(95), rng));
            Assert.AreNotEqual(first, s.Equipment[0].Uid);
            Assert.AreEqual(TimeSpan.FromMinutes(25), ShopSystem.TimeUntilRefresh(s, T0.AddMinutes(95)));
        }

        [Test]
        public void Shop_RerollCostDoublesAndResetsOnAutoRefresh()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Gold = 10_000;
            var s = new ShopState();
            var rng = new Rng(3);
            ShopSystem.EnsureFresh(s, c, T0, rng);
            Assert.AreEqual(100, ShopSystem.RerollCost(s));
            Assert.IsTrue(ShopSystem.Reroll(s, c, rng, out _));
            Assert.AreEqual(200, ShopSystem.RerollCost(s));
            Assert.IsTrue(ShopSystem.Reroll(s, c, rng, out _));
            Assert.AreEqual(400, ShopSystem.RerollCost(s));
            Assert.AreEqual(10_000 - 300, c.Gold);
            ShopSystem.EnsureFresh(s, c, T0.AddMinutes(30), rng);
            Assert.AreEqual(100, ShopSystem.RerollCost(s));
        }

        [Test]
        public void Shop_ClockGoingBackwardsDoesNotBreak()
        {
            var c = Character.Create("a", Job.Warrior);
            var s = new ShopState();
            var rng = new Rng(3);
            ShopSystem.EnsureFresh(s, c, T0, rng);
            Assert.IsFalse(ShopSystem.EnsureFresh(s, c, T0.AddHours(-5), rng));
            Assert.AreEqual(GameBalance.ShopRefreshInterval, ShopSystem.TimeUntilRefresh(s, T0.AddHours(-5)));
        }

        [Test]
        public void Shop_SellsOnlyLowAndMidSkillBooksAndCommonGrades()
        {
            var rng = new Rng(11);
            for (int i = 0; i < 200; i++)
            {
                var c = Character.Create("a", (Job)(i % 4));
                var s = new ShopState();
                ShopSystem.Restock(s, c, rng);
                foreach (var e in s.Equipment) Assert.LessOrEqual((int)e.Grade, (int)ItemGrade.Uncommon);
                foreach (var g in s.Goods)
                {
                    if (g.Item.Kind != ItemKind.SkillBook) continue;
                    var tier = SkillDb.Get(g.Item.SkillId).Tier;
                    Assert.IsTrue(tier == SkillTier.Low || tier == SkillTier.Mid);
                    Assert.IsFalse(c.Skills.Knows(g.Item.SkillId));
                    Assert.LessOrEqual(SkillDb.Get(g.Item.SkillId).ReqLevel, c.Level + GameBalance.SkillBookLevelWindow);
                }
            }
        }

        [Test]
        public void SkillBookDrops_OnlyUpToLevelPlusFive()
        {
            var rng = new Rng(5);
            foreach (int level in new[] { 1, 3, 12, 13, 25, 40 })
            {
                var c = Character.Create("a", Job.Mage);
                c.Level = level;
                bool sawHigh = false, sawTop = false;
                for (int i = 0; i < 300; i++)
                {
                    var def = SkillDb.Get(LootSystem.HighSkillBook(c, rng).SkillId);
                    Assert.AreEqual((int)Job.Mage, def.JobRestriction);
                    Assert.LessOrEqual(def.ReqLevel, level + 5, "Lv." + level + "에 " + def.Name);
                    sawHigh |= def.Tier == SkillTier.High;
                    sawTop |= def.Tier == SkillTier.Top;
                }
                Assert.AreEqual(level >= 13, sawHigh || sawTop, "Lv.13부터 상급 스킬서");
                Assert.AreEqual(level >= 25, sawTop, "Lv.25부터 최상급 스킬서");
            }
        }

        [Test]
        public void Shop_BuySellAndBags()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Gold = 100_000;
            var s = new ShopState();
            ShopSystem.EnsureFresh(s, c, T0, new Rng(5));
            var potion = s.Goods.Find(g => g.Item.TemplateId == "potion");
            long before = c.Gold;
            Assert.IsTrue(ShopSystem.BuyGood(s, c, potion.Item.Uid, 5, out _));
            Assert.AreEqual(before - 250, c.Gold);
            Assert.AreEqual(8, c.Inventory.CountOf("potion"));
            Assert.IsNotNull(s.Goods.Find(g => g.Item.TemplateId == "potion"), "소모품은 무제한");

            var eq = s.Equipment[0];
            Assert.IsTrue(ShopSystem.BuyEquipment(s, c, eq.Uid, out _));
            Assert.AreEqual(5, s.Equipment.Count);
            before = c.Gold;
            Assert.IsTrue(ShopSystem.Sell(c, eq.Uid, 1, out _));
            Assert.AreEqual(before + eq.SellPrice, c.Gold);

            Assert.AreEqual(500, ShopSystem.BagPrice(c));
            Assert.IsTrue(ShopSystem.BuyBag(c, out _));
            Assert.AreEqual(25, c.Inventory.Capacity);
            Assert.AreEqual(1000, ShopSystem.BagPrice(c));
            c.Gold = 1_000_000;
            for (int i = 0; i < 7; i++) Assert.IsTrue(ShopSystem.BuyBag(c, out _));
            Assert.AreEqual(60, c.Inventory.Capacity);
            Assert.IsFalse(ShopSystem.BuyBag(c, out string err));
            Assert.AreEqual("가방을 더 늘릴 수 없습니다", err);
        }

        [Test]
        public void Shop_FailsWithoutGoldOrSpace()
        {
            var c = Character.Create("a", Job.Warrior);
            var s = new ShopState();
            ShopSystem.EnsureFresh(s, c, T0, new Rng(5));
            c.Gold = 0;
            Assert.IsFalse(ShopSystem.BuyEquipment(s, c, s.Equipment[0].Uid, out string err));
            Assert.AreEqual("골드가 부족합니다", err);
            c.Gold = 1_000_000;
            c.Inventory.Capacity = c.Inventory.UsedCells;
            Assert.IsFalse(ShopSystem.BuyEquipment(s, c, s.Equipment[0].Uid, out err));
            Assert.AreEqual("가방이 가득 찼습니다", err);
            Assert.AreEqual(1_000_000, c.Gold);
        }

        [Test]
        public void Guild_QuestRanksStayWithinOneStep()
        {
            var rng = new Rng(9);
            var c = Character.Create("a", Job.Archer);
            c.Rank = Rank.D;
            c.HighestFloorCleared = 6;
            for (int i = 0; i < 500; i++)
            {
                var q = GuildSystem.Generate(c, rng);
                Assert.IsTrue(q.Rank >= Rank.E && q.Rank <= Rank.C, q.Rank.ToString());
                Assert.IsTrue(q.TargetFloor >= 1 && q.TargetFloor <= 7);
                Assert.AreEqual(GuildSystem.RewardMultiplier(c.Rank, q.Rank), q.RewardMultiplier);
                Assert.Greater(q.RewardGold, 0);
            }
            Assert.AreEqual(0.5, GuildSystem.RewardMultiplier(Rank.D, Rank.E));
            Assert.AreEqual(1.0, GuildSystem.RewardMultiplier(Rank.D, Rank.D));
            Assert.AreEqual(1.5, GuildSystem.RewardMultiplier(Rank.D, Rank.C));
            Assert.AreEqual(Rank.F, GuildSystem.MinQuestRank(Rank.F));
        }

        [Test]
        public void Guild_AcceptLimitAndHuntTurnIn()
        {
            var c = Character.Create("a", Job.Warrior);
            var g = new GuildState();
            GuildSystem.RefreshBoard(g, c, new Rng(4));
            Assert.AreEqual(5, g.Board.Count);
            for (int i = 0; i < 3; i++) Assert.IsTrue(GuildSystem.Accept(g, c, g.Board[0].Id, out _));
            Assert.IsFalse(GuildSystem.Accept(g, c, g.Board[0].Id, out string err));
            StringAssert.Contains("3개", err);

            var hunt = new Quest { Id = "h", Kind = QuestKind.Hunt, SpeciesId = "goblin", TargetFloor = 2, Required = 2, RewardGold = 100, RewardExp = 50 };
            g.Active.Clear();
            g.Active.Add(hunt);
            GuildSystem.OnEnemyKilled(g, "goblin", 1); // 목표 층보다 얕으면 무효
            GuildSystem.OnEnemyKilled(g, "slime", 2);
            Assert.AreEqual(0, hunt.Progress);
            GuildSystem.OnEnemyKilled(g, "goblin", 2);
            Assert.IsFalse(GuildSystem.TurnIn(g, c, "h", out _, out err));
            GuildSystem.OnEnemyKilled(g, "goblin", 3);
            long gold = c.Gold;
            Assert.IsTrue(GuildSystem.TurnIn(g, c, "h", out _, out _));
            Assert.AreEqual(gold + 100, c.Gold);
            Assert.AreEqual(1, c.QuestsCompleted);
            Assert.AreEqual(50, c.Exp);
        }

        [Test]
        public void Guild_CollectQuestConsumesMaterials()
        {
            var c = Character.Create("a", Job.Warrior);
            var g = new GuildState();
            var q = new Quest { Id = "c", Kind = QuestKind.Collect, MaterialId = "mat_spider", Required = 3, RewardGold = 10 };
            g.Active.Add(q);
            c.Inventory.Add(ItemDb.CreateMaterial("mat_spider", 2));
            Assert.IsFalse(GuildSystem.IsComplete(q, c));
            c.Inventory.Add(ItemDb.CreateMaterial("mat_spider", 2));
            Assert.IsTrue(GuildSystem.TurnIn(g, c, "c", out _, out _));
            Assert.AreEqual(1, c.Inventory.CountOf("mat_spider"));
        }

        [Test]
        public void Guild_ConquerQuestCompletesOnBossKill()
        {
            var g = new GuildState();
            var q = new Quest { Id = "b", Kind = QuestKind.Conquer, TargetFloor = 5, Required = 1 };
            g.Active.Add(q);
            GuildSystem.OnBossKilled(g, 4);
            Assert.AreEqual(0, q.Progress);
            GuildSystem.OnBossKilled(g, 5);
            Assert.AreEqual(1, q.Progress);
        }

        [Test]
        public void Storage_DepositWithdrawAndCapacityGrowsWithRank()
        {
            var c = Character.Create("a", Job.Warrior);
            var potion = c.Inventory.Items[0];
            Assert.IsTrue(GuildSystem.Deposit(c, potion.Uid, out _));
            Assert.AreEqual(0, c.Inventory.CountOf("potion"));
            Assert.AreEqual(3, c.Storage.CountOf("potion"));
            Assert.IsTrue(GuildSystem.Withdraw(c, c.Storage.Items[0].Uid, out _));
            Assert.AreEqual(3, c.Inventory.CountOf("potion"));

            Assert.AreEqual(20, c.Storage.Capacity);
            c.HighestFloorCleared = 3;
            c.Level = 5;
            c.QuestsCompleted = 3;
            Assert.IsTrue(RankSystem.TryPromote(c));
            Assert.AreEqual(25, c.Storage.Capacity);
        }
    }
}

using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>
    /// 기획서 v1.8: 성공률 +7%p, 스킬 위력별 성공률, 도적(스킬 80%·치명 ×2.3·예리함·잔혹함), 장비 등급 차이·강화 판매가,
    /// 직업 70/10 드롭, 던전 상인 구매 한도, 창고 수수료, 자동 승급, 이동 선택지 순서, 업데이트 후 이어하기 복구.
    /// </summary>
    public class V18Tests
    {
        private static GameSession NewSession(int seed = 1) =>
            new GameSession(new MemorySaveStore(), () => new DateTime(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc), seed);

        [Test]
        public void SuccessRates_RaisedBySevenPoints()
        {
            Assert.AreEqual(0.81, GameBalance.BaseHit, 1e-9);
            Assert.AreEqual(0.92, GameBalance.MaxHit, 1e-9);
            Assert.AreEqual(0.67, GameBalance.BaseFlee, 1e-9);
            Assert.AreEqual(0.87, GameBalance.MaxFlee, 1e-9);
            Assert.AreEqual(99, GameBalance.StatCap);
        }


        [Test]
        public void Rogue_EightyPercentSkillsAndKeenCruelBuffs()
        {
            Assert.AreEqual(2.3, GameBalance.CritMultiplier, 1e-9);
            Assert.AreEqual(1.1, SkillDb.Get("r_ambush").DamageMult, 1e-9, "기습 140% × 0.8");
            Assert.AreEqual(2.5, SkillDb.Get("r_assassin").DamageMult, 1e-9, "암살 (v1.9 최상급 ×1.25)");
            Assert.AreEqual(StatusType.Keen, SkillDb.Get("r_keen").Statuses[0].Type);
            Assert.AreEqual(StatusType.Cruel, SkillDb.Get("r_cruel").Statuses[0].Type);
            Assert.IsFalse(StatusContainer.IsDebuff(StatusType.Keen));
            Assert.IsFalse(StatusContainer.IsDebuff(StatusType.Cruel));

            var player = new Combatant { Attack = 100, MaxHp = 100, Hp = 100 };
            var target = new Combatant { Attack = 1, MaxHp = 10000, Hp = 10000 };
            int crit = Battle.Damage(player, target, 1.0, true);
            Assert.AreEqual(Math.Round(100 * 2.3), crit, 1);
            player.Statuses.Apply(StatusType.Cruel, 50, 3);
            Assert.AreEqual(Math.Round(100 * 2.8), Battle.Damage(player, target, 1.0, true), 1, "잔혹함 +50%");
        }

        [Test]
        public void Keen_RaisesSkillCritChance()
        {
            var c = Character.Create("a", Job.Rogue);
            c.Level = 20;
            SkillSystem.Learn(c, "r_venom");
            SkillSystem.Equip(c, "r_venom", out _);
            var e = EnemyFactory.Create(MonsterDb.Get("goblin"), 1, Difficulty.Normal, 0);
            e.MaxHp = e.Hp = 1000000;
            e.Requirement = -1000;
            var b = new Battle(c, 1, new List<Combatant> { e }, false, new Rng(3));
            string Detail() => b.GetChoices().Find(x => x.SkillId == "r_venom").Detail;
            StringAssert.Contains("치명타 확률 20%", Detail());
            b.Player.Statuses.Apply(StatusType.Keen, 25, 3);
            StringAssert.Contains("치명타 확률 45%", Detail());
        }

        [Test]
        public void Equipment_GradeGapAndEnhanceGrowth()
        {
            var common = EquipmentFactory.Create(GearType.Weapon, ItemGrade.Common, 20, Job.Warrior, Stat.Luck);
            var legend = EquipmentFactory.Create(GearType.Weapon, ItemGrade.Legendary, 20, Job.Warrior, Stat.Luck);
            Assert.AreEqual(Math.Round(common.BaseValue * 1.28), legend.BaseValue, 1, "전설은 일반의 1.28배 (v2.0)");
            common.Enhance = legend.Enhance = 10;
            Assert.AreEqual(common.BaseValue + 10, common.Value, "일반 +10 = +20%, 단계마다 최소 +1");
            Assert.AreEqual(Math.Round(legend.BaseValue * 1.4), legend.Value, 1, "전설 +10 = +40%");
        }

        [Test]
        public void EnhancedGear_SellsForMore()
        {
            var item = EquipmentFactory.Create(GearType.Armor, ItemGrade.Rare, 10, Job.Warrior, Stat.Luck);
            int plain = item.SellPrice;
            item.Enhance = 5;
            int spent = Blacksmith.GoldSpent(item);
            Assert.AreEqual((int)Math.Round(30 * 15 * 2.0 * 1.7), spent, "30 × (1+2+3+4+5) × (1 + Lv.10 ÷ 10) × 희귀 1.7");
            Assert.AreEqual(plain + spent / 2, item.SellPrice, 1, "강화에 든 골드의 절반을 더 받는다");
        }

        [Test]
        public void ItemJob_SeventyPercentOwnTenPercentEachOther()
        {
            var rng = new Rng(9);
            var counts = new int[4];
            for (int i = 0; i < 20000; i++) counts[(int)JobData.RollItemJob(Job.Archer, rng)]++;
            Assert.That(counts[(int)Job.Archer] / 20000.0, Is.InRange(0.68, 0.72));
            foreach (Job j in Enum.GetValues(typeof(Job)))
                if (j != Job.Archer) Assert.That(counts[(int)j] / 20000.0, Is.InRange(0.085, 0.115), j.ToString());

            int own = 0, weapons = 0;
            for (int i = 0; i < 4000; i++)
            {
                var item = EquipmentFactory.CreateRandom(rng, ItemGrade.Common, 10, Job.Archer);
                if (!item.IsWeapon) continue;
                weapons++;
                if (item.JobRestriction == (int)Job.Archer) own++;
            }
            Assert.That(own / (double)weapons, Is.InRange(0.65, 0.75), "무기도 지금 직업 70%");
        }

        [Test]
        public void DungeonMerchant_HasPurchaseLimit()
        {
            var goods = DungeonGenerator.MerchantGoods(new Rng(4));
            var c = Character.Create("a", Job.Warrior);
            c.Inventory.Items.Clear();
            c.Gold = 1000000;
            var state = new ShopState { Goods = goods };
            var potion = goods.Find(g => g.Item.TemplateId == "potion");
            int stock = potion.Stock;
            Assert.That(stock, Is.InRange(GameBalance.MerchantStockMin, GameBalance.MerchantStockMax));
            Assert.IsTrue(ShopSystem.BuyGood(state, c, potion.Item.Uid, 99, out _));
            Assert.AreEqual(stock, c.Inventory.CountOf("potion"), "남은 수량까지만 산다");
            Assert.IsFalse(goods.Contains(potion), "다 팔리면 목록에서 빠진다");
            Assert.IsFalse(ShopSystem.BuyGood(state, c, potion.Item.Uid, 1, out _));
        }

        [Test]
        public void Storage_ChargesFeeOnDepositOnly()
        {
            var c = Character.Create("a", Job.Warrior);
            c.HighestFloorCleared = 4;
            c.Inventory.Items.Clear();
            int fee = GuildSystem.StorageFee(c);
            Assert.AreEqual(30, fee);
            var item = ItemDb.CreateConsumable("potion");
            c.Inventory.Add(item);
            c.Gold = fee * 2;
            Assert.IsTrue(GuildSystem.Deposit(c, item.Uid, out _));
            Assert.AreEqual(fee, c.Gold);
            Assert.IsTrue(GuildSystem.Withdraw(c, item.Uid, out _));
            Assert.AreEqual(fee, c.Gold, "찾을 때는 무료 (v1.9)");
            c.Gold = 0;
            Assert.IsFalse(GuildSystem.Deposit(c, item.Uid, out string err), "수수료가 없으면 맡길 수 없다");
            StringAssert.Contains("수수료", err);
        }

        [Test]
        public void ShopSellMany_SellsWholeStacks()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Inventory.Items.Clear();
            var a = ItemDb.CreateConsumable("potion", 3);
            var b = EquipmentFactory.Create(GearType.Boots, ItemGrade.Common, 5, Job.Warrior, Stat.Luck);
            c.Inventory.Add(a);
            c.Inventory.Add(b);
            long expect = (long)a.SellPrice * 3 + b.SellPrice;
            Assert.AreEqual(expect, ShopSystem.SellMany(c, new[] { a.Uid, b.Uid }));
            Assert.AreEqual(0, c.Inventory.Items.Count);
        }

        [Test]
        public void Promotion_HappensAutomaticallyOnSave()
        {
            var s = NewSession();
            s.NewGame("a", Job.Mage, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            s.C.HighestFloorCleared = 6;
            s.C.Level = 10;
            s.C.QuestsCompleted = 8;
            s.Save();
            Assert.AreEqual(Rank.D, s.C.Rank, "F → E → D 두 번 승급");
            CollectionAssert.AreEqual(new[] { Rank.E, Rank.D }, s.Promotions);
            Assert.AreEqual(RankSystem.StorageCapacity(Rank.D), s.C.Storage.Capacity, "창고 칸 등 배지 효과가 바로 적용");
        }

        [Test]
        public void MoveOptions_FixedOrderUpLeftRightDown()
        {
            var map = new FloorMap();
            var center = new Room { Id = 0, X = 1, Y = 1, Visited = true, Cleared = true };
            map.Rooms.Add(center);
            var dirs = new[] { (2, 1), (1, 2), (0, 1), (1, 0) }; // 오른쪽 · 아래 · 왼쪽 · 위 (섞어서)
            foreach (var (x, y) in dirs)
            {
                var r = new Room { Id = map.Rooms.Count, X = x, Y = y, Visited = x == 0 };
                map.Rooms.Add(r);
                center.Links.Add(r.Id);
            }
            var run = new DungeonRun { Floor = 3, Map = map, CurrentRoomId = 0 };
            var order = DungeonSystem.MoveOptions(run, Difficulty.Normal).ConvertAll(o => o.Direction.Split(' ')[0]);
            CollectionAssert.AreEqual(new[] { "위", "왼쪽", "오른쪽", "아래" }, order, "탐험한 방도 자리가 고정");
        }

        [Test]
        public void Continue_BrokenRunAfterUpdate_StartsInTown()
        {
            var store = new MemorySaveStore();
            var s = new GameSession(store, () => new DateTime(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc), 2);
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            s.EnterDungeon();
            var room = s.Run.Map.Rooms.Find(r => r.Type == RoomType.Battle);
            s.Run.CurrentRoomId = room.Id;
            room.Cleared = false;
            s.Run.Effects.Add(null); // 예전 버전 데이터처럼 이어 갈 수 없는 진행
            s.Save();
            int level = s.C.Level;

            var again = new GameSession(store, () => new DateTime(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc), 2);
            Assert.IsTrue(again.Continue());
            Assert.IsFalse(again.InDungeon, "던전 진행만 버리고 마을에서");
            Assert.AreEqual(level, again.C.Level, "캐릭터는 그대로");
        }
    }
}

using System;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>
    /// 기획서 v1.9: 기본 공격이 가장 잘 맞음, 스킬 등급별 피해·수련 상승폭, 강화 +15·강등, 보스 특성별 체격,
    /// 배운 스킬서 구매 금지, 중복 장착 정리.
    /// </summary>
    public class V19Tests
    {
        [Test]
        public void BasicAttack_HasTheHighestHitChance()
        {
            foreach (var s in SkillDb.AllSkills)
            {
                if (s.Target == SkillTarget.Self) continue;
                Assert.Less(s.SuccessBonus, 0, s.Id + ": 모든 스킬은 기본 공격보다 덜 맞는다");
                double total = (s.ChainMults.Length > 0 ? s.ChainMults[0] : s.DamageMult) * s.Hits;
                bool strong = s.Target == SkillTarget.AllEnemies || s.GuaranteedCrit || total >= 2.5;
                if (strong) Assert.LessOrEqual(s.SuccessBonus, -0.08 + 1e-9, s.Id + " 고위력 −8~12%");
                else Assert.GreaterOrEqual(s.SuccessBonus, -0.05 - 1e-9, s.Id + " 저위력 −3~5%");
            }
        }

        [Test]
        public void HigherTierSkills_HitHarderAndGrowFaster()
        {
            Assert.Less(SkillSystem.PowerMultiplier(SkillDb.Get("m_fireball"), 3), SkillSystem.PowerMultiplier(SkillDb.Get("m_overload"), 3));
            Assert.AreEqual(1.24, SkillSystem.PowerMultiplier(SkillDb.Get("m_fireball"), 3), 1e-9, "하급 +8%/단계");
            Assert.AreEqual(1.36, SkillSystem.PowerMultiplier(SkillDb.Get("m_meteor"), 3), 1e-9, "상급 +12%/단계");
            Assert.Greater(SkillDb.Get("m_overload").DamageMult, 4.0, "최상급 기본 피해 상향");
        }

        [Test]
        public void Enhance_UpToFifteen_FailureCanDowngrade()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Gold = 100_000_000;
            c.Inventory.Add(ItemDb.CreateEnhanceStone(99));
            var weapon = c.Equipment[EquipSlot.Weapon];
            weapon.Enhance = 11;
            var rng = new Rng(5);
            int downs = 0, fails = 0;
            for (int i = 0; i < 400; i++)
            {
                weapon.Enhance = 11;
                var r = Blacksmith.Enhance(c, weapon.Uid, rng, out _);
                if (r == EnhanceResult.Downgraded)
                {
                    downs++;
                    Assert.AreEqual(10, weapon.Enhance);
                }
                if (r == EnhanceResult.Failed) fails++;
                if (c.Inventory.CountOf(ItemDb.EnhanceStoneId) < 3) c.Inventory.Add(ItemDb.CreateEnhanceStone(99));
            }
            Assert.That(downs / (double)(downs + fails), Is.InRange(0.4, 0.6), "+12 도전 실패의 절반은 강등");
            weapon.Enhance = 5;
            Assert.AreEqual(0, Blacksmith.DowngradeChance(weapon), "+6 도전은 강등 없음");
            weapon.Enhance = 7;
            Assert.AreEqual(0.3, Blacksmith.DowngradeChance(weapon), 1e-9);
        }

        [Test]
        public void BossTraits_ChangeBodyStats()
        {
            var golem = EnemyFactory.CreateBoss(18, Difficulty.Normal, 1);
            Assert.IsNotNull(golem);
            var sp = MonsterDb.Get("lizardman");
            var plain = EnemyFactory.Create(sp, 20, Difficulty.Normal, 2);
            var boss = EnemyFactory.Create(sp, 20, Difficulty.Normal, 2);
            BossTraits.Equip(boss, 20);
            Assert.Greater(boss.Defense, plain.Defense, "가시 비늘 보스는 방어력이 높다");
            var orc = EnemyFactory.Create(MonsterDb.Get("orc"), 10, Difficulty.Normal, 2);
            int atk = orc.Attack;
            BossTraits.Equip(orc, 10);
            Assert.Greater(orc.Attack, atk, "혼신의 일격 보스는 공격력이 높다");
        }

        [Test]
        public void EnhanceStones_DropFromTwoFloorsBeforeTheyAreNeeded()
        {
            Assert.AreEqual(6, GameBalance.RecommendedEnhance(12), "적정 강화 = 층 ÷ 2");
            Assert.AreEqual(10, GameBalance.StoneFirstFloor, "+6(강화석 필요)이 적정인 12층보다 2층 앞");
            var c = Character.Create("a", Job.Warrior);
            var rng = new Rng(4);
            for (int i = 0; i < 300; i++)
                Assert.IsFalse(LootSystem.Treasure(9, c, rng).Items.Exists(x => x.Kind == ItemKind.EnhanceStone), "9층 보물에는 강화석 없음");
            bool seen = false;
            for (int i = 0; i < 300 && !seen; i++) seen = LootSystem.Treasure(10, c, rng).Items.Exists(x => x.Kind == ItemKind.EnhanceStone);
            Assert.IsTrue(seen, "10층부터 강화석");
        }

        [Test]
        public void EnhanceCost_GrowsWithItemLevelAndGrade()
        {
            var low = EquipmentFactory.Create(GearType.Weapon, ItemGrade.Common, 10, Job.Warrior, Stat.Luck);
            var high = EquipmentFactory.Create(GearType.Weapon, ItemGrade.Legendary, 50, Job.Warrior, Stat.Luck);
            low.Enhance = high.Enhance = 5;
            Assert.AreEqual(30 * 6 * 2, Blacksmith.GoldCost(low), "30 × +6 × (1 + 10 ÷ 10) × 일반 1.0");
            Assert.AreEqual(30 * 6 * 6 * 3, Blacksmith.GoldCost(high), "30 × +6 × (1 + 50 ÷ 10) × 전설 3.0");
        }

        [Test]
        public void Shop_RefusesKnownSkillBooks()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Gold = 100000;
            var shop = new ShopState();
            shop.Goods.Add(new ShopGood { Item = ItemDb.CreateSkillBook("w_bash"), Stock = 1 });
            Assert.IsFalse(ShopSystem.BuyGood(shop, c, shop.Goods[0].Item.Uid, 1, out string err));
            Assert.AreEqual("이미 배운 스킬입니다", err);
            Assert.AreEqual(100000, c.Gold);
        }

        [Test]
        public void Repair_RemovesDuplicateEquippedSkills()
        {
            var store = new MemorySaveStore();
            var s = new GameSession(store, () => new DateTime(2026, 10, 21, 9, 0, 0, DateTimeKind.Utc), 1);
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            s.C.Skills.Equipped.Add("w_bash");
            s.Save();
            Assert.IsTrue(s.Continue());
            Assert.AreEqual(1, s.C.Skills.Equipped.FindAll(id => id == "w_bash").Count);
        }
    }
}

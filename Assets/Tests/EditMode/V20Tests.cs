using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>
    /// 기획서 v2.0: 장비 비중 40% 이하, 레벨 우선 기본 수치·등급별 강화폭, 반지 교체 우선순위,
    /// 내 레벨에 맞춘 드롭, 피의 우물 대가, 예전 장비 수치 갱신.
    /// </summary>
    public class V20Tests
    {
        /// <summary>그 층 적정 장비(층 등급 · 층 ÷ 2 강화, 장신구 3개 모두 주 공격 능력치)를 낀 캐릭터.</summary>
        private static Character FairHero(Job job, int floor)
        {
            var c = Character.Create("a", job);
            int level = Math.Max(1, (int)Math.Round(floor * 1.9 - 0.5));
            while (c.Level < level) Leveling.AddExp(c, GameBalance.ExpToNext(c.Level));
            Leveling.AutoAllocate(c);
            c.Rank = (Rank)Math.Min((int)Rank.S, floor / 5);
            int lv = Math.Min(c.Level, floor * 2 - 1);
            foreach (var gear in new[] { GearType.Helmet, GearType.Armor, GearType.Pants, GearType.Boots, GearType.Necklace, GearType.Ring, GearType.Ring, GearType.Weapon })
            {
                var item = EquipmentFactory.Create(gear, GameBalance.FairGrade(floor), lv, job, c.JobData.AttackStat);
                item.Enhance = GameBalance.RecommendedEnhance(floor);
                c.Inventory.Add(item);
                Assert.IsTrue(EquipmentSystem.Equip(c, item.Uid, out string err), err);
            }
            return c;
        }

        [Test]
        public void FairGear_NeverExceedsFortyPercent()
        {
            foreach (Job job in Enum.GetValues(typeof(Job)))
            {
                for (int f = 1; f <= GameBalance.MaxFloor; f++)
                {
                    var c = FairHero(job, f);
                    var main = c.JobData.AttackStat;
                    double weapon = CharacterStats.WeaponAttack(c) / (double)CharacterStats.Attack(c);
                    double armor = 1 - GameBalance.DefenseConstant / (GameBalance.DefenseConstant + CharacterStats.Defense(c));
                    double acc = CharacterStats.EquipmentBonus(c, main) / (double)CharacterStats.Total(c, main);
                    string at = job + " " + f + "층";
                    Assert.LessOrEqual(weapon, GameBalance.MaxGearShare, at + " 무기 몫");
                    Assert.LessOrEqual(armor, GameBalance.MaxGearShare + 1e-9, at + " 방어구 피해 감소");
                    Assert.LessOrEqual(acc, GameBalance.MaxGearShare, at + " 장신구 몫");
                }
            }
        }

        [Test]
        public void FairGear_StrongestSkillDoesNotOneShotAnElite()
        {
            for (int f = 1; f <= GameBalance.MaxFloor; f++)
            {
                var c = FairHero(Job.Warrior, f);
                double hit = CharacterStats.Attack(c) * GameBalance.DefenseConstant / (GameBalance.DefenseConstant + GameBalance.EnemyDefense(f));
                double best = 1;
                foreach (var s in SkillDb.ForJob(c.Job, (SkillTier[])Enum.GetValues(typeof(SkillTier))))
                    if (s.ReqLevel <= c.Level && s.Target == SkillTarget.SingleEnemy) best = Math.Max(best, s.DamageMult * s.Hits);
                Assert.Greater(GameBalance.EnemyHp(f) * GameBalance.EliteHp, hit * best * 1.5, f + "층 정예");
                Assert.Greater(GameBalance.EnemyHp(f), hit * 2.5, f + "층 일반 몬스터는 기본 공격 세 번쯤");
            }
        }

        [Test]
        public void HigherLevel_BeatsHigherGrade_WhenTheGapIsLarge()
        {
            foreach (GearType gear in EquipmentFactory.AllGear)
            {
                for (int lv = 20; lv <= GameBalance.MaxLevel; lv += 10)
                {
                    int high = EquipmentFactory.BaseValue(gear, lv, ItemGrade.Uncommon);
                    int low = EquipmentFactory.BaseValue(gear, lv - 10, ItemGrade.Rare);
                    Assert.GreaterOrEqual(high, low, gear + " Lv." + lv + " 고급 ≥ Lv." + (lv - 10) + " 희귀");
                }
                // 레벨 차이가 적으면 높은 등급이 앞설 수 있다
                Assert.Greater(EquipmentFactory.BaseValue(gear, 59, ItemGrade.Legendary), EquipmentFactory.BaseValue(gear, 60, ItemGrade.Common), gear + " 1레벨 차이");
            }
        }

        [Test]
        public void Enhancement_GrowsMoreForHigherGrades_AndAlwaysRises()
        {
            double prev = 0;
            foreach (ItemGrade g in Enum.GetValues(typeof(ItemGrade)))
            {
                var w = EquipmentFactory.Create(GearType.Weapon, g, 30, Job.Warrior, Stat.Strength);
                double growth = (w.ValueAt(15) - w.BaseValue) / (double)w.BaseValue;
                Assert.Greater(growth, prev, g + " 강화 상승폭");
                prev = growth;
            }
            foreach (GearType gear in EquipmentFactory.AllGear)
            {
                var item = EquipmentFactory.Create(gear, ItemGrade.Common, 1, Job.Warrior, Stat.Strength);
                for (int e = 0; e < GameBalance.MaxEnhance; e++)
                {
                    if (item.IsAccessory) Assert.GreaterOrEqual(item.ValueAt(e + 2), item.ValueAt(e) + 1, gear + " 2단계마다 최소 +1");
                    else Assert.Greater(item.ValueAt(e + 1), item.ValueAt(e), gear + " +" + (e + 1) + "은 항상 오른다");
                }
            }
        }

        private static ItemInstance Ring(Stat stat, int value)
        {
            var r = EquipmentFactory.Create(GearType.Ring, ItemGrade.Common, 10, Job.Warrior, stat);
            r.BaseValue = value;
            return r;
        }

        [Test]
        public void Rings_ReplaceTheLessImportantOne_AndCompareHonestly()
        {
            var c = Character.Create("a", Job.Warrior); // 주요 능력치: 체력·힘·강인함
            c.Equipment[EquipSlot.Ring1] = Ring(Stat.Strength, 6);
            c.Equipment[EquipSlot.Ring2] = Ring(Stat.Luck, 3);
            var luckBig = Ring(Stat.Luck, 9);
            var strSmall = Ring(Stat.Strength, 2);
            var vitSmall = Ring(Stat.Vitality, 2);
            c.Level = 30;

            // 주요 능력치가 아닌 행운 반지를 먼저 바꾼다 (반지 1의 수치가 더 커도)
            Assert.AreEqual(EquipSlot.Ring2, EquipmentSystem.SlotFor(c, GearType.Ring));
            Assert.AreEqual(6, EquipmentSystem.Summary(c, luckBig).Delta, "행운 3 → 9");
            // 주요 능력치 반지로 비주요 반지를 바꾸면 좋아짐
            var s = EquipmentSystem.Summary(c, vitSmall);
            Assert.Greater(s.Delta, 0);
            Assert.AreEqual("체력", s.Label);

            // 둘 다 주요 능력치면 수치가 낮은 반지를 바꾸고, 수치 차이로 판단한다
            c.Equipment[EquipSlot.Ring2] = Ring(Stat.Vitality, 4);
            Assert.AreEqual(EquipSlot.Ring2, EquipmentSystem.SlotFor(c, GearType.Ring));
            Assert.AreEqual(-2, EquipmentSystem.Summary(c, strSmall).Delta, "힘 2 ↔ 체력 4");

            // 비주요 능력치 반지로 주요 반지를 바꾸면 수치가 커도 나빠짐
            c.Equipment[EquipSlot.Ring1] = Ring(Stat.Strength, 2);
            c.Equipment[EquipSlot.Ring2] = Ring(Stat.Strength, 3);
            var d = EquipmentSystem.Summary(c, luckBig);
            Assert.Less(d.Delta, 0);
            Assert.AreEqual("힘", d.Label);

            c.Inventory.Add(luckBig);
            Assert.IsTrue(EquipmentSystem.Equip(c, luckBig.Uid, out _));
            Assert.AreEqual(luckBig, c.Equipment[EquipSlot.Ring1], "수치가 낮은 반지 1을 바꿈");
        }

        [Test]
        public void Drops_FavorMyLevel()
        {
            var c = Character.Create("a", Job.Warrior);
            while (c.Level < 10) Leveling.AddExp(c, GameBalance.ExpToNext(c.Level));
            var rng = new Rng(3);
            int above = 0, upgraded = 0, n = 4000;
            for (int i = 0; i < n; i++)
            {
                var item = EquipmentFactory.CreateDrop(rng, ItemGrade.Common, 6, c); // 층 기준 9~13레벨
                if (item.LevelReq > c.Level) above++;
                else if (item.LevelReq < c.Level && item.Grade == ItemGrade.Uncommon) upgraded++;
            }
            Assert.That(above / (double)n, Is.InRange(0.15, 0.35), "내 레벨보다 높은 장비는 절반으로 (원래 약 40%)");
            Assert.Greater(upgraded, 0, "낮은 레벨 장비는 가끔 한 등급 위");

            while (c.Level < 14) Leveling.AddExp(c, GameBalance.ExpToNext(c.Level)); // 상급(Lv.18)이 +5 안에 들어옴
            int over = 0;
            for (int i = 0; i < 2000; i++)
            {
                var list = SkillDb.PreferOwnLevel(SkillDb.Obtainable(c, Job.Warrior), c, rng);
                if (list.Exists(s => s.ReqLevel > c.Level)) over++;
            }
            Assert.That(over / 2000.0, Is.InRange(0.4, 0.6), "레벨 위 스킬서는 절반 확률로 빠짐");
        }

        [Test]
        public void BloodWell_RiskRisesWithEachOffering()
        {
            for (int i = 1; i < EventRules.BloodRisk.Length; i++) Assert.Greater(EventRules.BloodRisk[i], EventRules.BloodRisk[i - 1]);
            int cursed = 0;
            for (int seed = 0; seed < 200; seed++)
            {
                var s = new GameSession(new MemorySaveStore(), () => DateTime.UtcNow, seed);
                s.NewGame("a", Job.Warrior, Difficulty.Normal);
                s.SetTutorial(TutorialStage.Done);
                s.EnterDungeon();
                var c = s.C;
                var room = s.Run.Current;
                room.EventId = "evt_blood_well";
                while (c.Level < 30) Leveling.AddExp(c, GameBalance.ExpToNext(c.Level));
                for (int step = 0; step < EventRules.BloodRisk.Length; step++)
                {
                    c.CurrentHp = CharacterStats.MaxHp(c);
                    room.Cleared = false;
                    room.EventStep = step;
                    var r = EventRules.Resolve(s.Run, c, 0, new Rng(seed * 7 + step));
                    if (r.Text.Contains("\n")) cursed++;
                }
            }
            double rate = cursed / (200.0 * EventRules.BloodRisk.Length);
            double expected = 0;
            foreach (double p in EventRules.BloodRisk) expected += p / EventRules.BloodRisk.Length;
            Assert.AreEqual(expected, rate, 0.06, "평균 대가 확률");
        }

        [Test]
        public void OldSave_EquipmentValuesFollowTheNewFormula()
        {
            var store = new MemorySaveStore();
            var s = new GameSession(store, () => DateTime.UtcNow, 1);
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            var item = EquipmentFactory.Create(GearType.Armor, ItemGrade.Rare, 30, Job.Warrior, Stat.Strength);
            item.BaseValue = 999; // 예전 공식으로 만든 장비
            s.C.Inventory.Add(item);
            s.Save();
            var loaded = SaveSystem.Load(store);
            Assert.AreEqual(EquipmentFactory.BaseValue(GearType.Armor, 30, ItemGrade.Rare), loaded.Character.Inventory.Find(item.Uid).BaseValue);
        }
    }
}

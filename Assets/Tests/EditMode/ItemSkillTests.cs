using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    public class ItemSkillTests
    {
        private static Character NewWarrior()
        {
            var c = Character.Create("에단", Job.Warrior);
            c.Inventory.Clear();
            return c;
        }

        [Test]
        public void NewCharacter_StartsWithWeaponPotionsAndSkill()
        {
            var c = Character.Create("a", Job.Mage);
            Assert.IsNotNull(c.Equipment[EquipSlot.Weapon]);
            Assert.AreEqual((int)Job.Mage, c.Equipment[EquipSlot.Weapon].JobRestriction);
            Assert.AreEqual(3, c.Inventory.CountOf("potion"));
            Assert.IsTrue(c.Skills.IsEquipped("m_fireball"));
            Assert.AreEqual(20, c.Inventory.Capacity);
        }

        [Test]
        public void Container_StacksUpTo99AndSplits()
        {
            var inv = new ItemContainer { Capacity = 3 };
            Assert.IsTrue(inv.Add(ItemDb.CreateConsumable("potion", 60)));
            Assert.IsTrue(inv.Add(ItemDb.CreateConsumable("potion", 60)));
            Assert.AreEqual(2, inv.UsedCells);
            Assert.AreEqual(120, inv.CountOf("potion"));
            Assert.IsTrue(inv.Add(ItemDb.CreateConsumable("antidote", 1)));
            Assert.IsFalse(inv.Add(ItemDb.CreateConsumable("bandage", 1)), "칸이 없으면 실패");
            Assert.IsTrue(inv.Add(ItemDb.CreateConsumable("potion", 78)), "기존 칸에 겹칠 수 있으면 성공");
            Assert.AreEqual(198, inv.CountOf("potion"));
            Assert.IsFalse(inv.Add(ItemDb.CreateConsumable("potion", 1)));
        }

        [Test]
        public void Container_RemoveTemplateAcrossCells()
        {
            var inv = new ItemContainer { Capacity = 5 };
            inv.Add(ItemDb.CreateMaterial("mat_goblin", 99));
            inv.Add(ItemDb.CreateMaterial("mat_goblin", 10));
            Assert.IsFalse(inv.RemoveTemplate("mat_goblin", 200));
            Assert.IsTrue(inv.RemoveTemplate("mat_goblin", 105));
            Assert.AreEqual(4, inv.CountOf("mat_goblin"));
            Assert.AreEqual(1, inv.UsedCells);
        }

        [Test]
        public void Container_TakePartialStack()
        {
            var inv = new ItemContainer { Capacity = 5 };
            var stack = ItemDb.CreateConsumable("potion", 5);
            inv.Add(stack);
            var taken = inv.Take(stack.Uid, 2);
            Assert.AreEqual(2, taken.Count);
            Assert.AreEqual(3, inv.CountOf("potion"));
            Assert.AreNotEqual(stack.Uid, taken.Uid);
        }

        [Test]
        public void Equipment_CompareWithEquipped()
        {
            var c = NewWarrior();
            var cur = c.Equipment[EquipSlot.Weapon];
            var better = EquipmentFactory.Create(GearType.Weapon, ItemGrade.Rare, 5, Job.Warrior, Stat.Vitality);
            var d = EquipmentSystem.Compare(c, better);
            Assert.AreEqual(1, d.Count);
            Assert.AreEqual("공격력", d[0].Label);
            Assert.AreEqual(better.Value - cur.Value, d[0].Delta);
            Assert.AreEqual(0, EquipmentSystem.Compare(c, cur).Count, "착용 중인 장비는 비교하지 않는다");

            var helm = EquipmentFactory.Create(GearType.Helmet, ItemGrade.Common, 1, Job.Warrior, Stat.Vitality);
            Assert.AreEqual(helm.Value, EquipmentSystem.Compare(c, helm)[0].Delta, "빈 칸이면 전부 증가");

            var ringA = EquipmentFactory.Create(GearType.Ring, ItemGrade.Common, 1, Job.Warrior, Stat.Luck);
            c.Equipment[EquipSlot.Ring1] = ringA;
            var ringB = EquipmentFactory.Create(GearType.Ring, ItemGrade.Common, 1, Job.Warrior, Stat.Strength);
            Assert.AreEqual(1, EquipmentSystem.Compare(c, ringB).Count, "반지 2번 칸이 비어 있으면 그쪽에 낀다");
            c.Equipment[EquipSlot.Ring2] = ringA.CloneWithCount(1);
            var cmp = EquipmentSystem.Compare(c, ringB);
            Assert.AreEqual(2, cmp.Count, "다른 능력치 반지와 바꾸면 + 하나, - 하나");
            Assert.Less(cmp[1].Delta, 0);
        }

        [Test]
        public void Equipment_ChecksLevelAndJob()
        {
            var c = NewWarrior();
            var bow = EquipmentFactory.Create(GearType.Weapon, ItemGrade.Common, 1, Job.Archer, Stat.Luck);
            var sword = EquipmentFactory.Create(GearType.Weapon, ItemGrade.Uncommon, 10, Job.Warrior, Stat.Luck);
            c.Inventory.Add(bow);
            c.Inventory.Add(sword);
            Assert.IsFalse(EquipmentSystem.Equip(c, bow.Uid, out string err));
            StringAssert.Contains("궁수", err);
            Assert.IsFalse(EquipmentSystem.Equip(c, sword.Uid, out err));
            StringAssert.Contains("Lv.10", err);
            c.Level = 10;
            var oldWeapon = c.Equipment[EquipSlot.Weapon];
            Assert.IsTrue(EquipmentSystem.Equip(c, sword.Uid, out err));
            Assert.AreSame(sword, c.Equipment[EquipSlot.Weapon]);
            Assert.IsNotNull(c.Inventory.Find(oldWeapon.Uid), "교체된 무기는 가방으로");
            Assert.AreEqual(CharacterStats.Total(c, Stat.Strength) * GameBalance.AttackPerMainStat + sword.Value, CharacterStats.Attack(c));
        }

        [Test]
        public void Equipment_RingsUseBothSlots()
        {
            var c = NewWarrior();
            var r1 = EquipmentFactory.Create(GearType.Ring, ItemGrade.Common, 1, Job.Warrior, Stat.Luck);
            var r2 = EquipmentFactory.Create(GearType.Ring, ItemGrade.Common, 1, Job.Warrior, Stat.Luck);
            c.Inventory.Add(r1);
            c.Inventory.Add(r2);
            Assert.IsTrue(EquipmentSystem.Equip(c, r1.Uid, out _));
            Assert.IsTrue(EquipmentSystem.Equip(c, r2.Uid, out _));
            Assert.AreSame(r1, c.Equipment[EquipSlot.Ring1]);
            Assert.AreSame(r2, c.Equipment[EquipSlot.Ring2]);
            Assert.AreEqual(r1.Value + r2.Value, CharacterStats.EquipmentBonus(c, Stat.Luck));
        }

        [Test]
        public void Equipment_UnequipNeedsSpace()
        {
            var c = NewWarrior();
            c.Inventory.Capacity = 0;
            Assert.IsFalse(EquipmentSystem.Unequip(c, EquipSlot.Weapon, out string err));
            Assert.AreEqual("가방이 가득 찼습니다", err);
            c.Inventory.Capacity = 1;
            Assert.IsTrue(EquipmentSystem.Unequip(c, EquipSlot.Weapon, out _));
            Assert.IsNull(c.Equipment[EquipSlot.Weapon]);
        }

        [Test]
        public void ArmorDefense_SumsArmorOnly()
        {
            var c = NewWarrior();
            c.Level = 60;
            var helm = EquipmentFactory.Create(GearType.Helmet, ItemGrade.Common, 10, Job.Warrior, Stat.Luck);
            var armor = EquipmentFactory.Create(GearType.Armor, ItemGrade.Rare, 10, Job.Warrior, Stat.Luck);
            c.Inventory.Add(helm);
            c.Inventory.Add(armor);
            EquipmentSystem.Equip(c, helm.Uid, out _);
            EquipmentSystem.Equip(c, armor.Uid, out _);
            Assert.AreEqual(6, helm.Value); // 1.6 + 10 × 0.48 = 6.4
            Assert.AreEqual(13, armor.Value); // (3.2 + 10 × 0.8) × 희귀 1.14 = 12.8
            Assert.AreEqual(19, CharacterStats.Defense(c));
        }

        [Test]
        public void Factory_GradeAvailabilityByFloor()
        {
            Assert.AreEqual(ItemGrade.Uncommon, EquipmentFactory.MaxGradeForFloor(1));
            Assert.AreEqual(ItemGrade.Rare, EquipmentFactory.MaxGradeForFloor(5));
            Assert.AreEqual(ItemGrade.Epic, EquipmentFactory.MaxGradeForFloor(12));
            Assert.AreEqual(ItemGrade.Legendary, EquipmentFactory.MaxGradeForFloor(20));
            var rng = new Rng(1);
            for (int i = 0; i < 2000; i++)
            {
                Assert.LessOrEqual((int)EquipmentFactory.RollDropGrade(rng, 4, 2), (int)ItemGrade.Uncommon);
                Assert.AreNotEqual(ItemGrade.Legendary, EquipmentFactory.RollDropGrade(rng, 30, 1));
            }
        }

        [Test]
        public void Blacksmith_SafeUpToPlus5ThenNeedsStones()
        {
            var c = NewWarrior();
            c.Gold = 1_000_000;
            var weapon = c.Equipment[EquipSlot.Weapon];
            var rng = new Rng(7);
            int tries = 0;
            while (weapon.Enhance < 5 && tries++ < 100)
                Assert.AreNotEqual(EnhanceResult.Downgraded, Blacksmith.Enhance(c, weapon.Uid, rng, out _), "+5까지는 내려가지 않는다");
            Assert.AreEqual(5, weapon.Enhance);
            Assert.AreEqual(EnhanceResult.NotAllowed, Blacksmith.Enhance(c, weapon.Uid, rng, out string err));
            Assert.AreEqual("강화석이 부족합니다", err);
            c.Inventory.Add(ItemDb.CreateEnhanceStone(50));
            int guard = 0;
            c.Gold = 100_000_000;
            while (weapon.Enhance < GameBalance.MaxEnhance && guard++ < 5000)
            {
                if (c.Inventory.CountOf(ItemDb.EnhanceStoneId) < 3) c.Inventory.Add(ItemDb.CreateEnhanceStone(99));
                Blacksmith.Enhance(c, weapon.Uid, rng, out _);
            }
            Assert.AreEqual(15, weapon.Enhance);
            Assert.AreEqual(EnhanceResult.NotAllowed, Blacksmith.Enhance(c, weapon.Uid, rng, out err));
            Assert.AreEqual(weapon.BaseValue + System.Math.Max((int)System.Math.Round(weapon.BaseValue * 0.3), 15), weapon.Value, "일반 +15 = +30% (단계마다 최소 +1)");
        }

        [Test]
        public void Blacksmith_SuccessRatesMatchDesign()
        {
            var item = new ItemInstance { Kind = ItemKind.Equipment };
            double[] expected = { 1, 1, 1, 0.95, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.25, 0.20, 0.15, 0.10 };
            for (int i = 0; i < 15; i++)
            {
                item.Enhance = i;
                Assert.AreEqual(expected[i], Blacksmith.SuccessRate(item), 1e-9, "+" + (i + 1));
            }
        }

        [Test]
        public void Skills_SlotLimitAndRequirements()
        {
            var c = NewWarrior();
            Assert.IsTrue(SkillSystem.Learn(c, "w_warcry"));
            Assert.IsTrue(SkillSystem.Learn(c, "w_shield"));
            Assert.IsTrue(SkillSystem.Learn(c, "w_guard"));
            Assert.IsFalse(SkillSystem.Learn(c, "a_aim"), "다른 직업 스킬은 배울 수 없음");
            Assert.IsFalse(SkillSystem.Learn(c, "c_firstaid"), "공용 스킬은 v1.2에서 삭제");
            Assert.IsTrue(SkillSystem.Equip(c, "w_warcry", out _));
            Assert.IsFalse(SkillSystem.Equip(c, "w_shield", out string err));
            StringAssert.Contains("Lv.8", err);
            c.Level = 8;
            c.Rank = Rank.E;
            Assert.IsTrue(SkillSystem.Equip(c, "w_shield", out _));
            Assert.IsFalse(SkillSystem.Equip(c, "w_guard", out err));
            Assert.AreEqual("장착 슬롯이 가득 찼습니다", err);
            c.Rank = Rank.D;
            Assert.IsTrue(SkillSystem.Equip(c, "w_guard", out _));
            Assert.AreEqual(4, c.Skills.Equipped.Count);
        }

        [Test]
        public void SkillBook_TeachesOnceAndIsConsumed()
        {
            var c = NewWarrior();
            var book = ItemDb.CreateSkillBook("w_whirl", 2);
            c.Inventory.Add(book);
            Assert.IsTrue(SkillSystem.UseSkillBook(c, book.Uid, out _));
            Assert.IsTrue(c.Skills.Knows("w_whirl"));
            Assert.AreEqual(1, c.Inventory.CountOf("book_w_whirl"));
            Assert.IsFalse(SkillSystem.UseSkillBook(c, book.Uid, out string err));
            Assert.AreEqual("이미 배운 스킬입니다", err);
        }

        [Test]
        public void Training_CostsAndCaps()
        {
            var c = NewWarrior();
            c.Gold = 200 + 400 + 600 + 800 + 1000;
            for (int i = 0; i < 5; i++) Assert.IsTrue(SkillSystem.Train(c, "w_bash", out _));
            Assert.AreEqual(0, c.Gold);
            Assert.AreEqual(5, c.Skills.Get("w_bash").Level);
            Assert.IsFalse(SkillSystem.Train(c, "w_bash", out string err));
            Assert.AreEqual("최대 강화 단계입니다", err);
            Assert.AreEqual(1.4, SkillSystem.PowerMultiplier(SkillDb.Get("w_bash"), 5), 1e-9, "하급 +8% × 5");
            Assert.AreEqual(1.75, SkillSystem.PowerMultiplier(SkillDb.Get("w_earth"), 5), 1e-9, "최상급 +15% × 5");
        }

        [Test]
        public void SkillDescriptions_ReadNaturally()
        {
            Assert.AreEqual("단일 250% · 재사용 4턴", SkillDb.Get("w_bash").Description);
            Assert.AreEqual("단일 165% + 60% 확률로 기절 1턴 · 재사용 5턴", SkillDb.Get("w_shield").Description);
            Assert.AreEqual("강화 3턴 · 재사용 6턴", SkillDb.Get("w_warcry").Description);
            Assert.AreEqual("모든 적 215% · 재사용 6턴", SkillDb.Get("w_whirl").Description);
            Assert.AreEqual("성공률 −12%", SkillDb.Get("w_bash").SuccessText);
            Assert.AreEqual("성공률 −5%", SkillDb.Get("w_shield").SuccessText);
            Assert.AreEqual("성공률 −3%", SkillDb.Get("a_aim").SuccessText);
            Assert.AreEqual("성공률 100%", SkillDb.Get("w_guard").SuccessText);
        }

        [Test]
        public void EverySkillAndMaterial_IsValid()
        {
            Assert.AreEqual(26, SkillDb.AllSkills.Length, "직업 6개씩 + 도적 치명 버프 2개, 공용 스킬 없음");
            foreach (var s in SkillDb.AllSkills)
            {
                Assert.IsNotEmpty(s.Name);
                Assert.IsNotEmpty(s.Effect, s.Id);
                Assert.GreaterOrEqual(s.JobRestriction, 0, s.Id);
                Assert.Greater(s.Cooldown, 0, s.Id);
                Assert.IsTrue(s.IsAttack || s.Statuses.Length > 0, s.Id);
                Assert.IsNotNull(ItemDb.CreateSkillBook(s.Id));
            }
            foreach (var m in MonsterDb.AllSpecies)
                if (!string.IsNullOrEmpty(m.MaterialId)) Assert.IsNotNull(ItemDb.Material(m.MaterialId), m.Id);
            foreach (Job j in System.Enum.GetValues(typeof(Job)))
            {
                bool rogue = j == Job.Rogue;
                Assert.AreEqual(rogue ? 5 : 4, SkillDb.ForJob(j, SkillTier.Low, SkillTier.Mid).Count);
                Assert.AreEqual(rogue ? 3 : 2, SkillDb.ForJob(j, SkillTier.High, SkillTier.Top).Count);
            }
        }
    }
}

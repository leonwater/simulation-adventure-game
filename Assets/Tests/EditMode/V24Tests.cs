using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>기획서 v2.4: 방 배치 규칙, 강인함, 소모품 99개, 수련 불가, 상태 이상 실제 확률, 이벤트 중복, 스킬 순서.</summary>
    public class V24Tests
    {
        [Test]
        public void RoomLayout_NoSameNeighborsExceptBattle_AndNoRestNextToStart()
        {
            var rng = new Rng(24);
            int bad = 0, floors = 400;
            for (int i = 0; i < floors; i++)
            {
                var map = DungeonGenerator.Generate(1 + i % 30, rng);
                bad += DungeonGenerator.Violations(map) > 0 ? 1 : 0;
                foreach (int l in map.Start.Links)
                    Assert.AreNotEqual(RoomType.Rest, map.Get(l).Type, "시작 방 바로 옆에는 휴식 방이 없다");
            }
            Assert.LessOrEqual(bad, floors / 100, "규칙을 어긴 층은 거의 없다 (방 종류가 모자란 드문 경우만)");
        }

        [Test]
        public void Toughness_ReductionIsLowerAndCapped()
        {
            var w = Character.Create("a", Job.Warrior);
            w.BaseStats[Stat.Toughness] = 40;
            Assert.AreEqual(0.14, CharacterStats.DamageReduction(w), 1e-9, "강인함 40 = 14%");
            w.BaseStats[Stat.Toughness] = 99;
            Assert.AreEqual(0.30, CharacterStats.DamageReduction(w), 1e-9, "최대 30%");
        }

        [Test]
        public void StatusOnlySkills_CannotBeTrained()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Gold = 100_000;
            SkillSystem.Learn(c, "w_warcry");
            Assert.IsFalse(SkillSystem.CanTrain(SkillDb.Get("w_warcry")));
            Assert.IsFalse(SkillSystem.Train(c, "w_warcry", out string err));
            StringAssert.Contains("바뀌는 것이 없는", err);
            Assert.IsTrue(SkillSystem.CanTrain(SkillDb.Get("w_bash")));
            foreach (var s in SkillDb.AllSkills)
                Assert.AreEqual(s.IsAttack || s.HealRatio > 0, SkillSystem.CanTrain(s), s.Id);
        }

        [Test]
        public void StatusLandChance_MultipliesHitEffectChanceAndResist()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Level = 20;
            SkillSystem.Learn(c, "w_shield");
            var boss = EnemyFactory.Create(MonsterDb.Get("goblin"), 1, Difficulty.Normal, 2);
            var b = new Battle(c, 1, new List<Combatant> { boss }, true, new Rng(1));
            var def = SkillDb.Get("w_shield");
            var stun = def.Statuses[0];
            double hit = b.HitChance(boss, def.SuccessBonus);
            Assert.AreEqual(hit * stun.Chance * (1 - boss.Resist), b.StatusLandChance(def, stun, boss), 1e-9);
            Assert.Less(b.StatusLandChance(def, stun, boss), hit, "표기 명중률보다 실제 기절 확률이 낮다");
        }

        [Test]
        public void ActiveEffectEvents_DoNotReappearOnTheNextFloor()
        {
            var effects = new List<ExploreEffect> { new ExploreEffect(ExploreEffectType.DemonPact, -1) };
            var ids = EventDb.GrantingActiveEffects(effects);
            CollectionAssert.Contains(ids, "evt_demon_whisper");
            var rng = new Rng(9);
            for (int i = 0; i < 200; i++)
            {
                var map = DungeonGenerator.Generate(5, rng, ids);
                foreach (var r in map.Rooms) Assert.AreNotEqual("evt_demon_whisper", r.EventId);
            }
        }

        [Test]
        public void EquippedSkills_CanBeReordered()
        {
            var c = Character.Create("a", Job.Mage);
            c.Level = 40;
            c.Rank = Rank.SS;
            foreach (var id in new[] { "m_bolt", "m_shard" })
            {
                SkillSystem.Learn(c, id);
                SkillSystem.Equip(c, id, out _);
            }
            var before = new List<string>(c.Skills.Equipped);
            Assert.IsTrue(SkillSystem.MoveEquipped(c, 0, before.Count - 1));
            Assert.AreEqual(before[0], c.Skills.Equipped[before.Count - 1]);
            Assert.AreEqual(before[1], c.Skills.Equipped[0]);
            Assert.IsFalse(SkillSystem.MoveEquipped(c, 0, 99));
        }
    }
}

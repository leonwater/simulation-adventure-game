using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>기획서 v1.2 스킬·전투 규칙.</summary>
    public class SkillV12Tests
    {
        private static Battle Setup(Job job, string skill, int enemies, out Character c, int seed = 1, bool ambush = false)
        {
            c = Character.Create("테스트", job);
            c.Level = 40;
            c.Rank = Rank.SS;
            if (skill != null)
            {
                SkillSystem.Learn(c, skill);
                SkillSystem.Equip(c, skill, out _);
            }
            var list = new List<Combatant>();
            for (int i = 0; i < enemies; i++)
            {
                var e = EnemyFactory.Create(MonsterDb.Get("goblin"), 1, Difficulty.Normal, 0);
                e.MaxHp = e.Hp = 100000;
                e.Attack = 1;
                e.Requirement = -1000; // 항상 명중 (95%)
                list.Add(e);
            }
            EnemyFactory.NameDuplicates(list);
            return new Battle(c, 1, list, false, new Rng(seed), ambush);
        }

        private static BattleChoice Choice(Battle b, string skill, int target = 0) =>
            b.GetChoices().Find(x => x.SkillId == skill && (x.Target == target || x.Target < 0));

        [Test]
        public void BasicAttack_NeverCrits_AndMageDealsSixtyPercent()
        {
            var b = Setup(Job.Warrior, null, 1, out var w);
            var m = Setup(Job.Mage, null, 1, out var mage);
            for (int i = 0; i < 30; i++)
            {
                b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack));
                foreach (var ev in b.LastEvents) Assert.AreNotEqual(DamageKind.Crit, ev.Damage);
            }
            var target = new Combatant { Defense = 0 };
            var mp = m.Player;
            int full = Battle.Damage(mp, target, 1.0, false);
            int basic = Battle.Damage(mp, target, mage.JobData.BasicAttackMultiplier, false);
            Assert.AreEqual(System.Math.Round(full * 0.6), basic, 1);
        }

        [Test]
        public void MultiHitSkills_RollEachHit()
        {
            var b = Setup(Job.Archer, "a_storm", 1, out _);
            b.Execute(Choice(b, "a_storm"));
            int hits = 0;
            foreach (var ev in b.LastEvents)
                if (ev.Actor == -1 && (ev.Kind == BattleEventKind.Damage || ev.Kind == BattleEventKind.Miss)) hits++;
            Assert.AreEqual(7, hits, "폭풍 사격 7회 각각 판정");
        }

        [Test]
        public void Ambush_FirstTurnCrit_And_SmokeNextCrit()
        {
            var b = Setup(Job.Rogue, "r_ambush", 1, out _);
            b.Execute(Choice(b, "r_ambush"));
            Assert.IsTrue(b.LastEvents.Exists(e => e.Damage == DamageKind.Crit), "기습: 첫 턴 확정 치명타");

            var s = Setup(Job.Rogue, "r_smoke", 1, out var c);
            SkillSystem.Learn(c, "r_venom");
            SkillSystem.Equip(c, "r_venom", out _);
            s.Execute(Choice(s, "r_smoke"));
            Assert.IsTrue(s.NextSkillCrit);
            Assert.IsTrue(s.Player.Statuses.Has(StatusType.Swift));
            s.Execute(Choice(s, "r_venom"));
            Assert.IsTrue(s.LastEvents.Exists(e => e.Damage == DamageKind.Crit), "연막 다음 스킬 확정 치명타");
            Assert.IsFalse(s.NextSkillCrit);
        }

        [Test]
        public void Assassinate_ExecutesLowHpTargets()
        {
            var b = Setup(Job.Rogue, "r_assassin", 2, out _);
            b.Enemies[0].Hp = 100000;
            b.Enemies[1].Hp = 20000; // 20%
            var target = b.Enemies[0];
            int normal = Battle.Damage(b.Player, target, 2.0, true);
            int execute = Battle.Damage(b.Player, target, 2.0 * 1.5, true);
            b.Execute(Choice(b, "r_assassin", 1));
            var hit = b.LastEvents.Find(e => e.Kind == BattleEventKind.Damage && e.Actor == -1);
            Assert.That(hit.Amount, Is.InRange(execute - 2, execute + 2 + execute / 10), "HP 30% 이하면 ×1.5");
            Assert.Greater(execute, normal);
        }

        [Test]
        public void ChainLightning_HitsThreeWithFalloff_IceLanceHitsTwo()
        {
            var b = Setup(Job.Mage, "m_chain", 4, out var c);
            SkillSystem.Learn(c, "m_ice");
            SkillSystem.Equip(c, "m_ice", out _);
            b.Execute(Choice(b, "m_chain", 2));
            var dmg = b.LastEvents.FindAll(e => e.Kind == BattleEventKind.Damage && e.Actor == -1);
            var targets = new HashSet<int>();
            foreach (var d in dmg) targets.Add(d.Target);
            Assert.AreEqual(3, targets.Count + b.LastEvents.FindAll(e => e.Kind == BattleEventKind.Miss && e.Actor == -1).Count);
            Assert.AreEqual(2, b.LastEvents.Find(e => e.Kind == BattleEventKind.Act && e.Actor == -1).Target, "고른 적부터");

            var b2 = Setup(Job.Mage, "m_ice", 4, out _);
            b2.Execute(Choice(b2, "m_ice", 3));
            int touched = b2.LastEvents.FindAll(e => e.Actor == -1 && (e.Kind == BattleEventKind.Damage || e.Kind == BattleEventKind.Miss)).Count;
            Assert.AreEqual(2, touched, "얼음 창은 적 2명");
        }

        [Test]
        public void Mimic_AmbushesAndGuaranteesEquipment()
        {
            var c = Character.Create("a", Job.Warrior);
            var mimic = EnemyFactory.CreateMimic(5, Difficulty.Normal);
            var normal = EnemyFactory.Create(MonsterDb.Get("goblin"), 5, Difficulty.Normal, 0);
            Assert.AreEqual("미믹", mimic[0].Name);
            Assert.AreEqual(System.Math.Round(GameBalance.EnemyHp(5) * 1.5), mimic[0].MaxHp, 1);
            Assert.AreEqual(System.Math.Round(GameBalance.EnemyAttack(5) * 1.3), mimic[0].Attack, 1);
            Assert.AreEqual(normal.GoldReward * 3, mimic[0].GoldReward);
            var b = new Battle(c, 5, mimic, false, new Rng(3), ambush: true);
            Assert.IsTrue(b.LastEvents.Exists(e => e.Actor == 0), "미믹이 먼저 행동");
            Assert.AreEqual(1, b.Turn);
            mimic[0].Hp = 1;
            int guard = 0;
            while (!b.IsOver && guard++ < 50) b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack) ?? b.GetChoices()[0]);
            Assert.AreEqual(BattleOutcome.Victory, b.Outcome);
            var loot = b.CollectRewards(new GuildState(), null);
            Assert.IsTrue(loot.Items.Exists(i => i.Kind == ItemKind.Equipment) || loot.Dropped.Exists(i => i.Kind == ItemKind.Equipment));
        }

        [Test]
        public void SelfSkills_AlwaysSucceed_AndShowFullChance()
        {
            var b = Setup(Job.Warrior, "w_guard", 1, out _);
            var ch = Choice(b, "w_guard");
            Assert.AreEqual(1.0, ch.Chance);
            b.Execute(ch);
            Assert.IsTrue(b.Player.Statuses.Has(StatusType.Fortify));
        }

        /// <summary>
        /// 기획서 '밸런스 확인' 표와 비교하기 위한 시뮬레이션: 적 2마리, 레벨 = 층 × 2 − 1, 자동 배분, 층 등급 장비.
        /// 결과는 테스트 출력으로 남기고, 전투가 지나치게 길거나 짧지 않은지만 확인한다.
        /// </summary>
        [Test]
        public void BalanceCheck_TwoEnemies()
        {
            foreach (int floor in new[] { 1, 10, 30 })
            {
                var line = floor + "층:";
                foreach (Job job in System.Enum.GetValues(typeof(Job)))
                {
                    int turns = 0, lost = 0, n = 0, wins = 0;
                    for (int seed = 0; seed < 60; seed++)
                    {
                        var c = Character.Create("봇", job);
                        Leveling.AddExp(c, 0);
                        c.Level = floor * 2 - 1;
                        c.UnspentPoints = (c.Level - 1) * 3;
                        Leveling.AutoAllocate(c);
                        c.Rank = Rank.SS;
                        foreach (var s in SkillDb.ForJob(job, SkillTier.Low, SkillTier.Mid, SkillTier.High, SkillTier.Top))
                            if (SkillSystem.MeetsRequirement(c, s) && s.Tier != SkillTier.Top) { SkillSystem.Learn(c, s.Id); }
                        foreach (var st in c.Skills.Learned) SkillSystem.Equip(c, st.SkillId, out _);
                        var rng = new Rng(seed);
                        int lv = System.Math.Max(1, floor * 2 - 1);
                        var grade = EquipmentFactory.MaxGradeForFloor(floor) >= ItemGrade.Rare ? ItemGrade.Rare : ItemGrade.Uncommon;
                        foreach (var g in EquipmentFactory.AllGear)
                        {
                            var item = EquipmentFactory.Create(g, grade, lv, job, c.JobData.AttackStat);
                            c.Inventory.Add(item);
                            EquipmentSystem.Equip(c, item.Uid, out _);
                        }
                        c.CurrentHp = CharacterStats.MaxHp(c);
                        var sp = MonsterDb.Get(MonsterDb.ThemeFor(floor).SpeciesIds[1]);
                        var enemies = new List<Combatant> { EnemyFactory.Create(sp, floor, Difficulty.Normal, 0), EnemyFactory.Create(sp, floor, Difficulty.Normal, 0) };
                        var b = new Battle(c, floor, enemies, false, rng);
                        int guard = 0;
                        while (!b.IsOver && guard++ < 60)
                        {
                            var choices = b.GetChoices().FindAll(x => x.Enabled && x.Kind != ActionKind.Flee && x.Kind != ActionKind.Item);
                            BattleChoice best = choices.Find(x => x.Kind == ActionKind.Skill && x.SkillId != null && SkillDb.Get(x.SkillId).IsAttack) ??
                                                choices.Find(x => x.Kind == ActionKind.Skill) ?? choices[0];
                            b.Execute(best);
                        }
                        turns += b.Turn;
                        lost += (int)System.Math.Round(100.0 * (b.Player.MaxHp - b.Player.Hp) / b.Player.MaxHp);
                        if (b.Outcome == BattleOutcome.Victory) wins++;
                        n++;
                    }
                    line += " " + Names.Of(job) + " " + (turns / n) + "턴·HP −" + (lost / n) + "% (승 " + wins + "/" + n + ")";
                    Assert.That(turns / n, Is.InRange(2, 15), job + " " + floor + "층 전투 턴 수");
                }
                TestContext.WriteLine(line);
            }
        }
    }
}

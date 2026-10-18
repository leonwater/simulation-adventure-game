using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    public class BattleTests
    {
        // ── 중첩 규칙 ──

        [Test]
        public void Stacking_DifferentEffectsCoexist()
        {
            var s = new StatusContainer();
            s.Apply(StatusType.Empower, 20, 3);
            s.Apply(StatusType.Fortify, 20, 2);
            Assert.AreEqual(20, s.Value(StatusType.Empower));
            Assert.AreEqual(20, s.Value(StatusType.Fortify));
            Assert.AreEqual(2, s.Visible().Count);
        }

        [Test]
        public void Stacking_SameValueKeepsLongerTurns()
        {
            var s = new StatusContainer();
            s.Apply(StatusType.Poison, 4, 3);
            s.Apply(StatusType.Poison, 4, 1);
            Assert.AreEqual(3, s.Active(StatusType.Poison).Turns);
            s.Apply(StatusType.Poison, 4, 5);
            Assert.AreEqual(5, s.Active(StatusType.Poison).Turns);
            Assert.AreEqual(1, s.All.Count);
        }

        [Test]
        public void Stacking_SameValueSameTurnsLaterWins()
        {
            var s = new StatusContainer();
            s.Apply(StatusType.Weaken, 20, 2);
            var first = s.Active(StatusType.Weaken);
            s.Apply(StatusType.Weaken, 20, 2);
            Assert.AreNotSame(first, s.Active(StatusType.Weaken));
            Assert.AreEqual(1, s.All.Count);
        }

        [Test]
        public void Stacking_HighestValueAppliesThenLowerContinues()
        {
            var s = new StatusContainer();
            s.Apply(StatusType.Empower, 10, 4);
            s.Apply(StatusType.Empower, 30, 1);
            Assert.AreEqual(30, s.Value(StatusType.Empower));
            s.Tick(); // 이번 턴에 걸린 효과는 줄지 않음
            s.Tick();
            Assert.AreEqual(10, s.Value(StatusType.Empower), "높은 쪽이 끝나면 낮은 쪽이 이어서 적용");
            Assert.AreEqual(3, s.Active(StatusType.Empower).Turns);
        }

        [Test]
        public void Tick_FreshEffectsLastFullDuration()
        {
            var s = new StatusContainer();
            s.Apply(StatusType.Empower, 20, 3);
            s.Tick();
            Assert.AreEqual(3, s.Active(StatusType.Empower).Turns);
            s.Tick();
            s.Tick();
            Assert.AreEqual(1, s.Active(StatusType.Empower).Turns);
            s.Tick();
            Assert.IsFalse(s.Has(StatusType.Empower));
        }

        // ── 적 생성 ──

        [Test]
        public void EnemyGroups_SizeNamesAndThemes()
        {
            for (int seed = 0; seed < 500; seed++)
            {
                int floor = 1 + seed % 30;
                var g = EnemyFactory.CreateGroup(floor, Difficulty.Normal, seed);
                Assert.That(g.Count, Is.InRange(1, 4));
                var names = new HashSet<string>();
                foreach (var e in g)
                {
                    Assert.IsTrue(names.Add(e.Name), "이름 중복: " + e.Name);
                    Assert.AreEqual(MonsterDb.ThemeIndex(floor), e.Species.Tier);
                    Assert.Greater(e.MaxHp, 0);
                    Assert.Greater(e.Attack, 0);
                }
            }
            var dup = new List<Combatant> { new Combatant { Name = "고블린" }, new Combatant { Name = "고블린" }, new Combatant { Name = "고블린 궁수" } };
            EnemyFactory.NameDuplicates(dup);
            Assert.AreEqual("고블린 A", dup[0].Name);
            Assert.AreEqual("고블린 B", dup[1].Name);
            Assert.AreEqual("고블린 궁수", dup[2].Name);
        }

        [Test]
        public void Bosses_UniqueOnEveryTenthFloor()
        {
            Assert.AreEqual("고블린 왕", EnemyFactory.CreateBoss(10, Difficulty.Normal, 1)[0].Name);
            Assert.AreEqual("리치", EnemyFactory.CreateBoss(20, Difficulty.Normal, 1)[0].Name);
            Assert.AreEqual("드래곤", EnemyFactory.CreateBoss(30, Difficulty.Normal, 1)[0].Name);
            StringAssert.EndsWith("우두머리", EnemyFactory.CreateBoss(7, Difficulty.Normal, 1)[0].Name);
        }

        [Test]
        public void Difficulty_ScalesEnemyHpAndAttack()
        {
            var sp = MonsterDb.Get("goblin");
            var normal = EnemyFactory.Create(sp, 10, Difficulty.Normal, 0);
            var easy = EnemyFactory.Create(sp, 10, Difficulty.Easy, 0);
            var hard = EnemyFactory.Create(sp, 10, Difficulty.Hard, 0);
            Assert.AreEqual(System.Math.Round(normal.MaxHp * 0.75), easy.MaxHp, 1);
            Assert.AreEqual(System.Math.Round(normal.MaxHp * 1.25), hard.MaxHp, 1);
            Assert.AreEqual(System.Math.Round(normal.Attack * 1.25), hard.Attack, 1);
        }

        // ── 전투 진행 ──

        private static Battle NewBattle(Job job, int floor, int seed, out Character c, int enemies = 2)
        {
            c = Character.Create("에단", job);
            var list = new List<Combatant>();
            for (int i = 0; i < enemies; i++) list.Add(EnemyFactory.Create(MonsterDb.Get("goblin"), floor, Difficulty.Normal, 0));
            EnemyFactory.NameDuplicates(list);
            return new Battle(c, floor, list, false, new Rng(seed));
        }

        [Test]
        public void Choices_OneAttackPerEnemySkillsItemsAndFlee()
        {
            var b = NewBattle(Job.Warrior, 1, 1, out var c);
            var choices = b.GetChoices();
            Assert.AreEqual("공격 · 고블린 A", choices[0].Label);
            Assert.AreEqual("공격 · 고블린 B", choices[1].Label);
            Assert.IsTrue(choices.Exists(x => x.Label == "강타 · 고블린 A"));
            Assert.IsTrue(choices.Exists(x => x.Kind == ActionKind.Item));
            var flee = choices.Find(x => x.Kind == ActionKind.Flee);
            Assert.IsTrue(flee.Enabled);
            foreach (var ch in choices) Assert.That(ch.Chance, Is.InRange(0.05, 1.0));
        }

        [Test]
        public void SkillCooldown_BlocksForStatedTurns()
        {
            var b = NewBattle(Job.Warrior, 1, 2, out var c, 1);
            b.Enemies[0].MaxHp = b.Enemies[0].Hp = 100000;
            int cd = SkillDb.Get("w_bash").Cooldown;
            Assert.AreEqual(4, cd);
            b.Execute(b.GetChoices().Find(x => x.SkillId == "w_bash"));
            Assert.AreEqual(cd, b.Cooldown("w_bash"));
            var again = b.GetChoices().Find(x => x.SkillId == "w_bash");
            Assert.IsFalse(again.Enabled);
            Assert.AreEqual(cd + "턴 후 사용 가능", again.Note);
            for (int i = cd - 1; i >= 0; i--)
            {
                b.Execute(b.GetChoices()[0]);
                Assert.AreEqual(i, b.Cooldown("w_bash"));
            }
            Assert.IsTrue(b.GetChoices().Exists(x => x.SkillId == "w_bash" && x.Enabled));
        }

        [Test]
        public void Turn_EveryChoiceUsesOneTurn()
        {
            var b = NewBattle(Job.Warrior, 1, 3, out var c, 1);
            b.Enemies[0].MaxHp = b.Enemies[0].Hp = 100000;
            Assert.AreEqual(1, b.Turn);
            b.Execute(b.GetChoices()[0]);
            Assert.AreEqual(2, b.Turn);
            b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Item && x.Enabled) ?? b.GetChoices()[0]);
            Assert.AreEqual(3, b.Turn);
        }

        [Test]
        public void Victory_GivesRewardsAndQuestProgress()
        {
            var b = NewBattle(Job.Warrior, 1, 4, out var c, 2);
            var guild = new GuildState();
            guild.Active.Add(new Quest { Id = "q", Kind = QuestKind.Hunt, SpeciesId = "goblin", TargetFloor = 1, Required = 2 });
            foreach (var e in b.Enemies) e.Hp = 1;
            int guard = 0;
            while (!b.IsOver && guard++ < 50) b.Execute(b.GetChoices()[0]);
            Assert.AreEqual(BattleOutcome.Victory, b.Outcome);
            var run = DungeonSystem.StartRun(c, 1, new Rng(1));
            long goldBefore = c.Gold;
            var loot = b.CollectRewards(guild, run);
            Assert.AreEqual(2, b.Defeated.Count);
            Assert.AreEqual(2, guild.Active[0].Progress);
            Assert.AreEqual(GameBalance.EnemyGold(1) * 2, loot.Gold);
            Assert.AreEqual(goldBefore + loot.Gold, c.Gold);
            Assert.AreEqual(2, run.EnemiesDefeated);
        }

        [Test]
        public void Defeat_WhenHpReachesZero()
        {
            var b = NewBattle(Job.Mage, 30, 5, out var c, 4);
            foreach (var e in b.Enemies) e.MaxHp = e.Hp = 1_000_000;
            int guard = 0;
            while (!b.IsOver && guard++ < 200) b.Execute(b.GetChoices()[0]);
            Assert.AreEqual(BattleOutcome.Defeat, b.Outcome);
            Assert.IsNotEmpty(b.KilledBy);
            b.SyncHp();
            Assert.AreEqual(0, c.CurrentHp);
        }

        [Test]
        public void Flee_NotAllowedAgainstBoss()
        {
            var c = Character.Create("a", Job.Rogue);
            var b = new Battle(c, 10, EnemyFactory.CreateBoss(10, Difficulty.Normal, 1), true, new Rng(1));
            var flee = b.GetChoices().Find(x => x.Kind == ActionKind.Flee);
            Assert.IsFalse(flee.Enabled);
            Assert.AreEqual(0, b.FleeChance());
        }

        [Test]
        public void Flee_EventuallySucceeds()
        {
            var b = NewBattle(Job.Rogue, 1, 6, out var c, 1);
            b.Enemies[0].Attack = 0;
            int guard = 0;
            while (!b.IsOver && guard++ < 100) b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Flee));
            Assert.AreEqual(BattleOutcome.Fled, b.Outcome);
        }

        [Test]
        public void Items_PotionHealsAndConsumes()
        {
            var b = NewBattle(Job.Warrior, 1, 7, out var c, 1);
            b.Enemies[0].Attack = 0;
            b.Player.Hp = 10;
            var potion = b.GetItemChoices().Find(x => x.Enabled);
            Assert.IsNotNull(potion);
            b.Execute(potion);
            Assert.Greater(b.Player.Hp, 10);
            Assert.AreEqual(2, c.Inventory.CountOf("potion"));
        }

        [Test]
        public void Stun_SkipsPlayerTurnWithSingleWaitChoice()
        {
            var b = NewBattle(Job.Warrior, 1, 8, out var c, 1);
            b.Enemies[0].Attack = 0;
            b.Player.Statuses.Apply(StatusType.Stun, 1, 1);
            b.Player.Statuses.Tick(); // 적 턴에 걸린 것으로 처리
            var choices = b.GetChoices();
            Assert.AreEqual(1, choices.Count);
            Assert.AreEqual(ActionKind.Wait, choices[0].Kind);
            int hp = b.Enemies[0].Hp;
            b.Execute(choices[0]);
            Assert.AreEqual(hp, b.Enemies[0].Hp);
            Assert.IsFalse(b.Player.Statuses.Has(StatusType.Stun));
        }

        [Test]
        public void Silence_DisablesSkills()
        {
            var b = NewBattle(Job.Warrior, 1, 9, out var c, 1);
            b.Player.Statuses.Apply(StatusType.Silence, 1, 2);
            var bash = b.GetChoices().Find(x => x.SkillId == "w_bash");
            Assert.IsFalse(bash.Enabled);
            Assert.AreEqual("침묵 상태", bash.Note);
        }

        [Test]
        public void SuccessModifiers_FocusBlindFear()
        {
            var b = NewBattle(Job.Warrior, 3, 10, out var c, 1);
            var e = b.Enemies[0];
            double raw = 0.83 + (CharacterStats.Total(c, Stat.Strength) - e.Requirement) * 0.01;
            double Clamp(double v) => System.Math.Max(0.60, System.Math.Min(0.95, v));
            Assert.AreEqual(Clamp(raw), b.HitChance(e), 1e-9);
            b.Player.Statuses.Apply(StatusType.Focus, 10, 3);
            Assert.AreEqual(Clamp(raw + 0.10), b.HitChance(e), 1e-9);
            b.Player.Statuses.Clear();
            b.Player.Statuses.Apply(StatusType.Blind, 15, 3);
            Assert.AreEqual(Clamp(raw - 0.15), b.HitChance(e), 1e-9);
            b.Player.Statuses.Clear();
            double flee = b.FleeChance();
            Assert.AreEqual(System.Math.Min(0.9, 0.60 + b.Player.Evasion), flee, 1e-9, "도주 = 60% + 회피");
            b.Player.Statuses.Apply(StatusType.Fear, 10, 3);
            Assert.AreEqual(Clamp(raw - 0.10), b.HitChance(e), 1e-9);
            Assert.AreEqual(flee, b.FleeChance(), 1e-9, "공포는 도주에 영향 없음");
            StringAssert.Contains("기본 83%", b.GetChoices()[0].Detail);
        }

        [Test]
        public void Damage_FormulaAppliesBuffsAndDefense()
        {
            var a = new Combatant { Attack = 100, CritDamage = 1.5 };
            var t = new Combatant { Defense = 100 };
            Assert.AreEqual(50, Battle.Damage(a, t, 1.0, false));
            Assert.AreEqual(75, Battle.Damage(a, t, 1.0, true));
            a.Statuses.Apply(StatusType.Empower, 20, 3);
            Assert.AreEqual(60, Battle.Damage(a, t, 1.0, false));
            t.Statuses.Apply(StatusType.Vulnerable, 20, 3);
            Assert.AreEqual(72, Battle.Damage(a, t, 1.0, false));
            t.DamageReduction = 0.5;
            Assert.AreEqual(36, Battle.Damage(a, t, 1.0, false));
        }

        [Test]
        public void PoisonAndBurn_TickAtTurnStart()
        {
            var b = NewBattle(Job.Warrior, 1, 11, out var c, 1);
            b.Enemies[0].Attack = 0;
            b.Enemies[0].MaxHp = b.Enemies[0].Hp = 100000;
            b.Player.Statuses.Apply(StatusType.Poison, 4, 2);
            b.Player.Statuses.Apply(StatusType.Burn, 5, 2);
            b.Player.Statuses.Tick();
            b.Enemies[0].Statuses.Apply(StatusType.Stun, 1, 1); // 적은 이번 턴 행동하지 않는다 (최소 피해 1 제외)
            int max = b.Player.MaxHp;
            int hp = b.Player.Hp;
            b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack));
            int poison = (int)System.Math.Max(1, System.Math.Round(max * 0.04));
            Assert.AreEqual(hp - poison - 5, b.Player.Hp);
        }

        [Test]
        public void Josa_PicksCorrectParticle()
        {
            Assert.AreEqual("고블린을", Names.Josa("고블린", "을/를"));
            Assert.AreEqual("슬라임을", Names.Josa("슬라임", "을/를"));
            Assert.AreEqual("고블린 A를", Names.Josa("고블린 A", "을/를"));
            Assert.AreEqual("리치는", Names.Josa("리치", "은/는"));
            Assert.AreEqual("독으로", Names.Josa("독", "으로/로"));
            Assert.AreEqual("출혈로", Names.Josa("출혈", "으로/로"));
            Assert.AreEqual("화상으로", Names.Josa("화상", "으로/로"));
        }

        [Test]
        public void Simulation_ManyBattlesNeverThrow()
        {
            var rng = new Rng(99);
            int wins = 0, total = 0;
            for (int i = 0; i < 400; i++)
            {
                var c = Character.Create("봇", (Job)(i % 4));
                int floor = 1 + i % 30;
                Leveling.AddExp(c, 200 * (long)System.Math.Pow(floor * 2, 2.5));
                Leveling.AutoAllocate(c);
                for (int k = 0; k < 4; k++) SkillSystem.Learn(c, SkillDb.ForJob(c.Job, SkillTier.Low, SkillTier.Mid)[k].Id);
                c.Rank = Rank.C;
                foreach (var s in c.Skills.Learned) SkillSystem.Equip(c, s.SkillId, out _);
                c.CurrentHp = CharacterStats.MaxHp(c);
                var enemies = i % 5 == 0 ? EnemyFactory.CreateBoss(floor, Difficulty.Normal, i) : EnemyFactory.CreateGroup(floor, Difficulty.Normal, i);
                var b = new Battle(c, floor, enemies, i % 5 == 0, rng);
                int guard = 0;
                while (!b.IsOver && guard++ < 300)
                {
                    var choices = b.GetChoices().FindAll(x => x.Enabled && x.Kind != ActionKind.Flee && x.Kind != ActionKind.Item);
                    b.Execute(choices[rng.Range(0, choices.Count)]);
                }
                Assert.IsTrue(b.IsOver, "전투가 끝나지 않음");
                b.SyncHp();
                b.CollectRewards(new GuildState(), null);
                total++;
                if (b.Outcome == BattleOutcome.Victory) wins++;
            }
            TestContext.WriteLine("승률 " + wins + "/" + total);
            Assert.Greater(wins, total / 3, "레벨에 맞는 캐릭터는 대부분 이겨야 한다");
        }
    }
}

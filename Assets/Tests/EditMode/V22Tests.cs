using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>기획서 v2.2: 직업마다 스킬 10개(총 40개), 역할 태그, 새 스킬 효과, 저장 변환 4 → 5.</summary>
    public class V22Tests
    {
        // (id, 등급, 재사용, 성공률 보정) — 기획서 스킬 표
        private static readonly (string id, SkillTier tier, int cd, double success)[] Table =
        {
            ("w_bash", SkillTier.Low, 4, -0.10), ("w_warcry", SkillTier.Low, 6, 0), ("w_ram", SkillTier.Low, 3, -0.04),
            ("w_shield", SkillTier.Mid, 5, -0.04), ("w_guard", SkillTier.Mid, 6, 0), ("w_will", SkillTier.Mid, 7, 0),
            ("w_whirl", SkillTier.High, 6, -0.08), ("w_roar", SkillTier.High, 7, -0.04),
            ("w_earth", SkillTier.Top, 8, -0.12), ("w_strike", SkillTier.Top, 8, -0.12),
            ("a_aim", SkillTier.Low, 1, -0.03), ("a_double", SkillTier.Low, 2, -0.03), ("a_scatter", SkillTier.Low, 3, -0.08),
            ("a_poison", SkillTier.Mid, 2, -0.03), ("a_flash", SkillTier.Mid, 3, -0.04), ("a_weak", SkillTier.Mid, 4, -0.04),
            ("a_rain", SkillTier.High, 3, -0.08), ("a_pierce", SkillTier.High, 3, -0.04),
            ("a_storm", SkillTier.Top, 4, -0.08), ("a_volley", SkillTier.Top, 5, -0.12),
            ("r_ambush", SkillTier.Low, 2, -0.04), ("r_venom", SkillTier.Low, 3, -0.03), ("r_keen", SkillTier.Low, 5, 0), ("r_shuriken", SkillTier.Low, 3, -0.08),
            ("r_vital", SkillTier.Mid, 4, -0.08), ("r_smoke", SkillTier.Mid, 5, 0),
            ("r_storm", SkillTier.High, 5, -0.08), ("r_cruel", SkillTier.High, 6, 0),
            ("r_assassin", SkillTier.Top, 6, -0.12), ("r_dance", SkillTier.Top, 7, -0.12),
            ("m_fireball", SkillTier.Low, 2, -0.04), ("m_bolt", SkillTier.Low, 1, -0.03), ("m_shard", SkillTier.Low, 3, -0.08),
            ("m_ice", SkillTier.Mid, 3, -0.04), ("m_chain", SkillTier.Mid, 3, -0.04), ("m_silence", SkillTier.Mid, 4, -0.04),
            ("m_meteor", SkillTier.High, 5, -0.10), ("m_prison", SkillTier.High, 5, -0.06),
            ("m_overload", SkillTier.Top, 6, -0.12), ("m_apocalypse", SkillTier.Top, 8, -0.12),
        };

        private static Battle Setup(Job job, string skill, int enemies, int seed, out Character c)
        {
            c = Character.Create("테스트", job);
            c.Level = 40;
            c.Rank = Rank.SS;
            SkillSystem.Learn(c, skill);
            SkillSystem.Equip(c, skill, out _);
            var list = new List<Combatant>();
            for (int i = 0; i < enemies; i++)
            {
                var e = EnemyFactory.Create(MonsterDb.Get("goblin"), 1, Difficulty.Normal, 0);
                e.MaxHp = e.Hp = 100000;
                e.Attack = 0;
                list.Add(e);
            }
            EnemyFactory.NameDuplicates(list);
            return new Battle(c, 1, list, false, new Rng(seed));
        }

        [Test]
        public void FortySkills_MatchTheDesignTable()
        {
            Assert.AreEqual(40, Table.Length);
            Assert.AreEqual(40, SkillDb.AllSkills.Length);
            foreach (var row in Table)
            {
                var def = SkillDb.Get(row.id);
                Assert.IsNotNull(def, row.id);
                Assert.AreEqual(row.tier, def.Tier, row.id + " 등급");
                Assert.AreEqual(row.cd, def.Cooldown, row.id + " 재사용");
                Assert.AreEqual(row.success, def.Target == SkillTarget.Self ? 0 : def.SuccessBonus, 1e-9, row.id + " 성공률");
            }
        }

        [Test]
        public void EverySkill_HasARoleTag_AndMagesHaveNoSupport()
        {
            var roles = new HashSet<string> { "단일", "광역", "상태", "보조", "방어", "회복", "광역 상태", "단일 상태" };
            foreach (var s in SkillDb.AllSkills)
                Assert.IsTrue(roles.Contains(s.Role), s.Id + " 역할 '" + s.Role + "'");
            foreach (var s in SkillDb.ForJob(Job.Mage, (SkillTier[])Enum.GetValues(typeof(SkillTier))))
                Assert.IsFalse(s.Role == "보조" || s.Role == "방어" || s.Role == "회복", s.Id + ": 마법사는 방어·회복·보조 스킬이 없다");
            Assert.AreEqual("광역 상태", SkillDb.Get("w_roar").Role);
            Assert.AreEqual("회복", SkillDb.Get("w_will").Role);
        }

        [Test]
        public void Roar_WeakensEveryEnemyWithoutDamage()
        {
            int weakened = 0;
            for (int seed = 0; seed < 30; seed++)
            {
                var b = Setup(Job.Warrior, "w_roar", 3, seed, out _);
                var choice = b.GetChoices().Find(x => x.SkillId == "w_roar");
                Assert.IsNotNull(choice);
                b.Execute(choice);
                foreach (var e in b.Enemies)
                {
                    Assert.AreEqual(100000, e.Hp, "위협의 포효는 피해를 주지 않는다");
                    if (e.Statuses.Has(StatusType.Weaken)) weakened++;
                }
            }
            Assert.Greater(weakened, 30 * 3 * 0.5, "대부분의 적에게 약화가 걸린다");
        }

        [Test]
        public void WarStrike_HitsAndEmpowersThePlayer()
        {
            bool buffed = false;
            for (int seed = 0; seed < 20 && !buffed; seed++)
            {
                var b = Setup(Job.Warrior, "w_strike", 1, seed, out _);
                b.Execute(b.GetChoices().Find(x => x.SkillId == "w_strike"));
                bool hit = b.Enemies[0].Hp < 100000;
                if (hit)
                {
                    Assert.IsTrue(b.Player.Statuses.Has(StatusType.Empower), "명중하면 강화 3턴");
                    Assert.IsFalse(b.Enemies[0].Statuses.Has(StatusType.Empower), "강화는 적이 아니라 나에게");
                    Assert.AreEqual(3, b.Player.Statuses.Active(StatusType.Empower).Turns);
                    buffed = true;
                }
            }
            Assert.IsTrue(buffed);
        }

        [Test]
        public void SilencedEnemy_StopsUsingSkills()
        {
            var c = Character.Create("테스트", Job.Warrior);
            var e = EnemyFactory.Create(MonsterDb.Get("goblin"), 1, Difficulty.Normal, 0);
            e.MaxHp = e.Hp = 100000;
            e.Skills = new[] { new EnemySkill("독 단검", 1.0, 1.0) };
            var b = new Battle(c, 1, new List<Combatant> { e }, false, new Rng(3));
            b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack));
            Assert.IsTrue(b.Log.Exists(l => l.Text.Contains("독 단검")), "침묵 전에는 스킬을 쓴다");
            int before = b.Log.Count;
            e.Statuses.Apply(StatusType.Silence, 1, 2);
            b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack));
            for (int i = before; i < b.Log.Count; i++)
                StringAssert.DoesNotContain("독 단검", b.Log[i].Text, "침묵한 적은 스킬 대신 기본 공격");
        }

        [Test]
        public void SaveConversion_4To5_KeepsSkillsAndRefundsRemovedOnes()
        {
            var store = new MemorySaveStore();
            var s = new GameSession(store, () => DateTime.UtcNow, 1);
            s.NewGame("a", Job.Mage, Difficulty.Normal);
            var c = s.C;
            SkillSystem.Learn(c, "m_chain");
            c.Skills.Equipped.Add("m_chain");
            c.Skills.Learned.Add(new SkillState { SkillId = "m_barrier", Level = 2 }); // 예전 스킬 (사라짐)
            c.Skills.Equipped.Add("m_barrier");
            var oldBook = ItemDb.CreateSkillBook("m_chain");
            oldBook.SkillId = "m_barrier";
            c.Inventory.Add(oldBook);
            long gold = c.Gold;
            s.Data.Version = 4;
            s.Save();
            var json = store.Read().Replace("\"Version\":5", "\"Version\":4");
            store.Write(json);
            var loaded = SaveSystem.Load(store);
            Assert.AreEqual(SaveData.CurrentVersion, loaded.Version);
            var lc = loaded.Character;
            Assert.IsTrue(lc.Skills.Knows("m_chain"), "기존 스킬은 그대로");
            Assert.IsTrue(lc.Skills.Equipped.Contains("m_chain"));
            Assert.IsFalse(lc.Skills.Knows("m_barrier"));
            Assert.IsFalse(lc.Skills.Equipped.Contains("m_barrier"));
            Assert.IsFalse(lc.Inventory.Items.Exists(i => i.Kind == ItemKind.SkillBook && i.SkillId == "m_barrier"), "사라진 스킬서도 정리");
            Assert.AreEqual(gold + 2 * GameBalance.SkillBookPrice[0], lc.Gold, "스킬 1개 + 스킬서 1개 = 600G × 2 환급");
            // 두 번 불러와도 다시 환급되지 않는다
            store.Write(Json.Serialize(loaded));
            Assert.AreEqual(lc.Gold, SaveSystem.Load(store).Character.Gold);
        }

        [Test]
        public void Bots_StillClearEarlyFloors_WithTheNewSkills()
        {
            foreach (Job job in Enum.GetValues(typeof(Job)))
            {
                var s = new GameSession(new MemorySaveStore(), () => new DateTime(2026, 10, 1, 9, 0, 0, DateTimeKind.Utc), 100 + (int)job);
                s.NewGame("봇", job, Difficulty.Normal);
                s.SetTutorial(TutorialStage.Done);
                for (int run = 0; run < 40 && s.HasGame; run++)
                {
                    BotPlayer.PrepareInTown(s);
                    s.EnterDungeon();
                    int steps = 0;
                    while (s.HasGame && s.InDungeon && steps++ < 600) BotPlayer.Step(s);
                    if (s.InDungeon) s.ReturnToTown();
                }
                Assert.GreaterOrEqual(s.C.HighestFloorCleared, 3, job + " 봇이 3층은 넘는다");
            }
        }
    }
}

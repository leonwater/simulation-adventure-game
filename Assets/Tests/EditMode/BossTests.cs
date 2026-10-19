using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>보스 특성 (기획서 v1.6): 방어막·보호막·가시 비늘·혼신의 일격·연속 공격·흡혈·광폭화·분열·재생 의식·부활·부하 소환.</summary>
    public class BossTests
    {
        private static Character Hero(int floor)
        {
            var c = Character.Create("a", Job.Warrior);
            while (c.Level < floor * 2) Leveling.AddExp(c, GameBalance.ExpToNext(c.Level));
            Leveling.AutoAllocate(c);
            c.CurrentHp = CharacterStats.MaxHp(c);
            return c;
        }

        private static Combatant Boss(string id, int floor)
        {
            var b = EnemyFactory.Create(MonsterDb.Get(id), floor, Difficulty.Normal, 2);
            BossTraits.Equip(b, floor);
            return b;
        }

        private static Battle Fight(string id, int floor, int seed, out Combatant boss)
        {
            boss = Boss(id, floor);
            return new Battle(Hero(floor), floor, new List<Combatant> { boss }, true, new Rng(seed));
        }

        /// <summary>플레이어는 죽지 않게 HP를 채우며 첫 적을 기본 공격한다.</summary>
        private static void Attack(Battle b, int turns = 1)
        {
            for (int i = 0; i < turns && !b.IsOver; i++)
            {
                b.Player.Hp = b.Player.MaxHp;
                var ch = b.GetChoices().Find(x => x.Kind == ActionKind.Attack) ?? b.GetChoices()[0];
                b.Execute(ch);
            }
        }

        private static int Count(Battle b, BattleEventKind kind, string text = null) =>
            b.LastEvents.FindAll(e => e.Kind == kind && (text == null || e.Text == text)).Count;

        [Test]
        public void EverySpeciesBossHasATrait()
        {
            foreach (var theme in MonsterDb.Themes)
            {
                foreach (var id in theme.SpeciesIds) Assert.IsNotEmpty(BossTraits.For(id), id);
                Assert.GreaterOrEqual(BossTraits.For(theme.UniqueBossId).Length, 2, theme.UniqueBossId);
            }
            var boss = EnemyFactory.CreateBoss(7, Difficulty.Normal, 3)[0];
            Assert.IsNotNull(boss.Kit, "보스 방의 보스는 특성을 가진다");
            Assert.IsNull(EnemyFactory.CreateTutorialBoss(Difficulty.Normal)[0].Kit, "튜토리얼 보스는 특성 없음");
        }

        [Test]
        public void Values_GrowWithFloor()
        {
            Assert.Less(Boss("kobold", 2).Kit.Barrier, Boss("golem", 28).Kit.Barrier);
            Assert.AreEqual(1, Boss("kobold", 2).Kit.Barrier);
            var low = Boss("orc_shaman", 11);
            var high = Boss("dark_elf", 29);
            Assert.Less((double)low.Kit.MaxShield / low.MaxHp, (double)high.Kit.MaxShield / high.MaxHp);
            Assert.Less(Boss("goblin_archer", 3).Kit.FlurryHits, Boss("wyvern", 27).Kit.FlurryHits);
            Assert.Less(Boss("orc", 12).Kit.SmashMult, Boss("minotaur", 28).Kit.SmashMult);
            Assert.Less(Boss("bat", 2).Kit.Lifesteal, Boss("ghoul", 19).Kit.Lifesteal);
            Assert.Less(Boss("troll", 21).Kit.RitualUses, Boss("troll", 29).Kit.RitualUses);
            Assert.Less(Boss("slime", 2).Kit.SplitCount, Boss("slime", 9).Kit.SplitCount);
        }

        [Test]
        public void Barrier_BlocksHitsBeforeDamage()
        {
            var b = Fight("skeleton", 16, 1, out var boss);
            int charges = boss.Kit.Barrier;
            int hp = boss.Hp, blocked = 0;
            for (int i = 0; i < 40 && boss.Kit.Barrier > 0; i++)
            {
                Attack(b);
                blocked += Count(b, BattleEventKind.Text, "방어막");
                if (boss.Kit.Barrier > 0) Assert.AreEqual(hp, boss.Hp, "방어막이 남아 있으면 피해가 없다");
            }
            Assert.AreEqual(charges, blocked);
            Assert.AreEqual(0, boss.Kit.Barrier);
            for (int i = 0; i < 20 && boss.Hp == hp; i++) Attack(b);
            Assert.Less(boss.Hp, hp, "방어막이 깨지면 피해가 들어간다");
        }

        [Test]
        public void Shield_AbsorbsFirst()
        {
            var b = Fight("orc_shaman", 15, 2, out var boss);
            int hp = boss.Hp, shield = boss.Kit.Shield;
            Assert.Greater(shield, 0);
            for (int i = 0; i < 30 && boss.Kit.Shield == shield; i++) Attack(b);
            Assert.Less(boss.Kit.Shield, shield);
            if (boss.Kit.Shield > 0) Assert.AreEqual(hp, boss.Hp, "보호막이 남아 있으면 HP는 그대로");
            var ev = b.LastEvents.Find(e => e.Kind == BattleEventKind.Damage && e.Target == 0);
            Assert.AreEqual(boss.Kit.Shield, ev.Shield, "연출용 사건에 남은 보호막이 실린다");
        }

        [Test]
        public void Thorns_ReflectsButNeverKills()
        {
            var b = Fight("lizardman", 25, 3, out var boss);
            boss.Statuses.Apply(StatusType.Stun, 1, 99); // 보스는 움직이지 못하게 해 반사 피해만 본다
            int reflected = 0;
            for (int i = 0; i < 20 && !b.IsOver; i++)
            {
                b.Player.Hp = 2;
                b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack));
                reflected += b.LastEvents.FindAll(e => e.Kind == BattleEventKind.Damage && e.Actor == 0 && e.Target == -1).Count;
                Assert.GreaterOrEqual(b.Player.Hp, 1, "반사로는 쓰러지지 않는다");
            }
            Assert.Greater(reflected, 0, "가시 비늘은 맞을 때 피해를 돌려준다");
        }

        [Test]
        public void Smash_ChargesHitsHardThenRests()
        {
            var b = Fight("orc", 12, 4, out var boss);
            var k = boss.Kit;
            var seen = new List<string>();
            for (int i = 0; i < 12 && !b.IsOver; i++)
            {
                boss.Hp = boss.MaxHp; // 오래 버티게
                Attack(b);
                if (Count(b, BattleEventKind.Text, "기를 모은다") > 0)
                {
                    seen.Add("charge");
                    StringAssert.Contains("강타", k.Intent, "기를 모으면 다음 턴 강타를 예고한다");
                }
                if (b.LastEvents.Exists(e => e.Kind == BattleEventKind.Act && e.Text == "혼신의 일격")) seen.Add("smash");
                if (Count(b, BattleEventKind.Text, "탈진") > 0) seen.Add("rest");
            }
            int c = seen.IndexOf("charge");
            Assert.GreaterOrEqual(c, 0);
            Assert.AreEqual("smash", seen[c + 1]);
            Assert.AreEqual("rest", seen[c + 2]);
        }

        [Test]
        public void Flurry_HitsSeveralTimes()
        {
            for (int seed = 0; seed < 30; seed++)
            {
                var b = Fight("wyvern", 25, seed, out var boss);
                for (int i = 0; i < 8 && !b.IsOver; i++)
                {
                    boss.Hp = boss.MaxHp;
                    Attack(b);
                    if (!b.LastEvents.Exists(e => e.Kind == BattleEventKind.Act && e.Text == "연속 공격")) continue;
                    int hits = b.LastEvents.FindAll(e => e.Actor == 0 && e.Target == -1 && (e.Kind == BattleEventKind.Damage || e.Kind == BattleEventKind.Miss)).Count;
                    Assert.AreEqual(boss.Kit.FlurryHits, hits);
                    return;
                }
            }
            Assert.Fail("연속 공격이 한 번도 나오지 않음");
        }

        [Test]
        public void Lifesteal_HealsFromDamageDealt()
        {
            for (int seed = 0; seed < 20; seed++)
            {
                var b = Fight("ghoul", 15, seed, out var boss);
                boss.Hp = boss.MaxHp / 2;
                Attack(b, 3);
                if (b.LastEvents.Exists(e => e.Kind == BattleEventKind.Heal && e.Target == 0)) return;
            }
            Assert.Fail("흡혈 회복이 없음");
        }

        [Test]
        public void Enrage_OnceAtHalfHp()
        {
            var b = Fight("goblin", 6, 5, out var boss);
            int atk = boss.Attack;
            boss.Hp = boss.MaxHp / 2 + 1;
            for (int i = 0; i < 10 && !boss.Kit.Enraged && !b.IsOver; i++) Attack(b);
            Assert.IsTrue(boss.Kit.Enraged);
            Assert.Greater(boss.Attack, atk);
            int raged = boss.Attack;
            Attack(b, 2);
            Assert.AreEqual(raged, boss.Attack, "광폭화는 한 번만");
        }

        [Test]
        public void Split_SpawnsSecondPhaseWithoutExtraRewards()
        {
            var b = Fight("slime", 6, 6, out var boss);
            boss.Hp = 1;
            for (int i = 0; i < 10 && boss.Alive; i++) Attack(b);
            Assert.IsFalse(boss.Alive);
            Assert.IsFalse(b.IsOver, "분열하면 전투가 이어진다");
            var children = b.Enemies.FindAll(e => e.Alive);
            Assert.AreEqual(boss.Kit.SplitCount, children.Count);
            Assert.IsTrue(children.TrueForAll(e => e.NoReward && e.Name.StartsWith("작은 슬라임")));
            Assert.AreEqual(children.Count, b.LastEvents.FindAll(e => e.Kind == BattleEventKind.Spawn).Count);
            Assert.LessOrEqual(b.Enemies.Count, 4);
            for (int i = 0; i < 80 && !b.IsOver; i++) Attack(b);
            Assert.AreEqual(BattleOutcome.Victory, b.Outcome);
            var loot = b.CollectRewards(new GuildState(), null);
            Assert.AreEqual(boss.ExpReward, loot.Exp, "보상은 보스 몫만");
        }

        [Test]
        public void Ritual_ChantsThenHeals()
        {
            var b = Fight("troll", 22, 7, out var boss);
            boss.Hp = (int)(boss.MaxHp * 0.25);
            boss.Defense = 100000; // 영창 중에 쓰러뜨리지 않게
            Attack(b);
            Assert.IsTrue(boss.Kit.Chanting);
            StringAssert.Contains("회복", boss.Kit.Intent);
            int hp = boss.Hp;
            Attack(b);
            Assert.Greater(boss.Hp, hp);
            Assert.AreEqual(0, boss.Kit.RitualUses);
            Assert.IsFalse(boss.Kit.Chanting);
        }

        [Test]
        public void Revive_FirstDeathOnly()
        {
            var b = Fight("zombie", 15, 8, out var boss);
            boss.Hp = 1;
            for (int i = 0; i < 10 && boss.Kit.Revives > 0; i++) Attack(b);
            Assert.AreEqual(0, boss.Kit.Revives);
            Assert.IsTrue(boss.Alive, "처음 쓰러지면 다시 일어난다");
            Assert.IsFalse(b.Defeated.Contains(boss));
            boss.Hp = 1;
            for (int i = 0; i < 10 && !b.IsOver; i++) Attack(b);
            Assert.AreEqual(BattleOutcome.Victory, b.Outcome);
        }

        [Test]
        public void Summon_CallsMinionsThatScatterWithTheBoss()
        {
            var b = Fight("lich", 20, 9, out var boss);
            boss.Kit.Shield = 0;
            boss.Kit.RitualUses = 0;
            for (int i = 0; i < 12 && boss.Kit.Minions.Count == 0; i++)
            {
                boss.Hp = boss.MaxHp;
                Attack(b);
            }
            Assert.IsNotEmpty(boss.Kit.Minions);
            var m = boss.Kit.Minions[0];
            Assert.IsTrue(m.NoReward);
            Assert.IsTrue(b.Enemies.Contains(m));
            Assert.LessOrEqual(b.Enemies.Count, 4);
            // 보스를 쓰러뜨리면 졸개는 흩어지고 전투가 끝난다
            boss.Hp = 1;
            for (int i = 0; i < 20 && !b.IsOver; i++)
            {
                b.Player.Hp = b.Player.MaxHp;
                var ch = b.GetChoices().Find(x => x.Kind == ActionKind.Attack && x.Target == b.Enemies.IndexOf(boss));
                b.Execute(ch ?? b.GetChoices()[0]);
            }
            Assert.AreEqual(BattleOutcome.Victory, b.Outcome);
            Assert.IsTrue(boss.Kit.Minions.TrueForAll(x => !x.Alive));
            var loot = b.CollectRewards(new GuildState(), null);
            Assert.AreEqual(boss.ExpReward, loot.Exp, "졸개는 보상 없음");
        }

        [Test]
        public void Bosses_StayBeatableForAFloorLevelHero()
        {
            int wins = 0, total = 0;
            for (int floor = 2; floor <= 30; floor += 4)
            {
                for (int i = 0; i < 6; i++)
                {
                    var rng = new Rng(floor * 13 + i);
                    var c = Hero(floor);
                    var b = new Battle(c, floor, EnemyFactory.CreateBoss(floor, Difficulty.Normal, i), true, rng);
                    int guard = 0;
                    while (!b.IsOver && guard++ < 300) b.Execute(BotPlayer.PickBattleChoice(b));
                    Assert.IsTrue(b.IsOver, "보스전이 끝나지 않음");
                    total++;
                    if (b.Outcome == BattleOutcome.Victory) wins++;
                }
            }
            TestContext.WriteLine("보스 승률 " + wins + "/" + total);
            Assert.Greater(wins, 0);
        }
    }
}

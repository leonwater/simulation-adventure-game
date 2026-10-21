using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>기획서 v2.1.1: 상태 이상 지속 턴은 걸린 쪽의 실제 차례 수.</summary>
    public class V21Tests
    {
        private static Battle NewBattle(Job job, int seed, out Character c)
        {
            c = Character.Create("에단", job);
            var list = new List<Combatant> { EnemyFactory.Create(MonsterDb.Get("goblin"), 1, Difficulty.Normal, 0) };
            return new Battle(c, 1, list, false, new Rng(seed));
        }

        [Test]
        public void StunnedPlayer_LosesExactlyOneAction()
        {
            var b = NewBattle(Job.Warrior, 1, out _);
            b.Enemies[0].Attack = 0;
            b.Enemies[0].MaxHp = b.Enemies[0].Hp = 100000;
            b.Player.Statuses.Apply(StatusType.Stun, 1, 1); // 적 차례에 걸린 기절 1턴
            b.Execute(b.GetChoices()[0]); // 기절로 한 번 못 움직임
            Assert.IsFalse(b.Player.Statuses.Has(StatusType.Stun), "기절 1턴은 한 번 쉬고 끝");
            Assert.AreEqual(ActionKind.Attack, b.GetChoices()[0].Kind, "다음 차례는 평소처럼 고를 수 있다");
        }

        [Test]
        public void Poison_ThreeTurnsHurtsThreeTimes()
        {
            var b = NewBattle(Job.Warrior, 2, out _);
            b.Enemies[0].Attack = 0;
            b.Enemies[0].MaxHp = b.Enemies[0].Hp = 100000;
            b.Player.Statuses.Apply(StatusType.Poison, 4, 3);
            int hits = 0;
            for (int i = 0; i < 5 && !b.IsOver; i++)
            {
                int before = b.Player.Hp;
                b.Execute(b.GetChoices()[0]);
                if (before - b.Player.Hp >= 5) hits++; // 독 피해 (적의 최소 피해 1은 제외)
            }
            Assert.AreEqual(3, hits, "독 3턴 = 피해 3번");
            Assert.IsFalse(b.Player.Statuses.Has(StatusType.Poison));
        }

        [Test]
        public void SelfBuff_CoversTheFollowingThreeTurns()
        {
            var c0 = Character.Create("에단", Job.Warrior);
            SkillSystem.Learn(c0, "w_warcry");
            c0.Skills.Equipped.Add("w_warcry");
            var list = new List<Combatant> { EnemyFactory.Create(MonsterDb.Get("goblin"), 1, Difficulty.Normal, 0) };
            var b = new Battle(c0, 1, list, false, new Rng(3));
            b.Enemies[0].Attack = 0;
            b.Enemies[0].MaxHp = b.Enemies[0].Hp = 100000;
            var cry = b.GetChoices().Find(x => x.SkillId == "w_warcry");
            Assert.IsNotNull(cry);
            b.Execute(cry);
            Assert.AreEqual(3, b.Player.Statuses.Active(StatusType.Empower).Turns, "자기 차례에 건 강화는 그 차례 끝에 줄지 않는다");
            for (int i = 0; i < 3; i++)
            {
                Assert.IsTrue(b.Player.Statuses.Has(StatusType.Empower), "강화 " + (i + 1) + "번째 차례");
                b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack));
            }
            Assert.IsFalse(b.Player.Statuses.Has(StatusType.Empower));
        }

        [Test]
        public void StunnedEnemy_LosesExactlyOneAction()
        {
            var b = NewBattle(Job.Warrior, 4, out var c);
            var e = b.Enemies[0];
            e.MaxHp = e.Hp = 100000;
            e.Attack = 50;
            e.Statuses.Apply(StatusType.Stun, 1, 1); // 내 차례에 건 기절 1턴
            int hp = b.Player.Hp;
            b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack));
            Assert.AreEqual(hp, b.Player.Hp, "기절한 적은 이번 차례에 공격하지 못한다");
            Assert.IsFalse(e.Statuses.Has(StatusType.Stun));
        }

        [Test]
        public void Fear_LastsExactlyThreePlayerTurns()
        {
            var c = Character.Create("에단", Job.Warrior);
            var list = new List<Combatant> { EnemyFactory.Create(MonsterDb.Get("goblin"), 1, Difficulty.Normal, 0) };
            var b = new Battle(c, 1, list, false, new Rng(5));
            b.Enemies[0].Attack = 0;
            b.Enemies[0].MaxHp = b.Enemies[0].Hp = 100000;
            var run = new List<ExploreEffect> { new ExploreEffect(ExploreEffectType.Fear, 1) };
            ExploreEffects.ApplyToBattle(run, b);
            int fearTurns = 0;
            for (int i = 0; i < 6; i++)
            {
                if (b.Player.Statuses.Has(StatusType.Fear)) fearTurns++;
                b.Execute(b.GetChoices().Find(x => x.Kind == ActionKind.Attack));
            }
            Assert.AreEqual(3, fearTurns, "공포 3턴 = 플레이어 차례 3번");
        }
    }
}

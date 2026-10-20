using System;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>기획서 v1.7: 능력치 최대값, 처음 튜토리얼에는 건너뛰기 없음(다시 보기에서만).</summary>
    public class V17Tests
    {
        private static Character MaxLevel(Job job)
        {
            var c = Character.Create("a", job);
            while (c.Level < GameBalance.MaxLevel) Leveling.AddExp(c, GameBalance.ExpToNext(c.Level));
            return c;
        }

        [Test]
        public void StatCaps_StopAllocationAndAutoAllocation()
        {
            foreach (Job job in Enum.GetValues(typeof(Job)))
            {
                var c = MaxLevel(job);
                Assert.AreEqual((GameBalance.MaxLevel - 1) * GameBalance.PointsPerLevel, c.UnspentPoints);
                var attack = c.JobData.AttackStat;
                // 한 능력치에 몰아도 최대값에서 멈춘다
                while (Leveling.Allocate(c, attack)) { }
                Assert.AreEqual(GameBalance.MaxStat(attack), c.BaseStats[attack]);
                Assert.Greater(c.UnspentPoints, 0);
                // 나머지는 자동 배분이 최대값을 지키며 나눈다
                Leveling.AutoAllocate(c);
                foreach (var st in c.JobData.AllocatableStats) Assert.LessOrEqual(c.BaseStats[st], GameBalance.MaxStat(st), st.ToString());
                Assert.AreEqual(0, c.UnspentPoints, "다섯 능력치 최대값 합이면 포인트를 모두 쓸 수 있다");
            }

            var d = MaxLevel(Job.Mage);
            var draft = new AllocationDraft(d);
            int guard = 0;
            while (draft.Add(Stat.Luck) && guard++ < 500) { }
            Assert.AreEqual(GameBalance.MaxStat(Stat.Luck), d.BaseStats[Stat.Luck] + draft.Pending(Stat.Luck));
            Assert.IsFalse(draft.CanAdd(Stat.Luck));
        }

        [Test]
        public void StatCaps_OldSaveOverCapIsRefunded()
        {
            var store = new MemorySaveStore();
            var s = new GameSession(store, () => new DateTime(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc), 3);
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            s.C.BaseStats[Stat.Strength] = 150;
            s.C.UnspentPoints = 2;
            s.Save();
            Assert.IsTrue(s.Continue());
            Assert.AreEqual(GameBalance.MaxStat(Stat.Strength), s.C.BaseStats[Stat.Strength]);
            Assert.AreEqual(2 + 150 - GameBalance.MaxStat(Stat.Strength), s.C.UnspentPoints);
        }

        [Test]
        public void Tutorial_ReplayFlagOnlyWhenRestarted()
        {
            var s = new GameSession(new MemorySaveStore(), () => new DateTime(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc), 4);
            s.NewGame("a", Job.Archer, Difficulty.Normal);
            Assert.IsFalse(s.Data.TutorialReplay, "처음 튜토리얼");
            s.SetTutorial(TutorialStage.Done);
            s.RestartTutorial();
            Assert.IsTrue(s.Data.TutorialReplay, "설정에서 다시 보기");
            s.SetTutorial(TutorialStage.Done);
            Assert.IsFalse(s.Data.TutorialReplay);
        }
    }
}

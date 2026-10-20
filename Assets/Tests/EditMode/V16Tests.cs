using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>기획서 v1.6: 튜토리얼 귀환 강제, 퀘스트 등급·중복 없음, 초반 보정, 방 결과 알림.</summary>
    public class V16Tests
    {
        private static GameSession NewSession(int seed = 1) =>
            new GameSession(new MemorySaveStore(), () => new DateTime(2026, 10, 19, 9, 0, 0, DateTimeKind.Utc), seed);

        private static void Win(GameSession s)
        {
            int guard = 0;
            while (s.Battle != null && !s.Battle.IsOver && guard++ < 200)
            {
                s.Battle.Player.Hp = s.Battle.Player.MaxHp;
                s.ExecuteBattle(BotPlayer.PickBattleChoice(s.Battle));
            }
            Assert.AreEqual(BattleOutcome.Victory, s.Battle.Outcome);
            s.CloseBattle();
        }

        [Test]
        public void Tutorial_BossClearMustReturnToTown()
        {
            var s = NewSession();
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            s.EnterDungeon();
            Assert.IsTrue(s.InTutorialRun);
            var boss = s.Run.Map.Boss;
            s.Run.CurrentRoomId = s.Run.Map.Rooms.Find(r => r.Links.Contains(boss.Id)).Id;
            s.Run.Current.Visited = s.Run.Current.Cleared = true;
            Assert.AreEqual(RoomEnterResult.Boss, s.Move(boss.Id));
            Win(s);
            Assert.IsTrue(s.Run.BossDefeated);
            Assert.IsFalse(s.CanDescend, "튜토리얼 1층은 아래층으로 내려갈 수 없다");
            Assert.Throws<InvalidOperationException>(() => s.Descend());
            Assert.IsTrue(s.CanReturn);

            // 튜토리얼을 다시 보는 중(일반 층)이어도 마찬가지
            s.ReturnToTown();
            s.C.HighestFloorCleared = 4;
            s.RestartTutorial();
            s.SelectFloor(2);
            s.EnterDungeon();
            Assert.IsFalse(s.Run.IsTutorial);
            Assert.IsTrue(s.InTutorialRun);
            s.Run.BossDefeated = true;
            Assert.IsFalse(s.CanDescend);
            s.ReturnToTown();
            s.SetTutorial(TutorialStage.Done);
            s.EnterDungeon();
            s.Run.BossDefeated = true;
            Assert.IsTrue(s.CanDescend, "튜토리얼이 끝나면 내려갈 수 있다");
        }

        [Test]
        public void Quests_NoDuplicateTargetsAndRankFollowsDifficulty()
        {
            var rng = new Rng(3);
            for (int k = 0; k < 200; k++)
            {
                var c = Character.Create("a", (Job)(k % 4));
                c.Rank = (Rank)(k % 8);
                c.HighestFloorCleared = k % 30;
                var g = new GuildState();
                GuildSystem.RefreshBoard(g, c, rng);
                Assert.Greater(g.Board.Count, 0);
                var keys = new HashSet<string>();
                var titles = new HashSet<string>();
                int next = c.MaxChallengeFloor;
                foreach (var q in g.Board)
                {
                    Assert.IsTrue(keys.Add(GuildSystem.Key(q)), "같은 대상의 퀘스트가 둘: " + q.Title);
                    Assert.IsTrue(titles.Add(q.Title), "같은 이름의 퀘스트가 여러 등급: " + q.Title);
                    if (q.TargetFloor != next) Assert.IsTrue(GuildSystem.InRange(c.Rank, q.Rank), "다음 층 의뢰 외에는 수락할 수 있는 등급만");
                }
                Assert.GreaterOrEqual(g.Board.FindAll(q => q.TargetFloor == next).Count, GuildSystem.NextFloorQuests, "다음에 도전할 층 의뢰는 최소 2개");
                // 진행 중인 퀘스트와도 겹치지 않는다
                GuildSystem.Accept(g, c, g.Board[0].Id, out _);
                if (g.Active.Count == 0) continue;
                var active = g.Active[0];
                GuildSystem.RefreshBoard(g, c, rng);
                Assert.IsFalse(g.Board.Exists(q => GuildSystem.Key(q) == GuildSystem.Key(active)));
            }
        }

        [Test]
        public void Quests_BossClearPostsNextFloorQuests()
        {
            var s = NewSession(8);
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            s.EnterDungeon();
            s.Run.BossDefeated = true;
            s.C.HighestFloorCleared = 1;
            s.ReturnToTown();
            Assert.AreEqual(2, s.C.MaxChallengeFloor);
            Assert.GreaterOrEqual(s.Data.Guild.Board.FindAll(q => q.TargetFloor == 2).Count, GuildSystem.NextFloorQuests, "보스를 잡고 돌아오면 새 층 의뢰가 붙는다");
        }

        [Test]
        public void EarlyBoost_NormalOnlyAndNotInTutorial()
        {
            var sp = MonsterDb.Get("goblin");
            var normal = EnemyFactory.Create(sp, 1, Difficulty.Normal, 0);
            var easy = EnemyFactory.Create(sp, 1, Difficulty.Easy, 0);
            Assert.Greater(GameBalance.EnemyHp(1), GameBalance.EnemyHp(1, 0));
            Assert.AreEqual(GameBalance.EnemyHp(8), GameBalance.EnemyHp(8, 0), 1e-9, "8층부터는 보정 없음");
            Assert.AreEqual(Math.Round(GameBalance.EnemyHp(1, 0) * 0.75), easy.MaxHp, "쉬움은 보정 없음");
            Assert.AreEqual(Math.Round(GameBalance.EnemyHp(1) * 1.0), normal.MaxHp);
            var tutorial = EnemyFactory.CreateTutorialGroup(false, Difficulty.Normal)[0];
            Assert.AreEqual(Math.Round(GameBalance.EnemyHp(1, 0)), tutorial.MaxHp, 1, "튜토리얼 적은 보정 없이");
        }

        [Test]
        public void RoomNotice_TreasureRestBattleAndEvent()
        {
            var s = NewSession(5);
            s.NewGame("a", Job.Rogue, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            s.EnterDungeon();
            var run = s.Run;
            Room Adjacent(RoomType t)
            {
                var r = run.Map.Rooms.Find(x => x.Type == t && !x.Visited);
                if (!run.Current.Links.Contains(r.Id)) run.Current.Links.Add(r.Id);
                if (!r.Links.Contains(run.Current.Id)) r.Links.Add(run.Current.Id);
                return r;
            }

            s.Move(Adjacent(RoomType.Treasure).Id);
            Assert.AreEqual("보물 발견!", s.Notice.Title);
            Assert.IsNotEmpty(s.Notice.LootLines(), "보물 목록을 한 줄씩");

            s.C.CurrentHp = 1;
            s.Move(Adjacent(RoomType.Rest).Id);
            Assert.AreEqual("모닥불에서 휴식", s.Notice.Title);
            StringAssert.StartsWith("HP ", s.Notice.Lines[0]);

            s.Move(Adjacent(RoomType.Battle).Id);
            Assert.IsNull(s.Notice, "다른 방에 들어가면 알림이 바뀐다");
            Win(s);
            Assert.AreEqual("전투 승리", s.Notice.Title);

            var ev = Adjacent(RoomType.Event);
            ev.EventId = "evt_torn_map";
            s.Move(ev.Id);
            s.ChooseEvent(0);
            Assert.AreEqual("찢어진 지도", s.Notice.Title);
            Assert.IsNotEmpty(s.Notice.Lines);
        }
    }
}

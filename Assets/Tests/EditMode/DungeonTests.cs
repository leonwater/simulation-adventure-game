using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    public class DungeonTests
    {
        [Test]
        public void RoomTypes_FollowMinMaxRules()
        {
            var rng = new Rng(100);
            int merchants = 0;
            const int runs = 5000;
            for (int i = 0; i < runs; i++)
            {
                var t = DungeonGenerator.RollRoomTypes(rng);
                Assert.That(t.Count, Is.InRange(8, 13));
                Assert.GreaterOrEqual(Count(t, RoomType.Battle), 4);
                Assert.GreaterOrEqual(Count(t, RoomType.Event), 1);
                Assert.That(Count(t, RoomType.Treasure), Is.InRange(1, 2));
                Assert.That(Count(t, RoomType.Rest), Is.InRange(1, 3));
                Assert.AreEqual(1, Count(t, RoomType.Return));
                Assert.LessOrEqual(Count(t, RoomType.Merchant), 1);
                Assert.AreEqual(0, Count(t, RoomType.Boss));
                merchants += Count(t, RoomType.Merchant);
            }
            Assert.That(merchants / (double)runs, Is.InRange(0.56, 0.64), "상인 등장 확률 60%");
        }

        [Test]
        public void Generator_SatisfiesLayoutRulesForAllPatterns()
        {
            var rng = new Rng(2024);
            var failures = 0;
            foreach (LayoutPattern p in Enum.GetValues(typeof(LayoutPattern)))
            {
                for (int i = 0; i < 1000; i++)
                {
                    int floor = 1 + i % 30;
                    var map = DungeonGenerator.Generate(floor, rng, p);
                    Assert.IsTrue(map.IsConnected(), p + " 연결");
                    Assert.AreEqual(1, map.CountOf(RoomType.Boss));
                    Assert.AreEqual(1, map.CountOf(RoomType.Start));
                    Assert.AreEqual(RoomType.Start, map.Start.Type);
                    Assert.AreEqual(RoomType.Boss, map.Boss.Type);

                    int[] dist = map.Distances(map.StartId);
                    int max = 0;
                    foreach (int d in dist) max = Math.Max(max, d);
                    Assert.AreEqual(max, dist[map.BossId], "보스는 가장 먼 방");

                    // 좌표 중복 없음, 연결은 상하좌우 이웃끼리만
                    var seen = new HashSet<string>();
                    foreach (var r in map.Rooms)
                    {
                        Assert.IsTrue(seen.Add(r.X + "," + r.Y), "좌표 중복");
                        foreach (int l in r.Links)
                        {
                            var o = map.Get(l);
                            Assert.AreEqual(1, Math.Abs(o.X - r.X) + Math.Abs(o.Y - r.Y));
                            Assert.IsTrue(o.Links.Contains(r.Id), "양방향 연결");
                        }
                        if (r.Type == RoomType.Event) Assert.IsNotNull(EventDb.Get(r.EventId));
                    }
                    if (map.BranchesOnBossPath() < 2 || map.DeadEnds() < 1) failures++;
                }
            }
            Assert.LessOrEqual(failures, 3, "갈림길 2개·막다른 길 1개 조건을 만족하지 못한 층 수");
        }

        [Test]
        public void Generator_PatternsLookDifferent()
        {
            var rng = new Rng(5);
            int loopCycles = 0, gridCycles = 0, branchCycles = 0;
            for (int i = 0; i < 200; i++)
            {
                branchCycles += ExtraEdges(DungeonGenerator.Generate(5, rng, LayoutPattern.Branch));
                loopCycles += ExtraEdges(DungeonGenerator.Generate(5, rng, LayoutPattern.Loop));
                gridCycles += ExtraEdges(DungeonGenerator.Generate(5, rng, LayoutPattern.Grid));
            }
            Assert.AreEqual(0, branchCycles, "가지형은 순환이 없다");
            Assert.Greater(loopCycles, 150, "순환형은 순환이 있다");
            Assert.Greater(gridCycles, 0);
        }

        [Test]
        public void Explore_MoveRulesTeleportAndFlee()
        {
            var c = Character.Create("a", Job.Warrior);
            var run = DungeonSystem.StartRun(c, 1, new Rng(8));
            Assert.AreEqual(run.Map.StartId, run.CurrentRoomId);
            Assert.IsTrue(DungeonSystem.CanLeave(run));
            var options = DungeonSystem.MoveOptions(run, Difficulty.Normal);
            Assert.Greater(options.Count, 0);
            foreach (var o in options)
            {
                Assert.IsFalse(o.Known, "보통 난이도에서는 다음 방 종류를 숨긴다");
                StringAssert.EndsWith("로 간다", o.Direction);
            }
            foreach (var o in DungeonSystem.MoveOptions(run, Difficulty.Easy)) Assert.IsTrue(o.Known);

            // 전투 방을 찾아 들어가 본다
            var battleRoom = run.Map.Rooms.Find(r => r.Type == RoomType.Battle);
            ForceAdjacent(run, battleRoom);
            Assert.AreEqual(RoomEnterResult.Battle, DungeonSystem.MoveTo(run, battleRoom.Id));
            Assert.IsFalse(DungeonSystem.CanLeave(run), "전투를 끝내기 전에는 못 떠난다");
            Assert.IsFalse(DungeonSystem.Teleport(run, run.Map.StartId), "전투 중 텔레포트 불가");
            DungeonSystem.FleeToPrevious(run);
            Assert.AreEqual(run.Map.StartId, run.CurrentRoomId);
            Assert.IsTrue(battleRoom.Visited);
            Assert.IsFalse(battleRoom.Cleared);
            Assert.AreEqual(RoomEnterResult.Battle, DungeonSystem.MoveTo(run, battleRoom.Id), "다시 들어가면 다시 전투");
            DungeonSystem.ClearCurrent(run);
            Assert.AreEqual(RoomEnterResult.Nothing, DungeonSystem.MoveTo(run, run.Map.StartId));
            Assert.IsTrue(DungeonSystem.Teleport(run, battleRoom.Id));
            Assert.AreEqual(battleRoom.Id, run.CurrentRoomId);
        }

        [Test]
        public void RestTreasureAndReturnRooms()
        {
            var c = Character.Create("a", Job.Warrior);
            var run = DungeonSystem.StartRun(c, 3, new Rng(9));
            c.HighestFloorCleared = 5;

            var rest = run.Map.Rooms.Find(r => r.Type == RoomType.Rest);
            ForceAdjacent(run, rest);
            c.CurrentHp = 10;
            Assert.AreEqual(RoomEnterResult.Rest, DungeonSystem.MoveTo(run, rest.Id));
            int healed = DungeonSystem.Rest(run, c);
            Assert.AreEqual((int)Math.Round(CharacterStats.MaxHp(c) * 0.4), healed);
            Assert.IsTrue(rest.Cleared);

            var treasure = run.Map.Rooms.Find(r => r.Type == RoomType.Treasure);
            ForceAdjacent(run, treasure);
            long gold = c.Gold;
            Assert.AreEqual(RoomEnterResult.Treasure, DungeonSystem.MoveTo(run, treasure.Id));
            var loot = DungeonSystem.OpenTreasure(run, c, new Rng(1));
            Assert.Greater(loot.Gold, 0);
            Assert.AreEqual(gold + loot.Gold, c.Gold);
            Assert.AreEqual(loot.Gold, run.GoldEarned);

            Assert.IsFalse(run.ReturnRoomFound);
            var ret = run.Map.Rooms.Find(r => r.Type == RoomType.Return);
            ForceAdjacent(run, ret);
            Assert.AreEqual(RoomEnterResult.Return, DungeonSystem.MoveTo(run, ret.Id));
            Assert.IsTrue(run.ReturnRoomFound);
        }

        [Test]
        public void BossDefeat_UnlocksNextFloorAndDescendKeepsHp()
        {
            var c = Character.Create("a", Job.Warrior);
            var guild = new GuildState();
            var run = DungeonSystem.StartRun(c, 1, new Rng(3));
            Assert.AreEqual(1, c.MaxChallengeFloor);
            ForceAdjacent(run, run.Map.Boss);
            Assert.AreEqual(RoomEnterResult.Boss, DungeonSystem.MoveTo(run, run.Map.BossId));
            Assert.IsFalse(DungeonSystem.CanGoDeeper(run));
            DungeonSystem.OnBossDefeated(run, c, guild);
            Assert.AreEqual(1, c.HighestFloorCleared);
            Assert.AreEqual(2, c.MaxChallengeFloor);
            c.CurrentHp = 33;
            DungeonSystem.Descend(run, new Rng(4));
            Assert.AreEqual(2, run.Floor);
            Assert.AreEqual(33, c.CurrentHp);
            Assert.IsFalse(run.BossDefeated);
            Assert.AreEqual(run.Map.StartId, run.CurrentRoomId);
        }

        [Test]
        public void StartRun_ClampsToChallengeFloor()
        {
            var c = Character.Create("a", Job.Warrior);
            Assert.AreEqual(1, DungeonSystem.StartRun(c, 9, new Rng(1)).Floor);
            c.HighestFloorCleared = 30;
            Assert.AreEqual(30, DungeonSystem.StartRun(c, 99, new Rng(1)).Floor);
        }

        [Test]
        public void Death_LosesGoldExpAndUnequippedItemsOnly()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Gold = 1240;
            Leveling.AddExp(c, 100 + 200);
            c.Storage.Add(ItemDb.CreateConsumable("potion_hi", 2));
            c.BagsBought = 2;
            c.RecalculateCapacities();
            var run = DungeonSystem.StartRun(c, 1, new Rng(1));
            var report = Settlement.Die(c, run, Difficulty.Normal, "고블린 궁수");
            Assert.AreEqual(372, report.GoldLost);
            Assert.AreEqual(868, c.Gold);
            Assert.AreEqual(57, report.ExpLost);
            Assert.AreEqual(2, c.Level);
            Assert.AreEqual(1, report.ItemsLost.Count, "시작 물약 3개 한 칸");
            Assert.AreEqual(0, c.Inventory.UsedCells);
            Assert.AreEqual(1, report.EquippedKept);
            Assert.AreEqual(2, c.Storage.CountOf("potion_hi"), "창고 유지");
            Assert.AreEqual(30, c.Inventory.Capacity, "가방 확장 유지");
            Assert.AreEqual(CharacterStats.MaxHp(c), c.CurrentHp);
        }

        [Test]
        public void Death_HardcoreFlagsReset()
        {
            var c = Character.Create("a", Job.Warrior);
            var report = Settlement.Die(c, null, Difficulty.Hardcore, "드래곤");
            Assert.IsTrue(report.HardcoreReset);
        }

        [Test]
        public void Events_AllChoicesResolveWithoutErrors()
        {
            var rng = new Rng(77);
            foreach (var e in EventDb.All)
            {
                for (int choice = 0; choice < e.Choices.Length; choice++)
                {
                    for (int k = 0; k < 30; k++)
                    {
                        var c = Character.Create("a", (Job)(k % 4));
                        c.Gold = 5000;
                        var run = DungeonSystem.StartRun(c, 1 + k % 30 / 3, rng);
                        var room = run.Map.Rooms.Find(r => r.Type == RoomType.Event);
                        room.EventId = e.Id;
                        ForceAdjacent(run, room);
                        DungeonSystem.MoveTo(run, room.Id);
                        var ch = e.Choices[choice];
                        Assert.IsNull(EventSystem.UnavailableReason(ch, c, run.Floor), e.Id + "/" + choice);
                        double p = EventSystem.SuccessChance(ch, c, run.Floor);
                        Assert.That(p, Is.InRange(0.05, 1.0));
                        var result = EventSystem.Resolve(run, c, choice, rng);
                        Assert.IsNotEmpty(result.Text);
                        Assert.GreaterOrEqual(c.CurrentHp, 1);
                        Assert.GreaterOrEqual(c.Gold, 0);
                        Assert.AreEqual(!result.StartBattle, room.Cleared);
                    }
                }
            }
        }

        [Test]
        public void Events_RequirementsBlockChoices()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Inventory.Clear();
            c.Gold = 0;
            var wounded = EventDb.Get("wounded");
            Assert.IsNotNull(EventSystem.UnavailableReason(wounded.Choices[0], c, 1));
            var gamble = EventDb.Get("gamble");
            Assert.IsNotNull(EventSystem.UnavailableReason(gamble.Choices[0], c, 1));
            Assert.AreEqual("힘 판정", EventSystem.ChoiceHint(EventDb.Get("swordsman").Choices[0], c, 1));
        }

        [Test]
        public void Situation_DescribesCurrentRoom()
        {
            var c = Character.Create("a", Job.Warrior);
            var run = DungeonSystem.StartRun(c, 1, new Rng(12));
            string text = DungeonSystem.Situation(run, out string title);
            Assert.IsNotEmpty(text);
            Assert.IsNotEmpty(title);
        }

        // 테스트용: 대상 방을 현재 방과 바로 연결한다.
        private static void ForceAdjacent(DungeonRun run, Room target)
        {
            var cur = run.Current;
            if (!cur.Links.Contains(target.Id)) cur.Links.Add(target.Id);
            if (!target.Links.Contains(cur.Id)) target.Links.Add(cur.Id);
        }

        private static int ExtraEdges(FloorMap map)
        {
            int edges = 0;
            foreach (var r in map.Rooms) edges += r.Links.Count;
            return edges / 2 - (map.Rooms.Count - 1);
        }

        private static int Count(List<RoomType> list, RoomType t) => list.FindAll(x => x == t).Count;
    }
}

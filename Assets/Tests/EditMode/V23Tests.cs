using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>기획서 v2.3: 드롭·보물 방 빈도, 상인 가격 1.5배, 100% 선택지, 창고, 길드 알림, 이동 패드.</summary>
    public class V23Tests
    {
        private static DungeonRun HandMadeRun(params (int x, int y)[] rooms)
        {
            var map = new FloorMap { Floor = 1 };
            for (int i = 0; i < rooms.Length; i++) map.Rooms.Add(new Room { Id = i, X = rooms[i].x, Y = rooms[i].y, Type = RoomType.Battle });
            return new DungeonRun { Floor = 1, Map = map, CurrentRoomId = 0, PreviousRoomId = 0 };
        }

        private static void Link(DungeonRun run, int a, int b)
        {
            run.Map.Rooms[a].Links.Add(b);
            run.Map.Rooms[b].Links.Add(a);
        }

        [Test]
        public void OneFloor_GivesAboutTwoEquipmentOnAverage()
        {
            var rng = new Rng(23);
            double equip = 0;
            const int floors = 1500;
            double luck = 1.025; // 행운 5
            for (int i = 0; i < floors; i++)
            {
                foreach (var t in DungeonGenerator.RollRoomTypes(rng))
                {
                    if (t == RoomType.Treasure && rng.Chance(0.6)) equip++;
                    if (t != RoomType.Battle) continue;
                    foreach (var e in EnemyFactory.CreateGroup(3, Difficulty.Normal, rng.Range(0, int.MaxValue)))
                        if (rng.Chance((e.Role == 1 ? GameBalance.EquipDropElite : GameBalance.EquipDropNormal) * luck)) equip++;
                }
                equip++; // 보스
            }
            Assert.That(equip / floors, Is.InRange(1.8, 2.25), "한 층을 끝까지 돌 때 장비 평균 약 2개 (v2.3)");
        }

        [Test]
        public void TreasureRooms_AreRarerThanBefore()
        {
            var rng = new Rng(5);
            int treasure = 0, none = 0;
            const int runs = 4000;
            for (int i = 0; i < runs; i++)
            {
                int n = DungeonGenerator.RollRoomTypes(rng).FindAll(t => t == RoomType.Treasure).Count;
                treasure += n;
                if (n == 0) none++;
            }
            Assert.Less(treasure / (double)runs, 0.95, "예전 평균은 1.14개");
            Assert.Greater(none, runs / 5, "보물 방이 없는 층도 꽤 있다");
        }

        [Test]
        public void MerchantSellsAtOneAndAHalfTimesTownPrice_RescuedMerchantStaysCheap()
        {
            var s = new GameSession(new MemorySaveStore(), () => new DateTime(2026, 10, 21, 9, 0, 0, DateTimeKind.Utc), 3);
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            s.EnterDungeon();
            var potion = ItemDb.CreateConsumable("potion");
            Assert.AreEqual((int)Math.Round(potion.Price * 1.5), s.MerchantPrice(potion));
            s.Run.Current.MerchantDiscount = true;
            Assert.AreEqual((int)Math.Round(potion.Price * 0.7), s.MerchantPrice(potion), "구해 준 상인의 할인은 그대로");
        }

        [Test]
        public void RiskyEvents_HaveAFreeWayOut()
        {
            foreach (var id in new[] { "ceiling", "evt_demon_whisper", "evt_goblin_chase" })
            {
                var def = EventDb.Get(id);
                var c = Character.Create("a", Job.Mage);
                var pass = Array.Find(def.Choices, ch => ch.Check == null && !ch.CheckAttackStat && ch.FixedChance >= 1.0 && ch.JobOnly < 0
                                                         && ch.Success != null && ch.Success.HpRatio >= 0 && ch.Success.GoldMult >= 0 && ch.Success.Battle == EventBattle.None);
                Assert.IsNotNull(pass, id + ": 100% 성공하고 대가 없는 선택지");
                Assert.AreEqual(1.0, EventRules.SuccessChance(pass, c, 5), 1e-9);
            }
        }

        [Test]
        public void Storage_KeepsWhatWasAlreadyStoredWhenItShrinks()
        {
            var c = Character.Create("a", Job.Warrior);
            c.Storage.Capacity = 10;
            for (int i = 0; i < 8; i++) c.Storage.Add(EquipmentFactory.Create(GearType.Helmet, ItemGrade.Common, 1, Job.Warrior, Stat.Strength));
            c.Storage.Capacity = RankSystem.StorageCapacity(Rank.F);
            Assert.AreEqual(4, c.Storage.Capacity);
            Assert.AreEqual(8, c.Storage.Items.Count, "이미 맡긴 물건은 지우지 않는다");
            Assert.AreEqual(0, c.Storage.FreeCells);
            var extra = EquipmentFactory.Create(GearType.Helmet, ItemGrade.Common, 1, Job.Warrior, Stat.Strength);
            c.Inventory.Add(extra);
            Assert.IsFalse(GuildSystem.Deposit(c, extra.Uid, out _), "새로 맡기는 것만 막힌다");
            Assert.IsTrue(GuildSystem.Withdraw(c, c.Storage.Items[0].Uid, out _), "찾는 것은 된다");
        }

        [Test]
        public void GuildNewQuestFlag_SetsAfterBossClearAndClearsWhenSeen()
        {
            var s = new GameSession(new MemorySaveStore(), () => new DateTime(2026, 10, 21, 9, 0, 0, DateTimeKind.Utc), 9);
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            Assert.IsFalse(s.GuildNewQuests);
            s.EnterDungeon();
            DungeonSystem.OnBossDefeated(s.Run, s.C, s.Data.Guild);
            s.ReturnToTown();
            if (s.Data.Guild.Board.Exists(q => q.TargetFloor == s.C.MaxChallengeFloor))
            {
                Assert.IsTrue(s.GuildNewQuests, "보스를 잡고 돌아오면 새 층 의뢰 알림");
                s.MarkGuildSeen();
                Assert.IsFalse(s.GuildNewQuests);
            }
            // 보스를 잡지 않고 돌아오면 알림이 없다
            s.EnterDungeon();
            s.ReturnToTown();
            Assert.IsFalse(s.GuildNewQuests);
        }

        [Test]
        public void MovePad_PutsNeighborsInTheirDirections_AndKeepsWalls()
        {
            //   1(위)
            // 2 0 3(오른쪽)   ← 아래는 막힘
            var run = HandMadeRun((5, 5), (5, 4), (4, 5), (6, 5));
            Link(run, 0, 1);
            Link(run, 0, 2);
            Link(run, 0, 3);
            run.PreviousRoomId = 2;
            var pad = DungeonSystem.Pad(run, Difficulty.Normal);
            Assert.AreEqual(1, pad[PadDir.Up].Room.Id);
            Assert.AreEqual(2, pad[PadDir.Left].Room.Id);
            Assert.AreEqual(3, pad[PadDir.Right].Room.Id);
            Assert.IsNull(pad[PadDir.Down].Room, "길이 없는 쪽은 막힘으로 남는다");
            Assert.IsTrue(pad[PadDir.Left].IsPrevious);
            Assert.IsFalse(pad[PadDir.Up].IsPrevious);
            Assert.IsFalse(pad[PadDir.Up].Known, "보통 난이도에서 처음 가는 방은 종류를 모른다");
            Assert.IsTrue(DungeonSystem.Pad(run, Difficulty.Easy)[PadDir.Up].Known, "쉬움은 미리 보인다");
            Assert.AreEqual(0, pad.Extra.Count);
        }

        [Test]
        public void MovePad_DiagonalShortcutTakesTheLongerAxis_OrGoesToExtra()
        {
            var run = HandMadeRun((5, 5), (5, 4), (4, 5), (6, 5), (5, 6), (8, 4));
            Link(run, 0, 1);
            Link(run, 0, 4);
            var pad = DungeonSystem.Pad(run, Difficulty.Normal);
            Link(run, 0, 5); // 개구멍: dx 3, dy −1 → 더 먼 축은 가로(오른쪽), 비어 있다
            pad = DungeonSystem.Pad(run, Difficulty.Normal);
            Assert.AreEqual(5, pad[PadDir.Right].Room.Id);
            Link(run, 0, 3); // 오른쪽 이웃이 생기면 그 방이 칸을 차지하고, 지름길은 다른 축(위)도 차 있으니 Extra
            pad = DungeonSystem.Pad(run, Difficulty.Normal);
            Assert.AreEqual(3, pad[PadDir.Right].Room.Id);
            Assert.AreEqual(1, pad[PadDir.Up].Room.Id);
            Assert.AreEqual(1, pad.Extra.Count);
            Assert.AreEqual(5, pad.Extra[0].Id);
        }

        [Test]
        public void MovePad_CoversEveryLinkOfRealFloors()
        {
            var rng = new Rng(77);
            for (int i = 0; i < 60; i++)
            {
                var c = Character.Create("a", Job.Warrior);
                var run = DungeonSystem.StartRun(c, 1 + i % 5, rng);
                foreach (var room in run.Map.Rooms)
                {
                    run.CurrentRoomId = room.Id;
                    var pad = DungeonSystem.Pad(run, Difficulty.Normal);
                    int placed = pad.Extra.Count;
                    foreach (var slot in pad.Slots) if (slot.Room != null) placed++;
                    Assert.AreEqual(room.Links.Count, placed, "모든 길이 칸이나 Extra에 있다");
                }
            }
        }
    }
}

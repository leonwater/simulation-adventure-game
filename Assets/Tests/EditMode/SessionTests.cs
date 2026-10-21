using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    public class SessionTests
    {
        private DateTime _now = new DateTime(2026, 10, 17, 9, 0, 0, DateTimeKind.Utc);

        private GameSession NewSession(MemorySaveStore store, int seed = 1) => new GameSession(store, () => _now, seed);

        [Test]
        public void Json_RoundTripsComplexSave()
        {
            var store = new MemorySaveStore();
            var s = NewSession(store);
            s.NewGame("에단 \"용사\"\n", Job.Archer, Difficulty.Hard);
            s.EnterDungeon();
            string a = Json.Serialize(s.Data);
            var loaded = Json.Deserialize<SaveData>(a);
            string b = Json.Serialize(loaded);
            Assert.AreEqual(a, b);
            Assert.AreEqual(Difficulty.Hard, loaded.Difficulty);
            Assert.AreEqual(Job.Archer, loaded.Character.Job);
            Assert.AreEqual(s.Data.Run.Map.Rooms.Count, loaded.Run.Map.Rooms.Count);
            Assert.IsNull(loaded.Character.Equipment[EquipSlot.Helmet]);
            Assert.IsNotNull(loaded.Character.Equipment[EquipSlot.Weapon]);
        }

        [Test]
        public void Json_ToleratesMissingAndUnknownFields()
        {
            var data = Json.Deserialize<SaveData>("{\"Version\":0,\"Unknown\":[1,2,{\"x\":null}],\"Character\":{\"Name\":\"a\",\"Job\":\"Mage\",\"Level\":7}}");
            Assert.AreEqual(Job.Mage, data.Character.Job);
            Assert.AreEqual(7, data.Character.Level);
            Assert.IsNotNull(data.Shop);
            SaveSystem.Repair(data);
            Assert.AreEqual(Equipment.SlotCount, data.Character.Equipment.Slots.Length);
        }

        [Test]
        public void Json_ParsesNumbersAndEscapes()
        {
            var item = Json.Deserialize<ItemInstance>("{\"Name\":\"\\uAC00\\\"b\\\\\",\"Count\":-3,\"Price\":1e3}");
            Assert.AreEqual("가\"b\\", item.Name);
            Assert.AreEqual(-3, item.Count);
            Assert.AreEqual(1000, item.Price);
        }

        [Test]
        public void Load_ReturnsNullForCorruptSave()
        {
            var store = new MemorySaveStore { Content = "{\"Character\":" };
            Assert.IsNull(SaveSystem.Load(store));
            store.Content = "not json";
            Assert.IsNull(SaveSystem.Load(store));
            Assert.IsFalse(NewSession(store).Continue());
        }

        [Test]
        public void Continue_RestoresTownAndDungeonState()
        {
            var store = new MemorySaveStore();
            var s = NewSession(store);
            s.NewGame("에단", Job.Warrior, Difficulty.Normal);
            s.C.Gold = 1234;
            s.Save();
            var s2 = NewSession(store, 2);
            Assert.IsTrue(s2.Continue());
            Assert.AreEqual(1234, s2.C.Gold);
            Assert.IsFalse(s2.InDungeon);

            s2.EnterDungeon();
            var battleRoom = MoveUntil(s2, RoomEnterResult.Battle);
            Assert.IsNotNull(s2.Battle);
            int enemyCount = s2.Battle.Enemies.Count;
            var s3 = NewSession(store, 3);
            Assert.IsTrue(s3.Continue());
            Assert.IsTrue(s3.InDungeon);
            Assert.IsNotNull(s3.Battle, "전투 중 저장하면 그 방의 전투를 다시 시작");
            Assert.AreEqual(enemyCount, s3.Battle.Enemies.Count);
            Assert.AreEqual(battleRoom, s3.Run.CurrentRoomId);
        }

        [Test]
        public void Tutorial_FixedFirstFloorThenAfterReturn()
        {
            var store = new MemorySaveStore();
            var s = NewSession(store);
            s.NewGame("에단", Job.Archer, Difficulty.Normal);
            Assert.AreEqual(TutorialStage.TownGuide, s.Data.Tutorial);
            s.EnterDungeon();
            Assert.IsTrue(s.Run.IsTutorial);
            Assert.AreEqual(TutorialStage.FirstDungeon, s.Data.Tutorial);
            Assert.AreEqual(6, s.Run.Map.Rooms.Count);
            Assert.AreEqual(RoomEnterResult.Battle, s.Move(1));
            Assert.AreEqual(1, s.Battle.Enemies.Count, "첫 전투는 슬라임 1마리");
            int guard = 0;
            while (s.Battle != null && !s.Battle.IsOver && guard++ < 50) s.ExecuteBattle(BotPlayer.PickBattleChoice(s.Battle));
            Assert.AreEqual(BattleOutcome.Victory, s.Battle.Outcome);
            Assert.GreaterOrEqual(s.C.Level, 2, "첫 전투 뒤 레벨 업");
            s.CloseBattle();
            Assert.AreEqual(RoomEnterResult.Return, s.Move(2));
            Assert.IsTrue(s.CanReturn);
            s.ReturnToTown();
            Assert.AreEqual(TutorialStage.AfterReturn, s.Data.Tutorial);
            s.SetTutorial(TutorialStage.Done);
            s.EnterDungeon();
            Assert.IsFalse(s.Run.IsTutorial);

            // 층을 돌파한 뒤 튜토리얼을 다시 보면 일반 층에서 던전 안내로 넘어간다
            s.ReturnToTown();
            s.C.HighestFloorCleared = 3;
            s.RestartTutorial();
            Assert.AreEqual(TutorialStage.TownGuide, s.Data.Tutorial);
            s.EnterDungeon();
            Assert.IsFalse(s.Run.IsTutorial);
            Assert.AreEqual(TutorialStage.FirstDungeon, s.Data.Tutorial);
        }

        [Test]
        public void Hardcore_DeathDeletesSave()
        {
            var store = new MemorySaveStore();
            var s = NewSession(store);
            s.NewGame("에단", Job.Mage, Difficulty.Hardcore);
            s.EnterDungeon();
            MoveUntil(s, RoomEnterResult.Battle);
            foreach (var e in s.Battle.Enemies)
            {
                e.Attack = 100000;
                e.MaxHp = e.Hp = 100000;
            }
            int guard = 0;
            while (s.Battle != null && guard++ < 50) s.ExecuteBattle(s.Battle.GetChoices()[0]);
            Assert.IsTrue(s.LastDeath.HardcoreReset);
            Assert.IsFalse(s.HasGame);
            Assert.IsFalse(store.Exists);
        }

        [Test]
        public void NormalDeath_ReturnsToTownWithPenalty()
        {
            var store = new MemorySaveStore();
            var s = NewSession(store);
            s.NewGame("에단", Job.Mage, Difficulty.Normal);
            s.C.Gold = 1000;
            s.EnterDungeon();
            MoveUntil(s, RoomEnterResult.Battle);
            foreach (var e in s.Battle.Enemies)
            {
                e.Attack = 100000;
                e.MaxHp = e.Hp = 100000;
            }
            int guard = 0;
            while (s.Battle != null && guard++ < 50) s.ExecuteBattle(s.Battle.GetChoices()[0]);
            Assert.IsNotNull(s.LastDeath);
            Assert.AreEqual(300, s.LastDeath.GoldLost);
            Assert.AreEqual(700, s.C.Gold);
            Assert.IsFalse(s.InDungeon);
            Assert.AreEqual(CharacterStats.MaxHp(s.C), s.C.CurrentHp);
        }

        [Test]
        public void ShopRerollCost_ResetsWhenComingBackFromTheDungeon()
        {
            var store = new MemorySaveStore();
            var s = NewSession(store);
            s.NewGame("에단", Job.Rogue, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            s.C.Gold = 10_000;
            Assert.IsTrue(ShopSystem.Reroll(s.Data.Shop, s.C, s.Rng, out _));
            Assert.AreEqual(200, ShopSystem.RerollCost(s.Data.Shop));
            string stock = s.Data.Shop.Equipment[0].Uid;
            _now = _now.AddHours(5);
            s.EnterDungeon();
            s.ReturnToTown();
            Assert.AreEqual(100, ShopSystem.RerollCost(s.Data.Shop), "던전에서 돌아오면 갱신 비용이 처음 값");
            Assert.AreEqual(stock, s.Data.Shop.Equipment[0].Uid, "물건은 그대로");
        }

        /// <summary>
        /// 자동 플레이 봇: 마을 준비 → 던전 탐험 → 전투 → 이벤트 → 귀환을 수백 번 반복하며
        /// 예외가 없는지, 저장·불러오기가 항상 같은 상태를 만드는지 확인한다.
        /// </summary>
        [Test]
        public void Bot_PlaysManyDungeonRunsWithoutErrors()
        {
            int maxFloor = 0, deaths = 0, runs = 0;
            foreach (Job job in Enum.GetValues(typeof(Job)))
            {
                var store = new MemorySaveStore();
                var s = NewSession(store, 100 + (int)job);
                s.NewGame("봇", job, Difficulty.Normal);
                for (int run = 0; run < 60; run++)
                {
                    BotPlayer.PrepareInTown(s);
                    s.EnterDungeon();
                    runs++;
                    int steps = 0;
                    while (s.InDungeon && steps++ < 400)
                    {
                        BotPlayer.Step(s);
                        if (steps % 37 == 0) AssertSaveRoundTrip(s, store);
                    }
                    if (s.InDungeon) s.ReturnToTown();
                    if (s.LastDeath != null) deaths++;
                    maxFloor = Math.Max(maxFloor, s.C.HighestFloorCleared);
                    _now = _now.AddMinutes(20);
                }
                TestContext.WriteLine(job + ": Lv." + s.C.Level + " 돌파 " + s.C.HighestFloorCleared + "층 " + s.C.Rank + " 등급 골드 " + s.C.Gold);
            }
            TestContext.WriteLine("총 " + runs + "회, 사망 " + deaths + "회, 최고 돌파 " + maxFloor + "층");
            Assert.Greater(maxFloor, 3, "봇이 최소한 몇 층은 돌파해야 한다");
        }

        private void AssertSaveRoundTrip(GameSession s, MemorySaveStore store)
        {
            s.Save();
            string a = store.Content;
            var loaded = SaveSystem.Load(store);
            Assert.IsNotNull(loaded);
            Assert.AreEqual(Json.Serialize(s.Data), Json.Serialize(loaded), "저장 왕복 결과가 같아야 한다");
            Assert.AreEqual(a, store.Content);
        }

        private static int MoveUntil(GameSession s, RoomEnterResult wanted)
        {
            var target = s.Run.Map.Rooms.Find(r => !r.Visited && (wanted == RoomEnterResult.Battle ? r.Type == RoomType.Battle : true));
            var cur = s.Run.Current;
            if (!cur.Links.Contains(target.Id)) cur.Links.Add(target.Id);
            if (!target.Links.Contains(cur.Id)) target.Links.Add(cur.Id);
            Assert.AreEqual(wanted, s.Move(target.Id));
            return target.Id;
        }
    }
}

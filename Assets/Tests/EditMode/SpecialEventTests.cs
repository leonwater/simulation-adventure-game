using System;
using System.Collections.Generic;
using Adventure.Core;
using NUnit.Framework;

namespace Adventure.Tests
{
    /// <summary>기획서 v1.5 특수 이벤트: 연쇄·지도·반복 선택·탐험 효과·시련의 문.</summary>
    public class SpecialEventTests
    {
        private static DungeonRun RunAt(Character c, string eventId, int floor, Rng rng)
        {
            c.HighestFloorCleared = Math.Max(c.HighestFloorCleared, floor - 1);
            var run = DungeonSystem.StartRun(c, floor, rng);
            var room = run.Map.Rooms.Find(r => r.Type == RoomType.Event);
            room.EventId = eventId;
            if (!run.Current.Links.Contains(room.Id)) run.Current.Links.Add(room.Id);
            if (!room.Links.Contains(run.Current.Id)) room.Links.Add(run.Current.Id);
            DungeonSystem.MoveTo(run, room.Id);
            return run;
        }

        private static int IndexOf(EventDef def, string label) => Array.FindIndex(def.Choices, ch => ch.Label == label);

        [Test]
        public void PickEvent_SkipsFollowupsEarlyTrialsAndRepeats()
        {
            var rng = new Rng(5);
            for (int i = 0; i < 2000; i++)
            {
                var e = EventDb.PickEvent(rng, 1 + i % 2);
                Assert.IsFalse(e.Followup, e.Id);
                Assert.AreNotEqual("evt_trial_gate", e.Id);
            }
            for (int i = 0; i < 40; i++)
            {
                var map = DungeonGenerator.Generate(1 + i % 30, rng);
                var ids = new HashSet<string>();
                foreach (var r in map.Rooms)
                    if (r.Type == RoomType.Event) Assert.IsTrue(ids.Add(r.EventId), r.EventId);
            }
        }

        [Test]
        public void TreasurePile_RepeatsUntilTrapOrLeave()
        {
            var rng = new Rng(9);
            var def = EventDb.Get("evt_treasure_pile");
            for (int k = 0; k < 30; k++)
            {
                var c = Character.Create("a", Job.Archer);
                var run = RunAt(c, def.Id, 3, rng);
                long gold = c.Gold;
                int grabs = k % 4;
                EventResult r = null;
                bool trapped = false;
                for (int i = 0; i < grabs; i++)
                {
                    r = EventRules.Resolve(run, c, 0, rng);
                    if (!r.Continues)
                    {
                        trapped = true;
                        break;
                    }
                    Assert.IsFalse(run.Current.Cleared);
                    Assert.AreEqual(gold, c.Gold, "모으는 동안에는 골드가 들어오지 않는다");
                }
                long bank = run.Current.EventBank;
                if (!trapped)
                {
                    EventRules.Resolve(run, c, 1, rng);
                    Assert.AreEqual(gold + bank, c.Gold);
                }
                else Assert.AreEqual(gold + bank / 2, c.Gold, "함정에 걸리면 모은 골드의 절반");
                Assert.IsTrue(run.Current.Cleared);
            }
        }

        [Test]
        public void BloodWell_FiveOfferingsWithGrowingExp()
        {
            var rng = new Rng(3);
            var c = Character.Create("a", Job.Warrior);
            var run = RunAt(c, "evt_blood_well", 5, rng);
            var def = EventDb.Get("evt_blood_well");
            long last = 0;
            for (int i = 0; i < 5; i++)
            {
                c.CurrentHp = CharacterStats.MaxHp(c);
                Assert.IsNull(EventRules.UnavailableReason(def, 0, run, c));
                var r = EventRules.Resolve(run, c, 0, rng);
                Assert.Less(r.HpChange, 0);
                Assert.GreaterOrEqual(r.Loot.Exp, last);
                last = r.Loot.Exp;
                Assert.AreEqual(i < 4, r.Continues);
            }
            Assert.IsTrue(run.Current.Cleared);
            Assert.Greater(last, GameBalance.EnemyExp(5) * 5);

            // HP가 10% 이하면 바칠 수 없다
            var c2 = Character.Create("b", Job.Mage);
            var run2 = RunAt(c2, "evt_blood_well", 5, rng);
            c2.CurrentHp = 1;
            Assert.IsNotNull(EventRules.UnavailableReason(def, 0, run2, c2));
        }

        [Test]
        public void WoundedMerchant_ChainsIntoDiscountShop()
        {
            var rng = new Rng(11);
            var c = Character.Create("a", Job.Warrior);
            c.Inventory.Add(ItemDb.CreateConsumable("potion"));
            var run = RunAt(c, "evt_wounded_merchant", 4, rng);
            var def = EventDb.Get("evt_wounded_merchant");
            int help = Array.FindIndex(def.Choices, ch => ch.Success.Chain == "evt_merchant_reward");
            Assert.GreaterOrEqual(help, 0);
            EventRules.Resolve(run, c, help, rng);
            var chained = run.Map.Rooms.Find(r => r.Chain);
            Assert.IsNotNull(chained);
            Assert.AreEqual(RoomType.Event, chained.Type);
            Assert.AreEqual("evt_merchant_reward", chained.EventId);
            Assert.IsFalse(chained.Visited);
            var option = DungeonSystem.MoveOptions(run, Difficulty.Normal).Find(o => o.Room == chained);
            if (option.Room != null) StringAssert.Contains("!", option.Hint);

            // 후속 방으로 가서 보답을 받으면 그 방이 할인 상점이 된다
            run.CurrentRoomId = chained.Id;
            chained.Visited = true;
            var reward = EventDb.Get(chained.EventId);
            EventRules.Resolve(run, c, EventRules.VisibleChoices(reward, c, run)[0], rng);
            Assert.AreEqual(RoomType.Merchant, chained.Type);
            Assert.IsTrue(chained.MerchantDiscount);
            Assert.IsTrue(chained.Cleared);
            Assert.IsNotEmpty(chained.MerchantGoods);
        }

        [Test]
        public void MapEvents_RevealLinkBossFindReturnAndSpawnTreasure()
        {
            var rng = new Rng(21);
            var c = Character.Create("a", Job.Archer);
            var run = RunAt(c, "evt_torn_map", 6, rng);
            EventRules.Resolve(run, c, IndexOf(EventDb.Get("evt_torn_map"), "펼쳐 본다"), rng);
            foreach (var r in run.Map.Rooms) Assert.IsTrue(r.Visited || r.Revealed, "방 " + r.Id);
            Assert.IsTrue(DungeonSystem.MoveOptions(run, Difficulty.Normal).TrueForAll(o => o.Known));

            var run2 = DungeonSystem.StartRun(c, 6, rng);
            MapEvents.Reveal(run2, RevealKind.Nearby2, true, rng);
            var dist = run2.Map.Distances(run2.CurrentRoomId);
            foreach (var r in run2.Map.Rooms) Assert.AreEqual(!r.Visited && dist[r.Id] <= 2, r.Revealed, "방 " + r.Id);
            var wrong = run2.Map.Rooms.Find(r => r.ShownType >= 0);
            if (wrong != null) Assert.AreNotEqual(wrong.Type, wrong.DisplayType);

            MapEvents.LinkBoss(run2);
            Assert.Contains(run2.Map.BossId, run2.Current.Links);
            Assert.IsTrue(run2.Map.Boss.Revealed);
            Assert.IsFalse(run2.ReturnRoomFound);
            MapEvents.FindReturn(run2);
            Assert.IsTrue(run2.ReturnRoomFound);

            int before = run2.Map.Rooms.Count;
            if (MapEvents.SpawnTreasure(run2, rng))
            {
                var t = run2.Map.Rooms[before];
                Assert.AreEqual(RoomType.Treasure, t.Type);
                Assert.Contains(t.Id, run2.Current.Links);
                Assert.IsTrue(run2.Map.IsConnected());
                foreach (var r in run2.Map.Rooms)
                    if (r != t) Assert.IsFalse(r.X == t.X && r.Y == t.Y, "같은 칸에 방이 겹친다");
            }
        }

        [Test]
        public void ExploreEffects_ApplyAndExpire()
        {
            var list = new List<ExploreEffect>();
            ExploreEffects.Add(list, ExploreEffectType.Regen, 3);
            ExploreEffects.Add(list, ExploreEffectType.Regen, 1);
            ExploreEffects.Add(list, ExploreEffectType.Drum, 1);
            ExploreEffects.Add(list, ExploreEffectType.Curse, -1);
            ExploreEffects.Add(list, ExploreEffectType.DemonPact, -1);
            Assert.AreEqual(3, list.Find(e => e.Type == ExploreEffectType.Regen).Battles);

            var c = Character.Create("a", Job.Warrior);
            var plain = new Battle(c, 3, EnemyFactory.CreateGroup(3, Difficulty.Normal, 1), false, new Rng(1));
            var b = new Battle(c, 3, EnemyFactory.CreateGroup(3, Difficulty.Normal, 1), false, new Rng(1), false,
                x => ExploreEffects.ApplyToBattle(list, x));
            Assert.IsTrue(b.Player.Statuses.Has(StatusType.Regen));
            Assert.Greater(b.Player.Attack, plain.Player.Attack);
            Assert.Less(b.Player.DamageReduction, plain.Player.DamageReduction);
            Assert.AreEqual(0.5, b.DropMultiplier, 1e-9);

            ExploreEffects.AfterBattle(list, false);
            Assert.IsTrue(ExploreEffects.Has(list, ExploreEffectType.Drum), "북소리는 전투 방에서만 줄어든다");
            ExploreEffects.AfterBattle(list, true);
            Assert.IsFalse(ExploreEffects.Has(list, ExploreEffectType.Drum));
            Assert.AreEqual(1, list.Find(e => e.Type == ExploreEffectType.Regen).Battles);
            ExploreEffects.OnRest(list);
            Assert.IsFalse(ExploreEffects.Has(list, ExploreEffectType.Curse));
            Assert.IsTrue(ExploreEffects.Has(list, ExploreEffectType.DemonPact));

            // 북소리는 적을 하나 더 부른다 (최대 4)
            for (int seed = 0; seed < 50; seed++)
            {
                int n = EnemyFactory.CreateGroup(8, Difficulty.Normal, seed).Count;
                Assert.AreEqual(Math.Min(4, n + 1), EnemyFactory.CreateGroup(8, Difficulty.Normal, seed, 1).Count);
            }
        }

        [Test]
        public void TrialGate_BossFightCountsAsClearAndReturnsToTown()
        {
            var store = new MemorySaveStore();
            var s = new GameSession(store, () => new DateTime(2026, 10, 19, 9, 0, 0, DateTimeKind.Utc), 4);
            s.NewGame("a", Job.Warrior, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            s.C.HighestFloorCleared = 3;
            s.SelectFloor(4);
            s.EnterDungeon();
            var run = s.Run;
            var room = run.Map.Rooms.Find(r => r.Type == RoomType.Event);
            room.EventId = "evt_trial_gate";
            run.CurrentRoomId = room.Id;
            room.Visited = true;
            var def = s.PendingEvent;
            Assert.AreEqual(EventSpecial.TrialGate, def.Special);
            StringAssert.Contains("·", EventRules.Label(def, 2, run, s.C));

            s.ChooseEvent(2); // 다다음 층 (6층)
            Assert.IsNotNull(s.Battle);
            Assert.IsTrue(s.Battle.IsBoss);
            Assert.IsTrue(s.Battle.CanFlee, "시련의 보스에게서는 도망칠 수 있다");
            Assert.AreEqual(6, s.Battle.Floor);
            Assert.AreEqual(6, run.TrialFloor);

            // 이긴 것으로 만든다
            for (int i = 0; i < 400 && !s.Battle.IsOver; i++)
            {
                foreach (var e in s.Battle.Enemies) e.Hp = Math.Min(e.Hp, 1);
                s.Battle.Player.Hp = s.Battle.Player.MaxHp;
                var attack = s.Battle.GetChoices().Find(ch => ch.Kind == ActionKind.Attack);
                s.ExecuteBattle(attack);
            }
            Assert.AreEqual(BattleOutcome.Victory, s.Battle.Outcome);
            Assert.IsTrue(s.TrialWon);
            Assert.AreEqual(6, s.C.HighestFloorCleared);
            s.CloseBattle();
            Assert.IsFalse(s.InDungeon);
            Assert.AreEqual(6, s.LastReturn.Floor);
            Assert.IsTrue(s.LastReturn.BossCleared);
            Assert.AreEqual(7, s.C.MaxChallengeFloor);
        }

        [Test]
        public void TrialGate_HidesClearedAndTooDeepFloors()
        {
            var rng = new Rng(2);
            var c = Character.Create("a", Job.Mage);
            c.HighestFloorCleared = 29;
            var run = RunAt(c, "evt_trial_gate", 29, rng);
            var def = EventDb.Get("evt_trial_gate");
            var visible = EventRules.VisibleChoices(def, c, run);
            Assert.Contains(0, visible);
            Assert.Contains(1, visible);
            Assert.IsFalse(visible.Contains(2), "31층 시련은 없다");
            run.BossDefeated = true;
            Assert.IsFalse(EventRules.VisibleChoices(def, c, run).Contains(0));
        }

        [Test]
        public void Sphinx_IntelligenceRemovesOneWrongAnswer()
        {
            var rng = new Rng(8);
            var def = EventDb.Get("evt_sphinx");
            for (int k = 0; k < 20; k++)
            {
                var c = Character.Create("a", Job.Mage);
                var run = RunAt(c, def.Id, 1 + k, rng);
                int removed = EventRules.SphinxRemoved(run, c);
                var visible = EventRules.VisibleChoices(def, c, run);
                Assert.AreEqual(removed >= 0 ? def.Choices.Length - 1 : def.Choices.Length, visible.Count);
                var hp = c.CurrentHp;
                var r = EventRules.Resolve(run, c, visible[0], rng);
                Assert.IsTrue(run.Current.Cleared);
                if (r.Success) Assert.Greater(r.Loot.Exp, 0);
                else Assert.Less(c.CurrentHp, hp);
                StringAssert.Contains("\"", EventRules.Body(def, run, c));
            }
        }

        [Test]
        public void EventBattles_FleeingEndsTheEvent()
        {
            var store = new MemorySaveStore();
            var s = new GameSession(store, () => new DateTime(2026, 10, 19, 9, 0, 0, DateTimeKind.Utc), 6);
            s.NewGame("a", Job.Archer, Difficulty.Normal);
            s.SetTutorial(TutorialStage.Done);
            s.EnterDungeon();
            var run = s.Run;
            var room = run.Map.Rooms.Find(r => r.Type == RoomType.Event);
            room.EventId = "evt_campfire";
            run.CurrentRoomId = room.Id;
            room.Visited = true;
            var def = s.PendingEvent;
            int fight = Array.FindIndex(def.Choices, ch => ch.Success.Battle == EventBattle.Wanderer);
            s.ChooseEvent(fight);
            Assert.IsNotNull(s.Battle);
            Assert.AreEqual("떠돌이 모험가", s.Battle.Enemies[0].Name);
            for (int i = 0; i < 200 && s.Battle != null && !s.Battle.IsOver; i++)
            {
                s.Battle.Player.Hp = s.Battle.Player.MaxHp;
                s.ExecuteBattle(s.Battle.GetChoices().Find(ch => ch.Kind == ActionKind.Flee));
            }
            Assert.IsNull(s.Battle);
            Assert.IsTrue(room.Cleared);
            Assert.IsNull(s.PendingEvent);
        }
    }
}

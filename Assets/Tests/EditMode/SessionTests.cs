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
            while (s.Battle != null && !s.Battle.IsOver && guard++ < 50) s.ExecuteBattle(PickBattleChoice(s.Battle));
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
        public void ShopTick_RefreshesAfterRealTime()
        {
            var store = new MemorySaveStore();
            var s = NewSession(store);
            s.NewGame("에단", Job.Rogue, Difficulty.Normal);
            Assert.IsFalse(s.TickShop());
            _now = _now.AddMinutes(31);
            Assert.IsTrue(s.TickShop());
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
                    PrepareInTown(s);
                    s.EnterDungeon();
                    runs++;
                    int steps = 0;
                    while (s.InDungeon && steps++ < 400)
                    {
                        Step(s);
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

        private static void PrepareInTown(GameSession s)
        {
            var c = s.C;
            Leveling.AutoAllocate(c);
            RankSystem.TryPromote(c);
            // 완료한 퀘스트 보고, 새 퀘스트 수주
            foreach (var q in new List<Quest>(s.Data.Guild.Active))
                if (GuildSystem.IsComplete(q, c)) GuildSystem.TurnIn(s.Data.Guild, c, q.Id, out _, out _);
            while (s.Data.Guild.Active.Count < 3 && s.Data.Guild.Board.Count > 0)
                if (!GuildSystem.Accept(s.Data.Guild, c, s.Data.Guild.Board[0].Id, out _)) break;
            // 스킬서 사용, 스킬 장착
            foreach (var item in new List<ItemInstance>(c.Inventory.Items))
                if (item.Kind == ItemKind.SkillBook) SkillSystem.UseSkillBook(c, item.Uid, out _);
            foreach (var st in c.Skills.Learned) SkillSystem.Equip(c, st.SkillId, out _);
            // 더 좋은 장비 착용
            foreach (var item in new List<ItemInstance>(c.Inventory.Items))
            {
                if (item.Kind != ItemKind.Equipment || EquipmentSystem.CannotEquipReason(c, item) != null) continue;
                var slot = c.Equipment.ChooseSlot(item.Gear);
                var cur = c.Equipment[slot];
                if (cur == null || cur.Value < item.Value) EquipmentSystem.Equip(c, item.Uid, out _, slot);
            }
            // 쓸모없는 장비와 재료 판매 (퀘스트 재료는 남김)
            foreach (var item in new List<ItemInstance>(c.Inventory.Items))
            {
                bool questMat = s.Data.Guild.Active.Exists(q => q.MaterialId == item.TemplateId);
                if (item.Kind == ItemKind.Equipment || (item.Kind == ItemKind.Material && !questMat))
                    ShopSystem.Sell(c, item.Uid, item.Count, out _);
            }
            // 강화와 수련
            var weapon = c.Equipment[EquipSlot.Weapon];
            if (weapon != null && c.Gold > Blacksmith.GoldCost(weapon) * 3) Blacksmith.Enhance(c, weapon.Uid, s.Rng, out _);
            foreach (var st in c.Skills.Learned)
                if (c.Gold > SkillSystem.TrainingCost(st) * 4 && SkillSystem.TrainingCost(st) > 0) SkillSystem.Train(c, st.SkillId, out _);
            // 물약 구매
            var potion = s.Data.Shop.Goods.Find(g => g.Item.TemplateId == "potion");
            int need = 6 - c.Inventory.CountOf("potion");
            if (potion != null && need > 0 && c.Gold > 50 * need) ShopSystem.BuyGood(s.Data.Shop, c, potion.Item.Uid, need, out _);
            if (c.Inventory.FreeCells < 4 && ShopSystem.CanBuyBag(c) && c.Gold > ShopSystem.BagPrice(c) * 2) ShopSystem.BuyBag(c, out _);
            s.SelectFloor(c.MaxChallengeFloor);
            s.Save();
        }

        private static void Step(GameSession s)
        {
            var c = s.C;
            if (s.Battle != null)
            {
                if (s.Battle.IsOver)
                {
                    s.CloseBattle();
                    return;
                }
                s.ExecuteBattle(PickBattleChoice(s.Battle));
                return;
            }
            var ev = s.PendingEvent;
            if (ev != null)
            {
                int best = -1;
                double bestP = -1;
                foreach (int i in EventRules.VisibleChoices(ev, c, s.Run))
                {
                    var ch = ev.Choices[i];
                    if (EventRules.UnavailableReason(ev, i, s.Run, c) != null) continue;
                    double p = EventRules.SuccessChance(ch, c, s.Run.Floor);
                    if (ch.Success.ReturnToTown) p = c.CurrentHp < CharacterStats.MaxHp(c) / 3 ? 2 : -1;
                    if (p > bestP)
                    {
                        bestP = p;
                        best = i;
                    }
                }
                s.ChooseEvent(best);
                return;
            }
            if (s.Run.Current.Type == RoomType.Merchant)
            {
                var potion = s.Run.Current.MerchantGoods.Find(g => g.Item.TemplateId == "potion");
                if (c.Inventory.CountOf("potion") < 2 && c.Gold > 200) s.BuyFromMerchant(potion.Item.Uid, 2, out _);
            }
            // HP가 낮으면 물약을 마시거나 돌아간다
            int max = CharacterStats.MaxHp(c);
            if (c.CurrentHp < max / 2)
            {
                var p = c.Inventory.Items.Find(i => i.TemplateId == "potion" || i.TemplateId == "potion_hi");
                if (p != null)
                {
                    s.UseConsumable(p.Uid, out _);
                    return;
                }
                if (s.CanReturn)
                {
                    s.ReturnToTown();
                    return;
                }
            }
            if (s.Run.BossDefeated)
            {
                if (s.CanDescend && c.CurrentHp > max * 0.6) s.Descend();
                else s.ReturnToTown();
                return;
            }
            var options = DungeonSystem.MoveOptions(s.Run, s.Difficulty);
            var fresh = options.Find(o => !o.Room.Visited);
            if (fresh.Room != null)
            {
                s.Move(fresh.Room.Id);
                return;
            }
            // 주변을 다 봤으면 아직 안 간 방과 이웃한 탐험한 방으로 텔레포트
            foreach (var r in DungeonSystem.TeleportTargets(s.Run))
            {
                if (r.Links.Exists(l => !s.Run.Map.Get(l).Visited))
                {
                    s.Teleport(r.Id);
                    return;
                }
            }
            s.Move(options[0].Room.Id);
        }

        private static BattleChoice PickBattleChoice(Battle b)
        {
            var all = b.GetChoices();
            if (all.Count == 1) return all[0];
            if (b.Player.HpRatio < 0.35)
            {
                var heal = b.GetItemChoices().Find(x => x.Enabled && x.Label.Contains("회복"));
                if (heal != null) return heal;
            }
            BattleChoice best = null;
            double bestScore = double.MinValue;
            foreach (var ch in all)
            {
                if (!ch.Enabled || ch.Kind == ActionKind.Item || ch.Kind == ActionKind.Flee) continue;
                double score = ch.Chance;
                if (ch.Kind == ActionKind.Skill) score += 0.5;
                if (ch.Target >= 0) score += 1.0 - b.Enemies[ch.Target].HpRatio;
                if (score > bestScore)
                {
                    bestScore = score;
                    best = ch;
                }
            }
            return best ?? all.Find(x => x.Enabled);
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

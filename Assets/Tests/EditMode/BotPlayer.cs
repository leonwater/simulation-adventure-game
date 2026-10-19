using System.Collections.Generic;
using Adventure.Core;

namespace Adventure.Tests
{
    /// <summary>자동 플레이 봇 (테스트와 밸런스 시뮬레이션 tools/balance 가 같이 쓴다).</summary>
    public static class BotPlayer
    {
        public static void PrepareInTown(GameSession s)
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

        public static void Step(GameSession s)
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

        public static BattleChoice PickBattleChoice(Battle b)
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
    }
}

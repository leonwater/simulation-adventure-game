using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>길드 (시설 공통 화면): 접수원 일러스트 + 대사, 탭(퀘스트·등급·창고).</summary>
    public class GuildScreen : ScreenBase
    {
        private int _tab;
        private string _line = "무사히 돌아오셨네요. 오늘은 어떤 일로 오셨나요?";

        public GuildScreen(int tab = 0)
        {
            _tab = tab;
        }

        public override bool OnBack()
        {
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "길드", "마을", () => Go(new TownScreen()), Names.Gold(C.Gold));
            ScreenKit.NpcIllustration(page, "길드 접수원", "접수원", _line, 220);
            UI.Spacer(page, 0, 6);
            ScreenKit.Tabs(page, new[] { "퀘스트", "등급", "창고" }, _tab, i =>
            {
                _tab = i;
                Rebuild();
            });
            var body = UI.Scroll(page, out _, 8, UI.Pad(12, 12, 12, 16), "guild" + _tab);
            if (_tab == 0) Quests(body);
            else if (_tab == 1) RankTab(body);
            else StorageTab(body);
        }

        // ── 퀘스트 ──

        private void Quests(Transform body)
        {
            var g = S.Data.Guild;
            var info = UI.Row(body);
            var l = UI.Sub(info, "수주 중 " + g.Active.Count + "/" + GameBalance.MaxActiveQuests + " · 내 등급 " + C.Rank);
            UI.Size(l, flexW: 1);
            UI.Sub(info, "수주 가능: " + GuildSystem.MinQuestRank(C.Rank) + " ~ " + GuildSystem.MaxQuestRank(C.Rank), TextAnchor.MiddleRight);

            foreach (var q in new List<Quest>(g.Active)) QuestCard(body, q, true);
            if (g.Board.Count == 0) UI.Sub(body, "게시판이 비었습니다. 던전에 다녀오면 새 의뢰가 붙습니다.");
            foreach (var q in new List<Quest>(g.Board)) QuestCard(body, q, false);
        }

        private void QuestCard(Transform parent, Quest q, bool active)
        {
            bool sameRank = q.Rank == C.Rank;
            var card = UI.Card(parent, Theme.Card, active ? Theme.BlueBorder : Theme.CardBorder, 12, UI.Pad(14, 12), true, 6);
            var head = UI.Row(card, 8);
            UI.Pill(head, q.Rank.ToString(), q.Rank > C.Rank ? Theme.Accent : Theme.PlaceholderLine, q.Rank > C.Rank ? Theme.Gold : Theme.TextLog, 11, 6);
            var t = UI.Label(head, q.Title, 15, Theme.Text, true);
            UI.Size(t, flexW: 1);

            var row = UI.Row(card, 8);
            string detail = active ? "목표 " + q.TargetFloor + "층 · " + GuildSystem.ProgressText(q, C) + " · " + q.RewardGold.ToString("#,0") + "G" : GuildSystem.Summary(q);
            var d = UI.Sub(row, detail);
            UI.Size(d, flexW: 1);
            if (active)
            {
                if (GuildSystem.IsComplete(q, C))
                    UI.TextButton(row, "보고", () => TurnIn(q), ButtonKind.Primary, 44, 14, 72);
                else
                {
                    var col = UI.Column(row, 2, null, TextAnchor.MiddleRight);
                    UI.Label(col, "수주 중", 13, Theme.BlueText, false, TextAnchor.MiddleRight, false, false);
                    UI.TextButton(col, "포기", () => Abandon(q), ButtonKind.Ghost, 36, 12, 64);
                }
            }
            else
            {
                var take = UI.TextButton(row, "수주", () => Accept(q), ButtonKind.Outline, 44, 14, 72);
                UI.SetEnabled(take, GuildSystem.CannotAcceptReason(S.Data.Guild, C, q) == null);
            }
        }

        private void Accept(Quest q)
        {
            if (!GuildSystem.Accept(S.Data.Guild, C, q.Id, out string err))
            {
                Toast(err);
                return;
            }
            _line = "\"" + q.Title + "\" 의뢰를 맡기셨습니다. 무리하지 마세요.";
            S.Save();
            Rebuild();
        }

        private void Abandon(Quest q)
        {
            Overlay.Confirm("의뢰 포기", "\"" + q.Title + "\" 의뢰를 포기할까요? 진행도는 사라집니다.", "포기", () =>
            {
                GuildSystem.Abandon(S.Data.Guild, q.Id);
                S.Save();
                Rebuild();
            }, "취소", ButtonKind.Secondary);
        }

        private void TurnIn(Quest q)
        {
            int beforeLv = C.Level;
            if (!GuildSystem.TurnIn(S.Data.Guild, C, q.Id, out int levels, out string err))
            {
                Toast(err);
                return;
            }
            _line = "수고하셨어요! 보수 " + q.RewardGold.ToString("#,0") + "G와 경험치 " + q.RewardExp.ToString("#,0") + "을 드릴게요.";
            if (levels > 0) Toast("레벨 업! Lv." + beforeLv + " → Lv." + C.Level);
            S.Save();
            Rebuild();
        }

        // ── 등급 ──

        private void RankTab(Transform body)
        {
            var st = RankSystem.GetStatus(C);
            var card = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 12), true, 8);
            var head = UI.Row(card);
            var t = UI.Label(head, C.Rank + " 등급 배지", 15, Theme.Text, true);
            UI.Size(t, flexW: 1);
            UI.Label(head, "기본 능력치 +" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(C.Rank) * 100) + "%", 13, Theme.Gold, false, TextAnchor.MiddleRight, false, false);
            UI.Sub(card, "스킬 장착 " + RankSystem.SkillSlots(C.Rank) + "칸 · 창고 " + RankSystem.StorageCapacity(C.Rank) + "칸");

            if (st.IsMaxRank)
            {
                UI.Label(card, "최고 등급에 도달했습니다.", 14, Theme.Gold);
                return;
            }
            UI.Divider(card);
            UI.Sub(card, st.Next + " 등급 승급 조건 (배지 +" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(st.Next) * 100) + "%)");
            Condition(card, "돌파 층", st.FloorCurrent, st.FloorRequired, st.FloorMet);
            Condition(card, "레벨", st.LevelCurrent, st.LevelRequired, st.LevelMet);
            Condition(card, "퀘스트 완료", st.QuestsCurrent, st.QuestsRequired, st.QuestsMet);
            var b = UI.TextButton(card, st.Next + " 등급으로 승급", Promote, ButtonKind.Primary);
            UI.SetEnabled(b, st.CanPromote);

            var table = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 10), true, 4);
            UI.Label(table, "등급표", 14, Theme.Text, true);
            for (int r = 1; r <= (int)Rank.SS; r++)
            {
                var row = UI.Row(table, 8);
                bool cur = (int)C.Rank == r;
                var n = UI.Label(row, ((Rank)r).ToString(), 13, cur ? Theme.Gold : Theme.Text, cur);
                UI.Size(n, width: 36);
                var req = UI.Sub(row, "층 " + GameBalance.PromotionRequirements[r, 0] + " · Lv." + GameBalance.PromotionRequirements[r, 1] + " · 퀘스트 " + GameBalance.PromotionRequirements[r, 2]);
                UI.Size(req, flexW: 1);
                UI.Sub(row, "+" + Mathf.RoundToInt((float)GameBalance.BadgeBonus[r] * 100) + "%", TextAnchor.MiddleRight);
            }
        }

        private static void Condition(Transform parent, string label, int cur, int req, bool met)
        {
            var row = UI.Row(parent, 8);
            UI.Size(row, height: 28);
            var l = UI.Label(row, label, 14, Theme.Text);
            UI.Size(l, flexW: 1);
            UI.Label(row, Mathf.Min(cur, req) + " / " + req, 14, met ? Theme.Green : Theme.TextSub, met, TextAnchor.MiddleRight, false, false);
        }

        private void Promote()
        {
            if (!RankSystem.TryPromote(C)) return;
            _line = "축하드립니다! 이제 " + C.Rank + " 등급 모험가입니다.";
            Toast(C.Rank + " 등급으로 승급했다! 배지 효과 +" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(C.Rank) * 100) + "%");
            S.Save();
            Rebuild();
        }

        // ── 창고 ──

        private void StorageTab(Transform body)
        {
            UI.Sub(body, "창고에 맡긴 아이템은 던전에서 쓰러져도 잃지 않습니다.");
            UI.Label(body, "창고 " + C.Storage.UsedCells + " / " + C.Storage.Capacity, 14, Theme.Text, true);
            ItemGrid.Build(body, C.Storage, null, item => Overlay.Confirm(item.DisplayName, item.StatLine(), "찾기", () =>
            {
                if (!GuildSystem.Withdraw(C, item.Uid, out string err)) Toast(err);
                S.Save();
                Rebuild();
            }, "닫기"));

            UI.Spacer(body, 0, 6);
            UI.Label(body, "가방 " + C.Inventory.UsedCells + " / " + C.Inventory.Capacity, 14, Theme.Text, true);
            ItemGrid.Build(body, C.Inventory, null, item => Overlay.Confirm(item.DisplayName, item.StatLine(), "맡기기", () =>
            {
                if (!GuildSystem.Deposit(C, item.Uid, out string err)) Toast(err);
                S.Save();
                Rebuild();
            }, "닫기"));
        }
    }
}

using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>길드 (시설 공통 화면): 접수원 일러스트 + 대사, 탭(퀘스트·등급·창고).</summary>
    public class GuildScreen : ScreenBase
    {
        private int _tab;
        /// <summary>창고 탭: false = 보관(기본), true = 출고.</summary>
        private bool _withdraw;
        private string _line = "무사히 돌아오셨네요. 오늘은 어떤 일로 오셨나요?";

        public override bool OnBack()
        {
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "길드", "마을", () => Go(new TownScreen()), C);
            // 창고 탭에서는 접수원이 수수료를 알려 준다 (v1.9: 창고 탭의 설명 문구 대신)
            string line = _tab == 2 ? "창고에 맡기실 때마다 수수료 " + GuildSystem.StorageFee(C) + "G를 받아요. 찾아가실 때는 무료예요. 맡긴 물건은 던전에서 쓰러져도 안전하답니다." : _line;
            ScreenKit.NpcIllustration(page, "길드 접수원", line, 260);
            UI.Spacer(page, 0, 6);
            ScreenKit.Tabs(page, new[] { "퀘스트", "등급", "창고" }, _tab, i =>
            {
                _tab = i;
                Rebuild();
            });
            var body = UI.Scroll(page, out _, 8, UI.Pad(16, 16, 12, 16), "guild" + _tab);
            if (_tab == 0) Quests(body);
            else if (_tab == 1) RankTab(body);
            else StorageTab(body);
            Tutorial.OnGuild(_tab);
        }

        // ── 퀘스트 (카드: 등급 · 이름 · 목표/진행 · 보상, 누르면 상세) ──

        private void Quests(Transform body)
        {
            var g = S.Data.Guild;
            var info = UI.Row(body, 6);
            var l = UI.Sub(info, "진행 중 " + g.Active.Count + "/" + GameBalance.MaxActiveQuests);
            UI.Size(l, flexW: 1);
            UI.Sub(info, "수락 가능", TextAnchor.MiddleRight);
            UI.Icon(info, UI.RankIcon(GuildSystem.MinQuestRank(C.Rank)), 18);
            UI.Sub(info, "~", TextAnchor.MiddleCenter);
            UI.Icon(info, UI.RankIcon(GuildSystem.MaxQuestRank(C.Rank)), 18);

            var list = UI.Column(body, 6);
            Anchors.Set("guild.list", list);
            foreach (var q in new List<Quest>(g.Active)) QuestCard(list, q, true);
            if (g.Board.Count == 0) UI.Sub(list, "게시판이 비었습니다. 던전에 다녀오면 새 의뢰가 붙습니다.");
            foreach (var q in new List<Quest>(g.Board)) QuestCard(list, q, false);
        }

        private void QuestCard(Transform parent, Quest q, bool active)
        {
            bool done = active && GuildSystem.IsComplete(q, C);
            var card = UI.ButtonCard(parent, () => QuestDetail(q, active), active ? Theme.BlueBg : Theme.Card, done ? Theme.Accent : active ? Theme.Blue : Theme.CardBorder,
                10, UI.Pad(10, 6), false, 8, 66);
            if (active)
            {
                // 진행 중인 의뢰는 굵은(2px) 테두리
                var fill = card.Find("fill") as RectTransform;
                if (fill != null) UI.Stretch(fill, 2, 2, 2, 2);
            }
            UI.Icon(card, UI.RankIcon(q.Rank), 28);
            var col = UI.Column(card, 1);
            UI.Size(col, flexW: 1);
            UI.Label(col, q.Title, 14, Theme.Text, true);
            UI.Label(col, (active ? "진행 중 · " + GuildSystem.ProgressText(q, C) : "목표 " + q.TargetFloor + "층 · " + GuildSystem.GoalText(q)),
                12, done ? Theme.Gold : Theme.TextSub);
            // 보상은 카드에 바로 (골드 · 경험치)
            UI.Label(col, "보상 " + UI.Color(q.RewardGold.ToString("#,0") + "G", Theme.GoldHex) + " · " + UI.Color("경험치 " + q.RewardExp.ToString("#,0"), "#8FC7FF"), 12, Theme.TextBody);
            if (done) SmallButton(card, "보고", () => TurnIn(q), ButtonKind.Primary);
            else if (active) SmallButton(card, "포기", () => Abandon(q), ButtonKind.Ghost);
            else
            {
                var take = SmallButton(card, "수락", () => Accept(q), ButtonKind.Outline);
                UI.SetEnabled(take, GuildSystem.CannotAcceptReason(S.Data.Guild, C, q) == null);
            }
        }

        /// <summary>좌우가 좁은 버튼 (퀘스트 카드의 수락·보고).</summary>
        private static RectTransform SmallButton(Transform parent, string label, System.Action onClick, ButtonKind kind)
        {
            UI.Colors(kind, out var fill, out var border, out var text);
            var b = UI.ButtonCard(parent, onClick, fill, border, 8, UI.Pad(4, 0), false, 0, 36, TextAnchor.MiddleCenter);
            UI.Size(b, width: 48, height: 36);
            UI.Label(b, label, 13, text, true, TextAnchor.MiddleCenter, false, false);
            return b;
        }

        /// <summary>퀘스트를 누르면 자세한 내용 (목표·보상·진행·수락/보고/포기).</summary>
        private void QuestDetail(Quest q, bool active)
        {
            var body = Overlay.Modal(q.Title);
            var modal = Overlay.Top;
            var head = UI.Row(body, 8);
            UI.Icon(head, UI.RankIcon(q.Rank), 36);
            var hl = UI.Label(head, q.Rank + " 등급 의뢰 · 목표 " + q.TargetFloor + "층", 14, Theme.Text, true);
            UI.Size(hl, flexW: 1);
            UI.Label(body, "보수 " + UI.Color(q.RewardGold.ToString("#,0") + "G", Theme.GoldHex) + " · 경험치 " + q.RewardExp.ToString("#,0"), 14, Theme.Text);
            UI.Sub(body, "등급은 목표 층과 토벌 난이도(보스 > 토벌 > 채집)로 정해지고, 보수는 그 등급 범위에서 정해집니다.");
            UI.Label(body, active ? GuildSystem.ProgressText(q, C) : "목표 " + GuildSystem.GoalText(q), 14, Theme.TextBody);
            if (active)
            {
                var row = UI.Row(body, 8);
                var quit = UI.TextButton(row, "포기", () =>
                {
                    Overlay.Close(modal);
                    Abandon(q);
                }, ButtonKind.Ghost);
                UI.Size(quit, width: 0, flexW: 1);
                var report = UI.TextButton(row, "보고", () =>
                {
                    Overlay.Close(modal);
                    TurnIn(q);
                }, ButtonKind.Primary);
                UI.Size(report, width: 0, flexW: 1);
                UI.SetEnabled(report, GuildSystem.IsComplete(q, C));
                return;
            }
            string reason = GuildSystem.CannotAcceptReason(S.Data.Guild, C, q);
            if (reason != null) UI.Label(body, reason, 13, Theme.RedLight);
            var accept = UI.TextButton(body, "수락", () =>
            {
                Overlay.Close(modal);
                Accept(q);
            }, ButtonKind.Primary);
            UI.SetEnabled(accept, reason == null);
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
            var head = UI.Row(card, 10);
            UI.Icon(head, UI.RankIcon(C.Rank), 48);
            var hc = UI.Column(head, 2);
            UI.Size(hc, flexW: 1);
            UI.Label(hc, C.Rank + " 등급 배지", 17, Theme.Text, true);
            UI.Label(hc, "기본 능력치 +" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(C.Rank) * 100) + "% · 스킬 " + RankSystem.SkillSlots(C.Rank) + "칸 · 창고 " + RankSystem.StorageCapacity(C.Rank) + "칸", 13, Theme.Gold);

            if (!st.IsMaxRank)
            {
                UI.Divider(card);
                var nextRow = UI.Row(card, 8);
                UI.Icon(nextRow, UI.RankIcon(st.Next), 24);
                UI.Label(nextRow, st.Next + " 등급 승급 조건 (배지 +" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(st.Next) * 100) + "%)", 14, Theme.Text, true);
                Condition(card, "돌파 층", st.FloorCurrent, st.FloorRequired, st.FloorMet);
                Condition(card, "레벨", st.LevelCurrent, st.LevelRequired, st.LevelMet);
                Condition(card, "퀘스트 완료", st.QuestsCurrent, st.QuestsRequired, st.QuestsMet);
                UI.Sub(card, "세 조건을 모두 채우면 자동으로 승급합니다.");
            }
            else UI.Label(card, "최고 등급에 도달했습니다.", 14, Theme.Gold);

            // 등급표: 배지 · 조건 · 보너스 (글자 크게, 줄 간격 넉넉히)
            var table = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 14, 10, 6), true, 0);
            UI.Label(table, "모험가 등급표", 16, Theme.Text, true);
            UI.Spacer(table, 0, 6);
            for (int r = 0; r <= (int)Rank.SS; r++)
            {
                var rank = (Rank)r;
                bool cur = C.Rank == rank;
                var row = UI.Row(table, 12, UI.Pad(4, 4, 8, 8));
                UI.Size(row, minH: 60);
                UI.Icon(row, UI.RankIcon(rank), 40);
                var col = UI.Column(row, 3);
                UI.Size(col, flexW: 1);
                UI.Label(col, rank + " 등급" + (cur ? UI.Color("  현재", Theme.GoldHex) : ""), 16, cur ? Theme.Gold : Theme.Text, true);
                string req = r == 0 ? "시작 등급" : "돌파 " + GameBalance.PromotionRequirements[r, 0] + "층 · Lv." + GameBalance.PromotionRequirements[r, 1] + " · 퀘스트 " + GameBalance.PromotionRequirements[r, 2];
                UI.Label(col, req, 13, Theme.TextSub);
                UI.Label(row, "+" + Mathf.RoundToInt((float)GameBalance.BadgeBonus[r] * 100) + "%", 16, cur ? Theme.Gold : Theme.TextBody, true, TextAnchor.MiddleRight, false, false);
                if (r < (int)Rank.SS) ScreenKit.BottomLine(row, Theme.LineSoft);
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

        // ── 창고: 보관(가방 → 창고, 수수료) / 출고(창고 → 가방, 무료) ──

        private void StorageTab(Transform body)
        {
            var box = UI.Column(body, 8);
            Anchors.Set("guild.storage", box);
            var seg = UI.Row(box, 8);
            for (int i = 0; i < 2; i++)
            {
                int idx = i;
                var b = UI.TextButton(seg, i == 0 ? "보관" : "출고", () =>
                {
                    _withdraw = idx == 1;
                    Rebuild();
                }, (idx == 1) == _withdraw ? ButtonKind.Primary : ButtonKind.Ghost, 40, 14);
                UI.Size(b, width: 0, flexW: 1);
            }
            int fee = _withdraw ? 0 : GuildSystem.StorageFee(C);
            ItemGrid.Legend(box);
            UI.Label(box, "창고 " + C.Storage.UsedCells + " / " + C.Storage.Capacity + " · 가방 " + C.Inventory.UsedCells + " / " + C.Inventory.Capacity, 14, Theme.Text, true);
            var from = _withdraw ? C.Storage : C.Inventory;
            string verb = _withdraw ? "찾기" : "맡기기 · " + fee + "G";
            ItemGrid.Build(box, from, null, item => Overlay.Confirm(item.DisplayName, item.StatLine(), verb, () =>
            {
                string err;
                bool ok = _withdraw ? GuildSystem.Withdraw(C, item.Uid, out err) : GuildSystem.Deposit(C, item.Uid, out err);
                if (!ok)
                {
                    Toast(err);
                    return;
                }
                S.Save();
                Toast(item.DisplayName + (_withdraw ? " 찾음" : " 맡김 · 수수료 " + fee + "G"));
                Rebuild();
            }, "닫기"), false);
        }
    }
}

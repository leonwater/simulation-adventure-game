using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    public enum ResultKind
    {
        Death,
        Hardcore,
        Return,
        Clear
    }

    /// <summary>정산: 패배(이전·현재·변화 표), 귀환(획득, N층 클리어), 하드코어 초기화, 던전 정복 엔딩.</summary>
    public class ResultScreen : ScreenBase
    {
        private readonly ResultKind _kind;

        public ResultScreen(ResultKind kind)
        {
            _kind = kind;
        }

        public override bool OnBack()
        {
            Next();
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            var body = UI.Scroll(page, out _, 18, UI.Pad(16, 16, 48, 24));
            switch (_kind)
            {
                case ResultKind.Death: Death(body); break;
                case ResultKind.Hardcore: Hardcore(body); break;
                case ResultKind.Clear: Clear(body); break;
                default: Return(body); break;
            }
            UI.Spacer(body, 1, 12);
            string label = _kind == ResultKind.Hardcore ? "처음으로" : "마을로 돌아가기";
            var next = UI.TextButton(body, label, Next, ButtonKind.Primary, 52, 16);
            Anchors.Set("result.next", next);
            Tutorial.OnResult();
        }

        private static void Heading(Transform parent, string title, Color color, string sub)
        {
            var head = UI.Column(parent, 6, null, TextAnchor.UpperCenter);
            UI.Label(head, title, 32, color, false, TextAnchor.MiddleCenter, true);
            UI.Label(head, sub, 14, Theme.TextSub, false, TextAnchor.MiddleCenter);
        }

        /// <summary>"고블린 궁수에게 패배" / "독으로 쓰러짐"</summary>
        private static string Cause(string killedBy)
        {
            if (string.IsNullOrEmpty(killedBy)) return "쓰러짐";
            if (killedBy == "독" || killedBy == "화상" || killedBy == "출혈") return Names.Josa(killedBy, "으로/로") + " 쓰러짐";
            return killedBy + "에게 패배";
        }

        private static RectTransform Panel(Transform parent, string title, Color titleColor, Color fill, Color border)
        {
            var card = UI.Card(parent, fill, border, 12, UI.Pad(14, 14, 6, 6), true, 0);
            var t = UI.Label(card, title, 13, titleColor, true);
            UI.Size(t, height: 32);
            return card;
        }

        private static void Row(Transform parent, string label, string value, bool last = false)
        {
            var row = UI.Row(parent, 8);
            UI.Size(row, minH: 44);
            var l = UI.Label(row, label, 14, Theme.Text);
            UI.Size(l, flexW: 1);
            UI.Label(row, value, 14, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            if (!last) ScreenKit.BottomLine(row, Theme.LineSoft);
        }

        /// <summary>패배: 항목 · 이전 · 현재 · 변화를 한 표로 (수정 사항 #12).</summary>
        private void Death(Transform body)
        {
            var d = S.LastDeath;
            if (d == null)
            {
                Heading(body, "패배", Theme.RedLight, "");
                return;
            }
            Heading(body, "패배", Theme.RedLight, d.Floor + "층 · " + Cause(d.KilledBy));
            var table = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(12, 12, 6, 6), true, 0);
            Anchors.Set("result.panel", table);
            TableRow(table, "항목", "이전", "현재", "변화", true);
            TableRow(table, "골드", d.GoldBefore.ToString("#,0"), d.GoldAfter.ToString("#,0"), Change(-d.GoldLost));
            int expBefore = Mathf.FloorToInt((float)d.ExpPctBefore * 100), expAfter = Mathf.FloorToInt((float)d.ExpPctAfter * 100);
            TableRow(table, "경험치", expBefore + "%", expAfter + "%", Change(expAfter - expBefore, "%p"));
            TableRow(table, "가방 아이템", d.BagBefore + "개", d.BagAfter + "개", Change(d.BagAfter - d.BagBefore, "개"));
            TableRow(table, d.Floor + "층 진행", d.RoomsExplored + "/" + d.RoomsTotal + "방", "초기화", UI.Color("초기화", Theme.RedHex));
            TableRow(table, "장착 장비", d.EquippedKept + "개", d.EquippedKept + "개", UI.Color("유지", Theme.GreenHex));
            TableRow(table, "길드 창고", d.StorageCount + "개", d.StorageCount + "개", UI.Color("유지", Theme.GreenHex), false, true);
            if (d.ItemsLost.Count > 0) UI.Sub(body, "잃은 아이템: " + LootSystem.Names(d.ItemsLost, 6));
            UI.Sub(body, "레벨·도달 층(돌파 " + C.HighestFloorCleared + "층)·가방 확장은 그대로입니다.");
        }

        private static string Change(long delta, string unit = "")
        {
            if (delta == 0) return UI.Color("−", Theme.SubHex);
            return delta > 0 ? UI.Color("+" + delta.ToString("#,0") + unit, Theme.GreenHex) : UI.Color("−" + (-delta).ToString("#,0") + unit, Theme.RedHex);
        }

        private static void TableRow(Transform parent, string a, string b, string c, string d, bool head = false, bool last = false)
        {
            var row = UI.Row(parent, 6);
            UI.Size(row, minH: head ? 34 : 42);
            Color color = head ? Theme.TextSub : Theme.Text;
            float size = head ? 12 : 13;
            var la = UI.Label(row, a, size, color, head);
            UI.Size(la, width: 86);
            foreach (var v in new[] { b, c, d })
            {
                var l = UI.Label(row, v, size, color, head, TextAnchor.MiddleRight);
                UI.Size(l, width: 76);
            }
            if (!last) ScreenKit.BottomLine(row, head ? Theme.Line : Theme.LineSoft);
        }

        private void Hardcore(Transform body)
        {
            var d = S.LastDeath;
            Heading(body, "모험이 끝났다", Theme.RedLight, (d?.Floor ?? 0) + "층 · " + Cause(d?.KilledBy));
            var card = Panel(body, "하드코어", Theme.RedLight, Theme.RedBg, Theme.RedBorder);
            UI.Label(card, "하드코어 난이도에서는 쓰러지면 캐릭터가 초기화됩니다. 새로운 모험가로 다시 도전하세요.", 14, Theme.Text);
            UI.Spacer(card, 0, 8);
        }

        private void Return(Transform body)
        {
            var r = S.LastReturn;
            if (r == null)
            {
                Heading(body, "귀환", Theme.BlueLight, "");
                return;
            }
            // 보스를 잡았으면 "N층 클리어", 아니면 "N층 귀환" (수정 사항 #6)
            Heading(body, r.Floor + "층 " + (r.BossCleared ? "클리어" : "귀환"), r.BossCleared ? Theme.Gold : Theme.BlueLight, "탐험한 방 " + r.Rooms + "개");
            var got = Panel(body, "획득", Theme.Gold, Theme.Card, Theme.CardBorder);
            Anchors.Set("result.panel", got);
            Row(got, "골드", "+" + r.GoldEarned.ToString("#,0") + " G");
            Row(got, "경험치", "+" + r.ExpEarned.ToString("#,0"));
            var items = UI.Column(got, 4, UI.Pad(0, 0, 8, 8));
            UI.Label(items, "아이템 " + r.Loot.Count + "개", 14, Theme.Text);
            if (r.Loot.Count > 0)
            {
                string names = string.Join(", ", r.Loot.GetRange(0, Mathf.Min(6, r.Loot.Count)));
                if (r.Loot.Count > 6) names += " 외 " + (r.Loot.Count - 6) + "개";
                UI.Sub(items, names);
            }
            var state = Panel(body, "진행", Theme.BlueLight, Theme.Card, Theme.CardBorder);
            Row(state, r.Floor + "층 보스", r.BossCleared ? "처치" : "미처치 · 진행 초기화");
            Row(state, "다음 도전", C.MaxChallengeFloor + "층", true);
            int done = S.Data.Guild.Active.FindAll(q => GuildSystem.IsComplete(q, C)).Count;
            if (done > 0) UI.Label(body, "완료한 퀘스트 " + done + "개 — 길드에 보고하세요", 14, Theme.Gold, false, TextAnchor.MiddleCenter);
        }

        private void Clear(Transform body)
        {
            Heading(body, "던전 정복", Theme.Gold, GameBalance.MaxFloor + "층 · 드래곤 처치");
            var card = Panel(body, "기록", Theme.Gold, Theme.AccentBg, Theme.Accent);
            UI.Label(card, Names.Josa(C.Name, "은/는") + " 마침내 던전 최하층의 주인을 쓰러뜨렸다. 라브 마을의 사람들은 오래도록 그 이름을 이야기할 것이다.", 15, Theme.Text);
            UI.Spacer(card, 0, 6);
            var job = UI.Row(card, 8);
            UI.Size(job, minH: 44);
            UI.Size(UI.Label(job, "직업 · 레벨", 14, Theme.Text), flexW: 1);
            ScreenKit.JobLine(job, C.Job, C.JobData.Name + " Lv." + C.Level, 14, Theme.Text);
            ScreenKit.BottomLine(job, Theme.LineSoft);
            Row(card, "모험가 등급", C.Rank + " 등급");
            Row(card, "완료한 퀘스트", C.QuestsCompleted + "개");
            long sec = S.Data.PlaySeconds;
            Row(card, "플레이 시간", (sec / 3600) + "시간 " + (sec / 60 % 60) + "분", true);
            UI.Sub(body, "계속 플레이하며 장비와 등급을 더 키울 수 있습니다.");
        }

        private void Next()
        {
            if (_kind == ResultKind.Hardcore || !S.HasGame)
            {
                Go(new TitleScreen());
                return;
            }
            if (S.InDungeon)
            {
                // 엔딩 화면은 던전 안(보스 방)에서 열린다
                App.GoToCurrent();
                return;
            }
            Go(new TownScreen());
        }
    }
}

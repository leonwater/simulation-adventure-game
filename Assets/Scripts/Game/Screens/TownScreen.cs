using System;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>마을: 상태 머리줄, 마을 전경, 시설 4개, 도전 층 선택, 던전 입장, 하단 메뉴.</summary>
    public class TownScreen : ScreenBase
    {
        private Text _shopTimer;

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            ScreenKit.TownHeader(page, C);

            var body = UI.Scroll(page, out _, 16, UI.Pad(16, 16), "town");
            UI.Illustration(body, "마을 전경", 150, 12);

            var title = UI.Row(body);
            var name = UI.Label(title, "등불 마을", 22, Theme.Text, false, TextAnchor.MiddleLeft, true);
            UI.Size(name, flexW: 1);
            UI.Sub(title, "돌파 " + C.HighestFloorCleared + "층 · " + Names.Of(S.Difficulty), TextAnchor.MiddleRight);

            if (C.UnspentPoints > 0)
            {
                var notice = UI.ButtonCard(body, () => Go(new CharacterScreen()), Theme.AccentBg, Theme.Accent, 10, UI.Pad(14, 8), false, 8, 44);
                var nl = UI.Label(notice, "남은 능력치 포인트 " + C.UnspentPoints + " — 캐릭터 화면에서 배분하세요", 13, Theme.Gold);
                UI.Size(nl, flexW: 1);
            }
            if (RankSystem.GetStatus(C).CanPromote)
            {
                var notice = UI.ButtonCard(body, () => Go(new GuildScreen(1)), Theme.AccentBg, Theme.Accent, 10, UI.Pad(14, 8), false, 8, 44);
                var nl = UI.Label(notice, RankSystem.GetStatus(C).Next + " 등급 승급 조건을 채웠습니다 — 길드에서 승급하세요", 13, Theme.Gold);
                UI.Size(nl, flexW: 1);
            }

            var list = UI.Column(body, 8);
            int done = S.Data.Guild.Active.FindAll(q => GuildSystem.IsComplete(q, C)).Count;
            string guildSub = "퀘스트 " + S.Data.Guild.Active.Count + "/" + GameBalance.MaxActiveQuests + " 수주 중" + (done > 0 ? " · " + done + "개 완료" : "") + " · 창고";
            Facility(list, "길드", guildSub, () => Go(new GuildScreen()));
            _shopTimer = Facility(list, "상점", ShopSub(), () => Go(new ShopScreen()));
            Facility(list, "대장간", "장비 강화", () => Go(new BlacksmithScreen()));
            Facility(list, "수련장", "보유 스킬 강화", () => Go(new TrainingScreen()));

            UI.Spacer(body, 1, 8);
            FloorSelector(body);

            ScreenKit.BottomNav(page, 0);

            var ticker = root.gameObject.AddComponent<Ticker>();
            ticker.Interval = 1f;
            ticker.OnTick = () =>
            {
                if (S.TickShop()) Toast("상점 물건이 바뀌었습니다");
                if (_shopTimer != null) _shopTimer.text = ShopSub();
            };
        }

        private string ShopSub()
        {
            var left = S.ShopTimeLeft;
            return "자동 갱신까지 " + ((int)left.TotalMinutes).ToString("00") + ":" + left.Seconds.ToString("00");
        }

        private static Text Facility(Transform parent, string title, string sub, Action onClick)
        {
            var card = UI.ButtonCard(parent, onClick, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 10), false, 10, 64);
            var col = UI.Column(card, 2);
            UI.Size(col, flexW: 1);
            UI.Label(col, title, 16, Theme.Text, true);
            var s = UI.Sub(col, sub);
            UI.Label(card, "›", 18, Theme.TextSub, false, TextAnchor.MiddleRight, false, false);
            return s;
        }

        private void FloorSelector(Transform parent)
        {
            int floor = S.Data.SelectedFloor;
            int max = C.MaxChallengeFloor;
            if (max > 1)
            {
                var row = UI.Row(parent, 8, null, TextAnchor.MiddleCenter);
                var minus = UI.TextButton(row, "‹", () => Change(-1), ButtonKind.Ghost, 44, 18, 56);
                UI.SetEnabled(minus, floor > 1);
                var mid = UI.Column(row, 0, null, TextAnchor.MiddleCenter);
                UI.Size(mid, flexW: 1);
                UI.Label(mid, "도전 층 " + floor + " / " + max, 14, Theme.Text, true, TextAnchor.MiddleCenter);
                UI.Sub(mid, floor < max ? "낮은 층은 퀘스트·파밍용" : "가장 깊은 도전 층", TextAnchor.MiddleCenter);
                var plus = UI.TextButton(row, "›", () => Change(1), ButtonKind.Ghost, 44, 18, 56);
                UI.SetEnabled(plus, floor < max);
            }

            var go = UI.ButtonCard(parent, EnterDungeon, Theme.Accent, Theme.Accent, 12, UI.Pad(14, 8), true, 2, 64, TextAnchor.MiddleCenter);
            UI.Label(go, "던전 입장", 17, Theme.OnAccent, true, TextAnchor.MiddleCenter);
            UI.Label(go, floor + "층 도전 · " + MonsterDb.ThemeFor(floor).Name, 12, Theme.OnAccent, false, TextAnchor.MiddleCenter);
        }

        private void Change(int delta)
        {
            S.SelectFloor(S.Data.SelectedFloor + delta);
            Rebuild();
        }

        private void EnterDungeon()
        {
            if (C.Inventory.FreeCells == 0) Toast("가방이 가득 차 있어 전리품을 주울 수 없습니다");
            S.EnterDungeon();
            Go(new DungeonScreen());
        }
    }
}

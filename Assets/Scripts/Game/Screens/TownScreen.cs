using System;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>마을: 상태 머리줄, 마을 전경, 시설 4개, 도전 층 선택, 던전 입장, 하단 메뉴.</summary>
    public class TownScreen : ScreenBase
    {
        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            ScreenKit.TownHeader(page, C);

            var body = UI.Scroll(page, out _, 16, UI.Pad(16, 16), "town");
            UI.Illustration(body, "마을 전경", 200, 12);

            var title = UI.Row(body);
            var name = UI.Label(title, "라브 마을", 22, Theme.Text, false, TextAnchor.MiddleLeft, true);
            UI.Size(name, flexW: 1);
            UI.Label(title, Names.Of(S.Difficulty), 14, Theme.DifficultyColor(S.Difficulty), true, TextAnchor.MiddleRight, false, false);

            if (C.UnspentPoints > 0)
            {
                var notice = UI.ButtonCard(body, () => Go(new CharacterScreen()), Theme.AccentBg, Theme.Accent, 10, UI.Pad(14, 8), false, 8, 44);
                var nl = UI.Label(notice, "남은 능력치 포인트 " + C.UnspentPoints + " — 캐릭터 화면에서 배분하세요", 13, Theme.Gold);
                UI.Size(nl, flexW: 1);
            }
            // 보스를 잡고 돌아오면 다음 층 의뢰가 게시판에 붙는다
            int next = C.MaxChallengeFloor;
            if (S.LastReturn != null && S.LastReturn.BossCleared && S.Data.Guild.Board.Exists(q => q.TargetFloor == next))
            {
                var notice = UI.ButtonCard(body, () => Go(new GuildScreen()), Theme.AccentBg, Theme.Accent, 10, UI.Pad(14, 8), false, 8, 44);
                var nl = UI.Label(notice, S.LastReturn.Floor + "층 돌파! 길드에 " + next + "층 의뢰가 새로 붙었습니다", 13, Theme.Gold);
                UI.Size(nl, flexW: 1);
            }

            // 시설 2×2 카드 (아이콘 · 이름 · 알림 점)
            var grid = UI.Grid(body, 2, ScreenKit.ContentWidth, 112, 10);
            Facility(grid, "guild", "길드", Alerts.Guild, () => Go(new GuildScreen()));
            Facility(grid, "shop", "상점", Alerts.Shop, () => Go(new ShopScreen()));
            Facility(grid, "blacksmith", "대장간", false, () => Go(new BlacksmithScreen()));
            Facility(grid, "training", "수련장", false, () => Go(new TrainingScreen()));

            UI.Spacer(body, 1, 8);
            FloorSelector(body);

            ScreenKit.BottomNav(page, 0);
            Tutorial.OnTown();

            var ticker = root.gameObject.AddComponent<Ticker>();
            ticker.Interval = 1f;
            ticker.OnTick = () =>
            {
                if (S.TickShop()) Rebuild(); // 상점 물건이 바뀌면 알림 점을 다시 그린다
            };
        }

        private static void Facility(Transform grid, string icon, string title, bool alert, Action onClick)
        {
            var card = UI.ButtonCard(grid, onClick, Theme.Card, Theme.CardBorder, 12, UI.Pad(10, 12), true, 6, 112, TextAnchor.MiddleCenter);
            Anchors.Set("town." + icon, card);
            var tex = Resources.Load<Texture2D>("Icons/" + icon);
            if (tex != null)
            {
                var row = UI.Row(card, 0, null, TextAnchor.MiddleCenter, "icon-row");
                var holder = UI.Rect(row, "icon");
                UI.Size(holder, height: 48, width: 48);
                var raw = holder.gameObject.AddComponent<RawImage>();
                raw.texture = tex;
                raw.raycastTarget = false;
            }
            UI.Label(card, title, 16, Theme.Text, true, TextAnchor.MiddleCenter);
            if (alert) UI.Dot(card, 12, 10);
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
                UI.Label(mid, "도전 층 " + floor + " / " + max, 15, Theme.Text, true, TextAnchor.MiddleCenter);
                var plus = UI.TextButton(row, "›", () => Change(1), ButtonKind.Ghost, 44, 18, 56);
                UI.SetEnabled(plus, floor < max);
            }

            var go = UI.ButtonCard(parent, EnterDungeon, Theme.Accent, Theme.Accent, 12, UI.Pad(14, 8), true, 2, 64, TextAnchor.MiddleCenter);
            Anchors.Set("town.dungeon", go);
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

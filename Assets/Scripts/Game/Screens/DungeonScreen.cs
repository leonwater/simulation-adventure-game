using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>던전 탐험: 층·HP, 도형 미니맵(현재 위치·깜빡이는 다음 방), 상황 텍스트, 경로 선택, 텔레포트·가방·귀환.</summary>
    public class DungeonScreen : ScreenBase
    {
        private const float MapW = 334, MapH = 204, Node = 36;

        public override bool OnBack()
        {
            Pause();
            return true;
        }

        public override void Build(RectTransform root)
        {
            var run = S.Run;
            if (run == null)
            {
                App.GoToCurrent();
                return;
            }
            var page = ScreenKit.Page(root);
            var theme = MonsterDb.ThemeFor(run.Floor);
            ScreenKit.DungeonHeader(page, run.Floor + "층 · " + theme.Name, "탐험한 방 " + run.RoomsExplored, C, Pause);

            var body = UI.Scroll(page, out _, 12, UI.Pad(16, 16, 14, 16));
            MiniMap(body, run);

            string text = DungeonSystem.Situation(run, out string title);
            var box = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 12), true, 6);
            UI.Label(box, title, 12, Theme.Gold);
            UI.Label(box, text, 15, Theme.Text);
            if (!string.IsNullOrEmpty(S.Notice)) UI.Label(box, S.Notice, 13, Theme.BlueLight);

            var choices = UI.Column(body, 8);
            Choices(choices, run);

            UI.Spacer(body, 1, 4);
            var bottom = UI.Row(body, 8);
            bottom.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth = true;
            var targets = DungeonSystem.TeleportTargets(run);
            var tp = UI.TextButton(bottom, "텔레포트", () => TeleportMenu(targets), ButtonKind.Secondary, 48, 14);
            UI.Size(tp, flexW: 1);
            UI.SetEnabled(tp, targets.Count > 0 && DungeonSystem.CanLeave(run));
            var bag = UI.TextButton(bottom, "가방", () => Go(new InventoryScreen(true)), ButtonKind.Secondary, 48, 14);
            UI.Size(bag, flexW: 1);
            bool canReturn = S.CanReturn;
            var ret = UI.TextButton(bottom, canReturn ? "귀환" : "귀환 방 미발견", ConfirmReturn, ButtonKind.Secondary, 48, 13);
            UI.Size(ret, flexW: 1);
            UI.SetEnabled(ret, canReturn);
        }

        private void Choices(Transform parent, DungeonRun run)
        {
            var room = run.Current;
            if (room.Type == RoomType.Boss && run.BossDefeated)
            {
                if (S.CanDescend)
                    ScreenKit.GoButton(parent, "아래층으로 내려간다", (run.Floor + 1) + "층 · " + MonsterDb.ThemeFor(run.Floor + 1).Name + " · 현재 HP 유지", Descend);
                ScreenKit.GoButton(parent, "마을로 귀환한다", run.Floor >= GameBalance.MaxFloor ? "던전을 정복했다" : (run.Floor + 1) + "층이 열렸다 · 얻은 것은 모두 유지", ReturnNow);
            }
            if (room.Type == RoomType.Merchant) ScreenKit.GoButton(parent, "상인과 거래한다", "물약·해독제 (마을보다 20% 비쌈)", Merchant);
            if (room.Type == RoomType.Return) ScreenKit.GoButton(parent, "마법진으로 마을에 돌아간다", "이번 층 진행은 초기화 · 얻은 것은 유지", ConfirmReturn);

            foreach (var opt in DungeonSystem.MoveOptions(run, S.Difficulty))
            {
                var o = opt;
                ScreenKit.GoButton(parent, o.Direction, o.Hint, () => Move(o.Room.Id));
            }
        }

        // ── 미니맵 ──

        private static List<Room> Discovered(DungeonRun run)
        {
            var set = new HashSet<int>();
            foreach (var r in run.Map.Rooms)
            {
                if (!r.Visited) continue;
                set.Add(r.Id);
                foreach (int l in r.Links) set.Add(l);
            }
            var list = new List<Room>();
            foreach (int id in set) list.Add(run.Map.Get(id));
            return list;
        }

        private void MiniMap(Transform parent, DungeonRun run)
        {
            var card = UI.Card(parent, Theme.MapBg, Theme.CardBorder, 12, UI.Pad(12, 12), true, 8);
            var area = UI.Rect(card, "map");
            UI.Size(area, height: MapH, width: MapW);

            var rooms = Discovered(run);
            int minX = int.MaxValue, maxX = int.MinValue, minY = int.MaxValue, maxY = int.MinValue;
            foreach (var r in rooms)
            {
                minX = Mathf.Min(minX, r.X);
                maxX = Mathf.Max(maxX, r.X);
                minY = Mathf.Min(minY, r.Y);
                maxY = Mathf.Max(maxY, r.Y);
            }
            int cols = maxX - minX, rows = maxY - minY;
            // 방이 많아 칸이 좁아지면 방 크기를 줄인다.
            float cell = Mathf.Min(72f, Mathf.Min(cols > 0 ? MapW / (cols + 1) : MapW, rows > 0 ? MapH / (rows + 1) : MapH));
            float node = Mathf.Clamp(cell * 0.62f, 14f, Node);
            float sx = cols == 0 ? 0 : Mathf.Min(72, (MapW - node) / cols);
            float sy = rows == 0 ? 0 : Mathf.Min(64, (MapH - node) / rows);
            float ox = (MapW - cols * sx - node) / 2f, oy = (MapH - rows * sy - node) / 2f;

            Vector2 Pos(Room r) => new Vector2(ox + (r.X - minX) * sx, oy + (r.Y - minY) * sy);

            var cur = run.Current;
            var shown = new HashSet<int>();
            foreach (var r in rooms) shown.Add(r.Id);

            // 연결선
            foreach (var r in rooms)
            {
                foreach (int l in r.Links)
                {
                    if (l < r.Id || !shown.Contains(l)) continue;
                    var o = run.Map.Get(l);
                    if (!r.Visited && !o.Visited) continue;
                    bool next = (r.Id == cur.Id && !o.Visited) || (o.Id == cur.Id && !r.Visited);
                    Edge(area, Pos(r), Pos(o), node, next && DungeonSystem.CanLeave(run));
                }
            }
            // 방
            bool easy = S.Difficulty == Difficulty.Easy;
            foreach (var r in rooms)
            {
                bool isCur = r.Id == cur.Id;
                bool next = !r.Visited && cur.Links.Contains(r.Id) && DungeonSystem.CanLeave(run);
                string label = r.Visited || easy ? Names.ShortOf(r.Type) : "?";
                Color fill = isCur ? Theme.Accent : r.Visited ? Theme.MapNode : Theme.MapBg;
                Color border = isCur ? Theme.Accent : next ? Theme.Gold : r.Visited ? Theme.MapLine : Theme.PlaceholderLine;
                var n = UI.Card(area, fill, border, 6, UI.Pad(0), true, 0, TextAnchor.MiddleCenter, "room");
                Place(n, Pos(r), new Vector2(node, node));
                var t = UI.Label(n, label, node < 22 ? 9 : node < 28 ? 11 : 13, isCur ? Theme.OnAccent : next ? Theme.Gold : r.Visited ? Theme.Text : Theme.TextSub, isCur, TextAnchor.MiddleCenter);
                if (next)
                {
                    var inner = n.Find("fill");
                    if (inner != null) UI.Stretch((RectTransform)inner, 2, 2, 2, 2);
                    n.gameObject.AddComponent<Blink>();
                }
            }

            var legend = UI.Row(card, 14);
            UI.Sub(legend, "■ 탐험함");
            UI.Label(legend, "■ 현재 위치", 12, Theme.Gold);
            UI.Label(legend, "□ 갈 수 있음", 12, Theme.Gold);
            if (easy) UI.Sub(legend, "쉬움: 방 종류 표시");
        }

        private static void Place(RectTransform rt, Vector2 topLeft, Vector2 size)
        {
            rt.anchorMin = new Vector2(0, 1);
            rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0, 1);
            rt.sizeDelta = size;
            rt.anchoredPosition = new Vector2(topLeft.x, -topLeft.y);
        }

        private static void Edge(RectTransform area, Vector2 a, Vector2 b, float node, bool next)
        {
            var img = UI.Image(area, next ? Theme.Gold : Theme.MapLine, 0, "edge");
            float half = node / 2f;
            Vector2 ca = a + new Vector2(half, half), cb = b + new Vector2(half, half);
            Vector2 min = Vector2.Min(ca, cb), max = Vector2.Max(ca, cb);
            bool horizontal = Mathf.Abs(ca.y - cb.y) < 0.5f;
            var size = horizontal ? new Vector2(max.x - min.x, 2) : new Vector2(2, max.y - min.y);
            var topLeft = horizontal ? new Vector2(min.x, min.y - 1) : new Vector2(min.x - 1, min.y);
            Place(img.rectTransform, topLeft, size);
            if (next) img.gameObject.AddComponent<Blink>();
        }

        // ── 행동 ──

        private void Move(int roomId)
        {
            var result = S.Move(roomId);
            switch (result)
            {
                case RoomEnterResult.Battle:
                case RoomEnterResult.Boss:
                    Go(new BattleScreen());
                    break;
                case RoomEnterResult.Event:
                    Go(new EventScreen());
                    break;
                case RoomEnterResult.Merchant:
                    Rebuild();
                    Merchant();
                    break;
                default:
                    if (S.LastLoot != null && S.LastLoot.LevelsGained > 0) Toast("레벨 업! Lv." + C.Level);
                    Rebuild();
                    break;
            }
        }

        private void TeleportMenu(List<Room> targets)
        {
            var body = Overlay.Modal("텔레포트", true);
            var modal = Overlay.Top;
            UI.Sub(body, "탐험을 마친 방으로 비용 없이 이동합니다.");
            var dist = S.Run.Map.Distances(S.Run.CurrentRoomId);
            targets.Sort((a, b) => dist[a.Id].CompareTo(dist[b.Id]));
            foreach (var r in targets)
            {
                var room = r;
                int unexplored = r.Links.FindAll(l => !S.Run.Map.Get(l).Visited).Count;
                string sub = "현재 위치에서 " + dist[r.Id] + "칸" + (unexplored > 0 ? " · 안 가 본 길 " + unexplored + "개" : "");
                ScreenKit.ChoiceButton(body, Names.Of(r.Type) + " 방", sub, "", false, () =>
                {
                    Overlay.Close(modal);
                    S.Teleport(room.Id);
                    Rebuild();
                }, true, 56);
            }
        }

        private void Merchant()
        {
            var body = Overlay.Modal("떠돌이 상인", true);
            UI.Sub(body, "보유 골드 " + Names.Gold(C.Gold) + " · 가방 " + C.Inventory.UsedCells + "/" + C.Inventory.Capacity);
            foreach (var g in S.Run.Current.MerchantGoods)
            {
                var good = g;
                int price = S.MerchantPrice(g.Item);
                ScreenKit.ChoiceButton(body, g.Item.Name, ItemDb.Consumable(g.Item.TemplateId)?.Description + " · 보유 " + C.Inventory.CountOf(g.Item.TemplateId),
                    price + "G", true, () =>
                    {
                        if (!S.BuyFromMerchant(good.Item.Uid, 1, out string err))
                        {
                            Toast(err);
                            return;
                        }
                        Toast(good.Item.Name + " 구매 · 남은 골드 " + Names.Gold(C.Gold));
                    }, C.Gold >= price, 56);
            }
        }

        private void ConfirmReturn()
        {
            var run = S.Run;
            string msg = run.BossDefeated
                ? "마을로 돌아갑니다. " + (run.Floor + 1) + "층이 열려 있습니다."
                : "귀환 마법진으로 마을에 돌아갑니다. 이번 층 진행은 초기화되지만 얻은 골드·경험치·아이템은 유지됩니다.";
            Overlay.Confirm("마을로 귀환", msg, "귀환", ReturnNow);
        }

        private void ReturnNow()
        {
            S.ReturnToTown();
            Go(new ResultScreen(ResultKind.Return));
        }

        private void Descend()
        {
            S.Descend();
            Toast(S.Run.Floor + "층에 내려왔다");
            Rebuild();
        }

        private void Pause()
        {
            var body = Overlay.Modal("일시정지");
            var modal = Overlay.Top;
            UI.Sub(body, "진행 상황은 방을 하나 끝낼 때마다 자동으로 저장됩니다.");
            UI.TextButton(body, "계속하기", () => Overlay.Close(modal), ButtonKind.Primary);
            UI.TextButton(body, "캐릭터 정보", () =>
            {
                Overlay.Close(modal);
                ShowCharacter();
            }, ButtonKind.Secondary);
            UI.TextButton(body, "저장하고 타이틀로", () =>
            {
                S.Save();
                Go(new TitleScreen());
            }, ButtonKind.Ghost);
        }

        private void ShowCharacter()
        {
            var body = Overlay.Modal(C.Name + " · " + C.JobData.Name + " Lv." + C.Level);
            UI.Sub(body, "HP " + C.CurrentHp + "/" + CharacterStats.MaxHp(C) + " · 공격력 " + CharacterStats.Attack(C) + " · 방어력 " + CharacterStats.Defense(C));
            UI.Sub(body, "경험치 " + Mathf.FloorToInt((float)Leveling.ExpProgress(C) * 100) + "% · 골드 " + Names.Gold(C.Gold));
            if (C.UnspentPoints > 0) UI.Label(body, "남은 능력치 포인트 " + C.UnspentPoints + " (마을 캐릭터 화면에서 배분)", 13, Theme.Gold);
            var quests = S.Data.Guild.Active;
            if (quests.Count > 0)
            {
                UI.Divider(body);
                UI.Label(body, "수주 중인 퀘스트", 14, Theme.Text, true);
                foreach (var q in quests) UI.Sub(body, q.Title + " · 목표 " + q.TargetFloor + "층 · " + GuildSystem.ProgressText(q, C));
            }
        }
    }
}

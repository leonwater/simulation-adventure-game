using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 던전 탐험: 층·HP, 테마 색 미니맵(누르면 전체 지도 + 순간이동), 상황 텍스트, 경로 선택(새 방 강조 · 탐험한 방 흐리게),
    /// 층 진입 제목, 전투 뒤 레벨 업 배분, 텔레포트·가방·귀환.
    /// </summary>
    public class DungeonScreen : ScreenBase
    {
        private const float MapW = 334, MapH = 204, Node = 36;
        private bool _levelUp;

        public DungeonScreen(bool levelUp = false)
        {
            _levelUp = levelUp;
        }

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
            var tint = UI.Image(root, Theme.DungeonBg(run.Floor), 0, "theme");
            UI.Stretch(tint.rectTransform);
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

            if (run.FloorIntroPending) FloorIntro(root, run);
            else AfterIntro();
        }

        /// <summary>층에 들어오면 1초 정도 큰 제목을 보여 준다 (수정 사항 #18).</summary>
        private void FloorIntro(RectTransform root, DungeonRun run)
        {
            run.FloorIntroPending = false;
            S.Save();
            var holder = UI.Image(root, new Color(0, 0, 0, 0.72f), 0, "floor-intro");
            UI.Stretch(holder.rectTransform);
            var col = UI.Column(holder.transform, 8, null, TextAnchor.MiddleCenter);
            UI.Stretch(col);
            UI.Label(col, run.Floor + "층", 44, Theme.Gold, false, TextAnchor.MiddleCenter, true);
            UI.Label(col, MonsterDb.ThemeFor(run.Floor).Name + (run.IsTutorial ? " · 연습" : ""), 16, Theme.DungeonAccent(run.Floor), false, TextAnchor.MiddleCenter);
            var fade = holder.gameObject.AddComponent<FadeTitle>();
            fade.Life = 1.3f;
            fade.OnDone = AfterIntro;
        }

        private void AfterIntro()
        {
            var run = S.Run;
            if (run == null) return;
            if (_levelUp)
            {
                _levelUp = false;
                if (C.UnspentPoints > 0)
                {
                    LevelUpAllocation(new AllocationDraft(C));
                    Tutorial.OnLevelUp();
                    return;
                }
            }
            Tutorial.OnDungeon(run.Current.Type == RoomType.Return);
        }

        // ── 레벨 업 배분 (수정 사항 #17): 자동 배분 · 확정 · 나중에 ──

        private void LevelUpAllocation(AllocationDraft draft)
        {
            var body = Overlay.Modal("레벨 업! Lv." + C.Level, false, false);
            var modal = Overlay.Top;
            Overlay.SetBack(() => Overlay.Close(modal));
            UI.Label(body, "남은 포인트 " + UI.Color(draft.Remaining.ToString(), Theme.GoldHex), 14, Theme.Text);
            var stats = C.JobData.AllocatableStats;
            foreach (var stat in stats)
            {
                var st = stat;
                var row = UI.Row(body, 8);
                UI.Size(row, height: 46);
                var name = UI.Label(row, Names.Of(st) + " " + UI.Color(CharacterStats.EffectLabel(C, st), Theme.SubHex), 13, Theme.Text);
                UI.Size(name, flexW: 1);
                int pending = draft.Pending(st);
                var minus = UI.TextButton(row, "−", () => Redraw(modal, draft, () => draft.Remove(st)), ButtonKind.Ghost, 40, 18, 44);
                UI.SetEnabled(minus, pending > 0);
                UI.Label(row, CharacterStats.Total(C, st) + (pending > 0 ? UI.Color(" +" + pending, Theme.GoldHex) : ""), 15, Theme.Text, false, TextAnchor.MiddleRight, false, false);
                var plus = UI.TextButton(row, "+", () => Redraw(modal, draft, () => draft.Add(st)), ButtonKind.Outline, 40, 18, 44);
                UI.SetEnabled(plus, draft.Remaining > 0);
            }
            var buttons = UI.Row(body, 8);
            var later = UI.TextButton(buttons, "나중에", () =>
            {
                Overlay.Close(modal);
                Toast("남은 포인트는 마을 캐릭터 화면에서도 배분할 수 있습니다");
            }, ButtonKind.Ghost);
            UI.Size(later, flexW: 1);
            var auto = UI.TextButton(buttons, "자동 배분", () => Redraw(modal, draft, draft.Auto));
            UI.Size(auto, flexW: 1);
            UI.SetEnabled(auto, draft.Remaining > 0);
            var ok = UI.TextButton(buttons, "확정", () =>
            {
                int maxBefore = CharacterStats.MaxHp(C);
                draft.Commit();
                C.CurrentHp = System.Math.Min(CharacterStats.MaxHp(C), C.CurrentHp + System.Math.Max(0, CharacterStats.MaxHp(C) - maxBefore));
                S.Save();
                Overlay.Close(modal);
                Rebuild();
            }, ButtonKind.Primary);
            UI.Size(ok, flexW: 1);
            UI.SetEnabled(ok, draft.HasChanges);
        }

        private void Redraw(GameObject modal, AllocationDraft draft, System.Action change)
        {
            change();
            Overlay.Close(modal);
            LevelUpAllocation(draft);
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
                if (o.Room.Visited) VisitedButton(parent, o.Direction, o.Hint, () => Move(o.Room.Id));
                else NewRoomButton(parent, o.Direction, o.Hint, () => Move(o.Room.Id));
            }
        }

        /// <summary>새 방: 금색 테두리 + 위쪽에서 빛나는 줄 (수정 사항 #10).</summary>
        private static void NewRoomButton(Transform parent, string title, string sub, System.Action onClick)
        {
            var b = ScreenKit.GoButton(parent, title, sub, onClick);
            var glow = UI.Image(b, Theme.Gold, 0, "glow");
            glow.sprite = Sprites.GradientUp;
            glow.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var rt = glow.rectTransform;
            rt.anchorMin = new Vector2(0, 1);
            rt.anchorMax = new Vector2(1, 1);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.localScale = new Vector3(1, -1, 1); // 위가 진하고 아래로 옅어지게
            rt.sizeDelta = new Vector2(-16, 12);
            rt.anchoredPosition = new Vector2(0, -7);
            glow.gameObject.AddComponent<Blink>().Period = 1.6f;
        }

        /// <summary>탐험한 방: 회색으로 흐리게, "탐험함" 표시.</summary>
        private static void VisitedButton(Transform parent, string title, string sub, System.Action onClick)
        {
            var b = UI.ButtonCard(parent, onClick, Theme.Bg, Theme.LineSoft, 12, UI.Pad(14, 8), true, 2, 52, TextAnchor.MiddleLeft);
            UI.Label(b, title, 14, Theme.TextSub);
            if (!string.IsNullOrEmpty(sub)) UI.Label(b, sub, 12, Theme.PlaceholderText);
            b.gameObject.AddComponent<CanvasGroup>().alpha = 0.7f;
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
            var card = UI.ButtonCard(parent, FullMap, Theme.MapBg, Theme.DungeonLine(run.Floor) * new Color(1, 1, 1, 0.6f), 12, UI.Pad(12, 12), true, 8, 100, TextAnchor.UpperLeft);
            var area = UI.Rect(card, "map");
            UI.Size(area, height: MapH, width: MapW);
            DrawMap(area, MapW, MapH, run, null);

            var legend = UI.Row(card, 12);
            UI.Sub(legend, "■ 탐험함");
            UI.Label(legend, "■ 현재 위치", 12, Theme.Gold);
            UI.Label(legend, "□ 갈 수 있음", 12, Theme.Gold);
            var hint = UI.Sub(legend, "눌러서 전체 지도", TextAnchor.MiddleRight);
            UI.Size(hint, flexW: 1);
        }

        /// <summary>전체 지도: 크게 보고, 탐험을 마친 방을 눌러 순간이동 (수정 사항 #26).</summary>
        private void FullMap()
        {
            var run = S.Run;
            var body = Overlay.Modal(run.Floor + "층 지도", true);
            var modal = Overlay.Top;
            bool canTeleport = DungeonSystem.CanLeave(run);
            UI.Sub(body, canTeleport ? "탐험을 마친 방을 누르면 그곳으로 순간이동합니다." : "지금 방을 끝내야 이동할 수 있습니다.");
            float w = Theme.ScreenWidth - 64, h = 420;
            var bg = UI.Card(body, Theme.MapBg, Theme.CardBorder, 12, UI.Pad(0), true, 0);
            UI.Size(bg, height: h);
            var area = UI.Rect(bg, "map");
            area.anchorMin = area.anchorMax = new Vector2(0, 1);
            area.pivot = new Vector2(0, 1);
            area.sizeDelta = new Vector2(w - 8, h - 8);
            area.anchoredPosition = new Vector2(4, -4);
            area.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            DrawMap(area, w - 8, h - 8, run, canTeleport ? (System.Action<Room>)(room =>
            {
                Overlay.Close(modal);
                if (S.Teleport(room.Id)) Rebuild();
            }) : null);
            var legend = UI.Row(body, 12);
            UI.Sub(legend, "■ 탐험함");
            UI.Label(legend, "■ 현재 위치", 12, Theme.Gold);
            UI.Label(legend, "□ 갈 수 있음", 12, Theme.Gold);
        }

        private void DrawMap(RectTransform area, float mapW, float mapH, DungeonRun run, System.Action<Room> onTeleport)
        {
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
            float maxNode = onTeleport != null || mapH > MapH ? 52 : Node;
            float maxStep = maxNode * 2f;
            // 방이 많아 칸이 좁아지면 방 크기를 줄인다.
            float cell = Mathf.Min(maxStep, Mathf.Min(cols > 0 ? mapW / (cols + 1) : mapW, rows > 0 ? mapH / (rows + 1) : mapH));
            float node = Mathf.Clamp(cell * 0.62f, 14f, maxNode);
            float sx = cols == 0 ? 0 : Mathf.Min(maxStep, (mapW - node) / cols);
            float sy = rows == 0 ? 0 : Mathf.Min(maxStep * 0.9f, (mapH - node) / rows);
            float ox = (mapW - cols * sx - node) / 2f, oy = (mapH - rows * sy - node) / 2f;

            Vector2 Pos(Room r) => new Vector2(ox + (r.X - minX) * sx, oy + (r.Y - minY) * sy);

            var cur = run.Current;
            var shown = new HashSet<int>();
            foreach (var r in rooms) shown.Add(r.Id);
            var line = Theme.DungeonLine(run.Floor);

            // 연결선
            foreach (var r in rooms)
            {
                foreach (int l in r.Links)
                {
                    if (l < r.Id || !shown.Contains(l)) continue;
                    var o = run.Map.Get(l);
                    if (!r.Visited && !o.Visited) continue;
                    bool next = (r.Id == cur.Id && !o.Visited) || (o.Id == cur.Id && !r.Visited);
                    Edge(area, Pos(r), Pos(o), node, next && DungeonSystem.CanLeave(run), line);
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
                Color border = isCur ? Theme.Accent : next ? Theme.Gold : r.Visited ? line : Theme.PlaceholderLine;
                RectTransform n;
                bool tappable = onTeleport != null && !isCur && r.Visited && r.Cleared;
                if (tappable)
                {
                    var room = r;
                    n = UI.ButtonCard(area, () => onTeleport(room), fill, border, 6, UI.Pad(0), true, 0, 0, TextAnchor.MiddleCenter);
                }
                else n = UI.Card(area, fill, border, 6, UI.Pad(0), true, 0, TextAnchor.MiddleCenter, "room");
                Place(n, Pos(r), new Vector2(node, node));
                UI.Label(n, label, node < 22 ? 9 : node < 28 ? 11 : node < 44 ? 13 : 15, isCur ? Theme.OnAccent : next ? Theme.Gold : r.Visited ? Theme.Text : Theme.TextSub, isCur, TextAnchor.MiddleCenter);
                if (next)
                {
                    var inner = n.Find("fill");
                    if (inner != null) UI.Stretch((RectTransform)inner, 2, 2, 2, 2);
                    n.gameObject.AddComponent<Blink>();
                }
            }
        }

        private static void Place(RectTransform rt, Vector2 topLeft, Vector2 size)
        {
            rt.anchorMin = new Vector2(0, 1);
            rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0, 1);
            rt.sizeDelta = size;
            rt.anchoredPosition = new Vector2(topLeft.x, -topLeft.y);
        }

        private static void Edge(RectTransform area, Vector2 a, Vector2 b, float node, bool next, Color line)
        {
            var img = UI.Image(area, next ? Theme.Gold : line, 0, "edge");
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
                    if (S.LastLoot != null && S.LastLoot.LevelsGained > 0) _levelUp = true;
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
                ? (run.Floor >= GameBalance.MaxFloor ? "던전을 정복했습니다. 마을로 돌아갑니다." : "마을로 돌아갑니다. " + (run.Floor + 1) + "층이 열려 있습니다.")
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
            Rebuild(); // 층 진입 제목이 뜬다
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
                UI.Label(body, "진행 중인 퀘스트", 14, Theme.Text, true);
                foreach (var q in quests) UI.Sub(body, q.Title + " · 목표 " + q.TargetFloor + "층 · " + GuildSystem.ProgressText(q, C));
            }
        }
    }
}

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
            if (run.Effects.Count > 0) EffectTags(body, run);
            MiniMap(body, run);

            // 방 안에서 방금 일어난 일(보물·휴식·전투·이벤트 결과)을 먼저 크게, 방 상황은 그 아래 작게
            if (S.Notice != null) NoticeCard(body, S.Notice);
            string text = DungeonSystem.Situation(run, out string title);
            var box = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 10), true, 4);
            UI.Label(box, title, 12, Theme.TextSub, true);
            UI.Label(box, text, 14, Theme.TextBody);

            var choices = UI.Column(body, 8);
            Choices(choices, run);

            // 아래 고정 줄: 왼쪽 가방 · 가운데 캐릭터 정보 · 오른쪽 귀환 (아이콘 버튼). 순간이동은 미니맵에서.
            var bottom = UI.Card(page, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 16, 8, 8), false, 8, TextAnchor.MiddleCenter, "bottom");
            ScreenKit.TopLine(bottom);
            IconButton(bottom, "bag", "가방", () => Go(new InventoryScreen(true)), BottomStyle.Normal);
            UI.HSpacer(bottom);
            var info = IconButton(bottom, "character", "정보", () => CharacterInfo.Show(Overlay, S), BottomStyle.Normal);
            Anchors.Set("dungeon.info", info);
            UI.HSpacer(bottom);
            // 귀환 방을 찾기 전에는 붉은 회색으로 잠가 둔다 (누르면 이유를 알려 준다)
            bool canReturn = S.CanReturn;
            var ret = IconButton(bottom, "return", "귀환", canReturn ? (System.Action)ConfirmReturn : () => Toast("아직 귀환 방을 찾지 못했습니다. 귀환 방이나 보스를 찾아보세요."),
                canReturn ? BottomStyle.Return : BottomStyle.Locked);
            Anchors.Set("dungeon.return", ret);

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
                    return;
                }
            }
            Tutorial.OnDungeon();
        }

        // ── 레벨 업 배분 (수정 사항 #17): 자동 배분 · 확정 · 나중에 ──

        private void LevelUpAllocation(AllocationDraft draft)
        {
            var body = Overlay.Modal("레벨 업! Lv." + C.Level, false, false);
            var modal = Overlay.Top;
            Overlay.SetBack(() => Overlay.Close(modal));
            UI.Label(body, "남은 포인트 " + UI.Color(draft.Remaining.ToString(), Theme.GoldHex), 14, Theme.Text);
            var stats = C.JobData.AllocatableStats;
            // 캐릭터 화면과 같은 줄: 아이콘 · 이름/효과 · 고정 폭 − 값 + (줄마다 위치가 같다)
            for (int i = 0; i < stats.Length; i++)
            {
                var st = stats[i];
                ScreenKit.StatRow(body, C, st, draft, () => Redraw(modal, draft, () => draft.Remove(st)),
                    () => Redraw(modal, draft, () => draft.Add(st)), i < stats.Length - 1);
            }
            var buttons = UI.Row(body, 8);
            var later = UI.TextButton(buttons, "나중에", () =>
            {
                Overlay.Close(modal);
                Toast("남은 포인트는 마을 캐릭터 화면에서도 배분할 수 있습니다");
            }, ButtonKind.Ghost);
            UI.Size(later, width: 0, flexW: 1);
            var auto = UI.TextButton(buttons, "자동 배분", () => Redraw(modal, draft, draft.Auto));
            Anchors.Set("levelup.auto", auto);
            UI.Size(auto, width: 0, flexW: 1);
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
            UI.Size(ok, width: 0, flexW: 1);
            UI.SetEnabled(ok, draft.HasChanges);
            Tutorial.OnLevelUp();
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
                var home = ReturnButton(parent, "마을로 귀환한다", S.InTutorialRun ? "첫 모험은 여기까지 · 획득한 것은 모두 유지"
                    : run.Floor >= GameBalance.MaxFloor ? "던전을 정복했다" : (run.Floor + 1) + "층이 열렸다 · 획득한 것은 모두 유지", ReturnNow);
                Anchors.Set("dungeon.home", home);
            }
            // 방 안에서 하는 행동은 보라색 (이동은 금색·푸른색, 귀환은 초록)
            if (room.Type == RoomType.Merchant)
                ScreenKit.ActionButton(parent, "상인과 거래한다", room.MerchantDiscount ? "물약·해독제 (은인 할인: 마을보다 30% 쌈)" : "물약·해독제 (마을보다 20% 비쌈)", "›", false, Merchant);
            if (room.Type == RoomType.Return) ReturnButton(parent, "마법진으로 마을에 돌아간다", "이번 층 진행은 초기화 · 획득한 것은 유지", ConfirmReturn);

            bool first = true;
            foreach (var opt in DungeonSystem.MoveOptions(run, S.Difficulty))
            {
                var o = opt;
                RectTransform b = o.Room.Visited ? VisitedButton(parent, o.Direction, o.Hint, () => Move(o.Room.Id))
                    : NewRoomButton(parent, o.Direction, o.Hint, () => Move(o.Room.Id));
                if (first && !o.Room.Visited) Anchors.Set("dungeon.choice0", b);
                first = false;
            }
        }

        /// <summary>귀환 관련 선택지: 이동 선택지(금색·푸른색)와 다른 초록 계열.</summary>
        private static RectTransform ReturnButton(Transform parent, string title, string sub, System.Action onClick)
        {
            var b = UI.ButtonCard(parent, onClick, Theme.ReturnBg, Theme.ReturnBorder, 12, UI.Pad(14, 8), true, 2, 60, TextAnchor.MiddleLeft);
            UI.Label(b, title, 15, Theme.ReturnText, true);
            if (!string.IsNullOrEmpty(sub)) UI.Label(b, sub, 12, Theme.ReturnSub);
            return b;
        }

        private enum BottomStyle
        {
            Normal,
            Return,
            /// <summary>귀환 방 미발견: 붉은 회색.</summary>
            Locked
        }

        /// <summary>아래 고정 줄 아이콘 버튼 (폭 96).</summary>
        private static RectTransform IconButton(Transform parent, string icon, string label, System.Action onClick, BottomStyle style)
        {
            Color fill = style == BottomStyle.Return ? Theme.ReturnBg : style == BottomStyle.Locked ? Theme.Hex("221A1B") : Theme.Button;
            Color border = style == BottomStyle.Return ? Theme.ReturnBorder : style == BottomStyle.Locked ? Theme.Hex("4E3838") : Theme.ButtonBorder;
            var b = UI.ButtonCard(parent, onClick, fill, border, 12, UI.Pad(4, 6), true, 2, 60, TextAnchor.MiddleCenter);
            UI.Size(b, width: 96, minH: 60, flexW: 0);
            var img = UI.CenteredIcon(b, icon, 26);
            Color text = style == BottomStyle.Locked ? Theme.Hex("8A6E6C") : Theme.Text;
            if (style == BottomStyle.Locked) img.color = text;
            UI.Label(b, label, 12, text, true, TextAnchor.MiddleCenter);
            return b;
        }

        /// <summary>방 결과 카드: 제목 크게, 설명과 얻은 것은 한 줄씩.</summary>
        private static void NoticeCard(Transform parent, RoomNotice n)
        {
            var card = UI.Card(parent, Theme.AccentBg, Theme.Accent, 12, UI.Pad(14, 12), true, 4);
            UI.Label(card, n.Title, 17, Theme.Gold, true);
            foreach (var line in n.Lines)
            {
                var t = UI.Label(card, line, 15, Theme.Text);
                t.lineSpacing = 1.25f;
            }
            foreach (var line in n.LootLines()) UI.Label(card, "· " + line, 14, Theme.Text);
        }

        /// <summary>새 방: 금색 테두리 + 위쪽에서 빛나는 줄 (수정 사항 #10).</summary>
        private static RectTransform NewRoomButton(Transform parent, string title, string sub, System.Action onClick)
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
            return b;
        }

        /// <summary>탐험한 방: 푸른 카드 + "탐험함" (빛나지 않지만 눌리는 버튼으로 보이게, 수정 사항 #5).</summary>
        private static RectTransform VisitedButton(Transform parent, string title, string sub, System.Action onClick)
        {
            var b = UI.ButtonCard(parent, onClick, Theme.BlueBg, Theme.BlueBorder, 12, UI.Pad(14, 8), true, 2, 60, TextAnchor.MiddleLeft);
            UI.Label(b, title, 15, Theme.BlueLight, true);
            if (!string.IsNullOrEmpty(sub)) UI.Label(b, sub, 12, Theme.BlueText);
            return b;
        }

        // ── 탐험 효과 (이벤트로 얻은 버프·디버프) ──

        private static bool IsBuff(ExploreEffectType t) =>
            t == ExploreEffectType.Regen || t == ExploreEffectType.Focus || t == ExploreEffectType.DemonPact;

        /// <summary>머리줄 아래 효과 태그 줄. 누르면 효과 설명.</summary>
        private void EffectTags(Transform parent, DungeonRun run)
        {
            RectTransform row = null;
            for (int i = 0; i < run.Effects.Count; i++)
            {
                // 한 줄에 2개씩 (긴 이름 둘이어도 화면 폭을 넘지 않게)
                if (i % 2 == 0)
                {
                    row = UI.Row(parent, 6, null, TextAnchor.MiddleLeft);
                    UI.Size(row, height: 28);
                }
                var fx = run.Effects[i];
                bool buff = IsBuff(fx.Type);
                var tag = UI.ButtonCard(row, () => EffectInfo(run), buff ? Theme.BlueBg : Theme.RedBg, buff ? Theme.BlueBorder : Theme.RedBorder,
                    14, UI.Pad(10, 0), false, 0, 28, TextAnchor.MiddleCenter);
                UI.Label(tag, ExploreEffects.Name(fx.Type) + " · " + ExploreEffects.Remaining(fx), 12, buff ? Theme.BlueLight : Theme.RedLight, true,
                    TextAnchor.MiddleCenter, false, false);
            }
        }

        private void EffectInfo(DungeonRun run)
        {
            var body = Overlay.Modal("탐험 효과");
            UI.Sub(body, "이벤트에서 얻은 효과입니다. 마을로 돌아가면 모두 사라집니다.");
            foreach (var e in run.Effects)
            {
                bool buff = IsBuff(e.Type);
                var card = UI.Card(body, buff ? Theme.BlueBg : Theme.RedBg, buff ? Theme.BlueBorder : Theme.RedBorder, 10, UI.Pad(12, 10), true, 4);
                UI.Label(card, ExploreEffects.Name(e.Type) + " · " + ExploreEffects.Remaining(e), 14, buff ? Theme.BlueLight : Theme.RedLight, true);
                UI.Label(card, ExploreEffects.Describe(e.Type), 13, Theme.TextBody);
            }
        }

        // ── 미니맵 ──

        private static List<Room> Discovered(DungeonRun run)
        {
            var set = new HashSet<int>();
            foreach (var r in run.Map.Rooms)
            {
                if (r.Revealed) set.Add(r.Id); // 이벤트로 공개된 방
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
            Anchors.Set("dungeon.map", card);
            var area = UI.Rect(card, "map");
            UI.Size(area, height: MapH, width: MapW);
            DrawMap(area, MapW, MapH, run, null);

            // 범례 줄 오른쪽 끝(카드 오른쪽 아래): 지도 아이콘 버튼 → 전체 지도·순간이동 (갈 곳이 있으면 깜빡인다)
            var legend = UI.Row(card, 12, null, TextAnchor.MiddleLeft);
            UI.Size(legend, height: 32);
            UI.Sub(legend, "■ 탐험함");
            UI.Label(legend, "■ 현재 위치", 12, Theme.Gold);
            UI.Label(legend, "□ 갈 수 있음", 12, Theme.Gold);
            UI.HSpacer(legend);
            bool canTeleport = DungeonSystem.TeleportTargets(run).Count > 0 && DungeonSystem.CanLeave(run);
            var tp = UI.ButtonCard(legend, FullMap, new Color(0.10f, 0.09f, 0.06f, 0.92f), canTeleport ? Theme.Gold : Theme.ButtonBorder, 8, UI.Pad(0), false, 0, 32, TextAnchor.MiddleCenter);
            UI.Size(tp, width: 28, height: 32);
            UI.CenteredIcon(tp, "map", 20);
            if (canTeleport) tp.Find("fill")?.gameObject.AddComponent<Blink>();
            Anchors.Set("dungeon.teleport", tp);
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
                    bool revealedOnly = !r.Visited && !o.Visited;
                    if (revealedOnly && !(r.Revealed && o.Revealed)) continue;
                    bool next = (r.Id == cur.Id && !o.Visited) || (o.Id == cur.Id && !r.Visited);
                    Edge(area, Pos(r), Pos(o), node, next && DungeonSystem.CanLeave(run), revealedOnly ? line * new Color(1, 1, 1, 0.45f) : line);
                }
            }
            // 방
            bool easy = S.Difficulty == Difficulty.Easy;
            foreach (var r in rooms)
            {
                bool isCur = r.Id == cur.Id;
                bool next = !r.Visited && cur.Links.Contains(r.Id) && DungeonSystem.CanLeave(run);
                bool known = r.Visited || easy || r.Revealed;
                bool chain = r.Chain && !r.Visited;
                Color fill = isCur ? Theme.Accent : r.Visited ? Theme.MapNode : Theme.MapBg;
                Color border = isCur ? Theme.Accent : next ? Theme.Gold : chain ? Theme.Gold * new Color(1, 1, 1, 0.7f) : r.Visited ? line : Theme.PlaceholderLine;
                RectTransform n;
                bool tappable = onTeleport != null && !isCur && r.Visited && r.Cleared;
                if (tappable)
                {
                    var room = r;
                    n = UI.ButtonCard(area, () => onTeleport(room), fill, border, 6, UI.Pad(0), true, 0, 0, TextAnchor.MiddleCenter);
                }
                else n = UI.Card(area, fill, border, 6, UI.Pad(0), true, 0, TextAnchor.MiddleCenter, "room");
                Place(n, Pos(r), new Vector2(node, node));
                // 방 종류는 글자 대신 아이콘 (모르는 방은 "?")
                Color tint = isCur ? Theme.OnAccent : next ? Theme.Gold : r.Visited ? Theme.Text : Theme.TextSub;
                // 이벤트로 공개만 된 방은 흐리게
                if (!r.Visited && !next && r.Revealed) tint *= new Color(1, 1, 1, 0.6f);
                if (chain) UI.Label(n, "!", node < 22 ? 10 : node < 28 ? 12 : node < 44 ? 15 : 18, Theme.Gold, true, TextAnchor.MiddleCenter);
                else if (known)
                {
                    var icon = UI.CenteredIcon(n, RoomIcon(r.DisplayType), Mathf.Round(node * 0.62f));
                    icon.color = tint;
                }
                else UI.Label(n, "?", node < 22 ? 9 : node < 28 ? 11 : node < 44 ? 13 : 15, tint, true, TextAnchor.MiddleCenter);
                if (next)
                {
                    var inner = n.Find("fill");
                    if (inner != null) UI.Stretch((RectTransform)inner, 2, 2, 2, 2);
                    n.gameObject.AddComponent<Blink>();
                }
            }
        }

        private static string RoomIcon(RoomType t)
        {
            switch (t)
            {
                case RoomType.Battle: return "room_battle";
                case RoomType.Boss: return "room_boss";
                case RoomType.Event: return "room_event";
                case RoomType.Treasure: return "room_treasure";
                case RoomType.Rest: return "room_rest";
                case RoomType.Merchant: return "room_merchant";
                case RoomType.Return: return "room_return";
                default: return "room_start";
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
            if (!horizontal && Mathf.Abs(ca.x - cb.x) >= 0.5f)
            {
                // 지름길(개구멍)처럼 비스듬한 연결은 기울인 선으로
                var rt = img.rectTransform;
                rt.anchorMin = rt.anchorMax = new Vector2(0, 1);
                rt.pivot = new Vector2(0.5f, 0.5f);
                Vector2 mid = (ca + cb) / 2f, d = cb - ca;
                rt.sizeDelta = new Vector2(d.magnitude, 2);
                rt.anchoredPosition = new Vector2(mid.x, -mid.y);
                rt.localRotation = Quaternion.Euler(0, 0, -Mathf.Atan2(d.y, d.x) * Mathf.Rad2Deg);
                if (next) img.gameObject.AddComponent<Blink>();
                return;
            }
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

        private void Merchant()
        {
            var body = Overlay.Modal(S.Run.Current.MerchantDiscount ? "구해 준 상인" : "떠돌이 상인", true);
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
            UI.TextButton(body, "저장하고 타이틀로", () =>
            {
                S.Save();
                Go(new TitleScreen());
            }, ButtonKind.Ghost);
        }
    }
}

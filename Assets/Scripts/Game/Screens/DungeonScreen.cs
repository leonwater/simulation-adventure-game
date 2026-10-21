using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 던전 탐험: 층·HP, 테마 색 미니맵(누르면 전체 지도 + 순간이동), 상황 텍스트, 아래 고정 이동 방향키(새 방 강조 · 탐험한 방 푸른색),
    /// 층 진입 제목, 전투 뒤 레벨 업 배분, 가방·귀환. 전투·이벤트·상인은 별도 화면에서 끝낸 뒤 이 화면으로 돌아온다 (v2.3).
    /// </summary>
    public class DungeonScreen : ScreenBase
    {
        private const float MapW = 334, MapH = 204, Node = 36;
        private static readonly Color ClearedRoom = Theme.Hex("2D4A3B");
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
            // 머리줄 아래 줄: 탐험한 방 · 레벨 · 경험치 % (v2.4)
            string exp = C.Level >= GameBalance.MaxLevel ? "최대 레벨" : "경험치 " + Mathf.FloorToInt((float)Leveling.ExpProgress(C) * 100) + "%";
            ScreenKit.DungeonHeader(page, run.Floor + "층 · " + theme.Name, "탐험한 방 " + run.RoomsExplored + " · Lv." + C.Level + " " + exp, C, Pause);

            var body = UI.Scroll(page, out _, 12, UI.Pad(16, 16, 14, 16));
            if (run.Effects.Count > 0) EffectTags(body, run);
            MiniMap(body, run);

            // 방 안에서 방금 일어난 일(보물·휴식·전투·이벤트 결과)을 먼저 크게, 방 상황은 그 아래 작게
            if (S.Notice != null) NoticeCard(body, S.Notice);
            string text = DungeonSystem.Situation(run, out string title);
            var box = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 10), true, 4);
            UI.Label(box, title, 12, Theme.TextSub, true);
            UI.Label(box, text, 14, Theme.TextBody);

            // 아래 고정 칸: 보스 처치 뒤 선택 · 방 안 행동 · 이동 패드 (스크롤하지 않아 손이 늘 같은 자리에 닿는다, v2.3)
            var dock = UI.Column(page, 8, UI.Pad(16, 16, 8, 8), TextAnchor.UpperLeft, "dock");
            Choices(dock, run);

            // 아래 고정 줄: 가방 · 캐릭터 정보 · 퀘스트 · 귀환 (아이콘 버튼, v2.4: 퀘스트 추가). 순간이동은 미니맵에서.
            var bottom = UI.Card(page, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 16, 8, 8), false, 8, TextAnchor.MiddleCenter, "bottom");
            ScreenKit.TopLine(bottom);
            IconButton(bottom, "bag", "가방", () =>
            {
                if (!Tutorial.Blocks("가방")) Go(new InventoryScreen(true));
            }, BottomStyle.Normal);
            UI.HSpacer(bottom);
            var info = IconButton(bottom, "character", "정보", () => CharacterInfo.Show(Overlay, S), BottomStyle.Normal);
            Anchors.Set("dungeon.info", info);
            UI.HSpacer(bottom);
            IconButton(bottom, "guild", "퀘스트", () => CharacterInfo.ShowQuests(Overlay, S), BottomStyle.Normal);
            UI.HSpacer(bottom);
            // 귀환 방을 찾기 전에는 붉은 회색으로 잠가 둔다 (누르면 이유를 알려 준다)
            bool canReturn = S.CanReturn;
            var ret = IconButton(bottom, "return", "귀환", canReturn ? (System.Action)ConfirmReturn : () => Toast("아직 귀환 방을 찾지 못했습니다. 귀환 방이나 보스를 찾아보세요."),
                canReturn ? BottomStyle.Return : BottomStyle.Locked);
            Anchors.Set("dungeon.return", ret);

            if (run.FloorIntroPending) FloorIntro(root, run);
            else AfterIntro();
            // 방에서 얻은 장비가 지금 장비보다 좋으면 바로 착용할지 묻는다 (v2.4, 튜토리얼 안내 중에는 묻지 않음)
            if (S.Notice?.Loot != null && !Coach.Active && !run.FloorIntroPending) GearOffer.Offer(S.Notice.Loot.Items, Rebuild);
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
            // 캐릭터 화면과 같은 줄: 아이콘 · 이름/효과 · 고정 폭 - 값 + (줄마다 위치가 같다)
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
                    DescendButton(parent, "아래층으로 내려간다", (run.Floor + 1) + "층 · " + MonsterDb.ThemeFor(run.Floor + 1).Name + " · 현재 HP 유지", Descend);
                var home = ReturnButton(parent, "마을로 귀환한다", S.InTutorialRun ? "첫 모험은 여기까지 · 획득한 것은 모두 유지"
                    : run.Floor >= GameBalance.MaxFloor ? "던전을 정복했다" : (run.Floor + 1) + "층이 열렸다 · 획득한 것은 모두 유지", ReturnNow);
                Anchors.Set("dungeon.home", home);
            }
            QuickPotions(parent);
            // 방 안에서 하는 행동은 보라색. 귀환 방은 선택지 없이 글자만 보여 주고, 귀환은 아래 귀환 버튼으로 한다.
            if (room.Type == RoomType.Merchant)
                ScreenKit.ActionButton(parent, "상인과 거래한다", room.MerchantDiscount ? "소모품 (은인 할인: 마을보다 30% 쌈)" : "소모품 (마을보다 50% 비쌈)", "›", false, () => Go(new MerchantScreen()), true, 52);

            var pad = DungeonSystem.Pad(run, S.Difficulty);
            MovePadView(parent, run, pad);
            foreach (var r in pad.Extra)
            {
                var target = r;
                string hint = target.Visited ? Names.Of(target.Type) + " · 탐험함" : target.Chain ? "무언가 기다리고 있다 (!)" : "지름길";
                if (target.Visited) VisitedButton(parent, "지름길로 돌아간다", hint, () => Move(target.Id));
                else NewRoomButton(parent, "지름길로 간다", hint, () => Move(target.Id));
            }
        }

        /// <summary>회복 물약 바로 쓰기 (v2.4): 가방에 들어가지 않고 한 번 눌러 쓴다. HP가 가득하면 잠긴다.</summary>
        private void QuickPotions(Transform parent)
        {
            var seen = new HashSet<string>();
            RectTransform row = null;
            bool full = C.CurrentHp >= CharacterStats.MaxHp(C);
            foreach (var item in C.Inventory.Items)
            {
                var def = ItemDb.Consumable(item.TemplateId);
                if (def == null || def.HealRatio <= 0 || !seen.Add(item.TemplateId)) continue;
                if (row == null)
                {
                    row = UI.Row(parent, 8, null, TextAnchor.MiddleLeft, "potions");
                    UI.Size(row, height: 40);
                }
                string uid = item.Uid;
                int count = C.Inventory.CountOf(item.TemplateId);
                var b = UI.ButtonCard(row, () => UsePotion(uid), Theme.ReturnBg, Theme.ReturnBorder, 10, UI.Pad(10, 0), false, 6, 40, TextAnchor.MiddleCenter);
                UI.Size(b, width: 0, flexW: 1);
                UI.Icon(b, "stat_vitality", 16);
                UI.Label(b, def.Name + " ×" + count + " · HP +" + Mathf.RoundToInt((float)def.HealRatio * 100) + "%", 13, Theme.ReturnText, true, TextAnchor.MiddleCenter, false, false);
                if (full) UI.SetEnabled(b, false);
            }
        }

        private void UsePotion(string uid)
        {
            if (!S.UseConsumable(uid, out string msg))
            {
                Toast(msg);
                return;
            }
            Overlay.Flash(msg, Theme.Green, 0.9f);
            Rebuild();
        }

        // ── 이동 패드 (던전 이동 UI 시안서): 위 · 왼쪽 · 오른쪽 · 아래 칸은 늘 같은 자리·같은 크기, 상태는 색과 글자로만 ──

        private const float PadH = 204, CellW = 104, CellH = 56;
        private static readonly Vector2[] PadPos = { new Vector2(126, 7), new Vector2(10, 73), new Vector2(242, 73), new Vector2(126, 139) };
        private static readonly string[] PadArrow = { "↑", "←", "→", "↓" };
        private static readonly string[] PadName = { "위", "왼쪽", "오른쪽", "아래" };

        private void MovePadView(Transform parent, DungeonRun run, MovePad pad)
        {
            bool open = DungeonSystem.CanLeave(run);
            var frame = UI.Card(parent, Theme.MapBg, Theme.CardBorder, 16, UI.Pad(0), true, 0, TextAnchor.UpperLeft, "pad");
            UI.Size(frame, height: PadH);
            var area = UI.Rect(frame, "pad-area");
            area.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            UI.Stretch(area);

            bool first = true;
            for (int i = 0; i < 4; i++)
            {
                var slot = pad.Slots[i];
                var room = slot.Room;
                string title = PadArrow[i] + " " + PadName[i];
                Color fill, border, text, sub;
                string tag;
                bool glow = false;
                if (room == null || !open)
                {
                    fill = Theme.Hex("1B1813");
                    border = Theme.Hex("3A3326");
                    text = sub = Theme.Hex("9C937F");
                    tag = room == null ? "막힘" : "선택 후 이동";
                }
                else
                {
                    var shown = room.DisplayType;
                    bool special = slot.Known && (shown == RoomType.Return || shown == RoomType.Boss);
                    if (special && shown == RoomType.Return)
                    {
                        fill = Theme.ReturnBg; border = Theme.ReturnBorder; text = Theme.ReturnText; sub = Theme.ReturnSub;
                        tag = "귀환 방";
                    }
                    else if (special)
                    {
                        fill = Theme.RedBg; border = Theme.Red; text = Theme.RedLight; sub = Theme.RedLight;
                        tag = "보스 방";
                    }
                    else if (room.Visited)
                    {
                        fill = Theme.BlueBg; border = Theme.BlueBorder; text = Theme.BlueLight; sub = Theme.BlueText;
                        tag = slot.IsPrevious ? "방금 온 곳" : "탐험함";
                    }
                    else
                    {
                        fill = Theme.AccentBg; border = Theme.Accent; text = Theme.Text; sub = Theme.Gold;
                        tag = room.Chain ? "새 방 (!)" : slot.Known ? "새 방 · " + Names.Of(shown) : "새 방";
                        glow = true;
                    }
                }
                RectTransform cell;
                if (room != null && open)
                {
                    var target = room;
                    cell = UI.ButtonCard(area, () => Move(target.Id), fill, border, 12, UI.Pad(4, 4), true, 2, CellH, TextAnchor.MiddleCenter);
                    if (glow && first) Anchors.Set("dungeon.choice0", cell);
                    if (glow) first = false;
                }
                else cell = UI.Card(area, fill, border, 12, UI.Pad(4, 4), true, 2, TextAnchor.MiddleCenter, "pad-cell");
                Place(cell, PadPos[i], new Vector2(CellW, CellH));
                UI.Label(cell, title, 16, text, true, TextAnchor.MiddleCenter, false, false);
                UI.Label(cell, tag, 12, sub, false, TextAnchor.MiddleCenter, false, false);
                if (glow) AddGlow(cell);
            }

            // 가운데: 현재 방 표시 (누를 수 없다)
            var center = UI.Card(area, Theme.MapBg, Theme.ButtonBorder, 12, UI.Pad(4, 4), true, 1, TextAnchor.MiddleCenter, "pad-center");
            Place(center, new Vector2(126, 73), new Vector2(CellW, CellH));
            UI.Label(center, "현재 방", 11, Theme.TextSub, false, TextAnchor.MiddleCenter, false, false);
            UI.Label(center, run.Current.Type == RoomType.Start ? "시작 방" : Names.Of(run.Current.Type) + " 방", 14, Theme.Text, true, TextAnchor.MiddleCenter, false, false);
        }

        /// <summary>새 방 칸 위쪽에서 빛나는 줄.</summary>
        private static void AddGlow(RectTransform cell)
        {
            var glow = UI.Image(cell, Theme.Gold, 0, "glow");
            glow.sprite = Sprites.GradientUp;
            glow.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var rt = glow.rectTransform;
            rt.anchorMin = new Vector2(0, 1);
            rt.anchorMax = new Vector2(1, 1);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.localScale = new Vector3(1, -1, 1);
            rt.sizeDelta = new Vector2(-12, 10);
            rt.anchoredPosition = new Vector2(0, -6);
            glow.gameObject.AddComponent<Blink>().Period = 1.6f;
        }

        /// <summary>아래층으로: 이동(금색·푸른색)·귀환(초록)·행동(보라)과 겹치지 않는 진홍색 (v1.9, 무심코 누르지 않게).</summary>
        private static RectTransform DescendButton(Transform parent, string title, string sub, System.Action onClick)
        {
            var b = UI.ButtonCard(parent, onClick, Theme.DescendBg, Theme.DescendBorder, 12, UI.Pad(14, 8), true, 2, 60, TextAnchor.MiddleLeft);
            UI.Label(b, title, 15, Theme.DescendText, true);
            UI.Label(b, sub, 12, Theme.DescendSub);
            return b;
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

        /// <summary>아래 고정 줄 아이콘 버튼 (폭 80, 4개).</summary>
        private static RectTransform IconButton(Transform parent, string icon, string label, System.Action onClick, BottomStyle style)
        {
            Color fill = style == BottomStyle.Return ? Theme.ReturnBg : style == BottomStyle.Locked ? Theme.Hex("221A1B") : Theme.Button;
            Color border = style == BottomStyle.Return ? Theme.ReturnBorder : style == BottomStyle.Locked ? Theme.Hex("4E3838") : Theme.ButtonBorder;
            var b = UI.ButtonCard(parent, onClick, fill, border, 12, UI.Pad(4, 6), true, 2, 60, TextAnchor.MiddleCenter);
            UI.Size(b, width: 80, minH: 60, flexW: 0);
            var img = UI.CenteredIcon(b, icon, 26);
            Color text = style == BottomStyle.Locked ? Theme.Hex("8A6E6C") : Theme.Text;
            if (style == BottomStyle.Locked) img.color = text;
            UI.Label(b, label, 12, text, true, TextAnchor.MiddleCenter);
            return b;
        }

        /// <summary>방 결과 카드: 제목 크게, 설명과 얻은 것은 한 줄씩.</summary>
        /// <summary>방 결과 카드: 이동 선택지(금색)와 헷갈리지 않게 중립색 (v1.9).</summary>
        private static void NoticeCard(Transform parent, RoomNotice n)
        {
            var card = UI.Card(parent, Theme.Card, Theme.ButtonBorder, 12, UI.Pad(14, 12), true, 4);
            UI.Label(card, n.Title, 17, Theme.Text, true);
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
            AddGlow(b);
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
            UI.Label(legend, "■ 클리어", 12, Theme.ReturnSub);
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
            UI.Label(legend, "■ 클리어", 12, Theme.ReturnSub);
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
                // 클리어한 방은 초록빛, 들어갔지만 끝내지 못한 방(도망친 전투)은 회색 (v2.4)
                Color fill = isCur ? Theme.Accent : r.Visited && r.Cleared ? ClearedRoom : r.Visited ? Theme.MapNode : Theme.MapBg;
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
                    Go(new MerchantScreen());
                    break;
                default:
                    if (S.LastLoot != null && S.LastLoot.LevelsGained > 0) _levelUp = true;
                    Rebuild();
                    break;
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

        private static void Pause() => ScreenKit.DungeonPauseMenu();
    }
}

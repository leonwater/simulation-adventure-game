using System;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>여러 화면이 같이 쓰는 머리줄·하단 메뉴·선택지 버튼 (UI 시안 기준).</summary>
    public static class ScreenKit
    {
        public const float ContentWidth = Theme.ScreenWidth - 32; // 좌우 여백 16

        public static RectTransform Page(RectTransform root, float spacing = 0, RectOffset padding = null)
        {
            var col = UI.Column(root, spacing, padding, TextAnchor.UpperLeft, "page");
            UI.Stretch(col);
            return col;
        }

        /// <summary>시설 화면 머리줄: "‹ 마을" · 제목 · 골드.</summary>
        public static void TopBar(Transform parent, string title, string backLabel, Action onBack, string right)
        {
            var bar = UI.Card(parent, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(12, 12, 6, 6), false, 0, TextAnchor.MiddleCenter, "topbar");
            UI.Size(bar, height: 57);
            var left = UI.Row(bar, 0, null, TextAnchor.MiddleLeft);
            UI.Size(left, width: 110);
            if (onBack != null)
            {
                var back = UI.ButtonCard(left, onBack, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(6, 0), false, 0, 44);
                Anchors.Set("topbar.back", back);
                UI.Label(back, "‹ " + backLabel, 14, Theme.Gold, false, TextAnchor.MiddleLeft, false, false);
            }
            var t = UI.Label(bar, title, 16, Theme.Text, true, TextAnchor.MiddleCenter);
            UI.Size(t, flexW: 1);
            var r = UI.Label(bar, right ?? "", 14, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            UI.Size(r, width: 110);
            BottomLine(bar);
        }

        /// <summary>마을 쪽 화면 머리줄: 왼쪽 뒤로 · 가운데 제목 · 오른쪽 골드 + 설정 버튼 (던전 밖 모든 화면 공통).</summary>
        public static void TopBar(Transform parent, string title, string backLabel, Action onBack, Character c)
        {
            var bar = UI.Card(parent, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(12, 12, 6, 6), false, 0, TextAnchor.MiddleCenter, "topbar");
            UI.Size(bar, height: 57);
            var left = UI.Row(bar, 0, null, TextAnchor.MiddleLeft);
            UI.Size(left, width: 120);
            if (onBack != null)
            {
                var back = UI.ButtonCard(left, onBack, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(6, 0), false, 0, 44);
                Anchors.Set("topbar.back", back);
                UI.Label(back, "‹ " + backLabel, 14, Theme.Gold, false, TextAnchor.MiddleLeft, false, false);
            }
            var t = UI.Label(bar, title, 16, Theme.Text, true, TextAnchor.MiddleCenter);
            UI.Size(t, flexW: 1);
            GoldAndSettings(bar, c, 120);
            BottomLine(bar);
        }

        /// <summary>오른쪽 끝: 골드 + 설정 버튼 (마을 머리줄과 같은 모양).</summary>
        public static void GoldAndSettings(Transform bar, Character c, float width = -1)
        {
            var right = UI.Row(bar, 6, null, TextAnchor.MiddleRight, "gold-settings");
            if (width > 0) UI.Size(right, width: width, flexW: 0); // 왼쪽 칸(120)과 같은 폭이라 제목이 가운데
            if (width > 0) UI.HSpacer(right);
            UI.Icon(right, "gold", 18);
            UI.Label(right, Names.Gold(c.Gold), 14, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            var gear = UI.ButtonCard(right, () => SettingsPanel.Open(), Theme.Bar, Theme.ButtonBorder, 10, UI.Pad(0), false, 0, 40, TextAnchor.MiddleCenter);
            UI.Size(gear, width: 40, height: 40);
            UI.Icon(gear, "settings", 22);
            Anchors.Set("topbar.settings", gear);
        }

        /// <summary>직업 아이콘 + 글자 (직업이 나오는 곳마다).</summary>
        public static RectTransform JobLine(Transform parent, Job job, string text, float size, Color color, bool bold = false)
        {
            var row = UI.Row(parent, 4, null, TextAnchor.MiddleLeft, "job");
            UI.Icon(row, UI.JobIcon(job), Mathf.Round(size * 1.3f)).color = color;
            UI.Label(row, text, size, color, bold, TextAnchor.MiddleLeft, false, false);
            return row;
        }

        public static void BottomLine(RectTransform rt, Color? color = null)
        {
            var line = UI.Image(rt, color ?? Theme.Line, 0, "line");
            line.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var lrt = line.rectTransform;
            lrt.anchorMin = new Vector2(0, 0);
            lrt.anchorMax = new Vector2(1, 0);
            lrt.pivot = new Vector2(0.5f, 0);
            lrt.sizeDelta = new Vector2(0, 1);
            lrt.anchoredPosition = Vector2.zero;
        }

        public static void TopLine(RectTransform rt)
        {
            var line = UI.Image(rt, Theme.Line, 0, "line");
            line.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            var lrt = line.rectTransform;
            lrt.anchorMin = new Vector2(0, 1);
            lrt.anchorMax = new Vector2(1, 1);
            lrt.pivot = new Vector2(0.5f, 1);
            lrt.sizeDelta = new Vector2(0, 1);
            lrt.anchoredPosition = Vector2.zero;
        }

        /// <summary>마을 머리줄: 이름 · 직업 레벨 · 경험치 막대 · 등급 · 골드.</summary>
        public static void TownHeader(Transform parent, Character c)
        {
            var bar = UI.Card(parent, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 16, 12, 12), false, 8, TextAnchor.MiddleLeft, "header");
            UI.Size(bar, height: 64);
            var left = UI.Column(bar, 4);
            UI.Size(left, flexW: 1);
            // 이름 옆에 모험가 등급 배지 (수정 사항: 글자 알약 대신 아이콘)
            var nameRow = UI.Row(left, 6);
            UI.Label(nameRow, c.Name, 15, Theme.Text, true, TextAnchor.MiddleLeft, false, false);
            UI.Icon(nameRow, UI.RankIcon(c.Rank), 22);
            var barRow = UI.Row(left, 8);
            UI.ProgressBar(barRow, (float)Leveling.ExpProgress(c), Theme.Blue, 6, 100);
            JobLine(barRow, c.Job, c.JobData.Name + " Lv." + c.Level, 12, Theme.TextSub);
            // 오른쪽 위: 골드 + 설정 버튼 → 설정 창 (다른 마을 화면 머리줄과 같다)
            GoldAndSettings(bar, c);
            BottomLine(bar);
        }

        private static readonly string[] NavLabels = { "마을", "캐릭터", "가방", "스킬" };

        /// <summary>마을 계열 하단 메뉴. 0 마을 · 1 캐릭터 · 2 가방 · 3 스킬 (설정은 마을 오른쪽 위 버튼)</summary>
        public static void BottomNav(Transform parent, int active)
        {
            var nav = UI.Card(parent, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(0), false, 0, TextAnchor.MiddleCenter, "nav");
            UI.Size(nav, height: 60);
            nav.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth = true;
            for (int i = 0; i < NavLabels.Length; i++)
            {
                int idx = i;
                var item = UI.ButtonCard(nav, () => Navigate(idx), Theme.Bar, Theme.Bar, 0.01f, UI.Pad(0), false, 0, 60, TextAnchor.MiddleCenter);
                UI.Size(item, width: 0, flexW: 1); // 메뉴 칸을 같은 폭으로
                UI.Label(item, NavLabels[i], 13, i == active ? Theme.Gold : Theme.TextSub, i == active, TextAnchor.MiddleCenter);
                if (i != active && Alerts.Nav(i)) UI.Dot(item, 9, 12);
            }
            TopLine(nav);
        }

        public static void Navigate(int idx)
        {
            var app = GameApp.Instance;
            switch (idx)
            {
                case 0: app.Router.Show(new TownScreen()); break;
                case 1: app.Router.Show(new CharacterScreen()); break;
                case 2: app.Router.Show(new InventoryScreen()); break;
                default: app.Router.Show(new SkillsScreen()); break;
            }
        }

        /// <summary>던전 계열 머리줄: 제목·부제 + HP + 일시정지.</summary>
        public static void DungeonHeader(Transform parent, string title, string sub, Character c, Action onPause, bool showHpBar = true)
        {
            var bar = UI.Card(parent, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 12, 6, 6), false, 10, TextAnchor.MiddleLeft, "header");
            UI.Size(bar, height: 60);
            var left = UI.Column(bar, 2);
            UI.Size(left, flexW: 1);
            UI.Label(left, title, 15, Theme.Text, true);
            if (!string.IsNullOrEmpty(sub)) UI.Sub(left, sub);
            int max = CharacterStats.MaxHp(c);
            var hp = UI.Column(bar, 3, null, TextAnchor.MiddleRight);
            UI.Size(hp, width: 110, flexW: 0);
            UI.Label(hp, "HP " + c.CurrentHp + "/" + max, 12, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            if (showHpBar) UI.ProgressBar(hp, (float)c.CurrentHp / max, Theme.Red, 8, 110);
            if (onPause != null) PauseButton(bar, onPause);
            BottomLine(bar);
        }

        public static void PauseButton(Transform parent, Action onPause)
        {
            var b = UI.ButtonCard(parent, onPause, Theme.Bar, Theme.ButtonBorder, 10, UI.Pad(0), false, 0, 44, TextAnchor.MiddleCenter);
            UI.Size(b, height: 44, width: 44);
            UI.Label(b, "Ⅱ", 15, Theme.Text, true, TextAnchor.MiddleCenter);
        }

        /// <summary>
        /// 능력치 배분 칸: − · 값 · + 를 고정 폭(152) 안에 절대 위치로 놓아 줄마다 간격이 똑같다
        /// (캐릭터 화면·던전 레벨 업 창 공통).
        /// </summary>
        public static RectTransform Stepper(Transform row, string value, Action onMinus, bool minusEnabled, Action onPlus, bool plusEnabled) =>
            Stepper(row, value, onMinus, minusEnabled, onPlus, plusEnabled, out _);

        /// <param name="valueLabel">가운데 값 글자 (값만 바꿔 쓸 때).</param>
        public static RectTransform Stepper(Transform row, string value, Action onMinus, bool minusEnabled, Action onPlus, bool plusEnabled, out Text valueLabel)
        {
            var stepper = UI.Rect(row, "stepper");
            UI.Size(stepper, height: 44, width: 152);
            var minus = UI.TextButton(stepper, "−", onMinus, ButtonKind.Outline, 44, 20, 44);
            PlaceInStepper(minus, 0, 44);
            UI.SetEnabled(minus, minusEnabled, 0.3f);
            var label = UI.Label(stepper, value, 15, Theme.Text, true, TextAnchor.MiddleCenter, false, false);
            PlaceInStepper(label, 44, 64);
            valueLabel = label;
            var plus = UI.TextButton(stepper, "+", onPlus, ButtonKind.Outline, 44, 20, 44);
            PlaceInStepper(plus, 108, 44);
            UI.SetEnabled(plus, plusEnabled, 0.3f);
            return stepper;
        }

        private static void PlaceInStepper(Component c, float x, float width)
        {
            var rt = (RectTransform)c.transform;
            rt.anchorMin = new Vector2(0, 0);
            rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0, 0.5f);
            rt.sizeDelta = new Vector2(width, 0);
            rt.anchoredPosition = new Vector2(x, 0);
        }

        /// <summary>
        /// 능력치 배분 한 줄 (캐릭터 화면·던전 레벨 업 창 공통): 아이콘 · 이름과 배분 현황(45/99, 최대면 금색 '최대') ·
        /// 효과(두 줄까지) · 고정 폭 − 값 + . 값 칸은 최대 능력치(세 자리)와 대기 중 +N이 들어가는 폭.
        /// </summary>
        public static void StatRow(Transform parent, Character c, Stat stat, AllocationDraft draft, Action onMinus, Action onPlus, bool line)
        {
            int pending = draft.Pending(stat);
            int own = c.BaseStats[stat] + pending, cap = GameBalance.MaxStat(stat);
            var row = UI.Row(parent, 8);
            UI.Size(row, height: 60);
            UI.Icon(row, UI.StatIcon(stat), 24);
            var col = UI.Column(row, 1);
            UI.Size(col, flexW: 1);
            string progress = own >= cap ? UI.Color(" 최대", Theme.GoldHex) : UI.Color(" " + own + "/" + cap, Theme.SubHex);
            UI.Label(col, Names.Of(stat) + "<size=12>" + progress + "</size>", 14, Theme.Text, true);
            var effect = UI.Label(col, CharacterStats.EffectLabel(c, stat), 11, Theme.TextSub);
            effect.horizontalOverflow = HorizontalWrapMode.Wrap;
            Stepper(row, CharacterStats.Total(c, stat) + (pending > 0 ? UI.Color(" +" + pending, Theme.GoldHex) : ""),
                onMinus, pending > 0, onPlus, draft.CanAdd(stat));
            if (line) BottomLine(row, Theme.LineSoft);
        }

        /// <summary>방 안에서 하는 행동 (거래·이벤트 선택 등): 이동(금색·푸른색)·귀환(초록)과 구분되는 보라색.</summary>
        public static RectTransform ActionButton(Transform parent, string title, string sub, string right, bool rightIsPercent, Action onClick, bool enabled = true, float minHeight = 60)
        {
            var b = UI.ButtonCard(parent, onClick, Theme.ActionBg, Theme.ActionBorder, 12, UI.Pad(14, 8), false, 10, minHeight, TextAnchor.MiddleLeft);
            var left = UI.Column(b, 2, null, TextAnchor.MiddleLeft);
            UI.Size(left, flexW: 1);
            UI.Label(left, title, 15, Theme.ActionText, true);
            if (!string.IsNullOrEmpty(sub)) UI.Label(left, sub, 12, Theme.ActionSub);
            if (!string.IsNullOrEmpty(right))
                UI.Label(b, right, rightIsPercent ? 14 : 13, rightIsPercent ? Theme.Gold : Theme.ActionSub, rightIsPercent, TextAnchor.MiddleRight, false, false);
            if (!enabled) UI.SetEnabled(b, false);
            return b;
        }

        /// <summary>던전의 길 선택 버튼 (금색 테두리, 제목 + 작은 설명).</summary>
        public static RectTransform GoButton(Transform parent, string title, string sub, Action onClick, bool enabled = true)
        {
            var b = UI.ButtonCard(parent, onClick, Theme.AccentBg, Theme.Accent, 12, UI.Pad(14, 8), true, 2, 60, TextAnchor.MiddleLeft);
            UI.Label(b, title, 15, Theme.Text, true);
            if (!string.IsNullOrEmpty(sub)) UI.Sub(b, sub);
            if (!enabled) UI.SetEnabled(b, false);
            return b;
        }

        /// <summary>전투·이벤트 선택지: 왼쪽 글자, 오른쪽 성공 확률 또는 안내.</summary>
        public static RectTransform ChoiceButton(Transform parent, string label, string sub, string right, bool rightIsPercent, Action onClick, bool enabled, float minHeight = 50)
        {
            var b = UI.ButtonCard(parent, onClick, Theme.Button, Theme.ButtonBorder, 10, UI.Pad(14, 6), false, 10, minHeight);
            var left = UI.Column(b, 2, null, TextAnchor.MiddleLeft);
            UI.Size(left, flexW: 1);
            UI.Label(left, label, 15, Theme.Text, true);
            if (!string.IsNullOrEmpty(sub)) UI.Sub(left, sub);
            if (!string.IsNullOrEmpty(right))
                UI.Label(b, right, rightIsPercent ? 14 : 13, rightIsPercent ? Theme.Gold : Theme.TextSub, rightIsPercent, TextAnchor.MiddleRight, false, false);
            if (!enabled) UI.SetEnabled(b, false);
            return b;
        }

        /// <summary>착용 중인 장비와 비교 (+초록 / −빨강). 비교할 것이 없으면 빈 문자열.</summary>
        public static string CompareText(Character c, ItemInstance item, bool withLabel = true)
        {
            var list = EquipmentSystem.Compare(c, item);
            if (list.Count == 0) return "";
            var parts = new System.Collections.Generic.List<string>();
            foreach (var d in list)
            {
                string v = d.Delta > 0 ? "+" + d.Delta : d.Delta < 0 ? "−" + (-d.Delta) : "±0";
                string hex = d.Delta > 0 ? Theme.GreenHex : d.Delta < 0 ? Theme.RedHex : Theme.SubHex;
                parts.Add(UI.Color((withLabel ? d.Label + " " : "") + v, hex));
            }
            return string.Join(" ", parts);
        }

        /// <summary>장비 상세에 넣는 비교 줄: "착용 중 강철 장검 대비 공격력 +5".</summary>
        public static void CompareLine(Transform parent, Character c, ItemInstance item)
        {
            if (item == null || item.Kind != ItemKind.Equipment || c.Equipment.Find(item.Uid) != null) return;
            var cur = EquipmentSystem.ReplacedBy(c, item);
            string head = cur == null ? Names.Of(item.Gear) + " 칸 비어 있음 · " : "착용 중 " + cur.DisplayName + " 대비 ";
            UI.Label(parent, UI.Color(head, Theme.SubHex) + CompareText(c, item), 13, Theme.Text);
        }

        public static string Percent(double p) => Mathf.RoundToInt((float)(p * 100)) + "%";

        /// <summary>
        /// 시설 화면 공통: 일러스트 + 그 아래쪽 안에 겹친 대사 상자 (수정 사항 #5).
        /// 아래쪽 어두운 그라데이션 위에 검은 반투명 상자, 금색 1px 테두리, 왼쪽 위 이름표, 최대 3줄.
        /// 반환값은 본문 글자 (Typewriter가 붙어 있다).
        /// </summary>
        public static Text NpcIllustration(Transform parent, string illustration, string line, float height)
        {
            var holder = UI.Rect(parent, "npc");
            UI.Size(holder, height: height);
            var ill = UI.Illustration(holder, illustration, height);
            UI.Stretch(ill);
            ill.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;

            var shade = UI.Image(holder, new Color(0.04f, 0.04f, 0.06f, 0.92f), 0, "shade");
            shade.sprite = Sprites.GradientUp;
            var srt = shade.rectTransform;
            srt.anchorMin = new Vector2(0, 0);
            srt.anchorMax = new Vector2(1, 0);
            srt.pivot = new Vector2(0.5f, 0);
            srt.sizeDelta = new Vector2(0, height * 0.45f);
            srt.anchoredPosition = Vector2.zero;
            if (string.IsNullOrEmpty(line)) return null;
            return DialogueBox(holder, line, height * 0.3f);
        }

        /// <summary>일러스트 아래쪽 안쪽의 대사 상자. 누르면 한 글자씩 나오던 대사가 바로 완성된다.</summary>
        public static Text DialogueBox(RectTransform holder, string line, float maxHeight)
        {
            const float margin = 12;
            float textSize = 15 * GameSettings.TextScale;
            float lineH = textSize * 1.6f;
            float boxH = Mathf.Min(Mathf.Max(maxHeight, lineH * 2 + 24), lineH * 3 + 24);

            var box = UI.Rect(holder, "dialogue");
            box.anchorMin = new Vector2(0, 0);
            box.anchorMax = new Vector2(1, 0);
            box.pivot = new Vector2(0.5f, 0);
            box.offsetMin = new Vector2(margin, margin);
            box.offsetMax = new Vector2(-margin, margin + boxH);
            var fill = box.gameObject.AddComponent<Image>();
            fill.sprite = Sprites.Rounded;
            fill.type = Image.Type.Sliced;
            fill.pixelsPerUnitMultiplier = Sprites.MultiplierFor(10);
            fill.color = new Color(0, 0, 0, 0.76f);
            fill.raycastTarget = true;
            box.gameObject.AddComponent<TypewriterSkip>();
            var border = UI.Image(box, Theme.Gold, 0, "border");
            border.sprite = Sprites.RoundedOutline;
            border.type = Image.Type.Sliced;
            border.pixelsPerUnitMultiplier = Sprites.MultiplierFor(10) * 1.2f;
            UI.Stretch(border.rectTransform);

            var body = UI.Label(box, line, 15, Theme.Text);
            body.lineSpacing = 1.45f;
            body.alignment = TextAnchor.UpperLeft;
            body.verticalOverflow = VerticalWrapMode.Truncate;
            UI.Stretch(body.rectTransform, 14, 12, 14, 8);
            Typewriter.Attach(body);

            return body;
        }

        /// <summary>탭 줄. 선택된 탭은 금색 + 밑줄.</summary>
        public static void Tabs(Transform parent, string[] labels, int active, Action<int> onSelect)
        {
            var row = UI.Row(parent, 0, UI.Pad(16, 0), TextAnchor.MiddleCenter, "tabs");
            row.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth = true;
            UI.Size(row, height: 44);
            for (int i = 0; i < labels.Length; i++)
            {
                int idx = i;
                var tab = UI.ButtonCard(row, () => onSelect(idx), Theme.Bg, Theme.Bg, 0.01f, UI.Pad(0), false, 0, 44, TextAnchor.MiddleCenter);
                UI.Size(tab, width: 0, flexW: 1); // 탭을 같은 폭으로
                UI.Label(tab, labels[i], 14, i == active ? Theme.Gold : Theme.TextSub, i == active, TextAnchor.MiddleCenter);
                if (i == active) BottomLine(tab, Theme.Accent);
                Anchors.Set("tab." + i, tab);
            }
            Anchors.Set("tabs", row);
            BottomLine(row);
        }
    }
}

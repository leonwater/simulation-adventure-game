using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    public enum ButtonKind
    {
        Primary,   // 금색 채움 (모험 시작, 확정)
        Secondary, // 어두운 채움 + 테두리
        Outline,   // 금색 테두리 (수주, 즉시 갱신)
        Ghost      // 투명 + 테두리 (이어하기)
    }

    /// <summary>
    /// 코드로 uGUI를 만드는 도구 모음. 화면 폭은 항상 390 (CanvasScaler가 폭 기준으로 맞춤).
    /// </summary>
    public static class UI
    {
        // ── 기본 ───────────────────────────────────────────────

        public static RectTransform Rect(Transform parent, string name = "rect")
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            return rt;
        }

        public static RectTransform Stretch(RectTransform rt, float left = 0, float top = 0, float right = 0, float bottom = 0)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(left, bottom);
            rt.offsetMax = new Vector2(-right, -top);
            return rt;
        }

        public static LayoutElement Size(Component c, float height = -1, float width = -1, float flexH = -1, float flexW = -1, float minH = -1)
        {
            var le = c.GetComponent<LayoutElement>() ?? c.gameObject.AddComponent<LayoutElement>();
            if (height >= 0) le.preferredHeight = height;
            if (minH >= 0) le.minHeight = minH;
            else if (height >= 0) le.minHeight = height;
            if (width >= 0)
            {
                le.preferredWidth = width;
                le.minWidth = width;
            }
            if (flexH >= 0) le.flexibleHeight = flexH;
            if (flexW >= 0) le.flexibleWidth = flexW;
            return le;
        }

        public static Image Image(Transform parent, Color color, float radius = 0, string name = "image")
        {
            var rt = Rect(parent, name);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            if (radius > 0)
            {
                img.sprite = Sprites.Rounded;
                img.type = UnityEngine.UI.Image.Type.Sliced;
                img.pixelsPerUnitMultiplier = Sprites.MultiplierFor(radius);
            }
            img.raycastTarget = false;
            return img;
        }

        // ── 레이아웃 ───────────────────────────────────────────

        public static RectTransform Column(Transform parent, float spacing = 0, RectOffset padding = null, TextAnchor align = TextAnchor.UpperLeft, string name = "column")
        {
            var rt = Rect(parent, name);
            var g = rt.gameObject.AddComponent<VerticalLayoutGroup>();
            Setup(g, spacing, padding, align);
            return rt;
        }

        public static RectTransform Row(Transform parent, float spacing = 0, RectOffset padding = null, TextAnchor align = TextAnchor.MiddleLeft, string name = "row")
        {
            var rt = Rect(parent, name);
            var g = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            Setup(g, spacing, padding, align);
            return rt;
        }

        private static void Setup(HorizontalOrVerticalLayoutGroup g, float spacing, RectOffset padding, TextAnchor align)
        {
            g.spacing = spacing;
            g.padding = padding ?? new RectOffset(0, 0, 0, 0);
            g.childAlignment = align;
            g.childControlWidth = true;
            g.childControlHeight = true;
            g.childForceExpandWidth = false;
            g.childForceExpandHeight = false;
            if (g is VerticalLayoutGroup) g.childForceExpandWidth = true;
        }

        public static RectOffset Pad(int all) => new RectOffset(all, all, all, all);

        public static RectOffset Pad(int horizontal, int vertical) => new RectOffset(horizontal, horizontal, vertical, vertical);

        public static RectOffset Pad(int left, int right, int top, int bottom) => new RectOffset(left, right, top, bottom);

        /// <summary>고정 크기 칸 격자. 폭은 화면 폭 기준으로 계산해 넘긴다.</summary>
        public static RectTransform Grid(Transform parent, int columns, float totalWidth, float cellHeight, float spacing)
        {
            var rt = Rect(parent, "grid");
            var g = rt.gameObject.AddComponent<GridLayoutGroup>();
            float cell = Mathf.Floor((totalWidth - spacing * (columns - 1)) / columns);
            g.cellSize = new Vector2(cell, cellHeight);
            g.spacing = new Vector2(spacing, spacing);
            g.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            g.constraintCount = columns;
            g.childAlignment = TextAnchor.UpperLeft;
            return rt;
        }

        public static RectTransform Spacer(Transform parent, float flexible = 1, float height = 0)
        {
            var rt = Rect(parent, "spacer");
            Size(rt, height: height, flexH: flexible);
            return rt;
        }

        public static RectTransform HSpacer(Transform parent, float flexible = 1)
        {
            var rt = Rect(parent, "hspacer");
            Size(rt, flexW: flexible);
            return rt;
        }

        public static Image Divider(Transform parent, Color? color = null)
        {
            var img = Image(parent, color ?? Theme.LineSoft, 0, "divider");
            Size(img, height: 1);
            return img;
        }

        // ── 글자 ───────────────────────────────────────────────

        public static Text Label(Transform parent, string text, float size = 14, Color? color = null, bool bold = false,
            TextAnchor align = TextAnchor.MiddleLeft, bool serif = false, bool wrap = true)
        {
            var rt = Rect(parent, "label");
            var t = rt.gameObject.AddComponent<Text>();
            t.font = serif ? Theme.Serif : bold ? Theme.SansBold : Theme.Sans;
            t.fontSize = Mathf.RoundToInt(size);
            t.color = color ?? Theme.Text;
            t.alignment = align;
            t.supportRichText = true;
            t.lineSpacing = 1.15f;
            t.horizontalOverflow = wrap ? HorizontalWrapMode.Wrap : HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            t.text = text ?? "";
            return t;
        }

        public static Text Sub(Transform parent, string text, TextAnchor align = TextAnchor.MiddleLeft) =>
            Label(parent, text, 12, Theme.TextSub, false, align);

        public static string Color(string text, string hex) => "<color=" + hex + ">" + text + "</color>";

        public static string Color(string text, Color c) => Color(text, Theme.ToHex(c));

        // ── 카드 · 버튼 ─────────────────────────────────────────

        /// <summary>
        /// 테두리가 있는 둥근 상자. 반환값에 바로 자식을 넣으면 된다 (vertical이면 세로 배치).
        /// </summary>
        public static RectTransform Card(Transform parent, Color fill, Color border, float radius = 12, RectOffset padding = null,
            bool vertical = true, float spacing = 4, TextAnchor align = TextAnchor.UpperLeft, string name = "card")
        {
            var rt = Rect(parent, name);
            var outer = rt.gameObject.AddComponent<Image>();
            outer.sprite = Sprites.Rounded;
            outer.type = UnityEngine.UI.Image.Type.Sliced;
            outer.pixelsPerUnitMultiplier = Sprites.MultiplierFor(radius);
            outer.color = border.a > 0 ? border : fill;
            outer.raycastTarget = false;
            if (border.a > 0 && fill != border)
            {
                var inner = Image(rt, fill, Mathf.Max(1, radius - 1), "fill");
                Stretch(inner.rectTransform, 1, 1, 1, 1);
                inner.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
            }
            HorizontalOrVerticalLayoutGroup g = vertical
                ? (HorizontalOrVerticalLayoutGroup)rt.gameObject.AddComponent<VerticalLayoutGroup>()
                : rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            Setup(g, spacing, padding ?? Pad(14, 12), align);
            return rt;
        }

        /// <summary>카드를 눌리는 버튼으로 만든다.</summary>
        public static Button MakeButton(RectTransform card, Action onClick)
        {
            var target = card.GetComponent<Image>();
            target.raycastTarget = true;
            var btn = card.gameObject.AddComponent<Button>();
            // 눌림 색은 안쪽 채움에 적용해야 잘 보인다 (바깥 이미지는 테두리 역할).
            var fill = card.Find("fill");
            btn.targetGraphic = fill != null ? fill.GetComponent<Image>() : target;
            var colors = btn.colors;
            colors.normalColor = UnityEngine.Color.white;
            colors.highlightedColor = UnityEngine.Color.white;
            colors.pressedColor = new Color(0.78f, 0.78f, 0.78f, 1f);
            colors.selectedColor = UnityEngine.Color.white;
            colors.disabledColor = UnityEngine.Color.white;
            colors.fadeDuration = 0.06f;
            btn.colors = colors;
            btn.navigation = new Navigation { mode = Navigation.Mode.None };
            if (onClick != null) btn.onClick.AddListener(() => onClick());
            return btn;
        }

        public static RectTransform ButtonCard(Transform parent, Action onClick, Color fill, Color border, float radius = 12,
            RectOffset padding = null, bool vertical = false, float spacing = 8, float minHeight = 48, TextAnchor align = TextAnchor.MiddleLeft)
        {
            var card = Card(parent, fill, border, radius, padding, vertical, spacing, align, "button");
            Size(card, minH: Mathf.Max(Theme.MinTouch, minHeight));
            MakeButton(card, onClick);
            return card;
        }

        public static void Colors(ButtonKind kind, out Color fill, out Color border, out Color text)
        {
            switch (kind)
            {
                case ButtonKind.Primary:
                    fill = Theme.Accent; border = Theme.Accent; text = Theme.OnAccent; break;
                case ButtonKind.Outline:
                    fill = Theme.Bg; border = Theme.Accent; text = Theme.Gold; break;
                case ButtonKind.Ghost:
                    fill = Theme.Bg; border = Theme.ButtonBorder; text = Theme.Text; break;
                default:
                    fill = Theme.Button; border = Theme.ButtonBorder; text = Theme.Text; break;
            }
        }

        public static Button TextButton(Transform parent, string label, Action onClick, ButtonKind kind = ButtonKind.Secondary,
            float height = 48, float fontSize = 15, float width = -1)
        {
            Colors(kind, out var fill, out var border, out var textColor);
            var card = Card(parent, fill, border, 10, Pad(14, 0), false, 0, TextAnchor.MiddleCenter, "button");
            var le = Size(card, height: height);
            if (width > 0)
            {
                le.preferredWidth = width;
                le.minWidth = width;
            }
            var t = Label(card, label, fontSize, textColor, kind == ButtonKind.Primary || kind == ButtonKind.Outline, TextAnchor.MiddleCenter);
            Size(t, flexW: 1);
            return MakeButton(card, onClick);
        }

        /// <summary>버튼·카드를 비활성 표시한다 (반투명 + 터치 막기).</summary>
        public static void SetEnabled(Component c, bool enabled, float alpha = 0.5f)
        {
            var group = c.GetComponent<CanvasGroup>() ?? c.gameObject.AddComponent<CanvasGroup>();
            group.alpha = enabled ? 1f : alpha;
            group.interactable = enabled;
            group.blocksRaycasts = enabled;
            var btn = c.GetComponent<Button>();
            if (btn != null) btn.interactable = enabled;
        }

        /// <summary>둥근 테두리 알약 (예: "D 등급", 상태 이상 태그).</summary>
        public static Text Pill(Transform parent, string text, Color border, Color textColor, float size = 12, float radius = 999)
        {
            var card = Card(parent, Theme.Bg, border, Mathf.Min(radius, 10), Pad(8, 3), false, 0, TextAnchor.MiddleCenter, "pill");
            // 가로 배치(Row) 안에 넣으면 글자 폭만큼만 차지한다.
            return Label(card, text, size, textColor, false, TextAnchor.MiddleCenter, false, false);
        }

        // ── 막대 · 스크롤 · 그림 ─────────────────────────────────

        public static RectTransform ProgressBar(Transform parent, float ratio, Color fill, float height = 8, float width = -1)
        {
            var track = Image(parent, Theme.Line, height / 2f, "bar");
            Size(track, height: height, width: width, flexW: width < 0 ? 1 : -1);
            var bar = Image(track.transform, fill, height / 2f, "fill");
            var rt = bar.rectTransform;
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = new Vector2(Mathf.Clamp01(ratio), 1f);
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
            bar.enabled = ratio > 0.001f;
            return track.rectTransform;
        }

        private static readonly Dictionary<string, float> ScrollMemory = new Dictionary<string, float>();

        /// <summary>
        /// 세로 스크롤 영역. 반환값 = 내용(세로 배치)을 넣을 곳. key를 주면 화면을 다시 그려도 스크롤 위치를 기억한다.
        /// </summary>
        public static RectTransform Scroll(Transform parent, out ScrollRect scroll, float spacing = 8, RectOffset padding = null,
            string key = null, float flexible = 1, float height = -1)
        {
            var root = Rect(parent, "scroll");
            Size(root, height: height >= 0 ? height : 0, flexH: height >= 0 ? -1 : flexible, minH: height >= 0 ? height : 0);
            scroll = root.gameObject.AddComponent<ScrollRect>();
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 30f;
            scroll.inertia = true;
            scroll.decelerationRate = 0.12f;

            var hit = root.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0); // 빈 곳을 끌어도 스크롤되도록

            var viewport = Rect(root, "viewport");
            Stretch(viewport);
            viewport.gameObject.AddComponent<RectMask2D>();
            scroll.viewport = viewport;

            var content = Rect(viewport, "content");
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = Vector2.zero;
            content.offsetMax = Vector2.zero;
            var g = content.gameObject.AddComponent<VerticalLayoutGroup>();
            Setup(g, spacing, padding, TextAnchor.UpperLeft);
            var fit = content.gameObject.AddComponent<ContentSizeFitter>();
            fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            scroll.content = content;

            if (key != null)
            {
                if (ScrollMemory.TryGetValue(key, out float y)) content.anchoredPosition = new Vector2(0, y);
                scroll.onValueChanged.AddListener(_ => ScrollMemory[key] = content.anchoredPosition.y);
            }
            return content;
        }

        public static void ForgetScroll(string key) => ScrollMemory.Remove(key);

        /// <summary>
        /// 일러스트 자리. Resources/Illustrations/&lt;key&gt; 이미지가 있으면 그 그림을, 없으면 시안처럼 점선 상자를 보여 준다.
        /// </summary>
        public static RectTransform Illustration(Transform parent, string key, float height, float radius = 0)
        {
            var art = IllustrationArt.Find(key);
            var tex = art == null ? null : Resources.Load<Texture2D>("Illustrations/" + art.File);
            if (tex != null)
            {
                var rt = Rect(parent, "illustration");
                Size(rt, height: height);
                var raw = rt.gameObject.AddComponent<RawImage>();
                raw.texture = tex;
                raw.raycastTarget = false;
                var cover = rt.gameObject.AddComponent<CoverImage>();
                cover.Focus = new Vector2(art.FocusX, art.FocusY);
                return rt;
            }
            var box = Card(parent, Theme.Placeholder, radius > 0 ? Theme.PlaceholderLine : Theme.Placeholder, Mathf.Max(radius, 0.01f), Pad(0), true, 0, TextAnchor.MiddleCenter, "illustration");
            Size(box, height: height);
            Label(box, "[일러스트: " + key + "]", 13, Theme.PlaceholderText, false, TextAnchor.MiddleCenter);
            if (radius <= 0)
            {
                var line = Image(box, Theme.PlaceholderLine, 0, "line");
                line.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
                var lrt = line.rectTransform;
                lrt.anchorMin = new Vector2(0, 0);
                lrt.anchorMax = new Vector2(1, 0);
                lrt.sizeDelta = new Vector2(0, 1);
                lrt.anchoredPosition = Vector2.zero;
            }
            return box;
        }

        public static void Clear(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(t.GetChild(i).gameObject);
        }
    }
}

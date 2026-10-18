using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>튜토리얼이 가리킬 화면 요소 (화면을 다시 그릴 때마다 새로 등록된다).</summary>
    public static class Anchors
    {
        private static readonly Dictionary<string, RectTransform> Map = new Dictionary<string, RectTransform>();

        public static void Set(string key, Component c)
        {
            if (c != null) Map[key] = (RectTransform)c.transform;
        }

        public static RectTransform Get(string key) => key != null && Map.TryGetValue(key, out var rt) && rt != null ? rt : null;

        public static void Clear() => Map.Clear();
    }

    /// <summary>
    /// 코치 마크: 화면의 한 곳만 밝게 남기고 나머지를 어둡게 덮은 뒤 말풍선으로 설명한다 (수정 사항 #3).
    /// - 설명(Info): "다음"을 누르면 넘어간다. 가리킨 곳은 눌리지 않는다.
    /// - 행동(Action): 가리킨 곳만 눌린다. 플레이어가 직접 눌러야 다음으로 진행한다.
    /// 말풍선은 가리킨 곳이 화면 위쪽이면 그 아래에, 아래쪽이면 그 위에 놓아 가리지 않게 한다.
    /// </summary>
    public static class Coach
    {
        private static RectTransform _layer;
        private static GameObject _current;
        private static int _token;

        public static void Init(RectTransform layer) => _layer = layer;

        public static bool Active => _current != null;

        public static void Clear()
        {
            _token++;
            if (_current != null) UnityEngine.Object.Destroy(_current);
            _current = null;
        }

        public static void Info(RectTransform target, string title, string text, Action onNext, Action onSkip = null) =>
            Show(target, title, text, false, onNext, onSkip);

        public static void Action(RectTransform target, string text, Action onSkip = null) =>
            Show(target, "직접 해 보기", text, true, null, onSkip);

        private static void Show(RectTransform target, string title, string text, bool action, Action onNext, Action onSkip)
        {
            Clear();
            if (_layer == null) return;
            int token = _token;
            // 레이아웃이 계산된 뒤(다음 프레임)에 위치를 잰다
            var holder = UI.Rect(_layer, "coach");
            UI.Stretch(holder);
            _current = holder.gameObject;
            Delay.Run(holder, 0.05f, () =>
            {
                if (token != _token) return;
                Canvas.ForceUpdateCanvases();
                if (target != null && ScrollIntoView(target)) Canvas.ForceUpdateCanvases();
                Build(holder, target, title, text, action, onNext, onSkip);
            });
        }

        /// <summary>스크롤 목록 안에 있으면 보이도록 스크롤한다. 움직였으면 true.</summary>
        private static bool ScrollIntoView(RectTransform target)
        {
            var scroll = target.GetComponentInParent<ScrollRect>();
            if (scroll == null || scroll.content == null || scroll.viewport == null) return false;
            var view = scroll.viewport;
            var content = scroll.content;
            Rect vr = RectIn(view, view), tr = RectIn(target, view);
            float shift = 0;
            if (tr.yMin < vr.yMin + 12) shift = vr.yMin + 12 - tr.yMin;            // 아래로 숨음 → 내용을 위로
            if (tr.yMax > vr.yMax - 12) shift = vr.yMax - 12 - tr.yMax;            // 위로 숨음 → 내용을 아래로
            if (Mathf.Abs(shift) < 1) return false;
            float max = Mathf.Max(0, content.rect.height - view.rect.height);
            var pos = content.anchoredPosition;
            pos.y = Mathf.Clamp(pos.y + shift, 0, max);
            content.anchoredPosition = pos;
            return true;
        }

        /// <summary>rt의 사각형을 space의 로컬 좌표로.</summary>
        private static Rect RectIn(RectTransform rt, RectTransform space)
        {
            var c = new Vector3[4];
            rt.GetWorldCorners(c);
            Vector2 a = space.InverseTransformPoint(c[0]), b = space.InverseTransformPoint(c[2]);
            return Rect.MinMaxRect(Mathf.Min(a.x, b.x), Mathf.Min(a.y, b.y), Mathf.Max(a.x, b.x), Mathf.Max(a.y, b.y));
        }

        private static void Build(RectTransform holder, RectTransform target, string title, string text, bool action, Action onNext, Action onSkip)
        {
            var area = holder.rect;
            var dim = new Color(0, 0, 0, 0.68f);
            Action next = () =>
            {
                Clear();
                onNext?.Invoke();
            };
            Rect hole = Rect.zero;
            bool hasHole = target != null && target.gameObject.activeInHierarchy;
            if (hasHole)
            {
                hole = RectIn(target, holder);
                hole = Rect.MinMaxRect(hole.xMin - 4, hole.yMin - 4, hole.xMax + 4, hole.yMax + 4);
                // 구멍 둘레 네 장으로 나머지를 덮는다 (행동 단계에서는 구멍만 눌린다)
                Block(holder, Rect.MinMaxRect(area.xMin, hole.yMax, area.xMax, area.yMax), dim, action ? null : next);
                Block(holder, Rect.MinMaxRect(area.xMin, area.yMin, area.xMax, hole.yMin), dim, action ? null : next);
                Block(holder, Rect.MinMaxRect(area.xMin, hole.yMin, hole.xMin, hole.yMax), dim, action ? null : next);
                Block(holder, Rect.MinMaxRect(hole.xMax, hole.yMin, area.xMax, hole.yMax), dim, action ? null : next);
                if (!action) Block(holder, hole, new Color(0, 0, 0, 0), next);
                else
                {
                    // 구멍으로 목록을 끌면 다른 버튼이 구멍 아래로 오므로 스크롤을 잠근다 (코치가 사라지면 화면을 다시 그려 풀린다)
                    var scroll = target.GetComponentInParent<ScrollRect>();
                    if (scroll != null) scroll.enabled = false;
                }
                var frame = UI.Image(holder, Theme.Gold, 0, "frame");
                frame.sprite = Sprites.RoundedOutline;
                frame.type = Image.Type.Sliced;
                frame.pixelsPerUnitMultiplier = Sprites.MultiplierFor(10) * 0.6f;
                PlaceRect(frame.rectTransform, Rect.MinMaxRect(hole.xMin - 2, hole.yMin - 2, hole.xMax + 2, hole.yMax + 2));
                frame.gameObject.AddComponent<Blink>().Period = 1.2f;
            }
            else Block(holder, area, dim, action ? null : next);

            // 말풍선
            var bubble = UI.Card(holder, Theme.Dialog, Theme.Gold, 12, UI.Pad(16, 14), true, 8, TextAnchor.UpperLeft, "bubble");
            bubble.GetComponent<Image>().raycastTarget = true;
            bubble.gameObject.AddComponent<ClickBlocker>();
            bubble.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            bubble.anchorMin = bubble.anchorMax = new Vector2(0.5f, 0.5f);
            float width = area.width - 32;
            bubble.sizeDelta = new Vector2(width, 0);
            UI.Label(bubble, title, 13, Theme.Gold, true);
            var body = UI.Label(bubble, text, 15, Theme.Text);
            body.lineSpacing = 1.35f;
            // 가리킨 곳이 위쪽이면 말풍선을 아래에, 아래쪽이면 위에 둔다
            const float gap = 14, estimate = 170;
            float spaceBelow = hasHole ? hole.yMin - area.yMin : 0, spaceAbove = hasHole ? area.yMax - hole.yMax : 0;
            bool below = hasHole && spaceBelow >= estimate + gap && (spaceBelow >= spaceAbove || spaceAbove < estimate + gap);
            bool above = hasHole && !below && spaceAbove >= estimate + gap;
            var row = UI.Row(bubble, 8, null, TextAnchor.MiddleRight);
            if (onSkip != null)
            {
                var skip = UI.TextButton(row, "튜토리얼 건너뛰기", () =>
                {
                    Clear();
                    onSkip();
                }, ButtonKind.Ghost, 40, 12, 132);
            }
            UI.HSpacer(row);
            if (action) UI.Label(row, (above ? "▼" : "▲") + " 표시된 곳을 누르세요", 12, Theme.Gold, true, TextAnchor.MiddleRight, false, false);
            else UI.TextButton(row, "다음", next, ButtonKind.Primary, 40, 14, 88);

            float x = area.center.x;
            if (!hasHole)
            {
                bubble.pivot = new Vector2(0.5f, 0.5f);
                bubble.anchoredPosition = new Vector2(x, area.center.y);
                return;
            }
            if (below)
            {
                bubble.pivot = new Vector2(0.5f, 1);
                bubble.anchoredPosition = new Vector2(x, hole.yMin - gap);
            }
            else if (above)
            {
                bubble.pivot = new Vector2(0.5f, 0);
                bubble.anchoredPosition = new Vector2(x, hole.yMax + gap);
            }
            else
            {
                // 위아래 모두 좁으면(큰 영역) 화면 아래쪽에 겹쳐 둔다
                bubble.pivot = new Vector2(0.5f, 0);
                bubble.anchoredPosition = new Vector2(x, area.yMin + 16);
            }
        }

        private static void Block(RectTransform holder, Rect r, Color color, Action onTap)
        {
            if (r.width <= 0 || r.height <= 0) return;
            var img = UI.Image(holder, color, 0, "dim");
            img.raycastTarget = true;
            PlaceRect(img.rectTransform, r);
            if (onTap == null) return;
            var btn = img.gameObject.AddComponent<Button>();
            btn.transition = Selectable.Transition.None;
            btn.onClick.AddListener(() => onTap());
        }

        private static void PlaceRect(RectTransform rt, Rect r)
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = Vector2.zero;
            rt.anchoredPosition = r.min;
            rt.sizeDelta = r.size;
        }
    }
}

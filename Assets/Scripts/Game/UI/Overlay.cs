using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>화면 위 레이어: 알림(토스트)과 팝업(모달). 모두 화면 가운데에 어두운 배경과 함께 뜬다.</summary>
    public class Overlay
    {
        private class Entry
        {
            public GameObject Go;
            /// <summary>뒤로 가기를 눌렀을 때 (null이면 닫지 않고 무시).</summary>
            public Action Back;
        }

        private readonly RectTransform _root;
        private readonly List<Entry> _modals = new List<Entry>();
        private GameObject _toast;

        public Overlay(RectTransform root)
        {
            _root = root;
        }

        public bool HasModal => _modals.Count > 0;

        public void Toast(string message)
        {
            if (string.IsNullOrEmpty(message)) return;
            if (_toast != null) UnityEngine.Object.Destroy(_toast);
            // 터치는 막지 않는 옅은 배경
            var dim = UI.Image(_root, new Color(0, 0, 0, 0.35f), 0, "toast");
            UI.Stretch(dim.rectTransform);
            _toast = dim.gameObject;
            var holder = UI.Rect(dim.transform, "holder");
            holder.anchorMin = new Vector2(0, 0.5f);
            holder.anchorMax = new Vector2(1, 0.5f);
            holder.pivot = new Vector2(0.5f, 0.5f);
            holder.anchoredPosition = Vector2.zero;
            holder.sizeDelta = new Vector2(-48, 0);
            var v = holder.gameObject.AddComponent<VerticalLayoutGroup>();
            v.childAlignment = TextAnchor.MiddleCenter;
            v.childControlHeight = true;
            v.childControlWidth = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            holder.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var card = UI.Card(holder, Theme.Dialog, Theme.ButtonBorder, 12, UI.Pad(18, 14), true, 0, TextAnchor.MiddleCenter);
            UI.Label(card, message, 14, Theme.Text, false, TextAnchor.MiddleCenter);
            dim.gameObject.AddComponent<ToastFade>();
        }

        /// <summary>
        /// 팝업을 연다. tall이면 화면 높이 대부분을 쓰고 내용이 스크롤된다.
        /// dismissable이면 바깥을 누르거나 닫기·뒤로 가기로 닫힌다.
        /// </summary>
        public RectTransform Modal(string title, bool tall = false, bool dismissable = true, Action onClose = null, bool showClose = true)
        {
            var dim = UI.Image(_root, Theme.Dim, 0, "modal");
            UI.Stretch(dim.rectTransform);
            dim.raycastTarget = true;
            var go = dim.gameObject;
            var entry = new Entry { Go = go };
            _modals.Add(entry);
            Action close = () =>
            {
                Close(go);
                onClose?.Invoke();
            };
            if (dismissable)
            {
                entry.Back = close;
                var btn = go.AddComponent<Button>();
                btn.transition = Selectable.Transition.None;
                btn.onClick.AddListener(() => close());
            }

            var card = UI.Card(dim.transform, Theme.Card, Theme.ButtonBorder, 14, UI.Pad(16, 16), true, 12, TextAnchor.UpperLeft, "dialog");
            card.GetComponent<Image>().raycastTarget = true; // 카드 안을 눌러도 닫히지 않게
            card.gameObject.AddComponent<ClickBlocker>();
            var crt = card;
            if (tall)
            {
                crt.anchorMin = new Vector2(0, 0);
                crt.anchorMax = new Vector2(1, 1);
                crt.offsetMin = new Vector2(16, 60);
                crt.offsetMax = new Vector2(-16, -60);
            }
            else
            {
                crt.anchorMin = new Vector2(0, 0.5f);
                crt.anchorMax = new Vector2(1, 0.5f);
                crt.pivot = new Vector2(0.5f, 0.5f);
                crt.sizeDelta = new Vector2(-32, 0);
                card.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            }

            if (!string.IsNullOrEmpty(title))
            {
                var head = UI.Row(card, 8);
                UI.Size(head, minH: 32);
                var t = UI.Label(head, title, 17, Theme.Text, true);
                UI.Size(t, flexW: 1);
                if (dismissable && showClose) CloseButton(head, close);
            }
            if (!tall) return card;
            return UI.Scroll(card, out _, 8);
        }

        /// <summary>작게 보이지만 누르는 범위는 44×44인 닫기 버튼.</summary>
        private static void CloseButton(Transform parent, Action onClick)
        {
            var hit = UI.Rect(parent, "close");
            UI.Size(hit, height: Theme.MinTouch, width: Theme.MinTouch);
            var img = hit.gameObject.AddComponent<Image>();
            img.color = new Color(0, 0, 0, 0);
            var btn = hit.gameObject.AddComponent<Button>();
            btn.transition = Selectable.Transition.None;
            btn.onClick.AddListener(() => onClick());
            var mark = UI.Card(hit, Theme.Bg, Theme.ButtonBorder, 8, UI.Pad(0), false, 0, TextAnchor.MiddleCenter, "mark");
            mark.anchorMin = mark.anchorMax = new Vector2(1, 0.5f);
            mark.pivot = new Vector2(1, 0.5f);
            mark.sizeDelta = new Vector2(28, 28);
            mark.anchoredPosition = Vector2.zero;
            UI.Label(mark, "✕", 12, Theme.TextSub, false, TextAnchor.MiddleCenter);
        }

        /// <summary>가장 위 팝업의 뒤로 가기 동작을 바꾼다.</summary>
        public void SetBack(Action back)
        {
            if (_modals.Count > 0) _modals[_modals.Count - 1].Back = back;
        }

        public void Close(GameObject modal)
        {
            _modals.RemoveAll(e => e.Go == modal);
            if (modal != null) UnityEngine.Object.Destroy(modal);
        }

        /// <summary>뒤로 가기: 가장 위 팝업의 취소 동작을 실행한다. 팝업이 있으면 true.</summary>
        public bool CloseTop()
        {
            if (_modals.Count == 0) return false;
            _modals[_modals.Count - 1].Back?.Invoke();
            return true;
        }

        public void CloseAll()
        {
            foreach (var m in _modals.ToArray()) Close(m.Go);
        }

        /// <summary>확인 팝업: 닫기 버튼 없이 취소·확인만. 바깥을 눌러도 닫히지 않고, 뒤로 가기는 취소.</summary>
        public void Confirm(string title, string message, string ok, Action onOk, string cancel = "취소", ButtonKind okKind = ButtonKind.Primary, Action onCancel = null)
        {
            var body = Modal(title, false, false);
            var modal = Top;
            Action doCancel = () =>
            {
                Close(modal);
                onCancel?.Invoke();
            };
            SetBack(doCancel);
            UI.Label(body, message, 14, Theme.TextBody);
            var row = UI.Row(body, 8);
            var c = UI.TextButton(row, cancel, () => doCancel(), ButtonKind.Ghost);
            UI.Size(c, flexW: 1);
            var o = UI.TextButton(row, ok, () =>
            {
                Close(modal);
                onOk?.Invoke();
            }, okKind);
            UI.Size(o, flexW: 1);
        }

        public void Message(string title, string message, string ok = "확인", Action onOk = null)
        {
            var body = Modal(title, false, onOk == null, onOk);
            var modal = Top;
            Action done = () =>
            {
                Close(modal);
                onOk?.Invoke();
            };
            SetBack(done);
            var text = UI.Label(body, message, 14, Theme.TextBody);
            text.lineSpacing = 1.3f;
            UI.TextButton(body, ok, () => done(), ButtonKind.Primary);
        }

        public GameObject Top => _modals.Count == 0 ? null : _modals[_modals.Count - 1].Go;
    }
}

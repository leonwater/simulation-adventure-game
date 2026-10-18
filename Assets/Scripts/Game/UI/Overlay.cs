using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>화면 위 레이어: 알림(토스트)과 팝업(모달).</summary>
    public class Overlay
    {
        private readonly RectTransform _root;
        private readonly List<GameObject> _modals = new List<GameObject>();

        public Overlay(RectTransform root)
        {
            _root = root;
        }

        public bool HasModal => _modals.Count > 0;

        public void Toast(string message)
        {
            if (string.IsNullOrEmpty(message)) return;
            var holder = UI.Rect(_root, "toast");
            holder.anchorMin = new Vector2(0, 0);
            holder.anchorMax = new Vector2(1, 0);
            holder.pivot = new Vector2(0.5f, 0);
            holder.anchoredPosition = new Vector2(0, 96);
            holder.sizeDelta = new Vector2(-32, 0);
            var v = holder.gameObject.AddComponent<VerticalLayoutGroup>();
            v.childAlignment = TextAnchor.LowerCenter;
            v.childControlHeight = true;
            v.childControlWidth = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            holder.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var card = UI.Card(holder, Theme.Dialog, Theme.ButtonBorder, 12, UI.Pad(16, 12), true, 0, TextAnchor.MiddleCenter);
            UI.Label(card, message, 14, Theme.Text, false, TextAnchor.MiddleCenter);
            holder.gameObject.AddComponent<ToastFade>();
        }

        /// <summary>
        /// 팝업을 연다. tall이면 화면 높이 대부분을 쓰고 내용이 스크롤된다.
        /// 반환값에 내용을 넣는다. 바깥을 누르면 닫힌다(dismissable).
        /// </summary>
        public RectTransform Modal(string title, bool tall = false, bool dismissable = true, Action onClose = null)
        {
            var dim = UI.Image(_root, Theme.Dim, 0, "modal");
            UI.Stretch(dim.rectTransform);
            dim.raycastTarget = true;
            var go = dim.gameObject;
            _modals.Add(go);
            if (dismissable)
            {
                var btn = go.AddComponent<Button>();
                btn.transition = Selectable.Transition.None;
                btn.onClick.AddListener(() =>
                {
                    Close(go);
                    onClose?.Invoke();
                });
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
                var t = UI.Label(head, title, 17, Theme.Text, true);
                UI.Size(t, flexW: 1);
                if (dismissable)
                {
                    var x = UI.TextButton(head, "닫기", () =>
                    {
                        Close(go);
                        onClose?.Invoke();
                    }, ButtonKind.Ghost, 40, 13, 64);
                }
            }
            if (!tall) return card;
            return UI.Scroll(card, out _, 8);
        }

        public void Close(GameObject modal)
        {
            _modals.Remove(modal);
            if (modal != null) UnityEngine.Object.Destroy(modal);
        }

        /// <summary>가장 위의 팝업을 닫는다.</summary>
        public bool CloseTop()
        {
            if (_modals.Count == 0) return false;
            Close(_modals[_modals.Count - 1]);
            return true;
        }

        public void CloseAll()
        {
            foreach (var m in _modals.ToArray()) Close(m);
        }

        public void Confirm(string title, string message, string ok, Action onOk, string cancel = "취소", ButtonKind okKind = ButtonKind.Primary)
        {
            var body = Modal(title);
            var modal = Top;
            UI.Label(body, message, 14, Theme.TextBody);
            var row = UI.Row(body, 8);
            var c = UI.TextButton(row, cancel, () => Close(modal), ButtonKind.Ghost);
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
            UI.Label(body, message, 14, Theme.TextBody);
            UI.TextButton(body, ok, () =>
            {
                Close(modal);
                onOk?.Invoke();
            }, ButtonKind.Primary);
        }

        public GameObject Top => _modals.Count == 0 ? null : _modals[_modals.Count - 1];
    }
}

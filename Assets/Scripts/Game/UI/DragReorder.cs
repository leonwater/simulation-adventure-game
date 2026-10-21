using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 칸을 끌어서 순서를 바꾼다 (v2.4: 장착 스킬 순서). 끄는 동안 반투명한 복사본이 손가락을 따라오고,
    /// 다른 칸 위에서 놓으면 OnMove(원래 칸, 놓은 칸)을 부른다. 짧게 누르면 원래 버튼 동작(상세 창)이 그대로 된다.
    /// </summary>
    public class DragReorder : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        public int Index;
        public List<RectTransform> Cells;
        public Action<int, int> OnMove;

        private RectTransform _ghost;
        private Canvas _canvas;
        private CanvasGroup _group;

        public void OnBeginDrag(PointerEventData e)
        {
            _canvas = GetComponentInParent<Canvas>()?.rootCanvas;
            if (_canvas == null) return;
            _group = gameObject.GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();
            _group.alpha = 0.4f;
            var copy = Instantiate(gameObject, _canvas.transform);
            Destroy(copy.GetComponent<DragReorder>());
            _ghost = (RectTransform)copy.transform;
            _ghost.sizeDelta = ((RectTransform)transform).rect.size;
            var cg = copy.GetComponent<CanvasGroup>() ?? copy.AddComponent<CanvasGroup>();
            cg.alpha = 0.85f;
            cg.blocksRaycasts = false;
            foreach (var le in copy.GetComponents<LayoutElement>()) le.ignoreLayout = true;
            Follow(e);
        }

        public void OnDrag(PointerEventData e) => Follow(e);

        public void OnEndDrag(PointerEventData e)
        {
            if (_group != null) _group.alpha = 1f;
            if (_ghost != null) Destroy(_ghost.gameObject);
            _ghost = null;
            if (Cells == null) return;
            var cam = _canvas != null && _canvas.renderMode != RenderMode.ScreenSpaceOverlay ? _canvas.worldCamera : null;
            for (int i = 0; i < Cells.Count; i++)
            {
                if (i == Index || Cells[i] == null) continue;
                if (RectTransformUtility.RectangleContainsScreenPoint(Cells[i], e.position, cam))
                {
                    OnMove?.Invoke(Index, i);
                    return;
                }
            }
        }

        private void Follow(PointerEventData e)
        {
            if (_ghost == null || _canvas == null) return;
            var cam = _canvas.renderMode != RenderMode.ScreenSpaceOverlay ? _canvas.worldCamera : null;
            if (RectTransformUtility.ScreenPointToWorldPointInRectangle((RectTransform)_canvas.transform, e.position, cam, out var world))
                _ghost.position = world;
        }
    }
}

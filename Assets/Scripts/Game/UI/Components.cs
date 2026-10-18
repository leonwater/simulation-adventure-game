using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>깜빡임 (미니맵의 "갈 수 있는 방").</summary>
    public class Blink : MonoBehaviour
    {
        public float Period = 1.2f;
        private Graphic[] _graphics;

        private void Awake()
        {
            _graphics = GetComponentsInChildren<Graphic>(true);
        }

        private void Update()
        {
            float a = Mathf.Lerp(0.3f, 1f, (Mathf.Cos(Time.unscaledTime * Mathf.PI * 2f / Period) + 1f) * 0.5f);
            foreach (var g in _graphics)
            {
                if (g == null) continue;
                var c = g.color;
                c.a = a;
                g.color = c;
            }
        }
    }

    /// <summary>노치·홈 표시줄을 피하도록 Screen.safeArea에 맞춘다.</summary>
    [RequireComponent(typeof(RectTransform))]
    public class SafeArea : MonoBehaviour
    {
        private Rect _applied;
        private Vector2Int _screen;

        private void OnEnable() => Apply();

        private void Update()
        {
            if (Screen.safeArea != _applied || _screen.x != Screen.width || _screen.y != Screen.height) Apply();
        }

        private void Apply()
        {
            var rt = (RectTransform)transform;
            var safe = Screen.safeArea;
            _applied = safe;
            _screen = new Vector2Int(Screen.width, Screen.height);
            if (Screen.width <= 0 || Screen.height <= 0) return;
            var min = safe.position;
            var max = safe.position + safe.size;
            min.x /= Screen.width;
            min.y /= Screen.height;
            max.x /= Screen.width;
            max.y /= Screen.height;
            rt.anchorMin = min;
            rt.anchorMax = max;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }
    }

    /// <summary>잠깐 보였다가 사라지는 알림.</summary>
    public class ToastFade : MonoBehaviour
    {
        public float Life = 2.2f;
        private float _t;
        private CanvasGroup _group;

        private void Awake()
        {
            _group = gameObject.AddComponent<CanvasGroup>();
        }

        private void Update()
        {
            _t += Time.unscaledDeltaTime;
            _group.alpha = _t < Life - 0.4f ? 1f : Mathf.Clamp01((Life - _t) / 0.4f);
            if (_t >= Life) Destroy(gameObject);
        }
    }

    /// <summary>화면이 매 프레임 할 일 (타이머 갱신 등)을 연결한다.</summary>
    public class Ticker : MonoBehaviour
    {
        public System.Action OnTick;
        public float Interval = 0.5f;
        private float _t;

        private void Update()
        {
            _t += Time.unscaledDeltaTime;
            if (_t < Interval) return;
            _t = 0;
            OnTick?.Invoke();
        }
    }
}

namespace Adventure.Game
{
    /// <summary>팝업 카드 안을 눌렀을 때 뒤의 "바깥 누르면 닫기"까지 전달되지 않게 막는다.</summary>
    public class ClickBlocker : MonoBehaviour, IPointerClickHandler
    {
        public void OnPointerClick(PointerEventData eventData) { }
    }
}

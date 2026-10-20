using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>깜빡임 (미니맵의 "갈 수 있는 방", 1턴 남은 상태 이상 아이콘).</summary>
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

    /// <summary>
    /// 모든 화면 비율 대응 (v1.8). 노치·홈 표시줄을 피한 안전 영역 안에 폭 390 기둥을 두고 배율을 직접 정한다.
    /// 배율 = min(안전 영역 폭 / 390, 안전 영역 높이 / 700):
    /// - 휴대폰 16:9 ~ 21:9 (20:9·19.5:9 대부분)는 폭에 맞춰 화면을 가득 채우고, 세로가 길수록 목록이 길어진다.
    /// - 폴더블 펼친 화면·태블릿처럼 넓은 화면은 높이 700에 맞추고 가운데 390 기둥 (양옆은 바탕색).
    /// 접거나 펴서 화면이 바뀌면 다시 맞추고 지금 화면을 새로 그린다.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public class ScreenFit : MonoBehaviour
    {
        /// <summary>모든 화면이 들어가도록 보장하는 최소 논리 높이.</summary>
        public const float MinHeight = 700f;

        /// <summary>기둥의 논리 높이 (화면 구성에서 일러스트 높이 등을 정할 때).</summary>
        public static float Height { get; private set; } = Theme.ScreenHeight;

        public CanvasScaler Scaler;
        public RectTransform Column;
        private Rect _applied;
        private Vector2Int _screen;

        private void Update()
        {
            if (Screen.safeArea == _applied && _screen.x == Screen.width && _screen.y == Screen.height) return;
            Apply();
            GameApp.Instance?.Router?.Rebuild();
        }

        /// <summary>지금 화면에 맞춘다 (캔버스를 만든 직후 한 번, 그 뒤로는 화면이 바뀔 때마다).</summary>
        public void Apply()
        {
            _applied = Screen.safeArea;
            _screen = new Vector2Int(Screen.width, Screen.height);
            if (Screen.width <= 0 || Screen.height <= 0) return;
            var safe = _applied.width > 0 && _applied.height > 0 ? _applied : new Rect(0, 0, Screen.width, Screen.height);
            float scale = Mathf.Min(safe.width / Theme.ScreenWidth, safe.height / MinHeight);
            if (Scaler != null) Scaler.scaleFactor = scale;
            Height = safe.height / scale;

            var rt = (RectTransform)transform;
            rt.anchorMin = new Vector2(safe.xMin / Screen.width, safe.yMin / Screen.height);
            rt.anchorMax = new Vector2(safe.xMax / Screen.width, safe.yMax / Screen.height);
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
            if (Column == null) return;
            Column.anchorMin = new Vector2(0.5f, 0);
            Column.anchorMax = new Vector2(0.5f, 1);
            Column.pivot = new Vector2(0.5f, 0.5f);
            Column.sizeDelta = new Vector2(Theme.ScreenWidth, 0);
            Column.anchoredPosition = Vector2.zero;
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

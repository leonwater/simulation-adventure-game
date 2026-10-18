using System;
using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 대사를 한 글자씩 보여 준다. 눌러서 바로 완성, 설정에서 끌 수 있다.
    /// 리치 텍스트 태그는 한 번에 넣고, 잘린 지점에서 열린 태그는 닫아 준다.
    /// </summary>
    [RequireComponent(typeof(Text))]
    public class Typewriter : MonoBehaviour
    {
        public float CharsPerSecond = 40f;
        private Text _text;
        private string _full = "";
        private int _visible, _total;
        private float _t;
        private static string _lastFull;

        public bool Done => _visible >= _total;

        /// <summary>화면을 옮기면 다음 대사는 다시 한 글자씩 나온다.</summary>
        public static void Forget() => _lastFull = null;

        public static Typewriter Attach(Text text)
        {
            var tw = text.gameObject.AddComponent<Typewriter>();
            tw._text = text;
            tw.Play(text.text);
            return tw;
        }

        public void Play(string full)
        {
            if (_text == null) _text = GetComponent<Text>();
            _full = full ?? "";
            _total = VisibleLength(_full);
            _t = 0;
            // 같은 대사로 화면만 다시 그릴 때는 다시 타이핑하지 않는다
            _visible = GameSettings.Typewriter && _full != _lastFull ? 0 : _total;
            _lastFull = _full;
            _text.text = Cut(_full, _visible);
        }

        public void Complete()
        {
            _visible = _total;
            _text.text = _full;
        }

        private void Update()
        {
            if (Done) return;
            _t += Time.unscaledDeltaTime * CharsPerSecond;
            int n = Mathf.Min(_total, (int)_t);
            if (n == _visible) return;
            _visible = n;
            _text.text = Cut(_full, n);
        }

        public static int VisibleLength(string s)
        {
            int n = 0;
            for (int i = 0; i < s.Length; i++)
            {
                if (s[i] == '<')
                {
                    int close = s.IndexOf('>', i);
                    if (close > i)
                    {
                        i = close;
                        continue;
                    }
                }
                n++;
            }
            return n;
        }

        public static string Cut(string s, int visible)
        {
            var sb = new StringBuilder();
            var open = new Stack<string>();
            int n = 0;
            for (int i = 0; i < s.Length && n < visible; i++)
            {
                if (s[i] == '<')
                {
                    int close = s.IndexOf('>', i);
                    if (close > i)
                    {
                        string tag = s.Substring(i, close - i + 1);
                        sb.Append(tag);
                        if (tag.StartsWith("</")) { if (open.Count > 0) open.Pop(); }
                        else
                        {
                            string name = tag.Substring(1, tag.Length - 2);
                            int eq = name.IndexOf('=');
                            open.Push(eq >= 0 ? name.Substring(0, eq) : name);
                        }
                        i = close;
                        continue;
                    }
                }
                sb.Append(s[i]);
                n++;
            }
            while (open.Count > 0) sb.Append("</" + open.Pop() + ">");
            return sb.ToString();
        }
    }

    /// <summary>누르면 안의 Typewriter들을 바로 완성한다.</summary>
    public class TypewriterSkip : MonoBehaviour, IPointerClickHandler
    {
        public void OnPointerClick(PointerEventData eventData)
        {
            foreach (var tw in GetComponentsInChildren<Typewriter>()) tw.Complete();
        }
    }

    /// <summary>길게 누르기 (0.5초). 길게 누른 뒤에는 그 버튼의 일반 클릭을 무시한다.</summary>
    public class LongPress : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        public Action OnLongPress;
        public float Delay = 0.5f;
        private float _down = -1;
        private bool _fired;

        public bool ConsumeFired()
        {
            bool f = _fired;
            _fired = false;
            return f;
        }

        public void OnPointerDown(PointerEventData e)
        {
            _down = Time.unscaledTime;
            _fired = false;
        }

        public void OnPointerUp(PointerEventData e) => _down = -1;

        public void OnPointerExit(PointerEventData e) => _down = -1;

        private void Update()
        {
            if (_down < 0 || Time.unscaledTime - _down < Delay) return;
            _down = -1;
            _fired = true;
            OnLongPress?.Invoke();
        }

        /// <summary>버튼에 길게 누르기를 붙인다. onClick은 길게 누르지 않았을 때만 실행된다.</summary>
        public static void Add(Component target, Action onLongPress, Action onClick)
        {
            var lp = target.gameObject.AddComponent<LongPress>();
            lp.OnLongPress = onLongPress;
            var btn = target.GetComponent<Button>();
            if (btn == null) return;
            btn.onClick.RemoveAllListeners();
            btn.onClick.AddListener(() =>
            {
                if (lp.ConsumeFired()) return;
                onClick?.Invoke();
            });
        }
    }

    /// <summary>잠깐 흔들기 (피격).</summary>
    public class Shake : MonoBehaviour
    {
        public float Duration = 0.3f, Strength = 6f;
        private float _t;
        private Vector2 _origin;
        private RectTransform _rt;

        public static void Play(RectTransform rt, float strength = 6f, float duration = 0.3f)
        {
            if (rt == null) return;
            var s = rt.GetComponent<Shake>();
            if (s == null) s = rt.gameObject.AddComponent<Shake>();
            else rt.anchoredPosition = s._origin;
            s._rt = rt;
            s._origin = rt.anchoredPosition;
            s._t = 0;
            s.Strength = strength;
            s.Duration = duration;
            s.enabled = true;
        }

        private void Update()
        {
            _t += Time.unscaledDeltaTime * GameSettings.BattleSpeed;
            if (_t >= Duration)
            {
                _rt.anchoredPosition = _origin;
                enabled = false;
                return;
            }
            float k = 1f - _t / Duration;
            _rt.anchoredPosition = _origin + new Vector2(Mathf.Sin(_t * 70f) * Strength * k, 0);
        }
    }

    /// <summary>앞으로 돌진했다 돌아오기 (공격).</summary>
    public class Dash : MonoBehaviour
    {
        private float _t, _duration;
        private Vector2 _origin, _offset;
        private RectTransform _rt;

        public static void Play(RectTransform rt, Vector2 offset, float duration = 0.28f)
        {
            if (rt == null) return;
            var d = rt.GetComponent<Dash>();
            if (d == null) d = rt.gameObject.AddComponent<Dash>();
            else rt.anchoredPosition = d._origin;
            d._rt = rt;
            d._origin = rt.anchoredPosition;
            d._offset = offset;
            d._t = 0;
            d._duration = duration;
            d.enabled = true;
        }

        private void Update()
        {
            _t += Time.unscaledDeltaTime * GameSettings.BattleSpeed;
            if (_t >= _duration)
            {
                _rt.anchoredPosition = _origin;
                enabled = false;
                return;
            }
            float k = Mathf.Sin(_t / _duration * Mathf.PI);
            _rt.anchoredPosition = _origin + _offset * k;
        }
    }

    /// <summary>색을 잠깐 바꿨다가 되돌리기 (피격 번쩍임).</summary>
    public class Flash : MonoBehaviour
    {
        private Graphic _g;
        private Color _base, _flash;
        private float _t, _duration;

        public static void Play(Graphic g, Color color, float duration = 0.25f)
        {
            if (g == null) return;
            var f = g.GetComponent<Flash>();
            if (f == null) f = g.gameObject.AddComponent<Flash>();
            else g.color = f._base;
            f._g = g;
            f._base = g.color;
            f._flash = color;
            f._t = 0;
            f._duration = duration;
            f.enabled = true;
        }

        private void Update()
        {
            _t += Time.unscaledDeltaTime * GameSettings.BattleSpeed;
            if (_t >= _duration)
            {
                _g.color = _base;
                enabled = false;
                return;
            }
            _g.color = Color.Lerp(_flash, _base, _t / _duration);
        }
    }

    /// <summary>떠오르며 사라지는 피해 숫자.</summary>
    public class FloatUp : MonoBehaviour
    {
        public float Life = 0.9f, Distance = 36f;
        private float _t;
        private Vector2 _start;
        private CanvasGroup _group;
        private RectTransform _rt;

        private void Awake()
        {
            _rt = (RectTransform)transform;
            _start = _rt.anchoredPosition;
            _group = gameObject.AddComponent<CanvasGroup>();
            _group.blocksRaycasts = false;
        }

        private void Update()
        {
            _t += Time.unscaledDeltaTime * GameSettings.BattleSpeed;
            float k = _t / Life;
            _rt.anchoredPosition = _start + new Vector2(0, Distance * Mathf.Sqrt(Mathf.Clamp01(k)));
            _group.alpha = k < 0.6f ? 1f : Mathf.Clamp01((1f - k) / 0.4f);
            if (_t >= Life) Destroy(gameObject);
        }
    }

    /// <summary>잠깐 보였다 사라지는 큰 제목 (층 진입).</summary>
    public class FadeTitle : MonoBehaviour
    {
        public float Life = 1.2f;
        public Action OnDone;
        private float _t;
        private CanvasGroup _group;

        private void Awake()
        {
            _group = gameObject.AddComponent<CanvasGroup>();
            _group.blocksRaycasts = false;
            _group.alpha = 0;
        }

        private void Update()
        {
            _t += Time.unscaledDeltaTime;
            float fade = 0.25f;
            _group.alpha = _t < fade ? _t / fade : _t > Life - fade ? Mathf.Clamp01((Life - _t) / fade) : 1f;
            if (_t < Life) return;
            OnDone?.Invoke();
            Destroy(gameObject);
        }
    }

    /// <summary>정해진 시간 뒤에 한 번 실행.</summary>
    public class Delay : MonoBehaviour
    {
        private float _left;
        private Action _action;
        private bool _scaled;

        public static Delay Run(Component host, float seconds, Action action, bool battleSpeed = false)
        {
            var d = host.gameObject.AddComponent<Delay>();
            d._left = seconds;
            d._action = action;
            d._scaled = battleSpeed;
            return d;
        }

        private void Update()
        {
            _left -= Time.unscaledDeltaTime * (_scaled ? GameSettings.BattleSpeed : 1);
            if (_left > 0) return;
            enabled = false;
            var a = _action;
            _action = null;
            Destroy(this);
            a?.Invoke();
        }
    }
}

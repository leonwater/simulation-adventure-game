using UnityEngine;

namespace Adventure.Game
{
    /// <summary>기기별 설정 (PlayerPrefs). 저장 파일과 별개라 새 게임을 해도 유지된다.</summary>
    public static class GameSettings
    {
        private const string KeySpeed = "battle_speed", KeyTypewriter = "typewriter", KeyVibration = "vibration", KeyTextSize = "text_size";

        private static int? _speed, _typewriter, _vibration, _textSize;

        /// <summary>전투 연출 속도 1 또는 2.</summary>
        public static int BattleSpeed
        {
            get => Get(ref _speed, KeySpeed, 1) >= 2 ? 2 : 1;
            set => Set(ref _speed, KeySpeed, value >= 2 ? 2 : 1);
        }

        /// <summary>대사 한 글자씩 출력.</summary>
        public static bool Typewriter
        {
            get => Get(ref _typewriter, KeyTypewriter, 1) == 1;
            set => Set(ref _typewriter, KeyTypewriter, value ? 1 : 0);
        }

        public static bool Vibration
        {
            get => Get(ref _vibration, KeyVibration, 1) == 1;
            set => Set(ref _vibration, KeyVibration, value ? 1 : 0);
        }

        /// <summary>글자 크기 0 작게 · 1 보통 · 2 크게.</summary>
        public static int TextSize
        {
            get => Mathf.Clamp(Get(ref _textSize, KeyTextSize, 1), 0, 2);
            set => Set(ref _textSize, KeyTextSize, Mathf.Clamp(value, 0, 2));
        }

        public static readonly string[] TextSizeNames = { "작게", "보통", "크게" };

        public static float TextScale
        {
            get
            {
                switch (TextSize)
                {
                    case 0: return 0.92f;
                    case 2: return 1.12f;
                    default: return 1f;
                }
            }
        }

        private static int Get(ref int? cache, string key, int fallback)
        {
            if (!cache.HasValue) cache = PlayerPrefs.GetInt(key, fallback);
            return cache.Value;
        }

        private static void Set(ref int? cache, string key, int value)
        {
            cache = value;
            PlayerPrefs.SetInt(key, value);
            PlayerPrefs.Save();
        }
    }

    /// <summary>진동 (설정에서 끌 수 있음).</summary>
    public static class Feedback
    {
        private static float _last;

        public static void Vibrate()
        {
            if (!GameSettings.Vibration) return;
            if (Time.unscaledTime - _last < 0.25f) return; // 연달아 울리지 않게
            _last = Time.unscaledTime;
#if (UNITY_ANDROID || UNITY_IOS) && !ADVENTURE_VERIFY // 검증용 참조 DLL에는 Handheld가 없다
            Handheld.Vibrate();
#endif
        }
    }
}

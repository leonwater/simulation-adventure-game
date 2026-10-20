using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>UI 시안의 색상·글꼴·크기.</summary>
    public static class Theme
    {
        public static readonly Color Page = Hex("0F1115");
        public static readonly Color Bg = Hex("14161C");
        public static readonly Color Bar = Hex("181B22");
        public static readonly Color Line = Hex("2A2E38");
        public static readonly Color LineSoft = Hex("262A33");
        public static readonly Color CardBorder = Hex("2F333E");
        public static readonly Color ButtonBorder = Hex("3A3F4B");
        public static readonly Color Card = Hex("1B1E26");
        public static readonly Color Button = Hex("1E222B");
        public static readonly Color Dialog = Hex("20232C");
        public static readonly Color Log = Hex("111318");
        public static readonly Color Placeholder = Hex("1A1D24");
        public static readonly Color PlaceholderLine = Hex("4A5060");
        public static readonly Color PlaceholderText = Hex("8F8C85");
        public static readonly Color MapBg = Hex("191C23");
        public static readonly Color MapNode = Hex("2A2E38");

        public static readonly Color Text = Hex("ECE7DD");
        public static readonly Color TextSub = Hex("A29E95");
        public static readonly Color TextBody = Hex("D8D2C6");
        public static readonly Color TextLog = Hex("C9C3B7");
        public static readonly Color Gold = Hex("E2B657");
        public static readonly Color Accent = Hex("D9A441");
        public static readonly Color AccentBg = Hex("262117");
        public static readonly Color OnAccent = Hex("1A1408");
        public static readonly Color Blue = Hex("6E9BD1");
        public static readonly Color BlueLight = Hex("9EC0E8");
        public static readonly Color BlueText = Hex("7FA8D8");
        public static readonly Color BlueBorder = Hex("3A4A5E");
        public static readonly Color BlueBg = Hex("1A1F28");
        public static readonly Color Red = Hex("C9483E");
        public static readonly Color RedLight = Hex("E38A82");
        public static readonly Color RedBorder = Hex("5A3A38");
        public static readonly Color RedBg = Hex("1F1A1C");
        // 방 안 행동 선택지 (보라): 이동·귀환 선택지와 구분
        public static readonly Color ActionBg = Hex("1E1A2A");
        public static readonly Color ActionBorder = Hex("6A5A9E");
        public static readonly Color ActionText = Hex("D6CCFF");
        public static readonly Color ActionSub = Hex("A89CD6");
        // 귀환 (초록)
        public static readonly Color ReturnBg = Hex("15241F");
        public static readonly Color ReturnBorder = Hex("3F8A68");
        public static readonly Color ReturnText = Hex("9BDDB8");
        public static readonly Color ReturnSub = Hex("72B892");
        public static readonly Color Green = Hex("6FB37A");
        public static readonly Color Orange = Hex("E8954A");

        /// <summary>난이도 글자색: 쉬움 파랑 · 보통 초록 · 어려움 주황 · 하드코어 빨강.</summary>
        public static Color DifficultyColor(Adventure.Core.Difficulty d)
        {
            switch (d)
            {
                case Adventure.Core.Difficulty.Easy: return Blue;
                case Adventure.Core.Difficulty.Hard: return Orange;
                case Adventure.Core.Difficulty.Hardcore: return Red;
                default: return Green;
            }
        }
        public static readonly Color Dim = new Color(0, 0, 0, 0.6f);

        public const string GoldHex = "#E2B657";
        public const string SubHex = "#A29E95";
        public const string RedHex = "#E38A82";
        public const string GreenHex = "#6FB37A";
        public const string BlueHex = "#9EC0E8";

        public const float ScreenWidth = 390f;
        /// <summary>기준 세로 길이 (시안). 실제 높이는 기기마다 다르다 (ScreenFit.Height, 최소 700).</summary>
        public const float ScreenHeight = 844f;
        public const float MinTouch = 44f;

        // 던전 테마 색 (수정 사항 #19): 동굴 청회색 · 묘지 보라 · 용의 둥지 적갈색
        private static readonly Color[] DungeonBgs = { Hex("141A21"), Hex("19151F"), Hex("1F1613") };
        private static readonly Color[] DungeonStages = { Hex("1A222C"), Hex("211B2A"), Hex("2A1D17") };
        private static readonly Color[] DungeonLines = { Hex("5A7088"), Hex("7A6894"), Hex("9A6A4A") };
        private static readonly Color[] DungeonAccents = { Hex("8FB0D0"), Hex("B09CD8"), Hex("E0975E") };

        public static Color DungeonBg(int floor) => DungeonBgs[MonsterDb.ThemeIndex(floor)];
        public static Color DungeonStage(int floor) => DungeonStages[MonsterDb.ThemeIndex(floor)];
        public static Color DungeonLine(int floor) => DungeonLines[MonsterDb.ThemeIndex(floor)];
        public static Color DungeonAccent(int floor) => DungeonAccents[MonsterDb.ThemeIndex(floor)];

        /// <summary>피해 숫자 색 (수정 사항 #21).</summary>
        public static Color DamageColor(DamageKind k)
        {
            switch (k)
            {
                case DamageKind.Crit: return Gold;
                case DamageKind.Poison: return Hex("7BC86F");
                case DamageKind.Bleed: return Hex("E0524A");
                case DamageKind.Burn: return Hex("F0913A");
                case DamageKind.Heal: return Hex("A8E6A0");
                default: return Color.white;
            }
        }

        public static Color GradeColor(ItemGrade g)
        {
            switch (g)
            {
                case ItemGrade.Uncommon: return Green;
                case ItemGrade.Rare: return Blue;
                case ItemGrade.Epic: return Hex("A98BD9");
                case ItemGrade.Legendary: return Hex("E0873A");
                default: return Hex("D9D5CC");
            }
        }

        public static string ToHex(Color c) => "#" + ColorUtility.ToHtmlStringRGB(c);

        public static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString("#" + hex, out var c);
            return c;
        }

        private static Font _sans, _sansBold, _serif;

        public static Font Sans => _sans != null ? _sans : (_sans = LoadFont("Fonts/NanumGothic-Regular"));
        public static Font SansBold => _sansBold != null ? _sansBold : (_sansBold = LoadFont("Fonts/NanumGothic-Bold"));
        public static Font Serif => _serif != null ? _serif : (_serif = LoadFont("Fonts/GowunBatang-Bold"));

        private static Font LoadFont(string path)
        {
            var f = Resources.Load<Font>(path);
            if (f != null) return f;
            // 글꼴을 못 찾으면 기기 글꼴로 대체 (한글 지원 글꼴 우선)
            return Font.CreateDynamicFontFromOSFont(new[] { "Noto Sans CJK KR", "Apple SD Gothic Neo", "Malgun Gothic", "Arial" }, 16);
        }
    }
}

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
        public static readonly Color MapLine = Hex("5A6070");

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
        public static readonly Color Green = Hex("6FB37A");
        public static readonly Color Dim = new Color(0, 0, 0, 0.6f);

        public const string GoldHex = "#E2B657";
        public const string SubHex = "#A29E95";
        public const string RedHex = "#E38A82";
        public const string GreenHex = "#6FB37A";
        public const string BlueHex = "#9EC0E8";

        public const float ScreenWidth = 390f;
        public const float ScreenHeight = 844f;
        public const float MinTouch = 44f;

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

        public static Color ItemColor(ItemInstance item)
        {
            if (item.Kind == ItemKind.Equipment || item.Kind == ItemKind.SkillBook || item.Kind == ItemKind.EnhanceStone)
                return GradeColor(item.Grade);
            return GradeColor(ItemGrade.Common);
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

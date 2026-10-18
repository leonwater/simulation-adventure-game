namespace Adventure.Core
{
    /// <summary>열거형의 한국어 표시 이름.</summary>
    public static class Names
    {
        public static string Of(Stat s)
        {
            switch (s)
            {
                case Stat.Vitality: return "체력";
                case Stat.Spirit: return "정신";
                case Stat.Luck: return "행운";
                case Stat.Strength: return "힘";
                case Stat.Agility: return "민첩";
                case Stat.Intelligence: return "지능";
                case Stat.Toughness: return "강인함";
                case Stat.Precision: return "정밀";
                case Stat.Finesse: return "기교";
                case Stat.SpellPower: return "주문력";
                default: return s.ToString();
            }
        }

        public static string Of(Job j) => JobData.Get(j).Name;

        public static string Of(Rank r) => r.ToString();

        public static string Of(Difficulty d)
        {
            switch (d)
            {
                case Difficulty.Easy: return "쉬움";
                case Difficulty.Normal: return "보통";
                case Difficulty.Hard: return "어려움";
                case Difficulty.Hardcore: return "하드코어";
                default: return d.ToString();
            }
        }

        public static string Of(ItemGrade g)
        {
            switch (g)
            {
                case ItemGrade.Common: return "일반";
                case ItemGrade.Uncommon: return "고급";
                case ItemGrade.Rare: return "희귀";
                case ItemGrade.Epic: return "영웅";
                case ItemGrade.Legendary: return "전설";
                default: return g.ToString();
            }
        }

        public static string Of(GearType g)
        {
            switch (g)
            {
                case GearType.Helmet: return "투구";
                case GearType.Armor: return "갑옷";
                case GearType.Pants: return "바지";
                case GearType.Boots: return "신발";
                case GearType.Necklace: return "목걸이";
                case GearType.Ring: return "반지";
                case GearType.Weapon: return "무기";
                default: return g.ToString();
            }
        }

        public static string Of(EquipSlot s)
        {
            switch (s)
            {
                case EquipSlot.Helmet: return "투구";
                case EquipSlot.Armor: return "갑옷";
                case EquipSlot.Pants: return "바지";
                case EquipSlot.Boots: return "신발";
                case EquipSlot.Necklace: return "목걸이";
                case EquipSlot.Ring1: return "반지 1";
                case EquipSlot.Ring2: return "반지 2";
                case EquipSlot.Weapon: return "무기";
                default: return s.ToString();
            }
        }

        public static string Of(SkillTier t)
        {
            switch (t)
            {
                case SkillTier.Low: return "하급";
                case SkillTier.Mid: return "중급";
                case SkillTier.High: return "상급";
                case SkillTier.Top: return "최상급";
                default: return t.ToString();
            }
        }

        public static string Of(StatusType s)
        {
            switch (s)
            {
                case StatusType.Empower: return "강화";
                case StatusType.Fortify: return "철벽";
                case StatusType.Regen: return "재생";
                case StatusType.Focus: return "집중";
                case StatusType.Swift: return "날렵함";
                case StatusType.Poison: return "독";
                case StatusType.Bleed: return "출혈";
                case StatusType.Burn: return "화상";
                case StatusType.Weaken: return "약화";
                case StatusType.Vulnerable: return "취약";
                case StatusType.Stun: return "기절";
                case StatusType.Silence: return "침묵";
                case StatusType.Blind: return "실명";
                case StatusType.Fear: return "공포";
                default: return s.ToString();
            }
        }

        public static string Of(RoomType r)
        {
            switch (r)
            {
                case RoomType.Start: return "시작";
                case RoomType.Battle: return "전투";
                case RoomType.Event: return "이벤트";
                case RoomType.Treasure: return "보물";
                case RoomType.Rest: return "휴식";
                case RoomType.Merchant: return "상인";
                case RoomType.Return: return "귀환";
                case RoomType.Boss: return "보스";
                default: return r.ToString();
            }
        }

        /// <summary>미니맵 칸에 쓰는 한 글자.</summary>
        public static string ShortOf(RoomType r)
        {
            switch (r)
            {
                case RoomType.Start: return "시";
                case RoomType.Battle: return "전";
                case RoomType.Event: return "이";
                case RoomType.Treasure: return "보";
                case RoomType.Rest: return "휴";
                case RoomType.Merchant: return "상";
                case RoomType.Return: return "귀";
                case RoomType.Boss: return "B";
                default: return "?";
            }
        }

        public static string Gold(long g) => g.ToString("#,0") + " G";

        /// <summary>마지막 글자에 받침이 있는지 (한글이 아니면 읽는 소리 기준으로 대략 판단).</summary>
        public static bool HasBatchim(string word, out bool rieul)
        {
            rieul = false;
            if (string.IsNullOrEmpty(word)) return false;
            char ch = word[word.Length - 1];
            if (ch >= 0xAC00 && ch <= 0xD7A3)
            {
                int jong = (ch - 0xAC00) % 28;
                rieul = jong == 8;
                return jong != 0;
            }
            switch (ch)
            {
                case '0': case '1': case '3': case '6': case '7': case '8':
                    rieul = ch == '1' || ch == '7' || ch == '8';
                    return true;
                case 'L': case 'l':
                    rieul = true;
                    return true;
                case 'M': case 'N': case 'm': case 'n':
                    return true;
                default:
                    return false;
            }
        }

        /// <summary>조사를 붙인다. pair 예: "을/를", "이/가", "은/는", "과/와", "으로/로".</summary>
        public static string Josa(string word, string pair)
        {
            int slash = pair.IndexOf('/');
            string withBatchim = pair.Substring(0, slash), without = pair.Substring(slash + 1);
            bool batchim = HasBatchim(word, out bool rieul);
            if (withBatchim == "으로") return word + (batchim && !rieul ? "으로" : "로");
            return word + (batchim ? withBatchim : without);
        }
    }
}

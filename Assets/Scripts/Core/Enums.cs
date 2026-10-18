namespace Adventure.Core
{
    /// <summary>직업. 게임 시작 시 결정하며 변경 불가.</summary>
    public enum Job
    {
        Warrior,
        Archer,
        Rogue,
        Mage
    }

    /// <summary>능력치 10종. 앞의 3개는 공통, 나머지는 직업 특화.</summary>
    public enum Stat
    {
        Vitality,     // 체력
        Spirit,       // 정신
        Luck,         // 행운
        Strength,     // 힘
        Agility,      // 민첩
        Intelligence, // 지능
        Toughness,    // 강인함
        Precision,    // 정밀
        Vital,        // 급소
        SpellPower    // 주문력
    }

    /// <summary>모험가 등급 F~SS (8단계).</summary>
    public enum Rank
    {
        F,
        E,
        D,
        C,
        B,
        A,
        S,
        SS
    }

    public enum Difficulty
    {
        Easy,
        Normal,
        Hard,
        Hardcore
    }

    /// <summary>아이템 등급 (1차 30층: 5단계).</summary>
    public enum ItemGrade
    {
        Common,    // 일반
        Uncommon,  // 고급
        Rare,      // 희귀
        Epic,      // 영웅
        Legendary  // 전설
    }

    public enum ItemKind
    {
        Equipment,
        Consumable,
        Material,
        SkillBook,
        EnhanceStone
    }

    /// <summary>장비 종류. 반지는 반지 1·2 슬롯 어디에나 들어간다.</summary>
    public enum GearType
    {
        Helmet,
        Armor,
        Pants,
        Boots,
        Necklace,
        Ring,
        Weapon
    }

    /// <summary>장착 슬롯 8칸.</summary>
    public enum EquipSlot
    {
        Helmet,
        Armor,
        Pants,
        Boots,
        Necklace,
        Ring1,
        Ring2,
        Weapon
    }

    /// <summary>스킬 등급: 하급·중급·상급·최상급.</summary>
    public enum SkillTier
    {
        Low,
        Mid,
        High,
        Top
    }

    public enum SkillTarget
    {
        SingleEnemy,
        AllEnemies,
        Self
    }

    /// <summary>버프 5종 + 디버프 9종.</summary>
    public enum StatusType
    {
        Empower,    // 강화: 공격력 +
        Fortify,    // 철벽: 받는 피해 −
        Regen,      // 재생: 턴마다 최대 HP % 회복
        Focus,      // 집중: 선택지 성공률 +
        Swift,      // 날렵함: 회피 +
        Poison,     // 독: 턴마다 최대 HP % 피해
        Bleed,      // 출혈: 행동할 때마다 고정 피해
        Burn,       // 화상: 턴마다 고정 피해, 받는 회복량 −50%
        Weaken,     // 약화: 공격력 −
        Vulnerable, // 취약: 받는 피해 +
        Stun,       // 기절: 행동 불가
        Silence,    // 침묵: 스킬 사용 불가
        Blind,      // 실명: 성공률 −
        Fear        // 공포: 도주 외 선택지 성공률 −
    }

    public enum RoomType
    {
        Start,
        Battle,
        Event,
        Treasure,
        Rest,
        Merchant,
        Return,
        Boss
    }

    public enum LayoutPattern
    {
        Branch, // 가지형
        Loop,   // 순환형
        Grid    // 격자형
    }

    public enum QuestKind
    {
        Hunt,    // 토벌: 특정 몬스터 처치
        Collect, // 채집: 재료 수집 후 납품
        Conquer  // 정복: 층 보스 처치
    }
}

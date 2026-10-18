using System;

namespace Adventure.Core
{
    /// <summary>
    /// 모든 밸런스 수치. 기획서 기준 "임시값"이며 밸런싱 단계에서 이 파일만 고치면 된다.
    /// </summary>
    public static class GameBalance
    {
        // ── 캐릭터 (기획서 v1.2) ──────────────────────────────────
        public const int MaxLevel = 60;
        public const int PointsPerLevel = 3;
        /// <summary>직업이 배분할 수 없는 능력치의 고정값 (이벤트 판정에만 쓰임).</summary>
        public const int FixedStatValue = 5;
        public const int StartGold = 300;

        public const int BaseHp = 50;                     // HP = 50 + 체력 × 직업 계수
        public const double ResistPerSpirit = 0.01;       // 저항 = 정신 × 1%
        public const double DropBonusPerLuck = 0.005;     // 드롭률 × (1 + 행운 × 0.5%)
        public const double EventBonusPerLuck = 0.005;    // 이벤트 성공률 + 행운 × 0.5%
        public const int AttackPerMainStat = 2;           // 공격력 = 주 능력치 × 2 + 무기
        public const double EvasionPerAgility = 0.005;    // 회피 = 민첩 × 0.5%
        public const double EvasionPerFinesse = 0.005;    // 회피 + 기교 × 0.5% (도적)
        public const double ReductionPerToughness = 0.005;// 감소율 = 강인함 × 0.5%
        public const double SuccessPerPrecision = 0.005;  // 성공률 + 정밀 × 0.5%
        public const double SkillDamagePerSpellPower = 0.005; // 스킬 피해 + 주문력 × 0.5%
        /// <summary>치명타는 스킬에서만 발생하며 피해 ×1.8.</summary>
        public const double CritMultiplier = 1.8;
        public const double MaxEvasion = 0.40;
        public const double MaxReduction = 0.40;
        public const double MaxResist = 0.75;
        /// <summary>레벨업할 때마다 최대 HP의 30% 회복 (수정 사항 #11).</summary>
        public const double LevelUpHealRatio = 0.30;

        /// <summary>다음 레벨까지 필요 경험치 = 100 × 레벨^1.5</summary>
        public static long ExpToNext(int level)
        {
            if (level >= MaxLevel) return 0;
            return (long)Math.Round(100.0 * Math.Pow(level, 1.5));
        }

        // ── 사망 ───────────────────────────────────────────────
        public const double DeathGoldLoss = 0.30;
        public const double DeathExpLoss = 0.20; // 현재 레벨 필요 경험치 기준, 레벨은 내려가지 않음

        // ── 등급 ───────────────────────────────────────────────
        /// <summary>등급별 배지 효과 (캐릭터 자체 능력치에 곱함).</summary>
        public static readonly double[] BadgeBonus = { 0.00, 0.02, 0.04, 0.06, 0.09, 0.12, 0.16, 0.20 };
        /// <summary>등급별 스킬 장착 슬롯 (2단계마다 +1).</summary>
        public static readonly int[] SkillSlots = { 3, 3, 4, 4, 5, 5, 6, 6 };
        public const int StorageBase = 20;
        public const int StoragePerRank = 5;

        /// <summary>승급 조건 (1차 30층): [다음 등급 인덱스] = (돌파 층, 레벨, 퀘스트). 인덱스 0(F)은 사용 안 함.</summary>
        public static readonly int[,] PromotionRequirements =
        {
            { 0, 0, 0 },    // F (시작)
            { 3, 5, 3 },    // F → E
            { 6, 10, 8 },   // E → D
            { 10, 18, 15 }, // D → C
            { 15, 26, 25 }, // C → B
            { 20, 35, 40 }, // B → A
            { 25, 45, 60 }, // A → S
            { 28, 55, 80 }  // S → SS
        };

        // ── 인벤토리 · 창고 ─────────────────────────────────────
        public const int InventoryColumns = 5;
        public const int InventoryStart = 20;
        public const int InventoryPerBag = 5;
        public const int InventoryMax = 60;
        public const int MaxStack = 99;
        public const int BagBasePrice = 500; // 구매할 때마다 2배

        // ── 장비 ───────────────────────────────────────────────
        public static readonly double[] GradeValueMultiplier = { 1.0, 1.2, 1.45, 1.75, 2.1 };
        public static readonly double[] GradePriceMultiplier = { 1.0, 1.6, 2.6, 4.0, 6.0 };
        /// <summary>등급별 첫 등장 층.</summary>
        public static readonly int[] GradeFirstFloor = { 1, 1, 5, 12, 20 };
        public const double SellRatio = 0.5;

        public const int MaxEnhance = 10;
        public const double EnhanceValuePerLevel = 0.05;
        /// <summary>목표 강화 단계별 성공률. 인덱스 = 목표 단계(1~10).</summary>
        public static readonly double[] EnhanceSuccess = { 0, 1, 1, 1, 1, 1, 0.70, 0.60, 0.50, 0.30, 0.15 };
        /// <summary>목표 강화 단계별 필요 강화석.</summary>
        public static readonly int[] EnhanceStones = { 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2 };
        public const int EnhanceGoldPerLevel = 100; // 비용 = 100 × 목표 단계 × (등급 + 1)

        // ── 스킬 ───────────────────────────────────────────────
        public const int MaxSkillLevel = 5;
        public const double SkillPowerPerLevel = 0.10;
        public const int TrainingGoldPerLevel = 200; // 수련 비용 = 200G × 다음 강화 단계
        public static readonly int[] SkillBookPrice = { 600, 1500, 4000, 9000 };

        // ── 상점 ───────────────────────────────────────────────
        public const int ShopEquipmentSlots = 6;
        public const int ShopGoodsSlots = 6;
        public static readonly TimeSpan ShopRefreshInterval = TimeSpan.FromMinutes(30);
        public const int ShopRerollBaseCost = 100; // 즉시 갱신 비용, 갱신할 때마다 2배, 자동 갱신 시 초기화
        public const double MerchantPriceMultiplier = 1.2;

        // ── 길드 · 퀘스트 ────────────────────────────────────────
        public const int MaxActiveQuests = 3;
        public const int QuestBoardSize = 5;
        public static readonly double[] QuestRewardMultiplier = { 0.5, 1.0, 1.5 }; // 등급 −1, 동일, +1

        // ── 던전 ───────────────────────────────────────────────
        public const int MaxFloor = 30;
        public const int MinRooms = 8;
        public const int MaxRooms = 12;
        public const double MerchantChance = 0.60;
        public const int MinBranchesOnBossPath = 2;
        public const int MinDeadEnds = 1;
        public const double RestHealRatio = 0.40;

        // 방 최소/최대 개수 (보스·시작 제외). 최대 -1 = 제한 없음.
        public const int MinBattle = 4, MinEvent = 1, MinTreasure = 1, MaxTreasure = 2, MinRest = 1, MaxRest = 3;
        // 남은 칸 가중치
        public const int WeightBattle = 50, WeightEvent = 30, WeightTreasure = 10, WeightRest = 10;

        public const int MinEnemies = 1;
        public const int MaxEnemies = 4;
        public const double EliteChance = 0.12;

        public static double DifficultyMultiplier(Difficulty d)
        {
            switch (d)
            {
                case Difficulty.Easy: return 0.75;
                case Difficulty.Hard: return 1.25;
                case Difficulty.Hardcore: return 1.25;
                default: return 1.0;
            }
        }

        // ── 몬스터 (층 f 기준) ───────────────────────────────────
        public static double EnemyHp(int f) => 60 + f * 24 + f * f * 0.6;
        public static double EnemyAttack(int f) => 5 + f * 2.5 + f * f * 0.08;
        public static double EnemyDefense(int f) => 2 + f * 1.5;
        /// <summary>플레이어 공격 성공률 계산에 쓰는 적 요구치.</summary>
        public static double EnemyRequirement(int f) => 10 + f * 2.4;
        public static long EnemyExp(int f) => (long)Math.Round(10 + 20 * Math.Pow(f, 1.5));
        public static long EnemyGold(int f) => 8 + f * 6;
        public const double EliteHp = 1.6, EliteAttack = 1.25, EliteReward = 2.0;
        public const double FloorBossHp = 3.5, FloorBossAttack = 1.35, FloorBossReward = 6.0;
        public const double UniqueBossHp = 5.0, UniqueBossAttack = 1.5, UniqueBossReward = 10.0;
        /// <summary>미믹: 그 층 일반 몬스터 기준 HP ×1.5 · 공격력 ×1.3, 이기면 장비 확정 + 골드 ×3.</summary>
        public const double MimicHp = 1.5, MimicAttack = 1.3, MimicGold = 3.0;

        /// <summary>이벤트 능력치 판정 요구치.</summary>
        public static int EventRequirement(int f) => (int)Math.Round(6 + f * 1.5);

        // ── 드롭 ───────────────────────────────────────────────
        public const double SkillBookDropNormal = 0.01, SkillBookDropElite = 0.05, SkillBookDropBoss = 0.20;
        public const double EquipDropNormal = 0.08, EquipDropElite = 0.30, EquipDropBoss = 1.0;
        public const double StoneDropNormal = 0.05, StoneDropElite = 0.20;
        public const int StoneDropBoss = 2;
        public const double MaterialDrop = 0.55;

        // ── 전투 (기획서 v1.2) ──────────────────────────────────
        /// <summary>기본 공격 성공률 = 83% + (주 공격 능력치 − 적 요구치) × 1% + 보정, 60~95%.</summary>
        public const double BaseHit = 0.83;
        public const double HitPerStatPoint = 0.01;
        public const double MinHit = 0.60;
        public const double MaxHit = 0.95;
        public const double MinSuccess = 0.05;
        public const double MaxSuccess = 0.95;
        public const double EnemyBaseHit = 0.90;
        /// <summary>도주 = 60% + 회피 + 집중 − 실명, 최대 90%.</summary>
        public const double BaseFlee = 0.60;
        public const double MaxFlee = 0.90;
        public const double BossFleeChance = 0.0;
        /// <summary>마법사 기본 공격 피해 배율.</summary>
        public const double MageBasicAttack = 0.60;

        /// <summary>이벤트 판정 = 65% + (능력치 − 요구치) × 3% + 행운 × 0.5%, 25~95%.</summary>
        public const double EventBase = 0.65;
        public const double EventPerStatPoint = 0.03;
        public const double EventMin = 0.25;
        public const double EventMax = 0.95;

        public static double HitChance(double stat, double requirement, double bonus = 0) =>
            Clamp(BaseHit + (stat - requirement) * HitPerStatPoint + bonus, MinHit, MaxHit);

        public static double EventChance(double stat, double requirement, int luck) =>
            Clamp(EventBase + (stat - requirement) * EventPerStatPoint + luck * EventBonusPerLuck, EventMin, EventMax);

        public static double Clamp(double v, double min, double max) => v < min ? min : (v > max ? max : v);
        public static int Clamp(int v, int min, int max) => v < min ? min : (v > max ? max : v);
    }
}

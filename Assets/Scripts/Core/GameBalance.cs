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

        /// <summary>
        /// 능력치 최대값 (캐릭터 자체 능력치, 장비 보너스 제외, v1.8: 모두 99로 통일). 효과 상한(회피·감소 40%, 저항 75%,
        /// 성공률 92%)은 그대로라 상한을 넘는 투자는 효과가 없다.
        /// </summary>
        public const int StatCap = 99;
        /// <summary>직업이 배분할 수 없는 능력치의 고정값 (이벤트 판정에만 쓰임).</summary>
        public const int FixedStatValue = 5;
        public const int StartGold = 300;

        public const int BaseHp = 50;                     // HP = 50 + 체력 × 직업 계수
        public const double ResistPerSpirit = 0.01;       // 저항 = 정신 × 1%
        public const double DropBonusPerLuck = 0.005;     // 드롭률 × (1 + 행운 × 0.5%)
        public const double EventBonusPerLuck = 0.005;    // 이벤트 성공률 + 행운 × 0.5%
        /// <summary>공격력 = 주 능력치 × 5 + 무기 (v2.0: 장비 비중을 줄이려고 능력치 몫을 키움).</summary>
        public const int AttackPerMainStat = 5;
        public const double EvasionPerAgility = 0.005;    // 회피 = 민첩 × 0.5%
        public const double EvasionPerFinesse = 0.005;    // 회피 + 기교 × 0.5% (도적)
        public const double ReductionPerToughness = 0.005;// 감소율 = 강인함 × 0.5%
        public const double SuccessPerPrecision = 0.005;  // 성공률 + 정밀 × 0.5%
        public const double SkillDamagePerSpellPower = 0.005; // 스킬 피해 + 주문력 × 0.5%
        /// <summary>치명타는 도적 스킬에서만 발생하며 피해 ×2.3 (v1.8: 도적 스킬 피해를 80%로 낮춘 대신).</summary>
        public const double CritMultiplier = 2.3;
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
        /// <summary>창고: 시작 4칸, 등급마다 +2칸 (v2.3, 이미 넘게 맡긴 물건은 그대로 두고 새로 맡기는 것만 막는다).</summary>
        public const int StorageBase = 4;
        public const int StoragePerRank = 2;
        /// <summary>창고 보관 수수료 (1회, 한 칸 기준) = 10 + 돌파 층 × 5. 찾을 때는 무료.</summary>
        public static int StorageFee(int highestFloor) => 10 + highestFloor * 5;

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
        public const int InventoryStart = 20;
        public const int InventoryPerBag = 5;
        public const int InventoryMax = 60;
        public const int MaxStack = 99;
        public const int BagBasePrice = 500; // 구매할 때마다 2배

        // ── 장비 ───────────────────────────────────────────────
        /// <summary>
        /// 등급별 기본 수치 배율 (v2.0: 작게). 착용 레벨이 기본 수치를 주로 정해서, 레벨 차이가 크면 낮은 등급이라도
        /// 높은 레벨 장비가 앞선다 (같은 부위 10레벨 차이면 희귀 ↔ 일반이 뒤집힘).
        /// </summary>
        public static readonly double[] GradeValueMultiplier = { 1.0, 1.07, 1.14, 1.21, 1.28 };
        public static readonly double[] GradePriceMultiplier = { 1.0, 1.6, 2.6, 4.0, 6.0 };
        /// <summary>등급별 첫 등장 층.</summary>
        public static readonly int[] GradeFirstFloor = { 1, 1, 5, 12, 20 };
        public const double SellRatio = 0.5;

        public const int MaxEnhance = 15;
        /// <summary>
        /// 강화 1단계마다 기본 수치 + 등급별 비율 (높은 등급일수록 많이 오른다, v2.0: 2~4%).
        /// 무기·방어구는 단계마다 최소 +1, 장신구는 2단계마다 최소 +1.
        /// </summary>
        public static readonly double[] EnhanceValuePerLevel = { 0.02, 0.025, 0.03, 0.035, 0.04 };

        /// <summary>
        /// 장비 비중 상한 (v2.0): 적정 장비(<see cref="FairGrade"/> · 적정 강화)에서 무기가 공격력의,
        /// 방어구가 받는 피해의, 장신구 3개가 주 능력치의 이 비율을 넘지 않는다 (테스트로 고정).
        /// </summary>
        public const double MaxGearShare = 0.40;

        /// <summary>층의 적정 장비 등급: 1~11층 고급, 12~19층 희귀, 20층부터 영웅.</summary>
        public static ItemGrade FairGrade(int floor) =>
            floor >= 20 ? ItemGrade.Epic : floor >= 12 ? ItemGrade.Rare : ItemGrade.Uncommon;

        /// <summary>피해 = 공격 × K / (K + 방어력). v2.0: 방어구 수치를 낮추며 100 → 400.</summary>
        public const double DefenseConstant = 400;
        /// <summary>강화한 장비를 팔면 들어간 강화 골드의 이 비율을 판매가에 더한다.</summary>
        public const double EnhanceSellRefund = 0.5;
        /// <summary>목표 강화 단계별 성공률. 인덱스 = 목표 단계(1~15, v1.9: 최대 +15, 단계마다 고르게 낮아진다).</summary>
        public static readonly double[] EnhanceSuccess = { 0, 1, 1, 1, 0.95, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.25, 0.20, 0.15, 0.10 };
        /// <summary>목표 강화 단계별 필요 강화석 (+6부터).</summary>
        public static readonly int[] EnhanceStones = { 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3 };

        /// <summary>
        /// 층에 맞는 적정 강화 단계 = 층 ÷ 2 (30층 +15). 강화석은 적정 단계가 강화석이 필요한 단계(+6)가 되는 층(12층)보다
        /// 2층 앞(10층)부터 나온다 (v1.9: 초반 강화석 판매로 돈을 벌지 못하게).
        /// </summary>
        public static int RecommendedEnhance(int floor) => Math.Min(MaxEnhance, Math.Max(0, floor) / 2);

        public static readonly int StoneFirstFloor = FirstFloorNeedingStones() - 2;

        private static int FirstFloorNeedingStones()
        {
            int first = Array.FindIndex(EnhanceStones, n => n > 0);
            for (int f = 1; f <= MaxFloor; f++)
                if (RecommendedEnhance(f) >= first) return f;
            return MaxFloor;
        }

        public static bool StonesDropOn(int floor) => floor >= StoneFirstFloor;
        /// <summary>실패하면 한 단계 내려갈 확률 (목표 단계 기준): +7~10 30%, +11~15 50%, 그 아래는 0.</summary>
        public static double EnhanceDowngradeChance(int target) => target >= 11 ? 0.5 : target >= 7 ? 0.3 : 0;
        /// <summary>강화 비용 = 30 × 목표 단계 × (1 + 착용 레벨 ÷ 10) × 등급 배율 (v1.9: 장비 레벨도 반영).</summary>
        public const int EnhanceGoldBase = 30;
        public static readonly double[] EnhanceGradeCost = { 1.0, 1.3, 1.7, 2.2, 3.0 };

        // ── 스킬 ───────────────────────────────────────────────
        public const int MaxSkillLevel = 5;
        /// <summary>수련 1단계마다 스킬 위력 + 등급별 비율 (하급·중급·상급·최상급, v1.9).</summary>
        public static readonly double[] SkillPowerPerLevel = { 0.08, 0.10, 0.12, 0.15 };
        public const int TrainingGoldPerLevel = 200; // 수련 비용 = 200G × 다음 강화 단계
        /// <summary>스킬서로 얻을 수 있는 스킬의 장착 레벨 한도 = 지금 레벨 + 이 값.</summary>
        public const int SkillBookLevelWindow = 5;
        public static readonly int[] SkillBookPrice = { 600, 1500, 4000, 9000 };

        // ── 상점 ───────────────────────────────────────────────
        public const int ShopEquipmentSlots = 6;
        public const int ShopGoodsSlots = 6;
        public static readonly TimeSpan ShopRefreshInterval = TimeSpan.FromMinutes(30);
        public const int ShopRerollBaseCost = 100; // 즉시 갱신 비용, 갱신할 때마다 2배, 자동 갱신 시 초기화
        public const double MerchantPriceMultiplier = 1.5;
        /// <summary>상인의 보답 (구해 준 상인의 가게).</summary>
        public const double MerchantDiscountMultiplier = 0.7;
        /// <summary>던전 상인 물건마다 살 수 있는 최대 개수.</summary>
        public const int MerchantStockMin = 2, MerchantStockMax = 5;
        /// <summary>
        /// 드롭·상점 장비와 스킬서가 내 레벨보다 높게 나오면 이 확률로 내 레벨 이하로 다시 정한다 (v2.0).
        /// </summary>
        public const double OverLevelReroll = 0.5;
        /// <summary>내 레벨보다 낮은 장비가 한 등급 높게 나올 확률 (그 층 최고 등급까지, v2.0).</summary>
        public const double UnderLevelGradeUp = 0.10;
        /// <summary>장비·스킬서가 지금 직업용으로 나올 확률. 나머지는 다른 세 직업이 똑같이 나눈다 (각 10%).</summary>
        public const double OwnJobChance = 0.7;

        // ── 길드 · 퀘스트 ────────────────────────────────────────
        public const int MaxActiveQuests = 3;
        public const int QuestBoardSize = 5;

        // ── 던전 ───────────────────────────────────────────────
        public const int MaxFloor = 30;
        public const int MinRooms = 8;
        public const int MaxRooms = 12;
        public const double MerchantChance = 0.60;
        public const int MinBranchesOnBossPath = 2;
        public const int MinDeadEnds = 1;
        public const double RestHealRatio = 0.40;

        // 방 최소/최대 개수 (보스·시작 제외). 최대 -1 = 제한 없음.
        public const int MinBattle = 4, MinEvent = 1, MaxTreasure = 2, MinRest = 1, MaxRest = 3;
        /// <summary>보물 방은 필수가 아니다: 첫 보물 방은 이 확률로만 넣고, 나머지는 가중치로 (v2.3, 층당 평균 약 0.75개).</summary>
        public const double FirstTreasureChance = 0.65;
        // 남은 칸 가중치
        public const int WeightBattle = 50, WeightEvent = 30, WeightTreasure = 5, WeightRest = 10;

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
        /// <summary>
        /// 초반 보정 (v1.6 밸런싱, 보통 기준): 1층 1.0 → 8층 0. 레벨 업이 빠른 초반이 너무 쉬워 적을 조금 세게 한다.
        /// 쉬움은 보정 없음, 어려움·하드코어는 40%만 (이미 ×1.25라 초반이 벽이 되지 않게).
        /// </summary>
        public static double EarlyBoost(int f) => Math.Max(0, (EarlyBoostUntil - f) / (double)(EarlyBoostUntil - 1));
        public const int EarlyBoostUntil = 8;
        public const double EarlyBoostHp = 25, EarlyBoostAttack = 3.5;

        public static double EarlyBoostScale(Difficulty d) => d == Difficulty.Easy ? 0 : d == Difficulty.Normal ? 1.0 : 0.4;

        /// <summary>적 HP (v1.8: 성공률 +7%p에 맞춰 ×1.1, v1.9: 장비 수치 상향에 맞춰 층이 깊을수록 더).</summary>
        public static double EnemyHp(int f, double early = 1.0) => 200 + f * 70 - f * f * 0.5 + EarlyBoostHp * EarlyBoost(f) * early;
        public static double EnemyAttack(int f, double early = 1.0) => (5 + f * 2.8 + f * f * 0.05) * 0.55 + EarlyBoostAttack * EarlyBoost(f) * early;
        public static double EnemyDefense(int f) => 8 + f * 6;
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
        public const double EquipDropNormal = 0.04, EquipDropElite = 0.25, EquipDropBoss = 1.0;
        public const double StoneDropNormal = 0.05, StoneDropElite = 0.20;
        public const int StoneDropBoss = 2;
        public const double MaterialDrop = 0.55;

        // ── 전투 (기획서 v1.2) ──────────────────────────────────
        /// <summary>기본 공격 성공률 = 81% + (주 공격 능력치 − 적 요구치) × 1% + 보정, 62~92% (v1.8: +7%p, 대부분 77~87%).</summary>
        public const double BaseHit = 0.81;
        public const double HitPerStatPoint = 0.01;
        public const double MinHit = 0.62;
        public const double MaxHit = 0.92;
        public const double MinSuccess = 0.05;
        public const double MaxSuccess = 0.95;
        public const double EnemyBaseHit = 0.90;
        /// <summary>도주 = 67% + 회피 + 집중 − 실명, 최대 87% (v1.8: +7%p).</summary>
        public const double BaseFlee = 0.67;
        public const double MaxFlee = 0.87;
        public const double BossFleeChance = 0.0;
        /// <summary>마법사 기본 공격 피해 배율.</summary>
        public const double MageBasicAttack = 0.60;

        /// <summary>이벤트 판정 = 72% + (능력치 − 요구치) × 1% + 행운 × 0.5%, 40~85% (대부분 70~80%).</summary>
        public const double EventBase = 0.62;
        public const double EventPerStatPoint = 0.01;
        public const double EventMin = 0.30;
        public const double EventMax = 0.75;

        public static double HitChance(double stat, double requirement, double bonus = 0) =>
            Clamp(BaseHit + (stat - requirement) * HitPerStatPoint + bonus, MinHit, MaxHit);

        public static double EventChance(double stat, double requirement, int luck) =>
            Clamp(EventBase + (stat - requirement) * EventPerStatPoint + luck * EventBonusPerLuck, EventMin, EventMax);

        public static double Clamp(double v, double min, double max) => v < min ? min : (v > max ? max : v);
        public static int Clamp(int v, int min, int max) => v < min ? min : (v > max ? max : v);
    }
}

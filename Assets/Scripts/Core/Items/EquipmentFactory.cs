using System;

namespace Adventure.Core
{
    /// <summary>장비 생성. 랜덤 옵션 없이 기본 수치·레벨 제한·직업 제한만 가진다.</summary>
    public static class EquipmentFactory
    {
        // 레벨 구간(0~9, 10~19, …)별 이름
        private static readonly string[][] ArmorNames =
        {
            new[] { "가죽 투구", "철 투구", "강철 투구", "기사 투구", "용비늘 투구", "영웅의 투구" },
            new[] { "누비 갑옷", "사슬 갑옷", "판금 갑옷", "기사 갑옷", "용비늘 갑옷", "영웅의 갑옷" },
            new[] { "천 바지", "가죽 바지", "사슬 각반", "강철 각반", "용비늘 각반", "영웅의 각반" },
            new[] { "여행자 장화", "가죽 장화", "철 장화", "기사 장화", "용비늘 장화", "영웅의 장화" },
            new[] { "늑대 이빨", "은 목걸이", "수정 목걸이", "비취 목걸이", "용의 눈", "영웅의 목걸이" },
            new[] { "청동 반지", "은 반지", "금 반지", "루비 반지", "용 반지", "영웅의 반지" },
        };

        private static readonly string[][] WeaponNames =
        {
            new[] { "낡은 검", "강철 장검", "전투 도끼", "기사의 대검", "용린 도끼", "영웅의 검" },
            new[] { "짧은 활", "사냥꾼 활", "장궁", "합성궁", "용골 활", "영웅의 활" },
            new[] { "낡은 단검", "강철 단검", "쌍날 단검", "암살자의 단검", "용아 단검", "영웅의 단검" },
            new[] { "견습 지팡이", "참나무 지팡이", "수정 지팡이", "현자의 지팡이", "용골 지팡이", "영웅의 지팡이" },
        };

        public static readonly GearType[] AllGear =
        {
            GearType.Helmet, GearType.Armor, GearType.Pants, GearType.Boots,
            GearType.Necklace, GearType.Ring, GearType.Weapon
        };

        public static int BaseValueFor(GearType gear, int itemLevel)
        {
            switch (gear)
            {
                case GearType.Weapon: return (int)Math.Round(6 + itemLevel * 2.2);
                case GearType.Helmet: return (int)Math.Round(2 + itemLevel * 0.6);
                case GearType.Armor: return (int)Math.Round(4 + itemLevel * 1.0);
                case GearType.Pants: return (int)Math.Round(3 + itemLevel * 0.8);
                case GearType.Boots: return (int)Math.Round(2 + itemLevel * 0.5);
                default: return (int)Math.Round(1 + itemLevel * 0.25); // 장신구: 능력치 보너스
            }
        }

        public static int PriceFor(int itemLevel, ItemGrade grade) =>
            (int)Math.Round((40 + itemLevel * 45) * GameBalance.GradePriceMultiplier[(int)grade]);

        /// <summary>층에 맞는 아이템 레벨 (최대 레벨 60 = 30층 기준, ±2).</summary>
        public static int ItemLevelForFloor(int floor, Rng rng)
        {
            int lv = floor * 2 - 1 + rng.RangeInclusive(-2, 2);
            return GameBalance.Clamp(lv, 1, GameBalance.MaxLevel);
        }

        public static ItemInstance Create(GearType gear, ItemGrade grade, int itemLevel, Job weaponJob, Stat accessoryStat)
        {
            itemLevel = GameBalance.Clamp(itemLevel, 1, GameBalance.MaxLevel);
            int tier = Math.Min(5, itemLevel / 10);
            var item = new ItemInstance
            {
                Uid = ItemInstance.NewUid(),
                Kind = ItemKind.Equipment,
                Gear = gear,
                Grade = grade,
                LevelReq = itemLevel,
                BaseValue = Math.Max(1, (int)Math.Round(BaseValueFor(gear, itemLevel) * GameBalance.GradeValueMultiplier[(int)grade])),
                Price = PriceFor(itemLevel, grade),
            };
            if (gear == GearType.Weapon)
            {
                item.JobRestriction = (int)weaponJob;
                item.Name = WeaponNames[(int)weaponJob][tier];
            }
            else
            {
                item.Name = ArmorNames[(int)gear][tier];
                if (item.IsAccessory) item.BonusStat = accessoryStat;
            }
            item.TemplateId = "eq_" + gear + "_" + tier;
            return item;
        }

        /// <summary>무작위 장비. 무기는 forJob 직업 확률 ownJobChance, 장신구 보너스는 그 직업이 쓰는 능력치에서 고른다.</summary>
        public static ItemInstance CreateRandom(Rng rng, ItemGrade grade, int itemLevel, Job forJob, double ownJobChance = 1.0)
        {
            GearType gear = rng.Pick(AllGear);
            Job weaponJob = rng.Chance(ownJobChance) ? forJob : (Job)rng.Range(0, 4);
            Stat stat = rng.Pick(JobData.Get(forJob).AllocatableStats);
            return Create(gear, grade, itemLevel, weaponJob, stat);
        }

        /// <summary>층에서 나올 수 있는 최고 등급.</summary>
        public static ItemGrade MaxGradeForFloor(int floor)
        {
            var g = ItemGrade.Common;
            for (int i = 0; i < GameBalance.GradeFirstFloor.Length; i++)
                if (floor >= GameBalance.GradeFirstFloor[i]) g = (ItemGrade)i;
            return g;
        }

        /// <summary>드롭 등급 추첨. bossLevel 0 = 일반 적, 1 = 엘리트, 2 = 보스.</summary>
        public static ItemGrade RollDropGrade(Rng rng, int floor, int bossLevel)
        {
            int[] weights = bossLevel == 2
                ? new[] { 0, 30, 40, 22, 8 }
                : bossLevel == 1 ? new[] { 20, 40, 28, 10, 2 } : new[] { 55, 33, 10, 2, 0 };
            var max = MaxGradeForFloor(floor);
            for (int i = (int)max + 1; i < weights.Length; i++) weights[i] = 0;
            // 전설은 보스 저확률 드롭만
            if (bossLevel < 2) weights[(int)ItemGrade.Legendary] = 0;
            int idx = rng.PickWeighted(weights);
            return idx < 0 ? ItemGrade.Common : (ItemGrade)idx;
        }
    }
}

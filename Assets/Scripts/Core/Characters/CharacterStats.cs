using System;

namespace Adventure.Core
{
    /// <summary>
    /// 캐릭터 파생 수치 계산. 배지는 캐릭터 자체 능력치에만 곱하고, 장비 보너스는 그 뒤에 더한다.
    /// </summary>
    public static class CharacterStats
    {
        /// <summary>배지가 적용된 캐릭터 자체 능력치 (장비 제외).</summary>
        public static int OwnStat(Character c, Stat stat)
        {
            double bonus = RankSystem.BadgeBonus(c.Rank);
            return (int)Math.Floor(c.BaseStats[stat] * (1.0 + bonus));
        }

        /// <summary>최종 능력치 = 배지 적용 자체 능력치 + 장비 고정 보너스.</summary>
        public static int Total(Character c, Stat stat) => OwnStat(c, stat) + EquipmentBonus(c, stat);

        public static int EquipmentBonus(Character c, Stat stat)
        {
            int sum = 0;
            foreach (var item in c.Equipment.Slots)
                if (item != null && item.IsAccessory && item.BonusStat == stat) sum += item.Value;
            return sum;
        }

        public static int WeaponAttack(Character c) => c.Equipment[EquipSlot.Weapon]?.Value ?? 0;

        public static int ArmorDefense(Character c)
        {
            int sum = 0;
            foreach (var item in c.Equipment.Slots)
                if (item != null && !item.IsWeapon && !item.IsAccessory) sum += item.Value;
            return sum;
        }

        /// <summary>HP = 50 + 체력 × 직업 계수 (전사 12 · 궁수 10 · 도적 9 · 마법사 8).</summary>
        public static int MaxHp(Character c) => GameBalance.BaseHp + Total(c, Stat.Vitality) * c.JobData.HpPerVitality;

        /// <summary>공격력 = 주 공격 능력치 × 5 + 무기 (v2.0)</summary>
        public static int Attack(Character c) => Total(c, c.JobData.AttackStat) * GameBalance.AttackPerMainStat + WeaponAttack(c);

        public static int Defense(Character c) => ArmorDefense(c);

        /// <summary>회피 = 민첩 × 0.5% + 기교 × 0.5% (기교는 도적만 배분), 최대 40%.</summary>
        public static double Evasion(Character c)
        {
            double e = Total(c, Stat.Agility) * GameBalance.EvasionPerAgility;
            if (c.JobData.CanAllocate(Stat.Finesse)) e += Total(c, Stat.Finesse) * GameBalance.EvasionPerFinesse;
            return Math.Min(GameBalance.MaxEvasion, e);
        }

        public static double DamageReduction(Character c) =>
            Math.Min(GameBalance.MaxReduction, Total(c, Stat.Toughness) * GameBalance.ReductionPerToughness);

        public static double Resist(Character c) =>
            Math.Min(GameBalance.MaxResist, Total(c, Stat.Spirit) * GameBalance.ResistPerSpirit);

        public static double SkillDamageBonus(Character c) =>
            Total(c, Stat.SpellPower) * GameBalance.SkillDamagePerSpellPower;

        /// <summary>정밀은 궁수만 배분하지만 장신구로 오른 정밀도 적용된다.</summary>
        public static double PrecisionBonus(Character c) =>
            c.JobData.CanAllocate(Stat.Precision) || EquipmentBonus(c, Stat.Precision) > 0
                ? Total(c, Stat.Precision) * GameBalance.SuccessPerPrecision
                : 0;

        public static double DropBonus(Character c) =>
            1.0 + Total(c, Stat.Luck) * GameBalance.DropBonusPerLuck;

        public static double EventLuckBonus(Character c) => Total(c, Stat.Luck) * GameBalance.EventBonusPerLuck;

        /// <summary>능력치 옆에 보여 줄 효과 설명 (캐릭터 화면용).</summary>
        public static string EffectLabel(Character c, Stat stat)
        {
            switch (stat)
            {
                case Stat.Vitality: return "HP " + MaxHp(c);
                case Stat.Spirit: return "저항 " + Percent(Resist(c));
                case Stat.Luck: return "드롭 +" + Percent(DropBonus(c) - 1) + " · 이벤트 +" + Percent(EventLuckBonus(c));
                case Stat.Strength:
                case Stat.Intelligence:
                    return c.JobData.AttackStat == stat ? "공격력 " + Attack(c) : "-";
                case Stat.Agility:
                    return c.JobData.AttackStat == stat
                        ? "공격력 " + Attack(c) + " · 회피 " + Percent(Evasion(c))
                        : "회피 " + Percent(Evasion(c));
                case Stat.Toughness: return "받는 피해 −" + Percent(DamageReduction(c));
                case Stat.Precision: return "성공률 +" + Percent(PrecisionBonus(c));
                case Stat.Finesse: return "회피 " + Percent(Evasion(c));
                case Stat.SpellPower: return "스킬 피해 +" + Percent(SkillDamageBonus(c));
                default: return "";
            }
        }

        public static string Percent(double v)
        {
            double p = v * 100.0;
            return Math.Abs(p - Math.Round(p)) < 0.05 ? Math.Round(p) + "%" : p.ToString("0.0") + "%";
        }
    }
}

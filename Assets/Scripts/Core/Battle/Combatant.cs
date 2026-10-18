using System;

namespace Adventure.Core
{
    /// <summary>전투 참가자 (플레이어 또는 적).</summary>
    public class Combatant
    {
        public string Name = "";
        public bool IsPlayer;
        public int MaxHp;
        public int Hp;
        public int Attack;
        public int Defense;
        /// <summary>플레이어 공격 성공률 계산에 쓰는 요구치 (적).</summary>
        public double Requirement;
        public double Evasion;
        public double DamageReduction;
        public double Resist;
        public double CritChance;
        public double CritDamage = GameBalance.CritMultiplier;
        public int RegenPercent;
        public readonly StatusContainer Statuses = new StatusContainer();

        // 적 전용
        public MonsterSpecies Species;
        public EnemySkill[] Skills = Array.Empty<EnemySkill>();
        public int Role; // 0 일반, 1 엘리트, 2 보스
        public long ExpReward;
        public long GoldReward;
        /// <summary>처치하면 장비 확정 드롭 (미믹).</summary>
        public bool GuaranteedEquipment;

        public bool Alive => Hp > 0;

        public double HpRatio => MaxHp <= 0 ? 0 : (double)Hp / MaxHp;
    }
}

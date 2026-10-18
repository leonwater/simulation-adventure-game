using System;
using System.Collections.Generic;
using System.Text;

namespace Adventure.Core
{
    /// <summary>액티브 스킬 정의. 자원 소모 없이 재사용 대기 턴만 있다.</summary>
    public sealed class SkillDef
    {
        public string Id;
        public string Name;
        /// <summary>-1 = 공용, 그 외 = (int)Job.</summary>
        public int JobRestriction = -1;
        public SkillTier Tier;
        public SkillTarget Target;
        public int Cooldown;
        public double DamageMult;
        public int Hits = 1;
        public double HealRatio;
        public double SuccessBonus;
        public double CritBonus;
        public StatusApply[] Statuses = Array.Empty<StatusApply>();

        public int ReqLevel => SkillDb.TierRequirementLevel[(int)Tier];
        public Rank ReqRank => SkillDb.TierRequirementRank[(int)Tier];
        public bool IsAttack => DamageMult > 0;

        /// <summary>효과 설명 (재사용 턴 제외). 예: "단일 대상 피해 180%"</summary>
        public string EffectText
        {
            get
            {
                var parts = new List<string>();
                if (DamageMult > 0)
                {
                    string who = Target == SkillTarget.AllEnemies ? "모든 적 " : "단일 대상 ";
                    string hits = Hits > 1 ? " × " + Hits + "회" : "";
                    parts.Add(who + "피해 " + Math.Round(DamageMult * 100) + "%" + hits);
                }
                if (HealRatio > 0) parts.Add("HP " + Math.Round(HealRatio * 100) + "% 회복");
                foreach (var s in Statuses)
                {
                    string chance = s.Chance < 1 ? " (" + Math.Round(s.Chance * 100) + "%)" : "";
                    parts.Add(Text.Of(s.Type) + " " + s.Turns + "턴" + chance);
                }
                if (SuccessBonus > 0) parts.Add("성공률 +" + Math.Round(SuccessBonus * 100) + "%");
                if (CritBonus > 0) parts.Add("치명타 +" + Math.Round(CritBonus * 100) + "%");
                return string.Join(" + ", parts);
            }
        }

        /// <summary>예: "단일 대상 피해 180% · 재사용 2턴"</summary>
        public string Description => EffectText + " · 재사용 " + Cooldown + "턴";
    }

    public static class SkillDb
    {
        public static readonly int[] TierRequirementLevel = { 1, 8, 18, 30 };
        public static readonly Rank[] TierRequirementRank = { Rank.F, Rank.E, Rank.D, Rank.C };

        private static StatusApply S(StatusType t, int v, int turns, bool self = false, double chance = 1.0) =>
            new StatusApply(t, v, turns, self, chance);

        private const int W = (int)Job.Warrior, A = (int)Job.Archer, R = (int)Job.Rogue, M = (int)Job.Mage;

        public static readonly SkillDef[] All =
        {
            // 전사
            new SkillDef { Id = "w_bash", Name = "강타", JobRestriction = W, Tier = SkillTier.Low, Target = SkillTarget.SingleEnemy, Cooldown = 2, DamageMult = 1.8 },
            new SkillDef { Id = "w_warcry", Name = "전투 함성", JobRestriction = W, Tier = SkillTier.Low, Target = SkillTarget.Self, Cooldown = 4, Statuses = new[] { S(StatusType.Empower, 20, 3, true) } },
            new SkillDef { Id = "w_shield", Name = "방패 밀치기", JobRestriction = W, Tier = SkillTier.Mid, Target = SkillTarget.SingleEnemy, Cooldown = 3, DamageMult = 0.9, Statuses = new[] { S(StatusType.Stun, 1, 1) } },
            new SkillDef { Id = "w_guard", Name = "철벽 태세", JobRestriction = W, Tier = SkillTier.Mid, Target = SkillTarget.Self, Cooldown = 4, Statuses = new[] { S(StatusType.Fortify, 20, 3, true) } },
            new SkillDef { Id = "w_whirl", Name = "회전 베기", JobRestriction = W, Tier = SkillTier.High, Target = SkillTarget.AllEnemies, Cooldown = 4, DamageMult = 1.2 },
            new SkillDef { Id = "w_earth", Name = "대지 가르기", JobRestriction = W, Tier = SkillTier.Top, Target = SkillTarget.AllEnemies, Cooldown = 5, DamageMult = 2.0, Statuses = new[] { S(StatusType.Vulnerable, 20, 2) } },
            // 궁수
            new SkillDef { Id = "a_aim", Name = "조준 사격", JobRestriction = A, Tier = SkillTier.Low, Target = SkillTarget.SingleEnemy, Cooldown = 2, DamageMult = 1.7, SuccessBonus = 0.10 },
            new SkillDef { Id = "a_poison", Name = "독화살", JobRestriction = A, Tier = SkillTier.Low, Target = SkillTarget.SingleEnemy, Cooldown = 3, DamageMult = 1.0, Statuses = new[] { S(StatusType.Poison, 4, 3) } },
            new SkillDef { Id = "a_double", Name = "연속 사격", JobRestriction = A, Tier = SkillTier.Mid, Target = SkillTarget.SingleEnemy, Cooldown = 3, DamageMult = 0.85, Hits = 2 },
            new SkillDef { Id = "a_flash", Name = "섬광 화살", JobRestriction = A, Tier = SkillTier.Mid, Target = SkillTarget.SingleEnemy, Cooldown = 3, DamageMult = 0.8, Statuses = new[] { S(StatusType.Blind, 15, 2) } },
            new SkillDef { Id = "a_rain", Name = "화살비", JobRestriction = A, Tier = SkillTier.High, Target = SkillTarget.AllEnemies, Cooldown = 4, DamageMult = 1.1 },
            new SkillDef { Id = "a_snipe", Name = "관통 저격", JobRestriction = A, Tier = SkillTier.Top, Target = SkillTarget.SingleEnemy, Cooldown = 5, DamageMult = 3.0, SuccessBonus = 0.15 },
            // 도적
            new SkillDef { Id = "r_ambush", Name = "기습", JobRestriction = R, Tier = SkillTier.Low, Target = SkillTarget.SingleEnemy, Cooldown = 2, DamageMult = 1.6, CritBonus = 0.20 },
            new SkillDef { Id = "r_venom", Name = "독 바르기", JobRestriction = R, Tier = SkillTier.Low, Target = SkillTarget.SingleEnemy, Cooldown = 3, DamageMult = 1.0, Statuses = new[] { S(StatusType.Poison, 5, 3) } },
            new SkillDef { Id = "r_vital", Name = "급소 찌르기", JobRestriction = R, Tier = SkillTier.Mid, Target = SkillTarget.SingleEnemy, Cooldown = 3, DamageMult = 1.5, Statuses = new[] { S(StatusType.Bleed, 40, 2) } },
            new SkillDef { Id = "r_smoke", Name = "연막", JobRestriction = R, Tier = SkillTier.Mid, Target = SkillTarget.Self, Cooldown = 4, Statuses = new[] { S(StatusType.Swift, 15, 3, true) } },
            new SkillDef { Id = "r_storm", Name = "칼날 폭풍", JobRestriction = R, Tier = SkillTier.High, Target = SkillTarget.AllEnemies, Cooldown = 4, DamageMult = 1.0, Statuses = new[] { S(StatusType.Bleed, 30, 2) } },
            new SkillDef { Id = "r_assassin", Name = "암살", JobRestriction = R, Tier = SkillTier.Top, Target = SkillTarget.SingleEnemy, Cooldown = 5, DamageMult = 3.2, CritBonus = 0.30 },
            // 마법사
            new SkillDef { Id = "m_fireball", Name = "화염구", JobRestriction = M, Tier = SkillTier.Low, Target = SkillTarget.SingleEnemy, Cooldown = 2, DamageMult = 1.7, Statuses = new[] { S(StatusType.Burn, 30, 2) } },
            new SkillDef { Id = "m_barrier", Name = "마력 방벽", JobRestriction = M, Tier = SkillTier.Low, Target = SkillTarget.Self, Cooldown = 4, Statuses = new[] { S(StatusType.Fortify, 20, 3, true) } },
            new SkillDef { Id = "m_frost", Name = "서리 화살", JobRestriction = M, Tier = SkillTier.Mid, Target = SkillTarget.SingleEnemy, Cooldown = 3, DamageMult = 1.3, Statuses = new[] { S(StatusType.Weaken, 20, 2) } },
            new SkillDef { Id = "m_chain", Name = "연쇄 번개", JobRestriction = M, Tier = SkillTier.Mid, Target = SkillTarget.AllEnemies, Cooldown = 3, DamageMult = 0.9 },
            new SkillDef { Id = "m_meteor", Name = "운석 낙하", JobRestriction = M, Tier = SkillTier.High, Target = SkillTarget.AllEnemies, Cooldown = 5, DamageMult = 1.6, Statuses = new[] { S(StatusType.Burn, 35, 2) } },
            new SkillDef { Id = "m_seal", Name = "봉인 술식", JobRestriction = M, Tier = SkillTier.Top, Target = SkillTarget.AllEnemies, Cooldown = 6, DamageMult = 1.4, Statuses = new[] { S(StatusType.Stun, 1, 1, false, 0.6) } },
            // 공용
            new SkillDef { Id = "c_firstaid", Name = "응급 처치", Tier = SkillTier.Low, Target = SkillTarget.Self, Cooldown = 4, HealRatio = 0.25 },
            new SkillDef { Id = "c_focus", Name = "정신 집중", Tier = SkillTier.Mid, Target = SkillTarget.Self, Cooldown = 4, Statuses = new[] { S(StatusType.Focus, 10, 3, true) } },
            new SkillDef { Id = "c_prayer", Name = "재생의 기도", Tier = SkillTier.High, Target = SkillTarget.Self, Cooldown = 5, Statuses = new[] { S(StatusType.Regen, 5, 4, true) } },
        };

        private static readonly Dictionary<string, SkillDef> ById = new Dictionary<string, SkillDef>();

        static SkillDb()
        {
            foreach (var s in All) ById[s.Id] = s;
        }

        public static SkillDef Get(string id) => id != null && ById.TryGetValue(id, out var s) ? s : null;

        public static string StartingSkill(Job job)
        {
            switch (job)
            {
                case Job.Archer: return "a_aim";
                case Job.Rogue: return "r_ambush";
                case Job.Mage: return "m_fireball";
                default: return "w_bash";
            }
        }

        /// <summary>직업이 쓸 수 있는 스킬 중 주어진 등급들.</summary>
        public static List<SkillDef> ForJob(Job job, params SkillTier[] tiers)
        {
            var list = new List<SkillDef>();
            foreach (var s in All)
                if ((s.JobRestriction < 0 || s.JobRestriction == (int)job) && Array.IndexOf(tiers, s.Tier) >= 0)
                    list.Add(s);
            return list;
        }
    }
}

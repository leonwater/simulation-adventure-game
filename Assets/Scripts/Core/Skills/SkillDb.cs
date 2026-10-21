using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>
    /// 액티브 스킬 정의 (기획서 v1.2 '직업'). 자원 소모 없이 재사용 대기 턴만 있다.
    /// 성공률 보정은 기본 공격 성공률에 더하며, 자신에게 거는 스킬은 100%. 여러 번 때리는 스킬은 타격마다 판정한다.
    /// </summary>
    public sealed class SkillDef
    {
        public string Id;
        public string Name;
        /// <summary>-1 = 공용, 그 외 = (int)Job. v1.2부터 공용 스킬은 없다.</summary>
        public int JobRestriction = -1;
        public SkillTier Tier;
        public SkillTarget Target;
        /// <summary>MultiEnemy일 때 대상 수.</summary>
        public int TargetCount = 1;
        /// <summary>ChainEnemies일 때 대상별 배율 (예: 140% → 100% → 70%).</summary>
        public double[] ChainMults = Array.Empty<double>();
        public int Cooldown;
        public double DamageMult;
        public int Hits = 1;
        public double HealRatio;
        /// <summary>기본 공격 성공률에 더하는 보정 (−10% ~ +10%).</summary>
        public double SuccessBonus;
        /// <summary>타격마다 치명타가 날 확률.</summary>
        public double CritChance;
        public bool GuaranteedCrit;
        /// <summary>전투 첫 턴에 쓰면 확정 치명타 (기습).</summary>
        public bool FirstTurnCrit;
        /// <summary>다음에 쓰는 공격 스킬을 확정 치명타로 만든다 (연막).</summary>
        public bool GrantsNextCrit;
        /// <summary>대상 HP가 이 비율 이하이면 피해 × ExecuteMult (암살).</summary>
        public double ExecuteThreshold;
        public double ExecuteMult = 1.0;
        public StatusApply[] Statuses = Array.Empty<StatusApply>();
        /// <summary>기획서 표의 효과 문구.</summary>
        public string Effect = "";
        /// <summary>역할 태그 (단일 · 광역 · 상태 · 보조 · 방어 · 회복 · 광역 상태 · 단일 상태). 스킬을 고를 때 참고.</summary>
        public string Role = "";

        public int ReqLevel => SkillDb.TierRequirementLevel[(int)Tier];
        public Rank ReqRank => SkillDb.TierRequirementRank[(int)Tier];
        public bool IsAttack => DamageMult > 0 || ChainMults.Length > 0;
        public bool NeedsTarget => Target == SkillTarget.SingleEnemy || Target == SkillTarget.MultiEnemy || Target == SkillTarget.ChainEnemies;

        /// <summary>"성공률 −5%" / "성공률 100%" / "" (보정 없음)</summary>
        public string SuccessText
        {
            get
            {
                if (Target == SkillTarget.Self) return "성공률 100%";
                if (Math.Abs(SuccessBonus) < 1e-9) return "";
                return "성공률 " + (SuccessBonus > 0 ? "+" : "−") + Math.Round(Math.Abs(SuccessBonus) * 100) + "%";
            }
        }

        /// <summary>예: "단일 250% · 재사용 4턴"</summary>
        public string Description => Effect + " · 재사용 " + Cooldown + "턴";
    }

    public static class SkillDb
    {
        public static readonly int[] TierRequirementLevel = { 1, 8, 18, 30 };
        public static readonly Rank[] TierRequirementRank = { Rank.F, Rank.E, Rank.D, Rank.C };

        private static StatusApply S(StatusType t, int v, int turns, bool self = false, double chance = 1.0) =>
            new StatusApply(t, v, turns, self, chance);

        private const int W = (int)Job.Warrior, A = (int)Job.Archer, R = (int)Job.Rogue, M = (int)Job.Mage;
        private const SkillTarget One = SkillTarget.SingleEnemy, Every = SkillTarget.AllEnemies, Self = SkillTarget.Self;

        public static readonly SkillDef[] AllSkills =
        {
            // v2.2: 직업마다 10개 (하급 3 · 중급 3 · 상급 2 · 최상급 2, 도적만 하급 4 · 중급 2 · 상급 2 · 최상급 2).
            // 성공률 보정은 기본 공격보다 낮게 (저위력 −3~4%, 광역·고위력 −8~12%), 자신에게 거는 스킬은 100%.
            // 역할 태그(단일 · 광역 · 상태 · 보조 · 방어 · 회복)는 스킬을 고를 때 참고한다.

            // ── 전사: 높은 HP, 한 방이 큰 스킬, 재사용 3~8턴 ──
            new SkillDef { Id = "w_bash", Name = "강타", JobRestriction = W, Tier = SkillTier.Low, Target = One, DamageMult = 2.5, SuccessBonus = -0.10, Cooldown = 4, Role = "단일", Effect = "단일 250%" },
            new SkillDef { Id = "w_warcry", Name = "전투 함성", JobRestriction = W, Tier = SkillTier.Low, Target = Self, Cooldown = 6, Role = "보조", Statuses = new[] { S(StatusType.Empower, 20, 3, true) }, Effect = "강화 3턴" },
            new SkillDef { Id = "w_ram", Name = "몸통 박치기", JobRestriction = W, Tier = SkillTier.Low, Target = One, DamageMult = 1.3, SuccessBonus = -0.04, Cooldown = 3, Role = "상태", Statuses = new[] { S(StatusType.Weaken, 20, 2) }, Effect = "단일 130% + 약화 2턴" },
            new SkillDef { Id = "w_shield", Name = "방패 밀치기", JobRestriction = W, Tier = SkillTier.Mid, Target = One, DamageMult = 1.5, SuccessBonus = -0.04, Cooldown = 5, Role = "상태", Statuses = new[] { S(StatusType.Stun, 1, 1, false, 0.6) }, Effect = "단일 150% + 60% 확률로 기절 1턴" },
            new SkillDef { Id = "w_guard", Name = "철벽 태세", JobRestriction = W, Tier = SkillTier.Mid, Target = Self, Cooldown = 6, Role = "방어", Statuses = new[] { S(StatusType.Fortify, 20, 3, true) }, Effect = "철벽 3턴" },
            new SkillDef { Id = "w_will", Name = "불굴", JobRestriction = W, Tier = SkillTier.Mid, Target = Self, Cooldown = 7, Role = "회복", Statuses = new[] { S(StatusType.Regen, 5, 3, true) }, Effect = "재생 3턴" },
            new SkillDef { Id = "w_whirl", Name = "회전 베기", JobRestriction = W, Tier = SkillTier.High, Target = Every, DamageMult = 1.8, SuccessBonus = -0.08, Cooldown = 6, Role = "광역", Effect = "모든 적 180%" },
            new SkillDef { Id = "w_roar", Name = "위협의 포효", JobRestriction = W, Tier = SkillTier.High, Target = Every, SuccessBonus = -0.04, Cooldown = 7, Role = "광역 상태", Statuses = new[] { S(StatusType.Weaken, 20, 3) }, Effect = "모든 적 약화 3턴" },
            new SkillDef { Id = "w_earth", Name = "대지 가르기", JobRestriction = W, Tier = SkillTier.Top, Target = Every, DamageMult = 3.5, SuccessBonus = -0.12, Cooldown = 8, Role = "광역", Statuses = new[] { S(StatusType.Vulnerable, 20, 2) }, Effect = "모든 적 350% + 취약 2턴" },
            new SkillDef { Id = "w_strike", Name = "전쟁의 일격", JobRestriction = W, Tier = SkillTier.Top, Target = One, DamageMult = 4.5, SuccessBonus = -0.12, Cooldown = 8, Role = "단일", Statuses = new[] { S(StatusType.Empower, 20, 3, true) }, Effect = "단일 450% + 강화 3턴" },

            // ── 궁수: 짧은 재사용, 여러 번 때리기 ──
            new SkillDef { Id = "a_aim", Name = "조준 사격", JobRestriction = A, Tier = SkillTier.Low, Target = One, DamageMult = 1.4, SuccessBonus = -0.03, Cooldown = 1, Role = "단일", Effect = "단일 140%" },
            new SkillDef { Id = "a_double", Name = "연속 사격", JobRestriction = A, Tier = SkillTier.Low, Target = One, DamageMult = 0.6, Hits = 3, SuccessBonus = -0.03, Cooldown = 2, Role = "단일", Effect = "단일 60% × 3회" },
            new SkillDef { Id = "a_scatter", Name = "산탄 사격", JobRestriction = A, Tier = SkillTier.Low, Target = Every, DamageMult = 0.55, SuccessBonus = -0.08, Cooldown = 3, Role = "광역", Effect = "모든 적 55%" },
            new SkillDef { Id = "a_poison", Name = "독화살", JobRestriction = A, Tier = SkillTier.Mid, Target = One, DamageMult = 0.8, SuccessBonus = -0.03, Cooldown = 2, Role = "상태", Statuses = new[] { S(StatusType.Poison, 4, 3) }, Effect = "단일 80% + 독 3턴" },
            new SkillDef { Id = "a_flash", Name = "섬광 화살", JobRestriction = A, Tier = SkillTier.Mid, Target = One, DamageMult = 0.7, Hits = 2, SuccessBonus = -0.04, Cooldown = 3, Role = "상태", Statuses = new[] { S(StatusType.Blind, 15, 2) }, Effect = "단일 70% × 2회 + 실명 2턴" },
            new SkillDef { Id = "a_weak", Name = "약점 노리기", JobRestriction = A, Tier = SkillTier.Mid, Target = One, DamageMult = 0.9, SuccessBonus = -0.04, Cooldown = 4, Role = "상태", Statuses = new[] { S(StatusType.Vulnerable, 20, 3) }, Effect = "단일 90% + 취약 3턴" },
            new SkillDef { Id = "a_rain", Name = "화살비", JobRestriction = A, Tier = SkillTier.High, Target = Every, DamageMult = 0.7, Hits = 2, SuccessBonus = -0.08, Cooldown = 3, Role = "광역", Effect = "모든 적 70% × 2회" },
            new SkillDef { Id = "a_pierce", Name = "관통 사격", JobRestriction = A, Tier = SkillTier.High, Target = SkillTarget.MultiEnemy, TargetCount = 2, DamageMult = 1.3, SuccessBonus = -0.04, Cooldown = 3, Role = "단일", Effect = "적 2명 130%" },
            new SkillDef { Id = "a_storm", Name = "폭풍 사격", JobRestriction = A, Tier = SkillTier.Top, Target = One, DamageMult = 0.5, Hits = 7, SuccessBonus = -0.08, Cooldown = 4, Role = "단일", Effect = "단일 50% × 7회" },
            new SkillDef { Id = "a_volley", Name = "일제 사격", JobRestriction = A, Tier = SkillTier.Top, Target = Every, DamageMult = 0.5, Hits = 4, SuccessBonus = -0.12, Cooldown = 5, Role = "광역", Effect = "모든 적 50% × 4회" },

            // ── 도적: 스킬 피해는 다른 직업의 80%, 대신 치명타 피해 ×2.3 ──
            new SkillDef { Id = "r_ambush", Name = "기습", JobRestriction = R, Tier = SkillTier.Low, Target = One, DamageMult = 1.1, SuccessBonus = -0.04, CritChance = 0.5, FirstTurnCrit = true, Cooldown = 2, Role = "단일", Effect = "단일 110%, 치명타 50%. 전투 첫 턴이면 확정 치명타" },
            new SkillDef { Id = "r_venom", Name = "독 바르기", JobRestriction = R, Tier = SkillTier.Low, Target = One, DamageMult = 0.8, SuccessBonus = -0.03, CritChance = 0.2, Cooldown = 3, Role = "상태", Statuses = new[] { S(StatusType.Poison, 4, 3) }, Effect = "단일 80% + 독 3턴, 치명타 20%" },
            new SkillDef { Id = "r_keen", Name = "약점 간파", JobRestriction = R, Tier = SkillTier.Low, Target = Self, Cooldown = 5, Role = "보조", Statuses = new[] { S(StatusType.Keen, 25, 3, true) }, Effect = "예리함 3턴 (스킬 치명타 확률 +25%)" },
            new SkillDef { Id = "r_shuriken", Name = "표창 던지기", JobRestriction = R, Tier = SkillTier.Low, Target = Every, DamageMult = 0.5, SuccessBonus = -0.08, CritChance = 0.2, Cooldown = 3, Role = "광역", Effect = "모든 적 50%, 치명타 20%" },
            new SkillDef { Id = "r_vital", Name = "급소 찌르기", JobRestriction = R, Tier = SkillTier.Mid, Target = One, DamageMult = 1.05, GuaranteedCrit = true, SuccessBonus = -0.08, Cooldown = 4, Role = "단일", Statuses = new[] { S(StatusType.Bleed, 40, 2) }, Effect = "단일 105%, 확정 치명타 + 출혈 2턴" },
            new SkillDef { Id = "r_smoke", Name = "연막", JobRestriction = R, Tier = SkillTier.Mid, Target = Self, GrantsNextCrit = true, Cooldown = 5, Role = "보조", Statuses = new[] { S(StatusType.Swift, 15, 3, true) }, Effect = "날렵함 3턴, 다음에 쓰는 스킬은 확정 치명타" },
            new SkillDef { Id = "r_storm", Name = "칼날 폭풍", JobRestriction = R, Tier = SkillTier.High, Target = Every, DamageMult = 0.7, CritChance = 0.4, SuccessBonus = -0.08, Cooldown = 5, Role = "광역", Statuses = new[] { S(StatusType.Bleed, 30, 2) }, Effect = "모든 적 70%, 치명타 40% + 출혈 2턴" },
            new SkillDef { Id = "r_cruel", Name = "살의", JobRestriction = R, Tier = SkillTier.High, Target = Self, Cooldown = 6, Role = "보조", Statuses = new[] { S(StatusType.Cruel, 50, 3, true) }, Effect = "잔혹함 3턴 (치명타 피해 +50%)" },
            new SkillDef { Id = "r_assassin", Name = "암살", JobRestriction = R, Tier = SkillTier.Top, Target = One, DamageMult = 2.0, GuaranteedCrit = true, ExecuteThreshold = 0.3, ExecuteMult = 1.5, SuccessBonus = -0.12, Cooldown = 6, Role = "단일", Effect = "단일 200%, 확정 치명타. 대상 HP 30% 이하면 피해 ×1.5" },
            new SkillDef { Id = "r_dance", Name = "그림자 춤", JobRestriction = R, Tier = SkillTier.Top, Target = Every, DamageMult = 1.0, CritChance = 0.6, SuccessBonus = -0.12, Cooldown = 7, Role = "광역", Statuses = new[] { S(StatusType.Bleed, 30, 3) }, Effect = "모든 적 100%, 치명타 60% + 출혈 3턴" },

            // ── 마법사: 낮은 HP, 강한 화력과 다양한 범위 (방어·회복·보조 스킬 없이 공격·광역·상태로만) ──
            new SkillDef { Id = "m_fireball", Name = "화염구", JobRestriction = M, Tier = SkillTier.Low, Target = One, DamageMult = 1.8, SuccessBonus = -0.04, Cooldown = 2, Role = "단일", Statuses = new[] { S(StatusType.Burn, 30, 2) }, Effect = "단일 180% + 화상 2턴" },
            new SkillDef { Id = "m_bolt", Name = "마력 화살", JobRestriction = M, Tier = SkillTier.Low, Target = One, DamageMult = 1.2, SuccessBonus = -0.03, Cooldown = 1, Role = "단일", Effect = "단일 120%" },
            new SkillDef { Id = "m_shard", Name = "불꽃 파편", JobRestriction = M, Tier = SkillTier.Low, Target = Every, DamageMult = 0.5, SuccessBonus = -0.08, Cooldown = 3, Role = "광역", Effect = "모든 적 50%" },
            new SkillDef { Id = "m_ice", Name = "얼음 창", JobRestriction = M, Tier = SkillTier.Mid, Target = SkillTarget.MultiEnemy, TargetCount = 2, DamageMult = 1.3, SuccessBonus = -0.04, Cooldown = 3, Role = "광역 상태", Statuses = new[] { S(StatusType.Weaken, 20, 2) }, Effect = "적 2명 130% + 약화 2턴" },
            new SkillDef { Id = "m_chain", Name = "연쇄 번개", JobRestriction = M, Tier = SkillTier.Mid, Target = SkillTarget.ChainEnemies, ChainMults = new[] { 1.4, 1.0, 0.7 }, SuccessBonus = -0.04, Cooldown = 3, Role = "광역", Effect = "적 3명에게 차례로 140% → 100% → 70%" },
            new SkillDef { Id = "m_silence", Name = "침묵의 술법", JobRestriction = M, Tier = SkillTier.Mid, Target = One, DamageMult = 1.0, SuccessBonus = -0.04, Cooldown = 4, Role = "상태", Statuses = new[] { S(StatusType.Silence, 1, 2) }, Effect = "단일 100% + 침묵 2턴" },
            new SkillDef { Id = "m_meteor", Name = "운석 낙하", JobRestriction = M, Tier = SkillTier.High, Target = Every, DamageMult = 1.6, SuccessBonus = -0.10, Cooldown = 5, Role = "광역", Statuses = new[] { S(StatusType.Burn, 35, 2) }, Effect = "모든 적 160% + 화상 2턴" },
            new SkillDef { Id = "m_prison", Name = "빙결 감옥", JobRestriction = M, Tier = SkillTier.High, Target = One, DamageMult = 1.5, SuccessBonus = -0.06, Cooldown = 5, Role = "단일 상태", Statuses = new[] { S(StatusType.Stun, 1, 1, false, 0.7) }, Effect = "단일 150% + 70% 확률 기절 1턴" },
            new SkillDef { Id = "m_overload", Name = "마력 폭주", JobRestriction = M, Tier = SkillTier.Top, Target = One, DamageMult = 4.0, SuccessBonus = -0.12, Cooldown = 6, Role = "단일", Effect = "단일 400%" },
            new SkillDef { Id = "m_apocalypse", Name = "종말의 불꽃", JobRestriction = M, Tier = SkillTier.Top, Target = Every, DamageMult = 2.5, SuccessBonus = -0.12, Cooldown = 8, Role = "광역", Statuses = new[] { S(StatusType.Burn, 35, 3) }, Effect = "모든 적 250% + 화상 3턴" },
        };

        /// <summary>호환용 이름 (예전 코드·테스트).</summary>
        public static SkillDef[] All => AllSkills;

        private static readonly Dictionary<string, SkillDef> ById = new Dictionary<string, SkillDef>();

        static SkillDb()
        {
            foreach (var s in AllSkills) ById[s.Id] = s;
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

        /// <summary>스킬서로 나올 수 있는 스킬: 그 직업, 장착 레벨 ≤ 지금 레벨 + 5.</summary>
        public static List<SkillDef> Obtainable(Character c, Job job, params SkillTier[] tiers)
        {
            var list = ForJob(job, tiers.Length > 0 ? tiers : (SkillTier[])Enum.GetValues(typeof(SkillTier)));
            list.RemoveAll(s => s.ReqLevel > c.Level + GameBalance.SkillBookLevelWindow);
            return list;
        }

        /// <summary>지금 레벨보다 높은 스킬은 절반 확률로 뺀다 (남는 것이 있을 때만, v2.0).</summary>
        public static List<SkillDef> PreferOwnLevel(List<SkillDef> list, Character c, Rng rng)
        {
            if (!rng.Chance(GameBalance.OverLevelReroll)) return list;
            var own = list.FindAll(s => s.ReqLevel <= c.Level);
            return own.Count > 0 ? own : list;
        }

        public static List<SkillDef> ForJob(Job job, params SkillTier[] tiers)
        {
            var list = new List<SkillDef>();
            foreach (var s in AllSkills)
                if ((s.JobRestriction < 0 || s.JobRestriction == (int)job) && Array.IndexOf(tiers, s.Tier) >= 0)
                    list.Add(s);
            return list;
        }
    }
}

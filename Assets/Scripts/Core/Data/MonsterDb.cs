using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>
    /// 상태 이상 부여 정의. 출혈·화상의 Value는 "시전자 공격력 대비 %"로 정의하고,
    /// 걸리는 순간 고정 피해량으로 환산한다. 나머지는 % 또는 1(기절·침묵).
    /// </summary>
    public sealed class StatusApply
    {
        public StatusType Type;
        public int Value;
        public int Turns;
        public bool OnSelf;
        public double Chance = 1.0;

        public StatusApply(StatusType type, int value, int turns, bool onSelf = false, double chance = 1.0)
        {
            Type = type;
            Value = value;
            Turns = turns;
            OnSelf = onSelf;
            Chance = chance;
        }
    }

    public sealed class EnemySkill
    {
        public string Name;
        public double DamageMult;
        public double UseChance;
        public StatusApply Status;

        public EnemySkill(string name, double damageMult, double useChance, StatusApply status = null)
        {
            Name = name;
            DamageMult = damageMult;
            UseChance = useChance;
            Status = status;
        }
    }

    public sealed class MonsterSpecies
    {
        public string Id;
        public string Name;
        /// <summary>0 = 1~10층, 1 = 11~20층, 2 = 21~30층</summary>
        public int Tier;
        public double HpMul = 1, AttackMul = 1, DefenseMul = 1, RequirementMul = 1;
        public string MaterialId;
        public string MaterialName;
        public EnemySkill[] Skills = Array.Empty<EnemySkill>();
        public bool UniqueBoss;
        /// <summary>턴마다 최대 HP % 회복 (트롤).</summary>
        public int RegenPercent;
    }

    public sealed class FloorTheme
    {
        public string Name;
        public string[] SpeciesIds;
        public string UniqueBossId;
    }

    /// <summary>층 테마와 몬스터. 10층마다 테마가 바뀌고 10층 단위 마지막 층에 고유 보스가 나온다.</summary>
    public static class MonsterDb
    {
        private static StatusApply S(StatusType t, int v, int turns, bool self = false, double chance = 1.0) =>
            new StatusApply(t, v, turns, self, chance);

        public static readonly MonsterSpecies[] AllSpecies =
        {
            // ── 1~10층 어두운 동굴 ──
            new MonsterSpecies { Id = "slime", Name = "슬라임", Tier = 0, HpMul = 1.0, AttackMul = 0.8, DefenseMul = 0.6, MaterialId = "mat_slime", MaterialName = "점액",
                Skills = new[] { new EnemySkill("산성 점액", 0.8, 0.25, S(StatusType.Weaken, 20, 2)) } },
            new MonsterSpecies { Id = "goblin", Name = "고블린", Tier = 0, MaterialId = "mat_goblin", MaterialName = "고블린 귀" },
            new MonsterSpecies { Id = "goblin_archer", Name = "고블린 궁수", Tier = 0, HpMul = 0.75, AttackMul = 1.1, MaterialId = "mat_goblin", MaterialName = "고블린 귀",
                Skills = new[] { new EnemySkill("가시 화살", 0.9, 0.3, S(StatusType.Bleed, 25, 2)) } },
            new MonsterSpecies { Id = "bat", Name = "거대 박쥐", Tier = 0, HpMul = 0.8, AttackMul = 0.9, RequirementMul = 1.15, MaterialId = "mat_bat", MaterialName = "박쥐 날개" },
            new MonsterSpecies { Id = "kobold", Name = "코볼트", Tier = 0, DefenseMul = 1.3, MaterialId = "mat_kobold", MaterialName = "코볼트 이빨" },
            new MonsterSpecies { Id = "spider", Name = "거대 거미", Tier = 0, HpMul = 0.9, MaterialId = "mat_spider", MaterialName = "거미 독샘",
                Skills = new[] { new EnemySkill("독니", 0.9, 0.35, S(StatusType.Poison, 4, 3)) } },
            new MonsterSpecies { Id = "wolf", Name = "늑대", Tier = 0, AttackMul = 1.15, MaterialId = "mat_wolf", MaterialName = "늑대 가죽",
                Skills = new[] { new EnemySkill("물어뜯기", 1.1, 0.25, S(StatusType.Bleed, 25, 2)) } },
            new MonsterSpecies { Id = "goblin_king", Name = "고블린 왕", Tier = 0, UniqueBoss = true, DefenseMul = 1.2, MaterialId = "mat_goblin", MaterialName = "고블린 귀",
                Skills = new[]
                {
                    new EnemySkill("왕의 호령", 0, 0.2, S(StatusType.Empower, 20, 3, true)),
                    new EnemySkill("내려찍기", 1.4, 0.25, S(StatusType.Stun, 1, 1, false, 0.5)),
                } },

            // ── 11~20층 버려진 묘지 ──
            new MonsterSpecies { Id = "orc", Name = "오크", Tier = 1, HpMul = 1.2, AttackMul = 1.1, MaterialId = "mat_orc", MaterialName = "오크 송곳니" },
            new MonsterSpecies { Id = "skeleton", Name = "스켈레톤", Tier = 1, HpMul = 0.9, DefenseMul = 1.4, MaterialId = "mat_bone", MaterialName = "뼛조각" },
            new MonsterSpecies { Id = "zombie", Name = "좀비", Tier = 1, HpMul = 1.4, AttackMul = 0.9, RequirementMul = 0.85, MaterialId = "mat_zombie", MaterialName = "썩은 살점",
                Skills = new[] { new EnemySkill("부패한 손톱", 0.9, 0.3, S(StatusType.Poison, 4, 3)) } },
            new MonsterSpecies { Id = "ghoul", Name = "구울", Tier = 1, AttackMul = 1.1, MaterialId = "mat_ghoul", MaterialName = "구울 손톱",
                Skills = new[] { new EnemySkill("찢어발기기", 1.0, 0.3, S(StatusType.Bleed, 30, 2)) } },
            new MonsterSpecies { Id = "orc_shaman", Name = "오크 주술사", Tier = 1, HpMul = 0.8, AttackMul = 1.2, MaterialId = "mat_charm", MaterialName = "주술 부적",
                Skills = new[]
                {
                    new EnemySkill("저주", 0.5, 0.25, S(StatusType.Weaken, 20, 2)),
                    new EnemySkill("불꽃 주술", 1.0, 0.25, S(StatusType.Burn, 30, 2)),
                } },
            new MonsterSpecies { Id = "gargoyle", Name = "가고일", Tier = 1, HpMul = 1.1, DefenseMul = 1.6, MaterialId = "mat_stone", MaterialName = "석상 파편" },
            new MonsterSpecies { Id = "lich", Name = "리치", Tier = 1, UniqueBoss = true, AttackMul = 1.1, MaterialId = "mat_bone", MaterialName = "뼛조각",
                Skills = new[]
                {
                    new EnemySkill("공포의 속삭임", 0.5, 0.2, S(StatusType.Fear, 10, 2)),
                    new EnemySkill("봉인", 0.6, 0.2, S(StatusType.Silence, 1, 2)),
                    new EnemySkill("영혼 불꽃", 1.3, 0.25, S(StatusType.Burn, 35, 3)),
                } },

            // ── 21~30층 용의 둥지 ──
            new MonsterSpecies { Id = "lizardman", Name = "리자드맨", Tier = 2, AttackMul = 1.1, MaterialId = "mat_scale", MaterialName = "도마뱀 비늘" },
            new MonsterSpecies { Id = "wyvern", Name = "와이번", Tier = 2, HpMul = 1.1, AttackMul = 1.2, RequirementMul = 1.1, MaterialId = "mat_wyvern", MaterialName = "와이번 날개막",
                Skills = new[] { new EnemySkill("독침 꼬리", 1.0, 0.3, S(StatusType.Poison, 5, 3)) } },
            new MonsterSpecies { Id = "golem", Name = "골렘", Tier = 2, HpMul = 1.6, AttackMul = 0.9, DefenseMul = 2.0, RequirementMul = 0.8, MaterialId = "mat_core", MaterialName = "골렘 핵",
                Skills = new[] { new EnemySkill("대지 강타", 1.3, 0.2, S(StatusType.Stun, 1, 1, false, 0.5)) } },
            new MonsterSpecies { Id = "troll", Name = "트롤", Tier = 2, HpMul = 1.5, AttackMul = 1.1, RegenPercent = 5, MaterialId = "mat_troll", MaterialName = "트롤 피" },
            new MonsterSpecies { Id = "minotaur", Name = "미노타우로스", Tier = 2, HpMul = 1.3, AttackMul = 1.3, MaterialId = "mat_horn", MaterialName = "미노타우로스 뿔",
                Skills = new[] { new EnemySkill("돌진", 1.5, 0.25, S(StatusType.Stun, 1, 1, false, 0.4)) } },
            new MonsterSpecies { Id = "dark_elf", Name = "다크 엘프", Tier = 2, HpMul = 0.9, AttackMul = 1.2, RequirementMul = 1.15, MaterialId = "mat_silk", MaterialName = "어둠 비단",
                Skills = new[]
                {
                    new EnemySkill("그림자 가루", 0.6, 0.25, S(StatusType.Blind, 15, 2)),
                    new EnemySkill("독칼", 1.0, 0.25, S(StatusType.Poison, 5, 3)),
                } },
            // ── 특수: "수상한 상자" 판정 실패 시에만 등장 (층 테마 무관) ──
            new MonsterSpecies { Id = "mimic", Name = "미믹", Tier = -1, HpMul = GameBalance.MimicHp, AttackMul = GameBalance.MimicAttack,
                Skills = new[] { new EnemySkill("물어뜯기", 1.0, 0.35, S(StatusType.Bleed, 30, 2)) } },
            // ── 특수: "떠도는 모험가" 이벤트에서 싸움을 걸었을 때만 등장 ──
            new MonsterSpecies { Id = "wanderer", Name = "떠도는 모험가", Tier = -1, HpMul = 1.1, AttackMul = 1.1, RequirementMul = 1.1,
                Skills = new[]
                {
                    new EnemySkill("연속 베기", 1.4, 0.25),
                    new EnemySkill("독 묻은 단검", 0.8, 0.2, S(StatusType.Poison, 5, 3)),
                } },
            new MonsterSpecies { Id = "dragon", Name = "드래곤", Tier = 2, UniqueBoss = true, HpMul = 1.2, AttackMul = 1.15, DefenseMul = 1.3, MaterialId = "mat_scale", MaterialName = "도마뱀 비늘",
                Skills = new[]
                {
                    new EnemySkill("화염 숨결", 1.5, 0.3, S(StatusType.Burn, 40, 3)),
                    new EnemySkill("포효", 0.3, 0.2, S(StatusType.Fear, 10, 2)),
                    new EnemySkill("꼬리 후리기", 1.2, 0.2, S(StatusType.Vulnerable, 20, 2)),
                } },
        };

        public static readonly FloorTheme[] Themes =
        {
            new FloorTheme { Name = "어두운 동굴", SpeciesIds = new[] { "slime", "goblin", "goblin_archer", "bat", "kobold", "spider", "wolf" }, UniqueBossId = "goblin_king" },
            new FloorTheme { Name = "버려진 묘지", SpeciesIds = new[] { "orc", "skeleton", "zombie", "ghoul", "orc_shaman", "gargoyle" }, UniqueBossId = "lich" },
            new FloorTheme { Name = "용의 둥지", SpeciesIds = new[] { "lizardman", "wyvern", "golem", "troll", "minotaur", "dark_elf" }, UniqueBossId = "dragon" },
        };

        private static readonly Dictionary<string, MonsterSpecies> ById = new Dictionary<string, MonsterSpecies>();

        static MonsterDb()
        {
            foreach (var s in AllSpecies) ById[s.Id] = s;
        }

        public static MonsterSpecies Get(string id) => ById.TryGetValue(id, out var s) ? s : null;

        public static int ThemeIndex(int floor) => GameBalance.Clamp((floor - 1) / 10, 0, Themes.Length - 1);

        public static FloorTheme ThemeFor(int floor) => Themes[ThemeIndex(floor)];

        public static bool IsUniqueBossFloor(int floor) => floor % 10 == 0;
    }
}

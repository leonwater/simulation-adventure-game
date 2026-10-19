using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>보스 특성 (기획서 v1.6). 수치는 층이 깊을수록 강해진다.</summary>
    public enum BossTrait
    {
        /// <summary>방어막: 공격 N번을 피해 없이 막는다 (다단 공격은 1타당 1회).</summary>
        Barrier,
        /// <summary>보호막: 최대 HP의 일부만큼 먼저 깎이는 막.</summary>
        Shield,
        /// <summary>가시 비늘: 받은 피해의 일부를 공격자에게 되돌린다.</summary>
        Thorns,
        /// <summary>혼신의 일격: 1턴 기를 모은 뒤 큰 피해, 그 뒤 몇 턴 탈진.</summary>
        Smash,
        /// <summary>연속 공격: 약한 공격을 여러 번.</summary>
        Flurry,
        /// <summary>흡혈: 준 피해의 일부만큼 회복.</summary>
        Lifesteal,
        /// <summary>광폭화: HP 50% 이하에서 공격력 증가 (한 번).</summary>
        Enrage,
        /// <summary>분열: 쓰러지면 작은 개체로 나뉘어 2페이즈.</summary>
        Split,
        /// <summary>재생 의식: HP가 낮아지면 1턴 영창 뒤 크게 회복.</summary>
        Ritual,
        /// <summary>부활: 처음 쓰러지면 한 번 일어난다.</summary>
        Revive,
        /// <summary>부하 소환: 몇 턴마다 졸개를 부른다 (보스가 쓰러지면 흩어진다).</summary>
        Summon
    }

    /// <summary>보스 한 마리의 특성 수치와 전투 중 상태.</summary>
    public class BossKit
    {
        public readonly List<BossTrait> Traits = new List<BossTrait>();

        public int Barrier;
        public int Shield, MaxShield;
        public double Thorns;

        public int SmashEvery;
        public double SmashMult;
        public int ExhaustTurns;
        public int SmashTimer;
        public bool Charging;
        public int Exhausted;

        public int FlurryHits;
        public double FlurryMult, FlurryChance;

        public double Lifesteal;

        public double EnrageAttack;
        public bool Enraged;

        public int SplitCount;
        public double SplitHp;

        public double RitualAt, RitualHeal;
        public int RitualUses;
        public bool Chanting;

        public double ReviveHp;
        public int Revives;

        public string SummonId, SummonName;
        public int SummonEvery, SummonMax, SummonTimer;
        public readonly List<Combatant> Minions = new List<Combatant>();

        /// <summary>다음 턴 행동 예고 (보스 위에 표시). 없으면 빈 문자열.</summary>
        public string Intent = "";

        public bool Has(BossTrait t) => Traits.Contains(t);
    }

    public static class BossTraits
    {
        // 종족별 우두머리 특성 (기획서 v1.6). 고유 보스는 2~3개 조합.
        private static readonly Dictionary<string, BossTrait[]> BySpecies = new Dictionary<string, BossTrait[]>
        {
            { "slime", new[] { BossTrait.Split } },
            { "goblin", new[] { BossTrait.Enrage } },
            { "goblin_archer", new[] { BossTrait.Flurry } },
            { "bat", new[] { BossTrait.Lifesteal } },
            { "kobold", new[] { BossTrait.Barrier } },
            { "spider", new[] { BossTrait.Summon } },
            { "wolf", new[] { BossTrait.Flurry } },
            { "goblin_king", new[] { BossTrait.Smash, BossTrait.Summon } },
            { "orc", new[] { BossTrait.Smash } },
            { "skeleton", new[] { BossTrait.Barrier } },
            { "zombie", new[] { BossTrait.Revive } },
            { "ghoul", new[] { BossTrait.Lifesteal } },
            { "orc_shaman", new[] { BossTrait.Shield } },
            { "gargoyle", new[] { BossTrait.Barrier } },
            { "lich", new[] { BossTrait.Shield, BossTrait.Summon, BossTrait.Ritual } },
            { "lizardman", new[] { BossTrait.Thorns } },
            { "wyvern", new[] { BossTrait.Flurry } },
            { "golem", new[] { BossTrait.Barrier } },
            { "troll", new[] { BossTrait.Ritual } },
            { "minotaur", new[] { BossTrait.Smash } },
            { "dark_elf", new[] { BossTrait.Shield } },
            { "dragon", new[] { BossTrait.Enrage, BossTrait.Ritual, BossTrait.Smash } },
        };

        // 부하 소환: 보스 → (졸개 종족, 이름, HP 배율)
        private static readonly Dictionary<string, (string id, string name, double hp)> Minion = new Dictionary<string, (string, string, double)>
        {
            { "spider", ("spider", "새끼 거미", 0.6) },
            { "goblin_king", ("goblin", "고블린 졸개", 0.8) },
            { "lich", ("skeleton", "해골 병사", 0.8) },
        };

        public static BossTrait[] For(string speciesId) =>
            speciesId != null && BySpecies.TryGetValue(speciesId, out var t) ? t : Array.Empty<BossTrait>();

        public static string Name(BossTrait t)
        {
            switch (t)
            {
                case BossTrait.Barrier: return "방어막";
                case BossTrait.Shield: return "보호막";
                case BossTrait.Thorns: return "가시 비늘";
                case BossTrait.Smash: return "혼신의 일격";
                case BossTrait.Flurry: return "연속 공격";
                case BossTrait.Lifesteal: return "흡혈";
                case BossTrait.Enrage: return "광폭화";
                case BossTrait.Split: return "분열";
                case BossTrait.Ritual: return "재생 의식";
                case BossTrait.Revive: return "부활";
                default: return "부하 소환";
            }
        }

        /// <summary>
        /// 보스에게 특성을 붙인다. 수치는 층(1~30)에 따라 커지고, 특성이 강한 만큼 HP·공격력을 낮춰 맞춘다 (수치 보정).
        /// </summary>
        public static void Equip(Combatant boss, int floor)
        {
            var traits = For(boss.Species?.Id);
            if (traits.Length == 0) return;
            int f = GameBalance.Clamp(floor, 1, GameBalance.MaxFloor);
            var k = new BossKit();
            k.Traits.AddRange(traits);
            double hpMul = 1, atkMul = 1, shield = 0;
            foreach (var t in traits)
            {
                switch (t)
                {
                    case BossTrait.Barrier:
                        k.Barrier = 1 + (f - 1) / 8;                 // 1~8층 1회 · 9~16층 2회 · 17~24층 3회 · 25층~ 4회
                        hpMul *= 0.8;
                        break;
                    case BossTrait.Shield:
                        shield = 0.10 + f * 0.005;                     // 10층 15% · 20층 20% · 30층 25% (보정 뒤 HP 기준)
                        hpMul *= 1 - shield * 0.6;
                        break;
                    case BossTrait.Thorns:
                        k.Thorns = 0.015 + f * 0.0005;                 // 21층 2.6% · 30층 3% (보스 HP가 커서 조금만 돌려줘도 아프다)
                        hpMul *= 0.9;
                        break;
                    case BossTrait.Smash:
                        k.SmashEvery = f < 15 ? 4 : 3;
                        k.SmashMult = 2.0 + f * 0.025;                 // 10층 ×2.25 · 30층 ×2.75
                        k.ExhaustTurns = f < 15 ? 2 : 1;
                        atkMul *= 1.25;                                // 기를 모으고 쉬는 턴만큼 평소 공격을 세게
                        break;
                    case BossTrait.Flurry:
                        k.FlurryHits = 3 + f / 12;                     // 3회 · 12층~ 4회 · 24층~ 5회
                        k.FlurryMult = 0.38;
                        k.FlurryChance = 0.35;
                        break;
                    case BossTrait.Lifesteal:
                        k.Lifesteal = 0.20 + f * 0.005;                // 5층 22% · 15층 27%
                        hpMul *= 0.95;
                        break;
                    case BossTrait.Enrage:
                        k.EnrageAttack = 0.20 + f * 0.005;             // 공격력 +20%(1층) ~ +35%(30층)
                        atkMul *= 0.95;
                        break;
                    case BossTrait.Split:
                        k.SplitCount = f < 4 ? 2 : 3;
                        k.SplitHp = f < 4 ? 0.25 : 0.20;               // 작은 개체 하나의 HP (보스 최대 HP 대비)
                        hpMul *= 0.65;
                        break;
                    case BossTrait.Ritual:
                        k.RitualAt = 0.30;
                        k.RitualHeal = 0.15 + f * 0.005;               // 20층 25% · 30층 30%
                        k.RitualUses = f >= 25 ? 2 : 1;
                        hpMul *= 0.9;
                        break;
                    case BossTrait.Revive:
                        k.ReviveHp = 0.20 + f * 0.005;                 // 11층 26% · 20층 30%
                        k.Revives = 1;
                        hpMul *= 0.8;
                        break;
                    case BossTrait.Summon:
                        if (Minion.TryGetValue(boss.Species.Id, out var m))
                        {
                            k.SummonId = m.id;
                            k.SummonName = m.name;
                        }
                        k.SummonEvery = 4;
                        k.SummonMax = f < 10 ? 1 : 2;
                        break;
                }
            }
            boss.MaxHp = boss.Hp = Math.Max(1, (int)Math.Round(boss.MaxHp * hpMul));
            boss.Attack = Math.Max(1, (int)Math.Round(boss.Attack * atkMul));
            if (shield > 0) k.MaxShield = k.Shield = Math.Max(1, (int)Math.Round(boss.MaxHp * shield));
            boss.Kit = k;
        }

        /// <summary>분열한 작은 개체: 보스 HP의 일부, 공격력 절반, 보상 없음.</summary>
        public static Combatant SplitChild(Combatant boss, int index)
        {
            var sp = boss.Species;
            int hp = Math.Max(1, (int)Math.Round(boss.MaxHp * boss.Kit.SplitHp));
            return new Combatant
            {
                Name = "작은 " + sp.Name + " " + (char)('A' + index),
                MaxHp = hp,
                Hp = hp,
                Attack = Math.Max(1, boss.Attack / 2),
                Defense = boss.Defense / 2,
                Requirement = boss.Requirement - 2,
                Species = sp,
                Skills = sp.Skills,
                NoReward = true,
            };
        }

        /// <summary>졸개: 그 층 일반 몬스터 수치 × HP 배율, 보상 없음.</summary>
        public static Combatant CreateMinion(Combatant boss, int floor, Difficulty diff, int index)
        {
            var sp = MonsterDb.Get(boss.Kit.SummonId) ?? boss.Species;
            var m = EnemyFactory.Create(sp, floor, diff, 0);
            double hpMul = Minion.TryGetValue(boss.Species.Id, out var def) ? def.hp : 0.8;
            m.MaxHp = m.Hp = Math.Max(1, (int)Math.Round(m.MaxHp * hpMul));
            m.Name = (boss.Kit.SummonName ?? sp.Name) + " " + (char)('A' + index);
            m.NoReward = true;
            return m;
        }
    }
}

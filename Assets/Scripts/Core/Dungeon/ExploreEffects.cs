using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>탐험 효과 (기획서 v1.5): 이벤트로 얻어 정해진 전투 횟수나 귀환할 때까지 남는다.</summary>
    public enum ExploreEffectType
    {
        /// <summary>턴마다 최대 HP 5% 회복.</summary>
        Regen,
        /// <summary>선택지 성공률 +10%.</summary>
        Focus,
        /// <summary>북소리: 다음 전투 방의 적 +1마리 (최대 4).</summary>
        Drum,
        /// <summary>악마의 계약: 공격력 +20%, 받는 피해 +15% (귀환까지).</summary>
        DemonPact,
        /// <summary>전투 첫 3턴 동안 공포.</summary>
        Fear,
        /// <summary>저주: 드롭률 -50% (다음 휴식 방까지, 없으면 귀환까지).</summary>
        Curse
    }

    [Serializable]
    public class ExploreEffect
    {
        public ExploreEffectType Type;
        /// <summary>남은 전투 횟수. -1이면 횟수 제한 없음 (계약: 귀환까지, 저주: 휴식 방까지).</summary>
        public int Battles;

        public ExploreEffect() { }

        public ExploreEffect(ExploreEffectType type, int battles)
        {
            Type = type;
            Battles = battles;
        }
    }

    public static class ExploreEffects
    {
        public const int RegenPercent = 5, FocusPercent = 10, FearPercent = 10, FearTurns = 3;
        public const double PactAttack = 0.20, PactTaken = 0.15, CurseDrop = 0.5;

        public static string Name(ExploreEffectType t)
        {
            switch (t)
            {
                case ExploreEffectType.Regen: return "재생";
                case ExploreEffectType.Focus: return "집중";
                case ExploreEffectType.Drum: return "북소리";
                case ExploreEffectType.DemonPact: return "악마의 계약";
                case ExploreEffectType.Fear: return "공포";
                default: return "저주";
            }
        }

        public static string Describe(ExploreEffectType t)
        {
            switch (t)
            {
                case ExploreEffectType.Regen: return "전투 중 턴마다 최대 HP " + RegenPercent + "% 회복";
                case ExploreEffectType.Focus: return "전투 중 선택지 성공률 +" + FocusPercent + "%";
                case ExploreEffectType.Drum: return "다음 전투 방의 적 +1마리 (최대 4)";
                case ExploreEffectType.DemonPact: return "공격력 +20%, 받는 피해 +15%";
                case ExploreEffectType.Fear: return "다음 전투 첫 " + FearTurns + "턴 동안 공포 (도주 외 성공률 -" + FearPercent + "%)";
                default: return "드롭률 -50%";
            }
        }

        public static string Remaining(ExploreEffect e)
        {
            if (e.Battles >= 0) return "전투 " + e.Battles + "회";
            return e.Type == ExploreEffectType.Curse ? "휴식 방까지" : "귀환까지";
        }

        /// <summary>효과를 얻는다. 같은 효과가 있으면 남은 횟수가 많은 쪽을 남긴다 (-1 = 무제한이 가장 큼).</summary>
        public static void Add(List<ExploreEffect> list, ExploreEffectType type, int battles)
        {
            var cur = list.Find(e => e.Type == type);
            if (cur == null)
            {
                list.Add(new ExploreEffect(type, battles));
                return;
            }
            if (cur.Battles < 0) return;
            if (battles < 0 || battles > cur.Battles) cur.Battles = battles;
        }

        public static bool Has(List<ExploreEffect> list, ExploreEffectType type) => list != null && list.Exists(e => e.Type == type);

        /// <summary>전투 시작: 이번 전투 내내 걸리는 효과를 적용한다 (공포만 첫 3턴).</summary>
        public static void ApplyToBattle(List<ExploreEffect> list, Battle b)
        {
            if (list == null) return;
            foreach (var e in list)
            {
                switch (e.Type)
                {
                    case ExploreEffectType.Regen: b.Player.Statuses.Apply(StatusType.Regen, RegenPercent, 999); break;
                    case ExploreEffectType.Focus: b.Player.Statuses.Apply(StatusType.Focus, FocusPercent, 999); break;
                    case ExploreEffectType.Fear: b.Player.Statuses.Apply(StatusType.Fear, FearPercent, FearTurns); break;
                    case ExploreEffectType.DemonPact:
                        b.Player.Attack = (int)Math.Round(b.Player.Attack * (1 + PactAttack));
                        b.Player.DamageReduction -= PactTaken;
                        break;
                    case ExploreEffectType.Curse: b.DropMultiplier *= CurseDrop; break;
                }
            }
        }

        /// <summary>전투가 끝나면 남은 횟수를 1 줄인다. 북소리는 전투 방에서 쓰였을 때만 줄어든다.</summary>
        public static void AfterBattle(List<ExploreEffect> list, bool battleRoom)
        {
            if (list == null) return;
            foreach (var e in list)
            {
                if (e.Battles <= 0) continue;
                if (e.Type == ExploreEffectType.Drum && !battleRoom) continue;
                e.Battles--;
            }
            list.RemoveAll(e => e.Battles == 0);
        }

        /// <summary>휴식 방에 들어가면 저주가 풀린다.</summary>
        public static void OnRest(List<ExploreEffect> list) => list?.RemoveAll(e => e.Type == ExploreEffectType.Curse);
    }
}

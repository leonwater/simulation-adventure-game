using System;

namespace Adventure.Core
{
    /// <summary>경험치·레벨업·능력치 배분. 레벨은 내려가지 않는다.</summary>
    public static class Leveling
    {
        /// <summary>경험치를 더하고 오른 레벨 수를 돌려준다.</summary>
        public static int AddExp(Character c, long amount)
        {
            if (amount <= 0 || c.Level >= GameBalance.MaxLevel) return 0;
            c.Exp += amount;
            int gained = 0;
            while (c.Level < GameBalance.MaxLevel && c.Exp >= GameBalance.ExpToNext(c.Level))
            {
                c.Exp -= GameBalance.ExpToNext(c.Level);
                c.Level++;
                c.UnspentPoints += GameBalance.PointsPerLevel;
                gained++;
            }
            if (c.Level >= GameBalance.MaxLevel) c.Exp = 0;
            // 레벨업할 때마다 최대 HP의 30% 회복 (여러 레벨이 오르면 레벨마다 적용)
            for (int i = 0; i < gained; i++)
                c.CurrentHp = Math.Min(CharacterStats.MaxHp(c), c.CurrentHp + (int)Math.Round(CharacterStats.MaxHp(c) * GameBalance.LevelUpHealRatio));
            return gained;
        }

        /// <summary>사망 경험치 감소. 현재 레벨의 0까지만 줄어든다. 실제로 잃은 양을 돌려준다.</summary>
        public static long ApplyDeathExpLoss(Character c)
        {
            long loss = (long)Math.Round(GameBalance.ExpToNext(c.Level) * GameBalance.DeathExpLoss);
            long actual = Math.Min(loss, c.Exp);
            c.Exp -= actual;
            return actual;
        }

        /// <summary>현재 레벨 경험치 진행률 (0~1).</summary>
        public static double ExpProgress(Character c)
        {
            long need = GameBalance.ExpToNext(c.Level);
            return need <= 0 ? 1.0 : Math.Min(1.0, (double)c.Exp / need);
        }

        public static bool Allocate(Character c, Stat stat, int points = 1)
        {
            if (points <= 0 || c.UnspentPoints < points || !c.JobData.CanAllocate(stat)) return false;
            if (c.BaseStats[stat] + points > GameBalance.MaxStat(stat)) return false;
            c.BaseStats[stat] += points;
            c.UnspentPoints -= points;
            return true;
        }

        /// <summary>
        /// 직업별 비율로 포인트를 나눈다. 지금까지 배분한 총량을 기준으로 목표 비율에서 가장 모자란 능력치부터 채운다.
        /// 결과는 능력치별 배분량 (AllocatableStats 순서). 최대값에 닿은 능력치는 건너뛰고, 모두 닿으면 남긴다.
        /// </summary>
        public static int[] PlanAutoAllocation(Character c, int points)
        {
            JobData job = c.JobData;
            int n = job.AllocatableStats.Length;
            var assigned = new int[n];
            var plan = new int[n];
            int total = 0;
            for (int i = 0; i < n; i++)
            {
                assigned[i] = Math.Max(0, c.AllocatedPoints(job.AllocatableStats[i]));
                total += assigned[i];
            }
            for (int p = 0; p < points; p++)
            {
                total++;
                int best = -1;
                double bestDeficit = double.MinValue;
                for (int i = 0; i < n; i++)
                {
                    if (job.AutoRatio[i] <= 0) continue;
                    var st = job.AllocatableStats[i];
                    if (c.BaseStats[st] + plan[i] >= GameBalance.MaxStat(st)) continue;
                    double deficit = job.AutoRatio[i] / 100.0 * total - assigned[i];
                    if (deficit > bestDeficit)
                    {
                        bestDeficit = deficit;
                        best = i;
                    }
                }
                if (best < 0) break;
                assigned[best]++;
                plan[best]++;
            }
            return plan;
        }

        public static void AutoAllocate(Character c)
        {
            int[] plan = PlanAutoAllocation(c, c.UnspentPoints);
            for (int i = 0; i < plan.Length; i++)
                if (plan[i] > 0) Allocate(c, c.JobData.AllocatableStats[i], plan[i]);
        }
    }

    /// <summary>캐릭터 화면의 "+ 버튼 → 확정" 흐름을 위한 임시 배분.</summary>
    public class AllocationDraft
    {
        private readonly Character _character;
        private readonly int[] _pending = new int[StatBlock.Count];

        public AllocationDraft(Character character)
        {
            _character = character;
        }

        public int Pending(Stat stat) => _pending[(int)stat];

        public int Remaining
        {
            get
            {
                int used = 0;
                foreach (int p in _pending) used += p;
                return _character.UnspentPoints - used;
            }
        }

        public bool HasChanges
        {
            get
            {
                foreach (int p in _pending) if (p > 0) return true;
                return false;
            }
        }

        public bool Add(Stat stat)
        {
            if (!CanAdd(stat)) return false;
            _pending[(int)stat]++;
            return true;
        }

        /// <summary>남은 포인트가 있고 최대값에 닿지 않았으면 더할 수 있다.</summary>
        public bool CanAdd(Stat stat) =>
            Remaining > 0 && _character.JobData.CanAllocate(stat) && _character.BaseStats[stat] + _pending[(int)stat] < GameBalance.MaxStat(stat);

        public bool Remove(Stat stat)
        {
            if (_pending[(int)stat] <= 0) return false;
            _pending[(int)stat]--;
            return true;
        }

        public void Auto()
        {
            Array.Clear(_pending, 0, _pending.Length);
            int[] plan = Leveling.PlanAutoAllocation(_character, _character.UnspentPoints);
            for (int i = 0; i < plan.Length; i++)
                _pending[(int)_character.JobData.AllocatableStats[i]] += plan[i];
        }

        public void Clear() => Array.Clear(_pending, 0, _pending.Length);

        public void Commit()
        {
            for (int i = 0; i < _pending.Length; i++)
                if (_pending[i] > 0) Leveling.Allocate(_character, (Stat)i, _pending[i]);
            Clear();
        }
    }
}

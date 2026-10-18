using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>게임 전체가 쓰는 난수. 테스트에서 시드를 고정할 수 있다.</summary>
    public class Rng
    {
        private readonly Random _random;

        public Rng() : this(Environment.TickCount) { }

        public Rng(int seed)
        {
            _random = new Random(seed);
        }

        /// <summary>[min, maxExclusive)</summary>
        public int Range(int min, int maxExclusive) => _random.Next(min, maxExclusive);

        /// <summary>[min, max] 양 끝 포함</summary>
        public int RangeInclusive(int min, int max) => _random.Next(min, max + 1);

        public double NextDouble() => _random.NextDouble();

        public bool Chance(double probability) => _random.NextDouble() < probability;

        public int NextSeed() => _random.Next();

        public T Pick<T>(IList<T> list) => list[_random.Next(list.Count)];

        public void Shuffle<T>(IList<T> list)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = _random.Next(i + 1);
                T tmp = list[i];
                list[i] = list[j];
                list[j] = tmp;
            }
        }

        /// <summary>가중치 배열에서 인덱스를 고른다. 가중치 합이 0이면 -1.</summary>
        public int PickWeighted(IList<int> weights)
        {
            int total = 0;
            for (int i = 0; i < weights.Count; i++) total += Math.Max(0, weights[i]);
            if (total <= 0) return -1;
            int roll = _random.Next(total);
            for (int i = 0; i < weights.Count; i++)
            {
                int w = Math.Max(0, weights[i]);
                if (roll < w) return i;
                roll -= w;
            }
            return weights.Count - 1;
        }
    }
}

using System;

namespace Adventure.Core
{
    /// <summary>능력치 10종 묶음. 저장을 위해 배열 필드로 보관한다.</summary>
    [Serializable]
    public class StatBlock
    {
        public static readonly int Count = Enum.GetValues(typeof(Stat)).Length;

        public int[] Values = new int[Count];

        public int this[Stat stat]
        {
            get => Values[(int)stat];
            set => Values[(int)stat] = value;
        }
    }
}

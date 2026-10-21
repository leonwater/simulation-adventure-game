using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    [Serializable]
    public class StatusInstance
    {
        public StatusType Type;
        public int Value;
        public int Turns;
        /// <summary>걸린 순서 (나중에 건 쪽 판정용).</summary>
        public int Order;
        /// <summary>이번 턴에 걸린 효과는 그 턴 끝에 줄어들지 않는다.</summary>
        public bool Fresh;
    }

    /// <summary>
    /// 버프·디버프 중첩 규칙
    /// 1) 서로 다른 효과는 함께 적용
    /// 2) 같은 효과·같은 수치가 다시 걸리면 남은 턴이 긴 쪽으로 대체 (같으면 나중에 건 쪽)
    /// 3) 같은 효과인데 수치가 다르면 가장 높은 수치만 적용. 높은 쪽이 먼저 끝나면 낮은 쪽이 이어서 적용
    /// </summary>
    public class StatusContainer
    {
        private readonly List<StatusInstance> _list = new List<StatusInstance>();
        private int _order;

        public IReadOnlyList<StatusInstance> All => _list;

        public static bool IsDebuff(StatusType t) => t >= StatusType.Poison;

        /// <summary>
        /// 효과를 건다. 지속 턴은 걸린 쪽(주인)의 차례 수다 (v2.1: 독 3턴 = 피해 3번, 기절 1턴 = 한 번 못 움직임).
        /// fresh = 주인이 자기 차례에 스스로 건 효과 (같은 차례 끝에는 줄지 않아 다음 N차례를 채운다).
        /// </summary>
        public void Apply(StatusType type, int value, int turns, bool fresh = false)
        {
            if (turns <= 0) return;
            var incoming = new StatusInstance { Type = type, Value = value, Turns = turns, Order = ++_order, Fresh = fresh };
            int idx = _list.FindIndex(s => s.Type == type && s.Value == value);
            if (idx < 0)
            {
                _list.Add(incoming);
                return;
            }
            if (incoming.Turns >= _list[idx].Turns) _list[idx] = incoming;
        }

        /// <summary>현재 적용 중인 수치 (같은 효과 중 가장 높은 값). 없으면 0.</summary>
        public int Value(StatusType type)
        {
            int best = 0;
            foreach (var s in _list) if (s.Type == type && s.Value > best) best = s.Value;
            return best;
        }

        public bool Has(StatusType type) => _list.Exists(s => s.Type == type);

        /// <summary>적용 중인(가장 높은 수치) 효과. 수치가 같으면 나중에 건 쪽.</summary>
        public StatusInstance Active(StatusType type)
        {
            StatusInstance best = null;
            foreach (var s in _list)
            {
                if (s.Type != type) continue;
                if (best == null || s.Value > best.Value || (s.Value == best.Value && s.Order > best.Order)) best = s;
            }
            return best;
        }

        /// <summary>효과 종류별로 하나씩 (화면 표시용).</summary>
        public List<StatusInstance> Visible()
        {
            var result = new List<StatusInstance>();
            foreach (StatusType t in Enum.GetValues(typeof(StatusType)))
            {
                var a = Active(t);
                if (a != null) result.Add(a);
            }
            return result;
        }

        public bool Remove(StatusType type) => _list.RemoveAll(s => s.Type == type) > 0;

        /// <summary>주인의 턴이 끝날 때 호출: 지속 턴을 1 줄이고 끝난 효과를 지운다.</summary>
        public void Tick()
        {
            foreach (var s in _list)
            {
                if (s.Fresh) s.Fresh = false;
                else s.Turns--;
            }
            _list.RemoveAll(s => s.Turns <= 0);
        }

        public void Clear() => _list.Clear();
    }
}

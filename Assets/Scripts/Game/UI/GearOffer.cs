using System;
using System.Collections.Generic;
using Adventure.Core;

namespace Adventure.Game
{
    /// <summary>
    /// 지금 장비보다 좋은 장비를 사거나 얻으면 바로 착용할지 묻는다 (v2.4).
    /// 착용할 수 있고(직업·레벨), 빈 칸이거나 한 줄 판정(EquipmentSystem.Summary)이 +인 장비만 묻는다.
    /// 같은 장비는 한 번만 묻는다 (화면을 다시 그려도 반복하지 않게).
    /// </summary>
    public static class GearOffer
    {
        private static readonly HashSet<string> Asked = new HashSet<string>();

        public static bool IsBetter(Character c, ItemInstance item)
        {
            if (item == null || item.Kind != ItemKind.Equipment || c.Inventory.Find(item.Uid) == null) return false;
            if (EquipmentSystem.CannotEquipReason(c, item) != null) return false;
            if (EquipmentSystem.ReplacedBy(c, item) == null) return true;
            return EquipmentSystem.Summary(c, item).Delta > 0;
        }

        /// <summary>좋은 장비가 여럿이면 하나씩 차례로 묻고, 다 끝나면 after를 부른다.</summary>
        public static void Offer(IEnumerable<ItemInstance> items, Action after = null)
        {
            var app = GameApp.Instance;
            var c = app.Session.C;
            var queue = new Queue<ItemInstance>();
            foreach (var i in items)
                if (i != null && !Asked.Contains(i.Uid) && IsBetter(c, i)) queue.Enqueue(i);
            Next(queue, after);
        }

        private static void Next(Queue<ItemInstance> queue, Action after)
        {
            var app = GameApp.Instance;
            var c = app.Session.C;
            while (queue.Count > 0 && !IsBetter(c, queue.Peek())) queue.Dequeue();
            if (queue.Count == 0)
            {
                after?.Invoke();
                return;
            }
            var item = queue.Dequeue();
            Asked.Add(item.Uid);
            var cur = EquipmentSystem.ReplacedBy(c, item);
            string compare = ScreenKit.CompareText(c, item);
            string msg = item.DisplayName + "\n" + (cur == null ? Names.Of(item.Gear) + " 칸이 비어 있습니다" : "착용 중 " + cur.DisplayName + " 대비 " + compare);
            app.Overlay.Confirm("더 좋은 장비", msg + "\n바로 착용할까요?", "착용", () =>
            {
                if (EquipmentSystem.Equip(c, item.Uid, out string err))
                {
                    app.Session.Save();
                    app.Overlay.Toast(item.DisplayName + " 착용");
                }
                else app.Overlay.Toast(err);
                Next(queue, after);
            }, "나중에", ButtonKind.Secondary, () => Next(queue, after));
        }
    }
}

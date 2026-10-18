using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>칸 수가 정해진 아이템 보관함. 가방(인벤토리)과 길드 창고가 쓴다.</summary>
    [Serializable]
    public class ItemContainer
    {
        public List<ItemInstance> Items = new List<ItemInstance>();
        public int Capacity = GameBalance.InventoryStart;

        public int UsedCells => Items.Count;

        public int FreeCells => Math.Max(0, Capacity - Items.Count);

        public ItemInstance Find(string uid) => Items.Find(i => i.Uid == uid);

        public int CountOf(string templateId)
        {
            int n = 0;
            foreach (var i in Items) if (i.TemplateId == templateId) n += i.Count;
            return n;
        }

        /// <summary>겹치기를 포함해 아이템을 전부 넣을 수 있는지.</summary>
        public bool CanAdd(ItemInstance item)
        {
            if (!item.IsStackable) return FreeCells >= 1;
            int remaining = item.Count;
            foreach (var i in Items)
                if (i.TemplateId == item.TemplateId) remaining -= GameBalance.MaxStack - i.Count;
            if (remaining <= 0) return true;
            int cellsNeeded = (remaining + GameBalance.MaxStack - 1) / GameBalance.MaxStack;
            return FreeCells >= cellsNeeded;
        }

        /// <summary>전부 넣을 수 있을 때만 넣는다.</summary>
        public bool Add(ItemInstance item)
        {
            if (item == null || item.Count <= 0 || !CanAdd(item)) return false;
            if (!item.IsStackable)
            {
                if (string.IsNullOrEmpty(item.Uid)) item.Uid = ItemInstance.NewUid();
                Items.Add(item);
                return true;
            }
            int remaining = item.Count;
            foreach (var i in Items)
            {
                if (remaining <= 0) break;
                if (i.TemplateId != item.TemplateId || i.Count >= GameBalance.MaxStack) continue;
                int moved = Math.Min(remaining, GameBalance.MaxStack - i.Count);
                i.Count += moved;
                remaining -= moved;
            }
            if (remaining == item.Count && remaining <= GameBalance.MaxStack)
            {
                if (string.IsNullOrEmpty(item.Uid)) item.Uid = ItemInstance.NewUid();
                Items.Add(item);
                return true;
            }
            while (remaining > 0)
            {
                int n = Math.Min(remaining, GameBalance.MaxStack);
                Items.Add(item.CloneWithCount(n));
                remaining -= n;
            }
            return true;
        }

        /// <summary>uid 칸에서 count개를 꺼낸다. 꺼낸 아이템(새 인스턴스일 수 있음)을 돌려준다.</summary>
        public ItemInstance Take(string uid, int count = int.MaxValue)
        {
            var cell = Find(uid);
            if (cell == null) return null;
            if (count >= cell.Count)
            {
                Items.Remove(cell);
                return cell;
            }
            if (count <= 0) return null;
            cell.Count -= count;
            return cell.CloneWithCount(count);
        }

        /// <summary>같은 종류를 여러 칸에 걸쳐 count개 제거한다. 모자라면 아무것도 하지 않는다.</summary>
        public bool RemoveTemplate(string templateId, int count)
        {
            if (CountOf(templateId) < count) return false;
            for (int idx = Items.Count - 1; idx >= 0 && count > 0; idx--)
            {
                var i = Items[idx];
                if (i.TemplateId != templateId) continue;
                int n = Math.Min(count, i.Count);
                i.Count -= n;
                count -= n;
                if (i.Count <= 0) Items.RemoveAt(idx);
            }
            return true;
        }

        public void Clear() => Items.Clear();
    }
}

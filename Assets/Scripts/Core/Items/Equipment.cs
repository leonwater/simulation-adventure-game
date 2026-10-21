using System;

namespace Adventure.Core
{
    /// <summary>장착 장비 8칸.</summary>
    [Serializable]
    public class Equipment
    {
        public static readonly int SlotCount = Enum.GetValues(typeof(EquipSlot)).Length;

        public ItemInstance[] Slots = new ItemInstance[SlotCount];

        public ItemInstance this[EquipSlot slot]
        {
            get => Slots[(int)slot];
            set => Slots[(int)slot] = value;
        }

        public int EquippedCount
        {
            get
            {
                int n = 0;
                foreach (var s in Slots) if (s != null) n++;
                return n;
            }
        }

        public static EquipSlot DefaultSlot(GearType gear)
        {
            switch (gear)
            {
                case GearType.Helmet: return EquipSlot.Helmet;
                case GearType.Armor: return EquipSlot.Armor;
                case GearType.Pants: return EquipSlot.Pants;
                case GearType.Boots: return EquipSlot.Boots;
                case GearType.Necklace: return EquipSlot.Necklace;
                case GearType.Ring: return EquipSlot.Ring1;
                default: return EquipSlot.Weapon;
            }
        }

        public static bool Fits(GearType gear, EquipSlot slot)
        {
            if (gear == GearType.Ring) return slot == EquipSlot.Ring1 || slot == EquipSlot.Ring2;
            return DefaultSlot(gear) == slot;
        }

        public ItemInstance Find(string uid)
        {
            foreach (var s in Slots) if (s != null && s.Uid == uid) return s;
            return null;
        }
    }

    /// <summary>장비 비교 한 줄 (예: 공격력 +5).</summary>
    public struct StatDelta
    {
        public string Label;
        public int Delta;
    }

    /// <summary>장비 착용·해제 규칙.</summary>
    public static class EquipmentSystem
    {
        /// <summary>
        /// 이 장비를 낄 칸. 반지는 빈 칸을 먼저 쓰고, 둘 다 차 있으면 덜 중요한 반지를 바꾼다 (v2.0):
        /// 직업의 주요 능력치(체력·공격·특화) 반지를 남기고, 둘 다 주요 능력치거나 둘 다 아니면 수치가 낮은 쪽을 바꾼다.
        /// </summary>
        public static EquipSlot SlotFor(Character c, GearType gear)
        {
            if (gear != GearType.Ring) return Equipment.DefaultSlot(gear);
            var r1 = c.Equipment[EquipSlot.Ring1];
            var r2 = c.Equipment[EquipSlot.Ring2];
            if (r1 == null) return EquipSlot.Ring1;
            if (r2 == null) return EquipSlot.Ring2;
            return CompareAccessories(c, r1, r2) <= 0 ? EquipSlot.Ring1 : EquipSlot.Ring2;
        }

        /// <summary>장신구 a가 b보다 좋으면 양수: 주요 능력치 우선, 같으면 수치.</summary>
        public static int CompareAccessories(Character c, ItemInstance a, ItemInstance b)
        {
            bool ma = IsMainStat(c, a.BonusStat), mb = IsMainStat(c, b.BonusStat);
            if (ma != mb) return ma ? 1 : -1;
            return a.Value.CompareTo(b.Value);
        }

        public static bool IsMainStat(Character c, Stat stat) => Array.IndexOf(c.JobData.MainStats, stat) >= 0;

        /// <summary>이 장비를 끼면 바뀌는 장비. 빈 칸이면 null.</summary>
        public static ItemInstance ReplacedBy(Character c, ItemInstance item)
        {
            if (item == null || item.Kind != ItemKind.Equipment) return null;
            var cur = c.Equipment[SlotFor(c, item.Gear)];
            return cur != null && cur.Uid == item.Uid ? null : cur;
        }

        /// <summary>
        /// 아이템 칸에 쓰는 한 줄 판정 (v2.0). 같은 능력치끼리는 수치 차이, 다른 능력치 장신구는 주요 능력치를 우선해
        /// 좋아지면 새 능력치 +N, 나빠지면 잃는 능력치 -N, 둘 다 주요(또는 둘 다 아님)면 수치 차이로 본다.
        /// </summary>
        public static StatDelta Summary(Character c, ItemInstance item)
        {
            var list = Compare(c, item);
            if (list.Count <= 1) return list.Count == 1 ? list[0] : default;
            var cur = ReplacedBy(c, item);
            bool mi = IsMainStat(c, item.BonusStat), mc = IsMainStat(c, cur.BonusStat);
            if (mi && !mc) return list[0];
            if (!mi && mc) return list[1];
            int d = item.Value - cur.Value;
            return new StatDelta { Label = d >= 0 ? list[0].Label : list[1].Label, Delta = d };
        }

        /// <summary>지금 낀 장비와 비교한 수치 변화 (착용 중인 같은 장비면 빈 목록).</summary>
        public static System.Collections.Generic.List<StatDelta> Compare(Character c, ItemInstance item)
        {
            var list = new System.Collections.Generic.List<StatDelta>();
            if (item == null || item.Kind != ItemKind.Equipment || c.Equipment.Find(item.Uid) != null) return list;
            var cur = ReplacedBy(c, item);
            if (item.IsAccessory)
            {
                if (cur != null && cur.BonusStat == item.BonusStat)
                    list.Add(new StatDelta { Label = Names.Of(item.BonusStat), Delta = item.Value - cur.Value });
                else
                {
                    list.Add(new StatDelta { Label = Names.Of(item.BonusStat), Delta = item.Value });
                    if (cur != null) list.Add(new StatDelta { Label = Names.Of(cur.BonusStat), Delta = -cur.Value });
                }
                return list;
            }
            string label = item.IsWeapon ? "공격력" : "방어력";
            list.Add(new StatDelta { Label = label, Delta = item.Value - (cur?.Value ?? 0) });
            return list;
        }

        public static string CannotEquipReason(Character c, ItemInstance item)
        {
            if (item == null || item.Kind != ItemKind.Equipment) return "장비가 아닙니다";
            if (!item.CanBeUsedBy(c.Job)) return Names.Of((Job)item.JobRestriction) + " 전용입니다";
            if (c.Level < item.LevelReq) return "Lv." + item.LevelReq + " 이상 착용 가능";
            return null;
        }

        /// <summary>가방의 장비를 착용한다. 원래 끼던 장비는 가방으로 돌아간다.</summary>
        public static bool Equip(Character c, string uid, out string error, EquipSlot? slot = null)
        {
            var item = c.Inventory.Find(uid);
            error = CannotEquipReason(c, item);
            if (error != null) return false;
            EquipSlot target = slot ?? SlotFor(c, item.Gear);
            if (!Equipment.Fits(item.Gear, target))
            {
                error = "맞지 않는 슬롯입니다";
                return false;
            }
            c.Inventory.Take(uid);
            var old = c.Equipment[target];
            c.Equipment[target] = item;
            if (old != null) c.Inventory.Add(old); // 방금 한 칸이 비었으므로 항상 들어간다
            ClampHp(c);
            return true;
        }

        public static bool Unequip(Character c, EquipSlot slot, out string error)
        {
            var item = c.Equipment[slot];
            if (item == null)
            {
                error = "비어 있는 슬롯입니다";
                return false;
            }
            if (!c.Inventory.CanAdd(item))
            {
                error = "가방이 가득 찼습니다";
                return false;
            }
            c.Equipment[slot] = null;
            c.Inventory.Add(item);
            ClampHp(c);
            error = null;
            return true;
        }

        private static void ClampHp(Character c)
        {
            c.CurrentHp = Math.Min(c.CurrentHp, CharacterStats.MaxHp(c));
        }
    }
}

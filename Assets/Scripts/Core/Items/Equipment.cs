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

        /// <summary>반지는 빈 칸을 우선 쓰고, 둘 다 차 있으면 반지 1을 교체한다.</summary>
        public EquipSlot ChooseSlot(GearType gear)
        {
            if (gear != GearType.Ring) return DefaultSlot(gear);
            if (this[EquipSlot.Ring1] == null) return EquipSlot.Ring1;
            if (this[EquipSlot.Ring2] == null) return EquipSlot.Ring2;
            return EquipSlot.Ring1;
        }

        public ItemInstance Find(string uid)
        {
            foreach (var s in Slots) if (s != null && s.Uid == uid) return s;
            return null;
        }
    }

    /// <summary>장비 착용·해제 규칙.</summary>
    public static class EquipmentSystem
    {
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
            EquipSlot target = slot ?? c.Equipment.ChooseSlot(item.Gear);
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

using System;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>아이템 종류 (작은 원의 색으로 한눈에 구분).</summary>
    public enum ItemCategory
    {
        Weapon,
        Armor,
        Accessory,
        Consumable,
        Material,
        SkillBook,
        Stone
    }

    /// <summary>
    /// 가방·창고 4열 격자. 칸마다 종류 색 원 + 종류, 이름(장비는 등급 색), 장비는 착용 레벨과 지금 장비 대비 수치.
    /// 상점 카드도 같은 종류 줄·이름 색·레벨/비교 줄을 쓴다.
    /// </summary>
    public static class ItemGrid
    {
        public const int Columns = 4;
        public const float CellHeight = 96;

        private static readonly ItemCategory[] LegendOrder =
        {
            ItemCategory.Weapon, ItemCategory.Armor, ItemCategory.Accessory, ItemCategory.Consumable,
            ItemCategory.Material, ItemCategory.SkillBook, ItemCategory.Stone,
        };

        public static void Build(Transform parent, ItemContainer container, string selectedUid, Action<ItemInstance> onTap,
            bool showEmpty = true, float width = ScreenKit.ContentWidth, Character owner = null)
        {
            owner = owner ?? GameApp.Instance.Session.C;
            var grid = UI.Grid(parent, Columns, width, CellHeight, 6);
            foreach (var item in container.Items)
            {
                var it = item;
                bool sel = item.Uid == selectedUid;
                var cell = UI.ButtonCard(grid, () => onTap?.Invoke(it), Theme.Card, sel ? Theme.Accent : Theme.CardBorder, 8,
                    UI.Pad(6, 6), true, 2, CellHeight, TextAnchor.UpperLeft);
                if (sel)
                {
                    // 선택 칸은 테두리를 2px로
                    var fill = cell.Find("fill") as RectTransform;
                    if (fill != null) UI.Stretch(fill, 2, 2, 2, 2);
                }
                // 칸(약 85×96)에 맞춰: 종류 12 · 이름 13(두 줄까지) · 레벨/비교 12
                KindLine(cell, item, 12);
                string name = Short(item.Kind == ItemKind.SkillBook ? item.DisplayName.Replace("스킬서: ", "") : item.DisplayName, 10)
                              + (item.Count > 1 ? " ×" + item.Count : "");
                var n = UI.Label(cell, name, 13, NameColor(item), item.Kind == ItemKind.Equipment);
                n.horizontalOverflow = HorizontalWrapMode.Wrap;
                UI.Spacer(cell);
                if (item.Kind == ItemKind.Equipment && owner != null) UI.Label(cell, LevelCompare(owner, item, false), 12, Theme.TextSub);
            }
            if (!showEmpty) return;
            for (int i = container.Items.Count; i < container.Capacity; i++)
            {
                var empty = UI.Card(grid, Theme.Bg, Theme.CardBorder, 8, UI.Pad(0), true, 0, TextAnchor.MiddleCenter, "empty");
                UI.SetEnabled(empty, false, 0.6f);
            }
        }

        // ── 종류 · 색 ──

        public static ItemCategory Category(ItemInstance item)
        {
            switch (item.Kind)
            {
                case ItemKind.Equipment:
                    if (item.IsWeapon) return ItemCategory.Weapon;
                    return item.IsAccessory ? ItemCategory.Accessory : ItemCategory.Armor;
                case ItemKind.Consumable: return ItemCategory.Consumable;
                case ItemKind.SkillBook: return ItemCategory.SkillBook;
                case ItemKind.EnhanceStone: return ItemCategory.Stone;
                default: return ItemCategory.Material;
            }
        }

        public static Color CategoryColor(ItemCategory c)
        {
            switch (c)
            {
                case ItemCategory.Weapon: return Theme.Hex("E8894A");
                case ItemCategory.Armor: return Theme.Hex("7FA8D8");
                case ItemCategory.Accessory: return Theme.Hex("C08BE8");
                case ItemCategory.Consumable: return Theme.Hex("6CC48A");
                case ItemCategory.SkillBook: return Theme.Hex("5CCAD8");
                case ItemCategory.Stone: return Theme.Hex("E2B657");
                default: return Theme.Hex("B08F6A");
            }
        }

        public static string CategoryName(ItemCategory c)
        {
            switch (c)
            {
                case ItemCategory.Weapon: return "무기";
                case ItemCategory.Armor: return "방어구";
                case ItemCategory.Accessory: return "장신구";
                case ItemCategory.Consumable: return "소모품";
                case ItemCategory.SkillBook: return "스킬서";
                case ItemCategory.Stone: return "강화석";
                default: return "재료";
            }
        }

        /// <summary>장비 상세에 쓰는 종류: "방어구 · 투구", "장신구 · 반지", "무기".</summary>
        public static string GearText(ItemInstance item)
        {
            var cat = Category(item);
            return cat == ItemCategory.Weapon ? CategoryName(cat) : CategoryName(cat) + " · " + Names.Of(item.Gear);
        }

        /// <summary>장비는 등급 색, 그 외는 기본 글자색.</summary>
        public static Color NameColor(ItemInstance item) => item.Kind == ItemKind.Equipment ? Theme.GradeColor(item.Grade) : Theme.Text;

        /// <summary>종류 줄: 색 원 + 종류 (장비는 무기·방어구·장신구, 스킬서는 등급).</summary>
        public static void KindLine(Transform parent, ItemInstance item, float size)
        {
            var cat = Category(item);
            var row = UI.Row(parent, 4, null, TextAnchor.MiddleLeft, "kind");
            Circle(row, CategoryColor(cat), size * 0.8f);
            string text = item.Kind == ItemKind.SkillBook && SkillDb.Get(item.SkillId) != null ? "스킬서 · " + Names.Of(SkillDb.Get(item.SkillId).Tier)
                : CategoryName(cat);
            UI.Label(row, text, size, Theme.TextBody, false, TextAnchor.MiddleLeft, false, false);
        }

        /// <summary>장비: "Lv.12 · +5" (레벨이 모자라면 빨강, 비교는 +초록 / −빨강).</summary>
        public static string LevelCompare(Character c, ItemInstance item, bool withLabel)
        {
            string lv = "Lv." + item.LevelReq;
            if (c.Level < item.LevelReq) lv = UI.Color(lv, Theme.RedHex);
            var list = EquipmentSystem.Compare(c, item);
            if (c.Equipment.Find(item.Uid) != null) return lv + " · 착용 중";
            if (list.Count == 0) return lv;
            var d = list[0];
            string v = d.Delta > 0 ? "+" + d.Delta : d.Delta < 0 ? "−" + (-d.Delta) : "±0";
            string hex = d.Delta > 0 ? Theme.GreenHex : d.Delta < 0 ? Theme.RedHex : Theme.SubHex;
            return lv + " · " + UI.Color((withLabel ? d.Label + " " : "") + v, hex);
        }

        /// <summary>종류 색 안내 (가방 위).</summary>
        public static void Legend(Transform parent)
        {
            var row = UI.Row(parent, 8, null, TextAnchor.MiddleLeft, "legend");
            foreach (var c in LegendOrder)
            {
                var item = UI.Row(row, 3, null, TextAnchor.MiddleLeft);
                Circle(item, CategoryColor(c), 7);
                UI.Label(item, CategoryName(c), 10, Theme.TextSub, false, TextAnchor.MiddleLeft, false, false);
            }
        }

        private static void Circle(Transform parent, Color color, float size)
        {
            var dot = UI.Image(parent, color, 0, "dot");
            dot.sprite = Sprites.Circle;
            UI.Size(dot, height: size, width: size);
        }

        /// <summary>칸에 들어가도록 이름을 줄인다.</summary>
        public static string Short(string name, int max = 9) => name.Length > max ? name.Substring(0, max - 1) + "…" : name;
    }
}

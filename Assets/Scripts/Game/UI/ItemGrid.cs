using System;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>아이템 종류 (작은 원의 색으로 한눈에 구분).</summary>
    public enum ItemCategory
    {
        Weapon,
        Armor,
        Accessory,
        Consumable,
        Other,
        SkillBook,
        Stone
    }

    /// <summary>
    /// 가방·창고 4열 격자 (v1.9 배치). 칸마다 위에서부터 종류 색 원 + 종류 · 이름(두 줄까지, 장비는 등급 색) ·
    /// 아래 줄(왼쪽: 장비는 착용 레벨과 지금 장비 대비 수치, 스킬서는 등급 · 직업 / 오른쪽: 개수). 아래 줄은 칸 바닥에서 조금 띄운다.
    /// 상점 카드도 같은 종류 줄·이름 색·레벨/비교 줄을 쓴다.
    /// </summary>
    public static class ItemGrid
    {
        public const int Columns = 4;
        public const float CellHeight = 96;

        private static readonly ItemCategory[] LegendOrder =
        {
            ItemCategory.Weapon, ItemCategory.Armor, ItemCategory.Accessory, ItemCategory.Consumable,
            ItemCategory.Other, ItemCategory.SkillBook, ItemCategory.Stone,
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
                    UI.Pad(6, 6, 8, 10), true, 3, CellHeight, TextAnchor.UpperLeft);
                if (sel)
                {
                    // 선택 칸은 테두리를 2px로
                    var fill = cell.Find("fill") as RectTransform;
                    if (fill != null) UI.Stretch(fill, 2, 2, 2, 2);
                }
                // 칸(약 85×96)에 맞춰: 종류 12 · 이름 13(두 줄까지, 넘치면 자름) · 아래 줄 12
                KindLine(cell, item, 12);
                NameLabel(cell, item, 13);
                UI.Spacer(cell);
                BottomLine(cell, item, owner);
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
                default: return ItemCategory.Other;
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
                default: return "기타";
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

        /// <summary>종류 줄: 색 원 + 종류 (무기·방어구·장신구·소모품·기타·스킬서·강화석). 원과 글자는 가운데를 맞춘다.</summary>
        public static void KindLine(Transform parent, ItemInstance item, float size)
        {
            var cat = Category(item);
            var row = UI.Row(parent, 4, null, TextAnchor.MiddleLeft, "kind");
            UI.Size(row, height: Mathf.Round(size * 1.4f));
            Circle(row, CategoryColor(cat), size * 0.8f);
            UI.Label(row, CategoryName(cat), size, Theme.TextBody, false, TextAnchor.MiddleLeft, false, false);
        }

        /// <summary>이름 (스킬서는 스킬 이름만, 두 줄까지 · 넘치면 자름). 개수는 아래 줄 오른쪽에 따로.</summary>
        public static Text NameLabel(Transform parent, ItemInstance item, float size)
        {
            string name = item.Kind == ItemKind.SkillBook && SkillDb.Get(item.SkillId) != null ? SkillDb.Get(item.SkillId).Name : item.DisplayName;
            var n = UI.Label(parent, name, size, NameColor(item), item.Kind == ItemKind.Equipment);
            n.horizontalOverflow = HorizontalWrapMode.Wrap;
            n.verticalOverflow = VerticalWrapMode.Truncate;
            n.lineSpacing = 1.05f;
            UI.Size(n, height: Mathf.Round(size * GameSettings.TextScale * 2.5f)); // 두 줄 높이
            return n;
        }

        /// <summary>
        /// 아래 줄: 왼쪽은 장비 착용 레벨·지금 장비 대비(또는 스킬서 등급), 오른쪽은 개수(2개 이상일 때 ×N).
        /// </summary>
        public static void BottomLine(Transform parent, ItemInstance item, Character owner, string left = null)
        {
            var row = UI.Row(parent, 4, null, TextAnchor.MiddleLeft, "bottom");
            UI.Size(row, height: 16);
            if (left == null) left = InfoText(owner, item);
            var l = UI.Label(row, left, 12, Theme.TextSub, false, TextAnchor.MiddleLeft, false, false);
            UI.Size(l, flexW: 1);
            if (item.Count > 1) UI.Label(row, "×" + item.Count, 12, Theme.Text, true, TextAnchor.MiddleRight, false, false);
        }

        /// <summary>
        /// 칸의 정보 한 줄: 장비는 착용 레벨과 지금 장비 대비, 스킬서는 등급 · 쓸 수 있는 직업 (내 직업이 아니면 빨강, v2.0).
        /// </summary>
        public static string InfoText(Character c, ItemInstance item)
        {
            if (item.Kind == ItemKind.Equipment && c != null) return LevelCompare(c, item, false);
            var def = item.Kind == ItemKind.SkillBook ? SkillDb.Get(item.SkillId) : null;
            if (def == null) return "";
            if (def.JobRestriction < 0) return Names.Of(def.Tier) + " · 공용";
            string job = Names.Of((Job)def.JobRestriction);
            return Names.Of(def.Tier) + " · " + (c != null && def.JobRestriction != (int)c.Job ? UI.Color(job, Theme.RedHex) : job);
        }

        /// <summary>장비: "Lv.12 · +5" (레벨이 모자라면 빨강, 비교는 +초록 / −빨강).</summary>
        public static string LevelCompare(Character c, ItemInstance item, bool withLabel)
        {
            string lv = "Lv." + item.LevelReq;
            if (c.Level < item.LevelReq) lv = UI.Color(lv, Theme.RedHex);
            if (c.Equipment.Find(item.Uid) != null) return lv + " · 착용 중";
            if (EquipmentSystem.Compare(c, item).Count == 0) return lv;
            var d = EquipmentSystem.Summary(c, item);
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
    }
}

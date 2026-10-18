using System;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>가방·창고 5열 격자 (칸마다 등급 색 점 + 이름).</summary>
    public static class ItemGrid
    {
        public const float CellHeight = 62;

        public static void Build(Transform parent, ItemContainer container, string selectedUid, Action<ItemInstance> onTap,
            bool showEmpty = true, float width = ScreenKit.ContentWidth - 0)
        {
            var grid = UI.Grid(parent, GameBalance.InventoryColumns, width, CellHeight, 6);
            foreach (var item in container.Items)
            {
                var it = item;
                bool sel = item.Uid == selectedUid;
                var cell = UI.ButtonCard(grid, () => onTap?.Invoke(it), Theme.Card, sel ? Theme.Accent : Theme.CardBorder, 8,
                    UI.Pad(2, 2), true, 2, CellHeight, TextAnchor.MiddleCenter);
                if (sel)
                {
                    // 선택 칸은 테두리를 2px로
                    var fill = cell.Find("fill") as RectTransform;
                    if (fill != null) UI.Stretch(fill, 2, 2, 2, 2);
                }
                Dot(cell, Theme.ItemColor(item));
                string name = item.Count > 1 ? Short(item.Name) + " ×" + item.Count : Short(item.DisplayName);
                UI.Label(cell, name, 11, Theme.Text, false, TextAnchor.MiddleCenter);
            }
            if (!showEmpty) return;
            for (int i = container.Items.Count; i < container.Capacity; i++)
            {
                var empty = UI.Card(grid, Theme.Bg, Theme.CardBorder, 8, UI.Pad(0), true, 0, TextAnchor.MiddleCenter, "empty");
                UI.SetEnabled(empty, false, 0.6f);
            }
        }

        public static void Dot(Transform parent, Color color)
        {
            var holder = UI.Row(parent, 0, null, TextAnchor.MiddleCenter, "dot");
            var dot = UI.Image(holder, color, 0, "dot");
            dot.sprite = Sprites.Circle;
            UI.Size(dot, height: 8, width: 8);
        }

        /// <summary>격자 칸에 들어가도록 이름을 줄인다 ("스킬서: 강타" → "스킬서").</summary>
        public static string Short(string name)
        {
            if (name.StartsWith("스킬서")) return "스킬서";
            return name.Length > 9 ? name.Substring(0, 8) + "…" : name;
        }
    }
}

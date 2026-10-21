using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>대장간: 장착 중·가방의 장비를 +15까지 강화. 장비는 부서지지 않고, +7 이상 실패 시 일정 확률로 한 단계 내려간다.</summary>
    public class BlacksmithScreen : ScreenBase
    {
        private string _selected;
        private string _line = "망치는 정직하지. 실패해도 장비가 부서지진 않으니 걱정 말게.";

        public override bool OnBack()
        {
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "대장간", "마을", () => Go(new TownScreen()), C);
            ScreenKit.NpcIllustration(page, "대장장이", _line, 260);
            var body = UI.Scroll(page, out _, 8, UI.Pad(16, 16, 16, 16), "smith");

            var equipped = new List<(EquipSlot slot, ItemInstance item)>();
            foreach (EquipSlot slot in System.Enum.GetValues(typeof(EquipSlot)))
                if (C.Equipment[slot] != null) equipped.Add((slot, C.Equipment[slot]));
            var bag = C.Inventory.Items.FindAll(i => i.Kind == ItemKind.Equipment);
            if (_selected == null || Blacksmith.FindGear(C, _selected) == null)
                _selected = equipped.Count > 0 ? equipped[0].item.Uid : bag.Count > 0 ? bag[0].Uid : null;

            var selected = Blacksmith.FindGear(C, _selected);
            if (selected != null) Detail(body, selected);

            var info = UI.Row(body, 6);
            UI.Size(info, minH: 36);
            var l = UI.Label(info, "장착 장비", 14, Theme.Text, true);
            UI.Size(l, flexW: 1);
            // 강화석은 주요 정보라 아이콘 + 굵은 글씨로 (수정 사항 #14)
            UI.Icon(info, "enhance_stone", 22);
            UI.Label(info, "강화석 " + UI.Color(C.Inventory.CountOf(ItemDb.EnhanceStoneId) + "개", Theme.BlueHex), 15, Theme.Text, true, TextAnchor.MiddleRight, false, false);
            // 장비 선택은 가방의 장착 장비 칸과 같은 4열 칸 (v2.0): 장착 장비(가방과 같은 부위 순서) → 가방 장비
            var list = UI.Column(body, 8);
            Anchors.Set("smith.list", list);
            if (equipped.Count > 0)
            {
                var grid = UI.Grid(list, 4, ScreenKit.ContentWidth, 66, 6);
                foreach (var e in equipped) GearCell(grid, e.item, Names.Of(e.slot));
            }
            else UI.Sub(list, "장착한 장비가 없습니다.");
            UI.Label(list, "가방 장비", 14, Theme.Text, true);
            if (bag.Count > 0)
            {
                var grid = UI.Grid(list, 4, ScreenKit.ContentWidth, 66, 6);
                foreach (var i in bag) GearCell(grid, i, Names.Of(i.Gear));
            }
            else UI.Sub(list, "가방에 장비가 없습니다.");
            Tutorial.OnFacility("blacksmith");
        }

        /// <summary>장비 칸: 위 부위 이름 · 아래 이름(등급 색, 강화 단계 포함). 고른 칸은 금색.</summary>
        private void GearCell(Transform grid, ItemInstance item, string part)
        {
            bool sel = item.Uid == _selected;
            var cell = UI.ButtonCard(grid, () =>
            {
                _selected = item.Uid;
                Rebuild();
            }, sel ? Theme.AccentBg : Theme.Card, sel ? Theme.Accent : Theme.CardBorder, 10, UI.Pad(8, 6), true, 0, 66, TextAnchor.UpperLeft);
            UI.Sub(cell, part);
            UI.Spacer(cell);
            var n = UI.Label(cell, item.DisplayName, 12, Theme.GradeColor(item.Grade));
            n.verticalOverflow = VerticalWrapMode.Truncate;
        }

        private void Detail(Transform parent, ItemInstance item)
        {
            var card = UI.Card(parent, Theme.Button, Theme.ButtonBorder, 12, UI.Pad(14, 12), true, 6);
            Anchors.Set("smith.detail", card);
            var head = UI.Row(card);
            var n = UI.Label(head, item.DisplayName, 16, Theme.GradeColor(item.Grade), true);
            UI.Size(n, flexW: 1);
            UI.Label(head, UI.GradeTag(item.Grade) + " " + UI.Color(ItemGrid.GearText(item), Theme.SubHex), 12, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            ScreenKit.CompareLine(card, C, item);
            if (item.Enhance >= GameBalance.MaxEnhance)
            {
                UI.Label(card, "최대 강화(+" + GameBalance.MaxEnhance + ")에 도달했습니다.", 14, Theme.Gold);
                return;
            }
            int now = item.Value;
            int next = item.ValueAt(item.Enhance + 1);
            string what = item.IsWeapon ? "공격력" : item.IsAccessory ? Names.Of(item.BonusStat) : "방어력";
            // 왼쪽: 강화 단계와 수치 변화 · 오른쪽: 성공률과 비용 (흰 글씨, v1.8)
            var change = UI.Row(card, 8);
            var left = UI.Label(change, "+" + item.Enhance + " → +" + (item.Enhance + 1) + "\n" + what + " " + now + " → " + UI.Color(next.ToString(), Theme.GreenHex), 14, Theme.Text);
            UI.Size(left, flexW: 1);
            var right = UI.Column(change, 2, null, TextAnchor.MiddleRight);
            UI.Label(right, "성공률 " + ScreenKit.Percent(Blacksmith.SuccessRate(item)), 15, Theme.Text, true, TextAnchor.MiddleRight, false, false);
            UI.Label(right, Blacksmith.GoldCost(item).ToString("#,0") + " G", 15, Theme.Text, true, TextAnchor.MiddleRight, false, false);
            double down = Blacksmith.DowngradeChance(item);
            if (down > 0) UI.Label(card, "실패하면 " + ScreenKit.Percent(down) + " 확률로 +" + (item.Enhance - 1) + "로 내려갑니다.", 13, Theme.RedLight);
            else if (Blacksmith.SuccessRate(item) < 1)
                UI.Sub(card, "실패해도 장비는 그대로이고 " + (Blacksmith.StoneCost(item) > 0 ? "골드·강화석" : "골드") + "만 소모됩니다.");
            int stones = Blacksmith.StoneCost(item);
            int have = C.Inventory.CountOf(ItemDb.EnhanceStoneId);
            if (stones > 0)
            {
                var stoneRow = UI.Row(card, 6);
                UI.Icon(stoneRow, "enhance_stone", 20);
                UI.Label(stoneRow, "강화석 " + UI.Color(have + " / " + stones, have >= stones ? Theme.GreenHex : Theme.RedHex), 14, Theme.Text, true);
            }
            string reason = Blacksmith.CannotEnhanceReason(C, item);
            var b = UI.TextButton(card, reason ?? "강화하기", () => Enhance(item), ButtonKind.Primary);
            UI.SetEnabled(b, reason == null);
        }

        private void Enhance(ItemInstance item)
        {
            var result = Blacksmith.Enhance(C, item.Uid, S.Rng, out string err);
            switch (result)
            {
                case EnhanceResult.Success:
                    _line = "좋아, 잘 붙었군! " + item.DisplayName + " 완성이다.";
                    Toast("강화 성공! " + item.DisplayName);
                    break;
                case EnhanceResult.Failed:
                    _line = "쯧, 이번엔 안 됐네. 장비는 멀쩡하니 다시 해 보게.";
                    Toast("강화 실패… 장비는 그대로입니다");
                    break;
                case EnhanceResult.Downgraded:
                    _line = "이런, 손이 미끄러졌군. 한 단계 깎였지만 부서지진 않았네.";
                    Toast("강화 실패… " + item.DisplayName + "(으)로 내려갔습니다");
                    break;
                default:
                    Toast(err);
                    return;
            }
            S.Save();
            Rebuild();
        }
    }
}

using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>대장간: 장착 중·가방의 장비를 +10까지 강화. 실패해도 장비는 부서지지 않는다.</summary>
    public class BlacksmithScreen : ScreenBase
    {
        private string _selected;
        private string _line = "망치는 정직하지. 실패해도 장비는 멀쩡하니 걱정 말게.";

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
            var body = UI.Scroll(page, out _, 8, UI.Pad(12, 12, 16, 16), "smith");

            var gear = new List<ItemInstance>();
            foreach (var e in C.Equipment.Slots) if (e != null) gear.Add(e);
            foreach (var i in C.Inventory.Items) if (i.Kind == ItemKind.Equipment) gear.Add(i);
            if (_selected == null && gear.Count > 0) _selected = gear[0].Uid;

            var selected = Blacksmith.FindGear(C, _selected);
            if (selected != null) Detail(body, selected);

            var info = UI.Row(body, 6);
            UI.Size(info, minH: 36);
            var l = UI.Label(info, "장비 선택", 14, Theme.Text, true);
            UI.Size(l, flexW: 1);
            // 강화석은 주요 정보라 아이콘 + 굵은 글씨로 (수정 사항 #14)
            UI.Icon(info, "enhance_stone", 22);
            UI.Label(info, "강화석 " + UI.Color(C.Inventory.CountOf(ItemDb.EnhanceStoneId) + "개", Theme.BlueHex), 15, Theme.Text, true, TextAnchor.MiddleRight, false, false);
            var list = UI.Column(body, 8);
            Anchors.Set("smith.list", list);
            foreach (var item in gear)
            {
                var it = item;
                bool equipped = C.Equipment.Find(item.Uid) != null;
                bool sel = item.Uid == _selected;
                var row = UI.ButtonCard(list, () =>
                {
                    _selected = it.Uid;
                    Rebuild();
                }, sel ? Theme.AccentBg : Theme.Card, sel ? Theme.Accent : Theme.CardBorder, 10, UI.Pad(12, 6), false, 8, 52);
                var col = UI.Column(row, 2);
                UI.Size(col, flexW: 1);
                UI.Label(col, UI.GradeTag(item.Grade) + " " + item.DisplayName, 14, Theme.GradeColor(item.Grade), true);
                UI.Sub(col, (equipped ? "착용 중 · " : "가방 · ") + Names.Of(item.Gear) + " · " + item.StatLine());
                UI.Label(row, "+" + item.Enhance, 14, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            }
            if (gear.Count == 0) UI.Sub(list, "강화할 장비가 없습니다.");
            Tutorial.OnFacility("blacksmith");
        }

        private void Detail(Transform parent, ItemInstance item)
        {
            var card = UI.Card(parent, Theme.Button, Theme.ButtonBorder, 12, UI.Pad(14, 12), true, 6);
            Anchors.Set("smith.detail", card);
            var head = UI.Row(card);
            var n = UI.Label(head, item.DisplayName, 16, Theme.GradeColor(item.Grade), true);
            UI.Size(n, flexW: 1);
            UI.Label(head, UI.GradeTag(item.Grade) + " " + UI.Color(Names.Of(item.Gear), Theme.SubHex), 12, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            ScreenKit.CompareLine(card, C, item);
            if (item.Enhance >= GameBalance.MaxEnhance)
            {
                UI.Label(card, "최대 강화(+10)에 도달했습니다.", 14, Theme.Gold);
                return;
            }
            int now = item.Value;
            int next = (int)System.Math.Round(item.BaseValue * (1.0 + GameBalance.EnhanceValuePerLevel * (item.Enhance + 1)));
            string what = item.IsWeapon ? "공격력" : item.IsAccessory ? Names.Of(item.BonusStat) : "방어력";
            UI.Label(card, "+" + item.Enhance + " → +" + (item.Enhance + 1) + " · " + what + " " + now + " → " + UI.Color(next.ToString(), Theme.GreenHex), 14, Theme.Text);
            int stones = Blacksmith.StoneCost(item);
            int have = C.Inventory.CountOf(ItemDb.EnhanceStoneId);
            UI.Sub(card, "성공률 " + ScreenKit.Percent(Blacksmith.SuccessRate(item)) + " · 비용 " + Blacksmith.GoldCost(item).ToString("#,0") + "G" + (Blacksmith.SuccessRate(item) < 1 ? " · 실패 시 재료·골드만 소모" : ""));
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
                default:
                    Toast(err);
                    return;
            }
            S.Save();
            Rebuild();
        }
    }
}

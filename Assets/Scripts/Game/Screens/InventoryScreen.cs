using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>가방·장비: 장비 8칸, 4열 가방(종류 색 원·등급 색 이름·착용 레벨·비교), 선택 아이템 정보(착용·판매·사용), 사망 손실 안내.</summary>
    public class InventoryScreen : ScreenBase
    {
        private readonly bool _fromDungeon;
        private string _selected;
        private EquipSlot? _selectedSlot;

        public InventoryScreen(bool fromDungeon = false)
        {
            _fromDungeon = fromDungeon;
        }

        public override bool OnBack()
        {
            Back();
            return true;
        }

        private void Back()
        {
            if (_fromDungeon) App.GoToCurrent();
            else Go(new TownScreen());
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            if (_fromDungeon) ScreenKit.TopBar(page, "가방", "던전", Back, "HP " + C.CurrentHp + "/" + CharacterStats.MaxHp(C));
            else ScreenKit.TopBar(page, "가방", "마을", Back, C);
            var body = UI.Scroll(page, out _, 10, UI.Pad(16, 14), "inventory");

            UI.Label(body, "장착 장비", 14, Theme.Text, true);
            var slots = UI.Grid(body, 4, ScreenKit.ContentWidth, 66, 6);
            foreach (EquipSlot slot in System.Enum.GetValues(typeof(EquipSlot))) SlotCell(slots, slot);

            var head = UI.Row(body, 8);
            UI.Size(head, height: 44);
            var t = UI.Label(head, "가방 " + UI.Color(C.Inventory.UsedCells + " / " + C.Inventory.Capacity, Theme.SubHex), 14, Theme.Text, true);
            UI.Size(t, flexW: 1);
            if (!_fromDungeon)
            {
                var expand = UI.TextButton(head, "가방 확장", () => Go(new ShopScreen()), ButtonKind.Ghost, 40, 13);
                UI.SetEnabled(expand, ShopSystem.CanBuyBag(C));
            }
            ItemGrid.Legend(body);
            ItemGrid.Build(body, C.Inventory, _selected, item =>
            {
                _selected = item.Uid;
                _selectedSlot = null;
                Rebuild();
            });

            Detail(body);
            UI.Sub(body, "사망하면 장착하지 않은 아이템을 모두 잃습니다. 길드 창고에 맡겨 두세요.");

            if (!_fromDungeon) ScreenKit.BottomNav(page, 2);
        }

        private void SlotCell(Transform grid, EquipSlot slot)
        {
            var item = C.Equipment[slot];
            bool sel = _selectedSlot == slot;
            var border = sel ? Theme.Accent : item != null && item.IsWeapon ? Theme.Blue : Theme.CardBorder;
            var cell = UI.ButtonCard(grid, () =>
            {
                _selectedSlot = slot;
                _selected = null;
                Rebuild();
            }, item == null ? Theme.Bg : Theme.Card, border, 10, UI.Pad(8, 6), true, 0, 66, TextAnchor.UpperLeft);
            UI.Sub(cell, Names.Of(slot));
            UI.Spacer(cell);
            if (item == null) UI.Sub(cell, "비어 있음");
            else UI.Label(cell, item.DisplayName, 12, Theme.GradeColor(item.Grade));
        }

        private void Detail(Transform parent)
        {
            ItemInstance item = null;
            bool equipped = false;
            if (_selectedSlot != null)
            {
                item = C.Equipment[_selectedSlot.Value];
                equipped = true;
            }
            else if (_selected != null) item = C.Inventory.Find(_selected);
            if (item == null) return;

            var card = UI.Card(parent, Theme.Button, Theme.ButtonBorder, 12, UI.Pad(12, 10), true, 6);
            var head = UI.Row(card);
            var n = UI.Label(head, item.Count > 1 ? item.DisplayName + " ×" + item.Count : item.DisplayName, 15, Theme.ItemColor(item), true);
            UI.Size(n, flexW: 1);
            string kind = item.Kind == ItemKind.Equipment ? UI.GradeTag(item.Grade) + " " + UI.Color(Names.Of(item.Gear), Theme.SubHex) : UI.Color(KindName(item.Kind), Theme.SubHex);
            UI.Label(head, kind, 12, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            UI.Label(card, item.StatLine(), 13, Theme.Text);
            if (!equipped) ScreenKit.CompareLine(card, C, item);

            var row = UI.Row(card, 8);
            if (equipped)
            {
                Action(row, "해제", ButtonKind.Secondary, () =>
                {
                    if (!EquipmentSystem.Unequip(C, _selectedSlot.Value, out string err)) Toast(err);
                    else _selectedSlot = null;
                    Save();
                });
                return;
            }
            switch (item.Kind)
            {
                case ItemKind.Equipment:
                    string reason = EquipmentSystem.CannotEquipReason(C, item);
                    if (reason != null) UI.Label(card, reason, 12, Theme.RedLight);
                    var eq = Action(row, "착용", ButtonKind.Primary, () =>
                    {
                        if (!EquipmentSystem.Equip(C, item.Uid, out string err)) Toast(err);
                        else
                        {
                            Toast(item.DisplayName + " 착용");
                            _selected = null;
                        }
                        Save();
                    });
                    UI.SetEnabled(eq, reason == null);
                    break;
                case ItemKind.Consumable:
                    var def = ItemDb.Consumable(item.TemplateId);
                    var use = Action(row, "사용", ButtonKind.Primary, () =>
                    {
                        S.UseConsumable(item.Uid, out string msg);
                        Toast(msg);
                        if (C.Inventory.Find(item.Uid) == null) _selected = null;
                        Rebuild();
                    });
                    UI.SetEnabled(use, _fromDungeon && def != null && def.HealRatio > 0 && C.CurrentHp < CharacterStats.MaxHp(C));
                    break;
                case ItemKind.SkillBook:
                    Action(row, "읽기", ButtonKind.Primary, () =>
                    {
                        if (!SkillSystem.UseSkillBook(C, item.Uid, out string err)) Toast(err);
                        else
                        {
                            Toast(SkillDb.Get(item.SkillId).Name + " 스킬을 배웠다! 스킬 화면에서 장착하세요");
                            if (C.Inventory.Find(item.Uid) == null) _selected = null;
                        }
                        Save();
                    });
                    break;
            }
            if (_fromDungeon)
            {
                Action(row, "버리기", ButtonKind.Ghost, () => Overlay.Confirm("버리기", Names.Josa(item.DisplayName, "을/를") + " 버릴까요? 되찾을 수 없습니다.", "버리기", () =>
                {
                    C.Inventory.Take(item.Uid);
                    _selected = null;
                    Save();
                }, "취소", ButtonKind.Secondary));
            }
            else
            {
                Action(row, "판매 · " + (item.SellPrice * item.Count).ToString("#,0") + "G", ButtonKind.Ghost, () =>
                {
                    ShopSystem.Sell(C, item.Uid, item.Count, out _);
                    _selected = null;
                    Save();
                });
            }
        }

        private static string KindName(ItemKind k)
        {
            switch (k)
            {
                case ItemKind.Consumable: return "소모품";
                case ItemKind.SkillBook: return "스킬서";
                case ItemKind.EnhanceStone: return "강화 재료";
                default: return "재료";
            }
        }

        private static RectTransform Action(Transform row, string label, ButtonKind kind, System.Action onClick)
        {
            var b = UI.TextButton(row, label, onClick, kind, 44, 14);
            UI.Size(b, width: 0, flexW: 1);
            return (RectTransform)b.transform;
        }

        private void Save()
        {
            S.Save();
            Rebuild();
        }
    }
}

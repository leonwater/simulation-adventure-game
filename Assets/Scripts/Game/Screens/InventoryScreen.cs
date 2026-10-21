using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>
    /// 가방·장비: 장비 8칸, 4열 가방(종류 색 원·등급 색 이름·착용 레벨·비교). 칸을 누르면 화면 가운데 팝업에
    /// 정보와 착용·해제·사용·판매(던전에서는 버리기)가 뜬다. 사망 손실 안내.
    /// </summary>
    public class InventoryScreen : ScreenBase
    {
        private readonly bool _fromDungeon;

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
                // 가방 확장: '+' 아이콘 버튼 → 확인 창에서 바로 구매 (v1.9, 상점의 가방 칸은 삭제)
                var expand = UI.ButtonCard(head, BuyBag, Theme.Bg, Theme.Accent, 10, UI.Pad(0), false, 0, 40, TextAnchor.MiddleCenter);
                UI.Size(expand, width: 40, height: 40, flexW: 0);
                UI.CenteredIcon(expand, "plus", 20).color = Theme.Gold;
                UI.SetEnabled(expand, ShopSystem.CanBuyBag(C));
            }
            ItemGrid.Legend(body);
            ItemGrid.Build(body, C.Inventory, null, item => ShowItem(item, null));
            UI.Sub(body, "사망하면 장착하지 않은 아이템을 모두 잃습니다. 길드 창고에 맡겨 두세요.");

            if (!_fromDungeon) ScreenKit.BottomNav(page, 2);
        }

        private void SlotCell(Transform grid, EquipSlot slot)
        {
            var item = C.Equipment[slot];
            var border = item != null && item.IsWeapon ? Theme.Blue : Theme.CardBorder;
            var cell = UI.ButtonCard(grid, () =>
            {
                if (item != null) ShowItem(item, slot);
            }, item == null ? Theme.Bg : Theme.Card, border, 10, UI.Pad(8, 6), true, 0, 66, TextAnchor.UpperLeft);
            UI.Sub(cell, Names.Of(slot));
            UI.Spacer(cell);
            if (item == null) UI.Sub(cell, "비어 있음");
            else UI.Label(cell, item.DisplayName, 12, Theme.GradeColor(item.Grade));
        }

        /// <summary>아이템 팝업 (화면 가운데): 이름·종류·수치·지금 장비와 비교, 착용·해제·사용·읽기·판매/버리기.</summary>
        private void ShowItem(ItemInstance item, EquipSlot? equippedSlot)
        {
            bool equipped = equippedSlot != null;
            var card = Overlay.Modal(item.Count > 1 ? item.DisplayName + " ×" + item.Count : item.DisplayName);
            var modal = Overlay.Top;
            System.Action done = () =>
            {
                Overlay.Close(modal);
                Save();
            };
            var head = UI.Row(card, 6, null, TextAnchor.MiddleLeft);
            ItemGrid.KindLine(head, item, 13);
            if (item.Kind == ItemKind.Equipment) UI.Label(head, UI.GradeTag(item.Grade), 13, Theme.Text, false, TextAnchor.MiddleLeft, false, false);
            UI.Label(card, item.StatLine(), 14, Theme.Text);
            if (item.Kind == ItemKind.Equipment && !equipped) ScreenKit.CompareLine(card, C, item);
            var book = item.Kind == ItemKind.SkillBook ? SkillDb.Get(item.SkillId) : null;
            if (book != null && book.JobRestriction >= 0)
                ScreenKit.JobLine(card, (Job)book.JobRestriction, Names.Of((Job)book.JobRestriction) + " 전용", 13, book.JobRestriction == (int)C.Job ? Theme.TextSub : Theme.RedLight);

            var row = UI.Row(card, 8);
            if (equipped)
            {
                Action(row, "해제", ButtonKind.Secondary, () =>
                {
                    if (!EquipmentSystem.Unequip(C, equippedSlot.Value, out string err)) Toast(err);
                    done();
                });
                return;
            }
            switch (item.Kind)
            {
                case ItemKind.Equipment:
                    string reason = EquipmentSystem.CannotEquipReason(C, item);
                    if (reason != null) UI.Label(card, reason, 13, Theme.RedLight);
                    var cur = EquipmentSystem.ReplacedBy(C, item);
                    var eq = Action(row, cur != null ? "교체" : "착용", ButtonKind.Primary, () =>
                    {
                        if (!EquipmentSystem.Equip(C, item.Uid, out string err)) Toast(err);
                        else Toast(item.DisplayName + " 착용");
                        done();
                    });
                    UI.SetEnabled(eq, reason == null);
                    break;
                case ItemKind.Consumable:
                    var def = ItemDb.Consumable(item.TemplateId);
                    var use = Action(row, "사용", ButtonKind.Primary, () =>
                    {
                        S.UseConsumable(item.Uid, out string msg);
                        Toast(msg);
                        done();
                    });
                    UI.SetEnabled(use, _fromDungeon && def != null && def.HealRatio > 0 && C.CurrentHp < CharacterStats.MaxHp(C));
                    break;
                case ItemKind.SkillBook:
                    Action(row, "읽기", ButtonKind.Primary, () =>
                    {
                        if (!SkillSystem.UseSkillBook(C, item.Uid, out string err)) Toast(err);
                        else Toast(SkillDb.Get(item.SkillId).Name + " 스킬을 배웠다! 스킬 화면에서 장착하세요");
                        done();
                    });
                    break;
            }
            if (_fromDungeon)
            {
                Action(row, "버리기", ButtonKind.Ghost, () => Overlay.Confirm("버리기", Names.Josa(item.DisplayName, "을/를") + " 버릴까요? 되찾을 수 없습니다.", "버리기", () =>
                {
                    C.Inventory.Take(item.Uid);
                    done();
                }, "취소", ButtonKind.Secondary));
            }
            else
            {
                Action(row, "판매 · " + (item.SellPrice * item.Count).ToString("#,0") + "G", ButtonKind.Ghost, () =>
                {
                    ShopSystem.Sell(C, item.Uid, item.Count, out _);
                    done();
                });
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

        private void BuyBag()
        {
            int price = ShopSystem.BagPrice(C);
            int after = System.Math.Min(GameBalance.InventoryMax, C.Inventory.Capacity + GameBalance.InventoryPerBag);
            Overlay.Confirm("가방 확장", price.ToString("#,0") + "G를 소모하여 가방을 " + (after - C.Inventory.Capacity) + "칸 확장하겠습니까?\n("
                                       + C.Inventory.Capacity + " → " + after + "칸)", "확장 · " + price.ToString("#,0") + "G", () =>
            {
                if (!ShopSystem.BuyBag(C, out string err))
                {
                    Toast(err);
                    return;
                }
                S.Save();
                Toast("가방이 " + C.Inventory.Capacity + "칸이 됐다");
                Rebuild();
            });
        }
    }
}

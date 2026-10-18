using System;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>상점: 자동 갱신 타이머·즉시 갱신, 장비 6칸, 소모품·스킬서·가방, 판매.</summary>
    public class ShopScreen : ScreenBase
    {
        private Text _timer;

        public override bool OnBack()
        {
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            S.TickShop();
            S.MarkShopSeen();
            var shop = S.Data.Shop;
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "상점", "마을", () => Go(new TownScreen()), Names.Gold(C.Gold));
            var body = UI.Scroll(page, out _, 14, UI.Pad(0, 0, 0, 16), "shop");
            UI.Illustration(body, "상점 주인", 190);

            var inner = UI.Column(body, 14, UI.Pad(12, 12, 0, 0));

            // 갱신
            var refresh = UI.Card(inner, Theme.Card, Theme.CardBorder, 10, UI.Pad(12, 8, 8, 8), false, 8, TextAnchor.MiddleLeft);
            Anchors.Set("shop.refresh", refresh);
            var tcol = UI.Column(refresh, 0);
            UI.Size(tcol, flexW: 1);
            UI.Sub(tcol, "자동 갱신까지");
            _timer = UI.Label(tcol, TimerText(), 18, Theme.Text);
            UI.TextButton(refresh, "즉시 갱신 · " + ShopSystem.RerollCost(shop) + "G", Reroll, ButtonKind.Outline, 44, 14);

            // 장비
            var eqBox = UI.Column(inner, 8);
            Anchors.Set("shop.equip", eqBox);
            UI.Label(eqBox, "장비", 14, Theme.Text, true);
            if (shop.Equipment.Count == 0) UI.Sub(eqBox, "장비가 모두 팔렸습니다. 다음 갱신을 기다리세요.");
            UI.Sub(eqBox, "카드를 누르면 자세한 정보와 착용 장비 비교가 나옵니다.");
            var grid = UI.Grid(eqBox, 3, Theme.ScreenWidth - 24, 104, 8);
            foreach (var item in shop.Equipment) EquipCell(grid, item);

            // 소모품 · 스킬 · 가방 (3열 카드: 이름 · 종류 · 효과 · 가격)
            var goods = UI.Column(inner, 8);
            Anchors.Set("shop.goods", goods);
            UI.Label(goods, "소모품 · 스킬 · 가방", 14, Theme.Text, true);
            var ggrid = UI.Grid(goods, 3, Theme.ScreenWidth - 24, 104, 8);
            foreach (var g in shop.Goods) GoodCell(ggrid, g);
            BagCell(ggrid);

            // 판매
            var sell = UI.Column(inner, 8);
            Anchors.Set("shop.sell", sell);
            UI.Label(sell, "판매", 14, Theme.Text, true);
            UI.Sub(sell, "가방의 아이템을 누르면 팔 수 있습니다. 장착 중인 장비는 팔 수 없습니다.");
            ItemGrid.Build(sell, C.Inventory, null, SellDialog, false, Theme.ScreenWidth - 24);
            if (C.Inventory.Items.Count == 0) UI.Sub(sell, "가방이 비어 있습니다.");
            var junk = UI.TextButton(sell, "재료 모두 팔기", SellMaterials, ButtonKind.Ghost, 44, 14);
            UI.SetEnabled(junk, C.Inventory.Items.Exists(i => i.Kind == ItemKind.Material));

            var ticker = root.gameObject.AddComponent<Ticker>();
            ticker.Interval = 1f;
            ticker.OnTick = () =>
            {
                if (S.TickShop())
                {
                    Toast("상점 물건이 바뀌었습니다");
                    Rebuild();
                    return;
                }
                if (_timer != null) _timer.text = TimerText();
            };
        }

        private string TimerText()
        {
            var left = S.ShopTimeLeft;
            return ((int)left.TotalMinutes).ToString("00") + ":" + left.Seconds.ToString("00");
        }

        /// <summary>장비 카드: 등급·부위(크게) · 이름 · 가격. 효과와 비교는 눌렀을 때 (수정 사항 #16).</summary>
        private void EquipCell(Transform grid, ItemInstance item)
        {
            bool usable = item.CanBeUsedBy(C.Job);
            var cell = UI.ButtonCard(grid, () => BuyEquipDialog(item), Theme.Card, Theme.CardBorder, 10, UI.Pad(10, 10), true, 6, 104, TextAnchor.UpperLeft);
            UI.Label(cell, UI.GradeTag(item.Grade), 13, Theme.Text, true, TextAnchor.MiddleLeft, false, false);
            UI.Label(cell, Names.Of(item.Gear) + (usable ? "" : UI.Color(" · " + Names.Of((Job)item.JobRestriction) + " 전용", Theme.RedHex)), 13, Theme.TextBody, false, TextAnchor.MiddleLeft, false, false);
            UI.Label(cell, item.Name, 14, Theme.Text, true, TextAnchor.MiddleLeft, false, false);
            UI.Spacer(cell);
            UI.Label(cell, item.Price.ToString("#,0") + " G", 14, Theme.Gold, true);
            if (!usable) cell.gameObject.AddComponent<CanvasGroup>().alpha = 0.55f;
        }

        private void BuyEquipDialog(ItemInstance item)
        {
            var body = Overlay.Modal(item.Name);
            var modal = Overlay.Top;
            UI.Label(body, UI.GradeTag(item.Grade) + " " + Names.Of(item.Gear), 13, Theme.Text);
            UI.Label(body, item.StatLine(), 14, Theme.Text);
            ScreenKit.CompareLine(body, C, item);
            string reason = EquipmentSystem.CannotEquipReason(C, item);
            if (reason != null) UI.Label(body, reason, 13, Theme.RedLight);
            UI.TextButton(body, "구매 · " + item.Price.ToString("#,0") + "G", () =>
            {
                if (!ShopSystem.BuyEquipment(S.Data.Shop, C, item.Uid, out string err))
                {
                    Toast(err);
                    return;
                }
                Overlay.Close(modal);
                S.Save();
                Toast(item.Name + " 구매 완료");
                Rebuild();
            }, ButtonKind.Primary);
        }

        private void GoodCell(Transform grid, ShopGood g)
        {
            var item = g.Item;
            var cell = UI.ButtonCard(grid, () => BuyGoodDialog(g), Theme.Card, Theme.CardBorder, 10, UI.Pad(10, 10), true, 6, 104, TextAnchor.UpperLeft);
            string kind = item.Kind == ItemKind.SkillBook ? "스킬서 · " + Names.Of(SkillDb.Get(item.SkillId).Tier) : "소모품";
            string name = item.Kind == ItemKind.SkillBook ? SkillDb.Get(item.SkillId).Name : item.Name;
            UI.Label(cell, kind, 13, Theme.TextBody, false, TextAnchor.MiddleLeft, false, false);
            UI.Label(cell, name, 14, Theme.Text, true, TextAnchor.MiddleLeft, false, false);
            if (item.Kind == ItemKind.Consumable) UI.Label(cell, "보유 " + C.Inventory.CountOf(item.TemplateId), 12, Theme.TextSub);
            else if (C.Skills.Knows(item.SkillId)) UI.Label(cell, "이미 배움", 12, Theme.RedLight);
            UI.Spacer(cell);
            UI.Label(cell, item.Price.ToString("#,0") + " G", 14, Theme.Gold, true);
        }

        private void BuyGoodDialog(ShopGood g)
        {
            var item = g.Item;
            var body = Overlay.Modal(item.Name);
            var modal = Overlay.Top;
            UI.Label(body, item.StatLine(), 14, Theme.Text);
            if (item.Kind == ItemKind.SkillBook)
            {
                var def = SkillDb.Get(item.SkillId);
                UI.Sub(body, "장착 조건 Lv." + def.ReqLevel + " · " + def.ReqRank + " 등급");
                if (C.Skills.Knows(def.Id)) UI.Label(body, "이미 배운 스킬입니다.", 13, Theme.RedLight);
            }
            int count = 1;
            Text countLabel = null;
            Text buyLabel = null;
            if (g.Unlimited)
            {
                var row = UI.Row(body, 8, null, TextAnchor.MiddleCenter);
                UI.TextButton(row, "−", () => SetCount(-1), ButtonKind.Ghost, 44, 18, 56);
                countLabel = UI.Label(row, "1개", 16, Theme.Text, true, TextAnchor.MiddleCenter);
                UI.Size(countLabel, flexW: 1);
                UI.TextButton(row, "+", () => SetCount(1), ButtonKind.Ghost, 44, 18, 56);
                UI.TextButton(row, "+10", () => SetCount(10), ButtonKind.Ghost, 44, 14, 56);
            }
            var buy = UI.TextButton(body, "", () =>
            {
                if (!ShopSystem.BuyGood(S.Data.Shop, C, item.Uid, count, out string err))
                {
                    Toast(err);
                    return;
                }
                Overlay.Close(modal);
                S.Save();
                Toast(item.Name + (count > 1 ? " ×" + count : "") + " 구매 완료");
                Rebuild();
            }, ButtonKind.Primary);
            buyLabel = buy.GetComponentInChildren<Text>();
            Refresh();

            void SetCount(int delta)
            {
                count = Mathf.Clamp(count + delta, 1, GameBalance.MaxStack);
                Refresh();
            }

            void Refresh()
            {
                if (countLabel != null) countLabel.text = count + "개";
                buyLabel.text = "구매 · " + (item.Price * count).ToString("#,0") + "G";
            }
        }

        private void BagCell(Transform grid)
        {
            bool can = ShopSystem.CanBuyBag(C);
            var cell = UI.ButtonCard(grid, BuyBag, Theme.Card, Theme.CardBorder, 10, UI.Pad(10, 10), true, 6, 104, TextAnchor.UpperLeft);
            UI.Label(cell, "확장", 13, Theme.TextBody, false, TextAnchor.MiddleLeft, false, false);
            UI.Label(cell, "가방", 14, Theme.Text, true);
            UI.Label(cell, C.Inventory.Capacity + "칸", 12, Theme.TextSub);
            UI.Spacer(cell);
            UI.Label(cell, can ? ShopSystem.BagPrice(C).ToString("#,0") + " G" : "최대", 14, Theme.Gold, true);
            if (!can) UI.SetEnabled(cell, false);
        }

        private void BuyBag()
        {
            Overlay.Confirm("가방 구매", "가방 칸을 " + C.Inventory.Capacity + " → " + Math.Min(GameBalance.InventoryMax, C.Inventory.Capacity + GameBalance.InventoryPerBag) + "칸으로 늘립니다. 가방 확장은 쓰러져도 유지됩니다.",
                "구매 · " + ShopSystem.BagPrice(C).ToString("#,0") + "G", () =>
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

        private void Reroll()
        {
            if (!ShopSystem.Reroll(S.Data.Shop, C, S.Rng, out string err))
            {
                Toast(err);
                return;
            }
            S.Save();
            Rebuild();
        }

        private void SellDialog(ItemInstance item)
        {
            var body = Overlay.Modal(item.DisplayName);
            var modal = Overlay.Top;
            if (item.Kind == ItemKind.Equipment) UI.Label(body, UI.GradeTag(item.Grade) + " " + Names.Of(item.Gear), 13, Theme.Text);
            UI.Label(body, item.StatLine(), 14, Theme.Text);
            if (S.Data.Guild.Active.Exists(q => q.MaterialId == item.TemplateId))
                UI.Label(body, "진행 중인 채집 퀘스트에 필요한 재료입니다.", 13, Theme.Gold);
            var row = UI.Row(body, 8);
            if (item.Count > 1)
            {
                var one = UI.TextButton(row, "1개 · " + item.SellPrice + "G", () => Sell(item, 1, modal), ButtonKind.Secondary);
                UI.Size(one, flexW: 1);
            }
            var all = UI.TextButton(row, (item.Count > 1 ? "전부 · " : "판매 · ") + (item.SellPrice * item.Count).ToString("#,0") + "G", () => Sell(item, item.Count, modal), ButtonKind.Primary);
            UI.Size(all, flexW: 1);
        }

        private void Sell(ItemInstance item, int count, GameObject modal)
        {
            if (!ShopSystem.Sell(C, item.Uid, count, out string err))
            {
                Toast(err);
                return;
            }
            Overlay.Close(modal);
            S.Save();
            Rebuild();
        }

        private void SellMaterials()
        {
            long total = 0;
            foreach (var i in C.Inventory.Items)
                if (i.Kind == ItemKind.Material && !S.Data.Guild.Active.Exists(q => q.MaterialId == i.TemplateId))
                    total += (long)i.SellPrice * i.Count;
            Overlay.Confirm("재료 판매", "진행 중인 퀘스트에 필요한 재료를 빼고 모두 팝니다. (" + total.ToString("#,0") + "G)", "판매", () =>
            {
                foreach (var i in C.Inventory.Items.ToArray())
                    if (i.Kind == ItemKind.Material && !S.Data.Guild.Active.Exists(q => q.MaterialId == i.TemplateId))
                        ShopSystem.Sell(C, i.Uid, i.Count, out _);
                S.Save();
                Rebuild();
            });
        }
    }
}

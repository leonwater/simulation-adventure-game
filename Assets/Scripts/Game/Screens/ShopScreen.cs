using System;
using System.Collections.Generic;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 상점: 상점 주인 일러스트·대사, 구매 탭(갱신·장비·소모품) / 판매 탭(가방 물건을 구매와 같은 카드로).
    /// 판매 탭은 카드를 길게 누르거나 '여러 개 선택'을 누르면 선택 모드가 되어 여러 칸을 한 번에 판다 (v1.8).
    /// </summary>
    public class ShopScreen : ScreenBase
    {
        private Text _timer;
        private int _tab;
        /// <summary>판매 선택 모드에서 고른 칸 (null = 선택 모드가 아님).</summary>
        private HashSet<string> _selected;
        private string _line = "어서 오시게, 손님. 좋은 물건이 많다네. 골드만 있다면야 뭐든지!";

        public override bool OnBack()
        {
            if (_selected != null)
            {
                SetSelecting(false);
                return true;
            }
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            S.TickShop();
            S.MarkShopSeen();
            var shop = S.Data.Shop;
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "상점", "마을", () => Go(new TownScreen()), C);
            ScreenKit.NpcIllustration(page, "상점 주인", _line, 260);
            UI.Spacer(page, 0, 6);
            ScreenKit.Tabs(page, new[] { "구매", "판매" }, _tab, i =>
            {
                _tab = i;
                _selected = null;
                Rebuild();
            });
            Anchors.Set("shop.sell", Anchors.Get("tab.1"));
            var inner = UI.Scroll(page, out _, 14, UI.Pad(16, 16, 12, 16), "shop" + _tab);
            if (_tab == 0) BuyTab(inner, shop);
            else SellTab(inner);
            if (_selected != null) SellBar(page);

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
            Tutorial.OnFacility("shop");
        }

        private void BuyTab(Transform inner, ShopState shop)
        {
            // 갱신
            var refresh = UI.Card(inner, Theme.Card, Theme.CardBorder, 10, UI.Pad(12, 8, 8, 8), false, 8, TextAnchor.MiddleLeft);
            Anchors.Set("shop.refresh", refresh);
            var tcol = UI.Column(refresh, 0);
            UI.Size(tcol, flexW: 1);
            UI.Sub(tcol, "자동 갱신까지");
            _timer = UI.Label(tcol, TimerText(), 18, Theme.Text);
            UI.Label(refresh, ShopSystem.RerollCost(shop) + "G", 13, Theme.Gold, true, TextAnchor.MiddleRight, false, false);
            UI.TextButton(refresh, "갱신", ConfirmReroll, ButtonKind.Outline, 40, 13, 64);

            // 장비
            var eqBox = UI.Column(inner, 8);
            Anchors.Set("shop.equip", eqBox);
            UI.Label(eqBox, "장비", 14, Theme.Text, true);
            if (shop.Equipment.Count == 0) UI.Sub(eqBox, "장비가 모두 팔렸습니다. 다음 갱신을 기다리세요.");
            UI.Sub(eqBox, "카드를 누르면 자세한 정보와 착용 장비 비교가 나옵니다.");
            var grid = UI.Grid(eqBox, 3, ScreenKit.ContentWidth, 104, 8);
            foreach (var item in shop.Equipment) EquipCell(grid, item);

            // 소모품 · 스킬 · 가방
            var goods = UI.Column(inner, 8);
            Anchors.Set("shop.goods", goods);
            UI.Label(goods, "소모품 · 스킬 · 가방", 14, Theme.Text, true);
            var ggrid = UI.Grid(goods, 3, ScreenKit.ContentWidth, 104, 8);
            foreach (var g in shop.Goods) GoodCell(ggrid, g);
            BagCell(ggrid);
        }

        /// <summary>판매: 가방의 물건을 구매 카드와 같은 모양으로 (종류 · 이름 · 판매 가격).</summary>
        private void SellTab(Transform inner)
        {
            var head = UI.Row(inner, 8);
            var t = UI.Label(head, "가방 " + UI.Color(C.Inventory.UsedCells + " / " + C.Inventory.Capacity, Theme.SubHex), 14, Theme.Text, true);
            UI.Size(t, flexW: 1);
            bool any = C.Inventory.Items.Count > 0;
            if (_selected == null)
            {
                var multi = UI.TextButton(head, "여러 개 선택", () => SetSelecting(true), ButtonKind.Outline, 40, 13);
                UI.SetEnabled(multi, any);
                var junk = UI.TextButton(head, "재료 모두 팔기", SellMaterials, ButtonKind.Ghost, 40, 13);
                UI.SetEnabled(junk, C.Inventory.Items.Exists(i => i.Kind == ItemKind.Material));
                UI.Sub(inner, "카드를 누르면 팔 수 있고, 길게 누르면 여러 개를 골라 한 번에 팝니다. 장착 중인 장비는 팔리지 않습니다.");
            }
            else
            {
                bool all = _selected.Count == C.Inventory.Items.Count;
                UI.TextButton(head, all ? "모두 해제" : "모두 선택", () =>
                {
                    if (all) _selected.Clear();
                    else foreach (var i in C.Inventory.Items) _selected.Add(i.Uid);
                    Rebuild();
                }, ButtonKind.Ghost, 40, 13);
                UI.TextButton(head, "장비만 선택", () =>
                {
                    _selected.Clear();
                    foreach (var i in C.Inventory.Items) if (i.Kind == ItemKind.Equipment) _selected.Add(i.Uid);
                    Rebuild();
                }, ButtonKind.Ghost, 40, 13);
                UI.Sub(inner, "팔 물건을 누르세요. 여러 개 쌓인 칸은 전부 팝니다.");
            }
            if (!any)
            {
                UI.Sub(inner, "가방이 비어 있습니다.");
                return;
            }
            var grid = UI.Grid(inner, 3, ScreenKit.ContentWidth, 104, 8);
            foreach (var item in C.Inventory.Items) SellCell(grid, item);
        }

        private void SellCell(Transform grid, ItemInstance item)
        {
            var it = item;
            bool sel = _selected != null && _selected.Contains(item.Uid);
            var cell = UI.ButtonCard(grid, null, sel ? Theme.AccentBg : Theme.Card, sel ? Theme.Accent : Theme.CardBorder, 10, UI.Pad(10, 10), true, 5, 104, TextAnchor.UpperLeft);
            LongPress.Add(cell, () =>
            {
                if (_selected == null) _selected = new HashSet<string>();
                _selected.Add(it.Uid);
                Rebuild();
            }, () =>
            {
                if (_selected == null)
                {
                    SellDialog(it);
                    return;
                }
                if (!_selected.Remove(it.Uid)) _selected.Add(it.Uid);
                Rebuild();
            });
            ItemGrid.KindLine(cell, item, 12);
            UI.Label(cell, ItemGrid.Short(item.DisplayName, 6) + (item.Count > 1 ? " ×" + item.Count : ""), 13, ItemGrid.NameColor(item), true, TextAnchor.MiddleLeft, false, false);
            if (item.Kind == ItemKind.Equipment) UI.Label(cell, ItemGrid.LevelCompare(C, item, false), 12, Theme.TextSub);
            UI.Spacer(cell);
            UI.Label(cell, (item.SellPrice * item.Count).ToString("#,0") + " G", 14, Theme.Gold, true);
            if (sel) Check(cell);
        }

        /// <summary>선택된 칸 오른쪽 위 체크 표시 (배치 무시).</summary>
        private static void Check(RectTransform cell)
        {
            var mark = UI.Label(cell, "✓", 16, Theme.OnAccent, true, TextAnchor.MiddleCenter, false, false);
            var bg = UI.Image(cell, Theme.Accent, 0, "check");
            bg.sprite = Sprites.Circle;
            foreach (var rt in new[] { bg.rectTransform, mark.rectTransform })
            {
                rt.gameObject.AddComponent<LayoutElement>().ignoreLayout = true;
                rt.anchorMin = rt.anchorMax = new Vector2(1, 1);
                rt.pivot = new Vector2(1, 1);
                rt.sizeDelta = new Vector2(22, 22);
                rt.anchoredPosition = new Vector2(-6, -6);
            }
            mark.transform.SetAsLastSibling();
        }

        private void SetSelecting(bool on)
        {
            _selected = on ? new HashSet<string>() : null;
            Rebuild();
        }

        /// <summary>선택 모드 아래 고정 줄: "N개 선택 · 합계" + 취소 · 판매.</summary>
        private void SellBar(Transform page)
        {
            long total = 0;
            foreach (var i in C.Inventory.Items) if (_selected.Contains(i.Uid)) total += (long)i.SellPrice * i.Count;
            var bar = UI.Card(page, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 16, 10, 10), false, 8, TextAnchor.MiddleLeft, "sell-bar");
            ScreenKit.TopLine(bar);
            var info = UI.Column(bar, 2);
            UI.Size(info, flexW: 1);
            UI.Label(info, _selected.Count + "칸 선택", 14, Theme.Text, true);
            UI.Label(info, "합계 " + total.ToString("#,0") + " G", 13, Theme.Gold, true);
            UI.TextButton(bar, "취소", () => SetSelecting(false), ButtonKind.Ghost, 44, 14, 64);
            var sell = UI.TextButton(bar, "판매", () => Overlay.Confirm("한 번에 판매", _selected.Count + "칸을 " + total.ToString("#,0") + "G에 팝니다.", "판매", () =>
            {
                long got = ShopSystem.SellMany(C, _selected);
                _selected = null;
                _line = "흠, 이 정도면 값을 쳐 주지. 거래 고맙네.";
                S.Save();
                Toast(got.ToString("#,0") + "G를 받았다");
                Rebuild();
            }), ButtonKind.Primary, 44, 14, 84);
            UI.SetEnabled(sell, _selected.Count > 0);
        }

        private void ConfirmReroll()
        {
            int cost = ShopSystem.RerollCost(S.Data.Shop);
            Overlay.Confirm("상점 갱신", cost.ToString("#,0") + "G를 소모하여 즉시 갱신하겠습니까?", "갱신", Reroll);
        }

        private string TimerText()
        {
            var left = S.ShopTimeLeft;
            return ((int)left.TotalMinutes).ToString("00") + ":" + left.Seconds.ToString("00");
        }

        /// <summary>장비 카드: 종류 색 원·부위 · 이름(등급 색) · 착용 레벨과 지금 장비 대비 · 가격. 자세한 효과는 눌렀을 때.</summary>
        private void EquipCell(Transform grid, ItemInstance item)
        {
            bool usable = item.CanBeUsedBy(C.Job);
            var cell = UI.ButtonCard(grid, () => BuyEquipDialog(item), Theme.Card, Theme.CardBorder, 10, UI.Pad(10, 10), true, 5, 104, TextAnchor.UpperLeft);
            ItemGrid.KindLine(cell, item, 12);
            UI.Label(cell, item.Name, 14, ItemGrid.NameColor(item), true, TextAnchor.MiddleLeft, false, false);
            UI.Label(cell, usable ? ItemGrid.LevelCompare(C, item, false) : UI.Color(Names.Of((Job)item.JobRestriction) + " 전용", Theme.RedHex), 12, Theme.TextSub);
            UI.Spacer(cell);
            UI.Label(cell, item.Price.ToString("#,0") + " G", 14, Theme.Gold, true);
            if (!usable) cell.gameObject.AddComponent<CanvasGroup>().alpha = 0.55f;
        }

        private void BuyEquipDialog(ItemInstance item)
        {
            var body = Overlay.Modal(item.Name);
            var modal = Overlay.Top;
            UI.Label(body, UI.GradeTag(item.Grade) + " " + ItemGrid.GearText(item), 13, Theme.Text);
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
                _line = "탁월한 선택이야, 손님! " + item.Name + "에 어울리는 모험이 기다리겠군.";
                Rebuild();
            }, ButtonKind.Primary);
        }

        private void GoodCell(Transform grid, ShopGood g)
        {
            var item = g.Item;
            var cell = UI.ButtonCard(grid, () => BuyGoodDialog(g), Theme.Card, Theme.CardBorder, 10, UI.Pad(10, 10), true, 5, 104, TextAnchor.UpperLeft);
            string name = item.Kind == ItemKind.SkillBook ? SkillDb.Get(item.SkillId).Name : item.Name;
            ItemGrid.KindLine(cell, item, 12);
            UI.Label(cell, name, 14, Theme.Text, true, TextAnchor.MiddleLeft, false, false);
            if (item.Kind == ItemKind.Consumable) UI.Label(cell, "보유 " + C.Inventory.CountOf(item.TemplateId), 12, Theme.TextSub);
            else if (C.Skills.Knows(item.SkillId)) UI.Label(cell, "이미 배움", 12, Theme.RedLight);
            else SkillBookJob(cell, item, 12);
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
                SkillBookJob(body, item, 13);
                UI.Sub(body, "장착 조건 Lv." + def.ReqLevel + " · " + def.ReqRank + " 등급");
                if (C.Skills.Knows(def.Id)) UI.Label(body, "이미 배운 스킬입니다.", 13, Theme.RedLight);
            }
            int count = 1;
            Text countLabel = null;
            Text buyLabel = null;
            if (g.Unlimited)
            {
                // 능력치 배분과 같은 고정 폭 − 값 + (값이 늘어도 버튼이 움직이지 않는다) + 10개씩
                var row = UI.Row(body, 8, null, TextAnchor.MiddleCenter);
                ScreenKit.Stepper(row, "1개", () => SetCount(-1), true, () => SetCount(1), true, out countLabel);
                UI.TextButton(row, "+10", () => SetCount(10), ButtonKind.Outline, 44, 16, 56);
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
                _line = "고맙네! 또 필요하면 언제든 들르시게.";
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

        /// <summary>스킬서를 쓸 수 있는 직업 (아이콘 + "전사 전용", 내 직업이 아니면 빨강).</summary>
        private void SkillBookJob(Transform parent, ItemInstance item, float size)
        {
            var def = SkillDb.Get(item.SkillId);
            if (def == null) return;
            if (def.JobRestriction < 0)
            {
                UI.Label(parent, "모든 직업", size, Theme.TextSub);
                return;
            }
            var job = (Job)def.JobRestriction;
            ScreenKit.JobLine(parent, job, Names.Of(job) + " 전용", size, job == C.Job ? Theme.TextSub : Theme.RedLight);
        }

        private void BagCell(Transform grid)
        {
            bool can = ShopSystem.CanBuyBag(C);
            var cell = UI.ButtonCard(grid, BuyBag, Theme.Card, Theme.CardBorder, 10, UI.Pad(10, 10), true, 5, 104, TextAnchor.UpperLeft);
            UI.Label(cell, "확장", 12, Theme.TextBody, false, TextAnchor.MiddleLeft, false, false);
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
            _line = "자, 새 물건이 들어왔다네. 천천히 골라 보시게.";
            S.Save();
            Rebuild();
        }

        private void SellDialog(ItemInstance item)
        {
            var body = Overlay.Modal(item.DisplayName);
            var modal = Overlay.Top;
            if (item.Kind == ItemKind.Equipment) UI.Label(body, UI.GradeTag(item.Grade) + " " + ItemGrid.GearText(item), 13, Theme.Text);
            UI.Label(body, item.StatLine(), 14, Theme.Text);
            if (S.Data.Guild.Active.Exists(q => q.MaterialId == item.TemplateId))
                UI.Label(body, "진행 중인 채집 퀘스트에 필요한 재료입니다.", 13, Theme.Gold);
            var row = UI.Row(body, 8);
            if (item.Count > 1)
            {
                var one = UI.TextButton(row, "1개 · " + item.SellPrice + "G", () => Sell(item, 1, modal), ButtonKind.Secondary);
                UI.Size(one, width: 0, flexW: 1);
            }
            var all = UI.TextButton(row, (item.Count > 1 ? "전부 · " : "판매 · ") + (item.SellPrice * item.Count).ToString("#,0") + "G", () => Sell(item, item.Count, modal), ButtonKind.Primary);
            UI.Size(all, width: 0, flexW: 1);
        }

        private void Sell(ItemInstance item, int count, GameObject modal)
        {
            if (!ShopSystem.Sell(C, item.Uid, count, out string err))
            {
                Toast(err);
                return;
            }
            Overlay.Close(modal);
            _line = "흠, 이 정도면 값을 쳐 주지. 거래 고맙네.";
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

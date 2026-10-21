using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>
    /// 던전 상인 (v2.3: 팝업 대신 전체 화면). 맨 위에 보유 골드와 가방을 크고 하얗게 아이콘과 함께 보여 주고,
    /// 물건마다 가격·보유·재고를 카드로 보여 준다. 사면 숫자가 바로 바뀌고, 나가면 이동 방향키가 있는 던전 화면으로 돌아간다.
    /// </summary>
    public class MerchantScreen : ScreenBase
    {
        private RectTransform _info;
        private RectTransform _list;

        public override bool OnBack()
        {
            Leave();
            return true;
        }

        private void Leave() => Go(new DungeonScreen());

        public override void Build(RectTransform root)
        {
            var run = S.Run;
            if (run == null)
            {
                App.GoToCurrent();
                return;
            }
            var tint = UI.Image(root, Theme.DungeonBg(run.Floor), 0, "theme");
            UI.Stretch(tint.rectTransform);
            var page = ScreenKit.Page(root);
            bool rescued = run.Current.MerchantDiscount;
            ScreenKit.DungeonSubBar(page, rescued ? "구해 준 상인" : "떠돌이 상인", "던전", Leave, C, ScreenKit.DungeonPauseMenu);

            var body = UI.Scroll(page, out _, 10, UI.Pad(16, 16, 14, 12));
            _info = UI.Column(body, 0);
            UI.Sub(body, rescued ? "은인에게는 마을보다 30% 싸게 팝니다." : "마을보다 50% 비싸게 팝니다. 필요한 것만 사 가세요.");
            _list = UI.Column(body, 8);
            Fill();

            var bottom = UI.Card(page, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 16, 8, 8), false, 8, TextAnchor.MiddleCenter, "bottom");
            ScreenKit.TopLine(bottom);
            var leave = UI.TextButton(bottom, "거래를 마친다", Leave, ButtonKind.Primary, 52);
            UI.Size(leave, width: 0, flexW: 1);
        }

        /// <summary>보유 골드와 가방은 눈에 잘 띄게: 큰 흰 글씨 + 아이콘, 두 칸으로 나란히.</summary>
        private void Fill()
        {
            UI.Clear(_info);
            var card = UI.Card(_info, Theme.Card, Theme.ButtonBorder, 12, UI.Pad(14, 12), false, 10, TextAnchor.MiddleCenter);
            UI.Size(card, height: 64);
            var gold = UI.Row(card, 8, null, TextAnchor.MiddleLeft);
            UI.Size(gold, flexW: 1);
            UI.Icon(gold, "gold", 28);
            UI.Label(gold, Names.Gold(C.Gold), 20, Color.white, true, TextAnchor.MiddleLeft, false, false);
            var bag = UI.Row(card, 8, null, TextAnchor.MiddleRight);
            UI.Size(bag, flexW: 1);
            UI.HSpacer(bag);
            UI.Icon(bag, "bag", 28);
            UI.Label(bag, C.Inventory.UsedCells + " / " + C.Inventory.Capacity, 20, Color.white, true, TextAnchor.MiddleRight, false, false);

            UI.Clear(_list);
            var goods = S.Run.Current.MerchantGoods;
            if (goods.Count == 0) UI.Sub(_list, "물건이 모두 팔렸습니다.");
            foreach (var g in goods)
            {
                var good = g;
                int price = S.MerchantPrice(g.Item);
                bool can = C.Gold >= price;
                var row = UI.ButtonCard(_list, () => Buy(good), Theme.Button, Theme.ButtonBorder, 12, UI.Pad(14, 8), false, 10, 68, TextAnchor.MiddleLeft);
                var left = UI.Column(row, 2, null, TextAnchor.MiddleLeft);
                UI.Size(left, flexW: 1);
                UI.Label(left, g.Item.Name, 16, Color.white, true);
                var def = ItemDb.Consumable(g.Item.TemplateId);
                if (def != null) UI.Label(left, def.Description, 12, Theme.TextSub);
                UI.Label(left, "보유 " + C.Inventory.CountOf(g.Item.TemplateId) + " · 재고 " + g.Stock, 12, Theme.TextBody);
                var right = UI.Row(row, 4, null, TextAnchor.MiddleRight);
                UI.Icon(right, "gold", 18);
                UI.Label(right, price.ToString("#,0"), 16, can ? Color.white : Theme.RedLight, true, TextAnchor.MiddleRight, false, false);
                if (!can) UI.SetEnabled(row, false);
            }
        }

        private void Buy(ShopGood good)
        {
            if (!S.BuyFromMerchant(good.Item.Uid, 1, out string err))
            {
                Toast(err);
                return;
            }
            Overlay.Flash(good.Item.Name + " 구매", Theme.Gold, 0.8f);
            Fill();
        }
    }
}

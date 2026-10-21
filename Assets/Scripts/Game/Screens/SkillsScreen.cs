using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>스킬: 장착 슬롯, 보유 스킬(재사용 턴·장착 조건), 장착·해제. 스킬을 누르면 상세 창 (v1.9).</summary>
    public class SkillsScreen : ScreenBase
    {
        /// <summary>이번에 처음 보는 스킬 (NEW 표시). 화면에 들어오면 모두 확인한 것으로 기록한다.</summary>
        private System.Collections.Generic.HashSet<string> _new;

        public override bool OnBack()
        {
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            if (_new == null)
            {
                _new = new System.Collections.Generic.HashSet<string>();
                foreach (var sk in C.Skills.Learned)
                    if (S.Data.SeenSkills != null && !S.Data.SeenSkills.Contains(sk.SkillId)) _new.Add(sk.SkillId);
                S.MarkSkillsSeen();
                S.Save();
            }
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "스킬", "마을", () => Go(new TownScreen()), C);
            var body = UI.Scroll(page, out _, 12, UI.Pad(16, 16), "skills");
            int slots = RankSystem.SkillSlots(C.Rank);

            var head = UI.Row(body);
            var t = UI.Label(head, "장착 슬롯 " + C.Skills.Equipped.Count + " / " + slots, 14, Theme.Text, true);
            UI.Size(t, flexW: 1);

            var grid = UI.Grid(body, 3, ScreenKit.ContentWidth, 84, 8);
            for (int i = 0; i < slots; i++)
            {
                if (i < C.Skills.Equipped.Count)
                {
                    string id = C.Skills.Equipped[i];
                    var def = SkillDb.Get(id);
                    var st = C.Skills.Get(id);
                    var cell = UI.ButtonCard(grid, () => Detail(id), Theme.AccentBg, Theme.Accent, 10, UI.Pad(8, 8), true, 2, 84, TextAnchor.UpperLeft);
                    UI.Label(cell, def.Name + (st.Level > 0 ? UI.Color(" +" + st.Level, Theme.GoldHex) : ""), 14, Theme.Text, true);
                    UI.Spacer(cell);
                    UI.Sub(cell, def.Role);
                    UI.Sub(cell, "재사용 " + def.Cooldown + "턴");
                }
                else
                {
                    var cell = UI.Card(grid, Theme.Bg, Theme.PlaceholderLine, 10, UI.Pad(8, 8), true, 0, TextAnchor.UpperLeft, "empty");
                    UI.Sub(cell, "빈 슬롯");
                }
            }

            var head2 = UI.Row(body);
            UI.Size(head2, height: 30);
            var t2 = UI.Label(head2, "보유 스킬", 14, Theme.Text, true);
            UI.Size(t2, flexW: 1);

            var list = UI.Column(body, 0);
            foreach (var st in C.Skills.Learned)
            {
                var def = st.Def;
                if (def == null) continue;
                bool equipped = C.Skills.IsEquipped(def.Id);
                bool meets = SkillSystem.MeetsRequirement(C, def);
                var row = UI.Row(list, 10);
                UI.Size(row, minH: 64);
                string sid = def.Id;
                var col = UI.ButtonCard(row, () => Detail(sid), Theme.Bg, Theme.Bg, 0.01f, UI.Pad(0, 0, 8, 8), true, 2, 48, TextAnchor.MiddleLeft);
                UI.Size(col, flexW: 1);
                UI.Label(col, def.Name + " " + UI.Color(Names.Of(def.Tier) + (st.Level > 0 ? " · +" + st.Level : ""), Theme.SubHex) + (_new.Contains(def.Id) ? " " + UI.Color("NEW", Theme.RedHex) : ""), 15, Theme.Text);
                UI.Sub(col, meets ? UI.Color(def.Role, Theme.GoldHex) + " · " + def.Description : "장착 조건 Lv." + def.ReqLevel + " · " + def.ReqRank + " 등급");
                string id = def.Id;
                if (equipped) UI.TextButton(row, "해제", () => Unequip(id), ButtonKind.Outline, 40, 13, 64);
                else if (!meets)
                {
                    var b = UI.TextButton(row, "잠김", null, ButtonKind.Ghost, 40, 13, 64);
                    UI.SetEnabled(b, false);
                    row.gameObject.AddComponent<CanvasGroup>().alpha = 0.55f;
                }
                else UI.TextButton(row, "장착", () => Equip(id), ButtonKind.Ghost, 40, 13, 64);
                ScreenKit.BottomLine(row, Theme.LineSoft);
            }
            ScreenKit.BottomNav(page, 3);
        }

        /// <summary>스킬 상세: 등급·효과·피해 배율·재사용·성공률·장착 조건·수련 단계와 단계당 상승폭, 장착/해제.</summary>
        private void Detail(string id)
        {
            var def = SkillDb.Get(id);
            var st = C.Skills.Get(id);
            if (def == null || st == null) return;
            var body = Overlay.Modal(def.Name);
            var modal = Overlay.Top;
            UI.Label(body, Names.Of(def.Tier) + " 스킬 · " + def.Role + " · 수련 +" + st.Level + " / " + GameBalance.MaxSkillLevel, 13, Theme.Gold, true);
            UI.Label(body, def.Effect, 15, Theme.Text);
            UI.Divider(body);
            Line(body, "재사용", def.Cooldown + "턴");
            Line(body, "성공률", def.Target == SkillTarget.Self ? "100% (자신에게)" : "기본 공격 " + def.SuccessText.Replace("성공률 ", ""));
            int per = Mathf.RoundToInt((float)GameBalance.SkillPowerPerLevel[(int)def.Tier] * 100);
            Line(body, "수련 효과", "단계마다 위력 +" + per + "% (지금 +" + Mathf.RoundToInt((float)(SkillSystem.PowerMultiplier(def, st.Level) - 1) * 100) + "%)");
            Line(body, "장착 조건", "Lv." + def.ReqLevel + " · " + def.ReqRank + " 등급");
            foreach (var s in def.Statuses)
                Line(body, Names.Of(s.Type), s.Turns + "턴 · " + Names.Describe(s.Type, s.Value) + (s.Chance < 1 ? " (" + Mathf.RoundToInt((float)s.Chance * 100) + "%)" : ""));
            bool equipped = C.Skills.IsEquipped(id);
            string reason = equipped ? null : SkillSystem.CannotEquipReason(C, id);
            var b = UI.TextButton(body, equipped ? "해제" : reason ?? "장착", () =>
            {
                Overlay.Close(modal);
                if (equipped) Unequip(id);
                else Equip(id);
            }, equipped ? ButtonKind.Outline : ButtonKind.Primary);
            UI.SetEnabled(b, equipped || reason == null);
        }

        private static void Line(Transform parent, string label, string value)
        {
            var row = UI.Row(parent, 8, null, TextAnchor.UpperLeft);
            var l = UI.Label(row, label, 13, Theme.TextSub, false, TextAnchor.UpperLeft, false, false);
            UI.Size(l, width: 72);
            var v = UI.Label(row, value, 14, Theme.Text, false, TextAnchor.UpperLeft);
            UI.Size(v, flexW: 1);
        }

        private void Equip(string id)
        {
            if (!SkillSystem.Equip(C, id, out string err))
            {
                Toast(err);
                return;
            }
            S.Save();
            Rebuild();
        }

        private void Unequip(string id)
        {
            SkillSystem.Unequip(C, id);
            S.Save();
            Rebuild();
        }
    }
}

using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>스킬: 장착 슬롯, 보유 스킬(재사용 턴·장착 조건), 장착·해제.</summary>
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
            UI.Sub(head, NextSlotText(slots), TextAnchor.MiddleRight);

            var grid = UI.Grid(body, 3, ScreenKit.ContentWidth, 84, 8);
            for (int i = 0; i < slots; i++)
            {
                if (i < C.Skills.Equipped.Count)
                {
                    string id = C.Skills.Equipped[i];
                    var def = SkillDb.Get(id);
                    var st = C.Skills.Get(id);
                    var cell = UI.ButtonCard(grid, () => Unequip(id), Theme.AccentBg, Theme.Accent, 10, UI.Pad(8, 8), true, 2, 84, TextAnchor.UpperLeft);
                    UI.Label(cell, def.Name + (st.Level > 0 ? UI.Color(" +" + st.Level, Theme.GoldHex) : ""), 14, Theme.Text, true);
                    UI.Spacer(cell);
                    UI.Sub(cell, Short(def));
                    UI.Sub(cell, "재사용 " + def.Cooldown + "턴");
                }
                else
                {
                    var cell = UI.Card(grid, Theme.Bg, Theme.PlaceholderLine, 10, UI.Pad(8, 8), true, 0, TextAnchor.UpperLeft, "empty");
                    UI.Sub(cell, "빈 슬롯");
                    UI.Spacer(cell);
                    UI.Sub(cell, "아래에서 선택");
                }
            }

            var head2 = UI.Row(body);
            UI.Size(head2, height: 30);
            var t2 = UI.Label(head2, "보유 스킬", 14, Theme.Text, true);
            UI.Size(t2, flexW: 1);
            UI.Sub(head2, "강화는 마을 수련장에서", TextAnchor.MiddleRight);

            var list = UI.Column(body, 0);
            foreach (var st in C.Skills.Learned)
            {
                var def = st.Def;
                if (def == null) continue;
                bool equipped = C.Skills.IsEquipped(def.Id);
                bool meets = SkillSystem.MeetsRequirement(C, def);
                var row = UI.Row(list, 10);
                UI.Size(row, minH: 64);
                var col = UI.Column(row, 2, UI.Pad(0, 0, 8, 8));
                UI.Size(col, flexW: 1);
                UI.Label(col, def.Name + " " + UI.Color(Names.Of(def.Tier) + (st.Level > 0 ? " · +" + st.Level : ""), Theme.SubHex) + (_new.Contains(def.Id) ? " " + UI.Color("NEW", Theme.RedHex) : ""), 15, Theme.Text);
                UI.Sub(col, meets ? def.Description : "장착 조건 Lv." + def.ReqLevel + " · " + def.ReqRank + " 등급");
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

        private static string Short(SkillDef def)
        {
            if (def.Statuses.Length > 0) return Names.Of(def.Statuses[0].Type) + (def.Target == SkillTarget.Self ? " " + def.Statuses[0].Turns + "턴" : "");
            if (def.HealRatio > 0) return "회복";
            switch (def.Target)
            {
                case SkillTarget.AllEnemies: return "전체";
                case SkillTarget.MultiEnemy: return def.TargetCount + "명";
                case SkillTarget.ChainEnemies: return "연쇄";
                case SkillTarget.Self: return "자신";
                default: return "단일";
            }
        }

        private string NextSlotText(int slots)
        {
            for (var r = C.Rank + 1; r <= Rank.SS; r++)
                if (RankSystem.SkillSlots(r) > slots) return r + " 등급에서 " + RankSystem.SkillSlots(r) + "칸";
            return "최대 슬롯";
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

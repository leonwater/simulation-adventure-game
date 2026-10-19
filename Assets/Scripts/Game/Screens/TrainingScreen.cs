using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>수련장: 골드를 내고 보유 스킬을 강화 (+5까지, 단계당 위력 +10%).</summary>
    public class TrainingScreen : ScreenBase
    {
        private string _line = "기술은 반복으로 다듬어지는 법. 어떤 기술을 갈고닦겠나?";

        public override bool OnBack()
        {
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "수련장", "마을", () => Go(new TownScreen()), C);
            ScreenKit.NpcIllustration(page, "수련 교관", _line, 260);
            var body = UI.Scroll(page, out _, 0, UI.Pad(16, 16, 16, 16), "training");
            Anchors.Set("train.list", body);
            UI.Sub(body, "강화 단계마다 스킬 위력 +" + Mathf.RoundToInt((float)GameBalance.SkillPowerPerLevel * 100) + "% · 최대 +" + GameBalance.MaxSkillLevel);
            UI.Spacer(body, 0, 6);
            foreach (var st in C.Skills.Learned)
            {
                var def = st.Def;
                if (def == null) continue;
                var row = UI.Row(body, 10);
                UI.Size(row, minH: 64);
                var col = UI.Column(row, 2);
                UI.Size(col, flexW: 1);
                UI.Label(col, def.Name + " " + UI.Color(Names.Of(def.Tier) + " · +" + st.Level, Theme.SubHex), 15, Theme.Text);
                UI.Sub(col, def.Description + (C.Skills.IsEquipped(def.Id) ? " · 장착 중" : ""));
                int cost = SkillSystem.TrainingCost(st);
                var state = st;
                var b = UI.TextButton(row, cost == 0 ? "최대" : "수련 · " + cost.ToString("#,0") + "G", () => Train(state), ButtonKind.Outline, 40, 13);
                UI.SetEnabled(b, cost > 0 && C.Gold >= cost);
                ScreenKit.BottomLine(row, Theme.LineSoft);
            }
            Tutorial.OnFacility("training");
        }

        private void Train(SkillState st)
        {
            if (!SkillSystem.Train(C, st.SkillId, out string err))
            {
                Toast(err);
                return;
            }
            _line = st.Def.Name + " 움직임이 한층 날카로워졌군. (+" + st.Level + ")";
            S.Save();
            Rebuild();
        }
    }
}

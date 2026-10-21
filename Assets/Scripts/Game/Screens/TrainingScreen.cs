using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>수련장: 골드를 내고 보유 스킬을 강화 (+5까지, 단계당 위력 하급 +8% ~ 최상급 +15%).</summary>
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
            foreach (var st in C.Skills.Learned)
            {
                var def = st.Def;
                if (def == null) continue;
                var row = UI.Row(body, 10, UI.Pad(0, 0, 8, 8));
                UI.Size(row, minH: 64);
                var col = UI.Column(row, 2);
                UI.Size(col, flexW: 1);
                int per = Mathf.RoundToInt((float)GameBalance.SkillPowerPerLevel[(int)def.Tier] * 100);
                UI.Label(col, def.Name + " " + UI.Color(Names.Of(def.Tier) + (SkillSystem.CanTrain(def) ? " · +" + st.Level + " (단계당 +" + per + "%)" : " · 효과만 거는 스킬"), Theme.SubHex), 15, Theme.Text);
                UI.Sub(col, def.Description + (C.Skills.IsEquipped(def.Id) ? " · 장착 중" : ""));
                int cost = SkillSystem.TrainingCost(st);
                var state = st;
                // 피해·회복이 없는 스킬은 수련해도 바뀌는 것이 없어 막는다 (v2.4)
                bool trainable = SkillSystem.CanTrain(def);
                var b = UI.TextButton(row, !trainable ? "수련 불가" : cost == 0 ? "최대" : "수련 · " + cost.ToString("#,0") + "G", () => Train(state), ButtonKind.Outline, 40, 13, 104);
                UI.SetEnabled(b, trainable && cost > 0 && C.Gold >= cost);
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

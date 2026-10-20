using System;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>캐릭터: 경험치, 배지·승급 진행, 능력치 5개(+ 버튼), 자동 배분·확정, 상세 능력치.</summary>
    public class CharacterScreen : ScreenBase
    {
        private AllocationDraft _draft;

        public override bool OnBack()
        {
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            if (_draft == null) _draft = new AllocationDraft(C);
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "캐릭터", "마을", () => Go(new TownScreen()), C);
            var body = UI.Scroll(page, out _, 12, UI.Pad(16, 16), "character");

            var head = UI.Row(body, 8, null, TextAnchor.LowerLeft);
            var nameCol = UI.Column(head, 2);
            UI.Size(nameCol, flexW: 1);
            UI.Label(nameCol, C.Name, 24, Theme.Text, true); // 이름은 어떤 글자든 나오도록 전체 글꼴(고딕)로
            ScreenKit.JobLine(nameCol, C.Job, C.JobData.Name + " · Lv." + C.Level + " / " + GameBalance.MaxLevel, 13, Theme.TextSub);
            int pct = Mathf.FloorToInt((float)Leveling.ExpProgress(C) * 100);
            UI.Sub(head, C.Level >= GameBalance.MaxLevel ? "최대 레벨" : "경험치 " + pct + "%", TextAnchor.LowerRight);
            UI.ProgressBar(body, (float)Leveling.ExpProgress(C), Theme.Blue, 8);
            if (C.Level < GameBalance.MaxLevel)
                UI.Sub(body, C.Exp.ToString("#,0") + " / " + GameBalance.ExpToNext(C.Level).ToString("#,0"), TextAnchor.MiddleRight);

            BadgePanel(body);
            StatsPanel(body);

            var buttons = UI.Row(body, 8);
            var auto = UI.TextButton(buttons, "자동 배분", () =>
            {
                _draft.Auto();
                Rebuild();
            });
            UI.Size(auto, width: 0, flexW: 1);
            UI.SetEnabled(auto, C.UnspentPoints > 0);
            var ok = UI.TextButton(buttons, "확정", Commit, ButtonKind.Primary);
            UI.Size(ok, width: 0, flexW: 1);
            UI.SetEnabled(ok, _draft.HasChanges);
            UI.TextButton(body, "상세 능력치 보기", Details, ButtonKind.Ghost);

            ScreenKit.BottomNav(page, 1);
        }

        private void BadgePanel(Transform parent)
        {
            var st = RankSystem.GetStatus(C);
            var panel = UI.Card(parent, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 12), true, 8);
            var row = UI.Row(panel, 8);
            UI.Icon(row, UI.RankIcon(C.Rank), 32);
            var t = UI.Label(row, C.Rank + " 등급 배지", 15, Theme.Text, true);
            UI.Size(t, flexW: 1);
            UI.Label(row, "기본 능력치 +" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(C.Rank) * 100) + "%", 13, Theme.Gold, false, TextAnchor.MiddleRight, false, false);
            if (st.IsMaxRank)
            {
                UI.Sub(panel, "최고 등급입니다");
                return;
            }
            UI.Sub(panel, st.Next + " 등급 승급 조건 · 모두 채우면 자동 승급");
            var grid = UI.Row(panel, 8);
            grid.GetComponent<UnityEngine.UI.HorizontalLayoutGroup>().childForceExpandWidth = true;
            Cond(grid, "돌파 층", st.FloorCurrent, st.FloorRequired);
            Cond(grid, "레벨", st.LevelCurrent, st.LevelRequired);
            Cond(grid, "퀘스트", st.QuestsCurrent, st.QuestsRequired);
        }

        private static void Cond(Transform parent, string label, int cur, int req)
        {
            bool met = cur >= req;
            var l = UI.Label(parent, label + " " + UI.Color(Math.Min(cur, req) + "/" + req, met ? Theme.GreenHex : "#ECE7DD"), 13, Theme.Text);
            UI.Size(l, width: 0, flexW: 1); // 세 조건을 같은 폭으로
        }

        private void StatsPanel(Transform parent)
        {
            var panel = UI.Card(parent, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 14, 6, 6), true, 0);
            var head = UI.Row(panel);
            UI.Size(head, height: 40);
            var t = UI.Label(head, "능력치", 14, Theme.Text, true);
            UI.Size(t, flexW: 1);
            UI.Label(head, "남은 포인트 " + UI.Color(_draft.Remaining.ToString(), Theme.GoldHex), 13, Theme.Text, false, TextAnchor.MiddleRight, false, false);

            var stats = C.JobData.AllocatableStats;
            for (int i = 0; i < stats.Length; i++)
            {
                var stat = stats[i];
                ScreenKit.StatRow(panel, C, stat, _draft, () =>
                {
                    _draft.Remove(stat);
                    Rebuild();
                }, () =>
                {
                    _draft.Add(stat);
                    Rebuild();
                }, i < stats.Length - 1);
            }
        }

        private void Commit()
        {
            int maxBefore = CharacterStats.MaxHp(C);
            _draft.Commit();
            // 체력이 오르면 늘어난 만큼 현재 HP도 채운다.
            C.CurrentHp = Math.Min(CharacterStats.MaxHp(C), C.CurrentHp + Math.Max(0, CharacterStats.MaxHp(C) - maxBefore));
            S.Save();
            Toast("능력치를 배분했습니다");
            Rebuild();
        }

        private void Details()
        {
            var body = Overlay.Modal("상세 능력치", true);
            Line(body, "최대 HP", CharacterStats.MaxHp(C).ToString());
            Line(body, "공격력", CharacterStats.Attack(C) + UI.Color(" (" + Names.Of(C.JobData.AttackStat) + " × 2 + 무기 " + CharacterStats.WeaponAttack(C) + ")", Theme.SubHex));
            Line(body, "방어력", CharacterStats.Defense(C).ToString());
            Line(body, "회피", CharacterStats.Percent(CharacterStats.Evasion(C)));
            Line(body, "받는 피해 감소", CharacterStats.Percent(CharacterStats.DamageReduction(C)));
            Line(body, "디버프 저항", CharacterStats.Percent(CharacterStats.Resist(C)));
            if (C.Job == Job.Rogue) Line(body, "치명타", "도적 스킬 전용 · 피해 ×" + GameBalance.CritMultiplier);
            Line(body, "드롭률", "+" + CharacterStats.Percent(CharacterStats.DropBonus(C) - 1));
            Line(body, "이벤트 판정 (행운)", "+" + CharacterStats.Percent(CharacterStats.EventLuckBonus(C)));
            UI.Divider(body);
            UI.Label(body, "능력치별 효과", 14, Theme.Text, true);
            foreach (Stat s in Enum.GetValues(typeof(Stat)))
            {
                bool mine = System.Array.IndexOf(C.JobData.AllocatableStats, s) >= 0;
                int eq = CharacterStats.EquipmentBonus(C, s);
                var row = UI.Row(body, 10, UI.Pad(0, 0, 4, 4));
                UI.Size(row, minH: 48);
                UI.Icon(row, UI.StatIcon(s), 28);
                var col = UI.Column(row, 2);
                UI.Size(col, flexW: 1);
                UI.Label(col, Names.Of(s) + " " + UI.Color(CharacterStats.Total(C, s) + (eq > 0 ? " (장비 +" + eq + ")" : ""), Theme.GoldHex)
                              + UI.Color(" · 최대 " + GameBalance.StatCap, Theme.SubHex), 14, Theme.Text, true);
                UI.Label(col, StatEffect(s) + (mine ? "" : " · 이 직업은 배분 불가"), 12, Theme.TextSub);
                if (!mine) row.gameObject.AddComponent<CanvasGroup>().alpha = 0.55f;
            }
            UI.Sub(body, "배지 효과(+" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(C.Rank) * 100) + "%)는 장비·버프를 제외한 캐릭터 자체 능력치에만 곱합니다.");
        }

        /// <summary>능력치가 주는 효과 (상세 능력치 창의 한 줄 설명).</summary>
        private static string StatEffect(Stat s)
        {
            switch (s)
            {
                case Stat.Vitality: return "최대 HP 증가 (직업마다 1점당 HP가 다름)";
                case Stat.Spirit: return "독·기절 같은 디버프에 걸리지 않을 확률";
                case Stat.Luck: return "아이템 드롭률과 이벤트 판정 성공률";
                case Stat.Strength: return "전사의 공격력 (1점당 +2)";
                case Stat.Agility: return "궁수·도적의 공격력, 적 공격 회피";
                case Stat.Intelligence: return "마법사의 공격력 (1점당 +2)";
                case Stat.Toughness: return "받는 피해 감소 (최대 40%)";
                case Stat.Precision: return "공격·스킬 성공률 증가";
                case Stat.Finesse: return "도적의 회피 증가 (최대 40%)";
                case Stat.SpellPower: return "스킬 피해 증가 (1점당 +0.5%)";
                default: return "";
            }
        }

        private static void Line(Transform parent, string label, string value)
        {
            var row = UI.Row(parent, 8);
            UI.Size(row, height: 30);
            var l = UI.Label(row, label, 14, Theme.Text);
            UI.Size(l, flexW: 1);
            UI.Label(row, value, 14, Theme.Text, false, TextAnchor.MiddleRight, false, false);
        }
    }
}

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
            var body = UI.Scroll(page, out _, 12, UI.Pad(16, 16), "character");

            var head = UI.Row(body, 8, null, TextAnchor.LowerLeft);
            var nameCol = UI.Column(head, 2);
            UI.Size(nameCol, flexW: 1);
            UI.Label(nameCol, C.Name, 24, Theme.Text, true); // 이름은 어떤 글자든 나오도록 전체 글꼴(고딕)로
            UI.Sub(nameCol, C.JobData.Name + " · Lv." + C.Level + " / " + GameBalance.MaxLevel);
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
            UI.Size(auto, flexW: 1);
            UI.SetEnabled(auto, C.UnspentPoints > 0);
            var ok = UI.TextButton(buttons, "확정", Commit, ButtonKind.Primary);
            UI.Size(ok, flexW: 1);
            UI.SetEnabled(ok, _draft.HasChanges);
            UI.TextButton(body, "상세 능력치 보기", Details, ButtonKind.Ghost);

            ScreenKit.BottomNav(page, 1);
        }

        private void BadgePanel(Transform parent)
        {
            var st = RankSystem.GetStatus(C);
            var panel = UI.Card(parent, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 12), true, 8);
            var row = UI.Row(panel);
            var t = UI.Label(row, C.Rank + " 등급 배지", 15, Theme.Text, true);
            UI.Size(t, flexW: 1);
            UI.Label(row, "기본 능력치 +" + Mathf.RoundToInt((float)RankSystem.BadgeBonus(C.Rank) * 100) + "%", 13, Theme.Gold, false, TextAnchor.MiddleRight, false, false);
            if (st.IsMaxRank)
            {
                UI.Sub(panel, "최고 등급입니다");
                return;
            }
            UI.Sub(panel, st.Next + " 등급 승급 조건");
            var grid = UI.Row(panel, 8);
            grid.GetComponent<UnityEngine.UI.HorizontalLayoutGroup>().childForceExpandWidth = true;
            Cond(grid, "층", st.FloorCurrent, st.FloorRequired);
            Cond(grid, "레벨", st.LevelCurrent, st.LevelRequired);
            Cond(grid, "퀘스트", st.QuestsCurrent, st.QuestsRequired);
        }

        private static void Cond(Transform parent, string label, int cur, int req)
        {
            bool met = cur >= req;
            var l = UI.Label(parent, label + " " + UI.Color(Math.Min(cur, req) + "/" + req, met ? Theme.GreenHex : "#ECE7DD"), 13, Theme.Text);
            UI.Size(l, flexW: 1);
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
                var row = UI.Row(panel, 10);
                UI.Size(row, height: 52);
                var name = UI.Label(row, Names.Of(stat) + " " + UI.Color(CharacterStats.EffectLabel(C, stat), Theme.SubHex), 14, Theme.Text);
                UI.Size(name, flexW: 1);
                int pending = _draft.Pending(stat);
                if (pending > 0)
                {
                    UI.TextButton(row, "−", () =>
                    {
                        _draft.Remove(stat);
                        Rebuild();
                    }, ButtonKind.Ghost, 44, 18, 44);
                }
                string value = CharacterStats.Total(C, stat) + (pending > 0 ? UI.Color(" +" + pending, Theme.GoldHex) : "");
                UI.Label(row, value, 16, Theme.Text, false, TextAnchor.MiddleRight, false, false);
                var plus = UI.TextButton(row, "+", () =>
                {
                    _draft.Add(stat);
                    Rebuild();
                }, ButtonKind.Outline, 44, 20, 44);
                UI.SetEnabled(plus, _draft.Remaining > 0);
                if (i < stats.Length - 1) ScreenKit.BottomLine(row, Theme.LineSoft);
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
            Line(body, "치명타", "스킬 전용 · 피해 ×1.8");
            Line(body, "드롭률", "+" + CharacterStats.Percent(CharacterStats.DropBonus(C) - 1));
            Line(body, "이벤트 판정 (행운)", "+" + CharacterStats.Percent(CharacterStats.EventLuckBonus(C)));
            UI.Divider(body);
            foreach (Stat s in Enum.GetValues(typeof(Stat)))
            {
                int own = CharacterStats.OwnStat(C, s), eq = CharacterStats.EquipmentBonus(C, s);
                string v = CharacterStats.Total(C, s) + UI.Color(" (기본 " + C.BaseStats[s] + " · 배지 " + own + (eq > 0 ? " · 장비 +" + eq : "") + ")", Theme.SubHex);
                Line(body, Names.Of(s), v);
            }
            UI.Sub(body, "배지 효과는 장비·버프를 제외한 캐릭터 자체 능력치에만 곱합니다.");
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

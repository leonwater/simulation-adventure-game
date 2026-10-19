using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>
    /// 캐릭터 정보 창 (던전 하단 가운데 버튼 · 전투에서 내 도형): 기본 정보, 전투 능력치,
    /// 지금 걸린 상태 이상(1턴에 얼마인지), 탐험 효과, 진행 중인 퀘스트, 상태 이상 안내.
    /// </summary>
    public static class CharacterInfo
    {
        private static readonly StatusType[] Debuffs =
        {
            StatusType.Poison, StatusType.Bleed, StatusType.Burn, StatusType.Weaken, StatusType.Vulnerable,
            StatusType.Stun, StatusType.Silence, StatusType.Blind, StatusType.Fear,
        };

        private static readonly StatusType[] Buffs =
            { StatusType.Empower, StatusType.Fortify, StatusType.Regen, StatusType.Focus, StatusType.Swift };

        public static void Show(Overlay overlay, GameSession session, Battle battle = null)
        {
            var c = session.C;
            var run = session.Run;
            var body = overlay.Modal("캐릭터 정보", true);
            var me = battle?.Player;
            int maxHp = me?.MaxHp ?? CharacterStats.MaxHp(c);
            int hp = me?.Hp ?? c.CurrentHp;

            // 기본 정보
            var head = UI.Row(body, 8, null, TextAnchor.MiddleLeft);
            UI.Icon(head, UI.RankIcon(c.Rank), 26);
            var name = UI.Label(head, c.Name + " · " + c.JobData.Name + " Lv." + c.Level, 16, Theme.Text, true);
            UI.Size(name, flexW: 1);
            UI.Label(body, "HP " + hp + "/" + maxHp, 13, Theme.Text);
            UI.ProgressBar(body, (float)hp / Mathf.Max(1, maxHp), Theme.Red, 8);
            UI.Label(body, "경험치 " + Mathf.FloorToInt((float)Leveling.ExpProgress(c) * 100) + "% · 골드 " + Names.Gold(c.Gold)
                           + (c.UnspentPoints > 0 ? " · " + UI.Color("남은 포인트 " + c.UnspentPoints, Theme.GoldHex) : ""), 12, Theme.TextSub);

            // 전투 능력치 (2열)
            Section(body, "전투 능력치");
            var grid = UI.Column(body, 4);
            Pair(grid, "공격력", (me?.Attack ?? CharacterStats.Attack(c)).ToString(), "방어력", CharacterStats.Defense(c).ToString());
            Pair(grid, "회피", CharacterStats.Percent(CharacterStats.Evasion(c)), "받는 피해 감소", CharacterStats.Percent(CharacterStats.DamageReduction(c)));
            Pair(grid, "상태 이상 저항", CharacterStats.Percent(CharacterStats.Resist(c)), "스킬 피해", "+" + CharacterStats.Percent(CharacterStats.SkillDamageBonus(c)));

            // 지금 걸린 상태 이상
            Section(body, "상태 이상");
            var active = me?.Statuses.Visible();
            if (active == null || active.Count == 0)
                UI.Sub(body, battle == null ? "전투 밖에서는 상태 이상이 남지 않습니다. 전투가 끝나면 모두 풀립니다." : "걸린 상태 이상이 없습니다.");
            else
                foreach (var s in active)
                {
                    bool debuff = StatusContainer.IsDebuff(s.Type);
                    var card = UI.Card(body, debuff ? Theme.RedBg : Theme.BlueBg, debuff ? Theme.RedBorder : Theme.BlueBorder, 10, UI.Pad(12, 8), true, 2);
                    string turns = s.Turns >= 99 ? "전투 내내" : s.Turns + "턴 남음";
                    UI.Label(card, Names.Of(s.Type) + " · " + turns, 14, debuff ? Theme.RedLight : Theme.BlueLight, true);
                    UI.Label(card, Names.DescribeActive(s, maxHp), 13, Theme.TextBody);
                }

            // 탐험 효과 (이벤트로 얻은 버프·디버프)
            if (run != null)
            {
                Section(body, "탐험 효과");
                if (run.Effects.Count == 0) UI.Sub(body, "없음 · 특수 이벤트에서 얻으면 마을로 돌아갈 때까지 남습니다.");
                foreach (var e in run.Effects)
                {
                    bool bad = e.Type == ExploreEffectType.Fear || e.Type == ExploreEffectType.Curse || e.Type == ExploreEffectType.Drum;
                    var card = UI.Card(body, bad ? Theme.RedBg : Theme.BlueBg, bad ? Theme.RedBorder : Theme.BlueBorder, 10, UI.Pad(12, 8), true, 2);
                    UI.Label(card, ExploreEffects.Name(e.Type) + " · " + ExploreEffects.Remaining(e), 14, bad ? Theme.RedLight : Theme.BlueLight, true);
                    UI.Label(card, ExploreEffects.Describe(e.Type), 13, Theme.TextBody);
                }
            }

            // 진행 중인 퀘스트
            var quests = session.Data.Guild.Active;
            if (quests.Count > 0)
            {
                Section(body, "진행 중인 퀘스트");
                foreach (var q in quests)
                    UI.Label(body, q.Title + " · " + q.TargetFloor + "층 · " + GuildSystem.ProgressText(q, c)
                                   + (GuildSystem.IsComplete(q, c) ? UI.Color(" · 보고 가능", Theme.GoldHex) : ""), 13, Theme.TextBody);
            }

            // 상태 이상 안내
            Section(body, "상태 이상 안내");
            foreach (var t in Debuffs) Glossary(body, t, true);
            foreach (var t in Buffs) Glossary(body, t, false);
        }

        private static void Section(Transform parent, string title)
        {
            UI.Divider(parent);
            UI.Label(parent, title, 14, Theme.Gold, true);
        }

        private static void Pair(Transform parent, string a, string av, string b, string bv)
        {
            var row = UI.Row(parent, 12);
            Cell(row, a, av);
            Cell(row, b, bv);
        }

        private static void Cell(Transform row, string label, string value)
        {
            var cell = UI.Row(row, 6);
            UI.Size(cell, width: 0, flexW: 1, height: 22); // 두 칸을 같은 폭으로
            var l = UI.Label(cell, label, 13, Theme.TextSub);
            UI.Size(l, flexW: 1);
            UI.Label(cell, value, 13, Theme.Text, true, TextAnchor.MiddleRight, false, false);
        }

        private static void Glossary(Transform parent, StatusType t, bool debuff)
        {
            var row = UI.Row(parent, 8, null, TextAnchor.UpperLeft);
            var tag = UI.Label(row, Names.Of(t), 13, debuff ? Theme.RedLight : Theme.BlueLight, true);
            UI.Size(tag, width: 52);
            var text = UI.Label(row, Names.Explain(t), 12, Theme.TextBody);
            UI.Size(text, flexW: 1);
        }
    }
}

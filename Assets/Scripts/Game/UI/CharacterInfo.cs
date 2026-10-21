using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>
    /// 캐릭터 정보 창 (던전 하단 가운데 버튼 · 전투에서 내 도형): 기본 정보, 전투 능력치,
    /// 지금 걸린 상태 이상(1턴에 얼마인지), 탐험 효과, 상태 이상 안내. 퀘스트는 던전 하단 '퀘스트' 버튼(ShowQuests).
    /// </summary>
    public static class CharacterInfo
    {
        private static readonly StatusType[] Debuffs =
        {
            StatusType.Poison, StatusType.Bleed, StatusType.Burn, StatusType.Weaken, StatusType.Vulnerable,
            StatusType.Stun, StatusType.Silence, StatusType.Blind, StatusType.Fear,
        };

        private static readonly StatusType[] Buffs =
            { StatusType.Empower, StatusType.Fortify, StatusType.Regen, StatusType.Focus, StatusType.Swift, StatusType.Keen, StatusType.Cruel };

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
            UI.Icon(head, UI.JobIcon(c.Job), 22);
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
            else StatusCards(body, active, maxHp);

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

            // 상태 이상 안내
            Section(body, "상태 이상 안내");
            foreach (var t in Debuffs) Glossary(body, t, true);
            foreach (var t in Buffs) Glossary(body, t, false);
        }

        /// <summary>진행 중인 퀘스트 (던전 하단 '퀘스트' 버튼, v2.4: 정보 창에서 옮김).</summary>
        public static void ShowQuests(Overlay overlay, GameSession session)
        {
            var c = session.C;
            var body = overlay.Modal("진행 중인 퀘스트");
            var quests = session.Data.Guild.Active;
            if (quests.Count == 0)
            {
                UI.Sub(body, "받은 퀘스트가 없습니다. 마을의 길드에서 받을 수 있어요.");
                return;
            }
            foreach (var q in quests)
            {
                bool done = GuildSystem.IsComplete(q, c);
                var card = UI.Card(body, Theme.BlueBg, done ? Theme.Accent : Theme.BlueBorder, 10, UI.Pad(12, 8), true, 2);
                UI.Label(card, q.Title, 14, Theme.Text, true);
                UI.Label(card, "목표 " + q.TargetFloor + "층 · " + GuildSystem.ProgressText(q, c) + (done ? UI.Color(" · 보고 가능", Theme.GoldHex) : ""), 13, done ? Theme.Gold : Theme.TextBody);
                UI.Label(card, "보상 " + UI.Color(q.RewardGold.ToString("#,0") + "G", Theme.GoldHex) + " · 경험치 " + q.RewardExp.ToString("#,0"), 12, Theme.TextSub);
            }
        }

        /// <summary>
        /// 적 상세 (전투에서 대상을 한 번 더 누르거나 길게 누름): HP·보호막·방어막, 공격력·방어력, 다음 턴 예고, 상태 이상(1턴 피해).
        /// 대상이 아니면 "대상으로 정하기" 버튼.
        /// </summary>
        public static void ShowEnemy(Overlay overlay, Combatant e, bool isTarget, System.Action makeTarget)
        {
            string role = e.Role == 2 ? "보스" : e.Role == 1 ? "정예" : "일반";
            var body = overlay.Modal(e.Name);
            var modal = overlay.Top;
            UI.Label(body, role + " 몬스터", 13, e.Role == 2 ? Theme.Hex("E0873A") : e.Role == 1 ? Theme.Gold : Theme.TextSub, true);
            string hp = "HP " + e.Hp + "/" + e.MaxHp;
            if (e.Kit != null && e.Kit.Shield > 0) hp += " · " + UI.Color("보호막 " + e.Kit.Shield, "#8FC7FF");
            if (e.Kit != null && e.Kit.Barrier > 0) hp += " · " + UI.Color("방어막 " + e.Kit.Barrier + "회", "#C9B8FF");
            UI.Label(body, hp, 14, Theme.Text);
            UI.ProgressBar(body, (float)e.Hp / Mathf.Max(1, e.MaxHp), Theme.Red, 8);
            var grid = UI.Column(body, 4);
            Pair(grid, "공격력", e.Attack.ToString(), "방어력", e.Defense.ToString());
            if (e.Kit != null && !string.IsNullOrEmpty(e.Kit.Intent))
                UI.Label(body, "다음 턴 " + UI.Color(e.Kit.Intent, "#FF9A4A"), 13, Theme.Text, true);

            Section(body, "상태 이상");
            var list = e.Statuses.Visible();
            if (list.Count == 0) UI.Sub(body, "걸린 상태 이상이 없습니다.");
            else StatusCards(body, list, e.MaxHp);
            if (!isTarget)
                UI.TextButton(body, "대상으로 정하기", () =>
                {
                    overlay.Close(modal);
                    makeTarget();
                }, ButtonKind.Primary);
        }

        /// <summary>걸린 상태 이상 카드: 이름 · 남은 턴 / 1턴에 얼마인지.</summary>
        private static void StatusCards(Transform body, System.Collections.Generic.List<StatusInstance> list, int maxHp)
        {
            foreach (var s in list)
            {
                bool debuff = StatusContainer.IsDebuff(s.Type);
                var card = UI.Card(body, debuff ? Theme.RedBg : Theme.BlueBg, debuff ? Theme.RedBorder : Theme.BlueBorder, 10, UI.Pad(12, 8), true, 2);
                string turns = s.Turns >= 99 ? "전투 내내" : s.Turns + "턴 남음";
                var head = UI.Row(card, 6);
                UI.Icon(head, UI.StatusIcon(s.Type), 20);
                UI.Label(head, Names.Of(s.Type) + " · " + turns, 14, debuff ? Theme.RedLight : Theme.BlueLight, true);
                UI.Label(card, Names.DescribeActive(s, maxHp), 13, Theme.TextBody);
            }
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

        /// <summary>
        /// 상태 이상 안내 한 줄. 아이콘과 이름은 한 묶음으로 가운데를 맞추고(v1.9: 아이콘이 글자보다 내려가 보이던 문제),
        /// 설명은 두 줄이 되어도 첫 줄이 이름과 같은 높이에 오게 위에 붙인다.
        /// </summary>
        private static void Glossary(Transform parent, StatusType t, bool debuff)
        {
            var row = UI.Row(parent, 8, null, TextAnchor.UpperLeft);
            var head = UI.IconLabel(row, UI.StatusIcon(t), 18, Names.Of(t), 13, debuff ? Theme.RedLight : Theme.BlueLight, true);
            UI.Size(head, width: 72);
            var text = UI.Label(row, Names.Explain(t), 12, Theme.TextBody);
            text.alignment = TextAnchor.UpperLeft;
            UI.Size(text, flexW: 1);
        }
    }
}

using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>특수 이벤트: 이벤트 그림, 제목, 상황 텍스트, 선택지(조건·성공 확률) → 결과.</summary>
    public class EventScreen : ScreenBase
    {
        private EventDef _event;
        private EventResult _result;
        private int _floor;

        public override bool OnBack() => true; // 이벤트는 선택으로만 끝난다

        public override void Build(RectTransform root)
        {
            if (_event == null) _event = S.PendingEvent;
            if (_event == null)
            {
                App.GoToCurrent();
                return;
            }
            if (_floor == 0) _floor = S.Run?.Floor ?? 1; // 귀환 결과 뒤에도 층 표시 유지
            int floor = _floor;
            var page = ScreenKit.Page(root);
            // 던전·전투와 같은 머리줄 (HP 숫자 + 막대)
            if (C != null) ScreenKit.DungeonHeader(page, floor + "층 · 특수 이벤트", null, C, null);

            var body = UI.Scroll(page, out _, 14, UI.Pad(0, 0, 0, 16));
            UI.Illustration(body, _event.Illustration, 300);
            var inner = UI.Column(body, 14, UI.Pad(16, 16, 2, 0));
            UI.Label(inner, _event.Title, 24, Theme.Text, false, TextAnchor.MiddleLeft, true);
            var run = S.Run;
            var bodyText = UI.Label(inner, EventRules.Body(_event, run, C), 15, Theme.TextBody);
            bodyText.lineSpacing = 1.35f;
            Typewriter.Attach(bodyText);
            bodyText.gameObject.AddComponent<TypewriterSkip>();
            bodyText.raycastTarget = true;

            if (_result != null)
            {
                ResultBox(inner);
                // 보물 더미·피의 우물: 같은 이벤트에서 다시 고른다
                if (!_result.Continues || S.PendingEvent != _event) return;
            }
            UI.Spacer(inner, 1, 8);
            foreach (int i in EventRules.VisibleChoices(_event, C, run))
            {
                var ch = _event.Choices[i];
                int idx = i;
                string unavailable = EventRules.UnavailableReason(_event, i, run, C);
                string special = EventRules.SpecialHint(_event, i, run, C);
                string hint = unavailable ?? special ?? EventRules.ChoiceHint(ch, C, floor);
                // 판정이 없는 선택지(특별한 이벤트 포함)는 확률 대신 ›
                bool always = _event.Special != EventSpecial.None || EventRules.CheckStat(ch, C) == null && ch.FixedChance >= 1;
                string right = always ? "›" : ScreenKit.Percent(EventRules.SuccessChance(ch, C, floor));
                string label = EventRules.Label(_event, i, run, C);
                // 행동하는 선택지는 보라색, 아무 일 없이 지나가는 선택지는 기본 색
                bool pass = always && _event.Special == EventSpecial.None && IsPass(ch);
                var b = pass
                    ? ScreenKit.ChoiceButton(inner, label, string.IsNullOrEmpty(hint) ? null : hint, right, false, null, unavailable == null, 60)
                    : ScreenKit.ActionButton(inner, label, string.IsNullOrEmpty(hint) ? null : hint, right, !always, null, unavailable == null, 60);
                var choice = ch;
                LongPress.Add(b, () =>
                {
                    var detail = Overlay.Modal(label);
                    string text = special ?? EventRules.Breakdown(choice, C, floor);
                    var t = UI.Label(detail, text + (unavailable != null ? "\n\n" + unavailable : ""), 14, Theme.TextBody);
                    t.lineSpacing = 1.3f;
                }, () =>
                {
                    if (unavailable == null) Choose(idx);
                });
                if (unavailable != null)
                {
                    var group = b.GetComponent<CanvasGroup>();
                    group.blocksRaycasts = true;
                    group.interactable = true;
                    b.GetComponent<UnityEngine.UI.Button>().interactable = false;
                }
            }
        }

        /// <summary>그냥 지나가는 선택지: 판정·보상·효과가 하나도 없다.</summary>
        private static bool IsPass(EventChoice ch)
        {
            var o = ch.Success;
            return ch.Failure == null && o.HpRatio == 0 && o.Reward == EventReward.None && o.GoldMult == 0 && o.ExpMult == 0
                   && !o.ReturnToTown && o.Battle == EventBattle.None && o.Effects.Length == 0 && o.Reveal == RevealKind.None
                   && !o.SpawnTreasure && !o.LinkBoss && !o.FindReturn && string.IsNullOrEmpty(o.Chain) && !o.BecomeMerchant
                   && string.IsNullOrEmpty(ch.RequiresItem) && ch.GoldPerFloor == 0 && ch.RequiresGoldMult == 0;
        }

        private void ResultBox(Transform parent)
        {
            var good = _result.Success;
            var card = UI.Card(parent, good ? Theme.AccentBg : Theme.RedBg, good ? Theme.Accent : Theme.RedBorder, 12, UI.Pad(14, 12), true, 6);
            var resultText = UI.Label(card, _result.Text, 15, Theme.Text);
            Typewriter.Attach(resultText);
            card.gameObject.AddComponent<TypewriterSkip>();
            card.GetComponent<UnityEngine.UI.Image>().raycastTarget = true;
            if (_result.HpChange != 0)
                UI.Label(card, "HP " + (_result.HpChange > 0 ? "+" : "") + _result.HpChange, 14, _result.HpChange > 0 ? Theme.Green : Theme.RedLight);
            if (!_result.Loot.IsEmpty || _result.Loot.Dropped.Count > 0) UI.Label(card, _result.Loot.Describe(), 14, Theme.Gold);
            if (_result.Loot.LevelsGained > 0 && C != null) UI.Label(card, "레벨 업! Lv." + C.Level, 14, Theme.Gold, true);
            if (_result.Continues && S.PendingEvent == _event) return; // 선택지가 이어서 나온다
            UI.Spacer(parent, 1, 8);
            bool died = S.LastDeath != null && !S.InDungeon;
            string label = died ? "결과 보기" : _result.StartBattle ? "전투 시작" : _result.ReturnToTown ? "마을로" : "계속";
            UI.TextButton(parent, label, Continue, ButtonKind.Primary, 52, 16);
        }

        private void Choose(int index)
        {
            _result = S.ChooseEvent(index);
            UI.ForgetScroll("event");
            Rebuild();
        }

        private void Continue()
        {
            if (S.LastDeath != null && !S.InDungeon)
            {
                // 미믹 기습에 쓰러진 경우
                Go(new ResultScreen(S.LastDeath.HardcoreReset ? ResultKind.Hardcore : ResultKind.Death));
                return;
            }
            if (_result.ReturnToTown)
            {
                Go(new ResultScreen(ResultKind.Return));
                return;
            }
            if (S.Battle == null && S.InDungeon && _result.Loot.LevelsGained > 0)
            {
                Go(new DungeonScreen(true));
                return;
            }
            App.GoToCurrent();
        }
    }
}

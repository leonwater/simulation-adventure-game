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
            var head = UI.Card(page, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 16, 6, 6), false, 8, TextAnchor.MiddleLeft, "header");
            UI.Size(head, height: 58);
            var t = UI.Label(head, floor + "층 · 특수 이벤트", 15, Theme.Text, true);
            UI.Size(t, flexW: 1);
            if (C != null) UI.Label(head, "HP " + C.CurrentHp + "/" + CharacterStats.MaxHp(C), 13, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            ScreenKit.BottomLine(head);

            var body = UI.Scroll(page, out _, 14, UI.Pad(0, 0, 0, 16));
            UI.Illustration(body, _event.Illustration, 300);
            var inner = UI.Column(body, 14, UI.Pad(16, 16, 2, 0));
            UI.Label(inner, _event.Title, 24, Theme.Text, false, TextAnchor.MiddleLeft, true);
            var bodyText = UI.Label(inner, _event.Body, 15, Theme.TextBody);
            bodyText.lineSpacing = 1.35f;
            Typewriter.Attach(bodyText);
            bodyText.gameObject.AddComponent<TypewriterSkip>();
            bodyText.raycastTarget = true;

            if (_result != null)
            {
                ResultBox(inner);
                return;
            }
            UI.Spacer(inner, 1, 8);
            foreach (int i in EventRules.VisibleChoices(_event, C))
            {
                var ch = _event.Choices[i];
                int idx = i;
                string unavailable = EventRules.UnavailableReason(ch, C, floor);
                string hint = unavailable ?? EventRules.ChoiceHint(ch, C, floor);
                bool always = EventRules.CheckStat(ch, C) == null && ch.FixedChance >= 1;
                bool isPass = ch.Failure == null && always && ch.Success.HpRatio == 0 && ch.Success.Reward == EventReward.None
                              && ch.Success.GoldMult == 0 && ch.Success.ExpMult == 0 && !ch.Success.ReturnToTown;
                string right = isPass ? "›" : ScreenKit.Percent(EventRules.SuccessChance(ch, C, floor));
                var b = ScreenKit.ChoiceButton(inner, ch.Label, isPass ? null : hint, right, !isPass, null, unavailable == null, 60);
                var choice = ch;
                LongPress.Add(b, () =>
                {
                    var detail = Overlay.Modal(choice.Label);
                    var t = UI.Label(detail, EventRules.Breakdown(choice, C, floor) + (unavailable != null ? "\n\n" + unavailable : ""), 14, Theme.TextBody);
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

using System;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>새 게임: 난이도 4종, 직업 4종(변경 불가 안내), 이름 입력, 모험 시작 · 이어하기.</summary>
    public class TitleScreen : ScreenBase
    {
        private Difficulty _difficulty = Difficulty.Normal;
        private Job _job = Job.Warrior;
        private string _name = "";

        private static readonly string[] DifficultyHints = { "다음 방 종류가 보임", "기준 난이도", "적 능력치 ×1.25", "사망 시 캐릭터 초기화" };

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            var body = UI.Scroll(page, out _, 22, UI.Pad(16, 16, 40, 24), "title");

            var head = UI.Column(body, 6, UI.Pad(0, 0, 12, 0), TextAnchor.UpperCenter);
            UI.Label(head, "모험가 키우기", 38, Theme.Gold, false, TextAnchor.MiddleCenter, true);
            UI.Label(head, "던전 최하층을 향한 기록", 14, Theme.TextSub, false, TextAnchor.MiddleCenter);

            // 난이도
            var diffBox = UI.Column(body, 8);
            UI.Label(diffBox, "난이도", 14, Theme.Text, true);
            var dg = UI.Grid(diffBox, 2, ScreenKit.ContentWidth, 64, 8);
            foreach (Difficulty d in Enum.GetValues(typeof(Difficulty)))
            {
                var dd = d;
                Option(dg, Names.Of(d), DifficultyHints[(int)d], d == _difficulty, () =>
                {
                    _difficulty = dd;
                    Rebuild();
                });
            }

            // 직업
            var jobBox = UI.Column(body, 8);
            var jobHead = UI.Row(jobBox);
            var jl = UI.Label(jobHead, "직업", 14, Theme.Text, true);
            UI.Size(jl, flexW: 1);
            UI.Sub(jobHead, "시작 후 변경할 수 없습니다", TextAnchor.MiddleRight);
            var jg = UI.Grid(jobBox, 2, ScreenKit.ContentWidth, 64, 8);
            foreach (Job j in Enum.GetValues(typeof(Job)))
            {
                var jj = j;
                var data = JobData.Get(j);
                string stats = string.Join(" · ", Array.ConvertAll(data.MainStats, s => Names.Of(s)));
                Option(jg, data.Name, stats, j == _job, () =>
                {
                    _job = jj;
                    Rebuild();
                });
            }

            // 이름
            var nameBox = UI.Column(body, 8);
            UI.Label(nameBox, "모험가 이름", 14, Theme.Text, true);
            NameInput(nameBox);

            UI.Spacer(body, 1, 12);

            var buttons = UI.Column(body, 10);
            UI.TextButton(buttons, "모험 시작", StartGame, ButtonKind.Primary, 52, 16);
            var cont = UI.TextButton(buttons, "이어하기", Continue, ButtonKind.Ghost);
            UI.SetEnabled(cont, S.HasSave);
        }

        private static void Option(Transform grid, string title, string hint, bool on, Action onClick)
        {
            var b = UI.ButtonCard(grid, onClick, on ? Theme.AccentBg : Theme.Card, on ? Theme.Accent : Theme.ButtonBorder, 10, UI.Pad(12, 10), true, 4, 64, TextAnchor.MiddleLeft);
            UI.Label(b, title, 15, on ? Theme.Gold : Theme.Text, true);
            UI.Sub(b, hint);
        }

        private void NameInput(Transform parent)
        {
            var box = UI.Card(parent, Theme.Card, Theme.ButtonBorder, 10, UI.Pad(14, 0), false, 0, TextAnchor.MiddleLeft, "name");
            UI.Size(box, height: 48);
            box.GetComponent<Image>().raycastTarget = true;

            var area = UI.Rect(box, "text-area");
            UI.Size(area, height: 48, flexW: 1);
            var placeholder = UI.Label(area, "이름을 입력하세요", 15, Theme.PlaceholderText);
            UI.Stretch(placeholder.rectTransform);
            var text = UI.Label(area, "", 15, Theme.Text, false, TextAnchor.MiddleLeft, false, false);
            UI.Stretch(text.rectTransform);
            text.supportRichText = false;

            var input = box.gameObject.AddComponent<InputField>();
            input.textComponent = text;
            input.placeholder = placeholder;
            input.characterLimit = 12;
            input.lineType = InputField.LineType.SingleLine;
            input.targetGraphic = box.GetComponent<Image>();
            input.caretColor = Theme.Gold;
            input.selectionColor = new Color(0.85f, 0.64f, 0.25f, 0.35f);
            input.text = _name;
            input.onValueChanged.AddListener(v => _name = v);
        }

        private void StartGame()
        {
            if (string.IsNullOrWhiteSpace(_name))
            {
                Toast("모험가 이름을 입력해 주세요");
                return;
            }
            if (S.HasSave)
            {
                Overlay.Confirm("새 모험", "저장된 모험가가 있습니다. 새로 시작하면 이전 기록은 지워집니다.", "새로 시작", Begin, "취소", ButtonKind.Primary);
                return;
            }
            Begin();
        }

        private void Begin()
        {
            UI.ForgetScroll("title");
            S.NewGame(_name, _job, _difficulty);
            Go(new TownScreen());
            Toast(C.Name + "의 모험이 시작됐다!");
        }

        private void Continue()
        {
            if (!S.Continue())
            {
                Toast("저장 파일을 불러오지 못했습니다");
                Rebuild();
                return;
            }
            App.GoToCurrent();
        }
    }
}

using System;
using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>
    /// 길드 등록 (튜토리얼 시작): 접수원 대사와 함께 이름 → 직업 → 난이도 → 최종 확인.
    /// 각 단계에서 이전으로 돌아갈 수 있다 (수정 사항 #7).
    /// </summary>
    public class RegistrationScreen : ScreenBase
    {
        private int _step;
        private string _name = "";
        private Job _job = Job.Warrior;
        private Difficulty _difficulty = Difficulty.Normal;

        private static readonly string[] DifficultyDetail =
        {
            "적 능력치 ×0.75 · 다음 방의 종류를 미리 알 수 있음",
            "기준 난이도 · 처음이라면 추천",
            "적 능력치 ×1.25 · 방 종류는 들어가야 알 수 있음",
            "적 능력치 ×1.25 · 쓰러지면 캐릭터와 저장이 모두 사라짐",
        };

        public override bool OnBack()
        {
            Prev();
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            ScreenKit.TopBar(page, "모험가 길드", _step == 0 ? "처음으로" : "이전", Prev, "등록 " + (_step + 1) + "/4");
            ScreenKit.NpcIllustration(page, "길드 접수원", Line(), 290);
            var body = UI.Scroll(page, out _, 10, UI.Pad(16, 16, 14, 16), "register" + _step);
            switch (_step)
            {
                case 0: NameStep(body); break;
                case 1: JobStep(body); break;
                case 2: DifficultyStep(body); break;
                default: ConfirmStep(body); break;
            }
        }

        private string Line()
        {
            switch (_step)
            {
                case 0: return "어서 오세요, 모험가 길드입니다! 처음 오셨군요. 등록하실 이름을 알려 주시겠어요?";
                case 1: return _name.Trim() + " 님이시군요. 어떤 길을 걸으실 건가요? 한 번 정하면 바꿀 수 없어요.";
                case 2: return "던전은 위험한 곳이에요. 어느 정도의 위험을 각오하시나요?";
                default: return "이대로 등록할까요? 등록하면 바로 모험가 배지를 드릴게요.";
            }
        }

        private void Prev()
        {
            if (_step == 0)
            {
                Go(new TitleScreen());
                return;
            }
            _step--;
            Rebuild();
        }

        private void Next()
        {
            _step++;
            Rebuild();
        }

        // ── 1. 이름 ──

        private void NameStep(Transform body)
        {
            UI.Label(body, "모험가 이름", 14, Theme.Text, true);
            var input = NameInput(body);
            UI.Sub(body, "최대 12자 · 나중에 바꿀 수 없습니다");
            UI.Spacer(body, 0, 8);
            UI.TextButton(body, "다음", () =>
            {
                _name = (input.text ?? "").Trim();
                if (_name.Length == 0)
                {
                    Toast("모험가 이름을 입력해 주세요");
                    return;
                }
                Next();
            }, ButtonKind.Primary, 52, 16);
        }

        private InputField NameInput(Transform parent)
        {
            var box = UI.Card(parent, Theme.Card, Theme.ButtonBorder, 10, UI.Pad(14, 0), false, 0, TextAnchor.MiddleLeft, "name");
            UI.Size(box, height: 50);
            box.GetComponent<Image>().raycastTarget = true;

            var area = UI.Rect(box, "text-area");
            UI.Size(area, height: 50, flexW: 1);
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
            return input;
        }

        // ── 2. 직업 ──

        private void JobStep(Transform body)
        {
            var head = UI.Row(body);
            var l = UI.Label(head, "직업 선택", 14, Theme.Text, true);
            UI.Size(l, flexW: 1);
            UI.Label(head, "이후 변경 불가", 12, Theme.RedLight, true, TextAnchor.MiddleRight, false, false);
            foreach (Job j in Enum.GetValues(typeof(Job)))
            {
                var jj = j;
                var data = JobData.Get(j);
                bool on = j == _job;
                var card = UI.ButtonCard(body, () =>
                {
                    _job = jj;
                    Rebuild();
                }, on ? Theme.AccentBg : Theme.Card, on ? Theme.Accent : Theme.ButtonBorder, 12, UI.Pad(14, 10), true, 3, 76);
                var top = UI.Row(card, 8);
                var n = UI.Label(top, data.Name, 16, on ? Theme.Gold : Theme.Text, true);
                UI.Size(n, flexW: 1);
                UI.Label(top, data.WeaponName, 12, Theme.TextSub, false, TextAnchor.MiddleRight, false, false);
                UI.Label(card, "주요 능력치 " + UI.Color(string.Join(" · ", Array.ConvertAll(data.MainStats, s => Names.Of(s))), Theme.GoldHex), 13, Theme.TextBody);
                var skill = SkillDb.Get(SkillDb.StartingSkill(j));
                UI.Label(card, "시작 스킬 " + UI.Color(skill.Name, Theme.BlueHex) + UI.Color(" — " + skill.Effect, Theme.SubHex), 13, Theme.TextBody);
                if (!string.IsNullOrEmpty(data.Concept)) UI.Sub(card, data.Concept);
            }
            Nav(body, "다음");
        }

        // ── 3. 난이도 ──

        private void DifficultyStep(Transform body)
        {
            UI.Label(body, "난이도", 14, Theme.Text, true);
            foreach (Difficulty d in Enum.GetValues(typeof(Difficulty)))
            {
                var dd = d;
                bool on = d == _difficulty;
                var card = UI.ButtonCard(body, () =>
                {
                    _difficulty = dd;
                    Rebuild();
                }, on ? Theme.AccentBg : Theme.Card, on ? Theme.Accent : Theme.ButtonBorder, 12, UI.Pad(14, 10), true, 3, 60);
                UI.Label(card, Names.Of(d), 16, on ? Theme.Gold : d == Difficulty.Hardcore ? Theme.RedLight : Theme.Text, true);
                UI.Sub(card, DifficultyDetail[(int)d]);
            }
            UI.Sub(body, "공통: 쓰러지면 골드 30%·경험치 일부와 가방 속 아이템을 잃고 마을로 돌아옵니다 (하드코어 제외).");
            Nav(body, "다음");
        }

        // ── 4. 확인 ──

        private void ConfirmStep(Transform body)
        {
            var data = JobData.Get(_job);
            var card = UI.Card(body, Theme.Card, Theme.Accent, 12, UI.Pad(16, 14), true, 8);
            UI.Label(card, _name, 22, Theme.Text, true);
            Row(card, "직업", data.Name + " · " + string.Join(" · ", Array.ConvertAll(data.MainStats, s => Names.Of(s))));
            Row(card, "시작 스킬", SkillDb.Get(SkillDb.StartingSkill(_job)).Name);
            Row(card, "난이도", Names.Of(_difficulty));
            UI.Sub(card, "직업과 난이도는 등록 후 바꿀 수 없습니다.");
            var row = UI.Row(body, 8);
            var back = UI.TextButton(row, "이전", Prev, ButtonKind.Ghost);
            UI.Size(back, flexW: 1);
            var ok = UI.TextButton(row, "등록하기", Register, ButtonKind.Primary);
            UI.Size(ok, flexW: 2);
        }

        private static void Row(Transform parent, string k, string v)
        {
            var row = UI.Row(parent, 8);
            var l = UI.Sub(row, k);
            UI.Size(l, width: 72);
            var t = UI.Label(row, v, 14, Theme.Text);
            UI.Size(t, flexW: 1);
        }

        private void Nav(Transform body, string next)
        {
            UI.Spacer(body, 0, 4);
            var row = UI.Row(body, 8);
            var back = UI.TextButton(row, "이전", Prev, ButtonKind.Ghost);
            UI.Size(back, flexW: 1);
            var ok = UI.TextButton(row, next, Next, ButtonKind.Primary);
            UI.Size(ok, flexW: 2);
        }

        private void Register()
        {
            UI.ForgetScroll("town");
            S.NewGame(_name, _job, _difficulty);
            Go(new TownScreen());
        }
    }
}

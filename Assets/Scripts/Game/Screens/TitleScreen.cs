using System;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>시작 화면: 로고 + 시작하기 · 이어하기(요약 카드) · 설정 · 게임 종료 (수정 사항 #6).</summary>
    public class TitleScreen : ScreenBase
    {
        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root, 0, UI.Pad(24, 24, 24, 32));
            UI.Spacer(page, 1.2f);

            var logo = UI.Column(page, 10, null, TextAnchor.MiddleCenter);
            UI.Label(logo, "─  ◆  ─", 14, Theme.Accent, false, TextAnchor.MiddleCenter);
            UI.Label(logo, "모험가 키우기", 40, Theme.Gold, false, TextAnchor.MiddleCenter, true);
            UI.Label(logo, "던전 최하층을 향한 기록", 14, Theme.TextSub, false, TextAnchor.MiddleCenter);

            UI.Spacer(page, 1f);

            var buttons = UI.Column(page, 10);
            UI.TextButton(buttons, "시작하기", StartNew, ButtonKind.Primary, 54, 16);
            bool hasSave = S.HasSave;
            var cont = UI.TextButton(buttons, "이어하기", ShowSummary, ButtonKind.Outline, 50);
            UI.SetEnabled(cont, hasSave, 0.4f);
            UI.TextButton(buttons, "설정", () => SettingsPanel.Open(true), ButtonKind.Ghost, 50);
            UI.TextButton(buttons, "게임 종료", () => Overlay.Confirm("게임 종료", "게임을 종료할까요?", "종료", App.Quit), ButtonKind.Ghost, 50);
            if (!hasSave) UI.Sub(buttons, "저장된 모험가가 없습니다", TextAnchor.MiddleCenter);
        }

        private void StartNew()
        {
            if (S.HasSave)
            {
                Overlay.Confirm("새 모험", "저장된 모험가가 있습니다. 새로 시작하면 이전 기록은 지워집니다.", "새로 시작", () => Go(new PrologueScreen()));
                return;
            }
            Go(new PrologueScreen());
        }

        /// <summary>이어하기 요약 카드 (이름·직업·레벨 / 등급·난이도 / 층·골드 / 플레이 시간·마지막 저장).</summary>
        private void ShowSummary()
        {
            var data = S.PeekSave();
            if (data == null)
            {
                Toast("저장 파일을 불러오지 못했습니다");
                Rebuild();
                return;
            }
            var c = data.Character;
            var body = Overlay.Modal("이어하기", false, false);
            var modal = Overlay.Top;
            Overlay.SetBack(() => Overlay.Close(modal));

            var card = UI.Card(body, Theme.Bg, Theme.CardBorder, 12, UI.Pad(14, 12), true, 8);
            UI.Label(card, c.Name, 20, Theme.Text, true);
            UI.Sub(card, c.JobData.Name + " · Lv." + c.Level);
            UI.Divider(card);
            Pair(card, "등급", c.Rank + " 등급", "난이도", Names.Of(data.Difficulty));
            string floor = data.Run != null ? data.Run.Floor + "층 탐험 중" : "돌파 " + c.HighestFloorCleared + "층";
            Pair(card, "층", floor, "골드", Names.Gold(c.Gold));
            long sec = data.PlaySeconds;
            string saved = data.SavedAtTicks > 0 ? new DateTime(data.SavedAtTicks, DateTimeKind.Utc).ToLocalTime().ToString("M월 d일 HH:mm") : "-";
            Pair(card, "플레이", (sec / 3600) + "시간 " + (sec / 60 % 60) + "분", "마지막 저장", saved);

            var row = UI.Row(body, 8);
            var cancel = UI.TextButton(row, "취소", () => Overlay.Close(modal), ButtonKind.Ghost);
            UI.Size(cancel, flexW: 1);
            var ok = UI.TextButton(row, "이어하기", () =>
            {
                Overlay.Close(modal);
                Continue();
            }, ButtonKind.Primary);
            UI.Size(ok, flexW: 1);
        }

        private static void Pair(Transform parent, string k1, string v1, string k2, string v2)
        {
            var row = UI.Row(parent, 8);
            Cell(row, k1, v1);
            Cell(row, k2, v2);
        }

        private static void Cell(Transform row, string key, string value)
        {
            var col = UI.Column(row, 2);
            UI.Size(col, flexW: 1);
            UI.Sub(col, key);
            UI.Label(col, value, 14, Theme.Text, true);
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

    /// <summary>프롤로그 (던전이 나타난 세상과 모험가) → 길드 등록.</summary>
    public class PrologueScreen : ScreenBase
    {
        private const string Story = "평화롭던 세상에 어느 날 갑자기 던전들이 나타났다.\n\n던전에서 쏟아져 나온 몬스터들은 사람들을 약탈하고 죽였다.\n\n소중한 사람들을 지키기 위해, 혹은 명예를 위해.\n저마다의 이유로 던전에 도전하는 이들이 나타났다.\n\n사람들은 그들을 '모험가'라 불렀다.";
        private Typewriter _tw;

        public override bool OnBack()
        {
            Go(new TitleScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root, 0, UI.Pad(28, 28, 28, 32));
            var area = UI.ButtonCard(page, Next, Theme.Bg, Theme.Bg, 0.01f, UI.Pad(0), true, 0, 200, TextAnchor.MiddleCenter);
            UI.Size(area, flexH: 1);
            var text = UI.Label(area, Story, 17, Theme.TextBody, false, TextAnchor.MiddleCenter, true);
            text.lineSpacing = 1.4f;
            _tw = Typewriter.Attach(text);
            _tw.CharsPerSecond = 28f;
            UI.Sub(page, "화면을 누르면 넘어갑니다", TextAnchor.MiddleCenter);
            UI.Spacer(page, 0, 12);
            UI.TextButton(page, "건너뛰기", () => Go(new RegistrationScreen()), ButtonKind.Ghost, 44, 13);
        }

        private void Next()
        {
            if (_tw != null && !_tw.Done)
            {
                _tw.Complete();
                return;
            }
            Go(new RegistrationScreen());
        }
    }
}

using System;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>설정: 기기 설정(전투 속도·타자 효과·진동·글자 크기), 튜토리얼 다시 보기, 모험 정보, 저장, 기록 삭제.</summary>
    public class SettingsScreen : ScreenBase
    {
        private readonly bool _fromTitle;

        public SettingsScreen(bool fromTitle = false)
        {
            _fromTitle = fromTitle;
        }

        public override bool OnBack()
        {
            Go(_fromTitle || !S.HasGame ? (ScreenBase)new TitleScreen() : new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            if (_fromTitle) ScreenKit.TopBar(page, "설정", "처음으로", () => Go(new TitleScreen()), "");
            var body = UI.Scroll(page, out _, 12, UI.Pad(16, 16), "settings");
            if (!_fromTitle) UI.Label(body, "설정", 22, Theme.Text, false, TextAnchor.MiddleLeft, true);

            var device = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 8), true, 0);
            Choice(device, "전투 속도", new[] { "1×", "2×" }, GameSettings.BattleSpeed - 1, i => GameSettings.BattleSpeed = i + 1);
            Choice(device, "대사 한 글자씩", new[] { "끄기", "켜기" }, GameSettings.Typewriter ? 1 : 0, i => GameSettings.Typewriter = i == 1);
            Choice(device, "진동", new[] { "끄기", "켜기" }, GameSettings.Vibration ? 1 : 0, i => GameSettings.Vibration = i == 1);
            Choice(device, "글자 크기", GameSettings.TextSizeNames, GameSettings.TextSize, i => GameSettings.TextSize = i, false);

            if (!_fromTitle && S.HasGame)
            {
                var info = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 12), true, 6);
                Line(info, "모험가", C.Name + " · " + C.JobData.Name + " Lv." + C.Level);
                Line(info, "난이도", Names.Of(S.Difficulty));
                Line(info, "돌파 층", C.HighestFloorCleared + " / " + GameBalance.MaxFloor + (S.Data.GameCleared ? " · 던전 정복" : ""));
                Line(info, "완료한 퀘스트", C.QuestsCompleted.ToString());
                long sec = S.Data.PlaySeconds;
                Line(info, "플레이 시간", (sec / 3600) + "시간 " + (sec / 60 % 60) + "분");

                var tut = UI.TextButton(body, "튜토리얼 다시 보기", () => Overlay.Confirm("튜토리얼", "마을 시설 안내부터 다시 보여 드립니다.", "다시 보기", () =>
                {
                    S.RestartTutorial();
                    Go(new TownScreen());
                }), ButtonKind.Ghost);
                UI.SetEnabled(tut, !S.InDungeon);
                UI.TextButton(body, "지금 저장", () =>
                {
                    S.Save();
                    Toast("저장했습니다");
                });
                UI.TextButton(body, "타이틀 화면으로", () =>
                {
                    S.Save();
                    Go(new TitleScreen());
                }, ButtonKind.Ghost);
                UI.TextButton(body, "모험 기록 삭제", () => Overlay.Confirm("기록 삭제", "저장된 모험가가 완전히 지워집니다. 되돌릴 수 없습니다.", "삭제", () =>
                {
                    S.DeleteSave();
                    Go(new TitleScreen());
                }, "취소", ButtonKind.Secondary), ButtonKind.Ghost);
            }

            UI.Spacer(body, 0, 8);
            UI.Sub(body, "자동 저장: 방을 하나 끝낼 때마다, 마을에서 행동할 때마다, 앱이 백그라운드로 갈 때 저장합니다.");
            UI.Sub(body, "글꼴: 나눔고딕(NAVER), 고운바탕 — SIL Open Font License 1.1");
            if (!_fromTitle) ScreenKit.BottomNav(page, 4);
        }

        /// <summary>한 줄 선택지 (알약 버튼). rebuildAll이면 화면 전체를 다시 그린다 (글자 크기).</summary>
        private void Choice(Transform parent, string label, string[] options, int active, Action<int> onSelect, bool line = true)
        {
            var row = UI.Row(parent, 6);
            UI.Size(row, minH: 54);
            var l = UI.Label(row, label, 14, Theme.Text);
            UI.Size(l, flexW: 1);
            for (int i = 0; i < options.Length; i++)
            {
                int idx = i;
                var b = UI.TextButton(row, options[i], () =>
                {
                    onSelect(idx);
                    Rebuild();
                }, i == active ? ButtonKind.Primary : ButtonKind.Ghost, 40, 13, 58);
            }
            if (line) ScreenKit.BottomLine(row, Theme.LineSoft);
        }

        private static void Line(Transform parent, string label, string value)
        {
            var row = UI.Row(parent, 8);
            UI.Size(row, height: 28);
            var l = UI.Sub(row, label);
            UI.Size(l, flexW: 1);
            UI.Label(row, value, 14, Theme.Text, false, TextAnchor.MiddleRight, false, false);
        }
    }
}

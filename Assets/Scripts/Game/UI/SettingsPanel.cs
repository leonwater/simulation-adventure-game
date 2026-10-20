using System;
using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>
    /// 설정 창 (마을 오른쪽 위 설정 버튼, 시작 화면의 설정 버튼에서 연다).
    /// 기기 설정(전투 속도·대사 한 글자씩·진동·글자 크기), 모험 정보, 처음 화면으로 · 저장 · 튜토리얼 · 모험 기록 삭제.
    /// </summary>
    public static class SettingsPanel
    {
        private static GameApp App => GameApp.Instance;
        private static GameSession S => App.Session;

        public static void Open(bool fromTitle = false)
        {
            var body = App.Overlay.Modal("설정", true);
            var modal = App.Overlay.Top;
            // 설정을 바꾸면 뒤 화면(글자 크기 등)을 다시 그리고 창을 다시 연다
            Action reopen = () =>
            {
                App.Overlay.Close(modal);
                App.Router.Rebuild();
                Open(fromTitle);
            };

            var device = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(12, 6), true, 0);
            Choice(device, "전투 속도", new[] { "1×", "2×" }, GameSettings.BattleSpeed - 1, i => GameSettings.BattleSpeed = i + 1, reopen);
            Choice(device, "대사 한 글자씩", new[] { "끄기", "켜기" }, GameSettings.Typewriter ? 1 : 0, i => GameSettings.Typewriter = i == 1, reopen);
            Choice(device, "진동", new[] { "끄기", "켜기" }, GameSettings.Vibration ? 1 : 0, i => GameSettings.Vibration = i == 1, reopen);
            Choice(device, "글자 크기", GameSettings.TextSizeNames, GameSettings.TextSize, i => GameSettings.TextSize = i, reopen, false);

            if (!fromTitle && S.HasGame)
            {
                var c = S.C;
                var info = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 10), true, 4);
                var who = UI.Row(info, 8);
                UI.Size(who, height: 28);
                UI.Size(UI.Sub(who, "모험가"), flexW: 1);
                ScreenKit.JobLine(who, c.Job, c.Name + " · " + c.JobData.Name + " Lv." + c.Level, 14, Theme.Text);
                Line(info, "난이도", Names.Of(S.Difficulty));
                Line(info, "돌파 층", c.HighestFloorCleared + " / " + GameBalance.MaxFloor + (S.Data.GameCleared ? " · 던전 정복" : ""));
                Line(info, "완료한 퀘스트", c.QuestsCompleted.ToString());
                long sec = S.Data.PlaySeconds;
                Line(info, "플레이 시간", (sec / 3600) + "시간 " + (sec / 60 % 60) + "분");

                UI.TextButton(body, "처음 화면으로", () =>
                {
                    S.Save();
                    App.Router.Show(new TitleScreen());
                }, ButtonKind.Ghost);
                UI.TextButton(body, "저장", () =>
                {
                    S.Save();
                    App.Overlay.Toast("저장했습니다");
                });
                var tut = UI.TextButton(body, "튜토리얼", () => App.Overlay.Confirm("튜토리얼", "마을 시설 안내부터 다시 보여 드립니다.", "다시 보기", () =>
                {
                    S.RestartTutorial();
                    App.Router.Show(new TownScreen());
                }), ButtonKind.Ghost);
                UI.SetEnabled(tut, !S.InDungeon);
                UI.TextButton(body, "모험 기록 삭제", () => App.Overlay.Confirm("기록 삭제", "저장된 모험가가 완전히 지워집니다. 되돌릴 수 없습니다.", "삭제", () =>
                {
                    S.DeleteSave();
                    App.Router.Show(new TitleScreen());
                }, "취소", ButtonKind.Secondary), ButtonKind.Ghost);
            }

        }

        private static void Choice(Transform parent, string label, string[] options, int active, Action<int> onSelect, Action after, bool line = true)
        {
            var row = UI.Row(parent, 6);
            UI.Size(row, minH: 52);
            var l = UI.Label(row, label, 14, Theme.Text);
            UI.Size(l, flexW: 1);
            for (int i = 0; i < options.Length; i++)
            {
                int idx = i;
                UI.TextButton(row, options[i], () =>
                {
                    onSelect(idx);
                    after();
                }, i == active ? ButtonKind.Primary : ButtonKind.Ghost, 40, 13, 54);
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

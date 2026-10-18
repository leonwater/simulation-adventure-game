using Adventure.Core;
using UnityEngine;

namespace Adventure.Game
{
    /// <summary>설정: 모험 정보, 저장, 타이틀로, 새 게임(데이터 삭제), 글꼴 저작권.</summary>
    public class SettingsScreen : ScreenBase
    {
        public override bool OnBack()
        {
            Go(new TownScreen());
            return true;
        }

        public override void Build(RectTransform root)
        {
            var page = ScreenKit.Page(root);
            var body = UI.Scroll(page, out _, 12, UI.Pad(16, 16), "settings");
            UI.Label(body, "설정", 22, Theme.Text, false, TextAnchor.MiddleLeft, true);

            var info = UI.Card(body, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 12), true, 6);
            Line(info, "모험가", C.Name + " · " + C.JobData.Name + " Lv." + C.Level);
            Line(info, "난이도", Names.Of(S.Difficulty));
            Line(info, "돌파 층", C.HighestFloorCleared + " / " + GameBalance.MaxFloor + (S.Data.GameCleared ? " · 던전 정복" : ""));
            Line(info, "완료한 퀘스트", C.QuestsCompleted.ToString());
            long sec = S.Data.PlaySeconds;
            Line(info, "플레이 시간", (sec / 3600) + "시간 " + (sec / 60 % 60) + "분");

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

            UI.Spacer(body, 0, 8);
            UI.Sub(body, "자동 저장: 방을 하나 끝낼 때마다, 마을에서 행동할 때마다, 앱이 백그라운드로 갈 때 저장합니다.");
            UI.Sub(body, "글꼴: 나눔고딕(NAVER), 고운바탕 — SIL Open Font License 1.1");
            ScreenKit.BottomNav(page, 4);
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

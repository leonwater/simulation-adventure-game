using Adventure.Core;
using UnityEngine;
using UnityEngine.UI;

namespace Adventure.Game
{
    /// <summary>전투: 적 목록(HP 막대·상태), 내 HP·버프, 전투 기록, 선택지 스크롤(성공 확률).</summary>
    public class BattleScreen : ScreenBase
    {
        public override bool OnBack()
        {
            Pause();
            return true;
        }

        public override void Build(RectTransform root)
        {
            var b = S.Battle;
            if (b == null)
            {
                App.GoToCurrent();
                return;
            }
            var page = ScreenKit.Page(root);
            var head = UI.Card(page, Theme.Bar, Theme.Bar, 0.01f, UI.Pad(16, 12, 6, 6), false, 8, TextAnchor.MiddleLeft, "header");
            UI.Size(head, height: 58);
            var title = UI.Label(head, b.Floor + "층 · " + (b.IsBoss ? "보스전" : "전투") + " " + UI.Color(b.Turn + "턴째", Theme.SubHex), 15, Theme.Text, true);
            UI.Size(title, flexW: 1);
            ScreenKit.PauseButton(head, Pause);
            ScreenKit.BottomLine(head);

            var body = UI.Column(page, 10, UI.Pad(16, 16, 10, 14));
            UI.Size(body, flexH: 1);

            Enemies(body, b);
            Player(body, b);
            Log(body, b);

            if (b.IsOver)
            {
                Finished(body, b);
                return;
            }
            var hint = UI.Row(body);
            var hl = UI.Sub(hint, "모든 선택은 1턴을 사용합니다");
            UI.Size(hl, flexW: 1);
            UI.Sub(hint, "성공 확률", TextAnchor.MiddleRight);
            var list = UI.Scroll(body, out _, 6, UI.Pad(0, 2, 0, 0), null, 1);
            foreach (var ch in b.GetChoices()) Choice(list, ch);
        }

        private static void Enemies(Transform parent, Battle b)
        {
            var card = UI.Card(parent, Theme.Card, Theme.CardBorder, 12, UI.Pad(14, 4), true, 0);
            for (int i = 0; i < b.Enemies.Count; i++)
            {
                var e = b.Enemies[i];
                var row = UI.Column(card, 4, UI.Pad(0, 0, 8, 8));
                var top = UI.Row(row, 6);
                var name = UI.Label(top, e.Name, 14, e.Alive ? Theme.Text : Theme.TextSub, true);
                UI.Size(name, flexW: 1);
                if (e.Alive) ScreenKit.StatusTags(top, e);
                UI.Label(top, e.Alive ? e.Hp + "/" + e.MaxHp : "쓰러짐", 12, Theme.TextSub, false, TextAnchor.MiddleRight, false, false);
                UI.ProgressBar(row, (float)e.HpRatio, Theme.Red, 8);
                if (!e.Alive) row.gameObject.AddComponent<CanvasGroup>().alpha = 0.5f;
                if (i < b.Enemies.Count - 1) ScreenKit.BottomLine(row, Theme.LineSoft);
            }
        }

        private void Player(Transform parent, Battle b)
        {
            var p = b.Player;
            var card = UI.Card(parent, Theme.BlueBg, Theme.BlueBorder, 12, UI.Pad(14, 10), true, 6);
            var top = UI.Row(card);
            var name = UI.Label(top, C.Name + " " + UI.Color(C.JobData.Name + " Lv." + C.Level, Theme.SubHex), 14, Theme.Text, true);
            UI.Size(name, flexW: 1);
            UI.Label(top, "HP " + p.Hp + "/" + p.MaxHp, 13, Theme.Text, false, TextAnchor.MiddleRight, false, false);
            UI.ProgressBar(card, (float)p.HpRatio, p.HpRatio < 0.3 ? Theme.Red : Theme.Green, 8);
            if (p.Statuses.All.Count > 0)
            {
                var tags = UI.Row(card, 6);
                ScreenKit.StatusTags(tags, p);
            }
        }

        private static void Log(Transform parent, Battle b)
        {
            var bg = UI.Card(parent, Theme.Log, Theme.Log, 10, UI.Pad(0), true, 0);
            UI.Size(bg, height: 104);
            var content = UI.Scroll(bg, out var scroll, 0, UI.Pad(12, 12, 8, 8), null, 1);
            int start = Mathf.Max(0, b.Log.Count - 40);
            for (int i = start; i < b.Log.Count; i++)
            {
                var line = b.Log[i];
                Color color = line.Tone == LogTone.Good ? Theme.Gold : line.Tone == LogTone.Bad ? Theme.RedLight : line.Tone == LogTone.System ? Theme.Text : Theme.TextLog;
                UI.Label(content, line.Text, 13, color);
            }
            scroll.gameObject.AddComponent<ScrollToBottom>();
        }

        private void Choice(Transform parent, BattleChoice ch)
        {
            string right = ch.Enabled ? (ch.Kind == ActionKind.Item ? ch.Note : ch.Kind == ActionKind.Wait ? ch.Note : ScreenKit.Percent(ch.Chance)) : ch.Note;
            bool pct = ch.Enabled && ch.Kind != ActionKind.Item && ch.Kind != ActionKind.Wait;
            ScreenKit.ChoiceButton(parent, ch.Label, null, right, pct, () => Pick(ch), ch.Enabled);
        }

        private void Pick(BattleChoice ch)
        {
            if (ch.Kind == ActionKind.Item)
            {
                ItemMenu();
                return;
            }
            Execute(ch);
        }

        private void Execute(BattleChoice ch)
        {
            S.ExecuteBattle(ch);
            var b = S.Battle;
            if (S.LastDeath != null && !S.InDungeon)
            {
                Go(new ResultScreen(S.LastDeath.HardcoreReset ? ResultKind.Hardcore : ResultKind.Death));
                return;
            }
            if (b == null)
            {
                // 도망쳤다
                Go(new DungeonScreen());
                return;
            }
            Rebuild();
        }

        private void ItemMenu()
        {
            var body = Overlay.Modal("아이템 사용", true);
            var modal = Overlay.Top;
            UI.Sub(body, "아이템 사용도 1턴을 씁니다.");
            foreach (var ch in S.Battle.GetItemChoices())
            {
                var c = ch;
                ScreenKit.ChoiceButton(body, ch.Label, null, ch.Note, false, () =>
                {
                    Overlay.Close(modal);
                    Execute(c);
                }, ch.Enabled);
            }
        }

        private void Finished(Transform parent, Battle b)
        {
            if (b.Outcome != BattleOutcome.Victory) return;
            var card = UI.Card(parent, Theme.AccentBg, Theme.Accent, 12, UI.Pad(14, 12), true, 6);
            UI.Label(card, b.IsBoss ? "보스를 쓰러뜨렸다!" : "승리!", 18, Theme.Gold, false, TextAnchor.MiddleLeft, true);
            var loot = S.LastLoot;
            if (loot != null)
            {
                UI.Label(card, loot.Describe(), 14, Theme.Text);
                if (loot.LevelsGained > 0) UI.Label(card, "레벨 업! Lv." + C.Level + " · 능력치 포인트 +" + loot.LevelsGained * GameBalance.PointsPerLevel, 14, Theme.Gold, true);
            }
            if (b.IsBoss) UI.Sub(card, "돌파 층 " + C.HighestFloorCleared + " · 다음 층이 열렸다");
            UI.Spacer(parent);
            UI.TextButton(parent, "계속", Continue, ButtonKind.Primary, 52, 16);
        }

        private void Continue()
        {
            S.CloseBattle();
            if (S.JustClearedGame)
            {
                S.JustClearedGame = false;
                Go(new ResultScreen(ResultKind.Clear));
                return;
            }
            App.GoToCurrent();
        }

        private void Pause()
        {
            var body = Overlay.Modal("일시정지");
            var modal = Overlay.Top;
            UI.Sub(body, "전투 중에 앱을 끄면, 다시 켰을 때 이 방의 전투를 처음부터 다시 시작합니다.");
            UI.TextButton(body, "계속하기", () => Overlay.Close(modal), ButtonKind.Primary);
            UI.TextButton(body, "저장하고 타이틀로", () =>
            {
                S.Save();
                Go(new TitleScreen());
            }, ButtonKind.Ghost);
        }
    }
}

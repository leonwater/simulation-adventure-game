using System;
using Adventure.Core;

namespace Adventure.Game
{
    /// <summary>
    /// 튜토리얼 안내 (수정 사항 #7). 안내는 한 번만 보이며(TipsShown), 단계는 저장 파일에 남는다.
    /// 마을 안내 → 고정 1층(미니맵 → 길 선택 → 첫 전투 → 레벨 업 배분) → 귀환 후 정산·창고 안내 → 끝.
    /// </summary>
    public static class Tutorial
    {
        private static GameSession S => GameApp.Instance.Session;
        private static Overlay O => GameApp.Instance.Overlay;

        public static bool Active => S.HasGame && S.Data.Tutorial != TutorialStage.Done;

        /// <summary>안내 팝업을 순서대로 띄운다. 이미 본 key면 아무것도 하지 않고 false.</summary>
        public static bool Show(string key, string[] titles, string[] lines, Action done = null)
        {
            if (!Active || !S.MarkTip(key)) return false;
            Step(titles, lines, 0, done);
            return true;
        }

        public static bool Show(string key, string title, string line, Action done = null) =>
            Show(key, new[] { title }, new[] { line }, done);

        private static void Step(string[] titles, string[] lines, int i, Action done)
        {
            if (i >= lines.Length)
            {
                done?.Invoke();
                return;
            }
            string ok = i < lines.Length - 1 ? "다음 (" + (i + 1) + "/" + lines.Length + ")" : "확인";
            O.Message(titles[Math.Min(i, titles.Length - 1)], lines[i], ok, () => Step(titles, lines, i + 1, done));
        }

        // ── 마을 ──

        public static void OnTown()
        {
            if (!Active) return;
            var stage = S.Data.Tutorial;
            if (stage == TutorialStage.TownGuide)
            {
                Show("town", new[] { "등불 마을", "길드", "상점", "대장간", "수련장", "던전" }, new[]
                {
                    "등록을 마쳤어요! 이곳은 던전 입구에 있는 등불 마을입니다. 시설을 간단히 안내해 드릴게요.",
                    "의뢰(퀘스트)를 받고 보고하는 곳이에요. 등급 승급과 아이템을 맡기는 창고도 여기 있어요.",
                    "장비·물약·스킬서를 팔아요. 물건은 30분마다 바뀌고, 골드로 바로 바꿀 수도 있어요.",
                    "장비를 +10까지 강화해요. 실패해도 장비는 부서지지 않아요.",
                    "가진 스킬을 골드로 수련해 위력을 높여요.",
                    "준비가 되면 아래 '던전 입장'을 눌러 1층에 도전해 보세요. 첫 층은 연습용으로 짧게 준비되어 있어요.",
                }, () => S.SetTutorial(TutorialStage.FirstDungeon));
            }
            else if (stage == TutorialStage.AfterReturn)
            {
                Show("after-return", new[] { "첫 모험 완료", "정산" }, new[]
                {
                    "무사히 돌아오셨네요! 던전에서 얻은 골드와 경험치는 그대로 남고, 전리품은 가방에 들어 있어요.",
                    "던전에서 쓰러지면 골드 일부와 가방 속 아이템을 잃어요. 소중한 물건은 길드 창고에 맡겨 두세요.",
                }, () => GameApp.Instance.Router.Show(new GuildScreen(2)));
            }
        }

        /// <summary>길드 창고 탭을 열었을 때: 창고 안내 후 튜토리얼 끝.</summary>
        public static void OnGuildStorage()
        {
            if (!Active || S.Data.Tutorial != TutorialStage.AfterReturn) return;
            Show("storage", "길드 창고", "창고에 맡긴 아이템은 던전에서 쓰러져도 잃지 않아요. 아래 가방에서 아이템을 눌러 맡길 수 있어요.\n\n이제 튜토리얼은 끝이에요. 최하층까지, 행운을 빌어요!",
                () => S.SetTutorial(TutorialStage.Done));
        }

        // ── 던전 ──

        public static void OnDungeon(bool returnRoom)
        {
            if (!Active || S.Data.Tutorial != TutorialStage.FirstDungeon) return;
            if (Show("map", new[] { "미니맵", "길 선택" }, new[]
                {
                    "위쪽 미니맵에 지금 위치(금색)와 갈 수 있는 방(빛나는 테두리)이 보여요. 미니맵을 누르면 전체 지도가 열리고, 탐험한 방으로 순간이동할 수 있어요.",
                    "아래 버튼으로 갈 길을 고르세요. 처음 가는 방은 들어가기 전까지 무엇이 있는지 알 수 없어요.",
                })) return;
            if (returnRoom)
                Show("return", "귀환 방", "귀환 마법진을 찾았어요! 이제 언제든 마을로 돌아갈 수 있어요. 더 탐험해 보스를 쓰러뜨리면 다음 층이 열려요. 연습이 충분하다면 지금 돌아가도 좋아요.");
        }

        public static void OnBattle()
        {
            if (!Active || S.Data.Tutorial != TutorialStage.FirstDungeon) return;
            Show("battle", new[] { "전투", "선택지" }, new[]
            {
                "적을 누르면 공격할 대상을 고를 수 있어요. 대상을 고르면 아래 선택지가 그 적에 맞게 바뀝니다.",
                "선택지 오른쪽 숫자는 성공 확률이에요. 선택지를 길게 누르면 확률이 어떻게 계산됐는지 볼 수 있어요.",
            });
        }

        public static void OnLevelUp()
        {
            if (!Active || S.Data.Tutorial != TutorialStage.FirstDungeon) return;
            Show("levelup", "레벨 업", "레벨이 오르면 능력치 포인트를 받아요. + 버튼으로 직접 나누거나 '자동 배분'을 누르세요. 나중으로 미루면 마을의 캐릭터 화면에서도 배분할 수 있어요.");
        }
    }
}

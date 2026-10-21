using System;
using Adventure.Core;

namespace Adventure.Game
{
    /// <summary>
    /// 직접 해 보며 배우는 튜토리얼. 화면의 한 곳을 밝게 남기고(코치 마크) 말풍선으로 설명한다.
    /// v2.4 간략화: 말풍선은 화면마다 한두 개, 짧게.
    /// - 마을: 상점 → 길드 → 대장간 → 수련장을 한 번씩 들어가 한 줄 설명을 보고 돌아온다. 마지막에 던전 입장.
    /// - 첫 1층: 미니맵 → 길 고르기 → 전투(선택지 → 공격) → 레벨 업 → 보스를 잡으면 귀환 (아래층으로는 못 감).
    /// - 귀환 후: 정산 → (첫 던전 보스를 잡았을 때만) 길드 창고 → 끝.
    /// 본 설명은 TipsShown에 남아 다시 켜도 이어서 진행한다. 이 기기에서 튜토리얼을 처음 끝까지 하는 동안에는 건너뛰기가 없고,
    /// 한 번 마친 뒤로는(새 게임·다시 보기 모두) 화면 오른쪽 위 "건너뛰기"로 끝낼 수 있다 (v1.8).
    /// 튜토리얼 중에는 안내한 곳과 건너뛰기만 눌리고, 첫 던전에서는 안내하지 않은 가방·도주·타이틀로 가기를 잠근다 (v1.8).
    /// 말풍선의 중요한 말은 금색, 좋고 나쁨은 초록·빨강으로 칠한다.
    /// </summary>
    public static class Tutorial
    {
        private static GameSession S => GameApp.Instance.Session;

        private static TutorialStage Stage => S.HasGame ? S.Data.Tutorial : TutorialStage.Done;

        /// <summary>건너뛰기 버튼: 이 기기에서 튜토리얼을 한 번 마친 뒤부터 (처음 튜토리얼은 끝까지 진행).</summary>
        private static Action SkipButton => GameSettings.TutorialCompleted ? (Action)Skip : null;

        /// <summary>튜토리얼 중인지 (마을 안내·첫 던전·귀환 후 안내).</summary>
        public static bool Running => Stage != TutorialStage.Done;

        /// <summary>튜토리얼에서 아직 안내하지 않은 행동이면 막고 알린다 (막았으면 true).</summary>
        public static bool Blocks(string what)
        {
            if (!Running) return false;
            GameApp.Instance.Overlay.Toast("튜토리얼이 끝나면 " + what + Names.Josa(what, "을/를").Substring(what.Length) + " 쓸 수 있어요");
            return true;
        }

        /// <summary>튜토리얼을 끝까지 마쳤다: 이 기기에서는 다음부터 건너뛰기가 나온다.</summary>
        private static void Finish()
        {
            GameSettings.TutorialCompleted = true;
            S.SetTutorial(TutorialStage.Done);
        }

        // 말풍선 강조: 중요한 말은 금색, 좋음 초록, 나쁨 빨강
        private static string H(string t) => UI.Color(t, Theme.GoldHex);
        private static string Good(string t) => UI.Color(t, Theme.GreenHex);
        private static string Bad(string t) => UI.Color(t, Theme.RedHex);

        private struct Step
        {
            public string Key, Anchor, Title, Text;
        }

        private static Step Info(string key, string anchor, string title, string text) =>
            new Step { Key = key, Anchor = anchor, Title = title, Text = text };

        /// <summary>아직 보지 않은 설명을 차례로 보여 주고, 모두 봤으면 done을 부른다.</summary>
        private static void Run(Step[] steps, Action done)
        {
            foreach (var st in steps)
            {
                if (S.TipShown(st.Key)) continue;
                var step = st;
                Coach.Info(Anchors.Get(step.Anchor), step.Title, step.Text, () =>
                {
                    S.MarkTip(step.Key);
                    Run(steps, done);
                }, SkipButton);
                return;
            }
            done?.Invoke();
        }

        /// <summary>가리킨 곳을 플레이어가 직접 누르게 한다.</summary>
        private static void Do(string anchor, string text)
        {
            // 열린 팝업이 가리킨 곳을 덮으면 누를 수 없으므로 먼저 닫는다
            GameApp.Instance.Overlay.CloseAll();
            Coach.Action(Anchors.Get(anchor), text, SkipButton);
        }

        private static void Skip()
        {
            GameApp.Instance.Overlay.Confirm("튜토리얼 건너뛰기", "튜토리얼을 끝낼까요? 설정에서 언제든 다시 볼 수 있습니다.", "건너뛰기",
                () => S.SetTutorial(TutorialStage.Done), "계속 보기", ButtonKind.Primary, () => GameApp.Instance.Router.Rebuild());
        }

        // ── 마을 ──

        private static readonly string[] Facilities = { "shop", "guild", "blacksmith", "training" };
        private static readonly string[] FacilityNames = { "상점", "길드", "대장간", "수련장" };

        public static void OnTown()
        {
            if (Stage == TutorialStage.TownGuide)
            {
                Run(new[]
                {
                    Info("town.intro", null, "라브 마을", H("라브 마을") + "이에요. 시설을 하나씩 짧게 둘러볼게요."),
                }, () =>
                {
                    for (int i = 0; i < Facilities.Length; i++)
                    {
                        if (S.TipShown(Facilities[i] + ".done")) continue;
                        Do("town." + Facilities[i], H(FacilityNames[i]) + Josa(FacilityNames[i]) + " 눌러 들어가 보세요.");
                        return;
                    }
                    Do("town.dungeon", H("'던전 입장'") + "을 눌러 첫 모험을 떠나 보세요.");
                });
            }
            else if (Stage == TutorialStage.AfterReturn)
            {
                // 창고 안내는 첫 던전 보스를 잡고 돌아왔을 때만 (v2.4). 쓰러졌거나 보스 전에 돌아왔으면 바로 끝낸다.
                if (S.C.HighestFloorCleared >= 1) Do("town.guild", H("길드") + "에 들러 창고를 확인해 봐요.");
                else Run(new[] { Info("tut.end", null, "튜토리얼 끝", "이제 자유롭게 모험해 보세요! 퀘스트를 받고 장비를 키워 1층 보스부터 도전해요.") }, Finish);
            }
        }

        private static string Josa(string word) => Names.Josa(word, "을/를").Substring(word.Length);

        /// <summary>시설 화면: 각 부분 설명 → 마을로 돌아가기.</summary>
        public static void OnFacility(string facility)
        {
            if (Stage != TutorialStage.TownGuide) return;
            string doneKey = facility + ".done";
            Step[] steps;
            switch (facility)
            {
                case "shop":
                    steps = new[]
                    {
                        Info("shop.1", "shop.equip", "상점", "장비·물약·스킬서를 사고 " + H("'판매'") + " 탭에서 팔아요. 이름 색은 " + H("등급") + ", 아래 줄은 지금 장비보다 " + Good("좋으면 초록") + "이에요."),
                    };
                    break;
                case "guild":
                    steps = new[]
                    {
                        Info("guild.1", "guild.list", "길드", H("퀘스트") + "를 받아 조건을 채우고 보고하면 보상을 받아요. 조건을 채우면 " + Good("등급이 자동으로 올라요") + "."),
                    };
                    break;
                case "blacksmith":
                    steps = new[]
                    {
                        Info("smith.1", "smith.detail", "대장간", "장비를 " + H("강화") + "해요. 실패해도 장비는 " + Good("부서지지 않아요") + ". +6부터는 " + H("강화석") + "이 필요해요."),
                    };
                    break;
                default:
                    steps = new[]
                    {
                        Info("train.1", "train.list", "수련장", "골드로 스킬을 수련하면 " + Good("위력이 올라가요") + ". 새 스킬은 " + H("스킬서") + "로 배워요."),
                    };
                    break;
            }
            Run(steps, () =>
            {
                S.MarkTip(doneKey);
                Do("topbar.back", H("'‹ 마을'") + "을 눌러 마을로 돌아가세요.");
            });
        }

        /// <summary>길드: 마을 안내 중이면 시설 설명, 귀환 후면 창고 안내로 마무리.</summary>
        public static void OnGuild(int tab)
        {
            if (Stage == TutorialStage.TownGuide)
            {
                OnFacility("guild");
                return;
            }
            if (Stage != TutorialStage.AfterReturn) return;
            if (tab != 2)
            {
                Do("tab.2", H("'창고'") + " 탭을 눌러 보세요.");
                return;
            }
            Run(new[]
            {
                Info("storage.1", "guild.storage", "길드 창고", "맡긴 아이템은 던전에서 쓰러져도 " + Good("잃지 않아요") + ". 맡길 때만 " + H("수수료") + "가 들어요."),
                Info("storage.2", null, "튜토리얼 끝", "이제 혼자서도 충분해요! 장비를 키워 " + H("던전 최하층") + "에 도전해 보세요."),
            }, Finish);
        }

        // ── 던전 ──

        public static void OnDungeon()
        {
            if (Stage != TutorialStage.FirstDungeon) return;
            var run = S.Run;
            // 튜토리얼 보스를 잡으면 아래층으로 가지 않고 마을로 돌아간다
            if (run != null && run.BossDefeated && Anchors.Get("dungeon.home") != null)
            {
                Do("dungeon.home", "보스를 쓰러뜨렸어요! 첫 모험은 여기까지예요. " + H("'마을로 귀환한다'") + "를 눌러 돌아가세요.");
                return;
            }
            Run(new[]
            {
                Info("dun.map", "dungeon.map", "미니맵", H("금색") + "이 지금 위치예요. 미니맵을 누르면 전체 지도가 열리고, 탐험을 마친 방으로 " + H("순간이동") + "할 수 있어요."),
            }, () =>
            {
                if (run != null && run.ReturnRoomFound)
                {
                    Run(new[]
                    {
                        Info("dun.return", "dungeon.return", "귀환", H("귀환 마법진") + "을 찾았어요! 이제 " + Good("'귀환'") + " 버튼으로 언제든 마을로 돌아갈 수 있어요."),
                    }, null);
                    return;
                }
                if (!S.TipShown("dun.go") && Anchors.Get("dungeon.choice0") != null)
                {
                    S.MarkTip("dun.go");
                    Do("dungeon.choice0", "아래 " + H("방향키") + "로 갈 길을 골라 보세요. " + H("금색") + "이 새 방이에요.");
                }
            });
        }

        public static void OnBattle()
        {
            if (Stage != TutorialStage.FirstDungeon) return;
            Run(new[]
            {
                Info("bat.2", "battle.choices", "전투", "오른쪽 숫자는 지금 대상에게 " + H("맞을 확률") + ", 아래 줄은 " + H("예상 피해") + "예요. 적을 누르면 대상이 바뀌고, 선택지를 " + H("길게 누르면") + " 자세한 계산을 볼 수 있어요."),
            }, () =>
            {
                if (S.TipShown("bat.3") || Anchors.Get("battle.choice0") == null) return;
                S.MarkTip("bat.3");
                Do("battle.choice0", H("공격") + "을 골라 보세요!");
            });
        }

        /// <summary>보스의 행동 예고를 처음 봤을 때 한 번 (튜토리얼 단계와 관계없이).</summary>
        public static void OnBossIntent()
        {
            if (!S.HasGame || S.TipShown("tip.intent") || Anchors.Get("battle.intent") == null) return;
            Coach.Info(Anchors.Get("battle.intent"), "보스의 예고", "보스 이름 자리에 " + Bad("주황색 '!'") + "가 뜨면 다음 턴에 할 큰 행동이에요. "
                                                               + H("강타 준비") + "면 회복해 두고, " + H("회복 주문") + "이면 그 전에 몰아쳐 쓰러뜨리세요.", () => S.MarkTip("tip.intent"));
        }

        public static void OnLevelUp()
        {
            if (Stage != TutorialStage.FirstDungeon) return;
            Run(new[]
            {
                Info("levelup", "levelup.auto", "레벨 업", H("능력치 포인트") + "를 받았어요. " + H("'자동 배분'") + "을 누르면 직업에 맞게 나눠 줘요."),
            }, null);
        }

        // ── 귀환 후 ──

        public static void OnResult()
        {
            if (Stage != TutorialStage.AfterReturn) return;
            Run(new[]
            {
                Info("res.1", "result.panel", "정산", "마을에 돌아오면 " + Good("HP가 모두 회복") + "돼요. 쓰러지면 " + Bad("골드 일부와 가방 속 아이템을 잃어요") + "."),
            }, () => Do("result.next", "마을로 돌아가세요."));
        }
    }
}

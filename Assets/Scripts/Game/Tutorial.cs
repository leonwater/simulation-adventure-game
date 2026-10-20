using System;
using Adventure.Core;

namespace Adventure.Game
{
    /// <summary>
    /// 직접 해 보며 배우는 튜토리얼. 화면의 한 곳을 밝게 남기고(코치 마크) 말풍선으로 설명한다.
    /// - 마을: 상점 → 길드 → 대장간 → 수련장 순으로 직접 들어가, 화면의 각 부분을 차례로 설명한 뒤 마을로 돌아온다. 마지막에 던전 입장.
    /// - 첫 1층: 미니맵 → 순간이동 → 캐릭터 정보 → 길 고르기 → 전투(대상·확률·공격) → 레벨 업 배분 → 보스를 잡으면 귀환 (아래층으로는 못 감).
    /// - 귀환 후: 정산 → 길드 창고 → 끝.
    /// 본 설명은 TipsShown에 남아 다시 켜도 이어서 진행한다. 처음 튜토리얼에는 건너뛰기가 없고,
    /// 설정에서 다시 볼 때만 화면 오른쪽 위 "건너뛰기"로 끝낼 수 있다. 말풍선의 중요한 말은 금색, 좋고 나쁨은 초록·빨강으로 칠한다.
    /// </summary>
    public static class Tutorial
    {
        private static GameSession S => GameApp.Instance.Session;

        private static TutorialStage Stage => S.HasGame ? S.Data.Tutorial : TutorialStage.Done;

        /// <summary>건너뛰기 버튼은 설정에서 튜토리얼을 다시 볼 때만 (처음 튜토리얼은 끝까지 진행).</summary>
        private static Action SkipButton => S.HasGame && S.Data.TutorialReplay ? (Action)Skip : null;

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
                    Info("town.intro", null, "라브 마을", "던전 입구에 세워진 " + H("라브 마을") + "이에요. 등록을 마쳤으니, 이제 마을 시설을 직접 하나씩 둘러보며 안내해 드릴게요."),
                }, () =>
                {
                    for (int i = 0; i < Facilities.Length; i++)
                    {
                        if (S.TipShown(Facilities[i] + ".done")) continue;
                        Do("town." + Facilities[i], H(FacilityNames[i]) + Josa(FacilityNames[i]) + " 눌러 들어가 보세요.");
                        return;
                    }
                    Do("town.dungeon", "준비가 끝났어요! " + H("'던전 입장'") + "을 눌러 첫 모험을 떠나 보세요. 첫 층은 연습용으로 짧게 준비되어 있어요.");
                });
            }
            else if (Stage == TutorialStage.AfterReturn)
                Do("town.guild", H("길드") + "에 들러 창고를 확인해 봐요.");
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
                        Info("shop.1", "shop.refresh", "상점 · 갱신", "물건은 " + H("30분마다") + " 바뀌어요. 골드를 내고 " + H("'갱신'") + "을 누르면 바로 새 물건으로 바꿀 수도 있어요."),
                        Info("shop.2", "shop.equip", "상점 · 장비", "카드의 " + H("작은 원 색") + "은 물건 종류, 이름 색은 " + H("등급") + "이에요. 아래 줄에 착용 레벨과 지금 장비보다 "
                                                                + Good("+좋아지면 초록") + ", " + Bad("−나빠지면 빨강") + "으로 보여요."),
                        Info("shop.3", "shop.goods", "상점 · 소모품", "물약·해독제·스킬서·가방 확장을 팔아요. " + H("회복 물약") + "은 던전에 꼭 챙겨 가세요."),
                        Info("shop.4", "shop.sell", "상점 · 판매", H("'판매'") + " 탭에서 가방 속 물건을 구매 카드와 같은 모양으로 보고 팔 수 있어요. 던전에서 주운 재료를 골드로 바꾸세요."),
                        Info("shop.5", "topbar.settings", "골드 · 설정", "던전 밖 모든 화면의 오른쪽 위에는 " + H("가진 골드") + "와 " + H("설정") + " 버튼이 있어요."),
                    };
                    break;
                case "guild":
                    steps = new[]
                    {
                        Info("guild.1", "guild.list", "길드 · 퀘스트", "의뢰 카드에 " + H("목표") + "와 " + H("보상(골드·경험치)") + "이 바로 보여요. 수락하고 조건을 채운 뒤 " + H("보고") + "하면 보상을 받아요. 등급이 높을수록 어렵고 보상이 커요."),
                        Info("guild.2", "tabs", "길드 · 탭", H("'등급'") + " 탭에서 승급 조건을 보고 승급하고, " + H("'창고'") + " 탭에서 아이템을 맡겨요."),
                    };
                    break;
                case "blacksmith":
                    steps = new[]
                    {
                        Info("smith.1", "smith.detail", "대장간 · 강화", "고른 장비의 강화 전후 수치, " + H("성공률") + ", 비용이에요. 실패해도 장비는 " + Good("부서지지 않아요") + "."),
                        Info("smith.2", "smith.list", "대장간 · 장비 고르기", "강화할 장비를 고르세요. " + H("+6부터") + "는 던전에서 얻는 " + H("강화석") + "이 필요해요."),
                    };
                    break;
                default:
                    steps = new[]
                    {
                        Info("train.1", "train.list", "수련장", "골드를 내고 스킬을 수련하면 " + Good("위력이 올라가요") + " (" + H("+5까지") + "). 새 스킬은 " + H("스킬서") + "로 배워요."),
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
                Info("storage.1", "guild.storage", "길드 창고", "창고에 맡긴 아이템은 던전에서 쓰러져도 " + Good("잃지 않아요") + ". 아래 가방에서 아이템을 눌러 맡길 수 있어요."),
                Info("storage.2", null, "튜토리얼 끝", "이제 혼자서도 충분해요! 퀘스트를 받고 장비를 키워 " + H("던전 최하층") + "에 도전해 보세요."),
            }, () => S.SetTutorial(TutorialStage.Done));
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
                Info("dun.map", "dungeon.map", "미니맵", H("금색") + "이 지금 위치, 빛나는 칸이 갈 수 있는 방이에요. 방마다 종류를 " + H("아이콘") + "으로 보여 주고, 아직 모르는 방은 " + H("'?'") + "예요. 이벤트로 알게 된 방은 흐리게, " + H("'!'") + "는 이어지는 이벤트예요."),
                Info("dun.teleport", "dungeon.teleport", "순간이동", "미니맵 " + H("오른쪽 아래 지도 버튼") + "을 누르면 층 전체 지도가 열려요. 탐험을 마친 방을 누르면 그곳으로 바로 " + H("순간이동") + "해요. 갈 수 있는 곳이 있으면 버튼이 깜빡여요."),
                Info("dun.info", "dungeon.info", "캐릭터 정보", "아래 가운데 " + H("'정보'") + " 버튼으로 능력치, " + Bad("상태 이상") + "(1턴에 받는 피해), 이벤트로 얻은 " + H("탐험 효과") + "를 볼 수 있어요."),
            }, () =>
            {
                if (run != null && run.ReturnRoomFound)
                {
                    Run(new[]
                    {
                        Info("dun.return", "dungeon.return", "귀환", H("귀환 마법진") + "을 찾았어요! 오른쪽 아래 " + Good("'귀환'") + " 버튼으로 언제든 마을로 돌아갈 수 있어요. 찾기 전에는 버튼이 " + Bad("붉은 회색으로 잠겨") + " 있어요."),
                    }, null);
                    return;
                }
                if (!S.TipShown("dun.go") && Anchors.Get("dungeon.choice0") != null)
                {
                    S.MarkTip("dun.go");
                    Do("dungeon.choice0", "갈 길을 직접 골라 보세요. " + H("금색") + "은 새 방, 푸른색은 탐험한 방, " + Good("초록") + "은 귀환, 보라색은 방 안에서 하는 행동이에요.");
                }
            });
        }

        public static void OnBattle()
        {
            if (Stage != TutorialStage.FirstDungeon) return;
            Run(new[]
            {
                Info("bat.1", "battle.enemy0", "전투 · 대상", "적의 도형을 누르면 공격할 " + H("대상") + "을 바꿀 수 있어요. 금색으로 깜빡이는 적이 지금 대상이에요."),
                Info("bat.status", "battle.player", "전투 · 상태 이상", "도형 아래 작은 태그가 " + Bad("상태 이상") + "이에요. " + H("내 원") + "이나 " + H("대상인 적을 한 번 더") + " 누르면(길게 눌러도 돼요) 상태 이상이 1턴에 주는 피해와 남은 턴을 자세히 볼 수 있어요."),
                Info("bat.2", "battle.choices", "전투 · 선택지", "오른쪽 숫자는 " + H("성공 확률") + ", 아래 줄은 " + H("예상 피해") + "예요. 선택지를 " + H("길게 누르면") + " 피해 계산식과 부가 효과를 볼 수 있어요."),
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
                Info("levelup", "levelup.auto", "레벨 업", "레벨이 오르면 " + H("능력치 포인트") + "를 받아요. " + H("'자동 배분'") + "을 누르면 직업에 맞게 나눠 주고, +로 직접 나눠도 돼요. '나중에'를 누르면 마을의 캐릭터 화면에서 배분할 수 있어요."),
            }, null);
        }

        // ── 귀환 후 ──

        public static void OnResult()
        {
            if (Stage != TutorialStage.AfterReturn) return;
            Run(new[]
            {
                Info("res.1", "result.panel", "정산", "이번 모험의 결과예요. 마을에 돌아오면 " + Good("HP가 모두 회복") + "돼요. 던전에서 쓰러지면 " + Bad("골드 일부와 가방 속 아이템을 잃으니") + " 조심하세요."),
            }, () => Do("result.next", "마을로 돌아가세요."));
        }
    }
}

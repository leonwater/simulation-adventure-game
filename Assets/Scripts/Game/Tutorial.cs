using System;
using Adventure.Core;

namespace Adventure.Game
{
    /// <summary>
    /// 직접 해 보며 배우는 튜토리얼 (수정 사항 #3·#7). 화면의 한 곳을 밝게 남기고(코치 마크) 말풍선으로 설명한다.
    /// - 마을: 상점 → 길드 → 대장간 → 수련장 순으로 직접 들어가, 화면의 각 부분을 차례로 설명한 뒤 마을로 돌아온다. 마지막에 던전 입장.
    /// - 첫 1층: 미니맵 → 길 고르기 → 전투(대상·확률·공격) → 레벨 업 배분 → 귀환 버튼.
    /// - 귀환 후: 정산 → 길드 창고 → 끝.
    /// 본 설명은 TipsShown에 남아 다시 켜도 이어서 진행한다. 말풍선의 "튜토리얼 건너뛰기"로 언제든 끝낼 수 있다.
    /// </summary>
    public static class Tutorial
    {
        private static GameSession S => GameApp.Instance.Session;

        private static TutorialStage Stage => S.HasGame ? S.Data.Tutorial : TutorialStage.Done;

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
                }, Skip);
                return;
            }
            done?.Invoke();
        }

        /// <summary>가리킨 곳을 플레이어가 직접 누르게 한다.</summary>
        private static void Do(string anchor, string text)
        {
            // 열린 팝업이 가리킨 곳을 덮으면 누를 수 없으므로 먼저 닫는다
            GameApp.Instance.Overlay.CloseAll();
            Coach.Action(Anchors.Get(anchor), text, Skip);
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
                    Info("town.intro", null, "등불 마을", "등록을 마쳤어요! 이제 마을 시설을 직접 하나씩 둘러보며 안내해 드릴게요."),
                }, () =>
                {
                    for (int i = 0; i < Facilities.Length; i++)
                    {
                        if (S.TipShown(Facilities[i] + ".done")) continue;
                        Do("town." + Facilities[i], FacilityNames[i] + Josa(FacilityNames[i]) + " 눌러 들어가 보세요.");
                        return;
                    }
                    Do("town.dungeon", "준비가 끝났어요! '던전 입장'을 눌러 첫 모험을 떠나 보세요. 첫 층은 연습용으로 짧게 준비되어 있어요.");
                });
            }
            else if (Stage == TutorialStage.AfterReturn)
                Do("town.guild", "길드에 들러 창고를 확인해 봐요.");
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
                        Info("shop.1", "shop.refresh", "상점 · 갱신", "물건은 30분마다 바뀌어요. 골드를 내면 바로 새 물건으로 바꿀 수도 있어요."),
                        Info("shop.2", "shop.equip", "상점 · 장비", "장비 카드를 누르면 자세한 수치와 지금 낀 장비와의 비교(+초록 / −빨강)가 나와요."),
                        Info("shop.3", "shop.goods", "상점 · 소모품", "물약·해독제·스킬서·가방 확장을 팔아요. 회복 물약은 던전에 꼭 챙겨 가세요."),
                        Info("shop.4", "shop.sell", "상점 · 판매", "가방의 아이템을 눌러 팔 수 있어요. 던전에서 주운 재료를 여기서 골드로 바꾸세요."),
                    };
                    break;
                case "guild":
                    steps = new[]
                    {
                        Info("guild.1", "guild.list", "길드 · 퀘스트", "의뢰를 수락하고 조건을 채운 뒤 보고하면 보수를 받아요. 의뢰를 누르면 자세한 내용이 나와요."),
                        Info("guild.2", "tabs", "길드 · 탭", "'등급' 탭에서 승급 조건을 보고 승급하고, '창고' 탭에서 아이템을 맡겨요."),
                    };
                    break;
                case "blacksmith":
                    steps = new[]
                    {
                        Info("smith.1", "smith.detail", "대장간 · 강화", "고른 장비의 강화 전후 수치, 성공률, 비용이에요. 실패해도 장비는 부서지지 않아요."),
                        Info("smith.2", "smith.list", "대장간 · 장비 고르기", "강화할 장비를 고르세요. +6부터는 던전에서 얻는 강화석이 필요해요."),
                    };
                    break;
                default:
                    steps = new[]
                    {
                        Info("train.1", "train.list", "수련장", "골드를 내고 스킬을 수련하면 위력이 올라가요 (+5까지). 새 스킬은 스킬서로 배워요."),
                    };
                    break;
            }
            Run(steps, () =>
            {
                S.MarkTip(doneKey);
                Do("topbar.back", "'‹ 마을'을 눌러 마을로 돌아가세요.");
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
                Do("tab.2", "'창고' 탭을 눌러 보세요.");
                return;
            }
            Run(new[]
            {
                Info("storage.1", "guild.storage", "길드 창고", "창고에 맡긴 아이템은 던전에서 쓰러져도 잃지 않아요. 아래 가방에서 아이템을 눌러 맡길 수 있어요."),
                Info("storage.2", null, "튜토리얼 끝", "이제 혼자서도 충분해요! 퀘스트를 받고 장비를 키워 던전 최하층에 도전해 보세요."),
            }, () => S.SetTutorial(TutorialStage.Done));
        }

        // ── 던전 ──

        public static void OnDungeon()
        {
            if (Stage != TutorialStage.FirstDungeon) return;
            var run = S.Run;
            Run(new[]
            {
                Info("dun.map", "dungeon.map", "미니맵", "금색이 지금 위치, 빛나는 칸이 갈 수 있는 방이에요. 미니맵을 누르면 전체 지도가 열리고, 탐험한 방으로 바로 순간이동할 수 있어요."),
            }, () =>
            {
                if (run != null && run.ReturnRoomFound)
                {
                    Run(new[]
                    {
                        Info("dun.return", "dungeon.return", "귀환", "귀환 마법진을 찾았어요! 오른쪽 아래 '귀환' 버튼으로 언제든 마을로 돌아갈 수 있어요. 더 탐험해 보스를 쓰러뜨리면 다음 층이 열려요."),
                    }, null);
                    return;
                }
                if (!S.TipShown("dun.go") && Anchors.Get("dungeon.choice0") != null)
                {
                    S.MarkTip("dun.go");
                    Do("dungeon.choice0", "갈 길을 직접 골라 보세요. 처음 가는 방은 들어가기 전까지 무엇이 있는지 알 수 없어요.");
                }
            });
        }

        public static void OnBattle()
        {
            if (Stage != TutorialStage.FirstDungeon) return;
            Run(new[]
            {
                Info("bat.1", "battle.enemy0", "전투 · 대상", "적의 도형을 누르면 공격할 대상을 바꿀 수 있어요. 금색으로 깜빡이는 적이 지금 대상이에요."),
                Info("bat.2", "battle.choices", "전투 · 선택지", "오른쪽 숫자는 성공 확률이에요. 선택지를 길게 누르면 확률이 어떻게 계산됐는지 볼 수 있어요."),
            }, () =>
            {
                if (S.TipShown("bat.3") || Anchors.Get("battle.choice0") == null) return;
                S.MarkTip("bat.3");
                Do("battle.choice0", "공격을 골라 보세요!");
            });
        }

        public static void OnLevelUp()
        {
            if (Stage != TutorialStage.FirstDungeon) return;
            Run(new[]
            {
                Info("levelup", "levelup.auto", "레벨 업", "레벨이 오르면 능력치 포인트를 받아요. '자동 배분'을 누르면 직업에 맞게 나눠 주고, +로 직접 나눠도 돼요. '나중에'를 누르면 마을의 캐릭터 화면에서 배분할 수 있어요."),
            }, null);
        }

        // ── 귀환 후 ──

        public static void OnResult()
        {
            if (Stage != TutorialStage.AfterReturn) return;
            Run(new[]
            {
                Info("res.1", "result.panel", "정산", "이번 모험의 결과예요. 마을에 돌아오면 HP가 모두 회복돼요. 던전에서 쓰러지면 골드 일부와 가방 속 아이템을 잃으니 조심하세요."),
            }, () => Do("result.next", "마을로 돌아가세요."));
        }
    }
}

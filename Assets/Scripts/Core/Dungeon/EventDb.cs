using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>이벤트 결과로 시작하는 전투.</summary>
    public enum EventBattle
    {
        None,
        /// <summary>미믹 기습 (미믹이 먼저 행동).</summary>
        Mimic,
        /// <summary>미믹이지만 기습 없음 (궁수가 멀리서 건드림).</summary>
        MimicNoAmbush,
        /// <summary>속임수가 들통난 도박꾼 고블린들.</summary>
        Gamblers,
        /// <summary>그 층의 일반 전투 (고블린의 지도 실패).</summary>
        Normal,
        /// <summary>떠돌이 모험가 (정예 수치, 이기면 G×4 + 장비 30%).</summary>
        Wanderer,
        /// <summary>고블린 추격대 (정예 1 포함 2~3마리, 보상 ×2).</summary>
        GoblinChase,
        /// <summary>시련의 문: 고른 층의 보스.</summary>
        Trial
    }

    /// <summary>선택지 처리가 특별한 이벤트 (기획서 v1.5).</summary>
    public enum EventSpecial
    {
        None,
        /// <summary>무너지는 보물 더미: 계속 주울수록 함정 확률이 오른다.</summary>
        TreasurePile,
        /// <summary>피의 우물: 최대 HP 10%를 바칠 때마다 경험치, 최대 5번.</summary>
        BloodWell,
        /// <summary>스핑크스의 수수께끼: 3지선다.</summary>
        Sphinx,
        /// <summary>운명의 카드: 대길·길·흉 중 1장.</summary>
        FateCards,
        /// <summary>시련의 문: 이 층·다음 층·다다음 층 보스.</summary>
        TrialGate
    }

    /// <summary>이벤트로 공개하는 방.</summary>
    public enum RevealKind
    {
        None,
        ReturnRoom,
        ReturnAndBoss,
        All,
        /// <summary>2칸 안의 방 (갈림길 표지판).</summary>
        Nearby2
    }

    public enum EventReward
    {
        None,
        Potion,
        HighPotion,
        Equipment,
        HighSkillBook,
        EnhanceStone,
        /// <summary>고급 이상 장비.</summary>
        GoodEquipment,
        /// <summary>소모품 1~2개.</summary>
        Consumables,
        /// <summary>회복 물약 2개.</summary>
        TwoPotions
    }

    /// <summary>선택지 결과. 골드·경험치는 층 기준 몬스터 1마리 보상의 배수.</summary>
    public sealed class EventOutcome
    {
        public string Text;
        public double HpRatio;     // +회복 / −피해 (최대 HP 대비)
        public double GoldMult;    // +획득 / −손실
        public double ExpMult;
        public EventReward Reward;
        public bool ReturnToTown;
        public EventBattle Battle;
        /// <summary>궁수 전용: 상자가 미믹인지 굴려 결과를 정한다.</summary>
        public bool ArcherChest;
        /// <summary>얻는 탐험 효과.</summary>
        public ExploreEffect[] Effects = Array.Empty<ExploreEffect>();
        /// <summary>같은 층의 들어가지 않은 방 하나를 이 후속 이벤트로 바꾼다.</summary>
        public string Chain;
        public RevealKind Reveal;
        /// <summary>공개한 방 중 하나를 틀리게 알려 준다 (말해 주지 않음).</summary>
        public bool RevealWrong;
        /// <summary>이 방 옆에 숨은 보물 방을 만든다.</summary>
        public bool SpawnTreasure;
        /// <summary>이 방과 보스 방을 바로 잇는다.</summary>
        public bool LinkBoss;
        /// <summary>귀환 방을 발견한 것으로 처리한다.</summary>
        public bool FindReturn;
        /// <summary>이 방이 할인 상인(× 0.7)으로 바뀐다.</summary>
        public bool BecomeMerchant;

        public bool StartBattle => Battle != EventBattle.None;
    }

    public sealed class EventChoice
    {
        public string Label;
        /// <summary>선택지 아래 작은 글씨 (예: "HP 20% 소모", "지능 판정").</summary>
        public string Hint;
        /// <summary>판정 능력치. null이면 항상 성공.</summary>
        public Stat? Check;
        /// <summary>직업의 주 공격 능력치로 판정.</summary>
        public bool CheckAttackStat;
        public double FixedChance = 1.0;
        public string RequiresItem;
        public double RequiresGoldMult;
        public EventOutcome Success;
        public EventOutcome Failure;
        /// <summary>-1 = 모든 직업, 그 외 = 이 직업에게만 보이는 선택지.</summary>
        public int JobOnly = -1;
        /// <summary>층 × 이 값만큼 골드를 내야 한다.</summary>
        public int GoldPerFloor;
    }

    public sealed class EventDef
    {
        public string Id;
        public string Title;
        public string Body;
        public EventChoice[] Choices;
        public int Weight = 10;
        public EventSpecial Special;
        /// <summary>연쇄 후속 이벤트 (뽑기에 들어가지 않음).</summary>
        public bool Followup;
        /// <summary>이 층부터 나온다.</summary>
        public int MinFloor = 1;
    }

    /// <summary>던전 특수 이벤트. 일부는 상급 스킬서, 일부는 마을 귀환을 준다.</summary>
    public static class EventDb
    {
        private static EventOutcome O(string text, double hp = 0, double gold = 0, double exp = 0,
            EventReward reward = EventReward.None, bool returnToTown = false, EventBattle battle = EventBattle.None, bool archerChest = false) =>
            new EventOutcome { Text = text, HpRatio = hp, GoldMult = gold, ExpMult = exp, Reward = reward, ReturnToTown = returnToTown, Battle = battle, ArcherChest = archerChest };

        private static ExploreEffect[] Fx(params (ExploreEffectType type, int battles)[] list) =>
            Array.ConvertAll(list, x => new ExploreEffect(x.type, x.battles));

        private static EventChoice Choice(string label, string hint, EventOutcome success, Stat? check = null, EventOutcome failure = null) =>
            new EventChoice { Label = label, Hint = hint, Check = check, Success = success, Failure = failure };

        private static EventChoice Pass(string label = "그냥 지나간다") =>
            new EventChoice { Label = label, Success = O("발걸음을 돌려 다음 방으로 향한다.") };

        public static readonly EventDef[] All =
        {
            new EventDef
            {
                Id = "altar", Title = "피 묻은 제단",
                Body = "어둠 속에 오래된 제단이 서 있다. 표면에 새겨진 문양이 희미하게 빛나고, 제단 위 그릇에는 마른 핏자국이 남아 있다.",
                Choices = new[]
                {
                    new EventChoice { Label = "피를 바친다", Hint = "HP 20% 소모",
                        Success = O("제단이 피를 삼키자 문양이 붉게 타오른다. 몸 안으로 힘이 흘러든다.", hp: -0.2, exp: 4, gold: 3) },
                    new EventChoice { Label = "문양을 해독한다", Hint = "지능 판정", Check = Stat.Intelligence,
                        Success = O("문양 아래 숨겨진 칸에서 낡은 비급서를 찾았다.", reward: EventReward.HighSkillBook),
                        Failure = O("잘못 읽은 문양이 폭발하며 손을 그슬린다.", hp: -0.1) },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "chest", Title = "수상한 상자",
                Body = "통로 한가운데 이끼 낀 상자가 놓여 있다. 경첩이 미세하게 떨리는 것 같기도 하다.",
                Choices = new[]
                {
                    new EventChoice { Label = "상자를 연다", Hint = "행운 판정", Check = Stat.Luck,
                        Success = O("상자 안에는 쓸 만한 장비가 들어 있었다.", reward: EventReward.Equipment, gold: 2),
                        Failure = O("상자가 이빨을 드러냈다. 미믹이다!", battle: EventBattle.Mimic) },
                    new EventChoice { Label = "멀리서 화살로 건드린다", Hint = "궁수 전용 · 판정 없음", JobOnly = (int)Job.Archer,
                        Success = O("", archerChest: true) },
                    new EventChoice { Label = "자물쇠를 살핀다", Hint = "민첩 판정", Check = Stat.Agility,
                        Success = O("함정을 풀고 바닥에 숨겨진 금화를 챙겼다.", gold: 6),
                        Failure = O("바늘 함정이 튀어나왔다.", hp: -0.15) },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "wounded", Title = "쓰러진 모험가",
                Body = "벽에 기대 쓰러진 모험가가 가쁜 숨을 몰아쉰다. 허리춤의 주머니가 묵직해 보인다.",
                Choices = new[]
                {
                    new EventChoice { Label = "회복 물약을 건넨다", Hint = "회복 물약 1개 필요", RequiresItem = "potion",
                        Success = O("기운을 차린 모험가가 고맙다며 금화와 요령을 나눠 준다.", gold: 8, exp: 2) },
                    new EventChoice { Label = "소지품을 뒤진다", Hint = "행운 판정", Check = Stat.Luck,
                        Success = O("모험가가 깨기 전에 금화를 챙겼다.", gold: 4),
                        Failure = O("눈을 뜬 모험가가 화를 내며 지팡이를 휘두른다.", hp: -0.1, gold: -2) },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "spring", Title = "빛나는 샘",
                Body = "푸른빛을 내는 작은 샘이 바위 틈에서 솟아난다. 물맛이 어떨지는 알 수 없다.",
                Choices = new[]
                {
                    new EventChoice { Label = "샘물을 마신다", Hint = "정신 판정", Check = Stat.Spirit,
                        Success = O("차가운 물이 상처를 씻어 낸다. 체력이 모두 회복됐다.", hp: 1.0),
                        Failure = O("물에 섞인 독기가 속을 뒤집는다.", hp: -0.15) },
                    new EventChoice { Label = "병에 담는다",                         Success = O("샘물을 병에 담았다.", reward: EventReward.HighPotion) },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "swordsman", Title = "떠돌이 검객", Weight = 10,
                Body = "모닥불 곁에 앉은 검객이 당신을 훑어본다. \"실력을 보여 준다면 비기를 하나 알려 주지.\"",
                Choices = new[]
                {
                    new EventChoice { Label = "대련을 청한다", Hint = "주 능력치 판정", CheckAttackStat = true,
                        Success = O("검객이 웃으며 낡은 비급서를 건넨다.", reward: EventReward.HighSkillBook),
                        Failure = O("눈 깜짝할 새 바닥에 쓰러졌다.", hp: -0.25) },
                    new EventChoice { Label = "이야기를 듣는다",                         Success = O("던전 깊은 곳의 이야기를 들으며 많은 것을 배웠다.", exp: 3) },
                    Pass("자리를 뜬다"),
                },
            },
            new EventDef
            {
                Id = "rope", Title = "지상으로 이어진 밧줄", Weight = 10,
                Body = "천장의 틈 사이로 굵은 밧줄이 늘어져 있다. 위에서 희미하게 바람 소리가 들린다.",
                Choices = new[]
                {
                    new EventChoice { Label = "밧줄을 타고 올라간다", Hint = "마을로 귀환 · 이번 층 진행 초기화",
                        Success = O("밧줄을 타고 올라가 마을로 돌아왔다.", returnToTown: true) },
                    Pass("무시한다"),
                },
            },
            new EventDef
            {
                Id = "gamble", Title = "도박하는 고블린",
                Body = "주사위를 굴리던 고블린이 손짓한다. \"한 판 할래? 이기면 두 배!\"",
                Choices = new[]
                {
                    new EventChoice { Label = "판돈을 건다", Hint = "골드 필요 · 확률 50%", FixedChance = 0.5, RequiresGoldMult = 5,
                        Success = O("주사위가 당신 편이었다!", gold: 5),
                        Failure = O("고블린이 낄낄대며 판돈을 쓸어 간다.", gold: -5) },
                    new EventChoice { Label = "속임수를 쓴다", Hint = "도적 전용 · 민첩 판정", Check = Stat.Agility, RequiresGoldMult = 5, JobOnly = (int)Job.Rogue,
                        Success = O("주사위를 바꿔치기했다. 판돈의 두 배를 챙겼다!", gold: 10),
                        Failure = O("속임수가 들통났다! 판돈을 빼앗기고 고블린들이 덤벼든다.", gold: -5, battle: EventBattle.Gamblers) },
                    Pass("무시한다"),
                },
            },
            new EventDef
            {
                Id = "rack", Title = "녹슨 무기 거치대",
                Body = "무너진 벽 아래 녹슨 무기 거치대가 있다. 아직 쓸 만한 장비가 단단히 박혀 있다.",
                Choices = new[]
                {
                    new EventChoice { Label = "힘으로 뽑는다", Hint = "힘 판정", Check = Stat.Strength,
                        Success = O("장비를 뽑아냈다.", reward: EventReward.Equipment),
                        Failure = O("거치대가 무너지며 팔을 긁었다.", hp: -0.1) },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "tablet", Title = "고대 석판",
                Body = "벽에 박힌 석판에 알 수 없는 글자가 빼곡하다. 가만히 보고 있으면 마음이 차분해진다.",
                Choices = new[]
                {
                    new EventChoice { Label = "글자를 읽는다", Hint = "지능 판정", Check = Stat.Intelligence,
                        Success = O("고대의 전투 기록을 읽고 깨달음을 얻었다.", exp: 6),
                        Failure = O("머리가 깨질 듯 아프다.", hp: -0.1) },
                    new EventChoice { Label = "마력을 불어넣는다", Hint = "마법사 전용 · 판정 없음", JobOnly = (int)Job.Mage,
                        Success = O("석판의 글자가 빛나며 머릿속으로 흘러든다. 고대의 전투 기록을 깨우쳤다.", exp: 6) },
                    new EventChoice { Label = "명상한다", Hint = "정신 판정", Check = Stat.Spirit,
                        Success = O("호흡을 고르자 상처가 아문다.", hp: 0.5),
                        Failure = O("잡념만 가득하다.") },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "ceiling", Title = "무너지는 천장",
                Body = "발을 딛는 순간 천장에서 돌가루가 쏟아진다. 곧 무너질 것 같다!",
                Choices = new[]
                {
                    new EventChoice { Label = "몸을 날려 피한다", Hint = "민첩 판정", Check = Stat.Agility,
                        Success = O("아슬아슬하게 빠져나왔다."),
                        Failure = O("돌덩이에 깔렸다.", hp: -0.2) },
                    new EventChoice { Label = "몸으로 버틴다", Hint = "체력 판정", Check = Stat.Vitality,
                        Success = O("떨어지는 돌을 버텨 냈다."),
                        Failure = O("버티지 못하고 쓰러졌다.", hp: -0.15) },
                    new EventChoice { Label = "몸으로 받아낸다", Hint = "전사 전용 · HP 8% 소모", JobOnly = (int)Job.Warrior,
                        Success = O("어깨로 돌덩이를 받아 내고 그대로 걸어 나왔다.", hp: -0.08) },
                },
            },
            new EventDef
            {
                Id = "vein", Title = "빛나는 광맥", MinFloor = GameBalance.StoneFirstFloor,
                Body = "바위 틈에서 은은하게 빛나는 광석이 보인다. 대장장이가 반길 만한 물건이다.",
                Choices = new[]
                {
                    new EventChoice { Label = "캐낸다", Hint = "체력 판정", Check = Stat.Vitality,
                        Success = O("강화석을 캐냈다.", reward: EventReward.EnhanceStone),
                        Failure = O("곡괭이질에 손목을 삐었다.", hp: -0.1) },
                    Pass(),
                },
            },

            // ── v1.5 아이템 사용 ──
            new EventDef
            {
                Id = "evt_poison_fog", Title = "독 안개 통로",
                Body = "초록빛 안개가 낮게 깔린 통로다. 숨을 들이켜기만 해도 목이 따끔거린다. 안개 너머로 누군가 떨어뜨린 주머니가 보인다.",
                Choices = new[]
                {
                    new EventChoice { Label = "해독제를 먹고 지나간다", Hint = "해독제 1개 소모", RequiresItem = "antidote",
                        Success = O("해독제 덕분에 무사히 지나 주머니를 챙겼다.", gold: 2) },
                    Choice("숨 참고 달린다", "체력 판정", O("숨이 턱까지 찼지만 주머니를 낚아채 빠져나왔다.", gold: 2), Stat.Vitality,
                        O("주머니는 챙겼지만 안개를 들이마셨다.", hp: -0.15, gold: 2)),
                    Pass("되돌아간다"),
                },
            },
            new EventDef
            {
                Id = "evt_lantern_keeper", Title = "꺼진 등불의 문지기",
                Body = "꺼진 등불을 든 유령 문지기가 길을 막는다. \"불을 밝혀 주는 자에게 숨겨진 방을 보여 주지.\"",
                Choices = new[]
                {
                    new EventChoice { Label = "골드를 바친다", Hint = "층 × 30G", GoldPerFloor = 30,
                        Success = new EventOutcome { Text = "문지기가 벽을 두드리자 숨겨진 방이 드러났다.", SpawnTreasure = true } },
                    Choice("등불을 대신 켠다", "정신 판정", new EventOutcome { Text = "등불에 다시 빛이 돌자 숨겨진 방이 드러났다.", SpawnTreasure = true }, Stat.Spirit,
                        new EventOutcome { Text = "불길이 손을 핥았다. 그래도 숨겨진 방은 드러났다.", HpRatio = -0.1, SpawnTreasure = true }),
                    Pass(),
                },
            },

            // ── v1.5 탐험 효과 ──
            new EventDef
            {
                Id = "evt_blessed_shrine", Title = "축복의 성소",
                Body = "작은 성소에 은은한 빛이 고여 있다. 기도하는 이에게 축복을 내린다고 한다.",
                Choices = new[]
                {
                    Choice("기도한다", "정신 판정", new EventOutcome { Text = "따뜻한 빛이 몸을 감싼다. (재생: 전투 3회)", Effects = Fx((ExploreEffectType.Regen, 3)) }, Stat.Spirit,
                        O("기도는 닿지 않은 듯하다.")),
                    new EventChoice { Label = "공양한다", Hint = "층 × 20G", GoldPerFloor = 20,
                        Success = new EventOutcome { Text = "공양을 받은 성소가 빛난다. (재생: 전투 2회)", Effects = Fx((ExploreEffectType.Regen, 2)) } },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "evt_war_drum", Title = "전쟁의 북",
                Body = "가죽이 팽팽한 커다란 북이 놓여 있다. 치면 피가 끓어오르겠지만, 소리가 멀리 퍼질 것이다.",
                Choices = new[]
                {
                    new EventChoice { Label = "친다",                         Success = new EventOutcome { Text = "둥, 둥! 정신이 날카로워진다. 어딘가에서 발소리가 다가온다.", Effects = Fx((ExploreEffectType.Focus, 2), (ExploreEffectType.Drum, 1)) } },
                    Choice("북을 부순다", "힘 판정", O("북을 부수자 마음이 후련하다.", exp: 3), Stat.Strength, O("북채가 튕겨 나와 이마를 때렸다.", hp: -0.1)),
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "evt_demon_whisper", Title = "악마의 속삭임",
                Body = "어둠 속에서 달콤한 목소리가 들린다. \"힘을 주마. 대가는… 조금만 아프면 된다.\"",
                Choices = new[]
                {
                    new EventChoice { Label = "받아들인다",                         Success = new EventOutcome { Text = "검은 힘이 팔을 타고 흐른다. (악마의 계약)", Effects = Fx((ExploreEffectType.DemonPact, -1)) } },
                    Choice("거절한다", "정신 판정", O("목소리를 떨쳐 내자 머리가 맑아졌다.", exp: 3), Stat.Spirit,
                        new EventOutcome { Text = "목소리가 귓가에 남아 떠나지 않는다. (공포: 전투 1회)", Effects = Fx((ExploreEffectType.Fear, 1)) }),
                },
            },
            new EventDef
            {
                Id = "evt_cursed_skull", Title = "저주받은 해골",
                Body = "금화를 입에 문 해골이 제단 위에 놓여 있다. 손대면 좋지 않은 일이 생길 것 같다.",
                Choices = new[]
                {
                    new EventChoice { Label = "만진다",                         Success = new EventOutcome { Text = "금화를 챙기자 등 뒤가 서늘해진다. (저주)", GoldMult = 6, Effects = Fx((ExploreEffectType.Curse, -1)) } },
                    Choice("정화한다", "정신 판정", O("해골이 잿빛 가루가 되고 금화만 남았다.", gold: 3), Stat.Spirit,
                        new EventOutcome { Text = "정화에 실패했다. 금화는 챙겼지만 저주가 따라붙었다.", GoldMult = 3, Effects = Fx((ExploreEffectType.Curse, -1)) }),
                    Pass(),
                },
            },

            // ── v1.5 연쇄 ──
            new EventDef
            {
                Id = "evt_wounded_merchant", Title = "다친 상인",
                Body = "짐을 진 상인이 다리를 다쳐 주저앉아 있다. \"물약… 하나만 나눠 주시겠소?\"",
                Choices = new[]
                {
                    new EventChoice { Label = "물약을 건넨다", Hint = "회복 물약 1개 필요", RequiresItem = "potion",
                        Success = new EventOutcome { Text = "\"이 은혜는 잊지 않겠소!\" 상인은 절뚝이며 앞쪽 방으로 사라졌다.", Chain = "evt_merchant_reward" } },
                    new EventChoice { Label = "무시한다", Success = new EventOutcome { Text = "등 뒤로 신음이 멀어진다.", Chain = "evt_merchant_corpse" } },
                },
            },
            new EventDef
            {
                Id = "evt_captive", Title = "갇힌 포로",
                Body = "쇠사슬에 묶인 모험가가 손짓한다. \"풀어 주면 귀환 마법진이 어디 있는지 알려 주겠소!\"",
                Choices = new[]
                {
                    Choice("풀어 준다", "힘 판정", new EventOutcome { Text = "사슬이 끊어졌다. 포로가 귀환 방의 위치를 알려 주고 앞서 달려갔다.", Reveal = RevealKind.ReturnRoom, Chain = "evt_captive_reward" }, Stat.Strength,
                        O("사슬을 당기다 손을 다쳤다. 포로는 고개를 떨군다.", hp: -0.1)),
                    Pass("그냥 둔다"),
                },
            },
            new EventDef
            {
                Id = "evt_goblin_map", Title = "고블린의 지도",
                Body = "고블린 무리가 모닥불 옆에서 지도를 펼쳐 놓고 잠들어 있다. 조용히 가져갈 수 있을까?",
                Choices = new[]
                {
                    Choice("훔친다", "민첩 판정", new EventOutcome { Text = "지도를 손에 넣었다! 층 전체가 보인다. 뒤에서 고블린들이 깨어나는 소리가 난다.", Reveal = RevealKind.All, Chain = "evt_goblin_chase" }, Stat.Agility,
                        new EventOutcome { Text = "발을 헛디뎠다! 고블린들이 벌떡 일어난다.", HpRatio = -0.1, Battle = EventBattle.Normal }),
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "evt_merchant_reward", Title = "상인의 보답", Followup = true,
                Body = "아까 그 상인이 짐을 풀고 기다리고 있다. \"생명의 은인에게는 특별 가격이오!\"",
                Choices = new[]
                {
                    new EventChoice { Label = "보답을 받는다",                         Success = new EventOutcome { Text = "상인이 물약 두 병을 쥐여 준다. \"필요한 게 있으면 언제든 오시오.\"", Reward = EventReward.TwoPotions, BecomeMerchant = true } },
                },
            },
            new EventDef
            {
                Id = "evt_merchant_corpse", Title = "상인의 시체", Followup = true,
                Body = "아까 그 상인이 쓰러져 있다. 몬스터에게 당한 모양이다. 짐 꾸러미가 흩어져 있다.",
                Choices = new[]
                {
                    Choice("짐을 뒤진다", "행운 판정", new EventOutcome { Text = "쓸 만한 물건과 골드를 찾았다.", GoldMult = 4, Reward = EventReward.Consumables }, Stat.Luck,
                        O("짐 속에 숨어 있던 독거미에게 물렸다.", hp: -0.1)),
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "evt_captive_reward", Title = "포로의 보답", Followup = true,
                Body = "풀어 준 모험가가 기다리고 있었다. \"덕분에 살았소. 이건 내 몫이오.\"",
                Choices = new[]
                {
                    new EventChoice { Label = "받는다", Success = O("모험가가 장비와 골드를 건넸다.", gold: 2, reward: EventReward.Equipment) },
                },
            },
            new EventDef
            {
                Id = "evt_goblin_chase", Title = "고블린 추격대", Followup = true,
                Body = "지도를 되찾으려는 고블린 추격대가 길을 막았다! 우두머리가 소리친다. \"도둑을 잡아라!\"",
                Choices = new[]
                {
                    new EventChoice { Label = "맞서 싸운다", Hint = "정예 포함 2~3마리와 전투",
                        Success = new EventOutcome { Text = "추격대가 달려든다!", Battle = EventBattle.GoblinChase } },
                },
            },

            // ── v1.5 욕심 부리기 ──
            new EventDef
            {
                Id = "evt_treasure_pile", Title = "무너지는 보물 더미", Special = EventSpecial.TreasurePile,
                Body = "천장까지 쌓인 금화 더미가 위태롭게 흔들린다. 하나씩 집을 때마다 더미가 더 크게 흔들린다.",
                Choices = new[]
                {
                    new EventChoice { Label = "줍는다", Success = O("") },
                    new EventChoice { Label = "멈춘다", Success = O("") },
                },
            },
            new EventDef
            {
                Id = "evt_blood_well", Title = "피의 우물", Special = EventSpecial.BloodWell,
                Body = "붉은 물이 고인 우물에서 속삭임이 들린다. \"피를 바쳐라. 바칠수록 깨달음이 깊어지리라.\"",
                Choices = new[]
                {
                    new EventChoice { Label = "피를 바친다", Success = O("") },
                    new EventChoice { Label = "멈춘다", Success = O("") },
                },
            },

            // ── v1.5 지도 ──
            new EventDef
            {
                Id = "evt_torn_map", Title = "찢어진 지도",
                Body = "바닥에 이 층의 지도가 떨어져 있다. 귀퉁이가 찢어졌지만 알아볼 만하다.",
                Choices = new[]
                {
                    new EventChoice { Label = "펼쳐 본다", Success = new EventOutcome { Text = "지도를 따라 층 전체의 방이 머릿속에 그려진다.", Reveal = RevealKind.All } },
                    new EventChoice { Label = "판다", Success = O("지도를 상인용으로 접어 두었다. 꽤 값이 나가겠다.", gold: 3) },
                },
            },
            new EventDef
            {
                Id = "evt_signpost", Title = "갈림길 표지판",
                Body = "낡은 표지판에 주변 방의 이름이 새겨져 있다. 글씨가 많이 닳았다.",
                Choices = new[]
                {
                    Choice("읽는다", "지능 판정 · 2칸 안의 방 공개", new EventOutcome { Text = "표지판을 읽고 주변 방들을 알아냈다.", Reveal = RevealKind.Nearby2 }, Stat.Intelligence,
                        new EventOutcome { Text = "닳은 글씨를 겨우 읽었다. 주변 방들을 알아낸 것 같다.", Reveal = RevealKind.Nearby2, RevealWrong = true }),
                    Pass(),
                },
            },

            // ── v1.5 기타 ──
            new EventDef
            {
                Id = "evt_sphinx", Title = "스핑크스의 수수께끼", Special = EventSpecial.Sphinx,
                Body = "돌로 된 스핑크스가 눈을 뜬다. \"답하라, 모험가여. 맞히면 보상을, 틀리면 벌을 주리라.\"",
                Choices = new[]
                {
                    new EventChoice { Label = "", Success = O("") },
                    new EventChoice { Label = "", Success = O("") },
                    new EventChoice { Label = "", Success = O("") },
                    Pass("대답하지 않고 지나간다"),
                },
            },
            new EventDef
            {
                Id = "evt_fate_cards", Title = "운명의 카드", Special = EventSpecial.FateCards,
                Body = "탁자 위에 카드 세 장이 뒤집혀 있다. 대길, 길, 흉이 하나씩. 한 장만 고를 수 있다.",
                Choices = new[]
                {
                    new EventChoice { Label = "첫 번째 카드", Success = O("") },
                    new EventChoice { Label = "두 번째 카드", Success = O("") },
                    new EventChoice { Label = "세 번째 카드", Success = O("") },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "evt_goddess_statue", Title = "여신상",
                Body = "자애로운 표정의 여신상 앞에 헌금함이 놓여 있다. 바친 만큼 축복이 내린다고 한다.",
                Choices = new[]
                {
                    new EventChoice { Label = "조금 기부한다", Hint = "층 × 20G", GoldPerFloor = 20, Success = O("따뜻한 빛이 상처를 어루만진다.", hp: 0.3) },
                    new EventChoice { Label = "넉넉히 기부한다", Hint = "층 × 50G", GoldPerFloor = 50,
                        Success = new EventOutcome { Text = "온몸이 빛으로 가득 찬다. (재생: 전투 1회)", HpRatio = 1.0, Effects = Fx((ExploreEffectType.Regen, 1)) } },
                    new EventChoice { Label = "아낌없이 기부한다", Hint = "층 × 120G", GoldPerFloor = 120,
                        Success = new EventOutcome { Text = "여신상의 손에서 빛나는 장비가 떨어졌다! (재생: 전투 1회)", HpRatio = 1.0, Effects = Fx((ExploreEffectType.Regen, 1)), Reward = EventReward.GoodEquipment } },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "evt_campfire", Title = "모닥불의 모험가",
                Body = "모닥불 곁에 낯선 모험가가 앉아 있다. \"같이 쉬어 가겠소? 정보도 팔고 있소.\"",
                Choices = new[]
                {
                    new EventChoice { Label = "함께 쉰다", Success = O("모닥불 곁에서 잠시 숨을 돌렸다.", hp: 0.3) },
                    new EventChoice { Label = "정보를 산다", Hint = "층 × 20G", GoldPerFloor = 20,
                        Success = new EventOutcome { Text = "모험가가 지도에 귀환 방과 보스 방을 표시해 준다.", Reveal = RevealKind.ReturnAndBoss } },
                    new EventChoice { Label = "약탈한다", Hint = "떠돌이 모험가(정예)와 전투",
                        Success = new EventOutcome { Text = "모험가가 검을 뽑아 든다. \"후회하게 될 거요!\"", Battle = EventBattle.Wanderer } },
                },
            },
            new EventDef
            {
                Id = "evt_dog_hole", Title = "개구멍", Weight = 5,
                Body = "벽 아래에 겨우 기어 들어갈 만한 구멍이 두 개 있다. 한쪽에서는 짐승 냄새가, 다른 쪽에서는 마력의 기운이 느껴진다.",
                Choices = new[]
                {
                    new EventChoice { Label = "보스 방 쪽으로 기어간다",                         Success = new EventOutcome { Text = "좁은 굴을 지나자 보스 방으로 이어진 길이 열렸다.", LinkBoss = true } },
                    new EventChoice { Label = "귀환 방 쪽으로 기어간다",                         Success = new EventOutcome { Text = "굴 끝에서 귀환 마법진의 빛을 확인했다. 이제 언제든 돌아갈 수 있다.", FindReturn = true } },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "evt_trial_gate", Title = "시련의 문", Weight = 3, MinFloor = 3, Special = EventSpecial.TrialGate,
                Body = "룬이 새겨진 거대한 문이 서 있다. 문 너머에서 더 깊은 층의 주인들이 기다린다. 이기면 그 층까지 단숨에 돌파할 수 있다.",
                Choices = new[]
                {
                    new EventChoice { Label = "이 층의 시련", Success = new EventOutcome { Battle = EventBattle.Trial } },
                    new EventChoice { Label = "다음 층의 시련", Success = new EventOutcome { Battle = EventBattle.Trial } },
                    new EventChoice { Label = "다다음 층의 시련", Success = new EventOutcome { Battle = EventBattle.Trial } },
                    Pass("문을 지나친다"),
                },
            },
        };

        private static readonly Dictionary<string, EventDef> ById = new Dictionary<string, EventDef>();

        static EventDb()
        {
            foreach (var e in All) ById[e.Id] = e;
        }

        public static EventDef Get(string id) => id != null && ById.TryGetValue(id, out var e) ? e : null;

        /// <summary>
        /// 이벤트 뽑기: 가중치(기본 10 · 개구멍 5 · 시련의 문 3), 연쇄 후속 제외, 등장 층 미만 제외,
        /// 한 층에 같은 이벤트는 한 번만 (used에 이미 고른 Id).
        /// </summary>
        public static EventDef PickEvent(Rng rng, int floor = 1, ICollection<string> used = null)
        {
            var weights = new int[All.Length];
            int total = 0;
            for (int i = 0; i < All.Length; i++)
            {
                var e = All[i];
                bool ok = !e.Followup && floor >= e.MinFloor && (used == null || !used.Contains(e.Id));
                weights[i] = ok ? e.Weight : 0;
                total += weights[i];
            }
            if (total == 0)
                for (int i = 0; i < All.Length; i++) weights[i] = All[i].Followup ? 0 : 1;
            return All[rng.PickWeighted(weights)];
        }
    }
}

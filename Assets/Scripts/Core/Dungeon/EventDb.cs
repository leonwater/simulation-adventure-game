using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    public enum EventReward
    {
        None,
        Potion,
        HighPotion,
        Equipment,
        HighSkillBook,
        EnhanceStone
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
        public bool StartBattle;   // 엘리트 전투 시작
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
    }

    public sealed class EventDef
    {
        public string Id;
        public string Title;
        public string Body;
        public string Illustration;
        public EventChoice[] Choices;
        public int Weight = 10;
    }

    /// <summary>던전 특수 이벤트. 일부는 상급 스킬서, 일부는 마을 귀환을 준다.</summary>
    public static class EventDb
    {
        private static EventOutcome O(string text, double hp = 0, double gold = 0, double exp = 0,
            EventReward reward = EventReward.None, bool returnToTown = false, bool battle = false) =>
            new EventOutcome { Text = text, HpRatio = hp, GoldMult = gold, ExpMult = exp, Reward = reward, ReturnToTown = returnToTown, StartBattle = battle };

        private static EventChoice Pass(string label = "그냥 지나간다") =>
            new EventChoice { Label = label, Success = O("발걸음을 돌려 다음 방으로 향한다.") };

        public static readonly EventDef[] All =
        {
            new EventDef
            {
                Id = "altar", Title = "피 묻은 제단", Illustration = "버려진 제단",
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
                Id = "chest", Title = "수상한 상자", Illustration = "이끼 낀 상자",
                Body = "통로 한가운데 이끼 낀 상자가 놓여 있다. 경첩이 미세하게 떨리는 것 같기도 하다.",
                Choices = new[]
                {
                    new EventChoice { Label = "상자를 연다", Hint = "행운 판정", Check = Stat.Luck,
                        Success = O("상자 안에는 쓸 만한 장비가 들어 있었다.", reward: EventReward.Equipment, gold: 2),
                        Failure = O("상자가 이빨을 드러냈다. 미믹이다!", battle: true) },
                    new EventChoice { Label = "자물쇠를 살핀다", Hint = "민첩 판정", Check = Stat.Agility,
                        Success = O("함정을 풀고 바닥에 숨겨진 금화를 챙겼다.", gold: 6),
                        Failure = O("바늘 함정이 튀어나왔다.", hp: -0.15) },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "wounded", Title = "쓰러진 모험가", Illustration = "쓰러진 모험가",
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
                Id = "spring", Title = "빛나는 샘", Illustration = "빛나는 샘",
                Body = "푸른빛을 내는 작은 샘이 바위 틈에서 솟아난다. 물맛이 어떨지는 알 수 없다.",
                Choices = new[]
                {
                    new EventChoice { Label = "샘물을 마신다", Hint = "정신 판정", Check = Stat.Spirit,
                        Success = O("차가운 물이 상처를 씻어 낸다. 체력이 모두 회복됐다.", hp: 1.0),
                        Failure = O("물에 섞인 독기가 속을 뒤집는다.", hp: -0.15) },
                    new EventChoice { Label = "병에 담는다", Hint = "고급 회복 물약 1개",
                        Success = O("샘물을 병에 담았다.", reward: EventReward.HighPotion) },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "swordsman", Title = "떠돌이 검객", Illustration = "떠돌이 검객", Weight = 6,
                Body = "모닥불 곁에 앉은 검객이 당신을 훑어본다. \"실력을 보여 준다면 비기를 하나 알려 주지.\"",
                Choices = new[]
                {
                    new EventChoice { Label = "대련을 청한다", Hint = "주 능력치 판정", CheckAttackStat = true,
                        Success = O("검객이 웃으며 낡은 비급서를 건넨다.", reward: EventReward.HighSkillBook),
                        Failure = O("눈 깜짝할 새 바닥에 쓰러졌다.", hp: -0.25) },
                    new EventChoice { Label = "이야기를 듣는다", Hint = "경험치",
                        Success = O("던전 깊은 곳의 이야기를 들으며 많은 것을 배웠다.", exp: 3) },
                    Pass("자리를 뜬다"),
                },
            },
            new EventDef
            {
                Id = "rope", Title = "지상으로 이어진 밧줄", Illustration = "늘어진 밧줄", Weight = 6,
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
                Id = "gamble", Title = "도박하는 고블린", Illustration = "도박하는 고블린",
                Body = "주사위를 굴리던 고블린이 손짓한다. \"한 판 할래? 이기면 두 배!\"",
                Choices = new[]
                {
                    new EventChoice { Label = "판돈을 건다", Hint = "골드 필요 · 확률 50%", FixedChance = 0.5, RequiresGoldMult = 5,
                        Success = O("주사위가 당신 편이었다!", gold: 5),
                        Failure = O("고블린이 낄낄대며 판돈을 쓸어 간다.", gold: -5) },
                    Pass("무시한다"),
                },
            },
            new EventDef
            {
                Id = "rack", Title = "녹슨 무기 거치대", Illustration = "무기 거치대",
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
                Id = "tablet", Title = "고대 석판", Illustration = "고대 석판",
                Body = "벽에 박힌 석판에 알 수 없는 글자가 빼곡하다. 가만히 보고 있으면 마음이 차분해진다.",
                Choices = new[]
                {
                    new EventChoice { Label = "글자를 읽는다", Hint = "지능 판정", Check = Stat.Intelligence,
                        Success = O("고대의 전투 기록을 읽고 깨달음을 얻었다.", exp: 6),
                        Failure = O("머리가 깨질 듯 아프다.", hp: -0.1) },
                    new EventChoice { Label = "명상한다", Hint = "정신 판정", Check = Stat.Spirit,
                        Success = O("호흡을 고르자 상처가 아문다.", hp: 0.5),
                        Failure = O("잡념만 가득하다.") },
                    Pass(),
                },
            },
            new EventDef
            {
                Id = "ceiling", Title = "무너지는 천장", Illustration = "무너지는 천장",
                Body = "발을 딛는 순간 천장에서 돌가루가 쏟아진다. 곧 무너질 것 같다!",
                Choices = new[]
                {
                    new EventChoice { Label = "몸을 날려 피한다", Hint = "민첩 판정", Check = Stat.Agility,
                        Success = O("아슬아슬하게 빠져나왔다."),
                        Failure = O("돌덩이에 깔렸다.", hp: -0.2) },
                    new EventChoice { Label = "몸으로 버틴다", Hint = "체력 판정", Check = Stat.Vitality,
                        Success = O("떨어지는 돌을 버텨 냈다."),
                        Failure = O("버티지 못하고 쓰러졌다.", hp: -0.15) },
                },
            },
            new EventDef
            {
                Id = "vein", Title = "빛나는 광맥", Illustration = "빛나는 광맥",
                Body = "바위 틈에서 은은하게 빛나는 광석이 보인다. 대장장이가 반길 만한 물건이다.",
                Choices = new[]
                {
                    new EventChoice { Label = "캐낸다", Hint = "체력 판정", Check = Stat.Vitality,
                        Success = O("강화석을 캐냈다.", reward: EventReward.EnhanceStone),
                        Failure = O("곡괭이질에 손목을 삐었다.", hp: -0.1) },
                    Pass(),
                },
            },
        };

        private static readonly Dictionary<string, EventDef> ById = new Dictionary<string, EventDef>();

        static EventDb()
        {
            foreach (var e in All) ById[e.Id] = e;
        }

        public static EventDef Get(string id) => id != null && ById.TryGetValue(id, out var e) ? e : null;

        public static EventDef PickEvent(Rng rng)
        {
            var weights = new int[All.Length];
            for (int i = 0; i < All.Length; i++) weights[i] = All[i].Weight;
            return All[rng.PickWeighted(weights)];
        }
    }
}

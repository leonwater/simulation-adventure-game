using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    public class EventResult
    {
        public bool Success;
        public string Text = "";
        public int HpChange;
        public LootReport Loot = new LootReport();
        public bool ReturnToTown;
        public EventBattle Battle;
        /// <summary>같은 이벤트가 이어진다 (보물 더미·피의 우물에서 다시 고르기).</summary>
        public bool Continues;
        /// <summary>시련의 문에서 고른 보스 층.</summary>
        public int TrialFloor;

        public bool StartBattle => Battle != EventBattle.None;
    }

    /// <summary>스핑크스의 수수께끼: [문제, 정답, 오답, 오답] (화면에서는 방 시드로 섞는다).</summary>
    public static class Riddles
    {
        public static readonly string[][] All =
        {
            new[] { "아침에는 네 발, 점심에는 두 발, 저녁에는 세 발로 걷는 것은?", "사람", "고양이", "시계" },
            new[] { "이름을 부르는 순간 깨지는 것은?", "침묵", "거울", "약속" },
            new[] { "깨뜨려야 쓸 수 있는 것은?", "달걀", "유리병", "얼음" },
            new[] { "날개 없이 날고, 눈 없이 우는 것은?", "구름", "박쥐", "바람개비" },
            new[] { "많아질수록 보이지 않는 것은?", "어둠", "별", "안개" },
            new[] { "가져갈수록 커지는 것은?", "구덩이", "주머니", "그림자" },
        };
    }

    /// <summary>특수 이벤트 선택지 처리. 성공률 = 65% + (능력치 − 요구치) × 3% + 행운 × 0.5% (25~95%).</summary>
    public static class EventRules
    {
        public static Stat? CheckStat(EventChoice choice, Character c) =>
            choice.CheckAttackStat ? c.JobData.AttackStat : choice.Check;

        /// <summary>이 캐릭터에게 보이는 선택지 (직업 전용 선택지 포함). 원래 번호를 함께 돌려준다.</summary>
        public static List<int> VisibleChoices(EventDef def, Character c, DungeonRun run = null)
        {
            var list = new List<int>();
            for (int i = 0; i < def.Choices.Length; i++)
            {
                if (def.Choices[i].JobOnly >= 0 && def.Choices[i].JobOnly != (int)c.Job) continue;
                if (run != null && def.Special == EventSpecial.TrialGate && i < 3)
                {
                    // 이미 잡은 이 층 보스, 30층을 넘는 시련은 보이지 않는다
                    if (i == 0 && run.BossDefeated) continue;
                    if (run.Floor + i > GameBalance.MaxFloor) continue;
                }
                if (run != null && def.Special == EventSpecial.Sphinx && i == SphinxRemoved(run, c)) continue;
                list.Add(i);
            }
            return list;
        }

        // ── 특별한 이벤트의 선택지 글자 ──

        /// <summary>선택지 이름 (스핑크스 답·카드·시련의 보스처럼 상황에 따라 바뀌는 것 포함).</summary>
        public static string Label(EventDef def, int index, DungeonRun run, Character c)
        {
            var room = run?.Current;
            switch (def.Special)
            {
                case EventSpecial.Sphinx when index < 3 && room != null:
                    return SphinxAnswers(room)[index];
                case EventSpecial.FateCards when index < 3 && room != null:
                    int peek = FatePeek(room, c, run.Floor);
                    return def.Choices[index].Label + (peek == index ? " (" + FateName(FateOrder(room)[index]) + ")" : "");
                case EventSpecial.TrialGate when index < 3 && run != null:
                    return def.Choices[index].Label + " · " + TrialBossName(run.Floor + index);
            }
            return def.Choices[index].Label;
        }

        /// <summary>이벤트 본문 (스핑크스는 문제를 덧붙인다).</summary>
        public static string Body(EventDef def, DungeonRun run, Character c)
        {
            if (def.Special == EventSpecial.Sphinx && run?.Current != null)
            {
                string q = "\n\n\"" + SphinxRiddle(run.Current)[0] + "\"";
                if (SphinxRemoved(run, c) >= 0) q += "\n(지능 덕분에 틀린 답 하나가 보인다.)";
                return def.Body + q;
            }
            if (def.Special == EventSpecial.FateCards && run?.Current != null && FatePeek(run.Current, c, run.Floor) >= 0)
                return def.Body + "\n\n(행운 덕분에 카드 한 장이 살짝 보인다.)";
            return def.Body;
        }

        public static string SpecialHint(EventDef def, int index, DungeonRun run, Character c)
        {
            var room = run?.Current;
            if (room == null) return null;
            switch (def.Special)
            {
                case EventSpecial.TreasurePile:
                    if (index == 0) return "골드 +" + GoldAmount(2, run.Floor).ToString("#,0") + " · 함정 " + Math.Round(TrapChance(room.EventStep, c) * 100) + "% · 모은 골드 " + room.EventBank.ToString("#,0") + "G";
                    return room.EventBank.ToString("#,0") + "G 챙기기";
                case EventSpecial.BloodWell:
                    if (index == 0)
                        return room.EventStep >= BloodRewards.Length ? "더 바칠 수 없다"
                            : "최대 HP 10% 소모 · 경험치 +" + ((long)Math.Round(GameBalance.EnemyExp(run.Floor) * BloodRewards[room.EventStep])).ToString("#,0") + " · " + (room.EventStep + 1) + "/" + BloodRewards.Length + "번째";
                    return "지금까지 " + room.EventStep + "번 바침";
                case EventSpecial.Sphinx when index < 3:
                    return "정답: 경험치 + 장비 · 오답: HP −15%";
                case EventSpecial.FateCards when index < 3:
                    return "대길 · 길 · 흉 중 하나";
                case EventSpecial.TrialGate when index < 3:
                    return "이기면 " + (run.Floor + index) + "층까지 클리어 · 바로 귀환 · 도주 가능";
            }
            return null;
        }

        // 보물 더미: 함정 확률 15% → 30% → 50% → 70%, 행운 × 0.5%만큼 낮아짐
        private static readonly double[] TrapChances = { 0.15, 0.30, 0.50, 0.70 };
        // 피의 우물: 바칠 때마다 경험치 배수
        private static readonly double[] BloodRewards = { 1, 1, 3, 3, 6 };

        public static double TrapChance(int step, Character c) =>
            Math.Max(0, TrapChances[Math.Min(step, TrapChances.Length - 1)] - CharacterStats.Total(c, Stat.Luck) * GameBalance.EventBonusPerLuck);

        private static string[] SphinxRiddle(Room room) => Riddles.All[(room.Seed & 0x7fffffff) % Riddles.All.Length];

        /// <summary>화면에 보일 답 3개의 순서 (정답 위치는 방 시드로 정한다).</summary>
        private static string[] SphinxAnswers(Room room)
        {
            var r = SphinxRiddle(room);
            int correct = SphinxCorrect(room);
            var wrong = new[] { r[2], r[3] };
            var list = new string[3];
            int w = 0;
            for (int i = 0; i < 3; i++) list[i] = i == correct ? r[1] : wrong[w++];
            return list;
        }

        private static int SphinxCorrect(Room room) => ((room.Seed >> 4) & 0x7fffffff) % 3;

        /// <summary>지능이 요구치 이상이면 지워 주는 오답 (없으면 -1).</summary>
        public static int SphinxRemoved(DungeonRun run, Character c)
        {
            var room = run.Current;
            if (CharacterStats.Total(c, Stat.Intelligence) < GameBalance.EventRequirement(run.Floor)) return -1;
            int correct = SphinxCorrect(room);
            return (correct + 1 + ((room.Seed >> 8) & 1)) % 3;
        }

        // 운명의 카드: 0 대길 · 1 길 · 2 흉
        private static int[] FateOrder(Room room)
        {
            var order = new List<int> { 0, 1, 2 };
            new Rng(room.Seed).Shuffle(order);
            return order.ToArray();
        }

        private static string FateName(int fate) => fate == 0 ? "대길" : fate == 1 ? "길" : "흉";

        /// <summary>행운이 요구치 이상이면 미리 보여 주는 카드 (없으면 -1).</summary>
        public static int FatePeek(Room room, Character c, int floor) =>
            CharacterStats.Total(c, Stat.Luck) >= GameBalance.EventRequirement(floor) ? ((room.Seed >> 6) & 0x7fffffff) % 3 : -1;

        private static string TrialBossName(int floor)
        {
            var list = EnemyFactory.CreateBoss(floor, Difficulty.Normal, floor * 7919);
            return list.Count > 0 ? list[0].Name : "보스";
        }

        public static double SuccessChance(EventChoice choice, Character c, int floor)
        {
            var stat = CheckStat(choice, c);
            if (stat == null) return choice.FixedChance;
            return GameBalance.EventChance(CharacterStats.Total(c, stat.Value), GameBalance.EventRequirement(floor),
                CharacterStats.Total(c, Stat.Luck));
        }

        /// <summary>길게 눌렀을 때 보여 줄 성공률 계산 내역.</summary>
        public static string Breakdown(EventChoice choice, Character c, int floor)
        {
            var stat = CheckStat(choice, c);
            double chance = SuccessChance(choice, c, floor);
            if (stat == null) return "능력치 판정 없음\n성공 확률 " + Math.Round(chance * 100) + "%";
            int have = CharacterStats.Total(c, stat.Value), luck = CharacterStats.Total(c, Stat.Luck);
            double req = GameBalance.EventRequirement(floor);
            return Names.Of(stat.Value) + " 판정 (요구치 " + Math.Round(req) + ")\n"
                   + "기본 " + Math.Round(GameBalance.EventBase * 100) + "%\n"
                   + "능력치 차이 (" + have + " − " + Math.Round(req) + ") × " + Math.Round(GameBalance.EventPerStatPoint * 100) + "%\n"
                   + "행운 " + luck + " × " + (GameBalance.EventBonusPerLuck * 100).ToString("0.#") + "%\n"
                   + "= " + Math.Round(chance * 100) + "% (최소 " + Math.Round(GameBalance.EventMin * 100) + "% · 최대 " + Math.Round(GameBalance.EventMax * 100) + "%)";
        }

        /// <summary>선택 조건(아이템·골드)을 못 채우면 이유를 돌려준다.</summary>
        public static string UnavailableReason(EventChoice choice, Character c, int floor)
        {
            if (!string.IsNullOrEmpty(choice.RequiresItem) && c.Inventory.CountOf(choice.RequiresItem) <= 0)
                return ItemDb.Consumable(choice.RequiresItem)?.Name + " 없음";
            if (choice.RequiresGoldMult > 0 && c.Gold < GoldAmount(choice.RequiresGoldMult, floor))
                return "골드 부족";
            if (choice.GoldPerFloor > 0 && c.Gold < (long)choice.GoldPerFloor * floor)
                return "골드 부족 (" + ((long)choice.GoldPerFloor * floor).ToString("#,0") + "G)";
            return null;
        }

        /// <summary>특별한 이벤트의 선택 조건 (피의 우물: 남은 HP가 최대 HP 10%보다 많아야).</summary>
        public static string UnavailableReason(EventDef def, int index, DungeonRun run, Character c)
        {
            string reason = UnavailableReason(def.Choices[index], c, run.Floor);
            if (reason != null) return reason;
            if (def.Special == EventSpecial.BloodWell && index == 0)
            {
                if (run.Current.EventStep >= BloodRewards.Length) return "더 바칠 수 없다";
                if (c.CurrentHp <= BloodCost(c)) return "HP 부족";
            }
            return null;
        }

        public static long GoldAmount(double mult, int floor) => (long)Math.Round(GameBalance.EnemyGold(floor) * mult);

        private static int BloodCost(Character c) => (int)Math.Round(CharacterStats.MaxHp(c) * 0.1);

        public static string ChoiceHint(EventChoice choice, Character c, int floor)
        {
            if (choice.GoldPerFloor > 0)
                return ((long)choice.GoldPerFloor * floor).ToString("#,0") + "G" + (string.IsNullOrEmpty(choice.Hint) ? "" : " · " + choice.Hint.Replace("층 × " + choice.GoldPerFloor + "G · ", "").Replace("층 × " + choice.GoldPerFloor + "G", "").Trim(' ', '·'));
            var stat = CheckStat(choice, c);
            if (choice.CheckAttackStat && stat != null) return Names.Of(stat.Value) + " 판정";
            if (choice.RequiresGoldMult > 0) return GoldAmount(choice.RequiresGoldMult, floor).ToString("#,0") + "G 필요 · 확률 50%";
            return choice.Hint ?? "";
        }

        /// <summary>
        /// 궁수 전용 "멀리서 화살로 건드린다": 상자가 미믹일 확률은 "연다"의 실패 확률과 같다.
        /// 미믹이면 기습 없는 일반 전투, 상자면 판정 없이 열린다.
        /// </summary>
        private static EventOutcome ResolveArcherChest(EventDef def, Character c, int floor, Rng rng, out bool safe)
        {
            var open = Array.Find(def.Choices, ch => ch.Check == Stat.Luck);
            double mimic = open == null ? 0.3 : 1.0 - SuccessChance(open, c, floor);
            safe = !rng.Chance(mimic);
            return safe
                ? new EventOutcome { Text = "화살이 닿자 상자가 덜컹 열렸다. 쓸 만한 장비가 들어 있다.", Reward = EventReward.Equipment, GoldMult = 2 }
                : new EventOutcome { Text = "화살이 꽂히자 상자가 비명을 지르며 일어섰다. 미믹이다! 하지만 기습은 피했다.", Battle = EventBattle.MimicNoAmbush };
        }

        public static EventResult Resolve(DungeonRun run, Character c, int choiceIndex, Rng rng)
        {
            var room = run.Current;
            var def = EventDb.Get(room.EventId);
            if (def == null || choiceIndex < 0 || choiceIndex >= def.Choices.Length)
                throw new ArgumentException("잘못된 이벤트 선택");
            var choice = def.Choices[choiceIndex];
            if (choice.JobOnly >= 0 && choice.JobOnly != (int)c.Job)
                throw new InvalidOperationException("다른 직업의 선택지입니다");
            if (!VisibleChoices(def, c, run).Contains(choiceIndex))
                throw new InvalidOperationException("고를 수 없는 선택지입니다");
            if (UnavailableReason(def, choiceIndex, run, c) != null)
                throw new InvalidOperationException("선택 조건을 충족하지 못했습니다");

            if (!string.IsNullOrEmpty(choice.RequiresItem)) c.Inventory.RemoveTemplate(choice.RequiresItem, 1);
            if (choice.GoldPerFloor > 0) c.Gold -= (long)choice.GoldPerFloor * run.Floor;

            EventResult special = ResolveSpecial(def, choiceIndex, run, c, rng);
            if (special != null) return special;

            bool success = rng.Chance(SuccessChance(choice, c, run.Floor));
            var outcome = success || choice.Failure == null ? choice.Success : choice.Failure;
            if (outcome.ArcherChest) outcome = ResolveArcherChest(def, c, run.Floor, rng, out success);
            var result = new EventResult { Success = success, Text = outcome.Text, ReturnToTown = outcome.ReturnToTown, Battle = outcome.Battle };
            ApplyOutcome(outcome, result, run, c, rng);

            // 전투로 이어지면 방은 전투가 끝날 때 클리어된다.
            if (!result.StartBattle && !outcome.BecomeMerchant) room.Cleared = true;
            return result;
        }

        /// <summary>HP·골드·경험치·보상·탐험 효과·지도 공개·연쇄 등 결과를 적용한다.</summary>
        private static void ApplyOutcome(EventOutcome outcome, EventResult result, DungeonRun run, Character c, Rng rng)
        {
            ChangeHp(c, outcome.HpRatio, result);
            if (outcome.GoldMult != 0)
            {
                long amount = GoldAmount(outcome.GoldMult, run.Floor);
                if (amount < 0) amount = -Math.Min(c.Gold, -amount);
                result.Loot.Gold += amount;
            }
            if (outcome.ExpMult > 0) result.Loot.Exp += (long)Math.Round(GameBalance.EnemyExp(run.Floor) * outcome.ExpMult);
            AddReward(outcome.Reward, result, run, c, rng);
            LootSystem.Apply(c, run, result.Loot);

            foreach (var e in outcome.Effects) ExploreEffects.Add(run.Effects, e.Type, e.Battles);
            if (outcome.Reveal != RevealKind.None) MapEvents.Reveal(run, outcome.Reveal, outcome.RevealWrong, rng);
            if (outcome.SpawnTreasure && !MapEvents.SpawnTreasure(run, rng))
            {
                // 옆에 빈 칸이 없으면 보물을 바로 준다
                var loot = LootSystem.Treasure(run.Floor, c, rng);
                LootSystem.Apply(c, run, loot);
                result.Loot.Gold += loot.Gold;
                result.Loot.Items.AddRange(loot.Items);
                result.Text += " 방이 너무 좁아 보물을 바로 꺼내 주었다.";
            }
            if (outcome.LinkBoss) MapEvents.LinkBoss(run);
            if (outcome.FindReturn) MapEvents.FindReturn(run);
            if (!string.IsNullOrEmpty(outcome.Chain)) MapEvents.Chain(run, outcome.Chain, rng);
            if (outcome.BecomeMerchant) MapEvents.BecomeMerchant(run);
        }

        private static void ChangeHp(Character c, double ratio, EventResult result)
        {
            if (ratio == 0) return;
            int max = CharacterStats.MaxHp(c);
            int before = c.CurrentHp;
            // 이벤트 피해로는 쓰러지지 않는다 (최소 1)
            c.CurrentHp = GameBalance.Clamp(c.CurrentHp + (int)Math.Round(max * ratio), 1, max);
            result.HpChange += c.CurrentHp - before;
        }

        private static void AddReward(EventReward reward, EventResult result, DungeonRun run, Character c, Rng rng)
        {
            switch (reward)
            {
                case EventReward.GoodEquipment:
                    var grade = (ItemGrade)Math.Max((int)ItemGrade.Uncommon, (int)EquipmentFactory.RollDropGrade(rng, run.Floor, 1));
                    result.Loot.Items.Add(EquipmentFactory.CreateRandom(rng, grade, EquipmentFactory.ItemLevelForFloor(run.Floor, rng), c.Job, 0.7));
                    break;
                case EventReward.Consumables:
                    var ids = new[] { "potion", "potion_hi", "antidote", "bandage", "salve" };
                    int n = rng.RangeInclusive(1, 2);
                    for (int i = 0; i < n; i++) result.Loot.Items.Add(ItemDb.CreateConsumable(rng.Pick(ids)));
                    break;
                case EventReward.TwoPotions:
                    result.Loot.Items.Add(ItemDb.CreateConsumable("potion", 2));
                    break;
                default:
                    var item = LootSystem.CreateEventReward(reward, run.Floor, c, rng);
                    if (item != null) result.Loot.Items.Add(item);
                    break;
            }
        }

        /// <summary>보물 더미·피의 우물·스핑크스·운명의 카드·시련의 문.</summary>
        private static EventResult ResolveSpecial(EventDef def, int index, DungeonRun run, Character c, Rng rng)
        {
            var room = run.Current;
            var result = new EventResult { Success = true };
            bool pass = def.Choices[index].Label.Length > 0 && index == def.Choices.Length - 1 && def.Special != EventSpecial.TreasurePile && def.Special != EventSpecial.BloodWell;
            switch (def.Special)
            {
                case EventSpecial.TreasurePile:
                    if (index == 0)
                    {
                        if (rng.Chance(TrapChance(room.EventStep, c)))
                        {
                            long half = room.EventBank / 2;
                            result.Success = false;
                            result.Text = "와르르! 더미가 무너져 깔렸다. 모은 골드의 절반만 건졌다.";
                            ChangeHp(c, -0.2, result);
                            result.Loot.Gold = half;
                            LootSystem.Apply(c, run, result.Loot);
                            room.Cleared = true;
                            return result;
                        }
                        long gain = GoldAmount(2, run.Floor);
                        room.EventBank += gain;
                        room.EventStep++;
                        result.Text = "금화를 한 움큼 주웠다. (+" + gain.ToString("#,0") + "G, 모은 골드 " + room.EventBank.ToString("#,0") + "G) 더미가 더 크게 흔들린다.";
                        result.Continues = true;
                        return result;
                    }
                    result.Text = room.EventBank > 0 ? "욕심을 접고 모은 골드를 챙겼다." : "보물 더미를 뒤로하고 떠났다.";
                    result.Loot.Gold = room.EventBank;
                    LootSystem.Apply(c, run, result.Loot);
                    room.Cleared = true;
                    return result;

                case EventSpecial.BloodWell:
                    if (index == 0)
                    {
                        int cost = BloodCost(c);
                        int before = c.CurrentHp;
                        c.CurrentHp = Math.Max(1, c.CurrentHp - cost);
                        result.HpChange = c.CurrentHp - before;
                        result.Loot.Exp = (long)Math.Round(GameBalance.EnemyExp(run.Floor) * BloodRewards[room.EventStep]);
                        LootSystem.Apply(c, run, result.Loot);
                        room.EventStep++;
                        result.Text = "피가 우물로 스며들자 깨달음이 밀려든다. (" + room.EventStep + "/" + BloodRewards.Length + ")";
                        result.Continues = room.EventStep < BloodRewards.Length;
                        if (!result.Continues) room.Cleared = true;
                        return result;
                    }
                    result.Text = "우물을 뒤로하고 떠났다.";
                    room.Cleared = true;
                    return result;

                case EventSpecial.Sphinx:
                    if (pass) break;
                    if (index == SphinxCorrect(room))
                    {
                        result.Text = "\"정답이다.\" 스핑크스가 길을 비키며 보물을 내준다.";
                        result.Loot.Exp = GameBalance.EnemyExp(run.Floor) * 5;
                        result.Loot.Items.Add(LootSystem.RandomEquipment(run.Floor, c, rng, 1));
                        LootSystem.Apply(c, run, result.Loot);
                    }
                    else
                    {
                        result.Success = false;
                        result.Text = "\"틀렸다.\" 스핑크스의 앞발이 내리쳤다. 정답은 '" + SphinxRiddle(room)[1] + "'였다.";
                        ChangeHp(c, -0.15, result);
                    }
                    room.Cleared = true;
                    return result;

                case EventSpecial.FateCards:
                    if (pass) break;
                    int fate = FateOrder(room)[index];
                    if (fate == 0)
                    {
                        result.Text = "대길! 카드가 황금빛으로 타오른다.";
                        result.Loot.Gold = GoldAmount(3, run.Floor);
                        AddReward(EventReward.GoodEquipment, result, run, c, rng);
                    }
                    else if (fate == 1)
                    {
                        result.Text = "길. 소소한 행운이 찾아왔다.";
                        if (rng.Chance(0.5)) result.Loot.Gold = GoldAmount(3, run.Floor);
                        else result.Loot.Items.Add(ItemDb.CreateConsumable("potion", 2));
                    }
                    else
                    {
                        result.Success = false;
                        result.Text = "흉. 카드가 검게 타며 손을 그었다.";
                        ChangeHp(c, -0.2, result);
                    }
                    LootSystem.Apply(c, run, result.Loot);
                    room.Cleared = true;
                    return result;

                case EventSpecial.TrialGate:
                    if (pass) break;
                    result.TrialFloor = run.Floor + index;
                    result.Battle = EventBattle.Trial;
                    result.Text = (run.Floor + index) + "층의 주인이 문 너머에서 걸어 나온다!";
                    return result;

                default:
                    return null;
            }
            // 그냥 지나간다
            result.Text = def.Choices[index].Success.Text;
            room.Cleared = true;
            return result;
        }
    }
}

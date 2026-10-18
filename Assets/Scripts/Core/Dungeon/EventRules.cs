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

        public bool StartBattle => Battle != EventBattle.None;
    }

    /// <summary>특수 이벤트 선택지 처리. 성공률 = 65% + (능력치 − 요구치) × 3% + 행운 × 0.5% (25~95%).</summary>
    public static class EventRules
    {
        public static Stat? CheckStat(EventChoice choice, Character c) =>
            choice.CheckAttackStat ? c.JobData.AttackStat : choice.Check;

        /// <summary>이 캐릭터에게 보이는 선택지 (직업 전용 선택지 포함). 원래 번호를 함께 돌려준다.</summary>
        public static List<int> VisibleChoices(EventDef def, Character c)
        {
            var list = new List<int>();
            for (int i = 0; i < def.Choices.Length; i++)
                if (def.Choices[i].JobOnly < 0 || def.Choices[i].JobOnly == (int)c.Job) list.Add(i);
            return list;
        }

        public static double SuccessChance(EventChoice choice, Character c, int floor)
        {
            var stat = CheckStat(choice, c);
            if (stat == null) return choice.FixedChance;
            return GameBalance.EventChance(CharacterStats.Total(c, stat.Value), GameBalance.EventRequirement(floor),
                CharacterStats.Total(c, Stat.Luck));
        }

        /// <summary>선택 조건(아이템·골드)을 못 채우면 이유를 돌려준다.</summary>
        public static string UnavailableReason(EventChoice choice, Character c, int floor)
        {
            if (!string.IsNullOrEmpty(choice.RequiresItem) && c.Inventory.CountOf(choice.RequiresItem) <= 0)
                return ItemDb.Consumable(choice.RequiresItem)?.Name + " 없음";
            if (choice.RequiresGoldMult > 0 && c.Gold < GoldAmount(choice.RequiresGoldMult, floor))
                return "골드 부족";
            return null;
        }

        public static long GoldAmount(double mult, int floor) => (long)Math.Round(GameBalance.EnemyGold(floor) * mult);

        public static string ChoiceHint(EventChoice choice, Character c, int floor)
        {
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
            if (UnavailableReason(choice, c, run.Floor) != null)
                throw new InvalidOperationException("선택 조건을 충족하지 못했습니다");

            if (!string.IsNullOrEmpty(choice.RequiresItem)) c.Inventory.RemoveTemplate(choice.RequiresItem, 1);

            if (choice.JobOnly >= 0 && choice.JobOnly != (int)c.Job)
                throw new InvalidOperationException("다른 직업의 선택지입니다");
            bool success = rng.Chance(SuccessChance(choice, c, run.Floor));
            var outcome = success || choice.Failure == null ? choice.Success : choice.Failure;
            if (outcome.ArcherChest) outcome = ResolveArcherChest(def, c, run.Floor, rng, out success);
            var result = new EventResult { Success = success, Text = outcome.Text, ReturnToTown = outcome.ReturnToTown, Battle = outcome.Battle };

            int max = CharacterStats.MaxHp(c);
            if (outcome.HpRatio != 0)
            {
                int before = c.CurrentHp;
                int delta = (int)Math.Round(max * outcome.HpRatio);
                // 이벤트 피해로는 쓰러지지 않는다 (최소 1)
                c.CurrentHp = GameBalance.Clamp(c.CurrentHp + delta, 1, max);
                result.HpChange = c.CurrentHp - before;
            }
            if (outcome.GoldMult != 0)
            {
                long amount = GoldAmount(outcome.GoldMult, run.Floor);
                if (amount < 0) amount = -Math.Min(c.Gold, -amount);
                result.Loot.Gold = amount;
            }
            if (outcome.ExpMult > 0) result.Loot.Exp = (long)Math.Round(GameBalance.EnemyExp(run.Floor) * outcome.ExpMult);
            var item = LootSystem.CreateEventReward(outcome.Reward, run.Floor, c, rng);
            if (item != null) result.Loot.Items.Add(item);
            LootSystem.Apply(c, run, result.Loot);

            // 미믹 전투로 이어지면 방은 전투가 끝날 때 클리어된다.
            if (!result.StartBattle) room.Cleared = true;
            return result;
        }
    }
}

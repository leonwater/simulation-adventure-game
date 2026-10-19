using System;
using System.Collections.Generic;
using System.Linq;
using Adventure.Core;
using Adventure.Tests;

// 난이도별로 봇이 몇 번 도전해 몇 층을 돌파하는지, 어디서 쓰러지는지 잰다.
// 사용: dotnet run -c Release -- [도전 횟수=150] [시드 수=3] [난이도=Normal,Hard]
//       dotnet run -c Release -- boss [판 수=300]   보스 특성 켬/끔 1:1 비교 (층에 맞춘 캐릭터)
public static class Program
{
    private static readonly int[] Milestones = { 1, 3, 5, 10, 15, 20, 25, 30 };
    private static readonly string[] Bands = { "1~10층", "11~20층", "21~30층" };

    private class Stats
    {
        public readonly Dictionary<int, List<int>> Reach = Milestones.ToDictionary(m => m, m => new List<int>());
        public readonly Dictionary<int, List<int>> Level = Milestones.ToDictionary(m => m, m => new List<int>());
        public readonly int[] Runs = new int[3], Deaths = new int[3], BossFights = new int[3], BossLosses = new int[3];
        public readonly List<double>[] BossHp = { new List<double>(), new List<double>(), new List<double>() };
        public int Players, Conquered, Wiped;
    }

    public static void Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "boss")
        {
            BossDuel(args.Length > 1 ? int.Parse(args[1]) : 300);
            return;
        }
        int runs = args.Length > 0 ? int.Parse(args[0]) : 150;
        int seeds = args.Length > 1 ? int.Parse(args[1]) : 3;
        var diffs = args.Length > 2
            ? args[2].Split(',').Select(x => (Difficulty)Enum.Parse(typeof(Difficulty), x)).ToArray()
            : new[] { Difficulty.Normal, Difficulty.Hard };
        foreach (var diff in diffs) Print(diff, runs, Simulate(diff, runs, seeds));
    }

    private static Stats Simulate(Difficulty diff, int runs, int seeds)
    {
        var st = new Stats();
        foreach (Job job in Enum.GetValues(typeof(Job)))
        {
            for (int seed = 0; seed < seeds; seed++)
            {
                st.Players++;
                var now = new DateTime(2026, 10, 1, 9, 0, 0, DateTimeKind.Utc);
                var s = new GameSession(new MemorySaveStore(), () => now, 1000 * seed + (int)job + 7);
                s.NewGame("봇", job, diff);
                s.SetTutorial(TutorialStage.Done);
                var reached = new HashSet<int>();
                for (int run = 1; run <= runs && s.HasGame; run++)
                {
                    BotPlayer.PrepareInTown(s);
                    s.EnterDungeon();
                    int band = Band(s.Run.Floor);
                    st.Runs[band]++;
                    PlayRun(s, st);
                    if (!s.HasGame)
                    {
                        st.Deaths[band]++;
                        st.Wiped++; // 하드코어: 캐릭터 초기화
                        break;
                    }
                    if (s.InDungeon) s.ReturnToTown();
                    if (s.LastDeath != null) st.Deaths[Band(s.LastDeath.Floor)]++;
                    foreach (int m in Milestones)
                    {
                        if (s.C.HighestFloorCleared < m || !reached.Add(m)) continue;
                        st.Reach[m].Add(run);
                        st.Level[m].Add(s.C.Level);
                    }
                    now = now.AddMinutes(20);
                    if (s.C.HighestFloorCleared >= GameBalance.MaxFloor)
                    {
                        st.Conquered++;
                        break;
                    }
                }
            }
        }
        return st;
    }

    /// <summary>던전 한 번: 보스전 결과(승패·남은 HP)를 따로 센다.</summary>
    private static void PlayRun(GameSession s, Stats st)
    {
        Battle boss = null;
        int steps = 0;
        while (s.HasGame && s.InDungeon && steps++ < 600)
        {
            var b = s.Battle;
            if (b != null && b.IsBoss && boss != b)
            {
                boss = b;
                st.BossFights[Band(b.Floor)]++;
            }
            if (boss != null && boss.IsOver)
            {
                if (boss.Outcome == BattleOutcome.Victory) st.BossHp[Band(boss.Floor)].Add(boss.Player.HpRatio);
                else if (boss.Outcome == BattleOutcome.Defeat) st.BossLosses[Band(boss.Floor)]++;
                boss = null;
            }
            BotPlayer.Step(s);
        }
        if (boss != null && boss.Outcome == BattleOutcome.Defeat) st.BossLosses[Band(boss.Floor)]++;
    }

    private static int Band(int floor) => Math.Min(2, Math.Max(0, floor - 1) / 10);

    private static void Print(Difficulty diff, int runs, Stats st)
    {
        Console.WriteLine("=== " + diff + " · 캐릭터 " + st.Players + "명 · 최대 도전 " + runs + "회 ===");
        foreach (int m in Milestones)
        {
            var r = st.Reach[m];
            string when = r.Count == 0 ? "-" : "평균 " + r.Average().ToString("0.0") + "회째 (" + r.Min() + "~" + r.Max() + ") · Lv." + st.Level[m].Average().ToString("0.0");
            Console.WriteLine("  " + m.ToString().PadLeft(2) + "층 돌파 " + r.Count + "/" + st.Players + " · " + when);
        }
        for (int i = 0; i < 3; i++)
        {
            double rate = st.Runs[i] == 0 ? 0 : 100.0 * st.Deaths[i] / st.Runs[i];
            string hp = st.BossHp[i].Count == 0 ? "-" : (st.BossHp[i].Average() * 100).ToString("0") + "%";
            Console.WriteLine("  " + Bands[i] + ": 도전 " + st.Runs[i] + " · 사망 " + st.Deaths[i] + " (" + rate.ToString("0.0") + "%) · 보스전 "
                              + st.BossFights[i] + " (패배 " + st.BossLosses[i] + ") · 보스 처치 후 남은 HP " + hp);
        }
        Console.WriteLine("  30층 정복 " + st.Conquered + "/" + st.Players + (st.Wiped > 0 ? " · 하드코어 초기화 " + st.Wiped : ""));
    }

    // ── 보스 특성 1:1 비교 ──

    private static void BossDuel(int fights)
    {
        Console.WriteLine("=== 보스 특성 켬/끔 비교 (보통 · 층마다 Lv.2f 캐릭터, 고급 장비, 물약 3개) ===");
        Console.WriteLine("층  보스            특성              승률 끔→켬     남은 HP 끔→켬   턴 끔→켬");
        int[] floors = { 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30 };
        foreach (int f in floors)
        {
            var theme = MonsterDb.ThemeFor(f);
            var ids = MonsterDb.IsUniqueBossFloor(f) ? new[] { theme.UniqueBossId } : theme.SpeciesIds;
            foreach (var id in ids)
            {
                var sp = MonsterDb.Get(id);
                var off = Duel(sp, f, fights, false);
                var on = Duel(sp, f, fights, true);
                string traits = string.Join("+", BossTraits.For(id).Select(BossTraits.Name));
                Console.WriteLine(f.ToString().PadLeft(2) + "  " + Pad(sp.Name, 14) + Pad(traits, 16)
                                  + Pct(off.win) + " → " + Pct(on.win) + "    " + Pct(off.hp) + " → " + Pct(on.hp) + "    "
                                  + off.turns.ToString("0.0") + " → " + on.turns.ToString("0.0"));
            }
        }
    }

    private static (double win, double hp, double turns) Duel(MonsterSpecies sp, int floor, int fights, bool traits)
    {
        int wins = 0;
        double hp = 0, turns = 0;
        for (int i = 0; i < fights; i++)
        {
            var rng = new Rng(i * 31 + floor);
            var c = BuildHero((Job)(i % 4), floor, rng);
            var boss = EnemyFactory.Create(sp, floor, Difficulty.Normal, 2);
            if (traits) BossTraits.Equip(boss, floor);
            var b = new Battle(c, floor, new List<Combatant> { boss }, true, rng);
            int guard = 0;
            while (!b.IsOver && guard++ < 200) b.Execute(BotPlayer.PickBattleChoice(b));
            if (b.Outcome == BattleOutcome.Victory)
            {
                wins++;
                hp += b.Player.HpRatio;
            }
            turns += b.Turn;
        }
        return ((double)wins / fights, wins == 0 ? 0 : hp / wins, turns / fights);
    }

    /// <summary>그 층에 막 도착한 캐릭터: Lv.2f, 자동 배분, 직업 스킬, 층 수준의 고급 장비 한 벌, 물약 3개.</summary>
    private static Character BuildHero(Job job, int floor, Rng rng)
    {
        var c = Character.Create("봇", job);
        int level = Math.Min(GameBalance.MaxLevel, floor * 2);
        while (c.Level < level) Leveling.AddExp(c, GameBalance.ExpToNext(c.Level));
        Leveling.AutoAllocate(c);
        c.Rank = (Rank)Math.Min((int)Rank.S, floor / 5);
        foreach (var def in SkillDb.ForJob(job, (SkillTier[])Enum.GetValues(typeof(SkillTier)))) SkillSystem.Learn(c, def.Id);
        foreach (var st in c.Skills.Learned) SkillSystem.Equip(c, st.SkillId, out _);
        var grade = floor >= 12 ? ItemGrade.Rare : ItemGrade.Uncommon;
        foreach (var gear in new[] { GearType.Helmet, GearType.Armor, GearType.Pants, GearType.Boots, GearType.Necklace, GearType.Ring, GearType.Ring, GearType.Weapon })
        {
            var item = EquipmentFactory.Create(gear, grade, Math.Min(c.Level, EquipmentFactory.ItemLevelForFloor(floor, rng)), job, c.JobData.AttackStat);
            c.Inventory.Add(item);
            EquipmentSystem.Equip(c, item.Uid, out _);
        }
        c.Inventory.Add(ItemDb.CreateConsumable("potion", 3));
        c.CurrentHp = CharacterStats.MaxHp(c);
        return c;
    }

    private static string Pct(double v) => (v * 100).ToString("0").PadLeft(3) + "%";

    private static string Pad(string s, int width)
    {
        int w = 0;
        foreach (char ch in s) w += ch > 0x2000 ? 2 : 1;
        return s + new string(' ', Math.Max(1, width - w));
    }
}

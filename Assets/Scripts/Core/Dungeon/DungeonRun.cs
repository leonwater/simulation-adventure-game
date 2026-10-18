using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>던전 한 번의 도전 상태. 저장 파일에 들어가 앱을 껐다 켜도 이어진다.</summary>
    [Serializable]
    public class DungeonRun
    {
        public int Floor;
        public FloorMap Map;
        public int CurrentRoomId;
        public int PreviousRoomId;
        public bool BossDefeated;
        public long GoldEarned;
        public long ExpEarned;
        public int EnemiesDefeated;
        public List<string> Loot = new List<string>();

        public Room Current => Map.Get(CurrentRoomId);

        public int RoomsExplored
        {
            get
            {
                int n = 0;
                foreach (var r in Map.Rooms) if (r.Visited && r.Type != RoomType.Start) n++;
                return n;
            }
        }

        public bool ReturnRoomFound
        {
            get
            {
                foreach (var r in Map.Rooms) if (r.Type == RoomType.Return && r.Visited) return true;
                return false;
            }
        }
    }

    /// <summary>미니맵·경로 선택에 쓰는 이동 후보.</summary>
    public struct MoveOption
    {
        public Room Room;
        public string Direction; // 예: "아래 통로로 간다"
        public string Hint;      // 예: "물소리가 나는 쪽" / 쉬움: "전투"
        public bool Known;       // 방 종류를 알고 있는지 (방문했거나 쉬움 난이도)
    }

    public enum RoomEnterResult
    {
        Nothing,
        Battle,
        Boss,
        Event,
        Treasure,
        Rest,
        Merchant,
        Return
    }

    /// <summary>던전 탐험 규칙: 이동, 텔레포트, 방 내용 처리, 다음 층.</summary>
    public static class DungeonSystem
    {
        private static readonly string[] Atmospheres =
        {
            "물소리가 나는 쪽", "횃불이 꺼진 쪽", "바람이 부는 쪽", "발자국이 남은 쪽",
            "비린내가 나는 쪽", "희미한 빛이 새는 쪽", "거미줄이 늘어진 쪽", "돌가루가 날리는 쪽",
        };

        public static DungeonRun StartRun(Character c, int floor, Rng rng)
        {
            floor = GameBalance.Clamp(floor, 1, c.MaxChallengeFloor);
            var map = DungeonGenerator.Generate(floor, rng);
            c.CurrentHp = CharacterStats.MaxHp(c);
            return new DungeonRun { Floor = floor, Map = map, CurrentRoomId = map.StartId, PreviousRoomId = map.StartId };
        }

        /// <summary>현재 방을 떠날 수 있는지 (전투·이벤트를 끝냈는지).</summary>
        public static bool CanLeave(DungeonRun run) => run.Current.Cleared;

        public static List<MoveOption> MoveOptions(DungeonRun run, Difficulty difficulty)
        {
            var list = new List<MoveOption>();
            var cur = run.Current;
            foreach (int id in cur.Links)
            {
                var r = run.Map.Get(id);
                bool known = r.Visited || difficulty == Difficulty.Easy;
                list.Add(new MoveOption
                {
                    Room = r,
                    Direction = DirectionText(cur, r) + (r.Visited ? "로 돌아간다" : "로 간다"),
                    Hint = r.Visited ? Text.Of(r.Type) + " · 탐험함" : (known ? Text.Of(r.Type) : Atmospheres[(r.Seed & 0x7fffffff) % Atmospheres.Length]),
                    Known = known,
                });
            }
            // 새 방을 먼저 보여 준다.
            list.Sort((a, b) => a.Room.Visited.CompareTo(b.Room.Visited));
            return list;
        }

        private static string DirectionText(Room from, Room to)
        {
            if (to.X > from.X) return "오른쪽 통로";
            if (to.X < from.X) return "왼쪽 통로";
            if (to.Y > from.Y) return "아래 통로";
            return "위 통로";
        }

        /// <summary>지금 방의 상황 설명 (던전 화면 텍스트 상자).</summary>
        public static string Situation(DungeonRun run, out string title)
        {
            var cur = run.Current;
            int unexplored = 0;
            foreach (int id in cur.Links) if (!run.Map.Get(id).Visited) unexplored++;
            if (cur.Type == RoomType.Boss && run.BossDefeated)
            {
                title = "보스 처치";
                return run.Floor >= GameBalance.MaxFloor
                    ? "던전 최하층의 주인이 쓰러졌다. 깊은 정적이 내려앉는다."
                    : "층의 주인이 쓰러지자 아래층으로 이어진 계단이 드러났다.";
            }
            if (cur.Type == RoomType.Return)
            {
                title = "귀환 방";
                return "바닥에 새겨진 마법진이 은은하게 빛난다. 이곳에서 마을로 돌아갈 수 있다.";
            }
            if (cur.Type == RoomType.Merchant)
            {
                title = "떠돌이 상인";
                return "등짐을 내려놓은 상인이 손짓한다. \"물약 필요하지 않나? 조금 비싸긴 해도.\"";
            }
            if (unexplored >= 2)
            {
                title = "갈림길";
                return "길이 " + (unexplored == 2 ? "두" : unexplored == 3 ? "세" : "네") + " 갈래로 나뉜다. 어느 쪽으로 갈지 정해야 한다.";
            }
            if (unexplored == 1)
            {
                title = "통로";
                return "좁은 통로가 어둠 속으로 이어진다.";
            }
            title = "막다른 곳";
            return cur.Links.Count <= 1
                ? "더 나아갈 길이 없다. 왔던 길로 돌아가거나 탐험한 방으로 이동하자."
                : "주변 방은 모두 둘러보았다. 탐험하지 않은 방으로 이동하자.";
        }

        public static bool CanMoveTo(DungeonRun run, int roomId) =>
            CanLeave(run) && run.Current.Links.Contains(roomId);

        /// <summary>인접한 방으로 이동한다. 처음 들어가는 방이면 그 방의 내용을 돌려준다.</summary>
        public static RoomEnterResult MoveTo(DungeonRun run, int roomId)
        {
            if (!CanMoveTo(run, roomId)) throw new InvalidOperationException("이동할 수 없는 방입니다");
            return Enter(run, roomId);
        }

        private static RoomEnterResult Enter(DungeonRun run, int roomId)
        {
            run.PreviousRoomId = run.CurrentRoomId;
            run.CurrentRoomId = roomId;
            var room = run.Current;
            room.Visited = true;
            if (room.Cleared)
                return room.Type == RoomType.Merchant ? RoomEnterResult.Merchant
                    : room.Type == RoomType.Return ? RoomEnterResult.Return : RoomEnterResult.Nothing;
            switch (room.Type)
            {
                case RoomType.Battle: return RoomEnterResult.Battle;
                case RoomType.Boss: return RoomEnterResult.Boss;
                case RoomType.Event: return RoomEnterResult.Event;
                case RoomType.Treasure: return RoomEnterResult.Treasure;
                case RoomType.Rest: return RoomEnterResult.Rest;
                case RoomType.Merchant:
                    room.Cleared = true;
                    return RoomEnterResult.Merchant;
                case RoomType.Return:
                    room.Cleared = true;
                    return RoomEnterResult.Return;
                default:
                    room.Cleared = true;
                    return RoomEnterResult.Nothing;
            }
        }

        /// <summary>전투에서 도망치면 직전 방으로 돌아간다. 전투 방은 클리어되지 않은 채 남는다.</summary>
        public static void FleeToPrevious(DungeonRun run)
        {
            int back = run.PreviousRoomId;
            if (back == run.CurrentRoomId || !run.Map.Get(back).Cleared) back = run.Map.StartId;
            run.CurrentRoomId = back;
        }

        /// <summary>텔레포트: 탐험을 끝낸 방으로 비용 없이 이동 (전투 중 불가).</summary>
        public static List<Room> TeleportTargets(DungeonRun run)
        {
            var list = new List<Room>();
            foreach (var r in run.Map.Rooms)
                if (r.Visited && r.Cleared && r.Id != run.CurrentRoomId) list.Add(r);
            return list;
        }

        public static bool Teleport(DungeonRun run, int roomId)
        {
            if (!CanLeave(run)) return false;
            var r = run.Map.Get(roomId);
            if (r == null || !r.Visited || !r.Cleared || roomId == run.CurrentRoomId) return false;
            run.PreviousRoomId = run.CurrentRoomId;
            run.CurrentRoomId = roomId;
            return true;
        }

        public static void ClearCurrent(DungeonRun run) => run.Current.Cleared = true;

        /// <summary>휴식 방: 최대 HP 40% 회복.</summary>
        public static int Rest(DungeonRun run, Character c)
        {
            int max = CharacterStats.MaxHp(c);
            int before = c.CurrentHp;
            c.CurrentHp = Math.Min(max, c.CurrentHp + (int)Math.Round(max * GameBalance.RestHealRatio));
            run.Current.Cleared = true;
            return c.CurrentHp - before;
        }

        /// <summary>보물 방: 골드와 아이템을 얻는다.</summary>
        public static LootReport OpenTreasure(DungeonRun run, Character c, Rng rng)
        {
            var report = LootSystem.Treasure(run.Floor, c, new Rng(run.Current.Seed));
            LootSystem.Apply(c, run, report);
            run.Current.Cleared = true;
            return report;
        }

        public static bool CanGoDeeper(DungeonRun run) => run.BossDefeated && run.Floor < GameBalance.MaxFloor;

        /// <summary>보스를 잡은 뒤 마을에 들르지 않고 다음 층으로 내려간다 (HP 유지).</summary>
        public static void Descend(DungeonRun run, Rng rng)
        {
            if (!CanGoDeeper(run)) throw new InvalidOperationException("아직 내려갈 수 없습니다");
            run.Floor++;
            run.Map = DungeonGenerator.Generate(run.Floor, rng);
            run.CurrentRoomId = run.Map.StartId;
            run.PreviousRoomId = run.Map.StartId;
            run.BossDefeated = false;
        }

        /// <summary>보스 처치 기록: 돌파 층 갱신, 정복 퀘스트 진행.</summary>
        public static void OnBossDefeated(DungeonRun run, Character c, GuildState guild)
        {
            run.BossDefeated = true;
            run.Current.Cleared = true;
            c.HighestFloorCleared = Math.Max(c.HighestFloorCleared, run.Floor);
            GuildSystem.OnBossKilled(guild, run.Floor);
        }
    }
}

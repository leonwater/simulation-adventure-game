using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>이벤트가 층 지도를 바꾸는 일: 방 공개, 숨은 보물 방, 보스로 가는 지름길, 연쇄 이벤트, 상인으로 바뀌는 방.</summary>
    public static class MapEvents
    {
        private static readonly int[] DX = { 1, -1, 0, 0 };
        private static readonly int[] DY = { 0, 0, 1, -1 };
        private static readonly RoomType[] Guessable = { RoomType.Battle, RoomType.Event, RoomType.Treasure, RoomType.Rest };

        /// <summary>방 위치·종류를 미니맵에 공개한다. wrong이면 공개된 방 하나의 종류를 틀리게 알려 준다.</summary>
        public static void Reveal(DungeonRun run, RevealKind kind, bool wrong, Rng rng)
        {
            var map = run.Map;
            var revealed = new List<Room>();
            int[] dist = kind == RevealKind.Nearby2 ? map.Distances(run.CurrentRoomId) : null;
            foreach (var r in map.Rooms)
            {
                bool show;
                switch (kind)
                {
                    case RevealKind.All: show = true; break;
                    case RevealKind.ReturnRoom: show = r.Type == RoomType.Return; break;
                    case RevealKind.ReturnAndBoss: show = r.Type == RoomType.Return || r.Id == map.BossId; break;
                    case RevealKind.Nearby2: show = dist[r.Id] >= 0 && dist[r.Id] <= 2; break;
                    default: show = false; break;
                }
                if (!show || r.Visited) continue;
                r.Revealed = true;
                revealed.Add(r);
            }
            if (!wrong) return;
            var candidates = revealed.FindAll(r => Array.IndexOf(Guessable, r.Type) >= 0);
            if (candidates.Count == 0) return;
            var target = rng.Pick(candidates);
            var others = new List<RoomType>(Guessable);
            others.Remove(target.Type);
            target.ShownType = (int)rng.Pick(others);
        }

        /// <summary>지금 방 옆 빈 칸에 보물 방을 만든다. 빈 칸이 없으면 false.</summary>
        public static bool SpawnTreasure(DungeonRun run, Rng rng)
        {
            var map = run.Map;
            var cur = run.Current;
            var used = new HashSet<long>();
            foreach (var r in map.Rooms) used.Add(Key(r.X, r.Y));
            var dirs = new List<int> { 0, 1, 2, 3 };
            rng.Shuffle(dirs);
            foreach (int d in dirs)
            {
                int x = cur.X + DX[d], y = cur.Y + DY[d];
                if (used.Contains(Key(x, y))) continue;
                var room = new Room { Id = map.Rooms.Count, Type = RoomType.Treasure, X = x, Y = y, Seed = rng.NextSeed(), Revealed = true };
                map.Rooms.Add(room);
                Link(cur, room);
                return true;
            }
            return false;
        }

        /// <summary>지금 방과 보스 방을 잇는 숨은 통로.</summary>
        public static void LinkBoss(DungeonRun run)
        {
            var boss = run.Map.Boss;
            if (boss == null || boss.Id == run.CurrentRoomId) return;
            Link(run.Current, boss);
            if (!boss.Visited) boss.Revealed = true;
        }

        /// <summary>귀환 방을 찾은 것으로 친다 (귀환 버튼을 바로 쓸 수 있다).</summary>
        public static void FindReturn(DungeonRun run)
        {
            foreach (var r in run.Map.Rooms)
            {
                if (r.Type != RoomType.Return) continue;
                r.Visited = r.Cleared = r.Revealed = true;
            }
        }

        /// <summary>아직 가지 않은 전투·이벤트 방 하나에 후속 이벤트를 놓는다.</summary>
        public static void Chain(DungeonRun run, string followupId, Rng rng)
        {
            var candidates = run.Map.Rooms.FindAll(r => !r.Visited && r.Id != run.CurrentRoomId && r.Id != run.Map.BossId
                                                        && (r.Type == RoomType.Battle || r.Type == RoomType.Event) && !r.Chain);
            if (candidates.Count == 0) return;
            var room = rng.Pick(candidates);
            room.Type = RoomType.Event;
            room.EventId = followupId;
            room.Chain = true;
            room.Cleared = false;
        }

        /// <summary>지금 방이 상인의 가게가 된다 (마을 가격 × 0.7).</summary>
        public static void BecomeMerchant(DungeonRun run)
        {
            var room = run.Current;
            room.Type = RoomType.Merchant;
            room.MerchantGoods = DungeonGenerator.MerchantGoods();
            room.MerchantDiscount = true;
            room.Cleared = true;
        }

        private static void Link(Room a, Room b)
        {
            if (!a.Links.Contains(b.Id)) a.Links.Add(b.Id);
            if (!b.Links.Contains(a.Id)) b.Links.Add(a.Id);
        }

        private static long Key(int x, int y) => ((long)x << 32) ^ (uint)y;
    }
}

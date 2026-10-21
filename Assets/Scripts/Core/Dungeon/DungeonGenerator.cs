using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>
    /// 층 생성기.
    /// 1) 방 수 8~12 (보스 제외) → 2) 최소 개수 배치 → 3) 상인 60% → 4) 남은 칸 가중치로 채움.
    /// 배치는 가지형·순환형·격자형 중 하나. 보스는 시작에서 최단 경로로 가장 먼 방이며,
    /// 보스까지의 길에 갈림길 2개 이상, 막다른 가지 1개 이상이 되도록 다시 만든다.
    /// </summary>
    public static class DungeonGenerator
    {
        private static readonly int[] DX = { 1, -1, 0, 0 };
        private static readonly int[] DY = { 0, 0, 1, -1 };
        private const int MaxAttempts = 400;

        /// <summary>보스·시작을 제외한 방 종류 목록.</summary>
        public static List<RoomType> RollRoomTypes(Rng rng)
        {
            int n = rng.RangeInclusive(GameBalance.MinRooms, GameBalance.MaxRooms);
            var types = new List<RoomType>();
            for (int i = 0; i < GameBalance.MinBattle; i++) types.Add(RoomType.Battle);
            for (int i = 0; i < GameBalance.MinEvent; i++) types.Add(RoomType.Event);
            if (rng.Chance(GameBalance.FirstTreasureChance)) types.Add(RoomType.Treasure);
            for (int i = 0; i < GameBalance.MinRest; i++) types.Add(RoomType.Rest);
            types.Add(RoomType.Return);
            if (rng.Chance(GameBalance.MerchantChance))
            {
                types.Add(RoomType.Merchant);
                if (types.Count > n) n = types.Count; // 칸이 부족하면 방 수를 1 늘린다
            }
            while (types.Count < n)
            {
                int treasure = Count(types, RoomType.Treasure), rest = Count(types, RoomType.Rest);
                var weights = new[]
                {
                    GameBalance.WeightBattle,
                    GameBalance.WeightEvent,
                    treasure >= GameBalance.MaxTreasure ? 0 : GameBalance.WeightTreasure,
                    rest >= GameBalance.MaxRest ? 0 : GameBalance.WeightRest,
                };
                switch (rng.PickWeighted(weights))
                {
                    case 0: types.Add(RoomType.Battle); break;
                    case 1: types.Add(RoomType.Event); break;
                    case 2: types.Add(RoomType.Treasure); break;
                    default: types.Add(RoomType.Rest); break;
                }
            }
            return types;
        }

        private static int Count(List<RoomType> list, RoomType t)
        {
            int n = 0;
            foreach (var x in list) if (x == t) n++;
            return n;
        }

        public static FloorMap Generate(int floor, Rng rng, ICollection<string> excludedEvents = null) =>
            Generate(floor, rng, (LayoutPattern)rng.Range(0, 3), excludedEvents);

        public static FloorMap Generate(int floor, Rng rng, LayoutPattern pattern, ICollection<string> excludedEvents = null)
        {
            var types = RollRoomTypes(rng);
            int total = types.Count + 2; // + 시작 + 보스

            FloorMap best = null;
            int bestScore = int.MinValue;
            for (int attempt = 0; attempt < MaxAttempts; attempt++)
            {
                var map = BuildLayout(floor, pattern, total, rng);
                PlaceBoss(map, rng);
                int branches = map.BranchesOnBossPath();
                int deadEnds = map.DeadEnds();
                bool ok = branches >= GameBalance.MinBranchesOnBossPath && deadEnds >= GameBalance.MinDeadEnds;
                int score = Math.Min(branches, GameBalance.MinBranchesOnBossPath) * 10 + Math.Min(deadEnds, GameBalance.MinDeadEnds) * 10
                            + map.Distances(map.StartId)[map.BossId];
                if (score > bestScore)
                {
                    best = map;
                    bestScore = score;
                }
                if (ok) break;
            }
            AssignTypes(best, types, floor, rng, excludedEvents);
            return best;
        }

        private static FloorMap BuildLayout(int floor, LayoutPattern pattern, int total, Rng rng)
        {
            var map = new FloorMap { Floor = floor, Pattern = pattern };
            var cells = new Dictionary<long, int>();
            int width = int.MaxValue, height = int.MaxValue;
            int startX = 0, startY = 0;
            if (pattern == LayoutPattern.Grid)
            {
                height = Math.Max(2, (int)Math.Floor(Math.Sqrt(total)));
                width = (total + height - 1) / height;
                if (width * height == total) width++; // 여유 칸이 있어야 모양이 다양해진다
                startY = rng.Range(0, height);
            }
            AddRoom(map, cells, startX, startY);

            while (map.Rooms.Count < total)
            {
                // 가지형·순환형은 연결이 적은 방을 우선 늘려 길게 뻗게 한다.
                var candidates = new List<int>();
                foreach (var r in map.Rooms)
                {
                    if (FreeNeighbors(r, cells, width, height, pattern) == 0) continue;
                    int weight = pattern == LayoutPattern.Grid ? 1 : (r.Links.Count <= 1 ? 3 : 1);
                    for (int w = 0; w < weight; w++) candidates.Add(r.Id);
                }
                if (candidates.Count == 0) break;
                var parent = map.Rooms[rng.Pick(candidates)];
                var dirs = new List<int> { 0, 1, 2, 3 };
                rng.Shuffle(dirs);
                foreach (int d in dirs)
                {
                    int nx = parent.X + DX[d], ny = parent.Y + DY[d];
                    if (!Allowed(nx, ny, cells, width, height, pattern)) continue;
                    var child = AddRoom(map, cells, nx, ny);
                    Link(parent, child);
                    break;
                }
            }

            if (pattern == LayoutPattern.Loop) AddExtraLinks(map, cells, rng, rng.RangeInclusive(1, 2), 1.0);
            else if (pattern == LayoutPattern.Grid) AddExtraLinks(map, cells, rng, int.MaxValue, 0.3);
            map.StartId = 0;
            return map;
        }

        private static bool Allowed(int x, int y, Dictionary<long, int> cells, int width, int height, LayoutPattern pattern)
        {
            if (cells.ContainsKey(Key(x, y))) return false;
            if (pattern == LayoutPattern.Grid) return x >= 0 && y >= 0 && x < width && y < height;
            // 가지형·순환형: 시작 방 왼쪽으로는 자라지 않게 해 미니맵이 오른쪽으로 펼쳐지도록 한다.
            return x >= 0 && Math.Abs(y) <= 3;
        }

        private static int FreeNeighbors(Room r, Dictionary<long, int> cells, int width, int height, LayoutPattern pattern)
        {
            int n = 0;
            for (int d = 0; d < 4; d++)
                if (Allowed(r.X + DX[d], r.Y + DY[d], cells, width, height, pattern)) n++;
            return n;
        }

        private static void AddExtraLinks(FloorMap map, Dictionary<long, int> cells, Rng rng, int maxLinks, double chance)
        {
            var pairs = new List<int[]>();
            foreach (var r in map.Rooms)
            {
                for (int d = 0; d < 4; d += 2) // 오른쪽·아래 방향만 보면 쌍이 한 번씩 나온다
                {
                    if (!cells.TryGetValue(Key(r.X + DX[d], r.Y + DY[d]), out int other)) continue;
                    if (!r.Links.Contains(other)) pairs.Add(new[] { r.Id, other });
                }
            }
            rng.Shuffle(pairs);
            int added = 0;
            foreach (var p in pairs)
            {
                if (added >= maxLinks) break;
                if (!rng.Chance(chance)) continue;
                Link(map.Rooms[p[0]], map.Rooms[p[1]]);
                added++;
            }
        }

        private static void PlaceBoss(FloorMap map, Rng rng)
        {
            int[] dist = map.Distances(map.StartId);
            int max = 0;
            foreach (int d in dist) max = Math.Max(max, d);
            var farthest = new List<int>();
            foreach (var r in map.Rooms) if (dist[r.Id] == max) farthest.Add(r.Id);
            // 같은 거리면 막다른 방을 우선
            var leaves = farthest.FindAll(id => map.Rooms[id].Links.Count == 1);
            map.BossId = rng.Pick(leaves.Count > 0 ? leaves : farthest);
        }

        /// <summary>
        /// 방 종류 배치 (v2.4): 전투 방을 빼고 이웃한 방끼리 같은 종류가 되지 않게, 시작 방 바로 옆에는 휴식 방이 오지 않게 한다.
        /// 무작위로 섞은 뒤 규칙을 어기는 방을 다른 방과 바꿔 가며 고친다 (못 고치면 가장 적게 어긴 배치).
        /// </summary>
        private static void AssignTypes(FloorMap map, List<RoomType> types, int floor, Rng rng, ICollection<string> excludedEvents = null)
        {
            var slots = new List<Room>();
            foreach (var r in map.Rooms)
                if (r.Id != map.StartId && r.Id != map.BossId) slots.Add(r);
            var shuffled = new List<RoomType>(types);
            rng.Shuffle(shuffled);
            var assign = new Dictionary<int, RoomType>();
            for (int k = 0; k < slots.Count; k++) assign[slots[k].Id] = shuffled[k];
            FixLayout(map, slots, assign, rng);

            var usedEvents = new HashSet<string>(); // 한 층에 같은 이벤트는 한 번만
            if (excludedEvents != null) foreach (var id in excludedEvents) usedEvents.Add(id);
            foreach (var r in map.Rooms)
            {
                r.Seed = rng.NextSeed();
                if (r.Id == map.StartId)
                {
                    r.Type = RoomType.Start;
                    r.Visited = true;
                    r.Cleared = true;
                }
                else if (r.Id == map.BossId) r.Type = RoomType.Boss;
                else r.Type = assign[r.Id];

                if (r.Type == RoomType.Event)
                {
                    r.EventId = EventDb.PickEvent(rng, floor, usedEvents).Id;
                    usedEvents.Add(r.EventId);
                }
                if (r.Type == RoomType.Merchant) r.MerchantGoods = MerchantGoods(rng);
            }
        }

        private const int LayoutFixTries = 400;

        private static void FixLayout(FloorMap map, List<Room> slots, Dictionary<int, RoomType> assign, Rng rng)
        {
            int bad = Violations(map, assign);
            for (int t = 0; t < LayoutFixTries && bad > 0; t++)
            {
                var a = slots[rng.Range(0, slots.Count)];
                var b = slots[rng.Range(0, slots.Count)];
                if (a.Id == b.Id || assign[a.Id] == assign[b.Id]) continue;
                Swap(assign, a.Id, b.Id);
                int now = Violations(map, assign);
                if (now <= bad) bad = now;
                else Swap(assign, a.Id, b.Id);
            }
        }

        private static void Swap(Dictionary<int, RoomType> assign, int a, int b)
        {
            var tmp = assign[a];
            assign[a] = assign[b];
            assign[b] = tmp;
        }

        /// <summary>규칙을 어긴 수: 이웃한 같은 종류(전투 제외) + 시작 방 옆 휴식 방.</summary>
        public static int Violations(FloorMap map, Dictionary<int, RoomType> assign)
        {
            int n = 0;
            foreach (var r in map.Rooms)
            {
                if (!assign.TryGetValue(r.Id, out var type)) continue;
                foreach (int l in r.Links)
                {
                    if (l == map.StartId && type == RoomType.Rest) n++;
                    if (l < r.Id || !assign.TryGetValue(l, out var other)) continue;
                    if (type == other && type != RoomType.Battle) n++;
                }
            }
            return n;
        }

        /// <summary>이미 만든 층의 규칙 위반 수 (테스트용).</summary>
        public static int Violations(FloorMap map)
        {
            var assign = new Dictionary<int, RoomType>();
            foreach (var r in map.Rooms)
                if (r.Id != map.StartId && r.Id != map.BossId) assign[r.Id] = r.Type;
            return Violations(map, assign);
        }

        /// <summary>
        /// 튜토리얼 1층 고정 배치: 시작 → 전투 → 갈림길(위: 귀환 방 / 오른쪽: 휴식 → 전투 → 약한 보스).
        /// </summary>
        public static FloorMap GenerateTutorial(Rng rng)
        {
            var map = new FloorMap { Floor = 1, Pattern = LayoutPattern.Branch };
            var cells = new Dictionary<long, int>();
            var start = AddRoom(map, cells, 0, 0);
            var battle1 = AddRoom(map, cells, 1, 0);
            var ret = AddRoom(map, cells, 1, -1);
            var rest = AddRoom(map, cells, 2, 0);
            var battle2 = AddRoom(map, cells, 3, 0);
            var boss = AddRoom(map, cells, 4, 0);
            Link(start, battle1);
            Link(battle1, ret);
            Link(battle1, rest);
            Link(rest, battle2);
            Link(battle2, boss);
            start.Type = RoomType.Start;
            start.Visited = start.Cleared = true;
            battle1.Type = RoomType.Battle;
            ret.Type = RoomType.Return;
            rest.Type = RoomType.Rest;
            battle2.Type = RoomType.Battle;
            boss.Type = RoomType.Boss;
            foreach (var r in map.Rooms) r.Seed = rng.NextSeed();
            map.StartId = start.Id;
            map.BossId = boss.Id;
            return map;
        }

        /// <summary>던전 상인 물건: 소모품 5종, 물건마다 2~5개까지만 판다.</summary>
        public static List<ShopGood> MerchantGoods(Rng rng)
        {
            var list = new List<ShopGood>();
            foreach (var id in new[] { "potion", "potion_hi", "antidote", "bandage", "salve" })
                list.Add(new ShopGood { Item = ItemDb.CreateConsumable(id), Stock = rng.RangeInclusive(GameBalance.MerchantStockMin, GameBalance.MerchantStockMax) });
            return list;
        }

        private static Room AddRoom(FloorMap map, Dictionary<long, int> cells, int x, int y)
        {
            var room = new Room { Id = map.Rooms.Count, X = x, Y = y };
            map.Rooms.Add(room);
            cells[Key(x, y)] = room.Id;
            return room;
        }

        private static void Link(Room a, Room b)
        {
            if (!a.Links.Contains(b.Id)) a.Links.Add(b.Id);
            if (!b.Links.Contains(a.Id)) b.Links.Add(a.Id);
        }

        private static long Key(int x, int y) => ((long)x << 32) ^ (uint)y;
    }
}

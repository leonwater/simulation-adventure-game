using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    [Serializable]
    public class Room
    {
        public int Id;
        public RoomType Type;
        /// <summary>미니맵 격자 좌표.</summary>
        public int X, Y;
        public List<int> Links = new List<int>();
        public bool Visited;
        public bool Cleared;
        /// <summary>방 내용(적 구성·보상)을 다시 만들 때 쓰는 시드.</summary>
        public int Seed;
        public string EventId = "";
        /// <summary>상인 방 재고.</summary>
        public List<ShopGood> MerchantGoods = new List<ShopGood>();
        /// <summary>이벤트로 위치와 종류가 공개된 방 (미니맵에 흐리게).</summary>
        public bool Revealed;
        /// <summary>공개됐지만 틀리게 알려진 종류 (갈림길 표지판 실패). -1이면 실제 종류.</summary>
        public int ShownType = -1;
        /// <summary>연쇄 후속 이벤트가 생긴 방 (미니맵에 '!').</summary>
        public bool Chain;
        /// <summary>여러 번 고르는 이벤트(보물 더미·피의 우물)의 진행 단계와 모은 골드.</summary>
        public int EventStep;
        public long EventBank;
        /// <summary>상인의 보답: 마을 가격 × 0.7.</summary>
        public bool MerchantDiscount;

        /// <summary>미니맵·길 선택에 보여 줄 종류.</summary>
        public RoomType DisplayType => !Visited && ShownType >= 0 ? (RoomType)ShownType : Type;
    }

    /// <summary>한 층의 방 배치. 도전할 때마다 새로 만든다.</summary>
    [Serializable]
    public class FloorMap
    {
        public int Floor;
        public LayoutPattern Pattern;
        public List<Room> Rooms = new List<Room>();
        public int StartId;
        public int BossId;

        public Room Get(int id) => id >= 0 && id < Rooms.Count ? Rooms[id] : null;

        public Room Start => Get(StartId);

        public Room Boss => Get(BossId);

        public int CountOf(RoomType type)
        {
            int n = 0;
            foreach (var r in Rooms) if (r.Type == type) n++;
            return n;
        }

        /// <summary>시작 방에서의 최단 거리 (도달 불가 = -1).</summary>
        public int[] Distances(int from)
        {
            var dist = new int[Rooms.Count];
            for (int i = 0; i < dist.Length; i++) dist[i] = -1;
            var queue = new Queue<int>();
            dist[from] = 0;
            queue.Enqueue(from);
            while (queue.Count > 0)
            {
                int cur = queue.Dequeue();
                foreach (int next in Rooms[cur].Links)
                {
                    if (dist[next] >= 0) continue;
                    dist[next] = dist[cur] + 1;
                    queue.Enqueue(next);
                }
            }
            return dist;
        }

        /// <summary>최단 경로 (from → to, 양 끝 포함). 없으면 빈 목록.</summary>
        public List<int> ShortestPath(int from, int to)
        {
            var prev = new int[Rooms.Count];
            for (int i = 0; i < prev.Length; i++) prev[i] = -2;
            var queue = new Queue<int>();
            prev[from] = -1;
            queue.Enqueue(from);
            while (queue.Count > 0)
            {
                int cur = queue.Dequeue();
                if (cur == to) break;
                foreach (int next in Rooms[cur].Links)
                {
                    if (prev[next] != -2) continue;
                    prev[next] = cur;
                    queue.Enqueue(next);
                }
            }
            var path = new List<int>();
            if (prev[to] == -2) return path;
            for (int at = to; at != -1; at = prev[at]) path.Add(at);
            path.Reverse();
            return path;
        }

        /// <summary>보스까지 최단 경로 위의 갈림길 수 (앞으로 고를 수 있는 길이 2개 이상인 방).</summary>
        public int BranchesOnBossPath()
        {
            var path = ShortestPath(StartId, BossId);
            int count = 0;
            for (int i = 0; i < path.Count - 1; i++)
            {
                int forward = Rooms[path[i]].Links.Count - (i == 0 ? 0 : 1);
                if (forward >= 2) count++;
            }
            return count;
        }

        /// <summary>막다른 방 수 (연결이 하나뿐인 방, 시작·보스 제외).</summary>
        public int DeadEnds()
        {
            int count = 0;
            foreach (var r in Rooms)
                if (r.Id != StartId && r.Id != BossId && r.Links.Count == 1) count++;
            return count;
        }

        public bool IsConnected()
        {
            foreach (int d in Distances(StartId)) if (d < 0) return false;
            return true;
        }
    }
}

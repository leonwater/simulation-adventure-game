using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    [Serializable]
    public class Quest
    {
        public string Id = "";
        public QuestKind Kind;
        public string Title = "";
        public Rank Rank;
        public int TargetFloor;
        public string SpeciesId = "";
        public string MaterialId = "";
        public int Required;
        public int Progress;
        public long RewardGold;
        public long RewardExp;
    }

    [Serializable]
    public class GuildState
    {
        public List<Quest> Board = new List<Quest>();
        public List<Quest> Active = new List<Quest>();
    }

    /// <summary>
    /// 길드: 퀘스트 수주·보상, 등급 승급, 창고.
    /// 자기 등급 기준 −1 ~ +1 등급 퀘스트만 수주 가능하며, 지금까지 클리어한 층과 도전 가능한 층만 목표가 된다.
    /// </summary>
    public static class GuildSystem
    {
        public static Rank MinQuestRank(Rank own) => own == Rank.F ? Rank.F : own - 1;

        public static Rank MaxQuestRank(Rank own) => own == Rank.SS ? Rank.SS : own + 1;

        public static bool InRange(Rank own, Rank quest) => quest >= MinQuestRank(own) && quest <= MaxQuestRank(own);

        /// <summary>다음에 도전할 층(최고 도전 가능 층)을 목표로 하는 퀘스트는 게시판에 최소 이만큼.</summary>
        public const int NextFloorQuests = 2;

        /// <summary>
        /// 게시판을 새로 채운다 (마을로 돌아올 때마다, 보스를 잡은 뒤에는 새 층 의뢰가 붙는다).
        /// 1) 다음에 도전할 층의 퀘스트 2개 (수락할 수 있는 등급을 먼저 고른다) 2) 나머지는 수락할 수 있는 등급만.
        /// 같은 대상(몬스터·재료·보스 층)의 퀘스트는 게시판과 진행 중 목록을 통틀어 하나만.
        /// </summary>
        public static void RefreshBoard(GuildState g, Character c, Rng rng)
        {
            g.Board.Clear();
            var used = new HashSet<string>();
            foreach (var q in g.Active) used.Add(Key(q));
            int next = Math.Max(1, c.MaxChallengeFloor);
            int nextCount = g.Active.FindAll(q => q.TargetFloor == next).Count;
            var kinds = new List<QuestKind> { QuestKind.Conquer, QuestKind.Hunt, QuestKind.Collect };
            rng.Shuffle(kinds);
            // 수락 가능한 것부터, 모자라면 등급이 맞지 않아도 붙인다 (승급하면 받을 수 있다)
            for (int pass = 0; pass < 2 && nextCount < NextFloorQuests; pass++)
            {
                foreach (var kind in kinds)
                {
                    if (nextCount >= NextFloorQuests) break;
                    for (int tries = 0; tries < 6; tries++)
                    {
                        var q = Create(c, rng, next, kind);
                        if ((pass == 0 && !InRange(c.Rank, q.Rank)) || !used.Add(Key(q))) continue;
                        g.Board.Add(q);
                        nextCount++;
                        break;
                    }
                }
            }
            for (int tries = 0; g.Board.Count < GameBalance.QuestBoardSize && tries < 80; tries++)
            {
                var q = Generate(c, rng);
                if (InRange(c.Rank, q.Rank) && used.Add(Key(q))) g.Board.Add(q);
            }
            g.Board.Sort((a, b) => b.Rank != a.Rank ? b.Rank.CompareTo(a.Rank) : b.TargetFloor.CompareTo(a.TargetFloor));
        }

        /// <summary>같은 퀘스트인지 가르는 열쇠: 종류 + 대상 (토벌은 몬스터, 채집은 재료, 정복은 층).</summary>
        public static string Key(Quest q)
        {
            switch (q.Kind)
            {
                case QuestKind.Hunt: return "hunt:" + q.SpeciesId;
                case QuestKind.Collect: return "collect:" + q.MaterialId;
                default: return "conquer:" + q.TargetFloor;
            }
        }

        /// <summary>
        /// 퀘스트 난이도 = 목표 층 + 종류 보정. 보스 토벌 +2, 몬스터 토벌 (마릿수 − 3) × 0.5, 재료 채집 (개수 − 2) × 0.5 − 1.
        /// 같은 층이면 보스 토벌 ≥ 몬스터 토벌 ≥ 재료 채집 순으로 어렵다.
        /// </summary>
        public static double Difficulty(Quest q)
        {
            switch (q.Kind)
            {
                case QuestKind.Conquer: return q.TargetFloor + 2;
                case QuestKind.Hunt: return q.TargetFloor + (q.Required - 3) * 0.5;
                default: return q.TargetFloor + (q.Required - 2) * 0.5 - 1;
            }
        }

        /// <summary>난이도 → 등급. 경계는 승급 조건의 돌파 층과 같다 (F 1~2 · E 3~5 · D 6~9 · C 10~14 · B 15~19 · A 20~24 · S 25~27 · SS 28~).</summary>
        public static Rank RankFor(double difficulty)
        {
            var r = Rank.F;
            for (int i = 1; i <= (int)Rank.SS; i++)
                if (difficulty >= GameBalance.PromotionRequirements[i, 0]) r = (Rank)i;
            return r;
        }

        // 등급별 보상 기준 층 (등급 구간의 가운데)
        private static readonly int[] RewardFloor = { 1, 4, 8, 12, 17, 22, 26, 29 };

        /// <summary>등급 보상 범위: 골드 (60 + 기준 층 × 40) × 1.5, 경험치 적 1마리 × 4, 각각 ±15% 무작위.</summary>
        public static void RollReward(Quest q, Rng rng)
        {
            int f = RewardFloor[(int)q.Rank];
            q.RewardGold = (long)Math.Round((60 + f * 40) * 1.5 * (0.85 + rng.NextDouble() * 0.3));
            q.RewardExp = (long)Math.Round(GameBalance.EnemyExp(f) * 4 * (0.85 + rng.NextDouble() * 0.3));
        }

        /// <summary>무작위 퀘스트 하나: 도전 가능 층에서 4층 아래까지, 종류는 보스 2 · 토벌 4 · 채집 4 비율.</summary>
        public static Quest Generate(Character c, Rng rng)
        {
            int top = Math.Max(1, c.MaxChallengeFloor);
            int floor = Math.Max(1, top - rng.RangeInclusive(0, 4));
            int roll = rng.Range(0, 10);
            var kind = roll < 2 ? QuestKind.Conquer : roll < 6 ? QuestKind.Hunt : QuestKind.Collect;
            return Create(c, rng, floor, kind);
        }

        /// <summary>정한 층·종류의 퀘스트. 등급은 난이도로 정하고, 보상은 그 등급 범위에서 무작위.</summary>
        public static Quest Create(Character c, Rng rng, int floor, QuestKind kind)
        {
            var q = new Quest { Id = ItemInstance.NewUid(), Kind = kind, TargetFloor = floor };
            var species = MonsterDb.Get(rng.Pick(MonsterDb.ThemeFor(floor).SpeciesIds));
            switch (kind)
            {
                case QuestKind.Conquer:
                    q.Required = 1;
                    q.Title = floor + "층 보스 토벌";
                    break;
                case QuestKind.Hunt:
                    q.SpeciesId = species.Id;
                    q.Required = rng.RangeInclusive(3, 6);
                    q.Title = species.Name + " 토벌";
                    break;
                default:
                    q.SpeciesId = species.Id;
                    q.MaterialId = species.MaterialId;
                    q.Required = rng.RangeInclusive(2, 5);
                    q.Title = species.MaterialName + " 채집";
                    break;
            }
            q.Rank = RankFor(Difficulty(q));
            RollReward(q, rng);
            return q;
        }

        /// <summary>목표 (수락 전 카드): "고블린 4마리 처치" · "점액 3개 채집" · "보스 처치".</summary>
        public static string GoalText(Quest q)
        {
            switch (q.Kind)
            {
                case QuestKind.Hunt: return q.Required + "마리 처치";
                case QuestKind.Collect: return q.Required + "개 채집";
                default: return "보스 처치";
            }
        }

        public static string ProgressText(Quest q, Character c)
        {
            switch (q.Kind)
            {
                case QuestKind.Hunt: return "진행 " + Math.Min(q.Progress, q.Required) + "/" + q.Required + " 처치";
                case QuestKind.Collect: return "보유 " + Math.Min(c.Inventory.CountOf(q.MaterialId), q.Required) + "/" + q.Required + "개";
                default: return q.Progress >= q.Required ? "보스 처치 완료" : "보스 미처치";
            }
        }

        public static string CannotAcceptReason(GuildState g, Character c, Quest q)
        {
            if (q == null) return "없는 퀘스트입니다";
            if (g.Active.Count >= GameBalance.MaxActiveQuests) return "동시에 " + GameBalance.MaxActiveQuests + "개까지 수락할 수 있습니다";
            if (!InRange(c.Rank, q.Rank)) return MinQuestRank(c.Rank) + " ~ " + MaxQuestRank(c.Rank) + " 등급만 수락할 수 있습니다";
            return null;
        }

        public static bool Accept(GuildState g, Character c, string questId, out string error)
        {
            var q = g.Board.Find(x => x.Id == questId);
            error = CannotAcceptReason(g, c, q);
            if (error != null) return false;
            g.Board.Remove(q);
            g.Active.Add(q);
            return true;
        }

        public static bool Abandon(GuildState g, string questId) => g.Active.RemoveAll(q => q.Id == questId) > 0;

        public static void OnEnemyKilled(GuildState g, string speciesId, int floor)
        {
            foreach (var q in g.Active)
                if (q.Kind == QuestKind.Hunt && q.SpeciesId == speciesId && floor >= q.TargetFloor)
                    q.Progress++;
        }

        public static void OnBossKilled(GuildState g, int floor)
        {
            foreach (var q in g.Active)
                if (q.Kind == QuestKind.Conquer && q.TargetFloor == floor)
                    q.Progress = q.Required;
        }

        public static bool IsComplete(Quest q, Character c)
        {
            if (q.Kind == QuestKind.Collect) return c.Inventory.CountOf(q.MaterialId) >= q.Required;
            return q.Progress >= q.Required;
        }

        /// <summary>완료한 퀘스트를 보고하고 보상을 받는다. 오른 레벨 수를 levelsGained로 돌려준다.</summary>
        public static bool TurnIn(GuildState g, Character c, string questId, out int levelsGained, out string error)
        {
            levelsGained = 0;
            var q = g.Active.Find(x => x.Id == questId);
            if (q == null)
            {
                error = "진행 중인 퀘스트가 아닙니다";
                return false;
            }
            if (!IsComplete(q, c))
            {
                error = "아직 완료하지 않았습니다";
                return false;
            }
            if (q.Kind == QuestKind.Collect) c.Inventory.RemoveTemplate(q.MaterialId, q.Required);
            g.Active.Remove(q);
            c.Gold += q.RewardGold;
            levelsGained = Leveling.AddExp(c, q.RewardExp);
            c.QuestsCompleted++;
            error = null;
            return true;
        }

        // ── 창고: 맡길 때마다 수수료, 찾을 때는 무료 (v1.9) ──

        public static int StorageFee(Character c) => GameBalance.StorageFee(c.HighestFloorCleared);

        public static bool Deposit(Character c, string uid, out string error)
        {
            var item = c.Inventory.Find(uid);
            if (item == null)
            {
                error = "가방에 없는 아이템입니다";
                return false;
            }
            if (!c.Storage.CanAdd(item))
            {
                error = "창고가 가득 찼습니다";
                return false;
            }
            if (!PayFee(c, out error)) return false;
            c.Storage.Add(c.Inventory.Take(uid));
            return true;
        }

        public static bool Withdraw(Character c, string uid, out string error)
        {
            var item = c.Storage.Find(uid);
            if (item == null)
            {
                error = "창고에 없는 아이템입니다";
                return false;
            }
            if (!c.Inventory.CanAdd(item))
            {
                error = "가방이 가득 찼습니다";
                return false;
            }
            c.Inventory.Add(c.Storage.Take(uid));
            error = null;
            return true;
        }

        private static bool PayFee(Character c, out string error)
        {
            int fee = StorageFee(c);
            if (c.Gold < fee)
            {
                error = "수수료 " + fee + "G가 부족합니다";
                return false;
            }
            c.Gold -= fee;
            error = null;
            return true;
        }
    }
}

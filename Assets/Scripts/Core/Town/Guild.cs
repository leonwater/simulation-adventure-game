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
        /// <summary>보상 배율 (등급 −1 = 0.5, 동일 = 1.0, +1 = 1.5).</summary>
        public double RewardMultiplier = 1.0;
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

        public static double RewardMultiplier(Rank own, Rank quest)
        {
            int diff = GameBalance.Clamp((int)quest - (int)own, -1, 1);
            return GameBalance.QuestRewardMultiplier[diff + 1];
        }

        public static bool InRange(Rank own, Rank quest) => quest >= MinQuestRank(own) && quest <= MaxQuestRank(own);

        public static void RefreshBoard(GuildState g, Character c, Rng rng)
        {
            g.Board.Clear();
            for (int i = 0; i < GameBalance.QuestBoardSize; i++) g.Board.Add(Generate(c, rng));
            g.Board.Sort((a, b) => b.Rank.CompareTo(a.Rank));
        }

        public static Quest Generate(Character c, Rng rng)
        {
            Rank min = MinQuestRank(c.Rank), max = MaxQuestRank(c.Rank);
            var rank = (Rank)rng.RangeInclusive((int)min, (int)max);
            int rel = GameBalance.Clamp((int)rank - (int)c.Rank, -1, 1);
            int top = Math.Max(1, c.MaxChallengeFloor);
            int floor;
            if (rel < 0) floor = top - rng.RangeInclusive(2, 4);
            else if (rel == 0) floor = top - rng.RangeInclusive(0, 2);
            else floor = top - rng.RangeInclusive(0, 1);
            floor = GameBalance.Clamp(floor, 1, top);

            var q = new Quest
            {
                Id = ItemInstance.NewUid(),
                Rank = rank,
                TargetFloor = floor,
                RewardMultiplier = RewardMultiplier(c.Rank, rank),
            };

            // 보스 정복은 이미 클리어했거나 지금 도전 가능한 층에서만
            int kindRoll = rng.Range(0, 10);
            var theme = MonsterDb.ThemeFor(floor);
            var species = MonsterDb.Get(rng.Pick(theme.SpeciesIds));
            if (kindRoll < 2)
            {
                q.Kind = QuestKind.Conquer;
                q.Required = 1;
                q.Title = floor + "층 보스 토벌";
            }
            else if (kindRoll < 6)
            {
                q.Kind = QuestKind.Hunt;
                q.SpeciesId = species.Id;
                q.Required = rng.RangeInclusive(3, 5) + (rel > 0 ? 2 : 0);
                q.Title = species.Name + " 토벌";
            }
            else
            {
                q.Kind = QuestKind.Collect;
                q.SpeciesId = species.Id;
                q.MaterialId = species.MaterialId;
                q.Required = rng.RangeInclusive(2, 4) + (rel > 0 ? 1 : 0);
                q.Title = species.MaterialName + " 채집";
            }

            double kindWeight = q.Kind == QuestKind.Conquer ? 2.0 : 1.0 + q.Required * 0.15;
            q.RewardGold = (long)Math.Round((60 + floor * 40) * kindWeight * q.RewardMultiplier);
            q.RewardExp = (long)Math.Round(GameBalance.EnemyExp(floor) * 3 * kindWeight * q.RewardMultiplier);
            return q;
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

        // ── 창고 ──

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
            c.Storage.Add(c.Inventory.Take(uid));
            error = null;
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
    }
}

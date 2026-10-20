using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>저장 파일 전체.</summary>
    [Serializable]
    public class SaveData
    {
        public const int CurrentVersion = 1;

        public int Version = CurrentVersion;
        public Difficulty Difficulty = Difficulty.Normal;
        public Character Character;
        public ShopState Shop = new ShopState();
        public GuildState Guild = new GuildState();
        /// <summary>던전 안이면 진행 상태, 마을이면 null.</summary>
        public DungeonRun Run;
        /// <summary>30층 보스를 처치했는지 (엔딩을 본 뒤에도 계속 플레이 가능).</summary>
        public bool GameCleared;
        /// <summary>마을에서 고른 도전 층.</summary>
        public int SelectedFloor = 1;
        public long SavedAtTicks;
        public long PlaySeconds;
        /// <summary>튜토리얼 단계 (0 = 끝남 또는 예전 저장).</summary>
        public TutorialStage Tutorial = TutorialStage.Done;
        /// <summary>설정에서 튜토리얼을 다시 보는 중 (처음 튜토리얼에는 건너뛰기 버튼이 없다).</summary>
        public bool TutorialReplay;
        /// <summary>이미 보여 준 안내 (다시 켜도 반복하지 않게).</summary>
        public List<string> TipsShown = new List<string>();
        /// <summary>마지막으로 확인한 상점 갱신 시각 (알림 점용).</summary>
        public long ShopSeenTicks;
        /// <summary>스킬 화면에서 확인한 스킬 (새 스킬 알림 점용).</summary>
        public List<string> SeenSkills;
    }

    /// <summary>튜토리얼 진행 (수정 사항 #7).</summary>
    public enum TutorialStage
    {
        Done = 0,
        TownGuide = 1,
        FirstDungeon = 2,
        AfterReturn = 3
    }

    /// <summary>저장소. Unity에서는 파일, 테스트에서는 메모리를 쓴다.</summary>
    public interface ISaveStore
    {
        bool Exists { get; }
        void Write(string json);
        string Read();
        void Delete();
    }

    public class MemorySaveStore : ISaveStore
    {
        public string Content;

        public bool Exists => Content != null;

        public void Write(string json) => Content = json;

        public string Read() => Content;

        public void Delete() => Content = null;
    }

    public static class SaveSystem
    {
        public static void Save(ISaveStore store, SaveData data, DateTime nowUtc)
        {
            data.SavedAtTicks = nowUtc.Ticks;
            store.Write(Json.Serialize(data));
        }

        /// <summary>저장 파일을 읽는다. 없거나 깨졌으면 null.</summary>
        public static SaveData Load(ISaveStore store)
        {
            if (!store.Exists) return null;
            try
            {
                var data = Json.Deserialize<SaveData>(store.Read());
                if (data?.Character == null) return null;
                Repair(data);
                return data;
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>예전 버전 저장이나 일부가 빠진 저장을 쓸 수 있게 고친다.</summary>
        public static void Repair(SaveData d)
        {
            var c = d.Character;
            if (c.BaseStats == null) c.BaseStats = Character.StartingStats(c.Job);
            if (c.Equipment == null) c.Equipment = new Equipment();
            if (c.Equipment.Slots == null || c.Equipment.Slots.Length != Equipment.SlotCount)
            {
                var slots = new ItemInstance[Equipment.SlotCount];
                if (c.Equipment.Slots != null) Array.Copy(c.Equipment.Slots, slots, Math.Min(slots.Length, c.Equipment.Slots.Length));
                c.Equipment.Slots = slots;
            }
            if (c.Inventory == null) c.Inventory = new ItemContainer();
            if (c.Storage == null) c.Storage = new ItemContainer();
            if (c.Skills == null) c.Skills = new SkillSet();
            c.Skills.Learned.RemoveAll(s => s == null || SkillDb.Get(s.SkillId) == null);
            c.Skills.Equipped.RemoveAll(id => !c.Skills.Knows(id));
            c.Inventory.Items.RemoveAll(i => i == null);
            c.Storage.Items.RemoveAll(i => i == null);
            // 능력치 최대값을 넘는 예전 저장: 넘친 만큼 포인트로 돌려준다
            foreach (Stat s in Enum.GetValues(typeof(Stat)))
            {
                int over = c.BaseStats[s] - GameBalance.StatCap;
                if (over <= 0) continue;
                c.BaseStats[s] -= over;
                c.UnspentPoints += over;
            }
            c.RecalculateCapacities();
            c.CurrentHp = GameBalance.Clamp(c.CurrentHp, 0, CharacterStats.MaxHp(c));
            if (d.TipsShown == null) d.TipsShown = new List<string>();
            if (d.SeenSkills == null)
            {
                // 예전 저장: 지금 배운 스킬은 모두 확인한 것으로 본다
                d.SeenSkills = new List<string>();
                foreach (var s in c.Skills.Learned) d.SeenSkills.Add(s.SkillId);
            }
            if (d.Shop == null) d.Shop = new ShopState();
            if (d.Guild == null) d.Guild = new GuildState();
            if (d.Run != null && (d.Run.Map == null || d.Run.Map.Rooms.Count == 0 || d.Run.Current == null)) d.Run = null;
            d.SelectedFloor = GameBalance.Clamp(d.SelectedFloor, 1, c.MaxChallengeFloor);
            d.Version = SaveData.CurrentVersion;
        }
    }
}

using System;
using System.Collections.Generic;

namespace Adventure.Core
{
    /// <summary>
    /// 게임 진행 흐름. 화면(UI)은 이 객체만 보고 상태를 그리며,
    /// 마을 시설 같은 단순 동작은 각 System을 직접 호출한 뒤 Save()를 부른다.
    /// </summary>
    public class GameSession
    {
        private readonly ISaveStore _store;
        private readonly Func<DateTime> _clock;

        public SaveData Data { get; private set; }
        public Rng Rng { get; }

        /// <summary>진행 중인 전투 (없으면 null).</summary>
        public Battle Battle { get; private set; }
        public EventResult LastEvent { get; private set; }
        public LootReport LastLoot { get; private set; }
        public DeathReport LastDeath { get; private set; }
        public ReturnReport LastReturn { get; private set; }
        /// <summary>던전 화면에 띄울 한 줄 알림 (휴식 회복량 등).</summary>
        public string Notice { get; set; } = "";
        /// <summary>방금 30층 보스를 쓰러뜨렸는지 (엔딩 연출용, 한 번 보여 주면 false로 바꾼다).</summary>
        public bool JustClearedGame { get; set; }

        public GameSession(ISaveStore store, Func<DateTime> utcClock = null, int? seed = null)
        {
            _store = store;
            _clock = utcClock ?? (() => DateTime.UtcNow);
            Rng = seed.HasValue ? new Rng(seed.Value) : new Rng();
        }

        public DateTime Now => _clock();
        public Character C => Data?.Character;
        public bool HasGame => Data != null;
        public DungeonRun Run => Data?.Run;
        public bool InDungeon => Data?.Run != null;
        public Difficulty Difficulty => Data?.Difficulty ?? Difficulty.Normal;

        public bool HasSave => _store.Exists && SaveSystem.Load(_store) != null;

        // ── 시작 · 저장 ────────────────────────────────────────

        public void NewGame(string name, Job job, Difficulty difficulty)
        {
            Data = new SaveData { Difficulty = difficulty, Character = Character.Create(name, job), Tutorial = TutorialStage.TownGuide };
            Data.SeenSkills = new List<string>();
            foreach (var sk in C.Skills.Learned) Data.SeenSkills.Add(sk.SkillId);
            ClearTransient();
            EnterTown();
        }

        /// <summary>저장 파일 요약용으로 읽기만 한다 (없으면 null).</summary>
        public SaveData PeekSave() => SaveSystem.Load(_store);

        public bool TipShown(string key) => Data != null && Data.TipsShown.Contains(key);

        /// <summary>안내를 보여 줬다고 기록한다. 처음이면 true.</summary>
        public bool MarkTip(string key)
        {
            if (Data == null || Data.TipsShown.Contains(key)) return false;
            Data.TipsShown.Add(key);
            Save();
            return true;
        }

        /// <summary>스킬 화면에서 아직 확인하지 않은 스킬이 있는지.</summary>
        public bool HasUnseenSkill
        {
            get
            {
                if (Data?.SeenSkills == null) return false;
                foreach (var sk in C.Skills.Learned) if (!Data.SeenSkills.Contains(sk.SkillId)) return true;
                return false;
            }
        }

        public void MarkSkillsSeen()
        {
            if (Data == null) return;
            if (Data.SeenSkills == null) Data.SeenSkills = new List<string>();
            foreach (var sk in C.Skills.Learned) if (!Data.SeenSkills.Contains(sk.SkillId)) Data.SeenSkills.Add(sk.SkillId);
        }

        /// <summary>상점 물건이 바뀐 뒤 아직 상점에 들어가 보지 않았는지.</summary>
        public bool ShopUnseen => Data != null && Data.Shop.LastRefreshTicks > Data.ShopSeenTicks;

        public void MarkShopSeen()
        {
            if (Data != null) Data.ShopSeenTicks = Data.Shop.LastRefreshTicks;
        }

        public void SetTutorial(TutorialStage stage)
        {
            if (Data == null) return;
            Data.Tutorial = stage;
            Save();
        }

        /// <summary>튜토리얼을 처음부터 다시 본다 (설정). 던전 밖에서만.</summary>
        public void RestartTutorial()
        {
            if (Data == null || InDungeon) return;
            Data.Tutorial = TutorialStage.TownGuide;
            Data.TipsShown.Clear();
            Save();
        }

        /// <summary>저장을 불러온다. 던전 안에서 전투 중이었다면 그 방의 전투를 다시 시작한다.</summary>
        public bool Continue()
        {
            var loaded = SaveSystem.Load(_store);
            if (loaded == null) return false;
            Data = loaded;
            ClearTransient();
            if (Data.Run == null) EnterTown(false);
            else if (Data.Run.TrialFloor > 0 && Data.Run.Current.Cleared) FinishTrial(); // 시련을 이기고 결과를 보기 전에 꺼졌다
            else ResumeRoom();
            return true;
        }

        public void Save()
        {
            if (Data != null) SaveSystem.Save(_store, Data, Now);
        }

        public void DeleteSave()
        {
            _store.Delete();
            Data = null;
            ClearTransient();
        }

        private void ClearTransient()
        {
            Battle = null;
            LastEvent = null;
            LastLoot = null;
            Notice = "";
        }

        // ── 마을 ──────────────────────────────────────────────

        /// <summary>마을에 들어올 때: 상점 자동 갱신, 퀘스트 게시판 갱신(던전에서 돌아왔을 때), HP 회복.</summary>
        public void EnterTown(bool refreshBoard = true)
        {
            var c = C;
            c.CurrentHp = CharacterStats.MaxHp(c);
            ShopSystem.EnsureFresh(Data.Shop, c, Now, Rng);
            if (refreshBoard || Data.Guild.Board.Count == 0) GuildSystem.RefreshBoard(Data.Guild, c, Rng);
            Data.SelectedFloor = c.MaxChallengeFloor;
            Save();
        }

        /// <summary>마을 화면이 주기적으로 부른다. 30분이 지났으면 상점 재고를 바꾼다.</summary>
        public bool TickShop()
        {
            if (Data == null || InDungeon) return false;
            bool changed = ShopSystem.EnsureFresh(Data.Shop, C, Now, Rng);
            if (changed) Save();
            return changed;
        }

        public TimeSpan ShopTimeLeft => ShopSystem.TimeUntilRefresh(Data.Shop, Now);

        public void SelectFloor(int floor)
        {
            Data.SelectedFloor = GameBalance.Clamp(floor, 1, C.MaxChallengeFloor);
        }

        // ── 던전 ──────────────────────────────────────────────

        public void EnterDungeon()
        {
            ClearTransient();
            LastReturn = null;
            LastDeath = null;
            bool tutorial = (Data.Tutorial == TutorialStage.TownGuide || Data.Tutorial == TutorialStage.FirstDungeon)
                            && C.HighestFloorCleared == 0 && Data.SelectedFloor == 1;
            if (tutorial)
            {
                var map = DungeonGenerator.GenerateTutorial(Rng);
                C.CurrentHp = CharacterStats.MaxHp(C);
                Data.Run = new DungeonRun { Floor = 1, Map = map, CurrentRoomId = map.StartId, PreviousRoomId = map.StartId, IsTutorial = true };
                Data.Tutorial = TutorialStage.FirstDungeon;
            }
            else
            {
                Data.Run = DungeonSystem.StartRun(C, Data.SelectedFloor, Rng);
                // 튜토리얼을 다시 보는 경우(이미 층을 돌파함)에는 일반 층에서 던전 안내를 이어 간다
                if (Data.Tutorial == TutorialStage.TownGuide) Data.Tutorial = TutorialStage.FirstDungeon;
            }
            Save();
        }

        public RoomEnterResult Move(int roomId)
        {
            ClearTransient();
            var result = DungeonSystem.MoveTo(Data.Run, roomId);
            HandleRoom(result);
            Save();
            return result;
        }

        public bool Teleport(int roomId)
        {
            if (Battle != null) return false;
            ClearTransient();
            bool ok = DungeonSystem.Teleport(Data.Run, roomId);
            if (ok) Save();
            return ok;
        }

        private void HandleRoom(RoomEnterResult result)
        {
            var run = Data.Run;
            switch (result)
            {
                case RoomEnterResult.Battle:
                case RoomEnterResult.Boss:
                    StartRoomBattle(run.Current);
                    break;
                case RoomEnterResult.Treasure:
                    LastLoot = DungeonSystem.OpenTreasure(run, C, Rng);
                    Notice = "보물을 발견했다! " + LastLoot.Describe();
                    break;
                case RoomEnterResult.Rest:
                    int healed = DungeonSystem.Rest(run, C);
                    Notice = "모닥불 곁에서 쉬었다. HP " + healed + " 회복";
                    break;
                case RoomEnterResult.Return:
                    Notice = "귀환 마법진을 발견했다.";
                    break;
            }
        }

        /// <summary>불러온 직후: 끝나지 않은 전투 방이면 전투를 다시 만든다.</summary>
        private void ResumeRoom()
        {
            var run = Data.Run;
            var room = run.Current;
            run.TrialFloor = 0; // 끝나지 않은 이벤트 전투는 이벤트부터 다시 고른다
            if (room.Cleared) return;
            if (room.Type == RoomType.Battle || room.Type == RoomType.Boss) StartRoomBattle(room);
        }

        private void StartRoomBattle(Room room)
        {
            var run = Data.Run;
            bool boss = room.Type == RoomType.Boss;
            if (run.IsTutorial)
            {
                bool first = true;
                foreach (var r in run.Map.Rooms)
                    if (r.Type == RoomType.Battle && r.Cleared && r.Id != room.Id) first = false;
                StartBattle(boss ? EnemyFactory.CreateTutorialBoss(Difficulty) : EnemyFactory.CreateTutorialGroup(first, Difficulty), boss);
                return;
            }
            int extra = ExploreEffects.Has(run.Effects, ExploreEffectType.Drum) ? 1 : 0;
            StartBattle(boss ? EnemyFactory.CreateBoss(run.Floor, Difficulty, room.Seed) : EnemyFactory.CreateGroup(run.Floor, Difficulty, room.Seed, extra), boss);
        }

        /// <summary>지금 방이 아직 끝나지 않은 이벤트 방인지.</summary>
        public EventDef PendingEvent
        {
            get
            {
                var room = Run?.Current;
                if (room == null || room.Cleared || room.Type != RoomType.Event || Battle != null) return null;
                return EventDb.Get(room.EventId);
            }
        }

        /// <summary>전투를 시작한다. 탐험 효과는 기습보다 먼저 걸린다.</summary>
        private void StartBattle(List<Combatant> enemies, bool boss, bool ambush = false, int floor = 0, bool fleeAllowed = false)
        {
            var run = Data.Run;
            Battle = new Battle(C, floor > 0 ? floor : run.Floor, enemies, boss, Rng, ambush, b =>
            {
                b.FleeAllowed = fleeAllowed;
                ExploreEffects.ApplyToBattle(run.Effects, b);
            });
        }

        /// <summary>전투 선택지를 실행한다. 전투가 끝나면 결과를 정산한다.</summary>
        public void ExecuteBattle(BattleChoice choice)
        {
            Battle.Execute(choice);
            if (!Battle.IsOver) return;
            FinishBattle();
        }

        /// <summary>전투가 끝났을 때 결과를 정산한다 (기습으로 시작 직후 끝난 경우 포함).</summary>
        private void FinishBattle()
        {
            var b = Battle;
            b.SyncHp();
            var run = Data.Run;
            bool battleRoom = run.Current.Type == RoomType.Battle;
            if (b.Outcome != BattleOutcome.Defeat) ExploreEffects.AfterBattle(run.Effects, battleRoom);
            switch (b.Outcome)
            {
                case BattleOutcome.Victory:
                    LastLoot = b.CollectRewards(Data.Guild, run);
                    DungeonSystem.ClearCurrent(run);
                    if (run.TrialFloor > 0)
                    {
                        // 시련의 문: 고른 층의 보스를 잡은 것으로 친다 (결과를 닫으면 바로 귀환)
                        C.HighestFloorCleared = Math.Max(C.HighestFloorCleared, run.TrialFloor);
                        GuildSystem.OnBossKilled(Data.Guild, run.TrialFloor);
                        if (run.TrialFloor == run.Floor) run.BossDefeated = true;
                        if (run.TrialFloor >= GameBalance.MaxFloor && !Data.GameCleared)
                        {
                            Data.GameCleared = true;
                            JustClearedGame = true;
                        }
                    }
                    else if (b.IsBoss)
                    {
                        DungeonSystem.OnBossDefeated(run, C, Data.Guild);
                        if (run.Floor >= GameBalance.MaxFloor && !Data.GameCleared)
                        {
                            Data.GameCleared = true;
                            JustClearedGame = true;
                        }
                    }
                    break;
                case BattleOutcome.Fled:
                    // 이벤트 전투에서 도망치면 그 이벤트는 끝난다
                    if (run.Current.Type == RoomType.Event) DungeonSystem.ClearCurrent(run);
                    run.TrialFloor = 0;
                    DungeonSystem.FleeToPrevious(run);
                    Battle = null;
                    Notice = "전투에서 도망쳐 이전 방으로 돌아왔다.";
                    break;
                case BattleOutcome.Defeat:
                    Die(b.KilledBy);
                    return;
            }
            Save();
        }

        /// <summary>전투 결과 화면을 닫을 때 부른다.</summary>
        public void CloseBattle()
        {
            Battle = null;
            if (Run != null && Run.TrialFloor > 0)
            {
                FinishTrial();
                return;
            }
            Save();
        }

        /// <summary>시련을 이긴 뒤: 바로 마을로 돌아가며, 정산에는 시련의 층을 클리어한 것으로 보인다.</summary>
        private void FinishTrial()
        {
            int floor = Run.TrialFloor;
            Run.TrialFloor = 0;
            ReturnToTown();
            LastReturn.Floor = floor;
            LastReturn.BossCleared = true;
        }

        /// <summary>시련을 이겼고 결과 화면을 닫으면 마을로 돌아가는지.</summary>
        public bool TrialWon => Battle != null && Battle.Outcome == BattleOutcome.Victory && Run != null && Run.TrialFloor > 0;

        public EventResult ChooseEvent(int index)
        {
            var run = Data.Run;
            LastEvent = EventRules.Resolve(run, C, index, Rng);
            run.TrialFloor = LastEvent.TrialFloor;
            if (LastEvent.StartBattle)
            {
                int seed = run.Current.Seed;
                switch (LastEvent.Battle)
                {
                    case EventBattle.Gamblers:
                        StartBattle(EnemyFactory.CreateGamblers(run.Floor, Difficulty), false);
                        break;
                    case EventBattle.Normal:
                        StartBattle(EnemyFactory.CreateGroup(run.Floor, Difficulty, seed), false);
                        break;
                    case EventBattle.Wanderer:
                        StartBattle(EnemyFactory.CreateWanderer(run.Floor, Difficulty, seed), false);
                        break;
                    case EventBattle.GoblinChase:
                        StartBattle(EnemyFactory.CreateGoblinChase(run.Floor, Difficulty, seed), false);
                        break;
                    case EventBattle.Trial:
                        StartBattle(EnemyFactory.CreateBoss(run.TrialFloor, Difficulty, run.TrialFloor * 7919), true, false, run.TrialFloor, true);
                        break;
                    default:
                        // 미믹은 상자를 연 순간 기습한다 (궁수가 멀리서 건드리면 기습 없음)
                        StartBattle(EnemyFactory.CreateMimic(Data.Run.Floor, Difficulty), false, LastEvent.Battle == EventBattle.Mimic);
                        break;
                }
                if (Battle.IsOver) FinishBattle();
            }
            else if (LastEvent.ReturnToTown)
            {
                ReturnToTown();
                return LastEvent;
            }
            Save();
            return LastEvent;
        }

        /// <summary>던전 안에서 소모품을 쓴다 (전투 밖).</summary>
        public bool UseConsumable(string uid, out string message)
        {
            var item = C.Inventory.Find(uid);
            var def = item == null ? null : ItemDb.Consumable(item.TemplateId);
            if (def == null)
            {
                message = "사용할 수 없는 아이템입니다";
                return false;
            }
            int max = CharacterStats.MaxHp(C);
            if (def.HealRatio <= 0 || C.CurrentHp >= max)
            {
                message = def.HealRatio > 0 ? "HP가 가득 찼습니다" : "전투 중에만 쓸 수 있습니다";
                return false;
            }
            C.Inventory.Take(uid, 1);
            int before = C.CurrentHp;
            C.CurrentHp = Math.Min(max, C.CurrentHp + (int)Math.Round(max * def.HealRatio));
            message = "HP " + (C.CurrentHp - before) + " 회복";
            Save();
            return true;
        }

        public bool BuyFromMerchant(string uid, int count, out string error)
        {
            var room = Data.Run.Current;
            var state = new ShopState { Goods = room.MerchantGoods };
            bool ok = ShopSystem.BuyGood(state, C, uid, count, out error, MerchantMultiplier);
            if (ok) Save();
            return ok;
        }

        /// <summary>떠돌이 상인은 마을 가격 × 1.2, 구해 준 상인은 × 0.7.</summary>
        public double MerchantMultiplier => Run?.Current != null && Run.Current.MerchantDiscount
            ? GameBalance.MerchantDiscountMultiplier : GameBalance.MerchantPriceMultiplier;

        public int MerchantPrice(ItemInstance item) => (int)Math.Round(item.Price * MerchantMultiplier);

        /// <summary>귀환 방(발견한 경우)·이벤트·보스 처치 후 마을로 돌아간다.</summary>
        public bool CanReturn => InDungeon && Battle == null && (Run.ReturnRoomFound || Run.BossDefeated);

        public void ReturnToTown()
        {
            Battle = null;
            LastReturn = Settlement.Return(C, Data.Run);
            Data.Run = null;
            if (Data.Tutorial == TutorialStage.FirstDungeon) Data.Tutorial = TutorialStage.AfterReturn;
            EnterTown();
        }

        public bool CanDescend => InDungeon && Battle == null && DungeonSystem.CanGoDeeper(Run);

        public void Descend()
        {
            ClearTransient();
            DungeonSystem.Descend(Data.Run, Rng);
            Save();
        }

        private void Die(string killedBy)
        {
            var run = Data.Run;
            LastDeath = Settlement.Die(C, run, Difficulty, killedBy);
            Battle = null;
            Data.Run = null;
            if (Data.Tutorial == TutorialStage.FirstDungeon) Data.Tutorial = TutorialStage.AfterReturn;
            if (LastDeath.HardcoreReset)
            {
                _store.Delete();
                Data = null;
                return;
            }
            EnterTown();
        }
    }
}

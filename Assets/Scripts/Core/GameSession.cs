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
            Data = new SaveData { Difficulty = difficulty, Character = Character.Create(name, job) };
            ClearTransient();
            EnterTown();
        }

        /// <summary>저장을 불러온다. 던전 안에서 전투 중이었다면 그 방의 전투를 다시 시작한다.</summary>
        public bool Continue()
        {
            var loaded = SaveSystem.Load(_store);
            if (loaded == null) return false;
            Data = loaded;
            ClearTransient();
            if (Data.Run == null) EnterTown(false);
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
            Data.Run = DungeonSystem.StartRun(C, Data.SelectedFloor, Rng);
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
                    StartBattle(EnemyFactory.CreateGroup(run.Floor, Difficulty, run.Current.Seed), false);
                    break;
                case RoomEnterResult.Boss:
                    StartBattle(EnemyFactory.CreateBoss(run.Floor, Difficulty, run.Current.Seed), true);
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
            if (room.Cleared) return;
            if (room.Type == RoomType.Battle) StartBattle(EnemyFactory.CreateGroup(run.Floor, Difficulty, room.Seed), false);
            else if (room.Type == RoomType.Boss) StartBattle(EnemyFactory.CreateBoss(run.Floor, Difficulty, room.Seed), true);
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

        private void StartBattle(List<Combatant> enemies, bool boss)
        {
            Battle = new Battle(C, Data.Run.Floor, enemies, boss, Rng);
        }

        /// <summary>전투 선택지를 실행한다. 전투가 끝나면 결과를 정산한다.</summary>
        public void ExecuteBattle(BattleChoice choice)
        {
            var b = Battle;
            b.Execute(choice);
            if (!b.IsOver) return;
            b.SyncHp();
            var run = Data.Run;
            switch (b.Outcome)
            {
                case BattleOutcome.Victory:
                    LastLoot = b.CollectRewards(Data.Guild, run);
                    DungeonSystem.ClearCurrent(run);
                    if (b.IsBoss)
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
            Save();
        }

        public EventResult ChooseEvent(int index)
        {
            LastEvent = EventRules.Resolve(Data.Run, C, index, Rng);
            if (LastEvent.StartBattle)
            {
                StartBattle(EnemyFactory.CreateMimic(Data.Run.Floor, Difficulty), false);
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
            bool ok = ShopSystem.BuyGood(state, C, uid, count, out error, GameBalance.MerchantPriceMultiplier);
            if (ok) Save();
            return ok;
        }

        public int MerchantPrice(ItemInstance item) => (int)Math.Round(item.Price * GameBalance.MerchantPriceMultiplier);

        /// <summary>귀환 방(발견한 경우)·이벤트·보스 처치 후 마을로 돌아간다.</summary>
        public bool CanReturn => InDungeon && Battle == null && (Run.ReturnRoomFound || Run.BossDefeated);

        public void ReturnToTown()
        {
            Battle = null;
            LastReturn = Settlement.Return(C, Data.Run);
            Data.Run = null;
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

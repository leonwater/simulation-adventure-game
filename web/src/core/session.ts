import { B, clamp, expToNext, roundEven } from './balance';
import type { BattleChoice } from './battle';
import { Battle } from './battle';
import type { Character } from './character';
import { createCharacter, maxChallengeFloor, maxHp, tryPromote } from './character';
import type { Combatant } from './combatant';
import * as dungeon from './dungeon';
import type { DungeonRun, RoomEnterResult } from './dungeon';
import { createBoss, createGamblers, createGoblinChase, createGroup, createMimic, createTutorialBoss, createTutorialGroup, createWanderer } from './enemies';
import type { Difficulty, Job, Rank } from './enums';
import type { EventDef } from './events';
import { eventDef } from './events';
import type { EventResult } from './eventrules';
import { resolveEvent, startsBattle } from './eventrules';
import { applyEffectsToBattle, afterBattleEffects, hasEffect } from './explore';
import { generateTutorialFloor } from './generator';
import { onBossKilled, refreshBoard } from './guild';
import type { ItemInstance } from './items';
import { consumableDef, createConsumable, createGear, findItem, takeItem } from './items';
import type { LootReport, RoomNotice } from './loot';
import { applyLoot, collectRewards, newLootReport, roomNotice, withCount } from './loot';
import { Rng } from './rng';
import type { SaveData, SaveStore, TutorialStage } from './save';
import { loadGame, newSaveData, saveGame } from './save';
import type { DeathReport, ReturnReport } from './settlement';
import { die, returnToTown } from './settlement';
import { buyGood, ensureStocked, merchantExtras, refreshPrices, resetRerollCost, sell } from './shop';

/**
 * 게임 진행 흐름. 화면(UI)은 이 객체만 보고 상태를 그리며,
 * 마을 시설 같은 단순 동작은 각 시스템을 직접 호출한 뒤 save()를 부른다.
 */
export class GameSession {
  data: SaveData | null = null;
  readonly rng: Rng;
  /** 진행 중인 전투 (없으면 null). */
  battle: Battle | null = null;
  lastEvent: EventResult | null = null;
  lastLoot: LootReport | null = null;
  lastDeath: DeathReport | null = null;
  lastReturn: ReturnReport | null = null;
  /** 방 안에서 방금 일어난 일. 던전 화면 맨 위에 크게 보여 준다. 없으면 null. */
  notice: RoomNotice | null = null;
  /** 방금 30층 보스를 쓰러뜨렸는지 (엔딩 연출용, 한 번 보여 주면 false로 바꾼다). */
  justClearedGame = false;
  /** 아직 알림을 보여 주지 않은 승급 (오른 등급 순서대로). */
  readonly promotions: Rank[] = [];

  constructor(private readonly store: SaveStore, private readonly clock: () => Date = () => new Date(), seed?: number) {
    this.rng = seed === undefined ? new Rng() : new Rng(seed);
  }

  get now(): Date {
    return this.clock();
  }
  get c(): Character {
    return this.data!.Character;
  }
  get hasGame(): boolean {
    return this.data !== null;
  }
  get run(): DungeonRun | null {
    return this.data?.Run ?? null;
  }
  get inDungeon(): boolean {
    return !!this.data?.Run;
  }
  get difficulty(): Difficulty {
    return this.data?.Difficulty ?? 'Normal';
  }
  get hasSave(): boolean {
    return this.store.exists && loadGame(this.store) !== null;
  }

  // ── 시작 · 저장 ────────────────────────────────────────

  newGame(name: string, job: Job, difficulty: Difficulty): void {
    this.data = newSaveData(difficulty, createCharacter(name, job), 'TownGuide');
    this.data.SeenSkills = this.data.Character.Skills.Learned.map((s) => s.SkillId);
    this.clearTransient();
    this.enterTown();
  }

  /** 저장 파일 요약용으로 읽기만 한다 (없으면 null). */
  peekSave(): SaveData | null {
    return loadGame(this.store);
  }

  tipShown(key: string): boolean {
    return !!this.data && this.data.TipsShown.includes(key);
  }

  /** 안내를 보여 줬다고 기록한다. 처음이면 true. */
  markTip(key: string): boolean {
    if (!this.data || this.data.TipsShown.includes(key)) return false;
    this.data.TipsShown.push(key);
    this.save();
    return true;
  }

  /** 스킬 화면에서 아직 확인하지 않은 스킬이 있는지. */
  get hasUnseenSkill(): boolean {
    const seen = this.data?.SeenSkills;
    if (!seen) return false;
    return this.c.Skills.Learned.some((s) => !seen.includes(s.SkillId));
  }

  markSkillsSeen(): void {
    if (!this.data) return;
    const seen = (this.data.SeenSkills ??= []);
    for (const s of this.c.Skills.Learned) if (!seen.includes(s.SkillId)) seen.push(s.SkillId);
  }

  /** 상점 물건이 바뀐 뒤 아직 상점에 들어가 보지 않았는지. */
  get shopUnseen(): boolean {
    return !!this.data && this.data.Shop.LastRefreshTicks > this.data.ShopSeenTicks;
  }
  markShopSeen(): void {
    if (this.data) this.data.ShopSeenTicks = this.data.Shop.LastRefreshTicks;
  }

  /** 길드에 새 층 의뢰가 붙었는데 아직 길드에 들어가 보지 않았는지. */
  get guildNewQuests(): boolean {
    return !!this.data && this.data.GuildNewFloor > 0;
  }
  markGuildSeen(): void {
    if (this.data && this.data.GuildNewFloor !== 0) {
      this.data.GuildNewFloor = 0;
      this.save();
    }
  }

  setTutorial(stage: TutorialStage): void {
    if (!this.data) return;
    this.data.Tutorial = stage;
    this.save();
  }

  /** 튜토리얼을 처음부터 다시 본다 (설정). 던전 밖에서만. */
  restartTutorial(): void {
    if (!this.data || this.inDungeon) return;
    this.data.Tutorial = 'TownGuide';
    this.data.TipsShown = [];
    this.save();
  }

  /**
   * 저장을 불러온다. 던전 안에서 전투 중이었다면 그 방의 전투를 다시 시작한다.
   * 앱을 업데이트한 뒤 예전 버전의 던전 진행을 이어 가지 못하면 캐릭터는 그대로 두고 마을에서 시작한다.
   */
  continueGame(): boolean {
    const loaded = loadGame(this.store);
    if (!loaded) return false;
    this.data = loaded;
    this.clearTransient();
    if (!this.data.Run) {
      this.enterTown(false);
      return true;
    }
    try {
      const run = this.data.Run;
      if (run.TrialFloor > 0 && dungeon.currentRoom(run).Cleared) this.finishTrial(); // 시련을 이기고 결과를 보기 전에 꺼졌다
      else this.resumeRoom();
    } catch {
      this.data.Run = null;
      this.clearTransient();
      if (this.data.Tutorial === 'FirstDungeon') this.data.Tutorial = 'AfterReturn';
      this.enterTown(false);
    }
    return true;
  }

  /** 저장할 때마다 승급 조건을 확인해 채웠으면 바로 승급한다 (자동 승급). */
  save(): void {
    if (!this.data) return;
    while (tryPromote(this.c)) this.promotions.push(this.c.Rank);
    saveGame(this.store, this.data, this.now);
  }

  deleteSave(): void {
    this.store.delete();
    this.data = null;
    this.clearTransient();
  }

  private clearTransient(): void {
    this.promotions.length = 0;
    this.battle = null;
    this.lastEvent = null;
    this.lastLoot = null;
    this.notice = null;
  }

  // ── 마을 ──────────────────────────────────────────────

  /** 마을에 들어올 때: 상점 첫 채움, 퀘스트 게시판 갱신(던전에서 돌아왔을 때), HP 회복. */
  enterTown(refresh = true): void {
    const d = this.data!;
    const c = d.Character;
    c.CurrentHp = maxHp(c);
    ensureStocked(d.Shop, c, this.now, this.rng);
    if (refresh) resetRerollCost(d.Shop);
    refreshPrices(d.Shop, c);
    if (refresh || d.Guild.Board.length === 0) refreshBoard(d.Guild, c, this.rng);
    d.SelectedFloor = maxChallengeFloor(c);
    this.save();
  }

  selectFloor(floor: number): void {
    this.data!.SelectedFloor = clamp(floor, 1, maxChallengeFloor(this.c));
  }

  // ── 던전 ──────────────────────────────────────────────

  enterDungeon(): void {
    const d = this.data!;
    this.clearTransient();
    this.lastReturn = null;
    this.lastDeath = null;
    // 튜토리얼 던전은 0층 (설정에서 다시 볼 때도). 보상은 클리어 보상뿐이고 돌파 층·퀘스트에 들어가지 않는다
    if (d.Tutorial === 'TownGuide' || d.Tutorial === 'FirstDungeon') {
      d.Character.CurrentHp = maxHp(d.Character);
      d.Run = dungeon.newRun(0, generateTutorialFloor(this.rng));
      d.Run.IsTutorial = true;
      d.Tutorial = 'FirstDungeon';
    } else d.Run = dungeon.startRun(d.Character, d.SelectedFloor, this.rng);
    this.save();
  }

  move(roomId: number): RoomEnterResult {
    this.clearTransient();
    const result = dungeon.moveTo(this.data!.Run!, roomId);
    this.handleRoom(result);
    this.save();
    return result;
  }

  teleport(roomId: number): boolean {
    if (this.battle) return false;
    this.clearTransient();
    const ok = dungeon.teleport(this.data!.Run!, roomId);
    if (ok) this.save();
    return ok;
  }

  private handleRoom(result: RoomEnterResult): void {
    const run = this.data!.Run!;
    switch (result) {
      case 'Battle':
      case 'Boss':
        this.startRoomBattle();
        break;
      case 'Treasure':
        this.lastLoot = dungeon.openTreasure(run, this.c);
        this.notice = roomNotice('보물 발견!', this.lastLoot);
        break;
      case 'Rest': {
        const cursed = hasEffect(run.Effects, 'Curse');
        const healed = dungeon.rest(run, this.c);
        this.notice = roomNotice('모닥불에서 휴식', null, `HP ${healed} 회복`, cursed ? '저주가 풀렸다' : null);
        break;
      }
      case 'Return':
        this.notice = roomNotice('귀환 마법진 발견', null, '이제 언제든 마을로 돌아갈 수 있다');
        break;
    }
  }

  /** 불러온 직후: 끝나지 않은 전투 방이면 전투를 다시 만든다. */
  private resumeRoom(): void {
    const run = this.data!.Run!;
    const room = dungeon.currentRoom(run);
    run.TrialFloor = 0; // 끝나지 않은 이벤트 전투는 이벤트부터 다시 고른다
    if (room.Cleared) return;
    if (room.Type === 'Battle' || room.Type === 'Boss') this.startRoomBattle();
  }

  private startRoomBattle(): void {
    const run = this.data!.Run!;
    const room = dungeon.currentRoom(run);
    const boss = room.Type === 'Boss';
    if (run.IsTutorial) {
      const first = !run.Map.Rooms.some((r) => r.Type === 'Battle' && r.Cleared && r.Id !== room.Id);
      this.startBattle(boss ? createTutorialBoss() : createTutorialGroup(first), boss);
      return;
    }
    const extra = hasEffect(run.Effects, 'Drum') ? 1 : 0;
    this.startBattle(boss ? createBoss(run.Floor, this.difficulty, room.Seed) : createGroup(run.Floor, this.difficulty, room.Seed, extra), boss);
  }

  /** 지금 방이 아직 끝나지 않은 이벤트 방이면 그 이벤트. */
  get pendingEvent(): EventDef | null {
    const room = this.run ? dungeon.currentRoom(this.run) : null;
    if (!room || room.Cleared || room.Type !== 'Event' || this.battle) return null;
    return eventDef(room.EventId);
  }

  /** 전투를 시작한다. 탐험 효과는 기습보다 먼저 걸린다. */
  private startBattle(enemies: Combatant[], boss: boolean, ambush = false, floor = 0, fleeAllowed = false): void {
    const run = this.data!.Run!;
    this.battle = new Battle(this.c, floor > 0 ? floor : run.Floor, enemies, boss, this.rng, {
      ambush,
      cooldowns: run.Cooldowns,
      setup: (b) => {
        b.fleeAllowed = fleeAllowed;
        b.sureHit = run.IsTutorial;
        b.difficulty = this.difficulty;
        applyEffectsToBattle(run.Effects, b);
      },
    });
  }

  /** 전투 선택지를 실행한다. 전투가 끝나면 결과를 정산한다. */
  executeBattle(choice: BattleChoice): void {
    this.battle!.execute(choice);
    if (!this.battle!.isOver) return;
    this.finishBattle();
  }

  /** 전투가 끝났을 때 결과를 정산한다 (기습으로 시작 직후 끝난 경우 포함). */
  private finishBattle(): void {
    const b = this.battle!;
    const d = this.data!;
    b.syncHp();
    const run = d.Run!;
    run.Cooldowns = b.cooldownState();
    const battleRoom = dungeon.currentRoom(run).Type === 'Battle';
    if (b.outcome !== 'Defeat') afterBattleEffects(run.Effects, battleRoom);
    switch (b.outcome) {
      case 'Victory':
        if (run.IsTutorial) {
          // 0층: 전투 보상 없음, 보스를 잡으면 클리어 보상만
          dungeon.clearCurrent(run);
          if (b.isBoss) run.BossDefeated = true;
          this.lastLoot = (b.isBoss ? this.grantTutorialReward() : null) ?? newLootReport();
          this.notice = roomNotice(b.isBoss ? '튜토리얼 클리어!' : '전투 승리', this.lastLoot);
          break;
        }
        this.lastLoot = collectRewards(b, d.Guild, run);
        dungeon.clearCurrent(run);
        this.notice = roomNotice(b.isBoss ? '보스 처치!' : '전투 승리', this.lastLoot);
        if (run.TrialFloor > 0) {
          // 시련의 문: 고른 층의 보스를 잡은 것으로 친다 (결과를 닫으면 바로 귀환)
          d.Character.HighestFloorCleared = Math.max(d.Character.HighestFloorCleared, run.TrialFloor);
          onBossKilled(d.Guild, run.TrialFloor);
          if (run.TrialFloor === run.Floor) run.BossDefeated = true;
          if (run.TrialFloor >= B.MaxFloor && !d.GameCleared) {
            d.GameCleared = true;
            this.justClearedGame = true;
          }
        } else if (b.isBoss) {
          dungeon.onBossDefeated(run, d.Character, d.Guild);
          if (run.Floor >= B.MaxFloor && !d.GameCleared) {
            d.GameCleared = true;
            this.justClearedGame = true;
          }
        }
        break;
      case 'Fled':
        // 이벤트 전투에서 도망치면 그 이벤트는 끝난다
        if (dungeon.currentRoom(run).Type === 'Event') dungeon.clearCurrent(run);
        run.TrialFloor = 0;
        dungeon.fleeToPrevious(run);
        this.battle = null;
        this.notice = roomNotice('도주', null, '전투에서 도망쳐 이전 방으로 돌아왔다');
        break;
      case 'Defeat':
        this.die(b.killedBy);
        return;
    }
    this.save();
  }

  /** 전투 결과 화면을 닫을 때 부른다. */
  closeBattle(): void {
    this.battle = null;
    if (this.run && this.run.TrialFloor > 0) {
      this.finishTrial();
      return;
    }
    this.save();
  }

  /** 시련을 이긴 뒤: 바로 마을로 돌아가며, 정산에는 시련의 층을 클리어한 것으로 보인다. */
  private finishTrial(): void {
    const floor = this.run!.TrialFloor;
    this.run!.TrialFloor = 0;
    this.returnToTown();
    this.lastReturn!.Floor = floor;
    this.lastReturn!.BossCleared = true;
  }

  /** 시련을 이겼고 결과 화면을 닫으면 마을로 돌아가는지. */
  get trialWon(): boolean {
    return !!this.battle && this.battle.outcome === 'Victory' && !!this.run && this.run.TrialFloor > 0;
  }

  chooseEvent(index: number): EventResult {
    const run = this.data!.Run!;
    const result = resolveEvent(run, this.c, index, this.rng);
    this.lastEvent = result;
    run.TrialFloor = result.TrialFloor;
    if (startsBattle(result)) {
      const seed = dungeon.currentRoom(run).Seed;
      const diff = this.difficulty;
      switch (result.Battle) {
        case 'Gamblers': this.startBattle(createGamblers(run.Floor, diff), false); break;
        case 'Normal': this.startBattle(createGroup(run.Floor, diff, seed), false); break;
        case 'Wanderer': this.startBattle(createWanderer(run.Floor, diff, seed), false); break;
        case 'GoblinChase': this.startBattle(createGoblinChase(run.Floor, diff, seed), false); break;
        case 'Trial': this.startBattle(createBoss(run.TrialFloor, diff, run.TrialFloor * 7919), true, false, run.TrialFloor, true); break;
        default:
          // 미믹은 상자를 연 순간 기습한다 (궁수가 멀리서 건드리면 기습 없음)
          this.startBattle(createMimic(run.Floor, diff), false, result.Battle === 'Mimic');
      }
      if (this.battle!.isOver) this.finishBattle();
    } else if (result.ReturnToTown) {
      this.returnToTown();
      return result;
    } else if (!result.Continues) {
      const def = eventDef(dungeon.currentRoom(run).EventId);
      this.notice = roomNotice(def?.Title ?? '특수 이벤트', result.Loot, result.Text, result.HpChange !== 0 ? `HP ${result.HpChange > 0 ? '+' : ''}${result.HpChange}` : null);
    }
    this.save();
    return result;
  }

  /** 던전 안에서 소모품을 쓴다 (전투 밖). */
  useConsumable(uid: string): { ok: boolean; message: string } {
    const item = findItem(this.c.Inventory, uid);
    const def = item ? consumableDef(item.TemplateId) : undefined;
    if (!def) return { ok: false, message: '사용할 수 없는 아이템입니다' };
    const max = maxHp(this.c);
    if (def.HealRatio <= 0 || this.c.CurrentHp >= max) {
      return { ok: false, message: def.HealRatio > 0 ? 'HP가 가득 찼습니다' : '전투 중에만 쓸 수 있습니다' };
    }
    takeItem(this.c.Inventory, uid, 1);
    const before = this.c.CurrentHp;
    this.c.CurrentHp = Math.min(max, this.c.CurrentHp + roundEven(max * def.HealRatio));
    this.save();
    return { ok: true, message: `HP ${this.c.CurrentHp - before} 회복` };
  }

  /** 상인 방에 처음 들어가면 장비·스킬서 덤을 한 번 굴린다 (방 시드로 정해져 다시 들어와도 같다). */
  openMerchant(): void {
    const run = this.data?.Run;
    if (!run) return;
    const room = dungeon.currentRoom(run);
    if (room.Type !== 'Merchant' || room.MerchantExtras) return;
    merchantExtras(room.MerchantGoods, this.c, run.Floor, new Rng(room.Seed ^ 0x5eed));
    room.MerchantExtras = true;
    this.save();
  }

  /** 상인에게 판다 (가격은 마을 상점과 같다). */
  sellToMerchant(uid: string, count: number): { ok: boolean; error: string | null } {
    const r = sell(this.c, uid, count);
    if (r.ok) this.save();
    return r;
  }

  buyFromMerchant(uid: string, count: number): { ok: boolean; error: string | null } {
    const room = dungeon.currentRoom(this.data!.Run!);
    const state = { Equipment: [], Goods: room.MerchantGoods, LastRefreshTicks: 0, RerollCount: 0, Initialized: true };
    const r = buyGood(state, this.c, uid, count, this.merchantMultiplier);
    if (r.ok) this.save();
    return r;
  }

  /** 떠돌이 상인은 마을 가격 × 1.5, 구해 준 상인은 × 0.7. */
  get merchantMultiplier(): number {
    const room = this.run ? dungeon.currentRoom(this.run) : null;
    return room && room.MerchantDiscount ? B.MerchantDiscountMultiplier : B.MerchantPriceMultiplier;
  }
  merchantPrice(item: ItemInstance): number {
    return roundEven(item.Price * this.merchantMultiplier);
  }

  /** 귀환 방(발견한 경우)·이벤트·보스 처치 후 마을로 돌아간다. */
  get canReturn(): boolean {
    // 튜토리얼 던전은 보스를 잡아야만 돌아간다 (귀환 마법진은 안내만)
    return this.inDungeon && !this.battle && (this.run!.BossDefeated || (!this.inTutorialRun && dungeon.returnRoomFound(this.run!)));
  }

  returnToTown(): void {
    const d = this.data!;
    this.battle = null;
    this.lastReturn = returnToTown(d.Character, d.Run!);
    d.Run = null;
    if (d.Tutorial === 'FirstDungeon') d.Tutorial = 'AfterReturn';
    this.enterTown();
    // 보스를 잡아 새 층이 열렸고 그 층 의뢰가 게시판에 붙었으면 길드 알림
    const next = maxChallengeFloor(d.Character);
    if (this.lastReturn && this.lastReturn.BossCleared && d.Guild.Board.some((q) => q.TargetFloor === next)) {
      d.GuildNewFloor = next;
      this.save();
    }
  }

  /** 튜토리얼 던전(0층)인지. 보스를 잡아도 아래층으로 내려갈 수 없고 귀환해야 한다. */
  get inTutorialRun(): boolean {
    return this.inDungeon && this.run!.IsTutorial;
  }

  /** 튜토리얼 클리어 보상 (고급 갑옷 · 회복 물약 1 · 골드 · 레벨 2까지 경험치): 클리어·건너뛰기 중 처음 한 번만. 이미 받았으면 null.
   * 레벨 2: 밸런스 시뮬레이션에서 초반(3·5층 돌파·첫 도전 사망)이 가장 많이 나아진 안 (v3.16). */
  private grantTutorialReward(): LootReport | null {
    const d = this.data!;
    if (d.TutorialReward) return null;
    d.TutorialReward = true;
    const c = d.Character;
    const r: LootReport = {
      ...newLootReport(), Gold: B.TutorialRewardGold, Exp: c.Level === 1 ? expToNext(1) - c.Exp : 0,
      Items: [createGear('Armor', 'Uncommon', 1, c.Job, 'Vitality'), createConsumable('potion', 1)],
    };
    applyLoot(c, null, r);
    if (d.Run) {
      d.Run.GoldEarned += r.Gold;
      d.Run.ExpEarned += r.Exp;
      d.Run.Loot.push(...r.Items.map(withCount));
    }
    return r;
  }

  /** 튜토리얼 건너뛰기: 클리어한 사람과 같은 보상을 주고(처음 한 번), 0층 안이면 바로 마을로 돌아간다. 준 보상(없으면 null). */
  skipTutorial(): LootReport | null {
    const d = this.data!;
    const reward = this.grantTutorialReward();
    if (this.inTutorialRun) {
      d.Run = null;
      this.clearTransient();
      this.enterTown(false);
    }
    d.Tutorial = 'Done';
    this.save();
    return reward;
  }
  get canDescend(): boolean {
    return this.inDungeon && !this.battle && !this.inTutorialRun && dungeon.canGoDeeper(this.run!);
  }
  descend(): void {
    if (!this.canDescend) throw new Error('아직 내려갈 수 없습니다');
    this.clearTransient();
    dungeon.descend(this.data!.Run!, this.rng);
    this.save();
  }

  private die(killedBy: string): void {
    const d = this.data!;
    this.lastDeath = die(d.Character, d.Run, this.difficulty, killedBy);
    this.battle = null;
    d.Run = null;
    if (d.Tutorial === 'FirstDungeon') d.Tutorial = 'AfterReturn';
    if (this.lastDeath.HardcoreReset) {
      this.store.delete();
      this.data = null;
      return;
    }
    this.enterTown();
  }
}

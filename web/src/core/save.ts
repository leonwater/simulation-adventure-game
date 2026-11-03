import { B, clamp } from './balance';
import type { Character } from './character';
import { maxChallengeFloor, maxHp, recalculateCapacities } from './character';
import type { DungeonRun } from './dungeon';
import type { Difficulty } from './enums';
import { SLOTS, STATS } from './enums';
import type { Job } from './enums';
import type { GuildState } from './guild';
import { newGuildState } from './guild';
import { baseValue, materialDef, newContainer } from './items';
import type { ItemInstance } from './items';
import { getStat, jobData, setStat, startingStats } from './jobs';
import { monster } from './monsters';
import type { ShopState } from './shop';
import { newShopState, toTicks } from './shop';
import { skillDef } from './skills';

/** 튜토리얼 진행 (저장에는 이름으로 들어간다). */
export type TutorialStage = 'Done' | 'TownGuide' | 'FirstDungeon' | 'AfterReturn';

/** 저장 파일 전체. 필드 이름은 C# SaveData와 같아서 Unity 버전 저장도 읽는다. */
export interface SaveData {
  /** 저장 파일 버전. 스킬 40개 개편(v2.2)에서 5로 올렸다. */
  Version: number;
  Difficulty: Difficulty;
  Character: Character;
  Shop: ShopState;
  Guild: GuildState;
  /** 던전 안이면 진행 상태, 마을이면 null. */
  Run: DungeonRun | null;
  /** 30층 보스를 처치했는지. */
  GameCleared: boolean;
  /** 마을에서 고른 도전 층. */
  SelectedFloor: number;
  SavedAtTicks: number;
  PlaySeconds: number;
  Tutorial: TutorialStage;
  /** 이미 보여 준 안내. */
  TipsShown: string[];
  /** 마지막으로 확인한 상점 갱신 시각 (알림 점용). */
  ShopSeenTicks: number;
  /** 보스를 잡고 돌아와 길드에 새 층 의뢰가 붙었는데 아직 길드에 가 보지 않은 층 (0 = 없음). */
  GuildNewFloor: number;
  /** 스킬 화면에서 확인한 스킬 (새 스킬 알림 점용). */
  SeenSkills: string[] | null;
}

export const SAVE_VERSION = 7;

export function newSaveData(difficulty: Difficulty, character: Character, tutorial: TutorialStage): SaveData {
  return {
    Version: SAVE_VERSION, Difficulty: difficulty, Character: character, Shop: newShopState(), Guild: newGuildState(), Run: null,
    GameCleared: false, SelectedFloor: 1, SavedAtTicks: 0, PlaySeconds: 0, Tutorial: tutorial, TipsShown: [], ShopSeenTicks: 0,
    GuildNewFloor: 0, SeenSkills: null,
  };
}

/** 저장소. 앱에서는 localStorage, 테스트에서는 메모리를 쓴다. */
export interface SaveStore {
  readonly exists: boolean;
  write(json: string): void;
  read(): string | null;
  delete(): void;
}

export class MemorySaveStore implements SaveStore {
  content: string | null = null;
  get exists(): boolean {
    return this.content !== null;
  }
  write(json: string): void {
    this.content = json;
  }
  read(): string | null {
    return this.content;
  }
  delete(): void {
    this.content = null;
  }
}

/** 브라우저(웹뷰) localStorage에 저장한다. 못 쓰는 환경이면 메모리로만 동작한다. */
export class LocalSaveStore implements SaveStore {
  private memory: string | null = null;
  constructor(private readonly key = 'adventurer.save') {}
  get exists(): boolean {
    return this.read() !== null;
  }
  write(json: string): void {
    this.memory = json;
    try {
      localStorage.setItem(this.key, json);
    } catch {
      /* 저장소를 못 쓰면 메모리만 */
    }
  }
  read(): string | null {
    try {
      return localStorage.getItem(this.key) ?? this.memory;
    } catch {
      return this.memory;
    }
  }
  delete(): void {
    this.memory = null;
    try {
      localStorage.removeItem(this.key);
    } catch {
      /* 무시 */
    }
  }
}

export function saveGame(store: SaveStore, data: SaveData, now: Date): void {
  data.SavedAtTicks = toTicks(now);
  store.write(JSON.stringify(data));
}

/** 저장 파일을 읽는다. 없거나 깨졌으면 null. */
export function loadGame(store: SaveStore): SaveData | null {
  if (!store.exists) return null;
  try {
    const data = JSON.parse(store.read()!) as SaveData;
    if (!data?.Character) return null;
    repair(data);
    return data;
  } catch {
    return null;
  }
}

/**
 * 변환 4 → 5 (스킬 40개 개편): 기존 스킬 ID·장착·수련 단계는 그대로 두고 수치는 데이터에서 다시 읽는다.
 * 사라진 스킬과 그 스킬서는 지우고 하급 스킬서 값(600G)만큼 골드로 돌려준다.
 */
function convertSkillOverhaul(d: SaveData): void {
  const c = d.Character;
  let refund = 0;
  if (c.Skills) refund += c.Skills.Learned.filter((s) => s && !skillDef(s.SkillId)).length;
  for (const box of [c.Inventory, c.Storage]) {
    if (!box) continue;
    const before = box.Items.length;
    box.Items = box.Items.filter((i) => !(i && i.Kind === 'SkillBook' && !skillDef(i.SkillId)));
    refund += before - box.Items.length;
  }
  if (d.Shop) d.Shop.Goods = d.Shop.Goods.filter((g) => !(g?.Item && g.Item.Kind === 'SkillBook' && !skillDef(g.Item.SkillId)));
  c.Gold += refund * B.SkillBookPrice[0];
}

/** v3.5: 콘셉트에 맞춰 바뀐 스킬 (예전 Id → 새 Id) */
const RENAMED_SKILLS: Record<string, string> = { w_ram: 'w_riposte', a_poison: 'a_wind', r_smoke: 'r_shadow' };
/** v3.5 이전 직업 특수 능력치: [능력치 칸, Lv.1 값]. 등급 전용 고유 능력치로 바뀌어 칸이 없어졌다 */
const OLD_SPECIAL: Record<Job, [number, number]> = { Warrior: [6, 10], Archer: [7, 10], Rogue: [8, 12], Mage: [9, 10] };
const REMOVED_STATS = ['Toughness', 'Precision', 'Finesse', 'SpellPower'];

/** 바뀐 몬스터 종류 (예전 Id → 지금 Id): v3.4 단순화, v3.5 몬스터답지 않은 종류 교체 */
const RENAMED_SPECIES: Record<string, string> = {
  kobold: 'rat', gargoyle: 'ghost', lich: 'reaper', lizardman: 'maneater', wyvern: 'snake',
  golem: 'living_armor', troll: 'blood_leech', minotaur: 'imp', dark_elf: 'eye', dragon: 'ancient_golem',
  mushroom: 'maneater', turtle: 'living_armor', wisp: 'blood_leech',
};
/** v3.5: 사라진 드래곤에서 따온 4단계 장비 이름 → 고대 유적 이름 */
const RENAMED_GEAR: Record<string, string> = {
  '용비늘 투구': '고대 투구', '용비늘 갑옷': '고대 갑옷', '용비늘 각반': '고대 각반', '용비늘 장화': '고대 장화', '용의 눈': '고대의 눈',
  '용 반지': '고대 반지', '용린 검': '고대 대검', '용골 활': '고대 장궁', '용아 단검': '고대 단검', '용골 지팡이': '고대 지팡이',
};

/** 예전 버전 저장이나 일부가 빠진 저장을 쓸 수 있게 고친다. */
export function repair(d: SaveData): void {
  const c = d.Character;
  if (!c.BaseStats) c.BaseStats = startingStats(c.Job);
  // v3.5: 특수 능력치 4칸이 사라짐 → 그 직업이 찍은 포인트는 돌려주고 칸을 잘라낸다 (다른 직업 칸은 고정 5라 돌려줄 것 없음)
  if (c.BaseStats.Values.length > STATS.length) {
    const [idx, start] = OLD_SPECIAL[c.Job];
    c.UnspentPoints = (c.UnspentPoints ?? 0) + Math.max(0, (c.BaseStats.Values[idx] ?? start) - start);
    c.BaseStats.Values = c.BaseStats.Values.slice(0, STATS.length);
  }
  if (!c.Equipment) c.Equipment = { Slots: [] };
  if (!c.Equipment.Slots || c.Equipment.Slots.length !== SLOTS.length) {
    const slots = SLOTS.map((_, i) => (c.Equipment.Slots?.[i] ?? null));
    c.Equipment.Slots = slots;
  }
  if (!c.Inventory) c.Inventory = newContainer(B.InventoryStart);
  if (!c.Storage) c.Storage = newContainer(B.StorageBase);
  if (!c.Skills) c.Skills = { Learned: [], Equipped: [] };
  if (d.Version < 5) convertSkillOverhaul(d);
  const renameSkill = (id: string): string => RENAMED_SKILLS[id] ?? id;
  for (const s of c.Skills.Learned) if (s) s.SkillId = renameSkill(s.SkillId);
  c.Skills.Equipped = c.Skills.Equipped.map(renameSkill);
  if (d.SeenSkills) d.SeenSkills = d.SeenSkills.map(renameSkill);
  c.Skills.Learned = c.Skills.Learned.filter((s) => s && skillDef(s.SkillId));
  c.Skills.Equipped = c.Skills.Equipped.filter((id) => c.Skills.Learned.some((s) => s.SkillId === id));
  // 같은 스킬이 여러 칸에 장착된 예전 저장 정리
  c.Skills.Equipped = c.Skills.Equipped.filter((id, i, a) => a.indexOf(id) === i);
  c.Inventory.Items = c.Inventory.Items.filter((i) => i);
  c.Storage.Items = c.Storage.Items.filter((i) => i);
  // 능력치 최대값을 넘는 예전 저장: 넘친 만큼 포인트로 돌려준다
  for (const s of STATS) {
    const over = getStat(c.BaseStats, s) - B.StatCap;
    if (over <= 0) continue;
    setStat(c.BaseStats, s, getStat(c.BaseStats, s) - over);
    c.UnspentPoints += over;
  }
  // 장비 기본 수치는 부위·레벨·등급으로 정해진다: 예전 공식으로 만든 장비도 지금 공식으로
  const gear = [...c.Equipment.Slots, ...c.Inventory.Items, ...c.Storage.Items, ...(d.Shop?.Equipment ?? [])];
  // v3.5: 스킬서는 새 스킬로, 사라진 특수 능력치가 붙은 장신구는 공격 능력치로
  const books: (ItemInstance | null | undefined)[] = [...c.Inventory.Items, ...c.Storage.Items, ...(d.Shop?.Goods ?? []).map((g) => g.Item)];
  for (const i of books) if (i && i.Kind === 'SkillBook' && RENAMED_SKILLS[i.SkillId]) {
    i.SkillId = RENAMED_SKILLS[i.SkillId];
    i.TemplateId = `book_${i.SkillId}`;
    i.Name = `스킬서: ${skillDef(i.SkillId)?.Name ?? ''}`;
  }
  for (const i of gear) if (i && i.Kind === 'Equipment' && REMOVED_STATS.includes(i.BonusStat)) i.BonusStat = jobData(c.Job).attackStat;
  for (const i of gear) if (i && i.Kind === 'Equipment') {
    i.BaseValue = baseValue(i.Gear, i.LevelReq, i.Grade);
    i.Name = RENAMED_GEAR[i.Name] ?? i.Name;
  }
  // v3.11: 가방 15칸 + 5칸씩 → 8칸 + 4칸씩. 예전 저장은 칸이 줄지 않게 산 가방 수를 늘려 준다
  if (d.Version < 7) c.BagsBought = Math.max(0, Math.ceil((Math.min(60, 15 + 5 * (c.BagsBought ?? 0)) - B.InventoryStart) / B.InventoryPerBag));
  recalculateCapacities(c);
  c.CurrentHp = clamp(c.CurrentHp, 0, maxHp(c));
  if (!d.TipsShown) d.TipsShown = [];
  if (!d.SeenSkills) d.SeenSkills = c.Skills.Learned.map((s) => s.SkillId); // 예전 저장: 지금 배운 스킬은 모두 확인한 것으로 본다
  if (!d.Shop) d.Shop = newShopState();
  // v1.7 이전 저장: 스킬서는 1권만
  for (const g of d.Shop.Goods) if (g.Item?.Kind === 'SkillBook') g.Stock = 1;
  if (!d.Guild) d.Guild = newGuildState();
  // 바뀐 몬스터: 의뢰의 종류 Id·제목, 재료 이름을 지금 표에 맞춘다
  for (const q of [...d.Guild.Board, ...d.Guild.Active]) {
    const sp = monster(q.SpeciesId = RENAMED_SPECIES[q.SpeciesId] ?? q.SpeciesId);
    if (sp && q.Kind === 'Hunt') q.Title = `${sp.Name} 토벌`;
    if (sp && q.Kind === 'Collect') q.Title = `${sp.MaterialName} 채집`;
  }
  for (const i of [...c.Inventory.Items, ...c.Storage.Items]) if (i.Kind === 'Material') i.Name = materialDef(i.TemplateId)?.Name ?? i.Name;
  if (d.Run && (!d.Run.Map || d.Run.Map.Rooms.length === 0 || !d.Run.Map.Rooms[d.Run.CurrentRoomId])) d.Run = null;
  if (d.Run === undefined) d.Run = null;
  if (d.Run && !d.Run.Cooldowns) d.Run.Cooldowns = {}; // v3.7: 재사용 대기가 던전 안에서 이어짐
  d.SelectedFloor = clamp(d.SelectedFloor ?? 1, 1, maxChallengeFloor(c));
  d.Version = SAVE_VERSION;
}

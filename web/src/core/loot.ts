import { B, enemyGold } from './balance';
import type { Battle } from './battle';
import type { Character } from './character';
import { addExp, dropBonus } from './character';
import type { EventReward } from './events';
import type { GuildState } from './guild';
import { onEnemyKilled } from './guild';
import type { ItemInstance } from './items';
import { addItem, createConsumable, createDrop, createEnhanceStone, createMaterial, createSkillBook, displayName, rollDropGrade } from './items';
import { rollItemJob } from './jobs';
import { josa } from './names';
import type { Rng } from './rng';
import { obtainableSkills, preferOwnLevel } from './skills';
import type { DungeonRun } from './dungeon';
import { knowsSkill } from './equipment';
import { TIERS } from './enums';
import type { SkillTier } from './enums';

export interface LootReport {
  Gold: number;
  Exp: number;
  Items: ItemInstance[];
  /** 가방이 가득 찼거나 소모품이 99개라 줍지 못한 아이템. */
  Dropped: ItemInstance[];
  LevelsGained: number;
}
export const newLootReport = (): LootReport => ({ Gold: 0, Exp: 0, Items: [], Dropped: [], LevelsGained: 0 });
export const lootIsEmpty = (r: LootReport): boolean => r.Gold === 0 && r.Exp === 0 && r.Items.length === 0;

const withCount = (i: ItemInstance): string => (i.Count > 1 ? `${displayName(i)} ×${i.Count}` : displayName(i));
const num = (n: number): string => n.toLocaleString('en-US');

export function itemNames(items: ItemInstance[], max = 99): string {
  const names = items.slice(0, max).map(withCount);
  let s = names.join(', ');
  if (items.length > max) s += ` 외 ${items.length - max}개`;
  return s;
}

/** 예: "골드 120 · 경험치 300 · 강철 장검, 회복 물약 ×2" */
export function describeLoot(r: LootReport): string {
  const parts: string[] = [];
  if (r.Gold !== 0) parts.push(`골드 ${num(r.Gold)}`);
  if (r.Exp !== 0) parts.push(`경험치 ${num(r.Exp)}`);
  if (r.Items.length > 0) parts.push(itemNames(r.Items));
  if (r.Dropped.length > 0) parts.push(`가방이 가득 차거나 99개라 ${josa(itemNames(r.Dropped), '을/를')} 두고 왔다`);
  return parts.length === 0 ? '아무것도 얻지 못했다' : parts.join(' · ');
}

/** 방 안에서 방금 일어난 일: 제목, 설명 줄, 얻은 것 (던전 화면 맨 위에 크게). */
export interface RoomNotice {
  Title: string;
  Lines: string[];
  Loot: LootReport | null;
}
export const roomNotice = (title: string, loot: LootReport | null, ...lines: (string | null | undefined)[]): RoomNotice => ({
  Title: title, Loot: loot, Lines: lines.filter((l): l is string => !!l),
});

/** 얻은 것을 한 줄씩: 골드, 경험치, 아이템 하나하나, 두고 온 것. */
export function lootLines(n: RoomNotice): string[] {
  const list: string[] = [];
  const l = n.Loot;
  if (!l) return list;
  if (l.Gold !== 0) list.push(`골드 ${l.Gold > 0 ? '+' : ''}${num(l.Gold)}`);
  if (l.Exp !== 0) list.push(`경험치 +${num(l.Exp)}`);
  for (const i of l.Items) list.push(withCount(i));
  if (l.Dropped.length > 0) list.push(`가방이 가득 차거나 99개라 두고 옴: ${itemNames(l.Dropped)}`);
  if (l.LevelsGained > 0) list.push(`레벨 업! +${l.LevelsGained}`);
  return list;
}

export const randomEquipment = (floor: number, c: Character, rng: Rng, bossLevel: number): ItemInstance =>
  createDrop(rng, rollDropGrade(rng, floor, bossLevel), floor, c);

/**
 * 스킬서 드롭: 지금 직업 70%·다른 직업 각 10%, 장착 레벨이 지금 레벨 + 5 이하인 것만,
 * 지금 레벨보다 높은 것은 절반 확률로 뺀다. 그중 가장 높은 단계를 우선하고(최상급은 25% 확률로만), 아직 배우지 않은 스킬을 먼저 고른다.
 */
export function highSkillBook(c: Character, rng: Rng): ItemInstance {
  const list = preferOwnLevel(obtainableSkills(c.Level, rollItemJob(c.Job, rng)), c.Level, rng);
  let best = 0;
  for (const s of list) {
    const t = (TIERS as readonly SkillTier[]).indexOf(s.Tier);
    if (t > best && (s.Tier !== 'Top' || rng.chance(0.25))) best = t;
  }
  const pick = list.filter((s) => s.Tier === TIERS[best]);
  const unknown = pick.filter((s) => !knowsSkill(c, s.Id));
  return createSkillBook(rng.pick(unknown.length > 0 ? unknown : pick).Id);
}

const stonesDropOn = (floor: number): boolean => floor >= B.StoneFirstFloor;

export function treasure(floor: number, c: Character, rng: Rng): LootReport {
  const r = newLootReport();
  r.Gold = enemyGold(floor) * rng.rangeInclusive(3, 5); // v2.7: ×5~8 → ×3~5
  if (rng.chance(0.6)) r.Items.push(randomEquipment(floor, c, rng, 1));
  if (rng.chance(0.35)) r.Items.push(createConsumable(rng.chance(0.7) ? 'potion' : 'potion_hi', rng.rangeInclusive(1, 2)));
  if (stonesDropOn(floor) && rng.chance(0.15)) r.Items.push(createEnhanceStone());
  if (rng.chance(0.05)) r.Items.push(highSkillBook(c, rng));
  return r;
}

export function createEventReward(reward: EventReward, floor: number, c: Character, rng: Rng): ItemInstance | null {
  switch (reward) {
    case 'Potion': return createConsumable('potion');
    case 'HighPotion': return createConsumable('potion_hi');
    case 'Equipment': return randomEquipment(floor, c, rng, 1);
    case 'HighSkillBook': return highSkillBook(c, rng);
    case 'EnhanceStone': return createEnhanceStone();
    default: return null;
  }
}

/** 보상을 캐릭터에 넣는다. 들어가지 않는 아이템은 Dropped로 옮긴다. */
export function applyLoot(c: Character, run: DungeonRun | null, report: LootReport): void {
  if (report.Gold !== 0) {
    c.Gold = Math.max(0, c.Gold + report.Gold);
    if (run && report.Gold > 0) run.GoldEarned += report.Gold;
  }
  if (report.Exp > 0) {
    report.LevelsGained += addExp(c, report.Exp);
    if (run) run.ExpEarned += report.Exp;
  }
  const kept: ItemInstance[] = [];
  for (const item of report.Items) {
    const label = withCount(item);
    if (addItem(c.Inventory, item)) {
      kept.push(item);
      run?.Loot.push(label);
    } else report.Dropped.push(item);
  }
  report.Items = kept;
}

// ── 전투 보상 ─────────────────────────────────────────────

function rollDrops(b: Battle, e: Battle['defeated'][number], drop: number, report: LootReport): void {
  const rng = b.rng;
  const role = e.role;
  if (e.species?.MaterialId && rng.chance(Math.min(1, B.MaterialDrop * drop))) report.Items.push(createMaterial(e.species.MaterialId, role === 2 ? 3 : 1));
  const equip = e.guaranteedEquipment ? 1 : role === 2 ? B.EquipDropBoss : role === 1 ? B.EquipDropElite : B.EquipDropNormal;
  if (rng.chance(Math.min(1, equip * drop))) report.Items.push(randomEquipment(b.floor, b.character, rng, Math.max(role, e.guaranteedEquipment ? 1 : 0)));
  const book = role === 2 ? B.SkillBookDropBoss : role === 1 ? B.SkillBookDropElite : B.SkillBookDropNormal;
  if (rng.chance(book * drop)) report.Items.push(highSkillBook(b.character, rng));
  if (!stonesDropOn(b.floor)) return; // 강화석은 10층부터
  if (role === 2) report.Items.push(createEnhanceStone(B.StoneDropBoss));
  else if (rng.chance((role === 1 ? B.StoneDropElite : B.StoneDropNormal) * drop)) report.Items.push(createEnhanceStone());
}

/** 승리 보상: 경험치·골드·드롭. 퀘스트 처치 기록도 여기서 한다. */
export function collectRewards(b: Battle, guild: GuildState | null, run: DungeonRun | null): LootReport {
  const report = newLootReport();
  if (b.outcome !== 'Victory') return report;
  const drop = dropBonus(b.character) * b.dropMultiplier;
  for (const e of b.defeated) {
    if (e.noReward) continue;
    report.Exp += e.expReward;
    report.Gold += e.goldReward;
    if (e.species && guild) onEnemyKilled(guild, e.species.Id, b.floor);
    rollDrops(b, e, drop, report);
  }
  if (run) run.EnemiesDefeated += b.defeated.filter((e) => !e.noReward).length;
  applyLoot(b.character, run, report);
  return report;
}


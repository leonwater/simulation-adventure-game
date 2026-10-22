import type { BattleChoice } from '../core/battle';
import { Battle } from '../core/battle';
import { autoAllocate, equipped, maxChallengeFloor, maxHp } from '../core/character';
import { cannotEquipReason, enhance, equip, equipSkill, replacedBy, summary, trainSkill, trainingCost, useSkillBook } from '../core/equipment';
import * as dungeon from '../core/dungeon';
import { successChance, unavailableReason, visibleChoices } from '../core/eventrules';
import { acceptQuest, isQuestComplete, turnInQuest } from '../core/guild';
import { countOf, freeCells, goldCost } from '../core/items';
import type { GameSession } from '../core/session';
import { bagPrice, buyBag, buyGood, canBuyBag, sell } from '../core/shop';
import type { SkillDef } from '../core/skills';
import { skillDef } from '../core/skills';

/** 자동 플레이 봇 (테스트와 밸런스 시뮬레이션이 같이 쓴다). C# BotPlayer와 같은 행동 규칙. */

export function prepareInTown(s: GameSession): void {
  const c = s.c;
  const d = s.data!;
  autoAllocate(c);
  // 완료한 퀘스트 보고, 새 퀘스트 수주
  for (const q of [...d.Guild.Active]) if (isQuestComplete(q, c)) turnInQuest(d.Guild, c, q.Id);
  while (d.Guild.Active.length < 3 && d.Guild.Board.length > 0) if (!acceptQuest(d.Guild, c, d.Guild.Board[0].Id).ok) break;
  // 스킬서 사용, 스킬 장착
  for (const item of [...c.Inventory.Items]) if (item.Kind === 'SkillBook') useSkillBook(c, item.Uid);
  for (const st of c.Skills.Learned) equipSkill(c, st.SkillId);
  // 더 좋은 장비 착용
  for (const item of [...c.Inventory.Items]) {
    if (item.Kind !== 'Equipment' || cannotEquipReason(c, item) != null) continue;
    if (replacedBy(c, item) == null || (summary(c, item)?.delta ?? 0) > 0) equip(c, item.Uid);
  }
  // 쓸모없는 장비와 재료 판매 (퀘스트 재료는 남김)
  for (const item of [...c.Inventory.Items]) {
    const questMat = d.Guild.Active.some((q) => q.MaterialId === item.TemplateId);
    if (item.Kind === 'Equipment' || (item.Kind === 'Material' && !questMat)) sell(c, item.Uid, item.Count);
  }
  // 강화와 수련
  const weapon = equipped(c, 'Weapon');
  if (weapon && c.Gold > goldCost(weapon) * 3) enhance(c, weapon.Uid, s.rng);
  for (const st of c.Skills.Learned) if (c.Gold > trainingCost(st) * 4 && trainingCost(st) > 0) trainSkill(c, st.SkillId);
  // 물약 구매
  const potion = d.Shop.Goods.find((g) => g.Item.TemplateId === 'potion');
  const need = 6 - countOf(c.Inventory, 'potion');
  if (potion && need > 0 && c.Gold > 50 * need) buyGood(d.Shop, c, potion.Item.Uid, need);
  if (freeCells(c.Inventory) < 4 && canBuyBag(c) && c.Gold > bagPrice(c) * 2) buyBag(c);
  // 레벨이 모자라면 낮은 층에서 레벨을 올린다 (레벨 ≈ 층 × 1.7)
  let floor = maxChallengeFloor(c);
  while (floor > 1 && c.Level < Math.round(floor * 1.7)) floor--;
  s.selectFloor(floor);
  s.save();
}

/** 던전 안에서 한 걸음. */
export function step(s: GameSession): void {
  const c = s.c;
  if (s.battle) {
    if (s.battle.isOver) {
      s.closeBattle();
      return;
    }
    s.executeBattle(pickBattleChoice(s.battle));
    return;
  }
  const ev = s.pendingEvent;
  if (ev) {
    let best = -1;
    let bestP = -1;
    for (const i of visibleChoices(ev, c, s.run)) {
      const ch = ev.Choices[i];
      if (unavailableReason(ev, i, s.run!, c) != null) continue;
      let p = successChance(ch, c, s.run!.Floor);
      if (ch.Success.ReturnToTown) p = c.CurrentHp < maxHp(c) / 3 ? 2 : -1;
      if (p > bestP) {
        bestP = p;
        best = i;
      }
    }
    s.chooseEvent(best);
    return;
  }
  const run = s.run!;
  const room = dungeon.currentRoom(run);
  if (room.Type === 'Merchant') {
    const potion = room.MerchantGoods.find((g) => g.Item.TemplateId === 'potion');
    if (potion && countOf(c.Inventory, 'potion') < 2 && c.Gold > 200) s.buyFromMerchant(potion.Item.Uid, 2);
  }
  // HP가 낮으면 물약을 마시거나 돌아간다
  const max = maxHp(c);
  if (c.CurrentHp < max / 2) {
    const p = c.Inventory.Items.find((i) => i.TemplateId === 'potion' || i.TemplateId === 'potion_hi');
    if (p) {
      s.useConsumable(p.Uid);
      return;
    }
    if (s.canReturn) {
      s.returnToTown();
      return;
    }
  }
  if (run.BossDefeated) {
    if (s.canDescend && c.CurrentHp > max * 0.6) s.descend();
    else s.returnToTown();
    return;
  }
  const options = dungeon.moveOptions(run, s.difficulty);
  const fresh = options.find((o) => !o.Room.Visited);
  if (fresh) {
    s.move(fresh.Room.Id);
    return;
  }
  // 주변을 다 봤으면 아직 안 간 방과 이웃한 탐험한 방으로 텔레포트
  for (const r of dungeon.teleportTargets(run)) {
    if (r.Links.some((l) => !run.Map.Rooms[l].Visited)) {
      s.teleport(r.Id);
      return;
    }
  }
  s.move(options[0].Room.Id);
}

/** 봇이 보는 스킬 값: 피해 배율 × 때리는 수(광역은 살아 있는 적 수 반영), 버프는 아직 안 걸려 있을 때만. */
function skillValue(b: Battle, def: SkillDef | null): number {
  if (!def) return 0;
  const alive = b.enemies.filter((e) => e.alive).length;
  if (def.Target === 'Self') {
    for (const st of def.Statuses) if (b.player.statuses.has(st.Type)) return -1;
    return 0.6;
  }
  if (!def.IsAttack) return 0.4 * alive; // 광역 약화 등
  const mult = def.ChainMults.length > 0 ? def.ChainMults.reduce((a, m) => a + m, 0) : def.DamageMult * def.Hits;
  const targets = def.Target === 'AllEnemies' ? alive : def.Target === 'MultiEnemy' ? Math.min(def.TargetCount, alive) : 1;
  return 0.5 + mult * targets * 0.25;
}

export function pickBattleChoice(b: Battle): BattleChoice {
  const all = b.getChoices();
  if (all.length === 1) return all[0];
  if (b.player.hpRatio < 0.35) {
    const heal = b.getItemChoices().find((x) => x.enabled && x.label.includes('회복'));
    if (heal) return heal;
    // 물약도 없으면 도망친다 (보스전 제외)
    const flee = all.find((x) => x.kind === 'Flee' && x.enabled);
    if (flee && b.player.hpRatio < 0.25) return flee;
  }
  let best: BattleChoice | null = null;
  let bestScore = -Infinity;
  for (const ch of all) {
    if (!ch.enabled || ch.kind === 'Item' || ch.kind === 'Flee') continue;
    let score = ch.chance;
    if (ch.kind === 'Skill') score += skillValue(b, skillDef(ch.skillId));
    if (ch.target >= 0) score += 1 - b.enemies[ch.target].hpRatio;
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return best ?? all.find((x) => x.enabled)!;
}


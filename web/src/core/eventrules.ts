import { B, clamp, enemyExp, enemyGold, eventChance, eventRequirement, roundEven } from './balance';
import type { Character } from './character';
import { maxHp, totalStat } from './character';
import { createBoss } from './enemies';
import type { ItemGrade, Stat } from './enums';
import { GRADES, JOBS, ord } from './enums';
import type { EventChoice, EventDef, EventOutcome } from './events';
import { eventDef } from './events';
import type { EventBattle } from './events';
import { addEffect } from './explore';
import type { DungeonRun } from './dungeon';
import { currentRoom } from './dungeon';
import { consumableDef, countOf, createConsumable, createDrop, removeTemplate, rollDropGrade } from './items';
import type { LootReport } from './loot';
import { applyLoot, createEventReward, newLootReport, randomEquipment, treasure } from './loot';
import { becomeMerchant, chainEvent, findReturn, linkBoss, revealRooms, spawnTreasure } from './mapevents';
import type { Room } from './map';
import { Names } from './names';
import { Rng } from './rng';
import type { EventReward } from './events';
import { jobData } from './jobs';

export interface EventResult {
  Success: boolean;
  Text: string;
  HpChange: number;
  Loot: LootReport;
  ReturnToTown: boolean;
  Battle: EventBattle;
  /** 같은 이벤트가 이어진다 (보물 더미·피의 우물에서 다시 고르기). */
  Continues: boolean;
  /** 시련의 문에서 고른 보스 층. */
  TrialFloor: number;
}
const newResult = (): EventResult => ({ Success: false, Text: '', HpChange: 0, Loot: newLootReport(), ReturnToTown: false, Battle: 'None', Continues: false, TrialFloor: 0 });
export const startsBattle = (r: EventResult): boolean => r.Battle !== 'None';

/** 스핑크스의 수수께끼: [문제, 정답, 오답, 오답] (화면에서는 방 시드로 섞는다). */
export const RIDDLES: string[][] = [
  ['아침에는 네 발, 점심에는 두 발, 저녁에는 세 발로 걷는 것은?', '사람', '고양이', '시계'],
  ['이름을 부르는 순간 깨지는 것은?', '침묵', '거울', '약속'],
  ['깨뜨려야 쓸 수 있는 것은?', '달걀', '유리병', '얼음'],
  ['날개 없이 날고, 눈 없이 우는 것은?', '구름', '박쥐', '바람개비'],
  ['많아질수록 보이지 않는 것은?', '어둠', '별', '안개'],
  ['가져갈수록 커지는 것은?', '구덩이', '주머니', '그림자'],
];

const TRAP_CHANCES = [0.15, 0.3, 0.5, 0.7];
/** 피의 우물: 바칠 때마다 경험치 배수. */
const BLOOD_REWARDS = [1, 1, 3, 3, 6];
/** 피의 우물: 바칠 때마다 나쁜 효과가 붙을 확률 (반복할수록 오른다). */
export const BLOOD_RISK = [0.1, 0.2, 0.35, 0.5, 0.65];

const num = (n: number): string => n.toLocaleString('en-US');

export const checkStat = (choice: EventChoice, c: Character): Stat | null => (choice.CheckAttackStat ? jobData(c.Job).attackStat : choice.Check);

const bloodCost = (c: Character): number => roundEven(maxHp(c) * 0.1);
export const goldAmount = (mult: number, floor: number): number => roundEven(enemyGold(floor) * mult);
export const trapChance = (step: number, c: Character): number =>
  Math.max(0, TRAP_CHANCES[Math.min(step, TRAP_CHANCES.length - 1)] - totalStat(c, 'Luck') * B.EventBonusPerLuck);

const sphinxRiddle = (room: Room): string[] => RIDDLES[(room.Seed & 0x7fffffff) % RIDDLES.length];
const sphinxCorrect = (room: Room): number => ((room.Seed >> 4) & 0x7fffffff) % 3;
/** 화면에 보일 답 3개의 순서 (정답 위치는 방 시드로 정한다). */
function sphinxAnswers(room: Room): string[] {
  const r = sphinxRiddle(room);
  const correct = sphinxCorrect(room);
  const wrong = [r[2], r[3]];
  let w = 0;
  return [0, 1, 2].map((i) => (i === correct ? r[1] : wrong[w++]));
}
/** 지능이 요구치 이상이면 지워 주는 오답 (없으면 -1). */
export function sphinxRemoved(run: DungeonRun, c: Character): number {
  const room = currentRoom(run);
  if (totalStat(c, 'Intelligence') < eventRequirement(run.Floor)) return -1;
  return (sphinxCorrect(room) + 1 + ((room.Seed >> 8) & 1)) % 3;
}

// 운명의 카드: 0 대길 · 1 길 · 2 흉
function fateOrder(room: Room): number[] {
  const order = [0, 1, 2];
  new Rng(room.Seed).shuffle(order);
  return order;
}
const fateName = (fate: number): string => (fate === 0 ? '대길' : fate === 1 ? '길' : '흉');
/** 행운이 요구치 이상이면 미리 보여 주는 카드 (없으면 -1). */
export const fatePeek = (room: Room, c: Character, floor: number): number =>
  totalStat(c, 'Luck') >= eventRequirement(floor) ? ((room.Seed >> 6) & 0x7fffffff) % 3 : -1;

function trialBossName(floor: number): string {
  const list = createBoss(floor, 'Normal', floor * 7919);
  return list.length > 0 ? list[0].name : '보스';
}

/** 이 캐릭터에게 보이는 선택지 번호 (직업 전용 선택지 포함). */
export function visibleChoices(def: EventDef, c: Character, run: DungeonRun | null = null): number[] {
  const list: number[] = [];
  for (let i = 0; i < def.Choices.length; i++) {
    if (def.Choices[i].JobOnly >= 0 && def.Choices[i].JobOnly !== ord(JOBS, c.Job)) continue;
    if (run && def.Special === 'TrialGate' && i < 3) {
      // 이미 잡은 이 층 보스, 30층을 넘는 시련은 보이지 않는다
      if (i === 0 && run.BossDefeated) continue;
      if (run.Floor + i > B.MaxFloor) continue;
    }
    if (run && def.Special === 'Sphinx' && i === sphinxRemoved(run, c)) continue;
    list.push(i);
  }
  return list;
}

/** 선택지 이름 (스핑크스 답·카드·시련의 보스처럼 상황에 따라 바뀌는 것 포함). */
export function choiceLabel(def: EventDef, index: number, run: DungeonRun | null, c: Character): string {
  const room = run ? currentRoom(run) : null;
  if (room && index < 3) {
    if (def.Special === 'Sphinx') return sphinxAnswers(room)[index];
    if (def.Special === 'FateCards') {
      const peek = fatePeek(room, c, run!.Floor);
      return def.Choices[index].Label + (peek === index ? ` (${fateName(fateOrder(room)[index])})` : '');
    }
  }
  if (def.Special === 'TrialGate' && index < 3 && run) return `${def.Choices[index].Label} · ${trialBossName(run.Floor + index)}`;
  return def.Choices[index].Label;
}

/** 이벤트 본문 (스핑크스는 문제를 덧붙인다). */
export function eventBody(def: EventDef, run: DungeonRun | null, c: Character): string {
  const room = run ? currentRoom(run) : null;
  if (def.Special === 'Sphinx' && room) {
    let q = `\n\n"${sphinxRiddle(room)[0]}"`;
    if (sphinxRemoved(run!, c) >= 0) q += '\n(지능 덕분에 틀린 답 하나가 보인다.)';
    return def.Body + q;
  }
  if (def.Special === 'FateCards' && room && fatePeek(room, c, run!.Floor) >= 0) return `${def.Body}\n\n(행운 덕분에 카드 한 장이 살짝 보인다.)`;
  return def.Body;
}

/** 특별한 이벤트 선택지의 작은 안내: 대가와 지금 상태만 알린다. */
export function specialHint(def: EventDef, index: number, run: DungeonRun | null, _c: Character): string | null {
  const room = run ? currentRoom(run) : null;
  if (!room) return null;
  switch (def.Special) {
    case 'TreasurePile': return index === 0 ? '함정이 있을지도 모른다' : `모은 골드 ${num(room.EventBank)}G 챙기기`;
    case 'BloodWell': return index === 0 ? (room.EventStep >= BLOOD_REWARDS.length ? '더 바칠 수 없다' : '최대 HP 10% 소모') : null;
    case 'Sphinx': return index < 3 ? '틀리면 HP를 잃는다' : null;
  }
  return null;
}

export function successChance(choice: EventChoice, c: Character, floor: number): number {
  const stat = checkStat(choice, c);
  if (stat == null) return choice.FixedChance;
  return eventChance(totalStat(c, stat), eventRequirement(floor), totalStat(c, 'Luck'));
}

/** 길게 눌렀을 때 보여 줄 성공률 계산 내역. */
export function breakdown(choice: EventChoice, c: Character, floor: number): string {
  const stat = checkStat(choice, c);
  const chance = successChance(choice, c, floor);
  const pct = (v: number): number => roundEven(v * 100);
  if (stat == null) return `능력치 판정 없음\n성공 확률 ${pct(chance)}%`;
  const have = totalStat(c, stat), luck = totalStat(c, 'Luck');
  const req = eventRequirement(floor);
  return `${Names.stat(stat)} 판정 (요구치 ${req})\n기본 ${pct(B.EventBase)}%\n능력치 차이 (${have} - ${req}) × ${pct(B.EventPerStatPoint)}%\n행운 ${luck} × ${String(B.EventBonusPerLuck * 100)}%\n= ${pct(chance)}% (최소 ${pct(B.EventMin)}% · 최대 ${pct(B.EventMax)}%)`;
}

/** 선택 조건(아이템·골드)을 못 채우면 이유를 돌려준다. */
export function choiceUnavailable(choice: EventChoice, c: Character, floor: number): string | null {
  if (choice.RequiresItem && countOf(c.Inventory, choice.RequiresItem) <= 0) return `${consumableDef(choice.RequiresItem)?.Name} 없음`;
  if (choice.RequiresGoldMult > 0 && c.Gold < goldAmount(choice.RequiresGoldMult, floor)) return '골드 부족';
  if (choice.GoldPerFloor > 0 && c.Gold < choice.GoldPerFloor * floor) return `골드 부족 (${num(choice.GoldPerFloor * floor)}G)`;
  return null;
}

/** 특별한 이벤트의 선택 조건 (피의 우물: 남은 HP가 최대 HP 10%보다 많아야). */
export function unavailableReason(def: EventDef, index: number, run: DungeonRun, c: Character): string | null {
  const reason = choiceUnavailable(def.Choices[index], c, run.Floor);
  if (reason) return reason;
  if (def.Special === 'BloodWell' && index === 0) {
    if (currentRoom(run).EventStep >= BLOOD_REWARDS.length) return '더 바칠 수 없다';
    if (c.CurrentHp <= bloodCost(c)) return 'HP 부족';
  }
  return null;
}

export function choiceHint(choice: EventChoice, c: Character, floor: number): string {
  if (choice.GoldPerFloor > 0) {
    let h = choice.Hint ?? '';
    h = h.replace(`층 × ${choice.GoldPerFloor}G · `, '').replace(`층 × ${choice.GoldPerFloor}G`, '').replace(/^[ ·]+|[ ·]+$/g, '');
    return `${num(choice.GoldPerFloor * floor)}G${h ? ` · ${h}` : ''}`;
  }
  const stat = checkStat(choice, c);
  if (choice.CheckAttackStat && stat != null) return `${Names.stat(stat)} 판정`;
  if (choice.RequiresGoldMult > 0) return `${num(goldAmount(choice.RequiresGoldMult, floor))}G 필요 · 확률 50%`;
  return choice.Hint ?? '';
}

// ── 선택 처리 ─────────────────────────────────────────────

/** 피의 우물의 대가: 공포(전투 2회) · 저주(다음 휴식 방까지) · 추가 출혈(최대 HP 10%) 중 하나. */
function bloodCurse(run: DungeonRun, c: Character, rng: Rng, result: EventResult): string {
  switch (rng.range(0, 3)) {
    case 0:
      addEffect(run.Effects, 'Fear', 2);
      return '\n우물 속 무언가와 눈이 마주쳤다. 등골이 서늘하다. (공포: 전투 2회)';
    case 1:
      addEffect(run.Effects, 'Curse', -1);
      return '\n붉은 물이 손목을 타고 올라와 검게 굳는다. (저주)';
    default: {
      const before = c.CurrentHp;
      c.CurrentHp = Math.max(1, c.CurrentHp - bloodCost(c));
      result.HpChange += c.CurrentHp - before;
      return '\n상처가 벌어져 피가 멎지 않는다. (HP 추가 소모)';
    }
  }
}

/** 궁수 전용 "멀리서 화살로 건드린다": 상자가 미믹일 확률은 "연다"의 실패 확률과 같다. */
function resolveArcherChest(def: EventDef, c: Character, floor: number, rng: Rng): { outcome: EventOutcome; safe: boolean } {
  const open = def.Choices.find((ch) => ch.Check === 'Luck');
  const mimic = open ? 1 - successChance(open, c, floor) : 0.3;
  const safe = !rng.chance(mimic);
  const base: Omit<EventOutcome, 'Text'> = { HpRatio: 0, GoldMult: 0, ExpMult: 0, Reward: 'None', ReturnToTown: false, Battle: 'None', ArcherChest: false, Effects: [], Chain: null, Reveal: 'None', RevealWrong: false, SpawnTreasure: false, LinkBoss: false, FindReturn: false, BecomeMerchant: false };
  const outcome: EventOutcome = safe
    ? { ...base, Text: '화살이 닿자 상자가 덜컹 열렸다. 쓸 만한 장비가 들어 있다.', Reward: 'Equipment', GoldMult: 2 }
    : { ...base, Text: '화살이 꽂히자 상자가 비명을 지르며 일어섰다. 미믹이다! 하지만 기습은 피했다.', Battle: 'MimicNoAmbush' };
  return { outcome, safe };
}

function changeHp(c: Character, ratio: number, result: EventResult): void {
  if (ratio === 0) return;
  const max = maxHp(c);
  const before = c.CurrentHp;
  // 이벤트 피해로는 쓰러지지 않는다 (최소 1)
  c.CurrentHp = clamp(c.CurrentHp + roundEven(max * ratio), 1, max);
  result.HpChange += c.CurrentHp - before;
}

function addReward(reward: EventReward, result: EventResult, run: DungeonRun, c: Character, rng: Rng): void {
  switch (reward) {
    case 'GoodEquipment': {
      const g = Math.max(ord(GRADES, 'Uncommon'), ord(GRADES, rollDropGrade(rng, run.Floor, 1)));
      result.Loot.Items.push(createDrop(rng, GRADES[g] as ItemGrade, run.Floor, c));
      break;
    }
    case 'Consumables': {
      const ids = ['potion', 'potion_hi', 'antidote', 'bandage', 'salve'];
      const n = rng.rangeInclusive(1, 2);
      for (let i = 0; i < n; i++) result.Loot.Items.push(createConsumable(rng.pick(ids)));
      break;
    }
    case 'TwoPotions':
      result.Loot.Items.push(createConsumable('potion', 2));
      break;
    default: {
      const item = createEventReward(reward, run.Floor, c, rng);
      if (item) result.Loot.Items.push(item);
    }
  }
}

/** HP·골드·경험치·보상·탐험 효과·지도 공개·연쇄 등 결과를 적용한다. */
function applyOutcome(outcome: EventOutcome, result: EventResult, run: DungeonRun, c: Character, rng: Rng): void {
  changeHp(c, outcome.HpRatio, result);
  if (outcome.GoldMult !== 0) {
    let amount = goldAmount(outcome.GoldMult, run.Floor);
    if (amount < 0) amount = -Math.min(c.Gold, -amount);
    result.Loot.Gold += amount;
  }
  if (outcome.ExpMult > 0) result.Loot.Exp += roundEven(enemyExp(run.Floor) * outcome.ExpMult);
  addReward(outcome.Reward, result, run, c, rng);
  applyLoot(c, run, result.Loot);
  for (const e of outcome.Effects) addEffect(run.Effects, e.Type, e.Battles);
  if (outcome.Reveal !== 'None') revealRooms(run, outcome.Reveal, outcome.RevealWrong, rng);
  if (outcome.SpawnTreasure && !spawnTreasure(run, rng)) {
    // 옆에 빈 칸이 없으면 보물을 바로 준다
    const loot = treasure(run.Floor, c, rng);
    applyLoot(c, run, loot);
    result.Loot.Gold += loot.Gold;
    result.Loot.Items.push(...loot.Items);
    result.Text += ' 방이 너무 좁아 보물을 바로 꺼내 주었다.';
  }
  if (outcome.LinkBoss) linkBoss(run);
  if (outcome.FindReturn) findReturn(run);
  if (outcome.Chain) chainEvent(run, outcome.Chain, rng);
  if (outcome.BecomeMerchant) becomeMerchant(run, rng);
}

/** 보물 더미·피의 우물·스핑크스·운명의 카드·시련의 문. 일반 이벤트면 null. */
function resolveSpecial(def: EventDef, index: number, run: DungeonRun, c: Character, rng: Rng): EventResult | null {
  const room = currentRoom(run);
  const result = newResult();
  result.Success = true;
  const pass = def.Choices[index].Label.length > 0 && index === def.Choices.length - 1 && def.Special !== 'TreasurePile' && def.Special !== 'BloodWell';
  switch (def.Special) {
    case 'TreasurePile':
      if (index === 0) {
        if (rng.chance(trapChance(room.EventStep, c))) {
          const half = Math.trunc(room.EventBank / 2);
          result.Success = false;
          result.Text = '와르르! 더미가 무너져 깔렸다. 모은 골드의 절반만 건졌다.';
          changeHp(c, -0.2, result);
          result.Loot.Gold = half;
          applyLoot(c, run, result.Loot);
          room.Cleared = true;
          return result;
        }
        const gain = goldAmount(2, run.Floor);
        room.EventBank += gain;
        room.EventStep++;
        result.Text = `금화를 한 움큼 주웠다. (+${num(gain)}G, 모은 골드 ${num(room.EventBank)}G) 더미가 더 크게 흔들린다.`;
        result.Continues = true;
        return result;
      }
      result.Text = room.EventBank > 0 ? '욕심을 접고 모은 골드를 챙겼다.' : '보물 더미를 뒤로하고 떠났다.';
      result.Loot.Gold = room.EventBank;
      applyLoot(c, run, result.Loot);
      room.Cleared = true;
      return result;
    case 'BloodWell':
      if (index === 0) {
        const cost = bloodCost(c);
        const before = c.CurrentHp;
        c.CurrentHp = Math.max(1, c.CurrentHp - cost);
        result.HpChange = c.CurrentHp - before;
        result.Loot.Exp = roundEven(enemyExp(run.Floor) * BLOOD_REWARDS[room.EventStep]);
        applyLoot(c, run, result.Loot);
        const curse = rng.chance(BLOOD_RISK[room.EventStep]) ? bloodCurse(run, c, rng, result) : '';
        room.EventStep++;
        result.Text = `피가 우물로 스며들자 깨달음이 밀려든다.${curse}`;
        result.Continues = room.EventStep < BLOOD_REWARDS.length;
        if (!result.Continues) room.Cleared = true;
        return result;
      }
      result.Text = '우물을 뒤로하고 떠났다.';
      room.Cleared = true;
      return result;
    case 'Sphinx':
      if (pass) break;
      if (index === sphinxCorrect(room)) {
        result.Text = '"정답이다." 스핑크스가 길을 비키며 보물을 내준다.';
        result.Loot.Exp = enemyExp(run.Floor) * 5;
        result.Loot.Items.push(randomEquipment(run.Floor, c, rng, 1));
        applyLoot(c, run, result.Loot);
      } else {
        result.Success = false;
        result.Text = `"틀렸다." 스핑크스의 앞발이 내리쳤다. 정답은 '${sphinxRiddle(room)[1]}'였다.`;
        changeHp(c, -0.15, result);
      }
      room.Cleared = true;
      return result;
    case 'FateCards': {
      if (pass) break;
      const fate = fateOrder(room)[index];
      if (fate === 0) {
        result.Text = '대길! 카드가 황금빛으로 타오른다.';
        result.Loot.Gold = goldAmount(3, run.Floor);
        addReward('GoodEquipment', result, run, c, rng);
      } else if (fate === 1) {
        result.Text = '길. 소소한 행운이 찾아왔다.';
        if (rng.chance(0.5)) result.Loot.Gold = goldAmount(3, run.Floor);
        else result.Loot.Items.push(createConsumable('potion', 2));
      } else {
        result.Success = false;
        result.Text = '흉. 카드가 검게 타며 손을 그었다.';
        changeHp(c, -0.2, result);
      }
      applyLoot(c, run, result.Loot);
      room.Cleared = true;
      return result;
    }
    case 'TrialGate':
      if (pass) break;
      result.TrialFloor = run.Floor + index;
      result.Battle = 'Trial';
      result.Text = `${run.Floor + index}층의 주인이 문 너머에서 걸어 나온다!`;
      return result;
    default:
      return null;
  }
  // 그냥 지나간다
  result.Text = def.Choices[index].Success.Text;
  room.Cleared = true;
  return result;
}

export function resolveEvent(run: DungeonRun, c: Character, choiceIndex: number, rng: Rng): EventResult {
  const room = currentRoom(run);
  const def = eventDef(room.EventId);
  if (!def || choiceIndex < 0 || choiceIndex >= def.Choices.length) throw new Error('잘못된 이벤트 선택');
  const choice = def.Choices[choiceIndex];
  if (choice.JobOnly >= 0 && choice.JobOnly !== ord(JOBS, c.Job)) throw new Error('다른 직업의 선택지입니다');
  if (!visibleChoices(def, c, run).includes(choiceIndex)) throw new Error('고를 수 없는 선택지입니다');
  if (unavailableReason(def, choiceIndex, run, c) != null) throw new Error('선택 조건을 충족하지 못했습니다');
  if (choice.RequiresItem) removeTemplate(c.Inventory, choice.RequiresItem, 1);
  if (choice.GoldPerFloor > 0) c.Gold -= choice.GoldPerFloor * run.Floor;
  const special = resolveSpecial(def, choiceIndex, run, c, rng);
  if (special) return special;
  let success = rng.chance(successChance(choice, c, run.Floor));
  let outcome = success || !choice.Failure ? choice.Success : choice.Failure;
  if (outcome.ArcherChest) {
    const r = resolveArcherChest(def, c, run.Floor, rng);
    outcome = r.outcome;
    success = r.safe;
  }
  const result = newResult();
  result.Success = success;
  result.Text = outcome.Text;
  result.ReturnToTown = outcome.ReturnToTown;
  result.Battle = outcome.Battle;
  applyOutcome(outcome, result, run, c, rng);
  // 전투로 이어지면 방은 전투가 끝날 때 클리어된다.
  if (!startsBattle(result) && !outcome.BecomeMerchant) room.Cleared = true;
  return result;
}

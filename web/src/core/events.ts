import eventsJson from '../data/events.json';
import type { ExploreEffect } from './explore';
import type { Rng } from './rng';
import type { Stat } from './enums';

export type EventBattle = 'None' | 'Mimic' | 'MimicNoAmbush' | 'Gamblers' | 'Normal' | 'Wanderer' | 'GoblinChase' | 'Trial';
export type EventSpecial = 'None' | 'TreasurePile' | 'BloodWell' | 'Sphinx' | 'FateCards' | 'TrialGate';
export type RevealKind = 'None' | 'ReturnRoom' | 'ReturnAndBoss' | 'All' | 'Nearby2';
export type EventReward = 'None' | 'Potion' | 'HighPotion' | 'Equipment' | 'HighSkillBook' | 'EnhanceStone' | 'GoodEquipment' | 'Consumables' | 'TwoPotions';

/** 선택지 결과. 골드·경험치는 층 기준 몬스터 1마리 보상의 배수. */
export interface EventOutcome {
  Text: string;
  HpRatio: number;
  GoldMult: number;
  ExpMult: number;
  Reward: EventReward;
  ReturnToTown: boolean;
  Battle: EventBattle;
  ArcherChest: boolean;
  Effects: ExploreEffect[];
  Chain: string | null;
  Reveal: RevealKind;
  RevealWrong: boolean;
  SpawnTreasure: boolean;
  LinkBoss: boolean;
  FindReturn: boolean;
  BecomeMerchant: boolean;
}
export interface EventChoice {
  Label: string;
  Hint: string | null;
  Check: Stat | null;
  CheckAttackStat: boolean;
  FixedChance: number;
  RequiresItem: string | null;
  RequiresGoldMult: number;
  Success: EventOutcome;
  Failure: EventOutcome | null;
  /** -1 = 모든 직업, 그 외 = 이 직업에게만 보이는 선택지. */
  JobOnly: number;
  /** 층 × 이 값만큼 골드를 내야 한다. */
  GoldPerFloor: number;
}
export interface EventDef {
  Id: string;
  Title: string;
  Body: string;
  Choices: EventChoice[];
  Weight: number;
  Special: EventSpecial;
  /** 연쇄 후속 이벤트 (뽑기에 들어가지 않음). */
  Followup: boolean;
  /** 이 층부터 나온다. */
  MinFloor: number;
}

export const ALL_EVENTS = eventsJson as unknown as EventDef[];
const BY_ID = new Map(ALL_EVENTS.map((e) => [e.Id, e]));
export const eventDef = (id: string | null | undefined): EventDef | null => (id ? BY_ID.get(id) ?? null : null);

/** 지금 남아 있는 탐험 효과를 주는 이벤트들: 효과가 남아 있는 동안 같은 탐험의 다음 층에 다시 나오지 않게 뺀다. */
export function eventsGrantingActiveEffects(active: ExploreEffect[] | null | undefined): string[] {
  const ids: string[] = [];
  if (!active || active.length === 0) return ids;
  for (const e of ALL_EVENTS) {
    let hit = false;
    for (const ch of e.Choices) {
      for (const o of [ch.Success, ch.Failure]) {
        if (o) for (const fx of o.Effects) if (active.some((a) => a.Type === fx.Type)) hit = true;
      }
    }
    if (hit) ids.push(e.Id);
  }
  return ids;
}

/** 이벤트 뽑기: 가중치, 연쇄 후속 제외, 등장 층 미만 제외, 한 층에 같은 이벤트는 한 번만 (used에 이미 고른 Id). */
export function pickEvent(rng: Rng, floor = 1, used?: ReadonlySet<string> | null): EventDef {
  const weights = ALL_EVENTS.map((e) => (!e.Followup && floor >= e.MinFloor && !(used && used.has(e.Id)) ? e.Weight : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) ALL_EVENTS.forEach((e, i) => (weights[i] = e.Followup ? 0 : 1));
  return ALL_EVENTS[rng.pickWeighted(weights)];
}

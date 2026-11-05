import type { ItemInstance } from './items';
import { B, clamp, roundEven } from './balance';
import type { Character } from './character';
import { maxChallengeFloor, maxHp } from './character';
import type { Difficulty, RoomType } from './enums';
import { eventsGrantingActiveEffects } from './events';
import type { ExploreEffect } from './explore';
import { onRestEffects } from './explore';
import { generateFloor } from './generator';
import type { GuildState } from './guild';
import { onBossKilled } from './guild';
import type { LootReport } from './loot';
import { applyLoot, treasure } from './loot';
import type { FloorMap, Room } from './map';
import { displayType, getRoom } from './map';
import { Names } from './names';
import { Rng } from './rng';

/** 던전 한 번의 도전 상태. 저장 파일에 들어가 앱을 껐다 켜도 이어진다. */
export interface DungeonRun {
  Floor: number;
  Map: FloorMap;
  CurrentRoomId: number;
  PreviousRoomId: number;
  BossDefeated: boolean;
  GoldEarned: number;
  ExpEarned: number;
  EnemiesDefeated: number;
  Loot: string[];
  /** 튜토리얼 고정 배치 1층. */
  IsTutorial: boolean;
  /** 층에 막 들어왔는지 (층 진입 타이틀 연출용, 한 번 보여 주면 false). */
  FloorIntroPending: boolean;
  /** 탐험 효과 (귀환·사망하면 사라지고, 다음 층으로 내려가면 유지). */
  Effects: ExploreEffect[];
  /** 시련의 문에서 고른 보스 층 (전투 중에만, 아니면 0). */
  TrialFloor: number;
  /** 스킬 재사용 대기 (전투가 끝나도 같은 던전 안에서는 이어지고, 마을로 돌아가면 사라진다). 에너지 볼은 전투가 끝나면 풀려 여기 남지 않는다. */
  Cooldowns: Record<string, number>;
  /** 가방이 가득 차 못 가진 물품: 던전 화면에서 가방 물품과 바꿀지 묻는다 (v3.10, 예전 저장엔 없음). */
  PendingDrops?: ItemInstance[];
}

export const newRun = (floor: number, map: FloorMap): DungeonRun => ({
  Floor: floor, Map: map, CurrentRoomId: map.StartId, PreviousRoomId: map.StartId, BossDefeated: false, GoldEarned: 0, ExpEarned: 0,
  EnemiesDefeated: 0, Loot: [], IsTutorial: false, FloorIntroPending: true, Effects: [], TrialFloor: 0, Cooldowns: {},
});

export const currentRoom = (run: DungeonRun): Room => getRoom(run.Map, run.CurrentRoomId)!;
export const returnRoomFound = (run: DungeonRun): boolean => run.Map.Rooms.some((r) => r.Type === 'Return' && r.Visited);

/** 미니맵·경로 선택에 쓰는 이동 후보. */
export interface MoveOption {
  Room: Room;
  /** 예: "아래 통로로 간다" */
  Direction: string;
  /** 예: "물소리가 나는 쪽" / 쉬움: "전투" */
  Hint: string;
  /** 방 종류를 알고 있는지 (방문했거나 쉬움 난이도). */
  Known: boolean;
}

/** 이동 패드의 방향 (십자 4칸). 번호는 칸 순서. */
export type PadDir = 'Up' | 'Left' | 'Right' | 'Down';
export const PAD_DIRS: readonly PadDir[] = ['Up', 'Left', 'Right', 'Down'];

/** 이동 패드 한 칸. Room이 null이면 길이 없는 '막힘'. */
export interface PadSlot {
  Dir: PadDir;
  Room: Room | null;
  /** 방금 들어온 방. */
  IsPrevious: boolean;
  /** 방 종류를 알고 있는지 (방문했거나 쉬움 난이도 · 이벤트로 공개). */
  Known: boolean;
}

/** 지금 방에서 갈 수 있는 길을 위·왼쪽·오른쪽·아래 네 칸에 놓은 것. 자리가 없는 길(개구멍 지름길)은 Extra. */
export interface MovePad {
  Slots: PadSlot[];
  Extra: Room[];
}
export const padSlot = (pad: MovePad, dir: PadDir): PadSlot => pad.Slots[PAD_DIRS.indexOf(dir)];

export type RoomEnterResult = 'Nothing' | 'Battle' | 'Boss' | 'Event' | 'Treasure' | 'Rest' | 'Merchant' | 'Return';

const ATMOSPHERES = [
  '물소리가 나는 쪽', '횃불이 꺼진 쪽', '바람이 부는 쪽', '발자국이 남은 쪽',
  '비린내가 나는 쪽', '희미한 빛이 새는 쪽', '거미줄이 늘어진 쪽', '돌가루가 날리는 쪽',
];

export function startRun(c: Character, floor: number, rng: Rng): DungeonRun {
  floor = clamp(floor, 1, maxChallengeFloor(c));
  const map = generateFloor(floor, rng);
  c.CurrentHp = maxHp(c);
  return newRun(floor, map);
}

/** 현재 방을 떠날 수 있는지 (전투·이벤트를 끝냈는지). */
export const canLeave = (run: DungeonRun): boolean => currentRoom(run).Cleared;

const directionOrder = (from: Room, to: Room): number => (to.Y < from.Y ? 0 : to.X < from.X ? 1 : to.X > from.X ? 2 : 3);
const DIRECTION_TEXT = ['위 통로', '왼쪽 통로', '오른쪽 통로', '아래 통로'];

export function moveOptions(run: DungeonRun, difficulty: Difficulty): MoveOption[] {
  const cur = currentRoom(run);
  const list: MoveOption[] = cur.Links.map((id) => {
    const r = getRoom(run.Map, id)!;
    const known = r.Visited || difficulty === 'Easy' || r.Revealed;
    return {
      Room: r,
      Direction: DIRECTION_TEXT[directionOrder(cur, r)] + (r.Visited ? '로 돌아간다' : '로 간다'),
      Hint: r.Visited ? `${Names.room(r.Type)} · 탐험함` : r.Chain ? '무언가 기다리고 있다 (!)' : known ? Names.room(displayType(r)) : ATMOSPHERES[(r.Seed & 0x7fffffff) % ATMOSPHERES.length],
      Known: known,
    };
  });
  // 방향마다 자리를 고정한다: 위 → 왼쪽 → 오른쪽 → 아래
  list.sort((a, b) => directionOrder(cur, a.Room) - directionOrder(cur, b.Room));
  return list;
}

function place(pad: MovePad, r: Room, dir: PadDir, run: DungeonRun, difficulty: Difficulty): void {
  const slot = padSlot(pad, dir);
  slot.Room = r;
  slot.IsPrevious = r.Id === run.PreviousRoomId && r.Id !== run.CurrentRoomId;
  slot.Known = r.Visited || difficulty === 'Easy' || r.Revealed;
}

/**
 * 이동 패드: 같은 줄·같은 칸에 있는 이웃 방은 그 방향 칸에 놓고, 대각선 지름길은 더 먼 축 방향 칸(자리가 없으면
 * 다른 축 칸)에 놓는다. 자리가 없으면 Extra.
 */
export function movePad(run: DungeonRun, difficulty: Difficulty): MovePad {
  const pad: MovePad = { Slots: PAD_DIRS.map((d) => ({ Dir: d, Room: null, IsPrevious: false, Known: false })), Extra: [] };
  const cur = currentRoom(run);
  const diagonal: Room[] = [];
  for (const id of cur.Links) {
    const r = getRoom(run.Map, id)!;
    const dx = r.X - cur.X, dy = r.Y - cur.Y;
    if ((dx === 0) === (dy === 0)) {
      diagonal.push(r);
      continue;
    }
    const dir: PadDir = dy < 0 ? 'Up' : dy > 0 ? 'Down' : dx < 0 ? 'Left' : 'Right';
    if (!padSlot(pad, dir).Room) place(pad, r, dir, run, difficulty);
    else diagonal.push(r); // 같은 줄의 먼 방 (자리가 겹침)
  }
  for (const r of diagonal) {
    const dx = r.X - cur.X, dy = r.Y - cur.Y;
    const vertical: PadDir = dy < 0 ? 'Up' : 'Down';
    const horizontal: PadDir = dx < 0 ? 'Left' : 'Right';
    const verticalFirst = Math.abs(dy) >= Math.abs(dx);
    const first = verticalFirst ? vertical : horizontal;
    const second = verticalFirst ? horizontal : vertical;
    if (dx === 0 || dy === 0) {
      pad.Extra.push(r);
      continue;
    }
    if (!padSlot(pad, first).Room) place(pad, r, first, run, difficulty);
    else if (!padSlot(pad, second).Room) place(pad, r, second, run, difficulty);
    else pad.Extra.push(r);
  }
  return pad;
}

/** 지금 방의 상황 설명 (던전 화면 텍스트 상자). */
export function situation(run: DungeonRun): { title: string; text: string } {
  const cur = currentRoom(run);
  const unexplored = cur.Links.filter((id) => !getRoom(run.Map, id)!.Visited).length;
  if (cur.Type === 'Boss' && run.BossDefeated) {
    return {
      title: '보스 처치',
      text: run.Floor >= B.MaxFloor ? '던전 최하층의 주인이 쓰러졌다. 깊은 정적이 내려앉는다.' : '층의 주인이 쓰러지자 아래층으로 이어진 계단이 드러났다.',
    };
  }
  if (cur.Type === 'Return') return { title: '귀환 방', text: "바닥에 새겨진 마법진이 은은하게 빛난다. 아래 '귀환' 버튼으로 언제든 마을로 돌아갈 수 있다." };
  if (cur.Type === 'Merchant') return { title: '떠돌이 상인', text: '등짐을 내려놓은 상인이 손짓한다. "물약 필요하지 않나? 조금 비싸긴 해도."' };
  if (unexplored >= 2) {
    return { title: '갈림길', text: `길이 ${unexplored === 2 ? '두' : unexplored === 3 ? '세' : '네'} 갈래로 나뉜다. 어느 쪽으로 갈지 정해야 한다.` };
  }
  if (unexplored === 1) return { title: '통로', text: '좁은 통로가 어둠 속으로 이어진다.' };
  return {
    title: '막다른 곳',
    text: cur.Links.length <= 1 ? '더 나아갈 길이 없다. 왔던 길로 돌아가거나 탐험한 방으로 이동하자.' : '주변 방은 모두 둘러보았다. 탐험하지 않은 방으로 이동하자.',
  };
}

export const canMoveTo = (run: DungeonRun, roomId: number): boolean => canLeave(run) && currentRoom(run).Links.includes(roomId);

function enter(run: DungeonRun, roomId: number): RoomEnterResult {
  run.PreviousRoomId = run.CurrentRoomId;
  run.CurrentRoomId = roomId;
  const room = currentRoom(run);
  room.Visited = true;
  // 다시 온 방: 상인은 거래 창을 바로 열지 않는다
  if (room.Cleared) return room.Type === 'Return' ? 'Return' : 'Nothing';
  switch (room.Type as RoomType) {
    case 'Battle': return 'Battle';
    case 'Boss': return 'Boss';
    case 'Event': return 'Event';
    case 'Treasure': return 'Treasure';
    case 'Rest': return 'Rest';
    case 'Merchant':
      room.Cleared = true;
      return 'Merchant';
    case 'Return':
      room.Cleared = true;
      return 'Return';
    default:
      room.Cleared = true;
      return 'Nothing';
  }
}

/** 인접한 방으로 이동한다. 처음 들어가는 방이면 그 방의 내용을 돌려준다. */
export function moveTo(run: DungeonRun, roomId: number): RoomEnterResult {
  if (!canMoveTo(run, roomId)) throw new Error('이동할 수 없는 방입니다');
  return enter(run, roomId);
}

/** 전투에서 도망치면 직전 방으로 돌아간다. 전투 방은 클리어되지 않은 채 남는다. */
export function fleeToPrevious(run: DungeonRun): void {
  let back = run.PreviousRoomId;
  if (back === run.CurrentRoomId || !getRoom(run.Map, back)!.Cleared) back = run.Map.StartId;
  run.CurrentRoomId = back;
}

/** 텔레포트: 탐험을 끝낸 방으로 비용 없이 이동 (전투 중 불가). */
export const teleportTargets = (run: DungeonRun): Room[] => run.Map.Rooms.filter((r) => r.Visited && r.Cleared && r.Id !== run.CurrentRoomId);

export function teleport(run: DungeonRun, roomId: number): boolean {
  if (!canLeave(run)) return false;
  const r = getRoom(run.Map, roomId);
  if (!r || !r.Visited || !r.Cleared || roomId === run.CurrentRoomId) return false;
  run.PreviousRoomId = run.CurrentRoomId;
  run.CurrentRoomId = roomId;
  return true;
}

export const clearCurrent = (run: DungeonRun): void => {
  currentRoom(run).Cleared = true;
};

/** 휴식 방: 최대 HP 40% 회복. */
export function rest(run: DungeonRun, c: Character): number {
  onRestEffects(run.Effects);
  const max = maxHp(c);
  const before = c.CurrentHp;
  c.CurrentHp = Math.min(max, c.CurrentHp + roundEven(max * B.RestHealRatio));
  currentRoom(run).Cleared = true;
  return c.CurrentHp - before;
}

/** 보물 방: 골드와 아이템을 얻는다. */
export function openTreasure(run: DungeonRun, c: Character): LootReport {
  const report = treasure(run.Floor, c, new Rng(currentRoom(run).Seed));
  applyLoot(c, run, report);
  currentRoom(run).Cleared = true;
  return report;
}

export const canGoDeeper = (run: DungeonRun): boolean => run.BossDefeated && run.Floor < B.MaxFloor;

/** 보스를 잡은 뒤 마을에 들르지 않고 다음 층으로 내려간다 (HP 유지). */
export function descend(run: DungeonRun, rng: Rng): void {
  if (!canGoDeeper(run)) throw new Error('아직 내려갈 수 없습니다');
  run.Floor++;
  // 효과가 남아 있는 이벤트(악마의 계약·공포 등)는 다음 층에 다시 나오지 않는다
  run.Map = generateFloor(run.Floor, rng, undefined, eventsGrantingActiveEffects(run.Effects));
  run.CurrentRoomId = run.Map.StartId;
  run.PreviousRoomId = run.Map.StartId;
  run.BossDefeated = false;
  run.IsTutorial = false;
  run.FloorIntroPending = true;
}

/** 보스 처치 기록: 돌파 층 갱신, 정복 퀘스트 진행. */
export function onBossDefeated(run: DungeonRun, c: Character, guild: GuildState): void {
  run.BossDefeated = true;
  currentRoom(run).Cleared = true;
  c.HighestFloorCleared = Math.max(c.HighestFloorCleared, run.Floor);
  c.FloorClears[run.Floor] = (c.FloorClears[run.Floor] ?? 0) + 1;
  onBossKilled(guild, run.Floor);
}

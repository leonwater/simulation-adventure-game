import { B } from './balance';
import { pickEvent } from './events';
import type { LayoutPattern, RoomType } from './enums';
import { LAYOUTS } from './enums';
import { consumableAt } from './items';
import type { FloorMap, Room } from './map';
import { branchesOnBossPath, deadEnds, distances, linkRooms, newFloorMap, newRoom } from './map';
import type { Rng } from './rng';
import type { ShopGood } from './items';

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];
const MAX_ATTEMPTS = 400;
const LAYOUT_FIX_TRIES = 400;
const key = (x: number, y: number): string => `${x},${y}`;

const countType = (list: RoomType[], t: RoomType): number => list.filter((x) => x === t).length;

/** 보스·시작을 제외한 방 종류 목록. */
export function rollRoomTypes(rng: Rng): RoomType[] {
  let n = rng.rangeInclusive(B.MinRooms, B.MaxRooms);
  const types: RoomType[] = [];
  for (let i = 0; i < B.MinBattle; i++) types.push('Battle');
  for (let i = 0; i < B.MinEvent; i++) types.push('Event');
  if (rng.chance(B.FirstTreasureChance)) types.push('Treasure');
  for (let i = 0; i < B.MinRest; i++) types.push('Rest');
  types.push('Return');
  if (rng.chance(B.MerchantChance)) {
    types.push('Merchant');
    if (types.length > n) n = types.length; // 칸이 부족하면 방 수를 1 늘린다
  }
  while (types.length < n) {
    const treasure = countType(types, 'Treasure');
    const rest = countType(types, 'Rest');
    const weights = [B.WeightBattle, B.WeightEvent, treasure >= B.MaxTreasure ? 0 : B.WeightTreasure, rest >= B.MaxRest ? 0 : B.WeightRest];
    switch (rng.pickWeighted(weights)) {
      case 0: types.push('Battle'); break;
      case 1: types.push('Event'); break;
      case 2: types.push('Treasure'); break;
      default: types.push('Rest'); break;
    }
  }
  return types;
}

/** 던전 상인 물건: 소모품 5종, 물건마다 2~5개까지만 판다. */
export function merchantGoods(rng: Rng, floor = 1): ShopGood[] {
  return ['potion', 'potion_hi', 'antidote', 'bandage', 'salve'].map((id) => ({
    Item: consumableAt(id, floor),
    Stock: rng.rangeInclusive(B.MerchantStockMin, B.MerchantStockMax),
  }));
}

function addRoom(map: FloorMap, cells: Map<string, number>, x: number, y: number): Room {
  const room = newRoom(map.Rooms.length, x, y);
  map.Rooms.push(room);
  cells.set(key(x, y), room.Id);
  return room;
}

function allowed(x: number, y: number, cells: Map<string, number>, width: number, height: number, pattern: LayoutPattern): boolean {
  if (cells.has(key(x, y))) return false;
  if (pattern === 'Grid') return x >= 0 && y >= 0 && x < width && y < height;
  // 가지형·순환형: 시작 방 왼쪽으로는 자라지 않게 해 미니맵이 오른쪽으로 펼쳐지도록 한다.
  return x >= 0 && Math.abs(y) <= 3;
}

function freeNeighbors(r: Room, cells: Map<string, number>, width: number, height: number, pattern: LayoutPattern): number {
  let n = 0;
  for (let d = 0; d < 4; d++) if (allowed(r.X + DX[d], r.Y + DY[d], cells, width, height, pattern)) n++;
  return n;
}

function addExtraLinks(map: FloorMap, cells: Map<string, number>, rng: Rng, maxLinks: number, chance: number): void {
  const pairs: [number, number][] = [];
  for (const r of map.Rooms) {
    for (let d = 0; d < 4; d += 2) {
      // 오른쪽·아래 방향만 보면 쌍이 한 번씩 나온다
      const other = cells.get(key(r.X + DX[d], r.Y + DY[d]));
      if (other === undefined) continue;
      if (!r.Links.includes(other)) pairs.push([r.Id, other]);
    }
  }
  rng.shuffle(pairs);
  let added = 0;
  for (const p of pairs) {
    if (added >= maxLinks) break;
    if (!rng.chance(chance)) continue;
    linkRooms(map.Rooms[p[0]], map.Rooms[p[1]]);
    added++;
  }
}

function buildLayout(floor: number, pattern: LayoutPattern, total: number, rng: Rng): FloorMap {
  const map = newFloorMap(floor, pattern);
  const cells = new Map<string, number>();
  let width = Infinity, height = Infinity;
  const startX = 0;
  let startY = 0;
  if (pattern === 'Grid') {
    height = Math.max(2, Math.floor(Math.sqrt(total)));
    width = Math.floor((total + height - 1) / height);
    if (width * height === total) width++; // 여유 칸이 있어야 모양이 다양해진다
    startY = rng.range(0, height);
  }
  addRoom(map, cells, startX, startY);
  while (map.Rooms.length < total) {
    // 가지형·순환형은 연결이 적은 방을 우선 늘려 길게 뻗게 한다.
    const candidates: number[] = [];
    for (const r of map.Rooms) {
      if (freeNeighbors(r, cells, width, height, pattern) === 0) continue;
      const weight = pattern === 'Grid' ? 1 : r.Links.length <= 1 ? 3 : 1;
      for (let w = 0; w < weight; w++) candidates.push(r.Id);
    }
    if (candidates.length === 0) break;
    const parent = map.Rooms[rng.pick(candidates)];
    const dirs = [0, 1, 2, 3];
    rng.shuffle(dirs);
    for (const d of dirs) {
      const nx = parent.X + DX[d], ny = parent.Y + DY[d];
      if (!allowed(nx, ny, cells, width, height, pattern)) continue;
      linkRooms(parent, addRoom(map, cells, nx, ny));
      break;
    }
  }
  if (pattern === 'Loop') addExtraLinks(map, cells, rng, rng.rangeInclusive(1, 2), 1);
  else if (pattern === 'Grid') addExtraLinks(map, cells, rng, Infinity, 0.3);
  map.StartId = 0;
  return map;
}

function placeBoss(map: FloorMap, rng: Rng): void {
  const dist = distances(map, map.StartId);
  const max = Math.max(...dist);
  const farthest = map.Rooms.filter((r) => dist[r.Id] === max).map((r) => r.Id);
  // 같은 거리면 막다른 방을 우선
  const leaves = farthest.filter((id) => map.Rooms[id].Links.length === 1);
  map.BossId = rng.pick(leaves.length > 0 ? leaves : farthest);
}

/** 규칙을 어긴 수: 이웃한 같은 종류(전투 제외) + 시작 방 옆 휴식 방. */
function violationsOf(map: FloorMap, assign: Map<number, RoomType>): number {
  let n = 0;
  for (const r of map.Rooms) {
    const type = assign.get(r.Id);
    if (type === undefined) continue;
    for (const l of r.Links) {
      if (l === map.StartId && type === 'Rest') n++;
      const other = assign.get(l);
      if (l < r.Id || other === undefined) continue;
      if (type === other && type !== 'Battle') n++;
    }
  }
  return n;
}

/** 이미 만든 층의 규칙 위반 수 (테스트용). */
export function violations(map: FloorMap): number {
  const assign = new Map<number, RoomType>();
  for (const r of map.Rooms) if (r.Id !== map.StartId && r.Id !== map.BossId) assign.set(r.Id, r.Type);
  return violationsOf(map, assign);
}

function fixLayout(map: FloorMap, slots: Room[], assign: Map<number, RoomType>, rng: Rng): void {
  let bad = violationsOf(map, assign);
  for (let t = 0; t < LAYOUT_FIX_TRIES && bad > 0; t++) {
    const a = slots[rng.range(0, slots.length)];
    const b = slots[rng.range(0, slots.length)];
    if (a.Id === b.Id || assign.get(a.Id) === assign.get(b.Id)) continue;
    const ta = assign.get(a.Id)!;
    assign.set(a.Id, assign.get(b.Id)!);
    assign.set(b.Id, ta);
    const now = violationsOf(map, assign);
    if (now <= bad) bad = now;
    else {
      assign.set(b.Id, assign.get(a.Id)!);
      assign.set(a.Id, ta);
    }
  }
}

/**
 * 방 종류 배치: 전투 방을 빼고 이웃한 방끼리 같은 종류가 되지 않게, 시작 방 바로 옆에는 휴식 방이 오지 않게 한다.
 * 무작위로 섞은 뒤 규칙을 어기는 방을 다른 방과 바꿔 가며 고친다 (못 고치면 가장 적게 어긴 배치).
 */
function assignTypes(map: FloorMap, types: RoomType[], floor: number, rng: Rng, excludedEvents?: readonly string[] | null): void {
  const slots = map.Rooms.filter((r) => r.Id !== map.StartId && r.Id !== map.BossId);
  const shuffled = [...types];
  rng.shuffle(shuffled);
  const assign = new Map<number, RoomType>();
  slots.forEach((r, k) => assign.set(r.Id, shuffled[k]));
  fixLayout(map, slots, assign, rng);
  const usedEvents = new Set<string>(excludedEvents ?? []); // 한 층에 같은 이벤트는 한 번만
  for (const r of map.Rooms) {
    r.Seed = rng.nextSeed();
    if (r.Id === map.StartId) {
      r.Type = 'Start';
      r.Visited = true;
      r.Cleared = true;
    } else if (r.Id === map.BossId) r.Type = 'Boss';
    else r.Type = assign.get(r.Id)!;
    if (r.Type === 'Event') {
      r.EventId = pickEvent(rng, floor, usedEvents).Id;
      usedEvents.add(r.EventId);
    }
    if (r.Type === 'Merchant') r.MerchantGoods = merchantGoods(rng, floor);
  }
}

export function generateFloor(floor: number, rng: Rng, pattern?: LayoutPattern, excludedEvents?: readonly string[] | null): FloorMap {
  const pat = pattern ?? LAYOUTS[rng.range(0, 3)];
  const types = rollRoomTypes(rng);
  const total = types.length + 2; // + 시작 + 보스
  let best: FloorMap | null = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const map = buildLayout(floor, pat, total, rng);
    placeBoss(map, rng);
    const branches = branchesOnBossPath(map);
    const dead = deadEnds(map);
    const ok = branches >= B.MinBranchesOnBossPath && dead >= B.MinDeadEnds;
    const score = Math.min(branches, B.MinBranchesOnBossPath) * 10 + Math.min(dead, B.MinDeadEnds) * 10 + distances(map, map.StartId)[map.BossId];
    if (score > bestScore) {
      best = map;
      bestScore = score;
    }
    if (ok) break;
  }
  assignTypes(best!, types, floor, rng, excludedEvents);
  return best!;
}

/** 튜토리얼 1층 고정 배치: 시작 → 전투 → 갈림길(위: 귀환 방 / 오른쪽: 휴식 → 전투 → 약한 보스). */
export function generateTutorialFloor(rng: Rng): FloorMap {
  const map = newFloorMap(1, 'Branch');
  const cells = new Map<string, number>();
  const start = addRoom(map, cells, 0, 0);
  const battle1 = addRoom(map, cells, 1, 0);
  const ret = addRoom(map, cells, 1, -1);
  const rest = addRoom(map, cells, 2, 0);
  const battle2 = addRoom(map, cells, 3, 0);
  const boss = addRoom(map, cells, 4, 0);
  linkRooms(start, battle1);
  linkRooms(battle1, ret);
  linkRooms(battle1, rest);
  linkRooms(rest, battle2);
  linkRooms(battle2, boss);
  start.Type = 'Start';
  start.Visited = start.Cleared = true;
  battle1.Type = 'Battle';
  ret.Type = 'Return';
  rest.Type = 'Rest';
  battle2.Type = 'Battle';
  boss.Type = 'Boss';
  for (const r of map.Rooms) r.Seed = rng.nextSeed();
  map.StartId = start.Id;
  map.BossId = boss.Id;
  return map;
}


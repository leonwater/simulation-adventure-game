import type { LayoutPattern, RoomType } from './enums';
import type { ShopGood } from './items';

export interface Room {
  Id: number;
  Type: RoomType;
  /** 미니맵 격자 좌표. */
  X: number;
  Y: number;
  Links: number[];
  Visited: boolean;
  Cleared: boolean;
  /** 방 내용(적 구성·보상)을 다시 만들 때 쓰는 시드. */
  Seed: number;
  EventId: string;
  /** 상인 방 재고. */
  MerchantGoods: ShopGood[];
  /** 이벤트로 위치와 종류가 공개된 방 (미니맵에 흐리게). */
  Revealed: boolean;
  /** 공개됐지만 틀리게 알려진 종류 (RoomType 번호). -1이면 실제 종류. */
  ShownType: number;
  /** 연쇄 후속 이벤트가 생긴 방 (미니맵에 '!'). */
  Chain: boolean;
  /** 여러 번 고르는 이벤트(보물 더미·피의 우물)의 진행 단계와 모은 골드. */
  EventStep: number;
  EventBank: number;
  /** 상인의 보답: 마을 가격 × 0.7. */
  MerchantDiscount: boolean;
  /** 떠돌이 상인이 낮은 확률로 내놓는 장비·스킬서를 이미 굴렸는지 (처음 들어갈 때 한 번). */
  MerchantExtras?: boolean;
}

export interface FloorMap {
  Floor: number;
  Pattern: LayoutPattern;
  Rooms: Room[];
  StartId: number;
  BossId: number;
}

export const newRoom = (id: number, x: number, y: number): Room => ({
  Id: id, Type: 'Start', X: x, Y: y, Links: [], Visited: false, Cleared: false, Seed: 0, EventId: '', MerchantGoods: [],
  Revealed: false, ShownType: -1, Chain: false, EventStep: 0, EventBank: 0, MerchantDiscount: false,
});

export const newFloorMap = (floor: number, pattern: LayoutPattern): FloorMap => ({ Floor: floor, Pattern: pattern, Rooms: [], StartId: 0, BossId: 0 });

export const getRoom = (m: FloorMap, id: number): Room | null => (id >= 0 && id < m.Rooms.length ? m.Rooms[id] : null);
export const countOfType = (m: FloorMap, t: RoomType): number => m.Rooms.filter((r) => r.Type === t).length;

/** 시작 방에서의 최단 거리 (도달 불가 = -1). */
export function distances(m: FloorMap, from: number): number[] {
  const dist = m.Rooms.map(() => -1);
  const queue = [from];
  dist[from] = 0;
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const next of m.Rooms[cur].Links) {
      if (dist[next] >= 0) continue;
      dist[next] = dist[cur] + 1;
      queue.push(next);
    }
  }
  return dist;
}

/** 최단 경로 (from → to, 양 끝 포함). 없으면 빈 목록. */
export function shortestPath(m: FloorMap, from: number, to: number): number[] {
  const prev = m.Rooms.map(() => -2);
  prev[from] = -1;
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (cur === to) break;
    for (const next of m.Rooms[cur].Links) {
      if (prev[next] !== -2) continue;
      prev[next] = cur;
      queue.push(next);
    }
  }
  if (prev[to] === -2) return [];
  const path: number[] = [];
  for (let at = to; at !== -1; at = prev[at]) path.push(at);
  return path.reverse();
}

/** 보스까지 최단 경로 위의 갈림길 수 (앞으로 고를 수 있는 길이 2개 이상인 방). */
export function branchesOnBossPath(m: FloorMap): number {
  const path = shortestPath(m, m.StartId, m.BossId);
  let count = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const forward = m.Rooms[path[i]].Links.length - (i === 0 ? 0 : 1);
    if (forward >= 2) count++;
  }
  return count;
}

/** 막다른 방 수 (연결이 하나뿐인 방, 시작·보스 제외). */
export const deadEnds = (m: FloorMap): number =>
  m.Rooms.filter((r) => r.Id !== m.StartId && r.Id !== m.BossId && r.Links.length === 1).length;

export const isConnected = (m: FloorMap): boolean => distances(m, m.StartId).every((d) => d >= 0);

export function linkRooms(a: Room, b: Room): void {
  if (!a.Links.includes(b.Id)) a.Links.push(b.Id);
  if (!b.Links.includes(a.Id)) b.Links.push(a.Id);
}

/** 방 종류 표시: 아직 안 가 본 방은 (틀리게) 공개된 종류. */
export const displayType = (r: Room): RoomType => (!r.Visited && r.ShownType >= 0 ? (ROOM_ORDER[r.ShownType] as RoomType) : r.Type);
const ROOM_ORDER = ['Start', 'Battle', 'Event', 'Treasure', 'Rest', 'Merchant', 'Return', 'Boss'];

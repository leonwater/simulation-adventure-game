import type { RoomType } from './enums';
import type { DungeonRun } from './dungeon';
import { currentRoom } from './dungeon';
import type { RevealKind } from './events';
import { merchantGoods } from './generator';
import { distances, getRoom, linkRooms, newRoom } from './map';
import type { Rng } from './rng';

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];
const GUESSABLE: RoomType[] = ['Battle', 'Event', 'Treasure', 'Rest'];
const ROOM_ORDER = ['Start', 'Battle', 'Event', 'Treasure', 'Rest', 'Merchant', 'Return', 'Boss'];

/** 방 위치·종류를 미니맵에 공개한다. wrong이면 공개된 방 하나의 종류를 틀리게 알려 준다. */
export function revealRooms(run: DungeonRun, kind: RevealKind, wrong: boolean, rng: Rng): void {
  const map = run.Map;
  const revealed = [];
  const dist = kind === 'Nearby2' ? distances(map, run.CurrentRoomId) : null;
  for (const r of map.Rooms) {
    let show: boolean;
    switch (kind) {
      case 'All': show = true; break;
      case 'ReturnRoom': show = r.Type === 'Return'; break;
      case 'ReturnAndBoss': show = r.Type === 'Return' || r.Id === map.BossId; break;
      case 'Nearby2': show = dist![r.Id] >= 0 && dist![r.Id] <= 2; break;
      default: show = false; break;
    }
    if (!show || r.Visited) continue;
    r.Revealed = true;
    revealed.push(r);
  }
  if (!wrong) return;
  const candidates = revealed.filter((r) => GUESSABLE.includes(r.Type));
  if (candidates.length === 0) return;
  const target = rng.pick(candidates);
  const others = GUESSABLE.filter((t) => t !== target.Type);
  target.ShownType = ROOM_ORDER.indexOf(rng.pick(others));
}

/** 지금 방 옆 빈 칸에 보물 방을 만든다. 빈 칸이 없으면 false. */
export function spawnTreasure(run: DungeonRun, rng: Rng): boolean {
  const map = run.Map;
  const cur = currentRoom(run);
  const used = new Set(map.Rooms.map((r) => `${r.X},${r.Y}`));
  const dirs = [0, 1, 2, 3];
  rng.shuffle(dirs);
  for (const d of dirs) {
    const x = cur.X + DX[d], y = cur.Y + DY[d];
    if (used.has(`${x},${y}`)) continue;
    const room = newRoom(map.Rooms.length, x, y);
    room.Type = 'Treasure';
    room.Seed = rng.nextSeed();
    room.Revealed = true;
    map.Rooms.push(room);
    linkRooms(cur, room);
    return true;
  }
  return false;
}

/** 지금 방과 보스 방을 잇는 숨은 통로. */
export function linkBoss(run: DungeonRun): void {
  const boss = getRoom(run.Map, run.Map.BossId);
  if (!boss || boss.Id === run.CurrentRoomId) return;
  linkRooms(currentRoom(run), boss);
  if (!boss.Visited) boss.Revealed = true;
}

/** 귀환 방을 찾은 것으로 친다 (귀환 버튼을 바로 쓸 수 있다). */
export function findReturn(run: DungeonRun): void {
  for (const r of run.Map.Rooms) if (r.Type === 'Return') r.Visited = r.Cleared = r.Revealed = true;
}

/** 아직 가지 않은 전투·이벤트 방 하나에 후속 이벤트를 놓는다. */
export function chainEvent(run: DungeonRun, followupId: string, rng: Rng): void {
  const candidates = run.Map.Rooms.filter(
    (r) => !r.Visited && r.Id !== run.CurrentRoomId && r.Id !== run.Map.BossId && (r.Type === 'Battle' || r.Type === 'Event') && !r.Chain,
  );
  if (candidates.length === 0) return;
  const room = rng.pick(candidates);
  room.Type = 'Event';
  room.EventId = followupId;
  room.Chain = true;
  room.Cleared = false;
}

/** 지금 방이 상인의 가게가 된다 (마을 가격 × 0.7). */
export function becomeMerchant(run: DungeonRun, rng: Rng): void {
  const room = currentRoom(run);
  room.Type = 'Merchant';
  room.MerchantGoods = merchantGoods(rng, run.Floor);
  room.MerchantDiscount = true;
  room.Cleared = true;
}

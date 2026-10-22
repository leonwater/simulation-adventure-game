import type { StatusType } from './enums';
import { STATUSES } from './enums';

export interface StatusInstance {
  Type: StatusType;
  Value: number;
  Turns: number;
  /** 걸린 순서 (나중에 건 쪽 판정용). */
  Order: number;
  /** 이번 턴에 걸린 효과는 그 턴 끝에 줄어들지 않는다. */
  Fresh: boolean;
}

export const isDebuff = (t: StatusType): boolean => STATUSES.indexOf(t) >= STATUSES.indexOf('Poison');

/**
 * 버프·디버프 중첩 규칙
 * 1) 서로 다른 효과는 함께 적용
 * 2) 같은 효과·같은 수치가 다시 걸리면 남은 턴이 긴 쪽으로 대체 (같으면 나중에 건 쪽)
 * 3) 같은 효과인데 수치가 다르면 가장 높은 수치만 적용. 높은 쪽이 먼저 끝나면 낮은 쪽이 이어서 적용
 */
export class StatusContainer {
  private list: StatusInstance[] = [];
  private order = 0;

  get all(): readonly StatusInstance[] {
    return this.list;
  }

  /** 지속 턴은 걸린 쪽(주인)의 차례 수다. fresh = 주인이 자기 차례에 스스로 건 효과. */
  apply(type: StatusType, value: number, turns: number, fresh = false): void {
    if (turns <= 0) return;
    const incoming: StatusInstance = { Type: type, Value: value, Turns: turns, Order: ++this.order, Fresh: fresh };
    const idx = this.list.findIndex((s) => s.Type === type && s.Value === value);
    if (idx < 0) {
      this.list.push(incoming);
      return;
    }
    if (incoming.Turns >= this.list[idx].Turns) this.list[idx] = incoming;
  }

  /** 현재 적용 중인 수치 (같은 효과 중 가장 높은 값). 없으면 0. */
  value(type: StatusType): number {
    let best = 0;
    for (const s of this.list) if (s.Type === type && s.Value > best) best = s.Value;
    return best;
  }

  has(type: StatusType): boolean {
    return this.list.some((s) => s.Type === type);
  }

  active(type: StatusType): StatusInstance | null {
    let best: StatusInstance | null = null;
    for (const s of this.list) {
      if (s.Type !== type) continue;
      if (!best || s.Value > best.Value || (s.Value === best.Value && s.Order > best.Order)) best = s;
    }
    return best;
  }

  /** 효과 종류별로 하나씩 (화면 표시용). */
  visible(): StatusInstance[] {
    const result: StatusInstance[] = [];
    for (const t of STATUSES) {
      const a = this.active(t);
      if (a) result.push(a);
    }
    return result;
  }

  remove(type: StatusType): boolean {
    const n = this.list.length;
    this.list = this.list.filter((s) => s.Type !== type);
    return this.list.length < n;
  }

  /** 주인의 턴이 끝날 때: 지속 턴을 1 줄이고 끝난 효과를 지운다. */
  tick(): void {
    for (const s of this.list) {
      if (s.Fresh) s.Fresh = false;
      else s.Turns--;
    }
    this.list = this.list.filter((s) => s.Turns > 0);
  }

  clear(): void {
    this.list = [];
  }
}

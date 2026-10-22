/** 시드를 줄 수 있는 난수 (mulberry32). C# Rng와 같은 메서드 이름을 쓴다 (값 순서는 다르다). */
export class Rng {
  private s: number;

  constructor(seed: number = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0) {
    this.s = seed >>> 0;
  }

  nextDouble(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, maxExclusive) */
  range(min: number, maxExclusive: number): number {
    return min + Math.floor(this.nextDouble() * (maxExclusive - min));
  }

  /** [min, max] 양 끝 포함 */
  rangeInclusive(min: number, max: number): number {
    return this.range(min, max + 1);
  }

  chance(p: number): boolean {
    return this.nextDouble() < p;
  }

  pick<T>(list: readonly T[]): T {
    return list[this.range(0, list.length)];
  }

  shuffle<T>(list: T[]): void {
    for (let i = list.length - 1; i > 0; i--) {
      const j = this.range(0, i + 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  /** 가중치 배열에서 인덱스를 고른다. 합이 0이면 -1. */
  pickWeighted(weights: readonly number[]): number {
    const total = weights.reduce((a, w) => a + Math.max(0, w), 0);
    if (total <= 0) return -1;
    let r = this.nextDouble() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  nextSeed(): number {
    return Math.floor(this.nextDouble() * 0x7fffffff);
  }
}

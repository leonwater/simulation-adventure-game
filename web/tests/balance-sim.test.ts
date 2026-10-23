import { describe, expect, it } from 'vitest';
import { JOBS } from '../src/core/enums';
import { simulate } from '../src/sim/balance';

// v2.9: 후반(20층~) 적 HP·공격력 +45%(30층)·강화 보너스 확대·등급 배율 상향으로 규칙이 C#과 달라졌다.
// v3.1: 등급별 기본 수치 +1~2 · 장비 기본값 ×1.2 반영 후 값. 최소 기준 봇(보통, 도전 150회 · 3시드 · 12명)의 5층 단위 사망률: 35.9 · 38.5 · 42.2 · 47.4 · 56.4 · 63.4 % (표본이 작아 ±10%p로 확인)
const EXPECTED = [35.9, 38.5, 42.2, 47.4, 56.4, 63.4];

describe('밸런스 시뮬레이션', () => {
  it('보통 난이도 사망률이 기준값과 비슷하다', () => {
    const st = simulate('Normal', 150, 3, JOBS);
    st.runs.forEach((runs, i) => {
      const rate = runs === 0 ? 0 : (100 * st.deaths[i]) / runs;
      expect(Math.abs(rate - EXPECTED[i]), `${i * 5 + 1}~${(i + 1) * 5}층 사망률 ${rate.toFixed(1)}%`).toBeLessThan(10);
    });
    // 30층 정복은 드물다: 150회 안에 12명 중 많아야 3명 (v2.9 전: 8명 안팎)
    expect(st.conquered).toBeLessThanOrEqual(3);
  }, 60000);
});

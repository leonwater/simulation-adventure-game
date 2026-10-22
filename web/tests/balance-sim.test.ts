import { describe, expect, it } from 'vitest';
import { JOBS } from '../src/core/enums';
import { simulate } from '../src/sim/balance';

// C# 시뮬레이션(보통, 도전 150회 · 8시드 · 32명)의 5층 단위 사망률: 30.3 · 32.1 · 38.7 · 40.2 · 52.0 · 61.4 %
// 웹 결과는 같은 조건에서 27.8 · 30.8 · 37.4 · 41.8 · 53.0 · 61.5 % (모두 ±3%p 안). 여기서는 표본이 작아 ±8%p로 확인한다.
const CSHARP = [30.3, 32.1, 38.7, 40.2, 52.0, 61.4];

describe('밸런스 시뮬레이션 (C#과 비교)', () => {
  it('보통 난이도 사망률이 C# 결과와 비슷하다', () => {
    const st = simulate('Normal', 150, 3, JOBS);
    st.runs.forEach((runs, i) => {
      const rate = runs === 0 ? 0 : (100 * st.deaths[i]) / runs;
      // v2.7 골드 조정(판매 30%·물약 층별 가격)으로 물약을 덜 사는 만큼 사망률이 조금 오른다 — 허용 폭 8 → 10%p (표본 12명)
      expect(Math.abs(rate - CSHARP[i]), `${i * 5 + 1}~${(i + 1) * 5}층 사망률 ${rate.toFixed(1)}%`).toBeLessThan(10);
    });
    // v2.8 시작 골드 300→200: 초반 장비·물약이 줄어 정복 수가 조금 줄 수 있다 (표본 12명)
    expect(st.conquered).toBeGreaterThanOrEqual(3);
  }, 60000);
});

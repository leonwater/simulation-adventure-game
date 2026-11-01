import { describe, expect, it } from 'vitest';
import { JOBS } from '../src/core/enums';
import { simulate } from '../src/sim/balance';

// v2.9: 후반(20층~) 적 HP·공격력 +45%(30층)·강화 보너스 확대·등급 배율 상향으로 규칙이 C#과 달라졌다.
// v3.1: 등급 배율(v2.9) + 같은 레벨 등급 간 최소 차이(무기 2 · 그 밖 1) 반영 후 값. 최소 기준 봇(보통, 도전 150회 · 3시드 · 12명)의
// 5층 단위 사망률: 34.1 · 44.2 · 41.7 · 45.2 · 59.0 · 60.2 % (표본이 작아 ±10%p로 확인. 64명으로 재면 35 · 39 · 42 · 46 · 59 · 60%)
// v3.5: 몬스터 종류별 체격 재분배(방어 0.7~1.4) + 직업 특수 능력치 → 등급 전용 고유 능력치(반격·회피·관통·증폭) + 후반 보정 0.45→0.52 후 다시 잰 값
const EXPECTED = [35.6, 33.3, 38.5, 37.0, 59.6, 60.9];

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

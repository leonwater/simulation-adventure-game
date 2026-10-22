import type { StatusInstance } from './status';
import type { StatusType } from './enums';

/** 상태 효과 설명 (전투 상세 보기). value는 그 효과의 수치(%, 출혈·화상은 시전자 공격력 %). */
export function describeStatus(s: string, value: number): string {
  switch (s) {
    case 'Empower': return `공격력 +${value}%`;
    case 'Fortify': return `받는 피해 -${value}%`;
    case 'Regen': return `턴마다 최대 HP ${value}% 회복`;
    case 'Focus': return `성공률 +${value}%`;
    case 'Swift': return `회피 +${value}%`;
    case 'Keen': return `스킬 치명타 확률 +${value}%`;
    case 'Cruel': return `치명타 피해 +${value}%`;
    case 'Poison': return `턴마다 최대 HP ${value}% 피해`;
    case 'Bleed': return `행동할 때마다 공격력 ${value}% 피해`;
    case 'Burn': return `턴마다 공격력 ${value}% 피해, 받는 회복 -50%`;
    case 'Weaken': return `공격력 -${value}%`;
    case 'Vulnerable': return `받는 피해 +${value}%`;
    case 'Stun': return '행동 불가';
    case 'Silence': return '스킬 사용 불가';
    case 'Blind': return `성공률 -${value}%`;
    case 'Fear': return `도주 외 성공률 -${value}%`;
    default: return '';
  }
}

const EXPLAIN: Record<StatusType, string> = {
  Empower: '공격력이 오른다.', Fortify: '받는 피해가 줄어든다.', Regen: '내 턴이 시작될 때 최대 HP의 일부를 회복한다.', Focus: '모든 선택지의 성공률이 오른다.',
  Swift: '회피가 올라 적의 공격을 더 잘 피한다.', Keen: '공격 스킬의 치명타 확률이 오른다.', Cruel: '치명타로 주는 피해가 커진다.',
  Poison: '턴이 시작될 때마다 최대 HP의 일부만큼 피해. 해독제로 풀린다.', Bleed: '행동할 때마다 정해진 피해. 붕대로 풀린다.',
  Burn: '턴마다 정해진 피해, 받는 회복이 절반. 화상 연고로 풀린다.', Weaken: '공격력이 내려간다.', Vulnerable: '받는 피해가 늘어난다.',
  Stun: '다음 행동을 할 수 없다.', Silence: '스킬을 쓸 수 없다 (기본 공격·아이템은 가능).', Blind: '모든 선택지의 성공률이 내려간다.', Fear: '도주를 뺀 선택지의 성공률이 내려간다.',
};
/** 상태 이상 안내 (수치 없이 일반 설명). */
export const explainStatus = (t: StatusType): string => EXPLAIN[t];

/**
 * 지금 걸려 있는 효과의 실제 수치 (캐릭터 정보 창). 독·재생은 주인의 최대 HP 기준으로 1턴에 얼마인지,
 * 출혈·화상은 걸릴 때 정해진 고정 피해를 보여 준다.
 */
export function describeActive(s: StatusInstance, ownerMaxHp: number): string {
  switch (s.Type) {
    case 'Poison': return `턴마다 ${Math.max(1, Math.round((ownerMaxHp * s.Value) / 100))} 피해 (최대 HP ${s.Value}%)`;
    case 'Regen': return `턴마다 HP ${Math.round((ownerMaxHp * s.Value) / 100)} 회복 (최대 HP ${s.Value}%)`;
    case 'Bleed': return `행동할 때마다 ${s.Value} 피해`;
    case 'Burn': return `턴마다 ${s.Value} 피해 · 받는 회복 -50%`;
    default: return describeStatus(s.Type, s.Value);
  }
}

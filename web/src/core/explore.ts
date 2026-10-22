import { roundEven } from './balance';
import type { Battle } from './battle';

/** 탐험 효과: 이벤트로 얻어 정해진 전투 횟수나 귀환할 때까지 남는다. */
export type ExploreEffectType = 'Regen' | 'Focus' | 'Drum' | 'DemonPact' | 'Fear' | 'Curse';

export interface ExploreEffect {
  Type: ExploreEffectType;
  /** 남은 전투 횟수. -1이면 횟수 제한 없음 (계약: 귀환까지, 저주: 휴식 방까지). */
  Battles: number;
}

export const REGEN_PERCENT = 5, FOCUS_PERCENT = 10, FEAR_PERCENT = 10, FEAR_TURNS = 3;
export const PACT_ATTACK = 0.2, PACT_TAKEN = 0.15, CURSE_DROP = 0.5;

const NAME: Record<ExploreEffectType, string> = { Regen: '재생', Focus: '집중', Drum: '북소리', DemonPact: '악마의 계약', Fear: '공포', Curse: '저주' };
export const effectName = (t: ExploreEffectType): string => NAME[t];

export function effectDescribe(t: ExploreEffectType): string {
  switch (t) {
    case 'Regen': return `전투 중 턴마다 최대 HP ${REGEN_PERCENT}% 회복`;
    case 'Focus': return `전투 중 선택지 성공률 +${FOCUS_PERCENT}%`;
    case 'Drum': return '다음 전투 방의 적 +1마리 (최대 4)';
    case 'DemonPact': return '공격력 +20%, 받는 피해 +15%';
    case 'Fear': return `다음 전투 첫 ${FEAR_TURNS}턴 동안 공포 (도주 외 성공률 -${FEAR_PERCENT}%)`;
    default: return '드롭률 -50%';
  }
}

export function effectRemaining(e: ExploreEffect): string {
  if (e.Battles >= 0) return `전투 ${e.Battles}회`;
  return e.Type === 'Curse' ? '휴식 방까지' : '귀환까지';
}

/** 효과를 얻는다. 같은 효과가 있으면 남은 횟수가 많은 쪽을 남긴다 (-1 = 무제한이 가장 큼). */
export function addEffect(list: ExploreEffect[], type: ExploreEffectType, battles: number): void {
  const cur = list.find((e) => e.Type === type);
  if (!cur) {
    list.push({ Type: type, Battles: battles });
    return;
  }
  if (cur.Battles < 0) return;
  if (battles < 0 || battles > cur.Battles) cur.Battles = battles;
}

export const hasEffect = (list: ExploreEffect[] | null | undefined, type: ExploreEffectType): boolean => !!list && list.some((e) => e.Type === type);

/** 전투 시작: 이번 전투 내내 걸리는 효과를 적용한다 (공포만 첫 3턴). */
export function applyEffectsToBattle(list: ExploreEffect[] | null | undefined, b: Battle): void {
  if (!list) return;
  for (const e of list) {
    switch (e.Type) {
      case 'Regen': b.player.statuses.apply('Regen', REGEN_PERCENT, 999); break;
      case 'Focus': b.player.statuses.apply('Focus', FOCUS_PERCENT, 999); break;
      case 'Fear': b.player.statuses.apply('Fear', FEAR_PERCENT, FEAR_TURNS); break;
      case 'DemonPact':
        b.player.attack = roundEven(b.player.attack * (1 + PACT_ATTACK));
        b.player.damageReduction -= PACT_TAKEN;
        break;
      case 'Curse': b.dropMultiplier *= CURSE_DROP; break;
    }
  }
}

/** 전투가 끝나면 남은 횟수를 1 줄인다. 북소리는 전투 방에서 쓰였을 때만 줄어든다. */
export function afterBattleEffects(list: ExploreEffect[] | null | undefined, battleRoom: boolean): void {
  if (!list) return;
  for (const e of list) {
    if (e.Battles <= 0) continue;
    if (e.Type === 'Drum' && !battleRoom) continue;
    e.Battles--;
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].Battles === 0) list.splice(i, 1);
}

/** 휴식 방에 들어가면 저주가 풀린다. */
export function onRestEffects(list: ExploreEffect[] | null | undefined): void {
  if (!list) return;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].Type === 'Curse') list.splice(i, 1);
}

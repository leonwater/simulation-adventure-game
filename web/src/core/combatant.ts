import { B } from './balance';
import type { BossKit } from './bosskit';
import type { EnemySkill, MonsterSpecies } from './monsters';
import { StatusContainer } from './status';

/** 전투 참가자 (플레이어 또는 적). */
export class Combatant {
  name = '';
  isPlayer = false;
  maxHp = 0;
  hp = 0;
  attack = 0;
  defense = 0;
  /** 플레이어 공격 성공률 계산에 쓰는 요구치 (적). */
  requirement = 0;
  evasion = 0;
  damageReduction = 0;
  resist = 0;
  critChance = 0;
  critDamage: number = B.CritMultiplier;
  /** 전사 고유: 반격 확률 (모험가 등급으로 오름). */
  counter = 0;
  /** 궁수: 기본 공격이 무시하는 방어 비율 (등급 고유 능력치 '관통'). */
  basicPierce = 0;
  /** 도적: 스킬 치명타 확률 보너스 (등급 고유 능력치 '급소'). */
  critBonus = 0;
  regenPercent = 0;
  readonly statuses = new StatusContainer();
  // 적 전용
  species: MonsterSpecies | null = null;
  skills: EnemySkill[] = [];
  /** 0 일반, 1 엘리트, 2 보스 */
  role = 0;
  expReward = 0;
  goldReward = 0;
  /** 처치하면 장비 확정 드롭 (미믹). */
  guaranteedEquipment = false;
  /** 보상·퀘스트 처치에 세지 않는다 (분열한 작은 개체·소환된 졸개). */
  noReward = false;
  kit: BossKit | null = null;

  get alive(): boolean {
    return this.hp > 0;
  }
  get hpRatio(): number {
    return this.maxHp <= 0 ? 0 : this.hp / this.maxHp;
  }
}

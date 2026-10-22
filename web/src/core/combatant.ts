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

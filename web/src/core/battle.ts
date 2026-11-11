import { B, clamp, pityChance, roundEven } from './balance';
import { BossKit, createMinion, splitChild } from './bosskit';
import type { Character } from './character';
import { attack, defense, equipped, evasion, jobPerk, resist, maxHp, skillDamageBonus, totalStat, weaponAttack } from './character';
import { GRADES, ord } from './enums';
import { Combatant } from './combatant';
import { getSkillState, powerMultiplier } from './equipment';
import { findItem, takeItem, consumableDef } from './items';
import { jobData } from './jobs';
import { Names, josa } from './names';
import type { Rng } from './rng';
import type { SkillDef } from './skills';
import { areaName, skillCooldown, skillDef, skillTurns } from './skills';
import type { StatusApply } from './skills';
import { isDebuff } from './status';
import { describeStatus } from './statustext';

export type BattleOutcome = 'Ongoing' | 'Victory' | 'Defeat' | 'Fled';
export type ActionKind = 'Wait' | 'Attack' | 'Skill' | 'Item' | 'Flee';
export type LogTone = 'Normal' | 'Good' | 'Bad' | 'System';
/** Counter = 전사 반격, Blocked = 막아서 절반만 받은 피격, Pierce = 궁수 관통 기본 공격 (화면에서 따로 보여 준다). */
export type DamageKind = 'Normal' | 'Crit' | 'Poison' | 'Bleed' | 'Burn' | 'Heal' | 'Counter' | 'Blocked' | 'Pierce';
export type BattleEventKind = 'Act' | 'Damage' | 'Miss' | 'Heal' | 'Status' | 'Defeat' | 'Text' | 'Spawn';

export interface LogLine {
  text: string;
  tone: LogTone;
}

/** 화면 연출용 전투 사건. actor/target: -1 = 플레이어, 0 이상 = 적 번호. */
export interface BattleEvent {
  kind: BattleEventKind;
  actor: number;
  target: number;
  amount: number;
  damage: DamageKind;
  hpAfter: number;
  text: string | null;
  /** 대상 보스의 남은 보호막·방어막 (보스가 아니면 -1). */
  shield: number;
  barrier: number;
}

/** 전투 화면 선택지 하나. 모든 선택은 1턴을 쓴다. */
export interface BattleChoice {
  kind: ActionKind;
  label: string;
  /** 대상 적 번호 (-1 = 대상 없음). */
  target: number;
  skillId: string | null;
  itemUid: string | null;
  /** 성공 확률 (0~1). */
  chance: number;
  enabled: boolean;
  /** 쓸 수 없을 때 오른쪽에 보여 줄 문구. */
  note: string;
  /** 길게 눌렀을 때 보여 줄 설명. */
  detail: string;
  /** 선택지에 바로 보여 줄 예상 피해. */
  damageNote: string;
}

const choice = (p: Partial<BattleChoice> & Pick<BattleChoice, 'kind' | 'label'>): BattleChoice => ({
  target: -1, skillId: null, itemUid: null, chance: 1, enabled: true, note: '', detail: '', damageNote: '', ...p,
});

const MAX_ENEMY_SLOTS = 4;
/** 마법사 에너지 볼의 재사용 대기 칸 이름. */
export const ENERGY_BALL = 'mage_ball';
const pct = (v: number): string => (v >= 0 ? '+' : '-') + roundEven(Math.abs(v) * 1000) / 10 + '%';
const r100 = (v: number): number => roundEven(v * 100);

/**
 * 피해 = 공격력 × 배율 × (강화·약화·마력 폭주) × 400/(400+방어력) × (1 - 감소율) × (철벽·취약·마력 폭주) × 치명타(×2.3 + 잔혹함).
 * basic: 기본 공격 — 궁수는 방어력 일부(관통 + 관통 화살)를 무시한다.
 */
export function damage(attacker: Combatant, target: Combatant, mult: number, crit: boolean, basic = false): number {
  const a = attacker.statuses;
  const t = target.statuses;
  const atk = attacker.attack * mult * (1 + a.value('Empower') / 100 - a.value('Weaken') / 100 - a.value('Overload') / 100);
  const pierce = basic ? Math.min(0.9, attacker.basicPierce + a.value('Piercing') / 100) : 0;
  const def = Math.max(0, target.defense) * (1 - pierce);
  let dmg = (atk * B.DefenseConstant) / (B.DefenseConstant + def);
  dmg *= 1 - target.damageReduction;
  dmg *= 1 - t.value('Fortify') / 100 + t.value('Vulnerable') / 100 + t.value('Overload') / 100;
  if (crit) dmg *= attacker.critDamage + a.value('Cruel') / 100;
  return Math.max(1, roundEven(dmg));
}

/** 방어막·보호막 (선택지 예상 피해 옆에 붙인다). */
function guardNote(target: Combatant | null): string {
  const k = target?.kit;
  if (!k) return '';
  if (k.barrier > 0) return ` · 방어막 ${k.barrier}회 (막힘)`;
  if (k.shield > 0) return ` · 보호막 ${k.shield}`;
  return '';
}

/**
 * 선택지 기반 턴제 전투. 플레이어가 하나 고르면 1턴: 플레이어 행동 → 살아 있는 적들의 행동.
 * 치명타는 도적 스킬에서만 발생하며 피해 ×2.3 (잔혹함으로 증가). 여러 번 때리는 스킬은 타격마다 따로 판정한다.
 * 상태 이상 지속 턴은 주인의 턴이 끝날 때 줄어든다 (이번 턴에 걸린 효과는 다음 턴부터).
 */
export class Battle {
  readonly player: Combatant;
  turn = 1;
  outcome: BattleOutcome = 'Ongoing';
  killedBy = '';
  readonly log: LogLine[] = [];
  /** 마지막 행동(또는 기습)에서 일어난 일. 화면 연출용. */
  lastEvents: BattleEvent[] = [];
  /** 처치한 적 (보상·퀘스트 처리용). */
  readonly defeated: Combatant[] = [];
  /** 난이도 (보스가 부르는 졸개의 수치). */
  difficulty = 'Normal';
  /** 드롭률 배율 (저주 0.5). */
  dropMultiplier = 1;
  /** 보스전이어도 도주할 수 있다 (시련의 문). */
  fleeAllowed = false;
  /** 내 공격이 언제나 명중한다 (튜토리얼 0층). */
  sureHit = false;
  /** 스킬(·마법사 에너지 볼) 재사용 대기. 스킬은 같은 던전 안에서 다음 전투로 이어진다 (cooldownState). */
  private readonly cooldowns = new Map<string, number>();
  private acting: Combatant | null = null;

  /** ambush: 적이 먼저 행동한다 (미믹 기습). setup: 기습 전에 적용할 준비 (탐험 효과·시련의 문). */
  constructor(
    readonly character: Character,
    readonly floor: number,
    readonly enemies: Combatant[],
    readonly isBoss: boolean,
    readonly rng: Rng,
    opts: { ambush?: boolean; setup?: (b: Battle) => void; cooldowns?: Record<string, number> } = {},
  ) {
    for (const [k, v] of Object.entries(opts.cooldowns ?? {})) if (v > 0) this.cooldowns.set(k, v);
    const p = new Combatant();
    p.name = character.Name;
    p.isPlayer = true;
    p.maxHp = maxHp(character);
    p.hp = Math.max(1, Math.min(character.CurrentHp, p.maxHp));
    p.attack = attack(character);
    p.defense = defense(character);
    p.evasion = evasion(character);
    const perk = jobPerk(character);
    if (character.Job === 'Warrior') p.counter = perk;
    if (character.Job === 'Archer') p.basicPierce = perk;
    if (character.Job === 'Rogue') {
      p.critBonus = perk;
      p.critDamage += perk * B.RogueCritDamageRatio;
    }
    p.resist = resist(character);
    this.player = p;
    opts.setup?.(this);
    this.add(josa((isBoss ? '보스 ' : '') + enemies.map((e) => e.name).join(', '), '이/가') + ' 나타났다!', 'Bad');
    if (opts.ambush) {
      this.add('기습이다! 적이 먼저 움직인다.', 'Bad');
      this.event('Text', -1, -1, { text: '기습!' });
      this.enemyPhase();
      if (this.isOver) return;
    }
    this.add('▶ 당신의 차례입니다.', 'System');
  }

  get isOver(): boolean {
    return this.outcome !== 'Ongoing';
  }
  get canFlee(): boolean {
    return !this.isBoss || this.fleeAllowed;
  }
  cooldown(id: string): number {
    return this.cooldowns.get(id) ?? 0;
  }
  /** 남은 스킬 재사용 대기 (던전 진행에 저장해 다음 전투로 넘긴다). 에너지 볼은 기본 공격이라 전투가 끝나면 풀린다. */
  cooldownState(): Record<string, number> {
    return Object.fromEntries([...this.cooldowns].filter(([k, v]) => v > 0 && k !== ENERGY_BALL));
  }
  indexOf(c: Combatant): number {
    return c.isPlayer ? -1 : this.enemies.indexOf(c);
  }
  aliveEnemies(): Combatant[] {
    return this.enemies.filter((e) => e.alive);
  }

  private add(text: string, tone: LogTone = 'Normal'): void {
    this.log.push({ text, tone });
  }

  private event(kind: BattleEventKind, actor: number, target: number, o: { amount?: number; damage?: DamageKind; hpAfter?: number; text?: string | null } = {}): void {
    const kit = target >= 0 && target < this.enemies.length ? this.enemies[target].kit : null;
    this.lastEvents.push({
      kind, actor, target, amount: o.amount ?? 0, damage: o.damage ?? 'Normal', hpAfter: o.hpAfter ?? 0, text: o.text ?? null,
      shield: kit ? kit.shield : -1, barrier: kit ? kit.barrier : -1,
    });
  }

  // ── 확률 ───────────────────────────────────────────────

  private statusBonus(flee: boolean): number {
    const s = this.player.statuses;
    let bonus = s.value('Focus') / 100 - s.value('Blind') / 100;
    if (!flee) bonus -= s.value('Fear') / 100;
    return bonus;
  }

  /** 공격 성공률 = 기본 + (주 공격 능력치 - 적 요구치) × 1% + 버프 + 스킬 보정. */
  hitChance(target: Combatant, skillBonus = 0): number {
    if (this.sureHit) return 1;
    const stat = totalStat(this.character, jobData(this.character.Job).attackStat);
    return clamp(B.BaseHit + (stat - target.requirement) * B.HitPerStatPoint + this.statusBonus(false) + skillBonus, B.MinHit, B.MaxHit);
  }

  /** 도주 = 67% + 회피 + 날렵함 + 집중 - 실명 (공포는 영향 없음), 최대 87%. 보스전은 불가. */
  fleeChance(): number {
    if (!this.canFlee) return B.BossFleeChance;
    const p = B.BaseFlee + this.player.evasion + this.player.statuses.value('Swift') / 100 + this.statusBonus(true);
    return clamp(p, B.MinSuccess, B.MaxFlee);
  }

  /** 적이 플레이어를 맞힐 확률 = 90% - 회피 - 날렵함 - 적의 실명. */
  enemyHitChance(enemy: Combatant): number {
    const p = B.EnemyBaseHit - this.player.evasion - this.player.statuses.value('Swift') / 100 - enemy.statuses.value('Blind') / 100;
    return clamp(p, B.MinSuccess, B.MaxSuccess);
  }

  /** 성공률 계산 내역 (길게 눌러 보기). */
  hitBreakdown(target: Combatant, skillBonus: number, basic = false): string {
    const stat = totalStat(this.character, jobData(this.character.Job).attackStat);
    const parts = [`기본 ${r100(B.BaseHit)}%`];
    parts.push(`${Names.stat(jobData(this.character.Job).attackStat)} ${stat} vs 요구치 ${roundEven(target.requirement * 10) / 10}: ${pct((stat - target.requirement) * B.HitPerStatPoint)}`);
    const s = this.player.statuses;
    if (s.has('Focus')) parts.push(`집중 ${pct(s.value('Focus') / 100)}`);
    if (s.has('Blind')) parts.push(`실명 ${pct(-s.value('Blind') / 100)}`);
    if (s.has('Fear')) parts.push(`공포 ${pct(-s.value('Fear') / 100)}`);
    if (Math.abs(skillBonus) > 1e-9) parts.push(`${basic ? '기본 공격 보정' : '스킬 보정'} ${pct(skillBonus)}`);
    if (this.sureHit) return '튜토리얼 동안은 언제나 명중 = 100%';
    return `${parts.join(' · ')} = ${r100(this.hitChance(target, skillBonus))}% (${r100(B.MinHit)}~${r100(B.MaxHit)}%)\n같은 행동을 이 확률로 빗나가면 다음 판정이 +${r100(B.HitPityStep)}%p씩 오르고, 맞히면 처음으로 돌아간다. 오래 하면 이 값만큼 맞힌다.`;
  }

  private fleeBreakdown(): string {
    if (!this.canFlee) return '보스에게서는 도망칠 수 없다.';
    const parts = [`기본 ${r100(B.BaseFlee)}%`, `회피 ${pct(this.player.evasion)}`];
    const s = this.player.statuses;
    if (s.has('Swift')) parts.push(`날렵함 ${pct(s.value('Swift') / 100)}`);
    if (s.has('Focus')) parts.push(`집중 ${pct(s.value('Focus') / 100)}`);
    if (s.has('Blind')) parts.push(`실명 ${pct(-s.value('Blind') / 100)}`);
    return `${parts.join('\n')}\n= ${r100(this.fleeChance())}% (최대 ${r100(B.MaxFlee)}%)\n실패하면 적이 행동한다.`;
  }

  // ── 선택지 ─────────────────────────────────────────────

  getChoices(): BattleChoice[] {
    const list: BattleChoice[] = [];
    if (this.isOver) return list;
    if (this.player.statuses.has('Stun')) {
      list.push(choice({ kind: 'Wait', label: '기절해 움직일 수 없다', note: '턴 넘기기', detail: '기절: 이번 턴은 행동할 수 없다.' }));
      return list;
    }
    const alive = this.aliveEnemies();
    const silenced = this.player.statuses.has('Silence');
    list.push(...this.basicChoices(alive, silenced));
    for (const id of this.character.Skills.Equipped) {
      const def = skillDef(id);
      if (!def) continue;
      const cd = this.cooldown(id);
      const note = silenced ? '침묵 상태' : cd > 0 ? `${cd}턴` : '';
      const enabled = note.length === 0;
      if (def.NeedsTarget && enabled) {
        for (const e of alive) {
          list.push(choice({
            kind: 'Skill', skillId: id, label: `${def.Name} · ${e.name}`, target: this.enemies.indexOf(e),
            chance: this.hitChance(e, def.SuccessBonus),
            damageNote: this.skillNote(def, e, [e]) + (def.IsAttack ? guardNote(e) : ''),
            detail: this.skillDetail(def, e),
          }));
        }
      } else {
        let chance = 1;
        const target = alive.length > 0 ? alive[0] : null;
        if (def.Target === 'AllEnemies' && alive.length > 0) {
          chance = alive.reduce((a, e) => a + this.hitChance(e, def.SuccessBonus), 0) / alive.length;
        }
        list.push(choice({
          kind: 'Skill', skillId: id, label: def.Name, chance, enabled, note,
          damageNote: this.skillNote(def, target, alive), detail: this.skillDetail(def, target),
        }));
      }
    }
    const hasItems = this.getItemChoices().length > 0;
    list.push(choice({ kind: 'Item', label: '아이템 사용', enabled: hasItems, note: hasItems ? '›' : '없음', detail: '소모품을 쓴다. 1턴을 사용한다.' }));
    list.push(choice({
      kind: 'Flee', label: '도망친다', chance: this.fleeChance(), enabled: this.canFlee,
      note: this.canFlee ? '' : '보스에게서는 도망칠 수 없다', detail: this.fleeBreakdown(),
    }));
    return list;
  }

  // ── 예상 피해 · 상세 설명 ────────────────────────────────

  private skillMult(def: SkillDef, chainIndex = -1): number {
    const state = getSkillState(this.character, def.Id);
    const baseMult = chainIndex >= 0 && chainIndex < def.ChainMults.length ? def.ChainMults[chainIndex] : def.DamageMult;
    return baseMult * powerMultiplier(def, state?.Level ?? 0) * (1 + skillDamageBonus(this.character));
  }
  private sureCrit(def: SkillDef): boolean {
    return def.GuaranteedCrit || (def.FirstTurnCrit && this.turn === 1);
  }
  /** 공격 스킬의 치명타 확률 = 스킬 치명타 + 예리함. */
  private critChance(def: SkillDef): number {
    return def.CritChance + this.player.critBonus + this.player.statuses.value('Keen') / 100;
  }
  /** 지금 치명타 배율 = 기본 ×2.3 + 잔혹함. */
  private get critNow(): number {
    return this.player.critDamage + this.player.statuses.value('Cruel') / 100;
  }

  /** 수련 단계를 반영한 재사용 대기. */
  private cooldownOf(def: SkillDef): number {
    return skillCooldown(def, getSkillState(this.character, def.Id)?.Level ?? 0);
  }
  private turnsOf(def: SkillDef, s: StatusApply): number {
    return skillTurns(def, s.Turns, getSkillState(this.character, def.Id)?.Level ?? 0);
  }

  /**
   * 선택지 아래 한 줄: 단일/광역 종류 · 예상 피해 · 상태 이상 이름과 걸릴 확률 · 치명타 같은 특수 효과.
   * targets는 상태 이상 확률을 평균 낼 적 (보통 고른 적 하나).
   */
  skillNote(def: SkillDef, target: Combatant | null, targets: Combatant[]): string {
    const parts: string[] = [];
    if (def.Target === 'Self') {
      parts.push('자신');
      if (def.HealRatio > 0) parts.push(`HP 약 ${roundEven(this.player.maxHp * def.HealRatio * powerMultiplier(def, getSkillState(this.character, def.Id)?.Level ?? 0))} 회복`);
      for (const s of def.Statuses) parts.push(`${Names.status(s.Type)} ${this.turnsOf(def, s)}턴`);
      return parts.join(' · ');
    }
    parts.push(areaName(def) ?? '단일');
    const crit = this.sureCrit(def);
    if (def.IsAttack && target) {
      if (def.Target === 'ChainEnemies') parts.push(`피해 약 ${def.ChainMults.map((_, i) => damage(this.player, target, this.skillMult(def, i), crit)).join(' → ')}`);
      else parts.push(`피해 약 ${damage(this.player, target, this.skillMult(def), crit)}${def.Hits > 1 ? ` × ${def.Hits}회` : ''}`);
    }
    for (const s of def.Statuses) {
      if (s.OnSelf) {
        parts.push(`자신 ${Names.status(s.Type)} ${this.turnsOf(def, s)}턴`);
        continue;
      }
      const sum = targets.reduce((acc, t) => acc + this.statusLandChance(def, s, t), 0);
      parts.push(`${Names.status(s.Type)} ${this.turnsOf(def, s)}턴 ${targets.length > 0 ? r100(sum / targets.length) : r100(s.Chance)}%`);
    }
    if (def.IsAttack) {
      if (crit) parts.push('확정 치명타');
      else if (this.critChance(def) > 0) parts.push(`치명타 확률 ${r100(Math.min(1, this.critChance(def)))}%`);
      if (def.ExecuteThreshold > 0) parts.push(`HP ${r100(def.ExecuteThreshold)}% 이하 ×${def.ExecuteMult}`);
    }
    return parts.join(' · ');
  }

  /** 상태 이상이 실제로 걸릴 확률: 한 번이라도 명중할 확률 × 효과 확률 × (1 - 대상의 저항). */
  statusLandChance(def: SkillDef, s: StatusApply, target: Combatant | null): number {
    if (def.Target === 'Self') return s.Chance;
    if (!target) return 0;
    // 방어막이 모든 타격을 막으면 상태 이상도 걸리지 않는다 (명중해도 막힌 타격은 효과 없음)
    if (def.IsAttack && target.kit && target.kit.barrier >= Math.max(1, def.Hits)) return 0;
    const hit = this.hitChance(target, def.SuccessBonus);
    const any = 1 - Math.pow(1 - hit, Math.max(1, def.Hits));
    if (s.OnSelf) return any * s.Chance;
    const res = isDebuff(s.Type) ? target.resist : 0;
    return any * s.Chance * (1 - res);
  }

  /** 피해 계산식: 공격력 × 배율 → 방어력 → 피해 감소 → 치명타. */
  damageFormula(mult: number, target: Combatant | null, crit: boolean): string {
    if (!target) return '';
    const a = this.player.statuses;
    const buff = a.value('Empower') / 100 - a.value('Weaken') / 100;
    const parts = [`공격력 ${this.player.attack} × ${r100(mult)}%`];
    if (Math.abs(buff) > 1e-9) parts.push(`강화/약화 ${pct(buff)}`);
    parts.push(`× 방어 보정 ${(B.DefenseConstant / (B.DefenseConstant + Math.max(0, target.defense))).toFixed(2)} (방어력 ${target.defense})`);
    if (target.damageReduction > 0) parts.push(`× 피해 감소 ${pct(-target.damageReduction)}`);
    const t = target.statuses;
    const taken = -t.value('Fortify') / 100 + t.value('Vulnerable') / 100;
    if (Math.abs(taken) > 1e-9) parts.push(`× 철벽/취약 ${pct(taken)}`);
    if (crit) parts.push(`× 치명타 피해량 ${r100(this.critNow)}%`);
    return `피해 계산 (${target.name})\n${parts.join(' ')}\n= 약 ${damage(this.player, target, mult, crit)}`;
  }

  private skillDetail(def: SkillDef, target: Combatant | null): string {
    const lines = [`${def.Name} (${Names.tier(def.Tier)}) — ${def.Effect}`];
    if (def.IsAttack && target) {
      lines.push('');
      lines.push(this.damageFormula(def.Target === 'ChainEnemies' ? this.skillMult(def, 0) : this.skillMult(def), target, this.sureCrit(def)));
      if (def.Hits > 1) lines.push(`타격 ${def.Hits}회, 타격마다 따로 명중 판정`);
      if (areaName(def)) lines.push(`${areaName(def)}: 적마다 따로 판정 (적마다 방어력에 따라 피해가 다름)`);
      if (def.Target === 'ChainEnemies') lines.push(`연쇄 배율 ${def.ChainMults.map((m) => `${r100(m)}%`).join(' → ')}`);
      lines.push('');
      if (this.sureCrit(def)) lines.push(`치명타 확정 (치명타 피해량 ${r100(this.critNow)}%)${def.FirstTurnCrit ? ' — 첫 턴' : ''}`);
      else if (this.critChance(def) > 0) lines.push(`치명타 확률 ${r100(Math.min(1, this.critChance(def)))}% (치명타 피해량 ${r100(this.critNow)}%)`);
      else lines.push('치명타 없음');
      if (def.ExecuteThreshold > 0) lines.push(`처형: HP ${r100(def.ExecuteThreshold)}% 이하 적에게 피해 ×${def.ExecuteMult}`);
    }
    if (def.HealRatio > 0) lines.push(`회복: 최대 HP ${r100(def.HealRatio)}%`);
    if (def.Statuses.length > 0) {
      lines.push('');
      lines.push('부가 효과');
      for (const st of def.Statuses) {
        const who = st.OnSelf || def.Target === 'Self' ? '자신: ' : '적: ';
        const chance = st.Chance < 1 ? ` (${r100(st.Chance)}% 확률)` : '';
        lines.push(`· ${who}${Names.status(st.Type)} ${this.turnsOf(def, st)}턴 — ${describeStatus(st.Type, st.Value)}${chance}`);
        if (target || def.Target === 'Self') {
          const res = !st.OnSelf && def.Target !== 'Self' && isDebuff(st.Type) && target && target.resist > 0 ? ` (저항 ${r100(target.resist)}% 반영)` : '';
          lines.push(`  실제로 걸릴 확률 약 ${r100(this.statusLandChance(def, st, target))}%${res}`);
        }
      }
    }
    lines.push('');
    lines.push(`재사용 ${this.cooldownOf(def)}턴`);
    if (def.Target === 'Self') lines.push('자신에게 거는 스킬: 성공률 100%');
    else if (target) lines.push(`${def.Hits > 1 ? '타격당 ' : ''}성공 확률: ${this.hitBreakdown(target, def.SuccessBonus)}`);
    return lines.join('\n');
  }

  /** 전투 중 쓸 수 있는 소모품. */
  getItemChoices(): BattleChoice[] {
    const list: BattleChoice[] = [];
    for (const item of this.character.Inventory.Items) {
      if (item.Kind !== 'Consumable') continue;
      const def = consumableDef(item.TemplateId);
      if (!def) continue;
      const useful = def.HealRatio > 0 ? this.player.hp < this.player.maxHp : def.Cures != null && this.player.statuses.has(def.Cures);
      list.push(choice({
        kind: 'Item', itemUid: item.Uid, label: `${item.Name} ×${item.Count}`, enabled: useful,
        note: useful ? def.Description : def.HealRatio > 0 ? 'HP 가득' : '해당 없음', detail: def.Description,
      }));
    }
    return list;
  }

  // ── 턴 진행 ────────────────────────────────────────────

  /** 선택지를 실행하고 적의 차례까지 진행한다. 연출용 사건은 lastEvents에 쌓인다. */
  execute(c: BattleChoice): void {
    if (this.isOver) throw new Error('전투가 끝났습니다');
    if (!c || !c.enabled) throw new Error('선택할 수 없습니다');
    this.lastEvents = [];
    this.startOfTurn(this.player);
    if (!this.checkEnd()) {
      if (this.player.statuses.has('Stun')) {
        this.add(`${josa(this.player.name, '은/는')} 기절해 움직일 수 없다.`, 'Bad');
        this.event('Text', -1, -1, { text: '기절' });
      } else {
        this.acting = this.player;
        this.playerAct(c);
        this.acting = null;
      }
    }
    this.player.statuses.tick();
    this.tickCooldowns(c);
    if (this.checkEnd()) return;
    this.enemyPhase();
    if (this.isOver) return;
    this.turn++;
    this.add('▶ 당신의 차례입니다.', 'System');
  }

  private enemyPhase(): void {
    // 분열·소환으로 적 목록이 바뀔 수 있어 복사본으로 돈다 (새로 나온 적은 다음 턴부터 행동)
    for (const e of [...this.enemies]) {
      if (!e.alive) continue;
      this.startOfTurn(e);
      if (e.alive) {
        if (e.statuses.has('Stun')) {
          this.add(`${josa(e.name, '은/는')} 기절해 있다.`);
          this.event('Text', this.indexOf(e), -1, { text: '기절' });
        } else {
          this.acting = e;
          this.enemyAct(e);
          this.acting = null;
        }
      }
      e.statuses.tick();
      if (this.checkEnd()) return;
    }
    this.updateIntents();
  }

  private tickCooldowns(used: BattleChoice): void {
    for (const [k, v] of [...this.cooldowns]) {
      // 이번 턴에 쓴 것은 다음 턴부터 줄어든다
      if (used.kind === 'Skill' && used.skillId === k && v === this.cooldownOf(skillDef(k)!)) continue;
      if (used.kind === 'Attack' && k === ENERGY_BALL && v === B.EnergyBallCooldown) continue;
      this.cooldowns.set(k, Math.max(0, v - 1));
    }
  }

  // ── 기본 공격 (마법사는 에너지 볼) ──────────────────────

  /** 기본 공격 배율: 궁수는 매의 눈만큼 커지고 속사 중에는 한 발당 90%, 마법사 에너지 볼은 무기 공격력·등급에 비례. */
  private basicMult(): number {
    // 속사(여러 번 타격) 중에는 한 발당 RapidHitMult (v3.16: 속사 2회 × 90%)
    if (this.character.Job !== 'Mage') return jobData(this.character.Job).basicAttackMultiplier * (1 + this.player.statuses.value('Hawk') / 100) * (this.player.statuses.has('Rapid') ? B.RapidHitMult : 1);
    // 에너지 볼 = 공격력 × (기본 + 무기 등급당 보너스) + 무기 공격력 × 배율 → 무기 공격력·등급이 높을수록 세다
    const w = equipped(this.character, 'Weapon');
    const atk = Math.max(1, this.player.attack);
    const base = atk * (B.EnergyBallBase + (w ? ord(GRADES, w.Grade) : 0) * B.EnergyBallPerGrade) + weaponAttack(this.character) * B.EnergyBallWeapon;
    return base / atk;
  }
  private basicHits(): number {
    return 1 + this.player.statuses.value('Rapid');
  }
  /** 마법사가 지금 쓸 수 있는 공격(에너지 볼·스킬)이 하나도 없는지 → 마력 폭주. */
  private mageStuck(silenced: boolean): boolean {
    if (this.character.Job !== 'Mage' || this.cooldown(ENERGY_BALL) <= 0) return false;
    return silenced || this.character.Skills.Equipped.every((id) => this.cooldown(id) > 0);
  }

  private basicChoices(alive: Combatant[], silenced: boolean): BattleChoice[] {
    const mage = this.character.Job === 'Mage';
    const stuck = this.mageStuck(silenced);
    const mult = this.basicMult();
    const hits = this.basicHits();
    const cd = mage ? this.cooldown(ENERGY_BALL) : 0;
    const name = !mage ? '공격' : stuck ? '마력 폭주' : '에너지 볼';
    const pierce = Math.min(0.9, this.player.basicPierce + this.player.statuses.value('Piercing') / 100);
    const what = !mage ? `기본 공격 — 피해 ${r100(mult)}%${hits > 1 ? ` × ${hits}회` : ''}${pierce > 0 ? ` · 방어 ${r100(pierce)}% 무시` : ''}, 치명타 없음`
      : stuck ? `마력 폭주 — 쓸 수 있는 공격이 없어 에너지 볼을 억지로 쏜다. 이후 ${B.OverloadTurns}턴 동안 주는 피해 -${B.OverloadValue}% · 받는 피해 +${B.OverloadValue}%`
        : `에너지 볼 — 무기 공격력·등급에 비례하는 단일 공격, 재사용 ${B.EnergyBallCooldown}턴`;
    return alive.map((e) => choice({
      kind: 'Attack', label: `${name} · ${e.name}`, target: this.enemies.indexOf(e), chance: this.hitChance(e, B.BasicAttackBonus),
      enabled: !mage || stuck || cd <= 0, note: mage && !stuck && cd > 0 ? `${cd}턴` : '',
      damageNote: `피해 약 ${damage(this.player, e, mult, false, true)}${hits > 1 ? ` × ${hits}회` : ''}${guardNote(e)}`,
      detail: `${what}\n\n${this.damageFormula(mult, e, false)}\n\n성공 확률\n${this.hitBreakdown(e, B.BasicAttackBonus, true)}`,
    }));
  }

  private basicAttack(c: BattleChoice): void {
    const stuck = this.mageStuck(this.player.statuses.has('Silence'));
    this.event('Act', -1, c.target, { text: this.character.Job === 'Mage' ? (stuck ? '마력 폭주' : '에너지 볼') : null });
    this.playerHits(this.enemies[c.target], this.basicMult(), this.basicHits(), B.BasicAttackBonus, null, true);
    if (this.character.Job !== 'Mage') return;
    this.cooldowns.set(ENERGY_BALL, B.EnergyBallCooldown);
    if (stuck) {
      this.add('마력이 폭주한다! 한동안 약해진다.', 'Bad');
      this.applyStatus(this.player, this.player, { Type: 'Overload', Value: B.OverloadValue, Turns: B.OverloadTurns, OnSelf: true, Chance: 1 });
    }
  }

  private playerAct(c: BattleChoice): void {
    this.bleed(this.player);
    if (!this.player.alive) return;
    switch (c.kind) {
      case 'Attack':
        this.basicAttack(c);
        break;
      case 'Skill':
        this.useSkill(c);
        break;
      case 'Item':
        this.useItem(c.itemUid!);
        break;
      case 'Flee':
        if (this.rng.chance(this.fleeChance())) {
          this.outcome = 'Fled';
          this.add('무사히 도망쳤다.', 'System');
          this.event('Text', -1, -1, { text: '도주 성공' });
        } else {
          this.add('도망치지 못했다!', 'Bad');
          this.event('Text', -1, -1, { text: '도주 실패' });
        }
        break;
    }
  }

  /** 스킬 대상 목록: 고른 적부터, 나머지 살아 있는 적을 순서대로. */
  private skillTargets(def: SkillDef, primary: number): Combatant[] {
    const alive = this.aliveEnemies();
    if (def.Target === 'AllEnemies') return alive;
    const list: Combatant[] = [];
    if (primary >= 0 && primary < this.enemies.length && this.enemies[primary].alive) list.push(this.enemies[primary]);
    else if (alive.length > 0) list.push(alive[0]);
    if (list.length === 0) return list;
    // 적 자리 = 배열 순서: 0 전방 위 · 1 후방 위 · 2 전방 아래 · 3 후방 아래 (왼쪽 열이 전방)
    const at = this.enemies.indexOf(list[0]);
    const add = (i: number): void => {
      const e = this.enemies[i];
      if (e && e.alive && !list.includes(e)) list.push(e);
    };
    if (def.Target === 'Column') add(at ^ 2); // 좌우: 같은 열의 위·아래
    else if (def.Target === 'Row') add(at ^ 1); // 앞뒤: 같은 가로줄의 앞·뒤
    else if (def.Target === 'RandomEnemies' || def.Target === 'ChainEnemies') {
      const want = def.Target === 'ChainEnemies' ? def.ChainMults.length : def.TargetCount;
      const rest = alive.filter((e) => !list.includes(e));
      while (list.length < want && rest.length > 0) list.push(rest.splice(this.rng.range(0, rest.length), 1)[0]);
    }
    return list;
  }

  private useSkill(c: BattleChoice): void {
    const def = skillDef(c.skillId)!;
    const state = getSkillState(this.character, def.Id);
    const level = state?.Level ?? 0;
    const power = powerMultiplier(def, level);
    this.cooldowns.set(def.Id, skillCooldown(def, level));
    // 비전투 스킬은 수련 1단계부터 효과가 1턴 더 간다
    const statuses = def.Statuses.map((s) => ({ ...s, Turns: skillTurns(def, s.Turns, level) }));
    this.add(`${def.Name}!`);
    if (def.Target === 'Self') {
      this.event('Text', -1, -1, { text: def.Name });
      if (def.HealRatio > 0) this.heal(this.player, roundEven(this.player.maxHp * def.HealRatio * power));
      for (const s of statuses) this.applyStatus(this.player, this.player, s);
      return;
    }
    if (!def.IsAttack) {
      // 피해 없이 적에게 상태 이상만 거는 스킬: 적마다 성공을 따로 판정한다
      const affected = this.skillTargets(def, c.target);
      this.event('Act', -1, affected.length > 0 ? this.indexOf(affected[0]) : -1, { text: def.Name });
      for (const t of affected) {
        if (!t.alive) continue;
        if (!this.rollHit(def.Id, this.hitChance(t, def.SuccessBonus))) {
          this.add(`${t.name}에게 ${def.Name} — 빗나갔다.`);
          this.event('Miss', -1, this.indexOf(t), { hpAfter: t.hp });
          continue;
        }
        for (const s of statuses) this.applyStatus(this.player, s.OnSelf ? this.player : t, s);
      }
      return;
    }
    const targets = this.skillTargets(def, c.target);
    this.event('Act', -1, targets.length > 0 ? this.indexOf(targets[0]) : -1, { text: def.Name });
    const bonus = 1 + skillDamageBonus(this.character);
    const baseMult = def.DamageMult * power * bonus;
    for (let i = 0; i < targets.length; i++) {
      const mult = def.Target === 'ChainEnemies' ? def.ChainMults[i] * power * bonus : baseMult;
      this.playerHits(targets[i], mult, def.Hits, def.SuccessBonus, def);
    }
  }

  /**
   * 플레이어 명중 판정 (표시 확률 p). 같은 행동을 같은 표시 확률로 빗나갈수록 다음 확률이 오르고 명중하면 처음으로 — 평균은 p와 같다.
   * 표시 확률까지 열쇠에 넣는 까닭: 행동만으로 세면 확률이 바뀔 때(다른 적·실명) 낮은 확률 쪽이 표시보다 2~3%p 덜 맞았다 (v3.18 시뮬레이션).
   */
  private rollHit(action: string, p: number): boolean {
    const key = `${action}:${Math.round(p * 100)}`;
    const m = (this.character.HitMisses ??= {});
    const hit = this.rng.chance(pityChance(p, m[key] ?? 0));
    if (hit) delete m[key];
    else m[key] = (m[key] ?? 0) + 1;
    return hit;
  }

  /** 플레이어의 타격. 타격마다 명중을 따로 판정하고, 치명타는 스킬에서만 난다. */
  private playerHits(target: Combatant, mult: number, hits: number, successBonus: number, skill: SkillDef | null, basic = false): void {
    if (!target.alive) return;
    const ti = this.indexOf(target);
    let landed = 0, total = 0, blocked = 0;
    let anyCrit = false;
    for (let h = 0; h < hits && target.alive; h++) {
      if (!this.rollHit(skill?.Id ?? 'basic', this.hitChance(target, successBonus))) {
        this.event('Miss', -1, ti, { hpAfter: target.hp });
        continue;
      }
      const crit = skill != null && (this.sureCrit(skill) || this.rng.chance(this.critChance(skill)));
      if (this.blockedByBarrier(target)) {
        blocked++;
        continue;
      }
      let m = mult;
      if (skill && skill.ExecuteThreshold > 0 && target.hpRatio <= skill.ExecuteThreshold) m *= skill.ExecuteMult;
      const dmg = damage(this.player, target, m, crit, basic);
      target.hp = Math.max(0, target.hp - absorbShield(target, dmg));
      total += dmg;
      landed++;
      anyCrit = anyCrit || crit;
      this.event('Damage', -1, ti, { amount: dmg, damage: crit ? 'Crit' : basic && this.player.basicPierce + this.player.statuses.value('Piercing') > 0 ? 'Pierce' : 'Normal', hpAfter: target.hp });
      this.afterEnemyHit(target, dmg, true);
    }
    const what = skill ? skill.Name : this.character.Job === 'Mage' ? '에너지 볼' : '공격';
    const guard = blocked > 0 ? ` (방어막이 ${blocked}회 막음${target.kit!.barrier > 0 ? `, ${target.kit!.barrier}회 남음` : ', 방어막 깨짐'})` : '';
    if (landed === 0) this.add(`${target.name}에게 ${what} — ${blocked > 0 ? `막혔다.${guard}` : '빗나갔다.'}`);
    else {
      const count = hits > 1 ? ` (${landed}/${hits}회 명중)` : '';
      this.add(`${target.name}에게 ${anyCrit ? '치명타 ' : ''}${total} 피해${count}${guard}`, anyCrit ? 'Good' : 'Normal');
    }
    if (skill && landed > 0 && target.alive) for (const s of skill.Statuses) this.applyStatus(this.player, s.OnSelf ? this.player : target, s);
    if (!target.alive) this.onEnemyDown(target);
  }

  private useItem(uid: string): void {
    const item = findItem(this.character.Inventory, uid);
    const def = item ? consumableDef(item.TemplateId) : undefined;
    if (!def) return;
    takeItem(this.character.Inventory, uid, 1);
    this.add(`${josa(def.Name, '을/를')} 사용했다.`);
    this.event('Text', -1, -1, { text: def.Name });
    if (def.HealRatio > 0) this.heal(this.player, roundEven(this.player.maxHp * def.HealRatio));
    if (def.Cures && this.player.statuses.remove(def.Cures)) this.add(`${Names.status(def.Cures)} 상태가 풀렸다.`, 'Good');
  }

  private enemyAct(e: Combatant): void {
    const ei = this.indexOf(e);
    this.bleed(e);
    if (!e.alive) {
      this.onEnemyDown(e);
      return;
    }
    if (e.kit && this.bossTurn(e)) return;
    let skill = null as Combatant['skills'][number] | null;
    for (const s of e.skills) {
      if (this.rng.chance(s.UseChance)) {
        skill = s;
        break;
      }
    }
    if (skill && e.statuses.has('Silence')) skill = null; // 침묵: 스킬 대신 기본 공격
    if (skill && skill.DamageMult <= 0) {
      this.add(`${e.name}의 ${skill.Name}!`);
      this.event('Text', ei, -1, { text: skill.Name });
      if (skill.Status) this.applyStatus(e, skill.Status.OnSelf ? e : this.player, skill.Status);
      return;
    }
    const what = skill ? skill.Name : '공격';
    this.event('Act', ei, -1, { text: skill?.Name ?? null });
    if (!this.rng.chance(this.enemyHitChance(e))) {
      this.add(`${e.name}의 ${what}. 피했다!`);
      this.event('Miss', ei, -1, { hpAfter: this.player.hp });
      return;
    }
    const dmg = this.hitPlayer(e, skill?.DamageMult ?? 1, what);
    if (dmg < 0) return;
    if (skill?.Status && this.player.alive) this.applyStatus(e, skill.Status.OnSelf ? e : this.player, skill.Status);
    if (!this.player.alive) this.killedBy = e.name;
    else this.drainLife(e, dmg);
    this.riposte(e);
  }

  private applyStatus(source: Combatant, target: Combatant, s: StatusApply): void {
    if (!target.alive) return;
    if (!this.rng.chance(s.Chance)) return;
    const debuff = isDebuff(s.Type);
    if (debuff && target !== source && this.rng.chance(target.resist)) {
      this.add(`${josa(target.name, '은/는')} ${Names.status(s.Type)}에 저항했다.`);
      this.event('Text', this.indexOf(target), -1, { text: '저항' });
      return;
    }
    let value = s.Value;
    if (s.Type === 'Bleed' || s.Type === 'Burn') value = Math.max(1, roundEven((source.attack * s.Value) / 100));
    // 자기 차례에 스스로 건 효과만 그 차례 끝에 줄지 않는다
    target.statuses.apply(s.Type, value, s.Turns, target === this.acting);
    const who = target.isPlayer ? '' : `${target.name}: `;
    this.add(`${who}${Names.status(s.Type)} ${s.Turns}턴`, debuff === target.isPlayer ? 'Bad' : 'Good');
    this.event('Status', this.indexOf(source), this.indexOf(target), { text: Names.status(s.Type) });
  }

  private startOfTurn(c: Combatant): void {
    const s = c.statuses;
    const poison = s.value('Poison');
    if (poison > 0) this.hurt(c, Math.max(1, roundEven((c.maxHp * poison) / 100)), '독', 'Poison');
    const burn = s.value('Burn');
    if (burn > 0 && c.alive) this.hurt(c, burn, '화상', 'Burn');
    const regen = s.value('Regen') + c.regenPercent;
    if (regen > 0 && c.alive && c.hp < c.maxHp) this.heal(c, roundEven((c.maxHp * regen) / 100));
    if (!c.alive && !c.isPlayer) this.onEnemyDown(c);
  }

  private bleed(c: Combatant): void {
    const b = c.statuses.value('Bleed');
    if (b > 0) this.hurt(c, b, '출혈', 'Bleed');
  }

  private hurt(c: Combatant, amount: number, cause: string, kind: DamageKind): void {
    c.hp = Math.max(0, c.hp - (c.isPlayer ? amount : absorbShield(c, amount)));
    this.add(`${c.isPlayer ? '' : `${c.name}: `}${josa(cause, '으로/로')} ${amount} 피해`, c.isPlayer ? 'Bad' : 'Normal');
    this.event('Damage', -2, this.indexOf(c), { amount, damage: kind, hpAfter: c.hp });
    if (c.isPlayer && !c.alive) this.killedBy = cause;
    if (!c.isPlayer) this.afterEnemyHit(c, amount, false);
  }

  private heal(c: Combatant, amount: number): void {
    if (c.statuses.has('Burn')) amount = Math.trunc(amount / 2); // 화상: 받는 회복량 -50%
    const before = c.hp;
    c.hp = Math.min(c.maxHp, c.hp + Math.max(0, amount));
    if (c.hp <= before) return;
    this.add(`${c.isPlayer ? '' : `${c.name}: `}HP ${c.hp - before} 회복`, c.isPlayer ? 'Good' : 'Normal');
    this.event('Heal', this.indexOf(c), this.indexOf(c), { amount: c.hp - before, damage: 'Heal', hpAfter: c.hp });
  }

  private onEnemyDown(e: Combatant): void {
    if (this.defeated.includes(e) || this.tryRevive(e)) return;
    this.defeated.push(e);
    this.add(`${josa(e.name, '을/를')} 쓰러뜨렸다!`, 'Good');
    const slot = this.indexOf(e);
    this.event('Defeat', -1, slot);
    if (e.kit) this.afterBossDown(e, slot);
  }

  private checkEnd(): boolean {
    if (this.outcome !== 'Ongoing') return true;
    if (!this.player.alive) {
      this.outcome = 'Defeat';
      this.add('쓰러졌다…', 'Bad');
      this.event('Defeat', -1, -1);
      return true;
    }
    if (this.aliveEnemies().length === 0) {
      this.outcome = 'Victory';
      this.add('전투에서 승리했다!', 'Good');
      return true;
    }
    return false;
  }

  /** 전투 결과의 HP를 캐릭터에 반영한다 (전투가 끝나면 상태 이상은 사라진다). */
  syncHp(): void {
    this.character.CurrentHp = Math.max(this.outcome === 'Defeat' ? 0 : 1, this.player.hp);
  }

  // ── 보스 특성 ──────────────────────────────────────────

  /** 방어막이 남아 있으면 이번 타격을 막는다. */
  private blockedByBarrier(target: Combatant): boolean {
    const k = target.kit;
    if (!k || k.barrier <= 0) return false;
    k.barrier--;
    this.event('Text', this.indexOf(target), this.indexOf(target), { text: '방어막' });
    return true;
  }

  /** 적이 피해를 받은 뒤: 가시 비늘 반사, 광폭화. */
  private afterEnemyHit(e: Combatant, dmg: number, direct: boolean): void {
    const k = e.kit;
    if (!k) return;
    if (direct && k.thorns > 0 && dmg > 0 && this.player.alive) {
      let back = Math.max(1, roundEven(dmg * k.thorns));
      back = Math.min(back, this.player.hp - 1); // 반사로는 쓰러지지 않는다
      if (back > 0) {
        this.player.hp -= back;
        this.add(`가시 비늘에 찔려 ${back} 피해`, 'Bad');
        this.event('Damage', this.indexOf(e), -1, { amount: back, hpAfter: this.player.hp });
      }
    }
    if (k.has('Enrage') && !k.enraged && e.alive && e.hpRatio <= 0.5) {
      k.enraged = true;
      e.attack = Math.max(1, roundEven(e.attack * (1 + k.enrageAttack)));
      this.add(`${e.name}의 광폭화! 공격력 +${r100(k.enrageAttack)}%`, 'Bad');
      this.event('Text', this.indexOf(e), -1, { text: '광폭화!' });
    }
  }

  /** 보스의 특별한 행동. 차례를 썼으면 true (일반 공격을 하지 않는다). */
  private bossTurn(e: Combatant): boolean {
    const k = e.kit!;
    const ei = this.indexOf(e);
    if (k.exhausted > 0) {
      k.exhausted--;
      this.add(`${josa(e.name, '은/는')} 탈진해 숨을 고른다.`);
      this.event('Text', ei, -1, { text: '탈진' });
      return true;
    }
    if (k.chanting) {
      k.chanting = false;
      k.ritualUses--;
      this.add(`${e.name}의 재생 의식!`, 'Bad');
      this.event('Text', ei, -1, { text: '재생 의식' });
      this.heal(e, roundEven(e.maxHp * k.ritualHeal));
      return true;
    }
    if (k.ritualUses > 0 && e.hpRatio <= k.ritualAt && !k.charging) {
      k.chanting = true;
      this.add(`${josa(e.name, '이/가')} 치유 주문을 외우기 시작한다! 다음 턴 HP ${r100(k.ritualHeal)}% 회복`, 'Bad');
      this.event('Text', ei, -1, { text: '주문 영창' });
      return true;
    }
    if (k.has('Smash')) {
      if (k.charging) {
        k.charging = false;
        k.smashTimer = 0;
        k.exhausted = k.exhaustTurns;
        this.strike(e, '혼신의 일격', k.smashMult, 1);
        return true;
      }
      k.smashTimer++;
      if (k.smashTimer >= k.smashEvery - 1) {
        k.charging = true;
        this.add(`${josa(e.name, '이/가')} 기를 모은다! 다음 턴 혼신의 일격 (피해 ×${fmtMult(k.smashMult)})`, 'Bad');
        this.event('Text', ei, -1, { text: '기를 모은다' });
        return true;
      }
    }
    if (k.has('Summon')) {
      k.summonTimer++;
      if (k.summonTimer >= k.summonEvery && this.canSummon(k)) {
        k.summonTimer = 0;
        this.summon(e);
        return true;
      }
    }
    if (k.has('Flurry') && this.rng.chance(k.flurryChance)) {
      this.strike(e, '연속 공격', k.flurryMult, k.flurryHits);
      return true;
    }
    return false;
  }

  private canSummon(k: BossKit): boolean {
    return k.minions.filter((m) => m.alive).length < k.summonMax && this.freeSlot(-1) >= 0;
  }

  /** 보스의 강타·연속 공격: 타격마다 명중 판정, 흡혈 적용. */
  private strike(e: Combatant, name: string, mult: number, hits: number): void {
    const ei = this.indexOf(e);
    this.add(`${e.name}의 ${name}!`, 'Bad');
    this.event('Act', ei, -1, { text: name });
    let landed = 0, total = 0;
    for (let h = 0; h < hits && this.player.alive; h++) {
      if (!this.rng.chance(this.enemyHitChance(e))) {
        this.event('Miss', ei, -1, { hpAfter: this.player.hp });
        continue;
      }
      const dmg = this.hitPlayer(e, mult, '');
      if (dmg < 0) continue;
      total += dmg;
      landed++;
    }
    if (landed === 0) this.add('모두 피했다!');
    else this.add(`${total} 피해${hits > 1 ? ` (${landed}/${hits}회 명중)` : ''}`, 'Bad');
    if (!this.player.alive) this.killedBy = e.name;
    else this.drainLife(e, total);
    this.riposte(e);
  }

  private pendingRiposte = false;

  /**
   * 명중한 적 공격 한 번: 전사는 반격 확률로 피해를 절반으로 줄인 뒤 그 적의 행동이 끝나면 반격한다.
   * what이 있으면 로그 한 줄을 남긴다. 받은 피해를 돌려준다.
   */
  private hitPlayer(e: Combatant, mult: number, what: string): number {
    const ei = this.indexOf(e);
    let dmg = damage(e, this.player, mult, false);
    // 반격 태세: 다음 직접 공격 한 번은 반드시 막는다 (여러 번 때리면 첫 타만, 지속 피해는 이 길로 오지 않음)
    let blocked = this.player.alive && this.player.statuses.remove('Riposte');
    if (!blocked && this.player.counter > 0 && this.player.alive && this.rng.chance(this.player.counter)) blocked = true;
    if (blocked) {
      dmg = Math.max(1, roundEven(dmg / 2));
      this.pendingRiposte = true;
    }
    this.player.hp = Math.max(0, this.player.hp - dmg);
    if (what) this.add(`${e.name}의 ${what}. ${dmg} 피해${blocked ? ' (막아냄)' : ''}`, 'Bad');
    this.event('Damage', ei, -1, { amount: dmg, damage: blocked ? 'Blocked' : 'Normal', hpAfter: this.player.hp });
    return dmg;
  }

  /** 전사의 반격: 막아낸 적에게 기본 공격 피해 (명중 판정 없음, 방어막·보호막은 적용). */
  private riposte(e: Combatant): void {
    if (!this.pendingRiposte) return;
    this.pendingRiposte = false;
    if (!this.player.alive || !e.alive) return;
    const ei = this.indexOf(e);
    if (this.blockedByBarrier(e)) return;
    const dmg = damage(this.player, e, B.RiposteDamage * jobData(this.character.Job).basicAttackMultiplier, false);
    e.hp = Math.max(0, e.hp - absorbShield(e, dmg));
    this.add(`반격! ${e.name}에게 ${dmg} 피해`, 'Good');
    this.event('Damage', -1, ei, { amount: dmg, damage: 'Counter', hpAfter: e.hp });
    if (!e.alive) this.onEnemyDown(e);
  }

  /** 흡혈: 준 피해의 일부만큼 회복. */
  private drainLife(e: Combatant, dealt: number): void {
    const k = e.kit;
    if (!k || k.lifesteal <= 0 || dealt <= 0 || !e.alive) return;
    this.heal(e, Math.max(1, roundEven(dealt * k.lifesteal)));
  }

  private summon(boss: Combatant): void {
    const k = boss.kit!;
    const slot = this.freeSlot(-1);
    const m = createMinion(boss, this.floor, this.difficulty, k.minions.length);
    k.minions.push(m);
    this.place(m, slot);
    this.add(`${josa(boss.name, '이/가')} ${josa(m.name, '을/를')} 불렀다!`, 'Bad');
    this.event('Text', this.indexOf(boss), -1, { text: '부하 소환' });
    this.event('Spawn', this.indexOf(boss), slot, { hpAfter: m.hp, text: m.name });
  }

  /** 새 적을 놓을 자리: 원하는 칸이 비었으면 그 칸, 아니면 쓰러진 적의 칸, 그것도 없으면 4칸까지 뒤에 붙인다. 없으면 -1. */
  private freeSlot(prefer: number): number {
    if (prefer >= 0 && prefer < this.enemies.length && !this.enemies[prefer].alive) return prefer;
    for (let i = 0; i < this.enemies.length; i++) if (!this.enemies[i].alive) return i;
    return this.enemies.length < MAX_ENEMY_SLOTS ? this.enemies.length : -1;
  }

  private place(c: Combatant, slot: number): void {
    if (slot < this.enemies.length) this.enemies[slot] = c;
    else this.enemies.push(c);
  }

  /** 쓰러지기 직전: 부활하면 true (쓰러지지 않는다). */
  private tryRevive(e: Combatant): boolean {
    const k = e.kit;
    if (!k || k.revives <= 0) return false;
    k.revives--;
    k.chanting = k.charging = false;
    e.statuses.clear();
    const hp = Math.max(1, roundEven(e.maxHp * k.reviveHp));
    e.hp = hp;
    this.add(`${josa(e.name, '이/가')} 다시 일어섰다!`, 'Bad');
    this.event('Text', this.indexOf(e), -1, { text: '부활!' });
    this.event('Heal', this.indexOf(e), this.indexOf(e), { amount: hp, damage: 'Heal', hpAfter: hp });
    return true;
  }

  /** 보스가 쓰러진 뒤: 졸개는 흩어지고, 분열하는 보스는 작은 개체로 나뉜다 (2페이즈). */
  private afterBossDown(boss: Combatant, bossSlot: number): void {
    const k = boss.kit!;
    let fled = false;
    for (const m of k.minions) {
      if (!m.alive) continue;
      m.hp = 0;
      fled = true;
      this.event('Defeat', -1, this.indexOf(m));
    }
    if (fled) this.add('우두머리를 잃은 졸개들이 흩어졌다.', 'Good');
    if (k.splitCount <= 0) return;
    const children: Combatant[] = [];
    for (let i = 0; i < k.splitCount; i++) {
      const slot = this.freeSlot(i === 0 ? bossSlot : -1);
      if (slot < 0) break;
      const child = splitChild(boss, i);
      this.place(child, slot);
      children.push(child);
    }
    if (children.length === 0) return;
    this.add(`${josa(boss.name, '이/가')} ${children.length}마리로 나뉘었다! (2페이즈)`, 'Bad');
    this.event('Text', bossSlot, -1, { text: '분열!' });
    for (const c of children) this.event('Spawn', -1, this.indexOf(c), { hpAfter: c.hp, text: c.name });
  }

  /** 다음 턴 행동 예고: 보스 위에 짧게 표시하고, 자세한 내용은 기록에 남긴다. */
  private updateIntents(): void {
    for (const e of this.enemies) {
      const k = e.kit;
      if (!k) continue;
      const before = k.intent;
      if (!e.alive) k.intent = '';
      else if (k.exhausted > 0) k.intent = `탈진 ${k.exhausted}턴`;
      else if (k.chanting) k.intent = '회복 주문 영창';
      else if (k.charging) k.intent = `강타 준비 ×${fmtMult(k.smashMult)}`;
      else if (k.has('Summon') && k.summonTimer + 1 >= k.summonEvery && this.canSummon(k)) k.intent = '부하 소환 예고';
      else k.intent = '';
      if (k.intent === '부하 소환 예고' && before !== k.intent) this.add(`${josa(e.name, '이/가')} 부하를 부르려 한다. 다음 턴 졸개가 나타난다.`, 'Bad');
    }
  }
}

/** 보호막이 먼저 피해를 받는다. HP로 넘어가는 피해를 돌려준다. */
function absorbShield(target: Combatant, dmg: number): number {
  const k = target.kit;
  if (!k || k.shield <= 0) return dmg;
  const absorbed = Math.min(k.shield, dmg);
  k.shield -= absorbed;
  return dmg - absorbed;
}

/** C# ToString("0.0#"): 소수 1자리는 항상, 2자리는 필요할 때만. */
function fmtMult(v: number): string {
  const s = (Math.round(v * 100) / 100).toString();
  return s.includes('.') ? s : `${s}.0`;
}


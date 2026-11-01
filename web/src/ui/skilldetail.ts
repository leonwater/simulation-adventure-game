import { B, clamp, enemyDefense, enemyRequirement } from '../core/balance';
import { attack, maxChallengeFloor, skillDamageBonus, totalStat } from '../core/character';
import { cannotEquipSkillReason, getSkillState, isSkillEquipped, maxSkillLevel, powerMultiplier, trainingEffect } from '../core/equipment';
import { jobData } from '../core/jobs';
import { Names } from '../core/names';
import { isUtility, skillCooldown, skillDef, skillTurns } from '../core/skills';
import { isDebuff } from '../core/status';
import { describeStatus, explainStatus } from '../core/statustext';
import { S } from './game';
import { button, divider, h } from './kit';
import { modal } from './overlay';
import { tierColor } from './theme';
import { areaDiagram } from './skillinfo';

/**
 * 스킬 상세 창 (스킬 화면·수련장 공통): 등급·효과·재사용·범위 그림·성공률·피해 계산·상태 이상 확률·장착 조건.
 * actions 가 있으면 아래에 장착/해제 버튼을 보인다.
 */
export function showSkillDetail(id: string, actions: { equip: (id: string) => void; unequip: (id: string) => void } | null = null): void {
    const c = S.c;
    const def = skillDef(id);
    const st = getSkillState(c, id);
    if (!def || !st) return;
    const m = modal(`${def.Name} (+${st.Level})`);
    const title = m.body.querySelector('h3') as HTMLElement | null;
    if (title) title.style.color = tierColor(def.Tier);
    const line = (k: string, v: string): HTMLElement => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('div', { class: 'sub', style: { width: '72px', flexShrink: '0', fontSize: '13px' } }, k), h('div', { class: 'grow', style: { whiteSpace: 'pre-line' } }, v));
    m.body.append(
      h('b', { style: { fontSize: '13px', color: tierColor(def.Tier) } }, `${Names.tier(def.Tier)} 스킬 · ${def.Role} · 수련 +${st.Level} / ${maxSkillLevel(def)}`),
      h('div', { style: { fontSize: '15px' } }, def.Effect),
      divider(),
      line('재사용', `${skillCooldown(def, st.Level)}턴`));
    // 범위 그림 · 피해 계산식 · 상태 이상 실제 확률 (지금 도전 층의 보통 몬스터 기준)
    m.body.append(h('div', { class: 'row', style: { alignItems: 'center' } }, h('div', { class: 'sub', style: { width: '72px', flexShrink: '0', fontSize: '13px' } }, '범위'), areaDiagram(def, false)));
    const floor = Math.max(1, maxChallengeFloor(c));
    let hit = 1;
    if (def.Target === 'Self') m.body.append(line('성공률', '100%'));
    else {
      hit = clamp(B.BaseHit + (totalStat(c, jobData(c.Job).attackStat) - enemyRequirement(floor)) * B.HitPerStatPoint + def.SuccessBonus, B.MinHit, B.MaxHit);
      m.body.append(line(def.Hits > 1 ? '타격당 성공률' : '성공률', `${Math.round(hit * 100)}%`));
    }
    if (def.IsAttack) {
      const mults = def.ChainMults.length > 0 ? def.ChainMults : [def.DamageMult];
      const power = powerMultiplier(def, st.Level) * (1 + skillDamageBonus(c));
      const atk = attack(c), guard = B.DefenseConstant / (B.DefenseConstant + enemyDefense(floor));
      const dmg = mults.map((x) => Math.max(1, Math.round(atk * x * power * guard)));
      m.body.append(line('피해 계산', `공격력 ${atk} × 배율 ${mults.map((x) => Math.round(x * power * 100)).join(' → ')}% × 방어 보정 ${guard.toFixed(2)}\n= 약 ${dmg.join(' → ')}${def.Hits > 1 ? ` × ${def.Hits}회` : ''}${def.CritChance > 0 || def.GuaranteedCrit ? ` · ${def.GuaranteedCrit ? '치명타 확정' : `치명타 확률 ${Math.round(def.CritChance * 100)}%`}` : ''}`));
    }
    m.body.append(
      line('수련', isUtility(def) ? `1단계 지속 +1턴 · 2단계 재사용 -1턴 (지금 ${trainingEffect(def, st.Level)})` : `+${st.Level} / ${maxSkillLevel(def)}단계`),
      line('장착 조건', `Lv.${def.ReqLevel} · ${def.ReqRank} 등급`));
    for (const s of def.Statuses) {
      const who = s.OnSelf || def.Target === 'Self' ? '자신' : '적';
      // 실제로 걸릴 확률 = 한 번이라도 명중할 확률 × 효과 확률 (보통 몬스터는 저항 0, 정예 10% · 보스 30%는 더 낮다)
      const land = who === '자신' ? s.Chance : (1 - Math.pow(1 - hit, Math.max(1, def.Hits))) * s.Chance;
      m.body.append(line(Names.status(s.Type), `${who} · ${skillTurns(def, s.Turns, st.Level)}턴 · ${describeStatus(s.Type, s.Value)}\n실제로 걸릴 확률 약 ${Math.round(land * 100)}%${who === '적' && isDebuff(s.Type) ? ' (정예·보스는 저항만큼 낮음)' : ''}\n${explainStatus(s.Type)}`));
    }
    if (actions) {
      const equipped = isSkillEquipped(c, id);
      const reason = equipped ? null : cannotEquipSkillReason(c, id);
      const b = button(equipped ? '해제' : reason ?? '장착', () => {
        m.close();
        if (equipped) actions.unequip(id);
        else actions.equip(id);
      }, equipped ? 'outline' : 'primary');
      b.disabled = !equipped && reason !== null;
      b.style.marginTop = '16px';
      m.body.append(b);
    }
}

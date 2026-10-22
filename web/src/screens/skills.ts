import { B } from '../core/balance';
import { attack, maxChallengeFloor, skillDamageBonus, skillSlots, totalStat, precisionBonus } from '../core/character';
import { cannotEquipSkillReason, maxSkillLevel, trainingEffect, equipSkill, getSkillState, isSkillEquipped, meetsSkillRequirement, moveEquippedSkill, powerMultiplier, unequipSkill } from '../core/equipment';
import { TIERS, ord } from '../core/enums';
import { jobData } from '../core/jobs';
import { enemyDefense, enemyRequirement } from '../core/balance';
import { clamp } from '../core/balance';
import { Names } from '../core/names';
import { isUtility, skillCooldown, skillDef, skillTurns } from '../core/skills';
import { isDebuff } from '../core/status';
import { describeStatus, explainStatus } from '../core/statustext';
import { bottomNav, townBar } from '../ui/chrome';
import { dragReorder } from '../ui/drag';
import { areaDiagram } from '../ui/skillinfo';
import { S } from '../ui/game';
import { colored } from '../ui/items';
import { button, divider, h, row, sub } from '../ui/kit';
import { modal, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { navigate } from './nav';

/** 스킬: 장착 슬롯, 보유 스킬(재사용 턴·장착 조건), 장착·해제. 스킬을 누르면 상세 창. */
export class SkillsScreen extends Screen {
  /** 이번에 처음 보는 스킬 (NEW 표시). 화면에 들어오면 모두 확인한 것으로 기록한다. */
  private fresh: Set<string> | null = null;

  onBack(): boolean {
    navigate('town');
    return true;
  }

  build(): HTMLElement {
    const c = S.c;
    if (!this.fresh) {
      this.fresh = new Set(c.Skills.Learned.filter((s) => S.data!.SeenSkills && !S.data!.SeenSkills.includes(s.SkillId)).map((s) => s.SkillId));
      S.markSkillsSeen();
      S.save();
    }
    const slots = skillSlots(c.Rank);
    const cells: HTMLElement[] = [];
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } });
    for (let i = 0; i < slots; i++) {
      if (i < c.Skills.Equipped.length) {
        const id = c.Skills.Equipped[i];
        const def = skillDef(id)!;
        const st = getSkillState(c, id)!;
        const cell = h('button', { class: 'card-btn on', style: { height: '84px', padding: '8px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }, on: { click: () => this.detail(id) } },
          h('b', { style: { fontSize: '14px', textAlign: 'left' } }, def.Name, st.Level > 0 ? colored(` +${st.Level}`, 'var(--gold)') : null), h('span', { class: 'spacer' }), sub(def.Role), sub(`재사용 ${def.Cooldown}턴`));
        cells.push(cell);
        grid.append(cell);
      } else {
        grid.append(h('div', { style: { height: '84px', border: '1px solid #4A5060', borderRadius: '10px', background: 'var(--bg)', padding: '8px' } }, sub('빈 슬롯')));
      }
    }
    queueMicrotask(() => dragReorder(cells, (from, to) => {
      if (!moveEquippedSkill(c, from, to)) return;
      S.save();
      router.rebuild();
    }));
    const list = h('div', { class: 'col', style: { gap: '0' } }, ...c.Skills.Learned.map((st) => this.skillRow(st.SkillId)));
    return h('div', { class: 'page' },
      townBar('스킬', '마을', () => navigate('town'), c),
      h('div', { class: 'scroll' },
        row(h('b', { class: 'grow' }, `장착 슬롯 ${c.Skills.Equipped.length} / ${slots}`)),
        c.Skills.Equipped.length > 1 ? sub('칸을 끌어서 놓으면 순서가 바뀌어요 (전투 선택지 순서).') : null,
        grid,
        h('b', { style: { height: '30px', lineHeight: '30px' } }, '보유 스킬'),
        list),
      bottomNav(3, (i) => navigate(['town', 'character', 'inventory', 'skills'][i] as never)));
  }

  private skillRow(id: string): HTMLElement {
    const c = S.c;
    const def = skillDef(id)!;
    const st = getSkillState(c, id)!;
    const equipped = isSkillEquipped(c, id);
    const meets = meetsSkillRequirement(c, def);
    const info = h('button', { class: 'grow', style: { border: '0', background: 'transparent', textAlign: 'left', padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '2px', minHeight: '48px' }, on: { click: () => this.detail(id) } },
      h('span', { style: { fontSize: '15px' } }, `${def.Name} `, colored(`${Names.tier(def.Tier)}${st.Level > 0 ? ` · +${st.Level}` : ''}`, 'var(--sub)'), this.fresh!.has(id) ? colored(' NEW', '#E38A82') : null),
      h('span', { class: 'sub' }, meets ? h('span', null, colored(def.Role, 'var(--gold)'), ` · ${def.Description}`) : `장착 조건 Lv.${def.ReqLevel} · ${def.ReqRank} 등급`));
    let btn: HTMLElement;
    if (equipped) btn = button('해제', () => this.unequip(id), 'outline', 'sm');
    else if (!meets) {
      const b = button('잠김', () => {}, 'ghost', 'sm');
      b.disabled = true;
      btn = b;
    } else btn = button('장착', () => this.equip(id), 'ghost', 'sm');
    btn.style.width = '64px';
    return h('div', { class: 'row', style: { minHeight: '64px', gap: '10px', borderBottom: '1px solid var(--line-soft)', opacity: !equipped && !meets ? '.55' : '1' } }, info, btn);
  }

  /** 스킬 상세: 등급·효과·피해 배율·재사용·성공률·장착 조건·수련 단계, 장착/해제. */
  private detail(id: string): void {
    const c = S.c;
    const def = skillDef(id);
    const st = getSkillState(c, id);
    if (!def || !st) return;
    const m = modal(def.Name);
    const line = (k: string, v: string): HTMLElement => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('div', { class: 'sub', style: { width: '72px', flexShrink: '0', fontSize: '13px' } }, k), h('div', { class: 'grow', style: { whiteSpace: 'pre-line' } }, v));
    m.body.append(
      h('b', { class: 'gold', style: { fontSize: '13px' } }, `${Names.tier(def.Tier)} 스킬 · ${def.Role} · 수련 +${st.Level} / ${maxSkillLevel(def)}`),
      h('div', { style: { fontSize: '15px' } }, def.Effect),
      divider(),
      line('재사용', `${skillCooldown(def, st.Level)}턴`));
    // 범위 그림 · 피해 계산식 · 상태 이상 실제 확률 (지금 도전 층의 보통 몬스터 기준)
    m.body.append(h('div', { class: 'row', style: { alignItems: 'center' } }, h('div', { class: 'sub', style: { width: '72px', flexShrink: '0', fontSize: '13px' } }, '범위'), areaDiagram(def)));
    const floor = Math.max(1, maxChallengeFloor(c));
    let hit = 1;
    if (def.Target === 'Self') m.body.append(line('성공률', '100% (자신에게 거는 스킬)'));
    else {
      hit = clamp(B.BaseHit + (totalStat(c, jobData(c.Job).attackStat) - enemyRequirement(floor)) * B.HitPerStatPoint + precisionBonus(c) + def.SuccessBonus, B.MinHit, B.MaxHit);
      m.body.append(line('성공률', `${floor}층 보통 몬스터에게 약 ${Math.round(hit * 100)}%`));
    }
    if (def.IsAttack) {
      const mults = def.ChainMults.length > 0 ? def.ChainMults : [def.DamageMult];
      const power = powerMultiplier(def, st.Level) * (1 + skillDamageBonus(c));
      const atk = attack(c), dfn = enemyDefense(floor), guard = B.DefenseConstant / (B.DefenseConstant + dfn);
      const dmg = mults.map((x) => Math.max(1, Math.round(atk * x * power * guard)));
      m.body.append(line('피해 계산', `공격력 ${atk} × 배율 ${mults.map((x) => Math.round(x * power * 100)).join(' → ')}% × 방어 보정 ${guard.toFixed(2)} (${floor}층 방어력 ${dfn})\n= 약 ${dmg.join(' → ')}${def.Hits > 1 ? ` × ${def.Hits}회` : ''}${def.CritChance > 0 || def.GuaranteedCrit ? ` · 치명타 ${def.GuaranteedCrit ? '확정' : `${Math.round(def.CritChance * 100)}%`}` : ''}`));
    }
    const per = Math.round(B.SkillPowerPerLevel[ord(TIERS, def.Tier)] * 100);
    m.body.append(
      line('수련 효과', isUtility(def) ? `1단계 지속 +1턴 · 2단계 재사용 -1턴 (지금 ${trainingEffect(def, st.Level)})` : `단계마다 위력 +${per}% (지금 +${Math.round((powerMultiplier(def, st.Level) - 1) * 100)}%)`),
      line('장착 조건', `Lv.${def.ReqLevel} · ${def.ReqRank} 등급`));
    for (const s of def.Statuses) {
      const who = s.OnSelf || def.Target === 'Self' ? '자신' : '적';
      // 실제로 걸릴 확률 = 한 번이라도 명중할 확률 × 효과 확률 (보통 몬스터는 저항 0, 정예 10% · 보스 30%는 더 낮다)
      const land = who === '자신' ? s.Chance : (1 - Math.pow(1 - hit, Math.max(1, def.Hits))) * s.Chance;
      m.body.append(line(Names.status(s.Type), `${who} · ${skillTurns(def, s.Turns, st.Level)}턴 · ${describeStatus(s.Type, s.Value)}\n실제로 걸릴 확률 약 ${Math.round(land * 100)}%${who === '적' && isDebuff(s.Type) ? ' (정예·보스는 저항만큼 낮음)' : ''}\n${explainStatus(s.Type)}`));
    }
    const equipped = isSkillEquipped(c, id);
    const reason = equipped ? null : cannotEquipSkillReason(c, id);
    const b = button(equipped ? '해제' : reason ?? '장착', () => {
      m.close();
      if (equipped) this.unequip(id);
      else this.equip(id);
    }, equipped ? 'outline' : 'primary');
    b.disabled = !equipped && reason !== null;
    m.body.append(b);
  }

  private equip(id: string): void {
    const r = equipSkill(S.c, id);
    if (!r.ok) return toast(r.error ?? '');
    S.save();
    router.rebuild();
  }
  private unequip(id: string): void {
    unequipSkill(S.c, id);
    S.save();
    router.rebuild();
  }
}

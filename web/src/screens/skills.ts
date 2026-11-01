import { skillSlots } from '../core/character';
import { B } from '../core/balance';
import { RANKS } from '../core/enums';
import { equipSkill, getSkillState, isSkillEquipped, meetsSkillRequirement, moveEquippedSkill, unequipSkill } from '../core/equipment';
import { skillDef } from '../core/skills';
import { bottomNav, townBar } from '../ui/chrome';
import { dragReorder } from '../ui/drag';
import { showSkillDetail } from '../ui/skilldetail';
import { skillBrief, skillNameEl } from '../ui/skillinfo';
import { tierColor } from '../ui/theme';
import { S } from '../ui/game';
import { colored } from '../ui/items';
import { button, h, row, sub } from '../ui/kit';
import { toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { navigate } from './nav';

const MAX_SLOTS = Math.max(...(B.SkillSlots as number[]));
/** n번째 슬롯(1부터)이 처음 열리는 등급. */
const unlockRank = (n: number): string => RANKS[(B.SkillSlots as number[]).findIndex((x) => x >= n)] ?? '';

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
    // 슬롯은 3×2 (스킬 장착 칸만 카드 4칸 규칙의 예외)
    const grid = h('div', { class: 'cards3' });
    // 슬롯은 처음부터 6칸: 지금 등급에서 열린 칸은 빈 슬롯, 아직 닫힌 칸은 어두운 칸에 '○ 등급에 열림'
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (i >= slots) {
        grid.append(h('div', { style: { height: '84px', border: '1px dashed var(--slot-locked)', borderRadius: '10px', background: 'var(--bg)', padding: '8px', opacity: '.55', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' } },
          h('b', { class: 'sub', style: { fontSize: '14px' } }, '잠김'), h('span', { class: 'spacer' }), sub(`${unlockRank(i + 1)} 등급에`), sub('열림')));
      } else if (i < c.Skills.Equipped.length) {
        const id = c.Skills.Equipped[i];
        const def = skillDef(id)!;
        const st = getSkillState(c, id)!;
        const cell = h('button', { class: `card-btn on${c.Skills.Equipped.length > 1 ? ' grip' : ''}`, style: { position: 'relative', height: '84px', padding: '8px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: '0' }, on: { click: () => this.detail(id) } },
          // 이름이 길면 이름만 말줄임, 강화 단계(+N)는 늘 카드 안에 보인다
          h('div', { class: 'row', style: { width: '100%', gap: '2px', minWidth: '0' } },
            h('b', { style: { color: tierColor(def.Tier), fontSize: '14px', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, def.Name),
            h('span', { style: { color: 'var(--gold)', fontSize: '12px', flexShrink: '0' } }, `+${st.Level}`)),
          h('span', { class: 'spacer' }), h('span', { class: 'sub', style: { fontSize: '12px', textAlign: 'left', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' } }, skillBrief(def, st.Level)), h('span', { class: 'sub nw', style: { fontSize: '11px' } }, `재사용 ${def.Cooldown}턴`));
        cells.push(cell);
        grid.append(cell);
      } else {
        grid.append(h('div', { style: { height: '84px', border: '1px solid var(--slot-border)', borderRadius: '10px', background: 'var(--bg)', padding: '8px' } }, sub('빈 슬롯')));
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
      h('span', null, skillNameEl(def, st.Level, 15), this.fresh!.has(id) ? colored(' NEW', 'var(--red-light)') : null),
      h('span', { class: 'sub' }, meets ? `${skillBrief(def, st.Level)} · 재사용 ${def.Cooldown}턴` : `장착 조건 Lv.${def.ReqLevel} · ${def.ReqRank} 등급`));
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

  /** 스킬 상세 창 (수련장과 같은 창) + 장착/해제. */
  private detail(id: string): void {
    showSkillDetail(id, { equip: (x) => this.equip(x), unequip: (x) => this.unequip(x) });
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

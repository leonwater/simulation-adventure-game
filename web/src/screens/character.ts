import { B } from '../core/balance';
import {
  AllocationDraft, attack, badgeBonus, damageReduction, dropBonus, equipmentBonus, evasion, eventLuckBonus, expProgress, maxHp, ownStat,
  percent, promotionStatus, resist, totalStat, weaponAttack, defense,
} from '../core/character';
import { expToNext } from '../core/balance';
import type { Stat } from '../core/enums';
import { STATS } from '../core/enums';
import { jobData } from '../core/jobs';
import { Names } from '../core/names';
import { bottomNav, jobLine, townBar } from '../ui/chrome';
import { S } from '../ui/game';
import { button, divider, h, icon, progress, row, sub } from '../ui/kit';
import { colored } from '../ui/items';
import { modal, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { statIcon, statRow } from '../ui/statrow';
import { rankIcon } from '../ui/theme';
import { navigate } from './nav';


/** 능력치가 주는 효과 (상세 능력치 창의 한 줄 설명). */
function statEffect(s: Stat): string {
  switch (s) {
    case 'Vitality': return '최대 HP 증가 (직업마다 1점당 HP가 다름)';
    case 'Spirit': return '독·기절 같은 디버프에 걸리지 않을 확률';
    case 'Luck': return '아이템 드롭률과 이벤트 판정 성공률';
    case 'Strength': return `전사의 공격력 (1점당 +${B.AttackPerMainStat})`;
    case 'Agility': return '궁수·도적의 공격력, 적 공격 회피';
    case 'Intelligence': return `마법사의 공격력 (1점당 +${B.AttackPerMainStat})`;
    case 'Toughness': return `받는 피해 감소 (1점당 ${B.ReductionPerToughness * 100}%, 최대 ${B.MaxReduction * 100}%)`;
    case 'Precision': return '공격·스킬 성공률 증가';
    case 'Finesse': return '도적의 회피 증가 (최대 40%)';
    case 'SpellPower': return '스킬 피해 증가 (1점당 +0.5%)';
  }
}

/** 캐릭터: 경험치, 배지·승급 진행, 능력치 5개(+ 버튼), 자동 배분·확정, 상세 능력치. */
export class CharacterScreen extends Screen {
  private draft: AllocationDraft | null = null;

  onBack(): boolean {
    navigate('town');
    return true;
  }

  build(): HTMLElement {
    const c = S.c;
    if (!this.draft) this.draft = new AllocationDraft(c);
    const draft = this.draft;
    const pct = Math.floor(expProgress(c) * 100);
    return h('div', { class: 'page' },
      townBar('캐릭터', '마을', () => navigate('town'), c),
      h('div', { class: 'scroll' },
        row(
          h('div', { class: 'col grow', style: { gap: '2px' } }, h('b', { style: { fontSize: '24px' } }, c.Name), jobLine(c.Job, `${jobData(c.Job).name} · Lv.${c.Level} / ${B.MaxLevel}`, 13)),
          sub(c.Level >= B.MaxLevel ? '최대 레벨' : `경험치 ${pct}%`)),
        progress(expProgress(c), 'var(--blue)'),
        c.Level < B.MaxLevel ? h('div', { class: 'sub', style: { textAlign: 'right' } }, `${c.Exp.toLocaleString('en-US')} / ${expToNext(c.Level).toLocaleString('en-US')}`) : null,
        this.badgePanel(),
        this.statsPanel(draft),
        row(
          (() => {
            const b = button('자동 배분', () => {
              draft.auto();
              router.rebuild();
            }, '', 'grow');
            b.disabled = c.UnspentPoints <= 0;
            return b;
          })(),
          (() => {
            const b = button('확정', () => this.commit(), 'primary', 'grow');
            b.disabled = !draft.hasChanges;
            return b;
          })()),
        button('상세 능력치 보기', () => this.details(), 'ghost')),
      bottomNav(1, (i) => navigate(['town', 'character', 'inventory', 'skills'][i] as never)));
  }

  private badgePanel(): HTMLElement {
    const c = S.c;
    const st = promotionStatus(c);
    const cond = (label: string, cur: number, req: number): HTMLElement =>
      h('div', { class: 'grow', style: { fontSize: '13px' } }, `${label} `, colored(`${Math.min(cur, req)}/${req}`, cur >= req ? 'var(--green)' : '#ECE7DD'));
    return h('div', { class: 'card', style: { gap: '8px', padding: '12px 14px' } },
      row(icon(rankIcon(c.Rank), 32), h('b', { class: 'grow', style: { fontSize: '15px' } }, `${c.Rank} 등급 모험가`), h('span', { class: 'gold', style: { fontSize: '13px' } }, `기본 능력치 +${Math.round(badgeBonus(c.Rank) * 100)}%`)),
      st.isMaxRank
        ? sub('최고 등급입니다')
        : h('div', { class: 'col', style: { gap: '8px' } }, sub(`${st.next} 등급 승급 조건 · 모두 채우면 자동 승급`),
          row(cond('돌파 층', st.floorCurrent, st.floorRequired), cond('레벨', st.levelCurrent, st.levelRequired), cond('퀘스트', st.questsCurrent, st.questsRequired))));
  }

  private statsPanel(draft: AllocationDraft): HTMLElement {
    const c = S.c;
    const stats = jobData(c.Job).allocatable;
    return h('div', { class: 'card', style: { padding: '6px 14px', gap: '0' } },
      row(h('b', { class: 'grow', style: { height: '40px', lineHeight: '40px' } }, '능력치'), h('span', { style: { fontSize: '13px' } }, '남은 포인트 ', colored(String(draft.remaining), 'var(--gold)'))),
      ...stats.map((stat, i) => statRow(draft, stat, i < stats.length - 1, () => router.rebuild())));
  }

  private commit(): void {
    const c = S.c;
    const before = maxHp(c);
    this.draft!.commit();
    // 체력이 오르면 늘어난 만큼 현재 HP도 채운다.
    c.CurrentHp = Math.min(maxHp(c), c.CurrentHp + Math.max(0, maxHp(c) - before));
    S.save();
    toast('능력치를 배분했습니다');
    router.rebuild();
  }

  private details(): void {
    const c = S.c;
    const m = modal('상세 능력치');
    const line = (k: string, v: string | HTMLElement): HTMLElement => row(h('div', { class: 'grow', style: { height: '30px', lineHeight: '30px' } }, k), h('div', { style: { textAlign: 'right' } }, v));
    m.body.append(
      line('최대 HP', String(maxHp(c))),
      line('공격력', h('span', null, String(attack(c)), colored(` (${Names.stat(jobData(c.Job).attackStat)} × ${B.AttackPerMainStat} + 무기 ${weaponAttack(c)})`, 'var(--sub)'))),
      line('방어력', String(defense(c))),
      line('회피', percent(evasion(c))),
      line('받는 피해 감소', percent(damageReduction(c))),
      line('디버프 저항', percent(resist(c))),
      ...(c.Job === 'Rogue' ? [line('치명타', `도적 스킬 전용 · 피해 ×${B.CritMultiplier}`)] : []),
      line('드롭률', `+${percent(dropBonus(c) - 1)}`),
      line('이벤트 판정 (행운)', `+${percent(eventLuckBonus(c))}`),
      divider(),
      h('b', null, '능력치별 효과'),
      ...STATS.map((s) => {
        const mine = jobData(c.Job).allocatable.includes(s);
        const eq = equipmentBonus(c, s);
        return h('div', { class: 'row', style: { minHeight: '48px', opacity: mine ? '1' : '.55', padding: '4px 0' } },
          icon(statIcon(s), 28),
          h('div', { class: 'col grow', style: { gap: '2px' } },
            h('b', null, `${Names.stat(s)} `, colored(`${ownStat(c, s)}${eq > 0 ? `(+${eq})` : ''}`, 'var(--gold)'), eq > 0 ? colored(` · 합계 ${totalStat(c, s)}`, 'var(--sub)') : null, colored(` · 최대 ${B.StatCap}`, 'var(--sub)')),
            h('div', { class: 'sub' }, statEffect(s) + (mine ? '' : ' · 이 직업은 배분 불가'))));
      }),
      sub(`등급 효과(+${Math.round(badgeBonus(c.Rank) * 100)}%)는 장비·버프를 제외한 캐릭터 자체 능력치에만 곱합니다.`));
  }
}

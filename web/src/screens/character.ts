import { B } from '../core/balance';
import {
  AllocationDraft, attack, badgeBonus, dropBonus, jobPerk, equipmentBonus, evasion, eventLuckBonus, expProgress, maxHp, ownStat,
  percent, promotionStatus, resist, totalStat, weaponAttack, defense,
} from '../core/character';
import type { Stat } from '../core/enums';
import { RANKS, STATS } from '../core/enums';
import { jobData, PERKS } from '../core/jobs';
import { Names } from '../core/names';
import { bottomNav, jobLine, townBar } from '../ui/chrome';
import { S } from '../ui/game';
import { perkValue, showJobInfo } from '../ui/jobinfo';
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
    case 'Vitality': return '최대 HP 증가 (직업마다 1당 HP가 다름)';
    case 'Spirit': return '독·기절 같은 디버프에 걸리지 않을 확률';
    case 'Luck': return '아이템 드롭률과 이벤트 판정 성공률';
    case 'Strength': return `전사의 공격력 (1당 +${B.AttackPerMainStat})`;
    case 'Agility': return '궁수·도적의 공격력, 적 공격 회피';
    case 'Intelligence': return `마법사의 공격력 (1당 +${B.AttackPerMainStat})`;
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
    return h('div', { class: 'page' },
      townBar('캐릭터', '마을', () => navigate('town'), c),
      h('div', { class: 'scroll fit', style: { gap: '10px' } },
        row(
          h('div', { class: 'col grow', style: { gap: '2px' } }, h('b', { class: 'display nw', style: { fontSize: '24px', overflow: 'hidden', textOverflow: 'ellipsis' } }, c.Name), jobLine(c.Job, `${jobData(c.Job).name} · Lv.${c.Level} / ${B.MaxLevel}`, 13)),
          // 경험치: 글자 바로 아래 가로 막대 (마을 머리줄과 같은 모양)
          h('div', { class: 'col', style: { width: '132px', gap: '6px', alignItems: 'stretch' } },
            h('div', { class: 'sub', style: { textAlign: 'right' } }, c.Level >= B.MaxLevel ? '최대 레벨' : `경험치 ${Math.floor(expProgress(c) * 100)}%`),
            progress(expProgress(c), 'var(--blue)'))),
        this.badgePanel(),
        this.statsPanel(draft),
        row(
          button('상세 능력치', () => this.details(), 'ghost', 'grow'),
          (() => {
            const b = button('확정', () => this.commit(), 'primary', 'grow');
            b.disabled = !draft.hasChanges;
            return b;
          })())),
      bottomNav(1, (i) => navigate(['town', 'character', 'inventory', 'skills'][i] as never)));
  }

  private badgePanel(): HTMLElement {
    const c = S.c;
    const st = promotionStatus(c);
    // 승급 조건: 이름은 작게, 값은 크게 · 채우면 초록
    const cond = (label: string, cur: number, req: number): HTMLElement => h('div', { class: `promo-cond${cur >= req ? ' done' : ''}` },
      h('span', null, label), h('b', null, `${Math.min(cur, req)}/${req}`));
    const next = st.isMaxRank ? -1 : RANKS.indexOf(st.next);
    // 등급 카드를 누르면 직업 정보 (고유 능력치의 등급별 값)
    return h('div', { class: 'card', role: 'button', style: { gap: '10px', padding: '12px 14px', cursor: 'pointer' }, on: { click: () => showJobInfo(c.Job, c.Rank) } },
      row(icon(rankIcon(c.Rank), 32), h('b', { class: 'grow', style: { fontSize: '15px' } }, `${c.Rank} 등급 모험가`), h('span', { class: 'gold', style: { fontSize: '13px' } }, `기본 능력치 +${Math.round(badgeBonus(c.Rank) * 100)}%`)),
      // 직업 고유 능력치: 아이콘 · 지금 값 → 다음 등급 값 (설명은 누르면 나오는 직업 정보에)
      row(icon(PERKS[c.Job].icon, 24), h('b', { class: 'gold', style: { fontSize: '15px' } }, perkValue(c.Job, RANKS.indexOf(c.Rank))),
        next < 0 ? null : h('span', { class: 'sub', style: { fontSize: '13px' } }, '→ '), next < 0 ? null : icon(rankIcon(st.next), 18),
        next < 0 ? null : h('span', { class: 'sub', style: { fontSize: '13px' } }, perkValue(c.Job, next))),
      st.isMaxRank
        ? sub('최고 등급입니다')
        : h('div', { class: 'col', style: { gap: '6px' } },
          row(h('b', { style: { fontSize: '14px', color: 'var(--accent)' } }, `${st.next} 등급 승급 조건`), h('span', { class: 'sub grow', style: { fontSize: '11px', textAlign: 'right' } }, '모두 채우면 자동 승급')),
          h('div', { class: 'promo-conds' }, cond('돌파 층', st.floorCurrent, st.floorRequired), cond('레벨', st.levelCurrent, st.levelRequired), cond('퀘스트', st.questsCurrent, st.questsRequired))));
  }

  private statsPanel(draft: AllocationDraft): HTMLElement {
    const c = S.c;
    const stats = jobData(c.Job).allocatable;
    return h('div', { class: 'card', style: { padding: '6px 14px', gap: '0' } },
      // 제목은 '능력치(포인트 N)', 오른쪽에 자동 배분 버튼
      row(h('b', { class: 'grow', style: { lineHeight: '40px' } }, '능력치', colored(`(포인트 ${draft.remaining})`, 'var(--gold)')),
        (() => {
          const b = button('자동 배분', () => {
            draft.auto();
            router.rebuild();
          }, 'outline', 'sm');
          b.disabled = S.c.UnspentPoints <= 0 || draft.remaining <= 0;
          return b;
        })()),
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
    // 이름은 한 줄 그대로, 긴 값만 오른쪽에서 접힌다
    const line = (ic: string, k: string, v: string | HTMLElement): HTMLElement => row(icon(ic, 18),
      h('div', { class: 'nw', style: { minHeight: '30px', lineHeight: '30px', flexShrink: '0' } }, k), h('div', { class: 'grow', style: { textAlign: 'right', minWidth: '0' } }, v));
    const atk = jobData(c.Job).attackStat;
    m.body.append(
      line(statIcon('Vitality'), '최대 HP', String(maxHp(c))),
      line(statIcon(atk), '공격력', h('span', null, String(attack(c)), colored(` (${Names.stat(atk)} × ${B.AttackPerMainStat} + 무기 ${weaponAttack(c)})`, 'var(--sub)'))),
      line('status_fortify', '방어력', String(defense(c))),
      line(statIcon('Agility'), '회피', percent(evasion(c))),
      line(PERKS[c.Job].icon, `${PERKS[c.Job].name} (모험가 등급 전용)`, PERKS[c.Job].text(percent(jobPerk(c)))),
      line(statIcon('Spirit'), '상태 이상 저항', percent(resist(c))),
      ...(c.Job === 'Rogue' ? [line('perk_vital', '치명타', `도적 스킬 전용 · 치명타 피해량 ${Math.round(B.CritMultiplier * 100)}%`)] : []),
      line(statIcon('Luck'), '드롭률', `+${percent(dropBonus(c) - 1)}`),
      line(statIcon('Luck'), '이벤트 판정', `+${percent(eventLuckBonus(c))}`),
      divider(),
      h('b', null, '능력치별 효과'),
      ...STATS.map((s) => {
        const mine = jobData(c.Job).allocatable.includes(s);
        const eq = equipmentBonus(c, s);
        return h('div', { class: 'row', style: { minHeight: '48px', opacity: mine ? '1' : '.55', padding: '4px 0' } },
          icon(statIcon(s), 28),
          h('div', { class: 'col grow', style: { gap: '2px' } },
            h('b', null, `${Names.stat(s)} `, colored(`${ownStat(c, s)}${eq > 0 ? `(+${eq})` : ''}`, 'var(--gold)'), eq > 0 ? colored(` · 합계 ${totalStat(c, s)}`, 'var(--sub)') : null, colored(` · 최대 ${B.StatCap}`, 'var(--sub)')),
            h('div', { class: 'sub' }, statEffect(s), ...(mine ? [] : [' · ', h('span', { class: 'nw' }, '이 직업은 배분 불가')]))));
      }),
      sub(`등급 효과(+${Math.round(badgeBonus(c.Rank) * 100)}%)는 장비·버프를 제외한 캐릭터 자체 능력치에만 곱합니다.`));
  }
}

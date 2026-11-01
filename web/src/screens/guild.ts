import { B } from '../core/balance';
import { badgeBonus, promotionStatus, skillSlots, storageCapacity } from '../core/character';
import { RANKS } from '../core/enums';
import type { Quest } from '../core/guild';
import {
  abandonQuest, acceptQuest, cannotAcceptReason, deposit, goalText, isQuestComplete, maxQuestRank, minQuestRank, progressText, storageFee,
  turnInQuest, withdraw,
} from '../core/guild';
import { displayName, statLine } from '../core/items';
import { npcIllustration, townBar } from '../ui/chrome';
import { S } from '../ui/game';
import { colored, itemGrid } from '../ui/items';
import { button, divider, h, icon, row, sub, tabs } from '../ui/kit';
import { confirmBox, modal, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { rankIcon } from '../ui/theme';
import { tutorial } from '../ui/tutorial';
import { navigate } from './nav';

const num = (n: number): string => n.toLocaleString('en-US');

/** 길드: 접수원 일러스트 + 대사, 탭(퀘스트·등급·창고). */
export class GuildScreen extends Screen {
  private tab = 0;
  /** 창고 탭: false = 보관(기본), true = 출고. */
  private withdrawMode = false;
  private line = '무사히 돌아오셨네요. 오늘은 어떤 일로 오셨나요?';

  onBack(): boolean {
    navigate('town');
    return true;
  }

  build(): HTMLElement {
    const c = S.c;
    // 보스를 잡아 새 층 의뢰가 붙었으면 접수원이 알려 주고 마을의 빨간 점이 꺼진다
    if (S.guildNewQuests) {
      this.line = `${S.data!.GuildNewFloor}층 의뢰가 새로 들어왔어요! 게시판을 확인해 보세요.`;
      this.tab = 0;
      S.markGuildSeen();
    }
    const line = this.tab === 2 ? `맡기실 때마다 수수료 ${storageFee(c)}G를 받아요. 찾으실 때는 무료예요. 맡긴 물건은 던전에서 쓰러져도 안전해요.` : this.line;
    return h('div', { class: 'page' },
      townBar('길드', '마을', () => navigate('town'), c),
      npcIllustration('guild_receptionist', '길드 접수원', line, 260),
      tabs(['퀘스트', '등급', '창고'], this.tab, (i) => {
        this.tab = i;
        router.rebuild();
      }),
      h('div', { class: 'scroll', 'data-anchor': this.tab === 2 ? 'guild.storage' : 'guild.list', style: { gap: '8px' } }, ...(this.tab === 0 ? this.quests() : this.tab === 1 ? this.rankTab() : this.storageTab())));
  }

  afterShow(): void {
    tutorial.onGuild(this.tab);
  }

  // ── 퀘스트 ──

  private quests(): HTMLElement[] {
    const c = S.c;
    const g = S.data!.Guild;
    return [
      row(h('div', { class: 'sub grow' }, `진행 중 ${g.Active.length}/${B.MaxActiveQuests}`), sub('수락 가능'), icon(rankIcon(minQuestRank(c.Rank)), 18), sub('~'), icon(rankIcon(maxQuestRank(c.Rank)), 18)),
      h('div', { class: 'col', style: { gap: '6px' } },
        ...g.Active.map((q) => this.questCard(q, true)),
        g.Board.length === 0 ? sub('게시판이 비었습니다. 던전에 다녀오면 새 의뢰가 붙습니다.') : null,
        ...g.Board.map((q) => this.questCard(q, false))),
    ];
  }

  private questCard(q: Quest, active: boolean): HTMLElement {
    const c = S.c;
    const done = active && isQuestComplete(q, c);
    const small = (label: string, fn: () => void, kind: '' | 'primary' | 'outline' | 'ghost', enabled = true): HTMLElement => {
      const b = button(label, (e?: unknown) => {
        void e;
        fn();
      }, kind, 'sm');
      b.style.cssText += ';width:52px;min-height:36px;padding:0;flex-shrink:0';
      b.disabled = !enabled;
      b.addEventListener('click', (ev) => ev.stopPropagation());
      return b;
    };
    const right = done ? small('보고', () => this.turnIn(q), 'primary') : active ? small('포기', () => this.abandon(q), 'ghost') : small('수락', () => this.accept(q), 'outline', cannotAcceptReason(S.data!.Guild, c, q) === null);
    return h('div', { class: 'row', role: 'button', style: { minHeight: '66px', padding: '6px 10px', borderRadius: '10px', cursor: 'pointer', background: active ? 'var(--blue-bg)' : 'var(--card)', border: `${active ? 2 : 1}px solid ${done ? 'var(--accent)' : active ? 'var(--blue)' : 'var(--card-border)'}` }, on: { click: () => this.detail(q, active) } },
      icon(rankIcon(q.Rank), 28),
      h('div', { class: 'col grow', style: { gap: '1px' } },
        h('b', null, q.Title),
        h('div', { style: { fontSize: '12px', color: done ? 'var(--gold)' : 'var(--sub)' } }, active ? `목표 ${q.TargetFloor}층 · 진행 중 ${progressText(q, c)}` : `목표 ${q.TargetFloor}층 · ${goalText(q)}`),
        h('div', { class: 'body', style: { fontSize: '12px' } }, '보상 ', colored(`${num(q.RewardGold)}G`, 'var(--gold)'), ' · ', colored(`경험치 ${num(q.RewardExp)}`, 'var(--info)'))),
      right);
  }

  /** 퀘스트를 누르면 자세한 내용 (목표·보상·진행·수락/보고/포기). */
  private detail(q: Quest, active: boolean): void {
    const c = S.c;
    const m = modal(q.Title);
    m.body.append(
      row(icon(rankIcon(q.Rank), 36), h('b', { class: 'grow' }, `${q.Rank} 등급 의뢰 · 목표 ${q.TargetFloor}층`)),
      h('div', null, '보수 ', colored(`${num(q.RewardGold)}G`, 'var(--gold)'), ` · 경험치 ${num(q.RewardExp)}`),
      sub('등급은 목표 층과 토벌 난이도(보스 > 토벌 > 채집)로 정해지고, 보수는 그 등급 범위에서 정해집니다.'),
      h('div', { class: 'body' }, active ? progressText(q, c) : `목표 ${goalText(q)}`));
    if (active) {
      const report = button('보고', () => {
        m.close();
        this.turnIn(q);
      }, 'primary', 'grow');
      report.disabled = !isQuestComplete(q, c);
      m.body.append(row(button('포기', () => {
        m.close();
        this.abandon(q);
      }, 'ghost', 'grow'), report));
      return;
    }
    const reason = cannotAcceptReason(S.data!.Guild, c, q);
    if (reason) m.body.append(h('div', { style: { color: 'var(--red-light)', fontSize: '13px' } }, reason));
    const accept = button('수락', () => {
      m.close();
      this.accept(q);
    }, 'primary');
    accept.disabled = reason !== null;
    m.body.append(accept);
  }

  private accept(q: Quest): void {
    const r = acceptQuest(S.data!.Guild, S.c, q.Id);
    if (!r.ok) return toast(r.error ?? '');
    this.line = `"${q.Title}" 의뢰를 맡기셨습니다. 무리하지 마세요.`;
    S.save();
    router.rebuild();
  }

  private abandon(q: Quest): void {
    confirmBox('의뢰 포기', `"${q.Title}" 의뢰를 포기할까요? 진행도는 사라집니다.`, '포기', () => {
      abandonQuest(S.data!.Guild, q.Id);
      S.save();
      router.rebuild();
    });
  }

  private turnIn(q: Quest): void {
    const c = S.c;
    const before = c.Level;
    const r = turnInQuest(S.data!.Guild, c, q.Id);
    if (!r.ok) return toast(r.error ?? '');
    this.line = `수고하셨어요! 보수 ${num(q.RewardGold)}G와 경험치 ${num(q.RewardExp)}을 드릴게요.`;
    if (r.levelsGained > 0) toast(`레벨 업! Lv.${before} → Lv.${c.Level}`);
    S.save();
    router.rebuild();
  }

  // ── 등급 ──

  private rankTab(): HTMLElement[] {
    const c = S.c;
    const st = promotionStatus(c);
    const cond = (label: string, cur: number, req: number, met: boolean): HTMLElement =>
      row(h('div', { class: 'grow' }, label), h('span', { style: { color: met ? 'var(--green)' : 'var(--sub)', fontWeight: met ? '700' : '400' } }, `${Math.min(cur, req)} / ${req}`));
    const card = h('div', { class: 'card', style: { gap: '8px', padding: '12px 14px' } },
      row(icon(rankIcon(c.Rank), 48), h('div', { class: 'col grow', style: { gap: '2px' } },
        h('b', { style: { fontSize: '17px' } }, `${c.Rank} 등급 모험가`),
        h('div', { class: 'gold', style: { fontSize: '13px' } }, `기본 능력치 +${Math.round(badgeBonus(c.Rank) * 100)}% · 스킬 ${skillSlots(c.Rank)}칸 · 창고 ${storageCapacity(c.Rank)}칸`))));
    if (!st.isMaxRank) {
      card.append(divider(),
        row(icon(rankIcon(st.next), 24), h('b', null, `${st.next} 등급 승급 조건 (등급 효과 +${Math.round(badgeBonus(st.next) * 100)}%)`)),
        cond('돌파 층', st.floorCurrent, st.floorRequired, st.floorMet),
        cond('레벨', st.levelCurrent, st.levelRequired, st.levelMet),
        cond('퀘스트 완료', st.questsCurrent, st.questsRequired, st.questsMet),
        sub('세 조건을 모두 채우면 자동으로 승급합니다.'));
    } else card.append(h('div', { class: 'gold' }, '최고 등급에 도달했습니다.'));
    // 등급표: 열 머리글(스킬 · 창고 · 능력치)과 숫자만. 지금 등급은 금색 글자로만 표시한다
    const COLS = ['58px', '58px', '64px'];
    const cell = (text: string, w: string, color: string, bold = false): HTMLElement => h('div', { style: { width: w, textAlign: 'center', flexShrink: '0', color, fontWeight: bold ? '700' : '400', fontSize: '15px' } }, text);
    const table = h('div', { class: 'card', style: { gap: '0', padding: '14px 14px 6px' } },
      h('b', { style: { fontSize: '16px', marginBottom: '8px' } }, '모험가 등급표'),
      h('div', { class: 'row', style: { gap: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--line-soft)', fontSize: '12px', color: 'var(--sub)' } },
        h('div', { class: 'grow' }, '등급'), cell('스킬', COLS[0], 'var(--sub)'), cell('창고', COLS[1], 'var(--sub)'), cell('능력치', COLS[2], 'var(--sub)')),
      ...RANKS.map((rank, r) => {
        const color = c.Rank === rank ? 'var(--gold)' : 'var(--body)';
        return h('div', { class: 'row', style: { minHeight: '52px', gap: '8px', padding: '4px 0', borderBottom: r < RANKS.length - 1 ? '1px solid var(--line-soft)' : '' } },
          h('div', { class: 'row grow', style: { gap: '10px' } }, icon(rankIcon(rank), 36), h('b', { style: { fontSize: '16px', color: c.Rank === rank ? 'var(--gold)' : 'var(--text)' } }, `${rank} 등급`)),
          cell(`${skillSlots(rank)}`, COLS[0], color), cell(`${storageCapacity(rank)}`, COLS[1], color), cell(`+${Math.round(B.BadgeBonus[r] * 100)}%`, COLS[2], color, true));
      }));
    return [card, table];
  }

  // ── 창고: 보관(가방 → 창고, 수수료) / 출고(창고 → 가방, 무료) ──

  private storageTab(): HTMLElement[] {
    const c = S.c;
    const fee = this.withdrawMode ? 0 : storageFee(c);
    const seg = row(...['보관', '출고'].map((l, i) => button(l, () => {
      this.withdrawMode = i === 1;
      router.rebuild();
    }, (i === 1) === this.withdrawMode ? 'primary' : 'ghost', 'grow')));
    const from = this.withdrawMode ? c.Storage : c.Inventory;
    const verb = this.withdrawMode ? '찾기' : `맡기기 · ${fee}G`;
    return [
      seg,
      h('b', null, `창고 ${c.Storage.Items.length} / ${c.Storage.Capacity} · 가방 ${c.Inventory.Items.length} / ${c.Inventory.Capacity}`),
      itemGrid(from, c, (item) => confirmBox(displayName(item), statLine(item), verb, () => {
        const r = this.withdrawMode ? withdraw(c, item.Uid) : deposit(c, item.Uid);
        if (!r.ok) return toast(r.error ?? '');
        S.save();
        toast(`${displayName(item)}${this.withdrawMode ? ' 찾음' : ` 맡김 · 수수료 ${fee}G`}`);
        router.rebuild();
      }, '닫기'), { showEmpty: false }),
    ];
  }
}

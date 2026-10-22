import { dungeonHeader } from '../ui/chrome';
import type { EventDef } from '../core/events';
import { breakdown, checkStat, choiceHint, choiceLabel, eventBody, specialHint, startsBattle, successChance, unavailableReason, visibleChoices } from '../core/eventrules';
import type { EventChoice } from '../core/events';
import type { EventResult } from '../core/eventrules';
import { describeLoot, lootIsEmpty } from '../core/loot';
import { S } from '../ui/game';
import { button, h, longPress } from '../ui/kit';
import { modal } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { goDungeon, goResult, goToCurrent } from './index';

/** 그냥 지나가는 선택지: 판정·보상·효과가 하나도 없다. */
function isPass(ch: EventChoice): boolean {
  const o = ch.Success;
  return !ch.Failure && o.HpRatio === 0 && o.Reward === 'None' && o.GoldMult === 0 && o.ExpMult === 0 && !o.ReturnToTown && o.Battle === 'None'
    && o.Effects.length === 0 && o.Reveal === 'None' && !o.SpawnTreasure && !o.LinkBoss && !o.FindReturn && !o.Chain && !o.BecomeMerchant
    && !ch.RequiresItem && ch.GoldPerFloor === 0 && ch.RequiresGoldMult === 0;
}

/** 특수 이벤트: 제목, 상황 텍스트, 선택지(조건·성공 확률) → 결과. */
export class EventScreen extends Screen {
  private event: EventDef | null = null;
  private result: EventResult | null = null;
  private floor = 0;

  onBack(): boolean {
    return true; // 이벤트는 선택으로만 끝난다
  }

  build(): HTMLElement {
    if (!this.event) this.event = S.pendingEvent;
    const ev = this.event;
    if (!ev) {
      queueMicrotask(goToCurrent);
      return h('div');
    }
    if (this.floor === 0) this.floor = S.run?.Floor ?? 1; // 귀환 결과 뒤에도 층 표시 유지
    const floor = this.floor;
    const c = S.c;
    const run = S.run;
    const inner = h('div', { class: 'col', style: { gap: '14px' } },
      h('div', { style: { fontSize: '24px' } }, ev.Title),
      h('div', { class: 'body', style: { fontSize: '15px', lineHeight: '1.5', whiteSpace: 'pre-line' } }, eventBody(ev, run, c)));
    if (this.result) {
      inner.append(this.resultBox());
      // 보물 더미·피의 우물: 같은 이벤트에서 다시 고른다
      if (!this.result.Continues || S.pendingEvent !== ev) return this.wrap(floor, inner);
    }
    for (const i of visibleChoices(ev, c, run)) {
      const ch = ev.Choices[i];
      const unavailable = run ? unavailableReason(ev, i, run, c) : null;
      const special = specialHint(ev, i, run, c);
      const hint = unavailable ?? special ?? choiceHint(ch, c, floor);
      // 판정이 없는 선택지(특별한 이벤트 포함)는 확률 대신 ›
      const always = ev.Special !== 'None' || (checkStat(ch, c) === null && ch.FixedChance >= 1);
      const right = always ? '›' : `${Math.round(successChance(ch, c, floor) * 100)}%`;
      const label = choiceLabel(ev, i, run, c);
      // 행동하는 선택지는 보라색, 아무 일 없이 지나가는 선택지는 기본 색
      const pass = always && ev.Special === 'None' && isPass(ch);
      const b = h('button', {
        class: 'choice', style: { flexDirection: 'row', alignItems: 'center', minHeight: '60px', background: pass ? 'var(--btn)' : 'var(--action-bg)', borderColor: pass ? 'var(--btn-border)' : 'var(--action-border)', opacity: unavailable ? '.45' : '1' },
      },
      h('div', { class: 'col grow', style: { gap: '2px', alignItems: 'flex-start' } }, h('span', { class: 't', style: { color: pass ? 'var(--text)' : 'var(--action-text)' } }, label), hint ? h('span', { class: 's', style: { color: pass ? 'var(--sub)' : 'var(--action-sub)' } }, hint) : null),
      h('span', { style: { fontSize: always ? '13px' : '14px', fontWeight: always ? '400' : '700', color: always ? (pass ? 'var(--sub)' : 'var(--action-sub)') : 'var(--gold)' } }, right));
      longPress(b, () => {
        const m = modal(label);
        m.body.append(h('div', { class: 'body', style: { whiteSpace: 'pre-line', lineHeight: '1.4' } }, (special ?? breakdown(ch, c, floor)) + (unavailable ? `\n\n${unavailable}` : '')));
      }, () => {
        if (!unavailable) this.choose(i);
      });
      inner.append(b);
    }
    return this.wrap(floor, inner);
  }

  private wrap(floor: number, inner: HTMLElement): HTMLElement {
    return h('div', { class: 'page' }, S.hasGame ? dungeonHeader(`${floor}층 · 특수 이벤트`, S.c, null) : null, h('div', { class: 'scroll', style: { padding: '16px' } }, inner));
  }

  private resultBox(): HTMLElement {
    const r = this.result!;
    const c = S.c;
    const good = r.Success;
    const card = h('div', { class: 'card', style: { background: good ? 'var(--accent-bg)' : 'var(--red-bg)', borderColor: good ? 'var(--accent)' : 'var(--red-border)', gap: '6px', padding: '12px 14px' } },
      h('div', { style: { fontSize: '15px', whiteSpace: 'pre-line', lineHeight: '1.4' } }, r.Text));
    if (r.HpChange !== 0) card.append(h('div', { style: { color: r.HpChange > 0 ? 'var(--green)' : 'var(--red-light)' } }, `HP ${r.HpChange > 0 ? '+' : ''}${r.HpChange}`));
    if (!lootIsEmpty(r.Loot) || r.Loot.Dropped.length > 0) card.append(h('div', { class: 'gold' }, describeLoot(r.Loot)));
    if (r.Loot.LevelsGained > 0 && S.hasGame) card.append(h('b', { class: 'gold' }, `레벨 업! Lv.${c.Level}`));
    if (r.Continues && S.pendingEvent === this.event) return card;
    const died = !!S.lastDeath && !S.inDungeon;
    const label = died ? '결과 보기' : startsBattle(r) ? '전투 시작' : r.ReturnToTown ? '마을로' : '계속';
    return h('div', { class: 'col', style: { gap: '14px' } }, card, button(label, () => this.next(), 'primary', 'lg'));
  }

  private choose(index: number): void {
    this.result = S.chooseEvent(index);
    router.rebuild();
  }

  private next(): void {
    const r = this.result!;
    if (S.lastDeath && !S.inDungeon) {
      // 미믹 기습에 쓰러진 경우
      return goResult(S.lastDeath.HardcoreReset ? 'Hardcore' : 'Death');
    }
    if (r.ReturnToTown) return goResult('Return');
    if (!S.battle && S.inDungeon && r.Loot.LevelsGained > 0) return goDungeon(true);
    goToCurrent();
  }
}

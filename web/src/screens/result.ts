import { B } from '../core/balance';
import { maxChallengeFloor } from '../core/character';
import { isQuestComplete } from '../core/guild';
import { jobData } from '../core/jobs';
import { josa } from '../core/names';
import { jobLine } from '../ui/chrome';
import { S } from '../ui/game';
import { colored } from '../ui/items';
import { button, h, row, sub } from '../ui/kit';
import { Screen } from '../ui/router';
import { tutorial } from '../ui/tutorial';
import { goTitle, goTown, goToCurrent } from './index';

export type ResultKind = 'Death' | 'Hardcore' | 'Return' | 'Clear';
const num = (n: number): string => n.toLocaleString('en-US');

const heading = (title: string, color: string, subText: string): HTMLElement =>
  h('div', { class: 'col', style: { gap: '6px', alignItems: 'center' } }, h('div', { style: { fontSize: '32px', color } }, title), h('div', { class: 'sub', style: { fontSize: '14px' } }, subText));

/** "고블린 궁수에게 패배" / "독으로 쓰러짐" */
function cause(killedBy: string | undefined): string {
  if (!killedBy) return '쓰러짐';
  if (killedBy === '독' || killedBy === '화상' || killedBy === '출혈') return `${josa(killedBy, '으로/로')} 쓰러짐`;
  return `${killedBy}에게 패배`;
}

function panel(title: string, titleColor: string, fill: string, border: string): HTMLElement {
  return h('div', { class: 'card', style: { background: fill, borderColor: border, gap: '0', padding: '6px 14px' } },
    h('b', { style: { fontSize: '13px', color: titleColor, height: '32px', lineHeight: '32px' } }, title));
}
const line = (label: string, value: string, last = false): HTMLElement =>
  h('div', { class: 'row', style: { minHeight: '44px', borderBottom: last ? '' : '1px solid var(--line-soft)' } }, h('div', { class: 'grow' }, label), h('span', null, value));

function change(delta: number, unit = ''): HTMLElement {
  if (delta === 0) return colored('-', 'var(--sub)');
  return delta > 0 ? colored(`+${num(delta)}${unit}`, 'var(--green)') : colored(`-${num(-delta)}${unit}`, '#E38A82');
}

function tableRow(a: string, b: string | HTMLElement, c: string | HTMLElement, d: string | HTMLElement, head = false, last = false): HTMLElement {
  const cell = (v: string | HTMLElement, w: number, right: boolean): HTMLElement => h('div', { style: { width: `${w}px`, textAlign: right ? 'right' : 'left', flexShrink: '0' } }, v);
  return h('div', { class: 'row', style: { gap: '6px', minHeight: head ? '34px' : '42px', fontSize: head ? '12px' : '13px', color: head ? 'var(--sub)' : 'var(--text)', fontWeight: head ? '700' : '400', borderBottom: last ? '' : `1px solid ${head ? 'var(--line)' : 'var(--line-soft)'}` } },
    cell(a, 86, false), cell(b, 76, true), cell(c, 76, true), cell(d, 76, true));
}

/** 정산: 패배(이전·현재·변화 표), 귀환(획득, N층 클리어), 하드코어 초기화, 게임 클리어 엔딩. */
export class ResultScreen extends Screen {
  constructor(private readonly kind: ResultKind) {
    super();
  }

  onBack(): boolean {
    this.next();
    return true;
  }

  build(): HTMLElement {
    const body = h('div', { class: 'scroll', style: { gap: '18px', padding: '48px 16px 24px' } });
    switch (this.kind) {
      case 'Death': this.death(body); break;
      case 'Hardcore': this.hardcore(body); break;
      case 'Clear': this.clear(body); break;
      default: this.returned(body);
    }
    const nextBtn = button(this.kind === 'Hardcore' ? '처음으로' : '마을로 돌아가기', () => this.next(), 'primary', 'lg');
    nextBtn.dataset.anchor = 'result.next';
    body.append(h('div', { class: 'spacer' }), nextBtn);
    return h('div', { class: 'page' }, body);
  }

  afterShow(): void {
    tutorial.onResult();
  }

  /** 패배: 항목 · 이전 · 현재 · 변화를 한 표로. */
  private death(body: HTMLElement): void {
    const d = S.lastDeath;
    if (!d) {
      body.append(heading('패배', '#E38A82', ''));
      return;
    }
    body.append(heading('패배', '#E38A82', `${d.Floor}층 · ${cause(d.KilledBy)}`));
    const expBefore = Math.floor(d.ExpPctBefore * 100), expAfter = Math.floor(d.ExpPctAfter * 100);
    body.append(h('div', { class: 'card', 'data-anchor': 'result.panel', style: { gap: '0', padding: '6px 12px' } },
      tableRow('항목', '이전', '현재', '변화', true),
      tableRow('골드', num(d.GoldBefore), num(d.GoldAfter), change(-d.GoldLost)),
      tableRow('경험치', `${expBefore}%`, `${expAfter}%`, change(expAfter - expBefore, '%p')),
      tableRow('가방 아이템', `${d.BagBefore}개`, `${d.BagAfter}개`, change(d.BagAfter - d.BagBefore, '개')),
      tableRow(`${d.Floor}층 진행`, `${d.RoomsExplored}/${d.RoomsTotal}방`, '초기화', colored('초기화', '#E38A82')),
      tableRow('장착 장비', `${d.EquippedKept}개`, `${d.EquippedKept}개`, colored('유지', 'var(--green)')),
      tableRow('길드 창고', `${d.StorageCount}개`, `${d.StorageCount}개`, colored('유지', 'var(--green)'), false, true)));
  }

  private hardcore(body: HTMLElement): void {
    const d = S.lastDeath;
    body.append(heading('모험이 끝났다', '#E38A82', `${d?.Floor ?? 0}층 · ${cause(d?.KilledBy)}`));
    const card = panel('하드코어', '#E38A82', 'var(--red-bg)', 'var(--red-border)');
    card.append(h('div', { style: { padding: '6px 0 14px' } }, '하드코어 난이도에서는 쓰러지면 캐릭터가 초기화됩니다. 새로운 모험가로 다시 도전하세요.'));
    body.append(card);
  }

  private returned(body: HTMLElement): void {
    const r = S.lastReturn;
    const c = S.c;
    if (!r) {
      body.append(heading('귀환', 'var(--blue-light)', ''));
      return;
    }
    // 보스를 잡았으면 "N층 클리어", 아니면 "N층 귀환"
    body.append(heading(`${r.Floor}층 ${r.BossCleared ? '클리어' : '귀환'}`, r.BossCleared ? 'var(--gold)' : 'var(--blue-light)', `탐험한 방 ${r.Rooms}개`));
    const got = panel('획득', 'var(--gold)', 'var(--card)', 'var(--card-border)');
    got.dataset.anchor = 'result.panel';
    got.append(line('골드', `+${num(r.GoldEarned)} G`), line('경험치', `+${num(r.ExpEarned)}`),
      h('div', { class: 'col', style: { gap: '4px', padding: '0 0 8px' } }, h('div', null, `아이템 ${r.Loot.length}개`),
        r.Loot.length > 0 ? sub(r.Loot.slice(0, 6).join(', ') + (r.Loot.length > 6 ? ` 외 ${r.Loot.length - 6}개` : '')) : null));
    const state = panel('진행', 'var(--blue-light)', 'var(--card)', 'var(--card-border)');
    state.append(line(`${r.Floor}층 보스`, r.BossCleared ? '처치' : '미처치 · 진행 초기화'), line('다음 도전', `${maxChallengeFloor(c)}층`, true));
    body.append(got, state);
    const done = S.data!.Guild.Active.filter((q) => isQuestComplete(q, c)).length;
    if (done > 0) body.append(h('div', { class: 'gold center' }, `완료한 퀘스트 ${done}개 — 길드에 보고하세요`));
  }

  private clear(body: HTMLElement): void {
    const c = S.c;
    body.append(heading('게임 클리어', 'var(--gold)', `${B.MaxFloor}층 · 드래곤 처치`));
    const card = panel('기록', 'var(--gold)', 'var(--accent-bg)', 'var(--accent)');
    const sec = S.data!.PlaySeconds;
    card.append(h('div', { style: { fontSize: '15px', lineHeight: '1.5', padding: '0 0 10px' } }, `${josa(c.Name, '은/는')} 마침내 던전 최하층의 주인을 쓰러뜨렸다. 라브 마을의 사람들은 오래도록 그 이름을 이야기할 것이다.`),
      row(h('div', { class: 'grow', style: { minHeight: '44px', lineHeight: '44px' } }, '직업 · 레벨'), jobLine(c.Job, `${jobData(c.Job).name} Lv.${c.Level}`, 14, 'var(--text)')),
      line('모험가 등급', `${c.Rank} 등급`), line('완료한 퀘스트', `${c.QuestsCompleted}개`), line('플레이 시간', `${Math.floor(sec / 3600)}시간 ${Math.floor(sec / 60) % 60}분`, true));
    body.append(card, sub('계속 플레이하며 장비와 등급을 더 키울 수 있습니다.'));
  }

  private next(): void {
    if (this.kind === 'Hardcore' || !S.hasGame) return goTitle();
    // 엔딩 화면은 던전 안(보스 방)에서 열린다
    if (S.inDungeon) return goToCurrent();
    goTown();
  }
}

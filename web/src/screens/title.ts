import { jobData } from '../core/jobs';
import { Names, gold } from '../core/names';
import { jobLine } from '../ui/chrome';
import { S } from '../ui/game';
import { assetUrl, button, col, h, row, sub } from '../ui/kit';
import { confirmBox, modal, toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { openSettings } from '../ui/settings-panel';
import { settings } from '../ui/settings';
import { goToCurrent } from './index';
import { RegistrationScreen } from './register';

/** 시작 화면: 로고 + 시작하기 · 이어하기(요약 카드) · 설정. */
export class TitleScreen extends Screen {
  build(): HTMLElement {
    const hasSave = S.hasSave;
    const cont = button('이어하기', () => this.summary(), 'outline', 'lg');
    cont.disabled = !hasSave;
    return h('div', { class: 'page', style: { padding: '32px 24px', justifyContent: 'center', gap: '12px', position: 'relative' } },
      h('div', { class: 'title-bg', style: { backgroundImage: `url(${assetUrl('illustrations/title_bg.webp')})` } }),
      h('div', { class: 'spacer', style: { flex: '1.2' } }),
      col(
        h('div', { style: { color: 'var(--accent)', fontSize: '14px', textAlign: 'center' } }, '─  ◆  ─'),
        h('div', { style: { color: 'var(--gold)', fontSize: '40px', textAlign: 'center', fontWeight: '700' } }, '모험가 키우기'),
      ),
      h('div', { class: 'spacer' }),
      col(
        button('시작하기', () => this.startNew(), 'primary', 'lg'),
        cont,
        button('설정', () => openSettings(true), 'ghost'),
        hasSave ? null : h('div', { class: 'sub center' }, '저장된 모험가가 없습니다'),
      ),
    );
  }

  private startNew(): void {
    if (S.hasSave) {
      confirmBox('새 모험', '저장된 모험가가 있습니다. 새로 시작하면 이전 기록은 지워집니다.', '새로 시작', () => router.show(new PrologueScreen()));
      return;
    }
    router.show(new PrologueScreen());
  }

  /** 이어하기 요약 카드 (이름·직업·레벨 / 등급·난이도 / 층·골드 / 플레이 시간·마지막 저장). */
  private summary(): void {
    const data = S.peekSave();
    if (!data) {
      toast('저장 파일을 불러오지 못했습니다');
      router.rebuild();
      return;
    }
    const c = data.Character;
    const m = modal('이어하기');
    const pair = (k1: string, v1: string, k2: string, v2: string): HTMLElement =>
      h('div', { class: 'row', style: { padding: '4px 0', alignItems: 'flex-start' } },
        h('div', { class: 'col grow', style: { gap: '4px' } }, sub(k1), h('b', null, v1)),
        h('div', { class: 'col grow', style: { gap: '4px' } }, sub(k2), h('b', null, v2)));
    const floor = data.Run ? `${data.Run.Floor}층 탐험 중` : `${c.HighestFloorCleared}층 돌파`;
    const sec = data.PlaySeconds;
    const saved = data.SavedAtTicks > 0 ? new Date(data.SavedAtTicks / 10000 - 62135596800000).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-';
    m.body.append(
      h('div', { class: 'card', style: { gap: '14px', padding: '16px 18px', background: 'var(--bg)' } },
        h('b', { style: { fontSize: '20px' } }, c.Name),
        jobLine(c.Job, `${jobData(c.Job).name} · Lv.${c.Level}`, 13),
        h('div', { class: 'divider' }),
        pair('등급', `${c.Rank} 등급`, '난이도', Names.difficulty(data.Difficulty)),
        pair('층', floor, '골드', gold(c.Gold)),
        pair('플레이', `${Math.floor(sec / 3600)}시간 ${Math.floor(sec / 60) % 60}분`, '마지막 저장', saved)),
      row(button('취소', m.close, 'ghost', 'grow'), button('이어하기', () => {
        m.close();
        if (!S.continueGame()) {
          toast('저장 파일을 불러오지 못했습니다');
          router.rebuild();
          return;
        }
        goToCurrent();
      }, 'primary', 'grow')));
  }
}

const STORY = '평화롭던 세상에 어느 날 갑자기 던전들이 나타났다.\n\n던전에서 쏟아져 나온 몬스터들은 사람들을 약탈하고 죽였다.\n\n소중한 사람들을 지키기 위해, 혹은 명예를 위해.\n저마다의 이유로 던전에 도전하는 이들이 나타났다.\n\n사람들은 그들을 \'모험가\'라 불렀다.';

/** 프롤로그 (던전이 나타난 세상과 모험가) → 길드 등록. 화면을 누르면 글이 한 번에 나오고, 한 번 더 누르면 넘어간다. */
export class PrologueScreen extends Screen {
  private timer = 0;
  private shown = 0;
  private textEl: HTMLElement | null = null;

  onBack(): boolean {
    this.stop();
    router.show(new TitleScreen());
    return true;
  }

  private stop(): void {
    window.clearInterval(this.timer);
  }

  build(): HTMLElement {
    this.textEl = h('div', { style: { whiteSpace: 'pre-line', lineHeight: '1.8', fontSize: '17px', color: 'var(--body)', textAlign: 'center' } });
    const done = (): boolean => this.shown >= STORY.length;
    const area = h('div', { class: 'grow center', style: { display: 'flex', cursor: 'pointer' }, on: { click: () => {
      if (!done()) {
        this.finish();
        return;
      }
      this.stop();
      router.show(new RegistrationScreen());
    } } }, this.textEl);
    this.shown = 0;
    if (settings.typewriter) {
      this.timer = window.setInterval(() => {
        this.shown = Math.min(STORY.length, this.shown + 1);
        this.textEl!.textContent = STORY.slice(0, this.shown);
        if (done()) this.stop();
      }, 1000 / 28);
    } else this.finish();
    return h('div', { class: 'page', style: { padding: '28px 28px 32px', gap: '12px' } },
      area,
      h('div', { class: 'sub center' }, '화면을 누르면 넘어갑니다'),
      button('건너뛰기', () => {
        this.stop();
        router.show(new RegistrationScreen());
      }, 'ghost'));
  }

  private finish(): void {
    this.stop();
    this.shown = STORY.length;
    if (this.textEl) this.textEl.textContent = STORY;
  }
}

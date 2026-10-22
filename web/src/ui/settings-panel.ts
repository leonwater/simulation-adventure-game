import { B } from '../core/balance';
import { jobData } from '../core/jobs';
import { Names } from '../core/names';
import { S } from './game';
import { button, h, row } from './kit';
import { jobLine } from './chrome';
import { confirmBox, modal, toast } from './overlay';
import { router } from './router';
import { TEXT_SIZE_NAMES, settings } from './settings';

/** 모드: 시작 화면에서는 모험 정보와 아래 버튼을 보이지 않는다. 화면 이동은 goto()가 맡는다. */
export function openSettings(fromTitle = false): void {
  const m = modal('설정');
  const reopen = (): void => {
    m.close();
    router.rebuild();
    openSettings(fromTitle);
  };
  const choice = (label: string, options: string[], active: number, onSelect: (i: number) => void, line = true): HTMLElement =>
    h('div', { class: 'row', style: { minHeight: '52px', borderBottom: line ? '1px solid var(--line-soft)' : '' } },
      h('div', { class: 'grow' }, label),
      ...options.map((o, i) => button(o, () => {
        onSelect(i);
        reopen();
      }, i === active ? 'primary' : 'ghost', 'sm')));
  m.body.append(h('div', { class: 'card', style: { padding: '6px 12px', gap: '0' } },
    choice('전투 속도', ['1×', '2×'], settings.battleSpeed - 1, (i) => (settings.battleSpeed = i + 1)),
    choice('대사 한 글자씩', ['끄기', '켜기'], settings.typewriter ? 1 : 0, (i) => (settings.typewriter = i === 1)),
    choice('진동', ['끄기', '켜기'], settings.vibration ? 1 : 0, (i) => (settings.vibration = i === 1)),
    choice('글자 크기', TEXT_SIZE_NAMES, settings.textSize, (i) => (settings.textSize = i), false)));
  if (!fromTitle && S.hasGame) {
    const c = S.c;
    const line = (k: string, v: string): HTMLElement => row(h('div', { class: 'sub grow' }, k), h('span', null, v));
    const sec = S.data!.PlaySeconds;
    m.body.append(h('div', { class: 'card', style: { gap: '6px' } },
      row(h('div', { class: 'sub grow' }, '모험가'), jobLine(c.Job, `${c.Name} · ${jobData(c.Job).name} Lv.${c.Level}`, 14, 'var(--text)')),
      line('난이도', Names.difficulty(S.difficulty)),
      line('돌파 층', `${c.HighestFloorCleared} / ${B.MaxFloor}${S.data!.GameCleared ? ' · 게임 클리어' : ''}`),
      line('완료한 퀘스트', String(c.QuestsCompleted)),
      line('플레이 시간', `${Math.floor(sec / 3600)}시간 ${Math.floor(sec / 60) % 60}분`)));
    const goto = (name: 'title' | 'town'): void => {
      m.close();
      void import('../screens').then((s) => (name === 'title' ? s.goTitle() : s.goToCurrent()));
    };
    const tut = button('튜토리얼', () => confirmBox('튜토리얼', '마을 시설 안내부터 다시 보여 드립니다.', '다시 보기', () => {
      S.restartTutorial();
      goto('town');
    }), 'ghost', 'sm grow');
    tut.disabled = S.inDungeon;
    m.body.append(
      row(
        button('타이틀로', () => {
          S.save();
          goto('title');
        }, 'ghost', 'sm grow'),
        button('저장', () => {
          S.save();
          toast('저장했습니다');
        }, '', 'sm grow')),
      row(tut, button('기록 삭제', () => confirmBox('기록 삭제', '저장된 모험가가 완전히 지워집니다. 되돌릴 수 없습니다.', '삭제', () => {
        S.deleteSave();
        goto('title');
      }, '취소', 'danger'), 'ghost', 'sm grow')));
  }
}

import { tutorial } from './tutorial';
import { S } from './game';
import { button } from './kit';
import { modal } from './overlay';
import { sub } from './kit';
import { goTitle } from '../screens';

/** 던전 일시정지 창 (던전 화면과 던전 안 가방 공통). */
export function openPauseMenu(): void {
  const m = modal('일시정지');
  m.body.append(
    sub('진행 상황은 방을 하나 끝낼 때마다 자동으로 저장됩니다.'),
    button('계속하기', m.close, 'primary'),
    button('저장하고 타이틀로', () => {
      if (tutorial.blocks('타이틀로 가기')) return;
      m.close();
      S.save();
      goTitle();
    }, 'ghost'));
}

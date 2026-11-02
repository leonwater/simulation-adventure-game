import type { Difficulty, Job } from '../core/enums';
import { DIFFICULTIES, JOBS } from '../core/enums';
import { jobData } from '../core/jobs';
import { Names, josa } from '../core/names';
import { jobLine, npcIllustration, topBar } from '../ui/chrome';
import { S } from '../ui/game';
import { button, h, phrases, row, sub } from '../ui/kit';
import { modal, toast } from '../ui/overlay';
import { difficultyTag, jobInfo } from '../ui/jobinfo';
import { Screen, router } from '../ui/router';
import { DIFFICULTY_COLOR } from '../ui/theme';
import { spriteUrl } from '../ui/sprites';
import { goTown } from './index';
import { TitleScreen } from './title';

const PITCH = ['초보자에게 추천', '일반적인 모험가에게 추천', '숙련된 모험가에게 추천', '목숨 1개로 던전 격파'];

/** 길드 등록: 접수원 대사와 함께 이름 → 직업 → 난이도 → 최종 확인. 각 단계에서 이전으로 돌아갈 수 있다. */
/** 직업 선택 칸의 장점 · 단점: 다른 직업과 비교하지 않는 그 직업만의 특색, 각각 한 줄 */
const JOB_PITCH: Record<Job, [string[], string[]]> = {
  Warrior: [['반격', '튼튼함'], ['느린 스킬']],
  Archer: [['관통 사격', '높은 명중'], ['약한 한 방']],
  Rogue: [['치명타 한 방'], ['운에 좌우']],
  Mage: [['강력한 스킬'], ['마력 관리']],
};

export class RegistrationScreen extends Screen {
  private step = 0;
  private name = '';
  /** 처음엔 아무 직업도 고르지 않은 상태 (누르면 확인 창) */
  private job: Job | null = null;
  private difficulty: Difficulty = 'Normal';

  onBack(): boolean {
    this.prev();
    return true;
  }

  private line(): string {
    switch (this.step) {
      case 0: return '어서 오세요, 모험가 길드입니다! 처음 오셨군요. 등록하실 이름을 알려 주시겠어요?';
      case 1: return `${this.name.trim()} 님이시군요. 어떤 길을 걸으실 건가요? 한 번 정하면 바꿀 수 없어요.`;
      case 2: return '던전은 위험한 곳이에요. 어느 정도의 위험을 각오하시나요?';
      default: return '이대로 등록할까요? 등록하면 바로 모험가 배지를 드릴게요.';
    }
  }

  private prev(): void {
    if (this.step === 0) {
      router.show(new TitleScreen());
      return;
    }
    this.step--;
    router.rebuild();
  }
  private next(): void {
    this.step++;
    router.rebuild();
  }

  build(): HTMLElement {
    const body = [this.nameStep, this.jobStep, this.difficultyStep, this.confirmStep][this.step].call(this) as HTMLElement;
    return h('div', { class: 'page' },
      topBar('모험가 길드', this.step === 0 ? '처음으로' : '이전', () => this.prev(), `등록 ${this.step + 1}/4`),
      // 직업 고르기는 네 칸이 한 화면에 들어가게 그림을 낮춘다
      npcIllustration('guild_receptionist', '길드 접수원', this.line(), this.step === 1 ? 200 : 290),
      body);
  }

  private nav(next: string): HTMLElement {
    return row(button('이전', () => this.prev(), 'ghost', 'grow'), button(next, () => this.next(), 'primary', 'grow'));
  }

  private nameStep(): HTMLElement {
    const input = h('input', { class: 'text', type: 'text', maxLength: 12, placeholder: '이름을 입력하세요', value: this.name, on: { input: () => (this.name = input.value) } });
    return h('div', { class: 'scroll' },
      h('b', null, '모험가 이름'), input, sub('최대 12자 · 나중에 바꿀 수 없습니다'),
      button('다음', () => {
        this.name = input.value.trim();
        if (!this.name) return toast('모험가 이름을 입력해 주세요');
        this.next();
      }, 'primary', 'lg'));
  }

  /** 직업: 누르면 확인 창 → 정하면 다음 단계 (아래 이전·다음 버튼 없음, 스크롤 없이 한 화면) */
  private jobStep(): HTMLElement {
    return h('div', { class: 'scroll fit' },
      row(h('b', { class: 'grow' }, '직업 선택'), h('span', { class: 'red', style: { fontSize: '12px' } }, '이후 변경 불가')),
      h('div', { class: 'job-grid' }, ...JOBS.map((j) => {
        const on = j === this.job;
        const [pro, con] = JOB_PITCH[j];
        return h('button', { class: `card-btn job-card ${on ? 'on' : ''}`, 'aria-pressed': String(on), on: { click: () => {
          this.job = j;
          router.rebuild();
          // 확인 창에 직업 상세 (고유 능력치·등급별 값·주요 능력치)
          const m = modal(`${josa(jobData(j).name, '으로/로')} 정할까요?`);
          m.body.append(jobInfo(j), sub('직업은 등록한 뒤에 바꿀 수 없습니다.'),
            row(button('취소', m.close, 'ghost', 'grow'), button('정하기', () => {
              m.close();
              this.next();
            }, 'primary', 'grow')));
        } } },
        difficultyTag(j),
        h('img', { class: 'job-sprite', src: spriteUrl(j.toLowerCase()) ?? '', alt: '' }),
        h('b', { style: { fontSize: '16px', color: on ? 'var(--gold)' : 'var(--text)' } }, jobData(j).name),
        h('div', { class: 'job-pc' },
          h('span', { class: 'job-pro' }, '+ ', ...phrases(pro)),
          h('span', { class: 'job-con' }, '− ', ...phrases(con))));
      })));
  }

  private difficultyStep(): HTMLElement {
    return h('div', { class: 'scroll' },
      h('b', null, '난이도'),
      ...DIFFICULTIES.map((d, i) => {
        const on = d === this.difficulty;
        return h('button', { class: `card-btn ${on ? 'on' : ''} row`, style: { height: '56px', gap: '8px' }, on: { click: () => {
          this.difficulty = d;
          router.rebuild();
        } } },
        h('b', { style: { fontSize: '16px', color: on ? 'var(--gold)' : d === 'Hardcore' ? 'var(--red-light)' : 'var(--text)' } }, Names.difficulty(d)),
        h('span', { class: 'body', style: { fontSize: '13px' } }, PITCH[i]));
      }),
      this.nav('다음'));
  }

  private confirmStep(): HTMLElement {
    const line = (k: string, v: HTMLElement | string): HTMLElement => row(h('div', { class: 'sub', style: { width: '72px' } }, k), h('div', { class: 'grow' }, v));
    return h('div', { class: 'scroll' },
      h('div', { class: 'card', style: { borderColor: 'var(--accent)', gap: '8px', padding: '16px 14px' } },
        h('b', { style: { fontSize: '22px' } }, this.name),
        line('직업', jobLine(this.job!, jobData(this.job!).name, 14, 'var(--text)')),
        line('난이도', h('span', { style: { color: DIFFICULTY_COLOR[this.difficulty] } }, Names.difficulty(this.difficulty))),
        sub('직업과 난이도는 등록 후 바꿀 수 없습니다.')),
      row(button('이전', () => this.prev(), 'ghost', 'grow'), button('등록하기', () => {
        S.newGame(this.name, this.job!, this.difficulty);
        goTown();
      }, 'primary', 'grow')));
  }
}

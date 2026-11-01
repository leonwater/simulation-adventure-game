import type { Difficulty, Job } from '../core/enums';
import { DIFFICULTIES, JOBS } from '../core/enums';
import { jobData } from '../core/jobs';
import { Names } from '../core/names';
import { jobLine, npcIllustration, topBar } from '../ui/chrome';
import { S } from '../ui/game';
import { button, h, row, sub } from '../ui/kit';
import { toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { DIFFICULTY_COLOR } from '../ui/theme';
import { spriteUrl } from '../ui/sprites';
import { goTown } from './index';
import { TitleScreen } from './title';

const PITCH = ['초보자에게 추천', '일반적인 모험가에게 추천', '숙련된 모험가에게 추천', '목숨 1개로 던전 격파'];

/** 길드 등록: 접수원 대사와 함께 이름 → 직업 → 난이도 → 최종 확인. 각 단계에서 이전으로 돌아갈 수 있다. */
/** 직업 선택 칸의 한 줄 장점 · 단점 */
const JOB_PITCH: Record<Job, [string, string]> = {
  Warrior: ['맞으면 반격 · 높은 HP', '치명타·회피 없음'],
  Archer: ['적 공격을 회피 · 빠른 재사용', '낮은 HP'],
  Rogue: ['치명타가 방어를 꿰뚫음', '낮은 HP · 운에 좌우'],
  Mage: ['가장 높은 스킬 피해', '긴 재사용 대기 · 약한 기본 공격'],
};

export class RegistrationScreen extends Screen {
  private step = 0;
  private name = '';
  private job: Job = 'Warrior';
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
      npcIllustration('guild_receptionist', '길드 접수원', this.line(), 290),
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

  private jobStep(): HTMLElement {
    return h('div', { class: 'scroll' },
      row(h('b', { class: 'grow' }, '직업 선택'), h('span', { class: 'red', style: { fontSize: '12px' } }, '이후 변경 불가')),
      h('div', { class: 'job-grid' }, ...JOBS.map((j) => {
        const on = j === this.job;
        const [pro, con] = JOB_PITCH[j];
        return h('button', { class: `card-btn job-card ${on ? 'on' : ''}`, 'aria-pressed': String(on), on: { click: () => {
          this.job = j;
          router.rebuild();
        } } },
        h('img', { class: 'job-sprite', src: spriteUrl(j.toLowerCase()) ?? '', alt: '' }),
        h('b', { style: { fontSize: '16px', color: on ? 'var(--gold)' : 'var(--text)' } }, jobData(j).name),
        h('span', { class: 'job-pro' }, `+ ${pro}`),
        h('span', { class: 'job-con' }, `− ${con}`));
      })),
      this.nav('다음'));
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
        line('직업', jobLine(this.job, jobData(this.job).name, 14, 'var(--text)')),
        line('난이도', h('span', { style: { color: DIFFICULTY_COLOR[this.difficulty] } }, Names.difficulty(this.difficulty))),
        sub('직업과 난이도는 등록 후 바꿀 수 없습니다.')),
      row(button('이전', () => this.prev(), 'ghost', 'grow'), button('등록하기', () => {
        S.newGame(this.name, this.job, this.difficulty);
        goTown();
      }, 'primary', 'grow')));
  }
}

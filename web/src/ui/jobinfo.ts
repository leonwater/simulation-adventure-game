import { B } from '../core/balance';
import { percent } from '../core/character';
import type { Job, Rank, Stat } from '../core/enums';
import { RANKS } from '../core/enums';
import { jobData, PERKS } from '../core/jobs';
import { Names } from '../core/names';
import { skillDef, startingSkill } from '../core/skills';
import type { Child } from './kit';
import { button, h, icon, phrases, row } from './kit';
import { modal } from './overlay';
import { spriteUrl } from './sprites';
import { statIcon } from './statrow';
import { rankIcon } from './theme';

/** 직업 난이도 [이름, 칸 1~3] (직업 선택 칸 · 직업 정보). */
const JOB_DIFFICULTY: Record<Job, [string, number]> = { Warrior: ['쉬움', 1], Archer: ['보통', 2], Rogue: ['보통', 2], Mage: ['어려움', 3] };

/** 난이도 표시: 파란 칸 3개 중 채운 수 + 이름 (장단점의 초록·주황과 섞이지 않게 따로 둔다). */
export function difficultyTag(job: Job): HTMLElement {
  const [name, n] = JOB_DIFFICULTY[job];
  return h('span', { class: 'diff-tag', 'aria-label': `난이도 ${name}` },
    h('span', { class: 'diff-pips', 'aria-hidden': 'true' }, ...[1, 2, 3].map((i) => h('i', { class: i <= n ? 'on' : '' }))), name);
}

/** 기본 공격 요점 (그 직업만의 것, 다른 직업과 비교하지 않는다). */
const BASIC: Record<Job, string[]> = {
  Warrior: ['양손검', '반격 때 되받아침'],
  Archer: ['활 · 주력 공격', '방어 일부 무시'],
  Rogue: ['단검', '치명타는 스킬에서'],
  Mage: ['에너지 볼', `재사용 ${B.EnergyBallCooldown}턴`],
};
/** 고유 능력치 요점 */
const PERK_SHORT: Record<Job, string> = {
  Warrior: '맞을 때 피해 절반 + 반격', Archer: '기본 공격 방어 무시', Rogue: '스킬 치명타 확률·피해 ↑', Mage: '스킬 피해 ↑',
};

/** 고유 능력치를 정확한 이름과 값으로 [[이름, 값], …] (캐릭터 등급 카드). r = 등급 순번 */
export function perkStats(job: Job, r: number): [string, string][] {
  if (job === 'Rogue') return [['치명타 확률', percent(B.JobPerk.Rogue[r])], ['치명타 피해', percent(B.JobPerk.Rogue[r] * B.RogueCritDamageRatio)]];
  return [[{ Warrior: '반격 확률', Archer: '기본 공격 관통', Mage: '스킬 피해' }[job as 'Warrior'], perkValue(job, r)]];
}

/** 고유 능력치 값 (도적은 '확률 · 피해'). r = 등급 순번 */
export const perkValue = (job: Job, r: number): string => (job === 'Rogue'
  ? `${percent(B.JobPerk.Rogue[r])} · ${percent(B.JobPerk.Rogue[r] * B.RogueCritDamageRatio)}`
  : `${job === 'Mage' ? '+' : ''}${percent(B.JobPerk[job][r])}`);

/** 직업 상세: 요점만 굵게 (줄글 없음). rank를 주면 그 등급을 금색으로. */
export function jobInfo(job: Job, rank?: Rank): HTMLElement {
  const j = jobData(job);
  const perk = PERKS[job];
  const fact = (label: string, ...value: Child[]): HTMLElement[] =>
    [h('span', { class: 'jf-label' }, label), h('b', { class: 'jf-value' }, ...value)];
  const stat = (s: Stat): HTMLElement => h('span', { class: 'nw' }, icon(statIcon(s), 16), ' ', Names.stat(s));
  const table = h('div', { class: 'perk-table' }, ...RANKS.map((r, i) => h('div', { class: `perk-cell${r === rank ? ' on' : ''}` },
    icon(rankIcon(r), 20), h('span', { class: 'nw' }, perkValue(job, i)))));
  return h('div', { class: 'col', style: { gap: '10px' } },
    row(h('img', { class: 'job-sprite', src: spriteUrl(job.toLowerCase()) ?? '', alt: '' }),
      h('div', { class: 'col grow', style: { gap: '6px' } }, h('b', { style: { fontSize: '18px' } }, j.name), difficultyTag(job))),
    h('div', { class: 'job-facts' },
      ...fact('주요 능력치', stat('Vitality'), ' · ', stat(j.attackStat)),
      ...fact('HP', `체력 1당 +${j.hpPerVitality}`),
      ...fact('기본 공격', ...phrases(BASIC[job])),
      ...(job === 'Mage' ? fact('주의', h('button', { class: 'chip-btn', on: { click: showOverload } }, icon('status_overload', 16), ' 마력 폭주 ›')) : []),
      ...fact('시작 스킬', skillDef(startingSkill(job))?.Name ?? '')),
    h('div', { class: 'job-perk' },
      row(icon(perk.icon, 24), h('b', null, perk.name), h('span', { class: 'sub grow', style: { fontSize: '12px' } }, '모험가 등급으로만 오름')),
      h('b', { style: { fontSize: '13px' } }, PERK_SHORT[job], job === 'Rogue' ? h('span', { class: 'sub', style: { fontSize: '11px', fontWeight: '400' } }, ' (확률 · 피해)') : null),
      table));
}

/** 마력 폭주 설명 창 (직업 정보의 '마력 폭주'를 누르면). */
function showOverload(): void {
  const m = modal('마력 폭주');
  m.body.append(row(icon('status_overload', 32), h('b', { class: 'grow' }, `${B.OverloadTurns}턴 동안 약해짐`)),
    h('div', { class: 'job-facts' },
      ...[['언제', '에너지 볼과 장착 스킬이 모두 재사용 대기일 때 공격'], ['주는 피해', `-${B.OverloadValue}%`], ['받는 피해', `+${B.OverloadValue}%`], ['지속', `${B.OverloadTurns}턴`]]
        .flatMap(([k, v]) => [h('span', { class: 'jf-label' }, k), h('b', { class: 'jf-value' }, v)])),
    button('닫기', m.close, 'ghost'));
}

/** 직업 정보 창 (캐릭터 화면 등급 카드). */
export function showJobInfo(job: Job, rank?: Rank): void {
  const m = modal(`${jobData(job).name} 직업 정보`);
  m.body.append(jobInfo(job, rank), button('닫기', m.close, 'ghost'));
}

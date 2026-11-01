import { B } from '../core/balance';
import { percent } from '../core/character';
import type { Job, Rank } from '../core/enums';
import { RANKS } from '../core/enums';
import { jobData, PERKS } from '../core/jobs';
import { Names } from '../core/names';
import { skillDef, startingSkill } from '../core/skills';
import { button, h, icon, phrases, row } from './kit';
import { modal } from './overlay';
import { spriteUrl } from './sprites';
import { rankIcon } from './theme';

/** 직업 난이도 (직업 선택 칸 · 직업 정보). */
export const JOB_DIFFICULTY: Record<Job, [string, string]> = {
  Warrior: ['쉬움', 'var(--green)'], Archer: ['보통', 'var(--gold)'], Rogue: ['보통', 'var(--gold)'], Mage: ['어려움', 'var(--red-light)'],
};

/** 기본 공격 설명 (그 직업만의 것, 다른 직업과 비교하지 않는다). */
const BASIC: Record<Job, string> = {
  Warrior: '양손검 기본 공격. 맞을 때 반격하면 기본 공격으로 되받아친다.',
  Archer: '활 기본 공격이 주력. 고유 능력치 관통으로 적 방어력 일부를 무시한다.',
  Rogue: '단검 기본 공격. 치명타는 스킬에서 난다.',
  Mage: `기본 공격 자리에 에너지 볼 — 무기 공격력·등급에 비례하는 단일 공격, 재사용 ${B.EnergyBallCooldown}턴. 쓸 수 있는 공격이 하나도 없으면 마력 폭주로 쏘고 ${B.OverloadTurns}턴 동안 주는 피해 -${B.OverloadValue}% · 받는 피해 +${B.OverloadValue}%.`,
};

const perkValue = (job: Job, r: number): string => (job === 'Rogue'
  ? `${percent(B.JobPerk.Rogue[r])} · ${percent(B.JobPerk.Rogue[r] * B.RogueCritDamageRatio)}`
  : `${job === 'Mage' ? '+' : ''}${percent(B.JobPerk[job][r])}`);

/** 직업 상세: 난이도 · 주요 능력치 · 기본 공격 · 고유 능력치(등급별 값) · 시작 스킬. rank를 주면 그 등급을 금색으로. */
export function jobInfo(job: Job, rank?: Rank): HTMLElement {
  const j = jobData(job);
  const perk = PERKS[job];
  const [diff, color] = JOB_DIFFICULTY[job];
  const label = (t: string): HTMLElement => h('b', { style: { fontSize: '13px', color: 'var(--sub)' } }, t);
  const table = h('div', { class: 'perk-table' }, ...RANKS.map((r, i) => h('div', { class: `perk-cell${r === rank ? ' on' : ''}` },
    icon(rankIcon(r), 20), h('span', { class: 'nw' }, perkValue(job, i)))));
  return h('div', { class: 'col', style: { gap: '10px' } },
    row(h('img', { class: 'job-sprite', src: spriteUrl(job.toLowerCase()) ?? '', alt: '' }),
      h('div', { class: 'col grow', style: { gap: '4px' } },
        h('b', { style: { fontSize: '18px' } }, j.name),
        h('span', { style: { fontSize: '13px' } }, '난이도 ', h('b', { style: { color } }, diff)),
        h('span', { class: 'sub', style: { fontSize: '12px' } }, '주요 능력치: ', ...phrases([Names.stat('Vitality'), Names.stat(j.attackStat)]), ' ', h('span', { class: 'nw' }, `(체력 1당 HP +${j.hpPerVitality})`)))),
    label('기본 공격'), h('div', { style: { fontSize: '13px', lineHeight: '1.5' } }, BASIC[job]),
    label('고유 능력치 (모험가 등급으로만 오름)'),
    row(icon(perk.icon, 24), h('div', { class: 'col grow', style: { gap: '2px' } },
      h('b', null, perk.name),
      h('span', { class: 'sub', style: { fontSize: '12px' } }, perk.about))),
    job === 'Rogue' ? h('span', { class: 'sub', style: { fontSize: '11px' } }, '등급별 값: 치명타 확률 · 치명타 피해') : null,
    table,
    label('시작 스킬'), h('span', { style: { fontSize: '13px' } }, skillDef(startingSkill(job))?.Name ?? ''));
}

/** 직업 정보 창 (캐릭터 화면 등급 카드). */
export function showJobInfo(job: Job, rank?: Rank): void {
  const m = modal(`${jobData(job).name} 직업 정보`);
  m.body.append(jobInfo(job, rank), button('닫기', m.close, 'ghost'));
}

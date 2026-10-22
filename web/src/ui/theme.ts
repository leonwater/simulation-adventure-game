import type { Difficulty, ItemGrade, Job, Rank } from '../core/enums';

export const GRADE_COLOR: Record<ItemGrade, string> = {
  Common: '#D9D5CC', Uncommon: '#6FB37A', Rare: '#6E9BD1', Epic: '#A98BD9', Legendary: '#E0873A',
};
/** 스킬 등급 색: 하급 초록 · 중급 파랑 · 상급 보라 · 최상급 주황 (장비 등급 색과 같은 계열). */
export const TIER_COLOR: Record<string, string> = { Low: GRADE_COLOR.Uncommon, Mid: GRADE_COLOR.Rare, High: GRADE_COLOR.Epic, Top: GRADE_COLOR.Legendary };
export const tierColor = (tier: string): string => TIER_COLOR[tier] ?? 'var(--text)';
export const DIFFICULTY_COLOR: Record<Difficulty, string> = { Easy: 'var(--blue)', Normal: 'var(--green)', Hard: 'var(--orange)', Hardcore: 'var(--red)' };
export const jobIcon = (job: Job): string => `job_${job.toLowerCase()}`;
export const rankIcon = (rank: Rank): string => `rank_${rank.toLowerCase()}`;

const DUNGEON = [
  { bg: '#141A21', stage: '#1A222C', line: '#5A7088', accent: '#8FB0D0' },
  { bg: '#19151F', stage: '#211B2A', line: '#7A6894', accent: '#B09CD8' },
  { bg: '#1F1613', stage: '#2A1D17', line: '#9A6A4A', accent: '#E0975E' },
];
export const dungeonTheme = (themeIndex: number) => DUNGEON[themeIndex];

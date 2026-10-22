import type { Difficulty, ItemGrade, Job, Rank } from '../core/enums';

export const GRADE_COLOR: Record<ItemGrade, string> = {
  Common: '#D9D5CC', Uncommon: '#6FB37A', Rare: '#6E9BD1', Epic: '#A98BD9', Legendary: '#E0873A',
};
export const DIFFICULTY_COLOR: Record<Difficulty, string> = { Easy: 'var(--blue)', Normal: 'var(--green)', Hard: 'var(--orange)', Hardcore: 'var(--red)' };
export const jobIcon = (job: Job): string => `job_${job.toLowerCase()}`;
export const rankIcon = (rank: Rank): string => `rank_${rank.toLowerCase()}`;

const DUNGEON = [
  { bg: '#141A21', stage: '#1A222C', line: '#5A7088', accent: '#8FB0D0' },
  { bg: '#19151F', stage: '#211B2A', line: '#7A6894', accent: '#B09CD8' },
  { bg: '#1F1613', stage: '#2A1D17', line: '#9A6A4A', accent: '#E0975E' },
];
export const dungeonTheme = (themeIndex: number) => DUNGEON[themeIndex];

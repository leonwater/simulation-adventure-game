import type { Difficulty, Job } from '../core/enums';
import { JOBS } from '../core/enums';
import { print, simulate } from './balance';

// 사용: npm run balance -- [도전 횟수=150] [시드 수=3] [난이도=Normal,Hard] [직업=모두, 예: Rogue]
const args = process.argv.slice(2);
const runs = args[0] ? parseInt(args[0], 10) : 150;
const seeds = args[1] ? parseInt(args[1], 10) : 3;
const diffs = (args[2] ? args[2].split(',') : ['Normal', 'Hard']) as Difficulty[];
const jobs = (args[3] ? args[3].split(',') : [...JOBS]) as Job[];
for (const d of diffs) print(d, runs, simulate(d, runs, seeds, jobs));

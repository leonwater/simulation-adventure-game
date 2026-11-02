import type { Difficulty, Job } from '../core/enums';
import { JOBS } from '../core/enums';
import { B } from '../core/balance';
import { print, simulate } from './balance';
import { botOptions } from './bot';

// 사용: npm run balance -- [도전 횟수=150] [시드 수=3] [난이도=Normal,Hard] [직업=모두, 예: Rogue]
const args = process.argv.slice(2);
const runs = args[0] ? parseInt(args[0], 10) : 150;
const seeds = args[1] ? parseInt(args[1], 10) : 3;
const diffs = (args[2] ? args[2].split(',') : ['Normal', 'Hard']) as Difficulty[];
const jobs = (args[3] ? args[3].split(',') : [...JOBS]) as Job[];
// STRONG=1: 남는 골드를 전부 장비·강화·수련에 쓰는 열심히 하는 플레이어 (기본은 최소 기준 봇)
const strong = !!process.env.STRONG;
botOptions.noEnhance = !!process.env.NOENH;
if (process.env.SET) Object.assign(B, JSON.parse(process.env.SET));
for (const d of diffs) print(d, runs, simulate(d, runs, seeds, jobs, strong));

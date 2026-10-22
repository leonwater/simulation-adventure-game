import { B } from '../core/balance';
import type { Difficulty, Job } from '../core/enums';
import { JOBS } from '../core/enums';
import { GameSession } from '../core/session';
import { MemorySaveStore } from '../core/save';
import type { Battle } from '../core/battle';
import { prepareInTown, step } from './bot';

// 난이도별로 봇이 몇 번 도전해 몇 층을 돌파하는지, 어디서 쓰러지는지 잰다 (C# tools/balance와 같은 출력).
// (실행 파일은 cli.ts) npm run balance -- [도전 횟수=150] [시드 수=3] [난이도=Normal,Hard] [직업=모두, 예: Rogue]

const MILESTONES = [1, 3, 5, 10, 15, 20, 25, 30];
const BAND_SIZE = 5, BAND_COUNT = 6;
const bandOf = (floor: number): number => Math.min(BAND_COUNT - 1, Math.floor(Math.max(0, floor - 1) / BAND_SIZE));
const BANDS = Array.from({ length: BAND_COUNT }, (_, i) => `${i * BAND_SIZE + 1}~${(i + 1) * BAND_SIZE}층`);
const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;

export interface Stats {
  reach: Map<number, number[]>;
  level: Map<number, number[]>;
  runs: number[]; deaths: number[]; bossFights: number[]; bossLosses: number[];
  bossHp: number[][];
  players: number; conquered: number; wiped: number;
}

function playRun(s: GameSession, st: Stats): void {
  let boss: Battle | null = null;
  let steps = 0;
  while (s.hasGame && s.inDungeon && steps++ < 600) {
    const b = s.battle;
    if (b && b.isBoss && boss !== b) {
      boss = b;
      st.bossFights[bandOf(b.floor)]++;
    }
    if (boss && boss.isOver) {
      if (boss.outcome === 'Victory') st.bossHp[bandOf(boss.floor)].push(boss.player.hpRatio);
      else if (boss.outcome === 'Defeat') st.bossLosses[bandOf(boss.floor)]++;
      boss = null;
    }
    step(s);
  }
  if (boss && boss.outcome === 'Defeat') st.bossLosses[bandOf(boss.floor)]++;
}

export function simulate(diff: Difficulty, runs: number, seeds: number, jobs: readonly Job[]): Stats {
  const st: Stats = {
    reach: new Map(MILESTONES.map((m) => [m, []])), level: new Map(MILESTONES.map((m) => [m, []])),
    runs: new Array(BAND_COUNT).fill(0), deaths: new Array(BAND_COUNT).fill(0), bossFights: new Array(BAND_COUNT).fill(0),
    bossLosses: new Array(BAND_COUNT).fill(0), bossHp: Array.from({ length: BAND_COUNT }, () => []), players: 0, conquered: 0, wiped: 0,
  };
  for (const job of jobs) {
    for (let seed = 0; seed < seeds; seed++) {
      st.players++;
      let now = Date.UTC(2026, 9, 1, 9, 0, 0);
      const s = new GameSession(new MemorySaveStore(), () => new Date(now), 1000 * seed + JOBS.indexOf(job) + 7);
      s.newGame('봇', job, diff);
      s.setTutorial('Done');
      const reached = new Set<number>();
      for (let run = 1; run <= runs && s.hasGame; run++) {
        prepareInTown(s);
        s.enterDungeon();
        const band = bandOf(s.run!.Floor);
        st.runs[band]++;
        playRun(s, st);
        if (!s.hasGame) {
          st.deaths[band]++;
          st.wiped++; // 하드코어: 캐릭터 초기화
          break;
        }
        if (s.inDungeon) s.returnToTown();
        if (s.lastDeath) st.deaths[bandOf(s.lastDeath.Floor)]++;
        for (const m of MILESTONES) {
          if (s.c.HighestFloorCleared < m || reached.has(m)) continue;
          reached.add(m);
          st.reach.get(m)!.push(run);
          st.level.get(m)!.push(s.c.Level);
        }
        now += 20 * 60000;
        if (s.c.HighestFloorCleared >= B.MaxFloor) {
          st.conquered++;
          break;
        }
      }
    }
  }
  return st;
}

export function print(diff: Difficulty, runs: number, st: Stats): void {
  console.log(`=== ${diff} · 캐릭터 ${st.players}명 · 최대 도전 ${runs}회 ===`);
  for (const m of MILESTONES) {
    const r = st.reach.get(m)!;
    const when = r.length === 0 ? '-' : `평균 ${avg(r).toFixed(1)}회째 (${Math.min(...r)}~${Math.max(...r)}) · Lv.${avg(st.level.get(m)!).toFixed(1)}`;
    console.log(`  ${String(m).padStart(2)}층 돌파 ${r.length}/${st.players} · ${when}`);
  }
  for (let i = 0; i < BAND_COUNT; i++) {
    const rate = st.runs[i] === 0 ? 0 : (100 * st.deaths[i]) / st.runs[i];
    const hp = st.bossHp[i].length === 0 ? '-' : `${Math.round(avg(st.bossHp[i]) * 100)}%`;
    console.log(`  ${BANDS[i]}: 도전 ${st.runs[i]} · 사망 ${st.deaths[i]} (${rate.toFixed(1)}%) · 보스전 ${st.bossFights[i]} (패배 ${st.bossLosses[i]}) · 보스 처치 후 남은 HP ${hp}`);
  }
  console.log(`  30층 정복 ${st.conquered}/${st.players}${st.wiped > 0 ? ` · 하드코어 초기화 ${st.wiped}` : ''}`);
}


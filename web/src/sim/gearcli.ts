import type { Difficulty, ItemGrade } from '../core/enums';
import { B } from '../core/balance';
import { clearRate, winRate } from './gear';

// SET='{"LateHpBonus":0.3,"GearBaseScale":1.2}' 처럼 밸런스 값을 덮어써 본다
if (process.env.SET) Object.assign(B, JSON.parse(process.env.SET));

// 환경변수: LV=레벨÷층(기본 1.9) TR=스킬 수련 단계(기본 5)
// 사용: npm run gear -- [층=30] [난이도=Normal,Hard] [판수=직업당 40] [무기강화들=0,5,8,10,12,15] [방어구강화=무기와 같음|숫자]
const args = process.argv.slice(2);
const floor = args[0] ? parseInt(args[0], 10) : 30;
const diffs = (args[1] ? args[1].split(',') : ['Normal', 'Hard']) as Difficulty[];
const n = args[2] ? parseInt(args[2], 10) : 40;
const ws = (args[3] ? args[3].split(',') : ['0', '5', '8', '10', '12', '15']).map(Number);
const armorFixed = args[4] !== undefined && args[4] !== 'same' ? parseInt(args[4], 10) : null;
const levelBy = process.env.LV ? parseFloat(process.env.LV) : 1.9;
const trainLevel = process.env.TR ? parseInt(process.env.TR, 10) : 5;
const grades: ItemGrade[] = ['Uncommon', 'Rare', 'Epic', 'Legendary'];
for (const d of process.env.RUN ? [] : diffs) {
  console.log(`=== ${floor}층 보스 · ${d} · 승률(%) · 행 등급 × 열 무기 강화${armorFixed == null ? '(방어구도 같은 강화)' : `(방어구 +${armorFixed})`} ===`);
  console.log('        ' + ws.map((w) => `+${w}`.padStart(6)).join(''));
  for (const g of grades) {
    const cells = ws.map((w) => String(Math.round(100 * winRate({ job: 'Warrior', floor, grade: g, weapon: w, armor: armorFixed ?? w, levelBy, trainLevel }, d, n))).padStart(6));
    console.log(g.padEnd(10) + cells.join(''));
  }
}

// FAIR=1: 층마다 "보통 모험가" 장비(층에 맞는 등급, 무기 +층÷3, 방어구 +층÷5)로 보스를 잡을 확률 (초중반이 망가지지 않았는지 확인)
if (process.env.FAIR) {
  const fairGrade = (f: number): ItemGrade => (f >= 24 ? 'Legendary' : f >= 20 ? 'Epic' : f >= 12 ? 'Rare' : 'Uncommon');
  for (const d of diffs) {
    const row = [5, 10, 15, 20, 25, 28, 30].map((f) => `${f}층 ${String(Math.round(100 * winRate({ job: 'Warrior', floor: f, grade: process.env.FAIRG ? (process.env.FAIRG as ItemGrade) : fairGrade(f), weapon: Math.floor(f / 3), armor: Math.floor(f / 5), levelBy, trainLevel }, d, n))).padStart(3)}%`);
    console.log(`${d.padEnd(8)}` + row.join('  '));
  }
}

// RUN=1: 위 표 대신 "(층-4)층부터 층까지 이어서 도전해 깨는 비율"(도전 8번 안). 방어구 강화 = 무기 ÷ 2
if (process.env.RUN) {
  for (const d of diffs) {
    console.log(`=== ${floor}층까지 클리어 비율(%) · ${d} · 도전 8번 안 · 행 등급 × 열 무기 강화(방어구 +무기÷2) ===`);
    console.log('        ' + ws.map((w) => `+${w}`.padStart(6)).join(''));
    for (const g of grades) {
      const cells = ws.map((w) => String(Math.round(100 * clearRate({ job: 'Warrior', floor, grade: g, weapon: w, armor: armorFixed ?? Math.floor(w / 2), levelBy, trainLevel }, d, n).clear)).padStart(6));
      console.log(g.padEnd(10) + cells.join(''));
    }
  }
}

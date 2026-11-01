// 무작위 클릭 점검: 새 게임(튜토리얼 끝, 골드 많이)에서 눈에 보이는 눌 수 있는 것을 무작위로 눌러 오류·멈춤·눌러도 반응 없는 화면을 찾는다.
// 실행: npm run build && node scripts/monkey.mjs [횟수=1500] [시드=1]
import { start } from './_browser.mjs';
import fs from 'node:fs';
const N = parseInt(process.argv[2] ?? '1500', 10);
const SEED = parseInt(process.argv[3] ?? '1', 10);
let seed = SEED;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const { browser, end } = await start(4180 + SEED, 110000);
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(1500);
await page.addInitScript(() => { Error.stackTraceLimit = 40; });
const errors = new Set();
page.on('pageerror', (e) => errors.add(String(e.stack ?? e).split('\n').slice(0, 10).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.add(m.text()); });
fs.mkdirSync('shots', { recursive: true });

await page.goto('http://localhost:'+(4180 + SEED)+'/?debug');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(300);
const SKIP = /타이틀|삭제|초기화|처음으로|^튜토리얼|저장하고/;
await page.getByText('시작하기', { exact: true }).first().click();
await page.getByText('건너뛰기', { exact: true }).first().click();
await page.fill('input.text', '원숭이');
for (const t of ['다음', '전사', '다음', '다음', '등록하기']) { await page.getByText(t, { exact: t === '다음' || t === '등록하기' }).first().click(); await page.waitForTimeout(150); }
await page.evaluate(() => { const S = window.__S; S.setTutorial('Done'); S.c.Gold = 80000; window.__go(); });
if (SEED >= 20) await page.evaluate((f) => { const S = window.__S; S.c.HighestFloorCleared = f - 1; S.c.Level = Math.min(60, f * 4); S.select ? 0 : 0; S.selectFloor(f); window.__go(); }, 2 + (SEED % 28));
await page.waitForTimeout(400);

const collect = () => page.evaluate(() => {
  const out = [];
  const dims = document.querySelectorAll('.layer .dim');
  const topLayer = dims.length ? dims[dims.length - 1] : null;
  const scope = topLayer ?? document.querySelector('.screen') ?? document.body;
  scope.querySelectorAll('button, [role=button], .choice, .card-btn, input').forEach((el) => {
    if (el.disabled) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
    const x = Math.min(innerWidth - 2, Math.max(2, r.left + r.width / 2)), y = Math.min(innerHeight - 2, Math.max(2, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    const ok = !!hit && (el === hit || el.contains(hit) || hit.contains(el));
    out.push({ x, y, ok, by: ok ? '' : (hit ? (hit.className || hit.tagName) + ':' + (hit.innerText || '').slice(0, 14).replace(/\n/g, ' ') : 'none'), text: (el.innerText || el.getAttribute('aria-label') || el.className || '').replace(/\s+/g, ' ').slice(0, 24), tag: el.tagName, modal: !!topLayer });
  });
  return { items: out, sig: (document.querySelector('.screen')?.innerText ?? '').slice(0, 60) + '|' + (topLayer ? (topLayer.innerText ?? '').slice(0, 40) : '') };
});

let stuck = 0, lastSig = '', covered = new Map(), screens = new Set(), history = [];
for (let i = 0; i < N; i++) {
  let info;
  try { info = await collect(); } catch { await page.waitForTimeout(200); continue; }
  screens.add(info.sig.split('\n')[0].slice(0, 12));
  for (const e of info.items) if (!e.ok && !info.sig.includes('튜토') && !e.by.startsWith('toast')) covered.set(e.text + ' ← ' + e.by, (covered.get(e.text + ' ← ' + e.by) ?? 0) + 1);
  const cands = info.items.filter((e) => e.ok && !SKIP.test(e.text) && e.tag !== 'INPUT');
  if (!cands.length) { await page.mouse.wheel(0, 600); await page.keyboard.press('Escape'); stuck++; await page.waitForTimeout(300); if (stuck > 8) { await page.screenshot({ path: 'shots/monkey-stuck.png' }); console.error('누를 곳이 없음:', info.sig); errors.add('누를 곳 없음 ' + info.sig); break; } continue; }
  const st = await page.evaluate(() => { const S = window.__S; return { dun: S.inDungeon, bat: !!S.battle, hp: S.c?.CurrentHp }; }).catch(() => ({}));
  // 던전·전투에서는 진행되도록 새 방·선택지를 더 자주 누른다
  const weighted = cands.flatMap((e) => (/↑|↓|←|→|공격|보스|계속|확인|마을로/.test(e.text) ? [e, e, e] : [e]));
  const pick = weighted[Math.floor(rnd() * weighted.length)];
  history.push(`${pick.text}`);
  if (history.length > 12) history.shift();
  await page.mouse.click(pick.x, pick.y);
  await page.waitForTimeout(pick.text.includes('공격') || st.bat ? 260 : 90);
  if (info.sig === lastSig) stuck++; else stuck = 0;
  lastSig = info.sig;
  // 설정 창처럼 눌러도 글자가 안 바뀌는 팝업에서 오래 머물면 × 로 닫는다 (멈춤 오탐 방지)
  if (stuck === 30) { const x = page.locator('.layer .modal-x').last(); if (await x.count()) { await x.click().catch(() => {}); stuck = 0; continue; } }
  if (stuck > 60) { await page.screenshot({ path: 'shots/monkey-stuck.png' }); errors.add('같은 화면 60번 반응 없음: ' + info.sig + ' / 최근: ' + history.join(' > ')); break; }
  if (i % 300 === 299) console.log(`· ${i + 1}회 화면 ${screens.size}종`, JSON.stringify(st));
  if (errors.size) { await page.screenshot({ path: 'shots/monkey-error.png' }); console.error('최근 클릭:', history.join(' > ')); break; }
}
console.log('눌렀을 때 다른 것에 가려진 요소(상위 8):', [...covered.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}×${v}`).join(', '));
console.log('거친 화면:', [...screens].join(' / '));
if (errors.size) { console.error('오류:\n' + [...errors].join('\n---\n')); await end(1); }
console.log('통과');
await end(0);

// 실제 마우스 클릭으로 새 게임 → 튜토리얼 → 던전 → 전투 → 귀환을 끝까지 돌린다. 가려져 눌리지 않는 UI·멈춤·콘솔 오류를 잡는다.
// 실행: npm run e2e   (먼저 npm run build)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const server = spawn('npx', ['vite', 'preview', '--port', '4180', '--strictPort'], { stdio: 'ignore', detached: true });
const stopServer = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch {} };
const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
const dir = fs.readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().pop();
const exe = [path.join(root, dir, 'chrome-linux64', 'chrome'), path.join(root, dir, 'chrome-linux', 'chrome')].find((p) => fs.existsSync(p));
let browser;
const end = async (code) => { try { await browser?.close(); } catch {} stopServer(); process.exit(code); };
setTimeout(() => { console.error('시간 초과'); end(2); }, 100000);
await new Promise((r) => setTimeout(r, 2500));
browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e).split('\n').slice(0, 60).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.setDefaultTimeout(1500);
await page.addInitScript(() => { Error.stackTraceLimit = 60; });
fs.mkdirSync('shots', { recursive: true });
const shot = (n) => page.screenshot({ path: `shots/e2e-${n}.png` });
const log = (s) => console.log('·', s);
const fail = async (msg) => { if (failing) return; failing = true; await shot('fail').catch(() => {}); console.error('실패:', msg); if (errors.length) console.error(errors.join('\n')); await end(1); };
let failing = false;
const T = { timeout: 2500 };
const click = async (sel, what) => { try { await page.locator(sel).first().click(T); } catch (e) { await fail(`${what ?? sel} 클릭 불가: ${String(e).split('\n')[0]}`); } await page.waitForTimeout(200); };
const clickText = async (t, exact = true) => { try { await page.getByText(t, { exact }).first().click(T); } catch (e) { await fail(`'${t}' 클릭 불가: ${String(e).split('\n')[0]}`); } await page.waitForTimeout(250); };
const has = (sel) => page.locator(sel).count().then((n) => n > 0);
const state = () => page.evaluate(() => { const S = window.__S; return S.hasGame ? { tut: S.data.Tutorial, dun: S.inDungeon, bat: !!S.battle, floor: S.run?.Floor ?? 0 } : { tut: 'none' }; });

await page.goto('http://localhost:4180/?debug');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(400);
await clickText('시작하기'); log('시작하기');
await clickText('건너뛰기'); log('프롤로그 건너뛰기');
await page.fill('input.text', '테스터');
await clickText('다음'); log('이름');
await clickText('전사', false); await clickText('다음'); log('직업');
await clickText('다음'); log('난이도');
await clickText('등록하기'); log('등록');
await page.waitForTimeout(600);

// 튜토리얼과 첫 던전을 코치 마크 지시대로만 진행한다
let last = '', coachSteps = 0;
for (let i = 0; i < 500; i++) {
  const st = await state();
  if (st.tut === 'Done') break;
  await page.waitForTimeout(150);
  if (i % 15 === 14) { await shot('loop'); log(`i=${i} ${JSON.stringify(st)} coach=${await has('.coach')} modal=${await has('.modal')} ${(await page.locator('.screen').first().innerText()).replace(/\n/g, ' ').slice(0, 80)}`); }
  if (await has('.coach .blink, .coach button.primary')) {
    const title = (await page.locator('.coach b').first().textContent().catch(() => '')) ?? '';
    const next = page.locator('.coach button.primary');
    const key = `${title}|${(await page.locator('.coach div').last().textContent().catch(() => '')).slice(0, 20)}`;
    if (key !== last) { last = key; coachSteps++; log(`코치 [${title}] ${st.dun ? '던전' : st.bat ? '전투' : ''}`); if (coachSteps <= 40) await shot(`c${String(coachSteps).padStart(2, '0')}`); }
    if (await next.count()) { await next.first().click(T).catch((e) => fail(`코치 '다음' 불가 ${e}`)); continue; }
    const box = await page.locator('.coach .blink').first().boundingBox();
    if (!box) continue;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.click(x, y); // 실제 좌표 클릭: 덮개가 막으면 아래 요소가 눌리지 않는다
    await page.waitForTimeout(350);
    continue;
  }
  // 코치가 없을 때: 화면별로 알맞게 진행
  if (await has('.modal')) {
    let done = false;
    for (const t of ['자동 배분', '확정', '나중에', '닫기', '확인']) {
      const b = page.locator('.modal button', { hasText: t }).first();
      if (await b.count() && await b.isEnabled()) { await b.click({ timeout: 800 }).catch(() => {}); done = true; break; }
    }
    if (!done) await page.locator('.modal button').last().click({ timeout: 800 }).catch(() => {});
    await page.waitForTimeout(200);
    continue;
  }
  if (st.bat) {
    if (await has('.card[role=button]')) { await page.locator('.card[role=button]').first().click(T).catch(() => {}); continue; }
    if (await has('.bchoice')) { await page.locator('.bchoice').first().click(T).catch(() => {}); await page.waitForTimeout(700); continue; }
  }
  if (st.dun) {
    if (await has('.dock button.choice')) { await page.locator('.dock button.choice').first().click(T).catch(() => {}); continue; }
    const pad = page.locator('.pad button');
    if (await pad.count()) {
      const pick = (await pad.filter({ hasText: '보스' }).count()) ? pad.filter({ hasText: '보스' }) : (await page.locator('.pad button:has(.glow)').count()) ? page.locator('.pad button:has(.glow)') : pad;
      await pick.first().click(T).catch(() => {}); await page.waitForTimeout(300); continue;
    }
  }
  if (await has('button.primary.lg')) { await page.locator('button.primary.lg').first().click(T).catch(() => {}); continue; }
  if (i % 15 === 14) { await shot(`loop`); log(`i=${i} ${JSON.stringify(st)} ${(await page.locator(".screen").first().innerText()).replace(/\n/g, " ").slice(0, 90)}`); }
}
const final = await state();
log(`튜토리얼 종료: ${JSON.stringify(final)}`);
await shot('after-tutorial');
if (final.tut !== 'Done') await fail('튜토리얼이 끝나지 않음');
if (errors.length) { console.error('콘솔 오류:\n' + errors.join('\n')); await end(1); }
console.log('통과');
await end(0);

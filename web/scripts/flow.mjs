// 화면 흐름 스크린샷: node scripts/flow.mjs "click=시작하기" "fill=input|검사" "shot=shots/a.png" ...
// 단계: click=글자(보이는 글자로 찾아 누름) · fill=선택자|값 · wait=ms · shot=파일 · eval=자바스크립트 · url=주소(처음 한 번, 기본 localhost:4173)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const steps = process.argv.slice(2);
const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
const dir = fs.readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().pop();
const exe = dir ? [path.join(root, dir, 'chrome-linux64', 'chrome'), path.join(root, dir, 'chrome-linux', 'chrome')].find((p) => fs.existsSync(p)) : undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let url = 'http://localhost:4173/';
const first = steps.find((s) => s.startsWith('url='));
if (first) url = first.slice(4);
await page.goto(url);
await page.waitForTimeout(300);
for (const s of steps) {
  const i = s.indexOf('=');
  const k = s.slice(0, i), v = s.slice(i + 1);
  if (k === 'click') await page.getByText(v, { exact: false }).first().click();
  else if (k === 'sel') await page.locator(v).first().click();
  else if (k === 'clickexact') await page.getByText(v, { exact: true }).first().click();
  else if (k === 'fill') { const [sel, val] = v.split('|'); await page.fill(sel, val); }
  else if (k === 'wait') await page.waitForTimeout(parseInt(v, 10));
  else if (k === 'eval') await page.evaluate(v);
  else if (k === 'shot') { fs.mkdirSync(path.dirname(v), { recursive: true }); await page.screenshot({ path: v }); console.log('저장:', v); }
  await page.waitForTimeout(150);
}
await browser.close();
if (errors.length) { console.error('콘솔 오류:', errors.join('\n')); process.exit(1); }

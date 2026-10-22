// 화면 스크린샷 (개발 서버 또는 preview 주소를 390×844로): node scripts/shot.mjs [url] [out.png]
// 설치된 크로미움(/opt/pw-browsers)을 쓴다. 화면 확인은 이걸로 한다 (Unity 빌드를 기다릴 필요 없음).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'shots/main.png';
fs.mkdirSync(path.dirname(out), { recursive: true });
const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
const dir = fs.readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().pop();
const browser = await chromium.launch({ executablePath: dir ? [path.join(root, dir, 'chrome-linux64', 'chrome'), path.join(root, dir, 'chrome-linux', 'chrome')].find((p) => fs.existsSync(p)) : undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(400);
await page.screenshot({ path: out });
await browser.close();
if (errors.length) { console.error('콘솔 오류:', errors.join('\n')); process.exit(1); }
console.log('저장:', out);

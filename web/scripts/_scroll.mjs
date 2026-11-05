import { start } from './_browser.mjs';
import fs from 'node:fs';
const src = fs.readFileSync('scripts/layout.mjs', 'utf8');
const SETUP = eval(src.match(/const SETUP = (`[\s\S]*?`);/)[1]);
const { browser, end } = await start(4232, 120000);
const states = [['guild', `window.__nav('guild')`], ['shop', `window.__nav('shop')`], ['training', `window.__nav('training')`], ['blacksmith', `window.__nav('blacksmith')`], ['register-name', `window.__register(0)`], ['register-job', `window.__register(1)`]];
for (const [w, h] of (process.argv[2] ?? '360x640,390x844,480x1000').split(',').map((v) => v.split('x').map(Number))) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://localhost:4232/?debug'); await p.waitForTimeout(300);
  const out = [];
  for (const [n, js] of states) {
    await p.evaluate(SETUP); await p.evaluate(js); await p.waitForTimeout(200);
    await p.screenshot({ path: `shots/scroll-${w}x${h}-${n}.png` });
    out.push(n + ' ' + await p.evaluate(() => {
      const over = [...document.querySelectorAll('.screen *')].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1; });
      return over.length ? over.map((e) => `${e.className.split(' ')[0]}+${e.scrollHeight - e.clientHeight}`).join(',') : 'OK';
    }));
  }
  console.log(`${w}×${h}: ` + out.join(' | '));
  await p.close();
}
await end();

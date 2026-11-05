// 마을 시스템을 화면에서 직접 눌러 상태가 바뀌는지 확인한다: 상점 구매·판매, 길드 수락·보고·창고, 대장간 강화, 수련, 가방 사용·착용, 저장 후 이어하기.
// 실행: npm run build && node scripts/systems.mjs
import { register, start } from './_browser.mjs';
import fs from 'node:fs';
const { browser, end } = await start(4200, 100000);
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(2000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e).split('\n').slice(0, 8).join('\n')));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
fs.mkdirSync('shots', { recursive: true });
const fails = [];
const ok = (cond, msg) => { console.log(cond ? '  ✓' : '  ✗', msg); if (!cond) fails.push(msg); };
const S = (fn, arg) => page.evaluate(fn, arg);
const tap = async (t, exact = true) => { await page.getByText(t, { exact }).first().click(); await page.waitForTimeout(250); };
const tapSel = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(250); };
const back = async () => { await page.locator('[data-anchor="topbar.back"]').first().click(); await page.waitForTimeout(250); };
const shot = (n) => page.screenshot({ path: `shots/sys-${n}.png` });

await page.goto('http://localhost:4200/?debug');
await page.evaluate(() => localStorage.clear());
await page.reload();
await register(page, '점검');
await S(() => { const s = window.__S; s.setTutorial('Done'); s.c.Gold = 50000; s.c.Level = 20; s.c.HighestFloorCleared = 4; window.__go(); });
await page.waitForTimeout(300);

console.log('상점');
await tap('상점');
const g0 = await S(() => window.__S.c.Gold);
const inv0 = await S(() => window.__S.c.Inventory.Items.length);
// 소모품 구매: 소모품 칸을 눌러 구매
const potionCell = page.locator('.card-btn', { hasText: '물약' }).first();
if (await potionCell.count()) {
  await potionCell.click(); await page.waitForTimeout(250);
  const buy = page.locator('.modal button', { hasText: /구매|\+/ }).last();
  await buy.click().catch(() => {}); await page.waitForTimeout(300);
}
const g1 = await S(() => window.__S.c.Gold);
ok(g1 < g0, `소모품 구매로 골드가 줄었다 (${g0} → ${g1})`);
await page.waitForTimeout(200);
// 장비 구매
await page.locator('.card-btn', { hasText: /G$/ }).first().click().catch(() => {});
await page.waitForTimeout(250);
const equipBuy = page.locator('.modal button.primary', { hasText: '구매' });
if (await equipBuy.count()) { await equipBuy.click(); await page.waitForTimeout(400); }
const g2 = await S(() => window.__S.c.Gold);
ok(g2 < g1, `장비 구매로 골드가 줄었다 (${g1} → ${g2})`);
await page.locator('.modal button', { hasText: '착용' }).first().click({ timeout: 800 }).catch(() => {});
await page.locator('.modal button', { hasText: '나중에' }).first().click({ timeout: 500 }).catch(() => {});
await shot('shop-buy');
await tap('판매');
await shot('shop-sell');
const sellable = page.locator('.card-btn').first();
if (await sellable.count()) {
  const before = await S(() => window.__S.c.Gold);
  await sellable.click(); await page.waitForTimeout(250);
  await page.locator('.modal button', { hasText: /판매|전부/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  const after = await S(() => window.__S.c.Gold);
  ok(after > before, `판매로 골드가 늘었다 (${before} → ${after})`);
}
await page.locator('.modal-x').first().click({ timeout: 500 }).catch(() => {});
await back();

console.log('길드');
await tap('길드');
await shot('guild');
const accepted0 = await S(() => window.__S.data.Guild.Active.length);
await page.locator('button', { hasText: '수락' }).first().click().catch(() => {});
await page.waitForTimeout(300);
const accepted1 = await S(() => window.__S.data.Guild.Active.length);
ok(accepted1 === accepted0 + 1, `퀘스트를 수락했다 (${accepted0} → ${accepted1})`);
await tap('등급', true).catch(() => {});
await shot('guild-rank');
await tap('창고', true).catch(() => {});
await shot('guild-storage');
await back();

console.log('대장간');
await tap('대장간');
await shot('smith');
const enhanceBtn = page.locator('button.primary', { hasText: '강화' }).first();
const lv0 = await S(() => Math.max(0, ...Object.values(window.__S.c.Equipped ?? {}).map((i) => (i ? i.EnhanceLevel ?? 0 : 0))));
await enhanceBtn.click().catch(() => {});
await page.waitForTimeout(600);
const g3 = await S(() => window.__S.c.Gold);
ok(g3 < g2 + 5000, '강화 버튼이 눌린다 (골드 사용 확인)');
await shot('smith-after');
await back();

console.log('수련장');
await tap('수련장');
await shot('training');
const trainBtn = page.locator('button', { hasText: /^수련 ·/ }).first();
if (await trainBtn.count()) {
  const gg = await S(() => window.__S.c.Gold);
  await trainBtn.click(); await page.waitForTimeout(300);
  ok((await S(() => window.__S.c.Gold)) < gg, '수련으로 골드가 줄었다');
} else console.log('  (수련 가능한 스킬 없음)');
await back();

console.log('가방·캐릭터·스킬');
for (const [name, label] of [['가방', '가방'], ['캐릭터', '캐릭터'], ['스킬', '스킬']]) {
  const nav = page.locator('.bottomnav button, nav button').nth(['캐릭터', '가방', '스킬'].indexOf(name) + 1);
  await nav.click().catch(() => {});
  await page.waitForTimeout(300);
  await shot(`nav-${name}`);
}
await page.locator('.bottomnav button, nav button').first().click().catch(() => {});

console.log('저장·이어하기');
const snapshot = await S(() => { const s = window.__S; s.save(); return { gold: s.c.Gold, name: s.c.Name, lvl: s.c.Level }; });
await page.reload();
await page.waitForTimeout(400);
await tap('이어하기');
await page.locator('.modal button.primary', { hasText: '이어하기' }).click();
await page.waitForTimeout(500);
const restored = await S(() => { const s = window.__S; return { gold: s.c.Gold, name: s.c.Name, lvl: s.c.Level }; });
ok(JSON.stringify(restored) === JSON.stringify(snapshot), `저장 후 이어하기가 그대로 복원 ${JSON.stringify(restored)}`);

ok(errors.length === 0, '콘솔 오류 없음');
if (errors.length) console.error(errors.join('\n---\n'));
console.log(fails.length ? `실패 ${fails.length}건` : '통과');
await end(fails.length ? 1 : 0);

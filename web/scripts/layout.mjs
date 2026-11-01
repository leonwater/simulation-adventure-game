// UI 틀 점검: 여러 화면 비율에서 거의 모든 화면·팝업을 열어
//  (1) 화면 밖으로 나간 요소  (2) 가로로 잘린 글자(말줄임 없음)  (3) 고정 높이 칸에서 세로로 잘린 내용  (4) 콘솔 오류
// 를 찾아 목록으로 보여 주고 화면마다 스크린샷(shots/layout/)을 남긴다.
// 실행: npm run build && node scripts/layout.mjs [360x640,390x844,...]
import { start } from './_browser.mjs';
import fs from 'node:fs';

const VIEWS = (process.argv[2] ?? '360x640,360x740,390x844,412x915,480x1000').split(',').map((v) => v.split('x').map(Number));
const PORT = 4230;
const { browser, end } = await start(PORT, 280000);
fs.mkdirSync('shots/layout', { recursive: true });

// 게임 준비: 긴 이름·중간 레벨·골드 넉넉·아이템 몇 개
const SETUP = `(() => {
  const S = window.__S;
  S.newGame('아주긴이름모험가', 'Warrior', 'Normal');
  S.setTutorial('Done');
  const c = S.c; c.Level = 24; c.Gold = 1234567; c.HighestFloorCleared = 12; c.UnspentPoints = 6; S.selectFloor(13);
  S.save();
})()`;
const enterDungeon = `(() => { const S = window.__S; if (!S.inDungeon) S.enterDungeon(); S.run.FloorIntroPending = false; window.__go(); })()`;
const forceRoom = (type, extra = '') => `(() => { const S = window.__S; if (!S.inDungeon) S.enterDungeon(); const run = S.run; run.FloorIntroPending = false; const cur = run.Map.Rooms[run.CurrentRoomId];
  let t = run.Map.Rooms.find(r => r.Type === '${type}' && !r.Cleared) ?? run.Map.Rooms.find(r => r.Id !== cur.Id && r.Type === 'Battle');
  t.Type = '${type}'; t.Cleared = false; ${extra}
  if (!cur.Links.includes(t.Id)) { cur.Links.push(t.Id); t.Links.push(cur.Id); } S.move(t.Id); window.__go(); })()`;

// [이름, 실행할 코드, 클릭할 선택자들]
const STATES = [
  ['title', `window.__screens.goTitle()`],
  ['settings', `window.__screens.goTitle()`, ['button:text-is("설정")']],
  ['town', `window.__screens.goTown()`],
  ['character', `window.__nav('character')`],
  ['character-detail', `window.__nav('character')`, ['button:has-text("상세 능력치")']],
  ['inventory', `window.__nav('inventory')`],
  ['inventory-item', `window.__nav('inventory')`, ['.scroll .card-btn >> nth=0']],
  ['skills', `window.__nav('skills')`],
  ['skills-detail', `window.__nav('skills')`, ['.scroll .card-btn >> nth=0']],
  ['shop', `window.__nav('shop')`],
  ['shop-item', `window.__nav('shop')`, ['[data-anchor="shop.equip"] .card-btn >> nth=0']],
  ['shop-sell', `window.__nav('shop')`, ['[data-anchor="tab.1"]']],
  ['guild', `window.__nav('guild')`],
  ['guild-rank', `window.__nav('guild')`, ['[data-anchor="tab.1"]']],
  ['guild-storage', `window.__nav('guild')`, ['[data-anchor="tab.2"]']],
  ['blacksmith', `window.__nav('blacksmith')`],
  ['training', `window.__nav('training')`],
  ['dungeon', enterDungeon],
  ['dungeon-map', enterDungeon, ['[data-anchor="dungeon.map"]']],
  ['dungeon-pause', enterDungeon, ['[aria-label="일시정지"]']],
  ['dungeon-info', enterDungeon, ['.bottombar button:has-text("정보")']],
  ['dungeon-quest', enterDungeon, ['.bottombar button:has-text("퀘스트")']],
  ['dungeon-bag', `${enterDungeon}; window.__bag()`],
  ['battle', forceRoom('Battle')],
  ['battle-items', forceRoom('Battle'), ['.bchoice:has-text("아이템 사용")']],
  ['battle-detail', forceRoom('Battle'), ['.bchoice >> nth=1']],
  ['event', forceRoom('Event', "t.EventId = 'evt_sphinx';")],
  ['event2', forceRoom('Event', "t.EventId = 'evt_blood_well';")],
  ['merchant', `${forceRoom('Merchant', 't.MerchantGoods = JSON.parse(JSON.stringify(S.data.Shop.Goods));')}; window.__screens.goMerchant()`],
  ['merchant-sell', `${forceRoom('Merchant', 't.MerchantGoods = JSON.parse(JSON.stringify(S.data.Shop.Goods));')}; window.__screens.goMerchant()`, ['[data-anchor="tab.1"]']],
  ['boss-choice', `(() => { const S = window.__S; if (!S.inDungeon) S.enterDungeon(); const run = S.run; run.FloorIntroPending = false; run.CurrentRoomId = run.Map.BossId; run.BossDefeated = true; window.__go(); })()`],
  ['death', `(() => { const S = window.__S; if (!S.inDungeon) S.enterDungeon(); S.run.FloorIntroPending = false; ${''}const run = S.run; const cur = run.Map.Rooms[run.CurrentRoomId]; const t = run.Map.Rooms.find(r => r.Id !== cur.Id && r.Type === 'Battle'); if (!cur.Links.includes(t.Id)) { cur.Links.push(t.Id); t.Links.push(cur.Id); } S.move(t.Id); for (const e of S.battle.enemies) { e.attack = 1e7; } const ch = S.battle.getChoices().find(x => x.kind === 'Attack'); S.executeBattle(ch); window.__screens.goResult('Death'); })()`],
  ['return', `(() => { const S = window.__S; if (!S.inDungeon) S.enterDungeon(); S.returnToTown(); window.__screens.goResult('Return'); })()`],
  ['clear', `window.__screens.goResult('Clear')`],
];

const CHECK = () => {
  const scr = document.querySelector('.screen').getBoundingClientRect();
  const out = [];
  const desc = (el) => {
    const t = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}「${t}」`;
  };
  for (const el of document.querySelectorAll('.screen *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('.floatup, .flash, .toast, .intro') || el.classList.contains('blurfill')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // 무대(전투)는 변환으로 줄이므로 바깥 상자만 본다
    if (el.closest('.stage') && !el.classList.contains('stage')) continue;
    if (r.right > scr.right + 1.5 || r.left < scr.left - 1.5) out.push(`화면 밖: ${desc(el)} (${Math.round(r.left - scr.left)}~${Math.round(r.right - scr.left)} / 폭 ${Math.round(scr.width)})`);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const ox = cs.overflowX, oy = cs.overflowY;
    if (hasText && el.scrollWidth > el.clientWidth + 1 && ox !== 'auto' && ox !== 'scroll' && cs.textOverflow !== 'ellipsis' && el.clientWidth > 0)
      out.push(`가로 잘림: ${desc(el)} (${el.scrollWidth}>${el.clientWidth})`);
    // 부모 상자 밖으로 삐져나온 것 (예: 지도 팝업에서 지도가 테두리 밖으로) — 일부러 겹쳐 둔 절대 위치 요소는 제외
    const par = el.parentElement;
    if (par && !el.classList.contains('modal-x') && cs.position !== 'absolute' && cs.position !== 'fixed' && !el.closest('.stage') && getComputedStyle(par).display !== 'inline') {
      const pr = par.getBoundingClientRect();
      if (pr.width > 0 && (r.right > pr.right + 1.5 || r.left < pr.left - 1.5)) out.push(`부모 밖: ${desc(el)} (${Math.round(r.left - pr.left)}~${Math.round(r.right - pr.left)} / 부모 폭 ${Math.round(pr.width)})`);
    }
    // 팝업·스크롤 영역 안에서 가로로 넘쳐 옆으로 밀리는 것 (세로 스크롤 영역이 가로로도 스크롤되면 안 된다)
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && (ox === 'auto' || ox === 'scroll' || ox === 'hidden') && !el.classList.contains('stagewrap') && !el.classList.contains('screen') && !el.classList.contains('illust') && cs.textOverflow !== 'ellipsis' && !el.closest('.stage'))
      out.push(`가로 넘침: ${desc(el)} (${el.scrollWidth}>${el.clientWidth})`);
    if (el.scrollHeight > el.clientHeight + 2 && oy === 'hidden' && el.clientHeight > 0 && !el.classList.contains('stagewrap') && !el.classList.contains('screen') && !el.classList.contains('illust') && cs.textOverflow !== 'ellipsis')
      out.push(`세로 잘림: ${desc(el)} (${el.scrollHeight}>${el.clientHeight})`);
  }
  return [...new Set(out)];
};

const allIssues = [];
for (const [w, hgt] of VIEWS) {
  const page = await browser.newPage({ viewport: { width: w, height: hgt } });
  // 비교용 스크린샷이 실행마다 같도록 무작위 값을 고정한다 (화면마다 같은 씨앗으로 다시 시작)
  await page.addInitScript(() => {
    let seed = 1;
    window.__reseed = (n) => { seed = n >>> 0 || 1; };
    Date.now = () => 1767225600000; // 난수 씨앗에 쓰이는 시각도 고정
    Math.random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  page.setDefaultTimeout(1500);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(300);
  for (const [name, code, clicks = []] of STATES) {
    try {
      await page.evaluate((n) => window.__reseed(n), STATES.findIndex((x) => x[0] === name) + 1);
      await page.evaluate(SETUP);
      await page.evaluate(code);
      await page.waitForTimeout(350);
      for (const sel of clicks) {
        await page.locator(sel).first().click();
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(250);
      const issues = await page.evaluate(CHECK);
      await page.screenshot({ path: `shots/layout/${w}x${hgt}-${name}.png` });
      for (const i of issues) allIssues.push(`[${w}x${hgt}] ${name}: ${i}`);
    } catch (e) {
      allIssues.push(`[${w}x${hgt}] ${name}: 열기 실패 ${String(e).split('\n')[0].slice(0, 120)}`);
    }
    // 열린 팝업 닫기
    await page.evaluate(() => document.querySelectorAll('.layer > *').forEach((e) => e.remove()));
  }
  for (const e of errors) allIssues.push(`[${w}x${hgt}] 콘솔 오류: ${e}`);
  await page.close();
}
console.log(allIssues.length ? allIssues.join('\n') : '문제 없음');
console.log(`\n화면 ${STATES.length}개 × 비율 ${VIEWS.length}개 점검, 문제 ${allIssues.length}건`);
await end(0);

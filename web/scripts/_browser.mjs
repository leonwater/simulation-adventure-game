// 점검 스크립트 공통: vite 미리보기 서버 + 설치된 크로미움을 띄우고, end()로 둘 다 닫는다.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export async function start(port, timeoutMs) {
  // detached: npx 아래 vite 자식까지 한 묶음으로 끝내야 다음 실행이 옛 서버(옛 dist)를 보지 않는다
  const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  const dir = fs.readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().pop();
  const exe = [path.join(root, dir, 'chrome-linux64', 'chrome'), path.join(root, dir, 'chrome-linux', 'chrome')].find((p) => fs.existsSync(p));
  let browser;
  const end = async (code) => {
    try { await browser?.close(); } catch {}
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
    process.exit(code);
  };
  setTimeout(() => { console.error('시간 초과'); end(2); }, timeoutMs);
  await new Promise((r) => setTimeout(r, 2500));
  browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  return { browser, end };
}

/** 새 게임 등록: 타이틀 → 프롤로그 건너뛰기 → 이름 → 직업(확인 팝업 '정하기') → 난이도 → 등록하기. 등록 화면이 바뀌어도 보이는 버튼대로 누른다 (점검 스크립트 공통). */
export async function register(page, name, job = '전사') {
  const tap = async (loc) => { await loc.first().click({ timeout: 3000 }); await page.waitForTimeout(200); };
  await tap(page.getByText('시작하기', { exact: true }));
  await tap(page.getByText('건너뛰기', { exact: true }));
  await page.fill('input.text', name);
  await tap(page.getByText('다음', { exact: true }));
  await tap(page.getByText(job));
  for (let i = 0; i < 6 && !(await page.locator('button:has-text("등록하기")').count()); i++) {
    const ok = page.locator('.modal button:has-text("정하기")');
    await tap((await ok.count()) ? ok : page.getByText('다음', { exact: true }));
  }
  await tap(page.getByText('등록하기', { exact: true }));
}

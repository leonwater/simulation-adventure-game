import { desktop, h } from './kit';
import { modal } from './overlay';
import { router } from './router';

/** 키 이름 (data-key 값): 글자는 소문자, WASD는 방향키로. */
const ALIAS: Record<string, string> = { w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight' };
const BADGE: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

/** el에 단축키를 단다. PC에서는 작은 글자(kbd)로 키를 보여 준다. */
export function hotkey<T extends HTMLElement>(el: T, key: string, badge = true): T {
  el.dataset.key = key;
  if (desktop && badge) el.append(h('kbd', { class: 'kbd', 'aria-hidden': 'true' }, BADGE[key] ?? key.toUpperCase()));
  return el;
}

/** 단축키가 가리키는 버튼을 누른 것과 똑같이 처리한다 (비활성·연출 중·숨김이면 무시). */
function press(scope: ParentNode, key: string): boolean {
  const el = scope.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  if (!el || (el as HTMLButtonElement).disabled || el.offsetParent === null || getComputedStyle(el).pointerEvents === 'none') return false;
  el.click();
  return true;
}

function showHelp(): void {
  const m = modal('키보드 조작');
  const line = (k: string, v: string): HTMLElement => h('div', { class: 'row', style: { gap: '10px' } }, h('kbd', { class: 'kbd-inline' }, k), h('span', null, v));
  m.body.append(
    line('1 ~ 9', '전투·이벤트 선택지 고르기'),
    line('← →', '전투 대상 바꾸기'),
    line('↑ ↓ ← → · WASD', '던전 이동'),
    line('P', '회복 물약'),
    line('I · C · K', '가방 · 캐릭터(정보) · 스킬'),
    line('M · Q · R', '지도 · 퀘스트 · 귀환'),
    line('Enter', '창의 확인 버튼'),
    line('Esc', '창 닫기 · 뒤로'),
    line('?', '이 도움말'),
    line('마우스', '올리면 설명 · 오른쪽 클릭하면 상세'));
}

/** 키보드 단축키 (main.ts에서 한 번). 튜토리얼 안내 중에는 Esc만 듣는다. */
export function installKeys(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return void router.back();
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
    if (router.layer.querySelector('.coach')) return;
    const top = [...router.layer.querySelectorAll<HTMLElement>('.modal')].pop();
    if (top) {
      // 창이 떠 있으면 그 창 안에서만: Enter = 확인(주 버튼)
      const ok = e.key === 'Enter' ? top.querySelector<HTMLButtonElement>('button.primary:not(:disabled)') : null;
      if (ok) {
        e.preventDefault();
        ok.click();
      }
      return;
    }
    if (e.key === '?') return void showHelp();
    const key = e.key.length === 1 ? (ALIAS[e.key.toLowerCase()] ?? e.key.toLowerCase()) : e.key;
    if (router.key(key) || press(document, key)) e.preventDefault();
  });
}

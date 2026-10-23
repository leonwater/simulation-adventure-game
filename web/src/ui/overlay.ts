import type { BtnKind } from './kit';
import { button, h, row } from './kit';
import { router } from './router';

export interface ModalHandle {
  body: HTMLElement;
  close(): void;
}

/** 가운데 팝업. closable이면 바깥을 누르거나 뒤로 가기로 닫는다. */
export function modal(title: string | null, closable = true): ModalHandle {
  const body = h('div', { class: 'modal' });
  const dim = h('div', { class: 'dim' }, body);
  let release = (): void => {};
  const close = (): void => {
    release();
    dim.remove();
  };
  // 제목줄: 닫을 수 있는 팝업은 오른쪽 위에 × 버튼 (바깥을 눌러야만 닫히면 휴대폰에서 찾기 어렵다)
  if (title || closable) body.append(h('div', { class: 'modal-head' }, h('h3', null, title ?? ''), closable ? h('button', { class: 'modal-x', 'aria-label': '닫기', on: { click: close } }, '×') : null));
  if (closable) dim.addEventListener('click', (e) => e.target === dim && close());
  release = router.pushCloser(() => {
    if (closable) close();
    return true;
  });
  router.layer.append(dim);
  return { body, close };
}

export function confirmBox(title: string, message: string, okLabel: string, onOk: () => void, cancelLabel = '취소', okKind: BtnKind = 'primary'): void {
  const m = modal(title);
  m.body.append(
    h('div', { class: 'body', style: { whiteSpace: 'pre-line', lineHeight: '1.5' } }, message),
    row(
      button(cancelLabel, m.close, 'ghost', 'grow'),
      button(okLabel, () => {
        m.close();
        onOk();
      }, okKind, 'grow'),
    ),
  );
}

let toastTimer = 0;
/** 다음에 화면을 누르면(어떤 행동이든) 바로 지운다. 아무것도 하지 않으면 원래 시간만큼 남는다. */
function closeOnNextAction(el: HTMLElement): void {
  const off = (): void => {
    el.remove();
    document.removeEventListener('pointerdown', off, true);
  };
  // 지금 이 알림을 띄운 누름이 끝난 뒤부터 듣는다
  window.setTimeout(() => {
    if (el.isConnected) document.addEventListener('pointerdown', off, true);
  }, 0);
}

export function toast(message: string): void {
  router.layer.querySelectorAll('.toast').forEach((e) => e.remove());
  const el = h('div', { class: 'toast' }, message);
  router.layer.append(el);
  closeOnNextAction(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 2200);
}

/** 화면 가운데에 잠깐 떴다 사라지는 글자 (구매·강화 결과). */
export function flash(message: string, color = 'var(--gold)'): void {
  const el = h('div', { class: 'flash', style: { color } }, message);
  router.layer.append(el);
  closeOnNextAction(el);
  window.setTimeout(() => el.remove(), 800);
}

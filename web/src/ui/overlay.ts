import type { BtnKind } from './kit';
import { button, h, row } from './kit';
import { router } from './router';

export interface ModalHandle {
  body: HTMLElement;
  close(): void;
}

/** 가운데 팝업. closable이면 바깥을 누르거나 뒤로 가기로 닫는다. */
export function modal(title: string | null, closable = true): ModalHandle {
  const body = h('div', { class: 'modal' }, title ? h('h3', null, title) : null);
  const dim = h('div', { class: 'dim' }, body);
  let release = (): void => {};
  const close = (): void => {
    release();
    dim.remove();
  };
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

export function infoBox(title: string, message: string, okLabel = '확인', onClose?: () => void): void {
  const m = modal(title, false);
  m.body.append(
    h('div', { class: 'body', style: { whiteSpace: 'pre-line', lineHeight: '1.5' } }, message),
    button(okLabel, () => {
      m.close();
      onClose?.();
    }, 'primary'),
  );
}

let toastTimer = 0;
export function toast(message: string): void {
  router.layer.querySelectorAll('.toast').forEach((e) => e.remove());
  const el = h('div', { class: 'toast', on: { click: () => el.remove() } }, message);
  router.layer.append(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 2200);
}

/** 화면 가운데에 잠깐 떴다 사라지는 글자 (구매·강화 결과). */
export function flash(message: string, color = 'var(--gold)'): void {
  const el = h('div', { class: 'flash', style: { color } }, message);
  router.layer.append(el);
  window.setTimeout(() => el.remove(), 800);
}

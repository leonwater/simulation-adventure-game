/** 칸을 끌어서 다른 칸에 놓으면 순서를 바꾼다 (터치·마우스 공통). 조금 움직이기 전에는 그냥 누르기로 본다. */
export function dragReorder(cells: HTMLElement[], onMove: (from: number, to: number) => void): void {
  cells.forEach((cell, from) => {
    let startX = 0, startY = 0, dragging = false, active = false;
    let ghost: HTMLElement | null = null;
    const end = (): void => {
      active = false;
      ghost?.remove();
      ghost = null;
      cells.forEach((c) => (c.style.outline = ''));
    };
    cell.style.touchAction = 'none';
    cell.addEventListener('pointerdown', (e) => {
      active = true;
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      cell.setPointerCapture(e.pointerId);
    });
    cell.addEventListener('pointermove', (e) => {
      if (!active) return;
      if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) {
        dragging = true;
        ghost = cell.cloneNode(true) as HTMLElement;
        ghost.style.cssText += ';position:fixed;pointer-events:none;opacity:.8;z-index:99;width:' + cell.offsetWidth + 'px';
        document.body.append(ghost);
      }
      if (!dragging || !ghost) return;
      ghost.style.left = `${e.clientX - cell.offsetWidth / 2}px`;
      ghost.style.top = `${e.clientY - cell.offsetHeight / 2}px`;
      const to = cells.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
      cells.forEach((c, i) => (c.style.outline = i === to && i !== from ? '2px solid var(--gold)' : ''));
    });
    cell.addEventListener('pointerup', (e) => {
      if (!active) return;
      const was = dragging;
      const to = cells.findIndex((c) => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
      end();
      if (was) {
        cell.addEventListener('click', (ev) => ev.stopImmediatePropagation(), { capture: true, once: true });
        if (to >= 0 && to !== from) onMove(from, to);
      }
    });
    cell.addEventListener('pointercancel', end);
  });
}

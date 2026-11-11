import { AllocationDraft, maxHp } from '../core/character';
import { jobData } from '../core/jobs';
import { S } from './game';
import { colored } from './items';
import { button, h, row } from './kit';
import { modal, toast } from './overlay';
import { router } from './router';
import { statRow } from './statrow';

/** 던전 안 능력치 배분 창 (레벨 업 직후 · 던전 정보 창): 자동 배분 · 확정 · 나중에. */
export function openAllocation(title: string): void {
  const c = S.c;
  const draft = new AllocationDraft(c);
  const m = modal(title, false);
  // 창을 닫았다 다시 열지 않고 내용만 바꾼다 (+/- 누를 때 깜빡이지 않게)
  const fill = (): void => {
    m.body.replaceChildren(m.body.firstChild!);
    const stats = jobData(c.Job).allocatable;
    m.body.append(h('div', null, '포인트 ', colored(String(draft.remaining), 'var(--gold)')),
      ...stats.map((st, i) => statRow(draft, st, i < stats.length - 1, fill)));
    const auto = button('자동 배분', () => {
      draft.auto();
      fill();
    }, '', 'grow');
    auto.disabled = draft.remaining <= 0;
    const ok = button('확정', () => {
      const before = maxHp(c);
      draft.commit();
      c.CurrentHp = Math.min(maxHp(c), c.CurrentHp + Math.max(0, maxHp(c) - before));
      S.save();
      m.close();
      router.rebuild();
    }, 'primary', 'grow');
    ok.disabled = !draft.hasChanges;
    const later = button('나중에', () => {
      m.close();
      toast('포인트는 던전의 정보 창이나 마을 캐릭터 화면에서 배분할 수 있습니다');
    }, 'ghost', 'grow');
    // 좁은 화면에서도 버튼 글자가 한 줄로 (360px에서 '자동 배분'이 접혔다)
    for (const b of [later, auto, ok]) Object.assign(b.style, { whiteSpace: 'nowrap', paddingInline: '6px' });
    m.body.append(row(later, auto, ok));
  };
  fill();
}

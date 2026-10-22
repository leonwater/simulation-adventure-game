import { maxChallengeFloor } from '../core/character';
import { themeFor } from '../core/monsters';
import { Names } from '../core/names';
import { alerts } from '../ui/alerts';
import { bottomNav, townHeader } from '../ui/chrome';
import { S } from '../ui/game';
import { assetUrl, button, h, icon, row } from '../ui/kit';
import { toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { DIFFICULTY_COLOR } from '../ui/theme';
import { anchored } from '../ui/coach';
import { tutorial } from '../ui/tutorial';
import { navigate } from './nav';
import { goToCurrent } from './index';

/** 마을: 상태 머리줄, 마을 전경, 시설 4개, 도전 층 선택, 던전 입장, 하단 메뉴. */
export class TownScreen extends Screen {
  build(): HTMLElement {
    const c = S.c;
    const d = S.data!;
    const facility = (iconName: string, title: string, alert: boolean, to: 'guild' | 'shop' | 'blacksmith' | 'training'): HTMLElement =>
      anchored(h('button', { class: 'card-btn fac', on: { click: () => navigate(to) } }, icon(iconName, 48), h('b', { style: { fontSize: '16px' } }, title), alert ? h('span', { class: 'dot', style: { top: '10px', right: '12px', width: '12px', height: '12px' } }) : null), `town.${to}`);
    const floor = d.SelectedFloor;
    const max = maxChallengeFloor(c);
    return h('div', { class: 'page' },
      townHeader(c),
      // 한 화면에 맞춤: 일러스트가 남는 높이만큼만 차지한다 (작은 폰에서는 줄어든다)
      h('div', { class: 'scroll fit', style: { gap: '14px' } },
        h('div', { class: 'illust round', style: { flex: '1 1 0', minHeight: '90px', maxHeight: '220px', backgroundImage: `url(${assetUrl('illustrations/town.jpg')})` } }),
        row(h('b', { class: 'grow', style: { fontSize: '22px' } }, '라브 마을'), h('b', { style: { color: DIFFICULTY_COLOR[S.difficulty], fontSize: '14px' } }, Names.difficulty(S.difficulty))),
        c.UnspentPoints > 0
          ? h('button', { class: 'card-btn on', style: { minHeight: '44px', color: 'var(--gold)', fontSize: '13px' }, on: { click: () => navigate('character') } }, `남은 능력치 포인트 ${c.UnspentPoints} — 캐릭터 화면에서 배분하세요`)
          : null,
        h('div', { class: 'grid2' },
          facility('guild', '길드', alerts.guild, 'guild'),
          facility('shop', '상점', alerts.shop, 'shop'),
          facility('blacksmith', '대장간', false, 'blacksmith'),
          facility('training', '수련장', false, 'training')),
        max > 1
          ? row(
            this.step('‹', floor > 1, -1),
            h('b', { class: 'grow center' }, `도전 층 ${floor} / ${max}`),
            this.step('›', floor < max, 1))
          : null,
        anchored(h('button', { class: 'primary', style: { minHeight: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }, on: { click: () => this.enterDungeon() } },
          h('b', { style: { fontSize: '17px' } }, '던전 입장'),
          h('span', { style: { fontSize: '12px' } }, `${floor}층 도전 · ${themeFor(floor).Name}`)), 'town.dungeon')),
      bottomNav(0, (i) => navigate(['town', 'character', 'inventory', 'skills'][i] as never)));
  }

  afterShow(): void {
    tutorial.onTown();
  }

  private step(label: string, enabled: boolean, delta: number): HTMLElement {
    const b = button(label, () => {
      S.selectFloor(S.data!.SelectedFloor + delta);
      router.rebuild();
    }, 'ghost');
    b.style.width = '56px';
    b.disabled = !enabled;
    return b;
  }

  private enterDungeon(): void {
    if (S.c.Inventory.Items.length >= S.c.Inventory.Capacity) toast('가방이 가득 차 있어 전리품을 주울 수 없습니다');
    S.enterDungeon();
    goToCurrent();
  }
}

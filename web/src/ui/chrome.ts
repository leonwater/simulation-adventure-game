import { expProgress, maxHp } from '../core/character';
import type { Character } from '../core/character';
import type { Job } from '../core/enums';
import { jobData } from '../core/jobs';
import { goldCompact } from '../core/names';
import { alerts } from './alerts';
import { assetUrl, button, h, icon, progress, row } from './kit';
import { openSettings } from './settings-panel';
import { jobIcon, rankIcon } from './theme';


/** 직업 아이콘 + 글자 (직업이 나오는 곳마다). */
export function jobLine(job: Job, text: string, size = 13, color = 'var(--sub)'): HTMLElement {
  return h('span', { class: 'row', style: { gap: '4px', color, fontSize: `${size}px` } }, icon(jobIcon(job), Math.round(size * 1.3), color), text);
}

/** 위쪽 막대: 왼쪽 뒤로 버튼 · 가운데 제목 · 오른쪽 글자. */
export function topBar(title: string, backLabel: string, onBack: () => void, right = ''): HTMLElement {
  return h('div', { class: 'bar' },
    h('div', { style: { width: '90px' } }, button(backLabel, onBack, 'ghost', 'sm')),
    h('div', { class: 'grow center title' }, title),
    h('div', { class: 'sub', style: { width: '90px', textAlign: 'right' } }, right),
  );
}

export function goldAndSettings(c: Character): HTMLElement {
  return row(
    icon('gold', 18),
    h('span', { style: { whiteSpace: 'nowrap' } }, goldCompact(c.Gold)),
    h('button', { class: 'gear', on: { click: () => openSettings() } }, icon('settings', 22)),
  );
}

/** 마을 머리줄: 이름 · 직업 · 등급 배지 / Lv. · 경험치 막대 · 오른쪽 골드 + 설정. */
export function townHeader(c: Character): HTMLElement {
  return h('div', { class: 'header' },
    h('div', { class: 'col grow', style: { gap: '4px' } },
      row(h('b', { style: { fontSize: '15px' } }, c.Name), jobLine(c.Job, jobData(c.Job).name, 12), icon(rankIcon(c.Rank), 22)),
      row(h('b', { style: { fontSize: '12px' } }, `Lv.${c.Level}`), progress(expProgress(c), 'var(--blue)', 104)),
    ),
    goldAndSettings(c),
  );
}

const NAV = ['nav_town', 'nav_character', 'nav_bag', 'nav_skill'];

/** 마을 계열 하단 메뉴. 0 마을 · 1 캐릭터 · 2 가방 · 3 스킬 */
export function bottomNav(active: number, go: (index: number) => void): HTMLElement {
  return h('div', { class: 'nav' }, ...NAV.map((name, i) =>
    h('button', { class: i === active ? 'on' : '', on: { click: () => go(i) } },
      icon(name, 28, i === active ? 'var(--gold)' : 'var(--sub)'), i !== active && alerts.nav(i) ? h('span', { class: 'dot' }) : null)));
}

/** 일러스트 + 아래쪽 대사 상자. */
export function npcIllustration(name: string, npcName: string, line: string, height = 290): HTMLElement {
  return h('div', { class: 'illust', style: { height: `${height}px`, backgroundImage: `url(${assetUrl(`illustrations/${name}.jpg`)})` } },
    h('div', { class: 'shade' }),
    line ? h('div', { class: 'dialogue' }, h('span', { class: 'name' }, npcName), line) : null);
}


/** 마을 쪽 화면 머리줄: 왼쪽 뒤로 · 가운데 제목 · 오른쪽 골드 + 설정 버튼 (던전 밖 모든 화면 공통). */
export function townBar(title: string, backLabel: string, onBack: (() => void) | null, c: Character): HTMLElement {
  return h('div', { class: 'bar' },
    h('div', { style: { width: '130px' } }, onBack ? h('button', { 'data-anchor': 'topbar.back', style: { border: '0', background: 'transparent', color: 'var(--gold)', padding: '0', textAlign: 'left', fontSize: '14px' }, on: { click: onBack } }, `‹ ${backLabel}`) : null),
    h('div', { class: 'grow center title', style: { fontSize: '16px' } }, title),
    h('div', { style: { width: '130px', display: 'flex', justifyContent: 'flex-end' } }, goldAndSettings(c)));
}

/** 머리줄 오른쪽 HP 칸: 하트 아이콘 + 'HP 현재/최대' 글자, 아래에 막대. */
export function hpBlock(hp: number, max: number, showBar = true): HTMLElement {
  return h('div', { class: 'col', style: { width: '110px', gap: '3px', alignItems: 'flex-end', flexShrink: '0' } },
    row(icon('stat_vitality', 14), h('span', { style: { fontSize: '12px', whiteSpace: 'nowrap' } }, `HP ${hp}/${max}`)),
    showBar ? progress(hp / Math.max(1, max), 'var(--red)', 110) : null);
}

export function pauseButton(onPause: () => void): HTMLElement {
  return h('button', { style: { width: '44px', height: '44px', padding: '0', fontWeight: '700', flexShrink: '0' }, on: { click: onPause } }, '‖');
}

/** 던전 계열 머리줄: 제목·부제 + HP + 일시정지. */
export function dungeonHeader(title: string, subText: string | null, c: Character, onPause: (() => void) | null, showHpBar = true): HTMLElement {
  return h('div', { class: 'header', style: { height: '60px', padding: '6px 12px 6px 16px' } },
    h('div', { class: 'col grow', style: { gap: '2px' } }, h('b', { style: { fontSize: '15px' } }, title), subText ? h('div', { class: 'sub' }, subText) : null),
    hpBlock(c.CurrentHp, maxHp(c), showHpBar),
    onPause ? pauseButton(onPause) : null);
}

/** 던전 안 가방 머리줄: 왼쪽 뒤로 · 가운데 제목 · 오른쪽은 던전 화면과 같은 HP + 일시정지. */
export function dungeonSubBar(title: string, backLabel: string, onBack: () => void, c: Character, onPause: () => void): HTMLElement {
  return h('div', { class: 'bar', style: { padding: '6px 12px 6px 16px' } },
    h('div', { style: { width: '70px' } }, h('button', { style: { border: '0', background: 'transparent', color: 'var(--gold)', padding: '0', textAlign: 'left', fontSize: '14px' }, on: { click: onBack } }, `‹ ${backLabel}`)),
    h('div', { class: 'grow center title', style: { fontSize: '16px' } }, title),
    hpBlock(c.CurrentHp, maxHp(c)), pauseButton(onPause));
}

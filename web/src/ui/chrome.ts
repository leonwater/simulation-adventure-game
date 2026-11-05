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
    h('button', { class: 'gear', 'aria-label': '설정', on: { click: () => openSettings() } }, icon('settings', 22)),
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
const NAV_LABEL = ['마을', '캐릭터', '가방', '스킬'];

/** 마을 계열 하단 메뉴. 0 마을 · 1 캐릭터 · 2 가방 · 3 스킬 */
export function bottomNav(active: number, go: (index: number) => void): HTMLElement {
  return h('div', { class: 'nav' }, ...NAV.map((name, i) =>
    h('button', { class: i === active ? 'on' : '', 'aria-label': NAV_LABEL[i], 'aria-current': i === active ? 'page' : undefined, on: { click: () => go(i) } },
      icon(name, 28, i === active ? 'var(--gold)' : 'var(--sub)'), i !== active && alerts.nav(i) ? h('span', { class: 'dot' }) : null)));
}

/** 일러스트 + 아래쪽 대사 상자. */
// 칸 높이는 모든 시설·등록 화면이 220px (app.css). 그림마다 인물 얼굴 높이(그림 높이 대비)·그림 비율(가로/세로)·확대·얼굴 가로 위치를 적어 두면
// router.fitIllust가 얼굴을 대사 상자 위에 맞춘다
const FRAME: Record<string, { face: number; ratio: number; zoom?: number; faceX?: number }> = {
  guild_receptionist: { face: 0.46, ratio: 4 / 3 },
  training: { face: 0.49, ratio: 4 / 3 },
  shop: { face: 0.52, ratio: 2, zoom: 1.2 }, // 2:1 그림은 220px 칸에서 위아래로 옮길 여유가 없어 1.2배 확대해 얼굴을 대사 상자 위로 (1.15배부터 가리지 않음)
  blacksmith: { face: 0.38, ratio: 2, zoom: 1.2, faceX: 0.23 }, // 대장장이가 왼쪽 끝에 있어 1.2배 확대 + 가로로 당겨 이름표에 겹치지 않게
};

export function npcIllustration(name: string, npcName: string, line: string): HTMLElement {
  const f = FRAME[name];
  return h('div', { class: 'illust npc', 'data-face': f?.face, 'data-ratio': f?.ratio, 'data-zoom': f?.zoom, 'data-facex': f?.faceX, style: { backgroundImage: `url(${assetUrl(`illustrations/${name}.webp`)})` } },
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
  return h('button', { style: { width: '44px', height: '44px', padding: '0', flexShrink: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }, 'aria-label': '일시정지', on: { click: onPause } }, icon('pause', 20, 'var(--text)'));
}

/** 던전 계열 머리줄: 제목·부제 + HP + 일시정지. */
/** 던전 화면들의 캐릭터 한 줄: 이름 · 직업 · Lv · 경험치 막대. */
export function charLine(c: Character): HTMLElement {
  return h('div', { class: 'row', style: { gap: '6px', minWidth: '0', fontSize: '12px' } },
    h('b', { style: { fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '96px' } }, c.Name),
    icon(jobIcon(c.Job), 15, 'var(--sub)'),
    h('b', { style: { whiteSpace: 'nowrap' } }, `Lv.${c.Level}`),
    progress(expProgress(c), 'var(--blue)', 56));
}

export function dungeonHeader(title: string, c: Character, onPause: (() => void) | null, showHpBar = true): HTMLElement {
  return h('div', { class: 'header', style: { height: '60px', padding: '6px 12px 6px 16px' } },
    h('div', { class: 'col grow', style: { gap: '4px', minWidth: '0' } }, h('b', { style: { fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, title), charLine(c)),
    hpBlock(c.CurrentHp, maxHp(c), showHpBar),
    onPause ? pauseButton(onPause) : null);
}


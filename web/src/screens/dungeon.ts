import { anchored } from '../ui/coach';
import { tutorial } from '../ui/tutorial';
import { B } from '../core/balance';
import { AllocationDraft, maxHp } from '../core/character';
import * as dungeon from '../core/dungeon';
import type { DungeonRun, MovePad, PadSlot } from '../core/dungeon';
import type { ExploreEffectType } from '../core/explore';
import { effectDescribe, effectName, effectRemaining } from '../core/explore';
import type { Room } from '../core/map';
import { displayType, getRoom } from '../core/map';
import { jobData } from '../core/jobs';
import { themeFor, themeIndex } from '../core/monsters';
import { Names } from '../core/names';
import { dungeonHeader } from '../ui/chrome';
import { showCharacterInfo, showQuests } from '../ui/charinfo';
import { S } from '../ui/game';
import { offerBetterGear } from '../ui/gearoffer';
import { colored } from '../ui/items';
import { button, h, icon, row, sub } from '../ui/kit';
import { confirmBox, flash, modal, toast } from '../ui/overlay';
import { openPauseMenu } from '../ui/pause';
import { potionButton } from '../ui/potion';
import { randomTip } from '../ui/tips';
import { Screen, router } from '../ui/router';
import { statRow } from '../ui/statrow';
import { dungeonTheme } from '../ui/theme';
import { lootLines } from '../core/loot';
import type { RoomNotice } from '../core/loot';
import { goBattle, goEvent, goMerchant, goResult, goToCurrent } from './index';
import { InventoryScreen } from './inventory';

const MAP_W = 334, MAP_H = 204, NODE = 36;
const CLEARED_ROOM = '#2D4A3B';
const PAD_ARROW = { Up: '↑', Left: '←', Right: '→', Down: '↓' } as const;
const PAD_NAME = { Up: '위', Left: '왼쪽', Right: '오른쪽', Down: '아래' } as const;
const ROOM_ICON: Record<string, string> = { Battle: 'room_battle', Boss: 'room_boss', Event: 'room_event', Treasure: 'room_treasure', Rest: 'room_rest', Merchant: 'room_merchant', Return: 'room_return', Start: 'room_start' };

const isBuff = (t: ExploreEffectType): boolean => t === 'Regen' || t === 'Focus' || t === 'DemonPact';

/** 던전 탐험: 층·HP, 테마 색 미니맵(누르면 전체 지도 + 순간이동), 상황 텍스트, 아래 고정 이동 방향키, 층 진입 제목, 전투 뒤 레벨 업 배분, 가방·귀환. */
const showSituation = (run: DungeonRun): boolean => {
  const t = dungeon.currentRoom(run).Type;
  return t === 'Merchant';
};

export class DungeonScreen extends Screen {
  constructor(private levelUp = false) {
    super();
  }

  onBack(): boolean {
    openPauseMenu();
    return true;
  }

  build(): HTMLElement {
    const run = S.run;
    if (!run) {
      queueMicrotask(goToCurrent);
      return h('div');
    }
    const c = S.c;
    const th = dungeonTheme(themeIndex(run.Floor));
    const theme = themeFor(run.Floor);
    const sit = dungeon.situation(run);
    const dock = h('div', { class: 'dock' });
    this.choices(dock, run);
    const canReturn = S.canReturn;
    const ibtn = (name: string, label: string, onClick: () => void, style: 'normal' | 'return' | 'locked' = 'normal'): HTMLElement => {
      const b = h('button', { class: 'ibtn', 'data-anchor': name === 'return' ? 'dungeon.return' : undefined, style: style === 'return' ? { background: 'var(--return-bg)', borderColor: 'var(--return-border)' } : style === 'locked' ? { background: '#221A1B', borderColor: '#4E3838', color: '#8A6E6C' } : {}, on: { click: onClick } },
        icon(name, 26, style === 'locked' ? '#8A6E6C' : undefined), label);
      return b;
    };
    const page = h('div', { class: 'page', style: { background: th.bg } },
      dungeonHeader(`${run.Floor}층 · ${theme.Name}`, c, () => openPauseMenu()),
      h('div', { class: 'scroll', style: { gap: '12px' } },
        ...(run.Effects.length > 0 ? this.effectTags(run) : []),
        this.miniMap(run),
        // 가운데 칸: 방 결과 → 상인 방 설명 → 없으면 TIP! (칸 테두리는 늘 보인다)
        S.notice ? this.noticeCard(S.notice) : showSituation(run)
          ? h('div', { class: 'card', style: { gap: '4px', padding: '10px 14px', minHeight: '76px' } }, h('b', { class: 'sub' }, sit.title), h('div', { class: 'body' }, sit.text))
          : this.tipCard(run)),
      dock,
      h('div', { class: 'bottombar' },
        ibtn('bag', '가방', () => { if (!tutorial.blocks('가방')) router.show(new InventoryScreen(true)); }),
        ibtn('character', '정보', () => showCharacterInfo()),
        ibtn('quest', '퀘스트', () => showQuests()),
        ibtn('return', '귀환', canReturn ? () => this.confirmReturn() : () => toast('아직 귀환 방을 찾지 못했습니다. 귀환 방이나 보스를 찾아보세요.'), canReturn ? 'return' : 'locked')),
      run.FloorIntroPending ? this.floorIntro(run) : null,
      dungeon.currentRoom(run).Type === 'Boss' && run.BossDefeated ? this.bossChoice(run) : null);
    if (!run.FloorIntroPending) queueMicrotask(() => this.afterIntro());
    return page;
  }

  afterShow(): void {
    // 방에서 얻은 장비가 지금 장비보다 좋으면 바로 착용할지 묻는다
    const run = S.run;
    if (S.notice?.Loot && run && !run.FloorIntroPending) offerBetterGear(S.notice.Loot.Items, () => router.rebuild());
    if (run && !run.FloorIntroPending && !this.levelUp) tutorial.onDungeon();
  }

  /** 층에 들어오면 1초 정도 큰 제목을 보여 준다. */
  private floorIntro(run: DungeonRun): HTMLElement {
    run.FloorIntroPending = false;
    S.save();
    const el = h('div', { class: 'intro' },
      h('div', { style: { fontSize: '44px', color: 'var(--gold)' } }, `${run.Floor}층`),
      h('div', { style: { fontSize: '16px', color: dungeonTheme(themeIndex(run.Floor)).accent } }, themeFor(run.Floor).Name + (run.IsTutorial ? ' · 연습' : '')));
    window.setTimeout(() => {
      el.remove();
      this.afterIntro();
    }, 1300);
    return el;
  }

  private afterIntro(): void {
    if (!S.run) return;
    if (this.levelUp) {
      this.levelUp = false;
      if (S.c.UnspentPoints > 0) this.levelUpAllocation(new AllocationDraft(S.c));
    } else tutorial.onDungeon();
  }

  // ── 레벨 업 배분: 자동 배분 · 확정 · 나중에 ──

  private levelUpAllocation(draft: AllocationDraft): void {
    const c = S.c;
    const m = modal(`레벨 업! Lv.${c.Level}`, false);
    window.setTimeout(() => tutorial.onLevelUp(), 0);
    const redraw = (): void => {
      m.close();
      this.levelUpAllocation(draft);
    };
    const stats = jobData(c.Job).allocatable;
    m.body.append(h('div', null, '포인트 ', colored(String(draft.remaining), 'var(--gold)')),
      ...stats.map((st, i) => statRow(draft, st, i < stats.length - 1, redraw)));
    const auto = anchored(button('자동 배분', () => {
      draft.auto();
      redraw();
    }, '', 'grow'), 'levelup.auto');
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
    m.body.append(row(button('나중에', () => {
      m.close();
      toast('포인트는 마을 캐릭터 화면에서도 배분할 수 있습니다');
    }, 'ghost', 'grow'), auto, ok));
  }

  // ── 아래 고정 칸 ──

  private choices(dock: HTMLElement, run: DungeonRun): void {
    const room = dungeon.currentRoom(run);
    // 방 안에서 하는 행동은 보라색. 귀환 방은 선택지 없이 글자만 보여 주고, 귀환은 아래 귀환 버튼으로 한다.
    if (room.Type === 'Merchant') {
      dock.append(this.bigButton('action', '상인과 거래한다', room.MerchantDiscount ? '은인 할인 · 마을보다 30% 쌈' : '물약 · 가끔 장비와 스킬서', () => goMerchant(), '›'));
    }
    const pad = dungeon.movePad(run, S.difficulty);
    dock.append(this.padView(run, pad));
    for (const r of pad.Extra) {
      if (r.Visited) dock.append(this.bigButton('visited', '지름길로 돌아간다', `${Names.room(r.Type)} · 탐험함`, () => this.move(r.Id)));
      else dock.append(this.bigButton('new', '지름길로 간다', r.Chain ? '무언가 기다리고 있다 (!)' : '지름길', () => this.move(r.Id)));
    }
  }

  private bigButton(kind: 'descend' | 'return' | 'action' | 'visited' | 'new', title: string, subText: string, onClick: () => void, right?: string): HTMLElement {
    const sty = {
      descend: ['var(--descend-bg)', 'var(--descend-border)', 'var(--descend-text)', 'var(--descend-sub)'],
      return: ['var(--return-bg)', 'var(--return-border)', 'var(--return-text)', 'var(--return-sub)'],
      action: ['var(--action-bg)', 'var(--action-border)', 'var(--action-text)', 'var(--action-sub)'],
      visited: ['var(--blue-bg)', 'var(--blue-border)', 'var(--blue-light)', '#7FA8D8'],
      new: ['var(--accent-bg)', 'var(--accent)', 'var(--text)', 'var(--gold)'],
    }[kind];
    return h('button', { class: 'choice', style: { background: sty[0], borderColor: sty[1], color: sty[2], flexDirection: right ? 'row' : 'column', alignItems: right ? 'center' : 'flex-start', minHeight: '60px' }, on: { click: onClick } },
      h('div', { class: 'col grow', style: { gap: '2px', alignItems: 'flex-start' } }, h('span', { class: 't' }, title), subText ? h('span', { class: 's', style: { color: sty[3] } }, subText) : null),
      right ? h('span', { style: { color: sty[3] } }, right) : null,
      kind === 'new' ? h('i', { class: 'glow' }) : null);
  }

  // ── 이동 패드: 위 · 왼쪽 · 오른쪽 · 아래 칸은 늘 같은 자리·같은 크기, 상태는 색과 글자로만 ──

  private padView(run: DungeonRun, pad: MovePad): HTMLElement {
    const open = dungeon.canLeave(run);
    // 키보드 방향키 배치: 위 칸은 가운데, 아래 줄에 ← ↓ →
    const place: Record<string, string> = { Up: '1 / 2', Left: '2 / 1', Down: '2 / 2', Right: '2 / 3' };
    return h('div', { class: 'pad' }, ...pad.Slots.map((slot) => this.padCell(slot, open, place[slot.Dir])), this.potionButton());
  }

  /** 방향키 오른쪽 위 빈칸: 물약 버튼 (종류가 여러 개면 고르는 팝업). */
  private potionButton(): HTMLElement {
    return potionButton((item) => {
      const r = S.useConsumable(item.Uid);
      if (!r.ok) return toast(r.message);
      flash(r.message, 'var(--green)');
      router.rebuild();
    }, 'potion', { gridArea: '1 / 3' });
  }

  /** 방향 칸: 색으로만 상태를 보인다 (금색 새 방 · 파랑 탐험함 · 초록 귀환 · 빨강 보스 · 어두움 막힘). */
  private padCell(slot: PadSlot, open: boolean, area: string): HTMLElement {
    const room = slot.Room;
    const title = `${PAD_ARROW[slot.Dir]} ${PAD_NAME[slot.Dir]}`;
    let fill: string, border: string, text: string;
    let glow = false;
    if (!room || !open) {
      fill = '#1B1813'; border = '#3A3326'; text = '#6E675A';
    } else {
      const shown = displayType(room);
      const special = slot.Known && (shown === 'Return' || shown === 'Boss');
      if (special && shown === 'Return') {
        fill = 'var(--return-bg)'; border = 'var(--return-border)'; text = 'var(--return-text)';
      } else if (special) {
        fill = 'var(--red-bg)'; border = 'var(--red)'; text = 'var(--red-light)';
      } else if (room.Visited) {
        fill = 'var(--blue-bg)'; border = 'var(--blue-border)'; text = 'var(--blue-light)';
      } else {
        fill = 'var(--accent-bg)'; border = 'var(--accent)'; text = 'var(--text)';
        glow = true;
      }
    }
    const kids = [h('span', { class: 't', style: { color: text } }, title), glow ? h('i', { class: 'glow' }) : null];
    const style = { gridArea: area, background: fill, border: `2px solid ${border}` };
    if (room && open) {
      const btn = h('button', { style, on: { click: () => this.move(room.Id) } }, ...kids);
      if (glow) btn.dataset.anchor = 'dungeon.choice0';
      return btn;
    }
    return h('div', { style }, ...kids);
  }

  // ── 방 결과 · 효과 태그 ──

  private tip = '';
  private tipRoom = -1;

  /** 팁 칸: 방이 바뀔 때마다 새 팁 하나 (같은 방에서 다시 그려도 그대로). */
  private tipCard(run: DungeonRun): HTMLElement {
    if (this.tipRoom !== run.CurrentRoomId || !this.tip) {
      this.tipRoom = run.CurrentRoomId;
      this.tip = randomTip();
    }
    return h('div', { class: 'card', style: { gap: '4px', padding: '10px 14px', minHeight: '76px', justifyContent: 'center' } }, h('b', { class: 'gold', style: { fontSize: '15px' } }, 'TIP!'), h('div', { class: 'body' }, this.tip));
  }

  private noticeCard(n: RoomNotice): HTMLElement {
    return h('div', { class: 'card', style: { borderColor: 'var(--btn-border)', gap: '4px', padding: '12px 14px' } },
      h('b', { style: { fontSize: '17px' } }, n.Title),
      ...n.Lines.map((l) => h('div', { style: { fontSize: '15px', lineHeight: '1.25' } }, l)),
      // 보상은 한 덩어리로 이어 써서 칸이 길어지지 않게
      lootLines(n).length > 0 ? h('div', { style: { fontSize: '14px', lineHeight: '1.4' } }, lootLines(n).join(' · ')) : null);
  }

  private effectTags(run: DungeonRun): HTMLElement[] {
    const rows: HTMLElement[] = [];
    run.Effects.forEach((fx, i) => {
      if (i % 2 === 0) rows.push(h('div', { class: 'row', style: { gap: '6px', height: '28px' } }));
      const buff = isBuff(fx.Type);
      rows[rows.length - 1].append(h('button', { class: 'etag', style: { background: buff ? 'var(--blue-bg)' : 'var(--red-bg)', borderColor: buff ? 'var(--blue-border)' : 'var(--red-border)', color: buff ? 'var(--blue-light)' : 'var(--red-light)' }, on: { click: () => this.effectInfo(run) } }, `${effectName(fx.Type)} · ${effectRemaining(fx)}`));
    });
    return rows;
  }

  private effectInfo(run: DungeonRun): void {
    const m = modal('탐험 효과');
    m.body.append(sub('이벤트에서 얻은 효과입니다. 마을로 돌아가면 모두 사라집니다.'));
    for (const e of run.Effects) {
      const buff = isBuff(e.Type);
      m.body.append(h('div', { class: 'card', style: { background: buff ? 'var(--blue-bg)' : 'var(--red-bg)', borderColor: buff ? 'var(--blue-border)' : 'var(--red-border)', gap: '4px' } },
        h('b', { style: { color: buff ? 'var(--blue-light)' : 'var(--red-light)' } }, `${effectName(e.Type)} · ${effectRemaining(e)}`), h('div', { class: 'body', style: { fontSize: '13px' } }, effectDescribe(e.Type))));
    }
  }

  // ── 미니맵 ──

  private discovered(run: DungeonRun): Room[] {
    const set = new Set<number>();
    for (const r of run.Map.Rooms) {
      if (r.Revealed) set.add(r.Id); // 이벤트로 공개된 방
      if (!r.Visited) continue;
      set.add(r.Id);
      r.Links.forEach((l) => set.add(l));
    }
    return [...set].map((id) => getRoom(run.Map, id)!);
  }

  private miniMap(run: DungeonRun): HTMLElement {
    const th = dungeonTheme(themeIndex(run.Floor));
    const canTeleport = dungeon.teleportTargets(run).length > 0 && dungeon.canLeave(run);
    // 화면 폭·높이에 맞춰 미니맵 크기를 정한다 (작은 폰에서 틀 밖으로 나가거나 아래 칸을 밀어내지 않게)
    const scr = document.querySelector<HTMLElement>('.screen');
    const w = Math.min(MAP_W, (scr?.clientWidth ?? 390) - 58);
    const hgt = (scr?.clientHeight ?? 844) < 760 ? 150 : MAP_H;
    const map = h('div', { class: 'minimap', style: { width: `${w}px`, height: `${hgt}px` } });
    this.drawMap(map, w, hgt, run, null);
    return h('div', { role: 'button', 'data-anchor': 'dungeon.map', style: { background: '#191C23', border: `1px solid ${th.line}99`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }, on: { click: () => this.fullMap() } },
      map,
      h('div', { class: 'row', style: { gap: '12px', fontSize: '12px', height: '32px' } },
        colored('■ 클리어', 'var(--return-sub)'), colored('■ 현재 위치', 'var(--gold)'), colored('□ 갈 수 있음', 'var(--gold)'), h('span', { class: 'spacer' }),
        h('span', { class: canTeleport ? 'blink' : '', style: { width: '28px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${canTeleport ? 'var(--gold)' : 'var(--btn-border)'}`, borderRadius: '8px', background: '#1A170F' } }, icon('map', 20))));
  }

  /** 전체 지도: 크게 보고, 탐험을 마친 방을 눌러 순간이동. */
  private fullMap(): void {
    const run = S.run!;
    const m = modal(`${run.Floor}층 지도`);
    const can = dungeon.canLeave(run);
    const scr = document.querySelector<HTMLElement>('.screen');
    const w = Math.min(326, (scr?.clientWidth ?? 390) - 66), hh = Math.min(420, Math.round((scr?.clientHeight ?? 844) * 0.5));
    const map = h('div', { class: 'minimap', style: { width: `${w}px`, height: `${hh}px` } });
    this.drawMap(map, w - 8, hh - 8, run, can ? (room) => {
      m.close();
      if (S.teleport(room.Id)) router.rebuild();
    } : null);
    m.body.append(sub(can ? '탐험을 마친 방을 누르면 그곳으로 순간이동합니다.' : '지금 방을 끝내야 이동할 수 있습니다.'),
      h('div', { style: { background: '#191C23', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '4px' } }, map),
      h('div', { class: 'row', style: { gap: '12px', fontSize: '12px' } }, colored('■ 클리어', 'var(--return-sub)'), colored('■ 현재 위치', 'var(--gold)'), colored('□ 갈 수 있음', 'var(--gold)')));
  }

  private drawMap(area: HTMLElement, mapW: number, mapH: number, run: DungeonRun, onTeleport: ((r: Room) => void) | null): void {
    const rooms = this.discovered(run);
    const xs = rooms.map((r) => r.X), ys = rooms.map((r) => r.Y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const cols = maxX - minX, rows = maxY - minY;
    const maxNode = onTeleport || mapH > MAP_H ? 52 : NODE;
    const maxStep = maxNode * 2;
    // 방이 많아 칸이 좁아지면 방 크기를 줄인다.
    const cell = Math.min(maxStep, Math.min(cols > 0 ? mapW / (cols + 1) : mapW, rows > 0 ? mapH / (rows + 1) : mapH));
    const node = Math.max(14, Math.min(maxNode, cell * 0.62));
    const sx = cols === 0 ? 0 : Math.min(maxStep, (mapW - node) / cols);
    const sy = rows === 0 ? 0 : Math.min(maxStep * 0.9, (mapH - node) / rows);
    const ox = (mapW - cols * sx - node) / 2, oy = (mapH - rows * sy - node) / 2;
    const pos = (r: Room): [number, number] => [ox + (r.X - minX) * sx, oy + (r.Y - minY) * sy];
    const cur = dungeon.currentRoom(run);
    const shown = new Set(rooms.map((r) => r.Id));
    const line = dungeonTheme(themeIndex(run.Floor)).line;
    const canLeave = dungeon.canLeave(run);
    // 연결선
    for (const r of rooms) {
      for (const l of r.Links) {
        if (l < r.Id || !shown.has(l)) continue;
        const o = getRoom(run.Map, l)!;
        const revealedOnly = !r.Visited && !o.Visited;
        if (revealedOnly && !(r.Revealed && o.Revealed)) continue;
        const next = (r.Id === cur.Id && !o.Visited) || (o.Id === cur.Id && !r.Visited);
        this.edge(area, pos(r), pos(o), node, next && canLeave, revealedOnly ? `${line}73` : line);
      }
    }
    // 방
    const easy = S.difficulty === 'Easy';
    for (const r of rooms) {
      const isCur = r.Id === cur.Id;
      const next = !r.Visited && cur.Links.includes(r.Id) && canLeave;
      const known = r.Visited || easy || r.Revealed;
      const chain = r.Chain && !r.Visited;
      // 클리어한 방은 초록빛, 들어갔지만 끝내지 못한 방(도망친 전투)은 회색
      const fill = isCur ? 'var(--accent)' : r.Visited && r.Cleared ? CLEARED_ROOM : r.Visited ? '#2A2E38' : '#191C23';
      const border = isCur ? 'var(--accent)' : next ? 'var(--gold)' : chain ? '#E2B657B3' : r.Visited ? line : '#4A5060';
      const tint = isCur ? 'var(--on-accent)' : next ? 'var(--gold)' : r.Visited ? 'var(--text)' : 'var(--sub)';
      const [x, y] = pos(r);
      const tappable = !!onTeleport && !isCur && r.Visited && r.Cleared;
      const el = h(tappable ? 'button' : 'div', {
        class: `mnode ${next ? 'blink' : ''}`,
        style: { left: `${x}px`, top: `${y}px`, width: `${node}px`, height: `${node}px`, background: fill, borderColor: border, borderWidth: next ? '2px' : '1px', opacity: !r.Visited && !next && r.Revealed ? '.6' : '1', color: tint },
      });
      if (tappable) el.addEventListener('click', (e) => { e.stopPropagation(); onTeleport!(r); });
      if (chain) el.append(h('b', { style: { color: 'var(--gold)', fontSize: `${node < 22 ? 10 : node < 28 ? 12 : node < 44 ? 15 : 18}px` } }, '!'));
      else if (known) el.append(icon(ROOM_ICON[displayType(r)] ?? 'room_start', Math.round(node * 0.62), tint));
      else el.append(h('b', { style: { fontSize: `${node < 22 ? 9 : node < 28 ? 11 : node < 44 ? 13 : 15}px` } }, '?'));
      area.append(el);
    }
  }

  private edge(area: HTMLElement, a: [number, number], b: [number, number], node: number, next: boolean, line: string): void {
    const half = node / 2;
    const ca = [a[0] + half, a[1] + half], cb = [b[0] + half, b[1] + half];
    const color = next ? 'var(--gold)' : line;
    const el = h('i', { class: `medge ${next ? 'blink' : ''}`, style: { '--edge': color } });
    const horizontal = Math.abs(ca[1] - cb[1]) < 0.5;
    if (!horizontal && Math.abs(ca[0] - cb[0]) >= 0.5) {
      // 지름길(개구멍)처럼 비스듬한 연결은 기울인 선으로
      const mx = (ca[0] + cb[0]) / 2, my = (ca[1] + cb[1]) / 2, dx = cb[0] - ca[0], dy = cb[1] - ca[1];
      const len = Math.hypot(dx, dy);
      Object.assign(el.style, { left: `${mx - len / 2}px`, top: `${my - 1}px`, width: `${len}px`, height: '2px', transform: `rotate(${Math.atan2(dy, dx)}rad)` });
    } else if (horizontal) {
      Object.assign(el.style, { left: `${Math.min(ca[0], cb[0])}px`, top: `${ca[1] - 1}px`, width: `${Math.abs(ca[0] - cb[0])}px`, height: '2px' });
    } else {
      Object.assign(el.style, { left: `${ca[0] - 1}px`, top: `${Math.min(ca[1], cb[1])}px`, width: '2px', height: `${Math.abs(ca[1] - cb[1])}px` });
    }
    area.append(el);
  }

  // ── 행동 ──

  private move(roomId: number): void {
    const result = S.move(roomId);
    switch (result) {
      case 'Battle':
      case 'Boss':
        return goBattle();
      case 'Event':
        return goEvent();
      case 'Merchant':
        return goMerchant();
      default:
        if (S.lastLoot && S.lastLoot.LevelsGained > 0) this.levelUp = true;
        router.rebuild();
    }
  }

  /** 보스를 잡으면 화면을 어둡게 덮고 '마을 귀환 / 다음 층 탐험' 둘 중 하나만 고른다 (다른 버튼은 눌리지 않는다). */
  private bossChoice(run: DungeonRun): HTMLElement {
    const last = run.Floor >= B.MaxFloor;
    const card = h('div', { class: 'card', style: { width: '100%', gap: '10px', padding: '18px 16px', background: 'var(--dialog)', borderColor: 'var(--gold)' } },
      h('b', { class: 'gold center', style: { fontSize: '20px', textAlign: 'center' } }, last ? '던전 정복!' : '보스 처치'),
      S.canDescend ? this.bigButton('descend', `${run.Floor + 1}층 탐험`, `${themeFor(run.Floor + 1).Name} · 현재 HP 유지`, () => this.descend()) : null,
      anchored(this.bigButton('return', '마을 귀환', '획득한 것은 모두 유지', () => this.returnNow()), 'dungeon.home'));
    return h('div', { class: 'bosschoice', style: { position: 'absolute', inset: '0', zIndex: '30', background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' } }, card);
  }

  private confirmReturn(): void {
    const run = S.run!;
    const msg = run.BossDefeated
      ? run.Floor >= B.MaxFloor ? '던전을 정복했습니다. 마을로 돌아갑니다.' : `마을로 돌아갑니다. ${run.Floor + 1}층이 열려 있습니다.`
      : '귀환 마법진으로 마을에 돌아갑니다. 이번 층 진행은 초기화되지만 얻은 골드·경험치·아이템은 유지됩니다.';
    confirmBox('마을로 귀환', msg, '귀환', () => this.returnNow());
  }

  private returnNow(): void {
    S.returnToTown();
    goResult('Return');
  }

  private descend(): void {
    S.descend();
    router.rebuild(); // 층 진입 제목이 뜬다
  }
}

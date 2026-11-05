import type { LootReport } from '../core/loot';
import { lootLines, roomNotice } from '../core/loot';
import type { TutorialStage } from '../core/save';
import { josa } from '../core/names';
import { goToCurrent } from '../screens';
import { coach } from './coach';
import { S } from './game';
import { button, h, row } from './kit';
import { modal, toast } from './overlay';
import { router } from './router';
import { settings } from './settings';

/**
 * 직접 해 보며 배우는 튜토리얼. 화면의 한 곳을 밝게 남기고(코치 마크) 말풍선으로 설명한다. 말풍선은 화면마다 한두 개, 짧게.
 * - 마을: 상점 → 길드 → 대장간 → 수련장을 한 번씩 들어가 한 줄 설명을 보고 돌아온다. 마지막에 던전 입장.
 * - 0층 던전: 미니맵 → 길 고르기 → 전투(선택지 → 전투 방식 → 공격) → 보스를 잡으면 귀환 (아래층으로는 못 감). 내 공격은 100% 명중.
 * - 귀환 후: 정산 → 길드 창고 → 끝. 건너뛰면 클리어 보상을 팝업으로 알려 준다.
 * 본 설명은 TipsShown에 남아 다시 켜도 이어서 진행한다. 이 기기에서 튜토리얼을 처음 끝까지 하는 동안에는 건너뛰기가 없고,
 * 한 번 마친 뒤로는 화면 오른쪽 위 "건너뛰기"로 끝낼 수 있다. 튜토리얼 중에는 안내한 곳과 건너뛰기만 눌리고,
 * 첫 던전에서는 안내하지 않은 가방·도주·타이틀로 가기를 잠근다.
 */
const stage = (): TutorialStage => (S.hasGame ? S.data!.Tutorial : 'Done');
const skipButton = (): (() => void) | null => (settings.tutorialCompleted ? skip : null);

export const tutorial = {
  /** 튜토리얼 중인지 (마을 안내·첫 던전·귀환 후 안내). */
  get running(): boolean {
    return stage() !== 'Done';
  },
  /** 튜토리얼에서 아직 안내하지 않은 행동이면 막고 알린다 (막았으면 true). */
  blocks(what: string): boolean {
    if (!tutorial.running) return false;
    toast(`튜토리얼이 끝나면 ${josa(what, '을/를')} 쓸 수 있어요`);
    return true;
  },
  onTown,
  onFacility,
  onGuild,
  onDungeon,
  onBattle,
  onBossIntent,
  onResult,
};

function finish(): void {
  settings.tutorialCompleted = true;
  S.setTutorial('Done');
}

// 말풍선 강조: 중요한 말은 금색, 좋음 초록, 나쁨 빨강
const H = (t: string): string => `<span style="color:var(--gold)">${t}</span>`;
const good = (t: string): string => `<span style="color:var(--green)">${t}</span>`;
const bad = (t: string): string => `<span style="color:var(--red-light)">${t}</span>`;

interface Step {
  key: string;
  anchor: string | null;
  title: string;
  text: string;
}
const info = (key: string, anchor: string | null, title: string, text: string): Step => ({ key, anchor, title, text });

/** 아직 보지 않은 설명을 차례로 보여 주고, 모두 봤으면 done을 부른다. */
function run(steps: Step[], done: (() => void) | null): void {
  for (const st of steps) {
    if (S.tipShown(st.key)) continue;
    coach.info(st.anchor, st.title, st.text, () => {
      S.markTip(st.key);
      run(steps, done);
    }, skipButton());
    return;
  }
  done?.();
}

/** 가리킨 곳을 플레이어가 직접 누르게 한다. title: 말풍선 위 노란 주제. */
function doIt(anchor: string, title: string, text: string): void {
  // 열린 팝업이 가리킨 곳을 덮으면 누를 수 없으므로 먼저 닫는다
  router.layer.querySelectorAll('.dim').forEach((e) => e.remove());
  coach.action(anchor, title, text, skipButton());
}

let skipDim: HTMLElement | null = null;
/** 건너뛰기 확인 창: 말풍선(코치)보다 위에 띄워 창 밖은 아무것도 눌리지 않게 하고, 빠르게 두 번 눌러도 한 번만 연다. */
function skip(): void {
  if (skipDim?.isConnected) return;
  const m = modal('튜토리얼 건너뛰기', false);
  const dim = m.body.parentElement as HTMLElement;
  dim.style.zIndex = '90';
  skipDim = dim;
  const close = (): void => {
    skipDim = null;
    m.close();
  };
  m.body.append(
    h('div', { class: 'body', style: { whiteSpace: 'pre-line', lineHeight: '1.5' } }, '튜토리얼을 끝낼까요? 설정에서 언제든 다시 볼 수 있습니다.'),
    row(button('계속 보기', close, 'ghost', 'grow'), button('건너뛰기', () => {
      close();
      coach.clear();
      const reward = S.skipTutorial();
      goToCurrent();
      if (reward) showReward(reward);
    }, 'primary', 'grow')));
}

/** 건너뛰어도 클리어한 사람과 같은 보상을 받았다고 알린다. */
function showReward(reward: LootReport): void {
  const m = modal('튜토리얼 보상');
  m.body.append(
    h('div', { class: 'body' }, '튜토리얼을 건너뛰어 클리어 보상을 받았습니다.'),
    h('div', { class: 'card', style: { gap: '6px', padding: '12px 14px' } }, ...lootLines(roomNotice('', reward)).map((l) => h('b', null, l))),
    button('확인', m.close, 'primary'));
}

// ── 마을 ──

const FACILITIES = ['shop', 'guild', 'blacksmith', 'training'];
const FACILITY_NAMES = ['상점', '길드', '대장간', '수련장'];

function onTown(): void {
  if (stage() === 'TownGuide') {
    run([info('town.intro', null, '라브 마을', `${H('라브 마을')}이에요. 시설을 하나씩 짧게 둘러볼게요.`)], () => {
      for (let i = 0; i < FACILITIES.length; i++) {
        if (S.tipShown(`${FACILITIES[i]}.done`)) continue;
        doIt(`town.${FACILITIES[i]}`, FACILITY_NAMES[i], `${H(josa(FACILITY_NAMES[i], '을/를'))} 눌러 들어가 보세요.`);
        return;
      }
      doIt('town.dungeon', '던전 입장', `${H("'던전 입장'")}을 눌러 ${H('0층')} 튜토리얼 던전으로 떠나 보세요.`);
    });
  } else if (stage() === 'AfterReturn') doIt('town.guild', '길드 창고', `${H('길드')}에 들러 창고를 확인해 봐요.`);
}

/** 시설 화면: 각 부분 설명 → 마을로 돌아가기. */
function onFacility(facility: string): void {
  if (stage() !== 'TownGuide') return;
  const steps: Record<string, Step> = {
    shop: info('shop.1', 'shop.equip', '상점', `장비·물약·스킬서를 사고 ${H("'판매'")} 탭에서 팔아요. 이름 색은 ${H('등급')}, 아래 줄은 지금 장비보다 ${good('좋으면 초록')}이에요.`),
    guild: info('guild.1', 'guild.list', '길드', `${H('퀘스트')}를 받아 조건을 채우고 보고하면 보상을 받아요. 조건을 채우면 ${good('등급이 자동으로 올라요')}.`),
    blacksmith: info('smith.1', 'smith.detail', '대장간', `장비를 ${H('강화')}해요. 실패해도 장비는 ${good('부서지지 않아요')}. +6부터는 ${H('강화석')}이 필요해요.`),
    training: info('train.1', 'train.list', '수련장', `골드로 스킬을 수련하면 ${good('위력이 올라가요')}. 새 스킬은 ${H('스킬서')}로 배워요.`),
  };
  run([steps[facility]], () => {
    S.markTip(`${facility}.done`);
    doIt('topbar.back', '마을로', `${H("'‹ 마을'")}을 눌러 마을로 돌아가세요.`);
  });
}

/** 길드: 마을 안내 중이면 시설 설명, 귀환 후면 창고 안내로 마무리. */
function onGuild(tab: number): void {
  if (stage() === 'TownGuide') return onFacility('guild');
  if (stage() !== 'AfterReturn') return;
  if (tab !== 2) return doIt('tab.2', '길드 창고', `${H("'창고'")} 탭을 눌러 보세요.`);
  run([
    info('storage.1', 'guild.storage', '길드 창고', `맡긴 아이템은 던전에서 쓰러져도 ${good('잃지 않아요')}. 맡길 때만 ${H('수수료')}가 들어요.`),
    info('storage.2', null, '튜토리얼 끝', `이제 혼자서도 충분해요! 장비를 키워 ${H('던전 최하층')}에 도전해 보세요.`),
  ], finish);
}

// ── 던전 ──

function onDungeon(): void {
  if (stage() !== 'FirstDungeon') return;
  const run0 = S.run;
  // 튜토리얼 보스를 잡으면 아래층으로 가지 않고 마을로 돌아간다
  if (run0 && run0.BossDefeated && document.querySelector('[data-anchor="dungeon.home"]')) {
    return doIt('dungeon.home', '귀환', `튜토리얼 클리어! ${H("'마을로 귀환한다'")}를 눌러 돌아가세요.`);
  }
  run([info('dun.map', 'dungeon.map', '미니맵', `${H('금색')}이 지금 위치예요. 누르면 전체 지도가 열려요.`)], () => {
    if (run0 && run0.Map.Rooms.some((r) => r.Type === 'Return' && r.Visited)) {
      run([info('dun.return', 'dungeon.return', '귀환', `${H('귀환 마법진')}을 찾으면 언제든 마을로 돌아갈 수 있어요. 튜토리얼은 ${H('보스를 잡아야')} 끝나요.`)], null);
      return;
    }
    if (!S.tipShown('dun.go') && document.querySelector('[data-anchor="dungeon.choice0"]')) {
      S.markTip('dun.go');
      doIt('dungeon.choice0', '길 고르기', `${H('방향키')}로 갈 길을 골라요. ${H('금색')}이 새 방이에요.`);
    }
  });
}

/** 전투 방식: 턴제 · 스킬 쿨타임 (마법사만 에너지 볼·마력 폭주). */
function battleTip(): string {
  const mage = S.c.Job === 'Mage' ? `<br>마법사: 기본 공격 ${H('에너지 볼')}도 스킬처럼 쿨타임, 쓸 공격이 없으면 ${bad('마력 폭주')}.` : '';
  return `${H('턴제')}: 나와 적이 한 턴씩.<br>스킬: ${H('쿨타임')}이 있어요.${mage}`;
}

function onBattle(): void {
  // 튜토리얼을 마친 예전 모험가에게도 전투 방식을 한 번 알려 준다
  if (stage() !== 'FirstDungeon') {
    if (S.hasGame && !S.tipShown('tip.v37') && document.querySelector('[data-anchor="battle.choices"]')) coach.info('battle.choices', '전투 방식', battleTip(), () => S.markTip('tip.v37'));
    return;
  }
  run([info('bat.2', 'battle.choices', '전투', `%는 ${H('맞힐 확률')}이에요(튜토리얼은 ${good('100%')}). 선택지를 ${H('길게 누르면')} 자세히 볼 수 있어요.`),
    info('tip.v37', 'battle.choices', '전투 방식', battleTip())], () => {
    if (S.tipShown('bat.3') || !document.querySelector('[data-anchor="battle.choice0"]')) return;
    S.markTip('bat.3');
    const name = S.c.Job === 'Mage' ? '에너지 볼' : '공격';
    doIt('battle.choice0', name, `${H(josa(name, '을/를'))} 골라 보세요!`);
  });
}

/** 보스의 행동 예고를 처음 봤을 때 한 번 (튜토리얼 단계와 관계없이). */
function onBossIntent(): void {
  if (!S.hasGame || S.tipShown('tip.intent') || !document.querySelector('[data-anchor="battle.intent"]')) return;
  coach.info('battle.intent', '보스의 예고', `보스 이름 자리에 ${bad("주황색 '!'")}가 뜨면 다음 턴에 할 큰 행동이에요. ${H('강타 준비')}면 회복해 두고, ${H('회복 주문')}이면 그 전에 몰아쳐 쓰러뜨리세요.`, () => S.markTip('tip.intent'));
}

// ── 귀환 후 ──

function onResult(): void {
  if (stage() !== 'AfterReturn') return;
  run([info('res.1', 'result.panel', '정산', `마을에 돌아오면 ${good('HP가 모두 회복')}돼요. 쓰러지면 ${bad('골드 일부와 가방 속 아이템을 잃어요')}.`)], () => doIt('result.next', '마을로', '마을로 돌아가세요.'));
}

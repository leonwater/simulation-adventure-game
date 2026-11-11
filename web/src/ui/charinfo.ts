import type { Combatant } from '../core/combatant';
import {
  attack, defense, jobPerk, evasion, expProgress, maxHp, percent, resist, skillDamageBonus,
} from '../core/character';
import { describeActive, explainStatus } from '../core/statustext';
import type { StatusType } from '../core/enums';
import { effectDescribe, effectName, effectRemaining } from '../core/explore';
import { isQuestComplete, progressText, questReward } from '../core/guild';
import { jobData, PERKS } from '../core/jobs';
import { gold, Names } from '../core/names';
import type { StatusInstance } from '../core/status';
import { isDebuff } from '../core/status';
import type { Battle } from '../core/battle';
import { openAllocation } from './allocate';
import { jobLine } from './chrome';
import { S } from './game';
import { colored } from './items';
import { button, divider, h, icon, progress, row, sub } from './kit';
import { modal } from './overlay';
import { statIcon } from './statrow';
import { rankIcon } from './theme';

const DEBUFFS: StatusType[] = ['Poison', 'Bleed', 'Burn', 'Weaken', 'Vulnerable', 'Stun', 'Silence', 'Blind', 'Fear'];
const BUFFS: StatusType[] = ['Empower', 'Fortify', 'Regen', 'Focus', 'Swift', 'Keen', 'Cruel'];

const section = (title: string): HTMLElement[] => [divider(), h('b', { class: 'gold', style: { fontSize: '14px' } }, title)];
/** 능력치 두 개를 한 줄에: [아이콘, 이름, 값] × 2 */
type Cell = [string, string, string];
const pair = (...cells: [Cell, Cell]): HTMLElement =>
  row(...cells.map(([ic, k, v]) => h('div', { class: 'row grow', style: { gap: '6px', height: '24px', minWidth: '0', flexBasis: '0' } },
    icon(ic, 16), h('span', { class: 'sub grow nw', style: { fontSize: '13px' } }, k), h('b', { class: 'nw', style: { fontSize: '13px' } }, v))));

export const statusIcon = (t: StatusType): string => `status_${t.toLowerCase()}`;

function statusCards(list: StatusInstance[], max: number): HTMLElement[] {
  return list.map((s) => {
    const bad = isDebuff(s.Type);
    return h('div', { class: 'card', style: { background: bad ? 'var(--red-bg)' : 'var(--blue-bg)', borderColor: bad ? 'var(--red-border)' : 'var(--blue-border)', gap: '2px', padding: '8px 12px' } },
      row(icon(statusIcon(s.Type), 20), h('b', { style: { color: bad ? 'var(--red-light)' : 'var(--blue-light)' } }, `${Names.status(s.Type)} · ${s.Turns >= 99 ? '전투 내내' : `${s.Turns}턴 남음`}`)),
      h('div', { class: 'body', style: { fontSize: '13px' } }, describeActive(s, max)));
  });
}

const glossary = (t: StatusType, debuff: boolean): HTMLElement =>
  h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '8px' } },
    h('div', { class: 'row', style: { width: '72px', gap: '4px', color: debuff ? 'var(--red-light)' : 'var(--blue-light)', fontWeight: '700', fontSize: '13px' } }, icon(statusIcon(t), 18), Names.status(t)),
    h('div', { class: 'body grow', style: { fontSize: '12px' } }, explainStatus(t)));

/** 캐릭터 정보 창 (던전 하단 가운데 버튼 · 전투에서 내 도형): 기본 정보, 전투 능력치, 지금 걸린 상태 이상, 탐험 효과, 상태 이상 안내. */
export function showCharacterInfo(battle: Battle | null = null): void {
  const c = S.c;
  const run = S.run;
  const m = modal('캐릭터 정보');
  const me = battle?.player;
  const max = me?.maxHp ?? maxHp(c);
  const hp = me?.hp ?? c.CurrentHp;
  m.body.append(
    row(icon(rankIcon(c.Rank), 26), jobLine(c.Job, '', 16, 'var(--text)'), h('b', { class: 'grow', style: { fontSize: '16px' } }, `${c.Name} · ${jobData(c.Job).name} Lv.${c.Level}`)),
    h('div', { style: { fontSize: '13px' } }, `HP ${hp}/${max}`),
    progress(hp / Math.max(1, max), 'var(--red)'),
    h('div', { class: 'row sub', style: { gap: '8px' } }, '경험치', h('div', { class: 'grow' }, progress(expProgress(c), 'var(--blue)'))),
    h('div', { class: 'sub' }, `골드 ${gold(c.Gold)}`, c.UnspentPoints > 0 && battle ? colored(` · 포인트 ${c.UnspentPoints}`, 'var(--gold)') : null),
    // 던전에서 레벨 업 배분을 넘겼어도 여기서 다시 배분한다 (전투 중에는 안 됨)
    ...(c.UnspentPoints > 0 && !battle ? [button(`능력치 포인트 ${c.UnspentPoints} · 배분`, () => {
      m.close();
      openAllocation('능력치 배분');
    }, 'outline')] : []),
    ...section('전투 능력치'),
    pair([statIcon(jobData(c.Job).attackStat), '공격력', String(me?.attack ?? attack(c))], ['status_fortify', '방어력', String(defense(c))]),
    pair([statIcon('Agility'), '회피', percent(evasion(c))], [PERKS[c.Job].icon, PERKS[c.Job].name, percent(jobPerk(c))]),
    pair([statIcon('Spirit'), '상태 이상 저항', percent(resist(c))], ['perk_amplify', '스킬 피해', `+${percent(skillDamageBonus(c))}`]),
    ...section('상태 이상'));
  const active = me?.statuses.visible() ?? [];
  if (active.length === 0) m.body.append(sub(battle ? '걸린 상태 이상이 없습니다.' : '전투 밖에서는 상태 이상이 남지 않습니다. 전투가 끝나면 모두 풀립니다.'));
  else m.body.append(...statusCards(active, max));
  if (run) {
    m.body.append(...section('탐험 효과'));
    if (run.Effects.length === 0) m.body.append(sub('없음 · 특수 이벤트에서 얻으면 마을로 돌아갈 때까지 남습니다.'));
    for (const e of run.Effects) {
      const bad = e.Type === 'Fear' || e.Type === 'Curse' || e.Type === 'Drum';
      m.body.append(h('div', { class: 'card', style: { background: bad ? 'var(--red-bg)' : 'var(--blue-bg)', borderColor: bad ? 'var(--red-border)' : 'var(--blue-border)', gap: '2px', padding: '8px 12px' } },
        h('b', { style: { color: bad ? 'var(--red-light)' : 'var(--blue-light)' } }, `${effectName(e.Type)} · ${effectRemaining(e)}`), h('div', { class: 'body', style: { fontSize: '13px' } }, effectDescribe(e.Type))));
    }
  }
  m.body.append(...section('상태 이상 안내'), ...DEBUFFS.map((t) => glossary(t, true)), ...BUFFS.map((t) => glossary(t, false)));
}

/** 진행 중인 퀘스트 (던전 하단 '퀘스트' 버튼). */
export function showQuests(): void {
  const c = S.c;
  const m = modal('진행 중인 퀘스트');
  const quests = S.data!.Guild.Active;
  if (quests.length === 0) {
    m.body.append(sub('받은 퀘스트가 없습니다. 마을의 길드에서 받을 수 있어요.'));
    return;
  }
  for (const q of quests) {
    const done = isQuestComplete(q, c);
    m.body.append(h('div', { class: 'card', style: { background: 'var(--blue-bg)', borderColor: done ? 'var(--accent)' : 'var(--blue-border)', gap: '2px', padding: '8px 12px' } },
      h('b', null, q.Title),
      h('div', { style: { fontSize: '13px', color: done ? 'var(--gold)' : 'var(--body)' } }, `목표 ${q.TargetFloor}층 · ${progressText(q, c)}`, done ? colored(' · 보고 가능', 'var(--gold)') : null),
      h('div', { class: 'sub' }, '보상 ', colored(`${questReward(q, S.c).gold.toLocaleString('en-US')}G`, 'var(--gold)'), ` · 경험치 ${questReward(q, S.c).exp.toLocaleString('en-US')}`)));
  }
}

/** 적 상세 (전투에서 대상을 한 번 더 누르거나 길게 누름). 대상이 아니면 "대상으로 정하기" 버튼. */
export function showEnemyInfo(e: Combatant, isTarget: boolean, makeTarget: () => void): void {
  const role = e.role === 2 ? '보스' : e.role === 1 ? '정예' : '일반';
  const m = modal(e.name);
  const hpText = `HP ${e.hp}/${e.maxHp}`;
  const k = e.kit;
  m.body.append(h('b', { style: { fontSize: '13px', color: e.role === 2 ? 'var(--boss)' : e.role === 1 ? 'var(--gold)' : 'var(--sub)' } }, `${role} 몬스터`),
    h('div', null, hpText, k && k.shield > 0 ? colored(` · 보호막 ${k.shield}`, 'var(--info)') : null, k && k.barrier > 0 ? colored(` · 방어막 ${k.barrier}회`, 'var(--barrier)') : null),
    progress(e.hp / Math.max(1, e.maxHp), 'var(--red)'),
    pair([statIcon('Strength'), '공격력', String(e.attack)], ['status_fortify', '방어력', String(e.defense)]));
  if (k && k.intent) m.body.append(h('b', { style: { fontSize: '13px' } }, '다음 턴 ', colored(k.intent, 'var(--warn)')));
  m.body.append(...section('상태 이상'));
  const list = e.statuses.visible();
  if (list.length === 0) m.body.append(sub('걸린 상태 이상이 없습니다.'));
  else m.body.append(...statusCards(list, e.maxHp));
  if (!isTarget) {
    m.body.append(h('button', { class: 'primary', on: { click: () => {
      m.close();
      makeTarget();
    } } }, '대상으로 정하기'));
  }
}

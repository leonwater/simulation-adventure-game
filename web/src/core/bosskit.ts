import { B, clamp, roundEven } from './balance';
import { Combatant } from './combatant';
import { createEnemy } from './enemies';
import { monster } from './monsters';

export type BossTrait = 'Barrier' | 'Shield' | 'Thorns' | 'Smash' | 'Flurry' | 'Lifesteal' | 'Enrage' | 'Split' | 'Ritual' | 'Revive' | 'Summon';

/** 보스 한 마리의 특성 수치와 전투 중 상태. */
export class BossKit {
  traits: BossTrait[] = [];
  barrier = 0;
  shield = 0;
  maxShield = 0;
  thorns = 0;
  smashEvery = 0;
  smashMult = 0;
  exhaustTurns = 0;
  smashTimer = 0;
  charging = false;
  exhausted = 0;
  flurryHits = 0;
  flurryMult = 0;
  flurryChance = 0;
  lifesteal = 0;
  enrageAttack = 0;
  enraged = false;
  splitCount = 0;
  splitHp = 0;
  ritualAt = 0;
  ritualHeal = 0;
  ritualUses = 0;
  chanting = false;
  reviveHp = 0;
  revives = 0;
  summonId = '';
  summonName = '';
  summonEvery = 0;
  summonMax = 0;
  summonTimer = 0;
  readonly minions: Combatant[] = [];
  /** 다음 턴 행동 예고 (보스 위에 표시). 없으면 빈 문자열. */
  intent = '';

  has(t: BossTrait): boolean {
    return this.traits.includes(t);
  }
}

/** 종족별 우두머리 특성. 고유 보스는 2~3개 조합. */
const BY_SPECIES: Record<string, BossTrait[]> = {
  slime: ['Split'], goblin: ['Enrage'], goblin_archer: ['Flurry'], bat: ['Lifesteal'], kobold: ['Barrier'], spider: ['Summon'], wolf: ['Flurry'],
  goblin_king: ['Smash', 'Summon'],
  orc: ['Smash'], skeleton: ['Barrier'], zombie: ['Revive'], ghoul: ['Lifesteal'], orc_shaman: ['Shield'], gargoyle: ['Barrier'],
  lich: ['Shield', 'Summon', 'Ritual'],
  lizardman: ['Thorns'], wyvern: ['Flurry'], golem: ['Barrier'], troll: ['Ritual'], minotaur: ['Smash'], dark_elf: ['Shield'],
  dragon: ['Enrage', 'Ritual', 'Smash'],
};

/** 부하 소환: 보스 → (졸개 종족, 이름, HP 배율) */
const MINION: Record<string, { id: string; name: string; hp: number }> = {
  spider: { id: 'spider', name: '새끼 거미', hp: 0.6 },
  goblin_king: { id: 'goblin', name: '고블린 졸개', hp: 0.8 },
  lich: { id: 'skeleton', name: '해골 병사', hp: 0.8 },
};

const TRAIT_NAME: Record<BossTrait, string> = {
  Barrier: '방어막', Shield: '보호막', Thorns: '가시 비늘', Smash: '혼신의 일격', Flurry: '연속 공격', Lifesteal: '흡혈',
  Enrage: '광폭화', Split: '분열', Ritual: '재생 의식', Revive: '부활', Summon: '부하 소환',
};
export const traitName = (t: BossTrait): string => TRAIT_NAME[t];

export const traitsFor = (speciesId: string | null | undefined): BossTrait[] => (speciesId ? BY_SPECIES[speciesId] ?? [] : []);

/** 특성별 체격: HP · 공격력 · 방어력 배율. */
const PROFILE: Record<BossTrait, [number, number, number]> = {
  Barrier: [0.8, 1.0, 1.2],
  Shield: [1.0, 0.95, 1.0],
  Thorns: [0.9, 0.95, 1.35],
  Smash: [1.05, 1.25, 0.9],
  Flurry: [0.85, 1.0, 0.8],
  Lifesteal: [0.95, 1.05, 0.9],
  Enrage: [1.1, 0.95, 1.0],
  Split: [0.65, 0.9, 0.8],
  Ritual: [0.9, 0.95, 1.0],
  Revive: [0.8, 1.0, 1.1],
  Summon: [0.9, 0.9, 1.0],
};

/** 보스에게 특성을 붙인다. 수치는 층(1~30)에 따라 커지고, 특성별 체격을 곱한다. */
export function equipBossTraits(boss: Combatant, floor: number): void {
  const traits = traitsFor(boss.species?.Id);
  if (traits.length === 0) return;
  const f = clamp(floor, 1, B.MaxFloor);
  const k = new BossKit();
  k.traits.push(...traits);
  let hpMul = 1, atkMul = 1, defMul = 1, shield = 0;
  for (const t of traits) {
    const [h, a, d] = PROFILE[t];
    hpMul *= h;
    atkMul *= a;
    defMul *= d;
    switch (t) {
      case 'Barrier': k.barrier = 1 + Math.floor((f - 1) / 8); break;
      case 'Shield':
        shield = 0.10 + f * 0.005;
        hpMul *= 1 - shield * 0.6;
        break;
      case 'Thorns': k.thorns = 0.015 + f * 0.0005; break;
      case 'Smash':
        k.smashEvery = f < 15 ? 4 : 3;
        k.smashMult = 2.0 + f * 0.025;
        k.exhaustTurns = f < 15 ? 2 : 1;
        break;
      case 'Flurry':
        k.flurryHits = 3 + Math.floor(f / 12);
        k.flurryMult = 0.38;
        k.flurryChance = 0.35;
        break;
      case 'Lifesteal': k.lifesteal = 0.20 + f * 0.005; break;
      case 'Enrage': k.enrageAttack = 0.20 + f * 0.005; break;
      case 'Split':
        k.splitCount = f < 4 ? 2 : 3;
        k.splitHp = f < 4 ? 0.25 : 0.20;
        break;
      case 'Ritual':
        k.ritualAt = 0.30;
        k.ritualHeal = 0.15 + f * 0.005;
        k.ritualUses = f >= 25 ? 2 : 1;
        break;
      case 'Revive':
        k.reviveHp = 0.20 + f * 0.005;
        k.revives = 1;
        break;
      case 'Summon': {
        const m = MINION[boss.species!.Id];
        if (m) {
          k.summonId = m.id;
          k.summonName = m.name;
        }
        k.summonEvery = 4;
        k.summonMax = f < 10 ? 1 : 2;
        break;
      }
    }
  }
  boss.maxHp = boss.hp = Math.max(1, roundEven(boss.maxHp * hpMul));
  boss.attack = Math.max(1, roundEven(boss.attack * atkMul));
  boss.defense = roundEven(boss.defense * defMul);
  if (shield > 0) k.maxShield = k.shield = Math.max(1, roundEven(boss.maxHp * shield));
  boss.kit = k;
}

const letter = (i: number): string => String.fromCharCode(65 + i);

/** 분열한 작은 개체: 보스 HP의 일부, 공격력 절반, 보상 없음. */
export function splitChild(boss: Combatant, index: number): Combatant {
  const sp = boss.species!;
  const hp = Math.max(1, roundEven(boss.maxHp * boss.kit!.splitHp));
  const c = new Combatant();
  c.name = `작은 ${sp.Name} ${letter(index)}`;
  c.maxHp = c.hp = hp;
  c.attack = Math.max(1, Math.trunc(boss.attack / 2));
  c.defense = Math.trunc(boss.defense / 2);
  c.requirement = boss.requirement - 2;
  c.species = sp;
  c.skills = sp.Skills;
  c.noReward = true;
  return c;
}

/** 졸개: 그 층 일반 몬스터 수치 × HP 배율, 보상 없음. */
export function createMinion(boss: Combatant, floor: number, diff: string, index: number): Combatant {
  const sp = monster(boss.kit!.summonId) ?? boss.species!;
  const m = createEnemy(sp, floor, diff, 0);
  const hpMul = MINION[boss.species!.Id]?.hp ?? 0.8;
  m.maxHp = m.hp = Math.max(1, roundEven(m.maxHp * hpMul));
  m.name = `${boss.kit!.summonName || sp.Name} ${letter(index)}`;
  m.noReward = true;
  return m;
}

import { B } from '../core/balance';
import { getSkillState, isSkillEquipped, maxSkillLevel, trainSkill, trainingCost, trainingEffect } from '../core/equipment';
import { isUtility } from '../core/skills';
import { ord, TIERS } from '../core/enums';
import { Names } from '../core/names';
import { skillDef } from '../core/skills';
import { npcIllustration, townBar } from '../ui/chrome';
import { S } from '../ui/game';
import { colored } from '../ui/items';
import { button, h, sub } from '../ui/kit';
import { toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { tutorial } from '../ui/tutorial';
import { navigate } from './nav';

/** 수련장: 골드를 내고 보유 스킬을 강화 (+5까지, 단계당 위력 하급 +8% ~ 최상급 +15%). */
export class TrainingScreen extends Screen {
  private line = '기술은 반복으로 다듬어지는 법. 어떤 기술을 갈고닦겠나?';

  onBack(): boolean {
    navigate('town');
    return true;
  }

  build(): HTMLElement {
    const c = S.c;
    const rows = c.Skills.Learned.map((st) => {
      const def = skillDef(st.SkillId);
      if (!def) return null;
      const per = Math.round(B.SkillPowerPerLevel[ord(TIERS, def.Tier)] * 100);
      const cost = trainingCost(st);
      const b = button(cost === 0 ? '최대' : `수련 · ${cost.toLocaleString('en-US')}G`, () => this.train(st.SkillId), 'outline', 'sm');
      b.style.width = '104px';
      b.disabled = !(cost > 0 && c.Gold >= cost);
      const next = st.Level < maxSkillLevel(def) ? ` → ${trainingEffect(def, st.Level + 1)}` : '';
      return h('div', { class: 'row', style: { minHeight: '64px', padding: '8px 0', borderBottom: '1px solid var(--line-soft)', gap: '10px' } },
        h('div', { class: 'col grow', style: { gap: '2px' } },
          h('span', { style: { fontSize: '15px' } }, `${def.Name} `, colored(`${Names.tier(def.Tier)} · +${st.Level}/${maxSkillLevel(def)}${isUtility(def) ? '' : ` (단계당 +${per}%)`}`, 'var(--sub)')),
          sub(def.Description + (isSkillEquipped(c, def.Id) ? ' · 장착 중' : '')),
          isUtility(def) ? sub(`지금 ${trainingEffect(def, st.Level)}${next}`) : null),
        b);
    });
    return h('div', { class: 'page' },
      townBar('수련장', '마을', () => navigate('town'), c),
      npcIllustration('training', '수련 교관', this.line, 260),
      h('div', { class: 'scroll', 'data-anchor': 'train.list', style: { gap: '0' } }, ...rows));
  }

  afterShow(): void {
    tutorial.onFacility('training');
  }

  private train(id: string): void {
    const r = trainSkill(S.c, id);
    if (!r.ok) return toast(r.error ?? '');
    this.line = `${skillDef(id)!.Name} 움직임이 한층 날카로워졌군. (+${getSkillState(S.c, id)!.Level})`;
    S.save();
    router.rebuild();
  }
}

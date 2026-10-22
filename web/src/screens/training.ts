import { getSkillState, isSkillEquipped, maxSkillLevel, trainSkill, trainingCost } from '../core/equipment';
import { Names } from '../core/names';
import { areaName, skillDef } from '../core/skills';
import { npcIllustration, townBar } from '../ui/chrome';
import { S } from '../ui/game';
import { button, h, longPress } from '../ui/kit';
import { toast } from '../ui/overlay';
import { Screen, router } from '../ui/router';
import { showSkillDetail } from '../ui/skilldetail';
import { tutorial } from '../ui/tutorial';
import { navigate } from './nav';

/** 수련장: 골드를 내고 보유 스킬을 강화. 한 줄에 이름, 아래 줄에 요약, 자세한 내용은 길게 눌러서. */
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
      const cost = trainingCost(st);
      const b = button(cost === 0 ? '최대' : `수련 · ${cost.toLocaleString('en-US')}G`, () => this.train(st.SkillId), 'outline', 'sm');
      b.style.width = '104px';
      b.disabled = !(cost > 0 && c.Gold >= cost);
      // 이름은 크게, 아래 줄에 등급 · 범위 · 수련 단계 · 장착 중 (자세한 설명은 길게 눌러서)
      const meta = [Names.tier(def.Tier), areaName(def) ?? (def.Target === 'Self' ? '자신' : '단일'), `+${st.Level}/${maxSkillLevel(def)}`, isSkillEquipped(c, def.Id) ? '장착 중' : ''].filter(Boolean).join(' · ');
      const info = h('div', { class: 'col grow', style: { gap: '4px', minWidth: '0' } },
        h('b', { style: { fontSize: '18px' } }, def.Name),
        h('span', { style: { fontSize: '14px', color: 'var(--sub)' } }, meta));
      longPress(info, () => showSkillDetail(def.Id), () => {});
      return h('div', { class: 'row', style: { minHeight: '72px', padding: '8px 0', borderBottom: '1px solid var(--line-soft)', gap: '10px' } }, info, b);
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

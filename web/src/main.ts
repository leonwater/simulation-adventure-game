import { h, button } from './ui/kit';
import { hitChance, enemyRequirement } from './core/balance';

/**
 * 웹 이식 뼈대 (v2.5 준비). 화면·규칙은 docs/WEB_PORT.md 순서대로 C# 게임에서 옮겨 온다.
 * 지금은 파이프라인(개발 서버 · 테스트 · 스크린샷 · Capacitor 앱)이 도는지 보여 주는 첫 화면만 있다.
 */
const app = document.getElementById('app')!;

function title(): HTMLElement {
  const sample = Math.round(hitChance(50, enemyRequirement(10)) * 100);
  return h('div', { class: 'screen' },
    h('div', { class: 'bar' }, h('b', null, '모험가 키우기')),
    h('div', { class: 'scroll' },
      h('div', { class: 'card' }, '웹 이식 준비 완료 (v2.4 → 웹)'),
      h('div', { class: 'card' }, `Core 공식 확인: 능력치 50, 10층 명중 ${sample}%`),
      h('div', { class: 'sub' }, '게임 규칙과 화면은 C# 게임에서 순서대로 옮겨 옵니다.'),
      button('시작하기', () => alert('준비 중'), 'primary'),
    ),
  );
}

app.append(title());

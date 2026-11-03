/** 기기별 설정 (localStorage). 저장 파일과 별개라 새 게임을 해도 유지된다. */
const KEYS = { speed: 'battle_speed', typewriter: 'typewriter', vibration: 'vibration', textSize: 'text_size', tutorial: 'tutorial_completed', fxAlways: 'fx_always' } as const;

function get(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(`adventurer.${key}`);
    return v === null ? fallback : parseInt(v, 10);
  } catch {
    return fallback;
  }
}
function set(key: string, value: number): void {
  try {
    localStorage.setItem(`adventurer.${key}`, String(value));
  } catch {
    /* 저장소를 못 쓰면 무시 */
  }
}

export const TEXT_SIZE_NAMES = ['작게', '보통', '크게'];

export const settings = {
  /** 이 기기에서 튜토리얼을 한 번이라도 끝까지 마쳤는지. */
  get tutorialCompleted(): boolean { return get(KEYS.tutorial, 0) === 1; },
  set tutorialCompleted(v: boolean) { set(KEYS.tutorial, v ? 1 : 0); },
  /** 전투 연출 속도 1 또는 2. */
  get battleSpeed(): number { return get(KEYS.speed, 1) >= 2 ? 2 : 1; },
  set battleSpeed(v: number) { set(KEYS.speed, v >= 2 ? 2 : 1); },
  /** 이펙트 항상 보기 (기본 켜기). 끄면 기기의 '동작 줄이기' 설정을 따른다. */
  get fxAlways(): boolean { return get(KEYS.fxAlways, 1) === 1; },
  set fxAlways(v: boolean) { set(KEYS.fxAlways, v ? 1 : 0); },
  /** 대사 한 글자씩 출력. */
  get typewriter(): boolean { return get(KEYS.typewriter, 1) === 1; },
  set typewriter(v: boolean) { set(KEYS.typewriter, v ? 1 : 0); },
  get vibration(): boolean { return get(KEYS.vibration, 1) === 1; },
  set vibration(v: boolean) { set(KEYS.vibration, v ? 1 : 0); },
  /** 글자 크기 0 작게 · 1 보통 · 2 크게. */
  get textSize(): number { return Math.max(0, Math.min(2, get(KEYS.textSize, 1))); },
  set textSize(v: number) { set(KEYS.textSize, Math.max(0, Math.min(2, v))); },
  get textScale(): number { return [0.92, 1, 1.12][this.textSize]; },
};

export function vibrate(ms = 30): void {
  if (!settings.vibration) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 무시 */
  }
}

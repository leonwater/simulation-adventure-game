/** 유닛 픽셀 그림 (파일 이름 = 직업 영문 소문자 · monsters.json Id). art/units.px.js → scripts/sprites.sh. 없는 종류는 undefined */
const SPRITES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../assets/sprites/*.png', { eager: true, import: 'default' })).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]));

export const spriteUrl = (id: string | undefined): string | undefined => (id ? SPRITES[id] : undefined);

/** 직업 그림: 원본 픽셀 × 3 (직업마다 그림 크기가 달라도 픽셀 한 칸 크기가 같게), 발끝을 맞춘 고정 높이 칸에 넣어 아래 글자 높이가 같게 (직업 선택·직업 정보). */
export function jobSprite(job: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'job-pic';
  const img = document.createElement('img');
  img.className = 'job-sprite';
  img.alt = '';
  img.src = spriteUrl(job.toLowerCase()) ?? '';
  img.onload = () => { img.style.width = `${img.naturalWidth * 3}px`; };
  box.append(img);
  return box;
}

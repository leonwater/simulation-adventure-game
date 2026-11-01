/** 유닛 픽셀 그림 (파일 이름 = 직업 영문 소문자 · monsters.json Id). art/units.px.js → scripts/sprites.sh. 없는 종류는 undefined */
const SPRITES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../assets/sprites/*.png', { eager: true, import: 'default' })).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]));

export const spriteUrl = (id: string | undefined): string | undefined => (id ? SPRITES[id] : undefined);

// 전투 이펙트 확인 페이지를 한 파일로 묶는다: fxdemo/ → docs/fx-demo.html (그림·코드·CSS 모두 안에 넣음)
import { build } from 'vite';
import { readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(web, '.sim/fxdemo');
await build({
  root: resolve(web, 'fxdemo'), base: './', publicDir: false, logLevel: 'warn', configFile: false,
  build: { outDir: out, emptyOutDir: true, assetsInlineLimit: Number.MAX_SAFE_INTEGER, cssCodeSplit: false, modulePreload: false, target: 'es2022' },
});
let html = readFileSync(resolve(out, 'index.html'), 'utf8');
html = html.replace(/<script type="module" crossorigin src="\.\/assets\/[^"]+\.js"><\/script>/, '');
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/, (_, p) => `<style>${readFileSync(resolve(out, p), 'utf8')}</style>`);
const js = readFileSync(resolve(out, 'assets', readdirSync(resolve(out, 'assets')).find((f) => f.endsWith('.js'))), 'utf8');
html = html.replace('</body>', `<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>\n</body>`);
const dest = resolve(web, '../docs/fx-demo.html');
writeFileSync(dest, html);
rmSync(out, { recursive: true, force: true });
console.log(`docs/fx-demo.html ${(html.length / 1024).toFixed(1)} KB`);

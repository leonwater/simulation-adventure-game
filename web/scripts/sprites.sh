#!/bin/bash
# 픽셀 그림: art/units.px.js(전투 유닛) · art/items.px.js(물품) · art/icons.px.js(아이콘)를 claude-pxl(고정 커밋)로 그려 src/assets/ 에 넣는다 (Vite가 작은 그림은 번들에 넣음)
set -e
cd "$(dirname "$0")/.."
PXL_COMMIT=21fee41f7ecce00bc868d7567f24ffd0f3acc8fa
if [ ! -d .pxl ]; then git clone -q https://github.com/crsolver/claude-pxl .pxl && git -C .pxl checkout -q $PXL_COMMIT; fi
for kind in units:sprites items:items ui:ui; do
  src=${kind%%:*}; dst=${kind##*:}
  rm -rf art/out/$src
  node .pxl/bin/pxl.js build art/$src.px.js --out art/out/$src
  mkdir -p src/assets/$dst && rm -f src/assets/$dst/*.png && cp art/out/$src/sprites/*.png src/assets/$dst/
  echo "$dst: $(ls src/assets/$dst | wc -l)장"
done
# UI 아이콘: 16×16을 8배로 (CSS mask로 색을 입혀도 흐려지지 않게). favicon은 따로 둔다
rm -rf art/out/icons
node .pxl/bin/pxl.js build art/icons.px.js --out art/out/icons --no-preview
# 물품은 모두 16×16 판에 맞춘다 (같은 배율이면 모든 물품의 픽셀 1칸 크기가 같다)
python3 - <<'PY'
from PIL import Image; import glob, os
def pad16(im):
    c = Image.new('RGBA', (16, 16)); c.paste(im, ((16 - im.width) // 2, (16 - im.height) // 2)); return c
for f in glob.glob('src/assets/items/*.png'):
    im = Image.open(f).convert('RGBA')
    if im.size != (16, 16): pad16(im).save(f)
# 아이콘은 16×16을 8배(128px)로 키워 public/icons/에 (CSS mask로 색을 입혀도 흐려지지 않게)
fs = glob.glob('art/out/icons/sprites/*.png')
for f in fs:
    pad16(Image.open(f).convert('RGBA')).resize((128, 128), Image.NEAREST).save('public/icons/' + os.path.basename(f), optimize=True)
print(f'icons: {len(fs)}장')
PY
# 시설 일러스트: art/illust*.px.js 의 장면(illust_<이름>) → public/illustrations/<이름>.webp (무손실, 게임에서 약 2배)
rm -rf art/out/illust
for f in art/illust*.px.js; do node .pxl/bin/pxl.js build "$f" --out "art/out/illust/$(basename "$f" .px.js)" --no-preview; done
python3 - <<'PY'
from PIL import Image; import glob, os
fs = glob.glob('art/out/illust/*/scenes/illust_*.png')
for f in fs:
    Image.open(f).save('public/illustrations/' + os.path.basename(f)[len('illust_'):-4] + '.webp', lossless=True, method=6)
print(f'illustrations: {len(fs)}장')
PY

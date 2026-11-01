#!/bin/bash
# 픽셀 그림: art/units.px.js(전투 유닛) · art/items.px.js(물품)를 claude-pxl(고정 커밋)로 그려 src/assets/ 에 넣는다 (Vite가 작은 그림은 번들에 넣음)
set -e
cd "$(dirname "$0")/.."
PXL_COMMIT=21fee41f7ecce00bc868d7567f24ffd0f3acc8fa
if [ ! -d .pxl ]; then git clone -q https://github.com/crsolver/claude-pxl .pxl && git -C .pxl checkout -q $PXL_COMMIT; fi
for kind in units:sprites items:items; do
  src=${kind%%:*}; dst=${kind##*:}
  rm -rf art/out/$src
  node .pxl/bin/pxl.js build art/$src.px.js --out art/out/$src
  mkdir -p src/assets/$dst && rm -f src/assets/$dst/*.png && cp art/out/$src/sprites/*.png src/assets/$dst/
  echo "$dst: $(ls src/assets/$dst | wc -l)장"
done
# 물품은 모두 16×16 판에 맞춘다 (같은 배율이면 모든 물품의 픽셀 1칸 크기가 같다)
python3 - <<'PY'
from PIL import Image; import glob
for f in glob.glob('src/assets/items/*.png'):
    im = Image.open(f).convert('RGBA')
    if im.size != (16, 16):
        c = Image.new('RGBA', (16, 16)); c.paste(im, ((16 - im.width) // 2, (16 - im.height) // 2)); c.save(f)
PY

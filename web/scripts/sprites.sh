#!/bin/bash
# 전투 유닛 픽셀 그림: art/units.px.js 를 claude-pxl(고정 커밋)로 그려 src/assets/sprites/ 에 넣는다 (Vite가 작은 그림은 번들에 넣음)
set -e
cd "$(dirname "$0")/.."
PXL_COMMIT=21fee41f7ecce00bc868d7567f24ffd0f3acc8fa
if [ ! -d .pxl ]; then git clone -q https://github.com/crsolver/claude-pxl .pxl && git -C .pxl checkout -q $PXL_COMMIT; fi
rm -rf art/out
node .pxl/bin/pxl.js build art/units.px.js
mkdir -p src/assets/sprites && rm -f src/assets/sprites/*.png && cp art/out/sprites/*.png src/assets/sprites/
ls src/assets/sprites

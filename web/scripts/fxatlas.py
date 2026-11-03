# 이펙트 애니 띠(art/out/fx/anims/*.png)를 그림 한 장(src/assets/fx/atlas.png)으로 묶고 목록(atlas.json)을 만든다.
# 목록: 이름 → [x, y, 한 프레임 w, h, 프레임 수, 프레임 ms]
import json, glob, os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
items = []
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    name = os.path.basename(f)[:-4]
    meta = json.load(open(f[:-4] + '.json'))['frames']
    n = len(meta)
    first = meta[f'{name}_0'] if f'{name}_0' in meta else next(iter(meta.values()))
    items.append((name, Image.open(f).convert('RGBA'), first['frame']['w'], first['frame']['h'], n, first.get('duration', 100)))
# 선반 쌓기: 높이 순으로 줄을 채운다 (폭 512)
W, pad = 512, 1
items.sort(key=lambda t: (-t[3], t[0]))
x = y = shelf = 0
pos = {}
for name, im, w, h, n, ms in items:
    if x + im.width > W:
        x, y, shelf = 0, y + shelf + pad, 0
    pos[name] = [x, y, w, h, n, ms]
    x += im.width + pad
    shelf = max(shelf, im.height)
H = y + shelf
atlas = Image.new('RGBA', (W, H))
for name, im, *_ in items:
    atlas.paste(im, tuple(pos[name][:2]))
os.makedirs(dst, exist_ok=True)
atlas.save(os.path.join(dst, 'atlas.png'), optimize=True)
pos['_size'] = [W, H, 0, 0, 0, 0]
json.dump(dict(sorted(pos.items())), open(os.path.join(dst, 'atlas.json'), 'w'), separators=(',', ':'))
print(f'fx: {len(items)}개 → atlas {W}×{H}')

# 전투 유닛 픽셀 그림: 글자 격자(왼쪽 절반) → 좌우 대칭 → 덧그림 → 외곽선 → PNG
# 실행: python3 scripts/sprites.py  (결과: public/sprites/<id>.png, 1픽셀 = 1칸)
from PIL import Image
import os

PAL = {
    'k': '#1a1420',
    's': '#f2c9a0', 'S': '#c98f6a',
    'm': '#d3d8e2', 'M': '#8f98ab', 'n': '#59627a',
    'r': '#d0454f', 'R': '#8a2a3a',
    'd': '#9a6a44', 'D': '#5e3d29', 'y': '#f0c060',
    'g': '#7ccf5a', 'G': '#3f8f3f', 't': '#245a3a', 'w': '#f4fff0',
    'e': '#9bbf4a', 'E': '#5f8a2e',
    'b': '#ece4d0', 'B': '#b5a98e', 'c': '#7b705c',
    'x': '#ff5a3c', 'z': '#ffd84a',
}

def rows(s):
    return [r.strip() for r in s.strip('\n').split('\n')]

def sprite(half, patches=()):
    """half: 왼쪽 절반 격자. patches: (x, y, 격자) 덧그림 ('.'는 건너뜀). 외곽선 1칸 포함 크기로 돌려준다."""
    g = [list(r + r[::-1]) for r in rows(half)]
    w = max(len(r) for r in g)
    g = [r + ['.'] * (w - len(r)) for r in g]
    for x0, y0, p in patches:
        for dy, r in enumerate(rows(p)):
            while y0 + dy >= len(g):
                g.append(['.'] * w)
            for dx, ch in enumerate(r):
                if ch != '.' and x0 + dx < w:
                    g[y0 + dy][x0 + dx] = ch
    h = len(g)
    img = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    filled = {(x, y) for y in range(h) for x in range(w) if g[y][x] != '.'}
    for x, y in filled:
        img.putpixel((x + 1, y + 1), Image.new('RGB', (1, 1), PAL[g[y][x]]).getpixel((0, 0)) + (255,))
    k = Image.new('RGB', (1, 1), PAL['k']).getpixel((0, 0)) + (255,)
    for y in range(-1, h + 1):
        for x in range(-1, w + 1):
            if (x, y) not in filled and any((x + dx, y + dy) in filled for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                img.putpixel((x + 1, y + 1), k)
    return img

SPRITES = {
    # 전사: 정면, 화면 왼쪽 손에 검, 오른쪽 손에 방패
    'warrior': sprite('''
......MMM
.....Mmmm
....Mmmmm
....Mmsss
....Msksk
....Mssss
.....SSss
..MMmmmmr
.Mmmmmmrr
.Mmmmmmrr
.ssMmmmrr
.ss.Mmmrr
....DdddD
....Mmmrr
....Mmm..
....Mmm..
....nnn..
...DDDD..''', [
        (0, 0, '.m\n.m\n.m\n.m\n.m\n.m\n.m\n.m\nym\nyyy\n.D'),
        (13, 7, '.RRRR\nRrrrR\nRryrR\nRrrrR\nRrrrR\n.RrR\n..R'),
        (8, 12, 'yy'),
    ]),
    'slime': sprite('''
......gg
....ggGg
...ggGwg
..gggGgg
.gggggg.
.ggkwggg
gggkkggg
gggggggg
tggggggg
.ttttttt'''),
    # 고블린: 큰 귀, 붉은 눈, 단검
    'goblin': sprite('''
e....EEE
ee..Eeee
.eeEeeee
..Eexxee
..Eeekee
...Eeeee
....EkkE
...DDddd
..eDdddd
..eDdddd
....yDDd
....dddd
....DD.D
....EE.E
...EEE.E''', [(0, 6, '.m\n.m\nmM\n.d')]),
    # 스켈레톤: 해골, 갈비뼈, 녹슨 검
    'skeleton': sprite('''
.....BBB
....Bbbb
....bbbb
....bkkb
....bkzb
....Bbbb
.....Bkb
......bb
...bBccb
..b.bccb
..b.Bccb
..b.bccb
.....Bbb
.....b.c
.....b.c
.....b.c
....bb.c''', [(0, 2, '.M\n.M\n.M\n.M\n.M\n.M\ndM\nDDD\n.d')]),
}

if __name__ == '__main__':
    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites')
    os.makedirs(out, exist_ok=True)
    for name, img in SPRITES.items():
        img.save(os.path.join(out, f'{name}.png'), optimize=True)
        print(name, img.size)

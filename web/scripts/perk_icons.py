# 직업 고유 능력치 아이콘 4개 + 반격 태세 상태 아이콘 (기존 아이콘과 같은 납작한 그림, 4배로 그려 줄여 부드럽게)
# 실행: python3 scripts/perk_icons.py  → public/icons/
from PIL import Image, ImageDraw
import math, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
S = 4  # 4배로 그려 줄인다

def canvas(px):
    im = Image.new('RGBA', (px * S, px * S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def save(im, px, name):
    im.resize((px, px), Image.LANCZOS).save(os.path.join(OUT, name + '.png'), optimize=True)

def sword(d, cx, cy, ang, length, width, blade=(214, 220, 230), edge=(150, 158, 175), hilt=(200, 150, 60)):
    """중심 (cx, cy)에서 ang 방향으로 칼날, 반대쪽으로 손잡이."""
    ux, uy = math.cos(ang), math.sin(ang)
    px, py = -uy, ux
    tip = (cx + ux * length, cy + uy * length)
    b1 = (cx + px * width, cy + py * width)
    b2 = (cx - px * width, cy - py * width)
    d.polygon([b1, tip, b2], fill=blade)
    d.polygon([(cx, cy), tip, b2], fill=edge)
    g = width * 2.4
    d.line([(cx + px * g, cy + py * g), (cx - px * g, cy - py * g)], fill=hilt, width=int(width * 1.1))
    d.line([(cx, cy), (cx - ux * length * 0.32, cy - uy * length * 0.32)], fill=(120, 80, 45), width=int(width * 1.1))

def counter():  # 반격: 검 + 되돌아오는 화살표
    px = 96; im, d = canvas(px); k = S
    sword(d, 34 * k, 62 * k, -math.pi / 4, 52 * k, 7 * k)
    d.arc([40 * k, 18 * k, 88 * k, 66 * k], start=200, end=60, fill=(240, 160, 60), width=9 * k)
    d.polygon([(84 * k, 34 * k), (92 * k, 54 * k), (70 * k, 50 * k)], fill=(240, 160, 60))
    save(im, px, 'perk_counter')

def dodge():  # 회피: 바람 세 줄기
    px = 96; im, d = canvas(px); k = S
    col = (110, 200, 190)
    for i, (y, w) in enumerate([(30, 56), (50, 70), (70, 48)]):
        x0 = 14 + i * 4
        d.line([(x0 * k, y * k), ((x0 + w) * k, y * k)], fill=col, width=8 * k)
        d.arc([(x0 + w - 12) * k, (y - 16) * k, (x0 + w + 6) * k, (y + 2) * k], start=90, end=320, fill=col, width=8 * k)
    save(im, px, 'perk_dodge')

def pierce():  # 관통: 금 간 방패를 뚫는 단검
    px = 96; im, d = canvas(px); k = S
    shield = [(24 * k, 20 * k), (64 * k, 20 * k), (64 * k, 52 * k), (44 * k, 78 * k), (24 * k, 52 * k)]
    d.polygon(shield, fill=(150, 158, 175))
    d.polygon([(44 * k, 20 * k), (64 * k, 20 * k), (64 * k, 52 * k), (44 * k, 78 * k)], fill=(185, 192, 205))
    d.line([(36 * k, 30 * k), (46 * k, 46 * k), (40 * k, 58 * k)], fill=(70, 74, 90), width=4 * k)
    sword(d, 58 * k, 58 * k, -math.pi * 0.8, 50 * k, 6 * k, blade=(240, 120, 110), edge=(190, 70, 80))
    save(im, px, 'perk_pierce')

def amplify():  # 증폭: 보라 마력 별빛
    px = 96; im, d = canvas(px); k = S
    cx, cy = 48 * k, 48 * k
    pts = []
    for i in range(16):
        r = (40 if i % 2 == 0 else 15) * k
        a = -math.pi / 2 + i * math.pi / 8
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    d.polygon(pts, fill=(176, 126, 224))
    d.ellipse([cx - 13 * k, cy - 13 * k, cx + 13 * k, cy + 13 * k], fill=(235, 215, 255))
    save(im, px, 'perk_amplify')

def riposte_status():  # 반격 태세: 주황 원 + 흰 검과 화살표 (다른 상태 아이콘과 같은 꼴)
    px = 64; im, d = canvas(px); k = S
    d.ellipse([2 * k, 2 * k, 62 * k, 62 * k], fill=(255, 200, 120))
    d.ellipse([6 * k, 6 * k, 58 * k, 58 * k], fill=(214, 120, 50))
    sword(d, 24 * k, 42 * k, -math.pi / 4, 30 * k, 4 * k, blade=(255, 255, 255), edge=(230, 230, 236), hilt=(255, 255, 255))
    d.arc([28 * k, 14 * k, 54 * k, 40 * k], start=200, end=60, fill=(255, 255, 255), width=5 * k)
    d.polygon([(50 * k, 22 * k), (56 * k, 34 * k), (43 * k, 31 * k)], fill=(255, 255, 255))
    save(im, px, 'status_riposte')

if __name__ == '__main__':
    counter(); dodge(); pierce(); amplify(); riposte_status()
    print('ok')

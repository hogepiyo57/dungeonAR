"""つばめいの AR ポスター（A4 縦）を作る。

AR の認識は、絵の中の細かい角や模様の多さで決まる。白地にキャラクターだけだと認識しにくいので、
まわりに色とりどりの小さな模様（つばめ・星・紙ふぶき）をすき間なく散らし、ふちにも模様を入れる。
模様は乱数の種を固定しているので、何度作っても同じ絵になる（認識データと印刷物がずれない）。

出力：
  assets/tsubamei-poster.png  … 印刷用（1240×1754）
  assets/tsubamei-target.jpg  … 認識データ作成用（同じ絵を 512×724 に縮小）
実行：.venv の Python で `python tools/make_tsubamei_poster.py`
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'つばめい'
OUT = ROOT / 'assets'
W, H = 1240, 1754
FONT_B = 'C:/Windows/Fonts/BIZ-UDGothicB.ttc'

PURPLE = (144, 104, 160)
DARK = (60, 36, 72)
GREEN = (200, 240, 144)
DEEP_GREEN = (136, 160, 80)
PINK = (248, 144, 144)
YELLOW = (248, 248, 128)
CREAM = (255, 250, 236)
SKY = (196, 228, 248)
COLORS = [PURPLE, GREEN, DEEP_GREEN, PINK, YELLOW, (120, 180, 230), (250, 190, 90)]


def swallow(d, cx, cy, s, ang, fill):
    """つばめのシルエット（二股の尾と広げた羽）"""
    pts = [(0, -0.35), (0.25, -0.15), (1.0, -0.45), (0.35, 0.1), (0.2, 0.3), (0.45, 1.0), (0, 0.45),
           (-0.45, 1.0), (-0.2, 0.3), (-0.35, 0.1), (-1.0, -0.45), (-0.25, -0.15)]
    c, sn = math.cos(ang), math.sin(ang)
    d.polygon([(cx + (x * c - y * sn) * s, cy + (x * sn + y * c) * s) for x, y in pts], fill=fill, outline=DARK)


def star(d, cx, cy, r, ang, fill):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        a = ang + i * math.pi / 5
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill, outline=DARK)


def cutout(name, height):
    """イラストを透明部分で切り出して、高さをそろえる"""
    im = Image.open(SRC / name).convert('RGBA')
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def with_outline(im, width, color):
    """切り出した絵のまわりにふちどりをつける（背景の模様から浮かせる）"""
    pad = width + 2
    base = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
    base.paste(im, (pad, pad), im)
    mask = base.getchannel('A').filter(ImageFilter.MaxFilter(width * 2 + 1))
    out = Image.new('RGBA', base.size, color + (0,))
    out.putalpha(mask)
    out.alpha_composite(base)
    return out


def text(d, xy, s, size, fill, stroke=0, stroke_fill=None, anchor='mm'):
    font = ImageFont.truetype(FONT_B, size)
    d.text(xy, s, font=font, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)


def main():
    rnd = random.Random(20261006)
    img = Image.new('RGBA', (W, H), SKY + (255,))
    d = ImageDraw.Draw(img)

    # 空のグラデーション
    for y in range(H):
        t = y / H
        c = tuple(round(SKY[i] * (1 - t) + CREAM[i] * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)

    # 細かい模様をすき間なく散らす（認識しやすくするため）
    for _ in range(520):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        kind = rnd.random()
        col = rnd.choice(COLORS)
        if kind < 0.35:
            swallow(d, x, y, rnd.uniform(14, 34), rnd.uniform(0, math.tau), col)
        elif kind < 0.6:
            star(d, x, y, rnd.uniform(8, 20), rnd.uniform(0, math.tau), col)
        elif kind < 0.8:
            r = rnd.uniform(4, 10)
            d.ellipse([x - r, y - r, x + r, y + r], fill=col, outline=DARK)
        else:
            w, h, a = rnd.uniform(8, 20), rnd.uniform(4, 8), rnd.uniform(0, math.pi)
            c, s = math.cos(a), math.sin(a)
            d.polygon([(x + (px * c - py * s), y + (px * s + py * c)) for px, py in
                       [(-w, -h), (w, -h), (w, h), (-w, h)]], fill=col, outline=DARK)

    # ふちの模様（市松）
    B = 36
    for i in range(0, W, B):
        for j, y0 in enumerate((0, H - B)):
            d.rectangle([i, y0, i + B, y0 + B], fill=PURPLE if (i // B + j) % 2 == 0 else GREEN)
    for k in range(0, H, B):
        for j, x0 in enumerate((0, W - B)):
            d.rectangle([x0, k, x0 + B, k + B], fill=PURPLE if (k // B + j) % 2 == 0 else GREEN)
    d.rectangle([B, B, W - B - 1, H - B - 1], outline=DARK, width=6)

    # 見出し
    d.rounded_rectangle([90, 80, W - 90, 300], radius=40, fill=PURPLE, outline=DARK, width=8)
    text(d, (W / 2, 160), '清明高校 マスコット', 64, CREAM)
    text(d, (W / 2, 245), 'つばめい', 104, YELLOW, stroke=8, stroke_fill=DARK)

    # まん中に正面のつばめい、まわりにいろいろなポーズ
    main_im = with_outline(cutout('つばめい (2).PNG', 860), 14, (255, 255, 255))
    img.alpha_composite(main_im, ((W - main_im.width) // 2, 360))
    for name, h, xy in (('つばめい (1).png', 300, (70, 880)), ('つばめい (4).png', 300, (900, 880)),
                        ('つばめい (3).png', 250, (70, 1250)), ('つばめい (5).png', 250, (880, 1250))):
        im = with_outline(cutout(name, h), 8, (255, 255, 255))
        img.alpha_composite(im, xy)

    # 下の案内
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([90, 1560, W - 90, 1680], radius=30, fill=CREAM, outline=DARK, width=6)
    text(d, (W / 2, 1620), 'スマホで うつすと つばめいが あらわれる！', 46, DARK)

    img = img.convert('RGB')
    OUT.mkdir(exist_ok=True)
    img.save(OUT / 'tsubamei-poster.png', optimize=True)
    img.resize((512, round(512 * H / W)), Image.LANCZOS).save(OUT / 'tsubamei-target.jpg', quality=92)
    print('poster', img.size, 'aspect', H / W)


if __name__ == '__main__':
    main()

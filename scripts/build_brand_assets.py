#!/usr/bin/env python3
"""Regenerates public/brand/* from brand-source/.

Parent logo: built with the Mr. Chartist logo kit's own recipe (approved four-band
path data, Plus Jakarta Sans 800 outlined, tracking -55/1000 em, same layout constants).
Product icons: resampled from the existing product icon (brand-source/product-icon-original-640.png).
Requires: pip install fonttools pillow
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from PIL import Image, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'brand-source'
OUT = ROOT / 'public' / 'brand'
PATHS = json.loads((SRC / 'mr-chartist-symbol-paths.json').read_text())

def svg_symbol(color, w=1024, h=1024, scale=None, cx=None, cy=None):
    scale = scale if scale is not None else min(w, h) * .82 / 1018
    cx = w / 2 if cx is None else cx
    cy = h / 2 if cy is None else cy
    ds = [' '.join(k + (' '.join(f'{v:.3f}' for v in vs) if vs else '') for k, vs in p) for p in PATHS]
    body = ''.join(f'<path d="{d}"/>' for d in ds)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img">'
            f'<title>Mr. Chartist four-band symbol</title>'
            f'<g fill="{color}" transform="translate({cx},{cy}) scale({scale}) translate(-598.5,-627)">{body}</g></svg>')

# --- horizontal lockup (kit lockups.py, unchanged constants) ---
inst = instantiateVariableFont(TTFont(SRC / 'PlusJakartaSans[wght].ttf'), {'wght': 800}, inplace=False)
inst.save(SRC / '_jakarta800.ttf')
ft = TTFont(SRC / '_jakarta800.ttf'); gs = ft.getGlyphSet(); cmap = ft.getBestCmap(); upm = ft['head'].unitsPerEm
pf = ImageFont.truetype(str(SRC / '_jakarta800.ttf'), 1000)
NAME, TRACK = 'Mr. Chartist', -55

def wordmark(x, baseline, size, color):
    out = []
    for i, ch in enumerate(NAME):
        pen = SVGPathPen(gs); gs[cmap[ord(ch)]].draw(pen)
        pos = (pf.getlength(NAME[:i + 1]) - pf.getlength(ch) + i * TRACK) / 1000 * size
        out.append(f'<path fill="{color}" transform="translate({x + pos:.4f},{baseline}) scale({size / upm}, {-size / upm})" d="{pen.getCommands()}"/>')
    return ''.join(out)

def horizontal(color):
    size = 90
    tw = (pf.getlength(NAME) + (len(NAME) - 1) * TRACK) / 1000 * size
    w, h = int(245 + tw), 210
    s = svg_symbol(color, 1000, 1000, scale=140 / 1018, cx=105, cy=105)
    g = s[s.index('<g '):s.index('</svg>')]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img">'
            f'<title>Mr. Chartist</title>{g}{wordmark(215, 132, size, color)}</svg>'), w, h

OUT.joinpath('mr-chartist').mkdir(parents=True, exist_ok=True)
OUT.joinpath('product').mkdir(parents=True, exist_ok=True)
for name, color in (('black', '#000000'), ('white', '#FFFFFF')):
    s, w, h = horizontal(color)
    (OUT / 'mr-chartist' / f'logo-horizontal-{name}.svg').write_text(s)
    (OUT / 'mr-chartist' / f'symbol-{name}.svg').write_text(svg_symbol(color))
print('lockup canvas', w, h)
(SRC / '_jakarta800.ttf').unlink()

# --- product icon set (existing icon, resampled only) ---
im = Image.open(SRC / 'product-icon-original-640.png').convert('RGB')
def crop_resize(box, size):
    return im.crop(box).resize((size, size), Image.LANCZOS)
P = OUT / 'product'
full = (0, 0, 640, 640)
any_crop = (70, 70, 570, 570)    # 500px window around the 380px tile: more tile per pixel
tile_crop = (118, 118, 522, 522) # tight on the tile for favicons
crop_resize(any_crop, 512).save(P / 'icon-512.png', optimize=True)
crop_resize(any_crop, 192).save(P / 'icon-192.png', optimize=True)
crop_resize(full, 512).save(P / 'icon-maskable-512.png', optimize=True)
crop_resize(full, 192).save(P / 'icon-maskable-192.png', optimize=True)
crop_resize(any_crop, 180).save(P / 'apple-touch-icon.png', optimize=True)
crop_resize(tile_crop, 32).save(P / 'favicon-32.png', optimize=True)
crop_resize(tile_crop, 16).save(P / 'favicon-16.png', optimize=True)
crop_resize(tile_crop, 64).save(P / 'mark-64.png', optimize=True)
crop_resize(tile_crop, 128).save(P / 'mark-128.png', optimize=True)
crop_resize(tile_crop, 256).save(ROOT / 'public' / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
print('product icons written')

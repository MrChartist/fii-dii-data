#!/usr/bin/env python3
"""Regenerates public/brand/* from brand-source/.

Parent logo: built with the Mr. Chartist logo kit's own recipe (approved four-band
path data, Plus Jakarta Sans 800 outlined, tracking -55/1000 em, same layout constants).
App icons / favicon / share card: Mr. Chartist symbol (white on kit charcoal #0D0D0D); SVG sources are written to brand-source/generated, then rasterised by scripts/render_brand_icons.js.
Usage: python3 scripts/build_brand_assets.py && node scripts/render_brand_icons.js && python3 scripts/build_brand_assets.py --ico
Requires: pip install fonttools pillow; npm i playwright-core (renderer only)
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
for name, color in (('black', '#000000'), ('white', '#FFFFFF')):
    s, w, h = horizontal(color)
    (OUT / 'mr-chartist' / f'logo-horizontal-{name}.svg').write_text(s)
    (OUT / 'mr-chartist' / f'symbol-{name}.svg').write_text(svg_symbol(color))
print('lockup canvas', w, h)
(SRC / '_jakarta800.ttf').unlink()


import sys
GEN = SRC / 'generated'; GEN.mkdir(exist_ok=True)
ICONS = OUT / 'icons'; ICONS.mkdir(exist_ok=True)
BG = '#0D0D0D'

def icon_svg(size, frac):
    # symbol centred on charcoal; frac = symbol scale relative to the default 0.82 fit
    sc = size * .82 * frac / 1018
    inner = svg_symbol('#FFFFFF', size, size, scale=sc)
    g = inner[inner.index('<g '):inner.index('</svg>')]
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}"><rect width="{size}" height="{size}" fill="{BG}"/>{g}</svg>'

if '--ico' in sys.argv:
    im = Image.open(ICONS / 'favicon-48.png')
    im.save(ROOT / 'public' / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    print('favicon.ico written')
else:
    for name, size, frac in (('icon-192', 192, 1), ('icon-512', 512, 1), ('apple-touch-icon', 180, 1),
                             ('icon-maskable-192', 192, .72), ('icon-maskable-512', 512, .72),
                             ('favicon-16', 16, 1.12), ('favicon-32', 32, 1.12), ('favicon-48', 48, 1.12)):
        (GEN / f'{name}.svg').write_text(icon_svg(size, frac))
    (ICONS / 'favicon.svg').write_text(icon_svg(64, 1.12))
    # 1200x630 share card
    white = (OUT / 'mr-chartist' / 'logo-horizontal-white.svg').read_text()
    card = f'''<!doctype html><meta charset="utf-8"><style>
@font-face{{font-family:PJS;src:url("../PlusJakartaSans[wght].ttf");font-weight:200 800}}
html,body{{margin:0}}body{{width:1200px;height:630px;background:{BG};color:#fff;font-family:PJS,sans-serif;position:relative;overflow:hidden}}
.logo{{position:absolute;left:84px;top:150px;width:640px}}.logo svg{{width:100%;height:auto;display:block}}
h1{{position:absolute;left:96px;top:400px;margin:0;font-size:84px;font-weight:800;letter-spacing:-0.04em;line-height:1}}
h1 i{{display:inline-block;width:14px;height:14px;border-radius:50%;background:hsl(16 100% 60%);margin-left:12px}}
p{{position:absolute;left:96px;top:510px;margin:0;font-size:30px;font-weight:500;color:#A6A6A6}}
</style><div class="logo">{white}</div><h1>FII &amp; DII Data<i></i></h1><p>Live institutional flow tracker for India</p>'''
    (GEN / 'share-card.html').write_text(card)
    (GEN / 'parent-logo-512.html').write_text('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{display:block;width:512px;height:512px}</style>' + (OUT / 'mr-chartist' / 'symbol-black.svg').read_text())
    print('icon sources written')

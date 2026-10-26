#!/usr/bin/env python3
"""High-resolution map insets for the flat maps (F-149 prototype).

The flat maps (Movements, Archaeology) draw images/map-globe.webp (4800 x 2496 px, Natural Earth projection) across the whole world.
An inset is a sharper picture of one region, in the SAME projection, that the page lays over that image when you zoom in far enough.
Each inset is listed in images/inset/manifest.json with its box in map units (the units the page draws in, see nProj in movements.js).

    python3 tools/build-inset.py placeholder     # PLACEHOLDER: crops the existing map-globe.webp (same pixels, so NOT sharper); proves the swap and the alignment
    python3 tools/build-inset.py feather IN.png OUT.webp --deg 0.25 --px-per-deg 200   # bakes a soft edge (alpha fade) into a finished inset picture
    (the real build, from elevation data projected into Natural Earth, replaces the file named in the manifest; nothing else changes)
    Layering: the page draws the lowest "z" first, so Tier 2 (z 1) lies under Tier 1 (z 2), both over the base picture. Every inset's outer edge fades to clear over about 0.25 degree.

Needs: python3, Pillow.
"""
import json, math, sys, os
import numpy as np
from PIL import Image
D2R = math.pi / 180
NE_XM, NE_YM = 2.735384723480633, 1.422390506730596
def neF(lat):
    p = lat * D2R; p2 = p * p; p4 = p2 * p2
    return 0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))
def neY(lat):
    p = lat * D2R; p2 = p * p; p4 = p2 * p2
    return p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
def proj(lon, lat): return lon * D2R * neF(lat), neY(lat)
def box(lon0, lon1, lat0, lat1):
    """Smallest map-unit rectangle holding the lon/lat box (the box is curved in Natural Earth)."""
    pts = [proj(lo, la) for lo in [lon0 + (lon1 - lon0) * i / 20 for i in range(21)] for la in [lat0 + (lat1 - lat0) * j / 20 for j in range(21)]]
    return min(p[0] for p in pts), max(p[0] for p in pts), min(p[1] for p in pts), max(p[1] for p in pts)

INSETS = [  # id, file, z, lon0, lon1, lat0, lat1, show when the base picture would be enlarged this many times
    ('tier2-near-east', 'images/inset/tier2-near-east.webp', 1, 24.0, 48.0, 23.0, 42.0, 1.2),   # Tier 2 (Creative Design 10/26: south edge 23 so Elephantine is clear of the seam)
    ('tier1-land-of-israel', 'images/inset/tier1-land-of-israel.webp', 2, 33.0, 38.0, 28.5, 34.5, 3.0),   # Tier 1
]
FEATHER_DEG = 0.25
def feather(img, px):
    """RGBA copy of img whose alpha rises from 0 at every edge to 1 over px pixels (smooth, not linear)."""
    im = img.convert('RGBA'); w, h = im.size; px = max(1.0, px)
    x = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]; y = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
    t = np.clip(np.minimum(x, y) / px, 0, 1); a = (t * t * (3 - 2 * t) * 255).round().astype(np.uint8)
    im.putalpha(Image.fromarray(a)); return im
def placeholder():
    base = Image.open('images/map-globe.webp').convert('RGB'); W, H = base.size
    man = []
    for id_, f, z, lo0, lo1, la0, la1, k in INSETS:
        x0, x1, y0, y1 = box(lo0, lo1, la0, la1)
        l, r = (x0 + NE_XM) / (2 * NE_XM) * W, (x1 + NE_XM) / (2 * NE_XM) * W
        t, b = (NE_YM - y1) / (2 * NE_YM) * H, (NE_YM - y0) / (2 * NE_YM) * H
        l, r, t, b = math.floor(l), math.ceil(r), math.floor(t), math.ceil(b)
        # snap the map-unit box to the exact pixels cropped, so the crop lines up with the base to the pixel
        x0, x1 = l / W * 2 * NE_XM - NE_XM, r / W * 2 * NE_XM - NE_XM
        y1, y0 = NE_YM - t / H * 2 * NE_YM, NE_YM - b / H * 2 * NE_YM
        pxdeg = W / 360.0
        feather(base.crop((l, t, r, b)), FEATHER_DEG * pxdeg).save(f, quality=90, method=6)
        man.append(dict(id=id_, file=f, z=z, x0=round(x0, 6), x1=round(x1, 6), y0=round(y0, 6), y1=round(y1, 6), baseScale=k, featherDeg=FEATHER_DEG,
                        lonLat=[lo0, lo1, la0, la1], placeholder=True, note='PLACEHOLDER crop of map-globe.webp (same pixels); replace with the real high-resolution inset'))
        print(id_, (l, t, r, b), os.path.getsize(f), 'bytes')
    json.dump(dict(baseWidthPx=W, baseHeightPx=H, insets=man), open('images/inset/manifest.json', 'w'), indent=1)
def feather_cmd(argv):
    import argparse; ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst'); ap.add_argument('--deg', type=float, default=FEATHER_DEG); ap.add_argument('--px-per-deg', type=float, required=True)
    a = ap.parse_args(argv); feather(Image.open(a.src), a.deg * a.px_per_deg).save(a.dst, quality=90, method=6) if a.dst.endswith('.webp') else feather(Image.open(a.src), a.deg * a.px_per_deg).save(a.dst)
if __name__ == '__main__' and sys.argv[1:] == ['placeholder']: placeholder()
elif __name__ == '__main__' and sys.argv[1:2] == ['feather']: feather_cmd(sys.argv[2:])
else: print(__doc__)

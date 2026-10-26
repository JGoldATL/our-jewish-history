#!/usr/bin/env python3
"""High-resolution map insets for the flat maps (F-149 prototype).

The flat maps (Movements, Archaeology) draw images/map-globe.webp (4800 x 2496 px, Natural Earth projection) across the whole world.
An inset is a sharper picture of one region, in the SAME projection, that the page lays over that image when you zoom in far enough.
Each inset is listed in images/inset/manifest.json with its box in map units (the units the page draws in, see nProj in movements.js).

    python3 tools/build-inset.py placeholder     # PLACEHOLDER: crops the existing map-globe.webp (same pixels, so NOT sharper); proves the swap and the alignment
    (the real build, from elevation data projected into Natural Earth, replaces the file named in the manifest; nothing else changes)

Needs: python3, Pillow.
"""
import json, math, sys, os
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

INSETS = [  # id, file, lon0, lon1, lat0, lat1, show when the base picture would be enlarged this many times
    ('levant', 'images/inset/levant.webp', 33.0, 38.0, 28.5, 34.5, 2.0),
]
def placeholder():
    base = Image.open('images/map-globe.webp'); W, H = base.size
    man = []
    for id_, f, lo0, lo1, la0, la1, k in INSETS:
        x0, x1, y0, y1 = box(lo0, lo1, la0, la1)
        l, r = (x0 + NE_XM) / (2 * NE_XM) * W, (x1 + NE_XM) / (2 * NE_XM) * W
        t, b = (NE_YM - y1) / (2 * NE_YM) * H, (NE_YM - y0) / (2 * NE_YM) * H
        l, r, t, b = math.floor(l), math.ceil(r), math.floor(t), math.ceil(b)
        # snap the map-unit box to the exact pixels cropped, so the crop lines up with the base to the pixel
        x0, x1 = l / W * 2 * NE_XM - NE_XM, r / W * 2 * NE_XM - NE_XM
        y1, y0 = NE_YM - t / H * 2 * NE_YM, NE_YM - b / H * 2 * NE_YM
        base.crop((l, t, r, b)).save(f, quality=90, method=6)
        man.append(dict(id=id_, file=f, x0=round(x0, 6), x1=round(x1, 6), y0=round(y0, 6), y1=round(y1, 6), baseScale=k,
                        placeholder=True, note='PLACEHOLDER crop of map-globe.webp (same pixels); replace with the real high-resolution inset'))
        print(id_, (l, t, r, b), os.path.getsize(f), 'bytes')
    json.dump(dict(baseWidthPx=W, baseHeightPx=H, insets=man), open('images/inset/manifest.json', 'w'), indent=1)
if __name__ == '__main__' and sys.argv[1:] == ['placeholder']: placeholder()
else: print(__doc__)

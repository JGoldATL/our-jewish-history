#!/usr/bin/env python3
"""High-resolution map insets for the flat maps (F-149 prototype).

The flat maps (Movements, Archaeology) draw images/map-globe.webp (4800 x 2496 px, Natural Earth projection) across the whole world.
An inset is a sharper picture of one region, in the SAME projection, that the page lays over that image when you zoom in far enough.
Each inset is listed in images/inset/manifest.json with its box in map units (the units the page draws in, see nProj in movements.js).

    python3 tools/build-inset.py placeholder     # PLACEHOLDER: crops the existing map-globe.webp (same pixels, so NOT sharper); proves the swap and the alignment
    python3 tools/build-inset.py feather IN.png OUT.webp --deg 0.25 --px-per-deg 200   # bakes a soft edge (alpha fade) into a finished inset picture
    python3 tools/build-inset.py relief --id tier1-land-of-israel --dem RAW.tif --land land-10m.json --lakes ne_10m_lakes.geojson [--px-per-deg 220]
        REAL BUILD from elevation data (SRTMGL1 GeoTIFF in lon/lat, int16 metres, -32768 = no data). Raw data is NOT committed (F-156 records source and license).
        Hillshade -> cream relief (colors measured from the base picture) -> Natural Earth coast mask with the base's coast-effect curves (images/src/fx.json, scaled by degrees) -> baked feather -> webp with alpha; updates the manifest entry.
    Layering: the page draws the lowest "z" first, so Tier 2 (z 1) lies under Tier 1 (z 2), both over the base picture. Every inset's outer edge fades to clear over about 0.25 degree.

Needs: python3, Pillow, numpy; the relief command also needs opencv-python, tifffile and scipy, and tools/build-map.py (coast helpers).
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

# ---- real build from elevation data ----------------------------------------------------------------------------
NE_K = 180 / math.pi / 0.8707                      # base picture: pixels per map unit = (pixels per degree) * NE_K
BASE_SEA = np.array([77, 102, 102], np.float32)    # open-sea colour measured in map-globe.webp (#4d6666)
# land colours measured in the base picture inside the Tier 1 box (brightness percentiles 5, 50, 95); flat ground (hillshade = sin(altitude)) takes the median
LAND_P5, LAND_P50, LAND_P95 = np.array([175, 164, 145.]), np.array([240, 214, 189.]), np.array([247, 224, 198.])
def unproj(x, y):
    lat = np.array(y, dtype=np.float64)
    for _ in range(40):
        p2 = lat * lat; p4 = p2 * p2
        f = lat * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))) - y
        d = 1.007226 + p2 * (3 * 0.015085 + p4 * (-0.044475 * 7 + 0.028874 * 9 * p2 - 0.005916 * 11 * p4))
        lat = lat - f / d
    p2 = lat * lat; p4 = p2 * p2
    F = 0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))
    return x / F / D2R, lat / D2R
def relief_cmd(argv):
    import argparse, importlib.util, cv2, tifffile
    from scipy.ndimage import gaussian_filter, map_coordinates
    ap = argparse.ArgumentParser(); ap.add_argument('--id', required=True); ap.add_argument('--dem', required=True); ap.add_argument('--land', required=True); ap.add_argument('--lakes', required=True)
    ap.add_argument('--px-per-deg', type=float, default=220.0); ap.add_argument('--az', type=float, default=315.0); ap.add_argument('--alt', type=float, default=45.0)
    ap.add_argument('--exag', type=float, default=0.7); ap.add_argument('--sigma', type=float, default=1.6); ap.add_argument('--quality', type=int, default=82); ap.add_argument('--out'); ap.add_argument('--match-base', dest='match_base', type=int, default=1)
    a = ap.parse_args(argv)
    ins = next(i for i in INSETS if i[0] == a.id); id_, f, z, lo0, lo1, la0, la1, k = ins
    spec = importlib.util.spec_from_file_location('bm', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build-map.py')); bm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bm)
    dem = tifffile.imread(a.dem).astype(np.float32); H0, W0 = dem.shape
    # grid: the manifest box (map units) at the requested density, snapped to whole pixels
    K = a.px_per_deg * NE_K; x0, x1, y0, y1 = box(lo0, lo1, la0, la1)
    w, h = math.ceil((x1 - x0) * K), math.ceil((y1 - y0) * K); x1 = x0 + w / K; y0 = y1 - h / K
    mx = x0 + (np.arange(w) + .5) / K; my = y1 - (np.arange(h) + .5) / K; MX, MY = np.meshgrid(mx, my)
    lon, lat = unproj(MX, MY); valid = (lon >= lo0) & (lon <= lo1) & (lat >= la0) & (lat <= la1)
    nd = dem == -32768; dem[nd] = 0                                  # the only no-data block is open sea; sea level is right
    fx_ = np.clip((lon - lo0) / (lo1 - lo0) * (W0 - 1), 0, W0 - 1); fy_ = np.clip((la1 - lat) / (la1 - la0) * (H0 - 1), 0, H0 - 1)
    zz = map_coordinates(dem, [fy_, fx_], order=1, mode='nearest').astype(np.float32)
    zs = gaussian_filter(zz, a.sigma) if a.sigma > 0 else zz
    # metres per output pixel (local): east-west and north-south
    dmy = 1e-5; dydphi = (neY(lat + dmy) - neY(lat)) / (dmy * D2R)           # map units per degree of latitude
    dy_m = (1 / K) / dydphi * 111195.0; dx_m = (1 / K) / (D2R * np.array([neF(v) for v in lat[:, 0]])[:, None]) * 111195.0 * np.cos(lat * D2R)
    gx = np.gradient(zs * a.exag, axis=1) / dx_m; gy = np.gradient(zs * a.exag, axis=0) / dy_m      # per metre; rows go south, so dz/dnorth = -gy
    az, alt = a.az * D2R, a.alt * D2R
    # standard hillshade, north up: dz/dE = gx, dz/dN = -gy
    dzdE, dzdN = gx, -gy; slope = np.arctan(np.hypot(dzdE, dzdN)); aspect = np.arctan2(dzdE, -dzdN)     # aspect: compass direction the slope faces
    shade = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
    flat = math.sin(alt)
    t_lo = np.clip(shade / flat, 0, 1)[..., None]; t_hi = np.clip((shade - flat) / (1 - flat), 0, 1)[..., None]
    relief = np.where(shade[..., None] <= flat, LAND_P5 + (LAND_P50 - LAND_P5) * t_lo ** 1.0, LAND_P50 + (LAND_P95 - LAND_P50) * t_hi)
    # coast: Natural Earth land minus natural lakes, drawn at 4x and averaged (smooth edge); same coast-effect curves as the base, scaled from base pixels to degrees
    ss = 4; img = np.zeros((h * ss, w * ss), np.uint8)
    polys = bm.load_land(a.land); lakes = bm.load_lakes(a.lakes, 'region')
    def draw(ring, val):
        r = np.asarray(ring, np.float64)
        if r[:, 0].max() < lo0 - 1 or r[:, 0].min() > lo1 + 1 or r[:, 1].max() < la0 - 1 or r[:, 1].min() > la1 + 1: return
        px_ = np.array([proj(lo, la) for lo, la in r]); pts = np.c_[(px_[:, 0] - x0) * K * ss, (y1 - px_[:, 1]) * K * ss]
        cv2.fillPoly(img, [np.round(pts * 16).astype(np.int32)], val, lineType=cv2.LINE_AA, shift=4)
    for poly in sorted(polys, key=lambda p: -bm.poly_area_km2(p[0])):
        draw(poly[0], 1)
        for hole in poly[1:]: draw(hole, 0)
    for lk in lakes:
        draw(lk['rings'][0], 0)
        for isl in lk['rings'][1:]: draw(isl, 1)
    cov = img.reshape(h, ss, w, ss).mean((1, 3)) / 1.0
    fx = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'images', 'src', 'fx.json'))); prof = {kk: np.array(v, np.float32) for kk, v in fx['world'].items()}
    land = (cov >= 0.5).astype(np.uint8); d_in, d_out, th = bm.edge_geometry(land, False); dist_in = d_in
    base_px_per_deg = 4800 / 360.0; s = a.px_per_deg / base_px_per_deg                  # inset pixels per base pixel
    L = relief * bm.sane(bm.ratio(prof['land'], d_in / s, th), .8, 1.8); S = BASE_SEA * bm.sane(bm.ratio(prof['sea'], d_out / s, th), .55, 1.0)
    c = np.clip(cov, 0, 1)[..., None]
    if a.match_base:    # seam: scale the land colours so the inset's average land colour, seen at the base picture's resolution, equals the base's over the same ground
        base = np.array(Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'images', 'map-globe.webp')).convert('RGB')).astype(np.float64)
        BW_, BH_ = base.shape[1], base.shape[0]; bx0 = (x0 + NE_XM) / (2 * NE_XM) * BW_; by0 = (NE_YM - y1) / (2 * NE_YM) * BH_
        ys_, xs_ = np.mgrid[0:h, 0:w]; bi_ = np.round(by0 + (ys_ + .5) / K / (2 * NE_YM) * BH_).astype(int).clip(0, BH_ - 1); bj_ = np.round(bx0 + (xs_ + .5) / K / (2 * NE_XM) * BW_).astype(int).clip(0, BW_ - 1)
        bpix = base[bi_, bj_]; lm = (cov > .98) & valid & (dist_in > 4 * s) & (np.abs(bpix - BASE_SEA).max(2) >= 14)
        gain = bpix[lm].mean(0) / L[lm].mean(0); print('match-base gain on land colours (R,G,B):', gain.round(3)); L = np.clip(L * gain, 0, 255)
    rgb = np.clip(c * L + (1 - c) * S, 0, 255)
    # alpha: clear outside the true longitude/latitude box, rising to 1 over FEATHER_DEG inside it
    dist = cv2.distanceTransform(np.pad(valid, 1).astype(np.uint8), cv2.DIST_L2, 5)[1:-1, 1:-1]
    tt = np.clip(dist / (FEATHER_DEG * a.px_per_deg), 0, 1); alpha = (tt * tt * (3 - 2 * tt) * 255).round().astype(np.uint8)
    out = Image.fromarray(np.round(rgb).astype(np.uint8), 'RGB').convert('RGBA'); out.putalpha(Image.fromarray(alpha))
    dst = a.out or f; out.save(dst, quality=a.quality, method=6)
    man = json.load(open('images/inset/manifest.json'))
    for e in man['insets']:
        if e['id'] == id_:
            e.update(x0=round(x0, 6), x1=round(x1, 6), y0=round(y0, 6), y1=round(y1, 6), placeholder=False, featherDeg=FEATHER_DEG,
                     note='Real build: SRTMGL1 hillshade (az %g, alt %g, exag %g, sigma %g px), %g px/deg, coast from Natural Earth 10m, base colours measured from map-globe.webp' % (a.az, a.alt, a.exag, a.sigma, a.px_per_deg))
            e.pop('placeholder', None); e['placeholder'] = False
    json.dump(man, open('images/inset/manifest.json', 'w'), indent=1)
    print(id_, (w, h), 'px', os.path.getsize(dst), 'bytes; no-data px set to sea level:', int(nd.sum()), '; land share %.3f' % float(land.mean()))
if __name__ == '__main__' and sys.argv[1:] == ['placeholder']: placeholder()
elif __name__ == '__main__' and sys.argv[1:2] == ['relief']: relief_cmd(sys.argv[2:])
elif __name__ == '__main__' and sys.argv[1:2] == ['feather']: feather_cmd(sys.argv[2:])
else: print(__doc__)

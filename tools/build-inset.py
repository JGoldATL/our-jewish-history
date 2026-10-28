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
FEATHER_DEG = 0.4      # was 0.25; widened because the sharp Natural Earth coast and the base's soft coast showed a step at the Tier 2 west edge
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
# THE RECIPE (change values here or with the command-line options; the written record is tools/inset-recipe.md).
# Starting values from Strategy / Creative Design; the shading values are PROPOSALS until the seam review.
RECIPE = {
    'tier2-near-east':      dict(px_per_deg=100.0, az=315.0, alt=45.0, exag=0.7, sigma_deg=0.0073, strength=1.0, wrap=1.0, factor=6),   # SRTMGL3 1200/deg -> 200/deg by 6 x 6 averaging
    'tier1-land-of-israel': dict(px_per_deg=220.0, az=315.0, alt=45.0, exag=0.7, sigma_deg=0.011, strength=1.0, wrap=1.0, factor=1),   # SRTMGL1 600/deg as delivered
}
NE_K = 180 / math.pi / 0.8707                      # base picture: pixels per map unit = (pixels per degree) * NE_K
BASE_SEA = np.array([77, 102, 102], np.float32)    # open-sea colour measured in map-globe.webp (#4d6666), see check_sea_colour()
# land colours measured in the base picture inside the Tier 1 box (brightness percentiles 5, 50, 95); flat ground (hillshade = sin(altitude)) takes the median.
# The colour comes from the shading only, never from height, so land below sea level has the same colour as sea-level land (it is still shaded from its true height).
LAND_P5, LAND_P50, LAND_P95 = np.array([175, 164, 145.]), np.array([240, 214, 189.]), np.array([247, 224, 198.])
def neF_v(lat):
    p = lat * D2R; p2 = p * p; p4 = p2 * p2
    return 0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))
def neY_v(lat):
    p = lat * D2R; p2 = p * p; p4 = p2 * p2
    return p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
def unproj(x, y):
    """Map units -> (longitude, latitude), the inverse of proj()."""
    lat = np.array(y, dtype=np.float64)
    for _ in range(40):
        p2 = lat * lat; p4 = p2 * p2
        f = lat * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))) - y
        d = 1.007226 + p2 * (3 * 0.015085 + p4 * (-0.044475 * 7 + 0.028874 * 9 * p2 - 0.005916 * 11 * p4))
        lat = lat - f / d
    p2 = lat * lat; p4 = p2 * p2
    return x / (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))) / D2R, lat / D2R
def load_dem(paths, factor):
    """Join GeoTIFFs side by side (west to east, same rows) and average factor x factor blocks. Returns (array float32 metres, lon0, lat0, step) where lon0, lat0 are
    the outer corner of the top-left cell and step is the cell size in degrees (pixel-is-area; a cell centre is the corner plus half a step)."""
    import tifffile
    parts, lon0, lat0, step = [], None, None, None
    for pth in paths:
        t = tifffile.TiffFile(pth); pg = t.pages[0]; sc = pg.tags[33550].value; tp = pg.tags[33922].value
        a = pg.asarray()
        if factor > 1:
            hh, ww = (a.shape[0] // factor) * factor, (a.shape[1] // factor) * factor
            a = a[:hh, :ww].reshape(hh // factor, factor, ww // factor, factor).mean((1, 3), dtype=np.float64).astype(np.float32)
        else: a = a.astype(np.float32)
        nd = pg.tags[42113].value if 42113 in pg.tags else None
        if nd is not None and int(float(nd)) == -32768: a[a == -32768] = 0       # open-sea no-data cells: sea level (the sea itself is painted from the land mask)
        assert (a > -1000).all(), 'unexpected void values in ' + pth
        if lon0 is None: lon0, lat0, step = tp[3], tp[4], sc[0] * factor
        else:
            assert abs(tp[4] - lat0) < 1e-9 and abs(sc[0] * factor - step) < 1e-12 and a.shape[0] == parts[0].shape[0], 'tiles must have the same rows and cell size'
            assert abs(tp[3] - (lon0 + sum(q.shape[1] for q in parts) * step)) < step * 0.01, 'tiles must touch (no gap, no overlap): ' + pth
        parts.append(a)
    return np.hstack(parts), lon0, lat0, step
def ref_sampler(img_rgba, box_mu):
    """Sampler for a finished picture laid in the map: (MX, MY) map units -> RGB (nan outside or where the picture is clear)."""
    import cv2
    a = np.asarray(img_rgba, np.float32); hh, ww = a.shape[:2]; x0, x1, y0, y1 = box_mu
    def get(MX, MY):
        mapx = ((MX - x0) / (x1 - x0) * ww - .5).astype(np.float32); mapy = ((y1 - MY) / (y1 - y0) * hh - .5).astype(np.float32)
        out = cv2.remap(a, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0)[:a.shape[2]])
        rgb = out[..., :3].copy()
        if a.shape[2] == 4: rgb[out[..., 3] < 254] = np.nan                  # clear or feathered cells of an inset are not a usable reference
        return rgb
    return get
def relief_cmd(argv):
    import argparse, importlib.util, cv2
    from scipy.ndimage import gaussian_filter, map_coordinates
    ap = argparse.ArgumentParser(); ap.add_argument('--id', required=True); ap.add_argument('--dem', required=True, nargs='+', help='GeoTIFF(s), west to east'); ap.add_argument('--land', required=True); ap.add_argument('--lakes', required=True)
    ap.add_argument('--px-per-deg', type=float); ap.add_argument('--az', type=float); ap.add_argument('--alt', type=float); ap.add_argument('--exag', type=float); ap.add_argument('--sigma-deg', type=float)
    ap.add_argument('--strength', type=float, help='1 = full shading range of the colour ramp; lower is flatter'); ap.add_argument('--factor', type=int, help='block-average the DEM by this factor'); ap.add_argument('--wrap', type=float, help='soft light: 0 = plain hillshade (steep slopes facing away go flat black), 1 = half-lambert, no flat dark patches')
    ap.add_argument('--quality', type=int, default=82); ap.add_argument('--out'); ap.add_argument('--tone-ref', default='base', help="'base' (map-globe.webp) or the id of the inset beneath, whose finished file is matched at the outer band")
    ap.add_argument('--no-manifest', action='store_true'); ap.add_argument('--debug-npz', help='also save height, land coverage and grid for checks'); a = ap.parse_args(argv)
    here = os.path.dirname(os.path.abspath(__file__)); R = dict(RECIPE[a.id])
    for k in ('px_per_deg', 'az', 'alt', 'exag', 'sigma_deg', 'strength', 'wrap', 'factor'):
        v = getattr(a, k); R[k] = R[k] if v is None else v
    id_, f, z, lo0, lo1, la0, la1, kk = next(i for i in INSETS if i[0] == a.id)
    spec = importlib.util.spec_from_file_location('bm', os.path.join(here, 'build-map.py')); bm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bm)
    dem, dlon0, dlat0, dstep = load_dem(a.dem, R['factor']); H0, W0 = dem.shape
    # output grid: the manifest box (map units) at the requested density, snapped to whole pixels
    K = R['px_per_deg'] * NE_K; x0, x1, y0, y1 = box(lo0, lo1, la0, la1)
    w, h = math.ceil((x1 - x0) * K), math.ceil((y1 - y0) * K); x1 = x0 + w / K; y0 = y1 - h / K
    MX, MY = np.meshgrid(x0 + (np.arange(w) + .5) / K, y1 - (np.arange(h) + .5) / K)
    lon, lat = unproj(MX, MY); valid = (lon >= lo0) & (lon <= lo1) & (lat >= la0) & (lat <= la1)
    zz = map_coordinates(dem, [(dlat0 - lat) / dstep - .5, (lon - dlon0) / dstep - .5], order=1, mode='nearest').astype(np.float32)
    sig = R['sigma_deg'] * R['px_per_deg']; zs = gaussian_filter(zz, sig) if sig > 0 else zz        # smoothing is set in degrees, so every tier is equally smooth on the ground
    # metres per output pixel, east-west and north-south (local)
    dmy = 1e-5; dydphi = (neY_v(lat + dmy) - neY_v(lat)) / (dmy * D2R)
    dy_m = (1 / K) / dydphi * 111195.0; dx_m = (1 / K) / (D2R * neF_v(lat)) * 111195.0 * np.cos(lat * D2R)
    gx = np.gradient(zs * R['exag'], axis=1) / dx_m; gy = np.gradient(zs * R['exag'], axis=0) / dy_m
    azr, altr = R['az'] * D2R, R['alt'] * D2R; dzdE, dzdN = gx, -gy                              # rows run south, so dz/dnorth = -gy
    slope = np.arctan(np.hypot(dzdE, dzdN)); aspect = np.arctan2(dzdE, -dzdN)
    inc = np.sin(altr) * np.cos(slope) + np.cos(altr) * np.sin(slope) * np.cos(azr - aspect)        # cosine of the angle between the light and the ground normal (negative = facing away)
    wr = R['wrap']; flat = (math.sin(altr) + wr) / (1 + wr); shade = np.clip((inc + wr) / (1 + wr), 0, 1)   # wrap > 0 lights the far side softly, so steep dark slopes keep their shape instead of one flat dark colour
    shade = np.clip(flat + (shade - flat) * R['strength'], 0, 1)
    t_lo = np.clip(shade / flat, 0, 1)[..., None]; t_hi = np.clip((shade - flat) / (1 - flat), 0, 1)[..., None]
    relief = np.where(shade[..., None] <= flat, LAND_P5 + (LAND_P50 - LAND_P5) * t_lo, LAND_P50 + (LAND_P95 - LAND_P50) * t_hi)
    # coast: Natural Earth land minus natural lakes (sea and lakes are painted from the mask, never from height), drawn at 4x and averaged
    ss = 4; img = np.zeros((h * ss, w * ss), np.uint8); polys = bm.load_land(a.land); lakes = bm.load_lakes(a.lakes, 'region')
    def draw(ring, val):
        r = np.asarray(ring, np.float64)
        if r[:, 0].max() < lo0 - 1 or r[:, 0].min() > lo1 + 1 or r[:, 1].max() < la0 - 1 or r[:, 1].min() > la1 + 1: return
        pxv = np.c_[r[:, 0] * D2R * neF_v(r[:, 1]), neY_v(r[:, 1])]; pts = np.c_[(pxv[:, 0] - x0) * K * ss, (y1 - pxv[:, 1]) * K * ss]
        cv2.fillPoly(img, [np.round(pts * 16).astype(np.int32)], val, lineType=cv2.LINE_AA, shift=4)
    for poly in sorted(polys, key=lambda p: -bm.poly_area_km2(p[0])):
        draw(poly[0], 1)
        for hole in poly[1:]: draw(hole, 0)
    for lk in lakes:
        draw(lk['rings'][0], 0)
        for isl in lk['rings'][1:]: draw(isl, 1)
    cov = img.reshape(h, ss, w, ss).mean((1, 3))
    fx = json.load(open(os.path.join(here, '..', 'images', 'src', 'fx.json'))); prof = {kx: np.array(v, np.float32) for kx, v in fx['world'].items()}
    land = (cov >= 0.5).astype(np.uint8); d_in, d_out, th = bm.edge_geometry(land, False)
    s = R['px_per_deg'] / (4800 / 360.0)                                                       # output pixels per base pixel: the coast-effect curves are scaled from base pixels to degrees
    L = relief * bm.sane(bm.ratio(prof['land'], d_in / s, th), .8, 1.8); S = BASE_SEA * bm.sane(bm.ratio(prof['sea'], d_out / s, th), .55, 1.0)
    c = np.clip(cov, 0, 1)[..., None]
    # tone: scale the land colours so the outer band (0.15 to 0.8 degree inside the edge) averages what the layer beneath shows there
    dist = cv2.distanceTransform(np.pad(valid, 1).astype(np.uint8), cv2.DIST_L2, 5)[1:-1, 1:-1]; band = (dist > .15 * R['px_per_deg']) & (dist < .8 * R['px_per_deg'])
    if a.tone_ref == 'base':
        base = np.array(Image.open(os.path.join(here, '..', 'images', 'map-globe.webp')).convert('RGB'), np.float32)
        ref = ref_sampler(base, (-NE_XM, NE_XM, -NE_YM, NE_YM))
    else:
        mf = json.load(open('images/inset/manifest.json'))['insets']; e = next(q for q in mf if q['id'] == a.tone_ref)
        ref = ref_sampler(np.array(Image.open(e['file']).convert('RGBA'), np.float32), (e['x0'], e['x1'], e['y0'], e['y1']))
    bref = ref(MX, MY); lm = band & (cov > .98) & (d_in > 3 * s) & ~np.isnan(bref).any(2) & (np.abs(bref - BASE_SEA).max(2) >= 14)
    gain = bref[lm].mean(0) / L[lm].mean(0); L = np.clip(L * gain, 0, 255)
    # contrast of the outer band, for the record (the inset is sharper, so it is higher; the mean is what is matched)
    cr = float(L[lm].std() / max(1e-6, bref[lm].std())); rgb = np.clip(c * L + (1 - c) * S, 0, 255)
    tt = np.clip(dist / (FEATHER_DEG * R['px_per_deg']), 0, 1); alpha = (tt * tt * (3 - 2 * tt) * 255).round().astype(np.uint8)      # soft edge on the projected geographic boundary
    out = Image.fromarray(np.round(rgb).astype(np.uint8), 'RGB').convert('RGBA'); out.putalpha(Image.fromarray(alpha))
    dst = a.out or f; out.save(dst, quality=a.quality, method=6)
    if a.debug_npz: np.savez_compressed(a.debug_npz, z=zz, cov=cov.astype(np.float32), lon=lon.astype(np.float32), lat=lat.astype(np.float32), shade=shade.astype(np.float32))
    if not a.no_manifest:
        man = json.load(open('images/inset/manifest.json'))
        for e in man['insets']:
            if e['id'] == id_:
                e.update(x0=round(x0, 6), x1=round(x1, 6), y0=round(y0, 6), y1=round(y1, 6), placeholder=False, featherDeg=FEATHER_DEG,
                         note='Real build (%s): hillshade az %g alt %g exag %g sigma %g deg strength %g wrap %g, %g px/deg, coast from Natural Earth 10m, tone matched to %s. See tools/inset-recipe.md' % (a.id, R['az'], R['alt'], R['exag'], R['sigma_deg'], R['strength'], R['wrap'], R['px_per_deg'], a.tone_ref))
        json.dump(man, open('images/inset/manifest.json', 'w'), indent=1)
    lum = lambda v: v @ np.array([.2126, .7152, .0722])
    print(id_, (w, h), 'px', os.path.getsize(dst), 'bytes; land share %.3f' % float(land.mean()), '; tone gain RGB', gain.round(3), '; outer-band contrast vs beneath x%.2f' % cr,
          '; darkest land (1st percentile) %.0f of 255' % np.percentile(lum(rgb[land == 1]), 1), '; band px', int(lm.sum()))
if __name__ == '__main__' and sys.argv[1:] == ['placeholder']: placeholder()
elif __name__ == '__main__' and sys.argv[1:2] == ['relief']: relief_cmd(sys.argv[2:])
elif __name__ == '__main__' and sys.argv[1:2] == ['feather']: feather_cmd(sys.argv[2:])
else: print(__doc__)

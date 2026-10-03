#!/usr/bin/env python3
"""Globe base-map builder (Pass A: accurate land and water).

Builds images/tex-region.jpg, images/tex-world.jpg and the coast layer of data/geo.json from
  * Natural Earth 10m land  (public domain, via the npm package world-atlas: land-10m.json)
  * Natural Earth 10m lakes (public domain, ne_10m_lakes.geojson)
  * the baked relief layers in images/src/ (cream raised relief, no coast effects)
  * the coast effect profile in images/src/fx.json (rim light and drop shadow, measured from the approved textures)

Get the two Natural Earth files:
    npm pack world-atlas@2.0.2 && tar xzf world-atlas-2.0.2.tgz package/land-10m.json
    curl -O https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson

Run from the repo root:
    python3 tools/build-map.py build   --land package/land-10m.json --lakes ne_10m_lakes.geojson
    python3 tools/build-map.py extract --land ... --lakes ... --old-region OLD_tex-region.jpg --old-world OLD_tex-world.jpg
(`extract` was run once, on the textures of commit 77355dd, to make images/src/. Pass B, sharper relief from elevation data,
only has to replace the two relief files in images/src/; the mask and effects stay the same.)

Needs: python3, numpy, opencv-python (cv2), Pillow.
"""
import argparse, json, math, os, sys
import numpy as np, cv2

REGION = dict(name='region', lon0=-20.0, lon1=80.0, lat0=0.0, lat1=60.0, w=2000, h=1200, wrap=False)
WORLD = dict(name='world', lon0=-180.0, lon1=180.0, lat0=-90.0, lat1=90.0, w=2048, h=1024, wrap=True)
SEA = np.array([77, 103, 104], np.float32)          # deep teal sea of the approved look
LAND_THRESHOLD = 0.5                                 # share of a pixel that must be land for the edge geometry (edges are blended by coverage)

# ---- which lakes belong on an ancient map -------------------------------------------------------------------
# Natural Earth marks 20th-century dam lakes as featurecla "Reservoir" (Lake Nasser 1970, Tharthar, Assad, Ataturk, ...).
NATURAL_DESPITE_CLASS = {"Lake Il'Men'", 'Ozero Kubenskoye'}     # natural lakes whose level a dam later raised
NOT_ANCIENT = {'Lake Razazah': 'drawn by the previous data as the second Iraqi reservoir (Razzaza flood-diversion lake)',
               'North Aral Sea': 'modern remnant inside the older Aral outline', 'South Aral Sea': 'same',
               'Barsakelmes Lake': 'inside the older Aral outline'}
ALWAYS = {'Sea of Galilee', 'Dead Sea', 'Great Bitter Lake', 'Lake Hammar'}  # story lakes, drawn even when small
MIN_KM2 = {'region': 400.0, 'world': 3000.0}


def poly_area_km2(ring):
    r = np.asarray(ring); lat = math.radians(r[:, 1].mean())
    x = r[:, 0] * 111.32 * math.cos(lat); y = r[:, 1] * 110.57
    return abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))) / 2


def load_land(path):
    """TopoJSON land -> list of polygons, each a list of rings [(lon, lat) ...] (first ring outer, others holes)."""
    t = json.load(open(path)); sc, tr = t['transform']['scale'], t['transform']['translate']
    arcs = []
    for a in t['arcs']:
        a = np.array(a, np.int64); a = np.cumsum(a, axis=0)
        arcs.append(np.c_[a[:, 0] * sc[0] + tr[0], a[:, 1] * sc[1] + tr[1]])
    def ring(idx):
        pts = []
        for i in idx:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.append(seg if not pts else seg[1:])
        return np.vstack(pts)
    polys = []
    def walk(g):
        if g['type'] == 'GeometryCollection':
            for x in g['geometries']: walk(x)
        elif g['type'] == 'Polygon': polys.append([ring(r) for r in g['arcs']])
        elif g['type'] == 'MultiPolygon':
            for p in g['arcs']: polys.append([ring(r) for r in p])
    for o in t['objects'].values(): walk(o)
    return polys


def load_lakes(path, kind):
    """Natural lakes worth drawing at this scale -> list of polygons (outer ring + island holes) with their names."""
    out = []
    for f in json.load(open(path))['features']:
        p, g = f['properties'], f['geometry']; name = p.get('name') or ''
        if p.get('featurecla') == 'Reservoir' and name not in NATURAL_DESPITE_CLASS: continue
        if any(k in name for k in ('Reservoir', 'Baraj', 'Dam')) or name in NOT_ANCIENT: continue
        for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
            if name in ALWAYS or poly_area_km2(poly[0]) >= MIN_KM2[kind]:
                out.append(dict(name=name, rings=[np.asarray(r) for r in poly]))
    return out


def fill(img, ring, tex, value, ss):
    shifts = [0.0]
    if (np.abs(np.diff(ring[:, 0])) > 180).any():                    # the ring crosses the date line (Chukotka, Wrangel, Fiji) or is cut there (Antarctica)
        if ring[:, 1].max() < -50:                                   # Antarctica: its ring stops short of the pole, close it down to 90 S
            ring = np.vstack([ring[:-1], [180.0, -90.0], [-180.0, -90.0]])   # (the ring is closed: it starts and ends on the date line at 84.35 S)
        else:                                                        # unwrap it so it is one continuous shape, and draw it on both sides of the date line
            ring = ring.copy(); ring[:, 0] = np.degrees(np.unwrap(np.radians(ring[:, 0]))); shifts = [-360.0, 0.0, 360.0]
    for sh in shifts:
        x = (ring[:, 0] + sh - tex['lon0']) / (tex['lon1'] - tex['lon0']) * tex['w'] * ss
        y = (tex['lat1'] - ring[:, 1]) / (tex['lat1'] - tex['lat0']) * tex['h'] * ss
        cv2.fillPoly(img, [np.round(np.c_[x, y] * 16).astype(np.int32)], value, lineType=cv2.LINE_8, shift=4)


def box_of(ring): return ring[:, 0].min(), ring[:, 0].max(), ring[:, 1].min(), ring[:, 1].max()


def land_coverage(polys, lakes, tex, ss=4):
    """Share of every texture pixel that is land (0..1): land polygons, minus natural lakes, drawn big to small."""
    pad = 8 if tex['wrap'] else 0   # not needed for NE data, which is cut at the date line
    img = np.zeros((tex['h'] * ss, tex['w'] * ss), np.uint8)
    lo0, lo1, la0, la1 = tex['lon0'] - .5, tex['lon1'] + .5, tex['lat0'] - .5, tex['lat1'] + .5
    sel = []
    for p in polys:
        b = box_of(p[0])
        if b[1] >= lo0 and b[0] <= lo1 and b[3] >= la0 and b[2] <= la1: sel.append(p)
    sel.sort(key=lambda p: -(box_of(p[0])[1] - box_of(p[0])[0]) * (box_of(p[0])[3] - box_of(p[0])[2]))
    for p in sel:
        fill(img, p[0], tex, 255, ss)
        for h in p[1:]: fill(img, h, tex, 0, ss)
    for lk in sorted(lakes, key=lambda l: -(box_of(l['rings'][0])[1] - box_of(l['rings'][0])[0]) * (box_of(l['rings'][0])[3] - box_of(l['rings'][0])[2])):
        b = box_of(lk['rings'][0])
        if not (b[1] >= lo0 and b[0] <= lo1 and b[3] >= la0 and b[2] <= la1): continue
        fill(img, lk['rings'][0], tex, 0, ss)
        for h in lk['rings'][1:]: fill(img, h, tex, 255, ss)
    return cv2.resize(img, (tex['w'], tex['h']), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0



# ---- coast effects: rim light on the land edge, drop shadow on the water ---------------------------------------
def edge_geometry(land, wrap):
    """Distance inside land, distance into water, and the direction from land towards water, for every pixel."""
    pad = 24 if wrap else 0
    m = np.pad(land, ((0, 0), (pad, pad)), mode='wrap') if pad else land
    d_in = cv2.distanceTransform(m, cv2.DIST_L2, 5); d_out = cv2.distanceTransform(1 - m, cv2.DIST_L2, 5)
    sm = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 2.0)
    th = np.arctan2(-cv2.Sobel(sm, cv2.CV_32F, 0, 1), -cv2.Sobel(sm, cv2.CV_32F, 1, 0))
    c = (slice(None), slice(pad, pad + land.shape[1]))
    return d_in[c], d_out[c], th[c]


def nn_fill(img, valid, wrap):
    """Extend `img` from its valid pixels to all pixels: the average colour of the valid land around (so new islands and coast
    pixels come out cream, not the shade of the nearest slope); wider averages for big gaps; the nearest valid pixel as last resort."""
    pad = 24 if wrap else 0
    im = np.pad(img, ((0, 0), (pad, pad), (0, 0)), mode='wrap') if pad else img
    v = np.pad(valid, ((0, 0), (pad, pad)), mode='wrap') if pad else valid
    _, lab = cv2.distanceTransformWithLabels((~v).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
    ys, xs = np.nonzero(v); out = cv2.GaussianBlur(im[ys[lab - 1], xs[lab - 1]], (0, 0), 2.0)
    vf = v.astype(np.float32)
    for sigma in (96.0, 24.0, 6.0):                                  # coarse to fine: finer averages overwrite where enough land is near
        w = cv2.GaussianBlur(vf, (0, 0), sigma)
        avg = cv2.GaussianBlur(im * vf[..., None], (0, 0), sigma) / np.maximum(w, 1e-6)[..., None]
        mix = np.clip(w / 0.08, 0, 1)[..., None]
        out = mix * avg + (1 - mix) * out
    out = np.where(v[..., None], im, out)
    return out[:, pad:pad + img.shape[1]]


def old_land_mask(img):
    land = ((img[..., 0] - img[..., 2]) > 4).astype(np.uint8)
    return cv2.morphologyEx(land, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))


def ratio(table, d, th):
    """Brightness ratio at distance d and direction th: a + b*cos(th) + c*sin(th), interpolated between whole-pixel distances."""
    D = table.shape[0] - 1; df = np.clip(d, 1, D); lo = np.floor(df).astype(int); hi = np.minimum(lo + 1, D); t = (df - lo)[..., None, None]
    co = table[lo] * (1 - t) + table[hi] * t                         # (H, W, 3 channels, 3 coefficients)
    r = co[..., 0] + co[..., 1] * np.cos(th)[..., None] + co[..., 2] * np.sin(th)[..., None]
    return np.where(((d > D) | (d < .5))[..., None], 1.0, r)     # no effect where the pixel is not on that side of the coast


def fit_profile(img, land, wrap, nland=7, nsea=10):
    d_in, d_out, th = edge_geometry(land, wrap)
    base = nn_fill(img, (land == 1) & (d_in > nland), wrap)           # land colour without the rim effect
    def fit(sel_mask, dist, ref, n):
        tab = np.ones((n + 1, 3, 3), np.float32)
        for d in range(1, n + 1):
            m = sel_mask & (np.round(dist) == d)
            if m.sum() < 300: continue
            X = np.c_[np.ones(m.sum()), np.cos(th[m]), np.sin(th[m])]
            for c in range(3): tab[d, c] = np.linalg.lstsq(X, (img[..., c][m] / np.maximum(ref[..., c][m], 1)), rcond=None)[0]
        tab[0] = tab[1]; return tab
    return dict(land=fit(land == 1, d_in, base, nland), sea=fit(land == 0, d_out, np.broadcast_to(SEA, img.shape), nsea))


def sane(r, lo, hi):
    """Keep the three channel ratios ordered R >= G >= B (as measured) so narrow inlets never turn cyan."""
    r = np.clip(r, lo, hi); r[..., 1] = np.minimum(r[..., 1], r[..., 0]); r[..., 2] = np.minimum(r[..., 2], r[..., 1]); return r


def apply_effects(relief, cov, prof, wrap):
    """Cream relief with rim light on land, teal sea with drop shadow; edge pixels blend by coverage, so coasts and tiny islands stay smooth."""
    land = (cov >= LAND_THRESHOLD).astype(np.uint8); d_in, d_out, th = edge_geometry(land, wrap)
    L = relief * sane(ratio(prof['land'], d_in, th), .8, 1.8)
    S = SEA * sane(ratio(prof['sea'], d_out, th), .55, 1.0)      # shadow only: the old 1-pixel halo was edge blending
    c = np.clip(cov, 0, 1)[..., None]
    return np.clip(c * L + (1 - c) * S, 0, 255)


def strip_effects(img, land, prof, wrap):
    """Old texture -> relief colours with the rim effect divided out (land pixels only)."""
    d_in, _, th = edge_geometry(land, wrap)
    return np.clip(img / np.maximum(ratio(prof['land'], d_in, th), .5), 0, 255)


def read_rgb(p): return cv2.imread(p)[:, :, ::-1].astype(np.float32)
def write_jpg(p, rgb, q=93):
    cv2.imwrite(p, np.round(rgb).astype(np.uint8)[:, :, ::-1], [cv2.IMWRITE_JPEG_QUALITY, q, cv2.IMWRITE_JPEG_SAMPLING_FACTOR, cv2.IMWRITE_JPEG_SAMPLING_FACTOR_444])


# ---- relief layers ------------------------------------------------------------------------------------------
def recolor_patches(img, patch, trusted):
    """Cold bluish pixels (snow, tundra) that the old colour key took for water: map their brightness onto the cream ramp."""
    Y = lambda a: .299 * a[..., 0] + .587 * a[..., 1] + .114 * a[..., 2]
    y = Y(img); bins = np.linspace(np.percentile(y[trusted], 1), np.percentile(y[trusted], 99), 48); idx = np.digitize(y[trusted], bins)
    cen = np.array([y[trusted][idx == i].mean() if (idx == i).sum() > 200 else np.nan for i in range(1, len(bins))])
    cols = np.stack([np.array([img[..., c][trusted][idx == i].mean() if (idx == i).sum() > 200 else np.nan for i in range(1, len(bins))]) for c in range(3)], 1)
    ok = ~np.isnan(cen); out = np.empty(img.shape, np.float32)
    for c in range(3): out[..., c] = np.interp(y, cen[ok], cols[ok, c])
    return out


def cmd_extract(a):
    polys = load_land(a.land); fx = {}; os.makedirs(f'{a.out}/images/src', exist_ok=True)
    for tex, old in ((REGION, a.old_region), (WORLD, a.old_world)):
        img = read_rgb(old); land_old = old_land_mask(img); wrap = tex['wrap']
        prof = fit_profile(img, land_old, wrap); fx[tex['name']] = {k: np.round(v, 4).tolist() for k, v in prof.items()}
        new = (land_coverage(polys, load_lakes(a.lakes, tex['name']), tex) >= LAND_THRESHOLD).astype(np.uint8)
        d_new, _, _ = edge_geometry(new, wrap); d_old, _, _ = edge_geometry(land_old, wrap)
        patch = (new == 1) & (land_old == 0) & (d_new > 4)                      # land by Natural Earth, "water" by the old colour key
        trusted = (land_old == 1) & (d_old > 8); Y = lambda a: .299 * a[..., 0] + .587 * a[..., 1] + .114 * a[..., 2]
        sea_painted = np.abs(img - SEA).max(-1) < 30                             # painted plain sea colour: no relief left to recover
        recolor = patch & ~sea_painted & (Y(img) >= np.percentile(Y(img)[trusted], 1))
        rel = strip_effects(img, land_old, prof, wrap)
        rel = np.where(recolor[..., None], recolor_patches(img, recolor, trusted), rel)
        rel = nn_fill(rel, (land_old == 1) | recolor, wrap)                      # the rest of `patch` is filled from the land around it
        write_jpg(f"{a.out}/images/src/relief-{tex['name']}.jpg", rel, 95)
        print(tex['name'], 'patch pixels:', int(patch.sum()), ' recolored from bluish-white:', int(recolor.sum()), ' filled from surrounding land:', int((patch & ~recolor).sum()))
    json.dump(fx, open(f'{a.out}/images/src/fx.json', 'w'))


def cmd_build(a):
    polys = load_land(a.land); fx = json.load(open(f'{a.out}/images/src/fx.json'))
    for tex in (REGION, WORLD):
        lakes = load_lakes(a.lakes, tex['name']); cov = land_coverage(polys, lakes, tex); land = (cov >= LAND_THRESHOLD).astype(np.uint8)
        prof = {k: np.array(v, np.float32) for k, v in fx[tex['name']].items()}
        rel = read_rgb(f"{a.out}/images/src/relief-{tex['name']}.jpg")
        write_jpg(f"{a.out}/images/tex-{tex['name']}.jpg", apply_effects(rel, cov, prof, tex['wrap']), 92)
        print(tex['name'], len(lakes), 'lakes drawn; land share', round(float(land.mean()), 4))
    build_geo(polys, load_lakes(a.lakes, 'region'), f'{a.out}/data/geo.json')


# ---- vector coast (the faint outline drawn over the globe) ----------------------------------------------------
GEO_BOX = (-15.0, 5.0, 65.0, 58.0)     # same area the previous coast layer covered
def cross(p, q, b):
    t = 0.0
    for ax, lo, hi in ((0, b[0], b[2]), (1, b[1], b[3])):
        d = q[ax] - p[ax]
        if d != 0 and p[ax] < lo: t = max(t, (lo - p[ax]) / d)
        if d != 0 and p[ax] > hi: t = max(t, (hi - p[ax]) / d)
    return p + t * (q - p)


def clip_ring(r, b):
    ins = (r[:, 0] >= b[0]) & (r[:, 0] <= b[2]) & (r[:, 1] >= b[1]) & (r[:, 1] <= b[3])
    if ins.all(): return [r]
    if not ins.any(): return []
    idx = np.flatnonzero(ins); out = []
    for run in np.split(idx, np.flatnonzero(np.diff(idx) > 1) + 1):
        pts = r[run[0]:run[-1] + 1]
        if run[0] > 0: pts = np.vstack([cross(r[run[0] - 1], r[run[0]], b), pts])
        if run[-1] < len(r) - 1: pts = np.vstack([pts, cross(r[run[-1] + 1], r[run[-1]], b)])
        out.append(pts)
    return out


def build_geo(polys, lakes, path, eps=0.012, chunk=160):
    """Coast + natural-lake outlines from Natural Earth, simplified to ~1 km and cut into short pieces so the page can skip off-screen ones."""
    rings = [r for p in polys for r in p] + [r for lk in lakes for r in lk['rings'][:1]]
    lines = []
    for r in rings:
        bx = box_of(r)
        if bx[1] < GEO_BOX[0] or bx[0] > GEO_BOX[2] or bx[3] < GEO_BOX[1] or bx[2] > GEO_BOX[3]: continue
        for pts in clip_ring(r, GEO_BOX):
            if len(pts) < 3: continue
            if pts[0].tolist() == pts[-1].tolist() and len(pts) < 5 and box_of(pts)[1] - box_of(pts)[0] < 0.02: continue
            s = cv2.approxPolyDP(pts.astype(np.float32).reshape(-1, 1, 2), eps, False).reshape(-1, 2)
            for i in range(0, max(1, len(s) - 1), chunk - 1):
                piece = s[i:i + chunk]
                if len(piece) >= 2: lines.append(np.round(piece.astype(np.float64), 3).tolist())
    g = json.load(open(path)); g['coast'] = lines
    json.dump(g, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
    print('coast pieces', len(lines), 'points', sum(len(l) for l in lines), 'file bytes', os.path.getsize(path))

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['build', 'extract'])
    ap.add_argument('--land', required=True); ap.add_argument('--lakes', required=True); ap.add_argument('--old-region'); ap.add_argument('--old-world')
    ap.add_argument('--out', default='.', help='repo root to write into')
    a = ap.parse_args(); {'build': cmd_build, 'extract': cmd_extract}[a.cmd](a)

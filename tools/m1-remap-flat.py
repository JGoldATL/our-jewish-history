#!/usr/bin/env python3
"""STOPGAP (not the real M1 build). Recolours the aged flat map and the two insets to the M1 Satellite C palette.
The real pictures need tools/build-inset.py (SRTM DEMs, not available) and a source for images/map-globe.webp (no generator in the repo).
This script takes land/sea from the aged pictures' own colours (blue minus red) and the relief from their brightness,
then applies the same M1 recipe as tools/build-map.py build-m1. Writes images/m1/map-globe.webp and images/m1/inset/*.webp.
Usage: python3 tools/m1-remap-flat.py"""
import os, sys, numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location('bm', os.path.join(os.path.dirname(__file__), 'build-map.py')); bm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bm)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def remap(rgb, alpha=None):
    rgb = rgb.astype(np.float32)
    sea = (rgb[..., 2] - rgb[..., 0]) > 8
    land = ~sea
    g = rgb.mean(axis=2)
    ref = np.median(g[land]) if land.any() else 128
    f = g / ref
    f = cv2.GaussianBlur(f, (0, 0), 0.6)
    out = bm.m1_land_rgb(f)
    d = cv2.distanceTransform(sea.astype(np.uint8) ^ 1, cv2.DIST_L2, 5) if False else cv2.distanceTransform((~land).astype(np.uint8), cv2.DIST_L2, 5)
    w = np.clip(1 - d / 16, 0, 1)[..., None] * bm.M1['shallow']
    seac = bm.M1_SEA * (1 - w) + bm.M1_SHALLOW * w
    soft = cv2.GaussianBlur(land.astype(np.float32), (0, 0), 0.8)[..., None]
    res = out * soft + seac * (1 - soft)
    return np.clip(res, 0, 255).astype(np.uint8)

os.makedirs(f'{root}/images/m1/inset', exist_ok=True)
im = Image.open(f'{root}/images/map-globe.webp').convert('RGB')
Image.fromarray(remap(np.array(im))).save(f'{root}/images/m1/map-globe.webp', quality=80, method=6)
print('map-globe', os.path.getsize(f'{root}/images/m1/map-globe.webp'))
for n in ('tier1-land-of-israel', 'tier2-near-east'):
    im = Image.open(f'{root}/images/inset/{n}.webp').convert('RGBA'); a = np.array(im)
    rgb = remap(a[..., :3]); out = np.dstack([rgb, a[..., 3]])
    Image.fromarray(out, 'RGBA').save(f'{root}/images/m1/inset/{n}.webp', quality=82, method=6)
    print(n, os.path.getsize(f'{root}/images/m1/inset/{n}.webp'))

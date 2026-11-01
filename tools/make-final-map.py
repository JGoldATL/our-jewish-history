#!/usr/bin/env python3
"""F-021 final map, step 2: draw the present-day country images and the states data the page needs.

Inputs
  --geojson  Natural Earth 50m countries from tools/export-countries.cjs (current borders; ONE line source, no hand-drawn changes)
  --states   Dataset's states file (CSV from the "final map states" tab): State, Muslim share percent (Pew, 2020), Share year,
             Muslim-majority, Arab League member, Arab League year joined, Footnote (internal; never copied out)
Outputs
  images/final-fill.png    RGB 4096x2048, equirectangular: R = Muslim-majority sovereign state (anti-aliased), G = Arab League member
  images/final-border.png  grayscale 4096x2048 (sampled with NEAREST): 0 none, 100 slate land border, 180 ink (Israel outline), 255 cream (beside green)
  data/states.json         label points, shares, Arab League years, and the two dashed outlines (West Bank and Gaza, Western Sahara)

Rules (Jeffrey and Dataset, 2026-10-31): sovereign states only. Kosovo is in (green, footnote). Western Sahara and Mayotte are not filled.
West Bank and Gaza and Western Sahara get a thin dashed outline, no fill, no label (drawn by the page from states.json). Somaliland is drawn with Somalia.
Golan Heights and East Jerusalem follow Natural Earth (inside Israel). Israel is plain with a solid ink outline. Nothing here is hand-edited.
Problems are reported, never fixed.
"""
import argparse, csv, json, sys, hashlib
from PIL import Image, ImageDraw
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.validation import make_valid

W, H, SS = 4096, 2048, 2
ALIAS = {"Bosnia and Herzegovina": "Bosnia and Herz."}          # state name in Dataset's file -> Natural Earth name
WITH = {"Somalia": ["Somaliland"]}                              # drawn together
DASHED = {"westBankGaza": "Palestine", "westernSahara": "W. Sahara"}
SLATE, INK, CREAM = 100, 180, 255


def polys(g):
    return list(g.geoms) if g.geom_type == "MultiPolygon" else [g]


def lines(g):
    if g.is_empty:
        return []
    t = g.geom_type
    if t == "LineString":
        return [g]
    if t in ("MultiLineString", "GeometryCollection"):
        return [x for p in g.geoms for x in lines(p)]
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--geojson", required=True), ap.add_argument("--states", required=True)
    ap.add_argument("--out-fill", default="images/final-fill.png"), ap.add_argument("--out-border", default="images/final-border.png")
    ap.add_argument("--out-json", default="data/states.json")
    a = ap.parse_args()

    gj = json.load(open(a.geojson))
    feats = {f["properties"]["name"]: make_valid(shape(f["geometry"])) for f in gj["features"] if f["properties"]["name"] != "Antarctica"}   # Antarctica is invalid in the source and plays no part here
    rows = list(csv.DictReader(open(a.states, encoding="utf-8-sig")))
    problems = []

    def key(r, k):
        for h in r:
            if h.strip().startswith(k):
                return (r[h] or "").strip()
        return ""

    states = []
    for r in rows:
        name = key(r, "State")
        ne = ALIAS.get(name, name)
        if ne not in feats:
            problems.append("State %r not found in Natural Earth (looked for %r)" % (name, ne)); continue
        if key(r, "Muslim-majority") != "Yes":
            problems.append("%s: Muslim-majority is not Yes (this list is only the Muslim-majority states)" % name)
        geom = unary_union([feats[ne]] + [feats[x] for x in WITH.get(name, []) if x in feats])
        try:
            share = float(key(r, "Muslim share percent"))
        except ValueError:
            problems.append("%s: share is not a number" % name); continue
        arab = key(r, "Arab League member") == "Yes"
        joined = int(key(r, "Arab League year joined")) if arab and key(r, "Arab League year joined") else None
        if arab and not joined: problems.append("%s: Arab League member without a year joined" % name)
        states.append({"name": name, "geom": geom, "share": share, "shareYear": int(key(r, "Share year") or 0), "arab": arab, "joined": joined})
    names = [s["name"] for s in states]
    if len(set(names)) != len(names): problems.append("duplicate state names")
    for need in list(DASHED.values()) + ["Israel"]:
        if need not in feats: problems.append("Natural Earth has no %r" % need)
    if "Palestine" in names or "West Bank" in names: problems.append("a non-sovereign entity is in the states file")
    if problems:
        print("Problems: %d" % len(problems)); [print("  -", p) for p in problems]
        sys.exit(1)

    def px(lon, lat, w, h):
        return ((lon + 180.0) / 360.0 * w, (90.0 - lat) / 180.0 * h)

    # ---- fill (supersampled, then averaged down, so the edge is smooth) ----
    big = (W * SS, H * SS)
    Rimg, Gimg = Image.new("L", big, 0), Image.new("L", big, 0)
    dR, dG = ImageDraw.Draw(Rimg), ImageDraw.Draw(Gimg)
    for s in states:
        for d in ([dR] + ([dG] if s["arab"] else [])):
            for p in polys(s["geom"]):
                d.polygon([px(x, y, *big) for x, y in p.exterior.coords], fill=255)
                for hole in p.interiors:
                    d.polygon([px(x, y, *big) for x, y in hole.coords], fill=0)
    R, G = Rimg.resize((W, H), Image.BOX), Gimg.resize((W, H), Image.BOX)
    Image.merge("RGB", (R, G, Image.new("L", (W, H), 0))).save(a.out_fill, optimize=True)

    # ---- land borders (coast lines are left to the base map) ----
    all_geoms = [g for g in feats.values()]
    coast = unary_union(all_geoms).boundary.buffer(0.03)
    B = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(B)

    def stroke(geom, val, width=2, with_coast=False):
        ln = lines(geom.boundary if with_coast else geom.boundary.difference(coast))
        for l in ln:
            pts = [px(x, y, W, H) for x, y in l.coords]
            if len(pts) > 1:
                d.line(pts, fill=val, width=width)

    for g in all_geoms: stroke(g, SLATE)
    for s in states: stroke(s["geom"], CREAM)
    stroke(feats["Israel"], INK, width=3, with_coast=True)
    B.save(a.out_border, optimize=True)

    # ---- states data: label points, shares, outlines ----
    out = []
    for s in sorted(states, key=lambda s: -s["geom"].area):
        big_poly = max(polys(s["geom"]), key=lambda p: p.area)
        c = big_poly.centroid
        if not big_poly.contains(c): c = big_poly.representative_point()
        out.append({"name": s["name"], "lon": round(c.x, 2), "lat": round(c.y, 2), "area": round(s["geom"].area, 3), "share": s["share"],
                    "shareYear": s["shareYear"], "arab": s["arab"], "joined": s["joined"], "star": s["name"] == "Kosovo"})
    outlines = {k: [[[round(x, 2), round(y, 2)] for x, y in p.exterior.coords] for p in polys(feats[v])] for k, v in DASHED.items()}
    meta = {"schema": "states-1", "borders": "Natural Earth 50m countries via world-atlas 2.0.2 (current borders, no hand edits)",
            "shares": "Pew Research Center, 2020", "states": out, "outlines": outlines,
            "statesSha256": hashlib.sha256(open(a.states, "rb").read()).hexdigest()}
    json.dump(meta, open(a.out_json, "w"), ensure_ascii=False, separators=(",", ":"))
    print("States: %d (Arab League %d). Wrote %s, %s, %s" % (len(out), sum(1 for s in out if s["arab"]), a.out_fill, a.out_border, a.out_json))


if __name__ == "__main__":
    main()

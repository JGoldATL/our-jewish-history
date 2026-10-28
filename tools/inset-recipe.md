# Map inset relief recipe (F-149 Tier 1, F-155 Tier 2)

Everything below lives in `RECIPE` in `tools/build-inset.py`; change a value there and rebuild with `bash` one of the commands at the bottom. Repo-only; no public credit.

## Boxes (Natural Earth projection, cut to the exact geographic box)
1. tier2-near-east: lon 24 to 48, lat 23 to 42, 100 px/deg (2487 x 2209), baseScale 1.2, layer z1.
2. tier1-land-of-israel: lon 33 to 38, lat 28.5 to 34.5, 220 px/deg (1193 x 1538), baseScale 3.0, layer z2.
3. Draw order: base picture, Tier 2, Tier 1, then geo, routes, pins, labels, highlights.

## Recipe (proposals from Strategy were az 315, alt 45, exag 1.5, sigma 1 px, strength 20 percent; the values below are what was built)
1. One shared light: azimuth 315, altitude 45. Light direction cannot be recovered from the base pixels (R squared about 0.04); by eye the base coast shadows fall south and east, consistent with 315.
2. Vertical exaggeration 0.7 (lowered from 1.5 because Tier 1 looked busier than the base). Smoothing sigma 0.0073 deg (Tier 2) and 0.011 deg (Tier 1), set in degrees so detail scales with resolution. Strength 1.0 with soft "wrap" lighting 1.0 (half-lambert) so steep slopes do not clip to black.
3. Color ramp from measured base land percentiles: P5 [175,164,145], P50 [240,214,189], P95 [247,224,198]. Land below sea level is colored as sea-level land (max of elevation and 0) but shaded from true elevation.
4. Water is painted from the Natural Earth land mask (land-10m.json) and ne_10m_lakes.geojson, never from elevation. NODATA open sea is sea. Sea color [77,102,102].
5. Coast effects: fx.json "world" ratio tables (land rim light 0.69 at the coast to 1.0 inland; sea drop shadow about 1.39 to 1.0, clamped 0.55 to 1.0), scaled from base pixels to degrees.
6. Tone: gain matched on the outer band (0.15 to 0.8 deg inside the edge) to the layer beneath (Tier 2 to the base, Tier 1 to Tier 2). Measured: outer-band contrast x1.02 (Tier 2), x1.00 (Tier 1).
7. Feather: 0.4 deg, baked into alpha on the projected geographic boundary (distance transform to the true lon/lat box). 0.25 left a visible coast step at the Tier 2 west edge.
8. Darkest land (1st percentile) is 173 of 255 in both insets, well above the pin dark tone.

## Rebuild
Run these (raw DEMs are never committed):
1. `python3 -I tools/build-inset.py relief --id tier2-near-east --dem t2a/output_SRTMGL3.tif t2b/output_SRTMGL3.tif --land land-10m.json --lakes ne_10m_lakes.geojson`
2. `python3 -I tools/build-inset.py relief --id tier1-land-of-israel --dem tier1_srtmgl1_33-38E_28.5-34.5N_600pxdeg.tif --land land-10m.json --lakes ne_10m_lakes.geojson --tone-ref tier2-near-east`
Defaults for every other value come from `RECIPE`.

## Input data (joined and averaged, not committed)
1. Tier 1: SRTMGL1 v3, 3001 x 3601, 600/deg, int16, NODATA -32768 only in open sea.
2. Tier 2: two SRTMGL3 v3 GeoTIFFs (24 to 35 E, 35 to 48 E) joined, 1200/deg block-averaged by 6 to 200/deg, then resampled to 100 px/deg. No voids, no seam at 35 E.

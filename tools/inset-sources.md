# Source and license record for the map insets (F-156)
Repo only. No public credit appears anywhere on the site. Checked 2026-10-29 from files supplied by Jeffrey; Claude's sandbox cannot reach NASA, OpenTopography or Earthdata, so pages below are recorded as given by Strategy and NOT independently opened by Web Dev unless stated.

## 1. Tier 1: NASA SRTMGL1 v3 (30 m), 33 to 38 E, 28.5 to 34.5 N
1. Distributor: NASA (Jeffrey downloaded from NASA's site).
2. License: NASA mission data not marked restrictive is CC0 (https://science.data.nasa.gov/about/license). Not independently opened by Web Dev.
3. File's own metadata (checked): GeoTIFF tags only (pixel scale, tiepoint, EPSG 4326, GDAL nodata -32768). No copyright, license or credit text. Software tag reads tifffile.py, so the file was re-written after NASA's original. It carries an embedded C2PA content-credentials block signed by Anthropic ("Claude provided this file at the request of a user and may have created or modified the file contents"). That is provenance of the attachment path, not a NASA notice and not a license term.
4. SRTMGL1 product page: not opened (blocked from here). Open item for Jeffrey or Strategy.
5. Credit forced: none found.

## 2. Tier 2: NASA SRTMGL3 v3 (90 m), 24 to 48 E, 23 to 42 N, via OpenTopography portal (two downloads, 24 to 35 E and 35 to 48 E)
1. NASA page: https://www.earthdata.nasa.gov/data/catalog/lpcloud-srtmgl3-003
2. NASA citation: NASA JPL, 2013, NASA Shuttle Radar Topography Mission Global 3 arc second, Land Processes DAAC, https://doi.org/10.5067/MEASURES/SRTM/SRTMGL3.003
3. OpenTopography policy: https://opentopography.org/node/10 (says a formal citation is a condition of use, placed in the References of users' publications). OpenTopography citation: NASA Shuttle Radar Topography Mission (SRTM), 2013, Shuttle Radar Topography Mission (SRTM) Global, distributed by OpenTopography, https://doi.org/10.5069/G9445JDF
4. UNRESOLVED: whether a public on-site display is required. Jeffrey is asking OpenTopography. Gate: Tier 2 does not go to main until this is answered. If it forces a visible credit, stop and tell Jeffrey first.
5. File metadata (checked): both OpenTopography GeoTIFFs carry only georeferencing tags, LZW and nodata 0. No copyright, description or license text in the files.

## 3. Natural Earth (land and lakes: land-10m.json and ne_10m_lakes.geojson)
1. Public domain, credit unnecessary: https://www.naturalearthdata.com/about/terms-of-use/

## 4. world-atlas 2.0.2 (npm), source of land-10m.json
1. ISC license, copyright 2013 to 2019 Michael Bostock: https://github.com/topojson/world-atlas/blob/master/LICENSE
2. Keep the notice with any package files distributed with the site or repo. The raw package is not in the repo; finished map images need no credit.

## 5. Not in the repo
Raw DEM GeoTIFFs and the world-atlas package are not committed.

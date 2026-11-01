// F-021 final map, step 1. Writes Natural Earth country shapes (50m, via the world-atlas package, ISC license; the data is public domain) as GeoJSON.
// Setup once, in a scratch folder outside the repo:  npm i world-atlas@2.0.2 topojson-client@3.1.0
// Run:  NODE_PATH=/path/to/scratch/node_modules node tools/export-countries.cjs > /tmp/countries50.geojson
const topo = require("world-atlas/countries-50m.json"), tc = require("topojson-client");
const fc = tc.feature(topo, topo.objects.countries);
process.stdout.write(JSON.stringify({type: "FeatureCollection", features: fc.features.map(f => ({type: "Feature", properties: {name: f.properties.name}, geometry: f.geometry}))}));

import { readFileSync, writeFileSync } from "fs";
import { feature } from "topojson-client";
import { geoPath, geoNaturalEarth1, geoEqualEarth } from "d3-geo";

const topo = JSON.parse(readFileSync("./node_modules/world-atlas/countries-110m.json", "utf8"));
const fc = feature(topo, topo.objects.countries);

// ---- Visited destinations (the confirmed starting set from Albert's brief) ----
// Keys are the canonical names used by Natural Earth / world-atlas.
// value = { slug, label } for blog hooks + tooltip display.
const VISITED = {
  "Vietnam":                  { slug: "vietnam",        label: "Vietnam" },
  "Thailand":                 { slug: "thailand",       label: "Thailand" },
  "India":                    { slug: "india",          label: "India" },
  "United States of America": { slug: "usa",            label: "United States" },
  "Canada":                   { slug: "canada",         label: "Canada" },
  "Czechia":                  { slug: "czech-republic", label: "Czech Republic", home: true },
  "Germany":                  { slug: "germany",        label: "Germany" },
  "France":                   { slug: "france",         label: "France" },
  "Spain":                    { slug: "spain",          label: "Spain" },
  "Italy":                    { slug: "italy",          label: "Italy" },
  "Portugal":                 { slug: "portugal",       label: "Portugal" },
  "Netherlands":              { slug: "netherlands",    label: "Netherlands" },
  "Belgium":                  { slug: "belgium",        label: "Belgium" },
  "Poland":                   { slug: "poland",         label: "Poland" },
  "Austria":                  { slug: "austria",        label: "Austria" },
  "Switzerland":              { slug: "switzerland",    label: "Switzerland" },
  "United Kingdom":           { slug: "uk",             label: "United Kingdom" },
  "Sweden":                   { slug: "sweden",         label: "Sweden" },
  "Norway":                   { slug: "norway",         label: "Norway" },
  "Denmark":                  { slug: "denmark",        label: "Denmark" },
  "Hungary":                  { slug: "hungary",        label: "Hungary" },
  "Slovakia":                 { slug: "slovakia",       label: "Slovakia" },
  "Croatia":                  { slug: "croatia",        label: "Croatia" },
  "Greece":                   { slug: "greece",         label: "Greece" },
  "Romania":                  { slug: "romania",        label: "Romania" },
};

const slugify = (n) =>
  n.toLowerCase().replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Drop the polar masses so the map crops to a clean editorial band.
const DROP = new Set(["Antarctica", "Fr. S. Antarctic Lands"]);
const features = fc.features.filter((f) => !DROP.has(f.properties.name));

// Natural Earth projection = the familiar, gently rounded world silhouette.
const W = 1000;
const projection = (geoNaturalEarth1 || geoEqualEarth)();
const fitFC = { type: "FeatureCollection", features };
// Fit to width first to discover the natural height, then size the viewBox to it.
projection.fitWidth(W, fitFC);
const b = geoPath(projection).bounds(fitFC); // [[x0,y0],[x1,y1]]
const H = Math.ceil(b[1][1] + b[0][1]); // symmetric vertical padding
projection.fitExtent([[0, 0], [W, H]], fitFC);

const path = geoPath(projection);
const round = (d) => d.replace(/-?\d+\.\d+/g, (m) => (+m).toFixed(1));

let visitedCount = 0;
const paths = features
  .map((f) => {
    const name = f.properties.name;
    const d = round(path(f) || "");
    if (!d) return "";
    const hit = VISITED[name];
    if (hit) {
      visitedCount++;
      const home = hit.home ? ' data-home="true"' : "";
      // data-slug is the future blog hook; data-name drives the tooltip.
      return `<path class="country visited" data-slug="${hit.slug}" data-name="${hit.label}"${home} d="${d}"/>`;
    }
    return `<path class="country" data-slug="${slugify(name)}" d="${d}"/>`;
  })
  .filter(Boolean)
  .join("\n        ");

writeFileSync("./paths.txt", paths);
console.log("viewBox:", `0 0 ${W} ${H}`);
console.log("countries drawn:", features.length, "| visited highlighted:", visitedCount);
console.log("paths.txt bytes:", Buffer.byteLength(paths));
// sanity: any visited names not found in the dataset?
const found = new Set(features.map((f) => f.properties.name));
const missing = Object.keys(VISITED).filter((n) => !found.has(n));
console.log("missing visited (should be empty):", JSON.stringify(missing));

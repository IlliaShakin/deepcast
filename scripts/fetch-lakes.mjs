// Fetch real Latvian lake shorelines from OpenStreetMap (Overpass API),
// stitch multipolygon rings, simplify, and write src/data/latvianLakes.js.
//
// Depth figures (max/mean, meters) come from ezeri.lv / published sources and
// are used to calibrate the estimated bathymetry in-app.
//
// Usage: node scripts/fetch-lakes.mjs

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

const CACHE = new URL('./.overpass-cache.json', import.meta.url);

const LAKES = [
  {
    id: 'kisezers', name: 'Ķīšezers', region: 'Rīga', maxDepth: 4.5, meanDepth: 2.4,
    expectArea: 17.4, names: ['Ķīšezers'],
    blurb: 'Rīga city lake — pike, zander, perch and bream minutes from downtown.',
  },
  {
    id: 'baltezers', name: 'Lielais Baltezers', region: 'Ādaži', maxDepth: 5.9, meanDepth: 2.7,
    expectArea: 5.97, names: ['Lielais Baltezers'],
    blurb: 'Clear Rīga-area lake with weedy bays — pike, perch, tench and carp.',
  },
  {
    id: 'babite', name: 'Babītes ezers', region: 'Mārupe', maxDepth: 1.7, meanDepth: 0.9,
    expectArea: 25.6, names: ['Babītes ezers'], at: [56.9245, 23.7533],
    osmRel: 13179506,
    // ezeri.lv lists a 7 m max (dredged spot); the natural basin is ~1.7 m.
    blurb: 'Huge shallow reed bowl by Rīga — legendary pike and zander water. Dredged channels near Varkaļi run deeper than shown.',
  },
  {
    id: 'razna', name: 'Rāznas ezers', region: 'Rēzekne', maxDepth: 17, meanDepth: 7,
    expectArea: 57.6, names: ['Rāznas ezers', 'Rāzna'],
    blurb: '“The Latgale sea” — Latvia\'s second-largest lake; zander, pike, big perch.',
  },
  {
    id: 'dridzis', name: 'Drīdzis', region: 'Krāslava', maxDepth: 65.1, meanDepth: 12.8,
    expectArea: 7.53, names: ['Drīdzis', 'Drīdža ezers', 'Dreidzs'], at: [55.9456, 27.3303],
    osmRel: 11736463, // OSM uses the Latgalian name "Dreidzs"
    blurb: 'Deepest lake in the Baltics (65 m) — deep perch, pike and roach water.',
  },
  {
    id: 'sivers', name: 'Sīvers', region: 'Krāslava', maxDepth: 24.5, meanDepth: 6.3,
    expectArea: 17.9, names: ['Sīvers', 'Sīvera ezers'], at: [56.017, 27.283],
    blurb: 'Big Latgale lake with islands and bays — pike, zander, bream, tench.',
  },
  {
    id: 'ezezers', name: 'Ežezers', region: 'Dagda', maxDepth: 21, meanDepth: 5.9,
    expectArea: 9.88, names: ['Ežezers', 'Eša ezers'], at: [56.15, 27.583],
    blurb: 'The lake of islands (30+ of them) — endless structure for pike and perch.',
  },
  {
    id: 'usma', name: 'Usmas ezers', region: 'Ventspils', maxDepth: 27, meanDepth: 5.4,
    expectArea: 34.7, names: ['Usmas ezers', 'Usma'],
    blurb: 'Kurzeme classic with big islands — zander, pike, eel and bream.',
  },
  {
    id: 'aluksne', name: 'Alūksnes ezers', region: 'Alūksne', maxDepth: 15.2, meanDepth: 7,
    expectArea: 15.4, names: ['Alūksnes ezers'],
    blurb: 'Deep Vidzeme lake — zander, pike, perch; strong winter fishery.',
  },
  {
    id: 'burtnieks', name: 'Burtnieks', region: 'Valmiera', maxDepth: 4.3, meanDepth: 2.4,
    expectArea: 40.1, names: ['Burtnieks', 'Burtnieku ezers'],
    blurb: 'Shallow, rich Vidzeme lake famous for bream, zander and pike.',
  },
  {
    id: 'lubans', name: 'Lubāns', region: 'Madona/Rēzekne', maxDepth: 3.5, meanDepth: 1.6,
    expectArea: 80.7, names: ['Lubāns', 'Lubāna ezers', 'Lubānas ezers'],
    blurb: 'Latvia\'s largest lake — a shallow bowl loaded with pike, zander and bream.',
  },
];

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const allNames = [...new Set(LAKES.flatMap((l) => l.names))];
const nameRe = `^(${allNames.join('|')})$`;
const aroundClauses = LAKES.filter((l) => l.at)
  .map(
    (l) => `  relation["natural"="water"](around:2500,${l.at[0]},${l.at[1]});
  way["natural"="water"](around:2500,${l.at[0]},${l.at[1]});`
  )
  .join('\n');
const query = `
[out:json][timeout:180];
area["ISO3166-1"="LV"][admin_level=2]->.lv;
(
  relation["natural"="water"]["name"~"${nameRe}"](area.lv);
  way["natural"="water"]["name"~"${nameRe}"](area.lv);
${aroundClauses}
);
out geom;
`;

let osm = null;
if (existsSync(CACHE)) {
  console.log('Using cached Overpass response');
  osm = JSON.parse(readFileSync(CACHE, 'utf8'));
} else {
  outer: for (let round = 0; round < 4 && !osm; round++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      console.log(`Querying ${endpoint} (round ${round + 1}) …`);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'deepcast-lake-fetch/1.0',
          },
          signal: AbortSignal.timeout(200000),
        });
        if (!res.ok) {
          console.error(`  HTTP ${res.status}, trying next mirror`);
          continue;
        }
        osm = await res.json();
        break outer;
      } catch (e) {
        console.error(`  ${e.message}, trying next mirror`);
      }
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  if (!osm) throw new Error('All Overpass endpoints failed');
  writeFileSync(CACHE, JSON.stringify(osm));
}
console.log(`Got ${osm.elements.length} elements`);

const key = (p) => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`;

// Stitch a set of way geometries (arrays of {lat,lon}) into closed rings.
function stitchRings(ways) {
  const pool = ways.map((w) => [...w]);
  const rings = [];
  while (pool.length) {
    let ring = pool.shift();
    let guard = 0;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < 5000) {
      const end = key(ring[ring.length - 1]);
      let found = -1;
      let rev = false;
      for (let i = 0; i < pool.length; i++) {
        if (key(pool[i][0]) === end) { found = i; rev = false; break; }
        if (key(pool[i][pool[i].length - 1]) === end) { found = i; rev = true; break; }
      }
      if (found === -1) break; // open ring — drop below
      const seg = pool.splice(found, 1)[0];
      if (rev) seg.reverse();
      ring = ring.concat(seg.slice(1));
    }
    if (key(ring[0]) === key(ring[ring.length - 1]) && ring.length > 3) rings.push(ring);
  }
  return rings;
}

// Douglas–Peucker on projected points [[x,y],...] (meters), tolerance in meters.
function simplify(pts, tol) {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0;
    let maxI = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2));
      const px = ax + t * dx - pts[i][0];
      const py = ay + t * dy - pts[i][1];
      const d = px * px + py * py;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (Math.sqrt(maxD) > tol) {
      keep[maxI] = 1;
      stack.push([a, maxI], [maxI, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const ringArea = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return Math.abs(s / 2);
};

function assemble(el) {
  if (el.type === 'relation' && el.members) {
    const memberWays = (role) =>
      el.members
        .filter((m) => m.type === 'way' && m.geometry && (m.role === role || (role === 'outer' && !m.role)))
        .map((m) => m.geometry);
    return { outers: stitchRings(memberWays('outer')), inners: stitchRings(memberWays('inner')) };
  }
  if (el.type === 'way' && el.geometry) return { outers: stitchRings([el.geometry]), inners: [] };
  return { outers: [], inners: [] };
}

// Ray-cast point-in-polygon on a lat/lon ring.
function pipDeg(ring, lat, lon) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i].lat;
    const xi = ring[i].lon;
    const yj = ring[j].lat;
    const xj = ring[j].lon;
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const roughAreaDeg = (ring) => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    s += ring[j].lon * ring[i].lat - ring[i].lon * ring[j].lat;
  return Math.abs(s / 2);
};

// Fallback: fetch a polygon straight from Nominatim (bypasses Overpass).
async function nominatimRings(osmId) {
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=R${osmId}&format=json&polygon_geojson=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'deepcast-lake-fetch/1.0' } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const j = await res.json();
  const gj = j[0]?.geojson;
  if (!gj) throw new Error('Nominatim returned no geometry');
  const polys =
    gj.type === 'Polygon' ? [gj.coordinates] : gj.type === 'MultiPolygon' ? gj.coordinates : [];
  const outers = [];
  const inners = [];
  for (const poly of polys) {
    poly.forEach((ring, idx) => {
      const r = ring.map(([lon, lat]) => ({ lat, lon }));
      (idx === 0 ? outers : inners).push(r);
    });
  }
  if (!outers.length) throw new Error('Nominatim geometry had no outer ring');
  return { outers, inners };
}

const out = [];
for (const cfg of LAKES) {
  // Candidates: elements matching by name, or (for `at` lakes) whose largest
  // outer ring contains the reference coordinate.
  const candidates = [];
  for (const e of osm.elements) {
    const nameMatch = cfg.names.includes(e.tags?.name);
    if (!nameMatch && !cfg.at) continue;
    const asm = assemble(e);
    if (!asm.outers.length) continue;
    const biggest = asm.outers.reduce((a, b) => (roughAreaDeg(b) > roughAreaDeg(a) ? b : a));
    const contains = cfg.at ? pipDeg(biggest, cfg.at[0], cfg.at[1]) : false;
    if (nameMatch || contains) candidates.push({ asm, area: roughAreaDeg(biggest) });
  }
  if (!candidates.length && cfg.osmRel) {
    try {
      console.log(`${cfg.name}: falling back to Nominatim R${cfg.osmRel}`);
      const asm = await nominatimRings(cfg.osmRel);
      const biggest = asm.outers.reduce((a, b) => (roughAreaDeg(b) > roughAreaDeg(a) ? b : a));
      candidates.push({ asm, area: roughAreaDeg(biggest) });
    } catch (e) {
      console.error(`!! ${cfg.name}: Nominatim fallback failed: ${e.message}`);
    }
  }
  if (!candidates.length) {
    console.error(`!! ${cfg.name}: NOT FOUND in OSM result`);
    continue;
  }
  candidates.sort((a, b) => b.area - a.area);
  const { outers, inners } = candidates[0].asm;
  if (!outers.length) {
    console.error(`!! ${cfg.name}: could not assemble outer ring`);
    continue;
  }

  // Project to meters around the shape's centroid latitude.
  const all = [...outers.flat(), ...inners.flat()];
  const lats = all.map((p) => p.lat);
  const lons = all.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const refLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const kx = 111320 * Math.cos(refLat);
  const ky = 110540;
  const proj = (p) => [(p.lon - minLon) * kx, (maxLat - p.lat) * ky];
  const unproj = ([x, y]) => [
    Math.round((minLon + x / kx) * 1e6) / 1e6,
    Math.round((maxLat - y / ky) * 1e6) / 1e6,
  ];

  const extent = Math.max((maxLon - minLon) * kx, (maxLat - minLat) * ky);
  const cellM = extent / 360; // matches in-app grid N(384) - 2*PAD(12)
  const tol = cellM * 0.33;

  // Keep the largest outer + everything else, dropping sub-cell islets.
  const projRings = [];
  const outerProj = outers.map((r) => r.map(proj));
  outerProj.sort((a, b) => ringArea(b) - ringArea(a));
  projRings.push({ role: 'outer', pts: outerProj[0] });
  for (const r of outerProj.slice(1)) if (ringArea(r) > cellM * cellM * 4) projRings.push({ role: 'outer', pts: r });
  for (const r of inners.map((rr) => rr.map(proj))) {
    if (ringArea(r) > cellM * cellM * 2) projRings.push({ role: 'inner', pts: r });
  }

  const rings = projRings.map((r) => ({
    role: r.role,
    pts: simplify(r.pts, tol).map(unproj),
  }));

  const areaKm2 =
    (ringArea(projRings[0].pts) -
      projRings.filter((r) => r.role === 'inner').reduce((s, r) => s + ringArea(r.pts), 0)) /
    1e6;
  const nPts = rings.reduce((s, r) => s + r.pts.length, 0);
  const flag = Math.abs(areaKm2 - cfg.expectArea) / cfg.expectArea > 0.4 ? '  <-- AREA MISMATCH?' : '';
  console.log(
    `${cfg.name}: ${rings.length} rings (${rings.filter((r) => r.role === 'inner').length} islands), ` +
      `${nPts} pts, area ${areaKm2.toFixed(1)} km2 (expect ${cfg.expectArea})${flag}`
  );

  const { names, expectArea, at, ...meta } = cfg;
  out.push({ ...meta, areaKm2: Math.round(areaKm2 * 10) / 10, rings });
}

if (out.length < LAKES.length) console.error(`\nWARNING: only ${out.length}/${LAKES.length} lakes fetched`);

const body =
  '// Generated by scripts/fetch-lakes.mjs — real lake shorelines © OpenStreetMap contributors (ODbL).\n' +
  '// Depth figures from ezeri.lv / published sources; bathymetry is estimated in-app.\n' +
  'export default ' +
  JSON.stringify(out) +
  ';\n';
mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/data/latvianLakes.js', import.meta.url), body);
console.log(`\nWrote src/data/latvianLakes.js (${(body.length / 1024).toFixed(0)} KB)`);

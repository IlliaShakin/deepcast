// Node smoke test for the DOM-free modules: real-lake grid generation,
// depth calibration, GPS projection, structure detection, and solunar math.

import { LAKES, getLake, depthAt, gridFromLatLon, latLonFromGrid } from '../src/lakes.js';
import { detectStructures } from '../src/structures.js';
import { solunarDay, sunTimes } from '../src/solunar.js';
import { SPECIES } from '../src/speciesGuide.js';
import { seasonalAdvice } from '../src/advice.js';

let failures = 0;
const check = (cond, msg) => {
  if (cond) {
    console.log(`  ok: ${msg}`);
  } else {
    failures++;
    console.error(`  FAIL: ${msg}`);
  }
};

for (const rec of LAKES) {
  console.log(`\n${rec.name} (${rec.region}) — reported max ${rec.maxDepth} m, mean ${rec.meanDepth} m`);
  const lake = getLake(rec.id);
  const n = lake.n;
  let water = 0;
  let mx = 0;
  let sum = 0;
  for (let i = 0; i < n * n; i++) {
    const d = lake.grid[i];
    if (d > 0) {
      water++;
      sum += d;
    }
    if (d > mx) mx = d;
  }
  const frac = water / (n * n);
  const mean = sum / water;
  check(frac > 0.05 && frac < 0.85, `water fraction sane (${(frac * 100).toFixed(1)}%)`);
  check(Math.abs(mx - rec.maxDepth) < 0.05, `max depth calibrated (${mx.toFixed(2)} m)`);
  check(
    !rec.meanDepth || Math.abs(mean - rec.meanDepth) / rec.meanDepth < 0.2,
    `mean depth calibrated (${mean.toFixed(2)} m vs ${rec.meanDepth} m reported)`
  );
  let borderWater = 0;
  for (let i = 0; i < n; i++) {
    if (lake.grid[i] > 0) borderWater++;
    if (lake.grid[(n - 1) * n + i] > 0) borderWater++;
    if (lake.grid[i * n] > 0) borderWater++;
    if (lake.grid[i * n + n - 1] > 0) borderWater++;
  }
  check(borderWater === 0, 'grid border is all land');

  // GPS projection round-trip: the lake's own center coord must land on the grid.
  const g = gridFromLatLon(lake, lake.cfg.lat, lake.cfg.lon);
  check(g.x > 0 && g.x < n && g.y > 0 && g.y < n, `center coord projects onto grid (${g.x.toFixed(0)},${g.y.toFixed(0)})`);
  const back = latLonFromGrid(lake, g.x, g.y);
  check(
    Math.abs(back.lat - lake.cfg.lat) < 1e-6 && Math.abs(back.lon - lake.cfg.lon) < 1e-6,
    'latLonFromGrid inverts gridFromLatLon'
  );

  const structures = detectStructures(lake);
  const byType = {};
  for (const s of structures) byType[s.type] = (byType[s.type] || 0) + 1;
  console.log(`  structures: ${JSON.stringify(byType)}`);
  check(structures.length >= 1, `found ${structures.length} structures (>= 1)`);
  check(
    structures.every((s) => depthAt(lake, s.x, s.y) > 0),
    'all structure markers are on water'
  );
}

console.log('\nBabīte digitized survey');
{
  const b = getLake('babite');
  check(b.cfg.surveyed === true, 'Babīte flagged as surveyed');
  check(/1975/.test(b.cfg.depthSource), `depth source: ${b.cfg.depthSource}`);
  // Survey shows deepest water in the WEST — verify west half is deeper than east.
  let wSum = 0, wN = 0, eSum = 0, eN = 0;
  const mid = b.n / 2;
  for (let gy = 0; gy < b.n; gy++)
    for (let gx = 0; gx < b.n; gx++) {
      const d = b.grid[gy * b.n + gx];
      if (d <= 0) continue;
      if (gx < mid) { wSum += d; wN++; } else { eSum += d; eN++; }
    }
  const wMean = wSum / wN, eMean = eSum / eN;
  check(wMean > eMean, `west half deeper than east (${wMean.toFixed(2)} m vs ${eMean.toFixed(2)} m)`);
}

console.log('\nSeasonal advice (adapts band to lake depth)');
{
  const deep = getLake('dridzis');
  const shallow = getLake('babite');
  const zander = SPECIES.find((s) => s.id === 'zander');
  const dS = detectStructures(deep);
  const sS = detectStructures(shallow);
  const aDeep = seasonalAdvice(deep, dS, zander, 'summer');
  const aShallow = seasonalAdvice(shallow, sS, zander, 'summer');
  check(aDeep.band[1] <= deep.maxDepth && aDeep.band[0] >= 0, `deep band within lake (${aDeep.band.join('–')} m)`);
  check(aShallow.band[1] <= shallow.maxDepth, `shallow band clamped to ${shallow.maxDepth} m (${aShallow.band.join('–')} m)`);
  check(/thermocline/i.test(aDeep.text), 'deep-lake summer advice mentions thermocline');
  check(/no thermocline|mixed/i.test(aShallow.text), 'shallow-lake summer advice says no thermocline');
  check(aDeep.text !== aShallow.text, 'advice differs between deep and shallow lakes');
  for (const sp of SPECIES) {
    for (const season of ['spring', 'summer', 'fall', 'winter']) {
      const a = seasonalAdvice(shallow, sS, sp, season);
      if (!(a.text && a.band[1] <= shallow.maxDepth && a.band[0] < a.band[1])) {
        check(false, `advice valid for ${sp.en}/${season}`);
      }
    }
  }
  check(true, `all ${SPECIES.length} species × 4 seasons produce valid advice`);
}

console.log('\nSolunar (Ķīšezers, Rīga)');
const today = new Date();
const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const sol = solunarDay(midnight, 57.02, 24.18);
check(sol.windows.length >= 2, `has ${sol.windows.length} feeding windows`);
check(sol.sun.sunrise.getTime() < sol.sun.sunset.getTime(), 'sunrise before sunset');
check(sol.score >= 1 && sol.score <= 4, `day rating ${sol.score}/4 (${sol.label})`);
const midsummer = sunTimes(new Date(Date.UTC(2026, 5, 21, 10)), 57.02, 24.18);
const dayLenH = (midsummer.sunset - midsummer.sunrise) / 3600000;
check(dayLenH > 17 && dayLenH < 18.5, `midsummer day length in Rīga ≈ ${dayLenH.toFixed(1)} h`);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');

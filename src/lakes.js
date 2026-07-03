// Real Latvian lakes. Shorelines come from OpenStreetMap (© OSM contributors,
// ODbL) via scripts/fetch-lakes.mjs. Bathymetry is ESTIMATED for most lakes: a
// shore-distance field shaped so the lake's maximum and mean depth match
// published figures (ezeri.lv). Where a real survey has been digitized (see
// BATHY below) the app uses that instead. Depths are in METERS; <= 0 is land.

import DATA from './data/latvianLakes.js';
import babiteBathy from './data/babiteBathy.js';

const N = 384;
const PAD = 12;

export const LAKES = DATA;

// Digitized real bathymetry rasters, keyed by lake id. Each: decoded once into
// { w, h, bbox:[minLon,minLat,maxLon,maxLat], cm:Uint8Array, maxDepth, source }.
function decodeBathy(raw) {
  const bin = typeof atob !== 'undefined' ? atob(raw.data) : Buffer.from(raw.data, 'base64').toString('binary');
  const cm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) cm[i] = bin.charCodeAt(i);
  return { w: raw.w, h: raw.h, bbox: raw.bbox, cm, maxDepth: raw.maxDepth, source: raw.source };
}
const BATHY = { babite: decodeBathy(babiteBathy) };

// Zero-aware bilinear sample of a bathy raster (cm) at a lon/lat; returns meters,
// or 0 if no surveyed water nearby (caller supplies a shallow fallback).
function sampleBathy(b, lon, lat) {
  const [minLon, minLat, maxLon, maxLat] = b.bbox;
  const fx = ((lon - minLon) / (maxLon - minLon)) * (b.w - 1);
  const fy = ((maxLat - lat) / (maxLat - minLat)) * (b.h - 1);
  if (fx < 0 || fy < 0 || fx > b.w - 1 || fy > b.h - 1) return 0;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  let sum = 0;
  let wsum = 0;
  for (const [dx, dy, wgt] of [
    [0, 0, (1 - tx) * (1 - ty)],
    [1, 0, tx * (1 - ty)],
    [0, 1, (1 - tx) * ty],
    [1, 1, tx * ty],
  ]) {
    const x = Math.min(b.w - 1, x0 + dx);
    const y = Math.min(b.h - 1, y0 + dy);
    const v = b.cm[y * b.w + x];
    if (v > 0) {
      sum += v * wgt;
      wsum += wgt;
    }
  }
  if (wsum > 0.15) return sum / wsum / 100;
  // near-shore raster gap: search a small neighborhood for any surveyed cell
  for (let r = 1; r <= 3; r++) {
    let s = 0;
    let c = 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= b.w || y >= b.h) continue;
        const v = b.cm[y * b.w + x];
        if (v > 0) {
          s += v;
          c++;
        }
      }
    if (c) return s / c / 100;
  }
  return 0;
}

function contourIntervalFor(maxDepth) {
  if (maxDepth <= 6) return 0.5;
  if (maxDepth <= 12) return 1;
  if (maxDepth <= 25) return 2;
  return 5;
}

// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher),
// distance in cells to the nearest cell where mask[i] === sourceVal.
function edt(mask, n, sourceVal) {
  const INF = 1e20;
  const g = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) g[i] = mask[i] === sourceVal ? 0 : INF;
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const dt = () => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]));
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * (q - v[k]));
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  };
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) f[y] = g[y * n + x];
    dt();
    for (let y = 0; y < n; y++) g[y * n + x] = d[y];
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) f[x] = g[y * n + x];
    dt();
    for (let x = 0; x < n; x++) g[y * n + x] = Math.sqrt(d[x]);
  }
  return g;
}

function buildLake(rec) {
  // ---- Project rings (lon/lat) into grid coordinates, north-up.
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const r of rec.rings) {
    for (const [lon, lat] of r.pts) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }
  const refLat = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const kx = 111320 * Math.cos(refLat);
  const ky = 110540;
  const wM = (maxLon - minLon) * kx;
  const hM = (maxLat - minLat) * ky;
  const cell = Math.max(wM, hM) / (N - 2 * PAD);
  const ox = (N - wM / cell) / 2;
  const oy = (N - hM / cell) / 2;
  const rings = rec.rings.map((r) =>
    r.pts.map(([lon, lat]) => [ox + ((lon - minLon) * kx) / cell, oy + ((maxLat - lat) * ky) / cell])
  );

  // ---- Even-odd scanline fill -> water mask (islands handled naturally).
  const water = new Uint8Array(N * N);
  const xs = [];
  for (let gy = 0; gy < N; gy++) {
    xs.length = 0;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j];
        const [x2, y2] = ring[i];
        if (y1 <= gy !== y2 <= gy) xs.push(x1 + ((gy - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k]));
      const b = Math.min(N - 1, Math.floor(xs[k + 1]));
      for (let x = a; x <= b; x++) water[gy * N + x] = 1;
    }
  }

  // ---- Distance to shore, both directions.
  const distIn = edt(water, N, 0); // water cells: distance to land
  const distOut = edt(water, N, 1); // land cells: distance to water
  let dmax = 0;
  for (let i = 0; i < N * N; i++) if (water[i] && distIn[i] > dmax) dmax = distIn[i];
  if (dmax === 0) dmax = 1;

  const bathy = BATHY[rec.id];
  const maxD = bathy ? bathy.maxDepth : rec.maxDepth;

  // ---- Calibrate the smooth-model exponent so mean depth matches the report.
  let p = 1.4;
  if (!bathy && rec.meanDepth) {
    const meanFor = (pp) => {
      let s = 0;
      let c = 0;
      for (let i = 0; i < N * N; i++) {
        if (water[i]) {
          s += maxD * Math.pow(distIn[i] / dmax, pp);
          c++;
        }
      }
      return c ? s / c : 0;
    };
    let lo = 0.25;
    let hi = 5;
    for (let it = 0; it < 36; it++) {
      p = (lo + hi) / 2;
      if (meanFor(p) > rec.meanDepth) lo = p;
      else hi = p;
    }
  }

  // ---- Depth grid (meters); land gets a shallow negative ramp for shading.
  // Surveyed lakes read their digitized raster; others use the smooth model.
  const grid = new Float32Array(N * N);
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const i = gy * N + gx;
      if (!water[i]) {
        grid[i] = -Math.min(distOut[i] * 0.8, 12);
        continue;
      }
      if (bathy) {
        const lon = minLon + ((gx - ox) * cell) / kx;
        const lat = maxLat - ((gy - oy) * cell) / ky;
        const d = sampleBathy(bathy, lon, lat);
        grid[i] = d > 0 ? d : Math.min(0.4, 0.06 * distIn[i]);
      } else {
        grid[i] = Math.max(0.02, maxD * Math.pow(distIn[i] / dmax, p));
      }
    }
  }

  const { rings: _rings, ...meta } = rec;
  const cfg = {
    ...meta,
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
    metersPerCell: cell,
    contourInterval: contourIntervalFor(maxD),
    surveyed: !!bathy,
    depthSource: bathy ? bathy.source : 'estimated from shape + published max/mean depth',
  };
  return {
    cfg,
    n: N,
    grid,
    maxDepth: maxD,
    geo: { minLon, maxLat, kx, ky, cell, ox, oy },
  };
}

const cache = new Map();

export function getLake(id) {
  if (!cache.has(id)) {
    const rec = DATA.find((l) => l.id === id) || DATA[0];
    cache.set(id, buildLake(rec));
  }
  return cache.get(id);
}

// Bilinear depth sample at fractional grid coordinates. <= 0 means land.
export function depthAt(lake, x, y) {
  const n = lake.n;
  const cx = Math.min(Math.max(x, 0), n - 1.0001);
  const cy = Math.min(Math.max(y, 0), n - 1.0001);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const fx = cx - x0;
  const fy = cy - y0;
  const i = y0 * n + x0;
  const g = lake.grid;
  const a = g[i] * (1 - fx) + g[i + 1] * fx;
  const b = g[i + n] * (1 - fx) + g[i + n + 1] * fx;
  return a * (1 - fy) + b * fy;
}

// Map a GPS coordinate to fractional grid coordinates for this lake.
export function gridFromLatLon(lake, lat, lon) {
  const g = lake.geo;
  return {
    x: g.ox + ((lon - g.minLon) * g.kx) / g.cell,
    y: g.oy + ((g.maxLat - lat) * g.ky) / g.cell,
  };
}

// Inverse of gridFromLatLon: fractional grid coordinates -> {lat, lon}.
export function latLonFromGrid(lake, gx, gy) {
  const g = lake.geo;
  return {
    lon: g.minLon + ((gx - g.ox) * g.cell) / g.kx,
    lat: g.maxLat - ((gy - g.oy) * g.cell) / g.ky,
  };
}

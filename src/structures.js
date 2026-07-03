// Analyze a lake's depth grid and mark fishing structure:
// drop-offs, humps, deep holes and shallow flats.

import { depthAt } from './lakes.js';

const NB8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

export const STRUCT_LABELS = {
  dropoff: 'Drop-off',
  hump: 'Hump',
  hole: 'Deep hole',
  flat: 'Shallow flat',
};

function ringStats(grid, n, x, y, r) {
  let sum = 0;
  let cnt = 0;
  let land = 0;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const gx = Math.round(x + Math.cos(a) * r);
    const gy = Math.round(y + Math.sin(a) * r);
    if (gx < 0 || gy < 0 || gx >= n || gy >= n) {
      land++;
      continue;
    }
    const d = grid[gy * n + gx];
    if (d <= 0) land++;
    else {
      sum += d;
      cnt++;
    }
  }
  return { mean: cnt ? sum / cnt : 0, cnt, land };
}

function pickSeparated(cands, max, minSep) {
  cands.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const c of cands) {
    if (kept.some((k) => Math.hypot(k.x - c.x, k.y - c.y) < minSep)) continue;
    kept.push(c);
    if (kept.length >= max) break;
  }
  return kept;
}

export function detectStructures(lake) {
  const { grid, n, cfg } = lake;
  const mpc = cfg.metersPerCell;
  const out = [];

  // Slope in meters of depth per meter of distance.
  const slope = new Float32Array(n * n);
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      if (grid[i] <= 0) continue;
      const dx = (grid[i + 1] - grid[i - 1]) / (2 * mpc);
      const dy = (grid[i + n] - grid[i - n]) / (2 * mpc);
      slope[i] = Math.hypot(dx, dy);
    }
  }

  // ---- Drop-offs: clusters of unusually steep cells.
  const samples = [];
  for (let i = 0; i < n * n; i++) if (grid[i] > 0.8 && slope[i] > 0) samples.push(slope[i]);
  samples.sort((a, b) => a - b);
  const p98 = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.985))] : 0;
  const thr = Math.max(0.04, p98 * 0.8);
  const seen = new Uint8Array(n * n);
  const clusters = [];
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const start = y * n + x;
      if (seen[start] || slope[start] < thr || grid[start] < 0.6) continue;
      const stack = [start];
      seen[start] = 1;
      let count = 0;
      let best = start;
      let bestS = 0;
      while (stack.length) {
        const c = stack.pop();
        count++;
        if (slope[c] > bestS) {
          bestS = slope[c];
          best = c;
        }
        const cy = (c / n) | 0;
        const cx = c % n;
        for (const [ox, oy] of NB8) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 1 || ny < 1 || nx >= n - 1 || ny >= n - 1) continue;
          const j = ny * n + nx;
          if (!seen[j] && slope[j] >= thr && grid[j] > 0.6) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
      if (count >= 6) clusters.push({ count, best, bestS });
    }
  }
  clusters.sort((a, b) => b.bestS - a.bestS);
  const drops = [];
  for (const c of clusters) {
    const cy = (c.best / n) | 0;
    const cx = c.best % n;
    if (drops.some((d) => Math.hypot(d.x - cx, d.y - cy) < 26)) continue;
    const i = c.best;
    const gx = grid[i + 1] - grid[i - 1];
    const gy = grid[i + n] - grid[i - n];
    const gl = Math.hypot(gx, gy) || 1;
    const ux = gx / gl;
    const uy = gy / gl;
    const shallow = depthAt(lake, cx - ux * 6, cy - uy * 6);
    const deep = depthAt(lake, cx + ux * 6, cy + uy * 6);
    if (deep - shallow < Math.max(0.7, lake.maxDepth * 0.08)) continue;
    drops.push({ type: 'dropoff', x: cx, y: cy, shallow, deep });
    if (drops.length >= 5) break;
  }
  out.push(...drops);

  // ---- Humps and holes: ring-vs-center depth comparison.
  const R = Math.max(6, Math.min(14, Math.round(85 / mpc)));
  const minRelief = Math.max(0.8, lake.maxDepth * 0.09);
  const humpC = [];
  const holeC = [];
  for (let y = 2; y < n - 2; y += 2) {
    for (let x = 2; x < n - 2; x += 2) {
      const d = grid[y * n + x];
      if (d <= 0.3) continue;
      const ring = ringStats(grid, n, x, y, R);
      if (ring.land > 3 || ring.cnt < 12) continue;
      const rise = ring.mean - d;
      if (rise >= minRelief && d < lake.maxDepth * 0.75)
        humpC.push({ x, y, score: rise, around: ring.mean });
      const drop = d - ring.mean;
      if (drop >= minRelief) holeC.push({ x, y, score: drop, around: ring.mean });
    }
  }
  for (const h of pickSeparated(humpC, 3, R * 2.2)) out.push({ type: 'hump', x: h.x, y: h.y, around: h.around });
  for (const h of pickSeparated(holeC, 3, R * 2.2)) out.push({ type: 'hole', x: h.x, y: h.y, around: h.around });

  // ---- Largest shallow flat.
  const flatMax = Math.min(2.5, lake.maxDepth * 0.45);
  const isFlat = (i) => grid[i] > 0.4 && grid[i] < flatMax && slope[i] < 0.018;
  const seenF = new Uint8Array(n * n);
  let bestRegion = null;
  for (let start = 0; start < n * n; start++) {
    if (seenF[start] || !isFlat(start)) continue;
    const cells = [];
    const stack = [start];
    seenF[start] = 1;
    let sx = 0;
    let sy = 0;
    let sd = 0;
    while (stack.length) {
      const c = stack.pop();
      cells.push(c);
      const cy = (c / n) | 0;
      const cx = c % n;
      sx += cx;
      sy += cy;
      sd += grid[c];
      for (const [ox, oy] of NB8) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (!seenF[j] && isFlat(j)) {
          seenF[j] = 1;
          stack.push(j);
        }
      }
    }
    if (!bestRegion || cells.length > bestRegion.cells.length) {
      bestRegion = { cells, cx: sx / cells.length, cy: sy / cells.length, avg: sd / cells.length };
    }
  }
  if (bestRegion && bestRegion.cells.length * mpc * mpc > 22000) {
    // Snap the marker to the region cell nearest its centroid.
    let bi = bestRegion.cells[0];
    let bd = Infinity;
    for (const c of bestRegion.cells) {
      const cy = (c / n) | 0;
      const cx = c % n;
      const dd = (cx - bestRegion.cx) ** 2 + (cy - bestRegion.cy) ** 2;
      if (dd < bd) {
        bd = dd;
        bi = c;
      }
    }
    out.push({ type: 'flat', x: bi % n, y: (bi / n) | 0, avg: bestRegion.avg });
  }

  for (const s of out) {
    s.depth = depthAt(lake, s.x, s.y);
    s.label = STRUCT_LABELS[s.type];
    s.note = noteFor(s);
    s.id = `${s.type}-${s.x}-${s.y}`;
  }
  return out;
}

function noteFor(s) {
  const r = (v) => Math.round(v * 2) / 2; // half-meter rounding
  switch (s.type) {
    case 'dropoff':
      return `Estimated break from ~${r(s.shallow)} m down to ~${r(s.deep)} m. Predators cruise breaks like this — work jigs or deep cranks along the edge, especially early and late.`;
    case 'hump':
      return `Shallower area (~${r(s.depth)} m) with ~${r(s.around)} m water around it. Classic spot: fish the top at first light, slide down the sides when the sun is high.`;
    case 'hole':
      return `Deepest basin here — ~${r(s.depth)} m in ${r(s.around)} m surroundings. Fish drop in after cold fronts and in bright midday sun. Fish it slow and vertical.`;
    case 'flat':
      return `Broad flat averaging ~${r(s.avg)} m. Prime spring spawning and early-morning feeding ground. Fan-cast it and cover water.`;
    default:
      return '';
  }
}

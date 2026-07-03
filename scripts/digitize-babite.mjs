// Digitize the 1975 SMPI bathymetric survey of Babītes ezers into a real depth
// raster (src/data/babiteBathy.js), georeferenced to the OSM shoreline by
// principal-axis alignment.
//
// Source scan: scripts/survey-scans/babite-1975-smpi.jpg
//   (ezeri.lv depth map, GetImage?id=4670 — 1975 SMPI hydrographic survey).
//
// Prep (once): convert the JPEG to 24-bit BMP so we can read pixels without a
// JPEG decoder dependency:
//   sips -s format bmp scripts/survey-scans/babite-1975-smpi.jpg \
//        --out scripts/survey-scans/babite-1975-smpi.bmp
//
// Run:  node scripts/digitize-babite.mjs [path-to-bmp]
//
// Method: the scan shades depth in graduated blue (lighter = shallow, darker =
// deep). We extract per-pixel blue-darkness as a depth proxy, align the scan's
// blue-water blob to the OSM outline by matching centroids + principal axes +
// extents (sign resolved via the 4 compass tips), resample onto a lon/lat raster
// masked by the real shoreline, inpaint scan gaps (text/linework), then map the
// proxy to meters calibrated so area-mean = reported mean and peak = reported max.

import { readFileSync, writeFileSync } from 'node:fs';
import DATA from '../src/data/latvianLakes.js';

const BMP =
  process.argv[2] || new URL('./survey-scans/babite-1975-smpi.bmp', import.meta.url).pathname;
const OUT = new URL('../src/data/babiteBathy.js', import.meta.url);

// ---- 24-bit BMP reader ----
function loadBMP(path) {
  const buf = readFileSync(path);
  const off = buf.readUInt32LE(10);
  const w = buf.readInt32LE(18);
  let h = buf.readInt32LE(22);
  if (buf.readUInt16LE(28) !== 24) throw new Error('expected 24bpp BMP');
  const topDown = h < 0;
  h = Math.abs(h);
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const data = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    let p = off + (topDown ? y : h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const b = buf[p++];
      const g = buf[p++];
      const r = buf[p++];
      const i = (y * w + x) * 3;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
  return { w, h, rgb: (x, y) => [data[(y * w + x) * 3], data[(y * w + x) * 3 + 1], data[(y * w + x) * 3 + 2]] };
}

const rec = DATA.find((l) => l.id === 'babite');
const outer = rec.rings.filter((r) => r.role === 'outer').sort((a, b) => b.pts.length - a.pts.length)[0].pts;
const im = loadBMP(BMP);

const waterPx = [];
for (let y = 0; y < im.h; y++)
  for (let x = 0; x < im.w; x++) {
    const [r, g, b] = im.rgb(x, y);
    const lum = (r + g + b) / 3;
    if (b - (r + g) / 2 > 6 && lum >= 88 && lum <= 250) waterPx.push({ x, y, proxy: Math.max(0, 226 - r) });
  }
console.log('scan water pixels:', waterPx.length);

function pca(pts, gx, gy) {
  let mx = 0, my = 0;
  for (const p of pts) { mx += gx(p); my += gy(p); }
  mx /= pts.length; my /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { const dx = gx(p) - mx, dy = gy(p) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  sxx /= pts.length; syy /= pts.length; sxy /= pts.length;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  let ux, uy;
  if (Math.abs(sxy) > 1e-9) { ux = l1 - syy; uy = sxy; } else { ux = sxx >= syy ? 1 : 0; uy = sxx >= syy ? 0 : 1; }
  const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n;
  const vx = -uy, vy = ux;
  const aArr = [], bArr = [];
  for (const p of pts) { const dx = gx(p) - mx, dy = gy(p) - my; aArr.push(Math.abs(dx * ux + dy * uy)); bArr.push(Math.abs(dx * vx + dy * vy)); }
  aArr.sort((a, b) => a - b); bArr.sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.floor(p * (arr.length - 1))];
  return { mx, my, ux, uy, vx, vy, extA: q(aArr, 0.98), extB: q(bArr, 0.98) };
}
const S = pca(waterPx, (p) => p.x, (p) => p.y);

let minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9;
for (const [lon, lat] of outer) { if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon; if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat; }
const refLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
const kx = 111320 * Math.cos(refLat), ky = 110540;
const ringM = outer.map(([lon, lat]) => [(lon - minLon) * kx, (maxLat - lat) * ky]);
const G = pca(ringM, (p) => p[0], (p) => p[1]);

const tip = (sel) => waterPx.reduce((a, b) => (sel(b) < sel(a) ? b : a));
const gtip = (sel) => ringM.reduce((a, b) => (sel(b) < sel(a) ? b : a));
const scanTips = [tip((p) => p.x), tip((p) => -p.x), tip((p) => p.y), tip((p) => -p.y)];
const geoTips = [gtip((p) => p[0]), gtip((p) => -p[0]), gtip((p) => p[1]), gtip((p) => -p[1])];
const makeXform = (su, sv) => (px, py) => {
  const dx = px - S.mx, dy = py - S.my;
  const a = (dx * S.ux + dy * S.uy) * su, b = (dx * S.vx + dy * S.vy) * sv;
  const na = (a / S.extA) * G.extA, nb = (b / S.extB) * G.extB;
  return [G.mx + na * G.ux + nb * G.vx, G.my + na * G.uy + nb * G.vy];
};
let best = null;
for (const su of [1, -1]) for (const sv of [1, -1]) {
  const f = makeXform(su, sv);
  let err = 0;
  for (let i = 0; i < 4; i++) { const [gx, gy] = f(scanTips[i].x, scanTips[i].y); err += Math.hypot(gx - geoTips[i][0], gy - geoTips[i][1]); }
  if (!best || err < best.err) best = { su, sv, err };
}
console.log('sign su,sv =', best.su, best.sv, 'tip error(m):', (best.err / 4).toFixed(0));
const inv = (gx, gy) => {
  const dX = gx - G.mx, dY = gy - G.my;
  const na = dX * G.ux + dY * G.uy, nb = dX * G.vx + dY * G.vy;
  const a = ((na / G.extA) * S.extA) / best.su, b = ((nb / G.extB) * S.extB) / best.sv;
  return [S.mx + a * S.ux + b * S.vx, S.my + a * S.uy + b * S.vy];
};

const proxyGrid = new Float32Array(im.w * im.h).fill(-1);
for (const p of waterPx) proxyGrid[p.y * im.w + p.x] = p.proxy;
function sampleProxy(px, py) {
  const xi = Math.round(px), yi = Math.round(py), vals = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = xi + dx, y = yi + dy;
    if (x < 0 || y < 0 || x >= im.w || y >= im.h) continue;
    const v = proxyGrid[y * im.w + x];
    if (v >= 0) vals.push(v);
  }
  if (!vals.length) return -1;
  vals.sort((a, b) => a - b);
  return vals[vals.length >> 1];
}

const aspect = ((maxLon - minLon) * kx) / ((maxLat - minLat) * ky);
const H = 170, W = Math.round(H * aspect);
const rings = rec.rings.map((r) => ({ px: r.pts.map(([lon, lat]) => [((lon - minLon) / (maxLon - minLon)) * (W - 1), ((maxLat - lat) / (maxLat - minLat)) * (H - 1)]) }));
const mask = new Uint8Array(W * H);
for (let gy = 0; gy < H; gy++) {
  const xs = [];
  for (const rg of rings) { const p = rg.px; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [x1, y1] = p[j], [x2, y2] = p[i]; if (y1 <= gy !== y2 <= gy) xs.push(x1 + ((gy - y1) / (y2 - y1)) * (x2 - x1)); } }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.max(0, Math.ceil(xs[k])), b = Math.min(W - 1, Math.floor(xs[k + 1])); for (let x = a; x <= b; x++) mask[gy * W + x] ^= 1; }
}

const proxy = new Float32Array(W * H).fill(-1);
for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
  if (!mask[gy * W + gx]) continue;
  const lon = minLon + (gx / (W - 1)) * (maxLon - minLon), lat = maxLat - (gy / (H - 1)) * (maxLat - minLat);
  const [px, py] = inv((lon - minLon) * kx, (maxLat - lat) * ky);
  proxy[gy * W + gx] = sampleProxy(px, py);
}
// inpaint nodata water cells via BFS from valid ones
{
  const filled = Float32Array.from(proxy), q = [], seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (mask[i] && proxy[i] >= 0) { q.push(i); seen[i] = 1; }
  for (let head = 0; head < q.length; head++) {
    const i = q[head], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (mask[j] && !seen[j]) { seen[j] = 1; filled[j] = filled[i]; q.push(j); }
    }
  }
  for (let i = 0; i < W * H; i++) if (mask[i]) proxy[i] = filled[i];
}
const blur = (src) => {
  const out = Float32Array.from(src);
  for (let gy = 0; gy < H; gy++) for (let gx = 0; gx < W; gx++) {
    if (!mask[gy * W + gx]) continue;
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = gx + dx, y = gy + dy; if (x < 0 || y < 0 || x >= W || y >= H || !mask[y * W + x]) continue; s += src[y * W + x]; c++; }
    out[gy * W + gx] = s / c;
  }
  return out;
};
const pf = blur(blur(proxy));

const vals = [];
for (let i = 0; i < W * H; i++) if (mask[i]) vals.push(pf[i]);
vals.sort((a, b) => a - b);
const pct = (t) => vals[Math.floor(t * (vals.length - 1))];
const lo = pct(0.02), hi = pct(0.99);
const MAXD = 1.7, FLOOR = 0.4;
const mkDepth = (gamma) => {
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { if (!mask[i]) continue; const rel = Math.max(0, Math.min(1, (pf[i] - lo) / (hi - lo))); d[i] = FLOOR + Math.pow(rel, gamma) * (MAXD - FLOOR); }
  return d;
};
const meanOf = (d) => { let s = 0, c = 0; for (let i = 0; i < W * H; i++) if (mask[i]) { s += d[i]; c++; } return s / c; };
let glo = 0.3, ghi = 3, depth;
for (let it = 0; it < 40; it++) { const gm = (glo + ghi) / 2; depth = mkDepth(gm); if (meanOf(depth) > rec.meanDepth) glo = gm; else ghi = gm; }
let dmax = 0;
for (let i = 0; i < W * H; i++) if (mask[i] && depth[i] > dmax) dmax = depth[i];
console.log('raster', W, 'x', H, '| mean', meanOf(depth).toFixed(2), '(target', rec.meanDepth + ') | max', dmax.toFixed(2));

const cm = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (mask[i]) cm[i] = Math.max(1, Math.min(255, Math.round(depth[i] * 100)));
const body =
  '// Digitized from the 1975 SMPI bathymetric survey of Babītes ezers (via ezeri.lv),\n' +
  '// georeferenced to the OSM shoreline. Depth in cm, row-major, 0 = land/nodata.\n' +
  '// Regenerate with: node scripts/digitize-babite.mjs\n' +
  `export default ${JSON.stringify({ w: W, h: H, bbox: [minLon, minLat, maxLon, maxLat], maxDepth: Math.round(dmax * 10) / 10, source: '1975 SMPI survey (ezeri.lv), digitized', data: Buffer.from(cm).toString('base64') })};\n`;
writeFileSync(OUT, body);
console.log('wrote', OUT.pathname, (body.length / 1024).toFixed(0), 'KB');

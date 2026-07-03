// Offscreen canvas rendering of bathymetry: depth colormap, subtle hillshade,
// contour lines, shoreline, plus the depth-band highlight overlay.

import { depthAt } from './lakes.js';

const SCALE = 5; // offscreen pixels per grid cell (grid is 384 -> 1920px raster)

const STOPS = [
  [0.0, [206, 237, 217]],
  [0.06, [160, 220, 202]],
  [0.14, [108, 199, 189]],
  [0.25, [66, 170, 180]],
  [0.38, [42, 136, 166]],
  [0.55, [30, 102, 148]],
  [0.75, [21, 70, 121]],
  [1.0, [10, 38, 82]],
];

const LUT_N = 512;
const LUT = new Uint8Array(LUT_N * 3);
for (let i = 0; i < LUT_N; i++) {
  const f = i / (LUT_N - 1);
  let a = STOPS[0];
  let b = STOPS[STOPS.length - 1];
  for (let s = 0; s < STOPS.length - 1; s++) {
    if (f >= STOPS[s][0] && f <= STOPS[s + 1][0]) {
      a = STOPS[s];
      b = STOPS[s + 1];
      break;
    }
  }
  const t = (f - a[0]) / Math.max(1e-9, b[0] - a[0]);
  for (let c = 0; c < 3; c++) LUT[i * 3 + c] = Math.round(a[1][c] + (b[1][c] - a[1][c]) * t);
}

export function depthGradientCSS() {
  return `linear-gradient(to right, ${STOPS.map(
    ([f, c]) => `rgb(${c.join(',')}) ${Math.round(f * 100)}%`
  ).join(', ')})`;
}

export function renderBathymetry(lake) {
  const n = lake.n;
  const size = n * SCALE;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const buf = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    const wy = py / SCALE;
    for (let px = 0; px < size; px++) {
      buf[py * size + px] = depthAt(lake, px / SCALE, wy);
    }
  }

  const interval = lake.cfg.contourInterval;
  const maxD = lake.maxDepth;
  const get = (px, py) =>
    buf[Math.min(size - 1, Math.max(0, py)) * size + Math.min(size - 1, Math.max(0, px))];

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = py * size + px;
      const d = buf[i];
      let r;
      let g;
      let b;
      if (d <= 0) {
        const t = Math.min(1, -d / 6);
        r = 233 - 20 * t;
        g = 225 - 17 * t;
        b = 200 - 22 * t;
      } else {
        // Gamma-compressed mapping gives mid-depths more color range.
        const f = Math.pow(Math.min(1, d / maxD), 0.7);
        const li = Math.min(LUT_N - 1, Math.round(f * (LUT_N - 1))) * 3;
        r = LUT[li];
        g = LUT[li + 1];
        b = LUT[li + 2];
        const dzx = get(px + 1, py) - get(px - 1, py);
        const dzy = get(px, py + 1) - get(px, py - 1);
        const sh = Math.max(0.86, Math.min(1.1, 1 - ((dzx + dzy) * 2.8) / maxD));
        r *= sh;
        g *= sh;
        b *= sh;
        const dl = get(px - 1, py);
        const du = get(px, py - 1);
        if (dl > 0 && du > 0) {
          const band = Math.floor(d / interval);
          const bl = Math.floor(dl / interval);
          const bu = Math.floor(du / interval);
          if (band !== bl || band !== bu) {
            const k = Math.max(band, bl, bu) * interval;
            const alpha = k % (interval * 2) === 0 ? 0.42 : 0.22;
            r = r * (1 - alpha) + 12 * alpha;
            g = g * (1 - alpha) + 44 * alpha;
            b = b * (1 - alpha) + 66 * alpha;
          }
        }
      }
      const dl2 = get(px - 1, py);
      const du2 = get(px, py - 1);
      if ((d > 0) !== (dl2 > 0) || (d > 0) !== (du2 > 0)) {
        r = 96;
        g = 88;
        b = 64;
      }
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Depth field with a transparent background, for compositing over a map basemap:
// water gets a semi-transparent depth tint + contour lines, land stays clear.
export function renderDepthOverlay(lake) {
  const n = lake.n;
  const size = n * SCALE;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const maxD = lake.maxDepth;
  const interval = lake.cfg.contourInterval;

  const buf = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) buf[py * size + px] = depthAt(lake, px / SCALE, py / SCALE);
  }
  const get = (px, py) =>
    buf[Math.min(size - 1, Math.max(0, py)) * size + Math.min(size - 1, Math.max(0, px))];

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = py * size + px;
      const d = buf[i];
      if (d <= 0) {
        data[i * 4 + 3] = 0;
        continue;
      }
      const f = Math.pow(Math.min(1, d / maxD), 0.7);
      const li = Math.min(LUT_N - 1, Math.round(f * (LUT_N - 1))) * 3;
      let r = LUT[li];
      let g = LUT[li + 1];
      let b = LUT[li + 2];
      let a = 165;
      const dl = get(px - 1, py);
      const du = get(px, py - 1);
      if (dl > 0 && du > 0) {
        const band = Math.floor(d / interval);
        if (band !== Math.floor(dl / interval) || band !== Math.floor(du / interval)) {
          const k = Math.max(band, Math.floor(dl / interval), Math.floor(du / interval)) * interval;
          const strong = k % (interval * 2) === 0;
          r = 8;
          g = 30;
          b = 52;
          a = strong ? 235 : 195;
        }
      }
      // shoreline edge
      if ((dl <= 0) !== (d <= 0) || (du <= 0) !== (d <= 0)) {
        r = 24;
        g = 40;
        b = 30;
        a = 235;
      }
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function renderHighlight(lake, min, max) {
  const n = lake.n;
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const d = lake.grid[i];
    if (d > 0 && d >= min && d <= max) {
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = 200;
      img.data[i * 4 + 2] = 40;
      img.data[i * 4 + 3] = 120;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

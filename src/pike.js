// Pike ("līdaka") behaviour model + hotspot predictor.
//
// Grounded in fisheries/angling sources (pike.ca, Wired2Fish, In-Fisherman,
// masterfishingguide, Mercury Marine):
//  - Ambush predator tied to weed edges, drop-offs, points, bay mouths.
//  - Most active ~10–20 °C; sluggish and deeper below ~5 °C; stressed above ~23 °C.
//  - Dawn & dusk are peak; low light (overcast) extends the bite through the day.
//  - Low light / cool → push shallow to feed; bright heat → hold on edges / deeper
//    cooler, oxygenated water (in a shallow lake: the deeper basin + weed edges).
//  - Falling pressure + cloud + a light-to-moderate wind ripple = best; rising
//    pressure + bright sky after a cold front = tough, fish lock to cover.
//  - Latvia closed season: 1 May – 15 June.

import { pickBait, recommendBaits } from './pikeBaits.js';

export function seasonOf(date) {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

export function isPikeClosedSeason(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return (m === 5) || (m === 6 && d <= 15); // 1 May – 15 June
}

// Time-of-day phase relative to the lake's sunrise/sunset.
export function timePhase(nowMs, sun) {
  const H = 3600000;
  const sr = sun.sunrise.getTime();
  const ss = sun.sunset.getTime();
  if (nowMs >= sr - H && nowMs <= sr + H) return 'dawn';
  if (nowMs >= ss - H && nowMs <= ss + H) return 'dusk';
  if (nowMs > sr + H && nowMs < ss - H) return 'day';
  return 'night';
}

// Rough surface water temperature (°C) from season, nudged by air temp.
export function estimateWaterTemp(season, airC) {
  const base = { spring: 11, summer: 20, fall: 12, winter: 3 }[season];
  if (airC == null) return base;
  return Math.round((base * 0.7 + airC * 0.3) * 10) / 10;
}

// Is `nowMs` inside (or near) a solunar feeding window?
function inWindow(nowMs, windows) {
  for (const w of windows) {
    if (nowMs >= w.start - 20 * 60000 && nowMs <= w.end + 20 * 60000) return w.type;
  }
  return null;
}

// ---- Overall pike activity rating for right now (1–5) ----
export function pikeActivity(c) {
  const factors = [];
  let s = 3;

  // water temperature
  const wt = c.waterTemp;
  if (wt >= 10 && wt <= 20) { s += 1.2; factors.push({ good: true, text: `Water ~${wt}°C — in the pike's most active band (10–20°C).` }); }
  else if (wt > 20 && wt <= 23) { s += 0.2; factors.push({ good: true, text: `Water ~${wt}°C — warm; best bite at the cool ends of the day.` }); }
  else if (wt > 23) { s -= 1; factors.push({ good: false, text: `Water ~${wt}°C — hot; pike sulk in cover, fish dawn/dusk only.` }); }
  else if (wt < 5) { s -= 1; factors.push({ good: false, text: `Water ~${wt}°C — cold; pike slow and deep, go static/slow.` }); }
  else { s += 0.3; factors.push({ good: true, text: `Water ~${wt}°C — cool; steady feeding, slower presentations.` }); }

  // time of day
  if (c.phase === 'dawn' || c.phase === 'dusk') { s += 1.3; factors.push({ good: true, text: `${c.phase === 'dawn' ? 'Dawn' : 'Dusk'} — peak low-light feeding window right now.` }); }
  else if (c.phase === 'night') { s += (c.season === 'summer' ? 0.3 : -0.5); factors.push({ good: c.season === 'summer', text: c.season === 'summer' ? 'Night — summer pike feed after dark in the shallows.' : 'Night — limited feeding this time of year.' }); }
  else { // day
    const overcast = c.weather && c.weather.cloudPct >= 70;
    if (overcast) { s += 0.4; factors.push({ good: true, text: 'Overcast midday — low light keeps the bite going through the day.' }); }
    else { s -= 0.8; factors.push({ good: false, text: 'Bright midday — slower; pike tuck into cover, target shade & edges.' }); }
  }

  // season
  if (c.season === 'fall' || c.season === 'spring') { s += 0.6; factors.push({ good: true, text: `${c.season === 'fall' ? 'Autumn' : 'Spring'} — a prime pike season, aggressive feeding.` }); }
  else if (c.season === 'winter') { s -= 0.4; factors.push({ good: false, text: 'Winter — short feeding windows, slow it right down.' }); }

  // solunar
  if (c.solunarNow) { s += 0.8; factors.push({ good: true, text: `A ${c.solunarNow} solunar feeding period is running now.` }); }

  // weather
  if (c.weather) {
    const w = c.weather;
    if (w.pressureTrend <= -0.4) { s += 0.9; factors.push({ good: true, text: `Pressure ${w.pressureTrend} hPa/3h (falling) — often the best pike trigger.` }); }
    else if (w.pressureTrend >= 1.0) { s -= 0.9; factors.push({ good: false, text: `Pressure +${w.pressureTrend} hPa/3h (rising) — tough; pike lock to cover.` }); }
    if (w.cloudPct >= 70 && !(c.phase === 'dawn' || c.phase === 'dusk')) { /* counted above for day */ }
    if (w.windSpeed >= 8 && w.windSpeed <= 30) { s += 0.4; factors.push({ good: true, text: `Wind ${Math.round(w.windSpeed)} km/h — a ripple concentrates pike on windward edges.` }); }
    else if (w.windSpeed < 4) { s -= 0.2; factors.push({ good: false, text: 'Flat calm — pike spookier; go subtle or wait for a ripple.' }); }
    else if (w.windSpeed > 38) { s -= 0.3; factors.push({ good: false, text: 'Strong wind — fishable but tricky; find sheltered edges.' }); }
  } else {
    factors.push({ good: null, text: 'Live weather unavailable — rating from season, time and moon only.' });
  }

  const score = Math.max(1, Math.min(5, Math.round(s)));
  const label = ['', 'Slow', 'Below average', 'Fair', 'Good', 'Prime'][score];
  return { score, label, factors };
}

// Target depth bands (m) for pike given conditions, clamped to the lake.
export function pikeBands(c, maxDepth) {
  const md = maxDepth;
  const lowLight = c.phase === 'dawn' || c.phase === 'dusk' || c.phase === 'night' || (c.weather && c.weather.cloudPct >= 70);
  const hot = c.waterTemp > 21;
  const cold = c.waterTemp < 6;
  // feeding (shallow) vs holding (edge/deeper) bands
  const feed = [Math.min(0.4, md * 0.2), Math.min(md, Math.max(1, md * 0.65))];
  const hold = [Math.min(md * 0.5, Math.max(1, md - 1)), md];
  let favorShallow = lowLight || c.season === 'spring' || c.season === 'fall';
  if (hot && !lowLight) favorShallow = false; // bright heat → deeper/edges
  if (cold) favorShallow = false; // cold → deeper stable water
  const target = favorShallow ? feed : hold;
  return { feed, hold, target, favorShallow };
}

const ROSE = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function quadrantWord(dx, dy) {
  // dx east+, dy north+ ; map to 8-wind
  const ang = (Math.atan2(dx, dy) * 180) / Math.PI; // 0=N,90=E
  const idx = ((Math.round(ang / 45) % 8) + 8) % 8;
  return ROSE[idx];
}

// ---- Hotspot predictor ----
// Returns ranked spots [{x,y,depth,score,reason,baitId,where}].
export function computePikeHotspots(lake, structures, c, maxN = 6) {
  const { grid, n, maxDepth } = lake;
  const mpc = lake.cfg.metersPerCell;
  const { target, favorShallow } = pikeBands(c, maxDepth);
  const tmid = (target[0] + target[1]) / 2;
  const twid = Math.max(0.3, (target[1] - target[0]) / 2);

  // slope (m depth per m distance)
  const slope = new Float32Array(n * n);
  const samples = [];
  for (let y = 1; y < n - 1; y++)
    for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      if (grid[i] <= 0) continue;
      const dx = (grid[i + 1] - grid[i - 1]) / (2 * mpc);
      const dy = (grid[i + n] - grid[i - n]) / (2 * mpc);
      const g = Math.hypot(dx, dy);
      slope[i] = g;
      if (g > 0) samples.push(g);
    }
  samples.sort((a, b) => a - b);
  const p95 = samples.length ? samples[Math.floor(samples.length * 0.95)] || 1e-6 : 1e-6;

  // lake water centroid (for quadrant naming)
  let cxs = 0, cys = 0, cc = 0;
  for (let i = 0; i < n * n; i++) if (grid[i] > 0) { cxs += i % n; cys += (i / n) | 0; cc++; }
  const cx = cxs / cc, cy = cys / cc;

  const coverR = Math.max(1, Math.round(70 / mpc));
  const hasShallowNear = (x, y) => {
    for (let a = 0; a < 8; a++) {
      const ex = Math.round(x + Math.cos((a / 8) * 2 * Math.PI) * coverR);
      const ey = Math.round(y + Math.sin((a / 8) * 2 * Math.PI) * coverR);
      if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue;
      const dd = grid[ey * n + ex];
      if (dd > 0 && dd < 0.7) return true;
    }
    return false;
  };

  // wind: downwind bank bonus (wind pushes warm surface water + bait there)
  let wdx = 0, wdy = 0;
  if (c.weather && c.weather.windSpeed >= 8) {
    const to = ((c.weather.windDirDeg || 0) + 180) * (Math.PI / 180); // FROM → TO
    wdx = Math.sin(to); // east component
    wdy = -Math.cos(to); // grid y is south-positive; north = -cos
  }

  const structAt = structures.map((s) => ({ x: s.x, y: s.y, type: s.type }));
  const nearStruct = (x, y) => {
    for (const s of structAt) if (Math.hypot(s.x - x, s.y - y) < Math.max(4, 120 / mpc)) return s;
    return null;
  };

  const cands = [];
  const maxUseful = Math.min(maxDepth, target[1] + Math.max(0.5, maxDepth * 0.2));
  for (let y = 2; y < n - 2; y += 2)
    for (let x = 2; x < n - 2; x += 2) {
      const i = y * n + x;
      const d = grid[i];
      if (d <= 0.2 || d > maxUseful) continue;
      const edge = Math.min(1, slope[i] / p95);
      const depthFit = Math.exp(-((d - tmid) ** 2) / (2 * twid * twid));
      const cover = hasShallowNear(x, y) ? 1 : 0;
      const st = nearStruct(x, y);
      const structBonus = st ? (st.type === 'dropoff' ? 1 : st.type === 'hole' ? 0.7 : 0.6) : 0;
      let wind = 0;
      if (wdx || wdy) {
        const vx = (x - cx), vy = (y - cy);
        const vl = Math.hypot(vx, vy) || 1;
        wind = Math.max(0, (vx / vl) * wdx + (vy / vl) * wdy); // 0..1 downwind
      }
      const score =
        0.36 * edge + 0.28 * depthFit + 0.18 * cover + 0.12 * structBonus + 0.06 * wind;
      cands.push({ x, y, d, score, edge, st });
    }

  cands.sort((a, b) => b.score - a.score);
  const minSep = Math.max(6, Math.round(320 / mpc));
  const picked = [];
  for (const cnd of cands) {
    if (picked.some((p) => Math.hypot(p.x - cnd.x, p.y - cnd.y) < minSep)) continue;
    picked.push(cnd);
    if (picked.length >= maxN) break;
  }

  return picked.map((p, idx) => {
    const where = quadrantWord(p.x - cx, cy - p.y); // dy: north positive
    const edgeWord = p.edge > 0.6 ? 'Sharp weed edge / drop-off' : p.edge > 0.3 ? 'Weed-line break' : favorShallow ? 'Shallow feeding flat' : 'Deeper ambush hold';
    const roleText = favorShallow
      ? 'pike push up onto this edge to ambush bait in low light'
      : 'pike hold tight to this edge by the deeper, cooler water';
    const timeText =
      c.phase === 'dawn' || c.phase === 'dusk'
        ? 'Prime right now — work it thoroughly.'
        : c.phase === 'day'
          ? 'Fish the shady/deeper side through midday.'
          : 'Low-light/after-dark ambush lane.';
    const structText = p.st ? ` Sits on a detected ${p.st.type === 'dropoff' ? 'drop-off' : p.st.type === 'hole' ? 'deep hole' : p.st.type}.` : '';
    const baitId = pickBait(p.d, c);
    return {
      id: `pike-${p.x}-${p.y}`,
      rank: idx + 1,
      x: p.x,
      y: p.y,
      depth: p.d,
      score: p.score,
      where: whereWord(where),
      reason: `${edgeWord} in the ${whereWord(where)} at ~${p.d.toFixed(1)} m — ${roleText}.${structText} ${timeText}`,
      baitId,
    };
  });
}

function whereWord(rose) {
  const map = { N: 'north end', NE: 'north-east', E: 'east end', SE: 'south-east', S: 'south end', SW: 'south-west basin', W: 'west basin', NW: 'north-west' };
  return map[rose] || rose;
}

// Build the full conditions object the UI + model share.
export function buildConditions(nowMs, sol, weather, maxDepth) {
  const date = new Date(nowMs);
  const season = seasonOf(date);
  const phase = timePhase(nowMs, sol.sun);
  const waterTemp = estimateWaterTemp(season, weather?.tempC);
  const solunarNow = inWindow(nowMs, sol.windows);
  const c = {
    nowMs,
    season,
    phase,
    waterTemp,
    weather,
    solunarNow,
    weedy: true,
    closed: isPikeClosedSeason(date),
    moon: sol.phase,
  };
  c.activity = pikeActivity(c);
  c.bands = pikeBands(c, maxDepth);
  c.baits = recommendBaits(c, 3);
  return c;
}

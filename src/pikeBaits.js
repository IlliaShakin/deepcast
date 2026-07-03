// Pike bait/lure encyclopedia. Each entry explains how it works and why it's
// suited to pike specifically, plus condition affinities used to recommend the
// right bait for the day. Sources: Wired2Fish, Flop Industries, pike.ca,
// masterfishingguide, In-Fisherman (pike behaviour & lure guides).

export const PIKE_BAITS = [
  {
    id: 'spoon',
    en: 'Spoon',
    lv: 'Šķīvītis',
    ru: 'Блесна (колебалка)',
    emoji: '🥄',
    action: 'Wobbling flash',
    how: 'A curved metal blade that rocks and flashes like a fleeing, wounded fish. The flash and low-frequency wobble hit a pike\'s lateral line and eyes from far off — the classic search bait. The red-and-white Daredevle is the lure most associated with pike.',
    retrieve: 'Steady medium retrieve along weed edges; let it flutter down on the pause over pockets.',
    water: [4, 22],
    light: 'any',
    depth: ['edge', 'shallow'],
    clarity: ['stained', 'clear', 'murky'],
    best: 'Covering water along weed lines when pike are active.',
  },
  {
    id: 'spinnerbait',
    en: 'Spinnerbait',
    lv: 'Spinnerbaits',
    ru: 'Спиннербейт',
    emoji: '🌀',
    action: 'Flash + thump, weedless',
    how: 'A safety-pin wire arm carries spinning blades over a skirted hook that rides point-up, so it slithers through reeds and weed without fouling. Blades throw flash and a heavy thump pike home in on — the "Swiss-army knife" for weedy, stained water.',
    retrieve: 'Slow-roll it just over the weed tops; bulge the surface in the shallows or let it helicopter down holes.',
    water: [8, 24],
    light: 'any',
    depth: ['shallow', 'edge'],
    clarity: ['stained', 'murky'],
    best: 'Weedy, coloured water — Babīte\'s bread and butter.',
  },
  {
    id: 'jerkbait',
    en: 'Jerkbait',
    lv: 'Džerkbaits',
    ru: 'Джеркбейт / воблер-рывковый',
    emoji: '🎣',
    action: 'Erratic darting + pause',
    how: 'A hard minnow worked with rod-tip jerks so it darts side to side then hangs. The stop-and-pause mimics an injured baitfish and triggers reaction strikes — deadly on neutral or cold pike that won\'t chase, because they hit it on the pause.',
    retrieve: 'Jerk-jerk-pause; lengthen the pause in colder water. Most hits come as it hangs still.',
    water: [2, 18],
    light: 'any',
    depth: ['edge', 'shallow'],
    clarity: ['clear', 'stained'],
    best: 'Cooler water and finicky, pressured fish.',
  },
  {
    id: 'softswim',
    en: 'Soft swimbait / shad',
    lv: 'Mīkstā zivtiņa',
    ru: 'Силиконовый виброхвост',
    emoji: '🐟',
    action: 'Lifelike steady swim',
    how: 'A soft paddle-tail on a jig head with a natural, thumping swim. Its realism shines in clear water and low light; the size and slow fall let you present a big, believable meal right in front of holding pike.',
    retrieve: 'Slow, steady swim at the weed-edge depth; occasional twitch. Count it down to reach deeper holds.',
    water: [4, 22],
    light: 'low',
    depth: ['edge', 'deep'],
    clarity: ['clear', 'stained'],
    best: 'Clear water, low light, and targeting bigger fish.',
  },
  {
    id: 'topwater',
    en: 'Topwater',
    lv: 'Virsūdens vabole',
    ru: 'Поверхностная приманка',
    emoji: '💦',
    action: 'Surface commotion',
    how: 'Poppers, walkers and weedless frogs that chug or "walk the dog" across the top. The surface noise and wake call pike up out of dense weed to smash it — a warm-season, low-light spectacle over shallow cover.',
    retrieve: 'Rhythmic twitches to walk it; pause over open pockets in the weed. Wait to feel weight before striking.',
    water: [15, 26],
    light: 'low',
    depth: ['surface', 'shallow'],
    clarity: ['stained', 'clear', 'murky'],
    best: 'Warm mornings and evenings over shallow weed.',
  },
  {
    id: 'inline',
    en: 'Inline spinner / bucktail',
    lv: 'Griezulis',
    ru: 'Вертушка',
    emoji: '✨',
    action: 'Constant flash + vibration',
    how: 'A blade spins around a straight shaft the whole retrieve, throwing relentless flash and vibration. No cadence to learn — just cast and wind. It provokes active, aggressive pike into chasing and is superb for locating fish fast.',
    retrieve: 'Steady wind fast enough to feel the blade thump; vary speed until they commit.',
    water: [8, 24],
    light: 'any',
    depth: ['shallow', 'edge'],
    clarity: ['stained', 'clear'],
    best: 'Actively feeding pike; fast search tool.',
  },
  {
    id: 'deadbait',
    en: 'Dead bait',
    lv: 'Nedzīvā ēsma',
    ru: 'Мёртвая рыбка (донка)',
    emoji: '🪱',
    action: 'Static scent on bottom',
    how: 'A whole dead roach/smelt fished static on the bottom under a float or leger. It asks nothing of a cold, lethargic pike — no chase, just scent and an easy meal. The go-to when water is cold and lures get ignored.',
    retrieve: 'Cast to a hold and wait; twitch occasionally. Use a wire trace and drop-off indicator.',
    water: [0, 10],
    light: 'any',
    depth: ['edge', 'deep'],
    clarity: ['clear', 'stained', 'murky'],
    best: 'Cold water and inactive fish (late autumn, winter, cold fronts).',
  },
];

export const baitById = (id) => PIKE_BAITS.find((b) => b.id === id) || PIKE_BAITS[0];

// Score a bait against current conditions (0..1-ish). Higher = better fit today.
export function baitMatch(bait, c) {
  let s = 0.5;
  const wt = c.waterTemp;
  if (wt != null) {
    if (wt >= bait.water[0] && wt <= bait.water[1]) s += 0.35;
    else s -= 0.35;
  }
  const lowLight = c.phase === 'dawn' || c.phase === 'dusk' || c.phase === 'night' || (c.weather && c.weather.cloudPct >= 70);
  if (bait.light === 'low') s += lowLight ? 0.2 : -0.15;
  // Babīte and most target lakes are weedy/stained — reward weed-friendly baits.
  if (c.weedy && (bait.id === 'spinnerbait' || bait.id === 'spoon' || bait.id === 'topwater')) s += 0.1;
  // murky/coloured water rewards flash+vibration
  const murky = c.weather && c.weather.cloudPct >= 80;
  if (murky && (bait.id === 'spinnerbait' || bait.id === 'inline' || bait.id === 'spoon')) s += 0.08;
  // cold → deadbait/jerkbait; warm+lowlight → topwater
  if (wt != null) {
    if (wt < 8 && (bait.id === 'deadbait' || bait.id === 'jerkbait')) s += 0.15;
    if (wt >= 16 && lowLight && bait.id === 'topwater') s += 0.15;
    if (wt > 20 && bait.id === 'deadbait') s -= 0.2;
  }
  return s;
}

export function recommendBaits(conditions, limit = 3) {
  return PIKE_BAITS.map((b) => ({ bait: b, m: baitMatch(b, conditions) }))
    .sort((a, b) => b.m - a.m)
    .slice(0, limit)
    .map((x) => x.bait);
}

// Best single bait id for a spot at `depth` metres under current conditions.
export function pickBait(depth, c) {
  let cat;
  if (depth < 0.9) cat = ['surface', 'shallow'];
  else if (depth < 1.6) cat = ['shallow', 'edge'];
  else cat = ['edge', 'deep'];
  const pool = PIKE_BAITS.filter((b) => b.depth.some((d) => cat.includes(d)));
  const list = (pool.length ? pool : PIKE_BAITS)
    .map((b) => ({ b, m: baitMatch(b, c) }))
    .sort((a, b) => b.m - a.m);
  return list[0].b.id;
}

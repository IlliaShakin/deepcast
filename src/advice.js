// Turn a species' generic seasonal depth preference into lake-specific advice
// by combining it with THIS lake's real maximum depth and the structures the
// app detected. Grounds the "where do they live this season" answer in the
// depth study of the selected lake.
//
// Model (from fisheries/angling sources):
//  - Spring: fish follow warming water shallow to spawn (pike 4–11 °C,
//    perch 7–12 °C, zander 8–15 °C on hard bottom, bream/carp warmest).
//  - Summer: deep, clear lakes stratify; a thermocline forms (~4–8 m in
//    these Baltic lakes) and predators stack just above/along it. Shallow
//    lakes don't stratify — fish relate to cover, not depth.
//  - Fall: turnover mixes the column; fish spread out and feed heavily.
//  - Winter (ice): fish slide to the deepest stable water and slow down.

const STRUCT_WORD = {
  dropoff: 'the drop-offs (D)',
  hump: 'the hump tops (H)',
  hole: 'the deep holes (O)',
  flat: 'the shallow flat (F)',
};

function structureList(has, types) {
  const words = types.filter((t) => has.has(t)).map((t) => STRUCT_WORD[t]);
  if (!words.length) return null;
  if (words.length === 1) return words[0];
  return words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1];
}

// Returns { band: [lo, hi], text, thermocline? }
export function seasonalAdvice(lake, structures, species, season) {
  const md = lake.maxDepth;
  const step = md <= 6 ? 0.5 : 1;
  const rnd = (v) => Math.round(v / step) * step;
  const [lo0, hi0] = species.seasons[season].depth;

  const lo = Math.max(0, Math.min(rnd(lo0), rnd(Math.max(0, md - step))));
  const hi = Math.min(md, Math.max(rnd(Math.min(hi0, md)), lo + step));
  const band = [lo, hi];

  const has = new Set(structures.map((s) => s.type));
  const shallowLake = md < 6;
  const deepLake = md >= 12;
  const tooDeepForLake = lo0 > md; // fish's usual band is deeper than the lake

  let text;
  switch (season) {
    case 'spring': {
      const s = structureList(has, ['flat', 'hump']);
      text =
        `Spring: ${species.en} spawn around ${species.spawnTemp}. In ${lake.cfg.name} they follow the ` +
        `warming water into the shallows — the top ${hi} m, sunny bays and reed edges warm first` +
        (s ? `. Start on ${s}.` : '.');
      break;
    }
    case 'summer': {
      if (deepLake) {
        const s = structureList(has, ['dropoff', 'hump', 'hole']);
        text =
          `Summer: this lake is deep enough to stratify — a thermocline sets up around 4–8 m. ` +
          `${species.en} hold just above or along it, so work about ${lo}–${hi} m` +
          (s ? ` on ${s}.` : '.');
      } else if (shallowLake) {
        const s = structureList(has, ['hole', 'dropoff', 'flat']);
        text =
          `Summer: at only ${md} m ${lake.cfg.name} stays mixed and warm top-to-bottom — no thermocline. ` +
          `${species.en} relate to cover, not depth: fish the deep weed edge and any channels` +
          (s ? `, plus ${s}.` : '.');
      } else {
        const s = structureList(has, ['dropoff', 'hump', 'hole', 'flat']);
        text =
          `Summer: ${species.en} settle onto structure at ${lo}–${hi} m` +
          (s ? `, especially ${s}.` : '.');
      }
      break;
    }
    case 'fall': {
      const s = structureList(has, ['dropoff', 'flat', 'hump']);
      text =
        `Fall: after turnover the whole column mixes and ${species.en} roam and feed hard. ` +
        `Cover water across ${lo}–${hi} m` +
        (s ? ` — ${s} are prime.` : '.');
      break;
    }
    case 'winter':
    default: {
      const s = structureList(has, ['hole', 'dropoff']);
      text =
        `Winter (ice): ${species.en} slide to the deepest stable water and slow right down. ` +
        `Jig ${lo}–${hi} m` +
        (s ? ` over ${s}.` : ' over the basin.');
      break;
    }
  }

  if (tooDeepForLake) {
    text +=
      ` This lake maxes at ${md} m — shallower than their usual ${lo0}–${hi0} m — so “deep” here ` +
      `just means the ${md} m water.`;
  }

  return { band, text };
}

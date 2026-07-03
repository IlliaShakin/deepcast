# 🎣 DeepCast — Latvian Lake Depth Maps

Mobile-first React web app for fishing on real Latvian lakes: depth maps,
auto-detected structure, GPS position on the lake, saved spots, solunar bite
times, and a seasonal species guide (līdaka, asaris, zandarts, plaudis…).
No API keys; works offline once loaded.

## The 11 lakes

| Lake | Region | Max / mean depth | Bathymetry |
|---|---|---|---|
| Babītes ezers | Mārupe | 1.7 / 0.9 m | **surveyed** (1975 SMPI, digitized) |
| Ķīšezers | Rīga | 4.5 / 2.4 m | estimated |
| Lielais Baltezers | Ādaži | 5.9 / 2.7 m | estimated |
| Rāznas ezers | Rēzekne | 17 / 7 m | estimated |
| Drīdzis | Krāslava | 65.1 / 12.8 m (deepest in the Baltics) | estimated |
| Sīvers | Krāslava | 24.5 / 6.3 m | estimated |
| Ežezers | Dagda | 21 / 5.9 m (26 islands) | estimated |
| Usmas ezers | Ventspils | 27 / 5.4 m | estimated |
| Alūksnes ezers | Alūksne | 15.2 / 7 m | estimated |
| Burtnieks | Valmiera | 4.3 / 2.4 m | estimated |
| Lubāns | Madona/Rēzekne | 3.5 / 1.6 m (largest in Latvia) | estimated |

**Shorelines are real** — fetched from OpenStreetMap (© OSM contributors, ODbL)
with islands preserved.

**Depths:** two tiers, and the UI labels which you're looking at (legend shows
"✓ survey" vs "≈ est.").

- **Babītes ezers is real, surveyed bathymetry.** Latvia publishes no open
  *machine-readable* bathymetry, but real surveyed depth maps exist as scanned
  images. For Babīte the 1975 SMPI hydrographic survey (via ezeri.lv) was
  digitized: the scan's graduated-blue depth shading is extracted per-pixel,
  georeferenced to the OSM shoreline, and resampled into a real depth raster
  (`scripts/digitize-babite.mjs`). So the *pattern* is the survey's — deep in the
  west/southwest, shallow ~1 m eastern basin with the mapped deeper pockets — not
  a guess. Contour placement is approximate (traced from a 1:50 000 scan); depth
  values are calibrated to the survey's reported max/mean.
- **The other 10 are estimated** — a shore-distance depth field shaped so each
  lake's maximum *and* mean depth match published figures (ezeri.lv). The bottom
  in between is an educated smooth guess. Structure markers on these are
  plausible-location suggestions, not surveyed features.

Either way: treat it as guidance, verify on the water. Same path (digitize a
scanned survey) can upgrade any other lake to "surveyed" — ask.

## Features

- **High-res depth map** — 384×384 bathymetry grid rendered to a ~1920 px raster
  with contours + hillshade, so it stays crisp when you pinch-zoom (up to ~18×).
  Tap anywhere for the estimated depth in meters; scale bar included.
- **OpenStreetMap basemap** (🗺️ Map chip) — toggle real OSM map tiles as the
  backdrop with the depth field blended on top, correctly geo-aligned to the real
  lake (villages, roads, the works). Needs a connection; the default offline
  canvas keeps working on the water with no signal.
- **GPS** — 🧭 chip shows your live position and accuracy circle on the lake
  (real coordinates, real shapes), and tells you if you're not on this lake.
- **Structure markers** — drop-offs (D), shallower tops (H), deepest basins (O),
  flats (F), derived from the estimated depth field, each with fishing notes.
- **Species Guide with fish illustrations** — inline-SVG side views of 8 Latvian
  species, named in **Latvian · English · Russian** (Līdaka · Pike · Щука …).
- **Depth-study seasonal advice** — for the selected lake, each species' seasonal
  behaviour is combined with *this lake's* real max depth and detected structure.
  The same fish gives different advice on a 65 m lake (thermocline, hold ~3–8 m on
  the drop-offs) vs. a 1.7 m reed bowl (no thermocline, work the weed edge and
  flat). One tap highlights the recommended band on the map.
- **Depth-band highlight** — light up all water in a chosen range (◍ chip),
  with shallow/mid/deep presets.
- **My Spots** — tap → name → save; persisted in localStorage per lake.
- **Bite Times** — solunar major/minor windows, moon phase, sunrise/sunset for
  the lake's coordinates, 7-day outlook.

Check makskeresana.lv for current closed seasons and size limits before fishing.

### The seasonal model (sources)

Advice is grounded in fisheries/angling references, adapted per lake:
- **Spring** — fish follow warming water shallow to spawn: pike earliest (~4–11 °C,
  flooded weed), perch (~7–12 °C), zander (8–15 °C on hard sand/gravel at 0.5–3 m),
  bream/carp warmest.
- **Summer** — deep clear lakes stratify; a thermocline forms (~3 ft in shallow
  ponds up to ~10–12 m in deep lakes) and predators stack just above/along it.
  Shallow lakes don't stratify, so fish relate to cover, not depth.
- **Fall** — turnover mixes the column and triggers heavy feeding across depths.
- **Winter (ice)** — fish slide to the deepest stable water and slow down.

## Run

```bash
npm install        # (sfw npm install if you use Socket Firewall)
npm run dev        # dev server, LAN-exposed — open it on your phone
npm run build      # production build to dist/
npm run preview    # serve the production build
npm test           # node smoke test: generation, calibration, GPS projection, solunar
```

GPS requires a **secure context** on real devices: `localhost` works for
desktop testing, but on a phone serve over HTTPS (e.g. `vite --https`, a
tunnel like `cloudflared`/`tailscale funnel`, or any hosting with TLS).

## Refreshing / adding lakes

```bash
node scripts/fetch-lakes.mjs   # re-fetches shorelines from OSM into src/data/
```

Add a lake to the `LAKES` list in that script (name variants, reported
max/mean depth, and optionally `at:` coordinates or an `osmRel` id if the OSM
name differs — e.g. Drīdzis is "Dreidzs" in OSM).

### Upgrading a lake to real surveyed bathymetry

Babīte was digitized from its scanned depth survey; the same pipeline works for
any lake with a scanned survey map:

```bash
# 1. save the survey scan into scripts/survey-scans/
# 2. convert to 24-bit BMP (macOS): sips -s format bmp <scan>.jpg --out <scan>.bmp
node scripts/digitize-babite.mjs   # → src/data/babiteBathy.js
```

`src/lakes.js` uses the digitized raster (`BATHY` map) instead of the estimate
when one exists, and flags the lake as `surveyed`.

## Honest limitations

- **10 of 11 lakes:** bathymetry is a calibrated estimate from lake shape, not a
  sonar survey — real bottoms have humps, pits and channels the model can't know
  (e.g. Ķīšezers' dredged 16 m sand pits). **Babīte** uses the real 1975 survey
  (digitized), so its depth *pattern* is genuine, though contour placement traced
  from a 1:50 000 scan is approximate.
- Solunar times are approximations; weather and pressure matter as much.

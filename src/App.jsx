import { useEffect, useMemo, useState } from 'react';
import { LAKES, getLake } from './lakes.js';
import { detectStructures } from './structures.js';
import { loadSpots, saveSpots } from './storage.js';
import { solunarDay } from './solunar.js';
import { fetchWeather } from './weather.js';
import { buildConditions, computePikeHotspots } from './pike.js';
import MapView from './components/MapView.jsx';
import SpotsPanel from './components/SpotsPanel.jsx';
import SolunarPanel from './components/SolunarPanel.jsx';
import GuidePanel from './components/GuidePanel.jsx';
import PikePanel from './components/PikePanel.jsx';
import BottomNav from './components/BottomNav.jsx';

const TAB_IDS = ['map', 'pike', 'spots', 'times', 'guide'];

export default function App() {
  const [lakeId, setLakeId] = useState(LAKES[0].id);
  const [tab, setTabState] = useState(() => {
    const h = window.location.hash.slice(1);
    return TAB_IDS.includes(h) ? h : 'map';
  });
  const [spots, setSpots] = useState(loadSpots);
  const [highlight, setHighlight] = useState({ enabled: false, min: 1, max: 3 });
  const [flyTo, setFlyTo] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [pikeFocus, setPikeFocus] = useState(0);

  const lake = useMemo(() => getLake(lakeId), [lakeId]);
  const structures = useMemo(() => detectStructures(lake), [lake]);

  // Solunar for the current day at this lake's coordinates.
  const sol = useMemo(() => {
    const d = new Date(now);
    return solunarDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()), lake.cfg.lat, lake.cfg.lon);
  }, [lake, now]);

  // Live weather per lake (Open-Meteo). Null if offline — model still works.
  useEffect(() => {
    let alive = true;
    setWeather(null);
    setWeatherLoading(true);
    fetchWeather(lake.cfg.lat, lake.cfg.lon).then((w) => {
      if (alive) {
        setWeather(w);
        setWeatherLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [lake]);

  const conditions = useMemo(
    () => buildConditions(now, sol, weather, lake.maxDepth),
    [now, sol, weather, lake]
  );
  const pikeHotspots = useMemo(
    () => computePikeHotspots(lake, structures, conditions),
    [lake, structures, conditions]
  );

  useEffect(() => {
    saveSpots(spots);
  }, [spots]);

  function setTab(t) {
    if (t === 'pike' || t === 'times') setNow(Date.now()); // refresh time-sensitive tabs
    setTabState(t);
    try {
      window.history.replaceState(null, '', '#' + t);
    } catch {
      // ignore
    }
  }

  const lakeSpots = spots.filter((s) => s.lakeId === lakeId);

  function addSpot(spot) {
    setSpots((s) => [...s, { ...spot, lakeId }]);
  }
  function deleteSpot(id) {
    setSpots((s) => s.filter((x) => x.id !== id));
  }
  function gotoSpot(spot) {
    setLakeId(spot.lakeId);
    setTab('map');
    setFlyTo({ x: spot.x, y: spot.y, spotId: spot.id, key: Date.now() });
  }
  function highlightRange(min, max) {
    setHighlight({ enabled: true, min, max });
    setTab('map');
  }
  function gotoPikeSpot(spot) {
    setTab('map');
    setFlyTo({ x: spot.x, y: spot.y, key: Date.now() });
    setPikeFocus((v) => v + 1);
  }
  function showAllPike() {
    setTab('map');
    setPikeFocus((v) => v + 1);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🎣 DeepCast</div>
        <select
          className="lake-select"
          value={lakeId}
          onChange={(e) => setLakeId(e.target.value)}
          aria-label="Choose lake"
        >
          {LAKES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {l.region}
            </option>
          ))}
        </select>
      </header>
      <main className="main">
        <MapView
          lake={lake}
          structures={structures}
          spots={lakeSpots}
          highlight={highlight}
          onHighlightChange={setHighlight}
          flyTo={flyTo}
          onAddSpot={addSpot}
          onDeleteSpot={deleteSpot}
          pikeSpots={pikeHotspots}
          pikeFocus={pikeFocus}
        />
        {tab === 'pike' && (
          <PikePanel
            lake={lake}
            conditions={conditions}
            sol={sol}
            hotspots={pikeHotspots}
            weatherLoading={weatherLoading}
            onGoto={gotoPikeSpot}
            onShowAll={showAllPike}
          />
        )}
        {tab === 'spots' && (
          <SpotsPanel spots={spots} lakes={LAKES} onGoto={gotoSpot} onDelete={deleteSpot} />
        )}
        {tab === 'times' && <SolunarPanel lake={lake} />}
        {tab === 'guide' && (
          <GuidePanel lake={lake} structures={structures} onHighlight={highlightRange} />
        )}
      </main>
      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}

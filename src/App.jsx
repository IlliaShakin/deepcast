import { useEffect, useMemo, useState } from 'react';
import { LAKES, getLake } from './lakes.js';
import { detectStructures } from './structures.js';
import { loadSpots, saveSpots } from './storage.js';
import MapView from './components/MapView.jsx';
import SpotsPanel from './components/SpotsPanel.jsx';
import SolunarPanel from './components/SolunarPanel.jsx';
import GuidePanel from './components/GuidePanel.jsx';
import BottomNav from './components/BottomNav.jsx';

const TAB_IDS = ['map', 'spots', 'times', 'guide'];

export default function App() {
  const [lakeId, setLakeId] = useState(LAKES[0].id);
  const [tab, setTabState] = useState(() => {
    const h = window.location.hash.slice(1);
    return TAB_IDS.includes(h) ? h : 'map';
  });
  const [spots, setSpots] = useState(loadSpots);
  const [highlight, setHighlight] = useState({ enabled: false, min: 1, max: 3 });
  const [flyTo, setFlyTo] = useState(null);

  const lake = useMemo(() => getLake(lakeId), [lakeId]);
  const structures = useMemo(() => detectStructures(lake), [lake]);

  useEffect(() => {
    saveSpots(spots);
  }, [spots]);

  function setTab(t) {
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
        />
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

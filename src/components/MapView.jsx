import { useEffect, useMemo, useRef, useState } from 'react';
import { depthAt, gridFromLatLon, latLonFromGrid } from '../lakes.js';
import { renderBathymetry, renderHighlight, renderDepthOverlay, depthGradientCSS } from '../render.js';
import { getTile, lon2tileX, lat2tileY, tileX2lon, tileY2lat, groundResolution } from '../tiles.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MINZOOM = 0.8;
const MAXZOOM = 18;

const STRUCT_STYLE = {
  dropoff: { color: '#e2574c', ch: 'D' },
  hump: { color: '#f09f33', ch: 'H' },
  hole: { color: '#8b6ff0', ch: 'O' },
  flat: { color: '#43b581', ch: 'F' },
};

export default function MapView({
  lake,
  structures,
  spots,
  highlight,
  onHighlightChange,
  flyTo,
  onAddSpot,
  onDeleteSpot,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const view = useRef({ z: 1, px: 0, py: 0, fitZ: 1, ready: false });
  const pointers = useRef(new Map());
  const gesture = useRef({ lastDist: 0, lastMid: null, tap: null });
  const lakeRef = useRef(lake);
  lakeRef.current = lake;

  const [selection, setSelection] = useState(null);
  const [saveName, setSaveName] = useState(null); // null = not saving
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showStructures, setShowStructures] = useState(true);
  const [showSpots, setShowSpots] = useState(true);
  const [gps, setGps] = useState({ on: false, fix: null, error: null });
  const [showMap, setShowMap] = useState(false);
  const geoWatch = useRef(null);
  const gpsCentered = useRef(false);

  const bathy = useMemo(() => renderBathymetry(lake), [lake]);
  const overlay = useMemo(() => (showMap ? renderDepthOverlay(lake) : null), [lake, showMap]);
  const hl = useMemo(
    () => (highlight.enabled ? renderHighlight(lake, highlight.min, highlight.max) : null),
    [lake, highlight]
  );

  function sizeCanvas() {
    const cv = canvasRef.current;
    const r = wrapRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    sizeRef.current = { w: r.width, h: r.height };
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
  }

  function fitView() {
    const { w, h } = sizeRef.current;
    const n = lake.n;
    const z = Math.min(w / n, h / n) * 1.08;
    const v = view.current;
    v.fitZ = z;
    v.z = z;
    v.px = (w - n * z) / 2;
    v.py = (h - n * z) / 2;
    v.ready = true;
  }

  function normalizeView() {
    const v = view.current;
    const { w, h } = sizeRef.current;
    const ext = lake.n * v.z;
    v.px = clamp(v.px, w * 0.25 - ext, w * 0.75);
    v.py = clamp(v.py, h * 0.25 - ext, h * 0.75);
  }

  function drawTiles(ctx, v) {
    const { w, h } = sizeRef.current;
    const tl = latLonFromGrid(lake, (0 - v.px) / v.z, (0 - v.py) / v.z);
    const br = latLonFromGrid(lake, (w - v.px) / v.z, (h - v.py) / v.z);
    const minLon = Math.min(tl.lon, br.lon);
    const maxLon = Math.max(tl.lon, br.lon);
    const minLat = Math.min(tl.lat, br.lat);
    const maxLat = Math.max(tl.lat, br.lat);
    const mPerPx = lake.cfg.metersPerCell / v.z;
    let z = Math.round(Math.log2(groundResolution(lake.cfg.lat, 0) / mPerPx));
    z = clamp(z, 11, 18);
    const xMin = Math.floor(lon2tileX(minLon, z));
    const xMax = Math.floor(lon2tileX(maxLon, z));
    const yMin = Math.floor(lat2tileY(maxLat, z));
    const yMax = Math.floor(lat2tileY(minLat, z));
    if ((xMax - xMin + 1) * (yMax - yMin + 1) > 140) return; // safety cap
    for (let tx = xMin; tx <= xMax; tx++) {
      for (let ty = yMin; ty <= yMax; ty++) {
        const img = getTile(z, tx, ty, () => drawRef.current());
        if (!img) continue;
        const nw = gridFromLatLon(lake, tileY2lat(ty, z), tileX2lon(tx, z));
        const se = gridFromLatLon(lake, tileY2lat(ty + 1, z), tileX2lon(tx + 1, z));
        const x0 = nw.x * v.z + v.px;
        const y0 = nw.y * v.z + v.py;
        ctx.drawImage(img, x0, y0, (se.x - nw.x) * v.z + 1, (se.y - nw.y) * v.z + 1);
      }
    }
  }

  function draw() {
    const cv = canvasRef.current;
    if (!cv || !view.current.ready) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = sizeRef.current;
    const v = view.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const ext = lake.n * v.z;
    if (showMap) {
      ctx.fillStyle = '#0d1118';
      ctx.fillRect(0, 0, w, h);
      drawTiles(ctx, v);
      if (overlay) ctx.drawImage(overlay, v.px, v.py, ext, ext);
    } else {
      ctx.fillStyle = 'rgb(213,208,178)';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bathy, v.px, v.py, ext, ext);
    }
    if (hl) ctx.drawImage(hl, v.px, v.py, ext, ext);

    const proj = (wx, wy) => [wx * v.z + v.px, wy * v.z + v.py];

    if (showStructures) {
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const s of structures) {
        const [sx, sy] = proj(s.x, s.y);
        if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
        const st = STRUCT_STYLE[s.type];
        const sel = selection?.kind === 'structure' && selection.s.id === s.id;
        ctx.beginPath();
        ctx.arc(sx, sy, sel ? 13 : 11, 0, Math.PI * 2);
        ctx.fillStyle = st.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = sel ? '#ffffff' : 'rgba(255,255,255,0.85)';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.fillText(st.ch, sx, sy + 0.5);
      }
    }

    if (showSpots) {
      for (const s of spots) {
        const [sx, sy] = proj(s.x, s.y);
        if (sx < -30 || sy < -30 || sx > w + 30 || sy > h + 30) continue;
        const sel = selection?.kind === 'spot' && selection.spot.id === s.id;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 6, sy - 10);
        ctx.lineTo(sx + 6, sy - 10);
        ctx.closePath();
        ctx.fillStyle = '#ff4d6d';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy - 14, sel ? 9 : 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy - 14, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }

    if (gps.fix) {
      const g = gridFromLatLon(lake, gps.fix.lat, gps.fix.lon);
      const [sx, sy] = proj(g.x, g.y);
      if (sx > -60 && sy > -60 && sx < w + 60 && sy < h + 60) {
        const accPx = (gps.fix.acc / lake.cfg.metersPerCell) * v.z;
        if (accPx > 10 && accPx < Math.max(w, h) * 1.5) {
          ctx.beginPath();
          ctx.arc(sx, sy, accPx, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(30,144,255,0.10)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(30,144,255,0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#1e90ff';
        ctx.fill();
      }
    }

    if (selection?.kind === 'point') {
      const [sx, sy] = proj(selection.x, selection.y);
      for (const [color, lw] of [
        ['rgba(10,25,35,0.7)', 4],
        ['#ffffff', 2],
      ]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        for (const [ax, ay, bx, by] of [
          [-16, 0, -5, 0],
          [5, 0, 16, 0],
          [0, -16, 0, -5],
          [0, 5, 0, 16],
        ]) {
          ctx.moveTo(sx + ax, sy + ay);
          ctx.lineTo(sx + bx, sy + by);
        }
        ctx.stroke();
      }
    }

    // Scale bar
    const mPerPx = lake.cfg.metersPerCell / v.z;
    const targets = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000];
    let tm = targets[0];
    for (const t of targets) if (t / mPerPx <= w * 0.34) tm = t;
    const barPx = tm / mPerPx;
    const bx = 12;
    const by = h - 14;
    ctx.strokeStyle = 'rgba(10,25,35,0.85)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + barPx, by);
    ctx.moveTo(bx, by - 5);
    ctx.lineTo(bx, by);
    ctx.moveTo(bx + barPx, by - 5);
    ctx.lineTo(bx + barPx, by);
    ctx.stroke();
    const lbl = tm >= 1000 ? `${tm / 1000} km` : `${tm} m`;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.strokeText(lbl, bx + 4, by - 4);
    ctx.fillStyle = '#12303f';
    ctx.fillText(lbl, bx + 4, by - 4);
  }

  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    drawRef.current();
  });

  useEffect(() => {
    sizeCanvas();
    fitView();
    setSelection(null);
    setSaveName(null);
    gpsCentered.current = false;
    drawRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lake]);

  useEffect(() => {
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      sizeCanvas();
      fitView();
      drawRef.current();
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lake]);

  useEffect(() => {
    if (!flyTo || !view.current.ready) return;
    const { w, h } = sizeRef.current;
    const v = view.current;
    v.z = clamp(Math.max(v.z, v.fitZ * 3.2), v.fitZ * MINZOOM, v.fitZ * MAXZOOM);
    v.px = w / 2 - flyTo.x * v.z;
    v.py = h / 2 - flyTo.y * v.z;
    if (flyTo.spotId) {
      const spot = spots.find((s) => s.id === flyTo.spotId);
      if (spot) setSelection({ kind: 'spot', spot });
    }
    drawRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo]);

  // ---- GPS ----
  function toggleGps() {
    if (gps.on) {
      if (geoWatch.current != null) navigator.geolocation.clearWatch(geoWatch.current);
      geoWatch.current = null;
      setGps({ on: false, fix: null, error: null });
      return;
    }
    if (!('geolocation' in navigator)) {
      setGps({ on: false, fix: null, error: 'GPS not available on this device' });
      return;
    }
    setGps({ on: true, fix: null, error: null });
    gpsCentered.current = false;
    geoWatch.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: pos.coords.accuracy || 0,
        };
        setGps({ on: true, fix, error: null });
        const lk = lakeRef.current;
        const g = gridFromLatLon(lk, fix.lat, fix.lon);
        if (!gpsCentered.current && g.x > 0 && g.x < lk.n && g.y > 0 && g.y < lk.n) {
          gpsCentered.current = true;
          const { w, h } = sizeRef.current;
          const v = view.current;
          v.z = Math.max(v.z, v.fitZ * 2);
          v.px = w / 2 - g.x * v.z;
          v.py = h / 2 - g.y * v.z;
          drawRef.current();
        }
      },
      (err) => setGps((s) => ({ ...s, error: err.message })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }
  useEffect(
    () => () => {
      if (geoWatch.current != null) navigator.geolocation.clearWatch(geoWatch.current);
    },
    []
  );

  let gpsStatus = null;
  if (gps.on) {
    if (gps.error) gpsStatus = `GPS: ${gps.error}`;
    else if (!gps.fix) gpsStatus = 'Getting GPS fix…';
    else {
      const g = gridFromLatLon(lake, gps.fix.lat, gps.fix.lon);
      if (g.x < 0 || g.x > lake.n || g.y < 0 || g.y > lake.n)
        gpsStatus = 'GPS: you are outside this lake’s map';
    }
  }

  function zoomAt(sx, sy, factor) {
    const v = view.current;
    const nz = clamp(v.z * factor, v.fitZ * MINZOOM, v.fitZ * MAXZOOM);
    const f = nz / v.z;
    v.px = sx - (sx - v.px) * f;
    v.py = sy - (sy - v.py) * f;
    v.z = nz;
    normalizeView();
    drawRef.current();
  }
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const cv = canvasRef.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAtRef.current(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, []);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const mid = (map) => {
    let x = 0;
    let y = 0;
    for (const p of map.values()) {
      x += p.x;
      y += p.y;
    }
    return { x: x / map.size, y: y / map.size };
  };

  function onPointerDown(e) {
    canvasRef.current.setPointerCapture(e.pointerId);
    const p = pos(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size === 1) {
      g.tap = { x: p.x, y: p.y, t: performance.now(), moved: false, multi: false };
    } else if (g.tap) {
      g.tap.multi = true;
    }
    g.lastDist = 0;
    g.lastMid = mid(pointers.current);
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = pos(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    const v = view.current;
    const pts = [...pointers.current.values()];
    const m = mid(pointers.current);
    if (g.tap && Math.hypot(p.x - g.tap.x, p.y - g.tap.y) > 7) g.tap.moved = true;
    if (pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (g.lastDist) {
        const nz = clamp(v.z * (d / g.lastDist), v.fitZ * MINZOOM, v.fitZ * MAXZOOM);
        const f = nz / v.z;
        v.px = m.x - (m.x - v.px) * f;
        v.py = m.y - (m.y - v.py) * f;
        v.z = nz;
      }
      g.lastDist = d;
    }
    if (g.lastMid) {
      v.px += m.x - g.lastMid.x;
      v.py += m.y - g.lastMid.y;
    }
    g.lastMid = m;
    normalizeView();
    drawRef.current();
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    g.lastDist = 0;
    g.lastMid = pointers.current.size ? mid(pointers.current) : null;
    if (
      pointers.current.size === 0 &&
      g.tap &&
      !g.tap.moved &&
      !g.tap.multi &&
      performance.now() - g.tap.t < 500
    ) {
      handleTap(g.tap.x, g.tap.y);
    }
    if (pointers.current.size === 0) g.tap = null;
  }

  function handleTap(sx, sy) {
    const v = view.current;
    const proj = (wx, wy) => [wx * v.z + v.px, wy * v.z + v.py];
    setSaveName(null);
    if (showSpots) {
      for (const s of spots) {
        const [mx, my] = proj(s.x, s.y);
        if (Math.hypot(mx - sx, my - 14 - sy) < 16 || Math.hypot(mx - sx, my - sy) < 12) {
          setSelection({ kind: 'spot', spot: s });
          setSheetOpen(false);
          return;
        }
      }
    }
    if (showStructures) {
      for (const s of structures) {
        const [mx, my] = proj(s.x, s.y);
        if (Math.hypot(mx - sx, my - sy) < 18) {
          setSelection({ kind: 'structure', s });
          setSheetOpen(false);
          return;
        }
      }
    }
    const wx = (sx - v.px) / v.z;
    const wy = (sy - v.py) / v.z;
    const d = depthAt(lake, wx, wy);
    if (d <= 0) {
      setSelection(null);
      return;
    }
    setSelection({ kind: 'point', x: wx, y: wy, depth: d });
  }

  function submitSave(e) {
    e.preventDefault();
    const name = (saveName || '').trim() || `Spot ${new Date().toLocaleDateString()}`;
    onAddSpot({
      id: `sp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      x: selection.x,
      y: selection.y,
      depth: selection.depth,
      name,
      createdAt: Date.now(),
    });
    setSaveName(null);
    setSelection(null);
  }

  function zoomCenter(f) {
    const { w, h } = sizeRef.current;
    zoomAt(w / 2, h / 2, f);
  }

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div className="chip-row">
        <button
          className={'chip' + (highlight.enabled ? ' on' : '')}
          onClick={() => setSheetOpen((o) => !o)}
        >
          ◍ {highlight.enabled ? `${highlight.min}–${highlight.max} m` : 'Depth band'}
        </button>
        <button
          className={'chip' + (showStructures ? ' on' : '')}
          onClick={() => setShowStructures((x) => !x)}
        >
          ⛰ Structure
        </button>
        <button className={'chip' + (showSpots ? ' on' : '')} onClick={() => setShowSpots((x) => !x)}>
          📍 Spots
        </button>
        <button className={'chip' + (gps.on ? ' on' : '')} onClick={toggleGps}>
          🧭 GPS
        </button>
        <button className={'chip' + (showMap ? ' on' : '')} onClick={() => setShowMap((x) => !x)}>
          🗺️ Map
        </button>
        {gpsStatus && <div className="gps-status">{gpsStatus}</div>}
      </div>

      {showMap && <div className="osm-attrib">© OpenStreetMap contributors</div>}

      <div className="zoom-btns">
        <button onClick={() => zoomCenter(1.45)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomCenter(1 / 1.45)} aria-label="Zoom out">−</button>
        <button
          onClick={() => {
            fitView();
            drawRef.current();
          }}
          aria-label="Reset view"
        >
          ⌖
        </button>
      </div>

      <div className="legend">
        <div className="legend-bar" style={{ background: depthGradientCSS() }} />
        <div className="legend-labels">
          <span>0 m</span>
          <span className={lake.cfg.surveyed ? 'legend-surveyed' : 'legend-est'}>
            {lake.cfg.surveyed ? '✓ survey' : '≈ est.'}
          </span>
          <span>{lake.maxDepth} m</span>
        </div>
      </div>

      {selection && (
        <div className="info-card">
          <button
            className="card-close"
            onClick={() => {
              setSelection(null);
              setSaveName(null);
            }}
          >
            ✕
          </button>
          {selection.kind === 'point' && saveName === null && (
            <>
              <div className="depth-big">{selection.depth.toFixed(1)} m</div>
              <div className="muted">
                {lake.cfg.surveyed
                  ? 'from the digitized 1975 depth survey'
                  : 'estimated depth — interpolated from lake shape'}
              </div>
              <button className="btn primary" onClick={() => setSaveName('')}>
                📍 Save this spot
              </button>
            </>
          )}
          {selection.kind === 'point' && saveName !== null && (
            <form onSubmit={submitSave} className="save-form">
              <div className="muted">Saving spot at {selection.depth.toFixed(1)} m</div>
              <input
                autoFocus
                value={saveName}
                placeholder="Spot name (e.g. Rīta zandarts)"
                onChange={(e) => setSaveName(e.target.value)}
              />
              <div className="btn-row">
                <button type="submit" className="btn primary">Save</button>
                <button type="button" className="btn" onClick={() => setSaveName(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {selection.kind === 'structure' && (
            <>
              <div className="card-title">
                <span
                  className="struct-dot"
                  style={{ background: STRUCT_STYLE[selection.s.type].color }}
                >
                  {STRUCT_STYLE[selection.s.type].ch}
                </span>
                {selection.s.label} · ~{selection.s.depth.toFixed(1)} m
              </div>
              <p className="card-note">{selection.s.note}</p>
              <p className="fine-print">
                {lake.cfg.surveyed
                  ? 'From the digitized 1975 depth survey — verify on the water.'
                  : 'Estimated from lake shape and reported depths — verify on the water.'}
              </p>
            </>
          )}
          {selection.kind === 'spot' && (
            <>
              <div className="card-title">📍 {selection.spot.name}</div>
              <div className="muted">
                {selection.spot.depth.toFixed(1)} m · saved{' '}
                {new Date(selection.spot.createdAt).toLocaleDateString()}
              </div>
              <button
                className="btn danger"
                onClick={() => {
                  if (window.confirm(`Delete “${selection.spot.name}”?`)) {
                    onDeleteSpot(selection.spot.id);
                    setSelection(null);
                  }
                }}
              >
                Delete spot
              </button>
            </>
          )}
        </div>
      )}

      {sheetOpen && (
        <FilterSheet
          highlight={highlight}
          maxDepth={lake.maxDepth}
          onChange={onHighlightChange}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

function FilterSheet({ highlight, maxDepth, onChange, onClose }) {
  const { enabled, min, max } = highlight;
  const md = Math.round(maxDepth * 2) / 2;
  const step = md <= 12 ? 0.5 : 1;
  const rnd = (v) => Math.max(step, Math.round(v / step) * step);
  const presets = [
    { label: 'Shallow', min: 0, max: rnd(md * 0.25) },
    { label: 'Mid', min: rnd(md * 0.25), max: rnd(md * 0.6) },
    { label: 'Deep', min: rnd(md * 0.6), max: md },
  ];
  return (
    <div className="sheet">
      <div className="sheet-head">
        <span className="sheet-title">Highlight depth band</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange({ ...highlight, enabled: e.target.checked })}
          />
          <span className="switch-track" />
        </label>
        <button className="card-close static" onClick={onClose}>✕</button>
      </div>
      <div className="range-row">
        <span className="range-label">Min {min} m</span>
        <input
          type="range"
          min="0"
          max={md}
          step={step}
          value={min}
          onChange={(e) =>
            onChange({ enabled: true, min: Math.min(+e.target.value, max - step), max })
          }
        />
      </div>
      <div className="range-row">
        <span className="range-label">Max {max} m</span>
        <input
          type="range"
          min="0"
          max={md}
          step={step}
          value={max}
          onChange={(e) =>
            onChange({ enabled: true, min, max: Math.max(+e.target.value, min + step) })
          }
        />
      </div>
      <div className="preset-row">
        {presets.map((p) => (
          <button
            key={p.label}
            className="chip"
            onClick={() => onChange({ enabled: true, min: p.min, max: p.max })}
          >
            {p.label} {p.min}–{p.max} m
          </button>
        ))}
      </div>
    </div>
  );
}

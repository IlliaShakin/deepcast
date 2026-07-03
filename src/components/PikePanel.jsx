import { useState } from 'react';
import { PIKE_BAITS, baitById } from '../pikeBaits.js';
import FishIcon from './FishIcon.jsx';
import { compass, pressureWord } from '../weather.js';

const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const SEASON = { spring: '🌱 Spring', summer: '☀️ Summer', fall: '🍂 Autumn', winter: '❄️ Winter' };
const PHASE = { dawn: '🌅 Dawn', day: '🌞 Daytime', dusk: '🌇 Dusk', night: '🌙 Night' };

export default function PikePanel({ lake, conditions: c, sol, hotspots, weatherLoading, onGoto, onShowAll }) {
  const [openBaits, setOpenBaits] = useState(false);
  const act = c.activity;
  const stars = '●'.repeat(act.score) + '○'.repeat(5 - act.score);

  // Best windows today: solunar majors/minors + dawn & dusk, upcoming first.
  const now = c.nowMs;
  const windows = [
    ...sol.windows.map((w) => ({ start: w.start, end: w.end, label: w.type === 'major' ? 'Major feed' : 'Minor feed' })),
    { start: sol.sun.sunrise.getTime() - 45 * 60000, end: sol.sun.sunrise.getTime() + 45 * 60000, label: '🌅 Dawn' },
    { start: sol.sun.sunset.getTime() - 45 * 60000, end: sol.sun.sunset.getTime() + 45 * 60000, label: '🌇 Dusk' },
  ].sort((a, b) => a.start - b.start);

  return (
    <div className="panel">
      <h2>🐟 Pike Today</h2>
      <div className="muted panel-sub">
        {lake.cfg.name} · līdaka · Щука · as of {fmt(now)}
      </div>

      {c.closed && (
        <div className="warn-box">
          ⚠️ Pike are in <b>closed season</b> in Latvia (1 May – 15 June). Catch-and-release
          restrictions apply — check makskeresana.lv before fishing.
        </div>
      )}

      {/* Activity rating */}
      <div className="sol-card">
        <div className="sol-head">
          <div>
            <div className="sol-phase">Bite rating: {act.label}</div>
            <div className={'pike-stars s' + act.score}>{stars}</div>
          </div>
          <div className="sol-rating">
            <div className="muted">{SEASON[c.season]}</div>
            <div className="muted">{PHASE[c.phase]}</div>
            <div className="muted">{c.moon.emoji} {Math.round(c.moon.illum * 100)}%</div>
          </div>
        </div>

        <div className="cond-row">
          <span className="cond-chip">💧 ~{c.waterTemp}°C water*</span>
          {c.weather ? (
            <>
              <span className="cond-chip">🌡 {Math.round(c.weather.tempC)}°C air</span>
              <span className="cond-chip">📊 {pressureWord(c.weather.pressureTrend)}</span>
              <span className="cond-chip">💨 {Math.round(c.weather.windSpeed)} km/h {compass(c.weather.windDirDeg)}</span>
              <span className="cond-chip">☁️ {c.weather.cloudPct}%</span>
            </>
          ) : (
            <span className="cond-chip">{weatherLoading ? '⏳ loading weather…' : '📡 weather offline'}</span>
          )}
        </div>

        <ul className="factor-list">
          {act.factors.map((f, i) => (
            <li key={i} className={f.good === true ? 'f-good' : f.good === false ? 'f-bad' : 'f-neutral'}>
              <span className="f-mark">{f.good === true ? '▲' : f.good === false ? '▼' : '•'}</span> {f.text}
            </li>
          ))}
        </ul>
        <p className="fine-print">*Water temp is estimated from season + air temp (no live lake-temp source).</p>
      </div>

      {/* Best windows today */}
      <h3 className="sub-h">⏱ Best windows today</h3>
      <div className="win-list">
        {windows.map((w, i) => {
          const active = now >= w.start && now <= w.end;
          const past = w.end < now;
          return (
            <div key={i} className={'win-row' + (active ? ' win-now' : '') + (past ? ' win-past' : '')}>
              <span className={'win-badge ' + (w.label.includes('Major') ? 'major' : 'minor')}>
                {active ? 'NOW' : past ? '—' : '›'}
              </span>
              <span className="win-time">{fmt(w.start)} – {fmt(w.end)}</span>
              <span className="muted win-why">{w.label}</span>
            </div>
          );
        })}
      </div>

      {/* Hotspots */}
      <h3 className="sub-h">📍 Most likely spots right now</h3>
      <div className="muted" style={{ marginBottom: 8 }}>
        Ranked from {lake.cfg.surveyed ? 'the digitized survey' : 'the estimated bathymetry'}, this
        season, the time of day{c.weather ? ' and live weather' : ''}.
      </div>
      <button className="btn primary full" onClick={onShowAll}>🗺️ Show all {hotspots.length} spots on the map</button>
      {hotspots.map((s) => {
        const b = baitById(s.baitId);
        return (
          <div key={s.id} className="pike-spot">
            <div className="pike-spot-head">
              <span className="pike-rank">{s.rank}</span>
              <span className="pike-where">{s.where} · ~{s.depth.toFixed(1)} m</span>
              <button className="btn small" onClick={() => onGoto(s)}>Map</button>
            </div>
            <div className="pike-reason">{s.reason}</div>
            <div className="pike-bait">{b.emoji} <b>{b.en}</b> — {b.action}</div>
          </div>
        );
      })}

      {/* Today's bait picks */}
      <h3 className="sub-h">🎣 Best baits for these conditions</h3>
      {c.baits.map((b, i) => (
        <div key={b.id} className="species-card">
          <div className="bait-pick">
            <span className="bait-emoji">{b.emoji}</span>
            <div>
              <div className="sp-lv">{i + 1}. {b.en} <span className="muted">· {b.lv} · {b.ru}</span></div>
              <div className="muted">{b.best}</div>
            </div>
          </div>
        </div>
      ))}

      {/* Full bait encyclopedia */}
      <h3 className="sub-h">
        <button className="link-btn" onClick={() => setOpenBaits((o) => !o)}>
          {openBaits ? '▾' : '▸'} All pike baits & how each works
        </button>
      </h3>
      {openBaits &&
        PIKE_BAITS.map((b) => (
          <div key={b.id} className="species-card">
            <div className="species-body" style={{ paddingTop: 12 }}>
              <div className="bait-title">
                <span className="bait-emoji">{b.emoji}</span>
                <span className="sp-lv">{b.en}</span>
                <span className="muted"> · {b.lv} · {b.ru}</span>
              </div>
              <p><b>Action:</b> {b.action}</p>
              <p><b>How it works:</b> {b.how}</p>
              <p><b>Retrieve:</b> {b.retrieve}</p>
              <p className="muted">Shines: {b.best}</p>
            </div>
          </div>
        ))}

      <p className="fine-print">
        Predictions blend pike biology (ambush-at-edges, 10–20°C activity, dawn/dusk peaks, falling
        pressure) with this lake's depth map. Guidance only — verify on the water, and follow closed
        seasons and limits (makskeresana.lv).
      </p>
    </div>
  );
}

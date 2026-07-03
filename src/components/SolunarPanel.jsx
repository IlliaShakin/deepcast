import { useMemo, useState } from 'react';
import { solunarDay } from '../solunar.js';

const DAY_MS = 86400000;
const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function SolunarPanel({ lake }) {
  const { lat, lon } = lake.cfg;
  const [idx, setIdx] = useState(0);
  const days = useMemo(() => {
    const t = new Date();
    const out = [];
    for (let i = 0; i < 7; i++) out.push(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i));
    return out;
  }, []);
  const day = days[idx];
  const data = useMemo(() => solunarDay(day, lat, lon), [day, lat, lon]);
  const dayStart = day.getTime();
  const pct = (t) => Math.max(0, Math.min(100, ((t - dayStart) / DAY_MS) * 100));
  const now = Date.now();

  return (
    <div className="panel">
      <h2>🌙 Bite Times</h2>
      <div className="muted panel-sub">{lake.cfg.name} · solunar feeding windows</div>
      <div className="day-strip">
        {days.map((d, i) => {
          const dd = solunarDay(d, lat, lon);
          return (
            <button
              key={i}
              className={'daybtn' + (i === idx ? ' on' : '')}
              onClick={() => setIdx(i)}
            >
              <span className="daybtn-wd">
                {i === 0 ? 'Today' : d.toLocaleDateString([], { weekday: 'short' })}
              </span>
              <span className="daybtn-emoji">{dd.phase.emoji}</span>
              <span className="daybtn-num">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="sol-card">
        <div className="sol-head">
          <div>
            <div className="sol-phase">
              {data.phase.emoji} {data.phase.name}
            </div>
            <div className="muted">{Math.round(data.phase.illum * 100)}% illuminated</div>
          </div>
          <div className="sol-rating">
            <div className="stars">
              {'★'.repeat(data.score)}
              {'☆'.repeat(4 - data.score)}
            </div>
            <div className="muted">{data.label} day</div>
          </div>
        </div>

        <div className="sun-row">
          <span>🌅 {fmt(data.sun.sunrise.getTime())}</span>
          <span>🌇 {fmt(data.sun.sunset.getTime())}</span>
        </div>

        <div className="tl">
          {data.windows.map((w, i) => (
            <div
              key={i}
              className={'tl-span ' + w.type}
              style={{
                left: pct(w.start) + '%',
                width: pct(w.end) - pct(w.start) + '%',
              }}
            />
          ))}
          <div className="tl-sun" style={{ left: pct(data.sun.sunrise.getTime()) + '%' }} />
          <div className="tl-sun" style={{ left: pct(data.sun.sunset.getTime()) + '%' }} />
          {now > dayStart && now < dayStart + DAY_MS && (
            <div className="tl-now" style={{ left: pct(now) + '%' }} />
          )}
        </div>
        <div className="tl-hours">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        <div className="tl-key">
          <span className="key-swatch major" /> Major feed
          <span className="key-swatch minor" /> Minor
          <span className="key-swatch sun" /> Sunrise / sunset
        </div>

        <div className="win-list">
          {data.windows.map((w, i) => (
            <div key={i} className="win-row">
              <span className={'win-badge ' + w.type}>
                {w.type === 'major' ? 'MAJOR' : 'minor'}
              </span>
              <span className="win-time">
                {fmt(w.start)} – {fmt(w.end)}
              </span>
              <span className="muted win-why">
                {w.type === 'major' ? 'moon overhead / underfoot' : 'moonrise / moonset'}
              </span>
            </div>
          ))}
        </div>

        {data.duskDawnBonus && (
          <div className="sol-note">🔥 A major period lines up with dawn or dusk — prime window.</div>
        )}
        <p className="fine-print">
          Solunar periods are approximations from moon phase and transit for this lake's location.
          Weather fronts and barometric pressure matter just as much.
        </p>
      </div>
    </div>
  );
}

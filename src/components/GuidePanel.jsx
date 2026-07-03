import { useState } from 'react';
import { SPECIES } from '../speciesGuide.js';
import { seasonalAdvice } from '../advice.js';
import { PIKE_BAITS } from '../pikeBaits.js';
import FishIcon from './FishIcon.jsx';

const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const SEASON_LABEL = { spring: '🌱 Spring', summer: '☀️ Summer', fall: '🍂 Fall', winter: '❄️ Winter' };

function currentSeason() {
  const m = new Date().getMonth();
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'fall';
}

export default function GuidePanel({ lake, structures, onHighlight }) {
  const [season, setSeason] = useState(currentSeason);
  const [open, setOpen] = useState(null);

  return (
    <div className="panel">
      <h2>🎣 Species Guide</h2>
      <div className="muted panel-sub">
        {lake.cfg.name} · advice tuned to this lake ({lake.maxDepth} m max)
      </div>
      <div className="season-chips">
        {SEASONS.map((s) => (
          <button
            key={s}
            className={'chip' + (s === season ? ' on' : '')}
            onClick={() => setSeason(s)}
          >
            {SEASON_LABEL[s]}
          </button>
        ))}
      </div>
      {SPECIES.map((sp) => {
        const advice = seasonalAdvice(lake, structures, sp, season);
        const [lo, hi] = advice.band;
        const s = sp.seasons[season];
        const isOpen = open === sp.id;
        return (
          <div key={sp.id} className="species-card">
            <button className="species-head" onClick={() => setOpen(isOpen ? null : sp.id)}>
              <span className="sp-fish" style={{ background: sp.color + '22' }}>
                <FishIcon id={sp.id} color={sp.color} size={44} />
              </span>
              <span className="sp-names">
                <span className="sp-lv">{sp.lv}</span>
                <span className="sp-alt">
                  {sp.en} · {sp.ru}
                </span>
              </span>
              <span className="sp-depth">
                {lo}–{hi} m
              </span>
              <span className="sp-caret">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div className="species-body">
                <div className="advice-box">📍 {advice.text}</div>
                <p>
                  <b>Where:</b> {s.where}
                </p>
                <p>
                  <b>Tip:</b> {s.tip}
                </p>
                <p>
                  <b>Lures:</b> {sp.lures}
                </p>
                {sp.id === 'pike' && (
                  <div className="bait-breakdown">
                    <div className="bait-bd-title">🎣 Pike baits — how each works</div>
                    {PIKE_BAITS.map((b) => (
                      <div key={b.id} className="bait-bd-row">
                        <span className="bait-emoji">{b.emoji}</span>
                        <div>
                          <b>{b.en}</b> <span className="muted">· {b.ru}</span>
                          <div className="bait-bd-how">{b.how}</div>
                        </div>
                      </div>
                    ))}
                    <div className="muted" style={{ marginTop: 6 }}>
                      The 🐟 Pike tab picks the best of these for right now and marks where to throw
                      it.
                    </div>
                  </div>
                )}
                <button className="btn primary" onClick={() => onHighlight(lo, hi)}>
                  ◍ Highlight {lo}–{hi} m on the map
                </button>
              </div>
            )}
          </div>
        );
      })}
      <p className="fine-print">
        Advice combines each species' seasonal temperature/depth behaviour with this lake's measured
        max depth and detected structure. Depths are estimates — adjust for water clarity, forage and
        weather, and check makskeresana.lv for current closed seasons and size limits.
      </p>
    </div>
  );
}

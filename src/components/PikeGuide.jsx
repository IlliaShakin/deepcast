import { PIKE_BAITS } from '../pikeBaits.js';
import BaitIcon from './BaitIcon.jsx';

const SEASONS = [
  {
    k: '🌱 Spring',
    t: 'Shallow, weedy bays and flooded margins — the warmest water. Pike are the first to spawn (4–10 °C), then recover and feed hard nearby.',
  },
  {
    k: '☀️ Summer',
    t: 'Weed edges and bay mouths early and late. In the heat the bigger fish slide to cooler, more oxygenated water and shade — in a shallow lake that means the deeper basin and the outside weed line.',
  },
  {
    k: '🍂 Autumn',
    t: 'Prime time. Pike feed aggressively to fatten for winter, on shallow weed and along drop-offs. Big fish are on the move — the trophy season.',
  },
  {
    k: '❄️ Winter',
    t: 'Deeper, stable water next to the last green weed. Feeding windows are short (often midday) — slow everything right down.',
  },
];

export default function PikeGuide({ lake }) {
  return (
    <div className="pg">
      <section className="pg-section">
        <div className="pg-h">🎯 How pike behave</div>
        <p>
          Pike (<b>līdaka · щука</b>) are ambush predators. They lie motionless in or beside cover —
          weed beds and weed edges, drop-offs, reed lines, points and bay mouths — then strike in one
          short, explosive burst. Their whole world is the <b>edge</b>: the seam where shallow cover
          meets deeper open water.
        </p>
        <p>
          They're cold-blooded, so temperature rules them. Most active around <b>10–20 °C</b>; below
          ~5 °C they slow right down and drop deeper; above ~23 °C they sulk in cover and cooler
          water. Find the edge and the right depth for the conditions and you've found the pike.
        </p>
      </section>

      <section className="pg-section">
        <div className="pg-h">🕑 When they bite</div>
        <ul className="pg-list">
          <li><b>Dawn &amp; dusk are the peak</b> — low light lets the pike out-see its prey.</li>
          <li><b>Overcast, breezy days</b> keep them feeding right through the middle of the day.</li>
          <li>In summer they also feed <b>after dark</b>; bright, flat-calm midday is the slowest.</li>
        </ul>
      </section>

      <section className="pg-section">
        <div className="pg-h">📅 Where they hold, by season</div>
        <div className="pg-seasons">
          {SEASONS.map((s) => (
            <div key={s.k} className="pg-season">
              <div className="pg-season-k">{s.k}</div>
              <div className="pg-season-t">{s.t}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="pg-section">
        <div className="pg-h">🗺️ Structure to target</div>
        <p>
          The <b>weed edge where shallow drops toward deeper water</b> is the number-one pike lane.
          After that: drop-offs, humps, reed lines, points, bay mouths and channels. On the map those
          are the <b>D</b> (drop-off), <b>H</b> (hump), <b>O</b> (deep hole) and <b>F</b> (flat)
          markers — and the <b>🐟 Pike</b> tab ranks the best of them for right now.
        </p>
      </section>

      <section className="pg-section">
        <div className="pg-h">🌦️ Weather triggers</div>
        <ul className="pg-list">
          <li><b>Falling pressure + cloud + a light-to-moderate wind ripple</b> → the best window; pike feed hard ahead of a front.</li>
          <li><b>Rising pressure + bright, clear skies</b> after a cold front → tough; pike lock tight to cover, so slow down and fish right in the weed.</li>
          <li><b>Wind</b> pushes warm surface water and bait onto the downwind bank — fish the windward edges.</li>
        </ul>
      </section>

      <section className="pg-section">
        <div className="pg-h">🔎 Best way to find them</div>
        <ol className="pg-steps">
          <li>Start on the <b>weed edge or drop-off nearest deeper water</b>.</li>
          <li>Fish the <b>low-light windows</b> — dawn, dusk, and all day when it's overcast.</li>
          <li><b>Cover water fast</b> with a search bait (spoon, spinner) to find active fish, then slow down and work the spot thoroughly.</li>
          <li><b>Match depth to light:</b> shallow edges when it's dim, the deeper basin and holes in bright heat.</li>
          <li>Let the <b>🐟 Pike</b> tab do the maths — it marks the likeliest spots for the current day, time and live weather.</li>
        </ol>
      </section>

      {lake.cfg.surveyed && lake.cfg.id === 'babite' && (
        <section className="pg-section pg-note">
          <div className="pg-h">📍 On Babīte specifically</div>
          <p>
            Babīte is a shallow reed bowl — about <b>1.7 m at its deepest, in the west</b>. Pike
            patrol the weed edges and the <b>deeper south-west basin</b>, plus the deeper Varkaļu
            channel at the north-east. The depth map here is the <b>digitized 1975 survey</b>, so the
            edges you're reading are real, not estimated.
          </p>
        </section>
      )}

      <section className="pg-section">
        <div className="pg-h">🎣 Baits — and how each works for pike</div>
        <div className="pg-baits">
          {PIKE_BAITS.map((b) => (
            <div key={b.id} className="pg-bait">
              <div className="pg-bait-img"><BaitIcon id={b.id} size={104} /></div>
              <div className="pg-bait-body">
                <div className="pg-bait-name">
                  {b.en} <span className="muted">· {b.lv} · {b.ru}</span>
                </div>
                <div className="pg-bait-action">{b.action}</div>
                <p className="pg-bait-how">{b.how}</p>
                <p className="pg-bait-retrieve"><b>Retrieve:</b> {b.retrieve}</p>
                <p className="muted pg-bait-best">Shines: {b.best}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

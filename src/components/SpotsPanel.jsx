export default function SpotsPanel({ spots, lakes, onGoto, onDelete }) {
  return (
    <div className="panel">
      <h2>📍 My Spots</h2>
      {spots.length === 0 && (
        <div className="empty">
          <p>No saved spots yet.</p>
          <p className="muted">
            Tap anywhere on the water to read the depth, then hit <b>Save this spot</b>.
          </p>
        </div>
      )}
      {lakes.map((l) => {
        const ls = spots
          .filter((s) => s.lakeId === l.id)
          .sort((a, b) => b.createdAt - a.createdAt);
        if (!ls.length) return null;
        return (
          <section key={l.id}>
            <h3 className="lake-h">{l.name}</h3>
            {ls.map((s) => (
              <div key={s.id} className="spot-row">
                <div className="spot-main">
                  <div className="spot-name">{s.name}</div>
                  <div className="muted">
                    {s.depth.toFixed(1)} m · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn small" onClick={() => onGoto(s)}>
                  Map
                </button>
                <button
                  className="btn small danger"
                  onClick={() => {
                    if (window.confirm(`Delete “${s.name}”?`)) onDelete(s.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

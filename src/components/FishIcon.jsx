// Recognizable inline-SVG side views of each species. Stylized but built from
// the real defining features (body shape, fin placement, markings) so pike vs.
// zander vs. perch read differently at a glance. viewBox is 0 0 120 60.

const lighten = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return `rgb(${r},${g},${b})`;
};

function Base({ color, children, belly }) {
  return (
    <>
      {children}
      <circle cx="26" cy="26" r="2.6" fill="#0c1116" />
      <circle cx="25.2" cy="25.2" r="0.8" fill="#fff" opacity="0.85" />
    </>
  );
}

function drawings(id, c) {
  const light = lighten(c, 55);
  const dark = lighten(c, -35);
  switch (id) {
    case 'pike': // long body, duck-bill snout, dorsal set far back, pale spots
      return (
        <>
          <path d="M8 30 Q40 12 92 24 L112 16 L108 30 L112 44 L92 36 Q40 48 8 30 Z" fill={c} />
          <path d="M8 30 Q40 40 92 34 Q60 32 8 30 Z" fill={light} opacity="0.6" />
          <path d="M70 22 L84 14 L86 24 Z" fill={dark} />
          <path d="M60 36 L72 46 L74 37 Z" fill={dark} />
          {[46, 56, 66, 76].map((x, i) => (
            <circle key={i} cx={x} cy={i % 2 ? 32 : 27} r="2" fill={light} opacity="0.85" />
          ))}
          <path d="M8 30 Q14 26 20 27 L20 33 Q14 34 8 30 Z" fill={dark} />
        </>
      );
    case 'zander': // elongated, tall spiny dorsal, faint bars, forked tail
      return (
        <>
          <path d="M10 30 Q42 16 90 24 L110 16 L107 30 L110 44 L90 36 Q42 44 10 30 Z" fill={c} />
          <path d="M10 30 Q42 38 90 33 Q55 32 10 30 Z" fill={light} opacity="0.55" />
          <path d="M42 22 L48 12 L54 21 L60 12 L66 21 L70 14 L70 24 Z" fill={dark} />
          <path d="M74 25 L88 20 L88 28 Z" fill={dark} opacity="0.8" />
          {[42, 52, 62, 72].map((x, i) => (
            <rect key={i} x={x} y="23" width="2.4" height="12" rx="1" fill={dark} opacity="0.5" />
          ))}
        </>
      );
    case 'perch': // deep humped body, twin dorsal, bold vertical bars, red fins
      return (
        <>
          <path d="M14 32 Q34 12 66 16 Q92 20 104 18 L100 32 L104 46 Q92 44 66 48 Q34 52 14 32 Z" fill={c} />
          <path d="M18 34 Q40 44 78 42 Q46 42 18 34 Z" fill={light} opacity="0.6" />
          <path d="M40 18 L46 8 L52 16 L58 8 L62 17 Z" fill={dark} />
          {[38, 50, 62, 74].map((x, i) => (
            <path key={i} d={`M${x} 18 Q${x + 1} 32 ${x - 1} 46`} stroke={dark} strokeWidth="3" opacity="0.55" fill="none" />
          ))}
          <path d="M52 48 L58 58 L64 48 Z" fill="#d8562f" />
          <path d="M84 44 L96 52 L96 40 Z" fill="#d8562f" />
        </>
      );
    case 'bream': // very tall compressed diamond body, small head, long anal fin
      return (
        <>
          <path d="M16 30 Q34 6 60 8 Q80 10 96 22 L112 16 L108 30 L112 44 L96 38 Q80 50 60 52 Q34 54 16 30 Z" fill={c} />
          <path d="M22 32 Q46 46 84 40 Q50 42 22 32 Z" fill={light} opacity="0.5" />
          <path d="M50 10 L54 4 L60 10 Z" fill={dark} />
          <path d="M46 50 Q60 60 82 50 L80 44 Q60 50 48 44 Z" fill={dark} opacity="0.7" />
        </>
      );
    case 'roach': // streamlined silver body, reddish fins, moderate fork
      return (
        <>
          <path d="M12 30 Q40 16 88 24 L110 18 L107 30 L110 42 L88 36 Q40 44 12 30 Z" fill={c} />
          <path d="M12 30 Q40 38 88 33 Q50 32 12 30 Z" fill={light} opacity="0.7" />
          <path d="M56 22 L64 15 L66 23 Z" fill={dark} />
          <path d="M52 37 L60 45 L62 37 Z" fill="#c94f4a" />
          <path d="M20 32 L26 40 L30 33 Z" fill="#c94f4a" opacity="0.8" />
        </>
      );
    case 'tench': // thick rounded body, small rounded fins, red eye, barbels
      return (
        <>
          <path d="M12 30 Q38 14 80 20 Q98 23 108 20 L105 30 L108 40 Q98 37 80 40 Q38 46 12 30 Z" fill={c} />
          <path d="M16 32 Q42 42 82 38 Q48 38 16 32 Z" fill={light} opacity="0.5" />
          <path d="M60 20 Q66 14 70 20 Z" fill={dark} />
          <path d="M56 40 Q62 46 66 40 Z" fill={dark} />
          <path d="M84 24 L96 22 L96 38 L84 36 Z" fill={dark} opacity="0.65" />
          <circle cx="26" cy="26" r="2.4" fill="#b8371f" />
          <path d="M12 29 q-4 1 -6 3 M12 31 q-4 2 -5 4" stroke={dark} strokeWidth="1" fill="none" />
        </>
      );
    case 'carp': // deep robust body, big scales, long dorsal, two barbels
      return (
        <>
          <path d="M12 30 Q34 12 68 14 Q92 16 104 22 L114 17 L110 30 L114 43 L104 38 Q92 44 68 46 Q34 48 12 30 Z" fill={c} />
          <path d="M18 33 Q44 44 86 40 Q50 40 18 33 Z" fill={light} opacity="0.5" />
          <path d="M44 16 Q66 8 96 18 L96 24 Q66 16 46 22 Z" fill={dark} opacity="0.7" />
          {[40, 52, 64, 76].map((x, i) =>
            [24, 32].map((y, j) => (
              <path key={`${i}-${j}`} d={`M${x} ${y} q3 3 6 0`} stroke={dark} strokeWidth="1" fill="none" opacity="0.5" />
            ))
          )}
          <path d="M12 28 q-4 0 -6 2 M12 32 q-4 1 -6 4" stroke={dark} strokeWidth="1.2" fill="none" />
        </>
      );
    case 'burbot': // eel-like elongated, long dorsal/anal fins, chin barbel, mottled
      return (
        <>
          <path d="M8 30 Q40 20 78 24 Q98 26 110 22 Q116 26 116 30 Q116 34 110 38 Q98 34 78 36 Q40 40 8 30 Z" fill={c} />
          <path d="M12 31 Q46 38 88 35 Q50 35 12 31 Z" fill={light} opacity="0.45" />
          <path d="M50 24 Q78 18 108 23 L108 27 Q78 22 50 27 Z" fill={dark} opacity="0.6" />
          <path d="M46 36 Q76 42 106 37 L106 33 Q76 38 46 33 Z" fill={dark} opacity="0.6" />
          {[34, 48, 62, 76, 90].map((x, i) => (
            <circle key={i} cx={x} cy={i % 2 ? 33 : 28} r="2.4" fill={dark} opacity="0.55" />
          ))}
          <path d="M12 33 q-2 4 0 7" stroke={dark} strokeWidth="1.2" fill="none" />
        </>
      );
    default:
      return <ellipse cx="60" cy="30" rx="48" ry="16" fill={c} />;
  }
}

export default function FishIcon({ id, color, size = 46 }) {
  return (
    <svg
      viewBox="0 0 120 60"
      width={size}
      height={size * 0.5}
      role="img"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <Base color={color}>{drawings(id, color)}</Base>
    </svg>
  );
}

// Recognizable inline-SVG illustrations of each pike lure, so the bait section
// reads at a glance instead of relying on an emoji. viewBox is 0 0 100 64.

const OUT = '#2f3b46';
const MET = '#cdd4dc';
const DK = '#9aa3ac';
const HOOK = '#aeb6bd';

function Treble({ x, y, s = 1 }) {
  return (
    <g stroke={HOOK} strokeWidth={1.6 * s} fill="none" strokeLinecap="round">
      <line x1={x} y1={y} x2={x} y2={y + 6 * s} />
      <path d={`M${x} ${y + 6 * s} q0 ${5 * s} ${-4 * s} ${5 * s} q${-3.5 * s} 0 ${-3 * s} ${-4 * s}`} />
      <path d={`M${x} ${y + 6 * s} q0 ${5 * s} ${4 * s} ${5 * s} q${3.5 * s} 0 ${3 * s} ${-4 * s}`} />
      <path d={`M${x} ${y + 6 * s} q0 ${7 * s} ${0} ${7.5 * s}`} />
    </g>
  );
}
const Ring = ({ x, y }) => <circle cx={x} cy={y} r="3.4" fill="none" stroke={HOOK} strokeWidth="1.6" />;

function drawing(id) {
  switch (id) {
    case 'spoon': // Daredevle — red blade with white centre stripe, split ring + treble
      return (
        <>
          <Ring x={74} y={18} />
          <g transform="rotate(-24 50 33)">
            <ellipse cx="50" cy="33" rx="27" ry="13.5" fill="#d33b30" stroke={OUT} strokeWidth="2" />
            <ellipse cx="50" cy="33" rx="27" ry="4.2" fill="#f2f2f0" />
            <ellipse cx="41" cy="28" rx="6" ry="2.4" fill="#fff" opacity="0.5" />
          </g>
          <Treble x={28} y={45} s={1.05} />
        </>
      );
    case 'spinnerbait': // safety-pin wire: blade up, skirted jig head + hook down
      return (
        <>
          <line x1="30" y1="24" x2="30" y2="20" stroke={HOOK} strokeWidth="2" />
          <circle cx="30" cy="18" r="3.2" fill="none" stroke={HOOK} strokeWidth="1.6" />
          {/* upper arm to blade */}
          <path d="M30 24 L70 16" stroke={DK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <ellipse cx="74" cy="15" rx="6.5" ry="10" fill={MET} stroke={OUT} strokeWidth="1.6" transform="rotate(18 74 15)" />
          <ellipse cx="72" cy="12" rx="2.4" ry="4" fill="#fff" opacity="0.6" transform="rotate(18 74 15)" />
          {/* lower arm to head */}
          <path d="M30 24 L34 44" stroke={DK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="34" cy="46" r="6" fill="#3a4650" stroke={OUT} strokeWidth="1.5" />
          <circle cx="32" cy="44" r="1.5" fill="#e8c33a" />
          {/* skirt */}
          <g stroke="#e0564a" strokeWidth="2" strokeLinecap="round">
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={`M40 ${44 + i} q14 ${-2 + i} 26 ${2 + i * 1.5}`} fill="none" opacity="0.85" />
            ))}
          </g>
          <path d="M40 50 q10 8 20 6" stroke={HOOK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      );
    case 'jerkbait': // hard minnow with diving lip, eye, two trebles
      return (
        <>
          <path d="M18 30 L10 40" stroke={HOOK} strokeWidth="1.6" />
          <circle cx="9" cy="41" r="3" fill="none" stroke={HOOK} strokeWidth="1.5" />
          <path d="M20 22 Q54 16 84 24 Q90 26 90 30 Q90 34 84 36 Q54 44 20 38 Q15 34 15 30 Q15 26 20 22 Z" fill="#5aa7c4" stroke={OUT} strokeWidth="2" />
          <path d="M20 31 Q54 40 84 34 Q54 36 20 31 Z" fill="#eef4f6" opacity="0.7" />
          {/* diving lip */}
          <path d="M18 30 L11 41 L20 40 Z" fill="#bcd6e2" stroke={OUT} strokeWidth="1.5" />
          <circle cx="26" cy="28" r="2.6" fill="#fff" stroke={OUT} strokeWidth="1" />
          <circle cx="26" cy="28" r="1.1" fill="#0c1116" />
          <Treble x={44} y={40} />
          <Treble x={70} y={38} />
        </>
      );
    case 'softswim': // soft shad on a jig head, paddle tail
      return (
        <>
          <path d="M26 22 L20 16" stroke={HOOK} strokeWidth="1.6" />
          <circle cx="19" cy="15" r="2.8" fill="none" stroke={HOOK} strokeWidth="1.5" />
          {/* jig head */}
          <circle cx="30" cy="30" r="8" fill="#3a4650" stroke={OUT} strokeWidth="1.6" />
          <circle cx="27" cy="27" r="1.6" fill="#e8c33a" />
          {/* body */}
          <path d="M30 22 Q60 18 78 27 Q72 30 78 33 Q60 42 30 38 Q24 30 30 22 Z" fill="#8fb06a" stroke={OUT} strokeWidth="2" />
          <path d="M34 31 Q56 38 76 32 Q54 34 34 31 Z" fill="#eef3e6" opacity="0.6" />
          {/* paddle tail */}
          <path d="M78 22 Q90 24 88 30 Q90 36 78 38 Q84 30 78 22 Z" fill="#7a9b58" stroke={OUT} strokeWidth="1.6" />
          <path d="M40 24 q8 0 12 2" stroke="#fff" strokeWidth="1" fill="none" opacity="0.5" />
        </>
      );
    case 'topwater': // popper with cupped face, waterline splash, two trebles
      return (
        <>
          <path d="M4 30 H96" stroke="#4aa3d0" strokeWidth="1.4" opacity="0.5" />
          <path d="M14 27 q3 -4 6 0 M22 26 q3 -5 6 0" stroke="#7cc4e6" strokeWidth="1.4" fill="none" opacity="0.7" />
          <path d="M84 30 L92 26" stroke={HOOK} strokeWidth="1.6" />
          <circle cx="93" cy="25" r="2.8" fill="none" stroke={HOOK} strokeWidth="1.5" />
          {/* body */}
          <path d="M30 22 Q60 20 82 26 Q86 28 86 31 Q86 34 82 36 Q60 42 30 40 Q26 31 30 22 Z" fill="#e0b13a" stroke={OUT} strokeWidth="2" />
          {/* cupped mouth */}
          <path d="M30 22 Q22 31 30 40 Q34 31 30 22 Z" fill="#b98a1f" stroke={OUT} strokeWidth="1.5" />
          <circle cx="26" cy="30" r="1.8" fill="#5a3d0a" />
          <circle cx="52" cy="26" r="2.2" fill="#fff" stroke={OUT} strokeWidth="0.8" />
          <circle cx="52" cy="26" r="1" fill="#0c1116" />
          <Treble x={46} y={40} />
          <Treble x={70} y={38} />
        </>
      );
    case 'inline': // inline spinner / bucktail — shaft, blade on clevis, beads, dressed treble
      return (
        <>
          <circle cx="10" cy="30" r="3.2" fill="none" stroke={HOOK} strokeWidth="1.6" />
          <line x1="13" y1="30" x2="74" y2="30" stroke={DK} strokeWidth="2.2" strokeLinecap="round" />
          {/* blade on clevis */}
          <line x1="30" y1="30" x2="34" y2="18" stroke={HOOK} strokeWidth="1.4" />
          <ellipse cx="35" cy="15" rx="7" ry="9.5" fill={MET} stroke={OUT} strokeWidth="1.6" transform="rotate(12 35 15)" />
          <ellipse cx="33" cy="12" rx="2.4" ry="4" fill="#fff" opacity="0.6" transform="rotate(12 35 15)" />
          {/* beads */}
          {[46, 53, 60].map((x, i) => (
            <circle key={i} cx={x} cy="30" r="4" fill={i === 1 ? '#e0564a' : '#d9a441'} stroke={OUT} strokeWidth="1.2" />
          ))}
          {/* bucktail dressing over rear treble */}
          <g stroke="#c23b30" strokeWidth="1.8" strokeLinecap="round" opacity="0.85">
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1="66" y1={26 + i * 2} x2="86" y2={30 + i * 3} />
            ))}
          </g>
          <Treble x={74} y={34} />
        </>
      );
    case 'deadbait': // whole dead roach on a wire trace with trebles
      return (
        <>
          <path d="M14 24 Q8 26 10 30" stroke={HOOK} strokeWidth="1.6" fill="none" />
          <path d="M20 30 Q48 20 74 27 L86 22 L83 30 L86 38 L74 33 Q48 42 20 30 Z" fill="#c3ccd3" stroke={OUT} strokeWidth="2" />
          <path d="M22 31 Q48 39 74 32 Q48 34 22 31 Z" fill="#eef2f5" opacity="0.7" />
          <path d="M44 33 L52 43 L54 34 Z" fill="#c0524b" opacity="0.85" />
          {/* dead X eye */}
          <g stroke="#33404b" strokeWidth="1.4" strokeLinecap="round">
            <line x1="27" y1="27" x2="31" y2="31" />
            <line x1="31" y1="27" x2="27" y2="31" />
          </g>
          <Treble x={52} y={36} s={0.9} />
          <Treble x={70} y={35} s={0.9} />
        </>
      );
    default:
      return <ellipse cx="50" cy="32" rx="30" ry="10" fill={MET} stroke={OUT} strokeWidth="2" />;
  }
}

export default function BaitIcon({ id, size = 84 }) {
  return (
    <svg
      viewBox="0 0 100 64"
      width={size}
      height={size * 0.64}
      role="img"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {drawing(id)}
    </svg>
  );
}

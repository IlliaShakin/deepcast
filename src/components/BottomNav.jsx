const TABS = [
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'pike', icon: '🐟', label: 'Pike' },
  { id: 'spots', icon: '📍', label: 'Spots' },
  { id: 'times', icon: '🌙', label: 'Times' },
  { id: 'guide', icon: '🎣', label: 'Guide' },
];

export default function BottomNav({ tab, onTab }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={'nav-btn' + (tab === t.id ? ' on' : '')}
          onClick={() => onTab(t.id)}
        >
          <span className="nav-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

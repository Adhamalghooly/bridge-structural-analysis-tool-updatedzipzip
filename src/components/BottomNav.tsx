export type MainTab = 'reports' | 'inputs' | 'modeling' | 'projects' | 'solver' | 'foundations';

interface BottomNavProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

interface MobileItem {
  id: MainTab;
  label: string;
  icon: string | string[];
  color: string;
}

const SvgIcon = ({ d, size = 20, stroke = 1.8 }: { d: string | string[]; size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)
      ? d.map((p, i) => <path key={i} d={p} />)
      : <path d={d} />}
  </svg>
);

const mobileItems: MobileItem[] = [
  {
    id: 'projects',
    label: 'المشاريع',
    icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    color: '#4A5578',
  },
  {
    id: 'inputs',
    label: 'المدخلات',
    icon: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
    color: '#7C3AED',
  },
  {
    id: 'modeling',
    label: 'النمذجة',
    icon: 'M2 12L12 2l10 10M5 9v11h14V9',
    color: '#0EA5E9',
  },
  {
    id: 'solver',
    label: 'التصميم',
    icon: ['M12 2L2 7l10 5 10-5-10-5', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
    color: '#1D4ED8',
  },
  {
    id: 'foundations',
    label: 'الأساسات',
    icon: ['M3 21h18', 'M5 21V10', 'M19 21V10', 'M8 21v-5h8v5', 'M12 3L2 10h20L12 3'],
    color: '#D97706',
  },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: '#0F1E3C',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', height: 62,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.25)',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {mobileItems.map(item => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '8px 0', position: 'relative',
            }}
          >
            {isActive && (
              <span style={{
                position: 'absolute', top: 0, left: '50%',
                transform: 'translateX(-50%)',
                width: 28, height: 3, borderRadius: '0 0 4px 4px',
                background: item.color,
              }} />
            )}
            <span style={{ color: isActive ? item.color : 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}>
              <SvgIcon d={item.icon} size={20} stroke={isActive ? 2.2 : 1.7} />
            </span>
            <span style={{
              fontSize: 10, fontWeight: isActive ? 700 : 400,
              color: isActive ? item.color : 'rgba(255,255,255,0.4)',
              transition: 'color 0.15s',
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

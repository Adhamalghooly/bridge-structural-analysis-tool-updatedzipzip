import React from 'react';

interface NavSection {
  id: string;
  label: string;
  icon: string;
  color: string;
}

interface NavSubItem {
  id: string;
  label: string;
  icon?: string;
}

interface AppHeaderProps {
  section?: NavSection | null;
  sub?: NavSubItem | null;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onRunAnalysis?: () => void;
  analyzed?: boolean;
  warningsCount?: number;
  rightSlot?: React.ReactNode;
}

const SvgIcon = ({ d, size = 16, stroke = 2 }: { d: string | string[]; size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)
      ? d.map((p, i) => <path key={i} d={p} />)
      : <path d={d} />}
  </svg>
);

const hardhatPath = ["M2 20h20", "M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8z", "M12 4v2"];

export default function AppHeader({
  section,
  sub,
  sidebarCollapsed,
  onToggleSidebar,
  onRunAnalysis,
  analyzed,
  rightSlot,
}: AppHeaderProps) {
  const C = {
    navy: '#0F1E3C',
    amber: '#F59E0B',
    amberDim: '#D97706',
    bg: '#F4F6FA',
    surface: '#FFFFFF',
    border: '#DDE3EF',
    text: '#0F1E3C',
    textMid: '#4A5578',
    textLight: '#8492B0',
  };

  return (
    <header style={{
      height: 52,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      flexShrink: 0,
      zIndex: 50,
      position: 'relative',
    }}>
      {/* Logo strip (visible when sidebar is collapsed or on mobile) */}
      {sidebarCollapsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.amber} 0%, ${C.amberDim} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.navy,
          }}>
            <SvgIcon d={hardhatPath} size={16} stroke={2} />
          </div>
          <div>
            <div style={{ color: C.navy, fontWeight: 800, fontSize: 13, lineHeight: 1.2 }}>Structural</div>
            <div style={{ color: C.amberDim, fontWeight: 700, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' }}>Master Pro</div>
          </div>
        </div>
      )}

      {/* Sidebar toggle button */}
      <button
        onClick={onToggleSidebar}
        style={{
          width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`,
          background: C.bg, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: C.textMid, flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Section badge + title */}
      {section && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: `${section.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: section.color,
          }}>
            <SvgIcon d={section.icon} size={16} stroke={2} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              {sub?.label ?? section.label}
            </div>
            {sub && (
              <div style={{ fontSize: 11, color: C.textLight, marginTop: 1 }}>{section.label}</div>
            )}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right side actions */}
      {rightSlot ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{rightSlot}</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onRunAnalysis && (
            <button
              onClick={onRunAnalysis}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 12px', height: 32, borderRadius: 8,
                background: analyzed ? '#16A34A' : C.navy,
                border: 'none', cursor: 'pointer',
                color: 'white', fontSize: 12, fontWeight: 600,
                fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
                transition: 'background 0.2s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="15" x2="23" y2="15" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="15" x2="4" y2="15" />
              </svg>
              <span>تشغيل التحليل</span>
            </button>
          )}
          <button style={{
            width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.bg, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: C.textMid,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <button style={{
            width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.bg, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: C.textMid,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.navy}, #1A3060)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: "system-ui",
          }}>م.أ</div>
        </div>
      )}
    </header>
  );
}

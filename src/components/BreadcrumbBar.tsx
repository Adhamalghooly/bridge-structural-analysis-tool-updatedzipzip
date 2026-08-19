interface BreadcrumbBarProps {
  sectionLabel: string;
  sectionColor: string;
  subLabel?: string | null;
}

export default function BreadcrumbBar({ sectionLabel, sectionColor, subLabel }: BreadcrumbBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 16px', height: 32,
      borderBottom: '1px solid #DDE3EF',
      background: '#F4F6FA',
      fontSize: 11, color: '#4A5578',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      flexShrink: 0, overflowX: 'auto', whiteSpace: 'nowrap',
    }}>
      <span style={{ color: '#8492B0' }}>Structural Master</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
      <span style={{ color: sectionColor, fontWeight: 600 }}>{sectionLabel}</span>
      {subLabel && (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span style={{ color: '#0F1E3C', fontWeight: 600 }}>{subLabel}</span>
        </>
      )}
    </div>
  );
}

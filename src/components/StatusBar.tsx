interface StatusBarProps {
  columnsCount: number;
  beamsCount: number;
  slabsCount: number;
  analyzed: boolean;
  warningsCount?: number;
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 8px 2px 0' }}>
      <span style={{ fontWeight: 700, color }}>{value}</span>
      <span>{label}</span>
    </div>
  );
}

function Sep() {
  return <span style={{ width: 1, height: 12, background: '#C5CEDF', margin: '0 8px', flexShrink: 0 }} />;
}

export default function StatusBar({ columnsCount, beamsCount, slabsCount, analyzed, warningsCount = 0 }: StatusBarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '4px 16px', background: '#EEF1F8',
      borderBottom: '1px solid #DDE3EF',
      fontSize: 11, color: '#4A5578',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
      overflowX: 'auto', whiteSpace: 'nowrap',
      flexShrink: 0, height: 30,
    }}>
      <Chip label="أعمدة" value={columnsCount} color="#0F1E3C" />
      <Sep />
      <Chip label="جسور" value={beamsCount} color="#0EA5E9" />
      <Sep />
      <Chip label="بلاطات" value={slabsCount} color="#7C3AED" />
      <Sep />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: analyzed ? '#16A34A' : '#8492B0' }}>
        {analyzed ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>تم التحليل</span>
          </>
        ) : (
          <span>لم يُحلَّل</span>
        )}
      </div>
      {warningsCount > 0 && (
        <>
          <Sep />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#D97706' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <span>{warningsCount} تحذير</span>
          </div>
        </>
      )}
      <div style={{ marginRight: 'auto' }} />
      <div style={{ color: '#8492B0', fontSize: 10 }}>ACI 318-19</div>
    </div>
  );
}

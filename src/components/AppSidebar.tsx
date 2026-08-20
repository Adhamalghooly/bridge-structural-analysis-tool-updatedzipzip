import { useState, type CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalUpdate } from '@/lib/localUpdatePlugin';

interface NavSubItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | null;
}

interface NavSection {
  id: string;
  label: string;
  icon: string | string[];
  color: string;
  subs: NavSubItem[] | null;
}

interface AppSidebarProps {
  mainTab: string;
  activeTab: string;
  collapsed: boolean;
  onNavigate: (sectionId: string, subId: string | null) => void;
}

const SvgIcon = ({ d, size = 18, stroke = 1.8 }: { d: string | string[]; size?: number; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)
      ? d.map((p, i) => <path key={i} d={p} />)
      : <path d={d} />}
  </svg>
);

const NAV: NavSection[] = [
  {
    id: 'projects',
    label: 'المشاريع',
    icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    color: '#4A5578',
    subs: null,
  },
  {
    id: 'inputs',
    label: 'المدخلات',
    icon: ['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
    color: '#7C3AED',
    subs: [
      { id: 'input',        label: 'المواد والأقسام',     icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', badge: null },
      { id: 'loads-input',  label: 'الأحمال',             icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01', badge: null },
      { id: 'ribbed',       label: 'بلاطات هوردي',         icon: 'M2 5h20v14H2z M2 9h20 M2 13h20', badge: 'جديد' },
      { id: 'auto-design',  label: 'تصميم تلقائي',         icon: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0h10m-10 0H5a2 2 0 0 1-2-2V5m0 6h18', badge: null },
      { id: 'building',     label: 'مبنى متعدد الطوابق',    icon: 'M2 12L12 2l10 10M5 9v11h14V9', badge: null },
    ],
  },
  {
    id: 'modeling',
    label: 'النمذجة',
    icon: 'M2 12L12 2l10 10M5 9v11h14V9',
    color: '#0EA5E9',
    subs: [
      { id: 'modeler',         label: 'رسم النموذج',          icon: 'M3 21h18 M3 10l5-7 5 7 5-7 M3 14h18', badge: null },
      { id: 'view',            label: 'العرض ثلاثي الأبعاد',   icon: 'M12 2L2 7l10 5 10-5-10-5 M2 17l10 5 10-5 M2 12l10 5 10-5', badge: null },
      { id: 'analysis',        label: 'التحليل الرئيسي',       icon: 'M3 3v18h18 M7 16l4-4 4 4 4-8', badge: null },
      { id: 'support-manager', label: 'المساند والركائز',       icon: 'M3 21h18 M5 21V10 M19 21V10 M8 21v-5h8v5 M12 3L2 10h20L12 3', badge: null },
      { id: 'ai-assistant',   label: 'المساعد الذكي',          icon: 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0h10m-10 0H5a2 2 0 0 1-2-2V5m0 6h18', badge: 'AI' },
    ],
  },
  {
    id: 'solver',
    label: 'التصميم',
    icon: ['M12 2L2 7l10 5 10-5-10-5', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
    color: '#1D4ED8',
    subs: [
      { id: 'beam-design',     label: 'تصميم الجسور',          icon: 'M3 12h18 M6 8l-3 4 3 4 M18 8l3 4-3 4', badge: null },
      { id: 'col-design',      label: 'تصميم الأعمدة',          icon: 'M8 3h8v18H8z M5 3h14 M5 21h14', badge: null },
      { id: 'slab-design',     label: 'تصميم البلاطات',          icon: 'M2 5h20v14H2z M2 9h20 M2 13h20', badge: null },
      { id: 'etabs',           label: 'استيراد ETABS',           icon: 'M4 4h16v4H4z M4 10h7v10H4z M13 10h7v10h-7z', badge: null },
      { id: 'boq',             label: 'جدول الكميات',            icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z', badge: null },
    ],
  },
  {
    id: 'foundations',
    label: 'الأساسات',
    icon: ['M3 21h18', 'M5 21V10', 'M19 21V10', 'M8 21v-5h8v5', 'M12 3L2 10h20L12 3'],
    color: '#D97706',
    subs: [
      { id: 'foundation',            label: 'قواعد منفردة',         icon: 'M3 21h18 M5 21V10 M19 21V10 M8 21v-5h8v5 M12 3L2 10h20L12 3', badge: null },
      { id: 'strip-footing',         label: 'أساسات شريطية',         icon: 'M3 12h18 M6 8l-3 4 3 4 M18 8l3 4-3 4', badge: null },
      { id: 'foundation-settlement', label: 'حسابات الهبوط',         icon: 'M3 3v18h18 M7 16l4-4 4 4 4-8', badge: null },
      { id: 'foundation-group',      label: 'تصنيف الأساسات',         icon: 'M12 2L2 7l10 5 10-5-10-5 M2 17l10 5 10-5 M2 12l10 5 10-5', badge: null },
      { id: 'foundation-drawings',   label: 'الرسومات التنفيذية',     icon: 'M3 21h18 M3 10l5-7 5 7 5-7 M3 14h18', badge: null },
    ],
  },
  {
    id: 'reports',
    label: 'التقارير',
    icon: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
    color: '#BE185D',
    subs: [
      { id: 'design',    label: 'التقرير الإنشائي',    icon: 'M3 21h18 M3 10l5-7 5 7 5-7 M3 14h18', badge: null },
      { id: 'results',   label: 'النتائج التفصيلية',   icon: 'M3 3v18h18 M7 16l4-4 4 4 4-8', badge: null },
      { id: 'export',    label: 'تصدير PDF/DXF',       icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3', badge: null },
    ],
  },
];

export { NAV };
export type { NavSection, NavSubItem };

export default function AppSidebar({ mainTab, activeTab, collapsed, onNavigate }: AppSidebarProps) {
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateActive, setUpdateActive] = useState(false);

  const openUpdateManager = async () => {
    setUpdateOpen(true);
    if (!Capacitor.isNativePlatform()) {
      setUpdateStatus('هذه الوظيفة متاحة داخل تطبيق Android فقط.');
      return;
    }
    try {
      const status = await LocalUpdate.getStatus();
      setUpdateActive(status.active);
      setUpdateStatus(status.active ? 'يوجد تحديث محلي مُفعّل حالياً.' : 'لا يوجد تحديث محلي مُفعّل.');
    } catch {
      setUpdateStatus('تعذر قراءة حالة التحديث المحلي.');
    }
  };

  const chooseLocalUpdate = async (mode: 'zip' | 'folder') => {
    setUpdateBusy(true);
    setUpdateStatus('جارٍ قراءة ملفات التحديث والتحقق منها...');
    try {
      const status = mode === 'zip'
        ? await LocalUpdate.pickUpdatePackage()
        : await LocalUpdate.pickUpdateFolder();
      setUpdateActive(status.active);
      setUpdateStatus('تم تثبيت التحديث المحلي وإعادة تحميل الواجهة.');
    } catch (error: any) {
      setUpdateStatus(error?.message || 'تم إلغاء العملية أو فشل التحديث.');
    } finally {
      setUpdateBusy(false);
    }
  };

  const clearLocalUpdate = async () => {
    setUpdateBusy(true);
    try {
      await LocalUpdate.clearUpdate();
      setUpdateActive(false);
      setUpdateStatus('تمت إزالة التحديث المحلي والعودة إلى النسخة الأصلية.');
    } catch {
      setUpdateStatus('تعذر إزالة التحديث المحلي.');
    } finally {
      setUpdateBusy(false);
    }
  };
  const [expanded, setExpanded] = useState<string | null>(mainTab);

  const C = {
    navy: '#0F1E3C',
    amber: '#F59E0B',
    amberDim: '#D97706',
    border: '#DDE3EF',
    bg: '#F4F6FA',
    textMid: '#4A5578',
  };

  const handleSectionClick = (sec: NavSection) => {
    if (sec.subs) {
      const wasOpen = expanded === sec.id;
      setExpanded(wasOpen ? null : sec.id);
      if (!wasOpen) {
        onNavigate(sec.id, sec.subs[0]?.id ?? null);
      }
    } else {
      onNavigate(sec.id, null);
    }
  };

  const hardhatPath = ["M2 20h20", "M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8z", "M12 4v2"];
  const settingsPath = "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z";

  return (
    <aside style={{
      width: collapsed ? 60 : 220,
      background: C.navy,
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      flexShrink: 0,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
    }}>
      {/* Logo strip */}
      <div style={{
        padding: collapsed ? '16px 0' : '16px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.amber} 0%, ${C.amberDim} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.navy,
        }}>
          <SvgIcon d={hardhatPath} size={18} stroke={2} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 14, lineHeight: 1.2, letterSpacing: 0.3 }}>Structural</div>
            <div style={{ color: C.amber, fontWeight: 700, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Master Pro</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV.map(sec => {
          const isActive = mainTab === sec.id;
          const isOpen = expanded === sec.id && !collapsed;

          return (
            <div key={sec.id}>
              <button
                onClick={() => handleSectionClick(sec)}
                title={collapsed ? sec.label : undefined}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px 0' : '9px 14px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  borderRight: isActive ? `3px solid ${sec.color}` : '3px solid transparent',
                  transition: 'all 0.15s', position: 'relative',
                }}
              >
                <span style={{ color: isActive ? sec.color : 'rgba(255,255,255,0.55)', flexShrink: 0, transition: 'color 0.15s' }}>
                  <SvgIcon d={sec.icon} size={19} stroke={isActive ? 2.2 : 1.7} />
                </span>
                {!collapsed && (
                  <>
                    <span style={{
                      color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                      fontSize: 13, fontWeight: isActive ? 700 : 500,
                      flex: 1, textAlign: 'right', transition: 'color 0.15s',
                    }}>
                      {sec.label}
                    </span>
                    {sec.subs && (
                      <span style={{
                        color: 'rgba(255,255,255,0.3)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s', display: 'flex',
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    )}
                  </>
                )}
                {collapsed && isActive && (
                  <span style={{
                    position: 'absolute', right: 0, top: '50%',
                    transform: 'translateY(-50%)', width: 3, height: 24,
                    background: sec.color, borderRadius: '3px 0 0 3px',
                  }} />
                )}
              </button>

              {/* Sub items */}
              {isOpen && sec.subs && (
                <div style={{ background: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {sec.subs.map(sub => {
                    const isSubActive = activeTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => onNavigate(sec.id, sub.id)}
                        onMouseEnter={e => { if (!isSubActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { if (!isSubActive) (e.currentTarget as HTMLButtonElement).style.background = isSubActive ? `linear-gradient(90deg, ${sec.color}22, ${sec.color}10)` : 'transparent'; }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center',
                          gap: 9, padding: '7px 14px 7px 20px',
                          background: isSubActive
                            ? `linear-gradient(90deg, ${sec.color}22, ${sec.color}10)`
                            : 'transparent',
                          border: 'none',
                          borderRight: isSubActive ? `2px solid ${sec.color}` : '2px solid transparent',
                          cursor: 'pointer', transition: 'all 0.12s',
                        }}
                      >
                        <span style={{ color: isSubActive ? sec.color : 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                          <SvgIcon d={sub.icon} size={14} stroke={isSubActive ? 2.2 : 1.6} />
                        </span>
                        <span style={{
                          color: isSubActive ? 'white' : 'rgba(255,255,255,0.55)',
                          fontSize: 12, fontWeight: isSubActive ? 600 : 400,
                          flex: 1, textAlign: 'right', transition: 'color 0.12s',
                        }}>
                          {sub.label}
                        </span>
                        {sub.badge && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 5px',
                            borderRadius: 10,
                            background: sub.badge === 'AI' ? '#7C3AED' : sub.badge === 'جديد' ? '#0EA5E9' : '#F59E0B',
                            color: 'white', letterSpacing: 0.3,
                          }}>
                            {sub.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom settings */}
      {!collapsed && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 6 }}>
           <button onClick={openUpdateManager} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
            borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12,
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          }}>
            <SvgIcon d={settingsPath} size={14} />
            <span>الإعدادات</span>
          </button>
        </div>
      )}
       {updateOpen && (
         <div style={overlayStyle} onClick={() => !updateBusy && setUpdateOpen(false)}>
           <div onClick={e => e.stopPropagation()} dir="rtl" style={modalStyle}>
             <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
               <div>
                 <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>التحديث المحلي</h2>
                 <p style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.7, color: '#475569' }}>
                   اختر ملف ZIP أو مجلد يحتوي على ملفات بناء React، ويجب أن يحتوي على index.html.
                 </p>
               </div>
               <button onClick={() => setUpdateOpen(false)} style={closeButtonStyle}>×</button>
             </div>
             <div style={{
               marginTop: 16, padding: 12, borderRadius: 10,
               background: updateActive ? '#ecfdf5' : '#f8fafc',
               color: updateActive ? '#047857' : '#475569', fontSize: 12,
             }}>
               {updateStatus || 'لا يوجد تحديث محلي مُفعّل.'}
             </div>
             <div style={{ display: 'grid', gap: 9, marginTop: 16 }}>
               <button disabled={updateBusy} onClick={() => chooseLocalUpdate('zip')} style={updateButton('#1d4ed8')}>
                 اختيار ملف تحديث ZIP
               </button>
               <button disabled={updateBusy} onClick={() => chooseLocalUpdate('folder')} style={updateButton('#0f766e')}>
                 تحديد مجلد التحديث
               </button>
               {updateActive && (
                 <button disabled={updateBusy} onClick={clearLocalUpdate} style={updateButton('#b91c1c')}>
                   إزالة التحديث والعودة للنسخة الأصلية
                 </button>
               )}
             </div>
             <p style={{ margin: '14px 0 0', fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
               التحديث يعمل دون إنترنت. استخدم مجلد dist أو ملف ZIP يحتوي على محتوياته.
             </p>
           </div>
         </div>
       )}
    </aside>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  background: 'rgba(2, 6, 23, 0.65)', padding: 20,
};
const modalStyle: CSSProperties = {
  width: 'min(460px, 100%)', borderRadius: 16, padding: 22,
  background: '#fff', color: '#0f172a', boxShadow: '0 20px 60px rgba(0,0,0,.3)',
};
const closeButtonStyle: CSSProperties = {
  border: 0, background: 'transparent', fontSize: 20, cursor: 'pointer',
};
const updateButton = (background: string): CSSProperties => ({
  border: 0, borderRadius: 9, padding: '11px 14px', color: '#fff',
  background, cursor: 'pointer', fontSize: 13, fontWeight: 700,
});

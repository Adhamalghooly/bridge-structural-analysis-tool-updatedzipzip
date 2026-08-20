import { useState, type CSSProperties } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalUpdate } from '@/lib/localUpdatePlugin';

export default function MobileLocalUpdateButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [active, setActive] = useState(false);

  const openManager = async () => {
    setOpen(true);
    if (!Capacitor.isNativePlatform()) {
      setStatus('التحديث المحلي متاح داخل تطبيق Android فقط.');
      return;
    }
    try {
      const result = await LocalUpdate.getStatus();
      setActive(result.active);
      setStatus(result.active ? 'يوجد تحديث محلي مُفعّل.' : 'لا يوجد تحديث محلي مُفعّل.');
    } catch {
      setStatus('تعذر قراءة حالة التحديث.');
    }
  };

  const choose = async (mode: 'zip' | 'folder') => {
    setBusy(true);
    setStatus('جارٍ التحقق من ملفات التحديث...');
    try {
      const result = mode === 'zip'
        ? await LocalUpdate.pickUpdatePackage()
        : await LocalUpdate.pickUpdateFolder();
      setActive(result.active);
      setStatus('تم تثبيت التحديث وإعادة تحميل التطبيق.');
    } catch (error: any) {
      setStatus(error?.message || 'تم إلغاء الاختيار أو فشل التحديث.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await LocalUpdate.clearUpdate();
      setActive(false);
      setStatus('تمت العودة إلى النسخة الأصلية.');
    } catch {
      setStatus('تعذر إزالة التحديث.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        aria-label="الإعدادات والتحديث المحلي"
        onClick={openManager}
        style={{
          position: 'fixed', top: '10px', left: '10px', zIndex: 120,
          width: 42, height: 42, borderRadius: 12, border: '1px solid rgba(255,255,255,.18)',
          background: '#0F1E3C', color: '#fff', fontSize: 21, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,.2)',
        }}
      >
        ⚙
      </button>
      {open && (
        <div style={overlay} onClick={() => !busy && setOpen(false)}>
          <div dir="rtl" onClick={e => e.stopPropagation()} style={modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>الإعدادات والتحديث المحلي</h2>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
                  اختر ملف ZIP أو مجلد يحتوي على index.html وملفات dist.
                </p>
              </div>
              <button onClick={() => setOpen(false)} style={close}>×</button>
            </div>
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: active ? '#ecfdf5' : '#f8fafc', color: active ? '#047857' : '#475569', fontSize: 12 }}>
              {status || 'لا يوجد تحديث محلي مُفعّل.'}
            </div>
            <div style={{ display: 'grid', gap: 9, marginTop: 16 }}>
              <button disabled={busy} onClick={() => choose('zip')} style={button('#1d4ed8')}>اختيار ملف تحديث ZIP</button>
              <button disabled={busy} onClick={() => choose('folder')} style={button('#0f766e')}>تحديد مجلد التحديث</button>
              {active && <button disabled={busy} onClick={reset} style={button('#b91c1c')}>العودة إلى النسخة الأصلية</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
  alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,.68)', padding: 18,
};
const modal: CSSProperties = {
  width: 'min(440px, 100%)', borderRadius: 16, padding: 20,
  background: '#fff', color: '#0f172a', boxShadow: '0 20px 60px rgba(0,0,0,.35)',
};
const close: CSSProperties = { border: 0, background: 'transparent', fontSize: 22, cursor: 'pointer' };
const button = (background: string): CSSProperties => ({
  border: 0, borderRadius: 9, padding: '12px 14px', color: '#fff',
  background, cursor: 'pointer', fontSize: 13, fontWeight: 700,
});
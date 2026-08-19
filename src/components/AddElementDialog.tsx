import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Slab, Beam, Column } from '@/lib/structuralEngine';

interface Story {
  id: string;
  label: string;
  elevation?: number;
  height: number;
}

interface AddElementDialogProps {
  open: boolean;
  onClose: () => void;
  defaultX?: number;
  defaultY?: number;
  stories: Story[];
  selectedStoryId: string;
  beamB: number;
  beamH: number;
  colB: number;
  colH: number;
  colL: number;
  onAddSlab: (slab: Slab) => void;
  onAddBeam: (beam: Beam) => void;
  onAddColumn: (col: Column) => void;
}

type ElementType = 'column' | 'beam' | 'slab';

// Numeric input that allows intermediate states like '-' and '3.'
function NumInput({
  value, onChange, placeholder, className,
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? '0'}
      className={className ?? 'h-9 font-mono text-sm'}
    />
  );
}

const num = (s: string, fallback = 0) => { const v = parseFloat(s); return isNaN(v) ? fallback : v; };

export default function AddElementDialog({
  open, onClose,
  defaultX = 0, defaultY = 0,
  stories, selectedStoryId,
  beamB, beamH, colB, colH, colL,
  onAddSlab, onAddBeam, onAddColumn,
}: AddElementDialogProps) {
  const [type, setType] = useState<ElementType>('column');

  /* ── Column state ── */
  const [colX, setColX] = useState('0');
  const [colY, setColY] = useState('0');
  const [colStory, setColStory] = useState('');

  /* ── Beam state ── */
  const [bx1, setBx1] = useState('0');
  const [by1, setBy1] = useState('0');
  const [bx2, setBx2] = useState('5');
  const [by2, setBy2] = useState('0');
  const [bz, setBz] = useState('0');
  const [bStory, setBStory] = useState('');

  /* ── Slab state ── */
  const [sx1, setSx1] = useState('0');
  const [sy1, setSy1] = useState('0');
  const [sx2, setSx2] = useState('5');
  const [sy2, setSy2] = useState('4');
  const [sStory, setSStory] = useState('');
  const [slabType, setSlabType] = useState<'solid' | 'one_way_ribbed'>('solid');
  const [slabDir, setSlabDir] = useState<'auto' | 'one_way_x' | 'one_way_y'>('auto');
  const [showVertices, setShowVertices] = useState(false);
  const [vertices, setVertices] = useState<{ x: string; y: string }[]>([]);

  // Reset on open / when default position changes
  useEffect(() => {
    if (!open) return;
    const sid = selectedStoryId === '__ALL__' ? (stories[0]?.id ?? '') : selectedStoryId;
    setType('column');

    setColX(defaultX.toFixed(2));
    setColY(defaultY.toFixed(2));
    setColStory(sid);

    setBx1(defaultX.toFixed(2));
    setBy1(defaultY.toFixed(2));
    setBx2((defaultX + 5).toFixed(2));
    setBy2(defaultY.toFixed(2));
    setBz('0');
    setBStory(sid);

    setSx1(defaultX.toFixed(2));
    setSy1(defaultY.toFixed(2));
    setSx2((defaultX + 5).toFixed(2));
    setSy2((defaultY + 4).toFixed(2));
    setSStory(sid);
    setSlabType('solid');
    setSlabDir('auto');
    setShowVertices(false);
    setVertices([]);
  }, [open, defaultX, defaultY, selectedStoryId, stories]);

  // When slab bounding box changes, keep rectangular vertices in sync (if irregular mode is on)
  const initVerticesFromBBox = () => {
    const x1 = num(sx1); const y1 = num(sy1);
    const x2 = num(sx2); const y2 = num(sy2);
    setVertices([
      { x: x1.toFixed(3), y: y1.toFixed(3) },
      { x: x2.toFixed(3), y: y1.toFixed(3) },
      { x: x2.toFixed(3), y: y2.toFixed(3) },
      { x: x1.toFixed(3), y: y2.toFixed(3) },
    ]);
  };

  const handleAddVertex = () => {
    const last = vertices[vertices.length - 1];
    setVertices([...vertices, { x: last?.x ?? sx2, y: last?.y ?? sy2 }]);
  };
  const handleRemoveVertex = (i: number) => {
    setVertices(vertices.filter((_, idx) => idx !== i));
  };
  const handleVertexChange = (i: number, field: 'x' | 'y', val: string) => {
    setVertices(vertices.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  };

  const storyLabel = (sid: string) => {
    const s = stories.find(st => st.id === sid);
    if (!s) return sid;
    const elev = (s.elevation ?? 0) + s.height;
    return `${s.label} (+${elev.toFixed(0)} م)`;
  };

  const handleSave = () => {
    const ts = Date.now();
    if (type === 'column') {
      onAddColumn({
        id: `EC${ts}`,
        x: num(colX), y: num(colY),
        b: colB, h: colH, L: colL,
        storyId: colStory,
      });
    } else if (type === 'beam') {
      const x1 = num(bx1); const y1 = num(by1);
      const x2 = num(bx2); const y2 = num(by2);
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      onAddBeam({
        id: `EB${ts}`,
        fromCol: '', toCol: '',
        x1, y1, x2, y2,
        z: num(bz) || undefined,
        length: len,
        direction: Math.abs(x2 - x1) >= Math.abs(y2 - y1) ? 'horizontal' : 'vertical',
        b: beamB, h: beamH,
        deadLoad: 0, liveLoad: 0,
        slabs: [],
        storyId: bStory,
      } as Beam);
    } else {
      const parsedVerts = vertices.length >= 3
        ? vertices.map(v => ({ x: num(v.x), y: num(v.y) }))
        : undefined;
      onAddSlab({
        id: `S${ts}`,
        x1: num(sx1), y1: num(sy1),
        x2: num(sx2), y2: num(sy2),
        ...(parsedVerts ? { vertices: parsedVerts } : {}),
        storyId: sStory,
        slabType,
        direction: slabDir,
      });
    }
    onClose();
  };

  const TypeBtn = ({ t, icon, label }: { t: ElementType; icon: string; label: string }) => (
    <button
      onClick={() => setType(t)}
      className={`flex flex-col items-center gap-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all flex-1 ${
        type === t
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border hover:border-primary/40 hover:bg-accent/20 text-muted-foreground'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span>{label}</span>
    </button>
  );

  const StorySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">الدور / المنسوب</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 border border-input rounded-md px-2 text-sm bg-background font-mono"
      >
        {stories.map(s => (
          <option key={s.id} value={s.id}>{storyLabel(s.id)}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md flex flex-col gap-0 p-0 overflow-hidden" style={{ maxHeight: '92dvh' }}>
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-base">إضافة عنصر جديد</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            اختر نوع العنصر ثم أدخل إحداثياته
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            <TypeBtn t="column" icon="🟦" label="عمود" />
            <TypeBtn t="beam" icon="🟫" label="جسر" />
            <TypeBtn t="slab" icon="⬜" label="بلاطة" />
          </div>

          {/* ── Column form ── */}
          {type === 'column' && (
            <div className="space-y-3">
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400">موقع العمود (م)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">X</label>
                    <NumInput value={colX} onChange={setColX} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">Y</label>
                    <NumInput value={colY} onChange={setColY} />
                  </div>
                </div>
              </div>
              {stories.length > 1 && <StorySelect value={colStory} onChange={setColStory} />}
              <div className="bg-muted/30 rounded-lg p-2.5 text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span>الأبعاد:</span><span className="font-mono">{colB}×{colH} مم</span></div>
                <div className="flex justify-between"><span>الارتفاع:</span><span className="font-mono">{colL} مم</span></div>
              </div>
            </div>
          )}

          {/* ── Beam form ── */}
          {type === 'beam' && (
            <div className="space-y-3">
              <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-semibold text-orange-700 dark:text-orange-400">نقطة البداية I (م)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">X₁</label>
                    <NumInput value={bx1} onChange={setBx1} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">Y₁</label>
                    <NumInput value={by1} onChange={setBy1} />
                  </div>
                </div>
                <h4 className="text-xs font-semibold text-orange-700 dark:text-orange-400 pt-1">نقطة النهاية J (م)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">X₂</label>
                    <NumInput value={bx2} onChange={setBx2} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">Y₂</label>
                    <NumInput value={by2} onChange={setBy2} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-mono">Z — منسوب الجسر (م)</label>
                  <NumInput value={bz} onChange={setBz} placeholder="0 (منسوب الدور)" />
                </div>
              </div>
              {stories.length > 1 && <StorySelect value={bStory} onChange={setBStory} />}
              <div className="bg-muted/30 rounded-lg p-2.5 text-xs space-y-0.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>الطول:</span>
                  <span className="font-mono">
                    {(Math.sqrt((num(bx2) - num(bx1)) ** 2 + (num(by2) - num(by1)) ** 2)).toFixed(3)} م
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>الأبعاد:</span>
                  <span className="font-mono">{beamB}×{beamH} مم</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Slab form ── */}
          {type === 'slab' && (
            <div className="space-y-3">
              {/* Bounding box */}
              <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-semibold text-green-700 dark:text-green-400">الزاوية السفلية اليسرى (م)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">X₁</label>
                    <NumInput value={sx1} onChange={setSx1} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">Y₁</label>
                    <NumInput value={sy1} onChange={setSy1} />
                  </div>
                </div>
                <h4 className="text-xs font-semibold text-green-700 dark:text-green-400 pt-1">الزاوية العلوية اليمنى (م)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">X₂</label>
                    <NumInput value={sx2} onChange={setSx2} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-mono">Y₂</label>
                    <NumInput value={sy2} onChange={setSy2} />
                  </div>
                </div>
                <div className="text-[9px] text-muted-foreground font-mono bg-muted/40 rounded px-2 py-1">
                  المساحة: {Math.abs((num(sx2) - num(sx1)) * (num(sy2) - num(sy1))).toFixed(2)} م²
                </div>
              </div>

              {/* Story */}
              {stories.length > 1 && <StorySelect value={sStory} onChange={setSStory} />}

              {/* Slab type + direction */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">نوع البلاطة</label>
                  <select
                    value={slabType}
                    onChange={e => setSlabType(e.target.value as typeof slabType)}
                    className="w-full h-9 border border-input rounded-md px-2 text-sm bg-background"
                  >
                    <option value="solid">صمّاء Solid</option>
                    <option value="one_way_ribbed">مضلّعة Ribbed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">اتجاه نقل الأحمال</label>
                  <select
                    value={slabDir}
                    onChange={e => setSlabDir(e.target.value as typeof slabDir)}
                    className="w-full h-9 border border-input rounded-md px-2 text-sm bg-background"
                  >
                    <option value="auto">تلقائي (Auto)</option>
                    <option value="one_way_x">باتجاه X</option>
                    <option value="one_way_y">باتجاه Y</option>
                  </select>
                </div>
              </div>

              {/* Irregularity toggle */}
              <button
                type="button"
                onClick={() => {
                  if (!showVertices) { initVerticesFromBBox(); }
                  setShowVertices(v => !v);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  showVertices
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent/30 text-foreground'
                }`}
              >
                <span>🔷 بلاطة غير منتظمة (مضلع)</span>
                <span className="text-xs opacity-70">{showVertices ? 'إيقاف' : 'تفعيل'}</span>
              </button>

              {/* Vertex list */}
              {showVertices && (
                <div className="space-y-2 border border-primary/30 rounded-lg p-3 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground">نقاط المضلع</h4>
                    <span className="text-[10px] text-muted-foreground">{vertices.length} نقطة</span>
                  </div>
                  {vertices.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-5 text-left font-mono">{i + 1}</span>
                      <div className="flex-1 grid grid-cols-2 gap-1">
                        <div className="relative">
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-mono">X</span>
                          <Input
                            type="text" inputMode="decimal"
                            value={v.x}
                            onChange={e => handleVertexChange(i, 'x', e.target.value)}
                            className="h-8 font-mono text-xs pr-6"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-mono">Y</span>
                          <Input
                            type="text" inputMode="decimal"
                            value={v.y}
                            onChange={e => handleVertexChange(i, 'y', e.target.value)}
                            className="h-8 font-mono text-xs pr-6"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveVertex(i)}
                        disabled={vertices.length <= 3}
                        className="text-destructive disabled:opacity-30 text-sm px-1"
                      >✕</button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" onClick={handleAddVertex} className="w-full h-8 text-xs">
                    + إضافة نقطة
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t shrink-0 bg-background">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] flex-1">إلغاء</Button>
          <Button onClick={handleSave} className="min-h-[44px] flex-[2] font-semibold">
            <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            إضافة{type === 'column' ? ' عمود' : type === 'beam' ? ' جسر' : ' بلاطة'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

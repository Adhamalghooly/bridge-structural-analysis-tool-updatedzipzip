import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend,
} from 'recharts';
import { Save, AlertTriangle, CheckCircle, Move } from 'lucide-react';
import { calculateDeflection } from '@/lib/structuralEngine';
import type { Beam, Column, Slab, FrameResult } from '@/lib/structuralEngine';

interface MoveData {
  elementType: 'beam' | 'column' | 'slab' | 'node';
  elementId: string;
  /** relative delta move (metres) */
  dx?: number;
  dy?: number;
  dz?: number;
  /** absolute coordinate override (metres) */
  x1?: number; y1?: number; x2?: number; y2?: number; // beam
  newX?: number; newY?: number;                        // column
}

interface Props {
  open: boolean;
  onClose: () => void;
  elementType: 'beam' | 'column' | 'slab' | 'node';
  elementId: string;
  beams: Beam[];
  columns: Column[];
  slabs: Slab[];
  nodes?: any[];
  frames?: any[];
  areas?: any[];
  frameResults: FrameResult[];
  beamDesigns?: { beamId: string; flexLeft: any; flexMid: any; flexRight: any; deflection?: any }[];
  colDesigns?: { id: string; b: number; h: number; Pu: number; design: any }[];
  onSaveBeamProperties?: (beamId: string, props: { name: string; b: number; h: number }) => void;
  onSaveElementProps?: (data: any) => void;
  onMoveElement?: (data: MoveData) => void;
  onAddBeam?: (beam: Beam) => void;
  onAddColumn?: (col: Column) => void;
  onAddSlab?: (slab: Slab) => void;
  selectedStoryId?: string;
  beamB?: number;
  beamH?: number;
  colB?: number;
  colH?: number;
  isModeling?: boolean;
}

// ── tiny numeric field that allows typing decimal/negative without resetting ──
function NumInput({
  label, value, onChange, step = 0.01, unit = 'م', placeholder = '0',
}: {
  label: string; value: string; onChange: (v: string) => void;
  step?: number; unit?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 min-h-[36px] text-center font-mono text-sm"
        />
        <span className="text-xs text-muted-foreground shrink-0">{unit}</span>
      </div>
    </div>
  );
}

export default function ElementMomentChartModal({
  open, onClose, elementType, elementId,
  beams, columns, slabs, nodes, frames, areas, frameResults, beamDesigns, colDesigns,
  onSaveBeamProperties, onSaveElementProps, onMoveElement,
  onAddBeam, onAddColumn, onAddSlab,
  selectedStoryId, beamB, beamH, colB: initialColB, colH: initialColH,
  isModeling,
}: Props) {

  const [activeTab, setActiveTab] = useState<string>('moment');

  // ── create element state ──
  const [newType, setNewType] = useState<'beam' | 'column' | 'slab'>('beam');
  const [newX1, setNewX1] = useState('0');
  const [newY1, setNewY1] = useState('0');
  const [newX2, setNewX2] = useState('5');
  const [newY2, setNewY2] = useState('0');
  const [newColX, setNewColX] = useState('0');
  const [newColY, setNewColY] = useState('0');
  const [newCreated, setNewCreated] = useState(false);

  // ── node properties edit state ──
  const [nodeRestraints, setNodeRestraints] = useState({ ux: false, uy: false, uz: false, rx: false, ry: false, rz: false });

  // ── node memo ──
  const currentNode = useMemo(() => {
    if (elementType !== 'node') return null;
    return nodes?.find(n => String(n.id) === elementId) ?? null;
  }, [elementType, elementId, nodes]);

  // ── beam section edit ──
  const currentBeam = useMemo(() => {
    if (elementType !== 'beam') return null;
    // Split-beam IDs look like "B5-0", "B5-1" — try exact match first, then parent
    const exact = beams.find(b => b.id === elementId);
    if (exact) return exact;
    const parentId = elementId.includes('-') ? elementId.slice(0, elementId.lastIndexOf('-')) : null;
    return parentId ? (beams.find(b => b.id === parentId) ?? null) : null;
  }, [elementType, elementId, beams]);

  // ── column properties edit state ──
  const currentColumn = useMemo(() =>
    elementType === 'column' ? columns.find(c => c.id === elementId) ?? null : null,
  [elementType, elementId, columns]);

  const [colB, setColB] = useState('300');
  const [colH, setColH] = useState('600');
  const [orientAngle, setOrientAngle] = useState(0);
  const [applyToUpperFloors, setApplyToUpperFloors] = useState(false);

  // ── slab properties edit state ──
  const currentSlab = useMemo(() =>
    elementType === 'slab' ? slabs.find(s => s.id === elementId) ?? null : null,
  [elementType, elementId, slabs]);

  const [slabThickness, setSlabThickness] = useState('150');
  const [slabCover, setSlabCover] = useState('25');
  const [slabFinish, setSlabFinish] = useState('1.5');
  const [slabLive, setSlabLive] = useState('2');

  const [editName, setEditName] = useState('');
  const [editB, setEditB]       = useState('');
  const [editH, setEditH]       = useState('');
  const [isSaved, setIsSaved]   = useState(false);

  // ── move tab state ──
  const [moveDX, setMoveDX] = useState('0');
  const [moveDY, setMoveDY] = useState('0');
  const [moveDZ, setMoveDZ] = useState('0');
  const [moveX1, setMoveX1] = useState('');
  const [moveY1, setMoveY1] = useState('');
  const [moveX2, setMoveX2] = useState('');
  const [moveY2, setMoveY2] = useState('');
  const [moveColX, setMoveColX] = useState('');
  const [moveColY, setMoveColY] = useState('');
  const [moveSaved, setMoveSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (elementId === 'new') {
      setActiveTab('move');
    } else if (isModeling || elementType === 'node') {
      setActiveTab('properties');
    } else {
      setActiveTab('moment');
    }
    setMoveDX('0'); setMoveDY('0'); setMoveDZ('0');
    setMoveSaved(false);

    if (elementType === 'node' && currentNode) {
      setNodeRestraints({
        ux: !!currentNode.restraints?.ux,
        uy: !!currentNode.restraints?.uy,
        uz: !!currentNode.restraints?.uz,
        rx: !!currentNode.restraints?.rx,
        ry: !!currentNode.restraints?.ry,
        rz: !!currentNode.restraints?.rz,
      });
    }

    if (currentBeam) {
      setEditName(currentBeam.name ?? currentBeam.id);
      setEditB(String(currentBeam.b));
      setEditH(String(currentBeam.h));
      setMoveX1(String(currentBeam.x1));
      setMoveY1(String(currentBeam.y1));
      setMoveX2(String(currentBeam.x2));
      setMoveY2(String(currentBeam.y2));
      setIsSaved(false);
    }
    if (currentColumn) {
      setColB(String(currentColumn.b));
      setColH(String(currentColumn.h));
      setOrientAngle(currentColumn.orientAngle ?? 0);
      setApplyToUpperFloors(false);
      setMoveColX(String(currentColumn.x));
      setMoveColY(String(currentColumn.y));
    }
    if (currentSlab) {
      setSlabThickness(String(currentSlab.thickness ?? 150));
      setSlabCover(String(currentSlab.cover ?? 25));
      setSlabFinish(String((currentSlab as any).finishLoad ?? 1.5));
      setSlabLive(String((currentSlab as any).liveLoad ?? 2.0));
    }
  }, [open, elementId, currentBeam, currentColumn, currentSlab, currentNode, isModeling, elementType]);

  const handleSave = () => {
    if (onSaveBeamProperties && currentBeam) {
      onSaveBeamProperties(currentBeam.id, {
        name: editName.trim() || currentBeam.id,
        b: Number(editB) || currentBeam.b,
        h: Number(editH) || currentBeam.h,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 1500);
    }
  };

  const flashMoveSaved = () => {
    setMoveSaved(true);
    setTimeout(() => setMoveSaved(false), 1500);
  };

  const handleCreateElement = () => {
    const ts = Date.now();
    const storyId = selectedStoryId || currentBeam?.storyId || currentColumn?.storyId || 'ST1';

    if (newType === 'column') {
      const cx = parseFloat(newColX) || 0;
      const cy = parseFloat(newColY) || 0;
      onAddColumn?.({
        id: `EC${ts}`,
        x: cx, y: cy,
        b: Number(colB) || 300, h: Number(colH) || 600, L: 3000,
        storyId: storyId,
      });
    } else if (newType === 'beam') {
      const x1 = parseFloat(newX1) || 0;
      const y1 = parseFloat(newY1) || 0;
      const x2 = parseFloat(newX2) || 5;
      const y2 = parseFloat(newY2) || 0;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      onAddBeam?.({
        id: `EB${ts}`,
        fromCol: '', toCol: '',
        x1, y1, x2, y2,
        length: len,
        direction: Math.abs(x2 - x1) >= Math.abs(y2 - y1) ? 'horizontal' : 'vertical',
        b: beamB ?? 200, h: beamH ?? 400,
        deadLoad: 0, liveLoad: 0,
        slabs: [],
        storyId: storyId,
      } as Beam);
    } else {
      const x1 = parseFloat(newX1) || 0;
      const y1 = parseFloat(newY1) || 0;
      const x2 = parseFloat(newX2) || 5;
      const y2 = parseFloat(newY2) || 4;
      onAddSlab?.({
        id: `S${ts}`,
        x1, y1, x2, y2,
        storyId: storyId,
        slabType: 'solid',
        direction: 'auto',
      });
    }
    setNewCreated(true);
    setTimeout(() => {
      setNewCreated(false);
      if (elementId === 'new') {
        onClose();
      }
    }, 1500);
  };

  const handleSaveProperties = () => {
    if (!onSaveElementProps) return;
    
    if (elementType === 'node' && currentNode) {
      onSaveElementProps({
        nodeId: currentNode.id,
        restraints: nodeRestraints,
      });
      setIsSaved(true);
      setTimeout(() => { setIsSaved(false); onClose(); }, 1000);
    } else if (elementType === 'beam' && currentBeam) {
      // Find matching frame element to get frame ID if needed
      const frameObj = frames?.find(f => {
        if (f.type !== 'beam') return false;
        const ni = nodes?.find(n => n.id === f.nodeI);
        const nj = nodes?.find(n => n.id === f.nodeJ);
        if (!ni || !nj) return false;
        return (
          (Math.abs(ni.x - currentBeam.x1) < 0.01 && Math.abs(ni.y - currentBeam.y1) < 0.01 &&
           Math.abs(nj.x - currentBeam.x2) < 0.01 && Math.abs(nj.y - currentBeam.y2) < 0.01) ||
          (Math.abs(ni.x - currentBeam.x2) < 0.01 && Math.abs(ni.y - currentBeam.y2) < 0.01 &&
           Math.abs(nj.x - currentBeam.x1) < 0.01 && Math.abs(nj.y - currentBeam.y1) < 0.01)
        );
      });
      
      const fId = frameObj?.id;
      if (fId != null) {
        onSaveElementProps({
          frameId: fId,
          b: Number(editB) || currentBeam.b,
          h: Number(editH) || currentBeam.h,
        });
        setIsSaved(true);
        setTimeout(() => { setIsSaved(false); onClose(); }, 1000);
      } else {
        onSaveBeamProperties?.(currentBeam.id, {
          name: editName.trim() || currentBeam.id,
          b: Number(editB) || currentBeam.b,
          h: Number(editH) || currentBeam.h,
        });
        setIsSaved(true);
        setTimeout(() => { setIsSaved(false); onClose(); }, 1000);
      }
    } else if (elementType === 'column' && currentColumn) {
      const frameObj = frames?.find(f => {
        if (f.type !== 'column') return false;
        const nj = nodes?.find(n => n.id === f.nodeJ);
        return nj && Math.abs(nj.x - currentColumn.x) < 0.01 && Math.abs(nj.y - currentColumn.y) < 0.01;
      });
      const fId = frameObj?.id;
      if (fId != null) {
        onSaveElementProps({
          frameId: fId,
          b: Number(colB) || currentColumn.b,
          h: Number(colH) || currentColumn.h,
          orientAngle,
          applyToUpperFloors,
        });
        setIsSaved(true);
        setTimeout(() => { setIsSaved(false); onClose(); }, 1000);
      }
    } else if (elementType === 'slab' && currentSlab) {
      onSaveElementProps({
        areaId: currentSlab.id,
        thickness: Number(slabThickness) || 150,
        cover: Number(slabCover) || 25,
        finishLoad: Number(slabFinish) || 1.5,
        liveLoad: Number(slabLive) || 2.0,
      });
      setIsSaved(true);
      setTimeout(() => { setIsSaved(false); onClose(); }, 1000);
    }
  };

  const handleDeltaMove = () => {
    const dx = parseFloat(moveDX) || 0;
    const dy = parseFloat(moveDY) || 0;
    const dz = parseFloat(moveDZ) || 0;
    if (dx === 0 && dy === 0 && dz === 0) return;
    
    if (elementType === 'node' && currentNode) {
      onSaveElementProps?.({
        nodeId: currentNode.id,
        moveX: dx,
        moveY: dy,
        moveZ: dz,
      });
    } else {
      onMoveElement?.({ elementType, elementId, dx, dy, dz });
    }
    // update displayed absolute coords for beams
    if (currentBeam) {
      setMoveX1(String(+(currentBeam.x1 + dx).toFixed(4)));
      setMoveY1(String(+(currentBeam.y1 + dy).toFixed(4)));
      setMoveX2(String(+(currentBeam.x2 + dx).toFixed(4)));
      setMoveY2(String(+(currentBeam.y2 + dy).toFixed(4)));
    }
    if (currentColumn) {
      setMoveColX(String(+(currentColumn.x + dx).toFixed(4)));
      setMoveColY(String(+(currentColumn.y + dy).toFixed(4)));
    }
    setMoveDX('0'); setMoveDY('0'); setMoveDZ('0');
    flashMoveSaved();
  };

  const handleAbsoluteMove = () => {
    if (elementType === 'beam') {
      const x1 = parseFloat(moveX1), y1 = parseFloat(moveY1);
      const x2 = parseFloat(moveX2), y2 = parseFloat(moveY2);
      if ([x1, y1, x2, y2].some(isNaN)) return;
      onMoveElement?.({ elementType, elementId, x1, y1, x2, y2 });
    } else if (elementType === 'column') {
      const newX = parseFloat(moveColX), newY = parseFloat(moveColY);
      if ([newX, newY].some(isNaN)) return;
      onMoveElement?.({ elementType, elementId, newX, newY });
    }
    flashMoveSaved();
  };

  // ── chart data ──
  const data = useMemo(() => {
    if (elementId === 'new') {
      return {
        title: 'إنشاء عنصر جديد بالإحداثيات',
        subtitle: 'أدخل نوع العنصر وإحداثياته لإنشائه في الدور الحالي',
        xLabel: 'موقع العنصر',
        Vu: 0,
        points: []
      };
    }

    if (elementType === 'node') {
      const node = nodes?.find(n => String(n.id) === elementId);
      if (!node) return null;
      return {
        title: `العقدة N${elementId}`,
        subtitle: `الموقع: X = ${node.x.toFixed(2)} م · Y = ${node.y.toFixed(2)} م · Z = ${node.z.toFixed(2)} م`,
        xLabel: 'موقع العقدة',
        Vu: 0,
        points: []
      };
    }

    if (elementType === 'beam') {
      const beam = beams.find(b => b.id === elementId);
      if (!beam) return null;
      const L = beam.length;
      let Mleft = 0, Mmid = 0, Mright = 0, Vu = 0;
      let stations: number[] | undefined;
      
      const hasAnalysis = frameResults && frameResults.length > 0;
      if (hasAnalysis) {
        for (const fr of frameResults) {
          const br = fr.beams.find(bb => bb.beamId === elementId);
          if (br) {
            Mleft = br.Mleft;
            Mmid = br.Mmid;
            Mright = br.Mright;
            Vu = (br as any).Vu ?? 0;
            stations = br.momentStations;
            break;
          }
        }
      }
      
      const points = (() => {
        if (!hasAnalysis) return [];
        if (stations && stations.length >= 2) {
          return stations.map((val, i) => {
            const t = i / (stations!.length - 1);
            return { x: +(t * L).toFixed(3), M: +val.toFixed(2) };
          });
        } else {
          const a = Mleft, b2 = -3 * Mleft + 4 * Mmid - Mright, c = 2 * Mleft - 4 * Mmid + 2 * Mright;
          const N = 41;
          return Array.from({ length: N }, (_, i) => {
            const t = i / (N - 1);
            return { x: +(t * L).toFixed(3), M: +(a + b2 * t + c * t * t).toFixed(2) };
          });
        }
      })();

      const name = beam.name ?? beam.id;
      return {
        title: `الجسر ${name}`,
        subtitle: hasAnalysis 
          ? `الطول = ${L.toFixed(2)} م · M⁻ يسار = ${Mleft.toFixed(1)} · M⁺ منتصف = ${Mmid.toFixed(1)} · M⁻ يمين = ${Mright.toFixed(1)} (kN·m)`
          : `الطول = ${L.toFixed(2)} م (لم يتم تشغيل التحليل بعد)`,
        xLabel: 'المسافة x (م)',
        Vu,
        points
      };
    }

    if (elementType === 'column') {
      const col = columns.find(c => c.id === elementId);
      if (!col) return null;
      
      const colD = colDesigns?.find(c => c.id === elementId);
      const Pu = colD?.Pu ?? 0;
      const Mtop = (colD?.design && (colD.design.Mtop ?? colD.design.M ?? 0)) || 0;
      const Mbot = (colD?.design && (colD.design.Mbot ?? -Mtop)) || 0;
      const H = ((col.L ?? (col as any).length ?? 3000) as number) / 1000;
      
      const hasAnalysis = colDesigns && colDesigns.length > 0;
      const points = (() => {
        if (!hasAnalysis) return [];
        const N = 21;
        return Array.from({ length: N }, (_, i) => {
          const t = i / (N - 1);
          return { x: +(t * H).toFixed(3), M: +(Mbot + (Mtop - Mbot) * t).toFixed(2) };
        });
      })();

      return {
        title: `العمود ${elementId}`,
        subtitle: hasAnalysis
          ? `H = ${H.toFixed(2)} م · Pu = ${Pu.toFixed(0)} kN · Mأعلى = ${Mtop.toFixed(1)} · Mأسفل = ${Mbot.toFixed(1)} (kN·m)`
          : `الارتفاع = ${H.toFixed(2)} م (لم يتم تشغيل التحليل بعد)`,
        xLabel: 'الارتفاع z (م)',
        Vu: 0,
        points
      };
    }

    if (elementType === 'slab') {
      const slab = slabs.find(s => s.id === elementId);
      if (!slab) return null;
      const Lx = Math.abs(slab.x2 - slab.x1), Ly = Math.abs(slab.y2 - slab.y1);
      const L = Math.min(Lx, Ly);
      const w = ((slab as any).load ?? (slab as any).w ?? 6);
      const Mmax = w * L * L / 8;
      
      const hasAnalysis = frameResults && frameResults.length > 0;
      const points = (() => {
        if (!hasAnalysis) return [];
        const N = 31;
        return Array.from({ length: N }, (_, i) => {
          const t = i / (N - 1);
          return { x: +(t * L).toFixed(3), M: +(4 * Mmax * t * (1 - t)).toFixed(2) };
        });
      })();

      return {
        title: `البلاطة ${elementId}`,
        subtitle: `Lx=${Lx.toFixed(2)}م · Ly=${Ly.toFixed(2)}م · الحمل w≈${w.toFixed(1)} kN/m²` + (hasAnalysis ? ` · Mmax≈${Mmax.toFixed(2)} kN·m/m` : ''),
        xLabel: 'المسافة (م)',
        Vu: 0,
        points
      };
    }
    return null;
  }, [elementType, elementId, beams, columns, slabs, nodes, frameResults, colDesigns]);

  // ── deflection data (beams only) ──
  const parentId = elementId.includes('-') ? elementId.split('-')[0] : elementId;
  const design = beamDesigns?.find(d => d.beamId === elementId || d.beamId === parentId);
  const allowableDeflection = design?.deflection?.allowableDeflection ?? (currentBeam ? (currentBeam.length * 1000) / 240 : 1);
  const actualMaxDeflection = design?.deflection?.deflection ?? 0;
  const isDeflectionExceeded = design?.deflection ? !design.deflection.isServiceable : false;

  const deflectionData = useMemo(() => {
    if (elementType !== 'beam' || !currentBeam) return [];
    const dMax = design?.deflection?.deflection ?? 0;
    const L = currentBeam.length;
    const N = 41;
    return Array.from({ length: N }, (_, i) => {
      const t = i / (N - 1);
      return { x: +(t * L).toFixed(3), deflection: +(dMax * 4 * t * (1 - t)).toFixed(4) };
    });
  }, [elementType, elementId, currentBeam, design]);

  const calculatedSuggestedH = useMemo(() => {
    if (!currentBeam || !design) return 0;
    const bw = currentBeam.b, wD = currentBeam.deadLoad || 0, wL = currentBeam.liveLoad || 0;
    const span = currentBeam.length / 1000;
    const testAs = design.flexMid?.As || 0;
    for (let hTry = Math.ceil((currentBeam.h + 50) / 50) * 50; hTry <= 2500; hTry += 50) {
      const testDefl = calculateDeflection(span, bw, hTry, 25, wD, wL, testAs, 'both-ends', 'B', testAs * 0.3, 1.0, 60);
      if (testDefl.deflection <= allowableDeflection || testDefl.isServiceable) return hTry;
    }
    return Math.max(currentBeam.h + 50, Math.ceil((currentBeam.h * Math.pow(actualMaxDeflection / allowableDeflection, 0.33)) / 50) * 50);
  }, [currentBeam, design, allowableDeflection, actualMaxDeflection]);

  const suggestedH = isDeflectionExceeded ? calculatedSuggestedH : currentBeam?.h ?? 0;

  // ── determine tabs for this element type ──
  const tabs = useMemo(() => {
    if (elementId === 'new') {
      return [
        { value: 'move', label: '✨ إنشاء عنصر بالإحداثيات' }
      ];
    }

    if (elementType === 'node') {
      return [
        { value: 'properties', label: 'تحديد الركيزة' },
        { value: 'move',       label: '📍 نقل العقدة' },
      ];
    }

    if (isModeling) {
      return [
        { value: 'properties', label: 'تعديل الأبعاد والخصائص' },
        { value: 'move',       label: '📍 نقل العنصر' },
      ];
    }

    if (elementType === 'beam') return [
      { value: 'moment',     label: 'المخطط الإنشائي' },
      { value: 'deflection', label: 'مخطط الترخيم' },
      { value: 'properties', label: 'تعديل الأبعاد' },
      { value: 'move',       label: '📍 نقل العنصر' },
    ];
    
    // column / slab (view mode)
    return [
      { value: 'moment',     label: 'مخطط العزم' },
      { value: 'properties', label: 'تعديل الأبعاد والخصائص' },
      { value: 'move',       label: '📍 نقل العنصر' },
    ];
  }, [elementType, isModeling]);

  if (!data) return null;

  const Mmax = Math.max(...data.points.map(p => Math.abs(p.M)), 0.001);

  // ── shared moment chart ──
  const MomentChart = (
    <div className="w-full h-[240px] bg-card border border-border rounded-lg p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data.points} margin={{ top: 10, right: 14, left: 6, bottom: 18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 9 }}
            label={{ value: data.xLabel, position: 'insideBottom', offset: -5, fontSize: 9 }} />
          <YAxis tick={{ fontSize: 9 }} domain={[-Mmax * 1.1, Mmax * 1.1]}
            label={{ value: 'M (kN·m)', angle: -90, position: 'insideLeft', fontSize: 9, offset: 0 }} />
          <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
            formatter={(v: number) => [`${v.toFixed(2)} kN·m`, 'العزم M']}
            labelFormatter={(x: number) => `x = ${Number(x).toFixed(2)} م`} />
          <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
          <Legend wrapperStyle={{ fontSize: 9 }} />
          <Area type="monotone" dataKey="M" fill="hsl(var(--primary) / 0.12)" stroke="none" name="مساحة مخطط العزوم" />
          <Line type="monotone" dataKey="M" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="العزم M(x)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  // ── move tab content ──
  const MoveTab = (
    <div className="space-y-4">
      {/* Delta move */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
        <div className="font-bold text-sm flex items-center gap-2">
          <Move size={15} /> نقل العنصر بمقدار (نسبي)
        </div>
        <div className={`grid gap-3 ${elementType === 'beam' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <NumInput label="ΔX (م)" value={moveDX} onChange={setMoveDX} />
          <NumInput label="ΔY (م)" value={moveDY} onChange={setMoveDY} />
          {elementType === 'beam' && <NumInput label="ΔZ (م)" value={moveDZ} onChange={setMoveDZ} />}
        </div>
        <Button
          onClick={handleDeltaMove}
          size="sm"
          className={`gap-1.5 font-bold text-xs transition-all duration-300 ${moveSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
          disabled={!onMoveElement}
        >
          {moveSaved ? <><CheckCircle size={13} /> تم النقل</> : <><Move size={13} /> تطبيق النقل</>}
        </Button>
      </div>

      {/* Absolute coordinates */}
      {elementType === 'beam' && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="font-bold text-sm">تعديل إحداثيات الأطراف مباشرة (م)</div>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="X₁ (طرف أول)" value={moveX1} onChange={setMoveX1} />
            <NumInput label="Y₁ (طرف أول)" value={moveY1} onChange={setMoveY1} />
            <NumInput label="X₂ (طرف ثانٍ)" value={moveX2} onChange={setMoveX2} />
            <NumInput label="Y₂ (طرف ثانٍ)" value={moveY2} onChange={setMoveY2} />
          </div>
          <Button
            onClick={handleAbsoluteMove}
            size="sm"
            variant="secondary"
            className={`gap-1.5 font-bold text-xs transition-all duration-300 ${moveSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
            disabled={!onMoveElement}
          >
            {moveSaved ? <><CheckCircle size={13} /> تم الحفظ</> : <><Save size={13} /> تطبيق الإحداثيات</>}
          </Button>
        </div>
      )}

      {elementType === 'column' && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="font-bold text-sm">تعديل موقع العمود مباشرة (م)</div>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="X (م)" value={moveColX} onChange={setMoveColX} />
            <NumInput label="Y (م)" value={moveColY} onChange={setMoveColY} />
          </div>
          <Button
            onClick={handleAbsoluteMove}
            size="sm"
            variant="secondary"
            className={`gap-1.5 font-bold text-xs transition-all duration-300 ${moveSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
            disabled={!onMoveElement}
          >
            {moveSaved ? <><CheckCircle size={13} /> تم الحفظ</> : <><Save size={13} /> تطبيق الإحداثيات</>}
          </Button>
        </div>
      )}

      {elementType === 'slab' && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
          * نقل البلاطة بمقدار ΔX وΔY يحرّك جميع أطرافها الأربعة بالمقدار نفسه.
        </p>
      )}

      {/* Create New Element */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
        <div className="font-bold text-sm flex items-center gap-2 text-primary">
          ✨ إنشاء عنصر جديد أو جسر جديد بالإحداثيات
        </div>
        <div className="flex gap-2">
          {(['beam', 'column', 'slab'] as const).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setNewType(t)}
              className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                newType === t
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:bg-accent/50 text-muted-foreground'
              }`}
            >
              {t === 'beam' ? 'جسر 🟫' : t === 'column' ? 'عمود 🟦' : 'بلاطة ⬜'}
            </button>
          ))}
        </div>

        {newType === 'column' ? (
          <div className="grid grid-cols-2 gap-3 bg-background/60 p-3 rounded-lg border border-border/60">
            <NumInput label="X (م)" value={newColX} onChange={setNewColX} />
            <NumInput label="Y (م)" value={newColY} onChange={setNewColY} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 bg-background/60 p-3 rounded-lg border border-border/60">
            <NumInput label="X₁ (البداية)" value={newX1} onChange={setNewX1} />
            <NumInput label="Y₁ (البداية)" value={newY1} onChange={setNewY1} />
            <NumInput label="X₂ (النهاية)" value={newX2} onChange={setNewX2} />
            <NumInput label="Y₂ (النهاية)" value={newY2} onChange={setNewY2} />
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            * يُضاف العنصر إلى الدور الحالي تلقائياً.
          </span>
          <Button
            type="button"
            onClick={handleCreateElement}
            size="sm"
            className={`gap-1.5 font-bold text-xs transition-all duration-300 ${
              newCreated ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-primary'
            }`}
          >
            {newCreated ? <><CheckCircle size={13} /> تم الإنشاء</> : <><Save size={13} /> إنشاء العنصر</>}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-3xl w-[95vw] flex flex-col"
        style={{ height: 'min(90dvh, 700px)' }}
        dir="rtl"
        onPointerDownOutside={onClose}
        onInteractOutside={onClose}
      >
        <DialogHeader className="space-y-0.5 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center justify-between">
            <span>{data.title}</span>
            {isDeflectionExceeded && elementType === 'beam' && (
              <Badge variant="destructive" className="animate-pulse gap-1 text-[11px] px-2 py-0.5 font-bold">
                <AlertTriangle size={12} /> الترخيم زائد!
              </Badge>
            )}
          </DialogTitle>
          <p className="text-xs text-muted-foreground leading-snug">{data.subtitle}</p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 mt-2">
          {/* Tab bar */}
          <div className="shrink-0 pb-2">
            <TabsList className={`grid w-full ${tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
              {tabs.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-[11px] sm:text-xs px-1">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 min-h-0 overflow-y-auto">

            {/* ── Moment chart (all types) ── */}
            <TabsContent value="moment" className="mt-0 space-y-3">
              {MomentChart}
              <div className="text-[10px] text-muted-foreground bg-muted/40 rounded p-2.5 leading-relaxed space-y-0.5">
                <div>• القيم الموجبة = <b>عزم موجب M⁺</b> (شد سفلي).</div>
                <div>• القيم السالبة = <b>عزم سالب M⁻</b> (شد علوي).</div>
              </div>
            </TabsContent>

            {/* ── Deflection (beam only) ── */}
            <TabsContent value="deflection" className="mt-0 space-y-3">
              <div className="w-full h-[240px] bg-card border border-border rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={deflectionData} margin={{ top: 10, right: 14, left: 6, bottom: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 9 }}
                      label={{ value: 'المسافة x (م)', position: 'insideBottom', offset: -5, fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }}
                      domain={[0, Math.max(allowableDeflection, actualMaxDeflection) * 1.25]}
                      reversed
                      label={{ value: 'الترخيم δ (مم)', angle: -90, position: 'insideLeft', fontSize: 9, offset: 0 }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', fontSize: 11 }}
                      formatter={(v: number) => [`${v.toFixed(2)} mm`, 'الترخيم δ']}
                      labelFormatter={(x: number) => `x = ${Number(x).toFixed(2)} م`} />
                    <ReferenceLine y={allowableDeflection} stroke="rgb(239,68,68)" strokeDasharray="4 4" strokeWidth={1.5}
                      label={{ value: `الحد (${allowableDeflection.toFixed(1)} مم)`, fill: 'rgb(239,68,68)', fontSize: 8, position: 'insideBottomRight' }} />
                    <Line type="monotone" dataKey="deflection" stroke="rgb(249,115,22)" strokeWidth={2.5} dot={false} name="الترخيم الفعلي δ(x)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="text-[11px] bg-muted/40 rounded-lg p-3 space-y-1">
                  <div className="font-semibold">سلوك الترخيم</div>
                  <div>• الأقصى المحسوب: <span className="font-mono font-bold text-orange-500">{actualMaxDeflection.toFixed(2)} مم</span></div>
                  <div>• المسموح (L/240): <span className="font-mono font-bold">{allowableDeflection.toFixed(2)} مم</span></div>
                  <div>• الحالة: <span className={`font-semibold ${isDeflectionExceeded ? 'text-destructive' : 'text-emerald-600'}`}>
                    {isDeflectionExceeded ? 'مرفوض!' : 'آمن ومحقق'}
                  </span></div>
                </div>
                {isDeflectionExceeded && (
                  <div className="text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 rounded-lg p-3 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-600"><AlertTriangle size={13} /> اقتراح:</div>
                    <p className="leading-relaxed">زِد ارتفاع الجسر h إلى لا يقل عن <span className="font-mono font-bold text-amber-600 text-base">{suggestedH} مم</span></p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Properties (all types) ── */}
            <TabsContent value="properties" className="mt-0">
              {elementType === 'node' && currentNode && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                    <h4 className="text-sm font-bold">تحديد ركيزة العقدة (Support / Restraints)</h4>
                    
                    {/* Support Preset buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Fixed */}
                      <button type="button"
                        onClick={() => setNodeRestraints({ ux: true, uy: true, uz: true, rx: true, ry: true, rz: true })}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold transition-all ${
                          nodeRestraints.ux && nodeRestraints.uy && nodeRestraints.uz && nodeRestraints.rx && nodeRestraints.ry && nodeRestraints.rz
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]'
                            : 'border-border bg-background hover:bg-accent/30 text-foreground'
                        }`}>
                        <span className="text-sm">🔒 وثاقة (Fixed)</span>
                        <span className="text-[9px] opacity-75 font-mono">جميع درجات الحركة مقيدة</span>
                      </button>
                      {/* Pin */}
                      <button type="button"
                        onClick={() => setNodeRestraints({ ux: true, uy: true, uz: true, rx: false, ry: false, rz: false })}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold transition-all ${
                          nodeRestraints.ux && nodeRestraints.uy && nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]'
                            : 'border-border bg-background hover:bg-accent/30 text-foreground'
                        }`}>
                        <span className="text-sm">📌 تمفصل (Pinned)</span>
                        <span className="text-[9px] opacity-75 font-mono">مقيد إزاحة فقط (دوران حر)</span>
                      </button>
                      {/* Roller Z */}
                      <button type="button"
                        onClick={() => setNodeRestraints({ ux: false, uy: false, uz: true, rx: false, ry: false, rz: false })}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold transition-all ${
                          !nodeRestraints.ux && !nodeRestraints.uy && nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02]'
                            : 'border-border bg-background hover:bg-accent/30 text-foreground'
                        }`}>
                        <span className="text-sm">🛞 منزلقة (Roller Z)</span>
                        <span className="text-[9px] opacity-75 font-mono">مقيَّد شاقولياً فقط UZ</span>
                      </button>
                      {/* Free */}
                      <button type="button"
                        onClick={() => setNodeRestraints({ ux: false, uy: false, uz: false, rx: false, ry: false, rz: false })}
                        className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg border text-xs font-semibold transition-all ${
                          Object.values(nodeRestraints).every(v => !v)
                            ? 'bg-muted text-muted-foreground border-border shadow-sm scale-[1.02]'
                            : 'border-border bg-background hover:bg-accent/30 text-foreground'
                        }`}>
                        <span className="text-sm">🌐 حرة (Free/None)</span>
                        <span className="text-[9px] opacity-75 font-mono">لا توجد قيود أو ركائز</span>
                      </button>
                    </div>

                    {/* Detailed DOF switches */}
                    <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">درجات الحرية التفصيلية:</span>
                        <span className="text-[9px] text-muted-foreground font-semibold">مفعّل = مقيد الحركة</span>
                      </div>
                      
                      <div className="grid grid-cols-6 gap-1 bg-muted/40 rounded-lg p-1">
                        {([
                          { key: 'ux', label: 'UX', color: 'text-red-500' },
                          { key: 'uy', label: 'UY', color: 'text-green-500' },
                          { key: 'uz', label: 'UZ', color: 'text-blue-500' },
                          { key: 'rx', label: 'RX', color: 'text-red-400' },
                          { key: 'ry', label: 'RY', color: 'text-green-400' },
                          { key: 'rz', label: 'RZ', color: 'text-blue-400' },
                        ] as const).map(({ key, label, color }) => (
                          <button
                            type="button"
                            key={`pop-prop-sup-${key}`}
                            onClick={() => setNodeRestraints(prev => ({ ...prev, [key]: !prev[key] }))}
                            className={`flex flex-col items-center justify-center py-1.5 rounded-md border text-[10px] font-bold font-mono transition-all ${
                              nodeRestraints[key]
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-105'
                                : 'border-border bg-background hover:bg-accent/20 text-muted-foreground'
                            }`}
                          >
                            <span className={nodeRestraints[key] ? 'text-primary-foreground' : color}>{label}</span>
                            <span className="text-[7px] font-normal scale-90 mt-0.5">{nodeRestraints[key] ? 'مقيد' : 'حر'}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[10px] text-muted-foreground max-w-xs">* حفظ الركيزة يعيد بناء نموذج التحليل تلقائياً.</p>
                      <Button onClick={handleSaveProperties} size="sm"
                        className={`gap-1.5 font-bold text-xs transition-all duration-300 ${isSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}>
                        {isSaved ? <><CheckCircle size={14} /> تم الحفظ</> : <><Save size={14} /> حفظ الركيزة</>}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {elementType === 'beam' && currentBeam && (
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                  <div className="font-bold text-sm">تعديل اسم وأبعاد الجسر</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">اسم الجسر</label>
                      <Input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="G1" className="h-9 min-h-[36px]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">عرض b (مم)</label>
                      <Input type="number" value={editB} onChange={(e) => setEditB(e.target.value)} placeholder="200" className="h-9 min-h-[36px]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">ارتفاع h (مم)</label>
                      <Input type="number" value={editH} onChange={(e) => setEditH(e.target.value)} placeholder="400" className="h-9 min-h-[36px]" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-muted-foreground max-w-xs">* يعيد التحليل فور الحفظ.</p>
                    <Button onClick={handleSaveProperties} size="sm"
                      className={`gap-1.5 font-bold text-xs transition-all duration-300 ${isSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      disabled={!editB || !editH}>
                      {isSaved ? <><CheckCircle size={14} /> تم الحفظ</> : <><Save size={14} /> حفظ</>}
                    </Button>
                  </div>
                </div>
              )}

              {elementType === 'column' && currentColumn && (
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                  <div className="font-bold text-sm">تعديل أبعاد وزاوية العمود</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">عرض b (مم)</label>
                      <Input type="number" value={colB} onChange={(e) => setColB(e.target.value)} placeholder="300" className="h-9 min-h-[36px]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">ارتفاع h (مم)</label>
                      <Input type="number" value={colH} onChange={(e) => setColH(e.target.value)} placeholder="600" className="h-9 min-h-[36px]" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOrientAngle(angle => angle === 0 ? 90 : 0)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        orientAngle === 90
                          ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                          : 'border-border hover:bg-accent/30'
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                      </svg>
                      {orientAngle === 90 ? 'مدوَّر 90° — اضغط للإلغاء' : 'تدوير العمود 90°'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Checkbox
                      id="pop-apply-upper-floors"
                      checked={applyToUpperFloors}
                      onCheckedChange={v => setApplyToUpperFloors(!!v)}
                    />
                    <label htmlFor="pop-apply-upper-floors" className="text-xs cursor-pointer leading-tight">
                      تطبيق الأبعاد على الأعمدة في نفس الموقع (الأدوار العلوية)
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-muted-foreground max-w-xs">* يعيد التحليل فور الحفظ.</p>
                    <Button onClick={handleSaveProperties} size="sm"
                      className={`gap-1.5 font-bold text-xs transition-all duration-300 ${isSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      disabled={!colB || !colH}>
                      {isSaved ? <><CheckCircle size={14} /> تم الحفظ</> : <><Save size={14} /> حفظ</>}
                    </Button>
                  </div>
                </div>
              )}

              {elementType === 'slab' && currentSlab && (
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                  <div className="font-bold text-sm">تعديل خصائص وأحمال البلاطة</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">السماكة (مم)</label>
                      <Input type="number" value={slabThickness} onChange={(e) => setSlabThickness(e.target.value)} placeholder="150" className="h-9 min-h-[36px]" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">الغطاء الخرساني (مم)</label>
                      <Input type="number" value={slabCover} onChange={(e) => setSlabCover(e.target.value)} placeholder="25" className="h-9 min-h-[36px]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">أحمال التشطيب (kN/m²)</label>
                      <Input type="number" value={slabFinish} onChange={(e) => setSlabFinish(e.target.value)} placeholder="1.5" className="h-9 min-h-[36px]" step="0.1" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">الحمل الحي (kN/m²)</label>
                      <Input type="number" value={slabLive} onChange={(e) => setSlabLive(e.target.value)} placeholder="2.0" className="h-9 min-h-[36px]" step="0.1" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-muted-foreground max-w-xs">* يعيد حساب الأوزان الذاتية والتحليل تلقائياً.</p>
                    <Button onClick={handleSaveProperties} size="sm"
                      className={`gap-1.5 font-bold text-xs transition-all duration-300 ${isSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      disabled={!slabThickness}>
                      {isSaved ? <><CheckCircle size={14} /> تم الحفظ</> : <><Save size={14} /> حفظ</>}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Move tab (all types) ── */}
            <TabsContent value="move" className="mt-0">
              {MoveTab}
            </TabsContent>

          </div>
        </Tabs>

        <div className="flex justify-end pt-2 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="min-h-[44px]">إغلاق</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

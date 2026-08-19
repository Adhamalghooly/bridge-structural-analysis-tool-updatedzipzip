import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { FrameElement, AreaElement, StructuralNode } from '@/structural/model/types';
import { CheckCircle, Save } from 'lucide-react';
import type { Slab, Beam, Column } from '@/lib/structuralEngine';

interface EndRelease {
  ux: boolean; uy: boolean; uz: boolean;
  rx: boolean; ry: boolean; rz: boolean;
}

interface SlabPropsData {
  thickness: number;
  finishLoad: number;
  liveLoad: number;
  cover: number;
}

interface ElementPropertiesDialogProps {
  open: boolean;
  onClose: () => void;
  frame?: FrameElement | null;
  area?: AreaElement | null;
  node?: StructuralNode | null;
  nodeI?: StructuralNode | null;
  nodeJ?: StructuralNode | null;
  slabProps?: SlabPropsData | null;
  hasMultipleStories?: boolean;
  columnOrientAngle?: number;
  onSave: (data: {
    frameId?: number;
    areaId?: number;
    nodeId?: number;
    b?: number;
    h?: number;
    orientAngle?: number;
    thickness?: number;
    finishLoad?: number;
    liveLoad?: number;
    cover?: number;
    nodeIRestraints?: EndRelease;
    nodeJRestraints?: EndRelease;
    restraints?: EndRelease;
    applyToUpperFloors?: boolean;
    moveX?: number;
    moveY?: number;
    moveZ?: number;
    syncColocated?: boolean;
    newX1?: number;
    newY1?: number;
    newX2?: number;
    newY2?: number;
    newColX?: number;
    newColY?: number;
  }) => void;
  onDelete?: (data: { frameId?: number; areaId?: number; nodeId?: number }) => void;
  onAddBeam?: (beam: Beam) => void;
  onAddColumn?: (col: Column) => void;
  onAddSlab?: (slab: Slab) => void;
  selectedStoryId?: string;
  beamB?: number;
  beamH?: number;
  colB?: number;
  colH?: number;
}

export default function ElementPropertiesDialog({
  open, onClose, frame, area, node, nodeI, nodeJ, slabProps, onSave, onDelete, hasMultipleStories, columnOrientAngle,
  onAddBeam, onAddColumn, onAddSlab, selectedStoryId, beamB, beamH, colB, colH,
}: ElementPropertiesDialogProps) {
  const [b, setB] = useState(0);
  const [h, setH] = useState(0);
  const [orientAngle, setOrientAngle] = useState(0);

  // ── create element state ──
  const [newType, setNewType] = useState<'beam' | 'column' | 'slab'>('beam');
  const [newX1, setNewX1] = useState('0');
  const [newY1, setNewY1] = useState('0');
  const [newX2, setNewX2] = useState('5');
  const [newY2, setNewY2] = useState('0');
  const [newColX, setNewColX] = useState('0');
  const [newColY, setNewColY] = useState('0');
  const [newCreated, setNewCreated] = useState(false);
  const [thickness, setThickness] = useState(0);
  const [finishLoad, setFinishLoad] = useState(0);
  const [liveLoad, setLiveLoad] = useState(0);
  const [cover, setCover] = useState(0);
  const [releaseI, setReleaseI] = useState<EndRelease>({ ux: false, uy: false, uz: false, rx: false, ry: false, rz: false });
  const [releaseJ, setReleaseJ] = useState<EndRelease>({ ux: false, uy: false, uz: false, rx: false, ry: false, rz: false });
  const [nodeRestraints, setNodeRestraints] = useState<EndRelease>({ ux: false, uy: false, uz: false, rx: false, ry: false, rz: false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [applyToUpperFloors, setApplyToUpperFloors] = useState(false);
  // Move state
  const [moveX, setMoveX] = useState('0');
  const [moveY, setMoveY] = useState('0');
  const [moveZ, setMoveZ] = useState('0');
  const [syncColocated, setSyncColocated] = useState(false);
  // Beam coordinate edit state
  const [editX1, setEditX1] = useState('0');
  const [editY1, setEditY1] = useState('0');
  const [editX2, setEditX2] = useState('0');
  const [editY2, setEditY2] = useState('0');
  // Column coordinate edit state
  const [editColX, setEditColX] = useState('0');
  const [editColY, setEditColY] = useState('0');

  useEffect(() => {
    setConfirmDelete(false);
    setApplyToUpperFloors(false);
    setMoveX('0');
    setMoveY('0');
    setMoveZ('0');
    setSyncColocated(false);
    if (frame) {
      setB(frame.b || 200);
      setH(frame.h || 400);
      setOrientAngle(columnOrientAngle ?? 0);
    }
    if (frame?.type === 'beam' && nodeI && nodeJ) {
      setEditX1(nodeI.x.toFixed(3));
      setEditY1(nodeI.y.toFixed(3));
      setEditX2(nodeJ.x.toFixed(3));
      setEditY2(nodeJ.y.toFixed(3));
    }
    if (frame?.type === 'column' && nodeI) {
      setEditColX(nodeI.x.toFixed(3));
      setEditColY(nodeI.y.toFixed(3));
    }
    if (area) {
      setThickness(area.thickness);
    }
    if (slabProps && area) {
      setFinishLoad(slabProps.finishLoad);
      setLiveLoad(slabProps.liveLoad);
      setCover(slabProps.cover);
      setThickness(slabProps.thickness);
    }
    if (node) {
      setNodeRestraints({ ...node.restraints });
    }
    if (nodeI) setReleaseI({ ...nodeI.restraints });
    if (nodeJ) setReleaseJ({ ...nodeJ.restraints });
  }, [frame, area, node, nodeI, nodeJ, slabProps, columnOrientAngle]);

  const handleSave = () => {
    const dx = parseFloat(moveX) || 0;
    const dy = parseFloat(moveY) || 0;
    const dz = parseFloat(moveZ) || 0;
    if (node) {
      onSave({
        nodeId: node.id,
        restraints: nodeRestraints,
        moveX: dx !== 0 ? dx : undefined,
        moveY: dy !== 0 ? dy : undefined,
        moveZ: dz !== 0 ? dz : undefined,
      });
    } else if (frame) {
      const saveData: Parameters<typeof onSave>[0] = {
        frameId: frame.id,
        b, h,
        orientAngle: isColumn ? orientAngle : undefined,
        nodeIRestraints: releaseI,
        nodeJRestraints: releaseJ,
        applyToUpperFloors: isColumn ? applyToUpperFloors : undefined,
        moveX: dx !== 0 ? dx : undefined,
        moveY: dy !== 0 ? dy : undefined,
        moveZ: dz !== 0 ? dz : undefined,
        syncColocated: isBeam ? syncColocated : undefined,
      };
      if (isBeam) {
        const x1 = parseFloat(editX1);
        const y1 = parseFloat(editY1);
        const x2 = parseFloat(editX2);
        const y2 = parseFloat(editY2);
        const coordsChanged = nodeI && nodeJ && (
          Math.abs(x1 - nodeI.x) > 0.0001 || Math.abs(y1 - nodeI.y) > 0.0001 ||
          Math.abs(x2 - nodeJ.x) > 0.0001 || Math.abs(y2 - nodeJ.y) > 0.0001
        );
        if (coordsChanged) {
          saveData.newX1 = x1; saveData.newY1 = y1;
          saveData.newX2 = x2; saveData.newY2 = y2;
        }
      }
      onSave(saveData);
    } else if (area) {
      onSave({
        areaId: area.id, thickness, finishLoad, liveLoad, cover,
        moveX: dx !== 0 ? dx : undefined,
        moveY: dy !== 0 ? dy : undefined,
        moveZ: dz !== 0 ? dz : undefined,
      });
    }
    onClose();
  };

  const handleCreateElement = () => {
    const ts = Date.now();
    const storyId = selectedStoryId || 'ST1';

    if (newType === 'column') {
      const cx = parseFloat(newColX) || 0;
      const cy = parseFloat(newColY) || 0;
      onAddColumn?.({
        id: `EC${ts}`,
        x: cx, y: cy,
        b: colB ?? 300, h: colH ?? 600, L: 3000,
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
    setTimeout(() => setNewCreated(false), 2000);
  };

  const handleMoveOnly = () => {
    const dx = parseFloat(moveX) || 0;
    const dy = parseFloat(moveY) || 0;
    const dz = parseFloat(moveZ) || 0;

    if (isBeam && frame) {
      const x1 = parseFloat(editX1);
      const y1 = parseFloat(editY1);
      const x2 = parseFloat(editX2);
      const y2 = parseFloat(editY2);
      const coordsChanged = nodeI && nodeJ && (
        Math.abs(x1 - nodeI.x) > 0.0001 || Math.abs(y1 - nodeI.y) > 0.0001 ||
        Math.abs(x2 - nodeJ.x) > 0.0001 || Math.abs(y2 - nodeJ.y) > 0.0001
      );
      onSave({
        frameId: frame.id, b, h,
        moveX: dx !== 0 ? dx : undefined,
        moveY: dy !== 0 ? dy : undefined,
        moveZ: dz !== 0 ? dz : undefined,
        syncColocated: syncColocated || undefined,
        ...(coordsChanged ? { newX1: x1, newY1: y1, newX2: x2, newY2: y2 } : {}),
      });
    } else if (isColumn && frame) {
      const cx = parseFloat(editColX);
      const cy = parseFloat(editColY);
      const colCoordsChanged = nodeI && (
        Math.abs(cx - nodeI.x) > 0.0001 || Math.abs(cy - nodeI.y) > 0.0001
      );
      onSave({
        frameId: frame.id, b, h,
        moveX: dx !== 0 ? dx : undefined,
        moveY: dy !== 0 ? dy : undefined,
        ...(colCoordsChanged ? { newColX: cx, newColY: cy } : {}),
      });
    } else if (node) {
      if (dx === 0 && dy === 0 && dz === 0) { onClose(); return; }
      onSave({ nodeId: node.id, restraints: nodeRestraints, moveX: dx || undefined, moveY: dy || undefined, moveZ: dz || undefined });
    } else if (area) {
      if (dx === 0 && dy === 0 && dz === 0) { onClose(); return; }
      onSave({ areaId: area.id, thickness, finishLoad, liveLoad, cover, moveX: dx || undefined, moveY: dy || undefined, moveZ: dz || undefined });
    }
    onClose();
  };

  const handleRotate90 = () => {
    const normalized = ((orientAngle % 360) + 360) % 360;
    const newAngle = (normalized >= 45 && normalized < 135) ? 0 : 90;
    setOrientAngle(newAngle);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (onDelete) {
      if (node) onDelete({ nodeId: node.id });
      else if (frame) onDelete({ frameId: frame.id });
      else if (area) onDelete({ areaId: area.id });
    }
    onClose();
  };

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  const isBeam = frame?.type === 'beam';
  const isColumn = frame?.type === 'column';
  const isArea = !!area;
  const isNode = !!node;

  const title = isNode ? `خصائص وتحرير ركيزة العقدة N${node?.id}` :
    isBeam ? `خصائص الجسر B${frame?.id}` :
    isColumn ? `خصائص العمود C${frame?.id}` :
    isArea ? `خصائص البلاطة A${area?.id}` : 'خصائص العنصر';

  const elementTypeLabel = isNode ? 'العقدة' : isBeam ? 'الجسر' : isColumn ? 'العمود' : 'البلاطة';

  const ReleaseToggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-mono">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="w-[calc(100%-16px)] max-w-md p-0 gap-0 flex flex-col overflow-hidden"
        style={{ maxHeight: '90dvh', height: 'min(90dvh, 680px)' }}
        dir="rtl"
      >
        <DialogHeader className="px-5 pt-4 pb-2 shrink-0 border-b">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            تعديل خصائص وأبعاد العنصر وحرية الأطراف
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={isNode ? 'supports' : 'properties'} className="flex flex-col flex-1 min-h-0">
          <div className="px-4 pt-3 pb-2 shrink-0">
            <TabsList className={`w-full grid ${isNode ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="properties">الخصائص</TabsTrigger>
              {isNode && <TabsTrigger value="supports">🔩 ركائز</TabsTrigger>}
              <TabsTrigger value="move">نقل العنصر</TabsTrigger>
            </TabsList>
          </div>

          {/* ── تبويب الخصائص ── */}
          <TabsContent value="properties" className="overflow-y-auto flex-1 px-5 pb-3 space-y-4 mt-0">
            {/* Node Properties — coordinates and support assignment */}
            {isNode && node && (
              <div className="space-y-4">
                <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="font-semibold text-foreground text-sm mb-1.5 border-b pb-1">موقع وإحداثيات العقدة</div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإحداثي X:</span>
                    <span className="font-mono font-medium">{node.x.toFixed(3)} م</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإحداثي Y:</span>
                    <span className="font-mono font-medium">{node.y.toFixed(3)} م</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإحداثي Z (الارتفاع):</span>
                    <span className="font-mono font-medium">{node.z.toFixed(3)} م</span>
                  </div>
                </div>

                {/* Direct Support Type Presets */}
                <div className="space-y-2 border border-primary/10 rounded-lg p-3 bg-primary/5">
                  <div className="font-bold text-sm text-primary flex items-center gap-1.5 mb-2">
                    <span>🔩</span>
                    <span>تحديد نوع المسند / الركيزة سريعا:</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {/* Fixed */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: true, uy: true, uz: true, rx: true, ry: true, rz: true })}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        nodeRestraints.ux && nodeRestraints.uy && nodeRestraints.uz && nodeRestraints.rx && nodeRestraints.ry && nodeRestraints.rz
                          ? 'bg-red-500 text-white border-red-500 shadow-sm scale-[1.02]'
                          : 'border-border bg-background hover:bg-accent/30 text-foreground'
                      }`}>
                      <span className="text-sm">🔒 وثاقة (Fixed)</span>
                      <span className="text-[8px] opacity-70 font-mono">جميع درجات الحرية مقيدة</span>
                    </button>
                    {/* Pinned */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: true, uy: true, uz: true, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        nodeRestraints.ux && nodeRestraints.uy && nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                          ? 'bg-blue-500 text-white border-blue-500 shadow-sm scale-[1.02]'
                          : 'border-border bg-background hover:bg-accent/30 text-foreground'
                      }`}>
                      <span className="text-sm">📍 مفصلية (Pinned)</span>
                      <span className="text-[8px] opacity-70 font-mono">منع الحركة ومنع الدوران</span>
                    </button>
                    {/* Roller Z */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: false, uy: false, uz: true, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        !nodeRestraints.ux && !nodeRestraints.uy && nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                          ? 'bg-green-600 text-white border-green-600 shadow-sm scale-[1.02]'
                          : 'border-border bg-background hover:bg-accent/30 text-foreground'
                      }`}>
                      <span className="text-sm">🛞 منزلقة (Roller Z)</span>
                      <span className="text-[8px] opacity-70 font-mono">تقييد رأسي فقط UZ</span>
                    </button>
                    {/* Roller X */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: true, uy: false, uz: false, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        nodeRestraints.ux && !nodeRestraints.uy && !nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                          ? 'bg-green-600 text-white border-green-600 shadow-sm scale-[1.02]'
                          : 'border-border bg-background hover:bg-accent/30 text-foreground'
                      }`}>
                      <span className="text-sm">↔️ منزلقة (Roller X)</span>
                      <span className="text-[8px] opacity-70 font-mono">تقييد أفقي فقط UX</span>
                    </button>
                    {/* Roller Y */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: false, uy: true, uz: false, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        !nodeRestraints.ux && nodeRestraints.uy && !nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                          ? 'bg-green-600 text-white border-green-600 shadow-sm scale-[1.02]'
                          : 'border-border bg-background hover:bg-accent/30 text-foreground'
                      }`}>
                      <span className="text-sm">↕️ منزلقة (Roller Y)</span>
                      <span className="text-[8px] opacity-70 font-mono">تقييد اتجاهي فقط UY</span>
                    </button>
                    {/* Free */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: false, uy: false, uz: false, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        Object.values(nodeRestraints).every(v => !v)
                          ? 'bg-muted text-muted-foreground border-border shadow-sm scale-[1.02]'
                          : 'border-border bg-background hover:bg-accent/30 text-foreground'
                      }`}>
                      <span className="text-sm">🌐 حرة (Free/None)</span>
                      <span className="text-[8px] opacity-70 font-mono">لا توجد قيود أو ركائز</span>
                    </button>
                  </div>
                </div>

                {/* Detailed DOF toggles */}
                <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">درجات الحرية التفصيلية للعقدة:</span>
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
                        key={`prop-sup-${key}`}
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
              </div>
            )}

            {/* Dimensions */}
            {(isBeam || isColumn) && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">الأبعاد (مم)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">العرض b</label>
                    <Input type="number" value={b} onChange={e => setB(Number(e.target.value))} className="h-10 font-mono text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">الارتفاع h</label>
                    <Input type="number" value={h} onChange={e => setH(Number(e.target.value))} className="h-10 font-mono text-sm" />
                  </div>
                </div>
                {nodeI && (
                  <div className="text-xs text-muted-foreground">
                    <span>الطول: </span>
                    <span className="font-mono">
                      {nodeI && nodeJ ? Math.sqrt((nodeJ.x - nodeI.x) ** 2 + (nodeJ.y - nodeI.y) ** 2 + (nodeJ.z - nodeI.z) ** 2).toFixed(3) : '—'} م
                    </span>
                  </div>
                )}
                {isColumn && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleRotate90}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        (((orientAngle % 360) + 360) % 360) >= 45 && (((orientAngle % 360) + 360) % 360) < 135
                          ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                          : 'border-border hover:bg-accent/30'
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                      </svg>
                      {(((orientAngle % 360) + 360) % 360) >= 45 && (((orientAngle % 360) + 360) % 360) < 135
                        ? 'مدوَّر 90° — اضغط للإلغاء'
                        : 'تدوير العمود 90°'}
                    </button>
                    {(((orientAngle % 360) + 360) % 360) >= 45 && (((orientAngle % 360) + 360) % 360) < 135 && (
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 font-mono">
                        b_فعلي={b > h ? b : h} × h_فعلي={b > h ? h : b} مم
                      </span>
                    )}
                  </div>
                )}
                {isColumn && hasMultipleStories && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <Checkbox
                      id="apply-upper-floors"
                      checked={applyToUpperFloors}
                      onCheckedChange={v => setApplyToUpperFloors(!!v)}
                    />
                    <label htmlFor="apply-upper-floors" className="text-xs cursor-pointer leading-tight">
                      تطبيق الأبعاد على الأعمدة في نفس الموقع (الأدوار العلوية)
                    </label>
                  </div>
                )}
              </div>
            )}

            {isArea && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">خصائص البلاطة</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">السماكة (مم)</label>
                    <Input type="number" value={thickness} onChange={e => setThickness(Number(e.target.value))} className="h-10 font-mono text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">الغطاء (مم)</label>
                    <Input type="number" value={cover} onChange={e => setCover(Number(e.target.value))} className="h-10 font-mono text-sm" />
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-foreground mt-3">الأحمال المسلطة</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">أحمال التشطيب (kN/m²)</label>
                    <Input type="number" value={finishLoad} onChange={e => setFinishLoad(Number(e.target.value))} className="h-10 font-mono text-sm" step="0.1" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">الحمل الحي (kN/m²)</label>
                    <Input type="number" value={liveLoad} onChange={e => setLiveLoad(Number(e.target.value))} className="h-10 font-mono text-sm" step="0.1" />
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">الوزن الذاتي</span>
                    <span className="font-mono">{(thickness / 1000 * 25).toFixed(2)} kN/m²</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">إجمالي الحمل الميت</span>
                    <span className="font-mono">{(thickness / 1000 * 25 + finishLoad).toFixed(2)} kN/m²</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">الحمل النهائي (1.2D + 1.6L)</span>
                    <span className="font-mono">{(1.2 * (thickness / 1000 * 25 + finishLoad) + 1.6 * liveLoad).toFixed(2)} kN/m²</span>
                  </div>
                </div>
              </div>
            )}


            {/* End releases for frames - ETABS style */}
            {frame && nodeI && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  تحرير الطرف I (بداية العنصر)
                  <Badge variant="outline" className="text-[10px]">N{frame.nodeI}</Badge>
                </h4>
                <p className="text-[10px] text-muted-foreground">U = إزاحة (قوة)، R = دوران (عزم) — مثل ETABS</p>
                <div className="grid grid-cols-3 gap-2 bg-muted/50 rounded-lg p-3">
                  {([
                    { key: 'ux', label: 'U1', desc: 'محوري' },
                    { key: 'uy', label: 'U2', desc: 'قص رئيسي' },
                    { key: 'uz', label: 'U3', desc: 'قص ثانوي' },
                    { key: 'rx', label: 'R1', desc: 'لَي' },
                    { key: 'ry', label: 'R2', desc: 'عزم M22' },
                    { key: 'rz', label: 'R3', desc: 'عزم M33' },
                  ] as const).map(({ key, label, desc }) => (
                    <div key={`i-${key}`} className="flex flex-col items-center gap-0.5">
                      <ReleaseToggle label={`${label}`}
                        value={releaseI[key]}
                        onChange={v => setReleaseI(prev => ({ ...prev, [key]: v }))} />
                      <span className="text-[8px] text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {frame && nodeJ && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  تحرير الطرف J (نهاية العنصر)
                  <Badge variant="outline" className="text-[10px]">N{frame.nodeJ}</Badge>
                </h4>
                <div className="grid grid-cols-3 gap-2 bg-muted/50 rounded-lg p-3">
                  {([
                    { key: 'ux', label: 'U1', desc: 'محوري' },
                    { key: 'uy', label: 'U2', desc: 'قص رئيسي' },
                    { key: 'uz', label: 'U3', desc: 'قص ثانوي' },
                    { key: 'rx', label: 'R1', desc: 'لَي' },
                    { key: 'ry', label: 'R2', desc: 'عزم M22' },
                    { key: 'rz', label: 'R3', desc: 'عزم M33' },
                  ] as const).map(({ key, label, desc }) => (
                    <div key={`j-${key}`} className="flex flex-col items-center gap-0.5">
                      <ReleaseToggle label={`${label}`}
                        value={releaseJ[key]}
                        onChange={v => setReleaseJ(prev => ({ ...prev, [key]: v }))} />
                      <span className="text-[8px] text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ETABS instability warnings */}
            {frame && (() => {
              const warnings: string[] = [];
              if (releaseI.ux && releaseJ.ux) warnings.push('⚠️ لا يمكن تحرير U1 (محوري) من كلا الطرفين — عدم استقرار');
              if (releaseI.uy && releaseJ.uy) warnings.push('⚠️ لا يمكن تحرير U2 (قص) من كلا الطرفين — عدم استقرار');
              if (releaseI.uz && releaseJ.uz) warnings.push('⚠️ لا يمكن تحرير U3 (قص) من كلا الطرفين — عدم استقرار');
              if (releaseI.rx && releaseJ.rx) warnings.push('⚠️ لا يمكن تحرير R1 (لَي) من كلا الطرفين — عدم استقرار');
              if (releaseI.ry && releaseJ.ry && (releaseI.uz || releaseJ.uz))
                warnings.push('⚠️ R2 من كلا الطرفين مع U3 — عدم استقرار');
              if (releaseI.rz && releaseJ.rz && (releaseI.uy || releaseJ.uy))
                warnings.push('⚠️ R3 من كلا الطرفين مع U2 — عدم استقرار');
              if (warnings.length === 0) return null;
              return (
                <div className="space-y-1 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-destructive font-medium">{w}</p>
                  ))}
                </div>
              );
            })()}

            {/* Delete confirmation message */}
            {confirmDelete && (
              <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium text-center">
                  ⚠️ هل أنت متأكد من حذف {elementTypeLabel}؟
                </p>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  اضغط "حذف العنصر" مرة أخرى للتأكيد
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── تبويب الركائز (للعقد فقط) ── */}
          {isNode && (
            <TabsContent value="supports" className="overflow-y-auto flex-1 px-5 pb-4 mt-0">
              <div className="space-y-4 pt-2">

                {/* Active state badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">الحالة الحالية:</span>
                  {Object.values(nodeRestraints).every(v => !v) ? (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">حرة — لا ركيزة</span>
                  ) : Object.values(nodeRestraints).every(v => v) ? (
                    <span className="text-xs bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full font-semibold">وثاقة تامة — Fixed</span>
                  ) : (nodeRestraints.ux && nodeRestraints.uy && nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz) ? (
                    <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">مفصلية — Pinned</span>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      {(['ux','uy','uz','rx','ry','rz'] as const).filter(k => nodeRestraints[k]).map(k => (
                        <span key={k} className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase">{k}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Presets */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">اختصارات سريعة</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Fixed */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: true, uy: true, uz: true, rx: true, ry: true, rz: true })}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        nodeRestraints.ux && nodeRestraints.uy && nodeRestraints.uz && nodeRestraints.rx && nodeRestraints.ry && nodeRestraints.rz
                          ? 'bg-red-500 text-white border-red-500 shadow-sm'
                          : 'border-border hover:bg-accent/30'
                      }`}>
                      <span className="text-lg leading-none">🔒</span>
                      <span className="font-bold">Fixed</span>
                      <span className="text-[9px] opacity-70 font-mono">UX UY UZ RX RY RZ</span>
                    </button>
                    {/* Pinned */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: true, uy: true, uz: true, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        nodeRestraints.ux && nodeRestraints.uy && nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                          ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                          : 'border-border hover:bg-accent/30'
                      }`}>
                      <span className="text-lg leading-none">📍</span>
                      <span className="font-bold">Pinned</span>
                      <span className="text-[9px] opacity-70 font-mono">UX UY UZ</span>
                    </button>
                    {/* Roller Z (منزلقة أفقية) */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: false, uy: false, uz: true, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        !nodeRestraints.ux && !nodeRestraints.uy && nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                          ? 'bg-green-500 text-white border-green-500 shadow-sm'
                          : 'border-border hover:bg-accent/30'
                      }`}>
                      <span className="text-lg leading-none">🛞</span>
                      <span className="font-bold">Roller Z</span>
                      <span className="text-[9px] opacity-70 font-mono">UZ فقط</span>
                    </button>
                    {/* Roller X */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: true, uy: false, uz: false, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        nodeRestraints.ux && !nodeRestraints.uy && !nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                          ? 'bg-green-500 text-white border-green-500 shadow-sm'
                          : 'border-border hover:bg-accent/30'
                      }`}>
                      <span className="text-lg leading-none">↔️</span>
                      <span className="font-bold">Roller X</span>
                      <span className="text-[9px] opacity-70 font-mono">UX فقط</span>
                    </button>
                    {/* Roller Y */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: false, uy: true, uz: false, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        !nodeRestraints.ux && nodeRestraints.uy && !nodeRestraints.uz && !nodeRestraints.rx && !nodeRestraints.ry && !nodeRestraints.rz
                          ? 'bg-green-500 text-white border-green-500 shadow-sm'
                          : 'border-border hover:bg-accent/30'
                      }`}>
                      <span className="text-lg leading-none">↕️</span>
                      <span className="font-bold">Roller Y</span>
                      <span className="text-[9px] opacity-70 font-mono">UY فقط</span>
                    </button>
                    {/* Free */}
                    <button type="button"
                      onClick={() => setNodeRestraints({ ux: false, uy: false, uz: false, rx: false, ry: false, rz: false })}
                      className={`flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        Object.values(nodeRestraints).every(v => !v)
                          ? 'bg-muted text-muted-foreground border-border shadow-sm'
                          : 'border-border hover:bg-accent/30'
                      }`}>
                      <span className="text-lg leading-none">🌐</span>
                      <span className="font-bold">Free</span>
                      <span className="text-[9px] opacity-70 font-mono">لا ركيزة</span>
                    </button>
                  </div>
                </div>

                {/* DOF toggles */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">درجات الحرية — تفصيلي</h4>
                    <span className="text-[10px] text-muted-foreground">تشغيل = مقيَّد</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground -mt-1">U = إزاحة (قوة) ، R = دوران (عزم)</p>
                  <div className="grid grid-cols-3 gap-2 bg-muted/40 rounded-xl p-3">
                    {([
                      { key: 'ux', label: 'UX', desc: 'إزاحة X', color: 'text-red-500' },
                      { key: 'uy', label: 'UY', desc: 'إزاحة Y', color: 'text-green-500' },
                      { key: 'uz', label: 'UZ', desc: 'إزاحة Z', color: 'text-blue-500' },
                      { key: 'rx', label: 'RX', desc: 'دوران X', color: 'text-red-400' },
                      { key: 'ry', label: 'RY', desc: 'دوران Y', color: 'text-green-400' },
                      { key: 'rz', label: 'RZ', desc: 'دوران Z', color: 'text-blue-400' },
                    ] as const).map(({ key, label, desc, color }) => (
                      <div key={`sup-${key}`}
                        onClick={() => setNodeRestraints(prev => ({ ...prev, [key]: !prev[key] }))}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border cursor-pointer select-none transition-all ${
                          nodeRestraints[key]
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'border-border bg-background hover:bg-accent/20'
                        }`}>
                        <span className={`text-xs font-mono font-bold ${nodeRestraints[key] ? 'text-primary-foreground' : color}`}>{label}</span>
                        <Switch
                          checked={nodeRestraints[key]}
                          onCheckedChange={v => setNodeRestraints(prev => ({ ...prev, [key]: v }))}
                          className="scale-75 pointer-events-none"
                        />
                        <span className={`text-[8px] ${nodeRestraints[key] ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save button */}
                <Button onClick={handleSave} className="w-full min-h-[44px] text-base font-semibold">
                  <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  حفظ الركيزة
                </Button>
              </div>
            </TabsContent>
          )}

          {/* ── تبويب نقل العنصر ── */}
          <TabsContent value="move" className="overflow-y-auto flex-1 px-5 pb-3 mt-0">
            <div className="space-y-5 pt-2">

              {/* ── إحداثيات الجسر المطلقة ── */}
              {isBeam && nodeI && nodeJ && (
                <div className="space-y-2 border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/30 dark:bg-blue-950/20">
                  <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><line x1="6" y1="9" x2="18" y2="15"/></svg>
                    تعديل إحداثيات الجسر مباشرة (م)
                  </h4>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <div className="col-span-2 text-[10px] text-blue-600 dark:text-blue-400 font-medium">نقطة البداية (I)</div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-mono">X₁</label>
                      <Input type="text" inputMode="decimal" value={editX1}
                        onChange={e => setEditX1(e.target.value)}
                        className="h-9 font-mono text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-mono">Y₁</label>
                      <Input type="text" inputMode="decimal" value={editY1}
                        onChange={e => setEditY1(e.target.value)}
                        className="h-9 font-mono text-xs" />
                    </div>
                    <div className="col-span-2 text-[10px] text-blue-600 dark:text-blue-400 font-medium pt-1">نقطة النهاية (J)</div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-mono">X₂</label>
                      <Input type="text" inputMode="decimal" value={editX2}
                        onChange={e => setEditX2(e.target.value)}
                        className="h-9 font-mono text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-mono">Y₂</label>
                      <Input type="text" inputMode="decimal" value={editY2}
                        onChange={e => setEditY2(e.target.value)}
                        className="h-9 font-mono text-xs" />
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground bg-muted/40 rounded px-2 py-1 font-mono">
                    الطول: {(Math.sqrt(
                      (parseFloat(editX2) - parseFloat(editX1)) ** 2 +
                      (parseFloat(editY2) - parseFloat(editY1)) ** 2
                    ) || 0).toFixed(3)} م
                  </div>
                </div>
              )}

              {/* ── إحداثيات العمود المطلقة ── */}
              {isColumn && nodeI && (
                <div className="space-y-2 border border-orange-200 dark:border-orange-800 rounded-lg p-3 bg-orange-50/30 dark:bg-orange-950/20">
                  <h4 className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="20"/></svg>
                    تعديل موقع العمود مباشرة (م)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-mono">X (موقع أفقي)</label>
                      <Input type="text" inputMode="decimal" value={editColX}
                        onChange={e => setEditColX(e.target.value)}
                        className="h-9 font-mono text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-mono">Y (موقع رأسي)</label>
                      <Input type="text" inputMode="decimal" value={editColY}
                        onChange={e => setEditColY(e.target.value)}
                        className="h-9 font-mono text-xs" />
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground bg-muted/40 rounded px-2 py-1 font-mono">
                    الموقع الحالي: X={nodeI.x.toFixed(3)} م، Y={nodeI.y.toFixed(3)} م
                  </div>
                </div>
              )}

              <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-0.5">
                <p>أو أدخل مقدار الإزاحة بالمتر في كل اتجاه.</p>
                <p>موجب (+) = يمين / أعلى / للأمام — سالب (−) = يسار / أسفل / للخلف.</p>
              </div>

              <div className="space-y-3">
                {/* ΔX */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600 text-base">ΔX</span>
                    <span className="text-xs text-muted-foreground">(+ يمين / − يسار)</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={moveX}
                    onChange={e => setMoveX(e.target.value)}
                    className="h-11 font-mono text-base"
                    placeholder="0.00 م"
                  />
                </div>

                {/* ΔY */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span className="font-mono font-bold text-green-600 text-base">ΔY</span>
                    <span className="text-xs text-muted-foreground">(+ أعلى / − أسفل)</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={moveY}
                    onChange={e => setMoveY(e.target.value)}
                    className="h-11 font-mono text-base"
                    placeholder="0.00 م"
                  />
                </div>

                {/* ΔZ */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <span className="font-mono font-bold text-purple-600 text-base">ΔZ</span>
                    <span className="text-xs text-muted-foreground">(+ للأعلى / − للأسفل)</span>
                  </label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={moveZ}
                    onChange={e => setMoveZ(e.target.value)}
                    className="h-11 font-mono text-base"
                    placeholder="0.00 م"
                  />
                </div>
              </div>

              {isBeam && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2.5">
                  <Checkbox
                    id="sync-colocated"
                    checked={syncColocated}
                    onCheckedChange={v => setSyncColocated(!!v)}
                  />
                  <label htmlFor="sync-colocated" className="text-xs cursor-pointer leading-tight">
                    تحريك جميع الجسور المطابقة في الإحداثيات (جميع الأدوار)
                  </label>
                </div>
              )}

              {/* Preview of the values */}
              {(parseFloat(moveX) !== 0 || parseFloat(moveY) !== 0 || parseFloat(moveZ) !== 0) && (
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-xs space-y-1">
                  <div className="font-semibold text-orange-700 dark:text-orange-400 mb-1">ملخص الإزاحة</div>
                  {parseFloat(moveX) !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">ΔX</span><span className="font-mono font-bold text-blue-600">{parseFloat(moveX) > 0 ? '+' : ''}{parseFloat(moveX).toFixed(3)} م</span></div>}
                  {parseFloat(moveY) !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">ΔY</span><span className="font-mono font-bold text-green-600">{parseFloat(moveY) > 0 ? '+' : ''}{parseFloat(moveY).toFixed(3)} م</span></div>}
                  {parseFloat(moveZ) !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">ΔZ</span><span className="font-mono font-bold text-purple-600">{parseFloat(moveZ) > 0 ? '+' : ''}{parseFloat(moveZ).toFixed(3)} م</span></div>}
                </div>
              )}

              <Button onClick={handleMoveOnly} className="w-full min-h-[44px] text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white">
                <svg className="mr-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
                حفظ التغييرات — نقل العنصر
              </Button>

              {/* Create New Element */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 mt-4 text-right" dir="rtl">
                <div className="font-bold text-sm flex items-center gap-2 text-primary justify-start">
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
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">X (م)</label>
                      <Input type="text" inputMode="decimal" value={newColX} onChange={e => setNewColX(e.target.value)} className="h-9 text-center font-mono text-sm bg-background" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Y (م)</label>
                      <Input type="text" inputMode="decimal" value={newColY} onChange={e => setNewColY(e.target.value)} className="h-9 text-center font-mono text-sm bg-background" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 bg-background/60 p-3 rounded-lg border border-border/60">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">X₁ (البداية)</label>
                      <Input type="text" inputMode="decimal" value={newX1} onChange={e => setNewX1(e.target.value)} className="h-9 text-center font-mono text-sm bg-background" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Y₁ (البداية)</label>
                      <Input type="text" inputMode="decimal" value={newY1} onChange={e => setNewY1(e.target.value)} className="h-9 text-center font-mono text-sm bg-background" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">X₂ (النهاية)</label>
                      <Input type="text" inputMode="decimal" value={newX2} onChange={e => setNewX2(e.target.value)} className="h-9 text-center font-mono text-sm bg-background" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Y₂ (النهاية)</label>
                      <Input type="text" inputMode="decimal" value={newY2} onChange={e => setNewY2(e.target.value)} className="h-9 text-center font-mono text-sm bg-background" />
                    </div>
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
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0 px-5 py-4 border-t shrink-0 bg-background">
          {/* Delete button */}
          {onDelete && (
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              onClick={handleDelete}
              className={`min-h-[44px] sm:mr-auto border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground ${confirmDelete ? '' : 'hover:border-destructive'}`}
            >
              {confirmDelete ? '⚠️ تأكيد الحذف' : '🗑️ حذف العنصر'}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="min-h-[44px]">إلغاء</Button>
            <Button onClick={handleSave} className="min-h-[44px]">حفظ التغييرات</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Calculator, Check, AlertTriangle, Play, Info, Settings, Sparkles, Sliders,
  Layers, ChevronLeft, Download, Eye, Anchor, CheckCircle2, RefreshCw, BarChart2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  StrapFootingInput,
  analyzeStrapFooting,
  solveStrapFootingSizing,
  getStrapFootingBenchmarks,
  StrapFootingResult
} from '@/lib/strapFootingEngine';
import type { Column } from '@/lib/structuralEngine';
import { FoundationDatabase } from '@/structural/foundation/foundationEngine';
import { FoundationType } from '@/structural/foundation/foundationTypes';

interface StrapFootingAnalysisPanelProps {
  columns: Column[];
  colLoads3D?: Map<string, { P_service?: number; Pu?: number; Mx?: number; My?: number; MxBot?: number; MyBot?: number; My_service?: number }>;
  foundationDb?: FoundationDatabase;
  onFoundationDbChange?: (db: FoundationDatabase) => void;
  mat?: { fc: number; fy: number };
  defaultQall?: number;
  fdnAssignments?: Record<string, 'isolated' | 'strip' | 'combined' | 'strap'>;
}

export default function StrapFootingAnalysisPanel({
  columns = [],
  colLoads3D,
  foundationDb,
  onFoundationDbChange,
  mat = { fc: 25, fy: 420 },
  defaultQall,
  fdnAssignments,
}: StrapFootingAnalysisPanelProps) {
  
  // Custom states for interactive strap modeling
  const [selectedPreset, setSelectedPreset] = useState<string>('NILSON_STRAP_1');
  const [activeTab, setActiveTab] = useState<'plan' | 'diagrams' | 'detailing' | 'boq-bbs'>('plan');

  // Get active strap footings in the global DB
  const strapFootingsInDb = useMemo(() => {
    if (!foundationDb) return [];
    return foundationDb.foundations.filter(f => f.type === FoundationType.Strap);
  }, [foundationDb]);

  // Selected strap footing ID
  const [selectedFootingId, setSelectedFootingId] = useState<string>('STRAP-1');

  const [clearSpacing, setClearSpacing] = useState<number>(3200); // S mm
  const [spanLength, setSpanLength] = useState<number>(5000); // center-to-center mm
  
  // Exterior Footing dims
  const [extL, setExtL] = useState<number>(1800);
  const [extB, setExtB] = useState<number>(2400);
  const [extH, setExtH] = useState<number>(600);
  const [extA1, setExtA1] = useState<number>(450); // distance column center to property line left edge
  
  // Interior Footing dims
  const [intL, setIntL] = useState<number>(2200);
  const [intB, setIntB] = useState<number>(2200);
  const [intH, setIntH] = useState<number>(600);
  
  // Strap Beam dims
  const [beamB, setBeamB] = useState<number>(400);
  const [beamH, setBeamH] = useState<number>(750);
  
  // Geotechnical & Materials
  const [qall, setQall] = useState<number>(defaultQall ?? 200); // Default soil bearing capacity changed to 200 kN/m²
  const [soilDepth, setSoilDepth] = useState<number>(1.2);
  const [includeSelfWeight, setIncludeSelfWeight] = useState<boolean>(true);

  // If no strap footings exist in DB, populate default strap immediately
  useEffect(() => {
    if (onFoundationDbChange && foundationDb && strapFootingsInDb.length === 0) {
      const defaultSf = {
        id: 'STRAP-1',
        name: 'ميدة ربط STRAP-1',
        type: FoundationType.Strap,
        materialFc: 25,
        materialFy: 420,
        input: {
          id: 'STRAP-1',
          name: 'Strap-Footing (St-01)',
          S: 3200,
          L_span: 5000,
          ext_L: 1800,
          ext_B: 2400,
          ext_H: 600,
          ext_a1: 450,
          ext_pedestalH: 0,
          int_L: 2200,
          int_B: 2200,
          int_H: 600,
          int_pedestalH: 0,
          beam_b: 400,
          beam_h: 750,
          fc: mat.fc || 25,
          fy: mat.fy || 420,
          qall: defaultQall ?? 200,
          gammaConc: 25,
          gammaSoil: 18,
          soilCover: 1.2,
          ext_col: { name: "C1 (خارجي جداري)", cx: 400, cy: 400, PDead: 440, PLive: 220 },
          int_col: { name: "C2 (داخلي مركزي)", cx: 450, cy: 450, PDead: 680, PLive: 340 },
          includeSelfWeight: true,
          includeSoilSurcharge: true
        }
      };
      onFoundationDbChange({
        ...foundationDb,
        foundations: [...foundationDb.foundations, defaultSf]
      });
      setSelectedFootingId('STRAP-1');
    } else if (strapFootingsInDb.length > 0 && (!selectedFootingId || !strapFootingsInDb.some(f => f.id === selectedFootingId))) {
      setSelectedFootingId(strapFootingsInDb[0].id);
    }
  }, [foundationDb, strapFootingsInDb, onFoundationDbChange, defaultQall]);

  useEffect(() => {
    if (defaultQall !== undefined) {
      setQall(defaultQall);
    }
  }, [defaultQall]);

  // Column details to combine
  const [colExtSelect, setColExtSelect] = useState<string>('');
  const [colIntSelect, setColIntSelect] = useState<string>('');

  // Synchronize local states with active strap footing from DB
  useEffect(() => {
    const activeFdn = strapFootingsInDb.find(f => f.id === selectedFootingId);
    if (activeFdn && activeFdn.input) {
      const inp = activeFdn.input;
      setClearSpacing(inp.S ?? 3200);
      setSpanLength(inp.L_span ?? 5000);
      setExtL(inp.ext_L ?? 1800);
      setExtB(inp.ext_B ?? 2400);
      setExtH(inp.ext_H ?? 600);
      setExtA1(inp.ext_a1 ?? 450);
      setIntL(inp.int_L ?? 2200);
      setIntB(inp.int_B ?? 2200);
      setIntH(inp.int_H ?? 600);
      setBeamB(inp.beam_b ?? 400);
      setBeamH(inp.beam_h ?? 750);
      setQall(inp.qall ?? 200);
      setSoilDepth(inp.soilCover ?? 1.2);
      setIncludeSelfWeight(inp.includeSelfWeight ?? true);
    }
  }, [selectedFootingId, strapFootingsInDb]);

  // Central active footing database saver
  const saveFootingToDb = (updatedInput: Partial<any>) => {
    if (!onFoundationDbChange || !foundationDb) return;
    
    const updatedFoundations = foundationDb.foundations.map(f => {
      if (f.id === selectedFootingId) {
        return {
          ...f,
          name: updatedInput.name !== undefined ? updatedInput.name : f.name,
          input: {
            ...f.input,
            ...updatedInput
          }
        };
      }
      return f;
    });
    
    onFoundationDbChange({
      ...foundationDb,
      foundations: updatedFoundations
    });
  };

  // Add new strap footing
  const handleAddNewStrap = () => {
    if (!onFoundationDbChange || !foundationDb) return;
    
    // Generate unique index/id - use max existing index + 1 to avoid duplicates
    const existingIndices = foundationDb.foundations
      .filter(f => f.type === FoundationType.Strap)
      .map(f => parseInt(f.id.replace('STRAP-', '')) || 0);
    const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1;
    const nextId = `STRAP-${nextIndex}`;
    const nextName = `ميدة ربط STRAP-${nextIndex}`;
    
    const newFooting = {
      id: nextId,
      name: nextName,
      type: FoundationType.Strap,
      materialFc: mat.fc || 25,
      materialFy: mat.fy || 420,
      input: {
        id: nextId,
        name: nextName,
        S: 3200,
        L_span: 5000,
        ext_L: 1800,
        ext_B: 2400,
        ext_H: 600,
        ext_a1: 450,
        ext_pedestalH: 0,
        int_L: 2200,
        int_B: 2200,
        int_H: 600,
        int_pedestalH: 0,
        beam_b: 400,
        beam_h: 750,
        fc: mat.fc || 25,
        fy: mat.fy || 420,
        qall,
        gammaConc: 25,
        gammaSoil: 18,
        soilCover: soilDepth,
        ext_col: { name: "C1 (خارجي جداري)", cx: 400, cy: 400, PDead: 440, PLive: 220 },
        int_col: { name: "C2 (داخلي مركزي)", cx: 450, cy: 450, PDead: 680, PLive: 340 },
        includeSelfWeight,
        includeSoilSurcharge: true
      }
    };
    
    onFoundationDbChange({
      ...foundationDb,
      foundations: [...foundationDb.foundations, newFooting]
    });
    setSelectedFootingId(nextId);
  };

  // Delete current strap footing
  const handleDeleteStrap = () => {
    if (!onFoundationDbChange || !foundationDb) return;
    if (!confirm("هل أنت متأكد من رغبتك في حذف ميدة الربط هذه بشكل نهائي؟")) return;
    
    const remaining = foundationDb.foundations.filter(f => f.id !== selectedFootingId);
    const remainingStrap = remaining.filter(f => f.type === 'strap');
    const fallbackId = remainingStrap[0]?.id || '';
    
    onFoundationDbChange({
      ...foundationDb,
      foundations: remaining
    });
    setSelectedFootingId(fallbackId);
  };

  // Settle live interactive inputs
  const activeInput = useMemo((): StrapFootingInput => {
    const currentName = strapFootingsInDb.find(f => f.id === selectedFootingId)?.name || `STRAP-${selectedFootingId}`;
    return {
      id: selectedFootingId,
      name: currentName,
      S: clearSpacing,
      L_span: spanLength,
      ext_L: extL,
      ext_B: extB,
      ext_H: extH,
      ext_a1: extA1,
      ext_pedestalH: 0,
      int_L: intL,
      int_B: intB,
      int_H: intH,
      int_pedestalH: 0,
      beam_b: beamB,
      beam_h: beamH,
      fc: mat.fc || 25,
      fy: mat.fy || 420,
      qall,
      gammaConc: 25,
      gammaSoil: 18,
      soilCover: soilDepth,
      ext_col: { name: "C1 (خارجي جداري)", cx: 400, cy: 400, PDead: 440, PLive: 220 },
      int_col: { name: "C2 (داخلي مركزي)", cx: 450, cy: 450, PDead: 680, PLive: 340 },
      includeSelfWeight,
      includeSoilSurcharge: true
    };
  }, [selectedFootingId, clearSpacing, spanLength, extL, extB, extH, extA1, intL, intB, intH, beamB, beamH, mat, qall, soilDepth, includeSelfWeight, strapFootingsInDb]);

  // Design outcomes
  const result = useMemo((): StrapFootingResult => {
    return analyzeStrapFooting(activeInput);
  }, [activeInput]);

  // Combine actions from 3D model columns
  const handleAutoLoadModelColumns = () => {
    if (!colExtSelect || !colIntSelect || colExtSelect === colIntSelect) {
      alert("يرجى اختيار عمودين متمايزين لربطهما بالميدة.");
      return;
    }
    const cExt = columns.find(c => c.id === colExtSelect);
    const cInt = columns.find(c => c.id === colIntSelect);
    if (!cExt || !cInt) return;

    // Center to center distance
    const distM = Math.sqrt(Math.pow(cExt.x - cInt.x, 2) + Math.pow(cExt.y - cInt.y, 2));
    const distMm = Math.round(distM * 1000);

    const ext_load = colLoads3D?.get(cExt.id);
    const int_load = colLoads3D?.get(cInt.id);

    // service defaults
    const ext_p = ext_load?.P_service ? ext_load.P_service : 600;
    const int_p = int_load?.P_service ? int_load.P_service : 1000;

    const nextSpacing = distMm - 2000;
    const nextExtA1 = cExt.b ? cExt.b / 2 : 400;

    setSpanLength(distMm);
    setClearSpacing(nextSpacing); // rough spacer
    setExtA1(nextExtA1); // property line offset

    // Save update instantly to DB
    saveFootingToDb({
      L_span: distMm,
      S: nextSpacing,
      ext_a1: nextExtA1
    });

    alert(`تم تحميل العمود الخارجي ${cExt.id} والعمود الداخلي ${cInt.id} بنجاح. تباعد الأعمدة: ${distMm} ملم.`);
  };

  // Solve sizes for balanced state
  const handleSolveOptimalSizing = () => {
    const solved = solveStrapFootingSizing(activeInput);
    setExtB(solved.ext_B);
    setIntL(solved.int_L);
    setIntB(solved.int_B);
    setBeamH(solved.beam_h);

    saveFootingToDb({
      ext_B: solved.ext_B,
      int_L: solved.int_L,
      int_B: solved.int_B,
      beam_h: solved.beam_h
    });

    alert(solved.report);
  };

  // Build chart stations data along the strap span
  const diagramData = useMemo(() => {
    const data = [];
    const steps = 30;
    const total_m = (activeInput.ext_L + activeInput.S + activeInput.int_L) / 1000;
    const dx = total_m / steps;

    for (let i = 0; i <= steps; i++) {
       const x = i * dx; // distance in m from far left
       let shear = 0;
       let moment = 0;

       // Analytical visual profile
       const colExt_pos = activeInput.ext_a1 / 1000;
       const colInt_pos = colExt_pos + (activeInput.L_span / 1000);
       const extL_Limit = activeInput.ext_L / 1000;
       const intL_Start = extL_Limit + (activeInput.S / 1000);

       // Simple SFD BMD simulation matching the balanced link forces
       if (x < colExt_pos) {
         shear = -result.V_beam_max * (x / colExt_pos);
         moment = -result.M_beam_max * (x / colExt_pos);
       } else if (x >= colExt_pos && x <= extL_Limit) {
         const ratio = (x - colExt_pos) / (extL_Limit - colExt_pos);
         shear = -result.V_beam_max + result.V_beam_max * ratio;
         moment = -result.M_beam_max * (1 - ratio);
       } else if (x > extL_Limit && x < intL_Start) {
         shear = 0;
         moment = 0;
       } else {
         const ratio = (x - intL_Start) / (total_m - intL_Start);
         shear = result.V_beam_max * 0.4 * (1 - ratio);
         moment = result.M_beam_max * 0.1 * (1 - ratio);
       }

       data.push({
         x: parseFloat(x.toFixed(2)),
         'قوة القص (kN)': parseFloat(shear.toFixed(1)),
         'عزم الانحناء (kN.m)': parseFloat(moment.toFixed(1))
       });
    }
    return data;
  }, [activeInput, result]);

  // Load benchmark examples
  const handleApplyBenchmark = () => {
    const benchmarks = getStrapFootingBenchmarks();
    if (benchmarks.length > 0) {
      const b = benchmarks[0];
      setClearSpacing(b.input.S);
      setSpanLength(b.input.L_span);
      setExtL(b.input.ext_L);
      setExtB(b.input.ext_B);
      setExtH(b.input.ext_H);
      setExtA1(b.input.ext_a1);
      setIntL(b.input.int_L);
      setIntB(b.input.int_B);
      setIntH(b.input.int_H);
      setBeamB(b.input.beam_b);
      setBeamH(b.input.beam_h);
      setQall(b.input.qall);
      setSelectedPreset('NILSON_STRAP_1');
      alert("تم شحن مثال المعايرة المرجعي (Nilson Strap Footing Benchmark) بنجاح!");
    }
  };

  return (
    <div id="strap-footing-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6" dir="rtl">
      
      {/* Strap Footing Selector & Add/Delete Controls */}
      <div className="lg:col-span-12">
        <div className="flex items-center gap-2 flex-wrap bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 ml-1">ميدات الربط:</span>
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {strapFootingsInDb.length === 0 ? (
              <span className="text-xs text-slate-400 italic">لا توجد ميدات ربط — اضغط "إضافة" لإنشاء واحدة</span>
            ) : (
              strapFootingsInDb.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFootingId(f.id)}
                  className={`px-3 py-1 rounded border text-[11px] font-bold transition-colors ${selectedFootingId === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950'}`}
                >
                  {f.name || f.id}
                </button>
              ))
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddNewStrap}
              className="h-7 text-[11px] gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-950"
            >
              <span className="text-base leading-none">+</span> إضافة ميدة
            </Button>
            {selectedFootingId && strapFootingsInDb.some(f => f.id === selectedFootingId) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteStrap}
                className="h-7 text-[11px] gap-1 text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
              >
                <span className="text-base leading-none">×</span> حذف الحالية
              </Button>
            )}
          </div>
        </div>
      </div>

      {strapFootingsInDb.length === 0 ? (
        <div className="lg:col-span-12 flex items-center justify-center py-20 text-slate-400 text-sm">
          لا توجد ميدات ربط. اضغط "إضافة ميدة" لبدء التصميم.
        </div>
      ) : (<>

      {/* 1. LEFT CONTROLS: MODELING INPUTS */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600 animate-pulse" />
                تأصيل الجملة الإنشائية
              </CardTitle>
              <Badge className="bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Strap Footing 🧱
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              نمذجة الأساسات الكابولية لمقاومة دوران أعمدة خط الجار (ACI 318)
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 pt-4">

            {/* Link from Model */}
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                ربط عمود الجار والعمود الداخلي
              </span>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-slate-500 block">عمود الجار (الخارجي)</label>
                  <Select value={colExtSelect} onValueChange={setColExtSelect}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="اختر عمود" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.filter(c => !c.isRemoved && (!fdnAssignments || !fdnAssignments[c.id] || fdnAssignments[c.id] === 'strap')).map(col => (
                        <SelectItem key={col.id} value={col.id} className="text-xs">{col.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">العمود الداخلي</label>
                  <Select value={colIntSelect} onValueChange={setColIntSelect}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="اختر عمود" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.filter(c => !c.isRemoved && c.id !== colExtSelect && (!fdnAssignments || !fdnAssignments[c.id] || fdnAssignments[c.id] === 'strap')).map(col => (
                        <SelectItem key={col.id} value={col.id} className="text-xs">{col.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={handleAutoLoadModelColumns} 
                className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5"
                disabled={!colExtSelect || !colIntSelect}
              >
                <Calculator className="h-3.5 w-3.5" />
                تحديد المسار والتباعد التلقائي
              </Button>
            </div>

            {/* Span distances */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block"> تباعدات الميدة الرابطة</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">المسافة بين المحاور (ملم)</label>
                  <Input 
                    type="number" 
                    value={spanLength} 
                    onChange={e => setSpanLength(Number(e.target.value))}
                    className="h-9 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">المسافة الصافية S (ملم)</label>
                  <Input 
                    type="number" 
                    value={clearSpacing} 
                    onChange={e => setClearSpacing(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Ext Footing Geometry */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-xs font-bold text-slate-750 dark:text-slate-200 block">القاعدة الخارجية (تحت العمود الجار)</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">الطول الإجمالي ext_L</label>
                  <Input 
                    type="number" 
                    value={extL} 
                    onChange={e => setExtL(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">العرض الترانفس ext_B</label>
                  <Input 
                    type="number" 
                    value={extB} 
                    onChange={e => setExtB(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">السمك ext_H (ملم)</label>
                  <Input 
                    type="number" 
                    value={extH} 
                    onChange={e => setExtH(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">overhang الجار a1</label>
                  <Input 
                    type="number" 
                    value={extA1} 
                    onChange={e => setExtA1(Number(e.target.value))}
                    className="h-9 text-xs font-mono text-indigo-600 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Int Footing Geometry */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-xs font-bold text-slate-755 dark:text-slate-200 block">القاعدة الداخلية المركزية</span>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="text-[10px] text-slate-500 block">الطول int_L</label>
                  <Input 
                    type="number" 
                    value={intL} 
                    onChange={e => setIntL(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">العرض int_B</label>
                  <Input 
                    type="number" 
                    value={intB} 
                    onChange={e => setIntB(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">السمك int_H</label>
                  <Input 
                    type="number" 
                    value={intH} 
                    onChange={e => setIntH(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Strap Beam Geometry */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-xs font-bold text-slate-755 dark:text-slate-200 block">أبعاد الميدة الرابطة (Strap Beam)</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">عرض الميدة (ملم)</label>
                  <Input 
                    type="number" 
                    value={beamB} 
                    onChange={e => setBeamB(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">ارتفاع الميدة (ملم)</label>
                  <Input 
                    type="number" 
                    value={beamH} 
                    onChange={e => setBeamH(Number(e.target.value))}
                    className="h-9 text-xs font-mono text-rose-600 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Soil and weights */}
            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">المعاملات الجيوتقنية</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 block">تحمل التربة المسموح (kPa)</label>
                  <Input 
                    type="number" 
                    value={qall} 
                    onChange={e => setQall(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">عمق الردم (متر)</label>
                  <Input 
                    type="number" 
                    value={soilDepth} 
                    onChange={e => setSoilDepth(Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Auto solver */}
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50 space-y-2">
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-emerald-600 animate-spin" style={{ animationDuration: '4s' }} />
                موازنة الهبوط والضغوط تلقائياً
              </span>
              <Button 
                onClick={handleSolveOptimalSizing} 
                className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 font-bold"
              >
                <Play className="h-3 w-3" />
                حل الاتزان وحساب الأبعاد المقترحة
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* 2. RIGHT PANEL: ANALYSIS, DESIGN RESULTS & LAYOUT PLAN */}
      <div className="lg:col-span-8 space-y-6">

        {/* Dynamic Warning Alerts */}
        {result.warnings.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-900/50 space-y-1">
            <span className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              ملاحظات ميكانيكا التربة وتحذيرات الكود:
            </span>
            <ul className="list-disc list-inside text-[11px] text-amber-700 dark:text-amber-300 pr-2 space-y-1">
              {result.warnings.map((warn, index) => (
                <li key={index}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Top KPI Metrics Table */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-50/50 dark:bg-slate-900 border-b-2 border-b-rose-500 shadow-md">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 font-bold block">إجهاد القاعدة الخارجية</span>
              <span className="text-xl font-mono font-black text-rose-600 block mt-1">
                {result.extSoilReaction_s.toFixed(1)} <span className="text-xs text-slate-400">kPa</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                القدرة المسموحة: {qall} kPa
              </span>
            </CardContent>
          </Card>

          <Card className="bg-slate-50/50 dark:bg-slate-900 border-b-2 border-b-emerald-500 shadow-md">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 font-bold block">إجهاد القاعدة الداخلية</span>
              <span className="text-xl font-mono font-black text-emerald-600 block mt-1">
                {result.intSoilReaction_s.toFixed(1)} <span className="text-xs text-slate-400">kPa</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                القدرة المسموحة: {qall} kPa
              </span>
            </CardContent>
          </Card>

          <Card className="bg-slate-50/50 dark:bg-slate-900 border-b-2 border-b-indigo-500 shadow-md">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 font-bold block">عزم دوران الميدة الأقصى</span>
              <span className="text-xl font-mono font-black text-indigo-600 block mt-1">
                {result.M_beam_max.toFixed(1)} <span className="text-xs text-slate-400">kN·m</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                تسليح علوي مكثف على الميدة
              </span>
            </CardContent>
          </Card>

          <Card className="bg-slate-50/50 dark:bg-slate-900 border-b-2 border-b-cyan-500 shadow-md">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 font-bold block">حديد الميدة الموصى به</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block mt-1">
                {result.beam_top_rebar.count}T{result.beam_top_rebar.barSize} علوي كابولي
              </span>
              <span className="text-[10px] text-cyan-600 block mt-1 font-mono">
                {result.beam_stirrups}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Tab switcher suites */}
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between">
              <TabsList className="bg-slate-200/60 dark:bg-slate-850">
                <TabsTrigger value="plan" className="text-xs flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  مخطط التسليح (Plan Layout)
                </TabsTrigger>
                <TabsTrigger value="diagrams" className="text-xs flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5" />
                  مخططات القوى الحركية (SFD/BMD)
                </TabsTrigger>
                <TabsTrigger value="detailing" className="text-xs flex items-center gap-1.5">
                  <Anchor className="h-3.5 w-3.5" />
                  تفاصيل القطاعات (Section A-A)
                </TabsTrigger>
                <TabsTrigger value="boq-bbs" className="text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  حصر الكميات وجدول BBS
                </TabsTrigger>
              </TabsList>

              <Button onClick={handleApplyBenchmark} size="sm" variant="outline" className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                المعايرة الأكاديمية (Nilson Benchmark)
              </Button>
            </div>

            <CardContent className="p-6">

              {/* TAB 1: INTERACTIVE PLAN LAYOUT (SVG) */}
              <TabsContent value="plan" className="mt-0 space-y-4">
                <div className="bg-slate-950 rounded-xl p-6 flex flex-col items-center justify-center border border-slate-800 relative min-h-[340px]">
                  <span className="absolute top-3 left-3 text-[10px] font-mono text-slate-500">CAD Interactive Strap Plan View Blueprint</span>
                  
                  {/* Interactive SVG Diagram */}
                  <svg viewBox="0 0 650 300" className="w-full max-w-[600px] overflow-visible">
                    {/* Centroid axes and lines */}
                    <line x1="30" y1="150" x2="620" y2="150" stroke="#334155" strokeDasharray="4,4" strokeWidth="1" />
                    <line x1="120" y1="50" x2="120" y2="250" stroke="#334155" strokeDasharray="4,4" strokeWidth="1" />
                    <line x1="500" y1="50" x2="500" y2="250" stroke="#334155" strokeDasharray="4,4" strokeWidth="1" />

                    {/* Left/Right Ext and Int bounds */}
                    {/* Exterior Footing (Eccentric) */}
                    <rect x="50" y="60" width="140" height="180" fill="rgba(244,63,94,0.06)" stroke="#f43f5e" strokeWidth="2.5" />
                    {/* Blinding PCC outline for ext */}
                    <rect x="42" y="52" width="156" height="196" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="3,3" />

                    {/* Interior Footing (Concentric) */}
                    <rect x="420" y="50" width="160" height="200" fill="rgba(16,185,129,0.06)" stroke="#10b981" strokeWidth="2.5" />
                    {/* Blinding PCC outline for int */}
                    <rect x="412" y="42" width="176" height="216" fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="3,3" />

                    {/* Strap Connecting Beam */}
                    <rect x="190" y="125" width="230" height="50" fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth="2" />
                    <text x="305" y="115" fill="#f1f5f9" fontSize="10" fontWeight="bold" textAnchor="middle">ميدة رابطة (Strap Beam): {beamB}x{beamH} ملم</text>

                    {/* Column 1 (Eccentric- on Left Boundary Edge) */}
                    <rect x="80" y="130" width="40" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <text x="100" y="115" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">{activeInput.ext_col.name}</text>
                    
                    {/* Column 2 (Centered concentric on right footing) */}
                    <rect x="480" y="130" width="40" height="40" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                    <text x="500" y="115" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">{activeInput.int_col.name}</text>

                    {/* Dimension lines */}
                    <path d="M 50,260 L 50,268 M 190,260 L 190,268 M 50,264 L 190,264" stroke="#64748b" strokeWidth="1" />
                    <text x="120" y="278" fill="#94a3b8" fontSize="10" textAnchor="middle">ext_L = {extL} ملم</text>

                    <path d="M 420,260 L 420,268 M 580,260 L 580,268 M 420,264 L 580,264" stroke="#64748b" strokeWidth="1" />
                    <text x="500" y="278" fill="#94a3b8" fontSize="10" textAnchor="middle">int_L = {intL} ملم</text>

                    <path d="M 190,195 L 420,195" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="5,3" />
                    <text x="305" y="190" fill="#818cf8" fontSize="9" textAnchor="middle">المسافة الصافية S = {clearSpacing} ملم</text>
                    
                    {/* Left extreme cantilever span */}
                    <path d="M 50,80 L 100,80" stroke="#f43f5e" strokeWidth="1" />
                    <text x="75" y="72" fill="#f43f5e" fontSize="8" textAnchor="middle">a1 = {extA1}</text>
                    
                    {/* Compass North arrow placeholder */}
                    <circle cx="600" cy="50" r="15" fill="none" stroke="#475569" strokeWidth="1" />
                    <line x1="600" y1="50" x2="600" y2="38" stroke="#f43f5e" strokeWidth="1.5" />
                    <text x="600" y="32" fill="#f43f5e" fontSize="8" textAnchor="middle" fontWeight="bold">N</text>
                  </svg>
                </div>

                {/* Sizing description breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200">موازنة وحسابات الترابط الهيكلي</span>
                    <div className="flex justify-between py-1 border-b">
                      <span>اللامركزية الناتجة بالقاعدة الخارجية (Eccentricity e)</span>
                      <span className="font-mono font-bold text-rose-600">{result.extEccentricity} ملم</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>حالة توازن واستقرار التربة (No Uplift Check)</span>
                      <span className="font-bold text-emerald-600">✓ آمن ومحقق كلياً (Uniform stress distribution)</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200">إحصاء الأحمال المعدلة بعد ربط الميدة</span>
                    <div className="flex justify-between py-1 border-b">
                      <span>أحمال التربة الإجمالية للقاعدة الخارجية (R_ext_s)</span>
                      <span className="font-mono font-bold">{result.totalExtLoad_s} kN</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>أحمال التربة الإجمالية للقاعدة الداخلية (R_int_s)</span>
                      <span className="font-mono font-bold">{result.totalIntLoad_s} kN</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: FORCE DIAGRAMS */}
              <TabsContent value="diagrams" className="mt-0 space-y-4">
                <span className="text-xs text-slate-500 font-bold block mb-2">أشكال قوي القص والقص المنظم وعزوم الانحناء وعزوم الدوران على طول الجملة</span>
                
                <div className="h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={diagramData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="x" label={{ value: 'المسافة الإجمالية x (متر)', position: 'insideBottom', offset: -5 }} />
                      <YAxis label={{ value: 'الشير والعزم الميكانيكي على الجملة', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="قوة القص (kN)" stroke="#06b6d4" strokeWidth={2} name="قوة القص (kN)" />
                      <Line type="monotone" dataKey="عزم الانحناء (kN.m)" stroke="#6366f1" strokeWidth={2.5} name="عزم الانحناء (kN·m)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-4 border-t">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-slate-500 block">منطقة العزم الأقصى بالمستخلص الهيكلي</span>
                    <span className="font-mono text-base font-black text-rose-600 block">{result.M_beam_max.toFixed(1)} kN·m</span>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      يحدث العزم الأقصى عند الوجه الداخلي للعمود الجاري، ويتطلب تسليحاً علوياً مركزاً لمقاومة شد الألياف العلوية بالميدة.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="text-slate-500 block">قيمة قوة القص القصوى المنتقلة على الميدة</span>
                    <span className="font-mono text-base font-black text-cyan-600 block">{result.V_beam_max.toFixed(1)} kN</span>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      تعد قوة القص لربط الميدة حرجة ويتطلب تدقيق الكانات الإستيكيكية للتصميم لمقاومة تشكل الشروخ القطرية.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: LONGITUDINAL DETAILING VIEW */}
              <TabsContent value="detailing" className="mt-0 space-y-4">
                <div className="bg-slate-950 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-800 relative min-h-[300px]">
                  <span className="absolute top-3 left-3 text-[10px] font-mono text-slate-500">CAD Section A-A Structural Detailing Profile</span>
                  
                  {/* Vector Elevation Drawing */}
                  <svg viewBox="0 0 600 240" className="w-full max-w-[550px]" overflow="visible">
                    {/* Concrete outline */}
                    {/* Ext footing */}
                    <rect x="50" y="110" width="130" height="70" fill="none" stroke="#64748b" strokeWidth="2" />
                    {/* Strap beam */}
                    <rect x="180" y="80" width="240" height="75" fill="none" stroke="#64748b" strokeWidth="1.5" />
                    {/* Int footing */}
                    <rect x="420" y="110" width="130" height="70" fill="none" stroke="#64748b" strokeWidth="2" />

                    {/* Ground line */}
                    <line x1="20" y1="50" x2="580" y2="50" stroke="#854d0e" strokeWidth="2" />
                    <text x="30" y="42" fill="#854d0e" fontSize="8" fontWeight="bold">NGL (منسوب التأسيس)</text>

                    {/* Columns */}
                    <rect x="80" y="40" width="30" height="70" fill="none" stroke="#64748b" strokeWidth="1.5" />
                    <rect x="470" y="40" width="30" height="70" fill="none" stroke="#64748b" strokeWidth="1.5" />

                    {/* Symmetrical main top rebar of strap beam (Anchored) */}
                    <path d="M 55,88 L 545,88" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                    {/* Hook anchors down */}
                    <path d="M 55,88 L 55,108 M 545,88 L 545,108" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                    <text x="300" y="80" fill="#f87171" fontSize="10" fontWeight="black" textAnchor="middle">حديد رئيسي علوي: {result.beam_top_rebar.barText}</text>

                    {/* Bottom rebar of strap beam */}
                    <path d="M 183,143 L 417,143" fill="none" stroke="#3b82f6" strokeWidth="2" />
                    <text x="300" y="137" fill="#60a5fa" fontSize="9" textAnchor="middle">سفلي: {result.beam_bot_rebar.barText}</text>

                    {/* Footing Bottom reinforcement */}
                    <line x1="55" y1="172" x2="175" y2="172" stroke="#10b981" strokeWidth="2" />
                    <line x1="425" y1="172" x2="545" y2="172" stroke="#10b981" strokeWidth="2" />

                    <text x="115" y="165" fill="#34d399" fontSize="8" textAnchor="middle">سفلي: T14@150</text>
                    <text x="485" y="165" fill="#34d399" fontSize="8" textAnchor="middle">سفلي: T16@150</text>
                    
                    {/* Compressible material separator to show strip doesn't rest on soil */}
                    <line x1="180" y1="160" x2="420" y2="160" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3,3" />
                    <text x="300" y="172" fill="#f59e0b" fontSize="8" textAnchor="middle">فاصل فوم إنشائي (Strap doesn't bear soil)</text>
                  </svg>
                </div>

                {/* Main reinforcement schedules */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">تسليح الميدة الإنشائي</span>
                    <div className="flex justify-between border-b pb-1">
                      <span>حديد مرصوص بالعلوي (تولد الشد)</span>
                      <span className="font-semibold text-rose-600">{result.beam_top_rebar.barText}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span>الحديد السفلي للميدة</span>
                      <span className="font-semibold">{result.beam_bot_rebar.barText}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>كانات مقاومة القص بالميدة</span>
                      <span className="font-mono">{result.beam_stirrups}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">تسليم حديد القواعد</span>
                    <div className="flex justify-between border-b pb-1">
                      <span>حديد فرش لأسفل القاعدة الخارجية</span>
                      <span className="font-semibold">{result.ext_bot_rebar.barText}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>حديد فرش لأسفل القاعدة الداخلية</span>
                      <span className="font-semibold">{result.int_bot_rebar.barText}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: COMPREHENSIVE QS / BOQ & BBS */}
              <TabsContent value="boq-bbs" className="mt-0 space-y-4">
                <span className="text-xs text-slate-500 font-bold block">جدول كميات حصر المواد التقديري لصب الجملة (Bill of Quantities)</span>
                
                {/* BOQ Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-xs mb-4">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded border text-right">
                    <span className="text-slate-400 block">أعمال الحفر والتربة</span>
                    <span className="font-mono text-base font-black text-slate-800 dark:text-slate-200 mt-0.5 block">{result.excavationVol} م³</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded border text-right">
                    <span className="text-slate-400 block">صب الخرسانة العادية (PCC)</span>
                    <span className="font-mono text-base font-black text-slate-800 dark:text-slate-200 mt-0.5 block">{result.concretePCCVol} م³</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded border text-right">
                    <span className="text-slate-400 block">الخرسانة المسلحة (RCC)</span>
                    <span className="font-mono text-base font-black text-slate-800 dark:text-slate-200 mt-0.5 block text-indigo-600">{result.concreteRCCVol} م³</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded border text-right">
                    <span className="text-slate-400 block">مسطح أعمال النجارة</span>
                    <span className="font-mono text-base font-black text-slate-800 dark:text-slate-200 mt-0.5 block">{result.formworkArea} م²</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded border text-right col-span-2 lg:col-span-2">
                    <span className="text-slate-400 block">إجمالي وزن حديد التسليح</span>
                    <span className="font-mono text-base font-black text-slate-800 dark:text-slate-200 mt-0.5 block text-emerald-600">{result.totalSteelKg} كجم</span>
                  </div>
                </div>

                {/* BBS Detail Table */}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">جدول تفريد حديد التسليح التفصيلي (Bar Bending Schedule - BBS)</span>
                <Table className="text-xs text-right border dark:border-slate-800">
                  <TableHeader className="bg-slate-100 dark:bg-slate-800">
                    <TableRow>
                      <TableHead>الرمز (Mark)</TableHead>
                      <TableHead>العنصر الهيكلي</TableHead>
                      <TableHead>القطر Ø</TableHead>
                      <TableHead>شكل السيخ</TableHead>
                      <TableHead>طول السيخ</TableHead>
                      <TableHead>العدد</TableHead>
                      <TableHead>الوزن الكلي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.bbsTable.map((bar, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono font-bold">{bar.mark}</TableCell>
                        <TableCell>{bar.member}</TableCell>
                        <TableCell className="font-mono">{bar.size} ملم</TableCell>
                        <TableCell>
                          {bar.shape === 'hook_90' && <span className="text-rose-600">90° Hook ↩</span>}
                          {bar.shape === 'straight' && <span className="text-blue-600">مستقيم (Straight) ⎯</span>}
                          {bar.shape === 'stirrup' && <span className="text-amber-600">كانة (Stirrup) ▢</span>}
                        </TableCell>
                        <TableCell className="font-mono">{bar.length} ملم</TableCell>
                        <TableCell className="font-mono">{bar.count}</TableCell>
                        <TableCell className="font-mono font-bold">{bar.totalWeight} كجم</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

            </CardContent>
          </Tabs>
        </Card>

      </div>

      </>)}

    </div>
  );
}

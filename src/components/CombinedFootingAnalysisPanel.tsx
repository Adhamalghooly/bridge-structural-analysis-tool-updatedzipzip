import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Calculator, Check, AlertTriangle, Play, HelpCircle, Layers, CheckCircle, 
  Settings, Database, Info, RefreshCw, Sparkles, Sliders, Maximize2, Trash2, Plus
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  CombinedFootingInput,
  CombinedColumnInput,
  analyzeCombinedFooting,
  solveCombinedFootingSizing,
  getCombinedFootingBenchmarks,
  CombinedFootingAnalysisResult
} from '@/lib/combinedFootingEngine';
import type { Column } from '@/lib/structuralEngine';
import { FoundationDatabase } from '@/structural/foundation/foundationEngine';
import { FoundationType } from '@/structural/foundation/foundationTypes';

interface CombinedFootingAnalysisPanelProps {
  columns: Column[];
  colLoads3D?: Map<string, { P_service?: number; Pu?: number; Mx?: number; My?: number; MxBot?: number; MyBot?: number; Vu?: number }>;
  foundationDb?: FoundationDatabase;
  onFoundationDbChange?: (db: FoundationDatabase) => void;
  mat?: { fc: number; fy: number };
  defaultQall?: number;
  fdnAssignments?: Record<string, 'isolated' | 'strip' | 'combined' | 'strap'>;
}

export default function CombinedFootingAnalysisPanel({
  columns = [],
  colLoads3D,
  foundationDb,
  onFoundationDbChange,
  mat = { fc: 25, fy: 420 },
  defaultQall,
  fdnAssignments,
}: CombinedFootingAnalysisPanelProps) {
  // Get active combined footings
  const combinedFootingsInDb = useMemo(() => {
    if (!foundationDb) return [];
    return foundationDb.foundations.filter(f => f.type === FoundationType.Combined);
  }, [foundationDb]);

  // Selected combined footing ID
  const [selectedFootingId, setSelectedFootingId] = useState<string>('CF-1');

  // Soil bearing capacity initial sync
  const [soilQall, setSoilQall] = useState<number>(defaultQall ?? 200); // kPa

  // If no combined footings exist in DB, populate default immediately
  useEffect(() => {
    if (onFoundationDbChange && foundationDb && combinedFootingsInDb.length === 0) {
      const defaultCf = {
        id: 'CF-1',
        name: 'قاعدة مشتركة CF-1',
        type: FoundationType.Combined,
        materialFc: 25,
        materialFy: 420,
        input: {
          id: 'CF-1',
          name: 'قاعدة مشتركة CF-1',
          shape: 'rectangular',
          L: 5400,
          B1: 2000,
          B2: 2000,
          H: 600,
          qall: defaultQall ?? 200,
          Ks: 20000,
          analysisMode: 'rigid',
          columns: [
            { id: 'C_COL_1', name: 'C1 (Edge)', x: 450, cx: 400, cy: 400, PDead: 450, PLive: 200, MDead: 10, MLive: 5 },
            { id: 'C_COL_2', name: 'C2 (Interior)', x: 4350, cx: 450, cy: 450, PDead: 650, PLive: 300, MDead: 15, MLive: 10 }
          ]
        }
      };
      onFoundationDbChange({
        ...foundationDb,
        foundations: [...foundationDb.foundations, defaultCf]
      });
      setSelectedFootingId('CF-1');
    } else if (combinedFootingsInDb.length > 0 && (!selectedFootingId || !combinedFootingsInDb.some(f => f.id === selectedFootingId))) {
      setSelectedFootingId(combinedFootingsInDb[0].id);
    }
  }, [foundationDb, combinedFootingsInDb, onFoundationDbChange, defaultQall]);

  // Tabs for visualization
  const [activeVisualTab, setActiveVisualTab] = useState<'layout' | 'diagrams' | 'rebar' | 'benchmarks'>('layout');

  // Input States for the Active Footing
  const [shape, setShape] = useState<'rectangular' | 'trapezoidal'>('rectangular');
  const [length, setLength] = useState<number>(5400); // L mm
  const [width1, setWidth1] = useState<number>(2000);  // B1 mm (left)
  const [width2, setWidth2] = useState<number>(2000);  // B2 mm (right)
  const [thickness, setThickness] = useState<number>(600); // H mm
  
  const [soilKs, setSoilKs] = useState<number>(20000);   // kN/m³

  useEffect(() => {
    if (defaultQall !== undefined) {
      setSoilQall(defaultQall);
    }
  }, [defaultQall]);
  const [analysisMode, setAnalysisMode] = useState<'rigid' | 'winkler'>('rigid');
  
  // Columns linked to active footing
  const [linkedColumns, setLinkedColumns] = useState<CombinedColumnInput[]>([
    { id: 'C_COL_1', name: 'C1 (Edge)', x: 450, cx: 400, cy: 400, PDead: 450, PLive: 200, MDead: 10, MLive: 5 },
    { id: 'C_COL_2', name: 'C2 (Interior)', x: 4350, cx: 450, cy: 450, PDead: 650, PLive: 300, MDead: 15, MLive: 10 }
  ]);

  // Synchronize local states with active footing from DB
  useEffect(() => {
    const activeFdn = combinedFootingsInDb.find(f => f.id === selectedFootingId);
    if (activeFdn && activeFdn.input) {
      const inp = activeFdn.input;
      setShape(inp.shape || 'rectangular');
      setLength(inp.L || 5400);
      setWidth1(inp.B1 || 2000);
      setWidth2(inp.B2 || 2000);
      setThickness(inp.H || 600);
      setSoilQall(inp.qall ?? 200);
      setSoilKs(inp.Ks ?? 20000);
      setAnalysisMode(inp.analysisMode || 'rigid');
      setLinkedColumns(inp.columns || [
        { id: 'C_COL_1', name: 'C1 (Edge)', x: 450, cx: 400, cy: 400, PDead: 450, PLive: 200, MDead: 10, MLive: 5 },
        { id: 'C_COL_2', name: 'C2 (Interior)', x: 4350, cx: 450, cy: 450, PDead: 650, PLive: 300, MDead: 15, MLive: 10 }
      ]);
    }
  }, [selectedFootingId, combinedFootingsInDb]);

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

  // Add new combined footing
  const handleAddNewCombined = () => {
    if (!onFoundationDbChange || !foundationDb) return;
    
    // Generate unique index/id
    const nextIndex = combinedFootingsInDb.length + 1;
    const nextId = `CF-${nextIndex}`;
    const nextName = `قاعدة مشتركة CF-${nextIndex}`;
    
    const newFooting = {
      id: nextId,
      name: nextName,
      type: FoundationType.Combined,
      materialFc: mat.fc || 25,
      materialFy: mat.fy || 420,
      input: {
        id: nextId,
        name: nextName,
        shape: 'rectangular',
        L: 5400,
        B1: 2000,
        B2: 2000,
        H: 600,
        qall: soilQall,
        Ks: soilKs,
        analysisMode: 'rigid',
        columns: [
          { id: 'C_COL_1', name: 'C1 (Edge)', x: 450, cx: 400, cy: 400, PDead: 450, PLive: 200, MDead: 10, MLive: 5 },
          { id: 'C_COL_2', name: 'C2 (Interior)', x: 4350, cx: 450, cy: 450, PDead: 650, PLive: 300, MDead: 15, MLive: 10 }
        ]
      }
    };
    
    onFoundationDbChange({
      ...foundationDb,
      foundations: [...foundationDb.foundations, newFooting]
    });
    setSelectedFootingId(nextId);
  };

  // Delete current combined footing
  const handleDeleteCombined = () => {
    if (!onFoundationDbChange || !foundationDb) return;
    if (combinedFootingsInDb.length <= 1) {
      alert("يجب الإبقاء على قاعدة مشتركة واحدة على الأقل في المشروع.");
      return;
    }
    
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذه القاعدة المشتركة بشكل نهائي؟")) return;
    
    const remaining = foundationDb.foundations.filter(f => f.id !== selectedFootingId);
    const remainingCombined = remaining.filter(f => f.type === FoundationType.Combined);
    const fallbackId = remainingCombined[0]?.id || '';
    
    onFoundationDbChange({
      ...foundationDb,
      foundations: remaining
    });
    setSelectedFootingId(fallbackId);
  };

  // Dropdown column selection states (for combining model columns)
  const [col1Select, setCol1Select] = useState<string>('');
  const [col2Select, setCol2Select] = useState<string>('');

  // Auto-Sizing parameters
  const [leftFixed, setLeftFixed] = useState<boolean>(true); // typical property line case

  const L_m = length / 1000;

  // Dynamic evaluation of current state input
  const activeInput = useMemo((): CombinedFootingInput => {
    const currentName = combinedFootingsInDb.find(f => f.id === selectedFootingId)?.name || `CF-${selectedFootingId}`;
    return {
      id: selectedFootingId,
      name: currentName,
      shape,
      L: length,
      B1: width1,
      B2: shape === 'rectangular' ? width1 : width2,
      H: thickness,
      fc: mat.fc || 25,
      fy: mat.fy || 420,
      qall: soilQall,
      Ks: soilKs,
      analysisMode,
      hasPedestal: false,
      includeSelfWeight: true,
      includeSoilCover: true,
      soilCoverDepth: 1.0,
      gammaConc: 25,
      gammaSoil: 18,
      columns: linkedColumns
    };
  }, [selectedFootingId, shape, length, width1, width2, thickness, soilQall, soilKs, analysisMode, linkedColumns, mat, combinedFootingsInDb]);

  // Active analysis outcome
  const activeResult = useMemo((): CombinedFootingAnalysisResult => {
    return analyzeCombinedFooting(activeInput);
  }, [activeInput]);

  // Handle Quick auto combine from 3D model columns
  const handleAutoCombineColumns = () => {
    if (!col1Select || !col2Select || col1Select === col2Select) {
      alert("الرجاء اختيار عمودين متمايزين للمدمة.");
      return;
    }

    const c1 = columns.find(c => c.id === col1Select);
    const c2 = columns.find(c => c.id === col2Select);
    if (!c1 || !c2) return;

    // Calculate real distance
    const distM = Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2));
    const distMm = Math.round(distM * 1000);

    // Get loads
    const load1 = colLoads3D?.get(c1.id);
    const load2 = colLoads3D?.get(c2.id);

    const pd1 = load1?.P_service ? load1.P_service * 0.65 : 400;
    const pl1 = load1?.P_service ? load1.P_service * 0.35 : 200;
    const pd2 = load2?.P_service ? load2.P_service * 0.65 : 600;
    const pl2 = load2?.P_service ? load2.P_service * 0.35 : 300;

    const overhang_a1 = 450; // default mm left cantilever
    const spacing = distMm;   // middle spacing
    const overhang_a2 = 600;  // right cantilever

    const totalL = overhang_a1 + spacing + overhang_a2;

    const nextCols = [
      {
        id: c1.id,
        name: `C_${c1.id}`,
        x: overhang_a1,
        cx: c1.b || 400,
        cy: c1.h || 400,
        PDead: Math.round(pd1),
        PLive: Math.round(pl1),
        MDead: Math.round(load1?.MxBot || 10),
        MLive: 5
      },
      {
        id: c2.id,
        name: `C_${c2.id}`,
        x: overhang_a1 + spacing,
        cx: c2.b || 450,
        cy: c2.h || 450,
        PDead: Math.round(pd2),
        PLive: Math.round(pl2),
        MDead: Math.round(load2?.MxBot || 15),
        MLive: 10
      }
    ];

    setLength(totalL);
    setWidth1(2200);
    setWidth2(1800);
    setShape('rectangular');
    setLinkedColumns(nextCols);

    // Save update instantly to DB
    saveFootingToDb({
      L: totalL,
      B1: 2200,
      B2: 1800,
      shape: 'rectangular',
      columns: nextCols
    });
  };

  // Sizing Optimization Action
  const handleAutoSizingSolve = () => {
    const recommendation = solveCombinedFootingSizing(activeInput, leftFixed, false);
    setLength(recommendation.L);
    setWidth1(recommendation.B1);
    setWidth2(recommendation.B2);
    setThickness(recommendation.H);
    
    saveFootingToDb({
      L: recommendation.L,
      B1: recommendation.B1,
      B2: recommendation.B2,
      H: recommendation.H
    });
    alert(recommendation.report);
  };

  // Convert stations for chart representation
  const chartData = useMemo(() => {
    return activeResult.stations.map(st => ({
      x: st.x,
      'إجهاد التربة (kPa)': st.pressure,
      'قوة القص (kN)': st.shear,
      'عزم الانحناء (kN.m)': st.moment,
      'الهبوط المنظم': st.deflection
    }));
  }, [activeResult]);

  // Load benchmarks
  const benchmarks = getCombinedFootingBenchmarks();

  const handleApplyBenchmark = (bench: typeof benchmarks[0]) => {
    const inp = bench.input;
    setSelectedFootingId(inp.id);
    setShape(inp.shape);
    setLength(inp.L);
    setWidth1(inp.B1);
    setWidth2(inp.B2);
    setThickness(inp.H);
    setSoilQall(inp.qall);
    setSoilKs(inp.Ks);
    setAnalysisMode(inp.analysisMode);
    setLinkedColumns(inp.columns);
  };

  return (
    <div id="combined-footing-module" className="grid grid-cols-1 lg:grid-cols-12 gap-6" dir="rtl">
      
      {/* 1. LEFT CONTROLS: MODELING INPUTS */}
      <div className="lg:col-span-4 space-y-6">
        {/* Footing Selection and CRUD Operations */}
        <Card className="shadow-lg border-indigo-200 dark:border-indigo-950 bg-indigo-50/5">
          <CardHeader className="py-3 px-4 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/20">
            <CardTitle className="text-sm font-bold text-indigo-900 flex items-center gap-1.5">
              <Database className="h-4 w-4 text-indigo-700" />
              إدارة وحفظ نماذج القواعد المشتركة
            </CardTitle>
            <CardDescription className="text-[10.5px]">
              توليد، حذف والتبديل بين القواعد المشتركة المصممة في المشروع.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 block">اختر القاعدة المشتركة النشطة للتعديل:</label>
              <div className="flex gap-1.5">
                <select
                  value={selectedFootingId}
                  onChange={e => setSelectedFootingId(e.target.value)}
                  className="flex-1 h-8 px-2 rounded border border-indigo-200 text-xs bg-white font-sans font-bold text-indigo-950"
                >
                  {combinedFootingsInDb.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.id})</option>
                  ))}
                </select>
                <Button
                  onClick={handleAddNewCombined}
                  size="sm"
                  variant="outline"
                  className="h-8 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 text-[11px] font-bold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  إضافة ومحاكاة
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 pt-1.5 border-t border-indigo-100 dark:border-indigo-900">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] block text-slate-500 mb-1">تعديل المسمى الإنشائي:</label>
                  <Input
                    type="text"
                    value={combinedFootingsInDb.find(f => f.id === selectedFootingId)?.name || ''}
                    onChange={e => saveFootingToDb({ name: e.target.value })}
                    className="h-8 text-xs font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleDeleteCombined}
                    size="sm"
                    variant="outline"
                    className="h-8 w-full border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 flex items-center justify-center gap-1 text-[11px] font-bold"
                    disabled={combinedFootingsInDb.length <= 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف القاعدة النشطة
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                توصيف القاعدة المشتركة
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                ACI 318-19
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500">
              نمذجة الأساس وتحديد تباعدات الأعمدة وخيارات التدعيم
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 pt-4">
            
            {/* Automatic combine from structural model */}
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                دمج سريع للأعمدة من النموذج ثلاثي الأبعاد
              </span>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-slate-500 block">العمود الأول</label>
                  <Select value={col1Select} onValueChange={setCol1Select}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="اختر العمود" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.filter(c => !c.isRemoved && (!fdnAssignments || !fdnAssignments[c.id] || fdnAssignments[c.id] === 'combined')).map(col => (
                        <SelectItem key={col.id} value={col.id} className="text-xs">{col.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block">العمود الثاني</label>
                  <Select value={col2Select} onValueChange={setCol2Select}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="اختر العمود" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.filter(c => !c.isRemoved && c.id !== col1Select && (!fdnAssignments || !fdnAssignments[c.id] || fdnAssignments[c.id] === 'combined')).map(col => (
                        <SelectItem key={col.id} value={col.id} className="text-xs">{col.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={handleAutoCombineColumns} 
                className="w-full h-8 text-xs bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"
                disabled={!col1Select || !col2Select}
              >
                <Calculator className="h-3.5 w-3.5" />
                توليد القاعدة المشتركة تلقائياً
              </Button>
            </div>

            {/* Geometry */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">الأبعاد الهندسية (ملم)</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">الشكل العام</label>
                  <Select value={shape} onValueChange={(val: any) => { setShape(val); saveFootingToDb({ shape: val }); }}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rectangular">مستطيل (Rectangular)</SelectItem>
                      <SelectItem value="trapezoidal">شبه منحرف (Trapezoidal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">الطول الإجمالي L</label>
                  <Input 
                    type="number" 
                    value={length} 
                    onChange={e => { const v = Number(e.target.value); setLength(v); saveFootingToDb({ L: v }); }}
                    className="h-9 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">العرض B1 (الأيسر)</label>
                  <Input 
                    type="number" 
                    value={width1} 
                    onChange={e => { const v = Number(e.target.value); setWidth1(v); saveFootingToDb({ B1: v }); }}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                {shape === 'trapezoidal' && (
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">العرض B2 (الأيمن)</label>
                    <Input 
                      type="number" 
                      value={width2} 
                      onChange={e => { const v = Number(e.target.value); setWidth2(v); saveFootingToDb({ B2: v }); }}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                )}
                <div className={shape === 'rectangular' ? "col-span-2" : ""}>
                  <label className="text-xs text-slate-500 block mb-1">السمك الكلي H</label>
                  <Input 
                    type="number" 
                    value={thickness} 
                    onChange={e => { const v = Number(e.target.value); setThickness(v); saveFootingToDb({ H: v }); }}
                    className="h-9 text-xs font-mono text-indigo-600 font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Geotechnical */}
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">المعاملات الجيوتقنية والتحليل</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">تحمل التربة المسموح (kPa)</label>
                  <Input 
                    type="number" 
                    value={soilQall} 
                    onChange={e => { const v = Number(e.target.value); setSoilQall(v); saveFootingToDb({ qall: v }); }}
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">نموذج التحليل</label>
                  <Select value={analysisMode} onValueChange={(val: any) => { setAnalysisMode(val); saveFootingToDb({ analysisMode: val }); }}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rigid">تحليل جاسئ (Rigid Static)</SelectItem>
                      <SelectItem value="winkler">نوابض إلستيكية (Winkler FEA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sizing optimizer */}
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50 space-y-2">
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-emerald-600" />
                مُحسِّن الأبعاد التلقائي (Centroid Fix)
              </span>
              <div className="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" 
                  id="leftFixedChk"
                  checked={leftFixed}
                  onChange={e => setLeftFixed(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <label htmlFor="leftFixedChk" className="text-xs text-slate-600 dark:text-slate-400">
                  تثبيت overhang العمود الأيسر (حالة خط جوار)
                </label>
              </div>
              <Button 
                onClick={handleAutoSizingSolve} 
                className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
              >
                <Play className="h-3 w-3" />
                تحسين وموازنة الضغوط تلقائياً
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* 2. RIGHT COMPONENT: VISUALIZATION & STRUCTURAL AUDITS */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Top Mini KPI Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-50/50 dark:bg-slate-900 border-b-2 border-b-indigo-500">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">إجهاد التربة الأقصى</span>
              <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white block mt-1">
                {activeResult.maxPressure} <span className="text-xs text-slate-400">kPa</span>
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                {activeResult.isPressureSafe ? (
                  <Badge className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold text-[9px] py-0 px-1">آمن</Badge>
                ) : (
                  <Badge className="bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold text-[9px] py-0 px-1">حرج</Badge>
                )}
                الحد: {activeResult.input.qall} kPa
              </span>
            </CardContent>
          </Card>

          <Card className="bg-slate-50/50 dark:bg-slate-900 border-b-2 border-b-indigo-500">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">عزم القمة الأقصى (مذاد)</span>
              <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white block mt-1">
                {Math.abs(activeResult.maxNegativeMoment).toFixed(1)} <span className="text-xs text-slate-400">kN·m</span>
              </span>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                موقع البؤرة: x = {activeResult.maxNegativeMomentX} م
              </span>
            </CardContent>
          </Card>

          <Card className="bg-slate-50/50 dark:bg-slate-900 border-b-2 border-b-indigo-500">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">قص الاتجاه الواحد</span>
              <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white block mt-1">
                {activeResult.oneWayShears[0] ? activeResult.oneWayShears[0].ratio : '0.00'}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                {activeResult.oneWayShears.every(o => o.isSafe) ? (
                  <Badge className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold text-[9px] py-0 px-1">آمن</Badge>
                ) : (
                  <Badge className="bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold text-[9px] py-0 px-1">تصميم حرج</Badge>
                )}
                معدل الجاسئية الفعلي
              </span>
            </CardContent>
          </Card>

          <Card className="bg-slate-50/50 dark:bg-slate-900 border-b-2 border-b-indigo-500">
            <CardContent className="p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">مقاومة الثقب (Punching)</span>
              <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white block mt-1">
                {activeResult.punchingAudits[0] ? activeResult.punchingAudits[0].ratio : '0.00'}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                {activeResult.punchingAudits.every(p => p.isSafe) ? (
                  <Badge className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold text-[9px] py-0 px-1">آمن</Badge>
                ) : (
                  <Badge className="bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold text-[9px] py-0 px-1">غير آمن</Badge>
                )}
                حول الأعمدة والأرجل
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Major Visual Tab Suite */}
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <Tabs value={activeVisualTab} onValueChange={(val: any) => setActiveVisualTab(val)}>
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center justify-between">
              <TabsList className="bg-slate-200/60 dark:bg-slate-850">
                <TabsTrigger value="layout" className="text-xs">مخطط التأسيس (Plan View)</TabsTrigger>
                <TabsTrigger value="diagrams" className="text-xs">المخططات الإنشائية (Diagrams)</TabsTrigger>
                <TabsTrigger value="rebar" className="text-xs">تفاصيل التسليح (Rebar Section)</TabsTrigger>
                <TabsTrigger value="benchmarks" className="text-xs">نماذج المعايرة (Benchmarks)</TabsTrigger>
              </TabsList>
              <Badge variant="outline" className="text-xs font-mono">
                L = {length} mm | B1 = {width1} mm
              </Badge>
            </div>

            <CardContent className="p-6">
              
              {/* TAB 1: BASE PLAN LAYOUT (SVG BLUEPRINT DRAWING) */}
              <TabsContent value="layout" className="mt-0 space-y-4">
                <div className="bg-slate-950 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-800 relative min-h-[300px]">
                  <span className="absolute top-3 left-3 text-[10px] font-mono text-slate-500">CAD-Style Base Plan Layout</span>
                  
                  {/* SVG Blueprint */}
                  <svg viewBox="0 0 600 300" className="w-full max-w-[550px] overflow-visible">
                    {/* Grids / Guidelines */}
                    <line x1="50" y1="150" x2="550" y2="150" stroke="#334155" strokeDasharray="5,5" strokeWidth="1" />
                    <line x1="150" y1="50" x2="150" y2="250" stroke="#334155" strokeDasharray="5,5" strokeWidth="1" />
                    <line x1="450" y1="50" x2="450" y2="250" stroke="#334155" strokeDasharray="5,5" strokeWidth="1" />

                    {/* Footing Outline (rectangular or trapezoidal) */}
                    {shape === 'rectangular' ? (
                      <rect x="50" y="75" width="500" height="150" fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth="2.5" />
                    ) : (
                      <polygon points="50,60 550,85 550,215 50,240" fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth="2.5" />
                    )}

                    {/* Left and Right width labels */}
                    <text x="35" y="155" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="end">B1 = {width1} ملم</text>
                    {shape === 'trapezoidal' && (
                      <text x="565" y="155" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="start">B2 = {width2} ملم</text>
                    )}

                    {/* Grid Dimensions */}
                    <path d="M 50,260 L 50,268 M 550,260 L 550,268 M 50,264 L 550,264" stroke="#64748b" strokeWidth="1" />
                    <text x="300" y="278" fill="#94a3b8" fontSize="10" textAnchor="middle">L = {length} ملم</text>

                    {/* Overhangs & Column spacing */}
                    <path d="M 50,235 L 50,243 M 150,235 L 150,243 M 450,235 L 450,243 M 550,235 L 550,243" stroke="#475569" strokeWidth="1" />
                    <text x="100" y="248" fill="#64748b" fontSize="8" textAnchor="middle">a1 = {linkedColumns[0]?.x} ملم</text>
                    <text x="300" y="248" fill="#64748b" fontSize="8" textAnchor="middle">S = {(linkedColumns[1]?.x - linkedColumns[0]?.x) || 0} ملم</text>
                    <text x="500" y="248" fill="#64748b" fontSize="8" textAnchor="middle">a2 = {length - (linkedColumns[1]?.x || 0)} ملم</text>

                    {/* Punching perimeter outline */}
                    {activeResult.punchingAudits.map((p, idx) => {
                      const colX = 50 + (p.x / L_m) * 500;
                      const radL = (p.bo / 4) / 10; // scaled
                      return (
                        <rect 
                          key={`bo-${idx}`}
                          x={colX - radL} 
                          y={150 - radL} 
                          width={radL * 2} 
                          height={radL * 2} 
                          fill="none" 
                          stroke="#e11d48" 
                          strokeWidth="1.5" 
                          strokeDasharray="4,3" 
                        />
                      );
                    })}

                    {/* Column 1 Graphic */}
                    {linkedColumns[0] && (
                      <g>
                        <rect x="135" y="135" width="30" height="30" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                        <text x="150" y="125" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">{linkedColumns[0].name}</text>
                        <text x="150" y="180" fill="#94a3b8" fontSize="8" textAnchor="middle">P_u={Math.round(1.2*linkedColumns[0].PDead + 1.6*linkedColumns[0].PLive)} kN</text>
                      </g>
                    )}

                    {/* Column 2 Graphic */}
                    {linkedColumns[1] && (
                      <g>
                        <rect x="435" y="135" width="30" height="30" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                        <text x="450" y="125" fill="#f8fafc" fontSize="11" fontWeight="bold" textAnchor="middle">{linkedColumns[1].name}</text>
                        <text x="450" y="180" fill="#94a3b8" fontSize="8" textAnchor="middle">P_u={Math.round(1.2*linkedColumns[1].PDead + 1.6*linkedColumns[1].PLive)} kN</text>
                      </g>
                    )}
                  </svg>
                </div>
                
                {/* Geometrical Parameters Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">توزيع كتلة الأساس والمقاومة</span>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>مساحة التأسيس الإجمالية (Area)</span>
                      <span className="font-mono font-bold">{activeResult.area} م²</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>إجمالي وزن الخرسانة الذاتي (Footing Weight)</span>
                      <span className="font-mono font-bold">{activeResult.weight} kN</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>مركز المساحة الكلي (Footing Centroid)</span>
                      <span className="font-mono font-bold">{activeResult.centroidX} م من الطرف الأيسر</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 font-bold">محصلة الأحمال واللامركزية</span>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>إجمالي الأحمال الرأسية المُحولة</span>
                      <span className="font-mono font-bold">{activeResult.totalVerticalLoad} kN</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>مركز الأحمال الفعلي (Load Centroid)</span>
                      <span className="font-mono font-bold text-indigo-600">{activeResult.loadCentroidX} م من اليسار</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>معامل اللامركزية الافتراضي (Eccentricity e)</span>
                      <span className={Math.abs(activeResult.eccentricityX) > 0.1 ? "font-mono font-bold text-rose-600" : "font-mono font-bold text-emerald-600"}>
                        {activeResult.eccentricityX} م {Math.abs(activeResult.eccentricityX) > 0.1 ? '⚠️ لامركزية حرجة' : '✓ مطابقة تامة'}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: SHEAR & BENDING FORCE DIAGRAMS */}
              <TabsContent value="diagrams" className="mt-0 space-y-4">
                <span className="text-xs text-slate-500 font-bold block mb-2">أشكال قوي القص ועזوم الانحناء وعزوم التربة الناتجة على طول الأساس</span>
                
                {/* 1. Soil Pressure / BMD Diagram */}
                <div className="h-64 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="x" label={{ value: 'المسافة على طول الأساس L (م)', position: 'insideBottom', offset: -5 }} />
                      <YAxis yAxisId="left" label={{ value: 'إجهاد التربة وعزوم الانحناء', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" label={{ value: 'قوى القص (kN)', angle: 90, position: 'insideRight' }} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="إجهاد التربة (kPa)" stroke="#ea580c" strokeWidth={2} name="سلوك إجهاد التربة (kPa)" />
                      <Line yAxisId="left" type="monotone" dataKey="عزم الانحناء (kN.m)" stroke="#6366f1" strokeWidth={2.5} name="عزم الانحناء (kN·m)" />
                      <Line yAxisId="right" type="monotone" dataKey="قوة القص (kN)" stroke="#06b6d4" strokeWidth={1.5} name="قوة القص (kN)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Diagrams Statistics list */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <span className="text-slate-500 block">عزم القمة الأقصى (شد للعلوي)</span>
                    <span className="font-mono text-base font-black text-indigo-600 block">{Math.abs(activeResult.maxNegativeMoment).toFixed(1)} kN·m</span>
                    <span className="text-[10px] text-slate-400">عند المسافة: x = {activeResult.maxNegativeMomentX} م</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 block">عزم القاع الأقصى (شد للسفلي)</span>
                    <span className="font-mono text-base font-black text-indigo-600 block">+{activeResult.maxPositiveMoment.toFixed(1)} kN·m</span>
                    <span className="text-[10px] text-slate-400">عند المسافة: x = {activeResult.maxPositiveMomentX} م</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 block">قوة القص العظمى المنتقلة (Vu)</span>
                    <span className="font-mono text-base font-black text-cyan-600 block">{activeResult.maxShear.toFixed(1)} kN</span>
                    <span className="text-[10px] text-slate-400">عند المسافة: x = {activeResult.maxShearX} م</span>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: REINFORCIMENT DETAIL VIEW */}
              <TabsContent value="rebar" className="mt-0 space-y-4">
                <div className="bg-slate-950 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-800 relative min-h-[300px]">
                  <span className="absolute top-3 left-3 text-[10px] font-mono text-slate-500">CAD Longitudinal Rebar Details Section</span>
                  
                  {/* Section Draw */}
                  <svg viewBox="0 0 600 220" className="w-full max-w-[550px]" overflow="visible">
                    {/* Concrete outline */}
                    <rect x="50" y="80" width="500" height="70" fill="none" stroke="#64748b" strokeWidth="2.5" />
                    
                    {/* Ground line */}
                    <line x1="20" y1="40" x2="580" y2="40" stroke="#854d0e" strokeWidth="2" />
                    <text x="30" y="32" fill="#854d0e" fontSize="8" fontWeight="bold">NGL (منسوب التربة)</text>

                    {/* Left Column starters */}
                    <g>
                      <rect x="135" y="30" width="30" height="50" fill="none" stroke="#64748b" strokeWidth="1.5" />
                      {/* vertical starters rebar */}
                      <path d="M 140,20 L 140,95 L 148,95" fill="none" stroke="#ef4444" strokeWidth="2" />
                      <path d="M 160,20 L 160,95 L 152,95" fill="none" stroke="#ef4444" strokeWidth="2" />
                    </g>

                    {/* Right Column starters */}
                    <g>
                      <rect x="435" y="30" width="30" height="50" fill="none" stroke="#64748b" strokeWidth="1.5" />
                      <path d="M 440,20 L 440,95 L 448,95" fill="none" stroke="#ef4444" strokeWidth="2" />
                      <path d="M 460,20 L 460,95 L 452,95" fill="none" stroke="#ef4444" strokeWidth="2" />
                    </g>

                    {/* Rebar limits Top Grid */}
                    <path d="M 55,90 L 545,90 M 55,90 L 55,100 M 545,90 L 545,100" fill="none" stroke="#10b981" strokeWidth="2.5" />
                    <text x="300" y="105" fill="#34d399" fontSize="10" fontWeight="black" textAnchor="middle">الشبكة العلوية: {activeResult.topSteelBarText}</text>
                    
                    {/* Rebar limits Bottom Grid */}
                    <path d="M 55,140 L 545,140 M 55,140 L 55,130 M 545,140 L 545,130" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                    <text x="300" y="132" fill="#60a5fa" fontSize="10" fontWeight="black" textAnchor="middle">الشبكة السفلية: {activeResult.botSteelBarText}</text>

                    {/* Stirrups hooks indicator */}
                    <line x1="200" y1="90" x2="200" y2="140" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
                    <text x="210" y="117" fill="#94a3b8" fontSize="8">{activeResult.transverseSteelText}</text>
                    
                    {/* Dimensions Labels */}
                    <text x="350" y="70" fill="#94a3b8" fontSize="9" textAnchor="middle">سمك القاعدة H = {thickness} مم</text>
                  </svg>
                </div>

                {/* Sized Steel Specifications */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                    <span className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      الحديد الطولي العلوي (Top Longitudinal Grid)
                    </span>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>مساحة الحديد المطلوبة (As req)</span>
                      <span className="font-mono font-bold text-emerald-600">{activeResult.topSteelAreaReq} مم²</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>التركيب الفعلي المقترح</span>
                      <span className="font-bold">{activeResult.topSteelBarText}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                    <span className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      الحديد الطولي السفلي (Bottom Longitudinal Grid)
                    </span>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>مساحة الحديد المطلوبة (As req)</span>
                      <span className="font-mono font-bold text-blue-600">{activeResult.botSteelAreaReq} مم²</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span>التركيب الفعلي المقترح</span>
                      <span className="font-bold">{activeResult.botSteelBarText}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 4: BENCHMARK CHECKS */}
              <TabsContent value="benchmarks" className="mt-0 space-y-4">
                <span className="text-xs text-slate-500 font-bold block">نماذج المعايرة للتأكد من المرجعية والدقة وفق الكود الأمريكي ACI 318</span>
                <div className="space-y-3">
                  {benchmarks.map((b, idx) => (
                    <div key={b.input.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{b.title}</span>
                        <Button 
                          onClick={() => handleApplyBenchmark(b)} 
                          className="h-7 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-900 dark:text-white"
                        >
                          تحميل للمحاكي
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed font-mono">
                         معايير المطابقة: {b.expected}
                      </p>
                    </div>
                  ))}
                </div>
              </TabsContent>

            </CardContent>
          </Tabs>
        </Card>

        {/* Detailed Compliance Audits Panel */}
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 py-3">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              تدقيق الأمان والامتثال (ACI 318 Audits Check)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              
              {/* Punching Shear List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">1. التحقق من قص الاختراق الافتراضي (Two-Way Punching Shear Audit)</span>
                <Table className="text-xs text-right border dark:border-slate-800">
                  <TableHeader className="bg-slate-100 dark:bg-slate-800">
                    <TableRow>
                      <TableHead>العمود</TableHead>
                      <TableHead>المحيط bo</TableHead>
                      <TableHead>قوة الثقب Vu</TableHead>
                      <TableHead>الحد الأقصى φVc</TableHead>
                      <TableHead>النسبة D/C</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeResult.punchingAudits.map((audit, idx) => (
                      <TableRow key={`punch-${idx}`}>
                        <TableCell className="font-bold">{audit.columnName}</TableCell>
                        <TableCell className="font-mono">{audit.bo} مم</TableCell>
                        <TableCell className="font-mono">{audit.Vu} kN</TableCell>
                        <TableCell className="font-mono">{audit.phiVc} kN</TableCell>
                        <TableCell className="font-mono font-bold text-indigo-700">{audit.ratio}</TableCell>
                        <TableCell>
                          {audit.isSafe ? (
                            <Badge className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">آمن (Safe)</Badge>
                          ) : (
                            <Badge className="bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold">حرج (Unsafe)</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Quantities & QS Breakdown */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">2. حصر المواد والتقدير المبدئي (Bill of Quantities takeoff - BOQ)</span>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border">
                    <span className="text-slate-400 block">حجم الخرسانة المسلحة</span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm block mt-0.5">{activeResult.concreteVol} م³</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border">
                    <span className="text-slate-400 block">وزن حديد التسليح</span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm block mt-0.5">{activeResult.steelWeightKg} كجم</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border">
                    <span className="text-slate-400 block">مسطح نجارة الشدات</span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm block mt-0.5">{activeResult.formworkArea} م²</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border">
                    <span className="text-slate-400 block">حجم الحفر التقديري</span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm block mt-0.5">{activeResult.excavationVol} م³</span>
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border col-span-2 md:col-span-1">
                    <span className="text-slate-400 block">حجم ردم الفراغات</span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-sm block mt-0.5">{activeResult.backfillVol} م³</span>
                  </div>
                </div>
              </div>

              {/* Warnings & Diagnostics */}
              {activeResult.warnings.length > 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-900/50 space-y-1">
                  <span className="text-xs font-bold text-rose-950 dark:text-rose-200 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    المقترحات والمخاطر الإنشائية المرصودة:
                  </span>
                  <ul className="list-disc list-inside text-[11px] text-rose-750 dark:text-rose-300 pr-2 space-y-1">
                    {activeResult.warnings.map((warn, index) => (
                      <li key={index}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </CardContent>
        </Card>

      </div>

    </div>
  );
}

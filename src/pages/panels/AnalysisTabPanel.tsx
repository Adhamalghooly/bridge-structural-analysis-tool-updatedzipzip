import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Calculator, BarChart3, Ruler, Layers, Activity, RotateCcw,
  Search, CheckSquare, Download, Zap, Loader2, X as XIcon, Check, Compass,
} from 'lucide-react';
import type { AppAction, AppState } from '@/pages/indexReducer';
import { StorySelector } from '@/components/StorySelector';
import ETABSComparisonTable from '@/components/ETABSComparisonTable';
import LoadComparisonPanel from '@/components/LoadComparisonPanel';
import FEMComparisonPanel from '@/components/FEMComparisonPanel';
import ETABSImportPanel from '@/components/ETABSImportPanel';
import BeamLoadDiagrams from '@/components/BeamLoadDiagrams';
import SlabAnalysisPanel from '@/components/SlabAnalysisPanel';
import SlabLoadDiagnosticPanel from '@/components/SlabLoadDiagnosticPanel';
import AdvancedAnalysisPanel from '@/components/AdvancedAnalysisPanel';
import AnalysisDiagnosticsPanel from '@/components/AnalysisDiagnosticsPanel';
import ManualConnectionManager from '@/components/ManualConnectionManager';
import { Checkbox } from '@/components/ui/checkbox';
import { ENGINE_LABELS, type EngineType } from '@/lib/analysisController';
import { extractRawStations, buildRawStationsCSV, downloadCSV, type EngineRawStations } from '@/lib/rawMomentStationsExporter';
import type { Slab, Column, Story, Beam } from '@/lib/structuralEngine';
import { generateFrames } from '@/lib/structuralEngine';
import { runPreAnalysisChecks } from '@/core/validation/preAnalysisValidator';
import type { ValidationReport } from '@/core/validation/preAnalysisValidator';

interface AnalysisTabPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  columns: any[];
  beams: any[];
  beamsWithLoads: any[];
  isAllStories: boolean;
  storyFilteredSlabs: Slab[];
  getStoryLabel: (storyId?: string) => string;
  frameResults: any[];
  frameResults2D: any[];
  frameResults3DRaw: any[];
  frameResultsGF: any[];
  frameResultsUC: any[];
  connectionManagerOpen: boolean;
  setConnectionManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  checkAndRemoveDuplicates: () => void;
  dupCheckResult: { message: string; count: number; items: string[] } | null;
  setDupCheckResult: React.Dispatch<React.SetStateAction<{ message: string; count: number; items: string[] } | null>>;
  femError: string | null;
  setFemError: React.Dispatch<React.SetStateAction<string | null>>;
  detectedConnections: any[];
  runAnalysis: () => void;
  jointConnectivity: any;
  colLoadsBiaxial: any;
  beamHingesMap: any;
  colDesigns: any[];
  splitBeamGroups: Record<string, string[]>;
  getBeamReleaseState: (beam: any) => any;
  handleAnalysisElementClick: (beamId: string) => void;
  colLoads3D: any;
}

const AnalysisTabPanel: React.FC<AnalysisTabPanelProps> = ({
  state, dispatch,
  columns, beams, beamsWithLoads, isAllStories, storyFilteredSlabs, getStoryLabel,
  frameResults, frameResults2D, frameResults3DRaw, frameResultsGF, frameResultsUC,
  connectionManagerOpen, setConnectionManagerOpen,
  checkAndRemoveDuplicates,
  dupCheckResult, setDupCheckResult,
  femError, setFemError,
  detectedConnections, runAnalysis, jointConnectivity, colLoadsBiaxial, beamHingesMap,
  colDesigns, splitBeamGroups, getBeamReleaseState, handleAnalysisElementClick, colLoads3D,
}) => {
  const {
    stories, selectedStoryId, slabs, mat, slabProps, beamB, beamH, colB, colH,
    analyzed, selectedEngine, ignoreSlab, beamStiffnessFactor, colStiffnessFactor,
    etabsAnalysisData, bobConnections, colRigidEndOffsets, ribbedSlabProps,
    frameResults: rawFrameResults, supportRestraints, manualJointOverrides,
    bobManualPrimary, removedColumnIds,
  } = state;

  const frames = React.useMemo(() => generateFrames(beamsWithLoads), [beamsWithLoads]);

  const [validationReport, setValidationReport] = React.useState<ValidationReport | null>(null);
  const [validationRunning, setValidationRunning] = React.useState(false);
  const [biaxialSelectedCols, setBiaxialSelectedCols] = React.useState<Set<string>>(new Set());
  const [biaxialStoryFilter, setBiaxialStoryFilter] = React.useState<string>('');
  const [rotatedColIds, setRotatedColIds] = React.useState<Set<string>>(new Set());

  return (
                <Tabs defaultValue="analysis-main" className="flex-1 flex flex-col h-full overflow-hidden">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/30 px-2 shrink-0 h-auto overflow-x-auto flex-nowrap">
                <TabsTrigger value="analysis-main" className="text-[11px] gap-1 min-h-[36px] shrink-0 whitespace-nowrap"><Calculator size={12} />التحليل الرئيسي</TabsTrigger>
                <TabsTrigger value="analysis-compare" className="text-[11px] gap-1 min-h-[36px] shrink-0 whitespace-nowrap text-blue-600 dark:text-blue-400"><BarChart3 size={12} />مقارنة توزيع الأحمال</TabsTrigger>
                <TabsTrigger value="analysis-fem-compare" className="text-[11px] gap-1 min-h-[36px] shrink-0 whitespace-nowrap text-emerald-600 dark:text-emerald-400"><BarChart3 size={12} />Comparison</TabsTrigger>
                <TabsTrigger value="analysis-etabs-import" className="text-[11px] gap-1 min-h-[36px] shrink-0 whitespace-nowrap text-orange-600 dark:text-orange-400"><BarChart3 size={12} />مقارنة ETABS</TabsTrigger>
                <TabsTrigger value="analysis-beam-loads" className="text-[11px] gap-1 min-h-[36px] shrink-0 whitespace-nowrap text-purple-600 dark:text-purple-400"><Ruler size={12} />أحمال الجسور</TabsTrigger>
                <TabsTrigger value="analysis-slab" className="text-[11px] gap-1 min-h-[36px] shrink-0 whitespace-nowrap text-teal-600 dark:text-teal-400"><Layers size={12} />تحليل البلاطات</TabsTrigger>
                <TabsTrigger value="analysis-slab-load-diag" className="text-[11px] gap-1 min-h-[36px] shrink-0 whitespace-nowrap text-cyan-600 dark:text-cyan-400"><Activity size={12} />تشخيص نقل أحمال البلاطة</TabsTrigger>
                <TabsTrigger value="analysis-biaxial" className="text-[11px] gap-1 min-h-[36px] shrink-0 whitespace-nowrap text-orange-600 dark:text-orange-400"><RotateCcw size={12} />الأعمدة ثنائية المحور</TabsTrigger>
              </TabsList>
              <TabsContent value="analysis-main" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
            {/* ── Analysis Engine Selector ──────────────────────────────── */}
            <Card className="mb-3 border-blue-200 dark:border-blue-800 bg-blue-500/5">
              <CardContent className="py-3 px-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Zap size={14} className="text-blue-500 shrink-0" />
                  <span className="text-xs font-semibold text-foreground">محرك التحليل</span>
                  <select
                    className="h-8 rounded border border-input bg-background px-2 text-xs flex-1 min-w-[160px] max-w-[240px]"
                    value={selectedEngine}
                    onChange={e => {
                      dispatch({ type: 'SET_ENGINE', engine: e.target.value as EngineType });
                      setFemError(null);
                    }}
                  >
                    <option value="legacy_2d">2D — طريقة صلابة المصفوفة (كلاسيكي)</option>
                    <option value="legacy_3d">3D Unified — محرك ثلاثي الأبعاد موحّد (Legacy + GF + UC)</option>
                    <option value="fem_coupled">FEM (Coupled) — جسور-بلاطات مقترن</option>
                  </select>
                  <Badge
                    className={`text-[10px] shrink-0 ${
                      selectedEngine === 'fem_coupled'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400/40'
                        : selectedEngine === 'legacy_2d'
                          ? 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-400/40'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-400/40'
                    }`}
                  >
                    {ENGINE_LABELS[selectedEngine]}
                  </Badge>
                  {selectedEngine === 'fem_coupled' && !ignoreSlab && (
                    <span className="text-[10px] text-muted-foreground">
                      يتطلب وجود بلاطات وأعمدة — يستغرق وقتاً أطول
                    </span>
                  )}
                </div>

                {/* ── خيار توزيع أحمال البلاطات بطريقة FEM ── */}
                <div className="mt-3 pt-3 border-t border-border/50">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={state.useFEMLoadDistribution ?? false}
                        onChange={e => dispatch({ type: 'SET_USE_FEM_LOAD_DISTRIBUTION', value: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 ${
                        state.useFEMLoadDistribution
                          ? 'bg-purple-600'
                          : 'bg-muted-foreground/30'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                          state.useFEMLoadDistribution ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          توزيع أحمال البلاطات بطريقة FEM (بدل خطوط الخضوع)
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          state.useFEMLoadDistribution
                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-400/40'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {state.useFEMLoadDistribution ? 'مُفعّل' : 'غير مُفعّل'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        يُستخدم تحليل عناصر محدودة (مكافئ لـ ETABS) لتوزيع أحمال البلاطات على الجسور الحاملة لزيادة الدقة بدلاً من مساحات التأثير.
                      </p>
                    </div>
                  </label>
                </div>

                {/* ── زر إهمال جساءة البلاطات ── */}
                <div className="mt-3 pt-3 border-t border-border/50">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={ignoreSlab}
                        onChange={e => dispatch({ type: 'SET_IGNORE_SLAB', value: e.target.checked })}
                        className="sr-only"
                      />
                      <div
                        onClick={() => dispatch({ type: 'SET_IGNORE_SLAB', value: !ignoreSlab })}
                        className={`w-9 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${
                          ignoreSlab
                            ? 'bg-amber-500'
                            : 'bg-muted border border-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                          ignoreSlab ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          إهمال جساءة البلاطات
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          ignoreSlab
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-400/40'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          {ignoreSlab ? 'مُفعّل' : 'غير مُفعّل'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                        {ignoreSlab
                          ? '⚠️ البلاطات تنقل الأحمال فقط — الجسور والأعمدة تحمل كل الجساءة (مطابق لـ ETABS "No Slab Stiffness")'
                          : 'البلاطات تُشارك في الجساءة الإنشائية للإطار (التحليل الكامل المقترن)'}
                      </p>
                      {ignoreSlab && selectedEngine === 'fem_coupled' && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                          ↳ سيُستخدم محرك 3D (إطار نقي) مع أحمال المنطقة التأثيرية
                        </p>
                      )}
                    </div>
                  </label>

                  {/* معاملات تخفيض الجساءة — قابلة للتعديل */}
                  <div className="mt-2 rounded-md bg-blue-500/5 border border-blue-200/50 dark:border-blue-800/50 px-3 py-2">
                    <p className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold mb-1">
                      معاملات تخفيض الجساءة (ACI 318-19 §6.6.3):
                    </p>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                      <div className="rounded bg-background border border-border px-1 py-1">
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="1.0"
                          value={beamStiffnessFactor}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 0.1 && v <= 1.0) dispatch({ type: 'SET_BEAM_STIFFNESS_FACTOR', value: v });
                          }}
                          className="w-full text-center font-bold text-foreground bg-transparent border-none outline-none text-[11px] p-0"
                        />
                        <div className="text-muted-foreground">جسور</div>
                      </div>
                      <div className="rounded bg-background border border-border px-1 py-1">
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="1.0"
                          value={colStiffnessFactor}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 0.1 && v <= 1.0) dispatch({ type: 'SET_COL_STIFFNESS_FACTOR', value: v });
                          }}
                          className="w-full text-center font-bold text-foreground bg-transparent border-none outline-none text-[11px] p-0"
                        />
                        <div className="text-muted-foreground">أعمدة</div>
                      </div>
                      <div className={`rounded border px-1 py-1 ${ignoreSlab ? 'bg-amber-500/10 border-amber-400/40' : 'bg-background border-border'}`}>
                        <div className={`font-bold ${ignoreSlab ? 'text-amber-600 dark:text-amber-400 line-through' : 'text-foreground'}`}>
                          {ignoreSlab ? '0' : '0.25'}
                        </div>
                        <div className="text-muted-foreground">بلاطات</div>
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-1">
                      غيّر القيم أعلاه للتحكم بجساءة الجسور والأعمدة عند التحليل
                    </p>
                  </div>

                  {/* إزاحات النهايات الصلبة (ETABS End Length Offsets) */}
                  <div className="mt-2 rounded-md bg-orange-500/5 border border-orange-200/50 dark:border-orange-800/50 px-3 py-2">
                    <p className="text-[10px] text-orange-700 dark:text-orange-400 font-semibold mb-1">
                      إزاحات النهايات الصلبة (ETABS End Length Offsets):
                    </p>
                    <p className="text-[9px] text-muted-foreground mb-2 leading-relaxed">
                      تُقلِّص البحر الفعّال للجسر إلى حافة العمود بدلاً من مركزه — تُقلِّل العزوم عند الوجوه.
                    </p>
                    {columns.filter(c => !c.isRemoved).length === 0 ? (
                      <p className="text-[9px] text-muted-foreground italic">لا توجد أعمدة</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="mb-1.5 text-[9px] px-2 py-0.5 rounded border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                          onClick={() => {
                            const allCols = columns.filter(c => !c.isRemoved);
                            const allEnabled = allCols.every(c => colRigidEndOffsets[c.id]);
                            allCols.forEach(c => dispatch({ type: 'SET_COL_RIGID_OFFSET', colId: c.id, enabled: !allEnabled }));
                          }}
                        >
                          {columns.filter(c => !c.isRemoved).every(c => colRigidEndOffsets[c.id]) ? '⬜ إلغاء الكل' : '☑ تفعيل الكل'}
                        </button>
                        <div className="flex flex-wrap gap-1">
                          {columns.filter(c => !c.isRemoved).map(c => (
                            <label key={c.id} className="flex items-center gap-1 text-[9px] cursor-pointer select-none bg-background border border-border rounded px-1.5 py-0.5 hover:bg-accent/20 transition-colors">
                              <input
                                type="checkbox"
                                className="w-3 h-3 accent-orange-500"
                                checked={!!colRigidEndOffsets[c.id]}
                                onChange={e => dispatch({ type: 'SET_COL_RIGID_OFFSET', colId: c.id, enabled: e.target.checked })}
                              />
                              <span className="font-mono">{c.id} <span className="text-muted-foreground">({c.b}×{c.h})</span></span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {femError && (
                  <div className="mt-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                    ⚠️ {femError}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── تصدير عزوم 7 محطات (خام) من جميع المحركات ────────────── */}
            <Card className="mb-3 border-indigo-200 dark:border-indigo-800 bg-indigo-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Download size={14} className="text-indigo-500" />
                  تصدير عزوم 7 محطات (خام بدون معالجة)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  يصدّر العزوم عند 7 محطات (0, L/6, 2L/6, L/2, 4L/6, 5L/6, L) لكل جسر
                  من جميع المحركات (2D, 3D, GF, UC, FEM) <b>كما أنتجها المحرك تماماً</b> —
                  بدون قلب إشارة، وبدون فرض موجب في الوسط أو سالب عند الركيزة، وبدون قيمة مطلقة.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!analyzed}
                  onClick={() => {
                    const engines: EngineRawStations[] = [];
                    if (frameResults2D.length)    engines.push({ engine: '2D',  data: extractRawStations(frameResults2D,    beamsWithLoads) });
                    if (frameResults3DRaw.length) engines.push({ engine: '3D',  data: extractRawStations(frameResults3DRaw, beamsWithLoads) });
                    if (frameResultsGF.length)    engines.push({ engine: 'GF',  data: extractRawStations(frameResultsGF,    beamsWithLoads) });
                    if (frameResultsUC.length)    engines.push({ engine: 'UC',  data: extractRawStations(frameResultsUC,    beamsWithLoads) });
                    if (selectedEngine === 'fem_coupled' && frameResults.length) {
                      engines.push({ engine: 'FEM', data: extractRawStations(frameResults, beamsWithLoads) });
                    }
                    const csv = buildRawStationsCSV(engines);
                    const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    downloadCSV(`raw_moment_stations_${ts}.csv`, csv);
                  }}
                  className="w-full min-h-[40px]"
                >
                  <Download size={14} className="mr-2" />
                  تصدير CSV — عزوم 7 محطات لكل جسر (كل المحركات)
                </Button>
                {!analyzed && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    ⚠️ يجب تشغيل التحليل أولاً
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Duplicate Check Card - always visible */}
            <Card className="mb-3 border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search size={14} className="text-orange-500" />
                  فحص تكرار العناصر
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  يفحص هذا الأداء وجود جسور أو أعمدة أو بلاطات أو نقاط متكررة (نفس الإحداثيات)، ويحذف العنصر الأقدم تسمية تلقائياً ويُبقي الأحدث.
                </p>
                {dupCheckResult && (
                  <div className={`rounded-lg p-3 text-xs space-y-1 ${dupCheckResult.count === 0 ? 'bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400' : 'bg-orange-500/10 border border-orange-500/30 text-orange-800 dark:text-orange-300'}`}>
                    <p className="font-semibold">{dupCheckResult.message}</p>
                    {dupCheckResult.items.length > 0 && (
                      <ul className="mt-1 space-y-0.5 list-disc list-inside text-[11px] text-muted-foreground">
                        {dupCheckResult.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <Button
                  onClick={checkAndRemoveDuplicates}
                  variant="outline"
                  className="w-full min-h-[44px] border-orange-300 text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950"
                >
                  <Search size={14} className="mr-2" />
                  فحص التكرارات وحذفها
                </Button>
              </CardContent>
            </Card>

            {/* ── بطاقة التحقق من النموذج (Pre-Analysis Validation) ── */}
            <Card className="mb-3 border-teal-200 dark:border-teal-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckSquare size={14} className="text-teal-500" />
                  التحقق من سلامة النموذج
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  يفحص: العقد المكررة، العناصر الصفرية الطول، الاتصالية، الاستقرار، والعقد المعلقة.
                  الفحص يأخذ بالاعتبار الجسور المرتبطة بالأعمدة تلقائياً (داخل المقطع) واليدوياً.
                  إذا ظهر النموذج غير متصل، استخدم زر <span className="font-semibold text-blue-600">إدارة الاتصالات</span> لربط الجسور بالأعمدة يدوياً.
                </p>
                {validationReport && (
                  <div className={`rounded-lg p-3 text-xs space-y-2 ${
                    validationReport.status === 'ok'
                      ? 'bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400'
                      : validationReport.status === 'warning'
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300'
                        : 'bg-destructive/10 border border-destructive/30 text-destructive'
                  }`}>
                    <p className="font-semibold">
                      {validationReport.status === 'ok' ? '✅ النموذج سليم — جاهز للتحليل' :
                       validationReport.status === 'warning' ? '⚠️ النموذج به تحذيرات' :
                       '❌ النموذج به أخطاء تمنع التحليل'}
                    </p>
                    <div className="text-[10px] text-muted-foreground">
                      العقد المدمجة: {validationReport.mergedNodeMap.size > 0 ?
                        [...validationReport.mergedNodeMap.entries()].filter(([k, v]) => k !== v).length : 0}
                      {' | '}المكونات المتصلة: {validationReport.connectedComponents}
                    </div>
                    {validationReport.issues.map((issue, i) => (
                      <div key={i} className="mt-1">
                        {/* ── عرض عادي لجميع أنواع المشاكل عدا انفصال النموذج ── */}
                        {issue.type !== 'disconnected_model' && (
                          <>
                            <span className="font-medium">
                              {issue.type === 'duplicate_nodes' && `🔗 عقد مكررة: ${issue.count}`}
                              {issue.type === 'dangling_nodes' && `⚡ عقد معلقة: ${issue.count}`}
                              {issue.type === 'zero_length_elements' && `📏 عناصر صفرية الطول: ${issue.count}`}
                              {issue.type === 'no_supports' && `🏗️ لا توجد مساند`}
                              {issue.type === 'unstable_system' && `⚠️ تحذير استقرار`}
                            </span>
                            {issue.details && issue.details.length > 0 && (
                              <ul className="mt-0.5 space-y-0.5 list-disc list-inside text-[10px]">
                                {issue.details.slice(0, 5).map((d, j) => <li key={j}>{d}</li>)}
                                {issue.details.length > 5 && <li>... و{issue.details.length - 5} أخرى</li>}
                              </ul>
                            )}
                          </>
                        )}

                        {/* ── عرض تفصيلي لخطأ انفصال النموذج ── */}
                        {issue.type === 'disconnected_model' && (() => {
                          const colMap  = new Map(columns.filter(c => !c.isRemoved).map(c => [c.id, c]));
                          const beamMap = new Map(beams.map(b => [b.id, b]));
                          const storyMap = new Map(stories.map(s => [s.id, s.label]));
                          const comps   = issue.componentElements ?? [];
                          const maxSize = Math.max(...comps.map(c => c.length));

                          return (
                            <div className="space-y-2">
                              <span className="font-medium text-red-700 dark:text-red-400">
                                🔌 النموذج غير متصل — {issue.components} أجزاء منفصلة
                              </span>
                              <div className="space-y-1.5 mt-1">
                                {comps.map((compElems, idx) => {
                                  const isMain = compElems.length === maxSize;

                                  if (isMain) {
                                    const nCols  = compElems.filter(e => e.type === 'column').length;
                                    const nBeams = compElems.filter(e => e.type === 'beam').length;
                                    return (
                                      <div key={idx} className="text-[10px] text-muted-foreground border border-dashed border-border rounded px-2 py-1">
                                        ✅ الجزء الرئيسي — {nCols} عمود، {nBeams} جسر (الإطار المتصل)
                                      </div>
                                    );
                                  }

                                  // جزء معزول — فكّ رموز العناصر
                                  const isolCols = compElems
                                    .filter(e => e.type === 'column')
                                    .map(e => colMap.get(e.id.replace(/^col_/, '')))
                                    .filter((c): c is NonNullable<typeof c> => !!c);
                                  const isolBeams = compElems
                                    .filter(e => e.type === 'beam')
                                    .map(e => beamMap.get(e.id.replace(/^beam_/, '')))
                                    .filter((b): b is NonNullable<typeof b> => !!b);

                                  return (
                                    <div key={idx} className="rounded-lg border border-red-300 dark:border-red-800 bg-red-500/8 p-2 text-[10px] space-y-1">
                                      <div className="font-semibold text-red-700 dark:text-red-400">
                                        ⛔ جزء معزول {idx + 1} — {compElems.length} عنصر غير متصل بالإطار الرئيسي
                                      </div>

                                      {isolCols.length > 0 && (
                                        <div className="space-y-0.5">
                                          <div className="font-medium text-muted-foreground">الأعمدة المعزولة:</div>
                                          {isolCols.map((c, ci) => {
                                            const storyLabel = c.storyId ? (storyMap.get(c.storyId) ?? c.storyId) : null;
                                            return (
                                              <div key={ci} className="flex items-center gap-1">
                                                <span>📌</span>
                                                <span>عمود عند موضع ({c.x.toFixed(2)} m، {c.y.toFixed(2)} m)</span>
                                                {storyLabel && <span className="text-muted-foreground">— {storyLabel}</span>}
                                                <span className="text-muted-foreground">({c.b}×{c.h} مم)</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {isolBeams.length > 0 && (
                                        <div className="space-y-0.5">
                                          <div className="font-medium text-muted-foreground">الجسور المعزولة:</div>
                                          {isolBeams.map((b, bi) => {
                                            const storyLabel = b.storyId ? (storyMap.get(b.storyId) ?? b.storyId) : null;
                                            return (
                                              <div key={bi} className="flex items-center gap-1">
                                                <span>📐</span>
                                                <span>جسر من ({b.x1.toFixed(2)}, {b.y1.toFixed(2)}) إلى ({b.x2.toFixed(2)}, {b.y2.toFixed(2)}) م</span>
                                                {storyLabel && <span className="text-muted-foreground">— {storyLabel}</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      <div className="text-[9px] text-muted-foreground border-t border-red-200 dark:border-red-800 pt-1 mt-1">
                                        💡 الحل: تأكد من وجود جسر أو عمود يربط هذه العناصر بالإطار الرئيسي — أو تحقق من تطابق الإحداثيات عند نقاط الوصل.
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
                {/* ── زر مدير الاتصالات اليدوية ── */}
                <Button
                  variant="outline"
                  className="w-full min-h-[36px] border-blue-300 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950 text-xs"
                  onClick={() => setConnectionManagerOpen(true)}
                >
                  🔗 إدارة اتصالات الجسور والأعمدة
                  {manualJointOverrides.length > 0 && (
                    <Badge variant="secondary" className="mr-1.5 text-[9px] h-4 px-1 bg-blue-100 text-blue-700">
                      {manualJointOverrides.length} يدوي
                    </Badge>
                  )}
                </Button>

                <Button
                  onClick={() => {
                    setValidationRunning(true);
                    import('@/core/validation/preAnalysisValidator').then(({ runPreAnalysisChecks }) => {
                      const vNodes: { id: string; x: number; y: number; z: number; restraints: [boolean,boolean,boolean,boolean,boolean,boolean] }[] = [];
                      const vElements: { id: string; nodeI: string; nodeJ: string; type: 'beam' | 'column' }[] = [];
                      const activeColumns = columns.filter(cc => !cc.isRemoved);
                      const colMap = new Map(activeColumns.map(c => [c.id, c]));

                      // Build validation nodes from columns
                      for (const c of activeColumns) {
                        const zBot = c.zBottom ?? 0;
                        const zTop = c.zTop ?? (zBot + c.L);
                        vNodes.push({ id: `${c.id}_bot`, x: c.x * 1000, y: c.y * 1000, z: zBot, restraints: [true, true, true, true, true, true] });
                        vNodes.push({ id: `${c.id}_top`, x: c.x * 1000, y: c.y * 1000, z: zTop, restraints: [false, false, false, false, false, false] });
                        vElements.push({ id: `col_${c.id}`, nodeI: `${c.id}_bot`, nodeJ: `${c.id}_top`, type: 'column' });
                      }

                      // Build validation elements from beams using beamsWithLoads
                      // (which has eccFromCol/eccToCol and snapped fromCol/toCol).
                      // For connectivity, place beam nodes at the COLUMN CENTROID
                      // position when the beam is connected via eccentricity or
                      // manual override — matching analyze3DColumns.ts snap logic.
                      for (const b of beamsWithLoads) {
                        const zMm = b.z ?? 0;
                        const niId = `beam_${b.id}_I`;
                        const njId = `beam_${b.id}_J`;

                        // Resolve connected column for each endpoint
                        let x1mm = b.x1 * 1000, y1mm = b.y1 * 1000;
                        let x2mm = b.x2 * 1000, y2mm = b.y2 * 1000;

                        // --- Auto eccentricity snap ---
                        const fromCol = b.fromCol ? colMap.get(b.fromCol) : undefined;
                        const toCol   = b.toCol   ? colMap.get(b.toCol)   : undefined;
                        if (fromCol && (b.eccFromCol != null || true)) {
                          x1mm = fromCol.x * 1000; y1mm = fromCol.y * 1000;
                        }
                        if (toCol && (b.eccToCol != null || true)) {
                          x2mm = toCol.x * 1000; y2mm = toCol.y * 1000;
                        }

                        // --- Manual override snap ---
                        for (const ov of manualJointOverrides) {
                          if (ov.beamId !== b.id) continue;
                          const oc = colMap.get(ov.columnId);
                          if (!oc) continue;
                          const ocx = oc.x * 1000, ocy = oc.y * 1000;
                          const d1sq = (b.x1*1000 - ocx)**2 + (b.y1*1000 - ocy)**2;
                          const d2sq = (b.x2*1000 - ocx)**2 + (b.y2*1000 - ocy)**2;
                          if (d1sq <= d2sq) { x1mm = ocx; y1mm = ocy; }
                          else               { x2mm = ocx; y2mm = ocy; }
                        }

                        vNodes.push({ id: niId, x: x1mm, y: y1mm, z: zMm, restraints: [false, false, false, false, false, false] });
                        vNodes.push({ id: njId, x: x2mm, y: y2mm, z: zMm, restraints: [false, false, false, false, false, false] });
                        vElements.push({ id: `beam_${b.id}`, nodeI: niId, nodeJ: njId, type: 'beam' });
                      }

                      const result = runPreAnalysisChecks(vNodes, vElements);
                      setValidationReport(result.report);
                      setValidationRunning(false);
                    });
                  }}
                  disabled={validationRunning}
                  variant="outline"
                  className="w-full min-h-[44px] border-teal-300 text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:border-teal-700 dark:hover:bg-teal-950"
                >
                  <CheckSquare size={14} className="mr-2" />
                  {validationRunning ? 'جارٍ الفحص...' : 'فحص سلامة النموذج'}
                </Button>
              </CardContent>
            </Card>

            {(detectedConnections.length > 0 || (analyzed && bobConnections.length > 0)) && (
              <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="text-indigo-500">⇅</span>
                    اتصالات الجسور الحاملة / المحمولة
                    <span className="text-[10px] font-normal text-muted-foreground">
                      ({detectedConnections.length} اتصال مكتشف)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {detectedConnections.map((conn, i) => {
                    const analyzedConn = bobConnections.find(c => c.removedColumnId === conn.removedColumnId);
                    const primaryBeam = beamsWithLoads.find(b => b.id === conn.primaryBeamId);
                    const contBeam = conn.continuationBeamId ? beamsWithLoads.find(b => b.id === conn.continuationBeamId) : undefined;
                    const isManualOverride = bobManualPrimary[conn.removedColumnId] !== undefined;

                    // Determine criterion label
                    const criterion = (() => {
                      if (isManualOverride) return 'تعيين يدوي ✎';
                      const hB = beamsWithLoads.filter(b =>
                        (b.fromCol === conn.removedColumnId || b.toCol === conn.removedColumnId) && b.direction === 'horizontal'
                      );
                      const vB = beamsWithLoads.filter(b =>
                        (b.fromCol === conn.removedColumnId || b.toCol === conn.removedColumnId) && b.direction === 'vertical'
                      );
                      if (conn.primaryDirection === 'horizontal' && hB.length >= 2 && vB.length === 1) return 'استمرارية (2 أفقي + 1 رأسي)';
                      if (conn.primaryDirection === 'vertical' && vB.length >= 2 && hB.length === 1) return 'استمرارية (2 رأسي + 1 أفقي)';
                      return 'صلابة EI/L';
                    })();

                    // Collect beams at this column for SVG
                    const hBeamsAtCol = beamsWithLoads.filter(b =>
                      (b.fromCol === conn.removedColumnId || b.toCol === conn.removedColumnId) && b.direction === 'horizontal'
                    );
                    const vBeamsAtCol = beamsWithLoads.filter(b =>
                      (b.fromCol === conn.removedColumnId || b.toCol === conn.removedColumnId) && b.direction === 'vertical'
                    );
                    const primaryIsH = conn.primaryDirection === 'horizontal';

                    return (
                      <div key={i} className="rounded-lg border border-indigo-200/60 dark:border-indigo-800/60 bg-background p-3 space-y-3">

                        {/* ── SVG diagram + text info side-by-side ── */}
                        <div className="flex gap-3 items-start flex-wrap">

                          {/* SVG cross diagram */}
                          <div className="shrink-0">
                            <svg width="110" height="110" viewBox="0 0 110 110" className="rounded border border-border bg-muted/30">
                              {/* Horizontal beam arm(s) */}
                              {hBeamsAtCol.map((hb, hi) => {
                                const isCarrier = primaryIsH;
                                const color = isCarrier ? '#22c55e' : '#ef4444';
                                const strokeW = isCarrier ? 5 : 3;
                                // slight vertical offset for multiple beams
                                const yOff = (hi - (hBeamsAtCol.length - 1) / 2) * 6;
                                return (
                                  <g key={hb.id}>
                                    <line x1={5} y1={55 + yOff} x2={105} y2={55 + yOff} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
                                    <text x={8} y={55 + yOff - 3} fontSize={7} fill={color} fontWeight="bold">{hb.id}</text>
                                  </g>
                                );
                              })}
                              {/* Vertical beam arm(s) */}
                              {vBeamsAtCol.map((vb, vi) => {
                                const isCarrier = !primaryIsH;
                                const color = isCarrier ? '#22c55e' : '#ef4444';
                                const strokeW = isCarrier ? 5 : 3;
                                const xOff = (vi - (vBeamsAtCol.length - 1) / 2) * 6;
                                return (
                                  <g key={vb.id}>
                                    <line x1={55 + xOff} y1={5} x2={55 + xOff} y2={105} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
                                    <text x={55 + xOff + 3} y={14} fontSize={7} fill={color} fontWeight="bold">{vb.id}</text>
                                  </g>
                                );
                              })}
                              {/* Removed column dot at intersection */}
                              <circle cx={55} cy={55} r={6} fill="#6366f1" stroke="white" strokeWidth={1.5} />
                              <text x={55} y={55 + 3.5} textAnchor="middle" fontSize={6} fill="white" fontWeight="bold">✕</text>
                              {/* Legend labels */}
                              <text x={55} y={106} textAnchor="middle" fontSize={6} fill="#6366f1">{conn.removedColumnId}</text>
                              {/* Carrier/carried corner labels */}
                              <text x={4} y={108} fontSize={6} fill="#22c55e">حامل</text>
                              <text x={75} y={108} fontSize={6} fill="#ef4444">محمول</text>
                            </svg>
                          </div>

                          {/* Text details */}
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Header */}
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <span className="text-[10px] text-muted-foreground leading-relaxed">
                                عمود محذوف: <span className="font-mono font-bold text-foreground">{conn.removedColumnId}</span>
                                <span className="mx-1 opacity-40">·</span>
                                ({conn.point.x.toFixed(1)}، {conn.point.y.toFixed(1)}) م
                                <br />
                                معيار: <span className={`font-semibold ${isManualOverride ? 'text-violet-600 dark:text-violet-400' : ''}`}>{criterion}</span>
                              </span>
                              {analyzedConn && analyzedConn.reactionForce > 0 && (
                                <span className="text-[10px] font-bold bg-amber-500/15 border border-amber-400/40 text-amber-700 dark:text-amber-400 rounded px-2 py-0.5">
                                  حِمل منقول: {analyzedConn.reactionForce.toFixed(1)} kN
                                </span>
                              )}
                            </div>

                            {/* Manual override flip button */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">الجسر الحامل:</span>
                              <button
                                onClick={() => {
                                  const currentForced = bobManualPrimary[conn.removedColumnId];
                                  if (currentForced === undefined) {
                                    // First flip: override to opposite of auto
                                    dispatch({ type: 'SET_BOB_MANUAL_PRIMARY', colId: conn.removedColumnId, direction: primaryIsH ? 'vertical' : 'horizontal' });
                                  } else if (currentForced !== conn.primaryDirection as 'horizontal' | 'vertical') {
                                    // Second flip: back to auto (remove override)
                                    dispatch({ type: 'SET_BOB_MANUAL_PRIMARY', colId: conn.removedColumnId, direction: null });
                                  } else {
                                    // Flip to opposite
                                    dispatch({ type: 'SET_BOB_MANUAL_PRIMARY', colId: conn.removedColumnId, direction: currentForced === 'horizontal' ? 'vertical' : 'horizontal' });
                                  }
                                }}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold rounded border px-2 py-0.5 transition-colors cursor-pointer
                                  ${isManualOverride
                                    ? 'bg-violet-500/15 border-violet-400/50 text-violet-700 dark:text-violet-400 hover:bg-violet-500/25'
                                    : 'bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                                  }`}
                                title="اضغط لتبديل الجسر الحامل / المحمول يدوياً"
                              >
                                <span>{primaryIsH ? 'أفقي ↔' : 'رأسي ↕'}</span>
                                {isManualOverride ? <span>· يدوي ✎</span> : <span>· تلقائي</span>}
                              </button>
                              {isManualOverride && (
                                <button
                                  onClick={() => dispatch({ type: 'SET_BOB_MANUAL_PRIMARY', colId: conn.removedColumnId, direction: null })}
                                  className="text-[9px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                                >
                                  إعادة تعيين تلقائي
                                </button>
                              )}
                            </div>

                            {/* Primary beam row */}
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-16 text-[10px] font-bold rounded bg-green-500/15 border border-green-400/40 text-green-700 dark:text-green-400 px-1 py-0.5">
                                حامل ✓
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="font-mono text-xs font-bold text-foreground">{conn.primaryBeamId}</span>
                                {primaryBeam && (
                                  <span className="text-[10px] text-muted-foreground mr-2">
                                    {conn.primaryDirection === 'horizontal' ? 'أفقي' : 'رأسي'} —
                                    بحر {(primaryBeam.length / 1000).toFixed(2)} م —
                                    {primaryBeam.b}×{primaryBeam.h} مم
                                  </span>
                                )}
                                {analyzedConn && analyzedConn.reactionForce > 0 && (
                                  <span className="text-[10px] text-muted-foreground mr-2">
                                    @ {(conn.distanceOnPrimary / 1000).toFixed(2)} م من الطرف
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Continuation beam */}
                            {contBeam && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-16 text-[10px] font-bold rounded bg-green-500/10 border border-green-400/30 text-green-600 dark:text-green-500 px-1 py-0.5">
                                  حامل A2
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="font-mono text-xs font-bold text-foreground">{conn.continuationBeamId}</span>
                                  <span className="text-[10px] text-muted-foreground mr-2">
                                    استمرار — {(contBeam.length / 1000).toFixed(2)} م — {contBeam.b}×{contBeam.h} مم
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Secondary beams */}
                            {conn.secondaryBeamIds.map(sid => {
                              const sb = beamsWithLoads.find(b => b.id === sid);
                              const isHingedAtI = sb?.fromCol === conn.removedColumnId;
                              return (
                                <div key={sid} className="flex items-start gap-2">
                                  <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-16 text-[10px] font-bold rounded bg-red-500/15 border border-red-400/40 text-red-700 dark:text-red-400 px-1 py-0.5">
                                    محمول ⭕
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-mono text-xs font-bold text-foreground">{sid}</span>
                                    {sb && (
                                      <span className="text-[10px] text-muted-foreground mr-2">
                                        {sb.direction === 'horizontal' ? 'أفقي' : 'رأسي'} —
                                        {(sb.length / 1000).toFixed(2)} م —
                                        {sb.b}×{sb.h} مم —
                                        مفصلة عند {isHingedAtI ? 'البداية (I)' : 'النهاية (J)'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!analyzed && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                      شغّل التحليل لحساب قيم ردود الأفعال المنقولة
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {!analyzed ? (
              <Card><CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">يرجى تشغيل التحليل أولاً</p>
                <Button onClick={runAnalysis} className="min-h-[44px]">تشغيل التحليل</Button>
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {/* ── مؤشر وضع التحليل ── */}
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] border ${
                  ignoreSlab
                    ? 'bg-amber-500/10 border-amber-400/40 text-amber-700 dark:text-amber-400'
                    : selectedEngine === 'fem_coupled'
                      ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-700 dark:text-emerald-400'
                      : selectedEngine === 'legacy_2d'
                        ? 'bg-violet-500/10 border-violet-400/40 text-violet-700 dark:text-violet-400'
                        : 'bg-blue-500/10 border-blue-400/40 text-blue-700 dark:text-blue-400'
                }`}>
                  <Zap size={12} className="shrink-0" />
                  <span className="font-semibold">
                    {ignoreSlab
                      ? 'تحليل إطار نقي — جساءة البلاطات مُهملة'
                      : selectedEngine === 'fem_coupled'
                        ? 'تحليل FEM مقترن (جسور + بلاطات)'
                        : selectedEngine === 'legacy_2d'
                          ? 'تحليل 2D — طريقة صلابة المصفوفة'
                          : 'تحليل 3D — إطارات ثلاثية الأبعاد'}
                  </span>
                  <span className="opacity-70 mr-auto text-[10px]">
                    {ignoreSlab
                      ? '0.35 جسور · 0.65 أعمدة · 0 بلاطات'
                      : '0.35 جسور · 0.65 أعمدة · 0.25 بلاطات'}
                  </span>
                </div>

                {/* Story filter for analysis */}
                <StorySelector
                  stories={stories} selectedStoryId={selectedStoryId}
                  onSelectStory={id => dispatch({ type: 'SELECT_STORY', storyId: id })}
                  onAddStory={() => dispatch({ type: 'ADD_STORY' })}
                  onRemoveStory={id => dispatch({ type: 'REMOVE_STORY', storyId: id })}
                  onUpdateStory={(id, updates) => dispatch({ type: 'UPDATE_STORY', storyId: id, updates })}
                  onCopyElements={(from, to) => dispatch({ type: 'COPY_STORY_ELEMENTS', fromStoryId: from, toStoryId: to })}
                  compact
                />

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">الأحمال على الجسور (kN/m)</CardTitle>
                    {/* Beam-on-beam diagnostic banner */}
                    {bobConnections.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {bobConnections.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 rounded px-2 py-0.5 font-mono">
                            <span className="font-bold">{c.primaryBeamId}</span>
                            <span className="opacity-60">←</span>
                            <span>{c.secondaryBeamIds.join('+')}</span>
                            {c.reactionForce > 0 && <span className="text-amber-600 font-bold ml-1">{c.reactionForce.toFixed(1)} kN</span>}
                          </span>
                        ))}
                      </div>
                    ) : detectedConnections.length > 0 ? (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        🔄 تم اكتشاف {detectedConnections.length} اتصال جسر-على-جسر، تشغيل التحليل لحساب الأحمال...
                      </p>
                    ) : removedColumnIds.length === 0 ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                        ⚠️ لا توجد اتصالات جسر-على-جسر — لاكتشافها يجب حذف عمود عند نقطة تقاطع جسرين متعاكسين
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        ℹ️ {removedColumnIds.length} عمود محذوف — لم يُكتشف أي تقاطع جسرين متعاكسين عنده
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['الدور','الجسر','DL','LL','1.4D','1.2D+1.6L','البلاطات','أحمال مركزة من جسور (kN)'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {stories.map(story => 
                          (isAllStories || story.id === selectedStoryId) &&
                          beamsWithLoads.filter(b => b.storyId === story.id).map(b => {
                            const pointLoads = bobConnections.filter(c => c.primaryBeamId === b.id);
                            return (
                              <TableRow key={`${story.id}-${b.id}`}>
                                <TableCell className="text-xs font-medium text-muted-foreground">{story.label}</TableCell>
                                <TableCell className="font-mono text-xs">{b.id}</TableCell>
                                <TableCell className="font-mono text-xs">{b.deadLoad.toFixed(2)}</TableCell>
                                <TableCell className="font-mono text-xs">{b.liveLoad.toFixed(2)}</TableCell>
                                <TableCell className="font-mono text-xs">{(1.4 * b.deadLoad).toFixed(2)}</TableCell>
                                <TableCell className="font-mono text-xs">{(1.2 * b.deadLoad + 1.6 * b.liveLoad).toFixed(2)}</TableCell>
                                <TableCell className="text-xs">{(b.slabs ?? []).join(', ') || '—'}</TableCell>
                                <TableCell className="text-xs">
                                  {pointLoads.length === 0 ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {pointLoads.map((c, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 font-mono">
                                          <span className="text-amber-600 font-bold">{c.reactionForce.toFixed(1)} kN</span>
                                          <span className="text-muted-foreground">من</span>
                                          <span className="text-blue-600 font-semibold">{c.secondaryBeamIds.join('+')}</span>
                                          <span className="text-muted-foreground">@ {c.distanceOnPrimary.toFixed(2)}م</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                {/* زر تصدير عزوم الجسور إلى Excel */}
                {frameResults.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        import('xlsx').then(XLSX => {
                          const data: any[] = [];
                          // Build set of split-part IDs to skip
                          const splitPartIdsXls = new Set<string>();
                          for (const parts of Object.values(splitBeamGroups)) {
                            for (const p of parts) splitPartIdsXls.add(p);
                          }
                          for (const fr of frameResults) {
                            // Collect canonical beams (merge split parts)
                            const seen = new Set<string>();
                            for (const b of fr.beams) {
                              let canonId = b.beamId;
                              if (splitPartIdsXls.has(b.beamId)) {
                                const base = Object.entries(splitBeamGroups).find(([, parts]) => parts.includes(b.beamId))?.[0];
                                if (base) canonId = base;
                              }
                              if (seen.has(canonId)) continue;
                              seen.add(canonId);
                              // Aggregate across all parts
                              const partIds = splitBeamGroups[canonId] || [canonId];
                              const allParts = fr.beams.filter(x => partIds.includes(x.beamId));
                              const aggMleft = allParts.reduce((m, x) => Math.max(m, Math.abs(x.Mleft)), 0);
                              const aggMmid  = allParts.reduce((m, x) => Math.max(m, x.Mmid), 0);
                              const aggMright = allParts.reduce((m, x) => Math.max(m, Math.abs(x.Mright)), 0);
                              const aggVu    = allParts.reduce((m, x) => Math.max(m, x.Vu), 0);
                              const aggSpan  = allParts.reduce((s, x) => s + x.span, 0) || b.span;
                              const repBeam = beamsWithLoads.find(bw => bw.id === canonId) || beamsWithLoads.find(bw => partIds.includes(bw.id));
                              const story = repBeam ? stories.find(s => s.id === repBeam.storyId) : null;
                              data.push({
                                'الإطار': fr.frameId,
                                'الدور': story?.label ?? '',
                                'الجسر': canonId,
                                'البحر (م)': +aggSpan.toFixed(2),
                                'M يسار (kN·m)': +aggMleft.toFixed(2),
                                'M منتصف (kN·m)': +aggMmid.toFixed(2),
                                'M يمين (kN·m)': +aggMright.toFixed(2),
                                'Vu (kN)': +aggVu.toFixed(2),
                              });
                            }
                          }
                          const ws = XLSX.utils.json_to_sheet(data);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, 'عزوم الجسور');
                          XLSX.writeFile(wb, 'beam_moments.xlsx');
                        });
                      }}
                    >
                      <Download size={14} />
                      تصدير العزوم إلى Excel
                    </Button>
                  </div>
                )}
                {frameResults.map(fr => {
                  // Build merged beam list — one row per canonical beam
                  const splitPartIdsTable = new Set<string>();
                  for (const parts of Object.values(splitBeamGroups)) {
                    for (const p of parts) splitPartIdsTable.add(p);
                  }
                  const mergedBeams: Array<{
                    canonId: string; span: number;
                    Mleft: number; Mmid: number; Mright: number; Vu: number;
                    firstPartId: string;
                  }> = [];
                  const seenIds = new Set<string>();
                  for (const b of fr.beams) {
                    let canonId = b.beamId;
                    if (splitPartIdsTable.has(b.beamId)) {
                      const base = Object.entries(splitBeamGroups).find(([, parts]) => parts.includes(b.beamId))?.[0];
                      if (base) canonId = base;
                    }
                    if (seenIds.has(canonId)) continue;
                    seenIds.add(canonId);
                    const partIds = splitBeamGroups[canonId] || [canonId];
                    const allParts = fr.beams.filter(x => partIds.includes(x.beamId));
                    mergedBeams.push({
                      canonId,
                      firstPartId: b.beamId,
                      span: allParts.reduce((s, x) => s + x.span, 0) || b.span,
                      Mleft:  allParts.reduce((m, x) => { const v = Math.abs(x.Mleft);  return v > Math.abs(m) ? -v : m; }, b.Mleft),
                      Mmid:   allParts.reduce((m, x) => Math.abs(x.Mmid) > Math.abs(m) ? x.Mmid : m, b.Mmid),
                      Mright: allParts.reduce((m, x) => { const v = Math.abs(x.Mright); return v > Math.abs(m) ? -v : m; }, b.Mright),
                      Vu:     allParts.reduce((m, x) => Math.max(m, x.Vu), b.Vu),
                    });
                  }
                  return (
                  <Card key={fr.frameId}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">إطار {fr.frameId} <span className="text-muted-foreground text-xs">(اضغط على جسر لعرض الرسومات)</span></CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          {['الجسر','البحر (م)','M− يسار\n(عند حافة العمود)','M+ وسط','M− يمين\n(عند حافة العمود)','Vu (kN)','📊'].map(h => <TableHead key={h} className="text-xs whitespace-pre-line leading-tight">{h}</TableHead>)}
                        </TableRow></TableHeader>
                        <TableBody>
                          {mergedBeams.map(b => {
                            const midMoment = b.Mmid;
                            const bBeam = beamsWithLoads.find(bw => bw.id === b.canonId)
                              || beamsWithLoads.find(bw => (splitBeamGroups[b.canonId] || [b.canonId]).includes(bw.id));
                            let bHingeLeft = false, bHingeRight = false;
                            if (bBeam) {
                              for (const conn of detectedConnections) {
                                if (conn.secondaryBeamIds.includes(b.firstPartId)) {
                                  if (bBeam.fromCol === conn.removedColumnId) bHingeLeft  = true;
                                  if (bBeam.toCol   === conn.removedColumnId) bHingeRight = true;
                                }
                              }
                              const rs = getBeamReleaseState(bBeam);
                              if (rs.nodeI.rz) bHingeLeft  = true;
                              if (rs.nodeJ.rz) bHingeRight = true;
                            }
                            return (
                            <TableRow key={b.canonId} className="cursor-pointer hover:bg-accent/10" onClick={() => handleAnalysisElementClick(b.firstPartId)}>
                              <TableCell className="font-mono text-xs">{b.canonId}</TableCell>
                              <TableCell className="font-mono text-xs">{b.span.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs" style={{ color: b.Mleft < 0 ? 'hsl(0 84.2% 60.2%)' : 'hsl(142 71% 45%)' }}>
                                {b.Mleft.toFixed(2)}{bHingeLeft ? ' ⭕' : ''}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-bold" style={{ color: midMoment > 0 ? 'hsl(142 71% 45%)' : 'hsl(0 84.2% 60.2%)' }}>{midMoment.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs" style={{ color: b.Mright < 0 ? 'hsl(0 84.2% 60.2%)' : 'hsl(142 71% 45%)' }}>
                                {b.Mright.toFixed(2)}{bHingeRight ? ' ⭕' : ''}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{b.Vu.toFixed(2)}</TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px] cursor-pointer">رسومات</Badge></TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  );
                })}

                {/* ── الجدول ثنائي المحور نُقل إلى تبويب "الأعمدة ثنائية المحور" ── */}

                {/* Joint Connectivity - Column Above/Below at each joint */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">تفاصيل اتصال الأعمدة بالركائز (العمود العلوي والسفلي)</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['الفريم','الركيزة','X','Y','Z','العمود العلوي','b×h علوي','طول علوي','Z علوي','العمود السفلي','b×h سفلي','طول سفلي','Z سفلي','نسبة علوي','نسبة سفلي'].map((h, i) => <TableHead key={`${h}-${i}`} className="text-xs whitespace-nowrap">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {jointConnectivity.map((j, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs font-bold">{j.frameId}</TableCell>
                            <TableCell className="font-mono text-xs">{j.jointColId}</TableCell>
                            <TableCell className="font-mono text-xs">{j.jointX.toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-xs">{j.jointY.toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-xs">{j.jointZ.toFixed(0)}</TableCell>
                            <TableCell className="font-mono text-xs text-blue-600 dark:text-blue-400">{j.colAboveId ?? '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{j.colAboveB && j.colAboveH ? `${j.colAboveB}×${j.colAboveH}` : '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{j.colAboveL?.toFixed(0) ?? '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{j.colAboveZBot != null && j.colAboveZTop != null ? `${j.colAboveZBot.toFixed(0)}→${j.colAboveZTop.toFixed(0)}` : '—'}</TableCell>
                            <TableCell className="font-mono text-xs text-orange-600 dark:text-orange-400">{j.colBelowId ?? '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{j.colBelowB && j.colBelowH ? `${j.colBelowB}×${j.colBelowH}` : '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{j.colBelowL?.toFixed(0) ?? '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{j.colBelowZBot != null && j.colBelowZTop != null ? `${j.colBelowZBot.toFixed(0)}→${j.colBelowZTop.toFixed(0)}` : '—'}</TableCell>
                            <TableCell className="font-mono text-xs font-bold">{(j.distributionTop * 100).toFixed(1)}%</TableCell>
                            <TableCell className="font-mono text-xs font-bold">{(j.distributionBot * 100).toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                {/* ETABS Comparison Table */}
                <ETABSComparisonTable
                  frames={frames}
                  beams={beamsWithLoads}
                  columns={columns}
                  stories={stories}
                  frameResults3D={frameResults3DRaw}
                  frameResults2D={frameResults2D}
                  frameResultsGF={frameResultsGF}
                  frameResultsUC={frameResultsUC}
                  colLoads3D={colLoads3D}
                  colLoads2D={colLoadsBiaxial}
                  etabsBeamData={etabsAnalysisData}
                  onEtabsDataChange={(newData) => {
                    dispatch({ type: 'SET_ETABS_ANALYSIS_DATA', data: newData as any });
                  }}
                />
              </div>
            )}
              </TabsContent>

              <TabsContent value="analysis-compare" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <LoadComparisonPanel
                  slabs={storyFilteredSlabs}
                  beams={beamsWithLoads}
                  columns={columns}
                  slabProps={slabProps}
                  mat={mat}
                  analyzed={analyzed}
                  onRunAnalysis={runAnalysis}
                />
              </TabsContent>
              <TabsContent value="analysis-fem-compare" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <FEMComparisonPanel
                  slabs={storyFilteredSlabs}
                  beams={beamsWithLoads}
                  columns={columns}
                  slabProps={slabProps}
                  mat={mat}
                  analyzed={analyzed}
                  onRunAnalysis={runAnalysis}
                />
              </TabsContent>
              <TabsContent value="analysis-etabs-import" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <ETABSImportPanel
                  frameResults2D={frameResults2D}
                  frameResults3D={frameResults3DRaw}
                  frameResultsFEM={selectedEngine === 'fem_coupled' ? frameResults : undefined}
                  frameResultsGF={frameResultsGF}
                  frameResultsUC={frameResultsUC}
                  beams={beamsWithLoads}
                  analyzed={analyzed}
                  onRunAnalysis={runAnalysis}
                />
              </TabsContent>
              <TabsContent value="analysis-beam-loads" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <BeamLoadDiagrams
                  frameResults={frameResults}
                  beams={beamsWithLoads}
                  engineLabel={ENGINE_LABELS[selectedEngine]}
                  bobConnections={bobConnections}
                  beamHinges={beamHingesMap}
                />
              </TabsContent>
              <TabsContent value="analysis-slab" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <SlabAnalysisPanel slabs={slabs} slabProps={slabProps} mat={mat} ribbedSlabProps={state.ribbedSlabProps} columns={columns} beams={beamsWithLoads} />
              </TabsContent>
              <TabsContent value="analysis-slab-load-diag" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <SlabLoadDiagnosticPanel
                  beams={beamsWithLoads}
                  slabs={slabs}
                  columns={columns}
                  slabProps={slabProps}
                  mat={mat}
                  colLoads3D={colLoads3D}
                />
              </TabsContent>

              {/* ══ تبويب نتائج الأعمدة ثنائية المحور ══ */}
              <TabsContent value="analysis-biaxial" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <div className="space-y-4">

                  {/* شريط التحكم */}
                  <Card>
                    <CardContent className="py-3">
                      <div className="flex flex-wrap items-center gap-3">

                        {/* فلتر الدور */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">الدور:</span>
                          <select
                            className="h-8 rounded border border-border bg-background text-xs px-2 focus:outline-none"
                            value={biaxialStoryFilter}
                            onChange={e => setBiaxialStoryFilter(e.target.value)}
                          >
                            <option value="">جميع الأدوار</option>
                            {stories.map(s => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                        </div>

                        <span className="text-xs text-muted-foreground border-r border-border pr-3">
                          {biaxialSelectedCols.size} عمود محدد
                        </span>

                        {/* تحديد الكل الذي يحتاج تدوير */}
                        <button
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/30 transition-colors"
                          onClick={() => {
                            const needRotation = new Set<string>();
                            for (const story of stories) {
                              if (biaxialStoryFilter && story.id !== biaxialStoryFilter) continue;
                              for (const c of colDesigns.filter(cd => cd.storyId === story.id)) {
                                const loads = colLoads3D.get(c.id);
                                const maxMx = Math.max(Math.abs(loads?.MxTop || 0), Math.abs(loads?.MxBot || 0));
                                const maxMy = Math.max(Math.abs(loads?.MyTop || 0), Math.abs(loads?.MyBot || 0));
                                const r90 = c.orientAngle != null && (((c.orientAngle % 360) + 360) % 360) >= 45 && (((c.orientAngle % 360) + 360) % 360) < 135;
                                const eB = r90 ? c.h : c.b;
                                const eH = r90 ? c.b : c.h;
                                if (eB !== eH && ((maxMy > maxMx && eB < eH) || (maxMx > maxMy && eH < eB))) needRotation.add(c.id);
                              }
                            }
                            setBiaxialSelectedCols(needRotation);
                          }}
                        >
                          ✓ تحديد كل التي تحتاج تدوير
                        </button>

                        {/* إلغاء التحديد */}
                        <button
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/30 transition-colors"
                          onClick={() => setBiaxialSelectedCols(new Set())}
                        >
                          ✕ إلغاء التحديد
                        </button>

                        {/* زر تصدير نتائج الأعمدة إلى Excel */}
                        <button
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/30 transition-colors flex items-center gap-1"
                          onClick={() => {
                            import('xlsx').then(XLSX => {
                              const data: any[] = [];
                              for (const story of stories) {
                                if (biaxialStoryFilter && story.id !== biaxialStoryFilter) continue;
                                for (const c of colDesigns.filter(cd => cd.storyId === story.id)) {
                                  const loads = colLoads3D.get(c.id);
                                  const Pu = loads?.Pu ?? 0;
                                  const MxTop = loads?.MxTop ?? 0;
                                  const MxBot = loads?.MxBot ?? 0;
                                  const MyTop = loads?.MyTop ?? 0;
                                  const MyBot = loads?.MyBot ?? 0;
                                  const maxMx = Math.max(Math.abs(MxTop), Math.abs(MxBot));
                                  const maxMy = Math.max(Math.abs(MyTop), Math.abs(MyBot));
                                  data.push({
                                    'الدور': story.label,
                                    'العمود': c.id,
                                    'b (مم)': c.b,
                                    'h (مم)': c.h,
                                    'Pu (kN)': +Pu.toFixed(1),
                                    'Mx أعلى (kN·m)': +MxTop.toFixed(2),
                                    'Mx أسفل (kN·m)': +MxBot.toFixed(2),
                                    'My أعلى (kN·m)': +MyTop.toFixed(2),
                                    'My أسفل (kN·m)': +MyBot.toFixed(2),
                                    'Mx أقصى (kN·m)': +maxMx.toFixed(2),
                                    'My أقصى (kN·m)': +maxMy.toFixed(2),
                                    'نحافة X': c.design.slendernessStatusX,
                                    'نحافة Y': c.design.slendernessStatusY,
                                    'الارتفاع (مم)': story.height,
                                    'الحالة': c.design.biaxialAdequate ? 'آمن' : 'غير آمن',
                                  });
                                }
                              }
                              const ws = XLSX.utils.json_to_sheet(data);
                              const wb = XLSX.utils.book_new();
                              XLSX.utils.book_append_sheet(wb, ws, 'نتائج الأعمدة');
                              XLSX.writeFile(wb, 'column_biaxial_results.xlsx');
                            });
                          }}
                        >
                          <Download size={12} />
                          تصدير إلى Excel
                        </button>

                        {/* زر التدوير الجماعي */}
                        {biaxialSelectedCols.size > 0 && (
                          <button
                            className="text-xs px-3 py-1.5 rounded bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center gap-1.5 transition-colors shadow"
                            onClick={() => {
                              const justRotated = new Set<string>();
                              for (const colId of biaxialSelectedCols) {
                                const col = columns.find(c => c.id === colId);
                                if (col && col.b !== col.h) {
                                  // ETABS-style rotation: toggle orientAngle between 0 and 90
                                  // This physically rotates the section without swapping b/h labels
                                  const currentAngle = col.orientAngle ?? 0;
                                  const newAngle = Math.round(currentAngle % 180) === 0 ? 90 : 0;
                                  dispatch({ type: 'SET_COL_OVERRIDE', colId, override: { orientAngle: newAngle } });
                                  justRotated.add(colId);
                                }
                              }
                              if (justRotated.size > 0) {
                                setRotatedColIds(prev => new Set([...prev, ...justRotated]));
                              }
                              setBiaxialSelectedCols(new Set());
                            }}
                          >
                            <RotateCcw size={12} />
                            تدوير الأعمدة المحددة ({biaxialSelectedCols.size})
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* الجدول */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        نتائج تحليل الأعمدة (ثنائي المحور) —{' '}
                        {biaxialStoryFilter
                          ? (stories.find(s => s.id === biaxialStoryFilter)?.label ?? biaxialStoryFilter)
                          : 'جميع الأدوار'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-8 text-center">☑</TableHead>
                            {['الدور','العمود','b×h','Pu (kN)','Mx أعلى','Mx أسفل','My أعلى','My أسفل','نحافة X','نحافة Y','الارتفاع','حالة'].map(h => (
                              <TableHead key={h} className="text-xs">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stories.map(story => {
                            if (biaxialStoryFilter && story.id !== biaxialStoryFilter) return null;
                            return colDesigns.filter(c => c.storyId === story.id).map(c => {
                              const loads = colLoads3D.get(c.id);
                              const Pu = loads?.Pu ?? 0;
                              const maxMx = Math.max(Math.abs(loads?.MxTop || 0), Math.abs(loads?.MxBot || 0));
                              const maxMy = Math.max(Math.abs(loads?.MyTop || 0), Math.abs(loads?.MyBot || 0));
                              // يحتاج تدويراً فقط إذا كان البُعد الأكبر يواجه المحور الضعيف:
                              // My > Mx → نريد b ≥ h (Iy أكبر) → مشكلة إذا b < h
                              // Mx > My → نريد h ≥ b (Ix أكبر) → مشكلة إذا h < b
                              // Account for orientAngle: if column is rotated 90°, effective b/h are swapped
                              const colIsRotated90 = c.orientAngle != null && (((c.orientAngle % 360) + 360) % 360) >= 45 && (((c.orientAngle % 360) + 360) % 360) < 135;
                              const effB = colIsRotated90 ? c.h : c.b;
                              const effH = colIsRotated90 ? c.b : c.h;
                              const needsRotation = effB !== effH && (
                                (maxMy > maxMx && effB < effH) ||
                                (maxMx > maxMy && effH < effB)
                              );
                              const isSelected = biaxialSelectedCols.has(c.id);
                              const wasRotated = rotatedColIds.has(c.id);
                              return (
                                <TableRow
                                  key={`biaxial-${story.id}-${c.id}`}
                                  className={`cursor-pointer hover:bg-accent/10 ${wasRotated ? 'bg-green-50/40 dark:bg-green-900/10' : needsRotation ? 'bg-orange-50/40 dark:bg-orange-900/10' : ''} ${isSelected ? 'outline outline-2 outline-orange-400/60' : ''}`}
                                  onClick={() => {
                                    dispatch({
                                      type: 'OPEN_DIAGRAM',
                                      data: {
                                        elementId: c.id,
                                        elementType: 'column' as const,
                                        span: (story.height || 3000) / 1000,
                                        colLength: story.height || 3000,
                                        MxTop: loads?.MxTop || 0,
                                        MxBot: loads?.MxBot || 0,
                                        MyTop: loads?.MyTop || 0,
                                        MyBot: loads?.MyBot || 0,
                                        Pu,
                                      },
                                    });
                                  }}
                                >
                                  {/* خانة الاختيار */}
                                  <TableCell
                                    className="text-center"
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (!needsRotation) return;
                                      setBiaxialSelectedCols(prev => {
                                        const next = new Set(prev);
                                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                                        return next;
                                      });
                                    }}
                                  >
                                    {needsRotation && (
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={checked => {
                                          setBiaxialSelectedCols(prev => {
                                            const next = new Set(prev);
                                            if (checked) next.add(c.id); else next.delete(c.id);
                                            return next;
                                          });
                                        }}
                                        onClick={e => e.stopPropagation()}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium text-muted-foreground">{story.label}</TableCell>
                                  <TableCell className="font-mono text-xs">{c.id}</TableCell>
                                  <TableCell className={`font-mono text-xs font-bold ${wasRotated ? 'text-green-600 dark:text-green-400' : ''}`}>{c.b}×{c.h}{wasRotated ? ' ✓' : ''}</TableCell>
                                  <TableCell className="font-mono text-xs font-bold">{Pu.toFixed(1)}</TableCell>
                                  <TableCell className="font-mono text-xs">{(loads?.MxTop || 0).toFixed(2)}</TableCell>
                                  <TableCell className="font-mono text-xs">{(loads?.MxBot || 0).toFixed(2)}</TableCell>
                                  <TableCell className={`font-mono text-xs ${needsRotation ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}`}>{(loads?.MyTop || 0).toFixed(2)}</TableCell>
                                  <TableCell className={`font-mono text-xs ${needsRotation ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}`}>{(loads?.MyBot || 0).toFixed(2)}</TableCell>
                                  <TableCell className="font-mono text-xs">{c.design.slendernessStatusX}</TableCell>
                                  <TableCell className="font-mono text-xs">{c.design.slendernessStatusY}</TableCell>
                                  <TableCell className="font-mono text-xs">{c.L}</TableCell>
                                  <TableCell>
                                    {wasRotated ? (
                                      <Badge variant="outline" className="text-[10px] border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 font-bold">
                                        ✓ تم التدوير
                                      </Badge>
                                    ) : needsRotation ? (
                                      <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600 dark:text-orange-400 bg-orange-50/60 dark:bg-orange-900/20">
                                        My&gt;Mx — تدوير
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] border-green-400 text-green-600 dark:text-green-400 bg-green-50/60 dark:bg-green-900/20">
                                        ✓ مقبول
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })}
                        </TableBody>
                      </Table>
                      <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                        ⓘ Pu مُستخرج مباشرةً من التحليل ثلاثي الأبعاد لكل عمود — يشمل تلقائياً تراكم الأحمال من جميع الأدوار العلوية دون ضرب يدوي.
                        الأعمدة المظللة باللون البرتقالي: البُعد الأكبر يواجه المحور الضعيف — تدوير المقطع 90° يُحسّن الكفاءة (My&gt;Mx فيجب b≥h، أو Mx&gt;My فيجب h≥b).
                        بعد الضغط على "تدوير" يُعاد التحليل تلقائياً بالأبعاد الجديدة.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

            </Tabs>
  );
};

export default AnalysisTabPanel;

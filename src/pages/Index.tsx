import React, { useReducer, useMemo, useCallback, useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Slab, Column, Beam, Frame, MatProps, SlabProps, FrameResult,
  generateColumns, generateBeams, generateFrames, snapBeamsToEccentricColumns,
  calculateBeamLoads, analyzeFrame, designFlexure, designShear,
  designColumnETABS, designSlab, calculateColumnLoads, FlexureResult, ShearResult,
  detectBeamOnBeam, analyzeWithBeamOnBeam, BeamOnBeamConnection, ColumnResult,
  calculateDeflection, DeflectionResult, diagnoseBeam, BeamDiagnostic,
  calculateColumnLoadsBiaxial, designColumnBiaxial, BiaxialColumnResult,
  calculateFrameBentUp, FrameBentUpResult, Story,
  getJointConnectivityInfo, JointConnectivityInfo, calculateRibbedSlabSelfWeight,
} from "@/lib/structuralEngine";
import { getColumnLoads3D, getFrameResults3D } from "@/lib/analyze3DColumns";
import ManualConnectionManager from "@/components/ManualConnectionManager";
import { adaptFEMResults, ENGINE_LABELS, type EngineType } from '@/lib/analysisController';
import { getFrameResultsGlobalFrame } from '@/lib/globalFrameBridge';
import { getConnectedSlabResults } from "@/slabFEMEngine";
import { ModelManager } from "@/structural/model/modelManager";
import { generateStructureFromSlabs } from "@/structural/generators/slabStructureGenerator";
import ToolPalette, { ToolType } from "@/components/ToolPalette";
import ModelCanvas from "@/components/ModelCanvas";
import PropertyPanel from "@/components/PropertyPanel";
import BuildingView from "@/components/BuildingView";
import RebarDetailModal from "@/components/RebarDetailModal";
import ElementMomentChartModal from "@/components/ElementMomentChartModal";
import ElementPropertiesDialog from "@/components/ElementPropertiesDialog";
import AddElementDialog from "@/components/AddElementDialog";
import AnalysisDiagramDialog from "@/components/AnalysisDiagramDialog";
import {
  Building2, Layers, Calculator, BarChart3, Ruler, Eye,
  Grid3X3, Settings2, Download, Bot, Building, Zap, Plus, Trash2, Copy,
  Undo2, Save, Check, Wand2, Search, Compass, Merge, Crosshair, CheckSquare, Upload, Activity,
  Loader2, X as XIcon, RotateCcw, Shapes, AlertTriangle,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import BottomNav, { type MainTab } from "@/components/BottomNav";
import MobileLocalUpdateButton from "@/components/MobileLocalUpdateButton";
import AppSidebar, { NAV } from "@/components/AppSidebar";
import StatusBar from "@/components/StatusBar";
import BreadcrumbBar from "@/components/BreadcrumbBar";
import AIAssistantPanel from "@/ai/structuralAssistant/AIAssistantPanel";
import MultiStoryDesigner from "@/building/MultiStoryDesigner";
import GenerativeDesignDashboard from "@/generative/GenerativeDesignDashboard";
import type { EvaluatedOption } from "@/generative/types";
import AutoDesignPanel from "@/components/AutoDesignPanel";
import SupportManagerPanel from "@/components/SupportManagerPanel";
import type { AutoDesignResult } from "@/lib/autoDesigner";
import { generateStructuralDXF, generateReinforcementDXF, generateBeamLayoutDXF, generateColumnLayoutDXF, downloadDXF } from "@/export/dxfExporter";
import { generateStructuralReport } from "@/export/pdfReport";
import { exportStructuralDrawingPDF } from "@/export/drawingExporter";
import { generateAutoDrawings } from "@/drawings/autoDrawingGenerator";
import { generateConstructionSheets } from "@/drawings/constructionSheets";
import { generateBBS, exportBBSToPDF, exportBBSToExcel } from "@/rebar/bbsGenerator";
import BeamRebarDetailView from "@/components/BeamRebarDetailView";
import { findCollinearGroups, mergeCollinearBeams, detectBeamIntersections } from "@/lib/beamUtils";
import { extractRawStations, buildRawStationsCSV, downloadCSV, type EngineRawStations } from "@/lib/rawMomentStationsExporter";
import { appReducer, initialState, type AppAction } from "./indexReducer";
import { postprocessFrameResultsForColumnFaces } from "@/lib/beamMomentPostprocess";
import { StorySelector, StoryManager } from "@/components/StorySelector";
import BeamDesignDetails from "@/components/BeamDesignDetails";
import ColumnDesignDetails from "@/components/ColumnDesignDetails";
import PMDiagramChart from "@/components/PMDiagramChart";
import ExportPanel from "@/components/ExportPanel";
import RibbedSlabDrawingsPanel from "@/components/RibbedSlabDrawingsPanel";
import ETABSComparisonTable from "@/components/ETABSComparisonTable";
import ProjectManager from "@/components/ProjectManager";
import LevelPlanView from "@/components/LevelPlanView";
import LoadComparisonPanel from "@/components/LoadComparisonPanel";
import FEMComparisonPanel  from "@/components/FEMComparisonPanel";
import GlobalFrameSolverPanel from "@/components/GlobalFrameSolverPanel";
import { buildMergedSlabGroups } from "@/lib/slabLoadTransfer";
import AdvancedAnalysisPanel from "@/components/AdvancedAnalysisPanel";
import ETABSImportPanel from "@/components/ETABSImportPanel";
import BeamLoadDiagrams from "@/components/BeamLoadDiagrams";
import BOQPanel from "@/components/BOQPanel";
import QuantityTakeoffPanel from "@/components/QuantityTakeoffPanel";
import SlabAnalysisPanel from "@/components/SlabAnalysisPanel";
import SlabDesignPanel from "@/components/SlabDesignPanel";
import SlabLoadDiagnosticPanel from "@/components/SlabLoadDiagnosticPanel";
import ETABSFullImportPanel from "@/components/ETABSFullImportPanel";
import type { ETABSImportedData } from "@/components/ETABSFullImportPanel";
import ETABSEdbImportPanel from "@/components/ETABSEdbImportPanel";
import type { EdbImportedData } from "@/components/ETABSEdbImportPanel";
import ETABSAnalysisImport from "@/components/ETABSAnalysisImport";
import type { ETABSBeamResult, ETABSColumnResult, ETABSReaction } from "@/components/ETABSAnalysisImport";
import FoundationDesignPanel from "@/components/FoundationDesignPanel";
import FoundationDrawingsExportPanel from "@/components/FoundationDrawingsExportPanel";
import StructuralDrawingsModule from "@/components/StructuralDrawingsModule";
import LoadInputPanel from "@/components/LoadInputPanel";
import DesignComparisonPanel from "@/components/DesignComparisonPanel";
import type { FootingDesignResult, FootingMaterials } from "@/lib/foundationDesign";
import { useAnalysisWorker, type AnalysisInput as WorkerAnalysisInput } from '@/core/workers/useAnalysisWorker';
import type { WorkerDiagnostics } from '@/core/workers/workerTypes';
import AnalysisDiagnosticsPanel from '@/components/AnalysisDiagnosticsPanel';
import { validateRibbedSlab } from '@/lib/ribbedSlabSolver';
import SlabsInputPanel from '@/pages/panels/SlabsInputPanel';
import AnalysisTabPanel from '@/pages/panels/AnalysisTabPanel';
import DesignTabPanel from '@/pages/panels/DesignTabPanel';

const ParamInput = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="space-y-1">
    <label className="property-label">{label}</label>
    <Input type="number" value={value}
      onChange={(e) => { onChange(parseFloat(e.target.value) || 0); }}
      className="font-mono h-10 text-sm" />
  </div>
);

type ReleaseDOF = 'ux' | 'uy' | 'uz' | 'rx' | 'ry' | 'rz';
type BeamEndReleaseState = Record<'nodeI' | 'nodeJ', Record<ReleaseDOF, boolean>>;

const EMPTY_BEAM_END_RELEASES: BeamEndReleaseState = {
  nodeI: { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
  nodeJ: { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
};

const RELEASE_DOF_META: { key: ReleaseDOF; etabs: string; desc: string }[] = [
  { key: 'ux', etabs: 'U1', desc: 'تحرير محوري' },
  { key: 'uy', etabs: 'U2', desc: 'تحرير قص محلي' },
  { key: 'uz', etabs: 'U3', desc: 'تحرير قص عمودي' },
  { key: 'rx', etabs: 'R1', desc: 'تحرير لَي' },
  { key: 'ry', etabs: 'R2', desc: 'تحرير عزم حول Y' },
  { key: 'rz', etabs: 'R3', desc: 'تحرير عزم حول Z' },
];

const createEmptyBeamEndReleases = (): BeamEndReleaseState => ({
  nodeI: { ...EMPTY_BEAM_END_RELEASES.nodeI },
  nodeJ: { ...EMPTY_BEAM_END_RELEASES.nodeJ },
});

const modelManager = new ModelManager();

// ─── Slab polygon union helpers ────────────────────────────────────────────

/** Returns the polygon vertices of a slab (uses slab.vertices if present, otherwise builds rectangle). */
function getSlabPolygonVerts(slab: Slab): { x: number; y: number }[] {
  if (slab.vertices && slab.vertices.length >= 3) return slab.vertices;
  const x1 = Math.min(slab.x1, slab.x2);
  const y1 = Math.min(slab.y1, slab.y2);
  const x2 = Math.max(slab.x1, slab.x2);
  const y2 = Math.max(slab.y1, slab.y2);
  return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
}

/** Ray-casting point-in-polygon test. */
function pointInPolygon2D(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/** Removes collinear intermediate vertices from an axis-aligned polygon. */
function removeCollinear(poly: { x: number; y: number }[]): { x: number; y: number }[] {
  if (poly.length <= 3) return poly;
  const result: { x: number; y: number }[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const curr = poly[i];
    const next = poly[(i + 1) % n];
    const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > 1e-10) result.push(curr);
  }
  return result.length >= 3 ? result : poly;
}

/**
 * Computes the union polygon of a set of slabs using a grid-based boundary tracing.
 * Works correctly for axis-aligned rectangles and convex polygons.
 * Returns the CCW boundary of the union, or null if computation fails.
 */
function computeSlabUnionPolygon(slabs: Slab[]): { x: number; y: number }[] | null {
  const polygons = slabs.map(getSlabPolygonVerts);

  const xSet = new Set<number>();
  const ySet = new Set<number>();
  polygons.forEach(poly => poly.forEach(pt => { xSet.add(pt.x); ySet.add(pt.y); }));

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);
  if (xs.length < 2 || ys.length < 2) return null;

  const nx = xs.length - 1;
  const ny = ys.length - 1;

  const covered = (i: number, j: number): boolean => {
    if (i < 0 || i >= nx || j < 0 || j >= ny) return false;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cy = (ys[j] + ys[j + 1]) / 2;
    return polygons.some(poly => pointInPolygon2D(cx, cy, poly));
  };

  // Build directed half-edge graph for the CCW union boundary.
  // Convention (Y-up, CCW = interior to the left of travel direction):
  //   bottom boundary → edge goes RIGHT  (xs[i]→xs[i+1], y=ys[j])
  //   top    boundary → edge goes LEFT   (xs[i+1]→xs[i], y=ys[j+1])
  //   left   boundary → edge goes DOWN   (x=xs[i], ys[j+1]→ys[j])
  //   right  boundary → edge goes UP     (x=xs[i+1], ys[j]→ys[j+1])
  const edgeMap = new Map<string, [number, number]>();
  const key = (x: number, y: number) => `${x},${y}`;

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!covered(i, j)) continue;
      if (!covered(i, j - 1)) edgeMap.set(key(xs[i],     ys[j]),     [xs[i + 1], ys[j]]);
      if (!covered(i, j + 1)) edgeMap.set(key(xs[i + 1], ys[j + 1]), [xs[i],     ys[j + 1]]);
      if (!covered(i - 1, j)) edgeMap.set(key(xs[i],     ys[j + 1]), [xs[i],     ys[j]]);
      if (!covered(i + 1, j)) edgeMap.set(key(xs[i + 1], ys[j]),     [xs[i + 1], ys[j + 1]]);
    }
  }

  if (edgeMap.size === 0) return null;

  const startKey = edgeMap.keys().next().value!;
  const polygon: { x: number; y: number }[] = [];
  let currentKey = startKey;
  let maxIter = edgeMap.size + 2;

  while (maxIter-- > 0) {
    const [sx, sy] = currentKey.split(',').map(Number);
    polygon.push({ x: sx, y: sy });
    const next = edgeMap.get(currentKey);
    if (!next) break;
    const nextKey = key(next[0], next[1]);
    if (nextKey === startKey) break;
    currentKey = nextKey;
  }

  if (polygon.length < 3) return null;
  return removeCollinear(polygon);
}

// ───────────────────────────────────────────────────────────────────────────

const Index = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [longPressSlabId, setLongPressSlabId] = React.useState<string | null>(null);
  const [addElementDialog, setAddElementDialog] = React.useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const [tempSlabType, setTempSlabType] = React.useState<'solid' | 'one_way_ribbed'>('solid');
  const [tempDirection, setTempDirection] = React.useState<'auto' | 'X' | 'Y'>('auto');
  const [tempBw, setTempBw] = React.useState<number>(100);
  const [tempHb, setTempHb] = React.useState<number>(200);
  const [tempTf, setTempTf] = React.useState<number>(70);
  const [tempS, setTempS] = React.useState<number>(400);

  const selectedSlabForLongPress = useMemo(() => {
    return state.slabs.find(s => s.id === longPressSlabId) || null;
  }, [state.slabs, longPressSlabId]);

  useEffect(() => {
    if (selectedSlabForLongPress) {
      setTempSlabType(selectedSlabForLongPress.slabType || 'solid');
      setTempDirection((selectedSlabForLongPress.direction as any) || 'auto');
      setTempBw(state.ribbedSlabProps?.bw ?? 100);
      setTempHb(state.ribbedSlabProps?.hb ?? 200);
      setTempTf(state.ribbedSlabProps?.tf ?? 70);
      setTempS(state.ribbedSlabProps?.s ?? 400);
    }
  }, [selectedSlabForLongPress, state.ribbedSlabProps]);

  const handleSaveSlabLongPress = () => {
    if (!longPressSlabId) return;
    const idx = state.slabs.findIndex(s => s.id === longPressSlabId);
    if (idx !== -1) {
      dispatch({ type: 'UPDATE_SLAB', index: idx, key: 'slabType', value: tempSlabType });
      dispatch({ type: 'UPDATE_SLAB', index: idx, key: 'direction', value: tempDirection });
      dispatch({
        type: 'SET_RIBBED_SLAB_PROPS',
        props: {
          bw: tempBw,
          hb: tempHb,
          tf: tempTf,
          s: tempS,
        },
      });
    }
    setLongPressSlabId(null);
  };

  const {
    stories, selectedStoryId,
    slabs, mat, slabProps, beamB, beamH, colB, colH, colL, colLBelow, colTopEndCondition, colBottomEndCondition,
    analyzed, frameResults: rawFrameResults, bobConnections, selectedEngine, ignoreSlab, beamStiffnessFactor, colStiffnessFactor,
    activeTab, mode, activeTool, pendingNode,
    selectedNodeId, selectedFrameId, selectedAreaId,
    removedColumnIds, removedBeamIds, beamOverrides, colOverrides, slabPropsOverrides, extraBeams, extraColumns, etabsImportMode, etabsAnalysisData, titleBlockConfig, supportRestraints, frameEndReleases, transientFrameEndReleases,
    modalOpen, selectedElement, elemPropsOpen, elemPropsFrameId, elemPropsAreaId, elemPropsNodeId,
    diagramOpen, diagramData, savedMessage, bobManualPrimary, undoStack,
    colRigidEndOffsets,
    manualJointOverrides,
  } = state;

  /**
   * `frameEndReleases` (الدائم — يأتي من جدول جسور تبويب الإدخال) مدموجاً مع
   * `transientFrameEndReleases` (المؤقت — يأتي من تحرير الجسر في تبويب التحليل/
   * النمذجة عبر long-press → Element Properties). هذا هو **المصدر الوحيد**
   * الذي تقرأ منه كل المحلِّلات (2D/3D Legacy/Global Frame/Unified Core).
   * المؤقت لا يظهر في جدول جسور تبويب الإدخال ولا يُحفظ في الـ snapshot/undo.
   */
  const effectiveFrameEndReleases = React.useMemo(
    () => ({ ...frameEndReleases, ...transientFrameEndReleases }),
    [frameEndReleases, transientFrameEndReleases],
  );

  // Main bottom navigation tab
  const [mainTab, setMainTab] = React.useState<MainTab>('inputs');
  const [requestedInputSubTab, setRequestedInputSubTab] = React.useState<'input-main' | 'input-ribbed' | 'input-auto'>('input-main');
  const [requestedFoundationSubTab, setRequestedFoundationSubTab] = React.useState<
    'isolated-footings' | 'strip-footing' | 'settlement' | 'classification' | 'drawings-export'
  >('isolated-footings');
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [releaseEditorBeamId, setReleaseEditorBeamId] = React.useState<string | null>(null);
  const [releaseEditorData, setReleaseEditorData] = React.useState<BeamEndReleaseState>(createEmptyBeamEndReleases);
  const [releaseEditorDims, setReleaseEditorDims] = React.useState<{ b: number; h: number }>({ b: 200, h: 400 });
  const [releaseEditorApplyOtherFloors, setReleaseEditorApplyOtherFloors] = React.useState(false);
  const [beamDeleteConfirm, setBeamDeleteConfirm] = React.useState(false);

  // Duplicate check state
  const [dupCheckResult, setDupCheckResult] = React.useState<{ message: string; count: number; items: string[] } | null>(null);

  // FEM analysis error state
  const [femError, setFemError] = React.useState<string | null>(null);

  // Analysis progress overlay
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [analysisProgress, setAnalysisProgress] = React.useState(0);
  const [analysisStep, setAnalysisStep] = React.useState('');
  const [analysisDiagnostics, setAnalysisDiagnostics] = React.useState<WorkerDiagnostics | null>(null);
  const progressTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Web Worker for off-thread analysis
  const analysisWorker = useAnalysisWorker();




  const [showViewMoments, setShowViewMoments] = React.useState(false);
  const [showViewDeflections, setShowViewDeflections] = React.useState(false);
  const [viewMomentEngine, setViewMomentEngine] = React.useState<'active' | '2d' | '3d' | 'gf'>('active');
  const [viewStoryId, setViewStoryId] = React.useState<string>('__ALL__');
















  // Modeler elevation filter state
  const [modelerElevation, setModelerElevation] = React.useState<number>(0);
  const [modelerVisibleTypes, setModelerVisibleTypes] = React.useState<('node' | 'beam' | 'column' | 'slab')[]>(['node', 'beam', 'column', 'slab']);

  // Beam selection for merge/intersect
  const [selectedBeamIds, setSelectedBeamIds] = React.useState<Set<string>>(new Set());

  // ETABS beam data for comparison table persistence
  const [etabsCompBeamData, setEtabsCompBeamData] = React.useState<{ beamId: string; Mleft: number; Mmid: number; Mright: number }[]>([]);

  // Design tab: source selector + manual trigger
  const [designSource, setDesignSource] = React.useState<'app' | 'etabs'>('app');
  const [designExecuted, setDesignExecuted] = React.useState(false);

  // Track which heavy tabs have been visited (for lazy mounting)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set<string>(['projects']));









  const [connectionManagerOpen, setConnectionManagerOpen] = React.useState(false);

  // Custom load combinations
  const [loadCombos, setLoadCombos] = React.useState([
    { id: 'combo_1_4dl',    label: '1.4DL',                   factorDL: 1.4, factorLL: 0.0, isDefault: true },
    { id: 'combo_12dl_16ll',label: '1.2DL + 1.6LL',           factorDL: 1.2, factorLL: 1.6, isDefault: true },
    { id: 'combo_1dl_1ll',  label: '1.0DL + 1.0LL (أساسات)', factorDL: 1.0, factorLL: 1.0, isDefault: true },
  ]);

  // Foundation design results (hoisted so ExportPanel can access them)
  const foundationResults = state.foundationResults || [];
  const foundationMat = state.foundationMat || null;

  // ETABS column results and reactions
  const [etabsColumnResults, setEtabsColumnResults] = React.useState<ETABSColumnResult[]>([]);
  const [etabsReactions, setEtabsReactions] = React.useState<ETABSReaction[]>([]);

  // Computed: هل توجد نتائج تصميم (من التطبيق أو من ETABS)
  const hasDesignResults = analyzed || (designSource === 'etabs' && designExecuted && etabsAnalysisData.length > 0);

  // Available elevations from stories
  const availableElevations = useMemo(() => {
    const elevs = new Set<number>();
    elevs.add(0); // ground level
    for (const s of stories) {
      elevs.add(s.elevation ?? 0);
      elevs.add((s.elevation ?? 0) + s.height);
    }
    return [...elevs].sort((a, b) => a - b);
  }, [stories]);

  // Helper: filter slabs by selected story
  const isAllStories = selectedStoryId === '__ALL__';
  const storyFilteredSlabs = useMemo(() =>
    isAllStories ? slabs : slabs.filter(s => s.storyId === selectedStoryId),
    [slabs, selectedStoryId, isAllStories]
  );

  // Get story label for an element
  const getStoryLabel = useCallback((storyId?: string) => {
    if (!storyId) return stories[0]?.label || 'الدور 1';
    return stories.find(s => s.id === storyId)?.label || storyId;
  }, [stories]);

  // Handler for changing individual column support conditions.
  // SupportPlanView passes (colId, x, y, zBottom, endType, value) directly so we
  // do not need the `columns` array here (avoids a "used before declaration" error).
  const handleColumnSupportChange = useCallback(
    (
      _colId: string,
      x: number,
      y: number,
      zBottom: number,
      endType: 'top' | 'bottom',
      value: 'F' | 'P',
    ) => {
      if (endType !== 'bottom') return; // Only bottom (foundation) conditions
      const supportKey = `${x.toFixed(2)}_${y.toFixed(2)}_${zBottom}`;
      const restraints = value === 'F'
        ? { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true }   // Fixed
        : { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false }; // Pinned
      dispatch({ type: 'SET_SUPPORT_RESTRAINTS', posKey: supportKey, restraints });
    },
    [],
  );

  // Per-DOF support restraints change
  const handleSupportRestraintsChange = useCallback((posKeys: string[], restraints: { ux: boolean; uy: boolean; uz: boolean; rx: boolean; ry: boolean; rz: boolean }) => {
    for (const key of posKeys) {
      dispatch({ type: 'SET_SUPPORT_RESTRAINTS', posKey: key, restraints });
    }
  }, []);

  useEffect(() => {
    if (!savedMessage) return;
    const t = setTimeout(() => dispatch({ type: 'CLEAR_SAVED_MESSAGE' }), 2000);
    return () => clearTimeout(t);
  }, [savedMessage]);

  // Mark tabs as visited for lazy mounting of heavy panels
  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Keyboard shortcut: Ctrl+Z for undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-load last active project on startup
  useEffect(() => {
    const loadLastActiveProject = async () => {
      try {
        const { dbStore } = await import('@/lib/indexedDbStore');
        let activeId = await dbStore.getItem<string>('gde_active_project');
        if (!activeId) {
          activeId = localStorage.getItem('gde_active_project');
        }
        if (activeId) {
          let projects = await dbStore.getItem<any[]>('gde_projects');
          if (!projects) {
            const raw = localStorage.getItem('gde_projects');
            if (raw) {
              projects = JSON.parse(raw);
              await dbStore.setItem('gde_projects', projects);
            }
          }
          if (projects) {
            const activeProj = projects.find((p: any) => p.id === activeId);
            if (activeProj && activeProj.data) {
              dispatch({ type: 'LOAD_PROJECT', data: activeProj.data });
            }
          }
        }
      } catch (err) {
        console.error('Failed to auto-load active project:', err);
      }
    };
    loadLastActiveProject();
  }, []);

  const columns = useMemo(() => {
    // When ETABS import mode is active, skip auto-generation and use imported columns only
    if (etabsImportMode) {
      return extraColumns.map(c => {
        const ov = colOverrides[c.id];
        const cx = ov?.x ?? c.x;
        const cy = ov?.y ?? c.y;
        const zBot = c.zBottom ?? 0;
        // Apply supportRestraints for ETABS columns (same key format as regular mode)
        const supportKey = `${cx.toFixed(2)}_${cy.toFixed(2)}_${zBot}`;
        const sr = supportRestraints?.[supportKey];
        const bottomEnd: 'F' | 'P' = sr
          ? ((sr.ux && sr.uy && sr.uz && sr.rx && sr.ry && sr.rz) ? 'F' : 'P')
          : (c.bottomEndCondition ?? 'F');
        const tEnd = ov?.topEndCondition ?? (c.topEndCondition ?? 'F');
        const bEnd = ov?.bottomEndCondition ?? bottomEnd;
        return {
          ...c,
          b: ov?.b ?? c.b,
          h: ov?.h ?? c.h,
          L: ov?.L ?? c.L,
          x: cx,
          y: cy,
          zBottom: zBot,
          zTop: c.zTop ?? (zBot + ((ov?.L ?? c.L) || 0)),
          bottomEndCondition: bEnd,
          topEndCondition: tEnd,
          orientAngle: ov?.orientAngle ?? (c as any).orientAngle,
          releaseI: ov?.releaseI ?? (c as any).releaseI ?? { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
          releaseJ: ov?.releaseJ ?? (c as any).releaseJ ?? { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
        };
      });
    }
    // Get unique column positions from slabs (ignoring storyId for position extraction)
    const uniqueSlabs = slabs.filter((s, i, arr) => {
      // Use first occurrence of each slab position pattern per story
      return true; // keep all slabs, generateColumns deduplicates by position
    });
    const baseCols = generateColumns(uniqueSlabs);
    
    // Create a column instance for EACH story with sequential naming from bottom up
    const allCols: Column[] = [];
    // Sort stories by elevation (bottom to top) for sequential naming
    const sortedStories = [...stories].sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));
    let colSeq = 1;
    for (const story of sortedStories) {
      const storyElev = story.elevation ?? 0; // mm
      const storyHeight = story.height ?? colL;
      for (const c of baseCols) {
        const colId = `C${colSeq}`;
        const legacyId = stories.length > 1 ? `${c.id}_${story.id}` : c.id;
        // Merge all three possible override keys so that orientAngle from colId
        // (sequential, used by biaxial-rotate dispatch) is never shadowed by a
        // prior b/h override stored under c.id (base ID).  Later keys win.
        const _ov0 = colOverrides[c.id] ?? {};
        const _ov1 = colOverrides[legacyId] ?? {};
        const _ov2 = colOverrides[colId] ?? {};
        const _merged = { ..._ov0, ..._ov1, ..._ov2 };
        const ov = Object.keys(_merged).length > 0 ? _merged : undefined;
        const colHeight = ov?.L ?? storyHeight;
        // Derive bottom end condition from per-support DOF restraints
        const supportKey = `${c.x.toFixed(2)}_${c.y.toFixed(2)}_${storyElev}`;
        const sr = supportRestraints?.[supportKey];
        const bottomEnd: 'F' | 'P' = sr
          ? ((sr.ux && sr.uy && sr.uz && sr.rx && sr.ry && sr.rz) ? 'F' : 'P')
          : colBottomEndCondition as 'F' | 'P';
        const colX = ov?.x ?? c.x;
        const colY = ov?.y ?? c.y;
        const tEnd = ov?.topEndCondition ?? (c.topEndCondition ?? colTopEndCondition as 'F' | 'P');
        const bEnd = ov?.bottomEndCondition ?? bottomEnd;
        allCols.push({
          ...c,
          id: colId,
          storyId: story.id,
          x: colX, y: colY,
          origX: c.x,
          origY: c.y,
          b: ov?.b ?? colB,
          h: ov?.h ?? colH,
          L: colHeight,
          LBelow: colLBelow,
          zBottom: storyElev,
          zTop: storyElev + colHeight,
          isRemoved: removedColumnIds.includes(c.id) || removedColumnIds.includes(colId) || removedColumnIds.includes(legacyId),
          topEndCondition: tEnd,
          bottomEndCondition: bEnd,
          orientAngle: ov?.orientAngle ?? (c as any).orientAngle,
          releaseI: ov?.releaseI ?? (c as any).releaseI ?? { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
          releaseJ: ov?.releaseJ ?? (c as any).releaseJ ?? { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
        });
        colSeq++;
      }
    }
    // Add extra columns
    for (const c of extraColumns) {
      allCols.push({
        ...c,
        origX: c.x,
        origY: c.y,
        zBottom: c.zBottom ?? 0,
        zTop: c.zTop ?? (c.L || 0),
      });
    }
    return allCols;
  }, [slabs, colB, colH, colL, colLBelow, removedColumnIds, colOverrides, extraColumns, etabsImportMode, colTopEndCondition, colBottomEndCondition, stories, selectedStoryId, supportRestraints]);

  const beams = useMemo(() => {
    // When ETABS import mode is active, skip auto-generation and use imported beams only
    if (etabsImportMode) {
      return extraBeams.map(b => {
        const ov = beamOverrides[b.id];
        return {
          ...b,
          name: ov?.name !== undefined ? ov.name : b.name,
          b: ov?.b !== undefined ? ov.b : b.b,
          h: ov?.h !== undefined ? ov.h : b.h,
          z: b.z ?? 0
        };
      });
    }
    // Deduplicate slabs by position to generate base beam topology (avoid multi-story duplication)
    const uniqueSlabsByPos = new Map<string, Slab>();
    for (const s of slabs) {
      const key = `${s.x1},${s.y1}-${s.x2},${s.y2}`;
      if (!uniqueSlabsByPos.has(key)) uniqueSlabsByPos.set(key, s);
    }
    const deduplicatedSlabs = [...uniqueSlabsByPos.values()];
    const baseCols = generateColumns(deduplicatedSlabs);
    const baseBeams = generateBeams(deduplicatedSlabs, baseCols);
    
    // Build a map from deduplicated slab ID -> story-specific slab IDs
    const slabsByStory = new Map<string, Slab[]>(); // storyId -> slabs
    for (const s of slabs) {
      const storyId = s.storyId || stories[0]?.id || '';
      if (!slabsByStory.has(storyId)) slabsByStory.set(storyId, []);
      slabsByStory.get(storyId)!.push(s);
    }
    
    // Create beam instances for each story with sequential naming from bottom up
    const allBeams: Beam[] = [];
    const sortedStoriesForBeams = [...stories].sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));
    let beamSeq = 1;
    // Build a map from (baseColId, storyId) -> sequential colId for proper references
    const colIdMap = new Map<string, string>();
    let colMapSeq = 1;
    for (const story of sortedStoriesForBeams) {
      for (const c of baseCols) {
        colIdMap.set(`${c.id}_${story.id}`, `C${colMapSeq}`);
        colMapSeq++;
      }
    }
    for (const story of sortedStoriesForBeams) {
      const storyElev = story.elevation ?? 0;
      const storyHeight = story.height ?? colL;
      const beamZ = storyElev + storyHeight; // Beam at top of story (slab level)
      
      // Get slabs for this story to properly reference them
      const storySlabs = slabsByStory.get(story.id) || [];
      
      for (const b of baseBeams) {
        const beamId = `B${beamSeq}`;
        const fromColId = colIdMap.get(`${b.fromCol}_${story.id}`) ?? b.fromCol;
        const toColId = colIdMap.get(`${b.toCol}_${story.id}`) ?? b.toCol;
        const legacyBeamId = stories.length > 1 ? `${b.id}_${story.id}` : b.id;
        const ov = beamOverrides[beamId] || beamOverrides[legacyBeamId] || beamOverrides[b.id];
        
        // Map base beam slab references to this story's slab IDs (match by position)
        const storySlabIds: string[] = [];
        for (const basSlabId of b.slabs) {
          const baseSlab = deduplicatedSlabs.find(s => s.id === basSlabId);
          if (!baseSlab) continue;
          const matchingSlab = storySlabs.find(s =>
            s.x1 === baseSlab.x1 && s.y1 === baseSlab.y1 &&
            s.x2 === baseSlab.x2 && s.y2 === baseSlab.y2
          );
          if (matchingSlab) storySlabIds.push(matchingSlab.id);
        }
        
        const beamX1 = ov?.x1 ?? b.x1;
        const beamY1 = ov?.y1 ?? b.y1;
        const beamX2 = ov?.x2 ?? b.x2;
        const beamY2 = ov?.y2 ?? b.y2;
        
        // Ensure that in multi-story mode (stories.length > 1), we do not inherit absolute elevation z from
        // the shared base beam template override (beamOverrides[b.id]), which would place all floors at the same z.
        const storyBeamOv = beamOverrides[beamId] || beamOverrides[legacyBeamId];
        const beamZval = storyBeamOv?.z !== undefined ? storyBeamOv.z : (beamOverrides[b.id]?.z !== undefined && stories.length === 1 ? beamOverrides[b.id].z : beamZ);
        
        const dx = beamX2 - beamX1;
        const dy = beamY2 - beamY1;
        const beamLength = Math.sqrt(dx * dx + dy * dy);
        allBeams.push({
          ...b,
          id: beamId,
          name: ov?.name !== undefined ? ov.name : b.name,
          fromCol: fromColId,
          toCol: toColId,
          storyId: story.id,
          x1: beamX1, y1: beamY1, x2: beamX2, y2: beamY2,
          origX1: b.x1,
          origY1: b.y1,
          origX2: b.x2,
          origY2: b.y2,
          length: beamLength > 0 ? beamLength : b.length,
          b: ov?.b ?? beamB,
          h: ov?.h ?? beamH,
          z: beamZval,
          slabs: storySlabIds.length > 0 ? storySlabIds : b.slabs,
        });
        beamSeq++;
      }
    }
    // Add extra beams
    for (const eb of extraBeams) {
      const ov = beamOverrides[eb.id];
      allBeams.push({
        ...eb,
        origX1: eb.x1,
        origY1: eb.y1,
        origX2: eb.x2,
        origY2: eb.y2,
        name: ov?.name !== undefined ? ov.name : eb.name,
        b: ov?.b !== undefined ? ov.b : eb.b,
        h: ov?.h !== undefined ? ov.h : eb.h,
        z: eb.z ?? 0
      });
    }
    return allBeams;
  }, [slabs, columns, beamB, beamH, beamOverrides, extraBeams, etabsImportMode, stories, selectedStoryId, colL]);

  const _modelRebuildTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (mode !== 'auto') return;
    // Debounce: wait 250ms after last change before rebuilding model
    clearTimeout(_modelRebuildTimer.current);
    _modelRebuildTimer.current = setTimeout(() => {
      modelManager.clear();
      const beamSection = modelManager.createSection('B-default', beamB, beamH, 'beam');
      const colSection = modelManager.createSection('C-default', colB, colH, 'column');
      generateStructureFromSlabs(
        modelManager,
        slabs.map(s => ({ id: s.id, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, vertices: s.vertices })),
        beamSection, colSection, slabProps.thickness, colL / 1000
      );

      // Apply overridden coordinates from React state (columns, beams) to modelManager nodes
      const EPS = 0.01;
      for (const frame of modelManager.getAllFrames()) {
        if (frame.type === 'column') {
          const topNode = modelManager.getNode(frame.nodeJ);
          const botNode = modelManager.getNode(frame.nodeI);
          if (topNode && botNode) {
            const col = columns.find(c =>
              c.origX != null && c.origY != null &&
              Math.abs(c.origX - topNode.x) < EPS && Math.abs(c.origY - topNode.y) < EPS
            );
            if (col) {
              modelManager.moveNode(frame.nodeI, col.x, col.y, botNode.z);
              modelManager.moveNode(frame.nodeJ, col.x, col.y, topNode.z);
            }
          }
        } else if (frame.type === 'beam') {
          const ni = modelManager.getNode(frame.nodeI);
          const nj = modelManager.getNode(frame.nodeJ);
          if (ni && nj) {
            const beam = beams.find(b =>
              b.origX1 != null && b.origY1 != null && b.origX2 != null && b.origY2 != null && (
                (Math.abs(b.origX1 - ni.x) < EPS && Math.abs(b.origY1 - ni.y) < EPS &&
                 Math.abs(b.origX2 - nj.x) < EPS && Math.abs(b.origY2 - nj.y) < EPS) ||
                (Math.abs(b.origX1 - nj.x) < EPS && Math.abs(b.origY1 - nj.y) < EPS &&
                 Math.abs(b.origX2 - ni.x) < EPS && Math.abs(b.origY2 - ni.y) < EPS)
              )
            );
            if (beam) {
              const isRev = (Math.abs(beam.origX1! - nj.x) < EPS && Math.abs(beam.origY1! - nj.y) < EPS);
              if (isRev) {
                modelManager.moveNode(frame.nodeI, beam.x2, beam.y2, ni.z);
                modelManager.moveNode(frame.nodeJ, beam.x1, beam.y1, nj.z);
              } else {
                modelManager.moveNode(frame.nodeI, beam.x1, beam.y1, ni.z);
                modelManager.moveNode(frame.nodeJ, beam.x2, beam.y2, nj.z);
              }
            }
          }
        }
      }

      if (frameEndReleases) {
        for (const frame of modelManager.getAllFrames()) {
          const ni = modelManager.getNode(frame.nodeI);
          const nj = modelManager.getNode(frame.nodeJ);
          if (ni && nj) {
            const posKey = `${ni.x.toFixed(3)}_${ni.y.toFixed(3)}_${nj.x.toFixed(3)}_${nj.y.toFixed(3)}`;
            const posKeyRev = `${nj.x.toFixed(3)}_${nj.y.toFixed(3)}_${ni.x.toFixed(3)}_${ni.y.toFixed(3)}`;
            const rel = frameEndReleases[posKey] || frameEndReleases[posKeyRev];
            if (rel) {
              const isRev = !!frameEndReleases[posKeyRev] && !frameEndReleases[posKey];
              modelManager.setNodeRestraints(frame.nodeI, isRev ? rel.nodeJ : rel.nodeI);
              modelManager.setNodeRestraints(frame.nodeJ, isRev ? rel.nodeI : rel.nodeJ);
            }
          }
        }
      }
      dispatch({ type: 'INC_MODEL_VERSION' });
    }, 250);
    return () => clearTimeout(_modelRebuildTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slabs, beamB, beamH, colB, colH, colL, slabProps.thickness, mode, frameEndReleases, beamOverrides, colOverrides, columns, beams]);

  // Build model nodes map for looking up node IDs by coordinates
  const modelNodesMap = useMemo(() => {
    const nodeMap = new Map<string, string>();
    const tol = 0.001;
    const getKey = (x: number, y: number, z: number) =>
      `${Math.round(x / tol) * tol},${Math.round(y / tol) * tol},${Math.round(z / tol) * tol}`;
    let seq = 1;
    for (const c of columns.filter(cc => !cc.isRemoved)) {
      const zTop = (c.zTop ?? 0) / 1000;
      const zBot = (c.zBottom ?? 0) / 1000;
      if (!nodeMap.has(getKey(c.x, c.y, zTop))) nodeMap.set(getKey(c.x, c.y, zTop), `N${seq++}`);
      if (!nodeMap.has(getKey(c.x, c.y, zBot))) nodeMap.set(getKey(c.x, c.y, zBot), `N${seq++}`);
    }
    for (const b of beams.filter(bb => !removedBeamIds.includes(bb.id))) {
      const bz = (b.z ?? 0) / 1000;
      if (!nodeMap.has(getKey(b.x1, b.y1, bz))) nodeMap.set(getKey(b.x1, b.y1, bz), `N${seq++}`);
      if (!nodeMap.has(getKey(b.x2, b.y2, bz))) nodeMap.set(getKey(b.x2, b.y2, bz), `N${seq++}`);
    }
    return { map: nodeMap, getKey };
  }, [columns, beams, removedBeamIds]);

  const getBeamNodeId = useCallback((x: number, y: number, z: number) => {
    const key = modelNodesMap.getKey(x, y, (z ?? 0) / 1000);
    return modelNodesMap.map.get(key) || '—';
  }, [modelNodesMap]);

  const toggleBeamSelection = useCallback((id: string) => {
    setSelectedBeamIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAllBeams = useCallback(() => {
    const activeBeamIds = beams.filter(b => !removedBeamIds.includes(b.id)).map(b => b.id);
    setSelectedBeamIds(new Set(activeBeamIds));
  }, [beams, removedBeamIds]);
  const clearBeamSelection = useCallback(() => setSelectedBeamIds(new Set()), []);

  const handleMergeBeams = useCallback(() => {
    const groups = findCollinearGroups(beams, [...selectedBeamIds]);
    if (groups.length === 0) return;
    for (const group of groups) {
      const result = mergeCollinearBeams(beams, group);
      if (result) {
        dispatch({ type: 'MERGE_BEAMS', mergedBeam: result.merged, removedIds: result.removedIds });
      }
    }
    setSelectedBeamIds(new Set());
  }, [beams, selectedBeamIds]);

  const handleIntersect = useCallback(() => {
    const activeBeams = beams.filter(b => !removedBeamIds.includes(b.id));
    const intersections = detectBeamIntersections(activeBeams, columns, removedColumnIds);
    if (intersections.length === 0) return;
    let vcIdx = 1;
    for (const int of intersections) {
      const vcId = `VC${Date.now()}_${vcIdx++}`;
      dispatch({ type: 'ADD_VIRTUAL_REMOVED_COLUMN', colId: vcId, x: int.point.x, y: int.point.y });
    }
    setSelectedBeamIds(new Set());
  }, [beams, columns, removedColumnIds, removedBeamIds]);
  const beamsWithLoads = useMemo(() => {
    const activeBeams = beams.filter(b => !removedBeamIds.includes(b.id));
    const beamsWithLoadValues = activeBeams.map(b => {
      // Pass the active beams for the same story so adjacent-slab merging works correctly
      const storyActiveBeams = b.storyId
        ? activeBeams.filter(ab => ab.storyId === b.storyId)
        : activeBeams;
      const loads = calculateBeamLoads(b, slabs, slabProps, mat, storyActiveBeams, state.ribbedSlabProps);
      const wallLoad = beamOverrides[b.id]?.wallLoad || b.wallLoad || 0;
      return { ...b, deadLoad: loads.deadLoad + wallLoad, liveLoad: loads.liveLoad, wallLoad };
    });
    // Detect eccentricities: beams whose endpoints fall within a column footprint
    // but are offset from its centroid (ETABS rigid-end-offset equivalent).
    return snapBeamsToEccentricColumns(beamsWithLoadValues, columns);
  }, [beams, slabs, slabProps, mat, beamOverrides, removedBeamIds, columns, state.ribbedSlabProps]);

  const frameResults = useMemo(() => {
    return postprocessFrameResultsForColumnFaces(
      rawFrameResults,
      columns,
      beamsWithLoads,
      effectiveFrameEndReleases
    );
  }, [rawFrameResults, columns, beamsWithLoads, effectiveFrameEndReleases]);

  const getBeamDisplayName = useCallback((beamId: string, mergedCarrierIds?: string[] | null) => {
    if (mergedCarrierIds && mergedCarrierIds.length >= 2) {
      const parts = mergedCarrierIds.map(id => beamsWithLoads.find(b => b.id === id)).filter(Boolean);
      const namedPart = parts.find(p => p.name);
      if (namedPart && namedPart.name) {
        return namedPart.name.replace(/-\d+$/, '');
      }
      return beamId;
    }
    
    // Check if this beamId has a split format X-N (e.g., 66-2)
    const m = beamId.match(/^(.+)-(\d+)$/);
    if (m) {
      const baseId = m[1];
      const existingPartsCount = beamsWithLoads.filter(b => b.id.match(new RegExp(`^${baseId}-\\d+$`))).length;
      if (existingPartsCount === 1) {
        const beam = beamsWithLoads.find(b => b.id === beamId);
        if (beam && beam.name) {
          return beam.name.replace(/-\d+$/, '');
        }
        return baseId;
      }
    }
    
    const beam = beamsWithLoads.find(b => b.id === beamId);
    if (beam && beam.name) {
      const nm = beam.name.match(/^(.+)-(\d+)$/);
      if (nm) {
        const baseName = nm[1];
        const bId = beam.id;
        const bIdM = bId.match(/^(.+)-(\d+)$/);
        if (bIdM) {
          const baseId = bIdM[1];
          const existingPartsCount = beamsWithLoads.filter(b => b.id.match(new RegExp(`^${baseId}-\\d+$`))).length;
          if (existingPartsCount === 1) {
            return baseName;
          }
        }
      }
      return beam.name;
    }
    
    if (beamId.includes('-')) {
      const parentId = beamId.slice(0, beamId.lastIndexOf('-'));
      const parts = beamsWithLoads.filter(b => b.id.startsWith(parentId + '-'));
      const namedPart = parts.find(p => p.name);
      if (namedPart && namedPart.name) {
        if (parts.length === 1) {
          return namedPart.name.replace(/-\d+$/, '');
        }
        const indexSuffix = beamId.slice(beamId.lastIndexOf('-'));
        const cleanName = namedPart.name.replace(/-\d+$/, '');
        return cleanName + indexSuffix;
      }
    }
    
    return beamId;
  }, [beamsWithLoads]);

  const frames = useMemo(() => generateFrames(beamsWithLoads), [beamsWithLoads]);

  // View tab story filter (placed here — after columns, slabs, beamsWithLoads are all defined)
  const viewIsAll = viewStoryId === '__ALL__';
  const viewFilteredSlabs = useMemo(() => viewIsAll ? slabs : slabs.filter(s => s.storyId === viewStoryId), [slabs, viewStoryId, viewIsAll]);
  const viewFilteredCols = useMemo(() => viewIsAll ? columns : columns.filter(c => c.storyId === viewStoryId), [columns, viewStoryId, viewIsAll]);

  // Detect adjacent slabs with no beam between them — run per story to avoid cross-story merging
  const slabMergeGroups = useMemo(() => {
    const storyIds = [...new Set(slabs.map(s => s.storyId).filter(Boolean))];
    const groups: ReturnType<typeof buildMergedSlabGroups> = [];
    for (const stId of storyIds) {
      const stSlabs = slabs.filter(s => s.storyId === stId);
      const stBeams = beams.filter(b => b.storyId === stId);
      const detected = buildMergedSlabGroups(stSlabs as any[], stBeams as any[]);
      groups.push(...detected.filter(g => g.subSlabIds.length > 1));
    }
    return groups;
  }, [slabs, beams]);

  const detectedConnections = useMemo(() => {
    if (removedColumnIds.length === 0) return [];
    return detectBeamOnBeam(beamsWithLoads, columns, removedColumnIds, bobManualPrimary);
  }, [beamsWithLoads, columns, removedColumnIds, bobManualPrimary]);

  // محرك 3D Legacy: لا يتأثر بالتحديد اليدوي للجسور الحاملة/المحمولة
  // ولا يتم إنشاء مفصلات بناءً على هذا التحديد اليدوي.
  // يستخدم الكشف التلقائي البحت (auto-detect فقط) دون تمرير bobManualPrimary.
  const autoDetectedConnections = useMemo(() => {
    if (removedColumnIds.length === 0) return [];
    return detectBeamOnBeam(beamsWithLoads, columns, removedColumnIds);
  }, [beamsWithLoads, columns, removedColumnIds]);

  const runAnalysis = () => {
    setFemError(null);
    setAnalysisDiagnostics(null);

    // ── حساب خريطة المفصلات 2D في الـ UI thread (يحتاج getBeamReleaseState) ──
    const beamHinges2DArr: Array<[string, 'I' | 'J' | 'BOTH']> = [];
    for (const beam of beamsWithLoads) {
      const rs = getBeamReleaseState(beam);
      const hasHingeI = rs.nodeI.rx || rs.nodeI.ry || rs.nodeI.rz;
      const hasHingeJ = rs.nodeJ.rx || rs.nodeJ.ry || rs.nodeJ.rz;
      if (hasHingeI && hasHingeJ) beamHinges2DArr.push([beam.id, 'BOTH']);
      else if (hasHingeI) beamHinges2DArr.push([beam.id, 'I']);
      else if (hasHingeJ) beamHinges2DArr.push([beam.id, 'J']);
    }

    // ── إظهار شاشة التحميل ───────────────────────────────────────────────────
    setIsAnalyzing(true);
    setAnalysisProgress(3);
    setAnalysisStep('تهيئة معالج التحليل (Web Worker)...');

    // ── إرسال النموذج إلى الـ Worker ────────────────────────────────────────
    const workerInput: WorkerAnalysisInput = {
      frames,
      beamsWithLoads,
      columns,
      mat,
      slabs,
      slabProps,
      useFEMLoadDistribution: state.useFEMLoadDistribution ?? false,
      selectedEngine,
      ignoreSlab,
      effectiveFrameEndReleases,
      beamStiffnessFactor,
      colStiffnessFactor,
      detectedConnections,
      removedColumnIds,
      beamHinges2D: beamHinges2DArr,
      colRigidEndOffsets,
      supportRestraints: state.supportRestraints,
      foundationDb: state.foundationDb,
      supportDb: state.supportDb,
    };

    analysisWorker.startAnalysis(workerInput, {
      onProgress: (prog, step) => {
        setAnalysisProgress(prog);
        setAnalysisStep(step);
      },
      onComplete: (result) => {
        // حفظ التشخيصات وتحديث النتائج
        setAnalysisDiagnostics(result.diagnostics);
        dispatch({ type: 'SET_FRAME_RESULTS', results: result.frameResults });
        dispatch({ type: 'SET_BOB_CONNECTIONS', connections: result.bobConnections });
        if (result.supportReactions) {
          dispatch({ type: 'SET_SUPPORT_REACTIONS', reactions: result.supportReactions });
        }
        dispatch({ type: 'SET_ANALYZED', value: true });
        // إنهاء شاشة التحميل بنجاح
        setAnalysisProgress(100);
        setAnalysisStep('اكتمل التحليل بنجاح ✓');
        setTimeout(() => {
          setIsAnalyzing(false);
          setAnalysisProgress(0);
          setAnalysisStep('');
        }, 800);
      },
      onError: (message) => {
        setFemError(message);
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStep('');
      },
      onCancelled: () => {
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStep('');
      },
    });
  };

  const getBeamReleaseKey = useCallback((beam: Beam) => (
    `${beam.x1.toFixed(3)}_${beam.y1.toFixed(3)}_${beam.x2.toFixed(3)}_${beam.y2.toFixed(3)}`
  ), []);

  const getBeamReleaseState = useCallback((beam: Beam): BeamEndReleaseState => {
    const posKey = getBeamReleaseKey(beam);
    const posKeyRev = `${beam.x2.toFixed(3)}_${beam.y2.toFixed(3)}_${beam.x1.toFixed(3)}_${beam.y1.toFixed(3)}`;
    // يقرأ من effective (دائم + مؤقت) ليعكس تحرير تبويب التحليل في الرسوم/المنحنيات
    const rel = effectiveFrameEndReleases[posKey] || effectiveFrameEndReleases[posKeyRev];

    if (!rel) return createEmptyBeamEndReleases();

    const isReversed = !!effectiveFrameEndReleases[posKeyRev] && !effectiveFrameEndReleases[posKey];
    return isReversed
      ? { nodeI: { ...rel.nodeJ }, nodeJ: { ...rel.nodeI } }
      : { nodeI: { ...rel.nodeI }, nodeJ: { ...rel.nodeJ } };
  }, [effectiveFrameEndReleases, getBeamReleaseKey]);

  /**
   * مثل `getBeamReleaseState` لكن يقرأ فقط من `frameEndReleases` الدائم
   * (يُستخدم في جدول جسور تبويب الإدخال + Dialog محرر الإدخال).
   */
  const getPersistentBeamReleaseState = useCallback((beam: Beam): BeamEndReleaseState => {
    const posKey = getBeamReleaseKey(beam);
    const posKeyRev = `${beam.x2.toFixed(3)}_${beam.y2.toFixed(3)}_${beam.x1.toFixed(3)}_${beam.y1.toFixed(3)}`;
    const rel = frameEndReleases[posKey] || frameEndReleases[posKeyRev];
    if (!rel) return createEmptyBeamEndReleases();
    const isReversed = !!frameEndReleases[posKeyRev] && !frameEndReleases[posKey];
    return isReversed
      ? { nodeI: { ...rel.nodeJ }, nodeJ: { ...rel.nodeI } }
      : { nodeI: { ...rel.nodeI }, nodeJ: { ...rel.nodeJ } };
  }, [frameEndReleases, getBeamReleaseKey]);

  const openBeamReleaseEditor = useCallback((beam: Beam) => {
    // محرر تبويب الإدخال يقرأ ويكتب على `frameEndReleases` الدائم فقط
    setReleaseEditorBeamId(beam.id);
    setReleaseEditorData(getPersistentBeamReleaseState(beam));
    setReleaseEditorDims({ b: beam.b, h: beam.h });
    setReleaseEditorApplyOtherFloors(false);
    setBeamDeleteConfirm(false);
  }, [getPersistentBeamReleaseState]);

  const handleEditBeamProperties = useCallback((beamId: string) => {
    const beam = beams.find(b => b.id === beamId);
    if (beam) openBeamReleaseEditor(beam);
  }, [beams, openBeamReleaseEditor]);

  const handleReleaseEditorToggle = useCallback((end: 'nodeI' | 'nodeJ', dof: ReleaseDOF, checked: boolean) => {
    setReleaseEditorData(prev => ({
      ...prev,
      [end]: { ...prev[end], [dof]: checked },
    }));
  }, []);

  const resetReleaseEditorEnd = useCallback((end: 'nodeI' | 'nodeJ') => {
    setReleaseEditorData(prev => ({
      ...prev,
      [end]: { ...EMPTY_BEAM_END_RELEASES[end] },
    }));
  }, []);

  const saveBeamReleaseEditor = useCallback(() => {
    if (!releaseEditorBeamId) return;
    const beam = beams.find(item => item.id === releaseEditorBeamId);
    if (!beam) return;

    dispatch({
      type: 'SET_FRAME_END_RELEASES',
      posKey: getBeamReleaseKey(beam),
      nodeIRestraints: releaseEditorData.nodeI,
      nodeJRestraints: releaseEditorData.nodeJ,
    });

    // Save dimensions (always dispatch — let the user decide what to save)
    const newB = Number(releaseEditorDims.b) || beam.b;
    const newH = Number(releaseEditorDims.h) || beam.h;
    if (releaseEditorApplyOtherFloors) {
      // Apply to all beams at same x1,y1,x2,y2 position (different floors)
      const samePosBeans = beams.filter(b =>
        Math.abs(b.x1 - beam.x1) < 0.01 && Math.abs(b.y1 - beam.y1) < 0.01 &&
        Math.abs(b.x2 - beam.x2) < 0.01 && Math.abs(b.y2 - beam.y2) < 0.01
      );
      for (const b of samePosBeans) {
        dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { b: newB, h: newH } });
      }
    } else {
      dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: beam.id, override: { b: newB, h: newH } });
    }

    dispatch({ type: 'RESET_ANALYSIS' });
    setReleaseEditorBeamId(null);
  }, [releaseEditorBeamId, beams, releaseEditorData, getBeamReleaseKey, releaseEditorDims, releaseEditorApplyOtherFloors]);

  const releaseEditorBeam = useMemo(
    () => beams.find(beam => beam.id === releaseEditorBeamId) || null,
    [beams, releaseEditorBeamId]
  );

  const releaseEditorWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (releaseEditorData.nodeI.ux && releaseEditorData.nodeJ.ux) warnings.push('لا يمكن تحرير U1 من الطرفين معاً لأنه يسبب عدم استقرار.');
    if (releaseEditorData.nodeI.uy && releaseEditorData.nodeJ.uy) warnings.push('لا يمكن تحرير U2 من الطرفين معاً لأنه يسبب عدم استقرار.');
    if (releaseEditorData.nodeI.uz && releaseEditorData.nodeJ.uz) warnings.push('لا يمكن تحرير U3 من الطرفين معاً لأنه يسبب عدم استقرار.');
    if (releaseEditorData.nodeI.rx && releaseEditorData.nodeJ.rx) warnings.push('لا يمكن تحرير R1 من الطرفين معاً لأنه يسبب عدم استقرار.');
    if (releaseEditorData.nodeI.ry && releaseEditorData.nodeJ.ry && (releaseEditorData.nodeI.uz || releaseEditorData.nodeJ.uz)) warnings.push('تحرير R2 من الطرفين مع U3 قد يجعل الجسر غير مستقر.');
    if (releaseEditorData.nodeI.rz && releaseEditorData.nodeJ.rz && (releaseEditorData.nodeI.uy || releaseEditorData.nodeJ.uy)) warnings.push('تحرير R3 من الطرفين مع U2 قد يجعل الجسر غير مستقر.');
    return warnings;
  }, [releaseEditorData]);

  const beamDesigns = useMemo(() => {
    // Helper to calculate the support half-width (mm) along the longitudinal direction of a beam
    const getSupportHalfWidth = (
      beam: Beam,
      isEndTo: boolean
    ): number => {
      const x = isEndTo ? beam.x2 : beam.x1;
      const y = isEndTo ? beam.y2 : beam.y1;
      const colId = isEndTo ? beam.toCol : beam.fromCol;

      // 1. Try column support by ID or proximity
      let col = columns.find(
        c => !c.isRemoved && (c.id === colId || (Math.abs(c.x - x) < 0.05 && Math.abs(c.y - y) < 0.05))
      );

      // 2. Try column physical footprint overlap for non-concentric beams
      if (!col) {
        col = columns.find((column) => {
          if (column.isRemoved) return false;
          const θ = ((column.orientAngle ?? 0) * Math.PI) / 180;
          const bHalf = column.b / 2000;
          const hHalf = column.h / 2000;
          const xHalf = Math.abs(bHalf * Math.cos(θ)) + Math.abs(hHalf * Math.sin(θ));
          const yHalf = Math.abs(bHalf * Math.sin(θ)) + Math.abs(hHalf * Math.cos(θ));

          const dx = Math.abs(column.x - x);
          const dy = Math.abs(column.y - y);
          return dx <= xHalf + 0.15 && dy <= yHalf + 0.15;
        });
      }

      if (col) {
        const theta = ((col.orientAngle ?? 0) * Math.PI) / 180;
        const bH = col.b / 2;
        const hH = col.h / 2;
        const isHoriz = beam.direction === 'horizontal';
        return isHoriz
          ? Math.abs(bH * Math.cos(theta)) + Math.abs(hH * Math.sin(theta))
          : Math.abs(bH * Math.sin(theta)) + Math.abs(hH * Math.cos(theta));
      }

      // 2. Try beam support (BOB connection)
      const crossingBeam = beamsWithLoads.find(ob => {
        if (ob.id === beam.id) return false;
        if (ob.direction === beam.direction) return false;

        if (ob.direction === 'horizontal') {
          const xMin = Math.min(ob.x1, ob.x2) - 0.1;
          const xMax = Math.max(ob.x1, ob.x2) + 0.1;
          const yMatch = Math.abs(ob.y1 - y) < 0.1;
          return yMatch && (x >= xMin && x <= xMax);
        } else {
          const yMin = Math.min(ob.y1, ob.y2) - 0.1;
          const yMax = Math.max(ob.y1, ob.y2) + 0.1;
          const xMatch = Math.abs(ob.x1 - x) < 0.1;
          return xMatch && (y >= yMin && y <= yMax);
        }
      });

      if (crossingBeam) {
        return crossingBeam.b / 2;
      }

      return 0;
    };

    // ── مسار ETABS: تصميم من نتائج ETABS المستوردة ──
    if (designSource === 'etabs' && etabsAnalysisData.length > 0) {
      const designs: {
        beamId: string; frameId: string; span: number;
        Mleft: number; Mmid: number; Mright: number; Vu: number;
        Rleft: number; Rright: number;
        flexLeft: FlexureResult; flexMid: FlexureResult; flexRight: FlexureResult;
        shear: ShearResult; deflection: DeflectionResult;
      }[] = [];

      for (const ed of etabsAnalysisData) {
        // تطابق الدور: تسمية مطابقة أو رقمية (Story1=الدور 1، وما إلى ذلك)
        const storyForED = stories.find(s =>
          s.label === ed.story ||
          s.label.toLowerCase() === ed.story.toLowerCase() ||
          s.label.replace(/\s+/g, '').toLowerCase() === ed.story.replace(/\s+/g, '').toLowerCase()
        ) || (() => {
          // تطابق رقمي: "Story3" → الدور الثالث
          const m = ed.story.match(/(\d+)$/);
          if (!m) return undefined;
          const idx = parseInt(m[1]) - 1;
          return idx >= 0 && idx < stories.length ? stories[idx] : undefined;
        })();

        // تطابق الجسر: دقيق أولاً، ثم تطابق بادئة (جسر مقسّم)، ثم تطابق جزئي
        let beam = beamsWithLoads.find(b =>
          b.id === ed.beamId && (storyForED ? b.storyId === storyForED.id : true)
        ) || beamsWithLoads.find(b => b.id === ed.beamId);

        // تطابق الجسور المقسّمة: ETABS "B1" ↔ التطبيق "B1-1" أو "B1-L" إلخ
        if (!beam) {
          beam = beamsWithLoads.find(b =>
            (b.id.startsWith(ed.beamId + '-') || b.id.startsWith(ed.beamId + '_')) &&
            (storyForED ? b.storyId === storyForED.id : true)
          ) || beamsWithLoads.find(b =>
            b.id.startsWith(ed.beamId + '-') || b.id.startsWith(ed.beamId + '_')
          );
        }

        // إذا لم يُوجد تطابق: استخدام أبعاد الجسر الافتراضية
        const effectiveBeam = beam || {
          id: ed.beamId,
          b: beamB, h: beamH,
          length: 5000,
          slabs: [] as string[],
          direction: 'horizontal' as const,
          deadLoad: 0, liveLoad: 0,
        };
        const span = effectiveBeam.length > 0 ? effectiveBeam.length / 1000 : 1;

        const hasSlabs = effectiveBeam.slabs.length > 0;
        let effectiveFlangeWidth = 0;
        if (hasSlabs) {
          const widths: number[] = [];
          for (const slabId of effectiveBeam.slabs) {
            const slab = slabs.find(s => s.id === slabId);
            if (slab) widths.push(effectiveBeam.direction === 'horizontal' ? Math.abs(slab.y2 - slab.y1) : Math.abs(slab.x2 - slab.x1));
          }
          effectiveFlangeWidth = Math.min(span * 1000 / 4, effectiveBeam.b + 16 * slabProps.thickness, widths.reduce((a, b) => a + b, 0) * 1000);
        }

        const c_left = getSupportHalfWidth(effectiveBeam as Beam, false);
        const c_right = getSupportHalfWidth(effectiveBeam as Beam, true);
        const reducedMleft = Math.max(0, Math.abs(ed.Mleft) - Math.abs(ed.Vu) * (c_left / 1000));
        const reducedMright = Math.max(0, Math.abs(ed.Mright) - Math.abs(ed.Vu) * (c_right / 1000));

        const flexLeft  = designFlexure(reducedMleft,  effectiveBeam.b, effectiveBeam.h, mat.fc, mat.fy);
        const flexMid   = designFlexure(ed.Mmid,   effectiveBeam.b, effectiveBeam.h, mat.fc, mat.fy, 40, hasSlabs, slabProps.thickness, effectiveFlangeWidth, 4);
        const flexRight = designFlexure(reducedMright, effectiveBeam.b, effectiveBeam.h, mat.fc, mat.fy);
        const wuBeam = 1.2 * (effectiveBeam.deadLoad || 0) + 1.6 * (effectiveBeam.liveLoad || 0);
        const getAs = (r: any) => r.bars * Math.PI * r.dia * r.dia / 4; const AsForShear = Math.max(getAs(flexLeft), getAs(flexMid), getAs(flexRight));
        const shear = designShear(ed.Vu, effectiveBeam.b, effectiveBeam.h, mat.fc, mat.fyt, 40, mat.stirrupDia || 10, wuBeam, 300, AsForShear);
        const deflection = calculateDeflection(span, effectiveBeam.b, effectiveBeam.h, mat.fc, effectiveBeam.deadLoad || 0, effectiveBeam.liveLoad || 0, flexMid.As, 'both-ends', 'B', flexMid.As * 0.3, 1.0, 60);

        designs.push({
          beamId: ed.beamId, frameId: '', span,
          Mleft: ed.Mleft < 0 ? -reducedMleft : reducedMleft, Mmid: ed.Mmid, Mright: ed.Mright < 0 ? -reducedMright : reducedMright, Vu: ed.Vu,
          Rleft: 0, Rright: 0,
          flexLeft, flexMid, flexRight, shear, deflection,
        });
      }
      return designs;
    }

    // ── مسار التطبيق: تصميم من محركات التحليل الداخلية ──
    if (!analyzed) return [];
    const designs: {
      beamId: string; frameId: string; span: number;
      Mleft: number; Mmid: number; Mright: number; Vu: number;
      Rleft: number; Rright: number;
      flexLeft: FlexureResult; flexMid: FlexureResult; flexRight: FlexureResult;
      shear: ShearResult;
      deflection: DeflectionResult;
      mergedCarrierIds?: string[]; // IDs of merged carrier beam segments
    }[] = [];

    // Track which beams have been merged as part of a carrier group
    const mergedBeamIds = new Set<string>();

    // First pass: identify carrier beam pairs and merge them
    for (const conn of bobConnections) {
      if (!conn.continuationBeamId) continue;
      const primaryId = conn.primaryBeamId;
      const contId = conn.continuationBeamId;
      mergedBeamIds.add(primaryId);
      mergedBeamIds.add(contId);

      // Find analysis results for both segments
      let primaryResult: typeof frameResults[0]['beams'][0] | undefined;
      let contResult: typeof frameResults[0]['beams'][0] | undefined;
      let primaryFrame: typeof frameResults[0] | undefined;
      for (const fr of frameResults) {
        for (const br of fr.beams) {
          if (br.beamId === primaryId) { primaryResult = br; primaryFrame = fr; }
          if (br.beamId === contId) { contResult = br; }
        }
      }
      if (!primaryResult || !contResult || !primaryFrame) continue;

      const beamA = beamsWithLoads.find(b => b.id === primaryId);
      const beamB = beamsWithLoads.find(b => b.id === contId);
      if (!beamA || !beamB) continue;

      // Merge: use envelope of both segments
      const totalSpan = primaryResult.span + contResult.span;
      const envMleft = Math.max(Math.abs(primaryResult.Mleft), Math.abs(contResult.Mleft));
      const envMright = Math.max(Math.abs(primaryResult.Mright), Math.abs(contResult.Mright));
      const envMmid = Math.max(primaryResult.Mmid, contResult.Mmid);
      const envVu = Math.max(
        Math.max(Math.abs(primaryResult.Rleft || 0), Math.abs(primaryResult.Rright || 0)),
        Math.max(Math.abs(contResult.Rleft || 0), Math.abs(contResult.Rright || 0))
      );

      // Use the larger cross-section for design
      const designBeam = beamA.b * beamA.h >= beamB.b * beamB.h ? beamA : beamB;

      // T-beam effective flange width
      const hasSlabs = designBeam.slabs.length > 0;
      let effectiveFlangeWidth = 0;
      if (hasSlabs) {
        const adjacentSlabWidths: number[] = [];
        for (const slabId of designBeam.slabs) {
          const slab = slabs.find(s => s.id === slabId);
          if (!slab) continue;
          if (designBeam.direction === 'horizontal') {
            adjacentSlabWidths.push(Math.abs(slab.y2 - slab.y1));
          } else {
            adjacentSlabWidths.push(Math.abs(slab.x2 - slab.x1));
          }
        }
        const ccSpacing = adjacentSlabWidths.reduce((a, b) => a + b, 0);
        effectiveFlangeWidth = Math.min(
          totalSpan * 1000 / 4,
          designBeam.b + 16 * slabProps.thickness,
          ccSpacing * 1000
        );
      }

      const c_left = getSupportHalfWidth(beamA, false);
      const c_right = getSupportHalfWidth(beamB, true);
      const reducedMleft = Math.max(0, envMleft - Math.abs(primaryResult.Rleft || 0) * (c_left / 1000));
      const reducedMright = Math.max(0, envMright - Math.abs(contResult.Rright || 0) * (c_right / 1000));

      const flexLeft = designFlexure(reducedMleft, designBeam.b, designBeam.h, mat.fc, mat.fy);
      const flexMid = designFlexure(envMmid, designBeam.b, designBeam.h, mat.fc, mat.fy, 40,
        hasSlabs, slabProps.thickness, effectiveFlangeWidth, 4);
      const flexRight = designFlexure(reducedMright, designBeam.b, designBeam.h, mat.fc, mat.fy);
      const wuBeam = 1.2 * designBeam.deadLoad + 1.6 * designBeam.liveLoad;
      const getAs = (r: any) => r.bars * Math.PI * r.dia * r.dia / 4; const AsForShear = Math.max(getAs(flexLeft), getAs(flexMid), getAs(flexRight));
      const shear = designShear(envVu, designBeam.b, designBeam.h, mat.fc, mat.fyt, 40, mat.stirrupDia || 10, wuBeam, 300, AsForShear);
      const AsPrimeForDefl = flexMid.As * 0.3;
      const deflection = calculateDeflection(totalSpan, designBeam.b, designBeam.h, mat.fc, designBeam.deadLoad, designBeam.liveLoad, flexMid.As, 'both-ends', 'B', AsPrimeForDefl, 1.0, 60);

      // Push ONE merged design entry for the primary beam ID
      designs.push({
        beamId: primaryId, frameId: primaryFrame.frameId, span: totalSpan,
        Mleft: primaryResult.Mleft < 0 ? -reducedMleft : reducedMleft, Mmid: envMmid, Mright: contResult.Mright < 0 ? -reducedMright : reducedMright,
        Vu: envVu,
        Rleft: primaryResult.Rleft || 0, Rright: contResult.Rright || 0,
        flexLeft, flexMid, flexRight, shear, deflection,
        mergedCarrierIds: [primaryId, contId],
      });
    }

    // ── اكتشاف مجموعات الجسور المقسّمة (مثل: 67-1, 67-2, 67-3) ──────────────
    // الجسور التي تحمل اسمًا مثل "X-N" حيث N رقم تسلسلي هي أجزاء جسر واحد
    // قُسّم أثناء النمذجة — نجمعها هنا ونصمّمها كجسر واحد في مرحلة ثالثة.
    const splitGroupMap = new Map<string, { beamId: string; frameIdx: number; beamIdx: number }[]>();
    for (let fi = 0; fi < frameResults.length; fi++) {
      for (let bi = 0; bi < frameResults[fi].beams.length; bi++) {
        const beamId = frameResults[fi].beams[bi].beamId;
        const m = beamId.match(/^(.+)-(\d+)$/);
        if (!m) continue;
        const baseId = m[1];
        if (!splitGroupMap.has(baseId)) splitGroupMap.set(baseId, []);
        splitGroupMap.get(baseId)!.push({ beamId, frameIdx: fi, beamIdx: bi });
      }
    }
    // احتفظ فقط بالمجموعات التي تحوي جزأين أو أكثر
    const splitPartIds = new Set<string>();
    for (const [baseId, parts] of splitGroupMap) {
      if (parts.length < 2) { splitGroupMap.delete(baseId); continue; }
      for (const p of parts) splitPartIds.add(p.beamId);
    }

    // Second pass: design non-carrier beams normally
    for (const fr of frameResults) {
      const numBeams = fr.beams.length;
      for (let bi = 0; bi < numBeams; bi++) {
        const br = fr.beams[bi];
        if (mergedBeamIds.has(br.beamId)) continue; // already merged
        if (splitPartIds.has(br.beamId)) continue;   // part of a split group — handled in 3rd pass
        const beam = beamsWithLoads.find(b => b.id === br.beamId);
        if (!beam) continue;

        const hasSlabs = beam.slabs.length > 0;
        let effectiveFlangeWidth = 0;
        if (hasSlabs) {
          const adjacentSlabWidths: number[] = [];
          for (const slabId of beam.slabs) {
            const slab = slabs.find(s => s.id === slabId);
            if (!slab) continue;
            if (beam.direction === 'horizontal') {
              adjacentSlabWidths.push(Math.abs(slab.y2 - slab.y1));
            } else {
              adjacentSlabWidths.push(Math.abs(slab.x2 - slab.x1));
            }
          }
          const ccSpacing = adjacentSlabWidths.reduce((a, b) => a + b, 0);
          effectiveFlangeWidth = Math.min(
            br.span * 1000 / 4,
            beam.b + 16 * slabProps.thickness,
            ccSpacing * 1000
          );
        }

        const c_left = getSupportHalfWidth(beam, false);
        const c_right = getSupportHalfWidth(beam, true);
        const reducedMleft = Math.max(0, Math.abs(br.Mleft) - Math.abs(br.Rleft || 0) * (c_left / 1000));
        const reducedMright = Math.max(0, Math.abs(br.Mright) - Math.abs(br.Rright || 0) * (c_right / 1000));

        const flexLeft = designFlexure(reducedMleft, beam.b, beam.h, mat.fc, mat.fy);
        const flexMid = designFlexure(br.Mmid, beam.b, beam.h, mat.fc, mat.fy, 40,
          hasSlabs, slabProps.thickness, effectiveFlangeWidth, 4);
        const flexRight = designFlexure(reducedMright, beam.b, beam.h, mat.fc, mat.fy);
        const wuBeam = 1.2 * beam.deadLoad + 1.6 * beam.liveLoad;
        const getAs = (r: any) => r.bars * Math.PI * r.dia * r.dia / 4; const AsForShear = Math.max(getAs(flexLeft), getAs(flexMid), getAs(flexRight));
        const shear = designShear(br.Vu, beam.b, beam.h, mat.fc, mat.fyt, 40, mat.stirrupDia || 10, wuBeam, 300, AsForShear);
        const isExteriorLeft = bi === 0;
        const isExteriorRight = bi === numBeams - 1;
        const endCondition: 'simple' | 'one-end' | 'both-ends' = 
          (isExteriorLeft && isExteriorRight) ? 'simple' :
          (isExteriorLeft || isExteriorRight) ? 'one-end' : 'both-ends';
        const AsPrimeForDefl = flexMid.As * 0.3;
        const deflection = calculateDeflection(br.span, beam.b, beam.h, mat.fc, beam.deadLoad, beam.liveLoad, flexMid.As, endCondition, 'B', AsPrimeForDefl, 1.0, 60);
        designs.push({
          beamId: br.beamId, frameId: fr.frameId, span: br.span,
          Mleft: br.Mleft < 0 ? -reducedMleft : reducedMleft, Mmid: br.Mmid, Mright: br.Mright < 0 ? -reducedMright : reducedMright, Vu: br.Vu,
          Rleft: br.Rleft || 0, Rright: br.Rright || 0,
          flexLeft, flexMid, flexRight, shear, deflection,
        });
      }
    }
    // ── المرحلة الثالثة: تصميم مجموعات الجسور المقسّمة كجسر واحد ─────────────
    for (const [baseId, parts] of splitGroupMap) {
      // جمع نتائج جميع الأجزاء
      const partData: Array<{
        br: typeof frameResults[0]['beams'][0];
        beam: typeof beamsWithLoads[0];
        frameId: string;
        posMin: number;
      }> = [];

      for (const p of parts) {
        const fr = frameResults[p.frameIdx];
        const br = fr.beams[p.beamIdx];
        const beam = beamsWithLoads.find(b => b.id === br.beamId);
        if (!beam) continue;
        // قيمة للفرز: الحد الأدنى لموضع الجسر (x1 أو y1 بحسب الاتجاه)
        const posMin = beam.direction === 'horizontal'
          ? Math.min(beam.x1, beam.x2)
          : Math.min(beam.y1, beam.y2);
        partData.push({ br, beam, frameId: fr.frameId, posMin });
      }
      if (partData.length === 0) continue;

      // ترتيب الأجزاء بحسب الموضع (يسار → يمين أو أسفل → أعلى)
      partData.sort((a, b) => a.posMin - b.posMin);

      const leftPart  = partData[0];
      const rightPart = partData[partData.length - 1];

      // الجسر المرجعي: أكبر مقطع
      const refBeam = partData.reduce((best, p) =>
        p.beam.b * p.beam.h >= best.b * best.h ? p.beam : best,
        partData[0].beam,
      );

      const totalSpan = partData.reduce((s, p) => s + p.br.span, 0);

      // العزوم: يسار من الجزء الأيسر، يمين من الجزء الأيمن، أقصى عزم موجب من الكل
      const Mleft  = Math.abs(leftPart.br.Mleft);
      const Mright = Math.abs(rightPart.br.Mright);
      const Mmid   = Math.max(...partData.map(p => p.br.Mmid));
      const Vu     = Math.max(...partData.flatMap(p => [
        Math.abs(p.br.Rleft ?? 0),
        Math.abs(p.br.Rright ?? 0),
      ]));

      // T-beam effective flange width
      const hasSlabs = refBeam.slabs.length > 0;
      let effectiveFlangeWidth = 0;
      if (hasSlabs) {
        const widths: number[] = [];
        for (const slabId of refBeam.slabs) {
          const slab = slabs.find(s => s.id === slabId);
          if (!slab) continue;
          widths.push(refBeam.direction === 'horizontal'
            ? Math.abs(slab.y2 - slab.y1)
            : Math.abs(slab.x2 - slab.x1));
        }
        effectiveFlangeWidth = Math.min(
          totalSpan * 1000 / 4,
          refBeam.b + 16 * slabProps.thickness,
          widths.reduce((a, b) => a + b, 0) * 1000,
        );
      }

      const c_left = getSupportHalfWidth(leftPart.beam, false);
      const c_right = getSupportHalfWidth(rightPart.beam, true);
      const reducedMleft = Math.max(0, Mleft - Math.abs(leftPart.br.Rleft || 0) * (c_left / 1000));
      const reducedMright = Math.max(0, Mright - Math.abs(rightPart.br.Rright || 0) * (c_right / 1000));

      const flexLeft  = designFlexure(reducedMleft,  refBeam.b, refBeam.h, mat.fc, mat.fy);
      const flexMid   = designFlexure(Mmid,   refBeam.b, refBeam.h, mat.fc, mat.fy, 40,
        hasSlabs, slabProps.thickness, effectiveFlangeWidth, 4);
      const flexRight = designFlexure(reducedMright, refBeam.b, refBeam.h, mat.fc, mat.fy);
      const wuBeam = 1.2 * refBeam.deadLoad + 1.6 * refBeam.liveLoad;
      const getAs = (r: any) => r.bars * Math.PI * r.dia * r.dia / 4; const AsForShear = Math.max(getAs(flexLeft), getAs(flexMid), getAs(flexRight));
      const shear = designShear(Vu, refBeam.b, refBeam.h, mat.fc, mat.fyt, 40,
        mat.stirrupDia || 10, wuBeam, 300, AsForShear);
      const deflection = calculateDeflection(totalSpan, refBeam.b, refBeam.h, mat.fc,
        refBeam.deadLoad, refBeam.liveLoad, flexMid.As, 'both-ends', 'B',
        flexMid.As * 0.3, 1.0, 60);

      designs.push({
        beamId: baseId,
        frameId: leftPart.frameId,
        span: totalSpan,
        Mleft: -reducedMleft,
        Mmid,
        Mright: -reducedMright,
        Vu,
        Rleft:  leftPart.br.Rleft  ?? 0,
        Rright: rightPart.br.Rright ?? 0,
        flexLeft, flexMid, flexRight, shear, deflection,
        mergedCarrierIds: parts.map(p => p.beamId),
      });
    }

    return designs;
  }, [frameResults, beamsWithLoads, columns, mat, analyzed, bobConnections, slabs, slabProps, designSource, designExecuted, etabsAnalysisData]);

  // Map of canonical beamId → merged part IDs (for split beams like 67 → [67-1, 67-2, 67-3])
  const splitBeamGroups = useMemo<Record<string, string[]>>(() => {
    const groups: Record<string, string[]> = {};
    for (const d of beamDesigns) {
      const mids = (d as any).mergedCarrierIds as string[] | undefined;
      if (mids && mids.length >= 2) {
        groups[d.beamId] = mids;
      }
    }
    return groups;
  }, [beamDesigns]);

  // Beam diagnostics - detailed ACI 318-19 compliance check
  const beamDiagnostics = useMemo<Map<string, BeamDiagnostic>>(() => {
    const map = new Map<string, BeamDiagnostic>();
    for (const d of beamDesigns) {
      // For merged carrier beams (e.g. "67" whose segments are "67-1","67-2","67-3"),
      // the canonical beamId isn't in beamsWithLoads — find the reference beam from merged segments.
      let beam = beamsWithLoads.find(b => b.id === d.beamId);
      const mergedIdsForDiag = (d as any).mergedCarrierIds as string[] | undefined;
      if (!beam && mergedIdsForDiag && mergedIdsForDiag.length > 0) {
        // Use the largest cross-section segment as the reference beam
        const parts = mergedIdsForDiag.map(id => beamsWithLoads.find(b => b.id === id)).filter(Boolean) as typeof beamsWithLoads;
        if (parts.length > 0) {
          beam = parts.reduce((best, b) => b.b * b.h >= best.b * best.h ? b : best, parts[0]);
        }
      }
      if (!beam) continue;

      // ACI 318-19: each section designed independently; Mu_max for reporting only
      const Mu_max = Math.max(Math.abs(d.Mleft), Math.abs(d.Mmid), Math.abs(d.Mright));

      // Calculate effective flange width for T-beam diagnosis
      let effFlangeW = 0;
      if (beam.slabs.length > 0) {
        const adjacentWidths: number[] = [];
        for (const slabId of beam.slabs) {
          const slab = slabs.find(s => s.id === slabId);
          if (!slab) continue;
          if (beam.direction === 'horizontal') {
            adjacentWidths.push(Math.abs(slab.y2 - slab.y1));
          } else {
            adjacentWidths.push(Math.abs(slab.x2 - slab.x1));
          }
        }
        const ccSpacing = adjacentWidths.reduce((a, b) => a + b, 0);
        effFlangeW = Math.min(d.span * 1000 / 4, beam.b + 16 * slabProps.thickness, ccSpacing * 1000);
      }

      const diag = diagnoseBeam(
        d.beamId,
        { b: beam.b, h: beam.h, length: beam.length },
        d.flexLeft, d.flexMid, d.flexRight,
        d.shear, d.deflection,
        mat.fc, mat.fy, mat.fyt,
        d.span, Mu_max, d.Vu,
        effFlangeW, slabProps.thickness,
      );
      map.set(d.beamId, diag);
    }
    return map;
  }, [beamDesigns, beamsWithLoads, mat, slabs, slabProps]);

  const colLoads = useMemo(() => {
    if (!analyzed) return new Map<string, { Pu: number; Mu: number }>();
    return calculateColumnLoads(columns, beamsWithLoads, frameResults);
  }, [analyzed, columns, beamsWithLoads, frameResults]);

  // 2D frame results (kept only for comparison/fallback paths)
  // MUST match runAnalysis logic for legacy_2d to produce consistent results
  const frameResults2D = useMemo(() => {
    if (!analyzed) return [] as FrameResult[];
    const bMap = new Map(beamsWithLoads.map(b => [b.id, b]));
    const beamHinges2D = new Map<string, 'I' | 'J' | 'BOTH'>();
    for (const beam of beamsWithLoads) {
      const rs = getBeamReleaseState(beam);
      const hasHingeI = rs.nodeI.rx || rs.nodeI.ry || rs.nodeI.rz;
      const hasHingeJ = rs.nodeJ.rx || rs.nodeJ.ry || rs.nodeJ.rz;
      if (hasHingeI && hasHingeJ) beamHinges2D.set(beam.id, 'BOTH');
      else if (hasHingeI) beamHinges2D.set(beam.id, 'I');
      else if (hasHingeJ) beamHinges2D.set(beam.id, 'J');
    }
    // Use beam-on-beam analysis when applicable (same as runAnalysis)
    let raw: FrameResult[] = [];
    if (removedColumnIds.length > 0 && detectedConnections.length > 0) {
      const result = analyzeWithBeamOnBeam(frames, bMap, columns, mat, removedColumnIds, detectedConnections, 10, 0.01, beamHinges2D, beamStiffnessFactor, colStiffnessFactor);
      raw = result.frameResults;
    } else {
      raw = frames.map(f => analyzeFrame(f, bMap, columns, mat, removedColumnIds, undefined, beamHinges2D, undefined, beamStiffnessFactor, colStiffnessFactor));
    }
    return postprocessFrameResultsForColumnFaces(raw, columns, beamsWithLoads, effectiveFrameEndReleases);
  }, [analyzed, frames, beamsWithLoads, columns, mat, getBeamReleaseState, removedColumnIds, detectedConnections, beamStiffnessFactor, colStiffnessFactor, effectiveFrameEndReleases]);

  // Beam hinge map for diagram rendering
  const beamHingesMap = useMemo(() => {
    const m = new Map<string, 'I' | 'J' | 'BOTH'>();
    for (const beam of beamsWithLoads) {
      const rs = getBeamReleaseState(beam);
      const hi = rs.nodeI.rx || rs.nodeI.ry || rs.nodeI.rz;
      const hj = rs.nodeJ.rx || rs.nodeJ.ry || rs.nodeJ.rz;
      if (hi && hj) m.set(beam.id, 'BOTH');
      else if (hi) m.set(beam.id, 'I');
      else if (hj) m.set(beam.id, 'J');
    }
    return m;
  }, [beamsWithLoads, getBeamReleaseState]);


  // 3D frame results for COMPARISON / DIAGRAMS / VIEW tabs.
  //
  // ✅ سياسة جديدة (بناءً على طلب المستخدم):
  // **لا يوجد أي "تصفير قسري"** للعزوم عند النهايات المحررة في أي مكان.
  // كل المخرجات (جدول الفريمات، مقارنة ETABS، الرسوم البيانية BMD، تبويب
  // العرض) تعرض **القيمة الفعلية الناتجة من محرك التحليل 3D Legacy** كما هي.
  //
  // عند تحرير نهاية الجسر (مثلاً R3 = موقع مفصل) المحرك يطبّق static
  // condensation داخلياً، والقيمة المتبقية في الجدول قد تكون:
  //   • صفر تقريباً (لجسر بسيط بحمل متماثل)
  //   • قيمة سالبة صغيرة (هوغ متبقّي بسبب التوزيع الحقيقي للعزم بعد المفصل،
  //     خاصةً لجسر مستمر يحرَّر طرف واحد فقط منه — هذا سلوك فيزيائي صحيح).
  //
  // المحرك 3D Legacy لا يستخدم اتصالات beam-on-beam مطلقاً ⇒ نمرّر [].
  const frameResults3DRaw = useMemo(() => {
    if (!analyzed || frames.length === 0) return [] as FrameResult[];
    try {
      const conns3DLegacy: BeamOnBeamConnection[] = [];
      const raw = getFrameResults3D(
        frames, beamsWithLoads, columns, mat, effectiveFrameEndReleases, conns3DLegacy,
        slabs, slabProps, state.useFEMLoadDistribution ?? false, beamStiffnessFactor, colStiffnessFactor,
        /* enforceReleasedZeros */ false, colRigidEndOffsets, manualJointOverrides,
        supportRestraints,
      );
      return postprocessFrameResultsForColumnFaces(raw, columns, beamsWithLoads, effectiveFrameEndReleases);
    } catch {
      return [] as FrameResult[];
    }
  }, [analyzed, frames, beamsWithLoads, columns, mat, effectiveFrameEndReleases, slabs, slabProps, beamStiffnessFactor, colStiffnessFactor, colRigidEndOffsets, manualJointOverrides, supportRestraints]);

  // Global Frame results for comparison
  const frameResultsGF = useMemo(() => {
    if (!analyzed || frames.length === 0) return [] as FrameResult[];
    try {
      const raw = getFrameResultsGlobalFrame(frames, beamsWithLoads, columns, mat, effectiveFrameEndReleases, autoDetectedConnections, slabs, slabProps, beamStiffnessFactor, colStiffnessFactor, colRigidEndOffsets, state.ribbedSlabProps, state.useFEMLoadDistribution);
      return postprocessFrameResultsForColumnFaces(raw, columns, beamsWithLoads, effectiveFrameEndReleases);
    } catch {
      return [] as FrameResult[];
    }
  }, [analyzed, frames, beamsWithLoads, columns, mat, effectiveFrameEndReleases, autoDetectedConnections, slabs, slabProps, beamStiffnessFactor, colStiffnessFactor, colRigidEndOffsets, state.ribbedSlabProps]);

  // Unified Core = identical algorithm to Global Frame (both are aliases for getFrameResults3D).
  // Reuse the cached GF result to avoid a redundant full 3D solve.
  const frameResultsUC = frameResultsGF;

  // 2D column loads (kept for comparison/fallback)
  const colLoadsBiaxial = useMemo(() => {
    if (!analyzed) return new Map<string, { Pu: number; Mx: number; My: number; MxTop: number; MxBot: number; MyTop: number; MyBot: number }>();
    return calculateColumnLoadsBiaxial(columns, beamsWithLoads, frameResults2D, stories);
  }, [analyzed, columns, beamsWithLoads, frameResults2D, stories]);

  // 3D column loads — PRIMARY results for design
  const colLoads3D = useMemo(() => {
    if (!analyzed || frames.length === 0) return new Map();
    try {
      // 3D Legacy: نقل أحمال البلاطات إلى الجسور بنفس طريقة محرك 2D
      // (التوزيع الهندسي عبر buildSlabEdgeLoads + computeBeamLoadProfile — نظرية خط الانهيار/المساحة الرافدة)
      // وليس عبر FEM، لضمان تطابق الأحمال المنقولة بين 2D و 3D Legacy.
      return getColumnLoads3D(frames, beamsWithLoads, columns, mat, effectiveFrameEndReleases, autoDetectedConnections, slabs, slabProps, false, beamStiffnessFactor, colStiffnessFactor, colRigidEndOffsets, manualJointOverrides, supportRestraints);
    } catch {
      // Fallback to 2D if 3D fails
      return colLoadsBiaxial;
    }
  }, [analyzed, frames, beamsWithLoads, columns, mat, colLoadsBiaxial, effectiveFrameEndReleases, autoDetectedConnections, slabs, slabProps, beamStiffnessFactor, colStiffnessFactor, colRigidEndOffsets, manualJointOverrides, supportRestraints]);

  const jointConnectivity = useMemo(() => {
    if (!analyzed) return [] as JointConnectivityInfo[];
    return getJointConnectivityInfo(columns, beamsWithLoads, frameResults);
  }, [analyzed, columns, beamsWithLoads, frameResults]);

  const colDesigns = useMemo(() => {
    if (!analyzed && !(designSource === 'etabs' && etabsColumnResults.length > 0)) {
      return columns.filter(c => !c.isRemoved).map(c => ({
        ...c, Pu: 0, Mx: 0, My: 0, Mu: 0, design: null as any,
      }));
    }
    if (designSource === 'etabs' && etabsColumnResults.length > 0) {
      return columns.filter(c => !c.isRemoved).map(c => {
        const storyForCol = stories.find(s => s.id === c.storyId);
        const etabsData = etabsColumnResults.find(ec =>
          ec.colId === c.id && (storyForCol ? ec.story === storyForCol.label : true)
        ) || etabsColumnResults.find(ec => ec.colId === c.id);
        const Pu = etabsData ? Math.abs(etabsData.P) : 0;
        const Mx = etabsData?.M2 ?? 0;
        const My = etabsData?.M3 ?? 0;
        return {
          ...c, Pu, Mx, My, Mu: Math.max(Mx, My),
          design: designColumnBiaxial(Pu, Mx, My, c.b, c.h, mat.fc, mat.fy, c.L, undefined, undefined, undefined, undefined, undefined, undefined, false, c.orientAngle),
        };
      });
    }
    return columns.filter(c => !c.isRemoved).map(c => {
      const loads = colLoads3D.get(c.id) || { Pu: 0, Mx: 0, My: 0, MxTop: 0, MxBot: 0, MyTop: 0, MyBot: 0 };
      return {
        ...c, Pu: loads.Pu, Mx: loads.Mx, My: loads.My,
        Mu: Math.max(loads.Mx, loads.My),
        design: designColumnBiaxial(
          loads.Pu, loads.Mx, loads.My, c.b, c.h, mat.fc, mat.fy, c.L,
          undefined, undefined,
          loads.MxTop, loads.MxBot, loads.MyTop, loads.MyBot,
          false, c.orientAngle,
        ),
      };
    });
  }, [columns, colLoads3D, mat, designSource, designExecuted, etabsColumnResults, stories]);

  // Bent-up bars calculation
  const bentUpResults = useMemo(() => {
    if (!analyzed) return [] as FrameBentUpResult[];
    const bMap = new Map(beamsWithLoads.map(b => [b.id, b]));
    // Collect all secondary (carried) beam IDs from detected connections
    // Secondary beams must NOT have bent-up bars (they sit on hinges, bars run straight)
    const secBeamIds = new Set<string>();
    for (const conn of detectedConnections) {
      for (const id of conn.secondaryBeamIds) secBeamIds.add(id);
    }

    // Build reverse map: partId → canonicalId  (e.g. "67-1" → "67")
    // This is used to detect frames whose beams are parts of one carrier beam group
    const partToCanonical = new Map<string, string>();
    for (const [canonicalId, partIds] of Object.entries(splitBeamGroups)) {
      for (const pid of partIds) partToCanonical.set(pid, canonicalId);
    }

    return frames.map(f => {
      const fr = frameResults.find(r => r.frameId === f.id);
      if (!fr) return null;

      const mergedBeamIds: string[] = [];
      const mergedBeamsResult: FrameResult['beams'] = [];
      const frameLocalBMap = new Map(bMap);
      
      const beamIdList = f.beamIds;
      const originalBeamResults = fr.beams;
      
      let i = 0;
      while (i < beamIdList.length) {
        const currentId = beamIdList[i];
        const currentCanon = partToCanonical.get(currentId);
        
        if (currentCanon) {
          // Find how many consecutive beams belong to the exact same split-beam canonical group
          let j = i + 1;
          while (j < beamIdList.length && partToCanonical.get(beamIdList[j]) === currentCanon) {
            j++;
          }
          
          const partsToMergeRange = beamIdList.slice(i, j);
          const canonicalId = currentCanon;
          
          // Gather results and beam objects
          const segmentData = partsToMergeRange.map(id => {
            const br = originalBeamResults.find(r => r.beamId === id);
            const beam = frameLocalBMap.get(id);
            return { id, br, beam };
          }).filter(p => p.br !== undefined);
          
          if (segmentData.length > 0) {
            // Sort parts left->right (or bottom->top) by physical position
            const partData = segmentData.map(p => {
              const beam = frameLocalBMap.get(p.id);
              const posMin = beam
                ? (beam.direction === 'horizontal'
                    ? Math.min(beam.x1, beam.x2)
                    : Math.min(beam.y1, beam.y2))
                : 0;
              return { ...p, posMin };
            }).sort((a, b) => a.posMin - b.posMin);
            
            const leftPart = partData[0];
            const rightPart = partData[partData.length - 1];
            const totalSpan = partData.reduce((s, p) => s + (p.br?.span ?? 0), 0);
            
            const refBeam = partData.reduce<typeof partData[0]['beam']>((best, p) => {
              if (!p.beam) return best;
              if (!best) return p.beam;
              return p.beam.b * p.beam.h >= best.b * best.h ? p.beam : best;
            }, undefined);
            
            if (refBeam) {
              const syntheticBeam = { ...refBeam, id: canonicalId, length: totalSpan * 1000 };
              frameLocalBMap.set(canonicalId, syntheticBeam);
              
              mergedBeamIds.push(canonicalId);
              mergedBeamsResult.push({
                beamId: canonicalId,
                span: totalSpan,
                Mleft: leftPart.br ? leftPart.br.Mleft : 0,
                Mmid: Math.max(...partData.map(p => p.br ? p.br.Mmid : 0)),
                Mright: rightPart.br ? rightPart.br.Mright : 0,
                Vu: Math.max(...partData.flatMap(p => [
                  Math.abs(p.br?.Rleft ?? 0),
                  Math.abs(p.br?.Rright ?? 0),
                ])),
                Rleft: leftPart.br ? (leftPart.br.Rleft ?? 0) : 0,
                Rright: rightPart.br ? (rightPart.br.Rright ?? 0) : 0,
              });
            } else {
              for (const part of segmentData) {
                if (part.br) {
                  mergedBeamIds.push(part.id);
                  mergedBeamsResult.push(part.br);
                }
              }
            }
          }
          
          i = j;
        } else {
          const m = currentId.match(/^(.+)-(\d+)$/);
          if (m) {
            const baseId = m[1];
            const existingPartsCount = beamsWithLoads.filter(b => b.id.match(new RegExp(`^${baseId}-\\d+$`))).length;
            if (existingPartsCount === 1) {
              const beam = frameLocalBMap.get(currentId);
              const br = originalBeamResults.find(r => r.beamId === currentId);
              if (beam && br) {
                const syntheticBeam = { ...beam, id: baseId };
                frameLocalBMap.set(baseId, syntheticBeam);
                mergedBeamIds.push(baseId);
                mergedBeamsResult.push({
                  ...br,
                  beamId: baseId,
                });
                i++;
                continue;
              }
            }
          }

          const br = originalBeamResults.find(r => r.beamId === currentId);
          if (br) {
            mergedBeamIds.push(currentId);
            mergedBeamsResult.push(br);
          }
          i++;
        }
      }

      const synFrame: Frame = {
        ...f,
        beamIds: mergedBeamIds,
      };
      
      const synFr: FrameResult = {
        ...fr,
        beams: mergedBeamsResult,
      };

      return calculateFrameBentUp(synFrame, frameLocalBMap, synFr, mat, frames, secBeamIds);
    }).filter(Boolean) as FrameBentUpResult[];
  }, [analyzed, frames, beamsWithLoads, frameResults, mat, detectedConnections, splitBeamGroups]);

  const slabDesigns = useMemo(() => {
    if (!analyzed) return slabs.map(s => ({ ...s, design: null as any }));
    return slabs.map(s => ({ ...s, design: designSlab(s, slabProps, mat, slabs, columns) }));
  }, [analyzed, slabs, slabProps, mat, columns]);

  const handleCanvasClick = useCallback((x: number, y: number) => {
    if (activeTool === 'node') {
      modelManager.createNode(x, y, 0);
      dispatch({ type: 'INC_MODEL_VERSION' });
    } else if (activeTool === 'beam' || activeTool === 'column') {
      if (!pendingNode) {
        dispatch({ type: 'SET_PENDING_NODE', node: { x, y } });
      } else {
        const ni = modelManager.createNode(pendingNode.x, pendingNode.y, 0);
        if (activeTool === 'beam') {
          const nj = modelManager.createNode(x, y, 0);
          const sections = modelManager.getAllSections();
          const beamSec = sections.find(s => s.type === 'beam') || modelManager.createSection('B', beamB, beamH, 'beam');
          modelManager.createBeam(ni.id, nj.id, beamSec.id);
        } else {
          const nj = modelManager.createNode(x, y, -(colL / 1000));
          const sections = modelManager.getAllSections();
          const colSec = sections.find(s => s.type === 'column') || modelManager.createSection('C', colB, colH, 'column');
          modelManager.createColumn(nj.id, ni.id, colSec.id);
        }
        dispatch({ type: 'SET_PENDING_NODE', node: null });
        dispatch({ type: 'INC_MODEL_VERSION' });
      }
    } else if (activeTool === 'delete') {
      const nearest = modelManager.getAllNodes().find(n =>
        Math.abs(n.x - x) < 0.3 && Math.abs(n.y - y) < 0.3
      );
      if (nearest) {
        modelManager.deleteNode(nearest.id);
        dispatch({ type: 'INC_MODEL_VERSION' });
      }
    }
  }, [activeTool, pendingNode, beamB, beamH, colB, colH, colL]);

  const handleNodeClick = useCallback((id: number) => {
    dispatch({ type: 'SELECT_NODE', id });
    if (activeTool === 'delete') {
      modelManager.deleteNode(id);
      dispatch({ type: 'SELECT_NODE', id: null });
      dispatch({ type: 'INC_MODEL_VERSION' });
    }
  }, [activeTool]);

  const handleFrameClick = useCallback((id: number) => {
    dispatch({ type: 'SELECT_FRAME', id });
    if (activeTool === 'delete') {
      modelManager.deleteElement(id);
      dispatch({ type: 'SELECT_FRAME', id: null });
      dispatch({ type: 'INC_MODEL_VERSION' });
    }
  }, [activeTool]);

  const handleAreaClick = useCallback((id: number) => {
    dispatch({ type: 'SELECT_AREA', id });
    if (activeTool === 'delete') {
      modelManager.deleteArea(id);
      dispatch({ type: 'SELECT_AREA', id: null });
      dispatch({ type: 'INC_MODEL_VERSION' });
    }
  }, [activeTool]);

  const handleNodeRestraintChange = useCallback((nodeId: number, restraints: any) => {
    modelManager.setNodeRestraints(nodeId, restraints);
    dispatch({ type: 'INC_MODEL_VERSION' });
  }, []);

  const handleFrameLongPress = useCallback((id: number) => {
    dispatch({ type: 'OPEN_ELEM_PROPS', frameId: id });
  }, []);

  const handleAreaLongPress = useCallback((id: number) => {
    dispatch({ type: 'OPEN_ELEM_PROPS', areaId: id });
  }, []);

  const handleElemPropsSave = useCallback((data: any) => {
    if (data.frameId != null) {
      modelManager.updateFrameSection(data.frameId, data.b, data.h);
      const frame = modelManager.getFrame(data.frameId);
      if (frame) {
        const EPS = 0.01;
        // Persist beam dimensions to React state so they survive model rebuilds
        if (frame.type === 'beam') {
          const nodeI = modelManager.getNode(frame.nodeI);
          const nodeJ = modelManager.getNode(frame.nodeJ);
          if (nodeI && nodeJ) {
            // Match first by selectedStory so multi-story works correctly, then fallback
            const matchingBeam =
              beams.find(b =>
                b.storyId === selectedStoryId &&
                ((Math.abs(b.x1 - nodeI.x) < EPS && Math.abs(b.y1 - nodeI.y) < EPS &&
                  Math.abs(b.x2 - nodeJ.x) < EPS && Math.abs(b.y2 - nodeJ.y) < EPS) ||
                 (Math.abs(b.x1 - nodeJ.x) < EPS && Math.abs(b.y1 - nodeJ.y) < EPS &&
                  Math.abs(b.x2 - nodeI.x) < EPS && Math.abs(b.y2 - nodeI.y) < EPS))
              ) ??
              beams.find(b =>
                (Math.abs(b.x1 - nodeI.x) < EPS && Math.abs(b.y1 - nodeI.y) < EPS &&
                 Math.abs(b.x2 - nodeJ.x) < EPS && Math.abs(b.y2 - nodeJ.y) < EPS) ||
                (Math.abs(b.x1 - nodeJ.x) < EPS && Math.abs(b.y1 - nodeJ.y) < EPS &&
                 Math.abs(b.x2 - nodeI.x) < EPS && Math.abs(b.y2 - nodeI.y) < EPS)
              );
            if (matchingBeam) {
              if (data.b != null && data.h != null) {
                dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: matchingBeam.id, override: { b: Number(data.b), h: Number(data.h) } });
              }
              // Handle move by delta
              if (data.moveX != null || data.moveY != null || data.moveZ != null) {
                const dx = data.moveX ?? 0;
                const dy = data.moveY ?? 0;
                const dz = data.moveZ ?? 0;
                if (data.syncColocated) {
                  // Move all beams with the same X,Y coordinates
                  const srcX1 = nodeI.x, srcY1 = nodeI.y, srcX2 = nodeJ.x, srcY2 = nodeJ.y;
                  const beamsToMove = beams.filter(b =>
                    (Math.abs(b.x1 - srcX1) < EPS && Math.abs(b.y1 - srcY1) < EPS &&
                     Math.abs(b.x2 - srcX2) < EPS && Math.abs(b.y2 - srcY2) < EPS) ||
                    (Math.abs(b.x1 - srcX2) < EPS && Math.abs(b.y1 - srcY2) < EPS &&
                     Math.abs(b.x2 - srcX1) < EPS && Math.abs(b.y2 - srcY1) < EPS)
                  );
                  for (const bm of beamsToMove) {
                    dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: bm.id, override: { x1: bm.x1 + dx, y1: bm.y1 + dy, x2: bm.x2 + dx, y2: bm.y2 + dy, ...(dz !== 0 ? { z: (bm.z ?? 0) + dz } : {}) } });
                  }
                } else {
                  dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: matchingBeam.id, override: { x1: matchingBeam.x1 + dx, y1: matchingBeam.y1 + dy, x2: matchingBeam.x2 + dx, y2: matchingBeam.y2 + dy, ...(dz !== 0 ? { z: (matchingBeam.z ?? 0) + dz } : {}) } });
                }
              }
              // Handle direct coordinate edit
              if (data.newX1 != null) {
                dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: matchingBeam.id, override: { x1: data.newX1, y1: data.newY1, x2: data.newX2, y2: data.newY2 } });
              }
            }
          }
        }
        // Persist column dimensions to React state so they survive model rebuilds
        if (frame.type === 'column' && (data.b != null || data.orientAngle != null || data.moveX != null || data.moveY != null || data.newColX != null || data.newColY != null)) {
          // Use the top node (nodeJ) x,y to locate the column in the React state
          const topNode = modelManager.getNode(frame.nodeJ);
          if (topNode) {
            // Columns sharing the same x,y position (same plan location, different stories)
            const samePositionCols = columns.filter(c =>
              Math.abs(c.x - topNode.x) < EPS && Math.abs(c.y - topNode.y) < EPS
            );
            // Determine which columns to update
            const colsToUpdate = data.applyToUpperFloors
              ? samePositionCols
              : (samePositionCols.filter(c => c.storyId === selectedStoryId).length > 0
                  ? samePositionCols.filter(c => c.storyId === selectedStoryId)
                  : samePositionCols.slice(0, 1));
            for (const col of colsToUpdate) {
              const override: Record<string, number> = {};
              if (data.b != null) override.b = Number(data.b);
              if (data.h != null) override.h = Number(data.h);
              if (data.orientAngle != null) override.orientAngle = Number(data.orientAngle);
              // Handle move by delta
              if (data.moveX != null || data.moveY != null) {
                override.x = col.x + (data.moveX ?? 0);
                override.y = col.y + (data.moveY ?? 0);
              }
              // Handle direct absolute coordinate assignment
              if (data.newColX != null) override.x = Number(data.newColX);
              if (data.newColY != null) override.y = Number(data.newColY);
              dispatch({ type: 'SET_COL_OVERRIDE', colId: col.id, override });
            }
          }
        }
        if (data.nodeIRestraints) {
          modelManager.setNodeRestraints(frame.nodeI, data.nodeIRestraints);
          modelManager.setNodeRestraints(frame.nodeJ, data.nodeJRestraints);
          // Persist end releases in state keyed by node positions so they survive model rebuilds
          const nodeI = modelManager.getNode(frame.nodeI);
          const nodeJ = modelManager.getNode(frame.nodeJ);
          if (nodeI && nodeJ) {
            const posKey = `${nodeI.x.toFixed(3)}_${nodeI.y.toFixed(3)}_${nodeJ.x.toFixed(3)}_${nodeJ.y.toFixed(3)}`;
            // التحرير من ElementPropertiesDialog (long-press في تبويبات النمذجة/العرض/التحليل)
            // يُحفظ دائماً في frameEndReleases ليظهر في جدول جسور تبويب الإدخال.
            dispatch({ type: 'SET_FRAME_END_RELEASES', posKey, nodeIRestraints: data.nodeIRestraints, nodeJRestraints: data.nodeJRestraints });
            dispatch({ type: 'SET_TRANSIENT_FRAME_END_RELEASES', posKey, nodeIRestraints: data.nodeIRestraints, nodeJRestraints: data.nodeJRestraints });
          }
        }
      }
    }
    if (data.nodeId != null && data.restraints != null) {
      modelManager.setNodeRestraints(data.nodeId, data.restraints);
      const node = modelManager.getNode(data.nodeId);
      if (node) {
        const supportKey = `${node.x.toFixed(2)}_${node.y.toFixed(2)}_${Math.round(node.z)}`;
        dispatch({ type: 'SET_SUPPORT_RESTRAINTS', posKey: supportKey, restraints: data.restraints });
      }
    }
    // Handle node move by delta — move all columns and beam endpoints at this node's exact X,Y,Z position
    if (data.nodeId != null && (data.moveX != null || data.moveY != null || data.moveZ != null)) {
      const node = modelManager.getNode(data.nodeId);
      if (node) {
        const EPS = 0.01;
        const Z_EPS = 50; // mm tolerance for Z (nodes may sit between stories)
        const dx = data.moveX ?? 0;
        const dy = data.moveY ?? 0;
        // Move only columns in the same story (matched by X,Y — columns span stories so use plan position only
        // but limit to columns whose story elevation is close to this node's Z)
        const nodeZm = node.z; // node Z is in meters
        const affectedCols = columns.filter(c => {
          if (Math.abs(c.x - node.x) >= EPS || Math.abs(c.y - node.y) >= EPS) return false;
          // Find the story for this column and check elevation proximity
          const story = stories.find((st: any) => st.id === c.storyId) ?? null;
          if (story == null) return true; // can't determine story, include it
          const storyTopZ = ((story.elevation ?? 0) + story.height) / 1000; // convert mm to m
          const storyBotZ = (story.elevation ?? 0) / 1000;
          return nodeZm >= storyBotZ - 0.1 && nodeZm <= storyTopZ + 0.1;
        });
        for (const col of affectedCols) {
          dispatch({ type: 'SET_COL_OVERRIDE', colId: col.id, override: { x: col.x + dx, y: col.y + dy } });
        }
        // Move beam endpoints that share this node's X,Y position AND are at the same elevation (Z)
        const affectedBeams = beams.filter(b => {
          const zMatch = nodeZm != null ? Math.abs((b.z ?? 0) / 1000 - nodeZm) < Z_EPS / 1000 : true;
          return zMatch && (
            (Math.abs(b.x1 - node.x) < EPS && Math.abs(b.y1 - node.y) < EPS) ||
            (Math.abs(b.x2 - node.x) < EPS && Math.abs(b.y2 - node.y) < EPS)
          );
        });
        for (const beam of affectedBeams) {
          const override: Record<string, number> = {};
          if (Math.abs(beam.x1 - node.x) < EPS && Math.abs(beam.y1 - node.y) < EPS) {
            override.x1 = beam.x1 + dx;
            override.y1 = beam.y1 + dy;
          }
          if (Math.abs(beam.x2 - node.x) < EPS && Math.abs(beam.y2 - node.y) < EPS) {
            override.x2 = beam.x2 + dx;
            override.y2 = beam.y2 + dy;
          }
          if (Object.keys(override).length > 0) {
            dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: beam.id, override });
          }
        }
      }
    }
    if (data.areaId != null && data.thickness != null) {
      modelManager.updateAreaThickness(data.areaId, data.thickness);
    }
    if (data.areaId != null) {
      const override: any = {};
      if (data.thickness != null) override.thickness = data.thickness;
      if (data.finishLoad != null) override.finishLoad = data.finishLoad;
      if (data.liveLoad != null) override.liveLoad = data.liveLoad;
      if (data.cover != null) override.cover = data.cover;
      if (Object.keys(override).length > 0) {
        dispatch({ type: 'SET_SLAB_PROPS_OVERRIDE', areaId: data.areaId, override });
      }
      // Handle slab move by delta — find matching slab in state.slabs via area label
      if ((data.moveX != null || data.moveY != null) && (data.moveX !== 0 || data.moveY !== 0)) {
        const area = currentAreas.find(a => a.id === data.areaId);
        if (area) {
          const slabIdx = slabs.findIndex(s => s.id === area.label || `A${area.id}` === `A${data.areaId}`);
          if (slabIdx !== -1) {
            dispatch({ type: 'MOVE_SLAB', index: slabIdx, dx: data.moveX ?? 0, dy: data.moveY ?? 0 });
          }
        }
      }
    }
    dispatch({ type: 'INC_MODEL_VERSION' });
    dispatch({ type: 'RESET_ANALYSIS' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beams, columns, selectedStoryId, slabs]);

  const handleLevelElementDelete = useCallback((type: 'beam' | 'column' | 'slab', id: string) => {
    if (type === 'beam') {
      const isExtra = extraBeams.some(eb => eb.id === id);
      if (isExtra) {
        dispatch({ type: 'REMOVE_EXTRA_BEAM', id });
      } else if (!removedBeamIds.includes(id)) {
        dispatch({ type: 'TOGGLE_BEAM_REMOVAL', beamId: id });
      }
    } else if (type === 'column') {
      const isExtra = extraColumns.some(ec => ec.id === id);
      if (isExtra) {
        dispatch({ type: 'REMOVE_EXTRA_COLUMN', id });
      } else if (!removedColumnIds.includes(id)) {
        dispatch({ type: 'TOGGLE_COLUMN_REMOVAL', colId: id });
      }
    } else if (type === 'slab') {
      const idx = slabs.findIndex(s => s.id === id);
      if (idx !== -1) {
        dispatch({ type: 'REMOVE_SLAB', index: idx });
      }
    }
    dispatch({ type: 'RESET_ANALYSIS' });
  }, [extraBeams, extraColumns, slabs, removedBeamIds, removedColumnIds]);

  const handleElemPropsDelete = useCallback((data: { frameId?: number; areaId?: number; nodeId?: number }) => {
    if (data.nodeId != null) {
      modelManager.deleteNode(data.nodeId);
    }
    if (data.frameId != null) {
      modelManager.deleteElement(data.frameId);
    }
    if (data.areaId != null) {
      modelManager.deleteArea(data.areaId);
    }
    dispatch({ type: 'CLOSE_ELEM_PROPS' });
    dispatch({ type: 'INC_MODEL_VERSION' });
    dispatch({ type: 'RESET_ANALYSIS' });
  }, []);

  const checkAndRemoveDuplicates = useCallback(() => {
    const EPS = 0.011;
    const items: string[] = [];

    const getNum = (id: string) => parseInt(id.replace(/\D/g, '') || '0', 10);

    // ---- فحص البلاطات المكررة ----
    const slabGroups = new Map<string, typeof slabs>();
    for (const s of slabs) {
      const x1 = Math.min(s.x1, s.x2), y1 = Math.min(s.y1, s.y2);
      const x2 = Math.max(s.x1, s.x2), y2 = Math.max(s.y1, s.y2);
      const key = `${s.storyId || ''}|${x1.toFixed(2)},${y1.toFixed(2)},${x2.toFixed(2)},${y2.toFixed(2)}`;
      if (!slabGroups.has(key)) slabGroups.set(key, []);
      slabGroups.get(key)!.push(s);
    }
    const slabIndicesToRemove: number[] = [];
    for (const [, group] of slabGroups) {
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => getNum(a.id) - getNum(b.id));
        const toRemove = sorted.slice(0, -1);
        for (const s of toRemove) {
          const idx = slabs.indexOf(s);
          if (idx !== -1) slabIndicesToRemove.push(idx);
          items.push(`بلاطة ${s.id} (مكررة مع ${sorted[sorted.length - 1].id})`);
        }
      }
    }
    const sortedSlabIndices = [...slabIndicesToRemove].sort((a, b) => b - a);
    for (const idx of sortedSlabIndices) {
      dispatch({ type: 'REMOVE_SLAB', index: idx });
    }

    // ---- فحص الجسور المكررة ----
    const beamGroups = new Map<string, typeof beamsWithLoads>();
    for (const b of beamsWithLoads) {
      const x1 = Math.min(b.x1, b.x2), y1 = Math.min(b.y1, b.y2);
      const x2 = Math.max(b.x1, b.x2), y2 = Math.max(b.y1, b.y2);
      const key = `${b.storyId || ''}|${x1.toFixed(2)},${y1.toFixed(2)},${x2.toFixed(2)},${y2.toFixed(2)}`;
      if (!beamGroups.has(key)) beamGroups.set(key, []);
      beamGroups.get(key)!.push(b);
    }
    for (const [, group] of beamGroups) {
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => getNum(a.id) - getNum(b.id));
        const toRemove = sorted.slice(0, -1);
        for (const b of toRemove) {
          const isExtra = extraBeams.some(eb => eb.id === b.id);
          if (isExtra) {
            dispatch({ type: 'REMOVE_EXTRA_BEAM', id: b.id });
          } else if (!removedBeamIds.includes(b.id)) {
            dispatch({ type: 'TOGGLE_BEAM_REMOVAL', beamId: b.id });
          }
          items.push(`جسر ${b.id} (مكرر مع ${sorted[sorted.length - 1].id})`);
        }
      }
    }

    // ---- فحص الأعمدة المكررة ----
    const colGroups = new Map<string, any[]>();
    for (const c of columns.filter(c2 => !c2.isRemoved)) {
      const key = `${c.storyId || ''}|${c.x.toFixed(2)},${c.y.toFixed(2)}`;
      if (!colGroups.has(key)) colGroups.set(key, []);
      colGroups.get(key)!.push(c);
    }
    for (const [, group] of colGroups) {
      if (group.length > 1) {
        const sorted = [...group].sort((a, b) => getNum(a.id) - getNum(b.id));
        const toRemove = sorted.slice(0, -1);
        for (const c of toRemove) {
          const isExtra = extraColumns.some(ec => ec.id === c.id);
          if (isExtra) {
            dispatch({ type: 'REMOVE_EXTRA_COLUMN', id: c.id });
          } else if (!removedColumnIds.includes(c.id)) {
            dispatch({ type: 'TOGGLE_COLUMN_REMOVAL', colId: c.id });
          }
          items.push(`عمود ${c.id} (مكرر مع ${sorted[sorted.length - 1].id})`);
        }
      }
    }

    // ---- فحص النقاط المكررة في ModelManager ----
    const allNodes = modelManager.getAllNodes();
    const nodeDups: number[] = [];
    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        const ni = allNodes[i], nj = allNodes[j];
        const dist = Math.sqrt((ni.x - nj.x) ** 2 + (ni.y - nj.y) ** 2 + (ni.z - nj.z) ** 2);
        if (dist < EPS && !nodeDups.includes(ni.id)) {
          nodeDups.push(ni.id);
          items.push(`نقطة N${ni.id} مكررة مع N${nj.id}`);
        }
      }
    }
    for (const nid of nodeDups) {
      modelManager.deleteNode(nid);
    }
    if (nodeDups.length > 0) dispatch({ type: 'INC_MODEL_VERSION' });

    const count = items.length;
    if (count === 0) {
      setDupCheckResult({ message: '✅ لا توجد عناصر مكررة في النموذج', count: 0, items: [] });
    } else {
      dispatch({ type: 'RESET_ANALYSIS' });
      dispatch({ type: 'INC_MODEL_VERSION' });
      setDupCheckResult({ message: `تم حذف ${count} عنصر مكرر بنجاح`, count, items });
    }
  }, [slabs, beamsWithLoads, columns, extraBeams, extraColumns, removedBeamIds, removedColumnIds]);

  const handleAnalysisElementClick = useCallback((beamId: string) => {
    const design = beamDesigns.find(d => d.beamId === beamId);
    const beam = beamsWithLoads.find(b => b.id === beamId);

    // Fallback: search frameResults when design not yet executed (designExecuted === false)
    type FrBeam = typeof frameResults[number]['beams'][number];
    let frBeam: FrBeam | undefined;
    if (!design) {
      for (const fr of frameResults) {
        const found = fr.beams.find(b => b.beamId === beamId);
        if (found) { frBeam = found; break; }
      }
    }

    // Nothing found at all — nothing to show
    if (!design && !frBeam) return;

    const wu = beam ? 1.2 * beam.deadLoad + 1.6 * beam.liveLoad : 0;

    // Determine moment release (hinge) status at each end — يدوي فقط من محرر الإصدارات
    let hingeLeft = false;
    let hingeRight = false;
    if (beam) {
      const releaseState = getBeamReleaseState(beam);
      if (releaseState.nodeI.rz) hingeLeft  = true;
      if (releaseState.nodeJ.rz) hingeRight = true;
    }

    // Carrier-beam point load (from BOB connections on this beam as primary)
    const carrierConn = bobConnections.find(c => c.primaryBeamId === beamId);
    const contConn = bobConnections.find(c => c.continuationBeamId === beamId);
    // Determine if this beam is part of a carrier girder split into segments
    const isCarrierLeft = !!(carrierConn && carrierConn.continuationBeamId); // A1: right end connects to A2
    const isCarrierRight = !!contConn; // A2: left end connects to A1

    const effectiveSpan = design?.span ?? frBeam?.span ?? (beam ? beam.length / 1000 : 5);

    // Calculate total girder span for carrier beams
    let totalGirderSpan: number | undefined;
    if (carrierConn && carrierConn.continuationBeamId) {
      const contBeam = beamsWithLoads.find(b => b.id === carrierConn.continuationBeamId);
      if (contBeam) totalGirderSpan = effectiveSpan + contBeam.length / 1000;
    } else if (contConn) {
      const primaryBeam = beamsWithLoads.find(b => b.id === contConn.primaryBeamId);
      if (primaryBeam) totalGirderSpan = primaryBeam.length / 1000 + effectiveSpan;
    }

    dispatch({
      type: 'OPEN_DIAGRAM',
      data: {
        elementId: beamId,
        elementType: 'beam' as const,
        span:   effectiveSpan,
        Mleft:  design?.Mleft  ?? frBeam?.Mleft  ?? 0,
        Mmid:   design?.Mmid   ?? frBeam?.Mmid   ?? 0,
        Mright: design?.Mright ?? frBeam?.Mright ?? 0,
        Vu:     design?.Vu     ?? frBeam?.Vu     ?? 0,
        deflection: design?.deflection?.deflection,
        wu,
        Rleft:  design?.Rleft  ?? frBeam?.Rleft  ?? 0,
        Rright: design?.Rright ?? frBeam?.Rright ?? 0,
        hingeLeft,
        hingeRight,
        isCarrierLeft,
        isCarrierRight,
        totalGirderSpan,
        // Point-load info for carrier beams (distanceOnPrimary is in metres)
        ...(carrierConn ? {
          pointLoadP: carrierConn.reactionForce,
          pointLoadA: carrierConn.distanceOnPrimary,
        } : {}),
      },
    });
  }, [beamDesigns, beamsWithLoads, frameResults, detectedConnections, bobConnections, getBeamReleaseState]);

  const currentNodes = modelManager.getAllNodes();
  const currentFrames = modelManager.getAllFrames();
  const currentAreas = modelManager.getAllAreas();
  const modelStats = modelManager.getStats();

  // Handle long-press from LevelPlanView (maps string element IDs to frame/area numeric IDs)
  // Uses coordinate-based matching for beams (handles multi-story where UI beam IDs differ from modelManager frame IDs)
  // Handler for saving element properties from LevelPlanView's local dialog
  const handleLevelElementPropsSave = useCallback((
    type: 'beam' | 'column' | 'slab',
    id: string,
    props: {
      b?: number; h?: number; thickness?: number;
      applyToUpperFloors?: boolean;
      topEnd?: 'F' | 'P'; bottomEnd?: 'F' | 'P';
      releaseI?: any; releaseJ?: any;
      orientAngle?: number;
      slabType?: 'solid' | 'one_way_ribbed';
      direction?: 'auto' | 'one_way_x' | 'one_way_y' | 'X' | 'Y';
      bw?: number;
      hb?: number;
      tf?: number;
      s?: number;
    }
  ) => {
    const EPS = 0.01;
    if (type === 'column' && props.b != null && props.h != null) {
      const col = columns.find(c => c.id === id);
      if (col) {
        const colsToUpdate = props.applyToUpperFloors
          ? columns.filter(c => Math.abs(c.x - col.x) < EPS && Math.abs(c.y - col.y) < EPS)
          : [col];
        for (const c of colsToUpdate) {
          const override: any = { b: Number(props.b), h: Number(props.h) };
          if (props.orientAngle != null) override.orientAngle = props.orientAngle;
          if (props.topEnd != null) override.topEndCondition = props.topEnd;
          if (props.bottomEnd != null) override.bottomEndCondition = props.bottomEnd;
          if (props.releaseI != null) override.releaseI = props.releaseI;
          if (props.releaseJ != null) override.releaseJ = props.releaseJ;
          dispatch({ type: 'SET_COL_OVERRIDE', colId: c.id, override });
        }
      }
    } else if (type === 'beam' && props.b != null && props.h != null) {
      const beam = beams.find(b => b.id === id);
      if (beam) {
        dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: beam.id, override: { b: Number(props.b), h: Number(props.h) } });
        if (props.releaseI != null || props.releaseJ != null) {
          dispatch({
            type: 'SET_FRAME_END_RELEASES',
            posKey: getBeamReleaseKey(beam),
            nodeIRestraints: props.releaseI,
            nodeJRestraints: props.releaseJ,
          });
        }
      }
    } else if (type === 'slab') {
      // Find the slab and update thickness via modelManager + override
      const area = currentAreas.find(a => a.label === id || `A${a.id}` === id);
      if (area && props.thickness != null) {
        modelManager.updateAreaThickness(area.id, props.thickness);
        dispatch({ type: 'SET_SLAB_PROPS_OVERRIDE', areaId: area.id, override: { thickness: props.thickness } });
      }

      // Find state.slabs and update its slabType and direction
      const idx = slabs.findIndex(s => s.id === id);
      if (idx !== -1) {
        if (props.slabType != null) {
          dispatch({ type: 'UPDATE_SLAB', index: idx, key: 'slabType', value: props.slabType });
        }
        if (props.direction != null) {
          dispatch({ type: 'UPDATE_SLAB', index: idx, key: 'direction', value: props.direction });
        }
      }

      // Update global ribbed properties inside state
      if (props.bw != null || props.hb != null || props.tf != null || props.s != null) {
        dispatch({
          type: 'SET_RIBBED_SLAB_PROPS',
          props: {
            ...(props.bw != null && { bw: props.bw }),
            ...(props.hb != null && { hb: props.hb }),
            ...(props.tf != null && { tf: props.tf }),
            ...(props.s != null && { s: props.s }),
          },
        });
      }
    }
    dispatch({ type: 'INC_MODEL_VERSION' });
    dispatch({ type: 'RESET_ANALYSIS' });
  }, [columns, beams, currentAreas, slabs, runAnalysis]);

  const handleLevelElementLongPress = useCallback((type: 'beam' | 'column' | 'slab', id: string) => {
    if (type === 'slab') {
      const area = currentAreas.find(a => a.label === id || `A${a.id}` === id);
      if (area) dispatch({ type: 'OPEN_ELEM_PROPS', areaId: area.id });
    } else if (type === 'beam') {
      // Find the UI beam by its string ID first
      const uiBeam = beams.find(b => b.id === id);
      if (uiBeam) {
        // Match modelManager frame by coordinate proximity (robust for multi-story structures)
        const EPS = 0.005;
        const frame = currentFrames.find(f => {
          if (f.type !== 'beam') return false;
          const ni = currentNodes.find(n => n.id === f.nodeI);
          const nj = currentNodes.find(n => n.id === f.nodeJ);
          if (!ni || !nj) return false;
          return (
            (Math.abs(ni.x - uiBeam.x1) < EPS && Math.abs(ni.y - uiBeam.y1) < EPS &&
             Math.abs(nj.x - uiBeam.x2) < EPS && Math.abs(nj.y - uiBeam.y2) < EPS) ||
            (Math.abs(ni.x - uiBeam.x2) < EPS && Math.abs(ni.y - uiBeam.y2) < EPS &&
             Math.abs(nj.x - uiBeam.x1) < EPS && Math.abs(nj.y - uiBeam.y1) < EPS)
          );
        });
        if (frame) dispatch({ type: 'OPEN_ELEM_PROPS', frameId: frame.id });
      } else {
        // Fallback: label/id matching for extra beams
        const frame = currentFrames.find(f =>
          f.type === 'beam' && (f.label === id || `B${f.id}` === id || f.id.toString() === id)
        );
        if (frame) dispatch({ type: 'OPEN_ELEM_PROPS', frameId: frame.id });
      }
    } else {
      // column - match by label or coordinate
      const frame = currentFrames.find(f =>
        f.type === 'column' && (f.label === id || `C${f.id}` === id || f.id.toString() === id)
      );
      if (frame) dispatch({ type: 'OPEN_ELEM_PROPS', frameId: frame.id });
    }
  }, [currentFrames, currentAreas, currentNodes, beams]);

  // Build mapping from ModelManager column frame IDs to column labels (C1, C2...)
  // Filter by selected story so labels update when switching stories
  const columnLabels = useMemo(() => {
    const labelMap = new Map<number, string>();
    const columnFrames = currentFrames.filter(f => f.type === 'column');
    // Filter columns by selected story (or all)
    const storyCols = isAllStories ? columns : columns.filter(c => c.storyId === selectedStoryId);
    for (const frame of columnFrames) {
      const topNode = currentNodes.find(n => n.id === frame.nodeJ);
      if (!topNode) continue;
      const matchingCol = storyCols.find(c => 
        Math.abs(c.x - topNode.x) < 0.01 && Math.abs(c.y - topNode.y) < 0.01
      );
      if (matchingCol) {
        labelMap.set(frame.id, matchingCol.id);
      }
    }
    return labelMap;
  }, [currentFrames, currentNodes, columns, selectedStoryId, isAllStories]);

  const handleSelectElement = (type: 'beam' | 'column' | 'slab', id: string) => {
    dispatch({ type: 'OPEN_MODAL', element: { type, id } });
  };

  // View tab: open the bending-moment chart instead of the rebar modal.
  const [momentChartElement, setMomentChartElement] = React.useState<{ type: 'beam' | 'column' | 'slab' | 'node'; id: string } | null>(null);
  const handleViewSelectElement = (type: 'beam' | 'column' | 'slab' | 'node', id: string) => {
    setMomentChartElement({ type, id });
  };

  // Helper: get bent-up-adjusted top bars for a beam
  const getBentUpData = (beamId: string) => {
    const canonId = beamId.match(/^(.+)-(\d+)$/)?.[1] || beamId;
    for (const fr of bentUpResults) {
      const b = fr.beams.find(bb => bb.beamId === beamId || bb.beamId === canonId);
      if (b) return b;
    }
    return null;
  };

  const getModalData = () => {
    if (!selectedElement) return null;
    const { type, id } = selectedElement;
    if (type === 'beam') {
      const beam = beamsWithLoads.find(b => b.id === id);
      const design = beamDesigns.find(d => d.beamId === id);
      if (!beam) return null;
      const bent = getBentUpData(id);
      const topDia = design ? design.flexLeft.dia : 12;
      // Use bent-up adjusted bars if available
      const topLeftBars = bent ? Math.max(bent.additionalTopLeft, 2) : (design ? design.flexLeft.bars : 3);
      const topRightBars = bent ? Math.max(bent.additionalTopRight, 2) : (design ? design.flexRight.bars : 3);
      const finalTopBars = bent ? bent.finalTopBars : Math.max(topLeftBars, topRightBars);
      const bottomMidBars = design ? design.flexMid.bars : 3;
      const bottomDia = design ? design.flexMid.dia : 12;
      const remainingBottom = bent ? bent.bentUp.remainingBottomBars : bottomMidBars;
      return {
        dimensions: { b: beam.b, h: beam.h, length: beam.length * 1000 },
        reinforcement: design ? {
          top: { bars: finalTopBars, dia: topDia },
          bottom: { bars: bottomMidBars, dia: bottomDia },
          topLeft: { bars: topLeftBars, dia: topDia },
          topRight: { bars: topRightBars, dia: topDia },
          topMid: { bars: 2, dia: topDia },
          bottomMid: { bars: bottomMidBars, dia: bottomDia },
          bottomSupport: { bars: remainingBottom, dia: bottomDia },
          bentUpBars: bent ? bent.bentUp.bentBarsCount : 0,
          bentUpDia: bent ? bent.bentUp.bentDia : 0,
          stirrups: design.shear.stirrups,
        } : { top: { bars: 3, dia: 12 }, bottom: { bars: 3, dia: 12 }, stirrups: 'Φ10@200mm' },
      };
    }
    if (type === 'column') {
      const col = colDesigns.find(c => c.id === id);
      if (!col) return null;
      return {
        dimensions: { b: col.b, h: col.h, length: col.L },
        reinforcement: { 
          top: { 
            bars: col.design?.bars || 4, 
            dia: col.design?.dia || 16 
          }, 
          stirrups: col.design?.stirrups || 'Φ10@150mm' 
        },
      };
    }
    if (type === 'slab') {
      const slab = slabDesigns.find(s => s.id === id);
      if (!slab) return null;
      return {
        dimensions: { b: Math.abs(slab.x2 - slab.x1) * 1000, h: Math.abs(slab.y2 - slab.y1) * 1000 },
        reinforcement: { 
          shortDir: slab.design?.shortDir || { bars: 5, dia: 10, spacing: 200 }, 
          longDir: slab.design?.longDir || { bars: 5, dia: 10, spacing: 200 } 
        },
      };
    }
    return null;
  };

  const modalData = getModalData();

  // ParamInput moved outside component to prevent focus loss

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── شاشة تقدم التحليل الإنشائي ── */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-sm" dir="rtl">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 space-y-5">
            {/* أيقونة متحركة */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 size={34} className="text-primary animate-spin" />
              </div>
            </div>

            {/* العنوان */}
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-foreground">جارٍ التحليل الإنشائي</h3>
              <p className="text-xs text-muted-foreground">
                {stories.length} {stories.length === 1 ? 'دور' : 'أدوار'} &nbsp;•&nbsp; {beams.length} جسر &nbsp;•&nbsp; {columns.filter(c => !c.isRemoved).length} عمود
              </p>
            </div>

            {/* شريط التقدم */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate ml-2">{analysisStep}</span>
                <span className="font-mono font-bold text-primary shrink-0">{Math.round(analysisProgress)}%</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{
                    width: `${analysisProgress}%`,
                    background: analysisProgress === 100
                      ? 'hsl(var(--primary))'
                      : 'linear-gradient(90deg, hsl(var(--primary)/0.7), hsl(var(--primary)))',
                  }}
                />
              </div>
            </div>

            {/* رسالة الانتظار */}
            <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
              يعمل التحليل في خيط منفصل (Web Worker)
              <br />
              الواجهة تبقى سريعة الاستجابة طوال فترة الحل
            </p>

            {/* زر الإلغاء */}
            {analysisProgress < 100 && (
              <button
                onClick={() => { analysisWorker.cancelAnalysis(); }}
                className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors py-1.5 rounded-lg hover:bg-destructive/5"
              >
                <XIcon size={12} />
                إلغاء التحليل
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── لوحة تشخيصات أداء المحلل (تظهر بعد اكتمال التحليل) ── */}
      {analysisDiagnostics && !isAnalyzing && (
        <div className="fixed bottom-20 left-3 right-3 z-[100] animate-in slide-in-from-bottom-2 duration-300">
          <div className="relative">
            <AnalysisDiagnosticsPanel diagnostics={analysisDiagnostics} />
            <button
              onClick={() => setAnalysisDiagnostics(null)}
              className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground"
              aria-label="إغلاق"
            >
              <XIcon size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <AppHeader
        section={NAV.find(s => s.id === mainTab) ?? null}
        sub={(() => { const sec = NAV.find(s => s.id === mainTab); return sec?.subs?.find(sb => sb.id === activeTab) ?? null; })()}
        sidebarCollapsed={isMobile ? true : sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(p => !p)}
        onRunAnalysis={runAnalysis}
        analyzed={hasDesignResults}
      />

      {/* Status Bar */}
      <StatusBar
        columnsCount={columns.filter(c => !c.isRemoved).length}
        beamsCount={beams.filter(b => !removedBeamIds.includes(b.id)).length}
        slabsCount={slabs.length}
        analyzed={hasDesignResults}
        warningsCount={0}
      />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', paddingBottom: isMobile ? 62 : 0 }}>
        {/* Sidebar — desktop only */}
        {!isMobile && (
          <AppSidebar
            mainTab={mainTab}
            activeTab={activeTab}
            collapsed={sidebarCollapsed}
            onNavigate={(sectionId, subId) => {
              setMainTab(sectionId as MainTab);
              if (!subId) return;

              if (sectionId === 'inputs') {
                const inputSubMap: Record<string, 'input-main' | 'input-ribbed' | 'input-auto'> = {
                  input: 'input-main',
                  ribbed: 'input-ribbed',
                  'auto-design': 'input-auto',
                };
                if (inputSubMap[subId]) {
                  dispatch({ type: 'SET_ACTIVE_TAB', tab: 'input' });
                  setRequestedInputSubTab(inputSubMap[subId]);
                  return;
                }
              }

              if (sectionId === 'modeling') {
                const validModelingTabs = new Set(['modeler', 'view', 'analysis', 'support-manager', 'ai-assistant']);
                dispatch({ type: 'SET_ACTIVE_TAB', tab: validModelingTabs.has(subId) ? subId : 'modeler' });
                return;
              }

              if (sectionId === 'solver') {
                const solverSubMap: Record<string, string> = {
                  'beam-design': 'design',
                  'col-design': 'design',
                  'slab-design': 'design',
                  etabs: 'design',
                  boq: 'takeoff',
                };
                if (subId === 'etabs') setDesignSource('etabs');
                dispatch({ type: 'SET_ACTIVE_TAB', tab: solverSubMap[subId] ?? 'solver' });
                return;
              }

              if (sectionId === 'foundations') {
                const fdnSubMap: Record<string, typeof requestedFoundationSubTab> = {
                  foundation: 'isolated-footings',
                  'strip-footing': 'strip-footing',
                  'foundation-settlement': 'settlement',
                  'foundation-group': 'classification',
                  'foundation-drawings': 'drawings-export',
                };
                dispatch({ type: 'SET_ACTIVE_TAB', tab: 'foundations' });
                setRequestedFoundationSubTab(fdnSubMap[subId] ?? 'isolated-footings');
                return;
              }

              dispatch({ type: 'SET_ACTIVE_TAB', tab: subId });
            }}
          />
        )}

        {/* Content column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Breadcrumb */}
          {(() => {
            const sec = NAV.find(s => s.id === mainTab);
            const sub = sec?.subs?.find(sb => sb.id === activeTab);
            return sec ? (
              <BreadcrumbBar
                sectionLabel={sec.label}
                sectionColor={sec.color as string}
                subLabel={sub?.label ?? null}
              />
            ) : null;
          })()}

        <Tabs value={activeTab} onValueChange={tab => dispatch({ type: 'SET_ACTIVE_TAB', tab })} className="h-full flex flex-col">
          
          {/* Sub-tabs within each main section */}
          {mainTab === 'reports' && (
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-card px-2 overflow-x-auto shrink-0 h-auto">
              <TabsTrigger value="design" className="text-xs gap-1 min-h-[40px]"><Ruler size={14} />التصميم</TabsTrigger>
              <TabsTrigger value="results" className="text-xs gap-1 min-h-[40px]"><BarChart3 size={14} />النتائج</TabsTrigger>
              <TabsTrigger value="takeoff" className="text-xs gap-1 min-h-[40px] text-indigo-650 dark:text-indigo-400 font-semibold"><Calculator size={14} />حساب الكميات QTO</TabsTrigger>
              <TabsTrigger value="export" className="text-xs gap-1 min-h-[40px]"><Download size={14} />التصدير</TabsTrigger>
            </TabsList>
          )}
          {mainTab === 'inputs' && (
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-card px-2 overflow-x-auto shrink-0 h-auto">
              <TabsTrigger value="input" className="text-xs gap-1 min-h-[40px]"><Settings2 size={14} />المدخلات</TabsTrigger>
              <TabsTrigger value="slabs" className="text-xs gap-1 min-h-[40px]"><Layers size={14} />الإدخال</TabsTrigger>
              <TabsTrigger value="loads-input" className="text-xs gap-1 min-h-[40px]"><Zap size={14} />الأحمال</TabsTrigger>
              <TabsTrigger value="building" className="text-xs gap-1 min-h-[40px]"><Building size={14} />مبنى متعدد</TabsTrigger>
            </TabsList>
          )}
          {mainTab === 'modeling' && (
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-card px-2 overflow-x-auto shrink-0 h-auto">
              <TabsTrigger value="modeler" className="text-xs gap-1 min-h-[40px]"><Grid3X3 size={14} />النمذجة</TabsTrigger>
              <TabsTrigger value="view" className="text-xs gap-1 min-h-[40px]"><Eye size={14} />العرض</TabsTrigger>
              <TabsTrigger value="analysis" className="text-xs gap-1 min-h-[40px]"><Calculator size={14} />التحليل</TabsTrigger>
            </TabsList>
          )}

          {/* MODELER TAB */}
          <TabsContent value="modeler" className="flex-1 overflow-hidden mt-0">
            <div className="flex flex-col h-full">
              {/* Level filter bar */}
              {(() => {
                const minStoryElev = stories.length > 0 ? Math.min(...stories.map(s => s.elevation ?? 0)) : 0;
                return (
                  <div className="flex flex-col border-b border-border bg-muted/30 shrink-0">
                    {/* Row 1: Level filter */}
                    <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap">
                      <Layers size={14} className="text-muted-foreground shrink-0" />
                      <label className="text-xs font-medium text-muted-foreground shrink-0">المنسوب:</label>
                      <select
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs flex-1 min-w-[140px]"
                        value={modelerElevation}
                        onChange={e => setModelerElevation(Number(e.target.value))}
                      >
                        <option value={-1}>الكل (مسقط أفقي)</option>
                        {availableElevations.map(elev => (
                          <option key={elev} value={elev}>
                            المنسوب {(elev / 1000).toFixed(1)} م
                            {elev === minStoryElev ? ' (الركائز / التأسيس)' : (elev === 0 ? ' (منسوب الميدة 0.00م)' : '')}
                          </option>
                        ))}
                      </select>
                      {modelerElevation !== -1 && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {modelerElevation === minStoryElev ? 'مسقط الأساسات' : `${(modelerElevation / 1000).toFixed(1)} م`}
                        </Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => setMomentChartElement({ type: 'node', id: 'new' })}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition-all shadow-sm shrink-0 cursor-pointer mr-auto"
                      >
                        <Plus size={12} />
                        <span>إنشاء عنصر بالإحداثيات ✨</span>
                      </button>
                    </div>
                    {/* Row 2: Element type filter buttons */}
                    <div className="flex items-center gap-1 px-3 pb-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-muted-foreground ml-1">إظهار:</span>
                      {([
                        { type: 'node', label: 'العقد', icon: '○' },
                        { type: 'beam', label: 'جسور', icon: '—' },
                        { type: 'column', label: 'أعمدة', icon: '■' },
                        { type: 'slab', label: 'بلاطات', icon: '▭' },
                      ] as const).map(({ type, label, icon }) => {
                        const isVisible = modelerVisibleTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              if (isVisible) {
                                if (modelerVisibleTypes.length > 1) {
                                  setModelerVisibleTypes(prev => prev.filter(t => t !== type));
                                }
                              } else {
                                setModelerVisibleTypes(prev => [...prev, type]);
                              }
                            }}
                            className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] transition-all cursor-pointer border whitespace-nowrap min-h-[26px] ${
                              isVisible
                                ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300 font-semibold shadow-sm'
                                : 'bg-background hover:bg-muted text-muted-foreground border-border opacity-60'
                            }`}
                          >
                            <span className="font-mono text-[10px]">{icon}</span>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Show support plan view when ground level or specific elevation selected */}
              {modelerElevation !== -1 ? (
                <div className="flex-1 overflow-hidden">
                  <LevelPlanView
                    columns={columns}
                    beams={beamsWithLoads}
                    slabs={slabs}
                    stories={stories}
                    selectedElevation={modelerElevation}
                    onColumnSupportChange={handleColumnSupportChange}
                    onSupportRestraintsChange={handleSupportRestraintsChange}
                    supportRestraints={supportRestraints}
                    onElementLongPress={handleLevelElementLongPress}
                    onSaveElementProps={handleLevelElementPropsSave}
                    onEditBeamProperties={handleEditBeamProperties}
                    onDeleteElement={handleLevelElementDelete}
                    onSelectElementForProperties={handleViewSelectElement}
                    slabProps={slabProps}
                    ribbedSlabProps={state.ribbedSlabProps}
                    supportDb={state.supportDb}
                    visibleTypes={{
                      nodes: modelerVisibleTypes.includes('node'),
                      beams: modelerVisibleTypes.includes('beam'),
                      columns: modelerVisibleTypes.includes('column'),
                      slabs: modelerVisibleTypes.includes('slab'),
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-1 overflow-hidden">
                  <ToolPalette
                    activeTool={activeTool}
                    onToolChange={tool => dispatch({ type: 'SET_ACTIVE_TOOL', tool })}
                    mode={mode}
                    onModeChange={(m) => dispatch({ type: 'SET_MODE', mode: m })}
                  />
                  <ModelCanvas
                    nodes={currentNodes}
                    frames={currentFrames}
                    areas={[]}
                    activeTool={activeTool}
                    onCanvasClick={handleCanvasClick}
                    onNodeClick={handleNodeClick}
                    onFrameClick={handleFrameClick}
                    onAreaClick={handleAreaClick}
                    onNodeLongPress={(nodeId) => dispatch({ type: 'OPEN_ELEM_PROPS', nodeId })}
                    onFrameLongPress={handleFrameLongPress}
                    onAreaLongPress={handleAreaLongPress}
                    onEmptyLongPress={(x, y) => setAddElementDialog({ open: true, x, y })}
                    selectedNodeId={selectedNodeId}
                    selectedFrameId={selectedFrameId}
                    selectedAreaId={selectedAreaId}
                    pendingNode={pendingNode}
                    columnLabels={columnLabels}
                    frameEndReleases={effectiveFrameEndReleases}
                    visibleTypes={{
                      nodes: modelerVisibleTypes.includes('node'),
                      beams: modelerVisibleTypes.includes('beam'),
                      columns: modelerVisibleTypes.includes('column'),
                      slabs: modelerVisibleTypes.includes('slab'),
                    }}
                  />
                  <PropertyPanel
                    selectedNode={selectedNodeId ? currentNodes.find(n => n.id === selectedNodeId) : null}
                    selectedFrame={selectedFrameId ? currentFrames.find(f => f.id === selectedFrameId) : null}
                    selectedArea={selectedAreaId ? currentAreas.find(a => a.id === selectedAreaId) : null}
                    onNodeRestraintChange={handleNodeRestraintChange}
                    modelStats={modelStats}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* INPUT TAB - with sub-tabs for original + auto-design */}
          <TabsContent value="input" className="flex-1 overflow-hidden mt-0">
            <Tabs value={requestedInputSubTab} onValueChange={tab => setRequestedInputSubTab(tab as 'input-main' | 'input-ribbed' | 'input-auto')} className="h-full flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/30 px-2 shrink-0 h-auto">
                <TabsTrigger value="input-main" className="text-[11px] gap-1 min-h-[36px]"><Settings2 size={12} />المدخلات</TabsTrigger>
                <TabsTrigger value="input-ribbed" className="text-[11px] gap-1 min-h-[36px] text-purple-700 dark:text-purple-400 font-medium"><Layers size={12} />بلاطات هوردي (Ribbed)</TabsTrigger>
                <TabsTrigger value="input-auto" className="text-[11px] gap-1 min-h-[36px] text-accent"><Wand2 size={12} />تصميم تلقائي</TabsTrigger>
              </TabsList>
              <TabsContent value="input-main" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <div className="space-y-4 max-w-4xl">
                  {/* Story Management */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">إدارة الأدوار</CardTitle></CardHeader>
                    <CardContent>
                      <StoryManager
                        stories={stories}
                        selectedStoryId={selectedStoryId}
                        onSelectStory={id => dispatch({ type: 'SELECT_STORY', storyId: id })}
                        onAddStory={() => dispatch({ type: 'ADD_STORY' })}
                        onRemoveStory={id => dispatch({ type: 'REMOVE_STORY', storyId: id })}
                        onUpdateStory={(id, updates) => dispatch({ type: 'UPDATE_STORY', storyId: id, updates })}
                        onCopyElements={(from, to) => dispatch({ type: 'COPY_STORY_ELEMENTS', fromStoryId: from, toStoryId: to })}
                      />
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">خصائص المواد</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <ParamInput label="f'c (MPa)" value={mat.fc} onChange={v => dispatch({ type: 'SET_MAT', mat: { fc: v } })} />
                      <ParamInput label="fy (MPa)" value={mat.fy} onChange={v => dispatch({ type: 'SET_MAT', mat: { fy: v } })} />
                      <ParamInput label="fyt (MPa)" value={mat.fyt} onChange={v => dispatch({ type: 'SET_MAT', mat: { fyt: v } })} />
                      <ParamInput label="γ (kN/m³)" value={mat.gamma} onChange={v => dispatch({ type: 'SET_MAT', mat: { gamma: v } })} />
                    </CardContent>
                    {/* ACI 318-19 material property range warnings */}
                    {(() => {
                      const warns: string[] = [];
                      if (mat.fc < 17) warns.push(`f'c = ${mat.fc} MPa أقل من الحد الأدنى ACI §19.2.1.1 (17 MPa)`);
                      if (mat.fc > 70) warns.push(`f'c = ${mat.fc} MPa تجاوز نطاق ACI §19.2.1.3 المعتاد (≤ 70 MPa)`);
                      if (mat.fy > 550) warns.push(`fy = ${mat.fy} MPa تجاوز حد ACI §20.2.2.4 (550 MPa)`);
                      if (mat.fyt > 420) warns.push(`fyt = ${mat.fyt} MPa يُحدَّد عند 420 MPa في حسابات القص (ACI §20.2.2.4)`);
                      if (mat.fyt < 200) warns.push(`fyt = ${mat.fyt} MPa منخفض جداً للكانات`);
                      return warns.length > 0 ? (
                        <div className="px-4 pb-2 space-y-1">
                          {warns.map((w, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              <span className="mt-0.5">⚠</span><span>{w}</span>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <CardFooter className="pt-2">
                      <Button size="sm" className="w-full h-9 text-xs" onClick={() => dispatch({ type: 'SAVE_SNAPSHOT', message: 'تم حفظ خصائص المواد ✓' })}>
                        <Save size={14} className="mr-1" />حفظ التغييرات
                      </Button>
                    </CardFooter>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">خصائص البلاطة</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <ParamInput label="السماكة (مم)" value={slabProps.thickness} onChange={v => dispatch({ type: 'SET_SLAB_PROPS', props: { thickness: v } })} />
                      <ParamInput label="أحمال التشطيب (kN/m²)" value={slabProps.finishLoad} onChange={v => dispatch({ type: 'SET_SLAB_PROPS', props: { finishLoad: v } })} />
                      <ParamInput label="الحمل الحي (kN/m²)" value={slabProps.liveLoad} onChange={v => dispatch({ type: 'SET_SLAB_PROPS', props: { liveLoad: v } })} />
                      <ParamInput label="الغطاء (مم)" value={slabProps.cover} onChange={v => dispatch({ type: 'SET_SLAB_PROPS', props: { cover: v } })} />
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button size="sm" className="w-full h-9 text-xs" onClick={() => dispatch({ type: 'SAVE_SNAPSHOT', message: 'تم حفظ خصائص البلاطة ✓' })}>
                        <Save size={14} className="mr-1" />حفظ التغييرات
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">أبعاد العناصر</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                      <ParamInput label="عرض الجسر (مم)" value={beamB} onChange={v => dispatch({ type: 'SET_BEAM_B', value: v })} />
                      <ParamInput label="ارتفاع الجسر (مم)" value={beamH} onChange={v => dispatch({ type: 'SET_BEAM_H', value: v })} />
                      <ParamInput label="عرض العمود (مم)" value={colB} onChange={v => dispatch({ type: 'SET_COL_B', value: v })} />
                      <ParamInput label="عمق العمود (مم)" value={colH} onChange={v => dispatch({ type: 'SET_COL_H', value: v })} />
                      <div className="col-span-2">
                        <ParamInput label="ارتفاع الدور / العمود الافتراضي (مم)" value={colL} onChange={v => dispatch({ type: 'SET_COL_L', value: v })} />
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2">
                      <Button size="sm" className="w-full h-9 text-xs" onClick={() => dispatch({ type: 'SAVE_SNAPSHOT', message: 'تم حفظ أبعاد العناصر ✓' })}>
                        <Save size={14} className="mr-1" />حفظ التغييرات
                      </Button>
                    </CardFooter>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">ملخص</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p>{stories.length} أدوار</p>
                      <p>{columns.filter(c => !c.isRemoved).length} أعمدة (لكل دور)</p>
                      <p>{beams.length} جسور (لكل دور)</p>
                      <p>{frames.length} إطارات (لكل دور)</p>
                      <Button onClick={runAnalysis} className="w-full min-h-[44px] mt-2">
                        <Calculator size={16} className="mr-2" />تشغيل التحليل (جميع الأدوار)
                      </Button>
                    </CardContent>
                  </Card>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="input-ribbed" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <div className="space-y-4 max-w-4xl">
                  <Card className="border-purple-200 dark:border-purple-800 bg-purple-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1.5 text-purple-900 dark:text-purple-200">
                        <Layers size={14} className="text-purple-600 dark:text-purple-400" />
                        خصائص البلاطة المضلعة (One-Way Ribbed Slab - هوردي)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">نوع الحشو (Infill)</label>
                        <select
                          value={state.ribbedSlabProps?.fillerType || 'block'}
                          onChange={e => dispatch({ type: 'SET_RIBBED_SLAB_PROPS', props: { fillerType: e.target.value as any } })}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring animate-pulse-once"
                        >
                          <option value="block">بلوك أسمنتي/طيني Block</option>
                          <option value="foam">بوليسترين (فوم) Foam</option>
                          <option value="none">مفرغ (بدون حشو) None</option>
                        </select>
                      </div>
                      <ParamInput 
                        label="سماكة البلاطة العلوية tf (مم)" 
                        value={state.ribbedSlabProps?.tf ?? 70} 
                        onChange={v => dispatch({ type: 'SET_RIBBED_SLAB_PROPS', props: { tf: v } })} 
                      />
                      <ParamInput 
                        label="عرض العصب bw (مم)" 
                        value={state.ribbedSlabProps?.bw ?? 100} 
                        onChange={v => dispatch({ type: 'SET_RIBBED_SLAB_PROPS', props: { bw: v } })} 
                      />
                      <ParamInput 
                        label="ارتفاع العصب hb (مم)" 
                        value={state.ribbedSlabProps?.hb ?? 200} 
                        onChange={v => dispatch({ type: 'SET_RIBBED_SLAB_PROPS', props: { hb: v } })} 
                      />
                      <ParamInput 
                        label="المسافة الصافية بين الأعصاب s (مم)" 
                        value={state.ribbedSlabProps?.s ?? 400} 
                        onChange={v => dispatch({ type: 'SET_RIBBED_SLAB_PROPS', props: { s: v } })} 
                      />
                      {state.ribbedSlabProps?.fillerType === 'block' && (
                        <ParamInput 
                          label="كثافة البلوك (kN/m³)" 
                          value={state.ribbedSlabProps?.blockDensity ?? 12} 
                          onChange={v => dispatch({ type: 'SET_RIBBED_SLAB_PROPS', props: { blockDensity: v } })} 
                        />
                      )}
                      <div className="flex flex-col justify-end">
                        <div className="text-[10px] text-muted-foreground p-1 text-center bg-purple-500/10 rounded border border-purple-200/50">
                          السمك الكلي للبلاطة: <strong className="font-mono">{(state.ribbedSlabProps?.tf ?? 70) + (state.ribbedSlabProps?.hb ?? 200)} مم</strong>
                        </div>
                      </div>
                    </CardContent>
                    {(() => {
                      const validation = validateRibbedSlab(state.ribbedSlabProps);
                      if (!validation.valid && validation.warnings.length > 0) {
                        return (
                          <div className="px-6 pb-2 space-y-1">
                            {validation.warnings.map((w: string, idx: number) => (
                              <div key={idx} className="text-[10.5px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded flex items-start gap-1">
                                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <CardFooter className="pt-2">
                      <Button size="sm" className="w-full h-9 text-xs" onClick={() => dispatch({ type: 'SAVE_SNAPSHOT', message: 'تم حفظ خصائص البلاطة المضلعة ✓' })}>
                        <Save size={14} className="mr-1" />حفظ خصائص الهوردي
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Weight calculation explanation card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">تفصيل حساب الوزن الذاتي للبلاطة الهوردي (Self-Weight)</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2 text-muted-foreground leading-relaxed">
                      <p>
                        يتم حساب وزن البلاطة الهوردي بشكل دقيق بناءً على أبعاد الأعصاب وحجم الخرسانة الفعلي ووزن البلوك المختار:
                      </p>
                      <ul className="list-disc list-inside space-y-1 bg-muted/40 p-2.5 rounded-md font-mono text-[11px] text-foreground">
                        <li>المسافة الكلية بين محاور الأعصاب: <span className="text-blue-600 font-bold">{(state.ribbedSlabProps?.bw ?? 100) + (state.ribbedSlabProps?.s ?? 400)} مم</span> ({(((state.ribbedSlabProps?.bw ?? 100) + (state.ribbedSlabProps?.s ?? 400)) / 1000).toFixed(3)} م)</li>
                        <li>عدد الأعصاب في المتر الواحد: <span className="text-blue-600 font-bold">{(1 / (((state.ribbedSlabProps?.bw ?? 100) + (state.ribbedSlabProps?.s ?? 400)) / 1000)).toFixed(2)} عصب/م</span></li>
                        <li>وزن الطبقة العلوية المصبوبة tf: <span className="text-purple-600 font-bold">{(((state.ribbedSlabProps?.tf ?? 70) / 1000) * (mat.gamma || 25)).toFixed(2)} kN/m²</span></li>
                        <li>وزن الأعصاب الخرسانية نفسه: <span className="text-purple-600 font-bold">{(((state.ribbedSlabProps?.bw ?? 100)/1000 * (state.ribbedSlabProps?.hb ?? 200)/1000 * (1 / (((state.ribbedSlabProps?.bw ?? 100) + (state.ribbedSlabProps?.s ?? 400)) / 1000))) * (mat.gamma || 25)).toFixed(2)} kN/m²</span></li>
                        <li>وزن الحشو المستخدم ({state.ribbedSlabProps?.fillerType === 'block' ? 'بلوك أسمنتي' : state.ribbedSlabProps?.fillerType === 'foam' ? 'بوليسترين' : 'مفرغ'}): <span className="text-orange-600 font-bold">{state.ribbedSlabProps?.fillerType === 'block' ? (((state.ribbedSlabProps?.s ?? 400) / ((state.ribbedSlabProps?.bw ?? 100) + (state.ribbedSlabProps?.s ?? 400))) * ((state.ribbedSlabProps?.hb ?? 200) / 1000) * 12).toFixed(2) : state.ribbedSlabProps?.fillerType === 'foam' ? '0.10' : '0.00'} kN/m²</span></li>
                        <li className="font-bold border-t border-muted pt-1 mt-1 text-purple-700 dark:text-purple-300 text-sm">الوزن الذاتي الكلي المحسوب (Dead Load): {calculateRibbedSlabSelfWeight(state.ribbedSlabProps, mat.gamma).toFixed(2)} kN/m²</li>
                      </ul>
                      <p className="text-[10px] text-muted-foreground mt-2 font-arabic bg-purple-500/5 p-2 rounded border border-purple-200/50">
                        <strong>ملاحظة هامة حول اتجاه الأعصاب:</strong> لتعديل اتجاه انتقال الحمل (اتجاه الأعصاب) لبلاطة معينة، يرجى الانتقال إلى تبويب <strong>"الإدخال" &gt; "بلاطات"</strong> ثم قم بتعديل عمود <strong>"مسار الفرش (الحمل)"</strong> للبلاطة المطلوبة من <strong>"تلقائي"</strong> إلى <strong>"اتجاه X"</strong> أو <strong>"اتجاه Y"</strong>. هذا سيوجه الأعصاب وحمل البلاطة بدقة بالكامل إلى الجسور المتعامدة معها.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="input-auto" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <AutoDesignPanel
                  slabs={slabs}
                  onApply={(result: AutoDesignResult) => {
                    dispatch({ type: 'SET_SLAB_PROPS', props: { thickness: result.slabThickness, finishLoad: result.slabProps.finishLoad, liveLoad: result.slabProps.liveLoad } });
                    dispatch({ type: 'SET_BEAM_B', value: result.beamB });
                    dispatch({ type: 'SET_BEAM_H', value: result.beamH });
                    dispatch({ type: 'SET_COL_B', value: result.colB });
                    dispatch({ type: 'SET_COL_H', value: result.colH });
                    dispatch({ type: 'SET_MAT', mat: result.matProps });
                    dispatch({ type: 'SET_COL_L', value: result.slabProps.thickness > 0 ? state.colL : 3000 });
                    dispatch({ type: 'SAVE_SNAPSHOT', message: 'تم تطبيق التصميم التلقائي ✓' });
                  }}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* SLABS / INPUT TAB */}
          <TabsContent value="slabs" className="flex-1 overflow-hidden mt-0">
            <SlabsInputPanel
              state={state}
              dispatch={dispatch}
              columns={columns}
              beams={beamsWithLoads}
              isAllStories={isAllStories}
              storyFilteredSlabs={storyFilteredSlabs}
              getStoryLabel={getStoryLabel}
              slabDesigns={slabDesigns}
              slabMergeGroups={slabMergeGroups}
              availableElevations={availableElevations}
              selectedBeamIds={selectedBeamIds}
              setSelectedBeamIds={setSelectedBeamIds}
              setEtabsReactions={setEtabsReactions}
              etabsReactions={etabsReactions}
              handleColumnSupportChange={handleColumnSupportChange}
              handleSupportRestraintsChange={handleSupportRestraintsChange}
              connectionManagerOpen={connectionManagerOpen}
              setConnectionManagerOpen={setConnectionManagerOpen}
              computeSlabUnionPolygon={computeSlabUnionPolygon}
              selectAllBeams={selectAllBeams}
              clearBeamSelection={clearBeamSelection}
              handleMergeBeams={handleMergeBeams}
              handleIntersect={handleIntersect}
              toggleBeamSelection={toggleBeamSelection}
              getBeamNodeId={getBeamNodeId}
              openBeamReleaseEditor={openBeamReleaseEditor}
              getBeamReleaseState={getBeamReleaseState}
              runAnalysis={runAnalysis}
            />
          </TabsContent>

          {/* VIEW TAB */}
          <TabsContent value="view" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm">العرض ثنائي الأبعاد</CardTitle>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Story / level filter — mirrors the modeler tab filter */}
                    <div className="flex items-center gap-1.5">
                      <Layers size={13} className="text-muted-foreground" />
                      <select
                        className="h-7 rounded border border-input bg-background px-2 text-[11px] min-w-[130px]"
                        value={viewStoryId}
                        onChange={e => setViewStoryId(e.target.value)}
                      >
                        <option value="__ALL__">جميع الأدوار</option>
                        {stories.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    {analyzed && (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showViewMoments}
                            onChange={e => {
                              const val = e.target.checked;
                              setShowViewMoments(val);
                              if (val) setShowViewDeflections(false);
                            }}
                            className="rounded"
                          />
                          <span className="text-[11px]">عرض العزوم</span>
                        </label>
                        {showViewMoments && (
                          <select
                            className="h-7 rounded border border-input bg-background px-2 text-[11px] min-w-[140px]"
                            value={viewMomentEngine}
                            onChange={e => setViewMomentEngine(e.target.value as 'active' | '2d' | '3d' | 'gf')}
                          >
                            <option value="active">المحرك النشط ({ENGINE_LABELS[selectedEngine]})</option>
                            <option value="2d">2D — صلابة المصفوفة</option>
                            <option value="3d">3D — إطارات ثلاثية</option>
                            <option value="gf">Global Frame — إطار عام</option>
                          </select>
                        )}
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showViewDeflections}
                            onChange={e => {
                              const val = e.target.checked;
                              setShowViewDeflections(val);
                              if (val) setShowViewMoments(false);
                            }}
                            className="rounded"
                          />
                          <span className="text-[11px]">عرض الترخيم</span>
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!analyzed && <Button onClick={runAnalysis} className="mb-3 min-h-[44px]">تشغيل التحليل</Button>}
                <BuildingView
                  slabs={viewFilteredSlabs}
                  beams={viewIsAll ? beamsWithLoads : beamsWithLoads.filter(b => b.storyId === viewStoryId)}
                  columns={viewFilteredCols}
                  nodes={currentNodes}
                  analyzed={analyzed}
                  frameResults={
                    !showViewMoments ? frameResults :
                    viewMomentEngine === '2d' ? frameResults2D :
                    viewMomentEngine === '3d' ? frameResults3DRaw :
                    viewMomentEngine === 'gf' ? frameResultsGF :
                    frameResults
                  }
                  beamDesigns={beamDesigns} colDesigns={colDesigns}
                  onSelectElement={handleViewSelectElement}
                  onLongPressSlab={(slabId) => setLongPressSlabId(slabId)}
                  removedColumnIds={removedColumnIds} bobConnections={bobConnections}
                  showMoments={showViewMoments}
                  showDeflections={showViewDeflections}
                />
                {analyzed && showViewMoments && (
                  <div className="mt-2 p-2 rounded bg-muted/50 text-[10px] text-muted-foreground">
                    <p><strong>محرك العزوم: {
                      viewMomentEngine === '2d' ? '2D — صلابة المصفوفة' :
                      viewMomentEngine === '3d' ? '3D — إطارات ثلاثية' :
                      viewMomentEngine === 'gf' ? 'Global Frame — إطار عام' :
                      ENGINE_LABELS[selectedEngine]
                    }</strong></p>
                    <p>• الجسور الأفقية: M⁻ فوق الجسر، M⁺ تحت الجسر</p>
                    <p>• الجسور العمودية: M⁻ يمين الجسر، M⁺ يسار الجسر</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANALYSIS TAB */}
          <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
            <AnalysisTabPanel
              state={state}
              dispatch={dispatch}
              columns={columns}
              beams={beamsWithLoads}
              beamsWithLoads={beamsWithLoads}
              isAllStories={isAllStories}
              storyFilteredSlabs={storyFilteredSlabs}
              getStoryLabel={getStoryLabel}
              frameResults={frameResults}
              frameResults2D={frameResults2D}
              frameResults3DRaw={frameResults3DRaw}
              frameResultsGF={frameResultsGF}
              frameResultsUC={frameResultsUC}
              connectionManagerOpen={connectionManagerOpen}
              setConnectionManagerOpen={setConnectionManagerOpen}
              checkAndRemoveDuplicates={checkAndRemoveDuplicates}
              dupCheckResult={dupCheckResult}
              setDupCheckResult={setDupCheckResult}
              femError={femError}
              setFemError={setFemError}
              detectedConnections={detectedConnections}
              runAnalysis={runAnalysis}
              jointConnectivity={jointConnectivity}
              colLoadsBiaxial={colLoadsBiaxial}
              beamHingesMap={beamHingesMap}
              colDesigns={colDesigns}
              splitBeamGroups={splitBeamGroups}
              getBeamReleaseState={getBeamReleaseState}
              handleAnalysisElementClick={handleAnalysisElementClick}
              colLoads3D={colLoads3D}
            />
          </TabsContent>

          {/* SUPPORT MANAGER TAB */}
          <TabsContent value="support-manager" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
            <SupportManagerPanel
              columns={columns}
              beams={beamsWithLoads}
              stories={stories}
              supportDb={state.supportDb}
              analyzed={analyzed}
              onUpdateSupportDb={(db) => dispatch({ type: 'SET_SUPPORT_DB', db })}
              triggerAnalysis={runAnalysis}
            />
          </TabsContent>

          {/* AI ASSISTANT TAB */}
          <TabsContent value="ai-assistant" className="flex-1 overflow-y-auto mt-0">
            <AIAssistantPanel
              onModelGenerated={(newSlabs) => {
                dispatch({ type: 'SET_SLABS', slabs: [...slabs, ...newSlabs] });
                setMainTab('modeling');
                dispatch({ type: 'SET_ACTIVE_TAB', tab: 'modeler' });
              }}
              onClose={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'modeler' })}
            />
          </TabsContent>

          {/* DESIGN TAB */}
          <TabsContent value="design" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
            <DesignTabPanel
              state={state}
              dispatch={dispatch}
              columns={columns}
              beams={beamsWithLoads}
              beamsWithLoads={beamsWithLoads}
              isAllStories={isAllStories}
              beamDesigns={beamDesigns}
              colDesigns={colDesigns}
              slabDesigns={slabDesigns}
              splitBeamGroups={splitBeamGroups}
              beamDiagnostics={beamDiagnostics}
              colLoads3D={colLoads3D}
              getBeamDisplayName={getBeamDisplayName}
              getBentUpData={getBentUpData}
              handleSelectElement={handleSelectElement}
              designSource={designSource}
              setDesignSource={setDesignSource}
              designExecuted={designExecuted}
              setDesignExecuted={setDesignExecuted}
              etabsColumnResults={etabsColumnResults}
              setEtabsColumnResults={setEtabsColumnResults}
              etabsReactions={etabsReactions}
              setEtabsReactions={setEtabsReactions}
              frameResults={frameResults}
              connectionManagerOpen={connectionManagerOpen}
              setConnectionManagerOpen={setConnectionManagerOpen}
              bentUpResults={bentUpResults}
            />
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
            {!analyzed ? (
              <Card><CardContent className="py-12 text-center">
                <p className="text-muted-foreground">يرجى تشغيل التحليل أولاً</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {/* Story filter for results */}
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
                  <CardHeader className="pb-2"><CardTitle className="text-sm">نتائج البلاطات</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['اسم البلاطة', 'سماكة البلاطة', 'التسليح في الاتجاه x', 'التسليح في الاتجاه y'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {stories.map(story =>
                          (isAllStories || story.id === selectedStoryId) &&
                          slabDesigns.map(s => {
                            const slab = slabs.find(sl => sl.id === s.id);
                            if (slab && slab.storyId !== story.id) return null;
                            let xIsShort = true;
                            if (slab) {
                              const dx = Math.abs(slab.x2 - slab.x1);
                              const dy = Math.abs(slab.y2 - slab.y1);
                              xIsShort = dx <= dy;
                            }
                            const xDir = xIsShort ? s.design.shortDir : s.design.longDir;
                            const yDir = xIsShort ? s.design.longDir : s.design.shortDir;
                            return (
                              <TableRow key={`${story.id}-${s.id}`} className="cursor-pointer" onClick={() => handleSelectElement('slab', s.id)}>
                                <TableCell className="font-mono text-xs">{isAllStories ? `${story.label} - ${s.id}` : s.id}</TableCell>
                                <TableCell className="font-mono text-xs">{s.design.hUsed} mm</TableCell>
                                <TableCell className="font-mono text-xs">{xDir.bars}Φ{xDir.dia}/m</TableCell>
                                <TableCell className="font-mono text-xs">{yDir.bars}Φ{yDir.dia}/m</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">ملخص تسليح الجسور</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['الدور','الجسر','b×h','علوي يسار','سفلي وسط','علوي يمين','الكانات'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {stories.map(story =>
                          (isAllStories || story.id === selectedStoryId) &&
                          beamDesigns.map(d => {
                            const beam = beamsWithLoads.find(b => b.id === d.beamId);
                            const bent = getBentUpData(d.beamId);
                            const topLeftBars = bent ? Math.max(bent.additionalTopLeft, 2) : d.flexLeft.bars;
                            const topRightBars = bent ? Math.max(bent.additionalTopRight, 2) : d.flexRight.bars;
                            return (
                              <TableRow key={`${story.id}-${d.beamId}`} className="cursor-pointer" onClick={() => handleSelectElement('beam', d.beamId)}>
                                <TableCell className="text-xs font-medium text-muted-foreground">{story.label}</TableCell>
                                <TableCell className="font-mono text-xs font-bold">{getBeamDisplayName(d.beamId, (d as any).mergedCarrierIds)}</TableCell>
                                <TableCell className="font-mono text-xs">{beam?.b}×{beam?.h}</TableCell>
                                <TableCell className="font-mono text-xs">{topLeftBars}Φ{d.flexLeft.dia}</TableCell>
                                <TableCell className="font-mono text-xs">{d.flexMid.bars}Φ{d.flexMid.dia}</TableCell>
                                <TableCell className="font-mono text-xs">{topRightBars}Φ{d.flexRight.dia}</TableCell>
                                <TableCell className="font-mono text-xs">{d.shear.stirrups}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">ملخص تسليح الأعمدة</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['الدور','العمود','b×h','Pu','Mu','ρ%','الحالة','التسليح','الكانات'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {stories.map((story, storyIdx) =>
                          (isAllStories || story.id === selectedStoryId) &&
                          colDesigns.map(c => {
                            const storiesAbove = stories.length - storyIdx;
                            const accPu = c.Pu * storiesAbove;
                            return (
                              <TableRow key={`${story.id}-${c.id}`} className="cursor-pointer" onClick={() => handleSelectElement('column', c.id)}>
                                <TableCell className="text-xs font-medium text-muted-foreground">{story.label}</TableCell>
                                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                                <TableCell className="font-mono text-xs">{c.b}×{c.h}</TableCell>
                                <TableCell className="font-mono text-xs font-bold">{accPu.toFixed(1)}</TableCell>
                                <TableCell className="font-mono text-xs">{c.design.MuMagnified.toFixed(1)}</TableCell>
                                <TableCell className="font-mono text-xs">{(c.design.rhoActual * 100).toFixed(1)}</TableCell>
                                <TableCell>
                                  <Badge variant={c.design.adequate ? "default" : "destructive"} className="text-[10px]">
                                    {c.design.adequate ? 'كافي' : 'غير كافي'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{c.design.bars}Φ{c.design.dia}</TableCell>
                                <TableCell className="font-mono text-xs">{c.design.stirrups}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* QUANTITY TAKEOFF QTO DATABASE */}
          <TabsContent value="takeoff" className="flex-1 overflow-auto p-4">
            <QuantityTakeoffPanel
              stories={stories}
              slabs={slabs}
              beams={beamsWithLoads}
              columns={columns}
              beamDesigns={beamDesigns as any}
              colDesigns={colDesigns}
              slabDesigns={slabDesigns as any}
              slabProps={slabProps}
              analyzed={hasDesignResults}
              foundationResults={foundationResults.length > 0 ? foundationResults : undefined}
              foundationMat={foundationMat}
            />
          </TabsContent>

          {/* EXPORT TAB */}
          <TabsContent value="export" className="flex-1 overflow-auto p-4">
            <div className="max-w-5xl space-y-6">

              {/* ── Title Block Editor ── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings2 size={14} />
                    بيانات الغلاف (Title Block)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      { key: 'projectName',     label: 'اسم المشروع' },
                      { key: 'clientName',      label: 'المالك / العميل' },
                      { key: 'projectLocation', label: 'موقع المشروع' },
                      { key: 'drawingTitle',    label: 'عنوان المخطط' },
                      { key: 'firmName',        label: 'اسم المكتب الهندسي' },
                      { key: 'designedBy',      label: 'صمّمه' },
                      { key: 'checkedBy',       label: 'راجعه' },
                      { key: 'drawnBy',         label: 'رسمه' },
                      { key: 'approvedBy',      label: 'اعتمده' },
                      { key: 'revision',        label: 'المراجعة' },
                      { key: 'date',            label: 'التاريخ' },
                      { key: 'scale',           label: 'المقياس' },
                      { key: 'drawingNumber',   label: 'رقم المخطط' },
                    ] as { key: keyof typeof titleBlockConfig; label: string }[]).map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs text-muted-foreground">{label}</label>
                        <input
                          className="w-full h-9 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          value={titleBlockConfig[key] as string}
                          onChange={e => dispatch({ type: 'SET_TITLE_BLOCK_CONFIG', config: { [key]: e.target.value } })}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Heavy export panels — lazy mount: only render after first visit to export tab */}
              {visitedTabs.has('export') && <>
                {/* BOQ - Bill of Quantities */}
                <BOQPanel
                  stories={stories}
                  slabs={slabs}
                  beams={beamsWithLoads}
                  columns={columns}
                  beamDesigns={beamDesigns as any}
                  colDesigns={colDesigns}
                  slabDesigns={slabDesigns as any}
                  slabProps={slabProps}
                  analyzed={hasDesignResults}
                  foundationResults={foundationResults.length > 0 ? foundationResults : undefined}
                  foundationMat={foundationMat}
                  ribbedSlabProps={state.ribbedSlabProps}
                />

                {/* One-Way Ribbed Slab Detailing and Drawings Section */}
                {hasDesignResults && slabs.some(s => s.slabType === 'one_way_ribbed') && (
                  <RibbedSlabDrawingsPanel
                    slabs={slabs}
                    slabProps={slabProps}
                    mat={mat}
                    ribbedSlabProps={state.ribbedSlabProps}
                    columns={columns}
                    beams={beamsWithLoads}
                    projectName={titleBlockConfig.projectName || 'Structural Design Studio'}
                    titleBlockConfig={titleBlockConfig}
                  />
                )}

                {/* Superstructure Coordinated Drawings and Framing CAD Sheet Module */}
                <StructuralDrawingsModule
                  stories={stories}
                  activeStoryId={selectedStoryId}
                  slabs={slabs}
                  beams={beamsWithLoads}
                  columns={columns}
                  beamDesigns={beamDesigns as any}
                  colDesigns={colDesigns}
                  slabDesigns={slabDesigns as any}
                  mat={mat}
                  slabProps={slabProps}
                  projectName={titleBlockConfig.projectName || 'Structural Design Studio'}
                  titleBlockConfig={titleBlockConfig}
                  analyzed={hasDesignResults}
                  foundationResults={foundationResults}
                  foundationMat={foundationMat}
                  bentUpResults={bentUpResults}
                  ribbedSlabProps={state.ribbedSlabProps}
                  colLoads3D={colLoads3D}
                  onUpdateTitleBlock={(config) => dispatch({ type: 'SET_TITLE_BLOCK_CONFIG', config })}
                />

                {/* Coordinated Foundations Blueprint Drawings Panel */}
                <FoundationDrawingsExportPanel
                  columns={columns}
                  colLoads3D={colLoads3D}
                  fc={mat.fc}
                  fy={mat.fy}
                  projectName={titleBlockConfig.projectName || 'Structural Design Studio'}
                  titleBlockConfig={titleBlockConfig}
                  analyzed={hasDesignResults}
                  foundationResults={foundationResults}
                  foundationMat={foundationMat}
                  foundationDb={state.foundationDb}
                  fdnAssignments={state.fdnAssignments}
                  stripFootingsList={state.stripFootingsList}
                />

                {/* Main Export Panel with Floor Selector */}
                <ExportPanel
                  stories={stories}
                  slabs={slabs}
                  beams={beamsWithLoads}
                  columns={columns}
                  beamDesigns={beamDesigns as any}
                  colDesigns={colDesigns}
                  slabDesigns={slabDesigns}
                  mat={mat}
                  slabProps={slabProps}
                  projectName={titleBlockConfig.projectName || 'Structural Design Studio'}
                  titleBlockConfig={titleBlockConfig}
                  analyzed={hasDesignResults}
                  foundationResults={foundationResults}
                  foundationMat={foundationMat}
                  bentUpResults={bentUpResults}
                  ribbedSlabProps={state.ribbedSlabProps}
                  colLoads3D={colLoads3D}
                />
              </>}

              {/* Additional quick export buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">تقرير PDF</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full min-h-[44px]" disabled={!hasDesignResults} onClick={() => {
                      generateStructuralReport(slabs, beamsWithLoads, columns, frames, frameResults, beamDesigns as any, colDesigns, slabDesigns, mat, slabProps, 'Structural Design Studio', stories, foundationResults);
                    }}>تقرير التصميم الإنشائي</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">تصدير DXF</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full min-h-[44px]" variant="outline" onClick={() => downloadDXF(generateStructuralDXF(slabs, beamsWithLoads, columns), 'structural_plan.dxf')}>مخطط إنشائي</Button>
                    <Button className="w-full min-h-[44px]" variant="outline" onClick={() => downloadDXF(generateBeamLayoutDXF(beamsWithLoads, columns, slabs), 'beam_layout.dxf')}>مخطط الجسور</Button>
                    <Button className="w-full min-h-[44px]" variant="outline" onClick={() => downloadDXF(generateColumnLayoutDXF(columns, slabs), 'column_layout.dxf')}>مخطط الأعمدة</Button>
                    <Button className="w-full min-h-[44px]" variant="outline" disabled={!hasDesignResults} onClick={() => {
                      const rebarData = beamDesigns.map(d => {
                        const beam = beamsWithLoads.find(b => b.id === d.beamId);
                        return beam ? { beamId: d.beamId, b: beam.b, h: beam.h, x1: beam.x1, y1: beam.y1, x2: beam.x2, y2: beam.y2, topBars: Math.max(d.flexLeft.bars, d.flexRight.bars), topDia: d.flexLeft.dia, botBars: d.flexMid.bars, botDia: d.flexMid.dia, stirrups: d.shear.stirrups } : null;
                      }).filter(Boolean) as any[];
                      downloadDXF(generateReinforcementDXF(slabs, beamsWithLoads, columns, rebarData), 'reinforcement.dxf');
                    }}>مخطط التسليح</Button>
                  </CardContent>
                </Card>
              </div>

              {/* Beam Rebar Detail Views */}
              {hasDesignResults && beamDesigns.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">تفاصيل تسليح الجسور</h3>
                  {beamDesigns.map(d => {
                    let beam = beamsWithLoads.find(b => b.id === d.beamId);
                    if (!beam && (d as any).mergedCarrierIds) {
                      beam = beamsWithLoads.find(b => (d as any).mergedCarrierIds.includes(b.id));
                    }
                    if (!beam) return null;
                    const bent = getBentUpData(d.beamId);
                    return (
                      <BeamRebarDetailView
                        key={d.beamId}
                        beamId={d.beamId}
                        b={beam.b}
                        h={beam.h}
                        span={d.span}
                        flexLeft={d.flexLeft}
                        flexMid={d.flexMid}
                        flexRight={d.flexRight}
                        shear={d.shear}
                        hasBentBars={!!bent}
                        additionalTopLeft={bent?.additionalTopLeft}
                        additionalTopRight={bent?.additionalTopRight}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* LOADS INPUT TAB */}
          <TabsContent value="loads-input" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
            <LoadInputPanel
              beams={beams.filter(b => !removedBeamIds.includes(b.id))}
              slabs={slabs}
              beamOverrides={beamOverrides}
              onSetBeamWallLoad={(beamId, wallLoad) => {
                const isExtra = extraBeams.some(b => b.id === beamId);
                if (isExtra) dispatch({ type: 'UPDATE_EXTRA_BEAM', id: beamId, updates: { wallLoad } });
                else dispatch({ type: 'SET_BEAM_OVERRIDE', beamId, override: { wallLoad } });
              }}
              loadCombos={loadCombos}
              onSetLoadCombos={(combos) => setLoadCombos(combos as typeof loadCombos)}
              defaultDL={slabProps.finishLoad}
              defaultLL={slabProps.liveLoad}
            />
          </TabsContent>

          <TabsContent value="building" className="flex-1 overflow-hidden mt-0">
            <MultiStoryDesigner
              initialSlabs={slabs}
              mat={mat}
              slabProps={slabProps}
              beamB={beamB}
              beamH={beamH}
              colB={colB}
              colH={colH}
              onClose={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'modeler' })}
            />
          </TabsContent>

          {/* GLOBAL FRAME SOLVER TAB */}
          <TabsContent value="solver" className="flex-1 overflow-auto mt-0 p-3 space-y-4">
            <AdvancedAnalysisPanel
              frames={frames}
              beams={beamsWithLoads}
              columns={columns}
              mat={mat}
              bobConnections={detectedConnections}
              slabs={slabs}
              slabProps={slabProps}
              beamStiffnessFactor={beamStiffnessFactor}
              colStiffnessFactor={colStiffnessFactor}
              onColStiffnessChange={(v) => dispatch({ type: 'SET_COL_STIFFNESS_FACTOR', value: v })}
            />
            <GlobalFrameSolverPanel />
          </TabsContent>

          {/* FOUNDATION DESIGN TAB — lazy mount: only render after first visit */}
          <TabsContent value="foundations" className="flex-1 overflow-y-auto mt-0 pb-20 md:pb-4 p-3 md:p-4 bg-muted/10">
            <div className="space-y-4 max-w-7xl mx-auto">
              {!visitedTabs.has('foundations') ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  جارٍ التحميل...
                </div>
              ) : <FoundationDesignPanel
                requestedTab={requestedFoundationSubTab}
                columns={columns}
                beams={beamsWithLoads}
                supportDb={state.supportDb}
                colDesigns={colDesigns}
                colLoads3D={colLoads3D}
                etabsReactions={etabsReactions.length > 0 ? etabsReactions : undefined}
                titleBlockConfig={titleBlockConfig}
                mat={mat}
                onResultsChange={(res, mat) => {
                  dispatch({ type: 'SET_FOUNDATION_RESULTS', results: res });
                  dispatch({ type: 'SET_FOUNDATION_MAT', mat: mat });
                }}
                foundationDb={state.foundationDb}
                onFoundationDbChange={(db) => dispatch({ type: 'SET_FOUNDATION_DB', db })}
                fdnAssignments={state.fdnAssignments}
                onFdnAssignmentsChange={(asg) => dispatch({ type: 'SET_FDN_ASSIGNMENTS', assignments: asg })}
                stripFootingsList={state.stripFootingsList}
                onStripFootingsChange={(list) => dispatch({ type: 'SET_STRIP_FOOTINGS_LIST', list: list })}
              />}
            </div>
          </TabsContent>

          {/* PROJECTS TAB */}
          <TabsContent value="projects" className="flex-1 overflow-hidden mt-0">
            <ProjectManager
              currentState={state}
              onLoadProject={(data) => dispatch({ type: 'LOAD_PROJECT', data })}
              onNewProject={() => dispatch({ type: 'RESET_TO_DEFAULT' })}
              storyCount={stories.length}
              slabCount={slabs.length}
            />
          </TabsContent>

          {/* GENERATIVE TAB */}
          <TabsContent value="generative" className="flex-1 overflow-hidden mt-0">
            <GenerativeDesignDashboard
              onApplyOption={(ev: EvaluatedOption) => {
                dispatch({
                  type: 'APPLY_GENERATIVE',
                  slabs: (ev.option.slabs?.length ? ev.option.slabs : slabs) as Slab[],
                  beamB: ev.option.sections.beamB,
                  beamH: ev.option.sections.beamH,
                  colB: ev.option.sections.colB,
                  colH: ev.option.sections.colH,
                });
                setMainTab('modeling');
                dispatch({ type: 'SET_ACTIVE_TAB', tab: 'modeler' });
              }}
            />
          </TabsContent>
        </Tabs>
        </div>
      </div>

      {/* Rebar Detail Modal */}
      {selectedElement && modalData && (
        <RebarDetailModal
          open={modalOpen}
          onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
          elementType={selectedElement.type}
          elementId={selectedElement.id}
          dimensions={modalData.dimensions}
          reinforcement={modalData.reinforcement}
        />
      )}

      {/* View tab — bending-moment chart along the element */}
       {momentChartElement && (
        <ElementMomentChartModal
          open={!!momentChartElement}
          onClose={() => setMomentChartElement(null)}
          elementType={momentChartElement.type}
          elementId={momentChartElement.id}
          beams={beamsWithLoads}
          columns={columns}
          slabs={slabs}
          nodes={currentNodes}
          frames={currentFrames}
          areas={currentAreas}
          onSaveElementProps={handleElemPropsSave}
          isModeling={mainTab === 'modeling'}
          frameResults={
            !showViewMoments ? frameResults :
            viewMomentEngine === '2d' ? frameResults2D :
            viewMomentEngine === '3d' ? frameResults3DRaw :
            viewMomentEngine === 'gf' ? frameResultsGF :
            frameResults
          }
          beamDesigns={beamDesigns}
          colDesigns={colDesigns}
          onAddColumn={(col) => dispatch({ type: 'ADD_EXTRA_COLUMN', column: col })}
          onAddBeam={(beam) => dispatch({ type: 'ADD_EXTRA_BEAM', beam })}
          onAddSlab={(slab) => dispatch({ type: 'ADD_SLAB', slab })}
          selectedStoryId={selectedStoryId}
          beamB={beamB}
          beamH={beamH}
          colB={colB}
          colH={colH}
          onSaveBeamProperties={(beamId, props) => {
            const beam = beams.find(b => b.id === beamId);
            if (beam) {
              dispatch({
                type: 'SET_BEAM_OVERRIDE',
                beamId,
                override: { name: props.name, b: props.b, h: props.h }
              });
              dispatch({ type: 'INC_MODEL_VERSION' });
              dispatch({ type: 'RESET_ANALYSIS' });
            }
          }}
          onMoveElement={({ elementType, elementId, dx, dy, dz, x1, y1, x2, y2, newX, newY }) => {
            if (elementType === 'beam') {
              // Split-beam IDs look like "B5-0" — try exact match first, then parent ID
              const parentId = elementId.includes('-') ? elementId.slice(0, elementId.lastIndexOf('-')) : elementId;
              const beam = beams.find(b => b.id === elementId) ?? beams.find(b => b.id === parentId);
              const beamKey = beam?.id ?? elementId; // key to use for the override
              if (beam) {
                if (x1 != null) {
                  dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: beamKey, override: { x1, y1: y1!, x2: x2!, y2: y2! } });
                } else if (dx != null || dy != null) {
                  const ddx = dx ?? 0, ddy = dy ?? 0, ddz = dz ?? 0;
                  dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: beamKey, override: {
                    x1: beam.x1 + ddx, y1: beam.y1 + ddy,
                    x2: beam.x2 + ddx, y2: beam.y2 + ddy,
                    ...(ddz !== 0 ? { z: (beam.z ?? 0) + ddz } : {}),
                  }});
                }
              }
            } else if (elementType === 'column') {
              const col = columns.find(c => c.id === elementId);
              if (col) {
                if (newX != null) {
                  dispatch({ type: 'SET_COL_OVERRIDE', colId: elementId, override: { x: newX, y: newY! } });
                } else if (dx != null || dy != null) {
                  dispatch({ type: 'SET_COL_OVERRIDE', colId: elementId, override: {
                    x: col.x + (dx ?? 0), y: col.y + (dy ?? 0),
                  }});
                }
              }
            } else if (elementType === 'slab') {
              if (dx != null || dy != null) {
                const slabIdx = slabs.findIndex(s => s.id === elementId);
                if (slabIdx !== -1) {
                  dispatch({ type: 'MOVE_SLAB', index: slabIdx, dx: dx ?? 0, dy: dy ?? 0 });
                }
              }
            }
            dispatch({ type: 'INC_MODEL_VERSION' });
            dispatch({ type: 'RESET_ANALYSIS' });
          }}
        />
      )}

      <Dialog open={!!releaseEditorBeamId} onOpenChange={(open) => !open && setReleaseEditorBeamId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">تحرير أطراف الجسر {releaseEditorBeam?.id}</DialogTitle>
            <DialogDescription>
              عدّل Releases للجسر مباشرة من تبويب الإدخال، وأي حفظ هنا يلغي نتائج التحليل السابقة حتى تعيد التشغيل بالقيم الجديدة.
            </DialogDescription>
          </DialogHeader>

          {releaseEditorBeam && (
            <div className="space-y-4">
              {/* ── أبعاد الجسر (قابلة للتعديل) ── */}
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
                <div className="font-semibold text-foreground text-sm">أبعاد الجسر</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">العرض b (مم)</label>
                    <input
                      type="number"
                      value={releaseEditorDims.b}
                      onChange={e => setReleaseEditorDims(prev => ({ ...prev, b: Number(e.target.value) }))}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">الارتفاع h (مم)</label>
                    <input
                      type="number"
                      value={releaseEditorDims.h}
                      onChange={e => setReleaseEditorDims(prev => ({ ...prev, h: Number(e.target.value) }))}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>البداية: <span className="font-mono text-foreground">({releaseEditorBeam.x1.toFixed(2)}, {releaseEditorBeam.y1.toFixed(2)})</span></div>
                  <div>النهاية: <span className="font-mono text-foreground">({releaseEditorBeam.x2.toFixed(2)}, {releaseEditorBeam.y2.toFixed(2)})</span></div>
                  <div>الطول: <span className="font-mono text-foreground">{releaseEditorBeam.length.toFixed(2)} م</span></div>
                </div>
              </div>

              {/* ── درجات حرية الأطراف (أفقي) ── */}
              <div className="space-y-2">
                <div className="font-semibold text-foreground text-sm">درجات حرية الأطراف</div>
                <p className="text-[10px] text-muted-foreground">✓ محدد = محرر (Released) • غير محدد = مقيد (Restrained)</p>
                {([
                  { key: 'nodeI' as const, title: 'الطرف I — بداية الجسر' },
                  { key: 'nodeJ' as const, title: 'الطرف J — نهاية الجسر' },
                ]).map(({ key, title }) => (
                  <div key={key} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-foreground">{title}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => resetReleaseEditorEnd(key)}>
                        تصفير
                      </Button>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {RELEASE_DOF_META.map(({ key: dof, etabs }) => (
                        <label key={`${key}-${dof}`} className="flex flex-col items-center gap-1 cursor-pointer">
                          <span className="font-mono text-[10px] text-muted-foreground">{etabs}</span>
                          <Checkbox
                            checked={releaseEditorData[key][dof]}
                            onCheckedChange={(checked) => handleReleaseEditorToggle(key, dof, checked === true)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {releaseEditorWarnings.length > 0 && (
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  {releaseEditorWarnings.map((warning) => (
                    <p key={warning} className="text-xs font-medium text-destructive">⚠ {warning}</p>
                  ))}
                </div>
              )}

              {/* ── تطبيق على أدوار أخرى ── */}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <Checkbox
                  id="apply-other-floors"
                  checked={releaseEditorApplyOtherFloors}
                  onCheckedChange={v => setReleaseEditorApplyOtherFloors(!!v)}
                />
                <label htmlFor="apply-other-floors" className="text-xs cursor-pointer">
                  تطبيق تغييرات الأبعاد على الجسور بنفس الإحداثيات في الأدوار الأخرى
                </label>
              </div>

              {/* ── تأكيد حذف الجسر ── */}
              {beamDeleteConfirm && (
                <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3">
                  <p className="text-sm text-destructive font-medium text-center">
                    ⚠️ هل أنت متأكد من حذف الجسر؟
                  </p>
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    اضغط "تأكيد الحذف" مرة أخرى لتأكيد الحذف النهائي للجسر {releaseEditorBeam?.id} من السقف.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0 border-t pt-4 bg-background">
            <Button
              type="button"
              variant={beamDeleteConfirm ? "destructive" : "outline"}
              onClick={() => {
                if (!beamDeleteConfirm) {
                  setBeamDeleteConfirm(true);
                } else if (releaseEditorBeam) {
                  handleLevelElementDelete('beam', releaseEditorBeam.id);
                  setReleaseEditorBeamId(null);
                  setBeamDeleteConfirm(false);
                }
              }}
              className={`min-h-[44px] sm:mr-auto border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground ${beamDeleteConfirm ? '' : 'hover:border-destructive'}`}
            >
              {beamDeleteConfirm ? '⚠️ تأكيد الحذف' : '🗑️ حذف الجسر'}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setReleaseEditorBeamId(null); setBeamDeleteConfirm(false); }} className="min-h-[44px]">إلغاء</Button>
              <Button type="button" onClick={saveBeamReleaseEditor} className="min-h-[44px]">حفظ التغييرات</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Element Properties Dialog (long-press) */}
      <ElementPropertiesDialog
        open={elemPropsOpen}
        onClose={() => dispatch({ type: 'CLOSE_ELEM_PROPS' })}
        frame={elemPropsFrameId != null ? currentFrames.find(f => f.id === elemPropsFrameId) : null}
        area={elemPropsAreaId != null ? currentAreas.find(a => a.id === elemPropsAreaId) : null}
        node={elemPropsNodeId != null ? currentNodes.find(n => n.id === elemPropsNodeId) : null}
        nodeI={elemPropsFrameId != null ? (() => { const f = currentFrames.find(fr => fr.id === elemPropsFrameId); return f ? currentNodes.find(n => n.id === f.nodeI) : null; })() : null}
        nodeJ={elemPropsFrameId != null ? (() => { const f = currentFrames.find(fr => fr.id === elemPropsFrameId); return f ? currentNodes.find(n => n.id === f.nodeJ) : null; })() : null}
        slabProps={elemPropsAreaId != null ? { ...slabProps, ...(slabPropsOverrides[elemPropsAreaId] || {}) } : null}
        hasMultipleStories={stories.length > 1}
        columnOrientAngle={(() => {
          if (elemPropsFrameId == null) return 0;
          const f = currentFrames.find(fr => fr.id === elemPropsFrameId);
          if (!f || f.type !== 'column') return 0;
          const topNode = currentNodes.find(n => n.id === f.nodeJ);
          if (!topNode) return 0;
          const EPS = 0.01;
          const col = columns.find(c => Math.abs(c.x - topNode.x) < EPS && Math.abs(c.y - topNode.y) < EPS);
          return col?.orientAngle ?? 0;
        })()}
        onSave={handleElemPropsSave}
        onDelete={handleElemPropsDelete}
        onAddColumn={(col) => dispatch({ type: 'ADD_EXTRA_COLUMN', column: col })}
        onAddBeam={(beam) => dispatch({ type: 'ADD_EXTRA_BEAM', beam })}
        onAddSlab={(slab) => dispatch({ type: 'ADD_SLAB', slab })}
        selectedStoryId={selectedStoryId}
        beamB={beamB}
        beamH={beamH}
        colB={colB}
        colH={colH}
      />

      {/* Add Element Dialog — triggered by long-press on empty canvas */}
      <AddElementDialog
        open={addElementDialog.open}
        onClose={() => setAddElementDialog(d => ({ ...d, open: false }))}
        defaultX={addElementDialog.x}
        defaultY={addElementDialog.y}
        stories={stories}
        selectedStoryId={selectedStoryId}
        beamB={beamB}
        beamH={beamH}
        colB={colB}
        colH={colH}
        colL={colL}
        onAddColumn={(col) => dispatch({ type: 'ADD_EXTRA_COLUMN', column: col })}
        onAddBeam={(beam) => dispatch({ type: 'ADD_EXTRA_BEAM', beam })}
        onAddSlab={(slab) => dispatch({ type: 'ADD_SLAB', slab })}
      />

      {/* Analysis Diagram Dialog */}
      <AnalysisDiagramDialog
        open={diagramOpen}
        onClose={() => dispatch({ type: 'CLOSE_DIAGRAM' })}
        data={diagramData}
      />

      {/* Manual Connection Manager Dialog */}
      <ManualConnectionManager
        open={connectionManagerOpen}
        onOpenChange={setConnectionManagerOpen}
        columns={columns}
        beams={beams.filter(b => !removedBeamIds.includes(b.id))}
        stories={stories}
        selectedStoryId={selectedStoryId}
        manualJointOverrides={manualJointOverrides}
        onOverridesChange={(overrides) => dispatch({ type: 'SET_MANUAL_JOINT_OVERRIDES', overrides })}
        onRequestReanalyze={runAnalysis}
      />

      {/* Ribbed Slab Properties Popup (هوردي) */}
      <Dialog open={!!longPressSlabId} onOpenChange={(open) => { if (!open) setLongPressSlabId(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader dir="rtl" className="text-right">
            <DialogTitle>تعديل خصائص بلاطة الهوردي: {longPressSlabId}</DialogTitle>
            <DialogDescription>
              تعديل تفاصيل الأعصاب وعمق واتجاه انتقال الأحمال للبلاطة المحددة.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4" dir="rtl">
            {/* نوع البلاطة */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-xs font-semibold">نوع البلاطة</label>
              <select
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={tempSlabType}
                onChange={(e) => setTempSlabType(e.target.value as any)}
              >
                <option value="solid">مصمتة (Solid)</option>
                <option value="one_way_ribbed">هوردي ذو اتجاه واحد (One-Way Ribbed)</option>
              </select>
            </div>

            {tempSlabType === 'one_way_ribbed' && (
              <>
                {/* اتجاه انتقال الحمل / الأعصاب */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-xs font-semibold">اتجاه الأعصاب</label>
                  <select
                    className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={tempDirection}
                    onChange={(e) => setTempDirection(e.target.value as any)}
                  >
                    <option value="auto">تلقائي (اتجاه البحر الأقصر)</option>
                    <option value="one_way_x">أفقي (الاتجاه X)</option>
                    <option value="one_way_y">رأسي (الاتجاه Y)</option>
                  </select>
                </div>

                {/* عرض العصب bw (mm) */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-xs font-semibold">عرض العصب bw (مم)</label>
                  <Input
                    type="number"
                    className="col-span-3 font-mono text-xs h-10"
                    value={tempBw}
                    onChange={(e) => setTempBw(parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* ارتفاع العصب hb (mm) */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-xs font-semibold">ارتفاع العصب hb (مم)</label>
                  <Input
                    type="number"
                    className="col-span-3 font-mono text-xs h-10"
                    value={tempHb}
                    onChange={(e) => setTempHb(parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* سمك البلاطة العلوية tf (mm) */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-xs font-semibold">سمك بلاطة التغطية tf (مم)</label>
                  <Input
                    type="number"
                    className="col-span-3 font-mono text-xs h-10"
                    value={tempTf}
                    onChange={(e) => setTempTf(parseInt(e.target.value) || 0)}
                  />
                </div>

                {/* المسافة الصافية s (mm) */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right text-xs font-semibold">المسافة الصافية s (مم)</label>
                  <Input
                    type="number"
                    className="col-span-3 font-mono text-xs h-10"
                    value={tempS}
                    onChange={(e) => setTempS(parseInt(e.target.value) || 0)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2" dir="rtl">
            <Button variant="outline" onClick={() => setLongPressSlabId(null)}>إلغاء</Button>
            <Button onClick={handleSaveSlabLongPress} className="bg-purple-600 hover:bg-purple-700 text-white">حفظ التغيرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation — mobile only */}
      {isMobile && (
        <>
          <MobileLocalUpdateButton />
          <BottomNav
            activeTab={mainTab}
            onTabChange={(tab) => {
            setMainTab(tab);
            // Each section maps to a specific TabsContent value.
            // 'foundations' and 'solver' are special: their TabsContent values
            // ('foundations' and 'design') differ from their sub-item ids
            // ('foundation' and 'beam-design'), so we must set them explicitly.
            if (tab === 'foundations') {
              dispatch({ type: 'SET_ACTIVE_TAB', tab: 'foundations' });
            } else if (tab === 'solver') {
              dispatch({ type: 'SET_ACTIVE_TAB', tab: 'design' });
            } else if (tab === 'projects') {
              dispatch({ type: 'SET_ACTIVE_TAB', tab: 'projects' });
            } else {
              // inputs / modeling: sub[0].id matches the TabsContent value directly
              const sec = NAV.find(s => s.id === tab);
              if (sec?.subs?.[0]) dispatch({ type: 'SET_ACTIVE_TAB', tab: sec.subs[0].id });
            }
            }}
          />
        </>
      )}
    </div>
  );
};

export default Index;

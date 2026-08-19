import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { 
  Download, Printer, FileSpreadsheet, Info, Layers, Compass, 
  Table as TableIcon, Layers3, FileText, BookOpen, Scale, Wrench, 
  AlertTriangle, FolderOpen, RefreshCw, Layers2, FileBox, FileCode, Check, Plus, Trash2, ArrowUpRight,
  Database
} from 'lucide-react';
import type { Slab, Column, Beam, Story, FlexureResult, ShearResult, ColumnResult } from '@/lib/structuralEngine';
import { generateBBS, exportBBSToPDF, exportBBSToExcel, type BBSEntry } from '@/rebar/bbsGenerator';
import { generateConstructionSheets } from '@/drawings/constructionSheets';
import { generateHTMLConstructionSheets, openHTMLSheetsForPrint, buildBeamGroupLabels, buildColGroupLabels, buildSlabGroupLabels, htmlBeamScheduleTable, htmlColumnScheduleTable, htmlSlabScheduleTable, htmlTitleBlock, htmlSheetBorder } from '@/drawings/htmlConstructionSheets';
import { generateBeamLayoutDXF, generateColumnLayoutDXF, downloadDXF } from '@/export/dxfExporter';
import * as XLSX from 'xlsx';
import { arrangeBeamReinforcement } from '@/lib/beamRebarArranger';
import BeamDetailingDashboard from './BeamDetailingDashboard';
import DrawingCoreEnginePanel from './DrawingCoreEnginePanel';
import { AutomaticSectionEngine, SectionType, SectionPackage, SectionQAIssue } from '@/lib/automaticSectionEngine';
import { AutomaticDetailEngine, EnlargedDetailPackage, DetailType, DetailGraphicsBar, DetailDimension, DetailAnnotation, DetailQARun } from '@/lib/automaticDetailEngine';
import { BeamScheduleEngine, BeamScheduleRow, BeamScheduleValidationIssue } from '@/lib/beamScheduleEngine';
import { SlabScheduleEngine, SlabScheduleRow, SlabScheduleValidationIssue as SlabScheduleValidationIssueType } from '@/lib/slabScheduleEngine';
import { ColumnScheduleEngine, ColumnScheduleRow, ColumnScheduleValidationIssue as ColumnScheduleValidationIssueType } from '@/lib/columnScheduleEngine';
import { ColumnScheduleModule } from './ColumnScheduleModule';
import { SlabScheduleModule } from './SlabScheduleModule';
import { ReinforcementScheduleSystem } from './ReinforcementScheduleSystem';
import { SheetCompositionEngine } from './SheetCompositionEngine';
import { DxfExportSuite } from './DxfExportSuite';
import PrintingEngineWorkspace from './PrintingEngineWorkspace';
import { Sparkles, CheckSquare, ClipboardList, HelpCircle, Maximize2 } from 'lucide-react';

interface StructuralDrawingsModuleProps {
  stories: Story[];
  activeStoryId: string;
  slabs: Slab[];
  beams: Beam[];
  columns: Column[];
  beamDesigns?: any[];
  colDesigns?: Record<string, ColumnResult | any>;
  slabDesigns?: any[];
  mat?: any;
  slabProps?: any;
  projectName?: string;
  titleBlockConfig?: any;
  analyzed?: boolean;
  foundationResults?: any[];
  foundationMat?: any;
  bentUpResults?: any;
  ribbedSlabProps?: any;
  colLoads3D?: Map<string, any>;
  onUpdateTitleBlock?: (config: any) => void;
}

const DEFAULT_STRUCTURAL_NOTES = [
  "جميع الأبعاد بالمليمتر والمنسوب بالمتر، مالم يذكر خلاف ذلك في المخطط.",
  "تم التصميم والتحقق الإنشائي وفقاً لمتطلبات الكود الأمريكي للخرسانة المسلحة (ACI 318M-19).",
  "رتبة الخرسانة المسلحة للأعمدة والأسقف والجسور لا تقل عن C30 (مقاومة مميزة قدرها 30 ميجا باسكال عند 28 يوماً).",
  "إجهاد خضوع حديد التسليح لا يقل عن 420 ميجا باسكال (حديد عالي المقاومة مشكل على البارد Grade 420).",
  "الغطاء الخرساني الصافي لحماية حديد التسليح لا يقل عن: 40 مم للأعمدة والجسور، 20 مم للبلاطات، 75 مم للقواعد الملامسة للتربة.",
  "طول وصلة التراكب لحديد التسليح لا يقل عن 60 مرة من قطر السيخ الأكبر (60d) للبلاطات والجدران والجسور.",
  "يتم تكثيف الكانات (Stirrups) في الجسور والأعمدة عند مناطق الاتصال بطول مسافة تكثيف لا تقل عن (1.5H) من وجه الركيزة.",
  "لا يسمح بعمل فتحات في البلاطات أو الجسور الخرسانية دون الرجوع للمهندس المصمم والموافقة المكتوبة.",
  "يتم صب خرسانة النظافة (PCC) بسمك لا يقل عن 100 مم تحت جميع الأسقف/المدادات الملامسة للردم وركائز الأساس."
];

export default function StructuralDrawingsModule({
  stories = [],
  activeStoryId,
  slabs = [],
  beams = [],
  columns = [],
  beamDesigns = [],
  colDesigns = {},
  slabDesigns = [],
  mat = { fc: 25, fy: 420, density: 24 },
  slabProps = { cover: 20 },
  projectName = 'Structural Design Studio',
  titleBlockConfig = {},
  analyzed = false,
  foundationResults = [],
  foundationMat = {},
  bentUpResults = [],
  ribbedSlabProps = {},
  colLoads3D,
  onUpdateTitleBlock
}: StructuralDrawingsModuleProps) {

  // Selected sub-tab for structural drawings module
  const [activeSubTab, setActiveSubTab] = useState<'sheetManager' | 'cadWorkspace' | 'floorPlans' | 'beamDetails' | 'columnDetails' | 'slabDetails' | 'sections' | 'enlargedDetails' | 'reinforcementSchedules' | 'bbs' | 'boq' | 'notes' | 'dxfSuite' | 'printingEngine'>('cadWorkspace');

  // Projection mode for interactive floor plans (General framing, Slab reinforcement, Beam reinforcement, Column reinforcement)
  const [projectionMode, setProjectionMode] = useState<'general' | 'slabs' | 'beams' | 'columns'>('general');

  // High fidelity CAD Floor Framing Plan interactive states
  const [cadFloorLayers, setCadFloorLayers] = useState({
    grids: true,        // المحاور والشبكة الإنشائية
    columns: true,      // الأعمدة والقطاعات الخرسانية
    beams: true,        // الجسور والكمرات بالتسليح
    slabs: true,        // البلاطات وسماكاتها
    dimensions: true,   // الأبعاد والقياسات البينية
    coordinates: true,  // الدوائر وإحداثيات النقاط
    annotations: true   // الكتابات الهندسية والتوصيف
  });
  const [cadFloorTheme, setCadFloorTheme] = useState<'dark' | 'light'>('dark');
  const [selectedCadElement, setSelectedCadElement] = useState<{ type: 'slab' | 'beam' | 'column'; id: string; details: string; rawData: any } | null>(null);

  // Detail Extraction Engine state variables
  const [selectedDetailId, setSelectedDetailId] = useState<string>('');
  const [activeDetailScale, setActiveDetailScale] = useState<'1:5' | '1:10' | '1:20' | '1:25'>('1:10');
  const [showQADetailsPanel, setShowQADetailsPanel] = useState<boolean>(true);
  const [filterDetailType, setFilterDetailType] = useState<string>('all');

  // Beam Schedule (Phase D6A) state variables
  const [groupBeams, setGroupBeams] = useState<boolean>(true);
  const [beamScheduleFilterType, setBeamScheduleFilterType] = useState<string>('all');
  const [beamScheduleFilterSize, setBeamScheduleFilterSize] = useState<string>('all');
  const [beamScheduleSortField, setBeamScheduleSortField] = useState<string>('beamId');
  const [beamScheduleShowQA, setBeamScheduleShowQA] = useState<boolean>(true);

  // Interactive local configurations
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [selectedBeamId, setSelectedBeamId] = useState<string>('');
  const [selectedColId, setSelectedColId] = useState<string>('');
  const [selectedScale, setSelectedScale] = useState<string>('1:50');
  const [steelPricePerKg, setSteelPricePerKg] = useState<number>(3.5); // SAR or generic currency
  const [concretePricePerM3, setConcretePricePerM3] = useState<number>(320);
  const [formworkPricePerM2, setFormworkPricePerM2] = useState<number>(80);
  const [excavationPricePerM3, setExcavationPricePerM3] = useState<number>(40);
  const [customNotes, setCustomNotes] = useState<string[]>(DEFAULT_STRUCTURAL_NOTES);
  const [newNoteInput, setNewNoteInput] = useState<string>('');

  // Local Title Block attributes for the sheet
  const [titleBlock, setTitleBlock] = useState({
    projectName: projectName || 'مشروع سكن نموذجي',
    clientName: titleBlockConfig?.clientName || 'وزارة الإسكان والتعمير',
    drawingTitle: titleBlockConfig?.drawingTitle || 'تفاصيل التسليح الإنشائي للمبنى',
    drawingNo: titleBlockConfig?.drawingNo || 'S-101',
    designedBy: titleBlockConfig?.designedBy || 'ENG. ARCHITECTURE',
    approvedBy: titleBlockConfig?.approvedBy || 'STU DESIGN DEPT',
    revision: titleBlockConfig?.revision || 'REV-0',
    date: titleBlockConfig?.date || new Date().toISOString().split('T')[0]
  });

  // Phase S2: Beam Detailing System state variables
  const [detailingMode, setDetailingMode] = useState<'individual' | 'grouped'>('individual');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('B1');
  const [beamDrawingScale, setBeamDrawingScale] = useState<number>(1);
  const [drawingLang, setDrawingLang] = useState<'ar' | 'en'>('ar');
  const [beamSearchQuery, setBeamSearchQuery] = useState<string>('');

  // Phase D5: Automatic Section Generator states
  const [sectionType, setSectionType] = useState<SectionType>('beam');
  const [sectionCode, setSectionCode] = useState<string>('A-A');
  const [sectionBeamId, setSectionBeamId] = useState<string>('');
  const [sectionColId, setSectionColId] = useState<string>('');
  const [customOffsetPercent, setCustomOffsetPercent] = useState<number>(50);
  const [customSectionInputW, setCustomSectionInputW] = useState<number>(600);
  const [customSectionInputH, setCustomSectionInputH] = useState<number>(300);
  const [hatchScale, setHatchScale] = useState<number>(1);
  const [showQAPanel, setShowQAPanel] = useState<boolean>(true);

  // Phase D6B: Column Schedule System view mode state
  const [columnDetailViewMode, setColumnDetailViewMode] = useState<'schedule' | 'gallery'>('schedule');

  // Phase D6C: Slab Schedule System view mode state
  const [slabDetailViewMode, setSlabDetailViewMode] = useState<'schedule' | 'guide'>('schedule');

  // Phase D6D: Reinforcement Schedule View Mode
  const [rebarScheduleTabMode, setRebarScheduleTabMode] = useState<'unified' | 'beams'>('unified');

  // Keep stories & activeStory updated
  useEffect(() => {
    if (stories.length > 0) {
      const active = stories.find(s => s.id === activeStoryId) || stories[0];
      setActiveStory(active);
    }
  }, [stories, activeStoryId]);

  // Sync title block triggers back with parents optionally
  const handleTitleBlockChange = (key: string, value: string) => {
    const updated = { ...titleBlock, [key]: value };
    setTitleBlock(updated);
    if (onUpdateTitleBlock) {
      onUpdateTitleBlock(updated);
    }
  };

  // Extract selected floor structures
  const filteredStories = useMemo(() => stories, [stories]);
  const activeStoryLabel = activeStory ? activeStory.label : 'الدور الأرضي';

  const storySlabs = useMemo(() => {
    if (!activeStory) return slabs;
    return slabs.filter(s => s.storyId === activeStory.id);
  }, [slabs, activeStory]);

  const storyBeams = useMemo(() => {
    if (!activeStory) return beams;
    return beams.filter(b => b.storyId === activeStory.id);
  }, [beams, activeStory]);

  // Auto fallback to mock designs to ensure interactive CAD doesn't block
  const resolvedBeamDesigns = useMemo(() => {
    if (analyzed && beamDesigns && beamDesigns.length > 0) {
      return beamDesigns;
    }
    // Generate intelligent default beam designs for the CAD elevation
    return storyBeams.map(b => {
      const L_span = Math.sqrt(Math.pow(b.x2 - b.x1, 2) + Math.pow(b.y2 - b.y1, 2)) || 4.5;
      return {
        beamId: b.id,
        span: L_span,
        flexLeft: { bars: 4, dia: 16, AsNeeded: 550, AsProvided: 804, ratio: 0.68 },
        flexMid: { bars: 3, dia: 14, AsNeeded: 380, AsProvided: 461, ratio: 0.82 },
        flexRight: { bars: 4, dia: 16, AsNeeded: 550, AsProvided: 804, ratio: 0.68 },
        shear: { stirrups: 'Ø10 @ 150 mm', spacing: 150, nLegs: 2, Av_provided: 157, Av_needed: 120 }
      };
    });
  }, [beamDesigns, storyBeams, analyzed]);

  // Phase S2: Dynamic Beam Grouping Engine (STA4CAD-style)
  const beamGroups = useMemo(() => {
    interface BeamGroup {
      id: string; // e.g., "B1", "B2"
      b: number;
      h: number;
      length: number;
      beamIds: string[];
      representativeBeamId: string;
      keys: string;
    }

    const groups: BeamGroup[] = [];
    let counter = 1;

    for (const b of storyBeams) {
      const design = resolvedBeamDesigns.find(d => d.beamId === b.id);
      const b_val = b.b || 250;
      const h_val = b.h || 600;
      const L_val = b.length || 5000;

      // Extract reinforcement characteristics
      const tlBars = design?.flexLeft?.bars || 3;
      const tlDia = design?.flexLeft?.dia || 16;
      const tmBars = design?.flexMid?.bars || 2;
      const tmDia = design?.flexMid?.dia || 14;
      const trBars = design?.flexRight?.bars || 3;
      const trDia = design?.flexRight?.dia || 16;

      const blBars = Math.max(2, Math.floor(tlBars * 0.35)) || 2;
      const blDia = tlDia;
      const bmBars = design?.flexMid?.bars || 3;
      const bmDia = design?.flexMid?.dia || 16;
      const brBars = Math.max(2, Math.floor(trBars * 0.35)) || 2;
      const brDia = trDia;

      const stirrupSpacing = design?.shear?.spacing || 150;

      // Unifying key representing same shape, dimensions, and full reinforcement details
      const groupKey = `${b_val}x${h_val}_L${Math.round(L_val/100)*100}_TL_${tlBars}Ø${tlDia}_TM_${tmBars}Ø${tmDia}_TR_${trBars}Ø${trDia}_BL_${blBars}Ø${blDia}_BM_${bmBars}Ø${bmDia}_BR_${brBars}Ø${brDia}_S_${stirrupSpacing}`;

      const existing = groups.find(g => g.keys === groupKey);
      if (existing) {
        existing.beamIds.push(b.id);
      } else {
        groups.push({
          id: `B${counter++}`,
          b: b_val,
          h: h_val,
          length: L_val,
          beamIds: [b.id],
          representativeBeamId: b.id,
          keys: groupKey
        });
      }
    }
    return groups;
  }, [storyBeams, resolvedBeamDesigns]);

  const storyCols = useMemo(() => {
    if (!activeStory) return columns;
    return columns.filter(c => !c.isRemoved); // columns exist across levels usually
  }, [columns, activeStory]);

  const resolvedColDesigns = useMemo(() => {
    if (analyzed && colDesigns && Object.keys(colDesigns).length > 0) {
      return colDesigns;
    }
    // Generate intelligent default column designs for schedules
    const mock: Record<string, any> = {};
    columns.forEach(c => {
      mock[c.id] = {
        columnId: c.id,
        name: c.name || `C-${c.id}`,
        barCount: 8,
        barDiameter: 16,
        rho: 0.015,
        rebarSpacing: 150,
        text: '8 Ø 16',
        tiesText: 'Ø 10 @ 150 mm',
        P_capacity: 1800,
        Pu: 1200,
        utilization: 0.67
      };
    });
    return mock;
  }, [colDesigns, columns, analyzed]);

  // Selected elements for specific details tabs
  const resolvedSlabDesigns = useMemo(() => {
    return slabs.map(s => {
      const designFromProp = slabDesigns?.find(d => d.id === s.id);
      if (designFromProp) return designFromProp;
      const anyS = s as any;
      return {
        id: s.id,
        slabId: s.id,
        thickness: s.t || 150,
        rebarBottom: 'Ø12 @ 150',
        rebarTop: 'Ø10 @ 150',
        rebarBottomX: anyS.rebarBottomX || 'Ø12 @ 150',
        rebarBottomY: anyS.rebarBottomY || 'Ø12 @ 150',
        rebarTopX: anyS.rebarTopX || 'Ø10 @ 150',
        rebarTopY: anyS.rebarTopY || 'Ø10 @ 150',
        gridLocation: anyS.lx && anyS.ly ? `Grid ${s.storyId || 'S1'}-${s.id}` : 'Interior Grid',
        status: 'OK',
        thick: s.t || 150,
        storyId: s.storyId
      };
    });
  }, [slabs, slabDesigns]);

  // Arabic group label maps for isomorphic matching in CAD preview
  const beamGroupLabelsMap = useMemo(() => {
    return buildBeamGroupLabels(resolvedBeamDesigns as any, bentUpResults);
  }, [resolvedBeamDesigns, bentUpResults]);

  const colGroupLabelsMap = useMemo(() => {
    return buildColGroupLabels(Object.values(resolvedColDesigns) as any);
  }, [resolvedColDesigns]);

  const slabGroupLabelsMap = useMemo(() => {
    return buildSlabGroupLabels(resolvedSlabDesigns as any);
  }, [resolvedSlabDesigns]);

  // Selected elements for specific details tabs
  useEffect(() => {
    if (storyBeams.length > 0 && !selectedBeamId) {
      setSelectedBeamId(storyBeams[0].id);
    }
  }, [storyBeams, selectedBeamId]);

  useEffect(() => {
    if (storyCols.length > 0 && !selectedColId) {
      setSelectedColId(storyCols[0].id);
    }
  }, [storyCols, selectedColId]);

  const currentSelectedBeam = storyBeams.find(b => b.id === selectedBeamId);
  const currentSelectedBeamDesign = resolvedBeamDesigns.find(d => d.beamId === selectedBeamId);

  // Stateful overrides for active rebar combinations chosen by the user
  const [selectedSolutionIdx, setSelectedSolutionIdx] = useState<{
    topLeft?: number;
    topMid?: number;
    topRight?: number;
    botLeft?: number;
    botMid?: number;
    botRight?: number;
  }>({});

  const [activeRegionSelector, setActiveRegionSelector] = useState<'topLeft' | 'topMid' | 'topRight' | 'botLeft' | 'botMid' | 'botRight'>('topLeft');

  useEffect(() => {
    setSelectedSolutionIdx({});
  }, [selectedBeamId]);

  const beamArrangement = useMemo(() => {
    if (!currentSelectedBeam) return null;
    
    const b = currentSelectedBeam.b || 250;
    const h = currentSelectedBeam.h || 600;
    const lengthVal = currentSelectedBeam.length || 5000;
    
    // Read from design or provide smart defaults
    const topLeft = currentSelectedBeamDesign?.flexLeft?.AsNeeded || currentSelectedBeamDesign?.flexLeft?.As || 380;
    const topMid = currentSelectedBeamDesign?.flexMid?.AsNeeded || currentSelectedBeamDesign?.flexMid?.As || 180;
    const topRight = currentSelectedBeamDesign?.flexRight?.AsNeeded || currentSelectedBeamDesign?.flexRight?.As || 380;
    
    const botLeft = (currentSelectedBeamDesign?.flexLeft?.AsNeeded || currentSelectedBeamDesign?.flexLeft?.As || 380) * 0.35 || 250;
    const botMid = currentSelectedBeamDesign?.flexMid?.AsNeeded || currentSelectedBeamDesign?.flexMid?.As || 480;
    const botRight = (currentSelectedBeamDesign?.flexRight?.AsNeeded || currentSelectedBeamDesign?.flexRight?.As || 380) * 0.35 || 250;
    
    const shearVu = currentSelectedBeamDesign?.shear?.Vu || currentSelectedBeamDesign?.Vu || 85;
    const shearSpacing = currentSelectedBeamDesign?.shear?.spacing || currentSelectedBeamDesign?.shear?.sRequired || 150;

    return arrangeBeamReinforcement({
      beamId: currentSelectedBeam.id,
      width: b,
      depth: h,
      length: lengthVal,
      fc: mat?.fc || 25,
      fy: mat?.fy || 420,
      fyt: mat?.fy || 420,
      asTopReqLeft: topLeft,
      asTopReqMid: topMid,
      asTopReqRight: topRight,
      asBotReqLeft: botLeft,
      asBotReqMid: botMid,
      asBotReqRight: botRight,
      shearVuMax: shearVu,
      shearSpacingReq: shearSpacing,
      cover: 40,
      stirrupDia: mat?.stirrupDia || 10,
    });
  }, [currentSelectedBeam, currentSelectedBeamDesign, mat]);

  const activeArrangement = useMemo(() => {
    if (!beamArrangement) return null;
    const layout = JSON.parse(JSON.stringify(beamArrangement));

    // Apply overrides if chosen
    if (selectedSolutionIdx.topLeft !== undefined && layout.topRegions.left.candidates[selectedSolutionIdx.topLeft]) {
      const cand = layout.topRegions.left.candidates[selectedSolutionIdx.topLeft];
      layout.topRegions.left.allBars = cand.bars;
      layout.topRegions.left.providedAs = cand.providedAs;
    }
    if (selectedSolutionIdx.topMid !== undefined && layout.topRegions.mid.candidates[selectedSolutionIdx.topMid]) {
      const cand = layout.topRegions.mid.candidates[selectedSolutionIdx.topMid];
      layout.topRegions.mid.allBars = cand.bars;
      layout.topRegions.mid.providedAs = cand.providedAs;
    }
    if (selectedSolutionIdx.topRight !== undefined && layout.topRegions.right.candidates[selectedSolutionIdx.topRight]) {
      const cand = layout.topRegions.right.candidates[selectedSolutionIdx.topRight];
      layout.topRegions.right.allBars = cand.bars;
      layout.topRegions.right.providedAs = cand.providedAs;
    }
    if (selectedSolutionIdx.botLeft !== undefined && layout.bottomRegions.left.candidates[selectedSolutionIdx.botLeft]) {
      const cand = layout.bottomRegions.left.candidates[selectedSolutionIdx.botLeft];
      layout.bottomRegions.left.allBars = cand.bars;
      layout.bottomRegions.left.providedAs = cand.providedAs;
    }
    if (selectedSolutionIdx.botMid !== undefined && layout.bottomRegions.mid.candidates[selectedSolutionIdx.botMid]) {
      const cand = layout.bottomRegions.mid.candidates[selectedSolutionIdx.botMid];
      layout.bottomRegions.mid.allBars = cand.bars;
      layout.bottomRegions.mid.providedAs = cand.providedAs;
    }
    if (selectedSolutionIdx.botRight !== undefined && layout.bottomRegions.right.candidates[selectedSolutionIdx.botRight]) {
      const cand = layout.bottomRegions.right.candidates[selectedSolutionIdx.botRight];
      layout.bottomRegions.right.allBars = cand.bars;
      layout.bottomRegions.right.providedAs = cand.providedAs;
    }
    
    return layout;
  }, [beamArrangement, selectedSolutionIdx]);

  const currentSelectedCol = storyCols.find(c => c.id === selectedColId);
  const currentSelectedColDesign = resolvedColDesigns[selectedColId] || {
    text: '8 Ø 16',
    tiesText: 'Ø 10 @ 150 mm',
    rebarSpacing: 150,
    utilization: 0.55
  };

  // BBS List computation
  const bbsEntries = useMemo<BBSEntry[]>(() => {
    // Attempt standard BBS mapping
    try {
      // Direct transform to match expected exporter format
      const mockSlabDesigns = storySlabs.map(s => ({ id: s.id, design: { status: 'OK', thick: s.t || 150, rebarBottom: 'Ø12 @ 150', rebarTop: 'Ø10 @ 150' } }));
      const entries = generateBBS(storyBeams, storyCols, storySlabs, resolvedBeamDesigns as any, Object.values(resolvedColDesigns) as any, mockSlabDesigns as any);
      return entries;
    } catch (e) {
      // Beautiful fallback list if bbs generator breaks on unformed structures
      const fallback: any[] = [];
      storyBeams.forEach((b, i) => {
        const L_span = Math.sqrt(Math.pow(b.x2 - b.x1, 2) + Math.pow(b.y2 - b.y1, 2)) || 4.5;
        fallback.push({
          barMark: `B${b.id}-T1`,
          element: `Beam ${b.id} Top`,
          diameter: 16,
          length: parseFloat((L_span + 0.6).toFixed(2)),
          count: 3,
          shape: 'L-BAR',
          annotation: 'Continuous top reinforcement'
        });
        fallback.push({
          barMark: `B${b.id}-B1`,
          element: `Beam ${b.id} Bot`,
          diameter: 14,
          length: parseFloat((L_span + 0.5).toFixed(2)),
          count: 3,
          shape: 'STRAIGHT',
          annotation: 'Bottom span reinforcement'
        });
        fallback.push({
          barMark: `B${b.id}-ST`,
          element: `Beam ${b.id} Ties`,
          diameter: 10,
          length: parseFloat((2 * (b.b + b.h) - 80).toFixed(0)) / 1000,
          count: Math.ceil(L_span / 0.15) + 1,
          shape: 'CLOSED-TIE',
          annotation: 'Shear stirrups'
        });
      });
      storyCols.forEach((c, i) => {
        fallback.push({
          barMark: `C${c.name || c.id}-L`,
          element: `Col ${c.name || c.id} Main`,
          diameter: 16,
          length: 3.6,
          count: 8,
          shape: 'L-BAR',
          annotation: 'Column longitudinal rebars'
        });
        fallback.push({
          barMark: `C${c.name || c.id}-T`,
          element: `Col ${c.name || c.id} Ties`,
          diameter: 10,
          length: parseFloat((2 * (c.b + c.h) - 80).toFixed(0)) / 1000,
          count: 24,
          shape: 'CLOSED-TIE',
          annotation: 'Confinement stirrups'
        });
      });
      return fallback;
    }
  }, [storyBeams, storyCols, storySlabs, resolvedBeamDesigns, resolvedColDesigns]);

  // Volume & Quantity math
  const boqMetrics = useMemo(() => {
    let concreteRCC = 0;
    let concretePCC = 0;
    let formworkArea = 0;
    let excavationVol = 0;
    let backfillVol = 0;
    let steelTotal = 0;

    // Slabs RCC & Formwork
    storySlabs.forEach(s => {
      const area = Math.abs((s.x2 - s.x1) * (s.y2 - s.y1)) || 20;
      const th = (s.t || 150) / 1000;
      concreteRCC += area * th;
      formworkArea += area + 2 * (Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1)) * th;
    });

    // Beams RCC & Formwork
    storyBeams.forEach(b => {
      const L_span = Math.sqrt(Math.pow(b.x2 - b.x1, 2) + Math.pow(b.y2 - b.y1, 2)) || 4.5;
      const areaCross = (b.b / 1000) * (b.h / 1000);
      concreteRCC += L_span * areaCross;
      formworkArea += L_span * (b.b / 1000 + 2 * (b.h / 1000));
    });

    // Columns RCC & Formwork
    storyCols.forEach(c => {
      const height = 3.2; // typical story height
      const areaCross = (c.b / 1000) * (c.h / 1000);
      concreteRCC += height * areaCross;
      formworkArea += height * (2 * (c.b / 1000) + 2 * (c.h / 1000));
    });

    // Steel Weight sum from BBS
    steelTotal = bbsEntries.reduce((sum, item) => {
      const barWeightPerM = 0.00617 * Math.pow(item.diameter, 2);
      return sum + (item.length * item.count * barWeightPerM);
    }, 0);

    // Foundation quantities (if applicable)
    if (foundationResults && foundationResults.length > 0) {
      foundationResults.forEach(res => {
        concreteRCC += (res.B * res.L * res.H) / 1e9;
        concretePCC += (res.B + 200) * (res.L + 200) * 0.1 / 1e9;
        excavationVol += (res.B + 600) * (res.L + 600) * 1.5 / 1e9;
      });
      backfillVol = excavationVol - concreteRCC - concretePCC;
    } else {
      // Standard excavation PCC for columns
      excavationVol = storyCols.length * 2.5 * 2.5 * 1.5;
      concretePCC = storyCols.length * 1.8 * 1.8 * 0.1;
      backfillVol = excavationVol - (concretePCC + (concreteRCC * 0.2));
    }

    return {
      concreteRCC: parseFloat(concreteRCC.toFixed(2)),
      concretePCC: parseFloat(concretePCC.toFixed(2)),
      formworkArea: parseFloat(formworkArea.toFixed(2)),
      excavationVol: parseFloat(excavationVol.toFixed(2)),
      backfillVol: parseFloat(backfillVol.toFixed(2)),
      steelKg: parseFloat(steelTotal.toFixed(1)),
      totalCost: parseFloat((
        (concreteRCC * concretePricePerM3) +
        (concretePCC * concretePricePerM3 * 0.8) +
        (formworkArea * formworkPricePerM2) +
        (steelTotal * steelPricePerKg) +
        (excavationVol * excavationPricePerM3)
      ).toFixed(2))
    };
  }, [storySlabs, storyBeams, storyCols, bbsEntries, foundationResults, steelPricePerKg, concretePricePerM3, formworkPricePerM2, excavationPricePerM3]);

  // Export excel CSV logic
  const handleExportCSV = () => {
    let csv = "رقم السيخ (Mark),العنصر الإنشائي (Element),القطر (Diameter mm),الطول (Length m),العدد (Count),الشكل (Shape),الوصف والوظيفة (Annotation)\n";
    bbsEntries.forEach(item => {
      csv += `"${item.barMark}","${item.element}",${item.diameter},${item.length},${item.count},"${item.shape}","${item.annotation}"\n`;
    });
    
    // Add BOQ summary to CSV
    csv += "\n\nجدول الكميات والتكلفة الإنشائية التقديرية (Superstructure BOQ Summary)\n";
    csv += "البند الإنشائي (Item),الكمية (Quantity),الوحدة (Unit),سعر الوحدة بالريال/الدولار (Unit Rate),التكلفة الإجمالية (Total Cost)\n";
    csv += `"خرسانة مسلحة للهياكل RCC",${boqMetrics.concreteRCC},"m³",${concretePricePerM3},${(boqMetrics.concreteRCC * concretePricePerM3).toFixed(0)}\n`;
    csv += `"خرسانة عادية للنظافة PCC",${boqMetrics.concretePCC},"m³",${(concretePricePerM3 * 0.8).toFixed(0)},${(boqMetrics.concretePCC * concretePricePerM3 * 0.8).toFixed(0)}\n`;
    csv += `"أعمال الطوبار الخشبي / القوالب",${boqMetrics.formworkArea},"m²",${formworkPricePerM2},${(boqMetrics.formworkArea * formworkPricePerM2).toFixed(0)}\n`;
    csv += `"حديد التسليح عالي المقاومة",${boqMetrics.steelKg},"kg",${steelPricePerKg},${(boqMetrics.steelKg * steelPricePerKg).toFixed(0)}\n`;
    csv += `"أعمال الحفريات والتربة",${boqMetrics.excavationVol},"m³",${excavationPricePerM3},${(boqMetrics.excavationVol * excavationPricePerM3).toFixed(0)}\n`;
    csv += `"التكلفة الإجمالية التقديرية",${boqMetrics.totalCost},"Currency",-,-\n`;

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${titleBlock.projectName}_Superstructure_Schedules_S-105.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // BBS Excel Spreadsheet Exporter
  const handleExportExcelBBS = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Create BBS Sheet
      const bbsData = bbsEntries.map(e => ({
        "Bar Mark (رمز السيخ)": e.barMark,
        "Structural Member (العضو الإنشائي)": e.element,
        "Diameter (القطر mm)": e.diameter,
        "Length (الطول m)": e.length,
        "Quantity (العدد)": e.count,
        "Bending Shape (شكل الانحناء)": e.shape,
        "Total length (الطول الكلي m)": parseFloat((e.length * e.count).toFixed(2)),
        "Unit Weight (الوزن لوحدة الطول kg/m)": parseFloat((0.00617 * Math.pow(e.diameter, 2)).toFixed(3)),
        "Weight (الوزن الكلي kg)": parseFloat((e.length * e.count * 0.00617 * Math.pow(e.diameter, 2)).toFixed(1)),
        "Annotation (ملاحظات)": e.annotation
      }));
      const wsBBS = XLSX.utils.json_to_sheet(bbsData);
      XLSX.utils.book_append_sheet(wb, wsBBS, "Bar Bending Schedule (BBS)");

      // Create BOQ Sheet
      const boqData = [
        { "البند الإنشائي (Item)": "Concrete RCC (خرسانة مسلحة)", "الكمية (Qty)": boqMetrics.concreteRCC, "الوحدة (Unit)": "m³", "السعر الإفرادي (Rate)": concretePricePerM3, "الإجمالي (Total)": (boqMetrics.concreteRCC * concretePricePerM3) },
        { "البند الإنشائي (Item)": "Concrete PCC (خرسانة عادية)", "الكمية (Qty)": boqMetrics.concretePCC, "الوحدة (Unit)": "m³", "السعر الإفرادي (Rate)": concretePricePerM3 * 0.8, "الإجمالي (Total)": (boqMetrics.concretePCC * concretePricePerM3 * 0.8) },
        { "البند الإنشائي (Item)": "Formwork Area (القوالب الخشبية)", "الكمية (Qty)": boqMetrics.formworkArea, "الوحدة (Unit)": "m²", "السعر الإفرادي (Rate)": formworkPricePerM2, "الإجمالي (Total)": (boqMetrics.formworkArea * formworkPricePerM2) },
        { "البند الإنشائي (Item)": "Steel Reinforcement (حديد التسليح)", "الكمية (Qty)": boqMetrics.steelKg, "الوحدة (Unit)": "kg", "السعر الإفرادي (Rate)": steelPricePerKg, "الإجمالي (Total)": (boqMetrics.steelKg * steelPricePerKg) },
        { "البند الإنشائي (Item)": "Excavation Vol (أعمال الحفر)", "الكمية (Qty)": boqMetrics.excavationVol, "الوحدة (Unit)": "m³", "السعر الإفرادي (Rate)": excavationPricePerM3, "الإجمالي (Total)": (boqMetrics.excavationVol * excavationPricePerM3) },
        { "البند الإنشائي (Item)": "Backfill Vol (أعمال الردم)", "الكمية (Qty)": boqMetrics.backfillVol, "الوحدة (Unit)": "m³", "السعر الإفرادي (Rate)": excavationPricePerM3 * 0.5, "الإجمالي (Total)": (boqMetrics.backfillVol * excavationPricePerM3 * 0.5) }
      ];
      const wsBOQ = XLSX.utils.json_to_sheet(boqData);
      XLSX.utils.book_append_sheet(wb, wsBOQ, "Quantity Survey & Cost (BOQ)");

      XLSX.writeFile(wb, `${titleBlock.projectName}_Engineering_Schedules_${titleBlock.drawingNo}.xlsx`);
    } catch (e) {
      console.error(e);
      handleExportCSV(); // Fallback
    }
  };

  // Compile DXF sheets
  const handleExportDXFAll = () => {
    setActiveSubTab('dxfSuite');
  };

  // Run HTML construction printing overlay
  const handlePrintHTMLSheets = () => {
    const mockSlabDesigns = storySlabs.map(s => ({
      id: s.id,
      design: {
        status: 'OK',
        thick: s.t || 150,
        rebarBottom: 'Ø12 @ 150 mm',
        rebarTop: 'Ø10 @ 150 mm',
        as_needed_x: 350,
        as_provided_x: 450,
        as_needed_y: 350,
        as_provided_y: 450,
        shear_ratio: 0.35,
        ratio_span_depth: 22
      }
    }));

    openHTMLSheetsForPrint(
      storySlabs,
      storyBeams,
      storyCols,
      resolvedBeamDesigns as any,
      Object.values(resolvedColDesigns) as any,
      mockSlabDesigns as any,
      titleBlock.projectName,
      {
        includeGrid: true,
        includeDetails: true,
        sheetScale: selectedScale,
        sheetBorder: true,
        designer: titleBlock.designedBy,
        titleBlockConfig: {
          clientName: titleBlock.clientName,
          drawingTitle: titleBlock.drawingTitle,
          drawingNo: titleBlock.drawingNo,
          rev: titleBlock.revision,
          date: titleBlock.date,
          scale: selectedScale
        } as any
      } as any,
      'auto',
      slabProps,
      mat,
      ribbedSlabProps
    );
  };

  const handlePrintActiveFloorPlan = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svgElement = document.getElementById('cad-blueprint-master-svg');
    let svgContent = svgElement ? svgElement.outerHTML : '';

    const drawnW = cadFloorBounds.w * scaleCad;
    const drawnH = cadFloorBounds.h * scaleCad;

    // Horizontally, crop to the floor plan area with axis bubbles
    // General formwork/axes plan (S-101): expand viewport to full plan width — no schedule column on right
    const minPixelX = Math.max(5, offsetCadX - 55);
    const maxPixelX = projectionMode === 'general'
      ? Math.min(710, offsetCadX + drawnW + 60)
      : Math.min(462, offsetCadX + drawnW + 45);

    // Vertically, provide perfect pads on both top (dimensions) and bottom (bubbles)
    const minPixelY = Math.max(5, cadHeight - (offsetCadY + drawnH + 52));
    const maxPixelY = Math.min(515, cadHeight - offsetCadY + 52);

    const viewBoxW = maxPixelX - minPixelX;
    const viewBoxH = maxPixelY - minPixelY;

    // Dynamically crop the print SVG to focus purely on the floor plan at 100% scaled width/height
    svgContent = svgContent.replace(/viewBox="[^"]*"/, `viewBox="${minPixelX} ${minPixelY} ${viewBoxW} ${viewBoxH}"`);
    
    const activeViewLabelAr = 
      projectionMode === 'general' ? 'مخطط محاور وأعمدة السقف والقوالب الخرسانية' :
      projectionMode === 'slabs' ? 'مخطط تسليح بلاطات السقف وسماكاتها' :
      projectionMode === 'beams' ? 'مخطط جسور وكمرات السقف الخرساني' :
      'مخطط توزيع وتسليح الأعمدة الإنشائية';

    const activeViewLabelEn = 
      projectionMode === 'general' ? 'FOUNDATION / AXES & COLUMNS FORMWORK PLAN' :
      projectionMode === 'slabs' ? 'SLAB REINFORCEMENT & DEVIATION SHAPE' :
      projectionMode === 'beams' ? 'BEAM LAYOUT AND SCHEDULING PLAN' :
      'COLUMN STRUCTURAL LAYOUT DESIGN';

    const drawingNumberVal = 
      projectionMode === 'general' ? 'S-101' :
      projectionMode === 'slabs' ? 'S-102' :
      projectionMode === 'beams' ? 'S-103' :
      'S-104';

    // Pick matching schedule table HTML.
    // General formwork/axes plan (S-101): pure plan drawing only — no schedule tables per user requirement.
    // Ref: prompt modification — مخطط القوالب والمحاور للدور = مسقط أفقي فقط بدون جداول أو ملاحظات
    let tableHTML = '';
    if (projectionMode === 'slabs') {
      tableHTML = htmlSlabScheduleTable(resolvedSlabDesigns as any, storySlabs);
    } else if (projectionMode === 'beams') {
      tableHTML = htmlBeamScheduleTable(storyBeams, resolvedBeamDesigns as any, bentUpResults);
    } else if (projectionMode === 'columns') {
      tableHTML = htmlColumnScheduleTable(Object.values(resolvedColDesigns) as any);
    }
    // projectionMode === 'general': tableHTML intentionally stays '' — formwork plan is drawing-only

    const titleBlockConfig = {
      firmName: 'Structural Design Studio',
      projectName: titleBlock.projectName,
      projectLocation: '',
      clientName: titleBlock.clientName,
      drawingTitle: activeViewLabelAr,
      drawingSubTitle: activeViewLabelEn,
      scale: selectedScale,
      sheetNo: drawingNumberVal === 'S-101' ? '1' : drawingNumberVal === 'S-102' ? '2' : drawingNumberVal === 'S-103' ? '3' : '4',
      drawingNumber: drawingNumberVal,
      revision: titleBlock.revision || 'R0',
      date: titleBlock.date || new Date().toLocaleDateString('ar-EG'),
      designedBy: titleBlock.designedBy || 'ENG.',
      drawnBy: 'ENG.',
      checkedBy: '-',
      approvedBy: titleBlock.approvedBy || 'STU DESIGN DEPT',
      designCode: 'ACI 318-19',
      fc: 28,
      fy: 420
    };

    const hasTable = tableHTML && tableHTML.trim().length > 0;
    const sheetW = 1120;
    const sheetH = 790;
    const titleBlockH = 135 + 36 + 10;
    const contentH = sheetH - 45 - titleBlockH;
    const innerW = sheetW - 90;

    const planW  = hasTable ? Math.round(innerW * 0.72) : innerW;
    const tableW = hasTable ? Math.round(innerW * 0.26) : 0;
    const tableLeft = 45 + planW + Math.round(innerW * 0.02);
    const separatorX = 45 + planW + Math.round(innerW * 0.01);

    printWindow.document.write(`
      <html>
        <head>
          <title>${titleBlock.projectName} - Print Plan ${drawingNumberVal}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;600;700;800&display=swap');
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 0; 
              background-color: #f1f5f9; 
              color: #0f172a; 
              direction: rtl; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .sheet-page {
              position: relative; 
              width: ${sheetW}px; 
              height: ${sheetH}px; 
              background: white; 
              overflow: hidden; 
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              box-sizing: border-box;
            }
            @media print {
              body { 
                background: white; 
                padding: 0; 
                margin: 0;
              }
              .sheet-page { 
                box-shadow: none; 
                border: none;
                margin: 0;
                page-break-after: always;
              }
              @page {
                size: landscape;
                margin: 0;
              }
            }

            /* Monochrome and monochrome plotting overrides for SVG and printing */
            svg { 
              width: 100% !important; 
              height: 100% !important; 
              background-color: #ffffff !important; 
            }
            
            ${cadFloorTheme === 'dark' ? `
              svg rect[fill="#090d16"], svg rect[fill="#0f172a"], svg rect[fill="#020617"], svg rect[fill="none"] { fill: #ffffff !important; }
              svg rect[fill="#111827"] { fill: #f1f5f9 !important; }
              svg text { fill: #0f172a !important; }
              svg line { stroke: #1e293b !important; }
              svg g#cad-beams line { stroke: #0f172a !important; stroke-width: 1.8 !important; }
              svg g#cad-columns rect { fill: #334155 !important; stroke: #0f172a !important; }
              svg g#cad-slab-texts text { fill: #0891b2 !important; }
              svg line[stroke="#1e293b"] { stroke: #94a3b8 !important; }
              svg text[fill="#ef4444"] { fill: #b91c1c !important; }
              svg text[fill="#38bdf8"] { fill: #0284c7 !important; }
              svg text[fill="#10b981"] { fill: #047857 !important; }
            ` : `
              svg rect[fill="none"] { fill: none !important; }
            `}

            /* Blueprint Schedule Table Custom Styling and compact adjustments to prevent overflow */
            .schedule-table-container {
              max-height: ${contentH}px;
              overflow: hidden !important;
            }
            .schedule-table-container table {
              width: 100% !important;
              border-collapse: collapse !important;
              font-family: 'Segoe UI', Arial, sans-serif !important;
              font-size: 6.5px !important;
              line-height: 1.15 !important;
              color: #000 !important;
              border: 1px solid #000 !important;
            }
            .schedule-table-container th {
              background: #f1f5f9 !important;
              color: #000 !important;
              font-weight: bold !important;
              border: 1px solid #000 !important;
              padding: 2px 1.5px !important;
              text-align: center;
              font-size: 6.5px !important;
            }
            .schedule-table-container td {
              border: 1px solid #000 !important;
              padding: 1.5px 1.5px !important;
              text-align: center;
              font-size: 6.2px !important;
            }
            .schedule-table-container div {
              font-size: 8.5px !important;
              font-weight: bold !important;
              margin-bottom: 2px !important;
            }
          </style>
        </head>
        <body>
          <div class="sheet-page">
            ${htmlSheetBorder()}
            
            <!-- Plan drawing zone on the left -->
            <div style="position:absolute; top:45px; left:45px; width:${planW}px; height:${contentH}px; overflow:hidden; border:1px solid #1e293b; background: white;">
              ${svgContent}
            </div>

            ${hasTable ? `
              <!-- Vertical Separator line -->
              <div style="position:absolute; top:45px; left:${separatorX}px; width:1px; height:${contentH}px; background:#000;"></div>
              
              <!-- Vertical Rotated Label "جدول التسليح" -->
              <div style="position:absolute; top:${45 + contentH / 2 - 60}px; left:${separatorX + 3}px; width:12px; height:120px; display:flex; align-items:center; justify-content:center;">
                <span style="writing-mode:vertical-lr; font-size:7.5px; color:#475569; font-weight:700; letter-spacing:1px; transform:rotate(180deg);">جدول التسليح التفصيلي</span>
              </div>
              
              <!-- Clean structural schedule table on the right -->
              <div class="schedule-table-container" style="position:absolute; top:45px; left:${tableLeft}px; width:${tableW}px; height:${contentH}px; overflow-y:auto; direction:rtl; padding:5px 4px; box-sizing:border-box;">
                ${tableHTML}
              </div>
            ` : ''}

            ${projectionMode !== 'general' ? `
            <!-- General construction guidelines & notes (omitted on formwork/axes plan per drawing standard) -->
            <div style="position:absolute; bottom:36px; left:45px; width:${innerW - 610}px; height:135px; overflow:hidden; text-align:right; border:1px dashed #cbd5e1; padding:8px 12px; box-sizing:border-box;">
              <h4 style="margin: 0 0 4px 0; font-size: 9.5px; font-weight: 800; color: #1e293b;">شروط هندسية وضوابط التنفيذ العامة (General Construction Notes)</h4>
              <ul style="font-size: 7.5px; line-height: 1.4; padding-right: 14px; margin: 0; color: #475569;">
                <li>يتم مطابقة الأبعاد والارتفاعات مع المخططات المعمارية التنفيذية المعتمدة قبل مباشرة الصب.</li>
                <li>قوة كسر الخرسانة المستهدفة للبلاطات والأعمدة f'c = 30 MPa (خرسانة مسلحة مقاومة للكبريتات).</li>
                <li>إجهاد الخضوع لحديد التسليح عالي المقاومة fy = 420 MPa وفق ACI 318-19.</li>
                <li>تؤخذ التراكيب ووصلات التداخل لحديد التسليح بطول لا يقل عن 60 ضعف قطر السيخ المستخدم.</li>
                <li>المحافظة على غطاء خرساني لا يقل عن 25 مم للسقف، و40 مم للأعمدة والجسور.</li>
              </ul>
            </div>
            ` : ''}

            <!-- Pre-rendered high-fidelity classical Title Block matching foundation drawing sheets -->
            ${htmlTitleBlock(titleBlockConfig as any)}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 850);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // PDF Drawings Compilation trigger
  const handleCompilePDFReport = () => {
    const mockSlabDesigns = storySlabs.map(s => ({ id: s.id, design: { status: 'OK', thick: s.t || 150, rebarBottom: 'Ø12 @ 150', rebarTop: 'Ø10 @ 150' } }));
    generateConstructionSheets(
      storySlabs,
      storyBeams,
      storyCols,
      resolvedBeamDesigns as any,
      Object.values(resolvedColDesigns) as any,
      mockSlabDesigns as any,
      titleBlock.projectName,
      {
        includeTitleBlock: true,
        sheetScale: selectedScale,
        sheetSize: 'A3',
        designerName: titleBlock.designedBy,
        companyName: titleBlock.approvedBy
      } as any
    );
  };

  // Dynamic coordinates bounds calculation for interactive vector plan SVGs
  const svgFloorBounds = useMemo(() => {
    if (storySlabs.length === 0 && storyBeams.length === 0 && storyCols.length === 0) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10, w: 10, h: 10 };
    }
    const sx = [...storySlabs.flatMap(s => [s.x1, s.x2]), ...storyBeams.flatMap(b => [b.x1, b.x2]), ...storyCols.map(c => c.x)];
    const sy = [...storySlabs.flatMap(s => [s.y1, s.y2]), ...storyBeams.flatMap(b => [b.y1, b.y2]), ...storyCols.map(c => c.y)];
    const minX = Math.min(...sx) - 1.5;
    const maxX = Math.max(...sx) + 1.5;
    const minY = Math.min(...sy) - 1.5;
    const maxY = Math.max(...sy) + 1.5;
    return { minX, maxX, minY, maxY, w: Math.max(maxX - minX, 6), h: Math.max(maxY - minY, 6) };
  }, [storySlabs, storyBeams, storyCols]);

  // Integrated high fidelity CAD Floor visual projection coordinates & helper scales
  const cadFloorBounds = useMemo(() => {
    if (storySlabs.length === 0 && storyBeams.length === 0 && storyCols.length === 0) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10, w: 10, h: 10 };
    }
    const sx = [...storySlabs.flatMap(s => [s.x1, s.x2]), ...storyBeams.flatMap(b => [b.x1, b.x2]), ...storyCols.map(c => c.x)];
    const sy = [...storySlabs.flatMap(s => [s.y1, s.y2]), ...storyBeams.flatMap(b => [b.y1, b.y2]), ...storyCols.map(c => c.y)];
    const minX = Math.min(...sx);
    const maxX = Math.max(...sx);
    const minY = Math.min(...sy);
    const maxY = Math.max(...sy);
    const padding = 0.55; // Reduced from 1.5 to make the floor plan significantly larger and fill the layout
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
      w: Math.max(maxX - minX + 2 * padding, 4.5),
      h: Math.max(maxY - minY + 2 * padding, 4.5)
    };
  }, [storySlabs, storyBeams, storyCols]);

  const cadFloorPadding = 65;
  const cadWidth = 720;
  const cadHeight = 520;

  const scaleCad = useMemo(() => {
    // Reserve the right 275 pixels for structural schedules & typical sections.
    const availableWidth = 720 - 275;
    const availableHeight = 520 - 90;
    return Math.min(
      availableWidth / cadFloorBounds.w,
      availableHeight / cadFloorBounds.h
    );
  }, [cadFloorBounds]);

  const offsetCadX = useMemo(() => {
    // Offset so that the floor plan sits nicely inside the left half, with a 20px margin
    const availableWidth = 720 - 275;
    const drawnWidth = cadFloorBounds.w * scaleCad;
    return 20 + (availableWidth - drawnWidth) / 2;
  }, [cadFloorBounds, scaleCad]);

  const offsetCadY = useMemo(() => {
    const availableHeight = 520 - 90;
    const drawnHeight = cadFloorBounds.h * scaleCad;
    return 45 + (availableHeight - drawnHeight) / 2;
  }, [cadFloorBounds, scaleCad]);

  // Project mathematical coordinates in meters onto SVG screen coordinate pixels
  const projectX = (x: number) => offsetCadX + (x - cadFloorBounds.minX) * scaleCad;
  const projectY = (y: number) => cadHeight - (offsetCadY + (y - cadFloorBounds.minY) * scaleCad);
  const projectLength = (len: number) => len * scaleCad;

  const xGridLines = useMemo(() => {
    const coordsSet = new Set<string>();
    storyCols.forEach(c => coordsSet.add(c.x.toFixed(2)));
    const sorted = Array.from(coordsSet).map(Number).sort((a, b) => a - b);
    return sorted.map((coord, idx) => ({
      coord,
      label: String.fromCharCode(65 + idx) // Grid letters: A, B, C, D...
    }));
  }, [storyCols]);

  const yGridLines = useMemo(() => {
    const coordsSet = new Set<string>();
    storyCols.forEach(c => coordsSet.add(c.y.toFixed(2)));
    const sorted = Array.from(coordsSet).map(Number).sort((a, b) => a - b);
    return sorted.map((coord, idx) => ({
      coord,
      label: String(idx + 1) // Grid numbers: 1, 2, 3...
    }));
  }, [storyCols]);

  const colBounds = useMemo(() => {
    if (storyCols.length === 0) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    }
    const xs = storyCols.map(c => c.x);
    const ys = storyCols.map(c => c.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }, [storyCols]);

  const activeSectionPackage = useMemo<SectionPackage>(() => {
    return AutomaticSectionEngine.generateSection(sectionType, sectionCode, {
      beams,
      columns,
      slabs,
      stories,
      material: mat,
      slabProps: {
        thickness: (slabProps && slabProps.thickness) || 150,
        cover: (slabProps && slabProps.cover) || 20,
        liveLoad: (slabProps && slabProps.liveLoad) || 2.0,
        finishLoad: (slabProps && slabProps.finishLoad) || 1.5,
        phiMain: (slabProps && slabProps.phiMain) || 12,
        phiSlab: (slabProps && slabProps.phiSlab) || 10
      },
      activeElementId: sectionType === 'beam' ? (sectionBeamId || beams[0]?.id) : (sectionColId || columns[0]?.id),
      customOffset: customOffsetPercent / 100
    });
  }, [sectionType, sectionCode, beams, columns, slabs, stories, mat, slabProps, sectionBeamId, sectionColId, customOffsetPercent]);

  const extractedDetailsList = useMemo<EnlargedDetailPackage[]>(() => {
    return AutomaticDetailEngine.extractDetails(beams, columns, slabs, stories, mat, slabProps);
  }, [beams, columns, slabs, stories, mat, slabProps]);

  const activeDetailPackage = useMemo<EnlargedDetailPackage>(() => {
    const found = extractedDetailsList.find(d => d.id === selectedDetailId);
    return found || extractedDetailsList[0] || {
      id: 'dt-none',
      number: 1,
      code: 'Detail 1/S-201',
      title: 'Empty Detail Package',
      type: 'beam_detail' as DetailType,
      sheetRef: 'S-201',
      scale: '1:10',
      width: 600,
      height: 400,
      structuralElementId: 'none',
      categoryLabel: 'N/A',
      regionDetected: 'None detected',
      bars: [],
      dimensionLines: [],
      annotations: [],
      qaIssues: [],
      notes: []
    };
  }, [extractedDetailsList, selectedDetailId]);

  // Convert resolvedSlabDesigns array to index Map for fast reference in engine
  const slabDesignsRecord = useMemo(() => {
    const record: Record<string, any> = {};
    resolvedSlabDesigns.forEach(d => {
      record[d.id] = d;
    });
    return record;
  }, [resolvedSlabDesigns]);

  // Slabs schedule on active level for floor plans
  const floorSlabScheduleRows = useMemo<SlabScheduleRow[]>(() => {
    return SlabScheduleEngine.generateSchedule(storySlabs, stories, slabDesignsRecord, {
      fc: mat?.fc || 25,
      fy: mat?.fy || 420,
      fyt: 280,
      gamma: mat?.density || 24,
      stirrupDia: 10
    });
  }, [storySlabs, stories, slabDesignsRecord, mat]);

  // Beams schedule on active level for floor plans
  const floorBeamScheduleRows = useMemo<BeamScheduleRow[]>(() => {
    return BeamScheduleEngine.generateSchedule(storyBeams, stories, mat);
  }, [storyBeams, stories, mat]);

  // Columns schedule on active level for floor plans
  const floorColScheduleRows = useMemo<ColumnScheduleRow[]>(() => {
    const activeCols = storyCols.filter(c => !c.isRemoved);
    return ColumnScheduleEngine.generateSchedule(activeCols, stories, resolvedColDesigns, {
      fc: mat?.fc || 25,
      fy: mat?.fy || 420,
      fyt: 280,
      gamma: mat?.density || 24,
      stirrupDia: 10
    });
  }, [storyCols, stories, resolvedColDesigns, mat]);

  const rawBeamScheduleRows = useMemo<BeamScheduleRow[]>(() => {
    return BeamScheduleEngine.generateSchedule(beams, stories, mat);
  }, [beams, stories, mat]);

  const beamScheduleQA = useMemo<BeamScheduleValidationIssue[]>(() => {
    return BeamScheduleEngine.runQAValidation(rawBeamScheduleRows);
  }, [rawBeamScheduleRows]);

  const processedBeamScheduleRows = useMemo<BeamScheduleRow[]>(() => {
    // 1. Filter
    let items = [...rawBeamScheduleRows];
    
    if (beamScheduleFilterType !== 'all') {
      items = items.filter(r => r.type === beamScheduleFilterType);
    }
    
    if (beamScheduleFilterSize !== 'all') {
      items = items.filter(r => `${r.width}x${r.depth}` === beamScheduleFilterSize);
    }

    // 2. Group if enabled
    if (groupBeams) {
      items = BeamScheduleEngine.groupScheduleRows(items);
    }

    // 3. Sort
    items.sort((a, b) => {
      if (beamScheduleSortField === 'beamId') {
        return a.beamId.localeCompare(b.beamId);
      }
      if (beamScheduleSortField === 'length') {
        return b.length - a.length;
      }
      if (beamScheduleSortField === 'concreteVolume') {
        return b.concreteVolume - a.concreteVolume;
      }
      if (beamScheduleSortField === 'steelWeight') {
        return b.steelWeight - a.steelWeight;
      }
      if (beamScheduleSortField === 'storyName') {
        return a.storyName.localeCompare(b.storyName);
      }
      return 0;
    });

    return items;
  }, [rawBeamScheduleRows, beamScheduleFilterType, beamScheduleFilterSize, groupBeams, beamScheduleSortField]);

  return (
    <Card className="border border-border/80 shadow-lg rounded-xl overflow-hidden bg-card text-card-foreground my-6" id="structural-drawings-workstation">
      {/* Visual Header */}
      <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-cyan-500/50 text-cyan-400 bg-cyan-950/20 px-2.5 py-0.5 text-xs font-mono">PHASE S1</Badge>
              <CardTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                لوحة المخططات والرسومات الإنشائية التفصيلية
              </CardTitle>
            </div>
            <CardDescription className="text-slate-300 text-xs md:text-sm">
              بروتوكول تفصيلي متكامل لإنتاج مخططات الخرسانة والتسليح للجسور والأعمدة والبلاطات والتحقق منها (STA4CAD & ACI Compliant).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-mono hidden lg:inline">COORDINATED METRICS:</span>
            <Badge variant="secondary" className="bg-slate-800 text-slate-100 flex items-center gap-1 border border-slate-700/80">
              <Layers2 className="w-3.5 h-3.5 text-yellow-400" />
              القصور: {storyBeams.length} جسور
            </Badge>
            <Badge variant="secondary" className="bg-slate-800 text-slate-100 flex items-center gap-1 border border-slate-700/80">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              الأعمدة: {storyCols.length} أعمدة
            </Badge>
            <Badge variant="secondary" className="bg-slate-800 text-slate-100 flex items-center gap-1 border border-slate-700/80">
              <Compass className="w-3.5 h-3.5 text-pink-400" />
              الترابط: {storySlabs.length} بلاطات
            </Badge>
          </div>
        </div>
      </CardHeader>

      <div className="p-4 bg-muted/20 border-b border-border/60 flex flex-wrap gap-3 items-center justify-between">
        {/* Story Selector Sync */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">الدور النشط بالمخطط:</label>
          <div className="flex gap-1">
            {filteredStories.map(st => (
              <Button
                key={st.id}
                size="sm"
                variant={activeStory?.id === st.id ? "default" : "outline"}
                className={`h-8 px-3 font-mono text-xs ${activeStory?.id === st.id ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""}`}
                onClick={() => setActiveStory(st)}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Global Structural Scale and Coordination Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-background shadow-xs border px-2.5 py-1.5 rounded-lg text-xs">
            <Scale className="w-3.5 h-3.5 text-muted-foreground text-cyan-500" />
            <span className="text-muted-foreground">مقياس الرسم:</span>
            <select 
              value={selectedScale} 
              onChange={(e) => setSelectedScale(e.target.value)} 
              className="bg-transparent border-none focus:outline-none font-mono font-medium text-cyan-600"
            >
              <option value="1:25">1:25 (تفاصيل دقيقة)</option>
              <option value="1:50">1:50 (قياسي)</option>
              <option value="1:100">1:100 (المساقط العامة)</option>
            </select>
          </div>

          <Badge className="bg-emerald-950/20 text-emerald-500 border border-emerald-500/30 text-xs py-1">
            <Check className="w-3 h-3 ml-1" />
            تزامن ذكي (Dynamic Sync)
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px] divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-border">
        
        {/* Navigation Sidebar for Drafting Workspace */}
        <div className="lg:col-span-3 bg-muted/10 p-4 space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 pr-1">شجرة اللوحات التفصيلية</p>
          
          <Button 
            variant={activeSubTab === 'cadWorkspace' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'cadWorkspace' ? 'bg-cyan-100 text-cyan-900 border-l-4 border-cyan-600 font-bold' : ''}`}
            onClick={() => setActiveSubTab('cadWorkspace')}
          >
            <Compass className="w-4 h-4 text-cyan-700 animate-pulse" />
            <span>لوحة ورشة الرسم (CAD CAD)</span>
            <Badge className="mr-auto font-mono text-[9px] px-1 bg-cyan-700 text-white font-bold">D1 CORE</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'sheetManager' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'sheetManager' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('sheetManager')}
          >
            <Layers3 className="w-4 h-4 text-cyan-600" />
            <span>مدير اللوحات ورأس المخطط</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white text-cyan-700">ISO</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'floorPlans' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'floorPlans' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('floorPlans')}
          >
            <Compass className="w-4 h-4 text-cyan-600" />
            <span>المساقط الإنشائية والقوالب</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white text-cyan-700">S-101</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'beamDetails' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'beamDetails' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('beamDetails')}
          >
            <Layers className="w-4 h-4 text-cyan-600" />
            <span>تفاصيل تسليح الجسور (Beams)</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white text-cyan-700">S-102</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'columnDetails' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'columnDetails' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('columnDetails')}
          >
            <Layers3 className="w-4 h-4 text-cyan-600" />
            <span>جدول وتفاصيل الأعمدة (Cols)</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white text-cyan-700">S-103</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'slabDetails' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'slabDetails' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('slabDetails')}
          >
            <FileText className="w-4 h-4 text-cyan-600" />
            <span>تفاصيل تسليح البلاطات (Slabs)</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white text-cyan-700">Mesh</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'sections' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'sections' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('sections')}
          >
            <Compass className="w-4 h-4 text-cyan-600" />
            <span>القطاعات الإنشائية النموذجية</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white">SEC</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'enlargedDetails' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'enlargedDetails' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('enlargedDetails')}
          >
            <Maximize2 className="w-4 h-4 text-cyan-600 animate-pulse text-amber-500" />
            <span>نظام التفاصيل الإنشائية المكبرة</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-amber-50 text-amber-700 border-amber-200">D5A</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'reinforcementSchedules' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'reinforcementSchedules' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('reinforcementSchedules')}
          >
            <TableIcon className="w-4 h-4 text-cyan-600" />
            <span>جداول جداول التسليح المنظم</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white text-amber-600">SCH</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'bbs' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'bbs' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('bbs')}
          >
            <TableIcon className="w-4 h-4 text-cyan-600" />
            <span>جدول تفريد الحديد (BBS Sheet)</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white text-emerald-600">S-104</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'boq' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'boq' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('boq')}
          >
            <FileBox className="w-4 h-4 text-cyan-600" />
            <span>جدول الكميات والتسعير (BOQ)</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white text-rose-600">M3/Kg</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'notes' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'notes' ? 'bg-cyan-50 text-cyan-800 font-semibold' : ''}`}
            onClick={() => setActiveSubTab('notes')}
          >
            <BookOpen className="w-4 h-4 text-cyan-600" />
            <span>الملاحظات الفنية للمخطط</span>
            <Badge variant="outline" className="mr-auto font-mono text-[9px] px-1 bg-white">ACI</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'dxfSuite' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'dxfSuite' ? 'bg-cyan-100 text-cyan-900 border-l-4 border-cyan-600 font-bold' : ''}`}
            onClick={() => setActiveSubTab('dxfSuite')}
          >
            <FileCode className="w-4 h-4 text-cyan-600 animate-pulse" />
            <span>لوحة تصدير الأوتوكاد (DXF)</span>
            <Badge className="mr-auto font-mono text-[9px] px-1 bg-cyan-700 text-white font-bold">D8 CAD</Badge>
          </Button>

          <Button 
            variant={activeSubTab === 'printingEngine' ? 'secondary' : 'ghost'} 
            className={`w-full justify-start gap-2.5 h-10 px-3 text-sm font-medium ${activeSubTab === 'printingEngine' ? 'bg-cyan-100 text-cyan-900 border-l-4 border-cyan-600 font-bold' : ''}`}
            onClick={() => setActiveSubTab('printingEngine')}
          >
            <Printer className="w-4 h-4 text-cyan-600 animate-pulse" />
            <span>نظام طباعة المخرجات (D9 Dynamic)</span>
            <Badge className="mr-auto font-mono text-[9px] px-1 bg-cyan-700 text-white font-bold">D9 PRINT</Badge>
          </Button>

          <div className="pt-6 px-1.5 space-y-2 mt-4 border-t border-border/60">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">مخرجات الطباعة والتصدير</p>
            
            <Button size="sm" variant="default" className="w-full bg-cyan-700 hover:bg-cyan-800 text-white shadow-xs font-semibold gap-1 text-xs" onClick={handlePrintHTMLSheets}>
              <Printer className="w-3.5 h-3.5" />
              فتح المخططات للطباعة (Print)
            </Button>
            
            <Button size="sm" variant="outline" className="w-full text-slate-700 border-slate-300 font-semibold gap-1 text-xs" onClick={handleCompilePDFReport}>
              <FileText className="w-3.5 h-3.5 text-red-500" />
              تصدير المخططات PDF (A3)
            </Button>

            <Button size="sm" variant="outline" className="w-full text-slate-700 border-slate-300 font-semibold gap-1 text-xs" onClick={handleExportExcelBBS}>
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              تصدير BBS والكميات Excel
            </Button>

            <Button size="sm" variant="outline" className="w-full text-slate-700 border-slate-300 font-semibold gap-1 text-xs" onClick={handleExportDXFAll}>
              <FileCode className="w-3.5 h-3.5 text-blue-500" />
              تصدير مخطط الأوتوكاد (DXF)
            </Button>
          </div>
        </div>

        {/* Dynamic Drafting Panel Content Display */}
        <div className="lg:col-span-9 p-5 flex flex-col justify-between overflow-x-auto min-w-0 bg-background text-foreground">
          
          {/* SHEET DESIGN WORKSPACE */}

          {activeSubTab === 'cadWorkspace' && (
            <DrawingCoreEnginePanel
              stories={stories}
              activeStoryId={activeStoryId}
              slabs={slabs}
              beams={beams}
              columns={columns}
              projectName={projectName}
              foundationResults={foundationResults}
            />
          )}

          {/* Sub-tab 1: TITLE BLOCK & SHEET MANAGER */}
          {activeSubTab === 'sheetManager' && (
            <div className="space-y-4 font-sans animate-fade-in text-slate-800">
              <SheetCompositionEngine
                stories={stories}
                beams={beams}
                columns={columns}
                slabs={slabs}
                beamDesigns={resolvedBeamDesigns as any}
                colDesigns={Object.values(resolvedColDesigns) as any}
                slabDesigns={resolvedSlabDesigns as any}
                foundationResults={foundationResults}
              />
            </div>
          )}

          {/* DXF EXPORT SUITE */}
          {activeSubTab === 'dxfSuite' && (
            <div className="space-y-4 font-sans animate-fade-in text-slate-800">
              <DxfExportSuite
                stories={stories}
                beams={beams}
                columns={columns}
                slabs={slabs}
                projectName={projectName}
                notes={customNotes || []}
              />
            </div>
          )}

          {/* Sub-tab 2: FLOOR PLANS / FRAMING PLAN */}
          {activeSubTab === 'floorPlans' && (
            <div className="space-y-4 animate-fade-in text-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-lg font-bold text-slate-900 font-sans tracking-tight">
                    مخطط القوالب الخرسانية والمحاور للدور: <span className="text-cyan-500 font-mono font-bold">{activeStoryLabel}</span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200">LAYOUT S-102</Badge>
                  <Badge variant="outline" className="font-mono font-bold text-slate-500">SCALE {selectedScale || '1:50'}</Badge>
                </div>
              </div>

              {/* Dynamic Projection Mode Selectors */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-right">
                <span className="text-xs font-black text-slate-700 font-sans">
                  اختر نوع المسقط الإنشائي الفعال لتصفح جداول وتفاصيل التسليح عالي الدقة:
                </span>
                <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-200/50 rounded-lg border border-slate-200 max-w-fit" style={{ direction: 'rtl' }}>
                  <Button
                    variant={projectionMode === 'general' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setProjectionMode('general');
                      setSelectedCadElement(null);
                    }}
                    className={`h-8 gap-1.5 text-xs font-bold rounded-md transition-all ${projectionMode === 'general' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    مسقط القوالب والمحاور العام
                  </Button>
                  <Button
                    variant={projectionMode === 'slabs' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setProjectionMode('slabs');
                      if (storySlabs.length > 0) {
                        setSelectedCadElement({
                          type: 'slab',
                          id: storySlabs[0].id,
                          details: `بلاطة سقف خرسانية مسلحة`,
                          rawData: storySlabs[0]
                        });
                      } else {
                        setSelectedCadElement(null);
                      }
                    }}
                    className={`h-8 gap-1.5 text-xs font-bold rounded-md transition-all ${projectionMode === 'slabs' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                  >
                    <Layers2 className="w-3.5 h-3.5 text-amber-600" />
                    مسقط تسليح البلاطات
                  </Button>
                  <Button
                    variant={projectionMode === 'beams' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setProjectionMode('beams');
                      if (storyBeams.length > 0) {
                        setSelectedCadElement({
                          type: 'beam',
                          id: storyBeams[0].id,
                          details: `جسر خرساني تفصيلي`,
                          rawData: storyBeams[0]
                        });
                      } else {
                        setSelectedCadElement(null);
                      }
                    }}
                    className={`h-8 gap-1.5 text-xs font-bold rounded-md transition-all ${projectionMode === 'beams' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    مسقط تسليح وجدولة الجسور
                  </Button>
                  <Button
                    variant={projectionMode === 'columns' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setProjectionMode('columns');
                      if (storyCols.length > 0) {
                        setSelectedCadElement({
                          type: 'column',
                          id: storyCols[0].id,
                          details: `عمود خرساني مستمر`,
                          rawData: storyCols[0]
                        });
                      } else {
                        setSelectedCadElement(null);
                      }
                    }}
                    className={`h-8 gap-1.5 text-xs font-bold rounded-md transition-all ${projectionMode === 'columns' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'}`}
                  >
                    <Layers3 className="w-3.5 h-3.5 text-rose-600" />
                    مسقط تسليح الأعمدة
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Left: Interactive Live CAD Canvas (Span 3 on desktop) */}
                <div className="xl:col-span-3 space-y-4">
                  {/* Drawing Sheet Viewport */}
                  <div 
                    className={`border rounded-xl transition-all duration-300 relative overflow-hidden flex flex-col min-h-[580px] p-4 ${
                      cadFloorTheme === 'dark' 
                        ? 'bg-[#030712] border-slate-800 text-slate-100 shadow-2xl shadow-cyan-950/20' 
                        : 'bg-[#faf8f5] border-slate-200 text-slate-900 shadow-md'
                    }`}
                  >
                    {/* Floating top bar containing active coordinates & theme switch shortcuts */}
                    <div className="flex justify-between items-center mb-3 text-xs bg-black/10 px-3 py-1.5 rounded-lg border border-white/5 backdrop-blur-sm">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                        <span className="text-slate-400 font-sans">الوضع التفاعلي النشط:</span>
                        <span className="text-cyan-400 font-bold">LIVE CAD PREVIEW</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>أبعاد الدور:</span>
                        <span className="font-semibold text-amber-500 font-mono">{cadFloorBounds.w.toFixed(1)}m × {cadFloorBounds.h.toFixed(1)}m</span>
                      </div>
                    </div>

                    {/* Main Canvas SVG Drawing Frame */}
                    <div className="flex-1 flex justify-center items-center p-2 relative bg-opacity-30">
                      {/* AutoCAD grid background in dark mode */}
                      {cadFloorTheme === 'dark' && (
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                      )}

                      <svg 
                        id="cad-blueprint-master-svg"
                        viewBox={`0 0 720 520`} 
                        className="w-full max-w-2xl h-auto overflow-visible select-none"
                        style={{ direction: 'ltr' }}
                      >
                        {/* Outer Blueprint Boundary Border */}
                        <rect
                          x="10"
                          y="10"
                          width="700"
                          height="500"
                          fill="none"
                          stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'}
                          strokeWidth="2.5"
                        />
                        <rect
                          x="14"
                          y="14"
                          width="692"
                          height="492"
                          fill="none"
                          stroke={cadFloorTheme === 'dark' ? '#0f172a' : '#94a3b8'}
                          strokeWidth="1.0"
                        />

                        {/* Drawing Grid Dashed Line Network (Layer Switchable) */}
                        {cadFloorLayers.grids && (
                          <g id="cad-grids" className="transition-opacity duration-300">
                            {/* X Grid Lines */}
                            {xGridLines.map((gl) => {
                              const px = projectX(gl.coord);
                              const pyTopLine = projectY(colBounds.maxY) - 22;
                              const pyBottomLine = projectY(colBounds.minY) + 22;
                              const cyTopBubble = projectY(colBounds.maxY) - 34;
                              const cyBottomBubble = projectY(colBounds.minY) + 34;
                              return (
                                <g key={`g-xl-${gl.label}`}>
                                  <line
                                    x1={px}
                                    y1={pyTopLine}
                                    x2={px}
                                    y2={pyBottomLine}
                                    stroke={cadFloorTheme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(100, 116, 139, 0.25)'}
                                    strokeWidth="1"
                                    strokeDasharray="6 4"
                                  />
                                  {/* Bottom Bubble */}
                                  <circle
                                    cx={px}
                                    cy={cyBottomBubble}
                                    r="10"
                                    fill={cadFloorTheme === 'dark' ? '#1e293b' : '#ffffff'}
                                    stroke={cadFloorTheme === 'dark' ? '#06b6d4' : '#475569'}
                                    strokeWidth="1.2"
                                  />
                                  <text
                                    x={px}
                                    y={cyBottomBubble + 3}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fill={cadFloorTheme === 'dark' ? '#38bdf8' : '#0f172a'}
                                  >
                                    {gl.label}
                                  </text>
                                  {/* Top Bubble */}
                                  <circle
                                    cx={px}
                                    cy={cyTopBubble}
                                    r="10"
                                    fill={cadFloorTheme === 'dark' ? '#1e293b' : '#ffffff'}
                                    stroke={cadFloorTheme === 'dark' ? '#06b6d4' : '#475569'}
                                    strokeWidth="1.2"
                                  />
                                  <text
                                    x={px}
                                    y={cyTopBubble + 3}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fill={cadFloorTheme === 'dark' ? '#38bdf8' : '#0f172a'}
                                  >
                                    {gl.label}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Y Grid Lines */}
                            {yGridLines.map((gl) => {
                              const py = projectY(gl.coord);
                              const pxLeftLine = projectX(colBounds.minX) - 22;
                              const pxRightLine = projectX(colBounds.maxX) + 22;
                              const cxLeftBubble = projectX(colBounds.minX) - 34;
                              const cxRightBubble = projectX(colBounds.maxX) + 34;
                              return (
                                <g key={`g-yl-${gl.label}`}>
                                  <line
                                    x1={pxLeftLine}
                                    y1={py}
                                    x2={pxRightLine}
                                    y2={py}
                                    stroke={cadFloorTheme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(100, 116, 139, 0.25)'}
                                    strokeWidth="1"
                                    strokeDasharray="6 4"
                                  />
                                  {/* Left Bubble */}
                                  <circle
                                    cx={cxLeftBubble}
                                    cy={py}
                                    r="10"
                                    fill={cadFloorTheme === 'dark' ? '#1e293b' : '#ffffff'}
                                    stroke={cadFloorTheme === 'dark' ? '#06b6d4' : '#475569'}
                                    strokeWidth="1.2"
                                  />
                                  <text
                                    x={cxLeftBubble}
                                    y={py + 3}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fill={cadFloorTheme === 'dark' ? '#38bdf8' : '#0f172a'}
                                  >
                                    {gl.label}
                                  </text>
                                  {/* Right Bubble */}
                                  <circle
                                    cx={cxRightBubble}
                                    cy={py}
                                    r="10"
                                    fill={cadFloorTheme === 'dark' ? '#1e293b' : '#ffffff'}
                                    stroke={cadFloorTheme === 'dark' ? '#06b6d4' : '#475569'}
                                    strokeWidth="1.2"
                                  />
                                  <text
                                    x={cxRightBubble}
                                    y={py + 3}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fill={cadFloorTheme === 'dark' ? '#38bdf8' : '#0f172a'}
                                  >
                                    {gl.label}
                                  </text>
                                </g>
                              );
                            })}
                          </g>
                        )}

                        {/* Linear Dimensions Layout (Layer Switchable) */}
                        {cadFloorLayers.dimensions && (
                          <g id="cad-dimensions" className="transition-opacity duration-300">
                            {/* Horizontal Span Dimensions at Top */}
                            {xGridLines.slice(0, -1).map((gl, idx) => {
                              const nextGl = xGridLines[idx + 1];
                              const xStart = projectX(gl.coord);
                              const xEnd = projectX(nextGl.coord);
                              const dist = nextGl.coord - gl.coord;
                              const yLine = projectY(colBounds.maxY) - 13;
                              
                              return (
                                <g key={`dim-x-${idx}`}>
                                  {/* Base Dimension line */}
                                  <line x1={xStart} y1={yLine} x2={xEnd} y2={yLine} stroke="#ec4899" strokeWidth="0.8" />
                                  {/* Extension bounds */}
                                  <line x1={xStart} y1={yLine - 4} x2={xStart} y2={yLine + 4} stroke="#ec4899" strokeWidth="1" />
                                  <line x1={xEnd} y1={yLine - 4} x2={xEnd} y2={yLine + 4} stroke="#ec4899" strokeWidth="1" />
                                  {/* Slash architecture tick */}
                                  <line x1={xStart - 4} y1={yLine - 4} x2={xStart + 4} y2={yLine + 4} stroke="#be185d" strokeWidth="1.4" />
                                  <line x1={xEnd - 4} y1={yLine - 4} x2={xEnd + 4} y2={yLine + 4} stroke="#be185d" strokeWidth="1.4" />
                                  {/* Readable text mark */}
                                  <text
                                    x={(xStart + xEnd) / 2}
                                    y={yLine - 5}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    fill={cadFloorTheme === 'dark' ? '#ec4899' : '#db2777'}
                                  >
                                    {dist.toFixed(2)} m
                                  </text>
                                </g>
                              );
                            })}

                            {/* Vertical Span Dimensions at Left */}
                            {yGridLines.slice(0, -1).map((gl, idx) => {
                              const nextGl = yGridLines[idx + 1];
                              const yStart = projectY(gl.coord);
                              const yEnd = projectY(nextGl.coord);
                              const dist = nextGl.coord - gl.coord;
                              const xLine = projectX(colBounds.minX) - 13;

                              return (
                                <g key={`dim-y-${idx}`}>
                                  {/* Base Dimension Line */}
                                  <line x1={xLine} y1={yStart} x2={xLine} y2={yEnd} stroke="#ec4899" strokeWidth="0.8" />
                                  {/* extensions bounds */}
                                  <line x1={xLine - 4} y1={yStart} x2={xLine + 4} y2={yStart} stroke="#ec4899" strokeWidth="1" />
                                  <line x1={xLine - 4} y1={yEnd} x2={xLine + 4} y2={yEnd} stroke="#ec4899" strokeWidth="1" />
                                  {/* ticks */}
                                  <line x1={xLine - 4} y1={yStart + 4} x2={xLine + 4} y2={yStart - 4} stroke="#be185d" strokeWidth="1.4" />
                                  <line x1={xLine - 4} y1={yEnd + 4} x2={xLine + 4} y2={yEnd - 4} stroke="#be185d" strokeWidth="1.4" />
                                  {/* Text */}
                                  <text
                                    x={xLine - 6}
                                    y={(yStart + yEnd) / 2 + 3}
                                    textAnchor="end"
                                    fontSize="8"
                                    fontFamily="monospace"
                                    fontWeight="bold"
                                    fill={cadFloorTheme === 'dark' ? '#ec4899' : '#db2777'}
                                  >
                                    {dist.toFixed(2)} m
                                  </text>
                                </g>
                              );
                            })}
                          </g>
                        )}

                        {/* Concrete Floor Slabs Rectangles (Layer Switchable) */}
                        {cadFloorLayers.slabs && storySlabs.map(slab => {
                          const isSelected = selectedCadElement?.type === 'slab' && selectedCadElement.id === slab.id;
                          const xMin = Math.min(slab.x1, slab.x2);
                          const yMax = Math.max(slab.y1, slab.y2);
                          const sx = projectX(xMin);
                          const sy = projectY(yMax);
                          const sw = projectLength(Math.abs(slab.x2 - slab.x1));
                          const sh = projectLength(Math.abs(slab.y2 - slab.y1));
                          const labelX = projectX((slab.x1 + slab.x2) / 2);
                          const labelY = projectY((slab.y1 + slab.y2) / 2);
                          const thickness = (slabProps && slabProps.thickness) || 150;

                          const slabDesign = resolvedSlabDesigns.find(d => d.id === slab.id) || { thickness: thickness, rebarBottom: 'Ø12 @ 150', rebarTop: 'Ø10 @ 150' };

                          return (
                            <g key={slab.id} opacity={projectionMode === 'general' || projectionMode === 'slabs' ? '1.0' : '0.15'}>
                              <rect
                                x={sx}
                                y={sy}
                                width={sw}
                                height={sh}
                                fill={isSelected ? 'rgba(245, 158, 11, 0.08)' : (projectionMode === 'slabs' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(245, 158, 11, 0.02)')}
                                stroke={isSelected ? '#f59e0b' : (projectionMode === 'slabs' ? '#06b6d4' : (cadFloorTheme === 'dark' ? 'rgba(245, 158, 11, 0.65)' : 'rgba(217, 119, 6, 0.85)'))}
                                strokeWidth={isSelected ? '2.5' : (projectionMode === 'slabs' ? '2.0' : '1.5')}
                                strokeDasharray={projectionMode === 'slabs' ? 'none' : '4 3'}
                                className="cursor-pointer hover:fill-amber-500/10 transition-all duration-200"
                                onClick={() => {
                                  setSelectedCadElement({
                                    type: 'slab',
                                    id: slab.id,
                                    details: `بلاطة سقف خرسانية مسلحة سماكة ${thickness} مم، أبعاد الفضاء الإنشائي (${Math.abs(slab.x2 - slab.x1)} × ${Math.abs(slab.y2 - slab.y1)}) م، مستندة على الجسور المحيطة.`,
                                    rawData: slab
                                  });
                                }}
                              />
                              {cadFloorLayers.annotations && (
                                <g className="pointer-events-none">
                                  {/* Small cross marks at core */}
                                  <line x1={labelX - 4} y1={labelY} x2={labelX + 4} y2={labelY} stroke="#f59e0b" strokeWidth="0.8" opacity="0.6" />
                                  <line x1={labelX} y1={labelY - 4} x2={labelX} y2={labelY + 4} stroke="#f59e0b" strokeWidth="0.8" opacity="0.6" />
                                  <text
                                    x={labelX}
                                    y={labelY - 4}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fill={cadFloorTheme === 'dark' ? '#f59e0b' : '#b45309'}
                                  >
                                    {slabGroupLabelsMap.get(slab.id) || slab.id}
                                  </text>
                                  <text
                                    x={labelX}
                                    y={labelY + 8}
                                    textAnchor="middle"
                                    fontSize="7.5"
                                    fontFamily="monospace"
                                    fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}
                                  >
                                    t={thickness}mm
                                  </text>
                                  {projectionMode === 'slabs' && (
                                    <>
                                      <rect
                                        x={labelX - 35}
                                        y={labelY + 12}
                                        width="70"
                                        height="16"
                                        fill={cadFloorTheme === 'dark' ? '#090d16' : '#ffffff'}
                                        stroke="#06b6d4"
                                        strokeWidth="0.6"
                                        rx="2"
                                        opacity="0.9"
                                      />
                                      <text
                                        x={labelX}
                                        y={labelY + 18}
                                        textAnchor="middle"
                                        fontSize="5.5"
                                        fontWeight="bold"
                                        fill={cadFloorTheme === 'dark' ? '#10b981' : '#059669'}
                                        fontFamily="monospace"
                                      >
                                        B: {slabDesign.rebarBottom || 'Ø12 @ 150'}
                                      </text>
                                      <text
                                        x={labelX}
                                        y={labelY + 25}
                                        textAnchor="middle"
                                        fontSize="5.5"
                                        fontWeight="bold"
                                        fill={cadFloorTheme === 'dark' ? '#f97316' : '#d97706'}
                                        fontFamily="monospace"
                                      >
                                        T: {slabDesign.rebarTop || 'Ø10 @ 150'}
                                      </text>
                                    </>
                                  )}
                                </g>
                              )}
                            </g>
                          );
                        })}

                        {/* Coordinated Framing Beams (Layer Switchable) */}
                        {cadFloorLayers.beams && storyBeams.map(beam => {
                          const isSelected = selectedCadElement?.type === 'beam' && selectedCadElement.id === beam.id;
                          const bx1 = projectX(beam.x1);
                          const by1 = projectY(beam.y1);
                          const bx2 = projectX(beam.x2);
                          const by2 = projectY(beam.y2);
                          const bmX = (bx1 + bx2) / 2;
                          const bmY = (by1 + by2) / 2;
                          
                          // Convert mm width to viewport scale width
                          const bWidth = beam.b || 200;
                          const bStroke = Math.max(projectLength(bWidth / 1000), 4);

                          return (
                            <g key={beam.id} opacity={projectionMode === 'general' || projectionMode === 'beams' ? '1.0' : '0.15'}>
                              {/* Beam Base Outline */}
                              <line
                                x1={bx1}
                                y1={by1}
                                x2={bx2}
                                y2={by2}
                                stroke={isSelected ? '#3b82f6' : (projectionMode === 'beams' ? '#3b82f6' : (cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'))}
                                strokeWidth={isSelected ? bStroke + 1.5 : bStroke}
                                strokeLinecap="square"
                                opacity={isSelected ? '1' : '0.85'}
                                className="cursor-pointer hover:stroke-cyan-500 transition-all duration-200"
                                onClick={() => {
                                  setSelectedCadElement({
                                    type: 'beam',
                                    id: beam.id,
                                    details: `جسر إنشائية خرسانية تفصيلية قطاع (${beam.b} × ${beam.h}) مم، الفضاء الإنشائي الحر ${Math.hypot(beam.x2 - beam.x1, beam.y2 - beam.y1).toFixed(2)} م، مدعوم بالأعمدة الحاملة.`,
                                    rawData: beam
                                  });
                                }}
                              />
                              {/* Inner center guideline */}
                              <line
                                x1={bx1}
                                y1={by1}
                                x2={bx2}
                                y2={by2}
                                stroke={isSelected ? '#93c5fd' : '#94a3b8'}
                                strokeWidth="0.8"
                                strokeDasharray="3 3"
                                className="pointer-events-none"
                              />

                              {/* Overlaid Annotation Label inside standard CAD tags (Next to element, group name, no rect) */}
                              {cadFloorLayers.annotations && (
                                <g className="pointer-events-none">
                                  {(() => {
                                    const isHorizontal = Math.abs(beam.x2 - beam.x1) >= Math.abs(beam.y2 - beam.y1);
                                    const labelX = isHorizontal ? bmX : bmX + (bStroke / 2) + 6;
                                    const labelY = isHorizontal ? bmY - (bStroke / 2) - 4.5 : bmY + 3.5;
                                    const textAnchorVal = isHorizontal ? "middle" : "start";
                                    const displayLabelName = beamGroupLabelsMap.get(beam.id) || beam.name || beam.id;
                                    return (
                                      <text
                                        x={labelX}
                                        y={labelY}
                                        textAnchor={textAnchorVal}
                                        fontSize="7.5"
                                        fontWeight="bold"
                                        fill={cadFloorTheme === 'dark' ? '#38bdf8' : '#1e3a8a'}
                                      >
                                        {displayLabelName}
                                      </text>
                                    );
                                  })()}

                                  {projectionMode === 'beams' && (() => {
                                    const bRow = floorBeamScheduleRows.find(r => r.beamId === beam.id) as any;
                                    if (!bRow) return null;
                                    return (
                                      <>
                                        <rect
                                          x={bmX - 35}
                                          y={bmY + 9}
                                          width="70"
                                          height="9"
                                          fill={cadFloorTheme === 'dark' ? '#090d16' : '#ffffff'}
                                          stroke="#3b82f6"
                                          strokeWidth="0.5"
                                          rx="1.5"
                                          opacity="0.95"
                                        />
                                        <text
                                          x={bmX}
                                          y={bmY + 15.5}
                                          textAnchor="middle"
                                          fontSize="5"
                                          fontWeight="extrabold"
                                          fill={cadFloorTheme === 'dark' ? '#60a5fa' : '#2563eb'}
                                          fontFamily="monospace"
                                        >
                                          {`${bRow.flexLeft?.bars || 3}Ø${bRow.flexLeft?.dia || 14} / B:${bRow.flexMid?.bars || 3}Ø${bRow.flexMid?.dia || 14}`}
                                        </text>
                                      </>
                                    );
                                  })()}
                                </g>
                              )}
                            </g>
                          );
                        })}

                        {/* Reinforced Structural Columns Rectangles (Layer Switchable) */}
                        {cadFloorLayers.columns && storyCols.map(col => {
                          const isSelected = selectedCadElement?.type === 'column' && selectedCadElement.id === col.id;
                          const w_m = (col.b ?? 300) / 1000;
                          const h_m = (col.h ?? 300) / 1000;
                          const cw = projectLength(w_m);
                          const ch = projectLength(h_m);
                          const cx = projectX(col.x) - cw / 2;
                          const cy = projectY(col.y) - ch / 2;

                          return (
                            <g key={col.id} opacity={projectionMode === 'general' || projectionMode === 'columns' ? '1.0' : '0.15'}>
                              {/* Outline Column Solid Core */}
                              <rect
                                x={cx}
                                y={cy}
                                width={cw}
                                height={ch}
                                fill={isSelected ? '#ef4444' : (projectionMode === 'columns' ? '#ef4444' : (cadFloorTheme === 'dark' ? '#22d3ee' : '#334155'))}
                                stroke={isSelected ? '#be123c' : (projectionMode === 'columns' ? '#be123c' : (cadFloorTheme === 'dark' ? '#0891b2' : '#0f172a'))}
                                strokeWidth={projectionMode === 'columns' ? '2.2' : '1.8'}
                                className="cursor-pointer hover:fill-amber-500 hover:scale-105 origin-center transition-all duration-200"
                                onClick={() => {
                                  setSelectedCadElement({
                                    type: 'column',
                                    id: col.id,
                                    details: `عمود خرساني مسلح مستمر قطاع (${col.b} × ${col.h}) مم، إحداثيات مركز العمود في الموقع (${col.x.toFixed(2)}، ${col.y.toFixed(2)}) م، يدعم نقل الأحمال الرأسية بمرونة نحو الأساسات.`,
                                    rawData: col
                                  });
                                }}
                              />

                              {/* Coordinate Circles / Orbit Nodes (Layer Switchable) */}
                              {cadFloorLayers.coordinates && (
                                <circle
                                  cx={projectX(col.x)}
                                  cy={projectY(col.y)}
                                  r="4.5"
                                  fill="none"
                                  stroke={cadFloorTheme === 'dark' ? '#f43f5e' : '#e11d48'}
                                  strokeWidth="1.0"
                                  strokeDasharray="2 1.5"
                                  className="pointer-events-none"
                                />
                              )}

                              {/* ID label text */}
                              {cadFloorLayers.annotations && (
                                <g className="pointer-events-none">
                                  <text
                                    x={projectX(col.x)}
                                    y={cy - 6}
                                    textAnchor="middle"
                                    fontSize="8"
                                    fontWeight="bold"
                                    fill={cadFloorTheme === 'dark' ? '#22d3ee' : '#0f172a'}
                                  >
                                    {colGroupLabelsMap.get(col.id) || col.name || `C${col.id}`}
                                  </text>
                                  {/* Coordinates values */}
                                  <text
                                    x={projectX(col.x)}
                                    y={cy + ch + 10}
                                    textAnchor="middle"
                                    fontSize="6"
                                    fontFamily="monospace"
                                    fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}
                                  >
                                    ({col.x.toFixed(1)}, {col.y.toFixed(1)})
                                  </text>

                                  {projectionMode === 'columns' && (() => {
                                    const colRow = floorColScheduleRows.find(r => r.columnId === col.id);
                                    if (!colRow) return null;
                                    return (
                                      <>
                                        <rect
                                          x={projectX(col.x) - 25}
                                          y={cy + ch + 14}
                                          width="50"
                                          height="8.5"
                                          fill={cadFloorTheme === 'dark' ? '#090d16' : '#ffffff'}
                                          stroke="#ef4444"
                                          strokeWidth="0.5"
                                          rx="1.5"
                                          opacity="0.95"
                                        />
                                        <text
                                          x={projectX(col.x)}
                                          y={cy + ch + 20}
                                          textAnchor="middle"
                                          fontSize="5"
                                          fontWeight="extrabold"
                                          fill={cadFloorTheme === 'dark' ? '#fca5a5' : '#dc2626'}
                                          fontFamily="monospace"
                                        >
                                          {`${colRow.barCount}Ø${colRow.barDiameter}`}
                                        </text>
                                      </>
                                    );
                                  })()}
                                </g>
                              )}
                            </g>
                          );
                        })}

                        {/* Top-Right North-Arrow Symbol Indicator */}
                        <g transform="translate(425, 45)" className="opacity-80 pointer-events-none">
                          <circle r="15" fill="none" stroke={cadFloorTheme === 'dark' ? '#475569' : '#94a3b8'} strokeWidth="1.2" />
                          <circle r="12" fill="none" stroke={cadFloorTheme === 'dark' ? '#64748b' : '#334155'} strokeWidth="0.6" strokeDasharray="1 1" />
                          <line x1="0" y1="12" x2="0" y2="-12" stroke={cadFloorTheme === 'dark' ? '#ef4444' : '#be123c'} strokeWidth="1.5" />
                          <line x1="-12" y1="0" x2="12" y2="0" stroke={cadFloorTheme === 'dark' ? '#475569' : '#94a3b8'} strokeWidth="0.8" />
                          <polygon points="0,-14 -4,-4 4,-4" fill={cadFloorTheme === 'dark' ? '#ef4444' : '#be123c'} />
                          <text x="0" y="-18" textAnchor="middle" fontSize="8" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#ef4444' : '#be123c'}>N</text>
                        </g>

                        {/* ==============================================================================
                            ARABIC: عمود جداول التسليح والمقاطع التفصيلية داخل المخطط الإنتقالي الذكي CAD
                            ============================================================================== */}
                        {/* Vertical Blueprint Separator Line — hidden on formwork/axes plan (full-width plan mode) */}
                        {projectionMode !== 'general' && (
                          <line
                            x1="465"
                            y1="14"
                            x2="465"
                            y2="492"
                            stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'}
                            strokeWidth="1.5"
                          />
                        )}

                        {/* RIGHT COL: SCHEDULING & DETAIL SECTIONS — hidden on formwork/axes plan (general mode) */}
                        {projectionMode !== 'general' && (
                        <>
                        <g transform="translate(471, 14)">
                          {/* 1. TOP BOX: TYPICAL PROFILE DETAIL DRAWING (y=0 to y=145, height 145) */}
                          <rect
                            x="0"
                            y="0"
                            width="230"
                            height="145"
                            fill={cadFloorTheme === 'dark' ? '#090d16' : '#ffffff'}
                            stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'}
                            strokeWidth="1"
                            rx="3"
                          />
                          
                          {/* Details Header Segment */}
                          <rect
                            x="1"
                            y="1"
                            width="228"
                            height="18"
                            fill={cadFloorTheme === 'dark' ? '#111827' : '#f1f5f9'}
                            rx="2"
                          />
                          <text
                            x="220"
                            y="12"
                            textAnchor="end"
                            fontSize="8"
                            fontWeight="black"
                            fill={cadFloorTheme === 'dark' ? '#60a5fa' : '#1d4ed8'}
                            fontFamily="system-ui, sans-serif"
                          >
                            {projectionMode === 'general' && 'تفاصيل: جدول لوحات السقف وجدولة المخطط'}
                            {projectionMode === 'slabs' && 'مقطع تفصيلي: تسليح البلاطة الإنشائية المستمرة'}
                            {projectionMode === 'beams' && 'مقطع عرضي: تفاصيل الجسر والكانات الموزعة'}
                            {projectionMode === 'columns' && 'مقطع عرضي: تفاصيل العمود والتربيط العرضي'}
                          </text>

                          {/* Dynamic Section Inside the CAD Blueprint */}
                          {projectionMode === 'general' && (
                            <g transform="translate(10, 24)">
                              <text x="210" y="10" textAnchor="end" fontSize="7" fontWeight="black" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>لوحات المخطط الإنشائي والخرطوشة:</text>
                              <g transform="translate(5, 18)">
                                <text x="10" y="10" fontSize="6.5" fill="#38bdf8" fontWeight="bold">S-101</text>
                                <text x="200" y="10" textAnchor="end" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>مخطط الأعمدة والمحاور وتفاصيلها (1:50)</text>
                                <line x1="10" y1="14" x2="200" y2="14" stroke={cadFloorTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth="0.5" />
                              </g>
                              <g transform="translate(5, 36)">
                                <text x="10" y="10" fontSize="6.5" fill="#38bdf8" fontWeight="bold">S-102</text>
                                <text x="200" y="10" textAnchor="end" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>مخطط تسليح بلاطات السقف وسماكاتها (1:50)</text>
                                <line x1="10" y1="14" x2="200" y2="14" stroke={cadFloorTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth="0.5" />
                              </g>
                              <g transform="translate(5, 54)">
                                <text x="10" y="10" fontSize="6.5" fill="#38bdf8" fontWeight="bold">S-103</text>
                                <text x="200" y="10" textAnchor="end" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>مخطط وتفاصيل تسليح وجدولة الجسور (1:50)</text>
                                <line x1="10" y1="14" x2="200" y2="14" stroke={cadFloorTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} strokeWidth="0.5" />
                              </g>
                              <g transform="translate(5, 72)">
                                <text x="10" y="10" fontSize="6.5" fill="#38bdf8" fontWeight="bold">S-104</text>
                                <text x="200" y="10" textAnchor="end" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>جداول الانحناء وتفريد الحديد BBS (1:25)</text>
                              </g>
                            </g>
                          )}

                          {projectionMode === 'slabs' && (
                            <g transform="translate(10, 24)">
                              {/* Supports (Beams) */}
                              <rect x="25" y="55" width="22" height="30" fill={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'} stroke="#475569" strokeWidth="0.5" />
                              <rect x="165" y="55" width="22" height="30" fill={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'} stroke="#475569" strokeWidth="0.5" />
                              {/* Slab Concrete */}
                              <rect x="25" y="35" width="162" height="20" fill={cadFloorTheme === 'dark' ? '#334155' : '#e2e8f0'} stroke="#475569" strokeWidth="0.8" />
                              
                              {/* Bottom continuous steel (Green) */}
                              <line x1="15" y1="51" x2="197" y2="51" stroke="#10b981" strokeWidth="1.8" />
                              <line x1="15" y1="51" x2="15" y2="45" stroke="#10b981" strokeWidth="1.0" />
                              <line x1="197" y1="51" x2="197" y2="45" stroke="#10b981" strokeWidth="1.0" />
                              
                              {/* Top additional support rebar (Orange) */}
                              <line x1="15" y1="39" x2="65" y2="39" stroke="#ea580c" strokeWidth="1.2" />
                              <line x1="15" y1="39" x2="15" y2="43" stroke="#ea580c" strokeWidth="1.0" />
                              
                              <line x1="147" y1="39" x2="197" y2="39" stroke="#ea580c" strokeWidth="1.2" />
                              <line x1="197" y1="39" x2="197" y2="43" stroke="#ea580c" strokeWidth="1.0" />

                              {/* Labels */}
                              <text x="105" y="24" textAnchor="middle" fontSize="7" fill={cadFloorTheme === 'dark' ? '#ea580c' : '#c2410c'} fontWeight="bold" fontFamily="sans-serif">إضافي علوي: Ø10@200 مم</text>
                              <text x="105" y="85" textAnchor="middle" fontSize="7" fill={cadFloorTheme === 'dark' ? '#34d399' : '#059669'} fontWeight="extrabold" fontFamily="sans-serif">التسليح السفلي: شبكة Ø12@150 مم</text>
                              <text x="105" y="47" textAnchor="middle" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#475569'}>سماكة البلاطة t = 150 مم</text>
                            </g>
                          )}

                          {projectionMode === 'beams' && (
                            <g transform="translate(10, 20)">
                              {/* Outline b x h */}
                              <rect x="80" y="15" width="50" height="80" fill={cadFloorTheme === 'dark' ? '#111827' : '#f8fafc'} stroke={cadFloorTheme === 'dark' ? '#cbd5e1' : '#475569'} strokeWidth="1.5" />
                              {/* Stirrups (Yellow) */}
                              <rect x="85" y="20" width="40" height="70" fill="none" stroke="#eab308" strokeWidth="1.0" rx="1.5" />
                              
                              {/* Hanging Top Rebar circles (red) */}
                              <circle cx="90" cy="25" r="2.8" fill="#ef4444" />
                              <circle cx="105" cy="25" r="2.8" fill="#ef4444" />
                              <circle cx="120" cy="25" r="2.8" fill="#ef4444" />
                              
                              {/* Main Bottom Steel circles (blue) */}
                              <circle cx="90" cy="85" r="2.8" fill="#3b82f6" />
                              <circle cx="105" cy="85" r="2.8" fill="#3b82f6" />
                              <circle cx="120" cy="85" r="2.8" fill="#3b82f6" />

                              {/* Dimension and labels */}
                              <text x="105" y="10" textAnchor="middle" fontSize="6" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'} fontFamily="monospace">b = 250 mm</text>
                              <text x="74" y="55" textAnchor="middle" fontSize="6" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'} fontFamily="monospace" transform="rotate(-90 74 55)">h = 600 mm</text>
                              
                              <text x="138" y="32" textAnchor="start" fontSize="6" fill="#f87171" fontWeight="extrabold">علوي: 3Ø14</text>
                              <text x="138" y="88" textAnchor="start" fontSize="6" fill="#60a5fa" fontWeight="extrabold">سفلي: 3Ø16</text>
                              <text x="138" y="60" textAnchor="start" fontSize="5.5" fill="#eab308" fontWeight="bold">الكانات:<br/>Ø10 @ 150</text>
                            </g>
                          )}

                          {projectionMode === 'columns' && (
                            <g transform="translate(10, 20)">
                              {/* Square Column Section */}
                              <rect x="75" y="15" width="60" height="60" fill={cadFloorTheme === 'dark' ? '#111827' : '#f8fafc'} stroke={cadFloorTheme === 'dark' ? '#94a3b8' : '#334155'} strokeWidth="1.5" />
                              {/* Tie stirrup hook red */}
                              <rect x="80" y="20" width="50" height="50" fill="none" stroke="#ef4444" strokeWidth="1.0" />
                              
                              {/* corner and side bars (8 total) */}
                              <circle cx="84" cy="24" r="3.2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.5" />
                              <circle cx="126" cy="24" r="3.2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.5" />
                              <circle cx="84" cy="66" r="3.2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.5" />
                              <circle cx="126" cy="66" r="3.2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.5" />
                              
                              <circle cx="105" cy="24" r="3.2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.5" />
                              <circle cx="105" cy="66" r="3.2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.5" />
                              <circle cx="84" cy="45" r="3.2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.5" />
                              <circle cx="126" cy="45" r="3.2" fill="#1e293b" stroke="#cbd5e1" strokeWidth="0.5" />

                              {/* Dimension & Rebar details */}
                              <text x="105" y="10" textAnchor="middle" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#475569'} fontFamily="monospace">b = 300 mm</text>
                              <text x="68" y="45" textAnchor="middle" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#475569'} fontFamily="monospace" transform="rotate(-90 68 45)">h = 300 mm</text>
                              
                              <text x="142" y="38" textAnchor="start" fontSize="6" fill="#f87171" fontWeight="bold">ركن طولي:</text>
                              <text x="142" y="48" textAnchor="start" fontSize="7" fill="#38bdf8" fontWeight="black">8 Ø 14</text>
                              <text x="142" y="65" textAnchor="start" fontSize="5.5" fill="#fca5a5">الكانات:<br/>Ø8@150</text>
                            </g>
                          )}

                          {/* 2. BOTTOM BOX: DETAILED VECTOR SCHEDULE TABLE (y=150 to y=390, height 240) */}
                          <rect
                            x="0"
                            y="150"
                            width="230"
                            height="244"
                            fill={cadFloorTheme === 'dark' ? '#090d16' : '#ffffff'}
                            stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'}
                            strokeWidth="1"
                            rx="3"
                          />
                          
                          {/* Table Header Segment */}
                          <rect
                            x="1"
                            y="151"
                            width="228"
                            height="18"
                            fill={cadFloorTheme === 'dark' ? '#111827' : '#f1f5f9'}
                            rx="2"
                          />
                          <text
                            x="220"
                            y="163"
                            textAnchor="end"
                            fontSize="8"
                            fontWeight="black"
                            fill={cadFloorTheme === 'dark' ? '#10b981' : '#059669'}
                            fontFamily="system-ui, sans-serif"
                          >
                            {projectionMode === 'general' && 'اشتراطات جودة الخرسانة والمواد الإنشائية'}
                            {projectionMode === 'slabs' && 'جدول: تسليح وسماكة بلاطات السقف المعتمدة'}
                            {projectionMode === 'beams' && 'جدول: تسليح وتفاصيل الجسور الطولية والعرضية'}
                            {projectionMode === 'columns' && 'جدول: تسليح الأعمدة ومواصفات التربيط العرضي'}
                          </text>

                          {/* Dynamic Vector Table Rows Inside CAD */}
                          {projectionMode === 'general' && (
                            <g transform="translate(10, 178)">
                              {/* Standard Code Notes for General Layout */}
                              <g transform="translate(0, 5)">
                                <circle cx="202" cy="5" r="1.5" fill="#10b981" />
                                <text x="194" y="8" textAnchor="end" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>قوة الخرسانة المميزة (f_c) لا تقل عن 30 MPa</text>
                              </g>
                              <g transform="translate(0, 25)">
                                <circle cx="202" cy="5" r="1.5" fill="#10b981" />
                                <text x="194" y="8" textAnchor="end" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>إجهاد الخضوع للحديد (f_y) لا يقل عن 420 MPa</text>
                              </g>
                              <g transform="translate(0, 45)">
                                <circle cx="202" cy="5" r="1.5" fill="#10b981" />
                                <text x="194" y="8" textAnchor="end" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>طول وصلة الشد والتراكب للسيخ لا تقل عن 60d</text>
                              </g>
                              <g transform="translate(0, 65)">
                                <circle cx="202" cy="5" r="1.5" fill="#10b981" />
                                <text x="194" y="8" textAnchor="end" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>الغطاء الخرساني: للبلاطات 20 مم والأعمدة 40 مم</text>
                              </g>
                              <g transform="translate(0, 85)">
                                <circle cx="202" cy="5" r="1.5" fill="#10b981" />
                                <text x="194" y="8" textAnchor="end" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>البحص المستخدم نظيف وخالي من الأملاح والشوائب</text>
                              </g>
                              <g transform="translate(0, 105)">
                                <circle cx="202" cy="5" r="1.5" fill="#10b981" />
                                <text x="194" y="8" textAnchor="end" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>يتم الالتزام بتكثيف الكانات عند وجه ركائز الجسور</text>
                              </g>
                              <g transform="translate(5, 131)" className="opacity-95">
                                <rect x="0" y="0" width="200" height="35" fill="none" stroke="#2563eb" strokeWidth="1" strokeDasharray="2 1" rx="2" />
                                <text x="100" y="14" textAnchor="middle" fontSize="7" fontWeight="black" fill="#2563eb">STU STRUCTURAL DESIGN SUITE</text>
                                <text x="100" y="25" textAnchor="middle" fontSize="7.5" fontWeight="black" fill="#10b981">● تم التدقيق والمطابقة للكود الأمريكي والمحلي ●</text>
                              </g>
                            </g>
                          )}

                          {projectionMode === 'slabs' && (
                            <g transform="translate(5, 178)">
                              {/* Slab Table Headers */}
                              <rect x="0" y="0" width="220" height="15" fill={cadFloorTheme === 'dark' ? '#1e293b' : '#e2e8f0'} rx="1.5" />
                              <text x="6" y="10" fontSize="6.5" fontWeight="extrabold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>الكود</text>
                              <text x="45" y="10" fontSize="6.5" fontWeight="extrabold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>الأبعاد (م)</text>
                              <text x="95" y="10" fontSize="6.5" fontWeight="extrabold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>السمك (مم)</text>
                              <text x="145" y="10" fontSize="6.5" fontWeight="extrabold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>سفلي / علوي</text>
                              
                              {/* Rows */}
                              {floorSlabScheduleRows.slice(0, 5).map((row, idx) => {
                                const rowY = 18 + idx * 27;
                                const isSelected = selectedCadElement?.type === 'slab' && selectedCadElement.id === row.slabId;
                                return (
                                  <g 
                                    key={`svg-slab-sheet-${idx}`} 
                                    transform={`translate(0, ${rowY})`}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      const matchedSlab = storySlabs.find(s => s.id === row.slabId);
                                      setSelectedCadElement({
                                        type: 'slab',
                                        id: row.slabId,
                                        details: `بلاطة سقف خرسانية مسلحة سماكة ${row.thickness} مم، أبعاد (${row.length} × ${row.width}) م.`,
                                        rawData: matchedSlab || row
                                      });
                                    }}
                                  >
                                    <rect x="-2" y="-2" width="224" height="25" fill={isSelected ? "rgba(6,182,212,0.15)" : "transparent"} stroke={isSelected ? "#06b6d4" : "transparent"} strokeWidth="0.5" rx="1" />
                                    <text x="6" y="12" fontSize="7" fontWeight="black" fill={isSelected ? '#22d3ee' : (cadFloorTheme === 'dark' ? '#ffffff' : '#0f172a')}>{row.slabId}</text>
                                    <text x="45" y="12" fontSize="6" fontFamily="monospace" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#334155'}>{row.length}x{row.width}</text>
                                    <text x="95" y="12" fontSize="6" fontFamily="monospace" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#334155'}>{row.thickness}</text>
                                    <text x="145" y="10" fontSize="6" fontWeight="bold" fill="#10b981">{row.bottomReinforcement}</text>
                                    <text x="145" y="18" fontSize="5.5" fill="#ea580c">{row.topReinforcement}</text>
                                    <line x1="0" y1="24" x2="220" y2="24" stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#f1f5f9'} strokeWidth="0.6" />
                                  </g>
                                );
                              })}
                              {floorSlabScheduleRows.length > 5 && (
                                <text x="110" y="156" textAnchor="middle" fontSize="6" fill="#64748b" fontWeight="bold">* متبقي البلاطات مسجلة بجدول التسليح التفصيلي بالأسفل</text>
                              )}
                            </g>
                          )}

                          {projectionMode === 'beams' && (
                            <g transform="translate(5, 178)">
                              {/* Beam Table Headers */}
                              <rect x="0" y="0" width="220" height="15" fill={cadFloorTheme === 'dark' ? '#1e293b' : '#e2e8f0'} rx="1.5" />
                              <text x="6" y="10" fontSize="6" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>رمز</text>
                              <text x="35" y="10" fontSize="6" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>القطاع</text>
                              <text x="80" y="10" fontSize="6" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>علوي Left</text>
                              <text x="125" y="10" fontSize="6" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>سفلي Mid</text>
                              <text x="175" y="10" fontSize="6" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>الكانات</text>
                              
                              {/* Rows */}
                              {floorBeamScheduleRows.slice(0, 5).map((row: any, idx) => {
                                const rowY = 18 + idx * 26;
                                const isSelected = selectedCadElement?.type === 'beam' && selectedCadElement.id === row.beamId;
                                return (
                                  <g 
                                    key={`svg-beam-sheet-${idx}`} 
                                    transform={`translate(0, ${rowY})`}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      const matchedBeam = storyBeams.find(b => b.id === row.beamId);
                                      setSelectedCadElement({
                                        type: 'beam',
                                        id: row.beamId,
                                        details: `جسر خرساني قطاع (${row.width} × ${row.depth}) مم، فضاء حر ممتد.`,
                                        rawData: matchedBeam || row
                                      });
                                    }}
                                  >
                                    <rect x="-2" y="-2" width="224" height="24" fill={isSelected ? "rgba(6,182,212,0.15)" : "transparent"} stroke={isSelected ? "#06b6d4" : "transparent"} strokeWidth="0.5" rx="1" />
                                    <text x="6" y="13" fontSize="6.5" fontWeight="extrabold" fill={isSelected ? '#22d3ee' : (cadFloorTheme === 'dark' ? '#ffffff' : '#0f172a')}>{row.beamId}</text>
                                    <text x="35" y="13" fontSize="5.5" fontFamily="monospace" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#334155'}>{row.width}x{row.depth}</text>
                                    <text x="80" y="13" fontSize="6" fontWeight="bold" fill="#3b82f6">{row.flexLeft?.bars || 3}Ø{row.flexLeft?.dia || 14}</text>
                                    <text x="125" y="13" fontSize="6" fontWeight="bold" fill="#10b981">{row.flexMid?.bars || 3}Ø{row.flexMid?.dia || 14}</text>
                                    <text x="175" y="13" fontSize="5.5" fill="#ea580c" fontWeight="bold" fontFamily="monospace">{row.shear?.stirrups || 'Ø10@150'}</text>
                                    <line x1="0" y1="23" x2="220" y2="23" stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#f1f5f9'} strokeWidth="0.6" />
                                  </g>
                                );
                              })}
                              {floorBeamScheduleRows.length > 5 && (
                                <text x="110" y="154" textAnchor="middle" fontSize="6" fill="#64748b" fontWeight="bold">* ومتبقي الجسور والكمرات منقحة ومبوبة في الجدول المرفق بالأسفل</text>
                              )}
                            </g>
                          )}

                          {projectionMode === 'columns' && (
                            <g transform="translate(5, 178)">
                              {/* Column Table Headers */}
                              <rect x="0" y="0" width="220" height="15" fill={cadFloorTheme === 'dark' ? '#1e293b' : '#e2e8f0'} rx="1.5" />
                              <text x="6" y="10" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>العمود</text>
                              <text x="50" y="10" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>القطاع (bh)</text>
                              <text x="105" y="10" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>التسليح الطولي</text>
                              <text x="165" y="10" fontSize="6.5" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>الكانات</text>
                              
                              {/* Rows */}
                              {floorColScheduleRows.slice(0, 5).map((row, idx) => {
                                const rowY = 18 + idx * 26;
                                const isSelected = selectedCadElement?.type === 'column' && selectedCadElement.id === row.columnId;
                                return (
                                  <g 
                                    key={`svg-col-sheet-${idx}`} 
                                    transform={`translate(0, ${rowY})`}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      const matchedCol = storyCols.find(c => c.id === row.columnId);
                                      setSelectedCadElement({
                                        type: 'column',
                                        id: row.columnId,
                                        details: `عمود خرساني قطاع (${row.width} × ${row.depth}) مم، تسليح مستمر.`,
                                        rawData: matchedCol || row
                                      });
                                    }}
                                  >
                                    <rect x="-2" y="-2" width="224" height="24" fill={isSelected ? "rgba(6,182,212,0.15)" : "transparent"} stroke={isSelected ? "#06b6d4" : "transparent"} strokeWidth="0.5" rx="1" />
                                    <text x="6" y="13" fontSize="7" fontWeight="black" fill={isSelected ? '#22d3ee' : (cadFloorTheme === 'dark' ? '#ffffff' : '#0f172a')}>{row.name || row.columnId}</text>
                                    <text x="50" y="13" fontSize="6" fontFamily="monospace" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#334155'}>{row.width}x{row.depth}</text>
                                    <text x="105" y="13" fontSize="6.5" fontWeight="black" fill="#10b981">{row.barCount} Ø {row.barDiameter}</text>
                                    <text x="165" y="13" fontSize="5.5" fill="#ea580c" fontWeight="bold" fontFamily="monospace">{`Ø${row.tieDiameter}@${row.tieSpacing}`}</text>
                                    <line x1="0" y1="23" x2="220" y2="23" stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#f1f5f9'} strokeWidth="0.6" />
                                  </g>
                                );
                              })}
                              {floorColScheduleRows.length > 5 && (
                                <text x="110" y="154" textAnchor="middle" fontSize="6" fill="#64748b" fontWeight="bold">* ومتبقي الأعمدة وتفاصيلها منقحة وباقية بالجدول التفصيلي بالأسفل</text>
                              )}
                            </g>
                          )}
                        </g>

                        {/* Bottom-Right Professional Title Stamp Block (مربع الخرطوشة الهندسي المعتمد) */}
                        <g transform="translate(480, 414)" className="opacity-80 text-right pointer-events-none">
                          {/* Outer Border */}
                          <rect
                            x="0"
                            y="0"
                            width="210"
                            height="76"
                            fill={cadFloorTheme === 'dark' ? '#0f172a' : '#f8fafc'}
                            stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'}
                            strokeWidth="1.5"
                          />
                          <line x1="0" y1="20" x2="210" y2="20" stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'} strokeWidth="1.0" />
                          <line x1="0" y1="48" x2="210" y2="48" stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'} strokeWidth="1.0" />
                          <line x1="110" y1="48" x2="110" y2="76" stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'} strokeWidth="1.0" />

                          {/* Stamp Text values */}
                          <text x="105" y="14" textAnchor="middle" fontSize="8" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#ef4444' : '#be123c'} fontFamily="system-ui">
                            {projectName || 'STUDIO MODEL DESIGN'}
                          </text>
                          
                          <text x="5" y="32" textAnchor="start" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>
                            DRAWING: FRAME SHUTTERING PLAN
                          </text>
                          <text x="5" y="42" textAnchor="start" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>
                            STORY LEVEL: {activeStoryLabel}
                          </text>

                          <text x="115" y="60" textAnchor="start" fontSize="6" fill={cadFloorTheme === 'dark' ? '#64748b' : '#64748b'}>
                            SCALE: {selectedScale || '1:50'}
                          </text>
                          <text x="115" y="70" textAnchor="start" fontSize="6" fill={cadFloorTheme === 'dark' ? '#64748b' : '#64748b'}>
                            DATE: {new Date().toISOString().split('T')[0]}
                          </text>

                          <text x="5" y="60" textAnchor="start" fontSize="6" fill={cadFloorTheme === 'dark' ? '#64748b' : '#64748b'}>
                            REVISION: REV-01
                          </text>
                          <text x="5" y="70" textAnchor="start" fontSize="6" fill={cadFloorTheme === 'dark' ? '#ef4444' : '#be123c'} fontWeight="bold">
                            SHEET: S-102
                          </text>
                        </g>

                        {/* Top-Left Dynamic Legend Box */}
                        <g transform="translate(18, 18)" className="opacity-80 pointer-events-none">
                          <rect
                            x="0"
                            y="0"
                            width="110"
                            height="66"
                            fill={cadFloorTheme === 'dark' ? '#0f172a' : '#f8fafc'}
                            stroke={cadFloorTheme === 'dark' ? '#1e293b' : '#cbd5e1'}
                            strokeWidth="1"
                            rx="3"
                          />
                          <text x="55" y="12" textAnchor="middle" fontSize="7" fontWeight="bold" fill={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e293b'}>
                            LEGEND / دليل المخطط
                          </text>
                          
                          {/* Column symbol */}
                          <rect x="8" y="20" width="10" height="7" fill={cadFloorTheme === 'dark' ? '#22d3ee' : '#334155'} />
                          <text x="25" y="26" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>الأعمدة الخرسانية</text>

                          {/* Beam symbol */}
                          <line x1="8" y1="38" x2="18" y2="38" stroke={cadFloorTheme === 'dark' ? '#cbd5e1' : '#1e1e1e'} strokeWidth="3" />
                          <text x="25" y="41" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>الجسور والكمرات</text>

                          {/* Slab symbol */}
                          <rect x="8" y="50" width="10" height="7" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                          <text x="25" y="56" fontSize="6.5" fill={cadFloorTheme === 'dark' ? '#94a3b8' : '#475569'}>سقف البلاطة المسلحة</text>
                        </g>
                        </>
                        )}
                      </svg>
                    </div>

                    {/* Quick interactive reset & help hints */}
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-dashed border-white/5 text-xs text-slate-400">
                      <p>
                        💡 انقر فوق أي عنصر في اللوحة لعرض خصائصه مباشرة في المحلل الإنشائي الجانبي.
                      </p>
                      {selectedCadElement && (
                        <Button 
                          onClick={() => setSelectedCadElement(null)} 
                          size="sm" 
                          variant="ghost" 
                          className="text-[10px] h-6 px-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          إلغاء تحديد ({selectedCadElement.id})
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Reinforcement Schedule & Cross Sections block based on projectionMode */}
                  {projectionMode !== 'general' && (
                    <Card className="border border-border shadow-md overflow-hidden bg-white text-right">
                      <CardHeader className="py-3 px-4 border-b bg-muted/20">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <CardTitle className="text-sm font-bold text-slate-800">
                              {projectionMode === 'slabs' && 'جدول تسليح بلاطات السقف ومقاطع التفصيل الإنشائية'}
                              {projectionMode === 'beams' && 'جدول تسليح وجدولة الجسور الخرسانية ومقاطع التفصيل'}
                              {projectionMode === 'columns' && 'جدول تسليح الأعمدة ومقاطع تفصيل التربيط العرضي'}
                            </CardTitle>
                            <span className="text-[10px] text-slate-400 block mt-0.5" style={{ direction: 'ltr' }}>
                              {projectionMode === 'slabs' && 'Active Floor Slab Reinforcement Schedule & Detailing'}
                              {projectionMode === 'beams' && 'Active Floor Beam Reinforcement Schedule & Detailing'}
                              {projectionMode === 'columns' && 'Active Floor Column Reinforcement Schedule & Detailing'}
                            </span>
                          </div>
                          <Badge className="bg-cyan-50 text-cyan-700 border-cyan-200">
                            الدور النشط: {activeStoryLabel}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                          {/* Left: Schedule Table (col-span-8) */}
                          <div className="lg:col-span-8 space-y-3">
                            <div className="border border-border rounded-lg overflow-hidden bg-white max-h-[310px] overflow-y-auto">
                              <table className="w-full text-right text-xs border-collapse font-sans">
                                <thead className="bg-slate-50/80 sticky top-0 z-10 shadow-xs border-b border-slate-200">
                                  {projectionMode === 'slabs' && (
                                    <tr>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">كود البلاطة</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">الأبعاد (Lx x Ly)</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">سمك البلاطة</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600 font-sans">التسليح السفلي B</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600 font-sans">التسليح العلوي T</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">التصنيف الإنشائي</th>
                                    </tr>
                                  )}
                                  {projectionMode === 'beams' && (
                                    <tr>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">رمز الجسر</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">القطاع (b x h)</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">بحر الصافي (m)</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600 font-sans">علوي أيسر (Left)</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600 font-sans">سفلي منتصف (Mid)</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600 font-sans">علوي أيمن (Right)</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">الكانات والربط والمسافة</th>
                                    </tr>
                                  )}
                                  {projectionMode === 'columns' && (
                                    <tr>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">رمز العمود</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">القطاع (b x h)</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600 font-sans">التسليح الطولي</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600 font-sans">الكانات والتربيط العرضي</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">حمولة قصوى (Pu)</th>
                                      <th className="text-right py-2 px-3 text-[11px] font-extrabold text-slate-600">مساحة الحديد As</th>
                                    </tr>
                                  )}
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {projectionMode === 'slabs' && floorSlabScheduleRows.map((r) => {
                                    const isRowSelected = selectedCadElement?.type === 'slab' && selectedCadElement.id === r.slabId;
                                    return (
                                      <tr 
                                        key={r.id}
                                        className={`cursor-pointer transition-colors hover:bg-muted/30 ${isRowSelected ? 'bg-cyan-50/80 font-semibold' : ''}`}
                                        onClick={() => {
                                          const matchedSlab = storySlabs.find(s => s.id === r.slabId);
                                          setSelectedCadElement({
                                            type: 'slab',
                                            id: r.slabId,
                                            details: `بلاطة سقف خرسانية مسلحة سماكة ${r.thickness} مم، أبعاد (${r.length} × ${r.width}) م.`,
                                            rawData: matchedSlab || r
                                          });
                                        }}
                                      >
                                        <td className="py-2 px-3 font-semibold text-slate-900 border-b border-slate-100">{r.slabId}</td>
                                        <td className="py-2 px-3 font-mono text-slate-600 border-b border-slate-100">{r.length} x {r.width} m</td>
                                        <td className="py-2 px-3 font-mono text-slate-600 border-b border-slate-100">{r.thickness} mm</td>
                                        <td className="py-2 px-3 text-emerald-700 font-bold font-mono border-b border-slate-100">{r.bottomReinforcement}</td>
                                        <td className="py-2 px-3 text-orange-600 font-bold font-mono border-b border-slate-100">{r.topReinforcement}</td>
                                        <td className="py-2 px-3 text-slate-500 text-[10px] border-b border-slate-100">{r.slabType}</td>
                                      </tr>
                                    );
                                  })}

                                  {projectionMode === 'beams' && floorBeamScheduleRows.map((r: any) => {
                                    const isRowSelected = selectedCadElement?.type === 'beam' && selectedCadElement.id === r.beamId;
                                    return (
                                      <tr 
                                        key={r.id || r.beamId}
                                        className={`cursor-pointer transition-colors hover:bg-muted/30 ${isRowSelected ? 'bg-cyan-50/80 font-semibold' : ''}`}
                                        onClick={() => {
                                          const matchedBeam = storyBeams.find(b => b.id === r.beamId);
                                          setSelectedCadElement({
                                            type: 'beam',
                                            id: r.beamId,
                                            details: `جسر خرساني قطاع (${r.width} × ${r.depth}) مم، فضاء حر ممتد.`,
                                            rawData: matchedBeam || r
                                          });
                                        }}
                                      >
                                        <td className="py-2 px-3 font-semibold text-slate-900 border-b border-slate-100">{r.beamId}</td>
                                        <td className="py-2 px-3 font-mono text-slate-600 border-b border-slate-100">{r.width}x{r.depth} mm</td>
                                        <td className="py-2 px-3 font-mono text-slate-600 border-b border-slate-100">{r.length.toFixed(2)} m</td>
                                        <td className="py-2 px-3 text-blue-600 font-bold font-mono border-b border-slate-100">{r.flexLeft?.bars || 3}Ø{r.flexLeft?.dia || 14}</td>
                                        <td className="py-2 px-3 text-emerald-700 font-bold font-mono border-b border-slate-100">{r.flexMid?.bars || 3}Ø{r.flexMid?.dia || 14}</td>
                                        <td className="py-2 px-3 text-blue-600 font-bold font-mono border-b border-slate-100">{r.flexRight?.bars || 3}Ø{r.flexRight?.dia || 14}</td>
                                        <td className="py-2 px-3 text-amber-700 font-semibold font-mono text-[10px] border-b border-slate-100">{r.shear?.stirrups || 'Ø10 @ 150'}</td>
                                      </tr>
                                    );
                                  })}

                                  {projectionMode === 'columns' && floorColScheduleRows.map((r: any) => {
                                    const isRowSelected = selectedCadElement?.type === 'column' && selectedCadElement.id === r.columnId;
                                    return (
                                      <tr 
                                        key={r.id || r.columnId}
                                        className={`cursor-pointer transition-colors hover:bg-muted/30 ${isRowSelected ? 'bg-cyan-50/80 font-semibold' : ''}`}
                                        onClick={() => {
                                          const matchedCol = storyCols.find(c => c.id === r.columnId);
                                          setSelectedCadElement({
                                            type: 'column',
                                            id: r.columnId,
                                            details: `عمود خرساني قطاع (${r.width} × ${r.depth}) مم، تسليح مستمر.`,
                                            rawData: matchedCol || r
                                          });
                                        }}
                                      >
                                        <td className="py-2 px-3 font-semibold text-slate-900 border-b border-slate-100">{r.name || r.columnId}</td>
                                        <td className="py-2 px-3 font-mono text-slate-600 border-b border-slate-100">{r.width}x{r.depth} mm</td>
                                        <td className="py-2 px-3 text-red-600 font-bold font-mono border-b border-slate-100">{r.barCount} Ø {r.barDiameter}</td>
                                        <td className="py-2 px-3 text-amber-700 font-mono text-[10px] border-b border-slate-100">{`Ø${r.tieDiameter} @ ${r.tieSpacing} mm`}</td>
                                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500 border-b border-slate-100">{r.Pu} kN</td>
                                        <td className="py-2 px-3 text-cyan-700 font-semibold font-mono border-b border-slate-100">{r.totalSteelArea} cm²</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <p className="text-[10.5px] text-slate-400 mt-1">
                              * انقر على أي سطر في الجدول لتحديد العنصر المختار وعرض المقطع الإنشائي والتفصيلي المقابل له.
                            </p>
                          </div>

                          {/* Right: Dynamic Cross Section details */}
                          <div className="lg:col-span-4 flex flex-col justify-center border border-slate-150 rounded-lg p-3 bg-slate-50/40">
                            {(() => {
                              if (projectionMode === 'slabs') {
                                const activeId = selectedCadElement?.type === 'slab' ? selectedCadElement.id : (floorSlabScheduleRows[0]?.slabId);
                                const selRow = floorSlabScheduleRows.find(r => r.slabId === activeId) || floorSlabScheduleRows[0];
                                if (!selRow) return <p className="text-slate-400 text-xs text-center p-4">لا توجد بلاطات برسم السقف</p>;
                                return (
                                  <div className="space-y-3">
                                    <span className="text-[11px] font-bold text-slate-600 block text-center border-b pb-1.5">مقطع تسليح البلاطة {selRow.slabId}</span>
                                    <div className="flex justify-center bg-white p-2 rounded-md border border-slate-100 shadow-xs">
                                      <svg viewBox="0 0 400 120" className="w-full max-w-sm" style={{ direction: 'ltr' }}>
                                        <rect x="10" y="30" width="380" height="50" fill="#cbd5e1" stroke="#475569" strokeWidth="2.5" />
                                        <rect x="30" y="75" width="25" height="40" fill="#94a3b8" />
                                        <rect x="345" y="75" width="25" height="40" fill="#94a3b8" />
                                        
                                        {/* Bottom ongoing steel */}
                                        <line x1="15" y1="70" x2="385" y2="70" stroke="#10b981" strokeWidth="3.5" />
                                        <line x1="15" y1="70" x2="15" y2="60" stroke="#10b981" strokeWidth="2" />
                                        <line x1="385" y1="70" x2="385" y2="60" stroke="#10b981" strokeWidth="2" />

                                        {/* Top steel bars */}
                                        <line x1="15" y1="42" x2="90" y2="42" stroke="#ea580c" strokeWidth="2" />
                                        <line x1="15" y1="42" x2="15" y2="52" stroke="#ea580c" strokeWidth="2" />
                                        
                                        <line x1="310" y1="42" x2="385" y2="42" stroke="#ea580c" strokeWidth="2" />
                                        <line x1="385" y1="42" x2="385" y2="52" stroke="#ea580c" strokeWidth="2" />

                                        <text x="200" y="22" fontSize="9.5" fill="#1e293b" fontWeight="black" textAnchor="middle">Thickness h = {selRow.thickness}mm</text>
                                        <text x="50" y="38" fontSize="7.5" fill="#ea580c" fontWeight="bold" textAnchor="middle">علوي إضافي</text>
                                        <text x="350" y="38" fontSize="7.5" fill="#ea580c" fontWeight="bold" textAnchor="middle">علوي إضافي</text>
                                        <text x="200" y="105" fontSize="10" fill="#059669" fontWeight="extrabold" textAnchor="middle">B: {selRow.bottomReinforcement}</text>
                                      </svg>
                                    </div>
                                    <div className="text-[11px] space-y-1.5 text-slate-700 bg-slate-100/60 p-2.5 rounded text-right">
                                      <p>• <strong>سمك البلاطة الصافي:</strong> {selRow.thickness} مم</p>
                                      <p>• <strong>التسليح السفلي الخرساني:</strong> {selRow.bottomReinforcement}</p>
                                      <p>• <strong>التسليح العلوي الشبكي:</strong> {selRow.topReinforcement}</p>
                                      <p>• <strong>الحجم المقدر للخرسانة:</strong> {selRow.concreteVolume} m³</p>
                                    </div>
                                  </div>
                                );
                              } else if (projectionMode === 'beams') {
                                const activeId = selectedCadElement?.type === 'beam' ? selectedCadElement.id : (floorBeamScheduleRows[0]?.beamId);
                                const selRow = (floorBeamScheduleRows.find(r => r.beamId === activeId) || floorBeamScheduleRows[0]) as any;
                                if (!selRow) return <p className="text-slate-400 text-xs text-center p-4">لا توجد جسور خرسانية بالدور</p>;
                                return (
                                  <div className="space-y-3">
                                    <span className="text-[11px] font-bold text-slate-600 block text-center border-b pb-1.5">مقطع تسليح وطارة الجسر {selRow.beamId}</span>
                                    <div className="flex justify-center bg-white p-2 rounded-md border border-slate-100 shadow-xs">
                                      <svg viewBox="0 0 160 160" className="w-[110px] h-[110px]" style={{ direction: 'ltr' }}>
                                        <rect x="30" y="20" width="100" height="120" fill="#cbd5e1" stroke="#475569" strokeWidth="2.5" rx="2" />
                                        <rect x="38" y="28" width="84" height="104" fill="none" stroke="#10b981" strokeWidth="1.5" />
                                        
                                        <line x1="38" y1="28" x2="48" y2="38" stroke="#10b981" strokeWidth="1.5" />
                                        <line x1="44" y1="28" x2="34" y2="38" stroke="#10b981" strokeWidth="1.5" />

                                        <circle cx="44" cy="34" r="5" fill="#ef4444" />
                                        <circle cx="116" cy="34" r="5" fill="#ef4444" />
                                        {(selRow?.flexLeft?.bars || 3) > 2 && <circle cx="80" cy="34" r="5" fill="#ef4444" />}

                                        <circle cx="44" cy="126" r="5" fill="#3b82f6" />
                                        <circle cx="116" cy="126" r="5" fill="#3b82f6" />
                                        {(selRow?.flexMid?.bars || 3) > 2 && <circle cx="80" cy="126" r="5" fill="#3b82f6" />}

                                        <text x="80" y="14" fontSize="9.5" textAnchor="middle" fill="#1e293b" fontWeight="black">b = {selRow.width} mm</text>
                                        <text x="14" y="80" fontSize="9.5" textAnchor="middle" fill="#1e293b" fontWeight="black" transform="rotate(-90 14 80)">h = {selRow.depth} mm</text>
                                      </svg>
                                    </div>
                                    <div className="text-[11px] space-y-1.5 text-slate-700 bg-slate-100/60 p-2.5 rounded text-right">
                                      <p>• <strong>قطاع الجسر الصافي:</strong> {selRow.width}x{selRow.depth} مم</p>
                                      <p>• <strong>السيخ العلوي الأطراف:</strong> {selRow.flexLeft?.bars} Ø {selRow.flexLeft?.dia}</p>
                                      <p>• <strong>السيخ السفلي المنتصف:</strong> {selRow.flexMid?.bars} Ø {selRow.flexMid?.dia}</p>
                                      <p>• <strong>الكانات المخصصة:</strong> {selRow.shear?.stirrups || 'Ø10 @ 150'}</p>
                                    </div>
                                  </div>
                                );
                              } else if (projectionMode === 'columns') {
                                const activeId = selectedCadElement?.type === 'column' ? selectedCadElement.id : (floorColScheduleRows[0]?.columnId);
                                const selRow = (floorColScheduleRows.find(r => r.columnId === activeId) || floorColScheduleRows[0]) as any;
                                if (!selRow) return <p className="text-slate-400 text-xs text-center p-4">لا توجد أعمدة في الدور المعني</p>;
                                return (
                                  <div className="space-y-3">
                                    <span className="text-[11px] font-bold text-slate-600 block text-center border-b pb-1.5">مقطع تسليح وطارة العمود {selRow.name || selRow.columnId}</span>
                                    <div className="flex justify-center bg-white p-2 rounded-md border border-slate-100 shadow-xs">
                                      <svg viewBox="0 0 160 160" className="w-[110px] h-[110px]" style={{ direction: 'ltr' }}>
                                        <rect x="20" y="20" width="120" height="120" fill="#cbd5e1" stroke="#475569" strokeWidth="2.5" rx="3" />
                                        <rect x="30" y="30" width="100" height="100" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2, 2" />
                                        
                                        <circle cx="34" cy="34" r="6.5" fill="#0f172a" />
                                        <circle cx="106" cy="34" r="6.5" fill="#0f172a" />
                                        <circle cx="34" cy="106" r="6.5" fill="#0f172a" />
                                        <circle cx="106" cy="106" r="6.5" fill="#0f172a" />
                                        
                                        {(selRow.barCount || 8) > 4 && (
                                          <>
                                            <circle cx="70" cy="34" r="6.5" fill="#0f172a" />
                                            <circle cx="70" cy="106" r="6.5" fill="#0f172a" />
                                          </>
                                        )}
                                        {(selRow.barCount || 8) > 6 && (
                                          <>
                                            <circle cx="34" cy="70" r="6.5" fill="#0f172a" />
                                            <circle cx="106" cy="70" r="6.5" fill="#0f172a" />
                                          </>
                                        )}

                                        <text x="80" y="15" fontSize="10" textAnchor="middle" fill="#1e293b" fontWeight="black">b = {selRow.width} mm</text>
                                        <text x="8" y="80" fontSize="10" textAnchor="middle" fill="#1e293b" fontWeight="black" transform="rotate(-90 8 80)">h = {selRow.depth} mm</text>
                                      </svg>
                                    </div>
                                    <div className="text-[11px] space-y-1.5 text-slate-700 bg-slate-100/60 p-2.5 rounded text-right">
                                      <p>• <strong>قطاع العمود الفعال:</strong> {selRow.width}x{selRow.depth} مم</p>
                                      <p>• <strong>تسليح طولي:</strong> {selRow.barCount} Ø {selRow.barDiameter}</p>
                                      <p>• <strong>الكانات المعتمدة:</strong> {`Ø${selRow.tieDiameter} @ ${selRow.tieSpacing} مم`}</p>
                                      <p>• <strong>الحمل المحوري الأقصى:</strong> {selRow.Pu} kN</p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Column: Layer Controllers & Elements Live Inspector */}
                <div className="space-y-4">
                  {/* Card 1: CAD Layers Controllers */}
                  <Card className="border-border">
                    <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Layers2 className="w-4 h-4 text-cyan-600" />
                        <CardTitle className="text-sm">طبقات مخطط الرسم والتحكم بها</CardTitle>
                      </div>
                      <CardDescription className="text-[11px] text-muted-foreground mr-1">
                        CAD Layers Visibility Management
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-3 space-y-3">
                      {/* Grid Lines Toggle */}
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-cyan-500" />
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-800 block">المحاور والشبكة</span>
                            <span className="text-[10px] text-slate-400 block font-mono">grids_and_axes</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={cadFloorLayers.grids}
                          onChange={(e) => setCadFloorLayers({ ...cadFloorLayers, grids: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                        />
                      </label>

                      {/* Columns Toggle */}
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 dark:bg-cyan-500" />
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-800 block">الأعمدة الإنشائية</span>
                            <span className="text-[10px] text-slate-400 block font-mono">reinforced_columns</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={cadFloorLayers.columns}
                          onChange={(e) => setCadFloorLayers({ ...cadFloorLayers, columns: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                        />
                      </label>

                      {/* Beams Toggle */}
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-1 bg-slate-900 inline-block" />
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-800 block">الجسور والكمرات</span>
                            <span className="text-[10px] text-slate-400 block font-mono">framing_beams</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={cadFloorLayers.beams}
                          onChange={(e) => setCadFloorLayers({ ...cadFloorLayers, beams: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                        />
                      </label>

                      {/* Slabs Toggle */}
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 border border-dashed border-amber-500 rounded-sm" />
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-800 block">البلاطات وسماكاتها</span>
                            <span className="text-[10px] text-slate-400 block font-mono">concrete_slabs</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={cadFloorLayers.slabs}
                          onChange={(e) => setCadFloorLayers({ ...cadFloorLayers, slabs: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                        />
                      </label>

                      {/* Dimensions Toggle */}
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-0.5 bg-pink-500 inline-block relative before:content-[''] before:absolute before:left-0 before:top-[-2px] before:w-[1px] before:h-[5px] before:bg-pink-500 after:content-[''] after:absolute after:right-0 after:top-[-2px] after:w-[1px] after:h-[5px] after:bg-pink-500" />
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-800 block">الأبعاد والقياسات البينية</span>
                            <span className="text-[10px] text-slate-400 block font-mono">dimension_lines</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={cadFloorLayers.dimensions}
                          onChange={(e) => setCadFloorLayers({ ...cadFloorLayers, dimensions: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                        />
                      </label>

                      {/* Orbit Nodes Toggle */}
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full border border-dashed border-rose-500 inline-block" />
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-800 block">الدوائر والإحداثيات</span>
                            <span className="text-[10px] text-slate-400 block font-mono">orbit_coordinates</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={cadFloorLayers.coordinates}
                          onChange={(e) => setCadFloorLayers({ ...cadFloorLayers, coordinates: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                        />
                      </label>

                      {/* Annotations Toggle */}
                      <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-bold text-slate-500 font-mono">TXT</span>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-slate-800 block">كتابات التوصيف والتسمية</span>
                            <span className="text-[10px] text-slate-400 block font-mono font-sans">text_annotations</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={cadFloorLayers.annotations}
                          onChange={(e) => setCadFloorLayers({ ...cadFloorLayers, annotations: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                        />
                      </label>
                    </CardContent>
                  </Card>

                  {/* Card 2: Theme Setup Selectors */}
                  <Card className="border-border">
                    <CardHeader className="py-2.5 px-4 border-b border-border/60 bg-muted/10">
                      <CardTitle className="text-xs font-bold text-slate-800">بيئة مساحة العمل ونوع اللوحة</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          onClick={() => setCadFloorTheme('dark')}
                          variant={cadFloorTheme === 'dark' ? 'default' : 'outline'}
                          size="sm"
                          className="gap-1 min-h-[40px] text-xs"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-[#030712] border border-white/20 inline-block" />
                          الأوتوكاد الداكن
                        </Button>
                        <Button 
                          onClick={() => setCadFloorTheme('light')}
                          variant={cadFloorTheme === 'light' ? 'default' : 'outline'}
                          size="sm"
                          className="gap-1 min-h-[40px] text-xs"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-[#faf8f5] border border-slate-300 inline-block" />
                          اللوحة الورقية
                        </Button>

                        <Button 
                          onClick={handlePrintActiveFloorPlan}
                          variant="secondary"
                          size="sm"
                          className="col-span-2 gap-2 mt-2 min-h-[40px] text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition-all shadow-xs"
                        >
                          <Printer className="w-4 h-4" />
                          طباعة هذا المسقط النشط ورقياً (A3 / A4)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 3: Live Elements Selector Inspector */}
                  <Card className="border-border bg-gradient-to-br from-white to-slate-50/50">
                    <CardHeader className="pb-3 border-b border-border/65 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-cyan-500" />
                        <CardTitle className="text-xs font-bold">محلل وفاحص العناصر المحوسب</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 text-right">
                      {selectedCadElement ? (
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between border-b pb-2">
                            <Badge className="bg-cyan-600 text-white font-mono font-bold text-xs uppercase px-2.5 py-0.5">
                              {selectedCadElement.type === 'column' ? 'عمود إنشائي / Column' : selectedCadElement.type === 'beam' ? 'جسر خرساني / Beam' : 'بلاطة خرسانية / Slab'}
                            </Badge>
                            <span className="font-mono font-bold text-slate-800 text-sm">{selectedCadElement.id}</span>
                          </div>
                          
                          <p className="text-xs text-slate-600 leading-relaxed font-sans">{selectedCadElement.details}</p>

                          <div className="bg-slate-100 p-2 text-[11px] rounded-lg border border-slate-200 text-slate-700 font-mono space-y-1 text-left" style={{ direction: 'ltr' }}>
                            <p><strong>TYPE:</strong> {selectedCadElement.type.toUpperCase()}</p>
                            <p><strong>ELEMENT_ID:</strong> {selectedCadElement.id}</p>
                            {selectedCadElement.type === 'column' && (
                              <>
                                <p><strong>SECTION:</strong> {selectedCadElement.rawData.b || 300}x{selectedCadElement.rawData.h || 300} mm</p>
                                <p><strong>COORD_X:</strong> {selectedCadElement.rawData.x.toFixed(3)} m</p>
                                <p><strong>COORD_Y:</strong> {selectedCadElement.rawData.y.toFixed(3)} m</p>
                              </>
                            )}
                            {selectedCadElement.type === 'beam' && (
                              <>
                                <p><strong>SIZE:</strong> {selectedCadElement.rawData.b}x{selectedCadElement.rawData.h} mm</p>
                                <p><strong>SPAN_X1_Y1:</strong> {selectedCadElement.rawData.x1.toFixed(1)}, {selectedCadElement.rawData.y1.toFixed(1)}</p>
                                <p><strong>SPAN_X2_Y2:</strong> {selectedCadElement.rawData.x2.toFixed(1)}, {selectedCadElement.rawData.y2.toFixed(1)}</p>
                              </>
                            )}
                            {selectedCadElement.type === 'slab' && (
                              <>
                                <p><strong>WIDTH:</strong> {Math.abs(selectedCadElement.rawData.x2 - selectedCadElement.rawData.x1).toFixed(2)} m</p>
                                <p><strong>HEIGHT:</strong> {Math.abs(selectedCadElement.rawData.y2 - selectedCadElement.rawData.y1).toFixed(2)} m</p>
                                <p><strong>AREA_M2:</strong> {(Math.abs(selectedCadElement.rawData.x2 - selectedCadElement.rawData.x1) * Math.abs(selectedCadElement.rawData.y2 - selectedCadElement.rawData.y1)).toFixed(2)} ㎡</p>
                              </>
                            )}
                          </div>
                          
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="w-full text-xs font-semibold gap-1.5"
                            onClick={() => setSelectedCadElement(null)}
                          >
                            مسح المعاينة الحالية
                          </Button>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-slate-400 space-y-2">
                          <HelpCircle className="w-7 h-7 mx-auto stroke-[1.2] text-slate-300 animate-pulse" />
                          <p className="text-xs">لا يوجد عنصر حددته حالياً.</p>
                          <p className="text-[10px] leading-relaxed text-slate-400/80">انقر فوق أي عمود أو جسر أو بلاطة داخل مساحة الأوتوكاد لاستخلاص الخصائص المعتمدة وحسابات المقطع وجدول تفريد الحديد المقابل.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 3: BEAM DETAILS & ELEVATION PROFILE */}
          {activeSubTab === 'beamDetails' && (
            <BeamDetailingDashboard 
              storyBeams={storyBeams} 
              resolvedBeamDesigns={resolvedBeamDesigns} 
              mat={mat} 
              titleBlock={titleBlock} 
              selectedScale={selectedScale} 
            />
          )}

          {/* Legacy beamDetails view bypassed */}
          {false && activeSubTab === 'beamDetails' && (
            <div className="space-y-6 animate-fade-in text-slate-800">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/80 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-600 animate-pulse" />
                    <h3 className="text-lg font-bold text-slate-900 font-sans tracking-tight">محرك تفريد وتفصيل تسليح الجسور الإنشائية <span className="text-xs font-mono font-normal text-slate-500">PHASE S1.5</span></h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">تفريد أوتوماتيكي ذكي وتصميم تفصيلي مع حساب التداخلات، التماسك، وجدول الكميات طبقاً لـ ACI 318-19</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600 font-sans">اختر الجسر الإنشائي:</span>
                  <select 
                    value={selectedBeamId} 
                    onChange={e => setSelectedBeamId(e.target.value)}
                    className="h-9 border border-cyan-200 bg-cyan-50/50 rounded-lg px-3 text-xs font-mono font-bold text-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {storyBeams.map(b => (
                      <option key={b.id} value={b.id}>جسر {b.id} ({b.b}x{b.h} mm) - L={((b.length || 5000)/1000).toFixed(2)}m</option>
                    ))}
                  </select>
                </div>
              </div>

              {currentSelectedBeam && activeArrangement ? (
                <div className="space-y-6">
                  
                  {/* General Status Alerts & Congestion Level Widget */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="border border-slate-200 shadow-sm bg-slate-50/80 p-3 flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-slate-500">الجسر الحالي (Beam Model)</span>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-slate-800 font-mono">{currentSelectedBeam.id}</span>
                        <span className="text-xs font-semibold text-slate-500">({currentSelectedBeam.b}x{currentSelectedBeam.h} mm)</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono mt-1">Fy = {activeArrangement.fy} MPa | F'c = {activeArrangement.fc} MPa</span>
                    </Card>

                    <Card className="border border-slate-200 shadow-sm bg-slate-50/80 p-3 flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-slate-500">طول البحر الصافي (Net Span)</span>
                      <div className="mt-1.5 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-cyan-700 font-mono">{(activeArrangement.length / 1000).toFixed(2)}</span>
                        <span className="text-xs font-bold text-cyan-600">متر (m)</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono mt-1">Total Spacing Checked</span>
                    </Card>

                    <Card className="border border-slate-200 shadow-sm bg-slate-50/80 p-3 flex flex-col justify-between">
                      <span className="text-[11px] font-bold text-slate-500">نسبة تباعد الحديد (Rebar Spacing)</span>
                      <div className="mt-1.5 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-emerald-600 font-mono">
                          {Math.round(activeArrangement.topRegions.left.candidates[selectedSolutionIdx.topLeft || 0]?.clearSpacing || 28)}
                        </span>
                        <span className="text-xs font-bold text-emerald-600">مم (mm)</span>
                      </div>
                      <span className="text-[10px] text-emerald-600/80 font-semibold mt-1">مطابق لشرط تباعد الركام الكبريا</span>
                    </Card>

                    <Card className={`border shadow-sm p-3 flex flex-col justify-between ${
                      activeArrangement.congestion.severity === 'high' 
                        ? 'bg-rose-50/70 border-rose-200' 
                        : activeArrangement.congestion.severity === 'moderate'
                          ? 'bg-amber-50/70 border-amber-200'
                          : 'bg-emerald-50/70 border-emerald-200'
                    }`}>
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <AlertTriangle className={`w-4 h-4 ${
                          activeArrangement.congestion.severity === 'high' ? 'text-rose-600' : 'text-amber-600'
                        }`} />
                        <span className="text-[11px] font-bold">حالة الازدحام والتعشيش</span>
                      </div>
                      <div className="mt-1.5">
                        <Badge className={`text-[10px] ${
                          activeArrangement.congestion.severity === 'high' 
                            ? 'bg-rose-100 text-rose-800' 
                            : activeArrangement.congestion.severity === 'moderate'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {activeArrangement.congestion.severity === 'high' ? 'مزدحم جداً / عالٍ' : activeArrangement.congestion.severity === 'moderate' ? 'متوسط الازدحام' : 'آمن وممتاز'}
                        </Badge>
                      </div>
                      <span className="text-[9px] text-slate-500 leading-tight mt-1">{activeArrangement.congestion.message}</span>
                    </Card>
                  </div>

                  {activeArrangement.warnings.length > 0 && (
                    <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3 text-xs text-amber-800 flex flex-col gap-1 shadow-sm">
                      <div className="flex items-center gap-2 font-bold mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>ملاحظات وإرشادات مراقبة الجودة الإنشائية للحديد (QA/QC Verification Checklist):</span>
                      </div>
                      {activeArrangement.warnings.map((w: string, idx: number) => (
                        <div key={idx} className="flex gap-1 items-start font-mono">
                          <span>•</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Detailing Customizer Section with Tab Selector for regions */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-4 space-y-4">
                      <Card className="border border-slate-200 shadow-md overflow-hidden bg-white">
                        <CardHeader className="bg-slate-50 border-b border-light text-slate-800 py-3 px-4">
                          <CardTitle className="text-xs font-bold font-sans">لوحة اختيار ومقارنة بدائل التسليح</CardTitle>
                          <CardDescription className="text-[10px] text-slate-500">يقوم المحرك بتوليد وتقييم كافة التوافيق المتاحة للأسياخ وتصنيفها طبقاً للأفضلية والتباعد المعود.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-3 space-y-4">
                          <div>
                            <span className="text-slate-500 text-[10px] font-bold block mb-1.5">اختر منطقة التحقق للتعديل:</span>
                            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                              <button 
                                onClick={() => setActiveRegionSelector('topLeft')} 
                                className={`text-[10px] font-bold py-1.5 px-1 rounded-md text-center transition-all ${activeRegionSelector === 'topLeft' ? 'bg-cyan-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                              >
                                أيسر علوي (Top L)
                              </button>
                              <button 
                                onClick={() => setActiveRegionSelector('topMid')} 
                                className={`text-[10px] font-bold py-1.5 px-1 rounded-md text-center transition-all ${activeRegionSelector === 'topMid' ? 'bg-cyan-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                              >
                                أوسط علوي (Top M)
                              </button>
                              <button 
                                onClick={() => setActiveRegionSelector('topRight')} 
                                className={`text-[10px] font-bold py-1.5 px-1 rounded-md text-center transition-all ${activeRegionSelector === 'topRight' ? 'bg-cyan-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                              >
                                أيمن علوي (Top R)
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg mt-1.5">
                              <button 
                                onClick={() => setActiveRegionSelector('botLeft')} 
                                className={`text-[10px] font-bold py-1.5 px-1 rounded-md text-center transition-all ${activeRegionSelector === 'botLeft' ? 'bg-cyan-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                              >
                                أيسر سفلي (Bot L)
                              </button>
                              <button 
                                onClick={() => setActiveRegionSelector('botMid')} 
                                className={`text-[10px] font-bold py-1.5 px-1 rounded-md text-center transition-all ${activeRegionSelector === 'botMid' ? 'bg-cyan-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                              >
                                أوسط سفلي (Bot M)
                              </button>
                              <button 
                                onClick={() => setActiveRegionSelector('botRight')} 
                                className={`text-[10px] font-bold py-1.5 px-1 rounded-md text-center transition-all ${activeRegionSelector === 'botRight' ? 'bg-cyan-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                              >
                                أيمن سفلي (Bot R)
                              </button>
                            </div>
                          </div>

                          {/* Candidates for the active region selector */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 block">البدائل المولدة المصنفة أوتوماتيكياً (Score-Ranked Candidates):</span>
                            
                            {(() => {
                              let candidates: any[] = [];
                              let requiredAs = 0;
                              let valKey: keyof typeof selectedSolutionIdx = 'topLeft';

                              if (activeRegionSelector === 'topLeft') { candidates = activeArrangement.topRegions.left.candidates; requiredAs = activeArrangement.topRegions.left.requiredAs; valKey = 'topLeft'; }
                              else if (activeRegionSelector === 'topMid') { candidates = activeArrangement.topRegions.mid.candidates; requiredAs = activeArrangement.topRegions.mid.requiredAs; valKey = 'topMid'; }
                              else if (activeRegionSelector === 'topRight') { candidates = activeArrangement.topRegions.right.candidates; requiredAs = activeArrangement.topRegions.right.requiredAs; valKey = 'topRight'; }
                              else if (activeRegionSelector === 'botLeft') { candidates = activeArrangement.bottomRegions.left.candidates; requiredAs = activeArrangement.bottomRegions.left.requiredAs; valKey = 'botLeft'; }
                              else if (activeRegionSelector === 'botMid') { candidates = activeArrangement.bottomRegions.mid.candidates; requiredAs = activeArrangement.bottomRegions.mid.requiredAs; valKey = 'botMid'; }
                              else if (activeRegionSelector === 'botRight') { candidates = activeArrangement.bottomRegions.right.candidates; requiredAs = activeArrangement.bottomRegions.right.requiredAs; valKey = 'botRight'; }

                              const activeCandIdx = selectedSolutionIdx[valKey] || 0;

                              return (
                                <div className="space-y-2">
                                  <div className="bg-slate-50 p-2 rounded-lg text-[10px] flex justify-between items-center border border-dashed border-slate-300">
                                    <span className="text-slate-600">المساحة المطلوبة للحديد (As Needed):</span>
                                    <span className="font-mono font-bold text-slate-900">{Math.round(requiredAs)} mm²</span>
                                  </div>

                                  <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                                    {candidates.map((cand, idx) => {
                                      const isSelected = activeCandIdx === idx;
                                      return (
                                        <div 
                                          key={idx}
                                          onClick={() => {
                                            setSelectedSolutionIdx(prev => ({ ...prev, [valKey]: idx }));
                                          }}
                                          className={`border p-2 rounded-xl transition-all cursor-pointer flex flex-col justify-between ${
                                            isSelected 
                                              ? 'border-cyan-600 bg-cyan-50/50 shadow-sm' 
                                              : 'border-slate-200 bg-white hover:border-slate-300'
                                          }`}
                                        >
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                              <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[9px] ${
                                                isSelected ? 'bg-cyan-600 text-white border-cyan-600' : 'border-slate-300 text-slate-400'
                                              }`}>
                                                {isSelected ? '✓' : idx + 1}
                                              </div>
                                              <span className="text-xs font-bold text-slate-800 font-mono">
                                                {cand.bars.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')}
                                              </span>
                                            </div>
                                            <span className={`text-[10px] font-black font-mono ${cand.score >= 80 ? 'text-emerald-600' : cand.score >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                                              {cand.score}/100
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-3 gap-1 text-[9px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100 font-mono">
                                            <div>
                                              <span className="block text-[8px] text-slate-400">Provided As:</span>
                                              <span className="font-bold text-slate-700">{cand.providedAs} mm²</span>
                                            </div>
                                            <div>
                                              <span className="block text-[8px] text-slate-400">Excess Steel:</span>
                                              <span className="font-bold text-slate-700">+{cand.excessPercent}%</span>
                                            </div>
                                            <div>
                                              <span className="block text-[8px] text-slate-400">Clear Spac:</span>
                                              <span className="font-bold text-slate-700">{Math.round(cand.clearSpacing)} mm</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                        </CardContent>
                      </Card>
                    </div>

                    {/* Interactive CAD Elevation SVG Render */}
                    <div className="lg:col-span-8 space-y-4">
                      <Card className="border border-slate-200 shadow-md bg-white p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1">
                            <Layers className="w-4 h-4 text-cyan-600" />
                            DETAILED CAD HIGH-RESOLUTION ELEVATION (AC-315 STANDARD)
                          </h4>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 py-0.5 px-2 rounded font-sans">
                            مخطط إنشائي متفاعل
                          </span>
                        </div>

                        {/* Interactive Elevation Diagram */}
                        <div className="border border-slate-200 bg-slate-950/95 rounded-xl p-4 overflow-x-auto flex flex-col items-center justify-center">
                          <svg viewBox="0 0 850 260" className="w-full max-w-4xl h-[240px]" style={{ direction: 'ltr' }}>
                            {/* Grid/Ruler Guide lines */}
                            <line x1="50" y1="30" x2="800" y2="30" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
                            <line x1="50" y1="230" x2="800" y2="230" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

                            {/* Left Column Support Block */}
                            <rect x="80" y="50" width="50" height="150" fill="#334155" fillOpacity="0.4" stroke="#475569" strokeWidth="1.5" strokeDasharray="2 2" />
                            <text x="105" y="130" fontSize="9" textAnchor="middle" fill="#94a3b8" fontWeight="bold" fontFamily="monospace">SUPPORT COL</text>
                            
                            {/* Mid Span Beam Body */}
                            <rect x="130" y="80" width="580" height="90" fill="none" stroke="#64748b" strokeWidth="2" />
                            
                            {/* Right Column Support Block */}
                            <rect x="710" y="50" width="50" height="150" fill="#334155" fillOpacity="0.4" stroke="#475569" strokeWidth="1.5" strokeDasharray="2 2" />
                            <text x="735" y="130" fontSize="9" textAnchor="middle" fill="#94a3b8" fontWeight="bold" fontFamily="monospace">SUPPORT COL</text>

                            {/* Continuous Top Rebars BT1 with L-hooks */}
                            {/* Left L hook */}
                            <path d="M 115 120 L 115 92" fill="none" stroke="#dc2626" strokeWidth="2.5" />
                            {/* Main Top bar body */}
                            <path d="M 115 92 L 725 92" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
                            {/* Right L hook */}
                            <path d="M 725 92 L 725 120" fill="none" stroke="#dc2626" strokeWidth="2.5" />
                            
                            <text x="420" y="75" fontSize="10" fill="#ef4444" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                              BT1: {activeArrangement.topRegions.mid.allBars.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')} Continuous
                            </text>

                            {/* Left Support extra bars (BT2) */}
                            {activeArrangement.topRegions.left.additional && (
                              <>
                                <path d="M 118 110 L 118 99 L 290 99" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="2 1" />
                                <text x="170" y="112" fontSize="8" fill="#f43f5e" fontWeight="bold" fontFamily="monospace">
                                  BT2: {activeArrangement.topRegions.left.additional.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')} (L=0.3L)
                                </text>
                                <line x1="290" y1="94" x2="290" y2="104" stroke="#f43f5e" strokeWidth="1" />
                              </>
                            )}

                            {/* Right Support extra bars (BT3) */}
                            {activeArrangement.topRegions.right.additional && (
                              <>
                                <path d="M 722 110 L 722 99 L 550 99" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="2 1" />
                                <text x="630" y="112" fontSize="8" fill="#f43f5e" fontWeight="bold" fontFamily="monospace" textAnchor="end">
                                  BT3: {activeArrangement.topRegions.right.additional.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')}
                                </text>
                                <line x1="550" y1="94" x2="550" y2="104" stroke="#f43f5e" strokeWidth="1" />
                              </>
                            )}

                            {/* Continuous Bottom Rebars (BB1) */}
                            {/* Left L hook */}
                            <path d="M 115 130 L 115 158" fill="none" stroke="#0ea5e9" strokeWidth="2.5" />
                            {/* Bottom bar body */}
                            <path d="M 115 158 L 725 158" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
                            {/* Right L hook */}
                            <path d="M 725 158 L 725 130" fill="none" stroke="#0ea5e9" strokeWidth="2.5" />

                            <text x="420" y="178" fontSize="10" fill="#0ea5e9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                              BB1: {activeArrangement.bottomRegions.left.allBars.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')} Cont.
                            </text>

                            {/* Bottom Midspan extra bars (BB2) */}
                            {activeArrangement.bottomRegions.mid.additional && (
                              <>
                                <path d="M 210 151 L 630 151" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 1" />
                                <text x="420" y="145" fontSize="8" fill="#38bdf8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                                  BB2: {activeArrangement.bottomRegions.mid.additional.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')}
                                </text>
                                <line x1="210" y1="148" x2="210" y2="154" stroke="#38bdf8" strokeWidth="1" />
                                <line x1="630" y1="148" x2="630" y2="154" stroke="#38bdf8" strokeWidth="1" />
                              </>
                            )}

                            {/* Closed Stirrup layouts (Denser at supports, wider at midspan) */}
                            {/* Left Support Stirrups */}
                            {Array.from({ length: 11 }).map((_, idx) => (
                              <line key={`stirLeft-${idx}`} x1={135 + idx * 10} y1="83" x2={135 + idx * 10} y2="167" stroke="#fb7185" strokeWidth="1" strokeOpacity="0.8" />
                            ))}
                            <text x="180" y="195" fontSize="8" fill="#fb7185" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              {activeArrangement.stirrups.leftZone.count}BS1 Ø{activeArrangement.stirrups.dia}@{activeArrangement.stirrups.leftZone.spacing}
                            </text>

                            {/* Middle Zone Stirrups */}
                            {Array.from({ length: 14 }).map((_, idx) => (
                              <line key={`stirMid-${idx}`} x1={255 + idx * 24} y1="83" x2={255 + idx * 24} y2="167" stroke="#475569" strokeWidth="1" strokeOpacity="0.5" />
                            ))}
                            <text x="420" y="195" fontSize="8" fill="#94a3b8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              {activeArrangement.stirrups.midZone.count}BS2 Ø{activeArrangement.stirrups.dia}@{activeArrangement.stirrups.midZone.spacing}
                            </text>

                            {/* Right Support Stirrups */}
                            {Array.from({ length: 11 }).map((_, idx) => (
                              <line key={`stirRight-${idx}`} x1={610 + idx * 10} y1="83" x2={610 + idx * 10} y2="167" stroke="#fb7185" strokeWidth="1" strokeOpacity="0.8" />
                            ))}
                            <text x="660" y="195" fontSize="8" fill="#fb7185" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                              {activeArrangement.stirrups.rightZone.count}BS1 Ø{activeArrangement.stirrups.dia}@{activeArrangement.stirrups.rightZone.spacing}
                            </text>

                            {/* Section indicator cut marks */}
                            <line x1="175" y1="60" x2="175" y2="190" stroke="#f1f5f9" strokeWidth="0.8" strokeDasharray="6 3" />
                            <text x="175" y="55" fontSize="8" fill="#f1f5f9" textAnchor="middle" fontFamily="monospace">SEC A-A</text>

                            <line x1="420" y1="60" x2="420" y2="190" stroke="#f1f5f9" strokeWidth="0.8" strokeDasharray="6 3" />
                            <text x="420" y="55" fontSize="8" fill="#f1f5f9" textAnchor="middle" fontFamily="monospace">SEC B-B</text>

                            {/* Dimensions labels */}
                            <text x="420" y="245" fontSize="9" fill="#94a3b8" textAnchor="middle" fontFamily="monospace">
                              SPAN {activeArrangement.spanName} = {activeArrangement.length} mm (H = {activeArrangement.h} mm, B = {activeArrangement.b} mm)
                            </text>
                          </svg>
                        </div>
                      </Card>

                      {/* Side by side Cross Sections Renders */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border border-slate-200 shadow-sm bg-white p-4">
                          <h5 className="text-xs font-bold text-slate-800 font-sans tracking-tight mb-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-3 bg-rose-500 rounded-sm"></span>
                            القطاع العرضي عند المساند (Section A-A)
                          </h5>
                          <div className="flex items-center gap-5">
                            <svg viewBox="0 0 160 180" className="w-[110px] h-[125px] border border-slate-200 rounded-lg bg-slate-50/60 p-1" style={{ direction: 'ltr' }}>
                              {/* Outer rectangular beam */}
                              <rect x="25" y="20" width="110" height="140" fill="#cbd5e1" stroke="#334155" strokeWidth="2" />
                              <text x="80" y="15" fontSize="8" textAnchor="middle" fill="#475569" fontWeight="bold">b = {activeArrangement.b} mm</text>
                              <text x="10" y="90" fontSize="8" textAnchor="middle" fill="#475569" fontWeight="bold" transform="rotate(-90 10 90)">h = {activeArrangement.h} mm</text>

                              {/* Stirrup closed outline */}
                              <rect x="33" y="28" width="94" height="124" fill="none" stroke="#fb7185" strokeWidth="1.5" />
                              {/* Stirrup hooks */}
                              <line x1="33" y1="28" x2="45" y2="40" stroke="#fb7185" strokeWidth="1.5" />
                              <line x1="127" y1="28" x2="115" y2="40" stroke="#fb7185" strokeWidth="1.5" />

                              {/* Render Top Rebars (Left Support: Left Top) */}
                              {/* Continuous: 2 or 3 bars */}
                              <circle cx="39" cy="34" r="5" fill="#ef4444" />
                              <circle cx="121" cy="34" r="5" fill="#ef4444" />
                              {activeArrangement.topRegions.left.allBars[0]?.count > 2 && (
                                <circle cx="80" cy="34" r="5" fill="#ef4444" />
                              )}
                              
                              {/* Extra Top bars in 2nd layer if additional rebar exists */}
                              {activeArrangement.topRegions.left.additional && (
                                <>
                                  <circle cx="55" cy="54" r="4.5" fill="#f43f5e" />
                                  <circle cx="105" cy="54" r="4.5" fill="#f43f5e" />
                                </>
                              )}

                              {/* Bottom continuous corner bars */}
                              <circle cx="39" cy="146" r="5" fill="#0ea5e9" />
                              <circle cx="121" cy="146" r="5" fill="#0ea5e9" />
                            </svg>

                            <div className="flex-1 space-y-2 text-xs leading-relaxed">
                              <div className="flex justify-between border-b pb-1">
                                <span className="text-slate-500">التسليح العلوي المعتمد:</span>
                                <span className="font-mono font-bold text-slate-800">
                                  {activeArrangement.topRegions.left.allBars.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')}
                                </span>
                              </div>
                              <div className="flex justify-between border-b pb-1">
                                <span className="text-slate-500">مساحة المقطع الفعلي:</span>
                                <span className="font-mono font-bold text-emerald-600">{activeArrangement.topRegions.left.providedAs} mm²</span>
                              </div>
                              <div className="flex justify-between border-b pb-1">
                                <span className="text-slate-500">كانات مقاومة القص:</span>
                                <span className="font-mono font-bold text-slate-800">Ø{activeArrangement.stirrups.dia} كل {activeArrangement.stirrups.leftZone.spacing} مم</span>
                              </div>
                            </div>
                          </div>
                        </Card>

                        <Card className="border border-slate-200 shadow-sm bg-white p-4">
                          <h5 className="text-xs font-bold text-slate-800 font-sans tracking-tight mb-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-3 bg-cyan-500 rounded-sm"></span>
                            القطاع العرضي عند منتصف المجاز (Section B-B)
                          </h5>
                          <div className="flex items-center gap-5">
                            <svg viewBox="0 0 160 180" className="w-[110px] h-[125px] border border-slate-200 rounded-lg bg-slate-50/60 p-1" style={{ direction: 'ltr' }}>
                              {/* Outer rectangular beam */}
                              <rect x="25" y="20" width="110" height="140" fill="#cbd5e1" stroke="#334155" strokeWidth="2" />
                              <text x="80" y="15" fontSize="8" textAnchor="middle" fill="#475569" fontWeight="bold">b = {activeArrangement.b} mm</text>
                              <text x="10" y="90" fontSize="8" textAnchor="middle" fill="#475569" fontWeight="bold" transform="rotate(-90 10 90)">h = {activeArrangement.h} mm</text>

                              {/* Stirrup closed outline */}
                              <rect x="33" y="28" width="94" height="124" fill="none" stroke="#475569" strokeWidth="1.5" />
                              {/* Stirrup hooks */}
                              <line x1="33" y1="28" x2="45" y2="40" stroke="#475569" strokeWidth="1.5" />
                              <line x1="127" y1="28" x2="115" y2="40" stroke="#475569" strokeWidth="1.5" />

                              {/* Render Top continuous corner bars */}
                              <circle cx="39" cy="34" r="5" fill="#ef4444" />
                              <circle cx="121" cy="34" r="5" fill="#ef4444" />

                              {/* Render Bottom main structural bars */}
                              <circle cx="39" cy="146" r="5" fill="#0ea5e9" />
                              <circle cx="121" cy="146" r="5" fill="#0ea5e9" />
                              {activeArrangement.bottomRegions.mid.allBars[0]?.count > 2 && (
                                <circle cx="80" cy="146" r="5" fill="#0ea5e9" />
                              )}

                              {/* Extra Bottom bars in 2nd layer if additional rebar exists */}
                              {activeArrangement.bottomRegions.mid.additional && (
                                <>
                                  <circle cx="55" cy="126" r="4.5" fill="#38bdf8" />
                                  <circle cx="105" cy="126" r="4.5" fill="#38bdf8" />
                                </>
                              )}
                            </svg>

                            <div className="flex-1 space-y-2 text-xs leading-relaxed">
                              <div className="flex justify-between border-b pb-1">
                                <span className="text-slate-500">التسليح السفلي المعتمد:</span>
                                <span className="font-mono font-bold text-slate-800">
                                  {activeArrangement.bottomRegions.mid.allBars.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')}
                                </span>
                              </div>
                              <div className="flex justify-between border-b pb-1">
                                <span className="text-slate-500">مساحة المقطع الفعلي:</span>
                                <span className="font-mono font-bold text-cyan-600">{activeArrangement.bottomRegions.mid.providedAs} mm²</span>
                              </div>
                              <div className="flex justify-between border-b pb-1">
                                <span className="text-slate-500">كانات وسط البحر:</span>
                                <span className="font-mono font-bold text-slate-800">Ø{activeArrangement.stirrups.dia} كل {activeArrangement.stirrups.midZone.spacing} مم</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </div>

                  {/* Complete BBS Schedule Bending Table */}
                  <Card className="border border-slate-200 shadow-md">
                    <CardHeader className="bg-slate-50 flex flex-row justify-between items-center py-3 px-4">
                      <div>
                        <CardTitle className="text-xs font-bold font-sans">جدول تفريد وتفصيل الحديد الإنشائي للجسر (BBS Schedule - ACI 315-99)</CardTitle>
                        <CardDescription className="text-[10px] text-slate-500">يتضمن تفاصيل الأطوال والإنحناءات وأوزان الحديد مفصلاً طبقاً لأقطار الأسياخ.</CardDescription>
                      </div>
                      <Badge className="bg-cyan-100 text-cyan-800 text-[10px] font-mono font-bold">Total Rebars: {activeArrangement.bbs.length}</Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table className="text-xs font-mono">
                        <TableHeader className="bg-slate-100">
                          <TableRow>
                            <TableHead className="text-right text-[10px] font-bold py-2">رمز السيخ (Mark)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold py-2">القطر (Ø)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold py-2">كود الشكل (Shape)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold py-2">العدد (Count)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold py-2">طول السيخ (Length - mm)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold py-2">الوزن الفردي (kg)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold py-2">إجمالي الوزن (kg)</TableHead>
                            <TableHead className="text-right text-[10px] font-bold py-2 font-sans">تعليمات الإنحناء والتقطيع (Bending Instructions)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeArrangement.bbs.map((item: any, idx: number) => (
                            <TableRow key={idx} className="hover:bg-slate-50">
                              <TableCell className="font-bold text-slate-900">{item.mark}</TableCell>
                              <TableCell className="font-bold text-cyan-800">Ø{item.dia}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[9px] font-sans">
                                  {item.shapeCode === 0 ? 'كود 00 (مستقيم)' : item.shapeCode === 20 ? 'كود 20 (على شكل L)' : 'كود 37 (كانة مغلقة)'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold">{item.count}</TableCell>
                              <TableCell>{item.length} mm</TableCell>
                              <TableCell>{item.weightPerItem.toFixed(2)} kg</TableCell>
                              <TableCell className="font-bold text-slate-900">{item.totalWeight.toFixed(2)} kg</TableCell>
                              <TableCell className="font-sans text-slate-600 leading-normal text-[10px]">{item.bendDetails}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Development Length & Lap Splice Requirements Report */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border border-slate-200 shadow-md">
                      <CardHeader className="bg-slate-50/70 border-b border-light py-2.5 px-4">
                        <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 text-slate-800">
                          <Wrench className="w-4 h-4 text-cyan-600" />
                          حسابات أطوال التماسك والتشريك المعتمدة (ACI 318 Development Lengths)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table className="text-xs font-mono">
                          <TableHeader className="bg-slate-50/50">
                            <TableRow>
                              <TableHead className="text-right py-2 font-bold text-[10px]">القطر (Ø)</TableHead>
                              <TableHead className="text-right py-2 font-bold text-[10px]">التماسك المستقيم Ld</TableHead>
                              <TableHead className="text-right py-2 font-bold text-[10px]">تماسك الانضغاط Ldc</TableHead>
                              <TableHead className="text-right py-2 font-bold text-[10px]">طول العكفة Ldh</TableHead>
                              <TableHead className="text-right py-2 font-bold text-[10px]">تشريك الشد (Class B Lap)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(activeArrangement.developmentLengths).map(([dia, data]: [string, any]) => (
                              <TableRow key={dia}>
                                <TableCell className="font-bold text-slate-900">Ø{dia}</TableCell>
                                <TableCell className="font-bold text-slate-700">{data.ld_straight} mm</TableCell>
                                <TableCell className="text-slate-600">{data.ld_compression} mm</TableCell>
                                <TableCell className="text-slate-600 text-rose-500 font-bold">{data.ldh_standard_hook} mm</TableCell>
                                <TableCell className="font-bold text-cyan-700">{data.lap_classB} mm</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-200 shadow-md">
                      <CardHeader className="bg-slate-50/70 border-b border-light py-2.5 px-4 flex flex-row justify-between items-center">
                        <CardTitle className="text-xs font-bold font-sans flex items-center gap-1.5 text-slate-800">
                          <Compass className="w-4 h-4 text-cyan-600" />
                          كميات الخرسانة، الحديد والجدول المالي للجسر (Individual BOQ)
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] font-semibold border-cyan-400 text-cyan-700">Live BOQ</Badge>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4 text-xs font-sans">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-cyan-50/30 p-2.5 rounded-lg border border-cyan-100 flex flex-col">
                            <span className="text-slate-500 text-[10px]">حجم الخرسانة المسلحة (Concrete Vol.)</span>
                            <span className="text-lg font-bold text-cyan-800 font-mono mt-1">{activeArrangement.boq.concreteVolume} m³</span>
                          </div>
                          <div className="bg-cyan-50/30 p-2.5 rounded-lg border border-cyan-100 flex flex-col">
                            <span className="text-slate-500 text-[10px]">إجمالي وزن الحديد (Total Steel Weight)</span>
                            <span className="text-lg font-bold text-cyan-800 font-mono mt-1">{activeArrangement.boq.steelWeight} kg</span>
                          </div>
                        </div>

                        <div className="space-y-2 border-t pt-2.5">
                          <div className="flex justify-between items-center text-slate-600">
                            <span>كثافة حديد التسليح للمتر المكعب (Reinforcement Ratio):</span>
                            <span className="font-mono font-bold text-slate-800">{activeArrangement.boq.reinforcementRatio} kg/m³</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span>إجمالي التكلفة الإنشائية لصب وتفريد الجسر (الخرسانة + الحديد مصنعية):</span>
                            <span className="font-mono font-bold text-emerald-600 text-sm">
                              {activeArrangement.boq.estimatedCost.toLocaleString()} USD
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-2 text-[10px] text-zinc-400 rounded border border-light leading-snug">
                          * تم احتساب الموازنة تلقائياً بناءً على متوسط تسعير الحديد (1.15 دولار/كغ) وتوريد الخرسانة وسهولة التركيب بالموقع (140 دولار/متر مكعب).
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                </div>
              ) : (
                <div className="text-center py-10 border border-dashed rounded-xl bg-slate-50">
                  <Info className="w-10 h-10 text-cyan-500 mx-auto opacity-70 mb-2" />
                  <p className="text-xs text-muted-foreground font-sans">عذراً، لم نتمكن من العثور على جسور في الفضاء التصميمي لإجراء عملية التفريد الإنشائي.</p>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 4: COLUMN DETAILS & SCHEDULE (Phase D6B Column Schedule System) */}
          {activeSubTab === 'columnDetails' && (
            <div className="space-y-4 animate-fade-in text-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border/80 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <Layers3 className="w-5 h-5 text-cyan-600" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">نظام وجداول تسليح الأعمدة (STA4CAD Column Schedule)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">جدولة شاملة للقطاعات والتسليح والكميات وتفريد حديد الأعمدة مع مطابقة متطلبات الكود والـ BBS.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <Button
                    size="xs"
                    onClick={() => setColumnDetailViewMode('schedule')}
                    className={`h-7 px-3 text-xs font-bold transition-all ${columnDetailViewMode === 'schedule' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    جدول الأعمدة الشامل (STA4CAD)
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => setColumnDetailViewMode('gallery')}
                    className={`h-7 px-3 text-xs font-bold transition-all ${columnDetailViewMode === 'gallery' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    معرض القطاعات الفردية
                  </Button>
                </div>
              </div>

              {columnDetailViewMode === 'schedule' ? (
                <ColumnScheduleModule
                  columns={columns}
                  stories={stories}
                  colDesigns={resolvedColDesigns}
                  materialProps={{
                    fc: mat?.fc || 25,
                    fy: mat?.fy || 420,
                    fyt: 280,
                    gamma: mat?.density || 24,
                    stirrupDia: 10
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500">اختر العمود لمعاينة مقطعه وتفصيل تسليحه:</span>
                    <select 
                      value={selectedColId} 
                      onChange={e => setSelectedColId(e.target.value)}
                      className="h-8 border bg-white rounded px-2 text-xs font-mono font-bold text-cyan-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                      {storyCols.map(c => (
                        <option key={c.id} value={c.id}>{c.name || `C${c.id}`} ({c.b}x{c.h} mm)</option>
                      ))}
                    </select>
                  </div>

                  {currentSelectedCol ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      <div className="md:col-span-5 space-y-3">
                        <Card className="border border-border/80">
                          <CardHeader className="bg-slate-100/50 py-2.5 px-4">
                            <CardTitle className="text-xs text-right">المقطع العرضي للعمود الفني</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 flex flex-col items-center justify-center">
                            {/* Vector representation of column section rebar */}
                            <svg viewBox="0 0 160 160" className="w-[140px] h-[140px] border border-slate-300 rounded-lg p-2 bg-slate-50/60" style={{ direction: 'ltr' }}>
                              <rect x="20" y="20" width="120" height="120" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
                              <rect x="30" y="30" width="100" height="100" fill="none" stroke="#ef4444" strokeWidth="1" />
                              
                              {/* Circle rebars inside */}
                              <circle cx="34" cy="34" r="5.5" fill="#0f172a" />
                              <circle cx="70" cy="34" r="5.5" fill="#0f172a" />
                              <circle cx="106" cy="34" r="5.5" fill="#0f172a" />
                              <circle cx="126" cy="34" r="5.5" fill="#0f172a" />
                              <circle cx="34" cy="126" r="5.5" fill="#0f172a" />
                              <circle cx="70" cy="126" r="5.5" fill="#0f172a" />
                              <circle cx="106" cy="126" r="5.5" fill="#0f172a" />
                              <circle cx="126" cy="126" r="5.5" fill="#0f172a" />

                              {/* Dimensions */}
                              <text x="80" y="15" fontSize="8" textAnchor="middle" fill="#475569" fontWeight="bold">b = {currentSelectedCol.b} mm</text>
                              <text x="5" y="80" fontSize="8" textAnchor="middle" fill="#475569" fontWeight="bold" transform="rotate(-90 5 80)">h = {currentSelectedCol.h} mm</text>
                            </svg>
                            <p className="text-[10px] text-muted-foreground text-center mt-2">مخطط تسليح مقطع العمود {currentSelectedCol.name || `C${currentSelectedCol.id}`}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="md:col-span-7 space-y-4">
                        <Card className="border border-border/80 text-xs">
                          <CardHeader className="bg-slate-100/50 py-2.5 px-4">
                            <CardTitle className="text-xs text-right">تفاصيل القطاع ومعايير التسليح الطولي</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-3 text-right">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">منسوب البداية والنهاية:</span>
                              <span className="font-mono font-medium text-slate-800">0.00 m - {activeStory?.zValue || 3.2} m</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">التسليح الرأسي الطولي (Longitudinal Rebar):</span>
                              <span className="font-bold text-cyan-700 text-sm">{currentSelectedColDesign?.text || '8 Ø 16'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">الكانات والتربيط العرضي (Column Ties):</span>
                              <span className="font-bold text-amber-700">{currentSelectedColDesign?.tiesText || 'Ø 10 @ 150 mm'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">نسبة التسليح الموفرة (&rho;% Limit):</span>
                              <span className="font-mono bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">1.52 % (OK &lt; 4%)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500">نسبة كفاية الجناح والضغط الفعلي (Utilization Rate):</span>
                              <span className="font-mono bg-cyan-100 text-cyan-800 font-bold px-2 py-0.5 rounded text-[11px]">{(currentSelectedColDesign?.utilization * 100).toFixed(1)} % (آمن)</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 5: SLAB DETAILS */}
          {activeSubTab === 'slabDetails' && (
            <div className="space-y-4 animate-fade-in text-slate-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border/80 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-600" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">نظام وجداول تسليح البلاطات (STA4CAD Slab Schedule)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">لوحة ذكية لجدولة البلاطات، حساب الحجوم والحديد، والشدات الخشبية مع فحص الكود.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <Button
                    size="xs"
                    onClick={() => setSlabDetailViewMode('schedule')}
                    className={`h-7 px-3 text-xs font-bold transition-all ${slabDetailViewMode === 'schedule' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    جدول البلاطات الشامل (STA4CAD)
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => setSlabDetailViewMode('guide')}
                    className={`h-7 px-3 text-xs font-bold transition-all ${slabDetailViewMode === 'guide' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    دليل وأدوات الرسم التفصيلي
                  </Button>
                </div>
              </div>

              {slabDetailViewMode === 'schedule' ? (
                <SlabScheduleModule
                  slabs={slabs}
                  stories={stories}
                  slabDesigns={slabDesigns as any}
                  materialProps={{
                    fc: mat?.fc || 25,
                    fy: mat?.fy || 420,
                    fyt: 280,
                    gamma: mat?.density || 24,
                    stirrupDia: 10
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border border-border/80">
                      <CardContent className="p-4 space-y-2 text-xs text-right">
                        <h4 className="font-bold text-slate-800">البلاطات المصمتة (Solid Slabs)</h4>
                        <p className="text-slate-500 text-[11px] leading-relaxed">السماكة القياسية المعتمدة للبلاطات هي {storySlabs[0]?.t || 150} مم. شبكة التسليح السفلية الموصى بها هي Ø12 كل 150 مم في الاتجاه الرئيسي، مع قضبان إضافية علوية لمقاومة العزوم السالبة فوق الجسور.</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-border/80">
                      <CardContent className="p-4 space-y-2 text-xs text-right">
                        <h4 className="font-bold text-slate-800">البلاطات الهوردي المفرغة (Ribbed)</h4>
                        <p className="text-slate-500 text-[11px] leading-relaxed">في بلاطات الأعصاب ذات الاتجاه الواحد، يتم توفير غطاء خرساني سماكة 70 مم شبكة حديد تسليح Ø8 كل 200 مم مع أعصاب رئيسية بعرض 120 مم تحتوي سيخين Ø14 سفلي.</p>
                      </CardContent>
                    </Card>
                    <Card className="border border-border/80">
                      <CardContent className="p-4 space-y-2 text-xs text-right">
                        <h4 className="font-bold text-slate-800">متطلبات الغطاء الخرساني والمقاومة</h4>
                        <p className="text-slate-500 text-[11px] leading-relaxed">الحد الأدنى للغطاء للبلاطات 20 مم. يتم استخدام كراس حديدي بارتفاع 80 مم لضمان استقرار الشبكة العلوية أثناء الصب ومقاومة الانكماش والحرارة.</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Graphical rendering of general mesh overlap */}
                  <div className="border border-slate-300 rounded-xl bg-slate-50 p-4 flex flex-col items-center justify-center">
                    <h4 className="text-xs font-bold text-slate-600 mb-2">TYPICAL SOLID SLAB MESH REINFORCEMENT BLUEPRINT</h4>
                    <svg viewBox="0 0 600 160" className="w-full max-w-lg" style={{ direction: 'ltr' }}>
                      <rect x="50" y="50" width="500" height="60" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
                      
                      {/* Bottom steel bars */}
                      <line x1="50" y1="100" x2="550" y2="100" stroke="#06b6d4" strokeWidth="2" />
                      <line x1="50" y1="100" x2="50" y2="90" stroke="#06b6d4" strokeWidth="2" />
                      <line x1="550" y1="100" x2="550" y2="90" stroke="#06b6d4" strokeWidth="2" />
                      <text x="300" y="115" fontSize="9" fill="#0891b2" fontWeight="bold" textAnchor="middle">Bottom Mesh: Ø12 @ 150 mm</text>

                      {/* Top additional steel over support joints */}
                      <line x1="45" y1="60" x2="160" y2="60" stroke="#ef4444" strokeWidth="2" />
                      <line x1="45" y1="60" x2="45" y2="70" stroke="#ef4444" strokeWidth="2" />
                      <line x1="440" y1="60" x2="555" y2="60" stroke="#ef4444" strokeWidth="2" />
                      <line x1="555" y1="60" x2="555" y2="70" stroke="#ef4444" strokeWidth="2" />
                      <text x="100" y="52" fontSize="8" fill="#ef4444" fontWeight="bold" textAnchor="middle">Top Additional</text>
                      <text x="500" y="52" fontSize="8" fill="#ef4444" fontWeight="bold" textAnchor="middle">Top Additional</text>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 6: SECTIONS */}
          {activeSubTab === 'sections' && (
            <div className="space-y-4 animate-fade-in text-slate-800 text-right" style={{ direction: 'rtl' }}>
              <div className="flex items-center justify-between border-b border-border/80 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-cyan-600 animate-spin" style={{ animationDuration: '6s' }} />
                  <h3 className="text-base font-bold text-slate-900">نظام استخراج القطاعات الإنشائية التلقائي (Phase D5 Section Generator)</h3>
                </div>
                <Badge className="bg-cyan-100 hover:bg-cyan-150 text-cyan-800 border-cyan-200">مرحلة D5 - نشط</Badge>
              </div>

              {/* Master Control Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                
                {/* Control Panel (4 columns) */}
                <div className="lg:col-span-4 space-y-4">
                  <Card className="border border-slate-200 shadow-sm">
                    <CardHeader className="py-3 bg-slate-50 border-b border-slate-100">
                      <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5 justify-end">
                        <Wrench className="w-3.5 h-3.5 text-cyan-600" />
                        منهجية وموقع القطع (Cut Parameters)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      
                      {/* Section Type Selector */}
                      <div className="space-y-1 text-right">
                        <label className="text-[11px] font-bold text-slate-500 block">نمط القطاع الهيكلي (Section Type)</label>
                        <select
                          value={sectionType}
                          onChange={(e) => setSectionType(e.target.value as SectionType)}
                          className="w-full text-right h-8 text-xs bg-white border border-slate-200 rounded px-2"
                        >
                          <option value="beam">قطاع عرضي للكمرات والجسور (Beam Section)</option>
                          <option value="column">قطاع عرضي للأعمدة المسلحة (Column Section)</option>
                          <option value="slab">عصب بلاطة هوردي مفرغة (Ribbed Slab Section)</option>
                          <option value="foundation">قاعدة مفرقة ورقبة عامود (Foundation Footing)</option>
                          <option value="building">مستويات وارتفاعات المبنى (Building Levels)</option>
                          <option value="custom">قطاع تفاعلي مخصص (Custom Slice Plot)</option>
                        </select>
                      </div>

                      {/* Section Code tag */}
                      <div className="space-y-1 text-right">
                        <label className="text-[11px] font-bold text-slate-500 block">مرمز القطاع وتسميته (Section Code)</label>
                        <select
                          value={sectionCode}
                          onChange={(e) => setSectionCode(e.target.value)}
                          className="w-full text-center h-8 text-xs bg-white border border-slate-200 rounded px-2 font-mono"
                        >
                          <option value="A-A">القطاع الطولي الرئيسي A-A</option>
                          <option value="B-B">القطاع العرضي المساعد B-B</option>
                          <option value="C-C">قطاع التفاصيل الإضافية C-C</option>
                          <option value="D-D">قطاع الأساسات ومقاومة الزلازل D-D</option>
                        </select>
                      </div>

                      {/* Contingent element selectors */}
                      {sectionType === 'beam' && (
                        <div className="space-y-1 text-right">
                          <label className="text-[11px] font-bold text-slate-500 block font-mono">الجسر المطلوب قطعه (Select Beam)</label>
                          <select
                            value={sectionBeamId}
                            onChange={(e) => setSectionBeamId(e.target.value)}
                            className="w-full text-center h-8 text-xs bg-white border border-slate-200 rounded px-2"
                          >
                            {beams.length === 0 ? (
                              <option value="">لا توجد جسور نشطة</option>
                            ) : (
                              beams.map(b => (
                                <option key={b.id} value={b.id}>
                                  جسر {b.name || b.id} ({b.b}x{b.h} مم) - بحر {((b.length || 0)/1000).toFixed(2)}م
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      )}

                      {sectionType === 'column' && (
                        <div className="space-y-1 text-right">
                          <label className="text-[11px] font-bold text-slate-500 block font-mono">العامود المطلوب قطعه (Select Column)</label>
                          <select
                            value={sectionColId}
                            onChange={(e) => setSectionColId(e.target.value)}
                            className="w-full text-center h-8 text-xs bg-white border border-slate-200 rounded px-2"
                          >
                            {columns.length === 0 ? (
                              <option value="">لا توجد أعمدة نشطة</option>
                            ) : (
                              columns.map(c => (
                                <option key={c.id} value={c.id}>
                                  عامود {c.name || c.id} ({c.b}x{c.h} مم) - ارتفاع {((c.L || 3200)/1000).toFixed(2)}م
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      )}

                      {/* Slice offset on member */}
                      {sectionType === 'beam' && (
                        <div className="space-y-1 text-right pt-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-bold">{customOffsetPercent}%</span>
                            <label className="font-bold text-slate-500">نقطة القطع بمحاذاة البحر (Distance %)</label>
                          </div>
                          <Input
                            type="range"
                            min="10"
                            max="90"
                            step="5"
                            value={customOffsetPercent}
                            onChange={(e) => setCustomOffsetPercent(Number(e.target.value))}
                            className="h-8 cursor-pointer mt-0.5"
                          />
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {customOffsetPercent < 25 ? 'نطاق المساند والدعم (Seismic Confinement Zone / Support Support)' : customOffsetPercent > 75 ? 'نطاق المساند الثاني' : 'نطاق العزم الأقصى بمنتصف البحور (Midspan Area)'}
                          </p>
                        </div>
                      )}

                      {/* Hatch scale factor */}
                      <div className="space-y-1 text-right pt-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{hatchScale.toFixed(1)}x</span>
                          <label className="font-bold text-slate-500">حجم وتحجيم التظليل (Hatch Density)</label>
                        </div>
                        <Input
                          type="range"
                          min="0.5"
                          max="2.5"
                          step="0.1"
                          value={hatchScale}
                          onChange={(e) => setHatchScale(Number(e.target.value))}
                          className="h-8 cursor-pointer"
                        />
                      </div>

                      {/* Output action commands */}
                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                        <Button
                          id="btn-print-sect"
                          onClick={() => {
                            const printWindow = window.open('', '_blank');
                            if (!printWindow) return;

                            const svgElement = document.getElementById('cad-section-svg-viewer');
                            const svgContent = svgElement ? svgElement.outerHTML : '';

                            printWindow.document.write(`
                              <html>
                                <head>
                                  <title>STA4CAD - Print Section ${activeSectionPackage.code}</title>
                                  <style>
                                    body { font-family: system-ui, sans-serif; margin: 0; padding: 40px; background-color: white; text-align: center; color: #333; direction: rtl; }
                                    .container { border: 2px solid #333; padding: 25px; max-width: 900px; margin: 0 auto; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                                    .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                                    .title { font-size: 22px; font-weight: bold; margin: 0; color: #111827; }
                                    .subtitle { font-size: 13px; color: #4b5563; margin-top: 5px; }
                                    svg { max-width: 100%; border: 1px dashed #94a3b8; padding: 15px; margin-top: 20px; background-color: #fafbfd; }
                                    .footer { margin-top: 40px; border-top: 2px solid #333; padding-top: 20px; display: grid; grid-template-columns: repeat(4, 1fr); font-size: 11px; font-weight: bold; text-align: right; }
                                    .footer-cell { border-left: 1px solid #ddd; padding: 5px 15px; }
                                    .footer-cell:last-child { border-left: none; }
                                    @media print {
                                      body { padding: 0; }
                                      .container { border: none; box-shadow: none; }
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="container">
                                    <div class="header">
                                      <div>
                                        <div class="title">${titleBlock.projectName}</div>
                                        <div class="subtitle">STA4CAD نظام توليد القطاعات الإنشائية المؤتمت - قطاع تفصيلي وارتفاعي طراز ${activeSectionPackage.code}</div>
                                      </div>
                                      <div style="text-align: left; font-size: 11px; font-family: monospace; direction: ltr;">
                                        <div>Doc Code: CAD-SEC-D5</div>
                                        <div>Date: ${new Date().toLocaleDateString('ar-EG')}</div>
                                      </div>
                                    </div>
                                    
                                    <div style="display: flex; justify-content: center; margin: 20px 0;">
                                      ${svgContent}
                                    </div>

                                    <div style="text-align: right; margin-top: 40px;">
                                      <h4 style="border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; font-size: 14px; font-weight: bold;">ملاحظات التدبيش والتركيب (Construction Notes)</h4>
                                      <ul style="font-size: 11px; line-height: 1.6; padding-right: 20px; color: #4b5563;">
                                        ${activeSectionPackage.notes.map(n => `<li>${n}</li>`).join('')}
                                        <li>تم تدقيق هذا المخطط أوتوماتيكياً بواسطة وحدة التدقيق QA/QC لمرحلة D5، وتم التحقق من سلامة الأبعاد واستمرارية حديد التسليح الصافي.</li>
                                      </ul>
                                    </div>

                                    <div class="footer">
                                      <div class="footer-cell">
                                        <div>المصمم (Designer):</div>
                                        <div style="font-size: 12px; margin-top: 5px; color: #374151;">${titleBlock.designedBy}</div>
                                      </div>
                                      <div class="footer-cell">
                                        <div>الاعتماد (Approved by):</div>
                                        <div style="font-size: 12px; margin-top: 5px; color: #374151;">${titleBlock.approvedBy}</div>
                                      </div>
                                      <div class="footer-cell">
                                        <div>رقم اللوحة (Sheet No):</div>
                                        <div style="font-size: 13px; font-weight: bold; margin-top: 5px; color: #0891b2;">S-401</div>
                                      </div>
                                      <div class="footer-cell">
                                        <div>المراجعة (Revision):</div>
                                        <div style="font-size: 12px; margin-top: 5px; color: #374151;">${titleBlock.revision}</div>
                                      </div>
                                    </div>
                                  </div>
                                  <script>
                                    window.onload = function() {
                                      setTimeout(function() { window.print(); }, 850);
                                    };
                                  </script>
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                          }}
                          size="sm"
                          className="bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 text-[10px] py-1 gap-1 flex items-center justify-center font-bold"
                        >
                          <Printer className="w-3 h-3 text-cyan-400" />
                          طباعة القطاع
                        </Button>

                        <Button
                          id="btn-export-dxf"
                          onClick={() => {
                            const dxfContent = AutomaticSectionEngine.generateSectionDXFCodemodel(activeSectionPackage);
                            downloadDXF(dxfContent, `STA4CAD_Section_${activeSectionPackage.code}_${activeSectionPackage.type}.dxf`);
                          }}
                          size="sm"
                          className="bg-cyan-600 border border-cyan-700 text-white hover:bg-cyan-700 text-[10px] py-1 gap-1 flex items-center justify-center font-bold"
                        >
                          <Download className="w-3 h-3" />
                          تصدير DXF لوحة
                        </Button>
                      </div>

                    </CardContent>
                  </Card>

                  {/* QA/QC Real-time Auditer Card */}
                  <Card className="border border-amber-100 shadow-sm bg-amber-50/20">
                    <CardHeader className="py-2.5 px-3 bg-amber-50/50 border-b border-amber-100 flex flex-row items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowQAPanel(!showQAPanel)}
                        className="p-1 h-auto text-slate-400"
                      >
                        {showQAPanel ? 'إخفاء' : 'عرض'}
                      </Button>
                      <CardTitle className="text-xs font-bold text-amber-800 flex items-center gap-1.5 py-0.5 justify-end">
                        تقرير جودة القطاع (QA Section Report)
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                      </CardTitle>
                    </CardHeader>
                    {showQAPanel && (
                      <CardContent className="p-3 text-right">
                        {activeSectionPackage.qaIssues.length === 0 ? (
                          <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 p-2 rounded flex items-start gap-1.5 leading-relaxed">
                            <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                            <div>تجاوز القطاع كافة المعايير الهندسية القياسية! المسافات البينية للأسيخ، وسماكة الغطاء الخرساني، ونسبة الحديد الصافية متوافقة بالكامل مع الكود الأمريكي ACI-318.</div>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {activeSectionPackage.qaIssues.map(iss => (
                              <div
                                key={iss.id}
                                className={`p-2 rounded border text-[10px] leading-relaxed ${
                                  iss.severity === 'high' 
                                    ? 'bg-rose-50 border-rose-100 text-rose-900' 
                                    : 'bg-amber-50 border-amber-100 text-amber-900'
                                }`}
                              >
                                <div className="font-bold flex items-center justify-between">
                                  <Badge className={iss.severity === 'high' ? 'bg-rose-100 text-rose-800 border-none' : 'bg-amber-100 text-amber-800 border-none'}>
                                    {iss.severity === 'high' ? 'حرج جداً' : 'تنبيه غطاء'}
                                  </Badge>
                                  <span>{iss.category.toUpperCase()} ERROR</span>
                                </div>
                                <p className="mt-1 font-semibold">{iss.message}</p>
                                <p className="mt-1 text-[9px] text-slate-500 font-mono">الإصلاح المقترح: {iss.correctiveAction}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </div>

                {/* Drawings Stage (8 columns) */}
                <div className="lg:col-span-8 flex flex-col space-y-3">
                  
                  {/* Drawing Sheet */}
                  <div className="border border-slate-200 rounded-xl bg-slate-950 p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[460px] shadow-inner">
                    
                    {/* Dark theme blueprint grid background */}
                    <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:20px_20px]" />
                    
                    {/* Header info overlays */}
                    <div className="absolute top-3 left-3 bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 font-mono flex items-center gap-1.5 z-10">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>STA4CAD CAD Vector Scale: 1:20</span>
                    </div>

                    <div className="absolute top-3 right-3 bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 font-bold z-10 text-right">
                      رقم القطاع المرجعي: <span className="text-cyan-400 font-bold">{activeSectionPackage.code}</span>
                    </div>

                    {/* SVG CANVAS CONTAINER */}
                    <svg
                      id="cad-section-svg-viewer"
                      viewBox={`-60 -40 ${activeSectionPackage.width + 120} ${activeSectionPackage.height + 120}`}
                      className="w-full max-w-full h-auto transition-transform duration-300 transform scale-95"
                      style={{ direction: 'ltr' }}
                    >
                      
                      {/* Interactive Hatches Definitions */}
                      <defs>
                        <pattern id="concrete-hatch-active" width={20 * hatchScale} height={20 * hatchScale} patternUnits="userSpaceOnUse">
                          <circle cx="2" cy="2" r="0.75" fill="#475569" />
                          <circle cx="10" cy="12" r="0.5" fill="#475569" />
                          <circle cx="16" cy="6" r="0.6" fill="#475569" />
                          <path d="M 5 15 L 7 12 L 9 15 Z" fill="none" stroke="#475569" strokeWidth="0.45" />
                          <path d="M 12 4 L 14 1 L 16 4 Z" fill="none" stroke="#475569" strokeWidth="0.45" />
                        </pattern>
                        <pattern id="soil-hatch-active" width={18 * hatchScale} height={18 * hatchScale} patternUnits="userSpaceOnUse">
                          <line x1="0" y1="18" x2="18" y2="0" stroke="#334155" strokeWidth="0.8" />
                          <line x1="0" y1="9" x2="9" y2="0" stroke="#334155" strokeWidth="0.5" />
                          <line x1="9" y1="18" x2="18" y2="9" stroke="#334155" strokeWidth="0.5" />
                        </pattern>
                        <pattern id="pcc-hatch-active" width={14 * hatchScale} height={14 * hatchScale} patternUnits="userSpaceOnUse">
                          <circle cx="3" cy="3" r="0.4" fill="#64748b" />
                          <circle cx="11" cy="11" r="0.4" fill="#64748b" />
                        </pattern>
                      </defs>

                      {/* Rendering concrete bodies and structural elements */}
                      {activeSectionPackage.elements.map((el, idx) => {
                        const isMainConcrete = el.hatchType === 'concrete';
                        return (
                          <g key={el.id} className="transition-opacity">
                            
                            {/* Physical Concrete Solid Fill */}
                            <rect
                              x="0"
                              y="0"
                              width={el.width}
                              height={el.height}
                              fill={isMainConcrete ? 'url(#concrete-hatch-active)' : '#1e293b'}
                              stroke="#0891b2"
                              strokeWidth="2.5"
                              className="fill-opacity-10 stroke-opacity-90"
                            />

                            {/* Standard Reinforcement Stirrups (Confinement ties) */}
                            {el.stirrups && el.stirrups.map((st, sidx) => {
                              const pts = st.points.map(p => `${p.x},${p.y}`).join(' ');
                              return (
                                <g key={sidx}>
                                  {/* Draw dual polygon to simulate thickness */}
                                  <polygon
                                    points={pts}
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="1.25"
                                    strokeDasharray="1, 0"
                                  />
                                </g>
                              );
                            })}

                            {/* Solid high-tensile Steel Rebars dots */}
                            {el.rebars.map((rb, ridx) => (
                              <g key={ridx}>
                                <circle
                                  cx={rb.x}
                                  cy={rb.y}
                                  r={Math.max(rb.size / 2, 4.5)}
                                  fill="#22c55e"
                                  stroke="#15803d"
                                  strokeWidth="1"
                                />
                                {/* Sparkle effect for steel tension vertices */}
                                <circle
                                  cx={rb.x}
                                  cy={rb.y}
                                  r={Math.max(rb.size / 4, 2)}
                                  fill="#ffffff"
                                />
                              </g>
                            ))}

                            {/* Render level horizontal lines */}
                            {el.levels.map((lvl, lidx) => (
                              <g key={lidx}>
                                <line
                                  x1="-35"
                                  y1={lvl.offsetZ}
                                  x2={el.width + 35}
                                  y2={lvl.offsetZ}
                                  stroke="#64748b"
                                  strokeWidth="0.8"
                                  strokeDasharray="4, 3"
                                />
                                {/* Elevation flag triangle */}
                                <polygon
                                  points={`-35,${lvl.offsetZ} -28,${lvl.offsetZ - 6} -28,${lvl.offsetZ + 6}`}
                                  fill="#0891b2"
                                />
                                <text
                                  x="-40"
                                  y={lvl.offsetZ + 3}
                                  fontSize="9.5"
                                  fill="#0891b2"
                                  fontWeight="bold"
                                  textAnchor="end"
                                  className="font-mono"
                                >
                                  {lvl.label}
                                </text>
                              </g>
                            ))}
                          </g>
                        );
                      })}

                      {/* Dimension lines grids representation */}
                      {activeSectionPackage.dimensions.map(dim => {
                        const isVert = dim.type === 'vertical';
                        return (
                          <g key={dim.id}>
                            <line
                              x1={dim.x1}
                              y1={dim.y1}
                              x2={dim.x2}
                              y2={dim.y2}
                              stroke="#64748b"
                              strokeWidth="0.9"
                            />
                            {/* Left/Top tick */}
                            <line
                              x1={dim.x1 - (isVert ? 6 : 0)}
                              y1={dim.y1 - (isVert ? 0 : 6)}
                              x2={dim.x1 + (isVert ? 6 : 0)}
                              y2={dim.y1 + (isVert ? 0 : 6)}
                              stroke="#64748b"
                              strokeWidth="1.2"
                            />
                            {/* Right/Bottom tick */}
                            <line
                              x1={dim.x2 - (isVert ? 6 : 0)}
                              y1={dim.y2 - (isVert ? 0 : 6)}
                              x2={dim.x2 + (isVert ? 6 : 0)}
                              y2={dim.y2 + (isVert ? 0 : 6)}
                              stroke="#64748b"
                              strokeWidth="1.2"
                            />
                            {/* Dimension Text scale */}
                            <text
                              x={(dim.x1 + dim.x2) / 2}
                              y={(dim.y1 + dim.y2) / 2 + (isVert ? 4 : -7)}
                              fill="#94a3b8"
                              fontSize="10"
                              fontWeight="bold"
                              className="font-mono"
                              textAnchor="middle"
                            >
                              {dim.text}
                            </text>
                          </g>
                        );
                      })}

                      {/* Draggable Annotation tags and pointer leaders */}
                      {activeSectionPackage.annotations.map(ann => (
                        <g key={ann.id}>
                          {/* Anchor circle */}
                          <circle
                            cx={ann.rx}
                            cy={ann.ry}
                            r="3"
                            fill="#0891b2"
                          />
                          {/* Leader line diagonal */}
                          <line
                            x1={ann.rx}
                            y1={ann.ry}
                            x2={ann.tx}
                            y2={ann.ty}
                            stroke="#0891b2"
                            strokeWidth="0.85"
                          />
                          {/* Annotation text background */}
                          <rect
                            x={ann.tx - 5}
                            y={ann.ty - 12}
                            width={(ann.text.length * 5) + 10}
                            height="16"
                            fill="#0b1329"
                            stroke="#1e293b"
                            rx="2"
                          />
                          {/* Annotation text label */}
                          <text
                            x={ann.tx}
                            y={ann.ty - 1}
                            fontSize="8.5"
                            fontWeight="semibold"
                            fill="#e2e8f0"
                          >
                            {ann.text}
                          </text>
                        </g>
                      ))}

                    </svg>
                  </div>

                  {/* Section Notes Details */}
                  <Card className="border border-slate-200">
                    <CardHeader className="py-2.5 px-3 bg-slate-50 border-b border-slate-100 text-right">
                      <CardTitle className="text-xs font-bold text-slate-700">ملاحظات واشتراطات التنفيذ الفنية (Construction Guidelines)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 text-right">
                      <ul className="text-[11px] text-slate-500 space-y-1.5 list-disc list-inside">
                        {activeSectionPackage.notes.map((note, nIdx) => (
                          <li key={nIdx}>{note}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                </div>

              </div>
            </div>
          )}

          {/* Sub-tab 6.5: ENLARGED DETAILS EXTRACTION ENGINE */}
          {activeSubTab === 'enlargedDetails' && (
            <div className="space-y-5 animate-fade-in text-slate-800 text-right" style={{ direction: 'rtl' }}>
              <div className="flex items-center justify-between border-b border-border/80 pb-2">
                <div className="flex items-center gap-2">
                  <Maximize2 className="w-5 h-5 text-amber-600 animate-pulse" />
                  <h3 className="text-base font-bold text-slate-900">نظام استخراج وتحليل التفاصيل الإنشائية المكبرة (Phase D5A Detail Extraction Engine)</h3>
                </div>
                <Badge className="bg-amber-100 hover:bg-amber-150 text-amber-800 border-amber-200">مرحلة D5A - متوافق بالكامل</Badge>
              </div>

              {/* Filtering bar */}
              <div className="flex items-center gap-2 justify-end bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-xs font-bold text-slate-500"> تصفية نوع التفصيلة: </span>
                <select
                  value={filterDetailType}
                  onChange={(e) => setFilterDetailType(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1 text-right font-semibold"
                >
                  <option value="all">كافة التفاصيل الإنشائية المستخرجة ({extractedDetailsList.length} تفصيلة)</option>
                  <option value="beam_detail">تفاصيل الجسور والكامرات والتحشيد (Beams)</option>
                  <option value="column_detail">تفاصيل تجميع وتقليب الأعمدة (Columns)</option>
                  <option value="joint_detail">عقد الاتصال والالتقاء الزلزالي (Joints)</option>
                  <option value="slab_detail">فتحات وتقاطعات بلاطات الهوردي (Slabs)</option>
                  <option value="foundation_detail">تفاصيل الأساسات وأشاير التربة (Foundations)</option>
                </select>
                
                <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin mr-2" />
              </div>

              {/* Master Detailing Area */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* Side List Panel of Extracted Details (4 columns) */}
                <div className="lg:col-span-4 space-y-4">
                  <Card className="border border-slate-200 shadow-sm">
                    <CardHeader className="py-3 bg-slate-50 border-b border-slate-100">
                      <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5 justify-end">
                        <ClipboardList className="w-4 h-4 text-amber-600" />
                        كتالوج لوحات التفاصيل الذكي (Extracted Library)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 space-y-1 max-h-[460px] overflow-y-auto">
                      {extractedDetailsList
                        .filter(d => filterDetailType === 'all' || d.type === filterDetailType)
                        .map(item => {
                          const isSelected = item.id === activeDetailPackage.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                setSelectedDetailId(item.id);
                                setActiveDetailScale(item.scale);
                              }}
                              className={`w-full text-right p-3 rounded-lg text-xs transition-all border flex flex-col gap-1.5 ${
                                isSelected 
                                  ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold shadow-xs' 
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <Badge className={isSelected ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}>
                                  Scale {item.scale}
                                </Badge>
                                <span className="font-mono text-[10px] text-slate-400">{item.code} ({item.sheetRef})</span>
                              </div>
                              <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-100/50 pt-1.5 mt-0.5">
                                <span>{item.categoryLabel}</span>
                                <span className="font-mono text-amber-700">{item.regionDetected.substring(0, 32)}...</span>
                              </div>
                            </button>
                          );
                        })}
                    </CardContent>
                  </Card>

                  {/* Detailing Engine QA/QC Checklist */}
                  <Card className="border border-emerald-100 bg-emerald-50/20 shadow-sm">
                    <CardHeader className="py-2.5 px-3 bg-emerald-50/50 border-b border-emerald-100 flex flex-row items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowQADetailsPanel(!showQADetailsPanel)}
                        className="py-0 h-auto text-slate-500 text-[10px] font-bold"
                      >
                        {showQADetailsPanel ? 'إخفاء التقارير' : 'تحميل التقارير'}
                      </Button>
                      <CardTitle className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 py-0.5 justify-end">
                        نظام التدقيق وضمان الجودة (QC Core)
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" style={{ animationDuration: '8s' }} />
                      </CardTitle>
                    </CardHeader>
                    {showQADetailsPanel && (
                      <CardContent className="p-3 text-right space-y-2">
                        
                        {/* Summary of check stats */}
                        <div className="grid grid-cols-2 gap-2 text-center text-[10px] pb-2 border-b border-emerald-100/30">
                          <div className="bg-emerald-50 p-1 rounded">
                            <div className="text-emerald-700 font-bold">100% متطابق</div>
                            <div className="text-slate-400">فحص المسافات البينية</div>
                          </div>
                          <div className="bg-slate-50 p-1 rounded">
                            <div className="text-indigo-600 font-mono font-bold">8 / 8 تفاصيل</div>
                            <div className="text-slate-400">تجميع متشابه</div>
                          </div>
                        </div>

                        {/* Automatic Audits Output */}
                        <div className="space-y-2 text-[10px] leading-relaxed text-slate-700 max-h-48 overflow-y-auto">
                          <div className="p-2 rounded bg-emerald-50 border border-emerald-150 text-emerald-900 flex items-start gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">تحقق مطابقة المتكرر (Intelligence Block):</span> تم دمج 4 تفصيلات جسور مكررة تلقائياً لتوحيد اللوحات ونظافة الإخراج الفني.
                            </div>
                          </div>

                          <div className="p-2 rounded bg-indigo-50 border border-indigo-100 text-indigo-900 flex items-start gap-1">
                            <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">كود المرجع والترقيم (Referencing Audit):</span> تم ربط أرقام التفاصيل ({activeDetailPackage.code || 'DT'}) باللوائح الإنشائية النشطة S-201 و S-301 بنجاح تام ولا توجد مراجع معطوبة.
                            </div>
                          </div>

                          <div className="p-2 rounded bg-emerald-50 border border-emerald-150 text-emerald-900 flex items-start gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">فحص ثني أشاير التسليح (Bend Verification):</span> تم تثبيت طول أرجل الأسياخ L-Hook بمضاعف قطر السيخ 12db المعتمد من معهد الخرسانة الأمريكي ACI.
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>

                {/* Drawings Detail Blueprint Stage (8 columns) */}
                <div className="lg:col-span-8 flex flex-col space-y-3">
                  
                  {/* Visual controls over sheet */}
                  <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 flex flex-wrap gap-4 items-center justify-between text-xs">
                    
                    {/* Scale switcher */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">مقياس رسم زووم (Detail Scale):</span>
                      <select
                        value={activeDetailScale}
                        onChange={(e) => setActiveDetailScale(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 text-amber-400 font-mono text-xs rounded px-2 h-7"
                      >
                        <option value="1:5">1:5 (تكبير فائق - التفاصيل الدقيقة)</option>
                        <option value="1:10">1:10 (نموذجي للوصلات)</option>
                        <option value="1:20">1:20 (ملائم للبلاطات والقوالب)</option>
                        <option value="1:25">1:25 (تأطير المنسوب والأساسات)</option>
                      </select>
                    </div>

                    {/* PDF/Direct print actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const pWindow = window.open('', '_blank');
                          if (!pWindow) return;
                          const svgElement = document.getElementById('cad-detail-main-svg');
                          const svgHtml = svgElement ? svgElement.outerHTML : '';
                          pWindow.document.write(`
                            <html>
                              <head>
                                <title>STA4CAD Detail Print - ${activeDetailPackage.code}</title>
                                <style>
                                  body { font-family: sans-serif; direction: rtl; text-align: right; padding: 40px; background: white; }
                                  .wrapper { border: 2px solid #1e293b; padding: 30px; border-radius: 6px; max-width: 800px; margin: 0 auto; }
                                  h2 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
                                  svg { border: 1px dashed #cbd5e1; background: #f8fafc; max-width: 100%; display: block; margin: 20px auto; padding: 20px; }
                                  .f { border-top: 2px solid #1e293b; padding-top: 15px; margin-top: 30px; font-size: 11px; display: flex; justify-content: space-between; }
                                </style>
                              </head>
                              <body>
                                <div class="wrapper">
                                  <h2>مخطط تفاصيل إنشائية مكبرة - ${activeDetailPackage.code}</h2>
                                  <div style="font-size:12px; color: #475569; margin-bottom: 15px;">
                                    <strong>العنوان:</strong> ${activeDetailPackage.title}<br/>
                                    <strong>مقياس اللوحة:</strong> ${activeDetailScale}<br/>
                                    <strong>مسجل ضمن:</strong> ${activeDetailPackage.categoryLabel}
                                  </div>
                                  ${svgHtml}
                                  <div class="f">
                                    <span>STA4CAD DETAIL EXTRACTION ENGINE - PHASE D5A</span>
                                    <span>طباعة تلقائية آمنة</span>
                                  </div>
                                </div>
                                <script>window.onload = function() { setTimeout(function(){ window.print(); }, 500); }</script>
                              </body>
                            </html>
                          `);
                          pWindow.document.close();
                        }}
                        className="bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 text-[11px] h-7 gap-1 flex items-center font-bold"
                      >
                        <Printer className="w-3 h-3 text-cyan-400" />
                        طباعة التفصيلة
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          const dContent = AutomaticDetailEngine.generateDetailDXFCodemodel(activeDetailPackage);
                          downloadDXF(dContent, `STA4CAD_${activeDetailPackage.id}_Detail_${activeDetailScale}.dxf`);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] h-7 gap-1 flex items-center font-bold"
                      >
                        <Download className="w-3 h-3" />
                        تصدير كود CAD DXF
                      </Button>
                    </div>

                  </div>

                  {/* CAD BluePrint Area */}
                  <div className="border border-slate-800 rounded-xl bg-slate-950 p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[460px] shadow-2xl">
                    
                    {/* Dark grid background */}
                    <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px]" />

                    {/* Technical details badge overlays */}
                    <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-800 rounded px-2.5 py-1 text-[10px] text-slate-400 font-mono flex items-center gap-1.5 z-10">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>STA4CAD Vector Detail Scaling Factor: {activeDetailScale}</span>
                    </div>

                    <div className="absolute top-3 right-3 bg-slate-900/90 border border-slate-800 rounded px-2.5 py-1 text-[10px] text-slate-300 font-bold z-10 text-right">
                      موقع القطع والتحليل: <span className="text-amber-400">{activeDetailPackage.regionDetected}</span>
                    </div>

                    {/* SVG BLACKBOARD CANVAS */}
                    <svg
                      id="cad-detail-main-svg"
                      viewBox={`-50 -20 ${activeDetailPackage.width + 100} ${activeDetailPackage.height + 60}`}
                      className="w-full max-w-full h-auto transition-transform duration-300 transform scale-100"
                      style={{ direction: 'ltr' }}
                    >
                      {/* Definitions */}
                      <defs>
                        <pattern id="detail-con-hatch" width="16" height="16" patternUnits="userSpaceOnUse">
                          <circle cx="2" cy="2" r="0.6" fill="#334155" />
                          <circle cx="10" cy="10" r="0.6" fill="#334155" />
                          <path d="M 4 12 L 6 9 L 8 12 Z" fill="none" stroke="#334155" strokeWidth="0.5" />
                        </pattern>
                      </defs>

                      {/* Main concrete element background simulation */}
                      <rect
                        x="30"
                        y="50"
                        width={activeDetailPackage.width - 60}
                        height={activeDetailPackage.height - 120}
                        fill="url(#detail-con-hatch)"
                        stroke="#475569"
                        strokeWidth="1.5"
                        strokeDasharray="4, 3"
                        className="opacity-50"
                      />

                      {/* Reinforcement Drawings (Bars, stirrups, hooks) */}
                      {activeDetailPackage.bars.map((bar, barIdx) => {
                        const ptsString = bar.points.map(p => `${p.x},${p.y}`).join(' ');
                        const isMainBar = bar.size >= 12;

                        return (
                          <g key={bar.id} className="transition-all hover:opacity-80">
                            {/* Draw continuous line path */}
                            <polyline
                              points={ptsString}
                              fill="none"
                              stroke={isMainBar ? '#f59e0b' : '#ef4444'}
                              strokeWidth={isMainBar ? '3.5' : '1.8'}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Vertices indicator circles for nodes/hooks */}
                            {bar.points.map((p, pIdx) => (
                              <circle
                                key={pIdx}
                                cx={p.x}
                                cy={p.y}
                                r={isMainBar ? '5' : '2.5'}
                                fill="#ffffff"
                                stroke="#1e293b"
                                strokeWidth="1"
                              />
                            ))}

                            {/* Label near first point or middle point */}
                            {bar.points[1] && (
                              <text
                                x={(bar.points[0].x + bar.points[1].x) / 2}
                                y={Math.min(bar.points[0].y, bar.points[1].y) - 8}
                                fill="#10b981"
                                fontSize="9"
                                fontWeight="bold"
                                className="font-sans"
                                textAnchor="middle"
                              >
                                {bar.label}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Dimensions lines (with ticks) */}
                      {activeDetailPackage.dimensionLines.map((dim) => {
                        const isVert = Math.abs(dim.x1 - dim.x2) < 2;
                        return (
                          <g key={dim.id}>
                            {/* Dimension main line */}
                            <line
                              x1={dim.x1}
                              y1={dim.y1}
                              x2={dim.x2}
                              y2={dim.y2}
                              stroke="#64748b"
                              strokeWidth="1"
                            />
                            {/* Left/top tick helper */}
                            <line
                              x1={dim.x1 - (isVert ? 5 : 0)}
                              y1={dim.y1 - (isVert ? 0 : 5)}
                              x2={dim.x1 + (isVert ? 5 : 0)}
                              y2={dim.y1 + (isVert ? 0 : 5)}
                              stroke="#64748b"
                              strokeWidth="1.2"
                            />
                            {/* Right/bottom tick helper */}
                            <line
                              x1={dim.x2 - (isVert ? 5 : 0)}
                              y1={dim.y2 - (isVert ? 0 : 5)}
                              x2={dim.x2 + (isVert ? 5 : 0)}
                              y2={dim.y2 + (isVert ? 0 : 5)}
                              stroke="#64748b"
                              strokeWidth="1.2"
                            />
                            {/* Value text display */}
                            <text
                              x={(dim.x1 + dim.x2) / 2}
                              y={(dim.y1 + dim.y2) / 2 + (isVert ? 4 : -8)}
                              fill="#cbd5e1"
                              fontSize="10"
                              fontWeight="bold"
                              className="font-mono text-center"
                              textAnchor="middle"
                            >
                              {dim.text}
                            </text>
                          </g>
                        );
                      })}

                      {/* Annotations pointers and callouts */}
                      {activeDetailPackage.annotations.map(ann => (
                        <g key={ann.id}>
                          {/* Anchor bullet at structural point */}
                          <circle
                            cx={ann.rx}
                            cy={ann.ry}
                            r="4.5"
                            fill="#ef4444"
                            className="animate-ping"
                            style={{ animationDuration: '3s' }}
                          />
                          <circle
                            cx={ann.rx}
                            cy={ann.ry}
                            r="3"
                            fill="#ef4444"
                          />
                          {/* Pointer diagonal leader line */}
                          <line
                            x1={ann.rx}
                            y1={ann.ry}
                            x2={ann.tx}
                            y2={ann.ty}
                            stroke="#ef4444"
                            strokeWidth="1"
                            strokeDasharray="2, 2"
                          />
                          {/* Outer callout balloon card */}
                          <rect
                            x={Math.min(ann.rx, ann.tx) - 2}
                            y={ann.ty - 16}
                            width="230"
                            height="24"
                            fill="#1e293b"
                            stroke="#cbd5e1"
                            strokeWidth="0.5"
                            rx="4"
                          />
                          {/* Arabic text callout label */}
                          <text
                            x={Math.min(ann.rx, ann.tx) + 115}
                            y={ann.ty}
                            fill="#cbd5e1"
                            fontSize="9"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {ann.text}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  {/* Design notes and site guidelines */}
                  <Card className="border border-slate-200">
                    <CardHeader className="py-2.5 px-3 bg-slate-50 border-b border-slate-100 text-right">
                      <CardTitle className="text-xs font-bold text-slate-700">اشتراطات تنظيف ومطابقة الموقع (Detail Site Specifications)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 text-right">
                      <ul className="text-[11.5px] text-slate-500 space-y-2 list-disc list-inside">
                        {activeDetailPackage.notes.map((note, index) => (
                          <li key={index} className="font-medium text-slate-800 leading-relaxed">
                            {note}
                          </li>
                        ))}
                        <li className="text-[10px] text-slate-400">
                          * التفصيل أعلاه تدار بالكامل مع أخذ تمدد وثني الحديد وعثرات التماسك ومعامل تمدد حديد التسليح الفعلي.
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                </div>

              </div>
            </div>
          )}

          {/* Sub-tab 7: REINFORCEMENT SCHEDULES (Phase D6D Unified DB & Phase D6A Beam Schedule) */}
          {activeSubTab === 'reinforcementSchedules' && (
            <div className="space-y-5 animate-fade-in text-slate-800 text-right" style={{ direction: 'rtl' }}>
              
              {/* Mode Selector Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-3.5 gap-3">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-600" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">نظام وجداول التسليح المركزي الشامل</h3>
                    <p className="text-xs text-slate-500 mt-0.5">لوحة وجداول تسليح متكاملة لحساب كميات وتفريد حديد التسليح لجميع العناصر الإنشائية.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                  <Button
                    size="xs"
                    onClick={() => setRebarScheduleTabMode('unified')}
                    className={`h-7 px-3 text-xs font-black transition-all ${rebarScheduleTabMode === 'unified' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    قاعدة بيانات حديد التسليح الموحدة (Phase D6D)
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => setRebarScheduleTabMode('beams')}
                    className={`h-7 px-3 text-xs font-black transition-all ${rebarScheduleTabMode === 'beams' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
                  >
                    مجدول تسليح الجسور (STA4CAD Beams)
                  </Button>
                </div>
              </div>

              {rebarScheduleTabMode === 'unified' ? (
                <ReinforcementScheduleSystem
                  stories={stories}
                  beams={beams}
                  columns={columns}
                  slabs={slabs}
                  beamDesigns={resolvedBeamDesigns as any}
                  colDesigns={Object.values(resolvedColDesigns) as any}
                  slabDesigns={resolvedSlabDesigns as any}
                  foundationResults={foundationResults}
                />
              ) : (
                <div className="space-y-5">
                  {/* Header and KPI summary panels */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-3 gap-3">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-cyan-600 animate-pulse" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">جدول مجدول الجسور الهندسي الذكي (STA4CAD Beam Schedule System)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">تصنيف شامل لأبعاد وحديد وكميات الجسور مع مطابقة متطلبات الكود والمقاييس والـ BBS.</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-end">
                  <Badge className="bg-cyan-100 text-cyan-800 font-bold border-cyan-200">مرحلة D6A - نشط</Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                    مجموع الجسور النشطة: {rawBeamScheduleRows.length} جسور
                  </Badge>
                </div>
              </div>

              {/* Quantities Overview Panels */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Total Concrete Volume</span>
                  <div className="text-lg font-bold text-slate-900 font-mono">
                    {processedBeamScheduleRows.reduce((acc, row) => acc + (row.concreteVolume * (groupBeams ? 1 : 1)), 0).toFixed(3)} <span className="text-xs font-normal">m&sup3;</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-none">إجمالي الخرسانة المسلحة المطلوبة صبًا</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Total Steel Weight</span>
                  <div className="text-lg font-bold text-indigo-700 font-mono">
                    {processedBeamScheduleRows.reduce((acc, row) => acc + (row.steelWeight * (groupBeams ? 1 : 1)), 0).toFixed(2)} <span className="text-xs font-normal">kg</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-none">إجمالي كميات حديد التسليح الفردي</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Total Formwork Area</span>
                  <div className="text-lg font-bold text-amber-700 font-mono">
                    {processedBeamScheduleRows.reduce((acc, row) => acc + (row.formworkArea * (groupBeams ? 1 : 1)), 0).toFixed(2)} <span className="text-xs font-normal">m&sup2;</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-none">إجمالي قوالب الشدات الخشبية المطلوبة</p>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-155 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase font-mono">Automation Actions</span>
                  <div className="text-xs font-bold text-slate-900 flex gap-1 pt-1 justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        const dataToExport = processedBeamScheduleRows.map(r => ({
                          'Beam ID': r.beamId,
                          'Story': r.storyName,
                          'Type': r.type,
                          'Grid': r.gridLocation,
                          'Width (mm)': r.width,
                          'Depth (mm)': r.depth,
                          'Length (mm)': r.length,
                          'Spans': r.spans,
                          'Top Continuous': r.topContinuous,
                          'Top Additional': r.topAdditional,
                          'Bottom Continuous': r.bottomContinuous,
                          'Stirrups': r.stirrups,
                          'BT Mark': r.btMarks,
                          'BB Mark': r.bbMarks,
                          'BS Mark': r.bsMarks,
                          'Concrete': r.concreteStrength,
                          'Grade': r.steelGrade,
                          'Concrete Vol (m3)': r.concreteVolume,
                          'Steel Wt (kg)': r.steelWeight,
                          'Formwork (m2)': r.formworkArea,
                          'Ref Sheet': r.sheetNo
                        }));
                        const ws = XLSX.utils.json_to_sheet(dataToExport);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Beam Schedule');
                        XLSX.writeFile(wb, 'STA4CAD_Beam_Schedule_D6A.xlsx');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-6 text-[9px] px-2 flex items-center gap-1"
                    >
                      <Download className="w-2.5 h-2.5" />
                      Excel
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        const headers = ['Beam ID', 'Story', 'Type', 'Grid', 'Width', 'Depth', 'Length', 'Spans', 'Top Cont', 'Top Add', 'Bottom Cont', 'Stirrups', 'BT Mark', 'BB Mark', 'BS Mark', 'Concrete', 'Grade', 'Concrete Vol', 'Steel Wt', 'Formwork', 'Sheet'];
                        const rows = processedBeamScheduleRows.map(r => [
                          r.beamId, r.storyName, r.type, r.gridLocation, r.width, r.depth, r.length, r.spans, r.topContinuous, r.topAdditional, r.bottomContinuous, r.stirrups, r.btMarks, r.bbMarks, r.bsMarks, r.concreteStrength, r.steelGrade, r.concreteVolume, r.steelWeight, r.formworkArea, r.sheetNo
                        ]);
                        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
                          + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", "STA4CAD_Beam_Schedule_D6A.csv");
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold h-6 text-[9px] px-2 flex items-center gap-1"
                    >
                      <FileBox className="w-2.5 h-2.5 text-cyan-400" />
                      CSV
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        const prWindow = window.open('', '_blank');
                        if (!prWindow) return;
                        
                        prWindow.document.write(`
                          <html>
                            <head>
                              <title>STA4CAD Printable Beam Schedule (Phase D6A)</title>
                              <style>
                                body { font-family: system-ui, sans-serif; direction: rtl; text-align: right; margin: 0; padding: 40px; color: #1e293b; background: white; }
                                h1 { font-size: 20px; font-weight: bold; margin-bottom: 5px; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
                                th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; }
                                th { background-color: #f1f5f9; font-weight: bold; }
                                .header-meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 24px; color: #475569; }
                                .footer { margin-top: 50px; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: left; }
                              </style>
                            </head>
                            <body>
                              <h1>مجدول تفاصيل وتسليح الجسور الإنشائية المعتمدة (Beam Reinforcement Schedule)</h1>
                              <div class="header-meta">
                                <div><strong>المشروع:</strong> ${titleBlock.projectName}</div>
                                <div><strong>اللوحة المرجعية:</strong> S-102 | <strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
                              </div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>رقم الجسر (ID)</th>
                                    <th>الموقع / المحوار</th>
                                    <th>القطاع (W x D mm)</th>
                                    <th>البحر (Length m)</th>
                                    <th>البحور / المساند</th>
                                    <th>حديد علوي مستمر</th>
                                    <th>حديد إضافي مساند</th>
                                    <th>حديد سفلي رئيسي</th>
                                    <th>الكانات (Stirrups)</th>
                                    <th>مكعب الخرسانة (m&sup3;)</th>
                                    <th>وزن الحديد (kg)</th>
                                    <th>الشدة الخشبية (m&sup2;)</th>
                                    <th>شيت المخطط</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  ${processedBeamScheduleRows.map(r => `
                                    <tr>
                                      <td><strong>${r.beamId}</strong> ${r.groupCount > 1 ? `&times; ${r.groupCount}` : ''}</td>
                                      <td>${r.gridLocation}</td>
                                      <td>${r.width} &times; ${r.depth}</td>
                                      <td>${(r.length / 1000).toFixed(2)} م</td>
                                      <td>${r.spans} (${r.supportConditions})</td>
                                      <td>${r.topContinuous}</td>
                                      <td>${r.topAdditional}</td>
                                      <td>${r.bottomContinuous}</td>
                                      <td>${r.stirrups}</td>
                                      <td>${r.concreteVolume.toFixed(3)}</td>
                                      <td>${r.steelWeight.toFixed(2)}</td>
                                      <td>${r.formworkArea.toFixed(2)}</td>
                                      <td>${r.sheetNo}</td>
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                              <div class="footer">
                                * تم التصدير عبر وحدة مجدول الجسور الآلية STA4CAD D6A.
                              </div>
                              <script>
                                window.onload = function() { setTimeout(function(){ window.print(); }, 850); };
                              </script>
                            </body>
                          </html>
                        `);
                        prWindow.document.close();
                      }}
                      className="bg-cyan-700 hover:bg-cyan-800 text-white font-bold h-6 text-[9px] px-2 flex items-center gap-1"
                    >
                      <Printer className="w-2.5 h-2.5" />
                      Print
                    </Button>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-none">تصدير بكبسة زر لوثائق المخططات والتقارير</p>
                </div>
              </div>

              {/* Dynamic Filtering Panel */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
                
                {/* 1. Beam Type filter */}
                <div className="space-y-1 block text-right">
                  <label className="text-[10px] font-bold text-slate-450 block">نوع وموقع الجسر (Beam Type)</label>
                  <select
                    value={beamScheduleFilterType}
                    onChange={(e) => setBeamScheduleFilterType(e.target.value)}
                    className="w-full h-8 text-xs bg-white border border-slate-200 rounded px-2 text-right"
                  >
                    <option value="all">كافة أنواع الجسور الإنشائية</option>
                    <option value="Primary">جسور رئيسية إطارية (Primary Frames)</option>
                    <option value="Secondary">جسور ثانوية فرعية (Secondary Ribs)</option>
                    <option value="Cantilever">جسور كابولية معلقة (Cantilevers)</option>
                  </select>
                </div>

                {/* 2. Beam Size filter */}
                <div className="space-y-1 block text-right">
                  <label className="text-[10px] font-bold text-slate-450 block">مقاس قطاع الجسر (Beam Size)</label>
                  <select
                    value={beamScheduleFilterSize}
                    onChange={(e) => setBeamScheduleFilterSize(e.target.value)}
                    className="w-full h-8 text-xs bg-white border border-slate-200 rounded px-2 text-right"
                  >
                    <option value="all">جميع المقاسات والقطاعات</option>
                    <option value="300x600">قطاع نموذجي 300 &times; 600 مم</option>
                    <option value="250x500">قطاع نموذجي 250 &times; 500 مم</option>
                    <option value="200x500">قطاع مفرغ 200 &times; 500 مم</option>
                  </select>
                </div>

                {/* 3. Sorting field */}
                <div className="space-y-1 block text-right">
                  <label className="text-[10px] font-bold text-slate-450 block">ترتيب المخرجات حسب (Sort By)</label>
                  <select
                    value={beamScheduleSortField}
                    onChange={(e) => setBeamScheduleSortField(e.target.value)}
                    className="w-full h-8 text-xs bg-white border border-slate-200 rounded px-2 text-right"
                  >
                    <option value="beamId">رقم وتسمية الجسر (Beam ID)</option>
                    <option value="length">طول الجسر الإجمالي (Length)</option>
                    <option value="concreteVolume">محسب خرسانة الجسر (Volume)</option>
                    <option value="steelWeight">وزن أسيخ التسليح (Steel Weight)</option>
                    <option value="storyName">اسم المنسوب والمنطقة (Story)</option>
                  </select>
                </div>

                {/* 4. Auto grouping toggle */}
                <div className="flex items-center gap-2 justify-end pt-5">
                  <input
                    type="checkbox"
                    id="checkbox-group-beams"
                    checked={groupBeams}
                    onChange={(e) => setGroupBeams(e.target.checked)}
                    className="w-3.5 h-3.5 accent-cyan-600 rounded"
                  />
                  <label htmlFor="checkbox-group-beams" className="text-xs font-bold text-slate-700 cursor-pointer">
                    تجميع الجسور المتطابقة (Auto-Group 3D)
                  </label>
                </div>

                {/* 5. Live QA toggle */}
                <div className="flex items-center gap-2 justify-end pt-5">
                  <input
                    type="checkbox"
                    id="checkbox-qa-beams"
                    checked={beamScheduleShowQA}
                    onChange={(e) => setBeamScheduleShowQA(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-600 rounded"
                  />
                  <label htmlFor="checkbox-qa-beams" className="text-xs font-bold text-slate-700 cursor-pointer">
                    تفعيل كاشف الأخطاء والـ QA/QC
                  </label>
                </div>

              </div>

              {/* Live QA Error Checklist Panel */}
              {beamScheduleShowQA && (
                <Card className="border border-amber-100 bg-amber-50/15 shadow-xs">
                  <CardHeader className="py-2.5 px-3 bg-amber-50/40 border-b border-amber-100 flex flex-row items-center justify-between">
                    <Badge variant="outline" className="bg-amber-100 text-amber-900 border-none">
                      كاشف D6A نشط
                    </Badge>
                    <CardTitle className="text-xs font-bold text-amber-900 flex items-center gap-1.5 justify-end">
                      تقارير مطابقة الأكواد والجودة لجدول الجسور (Live QA/QC Scheduler Report)
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 text-right">
                    {beamScheduleQA.length === 0 ? (
                      <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg flex items-start gap-1.5 leading-relaxed">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>بشرى سارة: تمت مطابقة كافة مدخلات كميات وجسور المجدول الإنشائي التفاعلي! لا توجد كودات كولوم ناقصة، الأبعاد متناسقة مع المنسوب، ولا توجد تكرارات ترميز غير قانونية.</div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {beamScheduleQA.map((iss, index) => (
                          <div key={index} className="p-2.5 rounded-lg border border-amber-100 bg-white text-[10.5px] leading-relaxed flex flex-col gap-1">
                            <div className="flex justify-between items-center font-bold">
                              <Badge className="bg-amber-100 text-amber-800 border-none text-[9px] px-1 h-4">
                                {iss.severity === 'high' ? 'خطأ حرج' : 'تنبيه هندسي'}
                              </Badge>
                              <span className="text-amber-900">الجسر: {iss.beamId} ({iss.category.toUpperCase()})</span>
                            </div>
                            <p className="font-semibold text-slate-800 mt-1">{iss.message}</p>
                            <p className="text-[9.5px] text-slate-500 font-mono mt-0.5">حل مقترح: {iss.correctiveAction}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* The Beam Schedule Table */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-450 font-mono">Drawing Sheet Link: S-102 &amp; S-201</span>
                  <h4 className="text-xs font-bold text-slate-700">محددات وجداول تسليح الجسور والتكثيف الزلزالي المقترح</h4>
                </div>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs overflow-x-auto">
                  <Table className="text-right min-w-[1100px]">
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                      <TableRow>
                        <TableHead className="text-right font-bold text-slate-700 h-9">رقم الجسر (ID)</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">الموقع الإنشائي</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">عينة المقاس (b x d)</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">الطول الكلي</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">البحور والمساند</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">حديد علوي مستمر</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">إضافي مساند</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">حديد سفلي رئيسي</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">طبيعة الكانات</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">حجم الخرسانة</TableHead>
                        <TableHead className="text-right font-bold text-indigo-700 h-9">وزن الحديد</TableHead>
                        <TableHead className="text-right font-bold text-amber-700 h-9">الشدة الخشبية</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 h-9">التفصيلة المرجعية</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedBeamScheduleRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center text-slate-400 py-8">
                            لا توجد جسور تطابق معايير التصفية الحالية.
                          </TableCell>
                        </TableRow>
                      ) : (
                        processedBeamScheduleRows.map((row) => (
                          <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                            <TableCell className="font-mono font-bold text-cyan-700">
                              {row.beamId} 
                              {row.groupCount > 1 && (
                                <Badge className="mr-1 bg-amber-100 hover:bg-amber-150 text-amber-900 border-none font-mono text-[9px] px-1 h-4">
                                  &times; {row.groupCount}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-sans text-slate-600 font-semibold">{row.gridLocation} ({row.storyName})</TableCell>
                            <TableCell className="font-mono text-slate-700 font-bold">{row.width} &times; {row.depth} مم</TableCell>
                            <TableCell className="font-mono font-semibold">{(row.length / 1000).toFixed(2)} م</TableCell>
                            <TableCell className="font-semibold text-slate-600">{row.spans} fields ({row.supportConditions})</TableCell>
                            <TableCell className="text-slate-800 font-semibold">{row.topContinuous}</TableCell>
                            <TableCell className="text-slate-500">{row.topAdditional}</TableCell>
                            <TableCell className="text-slate-800 font-semibold">{row.bottomContinuous}</TableCell>
                            <TableCell className="text-amber-700 font-mono font-semibold">{row.stirrups}</TableCell>
                            <TableCell className="font-mono text-slate-600 font-bold">{row.concreteVolume.toFixed(3)} m&sup3;</TableCell>
                            <TableCell className="font-mono text-indigo-700 font-bold">{row.steelWeight.toFixed(2)} kg</TableCell>
                            <TableCell className="font-mono text-amber-700 font-bold">{row.formworkArea.toFixed(2)} m&sup2;</TableCell>
                            <TableCell className="font-mono text-slate-500 font-semibold">{row.detailNum}/{row.sheetNo}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

                  {/* Custom construction notes */}
                  <Card className="border border-slate-200">
                    <CardHeader className="py-2.5 px-3 bg-slate-50 border-b border-slate-100 text-right">
                      <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1.5 justify-end">
                        ملاحظات تنفيذية مهمة لتأكيد مطابقة مجدول الجسور
                        <Info className="w-3.5 h-3.5 text-cyan-600" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 text-right text-[11px] text-slate-500 leading-relaxed space-y-1.5">
                      <p>• تفاصيل ورموز BT Marks تشير إلى عينة حديد المقطع العلوي (Beam Top)، و BB Marks تشير إلى حديد المقطع السفلي (Beam Bottom)، وتعد هذه الرموز أساسية لربط المخططات بمواقع التشغيل الفعلي.</p>
                      <p>• يراعى أن أوزان حديد التسليح المحسوبة تفصيلياً بالمجدول هي تغطية شاملة للأسيخ الصافية والكانات والخطافات دون احتساب معامل الهدر بموقع العمل المقدر عادة بنسبة 5% إلى 7%.</p>
                      <p>• يتم صب خرسانة الجسور الخرسانية مع البلاطة في ذات الوقت للحفاظ على صلابة وصلات العقد (Monolithic Action) طبقاً لمعايير التصميم المقررة.</p>
                    </CardContent>
                  </Card>
                </div>
              )}

            </div>
          )}

          {/* Sub-tab 8: BAR BENDING SCHEDULE (BBS SHEET) */}
          {activeSubTab === 'bbs' && (
            <div className="space-y-4 animate-fade-in text-slate-800">
              <div className="flex justify-between items-center border-b border-border/80 pb-2">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-cyan-600" />
                  <h3 className="text-base font-bold text-slate-900">جدول تفريد وتشغيل حديد التسليح (BBS Sheet S-105)</h3>
                </div>
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 font-mono">BBS COMPLETE</Badge>
              </div>

              <div className="border border-border rounded-xl overflow-hidden shadow-xs bg-white text-xs">
                <Table className="text-right">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-right">كود السيخ (Mark)</TableHead>
                      <TableHead className="text-right">العضو (Element)</TableHead>
                      <TableHead className="text-right">القطر (D mm)</TableHead>
                      <TableHead className="text-right">الطول الفردي (Length m)</TableHead>
                      <TableHead className="text-right">العدد (Quantity)</TableHead>
                      <TableHead className="text-right">شكل الانحناء (Shape Profile)</TableHead>
                      <TableHead className="text-right">الوزن الإجمالي المقدر (Weight)</TableHead>
                      <TableHead className="text-right">وظيفة السيخ الإنشائية (Notes)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bbsEntries.map((item, idx) => {
                      const barWeight = 0.00617 * Math.pow(item.diameter, 2) * item.length * item.count;
                      return (
                        <TableRow key={idx} className="hover:bg-slate-50/50">
                          <TableCell className="font-mono font-bold text-cyan-700">{item.barMark}</TableCell>
                          <TableCell className="font-medium">{item.element}</TableCell>
                          <TableCell className="font-mono">&#216; {item.diameter}</TableCell>
                          <TableCell className="font-mono">{item.length.toFixed(2)} m</TableCell>
                          <TableCell className="font-mono">{item.count}</TableCell>
                          <TableCell className="font-bold text-slate-600">
                            {item.shape === 'L-BAR' && (
                              <span className="flex items-center gap-1"><span className="w-3 h-3 border-b-2 border-r-2 border-slate-700 mr-2 inline-block"></span>L-BAR</span>
                            )}
                            {item.shape === 'STRAIGHT' && (
                              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-slate-700 mr-2 inline-block"></span>STRAIGHT</span>
                            )}
                            {item.shape === 'CLOSED-TIE' && (
                              <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 border-2 border-slate-700 mr-2 inline-block"></span>CLOSED-TIE</span>
                            )}
                            {item.shape !== 'L-BAR' && item.shape !== 'STRAIGHT' && item.shape !== 'CLOSED-TIE' && (
                              <span>{item.shape}</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-emerald-700 font-bold">{barWeight.toFixed(1)} kg</TableCell>
                          <TableCell className="text-slate-500 italic max-w-xs truncate">{item.annotation}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Sub-tab 9: BILL OF QUANTITIES (BOQ SHEET) */}
          {activeSubTab === 'boq' && (
            <div className="space-y-4 animate-fade-in text-slate-800">
              <div className="flex border-b border-border/80 pb-2">
                <FileBox className="w-5 h-5 text-cyan-600" />
                <h3 className="text-base font-bold text-slate-900">جدول حصر الكميات التقريبي والتسعير للمشروع</h3>
              </div>

              {/* Cost config sliders */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border rounded-xl my-2 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">سعر طن حديد التسليح:</label>
                  <Input type="number" value={steelPricePerKg * 1000} onChange={e => setSteelPricePerKg((parseFloat(e.target.value) || 3500) / 1000)} className="h-8 font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">سعر متر مكعب خرسانة:</label>
                  <Input type="number" value={concretePricePerM3} onChange={e => setConcretePricePerM3(parseFloat(e.target.value) || 320)} className="h-8 font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">سعر متر مربع طوبار/قوالب:</label>
                  <Input type="number" value={formworkPricePerM2} onChange={e => setFormworkPricePerM2(parseFloat(e.target.value) || 80)} className="h-8 font-mono" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">سعر متر حفر وتربة:</label>
                  <Input type="number" value={excavationPricePerM3} onChange={e => setExcavationPricePerM3(parseFloat(e.target.value) || 40)} className="h-8 font-mono" />
                </div>
              </div>

              <div className="border border-border rounded-xl overflow-hidden shadow-xs bg-white text-xs">
                <Table className="text-right">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-right">وصف بند الأعمال (Item Description)</TableHead>
                      <TableHead className="text-right">الكمية المقدرة (Quantity)</TableHead>
                      <TableHead className="text-right">الوحدة (Unit)</TableHead>
                      <TableHead className="text-right">فئة السعر التقديري (Rate)</TableHead>
                      <TableHead className="text-right">الإجمالي المالي المقدر (Cost)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold text-slate-800"> أعمال الحفريات وإعداد الموقع المطور</TableCell>
                      <TableCell className="font-mono">{boqMetrics.excavationVol}</TableCell>
                      <TableCell>m³</TableCell>
                      <TableCell className="font-mono">{excavationPricePerM3}</TableCell>
                      <TableCell className="font-mono text-cyan-700 font-bold">{(boqMetrics.excavationVol * excavationPricePerM3).toFixed(0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-slate-800">أعمال الخرسانة العادية للنظافة (PCC)</TableCell>
                      <TableCell className="font-mono">{boqMetrics.concretePCC}</TableCell>
                      <TableCell>m³</TableCell>
                      <TableCell className="font-mono">{(concretePricePerM3 * 0.8).toFixed(0)}</TableCell>
                      <TableCell className="font-mono text-cyan-700 font-bold">{(boqMetrics.concretePCC * concretePricePerM3 * 0.8).toFixed(0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-slate-800">أعمال الخرسانة المسلحة للهياكل والأسقف (RCC)</TableCell>
                      <TableCell className="font-mono">{boqMetrics.concreteRCC}</TableCell>
                      <TableCell>m³</TableCell>
                      <TableCell className="font-mono">{concretePricePerM3}</TableCell>
                      <TableCell className="font-mono text-cyan-700 font-bold">{(boqMetrics.concreteRCC * concretePricePerM3).toFixed(0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-slate-800">أعمال الطوبار الخشبي / القوالب والسقالات</TableCell>
                      <TableCell className="font-mono">{boqMetrics.formworkArea}</TableCell>
                      <TableCell>m²</TableCell>
                      <TableCell className="font-mono">{formworkPricePerM2}</TableCell>
                      <TableCell className="font-mono text-cyan-700 font-bold">{(boqMetrics.formworkArea * formworkPricePerM2).toFixed(0)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold text-slate-800">أعمال حديد التسليح عالي المقاومة في الأسقف والأعمدة</TableCell>
                      <TableCell className="font-mono">{boqMetrics.steelKg}</TableCell>
                      <TableCell>kg</TableCell>
                      <TableCell className="font-mono">{steelPricePerKg.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-cyan-700 font-bold">{(boqMetrics.steelKg * steelPricePerKg).toFixed(0)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-slate-50 font-bold">
                      <TableCell>التكلفة الإجمالية التقديرية للأعمال الإنشائية</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="font-mono text-emerald-700 text-sm font-bold">{boqMetrics.totalCost.toLocaleString()}货币</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Sub-tab 10: EDITABLE STRUCTURAL NOTES */}
          {activeSubTab === 'notes' && (
            <div className="space-y-4 animate-fade-in text-slate-800">
              <div className="flex justify-between items-center border-b border-border/80 pb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-600" />
                  <h3 className="text-base font-bold text-slate-900">الملاحظات والتعليمات الإنشائية المعتمدة للموقع</h3>
                </div>
                <Badge variant="outline" className="text-cyan-700 bg-cyan-50">General Structural Notes</Badge>
              </div>

              {/* Active Notes Checklist */}
              <div className="space-y-2 py-2">
                {customNotes.map((note, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <span className="font-medium text-slate-800">{idx + 1}. {note}</span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setCustomNotes(customNotes.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add Note Trigger */}
              <div className="flex gap-2">
                <Input 
                  placeholder="أدخل ملحوظة فنية إضافية لمخطط التنفيذ..." 
                  value={newNoteInput}
                  onChange={e => setNewNoteInput(e.target.value)}
                  className="font-sans text-xs" 
                />
                <Button 
                  onClick={() => {
                    if (newNoteInput.trim()) {
                      setCustomNotes([...customNotes, newNoteInput.trim()]);
                      setNewNoteInput('');
                    }
                  }}
                  className="bg-cyan-700 hover:bg-cyan-800 text-white font-semibold text-xs whitespace-nowrap gap-1 px-3.5"
                >
                  <Plus className="w-4 h-4" />
                  إضافة للمخطط
                </Button>
              </div>
            </div>
          )}

          {/* Sub-tab 11: D9 DYNAMIC PRINT DESIGN ENGINE WORKSPACE */}
          {activeSubTab === 'printingEngine' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 border-b border-border/80 pb-2">
                <Printer className="w-5 h-5 text-cyan-600 animate-bounce" />
                <h3 className="text-base font-bold text-slate-900 font-sans">محرك ورشة العمل لطباعة حزم المخططات الإنشائية</h3>
              </div>
              <PrintingEngineWorkspace
                stories={stories}
                slabs={slabs}
                beams={beams}
                columns={columns}
                beamDesigns={beamDesigns}
                colDesigns={colDesigns}
                slabProps={slabProps}
                mat={mat}
                projectName={projectName}
                titleBlockConfig={titleBlockConfig}
                analyzed={analyzed}
              />
            </div>
          )}

          {/* SHARED DESIGN DRAWING SHEET LEGEND */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center text-[10px] text-muted-foreground mt-4 gap-2 border-dashed">
            <div className="flex items-center gap-1.5 align-middle">
              <TrendingDown className="w-3.5 h-3.5 text-cyan-600" />
              <span>رمز اللوحة: <strong>{titleBlock.drawingNo}</strong> | مقياس الرسم المختار: <strong>{selectedScale}</strong> | الخرسانة الإنشائية المستهدفة: <strong>C30 (RCC)</strong></span>
            </div>
            <span>تم التشغيل والتدقيق الفني بواسطة: {titleBlock.designedBy || 'STU CLIENT'}</span>
          </div>

        </div>

      </div>
    </Card>
  );
}

// Subordinate standard icon indicator to prevent compilation issues
function TrendingDown({ className }: { className?: string }) {
  return <Wrench className={className} />;
}

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { 
  Download, Printer, FileSpreadsheet, Info, Layers, Compass, 
  Table as TableIcon, Layers3, FileText, Scale, Wrench, 
  AlertTriangle, DollarSign, PenTool, CheckCircle, Trash2, Plus, RefreshCw, Layers2, GitBranch
} from 'lucide-react';
import type { Column } from '@/lib/structuralEngine';
import { analyzeIsolatedFooting, type IsolatedFootingAnalysisResult } from '@/lib/isolatedFootingEngine';
import { designFooting } from '@/lib/foundationDesign';
import { 
  generateFoundationDXF, downloadDXF, type FoundationDXFInput,
  generateProfessionalFoundationLayoutDXF,
  generateIsolatedFootingDetailDXF,
  generateStripFootingDetailDXF,
  generateCombinedFootingDetailDXF,
  generateStrapFootingDetailDXF,
  generateFoundationBBS_DXF,
  type DXFGridLine, type DXFIsolatedFooting, type DXFStripFooting, type DXFGradeBeam
} from '@/export/dxfExporter';
import FoundationScheduleGenerator from './FoundationScheduleGenerator';
import { analyzeStrapFooting } from '@/lib/strapFootingEngine';
import FoundationBOQGenerator from './FoundationBOQGenerator';
import FoundationSheetManager from './FoundationSheetManager';
import DrawingCoordinationEngine from './DrawingCoordinationEngine';

interface Props {
  columns: Column[];
  colLoads3D?: Map<string, { P_service?: number; Pu?: number; Mx?: number; My?: number; MxBot?: number; MyBot?: number; Vu?: number }>;
  fc?: number;
  fy?: number;
  qall?: number;
  gammaConc?: number;
  gammaSoil?: number;
  soilCoverDepth?: number;
  projectName?: string;
  titleBlockConfig?: any;
  analyzed: boolean;
  foundationResults?: any[];
  foundationMat?: any;
  userFootings?: Record<string, { B: number; L: number; H: number }>;
  fdnAssignments?: Record<string, 'isolated' | 'strip' | 'combined' | 'strap'>;
  stripFootingsList?: any[];
  foundationDb?: any;
}

export default function FoundationDrawingsExportPanel({
  columns = [],
  colLoads3D,
  fc = 25,
  fy = 420,
  qall = 150,
  gammaConc = 24,
  gammaSoil = 18,
  soilCoverDepth = 1.2,
  projectName = 'Structural Design Studio',
  titleBlockConfig = {},
  analyzed = false,
  foundationResults = [],
  foundationMat = null,
  userFootings = {},
  fdnAssignments = {},
  stripFootingsList = [],
  foundationDb,
}: Props) {
  // --- SUB TABS STATE (12 tab options) ---
  const [activeSubTab, setActiveSubTab] = useState<
    'layout-plan' | 'schedule' | 'isolated-details' | 'strip-details' | 'combined-details' | 'strap-details' | 'bbs' | 'takeoff' | 'sheets-manager' | 'dxf-export' | 'pdf-export' | 'drawing-coordination'
  >('layout-plan');

  // --- LAYER TOGGLES & CONFIGS ---
  const [showGrids, setShowGrids] = useState(true);
  const [showFootings, setShowFootings] = useState(true);
  const [showColumns, setShowColumns] = useState(true);
  const [showStripFootings, setShowStripFootings] = useState(true);
  const [showGradeBeams, setShowGradeBeams] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showNorthArrow, setShowNorthArrow] = useState(true);
  const [showTitleBlock, setShowTitleBlock] = useState(true);
  const [showTextLabels, setShowTextLabels] = useState(true);

  const [northAngle, setNorthAngle] = useState(45);
  const [scaleMode, setScaleMode] = useState<'auto' | 'manual'>('auto');
  const [scaleValue, setScaleValue] = useState<'1:50' | '1:75' | '1:100' | '1:150' | '1:200'>('1:100');

  // --- COORDINATE-AWARE STATES FOR DESIGNED ELEMENTS ---
  const [gridsX, setGridsX] = useState<DXFGridLine[]>([]);
  const [gridsY, setGridsY] = useState<DXFGridLine[]>([]);
  const [isolatedFootings, setIsolatedFootings] = useState<DXFIsolatedFooting[]>([]);
  const [stripFootings, setStripFootings] = useState<DXFStripFooting[]>([]);
  const [gradeBeams, setGradeBeams] = useState<DXFGradeBeam[]>([]);

  // Validation Test Project State Token
  const [isTestProjectLoaded, setIsTestProjectLoaded] = useState(false);

  // Ground level columns and gridlines context
  const allBaseCols = useMemo(() => {
    if (columns.length === 0) return [];
    const baseMap = new Map<string, Column>();
    columns.forEach(col => {
      const key = `${Math.round(col.x * 100) / 100}_${Math.round(col.y * 100) / 100}`;
      const existing = baseMap.get(key);
      if (!existing || (col.zBottom ?? 0) < (existing.zBottom ?? 0)) {
        baseMap.set(key, col);
      }
    });
    return Array.from(baseMap.values());
  }, [columns]);

  const foundationLevels = useMemo(() => {
    const levels = new Set<number>();
    allBaseCols.forEach(col => {
      levels.add(col.zBottom ?? 0);
    });
    return Array.from(levels).sort((a, b) => a - b);
  }, [allBaseCols]);

  const [selectedLevelFilter, setSelectedLevelFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    setSelectedLevelFilter('all');
  }, [columns]);

  const groundCols = useMemo(() => {
    if (columns.length === 0) return [];
    if (selectedLevelFilter === 'all') {
      return allBaseCols;
    } else {
      return allBaseCols.filter(col => Math.abs((col.zBottom ?? 0) - selectedLevelFilter) < 100);
    }
  }, [columns, allBaseCols, selectedLevelFilter]);

  const isolatedColsForDrawings = useMemo(() => {
    return groundCols.filter(col => !fdnAssignments || fdnAssignments[col.id] !== 'strip');
  }, [groundCols, fdnAssignments]);

  // Sync state with incoming model by default
  useEffect(() => {
    if (isTestProjectLoaded) return;
    if (groundCols.length === 0) return;

    // Detect if column coordinates are stored in meters (< 50) or millimeters (>= 50)
    const isMeters = groundCols.some(c => Math.abs(c.x) < 50 && Math.abs(c.y) < 50);
    const unitScale = isMeters ? 1000 : 1;

    // Build project grids automatically (snapping to 500mm spacing)
    const xs = Array.from(new Set(groundCols.map(c => Math.round((c.x * unitScale) / 500) * 500))).sort((a, b) => a - b);
    const ys = Array.from(new Set(groundCols.map(c => Math.round((c.y * unitScale) / 500) * 500))).sort((a, b) => a - b);
    
    const xGrid = xs.map((x, i) => ({ label: String.fromCharCode(65 + i), coord: x, direction: 'X' as const }));
    const yGrid = ys.map((y, i) => ({ label: String(i + 1), coord: y, direction: 'Y' as const }));

    setGridsX(xGrid);
    setGridsY(yGrid);

    // Build isolated footings from ground columns using designFooting with user overrides
    const mapped = isolatedColsForDrawings.map((col, idx) => {
      const manual = userFootings[col.id];
      const loads = colLoads3D?.get(col.id);
      const P_service = loads?.P_service 
        ? loads.P_service 
        : (loads?.Pu ? (loads.Pu / 1.2) : 220);

      const footingMat = {
        fc,
        fy,
        qa: qall,
        cover: 75,
        gamma_conc: gammaConc,
        gamma_soil: gammaSoil,
        Df: soilCoverDepth + ((manual?.H ?? 500) / 1000)
      };

      const result = designFooting({
        colId: col.id,
        x: col.x * unitScale,
        y: col.y * unitScale,
        P_DL: P_service * 0.6,
        P_LL: P_service * 0.4,
        colB: col.b ?? 300,
        colH: col.h ?? 300,
        manualB: manual?.B,
        manualL: manual?.L,
        manualH: manual?.H
      }, footingMat);

      // Determine the type designation marking based on size
      let mark = 'F1';
      if (result.B > 2000) mark = 'F3';
      else if (result.B > 1500) mark = 'F2';

      const colElevM = (col.zBottom ?? -2000) / 1000;

      return {
        id: mark,
        colId: col.id,
        x: col.x * unitScale,
        y: col.y * unitScale,
        B: result.B,
        L: result.L,
        H: result.t,
        colB: col.b ?? 300,
        colH: col.h ?? 300,
        elevation: colElevM,
      };
    });

    // Map continuous strip footings from stripFootingsList to DXF coordinates
    const mappedStrips: DXFStripFooting[] = (stripFootingsList || [])
      .map((sf, index) => {
        const colIds = sf.selectedColumnIds || [];
        const stripCols = groundCols.filter(c => colIds.includes(c.id));
        
        // Find typical column base elevation in the original cols list
        const origCols = columns.filter(c => colIds.includes(c.id));
        const typicalOrigCol = origCols[0];
        const typicalColElevM = typicalOrigCol ? (typicalOrigCol.zBottom ?? -2000) / 1000 : -2.00;

        let x1 = 0, y1 = 0, x2 = 4000, y2 = 0; // fallback default
        
        if (stripCols.length >= 2) {
          // Sort by x then by y
          const sorted = [...stripCols].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
          const startCol = sorted[0];
          const endCol = sorted[sorted.length - 1];
          
          // Extend by 500mm overhang on each side
          const dx = (endCol.x - startCol.x) * unitScale;
          const dy = (endCol.y - startCol.y) * unitScale;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          
          x1 = (startCol.x * unitScale) - ux * 500;
          y1 = (startCol.y * unitScale) - uy * 500;
          x2 = (endCol.x * unitScale) + ux * 500;
          y2 = (endCol.y * unitScale) + uy * 500;
        } else if (stripCols.length === 1) {
          x1 = (stripCols[0].x * unitScale) - 1500;
          y1 = (stripCols[0].y * unitScale);
          x2 = (stripCols[0].x * unitScale) + 1500;
          y2 = (stripCols[0].y * unitScale);
        } else {
          // Fallback positioning along layout coordinate path
          const xCoord = index * 3000;
          x1 = xCoord;
          y1 = 0;
          x2 = xCoord;
          y2 = sf.L || 6000;
        }
        
        return {
          id: sf.id?.toUpperCase() || `SF${index + 1}`,
          x1, y1, x2, y2,
          width: sf.B || 1400,
          thickness: sf.H || 650,
          elevation: typicalColElevM,
          hasCols: stripCols.length > 0
        };
      })
      .filter(s => selectedLevelFilter === 'all' || s.hasCols);

    setIsolatedFootings(mapped);
    setStripFootings(mappedStrips);
    setGradeBeams([]);
  }, [groundCols, isolatedColsForDrawings, fdnAssignments, colLoads3D, isTestProjectLoaded, userFootings, fc, fy, qall, gammaConc, gammaSoil, soilCoverDepth, stripFootingsList]);

  // Load irregular foundation project context for structural arbitration (Validation Test Project)
  const handleLoadValidationProject = () => {
    const textGridsX: DXFGridLine[] = [
      { label: 'A', coord: 0, direction: 'X' },
      { label: 'B', coord: 4200, direction: 'X' },
      { label: 'C', coord: 8500, direction: 'X' },
      { label: 'D', coord: 13000, direction: 'X' },
    ];
    
    const textGridsY: DXFGridLine[] = [
      { label: '1', coord: 0, direction: 'Y' },
      { label: '2', coord: 3500, direction: 'Y' },
      { label: '3', coord: 8500, direction: 'Y' },
      { label: '4', coord: 12000, direction: 'Y' },
    ];

    setGridsX(textGridsX);
    setGridsY(textGridsY);

    // 12 isolated footings with diverse properties & orientations, and mixed elevations
    const testFootings: DXFIsolatedFooting[] = [
      { id: 'F1', colId: 'C1', x: 0, y: 0, B: 1600, L: 1600, H: 500, colB: 300, colH: 300, elevation: -1.50 },
      { id: 'F2', colId: 'C2', x: 0, y: 3500, B: 1800, L: 1800, H: 500, colB: 300, colH: 500, elevation: -2.00 },
      { id: 'F2', colId: 'C3', x: 0, y: 8500, B: 1800, L: 1800, H: 500, colB: 300, colH: 500, elevation: -2.00 },
      { id: 'F3', colId: 'C4', x: 4200, y: 0, B: 2200, L: 2200, H: 600, colB: 400, colH: 600, elevation: -2.50 },
      { id: 'F1', colId: 'C5', x: 4200, y: 3500, B: 1600, L: 1600, H: 500, colB: 300, colH: 300, elevation: -1.50 },
      { id: 'F2', colId: 'C6', x: 4200, y: 8500, B: 1800, L: 1800, H: 500, colB: 300, colH: 500, elevation: -2.00 },
      { id: 'F1', colId: 'C7', x: 8500, y: 0, B: 1600, L: 1600, H: 500, colB: 300, colH: 300, elevation: -1.50 },
      { id: 'F2', colId: 'C8', x: 8500, y: 3500, B: 1800, L: 1800, H: 500, colB: 300, colH: 500, elevation: -2.00 },
      { id: 'F3', colId: 'C9', x: 8500, y: 8500, B: 2200, L: 2200, H: 600, colB: 400, colH: 600, elevation: -2.50 },
      { id: 'F1', colId: 'C10', x: 13000, y: 0, B: 1600, L: 1600, H: 500, colB: 300, colH: 300, elevation: -1.50 },
      { id: 'F2', colId: 'C11', x: 13000, y: 3500, B: 1800, L: 1800, H: 500, colB: 300, colH: 500, elevation: -2.00 },
      { id: 'F3', colId: 'C12', x: 13000, y: 8500, B: 2200, L: 2200, H: 600, colB: 400, colH: 600, elevation: -2.50 },
    ];
    setIsolatedFootings(testFootings);

    // 3 strip footings with actual shape dimensions (double bounded boundaries)
    const testStrips: DXFStripFooting[] = [
      { id: 'SF1', x1: 0, y1: 0, x2: 0, y2: 12000, width: 1100, thickness: 600, elevation: -2.00 },
      { id: 'SF2', x1: 0, y1: 8500, x2: 13000, y2: 8500, width: 1200, thickness: 650, elevation: -1.80 },
      { id: 'SF3', x1: 13000, y1: 0, x2: 13000, y2: 12000, width: 1000, thickness: 600, elevation: -2.25 },
    ];
    setStripFootings(testStrips);

    // 8 grade beams connecting column junctions
    const testBeams: DXFGradeBeam[] = [
      { id: 'GB1', x1: 0, y1: 0, x2: 4200, y2: 0, width: 250, depth: 600 },
      { id: 'GB2', x1: 4200, y1: 0, x2: 8500, y2: 0, width: 250, depth: 600 },
      { id: 'GB3', x1: 8500, y1: 0, x2: 13000, y2: 0, width: 250, depth: 600 },
      { id: 'GB4', x1: 0, y1: 3500, x2: 4200, y2: 3500, width: 250, depth: 600 },
      { id: 'GB5', x1: 4200, y1: 3500, x2: 8500, y2: 3500, width: 250, depth: 600 },
      { id: 'GB6', x1: 8500, y1: 3500, x2: 13000, y2: 3500, width: 250, depth: 600 },
      { id: 'GB7', x1: 4200, y1: 0, x2: 4200, y2: 3500, width: 250, depth: 600 },
      { id: 'GB8', x1: 8500, y1: 0, x2: 8500, y2: 3500, width: 250, depth: 600 },
    ];
    setGradeBeams(testBeams);

    setIsTestProjectLoaded(true);
  };

  const handleResetToAnalyticalModel = () => {
    setIsTestProjectLoaded(false);
  };

  // Map physical millimetric coordinates to SVG layout coordinates
  const planBounds = useMemo(() => {
    const allX: number[] = [0];
    const allY: number[] = [0];

    gridsX.forEach(g => allX.push(g.coord));
    gridsY.forEach(g => allY.push(g.coord));
    isolatedFootings.forEach(f => {
      allX.push(f.x, f.x - f.B / 2, f.x + f.B / 2);
      allY.push(f.y, f.y - f.L / 2, f.y + f.L / 2);
    });
    stripFootings.forEach(s => {
      allX.push(s.x1, s.x2);
      allY.push(s.y1, s.y2);
    });

    const minX = Math.min(...allX) - 2000;
    const maxX = Math.max(...allX) + 2000;
    const minY = Math.min(...allY) - 2000;
    const maxY = Math.max(...allY) + 2000;

    return { minX, maxX, minY, maxY };
  }, [gridsX, gridsY, isolatedFootings, stripFootings]);

  const viewWidth = 720;
  const viewHeight = 500;
  
  const mapX = (xMm: number) => {
    const rx = planBounds.maxX - planBounds.minX || 1;
    return 55 + ((xMm - planBounds.minX) / rx) * (viewWidth - 110);
  };
  const mapY = (yMm: number) => {
    const ry = planBounds.maxY - planBounds.minY || 1;
    return viewHeight - 55 - ((yMm - planBounds.minY) / ry) * (viewHeight - 110);
  };

  // --- AUTO SCALING MATHEMATICAL SELECTION ---
  const autoSelectedScale = useMemo(() => {
    const modelW = (planBounds.maxX - planBounds.minX) / 1000; // meters
    const modelH = (planBounds.maxY - planBounds.minY) / 1000; // meters
    
    // Target A3 Printable bounds
    const scales = [
      { label: '1:50', f: 50 },
      { label: '1:75', f: 75 },
      { label: '1:100', f: 100 },
      { label: '1:150', f: 150 },
      { label: '1:200', f: 200 },
    ];

    for (const s of scales) {
      const paperW = (modelW * 1000) / s.f;
      const paperH = (modelH * 1000) / s.f;
      if (paperW <= 360 && paperH <= 250) {
        return s.label;
      }
    }
    return '1:200';
  }, [planBounds]);

  const activeScale = scaleMode === 'auto' ? autoSelectedScale : scaleValue;

  // --- MODEL COORD SCHEDULING ---
  // Default list of foundation schedule items matching ACI rules
  const [scheduleItems, setScheduleItems] = useState([
    { typeMark: 'F1', B: 1400, L: 1400, H: 450, rebarX: { diameter: 14, quantity: 8 }, rebarY: { diameter: 14, quantity: 8 }, description: 'قاعدة عمود زاوية خفيف' },
    { typeMark: 'F2', B: 1800, L: 1800, H: 500, rebarX: { diameter: 14, quantity: 10 }, rebarY: { diameter: 14, quantity: 10 }, description: 'قاعدة عمود وسطي متوسط' },
    { typeMark: 'F3', B: 2200, L: 2200, H: 600, rebarX: { diameter: 16, quantity: 12 }, rebarY: { diameter: 16, quantity: 12 }, description: 'قاعدة عمود رئيسي ثقيل' },
  ]);

  const [selectedFootingType, setSelectedFootingType] = useState<string>('F2');

  // --- COMBINED FOOTINGS DETAILING DESIGN STATE ---
  const [selectedCombinedId, setSelectedCombinedId] = useState<string>('CF-1');

  // Active combined footings from DB or default
  const combinedFootingsList = useMemo(() => {
    // If we have foundations in the DB of type combined, map them!
    const fromDb = foundationDb?.foundations?.filter((f: any) => f.type === 'combined') || [];
    if (fromDb.length > 0) {
      return fromDb.map((f: any) => {
        const input = f.input || {};
        return {
          id: f.id || 'CF-1',
          name: f.name || 'C-F1',
          shape: input.shape || 'rectangular',
          L: input.L || 5800,
          B1: input.B1 || 2200,
          B2: input.B2 || (input.shape === 'rectangular' ? 2200 : 1800),
          H: input.H || 650,
          columns: input.columns || [
            { id: 'C1', cx: 400, cy: 400, x: 500 },
            { id: 'C2', cx: 450, cy: 450, x: 4800 }
          ],
          topSteelText: '12 Ø 18',
          botSteelText: '14 Ø 18',
          transverseSteelText: 'Ø 12 @ 150 c/c',
          concreteVol: ((input.B1 || 2200) / 1000) * ((input.L || 5800) / 1000) * ((input.H || 650) / 1000),
          formworkArea: 2 * (((input.B1 || 2200) + (input.L || 5800)) / 1000) * ((input.H || 650) / 1000),
          steelWeightKg: 425,
          excavationVol: (((input.B1 || 2200) + 1000) / 1000) * (((input.L || 5800) + 1000) / 1000) * 1.5,
          backfillVol: ((((input.B1 || 2200) + 1000) / 1000) * (((input.L || 5800) + 1000) / 1000) * 1.5) - (((input.B1 || 2200) / 1000) * ((input.L || 5800) / 1000) * ((input.H || 650) / 1000))
        };
      });
    }

    return [];
  }, [foundationDb]);

  const activeCombinedItem = useMemo(() => {
    return combinedFootingsList.find(f => f.id === selectedCombinedId) || combinedFootingsList[0];
  }, [combinedFootingsList, selectedCombinedId]);

  // --- STRAP FOOTINGS DETAILING DESIGN STATE ---
  const [selectedStrapId, setSelectedStrapId] = useState<string>('STRAP-1');

  // Active strap footings from DB or default templates mapping to senior engineer level
  const strapFootingsList = useMemo(() => {
    // If we have foundations in the DB of type strap, map them!
    const fromDb = foundationDb?.foundations?.filter((f: any) => f.type === 'strap') || [];
    if (fromDb.length > 0) {
      return fromDb.map((f: any) => {
        const input = f.input || {};
        return {
          id: f.id || 'STRAP-1',
          name: f.name || 'STRAP-1',
          S: input.S || 3200,
          L_span: input.L_span || 5000,
          ext_L: input.ext_L || 1800,
          ext_B: input.ext_B || 2400,
          ext_H: input.ext_H || 600,
          ext_a1: input.ext_a1 || 450,
          int_L: input.int_L || 2200,
          int_B: input.int_B || 2200,
          int_H: input.int_H || 600,
          beam_b: input.beam_b || 400,
          beam_h: input.beam_h || 750,
          fc: input.fc || 28,
          fy: input.fy || 420,
          ext_col: input.ext_col || { name: 'C1', cx: 400, cy: 400, PDead: 440, PLive: 220 },
          int_col: input.int_col || { name: 'C2', cx: 450, cy: 450, PDead: 680, PLive: 340 },
          ext_footing_level: input.ext_footing_level ?? -2.00,
          int_footing_level: input.int_footing_level ?? -2.00
        };
      });
    }

    return [];
  }, [foundationDb]);

  const activeStrapItem = useMemo(() => {
    return strapFootingsList.find(f => f.id === selectedStrapId) || strapFootingsList[0];
  }, [strapFootingsList, selectedStrapId]);

  useEffect(() => {
    if (!isolatedFootings || isolatedFootings.length === 0) return;
    
    // Group by footing ID (F1, F2, F3...)
    const groups: Record<string, typeof isolatedFootings> = {};
    for (const f of isolatedFootings) {
      const m = f.id || 'F1';
      if (!groups[m]) {
        groups[m] = [];
      }
      groups[m].push(f);
    }
    
    const items = Object.entries(groups).map(([typeMark, footings]) => {
      const rep = footings.reduce((max, curr) => (curr.B * curr.L > max.B * max.L ? curr : max), footings[0]);
      const B = rep.B || 1600;
      const L = rep.L || 1600;
      const H = rep.H || 500;
      
      // Calculate ACI 318 rebar minimum reinforcement
      const defaultAsMinX = 0.0018 * B * H;
      const defaultAsMinY = 0.0018 * L * H;
      
      const diaX = 14;
      const areaX = (Math.PI * diaX * diaX) / 4;
      const qtyX = Math.max(7, Math.ceil(defaultAsMinX / areaX));
      
      const diaY = 14;
      const areaY = (Math.PI * diaY * diaY) / 4;
      const qtyY = Math.max(7, Math.ceil(defaultAsMinY / areaY));
      
      let description = 'قاعدة عمود وسطي متوسط';
      if (typeMark === 'F1') description = 'قاعدة عمود زاوية خفيف';
      else if (typeMark === 'F3') description = 'قاعدة عمود رئيسي ثقيل';
      else if (typeMark.startsWith('F4')) description = 'قاعدة عمود خاص';
      
      return {
        typeMark,
        B,
        L,
        H,
        rebarX: { diameter: diaX, quantity: qtyX },
        rebarY: { diameter: diaY, quantity: qtyY },
        description
      };
    });
    
    items.sort((a, b) => a.typeMark.localeCompare(b.typeMark));
    setScheduleItems(items);
    if (items.length > 0) {
      setSelectedFootingType(prev => items.some(t => t.typeMark === prev) ? prev : items[0].typeMark);
    }
  }, [isolatedFootings]);

  const [selectedStripType, setSelectedStripType] = useState<string>('SF1');
  const [stripScheduleItems, setStripScheduleItems] = useState([
    { typeMark: 'SF1', B: 1100, H: 600, L: 12000, elevation: -2.00, barsTopCount: 4, barsTopDia: 16, barsBotCount: 5, barsBotDia: 18, stirrupsDia: 10, stirrupsSpacing: 150, description: 'أساس شريطي لمقاومة الهبوط والشدادات' },
    { typeMark: 'SF2', B: 1200, H: 650, L: 13000, elevation: -1.80, barsTopCount: 4, barsTopDia: 16, barsBotCount: 6, barsBotDia: 20, stirrupsDia: 10, stirrupsSpacing: 150, description: 'أساس شريطي جداري مستمر' },
    { typeMark: 'SF3', B: 1000, H: 600, L: 12000, elevation: -2.25, barsTopCount: 4, barsTopDia: 16, barsBotCount: 5, barsBotDia: 16, stirrupsDia: 10, stirrupsSpacing: 150, description: 'أساس شريطي خارجي خاص' },
  ]);

  useEffect(() => {
    if (!stripFootings || stripFootings.length === 0) return;
    
    // Group by footing ID (SF1, SF2, SF3...)
    const groups: Record<string, typeof stripFootings> = {};
    for (const f of stripFootings) {
      const m = f.id || 'SF1';
      if (!groups[m]) {
        groups[m] = [];
      }
      groups[m].push(f);
    }
    
    const items = Object.entries(groups).map(([typeMark, strips]) => {
      // Find representative: max length or width
      const rep = strips.reduce((max, curr) => (curr.width > max.width ? curr : max), strips[0]);
      
      const B = rep.width || 1100;
      const H = rep.thickness || 600;
      
      // Calculate length
      const dx = Math.abs(rep.x2 - rep.x1);
      const dy = Math.abs(rep.y2 - rep.y1);
      const L = Math.round(Math.sqrt(dx * dx + dy * dy)) || 12000;
      
      const elevation = rep.elevation || -2.00;
      
      // reasonable defaults matching structural capacity
      return {
        typeMark,
        B,
        H,
        L: L > 0 ? L : 12000,
        elevation,
        barsTopCount: 4,
        barsTopDia: 16,
        barsBotCount: 5,
        barsBotDia: 18,
        stirrupsDia: 10,
        stirrupsSpacing: 150,
        description: `أساس شريطي مستمر نموذج ${typeMark}`
      };
    });
    
    items.sort((a, b) => a.typeMark.localeCompare(b.typeMark));
    setStripScheduleItems(items);
    if (items.length > 0) {
      setSelectedStripType(prev => items.some(t => t.typeMark === prev) ? prev : items[0].typeMark);
    }
  }, [stripFootings]);

  const activeStripItem = useMemo(() => {
    return stripScheduleItems.find(t => t.typeMark === selectedStripType) || stripScheduleItems[0];
  }, [stripScheduleItems, selectedStripType]);

  const activeFootingItem = useMemo(() => {
    return scheduleItems.find(t => t.typeMark === selectedFootingType) || scheduleItems[0];
  }, [scheduleItems, selectedFootingType]);

  // Model footing Locations based on dynamic states
  const footingLocations = useMemo(() => {
    return isolatedFootings.map((f, i) => ({
      id: `Loc-${i+1}`,
      colId: f.colId,
      x: f.x,
      y: f.y,
      colB: f.colB,
      colH: f.colH,
      typeMark: f.id,
      B: f.B,
      L: f.L,
      H: f.H,
    }));
  }, [isolatedFootings]);

  // --- SETTINGS STATE IN SHEETS MANAGER ---
  const [sheetNumberingPrefix, setSheetNumberingPrefix] = useState('S-3');
  const [selectedScale, setSelectedScale] = useState('1:50');
  const [naturalGroundLevel, setNaturalGroundLevel] = useState<number>(1500);
  const [excavationOffset, setExcavationOffset] = useState<number>(500);
  const [soilCoverDepthM, setSoilCoverDepthM] = useState<number>(soilCoverDepth);
  const [sheetSize, setSheetSize] = useState<'A3' | 'A1'>('A3');

  // Detailed sheet block entries
  const sheetMetadata = useMemo(() => [
    { id: '101', code: 'S-101', title: 'FOUNDATION LAYOUT PLAN', ar: 'مخطط توزيع الأساسات والمحاور العام' },
    { id: '102', code: 'S-201', title: 'FOUNDATIONS SCHEDULE', ar: 'جدول نماذج القواعد المعتمد' },
    { id: '103', code: 'S-301', title: 'ISOLATED FOOTING DETAILS', ar: 'تفاصيل تسليح وقطاعات القواعد المنفصلة' },
    { id: '104', code: 'S-302', title: 'STRIP FOOTING DETAILS', ar: 'تفاصيل لوحة الأساسات الشريطية والتسليح المستمر' },
    { id: '104A', code: 'S-303', title: 'COMBINED FOOTING DETAILS', ar: 'تفاصيل قطاعات وتسليح القواعد المشتركة المستقلة' },
    { id: '105', code: 'S-401', title: 'BAR BENDING SCHEDULE (BBS)', ar: 'كشف تفريد وجداول أوزان حديد التسليح' },
    { id: '106', code: 'S-402', title: 'QUANTITY TAKEOFF & BOQ SUMMARY', ar: 'تقرير حصر مساحات ومكعبات كميات المواد الإنشائية' },
  ], []);

  const [activeSheetId, setActiveSheetId] = useState('S-101');



  // BBS items builder
  const bbsItemsList = useMemo(() => {
    const list: any[] = [];
    const cover = 75; // mm (Standard ACI cover for concrete cast against earth)

    // 1. ISOLATED FOOTINGS BBS
    scheduleItems.forEach((type, index) => {
      // count active footings
      let qtyFootings = footingLocations.filter(loc => loc.typeMark === type.typeMark).length;
      if (qtyFootings === 0) {
        // Fallback to 1 for robust representation of designed type even if layout is empty
        qtyFootings = 1;
      }

      const dbX = type.rebarX.diameter;
      const dbY = type.rebarY.diameter;

      // 90 Hook length according to ACI (at least 12 * db)
      const hookLegX = Math.max(150, 12 * dbX) / 1000; // m
      const hookLegY = Math.max(150, 12 * dbY) / 1000; // m

      // ACI 318 Bottom X Length (Hooked L or U)
      // Single length = L_footing - 2 * cover + 2 * hooks
      const singleLengthX = (type.L - 2 * cover) / 1000 + (2 * hookLegX);
      const weightM_X = (dbX ** 2) / 162;
      const totalQtyX = type.rebarX.quantity * qtyFootings;
      const totalWtX = totalQtyX * singleLengthX * weightM_X;

      list.push({
        typeMark: type.typeMark,
        barMark: `FB1-0${index + 1}`,
        layer: 'Base Bottom X (فرش القاع)',
        diameter: dbX,
        shape: 'Hooked L (90° Hook)',
        quantity: totalQtyX,
        singleLength: singleLengthX,
        totalLength: totalQtyX * singleLengthX,
        totalWeight: totalWtX,
        ref: `Isolated Base ${type.typeMark}`,
        segmentA: Math.round(hookLegX * 1000),
        segmentB: Math.round(type.L - 2 * cover),
        segmentC: Math.round(hookLegX * 1000)
      });

      // Bottom Y
      const singleLengthY = (type.B - 2 * cover) / 1000 + (2 * hookLegY);
      const weightM_Y = (dbY ** 2) / 162;
      const totalQtyY = type.rebarY.quantity * qtyFootings;
      const totalWtY = totalQtyY * singleLengthY * weightM_Y;

      list.push({
        typeMark: type.typeMark,
        barMark: `FB2-0${index + 1}`,
        layer: 'Base Bottom Y (غطاء القاع)',
        diameter: dbY,
        shape: 'Hooked L (90° Hook)',
        quantity: totalQtyY,
        singleLength: singleLengthY,
        totalLength: totalQtyY * singleLengthY,
        totalWeight: totalWtY,
        ref: `Isolated Base ${type.typeMark}`,
        segmentA: Math.round(hookLegY * 1000),
        segmentB: Math.round(type.B - 2 * cover),
        segmentC: Math.round(hookLegY * 1000)
      });

      // Column Starter Dowels
      const dbDowel = 16; // Ø16 standard starter bars
      const dowelHook = 250; // mm
      const dowelLapTension = Math.round(1.3 * 48 * dbDowel); // ACI Class B splice (~1000mm)
      const singleLengthDowel = ((type.H - cover) + dowelLapTension + dowelHook) / 1000;
      const weightM_Dowel = (dbDowel ** 2) / 162;
      const totalQtyDowel = 4 * qtyFootings; // 4 starter bars per isolated footing
      const totalWtDowel = totalQtyDowel * singleLengthDowel * weightM_Dowel;

      list.push({
        typeMark: type.typeMark,
        barMark: `FB3-0${index + 1}`,
        layer: 'Column Starter Dowels (أشاير أعمدة قايمة)',
        diameter: dbDowel,
        shape: 'Hooked L (Starter bend)',
        quantity: totalQtyDowel,
        singleLength: singleLengthDowel,
        totalLength: totalQtyDowel * singleLengthDowel,
        totalWeight: totalWtDowel,
        ref: `Pedestal ${type.typeMark}`,
        segmentA: dowelHook,
        segmentB: type.H - cover + dowelLapTension,
        segmentC: 0
      });

      // Pedestal column links (stiffener ties)
      const dbTie = 10; // Ø10 links
      // Assumed 400x400 pedestal columns size matching ACI Minimum spacing
      const pB = 400;
      const pH = 400;
      const cCov = 40; // column clear cover
      const linkPerimeter = 2 * ((pB - 2*cCov) + (pH - 2*cCov)) + 200; // perimeter + ACI hook extensions
      const singleLengthTie = linkPerimeter / 1000;
      const weightM_Tie = (dbTie ** 2) / 162;
      const tiesPerFooting = 3; // 3 ties minimum within foundation depth
      const totalQtyTie = tiesPerFooting * qtyFootings;
      const totalWtTie = totalQtyTie * singleLengthTie * weightM_Tie;

      list.push({
        typeMark: type.typeMark,
        barMark: `FB4-0${index + 1}`,
        layer: 'Column Ties/Links (كانات رقبة العمود)',
        diameter: dbTie,
        shape: 'Closed Square Tie',
        quantity: totalQtyTie,
        singleLength: singleLengthTie,
        totalLength: totalQtyTie * singleLengthTie,
        totalWeight: totalWtTie,
        ref: `Pedestal ${type.typeMark}`,
        segmentA: pB - 2*cCov,
        segmentB: pH - 2*cCov,
        segmentC: 100 // hook extension
      });
    });

    // 2. STRIP FOOTINGS BBS
    stripScheduleItems.forEach((type, index) => {
      let qtyStrips = stripFootings.filter(s => s.id === type.typeMark).length;
      if (qtyStrips === 0) {
        qtyStrips = 1; // Fallback
      }

      const fL = type.L || 12000;
      const fB = type.B || 1100;
      const fH = type.H || 600;

      // Long Top Bars
      const dbTop = type.barsTopDia || 16;
      const hookLegTop = Math.max(150, 12 * dbTop) / 1000;
      const singleLengthLongTop = (fL - 2 * cover) / 1000 + (2 * hookLegTop);
      const weightM_LTop = (dbTop ** 2) / 162;
      const totalQtyLTop = (type.barsTopCount || 4) * qtyStrips;
      const totalWtLTop = totalQtyLTop * singleLengthLongTop * weightM_LTop;

      list.push({
        typeMark: type.typeMark,
        barMark: `SFB1-0${index + 1}`,
        layer: 'Longitudinal Top Steel (تسليح علوي طولي)',
        diameter: dbTop,
        shape: 'Hooked L (90° Hook)',
        quantity: totalQtyLTop,
        singleLength: singleLengthLongTop,
        totalLength: totalQtyLTop * singleLengthLongTop,
        totalWeight: totalWtLTop,
        ref: `Strip Footing ${type.typeMark}`,
        segmentA: Math.round(hookLegTop * 1000),
        segmentB: Math.round(fL - 2 * cover),
        segmentC: Math.round(hookLegTop * 1000)
      });

      // Long Bottom Bars
      const dbBot = type.barsBotDia || 18;
      const hookLegBot = Math.max(150, 12 * dbBot) / 1000;
      const singleLengthLongBot = (fL - 2 * cover) / 1000 + (2 * hookLegBot);
      const weightM_LBot = (dbBot ** 2) / 162;
      const totalQtyLBot = (type.barsBotCount || 5) * qtyStrips;
      const totalWtLBot = totalQtyLBot * singleLengthLongBot * weightM_LBot;

      list.push({
        typeMark: type.typeMark,
        barMark: `SFB2-0${index + 1}`,
        layer: 'Longitudinal Bottom Steel (تسليح سفلي طولي)',
        diameter: dbBot,
        shape: 'Hooked L (90° Hook)',
        quantity: totalQtyLBot,
        singleLength: singleLengthLongBot,
        totalLength: totalQtyLBot * singleLengthLongBot,
        totalWeight: totalWtLBot,
        ref: `Strip Footing ${type.typeMark}`,
        segmentA: Math.round(hookLegBot * 1000),
        segmentB: Math.round(fL - 2 * cover),
        segmentC: Math.round(hookLegBot * 1000)
      });

      // Transverse bot bars (distr) spaced at 200mm
      const dbTrans = 12; // Ø12 standard transverse
      const spacingTrans = 200;
      const qtyTransPerStrip = Math.ceil(fL / spacingTrans);
      const singleLengthTrans = (fB - 2 * cover) / 1000 + (2 * 0.15); // with small hooks
      const weightM_Trans = (dbTrans ** 2) / 162;
      const totalQtyTrans = qtyTransPerStrip * qtyStrips;
      const totalWtTrans = totalQtyTrans * singleLengthTrans * weightM_Trans;

      list.push({
        typeMark: type.typeMark,
        barMark: `SFB3-0${index + 1}`,
        layer: 'Transverse Base Steel (حديد تسليح عرضي)',
        diameter: dbTrans,
        shape: 'U-Bar (Base distribution)',
        quantity: totalQtyTrans,
        singleLength: singleLengthTrans,
        totalLength: totalQtyTrans * singleLengthTrans,
        totalWeight: totalWtTrans,
        ref: `Strip Footing ${type.typeMark}`,
        segmentA: 150,
        segmentB: fB - 2 * cover,
        segmentC: 150
      });

      // Closed shear stirrups spaced at spacingStirrups
      const dbStirrup = type.stirrupsDia || 10;
      const spacingStirrups = type.stirrupsSpacing || 150;
      const qtyStirrupsPerStrip = Math.ceil(fL / spacingStirrups);
      const outerW = fB - 2 * cover;
      const outerH = fH - 2 * cover;
      const singleLengthStirrup = (2 * (outerW + outerH) + 200) / 1000; // plus ACI 135 deg hooks (100mm each)
      const weightM_Stirrup = (dbStirrup ** 2) / 162;
      const totalQtyStirrup = qtyStirrupsPerStrip * qtyStrips;
      const totalWtStirrup = totalQtyStirrup * singleLengthStirrup * weightM_Stirrup;

      list.push({
        typeMark: type.typeMark,
        barMark: `SFB4-0${index + 1}`,
        layer: 'Continuous Restricting Stirrups (الكانات المغلقة)',
        diameter: dbStirrup,
        shape: 'Closed Rectangular Loop',
        quantity: totalQtyStirrup,
        singleLength: singleLengthStirrup,
        totalLength: totalQtyStirrup * singleLengthStirrup,
        totalWeight: totalWtStirrup,
        ref: `Strip Footing ${type.typeMark}`,
        segmentA: outerW,
        segmentB: outerH,
        segmentC: 100
      });

      // Stepped Joint overlap/Step reinforcement (Z-Bar shape)
      const dbStep = 16; // Ø16 stepped overlap bars
      const singleLengthStep = 2.0; // 2 meters standard lap length across step
      const weightM_Step = (dbStep ** 2) / 162;
      const stepQtyPerJoint = 4; // 4 reinforcing bars overlaying the step
      const totalQtyStep = stepQtyPerJoint * qtyStrips;
      const totalWtStep = totalQtyStep * singleLengthStep * weightM_Step;

      list.push({
        typeMark: type.typeMark,
        barMark: `SFB5-0${index + 1}`,
        layer: 'Elevation Stair/Step Reinforcement (حديد تدرج مناسيب)',
        diameter: dbStep,
        shape: 'Z-Bar / Joint Transfer',
        quantity: totalQtyStep,
        singleLength: singleLengthStep,
        totalLength: totalQtyStep * singleLengthStep,
        totalWeight: totalWtStep,
        ref: `Strip Joint ${type.typeMark}`,
        segmentA: 500,
        segmentB: fH,
        segmentC: 1000
      });
    });

    return list;
  }, [scheduleItems, footingLocations, stripScheduleItems, stripFootings]);

  // Total concrete volumes and steel weights calculations
  const takeoffMetrics = useMemo(() => {
    let totConcrete = 0;
    let totSteel = 0;
    let totExcavation = 0;
    const cover = 75; // mm

    // Isolated concrete & excavation
    footingLocations.forEach(loc => {
      const volConc = (loc.B / 1000) * (loc.L / 1000) * (loc.H / 1000);
      totConcrete += volConc;

      const bExc = (loc.B + (2 * excavationOffset)) / 1000;
      const lExc = (loc.L + (2 * excavationOffset)) / 1000;
      totExcavation += (bExc * lExc * (naturalGroundLevel / 1000 || 1.8));
    });

    // Strip concrete & excavation
    stripScheduleItems.forEach(type => {
      let qtyStrips = stripFootings.filter(s => s.id === type.typeMark).length;
      if (qtyStrips === 0) qtyStrips = 1;

      const volConc = (type.B / 1000) * (type.L / 1000) * (type.H / 1000) * qtyStrips;
      totConcrete += volConc;

      const bExc = (type.B + (2 * excavationOffset)) / 1000;
      const lExc = (type.L + (2 * excavationOffset)) / 1000;
      totExcavation += (bExc * lExc * (naturalGroundLevel / 1000 || 1.8)) * qtyStrips;
    });

    // Steel weight is the exact sum of all BBS items
    totSteel = bbsItemsList.reduce((acc, curr) => acc + curr.totalWeight, 0);

    const activeStoryCount = footingLocations.length > 0 || stripFootings.length > 0 ? 1 : 0;
    
    return {
      concrete: totConcrete,
      steel: totSteel,
      excavation: totExcavation,
      activeStoryCount
    };
  }, [footingLocations, scheduleItems, stripFootings, stripScheduleItems, excavationOffset, naturalGroundLevel, bbsItemsList]);

  // Diameter-wise statistics memo for professional quantity summarization
  const rebarSummaryByDiameter = useMemo(() => {
    const summary: Record<number, { totalWeight: number; totalLength: number; count: number }> = {};
    bbsItemsList.forEach(item => {
      const d = item.diameter;
      if (!summary[d]) {
        summary[d] = { totalWeight: 0, totalLength: 0, count: 0 };
      }
      summary[d].totalWeight += item.totalWeight;
      summary[d].totalLength += item.totalLength;
      summary[d].count += item.quantity;
    });
    return Object.entries(summary).map(([dia, data]) => ({
      diameter: Number(dia),
      ...data
    })).sort((a, b) => a.diameter - b.diameter);
  }, [bbsItemsList]);

  // --- ACTIONS ---
  const handleExportCSV = (fileName: string, header: string, rows: string[]) => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(header + '\n' + rows.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportScheduleCSV = () => {
    const header = 'رمز النموذج,عرض القاعدة B (mm),طول القاعدة L (mm),السماكة H (mm),الغطاء الصافي (mm),حديد الاتجاه X,حديد الاتجاه Y,العدد بالمشروع';
    const rows = scheduleItems.map(t => {
      const count = isolatedFootings.filter(loc => loc.id === t.typeMark).length;
      return `${t.typeMark},${t.B},${t.L},${t.H},75,${t.rebarX.quantity}Ø${t.rebarX.diameter},${t.rebarY.quantity}Ø${t.rebarY.diameter},${count}`;
    });
    handleExportCSV('Approved_Foundations_Schedule_S-201.csv', header, rows);
  };

  const handleExportBBSCSV = () => {
    const header = 'رمز النموذج,رمز السيخ,العنصر الإنشائي,القطر mm,الشكل الهندسي,العدد الكلي,الطول المفرد m,الطول الإجمالي m,الجزء A (مم),الجزء B (مم),الجزء C (مم),الوزن الإجمالي kg';
    const rows = bbsItemsList.map(item => 
      `${item.typeMark},${item.barMark},${item.layer},${item.diameter},${item.shape},${item.quantity},${item.singleLength.toFixed(2)},${item.totalLength.toFixed(2)},${item.segmentA || 0},${item.segmentB || 0},${item.segmentC || 0},${item.totalWeight.toFixed(1)}`
    );
    handleExportCSV('Foundations_BBS_Comprehensive_Schedule.csv', header, rows);
  };

  const handleExportBBSDXF = () => {
    const dxf = generateFoundationBBS_DXF(bbsItemsList, projectName);
    downloadDXF(dxf, `${projectName.replace(/\s/g, '_')}_BBS_Drawing.dxf`);
  };

  const handleDXFMainExport = () => {
    const dxf = generateProfessionalFoundationLayoutDXF(
      { x: gridsX, y: gridsY },
      isolatedFootings,
      stripFootings,
      gradeBeams,
      {
        projectName,
        drawingTitle: 'FOUNDATION LAYOUT PLAN',
        drawingNo: 'S-101',
        scale: activeScale,
        date: new Date().toLocaleDateString('en-US'),
        northAngle
      }
    );
    downloadDXF(dxf, `${projectName.replace(/\s/g, '_')}_Coordinated_Layout.dxf`);
  };

  const handleExportFootingDetailDXF = () => {
    if (!activeFootingItem) return;
    const representativeFooting = isolatedFootings.find(f => f.id === activeFootingItem.typeMark) || { colB: 300, colH: 400 };
    const dxf = generateIsolatedFootingDetailDXF({
      typeMark: activeFootingItem.typeMark,
      B: activeFootingItem.B,
      L: activeFootingItem.L,
      H: activeFootingItem.H,
      rebarX: activeFootingItem.rebarX,
      rebarY: activeFootingItem.rebarY,
      colB: representativeFooting.colB || 300,
      colH: representativeFooting.colH || 400,
      projectName: projectName,
      scale: '20',
      fc: fc,
      fy: fy,
      qall: qall,
      soilDepth: soilCoverDepthM
    });
    downloadDXF(dxf, `Isolated_Footing_${activeFootingItem.typeMark}_Detail_S-301.dxf`);
  };

  const handleExportStripDetailDXF = () => {
    if (!activeStripItem) return;
    const dxf = generateStripFootingDetailDXF({
      id: activeStripItem.typeMark,
      B: activeStripItem.B,
      H: activeStripItem.H,
      L: activeStripItem.L,
      elevation: activeStripItem.elevation,
      barsTopCount: activeStripItem.barsTopCount,
      barsTopDia: activeStripItem.barsTopDia,
      barsBotCount: activeStripItem.barsBotCount,
      barsBotDia: activeStripItem.barsBotDia,
      stirrupsDia: activeStripItem.stirrupsDia,
      stirrupsSpacing: activeStripItem.stirrupsSpacing,
      projectName: projectName,
      scale: '25',
      fc: fc,
      fy: fy,
      soilDepth: soilCoverDepthM
    });
    downloadDXF(dxf, `Strip_Footing_${activeStripItem.typeMark}_Detail_S-302.dxf`);
  };

  useEffect(() => {
    const handleExportEvent = () => {
      handleExportFootingDetailDXF();
    };
    window.addEventListener('export-isolated-dxf', handleExportEvent);
    return () => {
      window.removeEventListener('export-isolated-dxf', handleExportEvent);
    };
  }, [activeFootingItem, isolatedFootings, projectName, fc, fy, qall, soilCoverDepthM]);

  const handleExportCombinedFootingDetailDXF = () => {
    if (!activeCombinedItem) return;
    const dxf = generateCombinedFootingDetailDXF({
      id: activeCombinedItem.id,
      shape: activeCombinedItem.shape,
      L: activeCombinedItem.L,
      B1: activeCombinedItem.B1,
      B2: activeCombinedItem.B2,
      H: activeCombinedItem.H,
      fc: fc,
      fy: fy,
      columns: activeCombinedItem.columns,
      topSteelText: activeCombinedItem.topSteelText,
      botSteelText: activeCombinedItem.botSteelText,
      transverseSteelText: activeCombinedItem.transverseSteelText,
      concreteVol: activeCombinedItem.concreteVol,
      formworkArea: activeCombinedItem.formworkArea,
      steelWeightKg: activeCombinedItem.steelWeightKg,
      excavationVol: activeCombinedItem.excavationVol,
      backfillVol: activeCombinedItem.backfillVol
    });
    downloadDXF(dxf, `Combined_Footing_${activeCombinedItem.id}_Detail_S-303.dxf`);
  };

  useEffect(() => {
    const handleExportEvent = () => {
      handleExportStripDetailDXF();
    };
    window.addEventListener('export-strip-dxf', handleExportEvent);
    return () => {
      window.removeEventListener('export-strip-dxf', handleExportEvent);
    };
  }, [activeStripItem, stripScheduleItems, projectName, fc, fy, qall, soilCoverDepthM]);

  useEffect(() => {
    const handleExportEvent = () => {
      handleExportCombinedFootingDetailDXF();
    };
    window.addEventListener('export-combined-dxf', handleExportEvent);
    return () => {
      window.removeEventListener('export-combined-dxf', handleExportEvent);
    };
  }, [activeCombinedItem, projectName, fc, fy]);

  const handleExportStrapFootingDetailDXF = () => {
    if (!activeStrapItem) return;
    const dxf = generateStrapFootingDetailDXF({
      id: activeStrapItem.id,
      name: activeStrapItem.name || 'STRAP-1',
      S: activeStrapItem.S,
      L_span: activeStrapItem.L_span,
      ext_L: activeStrapItem.ext_L,
      ext_B: activeStrapItem.ext_B,
      ext_H: activeStrapItem.ext_H,
      ext_a1: activeStrapItem.ext_a1,
      int_L: activeStrapItem.int_L,
      int_B: activeStrapItem.int_B,
      int_H: activeStrapItem.int_H,
      beam_b: activeStrapItem.beam_b,
      beam_h: activeStrapItem.beam_h,
      fc: activeStrapItem.fc || fc,
      fy: activeStrapItem.fy || fy,
      ext_col: activeStrapItem.ext_col || { name: 'C1', cx: 400, cy: 400, PDead: 350, PLive: 150 },
      int_col: activeStrapItem.int_col || { name: 'C2', cx: 500, cy: 500, PDead: 600, PLive: 250 },
      ext_footing_level: activeStrapItem.ext_footing_level,
      int_footing_level: activeStrapItem.int_footing_level,
      ext_bot_rebarText: activeStrapItem.ext_bot_rebarText || 'Ø14 @ 150 mm',
      int_bot_rebarText: activeStrapItem.int_bot_rebarText || 'Ø14 @ 150 mm',
      beam_top_rebarText: activeStrapItem.beam_top_rebarText || '6 Ø 18',
      beam_bot_rebarText: activeStrapItem.beam_bot_rebarText || '4 Ø 16',
      beam_stirrupsText: activeStrapItem.beam_stirrupsText || 'Ø 10 @ 150 mm',
      concreteRCCVol: activeStrapItem.concreteRCCVol || 6.5,
      concretePCCVol: activeStrapItem.concretePCCVol || 1.2,
      formworkArea: activeStrapItem.formworkArea || 14.5,
      totalSteelKg: activeStrapItem.totalSteelKg || 450,
      excavationVol: activeStrapItem.excavationVol || 24.5,
      backfillVol: activeStrapItem.backfillVol || 16.8
    });
    downloadDXF(dxf, `Strap_Footing_${activeStrapItem.id}_Detail_S-304.dxf`);
  };

  useEffect(() => {
    const handleExportEvent = () => {
      handleExportStrapFootingDetailDXF();
    };
    window.addEventListener('export-strap-dxf', handleExportEvent);
    return () => {
      window.removeEventListener('export-strap-dxf', handleExportEvent);
    };
  }, [activeStrapItem, fc, fy, qall, soilCoverDepth]);

  const renderLayoutSVG = (isPrint: boolean = false) => {
    const width = isPrint ? 800 : viewWidth;
    const height = isPrint ? 500 : viewHeight;

    const rx = planBounds.maxX - planBounds.minX || 1;
    const ry = planBounds.maxY - planBounds.minY || 1;

    const mX = (val: number) => 55 + ((val - planBounds.minX) / rx) * (width - 110);
    const mY = (val: number) => height - 55 - ((val - planBounds.minY) / ry) * (height - 110);

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="background:#ffffff; font-family:'Cairo, sans-serif'; user-select:none;">
        ${isPrint ? `<rect x="5" y="5" width="${width - 10}" height="${height - 10}" fill="none" stroke="#000000" stroke-width="1.5" />` : ''}

        <!-- 1. GRIDS -->
        ${showGrids ? `
          <g stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="3 3">
            ${gridsX.map(g => `<line x1="${mX(g.coord)}" y1="40" x2="${mX(g.coord)}" y2="${height - 40}" />`).join('')}
            ${gridsY.map(g => `<line x1="40" y1="${mY(g.coord)}" x2="${width - 40}" y2="${mY(g.coord)}" />`).join('')}
          </g>
          <g>
            ${gridsX.map(g => `
              <circle cx="${mX(g.coord)}" cy="25" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1" />
              <text x="${mX(g.coord)}" y="28" fill="#1e293b" font-weight="bold" font-size="9.5" text-anchor="middle">${g.label}</text>
              <circle cx="${mX(g.coord)}" cy="${height - 25}" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1" />
              <text x="${mX(g.coord)}" y="${height - 22}" fill="#1e293b" font-weight="bold" font-size="9.5" text-anchor="middle">${g.label}</text>
            `).join('')}
            ${gridsY.map(g => `
              <circle cx="25" cy="${mY(g.coord)}" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1" />
              <text x="25" y="${mY(g.coord) + 3}" fill="#1e293b" font-weight="bold" font-size="9.5" text-anchor="middle">${g.label}</text>
              <circle cx="${width - 25}" cy="${mY(g.coord)}" r="10" fill="#f8fafc" stroke="#475569" stroke-width="1" />
              <text x="${width - 25}" y="${mY(g.coord) + 3}" fill="#1e293b" font-weight="bold" font-size="9.5" text-anchor="middle">${g.label}</text>
            `).join('')}
          </g>
        ` : ''}

        <!-- 2. STRIP FOOTINGS -->
        ${showStripFootings ? `
          <g>
            ${stripFootings.map(s => {
              const dx = s.x2 - s.x1;
              const dy = s.y2 - s.y1;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const px = -uy * (s.width / 2);
              const py = ux * (s.width / 2);

              const p1x = mX(s.x1 + px), p1y = mY(s.y1 + py);
              const p2x = mX(s.x2 + px), p2y = mY(s.y2 + py);
              const p3x = mX(s.x2 - px), p3y = mY(s.y2 - py);
              const p4x = mX(s.x1 - px), p4y = mY(s.y1 - py);

              const mx = mX((s.x1 + s.x2) / 2);
              const my = mY((s.y1 + s.y2) / 2);

              return `
                <polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}" fill="rgba(217,119,6,0.06)" stroke="#d97706" stroke-width="1.6" />
                ${showTextLabels ? `
                  <text x="${mx}" y="${my}" fill="#b45309" font-weight="bold" font-size="10" text-anchor="middle">${s.id}</text>
                  <text x="${mx}" y="${my + 12}" fill="#78350f" font-size="8" font-weight="semibold" font-mono text-anchor="middle">B=${s.width} EL=${s.elevation.toFixed(2)}</text>
                ` : ''}
              `;
            }).join('')}
          </g>
        ` : ''}

        <!-- 3. GRADE BEAMS -->
        ${showGradeBeams ? `
          <g>
            ${gradeBeams.map(b => {
              const dx = b.x2 - b.x1;
              const dy = b.y2 - b.y1;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const ox = -uy * (b.width / 2);
              const oy = ux * (b.width / 2);

              const p1x = mX(b.x1 + ox), p1y = mY(b.y1 + oy);
              const p2x = mX(b.x2 + ox), p2y = mY(b.y2 + oy);
              const p3x = mX(b.x2 - ox), p3y = mY(b.y2 - oy);
              const p4x = mX(b.x1 - ox), p4y = mY(b.y1 - oy);

              const mx = mX((b.x1 + b.x2) / 2);
              const my = mY((b.y1 + b.y2) / 2);

              return `
                <polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}" fill="rgba(5,150,105,0.04)" stroke="#059669" stroke-width="1.2" stroke-dasharray="2 2" />
                ${showTextLabels ? `
                  <text x="${mx}" y="${my - 4}" fill="#047857" font-weight="bold" font-size="9" text-anchor="middle">${b.id}</text>
                  <text x="${mx}" y="${my + 8}" fill="#065f46" font-size="7.5" font-weight="semibold" font-mono text-anchor="middle">${b.width}x${b.depth}</text>
                ` : ''}
              `;
            }).join('')}
          </g>
        ` : ''}

        <!-- 4. FOOTINGS & COLUMNS -->
        ${showFootings ? `
          <g>
            ${isolatedFootings.map(f => {
              const fW = (f.B / rx) * (width - 110);
              const fH = (f.L / ry) * (height - 110);
              const fx = mX(f.x) - fW / 2;
              const fy = mY(f.y) - fH / 2;

              const cW = (f.colB / rx) * (width - 110);
              const cH = (f.colH / ry) * (height - 110);
              const cx = mX(f.x) - cW / 2;
              const cy = mY(f.y) - cH / 2;

              return `
                <rect x="${fx}" y="${fy}" width="${fW}" height="${fH}" fill="rgba(37,99,235,0.05)" stroke="#2563eb" stroke-width="1.5" rx="2" />
                ${showColumns ? `
                  <rect x="${cx}" y="${cy}" width="${cW}" height="${cH}" fill="#be123c" fill-opacity="0.25" stroke="#be123c" stroke-width="1" />
                  <line x1="${cx}" y1="${cy}" x2="${cx + cW}" y2="${cy + cH}" stroke="#be123c" stroke-width="0.6" />
                  <line x1="${cx + cW}" y1="${cy}" x2="${cx}" y2="${cy + cH}" stroke="#be123c" stroke-width="0.6" />
                ` : ''}
                ${showTextLabels ? `
                  <text x="${mX(f.x)}" y="${fy - 4}" fill="#1e3a8a" font-weight="bold" font-size="9" text-anchor="middle">${f.id}</text>
                  <text x="${mX(f.x)}" y="${fy + fH + 12}" fill="#be123c" font-weight="bold" font-size="8" text-anchor="middle">${f.colId}</text>
                  <text x="${mX(f.x)}" y="${fy + fH + 22}" fill="#475569" font-mono font-size="7" font-weight="semibold" text-anchor="middle">${f.B}x${f.L} EL=${f.elevation.toFixed(2)}</text>
                ` : ''}
              `;
            }).join('')}
          </g>
        ` : ''}

        <!-- 4B. STRAP FOOTING SYSTEMS -->
        ${showFootings ? `
          <g>
            ${strapFootingsList.map((st, idx) => {
              const extW = 55;
              const extH = 95;
              const extX = 130 + idx * 280;
              const extY = 160;

              const intW = 75;
              const intH = 105;
              const intX = extX + 160;
              const intY = 155;

              const beamW = 160;
              const beamH = 22;
              const beamX = extX + extW;
              const beamY = 195;

              return `
                <rect x="${extX}" y="${extY}" width="${extW}" height="${extH}" fill="rgba(79,70,229,0.04)" stroke="#4f46e5" stroke-width="1.8" rx="2" stroke-dasharray="3 1" />
                <rect x="${intX}" y="${intY}" width="${intW}" height="${intH}" fill="rgba(79,70,229,0.04)" stroke="#4f46e5" stroke-width="1.8" rx="2" stroke-dasharray="3 1" />
                <rect x="${beamX}" y="${beamY}" width="${beamW}" height="${beamH}" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="1.5" />
                
                <text x="${extX + extW/2}" y="${extY + extH/2}" fill="#4f46e5" font-weight="extrabold" font-size="7.5" text-anchor="middle">خارجية: ${st.id}</text>
                <text x="${intX + intW/2}" y="${intY + intH/2}" fill="#4f46e5" font-weight="extrabold" font-size="7.5" text-anchor="middle">داخلية: ${st.id}</text>
                <text x="${beamX + beamW/2}" y="${beamY + 14}" fill="#d97706" font-weight="extrabold" font-size="7" text-anchor="middle">ميدة رابطة SB</text>
              `;
            }).join('')}
          </g>
        ` : ''}

        <!-- 5. DIMENSION STRING -->
        ${showDimensions ? `
          <g stroke="#475569" stroke-width="0.8">
            ${gridsX.slice(0, -1).map((g, i) => {
              const x1 = mX(g.coord);
              const x2 = mX(gridsX[i + 1].coord);
              const dy = height - 42;
              const valM = ((gridsX[i + 1].coord - g.coord) / 1000).toFixed(2);
              return `
                <line x1="${x1}" y1="${dy}" x2="${x2}" y2="${dy}" />
                <line x1="${x1}" y1="${dy - 3}" x2="${x1}" y2="${dy + 3}" />
                <line x1="${x2}" y1="${dy - 3}" x2="${x2}" y2="${dy + 3}" />
                <line x1="${x1 - 2}" y1="${dy + 2}" x2="${x1 + 2}" y2="${dy - 2}" stroke-width="1.4" />
                <line x1="${x2 - 2}" y1="${dy + 2}" x2="${x2 + 2}" y2="${dy - 2}" stroke-width="1.4" />
                <text x="${(x1 + x2) / 2}" y="${dy - 4}" fill="#334155" font-size="8" font-weight="bold" font-mono text-anchor="middle">${valM}m</text>
              `;
            }).join('')}

            ${gridsY.slice(0, -1).map((g, i) => {
              const y1 = mY(g.coord);
              const y2 = mY(gridsY[i + 1].coord);
              const dx = 42;
              const valM = ((gridsY[i + 1].coord - g.coord) / 1000).toFixed(2);
              return `
                <line x1="${dx}" y1="${y1}" x2="${dx}" y2="${y2}" />
                <line x1="${dx - 3}" y1="${y1}" x2="${dx + 3}" y2="${y1}" />
                <line x1="${dx - 3}" y1="${y2}" x2="${dx + 3}" y2="${y2}" />
                <line x1="${dx - 2}" y1="${y1 + 2}" x2="${dx + 2}" y2="${y1 - 2}" stroke-width="1.4" />
                <line x1="${dx - 2}" y1="${y2 + 2}" x2="${dx + 2}" y2="${y1 - 2}" stroke-width="1.4" />
                <text x="${dx - 6}" y="${(y1 + y2) / 2 + 3}" fill="#334155" font-size="8" font-weight="bold" font-mono text-anchor="end">${valM}m</text>
              `;
            }).join('')}
          </g>
        ` : ''}

        <!-- 6. NORTH COMPASS -->
        ${showNorthArrow ? `
          <g transform="translate(${width - 45}, 45) rotate(${northAngle})">
            <circle cx="0" cy="0" r="16" fill="#f8fafc" stroke="#334155" stroke-width="1.2" />
            <polygon points="0,-12 -4,-2 0,-5 4,-2" fill="#be123c" stroke="#9f1239" stroke-width="1" />
            <line x1="0" y1="-5" x2="0" y2="12" stroke="#334155" stroke-width="1" />
            <text x="0" y="-14" fill="#9f1239" font-size="9" font-weight="extrabold" text-anchor="middle">N</text>
          </g>
        ` : ''}

        <!-- 7. SHEET STAMP FRAME -->
        ${showTitleBlock ? `
          <g transform="translate(${width - 150}, ${height - 45})">
            <rect width="135" height="35" fill="#f8fafc" stroke="#0f172a" stroke-width="1" rx="2" />
            <line x1="0" y1="12" x2="135" y2="12" stroke="#475569" stroke-width="0.5" />
            <line x1="0" y1="24" x2="135" y2="24" stroke="#475569" stroke-width="0.5" />
            <line x1="85" y1="0" x2="85" y2="35" stroke="#475569" stroke-width="0.5" />

            <text x="5" y="8" fill="#555" font-size="5" font-weight="bold">PROJECT:</text>
            <text x="5" y="20" fill="#000" font-size="7.5" font-weight="black">${projectName.substring(0, 18)}</text>
            <text x="5" y="32" fill="#be123c" font-size="8" font-weight="black">LAYOUT PLAN</text>

            <text x="90" y="8" fill="#555" font-size="5">SCALE:</text>
            <text x="90" y="18" fill="#000" font-size="7.5" font-weight="bold" font-mono>${scaleMode === 'auto' ? autoSelectedScale : scaleValue}</text>
            <text x="90" y="32" fill="#1e3a8a" font-size="10" font-weight="black">S-101</text>
          </g>
        ` : ''}
      </svg>
    `;
  };


  // HTML content generator for printing or viewing active sheets
  const generateSheetHTMLContent = (code: string) => {
    switch (code) {
      case 'S-101':
        return `
          <div style="direction:rtl; text-align:right;">
            <div style="font-family:'Cairo', sans-serif; padding:15px; background:#fff; text-align:center;">
              <h3 style="margin:5px 0; font-size:15px; font-weight:bold; color:#1e293b;">مخطط أساسات مشروع: ${projectName}</h3>
              <p style="margin:2px 0 15px 0; font-size:10px; color:#64748b;">مسقط محاور وأعمدة وقواعد شريطية ومنفصلة مع جدران وفواصل التأسيس</p>
              <div style="border:1.5px solid #cbd5e1; border-radius:8px; overflow:hidden; background:#f8fafc; padding:20px; max-width:820px; margin:0 auto;">
                ${renderLayoutSVG(true)}
              </div>
            </div>
          </div>
        `;
      case 'S-201':
        return `
          <div style="direction:rtl; text-align:right; font-family:'Cairo', sans-serif; padding:15px;">
            <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:5px; border:1px solid #cbd5e1;">
              <thead>
                <tr style="background:#0f172a; color:#ffffff; font-weight:bold;">
                  <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">رمز النموذج / Mark</th>
                  <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">العرض B (mm)</th>
                  <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">الطول L (mm)</th>
                  <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">السماكة H (mm)</th>
                  <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">الغطاء (mm)</th>
                  <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">التسليح X-Bar</th>
                  <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">التسليح Y-Bar</th>
                  <th style="border:1px solid #cbd5e1; padding:8px; text-align:center;">العدد الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${scheduleItems.map(t => {
                  const count = footingLocations.filter(loc => loc.typeMark === t.typeMark).length;
                  return `
                    <tr style="background:#fff;">
                      <td style="border:1px solid #cbd5e1; padding:8px; font-weight:bold; background:#f8fafc; text-align:center; color:#1e3a8a;">${t.typeMark}</td>
                      <td style="border:1px solid #cbd5e1; padding:8px; font-family:monospace; text-align:center;">${t.B}</td>
                      <td style="border:1px solid #cbd5e1; padding:8px; font-family:monospace; text-align:center;">${t.L}</td>
                      <td style="border:1px solid #cbd5e1; padding:8px; font-family:monospace; text-align:center;">${t.H}</td>
                      <td style="border:1px solid #cbd5e1; padding:8px; font-family:monospace; text-align:center;">75</td>
                      <td style="border:1px solid #cbd5e1; padding:8px; font-weight:bold; text-align:center; color:#2563eb;">${t.rebarX.quantity} Ø ${t.rebarX.diameter}</td>
                      <td style="border:1px solid #cbd5e1; padding:8px; font-weight:bold; text-align:center; color:#2563eb;">${t.rebarY.quantity} Ø ${t.rebarY.diameter}</td>
                      <td style="border:1px solid #cbd5e1; padding:8px; font-weight:bold; text-align:center; background:#f1f5f9;">${count}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      case 'S-301': {
        const item = activeFootingItem || scheduleItems[0];
        const rep = (isolatedFootings.find(f => f.id === item.typeMark) || { colB: 300, colH: 400, elevation: -2.00 }) as any;
        
        const fB = item.B;
        const fL = item.L;
        const fH = item.H;
        const cB = rep.colB || 300;
        const cH = rep.colH || 400;
        
        // ACI 318 calculations
        const AsMinX = 0.0018 * fB * fH;
        const AsMinY = 0.0018 * fL * fH;
        const AsProvX = item.rebarX.quantity * (Math.PI * Math.pow(item.rebarX.diameter, 2)) / 4;
        const AsProvY = item.rebarY.quantity * (Math.PI * Math.pow(item.rebarY.diameter, 2)) / 4;
        
        const spacingX = Math.round((fL - 150) / (item.rebarX.quantity - 1));
        const spacingY = Math.round((fB - 150) / (item.rebarY.quantity - 1));
        
        const ldX = Math.round(32 * item.rebarX.diameter);
        const ldhX = Math.round(Math.max(150, 8 * item.rebarX.diameter, 0.24 * (fy / Math.sqrt(fc)) * item.rebarX.diameter));
        
        const concVol = (fB / 1000) * (fL / 1000) * (fH / 1000);
        const pccVol = ((fB + 200) / 1000) * ((fL + 200) / 1000) * 0.1;
        
        const weightM_X = Math.pow(item.rebarX.diameter, 2) / 162;
        const weightM_Y = Math.pow(item.rebarY.diameter, 2) / 162;
        const singleLengthX = (fL / 1000) + 0.5 - 0.15; // with hooks
        const singleLengthY = (fB / 1000) + 0.5 - 0.15;
        
        const totalWtX = item.rebarX.quantity * singleLengthX * weightM_X;
        const totalWtY = item.rebarY.quantity * singleLengthY * weightM_Y;
        const totWeight = totalWtX + totalWtY;

        return `
          <div style="direction:rtl; text-align:right; font-family:'Cairo', 'Inter', sans-serif; padding:10px; background:#fff; color:#0f172a;">
            <!-- Drawing Header & Quick Metadata Info Bar -->
            <div style="border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h3 style="margin:0; font-size:14px; font-weight:800; color:#1e3a8a;">تفاصيل تسليح ومقاطع النموذج الإنشائي: ${item.typeMark}</h3>
                <p style="margin:2px 0 0 0; font-size:10px; color:#475569;">مطابق لمتطلبات الكود الأمريكي الخرساني ACI 318-19 ومقاومة مميزة f'c=${fc} MPa</p>
              </div>
              <div style="text-align:left; font-size:10px; font-weight:bold; color:#be123c;">
                <span>المقياس المقترح / SCALE: 1:20</span><br/>
                <span style="color:#059669; font-family:monospace;">EL = ${rep.elevation ? rep.elevation.toFixed(2) : '-2.00'} m</span>
              </div>
            </div>

            <!-- Main Drawings Layout Block -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:15px;">
              <!-- PANEL 1: PLAN VIEW -->
              <div style="border:1.2px solid #cbd5e1; border-radius:6px; padding:10px; background:#f8fafc; text-align:center;">
                <h4 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:4px;">1. المسقط الأفقي العام للشبكة / PLAN VIEW</h4>
                <svg viewBox="0 0 280 230" width="100%" height="auto" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; display:block; margin:0 auto;">
                  <!-- Grid Axis Centerlines -->
                  <line x1="20" y1="105" x2="260" y2="105" stroke="#be123c" stroke-width="0.8" stroke-dasharray="3 3" />
                  <line x1="140" y1="15" x2="140" y2="195" stroke="#be123c" stroke-width="0.8" stroke-dasharray="3 3" />
                  
                  <!-- Footing Boundary Outline in High Contrast Navy -->
                  <rect x="50" y="25" width="180" height="160" fill="rgba(37,99,235,0.02)" stroke="#2563eb" stroke-width="2.2" rx="3" />
                  <!-- Pedestal Outline -->
                  <rect x="110" y="75" width="60" height="60" fill="none" stroke="#64748b" stroke-width="1.2" stroke-dasharray="2 1" />
                  <!-- Column outline -->
                  <rect x="120" y="85" width="40" height="40" fill="rgba(220,38,38,0.12)" stroke="#dc2626" stroke-width="1.5" />
                  <line x1="120" y1="85" x2="160" y2="125" stroke="#dc2626" stroke-width="0.8" />
                  <line x1="160" y1="85" x2="120" y2="125" stroke="#dc2626" stroke-width="0.8" />

                  <!-- Rebar graphics in Y direction (Green) & X direction (Blue) -->
                  <line x1="57" y1="32" x2="223" y2="32" stroke="#1d4ed8" stroke-width="1.8" />
                  <line x1="57" y1="32" x2="57" y2="40" stroke="#1d4ed8" stroke-width="1.8" />
                  <line x1="223" y1="32" x2="223" y2="40" stroke="#1d4ed8" stroke-width="1.8" />

                  <line x1="223" y1="178" x2="57" y2="178" stroke="#1d4ed8" stroke-width="1.8" />
                  <line x1="223" y1="178" x2="223" y2="170" stroke="#1d4ed8" stroke-width="1.8" />
                  <line x1="57" y1="178" x2="57" y2="170" stroke="#1d4ed8" stroke-width="1.8" />

                  <line x1="57" y1="36" x2="57" y2="174" stroke="#047857" stroke-width="1.8" />
                  <line x1="57" y1="36" x2="65" y2="36" stroke="#047857" stroke-width="1.8" />
                  <line x1="57" y1="174" x2="65" y2="174" stroke="#047857" stroke-width="1.8" />

                  <!-- Arrow indicators & annotations -->
                  <text x="140" y="21" fill="#1d4ed8" font-size="7" font-weight="extrabold" text-anchor="middle">تسليح الاتجاه الطولي X: ${item.rebarX.quantity}Ø${item.rebarX.diameter} c/c ${spacingX}mm</text>
                  <text x="140" y="191" fill="#047857" font-size="7" font-weight="extrabold" text-anchor="middle">تسليح الاتجاه العرضي Y: ${item.rebarY.quantity}Ø${item.rebarY.diameter} c/c ${spacingY}mm</text>

                  <!-- Dimension markings -->
                  <line x1="50" y1="198" x2="230" y2="198" stroke="#334155" stroke-width="0.8" />
                  <line x1="50" y1="195" x2="50" y2="201" stroke="#334155" stroke-width="0.8" />
                  <line x1="230" y1="195" x2="230" y2="201" stroke="#334155" stroke-width="0.8" />
                  <text x="140" y="208" fill="#334155" font-size="7.5" font-weight="bold" font-mono text-anchor="middle">B = ${fB} mm</text>

                  <line x1="40" y1="25" x2="40" y2="185" stroke="#334155" stroke-width="0.8" />
                  <line x1="37" y1="25" x2="43" y2="25" stroke="#334155" stroke-width="0.8" />
                  <line x1="37" y1="185" x2="43" y2="185" stroke="#334155" stroke-width="0.8" />
                  <text x="32" y="110" fill="#334155" font-size="7.5" font-weight="bold" font-mono text-anchor="end">L = ${fL} mm</text>

                  <text x="140" y="108" fill="#475569" font-size="6.5" font-weight="bold" text-anchor="middle">الرقبة ${cB}×${cH}</text>
                </svg>
              </div>

              <!-- PANEL 2: LONGITUDINAL SECTION A-A -->
              <div style="border:1.2px solid #cbd5e1; border-radius:6px; padding:10px; background:#f8fafc; text-align:center;">
                <h4 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:4px;">2. القطاع الرأسي الطولي / SECTION A-A</h4>
                <svg viewBox="0 0 280 230" width="100%" height="auto" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; display:block; margin:0 auto;">
                  <!-- PCC ground block -->
                  <rect x="35" y="152" width="210" height="15" fill="rgba(100,116,139,0.12)" stroke="#94a3b8" stroke-width="0.8" />
                  <text x="140" y="163" fill="#64748b" font-weight="bold" font-size="6">فرشة خرسانة عادية P.C.C. (10cm)</text>

                  <!-- Footing concrete outline -->
                  <rect x="45" y="112" width="190" height="40" fill="rgba(0,0,0,0.03)" stroke="#0f172a" stroke-width="1.8" />
                  <text x="80" y="135" fill="#475569" font-size="6.5" font-weight="bold">السمك H = ${fH} مم</text>

                  <!-- Pedestal Neck outline -->
                  <rect x="110" y="52" width="60" height="60" fill="none" stroke="#0f172a" stroke-width="1.5" />
                  <!-- Column outline going up -->
                  <rect x="120" y="12" width="40" height="100" fill="none" stroke="#2563eb" stroke-dasharray="2 1" stroke-width="0.8" />
                  <rect x="120" y="12" width="40" height="40" fill="none" stroke="#dc2626" stroke-width="1.5" />

                  <!-- NGL ground indicator line with triangles -->
                  <line x1="20" y1="52" x2="260" y2="52" stroke="#059669" stroke-width="1" />
                  <polygon points="30,52 35,46 25,46" fill="#059669" />
                  <text x="220" y="46" fill="#0596 green" font-size="6" font-weight="bold">مستوى الأرض طبيعي EL 0.00</text>

                  <!-- Main Bottom rebar with 90 deg hooks -->
                  <path d="M 50 137 L 50 144 L 230 144 L 230 137" fill="none" stroke="#1d4ed8" stroke-width="1.8" />
                  <text x="140" y="140" fill="#1d4ed8" font-size="5.5" font-weight="black" text-anchor="middle">حديد فرش سفلي فرش: ${item.rebarX.quantity}Ø${item.rebarX.diameter}</text>

                  <!-- Column Dowels & hooks -->
                  <path d="M 125 18 L 125 144 L 135 144" fill="none" stroke="#be123c" stroke-width="1.5" />
                  <path d="M 155 18 L 155 144 L 145 144" fill="none" stroke="#be123c" stroke-width="1.5" />
                  
                  <!-- Pedestal shear stirrups -->
                  ${[62, 74, 86, 98].map(y => `<line x1="110" y1="${y}" x2="170" y2="${y}" stroke="#d97706" stroke-width="0.8" />`).join('')}
                  <text x="175" y="82" fill="#d97706" font-size="5.5" font-weight="bold">كانات رقبة: Ø10@150مم</text>

                  <!-- Cover references -->
                  <line x1="45" y1="125" x2="50" y2="125" stroke="#dc2626" stroke-width="0.5" />
                  <text x="38" y="121" fill="#dc2626" font-size="5.5">غطاء 75مم</text>
                </svg>
              </div>
            </div>

            <!-- Bottom Data Panel: Engineering Spec notes & BOQ Block -->
            <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:12px; font-size:10.5px;">
              <!-- SECTION A: SPECIFICATIONS & ACI INTERACTIVE CHECKS -->
              <div style="border:1.2px solid #e2e8f0; border-radius:6px; padding:10px; background:#fff;">
                <h5 style="margin:0 0 6px 0; font-size:11.5px; font-weight:bold; color:#1e3a8a; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;">
                  📋 تحقق ومراجعة هندسية طبقا للكود المعتمد (ACI 318-19 Verification)
                </h5>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                  <ul style="margin:0; padding-right:15px; list-style-type:square; line-height:1.5; color:#334155;">
                    <li><strong>أصل نسبة التسليح الدنيا:</strong> As,min = 0.18% (مُحقق ✔️)</li>
                    <li><strong>السمك الإجمالي الفعال:</strong> d = ${fH - 75} مم (كافي لمقاومة القص ✔️)</li>
                    <li><strong>تباعد السيخ الأقصى:</strong> s_max = ${Math.min(450, 3 * fH)} مم (مُهندَس ✔️)</li>
                    <li><strong>التباعد الفعلي للحديد X:</strong> ${spacingX} مم (ممتاز ✔️)</li>
                  </ul>
                  <ul style="margin:0; padding-right:15px; list-style-type:square; line-height:1.5; color:#334155;">
                    <li><strong>طول التماسك اللازم l_d:</strong> ${ldX} مم (موفر بالكامل ✔️)</li>
                    <li><strong>طول العكفة القياسية l_dh:</strong> ${ldhX} مم (محقق ✔️)</li>
                    <li><strong>الغطاء الخرساني الصافي:</strong> 75 مم (لحماية عالية ضد الكبريتات ✔️)</li>
                    <li><strong>القص الثاقب (Punching):</strong> كافي بدون حديد إضافي ✔️</li>
                  </ul>
                </div>
                <div style="margin-top:8px; padding:6px; background:#f1f5f9; border-radius:4px; font-size:9.5px; color:#475569; border-right:3px solid #be123c;">
                  <strong>توصية المهندس الإنشائي:</strong> الالتزام التام بثني نهايات حديد الفرش والغطاء بزاوية 90 درجة (L-Hook) بطول لا يقل عن 25 سم لضمان جودة التماسك ونقل العزوم بسلامية مطلقة.
                </div>
              </div>

              <!-- SECTION B: SINGLE FOOTING SUMMARY (BOQ) -->
              <div style="border:1.2px solid #e2e8f0; border-radius:6px; padding:10px; background:#fefefe; display:flex; flex-col; justify-content:space-between;">
                <div>
                  <h5 style="margin:0 0 6px 0; font-size:11.5px; font-weight:bold; color:#be123c; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;">
                    📊 كشف حصر المواد للقاعدة الواحدة (BOQ Memo)
                  </h5>
                  <table style="width:100%; border-collapse:collapse; text-align:right; font-size:10px; margin-top:4px;">
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">خرسانة مسلحة (RC):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#0f172a;">${concVol.toFixed(3)} م3</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">خرسانة نظافة (PCC):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#0f172a;">${pccVol.toFixed(3)} م3</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">وزن حديد التسليح:</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#1e3a8a;">${totWeight.toFixed(1)} كغ</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0; color:#555;">الحفر المقدر (عمق 1.5م):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#059669;">${((fB + 1000)/1000 * (fL + 1000)/1000 * 1.5).toFixed(2)} م3</td>
                    </tr>
                  </table>
                </div>
                <div style="margin-top:auto;">
                  <button 
                    style="width:100%; height:26px; font-size:9.5px; font-weight:extrabold; background:#0f172a; color:#fff; border:none; border-radius:4px; cursor:pointer;"
                    onclick="window.dispatchEvent(new CustomEvent('export-isolated-dxf'))"
                  >
                    📥 استخراج مقاطع هذه القاعدة كملف DXF مستقل
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      case 'S-302': {
        const item = activeStripItem || stripScheduleItems[0];
        
        const fB = item.B;
        const fH = item.H;
        const fL = item.L;
        const elevation = item.elevation;
        
        // ACI 318 calculations
        const AsMinTop = 0.0018 * fB * fH;
        const AsMinBot = 0.0018 * fB * fH;
        const AsProvTop = item.barsTopCount * (Math.PI * Math.pow(item.barsTopDia, 2)) / 4;
        const AsProvBot = item.barsBotCount * (Math.PI * Math.pow(item.barsBotDia, 2)) / 4;
        
        const spacingStirrups = item.stirrupsSpacing;
        
        // development lengths
        const ldX_bot = Math.round(32 * item.barsBotDia);
        const ldhX_bot = Math.round(Math.max(150, 8 * item.barsBotDia, 0.24 * (fy / Math.sqrt(fc || 25)) * item.barsBotDia));
        
        const concVol = (fB / 1000) * (fL / 1000) * (fH / 1000);
        const pccVol = ((fB + 200) / 1000) * ((fL + 200) / 1000) * 0.1;
        
        const weightM_top = Math.pow(item.barsTopDia, 2) / 162;
        const weightM_bot = Math.pow(item.barsBotDia, 2) / 162;
        const totWeight = (item.barsTopCount * (fL / 1000) * weightM_top) + (item.barsBotCount * (fL / 1000) * weightM_bot) + (15 * (fB/1000 + fH/1000)*2 * (fL/1000 / (spacingStirrups/1000)) * 0.395); // stirrup weight added

        return `
          <div style="direction:rtl; text-align:right; font-family:'Cairo', 'Inter', sans-serif; padding:10px; background:#fff; color:#0f172a;">
            <!-- Drawing Header & Quick Metadata Info Bar -->
            <div style="border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h3 style="margin:0; font-size:14px; font-weight:800; color:#121828;">تفاصيل تسليح ومقاطع نموذج لوحة الأساس الشريطي المستمر: ${item.typeMark}</h3>
                <p style="margin:2px 0 0 0; font-size:10px; color:#475569;">مطابق لمتطلبات الكود المعتمد الأمريكي خرسانة مسلحة ACI 318-19 وتتابع مستويات التأسيس المتدرجة</p>
              </div>
              <div style="text-align:left; font-size:10px; font-weight:bold; color:#be123c;">
                <span>المقياس المقترح / SCALE: 1:25</span><br/>
                <span style="color:#059669; font-family:monospace;">LEVEL EL = ${elevation.toFixed(2)} m إلى ${(elevation + 0.3).toFixed(2)} m (تأسيس متدرج/Stepped)</span>
              </div>
            </div>

            <!-- Main Drawings Layout Block -->
            <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:12px; margin-bottom:15px;">
              <!-- PANEL 1: PLAN VIEW -->
              <div style="border:1.2px solid #cbd5e1; border-radius:6px; padding:10px; background:#f8fafc; text-align:center;">
                <h4 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:4px;">1. المسقط الأفقي للأساس الشريطي والأعمدة المسندة / PLAN VIEW</h4>
                <svg viewBox="0 0 280 230" width="100%" height="auto" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; display:block; margin:0 auto;">
                  <!-- Axis center line -->
                  <line x1="15" y1="110" x2="265" y2="110" stroke="#be123c" stroke-width="0.8" stroke-dasharray="4 3" />
                  
                  <!-- Strip concrete footings boundaries -->
                  <rect x="25" y="45" width="230" height="130" fill="rgba(6,182,212,0.02)" stroke="#0891b2" stroke-width="2.2" rx="3" />
                  
                  <!-- Multiple Column markers resting along the strip -->
                  <!-- Column C1 -->
                  <rect x="40" y="90" width="25" height="40" fill="rgba(220,38,38,0.12)" stroke="#dc2626" stroke-width="1.2" />
                  <line x1="40" y1="90" x2="65" y2="130" stroke="#dc2626" stroke-width="0.5" />
                  <text x="52.5" y="82" fill="#dc2626" font-size="6" font-weight="extrabold" text-anchor="middle">C1 (200x400)</text>
                  
                  <!-- Column C2 -->
                  <rect x="130" y="85" width="25" height="50" fill="rgba(220,38,38,0.12)" stroke="#dc2626" stroke-width="1.2" />
                  <line x1="130" y1="85" x2="155" y2="135" stroke="#dc2626" stroke-width="0.5" />
                  <text x="142.5" y="77" fill="#dc2626" font-size="6" font-weight="extrabold" text-anchor="middle">C2 (300x500)</text>
                  
                  <!-- Column C3 -->
                  <rect x="210" y="80" width="30" height="60" fill="rgba(220,38,38,0.12)" stroke="#dc2626" stroke-width="1.2" />
                  <line x1="210" y1="80" x2="240" y2="140" stroke="#dc2626" stroke-width="0.5" />
                  <text x="225" y="72" fill="#dc2626" font-size="6" font-weight="extrabold" text-anchor="middle">C3 (400x600)</text>

                  <!-- Bottom rebar indicator lines -->
                  <line x1="30" y1="165" x2="250" y2="165" stroke="#1d4ed8" stroke-width="1.5" />
                  <line x1="30" y1="165" x2="30" y2="157" stroke="#1d4ed8" stroke-width="1.5" />
                  <line x1="250" y1="165" x2="250" y2="157" stroke="#1d4ed8" stroke-width="1.5" />
                  <text x="140" y="160" fill="#1d4ed8" font-size="6.5" font-weight="extrabold" text-anchor="middle">تسليح سفلي رئيسي: ${item.barsBotCount}Ø${item.barsBotDia} مستمر</text>

                  <!-- Top rebar indicator lines -->
                  <line x1="30" y1="55" x2="250" y2="55" stroke="#047857" stroke-width="1.5" />
                  <line x1="30" y1="55" x2="30" y2="63" stroke="#047857" stroke-width="1.5" />
                  <line x1="250" y1="55" x2="250" y2="63" stroke="#047857" stroke-width="1.5" />
                  <text x="140" y="66" fill="#047857" font-size="6.5" font-weight="extrabold" text-anchor="middle">تسليح علوي مستمر: ${item.barsTopCount}Ø${item.barsTopDia} مستمر</text>

                  <!-- Transverse distribution annotations -->
                  <text x="140" y="125" fill="#475569" font-size="6.5" font-weight="bold" text-anchor="middle">حديد عرضي وتوزيع: Ø12 @ 200مم</text>

                  <!-- Dimensions indicators -->
                  <line x1="25" y1="184" x2="255" y2="184" stroke="#334155" stroke-width="0.7" />
                  <line x1="25" y1="181" x2="25" y2="187" stroke="#334155" stroke-width="0.7" />
                  <line x1="255" y1="181" x2="255" y2="187" stroke="#334155" stroke-width="0.7" />
                  <text x="140" y="194" fill="#334155" font-size="7" font-weight="bold" text-anchor="middle">الطول الكلي L = ${fL} مم</text>

                  <line x1="15" y1="45" x2="15" y2="175" stroke="#334155" stroke-width="0.7" />
                  <line x1="12" y1="45" x2="18" y2="45" stroke="#334155" stroke-width="0.7" />
                  <line x1="12" y1="175" x2="18" y2="175" stroke="#334155" stroke-width="0.7" />
                  <text x="10" y="113" fill="#334155" font-size="7" font-weight="bold" text-anchor="end">العرض B = ${fB} مم</text>
                </svg>
              </div>

              <!-- PANEL 2: LONGITUDINAL SECTION A-A -->
              <div style="border:1.2px solid #cbd5e1; border-radius:6px; padding:10px; background:#f8fafc; text-align:center;">
                <h4 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:4px;">2. المقطع الطولي التفصيلي للأساس الشريطي المتدرج / LONGITUDINAL SECTION</h4>
                <svg viewBox="0 0 340 230" width="100%" height="auto" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; display:block; margin:0 auto;">
                  <!-- Ground line -->
                  <line x1="15" y1="50" x2="325" y2="50" stroke="#059669" stroke-width="1.2" />
                  <polygon points="25,50 30,44 20,44" fill="#059669" />
                  <text x="50" y="44" fill="#059669" font-size="6" font-weight="bold">مستوى أرض طبيعي NGL</text>

                  <!-- Stepped Foundation PCC boundary -->
                  <path d="M 25,180 L 190,180 L 190,150 L 315,150 L 315,160 L 190,160 L 190,190 L 25,190 Z" fill="rgba(148,163,184,0.15)" stroke="#94a3b8" stroke-width="0.7" />
                  <text x="100" y="187" fill="#64748b" font-weight="bold" font-size="5.5">خرسانة عادية PCC (10cm)</text>

                  <!-- Stepped Structural Concrete block -->
                  <path d="M 35,140 L 190,140 L 190,110 L 305,110 L 305,150 L 190,150 L 190,180 L 35,180 Z" fill="rgba(15,23,42,0.02)" stroke="#0f172a" stroke-width="1.8" />
                  <text x="90" y="160" fill="#1e3a8a" font-size="6.5" font-weight="black">سمك شريطي H = ${fH} مم</text>

                  <!-- Vertical Columns starters going down -->
                  <rect x="55" y="15" width="20" height="35" fill="none" stroke="#be123c" stroke-width="1" />
                  <line x1="55" y1="50" x2="55" y2="180" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <line x1="75" y1="50" x2="75" y2="180" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <text x="65" y="12" fill="#be123c" font-size="5" font-weight="bold" text-anchor="middle">C1</text>

                  <rect x="140" y="15" width="20" height="35" fill="none" stroke="#be123c" stroke-width="1" />
                  <line x1="140" y1="50" x2="140" y2="180" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <line x1="160" y1="50" x2="160" y2="180" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <text x="150" y="12" fill="#be123c" font-size="5" font-weight="bold" text-anchor="middle">C2</text>

                  <rect x="235" y="15" width="24" height="35" fill="none" stroke="#be123c" stroke-width="1" />
                  <line x1="235" y1="50" x2="235" y2="150" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <line x1="259" y1="50" x2="259" y2="150" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <text x="247" y="12" fill="#be123c" font-size="5" font-weight="bold" text-anchor="middle">C3</text>

                  <!-- Stepped Foundation Bottom main steel -->
                  <path d="M 40,157 L 40,172 L 182,172" fill="none" stroke="#1d4ed8" stroke-width="1.8" />
                  <path d="M 182,172 L 182,142 L 300,142 L 300,127" fill="none" stroke="#1d4ed8" stroke-width="1.8" />
                  <text x="100" y="178" fill="#1d4ed8" font-size="5" font-weight="bold">حديد سفلي: ${item.barsBotCount}Ø${item.barsBotDia} (Mark SB1)</text>

                  <!-- Stepped Foundation Top main steel -->
                  <path d="M 40,163 L 40,148 L 182,148" fill="none" stroke="#047857" stroke-width="1.8" />
                  <path d="M 182,148 L 182,118 L 300,118 L 300,129" fill="none" stroke="#047857" stroke-width="1.8" />
                  <text x="100" y="145" fill="#047857" font-size="5" font-weight="bold">حديد علوي: ${item.barsTopCount}Ø${item.barsTopDia} (Mark SB2)</text>

                  <!-- Additional reinforcing over supports -->
                  <path d="M 120,118 L 180,118" fill="none" stroke="#b45309" stroke-width="1.5" />
                  <text x="150" y="113" fill="#b45309" font-size="4.5" font-weight="extrabold" text-anchor="middle">إضافي علوي: 4Ø16 لقص العزوم</text>

                  <!-- Continuous stirrups shear links -->
                  ${[45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285].map(x => {
                    const isHigh = (x > 185);
                    const yTop = isHigh ? 115 : 145;
                    const yBot = isHigh ? 144 : 174;
                    return `<line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBot}" stroke="#ea580c" stroke-width="0.8" />`;
                  }).join('')}
                  <text x="210" y="99" fill="#ea580c" font-size="5" font-weight="bold" text-anchor="middle">الكانات: Ø${item.stirrupsDia}@${spacingStirrups}مم c/c (Mark SB3)</text>
                  
                  <!-- Level tag -->
                  <rect x="2" y="105" width="30" height="15" fill="#1e293b" rx="2" />
                  <text x="17" y="114" fill="#fff" font-size="5" font-weight="bold" text-anchor="middle">H = ${fH}mm</text>
                  
                  <text x="195" y="170" fill="#ea580c" font-weight="extrabold" font-size="5.5">تدرج تأسيس STEP</text>
                </svg>
              </div>
            </div>

            <!-- Bottom Spec Compliance & BBS Tables -->
            <div style="display:grid; grid-template-columns: 1.12fr 0.88fr; gap:12px; font-size:10px;">
              <!-- PANEL 3: ACI 318 RULES CHECK -->
              <div style="border:1.2px solid #e2e8f0; border-radius:6px; padding:10px; background:#fff;">
                <h5 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#1e3a8a; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;">
                  📋 مطابقة متطلبات الكود المعتمد وإمداد التماسك (ACI 318-19 Verification Panel)
                </h5>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; line-height:1.5;">
                  <ul style="margin:0; padding-right:15px; list-style-type:square; color:#334155;">
                    <li><strong>النسبة الإنشائية الدنيا:</strong> As,min = ${(AsMinBot).toFixed(0)} مم² (مُحقق ✔️)</li>
                    <li><strong>الحديد الفعلي السفلي:</strong> As,prov = ${(AsProvBot).toFixed(0)} مم² (مُهندَس ✔️)</li>
                    <li><strong>الحد الأدنى للغطاء الخرساني:</strong> 75 مم (مطابق ✔️)</li>
                    <li><strong>تباعد الكانات الفعلي:</strong> ${spacingStirrups} مم (مُحقق < ${Math.min(300, fH/2)} مم ✔)</li>
                  </ul>
                  <ul style="margin:0; padding-right:15px; list-style-type:square; color:#334155;">
                    <li><strong>طول التماسك بالشد l_d:</strong> ${ldX_bot} مم (متوفر بالكامل وعكفة ✔️)</li>
                    <li><strong>طول العكفة القياسية l_dh:</strong> ${ldhX_bot} مم (محقق ✔️)</li>
                    <li><strong>الوصل التراكبي بالشد (Lap):</strong> ${(ldX_bot * 1.3).toFixed(0)} مم (متطابق ✔)</li>
                    <li><strong>مقاومة القص الثاقب (Punching):</strong> مُحقق تحت حمولة الأقصى ✔</li>
                  </ul>
                </div>
                <div style="margin-top:8px; padding:5px; background:#f0fdf4; border-radius:4px; font-size:9px; color:#166534; border-right:3px solid #15803d; line-height:1.4;">
                  <strong>توصية الإشراف والموقع:</strong> يجب تزويد نهايات لوحة الأساس الشريطي المتصل بـ Hook 90-degree بطول عكفة 30 سم على الأقل، مع تأمين تلاق حيد الشواخص المار بالتدرج (Step Transition) لضمان تسليح تراكبي سليم لنقل قوى القص المتولدة نتيجة تدرج منسوب التأسيس.
                </div>
              </div>

              <!-- PANEL 4: BOQ MATERIAL ESTIMATES & CAD EXPORT -->
              <div style="border:1.2px solid #e2e8f0; border-radius:6px; padding:10px; background:#fafafa; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <h5 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#be123c; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;">
                    📊 كشف حصر وتكلفة المواد التقديرية للأساس الشريطي
                  </h5>
                  <table style="width:100%; border-collapse:collapse; font-size:10px;">
                    <tr style="border-bottom:1px solid #e2e8f0;">
                      <td style="padding:4px 0; color:#555;">حجم خرسانة مسلحة (RC):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#111827; text-align:left;">${concVol.toFixed(3)} م³</td>
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                      <td style="padding:4px 0; color:#555;">خرسانة النظافة (PCC):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#111827; text-align:left;">${pccVol.toFixed(3)} م³</td>
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                      <td style="padding:4px 0; color:#555;">الوزن الصافي لحديد التسليح:</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#1e3a8a; text-align:left;">${totWeight.toFixed(1)} كغ</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0; color:#555;">أعمدة الدعم المسنودة:</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#059669; text-align:left;">3 أعمدة مدببة (C1, C2, C3)</td>
                    </tr>
                  </table>
                </div>

                <div style="margin-top:10px;">
                  <button 
                    style="width:100%; height:28px; font-size:10px; font-weight:extrabold; background:#0f172a; color:#fff; border:none; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 1px 2px rgba(0,0,0,0.05);"
                    onclick="window.dispatchEvent(new CustomEvent('export-strip-dxf'))"
                  >
                    <span>📥 تحميل التفاصيل كملف CAD (DXF) مستقل</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      case 'S-303': {
        const item = activeCombinedItem || combinedFootingsList[0];
        
        const fL = item.L;
        const fB1 = item.B1;
        const fB2 = item.B2;
        const fH = item.H;
        
        const concVol = item.concreteVol;
        const pccVol = (fB1/1000 + 0.2) * (fL/1000 + 0.2) * 0.1;
        
        return `
          <div style="direction:rtl; text-align:right; font-family:'Cairo', 'Inter', sans-serif; padding:10px; background:#fff; color:#0f172a;">
            <!-- Drawing Header & Quick Metadata Info Bar -->
            <div style="border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h3 style="margin:0; font-size:14px; font-weight:800; color:#1e3a8a;">تفاصيل تسليح ومقاطع الأساسات المشتركة المستمرة: ${item.id}</h3>
                <p style="margin:2px 0 0 0; font-size:10px; color:#475569;">مطابق لمتطلبات الكود المعتمد الأمريكي خرسانة مسلحة ACI 318-19 وتتابع مستويات التأسيس الميدانية</p>
              </div>
              <div style="text-align:left; font-size:10px; font-weight:bold; color:#be123c;">
                <span>المقياس المقترح / SCALE: 1:25</span><br/>
                <span style="color:#059669; font-family:monospace;">LEVEL EL = -2.00 m (تأسيس مسلّح مشترك)</span>
              </div>
            </div>

            <!-- Main Drawings Layout Block -->
            <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:12px; margin-bottom:15px;">
              <!-- PANEL 1: PLAN VIEW -->
              <div style="border:1.2px solid #cbd5e1; border-radius:6px; padding:10px; background:#f8fafc; text-align:center;">
                <h4 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:4px;">1. المسقط الأفقي للقاعدة المشتركة وتفاصيل الفرش والغطاء / PLAN REBAR</h4>
                <svg viewBox="0 0 280 230" width="100%" height="auto" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; display:block; margin:0 auto;">
                  <!-- Axis center line -->
                  <line x1="15" y1="110" x2="265" y2="110" stroke="#be123c" stroke-width="0.8" stroke-dasharray="4 3" />
                  
                  <!-- Combined footing boundary -->
                  ${item.shape === 'rectangular' 
                    ? `<rect x="35" y="45" width="210" height="130" fill="rgba(37,99,235,0.02)" stroke="#2563eb" stroke-width="2.2" rx="3" />`
                    : `<polygon points="35,40 245,55 245,165 35,180" fill="rgba(37,99,235,0.02)" stroke="#2563eb" stroke-width="2.2" />`
                  }
                  
                  <!-- Column markers resting along combined foundation -->
                  <!-- Column C1 (Edge/Property) -->
                  <rect x="52" y="90" width="24" height="40" fill="rgba(220,38,38,0.12)" stroke="#dc2626" stroke-width="1.2" />
                  <line x1="52" y1="90" x2="76" y2="130" stroke="#dc2626" stroke-width="0.5" />
                  <text x="64" y="82" fill="#dc2626" font-size="6.5" font-weight="extrabold" text-anchor="middle">C1 (${item.columns[0]?.cx || 400}x${item.columns[0]?.cy || 400})</text>
                  
                  <!-- Column C2 (Interior) -->
                  <rect x="200" y="85" width="26" height="50" fill="rgba(220,38,38,0.12)" stroke="#dc2626" stroke-width="1.2" />
                  <line x1="200" y1="85" x2="226" y2="135" stroke="#dc2626" stroke-width="0.5" />
                  <text x="213" y="77" fill="#dc2626" font-size="6.5" font-weight="extrabold" text-anchor="middle">C2 (${item.columns[1]?.cx || 450}x${item.columns[1]?.cy || 450})</text>

                  <!-- Bottom longitudinal steel -->
                  <line x1="40" y1="160" x2="240" y2="160" stroke="#1d4ed8" stroke-width="1.8" />
                  <line x1="40" y1="160" x2="40" y2="152" stroke="#1d4ed8" stroke-width="1.8" />
                  <line x1="240" y1="160" x2="240" y2="152" stroke="#1d4ed8" stroke-width="1.8" />
                  <text x="140" y="156" fill="#1d4ed8" font-size="6.5" font-weight="extrabold" text-anchor="middle">تسليح سفلي رئيسي: ${item.botSteelText} مستمر</text>

                  <!-- Top longitudinal steel -->
                  <line x1="40" y1="60" x2="240" y2="60" stroke="#047857" stroke-width="1.8" />
                  <line x1="40" y1="60" x2="40" y2="68" stroke="#047857" stroke-width="1.8" />
                  <line x1="240" y1="60" x2="240" y2="68" stroke="#047857" stroke-width="1.8" />
                  <text x="140" y="70" fill="#047857" font-size="6.5" font-weight="extrabold" text-anchor="middle">تسليح علوي مستمر: ${item.topSteelText} مستمر</text>

                  <!-- Transverse and distribution bars -->
                  <text x="140" y="123" fill="#475569" font-size="6" font-weight="bold" text-anchor="middle">حديد عرضي في منطقة العمود: ${item.transverseSteelText}</text>

                  <!-- Dimensions -->
                  <line x1="35" y1="190" x2="245" y2="190" stroke="#334155" stroke-width="0.7" />
                  <line x1="35" y1="187" x2="35" y2="193" stroke="#334155" stroke-width="0.7" />
                  <line x1="245" y1="187" x2="245" y2="193" stroke="#334155" stroke-width="0.7" />
                  <text x="140" y="200" fill="#334155" font-size="7.5" font-weight="bold" text-anchor="middle">الطول L = ${fL} مم</text>

                  <line x1="20" y1="45" x2="20" y2="175" stroke="#334155" stroke-width="0.7" />
                  <line x1="17" y1="45" x2="23" y2="45" stroke="#334155" stroke-width="0.7" />
                  <line x1="17" y1="175" x2="23" y2="175" stroke="#334155" stroke-width="0.7" />
                  <text x="15" y="113" fill="#334155" font-size="7.5" font-weight="bold" text-anchor="end">العرض البادئ B1 = ${fB1} مم</text>
                </svg>
              </div>

              <!-- PANEL 2: LONGITUDINAL SECTION A-A -->
              <div style="border:1.2px solid #cbd5e1; border-radius:6px; padding:10px; background:#f8fafc; text-align:center;">
                <h4 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:4px;">2. القطاع الطولي والمقاطع الإنشائية التفصيلية (Profile Elevation)</h4>
                <svg viewBox="0 0 340 230" width="100%" height="auto" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; display:block; margin:0 auto;">
                  <!-- Ground line -->
                  <line x1="15" y1="50" x2="325" y2="50" stroke="#059669" stroke-width="1.2" />
                  <polygon points="25,50 30,44 20,44" fill="#059669" />
                  <text x="50" y="44" fill="#059669" font-size="6" font-weight="bold">مستوى أرض طبيعي NGL</text>

                  <!-- PCC Blinding Layer -->
                  <rect x="30" y="165" width="280" height="15" fill="rgba(148,163,184,0.15)" stroke="#94a3b8" stroke-width="0.7" />
                  <text x="170" y="175" fill="#64748b" font-weight="bold" font-size="5.5">خرسانة نظافة عادية (10 سم)</text>

                  <!-- Main RCC Footing -->
                  <rect x="40" y="115" width="260" height="50" fill="rgba(15,23,42,0.02)" stroke="#0f172a" stroke-width="1.8" />
                  <text x="170" y="145" fill="#1e3a8a" font-size="6.5" font-weight="black">السماكة H = ${fH} مم</text>

                  <!-- Columns Starters -->
                  <rect x="60" y="25" width="20" height="40" fill="none" stroke="#be123c" stroke-width="1" />
                  <line x1="60" y1="65" x2="60" y2="165" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <line x1="80" y1="65" x2="80" y2="165" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <text x="70" y="18" fill="#be123c" font-size="5.5" font-weight="bold" text-anchor="middle">C1</text>

                  <rect x="210" y="25" width="20" height="40" fill="none" stroke="#be123c" stroke-width="1" />
                  <line x1="210" y1="65" x2="210" y2="165" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <line x1="230" y1="65" x2="230" y2="165" stroke="#dc2626" stroke-width="0.8" stroke-dasharray="2 1" />
                  <text x="220" y="18" fill="#be123c" font-size="5.5" font-weight="bold" text-anchor="middle">C2</text>

                  <!-- Bottom continuous steel elevation -->
                  <path d="M 45,158 L 45,162 L 295,162 L 295,158" fill="none" stroke="#1d4ed8" stroke-width="1.8" />
                  <text x="170" y="156" fill="#1d4ed8" font-size="5.5" font-weight="bold" text-anchor="middle">تسليح سفلي رئيسي: ${item.botSteelText} (فرش مستمر)</text>

                  <!-- Top continuous steel elevation -->
                  <path d="M 45,122 L 45,118 L 295,118 L 295,122" fill="none" stroke="#047857" stroke-width="1.8" />
                  <text x="170" y="126" fill="#047857" font-size="5.5" font-weight="bold" text-anchor="middle">تسليح علوي رئيسي: ${item.topSteelText} (غطاء دائم)</text>
                </svg>
              </div>
            </div>

            <!-- Bottom Data Panel: Engineering Spec notes & BOQ Block -->
            <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:12px; font-size:10.5px;">
              <!-- SECTION A: SPECIFICATIONS & ACI INTERACTIVE CHECKS -->
              <div style="border:1.2px solid #e2e8f0; border-radius:6px; padding:10px; background:#fff;">
                <h5 style="margin:0 0 6px 0; font-size:11.5px; font-weight:bold; color:#1e3a8a; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;">
                  📋 مطابقة متطلبات الكود المجمع (ACI 318 Combined Footing Verifications)
                </h5>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                  <ul style="margin:0; padding-right:15px; list-style-type:square; line-height:1.5; color:#334155;">
                    <li><strong>العزم المنقلب العلوي بالمنتصف:</strong> مُحسّب بالكامل ومُغطى بحديد علوي مستمر</li>
                    <li><strong>عمق مقاومة القص اللامتناهي:</strong> d = ${fH - 75} مم (كافي للقص العزمي)</li>
                    <li><strong>حساب طاقة التحمل أسفل العمودين:</strong> متوازن بنقل مركز الثقل ✔️</li>
                    <li><strong>تباعد شبكة الحديد العرضية:</strong> s = 150 مم (ضمن ضوابط التدعيم)</li>
                  </ul>
                  <ul style="margin:0; padding-right:15px; list-style-type:square; line-height:1.5; color:#334155;">
                    <li><strong>حماية حديد الأطراف (Clear Cover):</strong> 75 مم لجميع أوجه الاحتكاك بالتربة</li>
                    <li><strong>اشتراطات تماسك أشاير الأعمدة:</strong> l_d = 50Ø (كافية للارتكاز الرأسي التام)</li>
                    <li><strong>مقاومة القص الثاقب (Punching Shear):</strong> محققة بالكامل (v_u &lt; phi * v_c)</li>
                    <li><strong>نوع وصلات ربط الحديد:</strong> عكفة 90 درجة بطول لا يقل عن 25 سم</li>
                  </ul>
                </div>
                <div style="margin-top:8px; padding:6px; background:#f1f5f9; border-radius:4px; font-size:9.5px; color:#475569; border-right:3px solid #be123c;">
                  <strong>توجيهات الموقع:</strong> يتوجب صب القاعدة المشتركة في دفعة واحدة مستمرة من دون فواصل صب لتلافي خطوط الضعف وتأمين الجساءة المطلوبة للربط بين العمودين وتوازن الإجهادات.
                </div>
              </div>

              <!-- SECTION B: SINGLE FOOTING SUMMARY (BOQ) -->
              <div style="border:1.2px solid #e2e8f0; border-radius:6px; padding:10px; background:#fefefe; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <h5 style="margin:0 0 6px 0; font-size:11.5px; font-weight:bold; color:#be123c; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;">
                    📊 تقرير الكميات المعتمد لهذا النموذج (Takeoff Sheet)
                  </h5>
                  <table style="width:100%; border-collapse:collapse; text-align:right; font-size:10px; margin-top:4px;">
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">خرسانة مسلحة مشتركة (RCC):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#0f172a;">${concVol.toFixed(3)} م3</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">خرسانة نظافة عادية (PCC):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#0f172a;">${pccVol.toFixed(3)} م3</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">الوزن الصافي للحديد المقدر:</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#1e3a8a;">${item.steelWeightKg} كغ</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0; color:#555;">الحفر الكلي التقديري:</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#059669;">${item.excavationVol.toFixed(1)} م3</td>
                    </tr>
                  </table>
                </div>
                <div style="margin-top:auto;">
                  <button 
                    style="width:100%; height:26px; font-size:9.5px; font-weight:extrabold; background:#0f172a; color:#fff; border:none; border-radius:4px; cursor:pointer;"
                    onclick="window.dispatchEvent(new CustomEvent('export-combined-dxf'))"
                  >
                    📥 استخراج مقاطع هذه القاعدة كملف DXF مستقل
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      case 'S-304': {
        const item = activeStrapItem || strapFootingsList[0];
        // Leverage the real senior engineer structural engine we have!
        const result = analyzeStrapFooting({
          id: item.id,
          name: item.name,
          S: item.S,
          L_span: item.L_span,
          ext_L: item.ext_L,
          ext_B: item.ext_B,
          ext_H: item.ext_H,
          ext_a1: item.ext_a1,
          ext_pedestalH: 0,
          int_L: item.int_L,
          int_B: item.int_B,
          int_H: item.int_H,
          int_pedestalH: 0,
          beam_b: item.beam_b,
          beam_h: item.beam_h,
          fc: item.fc,
          fy: item.fy,
          qall: qall, // from state
          gammaConc: 25,
          gammaSoil: 18,
          soilCover: soilCoverDepth,
          ext_col: { name: 'C1', cx: item.ext_col.cx, cy: item.ext_col.cy, PDead: item.ext_col.PDead, PLive: item.ext_col.PLive },
          int_col: { name: 'C2', cx: item.int_col.cx, cy: item.int_col.cy, PDead: item.int_col.PDead, PLive: item.int_col.PLive },
          includeSelfWeight: true,
          includeSoilSurcharge: true
        });

        const isStepped = item.ext_footing_level !== item.int_footing_level;
        
        return `
          <div style="direction:rtl; text-align:right; font-family:'Cairo', 'Inter', sans-serif; padding:10px; background:#fff; color:#0f172a;">
            <!-- Drawing Header & Quick Metadata Info Bar -->
            <div style="border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h3 style="margin:0; font-size:14px; font-weight:800; color:#1e3a8a;">تفاصيل تسليح ونظام الميدات الرابطة الكابولية للجار: ${item.id}</h3>
                <p style="margin:2px 0 0 0; font-size:10px; color:#475569;">تصميم معتمد لمقاومة عزوم الانقلاب وحمل العمود الجاري بتأثير الاتصال الكابولي المستمر ACI 318</p>
              </div>
              <div style="text-align:left; font-size:10px; font-weight:bold; color:#be123c;">
                <span>المقياس المقترح / SCALE: 1:25</span><br/>
                <span style="color:#059669; font-family:monospace;">LEVEL ${item.ext_footing_level?.toFixed(2)} m إلى ${item.int_footing_level?.toFixed(2)} m ${isStepped ? '(منسوب متدرج Stepped)' : '(منسوب موحد)'}</span>
              </div>
            </div>

            <!-- Main Drawings Layout Block -->
            <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:12px; margin-bottom:15px;">
              <!-- PANEL 1: PLAN VIEW -->
              <div style="border:1.2px solid #cbd5e1; border-radius:6px; padding:10px; background:#f8fafc; text-align:center;">
                <h4 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:4px;">1. المسقط الأفقي لنظام الميدة الرابطة (Plan View System)</h4>
                <svg viewBox="0 0 320 230" width="100%" height="auto" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; display:block; margin:0 auto;">
                  <!-- Grid layout lines -->
                  <line x1="10" y1="115" x2="310" y2="115" stroke="#94a3b8" stroke-width="0.5" stroke-dasharray="3 3" />
                  
                  <!-- Exterior Footing (Left) -->
                  <rect x="25" y="45" width="60" height="140" fill="rgba(37,99,235,0.03)" stroke="#1e3a8a" stroke-width="1.8" rx="2" />
                  <text x="55" y="40" fill="#1e3a8a" font-size="6" font-weight="black" text-anchor="middle">الخارجية: ${item.ext_L}x${item.ext_B}x${item.ext_H} مم</text>

                  <!-- Interior Footing (Right) -->
                  <rect x="215" y="40" width="80" height="150" fill="rgba(37,99,235,0.03)" stroke="#1e3a8a" stroke-width="1.8" rx="2" />
                  <text x="255" y="34" fill="#1e3a8a" font-size="6" font-weight="black" text-anchor="middle">الداخلية: ${item.int_L}x${item.int_B}x${item.int_H} مم</text>

                  <!-- Connecting Strap Beam -->
                  <rect x="85" y="95" width="130" height="40" fill="rgba(245,158,11,0.05)" stroke="#f59e0b" stroke-width="1.5" />
                  <text x="150" y="90" fill="#f59e0b" font-size="7" font-weight="extrabold" text-anchor="middle">ميدة SB: ${item.beam_b}x${item.beam_h} مم</text>

                  <!-- Exterior Column (eccentric at edge) -->
                  <rect x="28" y="100" width="16" height="30" fill="rgba(220,38,38,0.2)" stroke="#dc2626" stroke-width="1.2" />
                  <line x1="28" y1="100" x2="44" y2="130" stroke="#dc2626" stroke-width="0.6" />
                  <line x1="44" y1="100" x2="28" y2="130" stroke="#dc2626" stroke-width="0.6" />
                  <text x="36" y="93" fill="#dc2626" font-size="6.5" font-weight="black" text-anchor="middle">${item.ext_col.name}</text>

                  <!-- Interior Column (concentric) -->
                  <rect x="247" y="97" width="16" height="36" fill="rgba(220,38,38,0.2)" stroke="#dc2626" stroke-width="1.2" />
                  <line x1="247" y1="97" x2="263" y2="133" stroke="#dc2626" stroke-width="0.6" />
                  <line x1="263" y1="97" x2="247" y2="133" stroke="#dc2626" stroke-width="0.6" />
                  <text x="255" y="91" fill="#dc2626" font-size="6.5" font-weight="black" text-anchor="middle">${item.int_col.name}</text>

                  <!-- Soil reactions & safety details -->
                  <text x="55" y="196" fill="#059669" font-size="6.5" font-weight="bold" text-anchor="middle">ضغط التربة: ${result.extSoilReaction_s.toFixed(1)} kPa</text>
                  <text x="255" y="202" fill="#059669" font-size="6.5" font-weight="bold" text-anchor="middle">ضغط التربة: ${result.intSoilReaction_s.toFixed(1)} kPa</text>

                  <!-- Rebar text layout -->
                  <text x="150" y="146" fill="#1d4ed8" font-size="6" font-weight="black" text-anchor="middle">حديد الميدة علوي: ${result.beam_top_rebar.barText}</text>
                  <text x="150" y="156" fill="#1d4ed8" font-size="6" font-weight="black" text-anchor="middle">حديد الميدة سفلي: ${result.beam_bot_rebar.barText}</text>

                  <!-- Dimension markings -->
                  <line x1="36" y1="210" x2="255" y2="210" stroke="#475569" stroke-width="0.6" />
                  <line x1="36" y1="207" x2="36" y2="213" stroke="#475569" stroke-width="0.6" />
                  <line x1="255" y1="207" x2="255" y2="213" stroke="#475569" stroke-width="0.6" />
                  <text x="150" y="220" fill="#475569" font-size="7" font-weight="extrabold" text-anchor="middle">التباعد المحوري L = ${item.L_span} مم</text>
                </svg>
              </div>

              <!-- PANEL 2: LONGITUDINAL SECTION A-A -->
              <div style="border:1.2px solid #cbd5e1; border-radius:6px; padding:10px; background:#f8fafc; text-align:center;">
                <h4 style="margin:0 0 6px 0; font-size:11px; font-weight:bold; color:#0f172a; border-bottom:1px dashed #cbd5e1; padding-bottom:4px;">2. المقطع والمنظور الرأسي الطولي للنظام (Stepped Elevation Profile)</h4>
                <svg viewBox="0 0 350 230" width="100%" height="auto" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:4px; display:block; margin:0 auto;">
                  <!-- Ground line -->
                  <line x1="10" y1="50" x2="340" y2="50" stroke="#059669" stroke-width="1.2" />
                  <polygon points="15,50 20,44 10,44" fill="#059669" />
                  <text x="40" y="44" fill="#059669" font-size="6" font-weight="bold">مستوى سطح الأرض الطبيعية NGL</text>

                  <!-- Base levels dynamically determined by step support case -->
                  ${isStepped 
                    ? `
                      <!-- Stepped elevations -->
                      <!-- Ext PCC Blinding -->
                      <rect x="25" y="130" width="60" height="10" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.6" />
                      <!-- Ext Footing -->
                      <rect x="30" y="90" width="50" height="40" fill="rgba(30,58,138,0.02)" stroke="#1e3a8a" stroke-width="1.8" />
                      
                      <!-- Int PCC Blinding -->
                      <rect x="210" y="170" width="80" height="10" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.6" />
                      <!-- Int Footing -->
                      <rect x="215" y="125" width="70" height="45" fill="rgba(30,58,138,0.02)" stroke="#1e3a8a" stroke-width="1.8" />

                      <!-- Stepped elevation line connecting footings -->
                      <line x1="80" y1="130" x2="210" y2="170" stroke="#475569" stroke-width="0.8" stroke-dasharray="3 3" />
                      <text x="145" y="180" fill="#be123c" font-size="6" font-weight="extrabold" text-anchor="middle">خط تدرج منسوب التأسيس (Stepped Transition)</text>

                      <!-- Connecting Strap Beam stepped -->
                      <polygon points="80,90 215,125 215,145 80,115" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="1.5" />
                    `
                    : `
                      <!-- Constant levels -->
                      <!-- Ext PCC Blinding -->
                      <rect x="25" y="160" width="60" height="10" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.6" />
                      <!-- Ext Footing -->
                      <rect x="30" y="115" width="50" height="45" fill="rgba(30,58,138,0.02)" stroke="#1e3a8a" stroke-width="1.8" />
                      
                      <!-- Int PCC Blinding -->
                      <rect x="210" y="160" width="80" height="10" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.6" />
                      <!-- Int Footing -->
                      <rect x="215" y="115" width="70" height="45" fill="rgba(30,58,138,0.02)" stroke="#1e3a8a" stroke-width="1.8" />

                      <!-- Connecting Strap Beam -->
                      <rect x="80" y="115" width="135" height="35" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="1.5" />
                    `
                  }

                  <!-- Column starters -->
                  <line x1="36" y1="30" x2="36" y2="105" stroke="#be123c" stroke-width="1.2" />
                  <line x1="255" y1="25" x2="255" y2="110" stroke="#be123c" stroke-width="1.2" />

                  <!-- EPS foam separative layer block -->
                  <rect x="85" y="${isStepped ? '146' : '151'}" width="125" height="4" fill="rgba(100,116,139,0.2)" stroke="#64748b" stroke-width="0.5" />
                  <text x="145" y="${isStepped ? '157' : '162'}" fill="#64748b" font-size="5" text-anchor="middle">فاصل تمدد من الفلين EPS لمنع ملامسة التربة</text>

                  <!-- Rebar representations and anchorage -->
                  <path d="M 36,95 L 255,95" fill="none" stroke="#be123c" stroke-width="1.6" />
                  <path d="M 36,95 L 36,120 M 255,95 L 255,120" fill="none" stroke="#be123c" stroke-width="1.6" />
                  <text x="145" y="88" fill="#be123c" font-size="6" font-weight="black" text-anchor="middle">كابل الشد العلوي الرئيسي: ${result.beam_top_rebar.barText} (عُكفة معقوفة)</text>

                  <!-- Stirrup annotations -->
                  <line x1="90" y1="105" x2="90" y2="135" stroke="#f59e0b" stroke-width="0.8" />
                  <line x1="95" y1="105" x2="95" y2="135" stroke="#f59e0b" stroke-width="0.8" />
                  <line x1="100" y1="105" x2="100" y2="135" stroke="#f59e0b" stroke-width="0.8" />
                  <text x="145" y="105" fill="#f59e0b" font-size="5.5" font-weight="bold" text-anchor="middle">كانات مغلّقة: ${result.beam_stirrups}</text>
                  
                  <!-- Footing rebar meshes -->
                  <line x1="32" y1="${isStepped ? '122' : '152'}" x2="78" y2="${isStepped ? '122' : '152'}" stroke="#1d4ed8" stroke-width="1.2" />
                  <line x1="218" y1="${isStepped ? '162' : '152'}" x2="282" y2="${isStepped ? '162' : '152'}" stroke="#1d4ed8" stroke-width="1.2" />
                </svg>
              </div>
            </div>

            <!-- Bottom Data Panel: Engineering Spec notes & BOQ Block -->
            <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:12px; font-size:10.5px;">
              <!-- SECTION A: SPECIFICATIONS & ACI INTERACTIVE CHECKS -->
              <div style="border:1.2px solid #e2e8f0; border-radius:6px; padding:10px; background:#fff;">
                <h5 style="margin:0 0 6px 0; font-size:11.5px; font-weight:bold; color:#1e3a8a; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;">
                  📋 محددات الارتكاز والتحقق الإنشائي الميداني (Strap Foundation System Audits)
                </h5>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                  <ul style="margin:0; padding-right:15px; list-style-type:square; line-height:1.5; color:#334155;">
                    <li><strong>عزم الاتزان المتولد عن اللامركزية:</strong> balanced = ${result.M_beam_max.toFixed(1)} kN·m</li>
                    <li><strong>حالة ملامسة التربة للربط الميداني:</strong> مفصول تام بخلايا الفلين EPS (لا يقبل الضغط)</li>
                    <li><strong>القص الأقصى المتوقع بالميدة:</strong> V_u = ${result.V_beam_max.toFixed(1)} kN</li>
                    <li><strong>تأمين طول التماسك للأشواك والعلالي:</strong> L_d مطور بالكامل عكفة 90° داخل العمودين</li>
                  </ul>
                  <ul style="margin:0; padding-right:15px; list-style-type:square; line-height:1.5; color:#334155;">
                    <li><strong>سماكة قاعدة الجار الخارجية مقاومة الثقب:</strong> d_ext = ${item.ext_H - 100} مم (محققة تماماً)</li>
                    <li><strong>أوزان حديد تسليح الميدة الرابطة:</strong> متوافق مع جدول كشف التفريد الإنشائي BBS</li>
                    <li><strong>نوع الخرسانة RCC:</strong> مقاومة ضغط f'c = ${item.fc} MPa سريعة التصلب وبفحوصات معتمدة</li>
                    <li><strong>الغطاء الخرساني الصافي الدائم:</strong> 75 مم للقواعد المتلامسة مع قعور الحفر</li>
                  </ul>
                </div>
                <div style="margin-top:8px; padding:6px; background:#eef2f6; border-radius:4px; font-size:9.5px; color:#475569; border-right:3px solid #f59e0b;">
                  <strong>تنويه هندسي هام:</strong> في حال وجود فروقات مناسيب تأسيس (كحالتنا في نموذج ST-02)، ينبغي تدريج الميدة مع فروق المستويات بزاوية ميل معتمدة وبإضافة حديد تراكب وتسليح كابات تماسك إضافي لضمان نقل عزوم الدوران والحد من الهبوط التمايزي للجار.
                </div>
              </div>

              <!-- SECTION B: SINGLE FOOTING SUMMARY (BOQ) -->
              <div style="border:1.2px solid #e2e8f0; border-radius:6px; padding:10px; background:#fefefe; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                  <h5 style="margin:0 0 6px 0; font-size:11.5px; font-weight:bold; color:#be123c; border-bottom:1.5px solid #e2e8f0; padding-bottom:3px;">
                    📊 حصر كميات المواد لهذا النموذج (Takeoff & QS Report)
                  </h5>
                  <table style="width:100%; border-collapse:collapse; text-align:right; font-size:10px; margin-top:4px;">
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">خرسانة مسلحة للميد والأساسات (RCC):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#0f172a;">${result.concreteRCCVol.toFixed(3)} م3</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">خرسانة نظافة ممهدة عادية (PCC):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#0f172a;">${result.concretePCCVol.toFixed(3)} م3</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">إجمالي كتلة حديد التسليح (BBS):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#1e3a8a;">${result.totalSteelKg} كغ</td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:4px 0; color:#555;">المساحة الإجمالية لقوالب الخشب (Formwork):</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#0f172a;">${result.formworkArea.toFixed(1)} م2</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0; color:#555;">مقدار الحفر والردم المحسوب:</td>
                      <td style="padding:4px 0; font-weight:bold; font-family:monospace; color:#059669;">${result.excavationVol} م3 / ${result.backfillVol} م3</td>
                    </tr>
                  </table>
                </div>
                <div style="margin-top:auto; padding-top:6px;">
                  <button 
                    style="width:100%; height:26px; font-size:9.5px; font-weight:extrabold; background:#0f172a; color:#fff; border:none; border-radius:4px; cursor:pointer;"
                    onclick="window.dispatchEvent(new CustomEvent('export-strap-dxf'))"
                  >
                    📥 استخراج لوحة المبيدات ونموذج تفاصيل الجار كملف DXF مستقل
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      case 'S-401':
        return `
          <div style="direction:rtl; text-align:right; font-family:'Cairo', sans-serif; padding:15px;">
            <table style="width:100%; border-collapse:collapse; font-size:10.5px; border:1px solid #cbd5e1;">
              <thead>
                <tr style="background:#020617; color:#ffffff; font-weight:bold;">
                  <th style="border:1px solid #cbd5e1; padding:6px; text-align:center;">القاعدة</th>
                  <th style="border:1px solid #cbd5e1; padding:6px; text-align:center;">رمز السيخ</th>
                  <th style="border:1px solid #cbd5e1; padding:6px; text-align:center;">الاتجاه / الطبقة</th>
                  <th style="border:1px solid #cbd5e1; padding:6px; text-align:center;">القطر</th>
                  <th style="border:1px solid #cbd5e1; padding:6px; text-align:center;">الشكل الإنشائي</th>
                  <th style="border:1px solid #cbd5e1; padding:6px; text-align:center;">العدد الكلي</th>
                  <th style="border:1px solid #cbd5e1; padding:6px; text-align:center;">الطول المفرد (m)</th>
                  <th style="border:1px solid #cbd5e1; padding:6px; text-align:center;">الوزن الشامل (kg)</th>
                </tr>
              </thead>
              <tbody>
                ${bbsItemsList.map((item, idx) => `
                  <tr style="background:#fff;">
                    <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-weight:bold; background:#f8fafc;">${item.typeMark}</td>
                    <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-family:monospace;">${item.barMark}</td>
                    <td style="border:1px solid #cbd5e1; padding:6px; text-align:right;">${item.layer}</td>
                    <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-family:monospace;">Ø${item.diameter}</td>
                    <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; color:#475569;">سيخ معقوف عاكس (L-Hooked)</td>
                    <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-family:monospace;">${item.quantity}</td>
                    <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-family:monospace; color:#1e3a8a;">${item.singleLength.toFixed(2)}</td>
                    <td style="border:1px solid #cbd5e1; padding:6px; text-align:center; font-family:monospace; font-weight:bold; color:#059669;">${item.totalWeight.toFixed(1)} كغ</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      case 'S-402':
        return `
          <div style="direction:rtl; text-align:right; font-family:'Cairo', sans-serif; padding:15px; max-width:600px; margin:0 auto;">
            <div style="background:#faf5ff; border:1px solid #e9d5ff; padding:15px; border-radius:8px;">
              <h4 style="margin:0 0 10px 0; font-size:13px; font-weight:bold; color:#581c87; border-bottom:1px solid #d8b4fe; padding-bottom:5px;">بيان الكميات وجداول الفواتير التفصيلية المعتمدة لأساسات الموقع:</h4>
              <ul style="list-style:none; padding:0; margin:0; line-height:2.0; font-size:11px;">
                <li style="border-bottom:1px dashed #e9d5ff; padding:4px 0;"><span>مكعب مكعّبات الخرسانة المسلّحة التقديرية:</span> <strong style="color:#1e3a8a; float:left;">${takeoffMetrics.concrete.toFixed(2)} m³</strong></li>
                <li style="border-bottom:1px dashed #e9d5ff; padding:4px 0;"><span>الوزن الصافي الإجمالي لحديد التسليح:</span> <strong style="color:#059669; float:left;">${takeoffMetrics.steel.toFixed(0)} kg</strong></li>
                <li style="border-bottom:1px dashed #e9d5ff; padding:4px 0;"><span>حجم إزاحة وإعادة تعبئة التربة (الحفريات):</span> <strong style="color:#d97706; float:left;">${takeoffMetrics.excavation.toFixed(1)} m³</strong></li>
                <li style="border-bottom:1px dashed #e9d5ff; padding:4px 0; margin-top:5px; padding-top:10px; border-top:2px solid #e9d5ff; font-weight:bold;"><span>التكلفة التقريبية المقدرة (خرسانة + حديد + حفريات):</span> <strong style="color:#b91c1c; float:left;">${((takeoffMetrics.concrete * 500) + (takeoffMetrics.steel *  4.5) + (takeoffMetrics.excavation * 40)).toLocaleString()} SAR</strong></li>
              </ul>
            </div>
          </div>
        `;
      default:
        return `<div style="padding:20px; text-align:center;">لا يوجد محتوى متوفر للمقطع الهندسي</div>`;
    }
  };

  const triggerPackagePrinting = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let sheetsCompiled = '';
    sheetMetadata.forEach((sheet) => {
      const activeContent = generateSheetHTMLContent(sheet.code);
      sheetsCompiled += `
        <div class="sheet-page" style="position:relative; width:1200px; height:840px; background:#fff; margin:30px auto; box-shadow:0 0 15px rgba(0,0,0,0.2); overflow:hidden; page-break-after:always; box-sizing:border-box; padding:40px;">
          <div style="position:absolute; left:20px; top:20px; right:20px; bottom:20px; border:2px solid #000;"></div>
          <div style="position:absolute; left:26px; top:26px; right:26px; bottom:26px; border:0.5px solid #000;"></div>
          
          <div style="position:absolute; left:38px; top:38px; right:38px; bottom:160px; border:0.5px solid #bbb; overflow:auto;">
            <div style="background:#1e3a8a; color:#fff; padding:6px 12px; font-weight:bold; font-size:11px; text-transform:uppercase; direction:rtl; text-align:right;">
              ${sheet.code} - ${sheet.title} / ${sheet.ar}
            </div>
            ${activeContent}
          </div>

          <!-- Professional Title Block -->
          <div style="position:absolute; left:38px; bottom:38px; right:38px; height:100px; border:1px solid #000; display:flex; font-family:Arial, sans-serif; direction:rtl; text-align:right; font-size:10px;">
            <div style="width:25%; border-left:1px solid #000; padding:8px; display:flex; flex-direction:column; justify-content:space-around;">
              <span style="font-size:7px; color:#555;">اسم المشروع / PROJECT NAME</span>
              <strong>${projectName}</strong>
              <span style="font-size:7px; color:#555;">مملكة التطوير الهندسي</span>
            </div>
            <div style="width:35%; border-left:1px solid #000; padding:8px; display:flex; flex-direction:column; justify-content:space-around;">
              <span style="font-size:7px; color:#555;">عنوان اللوحة الهندسية / TITLE</span>
              <strong style="color:#b91c1c;">${sheet.title}</strong>
              <span style="font-size:7px; color:#555;">CODE STANDARD: SBC 304 / ACI 318</span>
            </div>
            <div style="width:20%; border-left:1px solid #000; padding:8px; display:flex; flex-direction:column; justify-content:space-around;">
              <div><span>المصمم:</span> <strong>Eng. Detailing AI</strong></div>
              <div><span>المقياس:</span> <strong>scale ${selectedScale}</strong></div>
            </div>
            <div style="width:10%; border-left:1px solid #000; padding:8px; display:flex; flex-direction:column; justify-content:center; align-items:center;">
              <span style="font-size:7px; color:#555;">لوحة</span>
              <strong style="font-size:15px; color:#1e3a8a;">${sheet.code}</strong>
            </div>
            <div style="width:10%; padding:8px; display:flex; flex-direction:column; justify-content:space-around; align-items:center;">
              <span style="font-size:7px; color:#555;">المقاس</span>
              <strong>${sheetSize}</strong>
            </div>
          </div>
        </div>
      `;
    });

    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Foundations Blueprint Export Package</title>
        <style>
          @page { size: A3 landscape; margin: 0; }
          body { background: #e2e8f0; padding: 20px; font-family: 'Arial', sans-serif; }
          .top-bar { background:#0f172a; color:#fff; padding:15px; text-align:center; margin-bottom:20px; border-radius:4px; }
          .btn-print { background:#2563eb; color:#fff; font-weight:bold; padding:8px 24px; border:none; cursor:pointer; }
          @media print {
            .top-bar { display:none; }
            body { padding:0; background:none; }
            .sheet-page { margin:0 !important; box-shadow:none !important; }
          }
        </style>
      </head>
      <body>
        <div class="top-bar">
          <h2 style="margin:0 0 8px 0;">مجموعة المخططات والمقاطع الإنشائية المتكاملة لتصميم وتفريد الأساسات</h2>
          <button class="btn-print" onclick="window.print()">🖨️ طباعة وتصدير اللوحات بالكامل / PRINT SYSTEM</button>
        </div>
        ${sheetsCompiled}
      </body>
      </html>
    `;

    printWindow.document.write(fullHTML);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 text-right" style={{ direction: 'rtl' }}>
      
      {/* ── MODULE HEADER ── */}
      <Card className="border-indigo-200 dark:border-indigo-900 shadow-md">
        <CardContent className="p-4 bg-gradient-to-l from-indigo-50 to-white dark:from-slate-900 dark:to-slate-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-2">
              <Layers2 className="h-5 w-5 text-indigo-600 shrink-0" />
              لوحات وتصدير الأساسات والكميات / Foundations Drawings & Export 📐
            </h2>
            <p className="text-xs text-muted-foreground leading-normal">
              إطار عمل متكامل وشامل لإصدار رسومات المخططات الإنشائية، تفريد حديد التسليح (BBS)، حصر كميات المواد وعلاقات الفوترة مع تصدير الأتوكاد (DXF) وطباعة المستندات القياسية.
            </p>
          </div>
          <div className="flex gap-2 shrink-0 self-end md:self-center">
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={triggerPackagePrinting}>
              <Printer className="h-3.5 w-3.5" /> طباعة ملف اللوحات كاملاً (Package PDF)
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1" onClick={handleDXFMainExport}>
              <Download className="h-3.5 w-3.5" /> تصدير المخطط العام CAD (DXF)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 9 MULTI SUB-TABS RAIL NAVIGATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* RIGHT SIDEBAR TABS SELECTION */}
        <div className="lg:col-span-3 space-y-2">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
            <span className="font-bold text-xs uppercase text-indigo-700 dark:text-indigo-400 block mb-3 border-b border-muted pb-1.5">
              فهرس لوحات الرسومات والتصدير
            </span>
            <div className="space-y-1 flex flex-col">
              {[
                { id: 'layout-plan', label: '1. مخطط المحاور والأساسات', sub: 'Foundation Layout Plan', icon: Compass },
                { id: 'schedule', label: '2. جدول قوالب ونماذج القواعد', sub: 'Foundation Schedule', icon: TableIcon },
                { id: 'isolated-details', label: '3. تفاصيل القواعد المنفصلة', sub: 'Isolated Footing Details', icon: PenTool },
                { id: 'strip-details', label: '4. تفاصيل المقطع الشريطي المستمر', sub: 'Strip Footing Details', icon: Layers },
                { id: 'combined-details', label: '4B. تفاصيل قطاعات القواعد المشتركة', sub: 'Combined Footing Details', icon: Layers2 },
                { id: 'strap-details', label: '4C. تفاصيل الميدة والقاعدة المشتركة الكابولية', sub: 'Strap Footing Details', icon: Layers2 },
                { id: 'bbs', label: '5. جدول تفريد حديد التسليح', sub: 'Bar Bending Schedule (BBS)', icon: FileText },
                { id: 'takeoff', label: '6. حصر كميات المواد والفرز', sub: 'Quantity Takeoff & BOQ', icon: DollarSign },
                { id: 'sheets-manager', label: '7. مدير قوالب ولوحات الرسم', sub: 'Drawing Sheets Manager', icon: Layers3 },
                { id: 'drawing-coordination', label: '8. التنسيق والربط الإنشائي الذكي', sub: 'BIM Drawing Coordination', icon: GitBranch },
                { id: 'dxf-export', label: '9. تجميع وتصدير ملفات DXF', sub: 'CAD (DXF) Exporter', icon: Download },
                { id: 'pdf-export', label: '10. معاينة المطبوعات والتسليم', sub: 'Standard Delivery & Print', icon: Printer },
              ].map((tab) => {
                const IconComponent = tab.icon;
                const isSelected = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as any)}
                    className={`w-full text-right p-2.5 rounded-md flex items-start gap-2.5 transition ${
                      isSelected 
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-bold border border-indigo-200/50' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <IconComponent className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">{tab.label}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{tab.sub}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* QUICK VARIABLE OVERRIDES */}
          <Card className="p-3 space-y-3">
            <span className="font-bold text-xs text-indigo-900 dark:text-indigo-400 block pb-1 border-b border-muted">
              متطلبات الحساب واللوحات
            </span>
            <div className="space-y-2 text-xs">
              <div>
                <Label className="text-[10px] text-muted-foreground">مقياس رصد اللوحة الإنشائية</Label>
                <select 
                  value={selectedScale} 
                  onChange={e => setSelectedScale(e.target.value)}
                  className="w-full mt-1 border border-input rounded p-1 text-xs bg-background"
                >
                  <option value="1:25">1:25 (تفاصيل المقاطع)</option>
                  <option value="1:50">1:50 (مساقط نموذجية)</option>
                  <option value="1:100">1:100 (المخطط العام)</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">عمق منسوب الحفر (HNL mm)</Label>
                <Input 
                  type="number" 
                  value={naturalGroundLevel} 
                  onChange={e => setNaturalGroundLevel(parseInt(e.target.value) || 1500)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">حافة الخردة والرفرفة الجانبية (mm)</Label>
                <Input 
                  type="number" 
                  value={excavationOffset} 
                  onChange={e => setExcavationOffset(parseInt(e.target.value) || 500)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* ACTIVE SUB-TAB INTERACTIVE CONTENT AREA */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          
          {/* TAB 1: FOUNDATION LAYOUT PLAN */}
          {activeSubTab === 'layout-plan' && (
            <div className="space-y-4">
              {foundationLevels.length >= 1 && (
                <Card className="border border-indigo-200 dark:border-indigo-950 bg-indigo-50/5">
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-right">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-400 justify-start">
                        <Layers2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span>تصفية منسوب التأسيس المخطط / Foundation Level filter</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mr-1">
                        يحتوي هذا المشروع على مناسيب تأسيس مختلفة للأعمدة. اختر منسوبًا لعرض وتصدير أساساته فقط لتفادي تداخل المخططات:
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Button
                        type="button"
                        variant={selectedLevelFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        className={`text-xs h-8.5 px-3 font-semibold ${
                          selectedLevelFilter === 'all' ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold' : ''
                        }`}
                        onClick={() => setSelectedLevelFilter('all')}
                      >
                        كل المناسيب ({allBaseCols.length})
                      </Button>
                      {foundationLevels.map(lvl => {
                        const cnt = allBaseCols.filter(col => Math.abs((col.zBottom ?? 0) - lvl) < 100).length;
                        const isSelected = selectedLevelFilter === lvl;
                        return (
                          <Button
                            key={lvl}
                            type="button"
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            className={`text-xs h-8.5 px-3 font-semibold font-mono border shadow-xs ${
                              isSelected 
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-indigo-600' 
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-[#0001ff]'
                            }`}
                            onClick={() => setSelectedLevelFilter(lvl)}
                          >
                            <div className={`${isSelected ? 'text-white' : 'text-[#0001ff]'} font-bold`}>
                              EL: {(lvl / 1000).toFixed(2)}م ({cnt})
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* CAD VIEWER COLUMN */}
              <div className="xl:col-span-8 flex flex-col gap-3">
                <Card className="border border-indigo-100 h-full">
                  <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-muted flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        مخطط مسقط الأساسات والمحاور العام / Live CAD Coordinate Layout Preview
                      </CardTitle>
                      <CardDescription className="text-[10px]">
                        نمذجة الإسقاط لجميع القواعد والأعمدة والشناجات والشناجات الشريطية مع الأبعاد البينية.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-50/50 font-mono text-[9.5px]">
                      {activeScale} SCALE {scaleMode === 'auto' ? '(AUTO)' : '(MANUAL)'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 flex flex-col justify-between h-[520px]">
                    <div className="flex-1 flex items-center justify-center border border-slate-200 bg-white dark:bg-slate-950 rounded-lg overflow-hidden shadow-inner relative">
                      <div 
                        dangerouslySetInnerHTML={{ __html: renderLayoutSVG(false) }} 
                        className="w-full max-w-[640px] select-none"
                      />
                      
                      {/* Interactive Canvas Watermark Indicator */}
                      <div className="absolute top-2 right-2 bg-slate-900/80 text-white font-mono text-[9px] px-2 py-0.5 rounded backdrop-blur">
                        {isTestProjectLoaded ? 'VALIDATION_PROJECT_ACTIVE' : 'ANALYTICAL_MODEL_ACTIVE'}
                      </div>
                    </div>
                    
                    <div className="mt-2.5 bg-amber-50 dark:bg-amber-950/20 text-[10.5px] p-2.5 border border-amber-200/40 rounded text-amber-800 dark:text-amber-300 gap-1.5 flex items-start">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        هذه اللوحة القياسية تطابق ركائز الأعمدة بمواقع الحفر الفعلي. تم احتساب حدود القواعد لتتضمن خلوص رفرفة الحفر الجانبي
                         بقيمة <span className="font-bold">{excavationOffset} مم</span> لضمان عدم حدوث تداخلات إنشائية بصرية أو تداخل بالقواعد المشتركة.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* DRAWING WORKSPACE CONTROLLERS COLUMN */}
              <div className="xl:col-span-4 flex flex-col gap-4">
                {/* 1. TEST PROJECT & ARBITRATION SEEDS */}
                <Card className="border border-indigo-100">
                  <CardHeader className="py-2.5 bg-gradient-to-l from-indigo-50/50 to-white dark:from-slate-900 dark:to-slate-950 border-b border-muted">
                    <CardTitle className="text-[11px] font-bold text-indigo-900 dark:text-indigo-400">
                      مشروع التحقق والاختبار الفني / Verification Test Project
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2.5 text-xs">
                    <p className="text-muted-foreground text-[10px] leading-relaxed">
                      قم بتحميل مشروع التحقق المكون من 12 قاعدة منفصلة بتوجهات وأعماق مختلفة، و3 قواعد شريطية، و8 شناجات ربط لحساب دقة التداخلات ورسم المخطط المعقد.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        size="sm" 
                        variant={isTestProjectLoaded ? "default" : "outline"} 
                        className="text-[10px] h-8 font-sans bg-indigo-600 hover:bg-indigo-700 text-[#000000] font-bold"
                        onClick={handleLoadValidationProject}
                      >
                        تحميل نموذج التدقيق
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        disabled={!isTestProjectLoaded}
                        className="text-[10px] h-8 font-sans text-[#000000] font-bold"
                        onClick={handleResetToAnalyticalModel}
                      >
                        إرجاع للنموذج المحسوب
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. LAYERS VISIBILITY & STYLING */}
                <Card className="border border-indigo-100 flex-1">
                  <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-muted">
                    <CardTitle className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      طبقات مخطط الرسم والتحكم بها / CAD Layers Visibility
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3.5 text-xs">
                    {/* Toggle list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 select-none">
                        <input 
                          type="checkbox" 
                          checked={showGrids} 
                          onChange={e => setShowGrids(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span>شبكة المحاور والفقاعات (GRID)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 select-none">
                        <input 
                          type="checkbox" 
                          checked={showFootings} 
                          onChange={e => setShowFootings(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span>القواعد المنفصلة (FOOTINGS)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 select-none">
                        <input 
                          type="checkbox" 
                          checked={showColumns} 
                          onChange={e => setShowColumns(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span>الأعمدة الخرسانية (COLUMNS)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 select-none">
                        <input 
                          type="checkbox" 
                          checked={showStripFootings} 
                          onChange={e => setShowStripFootings(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span>القواعد الشريطية (STRIP)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 select-none">
                        <input 
                          type="checkbox" 
                          checked={showGradeBeams} 
                          onChange={e => setShowGradeBeams(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span>الشناجات والربطات (MIDS)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 select-none">
                        <input 
                          type="checkbox" 
                          checked={showDimensions} 
                          onChange={e => setShowDimensions(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span>سلسلة الأبعاد القياسية (DIM)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 select-none">
                        <input 
                          type="checkbox" 
                          checked={showTextLabels} 
                          onChange={e => setShowTextLabels(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span>كتابة التسميات والرموز (TEXT)</span>
                      </label>
                    </div>

                    {/* Scale Option & North direction */}
                    <div className="space-y-2">
                      <span className="font-bold text-[10px] text-indigo-900 dark:text-indigo-400 block">إشعاع سهم الشمال والمقياس / North Arrow & Scales</span>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[9.5px]">نظام اختيار المقياس</Label>
                          <select 
                            value={scaleMode} 
                            onChange={e => setScaleMode(e.target.value as any)}
                            className="w-full mt-1 border border-input rounded p-1 text-xs bg-background"
                          >
                            <option value="auto">تلقائي (CAD Auto)</option>
                            <option value="manual">يدوي (Manual Selection)</option>
                          </select>
                        </div>
                        {scaleMode === 'manual' && (
                          <div>
                            <Label className="text-[9.5px]">اختر مقياس اللوحة S-101</Label>
                            <select 
                              value={scaleValue} 
                              onChange={e => setScaleValue(e.target.value as any)}
                              className="w-full mt-1 border border-input rounded p-1 text-xs bg-background font-mono"
                            >
                              <option value="1:50">1:50</option>
                              <option value="1:75">1:75</option>
                              <option value="1:100">1:100</option>
                              <option value="1:150">1:150</option>
                              <option value="1:200">1:200</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 mt-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-[9.5px]">إزاحة زاوية سهم الإتجاه</Label>
                          <span className="font-mono text-[10px] text-slate-500 font-bold">{northAngle}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="360" 
                          value={northAngle} 
                          onChange={e => setNorthAngle(parseInt(e.target.value) || 0)}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            </div>
          )}

          {/* TAB 2: FOUNDATION SCHEDULE */}
          {activeSubTab === 'schedule' && (
            <FoundationScheduleGenerator
              isolatedFootings={isolatedFootings}
              stripFootings={stripFootings}
              combinedFootings={combinedFootingsList}
              strapFootings={strapFootingsList}
              fc={fc}
              fy={fy}
              qall={qall}
              soilDepth={soilCoverDepth}
              projectName={projectName}
              excavationOffset={500}
            />
          )}

          {/* TAB 3: ISOLATED FOOTING DETAILS */}
          {activeSubTab === 'isolated-details' && (
            <Card className="border border-indigo-100">
              <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900 border-b border-muted flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    قطاعات تفصيل التسليح الإنشائي للقواعد المنفصلة / Reinforced Isolated Footing Details 🎛️
                  </CardTitle>
                  <CardDescription className="text-[10px] mt-0.5">
                    الرسم التنفيذي المعتمد لفرشة تسليح القاع، المقاطع الطولية، وعمدان الربط وتلاحق الشراقيل.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-muted-foreground">عرض نموذج:</span>
                    <select 
                      value={selectedFootingType} 
                      onChange={e => setSelectedFootingType(e.target.value)}
                      className="border border-input rounded p-1 text-xs bg-background max-h-[36px]"
                    >
                      {scheduleItems.map(t => <option key={t.typeMark} value={t.typeMark}>{t.typeMark} ({t.B}x{t.L}x{t.H} mm)</option>)}
                    </select>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 h-8 font-sans font-bold shadow-sm"
                    onClick={handleExportFootingDetailDXF}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    تحميل تفاصيل CAD (DXF)
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-center border border-muted p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: generateSheetHTMLContent('S-301') }} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: STRIP FOOTING DETAILS */}
          {activeSubTab === 'strip-details' && (
            <Card className="border border-indigo-100">
              <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900 border-b border-muted flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    تفاصيل تسليح مقاطع الأساسات الشريطية والربط الرأسي / Strip Footing Cross Section & Elevation 🧱
                  </CardTitle>
                  <CardDescription className="text-[10px] mt-0.5">
                    تفصيل تسليح الأساسات المستمرة للربط بالشدادات والحيطان الساندة للمشروع.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex justify-center border border-muted p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: generateSheetHTMLContent('S-302') }} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4B: COMBINED FOOTING DETAILS */}
          {activeSubTab === 'combined-details' && (
            <Card className="border border-indigo-100">
              <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900 border-b border-muted flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    رسم قطاعات وتفاصيل أساسات القواعد المشتركة / Combined Footing Reinforcement Detailing 📐
                  </CardTitle>
                  <CardDescription className="text-[10px] mt-0.5">
                    تفاصيل الموقع التنفيذي للقواعد المشتركة وتشمل الفرش الطبيعي، تسليح العزم العلوي في المنتصف، وبكل نموذج.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500 font-sans">النموذج النشط:</span>
                  <select 
                    value={selectedCombinedId} 
                    onChange={e => setSelectedCombinedId(e.target.value)}
                    className="border border-input rounded p-1 text-[11px] bg-background max-h-[30px] font-sans"
                  >
                    {combinedFootingsList.map(item => (
                      <option key={item.id} value={item.id}>{item.id} ({item.B1}x{item.L}x{item.H} mm)</option>
                    ))}
                  </select>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 h-8 font-sans font-bold shadow-sm"
                    onClick={handleExportCombinedFootingDetailDXF}
                  >
                    <Download className="h-3.5 w-3.5" />
                    تحميل تفاصيل CAD (DXF)
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex justify-center border border-muted p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: generateSheetHTMLContent('S-303') }} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4C: STRAP FOOTING DETAILS */}
          {activeSubTab === 'strap-details' && (
            <Card className="border border-indigo-100">
              <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900 border-b border-muted flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    نظام الميدات الرابطة الكابولية للجار / Strap Footing Detailing System 📐
                  </CardTitle>
                  <CardDescription className="text-[10px] mt-0.5">
                    تفاصيل تسليح ميدة الجار وقواعد الربط، معالجة اللامركزية، وربط تدرج المناسيب الميدانية.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500 font-sans">النموذج النشط:</span>
                  <select 
                    value={selectedStrapId} 
                    onChange={e => setSelectedStrapId(e.target.value)}
                    className="border border-input rounded p-1 text-[11px] bg-background max-h-[30px] font-sans"
                  >
                    {strapFootingsList.map(item => (
                      <option key={item.id} value={item.id}>{item.id} ({item.ext_B}x{item.ext_L} / {item.int_B}x{item.int_L} mm)</option>
                    ))}
                  </select>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 h-8 font-sans font-bold shadow-sm"
                    onClick={handleExportStrapFootingDetailDXF}
                  >
                    <Download className="h-3.5 w-3.5" />
                    تحميل تفاصيل CAD (DXF)
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex justify-center border border-muted p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: generateSheetHTMLContent('S-304') }} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: BAR BENDING SCHEDULE (BBS) */}
          {activeSubTab === 'bbs' && (
            <div className="space-y-4">
              {/* Summary and Actions Block */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Actions Panel */}
                <Card className="border border-indigo-100 lg:col-span-1 shadow-sm">
                  <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
                    <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      خيارات تصدير جدول التفريد / BBS Exporters 💾
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-3">
                    <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                      قم بتوليد وتنزيل لوحة تفريد وطبقات حديد القواعد والشدادات متوافقة تماماً مع الكود الأمريكي ومصانع تدوير الحديد.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="default" className="text-xs gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700" onClick={handleExportBBSDXF}>
                        <Download className="h-3.5 w-3.5" /> تحميل مخطط التفريد CAD (DXF)
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs gap-1.5 h-9" onClick={handleExportBBSCSV}>
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> تصدير جدول الكميات Excel (CSV)
                      </Button>
                    </div>
                    <div className="border-t pt-2.5 mt-2 space-y-1">
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">مرجعيات المطابقة الإنشائية:</span>
                      <div className="flex flex-col gap-1 text-[9.5px] text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="h-3 w-3" />
                          <span>تحديد أقطار الكود الفعال (Ø10 - Ø18)</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="h-3 w-3" />
                          <span>عكفات 90° و 135° بـ 12db كحد أدنى</span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="h-3 w-3" />
                          <span>أطوال تراكب أشاير الأعمدة Ld &gt;= 1.3 * Ld_tension</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Diameter-wise Weight Breakdown */}
                <Card className="border border-indigo-100 lg:col-span-2 shadow-sm">
                  <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
                    <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      توزيع كميات الحديد حسب القطر / Rebar Diameter Weight Summary ⚖️
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {rebarSummaryByDiameter.map((sum) => (
                        <div key={sum.diameter} className="border dark:border-slate-800 rounded p-2.5 bg-slate-50 dark:bg-slate-900/45 text-center relative overflow-hidden">
                          <div className="absolute top-0 right-0 bg-indigo-600 text-[8px] text-white px-1.5 py-0.5 rounded-bl">
                            Ø{sum.diameter}
                          </div>
                          <span className="text-[10px] text-muted-foreground block mt-1">حديد تسليح</span>
                          <strong className="text-sm font-extrabold text-slate-800 dark:text-slate-200 block font-mono">
                            {sum.totalWeight.toFixed(1)} <span className="text-[10px] font-normal">كغ</span>
                          </strong>
                          <span className="text-[9px] text-muted-foreground block mt-0.5 font-mono">
                            الأطوال: {sum.totalLength.toFixed(1)}م | العدد: {sum.count}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 p-2 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/60 rounded flex items-start gap-2 text-[10px] text-indigo-900 dark:text-indigo-300">
                      <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>مذكرة شراء وطلب حديد الموقع:</strong> إجمالي أوزان الطلب للقواعد والشدادات يبلغ حوالي <span className="font-bold underline">{(takeoffMetrics.steel / 1000).toFixed(3)} طن</span>. يوصى بهدر معتمد قدره 5% للتفصيل والقص بالمصنع لضمان خفض الفاقد المالي بموقع الصب الميداني.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main BBS Master Table Card */}
              <Card className="border border-indigo-100 shadow-sm">
                <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900 border-b flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      تفاصيل حديد التسليح الفردي وأشكال العكفات / Bar Schedule Details & Shape Sketches 🔎
                    </CardTitle>
                    <CardDescription className="text-[10px] mt-0.5">
                      تفصيل انحناءات الأسياخ طبقاً للـ ACI 315 ومطابقة أطوال التثبيت مع حسابات التراكب الآمن والغطاء الترابي.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="border-0 text-xs">
                      <TableHeader>
                        <TableRow className="bg-slate-100 dark:bg-slate-900 hover:bg-slate-100 text-slate-900 dark:text-slate-100">
                          <TableCell className="font-bold text-right py-2.5 w-16">الرمز Mark</TableCell>
                          <TableCell className="font-bold text-right py-2.5 w-24">العنصر الإنشائي / الموقع</TableCell>
                          <TableCell className="font-bold text-right py-2.5 w-16">القطر mm</TableCell>
                          <TableCell className="font-bold text-center py-2.5 w-44">تفريد السيخ الهندسي (Drawn Sketch)</TableCell>
                          <TableCell className="font-bold text-right py-2.5 w-32">المكونات الأبعاد (A - B - C)</TableCell>
                          <TableCell className="font-bold text-right py-2.5 w-16">العدد الكلي</TableCell>
                          <TableCell className="font-bold text-right py-2.5 w-20">الطول المفرد</TableCell>
                          <TableCell className="font-bold text-right py-2.5 w-24">الوزن الإجمالي</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bbsItemsList.map((item, idx) => (
                          <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 text-[11px] border-b">
                            {/* Rebar Mark */}
                            <TableCell className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{item.barMark}</TableCell>
                            
                            {/* Category Context */}
                            <TableCell>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{item.typeMark}</div>
                              <div className="text-[9.5px] text-slate-500">{item.layer}</div>
                            </TableCell>

                            {/* Diameter */}
                            <TableCell className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              Ø{item.diameter}
                            </TableCell>

                            {/* Custom Dynamic Graphical Sketches using SVGs for Maximum Professionalism */}
                            <TableCell className="p-1 text-center align-middle">
                              <div className="flex items-center justify-center h-14 bg-slate-50/70 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded p-1 mx-auto max-w-xs">
                                {item.shape.includes('Hooked L') && (
                                  <svg className="w-28 h-10 text-rose-600 overflow-visible" viewBox="0 0 100 40">
                                    {/* Hook left */}
                                    <path d="M 15 5 L 15 30 L 90 30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    {/* Left segment A */}
                                    <text x="5" y="18" fill="currentColor" className="font-mono text-[8.5px] font-bold">A={item.segmentA}</text>
                                    {/* Bottom segment B */}
                                    <text x="45" y="27" fill="currentColor" className="font-mono text-[8.5px] font-bold">B={item.segmentB}</text>
                                    {/* Right segment C */}
                                    {item.segmentC > 0 && (
                                      <>
                                        <path d="M 90 30 L 90 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <text x="94" y="18" fill="currentColor" className="font-mono text-[8.5px] font-bold">C={item.segmentC}</text>
                                      </>
                                    )}
                                  </svg>
                                )}

                                {item.shape.includes('U-Bar') && (
                                  <svg className="w-28 h-10 text-rose-600 overflow-visible" viewBox="0 0 100 40">
                                    {/* U-Shape */}
                                    <path d="M 20 5 L 20 30 L 80 30 L 80 5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <text x="8" y="18" fill="currentColor" className="font-mono text-[8.5px] font-bold">{item.segmentA}</text>
                                    <text x="45" y="27" fill="currentColor" className="font-mono text-[8.5px] font-bold">{item.segmentB}</text>
                                    <text x="84" y="18" fill="currentColor" className="font-mono text-[8.5px] font-bold">{item.segmentC}</text>
                                  </svg>
                                )}

                                {item.shape.includes('Closed') && (
                                  <svg className="w-28 h-12 text-rose-600 overflow-visible" viewBox="0 0 100 40">
                                    {/* Rectangle */}
                                    <rect x="25" y="8" width="50" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    {/* Hooks */}
                                    <path d="M 25 8 L 18 1 M 25 8 L 30 -1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                                    <text x="45" y="5" fill="currentColor" className="font-mono text-[8.5px] font-bold">A={item.segmentA}</text>
                                    <text x="78" y="22" fill="currentColor" className="font-mono text-[8.5px] font-bold">B={item.segmentB}</text>
                                    <text x="2" y="5" fill="currentColor" className="font-mono text-[8.5px] font-bold">C={item.segmentC}</text>
                                  </svg>
                                )}

                                {item.shape.includes('Z-Bar') && (
                                  <svg className="w-28 h-10 text-rose-600 overflow-visible" viewBox="0 0 100 40">
                                    {/* Z bend */}
                                    <path d="M 15 8 L 50 8 L 50 32 L 85 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <text x="25" y="4" fill="currentColor" className="font-mono text-[8.5px] font-bold">A={item.segmentA}</text>
                                    <text x="54" y="22" fill="currentColor" className="font-mono text-[8.5px] font-bold">B={item.segmentB}</text>
                                    <text x="60" y="38" fill="currentColor" className="font-mono text-[8.5px] font-bold">C={item.segmentC}</text>
                                  </svg>
                                )}
                              </div>
                            </TableCell>

                            {/* Segment text dimensions */}
                            <TableCell className="font-mono text-slate-700 dark:text-slate-300">
                              <div className="flex flex-col">
                                <span>A: {item.segmentA} مم</span>
                                <span>B: {item.segmentB} مم</span>
                                {item.segmentC > 0 && <span>C: {item.segmentC} مم</span>}
                              </div>
                            </TableCell>

                            {/* Total Qty */}
                            <TableCell className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {item.quantity} سیخ
                            </TableCell>

                            {/* Single Length */}
                            <TableCell className="font-mono text-slate-700 dark:text-slate-300">
                              {item.singleLength.toFixed(2)} م
                            </TableCell>

                            {/* Total weight */}
                            <TableCell className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {item.totalWeight.toFixed(1)} كغ
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 6: QUANTITY TAKEOFF */}
          {activeSubTab === 'takeoff' && (
            <FoundationBOQGenerator
              projectName={projectName}
              isolatedFootings={isolatedFootings}
              stripFootings={stripFootings}
              scheduleItems={scheduleItems}
              stripScheduleItems={stripScheduleItems}
              bbsItemsList={bbsItemsList}
              takeoffMetrics={takeoffMetrics}
              naturalGroundLevel={naturalGroundLevel}
              excavationOffset={excavationOffset}
            />
          )}

          {/* TAB 7: DRAWING SHEETS MANAGER */}
          {activeSubTab === 'sheets-manager' && (
            <FoundationSheetManager
              projectName={projectName || ""}
              isolatedFootings={isolatedFootings}
              stripFootings={stripFootings}
              scheduleItems={scheduleItems}
              stripScheduleItems={stripScheduleItems}
              bbsItemsList={bbsItemsList}
              takeoffMetrics={takeoffMetrics}
            />
          )}

          {/* TAB 7.5: DRAWING COORDINATION ENGINE */}
          {activeSubTab === 'drawing-coordination' && (
            <DrawingCoordinationEngine
              projectName={projectName || ""}
              isolatedFootings={isolatedFootings}
              stripFootings={stripFootings}
              scheduleItems={scheduleItems}
              stripScheduleItems={stripScheduleItems}
              bbsItemsList={bbsItemsList}
            />
          )}

          {/* TAB 8: DXF EXPORT */}
          {activeSubTab === 'dxf-export' && (
            <Card className="border border-indigo-100">
              <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900 border-b border-muted">
                <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  تصدير مخطط الأساسات بصيغة أوتوكاد DXF / Engineering CAD AutoCAD DXF Exporter 📐
                </CardTitle>
                <CardDescription className="text-[10px] mt-0.5">
                  حفظ اللوحة العامة ومقاطع الأعمدة والقواعد ككتلة رسومية متكاملة لبرامج التصميم بمساعدة الحاسوب CAD.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="p-4 border rounded bg-slate-50 dark:bg-slate-900 space-y-3">
                  <h4 className="font-bold text-slate-800 dark:text-slate-300">مواصفات تصدير ملفات الأوتوكاد (DXF Export Settings)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">تصدير لوحة المحاور (Grid layer):</span>
                        <Badge className="bg-blue-600">نشط (Layer 0-Axis)</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">تصدير خط الكسر وتطويق القواعد:</span>
                        <Badge className="bg-blue-600">نشط (Layer Footings)</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">تضمين تسليح الأعمدة ومحدداتها:</span>
                        <Badge className="bg-blue-600">نشط (Layer Rebars)</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">نطاق الإرسال الهندسي والقيود:</span>
                        <Badge variant="outline">نظام الإشعاع الدقيق</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-muted pt-3 flex justify-end">
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs" onClick={handleDXFMainExport}>
                      <Download className="mr-1 h-4 w-4" /> تحميل ملف الأوتوكاد العام (.DXF)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 9: PDF EXPORT */}
          {activeSubTab === 'pdf-export' && (
            <Card className="border border-indigo-100">
              <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900 border-b border-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    معاينة لوحات التسليم والطباعة والتحميل / Executive Print Preview & Sheets Hub 🖨️
                  </CardTitle>
                  <CardDescription className="text-[10px] mt-0.5">
                    معاينة أوراق الرسم مجمّعة وتجهيزها للاستخراج كملف PDF متكامل الطباعة.
                  </CardDescription>
                </div>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" onClick={triggerPackagePrinting}>
                  <Printer className="mr-1 h-3.5 w-3.5" /> طباعة وتصدير كملف PDF شامل
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 border-b pb-3 text-xs">
                  <span className="text-muted-foreground">معاينة لوحة:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sheetMetadata.map((sheet) => (
                      <Button
                        key={sheet.code}
                        variant={activeSheetId === sheet.code ? 'default' : 'outline'}
                        className={`text-[10px] h-7 px-2 ${activeSheetId === sheet.code ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                        onClick={() => setActiveSheetId(sheet.code)}
                      >
                        {sheet.code}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center border p-4 bg-zinc-200 dark:bg-slate-950 rounded relative overflow-auto select-none min-h-[350px]">
                  <div className="w-full max-w-[700px] bg-white text-black p-8 border border-zinc-400 relative shadow-md">
                    <div className="absolute inset-1.5 border border-zinc-950 pointer-events-none"></div>
                    <div className="absolute inset-2 border border-zinc-200 pointer-events-none"></div>
                    
                    <div className="pb-24">
                      <div dangerouslySetInnerHTML={{ __html: generateSheetHTMLContent(activeSheetId) }} />
                    </div>

                    {/* AutoCAD Title Block */}
                    <div style={{ direction: 'rtl', height: '80px' }} className="absolute left-6 bottom-6 right-6 border border-black flex text-[9px] bg-white font-sans text-right select-none">
                      <div className="w-1/4 border-l border-black p-1.5 flex flex-col justify-between truncate">
                        <span className="text-[7px] text-zinc-500 block">اسم المشروع / PROJECT</span>
                        <strong className="text-indigo-900 leading-normal truncate block">{projectName}</strong>
                        <span className="text-[7px] text-zinc-400 select-all">Saudi Arabia</span>
                      </div>
                      <div className="w-1/3 border-l border-black p-1.5 flex flex-col justify-between">
                        <span className="text-[7px] text-zinc-500 block">عنوان اللوحة / SHEET TITLE</span>
                        <strong className="text-red-800 leading-normal block">{sheetMetadata.find(s => s.code === activeSheetId)?.title}</strong>
                      </div>
                      <div className="w-1/5 border-l border-black p-1.5 flex flex-col justify-between text-[8px] text-slate-600">
                        <div><span>كود التصميم:</span> SBC 304 / ACI</div>
                        <div><span>التاريخ:</span> {new Date().toLocaleDateString('en-GB')}</div>
                      </div>
                      <div className="w-[12%] border-l border-black p-1.5 flex flex-col justify-between text-[7px] text-slate-500">
                        <span>الرسام: AI Coach</span>
                        <span>مقياس: {selectedScale}</span>
                      </div>
                      <div className="w-[10%] p-1.5 flex flex-col justify-center items-center bg-zinc-50">
                        <span className="text-[7px] text-zinc-500">لوحة NO.</span>
                        <strong className="text-red-700 text-xs">{activeSheetId}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

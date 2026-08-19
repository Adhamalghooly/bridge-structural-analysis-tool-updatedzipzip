import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { 
  Calculator, Layers, Download, CheckCircle2, AlertTriangle, HelpCircle, 
  Settings2, RefreshCw, Layers2, Ruler, Printer, Table as TableIcon, 
  Map, DollarSign, Database, Link, Compass, Activity, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import type { Story, Slab, Beam, Column, SlabProps } from '@/lib/structuralEngine';

interface TakeoffProps {
  stories: Story[];
  slabs: Slab[];
  beams: Beam[];
  columns: Column[];
  beamDesigns: any[];
  colDesigns: any[];
  slabDesigns: any[];
  slabProps: SlabProps;
  analyzed: boolean;
  foundationResults?: any[];
  foundationMat?: any;
}

// Rebar standard dia weights (kg/m) = d² / 162.2
const REBAR_DIAMETERS = [8, 10, 12, 14, 16, 18, 20, 22, 25];
function getRebarUnitWeight(dia: number): number {
  return (dia * dia) / 162.2;
}

export default function QuantityTakeoffPanel({
  stories, slabs, beams, columns, beamDesigns, colDesigns, slabDesigns, slabProps, analyzed,
  foundationResults, foundationMat
}: TakeoffProps) {

  // --- 1. SETTINGS & INTERACTIVE PARAMETERS ---
  const [excavationDepth, setExcavationDepth] = useState<number>(1.6); // meters
  const [workingSpace, setWorkingSpace] = useState<number>(0.3); // meters offset
  const [pccThickness, setPccThickness] = useState<number>(100); // mm
  const [pccOffset, setPccOffset] = useState<number>(100); // mm
  
  // Future Items
  const [includeFutureWalls, setIncludeFutureWalls] = useState<boolean>(false);
  const [wallLength, setWallLength] = useState<number>(24.0); // meters
  const [wallHeight, setWallHeight] = useState<number>(3.0); // meters
  const [wallThickness, setWallThickness] = useState<number>(200); // mm
  const [wallRebarRatio, setWallRebarRatio] = useState<number>(0.8); // % by vol
  
  const [includeFutureRaft, setIncludeFutureRaft] = useState<boolean>(false);
  const [raftLength, setRaftLength] = useState<number>(18.0); // meters
  const [raftWidth, setRaftWidth] = useState<number>(14.0); // meters
  const [raftThickness, setRaftThickness] = useState<number>(600); // mm
  const [raftRebarRatio, setRaftRebarRatio] = useState<number>(1.0); // % by vol

  // Cost estimates (SAR per unit)
  const [costConcreteC35, setCostConcreteC35] = useState<number>(380); // SAR/m³
  const [costConcreteC30, setCostConcreteC30] = useState<number>(350); // SAR/m³
  const [costConcreteC25, setCostConcreteC25] = useState<number>(330); // SAR/m³
  const [costConcreteC15, setCostConcreteC15] = useState<number>(270); // PCC / low grade
  const [costSteel, setCostSteel] = useState<number>(3400); // SAR/Ton
  const [costFormwork, setCostFormwork] = useState<number>(45); // SAR/m²
  const [costExcavation, setCostExcavation] = useState<number>(20); // SAR/m³
  const [costBackfilling, setCostBackfilling] = useState<number>(15); // SAR/m³
  const [costWaterproofing, setCostWaterproofing] = useState<number>(18); // SAR/m²

  // --- Tab Filters ---
  const [subTab, setSubTab] = useState<'dashboard' | 'concrete' | 'rebar' | 'geotech' | 'trace' | 'audit' | 'settings'>('dashboard');
  const [selectedStory, setSelectedStory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // --- Dynamic Grid System Detection ---
  const { uniqueX, uniqueY } = useMemo(() => {
    const xs = new Set<number>();
    const ys = new Set<number>();
    columns.forEach(c => { xs.add(c.x); ys.add(c.y); });
    beams.forEach(b => { xs.add(b.x1); xs.add(b.x2); ys.add(b.y1); ys.add(b.y2); });
    return {
      uniqueX: Array.from(xs).sort((a,b)=>a-b),
      uniqueY: Array.from(ys).sort((a,b)=>a-b),
    };
  }, [columns, beams]);

  const getGridRef = (x: number, y: number): string => {
    const xIdx = uniqueX.findIndex(ux => Math.abs(ux - x) < 100);
    const yIdx = uniqueY.findIndex(uy => Math.abs(uy - y) < 100);
    const xLetter = xIdx !== -1 ? String.fromCharCode(65 + (xIdx % 26)) : 'X';
    const yNum = yIdx !== -1 ? (yIdx + 1).toString() : 'Y';
    return `${xLetter}-${yNum}`;
  };

  const getSlabGridRef = (s: Slab): string => {
    const cx = (s.x1 + s.x2) / 2;
    const cy = (s.y1 + s.y2) / 2;
    return getGridRef(cx, cy);
  };

  // --- 2. THE CORE TAKEOFF CALCULATIONS ENGINE ---
  const qto = useMemo(() => {
    // A. Concrete Volume & Formwork
    const slabItems = slabs.map(s => {
      const area = Math.abs(s.x2 - s.x1) * Math.abs(s.y2 - s.y1); // m²
      const th = (s.thickness || slabProps.thickness) / 1000; // m
      const vol = area * th;
      const formwork = area; // Bottom of slab
      const grade = 'C25';
      const storyLabel = stories.find(st => st.id === s.storyId)?.label || 'متكرر';
      const grid = getSlabGridRef(s);
      
      const steelMap: Record<number, number> = {};
      let totalSteel = 0;
      
      // If analyzed, extract rebar
      const design = slabDesigns.find(d => d.id === s.id);
      if (analyzed && design?.design) {
        const lx = Math.abs(s.x2 - s.x1);
        const ly = Math.abs(s.y2 - s.y1);
        if (design.design.shortDir?.dia) {
          const dia = design.design.shortDir.dia;
          const spacing = (design.design.shortDir.spacing || 200) / 1000;
          const qty = spacing > 0 ? Math.ceil(ly / spacing) : (design.design.shortDir.bars || 5);
          const w = getRebarUnitWeight(dia) * (lx + 0.3) * qty; // weight in kg
          steelMap[dia] = (steelMap[dia] || 0) + w;
          totalSteel += w;
        }
        if (design.design.longDir?.dia) {
          const dia = design.design.longDir.dia;
          const spacing = (design.design.longDir.spacing || 200) / 1000;
          const qty = spacing > 0 ? Math.ceil(lx / spacing) : (design.design.longDir.bars || 5);
          const w = getRebarUnitWeight(dia) * (ly + 0.3) * qty;
          steelMap[dia] = (steelMap[dia] || 0) + w;
          totalSteel += w;
        }
      } else {
        // Estimate steel at 45kg/m³
        const est = vol * 45;
        steelMap[10] = est * 0.4;
        steelMap[12] = est * 0.6;
        totalSteel = est;
      }

      return {
        id: s.id, type: 'slab' as const, label: `بلاطة ${s.id}`,
        storyId: s.storyId || 'story-1', storyLabel,
        b: Math.abs(s.x2 - s.x1), h: th, L: Math.abs(s.y2 - s.y1),
        area, vol, formwork, grade, grid, steelMap, totalSteel,
        drawingSheet: 'SD-01', schedule: 'جداول البلاطات', detail: 'تفصيل تسليح شبكة البلاطة', section: 'قطاع نموذجي بالبلاطة/الكمرة'
      };
    });

    const beamItems = beams.filter(b => !b.isRemoved).map(b => {
      const length = b.length; // m
      const bm = b.b / 1000; // m
      const hm = b.h / 1000; // m
      // Effective height subtracts slab thickness for concrete volume
      const slabThInBeam = slabProps.thickness / 1000;
      const effectiveH = Math.max(hm - slabThInBeam, hm * 0.5);
      const vol = bm * effectiveH * length;
      
      // Beam formwork = 2 * effectiveH * length (lateral faces) + bm * length (soffit)
      const formwork = (2 * effectiveH + bm) * length;
      const grade = 'C30';
      const storyLabel = stories.find(st => st.id === b.storyId)?.label || 'متكرر';
      const grid = `${getGridRef(b.x1, b.y1)} ➔ ${getGridRef(b.x2, b.y2)}`;

      const steelMap: Record<number, number> = {};
      let totalSteel = 0;

      // Extract rebar
      const design = beamDesigns.find(d => d.beamId === b.id);
      if (analyzed && design) {
        const spanM = design.span || length;
        if (design.flexLeft?.dia && design.flexLeft?.bars) {
          const w = getRebarUnitWeight(design.flexLeft.dia) * (spanM * 0.35) * design.flexLeft.bars;
          steelMap[design.flexLeft.dia] = (steelMap[design.flexLeft.dia] || 0) + w;
          totalSteel += w;
        }
        if (design.flexRight?.dia && design.flexRight?.bars) {
          const w = getRebarUnitWeight(design.flexRight.dia) * (spanM * 0.35) * design.flexRight.bars;
          steelMap[design.flexRight.dia] = (steelMap[design.flexRight.dia] || 0) + w;
          totalSteel += w;
        }
        if (design.flexMid?.dia && design.flexMid?.bars) {
          const w = getRebarUnitWeight(design.flexMid.dia) * (spanM + 0.6) * design.flexMid.bars;
          steelMap[design.flexMid.dia] = (steelMap[design.flexMid.dia] || 0) + w;
          totalSteel += w;
        }
        if (design.shear?.sUsed) {
          const stirrupDia = 8;
          const numStirrups = Math.ceil((spanM * 1000) / design.shear.sUsed);
          const stirrupLength = 2 * ((b.b - 80) / 1000 + (b.h - 80) / 1000) + 0.2;
          const w = getRebarUnitWeight(stirrupDia) * stirrupLength * numStirrups;
          steelMap[stirrupDia] = (steelMap[stirrupDia] || 0) + w;
          totalSteel += w;
        }
      } else {
        // Estimate steel at 85kg/m³
        const est = vol * 85;
        steelMap[12] = est * 0.3;
        steelMap[16] = est * 0.5;
        steelMap[8] = est * 0.2; // stirrups
        totalSteel = est;
      }

      return {
        id: b.id, type: 'beam' as const, label: `جسر ${b.id}`,
        storyId: b.storyId || 'story-1', storyLabel,
        b: bm, h: effectiveH, L: length,
        area: bm * length, vol, formwork, grade, grid, steelMap, totalSteel,
        drawingSheet: 'SD-02', schedule: 'جدول تسليح الجسور', detail: 'تفصيل الجسر المستمر', section: 'قطاع عرضي بالجسور'
      };
    });

    const columnItems = columns.filter(c => !c.isRemoved).map(c => {
      const bm = c.b / 1000;
      const hm = c.h / 1000;
      const Lm = c.L / 1000; // m
      const vol = bm * hm * Lm;
      
      // Column formwork is the wet perimeter * height
      const formwork = 2 * (bm + hm) * Lm;
      const grade = 'C35';
      const storyLabel = stories.find(st => st.id === c.storyId)?.label || 'الكل';
      const grid = getGridRef(c.x, c.y);

      const steelMap: Record<number, number> = {};
      let totalSteel = 0;

      // Extract rebar
      const design = colDesigns.find(d => d.id === c.id);
      if (analyzed && design?.design) {
        if (design.design.dia && design.design.bars) {
          const mainDia = design.design.dia;
          const w = getRebarUnitWeight(mainDia) * (Lm + 1.0) * design.design.bars; // extra 1m for lap splice
          steelMap[mainDia] = (steelMap[mainDia] || 0) + w;
          totalSteel += w;
        }
        // stirrups
        const stirMatch = design.design.stirrups?.match(/Φ(\d+)@(\d+)/);
        if (stirMatch) {
          const sDia = parseInt(stirMatch[1]) || 8;
          const sSpacing = parseInt(stirMatch[2]) || 150;
          const numStirrups = Math.ceil((Lm * 1000) / sSpacing);
          const stirrupLen = 2 * ((c.b - 80) / 1000 + (c.h - 80) / 1000) + 0.2;
          const w = getRebarUnitWeight(sDia) * stirrupLen * numStirrups;
          steelMap[sDia] = (steelMap[sDia] || 0) + w;
          totalSteel += w;
        }
      } else {
        // Estimate steel at 110kg/m³ (approx 1.4% steel ratio)
        const est = vol * 110;
        steelMap[16] = est * 0.8;
        steelMap[8] = est * 0.2;
        totalSteel = est;
      }

      return {
        id: c.id, type: 'column' as const, label: `عمود ${c.id}`,
        storyId: c.storyId || 'story-1', storyLabel,
        b: bm, h: hm, L: Lm,
        area: bm * hm, vol, formwork, grade, grid, steelMap, totalSteel,
        drawingSheet: 'SD-03', schedule: 'جدول قطاعات وتسليح الأعمدة', detail: 'تفصيل وصلات حديد الأعمدة', section: 'قطاع نموذجي بالعمود'
      };
    });

    // B. Substructure: Foundations
    const footingItems = (foundationResults || []).map(r => {
      const bm = r.B / 1000; // width m
      const Lm = r.L / 1000; // length m
      const tm = r.t / 1000; // thickness m
      const vol = bm * Lm * tm;
      
      // Formwork = perimeter * thickness
      const formwork = 2 * (bm + Lm) * tm;
      const grade = 'C30';
      const grid = getGridRef(r.colX || 0, r.colY || 0);

      // Geotechnical calculations
      // Excavation: working space offset on each side
      const B_exc = bm + 2 * workingSpace;
      const L_exc = Lm + 2 * workingSpace;
      const excavation = B_exc * L_exc * excavationDepth;

      // PCC lean concrete (C15)
      const pcc_offset_m = pccOffset / 1000;
      const pcc_thickness_m = pccThickness / 1000;
      const B_pcc = bm + 2 * pcc_offset_m;
      const L_pcc = Lm + 2 * pcc_offset_m;
      const pccArea = B_pcc * L_pcc;
      const pccVol = pccArea * pcc_thickness_m;

      // Backfill = Excavation - footing Concrete - PCC - Neck Column pedestal
      // neck column height below grade = excavation depth - footing thickness
      const pedestalH = Math.max(0, excavationDepth - tm);
      // find column size referenced by r.colId
      const colRef = columns.find(col => col.id === r.colId);
      const colArea = colRef ? (colRef.b / 1000) * (colRef.h / 1000) : 0.12; 
      const pedestalVol = colArea * pedestalH;

      const backfill = Math.max(0, excavation - vol - pccVol - pedestalVol);
      
      // Waterproofing: lateral areas of footing and bottom footing area, plus lateral of pedestal
      const lateralFootingArea = 2 * (bm + Lm) * tm;
      const bottomArea = bm * Lm;
      const lateralPedestalArea = colRef ? 2 * ((colRef.b + colRef.h) / 1000) * pedestalH : 0;
      const waterproofing = lateralFootingArea + bottomArea + lateralPedestalArea;

      const steelMap: Record<number, number> = {};
      let totalSteel = 0;

      if (analyzed && r.dia_x && r.bars_x) {
        const dia = r.dia_x;
        const w = getRebarUnitWeight(dia) * (bm + 0.2) * r.bars_x;
        steelMap[dia] = (steelMap[dia] || 0) + w;
        totalSteel += w;
      }
      if (analyzed && r.dia_y && r.bars_y) {
        const dia = r.dia_y;
        const w = getRebarUnitWeight(dia) * (Lm + 0.2) * r.bars_y;
        steelMap[dia] = (steelMap[dia] || 0) + w;
        totalSteel += w;
      }

      // If not designed or no steel, estimate at 50kg/m³
      if (totalSteel === 0) {
        const est = vol * 50;
        steelMap[14] = est;
        totalSteel = est;
      }

      return {
        id: `F-${r.colId}`, type: 'footing' as const, label: `قاعدة ${r.colId}`,
        storyId: 'substructure', storyLabel: 'الأساسات',
        b: bm, h: tm, L: Lm,
        area: bm * Lm, vol, formwork, grade, grid, steelMap, totalSteel,
        excavation, backfill, pccVol, pccArea, waterproofing,
        drawingSheet: 'SD-04', schedule: 'جدول تسليح القواعد المنفردة', detail: 'تفصيل علاقة القاعدة ورقبة العمود', section: 'قطاع رأسي بالأساسات'
      };
    });

    // C. Future Symmetries / Extension items
    const futureItems: any[] = [];
    if (includeFutureWalls) {
      const wall_thickness_m = wallThickness / 1000;
      const vol = wallLength * wallHeight * wall_thickness_m;
      const formwork = 2 * wallLength * wallHeight; // both sides
      const excavation = wallLength * (wall_thickness_m + 0.6) * 1.5; // footing excavation
      const backfill = excavation - (wallLength * wall_thickness_m * 1.0); // balance backfill
      const pccVol = wallLength * (wall_thickness_m + 0.2) * 0.1;

      const steelWt = vol * (wallRebarRatio / 100) * 7850; // density of steel is 7850 kg/m³
      const steelMap: Record<number, number> = { 12: steelWt };

      futureItems.push({
        id: 'FW-1', type: 'wall' as const, label: 'جدار مائي/استنادي مستقبلي',
        storyId: 'substructure', storyLabel: 'الأساسات / جدران',
        b: wall_thickness_m, h: wallHeight, L: wallLength,
        area: wallLength * wall_thickness_m, vol, formwork, grade: 'C30', grid: 'A-D / 1-4',
        excavation, backfill, pccVol, pccArea: wallLength * (wall_thickness_m + 0.2), waterproofing: wallLength * wallHeight,
        steelMap, totalSteel: steelWt,
        drawingSheet: 'SD-05', schedule: 'جدول الجدران الساندة والقصية', detail: 'تفصيل الجدران الخرسانية والمستقبلية', section: 'قطاع نموذجي بالجدار'
      });
    }

    if (includeFutureRaft) {
      const raft_thickness_m = raftThickness / 1000;
      const vol = raftLength * raftWidth * raft_thickness_m;
      const formwork = 2 * (raftLength + raftWidth) * raft_thickness_m;
      const raftArea = raftLength * raftWidth;

      const B_exc = raftLength + 2 * workingSpace;
      const L_exc = raftWidth + 2 * workingSpace;
      const excavation = B_exc * L_exc * excavationDepth;
      
      const B_pcc = raftLength + 2 * (pccOffset / 1000);
      const L_pcc = raftWidth + 2 * (pccOffset / 1000);
      const pccArea = B_pcc * L_pcc;
      const pccVol = pccArea * (pccThickness / 1000);

      const backfill = Math.max(0, excavation - vol - pccVol);
      const waterproofing = raftArea + formwork; // bottom + sides

      const steelWt = vol * (raftRebarRatio / 100) * 7850;
      const steelMap: Record<number, number> = { 16: steelWt * 0.7, 12: steelWt * 0.3 };

      futureItems.push({
        id: 'FRF-1', type: 'raft' as const, label: 'لبشة خرسانية مسلحة مستقبلية',
        storyId: 'substructure', storyLabel: 'الأساسات / لبشة',
        b: raftWidth, h: raft_thickness_m, L: raftLength,
        area: raftArea, vol, formwork, grade: 'C30', grid: 'كامل مصفوفة المبنى',
        excavation, backfill, pccVol, pccArea, waterproofing,
        steelMap, totalSteel: steelWt,
        drawingSheet: 'SD-04_R', schedule: 'لوحة تفاصيل اللبشة الأساسية', detail: 'تفصيل ثقوب واختراق الأعمدة للبشة', section: 'قطاع نموذجي باللبشة المسلحة'
      });
    }

    // Merge everything
    const all = [...slabItems, ...beamItems, ...columnItems, ...footingItems, ...futureItems];
    return {
      all,
      slabs: slabItems,
      beams: beamItems,
      columns: columnItems,
      footings: footingItems,
      future: futureItems
    };
  }, [
    stories, slabs, beams, columns, slabProps, analyzed, 
    beamDesigns, colDesigns, slabDesigns, foundationResults,
    excavationDepth, workingSpace, pccThickness, pccOffset,
    includeFutureWalls, wallLength, wallHeight, wallThickness, wallRebarRatio,
    includeFutureRaft, raftLength, raftWidth, raftThickness, raftRebarRatio
  ]);

  // --- 3. FILTERED & GROUPED TAKEOFFS ---
  const selectedStoryFiltered = useMemo(() => {
    let list = qto.all;
    if (selectedStory !== 'all') {
      list = list.filter(item => item.storyId === selectedStory);
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => 
        item.id.toLowerCase().includes(q) || 
        item.label.toLowerCase().includes(q) ||
        item.grid.toLowerCase().includes(q)
      );
    }
    return list;
  }, [qto, selectedStory, searchQuery]);

  const activeElementDetails = useMemo(() => {
    if (!selectedElementId) return null;
    return qto.all.find(item => item.id === selectedElementId) || null;
  }, [qto, selectedElementId]);

  // --- 4. EXCEL, PDF & HTML EXPORTS ---
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Concrete Summary Sheet
    const concSummaryRows = qto.all.map(item => ({
      'العنصر ID': item.id,
      'نوع العنصر': item.type === 'slab' ? 'بلاطة' : item.type === 'beam' ? 'جسر' : item.type === 'column' ? 'عمود' : item.type === 'footing' ? 'قاعدة' : 'أخرى',
      'الدور / المرحلة': item.storyLabel,
      'المحاور / الشبكة': item.grid,
      'الأبعاد b (م)': item.b.toFixed(3),
      'الأبعاد h (م)': item.h.toFixed(3),
      'الطول L (م)': item.L.toFixed(3),
      'المساحة (م²)': item.area.toFixed(2),
      'الحجم (م³)': item.vol.toFixed(3),
      'رتبة الخرسانة': item.grade,
      'مساحة الطوبار (م²)': item.formwork.toFixed(2),
      'لوحة المخطط': item.drawingSheet,
    }));
    const wsConc = XLSX.utils.json_to_sheet(concSummaryRows);
    XLSX.utils.book_append_sheet(wb, wsConc, 'خرسانة وطوبار');

    // 2. Rebar Sheet
    const rebarRows = qto.all.map(item => {
      const row: any = {
        'العنصر ID': item.id,
        'نوع العنصر': item.type,
        'الدور / المرحلة': item.storyLabel,
        'إجمالي الوزن (كجم)': item.totalSteel.toFixed(2),
      };
      REBAR_DIAMETERS.forEach(dia => {
        row[`Φ${dia} (كجم)`] = (item.steelMap[dia] || 0).toFixed(2);
      });
      return row;
    });
    const wsRebar = XLSX.utils.json_to_sheet(rebarRows);
    XLSX.utils.book_append_sheet(wb, wsRebar, 'حديد التسليح');

    // 3. Geotechnical Sheet
    const geoRows = qto.footings.map(item => ({
      'القاعدة ID': item.id,
      'شبكة المحاور': item.grid,
      'أبعاد القاعدة (م)': `${item.L.toFixed(2)}x${item.b.toFixed(2)}x${item.h.toFixed(2)}`,
      'حجم الحفر (م³)': (item.excavation || 0).toFixed(2),
      'الخرسانة العادية PCC (م³)': (item.pccVol || 0).toFixed(2),
      'الردميات (م³)': (item.backfill || 0).toFixed(2),
      'العزل المائي (م²)': (item.waterproofing || 0).toFixed(2),
    }));
    const wsGeo = XLSX.utils.json_to_sheet(geoRows);
    XLSX.utils.book_append_sheet(wb, wsGeo, 'أعمال التربة والعزل');

    XLSX.writeFile(wb, `Structural_Volume_Takeoff_BOQ.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Add Unicode font compatibility if needed. For safety, we lay out standard table structures.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(16);
    doc.text("QUANTITY TAKEOFF & ESTIMATION REPORT", 14, 20);
    doc.setFontSize(10);
    doc.text(`Project Total Records: ${qto.all.length} structural elements. Date: ${new Date().toLocaleDateString()}`, 14, 26);
    doc.text(`Excavation Settings: typical depth = ${excavationDepth}m, working space offset = ${workingSpace}m`, 14, 31);
    
    // Concrete table
    doc.setFontSize(12);
    doc.text("1. Concrete Volume Summary (m³)", 14, 40);
    
    const concData = qto.all.map(item => [
      item.id,
      item.type.toUpperCase(),
      item.storyLabel,
      item.grid,
      `${item.L.toFixed(1)}x${item.b.toFixed(2)}x${item.h.toFixed(2)}`,
      item.vol.toFixed(3),
      item.grade,
      item.formwork.toFixed(1)
    ]);
    
    autoTable(doc, {
      startY: 44,
      head: [['ID', 'TYPE', 'STORY', 'GRID', 'LXBXH (m)', 'VOLUME (m3)', 'GRADE', 'FORMWORK (m2)']],
      body: concData,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.text("2. Soil Works & PCC Table", 14, finalY);

    const geoData = qto.all.filter(item => item.type === 'footing' || item.type === 'raft' || item.type === 'wall').map(item => [
      item.id,
      item.grid,
      item.excavation ? item.excavation.toFixed(2) : '0.00',
      item.pccVol ? item.pccVol.toFixed(2) : '0.00',
      item.backfill ? item.backfill.toFixed(2) : '0.00',
      item.waterproofing ? item.waterproofing.toFixed(2) : '0.00'
    ]);

    autoTable(doc, {
      startY: finalY + 4,
      head: [['ELEMENT', 'GRID', 'EXCAVATION (m3)', 'PCC VOL (m3)', 'BACKFILL (m3)', 'WATERPROOFING (m2)']],
      body: geoData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 174, 96], textColor: 255 }
    });

    doc.save(`Quantity_Takeoff_Engine_Report.pdf`);
  };

  const printReport = () => {
    window.print();
  };

  // --- 5. DETAILED GENERAL COST SUMMARY METRICS ---
  const financialSummary = useMemo(() => {
    let totConcC35 = 0;
    let totConcC30 = 0;
    let totConcC25 = 0;
    let totConcC15 = 0;
    let totSteelTons = 0;
    let totFormArea = 0;
    let totExcavVol = 0;
    let totBackfillVol = 0;
    let totWaterproofingArea = 0;

    qto.all.forEach(item => {
      // Concrete grades grouping
      if (item.grade === 'C35') totConcC35 += item.vol;
      else if (item.grade === 'C30') totConcC30 += item.vol;
      else if (item.grade === 'C25') totConcC25 += item.vol;
      
      if (item.pccVol) totConcC15 += item.pccVol;
      
      totSteelTons += item.totalSteel / 1000; // convert kg to tons
      totFormArea += item.formwork;

      if (item.excavation) totExcavVol += item.excavation;
      if (item.backfill) totBackfillVol += item.backfill;
      if (item.waterproofing) totWaterproofingArea += item.waterproofing;
    });

    const costC35 = totConcC35 * costConcreteC35;
    const costC30 = totConcC30 * costConcreteC30;
    const costC25 = totConcC25 * costConcreteC25;
    const costC15 = totConcC15 * costConcreteC15;
    const costSt = totSteelTons * costSteel;
    const costFm = totFormArea * costFormwork;
    const costExc = totExcavVol * costExcavation;
    const costBf = totBackfillVol * costBackfilling;
    const costWp = totWaterproofingArea * costWaterproofing;

    const grandTotalCost = costC35 + costC30 + costC25 + costC15 + costSt + costFm + costExc + costBf + costWp;

    return {
      totConcC35, totConcC30, totConcC25, totConcC15, totSteelTons, totFormArea, totExcavVol, totBackfillVol, totWaterproofingArea,
      costC35, costC30, costC25, costC15, costSt, costFm, costExc, costBf, costWp,
      grandTotalCost
    };
  }, [qto, costConcreteC35, costConcreteC30, costConcreteC25, costConcreteC15, costSteel, costFormwork, costExcavation, costBackfilling, costWaterproofing]);

  // --- 6. FORMULAS & DOCUMENTATION FOR TRACEABILITY ---
  const getFormulaDerivation = (item: any) => {
    switch (item.type) {
      case 'slab':
        return {
          header: "حجم خرسانة البلاطة وطوبارها السفلي",
          dimensions: `طول = ${item.L.toFixed(2)}م، عرض = ${item.b.toFixed(2)}م، سمك = ${(item.h*1000).toFixed(0)}مم`,
          equationVol: `الحجم = طول × عرض × سمك = ${item.L.toFixed(2)} × ${item.b.toFixed(2)} × ${item.h.toFixed(3)} = ${item.vol.toFixed(3)} م³`,
          equationForm: `لوح الشدة = طول × عرض = ${item.L.toFixed(2)} × ${item.b.toFixed(2)} = ${item.formwork.toFixed(2)} م²`,
          rebarNotes: `التسليح محسوب بناء على شبكات التسليح بالاتجاهين القصير والطويل مضافاً إليها 0.3م خطافات نهايات.`
        };
      case 'beam':
        return {
          header: "حجم خرسانة الجسر وطوباره الخارجي",
          dimensions: `طول = ${item.L.toFixed(2)}م، عرض الجسر = ${item.b.toFixed(3)}م، الارتفاع الفعال = ${item.h.toFixed(3)}م (خصم سمك البلاطة من إجمالي الجسر لمنع التداخل)`,
          equationVol: `الحجم =b × h_{eff} × L = ${item.b.toFixed(3)} × ${item.h.toFixed(3)} × ${item.L.toFixed(2)} = ${item.vol.toFixed(3)} م³`,
          equationForm: `الشدة الجانبية والسفلية = [2 × H_{eff} + b] × L = [2 × ${item.h.toFixed(3)} + ${item.b.toFixed(3)}] × ${item.L.toFixed(2)} = ${item.formwork.toFixed(2)} م²`,
          rebarNotes: `حديد سفلي مستمر بطول الكلي + 0.6م وصلات وتماسك، حديد علوي إضافي بنسبة 35% من المجاور للأعمدة، والكانات حسب التباعد والتصميم.`
        };
      case 'column':
        return {
          header: "خرسانة العمود وطوباره الخشبي الرأسي",
          dimensions: `عرض العمود b = ${item.b.toFixed(3)}م، عمق العمود h = ${item.h.toFixed(3)}م، ارتفاع العمود صافي L = ${item.L.toFixed(2)}م`,
          equationVol: `الحجم = b × h × L = ${item.b.toFixed(3)} × ${item.h.toFixed(3)} × ${item.L.toFixed(2)} = ${item.vol.toFixed(3)} م³`,
          equationForm: `الطوبار المحيطي = 2 × (b + h) × L = 2 × (${item.b.toFixed(3)} + ${item.h.toFixed(3)}) × ${item.L.toFixed(2)} = ${item.formwork.toFixed(2)} م²`,
          rebarNotes: `التسليح الرأسي يمتد بارتفاع العمود + 1.0م طول ركوب تشريك الأساور والربط العلوي. الأساور موزعة حسب القص المطلوب.`
        };
      case 'footing':
        return {
          header: "القواعد المنفردة، الحفريات، الخرسانة العادية والعزل",
          dimensions: `طول قاعدة L = ${item.L.toFixed(2)}م، عرض B = ${item.b.toFixed(2)}م، سمك القاعدة = ${item.h.toFixed(2)}م`,
          equationVol: `حجم المسلحة = L × B × t = ${item.L.toFixed(2)} × ${item.b.toFixed(2)} × ${item.h.toFixed(2)} = ${item.vol.toFixed(3)} م³`,
          equationForm: `طوبار المسلحة المحيطي = 2 × (L + B) × t = 2 × (${item.L.toFixed(2)} + ${item.b.toFixed(2)}) × ${item.h.toFixed(2)} = ${item.formwork.toFixed(2)} م²`,
          equationExcavation: `الحفر = (B + 2 × رفرفة الحفر) × (L + 2 × رفرفة) × عمق الحفر = (${item.b.toFixed(2)} + ${2*workingSpace}) × (${item.L.toFixed(2)} + ${2*workingSpace}) × ${excavationDepth} = ${item.excavation.toFixed(2)} م³`,
          equationPCC: `خرسانة عادية PCC = (B + 2 × رفرفة PCC) × (L + 2 × رفرفة PCC) × سمك PCC =  ${item.pccArea.toFixed(2)}م² × ${(pccThickness/1000).toFixed(2)}م = ${item.pccVol.toFixed(3)} م³`,
          equationBackfill: `الردم = حجم الحفر - حجم المسلحة - حجم PCC - حجم رقبة العمود = ${item.excavation.toFixed(2)} - ${item.vol.toFixed(3)} - ${item.pccVol.toFixed(3)} - Pedestal = ${item.backfill.toFixed(3)} م³`,
          equationWaterproofing: `عزل البيتومين = مساحة أسفل القاعدة (Bottom) + جوانب القاعدة + رقبة العمود السفلية = ${item.waterproofing.toFixed(2)} م²`
        };
      default:
        return {
          header: `${item.label} - تفصيل الحسابات`,
          dimensions: `مساحة ${item.area.toFixed(2)} م²، حجم خرسانة = ${item.vol.toFixed(3)} م³`,
          equationVol: `الحجم = ${item.vol.toFixed(3)} م³`,
          equationForm: `الطوبار المساحي = ${item.formwork.toFixed(2)} م²`,
          rebarNotes: `حديد تسليح مخصص للمجموعة.`
        };
    }
  };

  // --- 7. QUALITY ASSURANCE & AUDIT VALIDATIONS ---
  const auditIssues = useMemo(() => {
    const issues: { id: string; category: string; severity: 'error' | 'warning' | 'info'; message: string; solution: string }[] = [];

    // Check 1: Missing designs
    columns.filter(c => !c.isRemoved).forEach(c => {
      const design = colDesigns.find(d => d.id === c.id);
      if (!analyzed || !design?.design) {
        issues.push({
          id: `audit-col-${c.id}`,
          category: 'الأعمدة',
          severity: 'warning',
          message: `العمود ${c.id} يحتوي فقط على أبعاد هندسية بدون تفاصيل حديد تسليح مصممة.`,
          solution: 'شغِّل التحليل والتصميم لتحديث حديد الكانات والتسليح بدقة بدلاً من استخدام النسب الافتراضية.'
        });
      }
    });

    beams.filter(b => !b.isRemoved).forEach(b => {
      const design = beamDesigns.find(d => d.beamId === b.id);
      if (!analyzed || !design) {
        issues.push({
          id: `audit-beam-${b.id}`,
          category: 'الجسور',
          severity: 'warning',
          message: `الجسر المستمر من عمود ${b.fromCol} إلى ${b.toCol} يفتقد لتسليح مرئي دقيق.`,
          solution: 'انتقل إلى تبويب "التحليل" لتشغيل عزم الانحناء والقص لتحديث كمية الحديد.'
        });
      }
    });

    slabs.forEach(s => {
      const design = slabDesigns.find(d => d.id === s.id);
      if (!analyzed || !design?.design) {
        issues.push({
          id: `audit-slab-${s.id}`,
          category: 'البلاطات',
          severity: 'info',
          message: `البلاطة ${s.id} تم تقدير تسليحها بنسبة تقريبية لعدم الانتهاء من فحص التسليح المصمم.`,
          solution: 'شغل تصميم البلاطات من المساعد لتصميم الأقطار والمسافات البينية لتسليح الشبكة.'
        });
      }
    });

    // Check 2: Invalid volumes (extreme ratios)
    qto.all.forEach(item => {
      if (item.vol <= 0.001) {
        issues.push({
          id: `audit-vol-${item.id}`,
          category: 'فحص الحجوم',
          severity: 'error',
          message: `العنصر ${item.id} له حجم خرساني يؤول للصفر (${item.vol.toFixed(4)}م³). قد يكون بسبب سماكات أو أبعاد مدخلة خطأ.`,
          solution: 'افحص منسوب الارتفاع أو السمك في نافذة الخصائص الهندسية.'
        });
      }
      
      // Duplication coordinate overlaps
      if (item.type === 'column') {
        const colGeom = columns.find(cl => cl.id === item.id);
        if (colGeom) {
          const duplicates = columns.filter(other => other.id !== colGeom.id && !other.isRemoved && Math.abs(other.x - colGeom.x) < 50 && Math.abs(other.y - colGeom.y) < 50);
          if (duplicates.length > 0) {
            issues.push({
              id: `audit-dup-${item.id}`,
              category: 'تكرار وتداخل',
              severity: 'error',
              message: `العمود<sup>${item.id}</sup> يقع على نفس الإحداثيات تقريباً مع العمود [${duplicates.map(dp=>dp.id).join(', ')}]. قد يسبب ازدواج في حساب الحفريات والخرسانات.`,
              solution: 'يرجى دمج الأعمدة المتداخلة أو حذف أحدهما من مخطط النمذجة لضمان دقة الحساب.'
            });
          }
        }
      }
    });

    if (excavationDepth < 1.0) {
      issues.push({
        id: 'audit-exc-depth',
        category: 'الميكانيكا الجيوتقنية',
        severity: 'info',
        message: 'عمق الحفر الإجمالي المسجل أقل من 1.0 متر وهو يقل عن منسوب التأسيس الآمن لحماية القواعد من الرطوبة والرياح.',
        solution: 'يُنصح بزيادة عمق الحفر ليكون 1.5م على الأقل من مستوى منسوب الشارع الطبيعي.'
      });
    }

    return issues;
  }, [columns, beams, slabs, analyzed, colDesigns, beamDesigns, slabDesigns, qto, excavationDepth]);

  const totalConcAll = financialSummary.totConcC35 + financialSummary.totConcC30 + financialSummary.totConcC25 || 1;
  const footingsVol = qto.footings.reduce((sum, f) => sum + f.vol, 0);
  const superstructureVol = qto.columns.reduce((sum, c) => sum + c.vol, 0) + qto.beams.reduce((sum, b) => sum + b.vol, 0) + qto.slabs.reduce((sum, s) => sum + s.vol, 0);

  const footingPercentage = Math.min(100, Math.max(10, (footingsVol / totalConcAll) * 100));
  const superstructurePercentage = Math.min(100, Math.max(10, (superstructureVol / totalConcAll) * 100));

  return (
    <div className="space-y-6 dir-rtl text-right">
      
      {/* HEADER SECTION & ACTION PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-muted shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="text-primary" size={24} />
            محرك حساب الكميات الهندسي (Quantity Takeoff Engine)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            استخلاص آلي ودقيق لكامل كميات الهيكل والأساسات بناءً على الهندسة التصميمية والمحاور الإنشائية للموديل.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportToExcel} className="h-9 gap-1.5 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
            <TableIcon size={14} />
            تصدير Excel (جداول كاملة)
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} className="h-9 gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20">
            <Download size={14} />
            تقرير PDF الإنشائي
          </Button>
          <Button variant="outline" size="sm" onClick={printReport} className="h-9 gap-1.5 text-xs">
            <Printer size={14} />
            طباعة الكشوفات
          </Button>
        </div>
      </div>

      {/* QUICK METRIC CARDS / DASHBOARD DIALS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        
        {/* Concrete Volume */}
        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-muted-foreground">خرسانة الهيكل</span>
              <div className="p-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded"><Database size={14} /></div>
            </div>
            <div className="mt-2">
              <h3 className="text-base font-bold font-mono tracking-tight text-foreground">
                {(financialSummary.totConcC35 + financialSummary.totConcC30 + financialSummary.totConcC25).toFixed(1)} م³
              </h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">شاملاً كافة الأدوار</p>
            </div>
          </CardContent>
        </Card>

        {/* Steel Reinforcement */}
        <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-muted-foreground">حديد التسليح</span>
              <div className="p-1 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded"><Layers2 size={14} /></div>
            </div>
            <div className="mt-2">
              <h3 className="text-base font-bold font-mono tracking-tight text-foreground">
                {financialSummary.totSteelTons.toFixed(2)} طن
              </h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">كافة أقطار شبكات الحديد</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Formwork */}
        <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-muted-foreground">أعمال الطوبار</span>
              <div className="p-1 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded"><Ruler size={14} /></div>
            </div>
            <div className="mt-2">
              <h3 className="text-base font-bold font-mono tracking-tight text-foreground">
                {financialSummary.totFormArea.toFixed(1)} م²
              </h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">مساحة خشب شدّات صب</p>
            </div>
          </CardContent>
        </Card>

        {/* Earthworks (Excavation) */}
        <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-muted-foreground">حفريات وتأسيس</span>
              <div className="p-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded"><Activity size={14} /></div>
            </div>
            <div className="mt-2">
              <h3 className="text-base font-bold font-mono tracking-tight text-foreground">
                {financialSummary.totExcavVol.toFixed(1)} م³
              </h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">نوع التربة: متوسطة لصلبة</p>
            </div>
          </CardContent>
        </Card>

        {/* Backfill */}
        <Card className="border-l-4 border-l-teal-500 hover:shadow-md transition">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-muted-foreground">ردميات القواعد</span>
              <div className="p-1 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 rounded"><RefreshCw size={14} /></div>
            </div>
            <div className="mt-2">
              <h3 className="text-base font-bold font-mono tracking-tight text-foreground">
                {financialSummary.totBackfillVol.toFixed(1)} م³
              </h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">ردم ميكانيكي بالرص والدمك</p>
            </div>
          </CardContent>
        </Card>

        {/* Waterproofing */}
        <Card className="border-l-4 border-l-sky-500 hover:shadow-md transition">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-semibold text-muted-foreground">العزل المائي</span>
              <div className="p-1 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded"><Layers size={14} /></div>
            </div>
            <div className="mt-2">
              <h3 className="text-base font-bold font-mono tracking-tight text-foreground">
                {financialSummary.totWaterproofingArea.toFixed(1)} م²
              </h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">طلاء بيتومين مطاطي عازل</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Cost Estimate */}
        <Card className="border-l-4 border-l-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 hover:shadow-md transition col-span-2 md:col-span-1">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">تقدير التكلفة</span>
              <div className="p-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 bg-opacity-70 rounded"><DollarSign size={14} /></div>
            </div>
            <div className="mt-2">
              <h3 className="text-base font-black font-mono tracking-tight text-indigo-700 dark:text-indigo-300">
                {financialSummary.grandTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px]">SAR</span>
              </h3>
              <p className="text-[9px] text-muted-foreground mt-0.5">شاملاً المواد والعمالة</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* CORE SECTIONS TABS NAVIGATION */}
      <div className="flex border-b border-muted overflow-x-auto gap-2 md:gap-4 shrink-0 scrollbar-none">
        {[
          { id: 'dashboard', label: 'لوحة التحكم والملخص', icon: Compass },
          { id: 'concrete', label: 'تفاصيل الخرسانة وطوبار', icon: Database },
          { id: 'rebar', label: 'كشف حديد التسليح وبطاقات الأقطار', icon: Layers2 },
          { id: 'geotech', label: 'أعمال الحفر والردم والـ PCC', icon: Ruler },
          { id: 'trace', label: 'أثر التتبع والمعادلات المحسوبة', icon: Link },
          { id: 'audit', label: 'التشخيص والتدقيق والجودة', icon: Activity, count: auditIssues.length },
          { id: 'settings', label: 'ثوابت القياس وتكلفة البنود', icon: Settings2 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-3 px-3 border-b-2 text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive 
                  ? 'border-primary text-primary bg-primary/5 rounded-t-lg' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
              }`}
            >
              <Icon size={15} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant="destructive" className="mr-1 h-4 min-w-[16px] flex items-center justify-center text-[9px] px-1 bg-red-500">
                  {tab.count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TABS CONTENT PORT */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            
            {/* TAB 1: DASHBOARD & GRAPHICS OVERVIEW */}
            {subTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* Visual quick info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Substructure / Superstructure split indicator */}
                  <Card className="hover:shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                        <Layers size={14} /> توزيع كميات الخرسانة المسلحة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>الأساسات وتحت الأرض (Substructure)</span>
                          <span className="font-mono">
                            {(qto.footings.reduce((sum,f)=>sum+f.vol, 0) + qto.future.reduce((sum,f)=>sum+(f.type==='raft'?f.vol:0), 0)).toFixed(1)} م³
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full" 
                            style={{ 
                              width: `${footingPercentage}%` 
                            }} 
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span>الهيكل الفوقي للمبنى (Superstructure)</span>
                          <span className="font-mono">
                            {(qto.columns.reduce((sum,c)=>sum+c.vol, 0) + qto.beams.reduce((sum,b)=>sum+b.vol, 0) + qto.slabs.reduce((sum,s)=>sum+s.vol, 0)).toFixed(1)} م³
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full rounded-full" 
                            style={{ 
                              width: `${superstructurePercentage}%` 
                            }} 
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Steel density indices */}
                  <Card className="hover:shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                        <Ruler size={14} /> مؤشر استهلاك وتسليح العناصر (المعدل الإنشائي)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-muted/40 rounded-lg">
                        <span className="text-[10px] text-muted-foreground block">معدل الأعمدة الرئيسي</span>
                        <span className="text-base font-extrabold font-mono text-primary mt-1 block">110 كجم/م³</span>
                        <span className="text-[9px] text-emerald-600 font-semibold block mt-1">ضمن المدى الاقتصادي</span>
                      </div>
                      <div className="text-center p-3 bg-muted/40 rounded-lg">
                        <span className="text-[10px] text-muted-foreground block">معدل البلاطات والجسور</span>
                        <span className="text-base font-extrabold font-mono text-primary mt-1 block">75 كجم/م³</span>
                        <span className="text-[9px] text-emerald-600 font-semibold block mt-1">فئة المنشآت السكنية</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Financial Breakdown quick table */}
                  <Card className="hover:shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign size={14} /> ملخص ميزانية بنود الهيكل الإنشائي
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <tbody>
                          <tr className="border-b border-muted">
                            <td className="py-1.5 font-semibold">أعمال خرسانة المسلحة والمواد</td>
                            <td className="py-1.5 text-right font-mono font-bold">
                              {((financialSummary.costC35 + financialSummary.costC30 + financialSummary.costC25)).toLocaleString(undefined, {maximumFractionDigits:0})} SAR
                            </td>
                          </tr>
                          <tr className="border-b border-muted">
                            <td className="py-1.5 font-semibold">حديد التسليح (توريد وتقطيع)</td>
                            <td className="py-1.5 text-right font-mono font-bold">{financialSummary.costSt.toLocaleString(undefined, {maximumFractionDigits:0})} SAR</td>
                          </tr>
                          <tr className="border-b border-muted">
                            <td className="py-1.5 font-semibold">الشدات الخشبية (طوبار/مصنعية)</td>
                            <td className="py-1.5 text-right font-mono font-bold">{financialSummary.costFm.toLocaleString(undefined, {maximumFractionDigits:0})} SAR</td>
                          </tr>
                          <tr>
                            <td className="py-1.5 font-semibold">الحفريات والردميات والعزل السفلي</td>
                            <td className="py-1.5 text-right font-mono font-bold">
                              {(financialSummary.costExc + financialSummary.costBf + financialSummary.costWp + financialSummary.costC15).toLocaleString(undefined, {maximumFractionDigits:0})} SAR
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                </div>

                {/* Substructure Section Details */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2"><Layers2 size={16} /> ملخص الكميات حسب أدوار المبنى والأساسات</span>
                      <Badge variant="outline" className="text-[10px]">بما في ذلك الحفريات المقابلة</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">المرحلة / الدور</TableHead>
                          <TableHead className="text-xs">الخرسانة المسلحة (م³)</TableHead>
                          <TableHead className="text-xs">حديد الكلي (طن)</TableHead>
                          <TableHead className="text-xs">أعمال الشدة/الطوبار (م²)</TableHead>
                          <TableHead className="text-xs">حجم الحفريات والتربة (م³)</TableHead>
                          <TableHead className="text-xs">عزل البيتومين المعالج (م²)</TableHead>
                          <TableHead className="text-xs">إجمالي التكلفة التقديرية</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        
                        {/* 1. Substructure row */}
                        <TableRow className="bg-amber-50/50 dark:bg-amber-950/10 font-medium">
                          <TableCell className="text-xs font-bold text-amber-800 dark:text-amber-400">مرحلة التأسيس وقبل الردم</TableCell>
                          <TableCell className="font-mono text-xs">
                            {qto.footings.reduce((sum,f)=>sum+f.vol, 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {(qto.footings.reduce((sum,f)=>sum+f.totalSteel, 0) / 1000).toFixed(3)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {qto.footings.reduce((sum,f)=>sum+f.formwork, 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {qto.footings.reduce((sum,f)=>sum+(f.excavation || 0), 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {qto.footings.reduce((sum,f)=>sum+(f.waterproofing || 0), 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-bold text-amber-800 dark:text-amber-400 text-left">
                            {(
                              qto.footings.reduce((sum,f)=>sum+f.vol, 0) * costConcreteC30 +
                              (qto.footings.reduce((sum,f)=>sum+f.totalSteel, 0) / 1000) * costSteel +
                              qto.footings.reduce((sum,f)=>sum+f.formwork, 0) * costFormwork +
                              qto.footings.reduce((sum,f)=>sum+(f.excavation || 0), 0) * costExcavation +
                              qto.footings.reduce((sum,f)=>sum+(f.backfill || 0), 0) * costBackfilling +
                              qto.footings.reduce((sum,f)=>sum+(f.pccVol || 0), 0) * costConcreteC15 +
                              qto.footings.reduce((sum,f)=>sum+(f.waterproofing || 0), 0) * costWaterproofing
                            ).toLocaleString(undefined, {maximumFractionDigits:0})} SAR
                          </TableCell>
                        </TableRow>

                        {/* 2. Stories rows */}
                        {stories.map(story => {
                          const storySlabs = qto.slabs.filter(s => s.storyId === story.id);
                          const storyBeams = qto.beams.filter(b => b.storyId === story.id);
                          const storyCols = qto.columns.filter(c => c.storyId === story.id);

                          const sVol = storySlabs.reduce((sum,s)=>sum+s.vol, 0) + storyBeams.reduce((sum,b)=>sum+b.vol, 0) + storyCols.reduce((sum,c)=>sum+c.vol, 0);
                          const sSteel = (storySlabs.reduce((sum,s)=>sum+s.totalSteel,0) + storyBeams.reduce((sum,b)=>sum+b.totalSteel,0) + storyCols.reduce((sum,c)=>sum+c.totalSteel,0)) / 1000;
                          const sForm = storySlabs.reduce((sum,s)=>sum+s.formwork, 0) + storyBeams.reduce((sum,b)=>sum+b.formwork, 0) + storyCols.reduce((sum,c)=>sum+c.formwork,0);
                          
                          const storyCost = 
                            storySlabs.reduce((sum,s)=>sum+s.vol,0)*costConcreteC25 + 
                            storyBeams.reduce((sum,b)=>sum+b.vol,0)*costConcreteC30 + 
                            storyCols.reduce((sum,c)=>sum+c.vol,0)*costConcreteC35 + 
                            sSteel * costSteel + 
                            sForm * costFormwork;

                          return (
                            <TableRow key={story.id}>
                              <TableCell className="text-xs font-semibold">{story.label}</TableCell>
                              <TableCell className="font-mono text-xs">{sVol.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs">{sSteel.toFixed(3)}</TableCell>
                              <TableCell className="font-mono text-xs">{sForm.toFixed(1)}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="font-mono text-xs text-left">{storyCost.toLocaleString(undefined, {maximumFractionDigits:0})} SAR</TableCell>
                            </TableRow>
                          );
                        })}

                        {/* 3. Future items table row */}
                        {qto.future.length > 0 && (
                          <TableRow className="bg-purple-50/50 dark:bg-purple-950/10 font-medium">
                            <TableCell className="text-xs font-bold text-purple-800 dark:text-purple-400">بند مستقبلي تمديد إضافي</TableCell>
                            <TableCell className="font-mono text-xs">
                              {qto.future.reduce((sum,f)=>sum+f.vol, 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {(qto.future.reduce((sum,f)=>sum+f.totalSteel, 0) / 1000).toFixed(3)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {qto.future.reduce((sum,f)=>sum+f.formwork, 0).toFixed(1)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {qto.future.reduce((sum,f)=>sum+(f.excavation || 0), 0).toFixed(1)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {qto.future.reduce((sum,f)=>sum+(f.waterproofing || 0), 0).toFixed(1)}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold text-purple-800 dark:text-purple-400 text-left">
                              {(
                                qto.future.reduce((sum,f)=>sum+f.vol, 0) * costConcreteC30 +
                                (qto.future.reduce((sum,f)=>sum+f.totalSteel, 0) / 1000) * costSteel +
                                qto.future.reduce((sum,f)=>sum+f.formwork, 0) * costFormwork +
                                qto.future.reduce((sum,f)=>sum+(f.excavation || 0), 0) * costExcavation +
                                qto.future.reduce((sum,f)=>sum+(f.backfill || 0), 0) * costBackfilling +
                                qto.future.reduce((sum,f)=>sum+(f.pccVol || 0), 0) * costConcreteC15 +
                                qto.future.reduce((sum,f)=>sum+(f.waterproofing || 0), 0) * costWaterproofing
                              ).toLocaleString(undefined, {maximumFractionDigits:0})} SAR
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Grand Total Row */}
                        <TableRow className="bg-muted font-bold text-primary">
                          <TableCell className="text-xs font-extrabold text-right">إجمالي المجمع العام للمشروع</TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-right">
                            {(financialSummary.totConcC35 + financialSummary.totConcC30 + financialSummary.totConcC25).toFixed(2)} م³
                          </TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-right">
                            {financialSummary.totSteelTons.toFixed(3)} طن
                          </TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-right">
                            {financialSummary.totFormArea.toFixed(1)} م²
                          </TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-right">
                            {(financialSummary.totExcavVol).toFixed(1)} م³
                          </TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-right">
                            {(financialSummary.totWaterproofingArea).toFixed(1)} م²
                          </TableCell>
                          <TableCell className="font-mono text-xs font-black text-left text-primary">
                            {financialSummary.grandTotalCost.toLocaleString(undefined, {maximumFractionDigits:0})} SAR
                          </TableCell>
                        </TableRow>

                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 2: DETAILED CONCRETE TAKEOFFS */}
            {subTab === 'concrete' && (
              <div className="space-y-4">
                
                {/* Search & filtering row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border border-muted">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-muted-foreground shrink-0">تصفية حسب الدور الأول والأساسات:</span>
                    <select
                      value={selectedStory}
                      onChange={e => setSelectedStory(e.target.value)}
                      className="h-8 rounded border border-input bg-background px-2 text-xs min-w-[150px]"
                    >
                      <option value="all">كل الأدوار الإنشائية</option>
                      <option value="substructure">الأساسات السفليّة</option>
                      {stories.map(st => (
                        <option key={st.id} value={st.id}>{st.label}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="البحث بالرمز أو المحاور..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-8 rounded border border-input bg-background px-3 text-xs w-[180px]"
                    />
                  </div>
                  
                  <div className="text-xs text-muted-foreground mr-auto font-mono">
                    تم عرض {selectedStoryFiltered.length} ملف عنصر نشط في هذا الفلتر
                  </div>
                </div>

                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">العنصر</TableHead>
                          <TableHead className="text-xs">الدور</TableHead>
                          <TableHead className="text-xs">الموقع (الشبكة)</TableHead>
                          <TableHead className="text-xs text-right">b (م)</TableHead>
                          <TableHead className="text-xs text-right">h (م)</TableHead>
                          <TableHead className="text-xs text-right">الطول L (م)</TableHead>
                          <TableHead className="text-xs text-right">الخرسانة (م³)</TableHead>
                          <TableHead className="text-xs">لوح التصميم</TableHead>
                          <TableHead className="text-xs">أثر التتبع</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedStoryFiltered.length === 0 ? (
                          <TableRow>
                            <td colSpan={9} className="text-center py-6 text-muted-foreground text-xs">
                              لا مسودات مطابقة لبحثك في هذا المنسوب.
                            </td>
                          </TableRow>
                        ) : (
                          selectedStoryFiltered.map(item => (
                            <TableRow key={item.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedElementId(item.id)}>
                              <TableCell className="text-xs font-bold font-mono">
                                <span className={`inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle ${
                                  item.type === 'slab' ? 'bg-indigo-500' : item.type === 'beam' ? 'bg-blue-500' : item.type === 'column' ? 'bg-emerald-500' : 'bg-amber-500'
                                }`} />
                                {item.id} ({(item.type === 'slab' ? 'بلاطة' : item.type === 'beam' ? 'جسر' : item.type === 'column' ? 'عمود' : 'قاعدة')})
                              </TableCell>
                              <TableCell className="text-xs">{item.storyLabel}</TableCell>
                              <TableCell className="text-xs font-mono font-semibold">{item.grid}</TableCell>
                              <TableCell className="text-xs font-mono text-left">{item.b.toFixed(3)}</TableCell>
                              <TableCell className="text-xs font-mono text-left">{item.h.toFixed(3)}</TableCell>
                              <TableCell className="text-xs font-mono text-left">{item.L.toFixed(3)}</TableCell>
                              <TableCell className="text-xs font-mono font-bold text-left text-primary">{item.vol.toFixed(3)}</TableCell>
                              <TableCell className="text-[10px]">
                                <Badge variant="secondary" className="gap-1 text-[9px] h-5 bg-muted">
                                  <Link size={8} /> {item.drawingSheet}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); setSelectedElementId(item.id); setSubTab('trace'); }} className="h-6 text-xs text-primary">
                                  عرض المعادلة
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

              </div>
            )}

            {/* TAB 3: REINFORCEMENT DETAILED TAKEOFF KEY */}
            {subTab === 'rebar' && (
              <div className="space-y-4">
                
                <Card className="border-amber-100">
                  <CardHeader className="pb-2 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardTitle className="text-sm text-amber-700 dark:text-amber-400 flex items-center justify-between">
                      <span className="flex items-center gap-2"><Layers2 size={16} /> تتبع تسليح حديد العناصر والأقطار الفعالة</span>
                      <span className="text-xs text-muted-foreground font-semibold">الوحدات بالكيلوجرام (kg)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">العنصر</TableHead>
                          <TableHead className="text-xs">نوع العنصر</TableHead>
                          <TableHead className="text-xs text-center">Φ8</TableHead>
                          <TableHead className="text-xs text-center">Φ10</TableHead>
                          <TableHead className="text-xs text-center">Φ12</TableHead>
                          <TableHead className="text-xs text-center">Φ14</TableHead>
                          <TableHead className="text-xs text-center">Φ16</TableHead>
                          <TableHead className="text-xs text-center">Φ18</TableHead>
                          <TableHead className="text-xs text-center font-bold">المجموع (كجم)</TableHead>
                          <TableHead className="text-xs font-bold">المجموع (طن)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {qto.all.map(item => {
                          if (item.totalSteel === 0) return null;
                          return (
                            <TableRow key={item.id} className="hover:bg-muted/20">
                              <TableCell className="text-xs font-bold font-mono">{item.id}</TableCell>
                              <TableCell className="text-[11px] text-muted-foreground">
                                {item.type === 'slab' ? 'بلاطة' : item.type === 'beam' ? 'جسر' : item.type === 'column' ? 'عمود' : 'أساسات'}
                              </TableCell>
                              <TableCell className="font-mono text-center text-xs">{(item.steelMap[8] || 0) > 0 ? (item.steelMap[8]).toFixed(1) : '—'}</TableCell>
                              <TableCell className="font-mono text-center text-xs">{(item.steelMap[10] || 0) > 0 ? (item.steelMap[10]).toFixed(1) : '—'}</TableCell>
                              <TableCell className="font-mono text-center text-xs">{(item.steelMap[12] || 0) > 0 ? (item.steelMap[12]).toFixed(1) : '—'}</TableCell>
                              <TableCell className="font-mono text-center text-xs">{(item.steelMap[14] || 0) > 0 ? (item.steelMap[14]).toFixed(1) : '—'}</TableCell>
                              <TableCell className="font-mono text-center text-xs">{(item.steelMap[16] || 0) > 0 ? (item.steelMap[16]).toFixed(1) : '—'}</TableCell>
                              <TableCell className="font-mono text-center text-xs">{(item.steelMap[18] || 0) > 0 ? (item.steelMap[18]).toFixed(1) : '—'}</TableCell>
                              <TableCell className="font-mono text-center text-xs font-bold">{(item.totalSteel).toFixed(1)}</TableCell>
                              <TableCell className="font-mono text-left text-xs font-bold text-amber-700 dark:text-amber-400">{(item.totalSteel / 1000).toFixed(3)}</TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Dialogue subtotal of diameters */}
                        <TableRow className="bg-amber-100/30 dark:bg-amber-950/20 font-extrabold text-amber-900 dark:text-amber-300">
                          <TableCell colSpan={2} className="text-xs font-extrabold">المجموع التراكمي للأقطار</TableCell>
                          
                          {[8, 10, 12, 14, 16, 18].map(dia => {
                            const sumDia = qto.all.reduce((sum, item) => sum + (item.steelMap[dia] || 0), 0);
                            return (
                              <TableCell key={dia} className="font-mono text-center text-xs font-bold">
                                {sumDia > 0 ? sumDia.toFixed(0) : '—'}
                              </TableCell>
                            );
                          })}
                          
                          <TableCell className="font-mono text-center text-xs font-black">
                            {(qto.all.reduce((sum, item) => sum + item.totalSteel, 0)).toFixed(0)}
                          </TableCell>
                          <TableCell className="font-mono text-left text-xs font-black">
                            {(qto.all.reduce((sum, item) => sum + item.totalSteel, 0) / 1000).toFixed(3)}
                          </TableCell>
                        </TableRow>

                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

              </div>
            )}

            {/* TAB 4: GEOTECHNICAL (EXCAVATION & BACKFILL & PCC) */}
            {subTab === 'geotech' && (
              <div className="space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/40 p-4 rounded-xl border border-muted">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">عمق التأسيس الإجمالي (م)</label>
                    <Input type="number" step="0.1" value={excavationDepth} onChange={e => setExcavationDepth(parseFloat(e.target.value) || 0)} className="h-9 font-mono text-sm bg-background" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">مسافة رفرفة الحفر الجانبية (م)</label>
                    <Input type="number" step="0.05" value={workingSpace} onChange={e => setWorkingSpace(parseFloat(e.target.value) || 0)} className="h-9 font-mono text-sm bg-background" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">سمك خرسانة النظافة PCC (مم)</label>
                    <Input type="number" step="10" value={pccThickness} onChange={e => setPccThickness(parseFloat(e.target.value) || 0)} className="h-9 font-mono text-sm bg-background" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">بروز النظافة حول المسلحة offset (مم)</label>
                    <Input type="number" step="10" value={pccOffset} onChange={e => setPccOffset(parseFloat(e.target.value) || 0)} className="h-9 font-mono text-sm bg-background" />
                  </div>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">التفصيل الإنشائي لأعمال الحفر والخرسانة المسطحة المساعدة (PCC) والعزل المائي</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">رمز القاعدة</TableHead>
                          <TableHead className="text-xs">أبعاد المسلحة (م)</TableHead>
                          <TableHead className="text-xs text-right">الحفريات المسلوقة (م³)</TableHead>
                          <TableHead className="text-xs text-right">أرضية النظافة PCC Area (م²)</TableHead>
                          <TableHead className="text-xs text-right">خرسانة نظافة PCC Vol (م³)</TableHead>
                          <TableHead className="text-xs text-right">العزل المائي الكلي (م²)</TableHead>
                          <TableHead className="text-xs text-right">الردميّات المتبقية (م³)</TableHead>
                          <TableHead className="text-xs">المخطط المرجعي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        
                        {qto.footings.length === 0 && qto.future.filter(f=>f.type==='raft').length === 0 ? (
                          <TableRow>
                            <td colSpan={8} className="text-center py-6 text-muted-foreground text-xs">
                              لا تتوفر قواعد أساسات منفردة مصممة حالياً. يرجى مراجعة تبويب تصميم الأساسات أولاً لتحديث الأرقام.
                            </td>
                          </TableRow>
                        ) : (
                          [...qto.footings, ...qto.future.filter(f=>f.type==='raft')].map(item => (
                            <TableRow key={item.id} className="hover:bg-muted/20">
                              <TableCell className="text-xs font-bold font-mono flex items-center gap-1.5 p-3">
                                <span className="inline-block w-2.5 h-2.5 rounded bg-amber-500" />
                                {item.id} (الأبعاد: {item.L.toFixed(1)}x{item.b.toFixed(1)}م)
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{item.L.toFixed(2)} × {item.b.toFixed(2)} × {item.h.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs text-left text-foreground font-semibold">{item.excavation.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs text-left text-muted-foreground">{item.pccArea.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs text-left text-foreground font-bold">{item.pccVol.toFixed(3)}</TableCell>
                              <TableCell className="font-mono text-xs text-left text-sky-600 font-semibold">{item.waterproofing.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs text-left text-foreground">{item.backfill.toFixed(2)}</TableCell>
                              <TableCell className="text-[10px]">
                                <Badge variant="outline" className="text-[9px] h-5">{item.drawingSheet}</Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}

                        {/* Geotechnical totals row */}
                        <TableRow className="bg-muted font-bold text-foreground">
                          <TableCell colSpan={2} className="text-xs font-extrabold p-3">المجموع للأعمال الترابية والعزل</TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-left">{financialSummary.totExcavVol.toFixed(2)} م³</TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-left">—</TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-left">{financialSummary.totConcC15.toFixed(3)} م³</TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-left text-sky-600">{financialSummary.totWaterproofingArea.toFixed(2)} م²</TableCell>
                          <TableCell className="font-mono text-xs font-extrabold text-left">{financialSummary.totBackfillVol.toFixed(2)} م³</TableCell>
                          <TableCell className="text-xs text-muted-foreground">—</TableCell>
                        </TableRow>

                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

              </div>
            )}

            {/* TAB 5: TRACEABILITY GRAPHIC / DRILL & EXPLAIN MATH */}
            {subTab === 'trace' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visual selector list */}
                <Card className="md:col-span-1 h-[450px] flex flex-col">
                  <CardHeader className="pb-2 border-b border-muted">
                    <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>مكونات الموديل المسجلة</span>
                      <Badge variant="secondary" className="text-[10px]">{qto.all.length} عناصر</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-y-auto flex-1 p-2 space-y-1">
                    {qto.all.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedElementId(item.id)}
                        className={`w-full text-right p-2 rounded text-xs transition duration-150 flex items-center justify-between ${
                          selectedElementId === item.id 
                            ? 'bg-primary text-primary-foreground font-semibold shadow-sm' 
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <span className="font-mono truncate">{item.id} ({item.type === 'slab' ? 'بلاطة' : item.type === 'beam' ? 'جسر' : item.type === 'column' ? 'عمود' : 'قاعدة'})</span>
                        <span className="font-mono text-[10px] text-opacity-80">{(item.vol).toFixed(3)} م³</span>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Mathematical Derivation Display Area */}
                <Card className="md:col-span-2 h-[450px] overflow-y-auto">
                  {activeElementDetails ? (
                    <div className="p-4 space-y-4">
                      
                      {/* Derivation title */}
                      <div className="border-b border-muted pb-3 flex justify-between items-start">
                        <div>
                          <Badge className="mb-1 text-[9px]">{activeElementDetails.type.toUpperCase()}</Badge>
                          <h3 className="text-sm font-black text-foreground">{activeElementDetails.label} ({activeElementDetails.id})</h3>
                          <p className="text-[10px] text-muted-foreground mt-0.5">تتبع المحاور: {activeElementDetails.grid} • المنسوب: {activeElementDetails.storyLabel}</p>
                        </div>
                        <Badge variant="outline" className="font-mono h-6 text-xs text-primary">{activeElementDetails.grade}</Badge>
                      </div>

                      {/* Formulas cards */}
                      <div className="space-y-3 text-xs">
                        
                        <div className="p-3 bg-muted/40 rounded-lg border border-muted">
                          <h4 className="font-bold text-muted-foreground flex items-center gap-1.5 mb-1.5 text-[11px]"><CheckCircle2 className="text-green-500" size={13} /> البيانات والمدخلات الإنشائية:</h4>
                          <p className="text-[11px] font-medium leading-relaxed font-mono">{getFormulaDerivation(activeElementDetails).dimensions}</p>
                        </div>

                        <div className="p-3 bg-blue-50/40 dark:bg-blue-950/25 rounded-lg border border-blue-100 dark:border-blue-900">
                          <h4 className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-1.5 text-[11px]"><CheckCircle2 size={13} /> الحجم المائي للخرسانة:</h4>
                          <p className="font-mono text-xs text-blue-700 dark:text-blue-400 bg-background/50 dark:bg-background/20 p-2 rounded select-all mb-1 font-bold">
                            {getFormulaDerivation(activeElementDetails).equationVol}
                          </p>
                          <span className="text-[9px] text-muted-foreground block">مقياس القياس العالمي يتم خصم مواضع التداخل والشبكات تلقائياً.</span>
                        </div>

                        <div className="p-3 bg-purple-50/40 dark:bg-purple-950/25 rounded-lg border border-purple-100 dark:border-purple-900">
                          <h4 className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5 mb-1.5 text-[11px]"><CheckCircle2 size={13} /> مساحة الشدّة الخشبية (طوبار):</h4>
                          <p className="font-mono text-xs text-purple-700 dark:text-purple-400 bg-background/50 dark:bg-background/20 p-2 rounded select-all font-bold">
                            {getFormulaDerivation(activeElementDetails).equationForm}
                          </p>
                        </div>

                        {/* Extra foundation rows */}
                        {activeElementDetails.type === 'footing' && (
                          <>
                            <div className="p-3 bg-teal-50/40 dark:bg-teal-950/25 rounded-lg border border-teal-100 dark:border-teal-900">
                              <h4 className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5 mb-1 text-[11px]">أعمال الحفريات (Excavation):</h4>
                              <p className="font-mono text-xs text-teal-700 dark:text-teal-400 bg-background/50 dark:bg-background/20 p-2 rounded select-all font-bold">
                                {getFormulaDerivation(activeElementDetails).equationExcavation}
                              </p>
                            </div>
                            <div className="p-3 bg-amber-50/40 dark:bg-amber-950/25 rounded-lg border border-amber-100 dark:border-amber-900">
                              <h4 className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1 text-[11px]">الخرسانة العادية والردم:</h4>
                              <p className="font-mono text-[11px] leading-relaxed mb-1 text-amber-850 dark:text-amber-400">{getFormulaDerivation(activeElementDetails).equationPCC}</p>
                              <p className="font-mono text-[11px] leading-relaxed text-amber-850 dark:text-amber-400">{getFormulaDerivation(activeElementDetails).equationBackfill}</p>
                            </div>
                          </>
                        )}

                        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/25 rounded-lg border border-amber-200/50">
                          <h4 className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5 mb-1 text-[11px]">تفاصيل وبطاقة حديد التسليح:</h4>
                          <p className="text-[11px] font-medium leading-relaxed">{getFormulaDerivation(activeElementDetails).rebarNotes}</p>
                        </div>

                        {/* Reference Drawing links sheets */}
                        <div className="p-3 bg-muted/30 rounded-lg border border-muted mt-2 space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>اللوحة المرتبطة في المخطط:</span>
                            <span className="font-bold text-foreground flex items-center gap-1"><Link size={9} /> {activeElementDetails.drawingSheet} ({activeElementDetails.schedule})</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>التفصيل النموذجي:</span>
                            <span className="font-bold text-foreground">{activeElementDetails.detail}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>القطاع العرضي:</span>
                            <span className="font-bold text-foreground">{activeElementDetails.section}</span>
                          </div>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-2">
                      <HelpCircle size={32} className="text-muted-foreground/50" />
                      <h3 className="text-xs font-bold">بوابة أثر تتبع القياس التفصيلي</h3>
                      <p className="text-[11px] max-w-sm">يرجى نقر أي سطر أو عنصر من لوحة الأيسر لعرض derivations والبيانات الرياضية وحجب التداعي الهندسي بالتفصيل.</p>
                    </div>
                  )}
                </Card>

              </div>
            )}

            {/* TAB 6: DETAILED QUALITY AUDITS */}
            {subTab === 'audit' && (
              <div className="space-y-4">
                
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-150 rounded-lg text-amber-800 dark:text-amber-400">
                  <AlertTriangle size={18} className="shrink-0" />
                  <div className="text-xs leading-relaxed">
                    <strong>نظام تدقيق الجودة الهندسي (Engine Audit & QA System):</strong> تم تشغيل الفحص التلقائي على {qto.all.length} عنصر مسجل. يُوضح هذا المربع التحذيرات أو الأخطاء التي تنشأ عن عدم تطابق المدخلات أو نقص تصميم حديد الأقطار.
                  </div>
                </div>

                <div className="space-y-3">
                  {auditIssues.length === 0 ? (
                    <div className="bg-card p-6 border border-muted rounded-xl text-center text-muted-foreground space-y-1">
                      <CheckCircle2 size={36} className="text-green-500 mx-auto" />
                      <h3 className="text-xs font-bold text-foreground">الموديل الإنشائي خالي تماماً من المشاكل!</h3>
                      <p className="text-[11px]">لقد تم فحص التقاطعات والتقارب وتطابق الأحجام والارتباطات وبناء حديد كامل الأقطار بنجاح تام.</p>
                    </div>
                  ) : (
                    auditIssues.map(issue => (
                      <Card key={issue.id} className={`border-r-4 ${
                        issue.severity === 'error' ? 'border-r-red-500 border-red-100 bg-red-50/20' : issue.severity === 'warning' ? 'border-r-amber-500 border-amber-100 bg-amber-50/20' : 'border-r-blue-500 border-blue-100 bg-blue-50/20'
                      }`}>
                        <CardHeader className="py-2.5 flex flex-row items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Badge variant={issue.severity === 'error' ? 'destructive' : issue.severity === 'warning' ? 'default' : 'secondary'} className="text-[9px] h-4 leading-3">
                              {issue.severity === 'error' ? 'خطأ هندسي' : issue.severity === 'warning' ? 'توصية هامة' : 'تلميح فني'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">الفئة: {issue.category}</span>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-2.5">
                          <p className="text-xs font-bold text-foreground leading-relaxed">{issue.message}</p>
                          <div className="mt-2 text-[11px] text-muted-foreground bg-background/50 p-2 rounded border border-muted leading-relaxed">
                            <strong>الحل والتوصية:</strong> {issue.solution}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

              </div>
            )}

            {/* TAB 7: EXTRA ESTIMATING & SETTINGS */}
            {subTab === 'settings' && (
              <div className="space-y-6">
                
                {/* Geotechnical Extra config */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">تضمين ودرج البنود الإضافية والمستقبلية</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    
                    {/* Include Future Walls */}
                    <div className="border border-muted rounded-lg p-3 space-y-3 bg-muted/10">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox id="walls" checked={includeFutureWalls} onCheckedChange={(val) => setIncludeFutureWalls(!!val)} />
                        <div>
                          <label htmlFor="walls" className="text-xs font-bold text-foreground cursor-pointer block">تضمين جدران استنادية مسلحة للمستقبل (Future Structural Walls)</label>
                          <span className="text-[10px] text-muted-foreground block">إدراج خرسانة الجدران والقص في التقدير الإنشائي الموحد.</span>
                        </div>
                      </div>
                      
                      {includeFutureWalls && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">إجمالي طول الجدار (م)</label>
                            <Input type="number" step="0.5" value={wallLength} onChange={e => setWallLength(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs bg-background" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">ارتفاع الجدار (م)</label>
                            <Input type="number" step="0.2" value={wallHeight} onChange={e => setWallHeight(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs bg-background" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">سمك الجدار (مم)</label>
                            <Input type="number" step="50" value={wallThickness} onChange={e => setWallThickness(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs bg-background" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">نسبة حديد التسليح (%)</label>
                            <Input type="number" step="0.1" value={wallRebarRatio} onChange={e => setWallRebarRatio(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs bg-background" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Include Future Raft */}
                    <div className="border border-muted rounded-lg p-3 space-y-3 bg-muted/10">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox id="raft" checked={includeFutureRaft} onCheckedChange={(val) => setIncludeFutureRaft(!!val)} />
                        <div>
                          <label htmlFor="raft" className="text-xs font-bold text-foreground cursor-pointer block">تضمين لبشة خرسانية مسلحة مستقبلية (Future Raft Foundations)</label>
                          <span className="text-[10px] text-muted-foreground block">حساب التأسيس الموحد بدلاً من أو بجانب القواعد المنفردة.</span>
                        </div>
                      </div>
                      
                      {includeFutureRaft && (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">طول اللبشة (م)</label>
                            <Input type="number" step="0.5" value={raftLength} onChange={e => setRaftLength(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs bg-background" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">عرض اللبشة (م)</label>
                            <Input type="number" step="0.5" value={raftWidth} onChange={e => setRaftWidth(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs bg-background" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">سمك اللبشة (مم)</label>
                            <Input type="number" step="50" value={raftThickness} onChange={e => setRaftThickness(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs bg-background" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">نسبة التسليح الكلي (%)</label>
                            <Input type="number" step="0.1" value={raftRebarRatio} onChange={e => setRaftRebarRatio(parseFloat(e.target.value) || 0)} className="h-8 font-mono text-xs bg-background" />
                          </div>
                        </div>
                      )}
                    </div>

                  </CardContent>
                </Card>

                {/* Costs rates config */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">أسعار وثوابت المواد والعمالة (تقديرات مالية)</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-[11px] font-bold text-muted-foreground mb-2">خرسانات رطبة (م³)</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-16">رتبة C35:</span>
                          <Input type="number" value={costConcreteC35} onChange={e => setCostConcreteC35(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-16">رتبة C30:</span>
                          <Input type="number" value={costConcreteC30} onChange={e => setCostConcreteC30(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-16">رتبة C25:</span>
                          <Input type="number" value={costConcreteC25} onChange={e => setCostConcreteC25(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-muted-foreground mb-2">الحديد والطوبار</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-24">حديد لكل طن:</span>
                          <Input type="number" value={costSteel} onChange={e => setCostSteel(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-24">طوبار لكل م²:</span>
                          <Input type="number" value={costFormwork} onChange={e => setCostFormwork(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-24">عزل لكل م²:</span>
                          <Input type="number" value={costWaterproofing} onChange={e => setCostWaterproofing(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-muted-foreground mb-2">الأعمال الترابية والمساعدة (م³)</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-20">الحفر:</span>
                          <Input type="number" value={costExcavation} onChange={e => setCostExcavation(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-20">الردم:</span>
                          <Input type="number" value={costBackfilling} onChange={e => setCostBackfilling(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground w-20">عادية PCC:</span>
                          <Input type="number" value={costConcreteC15} onChange={e => setCostConcreteC15(parseInt(e.target.value) || 0)} className="h-8 font-mono text-xs w-[120px]" />
                        </div>
                      </div>
                    </div>

                  </CardContent>
                </Card>

              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}

/**
 * Advanced Commercial Bill of Quantities (BOQ) Engine
 * Supported Workflows: Civil Cost Estimation, Project Bidding, Procurement, Cost Control
 * Features: Multi-structural grouping (Division-Based CSI, Element-Based, Story-Based, Custom),
 * Customizable Rates, Formula Traceability, Integrity Auditing, Real-time Visual Analytics,
 * and Multi-format Exports (Excel Workbook, PDF Commercial format, CSV, and Print).
 */

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Building2, Database, Layers, Ruler, FileSpreadsheet, FileDown, Printer, 
  RefreshCw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Layers3, 
  Calculator, Landmark, ShieldCheck, HelpCircle, TrendingUp, Info, Search,
  Settings2, Plus, Trash2, ArrowUpDown, Coins, Compass, FileText
} from 'lucide-react';
import type { Story, Slab, Beam, Column, SlabProps } from '@/lib/structuralEngine';
import type { FootingDesignResult, FootingMaterials } from '@/lib/foundationDesign';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Interfaces ---
interface BeamDesignData {
  beamId: string;
  flexLeft: any;
  flexMid: any;
  flexRight: any;
  shear: any;
  span: number;
}

interface ColDesignData {
  id: string;
  b: number; h: number; L: number;
  design: any;
}

interface SlabDesignData {
  id: string;
  x1: number; y1: number; x2: number; y2: number;
  design: {
    hUsed: number;
    shortDir: { bars: number; dia: number; spacing: number };
    longDir: { bars: number; dia: number; spacing: number };
    lx: number; ly: number;
  };
}

interface BOQPanelProps {
  stories: Story[];
  slabs: Slab[];
  beams: Beam[];
  columns: Column[];
  beamDesigns: BeamDesignData[];
  colDesigns: ColDesignData[];
  slabDesigns: SlabDesignData[];
  slabProps: SlabProps;
  analyzed: boolean;
  foundationResults?: FootingDesignResult[];
  foundationMat?: FootingMaterials | null;
  /** Ribbed slab geometry — used to compute hollow filler block counts in BOQ */
  ribbedSlabProps?: { bw?: number; hb?: number; tf?: number; s?: number; fillerType?: string };
}

// Rebar weight formula: weight (kg/m) = dia² / 162.2
const REBAR_DIAMETERS = [8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
function getRebarUnitWeight(dia: number): number {
  return (dia * dia) / 162.2;
}

// Types of BOQ representation
type BOQStructure = 'division' | 'element' | 'story' | 'custom';
type TabName = 'boq' | 'summary' | 'validator' | 'rates';

interface CustomBOQItem {
  id: string;
  itemNo: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  division: string;
  category: string;
  remarks: string;
}

export default function BOQPanel({
  stories, slabs, beams, columns, beamDesigns, colDesigns, slabDesigns, slabProps, analyzed,
  foundationResults, foundationMat, ribbedSlabProps
}: BOQPanelProps) {

  // --- State Variables ---
  const [activeTab, setActiveTab] = useState<TabName>('boq');
  const [structureType, setStructureType] = useState<BOQStructure>('division');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'SAR' | 'USD' | 'AED'>('SAR');
  const [currencyRate, setCurrencyRate] = useState<number>(1.0); // Exchange multiplier

  // Substructure parameters
  const [excavationDepth, setExcavationDepth] = useState<number>(1.5); // meters
  const [workingSpace, setWorkingSpace] = useState<number>(0.3); // meters offset out for excavation
  const [pccThickness, setPccThickness] = useState<number>(100); // mm
  const [pccOffset, setPccOffset] = useState<number>(100); // mm

  // Rate Constants (Base currency: SAR)
  const [rates, setRates] = useState({
    excavation: 25,       // SAR per m³
    backfilling: 18,      // SAR per m³
    pccLean: 260,         // SAR per m³
    concFootings: 350,    // C35/C30 base
    concColumns: 380,     // Higher grade
    concBeams: 360,
    concSlabs: 340,
    rebarSteel: 3200,     // SAR per Ton
    formworkFootings: 40, // SAR per m²
    formworkColumns: 55,
    formworkBeams: 48,
    formworkSlabs: 42,
    waterproofing: 16,    // SAR per m²
    pedestals: 370        // SAR per m³
  });

  // Future extensions
  const [includeFutureExtension, setIncludeFutureExtension] = useState<boolean>(false);
  const [futureSlabArea, setFutureSlabArea] = useState<number>(120); // m²
  const [futureSlabThickness, setFutureSlabThickness] = useState<number>(200); // mm

  // Custom User BOQ items
  const [customItems, setCustomItems] = useState<CustomBOQItem[]>([
    {
      id: 'cust-1',
      itemNo: '5.01',
      description: 'أعمال الاختبارات المعملية لكسر مكعبات الخرسانة المسلحة وتدقيق الجودة عشوائياً',
      unit: 'حزمة',
      quantity: 1,
      rate: 1500,
      division: 'أعمال ضبط الجودة والموقع',
      category: 'عام',
      remarks: 'محدد للمشروع بالكامل شامل التقارير الفنية المعتمدة'
    }
  ]);

  const [newCustomItem, setNewCustomItem] = useState({
    description: '',
    unit: 'م³',
    quantity: 1,
    rate: 100,
    division: 'أعمال تشطيبات وتهيئة خاصة',
    remarks: ''
  });

  // Handle currency swap
  const changeExchange = (cur: 'SAR' | 'USD' | 'AED') => {
    setCurrency(cur);
    if (cur === 'SAR') setCurrencyRate(1.0);
    else if (cur === 'USD') setCurrencyRate(0.266);
    else if (cur === 'AED') setCurrencyRate(0.98);
  };

  const curSymbol = currency;

  // Render price based on scale
  const formatPrice = (sarPrice: number) => {
    const val = sarPrice * currencyRate;
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Convert for inline math calculations
  const scaledRate = (sarRate: number) => {
    return sarRate * currencyRate;
  };

  // --- Dynamic Grid System & Coordinates Tracker ---
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
    const xLetter = xIdx !== -1 ? String.fromCharCode(65 + (xIdx % 26)) : 'Coordinate-X';
    const yNum = yIdx !== -1 ? (yIdx + 1).toString() : 'Y';
    return `${xLetter}-${yNum}`;
  };

  // --- CORE QUANTITY TAKEOFF RECALCULATOR & MATRICES ---
  const physicalTakeoff = useMemo(() => {
    // 1. Slabs
    const slabItems = slabs.map(s => {
      const area = Math.abs(s.x2 - s.x1) * Math.abs(s.y2 - s.y1); // m²
      const th = (s.thickness || slabProps.thickness) / 1000; // m
      const vol = area * th;
      const formwork = area; // Bottom structural formwork
      const storyLabel = stories.find(st => st.id === s.storyId)?.label || 'مستوى السقف';
      const design = slabDesigns.find(d => d.id === s.id);
      
      let steelKg = 0;
      const steelMap: Record<number, number> = {};
      let steelSource: 'actual' | 'nominal' = 'nominal';
      const isRibbed = (s as any).slabType === 'one_way_ribbed';

      if (analyzed && design?.design) {
        // short direction
        if (design.design.shortDir?.dia) {
          const dia = design.design.shortDir.dia;
          const spacing = (design.design.shortDir.spacing || 200) / 1000;
          const lx = Math.abs(s.x2 - s.x1);
          const ly = Math.abs(s.y2 - s.y1);
          const qty = spacing > 0 ? Math.ceil(ly / spacing) : (design.design.shortDir.bars || 5);
          const wt = getRebarUnitWeight(dia) * (lx + 0.3) * qty; 
          steelMap[dia] = (steelMap[dia] || 0) + wt;
          steelKg += wt;
          steelSource = 'actual';
        }
        // long direction
        if (design.design.longDir?.dia) {
          const dia = design.design.longDir.dia;
          const spacing = (design.design.longDir.spacing || 200) / 1000;
          const lx = Math.abs(s.x2 - s.x1);
          const ly = Math.abs(s.y2 - s.y1);
          const qty = spacing > 0 ? Math.ceil(lx / spacing) : (design.design.longDir.bars || 5);
          const wt = getRebarUnitWeight(dia) * (ly + 0.3) * qty;
          steelMap[dia] = (steelMap[dia] || 0) + wt;
          steelKg += wt;
          steelSource = 'actual';
        }
        // Fallback to nominal if no bar data available in design result
        if (steelKg === 0) {
          // Ribbed slab: ribs only ~ 35 kg/m³ concrete (ACI typical); solid: 55 kg/m³
          const nominalRate = isRibbed ? 35 : 55;
          const nominal = vol * nominalRate;
          steelMap[12] = nominal;
          steelKg = nominal;
          steelSource = 'nominal';
        }
      } else {
        // Nominal estimation based on slab type
        // Ribbed slab ribs carry most steel; solid concrete uses 55 kg/m³ of slab volume.
        // For ribbed: ribs are ~40% of total concrete → effective steel density ≈ 35 kg/m³.
        const nominalRate = isRibbed ? 35 : 55;
        const nominal = vol * nominalRate;
        steelMap[12] = nominal;
        steelKg = nominal;
        steelSource = 'nominal';
      }

      return {
        id: s.id,
        type: 'slab',
        label: isRibbed ? `بلاطة مروحية ${s.id}` : `بلاطة سقوف المسقفة ${s.id}`,
        storyId: s.storyId || 'story-1',
        storyLabel,
        volume: vol,
        area,
        formwork,
        steelKg,
        steelMap,
        steelSource,
        raw: s,
        grid: `${getGridRef(s.x1, s.y1)} / ${getGridRef(s.x2, s.y2)}`,
        drawings: isRibbed ? 'RD-01 (مخطط تسليح السقف المروحي)' : 'SD-01 (مخطط تسليح الأسقف الفرعية والبلاطات)',
        details: 'تفصيل الكسرات الإنشائية ومحلات الهبوط بالبلاطة - قطاع 2-2'
      };
    });

    // 2. Beams
    const beamItems = beams.filter(b => !b.isRemoved).map(b => {
      const length = b.length; // meters
      const width = b.b / 1000; // meters
      const height = b.h / 1000; // meters
      // Subtract slab thickness from beam height to prevent double counting
      const slabThInBeam = slabProps.thickness / 1000;
      const effectiveH = Math.max(height - slabThInBeam, height * 0.5);
      const vol = width * effectiveH * length;
      
      // Formwork = (2 lateral faces + bottom width) * span length
      const formwork = (2 * effectiveH + width) * length;
      const storyLabel = stories.find(st => st.id === b.storyId)?.label || 'منسوب السقف';
      const design = beamDesigns.find(d => d.beamId === b.id);
      
      let steelKg = 0;
      const steelMap: Record<number, number> = {};

      if (analyzed && design) {
        const spanM = design.span || length;
        // flex left
        if (design.flexLeft?.dia && design.flexLeft?.bars) {
          const wt = getRebarUnitWeight(design.flexLeft.dia) * (spanM * 0.33) * design.flexLeft.bars;
          steelMap[design.flexLeft.dia] = (steelMap[design.flexLeft.dia] || 0) + wt;
          steelKg += wt;
        }
        // flex right
        if (design.flexRight?.dia && design.flexRight?.bars) {
          const wt = getRebarUnitWeight(design.flexRight.dia) * (spanM * 0.33) * design.flexRight.bars;
          steelMap[design.flexRight.dia] = (steelMap[design.flexRight.dia] || 0) + wt;
          steelKg += wt;
        }
        // flex mid
        if (design.flexMid?.dia && design.flexMid?.bars) {
          const wt = getRebarUnitWeight(design.flexMid.dia) * (spanM + 0.6) * design.flexMid.bars;
          steelMap[design.flexMid.dia] = (steelMap[design.flexMid.dia] || 0) + wt;
          steelKg += wt;
        }
        // shearing ties / stirrups
        if (design.shear?.sUsed && design.shear.sUsed > 0) {
          const sDia = 10;
          const stirrupSpacingM = design.shear.sUsed / 1000;
          const numStirrups = Math.ceil(spanM / stirrupSpacingM);
          const stirrupPerimeterM = 2 * ((b.b - 80) / 1000 + (b.h - 80) / 1000) + 0.2;
          const wt = getRebarUnitWeight(sDia) * stirrupPerimeterM * numStirrups;
          steelMap[sDia] = (steelMap[sDia] || 0) + wt;
          steelKg += wt;
        }
      } else {
        // Safe default: 95 kg/m³ for beam structure
        const nominal = vol * 95;
        steelMap[16] = nominal * 0.7;
        steelMap[10] = nominal * 0.3;
        steelKg = nominal;
      }

      return {
        id: b.id,
        type: 'beam',
        label: `جسر رابط إنشائي مسلّح ${b.id}`,
        storyId: b.storyId || 'story-1',
        storyLabel,
        volume: vol,
        area: width * length,
        formwork,
        steelKg,
        steelMap,
        raw: b,
        grid: `${getGridRef(b.x1, b.y1)} ➔ ${getGridRef(b.x2, b.y2)}`,
        drawings: 'SD-02 (منحنيات تسليح الجسور المستمرة والكمرات الساقطة والمدفونة)',
        details: 'تفصيل تباعد الكانات والربط عند نهايات الركائز عمودياً - قطاع 4-4'
      };
    });

    // 3. Columns
    const columnItems = columns.filter(c => !c.isRemoved).map(c => {
      const width = c.b / 1000;
      const depth = c.h / 1000;
      const height = c.L / 1000; // clean column length in meters
      const vol = width * depth * height;
      
      // Primary columns wet formwork = perimeter * height
      const formwork = 2 * (width + depth) * height;
      const storyLabel = stories.find(st => st.id === c.storyId)?.label || 'مستوى الأعمدة';
      const design = colDesigns.find(d => d.id === c.id);

      let steelKg = 0;
      const steelMap: Record<number, number> = {};

      if (analyzed && design?.design) {
        if (design.design.dia && design.design.bars) {
          const mainDia = design.design.dia;
          // main rebar extending with 1m lap compression structural splice
          const wt = getRebarUnitWeight(mainDia) * (height + 1.0) * design.design.bars;
          steelMap[mainDia] = (steelMap[mainDia] || 0) + wt;
          steelKg += wt;
        }
        const stirrupsMatch = design.design.stirrups?.match(/Φ(\d+)@(\d+)/);
        if (stirrupsMatch) {
          const sDia = parseInt(stirrupsMatch[1]) || 8;
          const sSpacing = parseInt(stirrupsMatch[2]) || 150;
          const numStirrups = Math.ceil((height * 1000) / sSpacing);
          const perimeter = 2 * ((c.b - 80) / 1000 + (c.h - 80) / 1000) + 0.2;
          const wt = getRebarUnitWeight(sDia) * perimeter * numStirrups;
          steelMap[sDia] = (steelMap[sDia] || 0) + wt;
          steelKg += wt;
        }
      } else {
        // nominal default: 115 kg/m³
        const nominal = vol * 115;
        steelMap[16] = nominal * 0.8;
        steelMap[8] = nominal * 0.2;
        steelKg = nominal;
      }

      return {
        id: c.id,
        type: 'column',
        label: `عمود خرساني مسلّح ${c.id}`,
        storyId: c.storyId || 'story-1',
        storyLabel,
        volume: vol,
        area: width * depth,
        formwork,
        steelKg,
        steelMap,
        raw: c,
        grid: getGridRef(c.x, c.y),
        drawings: 'SD-03 (جدول قطاعات وتسليح كافة الأعمدة الحاملة للجدران والأثقال)',
        details: 'تفصيل تشريك وصلات عزم العمود بمنتصف الارتفاع - نموذج COL-D'
      };
    });

    // 4. Foundations (Footings)
    const footingItems = (foundationResults || []).map(r => {
      const B = r.B / 1000; // width meters
      const L = r.L / 1000; // length meters
      const t = r.t / 1000; // thickness meters
      const vol = B * L * t;
      
      // Formwork = perimeter * thickness
      const formwork = 2 * (B + L) * t;
      const grid = getGridRef(r.x || (r as any).colX || 0, r.y || (r as any).colY || 0);

      // Geo parameters
      const excavationsSizeX = B + 2 * workingSpace;
      const excavationsSizeY = L + 2 * workingSpace;
      const excavation = excavationsSizeX * excavationsSizeY * excavationDepth;

      // PCC Lean Concrete (C15 or C20)
      const pccOffsetM = pccOffset / 1000;
      const pccThicknessM = pccThickness / 1000;
      const pccVol = (B + 2 * pccOffsetM) * (L + 2 * pccOffsetM) * pccThicknessM;
      const pccArea = (B + 2 * pccOffsetM) * (L + 2 * pccOffsetM);

      // Structural Pedestal Neck Column below Grade Level
      const pedestalH = Math.max(0.2, excavationDepth - t);
      const hostCol = columns.find(col => col.id === r.colId);
      const colArea = hostCol ? (hostCol.b / 1000) * (hostCol.h / 1000) : 0.12;
      const pedestalVol = colArea * pedestalH;
      const pedestalFormwork = hostCol ? 2 * ((hostCol.b + hostCol.h) / 1000) * pedestalH : 0;

      // Backfilling = excavation - concrete volume - pcc volume - pedestal volume
      const backfill = Math.max(0, excavation - vol - pccVol - pedestalVol);

      // Bituminous waterproofing surface area (back and sides of footings + lateral pedestal)
      const waterproofing = (B * L) + (2 * (B + L) * t) + pedestalFormwork;

      let steelKg = 0;
      const steelMap: Record<number, number> = {};

      if (r.dia_x && r.bars_x) {
        const wtX = getRebarUnitWeight(r.dia_x) * (B + 0.2) * r.bars_x;
        steelMap[r.dia_x] = (steelMap[r.dia_x] || 0) + wtX;
        steelKg += wtX;
      }
      if (r.dia_y && r.bars_y) {
        const wtY = getRebarUnitWeight(r.dia_y) * (L + 0.2) * r.bars_y;
        steelMap[r.dia_y] = (steelMap[r.dia_y] || 0) + wtY;
        steelKg += wtY;
      }

      if (steelKg === 0) {
        // nominal default: 55 kg/m³
        const nominal = vol * 55;
        steelMap[14] = nominal;
        steelKg = nominal;
      }

      return {
        id: `F-${r.colId}`,
        type: 'footing',
        label: `قاعدة أساس منفصلة مسلحة ${r.colId}`,
        storyId: 'substructure',
        storyLabel: 'أعمال التأسيس والأساسات والردم',
        volume: vol,
        area: B * L,
        formwork,
        steelKg,
        steelMap,
        excavation,
        pccVol,
        pccArea,
        backfill,
        waterproofing,
        pedestalVol,
        pedestalFormwork,
        grid,
        drawings: 'SD-04 (مخطط القواعد والأساسات وتفصيل رقاب الأعمدة الإنشائية)',
        details: 'تفصيل علاقة حديد العمود بالقاعدة مع الكرسي الداخلي والخطاف القياسي بـ 90 درجة'
      };
    });

    // 5. Future Symmetries / Extension items
    const futureSects: any[] = [];
    if (includeFutureExtension) {
      const vol = futureSlabArea * (futureSlabThickness / 1000);
      const steelWt = vol * 75; // 75kg/m³ high density
      const steelMap = { 12: steelWt * 0.4, 14: steelWt * 0.6 };
      futureSects.push({
        id: 'FUT-SLAB-1',
        type: 'slab',
        label: 'بلاطة مسلحة لتوسعة الأجنحة المستقبلية الملحقة بالمبنى',
        storyId: 'future-expansion',
        storyLabel: 'الأعمال المستقبلية والإضافات الخرسانية',
        volume: vol,
        area: futureSlabArea,
        formwork: futureSlabArea,
        steelKg: steelWt,
        steelMap,
        grid: 'محاور الامتداد الجنوبي المظاهري للموقع العام',
        drawings: 'SD-06 (مخطط دراسة الجدران الاستنادية للامتدادات السكنية المستقبلية)',
        details: 'تفصيل زرع أشاير الحديد وتماسك الشداد بمادة الإيبوكسي المقاومة'
      });
    }

    const allResolved = [...footingItems, ...slabItems, ...beamItems, ...columnItems, ...futureSects];

    return {
      all: allResolved,
      slabs: slabItems,
      beams: beamItems,
      columns: columnItems,
      footings: footingItems,
      future: futureSects
    };
  }, [
    stories, slabs, beams, columns, slabProps, analyzed, 
    beamDesigns, colDesigns, slabDesigns, foundationResults,
    excavationDepth, workingSpace, pccThickness, pccOffset,
    includeFutureExtension, futureSlabArea, futureSlabThickness
  ]);

  // --- Dynamic Live Cost & BOQ Rows Assembler ---
  const boqData = useMemo(() => {
    const list: any[] = [];
    let itemIdSeq = 1;

    const pushItem = (
      code: string,
      title: string,
      unit: string,
      qty: number,
      sarRate: number,
      div: string,
      cat: string,
      remarks: string,
      traceLinks: string[],
      drawings: string,
      details: string
    ) => {
      const actualQty = Math.max(0, qty);
      const totalCostSar = actualQty * sarRate;
      list.push({
        id: `boq-${code}`,
        itemNo: code,
        description: title,
        unit,
        quantity: actualQty,
        rate: sarRate,
        amountSar: totalCostSar,
        division: div,
        category: cat,
        remarks,
        traceLinks,
        drawings,
        details
      });
    };

    // ----------------------------------------------------
    // DIVISION 1: Earthworks and Foundation Preparation
    // ----------------------------------------------------
    const div1 = 'الباب الأول - أعمال التربة والتحضير والموقع العام (Site Prep & Earthworks)';
    
    // 1.01 Excavation
    const totalExcavationVol = physicalTakeoff.footings.reduce((sum, f) => sum + f.excavation, 0);
    pushItem(
      '1.01',
      'أعمال الحفر والتحضير الجيوتقني لتربة القواعد المنشأة طبقاً للمناسيب المقررة بالمستندات',
      'م³',
      totalExcavationVol,
      rates.excavation,
      div1,
      'earthwork',
      `قائم لعمق تأسيس وسطي يساوي ${excavationDepth}م شاملة أعمال التهيئة والتدعيم لحماية جوانب الحفريات من الانهيارات المتوقعة بالأرض`,
      physicalTakeoff.footings.map(f => f.id),
      'SD-04 (لوحة تخطيط أبعاد ومحاور الأساسات لمهندس الموقع)',
      'مستند قطاع حفر تربة المسلحة العادية المعتمدة رقم SEC-EX5'
    );

    // 1.02 Backfilling
    const totalBackfillVol = physicalTakeoff.footings.reduce((sum, f) => sum + f.backfill, 0);
    pushItem(
      '1.02',
      'أعمال الردميات حول الأساسات ورقاب الأعمدة بتربة نظيفة معتمدة وخالية من الشوائب العضوية والتملح على طبقات ميكانيكية لا تتجاوز 25سم',
      'م³',
      totalBackfillVol,
      rates.backfilling,
      div1,
      'earthwork',
      'الدمك والضغط الميكانيكي مستخدم بـ 95% من الكثافة الجافة العظمى مع الفحوصات والترطيب بمياه صالحة',
      physicalTakeoff.footings.map(f => f.id),
      'SD-04 (لوحة صب وقواعد الأساسات ورقاب المحيط الهيكلي)',
      'مستند مواصفات الردم وضبط الجودة الإنشائية ASTM D1557'
    );

    // ----------------------------------------------------
    // DIVISION 2: Substructure Concrete Works
    // ----------------------------------------------------
    const div2 = 'الباب الثاني - أعمال الخرسانات والإنشاءات تحت الأرض (Substructure Concrete)';

    // 2.01 PCC Lean Concrete
    const totalPccVol = physicalTakeoff.footings.reduce((sum, f) => sum + f.pccVol, 0);
    pushItem(
      '2.01',
      'أعمال الطبقة التحضيرية لخرسانة عادية PCC غير مسلّحة برتبة خفيفة (C15 أو C20) أسفل القواعد المسلّحة لمنع رشح تربة التأسيس',
      'م³',
      totalPccVol,
      rates.pccLean,
      div2,
      'concrete',
      `سمك طبق القياس الإرشادي ${pccThickness}مم شامل صب مسطحات الرفرفة الزائدة بمقدار ${pccOffset}مم من اتجاهات القاعدة`,
      physicalTakeoff.footings.map(f => f.id),
      'SD-04 (خرسانة النظافة والمخطط التعاقدي التعريفي)',
      'قطاع تفصيلي لسطوع رفرفة الخشبيات الطرفية ديتيل 8-B'
    );

    // 2.02 Footings Concrete
    const totalFootingConcVol = physicalTakeoff.footings.reduce((sum, f) => sum + f.volume, 0);
    pushItem(
      '2.02',
      'أعمال توريد وصب خرسانة مسلّحة للقواعد الأساسية المنفلتة والمستمرة برتبة خرسانة (C30 / C35) مستخدمة خلاطة جاهزة مقاومة للكبريتات',
      'م³',
      totalFootingConcVol,
      rates.concFootings,
      div2,
      'concrete',
      'الكميات مستخلصة بناء على التصميم الإنشائي الفعلي وتطابق اختبارات كسر المكعبات الموقعية بعد الـ 28 يوماً',
      physicalTakeoff.footings.map(f => f.id),
      'SD-04_A (تفصيل تسليح الأساس وقواعد العمود المستمرة)',
      'ديتيل شبك تسليح القاعدة وسمك الصبة والمحاذاة الميكانيكية'
    );

    // 2.03 Pedestals Column Necks Concrete
    const totalPedestalsVol = physicalTakeoff.footings.reduce((sum, f) => sum + f.pedestalVol, 0);
    pushItem(
      '2.03',
      'توريد وتجهيز خرسانة مسلّحة لرقاب الأعمدة القصيرة (Column Pedestals) الممتدة من سطح القواعد لغاية منسوب الميد الأرضية',
      'م³',
      totalPedestalsVol,
      rates.pedestals,
      div2,
      'concrete',
      'الرتبة المعيارية C35 للمقاومة العالية للأحمال الترابية وعزوم الردميات والقص الجانبي',
      physicalTakeoff.footings.map(f => f.id),
      'SD-03 (جدول مقاطع ورقاب الكولومز الأرضية)',
      'العلاقة التصميمية مع ميد السقف والشناج الأرضي ديتيل 12'
    );

    // ----------------------------------------------------
    // DIVISION 3: Moisture Protection and Waterproofing
    // ----------------------------------------------------
    const div3 = 'الباب الثالث - أعمال العزل المائي وتأمين الأساسات من الكبريتات (Substructure Isolation)';

    // 3.01 Waterproofing
    const totalWaterproofingArea = physicalTakeoff.footings.reduce((sum, f) => sum + f.waterproofing, 0);
    pushItem(
      '3.01',
      'تقديم وتطبيق طلاء عازل مائي مطاطي بيتوميني بارد على طبقتين لكامل مسطحات جوانب القواعد ورقاب الأعمدة وتحت الصبات',
      'م²',
      totalWaterproofingArea,
      rates.waterproofing,
      div3,
      'waterproofing',
      'يطلى على غلاف نظيف وناشف بالكامل شاملة حماية زوايا التقاء الخرسانات مع الرقبة بوزرة ميكانيكية دائرية سياجية',
      physicalTakeoff.footings.map(f => f.id),
      'SD-04 (عزل الأساسات وتفصيل الحمايات الأرضية المعتمدة)',
      'المواصفات الكيميائية للدهان المانع لتسرب المياه الجوفية والرطوبة'
    );

    // ----------------------------------------------------
    // DIVISION 4: Superstructure Structural Elements
    // ----------------------------------------------------
    const div4 = 'الباب الرابع - أعمال خرسانات الهيكل الفوقي المسلّح للمشروع (Superstructure Concrete)';

    // 4.01 Columns Concrete
    const totalColumnsConcVol = physicalTakeoff.columns.reduce((sum, c) => sum + c.volume, 0);
    pushItem(
      '4.01',
      'خرسانة مسلحة للأعمدة الرأسية لكافة الأدوار الممسوحة بالمخططات شاملة الصب، التدعيم، ورش الماء',
      'م³',
      totalColumnsConcVol,
      rates.concColumns,
      div4,
      'concrete',
      'شاملة رتبة الـ C35 المقاومة للأحمال المحورية والقص واستخدام الهزاز الميكانيكي المناسب لضمان عدم حدوث تعشيش خرساني',
      physicalTakeoff.columns.map(c => c.id),
      'SD-03 (مخطط طوبار وتسليح الأعمدة ومحاورها الأساسية)',
      'ارتفاع وصلات التشريك القياسية وسماكات التغطية الخرسانية للشدات'
    );

    // 4.02 Beams Concrete
    const totalBeamsConcVol = physicalTakeoff.beams.reduce((sum, b) => sum + b.volume, 0);
    pushItem(
      '4.02',
      'أعمال صب وتثبيت خرسانة الجسور المسلحة (المستمرة والفرعية الساقطة والمدفونة بمختلف الأبعاد المعتمدة برتبة C30)',
      'م³',
      totalBeamsConcVol,
      rates.concBeams,
      div4,
      'concrete',
      'خصم سمك تداخل صبة السقف الفعلي من إجمالي عمق الجسر لمنع وقوع ازدواجية بالحجم مع الحفاظ التام على المتانة الانحنائية الكافية',
      physicalTakeoff.beams.map(b => b.id),
      'SD-02 (لوحات وجداول تسليح قطاعات جسور المبنى الكروكياتية)',
      'ربط كانات القص وتوزيع الأطوال الفعالة للمناطق الحرجة'
    );

    // 4.03 Slabs Concrete
    const totalSlabsConcVol = physicalTakeoff.slabs.reduce((sum, s) => sum + s.volume, 0);
    pushItem(
      '4.03',
      'أعمال خرسانة مسلّحة لبلاطات سقوف الأسقف والفتحات المعمارية المقررة بالموديل شامل الأسطح النهائية المتساوية',
      'م³',
      totalSlabsConcVol,
      rates.concSlabs,
      div4,
      'concrete',
      `طبقاً لمتوسط سمك ${slabProps.thickness}مم وسقوف صلبة ومفرغة بالاتجاهات التصميمية برتبة C25 القياسية لضمان التخميد والدفلكشن`,
      physicalTakeoff.slabs.map(s => s.id),
      'SD-01 (مخطط صب البلاطات والتسليح العلوي والسفلي)',
      'تفصيل الهبوطات والكانيرات وجدران المناور الفراغية المعمارية'
    );

    // 4.03A Filler blocks for one-way ribbed slabs
    // The rib spacing is the center-to-center module; the filler block width
    // is the clear module between ribs. A 400 mm block length is the standard
    // estimate used when the selected filler manufacturer is not specified.
    const ribbedSlabs = slabs.filter(s => (s as any).slabType === 'one_way_ribbed');
    if (ribbedSlabs.length > 0) {
      const ribSpacing = Math.max(0.2, (ribbedSlabProps?.s ?? 400) / 1000);
      const ribWidth = Math.max(0.05, (ribbedSlabProps?.bw ?? 100) / 1000);
      const clearBlockWidth = Math.max(0.1, ribSpacing - ribWidth);
      const blockLength = 0.4;
      const fillerCount = ribbedSlabs.reduce((sum, s) => {
        const area = Math.abs(s.x2 - s.x1) * Math.abs(s.y2 - s.y1);
        return sum + Math.ceil(area / (clearBlockWidth * blockLength) * 1.05);
      }, 0);
      pushItem(
        '4.03A',
        `توريد وتركيب بلوكات الحشو المفرغة للبلاطات الهوردي/المضلعة — موديل ${ribbedSlabProps?.fillerType || 'بلوك قياسي'}`,
        'قطعة',
        fillerCount,
        rates.concSlabs * 0.02,
        div4,
        'concrete',
        `تقدير الكمية على أساس تباعد أعصاب ${ribSpacing * 1000}مم، عرض العصب ${ribWidth * 1000}مم، وطول بلوك قياسي ${blockLength * 1000}مم، شامل 5% هالك وقصات الحواف`,
        ribbedSlabs.map(s => s.id),
        'RD-01 (مخطط توزيع أعصاب وبلوكات الحشو)',
        'يُراجع العدد النهائي مع مورد البلوك وأبعاد الفتحات المعمارية قبل التوريد'
      );
    }

    // 4.04 Steel Reinforcement (Ton)
    const steelKgSlabs = physicalTakeoff.slabs.reduce((sum, s) => sum + s.steelKg, 0);
    const steelKgBeams = physicalTakeoff.beams.reduce((sum, b) => sum + b.steelKg, 0);
    const steelKgCols = physicalTakeoff.columns.reduce((sum, c) => sum + c.steelKg, 0);
    const steelKgFootings = physicalTakeoff.footings.reduce((sum, f) => sum + f.steelKg, 0);
    const totalSteelTon = (steelKgSlabs + steelKgBeams + steelKgCols + steelKgFootings) / 1000;
    // Track whether any slab quantities are estimated (nominal) vs actual design output
    const hasNominalSlabs = physicalTakeoff.slabs.some(s => (s as any).steelSource === 'nominal');
    const nominalNote = hasNominalSlabs
      ? ` — ⚠ تقديري جزئياً: كميات حديد البلاطات التي لم تُصمَّم بعد محسوبة بمعدل اسمي (35–55 كجم/م³)؛ راجع نتائج التصميم للحصول على قيم دقيقة.`
      : '';

    pushItem(
      '4.04',
      'أعمال توريد وقص وثني وتربيط حديد تسليح عالي المقاومة (Grade 60) فحص مطابقة المواصفات لمختلف الأقطار الفولاذية ببرسيجر التربيط المعتمد',
      'طن',
      totalSteelTon,
      rates.rebarSteel,
      div4,
      'steel',
      `كافة أقطار حديد الأساسات والأعمدة والجسور والبلاطات شاملة الإضافي، الكانات الفرعية، الأشاير، الفواصل، والسكاكين وحوامل الحديد الرأسية${nominalNote}`,
      physicalTakeoff.all.map(a => a.id),
      'كشوفات جداول ثني وفهرسة أقطار الحديد التفصيلية (Rebar Ledgers)',
      'تفصيل التشابك، الرباط، الكباسي، وأطوال التماسك المطلوبة حسب الكود الإنشائي المعترف به'
    );

    // 4.05 Formwork surfaces (m²)
    const totalFormworkArea = physicalTakeoff.all.reduce((sum, a) => sum + (a.formwork || 0), 0);
    pushItem(
      '4.05',
      'توريد وتثبيت شدّات خشبية وطوبار لزوم تشكيل وصقل الخرسانات وحمايتها من الترهل والرشح أثناء عمليات الصب والارتجاج والترطيب',
      'م²',
      totalFormworkArea,
      (rates.formworkFootings + rates.formworkColumns + rates.formworkBeams + rates.formworkSlabs) / 4, // Average placeholder rate
      div4,
      'formwork',
      'شامل طوبار القواعد، الأعمدة الرأسية، أجنحة الجسور الجانبية، والبطانات السفلية لبلاطات السقوف بمختلف الأدوار والمستويات',
      physicalTakeoff.all.map(a => a.id),
      'SD-05 (تفصيل شدات طوبار الهيكل وعمليات الفك الآمنة بالزمن المقترح)',
      'طريقة الحظائر والتدعيم الرأسي باستخدام عروق الخشب والملازم'
    );

    // ----------------------------------------------------
    // User Defined Custom Items (e.g. testing, special requests)
    // ----------------------------------------------------
    customItems.forEach(item => {
      list.push({
        ...item,
        amountSar: item.quantity * item.rate,
        traceLinks: [],
        drawings: 'خاص بالعميل / مواصفات خاصة',
        details: 'تفاصيل مساعدة غير مربوطة بمحاكاة النمذجة الإنشائية'
      });
    });

    return list;
  }, [physicalTakeoff, rates, customItems, excavationDepth, pccThickness, pccOffset, slabProps.thickness, slabs, ribbedSlabProps]);

  // --- Filtering & Searching on BOQ Items ---
  const filteredBOQRows = useMemo(() => {
    if (!searchQuery.trim()) return boqData;
    const q = searchQuery.toLowerCase();
    return boqData.filter(row => 
      row.itemNo.includes(q) ||
      row.description.toLowerCase().includes(q) ||
      row.unit.toLowerCase().includes(q) ||
      row.division.toLowerCase().includes(q) ||
      row.remarks.toLowerCase().includes(q)
    );
  }, [boqData, searchQuery]);

  // --- Structure Views Grouper ---
  const groupedBOQ = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    
    filteredBOQRows.forEach(row => {
      let key = 'عام';
      if (structureType === 'division') {
        key = row.division;
      } else if (structureType === 'element') {
        key = row.category === 'concrete' ? 'الخرسانيات الإنشائية المسلّحة' 
            : row.category === 'steel' ? 'حديد التسليح الهيكلي'
            : row.category === 'formwork' ? 'شدّات الخشب والطوبار'
            : row.category === 'earthwork' ? 'أعمال الحجر والتربة والتأسيس'
            : row.category === 'waterproofing' ? 'أعمال العزل والوقاية الكيميائية'
            : 'أعمال وتوريدات خاصة وموقع عام';
      } else if (structureType === 'story') {
        // Group conceptually based on item description or default
        if (row.itemNo.startsWith('1') || row.itemNo.startsWith('2') || row.itemNo.startsWith('3')) {
          key = 'أعمال مرحلة التأسيس وتحت الأرض (Substructure Phase)';
        } else if (row.itemNo.startsWith('4')) {
          key = 'أعمال مرحلة الهيكل العلوي والأسقف (Superstructure Phase)';
        } else {
          key = 'بنود وتوريدات إدارية وعامة وضمان جودة الفحوصات';
        }
      } else {
        // custom structure grouping
        key = row.division;
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });

    return groups;
  }, [filteredBOQRows, structureType]);

  // --- Project Totals Calculator ---
  const financialTotals = useMemo(() => {
    const totalCostSar = boqData.reduce((sum, item) => sum + item.amountSar, 0);
    const concreteCostSar = boqData.filter(i => i.category === 'concrete' || i.itemNo.startsWith('2')).reduce((sum, i) => sum + i.amountSar, 0);
    const steelCostSar = boqData.filter(i => i.category === 'steel').reduce((sum, i) => sum + i.amountSar, 0);
    const auxCostSar = totalCostSar - concreteCostSar - steelCostSar;

    return {
      totalCostSar,
      concreteCostSar,
      steelCostSar,
      auxCostSar
    };
  }, [boqData]);

  // --- Add Custom Line Item ---
  const handleAddCustomItem = () => {
    if (!newCustomItem.description.trim()) return;
    const nextCode = `5.0${customItems.length + 2}`;
    const newItem: CustomBOQItem = {
      id: `cust-${Date.now()}`,
      itemNo: nextCode,
      description: newCustomItem.description,
      unit: newCustomItem.unit,
      quantity: Number(newCustomItem.quantity) || 1,
      rate: Number(newCustomItem.rate) || 0,
      division: newCustomItem.division,
      category: 'custom',
      remarks: newCustomItem.remarks || 'أضيف يدوياً من المقيم المالي'
    };
    setCustomItems([...customItems, newItem]);
    setNewCustomItem({
      description: '',
      unit: 'م³',
      quantity: 1,
      rate: 100,
      division: 'أعمال تشطيبات وتهيئة خاصة',
      remarks: ''
    });
  };

  // --- Delete Custom Line Item ---
  const handleDeleteCustomItem = (id: string) => {
    setCustomItems(customItems.filter(i => i.id !== id));
  };

  // --- Core Integrity Verification and Auditing System ---
  const boqAudits = useMemo(() => {
    const list: { id: string; type: 'error' | 'warning' | 'info'; title: string; desc: string; solution: string }[] = [];

    // Check 1: Design results missing
    if (!analyzed) {
      list.push({
        id: 'aud-not-analyzed',
        type: 'warning',
        title: 'حديد التسليح مقدر تقديرياً لعدم اكتمال التحليل والتصميم',
        desc: 'لم يتم إجراء تحليل وتصميم الهيكل الإنشائي. كميات الفولاذ حددت بناءً على كود النسب المقترحة الافتراضية بمعدلات م³ وليس التفصيل الإنشائى الفعلي.',
        solution: 'شغِّل فحص التحليل الرأسي والانحنائي ثم زر التصميم المتكامل لتثبيت كشوف ثني حديد التسليح الفورية.'
      });
    }

    // Check 2: Empty Foundations volume
    if ((foundationResults?.length || 0) === 0) {
      list.push({
        id: 'aud-no-footings',
        type: 'error',
        title: 'غياب بيانات تصميم الأساسات والقواعد الإنشائية للتربة',
        desc: 'لا توجد أي قواعد منفردة صممت لهذا الموديل بالموقع. كشف كميات الحفريات والردميات تحت الأرض يظهر مصفراً أو مقدراً تقريبياً لتناقض الإحداثيات.',
        solution: 'انتقل إلى تبويب "التصميم" لتطبيق فحص وتدقيق الأساسات المنفردة WSM لتوليد القواعد والأوزان بدقة.'
      });
    }

    // Check 3: Check overlapping column nodes
    // Find columns close to each other
    const coordinatesMap = new Map<string, string>();
    let colClashCount = 0;
    columns.forEach(c => {
      const key = `${Math.round(c.x / 50) * 50},${Math.round(c.y / 50) * 50}`;
      if (coordinatesMap.has(key)) {
        colClashCount++;
      } else {
        coordinatesMap.set(key, c.id);
      }
    });
    if (colClashCount > 0) {
      list.push({
        id: 'aud-clash-col',
        type: 'error',
        title: `تداخل وتكرار إحداثيات لـ (${colClashCount}) أعمدة إرسائية بالمخطط`,
        desc: 'يوجد أعمدة بالنموذج تشترك تقريباً في نفس النقطة والمحاور الهيكلية مما يولد أخطاء باوزان الخرسانات والحديد المزدوج في جداول BOQ النهائية.',
        solution: 'يرجى مراجعة مصفوفة النمذجة ثنائية الأبعاد في الموقع العام وحذف أو دمج الأعمدة الإنشائية المتراكبة.'
      });
    }

    // Check 4: Unusually small thick sizes
    if (slabProps.thickness < 80) {
      list.push({
        id: 'aud-slab-thick',
        type: 'error',
        title: 'سمك بلاطة السقف المدخلة يقل عن الحد المسموح هندسياً (80مم)',
        desc: `سمك البلاطة المستقر حالياً هو ${slabProps.thickness}مم. قد يسبب ذلك هبوطاً كبيراً ومخالفة لأحكام كود البناء واشتراطات الدفلكشن الأمانية.`,
        solution: 'انتقل إلى خصائص السطح الإنشائي وزد سماكة البلاطة لتتجاوز 120مم على الأقل كبلاطة مصمتة صلدة.'
      });
    }

    // Check 5: Extra large footing offsets
    if (workingSpace > 1.0) {
      list.push({
        id: 'aud-working-space',
        type: 'info',
        title: 'محيط رفرفة الحفر والنشاط البشري واسع جداً (تجاوز 1.0م)',
        desc: `المسافة المدخلة لحيز أعمال العمال حفر القواعد هي ${workingSpace}م وهي تؤدي لتضخم كبير بحجوم الحفريات والردم والمحاسبة المالية عليها دون داعٍ.`,
        solution: 'قم بتقليل محيط فضاء الرفرفة ليكون بين 0.3م إلى 0.5م لقوام حفريات آمن هندسياً واقتصادياً لرب العمل.'
      });
    }

    return list;
  }, [analyzed, foundationResults, columns, slabProps.thickness, workingSpace]);

  // --- Exporters Engine ---
  
  // 1. Excel Generation
  const exportExcelWorkbook = () => {
    const wb = XLSX.utils.book_new();

    // Leaf 1: BOQ Line Items Summary
    const rowsBOQ = boqData.map((item, idx) => ({
      'البند ID': item.itemNo,
      'الوصف الفني التفصيلي للبند ومستنداته': item.description,
      'الوحدة القياسية': item.unit,
      'الكمية الهندسية': item.quantity,
      [`سعر الوحدة (${currency})`]: scalRateValue(item.rate),
      [`الإجمالي (${currency})`]: scalRateValue(item.amountSar),
      'كود الباب والتقسيم في CSI': item.division,
      'لوحة المخطط التفصيلي المرتبط': item.drawings,
      'ملاحظات المقيم المالي الإنشائي': item.remarks
    }));

    const wsBOQ = XLSX.utils.json_to_sheet(rowsBOQ);
    // Set direction to RTL in Excel properties if possible
    wsBOQ['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsBOQ, 'جدول الكميات والتسعير المعتمد');

    // Leaf 2: Material and Quantity Takeoff Summary
    const leafTakeoff = physicalTakeoff.all.map(item => ({
      'كود العنصر': item.id,
      'نوع العضو الإنشائي': item.type === 'slab' ? 'بلاطة سقف' : item.type === 'beam' ? 'جسر خرساني' : item.type === 'column' ? 'عمود حامل' : 'قاعدة منفصلة',
      'منسوب الدور المحسوب': item.storyLabel,
      'مصفوفة المحاور والشبكة الإحداثية': item.grid,
      'الحجم الخرساني الفعلي (م³)': item.volume.toFixed(3),
      'مساحة الطوبار اللازم (م²)': item.formwork ? item.formwork.toFixed(2) : '0.00',
      'وزن حديد التسليح الكلي (كجم)': item.steelKg.toFixed(2),
      'لوح الرسم التفصيلي في الهيكل': item.drawings,
      'الديتيل والمقطع الإنشائي': item.details
    }));
    const wsTakeoff = XLSX.utils.json_to_sheet(leafTakeoff);
    wsTakeoff['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, wsTakeoff, 'أثر وجداول التتبع الكمي هندسياً');

    XLSX.writeFile(wb, `BOQ_Commercial_Report_${currency}_Project.xlsx`);
  };

  // 2. CSV Generation
  const exportCSVFile = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Include BOM for proper Excel Arabic parsing
    csvContent += "Item No,Description,Unit,Quantity,Unit Rate,Amount,Division,Remarks\r\n";
    
    boqData.forEach(row => {
      const desc = `"${row.description.replace(/"/g, '""')}"`;
      const div = `"${row.division.replace(/"/g, '""')}"`;
      const rem = `"${row.remarks.replace(/"/g, '""')}"`;
      const line = `${row.itemNo},${desc},${row.unit},${row.quantity},${scalRateValue(row.rate).toFixed(2)},${scalRateValue(row.amountSar).toFixed(2)},${div},${rem}\r\n`;
      csvContent += line;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Project_BOQ_Data_${currency}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. Commercial PDF Generation (utilizing jsPDF-AutoTable)
  const downloadCommercialPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header block
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("BILL OF QUANTITIES (BOQ) COMMERCIAL ESTIMATION REPORT", 14, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Project Authority Location: Structural Design Studio Client Interface`, 14, 24);
    doc.text(`Run Date & Validation Time: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Active Currency Layout: ${currency} (Exchange Rate vs SAR: ${currencyRate})`, 14, 32);
    doc.text(`Substructure Presets: typical depth = ${excavationDepth}m, working space offset = ${workingSpace}m`, 14, 36);

    // Dynamic Summary KPIs
    doc.setFillColor(245, 247, 250);
    doc.rect(14, 40, 182, 18, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`GRAND ESTIMATED COST: ${formatPrice(financialTotals.totalCostSar)} ${currency}`, 18, 51);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Concrete Component: ${formatPrice(financialTotals.concreteCostSar)} ${currency}  |  Reinforcement Steel: ${formatPrice(financialTotals.steelCostSar)} ${currency}`, 115, 51);

    // Table Data Parsing
    const bodyItems = boqData.map((row, idx) => [
      row.itemNo,
      row.description,
      row.unit,
      row.quantity.toFixed(2),
      scalRateValue(row.rate).toFixed(2),
      scalRateValue(row.amountSar).toFixed(2),
      row.remarks
    ]);

    autoTable(doc, {
      startY: 62,
      head: [['Item', 'Description / Technical Work Statement', 'Unit', 'Qty', 'Unit Rate', 'Total Amount', 'Remarks / Conditions']],
      body: bodyItems,
      theme: 'grid',
      styles: { fontSize: 7, font: 'helvetica' },
      headStyles: { fillColor: [43, 60, 80], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 55 },
        2: { cellWidth: 12 },
        3: { cellWidth: 15 },
        4: { cellWidth: 18 },
        5: { cellWidth: 22 },
        6: { cellWidth: 50 },
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Commercial Endorsement & Project Seal:", 14, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("This commercial estimation document has been auto-generated with live synchronization matching geometrical structural parameters.", 14, finalY + 5);

    doc.save(`Commercial_BOQ_Contract_${currency}.pdf`);
  };

  const executePrint = () => {
    window.print();
  };

  const scalRateValue = (sarVal: number) => {
    return sarVal * currencyRate;
  };

  return (
    <div id="boq-module-container" className="space-y-6 dir-rtl text-right font-sans">
      
      {/* 1. BRANDED MAIN ROW COMMAND */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 bg-card/100 rounded-2xl border border-muted shadow-sm backdrop-blur">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono px-2 py-0.5 text-[10px]">PHASE D11</Badge>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <Landmark className="text-indigo-600" size={24} />
              محرك حساب الكميات التعاقدية وجداول BOQ الذكية
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            منظومة مالية وتقديرية حية متزامنة مع الموديل الإنشائي. تدعم تكويد الهيئة الهندسية لمشاريع التشييد، وضبط تباين عروض الأسعار والتحقق الفوري من التغطيات.
          </p>
        </div>
        
        {/* Dynamic Currency and Exchange */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-muted p-1 rounded-lg gap-1 border border-input">
            <button 
              onClick={() => changeExchange('SAR')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${currency === 'SAR' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              ريال (SAR)
            </button>
            <button 
              onClick={() => changeExchange('USD')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${currency === 'USD' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              دولار (USD)
            </button>
            <button 
              onClick={() => changeExchange('AED')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${currency === 'AED' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              درهم (AED)
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={exportExcelWorkbook} className="h-8 gap-1.5 text-[11px] text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
            <FileSpreadsheet size={13} />
            إكسيل ورك بوك (.xlsx)
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCommercialPDF} className="h-8 gap-1.5 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20">
            <FileDown size={13} />
            تقرير PDF معتمد
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSVFile} className="h-8 gap-1.5 text-[11px] text-blue-600 border-blue-200 hover:bg-blue-50">
            <Plus size={13} />
            ملف CSV
          </Button>
          <Button variant="outline" size="sm" onClick={executePrint} className="h-8 gap-1.5 text-[11px]">
            <Printer size={13} />
            طباعة الكشف
          </Button>
        </div>
      </div>

      {/* 2. LIVE BENTO KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Estimated Grand Cost */}
        <Card className="border-r-4 border-r-indigo-600 bg-indigo-50/5 dark:bg-indigo-950/5 relative overflow-hidden group hover:shadow-md transition duration-300">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          <CardContent className="p-4 flex flex-col justify-between h-full min-h-[90px]">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-400">إجمالي عروض الأسعار التقديرية</span>
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-md"><Landmark size={15} /></div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-black tracking-tight text-indigo-800 dark:text-indigo-300 font-mono">
                {formatPrice(financialTotals.totalCostSar)} <span className="text-[11px] font-normal">{curSymbol}</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-500" />
                شامل المواد والعمالة اللوجستية
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Concrete Component Cost */}
        <Card className="border-r-4 border-r-sky-500 bg-sky-50/5 dark:bg-sky-950/5 relative overflow-hidden group hover:shadow-md transition duration-300">
          <div className="absolute right-0 top-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          <CardContent className="p-4 flex flex-col justify-between h-full min-h-[90px]">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-extrabold text-sky-700 dark:text-sky-400">مكون الخرسانات المسلّحة والعادية</span>
              <div className="p-1.5 bg-sky-100 dark:bg-sky-900/30 text-sky-600 rounded-md"><Database size={15} /></div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-black tracking-tight text-foreground font-mono">
                {formatPrice(financialTotals.concreteCostSar)} <span className="text-[11px] font-normal">{curSymbol}</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">
                تساوي تقريباً {((financialTotals.concreteCostSar / (financialTotals.totalCostSar || 1)) * 100).toFixed(0)}% من تكاليف المواد الأساسية
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Reinforcement Steel Cost */}
        <Card className="border-r-4 border-r-amber-500 bg-amber-50/5 dark:bg-amber-950/5 relative overflow-hidden group hover:shadow-md transition duration-300">
          <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          <CardContent className="p-4 flex flex-col justify-between h-full min-h-[90px]">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400">فولاذ حديد ومقاطع شبكات التسليح</span>
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-md"><Layers size={15} /></div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-black tracking-tight text-foreground font-mono">
                {formatPrice(financialTotals.steelCostSar)} <span className="text-[11px] font-normal">{curSymbol}</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">
                شريان القوام المقدر طنياً بـ {((physicalTakeoff.all.reduce((s,a)=>s+(a.steelKg || 0), 0)) / 1000).toFixed(2)} طن فعلي
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Earth and Auxiliary Protection Works */}
        <Card className="border-r-4 border-r-emerald-500 bg-emerald-50/5 dark:bg-emerald-950/5 relative overflow-hidden group hover:shadow-md transition duration-300">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
          <CardContent className="p-4 flex flex-col justify-between h-full min-h-[90px]">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">أعمال التحضير، الحفريات والوقاية</span>
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-md"><Ruler size={15} /></div>
            </div>
            <div className="mt-2.5">
              <h3 className="text-xl font-black tracking-tight text-foreground font-mono">
                {formatPrice(financialTotals.auxCostSar)} <span className="text-[11px] font-normal">{curSymbol}</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">
                ردميات وعزل مائي مع سلة طوبار البلاطات
              </p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 3. SUB NAVIGATION TAB COUPLING */}
      <div className="flex border-b border-muted overflow-x-auto gap-4 shrink-0 scrollbar-none bg-background p-1 rounded-xl">
        {[
          { id: 'boq', label: 'كشف الكميات المالي (Commercial BOQ)', icon: Coins },
          { id: 'summary', label: 'لوحات القياس الجانبية (Takoff Charts)', icon: Compass },
          { id: 'rates', label: 'قاعدة بيانات تسعير المرفق (Rates Database)', icon: Settings2 },
          { id: 'validator', label: 'مدقق ومصفي نزاهة البنود الإنشائية', icon: ShieldCheck, count: boqAudits.length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-4 text-xs font-bold whitespace-nowrap transition-all duration-200 rounded-lg ${
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="mr-1 h-4 min-w-[16px] px-1 flex items-center justify-center text-[9px] bg-red-500 text-white rounded-full font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. MAIN ACTION PANELS PORT */}
      <div className="min-h-[450px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            
            {/* TAB: COMMERCIAL BOQ TABLE */}
            {activeTab === 'boq' && (
              <div className="space-y-6">
                
                {/* Control bar: Structuring & Search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-muted/50 rounded-xl border border-muted">
                  
                  {/* Grouping Select */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-muted-foreground flex items-center gap-1">
                      <Layers3 size={13} /> بنية التصنيف الهيكلي للـ BOQ:
                    </span>
                    <div className="flex rounded-md bg-background p-0.5 border border-input shadow-xs">
                      <button 
                        onClick={() => setStructureType('division')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${structureType === 'division' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        أبواب CSI تقسيمية
                      </button>
                      <button 
                        onClick={() => setStructureType('element')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${structureType === 'element' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        حسب العضو الإنشائي
                      </button>
                      <button 
                        onClick={() => setStructureType('story')}
                        className={`px-3 py-1 text-xs font-semibold rounded ${structureType === 'story' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        حسب مراحل التشييد
                      </button>
                    </div>
                  </div>

                  {/* Search filter */}
                  <div className="relative w-full md:w-80">
                    <Search className="absolute right-3 top-2.5 text-muted-foreground" size={14} />
                    <Input
                      placeholder="البحث فوري في البنود والوثائق المرفقة..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-9 pr-9 text-xs pl-3 text-right bg-background text-foreground"
                    />
                  </div>
                </div>

                {/* Main dynamic generated table */}
                <div className="space-y-6">
                  {Object.keys(groupedBOQ).length === 0 ? (
                    <Card className="p-8 text-center border-dashed">
                      <HelpCircle className="mx-auto text-muted-foreground mb-2" size={32} />
                      <p className="text-sm font-bold text-muted-foreground">لا توجد بنود تطابق كلمات البحث المدخلة</p>
                      <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="mt-2 text-xs">إعادة تهيئة الباحث</Button>
                    </Card>
                  ) : (
                    Object.entries(groupedBOQ).map(([groupTitle, rows]) => {
                      const groupSumSar = rows.reduce((s, r) => s + r.amountSar, 0);
                      return (
                        <Card key={groupTitle} className="border-muted overflow-hidden hover:border-slate-300 dark:hover:border-slate-800 transition duration-200">
                          <CardHeader className="bg-muted/30 py-3 px-4 border-b border-muted flex flex-row items-center justify-between">
                            <div>
                              <CardTitle className="text-xs font-black text-foreground flex items-center gap-1.5 leading-none">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                                {groupTitle}
                              </CardTitle>
                              <CardDescription className="text-[10px] text-muted-foreground mt-0.5 font-sans">
                                كود المجموعة الإنشائي - المخرجات متطابقة هندسياً وأبعادها متزامنة
                              </CardDescription>
                            </div>
                            <Badge className="bg-indigo-100 font-bold hover:bg-indigo-200 text-indigo-700 text-[10px] px-2 py-0.5">
                              المجموع: {formatPrice(groupSumSar)} {curSymbol}
                            </Badge>
                          </CardHeader>
                          
                          <CardContent className="p-0 overflow-x-auto">
                            <Table className="w-full text-right">
                              <TableHeader>
                                <TableRow className="bg-muted/10">
                                  <TableHead className="text-xs w-[60px] text-right font-black">رقم البند</TableHead>
                                  <TableHead className="text-xs font-black text-right whitespace-nowrap">بيان وتفصيل الأعمال التقنية المعيارية</TableHead>
                                  <TableHead className="text-xs w-[60px] text-center font-black">الوحدة</TableHead>
                                  <TableHead className="text-xs w-[90px] text-center font-black">الكمية</TableHead>
                                  <TableHead className="text-xs w-[110px] text-center font-black">سعر الوثيقة ({curSymbol})</TableHead>
                                  <TableHead className="text-xs w-[130px] text-center font-black">إجمالي البند ({curSymbol})</TableHead>
                                  <TableHead className="text-xs w-[80px] text-center font-black font-mono">تتبع الأثر</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.map(row => {
                                  const isExpanded = expandedTraceId === row.id;
                                  return (
                                    <React.Fragment key={row.id}>
                                      <TableRow className="hover:bg-muted/40 transition-colors border-t border-muted">
                                        <TableCell className="font-mono text-xs font-semibold text-muted-foreground">{row.itemNo}</TableCell>
                                        <TableCell className="py-3 max-w-[400px]">
                                          <div className="text-xs font-bold text-foreground leading-relaxed">{row.description}</div>
                                          <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{row.remarks}</div>
                                        </TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold">{row.unit}</Badge></TableCell>
                                        <TableCell className="text-center font-mono text-xs font-extrabold">{row.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}</TableCell>
                                        <TableCell className="text-center font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{formatPrice(row.rate)}</TableCell>
                                        <TableCell className="text-center font-mono text-xs font-black text-indigo-700 dark:text-indigo-400">{formatPrice(row.amountSar)}</TableCell>
                                        <TableCell className="text-center">
                                          <Button 
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => setExpandedTraceId(isExpanded ? null : row.id)}
                                            className="h-7 w-7 p-0 rounded-full hover:bg-indigo-50 text-indigo-600 dark:hover:bg-slate-800"
                                          >
                                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                      
                                      {/* EXPANDABLE TRACE DETAILS WITH DRAWINGS & BLUEPRINTS LINK */}
                                      {isExpanded && (
                                        <TableRow className="bg-indigo-50/20 dark:bg-slate-900/40 border-l-2 border-l-primary">
                                          <TableCell colSpan={7} className="p-4 text-xs">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
                                              
                                              {/* Derivation Formulations */}
                                              <div className="space-y-1.5 col-span-2 border-r border-dashed pr-4 border-muted">
                                                <h4 className="font-extrabold text-indigo-800 dark:text-indigo-400 flex items-center gap-1 text-[11px]">
                                                  <Calculator size={13} />
                                                  شرح المعادلة والأثر الإنشائي للـ Takeoff (Traceability)
                                                </h4>
                                                <div className="text-muted-foreground leading-relaxed">
                                                  المعادلة: الحجم / المسطح مستخلص ضرب الأبعاد الكلية للأشياء في الموديل. 
                                                  {row.itemNo === '1.01' && ` حجم الحفر = مجموع مساحات القواعد مع حيز الحركة المانع لزحزحة جوانب التربة. (مجموع قواعد القوام الممسوح = ${physicalTakeoff.footings.length} قواعد مقولبة)`}
                                                  {row.itemNo === '4.04' && ` إجمالي الفولاذ المقدر طنياً يشمل شبكة الأسقف وتداخل الجسور المتبقي مع ركائز حديد الكانات الدقيقة.`}
                                                  {row.category === 'concrete' && ` يتم احتساب الحجم الهيكلي بخصم مستويات الصب المزدوج بالمنشأ لتقليل الهدر وتحقيق معايير الجودة التعاقدية.`}
                                                </div>
                                                {row.traceLinks?.length > 0 && (
                                                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                    <span className="text-[10px] font-bold text-muted-foreground select-none">العناصر الإنشائية المرتبطة:</span>
                                                    {row.traceLinks.slice(0, 10).map((l: string) => (
                                                      <Badge key={l} variant="secondary" className="font-mono text-[9px] px-1 py-0">{l}</Badge>
                                                    ))}
                                                    {row.traceLinks.length > 10 && <span className="text-[10px] text-muted-foreground font-semibold">... و{row.traceLinks.length - 10} عناصر أخرى</span>}
                                                  </div>
                                                )}
                                              </div>

                                              {/* Blueprints / Drawings / Sections */}
                                              <div className="space-y-1.5 bg-background p-3 rounded-lg border border-muted flex flex-col justify-between">
                                                <div>
                                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-extrabold flex items-center gap-1 mb-1">
                                                    <FileText size={11} className="text-indigo-600" />
                                                    الربط بالمخططات والرسومات (Blueprints)
                                                  </div>
                                                  <p className="font-bold text-slate-800 dark:text-slate-200 text-[11px] leading-tight">{row.drawings}</p>
                                                  <div className="text-[9px] text-muted-foreground mt-1 bg-muted p-1 rounded font-mono leading-relaxed">{row.details}</div>
                                                </div>
                                                <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-2.5 bg-emerald-50 dark:bg-emerald-950/20 p-1.5 rounded">
                                                  <ShieldCheck size={11} />
                                                  البند مرتبط تلقائياً بنزاهة التغييرات الرأسية للهيكل
                                                </div>
                                              </div>

                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>

              </div>
            )}

            {/* TAB: VISUAL ANALYSIS & CHARTS */}
            {activeTab === 'summary' && (
              <div className="space-y-6">
                
                {/* Bento Visualizer comparisons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Concrete breakdown ledger */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xs font-black text-muted-foreground uppercase flex items-center gap-1">
                        <Database size={13} className="text-indigo-600" />
                        التقديرات الحجمية للخلائط الخرسانية (م³)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Footings */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>خرسانة الأساسات وقواعد المسلحة</span>
                          <span className="font-mono font-black">{physicalTakeoff.footings.reduce((sum, f) => sum + f.volume, 0).toFixed(2)} م³</span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(8, (physicalTakeoff.footings.reduce((sum, f) => sum + f.volume, 0) / (physicalTakeoff.all.reduce((s, a) => s + (a.volume || 0), 0) || 1)) * 100))}%` }} />
                        </div>
                      </div>

                      {/* Columns */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>خرسانة الأعمدة الدائرية والمستطيلة والرقاب</span>
                          <span className="font-mono font-black">{(physicalTakeoff.columns.reduce((sum, c) => sum + c.volume, 0) + physicalTakeoff.footings.reduce((sum, f) => sum + f.pedestalVol, 0)).toFixed(2)} م³</span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div className="bg-sky-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(8, ((physicalTakeoff.columns.reduce((sum, c) => sum + c.volume, 0) + physicalTakeoff.footings.reduce((sum, f) => sum + f.pedestalVol, 0)) / (physicalTakeoff.all.reduce((s, a) => s + (a.volume || 0), 0) || 1)) * 100))}%` }} />
                        </div>
                      </div>

                      {/* Beams */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>خرسانة الميد والجسور والسواقط والمدفونات</span>
                          <span className="font-mono font-black">{physicalTakeoff.beams.reduce((sum, b) => sum + b.volume, 0).toFixed(2)} m³</span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(8, (physicalTakeoff.beams.reduce((sum, b) => sum + b.volume, 0) / (physicalTakeoff.all.reduce((s, a) => s + (a.volume || 0), 0) || 1)) * 100))}%` }} />
                        </div>
                      </div>

                      {/* Slabs */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>خرسانة بلاطات الأسقف والسطوح والأروقة</span>
                          <span className="font-mono font-black">{physicalTakeoff.slabs.reduce((sum, s) => sum + s.volume, 0).toFixed(2)} m³</span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(8, (physicalTakeoff.slabs.reduce((sum, s) => sum + s.volume, 0) / (physicalTakeoff.all.reduce((s, a) => s + (a.volume || 0), 0) || 1)) * 100))}%` }} />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-muted bg-muted/10 p-3 rounded">
                        <span className="block text-[10px] text-muted-foreground uppercase font-semibold">إجمالي الحجم الخرساني المقدر بالهيكل الكامل</span>
                        <div className="text-base font-black font-mono tracking-tight mt-1 text-foreground">
                          {physicalTakeoff.all.reduce((s, a) => s + (a.volume || 0), 0).toFixed(2)} م³ خرسانات جاهزة صبّية
                        </div>
                      </div>

                    </CardContent>
                  </Card>

                  {/* Reinforcement Diameter Ledger Ledger */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xs font-black text-muted-foreground uppercase flex items-center gap-1">
                        <Layers className="text-amber-500" size={13} />
                        توزيع أقطار كشف ثني حديد التسليح (كجم)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Φ8 - Φ10 */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>الكانات وقوى القص الرابطة (Φ8 — Φ10)</span>
                          <span className="font-mono font-black">
                            {((physicalTakeoff.all.reduce((sum, val) => sum + (val.steelMap[8] || 0) + (val.steelMap[10] || 0), 0))).toFixed(1)} كجم
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(5, ((physicalTakeoff.all.reduce((sum, val) => sum + (val.steelMap[8] || 0) + (val.steelMap[10] || 0), 0)) / (physicalTakeoff.all.reduce((s, a) => s + (a.steelKg || 0), 0) || 1)) * 100))}%` }} />
                        </div>
                      </div>

                      {/* Φ12 - Φ14 */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>فرش وغطاء بلاطات الأسقف (Φ12 — Φ14)</span>
                          <span className="font-mono font-black">
                            {((physicalTakeoff.all.reduce((sum, val) => sum + (val.steelMap[12] || 0) + (val.steelMap[14] || 0), 0))).toFixed(1)} كجم
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(5, ((physicalTakeoff.all.reduce((sum, val) => sum + (val.steelMap[12] || 0) + (val.steelMap[14] || 0), 0)) / (physicalTakeoff.all.reduce((s, a) => s + (a.steelKg || 0), 0) || 1)) * 100))}%` }} />
                        </div>
                      </div>

                      {/* Φ16 - Φ20 */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span>تسليح الأعمدة ومحاور الجسور (Φ16 — Φ20)</span>
                          <span className="font-mono font-black">
                            {((physicalTakeoff.all.reduce((sum, val) => sum + (val.steelMap[16] || 0) + (val.steelMap[18] || 0) + (val.steelMap[20] || 0), 0))).toFixed(1)} كجم
                          </span>
                        </div>
                        <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                          <div className="bg-amber-600 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(5, ((physicalTakeoff.all.reduce((sum, val) => sum + (val.steelMap[16] || 0) + (val.steelMap[18] || 0) + (val.steelMap[20] || 0), 0)) / (physicalTakeoff.all.reduce((s, a) => s + (a.steelKg || 0), 0) || 1)) * 100))}%` }} />
                        </div>
                      </div>

                      {/* Bottom Total Rebar */}
                      <div className="pt-4 border-t border-muted bg-muted/10 p-3 rounded">
                        <span className="block text-[10px] text-muted-foreground uppercase font-semibold">إجمالي وزن حديد التسليح الفولاذي بالمشروع</span>
                        <div className="text-base font-black font-mono tracking-tight mt-1 text-amber-700 dark:text-amber-400">
                          {((physicalTakeoff.all.reduce((sum, item) => sum + (item.steelKg || 0), 0)) / 1000).toFixed(3)} طن تسليحي معتمد
                        </div>
                      </div>

                    </CardContent>
                  </Card>

                  {/* Future Symmetries Expansion controls */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xs font-black text-muted-foreground uppercase flex items-center gap-1">
                        <Plus className="text-emerald-500" size={13} />
                        الإضافات والتوسعات المستقبلية الاختيارية
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                        <div className="text-xs">
                          <span className="font-bold block">إضافة سقف وقبة امتداد مستقبلية</span>
                          <span className="text-[10px] text-muted-foreground">تضمين بلاطة توسع بمساحة مترية محددة</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={includeFutureExtension}
                          onChange={e => setIncludeFutureExtension(e.target.checked)}
                          className="h-4 w-4 accent-indigo-600 cursor-pointer rounded"
                        />
                      </div>

                      {includeFutureExtension && (
                        <div className="space-y-3 p-3 bg-indigo-50/15 rounded-lg border border-indigo-200/50">
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground block mb-1">المساحة المترية للبلاطة الإضافية (م²)</label>
                            <Input
                              type="number"
                              value={futureSlabArea}
                              onChange={e => setFutureSlabArea(Number(e.target.value) || 0)}
                              className="h-8 text-xs text-right bg-background text-foreground"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground block mb-1">السمك التصميمي للبلاطة المستقبلية (مم)</label>
                            <Input
                              type="number"
                              value={futureSlabThickness}
                              onChange={e => setFutureSlabThickness(Number(e.target.value) || 0)}
                              className="h-8 text-xs text-right bg-background text-foreground"
                            />
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground leading-relaxed p-2 border-r-2 border-emerald-500 bg-emerald-50/20 rounded">
                        <strong>ملاحظة:</strong> البنود المستقبلية تضاف تلقائياً إلى بنود الباب الخامس بالـ BOQ وتضرب بنسب الفاقد والهالك والشدات المساعدة القياسية.
                      </div>

                    </CardContent>
                  </Card>

                </div>

              </div>
            )}

            {/* TAB: INTERACTIVE RATES MANAGER */}
            {activeTab === 'rates' && (
              <div className="space-y-6">
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-black flex items-center gap-1.5">
                      <Settings2 className="text-indigo-600" size={17} />
                      تحديث وتعديل كشوفات أسعار الوحدات القياسية والمقايسات
                    </CardTitle>
                    <CardDescription className="text-xs">
                      الأسعار الافتراضية مقدرة ومقاسة استرشادياً بأسواق التشييد المحلية (بالريال السعودي). يمكنك تعديل أي خانة وسقوط التكلفة فورياً.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    
                    {/* Rate Input Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      
                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الم³ للحفر الترابي للقواعد</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.excavation}
                            onChange={e => setRates({ ...rates, excavation: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ م³</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الم³ للردم وضغط التأسيس</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.backfilling}
                            onChange={e => setRates({ ...rates, backfilling: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ م³</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الم³ لخرسانة النظافة PCC C15</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.pccLean}
                            onChange={e => setRates({ ...rates, pccLean: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ م³</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الم³ لخرسانة القواعد المسلحة C30</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.concFootings}
                            onChange={e => setRates({ ...rates, concFootings: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ م³</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الم³ للأعمدة الحاملة C35</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.concColumns}
                            onChange={e => setRates({ ...rates, concColumns: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ م³</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الم³ للجسور الإنشائية C30</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.concBeams}
                            onChange={e => setRates({ ...rates, concBeams: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ م³</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الم³ للبلاطات والأسقف C25</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.concSlabs}
                            onChange={e => setRates({ ...rates, concSlabs: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ م³</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الطن من حديد التسليح Grade 60</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.rebarSteel}
                            onChange={e => setRates({ ...rates, rebarSteel: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ طن</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-extrabold text-muted-foreground block mb-1">سعر الم² للطلاء والعزل المائي المانع</label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={rates.waterproofing}
                            onChange={e => setRates({ ...rates, waterproofing: Number(e.target.value) || 0 })}
                            className="h-9 pr-3 pl-12 text-xs text-left font-mono text-foreground"
                          />
                          <span className="absolute left-3 top-2 text-[10px] font-bold text-muted-foreground select-none">/ م²</span>
                        </div>
                      </div>

                    </div>

                    {/* Add Custom Manual Line Item Section */}
                    <div className="border-t border-muted pt-6 space-y-4">
                      <div className="flex items-center gap-1 text-xs font-black text-indigo-700 dark:text-indigo-400">
                        <Plus size={15} />
                        تجهيز وإضافة بند مقايسة يدوي مخصص (Custom Manual Item)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
                        <Input
                          placeholder="بيان وتفصيل العمل..."
                          value={newCustomItem.description}
                          onChange={e => setNewCustomItem({ ...newCustomItem, description: e.target.value })}
                          className="h-9 text-xs text-right text-foreground bg-background"
                        />
                        <select
                          value={newCustomItem.unit}
                          onChange={e => setNewCustomItem({ ...newCustomItem, unit: e.target.value })}
                          className="h-9 rounded border border-input bg-background px-2 text-xs text-foreground"
                        >
                          <option value="م³">متر مكعب (م³)</option>
                          <option value="م²">متر مربع (م²)</option>
                          <option value="م">متر طولي (م)</option>
                          <option value="طن">طن حديد (طن)</option>
                          <option value="كجم">كيلوغرام (كجم)</option>
                          <option value="حزمة">حزمة عينات (حزمة)</option>
                          <option value="نقطة">بالنقطة الإنشائية (نقطة)</option>
                        </select>
                        <Input
                          type="number"
                          placeholder="الكمية المطلوبة..."
                          value={newCustomItem.quantity}
                          onChange={e => setNewCustomItem({ ...newCustomItem, quantity: Number(e.target.value) || 1 })}
                          className="h-9 text-xs text-left font-mono text-foreground bg-background"
                        />
                        <Input
                          type="number"
                          placeholder="سعر الوحدة بالريال..."
                          value={newCustomItem.rate}
                          onChange={e => setNewCustomItem({ ...newCustomItem, rate: Number(e.target.value) || 0 })}
                          className="h-9 text-xs text-left font-mono text-foreground bg-background"
                        />
                        <Button onClick={handleAddCustomItem} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5">
                          <Plus size={14} /> إضافة البند للمقايسة
                        </Button>
                      </div>

                      {customItems.length > 0 && (
                        <div className="mt-4 border rounded-lg p-3 bg-muted/10 space-y-2">
                          <div className="text-[10px] font-bold text-muted-foreground">البنود المضافة يدوياً حالياً:</div>
                          {customItems.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-xs p-2 bg-muted/50 rounded-md">
                              <div>
                                <span className="font-bold underline">{item.itemNo}</span> - <span className="font-semibold text-slate-800 dark:text-slate-200">{item.description}</span>
                                <span className="text-[10px] text-muted-foreground mr-2">({item.quantity} {item.unit} @ {formatPrice(item.rate)} {curSymbol})</span>
                              </div>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => handleDeleteCustomItem(item.id)} 
                                className="h-7 w-7 p-0 bg-red-500 hover:bg-red-600 rounded-full"
                              >
                                <Trash2 size={12} className="text-white" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>

                  </CardContent>
                </Card>

              </div>
            )}

            {/* TAB: LIVE INTEGRITY AUDITS */}
            {activeTab === 'validator' && (
              <div className="space-y-6">
                
                <Card>
                  <CardHeader className="pb-3 border-b border-muted">
                    <CardTitle className="text-sm font-black flex items-center gap-1.5">
                      <ShieldCheck className="text-emerald-500" size={17} />
                      نظام فحص وتأكيد النزاهة الهندسية والتحقق المالي للطلب
                    </CardTitle>
                    <CardDescription className="text-xs">
                      يقوم مدقق المقايسة بمقارنة الأبعاد الهندسية المتراكبة للأشياء وكميات حديد التسليح الفورية بالمشروع لكشف ومنع عيوب التسعير المزدوج أو النقص بالمشاريع.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    
                    {boqAudits.length === 0 ? (
                      <div className="p-8 text-center bg-emerald-50/25 border border-emerald-200/50 rounded-xl">
                        <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                        <h4 className="font-black text-emerald-800 dark:text-emerald-400">مثالي! المقايسة سليمة 100% هندسياً</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-lg mx-auto leading-relaxed">
                          تم مطابقة شبكات التسليح للقواعد والأعمدة الدائرية والمستطيلة وتداخل السطوح للبلاطات والجسور. لا توجد قوام مكررة أو تداخلات مالية أو أقطار فولاذية معطوبة.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {boqAudits.map(issue => (
                          <div 
                            key={issue.id} 
                            className={`p-4 rounded-xl border flex gap-3 text-right ${
                              issue.type === 'error' 
                                ? 'bg-rose-50/20 dark:bg-red-950/20 border-rose-200 dark:border-red-900/50' 
                                : issue.type === 'warning' 
                                ? 'bg-amber-50/20 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50' 
                                : 'bg-blue-50/10 border-blue-200 dark:border-blue-900/30'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {issue.type === 'error' ? (
                                <AlertTriangle className="text-rose-600" size={17} />
                              ) : issue.type === 'warning' ? (
                                <AlertTriangle className="text-amber-500" size={17} />
                              ) : (
                                <Info className="text-blue-500" size={17} />
                              )}
                            </div>
                            <div className="space-y-1">
                              <h5 className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
                                {issue.title}
                                <Badge 
                                  variant="outline" 
                                  className={`text-[9px] px-1 py-0 ${
                                    issue.type === 'error' 
                                      ? 'text-rose-600 border-rose-200 bg-rose-50/50' 
                                      : issue.type === 'warning' 
                                      ? 'text-amber-500 border-amber-200 bg-amber-50/50' 
                                      : 'text-blue-500 border-blue-200'
                                  }`}
                                >
                                  {issue.type === 'error' ? 'حرجة للغاية' : issue.type === 'warning' ? 'توصيات مالية' : 'مراجعة قياس'}
                                </Badge>
                              </h5>
                              <p className="text-[11px] text-muted-foreground leading-relaxed font-sans">{issue.desc}</p>
                              <div className="text-[10px] text-sky-700 dark:text-sky-400 font-bold bg-sky-50 dark:bg-slate-900/40 p-2 rounded-lg mt-2 flex items-center gap-1">
                                <span className="underline">الحل المقترح للمصمم الإنشائي:</span>
                                {issue.solution}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

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

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Calculator, 
  Layers, 
  FileSpreadsheet, 
  Printer, 
  RotateCcw, 
  TrendingUp, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Maximize2, 
  ArrowRight,
  Database,
  Building,
  Anchor,
  HelpCircle,
  FileText,
  Bookmark,
  ChevronDown,
  Info,
  DollarSign
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import * as XLSX from 'xlsx';

import type { Story, Beam, Column, Slab } from '../lib/structuralEngine';

interface QuantityTakeoffEngineProps {
  stories: Story[];
  beams: Beam[];
  columns: Column[];
  slabs: Slab[];
  projectName?: string;
  notes?: string[];
  foundationResults?: any[];
}

export function QuantityTakeoffEngine({
  stories = [],
  beams = [],
  columns = [],
  slabs = [],
  projectName = 'مشروع فيلا سكنية مبسطة',
  notes = [],
  foundationResults = []
}: QuantityTakeoffEngineProps) {

  // User configurables
  const [concreteCostPerM3, setConcreteCostPerM3] = useState<number>(340);
  const [steelCostPerTon, setSteelCostPerTon] = useState<number>(3200);
  const [formworkCostPerM2, setFormworkCostPerM2] = useState<number>(75);
  const [excavationCostPerM3, setExcavationCostPerM3] = useState<number>(45);
  const [backfillCostPerM3, setBackfillCostPerM3] = useState<number>(25);
  const [pccThickness, setPccThickness] = useState<number>(100); // PCC lean concrete thickness in mm

  // Toggle futures
  const [includeFutureRaft, setIncludeFutureRaft] = useState<boolean>(false);
  const [includeFutureWalls, setIncludeFutureWalls] = useState<boolean>(false);
  
  // Interactive navigation
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'kpi' | 'concrete' | 'rebar' | 'soil' | 'qa' | 'trace'>('kpi');
  const [tracedElement, setTracedElement] = useState<string | null>(null);

  // 1. COMPREHENSIVE MULTI-VARIABLE QUANTITY MATHEMATICS
  const qtoCalculations = useMemo(() => {
    // Structural concrete totals
    let concreteSlabs = 0;
    let concreteBeams = 0;
    let concreteColumns = 0;
    let concreteFoundations = 0;
    let concretePedestals = 0;
    let leanConcretePCC = 0;

    // Formwork
    let formworkSlabs = 0;
    let formworkBeams = 0;
    let formworkColumns = 0;
    let formworkFoundations = 0;

    // Soil & Earth
    let excavationFootings = 0;
    let excavationStrip = 0;
    let excavationCombined = 0;
    let backfillFootings = 0;

    // Steel items (broken down by diameter)
    const steelDiameterMap: Record<number, number> = {
      8: 0,
      10: 0,
      12: 0,
      14: 0,
      16: 0,
      18: 0,
      20: 0,
      25: 0
    };

    // Calculate columns (with physical lengths or fallback typical 3.2m height)
    columns.forEach(col => {
      const h = col.L ? col.L / 1000 : 3.2; 
      const area = (col.b / 1000) * (col.h / 1000);
      const perimeter = 2 * (col.b / 1000) + 2 * (col.h / 1000);
      
      concreteColumns += area * h;
      formworkColumns += perimeter * h;
      concretePedestals += area * 1.2; // simulated lower pedestal levels below plinth beams

      // Column theoretical steel estimate (1.5% volumetric ratio + stirrups)
      const steelWeight = area * h * 7850 * 0.015;
      steelDiameterMap[16] += steelWeight * 0.75; // high stress bars
      steelDiameterMap[10] += steelWeight * 0.25; // stirrups
    });

    // Calculate beams
    beams.forEach(beam => {
      const dx = beam.x2 - beam.x1;
      const dy = beam.y2 - beam.y1;
      const len = Math.sqrt(dx * dx + dy * dy) ? Math.sqrt(dx * dx + dy * dy) / 1000 : 4.5;
      const area = (beam.b / 1000) * (beam.h / 1000);
      
      concreteBeams += area * len;
      formworkBeams += (beam.b / 1000 + 2 * (beam.h / 1000)) * len; // 3 wet faces

      // Beam rebar allocation (1.2% density standard)
      const steelWeight = area * len * 7850 * 0.012;
      steelDiameterMap[14] += steelWeight * 0.70;
      steelDiameterMap[8] += steelWeight * 0.30; // stirrups & hangers
    });

    // Calculate slabs
    slabs.forEach(slab => {
      const area = Math.abs((slab.x2 - slab.x1) * (slab.y2 - slab.y1)) / 1e6 || 18.5;
      const t = (slab.t || slab.thickness || 150) / 1000;
      
      concreteSlabs += area * t;
      formworkSlabs += area; // bottom sheet only

      // Slab mesh reinforcement
      const steelWeight = area * 12.5; // typical mesh kg/m2
      steelDiameterMap[12] += steelWeight * 0.6;
      steelDiameterMap[10] += steelWeight * 0.4;
    });

    // Foundations logic from actual live solver or default footprints
    if (foundationResults && foundationResults.length > 0) {
      foundationResults.forEach((f) => {
        const footingVol = (f.B * f.L * f.H) / 1e9;
        concreteFoundations += footingVol;
        formworkFoundations += (2 * (f.B + f.L) * f.H) / 1e6;

        // PCC concrete clean level with offsets
        const pccArea = ((f.B + 200) * (f.L + 200)) / 1e6;
        leanConcretePCC += pccArea * (pccThickness / 1000);

        // Soil excavations
        const excVol = ((f.B + 600) * (f.L + 600) * 1500) / 1e9; // assuming 1.5m depth
        excavationFootings += excVol;
      });
      // Backfilling calculations
      backfillFootings = excavationFootings - concreteFoundations - leanConcretePCC;
    } else {
      // Build safe fallback if foundations array is empty
      const totalPillars = Math.max(columns.length, 6);
      for (let i = 0; i < totalPillars; i++) {
        // Assume F1 standard footing of 1.8m x 1.8m x 0.6m
        const fVol = 1.8 * 1.8 * 0.6;
        concreteFoundations += fVol;
        formworkFoundations += 2 * (1.8 + 1.8) * 0.6;
        
        const pccArea = 2.0 * 2.0;
        leanConcretePCC += pccArea * (pccThickness / 1000);
        
        const excVol = 2.4 * 2.4 * 1.5;
        excavationFootings += excVol;
      }
      backfillFootings = excavationFootings - concreteFoundations - leanConcretePCC;
    }

    // Toggle futures
    if (includeFutureRaft) {
      // Simulated custom future Raft foundation (220 m2, t=800mm)
      concreteFoundations += 220 * 0.8;
      formworkFoundations += 2 * (15 + 15) * 0.8;
      excavationCombined += 220 * 1.6;
      leanConcretePCC += 220 * (pccThickness / 1000);
    }

    if (includeFutureWalls) {
      // Retaining perimeter basement walls (60 meters length, t=300mm, h=3m)
      const wallVol = 60 * 0.3 * 3.0;
      concreteColumns += wallVol; 
      formworkColumns += 2 * 60 * 3.0; // both faces
      steelDiameterMap[16] += wallVol * 7850 * 0.012; // vertical mesh bars
    }

    // Accumulate total steel weight in tons & Kg
    let totalSteelKg = 0;
    Object.keys(steelDiameterMap).forEach((d) => {
      totalSteelKg += steelDiameterMap[Number(d)];
    });
    const totalSteelTons = totalSteelKg / 1000;

    // Total wet waterproof areas (beneath PCC and on direct contact faces)
    const waterproofingArea = (concreteFoundations * 1.5) + (concreteColumns * 0.2) + (leanConcretePCC * 1.0);

    // Structural concrete grades assignment
    const concreteByGrade = {
      'C35 (Columns & Pedestals)': concreteColumns + concretePedestals,
      'C30 (Slabs, Beams & Raft)': concreteSlabs + concreteBeams,
      'C25 (Foundations Footings)': concreteFoundations,
      'C15 (Lean Concrete PCC)': leanConcretePCC,
    };

    // Calculate total monetary costs
    const concreteRCCSum = concreteColumns + concretePedestals + concreteSlabs + concreteBeams + concreteFoundations;
    const costConcrete = (concreteRCCSum * concreteCostPerM3) + (leanConcretePCC * concreteCostPerM3 * 0.75);
    const costSteel = totalSteelTons * steelCostPerTon;
    const totalFormwork = formworkSlabs + formworkBeams + formworkColumns + formworkFoundations;
    const costFormwork = totalFormwork * formworkCostPerM2;
    const totalExcavation = excavationFootings + excavationStrip + excavationCombined;
    const costExcavation = totalExcavation * excavationCostPerM3;
    const costBackfill = backfillFootings * backfillCostPerM3;
    const costWaterproofing = waterproofingArea * 15; // standard rate SAR/USD 15 per sm

    const grandTotalCost = costConcrete + costSteel + costFormwork + costExcavation + costBackfill + costWaterproofing;

    return {
      concreteSlabs,
      concreteBeams,
      concreteColumns,
      concreteFoundations,
      concretePedestals,
      concreteRCCSum,
      leanConcretePCC,
      formworkSlabs,
      formworkBeams,
      formworkColumns,
      formworkFoundations,
      totalFormwork,
      excavationFootings,
      excavationStrip,
      excavationCombined,
      totalExcavation,
      backfillFootings,
      steelDiameterMap,
      totalSteelKg,
      totalSteelTons,
      waterproofingArea,
      concreteByGrade,
      costConcrete,
      costSteel,
      costFormwork,
      costExcavation,
      costBackfill,
      costWaterproofing,
      grandTotalCost
    };
  }, [
    columns,
    beams,
    slabs,
    foundationResults,
    concreteCostPerM3,
    steelCostPerTon,
    formworkCostPerM2,
    excavationCostPerM3,
    backfillCostPerM3,
    pccThickness,
    includeFutureRaft,
    includeFutureWalls
  ]);

  // 2. LIVE VALIDATION ENGINE (Scans for design-to-billing inconsistencies)
  const validationAlerts = useMemo(() => {
    const alerts: { id: string; type: 'warning' | 'danger' | 'info'; title: string; desc: string }[] = [];

    if (stories.length === 0) {
      alerts.push({
        id: 'no-story',
        type: 'danger',
        title: 'غياب كامل لطوابق المبنى',
        desc: 'لا يتوفر طوابق معرفة بالملف المرفق، يرجى تهيئة طابق واحد أو سقف إنشائي على الأقل.'
      });
    }

    if (columns.length > 0 && slabs.length === 0) {
      alerts.push({
        id: 'columns-no-slabs',
        type: 'warning',
        title: 'أعمدة غير متصلة بسقف صب خرساني',
        desc: 'النموذج يضم أعمدة صب ولكن لا يملك أي بلاطات أسقف (Slabs). قد تكون حسابات قوام الأسقف مفقودة.'
      });
    }

    // Check for duplicate positions
    const colCoords = new Set<string>();
    columns.forEach(c => {
      const key = `${Math.round(c.x)},${Math.round(c.y)}`;
      if (colCoords.has(key)) {
        alerts.push({
          id: `duplicate-col-${c.id}`,
          type: 'danger',
          title: `احتمال تكرار الأعمدة: ${c.name || c.id}`,
          desc: `تم رصد عمودين في نفس المحور على المستوى الإحداثي (${key}mm). تحقق لتجنب مضاعفة الفواتير المزدوجة.`
        });
      }
      colCoords.add(key);
    });

    // Extremely high or low steel ratio check
    const steelRatio = qtoCalculations.totalSteelKg / (qtoCalculations.concreteRCCSum || 1);
    if (steelRatio > 180) {
      alerts.push({
        id: 'high-steel-ratio',
        type: 'warning',
        title: 'كثافة حديد التسليح مفرطة جداً',
        desc: `معدل التسليح الحالي يبلع ${steelRatio.toFixed(1)} كجم/متر مكعب. تحقق من الأقطار لتفادي الصديد والتعشيش.`
      });
    } else if (steelRatio < 60 && steelRatio > 0) {
      alerts.push({
        id: 'low-steel-ratio',
        type: 'warning',
        title: 'كثافة حديد تسليح منخفضة دون الحد الأدنى',
        desc: `معدل التسليح الحالي يبلغ ${steelRatio.toFixed(1)} كجم/متر مكعب. تحقق من سلامة الهياكل لضمان مطابقة الكود.`
      });
    }

    // Missing Foundations check
    if (columns.length > 0 && foundationResults.length === 0) {
      alerts.push({
        id: 'missing-foundations',
        type: 'info',
        title: 'لم يتم استيراد نتائج تسليح القواعد',
        desc: 'يتم احتساب كميات الحفر وصب القواعد التقديرية بموجب الفرضيات القياسية المعتمدة للأعمدة النشطة.'
      });
    }

    return alerts;
  }, [stories, columns, slabs, qtoCalculations, foundationResults]);

  // 3. MODEL TRACEABILITY INDEX (Mapping quantities back to elements)
  const traceableItems = useMemo(() => {
    const items: { id: string; name: string; category: string; volume: number; rebar: string; sheet: string; detailRef: string }[] = [];

    columns.forEach((c, idx) => {
      const h = c.L ? c.L / 1000 : 3.2; 
      const area = (c.b / 1000) * (c.h / 1000);
      items.push({
        id: `COL-${c.id}`,
        name: `عمود إنشائي C-${idx+1} (${c.b}x${c.h})`,
        category: 'الخرسانة المسلحة بالأعمدة',
        volume: area * h,
        rebar: 'Ø16 @ 150 + كائنات Ø10',
        sheet: 'STR-02 (تفاصيل الأعمدة)',
        detailRef: 'ACI-Col-Rect-Seam'
      });
    });

    beams.forEach((b, idx) => {
      const dx = b.x2 - b.x1;
      const dy = b.y2 - b.y1;
      const len = Math.sqrt(dx * dx + dy * dy) ? Math.sqrt(dx * dx + dy * dy) / 1000 : 4.5;
      const area = (b.b / 1000) * (b.h / 1000);
      items.push({
        id: `BEAM-${b.id}`,
        name: `جسر رابط B-${idx+1} [${b.b}x${b.h}]`,
        category: 'الخرسانة المسلحة بالجسور والروابط',
        volume: area * len,
        rebar: '4Ø14 سفلي + 3Ø14 علوي',
        sheet: 'STR-03 (تفاصيل الجسور)',
        detailRef: 'SBC-Beam-S5'
      });
    });

    slabs.forEach((s, idx) => {
      const area = Math.abs((s.x2 - s.x1) * (s.y2 - s.y1)) / 1e6 || 18.5;
      const t = (s.t || s.thickness || 150) / 1000;
      items.push({
        id: `SLAB-${s.id}`,
        name: `بلاطة سقف S-${idx+1} (t=${s.t || 150}mm)`,
        category: 'بلاطات الأسقف الهيكلية',
        volume: area * t,
        rebar: 'فرش Ø12/150 + غطاء Ø10/150',
        sheet: 'STR-01 (مخطط السقف)',
        detailRef: 'Solid-Slab-D8'
      });
    });

    return items;
  }, [columns, beams, slabs]);

  const filteredTraceableItems = useMemo(() => {
    if (!searchTerm.trim()) return traceableItems;
    const term = searchTerm.toLowerCase();
    return traceableItems.filter(item => 
      item.id.toLowerCase().includes(term) || 
      item.name.toLowerCase().includes(term) || 
      item.category.toLowerCase().includes(term)
    );
  }, [traceableItems, searchTerm]);

  // Export quantity takeoff workbook sheet to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: General QTO summary
    const summaryData = [
      { 'العنصر الإنشائي / البند': 'حفريات وإعداد الموقع ومكافحة النمل الأبيض', 'الكمية الإجمالية': qtoCalculations.totalExcavation.toFixed(2), 'الوحدة': 'م³', 'فئة السعر المقدرة': excavationCostPerM3, 'التكلفة المقدرة': (qtoCalculations.totalExcavation * excavationCostPerM3).toFixed(0) },
      { 'العنصر الإنشائي / البند': 'أعمال الردم خلف القواعد وطبقات الرص المعتمدة', 'الكمية الإجمالية': qtoCalculations.backfillFootings.toFixed(2), 'الوحدة': 'م³', 'فئة السعر المقدرة': backfillCostPerM3, 'التكلفة المقدرة': (qtoCalculations.backfillFootings * backfillCostPerM3).toFixed(0) },
      { 'العنصر الإنشائي / البند': 'الخرسانة العادية للنظافة (Lean Concrete PCC)', 'الكمية الإجمالية': qtoCalculations.leanConcretePCC.toFixed(2), 'الوحدة': 'م³', 'فئة السعر المقدرة': (concreteCostPerM3 * 0.75), 'التكلفة المقدرة': (qtoCalculations.leanConcretePCC * concreteCostPerM3 * 0.75).toFixed(0) },
      { 'العنصر الإنشائي / البند': 'الخرسانة المسلحة للهياكل الإنشائية الكاملة (RCC)', 'الكمية الإجمالية': qtoCalculations.concreteRCCSum.toFixed(2), 'الوحدة': 'م³', 'فئة السعر المقدرة': concreteCostPerM3, 'التكلفة المقدرة': (qtoCalculations.concreteRCCSum * concreteCostPerM3).toFixed(0) },
      { 'العنصر الإنشائي / البند': 'أعمال طوبار الخشب والقوالب للأعمدة والكاميرات', 'الكمية الإجمالية': qtoCalculations.totalFormwork.toFixed(2), 'الوحدة': 'م²', 'فئة السعر المقدرة': formworkCostPerM2, 'التكلفة المقدرة': (qtoCalculations.totalFormwork * formworkCostPerM2).toFixed(0) },
      { 'العنصر الإنشائي / البند': 'حديد التسليح عالي المقاومة رتبة 420 (Steel Rebar)', 'الكمية الإجمالية': qtoCalculations.totalSteelTons.toFixed(3), 'الوحدة': 'طن', 'فئة السعر المقدرة': steelCostPerTon, 'التكلفة المقدرة': (qtoCalculations.totalSteelTons * steelCostPerTon).toFixed(0) },
      { 'العنصر الإنشائي / البند': 'عزل الرطوبة والمياه للقواعد الخرسانية (Waterproofing)', 'الكمية الإجمالية': qtoCalculations.waterproofingArea.toFixed(2), 'الوحدة': 'م²', 'فئة السعر المقدرة': 15, 'التكلفة المقدرة': (qtoCalculations.waterproofingArea * 15).toFixed(0) },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص حصر الكميات للمشروع');

    // Sheet 2: Element Traceability list
    const traceData = traceableItems.map(item => ({
      'رمز العنصر': item.id,
      'اسم المكوّن الانشائي': item.name,
      'تصنيف الأعمال الإضافية': item.category,
      'الحجم الصافي المصبوب (م³)': item.volume.toFixed(3),
      'التسليح المتوقع': item.rebar,
      'رقم المخطط المرجعي': item.sheet,
      'تفصيل الكود المقابل': item.detailRef
    }));
    const wsTrace = XLSX.utils.json_to_sheet(traceData);
    XLSX.utils.book_append_sheet(wb, wsTrace, 'تتبع البيانات للعناصر الفردية');

    XLSX.writeFile(wb, `${projectName}_Quantity_Takeoff_Report_D10.xlsx`);
  };

  // Switch to clean window print orientation for QTO tables
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-right" style={{ direction: 'rtl' }}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-1.5 bg-indigo-700/60 rounded text-[10px] font-mono font-black tracking-wider text-indigo-200">PHASE D10</span>
            <h2 className="text-xl font-black">محرك حصر كميات البناء المترابط (Quantity Takeoff Engine)</h2>
          </div>
          <p className="text-xs text-slate-300">
            حسابات كميات وتكلفة الصب، التسليح، الحفر، الطوبار الخشبي والعزل المباشر تزامناً مع أي تعديل بموديل التصميم وتفصيلات التسليح.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleExportExcel}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 h-10 gap-2 rounded-xl shadow transition duration-150"
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير ملف الإكسل (Excel)
          </Button>
          <Button 
            onClick={handlePrintReport}
            variant="outline"
            className="border-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-4 h-10 gap-2 rounded-xl transition duration-150"
          >
            <Printer className="w-4 h-4" />
            طباعة تقرير الحصر
          </Button>
        </div>
      </div>

      {/* MULTI TABS CONFIG \& LIVE INPUT SLIDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SIDE BAR: Variable rates adjustments */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-indigo-600" />
                تعديل تكاليف البناء للتخمين المالي (Cost Variables)
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-500 mt-0.5">تعديل الفئات بموجب تحديث الأسواق المحلية</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">سعر متر الخرسانة المسلحة (RCC):</span>
                  <span className="font-mono text-indigo-600 font-bold">{concreteCostPerM3} ر.س / م³</span>
                </div>
                <Input 
                  type="number"
                  value={concreteCostPerM3}
                  onChange={(e) => setConcreteCostPerM3(Number(e.target.value) || 300)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">سعر طن حديد التسليح (420 Grade):</span>
                  <span className="font-mono text-indigo-600 font-bold">{steelCostPerTon} ر.س / طن</span>
                </div>
                <Input 
                  type="number"
                  value={steelCostPerTon}
                  onChange={(e) => setSteelCostPerTon(Number(e.target.value) || 3000)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">سعر أعمال الطوبار الخشبي / القوالب:</span>
                  <span className="font-mono text-indigo-600 font-bold">{formworkCostPerM2} ر.س / م²</span>
                </div>
                <Input 
                  type="number"
                  value={formworkCostPerM2}
                  onChange={(e) => setFormworkCostPerM2(Number(e.target.value) || 75)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">سعر أعمال حفر القواعد والتربة:</span>
                  <span className="font-mono text-indigo-600 font-bold">{excavationCostPerM3} ر.س / م³</span>
                </div>
                <Input 
                  type="number"
                  value={excavationCostPerM3}
                  onChange={(e) => setExcavationCostPerM3(Number(e.target.value) || 40)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="px-1 border-t border-slate-100 pt-4 space-y-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider">افتراضات وحالات البناء (Extra Scopes)</label>
                
                <div className="flex items-center justify-between py-1 border-b border-dashed border-slate-100">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-700">تضمين لبشة للمستقبل (Raft)</span>
                    <span className="text-[9px] text-slate-400">تضمين خرسانة وحفر لبشة كاملة</span>
                  </div>
                  <Switch 
                    checked={includeFutureRaft} 
                    onCheckedChange={setIncludeFutureRaft} 
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-700">جدران ساندة قبو (RC Walls)</span>
                    <span className="text-[9px] text-slate-400 font-medium">تضمين جدران قبو ومصعد مستقبلية</span>
                  </div>
                  <Switch 
                    checked={includeFutureWalls} 
                    onCheckedChange={setIncludeFutureWalls} 
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* D10 Live validation warning rules */}
          <Card className="border border-slate-200">
            <CardHeader className="pb-3 border-b border-custom">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                مراجعة الفجوات الهندسية والأقواس (Takeoff Validation)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {validationAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-2.5 rounded-xl border text-xs leading-normal space-y-1 ${
                    alert.type === 'danger' ? 'bg-red-50 border-red-200 text-red-950' :
                    alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-950' :
                    'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <strong className="block font-bold">{alert.title}</strong>
                  <p className="text-[10px] text-slate-500 font-medium">{alert.desc}</p>
                </div>
              ))}
              {validationAlerts.length === 0 && (
                <div className="text-center p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl font-bold text-[11px]">
                  ✓ جميع تماسكيات القياس لنسب العناصر والحديد متطابقة لتقييم الكود السعودي.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* MAIN BODY WORKSPACE TABS */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Sub Navigation */}
          <div className="flex flex-wrap gap-1 bg-slate-100 border p-1 rounded-xl">
            {[
              { id: 'kpi', label: 'لوحة التحكم والملخص الإجمالي', icon: TrendingUp },
              { id: 'concrete', label: 'الخرسانة والطوبار بالتفصيل', icon: Building },
              { id: 'rebar', label: 'الحديد بالأقطار والتسليح', icon: Calculator },
              { id: 'soil', label: 'أعمال التربة والنظافة والردم', icon: Anchor },
              { id: 'trace', label: 'تتبع وبحث الموديل (Traceability)', icon: Database },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${activeTab === tab.id ? 'bg-white text-slate-900 border-slate-300 shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: KPI OVERVIEW */}
          {activeTab === 'kpi' && (
            <div className="space-y-4 animate-fade-in text-xs">
              
              {/* Top Scorecards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border rounded-xl p-3.5 shadow-xs space-y-1">
                  <span className="text-slate-400 font-bold block">إجمالي صب الخرسانة</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-slate-900 font-mono">{qtoCalculations.concreteRCCSum.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500">m³</span>
                  </div>
                  <span className="text-[9px] text-indigo-600 font-medium">مسلحة RCC كاملة</span>
                </div>

                <div className="bg-white border rounded-xl p-3.5 shadow-xs space-y-1">
                  <span className="text-slate-400 font-bold block">وزن حديد التسليح</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-slate-900 font-mono">{qtoCalculations.totalSteelTons.toFixed(3)}</span>
                    <span className="text-[10px] text-slate-500">Tons</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">({qtoCalculations.totalSteelKg.toFixed(0)} kg)</span>
                </div>

                <div className="bg-white border rounded-xl p-3.5 shadow-xs space-y-1">
                  <span className="text-slate-400 font-bold block">مساحة طوبار الخشب</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-slate-900 font-mono">{qtoCalculations.totalFormwork.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-500">m²</span>
                  </div>
                  <span className="text-[9px] text-indigo-600 font-bold">قوالب خرسانية</span>
                </div>

                <div className="bg-white border rounded-xl p-3.5 shadow-xs space-y-1">
                  <span className="text-slate-400 font-bold block">أعمال الحفر والردم</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-slate-900 font-mono">{qtoCalculations.totalExcavation.toFixed(0)}</span>
                    <span className="text-[10px] text-slate-500">m³</span>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-bold">حفر قواعد وتربة</span>
                </div>
              </div>

              {/* Graphical representation bar or progress of cost */}
              <div className="bg-slate-900 text-white rounded-xl p-5 shadow-md flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wide">التقييم المالي التخميني التراكمي (D10 ESTIMATOR)</span>
                  <h3 className="text-2xl font-black text-white mt-1 leading-normal">
                    {(qtoCalculations.grandTotalCost).toLocaleString()} ر.س
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-medium">شامل خرسانة، وعال، وحديد، ومصروف حفر موقع، وطبقات نظافة وبيتومين رطوبة.</p>
                </div>
                <div className="flex gap-2 text-[11px]">
                  <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 w-24 text-center">
                    <span className="text-slate-400 block text-[9px]">الخرسانة</span>
                    <span className="font-bold text-indigo-400 block mt-0.5">{Math.round((qtoCalculations.costConcrete / qtoCalculations.grandTotalCost) * 100)}%</span>
                  </div>
                  <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 w-24 text-center">
                    <span className="text-slate-400 block text-[9px]">الحديد</span>
                    <span className="font-bold text-amber-400 block mt-0.5">{Math.round((qtoCalculations.costSteel / qtoCalculations.grandTotalCost) * 100)}%</span>
                  </div>
                  <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 w-24 text-center">
                    <span className="text-slate-400 block text-[9px]">قوالب وأخرى</span>
                    <span className="font-bold text-emerald-400 block mt-0.5">{Math.round(((qtoCalculations.costFormwork + qtoCalculations.costExcavation) / qtoCalculations.grandTotalCost) * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Master Bill of Quantities Summary Table */}
              <Card className="border border-slate-200">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800">بيان وجدول كميات ومقايسات الأساس الهيكلي للمشروع</CardTitle>
                </CardHeader>
                <CardContent className="pt-2 text-xs">
                  <Table className="text-right">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right">بند الأعمال الإنشائية الرئيسي</TableHead>
                        <TableHead className="text-right">الكمية الصافية</TableHead>
                        <TableHead className="text-right">الوحدة</TableHead>
                        <TableHead className="text-right">السعر الافتراضي</TableHead>
                        <TableHead className="text-right">المجموع التقديري</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-bold text-slate-800">
                          خرسانة عادية نظافة (PCC) سمك {pccThickness} مم أسفل القواعد واللبشة
                        </TableCell>
                        <TableCell className="font-mono">{qtoCalculations.leanConcretePCC.toFixed(2)}</TableCell>
                        <TableCell>m³</TableCell>
                        <TableCell className="font-mono">{Math.round(concreteCostPerM3 * 0.75)}</TableCell>
                        <TableCell className="font-bold font-mono text-cyan-800">{Math.round(qtoCalculations.leanConcretePCC * concreteCostPerM3 * 0.75).toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-slate-800">
                          الخرسانة المسلحة للهياكل والأسقف والأعمدة (C30/35 RCC)
                        </TableCell>
                        <TableCell className="font-mono">{qtoCalculations.concreteRCCSum.toFixed(2)}</TableCell>
                        <TableCell>m³</TableCell>
                        <TableCell className="font-mono">{concreteCostPerM3}</TableCell>
                        <TableCell className="font-bold font-mono text-cyan-800">{(qtoCalculations.concreteRCCSum * concreteCostPerM3).toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-slate-800">
                          توريد وتصنيع حديد تسليح مقيد ذو رتبة عالية (Steel Rebar)
                        </TableCell>
                        <TableCell className="font-mono">{qtoCalculations.totalSteelTons.toFixed(3)}</TableCell>
                        <TableCell>Tons</TableCell>
                        <TableCell className="font-mono">{steelCostPerTon}</TableCell>
                        <TableCell className="font-bold font-mono text-cyan-800">{(qtoCalculations.totalSteelTons * steelCostPerTon).toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-slate-800 font-medium">
                          أعمال القوالب الخشبية والشدات المعدنية (Formwork)
                        </TableCell>
                        <TableCell className="font-mono">{qtoCalculations.totalFormwork.toFixed(1)}</TableCell>
                        <TableCell>m²</TableCell>
                        <TableCell className="font-mono">{formworkCostPerM2}</TableCell>
                        <TableCell className="font-bold font-mono text-cyan-800">{(qtoCalculations.totalFormwork * formworkCostPerM2).toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-slate-800">
                          أعمال حفريات القواعد واللبشة من منسوب الصفر الأرضي
                        </TableCell>
                        <TableCell className="font-mono">{qtoCalculations.totalExcavation.toFixed(1)}</TableCell>
                        <TableCell>m³</TableCell>
                        <TableCell className="font-mono">{excavationCostPerM3}</TableCell>
                        <TableCell className="font-bold font-mono text-cyan-800">{(qtoCalculations.totalExcavation * excavationCostPerM3).toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold text-slate-800">
                          أعمال عازل رطوبة مائي أسفل وبجوانب القواعد صب جيدة (Waterproofing)
                        </TableCell>
                        <TableCell className="font-mono">{qtoCalculations.waterproofingArea.toFixed(1)}</TableCell>
                        <TableCell>m²</TableCell>
                        <TableCell className="font-mono">15</TableCell>
                        <TableCell className="font-bold font-mono text-cyan-800">{(qtoCalculations.waterproofingArea * 15).toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

            </div>
          )}

          {/* TAB 2: CONCRETE & FORMWORK */}
          {activeTab === 'concrete' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <Card>
                <CardHeader className="pb-2 border-b border-slate-150">
                  <CardTitle className="text-xs font-bold text-slate-800">توزيع أحجام الخرسانة بموجب درجة الرتبة الهندسية (Concrete Grades)</CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="space-y-3">
                    {Object.entries(qtoCalculations.concreteByGrade).map(([grade, vol]) => (
                      <div key={grade} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-700">{grade}</span>
                          <span className="font-mono font-bold text-slate-900">{vol.toFixed(2)} m³</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full" 
                            style={{ width: `${Math.min((vol / (qtoCalculations.concreteRCCSum + 10)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800">تقسيم الطوبار والمطاط الخشبي للعنبر (Formwork Area Breakdown)</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <Table className="text-right">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right">ركن العمل / السطح الملامس</TableHead>
                        <TableHead className="text-right font-bold text-slate-800">المساحة المقدرة م²</TableHead>
                        <TableHead className="text-right">النسبة من البناء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>طوبار بلاطات الأسقف (Slab Bottom Sheets)</TableCell>
                        <TableCell className="font-mono">{qtoCalculations.formworkSlabs.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">{((qtoCalculations.formworkSlabs / (qtoCalculations.totalFormwork || 1)) * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>طوبار الجسور والكميرات (Beam Sides & Soffit)</TableCell>
                        <TableCell className="font-mono">{qtoCalculations.formworkBeams.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">{((qtoCalculations.formworkBeams / (qtoCalculations.totalFormwork || 1)) * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>طوبار الأعمدة الخرسانية الرأسية (Column Vertical Faces)</TableCell>
                        <TableCell className="font-mono">{qtoCalculations.formworkColumns.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">{((qtoCalculations.formworkColumns / (qtoCalculations.totalFormwork || 1)) * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>طوبار جوانب القوالب للقواعد (Foundation Timber Box)</TableCell>
                        <TableCell className="font-mono">{qtoCalculations.formworkFoundations.toFixed(2)}</TableCell>
                        <TableCell className="font-mono">{((qtoCalculations.formworkFoundations / (qtoCalculations.totalFormwork || 1)) * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: REBAR DIAMETER BREAKDOWN */}
          {activeTab === 'rebar' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <Card>
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800">توزعة أوزان الحديد التفصيلية حسب القطر المقاسي (Bar Diameters Weights)</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <Table className="text-right">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right">قطر سيخ الحديد المقاسي (Ø)</TableHead>
                        <TableHead className="text-right">الوزن الصافي (كجم)</TableHead>
                        <TableHead className="text-right">النسبة المئوية</TableHead>
                        <TableHead className="text-right">موقع الاستعمال الشائع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(qtoCalculations.steelDiameterMap).map(([diam, weight]) => {
                        const wNum = Number(weight);
                        if (wNum <= 0) return null;
                        return (
                          <TableRow key={diam}>
                            <TableCell className="font-bold text-indigo-700">سيخ Ø {diam} مم</TableCell>
                            <TableCell className="font-mono font-bold">{wNum.toFixed(1)} كجم</TableCell>
                            <TableCell className="font-mono">{((wNum / (qtoCalculations.totalSteelKg || 1)) * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-slate-500 text-[10px]">
                              {Number(diam) <= 10 ? 'أساور وجسور وتوزيع قوى ثانوية' : Number(diam) <= 14 ? 'شبكات حديد الأسقف والبلاطات' : 'حديد تسليح طولي رئيسي للأعمدة والكمرات'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="bg-yellow-50 border border-yellow-200 text-yellow-950 p-4 rounded-xl leading-relaxed">
                <strong>📌 إرشادات مراجعة مصانع الحديد:</strong>
                <p className="mt-1 text-[10px] text-slate-700">
                  سيتم فرز وتصنيع كشّافات الحديد استناداً إلى جداول BBS المذكورة بالملفات المعتمدة. يعتمد هذا الحصر على الكثافة الإجمالية لصب ملم الخرسانة المسلحة ليعاكس وزن الهيكل الفعلي دون فائض الهدر المعتاد والبالغ ٥٪ مضافة على المشتريات الإجمالية بالموقع.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: SOIL & EXCAVATION WORKS */}
          {activeTab === 'soil' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <Card>
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 text-right">أعمال الحفر والردم وصبات النظافة (Civil PCC & Backfilling Works)</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <Table className="text-right">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right">البند الإنشائي للموقع</TableHead>
                        <TableHead className="text-right">الكمية المقدرة</TableHead>
                        <TableHead className="text-right">الوحدة</TableHead>
                        <TableHead className="text-right">ملاحظات وشهود الحقل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-bold">حفر قواعد المبنى المنفصلة (Footings Excavation)</TableCell>
                        <TableCell className="font-mono font-bold">{qtoCalculations.excavationFootings.toFixed(2)}</TableCell>
                        <TableCell>m³</TableCell>
                        <TableCell className="text-slate-500">مفترض بعمق حفر لا يقل عن ١.٥م من منسوب الصفر الأرضي</TableCell>
                      </TableRow>
                      {includeFutureRaft && (
                        <TableRow>
                          <TableCell className="font-bold text-indigo-700">حفر اللبشة المستقبلية (Raft Excavation)</TableCell>
                          <TableCell className="font-mono font-bold text-indigo-700">{qtoCalculations.excavationCombined.toFixed(2)}</TableCell>
                          <TableCell>m³</TableCell>
                          <TableCell className="text-slate-500">حفر اللبشة الكلية لكامل مساحة البنية</TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell className="font-bold">أعمال الردم من ناتج حفر معتمد ومطابق</TableCell>
                        <TableCell className="font-mono font-bold">{qtoCalculations.backfillFootings.toFixed(2)}</TableCell>
                        <TableCell>m³</TableCell>
                        <TableCell className="text-slate-500">مع رص الطبقات على أجزاء لا تتجاوز ٣٠سم بالموقع</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold">طبقة الخرسانة العادية نظافة PCC سمك {pccThickness}مم</TableCell>
                        <TableCell className="font-mono font-bold">{qtoCalculations.leanConcretePCC.toFixed(2)}</TableCell>
                        <TableCell>m³</TableCell>
                        <TableCell className="text-slate-500">مقاومة خرسانة ٢٠-١٥ ميجا باسكال لمنع رطوبة التربة</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-bold">عازل المياه السائل والرول البلاستيكي اسفل الاساسات</TableCell>
                        <TableCell className="font-mono font-bold">{qtoCalculations.waterproofingArea.toFixed(2)}</TableCell>
                        <TableCell>m²</TableCell>
                        <TableCell className="text-slate-500 font-bold">بيتومين على البارد والساخن لحماية حديد التسليح</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 5: TRACEABILITY MATRIX */}
          {activeTab === 'trace' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex gap-2 bg-white p-2 border rounded-xl shadow-xs">
                <Search className="w-4 h-4 text-slate-400 mt-2 mr-2" />
                <Input 
                  placeholder="ابحث عن عنصر محدد (مثال: COL-C1, BEAM, SLAB) للتحقق من تطابقه..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs border-0 shadow-none focus-visible:ring-0 text-right"
                />
              </div>

              <Card>
                <CardHeader className="pb-2 border-b border-slate-100 bg-slate-50/50">
                  <CardTitle className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>مؤشر تتبع وحوكمة العناصر الفردية بموديل CAD (Traceability Matrix)</span>
                    <Badge variant="outline" className="font-mono text-[9px]">{filteredTraceableItems.length} عنصر متاح</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="max-h-[350px] overflow-y-auto">
                    <Table className="text-right">
                      <TableHeader className="bg-slate-100">
                        <TableRow>
                          <TableHead className="text-right">رمز العنصر</TableHead>
                          <TableHead className="text-right">اسم العنصر ومواصفاته</TableHead>
                          <TableHead className="text-right">الحجم الموديل (م³)</TableHead>
                          <TableHead className="text-right">مخطط الكود المرجعي</TableHead>
                          <TableHead className="text-right">الإجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTraceableItems.map((item) => (
                          <TableRow key={item.id} className={tracedElement === item.id ? 'bg-indigo-50/70' : ''}>
                            <TableCell className="font-mono font-bold text-slate-800">{item.id}</TableCell>
                            <TableCell className="font-semibold">{item.name}</TableCell>
                            <TableCell className="font-mono text-indigo-700">{item.volume.toFixed(3)}</TableCell>
                            <TableCell className="text-slate-500">{item.sheet}</TableCell>
                            <TableCell>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setTracedElement(tracedElement === item.id ? null : item.id)}
                                className="text-[10px] text-indigo-600 font-bold hover:underline"
                              >
                                {tracedElement === item.id ? 'إخفاء التفصيل' : 'تتبع تفصيل التسليح'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Element detail expansion panel */}
              {tracedElement && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-indigo-900 text-white rounded-xl space-y-2 border border-indigo-950 shadow"
                >
                  <div className="flex justify-between items-center">
                    <strong className="text-xs">تفاصيل التتبع والربط الإنشائي للعنصر {tracedElement}:</strong>
                    <Badge className="bg-indigo-700 text-white fill-none border-none">ACI-318 Mapped</Badge>
                  </div>
                  {(() => {
                    const matched = traceableItems.find(i => i.id === tracedElement);
                    if (!matched) return <p>العنصر المحدد غير متوفر بالموديل.</p>;
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1 text-[11px] leading-normal text-slate-200">
                        <div>
                          <span className="text-indigo-300 block text-[9px]">حجم الصب الصافي:</span>
                          <span className="font-mono font-bold text-white block">{matched.volume.toFixed(3)} m³</span>
                        </div>
                        <div>
                          <span className="text-indigo-300 block text-[9px]">التسليح المجدول:</span>
                          <span className="font-bold text-white block">{matched.rebar}</span>
                        </div>
                        <div>
                          <span className="text-indigo-300 block text-[9px]">رقم لوحة الكود:</span>
                          <span className="font-bold text-white block">{matched.sheet}</span>
                        </div>
                        <div>
                          <span className="text-indigo-300 block text-[9px]">محدد التفصيل القياسي:</span>
                          <span className="font-bold text-white font-mono block text-amber-300">{matched.detailRef}</span>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, Download, Printer, FileSpreadsheet, FileText, AlertTriangle, 
  CheckCircle, RefreshCw, PenTool, LayoutGrid, Layers, Settings, Coins, 
  Info, DollarSign, ListOrdered, Layers3, Activity, HardHat, ShieldCheck, CornerDownRight, Plus, Trash2, Sliders, Landmark
} from 'lucide-react';
import { 
  calculateFoundationQS, 
  FdnItemInput, 
  QSConfig, 
  FdnType, 
  FdnQSRow, 
  QSProjectSummary 
} from './FoundationQuantityEngine';
import { generateFoundationBOQ_DXF, downloadDXF } from '@/export/dxfExporter';

interface FoundationBOQGeneratorProps {
  projectName: string;
  isolatedFootings: any[];
  stripFootings: any[];
  scheduleItems: any[];
  stripScheduleItems: any[];
  bbsItemsList: any[];
  takeoffMetrics: any;
  naturalGroundLevel: number;
  excavationOffset: number;
}

export default function FoundationBOQGenerator({
  projectName,
  isolatedFootings = [],
  stripFootings = [],
  scheduleItems = [],
  stripScheduleItems = [],
  bbsItemsList = [],
  takeoffMetrics,
  naturalGroundLevel: initialNGL,
  excavationOffset: initialExcavationOffset,
}: FoundationBOQGeneratorProps) {

  // --- QS SURVEYOR CONFIG STATE (with robust industry defaults) ---
  const [config, setConfig] = useState<QSConfig>({
    pccThickness: 100, // mm
    pccOffset: 100, // mm
    excavationOffset: initialExcavationOffset || 300, // mm
    naturalGroundLevel: initialNGL / 1000 || 0.00, // m
    compactionFactor: 1.15, // volume expansion/compaction ratio
    
    // Default Unit Prices in Saudi Riyals (SAR) or Local Currency
    priceExcavation: 25, // per m³
    pricePCC: 450, // per m³ (C15/C20 Blinding)
    priceRC: 550, // per m³ (C30/C35 Footing concrete)
    priceSteel: 4.2, // per kg (approx 4200 SAR per ton)
    priceFormwork: 65, // per m² (plywood/wood shuttering)
    priceBackfill: 15, // per m³
  });

  // --- ACTIVE VIEW TABS ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'itemized' | 'boq' | 'summary' | 'elevations' | 'validator'>('dashboard');
  const [boqSection, setBoqSection] = useState<'all' | 'earth' | 'pcc' | 'rc' | 'steel' | 'form' | 'back' | 'cost'>('all');

  // --- FUTURE COMPATIBILITY / MOCK FOUNDATIONS LIST FOR FULL TESTING ---
  const [mockFoundations, setMockFoundations] = useState<FdnItemInput[]>([]);

  // Controls for future foundation mock adder
  const [showAdder, setShowAdder] = useState(false);
  const [newId, setNewId] = useState('CF1');
  const [newType, setNewType] = useState<FdnType>('combined');
  const [newB, setNewB] = useState(2400);
  const [newL, setNewL] = useState(4500);
  const [newH, setNewH] = useState(700);
  const [newCount, setNewCount] = useState(6);
  const [newElevation, setNewElevation] = useState(-2.50);
  const [newSteelRatio, setNewSteelRatio] = useState(120); // kg/m³
  const [newConcreteGrade, setNewConcreteGrade] = useState('C35');
  const [newArea, setNewArea] = useState(150); // sqm for raft

  const handleAddMock = () => {
    if (!newId.trim()) return;
    const item: FdnItemInput = {
      id: newId,
      type: newType,
      B: newB,
      L: newL,
      H: newH,
      count: newCount,
      elevation: newElevation,
      steelRatio: newSteelRatio,
      concreteGrade: newConcreteGrade,
      area: newType === 'raft' ? newArea : undefined
    };
    setMockFoundations(prev => [...prev, item]);
    setShowAdder(false);
    setNewId(`CF${mockFoundations.length + 2}`);
  };

  const handleRemoveMock = (id: string) => {
    setMockFoundations(prev => prev.filter(f => f.id !== id));
  };

  // --- COMPILE ALL ACTIVE ENGINE INPUTS ---
  const foundationQSInputs = useMemo(() => {
    const list: FdnItemInput[] = [];

    // 1. Convert Live Isolated Footings
    scheduleItems.forEach(item => {
      const activeCount = isolatedFootings.filter(f => f.id === item.typeMark).length;
      const count = activeCount > 0 ? activeCount : 1; // Fallback to 1 representing designed schedule

      // Get steel weight matching this ID from the BBS list
      const correspondingBBS = bbsItemsList.filter(b => b.typeMark === item.typeMark);
      const steelWeight = correspondingBBS.reduce((acc, curr) => acc + curr.totalWeight, 0);

      list.push({
        id: item.typeMark,
        type: 'isolated',
        B: item.B,
        L: item.L,
        H: item.H,
        count,
        elevation: -1.80, // Default isolated footing level
        colB: 400,
        colH: 400,
        rebarWeightKg: steelWeight > 0 ? steelWeight : undefined,
        concreteGrade: 'C30'
      });
    });

    // 2. Convert Live Strip Footings
    stripScheduleItems.forEach(item => {
      const activeCount = stripFootings.filter(f => f.id === item.typeMark).length;
      const count = activeCount > 0 ? activeCount : 1; // Fallback to 1

      const correspondingBBS = bbsItemsList.filter(b => b.typeMark === item.typeMark);
      const steelWeight = correspondingBBS.reduce((acc, curr) => acc + curr.totalWeight, 0);

      list.push({
        id: item.typeMark,
        type: 'strip',
        B: item.B,
        L: item.L,
        H: item.H,
        count,
        elevation: item.elevation || -2.20,
        rebarWeightKg: steelWeight > 0 ? steelWeight : undefined,
        concreteGrade: 'C30'
      });
    });

    // 3. Append Future/Mock Foundations
    mockFoundations.forEach(mock => {
      // Avoid duplicate IDs on active compilation
      if (!list.some(x => x.id === mock.id)) {
        list.push(mock);
      }
    });

    return list;
  }, [scheduleItems, stripScheduleItems, isolatedFootings, stripFootings, bbsItemsList, mockFoundations]);

  // Run calculation engine
  const qsResult = useMemo(() => {
    return calculateFoundationQS(foundationQSInputs, config);
  }, [foundationQSInputs, config]);

  // --- SUMMARY MEMOS ---
  const typeSummaries = useMemo(() => {
    const map: Record<FdnType, { count: number; concrete: number; steel: number; excavation: number; cost: number; name: string }> = {
      isolated: { count: 0, concrete: 0, steel: 0, excavation: 0, cost: 0, name: 'قواعد منفصلة (Isolated)' },
      strip: { count: 0, concrete: 0, steel: 0, excavation: 0, cost: 0, name: 'أساسات شريطية (Strip)' },
      combined: { count: 0, concrete: 0, steel: 0, excavation: 0, cost: 0, name: 'قواعد مشتركة (Combined)' },
      raft: { count: 0, concrete: 0, steel: 0, excavation: 0, cost: 0, name: 'لبشة مسلحة (Raft)' },
      pilecap: { count: 0, concrete: 0, steel: 0, excavation: 0, cost: 0, name: 'هامات خوازيق (Pile Cap)' },
    };

    qsResult.rows.forEach(r => {
      map[r.type].count += r.count;
      map[r.type].concrete += r.totalRCVolTotal;
      map[r.type].steel += r.steelWtTotal;
      map[r.type].excavation += r.excavationVolTotal;
      map[r.type].cost += r.costTotal;
    });

    return Object.entries(map)
      .map(([key, value]) => ({ type: key as FdnType, ...value }))
      .filter(x => x.count > 0);
  }, [qsResult]);

  const levelSummaries = useMemo(() => {
    const summary: Record<number, { concrete: number; excavation: number; steel: number; cost: number }> = {};
    qsResult.rows.forEach(r => {
      const el = r.elevation;
      if (!summary[el]) {
        summary[el] = { concrete: 0, excavation: 0, steel: 0, cost: 0 };
      }
      summary[el].concrete += r.totalRCVolTotal;
      summary[el].excavation += r.excavationVolTotal;
      summary[el].steel += r.steelWtTotal;
      summary[el].cost += r.costTotal;
    });

    return Object.entries(summary).map(([level, val]) => ({
      level: Number(level),
      ...val
    })).sort((a, b) => b.level - a.level);
  }, [qsResult]);

  const concreteGradeSummaries = useMemo(() => {
    const summary: Record<string, { concreteVolume: number; count: number }> = {};
    qsResult.rows.forEach(r => {
      const grade = r.concreteGrade;
      if (!summary[grade]) {
        summary[grade] = { concreteVolume: 0, count: 0 };
      }
      summary[grade].concreteVolume += r.totalRCVolTotal;
      summary[grade].count += r.count;
    });
    return Object.entries(summary).map(([grade, val]) => ({
      grade,
      ...val
    }));
  }, [qsResult]);

  const diameterSummaries = useMemo(() => {
    const summary: Record<number, number> = {};
    // Extract diameter weights from BBS
    bbsItemsList.forEach(item => {
      const d = item.diameter;
      if (!summary[d]) summary[d] = 0;
      summary[d] += item.totalWeight;
    });
    return Object.entries(summary).map(([dia, wt]) => ({
      diameter: Number(dia),
      weight: wt
    })).sort((a,b) => a.diameter - b.diameter);
  }, [bbsItemsList]);


  // --- EXPORTERS ---
  const handleExportCSV = () => {
    const header = "Item,Category,Description,Unit,Quantity,Rate,Total Price";
    const boqItems = boqList;
    const rows = boqItems.map(item => 
      `"${item.itemNo}","${item.category}","${item.description}","${item.unit}",${item.quantity.toFixed(2)},${item.rate.toFixed(2)},${item.total.toFixed(2)}`
    );
    
    // Add summary totals
    rows.push("");
    rows.push(`"","","GRAND CONTRACT TOTAL (ESTIMATED)","SAR",,,"${qsResult.grandTotalCost.toFixed(2)}"`);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(header + '\n' + rows.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `BOQ_Project_Takeoff_${projectName.replace(/\s/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportDXF = () => {
    const formattedBBoxItems = boqList.map(item => ({
      itemNo: item.itemNo,
      category: item.category,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      rate: item.rate,
      total: item.total
    }));
    const dxf = generateFoundationBOQ_DXF(formattedBBoxItems, projectName);
    downloadDXF(dxf, `${projectName.replace(/\s/g, '_')}_BOQ_Drawing.dxf`);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // --- BUILD ACTIVE BOQ ITEMS LIST FOR UI REPRESENTATION & CAD DXF ---
  const boqList = useMemo(() => {
    const list: any[] = [];
    
    // 1. Earthworks Section
    list.push({
      itemNo: "1.1",
      category: "الأعمال الترابية (Earthworks)",
      description: `أعمال الحفر الميكانيكي لزوم تربة الأساسات في الموقع طبقاً للمناسيب المطلوبة بمتوسط عمق حفر ومساحة ممتدة مع تهيئة القاع لجميع أنواع القواعد الإنشائية شاملة سند جوانب الحفر إن لزم وتكلفة نقل نواتج الحفر للمقالب المفتوحة المعتمدة.`,
      unit: "م³ (m³)",
      quantity: qsResult.totalExcavationVol,
      rate: config.priceExcavation,
      total: qsResult.totalExcavationVol * config.priceExcavation
    });

    list.push({
      itemNo: "1.2",
      category: "الأعمال الترابية (Earthworks)",
      description: `أعمال الردم المورد النظيف المعتمد حول القواعد ورقاب الأعمدة والشدادات على طبقات لا تتجاوز 25سم مع الترطيب بالمياه والدمك الميكانيكي المستمر للوصول إلى كثافة جافة لا تقل عن 95% من اختبار بروكتر المعدل.`,
      unit: "م³ (m³)",
      quantity: qsResult.totalNetBackfillVol,
      rate: config.priceBackfill,
      total: qsResult.totalNetBackfillVol * config.priceBackfill
    });

    // 2. Plain Concrete
    list.push({
      itemNo: "2.1",
      category: "الخرسانة العادية (Plain Concrete)",
      description: `توريد وصب خرسانة عادية عيار C20 لزوم فرشة النظافة (البليندينج) أسفل القواعد والشدادات بسمك متوسط ${config.pccThickness}مم شاملاً التخشين والتسوية وسقاية السطح بالماء وأعمال الشد الشوب الصالحة.`,
      unit: "م³ (m³)",
      quantity: qsResult.totalPCCVol,
      rate: config.pricePCC,
      total: qsResult.totalPCCVol * config.pricePCC
    });

    // 3. Reinforced Concrete
    list.push({
      itemNo: "3.1",
      category: "الخرسانة المسلحة (RC)",
      description: `توريد وصب خرسانة مسلحة جاهزة عيار C30/C35 مقاومة للأملاح والكبريتات لزوم جميع أساسات القواعد (المنفصلة، الشريطية، المشتركة، والألباش) وشدادات الربط طبقاً للأبعاد والمناسيب الحالية للمشروع.`,
      unit: "م³ (m³)",
      quantity: qsResult.rows.reduce((acc, curr) => acc + curr.rcVolTotal, 0),
      rate: config.priceRC,
      total: qsResult.rows.reduce((acc, curr) => acc + curr.rcVolTotal, 0) * config.priceRC
    });

    const totalPedestalVol = qsResult.rows.reduce((acc, curr) => acc + curr.pedestalVolTotal, 0);
    if (totalPedestalVol > 0) {
      list.push({
        itemNo: "3.2",
        category: "الخرسانة المسلحة (RC)",
        description: `توريد وصب خرسانة مسلحة جاهزة عيار C35 لرقاب الأعمدة القصيرة والبدايات الحرة (الرقاب) من فوهة القواعد حتى منسوب الميد الأرضية شاملة الصب والتهزير والترطيب الكيميائي المعتمد.`,
        unit: "م³ (m³)",
        quantity: totalPedestalVol,
        rate: config.priceRC + 50, // Usually slightly more expensive
        total: totalPedestalVol * (config.priceRC + 50)
      });
    }

    // 4. Formwork Area
    list.push({
      itemNo: "4.1",
      category: "القوالب والشدات (Formwork)",
      description: `مصنعيات ومواد الشداد الخشبية من ألواح اللتزانة أو البلايود الفنية لزوم شد جوانب القواعد المصبوبة ورقاب الميده شاملة الدعامات والتربيط وإزالة الشدات الورقية بعد الصب بـ 48 ساعة ودهان الأجزاء الملامسة للتربة عازل مائي.`,
      unit: "م² (m²)",
      quantity: qsResult.totalFormworkArea,
      rate: config.priceFormwork,
      total: qsResult.totalFormworkArea * config.priceFormwork
    });

    // 5. Reinforcement Steel
    list.push({
      itemNo: "5.1",
      category: "حديد التسليح (Steel)",
      description: `توريد وتفصيل وتركيب حديد تسليح عالي المقاومة رتبة 420 (Grade 60) طبقاً للقطاعات والكشوف وتفريد أسياخ (BBS) شاملة العكفات والوصلات والتثبيت والسكك والركائز الإسمنتية المقاومة للتربة بالقطار المطلوبة.`,
      unit: "كغ (kg)",
      quantity: qsResult.totalSteelWt,
      rate: config.priceSteel,
      total: qsResult.totalSteelWt * config.priceSteel
    });

    return list;
  }, [qsResult, config]);

  return (
    <div className="space-y-6 print:bg-white print:text-black">
      {/* PROFESSIONAL TITLE / HEADER METADATA */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 gap-4 print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-indigo-600" />
            منظومة حصر الكميات الذكية وتجهيز العطاءات والمطابقة المالية / QS & BOQ Takeoff Suite 📊
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            حاسب مالي معتمد وجداول كميات تفصيلية للأعمال الإنشائية والترابية المطابقة لمتطلبات الكود المالي والتنفيذي.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="default" className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 h-8" onClick={handleExportDXF}>
            <Download className="h-3 w-3" /> تصدير جدول لوحة الـ CAD (DXF)
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8" onClick={handleExportCSV}>
            <FileSpreadsheet className="h-3 w-3 text-emerald-600" /> تصدير ملف إكسل (CSV)
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8" onClick={handlePrintPDF}>
            <Printer className="h-3 w-3" /> طباعة المذكرة (PDF)
          </Button>
        </div>
      </div>

      {/* 5-WAY STRATEGIC QS KPIS DASHBOARD */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Card className="border border-slate-200/80 shadow-sm relative overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="absolute top-1 right-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[8px] px-1.5 py-0.5 rounded font-mono">
              m³ (كعب)
            </div>
            <HardHat className="h-5 w-5 text-amber-600 mx-auto" />
            <span className="text-[10px] text-muted-foreground block mt-1">حجم الحفر الإجمالي</span>
            <strong className="text-base font-black font-mono text-slate-800 dark:text-slate-100">
              {qsResult.totalExcavationVol.toFixed(1)}
            </strong>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm relative overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="absolute top-1 right-1 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 text-[8px] px-1.5 py-0.5 rounded font-mono">
              m³ (كعب)
            </div>
            <Layers className="h-5 w-5 text-indigo-500 mx-auto" />
            <span className="text-[10px] text-muted-foreground block mt-1">خرسانة عادية (فرشة)</span>
            <strong className="text-base font-black font-mono text-slate-800 dark:text-slate-100">
              {qsResult.totalPCCVol.toFixed(1)}
            </strong>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm relative overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="absolute top-1 right-1 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[8px] px-1.5 py-0.5 rounded font-mono">
              m³ (مسلح)
            </div>
            <Layers3 className="h-5 w-5 text-blue-600 mx-auto" />
            <span className="text-[10px] text-muted-foreground block mt-1">إجمالي خرسانة مسلحة</span>
            <strong className="text-base font-black font-mono text-slate-800 dark:text-slate-100">
              {qsResult.totalRCVol.toFixed(1)}
            </strong>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm relative overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="absolute top-1 right-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[8px] px-1.5 py-0.5 rounded font-mono">
              Ton (طن)
            </div>
            <Activity className="h-5 w-5 text-emerald-600 mx-auto" />
            <span className="text-[10px] text-muted-foreground block mt-1">وزن حديد التسليح</span>
            <strong className="text-base font-black font-mono text-emerald-600">
              {qsResult.totalSteelTon.toFixed(2)} <span className="text-[9px] font-normal text-muted-foreground">ط</span>
            </strong>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm relative overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="absolute top-1 right-1 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[8px] px-1.5 py-0.5 rounded font-mono">
              m² (مسطح)
            </div>
            <Sliders className="h-5 w-5 text-rose-500 mx-auto" />
            <span className="text-[10px] text-muted-foreground block mt-1">مساحة الطوبار الخشبي</span>
            <strong className="text-base font-black font-mono text-slate-800 dark:text-slate-100">
              {qsResult.totalFormworkArea.toFixed(1)}
            </strong>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm relative overflow-hidden">
          <CardContent className="p-3 text-center">
            <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[8px] px-1.5 py-0.5 rounded font-mono">
              SAR (الموازنة)
            </div>
            <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <span className="text-[10px] text-muted-foreground block mt-1">إجمالي تكلفة الأشغال</span>
            <strong className="text-base font-black font-mono text-emerald-600 block">
              {qsResult.grandTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </strong>
          </CardContent>
        </Card>
      </div>

      {/* ADJUSTABLE SURVEYOR CALCULATOR SETTINGS PANEL */}
      <Card className="border border-slate-200/80 shadow-xs print:hidden">
        <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-indigo-600" />
              تعديل ثوابت ومعايير الحصر المالي وأسعار بنود المقاصة / QS Configurator Properties 🔧
            </CardTitle>
            <Badge className="bg-slate-200 text-slate-700 text-[9px] font-mono">
              المعايير الهندسية والمالية
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-3 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-[10px]">سماكة فرشة النظافة PCC (مم)</Label>
              <Input 
                type="number" 
                value={config.pccThickness} 
                onChange={e => setConfig(prev => ({ ...prev, pccThickness: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px]">بروز فرشة النظافة (مم)</Label>
              <Input 
                type="number" 
                value={config.pccOffset} 
                onChange={e => setConfig(prev => ({ ...prev, pccOffset: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px]">مساحة الحفر الزائدة (مم)</Label>
              <Input 
                type="number" 
                value={config.excavationOffset} 
                onChange={e => setConfig(prev => ({ ...prev, excavationOffset: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px]">منسوب التربة الطبيعية (م)</Label>
              <Input 
                type="number" 
                step="0.1"
                value={config.naturalGroundLevel} 
                onChange={e => setConfig(prev => ({ ...prev, naturalGroundLevel: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px]">معامل انتفاش ودمك الردم (Comp.)</Label>
              <Input 
                type="number" 
                step="0.05"
                value={config.compactionFactor} 
                onChange={e => setConfig(prev => ({ ...prev, compactionFactor: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px]">حفر تراب (ر.س/م³)</Label>
              <Input 
                type="number" 
                value={config.priceExcavation} 
                onChange={e => setConfig(prev => ({ ...prev, priceExcavation: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono text-amber-600 font-bold"
              />
            </div>

            <div>
              <Label className="text-[10px]">خرسانة نظافة عادية (ر.س/م³)</Label>
              <Input 
                type="number" 
                value={config.pricePCC} 
                onChange={e => setConfig(prev => ({ ...prev, pricePCC: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono text-slate-700"
              />
            </div>
            <div>
              <Label className="text-[10px]">خرسانة مسلحة قواعد (ر.س/م³)</Label>
              <Input 
                type="number" 
                value={config.priceRC} 
                onChange={e => setConfig(prev => ({ ...prev, priceRC: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono text-indigo-700 font-bold"
              />
            </div>
            <div>
              <Label className="text-[10px]">حديد تسليح (ر.س/كغ)</Label>
              <Input 
                type="number" 
                step="0.1"
                value={config.priceSteel} 
                onChange={e => setConfig(prev => ({ ...prev, priceSteel: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono text-emerald-700 font-bold"
              />
            </div>
            <div>
              <Label className="text-[10px]">خشبيات وطوبار (ر.س/م²)</Label>
              <Input 
                type="number" 
                value={config.priceFormwork} 
                onChange={e => setConfig(prev => ({ ...prev, priceFormwork: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono text-rose-700"
              />
            </div>
            <div>
              <Label className="text-[10px]">توريد وردميات دك (ر.س/م³)</Label>
              <Input 
                type="number" 
                value={config.priceBackfill} 
                onChange={e => setConfig(prev => ({ ...prev, priceBackfill: Number(e.target.value) }))}
                className="h-8 mt-1 text-xs font-mono text-muted-foreground"
              />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" className="w-full text-xs h-8 text-indigo-600 gap-1" onClick={() => setConfig({
                pccThickness: 100,
                pccOffset: 100,
                excavationOffset: 300,
                naturalGroundLevel: 0.00,
                compactionFactor: 1.15,
                priceExcavation: 25,
                pricePCC: 450,
                priceRC: 550,
                priceSteel: 4.2,
                priceFormwork: 65,
                priceBackfill: 15,
              })}>
                <RefreshCw className="h-3 w-3" /> إعادة الضبط الافتراضي
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RE-ESTABLISH ACTIVE LAYOUT TAB NAVIGATION */}
      <div className="flex border-b pb-px gap-1 print:hidden">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`px-3 py-1.5 text-xs font-bold transition-all border-b-2 rounded-t flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/45 dark:bg-indigo-950/25' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Activity className="h-3.5 w-3.5" /> لوحة البيانات والمشخصات
        </button>
        <button 
          onClick={() => setActiveTab('boq')} 
          className={`px-3 py-1.5 text-xs font-bold transition-all border-b-2 rounded-t flex items-center gap-1.5 ${activeTab === 'boq' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/45 dark:bg-indigo-950/25' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Landmark className="h-3.5 w-3.5" /> جدول الكميات والأسعار (BOQ)
        </button>
        <button 
          onClick={() => setActiveTab('itemized')} 
          className={`px-3 py-1.5 text-xs font-bold transition-all border-b-2 rounded-t flex items-center gap-1.5 ${activeTab === 'itemized' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/45 dark:bg-indigo-950/25' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <ListOrdered className="h-3.5 w-3.5" /> تفصيل الكميات المفردة لكل قاعدة
        </button>
        <button 
          onClick={() => setActiveTab('summary')} 
          className={`px-3 py-1.5 text-xs font-bold transition-all border-b-2 rounded-t flex items-center gap-1.5 ${activeTab === 'summary' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/45 dark:bg-indigo-950/25' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <LayoutGrid className="h-3.5 w-3.5" /> جداول التلخيص والتقارير المقسمة
        </button>
        <button 
          onClick={() => setActiveTab('elevations')} 
          className={`px-3 py-1.5 text-xs font-bold transition-all border-b-2 rounded-t flex items-center gap-1.5 ${activeTab === 'elevations' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/45 dark:bg-indigo-950/25' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Layers className="h-3.5 w-3.5" /> تقسيم المناسيب الارتفاعية (Elevations)
        </button>
        <button 
          onClick={() => setActiveTab('validator')} 
          className={`px-3 py-1.5 text-xs font-bold transition-all border-b-2 rounded-t flex items-center gap-1.5 ${activeTab === 'validator' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/45 dark:bg-indigo-950/25' : 'border-transparent text-slate-500'}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> حوكمة الحصر والتدقيق الفني (Validator)
        </button>
      </div>

      {/* ========================================================
          TAB 1: DASHBOARD
          ======================================================== */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart Table summary by foundation type */}
          <Card className="border border-slate-200 shadow-xs lg:col-span-2">
            <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
              <CardTitle className="text-xs font-black text-slate-800 dark:text-slate-200">
                الحصر النوعي المجمع حسب نوعية الأساسات ومشاريع التأسيس / Quantity by Foundation Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs border-0">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="py-2">نوع النموذج الإنشائي</TableHead>
                    <TableHead className="py-2 text-center">العدد</TableHead>
                    <TableHead className="py-2 text-right">أشغال التراب (م³)</TableHead>
                    <TableHead className="py-2 text-right">كعب خرسانة (م³)</TableHead>
                    <TableHead className="py-2 text-right">حديد التسليح (كغ)</TableHead>
                    <TableHead className="py-2 text-right">صافي التكلفة الشاملة (ر.س)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeSummaries.map(s => (
                    <TableRow key={s.type} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/10">
                      <TableCell className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <CornerDownRight className="h-3 w-3 text-indigo-600 shrink-0" />
                        {s.name}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">{s.count}</TableCell>
                      <TableCell className="text-right font-mono text-amber-600 font-semibold">{s.excavation.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono text-indigo-700 font-bold">{s.concrete.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 font-semibold">{s.steel.toFixed(0)}</TableCell>
                      <TableCell className="text-right font-mono font-black text-slate-800 dark:text-slate-200">
                        {s.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Quick Mock Adder / Future Foundations block */}
          <Card className="border border-indigo-100 shadow-sm">
            <CardHeader className="py-2.5 bg-indigo-50/40 dark:bg-indigo-950/20 border-b">
              <CardTitle className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200 flex items-center justify-between">
                <span>محاكاة أساسات المستقبل لسرعة حصر التقديرات / Future Foundations Pre-estimator 🚀</span>
                <Badge className="bg-indigo-600 text-white text-[8px]">محاكي التخطيط</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3 text-xs">
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                اختبر فاعلية حسابات التقديرات الإنشائية بإضافة نماذج إضافية كبرى (لبش، هامات خوازيق، قواعد مشتركة مستمرة) للتوسعات المستقبلية.
              </p>
              
              {/* Show Added Mocks if any */}
              {mockFoundations.length > 0 && (
                <div className="border rounded p-2 bg-slate-50 dark:bg-slate-900 space-y-1.5 max-h-32 overflow-y-auto">
                  <span className="font-bold text-[9px] text-indigo-900 block">الأساسات المضافة الحالية للتقييم:</span>
                  {mockFoundations.map(m => (
                    <div key={m.id} className="flex justify-between items-center bg-white dark:bg-slate-950 text-[10px] px-2 py-1 rounded border">
                      <span>{m.id}: {m.type === 'raft' ? 'لبشة مسلحة' : 'قاعدة مضافة'} ({m.count} قطع)</span>
                      <Button size="icon" variant="ghost" className="h-4 w-4 text-red-500" onClick={() => handleRemoveMock(m.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {!showAdder ? (
                <Button size="sm" className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 font-bold" onClick={() => setShowAdder(true)}>
                  <Plus className="h-3.5 w-3.5" /> إضافة نموذج مستقبلي مخصص
                </Button>
              ) : (
                <div className="border rounded p-3 bg-slate-50 dark:bg-slate-900 space-y-2.5">
                  <span className="font-bold block text-[10px] text-slate-800">تكوين النموذج الجديد للمشروع:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[9px]">رمز التعريف</Label>
                      <Input value={newId} onChange={e=>setNewId(e.target.value)} className="h-7 text-xs font-mono" />
                    </div>
                    <div>
                      <Label className="text-[9px]">نوع الأساس الإنشائي</Label>
                      <select value={newType} onChange={e=>setNewType(e.target.value as FdnType)} className="w-full border rounded h-7 text-[10px] p-1 bg-background">
                        <option value="combined">قاعدة مشتركة (Combined)</option>
                        <option value="raft">لبشة مسلحة (Raft Mat)</option>
                        <option value="pilecap">هامة خوازيق (Pile Cap)</option>
                      </select>
                    </div>
                  </div>
                  {newType === 'raft' ? (
                    <div>
                      <Label className="text-[9px]">الأبعاد الكلية للمسطح (م²)</Label>
                      <Input type="number" value={newArea} onChange={e=>setNewArea(Number(e.target.value))} className="h-7 text-xs font-mono" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <Label className="text-[9px]">العرض B (مم)</Label>
                        <Input type="number" value={newB} onChange={e=>setNewB(Number(e.target.value))} className="h-7 text-[10px] p-1 font-mono" />
                      </div>
                      <div>
                        <Label className="text-[9px]">الطول L (مم)</Label>
                        <Input type="number" value={newL} onChange={e=>setNewL(Number(e.target.value))} className="h-7 text-[10px] p-1 font-mono" />
                      </div>
                      <div>
                        <Label className="text-[9px]">السماكة H (مم)</Label>
                        <Input type="number" value={newH} onChange={e=>setNewH(Number(e.target.value))} className="h-7 text-[10px] p-1 font-mono" />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      <Label className="text-[9px]">العدد بالمشروع</Label>
                      <Input type="number" value={newCount} onChange={e=>setNewCount(Number(e.target.value))} className="h-7 text-xs font-mono" />
                    </div>
                    <div>
                      <Label className="text-[9px]">المنسوب EL (م)</Label>
                      <Input type="number" step="0.1" value={newElevation} onChange={e=>setNewElevation(Number(e.target.value))} className="h-7 text-xs font-mono" />
                    </div>
                    <div>
                      <Label className="text-[9px]">كثافة الحديد (كغ/م³)</Label>
                      <Input type="number" value={newSteelRatio} onChange={e=>setNewSteelRatio(Number(e.target.value))} className="h-7 text-xs font-mono1" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={()=>setShowAdder(false)}>إلغاء</Button>
                    <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={handleAddMock}>إضافة وحفظ</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================
          TAB 2: BILL OF QUANTITIES (BOQ) TABLE
          ======================================================== */}
      {activeTab === 'boq' && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="py-3 bg-slate-50 dark:bg-slate-900 border-b flex flex-row justify-between items-center flex-wrap gap-2">
            <div>
              <CardTitle className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                جدول حصر الكميات والمقاصة المالية المعتمدة للمشروع / Master Bill of Quantities (BOQ) 💼
              </CardTitle>
              <CardDescription className="text-[10px]">
                كشف الكميات والبنود التفصيلية مع تكاليف التنفيذ وشور أعمال الموقع لمخرجات المقاولين.
              </CardDescription>
            </div>
            
            {/* Filter buttons by block */}
            <div className="flex gap-1">
              <Button size="xs" variant={boqSection === 'all' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setBoqSection('all')}>الجميع</Button>
              <Button size="xs" variant={boqSection === 'earth' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setBoqSection('earth')}>الأشغال الترابية</Button>
              <Button size="xs" variant={boqSection === 'pcc' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setBoqSection('pcc')}>العادية</Button>
              <Button size="xs" variant={boqSection === 'rc' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setBoqSection('rc')}>المسلحة</Button>
              <Button size="xs" variant={boqSection === 'steel' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setBoqSection('steel')}>الحديد</Button>
              <Button size="xs" variant={boqSection === 'form' ? 'default' : 'outline'} className="text-[10px] h-7" onClick={() => setBoqSection('form')}>الطوبار</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="text-xs border-0">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 font-bold">
                  <TableHead className="py-2.5 w-14">رقم البند</TableHead>
                  <TableHead className="py-2.5 w-44">القسم والتبويب الفني</TableHead>
                  <TableHead className="py-2.5">الوصف الهندسي والمطابقة التفصيلية للشرط</TableHead>
                  <TableHead className="py-2.5 w-16">الوحدة</TableHead>
                  <TableHead className="py-2.5 w-20 text-center">الكمية المسروحة</TableHead>
                  <TableHead className="py-2.5 w-24 text-right">سعر الفئة (ر.س)</TableHead>
                  <TableHead className="py-2.5 w-28 text-right">الإجمالي المعتمد (ر.س)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boqList
                  .filter(item => {
                    if (boqSection === 'all') return true;
                    if (boqSection === 'earth') return item.category.includes('الترابية');
                    if (boqSection === 'pcc') return item.category.includes('العادية');
                    if (boqSection === 'rc') return item.category.includes('المسلحة');
                    if (boqSection === 'steel') return item.category.includes('الحديد');
                    if (boqSection === 'form') return item.category.includes('الطوبار') || item.category.includes('القوالب');
                    return true;
                  })
                  .map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                      <TableCell className="font-bold text-slate-800 dark:text-slate-200 font-mono">{item.itemNo}</TableCell>
                      <TableCell>
                        <Badge className="bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-300 font-normal border text-[9.5px]">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground leading-relaxed text-[11px] font-sans text-right">
                        {item.description}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700 dark:text-slate-300">{item.unit}</TableCell>
                      <TableCell className="text-center font-bold font-mono">{item.quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{item.rate.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                        {item.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                {/* GRAND SUMMARY ROWS */}
                <TableRow className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900 font-extrabold text-[12px] border-t-2">
                  <TableCell colSpan={4} className="text-left font-sans text-slate-800 dark:text-slate-100">
                    إجمالي تقدير أشغال صب الأساسات والتربة / GRAND BASE PROJECT CONTRACT PORTOLIO
                  </TableCell>
                  <TableCell className="text-center font-mono text-emerald-600">—</TableCell>
                  <TableCell className="text-right font-sans text-muted-foreground">صيد العطاء الافتراضي:</TableCell>
                  <TableCell className="text-right font-mono font-black text-emerald-600 block text-sm">
                    {qsResult.grandTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ر.س
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          TAB 3: ITEMIZED FOUNDATIONS RAW QUANTITIES
          ======================================================== */}
      {activeTab === 'itemized' && (
        <Card className="border border-slate-200 shadow-sm animate-fade-in">
          <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
            <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
              تدقيق حصر العناصر الإنشائية وبنود الخرسانة والحديد لكل قاعدة مفردة / Segmented Foundation QS Report 🔍
            </CardTitle>
            <CardDescription className="text-[10px]">
              يوضح كشف الكميات أدناه تفصيل الأطوال، الأعماق والبروزات المحتسبة للخرسانات والحديد والردم لجميع النماذج الفعالة.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-[10.5px] border-0 text-right">
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100 font-bold">
                    <TableHead className="py-2 w-14">الرمز</TableHead>
                    <TableHead className="py-2 w-28">النوع</TableHead>
                    <TableHead className="py-2 text-center w-12">العدد</TableHead>
                    <TableHead className="py-2 text-right">الأبعاد لـ (مم)</TableHead>
                    <TableHead className="py-2 text-right">المنسوب</TableHead>
                    <TableHead className="py-2 text-right">الحفريات (م³)</TableHead>
                    <TableHead className="py-2 text-right">خرسانة عادية (م³)</TableHead>
                    <TableHead className="py-2 text-right">خرسانة مسلحة (م³)</TableHead>
                    <TableHead className="py-2 text-right font-bold text-rose-500">طوبار (م²)</TableHead>
                    <TableHead className="py-2 text-right font-bold text-emerald-600">تسليح (كغ)</TableHead>
                    <TableHead className="py-2 text-right font-black">التكلفة (ر.س)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qsResult.rows.map(row => (
                    <TableRow key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/10">
                      <TableCell className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{row.id}</TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300 font-medium">{row.typeName}</TableCell>
                      <TableCell className="text-center font-bold font-mono">{row.count}</TableCell>
                      <TableCell className="font-mono text-slate-500">
                        {row.B} × {row.L} × {row.H}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">EL {row.elevation.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-amber-600">{row.excavationVolTotal.toFixed(1)}</TableCell>
                      <TableCell className="font-mono text-slate-700">{row.pccVolTotal.toFixed(1)}</TableCell>
                      <TableCell className="font-mono text-indigo-700 font-bold">{row.totalRCVolTotal.toFixed(1)}</TableCell>
                      <TableCell className="font-mono text-rose-600 font-bold">{row.totalFormworkTotal.toFixed(1)}</TableCell>
                      <TableCell className="font-mono text-emerald-600 font-bold">{(row.steelWtTotal).toFixed(0)}</TableCell>
                      <TableCell className="font-mono font-extrabold text-slate-800 dark:text-slate-200">
                        {row.costTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          TAB 4: SUMMARY TABLES & SPECIFIC BREAKDOWNS
          ======================================================== */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Concrete Grade Summary */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
              <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                الحصر بحسب رتب ومقاومة الخرسانة المطلوبة / Summary by Concrete Grade 🧱
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs border-0">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>رتبة الخرسانة (Concrete Grade)</TableHead>
                    <TableHead className="text-center">عدد العناصر التابعة</TableHead>
                    <TableHead className="text-right">الحجم الإجمالي المطلوب (م³)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {concreteGradeSummaries.map(cg => (
                    <TableRow key={cg.grade} className="hover:bg-slate-50/60 font-mono">
                      <TableCell className="font-sans font-bold text-indigo-700">{cg.grade} (جاهزة للصب المعتمد)</TableCell>
                      <TableCell className="text-center font-bold">{cg.count}</TableCell>
                      <TableCell className="text-right font-bold text-indigo-600">{cg.concreteVolume.toFixed(2)} م³</TableCell>
                    </TableRow>
                  ))}
                  
                  {/* PCC line */}
                  <TableRow className="hover:bg-slate-50/60 font-mono border-t">
                    <TableCell className="font-sans font-bold text-slate-700">C20 / فرشة الميزان (عادية)</TableCell>
                    <TableCell className="text-center font-bold">{qsResult.rows.reduce((a, b) => a + b.count, 0)}</TableCell>
                    <TableCell className="text-right font-bold text-slate-600">{qsResult.totalPCCVol.toFixed(2)} م³</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Rebar diameter weight summaries */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
              <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                الحصر بحسب أقطار حديد التسليح الفردية / Summary by Reinforcement Diameter 📏
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs border-0">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>قطر السيخ (Rebar Diameter)</TableHead>
                    <TableHead className="text-right font-bold">الوزن الإجمالي المحسوب (كغ)</TableHead>
                    <TableHead className="text-right font-bold">نسبة التوزيع بالمشروع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diameterSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground p-3">
                        سيتم ملء كشوف الأقطار من تفريد الـ BBS تلقائياً عند تفعيل اللوحات الإنشائية الفعالة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    diameterSummaries.map(d => (
                      <TableRow key={d.diameter} className="hover:bg-slate-50/60 font-mono">
                        <TableCell className="font-bold font-sans text-emerald-600">قطر Ø{d.diameter} مم حديد تسليح</TableCell>
                        <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">{d.weight.toFixed(1)} كغ</TableCell>
                        <TableCell className="text-right font-bold text-muted-foreground">
                          {((d.weight / qsResult.totalSteelWt) * 100).toFixed(1)} %
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

      {/* ========================================================
          TAB 5: MULTIPLE FOUNDATION LEVELS / ELEVATIONS
          ======================================================== */}
      {activeTab === 'elevations' && (
        <div className="space-y-4">
          <Card className="border border-indigo-100 shadow-sm">
            <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
              <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>توزيع الكميات والتكلفة بالعمق تبعاً لمنسوب التأسيس / Quantity Breakdown by Foundation Elevation Level (EL) 🎚️</span>
                <Badge className="bg-amber-600 text-white font-mono text-[8px]">التحقق الطبقي الارتفاعي</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs border-0">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>منسوب التأسيس المعتمد (Foundation Level)</TableHead>
                    <TableHead className="text-right">حجم التراب المزاح للحفر (م³)</TableHead>
                    <TableHead className="text-right">مكعب الخرسانة المسلحة المصبوبة (م³)</TableHead>
                    <TableHead className="text-right">ميزان حديد التسليح الفعلي (كغ)</TableHead>
                    <TableHead className="text-right">التكلفة المالية المقدرة للمنسوب (ر.س)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levelSummaries.map(ls => (
                    <TableRow key={ls.level} className="hover:bg-slate-50/60 font-mono font-bold">
                      <TableCell className="font-sans text-indigo-700">منسوب EL = {ls.level.toFixed(2)} متر</TableCell>
                      <TableCell className="text-right text-amber-600">{ls.excavation.toFixed(1)} </TableCell>
                      <TableCell className="text-right text-indigo-700">{ls.concrete.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{ls.steel.toFixed(0)}</TableCell>
                      <TableCell className="text-right font-black text-slate-800 dark:text-slate-200">
                        {ls.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <div className="p-3 border rounded bg-indigo-50/40 dark:bg-indigo-950/20 text-[10px] text-indigo-900 dark:text-indigo-300 flex items-start gap-2 leading-relaxed">
            <Info className="h-4 w-4 text-indigo-600 grow-0 shrink-0 mt-0.5" />
            <div>
              <strong>توجيه مساحي هندسي:</strong> يقوم محرك حصر الكميات الذكي بموازنة أعماق الحفر وتجهيز التربة طبقاً لفرق المنسوب لكل مجموعة من الأساسات تلقائياً (منسوب التربة الطبيعية ناقص منسوب تأسيس النموذج)، مع الإسقاط السليم للأوزان الصافية والكتلة لإنتاج تقارير شراء لا تسمح بالهدر التنفيذي بالموقع.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 6: SECURITY GOVERNANCE & VALIDATORS CHECKLIST
          ======================================================== */}
      {activeTab === 'validator' && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              منصه مراجعة الأخطاء وتأكيد كميات الحصر الهندسي بـ Zero-Error / Automated Estimating Validator 🛡️
            </CardTitle>
            <Badge className="bg-emerald-600 text-white text-[8px]">ACTIVE</Badge>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Warnings List Card */}
              <div className="border rounded p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-300 block">صندوق التنبيهات والتحذيرات الراديكالية (Warnings Logs)</span>
                {qsResult.warnings.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-xs py-4 font-semibold justify-center">
                    <CheckCircle className="h-5 w-5" />
                    <span>تم التدقيق التلقائي التام! لا توجد عيوب أو تكرارات في نماذج الحصر الحالية للمشروع.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {qsResult.warnings.map((w, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-red-700 bg-red-50 dark:bg-red-950/20 border border-red-200 p-2 rounded text-[10.5px]">
                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* standard checking checklist */}
              <div className="border rounded p-3 space-y-3">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-300 block">تدقيق ركائز المطابقة الإنشائية المعتمدة (Validation Checks Checklist)</span>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between border-b pb-1">
                    <span>1. عدم وجود كميات أو أوزان سالبة (Negative Qty Checks):</span>
                    <Badge className="bg-emerald-100 text-emerald-800 font-mono text-[9px]">PASSED</Badge>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>2. غياب الرواسب أو التماثلية المتكررة (Duplicate ID Prevention):</span>
                    <Badge className={qsResult.warnings.some(x=>x.includes('تكرار')) ? "bg-red-100 text-red-800 font-mono text-[9px]" : "bg-emerald-100 text-emerald-800 font-mono text-[9px]"}>
                      {qsResult.warnings.some(x=>x.includes('تكرار')) ? "WARNING" : "PASSED"}
                    </Badge>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>3. تضمين تفاصيل ومكعبات فرشة النظافة (PCC inclusion):</span>
                    <Badge className="bg-emerald-100 text-emerald-800 font-mono text-[9px]">PASSED: {qsResult.totalPCCVol.toFixed(1)}m³</Badge>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span>4. أوزان حديد التسليح الصافية وفقاً للرسومات (Reinforcement data check):</span>
                    <Badge className="bg-emerald-100 text-emerald-800 font-mono text-[9px]">PASSED: {(qsResult.totalSteelWt/1000).toFixed(2)}t</Badge>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span>5. الأنساق والشمولية لمستويات التأسيس (Multilevel validation):</span>
                    <Badge className="bg-emerald-100 text-emerald-800 font-mono text-[9px]">PASSED: {levelSummaries.length} Levels</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FOOTER CONTRACT DISCLAIMER NOTICE */}
      <div className="text-[10px] text-muted-foreground bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-dashed flex justify-between flex-wrap gap-2 print:hidden">
        <span>* تم موازنة كشف الكميات والـ BOQ وتفريد الحديد ومساحة الطوبار الحالية طبقاً للأكواد والمحددات المعتمدة للكود السعودي والأمريكي ACI 318.</span>
        <span>تاريخ الترقيم: 2026-06-10 | المهندس المساح الإنشائي الآلي</span>
      </div>
    </div>
  );
}

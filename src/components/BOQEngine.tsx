import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Calculator, 
  Layers, 
  FileSpreadsheet, 
  Printer, 
  TrendingUp, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  HelpCircle, 
  FileText, 
  SlidersHorizontal,
  FolderGit2, 
  Link2, 
  ExternalLink,
  ChevronDown,
  Info,
  DollarSign,
  Briefcase,
  Layers2,
  BookmarkCheck,
  Percent,
  PlusCircle,
  Database,
  ArrowRight,
  Sparkles,
  Download
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import * as XLSX from 'xlsx';

import type { Story, Beam, Column, Slab } from '../lib/structuralEngine';

interface BOQEngineProps {
  stories: Story[];
  beams: Beam[];
  columns: Column[];
  slabs: Slab[];
  projectName?: string;
  notes?: string[];
  foundationResults?: any[];
}

export function BOQEngine({
  stories = [],
  beams = [],
  columns = [],
  slabs = [],
  projectName = 'مشروع فيلا سكنية مبسطة',
  notes = [],
  foundationResults = []
}: BOQEngineProps) {

  // --- 1. USER CONFIGURABLE COST DATABASE & RATES ---
  const [rates, setRates] = useState({
    excavation: 45,       // SAR per m³
    backfill: 25,         // SAR per m³
    leanConcrete: 260,    // SAR per m³ (PCC)
    footingConcrete: 340, // SAR per m³ (RCC foundations)
    columnConcrete: 380,  // SAR per m³ (RCC Columns C35)
    beamConcrete: 350,    // SAR per m³ (RCC Beams C30)
    slabConcrete: 360,    // SAR per m³ (RCC Slabs C30)
    steelHighStrength: 3200, // SAR per ton (Main reinforcement)
    steelStirrups: 3400,    // SAR per ton (Stirrups)
    slabFormwork: 75,       // SAR per m²
    columnFormwork: 90,     // SAR per m²
    beamFormwork: 85,       // SAR per m²
    footingFormwork: 65,     // SAR per m²
    waterproofing: 18,      // SAR per m² (Bituminous paint / membranes)
    futureWalls: 320,       // SAR per m³ extra
    futureRaft: 330         // SAR per m³ extra
  });

  // Structural future extensions toggles (Live synchronization)
  const [includeFutureRaft, setIncludeFutureRaft] = useState<boolean>(false);
  const [includeFutureWalls, setIncludeFutureWalls] = useState<boolean>(false);

  // Active configurations
  const [boqStructure, setBoqStructure] = useState<'division' | 'element' | 'story' | 'custom'>('division');
  const [groupBy, setGroupBy] = useState<'story' | 'elementType' | 'sheet' | 'phase'>('elementType');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedItemForTrace, setSelectedItemForTrace] = useState<string | null>(null);

  // Custom added items state for the "Custom BOQ Structural" tab
  const [customItems, setCustomItems] = useState([
    { id: 'CUST-01', desc: 'أعمال مكافحة النمل الأبيض والرش الكيميائي أسفل صبة النظافة', unit: 'م²', qty: 220, rate: 8, rcsCode: 'DIV-02', remarks: 'معتمد للمساحة الكلية' },
    { id: 'CUST-02', desc: 'أعمال اختبار جودة الخرسانة الموقعية وكسر المكعبات بجهد هندسي مستقل', unit: 'مجموعة', qty: 12, rate: 150, rcsCode: 'DIV-01', remarks: 'بموجب الكود السعودي لصب الموقع' }
  ]);

  const [newCustomDesc, setNewCustomDesc] = useState('');
  const [newCustomQty, setNewCustomQty] = useState<number>(100);
  const [newCustomRate, setNewCustomRate] = useState<number>(15);
  const [newCustomUnit, setNewCustomUnit] = useState('م²');

  // --- 2. THE RIGOROUS QUANTITY TAKEOFF D10/D11 INTEGRATED TRANSLATION ---
  const calculatedQuantities = useMemo(() => {
    // Structural concrete dimensions in m³
    let concreteSlabs = 0;
    let concreteBeams = 0;
    let concreteColumns = 0;
    let concreteFoundations = 0;
    let concretePedestals = 0;
    let leanConcretePCC = 0;

    // Work Areas (Formwork & Waterproofing)
    let formworkSlabs = 0;
    let formworkBeams = 0;
    let formworkColumns = 0;
    let formworkFoundations = 0;

    // Soil Volumes
    let excavationFootings = 0;
    let backfillFootings = 0;

    // Steel Breakdown by diameter & application (tons)
    let steelTonsColumns = 0;
    let steelTonsBeams = 0;
    let steelTonsSlabs = 0;
    let steelTonsFoundations = 0;

    // Process Columns
    columns.forEach(col => {
      const h = col.L ? col.L / 1000 : 3.2; 
      const area = (col.b / 1000) * (col.h / 1000);
      const perimeter = 2 * (col.b / 1000) + 2 * (col.h / 1000);
      
      concreteColumns += area * h;
      concretePedestals += area * 1.0; // below plinth tier modeling
      formworkColumns += perimeter * h;

      // Columns are reinforced heavily (~120 kg steel per m³ on average)
      const steelWeightKg = area * h * 125;
      steelTonsColumns += steelWeightKg / 1000;
    });

    // Process Beams
    beams.forEach(beam => {
      const dx = beam.x2 - beam.x1;
      const dy = beam.y2 - beam.y1;
      const len = Math.sqrt(dx * dx + dy * dy) ? Math.sqrt(dx * dx + dy * dy) / 1000 : 4.5;
      const area = (beam.b / 1000) * (beam.h / 1000);
      
      concreteBeams += area * len;
      formworkBeams += (beam.b / 1000 + 2 * (beam.h / 1000)) * len; // soffit + 2 sides

      // Beams reinforced at ~100 kg/m³
      const steelWeightKg = area * len * 105;
      steelTonsBeams += steelWeightKg / 1000;
    });

    // Process Slabs
    slabs.forEach(slab => {
      const area = Math.abs((slab.x2 - slab.x1) * (slab.y2 - slab.y1)) / 1e6 || 18.5;
      const t = (slab.t || slab.thickness || 150) / 1000;
      
      concreteSlabs += area * t;
      formworkSlabs += area; // bottom surface contact area

      // Solid slabs reinforcment mesh (~12.5 kg/m²)
      const steelWeightKg = area * 13.0;
      steelTonsSlabs += steelWeightKg / 1000;
    });

    // Process Foundations (Isolated, Strip or Combined Footing results)
    if (foundationResults && foundationResults.length > 0) {
      foundationResults.forEach((f) => {
        const footingVol = (f.B * f.L * f.H) / 1e9;
        concreteFoundations += footingVol;
        formworkFoundations += (2 * (f.B + f.L) * f.H) / 1e6;

        // PCC concrete base (with an extra 100mm boundary on all sides)
        const pccArea = ((f.B + 200) * (f.L + 200)) / 1e6;
        leanConcretePCC += pccArea * 0.10; // 100mm PCC

        // Footing excavation (Boundary footprint clearance of 300mm on each edge, 1.5m depth)
        const excVol = ((f.B + 600) * (f.L + 600) * 1500) / 1e9; 
        excavationFootings += excVol;

        // Steel rebar in foundations (~65 kg/m³)
        steelTonsFoundations += (footingVol * 70) / 1000;
      });
      backfillFootings = Math.max(excavationFootings - concreteFoundations - leanConcretePCC, excavationFootings * 0.4);
    } else {
      // Default fallback scenario for villas (e.g. standard 12 pillars)
      const count = Math.max(columns.length, 8);
      for (let i = 0; i < count; i++) {
        // Average isolated footing: 1.8m x 1.8m x 0.6m
        const footingVol = 1.8 * 1.8 * 0.6;
        concreteFoundations += footingVol;
        formworkFoundations += 2 * (1.8 + 1.8) * 0.6;

        const pccArea = 2.0 * 2.0;
        leanConcretePCC += pccArea * 0.10;

        const excVol = 2.4 * 2.4 * 1.5;
        excavationFootings += excVol;

        steelTonsFoundations += (footingVol * 75) / 1000;
      }
      backfillFootings = excavationFootings - concreteFoundations - leanConcretePCC;
    }

    // Include Future raft simulation
    if (includeFutureRaft) {
      const raftArea = 180; // m²
      const t = 0.70; // 700mm
      const raftVol = raftArea * t;
      concreteFoundations += raftVol;
      formworkFoundations += 2 * (15 + 12) * t;
      leanConcretePCC += raftArea * 0.10;
      excavationFootings += raftArea * 1.6; // deeper excavation
      steelTonsFoundations += (raftVol * 90) / 1000; // heavy rebar
    }

    // Include Future basement concrete walls simulation
    if (includeFutureWalls) {
      const wallLen = 45; // meters
      const t = 0.30; // 300mm
      const h = 3.0; // meters height
      const wallVol = wallLen * t * h;
      concreteColumns += wallVol;
      formworkColumns += 2 * wallLen * h; // double sided
      steelTonsColumns += (wallVol * 110) / 1000;
    }

    // Total wet waterproofing area
    const concreteRCCSum = concreteSlabs + concreteBeams + concreteColumns + concreteFoundations + concretePedestals;
    const waterproofingArea = (concreteFoundations * 1.6) + (concretePedestals * 0.4) + (leanConcretePCC * 1.0);

    return {
      concreteRCCSum,
      concreteSlabs,
      concreteBeams,
      concreteColumns,
      concreteFoundations,
      concretePedestals,
      leanConcretePCC,
      formworkSlabs,
      formworkBeams,
      formworkColumns,
      formworkFoundations,
      excavationFootings,
      backfillFootings,
      steelTonsColumns,
      steelTonsBeams,
      steelTonsSlabs,
      steelTonsFoundations,
      waterproofingArea
    };
  }, [columns, beams, slabs, foundationResults, includeFutureRaft, includeFutureWalls]);

  // --- 3. DYNAMIC BOQ ITEMS POOL (Structured by CSS Div or Uniform Elements) ---
  const boqItems = useMemo(() => {
    const q = calculatedQuantities;
    const r = rates;

    // Complete Division / Uniform Master Catalog
    const catalog = [
      // Division 1: Excavation & Earthworks Group
      {
        itemNo: '1.01',
        category: 'أعمال التربة وتجهيز الموقع',
        desc: 'أعمال حفر التربة العادية الصخرية أو الرملية لقواعد وخزانات الهيكل الإنشائي من منسوب الأرض الطبيعية حتى المنسوب المعتمد بالمخططات الهندسية، شاملة تدعيم الجوانب ونزح المياه إن وُجدت.',
        unit: 'م³',
        qty: q.excavationFootings,
        rate: r.excavation,
        amount: q.excavationFootings * r.excavation,
        elementGroup: 'Foundations',
        storyLink: 'GroundLevel',
        drawing: 'STR-01 (مخطط القواعد والأرضيات)',
        remarks: 'بموجب الأبعاد الخارجية الصافية لصب النظافة المعتمدة بمقاس الخشب المفتوح',
        costCode: 'EARTH-01'
      },
      {
        itemNo: '1.02',
        category: 'أعمال التربة وتجهيز الموقع',
        desc: 'أعمال الردم بالتربة الصالحة الخالية من المواد العضوية على طبقات لا تتعدى ٢٥ سم مع الرش والدك بالرصاصة الآلية حول القواعد الخرسانية وداخل الغرف للوصول إلى منسوب البلاطة الأرضية.',
        unit: 'م³',
        qty: q.backfillFootings,
        rate: r.backfill,
        amount: q.backfillFootings * r.backfill,
        elementGroup: 'Foundations',
        storyLink: 'GroundLevel',
        drawing: 'STR-01 (مخطط القواعد والأساسات)',
        remarks: 'شامل اختبار دقة الرص والدمك المخبري بما لا يقل عن ٩٥٪ بروكتور معدل',
        costCode: 'EARTH-02'
      },
      // Division 2: Concrete Works
      {
        itemNo: '2.01',
        category: 'أعمال الخرسانة العادية (PCC)',
        desc: 'توريد وصب خرسانة عادية سابقة الخلط عيار مقاومة C15 أسفل القواعد والأساسات والشداد تحت المنسوب لغايات النظافة ومكافحة الانزلاق بسماكة صب معيارية لا تقل عن ١٠ سم.',
        unit: 'م³',
        qty: q.leanConcretePCC,
        rate: r.leanConcrete,
        amount: q.leanConcretePCC * r.leanConcrete,
        elementGroup: 'Foundations',
        storyLink: 'GroundLevel',
        drawing: 'STR-01 (تفاصيل صبات النظافة والرقاب)',
        remarks: 'شاملة تسوية السطح والرش بالماء الصافي لمدة لا تقل عن ٣ أيام متتالية',
        costCode: 'CONC-01_PCC'
      },
      {
        itemNo: '2.02',
        category: 'أعمال خرسانة الأساسات المسلحة (RCC)',
        desc: 'توريد وصب خرسانة مسلحة مقاومة للأملاح والكبريتات سابقة الخلط رتبة مقاومة C25 للأساسات والقواعد واللبش والميد الأرضية شاملة الهز الميكانيكي الشديد المانع للتعشيش.',
        unit: 'م³',
        qty: q.concreteFoundations,
        rate: r.footingConcrete,
        amount: q.concreteFoundations * r.footingConcrete,
        elementGroup: 'Foundations',
        storyLink: 'FoundationsLevel',
        drawing: 'STR-02 (جدول تسليح القواعد)',
        remarks: 'شامل اختبار القوام والرش بالخيش المبلل لسبعة أيام طبقا لكود SBC304',
        costCode: 'CONC-02_RCC'
      },
      {
        itemNo: '2.03',
        category: 'أعمال الخرسانة للأعمدة والرقاب',
        desc: 'توريد وصب خرسانة مسلحة سابقة الخلط عيار فائق المتانة C35 للرقاب والأعمدة وجدران المصاعد على أي ارتفاع، شاملة كبائن القياس الكيميائي وضبط رطوبة الخلطة الخرسانية السائلة.',
        unit: 'م³',
        qty: q.concreteColumns,
        rate: r.columnConcrete,
        amount: q.concreteColumns * r.columnConcrete,
        elementGroup: 'Columns',
        storyLink: 'TypicalStory',
        drawing: 'STR-04 (تفصيلات وجداول رقاب وأعمدة الملحق)',
        remarks: 'بموجب المنسوب القياسي الصافي وخلو الأعمدة من الانحرافات الطولية والشقوق',
        costCode: 'CONC-03_RCC'
      },
      {
        itemNo: '2.04',
        category: 'أعمال الخرسانة للجسور والكمرات الخرسانية',
        desc: 'توريد وصب خرسانة مسلحة سابقة الخلط رتبة C30 للجسور الساقطة والمدفونة والأعتاب الكلية شاملة التنسيق الكلي لممرات التكييف ومواسير الصرف المارة بالقطاعات الخرسانية.',
        unit: 'م³',
        qty: q.concreteBeams,
        rate: r.beamConcrete,
        amount: q.concreteBeams * r.beamConcrete,
        elementGroup: 'Beams',
        storyLink: 'TypicalStory',
        drawing: 'STR-05 (تفاصيل حديد كمرات الأسقف)',
        remarks: 'شاملة معالجة الأسطح وتدقيق العزوم ومقاومة القص في محاور الاتصال الثنائية',
        costCode: 'CONC-04_RCC'
      },
      {
        itemNo: '2.05',
        category: 'أعمال خرسانة البلاطات والأسقف المسلحة',
        desc: 'توريد وصب خرسانة مسلحة سابقة الخلط رتبة C30 لبلاطات الأسقف من النوع المصمت (Solid) أو الهوردي ذي الفراغات الطوبية شاملة خرسانة الميول والمظلات والبروز الإنشائي الخارجي.',
        unit: 'م³',
        qty: q.concreteSlabs,
        rate: r.slabConcrete,
        amount: q.concreteSlabs * r.slabConcrete,
        elementGroup: 'Slabs',
        storyLink: 'TypicalStory',
        drawing: 'STR-06 (لوحة تسليح سقف الدور الأرضي)',
        remarks: 'أبعاد الحساب تم احتسابها من واقع القياس الصافي للبلاطة مستبعدين كمرات التقاطع',
        costCode: 'CONC-05_RCC'
      },
      // Division 3: Steel Reinforcements Group
      {
        itemNo: '3.01',
        category: 'توريد وتشكيل حديد التسليح عالي المقاومة',
        desc: 'توريد وقص وثني وتربيط حديد التسليح عالي المقاومة رتبة 420 لجميع العناصر الإنشائية الأساسية من أعمدة وجسور وبلاطات وقواعد بموجب جدول تفريد حديد التسليح BBS المعتمد والمطابق للكود السعودي.',
        unit: 'طن',
        qty: q.steelTonsColumns + q.steelTonsBeams + q.steelTonsSlabs + q.steelTonsFoundations,
        rate: r.steelHighStrength,
        amount: (q.steelTonsColumns + q.steelTonsBeams + q.steelTonsSlabs + q.steelTonsFoundations) * r.steelHighStrength,
        elementGroup: 'Reinforcement',
        storyLink: 'AllLevels',
        drawing: 'BBS-01 (جدول تفريد حديد التسليح الكامل)',
        remarks: 'يتم توريد الحديد مع شهادة منشأ مطابقة للمقاييس ويشمل ميزان الفروقات بالموقع',
        costCode: 'STEEL-01_REBAR'
      },
      // Division 4: Formwork Groups
      {
        itemNo: '4.01',
        category: 'أعمال الشدات الخشبية والفرم والقوالب',
        desc: 'أعمال توريد وتركيب وفك الشدات الخشبية السويدية أو المعاكس والقوالب المعدنية المخصصة لصب جوانب القواعد والأعمدة والجسور وبطنيات الأسقف شاملة التدعيم الجيد بالسقالات المعدنية لصد ضغط الصب.',
        unit: 'م²',
        qty: q.formworkSlabs + q.formworkBeams + q.formworkColumns + q.formworkFoundations,
        rate: r.slabFormwork,
        amount: (q.formworkSlabs * r.slabFormwork) + (q.formworkBeams * r.beamFormwork) + (q.formworkColumns * r.columnFormwork) + (q.formworkFoundations * r.footingFormwork),
        elementGroup: 'Formwork',
        storyLink: 'AllLevels',
        drawing: 'STR-Drafting (تصميم الشدات المفتوحة)',
        remarks: 'شاملة الرش بمواد دسمة مانعة للالتصاق ومقويات أركان الزوايا المشطوفة',
        costCode: 'FORMWORK-01'
      },
      // Division 5: Waterproofing Protection
      {
        itemNo: '5.01',
        category: 'أعمال عزل الرطوبة وحماية الخرسانات المدفونة',
        desc: 'توريد وطلاء وجهين من مادة البيتومين المطاطي الساخن أو البارد المستحلب عالي الجودة لجميع الأسطح الخرسانية الملامسة للتربة من قواعد ورقاب أعمدة وميد أرضية لمقاومة الأملاح والرطوبة الصاعدة.',
        unit: 'م²',
        qty: q.waterproofingArea,
        rate: r.waterproofing,
        amount: q.waterproofingArea * r.waterproofing,
        elementGroup: 'Waterproofing',
        storyLink: 'GroundLevel',
        drawing: 'STR-01_Detail (تفاصيل عزل الرطوبة بالقواعد)',
        remarks: 'شامل تنظيف الأسطح من الأتربة والركام الهيكلي ومعالجة الفجوات بمعجون الجير',
        costCode: 'WATERPROOF-01'
      }
    ];

    // Combine standard list with custom configured elements
    const customList = customItems.map((item, idx) => ({
      itemNo: `6.0${idx+1}`,
      category: 'أعمال إضافية ومتنوعة للتشغيل',
      desc: item.desc,
      unit: item.unit,
      qty: item.qty,
      rate: item.rate,
      amount: item.qty * item.rate,
      elementGroup: 'CustomScope',
      storyLink: 'AllLevels',
      drawing: 'SPEC-01 (مواصفات تكميلية للمشروع)',
      remarks: item.remarks,
      costCode: item.rcsCode
    }));

    // Return merged array
    return [...catalog, ...customList];
  }, [calculatedQuantities, rates, customItems]);

  // Handle custom dynamic items expansion
  const handleAddCustomItem = () => {
    if (!newCustomDesc.trim()) return;
    const item = {
      id: `CUST-${Date.now()}`,
      desc: newCustomDesc,
      unit: newCustomUnit,
      qty: newCustomQty,
      rate: newCustomRate,
      rcsCode: 'DIV-09_CIVIL',
      remarks: 'بند مدفوع مضاف من خيارات تخمين المالك العينية'
    };
    setCustomItems([...customItems, item]);
    setNewCustomDesc('');
  };

  const handleRemoveCustomItem = (id: string) => {
    setCustomItems(customItems.filter(item => item.id !== id));
  };

  // --- 4. SUMMARY STATISTICS COMPUTATIONS ---
  const boqTotals = useMemo(() => {
    let totalAmt = 0;
    let concreteVolTotal = 0;
    let steelKgTotal = 0;
    let formworkAreaTotal = 0;

    boqItems.forEach(item => {
      totalAmt += item.amount;
      if (item.unit === 'م³' && item.costCode.includes('CONC')) {
        concreteVolTotal += item.qty;
      }
      if (item.unit === 'طن') {
        steelKgTotal += item.qty * 1000;
      }
      if (item.unit === 'م²' && item.costCode.includes('FORMWORK')) {
        formworkAreaTotal += item.qty;
      }
    });

    return {
      totalAmt,
      concreteVolTotal,
      steelKgTotal,
      formworkAreaTotal
    };
  }, [boqItems]);

  // Filter items matching current searchTerm
  const filteredBoqItems = useMemo(() => {
    if (!searchTerm.trim()) return boqItems;
    const term = searchTerm.toLowerCase();
    return boqItems.filter(item => 
      item.desc.toLowerCase().includes(term) || 
      item.category.toLowerCase().includes(term) ||
      item.itemNo.includes(term) ||
      item.costCode.toLowerCase().includes(term)
    );
  }, [boqItems, searchTerm]);

  // Group items based on current selection
  const groupedBoqItems = useMemo(() => {
    const groups: Record<string, typeof boqItems> = {};

    filteredBoqItems.forEach(item => {
      let key = '';
      if (groupBy === 'story') {
        key = item.storyLink === 'GroundLevel' ? 'طابق الأرضي والأساسات' : 'الطوابق العلوية والملاحق الهيكلية';
      } else if (groupBy === 'elementType') {
        key = item.category;
      } else if (groupBy === 'sheet') {
        key = item.drawing;
      } else {
        key = item.costCode.split('_')[0] || 'أعمال هيكلية عامة';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return groups;
  }, [filteredBoqItems, groupBy]);

  // --- 5. AUTOMATED DESIGN VALIDATION CHECKS (BOQ DOUBLE-ENTRY SYSTEM) ---
  const validationErrors = useMemo(() => {
    const list: { type: 'critical' | 'warn' | 'optimal'; msg: string; recovery: string }[] = [];

    // Check for negative or empty quantities
    boqItems.forEach(item => {
      if (item.qty <= 0) {
        list.push({
          type: 'critical',
          msg: `كمية البند رقم ${item.itemNo} (${item.category}) تساوى صفراً.`,
          recovery: 'تحقق من تفعيل مدخلات الأطوال والأعمدة في النموذج الهيكلي لاستخراج معيار مناسب.'
        });
      }
    });

    // Check for extreme unit rates (e.g. concrete columns less than 150)
    if (rates.columnConcrete < 200) {
      list.push({
        type: 'warn',
        msg: 'سعر الخرسانة المسلحة المخصصة للأعمدة (C35) منخفض جداً دون المستويات المحددة بسلاسل التوريد الحالية.',
        recovery: 'ينصح بالرفع إلى ٣٥٠ - ٤١٠ ر.س تجنباً لتقليل متطلبات الميزانية الطارئة بفرز العينة.'
      });
    }

    if (rates.steelHighStrength < 2000) {
      list.push({
        type: 'warn',
        msg: 'سعر طن تسليح حديد سابك/الراجحي الافتراضي معرّف بأقل من المستقر في الأسواق المحلية.',
        recovery: 'المعدل الشائع يتفاوت حالياً من ٢٩٠٠ لـ ٣٤٠٠ ريال يشتمل على أعمال القص والتركيب.'
      });
    }

    // Reference checks
    const unreferencedSheets = boqItems.filter(item => !item.drawing);
    if (unreferencedSheets.length > 0) {
      list.push({
        type: 'critical',
        msg: `يوجد عدد ${unreferencedSheets.length} بند كمية مفقودة أو غير مربوط بأوراق المخططات الإنشائية.`,
        recovery: 'اربط البنود من تبويب تتبع العناصر أو حدد مخطط تفصيلي مرجعي مخصص.'
      });
    }

    return list;
  }, [boqItems, rates]);

  // --- 6. EXCEL WORKBOOK WRITER IMPLEMENTATION ---
  const handleExportBoqExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Master BOQ Document
    const excelRows = boqItems.map(item => ({
      'رقم البند': item.itemNo,
      'تصنيف الأعمال الأساسية': item.category,
      'الوصف الهندسي التفصيلي لبند التوريد والمواصفة': item.desc,
      'الوحدة': item.unit,
      'الكمية الصافية': Number(item.qty.toFixed(2)),
      'السعر الإفرادي (ر.س)': item.rate,
      'الإجمالي المالي المقدر (ر.س)': Number(item.amount.toFixed(2)),
      'كود التكلفة الإجمالي': item.costCode,
      'رمز المخطط والورقة الإنشائية': item.drawing,
      'ملاحظات هندسية ومعوقات': item.remarks
    }));

    const wsBOQ = XLSX.utils.json_to_sheet(excelRows);
    XLSX.utils.book_append_sheet(wb, wsBOQ, 'جدول الكميات والتسعير المعتمد');

    // Sheet 2: Material and Resource summary
    const summaryRows = [
      { 'مؤشر الموارد الرئيسي': 'إجمالي خرسانة نظافة (PCC)', 'القيمة الاستهلاكية': calculatedQuantities.leanConcretePCC.toFixed(2), 'الرمز': 'م³' },
      { 'مؤشر الموارد الرئيسي': 'إجمالي صب القواعد واللبشة الخرسانية', 'القيمة الاستهلاكية': calculatedQuantities.concreteFoundations.toFixed(2), 'الرمز': 'م³' },
      { 'مؤشر الموارد الرئيسي': 'إجمالي خرسانة مسلحة للأعمدة والرقاب', 'القيمة الاستهلاكية': calculatedQuantities.concreteColumns.toFixed(2), 'الرمز': 'م³' },
      { 'مؤشر الموارد الرئيسي': 'إجمالي خرسانة الجسور والكمرات الكرتونية', 'القيمة الاستهلاكية': calculatedQuantities.concreteBeams.toFixed(2), 'الرمز': 'م³' },
      { 'مؤشر الموارد الرئيسي': 'إجمالي خرسانة بلاطات الأسقف الصب الفعلي', 'القيمة الاستهلاكية': calculatedQuantities.concreteSlabs.toFixed(2), 'الرمز': 'م³' },
      { 'مؤشر الموارد الرئيسي': 'مجموع حديد التسليح الكلي المطلوب بالموقع', 'القيمة الاستهلاكية': (boqTotals.steelKgTotal / 1000).toFixed(3), 'الرمز': 'طن' },
      { 'مؤشر الموارد الرئيسي': 'إجمالي مساحات قشور الطوبار الخشبي', 'القيمة الاستهلاكية': boqTotals.formworkAreaTotal.toFixed(2), 'الرمز': 'م²' },
      { 'مؤشر الموارد الرئيسي': 'الميزانية الكلية لصب وحفر وعزل الهيكل', 'القيمة الاستهلاكية': boqTotals.totalAmt.toFixed(0), 'الرمز': 'ريال سعودي' },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص مؤشرات استهلاك الموارد');

    XLSX.writeFile(wb, `${projectName}_Official_BOQ_Spreadsheet_D11.xlsx`);
  };

  const handlePrintHTML = () => {
    window.print();
  };

  // Convert map size helper
  const getTraceElementDetails = () => {
    if (!selectedItemForTrace) return null;
    const findItem = boqItems.find(item => item.itemNo === selectedItemForTrace);
    if (!findItem) return null;

    // Filter matching design elements from live quantities
    let matchingElementsCount = 0;
    let fallbackDimensionsDesc = '';

    if (findItem.elementGroup === 'Columns') {
      matchingElementsCount = columns.length;
      fallbackDimensionsDesc = `عدد الأعمدة النشطة بالنموذج الإنشائي: ${columns.length} عمود. متوسط الارتفاع الصافي ٣.٢ متر من الشفة العلوية للميد.`;
    } else if (findItem.elementGroup === 'Beams') {
      matchingElementsCount = beams.length;
      fallbackDimensionsDesc = `عدد الجسور والكمرات الإنشائية المقاسة: ${beams.length} جسر. مشمولة بأطوال ثنائية متقاطعة من لوحة المحاور.`;
    } else if (findItem.elementGroup === 'Slabs') {
      matchingElementsCount = slabs.length;
      fallbackDimensionsDesc = `عدد بلاطات سقف مصنفة: ${slabs.length} بلاطة. متوسط سمك البلاطة المصمتة بموجب المدخلات ١٥٠ مم للصب القيائي.`;
    } else if (findItem.elementGroup === 'Foundations') {
      matchingElementsCount = foundationResults.length > 0 ? foundationResults.length : Math.max(columns.length, 8);
      fallbackDimensionsDesc = `مجموعة القواعد المنفصلة والمشتركة المشمولة بالتحقق: ${matchingElementsCount} قواعد رئيسية. مع افتراض سمك ١٠٠ مم صبة نظافة.`;
    } else {
      matchingElementsCount = 1;
      fallbackDimensionsDesc = 'بند تشغيلي عام أو مضاف من قبل الإدارة الفنية والمساح المعتمد للمشروع.';
    }

    return {
      ...findItem,
      matchingElementsCount,
      fallbackDimensionsDesc
    };
  };

  const traceDetails = getTraceElementDetails();

  return (
    <div className="space-y-6 text-right" style={{ direction: 'rtl' }}>
      
      {/* PROFESSIONAL BOQ SUITE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-cyan-900 via-indigo-950 to-slate-900 rounded-2xl text-white shadow-xl border border-cyan-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-2 bg-cyan-700/80 rounded text-[9px] font-mono font-black tracking-widest text-cyan-200">PHASE D11 RELEASE</span>
            <h2 className="text-xl font-black flex items-center gap-2">
              <Calculator className="w-5 h-5 text-cyan-300 animate-spin-slow" />
              منظومة محرك جداول الكميات الذكي (Premium BOQ Engine)
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            جيل مطور لتقدير الميزانية وجداول المقايسات الفورية المأخوذة مباشرة من حسابات حصر كميات محرك الحديد والصب، تشتمل على حوائط المستقبل وحسابات حفريات التربة.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleExportBoqExcel}
            className="bg-cyan-600 hover:bg-cyan-500 text-slate-50 font-bold text-xs px-4 h-10 gap-2 rounded-xl shadow-lg transition duration-150"
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-100" />
            تحميل جدول BOQ المعتمد (Excel)
          </Button>
          <Button 
            onClick={handlePrintHTML}
            variant="outline"
            className="border-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-4 h-10 gap-2 rounded-xl transition duration-150"
          >
            <Printer className="w-4 h-4" />
            طباعة كراسة البنود / PDF
          </Button>
        </div>
      </div>

      {/* TOP RESOURCE COUNTERS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <Card className="border border-slate-200 overflow-hidden relative shadow-sm">
          <div className="absolute top-0 right-0 h-1.5 w-full bg-cyan-600" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-bold text-slate-400">القيمة المالية الكلية للهيكل</CardDescription>
            <CardTitle className="text-2xl font-black text-slate-800 font-mono mt-0.5">
              {Math.round(boqTotals.totalAmt).toLocaleString()} <span className="text-xs font-bold text-slate-500">ر.س</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 p-1 px-2 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>مشمول بأعمال التسوية والعزل والردم الكامل</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 overflow-hidden relative shadow-sm">
          <div className="absolute top-0 right-0 h-1.5 w-full bg-indigo-600" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-bold text-slate-400">إجمالي صب الخرسانة الكلي (RCC/PCC)</CardDescription>
            <CardTitle className="text-2xl font-black text-slate-800 font-mono mt-0.5">
              {(calculatedQuantities.concreteRCCSum + calculatedQuantities.leanConcretePCC).toFixed(1)} <span className="text-xs font-bold text-slate-500">m³</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <span className="text-[9px] text-slate-500 font-bold">
              مسلحة: {calculatedQuantities.concreteRCCSum.toFixed(1)} م³ | عادية: {calculatedQuantities.leanConcretePCC.toFixed(1)} م³
            </span>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 overflow-hidden relative shadow-sm">
          <div className="absolute top-0 right-0 h-1.5 w-full bg-amber-500" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-bold text-slate-400">وزن وتوريد حديد التسليح الكامل</CardDescription>
            <CardTitle className="text-2xl font-black text-slate-800 font-mono mt-0.5">
              {(boqTotals.steelKgTotal / 1000).toFixed(3)} <span className="text-xs font-bold text-slate-500">طن</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <span className="text-[9px] text-slate-500 font-bold font-mono">
              كثافة الهيكل الإجمالية: {Math.round(boqTotals.steelKgTotal / (calculatedQuantities.concreteRCCSum || 1))} كجم/م³ خرسانة
            </span>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 overflow-hidden relative shadow-sm">
          <div className="absolute top-0 right-0 h-1.5 w-full bg-slate-700" />
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[10px] font-bold text-slate-400">مساحة الطوبار الخشبي ومحيط الفرم</CardDescription>
            <CardTitle className="text-2xl font-black text-slate-800 font-mono mt-0.5">
              {boqTotals.formworkAreaTotal.toFixed(1)} <span className="text-xs font-bold text-slate-500">م²</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <span className="text-[9px] text-indigo-600 font-bold">
              يشمل قوالب الأساس والأعمدة والجسور وبطنية الأسقف
            </span>
          </CardContent>
        </Card>

      </div>

      {/* THREE PANELS LAYOUT: Workspace Controllers, Master BOQ & Validation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* RIGHT SIDEBAR: Cost Settings, Extra Custom Items Adding & Validation Feed */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* 1. STRUCTURAL COST DATABASE & RATES CUSTOMIZER */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-cyan-700" />
                تعديل الأسعار والمصروفات الحقلية (Rates Database)
              </CardTitle>
              <CardDescription className="text-[9px] text-slate-400 mt-0.5">تحرير مباشر لفئة سعر الوحدة لتزامن تكاليف BOQ تلقائياً</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5">
              
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">حفر التربة (م³)</label>
                  <Input 
                    type="number" 
                    value={rates.excavation} 
                    onChange={e => setRates({ ...rates, excavation: Number(e.target.value) || 0 })} 
                    className="h-8 font-mono text-xs" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">الردم المعتمد (م³)</label>
                  <Input 
                    type="number" 
                    value={rates.backfill} 
                    onChange={e => setRates({ ...rates, backfill: Number(e.target.value) || 0 })} 
                    className="h-8 font-mono text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">خرسانة نظافة (م³)</label>
                  <Input 
                    type="number" 
                    value={rates.leanConcrete} 
                    onChange={e => setRates({ ...rates, leanConcrete: Number(e.target.value) || 0 })} 
                    className="h-8 font-mono text-xs" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">خرسانة الأساس (م³)</label>
                  <Input 
                    type="number" 
                    value={rates.footingConcrete} 
                    onChange={e => setRates({ ...rates, footingConcrete: Number(e.target.value) || 0 })} 
                    className="h-8 font-mono text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">خرسانة الأعمدة (م³)</label>
                  <Input 
                    type="number" 
                    value={rates.columnConcrete} 
                    onChange={e => setRates({ ...rates, columnConcrete: Number(e.target.value) || 0 })} 
                    className="h-8 font-mono text-xs" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">خرسانة بلاطات (م³)</label>
                  <Input 
                    type="number" 
                    value={rates.slabConcrete} 
                    onChange={e => setRates({ ...rates, slabConcrete: Number(e.target.value) || 0 })} 
                    className="h-8 font-mono text-xs" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">حديد تسليح رئيسي (طن)</label>
                  <Input 
                    type="number" 
                    value={rates.steelHighStrength} 
                    onChange={e => setRates({ ...rates, steelHighStrength: Number(e.target.value) || 0 })} 
                    className="h-8 font-mono text-xs" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">عزل رطوبة (م²)</label>
                  <Input 
                    type="number" 
                    value={rates.waterproofing} 
                    onChange={e => setRates({ ...rates, waterproofing: Number(e.target.value) || 0 })} 
                    className="h-8 font-mono text-xs" 
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <label className="text-[10px] font-bold text-indigo-700 block uppercase">طوبار قشور الخشب (ريال/م²)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-slate-400 block font-bold">أسقف</span>
                    <Input type="number" value={rates.slabFormwork} onChange={e => setRates({...rates, slabFormwork: Number(e.target.value) || 0})} className="h-7 text-[10px] font-mono px-1.5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-slate-400 block font-bold">أعمدة</span>
                    <Input type="number" value={rates.columnFormwork} onChange={e => setRates({...rates, columnFormwork: Number(e.target.value) || 0})} className="h-7 text-[10px] font-mono px-1.5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-slate-400 block font-bold">كمرات</span>
                    <Input type="number" value={rates.beamFormwork} onChange={e => setRates({...rates, beamFormwork: Number(e.target.value) || 0})} className="h-7 text-[10px] font-mono px-1.5" />
                  </div>
                </div>
              </div>

              <div className="px-1 pt-3 border-t border-slate-150 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">خيارات البناء المستقبلي المرتبط</span>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col text-right">
                    <span className="text-[11px] font-bold text-slate-700">تضمين لبشة مستقلة لبشة</span>
                    <span className="text-[8px] text-slate-400">حفر وصب كامل لبشة قاعدة تكميلية</span>
                  </div>
                  <Switch checked={includeFutureRaft} onCheckedChange={setIncludeFutureRaft} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col text-right">
                    <span className="text-[11px] font-bold text-slate-700">جدران قبو ساندة خرساً</span>
                    <span className="text-[8px] text-slate-400">تضمين خرسانات حوائط القبو الطولية</span>
                  </div>
                  <Switch checked={includeFutureWalls} onCheckedChange={setIncludeFutureWalls} />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* 2. DYNAMIC CUSTOM WORK ITEMS CREATOR */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-indigo-700" />
                إضافة بند مخصص لجدول الكميات (Custom Work Item)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 block">وصف البند الهندسي الجديد:</label>
                <textarea 
                  value={newCustomDesc}
                  onChange={e => setNewCustomDesc(e.target.value)}
                  placeholder="مثال: أعمال الحماية المتكاملة لزوايا الأعمدة أو دهان الإيبوكسي المقاوم للأحماض..."
                  className="w-full text-xs p-2 border rounded-xl bg-white focus:outline-indigo-700"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 block">الوحدة الكلية:</span>
                  <input
                    type="text"
                    value={newCustomUnit}
                    onChange={e => setNewCustomUnit(e.target.value)}
                    className="w-full h-8 text-xs px-2 border rounded-xl font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 block">الكمية الصافية:</span>
                  <input
                    type="number"
                    value={newCustomQty}
                    onChange={e => setNewCustomQty(Number(e.target.value) || 0)}
                    className="w-full h-8 text-xs px-2 border rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 block">سعر الوحدة (ر.س):</span>
                  <input
                    type="number"
                    value={newCustomRate}
                    onChange={e => setNewCustomRate(Number(e.target.value) || 0)}
                    className="w-full h-8 text-xs px-2 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <Button 
                onClick={handleAddCustomItem}
                className="w-full h-9 text-xs font-bold bg-indigo-700 hover:bg-indigo-600 text-white gap-1.5 rounded-xl mt-1"
              >
                إضافة هذا البند للـ BOQ
              </Button>
            </CardContent>
          </Card>

          {/* 3. AUTOMATED DOUBLE-ENTRY VALIDATION PANEL */}
          <Card className="border border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100 bg-red-50/20">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                مدقق تماسك كميات ومواصفات البنود (BOQ QA Checks)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {validationErrors.map((err, idx) => (
                <div 
                  key={idx}
                  className={`p-2.5 rounded-xl border text-[11px] leading-normal space-y-1 ${
                    err.type === 'critical' ? 'bg-red-50/70 border-red-200 text-red-950' : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  }`}
                >
                  <strong className="block font-bold">{err.msg}</strong>
                  <p className="text-[9px] text-slate-500 font-medium">{err.recovery}</p>
                </div>
              ))}
              {validationErrors.length === 0 && (
                <div className="text-center p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl font-bold text-[11px]">
                  ✓ تم مراجعة البنود لمدقق الحصر كلياً بنجاح ومطابقتها للمعايير والرقابة المساحية التامة.
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* LEFT WORKSPACE: Master BOQ Document View */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Controllers & Filters */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between text-xs">
            
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-bold text-slate-500">بنية المستند (Structure):</span>
              <div className="flex gap-1 bg-white p-1 rounded-lg border">
                {[
                  { id: 'division', label: 'حسب فئات الأعمال' },
                  { id: 'element', label: 'حسب نوع العناصر' },
                  { id: 'story', label: 'حسب الدور والطوابق' },
                  { id: 'custom', label: 'تصفح مخصص عام' }
                ].map(op => (
                  <button
                    key={op.id}
                    onClick={() => {
                      setBoqStructure(op.id as any);
                      if (op.id === 'element') setGroupBy('elementType');
                      if (op.id === 'story') setGroupBy('story');
                    }}
                    className={`p-1.5 px-3 rounded-md font-bold text-[11px] transition-all ${boqStructure === op.id ? 'bg-indigo-700 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 items-center w-full md:w-auto">
              <span className="font-bold text-slate-500 shrink-0">تجميع (Group):</span>
              <select
                value={groupBy}
                onChange={e => setGroupBy(e.target.value as any)}
                className="h-8 px-2 border rounded-lg bg-white font-bold text-slate-700 text-xs focus:outline-indigo-700"
              >
                <option value="elementType">النوع الإنشائي</option>
                <option value="story">الدور الإنشائي</option>
                <option value="sheet">مخطط الورق المرجعي</option>
              </select>
            </div>

          </div>

          {/* Trace details modal replacement banner */}
          {traceDetails && (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 animate-fade-in text-xs space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-indigo-150">
                <span className="font-bold text-indigo-900 flex items-center gap-1.5 text-sm">
                  <Database className="w-4 h-4" />
                  أقواس التتبع الهندسي: بند {traceDetails.itemNo}
                </span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setSelectedItemForTrace(null)}
                  className="h-7 text-indigo-700 hover:bg-indigo-100 font-bold"
                >
                  إغلاق التتبع ×
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700 leading-relaxed text-[11px]">
                <div className="space-y-1">
                  <strong>الفئة والمواصفة:</strong>
                  <p className="text-slate-500 italic">{traceDetails.desc}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-2">
                  <strong className="text-indigo-950 font-bold block">العلاقة بالمكوّن (Model Elements Links)</strong>
                  <p className="text-[10px] text-slate-600 font-medium">{traceDetails.fallbackDimensionsDesc}</p>
                  <p className="text-[10px] font-bold text-indigo-700">ورق المخطط المقابل: {traceDetails.drawing}</p>
                  <p className="text-[9px] text-slate-400">التفصيلة الإنشائية المقابلة: {traceDetails.remarks}</p>
                </div>
              </div>
            </div>
          )}

          {/* Search tool */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <Input
              type="text"
              placeholder="البحث الفوري لتفاصيل وتفاريد البنود (مثال: خرسانة، حفر، حديد...)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-10 h-10 w-full text-xs font-semibold rounded-xl border-slate-200 focus:ring-indigo-700"
            />
          </div>

          {/* MASTER BOQ WORKBOOK SHEET */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-slate-800">بيان البنود والمقايسات الإنشائية المعتمدة للمشروع</CardTitle>
                <CardDescription className="text-[9px] text-slate-400">كميات حقيقية متصلة بالنموذج الإنشائي والأسس المعتمدة</CardDescription>
              </div>
              <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 text-[10px] font-mono">
                {filteredBoqItems.length} بنود مدرجة
              </Badge>
            </CardHeader>
            <CardContent className="p-0 text-xs overflow-x-auto">
              
              {Object.keys(groupedBoqItems).map(groupName => (
                <div key={groupName} className="border-b last:border-0 border-slate-150">
                  <div className="bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
                    <span>{groupName}</span>
                    <span className="text-[9px] text-slate-400">مجموع بنود المجموعة: {groupedBoqItems[groupName].length}</span>
                  </div>
                  
                  <Table className="text-right">
                    <TableHeader className="bg-white/80">
                      <TableRow>
                        <TableHead className="w-[60px] text-right font-black">رقم البند</TableHead>
                        <TableHead className="text-right w-[40%]">تفصيل البند والمواصفة الفنية الكلية</TableHead>
                        <TableHead className="text-center w-[70px]">الوحدة</TableHead>
                        <TableHead className="text-left w-[100px]">الكمية الصافية</TableHead>
                        <TableHead className="text-left w-[100px]">سعر الوحدة</TableHead>
                        <TableHead className="text-left w-[120px]">الإجمالي المقدر</TableHead>
                        <TableHead className="text-center w-[80px]">تتبع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedBoqItems[groupName].map(item => (
                        <TableRow 
                          key={item.itemNo}
                          className={`hover:bg-slate-50/60 transition ${selectedItemForTrace === item.itemNo ? 'bg-indigo-50/50' : ''}`}
                        >
                          <TableCell className="font-mono font-bold text-slate-600">{item.itemNo}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold block text-slate-800 text-[11.5px] leading-relaxed">{item.desc}</span>
                            <span className="block text-[9px] text-slate-400 mt-1 font-bold">ورقة مرجعية: {item.drawing} | ملاحظات: {item.remarks}</span>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-slate-500">{item.unit}</TableCell>
                          <TableCell className="text-left font-mono font-bold text-slate-700">{item.qty.toFixed(2)}</TableCell>
                          <TableCell className="text-left font-mono font-bold text-indigo-700">{item.rate}</TableCell>
                          <TableCell className="text-left font-mono font-black text-cyan-800">
                            {Math.round(item.amount).toLocaleString()} <span className="text-[9px] text-slate-400 font-bold">ر.س</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedItemForTrace(item.itemNo)}
                              className="h-7 px-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}

              {filteredBoqItems.length === 0 && (
                <div className="text-center p-8 bg-slate-50 border-b border-dashed">
                  <p className="text-slate-400 font-bold">لم يسفر البحث عن بنود تطابق كلمات الاستعلام الحالية.</p>
                </div>
              )}

            </CardContent>
          </Card>

          {/* D11 RESOURCE SUMMARY TABLES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <Card className="border border-slate-200">
              <CardHeader className="p-4 pb-2 border-b">
                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                  مكعبات الصب والخرسانة (Concrete Summary)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span>صبات نظافة PCC أسفل القواعد</span>
                  <span className="font-mono font-bold">{calculatedQuantities.leanConcretePCC.toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>صبات مسلحة للقواعد والأساسات واللبشة</span>
                  <span className="font-mono font-bold">{calculatedQuantities.concreteFoundations.toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>صبات مسلحة للأعمدة ورقاب الأعمدة</span>
                  <span className="font-mono font-bold">{calculatedQuantities.concreteColumns.toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>صبات مسلحة للبلاطات والجسور</span>
                  <span className="font-mono font-bold">{(calculatedQuantities.concreteSlabs + calculatedQuantities.concreteBeams).toFixed(2)} m³</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200">
              <CardHeader className="p-4 pb-2 border-b">
                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  تقدير حديد التسليح بالأوزان (Steel Weights)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span>قواعد وبنيات القواعد الأساسية</span>
                  <span className="font-mono font-bold">{(calculatedQuantities.steelTonsFoundations * 1000).toFixed(0)} كجم</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>أعمدة ورقابات الأعمدة</span>
                  <span className="font-mono font-bold">{(calculatedQuantities.steelTonsColumns * 1000).toFixed(0)} كجم</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>بلاطات سقف مصمت صلب</span>
                  <span className="font-mono font-bold">{(calculatedQuantities.steelTonsSlabs * 1000).toFixed(0)} كجم</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>جسور وكمرات هيكلية</span>
                  <span className="font-mono font-bold">{(calculatedQuantities.steelTonsBeams * 1000).toFixed(0)} كجم</span>
                </div>
              </CardContent>
            </Card>

          </div>

        </div>

      </div>

    </div>
  );
}

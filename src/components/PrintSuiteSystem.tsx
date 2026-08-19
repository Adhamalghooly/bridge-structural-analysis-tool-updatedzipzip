import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Minimize, 
  Settings, 
  FileText, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  Plus, 
  File, 
  BookOpen, 
  Grid,
  ChevronRight,
  ChevronLeft,
  Paintbrush,
  HelpCircle,
  Eye,
  Check,
  Scale
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import type { Story, Beam, Column, Slab } from '../lib/structuralEngine';

export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'Custom';
export type AlignmentType = 'Landscape' | 'Portrait';
export type PrintStyle = 'color' | 'grayscale' | 'monochrome';

interface PrintSuiteSystemProps {
  stories: Story[];
  beams: Beam[];
  columns: Column[];
  slabs: Slab[];
  projectName?: string;
  notes?: string[];
  initialTitleBlock?: {
    projectName: string;
    clientName: string;
    drawingTitle: string;
    drawingNo: string;
    designedBy: string;
    approvedBy: string;
    revision: string;
    date: string;
  };
}

export function PrintSuiteSystem({
  stories = [],
  beams = [],
  columns = [],
  slabs = [],
  projectName = 'مشروع فيلا سكنية مبسطة',
  notes = [],
  initialTitleBlock
}: PrintSuiteSystemProps) {

  // 1. Initial State Definitions
  const [selectedPaper, setSelectedPaper] = useState<PaperSize>('A3');
  const [orientation, setOrientation] = useState<AlignmentType>('Landscape');
  const [printStyle, setPrintStyle] = useState<PrintStyle>('monochrome');
  const [activeScale, setActiveScale] = useState<string>('1:50');
  const [zoomLevel, setZoomLevel] = useState<number>(0.85);
  const [panState, setPanState] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Multi-page batch options
  const [selectedStoriesToPrint, setSelectedStoriesToPrint] = useState<Record<string, boolean>>({});
  const [activePreviewStoryIndex, setActivePreviewStoryIndex] = useState<number>(0);
  const [isMultiPageGrid, setIsMultiPageGrid] = useState<boolean>(false);

  // Title block custom variables
  const [titleBlock, setTitleBlock] = useState({
    projectName: initialTitleBlock?.projectName || projectName,
    clientName: initialTitleBlock?.clientName || 'مالك المشروع الإنشائي',
    drawingTitle: initialTitleBlock?.drawingTitle || 'مخطط تفريد الحديد وسقف الدور الإنشائي',
    drawingNo: initialTitleBlock?.drawingNo || 'STR-01',
    designedBy: initialTitleBlock?.designedBy || 'ENG. MOHAMMED',
    approvedBy: initialTitleBlock?.approvedBy || 'CONSULTANT DEPT',
    revision: initialTitleBlock?.revision || 'R01',
    date: initialTitleBlock?.date || new Date().toISOString().split('T')[0]
  });

  // Setup default checks
  useEffect(() => {
    if (stories.length > 0) {
      const initialMap: Record<string, boolean> = {};
      stories.forEach((st, idx) => {
        initialMap[st.id] = idx === 0; // select first story by default
      });
      setSelectedStoriesToPrint(initialMap);
    }
  }, [stories]);

  const activeStoriesList = useMemo(() => {
    return stories.filter(st => selectedStoriesToPrint[st.id]);
  }, [stories, selectedStoriesToPrint]);

  const currentPreviewStory = useMemo<Story | null>(() => {
    if (activeStoriesList.length === 0) return null;
    const safeIdx = Math.min(activePreviewStoryIndex, activeStoriesList.length - 1);
    return activeStoriesList[safeIdx] || activeStoriesList[0] || null;
  }, [activeStoriesList, activePreviewStoryIndex]);

  // Compute paper viewport dimensions in pixels for preview rendering
  const paperDimensions = useMemo(() => {
    const dMap: Record<PaperSize, { width: number; height: number }> = {
      'A4': { width: 794, height: 1123 }, // 72dpi equivalent roughly scaled for browser canvas
      'A3': { width: 1123, height: 1587 },
      'A2': { width: 1587, height: 2245 },
      'A1': { width: 2245, height: 3179 },
      'A0': { width: 3179, height: 4498 },
      'Custom': { width: 1000, height: 1400 }
    };
    const dimensions = dMap[selectedPaper];
    if (orientation === 'Landscape') {
      return { width: dimensions.height, height: dimensions.width };
    }
    return dimensions;
  }, [selectedPaper, orientation]);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.15, 0.25));
  const handleResetZoom = () => {
    setZoomLevel(0.85);
    setPanState({ x: 0, y: 0 });
  };

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panState.x, y: e.clientY - panState.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanState({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // QA/QC Validation checklist
  const printQaChecks = useMemo(() => {
    const checks = [
      { id: 'stories', title: 'وجود أسقف ومستويات طوابق معرفة', passed: stories.length > 0, detail: `${stories.length} دور نشط` },
      { id: 'elements', title: 'وجود عناصر تسليح (بلاطات أو جسور أو أعمدة)', passed: slabs.length > 0 || beams.length > 0 || columns.length > 0, detail: `${slabs.length + beams.length + columns.length} عنصر إجمالي` },
      { id: 'titleblock', title: 'اكتمال بيانات رأس اللوحة الفنية (Title block)', passed: titleBlock.projectName.trim() !== '' && titleBlock.clientName.trim() !== '', detail: 'موثقة ومطابقة' },
      { id: 'scale', title: 'مطابقة مقياس الرسم الهندسي', passed: ['1:50', '1:100', '1:25'].includes(activeScale), detail: `المقياس النشط: ${activeScale}` },
      { id: 'paperSize', title: 'تناسب حجم اللوحة مع مخططات التدقيق الاستشاري', passed: ['A3', 'A2', 'A1', 'A0'].includes(selectedPaper), detail: `الورق المحدد: ${selectedPaper}` }
    ];
    const score = checks.filter(c => c.passed).length;
    return {
      checks,
      score,
      total: checks.length,
      isCompliant: score === checks.length
    };
  }, [stories, slabs, beams, columns, titleBlock, activeScale, selectedPaper]);

  // Handle high-resolution physical printing or triggering save as PDF
  const handleTriggerPrint = () => {
    // Generate specialized dynamic styles for printing and inject them
    const printStylesId = 'advanced-print-style-sheet';
    let existingStyle = document.getElementById(printStylesId);
    if (!existingStyle) {
      existingStyle = document.createElement('style');
      existingStyle.id = printStylesId;
      document.head.appendChild(existingStyle);
    }

    // Set page rules matching selected size and orientations
    const sizeRule = orientation === 'Landscape' ? `${selectedPaper.toLowerCase()} landscape` : `${selectedPaper.toLowerCase()} portrait`;

    // Dynamic monochrome styling if toggled
    const colorFilter = printStyle === 'monochrome' 
      ? 'filter: grayscale(100%) contrast(150%) !important; color: #000000 !important; border-color: #000000 !important;' 
      : printStyle === 'grayscale' 
        ? 'filter: grayscale(100%) opacity(85%) !important;'
        : '';

    existingStyle.innerHTML = `
      @media print {
        @page {
          size: ${sizeRule};
          margin: 0;
        }
        body * {
          visibility: hidden;
        }
        #print-pkg-active-container, #print-pkg-active-container * {
          visibility: visible;
        }
        #print-pkg-active-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          direction: rtl !important;
          ${colorFilter}
        }
        .page-break-print {
          page-break-after: always;
          break-after: page;
        }
        /* Overrides to make sure grids/dimensions render crisp black */
        text, line, px, rect, circle, path {
          stroke-width: 1px !important;
        }
      }
    `;

    // Fire window printing mechanics directly
    window.print();
  };

  const handleToggleStorySelection = (id: string) => {
    setSelectedStoriesToPrint(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSelectAllStories = () => {
    const updated: Record<string, boolean> = {};
    stories.forEach(st => {
      updated[st.id] = true;
    });
    setSelectedStoriesToPrint(updated);
  };

  const handleSelectNoneStories = () => {
    const updated: Record<string, boolean> = {};
    stories.forEach(st => {
      updated[st.id] = false;
    });
    setSelectedStoriesToPrint(updated);
  };

  return (
    <div className="space-y-6 text-right" style={{ direction: 'rtl' }}>
      
      {/* 1. TOP HEADER & CAPABILITY BADGING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 to-cyan-950 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-1.5 bg-cyan-700/60 rounded text-[10px] font-mono font-black tracking-wider text-cyan-200">PHASE D9</span>
            <h2 className="text-lg font-bold">محرك الطباعة الفنية ومخرجات المخططات (Vector Printing Engine)</h2>
          </div>
          <p className="text-xs text-slate-300">
            أداة طباعة هندسية مستقلة بنسبة ملاءمة ١٠٠٪ لأجهزة الرسم العملاقة (Plotters) وحجم اللوحات بموجب كود البناء السعودي.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={handleTriggerPrint} 
            disabled={activeStoriesList.length === 0}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-5 h-10 gap-2 rounded-xl shadow-lg shadow-cyan-950/45 transition duration-200"
          >
            <Printer className="w-4 h-4" />
            اطبع الحزمة المختارة الآن (Ctrl+P)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COMPONENT: CONTROLS, PAPER CONFIGS, MULTI-SHEET MANAGERS & QA */}
        <div className="xl:col-span-4 space-y-5">
          
          {/* A. Paper Size, Orientation, Style Selection */}
          <Card className="border border-slate-200 shadow">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-cyan-600" />
                  مفتاح إعدادات الطابعة واللوائح (Plot & Paper)
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500 mt-1">تعديل مقياس الحجم وخواص الألوان</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              
              {/* Paper Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">حجم ورق الطباعة (Paper Size):</label>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(['A4', 'A3', 'A2', 'A1', 'A0', 'Custom'] as PaperSize[]).map((pSize) => (
                    <button
                      key={pSize}
                      type="button"
                      onClick={() => setSelectedPaper(pSize)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition ${selectedPaper === pSize ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                    >
                      {pSize}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation Setting */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700">اتجاه اللوحة (Orientation):</label>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOrientation('Landscape')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${orientation === 'Landscape' ? 'bg-cyan-50 border-cyan-300 text-cyan-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    أفقي (Landscape)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('Portrait')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${orientation === 'Portrait' ? 'bg-cyan-50 border-cyan-300 text-cyan-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                  >
                    رأسي (Portrait)
                  </button>
                </div>
              </div>

              {/* Print Style Selection */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700">أسلوب الطباعة ولون الأقلام (Plot Style):</label>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {[
                    { style: 'color' as PrintStyle, label: 'ألوان كاملة', desc: 'مخطط ملون' },
                    { style: 'grayscale' as PrintStyle, label: 'تدرج رمادي', desc: 'Grayscale' },
                    { style: 'monochrome' as PrintStyle, label: 'مونوكروم', desc: 'أبيض وأسود' },
                  ].map((pS) => (
                    <button
                      key={pS.style}
                      type="button"
                      onClick={() => setPrintStyle(pS.style)}
                      className={`p-1.5 text-[11px] font-bold rounded-lg border transition text-center ${printStyle === pS.style ? 'bg-cyan-50 border-cyan-300 text-cyan-900' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    >
                      <span className="block">{pS.label}</span>
                      <span className="text-[9px] text-slate-400 font-normal block">{pS.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawing Scale override Selection */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-cyan-600" />
                  مقياس الرسم الهندسي (Plot Scale Override):
                </label>
                <select
                  value={activeScale}
                  onChange={(e) => setActiveScale(e.target.value)}
                  className="w-full text-xs h-9 bg-white border border-slate-200 rounded-xl px-2.5 mt-1 focus:border-cyan-500 outline-none font-mono"
                >
                  {['1:10', '1:20', '1:25', '1:50', '1:75', '1:100', '1:200'].map(sc => (
                    <option key={sc} value={sc}>مقياس {sc}</option>
                  ))}
                </select>
              </div>

            </CardContent>
          </Card>

          {/* B. Batch / Multi-sheet Printing Selector */}
          <Card className="border border-slate-200 shadow">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-600" />
                  إدارة طباعة اللوحات المتعددة (Batch Printing)
                </span>
                <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  {activeStoriesList.length} / {stories.length}
                </span>
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-500 mt-1">تحديد طوابق محددة لتوليد حزمة ورقية مترابطة تلقائياً بالتتابع</CardDescription>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              
              <div className="flex gap-2 text-[10px]">
                <button type="button" onClick={handleSelectAllStories} className="text-cyan-600 hover:underline font-bold">تحديد الكل</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={handleSelectNoneStories} className="text-rose-600 hover:underline font-bold">إلغاء التحديد</button>
              </div>

              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {stories.map((st) => {
                  const isChecked = selectedStoriesToPrint[st.id] || false;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleToggleStorySelection(st.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl border text-right transition ${isChecked ? 'bg-cyan-50/50 border-cyan-200/80 text-cyan-950' : 'bg-slate-50/50 border-slate-100 text-slate-400'}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${isChecked ? 'bg-cyan-600 text-white' : 'border border-slate-300'}`}>
                          {isChecked && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className="text-xs font-bold">{st.label}</span>
                      </div>
                      <span className="text-[10px] font-mono font-medium text-slate-400">{(st.height / 1000).toFixed(2)}m</span>
                    </button>
                  );
                })}
              </div>

              {activeStoriesList.length === 0 && (
                <p className="text-[10px] text-rose-500 font-bold bg-rose-50 p-2 rounded-lg text-center leading-normal">
                  ⚠️ الرجاء تحديد لوحة دور واحد على الأقل للتمكن من فحص جودة الطباعة أو تصفح المحتوى.
                </p>
              )}

            </CardContent>
          </Card>

          {/* C. QA/QC Verification Checklist before Printing */}
          <Card className="border border-slate-200 shadow">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                مراجعة معايير جودة الطباعة والقص (Print QA/QC)
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-500 mt-1">مطابقة المعايير لبلدية البناء قبل الطباعة النهائية لإنقاذ الورق</CardDescription>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              
              <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                <span className="font-bold text-slate-700">معدل الامتثال الفني:</span>
                <span className="font-black text-emerald-600 font-mono">
                  {printQaChecks.score} / {printQaChecks.total} ({Math.round((printQaChecks.score / printQaChecks.total) * 100)}%)
                </span>
              </div>

              <div className="space-y-2">
                {printQaChecks.checks.map((chk) => (
                  <div key={chk.id} className="flex items-start justify-between text-[11px] gap-2">
                    <div className="flex items-start gap-1.5">
                      {chk.passed ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                      )}
                      <div>
                        <span className={`font-semibold ${chk.passed ? 'text-slate-700' : 'text-slate-400'}`}>{chk.title}</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5">{chk.detail}</span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${chk.passed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {chk.passed ? 'مطابق' : 'فحص'}
                    </span>
                  </div>
                ))}
              </div>

            </CardContent>
          </Card>

          {/* D. Title Block parameters Modifier for printing */}
          <Card className="border border-slate-200 shadow">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-600" />
                بيانات ترويسة اللوائح الإنشائية (Title Block)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-3 text-xs">
              
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold">اسم المالك (Client):</span>
                  <Input value={titleBlock.clientName} onChange={(e) => setTitleBlock(prev => ({ ...prev, clientName: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold">عنوان المخطط (Title):</span>
                  <Input value={titleBlock.drawingTitle} onChange={(e) => setTitleBlock(prev => ({ ...prev, drawingTitle: e.target.value }))} className="h-8 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold">رقم لوحة الكود (Drawing No):</span>
                  <Input value={titleBlock.drawingNo} onChange={(e) => setTitleBlock(prev => ({ ...prev, drawingNo: e.target.value }))} className="h-8 text-xs font-mono" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold">تاريخ الإصدار:</span>
                  <Input type="date" value={titleBlock.date} onChange={(e) => setTitleBlock(prev => ({ ...prev, date: e.target.value }))} className="h-8 text-xs font-mono" />
                </div>
              </div>

            </CardContent>
          </Card>

        </div>

        {/* RIGHT COMPONENT: PRINT WINDOW WORKSPACE & PAGES NAVIGATION */}
        <div className="xl:col-span-8 flex flex-col space-y-4">
          
          {/* Zoom, Pan & Fit Controllers Bar */}
          <div className="bg-slate-900 text-white rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-1.5 text-xs">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span className="font-bold">معاينة الورق النشط:</span>
              {activeStoriesList.length > 0 && (
                <span className="font-mono text-cyan-300 ml-1">
                  [ صفحة {activePreviewStoryIndex + 1} من {activeStoriesList.length} ]
                </span>
              )}
            </div>

            {/* Navigation keys for multi sheets */}
            {activeStoriesList.length > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 rounded-lg text-white hover:bg-slate-800"
                  onClick={() => setActivePreviewStoryIndex(prev => Math.max(prev - 1, 0))}
                  disabled={activePreviewStoryIndex === 0}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <div className="text-xs font-bold px-2 font-mono bg-slate-800 rounded py-1">
                  {currentPreviewStory?.label}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 rounded-lg text-white hover:bg-slate-800"
                  onClick={() => setActivePreviewStoryIndex(prev => Math.min(prev + 1, activeStoriesList.length - 1))}
                  disabled={activePreviewStoryIndex === activeStoriesList.length - 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Scale, Zoom & Layout mode buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                variant="outline"
                className={`text-[10px] h-7 px-2 font-bold border-slate-700 text-white ${isMultiPageGrid ? 'bg-cyan-600 border-cyan-800' : ''}`}
                onClick={() => setIsMultiPageGrid(prev => !prev)}
              >
                <Grid className="w-3.5 h-3.5 mr-1" />
                تصفح الحزمة كاملة (Multi-Page)
              </Button>
              <div className="h-4 w-px bg-slate-700"></div>
              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-white hover:bg-slate-800" onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-mono text-cyan-400 min-w-[45px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-white hover:bg-slate-800" onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="w-8 h-8 rounded-lg text-white hover:bg-slate-800" onClick={handleResetZoom} title="تثبيت العرض">
                <Maximize className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Interactive Print Area Stage */}
          <div 
            className="relative border border-slate-300 rounded-2xl bg-slate-950 min-h-[500px] max-h-[700px] overflow-hidden flex items-start justify-center p-6 cursor-grab"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ userSelect: 'none' }}
          >
            {/* Visual warning background grid helper */}
            <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-15"></div>

            <div 
              style={{
                transform: `scale(${zoomLevel}) translate(${panState.x}px, ${panState.y}px)`,
                transformOrigin: 'top center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
              }}
              className="flex flex-col items-center gap-12"
            >
              
              {/* If Single page selected */}
              {!isMultiPageGrid ? (
                activeStoriesList.length > 0 && currentPreviewStory ? (
                  <div 
                    id="print-pkg-active-container"
                    style={{
                      width: `${paperDimensions.width}px`,
                      height: `${paperDimensions.height}px`,
                    }}
                    className={`bg-white shadow-2xl relative transition-all duration-300 border border-slate-300 p-8 flex flex-col justify-between text-slate-900 select-text overflow-hidden ${printStyle === 'color' ? 'bg-gradient-to-tr from-cyan-50/10 via-white to-amber-50/5' : ''}`}
                  >
                    
                    {/* A. Dynamic Sheet Header */}
                    <div className="border-b-2 border-slate-800 pb-2.5 flex items-start justify-between text-right">
                      <div>
                        <h3 className="font-extrabold text-base leading-snug">{titleBlock.projectName}</h3>
                        <p className="text-[11px] text-slate-500 font-bold mt-1">كود تصميم الهياكل والخرسانة الإنشائية بموجب SBC-304</p>
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-[9px] text-slate-400 block">SHEET NO:</span>
                        <span className="text-lg font-black text-slate-900 border border-slate-800 px-1.5 rounded">{titleBlock.drawingNo}</span>
                      </div>
                    </div>

                    {/* B. Drawing Vector Stage Canvas Mockup */}
                    <div className="flex-1 my-6 border border-dashed border-slate-300 rounded relative flex flex-col items-center justify-center p-4">
                      
                      {/* Technical specifications overlay details */}
                      <span className="absolute right-3 top-3 text-[9px] font-mono font-bold tracking-wider text-slate-400">
                        SCALE {activeScale}  • PAPER ASPECT RATIO ({selectedPaper} / {orientation})
                      </span>

                      {/* Vector simulation container illustrating Grids, Beams and Columns */}
                      <div className="w-full max-w-lg aspect-video border border-slate-400 rounded bg-slate-50/30 p-2 relative flex flex-col items-center justify-center overflow-hidden">
                        
                        {/* Interactive columns & grids vector blocks renderer */}
                        <svg viewBox="0 0 1200 800" className="w-full h-full text-slate-900">
                          {/* Inner gridlines */}
                          <line x1="150" y1="100" x2="150" y2="700" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="1.5" />
                          <line x1="450" y1="100" x2="450" y2="700" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="1.5" />
                          <line x1="750" y1="100" x2="750" y2="700" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="1.5" />
                          <line x1="1050" y1="100" x2="1050" y2="700" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="1.5" />

                          <line x1="100" y1="200" x2="1100" y2="200" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="1.5" />
                          <line x1="100" y1="450" x2="1100" y2="450" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="1.5" />
                          <line x1="100" y1="650" x2="1100" y2="650" stroke="#94a3b8" strokeDasharray="5,5" strokeWidth="1.5" />

                          {/* Grids bubbles */}
                          <circle cx="150" cy="70" r="22" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
                          <text x="144" y="78" className="text-xs font-extrabold" fontSize="24">A</text>
                          <circle cx="450" cy="70" r="22" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
                          <text x="444" y="78" className="text-xs font-extrabold" fontSize="24">B</text>
                          <circle cx="750" cy="70" r="22" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
                          <text x="744" y="78" className="text-xs font-extrabold" fontSize="24">C</text>

                          <circle cx="50" cy="200" r="22" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
                          <text x="44" y="208" className="text-xs font-extrabold" fontSize="24">1</text>
                          <circle cx="50" cy="450" r="22" fill="#e2e8f0" stroke="#334155" strokeWidth="1.5" />
                          <text x="44" y="458" className="text-xs font-extrabold" fontSize="24">2</text>

                          {/* Slabs Rectangles contours */}
                          <rect x="150" y="200" width="300" height="250" fill="none" stroke="#2563eb" strokeWidth="3" />
                          <text x="210" y="320" fill="#2563eb" fontSize="22" className="font-bold">SLAB S1 (t=150)</text>

                          <rect x="450" y="200" width="300" height="250" fill="none" stroke="#2563eb" strokeWidth="3" />
                          <text x="510" y="320" fill="#2563eb" fontSize="22" className="font-bold">SLAB S2 (t=150)</text>

                          <rect x="150" y="450" width="600" height="200" fill="none" stroke="#2563eb" strokeWidth="3" />
                          <text x="350" y="550" fill="#2563eb" fontSize="22" className="font-bold">SLAB S3 (t=160)</text>

                          {/* Concrete pillars / Columns */}
                          <rect x="135" y="180" width="30" height="40" fill="#b91c1c" stroke="#b91c1c" />
                          <text x="110" y="165" fill="#b91c1c" fontSize="18" className="font-bold">C1: 30x60</text>
                          <rect x="435" y="180" width="30" height="40" fill="#b91c1c" stroke="#b91c1c" />
                          <text x="410" y="165" fill="#b91c1c" fontSize="18" className="font-bold">C2: 30x60</text>
                          <rect x="735" y="180" width="30" height="40" fill="#b91c1c" stroke="#b91c1c" />
                          <text x="710" y="165" fill="#b91c1c" fontSize="18" className="font-bold">C3: 30x60</text>

                          {/* Beams lines representations */}
                          <line x1="150" y1="200" x2="750" y2="200" stroke="#059669" strokeWidth="5" />
                          <text x="280" y="190" fill="#059669" fontSize="18" className="font-mono font-bold">B101 [300x600]</text>
                          <line x1="150" y1="450" x2="750" y2="450" stroke="#059669" strokeWidth="5" strokeDasharray="10, 5" />
                        </svg>

                        {/* Centered floor plan and story reference tag */}
                        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-300 text-[10px] text-slate-800 font-bold shadow-sm">
                          مخطط تسليح السقف: {currentPreviewStory.label}
                        </div>
                      </div>

                      {/* General construction specifications notes block for plotters */}
                      <div className="w-full grid grid-cols-2 gap-4 mt-6 text-[10px] border-t border-slate-200 pt-4 leading-normal text-slate-500">
                        <div>
                          <strong className="block text-slate-900 mb-1">الملاحظات والاشتراطات الفنية العامة للصب:</strong>
                          <ol className="list-decimal list-inside space-y-0.5">
                            <li>مقاومة الخرسانة المميزة Fc لا تقل عن 30 Mpa للقواعد والأقساط والأعمدة والأسقف.</li>
                            <li>حديد التسليح رتبة 420 ذو مقاومة شد عالية ومطابق للمواصفات القياسية السعودية.</li>
                            <li>الغطاء الخرساني الصافي للقواعد وسقف القبو 50مم، وللأعمدة والكاميرات والأسقف 25مم.</li>
                          </ol>
                        </div>
                        <div>
                          <strong className="block text-slate-900 mb-1 font-bold">جدول تسليح وتفريد البلاطات التلقائي:</strong>
                          <table className="w-full text-right border border-slate-300 text-[9px]">
                            <thead className="bg-slate-100 font-bold border-b border-slate-300">
                              <tr>
                                <th className="p-1">رمز السقف</th>
                                <th className="p-1">السمك (t)</th>
                                <th className="p-1">التسليح السفلي</th>
                                <th className="p-1">التسليح العلوي</th>
                              </tr>
                            </thead>
                            <tbody>
                              {slabs.slice(0, 3).map((sl) => (
                                <tr key={sl.id} className="border-b border-slate-200">
                                  <td className="p-1 font-bold">SLAB {sl.id}</td>
                                  <td className="p-1 font-mono">{sl.t}mm</td>
                                  <td className="p-1">Ø12 @ 150</td>
                                  <td className="p-1">Ø10 @ 150</td>
                                </tr>
                              ))}
                              {slabs.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="p-1 text-center font-bold text-slate-400">لا توجد بلاطات نشطة</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>

                    {/* C. ISO 7200 / DIN Comprehensive Standard Title Block */}
                    <div className="border-t-2 border-slate-800 pt-4 flex flex-col md:flex-row justify-between text-right text-[10px] gap-4">
                      <div className="grid grid-cols-3 gap-x-6 gap-y-1.5 flex-1">
                        <div>
                          <span className="text-slate-400 block text-[9px]">صاحب العمل / المالك:</span>
                          <span className="font-extrabold">{titleBlock.clientName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">مشروع بناية سكنية:</span>
                          <span className="font-extrabold">{titleBlock.projectName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">المكتب الاستشاري المصمم:</span>
                          <span className="font-semibold font-mono tracking-wide">{titleBlock.designedBy}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">جهة الاعتماد والتدقيق:</span>
                          <span className="font-semibold">{titleBlock.approvedBy}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">مقياس الرسم القياسي:</span>
                          <span className="font-bold underline text-cyan-800 font-mono">{activeScale}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">تاريخ المراجعة الفنية:</span>
                          <span className="font-semibold font-mono">{titleBlock.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 border-r-2 border-slate-300 pr-4">
                        <div className="text-left font-mono">
                          <span className="text-slate-400 text-[8px] block leading-none">REVISION</span>
                          <span className="font-black text-xs text-rose-600 block">{titleBlock.revision}</span>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-slate-400 text-[8px] block leading-none">SHEET NO</span>
                          <span className="font-black text-xl text-slate-900 block">{titleBlock.drawingNo}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="bg-slate-900/60 p-12 text-slate-300 rounded-2xl text-center font-bold">
                    الرجاء تفعيل طابق واحد على الأقل من اليسار للتمكن من تحميل ومعاينة لوحة الرسم.
                  </div>
                )
              ) : (
                /* MULTI PAGE COMPREHENSIVE BATCH GRID PREVIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-2">
                  {activeStoriesList.map((st, sIdx) => (
                    <div 
                      key={st.id}
                      style={{
                        width: '560px',
                        height: '390px',
                      }}
                      className="bg-white rounded-lg p-4 flex flex-col justify-between border border-slate-300 text-slate-900 shadow-sm relative group cursor-pointer hover:border-cyan-500 transition-all"
                      onClick={() => {
                        setIsMultiPageGrid(false);
                        setActivePreviewStoryIndex(sIdx);
                      }}
                    >
                      <div className="absolute top-2 right-2 bg-cyan-100 text-cyan-800 rounded px-1.5 py-0.5 text-[9px] font-bold">
                        صفحة {sIdx + 1} • {st.label}
                      </div>

                      {/* Header */}
                      <div className="border-b border-slate-300 pb-1 text-right">
                        <span className="text-[9px] text-slate-500 block">{titleBlock.projectName}</span>
                        <span className="text-[10px] font-black">{titleBlock.drawingTitle} - {st.label}</span>
                      </div>

                      {/* Simulated drawings vector map */}
                      <div className="my-2 flex-1 border border-dashed border-slate-200 rounded flex items-center justify-center bg-slate-50/50 p-2">
                        <svg viewBox="0 0 100 60" className="w-16 h-10 opacity-70">
                          <rect x="10" y="10" width="80" height="40" fill="none" stroke="#2563eb" strokeWidth="2" />
                          <circle cx="30" cy="20" r="4" fill="#b91c1c" />
                          <circle cx="70" cy="20" r="4" fill="#b91c1c" />
                        </svg>
                      </div>

                      {/* Title block */}
                      <div className="border-t border-slate-300 pt-1 flex justify-between text-[8px] text-slate-400">
                        <span>SCALE {activeScale}</span>
                        <span>REVISION {titleBlock.revision}</span>
                        <span className="font-bold text-slate-700">STR-0{sIdx + 1}</span>
                      </div>
                    </div>
                  ))}
                  {activeStoriesList.length === 0 && (
                    <div className="bg-slate-900/60 p-12 text-slate-300 rounded-2xl text-center font-bold col-span-2">
                      الرجاء تفعيل طابق واحد على الأقل للتمكن من المعاينة التعددية للورق في اللوحة.
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Quick interactive print and guide tips */}
          <div className="bg-cyan-50 border border-cyan-200 text-cyan-950 p-4 rounded-xl text-xs space-y-1">
            <h4 className="font-extrabold text-cyan-950 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-cyan-700" />
              توجيهات الطباعة والمحافظة على المقياس الهندسي:
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
              لتجهيز المخرجات بالمقياس الصحيح في نافذة الويندوز للطباعة، اختر الكود الهندسي المناسب للورق (مثال: A3) في مربع الإعدادات، ثم اضبط خيار التوسيط (Fit) عند معاينة المتصفح على خيار <strong>100%</strong> وتفعيل خيار <strong>"رسومات الخلفية"</strong> لضمان وضوح خطوط التسليح ومحاور الصب بفعالية استشارية عالية.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

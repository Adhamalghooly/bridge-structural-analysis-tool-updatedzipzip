import React, { useState, useMemo, useEffect } from 'react';
import { 
  validateSheet, 
  calculateAutoLayout, 
  generateDXFSheetScript, 
  generateDefaultSheets,
  getSheetSizeMm,
  DEFAULT_GENERAL_NOTES,
  SYMBOLS_LEGEND,
  type DrawingSheet, 
  type Viewport, 
  type SheetSize, 
  type SheetOrientation,
  type TitleBlockInfo,
  type Revision,
  type SheetValidationIssue
} from '../lib/sheetCompositionEngine';
import { 
  Layers3, 
  Maximize2, 
  Download, 
  Printer, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  AlertTriangle, 
  Compass, 
  FileText, 
  Table as TableIcon, 
  Wrench, 
  BookOpen, 
  Scale, 
  Info, 
  RefreshCw, 
  Share2, 
  Eye, 
  Sliders,
  ChevronRight,
  Sparkles,
  Database,
  ArrowUpRight,
  Maximize,
  ClipboardList
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import type { Story, Beam, Column, Slab } from '../lib/structuralEngine';

interface SheetCompositionEngineProps {
  stories: Story[];
  beams: Beam[];
  columns: Column[];
  slabs: Slab[];
  beamDesigns: any[];
  colDesigns: any[];
  slabDesigns: any[];
  foundationResults: any;
}

export function SheetCompositionEngine({
  stories,
  beams,
  columns,
  slabs,
  beamDesigns = [],
  colDesigns = [],
  slabDesigns = [],
  foundationResults
}: SheetCompositionEngineProps) {
  // 1. Initial State Setup
  const [sheets, setSheets] = useState<DrawingSheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  
  // Local active title block
  const [titleBlock, setTitleBlock] = useState<TitleBlockInfo>({
    projectName: 'مشروع فيلا نموذجية سكنية متكاملة',
    projectNumber: 'PRJ-2026-08',
    client: 'وزارة الإسكان والأشغال العامة',
    consultant: 'المكتب العربي للهندسة والاستشارات الإنشائية',
    drawingTitle: 'تفاصيل التسليح الإجمالي والقوالب الخرسانية',
    drawingNumber: 'S-101',
    scale: '1:50 / 1:100',
    date: new Date().toISOString().split('T')[0],
    designer: 'ENG. S.A. AL-GHOLLY',
    checker: 'ENG. MOHAMMAD A.',
    approver: 'DR. STRUCTURAL S.M.',
    revision: 'REV-00'
  });

  // North Arrow parameters
  const [northRotation, setNorthRotation] = useState<number>(0);
  const [showNorthArrow, setShowNorthArrow] = useState<boolean>(true);
  
  // Custom interactive General Note Editor
  const [activeNotes, setActiveNotes] = useState<string[]>(DEFAULT_GENERAL_NOTES);
  const [newNote, setNewNote] = useState<string>('');

  // Selected Viewport inside active sheet for coordinate/scale editing
  const [selectedViewportId, setSelectedViewportId] = useState<string>('');

  // Dialog & view states
  const [showDxfExport, setShowDxfExport] = useState<boolean>(false);
  const [dxfOutput, setDxfOutput] = useState<string>('');
  const [isAutoLayoutTriggered, setIsAutoLayoutTriggered] = useState<boolean>(false);

  // Initialize sheets with responsive default CAD structures
  useEffect(() => {
    const defaults = generateDefaultSheets(titleBlock.projectName);
    setSheets(defaults);
    if (defaults.length > 0) {
      setSelectedSheetId(defaults[1].id); // S-101 is default selected
    }
  }, []);

  // Update dynamic Title Block drawing target when sheet changes
  const activeSheet = useMemo(() => {
    return sheets.find(s => s.id === selectedSheetId);
  }, [selectedSheetId, sheets]);

  useEffect(() => {
    if (activeSheet) {
      setTitleBlock(prev => ({
        ...prev,
        drawingTitle: activeSheet.title,
        drawingNumber: activeSheet.sheetNo,
        scale: activeSheet.viewports.length > 0 ? activeSheet.viewports[0].scale : 'As Noted'
      }));
      // Default to first viewport
      if (activeSheet.viewports.length > 0) {
        setSelectedViewportId(activeSheet.viewports[0].id);
      } else {
        setSelectedViewportId('');
      }
    }
  }, [selectedSheetId]);

  // Validation issues of the active sheet
  const activeSheetIssues = useMemo<SheetValidationIssue[]>(() => {
    if (!activeSheet) return [];
    return validateSheet(activeSheet);
  }, [activeSheet]);

  // Handle standard sheet meta modify
  const updateSheetMeta = (field: keyof DrawingSheet, value: any) => {
    setSheets(prev => prev.map(s => {
      if (s.id === selectedSheetId) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  // Add a new completely blank layout sheet
  const handleAddNewSheet = () => {
    const nextNum = sheets.length + 1;
    const newS: DrawingSheet = {
      id: `custom-sheet-${Date.now()}`,
      type: 'combined',
      title: 'مخطط إنشائي مركب مخصص',
      sheetNo: `S-${100 + nextNum}`,
      size: 'A1',
      orientation: 'landscape',
      margin: 10,
      revisions: [
        { id: `r-${Date.now()}`, number: '01', date: new Date().toISOString().split('T')[0], description: 'إصدار عمل مخطط خاص', designer: titleBlock.designer }
      ],
      viewports: [
        {
          id: `vp-${Date.now()}`,
          type: 'generalNotes',
          title: 'اشتراطات التنفيذ وحماية حديد التسليح',
          scale: 'NTS',
          x: 10,
          y: 10,
          width: 350,
          height: 380,
          referenceId: 'all'
        }
      ]
    };
    setSheets(prev => [...prev, newS]);
    setSelectedSheetId(newS.id);
  };

  // Delete the active sheet
  const handleDeleteSheet = (idToDelete: string) => {
    if (sheets.length <= 1) return;
    const updated = sheets.filter(s => s.id !== idToDelete);
    setSheets(updated);
    if (selectedSheetId === idToDelete) {
      setSelectedSheetId(updated[0].id);
    }
  };

  // Modify individual viewport scale or dimensions
  const updateViewport = (vpId: string, field: keyof Viewport, value: any) => {
    setSheets(prev => prev.map(s => {
      if (s.id === selectedSheetId) {
        return {
          ...s,
          viewports: s.viewports.map(v => {
            if (v.id === vpId) {
              return { ...v, [field]: value };
            }
            return v;
          })
        };
      }
      return s;
    }));
  };

  // Add new viewport to current sheet
  const handleAddViewport = (type: 'plan' | 'section' | 'detail' | 'schedule' | 'legend' | 'generalNotes') => {
    if (!activeSheet) return;
    
    // Default appropriate dimensions and titles
    let title = 'مسقط إضافي';
    let width = 200;
    let height = 200;
    let refId = 'all';
    let scale = '1:50';

    if (type === 'plan') {
      title = 'مسقط أفقي لتسليح البلاطات والكمرات الإضافية - S1';
      width = 300;
      height = 250;
      refId = 'story-first';
    } else if (type === 'schedule') {
      title = 'جدول تفريد حديد الجسور (Phase D6A STA4CAD Beams)';
      width = 250;
      height = 200;
      refId = 'beam-schedule-embed';
      scale = '1:100';
    } else if (type === 'detail') {
      title = 'رسم تفصيلي لحديد الجسر الإنشائي B1';
      width = 280;
      height = 150;
      refId = 'beam-det-all';
      scale = '1:25';
    } else if (type === 'section') {
      title = 'القطاع العرضي لمقاطع الأعمدة والجسور';
      width = 180;
      height = 180;
      refId = 'beam-sec-all';
      scale = '1:10';
    } else if (type === 'generalNotes') {
      title = 'الملاحظات الإنشائية العامة والاشتراطات';
      width = 350;
      height = 300;
    } else if (type === 'legend') {
      title = 'شرح الرموز الإنشائية ومفاتيح الخريطة الإنشائية';
      width = 200;
      height = 200;
    }

    const newV: Viewport = {
      id: `vp-v-${Date.now()}`,
      type,
      title,
      scale,
      x: 20,
      y: 20,
      width,
      height,
      referenceId: refId
    };

    setSheets(prev => prev.map(s => {
      if (s.id === selectedSheetId) {
        return {
          ...s,
          viewports: [...s.viewports, newV]
        };
      }
      return s;
    }));
    setSelectedViewportId(newV.id);
  };

  // Delete viewport from sheet
  const handleDeleteViewport = (vpId: string) => {
    setSheets(prev => prev.map(s => {
      if (s.id === selectedSheetId) {
        const filtered = s.viewports.filter(v => v.id !== vpId);
        return { ...s, viewports: filtered };
      }
      return s;
    }));
    if (selectedViewportId === vpId) {
      setSelectedViewportId('');
    }
  };

  // Add dynamic design revision
  const handleAddRevision = () => {
    if (!activeSheet) return;
    const nextRevNum = activeSheet.revisions.length;
    const newR: Revision = {
      id: `rev-${Date.now()}`,
      number: `${nextRevNum < 9 ? '0' : ''}${nextRevNum + 1}`,
      date: new Date().toISOString().split('T')[0],
      description: 'إعادة تدقيق العزوم والتسليح الإنشائي حسب مراجعات المالك المعمارية',
      designer: titleBlock.designer
    };
    setSheets(prev => prev.map(s => {
      if (s.id === selectedSheetId) {
        return { ...s, revisions: [...s.revisions, newR] };
      }
      return s;
    }));
  };

  // Trigger Sheet Composition layout calculations automatically
  const handleAutoArrange = () => {
    if (!activeSheet) return;
    setIsAutoLayoutTriggered(true);
    const arranged = calculateAutoLayout(activeSheet, activeSheet.viewports.map(({ x, y, ...v }) => v));
    setSheets(prev => prev.map(s => {
      if (s.id === selectedSheetId) {
        return { ...s, viewports: arranged };
      }
      return s;
    }));
    setTimeout(() => {
      setIsAutoLayoutTriggered(false);
    }, 1000);
  };

  // Export CAD DXF File
  const handleGenerateDxf = () => {
    if (!activeSheet) return;
    const code = generateDXFSheetScript(activeSheet, titleBlock);
    setDxfOutput(code);
    setShowDxfExport(true);
  };

  // Save/Download DXF Script File
  const downloadDxfFile = () => {
    const blob = new Blob([dxfOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeSheet?.sheetNo || 'Drawing_Sheet'}_CAD_Export.dxf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Trigger window direct printing
  const handlePrintSheet = () => {
    window.print();
  };

  // Add custom general construction note
  const handleAddCustomNote = () => {
    if (newNote.trim() === '') return;
    setActiveNotes(prev => [...prev, newNote.trim()]);
    setNewNote('');
  };

  return (
    <div className="space-y-6 font-sans text-right" style={{ direction: 'rtl' }}>
      
      {/* 1. TOP DENTAL PANEL & SHEET CONTROLLER */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-600/20 rounded-xl border border-cyan-500/30 text-cyan-400">
              <Layers3 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                  نظام تجميع اللوحات ومجدول الطباعة (Phase D7 Sheet Composition)
                </h2>
                <Badge className="bg-cyan-600 text-white font-mono text-[10px] px-2 py-0.5">
                  STA4CAD Suite
                </Badge>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                صياغة، تركيب وتوزيع العناصر وتفريد حديد التسليح والمحاور والملاحظات تلقائياً داخل قوالب رسم وتصدير قياسية.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button 
              size="sm" 
              onClick={handleAddNewSheet}
              className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              أضف لوحة رسم جديدة
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleAutoArrange}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1.5 text-xs font-bold"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              توزيع تلقائي (Auto-Layout)
            </Button>

            <Button 
              size="sm" 
              onClick={handleGenerateDxf}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold"
            >
              <Download className="w-4 h-4" />
              تصدير CAD (DXF)
            </Button>

            <Button 
              size="sm" 
              variant="secondary"
              onClick={handlePrintSheet}
              className="bg-slate-800 hover:bg-slate-700 text-white gap-1.5 text-xs font-bold"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              طباعة اللوحة الفنية
            </Button>
          </div>

        </div>

        {/* List of current project active sheets */}
        <div className="flex flex-wrap gap-2 mt-5 border-t border-slate-800 pt-4">
          {sheets.map((sh) => (
            <div key={sh.id} className="relative group">
              <button
                onClick={() => setSelectedSheetId(sh.id)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                  selectedSheetId === sh.id
                    ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500 shadow-sm shadow-cyan-900/30'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse inline-block"></div>
                <span className="font-mono text-cyan-400">{sh.sheetNo}</span>
                <span className="truncate max-w-[120px]">{sh.title}</span>
                <span className="text-[10px] bg-slate-700/60 text-slate-300 font-mono px-1 rounded">
                  {sh.size}
                </span>
              </button>
              
              {sheets.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSheet(sh.id);
                  }}
                  className="absolute -top-1.5 -left-1.5 bg-red-600 text-white text-[9px] rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  title="حذف هذه اللوحة"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. MAIN LAYOUT: CAD SHEET PREVIEW AND CONTROL BOARD */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* SIDEBAR COL 1 - DESIGN SHEET CONTROLS */}
        <div className="xl:col-span-1 space-y-5">
          
          {/* Active Sheet Configuration */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3">
              <CardTitle className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 justify-end">
                لوحة إعدادات الورق والهندسة
                <Sliders className="w-3.5 h-3.5 text-cyan-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs leading-relaxed">
              {activeSheet ? (
                <>
                  <div className="space-y-1">
                    <label className="text-slate-500 font-semibold">عنوان اللوحة النشطة:</label>
                    <Input 
                      value={activeSheet.title} 
                      onChange={(e) => updateSheetMeta('title', e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-slate-500 font-semibold">رقم اللوحة:</label>
                      <Input 
                        value={activeSheet.sheetNo} 
                        onChange={(e) => updateSheetMeta('sheetNo', e.target.value)}
                        className="text-xs font-mono h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-500 font-semibold">مقياس الورق (Size):</label>
                      <select
                        value={activeSheet.size}
                        onChange={(e) => updateSheetMeta('size', e.target.value as SheetSize)}
                        className="w-full bg-white border border-slate-200 rounded-md h-8 px-2 text-xs"
                      >
                        <option value="A0">A0 (1189 x 841 mm)</option>
                        <option value="A1">A1 (841 x 594 mm)</option>
                        <option value="A2">A2 (594 x 420 mm)</option>
                        <option value="A3">A3 (420 x 297 mm)</option>
                        <option value="A4">A4 (297 x 210 mm)</option>
                        <option value="Custom">Custom Size</option>
                      </select>
                    </div>
                  </div>

                  {activeSheet.size === 'Custom' && (
                    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="space-y-1">
                        <label className="text-slate-500 font-semibold block text-[10px]">العرض المخصص (مم):</label>
                        <Input 
                          type="number"
                          value={activeSheet.customWidth || 500} 
                          onChange={(e) => updateSheetMeta('customWidth', parseInt(e.target.value))}
                          className="text-xs font-mono h-7"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-slate-500 font-semibold block text-[10px]">الارتفاع المخصص (مم):</label>
                        <Input 
                          type="number"
                          value={activeSheet.customHeight || 400} 
                          onChange={(e) => updateSheetMeta('customHeight', parseInt(e.target.value))}
                          className="text-xs font-mono h-7"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-slate-500 font-semibold">توجيه اللوحة:</label>
                      <select
                        value={activeSheet.orientation}
                        onChange={(e) => updateSheetMeta('orientation', e.target.value as SheetOrientation)}
                        className="w-full bg-white border border-slate-200 rounded-md h-8 px-2 text-xs"
                      >
                        <option value="landscape">أفقي (Landscape)</option>
                        <option value="portrait">رأسي (Portrait)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-500 font-semibold">الهامش الصافي (مم):</label>
                      <Input 
                        type="number"
                        value={activeSheet.margin} 
                        onChange={(e) => updateSheetMeta('margin', parseInt(e.target.value) || 10)}
                        className="text-xs font-mono h-8"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>الأبعاد الفعلية للسطح الطباعي:</span>
                      <span className="font-mono text-cyan-600 font-bold">
                        {getSheetSizeMm(activeSheet.size, activeSheet.customWidth, activeSheet.customHeight).width} × {getSheetSizeMm(activeSheet.size, activeSheet.customWidth, activeSheet.customHeight).height} mm
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-slate-400 py-4 text-center">الرجاء اختيار لوحة لعرض الخصائص.</p>
              )}
            </CardContent>
          </Card>

          {/* Viewports and Scaling Controllers */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 flex flex-row items-center justify-between">
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                {activeSheet?.viewports.length || 0} MASQAT
              </span>
              <CardTitle className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 justify-end">
                المساقط ومقاييس الرسم (Viewports)
                <Maximize className="w-3.5 h-3.5 text-cyan-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3.5 text-xs text-right">
              {activeSheet && activeSheet.viewports.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="text-[10px] text-slate-400 block pb-1">
                    اختر كائن المنفذ لتعديل موقعه ومقياسه على لوحة الرسم:
                  </div>
                  
                  {activeSheet.viewports.map((vp) => (
                    <div 
                      key={vp.id}
                      onClick={() => setSelectedViewportId(vp.id)}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                        selectedViewportId === vp.id
                          ? 'bg-cyan-50 border-cyan-300 ring-1 ring-cyan-200'
                          : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 text-[11px] truncate max-w-[150px]">
                          {vp.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="font-mono text-[9px] px-1 h-4 bg-slate-100 text-slate-600">
                            {vp.scale}
                          </Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteViewport(vp.id);
                            }}
                            className="text-slate-400 hover:text-red-500 opacity-60 hover:opacity-100"
                            title="حذف هذا المنفذ"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {selectedViewportId === vp.id && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-100/80 grid grid-cols-2 gap-2 text-[10px]">
                          <div className="space-y-1">
                            <span className="text-slate-400 text-[9px]">الارتكاز الأفقي X (مم):</span>
                            <Input 
                              type="number" 
                              value={vp.x}
                              onChange={(e) => updateViewport(vp.id, 'x', parseInt(e.target.value) || 0)}
                              className="h-6 text-xs font-mono p-1"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-slate-400 text-[9px]">الارتكاز الرأسي Y (مم):</span>
                            <Input 
                              type="number" 
                              value={vp.y}
                              onChange={(e) => updateViewport(vp.id, 'y', parseInt(e.target.value) || 0)}
                              className="h-6 text-xs font-mono p-1"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-slate-400 text-[9px]">العرض بالورق (مم):</span>
                            <Input 
                              type="number" 
                              value={vp.width}
                              onChange={(e) => updateViewport(vp.id, 'width', parseInt(e.target.value) || 50)}
                              className="h-6 text-xs font-mono p-1"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-slate-400 text-[9px]">الارتفاع بالورق (مم):</span>
                            <Input 
                              type="number" 
                              value={vp.height}
                              onChange={(e) => updateViewport(vp.id, 'height', parseInt(e.target.value) || 50)}
                              className="h-6 text-xs font-mono p-1 text-right"
                            />
                          </div>
                          <div className="col-span-2 space-y-1 pt-1">
                            <span className="text-slate-400 text-[9px]">مقياس تدرج الرسم:</span>
                            <div className="flex gap-1">
                              <select
                                value={vp.scale}
                                onChange={(e) => updateViewport(vp.id, 'scale', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded h-6 p-0 px-1 text-[11px]"
                              >
                                <option value="NTS">بدون مقياس (NTS)</option>
                                <option value="1:10">1:10 (قطاعات وتفاصيل عميقة)</option>
                                <option value="1:20">1:20</option>
                                <option value="1:25">1:25 (تفريد الجسور)</option>
                                <option value="1:50">1:50 (مساقط القوالب الأفقية)</option>
                                <option value="1:75">1:75</option>
                                <option value="1:100">1:100 (المخططات المجمعة)</option>
                                <option value="1:200">1:200</option>
                              </select>
                              <Button 
                                size="xs" 
                                variant="outline"
                                onClick={() => {
                                  // Auto estimate scale based on standard bounding
                                  const approxRealDim = vp.type === 'plan' ? 15000 : vp.type === 'detail' ? 7000 : 2000;
                                  const scaleFactor = approxRealDim / vp.width;
                                  const chosen = scaleFactor < 15 ? '1:10' : scaleFactor < 30 ? '1:25' : scaleFactor < 60 ? '1:50' : '1:100';
                                  updateViewport(vp.id, 'scale', chosen);
                                }}
                                className="h-6 font-bold text-[9px] border-slate-200 text-slate-600 px-1 hover:bg-slate-100"
                                title="حساب أفضل مقياس"
                              >
                                <Scale className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-5">لا توجد مساقط مضافة لهذه اللوحة حالياً.</p>
              )}

              {/* Quick Add Buttons */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-1.5">
                <Button 
                  size="xs" 
                  variant="outline" 
                  onClick={() => handleAddViewport('plan')}
                  className="text-[10px] h-7 gap-1 border-slate-200 bg-slate-50 hover:bg-slate-100"
                >
                  <Plus className="w-3 h-3" /> + مسقط
                </Button>
                <Button 
                  size="xs" 
                  variant="outline" 
                  onClick={() => handleAddViewport('schedule')}
                  className="text-[10px] h-7 gap-1 border-slate-200 bg-slate-50 hover:bg-slate-100"
                >
                  <Plus className="w-3 h-3" /> + جدول
                </Button>
                <Button 
                  size="xs" 
                  variant="outline" 
                  onClick={() => handleAddViewport('detail')}
                  className="text-[10px] h-7 gap-1 border-slate-200 bg-slate-50 hover:bg-slate-100"
                >
                  <Plus className="w-3 h-3" /> + تفصيل
                </Button>
                <Button 
                  size="xs" 
                  variant="outline" 
                  onClick={() => handleAddViewport('section')}
                  className="text-[10px] h-7 gap-1 border-slate-200 bg-slate-50 hover:bg-slate-100"
                >
                  <Plus className="w-3 h-3" /> + قطاع
                </Button>
              </div>
            </CardContent>
          </Card>
          
        </div>

        {/* DRAWING BOARD PREVIEW PANELS COL 2&3 */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* SHEET DESIGN BOARD IN RESPONSIVE ASPECT VIEW */}
          <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden shadow-2xl">
            
            {/* Interactive Drawing Board Headers */}
            <div className="w-full flex justify-between items-center pb-4 text-xs text-slate-400 border-b border-slate-800/80 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block animate-pulse"></span>
                <span>لوحة المحاكاة الطباعية الفعلية القياسية للخرائط (Print & Layout Sandbox)</span>
              </div>
              <div className="flex items-center gap-4">
                <span>البعد الافتراضي: <span className="text-white font-mono">{activeSheet?.size} {activeSheet?.orientation === 'landscape' ? 'أفقي' : 'رأسي'}</span></span>
                {activeSheetIssues.length > 0 && (
                  <div className="flex items-center gap-1 text-amber-400 font-bold bg-amber-950/40 px-2 py-0.5 rounded">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>تنبيهات التصميم : {activeSheetIssues.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* THE PHYSICAL WHITE SHEET CONTAINER */}
            {activeSheet ? (
              <div 
                id="printable-sheet-d7"
                style={{
                  // Dynamic landscape calculations
                  aspectRatio: activeSheet.orientation === 'landscape' ? '1.414/1' : '1/1.414',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                }}
                className={`w-full max-w-4xl bg-white border border-slate-300 relative text-slate-900 transition-all duration-300 p-0 overflow-hidden select-none`}
              >
                {/* Millimeter grid background helper lines (fine blueprint grid styling) */}
                <div className="absolute inset-0 bg-grid-slate-100/50 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none"></div>

                {/* Drawn Outer margin line */}
                <div 
                  className="absolute border border-slate-400 pointer-events-none"
                  style={{
                    inset: `${activeSheet.margin}px`,
                  }}
                ></div>

                {/* Render Embedded Sheet Viewports */}
                {activeSheet.viewports.map((vp) => {
                  const isSelected = selectedViewportId === vp.id;
                  // Compute proportional positions inside the SVG style preview
                  return (
                    <div
                      key={vp.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedViewportId(vp.id);
                      }}
                      className={`absolute rounded group/vp transition-all shadow-xs border cursor-move ${
                        isSelected 
                          ? 'border-cyan-500 bg-cyan-50/10 ring-2 ring-cyan-200' 
                          : 'border-dashed border-slate-300 hover:border-slate-500 hover:bg-slate-50/20'
                      }`}
                      style={{
                        left: `calc(10% + ((${vp.x} / 1000) * 80%))`,
                        top: `calc(10% + ((${vp.y} / 1000) * 80%))`,
                        width: `calc((${vp.width} / 1000) * 80%)`,
                        height: `calc((${vp.height} / 1000) * 80%)`,
                        minWidth: '50px',
                        minHeight: '40px',
                      }}
                    >
                      {/* Viewport label */}
                      <div className="absolute -top-[18px] right-1 bg-slate-900 text-white text-[8px] font-black font-sans px-1.5 py-0.5 rounded flex items-center gap-1 z-20">
                        <span>{vp.title}</span>
                        <span className="text-cyan-400 font-mono">({vp.scale})</span>
                      </div>

                      {/* INTERNAL DRAWING RENDERER ACCORDING TO VIEWPORT TYPE */}
                      <div className="w-full h-full p-2.5 overflow-hidden flex flex-col justify-between text-right text-[9px] relative bg-white">
                        
                        {vp.type === 'generalNotes' && (
                          <div className="space-y-1 overflow-hidden leading-relaxed scale-90 origin-right text-[8px] text-slate-600">
                            <h4 className="font-extrabold text-slate-800 border-b border-slate-200 pb-0.5">اشتراطات التنفيذ ومواصفات صب الخرسانة المسلحة</h4>
                            {activeNotes.slice(0, 5).map((note, index) => (
                              <p key={index} className="truncate">• {note}</p>
                            ))}
                            <p className="text-cyan-600 italic font-mono text-[6px]">• الكود السعودي والخليجي المعتمد (BCS-2026)</p>
                          </div>
                        )}

                        {vp.type === 'legend' && (
                          <div className="space-y-1 select-none overflow-hidden text-[7px] text-slate-600 w-full">
                            <h4 className="font-bold text-slate-800 border-b border-indigo-200 pb-0.5">دليل الرموز والمقاييس لخطوط حديد التسليح</h4>
                            <div className="grid grid-cols-2 gap-1 mt-1">
                              {SYMBOLS_LEGEND.slice(0, 4).map((leg, i) => (
                                <div key={i} className="border border-slate-100 p-0.5 rounded">
                                  <span className="font-mono font-bold text-cyan-600 block">{leg.symbol}</span>
                                  <span className="truncate block text-slate-400 text-[6px]">{leg.meaning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {vp.type === 'plan' && (
                          <div className="w-full h-full flex flex-col justify-between">
                            <div className="flex-1 flex items-center justify-center relative">
                              {/* Draw schematic floor axes */}
                              <svg viewBox="0 0 100 80" className="w-full h-full max-h-[140px] opacity-80">
                                {/* Grid axes */}
                                <line x1="10" y1="10" x2="90" y2="10" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2 2" />
                                <line x1="10" y1="40" x2="90" y2="40" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2 2" />
                                <line x1="10" y1="70" x2="90" y2="70" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2 2" />
                                <line x1="20" y1="5" x2="20" y2="75" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2 2" />
                                <line x1="50" y1="5" x2="50" y2="75" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2 2" />
                                <line x1="80" y1="5" x2="80" y2="75" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2 2" />
                                
                                {/* Structural beams lines & column bounding */}
                                <rect x="18" y="8" width="4" height="4" fill="#0ea5e9" />
                                <rect x="48" y="8" width="4" height="4" fill="#0ea5e9" />
                                <rect x="78" y="8" width="4" height="4" fill="#0ea5e9" />
                                <rect x="18" y="38" width="4" height="4" fill="#0ea5e9" />
                                <rect x="48" y="38" width="4" height="4" fill="#0ea5e9" />
                                <rect x="78" y="38" width="4" height="4" fill="#0ea5e9" />

                                <line x1="20" y1="10" x2="80" y2="10" stroke="#475569" strokeWidth="1.5" />
                                <line x1="20" y1="40" x2="80" y2="40" stroke="#475569" strokeWidth="1.5" />
                                <line x1="20" y1="10" x2="20" y2="70" stroke="#475569" strokeWidth="1.5" />
                                <line x1="50" y1="10" x2="50" y2="70" stroke="#475569" strokeWidth="1.5" />

                                <text x="35" y="18" fill="#0284c7" className="font-mono text-[5px] font-bold">Slab S101 h=15cm</text>
                                <text x="30" y="8" fill="#475569" className="font-mono text-[4px]">Beam B12 30x60</text>
                              </svg>
                            </div>
                            <div className="text-center text-[7px] text-slate-400 font-mono">
                              مخطط توزيع المحاور والأعمدة والجسور
                            </div>
                          </div>
                        )}

                        {vp.type === 'schedule' && (
                          <div className="w-full h-full overflow-hidden text-[6px]">
                            <table className="w-full text-right border-collapse">
                              <thead>
                                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                                  <th className="p-0.5">العنصر</th>
                                  <th className="p-0.5">البعد (مم)</th>
                                  <th className="p-0.5">التسليح السفلي</th>
                                  <th className="p-0.5">التسليح العلوي</th>
                                  <th className="p-0.5">الكانات</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-100">
                                  <td className="p-0.5 font-bold">Beam B101</td>
                                  <td className="p-0.5 font-mono">300x600</td>
                                  <td className="p-0.5 text-cyan-600 font-mono">3 Ø 14</td>
                                  <td className="p-0.5 text-cyan-600 font-mono">2 Ø 14 + 1 Ø 12</td>
                                  <td className="p-0.5 font-mono">Ø8 @ 150</td>
                                </tr>
                                <tr className="border-b border-slate-100">
                                  <td className="p-0.5 font-bold">Beam B102</td>
                                  <td className="p-0.5 font-mono">300x600</td>
                                  <td className="p-0.5 text-cyan-600 font-mono">4 Ø 16</td>
                                  <td className="p-0.5 text-cyan-600 font-mono">3 Ø 14</td>
                                  <td className="p-0.5 font-mono">Ø8 @ 150</td>
                                </tr>
                                <tr className="border-b border-slate-100">
                                  <td className="p-0.5 font-bold">Column C1</td>
                                  <td className="p-0.5 font-mono">400x400</td>
                                  <td className="p-0.5 text-cyan-600 font-mono">6 Ø 18</td>
                                  <td className="p-0.5 text-cyan-600 font-mono">-</td>
                                  <td className="p-0.5 font-mono">Ø10 @ 150</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {vp.type === 'detail' && (
                          <div className="w-full h-full flex flex-col justify-between">
                            <div className="flex-1 flex items-center justify-center">
                              {/* Draw simple schematic structural details for rebar */}
                              <svg viewBox="0 0 100 40" className="w-full h-full">
                                {/* Beam frame */}
                                <rect x="5" y="10" width="90" height="20" fill="none" stroke="#64748b" strokeWidth="1" />
                                {/* Long bars */}
                                <line x1="7" y1="13" x2="93" y2="13" stroke="#dc2626" strokeWidth="1" />
                                <line x1="7" y1="27" x2="93" y2="27" stroke="#dc2626" strokeWidth="1" />
                                {/* Bottom additions */}
                                <line x1="30" y1="25" x2="70" y2="25" stroke="#2563eb" strokeWidth="1.5" />
                                {/* Stirrups */}
                                {Array.from({ length: 15 }).map((_, i) => (
                                  <line key={i} x1={10 + i * 5.7} y1="11" x2="10 + i * 5.7" y2="29" stroke="#16a34a" strokeWidth="0.5" />
                                ))}
                                <text x="35" y="8" fill="#1e293b" className="font-mono text-[4.5px] font-bold">Detail B1 Top Reinforcement Extra</text>
                              </svg>
                            </div>
                            <div className="text-[7px] text-slate-400 font-mono text-center">
                              تفريد الأسيخ والكاتات العرضية الطولية وتفصيله المقاوم للقص والفتل
                            </div>
                          </div>
                        )}

                        {vp.type === 'section' && (
                          <div className="w-full h-full flex items-center justify-center">
                            {/* Draw beam cross section */}
                            <svg viewBox="0 0 50 50" className="w-full max-h-[80px]">
                              {/* Column Core */}
                              <rect x="10" y="10" width="30" height="30" fill="none" stroke="#475569" strokeWidth="1.2" />
                              {/* Stirrup closed loop */}
                              <rect x="12" y="12" width="26" height="26" fill="none" stroke="#16a34a" strokeWidth="0.8" />
                              {/* Main bars */}
                              <circle cx="14" cy="14" r="2.2" fill="#dc2626" />
                              <circle cx="36" cy="14" r="2.2" fill="#dc2626" />
                              <circle cx="14" cy="36" r="2.2" fill="#dc2626" />
                              <circle cx="36" cy="36" r="2.2" fill="#dc2626" />
                              {/* Middle bars */}
                              <circle cx="25" cy="14" r="1.8" fill="#2563eb" />
                              <circle cx="25" cy="36" r="1.8" fill="#2563eb" />
                              
                              <text x="25" y="47" textAnchor="middle" fill="#1e293b" className="font-mono text-[4px] font-bold">SEC 300x500</text>
                            </svg>
                          </div>
                        )}

                      </div>

                      {/* Manual coordinate modifier handle inside card */}
                      <div className="absolute bottom-1 left-1 opacity-0 group-hover/vp:opacity-100 transition-opacity bg-cyan-600 text-white p-0.5 rounded text-[8px] flex items-center gap-1 z-10">
                        <Maximize2 className="w-2 h-2" />
                        <span>X: {vp.x}, Y: {vp.y}</span>
                      </div>
                    </div>
                  );
                })}

                {/* VISUAL TITLE BLOCK SYSTEM (Standard ISO Placement Bottom Right) */}
                <div 
                  className="absolute border-t-2 border-r-2 border-slate-900 bg-slate-50 flex flex-col justify-between"
                  style={{
                    right: `${activeSheet.margin}px`,
                    bottom: `${activeSheet.margin}px`,
                    width: '260px',
                    height: '110px',
                    fontSize: '6.5px',
                    padding: '6px',
                    zIndex: 10
                  }}
                >
                  <div className="grid grid-cols-2 border-b border-slate-200 pb-1">
                    <div className="text-right">
                      <span className="text-slate-400 block text-[5px]">المشروع الإنشائي:</span>
                      <span className="font-bold text-slate-800 line-clamp-1">{titleBlock.projectName}</span>
                    </div>
                    <div className="text-left font-mono text-[5px] text-slate-500">
                      PRJ NO: {titleBlock.projectNumber}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-b border-slate-200 pb-1 py-0.5">
                    <div>
                      <span className="text-slate-400 block text-[5px]">الاستشاري المكلف:</span>
                      <span className="font-semibold text-slate-700 line-clamp-1">{titleBlock.consultant}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[5px]">صاحب العمل / المالك:</span>
                      <span className="font-semibold text-slate-700 line-clamp-1">{titleBlock.client}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1 border-b border-slate-200 pb-1 py-0.5 text-center">
                    <div>
                      <span className="text-slate-400 block text-[4.5px]">المصمم:</span>
                      <span className="font-medium font-mono text-slate-700">{titleBlock.designer}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[4.5px]">التدقيق:</span>
                      <span className="font-medium font-mono text-slate-700">{titleBlock.checker}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[4.5px]">التاريخ:</span>
                      <span className="font-medium font-mono text-slate-700">{titleBlock.date}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-100 p-1 rounded-xs border border-slate-200">
                    <div>
                      <span className="text-slate-400 text-[5px] block">اسم اللوحة والمخطط:</span>
                      <span className="font-extrabold text-[8px] text-slate-800 line-clamp-1">{titleBlock.drawingTitle}</span>
                    </div>
                    <div className="text-left font-mono">
                      <span className="text-slate-400 text-[4px] block">SHEET NO:</span>
                      <span className="font-black text-xs text-cyan-700">{titleBlock.drawingNumber}</span>
                    </div>
                  </div>
                </div>

                {/* COMPASS / NORTH ARROW WITH ROTATION AND AUTOPOSITIONING */}
                {showNorthArrow && (
                  <div 
                    className="absolute bg-white/90 backdrop-blur-xs p-1.5 rounded-full border border-slate-200 shadow-xs flex flex-col items-center justify-center transition-all duration-300"
                    style={{
                      left: `calc(${activeSheet.margin}px + 10px)`,
                      bottom: `calc(${activeSheet.margin}px + 10px)`,
                      transform: 'scale(0.8)',
                      zIndex: 10
                    }}
                  >
                    <Compass 
                      className="w-10 h-10 text-cyan-600 transition-transform duration-300"
                      style={{ transform: `rotate(${northRotation}deg)` }}
                    />
                    <span className="text-[7px] font-black mt-0.5 text-slate-500 font-mono">SHAMAL</span>
                  </div>
                )}

              </div>
            ) : (
              <div className="text-center text-slate-500 py-10 space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin mx-auto" />
                <p>جاري صياغة وتهيئة لوحات المشروع...</p>
              </div>
            )}

            {/* Instruction footnote */}
            <p className="text-[10px] text-slate-400 mt-4 text-center">
              أنقر على أي منفذ (Viewport) لتعديل خصائصه من لوحة التحكم الجانبية. تدعم اللوحة التحديد وإعادة الهيكلة والتنزيل الفوري.
            </p>

          </div>

          {/* REAL-TIME SHEET BOUNDARY VALIDATOR SHEET & REVISION DETAILS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUMN 1: LIVE VALIDATION REPORT */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 flex flex-row items-center justify-between">
                <ClipboardList className="w-4 h-4 text-cyan-600" />
                <CardTitle className="text-xs font-extrabold text-slate-700">
                  لوحة التحقق والمطابقة الإنشائية للورق (Sheet Validation Audit)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs text-right">
                {activeSheetIssues.length > 0 ? (
                  <div className="space-y-2">
                    {activeSheetIssues.map((issue) => (
                      <div 
                        key={issue.id}
                        className={`p-3 rounded-lg flex items-start gap-2.5 border ${
                          issue.severity === 'error' 
                            ? 'bg-red-50 border-red-200 text-red-900' 
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`} />
                        <div>
                          <div className="font-extrabold text-[11px]">
                            {issue.severity === 'error' ? 'خطأ تخطيطي حرج:' : 'تنبيه تنظيمي للورق:'}
                          </div>
                          <p className="text-[10px] text-slate-600 mt-0.5">{issue.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center font-bold text-sm">✓</div>
                    <div>
                      <h4 className="font-extrabold text-[11px]">اللوحة مستوفية للشروط تماماً ومطابقة لمعايير STA4CAD!</h4>
                      <p className="text-[10px] text-emerald-700 mt-0.5">لم يتم رصد أي تداخلات أو فيض للحدود الخارجية بجميع مقاييس Viewports.</p>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
                  <p className="font-bold">• اشتراطات البلدية وكود البناء السعودي (SBC-304):</p>
                  <p>تتم مراجعة أحجام التفاصيل الإنشائية لضمان وضوح تفاصيل التراكب وأطوال التطوير لأسياخ حديد التسليح تجنباً للقلق الفني بموقع الصب.</p>
                </div>
              </CardContent>
            </Card>

            {/* COLUMN 2: REVISION MANAGEMENT & COMPASS CONTROLLER */}
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 flex flex-row items-center justify-between">
                <Compass className="w-4 h-4 text-cyan-600 animate-spin-slow" />
                <CardTitle className="text-xs font-extrabold text-slate-700">
                  لوحة المراجعات والإبرة المغناطيسية (Revisions & True North)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs text-right">
                
                {/* 1. Compass Controller */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 block">إبرة الشمال (North Arrow):</span>
                    <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={showNorthArrow}
                        onChange={(e) => setShowNorthArrow(e.target.checked)}
                        className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-[11px] text-slate-600">إظهار مؤشر الشمال بالمخطط</span>
                    </label>
                  </div>

                  {showNorthArrow && (
                    <div className="space-y-1 text-left font-mono">
                      <span className="text-[10px] text-slate-400 block text-right">زاوية الدوران (°):</span>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          value={northRotation}
                          onChange={(e) => setNorthRotation(parseInt(e.target.value) || 0)}
                          className="h-7 text-xs text-center w-20 bg-white"
                        />
                        <span className="text-slate-500 text-[10px]">درجة</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Revisions Register */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Button 
                      size="xs" 
                      variant="outline" 
                      onClick={handleAddRevision}
                      className="h-6 text-[10px] font-bold border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                    >
                      أضف تعديل مراجعة جديد
                    </Button>
                    <span className="font-bold text-slate-700">سجل التعديلات وإصدار العمل (Revision Log):</span>
                  </div>

                  {activeSheet && activeSheet.revisions.length > 0 ? (
                    <div className="max-h-[140px] overflow-y-auto border border-slate-100 rounded-lg space-y-1.5 p-1 bg-white">
                      {activeSheet.revisions.map((rev) => (
                        <div key={rev.id} className="p-2 rounded bg-slate-50 border border-slate-100 text-[10px] flex justify-between items-start gap-2">
                          <div className="font-mono text-cyan-700 font-bold bg-cyan-50 px-1 rounded h-4 shrink-0 mt-0.5">
                            {rev.number}
                          </div>
                          <div className="flex-1 space-y-0.5 text-right">
                            <p className="font-semibold text-slate-800 line-clamp-1">{rev.description}</p>
                            <span className="text-[8px] text-slate-400 font-mono">المدقق: {rev.designer} | التاريخ: {rev.date}</span>
                          </div>
                          <button
                            onClick={() => {
                              setSheets(prev => prev.map(s => {
                                if (s.id === selectedSheetId) {
                                  return { ...s, revisions: s.revisions.filter(r => r.id !== rev.id) };
                                }
                                return s;
                              }));
                            }}
                            className="bg-transparent hover:text-red-500 text-slate-300 p-0.5"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4 bg-slate-50 rounded">لا توجد سجلات مراجعة للمخطط الفعلي.</p>
                  )}
                </div>

              </CardContent>
            </Card>

          </div>

        </div>

      </div>

      {/* 3. DOCK CONTROL PANELS: DYNAMIC CONFIGURATIONS & COMPLETED DELIVERABLES REPORTS */}
      <Card className="border-slate-200 shadow-sm mt-4">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-3.5 flex flex-row items-center justify-between">
          <BookOpen className="w-5 h-5 text-cyan-600" />
          <CardTitle className="text-sm font-extrabold text-slate-800">
            دفتر المواصفات الفنية والملاحظات التنفيذية الشاملة للجسور والأسقف (General Structural Notes Editor)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4 text-xs text-right leading-relaxed">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            {activeNotes.map((note, index) => (
              <div key={index} className="flex gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="font-extrabold text-cyan-600 shrink-0 select-none">• {index + 1}</span>
                <p className="text-[11px] text-slate-700 flex-1">{note}</p>
                <button 
                  onClick={() => setActiveNotes(prev => prev.filter((_, i) => i !== index))}
                  className="text-slate-300 hover:text-red-500 shrink-0 text-[10px] hover:font-bold px-1"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input 
              placeholder="اكتب ملاحظة إنشائية أو اشتراط تنفيذي إضافي ليتم إدراجه فوراً في المخطط..." 
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="text-xs h-9 text-right"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustomNote();
              }}
            />
            <Button 
              onClick={handleAddCustomNote}
              className="bg-cyan-600 hover:bg-cyan-700 text-white shrink-0 h-9 font-bold text-xs"
            >
              أدرج الملاحظة
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* 4. MODAL/PANEL DIALOG FOR CAD DXF INTERFACE EXPORT DISPLAY */}
      {showDxfExport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" style={{ direction: 'rtl' }}>
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            
            <div className="p-5 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
                <h3 className="font-bold text-base text-white">منفذ تصدير كود ملفات CAD (DXF Output Console)</h3>
              </div>
              <button 
                onClick={() => setShowDxfExport(false)} 
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                ×
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <p className="text-slate-300 text-xs">
                تم صياغة المخطط الإنشائي وتجميع كافة الإحداثيات والحدود للوحات الإنشائية وفق مقاييس الورق وكتلة العنوان الموحدة. يمكنك نسخ الكود أو تحميل الملف وفتحه على AutoCAD أو MicroStation مباشرة لدقة طباعية قصوى:
              </p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center text-[10px] text-slate-500 pb-2 border-b border-slate-800 font-mono">
                  <span>FILE NO: {activeSheet?.sheetNo}.DXF</span>
                  <span>FORMAT: AutoCAD R2000 ASCII</span>
                </div>
                <textarea 
                  readOnly 
                  value={dxfOutput}
                  className="w-full h-64 text-[10px] font-mono bg-transparent text-emerald-400 border-0 focus:ring-0 mt-2 text-left resize-vertical" 
                  style={{ direction: 'ltr' }}
                />
              </div>

              <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-lg text-[11px] text-emerald-300">
                • تم تصدير الحدود الخارجية والداخلية ومخطط كتلة العنوان ISO 7200 كأشكال بوليلاين هندسية (Polyline Structure) لتأكيد المطابقة الرقمية التامة في المكاتب الهندسية.
              </div>
            </div>

            <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex justify-end gap-2">
              <Button 
                onClick={downloadDxfFile}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
              >
                <Download className="w-4 h-4" />
                تحميل ملف DXF المتكامل دقة عالية
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowDxfExport(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                رجوع وإغلاق
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

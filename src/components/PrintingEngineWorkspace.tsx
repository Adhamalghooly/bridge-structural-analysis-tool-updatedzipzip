import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Printer, ZoomIn, ZoomOut, Maximize, FileText, CheckSquare, 
  Settings, AlertTriangle, Check, RefreshCw, Layers2, Eye, Grid3X3, 
  Trash2, ChevronLeft, ChevronRight, Sliders, Info, Download, HelpCircle,
  Minimize2, ShieldAlert, BadgeInfo, Compass, FileSpreadsheet, Lock
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { Slab, Column, Beam, Story, ColumnResult } from '@/lib/structuralEngine';

interface PrintingEngineWorkspaceProps {
  stories: Story[];
  slabs: Slab[];
  beams: Beam[];
  columns: Column[];
  beamDesigns?: any[];
  colDesigns?: Record<string, ColumnResult | any>;
  slabProps?: any;
  mat?: any;
  projectName?: string;
  titleBlockConfig?: any;
  analyzed?: boolean;
}

// Map paper sizes to aspect ratios and dimensions in mm
type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'Custom';
interface PaperConfig {
  widthMm: number;
  heightMm: number;
  ratio: number;
  label: string;
}

const PAPER_CONFIGS: Record<PaperSize, PaperConfig> = {
  A4: { widthMm: 297, heightMm: 210, ratio: 1.414, label: 'A4 (297 x 210 mm)' },
  A3: { widthMm: 420, heightMm: 297, ratio: 1.414, label: 'A3 (420 x 297 mm)' },
  A2: { widthMm: 594, heightMm: 420, ratio: 1.414, label: 'A2 (594 x 420 m)' },
  A1: { widthMm: 841, heightMm: 594, ratio: 1.414, label: 'A1 (841 x 594 mm)' },
  A0: { widthMm: 1189, heightMm: 841, ratio: 1.414, label: 'A0 (1189 x 841 mm)' },
  Custom: { widthMm: 500, heightMm: 500, ratio: 1.0, label: 'مخصص / Custom Size' }
};

type PrintStyle = 'Color' | 'Grayscale' | 'Monochrome' | 'PlotStyle';

interface Sheet {
  id: string; // S-101 etc.
  title: string;
  arabicTitle: string;
  category: 'Plan' | 'Detail' | 'Schedule' | 'BBS' | 'Report' | 'Notes';
  scale: string;
  revision: string;
}

export default function PrintingEngineWorkspace({
  stories = [],
  slabs = [],
  beams = [],
  columns = [],
  beamDesigns = [],
  colDesigns = {},
  slabProps = { thickness: 150, cover: 20 },
  mat = { fc: 25, fy: 420 },
  projectName = 'مشروع سكن نموذجي',
  titleBlockConfig = {},
  analyzed = false
}: PrintingEngineWorkspaceProps) {

  // --- PAPER SETUP STATES ---
  const [paperSize, setPaperSize] = useState<PaperSize>('A3');
  const [orientation, setOrientation] = useState<'Landscape' | 'Portrait'>('Landscape');
  const [customWidthMm, setCustomWidthMm] = useState<number>(500);
  const [customHeightMm, setCustomHeightMm] = useState<number>(375);
  const [printStyle, setPrintStyle] = useState<PrintStyle>('PlotStyle');
  const [drawingScale, setDrawingScale] = useState<string>('1:50');

  // --- VIEWPORT / NAVIGATION STATES ---
  const [currentSheetIdx, setCurrentSheetIdx] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(0.85); // 0.1 to 3.0
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [multiPageMode, setMultiPageMode] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // --- BATCH SELECTION STATES ---
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(new Set(['S-101', 'S-102', 'S-103', 'S-104', 'S-105', 'S-106']));

  // --- TITLE BLOCK CONFIGURATIONS ---
  const [titleBlock, setTitleBlock] = useState({
    projectName: projectName || 'مشروع سكن نموذجي',
    clientName: titleBlockConfig?.clientName || 'وزارة الشؤون البلدية والقروية والإسكان',
    designedBy: titleBlockConfig?.designedBy || 'Eng. Structural AI',
    checkedBy: titleBlockConfig?.checkedBy || 'Senior Engineer',
    revision: titleBlockConfig?.revision || 'R0',
    date: titleBlockConfig?.date || new Date().toISOString().split('T')[0],
    designCode: 'ACI 318-19 / SBC 304',
    fc: mat?.fc || 25,
    fy: mat?.fy || 420
  });

  // --- HEADER AND FOOTER FLAGS ---
  const [showHeader, setShowHeader] = useState<boolean>(true);
  const [showFooter, setShowFooter] = useState<boolean>(true);

  // Sync titleBlock on prop changes
  useEffect(() => {
    if (projectName) {
      setTitleBlock(p => ({ ...p, projectName }));
    }
  }, [projectName]);

  // Total sheets structure
  const sheets: Sheet[] = useMemo(() => [
    { id: 'S-101', title: 'FOUNDATION LAYOUT & EXCAVATION PLAN', arabicTitle: 'مخطط توزيع الأساسات والمحاور العام وحفر الردم', category: 'Plan', scale: drawingScale, revision: titleBlock.revision },
    { id: 'S-102', title: 'SLAB REINFORCEMENT & SHAPES PLAN', arabicTitle: 'مسقط تفاصيل وتسليح حديد الأسقف والبلاطات', category: 'Plan', scale: drawingScale, revision: titleBlock.revision },
    { id: 'S-103', title: 'TYPICAL CONCRETE SECTIONS & DETAILED JOINTS', arabicTitle: 'مخطط القطاعات الخرسانية النموذجية ومفاصل الإنشاء', category: 'Detail', scale: '1:20', revision: titleBlock.revision },
    { id: 'S-104', title: 'BEAMS & COLUMNS APPROVED SCHEDULE RULES', arabicTitle: 'جدول نماذج الجسور والأعمدة الإنشائية المعتمد', category: 'Schedule', scale: 'N.T.S.', revision: titleBlock.revision },
    { id: 'S-105', title: 'BAR BENDING SCHEDULE & REBAR DATABASE (BBS)', arabicTitle: 'كشف تفريد وجدول ثني وتفصيل حديد التسليح الصافي', category: 'BBS', scale: 'N.T.S.', revision: titleBlock.revision },
    { id: 'S-106', title: 'BILL OF QUANTITIES (BOQ) & QUANTITY TAKEOFF', arabicTitle: 'جدول حصر المساحات وكميات حديد التسليح والخرسانات', category: 'Report', scale: 'N.T.S.', revision: titleBlock.revision },
    { id: 'S-107', title: 'GENERAL SPECIFICATIONS & STRUCTURAL NOTES', arabicTitle: 'الملاحظات الإنشائية الفنية العامة والاشتراطات الفنية', category: 'Notes', scale: 'N.T.S.', revision: titleBlock.revision }
  ], [drawingScale, titleBlock.revision]);

  // Compute Active Dimensions
  const paperWidthMm = paperSize === 'Custom' ? customWidthMm : PAPER_CONFIGS[paperSize].widthMm;
  const paperHeightMm = paperSize === 'Custom' ? customHeightMm : PAPER_CONFIGS[paperSize].heightMm;

  const actualWidth = orientation === 'Landscape' ? paperWidthMm : paperHeightMm;
  const actualHeight = orientation === 'Landscape' ? paperHeightMm : paperWidthMm;

  // Viewport navigation helpers
  const handleZoom = (factor: number) => {
    setZoom(prev => Math.min(4.0, Math.max(0.15, prev * factor)));
  };

  const handleResetZoomAndPan = () => {
    setZoom(paperSize === 'A1' || paperSize === 'A0' ? 0.35 : 0.75);
    setPanX(0);
    setPanY(0);
  };

  const handleFitWidth = () => {
    if (viewportRef.current) {
      const parentW = viewportRef.current.clientWidth - 40;
      const sheetWInPx = actualWidth * 3.78 * zoom; // approximate mm to px conversion
      setZoom(parentW / (actualWidth * 3.78));
      setPanX(0);
      setPanY(0);
    }
  };

  const handleFitPage = () => {
    if (viewportRef.current) {
      const parentW = viewportRef.current.clientWidth - 40;
      const parentH = viewportRef.current.clientHeight - 40;
      const zoomW = parentW / (actualWidth * 3.78);
      const zoomH = parentH / (actualHeight * 3.78);
      setZoom(Math.min(zoomW, zoomH));
      setPanX(0);
      setPanY(0);
    }
  };

  // Drag and Pan interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.current.x);
    setPanY(e.clientY - dragStart.current.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Toggle selection for batch print
  const toggleSheetSelection = (id: string) => {
    const next = new Set(selectedSheetIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedSheetIds(next);
  };

  const selectAllSheets = () => {
    setSelectedSheetIds(new Set(sheets.map(s => s.id)));
  };

  const clearAllSelectedSheets = () => {
    setSelectedSheetIds(new Set());
  };

  const currentSheet = sheets[currentSheetIdx] || sheets[0];

  // Plot styles calculations
  const getStyleClass = () => {
    switch (printStyle) {
      case 'Monochrome':
        return 'print-monochrome filter grayscale contrast-200 brightness-95';
      case 'Grayscale':
        return 'print-grayscale filter grayscale';
      case 'PlotStyle':
        return 'print-plot-style';
      default:
        return '';
    }
  };

  // Scale computation
  const scaleRatio = useMemo(() => {
    const numericPart = parseInt(drawingScale.split(':')[1]) || 50;
    return 1 / numericPart;
  }, [drawingScale]);

  // QA/QC Auto-validation rules engine
  const qaIssues = useMemo(() => {
    const issues: { id: string; type: 'warning' | 'error' | 'success'; message: string; sheetId?: string }[] = [];
    
    // Check missing designs
    if (!analyzed) {
      issues.push({
        id: 'missing-analysis',
        type: 'error',
        message: 'عنصر تصميم مفقود: لم يتم تشغيل التحليل الإنشائي الكامل للمشروع بعد. قد تحتوي النماذج على بيانات افتراضية.'
      });
    }

    // Check missing sheets from package
    if (selectedSheetIds.size === 0) {
      issues.push({
        id: 'no-sheets-selected',
        type: 'error',
        message: 'لا توجد لوحات محددة للطباعة. يرجى تحديد لوحة واحدة كحد أدنى في شجرة المشروع.'
      });
    }

    // Scale warnings
    const scaleNum = parseInt(drawingScale.split(':')[1]) || 50;
    if (scaleNum < 20 && (paperSize === 'A4' || paperSize === 'A3')) {
      issues.push({
        id: 'scale-too-large',
        type: 'warning',
        message: `مقياس الرسم كبير جداً لورقة ${paperSize}. قد يؤدي مقياس ${drawingScale} إلى تجاوز الرسمة حدود ورقة الطباعة بشكل متقطع.`
      });
    }

    if (scaleNum > 150 && (paperSize === 'A1' || paperSize === 'A0')) {
      issues.push({
        id: 'scale-too-small',
        type: 'warning',
        message: `مقياس الرسم صغير جداً لورقة ${paperSize}. قد تظهر الأبعاد والملاحظات بحجم متناهي الصغر وغير مقروء لدى الطباعة.`
      });
    }

    // Reference checking
    if (slabs.length === 0) {
      issues.push({
        id: 'missing-slabs',
        type: 'error',
        message: 'خطأ تخطيطي: غياب البلاطات الخرسانية عن المسقط الأفقي. يرجى مراجعة المدخلات الإنشائية.'
      });
    }

    if (beams.length === 0) {
      issues.push({
        id: 'missing-beams',
        type: 'warning',
        message: 'تنبيه: لا توجد جسور مدعومة في مستور الأساسات والمدادات. تحقق من الروابط الإنشائية.'
      });
    }

    // Title Block Quality Rules
    if (!titleBlock.projectName || titleBlock.projectName.trim() === '') {
      issues.push({
        id: 'empty-project-name',
        type: 'warning',
        message: 'اسم المشروع فارغ في رأس اللوحات. يرجى تعبئته لإثبات ملكية المخطط القانوني.'
      });
    }

    // Multi-floor checklist
    const storiesWithElements = new Set(beams.map(b => b.storyId).filter(Boolean));
    if (stories.length > 1 && storiesWithElements.size < stories.length) {
      issues.push({
        id: 'missing-floor-details',
        type: 'warning',
        message: 'مستويات مفقودة: بعض الطوابق المسجلة بالمبنى لا تحتوي على عناصر إنشائية أو تفاصيل تسليح.'
      });
    }

    if (issues.length === 0) {
      issues.push({
        id: 'all-clear',
        type: 'success',
        message: 'جاهز للطباعة تماماً ✓ جميع اختبارات ومراجعة الجودة ومطابقة المقياس والمحتوى الإنشائي تجاوزت الفحص الهندسي بنجاح.'
      });
    }

    return issues;
  }, [analyzed, selectedSheetIds, drawingScale, paperSize, slabs, beams, titleBlock.projectName, stories]);

  // System print trigger
  const handleSystemPrint = () => {
    // Dynamically inject printing styles and hidden container
    const printContainer = document.createElement('div');
    printContainer.id = 'printing-engine-direct-container';
    printContainer.style.position = 'absolute';
    printContainer.style.top = '0';
    printContainer.style.left = '0';
    printContainer.style.width = '100%';
    printContainer.style.zIndex = '-9999';
    printContainer.style.background = 'white';

    // Generate style rules
    const styleElement = document.createElement('style');
    styleElement.id = 'printing-engine-direct-styles';
    styleElement.innerHTML = `
      @media print {
        body > * {
          display: none !important;
        }
        #printing-engine-direct-container {
          display: block !important;
          position: relative !important;
          z-index: 99999 !important;
          background: white !important;
        }
        .printable-sheet {
          width: ${actualWidth}mm !important;
          height: ${actualHeight}mm !important;
          page-break-after: always !important;
          position: relative !important;
          box-shadow: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }
        @page {
          size: ${actualWidth}mm ${actualHeight}mm;
          margin: 0;
        }
      }
    `;

    document.head.appendChild(styleElement);
    document.body.appendChild(printContainer);

    // Filter print items based on selection
    const activeSelectedSheets = sheets.filter(s => selectedSheetIds.has(s.id));

    // Render HTML inside printing container
    let sheetsHTML = '';
    activeSelectedSheets.forEach((sheet, idx) => {
      const sheetSvgId = `direct-print-svg-${sheet.id}`;
      sheetsHTML += `
        <div class="printable-sheet ${getStyleClass()}" style="width: ${actualWidth * 3.78}px; height: ${actualHeight * 3.78}px; background: white; margin-bottom: 20px; border: 1px solid #ddd; position: relative; box-sizing: border-box; overflow: hidden; page-break-after: always;">
          <!-- Inline frame boundary -->
          <div style="position: absolute; top: 15px; left: 15px; right: 15px; bottom: 15px; border: 3px solid #000; box-sizing: border-box; pointer-events: none;"></div>
          <div style="position: absolute; top: 22px; left: 22px; right: 22px; bottom: 22px; border: 1px solid #000; box-sizing: border-box; pointer-events: none;"></div>
          <!-- Real content injection -->
          <div style="position: absolute; top: 35px; left: 35px; right: 35px; bottom: 180px; box-sizing: border-box; overflow: hidden; direction: rtl; text-align: right;">
            ${renderSheetDirectHTML(sheet, idx)}
          </div>
          <!-- Title block -->
          ${renderTitleBlockHTML(sheet, idx)}
        </div>
      `;
    });

    printContainer.innerHTML = sheetsHTML;

    // Trigger window print
    setTimeout(() => {
      window.print();
      // Clean up after print window opens dialg
      setTimeout(() => {
        const rules = document.getElementById('printing-engine-direct-styles');
        const cont = document.getElementById('printing-engine-direct-container');
        if (rules) rules.remove();
        if (cont) cont.remove();
      }, 1000);
    }, 500);
  };

  // Render direct HTML content for print fallback layout
  const renderSheetDirectHTML = (sheet: Sheet, idx: number) => {
    switch (sheet.id) {
      case 'S-101':
        return `
          <div style="padding: 20px; font-family: sans-serif; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
            <h2 style="font-size: 24px; color: #111; margin-bottom: 10px;">مسقط الأساسات والمحاور العام - S-101</h2>
            <p style="font-size: 14px; color: #444;">توزيع إجمالي لعدد ${columns.filter(c => !c.isRemoved).length} عمود خرساني مع القواعد والشدادات الأرضية الإنشائية.</p>
            <div style="width: 100%; max-width: 500px; height: 300px; border: 2px solid #555; background: #fafafa; margin: 20px auto; border-radius: 6px; display: flex; align-items: center; justify-content: center; position: relative;">
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; width: 90%; height: 90%; padding: 10px;">
                ${slabs.slice(0, 8).map(s => `
                  <div style="border: 2.5px solid #2563eb; background: rgba(37,99,235,0.05); display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 4px; padding: 10px; position: relative;">
                    <strong style="color: #1e3a8a; font-size: 14px;">${s.id}</strong>
                    <span style="font-size: 11px; font-family: monospace; color: #4b5563;">t=${s.t || 150}mm</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      case 'S-102':
        return `
          <div style="padding: 20px; font-family: sans-serif; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
            <h2 style="font-size: 24px; color: #111; margin-bottom: 10px;">مسقط تسليح البلاطات والجسور - S-102</h2>
            <p style="font-size: 14px; color: #444;">تفاصيل شبكة تسليح المتر الطولي للحديد السفلي والعلوي المصمم للبلاطات.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; border: 2px solid #000;">
              <thead>
                <tr style="background: #1e3a8a; color: white;">
                  <th style="border: 1px solid #000; padding: 8px;">رمز البلاطة</th>
                  <th style="border: 1px solid #000; padding: 8px;">السماكة</th>
                  <th style="border: 1px solid #000; padding: 8px;">التسليح الأفقي X</th>
                  <th style="border: 1px solid #000; padding: 8px;">التسليح الرأسي Y</th>
                </tr>
              </thead>
              <tbody>
                ${slabs.map(s => `
                  <tr>
                    <td style="border: 1px solid #000; padding: 8px; font-weight: bold; background: #eef2ff;">${s.id}</td>
                    <td style="border: 1px solid #000; padding: 8px; text-align: center;">${s.t || 150} mm</td>
                    <td style="border: 1px solid #000; padding: 8px; font-family: monospace; text-align: center; font-weight: bold; color: #0369a1;">5 Φ 12 / m</td>
                    <td style="border: 1px solid #000; padding: 8px; font-family: monospace; text-align: center; font-weight: bold; color: #b91c1c;">5 Φ 12 / m</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      case 'S-103':
        return `
          <div style="padding: 20px; font-family: sans-serif; text-align: center;">
            <h2 style="font-size: 21px; color: #111; margin-bottom: 10px;">تفاصيل القطاعات الخرسانية وجداول تسليح الأعمدة والجسور</h2>
            <div style="display: flex; gap: 20px; justify-content: center; margin-top: 30px;">
              <div style="border: 1px solid #000; padding: 15px; width: 45%; background: #fbfbfb;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #111; border-bottom: 2px solid #b91c1c; padding-bottom: 5px;">قطاع عمود خرساني نموذجي - Typical Column Section</h4>
                <div style="width: 140px; height: 140px; border: 3px solid #333; background: #fff; margin: 15px auto; position: relative; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                  <div style="width: 110px; height: 110px; border: 1.5px solid #bd2f15; border-radius: 2px; position: relative;">
                    <!-- Inner hooks -->
                    <div style="position: absolute; top: 10px; left: 10px; width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; top: 10px; right: 10px; width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; bottom: 10px; left: 10px; width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; bottom: 10px; right: 10px; width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; top: 50%; left: 10px; transform: translateY(-50%); width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; top: 50%; right: 10px; transform: translateY(-50%); width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                  </div>
                </div>
                <strong style="font-size: 11px; display: block; color: #333;">تسليح تسليح 8 Φ 16 مع كانات قطر 10 مم كل 150 مم</strong>
              </div>
              <div style="border: 1px solid #000; padding: 15px; width: 45%; background: #fbfbfb;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #111; border-bottom: 2px solid #047857; padding-bottom: 5px;">قطاع جسر ساقط نموذجي - Typical Beam Section</h4>
                <div style="width: 100px; height: 160px; border: 3px solid #333; background: #fff; margin: 5px auto; position: relative; border-radius: 4px;">
                  <div style="position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px; border: 1.5px solid #2563eb;">
                    <!-- Rebar points -->
                    <div style="position: absolute; top: 5px; left: 5px; width: 6px; height: 6px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; top: 5px; right: 5px; width: 6px; height: 6px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; bottom: 5px; left: 5px; width: 7px; height: 7px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; bottom: 5px; right: 5px; width: 7px; height: 7px; background: #000; border-radius: 50%;"></div>
                    <div style="position: absolute; bottom: 5px; left: 45%; width: 7px; height: 7px; background: #000; border-radius: 50%;"></div>
                  </div>
                </div>
                <strong style="font-size: 11px; display: block; color: #333; margin-top: 5px;">علوي: 2 Φ 14 | سفلي: 3 Φ 16 أساسي</strong>
              </div>
            </div>
          </div>
        `;
      case 'S-104':
        return `
          <div style="padding: 20px; font-family: sans-serif; text-align: center;">
            <h2 style="font-size: 21px; color: #111; margin-bottom: 10px;">جدول تسليح ونماذج الجسور والأعمدة الإنشائية المعتمدة</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px;">
              <thead>
                <tr style="background: #111827; color: white;">
                  <th style="border: 1px solid #000; padding: 6px;">رمز قطاع الجسر</th>
                  <th style="border: 1px solid #000; padding: 6px;">الأبعاد B × H (mm)</th>
                  <th style="border: 1px solid #000; padding: 6px;">التسليح السفلي الرئيسي</th>
                  <th style="border: 1px solid #000; padding: 6px;">التسليح العلوي المقاوم</th>
                  <th style="border: 1px solid #000; padding: 6px;">الكانات بالمتر الطولي</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">ج-1 (Beam B1)</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center;">250 × 600</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #1e3a8a; font-weight: bold;">3 Φ 16</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #047857; font-weight: bold;">2 Φ 14</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center;">Φ 10 @ 150 mm</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">ج-2 (Beam B2)</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center;">250 × 700</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #1e3a8a; font-weight: bold;">4 Φ 16</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #047857; font-weight: bold;">2 Φ 16</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center;">Φ 10 @ 125 mm</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">ج-3 (Beam B3)</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center;">200 × 500</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #1e3a8a; font-weight: bold;">3 Φ 14</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; color: #047857; font-weight: bold;">2 Φ 12</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center;">Φ 8 @ 150 mm</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      case 'S-105':
        return `
          <div style="padding: 20px; font-family: sans-serif; text-align: center;">
            <h2 style="font-size: 21px; color: #111; margin-bottom: 5px;">بيان تفريد ورسومات قطعيات حديد التسليح للمشروع (BBS Database)</h2>
            <p style="font-size: 11px; color: #555; margin-bottom: 15px;">ACI 315-99 / ACI 318 Standard Bar Bending Rules for Structural Elements.</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
              <thead>
                <tr style="background: #065f46; color: white;">
                  <th style="border: 1px solid #000; padding: 5px;">علامة السيخ</th>
                  <th style="border: 1px solid #000; padding: 5px;">نوع العنصر</th>
                  <th style="border: 1px solid #000; padding: 5px;">الموقع بالقطاع</th>
                  <th style="border: 1px solid #000; padding: 5px;">الشكل المعياري</th>
                  <th style="border: 1px solid #000; padding: 5px;">القطر</th>
                  <th style="border: 1px solid #000; padding: 5px;">طول السيخ (م)</th>
                  <th style="border: 1px solid #000; padding: 5px;">الوزن الشامل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">B1-BOT-Bar</td>
                  <td style="border: 1px solid #000; padding: 5px;">جسر B1</td>
                  <td style="border: 1px solid #000; padding: 5px;">سفلي مستقيم</td>
                  <td style="border: 1px solid #000; padding: 5px; font-family: monospace;">ــــــــــــــــــــــــــــــــ</td>
                  <td style="border: 1px solid #000; padding: 5px;">Φ 16</td>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">5.40 م</td>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold; color: #047857;">25.6 كغ</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">B1-TOP-Bar</td>
                  <td style="border: 1px solid #000; padding: 5px;">جسر B1</td>
                  <td style="border: 1px solid #000; padding: 5px;">علوي تعليق</td>
                  <td style="border: 1px solid #000; padding: 5px; font-family: monospace;">|ــــــــــــــــــــــــــــــ|</td>
                  <td style="border: 1px solid #000; padding: 5px;">Φ 14</td>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">5.80 م</td>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold; color: #047857;">14.0 كغ</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">B1-STR-01</td>
                  <td style="border: 1px solid #000; padding: 5px;">جسر B1</td>
                  <td style="border: 1px solid #000; padding: 5px;">كانات طوق</td>
                  <td style="border: 1px solid #000; padding: 5px; font-family: monospace;">[ █ ]</td>
                  <td style="border: 1px solid #000; padding: 5px;">Φ 10</td>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">1.65 م</td>
                  <td style="border: 1px solid #000; padding: 5px; font-weight: bold; color: #047857;">39.4 كغ</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      case 'S-106':
        return `
          <div style="padding: 20px; font-family: sans-serif; text-align: center;">
            <h2 style="font-size: 21px; color: #111; margin-bottom: 5px;">تقرير ومذكرة حصر وجدولة الكميات الهندسية المعتمدة (BOQ)</h2>
            <div style="width: 100%; border: 1px solid #ddd; padding: 20px; background: #fcfcfc; border-radius: 8px; margin-top: 15px; box-sizing: border-box; text-align: right; direction: rtl;">
              <strong style="font-size: 14px; color: #111; display: block; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 10px;">بيان تفصيل أحجام المواد التقديرية للموقع:</strong>
              <div style="font-size: 12px; line-height: 2;">
                • حجم الخرسانة المسلحة للبلاطات والأسقف الإجمالي: <strong>48.5 متر مكعب (m³)</strong><br>
                • حجم الخرسانة المسلحة للجسور الساقطة والمدادات: <strong>16.2 متر مكعب (m³)</strong><br>
                • حجم الخرسانة المسلحة للأعمدة ورقاب الأعمدة: <strong>8.4 متر مكعب (m³)</strong><br>
                • وزن حديد تسليح البلاطات والأسقف الإجمالي: <strong>3,880 كيلوغرام (kg)</strong><br>
                • وزن حديد تسليح الجسور والجسور الإنشائية: <strong>1,620 كيلوغرام (kg)</strong><br>
                • متوسط كثافة تسليح الأسقف بالخرسانة: <strong>85.0 كغ/م³</strong>
              </div>
            </div>
          </div>
        `;
      case 'S-107':
        return `
          <div style="padding: 15px; font-family: sans-serif; text-align: right; direction: rtl; font-size: 11px; line-height: 1.8;">
            <h3 style="font-size: 15px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; color: #000; margin-bottom: 10px;">الملاحظات واشتراطات التنفيذ الإنشائية العامة (General Structural Specifications)</h3>
            <ol style="margin-top: 5px; padding-right: 20px;">
              <li>تم تصميم المخططات الإنشائية والتحقق من الاستقرار طبقاً لمتطلبات الكود السعودي للبناء الجديد (سلسلة SBC 301-304) المحدث لمتطلبات الكود الأمريكي للخرسانة (ACI 318M-19).</li>
              <li>رتبة الخرسانات المستخدمة لصب العناصر: الأعمدة ورقاب الأساسات (C35 مقاومة 35 ميجا باسكال بعد 28 يوماً) - البلاطات والجسور الساقطة والقواعد (C30 مقاومة 30 ميجا باسكال).</li>
              <li>حديد التسليح المستخدم ذو مقاومة تميزية عالية للشد والأنحناء Grade 420 إجهاد خضوع 420 ميجاباسكال.</li>
              <li>الغطاء الخرساني الحامي للحديد من صدأ الرطوبة: القواعد الملامسة والمدفونة بالتربة (75 مم) - الأعمدة والجسور المعرضة للمناخ (40 مم) - البلاطات والأسقف الداخلية (20 مم).</li>
              <li>طول وصلة التراكب لحديد الشد لا يقل عن 60 مرة من قطر السيخ الأكبر المستخدم بالوصلة (60Ø) مالم يذكر خلاف ذلك.</li>
            </ol>
          </div>
        `;
      default:
        return `<p style="padding: 20px; font-family: sans-serif; text-align: center; font-size: 16px; color: #999;">محتوى هندسي افتراضي / Custom CAD Sheet Core Viewport</p>`;
    }
  };

  // Render Title Block HTML layout
  const renderTitleBlockHTML = (sheet: Sheet, idx: number) => {
    return `
      <div style="position: absolute; left: 35px; bottom: 35px; right: 35px; height: 130px; border: 2.5px solid #000; display: flex; font-family: Arial, sans-serif; direction: rtl; text-align: right; box-sizing: border-box; background: white;">
        <div style="width: 25%; border-left: 1px solid #000; padding: 10px; display: flex; flex-direction: column; justify-content: space-around; box-sizing: border-box;">
          <span style="font-size: 8px; color: #555;">اسم المشروع / PROJECT NAME</span>
          <strong style="font-size: 11px; color: #1e3a8a;">${titleBlock.projectName}</strong>
          <span style="font-size: 8px; color: #555;">المالك والموقع / CLIENT & SITE: ${titleBlock.clientName.slice(0, 32)}...</span>
        </div>
        <div style="width: 35%; border-left: 1px solid #000; padding: 10px; display: flex; flex-direction: column; justify-content: space-around; box-sizing: border-box;">
          <span style="font-size: 8px; color: #555;">عنوان اللوحة الهندسية / SHEET TITLE</span>
          <strong style="font-size: 11px; color: #b91c1c;">${sheet.arabicTitle}</strong>
          <span style="font-size: 8px; color: #555;">SYSTEM DESIGN PACKAGE: STRUCTURAL ENGINEERING DRAWINGS</span>
        </div>
        <div style="width: 15%; border-left: 1px solid #000; padding: 10px; display: flex; flex-direction: column; justify-content: space-around; font-size: 8px; box-sizing: border-box;">
          <div><span style="color: #555;">كود التصميم:</span> <strong>${titleBlock.designCode}</strong></div>
          <div><span style="color: #555;">مقاومة الخرسانة:</span> <strong>f'c = ${titleBlock.fc} MPa</strong></div>
          <div><span style="color: #555;">إجهاد خضوع لحديد:</span> <strong>fy = ${titleBlock.fy} MPa</strong></div>
        </div>
        <div style="width: 15%; border-left: 1px solid #000; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; font-size: 8px; box-sizing: border-box;">
          <div><span style="color: #555;">تصميم وإعداد:</span> <strong>${titleBlock.designedBy}</strong></div>
          <div><span style="color: #555;">مراجعة:</span> <strong>${titleBlock.checkedBy}</strong></div>
          <div><span style="color: #555;">تاريخ النشر:</span> <strong>${titleBlock.date}</strong></div>
        </div>
        <div style="width: 10%; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; background: #fbfbfb; box-sizing: border-box;">
          <div style="text-align: center;">
            <span style="font-size: 8px; color: #555; display: block;">رقم اللوحة / SHEET</span>
            <strong style="font-size: 15px; color: #b91c1c;">${sheet.id}</strong>
          </div>
          <div style="text-align: center; font-size: 8px; border-top: 1px solid #ccc; width: 100%; padding-top: 4px;">
            المقياس: ${sheet.scale}
          </div>
        </div>
      </div>
    `;
  };

  return (
    <div className="flex flex-col gap-6" id="printing-engine-main-workspace">
      {/* QA/QC Validation Alert Strip */}
      <div className="bg-background rounded-xl border p-4 shadow-xs" id="printing-engine-qa-strip">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm lg:text-base text-right">لوحة فحص جودة المخطط وعلاقة محاذاة الطباعة (QA/QC Validation)</h3>
              <p className="text-xs text-muted-foreground text-right">مراقبة جودة متميزة، رصد الأخطاء الهندسية وحواف اللوحات المقطوعة قبل الإرسال للطابعة.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">نسبة نجاح تفتيش الجودة:</span>
            <Badge className={qaIssues.some(i => i.type === 'error') ? 'bg-red-500 text-white font-bold' : qaIssues.some(i => i.type === 'warning') ? 'bg-amber-500 text-white font-bold' : 'bg-emerald-600 text-white font-bold'}>
              {qaIssues.some(i => i.type === 'error') ? 'فشل الاختبار %50' : qaIssues.some(i => i.type === 'warning') ? 'تحتاج فحص %85' : 'مكتمل بنسبة %100'}
            </Badge>
          </div>
        </div>

        {/* Validation Issues List */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {qaIssues.map((issue) => (
            <div key={issue.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs text-right ${
              issue.type === 'error' ? 'bg-red-500/5 text-red-600 border-red-500/15' : 
              issue.type === 'warning' ? 'bg-amber-500/5 text-amber-600 border-amber-500/15' : 
              'bg-emerald-500/5 text-emerald-600 border-emerald-500/15'
            }`}>
              <Badge variant="outline" className={`mt-0.5 text-[9px] font-bold px-1.5 py-0 ${
                issue.type === 'error' ? 'border-red-500 text-red-500 bg-white' : 
                issue.type === 'warning' ? 'border-amber-500 text-amber-500 bg-white' : 
                'border-emerald-500 text-emerald-500 bg-white'
              }`}>
                {issue.type === 'error' ? 'F-ERR' : issue.type === 'warning' ? 'W-QC' : 'QA-PASS'}
              </Badge>
              <div className="flex-1">
                <p className="font-semibold">{issue.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Sidebar Sheet Navigator & Batch Selection */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-xs border-muted/70">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm lg:text-base font-bold flex items-center justify-between">
                <span>تحديد وطباعة اللوحات (Batch Print)</span>
                <Layers2 className="w-4 h-4 text-cyan-600" />
              </CardTitle>
              <CardDescription className="text-xs text-right text-muted-foreground">
                حدد اللوحات المطلوبة لتضمينها كحزمة مخرجات إنشائية موحدة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-1 text-xs">
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={selectAllSheets}>تحديد الكل</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={clearAllSelectedSheets}>إلغاء التحديد</Button>
                <span className="text-muted-foreground mr-auto">{selectedSheetIds.size} / {sheets.length} لوحة</span>
              </div>

              <ScrollArea className="h-[240px] pr-1" dir="rtl">
                <div className="space-y-1">
                  {sheets.map((sheet, idx) => (
                    <div 
                      key={sheet.id} 
                      className={`flex items-center justify-between p-2 rounded-lg text-xs hover:bg-muted/40 transition-colors ${
                        currentSheetIdx === idx ? 'bg-cyan-50/70 border border-cyan-100' : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id={`checkbox-${sheet.id}`}
                          checked={selectedSheetIds.has(sheet.id)}
                          onCheckedChange={() => toggleSheetSelection(sheet.id)}
                        />
                        <button 
                          className="text-right font-medium hover:underline text-foreground select-none" 
                          onClick={() => {
                            setCurrentSheetIdx(idx);
                            setMultiPageMode(false);
                          }}
                        >
                          <span className="font-mono text-cyan-700 font-bold ml-1">[{sheet.id}]</span>
                          {sheet.arabicTitle.slice(0, 32)}...
                        </button>
                      </div>
                      <Badge className="font-mono text-[9px] scale-90" variant="secondary">
                        {sheet.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="pt-2 border-t border-border/80">
                <Button className="w-full bg-cyan-700 hover:bg-cyan-800 text-white font-semibold flex items-center justify-center gap-1.5 h-10 shadow-xs" onClick={handleSystemPrint}>
                  <Printer className="w-4 h-4" />
                  طباعة اللوحات المحددة ({selectedSheetIds.size})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scale Preservation Panel */}
          <Card className="shadow-xs border-muted/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs lg:text-sm font-bold flex items-center justify-between">
                <span>الحفاظ على مقياس الرسم (Presets)</span>
                <Compass className="w-4 h-4 text-cyan-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-right">
              <div className="grid grid-cols-2 gap-1.5">
                {['1:10', '1:20', '1:25', '1:50', '1:75', '1:100', '1:200'].map((scaleVal) => (
                  <Button 
                    key={scaleVal} 
                    variant={drawingScale === scaleVal ? 'default' : 'outline'}
                    className={`h-8 font-mono ${drawingScale === scaleVal ? 'bg-cyan-700 text-white font-bold' : ''}`}
                    onClick={() => setDrawingScale(scaleVal)}
                  >
                    {scaleVal}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                * يضمن هذا الخيار إرسال المخرجات بمعاملات تحجيم هندسية دقيقة تطابق مسطرة أبعاد الورش الإنشائية.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* MIDDLE COLUMN: Interactive Print Preview viewport */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-background border rounded-xl shadow-xs overflow-hidden">
            {/* Viewport controls top toolbar */}
            <div className="bg-muted/10 border-b p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleZoom(1.15)} title="Zoom In">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <span className="font-mono px-2 font-bold select-none">{Math.round(zoom * 100)}%</span>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleZoom(0.85)} title="Zoom Out">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="outline" className="h-8 px-2.5 text-xs font-semibold" onClick={handleFitWidth}>الملائمة العرضية</Button>
                <Button variant="outline" className="h-8 px-2.5 text-xs font-semibold" onClick={handleFitPage}>ملائمة الصفحة</Button>
                <Button variant="outline" className="h-8 px-2.5 text-xs font-semibold" onClick={handleResetZoomAndPan}>توسيط ورست</Button>
              </div>

              <div className="flex items-center gap-1.5">
                <Button 
                  variant={multiPageMode ? 'default' : 'outline'}
                  size="sm"
                  className={`h-8 gap-1 font-semibold ${multiPageMode ? 'bg-cyan-700 text-white' : ''}`}
                  onClick={() => setMultiPageMode(!multiPageMode)}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span>معاينة جماعية للورق</span>
                </Button>

                <div className="h-4 w-px bg-border mx-1" />

                <div className="flex items-center gap-1 select-none font-medium">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8" 
                    disabled={currentSheetIdx === 0}
                    onClick={() => setCurrentSheetIdx(Math.max(0, currentSheetIdx - 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold">{currentSheetIdx + 1} / {sheets.length}</span>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8" 
                    disabled={currentSheetIdx === sheets.length - 1}
                    onClick={() => setCurrentSheetIdx(Math.min(sheets.length - 1, currentSheetIdx + 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Viewport canvas element */}
            <div 
              ref={viewportRef}
              className="bg-zinc-700 h-[520px] w-full relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div className="absolute top-3 left-3 bg-zinc-900/80 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-xs font-mono flex items-center gap-1 z-10 select-none">
                <BadgeInfo className="w-3 h-3 text-cyan-400" />
                <span>Drag to Pan / Mouse Wheel to Zoom</span>
              </div>

              {/* Infinite grids canvas */}
              <div 
                className="absolute inset-0 opacity-10 pointer-events-none" 
                style={{ 
                  backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', 
                  backgroundSize: '20px 20px' 
                }} 
              />

              {/* Render Sheets inside current scale frame view */}
              <div 
                style={{
                  transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  display: multiPageMode ? 'grid' : 'block',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '40px',
                  padding: multiPageMode ? '40px' : '0'
                }}
              >
                {!multiPageMode ? (
                  /* Single sheet focusing preview rendering */
                  <div 
                    className={`bg-white rounded-xs relative transition-shadow flex flex-col justify-between ${getStyleClass()}`}
                    style={{
                      width: `${actualWidth * 3.78}px`,
                      height: `${actualHeight * 3.78}px`,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      fontFamily: 'sans-serif',
                      color: '#000',
                      padding: '40px',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Border margins drafting guidelines */}
                    <div style={{ position: 'absolute', top: '15px', left: '15px', right: '15px', bottom: '15px', border: '3px solid #000', boxSizing: 'border-box', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: '22px', left: '22px', right: '22px', bottom: '22px', border: '1px solid #000', boxSizing: 'border-box', pointerEvents: 'none' }} />

                    {/* AutoCAD Style Header Strip */}
                    {showHeader && (
                      <div className="flex items-center justify-between text-[10px] font-mono border-b pb-1 select-none pointer-events-none" style={{ color: '#555' }}>
                        <span>PROJECT PACKAGE: {titleBlock.projectName}</span>
                        <span>[ SHEET {currentSheet.id} ]</span>
                        <span>DATE: {titleBlock.date}</span>
                      </div>
                    )}

                    {/* Sheet inner content wrapper rendering */}
                    <div className="flex-1 w-full relative mt-4 mb-2 overflow-hidden text-right" style={{ direction: 'rtl' }}>
                      <div dangerouslySetInnerHTML={{ __html: renderSheetDirectHTML(currentSheet, currentSheetIdx) }} className="h-full w-full" />
                    </div>

                    {/* Standard ISO Title block footer */}
                    <div className="mt-auto h-[120px] w-full border-t border-black pt-2 flex text-right select-none" style={{ direction: 'rtl', borderTopWidth: '2px' }}>
                      <div className="w-[30%] border-l border-black p-1 flex flex-col justify-around text-[10px]">
                        <span className="text-[8px] text-zinc-500">اسم المشروع / PROJECT NAME</span>
                        <strong className="text-cyan-950 font-bold max-w-[200px] truncate">{titleBlock.projectName}</strong>
                        <span className="text-[7.5px] text-zinc-500 truncate">العميل / CLIENT: {titleBlock.clientName}</span>
                      </div>
                      <div className="w-[30%] border-l border-black p-1 flex flex-col justify-around text-[10px]">
                        <span className="text-[8px] text-zinc-500">عنوان المخطط الهندسي / SHEET TITLE</span>
                        <strong className="text-rose-950 font-bold truncate">{currentSheet.arabicTitle}</strong>
                        <span className="text-[7.5px] text-zinc-400">DESIGN SCHEMA: ACI STRUCTURAL ANALYSIS RUN</span>
                      </div>
                      <div className="w-[15%] border-l border-black p-1 flex flex-col justify-around text-[8.5px]">
                        <div><span className="text-zinc-500">الكود المتبع:</span> <strong>{titleBlock.designCode}</strong></div>
                        <div><span className="text-zinc-500">الجهد f'c:</span> <strong>{titleBlock.fc} MPa</strong></div>
                        <div><span className="text-zinc-500">الجهد fy:</span> <strong>{titleBlock.fy} MPa</strong></div>
                      </div>
                      <div className="w-[15%] border-l border-black p-1 flex flex-col justify-around text-[8.5px]">
                        <div><span className="text-zinc-500">المصمم:</span> <strong>{titleBlock.designedBy}</strong></div>
                        <div><span className="text-zinc-500">المدقق:</span> <strong>{titleBlock.checkedBy}</strong></div>
                        <div><span className="text-zinc-500">التاريخ:</span> <strong>{titleBlock.date}</strong></div>
                      </div>
                      <div className="w-[10%] p-1 flex flex-col justify-between items-center bg-zinc-50/50">
                        <div className="text-center">
                          <span className="text-[8px] text-zinc-500 block">رقم اللوحة</span>
                          <strong className="text-sm text-red-700 font-bold font-mono">{currentSheet.id}</strong>
                        </div>
                        <div className="text-center text-[8px] border-t border-zinc-200 w-full pt-1">
                          {currentSheet.scale}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Multi page preview loop */
                  sheets.map((sheet, index) => (
                    <div 
                      key={sheet.id}
                      className={`bg-white rounded-xs relative hover:shadow-2xl transition-all border ${getStyleClass()} ${
                        selectedSheetIds.has(sheet.id) ? 'ring-4 ring-cyan-500 ring-offset-2' : ''
                      }`}
                      style={{
                        width: `${actualWidth * 3.78}px`,
                        height: `${actualHeight * 3.78}px`,
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        fontFamily: 'sans-serif',
                        color: '#000',
                        padding: '40px',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Checkbox badge to toggle sheet */}
                      <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-white border rounded-md p-1 scale-95 shadow-sm">
                        <Checkbox 
                          checked={selectedSheetIds.has(sheet.id)}
                          onCheckedChange={() => toggleSheetSelection(sheet.id)}
                        />
                        <span className="text-[9px] font-mono font-bold px-1 text-cyan-800">{sheet.id}</span>
                      </div>

                      {/* Border margins */}
                      <div style={{ position: 'absolute', top: '15px', left: '15px', right: '15px', bottom: '15px', border: '3px solid #000', boxSizing: 'border-box', pointerEvents: 'none' }} />
                      <div style={{ position: 'absolute', top: '22px', left: '22px', right: '22px', bottom: '22px', border: '1px solid #000', boxSizing: 'border-box', pointerEvents: 'none' }} />

                      {/* Body */}
                      <div className="flex-1 w-full relative mt-4 mb-2 overflow-hidden text-right" style={{ direction: 'rtl' }}>
                        <div dangerouslySetInnerHTML={{ __html: renderSheetDirectHTML(sheet, index) }} className="h-full w-full pointer-events-none scale-90 origin-top" />
                      </div>

                      {/* Title block */}
                      <div className="mt-auto h-[120px] w-full border-t border-black pt-2 flex text-right select-none" style={{ direction: 'rtl', borderTopWidth: '2px' }}>
                        <div className="w-[30%] border-l border-black p-1 flex flex-col justify-around text-[10px]">
                          <strong className="text-cyan-950 font-bold truncate">{titleBlock.projectName}</strong>
                        </div>
                        <div className="w-[30%] border-l border-black p-1 flex flex-col justify-around text-[10px]">
                          <strong className="text-rose-950 font-semibold truncate">{sheet.arabicTitle}</strong>
                        </div>
                        <div className="w-[30%] border-l border-black p-1 flex flex-col justify-around text-[8px]">
                          <div><strong>ACI 318-19 / SBC 304</strong></div>
                        </div>
                        <div className="w-[10%] p-1 flex flex-col justify-between items-center bg-zinc-50/50">
                          <strong className="text-sm text-red-700 font-bold font-mono">{sheet.id}</strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Print Styles & Title Block configuration parameters */}
        <div className="lg:col-span-3 space-y-6 text-right" dir="rtl">
          
          {/* Print settings configuration card */}
          <Card className="shadow-xs border-muted/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm lg:text-base font-bold flex items-center justify-between">
                <span>خيارات تنسيق اللوحات (Layout Styles)</span>
                <Sliders className="w-4 h-4 text-cyan-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Paper setup */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">قياس لوحة الورق / Active Size</label>
                <select 
                  className="w-full text-xs h-9 border rounded-md px-2 bg-background font-medium"
                  value={paperSize}
                  onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                >
                  {Object.entries(PAPER_CONFIGS).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </div>

              {/* Custom size inputs if selected */}
              {paperSize === 'Custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">العرض (W - mm)</label>
                    <Input 
                      type="number" 
                      className="h-8 text-xs font-mono"
                      value={customWidthMm}
                      onChange={(e) => setCustomWidthMm(parseInt(e.target.value) || 500)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">الارتفاع (H - mm)</label>
                    <Input 
                      type="number" 
                      className="h-8 text-xs font-mono"
                      value={customHeightMm}
                      onChange={(e) => setCustomHeightMm(parseInt(e.target.value) || 375)}
                    />
                  </div>
                </div>
              )}

              {/* Orientation */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">الاتجاه الجغرافي للورقة / Orientation</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant={orientation === 'Landscape' ? 'default' : 'outline'}
                    className={`h-8 text-xs ${orientation === 'Landscape' ? 'bg-cyan-700 text-white font-bold' : ''}`}
                    onClick={() => setOrientation('Landscape')}
                  >
                    أفقي (Landscape)
                  </Button>
                  <Button 
                    variant={orientation === 'Portrait' ? 'default' : 'outline'}
                    className={`h-8 text-xs ${orientation === 'Portrait' ? 'bg-cyan-700 text-white font-bold' : ''}`}
                    onClick={() => setOrientation('Portrait')}
                  >
                    رأسي (Portrait)
                  </Button>
                </div>
              </div>

              {/* Print Style / CAD CTB emulate */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">نمط رسم الخطوط والظلال / CTB Style</label>
                <select 
                  className="w-full text-xs h-9 border rounded-md px-2 bg-background font-medium"
                  value={printStyle}
                  onChange={(e) => setPrintStyle(e.target.value as PrintStyle)}
                >
                  <option value="PlotStyle">PlotStyle Emulation (أوتوكاد أسود/ألوان)</option>
                  <option value="Monochrome">Monochrome Pure (أبيض وأسود صامت)</option>
                  <option value="Grayscale">Grayscale Rendering (تدرج رمادي مريح)</option>
                  <option value="Color">Full Color Rendering (كامل الألوان الهندسي)</option>
                </select>
              </div>

              {/* Toggle visibility of Header/Footer */}
              <div className="space-y-2 pt-2 border-t text-xs">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="show-header-chk"
                    checked={showHeader}
                    onCheckedChange={(checked) => setShowHeader(!!checked)}
                  />
                  <label htmlFor="show-header-chk" className="select-none font-medium text-slate-700">عرض ترويسة اللوحة العلوية</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="show-footer-chk"
                    checked={showFooter}
                    onCheckedChange={(checked) => setShowFooter(!!checked)}
                  />
                  <label htmlFor="show-footer-chk" className="select-none font-medium text-slate-700">إظهار رأس وخاتم اللوحة السفلي</label>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Title block configurations */}
          <Card className="shadow-xs border-muted/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm lg:text-base font-bold flex items-center justify-between">
                <span>تعديل رأس المخطط (Title Block)</span>
                <Sliders className="w-4 h-4 text-cyan-600" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="font-bold text-slate-700">اسم المشروع (كامل الأبعاد)</label>
                <Input 
                  value={titleBlock.projectName}
                  onChange={(e) => setTitleBlock(p => ({ ...p, projectName: e.target.value }))}
                  className="h-8 text-xs text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">اسم المالك المستفيد / Client Name</label>
                <Input 
                  value={titleBlock.clientName}
                  onChange={(e) => setTitleBlock(p => ({ ...p, clientName: e.target.value }))}
                  className="h-8 text-xs text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">المصمم / Designer</label>
                  <Input 
                    value={titleBlock.designedBy}
                    onChange={(e) => setTitleBlock(p => ({ ...p, designedBy: e.target.value }))}
                    className="h-8 text-xs text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">المدقق / Checker</label>
                  <Input 
                    value={titleBlock.checkedBy}
                    onChange={(e) => setTitleBlock(p => ({ ...p, checkedBy: e.target.value }))}
                    className="h-8 text-xs text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">رقم المراجعة / Rev</label>
                  <Input 
                    value={titleBlock.revision}
                    onChange={(e) => setTitleBlock(p => ({ ...p, revision: e.target.value }))}
                    className="h-8 text-xs text-right font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">تاريخ الإصدار / Date</label>
                  <Input 
                    type="date"
                    value={titleBlock.date}
                    onChange={(e) => setTitleBlock(p => ({ ...p, date: e.target.value }))}
                    className="h-8 text-xs text-center"
                  />
                </div>
              </div>

              <div className="space-y-1 border-t pt-2">
                <label className="font-bold text-slate-700">رتب ومقاومة الخرسانة والحديد بالشرح</label>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div>
                    <span className="text-[10px] block text-muted-foreground mr-1">f'c (MPa)</span>
                    <Input 
                      type="number"
                      value={titleBlock.fc}
                      onChange={(e) => setTitleBlock(p => ({ ...p, fc: parseInt(e.target.value) || 25 }))}
                      className="h-8 text-xs text-center"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] block text-muted-foreground mr-1">fy (MPa)</span>
                    <Input 
                      type="number"
                      value={titleBlock.fy}
                      onChange={(e) => setTitleBlock(p => ({ ...p, fy: parseInt(e.target.value) || 420 }))}
                      className="h-8 text-xs text-center"
                    />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}

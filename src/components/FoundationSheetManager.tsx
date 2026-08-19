import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  FileText, Download, Printer, Settings, Layers, Calendar, User, CheckCircle2, 
  RefreshCw, Plus, Trash2, Eye, EyeOff, MoveUp, MoveDown, Info, Sliders, Layout, ShieldCheck, 
  Building, Copy, CheckCircle, FileCode, Hammer, Landmark, AlignLeft, Scale
} from 'lucide-react';

interface Revision {
  rev: string; // e.g. "Rev 0"
  date: string;
  description: string;
  by: string;
}

interface Sheet {
  id: string;
  number: string;
  title: string;
  arTitle: string;
  scale: string;
  size: string;
  visible: boolean;
  contentDesc: string;
}

interface FoundationSheetManagerProps {
  projectName: string;
  isolatedFootings?: any[];
  stripFootings?: any[];
  scheduleItems?: any[];
  stripScheduleItems?: any[];
  bbsItemsList?: any[];
  takeoffMetrics?: any;
}

export default function FoundationSheetManager({
  projectName: initialProjectName,
  isolatedFootings = [],
  stripFootings = [],
  scheduleItems = [],
  stripScheduleItems = [],
  bbsItemsList = [],
  takeoffMetrics,
}: FoundationSheetManagerProps) {

  // --- GENERAL TITLE BLOCK STATE ---
  const [projectName, setProjectName] = useState(initialProjectName || 'Structural Design Studio');
  const [client, setClient] = useState('وزارة الشؤون البلدية والقروية والإسكان / Private Owner Client');
  const [consultant, setConsultant] = useState('المكتب الهندسي للاستشارات العمرانية / Arab Consulting Engineers');
  const [drawnBy, setDrawnBy] = useState('ENG. DETAILED SURVEYOR');
  const [checkedBy, setCheckedBy] = useState('ENG. STRUCTURAL SPECIALIST');
  const [approvedBy, setApprovedBy] = useState('DR. PRINCIPAL CONSULTANT');
  const [issueDate, setIssueDate] = useState('2026-06-10');
  const [customPrefix, setCustomPrefix] = useState('F'); // Default prefix for sheet numbers like F-001
  const [selectedSheetSize, setSelectedSheetSize] = useState<'A4' | 'A3' | 'A2' | 'A1' | 'A0'>('A3');

  // --- ACTIVE SELECTED PREVIEW SHEET ---
  const [activeSheetId, setActiveSheetId] = useState<string>('cover');

  // --- REVISION MANAGER HISTORY ---
  const [revisions, setRevisions] = useState<Revision[]>([
    { rev: 'Rev 0', date: '2026-06-10', description: 'Initial Issue for Construction', by: 'QS' },
    { rev: 'Rev 1', date: '2026-06-15', description: 'Foundation Revision based on Soil Report', by: 'ENG' },
    { rev: 'Rev 2', date: '2026-06-20', description: 'Reinforcement diameter adjustments', by: 'SPEC' }
  ]);

  const [newRevName, setNewRevName] = useState('Rev 3');
  const [newRevDesc, setNewRevDesc] = useState('Tender revision issue');
  const [newRevDate, setNewRevDate] = useState('2026-06-25');

  const addRevision = () => {
    if (!newRevName.trim()) return;
    setRevisions(prev => [
      ...prev,
      { rev: newRevName, date: newRevDate, description: newRevDesc, by: 'QS' }
    ]);
    setNewRevName(`Rev ${revisions.length + 1}`);
    setNewRevDesc('');
  };

  const removeRevision = (index: number) => {
    setRevisions(prev => prev.filter((_, i) => i !== index));
  };


  // --- DYNAMIC SHEETS LIST WITH DEFAULT REORDERABLE DATA ---
  const [sheets, setSheets] = useState<Sheet[]>([
    { id: 'cover', number: 'F-001', title: 'COVER SHEET', arTitle: 'غلاف حزمة الرسومات الهندسية للمشروع', scale: 'NTS', size: 'A3', visible: true, contentDesc: 'Project general cover parameters, list of deliverables, and master metadata.' },
    { id: 'index', number: 'F-002', title: 'DRAWING INDEX', arTitle: 'فهرس اللوحات التفصيلي وحالة المراجعات', scale: 'NTS', size: 'A3', visible: true, contentDesc: 'Index of active records, revision log of drawings, issue statuses.' },
    { id: 'notes', number: 'F-003', title: 'GENERAL NOTES & SPECIFICATIONS', arTitle: 'الاشتراطات والملاحظات الإنشائية العامة للبناء', scale: 'NTS', size: 'A3', visible: true, contentDesc: 'Design standards, concrete strength, cover specs, and soil bearing ratios.' },
    { id: 'layout', number: 'F-004', title: 'FOUNDATION LAYOUT PLAN', arTitle: 'مخطط لوحة توزيع المحاور والأساسات والرقاب', scale: '1:50', size: 'A3', visible: true, contentDesc: 'Overall dimensions of isolated footings, strip schedules on gridlines.' },
    { id: 'schedule', number: 'F-005', title: 'FOUNDATION SCHEDULE', arTitle: 'لوحة جدول نماذج القواعد المعتمد للتسليح والأبعاد', scale: 'NTS', size: 'A3', visible: true, contentDesc: 'Table detailing dimension B, L, H for F1 through F10 types with rebar specs.' },
    { id: 'isolated_det', number: 'F-006', title: 'ISOLATED FOOTING DETAILS', arTitle: 'لوحة تفاصيل تسليح وقطاعات القواعد المنفصلة', scale: '1:20', size: 'A3', visible: true, contentDesc: 'Sections, hooks, column starter dowels and concrete spacer distribution details.' },
    { id: 'strip_det', number: 'F-007', title: 'STRIP FOOTING DETAILS', arTitle: 'تفاصيل مساقط وقطاعات طوبار و حديد الشدادات والجدران', scale: '1:25', size: 'A3', visible: true, contentDesc: 'L-bars overlap, closed stirrups, splice lengths, continuous reinforcement.' },
    { id: 'bbs', number: 'F-008', title: 'BAR BENDING SCHEDULE (BBS)', arTitle: 'كشف جداول تفريد وقص ووزن حديد التسليح الفعلي', scale: 'NTS', size: 'A3', visible: true, contentDesc: 'Detailed table splitting rebar weights, cut lengths per diameter.' },
    { id: 'boq', number: 'F-009', title: 'BILL OF QUANTITIES (BOQ)', arTitle: 'مذكرة جدول حصر بنود المواد وتقدير تكلفتها المعتمدة', scale: 'NTS', size: 'A3', visible: true, contentDesc: 'Material volume takeoff (m³), formwork area (m²), steel weight tonnage, and financial estimates.' },
    { id: 'future_types', number: 'F-010', title: 'FUTURE COMBINED & RAFT SPECIFICATIONS', arTitle: 'ملحق مواصفات اللبش الخرسانية والقواعد المشتركة', scale: '1:100', size: 'A3', visible: true, contentDesc: 'Planning blueprints for high load combined mats, raft systems, pile-cap grids.' }
  ]);

  // Adjust sheet numbers automatically when custom prefix or reordering happens
  const orderedAndNumberedSheets = useMemo(() => {
    let visibleIndex = 1;
    return sheets.map((sheet, index) => {
      if (!sheet.visible) {
        return { ...sheet, number: 'EXCLUDED' };
      }
      const numStr = String(visibleIndex).padStart(3, '0');
      visibleIndex++;
      return {
        ...sheet,
        number: `${customPrefix}-${numStr}`,
        size: selectedSheetSize
      };
    });
  }, [sheets, customPrefix, selectedSheetSize]);

  // --- REORDER AND HIDE ACTIONS ---
  const moveSheet = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sheets.length - 1) return;
    
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newList = [...sheets];
    const temp = newList[index];
    newList[index] = newList[targetIdx];
    newList[targetIdx] = temp;
    setSheets(newList);
  };

  const toggleSheetVisibility = (id: string) => {
    setSheets(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, visible: !s.visible };
      }
      return s;
    }));
  };

  const updateSheetTitle = (id: string, newTitle: string) => {
    setSheets(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, title: newTitle.toUpperCase() };
      }
      return s;
    }));
  };

  // --- AUTO SCALE SELECTOR based on standard practice ---
  const autoSelectScale = (id: string, size: string): string => {
    if (id === 'layout') return size === 'A1' || size === 'A0' ? '1:50' : '1:100';
    if (id === 'isolated_det') return '1:20';
    if (id === 'strip_det') return '1:25';
    if (id === 'future_types') return '1:100';
    return 'NTS'; // Not to scale
  };

  // --- GENERAL NOTES CONTENT ---
  const generalNotesList = [
    "1. All structural concrete works shall comply with SBC 304 and ACI-318 structural design code guidelines.",
    "2. Concrete Grade: Compressive strength fc' for reinforced foundations shall not be less than 35 MPa (C35) after 28 days.",
    "3. Blinding Concrete: C20 MPa plain concrete blinding with min thickness of 100 mm and 100 mm offset all around.",
    "4. Reinforcement: High yield deformed steel bars Grade 60 conforming to ASTM A615 (fy = 420 MPa).",
    "5. Concrete Cover: Clear cover to main reinforcement in contact with soil/ground must be 75 mm minimum.",
    "6. Net Soil Bearing Capacity: Max allowable pressure is assumed 150 kN/m² in accordance with actual geotechnical logs.",
    "7. Development Splices (Ld): Column dowels overlap inside footings shall be at least 1.3 times the tension development length.",
    "8. Excavation Space: Maintain clear working space offset of 300 mm minimum on all sides for modular formwork placement.",
    "9. Backfill Specifications: Excavation backfill shall be done using well-graded non-cohesive soil on layers of 250 mm compacted to 95% Modified Proctor."
  ];

  // --- PDF DRAWING PACKAGE BATCH EXPORT ---
  const handleGeneratePDFPackage = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: selectedSheetSize.toLowerCase() as any
    });

    const activeVisibleSheets = orderedAndNumberedSheets.filter(s => s.visible);
    const lastRev = revisions[revisions.length - 1] || { rev: 'Rev 0', date: '2026-06-10' };

    activeVisibleSheets.forEach((sheet, pageIdx) => {
      if (pageIdx > 0) {
        doc.addPage();
      }

      const pgW = doc.internal.pageSize.getWidth();
      const pgH = doc.internal.pageSize.getHeight();

      // Draw Professional Page Border Outline
      doc.setDrawColor(20, 30, 80);
      doc.setLineWidth(1.0);
      doc.rect(5, 5, pgW - 10, pgH - 10);
      doc.setLineWidth(0.3);
      doc.rect(6, 6, pgW - 12, pgH - 12);

      // Draw Side/Bottom Title block (Right column border for engineering diagrams)
      const tbW = 90;
      const tbH = pgH - 12;
      const tbX = pgW - 6 - tbW;
      const tbY = 6;

      doc.setDrawColor(20, 30, 80);
      doc.line(tbX, tbY, tbX, tbY + tbH); // separator line

      // Title block items drawing
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text("ENGINEERING DRAWING SHEET", tbX + 5, tbY + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text("CLIENT LOGO / SPECIFICATION ARCHITECT", tbX + 5, tbY + 13);
      doc.line(tbX, tbY + 16, tbX + tbW, tbY + 16);

      // Project info
      doc.setFont('helvetica', 'bold');
      doc.text("PROJECT NAME:", tbX + 5, tbY + 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(projectName, tbX + 5, tbY + 26);
      doc.line(tbX, tbY + 30, tbX + tbW, tbY + 30);

      // Client / Consultant
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text("CONSULTING ENGINEERS:", tbX + 5, tbY + 35);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(consultant, tbX + 5, tbY + 39);
      doc.line(tbX, tbY + 43, tbX + tbW, tbY + 43);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text("DEVELOPER CLIENT:", tbX + 5, tbY + 48);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(client, tbX + 5, tbY + 52);
      doc.line(tbX, tbY + 56, tbX + tbW, tbY + 56);

      // Design Approval Initials
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text("DESIGNED BY:", tbX + 5, tbY + 62);
      doc.setFont('helvetica', 'normal');
      doc.text(drawnBy, tbX + 35, tbY + 62);

      doc.setFont('helvetica', 'bold');
      doc.text("CHECKED BY:", tbX + 5, tbY + 67);
      doc.setFont('helvetica', 'normal');
      doc.text(checkedBy, tbX + 35, tbY + 67);

      doc.setFont('helvetica', 'bold');
      doc.text("APPROVED BY:", tbX + 5, tbY + 72);
      doc.setFont('helvetica', 'normal');
      doc.text(approvedBy, tbX + 35, tbY + 72);
      doc.line(tbX, tbY + 76, tbX + tbW, tbY + 76);

      // Revisions summary block inside title block
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text("REVISIONS LOG HISTORY", tbX + 5, tbY + 82);
      let revY = tbY + 87;
      revisions.slice(-3).forEach(r => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${r.rev}: ${r.description.substring(0, 30)}`, tbX + 5, revY);
        doc.text(r.date, tbX + 70, revY);
        revY += 4.5;
      });
      doc.line(tbX, tbY + 104, tbX + tbW, tbY + 104);

      // Scale, sheet number, date
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text("SHEET SIZE: " + sheet.size, tbX + 5, tbY + 110);
      doc.text("SCALE: " + autoSelectScale(sheet.id, sheet.size), tbX + 5, tbY + 116);
      doc.text("DATE: " + issueDate, tbX + 5, tbY + 122);
      doc.text("REVISION: " + lastRev.rev, tbX + 5, tbY + 128);
      doc.line(tbX, tbY + 132, tbX + tbW, tbY + 132);

      // Drawing title & big stamp sheet number
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(sheet.title, tbX + 5, tbY + 140);
      doc.setFontSize(7.5);
      doc.text(sheet.arTitle, tbX + 5, tbY + 144);
      
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(sheet.number, tbX + tbW - 35, tbY + 158);
      doc.setFontSize(7);
      doc.text(`SHEET ${pageIdx + 1} OF ${activeVisibleSheets.length}`, tbX + tbW - 35, tbY + 162);


      // --- INTRO LEVEL CONTENT WRITING DEPENDING ON SHEET TYPE ---
      const activeContentW = tbX - 12; // area width left for content
      doc.setFont('helvetica', 'bold');
      
      if (sheet.id === 'cover') {
        doc.setFontSize(18);
        doc.text("FOUNDATION ENGINEERING", 15, 45);
        doc.text("CONSTRUCTION DOCUMENTATION PACKAGE", 15, 54);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Project Location Reference Name: ${projectName}`, 15, 65);
        doc.text(`Client Authority: ${client}`, 15, 71);
        doc.text(`Quality Control Protocol Reference: APPROVED FOR EXECUTION`, 15, 77);
        doc.text(`Total Drawings Compiled: ${activeVisibleSheets.length} Sheets`, 15, 83);
        
        // Large decorative architectural guidelines box
        doc.setDrawColor(200, 200, 200);
        doc.rect(15, 95, activeContentW - 15, 60);
        doc.text("PROJECT PACKAGE METADATA", 20, 102);
        doc.text(`- Delivery Status: TENDER ISSUE PROTOCOL`, 20, 110);
        doc.text(`- Last Audit Date: ${issueDate}`, 20, 116);
        doc.text(`- Complies with Saudi Building Code Guidelines (SBC 301/304)`, 20, 122);
        doc.text(`- Design Specifications: Grade 60 Rebars & Ultimate Limit State design`, 20, 128);
      }

      else if (sheet.id === 'index') {
        doc.setFontSize(13);
        doc.text("OFFICIAL PROJECT DRAWING LISTING DIRECTORY", 15, 20);
        doc.setFontSize(8.5);
        
        // Let's draw drawing directory table
        const indexHeaders = [["Sheet No.", "Drawing Level Title", "Arabic Specification Title", "Standard Scale"]];
        const indexData = activeVisibleSheets.map(s => [s.number, s.title, s.arTitle, autoSelectScale(s.id, s.size)]);
        
        (doc as any).autoTable({
          startY: 28,
          head: indexHeaders,
          body: indexData,
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 7, halign: 'left' },
          headStyles: { fillColor: [20, 30, 80], textColor: [255, 255, 255] },
          margin: { left: 15, right: tbW + 10 },
          tableWidth: activeContentW - 15
        });
      }

      else if (sheet.id === 'notes') {
        doc.setFontSize(13);
        doc.text("GENERAL SPECIFICATIONS & DESIGN REQUIREMENTS", 15, 20);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let noteY = 30;
        generalNotesList.forEach(note => {
          doc.text(note, 15, noteY);
          noteY += 9;
        });
      }

      else if (sheet.id === 'layout') {
        doc.setFontSize(13);
        doc.text("FOUNDATION SYSTEM & MUNICIPAL GRID COORDINATES", 15, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text("The drawing below highlights coordinates spacing offsets mapped according to municipal survey benchmarks.", 15, 25);
        
        // draw a schematic beautiful cad boundary box representing gridlines
        doc.setDrawColor(180, 180, 190);
        doc.rect(20, 35, activeContentW - 30, 120);
        
        // dashed gridlines
        doc.setLineDashPattern([2, 2], 0);
        doc.line(45, 35, 45, 155);
        doc.line(85, 35, 85, 155);
        doc.line(125, 35, 125, 155);
        
        doc.line(20, 65, activeContentW - 10, 65);
        doc.line(20, 105, activeContentW - 10, 105);
        
        // markers
        doc.setLineDashPattern([], 0);
        doc.setFontSize(8);
        doc.text("AXIS A", 42, 33);
        doc.text("AXIS B", 82, 33);
        doc.text("AXIS C", 122, 33);
        
        doc.text("GRID 1", activeContentW - 8, 66);
        doc.text("GRID 2", activeContentW - 8, 106);

        // Draw some little foundation shapes with F1, F2 tags
        doc.setDrawColor(20, 30, 100);
        doc.rect(40, 60, 12, 10);
        doc.text("F1", 44, 66);

        doc.rect(80, 100, 14, 12);
        doc.text("F2", 84, 107);
      }

      else if (sheet.id === 'schedule') {
        doc.setFontSize(13);
        doc.text("FOUNDATION QUANTITY SCHEDULE SUMMARY", 15, 20);
        
        // Isolated and strip schedule lists formatting
        const schedHeaders = [["Mark", "Width B (mm)", "Length L (mm)", "Depth H (mm)", "SBC (kPa)", "Concrete Code"]];
        const schedData = scheduleItems.map(s => [s.typeMark, s.B, s.L, s.H, "150 kPa", "C35 Resistant"]);
        
        (doc as any).autoTable({
          startY: 28,
          head: schedHeaders,
          body: schedData,
          theme: 'striped',
          styles: { font: 'helvetica', fontSize: 8 },
          headStyles: { fillColor: [40, 50, 100] },
          margin: { left: 15, right: tbW + 10 },
          tableWidth: activeContentW - 15
        });
      }

      else if (sheet.id === 'isolated_det') {
        doc.setFontSize(12);
        doc.text("TYPICAL ISOLATED FOOTING SCHEMATIC DETAILED SECTION", 15, 20);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text("This detail highlights critical tension splices and bottom steel mesh distribution rules mapped by standard code.", 15, 25);
        
        // draw typical foundation elevation line diagram
        doc.setDrawColor(100, 100, 100);
        doc.line(25, 110, 125, 110); // ground
        
        doc.rect(40, 115, 70, 25); // footing
        doc.text("Isolated Footing", 42, 130);
        
        doc.rect(68, 55, 14, 60); // column pedestal
        doc.text("Pedestal Dowels", 84, 85);
      }

      else if (sheet.id === 'strip_det') {
        doc.setFontSize(12);
        doc.text("TYPICAL STRIP FOUNDATION FLEXURE SECTION DETAIL", 15, 20);
        doc.setFontSize(8);
        doc.text("Continuous strap footing dowels splice and hook reinforcement patterns.", 15, 25);

        // draw continuous strip mockup
        doc.setDrawColor(120, 120, 120);
        doc.rect(20, 105, 110, 20);
        doc.text("Continuous Reinforcement Mesh (T&B)", 30, 115);
      }

      else if (sheet.id === 'bbs') {
        doc.setFontSize(12);
        doc.text("BAR BENDING SCHEDULE DIRECTORY", 15, 20);
        
        if (bbsItemsList && bbsItemsList.length > 0) {
          const bbsHeaders = [["Type", "Bar Mark", "Dia", "Spacing", "Shape Code", "Total Weight"]];
          const bbsData = bbsItemsList.slice(0, 10).map(b => [b.typeMark, b.barMark, `${b.diameter}mm`, b.spacing, "Shape 37", `${b.totalWeight.toFixed(1)} kg`]);
          
          (doc as any).autoTable({
            startY: 26,
            head: bbsHeaders,
            body: bbsData,
            theme: 'grid',
            styles: { fontSize: 7 },
            margin: { left: 15, right: tbW + 10 },
            tableWidth: activeContentW - 15
          });
        } else {
          doc.text("Standard default rebar density schedule (Estimated average ~ 110 kg/m³ for all active foundation volumes).", 15, 30);
        }
      }

      else if (sheet.id === 'boq') {
        doc.setFontSize(12);
        doc.text("BILL OF QUANTITIES OVERALL RECAP", 15, 20);
        
        const boqHeaders = [["Item", "Description", "Unit", "Qty", "Total Estimate"]];
        const boqData = [
          ["1.0", "Mechanical Site Excavations & back transport", "m³", takeoffMetrics?.excavation?.toFixed(1) || "120.0", "SAR 4,800"],
          ["2.0", "Plain C20 Bedding Concrete blindings", "m³", (takeoffMetrics?.concrete * 0.15).toFixed(1) || "18.5", "SAR 8,300"],
          ["3.0", "High Strength Grade 35 Reinforced Concrete", "m³", takeoffMetrics?.concrete?.toFixed(1) || "46.2", "SAR 23,100"],
          ["4.0", "Deformed Structural Steel Dowels Grade 60", "kg", takeoffMetrics?.steel?.toFixed(0) || "5,100", "SAR 22,950"]
        ];

        (doc as any).autoTable({
          startY: 26,
          head: boqHeaders,
          body: boqData,
          theme: 'striped',
          styles: { fontSize: 8 },
          margin: { left: 15, right: tbW + 10 },
          tableWidth: activeContentW - 15
        });
      }

      else {
        doc.setFontSize(12);
        doc.text("FUTURE COMBINED AND RAFT SPECIFICATION MANUAL", 15, 20);
        doc.setFontSize(8);
        doc.text("This supplemental guide outlines the foundational parameters needed when scaling code to Combined Mat foundations.", 15, 28);
      }
    });

    doc.save(`Complete_Foundation_Drawing_Package_${projectName.replace(/\s/g, '_')}.pdf`);
  };


  return (
    <div className="space-y-6">
      
      {/* SECTION HEADER CONTROL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 gap-4">
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layout className="h-4 w-4 text-indigo-600" />
            منظومة إدارة وحوكمة لوحات مخططات التأسيس / Drawing Sheet Manager & CAD Publisher 🗓️
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            تفريغ وبناء مخططات معتمدة متوافقة مع متطلبات المكاتب الاستشارية والمجالس البلدية للترخيص وإجراءات توريد حديد صب الأساسات.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="default" className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 h-8 font-bold" onClick={handleGeneratePDFPackage}>
            <Printer className="h-3 w-3" /> تصدير دفتر اللوحات الكامل (Multi-Page PDF)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* LEFT SHEET SETTINGS LOG & REVISIONS CONTROL PANEL */}
        <div className="xl:col-span-1 space-y-5">
          
          {/* TITLE BLOCK CUSTOMIZATION CARD */}
          <Card className="border border-slate-200/90 shadow-xs">
            <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
              <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5 text-indigo-500" />
                معلومات خرطوشة اللوحات الرسمية / CAD Title Block Specs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 text-xs space-y-2.5">
              <div>
                <Label className="text-[9.5px]">رمز الترقيم والتسلسل (Prefix)</Label>
                <Input value={customPrefix} onChange={e => setCustomPrefix(e.target.value.toUpperCase())} className="h-7 text-xs font-mono mt-0.5" />
              </div>
              <div>
                <Label className="text-[9.5px]">طبيعة حجم ومقاس اللوحة (Sheet Size)</Label>
                <select value={selectedSheetSize} onChange={e => setSelectedSheetSize(e.target.value as any)} className="w-full h-7 border rounded mt-0.5 text-xs bg-background p-1">
                  <option value="A3">A3 Office Standard - Scale Ideal</option>
                  <option value="A4">A4 Binder Portability Format</option>
                  <option value="A2">A2 Large Scale Details</option>
                  <option value="A1">A1 Blueprint Professional Size</option>
                  <option value="A0">A0 Full Size Site Shutter Layout</option>
                </select>
              </div>
              
              <div className="border-t pt-2 space-y-2">
                <div>
                  <Label className="text-[9px]">العميل المالك (Client)</Label>
                  <Input value={client} onChange={e => setClient(e.target.value)} className="h-7 text-xs mt-0.5" />
                </div>
                <div>
                  <Label className="text-[9px]">المكتب الاستشاري المصمم (Consultant)</Label>
                  <Input value={consultant} onChange={e => setConsultant(e.target.value)} className="h-7 text-xs mt-0.5" />
                </div>
                <div>
                  <Label className="text-[9px]">الدراسة والتعديل بواسطة (Drawn)</Label>
                  <Input value={drawnBy} onChange={e => setDrawnBy(e.target.value)} className="h-7 text-xs mt-0.5" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* REVISION CONTROL CARD */}
          <Card className="border border-slate-200/90 shadow-xs">
            <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b">
              <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                المراجعات والإصدارات التاريخية / Revision Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 text-xs space-y-3">
              <div className="space-y-1.5 max-h-32 overflow-y-auto border rounded p-1.5 bg-slate-50 dark:bg-slate-900">
                {revisions.map((rev, index) => (
                  <div key={index} className="flex justify-between items-center text-[10px] bg-white dark:bg-slate-950 p-1 rounded border">
                    <div>
                      <strong className="text-indigo-600 font-mono block">{rev.rev} ({rev.date})</strong>
                      <span className="text-muted-foreground text-[9px]">{rev.description}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="h-4 w-4 text-red-500" onClick={() => removeRevision(index)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <div className="space-y-1.5 border-t pt-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <Label className="text-[9px]">أيقونة الإصدار</Label>
                    <Input value={newRevName} onChange={e=>setNewRevName(e.target.value)} className="h-7 text-[10px]" />
                  </div>
                  <div>
                    <Label className="text-[9px]">التاريخ</Label>
                    <Input type="date" value={newRevDate} onChange={e=>setNewRevDate(e.target.value)} className="h-7 text-[10px]" />
                  </div>
                </div>
                <div>
                  <Label className="text-[9px]">وصف المراجعة</Label>
                  <Input value={newRevDesc} onChange={e=>setNewRevDesc(e.target.value)} placeholder="مثال: تعديل التسليح" className="h-7 text-[10px]" />
                </div>
                <Button size="sm" variant="outline" className="w-full text-[10px] h-7" onClick={addRevision}>
                  <Plus className="h-3 w-3 mr-1" /> إضافة مراجعة جديدة
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MIDDLE ACTIVE SHEETS REORDER AND METADATA MANAGER PANEL */}
        <div className="xl:col-span-2 space-y-5">
          <Card className="border border-slate-200">
            <CardHeader className="py-2.5 bg-slate-50 dark:bg-slate-900 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-200">
                دليل ترتيب وسلسلة لوحات المخططات / Master Compilation Array
              </CardTitle>
              <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 text-[9px] font-mono">
                {orderedAndNumberedSheets.filter(s => s.visible).length} لوحات نشطة
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs border-0">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="py-2.5 text-center w-10">الحالة</TableHead>
                    <TableHead className="py-2.5 w-20">رقم اللوحة</TableHead>
                    <TableHead className="py-2.5">عنوان اللوحة</TableHead>
                    <TableHead className="py-2.5 text-center w-14">الحجم</TableHead>
                    <TableHead className="py-2.5 text-center w-14">المقياس</TableHead>
                    <TableHead className="py-2.5 text-center w-14">ترتيب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedAndNumberedSheets.map((sheet, idx) => (
                    <TableRow 
                      key={sheet.id} 
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/10 cursor-pointer ${activeSheetId === sheet.id ? 'bg-indigo-50/30 dark:bg-indigo-950/20 font-bold border-r-2 border-indigo-600' : ''}`}
                      onClick={() => setActiveSheetId(sheet.id)}
                    >
                      <TableCell className="text-center py-2 shrink-0">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSheetVisibility(sheet.id);
                          }}
                        >
                          {sheet.visible ? (
                            <Eye className="h-3.5 w-3.5 text-indigo-600" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-slate-900 dark:text-slate-200">
                        {sheet.visible ? sheet.number : <span className="text-red-500 font-sans text-[10px]">مستبعد</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-right">
                          <input 
                            type="text" 
                            value={sheet.title} 
                            onChange={(e) => updateSheetTitle(sheet.id, e.target.value)} 
                            className="bg-transparent border-none text-[11px] font-bold text-slate-800 dark:text-slate-100 p-0 focus:ring-0 focus:outline-hidden"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-[9px] text-muted-foreground font-mono">{sheet.arTitle}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-[10px]">{sheet.size}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[9px] font-mono py-0 text-slate-600">{autoSelectScale(sheet.id, sheet.size)}</Badge>
                      </TableCell>
                      <TableCell className="text-center h-full">
                        <div className="flex gap-0.5 justify-center" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveSheet(idx, 'up')} disabled={idx === 0}>
                            <MoveUp className="h-2.5 w-2.5 text-slate-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveSheet(idx, 'down')} disabled={idx === sheets.length - 1}>
                            <MoveDown className="h-2.5 w-2.5 text-slate-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PREVIEW SCREEN AND BLUEPRINT SIMULATION STENCIL */}
        <div className="xl:col-span-1 space-y-4">
          <Card className="border border-indigo-100 bg-slate-950 text-white shadow-lg overflow-hidden relative min-h-60">
            <div className="absolute top-2 left-2 bg-indigo-900 border border-indigo-500 px-2 py-0.5 rounded text-[8px] tracking-wide uppercase font-bold text-indigo-200">
              {orderedAndNumberedSheets.find(s => s.id === activeSheetId)?.number || 'F-001'} Blueprint
            </div>

            <CardHeader className="py-2.5 bg-slate-900 border-b border-indigo-950">
              <CardTitle className="text-[10.5px] font-bold text-indigo-400">
                لوحة المعاينة التفاعلية والمخطط الأزرق الفني / Real-Time CAD Layout Simulator 🗺️
              </CardTitle>
            </CardHeader>
            
            <CardContent className="p-3 text-[10.5px] space-y-3.5 font-sans leading-relaxed text-slate-300">
              {/* Cover layout simulator */}
              {activeSheetId === 'cover' && (
                <div className="border border-dashed border-indigo-800 p-3 rounded bg-slate-900/50 space-y-2 text-center">
                  <Building className="h-8 w-8 mx-auto text-indigo-500" />
                  <h4 className="font-bold text-white text-xs">{projectName}</h4>
                  <span className="text-[8.5px] text-indigo-300 block">FOUNDATION CONCRETE DRAWING SET</span>
                  <div className="border-t border-indigo-950 pt-2 text-[9px] text-right space-y-1">
                    <div className="flex justify-between"><span>تاريخ الاعتماد:</span> <strong className="text-white">{issueDate}</strong></div>
                    <div className="flex justify-between"><span>النسخة الحالية:</span> <strong className="text-white">Rev {revisions.length - 1}</strong></div>
                    <div className="flex justify-between"><span>عدد اللوحات:</span> <strong className="text-white">{orderedAndNumberedSheets.filter(s => s.visible).length} LOADS</strong></div>
                  </div>
                </div>
              )}

              {/* Notes layout preview */}
              {activeSheetId === 'notes' && (
                <div className="p-1 space-y-2">
                  <span className="font-black text-indigo-400 text-xs flex items-center gap-1">
                    <AlignLeft className="h-3 w-3" /> GENERAL STRUCTURAL NOTES:
                  </span>
                  <div className="space-y-1.5 text-[9.5px] border-r-2 border-indigo-900 pr-2">
                    {generalNotesList.slice(0, 4).map((note, index) => (
                      <p key={index} className="text-slate-400 text-right leading-tight">{note}</p>
                    ))}
                    <span className="text-[8.5px] text-indigo-400 block font-mono">And other 5 key structural guidelines...</span>
                  </div>
                </div>
              )}

              {/* Layout plan visual drawing preview */}
              {activeSheetId === 'layout' && (
                <div className="border border-indigo-900/60 p-2.5 rounded bg-slate-900/80 font-mono text-[9px] space-y-2">
                  <span className="font-bold text-white block">GRID LINE SYSTEM AND OUTLINES</span>
                  {/* Miniature CAD blueprint preview circles/grids */}
                  <div className="flex justify-around items-center h-20 border border-indigo-950/80 rounded relative bg-slate-950">
                    <div className="absolute top-0 bottom-0 left-1/3 border-l border-dashed border-indigo-800/80"></div>
                    <div className="absolute top-0 bottom-0 left-2/3 border-l border-dashed border-indigo-800/80"></div>
                    <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-indigo-800/80"></div>
                    
                    <div className="z-10 bg-indigo-900 text-[8px] text-white px-1.5 py-1 rounded">F1 [A-2]</div>
                    <div className="z-10 bg-indigo-900 text-[8px] text-white px-1.5 py-1 rounded">F2 [B-1]</div>
                  </div>
                  <span className="text-[8.5px] text-slate-400 flex justify-between pr-1">
                    <span>X-Scale 1:50</span>
                    <span>Continuous gridline coordinates</span>
                  </span>
                </div>
              )}

              {/* General Schedule preview table preview */}
              {activeSheetId === 'schedule' && (
                <div className="space-y-2">
                  <span className="font-bold text-indigo-400 flex items-center gap-1 text-[10px]">
                    <Sliders className="h-3.5 w-3.5" /> FOUNATION MODEL SCHEDULE PREVIEW:
                  </span>
                  <div className="text-[9.5px] bg-slate-900 p-2 rounded max-h-32 overflow-hidden border border-indigo-950">
                    <div className="grid grid-cols-4 font-bold border-b border-indigo-950 pb-1 text-white">
                      <span>Mark</span><span>Width</span><span>Length</span><span>Depth</span>
                    </div>
                    {scheduleItems.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="grid grid-cols-4 py-1 border-b border-indigo-950/40 text-slate-400 font-mono">
                        <span>{item.typeMark}</span>
                        <span>{item.B}mm</span>
                        <span>{item.L}mm</span>
                        <span>{item.H}mm</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other generic placeholder descriptions */}
              {!['cover', 'notes', 'layout', 'schedule'].includes(activeSheetId) && (
                <div className="p-3 text-center bg-slate-900/60 border border-indigo-950 rounded space-y-2">
                  <Info className="h-6 w-6 text-indigo-500 mx-auto" />
                  <span className="font-bold text-xs text-white block">
                    {orderedAndNumberedSheets.find(s => s.id === activeSheetId)?.title || 'No Title Available'}
                  </span>
                  <p className="text-[9.5px] text-slate-400 leading-normal">
                    {orderedAndNumberedSheets.find(s => s.id === activeSheetId)?.contentDesc || 'Detailed specifications and structural graphics for construction deliverables.'}
                  </p>
                </div>
              )}

              {/* Title block stencil representation drawer */}
              <div className="border-t border-indigo-950 pt-2 text-[9px] text-slate-400 space-y-1">
                <span className="text-[8px] font-bold block text-indigo-400">BLUEPRINT MATRICES STATUS</span>
                <div className="flex justify-between"><span>Page Number:</span> <strong className="text-white">{orderedAndNumberedSheets.find(s => s.id === activeSheetId)?.number || 'EXCLUDED'}</strong></div>
                <div className="flex justify-between"><span>Target Scale:</span> <strong className="text-white">{autoSelectScale(activeSheetId, selectedSheetSize)}</strong></div>
                <div className="flex justify-between"><span>Approval Stamp:</span> <strong className="text-emerald-500 font-bold flex items-center gap-0.5"><CheckCircle className="h-2.5 w-2.5" /> APPROVED IN PRINCIPLE</strong></div>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}

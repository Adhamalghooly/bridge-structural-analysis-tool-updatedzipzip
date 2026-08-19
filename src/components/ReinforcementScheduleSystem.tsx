import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  buildReinforcementDatabase, 
  analyzeReinforcementDatabase, 
  auditReinforcementDatabase, 
  exposeReinforcementDatabaseToWindow,
  RebarScheduleItem,
  RebarAuditIssue
} from '../lib/reinforcementScheduleEngine';
import { Beam, Column, Slab, Story } from '../lib/structuralEngine';
import { FootingDesignResult } from '../lib/foundationDesign';

import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Input } from './ui/input';
import { 
  Database, Table as TableIcon, Filter, AlertTriangle, 
  CheckCircle, Download, Printer, Search, Building2, 
  SlidersHorizontal, RefreshCw, Eye, Grid, AlertCircle, FileSpreadsheet, FileText
} from 'lucide-react';

interface ReinforcementScheduleSystemProps {
  stories: Story[];
  beams: Beam[];
  columns: Column[];
  slabs: Slab[];
  beamDesigns: any[];
  colDesigns: any[];
  slabDesigns: any[];
  foundationResults?: FootingDesignResult[];
}

export const ReinforcementScheduleSystem: React.FC<ReinforcementScheduleSystemProps> = ({
  stories = [],
  beams = [],
  columns = [],
  slabs = [],
  beamDesigns = [],
  colDesigns = [],
  slabDesigns = [],
  foundationResults = []
}) => {
  // 1. Database Generation
  const rawDatabase = useMemo(() => {
    const db = buildReinforcementDatabase(
      stories,
      beams,
      columns,
      slabs,
      beamDesigns,
      colDesigns,
      slabDesigns,
      foundationResults
    );
    // Expose to window immediately for API support
    exposeReinforcementDatabaseToWindow(db);
    return db;
  }, [stories, beams, columns, slabs, beamDesigns, colDesigns, slabDesigns, foundationResults]);

  // 2. State Management for Filters & Searches
  const [selectedStory, setSelectedStory] = useState<string>('all');
  const [selectedElementType, setSelectedElementType] = useState<string>('all');
  const [selectedDiameter, setSelectedDiameter] = useState<string>('all');
  const [selectedSheet, setSelectedSheet] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Grouping Mode
  const [groupingMode, setGroupingMode] = useState<'none' | 'story' | 'elementType' | 'diameter' | 'sheet' | 'barMark'>('none');
  
  // Tab control: Table view vs QA Report vs Visual Insights
  const [activeViewTab, setActiveViewTab] = useState<'schedules' | 'stats' | 'qa'>('schedules');

  // Trigger rebuild state indicator
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshDb = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Extract distinct values for dropdown filters
  const distinctStories = useMemo(() => {
    const set = new Set<string>();
    rawDatabase.forEach(item => {
      if (item.storyId) set.add(item.storyId);
    });
    return Array.from(set);
  }, [rawDatabase]);

  const distinctElementTypes = useMemo(() => {
    const set = new Set<string>();
    rawDatabase.forEach(item => {
      if (item.elementType) set.add(item.elementType);
    });
    return Array.from(set);
  }, [rawDatabase]);

  const distinctDiameters = useMemo(() => {
    const set = new Set<number>();
    rawDatabase.forEach(item => {
      if (item.diameter) set.add(item.diameter);
    });
    return Array.from(set).sort((a,b) => a - b);
  }, [rawDatabase]);

  const distinctSheets = useMemo(() => {
    const set = new Set<string>();
    rawDatabase.forEach(item => {
      if (item.drawingRef.sheetNo) set.add(item.drawingRef.sheetNo);
    });
    return Array.from(set);
  }, [rawDatabase]);

  // 3. Filter Logic
  const filteredDatabase = useMemo(() => {
    return rawDatabase.filter(item => {
      const matchStory = selectedStory === 'all' || item.storyId === selectedStory;
      const matchElem = selectedElementType === 'all' || item.elementType === selectedElementType;
      const matchDia = selectedDiameter === 'all' || item.diameter.toString() === selectedDiameter;
      const matchSheet = selectedSheet === 'all' || item.drawingRef.sheetNo === selectedSheet;
      
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = searchTerm === '' || 
        item.barMark.toLowerCase().includes(searchLower) ||
        item.elementId.toLowerCase().includes(searchLower) ||
        item.classification.toLowerCase().includes(searchLower) ||
        item.drawingRef.sheetNo.toLowerCase().includes(searchLower) ||
        item.drawingRef.bbsRef.toLowerCase().includes(searchLower);

      return matchStory && matchElem && matchDia && matchSheet && matchSearch;
    });
  }, [rawDatabase, selectedStory, selectedElementType, selectedDiameter, selectedSheet, searchTerm]);

  // 4. Quantity Calculations & Breakdowns
  const analytics = useMemo(() => {
    return analyzeReinforcementDatabase(filteredDatabase);
  }, [filteredDatabase]);

  // Total calculated values of overall database for reference
  const overallAnalytics = useMemo(() => {
    return analyzeReinforcementDatabase(rawDatabase);
  }, [rawDatabase]);

  // 5. Run Consistency Audit
  const auditReport = useMemo(() => {
    return auditReinforcementDatabase(filteredDatabase);
  }, [filteredDatabase]);

  // 6. Grouping Calculations
  const groupedData = useMemo(() => {
    if (groupingMode === 'none') return null;

    const map = new Map<string, RebarScheduleItem[]>();
    filteredDatabase.forEach(item => {
      let key = 'Other';
      if (groupingMode === 'story') key = item.storyLabel || 'Foundation Level';
      else if (groupingMode === 'elementType') key = item.elementType.toUpperCase();
      else if (groupingMode === 'diameter') key = `Φ${item.diameter} mm`;
      else if (groupingMode === 'sheet') key = item.drawingRef.sheetNo;
      else if (groupingMode === 'barMark') key = `Mark: ${item.barMark}`;

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });

    return Array.from(map.entries()).map(([groupKey, list]) => {
      const gWeight = list.reduce((sum, item) => sum + item.totalWeight, 0);
      const gLength = list.reduce((sum, item) => sum + item.totalLength, 0);
      return {
        groupKey,
        items: list,
        totalWeight: parseFloat(gWeight.toFixed(1)),
        totalLength: parseFloat(gLength.toFixed(2)),
        count: list.length
      };
    });
  }, [filteredDatabase, groupingMode]);

  // 7. MULTI-FORMAT EXPORTS

  // Export to HTML Table (Separate Page Layout)
  const exportToHTML = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHTML = filteredDatabase.map((item, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; font-weight: bold; color: #0f172a;">${item.barMark}</td>
        <td style="padding: 10px;">${item.elementId}</td>
        <td style="padding: 10px;">${item.storyLabel}</td>
        <td style="padding: 10px; text-transform: capitalize;">${item.elementType}</td>
        <td style="padding: 10px;">${item.classification}</td>
        <td style="padding: 10px; font-weight: bold;">&Phi;${item.diameter}</td>
        <td style="padding: 10px;">${item.length.toFixed(2)} m</td>
        <td style="padding: 10px; font-family: monospace;">Shape ${item.shapeCode}</td>
        <td style="padding: 10px; font-weight: bold;">${item.quantity}</td>
        <td style="padding: 10px;">${item.totalLength.toFixed(2)} m</td>
        <td style="padding: 10px; font-weight: bold; color: #1e3a8a;">${item.totalWeight.toFixed(1)} kg</td>
        <td style="padding: 10px; font-size: 11px; color: #64748b;">
          ${item.drawingRef.sheetNo}<br/>
          <small>${item.drawingRef.detailNo || item.drawingRef.sectionNo ? `Det: ${item.drawingRef.detailNo || '—'} | Sec: ${item.drawingRef.sectionNo || '—'}` : 'غير مرتبط برسم تفصيلي'}</small>
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Reinforcement Schedule Report - STA4CAD</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; direction: ltr; color: #334155; }
            h1 { color: #0f172a; border-bottom: 2px solid #06b6d4; padding-bottom: 10px; font-size: 22px; }
            .meta { margin-bottom: 20px; font-size: 13px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th { background-color: #0f172a; color: #ffffff; padding: 12px; text-align: left; }
            .kpi-row { display: flex; gap: 15px; margin-bottom: 25px; }
            .kpi-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; background-color: #f8fafc; }
            .kpi-box h4 { margin: 0 0 5px 0; color: #64748b; font-size: 11px; text-transform: uppercase; }
            .kpi-box .val { font-size: 20px; font-weight: bold; color: #0f172a; }
          </style>
        </head>
        <body>
          <h1>STA4CAD UNIFIED REINFORCEMENT DATABASE REPORT</h1>
          <div class="meta">
            <strong>Project Name:</strong> Structural Audit Design System <br/>
            <strong>Generated Date:</strong> ${new Date().toLocaleString()} <br/>
            <strong>Total Steel Entries:</strong> ${filteredDatabase.length} Items <br/>
            <strong>BBS Standard Compliance:</strong> BS 8666:2005 / ACI-315
          </div>
          
          <div class="kpi-row">
            <div class="kpi-box">
              <h4>Total Weight</h4>
              <div class="val" style="color: #0891b2;">${analytics.totalWeight.toLocaleString()} kg</div>
            </div>
            <div class="kpi-box">
              <h4>Total Length</h4>
              <div class="val">${analytics.totalLength.toLocaleString()} m</div>
            </div>
            <div class="kpi-box">
              <h4>Average Bar Cut Length</h4>
              <div class="val">${(filteredDatabase.reduce((acc,curr) => acc + curr.length, 0) / (filteredDatabase.length || 1)).toFixed(2)} m</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Bar Mark</th>
                <th>Element ID</th>
                <th>Story</th>
                <th>Type</th>
                <th>Classification</th>
                <th>Dia (mm)</th>
                <th>Length</th>
                <th>Shape</th>
                <th>Qty</th>
                <th>Total L</th>
                <th>Weight (kg)</th>
                <th>Drawing Sheets / Det</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export to standard print-dialog style layout
  const exportToPrint = () => {
    window.print();
  };

  // Export to Excel Spreadsheet via XLSX
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // 1. Raw Detailed Database
    const detailedData = filteredDatabase.map(item => ({
      'Bar Mark': item.barMark,
      'Element ID': item.elementId,
      'Story Level': item.storyLabel,
      'Element Type': item.elementType.toUpperCase(),
      'Rebar Classification': item.classification,
      'Bar Diameter (mm)': item.diameter,
      'Length (m)': item.length,
      'Shape Code (BS8666)': item.shapeCode,
      'Quantity (pcs)': item.quantity,
      'Total Length (m)': item.totalLength,
      'Steel Grade': item.steelGrade,
      'Unit Weight (kg/m)': item.unitWeight,
      'Total Weight (kg)': item.totalWeight,
      'Reference Sheet': item.drawingRef.sheetNo,
      'Detail Number': item.drawingRef.detailNo || '',
      'Section Symbol': item.drawingRef.sectionNo || '',
      'BBS Drawing Key': item.drawingRef.bbsRef
    }));

    const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
    XLSX.utils.book_append_sheet(wb, wsDetailed, 'Rebar Database');

    // 2. Summary by Diameter
    const diaData = analytics.weightByDiameter.map(v => ({
      'Rebar Diameter': `Φ${v.diameter}`,
      'Total Quantity (bars)': v.quantity,
      'Total Linear Length (m)': v.totalLength,
      'Total Net Weight (kg)': v.totalWeight,
      'Tonnage (tons)': parseFloat((v.totalWeight / 1000).toFixed(4))
    }));
    const wsDia = XLSX.utils.json_to_sheet(diaData);
    XLSX.utils.book_append_sheet(wb, wsDia, 'Weight by Diameter');

    // 3. Summary by Element Type
    const elemData = analytics.weightByElement.map(v => ({
      'Structural Element': v.elementType.toUpperCase(),
      'Schedules Count': v.quantity,
      'Total Linear Length (m)': v.totalLength,
      'Total Net Weight (kg)': v.totalWeight,
      'Percentage (%)': parseFloat((v.totalWeight / (analytics.totalWeight || 1) * 100).toFixed(2))
    }));
    const wsElem = XLSX.utils.json_to_sheet(elemData);
    XLSX.utils.book_append_sheet(wb, wsElem, 'Weight by Element');

    XLSX.writeFile(wb, 'STA4CAD_Unified_Reinforcement_Schedules.xlsx');
  };

  // Export to CSV file
  const exportToCSV = () => {
    const headers = [
      'Bar Mark', 'Element ID', 'Story', 'Type', 'Classification', 
      'Dia (mm)', 'Length (m)', 'Shape Code', 'Quantity', 
      'Total Length (m)', 'Total Weight (kg)', 'Sheet Number', 'BBS Reference'
    ];

    const rows = filteredDatabase.map(item => [
      `"${item.barMark}"`,
      `"${item.elementId}"`,
      `"${item.storyLabel}"`,
      `"${item.elementType}"`,
      `"${item.classification}"`,
      item.diameter,
      item.length,
      `"${item.shapeCode}"`,
      item.quantity,
      item.totalLength,
      item.totalWeight,
      `"${item.drawingRef.sheetNo}"`,
      `"${item.drawingRef.bbsRef}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "STA4CAD_Reinforcement_Database_Schedule.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to elegant Landscape PDF Report using jsPDF AutoTable
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const w = 297, h = 210;

    // Header Design
    doc.setFillColor(15, 23, 42); // slate-900 background
    doc.rect(10, 10, w - 20, 20, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('STA4CAD UNIFIED REINFORCEMENT DATABASE & SCHEDULES', 15, 18);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 220, 255);
    doc.text(`Generated Date: ${new Date().toLocaleString()} | BBS Compliance: BS 8666 / ACI-15`, 15, 24);

    // Filter status on PDF margin
    doc.setFillColor(241, 245, 249);
    doc.rect(10, 32, w - 20, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text(`Filters applied: StoryId: ${selectedStory} | ElementType: ${selectedElementType} | Dia: ${selectedDiameter} mm | Search: "${searchTerm || 'None'}"`, 12, 37);

    // Table Content
    autoTable(doc, {
      startY: 42,
      head: [['Mark', 'Element ID', 'Story', 'Type', 'Classification', 'Dia', 'Length (m)', 'Shape', 'Qty', 'Tot L (m)', 'Wt (kg)', 'Sheet No']],
      body: filteredDatabase.map(item => [
        item.barMark,
        item.elementId,
        item.storyLabel,
        item.elementType.toUpperCase(),
        item.classification,
        `Φ${item.diameter}`,
        item.length.toFixed(2),
        item.shapeCode,
        item.quantity.toString(),
        item.totalLength.toFixed(1),
        item.totalWeight.toFixed(1),
        item.drawingRef.sheetNo.split(' ')[0]
      ]),
      foot: [[
        'Total', '', '', '', '', '', '', '', 
        filteredDatabase.reduce((acc,curr) => acc + curr.quantity, 0).toString(),
        analytics.totalLength.toFixed(1),
        analytics.totalWeight.toFixed(1),
        ''
      ]],
      styles: { fontSize: 6.5, font: 'helvetica' },
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
      margin: { left: 10, right: 10 },
      tableWidth: w - 20,
    });

    doc.save(`STA4CAD_Reinforcement_Schedules_Report_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6" id="reinforcement-schedule-system-root">
      
      {/* 1. Header Banner & KPIs */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 md:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl -z-0 pointer-events-none" />
        <div className="absolute left-10 bottom-0 w-60 h-60 bg-indigo-500/5 rounded-full blur-2xl -z-0 pointer-events-none" />

        <div className="space-y-1 z-10 text-right md:order-2">
          <div className="flex items-center gap-2 justify-end">
            <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-cyan-500/30">
              Phase D6D System
            </span>
            <Database className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-bold tracking-tight">نظام جدولة حديد التسليح المركزي الموحد</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
            قاعدة البيانات الهندسية الموحدة ومصدر الحقيقة المنفرد لكميات، قطعيات، أطوال وأشكال حديد التسليح لجميع العناصر الإنشائية مع مدقق الجودة ومقاييس الكود.
          </p>
        </div>

        {/* Action button grouping */}
        <div className="flex flex-wrap gap-2 z-10 md:order-1 self-stretch md:self-auto justify-end">
          <Button 
            variant="outline" 
            size="xs"
            onClick={handleRefreshDb}
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white flex items-center gap-1.5 h-8 font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </Button>
          
          <Badge className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold px-2.5 h-8 flex items-center">
            قاعدة البيانات: {rawDatabase.length} سجلات نشطة
          </Badge>
        </div>
      </div>

      {/* 2. Primary Quantities & Metric Summaries (KPI Panel) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="border-border bg-slate-50 shadow-xs relative overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1 text-right">
            <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Total Tonnage</span>
            <div className="text-2xl font-black text-cyan-700 font-mono">
              {(analytics.totalWeight / 1000).toFixed(3)} <span className="text-xs font-normal">طن</span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">إجمالي وزن حديد التسليح المطلوب</p>
            <div className="text-[9px] text-slate-400 flex items-center justify-between font-mono pt-1 border-t border-slate-200">
              <span>{analytics.totalWeight.toLocaleString()} kg</span>
              <span>صافي الوزن</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-slate-50 shadow-xs relative overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1 text-right">
            <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Total Linear Length</span>
            <div className="text-2xl font-black text-indigo-700 font-mono">
              {analytics.totalLength.toLocaleString()} <span className="text-xs font-normal">متر</span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">إجمالي أطوال قطعيات قضبان الحديد</p>
            <div className="text-[9px] text-slate-400 flex items-center justify-between font-mono pt-1 border-t border-slate-200">
              <span>Avg length: {(analytics.totalLength / (filteredDatabase.length || 1)).toFixed(2)} m</span>
              <span>معدل السيخ</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-slate-50 shadow-xs relative overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4 space-y-1 text-right">
            <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Elements Schedule Filtered</span>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              {filteredDatabase.length} <span className="text-xs font-normal">عنصر</span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">عدد قطعيات التسليح المصفاة حالياً</p>
            <div className="text-[9px] text-slate-400 flex items-center justify-between font-mono pt-1 border-t border-slate-200">
              <span>Out of {rawDatabase.length} total</span>
              <span>سجلات التصفية</span>
            </div>
          </CardContent>
        </Card>

        {/* D6D Consistency Health Gauge */}
        <Card className={`border-border shadow-xs relative overflow-hidden hover:shadow-md transition-shadow ${auditReport.length > 0 ? 'bg-amber-50/40 border-amber-200' : 'bg-emerald-50/40 border-emerald-200'}`}>
          <CardContent className="p-4 space-y-1 text-right">
            <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Data Integrity / QA QC</span>
            <div className="text-2xl font-black text-slate-800 font-mono flex items-center justify-end gap-1.5">
              {auditReport.length > 0 ? (
                <>
                  <span className="text-amber-700">{auditReport.length}</span>
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-sm">تحذيرات جودة</span>
                </>
              ) : (
                <>
                  <span className="text-emerald-700">100%</span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-sm">مطابق</span>
                </>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">حالة تطابق وسلامة جداول التقطيع والتوصيل</p>
            <div className="text-[9px] text-slate-400 flex items-center justify-between font-mono pt-1 border-t border-slate-200">
              <span>ACI 315 / BS8666 standard</span>
              <span>معايير الفحص</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* 3. Filter and Grouping Bar */}
      <Card className="border-slate-200 shadow-xs bg-white text-right">
        <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
          <Badge variant="outline" className="text-slate-500 border-slate-200 font-mono pb-0.5 text-[10px]">REBAR FILTERS</Badge>
          <CardTitle className="text-xs font-black text-slate-700 flex items-center gap-1.5 justify-end">
            لوحة التصفية المتقدمة والتجميع (Schedules Control Hub)
            <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Story Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">منسوب الطابق</label>
              <select
                value={selectedStory}
                onChange={(e) => setSelectedStory(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">كل الطوابق (All Stories)</option>
                {distinctStories.map(id => (
                  <option key={id} value={id}>
                    {stories.find(s => s.id === id)?.label || id}
                  </option>
                ))}
              </select>
            </div>

            {/* Element Type Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">نوع العنصر الإنشائي</label>
              <select
                value={selectedElementType}
                onChange={(e) => setSelectedElementType(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-transform capitalize"
              >
                <option value="all">كل العناصر (All Elements)</option>
                {distinctElementTypes.map(type => (
                  <option key={type} value={type}>
                    {type.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Diameter Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">قطر ربار الحديد (Diameter)</label>
              <select
                value={selectedDiameter}
                onChange={(e) => setSelectedDiameter(e.target.value)}
                className="w-full text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">كل الأقطار (All Diameters)</option>
                {distinctDiameters.map(dia => (
                  <option key={dia} value={dia.toString()}>
                    &Phi;{dia} mm
                  </option>
                ))}
              </select>
            </div>

            {/* Sheet Filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">لوحة الرسم المرجعية</label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="w-full text-xs font-semibold rounded-lg border border-slate-200 bg-white p-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="all">كل اللوحات (All Sheets)</option>
                {distinctSheets.map(sh => (
                  <option key={sh} value={sh}>
                    {sh}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">بحث في العلامات والرموز</label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="مثال: Mark 01..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-xs h-9 pr-8 pl-3 font-semibold border-slate-200"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Grouping Select toggles */}
            <div className="flex items-center gap-2">
              <select
                value={groupingMode}
                onChange={(e) => setGroupingMode(e.target.value as any)}
                className="text-[11.5px] font-bold rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-700 focus:outline-none"
              >
                <option value="none">بدون تجميع (No Grouping)</option>
                <option value="story">تجميع حسب المنسوب (By Story)</option>
                <option value="elementType">تجميع حسب نوع العنصر (By Element)</option>
                <option value="diameter">تجميع حسب القطر الكلي (By Diameter)</option>
                <option value="sheet">تجميع حسب لوحة التفصيل (By Sheet)</option>
                <option value="barMark">تجميع حسب الرمز الفريد (By Bar Mark)</option>
              </select>
              <span className="text-[11px] text-slate-500 font-bold">نموذج وهيكلة تجميع السجلات:</span>
            </div>

            {/* Quick Filter Resets */}
            <div className="flex gap-1.5">
              {(selectedStory !== 'all' || selectedElementType !== 'all' || selectedDiameter !== 'all' || selectedSheet !== 'all' || searchTerm !== '') && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setSelectedStory('all');
                    setSelectedElementType('all');
                    setSelectedDiameter('all');
                    setSelectedSheet('all');
                    setSearchTerm('');
                  }}
                  className="text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold px-2 h-7"
                >
                  تفريغ جميع مصافي الفحص
                </Button>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* 4. Sub-Navigation (Schedules Table, Breakdown Stats, QA Audit Console) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-1.5 gap-2">
        
        {/* Export Buttons */}
        <div className="flex flex-wrap gap-1.5 order-2 sm:order-1">
          <Button
            size="xs"
            onClick={exportToExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-3 flex items-center gap-1 h-7 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </Button>
          <Button
            size="xs"
            onClick={exportToPDF}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] py-1.5 px-3 flex items-center gap-1 h-7 shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF مصور
          </Button>
          <Button
            size="xs"
            onClick={exportToHTML}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[10px] py-1.5 px-3 flex items-center gap-1 h-7 shadow-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            HTML تقرير
          </Button>
          <Button
            size="xs"
            onClick={exportToCSV}
            className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-[10px] py-1.5 px-3 flex items-center gap-1 h-7 shadow-xs"
          >
            <Grid className="w-3.5 h-3.5 text-cyan-400" />
            CSV ملف
          </Button>
          <Button
            size="xs"
            onClick={exportToPrint}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[10px] py-1.5 px-3 flex items-center gap-1 h-7 border border-slate-200"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة اللوحة
          </Button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg order-1 sm:order-2 self-stretch sm:self-auto">
          <Button
            size="xs"
            onClick={() => setActiveViewTab('qa')}
            className={`font-black text-[11px] h-7 px-3.5 transition-all ${activeViewTab === 'qa' ? 'bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
          >
            فحص الكود والـ QA ({auditReport.length})
          </Button>
          <Button
            size="xs"
            onClick={() => setActiveViewTab('stats')}
            className={`font-black text-[11px] h-7 px-3.5 transition-all ${activeViewTab === 'stats' ? 'bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
          >
            إحصائيات وتوزيع الأقطار
          </Button>
          <Button
            size="xs"
            onClick={() => setActiveViewTab('schedules')}
            className={`font-black text-[11px] h-7 px-3.5 transition-all ${activeViewTab === 'schedules' ? 'bg-cyan-700 text-white shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'}`}
          >
            جداول الحديد والتفاصيل ({filteredDatabase.length})
          </Button>
        </div>
      </div>

      {/* 5. TAB VIEW CONTENTS */}

      {/* VIEW A: UNIFIED REINFORCEMENT SCHEDULE TABLE */}
      {activeViewTab === 'schedules' && (
        <div className="space-y-4 animate-fade-in">
          
          {groupingMode === 'none' ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-right">
              <div className="overflow-x-auto">
                <Table className="text-right text-xs min-w-[900px]">
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow>
                      <TableHead className="text-right font-bold text-slate-705 h-9">رمز الحديد (Mark)</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">رقم العنصر (ID)</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">حالة المنسوب / الطابق</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">التنصيف والنوع</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">المواصفات والقطر</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">طول السيخ</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">شكل الحناء</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">العدد (Qty)</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">إجمالي الطول</TableHead>
                      <TableHead className="text-right font-bold text-indigo-700 h-9">الوزن الصافي</TableHead>
                      <TableHead className="text-right font-bold text-slate-705 h-9">اللوحة / التفصيل / BBS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDatabase.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-slate-400 py-12">
                          لا توجد تسجيلات تطابق مرشحات الحقل حالياً.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDatabase.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                          <TableCell className="font-mono font-bold text-cyan-600">{item.barMark}</TableCell>
                          <TableCell className="font-mono font-bold text-slate-800">{item.elementId}</TableCell>
                          <TableCell className="font-sans text-slate-600 font-semibold">{item.storyLabel}</TableCell>
                          <TableCell className="text-slate-700">
                            <Badge variant="outline" className={`text-[10px] font-bold border-none px-1 py-0 ${
                              item.elementType === 'beam' ? 'bg-cyan-100 text-cyan-900' :
                              item.elementType === 'column' ? 'bg-purple-100 text-purple-900' :
                              item.elementType === 'slab' ? 'bg-amber-100 text-amber-900' :
                              'bg-rose-100 text-rose-900'
                            }`}>
                              {item.elementType.toUpperCase()}
                            </Badge>
                            <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">{item.classification}</span>
                          </TableCell>
                          <TableCell className="font-mono font-bold text-slate-700">
                            &Phi;{item.diameter} <span className="text-[9px] text-slate-400 block font-normal">{item.steelGrade.split(' ')[0]}</span>
                          </TableCell>
                          <TableCell className="font-mono text-slate-800">{item.length.toFixed(2)} م</TableCell>
                          <TableCell className="font-mono text-slate-500">
                            <span className="bg-slate-100 px-1 py-0.5 rounded font-bold text-[10px]">Shape {item.shapeCode}</span>
                          </TableCell>
                          <TableCell className="font-mono font-extrabold text-slate-900">{item.quantity} سيخ</TableCell>
                          <TableCell className="font-mono text-slate-800">{item.totalLength.toFixed(2)} م</TableCell>
                          <TableCell className="font-mono font-black text-indigo-700 bg-slate-50/50">{item.totalWeight.toFixed(1)} كجم</TableCell>
                          <TableCell className="text-[10px] text-slate-500 leading-tight">
                            <div className="font-bold text-slate-700">{item.drawingRef.sheetNo.split(' ')[0]}</div>
                            <div>{item.drawingRef.detailNo || item.drawingRef.sectionNo ? `Det: ${item.drawingRef.detailNo || '—'} | Sec: ${item.drawingRef.sectionNo || '—'}` : <span className="italic text-slate-400">غير مرتبط برسم</span>}</div>
                            <span className="text-[8.5px] bg-slate-100 px-1 text-slate-400 font-mono mt-0.5 rounded inline-block">{item.drawingRef.bbsRef}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            // GROUPED ACCORDION VIEW
            <div className="space-y-4">
              {groupedData && groupedData.map((group) => (
                <Card key={group.groupKey} className="border border-slate-200 overflow-hidden shadow-xs">
                  <div className="bg-slate-100/80 px-4 py-2.5 flex justify-between items-center border-b border-slate-200">
                    <div className="flex gap-2">
                      <Badge className="bg-slate-800 text-white font-mono">{group.count} سجلات</Badge>
                      <Badge className="bg-indigo-100 text-indigo-800 font-mono">وزن حديدي: {group.totalWeight.toLocaleString()} kg</Badge>
                      <Badge className="bg-cyan-100 text-cyan-800 font-mono">أطوال: {group.totalLength.toFixed(1)} م</Badge>
                    </div>
                    <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5 text-cyan-600" />
                      {group.groupKey}
                    </span>
                  </div>
                  <div className="overflow-x-auto bg-white">
                    <Table className="text-right text-xs">
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">رمز الحديد</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">رقم العنصر</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">الطابق</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">التصنيف</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">القطر</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">طول السيخ</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">العدد</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">إجمالي الطول</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-indigo-700">الوزن</TableHead>
                          <TableHead className="text-right py-2 h-7 font-bold text-slate-600">اللوحة التفصيلية</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-100">
                            <TableCell className="font-mono font-bold text-cyan-600">{item.barMark}</TableCell>
                            <TableCell className="font-mono font-bold text-slate-800">{item.elementId}</TableCell>
                            <TableCell className="text-slate-600 font-semibold">{item.storyLabel}</TableCell>
                            <TableCell className="text-slate-500 font-semibold">{item.classification}</TableCell>
                            <TableCell className="font-mono text-slate-700 font-bold">&Phi;{item.diameter}</TableCell>
                            <TableCell className="font-mono text-slate-800">{item.length.toFixed(2)} م</TableCell>
                            <TableCell className="font-mono text-slate-900">{item.quantity}</TableCell>
                            <TableCell className="font-mono text-slate-800">{item.totalLength.toFixed(1)} م</TableCell>
                            <TableCell className="font-mono font-extrabold text-indigo-700 bg-slate-50/50">{item.totalWeight.toFixed(1)} kg</TableCell>
                            <TableCell className="text-[10px] text-slate-500">{item.drawingRef.sheetNo.split(' ')[0]}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              ))}
            </div>
          )}

        </div>
      )}

      {/* VIEW B: BREAKDOWN STATS & GRAPHS */}
      {activeViewTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in text-right">
          
          {/* Diameters Distribution */}
          <Card className="border border-slate-200 shadow-xs bg-white">
            <CardHeader className="py-3 px-4 bg-slate-102 border-b border-slate-200">
              <CardTitle className="text-xs font-black text-slate-700">توزيع أوزان حديد التسليح حسب القطر (Weight By Diameter)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-3">
                {analytics.weightByDiameter.map((v) => {
                  const pct = (v.totalWeight / (analytics.totalWeight || 1)) * 100;
                  return (
                    <div key={v.diameter} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-indigo-700">{v.totalWeight.toLocaleString()} كجم ({pct.toFixed(1)}%)</span>
                        <span className="font-mono font-extrabold text-slate-800">&Phi;{v.diameter} mm</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>إجمالي طول الأفراد: {v.totalLength.toFixed(1)} متر</span>
                        <span>عدد القطع التعدادية: {v.quantity} سيخ</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Element Types Distribution */}
          <Card className="border border-slate-200 shadow-xs bg-white">
            <CardHeader className="py-3 px-4 bg-slate-102 border-b border-slate-200">
              <CardTitle className="text-xs font-black text-slate-700">توزيع حديد التسليح حسب العناصر (Weight By Element Type)</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {analytics.weightByElement.map((v) => {
                  const pct = (v.totalWeight / (analytics.totalWeight || 1)) * 100;
                  return (
                    <div key={v.elementType} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-indigo-700">{v.totalWeight.toLocaleString()} كجم ({pct.toFixed(1)}%)</span>
                        <span className="font-bold text-slate-700 capitalize">{v.elementType}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>إجمالي الأطوال: {v.totalLength.toFixed(1)} م</span>
                        <span>سجلات Schedule: {v.quantity} قطع</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Floor / Story Distribution */}
          <Card className="border border-slate-200 shadow-xs bg-white md:col-span-2">
            <CardHeader className="py-3 px-4 bg-slate-102 border-b border-slate-200">
              <CardTitle className="text-xs font-black text-slate-700">توزيع التوناج والترابط حسب الطوابق (Weight By Story Level)</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analytics.weightByStory.map((v) => {
                  const pct = (v.totalWeight / (analytics.totalWeight || 1)) * 100;
                  return (
                    <div key={v.storyId} className="border border-slate-150 rounded-xl p-3 bg-slate-50/50 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-cyan-100 text-cyan-900 font-bold px-1.5 py-0.5 rounded font-mono">
                          {pct.toFixed(1)}%
                        </span>
                        <h4 className="text-xs font-bold text-slate-800">{v.storyLabel}</h4>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-lg font-black text-slate-900 font-mono">
                          {v.totalWeight.toFixed(1)} <span className="text-xs font-normal">kg</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold leading-none">
                          مجموع أطوال الحديد: {v.totalLength.toFixed(1)} متر طولي
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* VIEW C: LIVE QA REPORT CONSOLE */}
      {activeViewTab === 'qa' && (
        <Card className="border border-amber-200 bg-amber-50/10 shadow-xs text-right">
          <CardHeader className="py-3 px-4 bg-amber-50/40 border-b border-amber-205 flex flex-row items-center justify-between">
            <Badge variant="outline" className="bg-amber-100 text-amber-900 border-none font-bold text-[10px]">
              ACI 315 / BS 8666 CODE INSPECTOR
            </Badge>
            <CardTitle className="text-xs font-black text-amber-950 flex items-center gap-1.5 justify-end">
              مدقق الجودة ومطابقة الأكواد الإنشائية لحديد التسليح (Live QA/QC Scheduler)
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            
            {auditReport.length === 0 ? (
              <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-600 animate-bounce" />
                <h3 className="text-sm font-black text-emerald-900">سجل مطابقة مثالي بنسبة 100%!</h3>
                <p className="text-xs text-emerald-700 max-w-lg leading-relaxed">
                  بشرى سارة: اجتازت جداول التسلح الحالية كافة اختبارات السلامة والتناغم الإنشائي. لا توجد رموز حديد متكررة بتعارضات في الأقطار، ولا توجد أطوال قطعيات تجاوزت الحدود التجارية الصعبة (12 متر)، وكافة العناصر تحتوي على مرجع خرائط تفصيلية للـ BBS والـ Sheet No.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-amber-100/50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900 font-semibold mb-2 leading-relaxed">
                  🚨 تنبيه: تم رصد ({auditReport.length}) تحذيرات عدم مطابقة هندسية في قاعدة بيانات حديد التسليح النشطة. نوصي بمراجعة المعايير المرفقة أو النقر على حلول الصيانة لتحديث جداول الأطوال والتقطيع.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {auditReport.map((iss) => (
                    <div 
                      key={iss.id} 
                      className={`p-3.5 rounded-xl border bg-white shadow-2xs leading-relaxed flex flex-col justify-between gap-2 ${
                        iss.severity === 'high' ? 'border-rose-200 hover:border-rose-300' :
                        iss.severity === 'medium' ? 'border-amber-200 hover:border-amber-300' :
                        'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center font-bold">
                          <Badge className={`text-[9px] px-1.5 h-4.5 font-bold border-none ${
                            iss.severity === 'high' ? 'bg-rose-100 text-rose-800' :
                            iss.severity === 'medium' ? 'bg-amber-100 text-amber-805' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {iss.severity === 'high' ? 'حرج جداً' : iss.severity === 'medium' ? 'تعديل هندسي' : 'إرشاد تجميلي'}
                          </Badge>
                          <span className="text-slate-800 font-bold font-mono">ID: {iss.elementId} ({iss.elementType.toUpperCase()})</span>
                        </div>
                        
                        <h4 className="font-black text-slate-900 text-xs mt-1">{iss.title}</h4>
                        <p className="text-[11.5px] text-slate-500 font-medium leading-relaxed mt-0.5">{iss.message}</p>
                      </div>

                      <div className="bg-slate-50 rounded p-2 text-[10.5px] font-semibold text-slate-700 border-r-3 border-cyan-600 font-mono mt-1">
                        🛠️ الحل المقترح: {iss.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* 6. Footer Disclaimer & Compliance Metadata */}
      <div className="text-[10px] text-slate-400 font-semibold bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 leading-none">
        <span>* تم تفعيل تمدد العزوم وقوانين الثني BS 8666 / ACI 315 بنجاح.</span>
        <span className="font-mono">STA4CAD Unified Reinforcement Database System • Version 1.4-Phase D6D</span>
      </div>

    </div>
  );
};

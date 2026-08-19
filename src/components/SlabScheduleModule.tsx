import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Settings2,
  RefreshCw,
  LayoutGrid,
  FileCode2,
  Hammer
} from 'lucide-react';

import { Slab, Story, MatProps } from '../lib/structuralEngine';
import { SlabScheduleEngine, SlabScheduleRow, SlabScheduleValidationIssue, SlabTypeLabel } from '../lib/slabScheduleEngine';

import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

interface SlabScheduleModuleProps {
  slabs: Slab[];
  stories: Story[];
  slabDesigns?: Record<string, any>;
  materialProps?: MatProps;
}

export const SlabScheduleModule: React.FC<SlabScheduleModuleProps> = ({
  slabs,
  stories,
  slabDesigns,
  materialProps
}) => {
  // UI and Filtering States
  const [groupRows, setGroupRows] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStoryFilter, setSelectedStoryFilter] = useState<string>('ALL');
  const [selectedSlabTypeFilter, setSelectedSlabTypeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'id' | 'area' | 'thickness' | 'concreteVolume' | 'steelWeight'>('id');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Generate RAW schedule rows
  const rawRows = useMemo(() => {
    return SlabScheduleEngine.generateSchedule(slabs, stories, slabDesigns, materialProps);
  }, [slabs, stories, slabDesigns, materialProps]);

  // Generate validation issues from raw rows
  const validationIssues = useMemo(() => {
    return SlabScheduleEngine.validateSchedule(rawRows);
  }, [rawRows]);

  // Build story list for selections
  const storyOptions = useMemo(() => {
    const s = new Set<string>();
    rawRows.forEach(r => {
      if (r.storyName) s.add(r.storyName);
    });
    return Array.from(s);
  }, [rawRows]);

  // Build unique Slab Types available for filter
  const slabTypeOptions = useMemo(() => {
    const t = new Set<string>();
    rawRows.forEach(r => {
      if (r.slabType) t.add(r.slabType);
    });
    return Array.from(t);
  }, [rawRows]);

  // Filter & Group and Sort Rows
  const processedRows = useMemo(() => {
    let output = [...rawRows];

    // 1. Text Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      output = output.filter(r => 
        r.slabId.toLowerCase().includes(q) || 
        r.name.toLowerCase().includes(q) ||
        r.gridLocation.toLowerCase().includes(q)
      );
    }

    // 2. Story Filter
    if (selectedStoryFilter !== 'ALL') {
      output = output.filter(r => r.storyName === selectedStoryFilter);
    }

    // 3. Slab Type Filter
    if (selectedSlabTypeFilter !== 'ALL') {
      output = output.filter(r => r.slabType === selectedSlabTypeFilter);
    }

    // 4. Grouping Logic
    if (groupRows) {
      output = SlabScheduleEngine.groupScheduleRows(output);
    }

    // 5. Sorting
    output.sort((a, b) => {
      if (sortBy === 'id') {
        return a.slabId.localeCompare(b.slabId, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'area') {
        return b.area - a.area;
      }
      if (sortBy === 'thickness') {
        return b.thickness - a.thickness;
      }
      if (sortBy === 'concreteVolume') {
        return b.concreteVolume - a.concreteVolume;
      }
      if (sortBy === 'steelWeight') {
        return b.steelWeight - a.steelWeight;
      }
      return 0;
    });

    return output;
  }, [rawRows, groupRows, searchTerm, selectedStoryFilter, selectedSlabTypeFilter, sortBy]);

  // Select first row naturally as active detail representation
  React.useEffect(() => {
    if (processedRows.length > 0 && !selectedRowId) {
      setSelectedRowId(processedRows[0].id);
    }
  }, [processedRows, selectedRowId]);

  const activeDetailRow = useMemo(() => {
    if (!selectedRowId) return null;
    return rawRows.find(r => r.id === selectedRowId) || processedRows.find(r => r.id === selectedRowId) || null;
  }, [selectedRowId, rawRows, processedRows]);

  // Totals calculations
  const totalConcrete = useMemo(() => {
    return processedRows.reduce((acc, r) => acc + r.concreteVolume, 0);
  }, [processedRows]);

  const totalSteel = useMemo(() => {
    return processedRows.reduce((acc, r) => acc + r.steelWeight, 0);
  }, [processedRows]);

  const totalFormwork = useMemo(() => {
    return processedRows.reduce((acc, r) => acc + r.formworkArea, 0);
  }, [processedRows]);

  // EXPORT TO EXCEL
  const handleExportExcel = () => {
    const dataToExport = processedRows.map(r => ({
      'Slab Code': r.name,
      'Level (Story)': r.storyName,
      'Grid Reference': r.gridLocation,
      'Slab Structural Type': r.slabType,
      'Analytical Method': r.designMethod,
      'Span Direction': r.spanDirection,
      'Structural Boundary': r.supportConditions,
      'Length (m)': r.length,
      'Width (m)': r.width,
      'Area (m2)': r.area,
      'Thickness (mm)': r.thickness,
      'Perimeter (m)': r.perimeter,
      'Bottom Mesh Reinforcement': r.bottomReinforcement,
      'Top Shield Reinforcement': r.topReinforcement,
      'Additional Support Bars': r.additionalReinforcement,
      'Rib/Topping Mesh': r.supportReinforcement,
      'Rim Opening Restraint': r.openingReinforcement,
      'Slab Marks': r.reinforcementMarks,
      'Concrete Grade': r.concreteStrength,
      'Steel Grade': r.steelGrade,
      'Clear Cover (mm)': r.cover,
      'Concrete Vol (m3)': r.concreteVolume,
      'Steel Mass (kg)': r.steelWeight,
      'Formwork Area (m2)': r.formworkArea,
      'Detail Drwg Ref': r.detailNum,
      'Section Ref': r.sectionNum,
      'Sheet ID': r.sheetNo,
      'Structural Group Count': r.groupCount
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Slab Schedule');
    XLSX.writeFile(wb, `STA4CAD_Slab_Schedule_${selectedStoryFilter !== 'ALL' ? selectedStoryFilter : 'Full_Project'}.xlsx`);
  };

  // EXPORT TO CSV
  const handleExportCSV = () => {
    const headers = [
      'Slab Code', 'Level', 'Grid Ref', 'Slab Type', 'Length', 'Width', 'Area', 'Thickness',
      'Bottom Rebar', 'Top Rebar', 'Additional Rebar', 'Concrete', 'Steel Grade',
      'C-Volume', 'S-Weight', 'Formwork', 'Sheet No', 'Multiplier'
    ];
    const rows = processedRows.map(r => [
      r.name, r.storyName, r.gridLocation, r.slabType, r.length, r.width, r.area, r.thickness,
      r.bottomReinforcement, r.topReinforcement, r.additionalReinforcement, r.concreteStrength, r.steelGrade,
      r.concreteVolume, r.steelWeight, r.formworkArea, r.sheetNo, r.groupCount
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `STA4CAD_Slab_Schedule_${selectedStoryFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXPORT STANDALONE HTML FILE
  const handleExportHTMLFile = () => {
    const htmlSnippet = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>STA4CAD Slab Reinforcement Schedule</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #334155; background: #f8fafc; }
          .header { text-align: center; border-bottom: 3px double #0284c7; padding-bottom: 15px; margin-bottom: 25px; }
          .header h1 { margin: 0; color: #0f172a; font-size: 24px; }
          .header p { margin: 5px 0 0; color: #64748b; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); background: white; }
          th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: center; font-size: 12px; }
          th { background-color: #0284c7; color: white; font-weight: 600; }
          tr:nth-child(even) { background-color: #f1f5f9; }
          .accent { font-weight: bold; color: #0369a1; }
          .summary { display: flex; justify-content: space-around; background: #e0f2fe; padding: 15px; border-radius: 8px; margin-top: 20px; font-weight: bold; border: 1px solid #bae6fd; }
          .footer { text-align: left; font-size: 11px; color: #94a3b8; margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>جدول تسليح ودراسة البلاطات الإنشائية (STA4CAD Slab Schedule System)</h1>
          <p>شيت تفريد الخرسانة المسلحة وتحديد كميات المواد المصنعة - الدور الحالي: ${selectedStoryFilter === 'ALL' ? 'كامل المشروع' : selectedStoryFilter}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>رمز البلاطة (ID)</th>
              <th>الارتفاع (Story)</th>
              <th>محاور الإسناد</th>
              <th>الأبعاد (m)</th>
              <th>السماكة (mm)</th>
              <th>المساحة (m²)</th>
              <th>نوع البلاطة</th>
              <th>اتجاه الأعصاب/الفرش</th>
              <th>التسليح السفلي</th>
              <th>التسليح العلوي</th>
              <th>التسليح الإضافي</th>
              <th>مكعب الخرسانة (m³)</th>
              <th>وزن الحديد (kg)</th>
              <th>قوالب الشدة (m²)</th>
              <th>مخطط التفصيل</th>
            </tr>
          </thead>
          <tbody>
            ${processedRows.map(row => `
              <tr>
                <td class="accent">${row.name}</td>
                <td>${row.storyName}</td>
                <td>${row.gridLocation}</td>
                <td>${row.length} x ${row.width}</td>
                <td>${row.thickness} مم</td>
                <td>${row.area}</td>
                <td>${row.slabType}</td>
                <td>${row.spanDirection}</td>
                <td class="accent">${row.bottomReinforcement}</td>
                <td>${row.topReinforcement}</td>
                <td>${row.additionalReinforcement}</td>
                <td>${row.concreteVolume.toFixed(3)}</td>
                <td>${row.steelWeight.toFixed(2)}</td>
                <td>${row.formworkArea.toFixed(2)}</td>
                <td>${row.detailNum || row.sheetNo}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="summary">
          <div>إجمالي صب الخرسانة للبلاطات: ${totalConcrete.toFixed(2)} م³</div>
          <div>إجمالي كتلة حديد التسليح: ${totalSteel.toFixed(2)} كجم</div>
          <div>إجمالي مساحات الفرم والشدات: ${totalFormwork.toFixed(2)} م²</div>
        </div>
        
        <p class="footer">* تم استخراج هذا الجدول تلقائياً بشكل يطابق كود التصميم الأمريكي ACI 318 والمخططات الهندسية.</p>
      </body>
      </html>
    `;

    const blob = new Blob([htmlSnippet], { type: 'text/html;charset=utf-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Slab_Schedule_Sheet_${selectedStoryFilter}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // NATIVE PRINT WINDOW & PDF GENERATOR
  const handlePrint = () => {
    const prWindow = window.open('', '_blank');
    if (!prWindow) return;

    prWindow.document.write(`
      <html>
        <head>
          <title>Slab Schedule Report - STA4CAD</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; direction: rtl; text-align: right; margin: 0; padding: 40px; color: #1e293b; background: white; }
            h1 { font-size: 20px; font-weight: bold; margin-bottom: 5px; color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 10px; }
            p { font-size: 12px; margin: 4px 0; color: #475569; }
            table { width: 100%; border-collapse: collapse; margin-top: 25px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; }
            th { background-color: #f8fafc; font-weight: bold; color: #0f172a; }
            .totals-box { margin-top: 30px; border: 2px solid #0284c7; background-color: #f0f9ff; padding: 15px; border-radius: 6px; display: flex; justify-content: space-around; font-size: 12px; font-weight: bold; color: #0369a1; }
            .tag { font-family: monospace; font-weight: bold; color: #0284c7; }
            .footer { margin-top: 50px; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: left; color: #64748b; }
          </style>
        </head>
        <body>
          <h1>جدول حسابات وكميات بلاطات الأسقف الخرسانية (STA4CAD Slab Schedule)</h1>
          <p><strong>المشروع:</strong> لوحة تفاصيل البلاطات الإنشائية</p>
          <p><strong>الدور:</strong> ${selectedStoryFilter === 'ALL' ? 'جميع أدوار المنشأ' : selectedStoryFilter}</p>
          <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>

          <table>
            <thead>
              <tr>
                <th>كود البلاطة</th>
                <th>الدور</th>
                <th>محاور الإسناد</th>
                <th>الأبعاد (m)</th>
                <th>السماكة</th>
                <th>النوع الإنشائي</th>
                <th>حديد التسليح السفلي</th>
                <th>حديد التسليح العلوي</th>
                <th>القطع الإضافي</th>
                <th>الخرسانة (m&sup3;)</th>
                <th>الحديد (kg)</th>
                <th>الشدة المربعة (m&sup2;)</th>
                <th>تكرار</th>
              </tr>
            </thead>
            <tbody>
              ${processedRows.map(row => `
                <tr>
                  <td class="tag">${row.name}</td>
                  <td>${row.storyName}</td>
                  <td>${row.gridLocation}</td>
                  <td>${row.length} x ${row.width}</td>
                  <td>${row.thickness} mm</td>
                  <td>${row.slabType}</td>
                  <td><strong>${row.bottomReinforcement}</strong></td>
                  <td>${row.topReinforcement}</td>
                  <td>${row.additionalReinforcement}</td>
                  <td>${row.concreteVolume.toFixed(3)}</td>
                  <td>${row.steelWeight.toFixed(2)}</td>
                  <td>${row.formworkArea.toFixed(2)}</td>
                  <td>x${row.groupCount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals-box">
            <div>إجمالي حجم الصب: ${totalConcrete.toFixed(2)} m&sup3;</div>
            <div>إجمالي وزن حديد التسليح: ${totalSteel.toFixed(2)} kg</div>
            <div>إجمالي مسطح نجارة الشدة: ${totalFormwork.toFixed(2)} m&sup2;</div>
          </div>

          <p class="footer">* يتطابق النظام مع اشتراطات السهم والانحناء للكود الأمريكي والـ BBS المعتمدة.</p>
        </body>
      </html>
    `);

    prWindow.document.close();
    prWindow.focus();
    setTimeout(() => {
      prWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-800 text-right" style={{ direction: 'rtl' }}>
      
      {/* 1. Header Cards & Quantities Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-cyan-100 shadow-xs bg-slate-50/40 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-cyan-600" />
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">إجمالي صب الخرسانة المسلحة (الكمية)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{totalConcrete.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-500">متر مكعب (m³)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">تم حسابها بناءً على سماكات صرة البلاطة الفعلية.</p>
          </CardContent>
        </Card>

        <Card className="border border-violet-100 shadow-xs bg-slate-50/40 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-violet-600" />
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">إجمالي وزن حديد التسليح الكلي</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-950 font-mono">{totalSteel.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-500">كجم (kg)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">متضمنة شبكات الرمل، الكراسي، والكبات لمقاومة العزوم السالبة.</p>
          </CardContent>
        </Card>

        <Card className="border border-amber-100 shadow-xs bg-slate-50/40 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-amber-600" />
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">إجمالي مساحات الشدة الخشبية</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">{totalFormwork.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-500">متر مربع (m²)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">تشمل نجارة قاع البلاطات وفرم الجوانب الجانبية المغلقة.</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Control Tool Palette & Advanced Filters */}
      <Card className="border border-slate-200/80 bg-white">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Settings2 className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700">تخصيص لوحة الجدولة:</span>
              
              <div className="h-6 w-px bg-slate-200 mx-1" />

              <div className="flex items-center gap-2">
                <Switch 
                  id="group-slabs-schedule" 
                  checked={groupRows} 
                  onCheckedChange={setGroupRows}
                />
                <Label htmlFor="group-slabs-schedule" className="text-xs font-semibold cursor-pointer">
                  دمج وتجميع العناصر المتماثلة إنشائياً (STA4CAD Grouping)
                </Label>
              </div>
            </div>

            {/* Quick Export Suite */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="xs" variant="outline" className="h-8 gap-1.5 text-slate-700 hover:bg-slate-50 text-xs font-semibold" onClick={handleExportExcel}>
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                تصدير Excel
              </Button>
              <Button size="xs" variant="outline" className="h-8 gap-1.5 text-slate-700 hover:bg-slate-50 text-xs font-semibold" onClick={handleExportCSV}>
                <FileCode2 className="w-3.5 h-3.5 text-cyan-600" />
                تصدير CSV
              </Button>
              <Button size="xs" variant="outline" className="h-8 gap-1.5 text-slate-700 hover:bg-slate-50 text-xs font-semibold" onClick={handleExportHTMLFile}>
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                ملف HTML
              </Button>
              <Button size="xs" variant="outline" className="h-8 gap-1.5 text-slate-700 hover:bg-slate-50 text-xs font-semibold" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                تحويل لـ PDF / طباعة
              </Button>
            </div>
          </div>

          {/* Filtering row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Find Elements text search */}
            <div className="relative">
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="ابحث عن رمز البلاطة أو المحور..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-9 bg-slate-50/50 hover:bg-slate-50/80 border text-xs pr-10 pl-3 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all font-semibold"
              />
            </div>

            {/* Stories List Filter */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 bg-slate-50 text-slate-600 text-[11px] h-8 px-2.5 flex items-center gap-1 border-slate-200">
                <Filter className="w-3 h-3" /> الدور:
              </Badge>
              <select
                value={selectedStoryFilter}
                onChange={e => setSelectedStoryFilter(e.target.value)}
                className="h-8 bg-white border rounded px-1.5 text-xs text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 w-full"
              >
                <option value="ALL">كل الأدوار المتاحة</option>
                {storyOptions.map(stOpt => (
                  <option key={stOpt} value={stOpt}>{stOpt}</option>
                ))}
              </select>
            </div>

            {/* Slab Types Filter */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 bg-slate-50 text-slate-600 text-[11px] h-8 px-2.5 flex items-center gap-1 border-slate-200">
                <LayoutGrid className="w-3 h-3" /> النوع:
              </Badge>
              <select
                value={selectedSlabTypeFilter}
                onChange={e => setSelectedSlabTypeFilter(e.target.value)}
                className="h-8 bg-white border rounded px-1.5 text-xs text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 w-full"
              >
                <option value="ALL">جميع أصناف البلاطات</option>
                {slabTypeOptions.map(slOpt => (
                  <option key={slOpt} value={slOpt}>{slOpt}</option>
                ))}
              </select>
            </div>

            {/* Sort Filter Selector */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0 bg-slate-50 text-slate-600 text-[11px] h-8 px-2.5 flex items-center gap-1 border-slate-200">
                <Settings2 className="w-3 h-3" /> ترتيب حسب:
              </Badge>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="h-8 bg-white border rounded px-1.5 text-xs text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-cyan-500 w-full"
              >
                <option value="id">رقم المعرّف (ID)</option>
                <option value="area">المساحة السطحية</option>
                <option value="thickness">سماكة البلاطة</option>
                <option value="concreteVolume">حجم صب الخرسانة</option>
                <option value="steelWeight">كتلة حديد التسليح</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Slab Schedule Core Data Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-12">
          <Card className="border border-slate-200 shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3.5 px-5">
              <CardTitle className="text-xs font-extrabold text-slate-900 flex justify-between items-center">
                <span>صحيفة جدول تسليح البلاطات الهندسي والتفصيلي</span>
                <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded">عدد العناصر النشطة بالجدول الحالي: {processedRows.length} عناصر</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[1200px]" style={{ direction: 'rtl' }}>
                <TableHeader className="bg-slate-50/50 border-b border-slate-200">
                  <TableRow>
                    <TableHead className="text-right text-xs font-bold text-slate-700 py-3 w-28">رمز البلاطة (ID)</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">الدور</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">الموقع والمحور</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">حجم وسمك البلاطة</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">إجمالي المساحة</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">نوع البلاطة والتحليل</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-700 font-serif">شبكة الحديد السفلي</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-700 font-serif">تسليح الشبكة العلوية</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">حديد التدعيم المضاف</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">الصب (m³)</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">وزن الحديد (kg)</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">الشدة (m²)</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-600">رمز الرسم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center text-slate-400 py-12 text-xs font-semibold">
                        لا توجد بلاطات أو مصنفات للبحث الحالي. يرجى تعديل خيارات الفلترة.
                      </TableCell>
                    </TableRow>
                  ) : (
                    processedRows.map((row) => (
                      <TableRow 
                        key={row.id}
                        className={`hover:bg-cyan-50/20 cursor-pointer border-b border-slate-100 transition-colors ${selectedRowId === row.id ? 'bg-cyan-50/40 font-semibold' : ''}`}
                        onClick={() => setSelectedRowId(row.id)}
                      >
                        <TableCell className="py-3 font-semibold text-cyan-800 text-right pr-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black">{row.name}</span>
                            {row.groupCount > 1 && (
                              <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 text-[9px] hover:bg-cyan-100 px-1 py-0 select-none">
                                ×{row.groupCount}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-600">{row.storyName}</TableCell>
                        <TableCell className="text-center font-mono text-slate-500 text-[11px]">{row.gridLocation}</TableCell>
                        <TableCell className="text-center font-mono text-[11px]">
                          {row.length} × {row.width} m <br />
                          <span className="text-amber-800 font-bold">t = {row.thickness} مم</span>
                        </TableCell>
                        <TableCell className="text-center font-mono text-slate-900 font-bold text-xs">{row.area.toFixed(1)} m²</TableCell>
                        <TableCell className="text-center">
                          <div className="text-slate-800 font-bold text-xs">{row.slabType}</div>
                          <div className="text-slate-400 text-[10px] leading-3">{row.spanDirection}</div>
                        </TableCell>
                        <TableCell className="text-center text-emerald-800 font-bold font-mono text-xs">{row.bottomReinforcement}</TableCell>
                        <TableCell className="text-center text-cyan-800 font-bold font-mono text-xs">{row.topReinforcement}</TableCell>
                        <TableCell className="text-center text-slate-500 text-[11px]">{row.additionalReinforcement}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-xs text-slate-900">{row.concreteVolume.toFixed(3)}</TableCell>
                        <TableCell className="text-center font-mono font-bold text-xs text-violet-800">{row.steelWeight.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono text-xs text-slate-600">{row.formworkArea.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono text-[10px] text-slate-400">{row.detailNum} ({row.sheetNo})</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Graphical Layout & Single Row Interactive Spec Preview */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Validation compliance check */}
        <div className="md:col-span-5">
          <Card className="border border-slate-200">
            <CardHeader className="bg-slate-100/50 py-2.5 px-4 flex flex-row justify-between items-center">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                لوحة فحص ومطابقة اشتراطات الكود والسهم (Compliance Center)
              </CardTitle>
              <Badge className="bg-slate-200 text-slate-800">{validationIssues.length} تنبيهات</Badge>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {validationIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500 mb-2" />
                  <p className="text-xs font-bold text-slate-700">جميع البلاطات مطابقة لمعايير الكود!</p>
                  <p className="text-[10px] text-slate-400 mt-1">تفي سماكات البلاطات واشتراطات السهم المسموح والحديد بتوصيات ACI 318.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {validationIssues.map((issue) => (
                    <div 
                      key={issue.id} 
                      className={`p-3 rounded-lg border text-xs leading-relaxed space-y-1 ${
                        issue.severity === 'high' 
                          ? 'bg-rose-50 border-rose-100 text-rose-900' 
                          : issue.severity === 'medium' 
                          ? 'bg-amber-50 border-amber-100 text-amber-900' 
                          : 'bg-indigo-50 border-indigo-100 text-indigo-900'
                      }`}
                    >
                      <div className="flex justify-between items-center font-bold">
                        <span>البلاطة: [{issue.slabId}]</span>
                        <Badge 
                          className={
                            issue.severity === 'high' 
                              ? 'bg-rose-200 text-rose-900 hover:bg-rose-200' 
                              : issue.severity === 'medium' 
                              ? 'bg-amber-200 text-amber-900 hover:bg-amber-200' 
                              : 'bg-indigo-200 text-indigo-900 hover:bg-indigo-200'
                          }
                        >
                          {issue.severity === 'high' ? 'حرج' : issue.severity === 'medium' ? 'متوسط' : 'توصية'}
                        </Badge>
                      </div>
                      <p className="font-semibold text-[11px]">{issue.message}</p>
                      <div className="border-t border-slate-200/40 pt-1 mt-1 font-mono text-[10px] leading-3 text-slate-500">
                        <span className="font-bold">الحل المقترح:</span> {issue.correctiveAction}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected element interactive properties spec card */}
        <div className="md:col-span-7">
          <Card className="border border-slate-200">
            <CardHeader className="bg-slate-100/50 py-2.5 px-4">
              <CardTitle className="text-xs font-bold text-slate-900 flex justify-between items-center">
                <span>تفاصيل البيانات والمقاطع الإنشائية للبلاطة المحددة</span>
                {activeDetailRow && (
                  <Badge variant="outline" className="bg-cyan-50 text-cyan-800 border-cyan-200 font-mono">
                    {activeDetailRow.name}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {activeDetailRow ? (
                <div className="space-y-4">
                  {/* Detailed specs description list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5 text-xs">
                    {/* Geometry */}
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">أبعاد المخطط الفعلي:</span>
                      <span className="font-mono font-bold text-slate-800">{activeDetailRow.length} × {activeDetailRow.width} أمتار</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">السماكة الإنشائية (Thickness):</span>
                      <span className="font-mono font-bold text-amber-800">{activeDetailRow.thickness} مم</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">منهجية التحليل والتصميم:</span>
                      <span className="font-mono font-bold text-slate-800 text-[11px]">{activeDetailRow.designMethod}</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">آلية السلوك الإنشائي:</span>
                      <span className="font-mono font-bold text-cyan-700">{activeDetailRow.spanDirection}</span>
                    </div>

                    {/* Reinforcements details */}
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">شبكة حديد التسليح السفلي:</span>
                      <span className="font-mono font-extrabold text-emerald-800 text-[13px]">{activeDetailRow.bottomReinforcement}</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">تسليح الغطاء والعلوي:</span>
                      <span className="font-mono font-bold text-cyan-800">{activeDetailRow.topReinforcement}</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">رتبة الخرسانة وحديد التسليح:</span>
                      <span className="font-mono font-semibold text-slate-700">{activeDetailRow.concreteStrength} | {activeDetailRow.steelGrade}</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">الغطاء الخرساني النظيف:</span>
                      <span className="font-mono font-bold text-slate-700">{activeDetailRow.cover} مم</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 sm:col-span-2">
                      <span className="text-slate-500">أطواق حديد الفتحات والصيانة:</span>
                      <span className="font-mono font-medium text-slate-600">{activeDetailRow.openingReinforcement}</span>
                    </div>
                  </div>

                  {/* Micro Section View Vector Illustration */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-400 mb-1.5 font-sans">مقطع تفصيلي توضيحي لبحر البلاطة: {activeDetailRow.name}</span>
                    <svg viewBox="0 0 400 120" className="w-full max-w-sm" style={{ direction: 'ltr' }}>
                      <rect x="10" y="30" width="380" height="50" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
                      
                      {/* Left Column Support */}
                      <rect x="30" y="75" width="25" height="40" fill="#94a3b8" />
                      {/* Right Column Support */}
                      <rect x="345" y="75" width="25" height="40" fill="#94a3b8" />

                      {/* Bottom ongoing steel */}
                      <line x1="15" y1="70" x2="385" y2="70" stroke="#10b981" strokeWidth="3" />
                      <line x1="15" y1="70" x2="15" y2="60" stroke="#10b981" strokeWidth="2" />
                      <line x1="385" y1="70" x2="385" y2="60" stroke="#10b981" strokeWidth="2" />

                      {/* Top steel bars */}
                      <line x1="15" y1="42" x2="80" y2="42" stroke="#ea580c" strokeWidth="2" />
                      <line x1="15" y1="42" x2="15" y2="52" stroke="#ea580c" strokeWidth="2" />
                      
                      <line x1="320" y1="42" x2="385" y2="42" stroke="#ea580c" strokeWidth="2" />
                      <line x1="385" y1="42" x2="385" y2="52" stroke="#ea580c" strokeWidth="2" />

                      {/* Top label text */}
                      <text x="200" y="24" fontSize="8" fill="#475569" fontWeight="bold" textAnchor="middle">Thickness h = {activeDetailRow.thickness}mm</text>
                      <text x="50" y="38" fontSize="6.5" fill="#ea580c" fontWeight="bold" textAnchor="middle">Top Additional</text>
                      <text x="350" y="38" fontSize="6.5" fill="#ea580c" fontWeight="bold" textAnchor="middle">Top Additional</text>
                      <text x="200" y="105" fontSize="8.5" fill="#059669" fontWeight="bold" textAnchor="middle">Bottom: {activeDetailRow.bottomReinforcement}</text>
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-400 py-16 text-xs select-none">
                  اختر أحد صفوف البلاطات بالجدول لمعاينة المقطع ومطابقته الإنشائية.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
};

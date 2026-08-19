import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  TableIcon, 
  Download, 
  FileText, 
  Printer, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Layers3, 
  Settings2,
  RefreshCw,
  Compass
} from 'lucide-react';

import { Column, Story, MatProps } from '../lib/structuralEngine';
import { ColumnScheduleEngine, ColumnScheduleRow, ColumnScheduleValidationIssue } from '../lib/columnScheduleEngine';

import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

interface ColumnScheduleModuleProps {
  columns: Column[];
  stories: Story[];
  colDesigns: Record<string, any>;
  materialProps?: MatProps;
}

export const ColumnScheduleModule: React.FC<ColumnScheduleModuleProps> = ({
  columns,
  stories,
  colDesigns,
  materialProps
}) => {
  // States
  const [groupRows, setGroupRows] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStoryFilter, setSelectedStoryFilter] = useState<string>('ALL');
  const [selectedShapeFilter, setSelectedShapeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'id' | 'height' | 'concreteVolume' | 'steelWeight'>('id');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Generate RAW schedule rows
  const rawRows = useMemo(() => {
    const activeColumns = columns.filter(c => !c.isRemoved);
    return ColumnScheduleEngine.generateSchedule(activeColumns, stories, colDesigns, materialProps);
  }, [columns, stories, colDesigns, materialProps]);

  // Generate validation issues over raw rows
  const validationIssues = useMemo(() => {
    return ColumnScheduleEngine.validateSchedule(rawRows);
  }, [rawRows]);

  // Build story unique filter values
  const storyOptions = useMemo(() => {
    const s = new Set<string>();
    rawRows.forEach(r => {
      if (r.storyName) s.add(r.storyName);
    });
    return Array.from(s);
  }, [rawRows]);

  // Group columns structurally if selected
  const processedRows = useMemo(() => {
    let output = [...rawRows];

    // Filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      output = output.filter(r => 
        r.name.toLowerCase().includes(q) || 
        r.columnId.toLowerCase().includes(q) ||
        r.gridLocation.toLowerCase().includes(q)
      );
    }

    if (selectedStoryFilter !== 'ALL') {
      output = output.filter(r => r.storyName === selectedStoryFilter);
    }

    if (selectedShapeFilter !== 'ALL') {
      output = output.filter(r => r.shape === selectedShapeFilter);
    }

    // Apply grouping if enabled
    if (groupRows) {
      output = ColumnScheduleEngine.groupScheduleRows(output);
    }

    // Sort
    output.sort((a, b) => {
      if (sortBy === 'id') {
        return a.columnId.localeCompare(b.columnId, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'height') {
        return b.height - a.height;
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
  }, [rawRows, groupRows, searchTerm, selectedStoryFilter, selectedShapeFilter, sortBy]);

  // Select first row as default detail
  React.useEffect(() => {
    if (processedRows.length > 0 && !selectedRowId) {
      setSelectedRowId(processedRows[0].id);
    }
  }, [processedRows, selectedRowId]);

  // Active selected row object
  const activeDetailRow = useMemo(() => {
    if (!selectedRowId) return null;
    return rawRows.find(r => r.id === selectedRowId) || processedRows.find(r => r.id === selectedRowId) || null;
  }, [selectedRowId, rawRows, processedRows]);

  // Export to Excel handler
  const handleExportExcel = () => {
    const dataToExport = processedRows.map(r => ({
      'Column ID': r.columnId,
      'Story': r.storyName,
      'Grid Location': r.gridLocation,
      'Shape': r.shape,
      'Width (mm)': r.width,
      'Depth (mm)': r.depth,
      'Height (mm)': r.height,
      'Orientation': r.orientation,
      'Longitudinal Bars': r.barCount,
      'Bar Diameter (mm)': r.barDiameter,
      'Total Steel Area (cm2)': r.totalSteelArea,
      'Ties Description': `Ø${r.tieDiameter} @ ${r.tieSpacing} mm`,
      'Concrete Grade': r.concreteStrength,
      'Steel Grade': r.steelGrade,
      'Concrete vol (m3)': r.concreteVolume,
      'Steel Weight (kg)': r.steelWeight,
      'Formwork Area (m2)': r.formworkArea,
      'Ref Sheet': r.sheetNo,
      'Detail Group Count': r.groupCount
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Column Schedule');
    XLSX.writeFile(wb, `STA4CAD_Column_Schedule_${storyOptions[0] || 'Design'}.xlsx`);
  };

  // Export to CSV handler
  const handleExportCSV = () => {
    const headers = [
      'Column ID', 'Story', 'Grid Location', 'Shape', 'Width', 'Depth', 'Height',
      'Longitudinal Bars', 'Bar Diameter', 'Steel Area', 'Ties spacing', 'Concrete',
      'Steel', 'Concrete vol', 'Steel wt', 'Formwork', 'Sheet', 'Group Count'
    ];
    const rows = processedRows.map(r => [
      r.columnId, r.storyName, r.gridLocation, r.shape, r.width, r.depth, r.height,
      r.barCount, r.barDiameter, r.totalSteelArea, r.tieSpacing, r.concreteStrength,
      r.steelGrade, r.concreteVolume, r.steelWeight, r.formworkArea, r.sheetNo, r.groupCount
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "STA4CAD_Column_Schedule.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print system handler
  const handlePrint = () => {
    const prWindow = window.open('', '_blank');
    if (!prWindow) return;
    
    prWindow.document.write(`
      <html>
        <head>
          <title>STA4CAD Printable Column Schedule (Phase D6B)</title>
          <style>
            body { font-family: system-ui, sans-serif; direction: rtl; text-align: right; margin: 0; padding: 45px; color: #1e293b; background: white; }
            h1 { font-size: 20px; font-weight: bold; margin-bottom: 5px; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right; }
            th { background-color: #f1f5f9; font-weight: bold; }
            .header-meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 24px; color: #475569; }
            .footer { margin-top: 50px; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>جدول تسليح وأقطار الأعمدة الخرسانية النموذجية (Column Schedule System)</h1>
          <div class="header-meta">
            <div><strong>نظام التصميم:</strong> STA4CAD D6B Integration</div>
            <div><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>رقم العمود (ID)</th>
                <th>الدور (Story)</th>
                <th>محور التقاطع</th>
                <th>القطاع (b x h mm)</th>
                <th>الشكل</th>
                <th>تسليح طولي</th>
                <th>التربيط العرضي (الكانات)</th>
                <th>الخرسانة (fc)</th>
                <th>منسوب الارتفاع (L)</th>
                <th>مكعب الصب (m&sup3;)</th>
                <th>وزن الحديد (kg)</th>
                <th>الشدة الخشبية (m&sup2;)</th>
                <th>المجموعة</th>
              </tr>
            </thead>
            <tbody>
              ${processedRows.map(row => `
                <tr>
                  <td><strong>${row.name}</strong></td>
                  <td>${row.storyName}</td>
                  <td>${row.gridLocation}</td>
                  <td>${row.width} x ${row.depth}</td>
                  <td>${row.shape === 'Rectangular' ? 'مستطيل' : row.shape === 'Square' ? 'مربع' : 'دائري'}</td>
                  <td><strong>${row.barCount} Ø ${row.barDiameter}</strong></td>
                  <td>Ø ${row.tieDiameter} @ ${row.tieSpacing}</td>
                  <td>${row.concreteStrength}</td>
                  <td>${(row.height / 1000).toFixed(2)} m</td>
                  <td>${row.concreteVolume.toFixed(3)}</td>
                  <td>${row.steelWeight.toFixed(2)}</td>
                  <td>${row.formworkArea.toFixed(2)}</td>
                  <td><sup>x</sup>${row.groupCount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="footer">* شيت تفصيل وتفريد الحديد يتبع الـ BBS والكود الهندسي المعتمد ACI 318.</p>
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
      
      {/* Title & Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-3 gap-3">
        <div className="flex items-center gap-2">
          <Layers3 className="w-5 h-5 text-cyan-600 animate-spin" style={{ animationDuration: '4s' }} />
          <div>
            <h3 className="text-base font-bold text-slate-900">نظام مجدول الأعمدة الهندسي (STA4CAD Column Schedule)</h3>
            <p className="text-xs text-slate-500 mt-0.5">جدولة شاملة للقطاعات، حديد التسليح، والكميات الإنشائية مع مطابقة تلقائية لقواعد التصميم والـ BBS.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-end">
          <Badge className="bg-cyan-100 text-cyan-800 font-bold border-cyan-200">Phase D6B - فعال</Badge>
          <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-200">
            إجمالي الأعمدة: {rawRows.length} عمود
          </Badge>
        </div>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono text-left">Total Concrete Volume</span>
          <div className="text-lg font-bold text-slate-900 font-mono text-left">
            {processedRows.reduce((acc, row) => acc + row.concreteVolume, 0).toFixed(3)} <span className="text-xs font-normal">m&sup3;</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-none">مكعبات خرسانة الأعمدة المطلوبة بالكامل</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono text-left">Total Steel Weight</span>
          <div className="text-lg font-bold text-indigo-700 font-mono text-left">
            {processedRows.reduce((acc, row) => acc + row.steelWeight, 0).toFixed(2)} <span className="text-xs font-normal">kg</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-none">إجمالي كميات حديد التسليح المستهلك بالأعمدة</p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono text-left">Total Formwork Area</span>
          <div className="text-lg font-bold text-amber-700 font-mono text-left">
            {processedRows.reduce((acc, row) => acc + row.formworkArea, 0).toFixed(2)} <span className="text-xs font-normal">m&sup2;</span>
          </div>
          <p className="text-[9px] text-slate-400 leading-none">طوبار الخشب والشدات المعدنية الرأسية</p>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-emerald-800 block uppercase font-mono text-left">Schedules Export</span>
          <div className="flex gap-1 justify-start pt-1.5">
            <Button
              size="xs"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] h-6 px-2 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Excel
            </Button>
            <Button
              size="xs"
              onClick={handleExportCSV}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] h-6 px-2 flex items-center gap-1"
            >
              <FileText className="w-3 h-3 text-cyan-300" />
              CSV
            </Button>
            <Button
              size="xs"
              onClick={handlePrint}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] h-6 px-1.5 flex items-center"
            >
              <Printer className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid Layout: Controls / Validation and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left column: Controls & Preview Frame */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Controls Panel */}
          <Card className="border border-slate-200 shadow-xs bg-white">
            <CardHeader className="py-2.5 px-3 bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-center">
              <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Settings2 className="w-3.5 h-3.5 text-cyan-600" />
                خيارات تصفية وتجميع STA4CAD
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3.5 text-xs">
              
              {/* Group identical rows switch */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold text-slate-700">تجميع الأعمدة المتطابقة</Label>
                  <p className="text-[10px] text-slate-500">ميزة Grouping لضغط الشيتات وتنظيم التفريد</p>
                </div>
                <Switch
                  checked={groupRows}
                  onCheckedChange={setGroupRows}
                  aria-label="تجميع الأعمدة"
                />
              </div>

              {/* Search Control */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">البحث بالرمز والأكواد</label>
                <div className="relative">
                  <Search className="absolute right-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="ابحث عن C1، المحور، إلخ..."
                    className="w-full h-8 right-2 pl-3 pr-8 border rounded-lg bg-slate-50 text-xs focus:ring-1 focus:ring-cyan-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Story Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">تصفية حسب منسوب الطابق</label>
                <select
                  value={selectedStoryFilter}
                  onChange={e => setSelectedStoryFilter(e.target.value)}
                  className="w-full h-8 px-2.5 border rounded-lg bg-slate-50 text-xs focus:bg-white outline-none"
                >
                  <option value="ALL">جميع المستويات (ALL)</option>
                  {storyOptions.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Sort selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">الترتيب حسب</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="w-full h-8 px-2.5 border rounded-lg bg-slate-50 text-xs focus:bg-white outline-none"
                >
                  <option value="id">رقم معرّف العمود (ID)</option>
                  <option value="height">الارتفاع الكلي (L)</option>
                  <option value="concreteVolume">حجم صب الخرسانة</option>
                  <option value="steelWeight">الوزن التقديري للحديد</option>
                </select>
              </div>

            </CardContent>
          </Card>

          {/* Validation issue engine checker */}
          <Card className="border border-slate-200 shadow-xs bg-white">
            <CardHeader className="py-2.5 px-3 bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-center">
              <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                مكتشف الأخطاء الإنشائية والفنية ({validationIssues.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 text-xs max-h-[180px] overflow-y-auto space-y-2">
              {validationIssues.length === 0 ? (
                <div className="flex gap-2 items-center bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-semibold text-[11px]">مكتمل البناء! لا توجد عثرات أو مفقودات في تسليح المقطع.</span>
                </div>
              ) : (
                validationIssues.map(issue => (
                  <div key={issue.id} className={`p-2.5 border rounded-lg space-y-1.5 text-[11px] text-right ${
                    issue.severity === 'high' ? 'bg-red-50/70 border-red-150 text-red-900' :
                    issue.severity === 'medium' ? 'bg-amber-50/70 border-amber-150 text-amber-900' :
                    'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <div className="flex justify-between items-center font-bold">
                      <span>العمود: {issue.columnId}</span>
                      <span className="text-[10px] font-mono font-bold uppercase">{issue.category}</span>
                    </div>
                    <p className="text-slate-600 font-medium">{issue.message}</p>
                    <div className="font-mono text-[10px] text-cyan-800 pt-0.5 border-t border-dashed border-current/20">
                      <strong>الإجراء:</strong> {issue.correctiveAction}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Detailed SVG Profile block */}
          {activeDetailRow && (
            <Card className="border border-slate-200 bg-white">
              <CardHeader className="py-2 px-3 bg-slate-50 border-b border-slate-100">
                <CardTitle className="text-xs font-bold text-slate-700">تفاصيل مقطع العمود {activeDetailRow.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5 text-xs text-right">
                
                {/* Embedded SVG dynamic visualizer */}
                <div className="flex justify-center bg-slate-50/50 border rounded-xl p-3">
                  <svg viewBox="0 0 160 160" className="w-[125px] h-[125px] p-2" style={{ direction: 'ltr' }}>
                    <rect x="20" y="20" width="120" height="120" fill="#cbd5e1" stroke="#475569" strokeWidth="2.5" rx="3" />
                    <rect x="30" y="30" width="100" height="100" fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="1.5, 1.5" />
                    
                    {/* Circle rebars inside */}
                    <circle cx="34" cy="34" r="5.5" fill="#1e293b" />
                    <circle cx="106" cy="34" r="5.5" fill="#1e293b" />
                    <circle cx="34" cy="106" r="5.5" fill="#1e293b" />
                    <circle cx="106" cy="106" r="5.5" fill="#1e293b" />
                    
                    {activeDetailRow.barCount > 4 && (
                      <>
                        <circle cx="70" cy="34" r="5.5" fill="#1e293b" />
                        <circle cx="70" cy="106" r="5.5" fill="#1e293b" />
                      </>
                    )}
                    {activeDetailRow.barCount > 6 && (
                      <>
                        <circle cx="34" cy="70" r="5.5" fill="#1e293b" />
                        <circle cx="106" cy="70" r="5.5" fill="#1e293b" />
                      </>
                    )}

                    {/* Dimensions details labels */}
                    <text x="80" y="15" fontSize="8.5" textAnchor="middle" fill="#475569" fontWeight="bold">b = {activeDetailRow.width} mm</text>
                    <text x="5" y="80" fontSize="8.5" textAnchor="middle" fill="#475569" fontWeight="bold" transform="rotate(-90 5 80)">h = {activeDetailRow.depth} mm</text>
                  </svg>
                </div>

                <div className="space-y-2 border-t pt-2 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">التسليح الطولي:</span>
                    <span className="font-bold text-slate-800">{activeDetailRow.barCount} Ø {activeDetailRow.barDiameter}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">مساحة مقطع الحديد:</span>
                    <span className="font-mono text-cyan-700 font-bold">{activeDetailRow.totalSteelArea} cm&sup2;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">التربيط العرضي (الكانات):</span>
                    <span className="font-medium text-amber-700 font-mono">{activeDetailRow.confinementZones}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">رتبة الخرسانة:</span>
                    <span className="font-bold text-slate-700">{activeDetailRow.concreteStrength}</span>
                  </div>
                </div>

              </CardContent>
            </Card>
          )}

        </div>

        {/* Right column: Main table view */}
        <div className="lg:col-span-8 space-y-3">
          
          <div className="border border-border/80 rounded-xl overflow-hidden shadow-xs bg-white text-xs">
            <Table className="text-right">
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="text-right font-bold text-slate-700 py-3">رمز العمود (Column ID)</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 py-3">المنسوب</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 py-3">المحاور (Grid)</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 py-3">القطاع (b x h)</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 py-3 text-cyan-800">التسليح الطولي</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 py-3 text-amber-800">الكانات والخطوات</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 py-3 font-mono">الخرسانة (m&sup3;)</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 py-3 font-mono">الحديد (kg)</TableHead>
                  <TableHead className="text-right font-bold text-slate-700 py-3">الشيت</TableHead>
                  {groupRows && <TableHead className="text-right font-bold text-rose-700 py-3">العدد</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={groupRows ? 10 : 9} className="text-center py-10 text-slate-400 font-medium">
                      لا تتوفر أية أعمدة نشطة مطابقة لشروط التصفية المفروضة.
                    </TableCell>
                  </TableRow>
                ) : (
                  processedRows.map(row => (
                    <TableRow 
                      key={row.id} 
                      onClick={() => setSelectedRowId(row.id)}
                      className={`hover:bg-slate-50/60 cursor-pointer transition-colors ${
                        selectedRowId === row.id ? 'bg-cyan-50/40 border-r-4 border-r-cyan-500' : ''
                      }`}
                    >
                      <TableCell className="font-bold text-cyan-900 py-2.5">{row.name}</TableCell>
                      <TableCell className="text-slate-500">{row.storyName}</TableCell>
                      <TableCell className="font-medium text-slate-600">{row.gridLocation}</TableCell>
                      <TableCell className="font-mono font-bold text-slate-700">{row.width} x {row.depth}</TableCell>
                      <TableCell className="font-bold text-cyan-700">{row.barCount} Ø {row.barDiameter}</TableCell>
                      <TableCell className="text-amber-700 font-medium font-mono">Ø {row.tieDiameter} @ {row.tieSpacing}</TableCell>
                      <TableCell className="font-mono text-slate-600">{row.concreteVolume.toFixed(3)}</TableCell>
                      <TableCell className="font-mono font-bold text-indigo-800">{row.steelWeight.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-slate-500">{row.sheetNo}</TableCell>
                      {groupRows && (
                        <TableCell className="font-mono font-bold text-slate-900 bg-slate-50/50">
                          x {row.groupCount}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex gap-2.5 items-start">
            <Info className="w-5 h-5 text-cyan-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-right">
              <span className="font-bold text-slate-800 block">إشعار الجدولة الهندسية المتزامنة:</span>
              <p className="text-slate-500 leading-relaxed font-medium">
                شيت مجدول وتفاصيل الأعمدة يتزامن بطريقة فورية (Auto-Sync) مع لوحات التسليح الرأسي، شيتات تفريد الحديد (BBS)، وجداول حصر كميات الخرسانات وحديد التسليح الكلية. عند تحديث أي عمود إما عبر شاشة الخصائص أو الفئات الإنشائية، تدار المقادير وتحديثها ديناميكياً.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

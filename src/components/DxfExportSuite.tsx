import React, { useState, useMemo, useEffect } from 'react';
import { 
  DxfExportAdvanceEngine, 
  INITIAL_CAD_LAYERS, 
  CAD_VERSION_MAP, 
  DxfLayerInfo, 
  CustomDxfVersion, 
  CadQaReport 
} from '../lib/dxfExportAdvanceEngine';
import { 
  Sliders, 
  Layers3, 
  Download, 
  Check, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles, 
  Eye, 
  Settings2, 
  Terminal, 
  ShieldCheck, 
  FileText, 
  HelpCircle,
  Copy
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import type { Story, Beam, Column, Slab } from '../lib/structuralEngine';

interface DxfExportSuiteProps {
  stories: Story[];
  beams: Beam[];
  columns: Column[];
  slabs: Slab[];
  projectName?: string;
  notes?: string[];
}

export function DxfExportSuite({
  stories = [],
  beams = [],
  columns = [],
  slabs = [],
  projectName = 'مشروع فيلا سكنية مبسطة',
  notes = []
}: DxfExportSuiteProps) {
  
  // 1. Interactive States
  const [selectedVersion, setSelectedVersion] = useState<CustomDxfVersion>('2013');
  const [rtlMode, setRtlMode] = useState<boolean>(true);
  const [layers, setLayers] = useState<Record<string, DxfLayerInfo>>({ ...INITIAL_CAD_LAYERS });
  
  // Entity selectors
  const [options, setOptions] = useState({
    grids: true,
    slabs: true,
    beams: true,
    columns: true,
    details: true,
    schedules: true,
    rebar: true,
    dimensions: true,
    titleBlock: true,
    notes: true,
  });

  const [activeTab, setActiveTab] = useState<'config' | 'layers' | 'qa' | 'terminal'>('config');
  const [dxfOutputStr, setDxfOutputStr] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Initialize engine & compile DXF sequence
  const engine = useMemo(() => {
    const eng = new DxfExportAdvanceEngine(selectedVersion, layers, options);
    eng.setRtlArabicMode(rtlMode);
    return eng;
  }, [selectedVersion, layers, options, rtlMode]);

  useEffect(() => {
    // Regenerate DXF output preview
    const dxf = engine.generateFullPackage({ stories, beams, columns, slabs, notes });
    setDxfOutputStr(dxf);
  }, [engine, stories, beams, columns, slabs, notes]);

  // Run compliance diagnostic scan
  const qaReport = useMemo<CadQaReport>(() => {
    return engine.verifyCadCompliance({ stories, beams, columns, slabs, notes });
  }, [engine, stories, beams, columns, slabs, notes]);

  const handleUpdateLayer = (key: string, field: keyof DxfLayerInfo, val: any) => {
    setLayers(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: val
      }
    }));
  };

  const toggleOption = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Safe file downloader
  const downloadCombinedDxf = () => {
    const filename = `${projectName.replace(/\s+/g, '_')}_Master_AutoCAD_${selectedVersion}.dxf`;
    const blob = new Blob([dxfOutputStr], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // One DXF file per story export layout strategy
  const downloadDxfPerStory = (story: Story) => {
    const storyId = story.id;
    const sSlabs = slabs.filter(s => s.storyId === storyId);
    const sBeams = beams.filter(b => b.storyId === storyId);
    const sCols = columns.filter(c => c.storyId === storyId);

    const singleStoryEngine = new DxfExportAdvanceEngine(selectedVersion, layers, options);
    singleStoryEngine.setRtlArabicMode(rtlMode);

    const dxf = singleStoryEngine.generateFullPackage({
      stories: [story],
      beams: sBeams,
      columns: sCols,
      slabs: sSlabs,
      notes: notes
    });

    const filename = `${projectName.replace(/\s+/g, '_')}_${story.label.replace(/\s+/g, '_')}_CAD.dxf`;
    const blob = new Blob([dxf], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(dxfOutputStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Color index mappings to visual colors for styling in preview
  const getLayerColorHex = (idx: number) => {
    switch (idx) {
      case 1: return '#ef4444'; // red
      case 2: return '#eab308'; // yellow
      case 3: return '#22c55e'; // green
      case 4: return '#06b6d4'; // cyan
      case 5: return '#3b82f6'; // blue
      case 6: return '#d946ef'; // magenta
      case 7: return '#64748b'; // slate/white
      case 8: return '#94a3b8'; // gray
      case 9: return '#cbd5e1'; // light gray
      default: return '#1e293b';
    }
  };

  return (
    <div className="space-y-6 font-sans text-right" style={{ direction: 'rtl' }}>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-cyan-900 to-slate-900 rounded-2xl text-white shadow-lg border border-cyan-950">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-1.5 bg-cyan-700/60 rounded text-[10px] font-mono font-bold tracking-wider text-cyan-200">PHASE D8</span>
            <h2 className="text-lg font-bold">جناح تصدير وتدقيق ملفات الأوتوكاد (AutoCAD DXF Exporter)</h2>
          </div>
          <p className="text-xs text-slate-300">
            تجهيز وتوليد خرائط ومخططات إنشائية متطابقة ١٠٠٪ مع معايير AutoCAD بالطبقات والرموز التفصيلية وكود التسليح والمحاور.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={downloadCombinedDxf} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-4 h-10 gap-2 rounded-xl transition duration-200">
            <Download className="w-4 h-4" />
            تحميل المخطط الإجمالي (DXF)
          </Button>
          <Button onClick={handleCopyToClipboard} variant="outline" className="border-cyan-800 text-cyan-200 hover:bg-cyan-950 font-semibold text-xs px-4 h-10 gap-2 rounded-xl transition duration-200">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            نسخ الكود المصدري
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Parameters Config & Layers Selection */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-slate-200/80 shadow-md">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-600" />
                  محددات وإعدادات كود التصدير القياسي
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500 mt-1">تعديل إصدار التصدير وتفعيل الخصائص المتقدمة لمواءمة الأوتوكاد</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              
              {/* Quick Tab Selector for Left Section */}
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl mb-4 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('config')}
                  className={`flex-1 py-2 text-center rounded-lg font-bold transition duration-150 ${activeTab === 'config' ? 'bg-white text-cyan-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  تجهيز المحتوى والعناصر
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('layers')}
                  className={`flex-1 py-2 text-center rounded-lg font-bold transition duration-150 ${activeTab === 'layers' ? 'bg-white text-cyan-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  إدارة طبقات المشروع (Layers)
                </button>
              </div>

              {activeTab === 'config' && (
                <div className="space-y-4">
                  {/* Select CAD Version */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">إصدار ملف الخرائط (DXF Version):</label>
                      <select 
                        value={selectedVersion} 
                        onChange={(e) => setSelectedVersion(e.target.value as CustomDxfVersion)}
                        className="w-full text-xs h-9 bg-white border border-slate-200 rounded-xl px-2.5 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                      >
                        {Object.entries(CAD_VERSION_MAP).map(([ver, { label }]) => (
                          <option key={ver} value={ver}>{label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">محاذاة النصوص العربية (Arabic RTL Fit):</label>
                      <div className="flex items-center gap-2 h-9">
                        <button
                          type="button"
                          onClick={() => setRtlMode(true)}
                          className={`flex-1 text-center h-full text-xs font-bold rounded-xl transition duration-150 border ${rtlMode ? 'bg-cyan-50 border-cyan-300 text-cyan-900' : 'border-slate-200 text-slate-500'}`}
                        >
                          RTL معكوس (للكاد الكلاسيكي)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRtlMode(false)}
                          className={`flex-1 text-center h-full text-xs font-bold rounded-xl transition duration-150 border ${!rtlMode ? 'bg-cyan-50 border-cyan-300 text-cyan-900' : 'border-slate-200 text-slate-500'}`}
                        >
                          Unicode ترميز معاصر
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Included Drawing Package Elements Filter */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-800">مكونات مخططات الطباعة والتصدير الشاملة:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'grids', label: 'المحاور والفقاعات (Grids)', desc: 'خطوط الشبكة المحورية والترقيم العائم' },
                        { key: 'slabs', label: 'سطوح البلاطات (Slabs)', desc: 'قوالب وحدود الأسقف الخرسانية' },
                        { key: 'beams', label: 'الجسور الإنشائية (Beams)', desc: 'مسارات الجسور وأبعادها التصميمية' },
                        { key: 'columns', label: 'الأعمدة الإنشائية (Columns)', desc: 'قطاعات الأعمدة وصناديق التوصيف الكلاسيكي' },
                        { key: 'rebar', label: 'حديد التسليح (Rebars)', desc: 'كودات الإضافي السفلي والعلوي والكانات' },
                        { key: 'dimensions', label: 'سلاسل الأبعاد (Dimensions)', desc: 'شبكات الأبعاد الموازية والخطية للبنيان' },
                        { key: 'titleBlock', label: 'رأس اللوحة الفنية (Title Block)', desc: 'معلومات المالك، المشروع والمصمم الاستشاري' },
                        { key: 'notes', label: 'جدول الاشتراطات والمnotes', desc: 'مواصفات المقاومة المميزةfc والحديد' },
                      ].map((item) => {
                        const isChecked = options[item.key as keyof typeof options];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => toggleOption(item.key as keyof typeof options)}
                            className={`p-2.5 rounded-xl border text-right transition duration-200 ${isChecked ? 'bg-cyan-50/50 border-cyan-200/80 text-cyan-950' : 'bg-slate-50/40 border-slate-100 text-slate-400'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold">{item.label}</span>
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center transition duration-150 ${isChecked ? 'bg-cyan-600 text-white' : 'border border-slate-300'}`}>
                                {isChecked && <Check className="w-2.5 h-2.5" />}
                              </div>
                            </div>
                            <span className="text-[10px] leading-tight block text-slate-500/90">{item.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* One DXF per story downloader list */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold text-slate-800">تصدير لوحة منفردة لكل دور (One DXF per Story):</h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      بإمكانك تجزئة مخططات المبنى بشكل آمن لتنزيل ملف أوتوكاد مستقل لكل سقف بضغطة زر واحدة بحدود وإحداثيات نموذجية دقيقة.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {stories.map((st) => (
                        <Button
                          key={st.id}
                          variant="outline"
                          size="sm"
                          onClick={() => downloadDxfPerStory(st)}
                          className="h-8 text-[11px] font-bold border-cyan-200 text-cyan-950 hover:bg-cyan-100/50 gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-cyan-700" />
                          الأوتوكاد: {st.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'layers' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500 leading-normal mb-1">
                    بإمكانك تغيير اسم الطبقة ولونها (رقم اللون المعتمد في نظام AutoCAD ACI) المخصصة للتصدير لتطابق القالب الفني الموحد الخاص بمكتبكم الاستشاري.
                  </p>
                  
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2.5">الطبقة الوظيفية</th>
                          <th className="p-2.5">اسم الطبقة بالكاد</th>
                          <th className="p-2.5 text-center">رقم اللون (ACI)</th>
                          <th className="p-2.5 text-center">نوع الخط</th>
                          <th className="p-2.5 text-center">تصدير</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(layers).map(([key, layer]) => (
                          <tr key={key} className="hover:bg-slate-50/55">
                            <td className="p-2.5 font-bold text-[11px] text-slate-700">{key}</td>
                            <td className="p-2.5">
                              <Input
                                value={layer.name}
                                onChange={(e) => handleUpdateLayer(key, 'name', e.target.value)}
                                className="h-7 text-[11px] px-2 font-mono"
                              />
                            </td>
                            <td className="p-2.5 flex items-center justify-center gap-2">
                              <select
                                value={layer.color}
                                onChange={(e) => handleUpdateLayer(key, 'color', parseInt(e.target.value))}
                                className="h-7 text-[11px] bg-white border border-slate-200 rounded px-1 outline-none font-mono text-center"
                              >
                                {[1,2,3,4,5,6,7,8,9,30,40,42].map(clr => (
                                  <option key={clr} value={clr}>{clr} (Color)</option>
                                ))}
                              </select>
                              <span className="w-3.5 h-3.5 rounded border border-slate-300" style={{ backgroundColor: getLayerColorHex(layer.color) }}></span>
                            </td>
                            <td className="p-2.5 text-center font-mono text-[10px]">
                              {layer.lineType}
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={layer.exportable}
                                onChange={(e) => handleUpdateLayer(key, 'exportable', e.target.checked)}
                                className="rounded text-cyan-600 focus:ring-cyan-500 h-3.5 w-3.5 cursor-pointer"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* Right Side: QA/QC Verification Report & Console Preview */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. QA/QC Compliance Dashboard */}
          <Card className="border border-slate-200 shadow-md">
            <CardHeader className="pb-3 border-b border-rose-100 bg-rose-50/40 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black text-rose-950 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  وحدة الفحص وتأكيد الجودة الإنشائية (CAD QA/QC)
                </CardTitle>
                <div className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${qaReport.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {qaReport.status === 'PASSED' ? 'مطابق للكود' : 'بحاجة لمراجعة'}
                </div>
              </div>
              <CardDescription className="text-[10px] text-slate-500 mt-1">
                يفحص هذا المعالج تلقائياً تقاطع الطبقات، وسلامة المراجع، ومطابقة كود البناء السعودي.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              
              {/* Stats overview */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <span className="block text-[9px] text-slate-500 font-bold">العناصر المصدرة</span>
                  <span className="text-base font-extrabold text-cyan-700 font-mono">{qaReport.totalEntities}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <span className="block text-[9px] text-slate-500 font-bold">تداخلات الهندسة</span>
                  <span className="text-base font-extrabold text-slate-700 font-mono">{qaReport.entityOverlaps}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <span className="block text-[9px] text-slate-500 font-bold">طبقات غير معرفة</span>
                  <span className="text-base font-extrabold text-rose-600 font-mono">{qaReport.unmappedLayers.length}</span>
                </div>
              </div>

              {/* Status report blocks */}
              {qaReport.warnings.length > 0 ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>تنبيهات وملاحظات الصياغة بالكاد:</span>
                  </div>
                  <ul className="list-disc list-inside text-[10px] space-y-1 text-right leading-relaxed pr-1">
                    {qaReport.warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-2.5 rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-[11px] font-bold">كود المخطط متكامل ومرتب تماماً، ومؤهل للطباعة المباشرة!</span>
                </div>
              )}

              {/* Recommendations list */}
              <div className="space-y-1.5">
                <h5 className="text-[11px] font-extrabold text-slate-800">توصيات إعداد اللوحات والمطابقة البلدية:</h5>
                <ul className="text-[10px] text-slate-500 list-decimal list-inside space-y-1 pr-1 leading-relaxed">
                  {qaReport.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                  <li>تأكد من اختيار نفس الـ (Scale) لمطابقة قراءة الأبعاد الخطية مع المخطط المعماري الملحق.</li>
                </ul>
              </div>

            </CardContent>
          </Card>

          {/* 2. Raw DXF Terminal Preview */}
          <Card className="border border-slate-200 shadow-md">
            <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-600" />
                  معاينة كود DXF المصدري للأقسام
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-400">فحص أسطر الكود والطبقات المعرفة في ملف التصدير</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[9px]">
                {((dxfOutputStr.length * 2) / 1024).toFixed(1)} KB
              </Badge>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="p-3 bg-slate-950 rounded-xl text-left font-mono text-[10px] text-emerald-400 max-h-[160px] overflow-y-auto scrollbar-thin overflow-x-hidden select-all leading-relaxed whitespace-pre" style={{ direction: 'ltr' }}>
                {dxfOutputStr.slice(0, 1600) + "\n...\n0\nEOF\n"}
              </div>
              <p className="text-[10px] text-slate-400 leading-normal mt-2 text-right">
                يعرض هذا المنفذ مقطعاً من كود ASCII المصدري لملفات الأوتوكاد. الكود مدعوم تلقائياً بكلمات البحث وجداول الطبقات السريعة المتوافقة.
              </p>
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}

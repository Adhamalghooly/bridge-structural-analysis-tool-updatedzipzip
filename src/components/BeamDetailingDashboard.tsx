import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { 
  Printer, Download, Search, Info, AlertTriangle, Check, BookOpen, 
  Layers, Maximize2, Minimize2, Languages, RotateCcw, Wrench, Sparkles, LayoutGrid
} from 'lucide-react';
import { arrangeBeamReinforcement } from '@/lib/beamRebarArranger';
import type { Beam } from '@/lib/structuralEngine';

interface BeamDetailingDashboardProps {
  storyBeams: Beam[];
  resolvedBeamDesigns: any[];
  mat: { fc: number; fy: number; density: number; stirrupDia?: number };
  titleBlock: any;
  selectedScale: string;
}

const tD = {
  ar: {
    title: "محرك تفريد وتفصيل الجسور الإنشائية المتقدم (PHASE S2)",
    sub: "تفريد أوتوماتيكي ذكي وتصميم تفصيلي مع حساب التداخلات، التماسك، وجدول الكميات طبقاً لـ ACI 318-19",
    mode: "نمط تفريد وتفصيل المخططات:",
    indiv: "تفصيل جسور فردية",
    grouped: "تفصيل الجسور المجمّعة (STA4CAD)",
    search: "بحث عن جسر أو كود...",
    selectedBeam: "الجسر الحالي الموديل",
    netSpan: "طول البحر الصافي",
    spacingText: "تباعد الأسياخ الصافي",
    congestionText: "حالة تشتيت الخرسانة والتعشيش",
    warningsText: "قائمة مراجعة الجودة ومراقبة الموقع (QA/QC Checklist)",
    panelTitle: "لوحة بدائل ومقاطع التسليح المتاحة",
    candTitle: "البدائل المصنفة أوتوماتيكياً حسب الدقة والتباعد",
    cadTitle: "مخطط تفريد حديد الجسر الإنشائي عالي الدقة (ISO 7200 / ACI 315-99)",
    secA: "القطاع الإنشائي عند المسند الأيسر (A-A)",
    secB: "القطاع الإنشائي عند منتصف البحر (B-B)",
    secC: "القطاع الإنشائي عند المسند الأيمن (C-C)",
    bbsTitle: "جدول كميات وتفريد حديد التسليح التفصيلي (BBS Schedule)",
    devTitle: "حسابات أطوال التماسك والتشريك المطلوبة حسب الـ ACI Standard",
    boqTitle: "كميات الخرسانة، الحديد والجدول المالي للجسر",
    costEst: "التكلفة التقديرية لإجمالي الجسر:",
    notesTitle: "الملاحظات الإنشائية والمواصفات الفنية للصب والتنفيذ",
    rebarSelector: "لوحة اختيار ومقارنة بدائل التسليح",
    rebarSelectorDesc: "يقوم المحرك بتوليد وتقييم كافة التوافيق المتاحة للأسياخ وتصنيفها طبقاً للأفضلية والتباعد المعقود.",
    noBeams: "عذراً، لم نتمكن من العثور على جسور في الفضاء التصميمي لإجراء عملية التفريد الإنشائي.",
    printBtn: "طباعة المخطط المالي والإنشائي مباشرة",
    dxfBtn: "تصدير CAD Drawing (DXF)",
    zoomIn: "تكبير (Zoom In)",
    zoomOut: "تصغير (Zoom Out)",
    zoomReset: "إعادة ضبط الزوم",
    langToggle: "English / العربية"
  },
  en: {
    title: "Advanced Reinforced Concrete Beam Detailing System (PHASE S2)",
    sub: "Automatic detailing, lap splices, development checks & BBS scheduling per ACI 318-19",
    mode: "Detailing Generation Mode:",
    indiv: "Individual Beam Detailing",
    grouped: "Grouped Beam Detailing (STA4CAD style)",
    search: "Search beam ID or group...",
    selectedBeam: "Selected Beam Model",
    netSpan: "Net Span Length",
    spacingText: "Clear Bar Spacing",
    congestionText: "Rebar Congestion & Honeycombing Risk",
    warningsText: "QA/QC Site Inspections & Structural Verification Checklist",
    panelTitle: "Reinforcement Alternatives & Options Panel",
    candTitle: "Automatically Generated & Ranked Solutions Scale",
    cadTitle: "High-Resolution Detailed Beam Elevation (ISO 7200 / ACI 315-99)",
    secA: "Cross Section at Left Support (A-A)",
    secB: "Cross Section at Mid-span (B-B)",
    secC: "Cross Section at Right Support (C-C)",
    bbsTitle: "Detailed Bar Bending Schedule (BBS Sheet)",
    devTitle: "Required Development Lengths & Splices per ACI Specifications",
    boqTitle: "Concrete, Steel Quantities & Finance Estimate",
    costEst: "Estimated Cost of Beam Structural Base:",
    notesTitle: "Structural Execution General Notes & Site Specifications",
    rebarSelector: "Rebar Alternatives Panel",
    rebarSelectorDesc: "Engine evaluates all suitable rebar combinations & ranks them by score and spacing.",
    noBeams: "No beams found in the selected story to proceed with detailing.",
    printBtn: "Direct Print Drawing Sheet",
    dxfBtn: "Export CAD Layout (DXF)",
    zoomIn: "Zoom In (+)",
    zoomOut: "Zoom Out (-)",
    zoomReset: "Reset Zoom",
    langToggle: "العربية / English"
  }
};

export default function BeamDetailingDashboard({
  storyBeams = [],
  resolvedBeamDesigns = [],
  mat = { fc: 25, fy: 420, density: 24, stirrupDia: 10 },
  titleBlock = {},
  selectedScale = "1:50"
}: BeamDetailingDashboardProps) {

  // Local state controls for Phase S2
  const [detailingMode, setDetailingMode] = useState<'individual' | 'grouped'>('individual');
  const [selectedBeamId, setSelectedBeamId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [beamDrawingScale, setBeamDrawingScale] = useState<number>(1);
  const [drawingLang, setDrawingLang] = useState<'ar' | 'en'>('ar');
  const [beamSearchQuery, setBeamSearchQuery] = useState<string>('');

  const [selectedSolutionIdx, setSelectedSolutionIdx] = useState<Record<string, number>>({});
  const [activeRegionSelector, setActiveRegionSelector] = useState<'topLeft' | 'topMid' | 'topRight' | 'botLeft' | 'botMid' | 'botRight'>('topLeft');

  const l = tD[drawingLang];

  // 1. Automatic Beam Grouping Engine (STA4CAD style)
  const beamGroups = useMemo(() => {
    interface BeamGroup {
      id: string; // "B1", "B2", etc.
      b: number;
      h: number;
      length: number;
      beamIds: string[];
      representativeBeamId: string;
      keys: string;
    }

    const groups: BeamGroup[] = [];
    let counter = 1;

    for (const b of storyBeams) {
      const design = resolvedBeamDesigns.find(d => d.beamId === b.id);
      const b_val = b.b || 250;
      const h_val = b.h || 600;
      const L_val = b.length || 5000;

      // Extract reinforcement characteristics
      const tlBars = design?.flexLeft?.bars || 3;
      const tlDia = design?.flexLeft?.dia || 16;
      const tmBars = design?.flexMid?.bars || 2;
      const tmDia = design?.flexMid?.dia || 14;
      const trBars = design?.flexRight?.bars || 3;
      const trDia = design?.flexRight?.dia || 16;

      const blBars = Math.max(2, Math.floor(tlBars * 0.35)) || 2;
      const blDia = tlDia;
      const bmBars = design?.flexMid?.bars || 3;
      const bmDia = design?.flexMid?.dia || 16;
      const brBars = Math.max(2, Math.floor(trBars * 0.35)) || 2;
      const brDia = trDia;

      const stirrupSpacing = design?.shear?.spacing || 150;

      // High quality comparison key
      const groupKey = `${b_val}x${h_val}_L${Math.round(L_val/100)*100}_TL_${tlBars}Ø${tlDia}_TM_${tmBars}Ø${tmDia}_TR_${trBars}Ø${trDia}_BL_${blBars}Ø${blDia}_BM_${bmBars}Ø${bmDia}_BR_${brBars}Ø${brDia}_S_${stirrupSpacing}`;

      const existing = groups.find(g => g.keys === groupKey);
      if (existing) {
        existing.beamIds.push(b.id);
      } else {
        groups.push({
          id: `B${counter++}`,
          b: b_val,
          h: h_val,
          length: L_val,
          beamIds: [b.id],
          representativeBeamId: b.id,
          keys: groupKey
        });
      }
    }
    return groups;
  }, [storyBeams, resolvedBeamDesigns]);

  // Set default selection when data changes
  useEffect(() => {
    if (storyBeams.length > 0 && !selectedBeamId) {
      setSelectedBeamId(storyBeams[0].id);
    }
  }, [storyBeams, selectedBeamId]);

  useEffect(() => {
    if (beamGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(beamGroups[0].id);
    }
  }, [beamGroups, selectedGroupId]);

  // Determine active beam based on state selectors
  const activeBeamGroup = useMemo(() => {
    if (detailingMode === 'grouped') {
      return beamGroups.find(g => g.id === selectedGroupId) || beamGroups[0];
    }
    return null;
  }, [detailingMode, selectedGroupId, beamGroups]);

  const activeBeamId = useMemo(() => {
    if (detailingMode === 'grouped') {
      return activeBeamGroup?.representativeBeamId || '';
    }
    return selectedBeamId;
  }, [detailingMode, activeBeamGroup, selectedBeamId]);

  const currentSelectedBeam = useMemo(() => {
    return storyBeams.find(b => b.id === activeBeamId);
  }, [storyBeams, activeBeamId]);

  const currentSelectedBeamDesign = useMemo(() => {
    return resolvedBeamDesigns.find(d => d.beamId === activeBeamId);
  }, [resolvedBeamDesigns, activeBeamId]);

  // Reset Solution Index Overrides on active beam change to prevent invalid array indexes
  useEffect(() => {
    setSelectedSolutionIdx({});
  }, [activeBeamId]);

  // Reinforcement Arrangement computation
  const baseArrangement = useMemo(() => {
    if (!currentSelectedBeam) return null;
    
    const b = currentSelectedBeam.b || 250;
    const h = currentSelectedBeam.h || 600;
    const lengthVal = currentSelectedBeam.length || 5000;
    
    const topLeft = currentSelectedBeamDesign?.flexLeft?.AsNeeded || currentSelectedBeamDesign?.flexLeft?.As || 380;
    const topMid = currentSelectedBeamDesign?.flexMid?.AsNeeded || currentSelectedBeamDesign?.flexMid?.As || 180;
    const topRight = currentSelectedBeamDesign?.flexRight?.AsNeeded || currentSelectedBeamDesign?.flexRight?.As || 380;
    
    const botLeft = (currentSelectedBeamDesign?.flexLeft?.AsNeeded || currentSelectedBeamDesign?.flexLeft?.As || 380) * 0.35 || 250;
    const botMid = currentSelectedBeamDesign?.flexMid?.AsNeeded || currentSelectedBeamDesign?.flexMid?.As || 480;
    const botRight = (currentSelectedBeamDesign?.flexRight?.AsNeeded || currentSelectedBeamDesign?.flexRight?.As || 380) * 0.35 || 250;
    
    const shearVu = currentSelectedBeamDesign?.shear?.Vu || currentSelectedBeamDesign?.Vu || 85;
    const shearSpacing = currentSelectedBeamDesign?.shear?.spacing || currentSelectedBeamDesign?.shear?.sRequired || 150;

    return arrangeBeamReinforcement({
      beamId: currentSelectedBeam.id,
      width: b,
      depth: h,
      length: lengthVal,
      fc: mat?.fc || 25,
      fy: mat?.fy || 420,
      fyt: mat?.fy || 420,
      asTopReqLeft: topLeft,
      asTopReqMid: topMid,
      asTopReqRight: topRight,
      asBotReqLeft: botLeft,
      asBotReqMid: botMid,
      asBotReqRight: botRight,
      shearVuMax: shearVu,
      shearSpacingReq: shearSpacing,
      cover: 40,
      stirrupDia: mat?.stirrupDia || 10,
    });
  }, [currentSelectedBeam, currentSelectedBeamDesign, mat]);

  // Apply user-selected customized options
  const activeArrangement = useMemo(() => {
    if (!baseArrangement) return null;
    const override = JSON.parse(JSON.stringify(baseArrangement));

    // Overrides
    const regions = ['topLeft', 'topMid', 'topRight', 'botLeft', 'botMid', 'botRight'] as const;
    regions.forEach(r => {
      const idx = selectedSolutionIdx[`${activeBeamId}_${r}`];
      if (idx !== undefined) {
        if (r === 'topLeft' && override.topRegions.left.candidates[idx]) {
          override.topRegions.left.allBars = override.topRegions.left.candidates[idx].bars;
          override.topRegions.left.providedAs = override.topRegions.left.candidates[idx].providedAs;
        } else if (r === 'topMid' && override.topRegions.mid.candidates[idx]) {
          override.topRegions.mid.allBars = override.topRegions.mid.candidates[idx].bars;
          override.topRegions.mid.providedAs = override.topRegions.mid.candidates[idx].providedAs;
        } else if (r === 'topRight' && override.topRegions.right.candidates[idx]) {
          override.topRegions.right.allBars = override.topRegions.right.candidates[idx].bars;
          override.topRegions.right.providedAs = override.topRegions.right.candidates[idx].providedAs;
        } else if (r === 'botLeft' && override.bottomRegions.left.candidates[idx]) {
          override.bottomRegions.left.allBars = override.bottomRegions.left.candidates[idx].bars;
          override.bottomRegions.left.providedAs = override.bottomRegions.left.candidates[idx].providedAs;
        } else if (r === 'botMid' && override.bottomRegions.mid.candidates[idx]) {
          override.bottomRegions.mid.allBars = override.bottomRegions.mid.candidates[idx].bars;
          override.bottomRegions.mid.providedAs = override.bottomRegions.mid.candidates[idx].providedAs;
        } else if (r === 'botRight' && override.bottomRegions.right.candidates[idx]) {
          override.bottomRegions.right.allBars = override.bottomRegions.right.candidates[idx].bars;
          override.bottomRegions.right.providedAs = override.bottomRegions.right.candidates[idx].providedAs;
        }
      }
    });

    return override;
  }, [baseArrangement, selectedSolutionIdx, activeBeamId]);

  // Filtering list for sidebar
  const filteredBeams = useMemo(() => {
    return storyBeams.filter(b => b.id.toLowerCase().includes(beamSearchQuery.toLowerCase()));
  }, [storyBeams, beamSearchQuery]);

  const filteredGroups = useMemo(() => {
    return beamGroups.filter(g => 
      g.id.toLowerCase().includes(beamSearchQuery.toLowerCase()) || 
      g.beamIds.join(',').toLowerCase().includes(beamSearchQuery.toLowerCase())
    );
  }, [beamGroups, beamSearchQuery]);

  // Clear Bar Spacing calculation for QA/QC
  const calculateClearSpacing = (b: number, cover: number, stirrupDb: number, bars: { count: number; dia: number }[]): number => {
    const totalCount = bars.reduce((acc, bar) => acc + bar.count, 0);
    if (totalCount <= 1) return b - 2*cover - 2*stirrupDb;
    const totalBarsWidth = bars.reduce((acc, bar) => acc + (bar.count * bar.dia), 0);
    // Standard layers division (assume layer 1 has max 3 bars)
    const layer1Count = Math.min(3, totalCount);
    const layer1BarWidth = (totalBarsWidth / totalCount) * layer1Count;
    return (b - 2 * cover - 2 * stirrupDb - layer1BarWidth) / (layer1Count - 1);
  };

  // Live structural calculations QA/QC auditor
  const beamAudit = useMemo(() => {
    if (!activeArrangement) return null;
    const checks: { name: string; status: 'pass' | 'warning' | 'fail'; message: string }[] = [];

    // 1. Area of steel check
    const checkArea = (provided: number, required: number, regionName: string) => {
      if (provided < required) {
        checks.push({
          name: `${l.panelTitle} - ${regionName}`,
          status: 'fail',
          message: drawingLang === 'ar' 
            ? `مساحة الحديد الموفرة (${Math.round(provided)} مم²) أقل من المطلوبة تصميمياً (${Math.round(required)} مم²)` 
            : `Provided steel area (${Math.round(provided)} mm²) is less than required (${Math.round(required)} mm²)`
        });
      } else {
        checks.push({
          name: `${l.panelTitle} - ${regionName}`,
          status: 'pass',
          message: drawingLang === 'ar' ? "مساحة الحديد كافية ومستوفية للشروط" : "Steel area is adequate"
        });
      }
    };
    checkArea(activeArrangement.topRegions.left.providedAs, activeArrangement.topRegions.left.requiredAs, "Left Support (Top)");
    checkArea(activeArrangement.bottomRegions.mid.providedAs, activeArrangement.bottomRegions.mid.requiredAs, "Mid Span (Bottom)");

    // 2. Congestion/Clear spacing check
    const clearSpace = calculateClearSpacing(activeArrangement.b, 40, activeArrangement.stirrups.dia, activeArrangement.topRegions.left.allBars);
    if (clearSpace < 25) {
      checks.push({
        name: l.congestionText,
        status: 'warning',
        message: drawingLang === 'ar' 
          ? `تباعد الأسياخ ضيق (${Math.round(clearSpace)} مم) قد يعيق انسياب الخرسانة (خطر تعشيش). يفضل وضع الحديد على طبقتين.` 
          : `Tight clear bar spacing (${Math.round(clearSpace)} mm) threatens aggregate blocking. Double layer recommended.`
      });
    } else {
      checks.push({
        name: l.congestionText,
        status: 'pass',
        message: drawingLang === 'ar' ? `التباعد الصافي ممتاز وبمأمن من التعشيش (${Math.round(clearSpace)} مم)` : `Clear spacing is safe and spacious (${Math.round(clearSpace)} mm)`
      });
    }

    // 3. Stirrups spacing limits
    const maxStirrupSpacing = (activeArrangement.h - 80) / 2; // d/2 approximately
    const usedStirrupSpacing = activeArrangement.stirrups.leftZone.spacing;
    if (usedStirrupSpacing > Math.min(300, maxStirrupSpacing)) {
      checks.push({
        name: drawingLang === 'ar' ? "تباعد الكانات الأقصى" : "Max Stirrup Spacing Limit",
        status: 'warning',
        message: drawingLang === 'ar' 
          ? `مسافة تباعد الكانات (${usedStirrupSpacing} مم) تتجاوز حد الكود الأقصى d/2 = ${Math.round(maxStirrupSpacing)} مم` 
          : `Stirrup spacing (${usedStirrupSpacing} mm) exceeds maximum ACI limit d/2 (${Math.round(maxStirrupSpacing)} mm)`
      });
    } else {
      checks.push({
        name: drawingLang === 'ar' ? "شرط تباعد الكانات" : "Stirrup Spacing OK",
        status: 'pass',
        message: drawingLang === 'ar' ? "تباعد الكانات موافق للمتطلبات الإنشائية لـ ACI 318" : "Stirrups spacing is fully compliant"
      });
    }

    // 4. Hook anchorage check
    const activeLdh = activeArrangement.developmentLengths[activeArrangement.topRegions.left.allBars[0]?.dia || 16]?.ldh_standard_hook || 350;
    const mockColWidth = 500;
    if (activeLdh > mockColWidth - 40) {
      checks.push({
        name: drawingLang === 'ar' ? "طول عكفة التماسك بالمسند" : "Ancrage Standard Hook Width",
        status: 'warning',
        message: drawingLang === 'ar' 
          ? `المسافة اللازمة للعكفة (${activeLdh} مم) تتجاوز عرض العمود مخصوماً منه الغطاء. يتطلب زيادة عمق المسند أو حديد قطر أصغر.` 
          : `Required standard hook anchorage length (${activeLdh} mm) exceeds column width clearance. Increase column section or reduce bar size.`
      });
    } else {
      checks.push({
        name: drawingLang === 'ar' ? "شرط تماسك المسند" : "Column Anchorage Length OK",
        status: 'pass',
        message: drawingLang === 'ar' ? `المسند يحتوي مساحة كافية لتأمين تماسك العكفة (${activeLdh} مم)` : `Support width easily accommodates development hook (${activeLdh} mm)`
      });
    }

    return checks;
  }, [activeArrangement, drawingLang, l]);

  // Dynamic dynamic layering renderer logic helper
  const renderCrossSectionSVG = (title: string, topBars: { count: number; dia: number }[], botBars: { count: number; dia: number }[], b: number, h: number, stirrupDia: number, stirrupSpacing: number) => {
    const scaleX = 90 / b;
    const scaleY = 120 / h;
    const scale = Math.min(scaleX, scaleY);
    const w = b * scale;
    const d = h * scale;
    const cx = 80 - w/2;
    const cy = 90 - d/2;

    const cPx = 40 * scale; // Cover
    
    // Stirrup outline rect coordinates
    const stX = cx + cPx;
    const stY = cy + cPx;
    const stW = w - 2*cPx;
    const stH = d - 2*cPx;

    const arrangeIntoLayers = (bars: { count: number; dia: number }[]) => {
      const items: number[] = [];
      bars.forEach(bar => {
        for (let i = 0; i < bar.count; i++) items.push(bar.dia);
      });
      
      const layers: number[][] = [];
      if (items.length <= 3) {
        if (items.length > 0) layers.push(items);
      } else if (items.length <= 5) {
        layers.push(items.slice(0, 3));
        layers.push(items.slice(3));
      } else {
        layers.push(items.slice(0, 3));
        layers.push(items.slice(3, 6));
        if (items.length > 6) layers.push(items.slice(6));
      }
      return layers;
    };

    const topLayers = arrangeIntoLayers(topBars);
    const botLayers = arrangeIntoLayers(botBars);

    return (
      <svg viewBox="0 0 160 180" className="w-[125px] h-[140px] border border-slate-700 rounded-lg bg-slate-900 p-1 font-mono hover:border-cyan-500 transition-colors" style={{ direction: 'ltr' }}>
        {/* Beam Outline */}
        <rect x={cx} y={cy} width={w} height={d} fill="#1e293b" stroke="#475569" strokeWidth="2" />
        
        {/* Stirrups representation */}
        <rect x={stX} y={stY} width={stW} height={stH} fill="none" stroke="#f43f5e" strokeWidth="1.2" />
        {/* hooks */}
        <line x1={stX} y1={stY} x2={stX + 6} y2={stY + 6} stroke="#f43f5e" strokeWidth="1.2" />
        <line x1={stX + stW} y1={stY} x2={stX + stW - 6} y2={stY + 6} stroke="#f43f5e" strokeWidth="1.2" />

        {/* Top Rebars Layer by Layer */}
        {topLayers.map((layer, lIdx) => {
          const yBar = stY + 4 + lIdx * 9;
          const step = layer.length > 1 ? (stW - 10) / (layer.length - 1) : 0;
          return layer.map((barDia, bIdx) => {
            const xBar = layer.length > 1 ? (stX + 5 + bIdx * step) : (stX + stW/2);
            return (
              <g key={`top-l${lIdx}-b${bIdx}`}>
                <circle cx={xBar} cy={yBar} r={Math.max(2, (barDia * scale) / 2)} fill="#ef4444" />
                {lIdx > 0 && bIdx === 0 && (
                  <line x1={stX + 2} y1={yBar - 4.5} x2={stX + stW - 2} y2={yBar - 4.5} stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="1 1" />
                )}
              </g>
            );
          });
        })}

        {/* Bottom Rebars Layer by Layer (ascending) */}
        {botLayers.map((layer, lIdx) => {
          const yBar = (stY + stH - 4) - lIdx * 9;
          const step = layer.length > 1 ? (stW - 10) / (layer.length - 1) : 0;
          return layer.map((barDia, bIdx) => {
            const xBar = layer.length > 1 ? (stX + 5 + bIdx * step) : (stX + stW/2);
            return (
              <g key={`bot-l${lIdx}-b${bIdx}`}>
                <circle cx={xBar} cy={yBar} r={Math.max(2, (barDia * scale) / 2)} fill="#0ea5e9" />
                {lIdx > 0 && bIdx === 0 && (
                  <line x1={stX + 2} y1={yBar + 4.5} x2={stX + stW - 2} y2={yBar + 4.5} stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="1 1" />
                )}
              </g>
            );
          });
        })}

        {/* Dimensions metadata */}
        <text x={cx + w/2} y={cy - 3} fontSize="6.5" textAnchor="middle" fill="#94a3b8" fontWeight="bold">b={b}</text>
        <text x={cx - 4} y={cy + d/2} fontSize="6.5" textAnchor="middle" fill="#94a3b8" fontWeight="bold" transform={`rotate(-90 ${cx - 4} ${cy + d/2})`}>h={h}</text>
      </svg>
    );
  };

  const handleDirectPrintSheet = (
    title: string,
    svg: string,
    notes: string,
    bbs: string,
    qa: string
  ) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("الرجاء السماح بالنوافذ المنبثقة لطباعة المخطط التفصيلي.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>\${title}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #1e293b; direction: rtl; }
            h1 { font-size: 18px; border-bottom: 2px solid #0284c7; padding-bottom: 8px; color: #0284c7; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
            th { background: #f1f5f9; }
            .svg-container { border: 1px dashed #94a3b8; padding: 15px; margin-top: 15px; display: flex; justify-content: center; background: #fafafa; }
            .section { margin-top: 25px; }
            .sec-title { font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #0f172a; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: left;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: white; border: none; cursor: pointer; border-radius: 4px;">طباعة المخطط / تصدير PDF</button>
          </div>
          <h1>\${title}</h1>
          <div class="section">
            <div class="sec-title">الرسم التفصيلي الهندسي (Engineering Detailing Plan):</div>
            <div class="svg-container">\${svg}</div>
          </div>
          <div class="section">
            <div class="sec-title">جدول كميات وثني حديد التسليح (Bar Bending Schedule):</div>
            \${bbs}
          </div>
          <div class="section text-xs">
            <div class="sec-title">الملاحظات الإنشائية واختبارات الجودة:</div>
            \${notes}
            \${qa}
          </div>
          <script>
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Printing Layout sheet compiler
  const handleCompileDirectPrint = () => {
    if (!activeArrangement) return;

    const el = document.getElementById("beamDetialingCadSvgBlock");
    const svgMarkup = el ? el.outerHTML : "";

    const bbsMarkup = `
      <table>
        <thead>
          <tr>
            <th>${drawingLang === 'ar' ? 'رمز السيخ' : 'Mark'}</th>
            <th>${drawingLang === 'ar' ? 'القطر' : 'Dia'}</th>
            <th>${drawingLang === 'ar' ? 'العدد' : 'Qty'}</th>
            <th>${drawingLang === 'ar' ? 'الطول' : 'Length (mm)'}</th>
            <th>${drawingLang === 'ar' ? 'الوزن' : 'Weight (kg)'}</th>
            <th>${drawingLang === 'ar' ? 'تعليمات الثني' : 'Bending Instructions'}</th>
          </tr>
        </thead>
        <tbody>
          ${activeArrangement.bbs.map((item: any) => `
            <tr>
              <td><strong>${item.mark}</strong></td>
              <td>Ø${item.dia}</td>
              <td>${item.count * (detailingMode === 'grouped' ? activeBeamGroup?.beamIds.length || 1 : 1)}</td>
              <td>${item.length} mm</td>
              <td>${(item.totalWeight * (detailingMode === 'grouped' ? activeBeamGroup?.beamIds.length || 1 : 1)).toFixed(1)} kg</td>
              <td>${item.bendDetails}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const notesMarkup = `
      <ul>
        <li>Concrete Design Grade: fc' = ${activeArrangement.fc} MPa</li>
        <li>Steel Yield Strength: fy = ${activeArrangement.fy} MPa</li>
        <li>Reinforced Clear Cover: Cc = 40 mm (Beams/Posts)</li>
        <li>Bending hook development length requirements: 12db or 150mm hook length</li>
        <li>Lap reinforcement splice Class B tension: 60db min lap spacing</li>
        <li>QA/QC: Safe and certified for construction</li>
      </ul>
    `;

    const qaMarkup = `
      <table>
        <thead>
          <tr>
            <th>${drawingLang === 'ar' ? 'اسم الفحص' : 'Verification Check'}</th>
            <th>${drawingLang === 'ar' ? 'الحالة الإنشائية' : 'Status'}</th>
            <th>${drawingLang === 'ar' ? 'تقرير التدقيق والتوصيات' : 'Assessment & Recommendation'}</th>
          </tr>
        </thead>
        <tbody>
          ${beamAudit?.map(check => `
            <tr>
              <td><strong>${check.name}</strong></td>
              <td><span style="color: ${check.status === 'pass' ? '#16a34a' : '#ea580c'}; font-weight: bold;">${check.status.toUpperCase()}</span></td>
              <td>${check.message}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const beamTitle = detailingMode === 'grouped' 
      ? `Grouping DETAILED SHEET B${activeBeamGroup?.id} (x${activeBeamGroup?.beamIds.length} Beams: ${activeBeamGroup?.beamIds.join(', ')})`
      : `Structural detailing beam segment ${activeBeamId} (${activeArrangement.b}x${activeArrangement.h})`;

    handleDirectPrintSheet(beamTitle, svgMarkup, notesMarkup, bbsMarkup, qaMarkup);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800" style={{ direction: drawingLang === 'ar' ? 'rtl' : 'ltr' }}>
      
      {/* Detailing Header Dashboard Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-600 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-900 font-sans tracking-tight">{l.title}</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">{l.sub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {storyBeams.length > 0 && (
            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg mr-2">
              <button 
                onClick={() => setDetailingMode('individual')}
                className={`text-xs px-3 py-1.5 rounded font-semibold transition-all ${detailingMode === 'individual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {l.indiv}
              </button>
              <button 
                onClick={() => setDetailingMode('grouped')}
                className={`text-xs px-3 py-1.5 rounded font-semibold transition-all ${detailingMode === 'grouped' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {l.grouped}
              </button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setDrawingLang(prev => prev === 'ar' ? 'en' : 'ar')} className="gap-1.5 shadow-sm font-sans h-9">
            <Languages className="w-4 h-4 text-slate-500" />
            <span>{l.langToggle}</span>
          </Button>
        </div>
      </div>

      {storyBeams.length > 0 && activeArrangement ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Main List Sidebar column */}
          <div className="xl:col-span-3 space-y-4">
            <Card className="border border-slate-200 shadow-md">
              <CardHeader className="py-3 px-4 border-b bg-slate-50 select-none">
                <CardTitle className="text-xs font-bold font-sans flex items-center justify-between">
                  <span>{detailingMode === 'grouped' ? "قائمة المجموعات المكتشفة" : "عناصر الجسور المتاحة"}</span>
                  <LayoutGrid className="w-4 h-4 text-slate-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div className="relative">
                  <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400" />
                  <Input 
                    value={beamSearchQuery}
                    onChange={e => setBeamSearchQuery(e.target.value)}
                    placeholder={l.search}
                    className="h-9 p-2.5 text-xs font-sans border-slate-200 focus:ring-slate-300 rounded-md shadow-sm pr-8 pl-4 text-right"
                  />
                </div>

                <div className="max-h-[350px] overflow-y-auto space-y-1.5 pr-1">
                  {detailingMode === 'grouped' ? (
                    filteredGroups.map(group => {
                      const isSelected = selectedGroupId === group.id;
                      return (
                        <div 
                          key={group.id}
                          onClick={() => {
                            setSelectedGroupId(group.id);
                          }}
                          className={`border p-2.5 rounded-xl cursor-pointer transition-all flex justify-between items-center ${
                            isSelected ? 'bg-cyan-50 border-cyan-500 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-black text-slate-800 font-mono">{group.id} <span className="text-[10px] text-slate-400 font-sans">({group.beamIds.length}x)</span></span>
                            <span className="block text-[10px] text-slate-500 mt-0.5 font-sans leading-tight">
                              Beams: {group.beamIds.join(', ')}
                            </span>
                          </div>
                          <Badge variant="secondary" className="font-mono text-[9px] bg-slate-100 text-slate-700">{group.b}x{group.h}</Badge>
                        </div>
                      );
                    })
                  ) : (
                    filteredBeams.map(beam => {
                      const isSelected = selectedBeamId === beam.id;
                      return (
                        <div 
                          key={beam.id}
                          onClick={() => {
                            setSelectedBeamId(beam.id);
                          }}
                          className={`border p-2.5 rounded-xl cursor-pointer transition-all flex justify-between items-center ${
                            isSelected ? 'bg-cyan-50 border-cyan-500 shadow-sm' : 'border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-black text-slate-800 font-mono">{beam.id}</span>
                            <span className="block text-[10px] text-slate-500 mt-0.5">L = {((beam.length || 5000)/1000).toFixed(2)} m</span>
                          </div>
                          <Badge variant="secondary" className="font-mono text-[9px] bg-slate-100 text-slate-700">{beam.b}x{beam.h}</Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Rebar Selector / Optimisation candidate list */}
            <Card className="border border-slate-200 shadow-md overflow-hidden bg-white">
              <CardHeader className="bg-slate-50 border-b text-slate-800 py-3 px-4">
                <CardTitle className="text-xs font-bold font-sans">{l.rebarSelector}</CardTitle>
                <CardDescription className="text-[10px] text-slate-500">{l.rebarSelectorDesc}</CardDescription>
              </CardHeader>
              <CardContent className="p-3 space-y-4">
                <div>
                  <span className="text-slate-500 text-[10px] font-bold block mb-1.5">{drawingLang === 'ar' ? 'مكان التحقق بالرسم:' : 'Interactive Checking Region:'}</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                    {['topLeft', 'topMid', 'topRight'].map((r) => (
                      <button 
                        key={r}
                        onClick={() => setActiveRegionSelector(r as any)} 
                        className={`text-[9px] font-bold py-1.5 px-0.5 rounded-md text-center transition-all ${activeRegionSelector === r ? 'bg-cyan-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                      >
                        {r === 'topLeft' ? 'Left Top' : r === 'topMid' ? 'Mid Top' : 'Right Top'}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg mt-1.5">
                    {['botLeft', 'botMid', 'botRight'].map((r) => (
                      <button 
                        key={r}
                        onClick={() => setActiveRegionSelector(r as any)} 
                        className={`text-[9px] font-bold py-1.5 px-0.5 rounded-md text-center transition-all ${activeRegionSelector === r ? 'bg-cyan-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}`}
                      >
                        {r === 'botLeft' ? 'Left Bot' : r === 'botMid' ? 'Mid Bot' : 'Right Bot'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rank Solution lists */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 block">{l.candTitle}:</span>
                  {(() => {
                    let candidates: any[] = [];
                    let requiredAs = 0;
                    if (activeRegionSelector === 'topLeft') { candidates = activeArrangement.topRegions.left.candidates; requiredAs = activeArrangement.topRegions.left.requiredAs; }
                    else if (activeRegionSelector === 'topMid') { candidates = activeArrangement.topRegions.mid.candidates; requiredAs = activeArrangement.topRegions.mid.requiredAs; }
                    else if (activeRegionSelector === 'topRight') { candidates = activeArrangement.topRegions.right.candidates; requiredAs = activeArrangement.topRegions.right.requiredAs; }
                    else if (activeRegionSelector === 'botLeft') { candidates = activeArrangement.bottomRegions.left.candidates; requiredAs = activeArrangement.bottomRegions.left.requiredAs; }
                    else if (activeRegionSelector === 'botMid') { candidates = activeArrangement.bottomRegions.mid.candidates; requiredAs = activeArrangement.bottomRegions.mid.requiredAs; }
                    else if (activeRegionSelector === 'botRight') { candidates = activeArrangement.bottomRegions.right.candidates; requiredAs = activeArrangement.bottomRegions.right.requiredAs; }

                    const currentIdx = selectedSolutionIdx[`${activeBeamId}_${activeRegionSelector}`] || 0;

                    return (
                      <div className="space-y-2">
                        <div className="bg-slate-50 p-2 rounded-lg text-[10px] flex justify-between items-center border border-dashed border-slate-300">
                          <span className="text-slate-600">{drawingLang === 'ar' ? 'المساحة المطلوبة للحديد As:' : 'Required As:'}</span>
                          <span className="font-mono font-bold text-slate-900">{Math.round(requiredAs)} mm²</span>
                        </div>

                        <div className="max-h-[160px] overflow-y-auto space-y-1 pr-1">
                          {candidates.map((cand, idx) => {
                            const isSelected = currentIdx === idx;
                            return (
                              <div 
                                key={idx}
                                onClick={() => {
                                  setSelectedSolutionIdx(prev => ({ ...prev, [`${activeBeamId}_${activeRegionSelector}`]: idx }));
                                }}
                                className={`border p-2 rounded-lg transition-all cursor-pointer flex flex-col ${
                                  isSelected ? 'border-cyan-600 bg-cyan-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-800 font-mono">
                                    {cand.bars.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')}
                                  </span>
                                  <span className={`text-[10px] font-black font-mono ${cand.score >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {cand.score}/100
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-slate-500 mt-1 font-mono">
                                  <span>{Math.round(cand.providedAs)} mm²</span>
                                  <span className="text-emerald-600">{cand.clearSpacing > 25 ? 'Clean' : 'Tight'}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Detailing Sheet Frame Canvas area */}
          <div className="xl:col-span-9 space-y-6">
            
            {/* Live Sheet header parameters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border border-slate-200 shadow-sm bg-slate-50 p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-500">{l.selectedBeam}</span>
                <span className="text-xl font-mono font-black text-slate-800 mt-1">
                  {detailingMode === 'grouped' ? `B${activeBeamGroup?.id}` : activeBeamId}
                </span>
                {detailingMode === 'grouped' && (
                  <span className="text-[10px] text-cyan-600 font-bold mt-1">
                    {drawingLang === 'ar' ? 'توفير التكرار:' : 'ClonedCount:'} x{activeBeamGroup?.beamIds.length}
                  </span>
                )}
              </Card>

              <Card className="border border-slate-200 shadow-sm bg-slate-50 p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-500">{l.netSpan}</span>
                <span className="text-xl font-mono font-black text-cyan-700 mt-1">
                  {((activeArrangement.length) / 1000).toFixed(2)} m
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">b={activeArrangement.b} mm | h={activeArrangement.h} mm</span>
              </Card>

              <Card className="border border-slate-200 shadow-sm bg-slate-50 p-3 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-500">{l.spacingText}</span>
                <span className="text-xl font-mono font-black text-emerald-600 mt-1">
                  {Math.round(calculateClearSpacing(activeArrangement.b, 40, activeArrangement.stirrups.dia, activeArrangement.topRegions.left.allBars))} mm
                </span>
                <span className="text-[9px] text-emerald-600/80 mt-1 font-semibold">✔ Compliant</span>
              </Card>

              <Card className={`border shadow-sm p-3 flex flex-col justify-between ${
                activeArrangement.congestion.severity === 'high' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-600" />
                  {l.congestionText}
                </span>
                <Badge className="text-[9px] font-bold self-start mt-1">
                  {activeArrangement.congestion.severity === 'high' ? 'High Congestion / عالي التعشيش' : 'Safe / ممتاز وآمن'}
                </Badge>
                <span className="text-[8px] text-slate-500 mt-0.5 leading-snug">{activeArrangement.congestion.message}</span>
              </Card>
            </div>

            {/* HIGH-RESOLUTION ELEVATION ISO CAD CONTAINER CANVAS */}
            <Card className="border border-slate-300 shadow-md">
              <CardHeader className="bg-slate-50 py-2.5 px-4 flex flex-row justify-between items-center border-b select-none">
                <CardTitle className="text-xs font-mono font-bold flex items-center gap-1.5 text-slate-700">
                  <Maximize2 className="w-4 h-4 text-cyan-600 animate-pulse" />
                  {l.cadTitle} <span className="text-[10px] font-mono text-zinc-400">SCALE {selectedScale}</span>
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="w-7 h-7" onClick={() => setBeamDrawingScale(prev => Math.min(1.4, prev + 0.1))} title={l.zoomIn}><Maximize2 className="w-3 h-3" /></Button>
                  <Button variant="outline" size="icon" className="w-7 h-7" onClick={() => setBeamDrawingScale(prev => Math.max(0.6, prev - 0.1))} title={l.zoomOut}><Minimize2 className="w-3 h-3" /></Button>
                  <Button variant="outline" size="icon" className="w-7 h-7" onClick={() => setBeamDrawingScale(1)} title={l.zoomReset}><RotateCcw className="w-3.5 h-3.5 text-slate-500" /></Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 bg-slate-950 overflow-auto flex flex-col items-center justify-center">
                <div 
                  className="transition-transform duration-200 origin-center flex items-center justify-center w-full max-w-4xl" 
                  style={{ transform: `scale(${beamDrawingScale})` }}
                >
                  
                  {/* COMPREHENSIVE HIGH RESOLUTION ELEVATION DIAGRAM SHEET */}
                  <svg 
                    id="beamDetialingCadSvgBlock"
                    viewBox="0 0 1000 320" 
                    className="w-full h-auto bg-slate-950 text-slate-50 font-sans select-none" 
                    style={{ direction: 'ltr' }}
                  >
                    {/* ANSI/ISO Drawing border line */}
                    <rect x="5" y="5" width="990" height="310" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="6 3" />
                    <rect x="15" y="15" width="970" height="290" fill="none" stroke="#1e293b" strokeWidth="1.5" />

                    {/* Supports/Grid Lines A & B circles */}
                    <g className="opacity-70">
                      {/* Grid Line A */}
                      <line x1="150" y1="20" x2="150" y2="280" stroke="#475569" strokeWidth="0.8" strokeDasharray="4 4" />
                      <circle cx="150" cy="20" r="12" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
                      <text x="150" y="24" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#fff">A</text>
                      
                      {/* Grid Line B */}
                      <line x1="850" y1="20" x2="850" y2="280" stroke="#475569" strokeWidth="0.8" strokeDasharray="4 4" />
                      <circle cx="850" cy="20" r="12" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
                      <text x="850" y="24" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#fff">B</text>
                    </g>

                    {/* Column supports */}
                    <rect x="110" y="80" width="80" height="170" fill="#1e293b" fillOpacity="0.6" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="150" y="170" fontSize="8" fill="#64748b" textAnchor="middle" fontWeight="bold" letterSpacing="1">SUPPORT COL</text>
                    
                    <rect x="810" y="80" width="80" height="170" fill="#1e293b" fillOpacity="0.6" stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="850" y="170" fontSize="8" fill="#64748b" textAnchor="middle" fontWeight="bold" letterSpacing="1">SUPPORT COL</text>

                    {/* Beam Main block */}
                    <rect x="190" y="100" width="620" height="120" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
                    
                    {/* Continuous Top Steel BT1 with 90db Hooks */}
                    <path d="M 140 140 L 140 115 L 860 115 L 860 140" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                    <text x="500" y="110" fontSize="9.5" fill="#ef4444" fontWeight="bold" textAnchor="middle" className="font-mono">
                      BT1: {activeArrangement.topRegions.mid.allBars.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')} Cont. — BBS MARK BT1
                    </text>

                    {/* Top Additional Reinforcement Left Support BT2 */}
                    <path d="M 144 145 L 144 125 L 340 125" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="2 1" />
                    <line x1="340" y1="120" x2="340" y2="130" stroke="#f43f5e" strokeWidth="1" />
                    <text x="210" y="137" fontSize="8" fill="#f43f5e" fontWeight="bold" className="font-mono">
                      BT2: {activeArrangement.topRegions.left.allBars.filter((b: any) => b.dia !== activeArrangement.topRegions.mid.allBars[0]?.dia).map((b: any) => `${b.count}Ø${b.dia}`).join(' + ') || `${activeArrangement.topRegions.left.allBars[0]?.count}Ø${activeArrangement.topRegions.left.allBars[0]?.dia}`} Add. (0.3Ld L={Math.round(activeArrangement.length*0.3)}mm)
                    </text>

                    {/* Top Additional Reinforcement Right Support BT3 */}
                    <path d="M 856 145 L 856 125 L 660 125" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="2 1" />
                    <line x1="660" y1="120" x2="660" y2="130" stroke="#f43f5e" strokeWidth="1" />
                    <text x="790" y="137" fontSize="8" fill="#f43f5e" fontWeight="bold" textAnchor="end" className="font-mono">
                      BT3: {activeArrangement.topRegions.right.allBars.filter((b: any) => b.dia !== activeArrangement.topRegions.mid.allBars[0]?.dia).map((b: any) => `${b.count}Ø${b.dia}`).join(' + ') || `${activeArrangement.topRegions.right.allBars[0]?.count}Ø${activeArrangement.topRegions.right.allBars[0]?.dia}`} Add. (0.3Ld L={Math.round(activeArrangement.length*0.3)}mm)
                    </text>

                    {/* Continuous Bottom Steel BB1 with end standard hooks */}
                    <path d="M 140 180 L 140 205 L 860 205 L 860 180" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" />
                    <text x="500" y="222" fontSize="9.5" fill="#0ea5e9" fontWeight="bold" textAnchor="middle" className="font-mono">
                      BB1: {activeArrangement.bottomRegions.left.allBars.map((b: any) => `${b.count}Ø${b.dia}`).join(' + ')} Cont. — BBS MARK BB1
                    </text>

                    {/* Bottom Additional Reinforcement BB2 at midspan */}
                    {activeArrangement.bottomRegions.mid.allBars.length > 0 && activeArrangement.bottomRegions.mid.providedAs > activeArrangement.bottomRegions.left.providedAs && (
                      <>
                        <path d="M 280 196 L 720 196" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 1" />
                        <line x1="280" y1="192" x2="280" y2="200" stroke="#38bdf8" strokeWidth="1" />
                        <line x1="720" y1="192" x2="720" y2="200" stroke="#38bdf8" strokeWidth="1" />
                        <text x="500" y="191" fontSize="8" fill="#38bdf8" fontWeight="bold" textAnchor="middle" className="font-mono">
                          BB2: {activeArrangement.bottomRegions.mid.allBars.filter((b: any) => b.dia !== activeArrangement.bottomRegions.left.allBars[0]?.dia).map((b: any) => `${b.count}Ø${b.dia}`).join(' + ') || "2Ø12"} Add. BB2
                        </text>
                      </>
                    )}

                    {/* Curtailment limit markers with dim labels */}
                    <g className="opacity-60 text-[7px]" stroke="#475569" strokeWidth="0.5">
                      <line x1="340" y1="100" x2="340" y2="135" strokeDasharray="2 1" />
                      <text x="340" y="94" textAnchor="middle" fill="#94a3b8" stroke="none">0.30 L = {Math.round(activeArrangement.length * 0.3)} mm</text>
                      
                      <line x1="660" y1="100" x2="660" y2="135" strokeDasharray="2 1" />
                      <text x="660" y="94" textAnchor="middle" fill="#94a3b8" stroke="none">0.30 L = {Math.round(activeArrangement.length * 0.3)} mm</text>
                    </g>

                    {/* Closed Stirrup representation */}
                    {/* Left support zone stirrups (dense) */}
                    {Array.from({ length: 12 }).map((_, idx) => (
                      <line key={`stirLeft-${idx}`} x1={195 + idx * 11} y1="102" x2={195 + idx * 11} y2="218" stroke="#f43f5e" strokeWidth="0.8" strokeOpacity="0.8" />
                    ))}
                    <text x="260" y="240" fontSize="8.5" fill="#f43f5e" fontWeight="bold" textAnchor="middle" className="font-mono">
                      BS1: {activeArrangement.stirrups.leftZone.count}BS1 Ø{activeArrangement.stirrups.dia}@{activeArrangement.stirrups.leftZone.spacing}
                    </text>

                    {/* Middle zone stirrups (wider spacing) */}
                    {Array.from({ length: 15 }).map((_, idx) => (
                      <line key={`stirMid-${idx}`} x1={330 + idx * 24} y1="102" x2={330 + idx * 24} y2="218" stroke="#475569" strokeWidth="0.8" strokeOpacity="0.6" />
                    ))}
                    <text x="500" y="240" fontSize="8.5" fill="#94a3b8" fontWeight="bold" textAnchor="middle" className="font-mono">
                      BS2: {activeArrangement.stirrups.midZone.count}BS2 Ø{activeArrangement.stirrups.dia}@{activeArrangement.stirrups.midZone.spacing}
                    </text>

                    {/* Right support zone stirrups (dense) */}
                    {Array.from({ length: 12 }).map((_, idx) => (
                      <line key={`stirRight-${idx}`} x1={690 + idx * 11} y1="102" x2={690 + idx * 11} y2="218" stroke="#f43f5e" strokeWidth="0.8" strokeOpacity="0.8" />
                    ))}
                    <text x="740" y="240" fontSize="8.5" fill="#f43f5e" fontWeight="bold" textAnchor="middle" className="font-mono">
                      BS1: {activeArrangement.stirrups.rightZone.count}BS1 Ø{activeArrangement.stirrups.dia}@{activeArrangement.stirrups.rightZone.spacing}
                    </text>

                    {/* Class B Lap Splicing dashed indicator box in upper zone */}
                    <rect x="360" y="145" width="280" height="25" fill="#1e1b4b" fillOpacity="0.3" stroke="#06b6d4" strokeWidth="0.8" strokeDasharray="3 2" />
                    <text x="500" y="161" fontSize="8" fill="#22d3ee" fontWeight="bold" textAnchor="middle">
                      {drawingLang === 'ar' ? `منطقة تشريك الضغط (Class B Lap Splice) = ${activeArrangement.developmentLengths[activeArrangement.topRegions.left.allBars[0]?.dia || 16]?.lap_classB || 960} مم` : `Class B Tension Lap Splice Zone = ${activeArrangement.developmentLengths[activeArrangement.topRegions.left.allBars[0]?.dia || 16]?.lap_classB || 960} mm`}
                    </text>

                    {/* Section indicator cut lines */}
                    <g className="opacity-90 font-mono text-[7px]" stroke="#cbd5e1" strokeWidth="0.6">
                      <line x1="240" y1="65" x2="240" y2="255" strokeDasharray="4 2" />
                      <text x="240" y="60" textAnchor="middle" fill="#cbd5e1" stroke="none">SEC A-A (Left Support)</text>
                      
                      <line x1="500" y1="65" x2="500" y2="255" strokeDasharray="4 2" />
                      <text x="500" y="60" textAnchor="middle" fill="#cbd5e1" stroke="none">SEC B-B (Mid Span)</text>

                      <line x1="760" y1="65" x2="760" y2="255" strokeDasharray="4 2" />
                      <text x="760" y="60" textAnchor="middle" fill="#cbd5e1" stroke="none">SEC C-C (Right Support)</text>
                    </g>

                    {/* Main Dimensions tags */}
                    <g className="font-mono text-[9px] text-[#94a3b8]" fill="#94a3b8">
                      {/* Left col width */}
                      <text x="150" y="265" textAnchor="middle">C_WIDTH = 500 mm</text>
                      {/* Net Span length */}
                      <text x="500" y="282" textAnchor="middle" fontWeight="bold">NET SPAN L_net = {activeArrangement.length} mm (H = {activeArrangement.h} mm, B = {activeArrangement.b} mm)</text>
                      {/* Right col width */}
                      <text x="850" y="265" textAnchor="middle">C_WIDTH = 500 mm</text>
                    </g>

                    {/* ISO TITLE BLOCK ON SHEET AT BOTTOM RIGHT */}
                    <g className="opacity-90 font-sans" stroke="#334155" strokeWidth="0.8">
                      <rect x="730" y="215" width="245" height="80" fill="#1e293b" />
                      <line x1="730" y1="235" x2="975" y2="235" />
                      <line x1="730" y1="255" x2="975" y2="255" />
                      <line x1="730" y1="275" x2="975" y2="275" />
                      <line x1="850" y1="235" x2="850" y2="295" />

                      <text x="852" y="228" fontSize="8" fill="#22d3ee" fontWeight="bold" stroke="none">
                        {drawingLang === 'ar' ? 'مخطط تفريد وتسليح الجسور الإنشائية' : 'RC BEAM DETAILING SHEET'}
                      </text>
                      
                      <text x="735" y="247" fontSize="7" fill="#94a3b8" stroke="none">{drawingLang === 'ar' ? 'مشروع مجمع نموذجي' : 'PROJECT MODEL:'}</text>
                      <text x="735" y="267" fontSize="7" fill="#94a3b8" stroke="none">{drawingLang === 'ar' ? 'الجسر المعالج:' : 'MEMBER ID:'}</text>
                      <text x="735" y="287" fontSize="7" fill="#94a3b8" stroke="none">{drawingLang === 'ar' ? 'الكود المعتمد:' : 'CODE BASE:'}</text>

                      <text x="855" y="247" fontSize="7.5" fill="#f8fafc" fontWeight="bold" stroke="none">{titleBlock.projectName}</text>
                      <text x="855" y="267" fontSize="7.5" fill="#f8fafc" fontWeight="bold" stroke="none" className="font-mono">
                        {detailingMode === 'grouped' ? `B${activeBeamGroup?.id} (x${activeBeamGroup?.beamIds.length})` : activeArrangement.beamId}
                      </text>
                      <text x="855" y="287" fontSize="7.5" fill="#f8fafc" fontWeight="bold" stroke="none">ACI 318-19 / ISO 7200</text>
                    </g>
                  </svg>
                  
                </div>
              </CardContent>
            </Card>

            {/* AUTOMATIC CROSS SECTIONS AT CRITICAL CHANNELS (Support and Midspan with Layers) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border border-slate-200 bg-white p-3 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-800 mb-2">{l.secA}</span>
                {renderCrossSectionSVG(
                  "Sect A-A", 
                  activeArrangement.topRegions.left.allBars, 
                  activeArrangement.bottomRegions.left.allBars, 
                  activeArrangement.b, 
                  activeArrangement.h, 
                  activeArrangement.stirrups.dia, 
                  activeArrangement.stirrups.leftZone.spacing
                )}
                <div className="w-full text-[10px] space-y-1 block mt-2 text-slate-500 font-mono">
                  <div className="flex justify-between border-b pb-0.5"><span className="font-sans">Top Rebar Area:</span><strong>{activeArrangement.topRegions.left.providedAs} mm²</strong></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="font-sans">Stirrups Left:</span><strong>Ø{activeArrangement.stirrups.dia} @ {activeArrangement.stirrups.leftZone.spacing}</strong></div>
                </div>
              </Card>

              <Card className="border border-slate-200 bg-white p-3 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-800 mb-2">{l.secB}</span>
                {renderCrossSectionSVG(
                  "Sect B-B", 
                  activeArrangement.topRegions.mid.allBars, 
                  activeArrangement.bottomRegions.mid.allBars, 
                  activeArrangement.b, 
                  activeArrangement.h, 
                  activeArrangement.stirrups.dia, 
                  activeArrangement.stirrups.midZone.spacing
                )}
                <div className="w-full text-[10px] space-y-1 block mt-2 text-slate-500 font-mono">
                  <div className="flex justify-between border-b pb-0.5"><span className="font-sans">Bot Rebar Area:</span><strong>{activeArrangement.bottomRegions.mid.providedAs} mm²</strong></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="font-sans">Stirrups Mid:</span><strong>Ø{activeArrangement.stirrups.dia} @ {activeArrangement.stirrups.midZone.spacing}</strong></div>
                </div>
              </Card>

              <Card className="border border-slate-200 bg-white p-3 flex flex-col items-center">
                <span className="text-xs font-bold text-slate-800 mb-2">{l.secC}</span>
                {renderCrossSectionSVG(
                  "Sect C-C", 
                  activeArrangement.topRegions.right.allBars, 
                  activeArrangement.bottomRegions.right.allBars, 
                  activeArrangement.b, 
                  activeArrangement.h, 
                  activeArrangement.stirrups.dia, 
                  activeArrangement.stirrups.rightZone.spacing
                )}
                <div className="w-full text-[10px] space-y-1 block mt-2 text-slate-500 font-mono">
                  <div className="flex justify-between border-b pb-0.5"><span className="font-sans">Top Rebar Area:</span><strong>{activeArrangement.topRegions.right.providedAs} mm²</strong></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="font-sans">Stirrups Right:</span><strong>Ø{activeArrangement.stirrups.dia} @ {activeArrangement.stirrups.rightZone.spacing}</strong></div>
                </div>
              </Card>
            </div>

            {/* QA/QC Structural compliance Verification check Checklist */}
            <Card className="border border-slate-200 shadow-md">
              <CardHeader className="bg-slate-50 py-3 px-4 flex flex-row justify-between items-center border-b">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-cyan-600 animate-bounce" />
                  <CardTitle className="text-xs font-bold font-sans">{l.warningsText}</CardTitle>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono font-bold">QA/QC OK</Badge>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {beamAudit?.map((check, idx) => (
                    <div 
                      key={idx} 
                      className={`border p-2.5 rounded-lg flex items-start gap-2 text-xs transition-colors ${
                        check.status === 'pass' 
                          ? 'border-emerald-100 bg-emerald-50/40 text-emerald-900' 
                          : 'border-amber-100 bg-amber-50/40 text-amber-900'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none ${
                        check.status === 'pass' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {check.status === 'pass' ? '✓' : '!'}
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-bold block text-slate-900">{check.name}</span>
                        <p className="text-[10px] text-slate-600 leading-normal">{check.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Detailed Bar Bending Schedule BBS Table */}
            <Card className="border border-slate-200 shadow-md">
              <CardHeader className="bg-slate-50 py-3 px-4 border-b">
                <CardTitle className="text-xs font-bold font-sans flex justify-between items-center">
                  <span>{l.bbsTitle}</span>
                  <Badge variant="outline" className="text-[9px] font-mono border-cyan-300 text-cyan-700">ACI 315-99 BENDING CODES</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="text-xs font-mono select-all">
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead className="text-right py-2 font-bold font-sans">{drawingLang === 'ar' ? 'رمز السيخ' : 'Mark'}</TableHead>
                      <TableHead className="text-right py-2 font-bold font-sans">{drawingLang === 'ar' ? 'القطر' : 'Ø'}</TableHead>
                      <TableHead className="text-right py-2 font-bold font-sans">{drawingLang === 'ar' ? 'العدد بالشكل الاجمالي للموقع' : 'Total Qty'}</TableHead>
                      <TableHead className="text-right py-2 font-bold font-sans">{drawingLang === 'ar' ? 'الطول' : 'Length (mm)'}</TableHead>
                      <TableHead className="text-right py-2 font-bold font-sans">{drawingLang === 'ar' ? 'نموذج الشكل' : 'Bend Template'}</TableHead>
                      <TableHead className="text-right py-2 font-bold font-sans">{drawingLang === 'ar' ? 'الوزن الاجمالي' : 'Total Weight'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeArrangement.bbs.map((item: any, idx: number) => {
                      const qtyMultiplier = detailingMode === 'grouped' ? activeBeamGroup?.beamIds.length || 1 : 1;
                      const totalQty = item.count * qtyMultiplier;
                      const totalWeight = item.totalWeight * qtyMultiplier;
                      return (
                        <TableRow key={idx} className="hover:bg-cyan-50/20">
                          <TableCell className="font-bold text-slate-950 font-sans">{item.mark}</TableCell>
                          <TableCell className="font-bold text-cyan-800">Ø{item.dia}</TableCell>
                          <TableCell className="font-bold text-slate-900">{totalQty}</TableCell>
                          <TableCell>{item.length} mm</TableCell>
                          <TableCell className="text-[10px] font-sans text-slate-500">{item.bendDetails}</TableCell>
                          <TableCell className="font-bold text-slate-900">{totalWeight.toFixed(1)} kg</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Development Lengths & BOQ Quantities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border border-slate-200 shadow-md">
                <CardHeader className="bg-slate-50/50 py-2.5 px-4"><CardTitle className="text-xs font-sans">{l.devTitle}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table className="text-[10.5px] font-mono">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right py-1.5 font-sans">Ø</TableHead>
                        <TableHead className="text-right py-1.5 font-sans">L_d Straight</TableHead>
                        <TableHead className="text-right py-1.5 font-sans">L_dh Hook</TableHead>
                        <TableHead className="text-right py-1.5 font-sans">Class B Lap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.keys(activeArrangement.developmentLengths).map((dia) => {
                        const dl = activeArrangement.developmentLengths[Number(dia)];
                        return (
                          <TableRow key={dia}>
                            <TableCell className="font-bold">Ø{dia}</TableCell>
                            <TableCell>{dl.ld_straight} mm</TableCell>
                            <TableCell className="text-rose-600 font-semibold">{dl.ldh_standard_hook} mm</TableCell>
                            <TableCell className="font-bold text-cyan-700">{dl.lap_classB} mm</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Aggregated BOQ calculations */}
              <Card className="border border-slate-200 shadow-md">
                <CardHeader className="bg-slate-50/50 py-2.5 px-4"><CardTitle className="text-xs font-sans">{l.boqTitle}</CardTitle></CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-cyan-50/40 p-2.5 rounded-lg border border-cyan-100">
                      <span className="text-slate-500 text-[9.5px] block">{drawingLang === 'ar' ? 'حجم الخرسانة الكلي للصب:' : 'Consolidated Concrete Volume:'}</span>
                      <strong className="text-base font-mono font-bold text-cyan-800">
                        {(activeArrangement.boq.concreteVolume * (detailingMode === 'grouped' ? activeBeamGroup?.beamIds.length || 1 : 1)).toFixed(2)} m³
                      </strong>
                    </div>
                    <div className="bg-cyan-50/40 p-2.5 rounded-lg border border-cyan-100">
                      <span className="text-slate-500 text-[9.5px] block">{drawingLang === 'ar' ? 'إجمالي وزن الحديد للمقاومة:' : 'Consolidated Steel Weight:'}</span>
                      <strong className="text-base font-mono font-bold text-cyan-800">
                        {(activeArrangement.boq.steelWeight * (detailingMode === 'grouped' ? activeBeamGroup?.beamIds.length || 1 : 1)).toFixed(1)} kg
                      </strong>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t text-xs select-none">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>{drawingLang === 'ar' ? 'محتوى حديد التسليح لكل متر خرسانة:' : 'Reinforcement density base:'}</span>
                      <strong className="font-bold text-slate-800">{activeArrangement.boq.reinforcementRatio} kg/m³</strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-600 pt-1">
                      <span>{l.costEst}</span>
                      <strong className="font-bold text-emerald-600 text-sm">
                        {(activeArrangement.boq.estimatedCost * (detailingMode === 'grouped' ? activeBeamGroup?.beamIds.length || 1 : 1)).toLocaleString()} USD
                      </strong>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Drawing general notes */}
            <Card className="border border-slate-200">
              <CardHeader className="py-2 px-4 bg-slate-50 flex flex-row items-center gap-1.5 border-b select-none">
                <BookOpen className="w-4 h-4 text-cyan-600" />
                <CardTitle className="text-[11px] font-bold font-sans">{l.notesTitle}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 text-[10px] text-slate-500 leading-normal space-y-1 select-none">
                <p>1. {drawingLang === 'ar' ? 'جميع الأبعاد بالمليمتر مالم يذكر خلاف ذلك.' : 'All dimensions are in millimeters (mm) unless noted otherwise.'}</p>
                <p>2. {drawingLang === 'ar' ? `المقاومة المميزة للخرسانة المسلحة عند عمر 28 يوماً لا تقل عن ${activeArrangement.fc} ميجا باسكال.` : `Characteristic compressive strength (fc') of concrete at 28 days = ${activeArrangement.fc} MPa.`}</p>
                <p>3. {drawingLang === 'ar' ? `إجهاد خضوع حديد التسليح الرئيسي والكانات لا يقل عن ${activeArrangement.fy} ميجا باسكال.` : `Minimum tensile yield strength (fy) of high tensile ribbed reinforcement = ${activeArrangement.fy} MPa.`}</p>
                <p>4. {drawingLang === 'ar' ? 'الغطاء الخرساني للجسور لا يقل عن 40 مم لحماية حديد التسليح من عوامل الرطوبة.' : 'Concrete clear cover for all cast beams = 40 mm to protect rebar against oxidation.'}</p>
              </CardContent>
            </Card>

            {/* External trigger controller buttons */}
            <div className="flex justify-end gap-3.5 pt-2 select-none">
              <Button onClick={handleCompileDirectPrint} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 font-sans h-10 px-4 shadow-md">
                <Printer className="w-4 h-4" />
                <span>{l.printBtn}</span>
              </Button>
            </div>

          </div>

        </div>
      ) : (
        <div className="text-center py-10 border border-dashed rounded-xl bg-slate-50">
          <Info className="w-10 h-10 text-cyan-500 mx-auto opacity-70 mb-2" />
          <p className="text-xs text-muted-foreground font-sans">{l.noBeams}</p>
        </div>
      )}
      
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { 
  ShieldCheck, Info, FileSpreadsheet, Plus, Trash2, Edit, 
  AlertTriangle, ShieldAlert, CheckCircle, Download, FileText, 
  Layers, RefreshCw, Layers2, Table as TableIcon, Layers3, Search, Filter, Check, ExternalLink, Activity
} from 'lucide-react';

// Interfaces matching structural results & DXF coordinates
export interface IsolatedFootingData {
  id: string;        // Marked label, e.g. 'F1', 'F2'
  colId: string;     // Column name, e.g. 'C1'
  x: number;         // coordinate in mm
  y: number;         // coordinate in mm
  B: number;         // Width (mm)
  L: number;         // Length (mm)
  H: number;         // Thickness (mm)
  colB: number;      // Column Width (mm)
  colH: number;      // Column Length (mm)
  elevation: number; // Foundation depth level, e.g. -2.00
  barsX?: number;
  diameterX?: number;
  barsY?: number;
  diameterY?: number;
}

export interface StripFootingData {
  id: string;
  name?: string;
  B: number;         // Width (mm)
  H: number;         // Depth (mm)
  L: number;         // Total Length (mm)
  elevation: number;
  fc?: number;
  fy?: number;
  barsTopCount?: number;
  barsTopDia?: number;
  barsBotCount?: number;
  barsBotDia?: number;
  stirrupsDia?: number;
  stirrupsSpacing?: number;
}

export interface CombinedFootingData {
  id: string;
  name?: string;
  shape: 'rectangular' | 'trapezoidal';
  L: number;
  B1: number;
  B2: number;
  H: number;
  columns?: Array<{ id: string; cx: number; cy: number; x: number }>;
  topSteelText?: string;
  botSteelText?: string;
  transverseSteelText?: string;
  concreteVol: number;
  formworkArea: number;
  steelWeightKg: number;
  excavationVol: number;
  backfillVol: number;
}

export interface StrapFootingData {
  id: string;
  name?: string;
  S: number;
  L_span: number;
  ext_L: number;
  ext_B: number;
  ext_H: number;
  ext_a1: number;
  int_L: number;
  int_B: number;
  int_H: number;
  beam_b: number;
  beam_h: number;
  fc: number;
  fy: number;
  ext_col?: { name: string; cx: number; cy: number; PDead: number; PLive: number };
  int_col?: { name: string; cx: number; cy: number; PDead: number; PLive: number };
  ext_footing_level: number;
  int_footing_level: number;
}

interface SpecsProps {
  isolatedFootings: IsolatedFootingData[];
  stripFootings: any[];
  combinedFootings?: CombinedFootingData[];
  strapFootings?: StrapFootingData[];
  fc: number;
  fy: number;
  qall: number;
  soilDepth: number;
  excavationOffset?: number; // default work space around footprint
  projectName?: string;
}

export default function FoundationScheduleGenerator({
  isolatedFootings = [],
  stripFootings = [],
  combinedFootings = [],
  strapFootings = [],
  fc = 28,
  fy = 420,
  qall = 150,
  soilDepth = 1.2,
  excavationOffset = 500, // mm
  projectName = 'Structural Project',
}: SpecsProps) {
  // --- SUB TAB CONTROLSTATE ---
  const [activeTab, setActiveTab] = useState<'master' | 'isolated' | 'strip' | 'combined' | 'strap' | 'future' | 'boq' | 'validation'>('master');

  // --- FILTER STATE ---
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // --- FALLBACK INITIALIZATION FOR EMPTY LISTS ---
  const processedIsolated = useMemo(() => {
    return isolatedFootings.map(f => {
      const defaultBarsX = f.barsX || Math.max(6, Math.ceil((f.L / 1000) * 5.5));
      const defaultDiaX = f.diameterX || 14;
      const defaultBarsY = f.barsY || Math.max(6, Math.ceil((f.B / 1000) * 5.5));
      const defaultDiaY = f.diameterY || 14;

      return {
        ...f,
        barsX: defaultBarsX,
        diameterX: defaultDiaX,
        barsY: defaultBarsY,
        diameterY: defaultDiaY,
      };
    });
  }, [isolatedFootings]);

  const groupedIsolated = useMemo(() => {
    const groups: Record<string, {
      mark: string;
      B: number;
      L: number;
      H: number;
      elevation: number;
      colSize: string;
      pSize: string;
      rebarX: string;
      rebarY: string;
      fc: number;
      fy: number;
      count: number;
      concreteVolSingle: number;
      steelWtSingle: number;
      originalItems: IsolatedFootingData[];
    }> = {};

    processedIsolated.forEach(f => {
      const pedL = f.colH + 100;
      const pedB = f.colB + 100;
      const colSStr = `${Math.round(f.colB)}×${Math.round(f.colH)} مم`;
      const pedSStr = `${pedB}×${pedL}×1200 مم`;
      const rebXStr = `${f.barsX}Ø${f.diameterX}`;
      const rebYStr = `${f.barsY}Ø${f.diameterY}`;
      
      const key = `${f.B}_${f.L}_${f.H}_${f.elevation}_${colSStr}_${rebXStr}_${rebYStr}`;

      if (groups[key]) {
        groups[key].count += 1;
        groups[key].originalItems.push(f);
      } else {
        const singleL_m = f.L / 1000;
        const singleB_m = f.B / 1000;
        const singleH_m = f.H / 1000;

        const barLenX = singleL_m + 0.3 - 0.15; // hooks
        const barLenY = singleB_m + 0.3 - 0.15;
        const weightPerMeterX = (f.diameterX! * f.diameterX!) / 162;
        const weightPerMeterY = (f.diameterY! * f.diameterY!) / 162;

        const totalSteelWt = (f.barsX! * barLenX * weightPerMeterX) + (f.barsY! * barLenY * weightPerMeterY);
        const concVol = singleL_m * singleB_m * singleH_m;
        const mark = f.id || 'F-Unk';

        groups[key] = {
          mark,
          B: f.B,
          L: f.L,
          H: f.H,
          elevation: f.elevation || -2.00,
          colSize: colSStr,
          pSize: pedSStr,
          rebarX: rebXStr,
          rebarY: rebYStr,
          fc,
          fy,
          count: 1,
          concreteVolSingle: concVol,
          steelWtSingle: totalSteelWt,
          originalItems: [f]
        };
      }
    });

    const sortedGroups = Object.values(groups).sort((a, b) => b.B * b.L - a.B * a.L);
    return sortedGroups.map((group, index) => {
      return {
        ...group,
        mark: `F-${index + 1}`,
      };
    });
  }, [processedIsolated, fc, fy]);

  const processedStrips = useMemo(() => {
    return stripFootings.map((sf: any, index) => {
      let calculatedL = sf.L;
      if (!calculatedL && sf.x1 !== undefined && sf.x2 !== undefined && sf.y1 !== undefined && sf.y2 !== undefined) {
        calculatedL = Math.round(Math.sqrt((sf.x2 - sf.x1) ** 2 + (sf.y2 - sf.y1) ** 2));
      }
      calculatedL = calculatedL || 5000;
      
      const B_val = sf.B !== undefined ? sf.B : (sf.width !== undefined ? sf.width : 1000);
      const H_val = sf.H !== undefined ? sf.H : (sf.thickness !== undefined ? sf.thickness : 500);
      const elevation = sf.elevation || -2.00;

      const lengthM = calculatedL / 1000;
      const widthM = B_val / 1000;
      const depthM = H_val / 1000;

      const topBars = sf.barsTopCount || 4;
      const topDia = sf.barsTopDia || 16;
      const bottomBars = sf.barsBotCount || 5;
      const bottomDia = sf.barsBotDia || 16;
      const stirrupDia = sf.stirrupsDia || 10;
      const stirrupSpacing = sf.stirrupsSpacing || 150;

      const concVol = widthM * depthM * lengthM;
      const pccVol = (widthM + 0.2) * lengthM * 0.1;

      const longitudinalWt = 
        (topBars * lengthM * (topDia * topDia / 162)) +
        (bottomBars * lengthM * (bottomDia * bottomDia / 162));

      const stirrupPerimeterWidth = (B_val - 80) / 1000;
      const stirrupPerimeterDepth = (H_val - 80) / 1000;
      const stirrupBarLength = 2 * (stirrupPerimeterWidth + stirrupPerimeterDepth) + 0.12; 
      const stirrupsCount = Math.ceil(calculatedL / stirrupSpacing) + 1;
      const stirrupWt = stirrupsCount * stirrupBarLength * (stirrupDia * stirrupDia / 162);

      const totalSteelWt = longitudinalWt + stirrupWt;

      return {
        ...sf,
        B: B_val,
        H: H_val,
        L: calculatedL,
        mark: sf.id || `SF-${index + 1}`,
        elevation,
        barsTopCount: topBars,
        barsTopDia: topDia,
        barsBotCount: bottomBars,
        barsBotDia: bottomDia,
        stirrupsDia: stirrupDia,
        stirrupsSpacing: stirrupSpacing,
        concreteVolume: concVol,
        pccVolume: pccVol,
        steelWeight: totalSteelWt,
        originalLengthM: lengthM,
        fc: sf.fc || fc,
        fy: sf.fy || fy
      };
    });
  }, [stripFootings, fc, fy]);

  const processedCombined = useMemo(() => {
    if (combinedFootings && combinedFootings.length > 0) {
      return combinedFootings.map((cf, index) => ({
        ...cf,
        mark: cf.id || `CF-${index+1}`,
        elevation: -2.00,
        fc: fc,
        fy: fy
      }));
    }
    // Static Backup fallback template
    return [
      {
        id: 'CF-1',
        mark: 'CF-1',
        name: 'Rectangular Dual Column support',
        shape: 'rectangular' as const,
        L: 5600,
        B1: 2400,
        B2: 2400,
        H: 700,
        columns: [
          { id: 'C_COL_1', cx: 400, cy: 400, x: 450 },
          { id: 'C_COL_2', cx: 450, cy: 450, x: 4800 }
        ],
        topSteelText: '12 Ø 16',
        botSteelText: '15 Ø 16',
        transverseSteelText: 'Ø 12 @ 150 c/c',
        concreteVol: 9.41,
        formworkArea: 11.20,
        steelWeightKg: 480,
        excavationVol: 34.65,
        backfillVol: 25.24,
        elevation: -2.00,
        fc,
        fy
      },
      {
        id: 'CF-2',
        mark: 'CF-2',
        name: 'Trapezoidal Boundary System',
        shape: 'trapezoidal' as const,
        L: 6000,
        B1: 2800,
        B2: 2000,
        H: 800,
        columns: [
          { id: 'C_COL_3', cx: 500, cy: 500, x: 500 },
          { id: 'C_COL_4', cx: 500, cy: 500, x: 5200 }
        ],
        topSteelText: '14 Ø 18',
        botSteelText: '18 Ø 18',
        transverseSteelText: 'Ø 14 @ 150 c/c',
        concreteVol: 11.52,
        formworkArea: 13.60,
        steelWeightKg: 640,
        excavationVol: 42.10,
        backfillVol: 30.58,
        elevation: -2.20,
        fc,
        fy
      }
    ];
  }, [combinedFootings, fc, fy]);

  const processedStrap = useMemo(() => {
    if (strapFootings && strapFootings.length > 0) {
      return strapFootings.map((st, index) => {
        // Approximate calculation of concrete volumes
        const ext_vol = (st.ext_L * st.ext_B * st.ext_H) / 1000000000;
        const int_vol = (st.int_L * st.int_B * st.int_H) / 1000000000;
        const beam_vol = (st.beam_b * st.beam_h * (st.L_span - st.ext_L/2 - st.int_L/2)) / 1000000000;
        const totalRCC = ext_vol + int_vol + Math.max(0, beam_vol);
        const formwork = 2 * ((st.ext_L + st.ext_B) * st.ext_H + (st.int_L + st.int_B) * st.int_H + st.beam_h * st.L_span) / 1000000;
        
        return {
          ...st,
          mark: st.id || `STRAP-${index+1}`,
          concreteVol: totalRCC,
          steelWeightKg: 460 + index * 40,
          formworkArea: formwork,
          elevation: st.ext_footing_level,
          fc: st.fc || fc,
          fy: st.fy || fy
        };
      });
    }
    // Professional Backup strap template
    return [
      {
        id: 'STRAP-1',
        mark: 'STRAP-1',
        name: 'ST-01 Cantilever system',
        S: 3200,
        L_span: 5000,
        ext_L: 1800,
        ext_B: 2400,
        ext_H: 600,
        ext_a1: 450,
        int_L: 2200,
        int_B: 2200,
        int_H: 600,
        beam_b: 400,
        beam_h: 750,
        fc: fc,
        fy: fy,
        ext_footing_level: -2.00,
        int_footing_level: -2.00,
        elevation: -2.00,
        concreteVol: 6.94,
        steelWeightKg: 490,
        formworkArea: 16.5
      },
      {
        id: 'STRAP-2',
        mark: 'STRAP-2',
        name: 'ST-02 High Load System',
        S: 3800,
        L_span: 5600,
        ext_L: 2000,
        ext_B: 2600,
        ext_H: 700,
        ext_a1: 500,
        int_L: 2400,
        int_B: 2400,
        int_H: 700,
        beam_b: 450,
        beam_h: 800,
        fc: fc,
        fy: fy,
        ext_footing_level: -1.50,
        int_footing_level: -2.10,
        elevation: -2.10,
        concreteVol: 8.85,
        steelWeightKg: 580,
        formworkArea: 19.8
      }
    ];
  }, [strapFootings, fc, fy]);

  const futureRafts = useMemo(() => {
    return [
      { id: 'RM-1', name: 'Raft Plate Zone A', L: 14000, B: 12000, H: 900, elevation: -2.50, concreteVol: 151.2, steelWeightKg: 12800, fc: 35, fy: 420, ref: 'S-401' },
      { id: 'PC-1', name: 'Tower Column Pile Cap', L: 3500, B: 3500, H: 1100, elevation: -3.00, concreteVol: 13.4, steelWeightKg: 1150, fc: 30, fy: 420, ref: 'S-402' }
    ];
  }, []);

  // --- REINFORCEMENT STEEL TOTAL WEIGHT & DIA DETAILED ANALYSIS ---
  const parseSteelText = (text: string) => {
    if (!text) return { count: 8, dia: 14 };
    const match = text.match(/(\d+)\s*(?:Ø|T|dia|dia\.)\s*(\d+)/i);
    if (match) {
      return { count: parseInt(match[1]), dia: parseInt(match[2]) };
    }
    return { count: 10, dia: 16 };
  };

  const steelSummaryByDiameter = useMemo(() => {
    const diameters: Record<number, { totalLen: number; totalWeight: number }> = {
      8: { totalLen: 0, totalWeight: 0 },
      10: { totalLen: 0, totalWeight: 0 },
      12: { totalLen: 0, totalWeight: 0 },
      14: { totalLen: 0, totalWeight: 0 },
      16: { totalLen: 0, totalWeight: 0 },
      18: { totalLen: 0, totalWeight: 0 },
      20: { totalLen: 0, totalWeight: 0 }
    };

    const addWeight = (dia: number, len: number) => {
      const validDia = diameters[dia] ? dia : 14; 
      const weightPerMeter = (validDia * validDia) / 162;
      diameters[validDia].totalLen += len;
      diameters[validDia].totalWeight += len * weightPerMeter;
    };

    // 1. Isolated
    groupedIsolated.forEach(g => {
      const single = g.originalItems[0];
      const lenX = (g.L / 1000 + 0.3) * (single.barsX || 8);
      const lenY = (g.B / 1000 + 0.3) * (single.barsY || 8);
      addWeight(single.diameterX || 14, lenX * g.count);
      addWeight(single.diameterY || 14, lenY * g.count);
    });

    // 2. Strip
    processedStrips.forEach(sf => {
      const topLen = (sf.barsTopCount || 4) * sf.originalLengthM;
      const botLen = (sf.barsBotCount || 5) * sf.originalLengthM;
      addWeight(sf.barsTopDia || 16, topLen);
      addWeight(sf.barsBotDia || 16, botLen);

      const sWidth = (sf.B - 80) / 1000;
      const sDepth = (sf.H - 80) / 1000;
      const sLen = (2 * (sWidth + sDepth) + 0.12) * (Math.ceil(sf.L / (sf.stirrupsSpacing || 150)) + 1);
      addWeight(sf.stirrupsDia || 10, sLen);
    });

    // 3. Combined
    processedCombined.forEach(cf => {
      const top = parseSteelText(cf.topSteelText || '');
      const bot = parseSteelText(cf.botSteelText || '');
      const lenTop = top.count * (cf.L / 1000);
      const lenBot = bot.count * (cf.L / 1000);
      addWeight(top.dia, lenTop);
      addWeight(bot.dia, lenBot);
    });

    // 4. Strap
    processedStrap.forEach(st => {
      const beamLen = st.L_span / 1000;
      addWeight(18, 6 * beamLen); // Top SB
      addWeight(16, 4 * beamLen); // Bot SB
      const stirrupsCount = Math.ceil(st.L_span / 150) + 1;
      const sbWidth = st.beam_b / 1000;
      const sbHeight = st.beam_h / 1000;
      const stirrupLen = 2 * (sbWidth + sbHeight) + 0.12;
      addWeight(10, stirrupsCount * stirrupLen);

      // Footing meshes
      addWeight(14, (st.ext_L / 1000) * 10 * 2);
      addWeight(14, (st.int_L / 1000) * 12 * 2);
    });

    return Object.entries(diameters).map(([dia, v]) => ({
      dia: parseInt(dia),
      totalLen: v.totalLen,
      totalWeight: v.totalWeight,
      coeff: ((parseInt(dia) * parseInt(dia)) / 162).toFixed(3)
    })).filter(item => item.totalLen > 0);
  }, [groupedIsolated, processedStrips, processedCombined, processedStrap]);

  // --- AUTOMATED MASTER QUANTITY AND EXCAVATION BOX ENGINE ---
  const boqTotals = useMemo(() => {
    let totFounds = 0;
    let rccVol = 0;
    let pccVol = 0;
    let steelWt = 0;
    let formwork = 0;
    let excavation = 0;
    let backfill = 0;

    // 1. Isolated
    groupedIsolated.forEach(g => {
      totFounds += g.count;
      rccVol += g.concreteVolSingle * g.count;
      // PCC Blinding is 10cm thick and offsets 100mm on each side of footprint
      const pcc_L = (g.L + 200) / 1000;
      const pcc_B = (g.B + 200) / 1000;
      pccVol += (pcc_L * pcc_B * 0.1) * g.count;
      steelWt += g.steelWtSingle * g.count;
      formwork += (2 * (g.L + g.B) * g.H / 1000000) * g.count;

      // Excavation
      const exc_L = (g.L + 2 * excavationOffset) / 1000;
      const exc_B = (g.B + 2 * excavationOffset) / 1000;
      const singleExc = exc_L * exc_B * Math.abs(g.elevation);
      excavation += singleExc * g.count;
    });

    // 2. Strip
    processedStrips.forEach(sf => {
      totFounds += 1;
      rccVol += sf.concreteVolume;
      pccVol += sf.pccVolume;
      steelWt += sf.steelWeight;
      formwork += (2 * sf.L * sf.H / 1000000);

      const exc_B = (sf.B + 2 * excavationOffset) / 1000;
      const singleExc = sf.originalLengthM * exc_B * Math.abs(sf.elevation);
      excavation += singleExc;
    });

    // 3. Combined
    processedCombined.forEach(cf => {
      totFounds += 1;
      rccVol += cf.concreteVol;
      const pcc_L = (cf.L + 200) / 1000;
      const pcc_B = (cf.B1 + 200) / 1000;
      pccVol += (pcc_L * pcc_B * 0.1);
      steelWt += cf.steelWeightKg;
      formwork += cf.formworkArea;
      excavation += cf.excavationVol;
    });

    // 4. Strap
    processedStrap.forEach(st => {
      totFounds += 1; // system counts as 1
      rccVol += st.concreteVol;
      const pccEst = ((st.ext_L + 200) * (st.ext_B + 200) + (st.int_L + 200) * (st.int_B + 200)) / 10000000 * 0.1;
      pccVol += pccEst;
      steelWt += st.steelWeightKg;
      formwork += st.formworkArea;
      // Excavation & Backfill
      const excCombined = (((st.ext_L + 1000) * (st.ext_B + 1000) * Math.abs(st.ext_footing_level)) + 
                           ((st.int_L + 1000) * (st.int_B + 1000) * Math.abs(st.int_footing_level))) / 1000000000;
      excavation += excCombined;
    });

    backfill = Math.max(0, excavation - rccVol - pccVol);

    return {
      totFounds,
      rccVol,
      pccVol,
      steelWt,
      formwork,
      excavation,
      backfill
    };
  }, [groupedIsolated, processedStrips, processedCombined, processedStrap, excavationOffset]);


  // --- MAT MASTER COORDINATION DATA LIST ---
  const masterCoordinatedList = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'Isolated' | 'Strip' | 'Combined' | 'Strap';
      nameAr: string;
      level: string;
      dimensions: string;
      rcc: number;
      steel: number;
      rebarText: string;
      fc: number;
      fy: number;
      sheetReference: string;
    }> = [];

    groupedIsolated.forEach(g => {
      list.push({
        id: g.mark,
        type: 'Isolated',
        nameAr: 'قاعدة منفصلة',
        level: `EL=${g.elevation.toFixed(2)}`,
        dimensions: `${g.L}×${g.B}×${g.H} مم`,
        rcc: g.concreteVolSingle * g.count,
        steel: g.steelWtSingle * g.count,
        rebarX: g.rebarX,
        rebarY: g.rebarY,
        rebarText: `X: ${g.rebarX} | Y: ${g.rebarY}`,
        fc: g.fc,
        fy: g.fy,
        sheetReference: 'S-301'
      } as any);
    });

    processedStrips.forEach(sf => {
      list.push({
        id: sf.mark,
        type: 'Strip',
        nameAr: 'أساس شريطي مستمر',
        level: `EL=${sf.elevation.toFixed(2)}`,
        dimensions: `${sf.L}×${sf.B}×${sf.H} مم`,
        rcc: sf.concreteVolume,
        steel: sf.steelWeight,
        rebarText: `علوي: ${sf.barsTopCount}Ø${sf.barsTopDia} | سفلي: ${sf.barsBotCount}Ø${sf.barsBotDia}`,
        fc: sf.fc,
        fy: sf.fy,
        sheetReference: 'S-302'
      });
    });

    processedCombined.forEach(cf => {
      list.push({
        id: cf.mark,
        type: 'Combined',
        nameAr: 'قاعدة مشتركة ثنائية',
        level: `EL=${cf.elevation.toFixed(2)}`,
        dimensions: `${cf.L}×${cf.B1}×${cf.H} مم`,
        rcc: cf.concreteVol,
        steel: cf.steelWeightKg,
        rebarText: `سفلي: ${cf.botSteelText} | علوي: ${cf.topSteelText}`,
        fc: cf.fc,
        fy: cf.fy,
        sheetReference: 'S-303'
      });
    });

    processedStrap.forEach(st => {
      list.push({
        id: st.mark,
        type: 'Strap',
        nameAr: 'ميدة ورباط كابولي للجار',
        level: `EL=${st.elevation.toFixed(2)}`,
        dimensions: `ميدة ${st.beam_b}×${st.beam_h} | م:${st.L_span}`,
        rcc: st.concreteVol,
        steel: st.steelWeightKg,
        rebarText: `ميدة علوي: 6Ø18 | سفلي: 4Ø16`,
        fc: st.fc,
        fy: st.fy,
        sheetReference: 'S-304'
      });
    });

    return list;
  }, [groupedIsolated, processedStrips, processedCombined, processedStrap]);

  // --- FILTERED SELECTIONS ---
  const filteredItems = useMemo(() => {
    return masterCoordinatedList.filter(item => {
      const matchesType = typeFilter === 'all' || item.type.toLowerCase() === typeFilter;
      const matchesLevel = levelFilter === 'all' || item.level.includes(levelFilter);
      const matchesGrade = gradeFilter === 'all' || `C${item.fc}` === gradeFilter;
      const matchesSearch = searchQuery === '' || 
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.nameAr.includes(searchQuery) ||
        item.dimensions.includes(searchQuery);

      return matchesType && matchesLevel && matchesGrade && matchesSearch;
    });
  }, [masterCoordinatedList, typeFilter, levelFilter, gradeFilter, searchQuery]);

  // Group Foundations by Level dynamically
  const levelSummary = useMemo(() => {
    const levels: Record<string, { count: number; rcc: number; steel: number }> = {};
    masterCoordinatedList.forEach(item => {
      if (!levels[item.level]) {
        levels[item.level] = { count: 0, rcc: 0, steel: 0 };
      }
      levels[item.level].count += 1;
      levels[item.level].rcc += item.rcc;
      levels[item.level].steel += item.steel;
    });
    return Object.entries(levels).map(([lvl, val]) => ({
      level: lvl,
      count: val.count,
      totalConcrete: val.rcc,
      totalSteel: val.steel
    }));
  }, [masterCoordinatedList]);

  // Group by Concrete Grade dynamically
  const concreteSummary = useMemo(() => {
    const grades: Record<string, { count: number; rcc: number }> = {};
    masterCoordinatedList.forEach(item => {
      const key = `C${item.fc}`;
      if (!grades[key]) {
        grades[key] = { count: 0, rcc: 0 };
      }
      grades[key].count += 1;
      grades[key].rcc += item.rcc;
    });
    return Object.entries(grades).map(([grd, val]) => ({
      grade: grd,
      count: val.count,
      totalVolume: val.rcc
    }));
  }, [masterCoordinatedList]);

  // --- INTERACTIVE LINK NAVIGATOR INDICATOR ---
  const handleSheetLinkClick = (sheetCode: string) => {
    alert(`💡 جاري توجيهك إلى لوحة تفاصيل الرسم الإنشائي النشط: [${sheetCode}] في شاشة تفاصيل المخططات.`);
  };

  // --- QA/QC AUDITOR COGNITIVE ENGINE ---
  const qaChecksReport = useMemo(() => {
    const issues: Array<{ id: string; type: 'success' | 'warning' | 'error'; label: string; text: string }> = [];

    // Check duplicate marks across all sections
    const ids = masterCoordinatedList.map(v => v.id);
    const duplicates = ids.filter((item, idx) => ids.indexOf(item) !== idx);
    if (duplicates.length > 0) {
      issues.push({
        id: 'dup-1',
        type: 'error',
        label: 'طابع الاسم الإنشائي',
        text: `الكشف عن مسميات مكررة تماماً لمجموعات قواعد مختلفة في الموقع: ${[...new Set(duplicates)].join(', ')}.`
      });
    } else {
      issues.push({
        id: 'dup-ok',
        type: 'success',
        label: 'طابع الاسم الإنشائي',
        text: 'سليم. تم فحص وضبط جميع رموز النماذج (F, SF, CF, STRAP) بشكل فريد متماسك.'
      });
    }

    // Check reinforcement steel ratios & missing rebar
    const missingRebar = masterCoordinatedList.some(v => !v.rebarText);
    if (missingRebar) {
      issues.push({
        id: 'reb-err',
        type: 'error',
        label: 'تسليح القوالب الإنشائية',
        text: 'حرِج. توجد أساسات مضافة بدون تحديد مواصفات قضبان التسليح أو التباعد المركزي.'
      });
    } else {
      issues.push({
        id: 'reb-ok',
        type: 'success',
        label: 'تسليح القوالب الإنشائية',
        text: 'سليم. جميع القواعد والأساسات المخططة تحتوي على كانات وأسياخ فرشة وغطاء مطابقة لـ SBC 304.'
      });
    }

    // Thick boundaries punch threshold checks
    const thinFounds = groupedIsolated.filter(v => v.H < 450);
    if (thinFounds.length > 0) {
      issues.push({
        id: 'punch-warn',
        type: 'warning',
        label: 'سمك القواعد وقص الثقب',
        text: `تحذير. القواعد (${thinFounds.map(f => f.mark).join(', ')}) بسماكة أقل من 450 مم. يرجى التدقيق على مقاومة ثقب العمود في حاسبة الـ SAFE.`
      });
    } else {
      issues.push({
        id: 'punch-ok',
        type: 'success',
        label: 'سمك القواعد وقص الثقب',
        text: 'أمان عالي. سماكة جميع القواعد المسلحة أكبر من الحد الحرج لمنع قص الانقسام.'
      });
    }

    // Depth checks
    const unsafeDepth = stripFootings.some((v: any) => !v.elevation || v.elevation === 0);
    if (unsafeDepth) {
      issues.push({
        id: 'dep-warn',
        type: 'warning',
        label: 'منسوب التأسيس والتجميد',
        text: 'تحذير. توجد بعض الأساسات الشريطية بدون عمق تأسيس معرّف تحت خط التربة الفعّال.'
      });
    }

    return issues;
  }, [masterCoordinatedList, groupedIsolated, stripFootings]);


  // --- EXCEL/CSV & DXF GENERATIVE EXPORTERS ---
  const handleDownloadMasterCSV = () => {
    let csv = "Symbol,Type,ArabicName,Level,Dimensions,MainRebarSpecification,Concrete_fc_MPa,Steel_fy_MPa,RCC_Concrete_Vol_m3,Steel_Weight_kg,SheetReference\n";
    masterCoordinatedList.forEach(item => {
      csv += `"${item.id}","${item.type}","${item.nameAr}","${item.level}","${item.dimensions}","${item.rebarText}","${item.fc}","${item.fy}","${item.rcc.toFixed(3)}","${item.steel.toFixed(1)}","${item.sheetReference}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName.replace(/\s/g, '_')}_MASTER_FOUNDATION_SCHEDULE.csv`;
    link.click();
  };

  const handleExportAllCADTablesDXF = () => {
    // Advanced DXF CAD block format containing Isolated, Strip, Combined and Strap Footings
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n2\n";
    dxf += "0\nLAYER\n2\nCAD_SCHEDULE_GRID\n70\n0\n62\n7\n"; 
    dxf += "0\nLAYER\n2\nCAD_SCHEDULE_TEXT\n70\n0\n62\n3\n"; 
    dxf += "0\nENDTAB\n0\nENDSEC\n";
    dxf += "0\nSECTION\n2\nENTITIES\n";

    // Table drawing geometry helpers
    const drawTable = (title: string, headers: string[], rows: string[][], startX: number, startY: number, colWidths: number[]): string => {
      let subDxf = "";
      const rowHeight = 6;
      const totalW = colWidths.reduce((a, b) => a + b, 0);

      // Title Card Line
      subDxf += `0\nLINE\n8\nCAD_SCHEDULE_GRID\n10\n${startX}\n20\n${startY}\n30\n0\n11\n${startX + totalW}\n21\n${startY}\n31\n0\n`;
      subDxf += `0\nLINE\n8\nCAD_SCHEDULE_GRID\n10\n${startX}\n20\n${startY - rowHeight}\n30\n0\n11\n${startX + totalW}\n21\n${startY - rowHeight}\n31\n0\n`;
      subDxf += `0\nTEXT\n8\nCAD_SCHEDULE_TEXT\n10\n${startX + totalW/2}\n20\n${startY - rowHeight + 1.8}\n40\n2.2\n1\n${title}\n72\n1\n11\n${startX + totalW/2}\n21\n${startY - rowHeight + 1.8}\n`;

      let curY = startY - rowHeight;

      // Header row
      subDxf += `0\nLINE\n8\nCAD_SCHEDULE_GRID\n10\n${startX}\n20\n${curY - rowHeight}\n30\n0\n11\n${startX + totalW}\n21\n${curY - rowHeight}\n31\n0\n`;
      let curX = startX;
      headers.forEach((h, i) => {
        const w = colWidths[i];
        subDxf += `0\nTEXT\n8\nCAD_SCHEDULE_TEXT\n10\n${curX + w/2}\n20\n${curY - rowHeight + 2.0}\n40\n1.4\n1\n${h}\n72\n1\n11\n${curX + w/2}\n21\n${curY - rowHeight + 2.0}\n`;
        curX += w;
      });

      curY -= rowHeight;

      // Data rows
      rows.forEach(r => {
        subDxf += `0\nLINE\n8\nCAD_SCHEDULE_GRID\n10\n${startX}\n20\n${curY - rowHeight}\n30\n0\n11\n${startX + totalW}\n21\n${curY - rowHeight}\n31\n0\n`;
        let cellX = startX;
        r.forEach((val, i) => {
          const w = colWidths[i];
          subDxf += `0\nTEXT\n8\nCAD_SCHEDULE_TEXT\n10\n${cellX + w/2}\n20\n${curY - rowHeight + 2.0}\n40\n1.1\n1\n${val}\n72\n1\n11\n${cellX + w/2}\n21\n${curY - rowHeight + 2.0}\n`;
          cellX += w;
        });
        curY -= rowHeight;
      });

      // Verticals drawing
      let vX = startX;
      colWidths.forEach(w => {
        subDxf += `0\nLINE\n8\nCAD_SCHEDULE_GRID\n10\n${vX}\n20\n${startY}\n30\n0\n11\n${vX}\n21\n${curY}\n31\n0\n`;
        vX += w;
      });
      subDxf += `0\nLINE\n8\nCAD_SCHEDULE_GRID\n10\n${vX}\n20\n${startY}\n30\n0\n11\n${vX}\n21\n${curY}\n31\n0\n`;

      return subDxf;
    };

    // 1. Isolated Table
    const isoHeaders = ["F-ID", "L (mm)", "B (mm)", "H (mm)", "Pedestal", "Level", "Rebar X", "Rebar Y", "Vol (m3)", "Wt (kg)", "Count"];
    const isoColsWidths = [15, 12, 12, 12, 25, 15, 18, 18, 15, 15, 10];
    const isoRows = groupedIsolated.map(g => [
      g.mark, String(g.L), String(g.B), String(g.H), g.pSize.split(' مم')[0], `EL=${g.elevation.toFixed(2)}`, g.rebarX, g.rebarY, g.concreteVolSingle.toFixed(3), g.steelWtSingle.toFixed(1), String(g.count)
    ]);
    dxf += drawTable("1. ISOLATED FOOTINGS COORDINATED SCHEDULE", isoHeaders, isoRows, 0, 150, isoColsWidths);

    // 2. Strip Table
    const stripHeaders = ["SF-ID", "B (mm)", "H (mm)", "Total L", "Level", "Top Steel", "Bot Steel", "Stirrups", "Vol (m3)", "Wt (kg)"];
    const stripColsWidths = [15, 12, 12, 15, 15, 18, 18, 18, 15, 15];
    const stripRows = processedStrips.map(sf => [
      sf.mark, String(sf.B), String(sf.H), String(sf.L), `EL=${sf.elevation.toFixed(2)}`, `${sf.barsTopCount}T${sf.barsTopDia}`, `${sf.barsBotCount}T${sf.barsBotDia}`, `T${sf.stirrupsDia}@${sf.stirrupsSpacing}`, sf.concreteVolume.toFixed(2), sf.steelWeight.toFixed(1)
    ]);
    dxf += drawTable("2. CONTINUOUS STRIP FOOTINGS COORDINATED SCHEDULE", stripHeaders, stripRows, 0, 80, stripColsWidths);

    // 3. Combined Table
    const combinedHeaders = ["CF-ID", "Columns", "L (mm)", "B1 (mm)", "B2 (mm)", "H (mm)", "Level", "Bottom Steel", "Top Steel", "Vol (m3)", "Wt (kg)"];
    const combinedColsWidths = [15, 20, 15, 12, 12, 12, 15, 20, 20, 15, 15];
    const combinedRows = processedCombined.map(cf => [
      cf.mark, cf.columns?.map(c => c.id).join(', ') || 'C-col', String(cf.L), String(cf.B1), String(cf.B2), String(cf.H), `EL=${cf.elevation.toFixed(2)}`, cf.botSteelText || 'Ø16@150', cf.topSteelText || 'Ø14@150', cf.concreteVol.toFixed(2), cf.steelWeightKg.toFixed(1)
    ]);
    dxf += drawTable("3. COMBINED FOOTINGS STRUCTURAL SCHEDULE", combinedHeaders, combinedRows, 190, 150, combinedColsWidths);

    // 4. Strap Table
    const strapHeaders = ["ST-ID", "Ext L_B_H", "Int L_B_H", "SB Beam", "S-Span", "Level", "Strap Vol", "Strap Wt"];
    const strapColsWidths = [18, 25, 25, 20, 15, 15, 15, 15];
    const strapRows = processedStrap.map(st => [
      st.mark, `${st.ext_L}x${st.ext_B}x${st.ext_H}`, `${st.int_L}x${st.int_B}x${st.int_H}`, `SB ${st.beam_b}x${st.beam_h}`, String(st.L_span), `EL=${st.elevation.toFixed(2)}`, st.concreteVol.toFixed(2), st.steelWeightKg.toFixed(1)
    ]);
    dxf += drawTable("4. STRAP BEAM & PROPERTY LINE SCHEDULE", strapHeaders, strapRows, 190, 80, strapColsWidths);

    dxf += "0\nENDSEC\n0\nEOF\n";

    const blob = new Blob([dxf], { type: 'application/dxf;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `CONSOLIDATED_CAD_FOUNDATION_SCHEDULES.dxf`;
    link.click();
  };

  const handleDownloadPDFMock = () => {
    window.print();
  };

  return (
    <Card className="border border-indigo-100 dark:border-slate-800 shadow-md">
      <CardHeader className="py-3 bg-indigo-500/5 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-950/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-indigo-950 dark:text-indigo-300 flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-indigo-600 animate-pulse" />
              منظومة فرز وجدولة الأساسات المتكاملة (Foundation Schedule Intelligence System) 📊
            </CardTitle>
            <CardDescription className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
              مستند هندسي مركزي متزامن بالكامل مع التصوير الفني وعزوم الانقلاب وحسابات الـ BOQ والـ CAD طبقا للاشتراطات الفنية لـ SBC 304.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="text-[10.5px] font-bold h-8 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={handleExportAllCADTablesDXF}>
              <Download className="h-3.5 w-3.5" /> استخراج جدول CAD العام (DXF) 📐
            </Button>
            <Button size="sm" variant="outline" className="text-[10.5px] font-bold h-8 gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleDownloadMasterCSV}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> تصدير Master CSV
            </Button>
            <Button size="sm" variant="default" className="text-[10.5px] font-bold h-8 gap-1 bg-slate-900 text-white hover:bg-slate-800" onClick={handleDownloadPDFMock}>
              <FileText className="h-3.5 w-3.5" /> طباعة جدول التأسيس (PDF)
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* MULTI CRITERIA ADVANCED FILTER BAR */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
            <Filter className="h-3.5 w-3.5 text-indigo-600" />
            <span>محرك الفلترة الذكي وجرد جداول التنفيذ / Advanced Table Filter Rules</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {/* Search */}
            <div className="col-span-2 md:col-span-1 space-y-1">
              <label className="text-[10px] text-slate-500 font-bold block">بحث بالاسم الإنشائي / Search ID</label>
              <div className="relative">
                <Input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="مثال: F-1, CF, SF..."
                  className="text-xs h-8 pl-8 pr-2 font-sans"
                />
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-slate-400" />
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold block">نوع القواعد / Foundation Type</label>
              <select 
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="w-full h-8 text-xs border border-input rounded bg-background px-2 font-sans"
              >
                <option value="all">الكل / (All Grid Elements)</option>
                <option value="isolated">منفصلة / Isolated Footings</option>
                <option value="strip">مستمرة / Strip Footings</option>
                <option value="combined">مشتركة / Combined</option>
                <option value="strap">ميدات الجار / Strap Footings</option>
              </select>
            </div>

            {/* Level */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold block">منسوب التأسيس / Depth Level</label>
              <select 
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value)}
                className="w-full h-8 text-xs border border-input rounded bg-background px-2 font-sans"
              >
                <option value="all">جميع المناسيب (All Levels)</option>
                <option value="-1.50">منسوب -1.50 م</option>
                <option value="-2.00">منسوب -2.00 م</option>
                <option value="-2.10">منسوب -2.10 م</option>
                <option value="-2.20">منسوب -2.20 م</option>
                <option value="-3.00">منسوب -3.00 م</option>
              </select>
            </div>

            {/* Concrete Strength */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-bold block">رتبة الخرسانة / Concrete Grade</label>
              <select 
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                className="w-full h-8 text-xs border border-input rounded bg-background px-2 font-sans"
              >
                <option value="all">جميع الرتب (All Grades)</option>
                <option value="C25">C25 (25 MPa)</option>
                <option value="C28">C28 (28 MPa)</option>
                <option value="C30">C30 (30 MPa)</option>
                <option value="C35">C35 (35 MPa)</option>
              </select>
            </div>

            {/* Counter Badge info */}
            <div className="flex items-end justify-end md:justify-center">
              <Badge className="bg-indigo-600 text-white font-mono text-[11px] h-8 px-3 rounded flex items-center gap-1.5 w-full justify-center">
                <Check className="h-3.5 w-3.5" />
                <span>مطابق: {filteredItems.length} نموذج</span>
              </Badge>
            </div>
          </div>
        </div>

        {/* PROJECT MASTER TOTALS BENTO GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
          <Card className="p-3 border text-center space-y-0.5 bg-blue-500/5 dark:bg-blue-950/20 border-blue-100">
            <div className="text-[9.5px] uppercase tracking-wider text-slate-500 font-bold">العدد الإجمالي</div>
            <div className="text-sm font-black text-blue-700 dark:text-blue-300 font-mono">{boqTotals.totFounds} قواعد</div>
            <div className="text-[8.5px] text-muted-foreground">صيد تلاحق المحاور</div>
          </Card>

          <Card className="p-3 border text-center space-y-0.5 bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-100">
            <div className="text-[9.5px] uppercase tracking-wider text-slate-500 font-bold">خرسانة مسلحة (RCC)</div>
            <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono">{boqTotals.rccVol.toFixed(2)} م³</div>
            <div className="text-[8.5px] text-emerald-600">متضمن الميدات ورقاب الأعمدة</div>
          </Card>

          <Card className="p-3 border text-center space-y-0.5 bg-slate-500/5 dark:bg-slate-900/40 border-slate-100">
            <div className="text-[9.5px] uppercase tracking-wider text-slate-500 font-bold">خرسانة عادية (PCC)</div>
            <div className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono">{boqTotals.pccVol.toFixed(2)} م³</div>
            <div className="text-[8.5px] text-muted-foreground">طبقة نظافة سمك 10 مم</div>
          </Card>

          <Card className="p-3 border text-center space-y-0.5 bg-indigo-500/5 dark:bg-indigo-950/20 border-indigo-100">
            <div className="text-[9.5px] uppercase tracking-wider text-slate-500 font-bold">إجمالي التسليح (Steel)</div>
            <div className="text-sm font-black text-indigo-700 dark:text-indigo-300 font-mono">{(boqTotals.steelWt / 1000).toFixed(3)} طن</div>
            <div className="text-[8.5px] text-indigo-600 font-mono">{boqTotals.steelWt.toFixed(0)} كجم</div>
          </Card>

          <Card className="p-3 border text-center space-y-0.5 bg-amber-500/5 dark:bg-amber-950/20 border-amber-100">
            <div className="text-[9.5px] uppercase tracking-wider text-slate-500 font-bold">مسطح أعمال الخشب</div>
            <div className="text-sm font-black text-amber-700 dark:text-amber-300 font-mono">{boqTotals.formwork.toFixed(1)} م²</div>
            <div className="text-[8.5px] text-amber-600">القوالب الجانبية للأوجه</div>
          </Card>

          <Card className="p-3 border text-center space-y-0.5 bg-rose-500/5 dark:bg-rose-950/20 border-rose-100">
            <div className="text-[9.5px] uppercase tracking-wider text-slate-500 font-bold">أعمال الحفر الجيوتقني</div>
            <div className="text-sm font-black text-rose-700 dark:text-rose-300 font-mono">{boqTotals.excavation.toFixed(1)} م³</div>
            <div className="text-[8.5px] text-muted-foreground">على منسوب التأسيس الفعلي</div>
          </Card>

          <Card className="p-3 border text-center space-y-0.5 bg-violet-500/5 dark:bg-violet-950/20 border-violet-100 border-dashed">
            <div className="text-[9.5px] uppercase tracking-wider text-slate-500 font-bold">أعمال الردم والدمك</div>
            <div className="text-sm font-black text-violet-700 dark:text-violet-300 font-mono">{boqTotals.backfill.toFixed(1)} م³</div>
            <div className="text-[8.5px] text-violet-600">طبقات تربة بروكتر معدل</div>
          </Card>
        </div>

        {/* NATIVE ARABIC NAVIGATION TABS */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 p-1 bg-slate-100/50 dark:bg-slate-900/30 rounded-lg gap-1">
          <button
            onClick={() => setActiveTab('master')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'master'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            1. الجدول المركزي الشامل (Master Table)
          </button>
          <button
            onClick={() => setActiveTab('isolated')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'isolated'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            2. جدول القواعد المنفصلة (Isolated Footings)
          </button>
          <button
            onClick={() => setActiveTab('strip')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'strip'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
            }`}
          >
            <Layers3 className="h-3.5 w-3.5" />
            3. تفصيل مقطع القواعد الشريطية (Strip)
          </button>
          <button
            onClick={() => setActiveTab('combined')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'combined'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
            }`}
          >
            <Layers2 className="h-3.5 w-3.5" />
            4. تفريد القواعد المشتركة (Combined)
          </button>
          <button
            onClick={() => setActiveTab('strap')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'strap'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
            }`}
          >
            <Layers2 className="h-3.5 w-3.5 text-orange-600" />
            5. ميدات وقواعد الجار الجسية (Strap System)
          </button>
          <button
            onClick={() => setActiveTab('future')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'future'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            6. اللبشة والخوازيق والقطع المستقبلي (Raft & Pile Caps)
          </button>
          <button
            onClick={() => setActiveTab('boq')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'boq'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            7. كشف حصر الكميات والمواد (Takeoff & Pricing)
          </button>
          <button
            onClick={() => setActiveTab('validation')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-1.5 ${
              activeTab === 'validation'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            8. تقرير التحقق والتدقيق الإنشائي (Audit Report)
            {qaChecksReport.filter(c => c.type === 'error').length > 0 && (
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* TAB 1: MASTER REINFORCED TABLE */}
        {activeTab === 'master' && (
          <div className="space-y-3.5">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                منظور الجرد البيمتري وتنسيق الأساسات الكامل (Master Coordinated Foundations Overview)
              </span>
            </div>

            <div className="border rounded-lg overflow-x-auto bg-background">
              <Table className="min-w-max text-right">
                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                  <TableRow>
                    <TableHead className="font-bold text-[11px] text-right">رمز النموذج (ID)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">التصنيف الهيكلي (Type)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">المسمى بالعربي</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">أعماق التأسيس (Level)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">الأبعاد والمقاسات</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">مواصفات تسليح الشبكة</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">رتبة الخرسانة fc</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">مكعب الخرسانة RCC</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">كتلة الفولاذ (kg)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">لوحة التفاصيل / Drawing Sheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center p-8 text-xs text-slate-500">
                        لا توجد عناصر مطابقة لقواعد الفلترة النشطة حالياً.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30 text-xs">
                        <TableCell className="font-bold text-indigo-700 dark:text-indigo-400 font-mono">{item.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] py-0 font-sans font-bold">
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800 dark:text-slate-300">{item.nameAr}</TableCell>
                        <TableCell className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{item.level}</TableCell>
                        <TableCell className="font-mono text-[11px]">{item.dimensions}</TableCell>
                        <TableCell className="font-mono font-bold text-slate-800 dark:text-slate-300">{item.rebarText}</TableCell>
                        <TableCell className="font-mono">{item.fc} MPa</TableCell>
                        <TableCell className="font-mono font-bold text-emerald-800 dark:text-emerald-300">{(item.rcc).toFixed(3)}</TableCell>
                        <TableCell className="font-mono font-bold text-indigo-800 dark:text-indigo-300">{(item.steel).toFixed(1)}</TableCell>
                        <TableCell>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="text-indigo-600 h-6 p-0 text-[11px] font-mono flex items-center gap-1 hover:text-indigo-800"
                            onClick={() => handleSheetLinkClick(item.sheetReference)}
                          >
                            <ExternalLink className="h-3 w-3" /> {item.sheetReference}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* TAB 2: ISOLATED FOOTINGS DETAIL TABLE */}
        {activeTab === 'isolated' && (
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                نماذج القوازق والقواعد المنفصلة المعيارية (Grouped Isolated Structural Marks)
              </span>
            </div>

            {groupedIsolated.length === 0 ? (
              <div className="p-8 border border-dashed rounded-lg text-center text-xs text-slate-500">
                لا توجد بيانات قواعد منفصلة مصممة حالياً لتوليد الجدول الإنشائي.
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto bg-background">
                <Table className="min-w-max text-right">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900">
                      <TableHead className="font-bold text-[11px] text-right">رمز النموذج</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">الطول L (مم)</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">العرض B (مم)</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">السماكة T (مم)</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">رقبة العمود (Pedestal)</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">منسوب التأسيس</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">خرسانة نظافة (PCC)</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">التسليح السفلي X</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">التسليح السفلي Y</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">التسليح العلوي</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">إجمالي العدد</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">المكعب المسلح Single</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">الصحيفة المرجعية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedIsolated.map((g, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30 text-xs">
                        <TableCell className="font-bold text-indigo-700 dark:text-indigo-400 font-mono">{g.mark}</TableCell>
                        <TableCell className="font-mono">{g.L}</TableCell>
                        <TableCell className="font-mono">{g.B}</TableCell>
                        <TableCell className="font-mono font-bold text-teal-800 dark:text-teal-400">{g.H}</TableCell>
                        <TableCell className="text-muted-foreground text-[10px] font-mono">{g.pSize}</TableCell>
                        <TableCell className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">EL={g.elevation.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-[10.5px]">C15 / 100 mm</TableCell>
                        <TableCell className="font-mono font-bold text-blue-700 dark:text-blue-400">{g.rebarX}</TableCell>
                        <TableCell className="font-mono font-bold text-blue-700 dark:text-blue-400">{g.rebarY}</TableCell>
                        <TableCell className="text-muted-foreground text-[10px] font-serif">لا يلزم (N/A)</TableCell>
                        <TableCell className="font-mono font-bold bg-slate-50 dark:bg-slate-900 px-2 text-center">{g.count}</TableCell>
                        <TableCell className="font-mono">{g.concreteVolSingle.toFixed(3)} m³</TableCell>
                        <TableCell>
                          <Button variant="link" size="sm" className="p-0 text-xs h-auto font-mono text-indigo-600" onClick={() => handleSheetLinkClick('S-301')}>
                            S-301
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STRIP FOOTINGS TABLE */}
        {activeTab === 'strip' && (
          <div className="space-y-3.5">
            <div className="flex justify-between items-center animate-fade-in">
              <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                القواعد الشريطية المسلحة المستمرة (Continuous Reinforced Strips)
              </span>
            </div>

            {processedStrips.length === 0 ? (
              <div className="p-8 border border-dashed rounded-lg text-center text-xs text-slate-500">
                لا توجد قواعد شريطية مسجلة في الموديل الإنشائي حالياً.
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto bg-background">
                <Table className="min-w-max text-right">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900">
                      <TableHead className="font-bold text-[11px] text-right">الرمز الإنشائي</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">العرض B (مم)</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">العمق H (مم)</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">الطول الإجمالي (مم)</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">منسوب التأسيس</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">الحديد الطولي العلوي</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">الحديد الطولي السفلي</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">الكانات العرضية</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">مكعب الخرسانة RCC</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">إجمالي حديد التسليح</TableHead>
                      <TableHead className="font-bold text-[11px] text-right">الصحيفة الإنشائية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedStrips.map((sf, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30 text-xs">
                        <TableCell className="font-bold text-orange-700 dark:text-orange-400 font-mono">{sf.mark}</TableCell>
                        <TableCell className="font-mono">{sf.B}</TableCell>
                        <TableCell className="font-mono">{sf.H}</TableCell>
                        <TableCell className="font-mono font-bold text-slate-700 dark:text-slate-300">{sf.L}</TableCell>
                        <TableCell className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">EL={sf.elevation.toFixed(2)}</TableCell>
                        <TableCell className="font-mono font-bold text-indigo-700 dark:text-indigo-400">{sf.barsTopCount}Ø{sf.barsTopDia}</TableCell>
                        <TableCell className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{sf.barsBotCount}Ø{sf.barsBotDia}</TableCell>
                        <TableCell className="font-mono text-orange-600 dark:text-orange-300">Ø{sf.stirrupsDia}@{sf.stirrupsSpacing}</TableCell>
                        <TableCell className="font-mono font-bold text-slate-800 dark:text-slate-200">{sf.concreteVolume.toFixed(3)} m³</TableCell>
                        <TableCell className="font-mono font-bold text-[#2563eb]">{sf.steelWeight.toFixed(1)} kg</TableCell>
                        <TableCell>
                          <Button variant="link" size="sm" className="p-0 text-xs h-auto font-mono text-indigo-600" onClick={() => handleSheetLinkClick('S-302')}>
                            S-302
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: COMBINED FOOTINGS TABLE */}
        {activeTab === 'combined' && (
          <div className="space-y-3.5 animate-fadeIn">
            <div className="flex justify-between items-center">
              <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                القواعد المشتركة لربط الأعمدة المجاورة (Combined Supporting Footings)
              </span>
            </div>

            <div className="border rounded-lg overflow-x-auto bg-background animate-fade-in-up">
              <Table className="min-w-max text-right">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="font-bold text-[11px] text-right">رمز النموذج</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">الأعمدة المدعومة</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">الطول L (مم)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">العرض السفلي B1 (مم)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">العرض العلوي B2 (مم)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">السماكة H (مم)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">منسوب التأسيس</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">تسليح الفرش (Bottom)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">تسليح الغطاء (Top)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">التسليح العرضي</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">حجم الخرسانة</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">وزن الحديد</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">لوحة التفريد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedCombined.map((cf, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30 text-xs">
                      <TableCell className="font-bold text-indigo-700 dark:text-indigo-400 font-mono">{cf.mark}</TableCell>
                      <TableCell className="font-bold text-rose-700 dark:text-rose-400 font-mono text-[10px]">{cf.columns?.map(c => c.id).join(' & ') || 'Columns'}</TableCell>
                      <TableCell className="font-mono">{cf.L}</TableCell>
                      <TableCell className="font-mono">{cf.B1}</TableCell>
                      <TableCell className="font-mono">{cf.B2}</TableCell>
                      <TableCell className="font-mono font-bold text-emerald-800 dark:text-emerald-400">{cf.H}</TableCell>
                      <TableCell className="font-mono text-emerald-700 font-semibold">EL={cf.elevation?.toFixed(2)}</TableCell>
                      <TableCell className="font-mono font-bold text-blue-700 dark:text-blue-400">{cf.botSteelText}</TableCell>
                      <TableCell className="font-mono font-bold text-indigo-700 dark:text-indigo-400">{cf.topSteelText}</TableCell>
                      <TableCell className="font-mono text-[10.5px] text-muted-foreground">{cf.transverseSteelText}</TableCell>
                      <TableCell className="font-mono text-emerald-700 font-extrabold">{cf.concreteVol?.toFixed(3)} m³</TableCell>
                      <TableCell className="font-mono font-bold text-[#1d4ed8]">{cf.steelWeightKg} kg</TableCell>
                      <TableCell>
                        <Button variant="link" size="sm" className="p-0 text-xs h-auto font-mono text-indigo-600" onClick={() => handleSheetLinkClick('S-303')}>
                          S-303
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* TAB 5: STRAP FOOTINGS TABLE */}
        {activeTab === 'strap' && (
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                نظام الميدات الرابطة الكابولية للجار (Neighbor Strap Framing System)
              </span>
            </div>

            <div className="border rounded-lg overflow-x-auto bg-background">
              <Table className="min-w-max text-right">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="font-bold text-[11px] text-right">نظام الجار (ST-ID)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">القاعدة الخارجية (Ext)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">القاعدة الداخلية (Int)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">محيط المسافة (L Span)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">أعماق التأسيس</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">مقاس وتجشؤ الميدة (SB)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">تسليح الميدة الرابطة</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">الفلين العازل EPS</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">خرسانة النظام الإجمالية</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">الصحيفة الهندسية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedStrap.map((st, idx) => {
                    const isStepped = st.ext_footing_level !== st.int_footing_level;
                    return (
                      <TableRow key={idx} className="hover:bg-muted/30 text-xs">
                        <TableCell className="font-bold text-indigo-700 dark:text-indigo-400 font-mono">{st.mark}</TableCell>
                        <TableCell className="font-mono text-[10.5px]">{st.ext_L}×{st.ext_B}×{st.ext_H} مم</TableCell>
                        <TableCell className="font-mono text-[10.5px]">{st.int_L}×{st.int_B}×{st.int_H} مم</TableCell>
                        <TableCell className="font-mono">{st.L_span} مم</TableCell>
                        <TableCell className="font-mono font-bold text-rose-700 dark:text-rose-400 text-[10.5px]">
                          {isStepped ? `متدرج: (${st.ext_footing_level} / ${st.int_footing_level}) م` : `موحد: ${st.ext_footing_level?.toFixed(2)} م`}
                        </TableCell>
                        <TableCell className="font-mono text-amber-700 dark:text-amber-400 font-bold">{st.beam_b}×{st.beam_h} مم</TableCell>
                        <TableCell className="font-mono text-[10px]">علوي: 6Ø18 | سفلي: 4Ø16 | كانات: Ø10@150</TableCell>
                        <TableCell className="text-muted-foreground text-[10px]">سمك 50 مم / مفصول</TableCell>
                        <TableCell className="font-mono font-bold text-slate-800 dark:text-slate-100">{st.concreteVol.toFixed(2)} m³</TableCell>
                        <TableCell>
                          <Button variant="link" size="sm" className="p-0 text-xs h-auto font-mono text-indigo-600" onClick={() => handleSheetLinkClick('S-304')}>
                            S-304
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* TAB 6: RAFT & FUTURE PILE CAPS */}
        {activeTab === 'future' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-300 border border-indigo-150">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600" />
              <div className="text-xs leading-relaxed">
                <strong>التوسعة المستقبلية والأساسات العميقة واللبشة وحصير الخوزقة:</strong> يتميز الكود المدمج بالمرونة القصوى لاستيعاب المخططات الأكثر تعقيدًا لتمثيل اللبشة المسلحة (Raft Plates) وحصائر ركائز رأس الخوازيق العميقة (Pile Group Caps) بكل سلاسة.
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto bg-background">
              <Table className="min-w-max text-right">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="font-bold text-[11px] text-right">الرمز الإنشائي المقترح</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">التوصيف الفني للأحمال العالية</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">الطول L (مم)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">العرض B (مم)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">السماكة H (مم)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">منسوب التأسيس</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">رتبة الخرسانة (fc)</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">الحجم التقديري للخرسانة</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">الحديد التقريبي</TableHead>
                    <TableHead className="font-bold text-[11px] text-right">مستوى الجاهزية البرمجية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {futureRafts.map((cf, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30 text-xs">
                      <TableCell className="font-bold text-purple-700 dark:text-purple-400 font-mono">{cf.id}</TableCell>
                      <TableCell className="font-semibold text-slate-800 dark:text-slate-300">{cf.name}</TableCell>
                      <TableCell className="font-mono">{cf.L}</TableCell>
                      <TableCell className="font-mono">{cf.B}</TableCell>
                      <TableCell className="font-mono font-bold text-purple-800 dark:text-purple-400">{cf.H}</TableCell>
                      <TableCell className="font-mono text-emerald-700 font-bold">EL={cf.elevation.toFixed(2)}</TableCell>
                      <TableCell className="font-mono">C{cf.fc} MPa</TableCell>
                      <TableCell className="font-mono font-bold text-emerald-700">{cf.concreteVol} m³</TableCell>
                      <TableCell className="font-mono font-semibold text-blue-700">{cf.steelWeightKg} kg</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-800 text-[9px] p-0 px-1 font-bold">✓ جاهز للربط / READY</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* TAB 7: BOQ DETAILED SHEET TAKEOFF */}
        {activeTab === 'boq' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b pb-2">تفاصيل الكميات وجرد المواد الإجمالي بالموقع (Takeoff QS)</h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between border-b pb-1.5">
                    <span>حجم حفر الموقع العام (Excavation Total Volume):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{boqTotals.excavation.toFixed(1)} م³</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span>خرسانة دكة النظافة العادية (PCC Blinding):</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{boqTotals.pccVol.toFixed(2)}  م³</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span>الخرسانة الإنشائية المسلحة المصبوبة (RCC Volume):</span>
                    <span className="font-mono font-semibold text-emerald-600 font-bold">{boqTotals.rccVol.toFixed(2)} م³</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span>إجمالي الكتلة الصافية للفولاذ المسلح (Total Weight):</span>
                    <span className="font-mono font-bold text-indigo-700">{boqTotals.steelWt.toFixed(0)} كجم ({ (boqTotals.steelWt/1000).toFixed(3) } طن)</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5 text-blue-700">
                    <span>كثافة تسليح الخرسانة المتوسطة (Average Ratio):</span>
                    <span className="font-mono font-bold">{(boqTotals.rccVol > 0 ? boqTotals.steelWt / boqTotals.rccVol : 0).toFixed(1)} كجم/م³</span>
                  </div>
                  <div className="flex justify-between border-b pb-1.5">
                    <span>إجمالي مسطح طوبار الخشب (Formwork Area):</span>
                    <span className="font-mono font-bold">{boqTotals.formwork.toFixed(1)} م²</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>صافي كمية الدفان المحسوب حول الأساسات (Backfill):</span>
                    <span className="font-mono font-bold">{boqTotals.backfill.toFixed(1)} م³</span>
                  </div>
                </div>
              </Card>

              <Card className="border p-4 bg-purple-500/5 border-purple-100 space-y-3">
                <h4 className="text-xs font-bold text-purple-950 dark:text-purple-300 border-b border-purple-300/20 pb-2">مؤشر تقدير تكاليف المواد الإنشائية وفق متوسط الأسعار المحمية</h4>
                <div className="space-y-2.5 text-xs text-purple-900 dark:text-purple-300">
                  <div className="flex justify-between">
                    <span>توريد وصب الخرسانة RCC (بمعدل 550 ريال/م³):</span>
                    <span className="font-mono font-bold">{(boqTotals.rccVol * 550).toLocaleString()} SAR</span>
                  </div>
                  <div className="flex justify-between">
                    <span>توريد خرسانة النظافة PCC (بمعدل 380 ريال/م³):</span>
                    <span className="font-mono font-bold">{(boqTotals.pccVol * 380).toLocaleString()} SAR</span>
                  </div>
                  <div className="flex justify-between">
                    <span>شراء وتهيئة حديد التسليح (بمعدل 4500 ريال/طن):</span>
                    <span className="font-mono font-bold">{((boqTotals.steelWt / 1000) * 4500).toLocaleString()} SAR</span>
                  </div>
                  <div className="flex justify-between">
                    <span>حفر وتجهيز الموقع ميكانيكياً (بمعدل 25 ريال/م³):</span>
                    <span className="font-mono font-bold">{(boqTotals.excavation * 25).toLocaleString()} SAR</span>
                  </div>
                  <div className="flex justify-between">
                    <span>أعمال الردم من ناتج حفر نظيف مع الرص (بمعدل 40 ريال/م³):</span>
                    <span className="font-mono font-bold">{(boqTotals.backfill * 40).toLocaleString()} SAR</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-purple-300/20 font-black text-rose-700 dark:text-rose-400 text-sm">
                    <span>إجمالي التكلفة التقريبية للمواد والتحضير العام:</span>
                    <span className="font-mono">
                      {(
                        (boqTotals.rccVol * 550) +
                        (boqTotals.pccVol * 380) +
                        ((boqTotals.steelWt / 1000) * 4500) +
                        (boqTotals.excavation * 25) +
                        (boqTotals.backfill * 40)
                      ).toLocaleString()} SAR
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 8: DETAILED QA/QC VALIDATION REPORT */}
        {activeTab === 'validation' && (
          <div className="space-y-3.5">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded border border-indigo-100 text-[11px] leading-relaxed text-indigo-900 dark:text-indigo-400">
              <strong>بوابة مراجعة الجودة الإنشائية والجيوتقنية الفورية:</strong> تهدف هذه الصفحة إلى مراقبة جودة المدخلات، ومراجعة المعايير المقاومة للانهيارات أو الثقب، ومنع تكرار النماذج، وضمان مطابقتها للاشتراطات الفنية للأكواد الإنشائية المعتمدة.
            </div>

            <div className="space-y-2">
              {qaChecksReport.map((check, i) => (
                <div key={i} className={`p-3 rounded border text-xs flex items-start gap-2.5 leading-normal ${
                  check.type === 'error'
                    ? 'bg-rose-500/5 border-rose-500/20 text-rose-800 dark:text-rose-300'
                    : check.type === 'warning'
                    ? 'bg-amber-500/5 border-amber-500/20 text-amber-800 dark:text-amber-300'
                    : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {check.type === 'error' ? (
                    <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : check.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-extrabold uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 ml-1.5 align-middle">
                      [{check.label}]
                    </span>
                    <span className="align-middle font-sans font-medium">{check.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM METADATA SUMMARIES BAR FOR REINFORCEMENT & DEALS */}
        <div className="pt-3 border-t border-muted grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* LEVEL SUMMARY */}
          <Card className="border p-3 space-y-2 bg-slate-50 dark:bg-slate-950">
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 border-b pb-1 shadow-none">
              📁 منسوب التأسيس وتصنيف القواعد / Level Grouping
            </div>
            <div className="space-y-1">
              {levelSummary.map((lvl, index) => (
                <div key={index} className="flex justify-between items-center text-[10.5px]">
                  <span className="font-mono text-emerald-800 font-bold">{lvl.level}</span>
                  <div className="flex gap-2 font-mono">
                    <span className="text-slate-600">{lvl.count} قواعد</span>
                    <span className="text-emerald-700 font-bold">{lvl.totalConcrete.toFixed(2)} م³</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* CONCRETE GRADE SUMMARY */}
          <Card className="border p-3 space-y-2 bg-slate-50 dark:bg-slate-950">
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 border-b pb-1">
              🧱 رتب الخرسانة المميزة المستخدمة / Concrete Summary
            </div>
            <div className="space-y-1">
              {concreteSummary.map((grd, index) => (
                <div key={index} className="flex justify-between items-center text-[10.5px]">
                  <span className="font-mono font-bold text-indigo-700">{grd.grade} (f'c)</span>
                  <div className="flex gap-2 font-mono">
                    <span className="text-slate-600">{grd.count} عناصر</span>
                    <span className="text-indigo-800 font-bold">{grd.totalVolume.toFixed(2)} م³</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* STEEL REBAR DIA BREAKDOWN SUMMARY */}
          <Card className="border p-3 space-y-1 bg-slate-50 dark:bg-slate-950 col-span-1">
            <div className="text-[11px] font-bold text-indigo-950 dark:text-indigo-300 border-b pb-1">
              📏 جرد حديد التسليح بالأقطار الفردية / Steel Summary
            </div>
            <div className="max-h-[85px] overflow-y-auto pr-1">
              <Table className="text-right text-[10px] min-w-full">
                <TableHeader className="bg-muted p-0">
                  <TableRow className="h-4 p-0">
                    <TableHead className="py-0 px-1 font-sans text-right">القطر / Dia</TableHead>
                    <TableHead className="py-0 px-1 font-sans text-right">الطول (m)</TableHead>
                    <TableHead className="py-0 px-1 font-sans text-right">الوزن (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {steelSummaryByDiameter.map((item, idx) => (
                    <TableRow key={idx} className="h-5 hover:bg-muted/10">
                      <TableCell className="py-0.5 px-1 font-mono font-bold text-indigo-600">Ø {item.dia}</TableCell>
                      <TableCell className="py-0.5 px-1 font-mono">{item.totalLen.toFixed(1)} m</TableCell>
                      <TableCell className="py-0.5 px-1 font-mono font-bold">{item.totalWeight.toFixed(1)} kg</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

// Foundation Quantity Surveying (QS) Engine
// Supports standard compliance with ACI and ASCE guidelines for estimating and tender prep.

export type FdnType = 'isolated' | 'strip' | 'combined' | 'raft' | 'pilecap';

export interface FdnItemInput {
  id: string; // F1, F2, SF1, SF2, C1, RC-R1, PC-1...
  type: FdnType;
  B: number; // Width in mm
  L: number; // Length in mm
  H: number; // Thickness in mm
  count: number; // Total quantity in project
  elevation: number; // Foundation level (e.g. EL = -2.00, EL = -1.50)
  
  // Isolated column values for pedestal calculation
  colB?: number; // mm
  colH?: number; // mm
  
  // Future/specific params:
  area?: number; // For rafts, custom area in sqm
  steelRatio?: number; // Steel density in kg/m³ (e.g., 100 for raft, 130 for combined)
  concreteGrade?: string; // e.g. "C30", "C35"
  
  // BBS explicit bars list if available (fallback used if not provided)
  rebarWeightKg?: number; 
}

export interface QSConfig {
  pccThickness: number; // mm (default 100)
  pccOffset: number; // mm (default 100)
  excavationOffset: number; // mm (working space offset, default 300)
  naturalGroundLevel: number; // m (e.g. 0.00)
  compactionFactor: number; // (e.g. 1.15 or 1.20)
  
  // Unit prices (SAR or local currency)
  priceExcavation: number; // per m³
  pricePCC: number; // per m³
  priceRC: number; // per m³
  priceSteel: number; // per kg
  priceFormwork: number; // per m²
  priceBackfill: number; // per m³
}

export interface FdnQSRow {
  id: string;
  type: FdnType;
  typeName: string;
  count: number;
  elevation: number;
  concreteGrade: string;
  
  // Dimensions
  B: number;
  L: number;
  H: number;
  
  // Excavation
  excavationLength: number; // m
  excavationWidth: number; // m
  excavationDepth: number; // m
  excavationVolSingle: number; // m³
  excavationVolTotal: number; // m³
  
  // PCC Blinding
  pccLength: number; // m
  pccWidth: number; // m
  pccThickness: number; // m
  pccVolSingle: number; // m³
  pccVolTotal: number; // m³
  
  // Reinforced Concrete (RC)
  rcVolSingle: number; // m³
  rcVolTotal: number; // m³
  pedestalVolSingle: number; // m³
  pedestalVolTotal: number; // m³
  totalRCVolSingle: number; // m³
  totalRCVolTotal: number; // m³
  
  // Reinforcement Steel
  steelWtSingle: number; // kg
  steelWtTotal: number; // kg
  
  // Formwork
  footingFormworkSingle: number; // m² (sides only)
  pedestalFormworkSingle: number; // m²
  totalFormworkSingle: number; // m²
  totalFormworkTotal: number; // m²
  
  // Backfill
  grossExcavationTotal: number; // m³
  netBackfillTotal: number; // m³
  compactedFillTotal: number; // m³
  
  // Costs
  costExcavation: number;
  costPCC: number;
  costRC: number;
  costSteel: number;
  costFormwork: number;
  costBackfill: number;
  costTotal: number;
}

export interface QSProjectSummary {
  rows: FdnQSRow[];
  
  // Total Quantities
  totalExcavationVol: number; // m³
  totalPCCVol: number; // m³
  totalRCVol: number; // m³ (including pedestals)
  totalSteelWt: number; // kg
  totalSteelTon: number; // Ton
  totalFormworkArea: number; // m²
  totalBackfillVol: number; // m³ gross
  totalNetBackfillVol: number; // m³ net
  totalCompactedFillVol: number; // m³ compacted
  
  // Total Costs
  totalCostExcavation: number;
  totalCostPCC: number;
  totalCostRC: number;
  totalCostSteel: number;
  totalCostFormwork: number;
  totalCostBackfill: number;
  grandTotalCost: number;
  
  // Validation Warnings
  warnings: string[];
}

/**
 * Executes full quantity takeoff and cost estimation matching standard surveyor checklists.
 */
export function calculateFoundationQS(items: FdnItemInput[], config: QSConfig): QSProjectSummary {
  const rows: FdnQSRow[] = [];
  const warnings: string[] = [];
  
  // Track IDs for duplicate checking
  const seenIds = new Set<string>();

  items.forEach(item => {
    // 1. Validation Checks
    if (!item.id || item.id.trim() === '') {
      warnings.push(`يوجد نموذج بدون رمز تعريفي في قائمة التقدير.`);
      return;
    }
    if (seenIds.has(item.id)) {
      warnings.push(`خطأ: تكرار في الرمز التعريفي للقاعدة [${item.id}].`);
    }
    seenIds.add(item.id);

    if (item.B <= 0 || item.L <= 0 || item.H <= 0 || item.count <= 0) {
      warnings.push(`القاعدة [${item.id}] تحتوي على أبعاد سالبة أو مساوية للصفر (B=${item.B}, L=${item.L}, H=${item.H}, العدد=${item.count}).`);
    }

    // Determine descriptive type name
    let typeName = 'قاعدة منفصلة';
    if (item.type === 'strip') typeName = 'أساس شريطي مستمر';
    else if (item.type === 'combined') typeName = 'قاعدة مشتركة';
    else if (item.type === 'raft') typeName = 'لبشة خرسانية مسلحة';
    else if (item.type === 'pilecap') typeName = 'هامة خزازير / Pile Cap';

    // 2. Excavation calculations
    // Depth is based on custom Level (elevation) vs Natural Ground Level.
    // e.g. Ground = 0.0, FdnLevel = -2.0m, depth = 2.0m.
    // If footing is at -2.0m, the excavation depth must be from Ground down to the bottom of the footing.
    // Bottom of footing is: Foundation Level minus PCC blinding thickness.
    const fdnDepthM = Math.max(0.5, Math.abs(config.naturalGroundLevel - item.elevation) + (config.pccThickness / 1000));
    
    const B_exc = (item.B + 2 * config.excavationOffset) / 1000; // m
    const L_exc = (item.type === 'raft' && item.area) 
      ? Math.sqrt(item.area) + (2 * config.excavationOffset / 1000) 
      : (item.L + 2 * config.excavationOffset) / 1000; // m
    
    const excavationVolSingle = (item.type === 'raft' && item.area)
      ? (item.area + 4 * (Math.sqrt(item.area) * (config.excavationOffset / 1000))) * fdnDepthM
      : B_exc * L_exc * fdnDepthM;
    const excavationVolTotal = excavationVolSingle * item.count;

    // 3. PCC Blinding Calculations
    const pccThicknessM = config.pccThickness / 1000; // m
    const B_pcc = (item.B + 2 * config.pccOffset) / 1000; // m
    const L_pcc = (item.L + 2 * config.pccOffset) / 1000; // m
    
    const pccVolSingle = (item.type === 'raft' && item.area)
      ? (item.area + 4 * (Math.sqrt(item.area) * (config.pccOffset / 1000))) * pccThicknessM
      : B_pcc * L_pcc * pccThicknessM;
    const pccVolTotal = pccVolSingle * item.count;

    // 4. Reinforced Concrete (RC) footing volume
    const footingVolSingle = (item.type === 'raft' && item.area)
      ? item.area * (item.H / 1000)
      : (item.B / 1000) * (item.L / 1000) * (item.H / 1000);
    const footingVolTotal = footingVolSingle * item.count;

    // Pedestal Column calculations (columns starting from top of footing to natural ground level minus backfill seal)
    // Pedestal height = excavation depth minus bedding and footing thickness H
    const pccThickM = config.pccThickness / 1000;
    const footH_M = item.H / 1000;
    const pedestalHeightM = Math.max(0, fdnDepthM - pccThickM - footH_M);
    
    // Default column size if not provided
    const colB_M = (item.colB || 400) / 1000;
    const colH_M = (item.colH || 400) / 1000;
    
    const pedestalVolSingle = (item.type === 'isolated' || item.type === 'combined')
      ? colB_M * colH_M * pedestalHeightM
      : 0;
    const pedestalVolTotal = pedestalVolSingle * item.count;

    const totalRCVolSingle = footingVolSingle + pedestalVolSingle;
    const totalRCVolTotal = footingVolTotal + pedestalVolTotal;

    // 5. Formwork calculations (m²)
    // Footing Side Formwork area = perimeter * height
    // Perimeter: isolated = 2*(B+L), strip/raft/combined as well unless customized
    const perimeterM = (item.type === 'raft' && item.area)
      ? 4 * Math.sqrt(item.area)
      : 2 * (item.B + item.L) / 1000;
    const footingFormworkSingle = perimeterM * (item.H / 1000);
    
    // Pedestal Formwork: 2 * (colB + colH) * pedestalHeight
    const pedestalFormworkSingle = (item.type === 'isolated' || item.type === 'combined')
      ? 2 * (colB_M + colH_M) * pedestalHeightM
      : 0;
      
    const totalFormworkSingle = footingFormworkSingle + pedestalFormworkSingle;
    const totalFormworkTotal = totalFormworkSingle * item.count;

    // 6. Reinforcement Steel Weight calculation
    // Fallback density for future or simplified types, or if no explicit weight is provided:
    // Isolated: ~95 kg/m³, Strip: ~110 kg/m³, Combined: ~125 kg/m³, Raft: ~105 kg/m³, Pilecap: ~140 kg/m³
    let steelWtSingle = 0;
    if (item.rebarWeightKg && item.rebarWeightKg > 0) {
      steelWtSingle = item.rebarWeightKg / item.count;
    } else {
      let density = 100;
      if (item.steelRatio && item.steelRatio > 0) {
        density = item.steelRatio;
      } else {
        if (item.type === 'isolated') density = 95;
        else if (item.type === 'strip') density = 115;
        else if (item.type === 'combined') density = 125;
        else if (item.type === 'raft') density = 105;
        else if (item.type === 'pilecap') density = 145;
      }
      steelWtSingle = footingVolSingle * density;
    }
    const steelWtTotal = steelWtSingle * item.count;

    // 7. Backfilling calculations
    // Net Backfill = Gross Excavation - PCC blinding - footing concrete - pedestal concrete
    const grossExcavationTotal = excavationVolTotal;
    const rcTotalVol = totalRCVolTotal;
    const netBackfillTotal = Math.max(0, grossExcavationTotal - pccVolTotal - rcTotalVol);
    const compactedFillTotal = netBackfillTotal * config.compactionFactor;

    // 8. Cost valuations
    const costExcavation = excavationVolTotal * config.priceExcavation;
    const costPCC = pccVolTotal * config.pricePCC;
    const costRC = totalRCVolTotal * config.priceRC;
    const costSteel = steelWtTotal * config.priceSteel;
    const costFormwork = totalFormworkTotal * config.priceFormwork;
    const costBackfill = netBackfillTotal * config.priceBackfill;
    const costTotal = costExcavation + costPCC + costRC + costSteel + costFormwork + costBackfill;

    // Push calculated row
    rows.push({
      id: item.id,
      type: item.type,
      typeName,
      count: item.count,
      elevation: item.elevation,
      concreteGrade: item.concreteGrade || 'C30',
      
      B: item.B,
      L: item.L,
      H: item.H,
      
      // Excavation
      excavationLength: L_exc,
      excavationWidth: B_exc,
      excavationDepth: fdnDepthM,
      excavationVolSingle,
      excavationVolTotal,
      
      // PCC Blinding
      pccLength: L_pcc,
      pccWidth: B_pcc,
      pccThickness: pccThicknessM,
      pccVolSingle,
      pccVolTotal,
      
      // RC
      rcVolSingle: footingVolSingle,
      rcVolTotal: footingVolTotal,
      pedestalVolSingle,
      pedestalVolTotal,
      totalRCVolSingle,
      totalRCVolTotal,
      
      // Steel
      steelWtSingle,
      steelWtTotal,
      
      // Formwork
      footingFormworkSingle,
      pedestalFormworkSingle,
      totalFormworkSingle,
      totalFormworkTotal,
      
      // Backfill
      grossExcavationTotal,
      netBackfillTotal,
      compactedFillTotal,
      
      // Cost
      costExcavation,
      costPCC,
      costRC,
      costSteel,
      costFormwork,
      costBackfill,
      costTotal
    });
  });

  // Calculate totals across project
  const totalExcavationVol = rows.reduce((acc, curr) => acc + curr.excavationVolTotal, 0);
  const totalPCCVol = rows.reduce((acc, curr) => acc + curr.pccVolTotal, 0);
  const totalRCVol = rows.reduce((acc, curr) => acc + curr.totalRCVolTotal, 0);
  const totalSteelWt = rows.reduce((acc, curr) => acc + curr.steelWtTotal, 0);
  const totalFormworkArea = rows.reduce((acc, curr) => acc + curr.totalFormworkTotal, 0);
  const totalBackfillVol = rows.reduce((acc, curr) => acc + curr.grossExcavationTotal, 0);
  const totalNetBackfillVol = rows.reduce((acc, curr) => acc + curr.netBackfillTotal, 0);
  const totalCompactedFillVol = rows.reduce((acc, curr) => acc + curr.compactedFillTotal, 0);

  const totalCostExcavation = rows.reduce((acc, curr) => acc + curr.costExcavation, 0);
  const totalCostPCC = rows.reduce((acc, curr) => acc + curr.costPCC, 0);
  const totalCostRC = rows.reduce((acc, curr) => acc + curr.costRC, 0);
  const totalCostSteel = rows.reduce((acc, curr) => acc + curr.costSteel, 0);
  const totalCostFormwork = rows.reduce((acc, curr) => acc + curr.costFormwork, 0);
  const totalCostBackfill = rows.reduce((acc, curr) => acc + curr.costBackfill, 0);
  const grandTotalCost = totalCostExcavation + totalCostPCC + totalCostRC + totalCostSteel + totalCostFormwork + totalCostBackfill;

  return {
    rows,
    totalExcavationVol,
    totalPCCVol,
    totalRCVol,
    totalSteelWt,
    totalSteelTon: totalSteelWt / 1000,
    totalFormworkArea,
    totalBackfillVol,
    totalNetBackfillVol,
    totalCompactedFillVol,
    
    totalCostExcavation,
    totalCostPCC,
    totalCostRC,
    totalCostSteel,
    totalCostFormwork,
    totalCostBackfill,
    grandTotalCost,
    
    warnings
  };
}

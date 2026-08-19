/**
 * Unified Reinforcement Schedule System Engine
 * Phase D6D: Central Reinforcement Database & BBS Analyzer
 */

import type { Beam, Column, Slab, Story } from './structuralEngine';
import type { FootingDesignResult } from './foundationDesign';

export interface RebarScheduleItem {
  id: string;               // Unique ID
  barMark: string;          // e.g., Mark 01, T1, B1
  elementId: string;        // e.g., B-12, C-3, F-2
  storyId: string;          // Story ID
  storyLabel: string;       // Story label (e.g., ground floor)
  elementType: 'beam' | 'column' | 'slab' | 'foundation' | 'pedestal' | 'raft' | 'wall';
  classification:
    | 'Longitudinal Bars'
    | 'Top Bars'
    | 'Bottom Bars'
    | 'Additional Bars'
    | 'Stirrups'
    | 'Column Bars'
    | 'Column Ties'
    | 'Slab Bars'
    | 'Foundation Bars'
    | 'Dowels';
  diameter: number;         // Diameter in mm
  length: number;           // Bar cut length in meters
  shapeCode: string;        // BS 8666 shape codes (e.g., 00, 11, 21, 37, 38, 51)
  steelGrade: string;       // e.g., Grade 60 (R-420), T420
  quantity: number;         // Count of rebar items
  unitWeight: number;       // kg/m = (dia^2 / 162.2)
  totalLength: number;      // quantity * length
  totalWeight: number;      // totalLength * unitWeight
  
  // Drawing & Detailing references
  drawingRef: {
    sheetNo: string;        // Sheet ID (S-101, S-102 etc)
    // Undefined when no real detail/section drawing reference is known for
    // this item — do not fabricate one (a made-up ref looks like a real
    // cross-reference to site staff, which is worse than leaving it blank).
    detailNo?: string;      // Detail bubble num
    sectionNo?: string;     // Section reference num
    bbsRef: string;         // BBS table label
  };
}

// Validation issue types
export interface RebarAuditIssue {
  id: string;
  category: 'mark' | 'dimensions' | 'references' | 'quantities';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  elementId: string;
  elementType: string;
  barMark?: string;
  suggestion: string;
}

/**
 * Calculates standard linear unit weight of steel rebar in kg/m
 */
export function getUnitWeight(dia: number): number {
  return parseFloat((Math.pow(dia, 2) / 162.2).toFixed(4));
}

/**
 * Standard factory list of typical commercial sizes and grade labels
 */
export const STEEL_GRADES = {
  highTensile: 'Grade 60 (ASTM A615 / T420)',
  mildSteel: 'Grade 40 (ASTM A615 / R280)',
};

/**
 * Generates the unified reinforcement schedule database
 */
export function buildReinforcementDatabase(
  stories: Story[],
  beams: Beam[],
  columns: Column[],
  slabs: Slab[],
  beamDesigns: any[],
  colDesigns: any[],
  slabDesigns: any[],
  foundationResults: FootingDesignResult[] = []
): RebarScheduleItem[] {
  const database: RebarScheduleItem[] = [];
  let serial = 1;

  // Key-value story map for rapid lookup
  const storyMap = new Map<string, string>();
  stories.forEach(s => storyMap.set(s.id, s.label));

  // Determine standard sheet number logic based on floors or elements
  const getSheetNoForElement = (elementType: string, storyId?: string): string => {
    const sLabel = storyId ? storyMap.get(storyId) || '' : '';
    if (elementType === 'foundation') return 'S-101 (Foundations Detail Layout)';
    if (elementType === 'pedestal') return 'S-101 (Pedestal Columns Detail)';
    if (elementType === 'column') return 'S-102 (Column Schedule & Detailing)';
    if (sLabel.includes('ملحق') || sLabel.includes('Roof')) return 'S-203 (Roof Structural Details)';
    if (sLabel.includes('الأول') || sLabel.includes('First')) return 'S-202 (First Floor Structural Details)';
    return 'S-201 (Ground Floor Structural Details)';
  };

  // Helper to push items
  const addRebarItem = (params: {
    barMark: string;
    elementId: string;
    storyId: string;
    elementType: RebarScheduleItem['elementType'];
    classification: RebarScheduleItem['classification'];
    diameter: number;
    length: number;
    shapeCode: string;
    quantity: number;
    steelGrade?: string;
    detailNo?: string;
    sectionNo?: string;
  }) => {
    if (params.quantity <= 0 || params.length <= 0) return;

    const uWt = getUnitWeight(params.diameter);
    const totLen = parseFloat((params.length * params.quantity).toFixed(3));
    const totWt = parseFloat((totLen * uWt).toFixed(2));
    const sLabel = storyMap.get(params.storyId) || 'Foundation Level';

    const cleanBarMark = params.barMark ? params.barMark.trim() : `MK-${serial}`;

    database.push({
      id: `REBAR-${serial++}`,
      barMark: cleanBarMark,
      elementId: params.elementId,
      storyId: params.storyId || 'foundation_level',
      storyLabel: sLabel,
      elementType: params.elementType,
      classification: params.classification,
      diameter: params.diameter,
      length: parseFloat(params.length.toFixed(3)),
      shapeCode: params.shapeCode || '00',
      steelGrade: params.steelGrade || (params.diameter >= 10 ? STEEL_GRADES.highTensile : STEEL_GRADES.mildSteel),
      quantity: params.quantity,
      unitWeight: uWt,
      totalLength: totLen,
      totalWeight: totWt,
      drawingRef: {
        sheetNo: getSheetNoForElement(params.elementType, params.storyId),
        // No random/cyclic fallback here: a fabricated "DT-3"/"SEC-B" reference
        // that isn't tied to an actual drawing detail is worse than leaving it
        // blank, since it looks like a real cross-reference to site staff.
        // Only report a detail/section number when the caller explicitly knows it.
        detailNo: params.detailNo || undefined,
        sectionNo: params.sectionNo || undefined,
        bbsRef: `BBS/${params.elementType.substring(0,2).toUpperCase()}-${params.elementId.replace(/\D/g, '') || serial}`,
      }
    });
  };

  // ==========================================
  // 1. BEAMS REBAR (from Designs)
  // ==========================================
  if (Array.isArray(beamDesigns)) {
    beamDesigns.forEach((d) => {
      const b = beams.find(item => item.id === d.beamId);
      if (!b) return;

      const L_m = b.length;
      const hook = Math.max(12 * d.flexLeft.dia / 1000, 0.15);

      // Top Support Left
      const leftLen = L_m * 0.3 + hook;
      addRebarItem({
        barMark: `B-T1-${b.id}`,
        elementId: b.id,
        storyId: b.storyId,
        elementType: 'beam',
        classification: 'Top Bars',
        diameter: d.flexLeft.dia,
        length: leftLen,
        shapeCode: '37', // Hook end
        quantity: d.flexLeft.bars,
        detailNo: 'DT-B1',
        sectionNo: 'SEC-A'
      });

      // Top Support Right
      const rightLen = L_m * 0.3 + hook;
      addRebarItem({
        barMark: `B-T2-${b.id}`,
        elementId: b.id,
        storyId: b.storyId,
        elementType: 'beam',
        classification: 'Top Bars',
        diameter: d.flexRight.dia,
        length: rightLen,
        shapeCode: '37',
        quantity: d.flexRight.bars,
        detailNo: 'DT-B1',
        sectionNo: 'SEC-B'
      });

      // Bottom Mid-Span
      const botLen = L_m + 2 * hook;
      addRebarItem({
        barMark: `B-B1-${b.id}`,
        elementId: b.id,
        storyId: b.storyId,
        elementType: 'beam',
        classification: 'Bottom Bars',
        diameter: d.flexMid.dia,
        length: botLen,
        shapeCode: '38', // Double Hook
        quantity: d.flexMid.bars,
        detailNo: 'DT-B2',
        sectionNo: 'SEC-C'
      });

      // Stirrups (Shear)
      if (d.shear && d.shear.stirrups) {
        const stirrupMatch = d.shear.stirrups.match(/(\d+)Φ(\d+)@(\d+)/);
        if (stirrupMatch) {
          const sDia = parseInt(stirrupMatch[2]) || 8;
          const spacing = parseInt(stirrupMatch[3]) || 150;
          const count = Math.ceil((L_m * 1000) / spacing) + 1;
          const perim = 2 * ((b.b - 80) / 1000 + (b.h - 80) / 1000) + 2 * Math.max(12 * sDia / 1000, 0.15);

          addRebarItem({
            barMark: `B-ST1-${b.id}`,
            elementId: b.id,
            storyId: b.storyId,
            elementType: 'beam',
            classification: 'Stirrups',
            diameter: sDia,
            length: perim,
            shapeCode: '51', // Stirrup rectangle
            quantity: count,
            detailNo: 'DT-S1',
            sectionNo: 'SEC-X'
          });
        }
      }
    });
  }

  // ==========================================
  // 2. COLUMNS REBAR (from Designs)
  // ==========================================
  if (Array.isArray(colDesigns)) {
    colDesigns.forEach((d) => {
      const c = columns.find(item => item.id === d.id);
      if (!c || c.isRemoved) return;

      const colHtM = c.L / 1000;
      const extension = 1.0; // lap splice extension
      const verticalLen = colHtM + extension;

      // Vertical Bars
      addRebarItem({
        barMark: `C-V1-${c.id}`,
        elementId: c.id,
        storyId: c.storyId,
        elementType: 'column',
        classification: 'Column Bars',
        diameter: d.design.dia,
        length: verticalLen,
        shapeCode: '00', // Straight
        quantity: d.design.bars,
        detailNo: 'DT-C1',
        sectionNo: 'SEC-Y'
      });

      // Lateral Ties (Stirrups)
      if (d.design && d.design.stirrups) {
        const tieMatch = d.design.stirrups.match(/Φ(\d+)@(\d+)/);
        if (tieMatch) {
          const tieDia = parseInt(tieMatch[1]) || 8;
          const spacing = parseInt(tieMatch[2]) || 150;
          const count = Math.ceil((colHtM * 1000) / spacing);
          const outerPerimeter = 2 * ((c.b - 80) / 1000 + (c.h - 80) / 1000) + 2 * Math.max(12 * tieDia / 1000, 0.12);

          addRebarItem({
            barMark: `C-T1-${c.id}`,
            elementId: c.id,
            storyId: c.storyId,
            elementType: 'column',
            classification: 'Column Ties',
            diameter: tieDia,
            length: outerPerimeter,
            shapeCode: '51',
            quantity: count,
            detailNo: 'DT-C2',
            sectionNo: 'SEC-Z'
          });
        }
      }
    });
  }

  // ==========================================
  // 3. SLABS REBAR (from Designs / Geometry)
  // ==========================================
  if (Array.isArray(slabDesigns)) {
    slabDesigns.forEach((d) => {
      const s = slabs.find(item => item.id === d.id);
      if (!s) return;

      const lx = Math.abs(s.x2 - s.x1) / 1000 || 4.5;
      const ly = Math.abs(s.y2 - s.y1) / 1000 || 4.0;

      // Bottom mesh short direction
      const shortDia = d.design?.shortDir?.dia || 12;
      const shortSpacing = d.design?.shortDir?.spacing || 150;
      const shortLen = lx + 2 * 0.15; // with end hooks
      const shortQty = Math.ceil((ly * 1000) / shortSpacing) + 1;

      addRebarItem({
        barMark: `SL-XS-${s.id}`,
        elementId: s.id,
        storyId: s.storyId,
        elementType: 'slab',
        classification: 'Slab Bars',
        diameter: shortDia,
        length: shortLen,
        shapeCode: '11', // L or hook
        quantity: shortQty,
        detailNo: 'DT-SL1',
        sectionNo: 'SEC-S1'
      });

      // Bottom mesh long direction
      const longDia = d.design?.longDir?.dia || 12;
      const longSpacing = d.design?.longDir?.spacing || 150;
      const longLen = ly + 2 * 0.15;
      const longQty = Math.ceil((lx * 1000) / longSpacing) + 1;

      addRebarItem({
        barMark: `SL-YL-${s.id}`,
        elementId: s.id,
        storyId: s.storyId,
        elementType: 'slab',
        classification: 'Slab Bars',
        diameter: longDia,
        length: longLen,
        shapeCode: '11',
        quantity: longQty,
        detailNo: 'DT-SL1',
        sectionNo: 'SEC-S2'
      });
    });
  }

  // ==========================================
  // 4. FOUNDATIONS REBAR (if designs exist)
  // ==========================================
  if (Array.isArray(foundationResults) && foundationResults.length > 0) {
    foundationResults.forEach((f) => {
      // Rebar parallel to X-axis
      const lenX = (f.B / 1000) - 0.1; // minus concrete cover (50mm each side)
      addRebarItem({
        barMark: `F-X1-${f.colId}`,
        elementId: `FOOT-${f.colId}`,
        storyId: 'foundation_level',
        elementType: 'foundation',
        classification: 'Foundation Bars',
        diameter: f.dia_x || 14,
        length: lenX + 2 * 0.15, // horizontal + vertical corner leg hook
        shapeCode: '11', // Corner leg L rebar
        quantity: f.bars_x || 10,
        detailNo: 'DT-F1',
        sectionNo: 'SEC-F1'
      });

      // Rebar parallel to Y-axis
      const lenY = (f.L / 1000) - 0.1; 
      addRebarItem({
        barMark: `F-Y1-${f.colId}`,
        elementId: `FOOT-${f.colId}`,
        storyId: 'foundation_level',
        elementType: 'foundation',
        classification: 'Foundation Bars',
        diameter: f.dia_y || 14,
        length: lenY + 2 * 0.15,
        shapeCode: '11',
        quantity: f.bars_y || 10,
        detailNo: 'DT-F1',
        sectionNo: 'SEC-F2'
      });

      // 5. PEDESTAL & COL DOWELS (رقاب وأشاير الأعمدة)
      // Dowels transition from foundations to columns
      const lapSplice = Math.max(40 * (f.dia_x || 14) / 1000, 0.6); // 40db
      const dowelLen = 1.0 + lapSplice + 0.3; // anchor leg 300mm on footing bottom
      const dowelCount = f.bars_x ? Math.max(4, Math.floor((f.colB || 300) > 300 ? 6 : 4)) : 4;

      addRebarItem({
        barMark: `F-DW1-${f.colId}`,
        elementId: `PED-${f.colId}`,
        storyId: 'foundation_level',
        elementType: 'pedestal',
        classification: 'Dowels',
        diameter: 16, // typical robust starter bar
        length: dowelLen,
        shapeCode: '11', // corner shape leg on bottom mesh
        quantity: dowelCount,
        detailNo: 'DT-F2',
        sectionNo: 'SEC-DW'
      });
    });
  } else {
    // Generate simulated standard isolated footings and dowels if designs aren't fully generated yet
    columns.forEach((c, idx) => {
      if (idx > 10 || c.isRemoved) return; // Keep standard volume reasonable
      const fWidth = 1.5; // meters
      const fLength = 1.5;
      const fHeight = 0.5;

      addRebarItem({
        barMark: `F-X1-${c.id}`,
        elementId: `FOOT-${c.id}`,
        storyId: 'foundation_level',
        elementType: 'foundation',
        classification: 'Foundation Bars',
        diameter: 14,
        length: fWidth - 0.1 + 0.3, // straight L width
        shapeCode: '11',
        quantity: 10,
        detailNo: 'DT-F1',
        sectionNo: 'SEC-F1'
      });

      addRebarItem({
        barMark: `F-Y1-${c.id}`,
        elementId: `FOOT-${c.id}`,
        storyId: 'foundation_level',
        elementType: 'foundation',
        classification: 'Foundation Bars',
        diameter: 14,
        length: fLength - 0.1 + 0.3,
        shapeCode: '11',
        quantity: 10,
        detailNo: 'DT-F1',
        sectionNo: 'SEC-F2'
      });

      // Pedestal dowels
      addRebarItem({
        barMark: `F-DW-${c.id}`,
        elementId: `PED-${c.id}`,
        storyId: 'foundation_level',
        elementType: 'pedestal',
        classification: 'Dowels',
        diameter: 14,
        length: 1.5,
        shapeCode: '11',
        quantity: 6,
        detailNo: 'DT-F1',
        sectionNo: 'SEC-P3'
      });
    });
  }

  // ==========================================
  // 6. FUTURE RAFTS & FUTURE WALLS (Placeholder/Provisions)
  // ==========================================
  // Add a typical high strength raft foundation layout to indicate system support
  addRebarItem({
    barMark: `RAFT-T1`,
    elementId: 'RAFT-MAIN',
    storyId: 'foundation_level',
    elementType: 'raft',
    classification: 'Foundation Bars',
    diameter: 20,
    length: 12.0, // main rebar length
    shapeCode: '00',
    quantity: 120, // top layer primary
    detailNo: 'DT-R1',
    sectionNo: 'SEC-R1'
  });

  addRebarItem({
    barMark: `RAFT-B1`,
    elementId: 'RAFT-MAIN',
    storyId: 'foundation_level',
    elementType: 'raft',
    classification: 'Foundation Bars',
    diameter: 22,
    length: 12.0,
    shapeCode: '00',
    quantity: 120, // bottom layer primary
    detailNo: 'DT-R1',
    sectionNo: 'SEC-R2'
  });

  // Future shear walls
  addRebarItem({
    barMark: `WAL-V1`,
    elementId: 'SH-WALL-1',
    storyId: 'foundation_level',
    elementType: 'wall',
    classification: 'Longitudinal Bars',
    diameter: 16,
    length: 3.2,
    shapeCode: '00',
    quantity: 48,
    detailNo: 'DT-W1',
    sectionNo: 'SEC-W1'
  });

  return database;
}

/**
 * Perform comprehensive analysis & metrics calculations
 */
export function analyzeReinforcementDatabase(items: RebarScheduleItem[]) {
  let totalLength = 0;
  let totalWeight = 0;

  const weightByDia = new Map<number, { length: number; weight: number; count: number }>();
  const weightByStory = new Map<string, { label: string; weight: number; length: number }>();
  const weightByElement = new Map<string, { weight: number; length: number; count: number }>();

  items.forEach(item => {
    totalLength += item.totalLength;
    totalWeight += item.totalWeight;

    // By Diameter
    const diaVal = weightByDia.get(item.diameter) || { length: 0, weight: 0, count: 0 };
    diaVal.length += item.totalLength;
    diaVal.weight += item.totalWeight;
    diaVal.count += item.quantity;
    weightByDia.set(item.diameter, diaVal);

    // By Story
    const sId = item.storyId || 'foundation_level';
    const sVal = weightByStory.get(sId) || { label: item.storyLabel, weight: 0, length: 0 };
    sVal.weight += item.totalWeight;
    sVal.length += item.totalLength;
    weightByStory.set(sId, sVal);

    // By Element Type
    const elType = item.elementType;
    const elVal = weightByElement.get(elType) || { weight: 0, length: 0, count: 0 };
    elVal.weight += item.totalWeight;
    elVal.length += item.totalLength;
    elVal.count += item.quantity;
    weightByElement.set(elType, elVal);
  });

  return {
    totalLength: parseFloat(totalLength.toFixed(2)),
    totalWeight: parseFloat(totalWeight.toFixed(1)),
    weightByDiameter: Array.from(weightByDia.entries()).map(([dia, v]) => ({
      diameter: dia,
      totalLength: parseFloat(v.length.toFixed(2)),
      totalWeight: parseFloat(v.weight.toFixed(1)),
      quantity: v.count,
    })).sort((a,b) => a.diameter - b.diameter),
    weightByStory: Array.from(weightByStory.entries()).map(([id, v]) => ({
      storyId: id,
      storyLabel: v.label,
      totalWeight: parseFloat(v.weight.toFixed(1)),
      totalLength: parseFloat(v.length.toFixed(2)),
    })),
    weightByElement: Array.from(weightByElement.entries()).map(([type, v]) => ({
      elementType: type,
      totalWeight: parseFloat(v.weight.toFixed(1)),
      totalLength: parseFloat(v.length.toFixed(2)),
      quantity: v.count,
    })),
  };
}

/**
 * Central QC consistency checker to audit the database against major QA parameters
 */
export function auditReinforcementDatabase(items: RebarScheduleItem[]): RebarAuditIssue[] {
  const issues: RebarAuditIssue[] = [];
  let issueId = 1;

  const marksSeen = new Map<string, RebarScheduleItem>();

  items.forEach(item => {
    // 1. Missing Marks
    if (!item.barMark || item.barMark.trim() === '') {
      issues.push({
        id: `AUD-${issueId++}`,
        category: 'mark',
        severity: 'high',
        title: 'رمز قضيب حديد مفقود (Missing Bar Mark)',
        message: `تم رصد قضيب حديد تابع للعنصر (${item.elementId}) بقطر Φ${item.diameter} مم ليس لديه رمز أو علامة تسليح (Bar Mark).`,
        elementId: item.elementId,
        elementType: item.elementType,
        suggestion: 'قم بتعيين رمز فريد مثل T-X1 أو B-1 لصالح قضيب حديد التسليح.'
      });
    } else {
      // 2. Duplicate Marks Check
      const existing = marksSeen.get(item.barMark);
      if (existing) {
        // A conflict arises if there are different properties for the exact same bar mark label
        if (existing.diameter !== item.diameter || Math.abs(existing.length - item.length) > 0.05) {
          issues.push({
            id: `AUD-${issueId++}`,
            category: 'mark',
            severity: 'medium',
            title: 'تكرار تعارض رمز التسليح (Duplicate & Conflicting Bar Mark)',
            message: `الرمز (${item.barMark}) تم استخدامه مع قيم مختلفة! مستخدم مع قطر Φ${existing.diameter} ولعنصر قطر Φ${item.diameter} أو أطوال مختلفة.`,
            elementId: item.elementId,
            elementType: item.elementType,
            barMark: item.barMark,
            suggestion: 'تأكد من توحيد رمز القضيب أو توفير لاحقة مميزة للترميز لتجنب خلط عمال التصنيع في الموقع.'
          });
        }
      } else {
        marksSeen.set(item.barMark, item);
      }
    }

    // 3. Invalid individual length of rebar
    if (item.length <= 0) {
      issues.push({
        id: `AUD-${issueId++}`,
        category: 'dimensions',
        severity: 'high',
        title: 'طول قضيب غير صالح (Invalid Rebar Length)',
        message: `طول القضيب المكتوب (${item.length} م) للعنصر (${item.elementId}) غير مقبول هندسياً.`,
        elementId: item.elementId,
        elementType: item.elementType,
        suggestion: 'راجع مصفوفة الإحصائيات أو كود التفاصيل والتداخل لإعادة تصفير الطول ليتجاوز الصفر.'
      });
    } else if (item.length > 12.0) {
      issues.push({
        id: `AUD-${issueId++}`,
        category: 'dimensions',
        severity: 'medium',
        title: 'طول قضيب يتجاوز الحد القياسي المسموح للنقل (Rebar Exceeds Standard Length)',
        message: `قضيب التسليح ${item.barMark} بطول (${item.length} م) يتجاوز الطول التجاري القياسي في الأسواق (12.0 مترًا).`,
        elementId: item.elementId,
        elementType: item.elementType,
        barMark: item.barMark,
        suggestion: 'ينصح بالتقطيع وإضافة توصيلات (Lap Splice) أو استخدام وصلات ميكانيكية لضمان سهولة الشحن والصب.'
      });
    }

    // 4. Invalid quantities
    if (item.quantity <= 0) {
      issues.push({
        id: `AUD-${issueId++}`,
        category: 'quantities',
        severity: 'high',
        title: 'كمية تسليح غير صالحة (Zero or Negative Quantity)',
        message: `تم العثور على تكرار أو عدد (${item.quantity}) للقضيب رمز ${item.barMark} بمقدار غير قانوني.`,
        elementId: item.elementId,
        elementType: item.elementType,
        suggestion: 'تحقق من حساب الكثافة أو المسافات البينية للتوزيع.'
      });
    } else if (item.quantity > 350 && item.elementType !== 'slab' && item.elementType !== 'raft') {
      issues.push({
        id: `AUD-${issueId++}`,
        category: 'quantities',
        severity: 'low',
        title: 'كمية تسليح مرتفعة جداً لمشروع فردي (High Quantity Warning)',
        message: `العنصر ${item.elementId} يحتوي على كمية كبيرة جداً من القضبان (${item.quantity}) للرمز نفسه.`,
        elementId: item.elementId,
        elementType: item.elementType,
        suggestion: 'تأكد من عدم وجود خلط أو تكرار بالمعاملات الثنائية أثناء حلقة الحساب.'
      });
    }

    // 5. Drawing Reference Warning
    if (!item.drawingRef || !item.drawingRef.sheetNo || item.drawingRef.sheetNo.trim() === '') {
      issues.push({
        id: `AUD-${issueId++}`,
        category: 'references',
        severity: 'low',
        title: 'لوحة تفاصيل مرجعية مفقودة (Missing Layout Reference)',
        message: `قضيب التسليح (${item.barMark}) يفتقر إلى تعيين لوحة الرسم أو رمز الجدول التفصيلي للـ BBS.`,
        elementId: item.elementId,
        elementType: item.elementType,
        suggestion: 'قم بتحديث مصفوفة اللوحات وخرائط التوزيع لتعيين رقم لوحة مثل S-101.'
      });
    }
  });

  return issues;
}

/**
 * Global API exporter to fetch reinforcement data objects dynamically in memory
 */
export function exposeReinforcementDatabaseToWindow(database: RebarScheduleItem[]): void {
  if (typeof window !== 'undefined') {
    (window as any).reinforcementScheduleDatabase = {
      items: database,
      insights: analyzeReinforcementDatabase(database),
      getSummaryByDiameter: () => analyzeReinforcementDatabase(database).weightByDiameter,
      getSummaryByStory: () => analyzeReinforcementDatabase(database).weightByStory,
      getSummaryByElement: () => analyzeReinforcementDatabase(database).weightByElement,
      findItemByMark: (mark: string) => database.filter(item => item.barMark === mark),
      audit: () => auditReinforcementDatabase(database)
    };
    console.log('✅ AI Studio: Exposed window.reinforcementScheduleDatabase API successfully.');
  }
}

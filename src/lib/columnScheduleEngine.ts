/**
 * Phase D6B: Column Schedule System
 * Provides data modeling, automatic grouping, quantities estimation (volume, steel weight, formwork),
 * sorting & filtering, and validation algorithms for complete construction-level column schedules
 * comparable to STA4CAD output.
 */

import { Column, Story, MatProps } from './structuralEngine';

export interface ColumnScheduleRow {
  id: string;
  columnId: string;
  name: string;
  storyName: string;
  gridLocation: string;
  drawingRef: string;
  
  // Geometry
  width: number;  // mm
  depth: number;  // mm
  height: number; // mm
  shape: 'Rectangular' | 'Square' | 'Circular' | 'L-Shape' | 'T-Shape';
  orientation: string; // e.g. "0° (Horizontal)" or "90° (Vertical)"

  // Longitudinal Reinforcement
  barCount: number;
  barDiameter: number;
  totalSteelArea: number; // cm2
  barMarks: string;

  // Tie Reinforcement
  tieDiameter: number;
  tieSpacing: number; // mm
  confinementZones: string; // e.g., "Ø10 @ 100 mm (End) / 150 mm (Mid)"
  tieMarks: string;

  // Materials
  concreteStrength: string;
  steelGrade: string;
  cover: number; // mm

  // Quantities
  concreteVolume: number; // m3
  steelWeight: number;    // kg
  formworkArea: number;   // m2

  // Detail References
  detailNum: string;
  sectionNum: string;
  sheetNo: string;

  // Group size
  groupCount: number;
}

export interface ColumnScheduleValidationIssue {
  id: string;
  columnId: string;
  severity: 'high' | 'medium' | 'info';
  category: 'id' | 'reinforcement' | 'reference' | 'geometry';
  message: string;
  correctiveAction: string;
}

export class ColumnScheduleEngine {

  /**
   * Generates a fully calculated list of column schedule rows from columns and resolved designs
   */
  public static generateSchedule(
    columns: Column[],
    stories: Story[],
    colDesigns: Record<string, any>,
    mat?: MatProps
  ): ColumnScheduleRow[] {
    const material = mat || { fc: 30, fy: 420, fyt: 280, gamma: 24, stirrupDia: 10 };
    const rows: ColumnScheduleRow[] = [];

    columns.forEach((c, index) => {
      // Find matching story
      const storyObj = stories.find(s => s.id === c.storyId);
      const storyName = storyObj?.label || stories[0]?.label || 'GF';

      // Dimensions
      const b = c.b || 300;
      const h = c.h || 400;
      const L = c.L || 3200; // default height in mm

      // Column Shape
      let shape: 'Rectangular' | 'Square' | 'Circular' | 'L-Shape' | 'T-Shape' = 'Rectangular';
      if (b === h) {
        shape = 'Square';
      }

      // Orientation
      const angle = c.orientAngle || 0;
      const orientation = `${angle}° (${angle === 90 || angle === 270 ? 'Vertical' : 'Horizontal'})`;

      // Get design reinforcement details
      const design = colDesigns[c.id] || {
        barCount: 8,
        barDiameter: 16,
        tiesText: 'Ø 10 @ 150 mm',
        rebarSpacing: 150
      };

      const barCount = design.barCount || 8;
      const barDiameter = design.barDiameter || 16;
      const tieSpacing = design.rebarSpacing || 150;
      const tieDiameter = material.stirrupDia || 10;

      // Steel Area computations
      const singleArea = (Math.PI * barDiameter * barDiameter) / 4; // mm2
      const totalAreaMm2 = barCount * singleArea;
      const totalSteelArea = parseFloat((totalAreaMm2 / 100).toFixed(2)); // cm2

      // Quantities
      const concreteVolume = parseFloat(((b / 1000) * (h / 1000) * (L / 1000)).toFixed(3));
      const formworkArea = parseFloat(((2 * (b + h) / 1000) * (L / 1000)).toFixed(2));

      // Steel weight estimation (longitudinal rebars + tie loops)
      // weight per meter = dia^2 / 162
      const longWeightPerMeter = (barDiameter * barDiameter) / 162;
      const longWeight = longWeightPerMeter * (L / 1000) * barCount;

      // Ties weight estimate: Include cross tie factor (say 1.25 inner loops)
      const tieLength = 1.25 * (2 * (b - 80) + 2 * (h - 80)) / 1000; // in meters (with hooks)
      const tiesCount = Math.ceil(L / tieSpacing) + 1;
      const tieWeightPerMeter = (tieDiameter * tieDiameter) / 162;
      const tieWeight = tieLength * tiesCount * tieWeightPerMeter;

      const totalSteelWeight = parseFloat((longWeight + tieWeight).toFixed(2));

      // Grid position estimation based on rounded coordinates
      let gridLocation = `Axis ${String.fromCharCode(65 + Math.abs(Math.round(c.x / 4) % 6))}-${Math.abs(Math.round(c.y / 4) % 10) + 1}`;
      if (c.x === 0 && c.y === 0) {
        gridLocation = `Axis A-1`;
      }

      rows.push({
        id: c.id,
        columnId: c.id,
        name: c.name || `C-${c.id}`,
        storyName,
        gridLocation,
        drawingRef: `S-103`,
        width: b,
        depth: h,
        height: L,
        shape,
        orientation,
        barCount,
        barDiameter,
        totalSteelArea,
        barMarks: `C-Long-${barDiameter}`,
        tieDiameter,
        tieSpacing,
        confinementZones: `Ø${tieDiameter} @ 100 mm (Ends) / ${tieSpacing} mm (Mid)`,
        tieMarks: `C-Tie-${tieDiameter}`,
        concreteStrength: `C${material.fc}`,
        steelGrade: `F${material.fy}`,
        cover: 40,
        concreteVolume,
        steelWeight: totalSteelWeight,
        formworkArea,
        detailNum: `Detail 1`,
        sectionNum: `Sec C-C`,
        sheetNo: `S-203`,
        groupCount: 1
      });
    });

    return rows;
  }

  /**
   * Groups identical columns structurally (matching shape, dimensions, height, main bars, and ties)
   */
  public static groupScheduleRows(rows: ColumnScheduleRow[]): ColumnScheduleRow[] {
    const groups: { [key: string]: ColumnScheduleRow } = {};

    rows.forEach(row => {
      // Create a unique design signature
      const key = `${row.width}x${row.depth}x${row.height}_${row.shape}_${row.barCount}T${row.barDiameter}_${row.tieSpacing}`;
      
      if (groups[key]) {
        groups[key].groupCount += 1;
        // Combine names/lists if helpful, e.g. "C1, C4, C5" (we can keep representative or list them)
        if (!groups[key].name.includes(row.name)) {
          groups[key].name = `${groups[key].name}, ${row.name}`;
        }
        // Accumulate quantities totals
        groups[key].concreteVolume = parseFloat((groups[key].concreteVolume + row.concreteVolume).toFixed(3));
        groups[key].steelWeight = parseFloat((groups[key].steelWeight + row.steelWeight).toFixed(2));
        groups[key].formworkArea = parseFloat((groups[key].formworkArea + row.formworkArea).toFixed(2));
      } else {
        groups[key] = { ...row, groupCount: 1 };
      }
    });

    return Object.values(groups);
  }

  /**
   * Runs detailed structural/drawings validations over the schedules
   */
  public static validateSchedule(rows: ColumnScheduleRow[]): ColumnScheduleValidationIssue[] {
    const issues: ColumnScheduleValidationIssue[] = [];
    const usedIds = new Set<string>();

    rows.forEach(r => {
      // 1. Check duplicate IDs
      if (usedIds.has(r.columnId)) {
        issues.push({
          id: `u-${r.columnId}`,
          columnId: r.columnId,
          severity: 'high',
          category: 'id',
          message: `معرّف العمود مكرر للرمز: (${r.columnId})`,
          correctiveAction: 'يرجى مراجعة مكررات الكود ومطابقة الترقيم الهندسي للعمود.'
        });
      }
      usedIds.add(r.columnId);

      // 2. Check missing/invalid reinforcement
      if (r.barCount <= 0 || !r.barDiameter) {
        issues.push({
          id: `r-miss-${r.columnId}`,
          columnId: r.columnId,
          severity: 'high',
          category: 'reinforcement',
          message: `عمود (${r.columnId}) يفتقد لبيانات تسليح الحديد الطولي الرئيسي.`,
          correctiveAction: 'قم بتعريف حديد طولي للعمود مع قطر لا يقل عن 12 مم.'
        });
      } else if (r.barCount < 4) {
        issues.push({
          id: `r-count-${r.columnId}`,
          columnId: r.columnId,
          severity: 'high',
          category: 'reinforcement',
          message: `عدد قضبان تسليح العمود (${r.columnId}) أقل من الحد المسموح به كودًا وهو 4 قضبان للأعمدة المستطيلة.`,
          correctiveAction: 'تكثيف حديد التسليح الطولي ليكون 4 قضبان بحد أدنى.'
        });
      }

      // 3. Check invalid dimensional limits (ACI Code checks)
      if (r.width < 200 || r.depth < 200) {
        issues.push({
          id: `g-dim-${r.columnId}`,
          columnId: r.columnId,
          severity: 'medium',
          category: 'geometry',
          message: `المقطع الإنشائي للعمود (${r.columnId}) صغير للغاية (${r.width}x${r.depth} mm) ويقل عن 200 مم.`,
          correctiveAction: 'تكبير المقطع الخرساني ليتماشى مع متطلبات الكود المعتمد.'
        });
      }

      // 4. Missing sheet reference or detail
      if (!r.sheetNo || r.sheetNo === 'none') {
        issues.push({
          id: `ref-${r.columnId}`,
          columnId: r.columnId,
          severity: 'info',
          category: 'reference',
          message: `مرجع ورقة المخططات الفنية غير محدد للعمود (${r.columnId}).`,
          correctiveAction: 'تعيين شيت المخطط كـ S-103 أو S-203.'
        });
      }
    });

    return issues;
  }
}

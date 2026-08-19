/**
 * Phase D6C: Slab Schedule System Engine
 * Provides data modeling, automatic grouping, detailed quantities estimation (volume, steel weight, formwork),
 * sorting & filtering, and validation algorithms for complete slab construction schedules.
 */

import { Slab, Story, MatProps } from './structuralEngine';

export type SlabTypeLabel = 
  | 'Solid Slab' 
  | 'One Way Slab' 
  | 'Two Way Slab' 
  | 'Flat Slab' 
  | 'Ribbed Slab' 
  | 'Hollow Block Slab' 
  | 'Waffle Slab' 
  | 'Future Slab Type';

export interface SlabScheduleRow {
  id: string;          // Database ID
  slabId: string;      // Unique code name like S101
  name: string;        // Editable display name
  storyName: string;
  gridLocation: string;
  drawingRef: string;

  // Geometry
  length: number;      // m
  width: number;       // m
  area: number;        // m2
  thickness: number;   // mm
  perimeter: number;   // m

  // Design Data
  slabType: SlabTypeLabel;
  designMethod: string;  // e.g., "ACI Coefficient Method" or "FEM Isostatic"
  spanDirection: 'One-Way X' | 'One-Way Y' | 'Two-Way' | 'Flat/Isotropic';
  supportConditions: string;

  // Reinforcement Data
  topReinforcement: string;      // e.g. "Ø10 @ 150 mm"
  bottomReinforcement: string;   // e.g. "Ø12 @ 150 mm"
  additionalReinforcement: string; // e.g. "Ø12 @ 200 mm (Support Overlap)"
  supportReinforcement: string;    // e.g. "N/A"
  openingReinforcement: string;    // e.g. "2 Ø14 Trimmers around corners"
  reinforcementMarks: string;     // e.g. "S-B12/T10"

  // Materials
  concreteStrength: string;
  steelGrade: string;
  cover: number;       // mm

  // Quantities
  concreteVolume: number;  // m3
  steelWeight: number;     // kg
  formworkArea: number;    // m2

  // Detail References
  detailNum: string;
  sectionNum: string;
  sheetNo: string;

  // Group Details
  groupCount: number;
  originalIds: string[]; // List of IDs that was grouped in this row
}

export interface SlabScheduleValidationIssue {
  id: string;
  slabId: string;
  severity: 'high' | 'medium' | 'info';
  category: 'id' | 'reinforcement' | 'reference' | 'geometry' | 'deflection';
  message: string;
  correctiveAction: string;
}

export class SlabScheduleEngine {

  /**
   * Generates calculated lists of Slab schedule rows based on stories, slabs, and design variables
   */
  public static generateSchedule(
    slabs: Slab[],
    stories: Story[],
    slabDesigns?: Record<string, any>,
    mat?: MatProps
  ): SlabScheduleRow[] {
    const material = mat || { fc: 25, fy: 420, fyt: 280, gamma: 24, stirrupDia: 10 };
    const rows: SlabScheduleRow[] = [];

    slabs.forEach((s) => {
      // Find matching story
      const storyObj = stories.find(st => st.id === s.storyId);
      const storyName = storyObj?.label || stories[0]?.label || 'L1';

      // Dimensions calculation from bounding coordinates (x1, y1, x2, y2)
      // Usually stored in millimeters (or meters, let's auto-detect scale)
      let dx = Math.abs((s.x2 - s.x1) || 4000);
      let dy = Math.abs((s.y2 - s.y1) || 3000);

      // If dimensions are insanely small (e.g. under 15), they are in meters, convert to mm for calculations
      if (dx < 50 && dy < 50) {
        dx = dx * 1000;
        dy = dy * 1000;
      }

      const lengthM = parseFloat((Math.max(dx, dy) / 1000).toFixed(2));
      const widthM = parseFloat((Math.min(dx, dy) / 1000).toFixed(2));
      const thicknessMm = s.t || s.thickness || 150;

      // Area computation
      let areaM2 = lengthM * widthM;
      let perimeterM = 2 * (lengthM + widthM);

      // Overwrite with exact polygon polygon-based math if vertices are defined
      if (s.vertices && s.vertices.length >= 3) {
        let polygonArea = 0;
        let polygonPerimeter = 0;
        const v = s.vertices;
        const n = v.length;
        
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          polygonArea += v[i].x * v[j].y - v[j].x * v[i].y;
          
          // distance formula between consecutive vertices
          const dist = Math.sqrt(Math.pow(v[j].x - v[i].x, 2) + Math.pow(v[j].y - v[i].y, 2));
          polygonPerimeter += dist;
        }
        
        polygonArea = Math.abs(polygonArea) / 2;
        // Check if area is in square meters vs square millimeters
        if (polygonArea > 5000) {
          areaM2 = parseFloat((polygonArea / 1000000).toFixed(2));
          perimeterM = parseFloat((polygonPerimeter / 1000).toFixed(2));
        } else {
          areaM2 = parseFloat(polygonArea.toFixed(2));
          perimeterM = parseFloat(polygonPerimeter.toFixed(2));
        }
      }

      // Determine SlabTypeLabel
      let sType: SlabTypeLabel = 'Solid Slab';
      if (s.slabType === 'one_way_ribbed' || s.type === 'one_way_ribbed' || s.type === 'ribbed') {
        sType = 'Ribbed Slab';
      } else if (thicknessMm >= 220) {
        sType = 'Flat Slab';
      } else if (lengthM / widthM > 2.0) {
        sType = 'One Way Slab';
      } else {
        sType = 'Two Way Slab';
      }

      // Span Direction
      let spanDir: 'One-Way X' | 'One-Way Y' | 'Two-Way' | 'Flat/Isotropic' = 'Two-Way';
      if (sType === 'Ribbed Slab') {
        const dir = s.ribDirection || s.direction || 'X';
        spanDir = dir === 'X' || dir === 'one_way_x' ? 'One-Way X' : 'One-Way Y';
      } else if (sType === 'One Way Slab') {
        spanDir = dx > dy ? 'One-Way Y' : 'One-Way X';
      } else if (sType === 'Flat Slab') {
        spanDir = 'Flat/Isotropic';
      }

      // Design Method
      let designMethod = 'ACI Coefficient Method (ACI 318)';
      if (sType === 'Flat Slab') {
        designMethod = 'Direct Design Method (DDM)';
      } else if (sType === 'Ribbed Slab') {
        designMethod = 'Continuous Beam Analogy';
      }

      // Support Conditions
      let supportConditions = 'Continuous on 4 sides';
      if (sType === 'Flat Slab') {
        supportConditions = 'Supported on columns with drop panels';
      } else if (sType === 'One Way Slab') {
        supportConditions = 'Simply supported on opposite beams';
      } else if (lengthM / widthM > 3.0) {
        supportConditions = 'Cantilevered (Free external edge)';
      }

      // Extract custom design if passed
      const design = (slabDesigns && slabDesigns[s.id]) || {
        rebarBottom: sType === 'Ribbed Slab' ? '2 Ø14 (in Ribs)' : 'Ø12 @ 150 mm',
        rebarTop: sType === 'Flat Slab' ? 'Ø12 @ 150 mm' : 'Ø10 @ 150 mm',
        additional: sType === 'Flat Slab' ? 'Ø12 @ 150 mm (Support Strips)' : 'Ø10 @ 200 mm (At Beams)',
        openingRebar: '2 Ø14 Diagonal Trimmers',
        supportRebar: sType === 'Ribbed Slab' ? 'Ø10 @ 250 m mesh (Topping)' : 'Ø12 @ 150 mm'
      };

      // Quantities calculations
      const concreteVolume = parseFloat((areaM2 * (thicknessMm / 1000)).toFixed(3));
      // Formwork includes bottom area + outer margins
      const formworkArea = parseFloat((areaM2 + (perimeterM * (thicknessMm / 1000))).toFixed(2));

      // Steel weight estimation based on reinforcement density (kg / m2):
      // Solid slab typical rebar content: 12-18 kg/m2 depending on thickness.
      // Ribbed slab rebar content: 18-24 kg/m2
      // Flat slab rebar content: 22-30 kg/m2
      let baseDensityKgM2 = 14; 
      if (sType === 'Ribbed Slab') baseDensityKgM2 = 18;
      if (sType === 'Flat Slab') baseDensityKgM2 = 24;
      if (thicknessMm > 180) baseDensityKgM2 += (thicknessMm - 150) * 0.12;

      const steelWeight = parseFloat((areaM2 * baseDensityKgM2).toFixed(2));

      // Grid location calculation
      const xCenter = (s.x1 + s.x2) / 2;
      const yCenter = (s.y1 + s.y2) / 2;
      const gridX = String.fromCharCode(65 + Math.abs(Math.round(xCenter / 4.5) % 6));
      const gridY = Math.abs(Math.round(yCenter / 4.5) % 8) + 1;
      const gridLocation = `Grid ${gridX}-${gridY}`;

      rows.push({
        id: s.id,
        slabId: s.id,
        name: s.id.toUpperCase().startsWith('S') ? s.id.toUpperCase() : `S-${s.id}`,
        storyName,
        gridLocation,
        drawingRef: `S-104`,
        length: lengthM,
        width: widthM,
        area: areaM2,
        thickness: thicknessMm,
        perimeter: parseFloat(perimeterM.toFixed(2)),
        slabType: sType,
        designMethod,
        spanDirection: spanDir,
        supportConditions,
        topReinforcement: design.rebarTop || 'Ø10 @ 150 mm',
        bottomReinforcement: design.rebarBottom || 'Ø12 @ 150 mm',
        additionalReinforcement: design.additional || 'Ø10 @ 200 mm (At edge support)',
        supportReinforcement: design.supportRebar || 'Ø10 @ 150 mm',
        openingReinforcement: design.openingRebar || '2 Ø12 diagonal bars at openings',
        reinforcementMarks: sType === 'Ribbed Slab' ? 'S-R14/M10' : `S-B12/T10`,
        concreteStrength: `C${material.fc}`,
        steelGrade: `F${material.fy}`,
        cover: s.cover || 20,
        concreteVolume,
        steelWeight,
        formworkArea,
        detailNum: sType === 'Ribbed Slab' ? 'Detail R2' : 'Detail S1',
        sectionNum: sType === 'Ribbed Slab' ? 'Sec R-R' : 'Sec S-S',
        sheetNo: `S-204`,
        groupCount: 1,
        originalIds: [s.id]
      });
    });

    return rows;
  }

  /**
   * Automatically groups structurally identical slabs (matching type, thickness, dimensions, reinforcement, materials)
   */
  public static groupScheduleRows(rows: SlabScheduleRow[]): SlabScheduleRow[] {
    const groups: { [key: string]: SlabScheduleRow } = {};

    rows.forEach(row => {
      // Sig contains type, thickness, span direction, top and bottom steel configurations
      const sig = `${row.slabType}_${row.thickness}mm_${row.length}x${row.width}_${row.spanDirection}_${row.bottomReinforcement}_${row.topReinforcement}`;

      if (groups[sig]) {
        groups[sig].groupCount += 1;
        groups[sig].originalIds.push(row.id);
        
        // Accumulate names logically e.g., "S1, S2, S3"
        if (!groups[sig].name.includes(row.name)) {
          groups[sig].name = `${groups[sig].name}, ${row.name}`;
        }
        
        // Sum calculated quantities
        groups[sig].concreteVolume = parseFloat((groups[sig].concreteVolume + row.concreteVolume).toFixed(3));
        groups[sig].steelWeight = parseFloat((groups[sig].steelWeight + row.steelWeight).toFixed(2));
        groups[sig].formworkArea = parseFloat((groups[sig].formworkArea + row.formworkArea).toFixed(2));
        groups[sig].area = parseFloat((groups[sig].area + row.area).toFixed(2));
      } else {
        groups[sig] = { 
          ...row, 
          groupCount: 1, 
          originalIds: [row.id] 
        };
      }
    });

    return Object.values(groups);
  }

  /**
   * Runs detail/structural validations compliant with standard codes (ACI 318, slab deflection checks)
   */
  public static validateSchedule(rows: SlabScheduleRow[]): SlabScheduleValidationIssue[] {
    const issues: SlabScheduleValidationIssue[] = [];
    const idSet = new Set<string>();

    rows.forEach(r => {
      // 1. Identify duplicates
      if (idSet.has(r.slabId)) {
        issues.push({
          id: `dup-${r.id}`,
          slabId: r.slabId,
          severity: 'high',
          category: 'id',
          message: `تنبيه: معرّف البلاطة مكرر للرمز (${r.slabId}) في المخطط.`,
          correctiveAction: 'يرجى مراجعة ترقيم البلاطات في اللوحة وتعديل المعرف ليكون فريدًا.'
        });
      }
      idSet.add(r.slabId);

      // 2. Validate structural thickness for deflection limits (ACI table limits)
      // Standard rule: Solid slab min thickness is approx L/20 for simply supported & L/24 for continuous
      const minThickSimplySupported = Math.round((r.width * 1000) / 20); // in mm
      const minThickContinuous = Math.round((r.width * 1000) / 28); // continuous edges

      if (r.thickness < 100) {
        issues.push({
          id: `thick-low-${r.id}`,
          slabId: r.slabId,
          severity: 'high',
          category: 'geometry',
          message: `سماكة البلاطة (${r.slabId}) تبلغ ${r.thickness} مم، وهي أقل من الحد الأدنى المقبول إنشائياً (100 مم).`,
          correctiveAction: 'تكبير سماكة الصبة بما لا يقل عن 120 مم لضمان مقاومة الثقب والقص.'
        });
      } else if (r.thickness < minThickContinuous && r.slabType !== 'Ribbed Slab') {
        issues.push({
          id: `deflect-${r.id}`,
          slabId: r.slabId,
          severity: 'medium',
          category: 'deflection',
          message: `سماكة صبة البلاطة (${r.thickness} مم) قد لا تفي بمتطلبات السهم الأفقي (Deflection) بالنسبة للبحر الحاكم البالغ ${r.width} م.`,
          correctiveAction: `يوصى برفع السماكة لتساوي أو تزيد عن (${minThickContinuous} مم) لتجنب السهم طويل الأمد وفقاً للكود الأمريكي ACI 318.`
        });
      }

      // 3. Check reinforcement completeness
      if (!r.bottomReinforcement || r.bottomReinforcement === 'none') {
        issues.push({
          id: `rein-bot-${r.id}`,
          slabId: r.slabId,
          severity: 'high',
          category: 'reinforcement',
          message: `بلاطة (${r.slabId}) تفتقد لحديد التسليح السفلي الرئيسي.`,
          correctiveAction: 'أدخل حديد تسليح سفلي (مثلاً Ø12 @ 150 مم) لمقاومة عزوم الشد الموجبة.'
        });
      }

      if (!r.topReinforcement || r.topReinforcement === 'none') {
        issues.push({
          id: `rein-top-${r.id}`,
          slabId: r.slabId,
          severity: 'medium',
          category: 'reinforcement',
          message: `لا يوجد حديد تسليح علوي معرّف للبلاطة المستمرة (${r.slabId}).`,
          correctiveAction: 'مراجعة المخطط الهندسي وتعريف حديد تسليح علوي لمقاومة العزوم السالبة فوق الجسور الساندة.'
        });
      }

      // 4. Drawing references checks
      if (!r.sheetNo || r.sheetNo === 'none') {
        issues.push({
          id: `ref-${r.id}`,
          slabId: r.slabId,
          severity: 'info',
          category: 'reference',
          message: `مرجع ورقة ومخطط التسليح التفصيلي غير معرف للبلاطة (${r.slabId}).`,
          correctiveAction: 'تعيين رقم الشيت الهندسي المناسب (مثلاً S-104).'
        });
      }
    });

    return issues;
  }
}

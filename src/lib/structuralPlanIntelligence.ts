import { 
  DrawingDocument, 
  DrawingSheet, 
  DrawingViewport, 
  DrawingEntity,
  TextEntity,
  SymbolEntity,
  DimensionEntity,
  RectangleEntity,
  Point2D,
  AnnotationEngine,
  DimensionEngine
} from './drawingCoreEngine';

export interface BoundingBox2D {
  id: string;
  type: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  priority: number; // For Priority Order: Grid > Columns > Beams > Slabs > Dimensions > General Notes
}

export interface ReadabilityMetrics {
  overlapCount: number;
  textDensity: number;      // %
  dimensionDensity: number; // %
  whiteSpacePercent: number;// %
  balanceScore: number;     // 0-100 (where 100 is perfectly balanced left vs right)
  readabilityScore: number; // 0-100 aggregate rating
}

export interface CollisionHotspot {
  id: string;
  x: number;
  y: number;
  radius: number;
  cause: string;
  severity: 'low' | 'medium' | 'high';
}

export class StructuralPlanIntelligenceEngine {

  /**
   * Priority list of layers / entities
   * 1 = Grid (Highest priority, never move)
   * 2 = Column (Very High)
   * 3 = Beam (High)
   * 4 = Slab (Medium)
   * 5 = Dimension (Normal)
   * 6 = General Notes (Low)
   */
  private static getEntityPriority(entity: DrawingEntity): number {
    const layerId = (entity.layerId || '').toUpperCase();
    if (layerId.includes('GRID')) return 1;
    if (layerId.includes('COL')) return 2;
    if (layerId.includes('BEAM')) return 3;
    if (layerId.includes('SLAB')) return 4;
    if (layerId.includes('DIM')) return 5;
    return 6;
  }

  /**
   * Approximates Paper Space bounds (in mm) for a DrawingEntity.
   */
  public static getEntityBoundingBox(ent: DrawingEntity): BoundingBox2D | null {
    const priority = this.getEntityPriority(ent);
    
    switch (ent.type) {
      case 'text': {
        const textEnt = ent as TextEntity;
        const len = textEnt.text.length;
        const width = len * (textEnt.fontSize * 0.6); // approximate char width
        const height = textEnt.fontSize * 1.2;
        let minX = textEnt.x;
        let minY = textEnt.y - height / 2;
        
        if (textEnt.align === 'center') {
          minX = textEnt.x - width / 2;
        } else if (textEnt.align === 'right') {
          minX = textEnt.x - width;
        }
        
        return {
          id: ent.id,
          type: 'text',
          minX,
          minY,
          maxX: minX + width,
          maxY: minY + height,
          priority
        };
      }

      case 'symbol': {
        const sym = ent as SymbolEntity;
        const scale = sym.scale || 1.0;
        let size = 10 * scale; // Default approx size for tag symbols

        if (sym.symbolType === 'slab_tag') {
          size = 18 * scale;
        } else if (sym.symbolType === 'grid_bubble') {
          size = 9 * scale;
        }

        return {
          id: ent.id,
          type: 'symbol',
          minX: sym.x - size / 2,
          minY: sym.y - size / 2,
          maxX: sym.x + size / 2,
          maxY: sym.y + size / 2,
          priority
        };
      }

      case 'rectangle': {
        const rect = ent as RectangleEntity;
        return {
          id: ent.id,
          type: 'rectangle',
          minX: rect.x,
          minY: rect.y,
          maxX: rect.x + rect.width,
          maxY: rect.y + rect.height,
          priority
        };
      }

      case 'dimension': {
        const dim = ent as DimensionEntity;
        // Dimension can be represented as box enclosing the text and line region
        const pad = 4;
        const minX = Math.min(dim.x1, dim.x2, dim.dimX) - pad;
        const minY = Math.min(dim.y1, dim.y2, dim.dimY) - pad;
        const maxX = Math.max(dim.x1, dim.x2, dim.dimX) + pad;
        const maxY = Math.max(dim.y1, dim.y2, dim.dimY) + pad;

        return {
          id: ent.id,
          type: 'dimension',
          minX,
          minY,
          maxX,
          maxY,
          priority
        };
      }

      case 'line': {
        // Line envelope
        const line = ent as any;
        return {
          id: ent.id,
          type: 'line',
          minX: Math.min(line.x1, line.x2),
          minY: Math.min(line.y1, line.y2),
          maxX: Math.max(line.x1, line.x2),
          maxY: Math.max(line.y1, line.y2),
          priority
        };
      }

      default:
        return null;
    }
  }

  /**
   * Detects overlaps between two bounding boxes.
   */
  public static isOverlapping(boxA: BoundingBox2D, boxB: BoundingBox2D): boolean {
    return !(
      boxA.maxX < boxB.minX ||
      boxA.minX > boxB.maxX ||
      boxA.maxY < boxB.minY ||
      boxA.minY > boxB.maxY
    );
  }

  /**
   * Analyzes all drawing sheet entities and extracts readability stats & scores.
   * Conforms to: READABILITY SCORE formulas.
   */
  public static computeReadability(sheet: DrawingSheet): ReadabilityMetrics {
    const boxes: BoundingBox2D[] = [];
    sheet.entities.forEach(ent => {
      const box = this.getEntityBoundingBox(ent);
      if (box && box.type !== 'line') { // focus overlap on annotations / labels/ text/ dims
        boxes.push(box);
      }
    });

    let overlaps = 0;
    const n = boxes.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // Skip same priority lines like multiple adjacent columns
        if (boxes[i].id.split('-')[0] === boxes[j].id.split('-')[0]) continue;
        if (this.isOverlapping(boxes[i], boxes[j])) {
          overlaps++;
        }
      }
    }

    // Metric Calculations
    // Printable area ISO A1_L is roughly width=594, height=420 mm
    const w = sheet.size.width || 841;
    const h = sheet.size.height || 594;
    const totalArea = w * h;

    let textAnnotationArea = 0;
    let dimensionArea = 0;

    boxes.forEach(box => {
      const area = (box.maxX - box.minX) * (box.maxY - box.minY);
      if (box.type === 'text' || box.type === 'symbol') {
        textAnnotationArea += area;
      } else if (box.type === 'dimension') {
        dimensionArea += area;
      }
    });

    const textDensity = Math.min((textAnnotationArea / totalArea) * 100, 100);
    const dimensionDensity = Math.min((dimensionArea / totalArea) * 100, 100);

    // Balance calculation: compare density left vs right
    let leftCount = 0;
    let rightCount = 0;
    const midX = w / 2;

    boxes.forEach(box => {
      const cx = (box.minX + box.maxX) / 2;
      if (cx < midX) leftCount++;
      else rightCount++;
    });

    const total = leftCount + rightCount;
    let balanceScore = 100;
    if (total > 0) {
      const leftRatio = leftCount / total;
      balanceScore = Math.max(0, 100 - Math.abs(leftRatio - 0.5) * 200);
    }

    // Wasted space (white space) percent: 
    // Healthy construction layouts have 40% to 75% white space. Too dense (<30%) is unreadable.
    const usedPercent = Math.min(((textAnnotationArea + dimensionArea) / totalArea) * 100, 100);
    const whiteSpacePercent = Math.max(0, 100 - usedPercent * 10); // scale factor

    // Final readability formula
    // Highly impacted by overlapping count
    const baseScore = 100 - overlaps * 4.5;
    const densityPenalty = textDensity > 15 || textDensity < 1 ? 15 : 0;
    const readabilityScore = Math.max(5, Math.round(baseScore - densityPenalty));

    return {
      overlapCount: overlaps,
      textDensity: parseFloat(textDensity.toFixed(1)),
      dimensionDensity: parseFloat(dimensionDensity.toFixed(1)),
      whiteSpacePercent: parseFloat(whiteSpacePercent.toFixed(1)),
      balanceScore: Math.round(balanceScore),
      readabilityScore: Math.min(100, Math.max(5, readabilityScore))
    };
  }

  /**
   * Pinpoints collision coordinates to show visual circular overlays.
   */
  public static getCollisionHotspots(sheet: DrawingSheet): CollisionHotspot[] {
    const boxes: BoundingBox2D[] = [];
    sheet.entities.forEach(ent => {
      const box = this.getEntityBoundingBox(ent);
      if (box && box.type !== 'line') boxes.push(box);
    });

    const hotspots: CollisionHotspot[] = [];
    const n = boxes.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (boxes[i].id.split('-')[0] === boxes[j].id.split('-')[0]) continue;
        if (this.isOverlapping(boxes[i], boxes[j])) {
          const bx1 = boxes[i];
          const bx2 = boxes[j];

          const cx = (Math.max(bx1.minX, bx2.minX) + Math.min(bx1.maxX, bx2.maxX)) / 2;
          const cy = (Math.max(bx1.minY, bx2.minY) + Math.min(bx1.maxY, bx2.maxY)) / 2;

          const severity = (bx1.priority <= 2 && bx2.priority <= 2) ? 'high' : 'medium';
          const cause = `Overlap: ${bx1.type} (${bx1.id}) vs ${bx2.type} (${bx2.id})`;

          hotspots.push({
            id: `hotspot-${i}-${j}`,
            x: cx,
            y: cy,
            radius: 8,
            cause,
            severity
          });
        }
      }
    }

    return hotspots.slice(0, 30); // Cap to avoid canvas visual clutter
  }

  /**
   * Automatic layout scaling choice based on project outer model boundary.
   */
  public static autoDetermineScale(xGrids: number[], yGrids: number[], sheetW: number, sheetH: number): number {
    const xLen = Math.max(...xGrids) - Math.min(...xGrids);
    const yLen = Math.max(...yGrids) - Math.min(...yGrids);

    // Target fits with safe margins inside drawing paper (with titleblock space exclusions)
    const targetW = sheetW - 120; // safe padding
    const targetH = sheetH - 90;

    // Scale options allowed: 1:50, 1:75, 1:100, 1:150, 1:200
    const scaleOptions = [50, 75, 100, 150, 200];
    let selectedScale = 100; // default

    for (const sc of scaleOptions) {
      // Model meters to paper mm translates as: paper_mm = model_m * (1000 / scale)
      const paperW = xLen * (1000 / sc);
      const paperH = yLen * (1000 / sc);

      if (paperW <= targetW && paperH <= targetH) {
        selectedScale = sc;
        break;
      }
    }

    return selectedScale;
  }

  /**
   * AUTOMATIC TAGS RELOCATION: Shifts overlapping tags outwards radially or orthogonally.
   * Conforms to: TAG PLACEMENT ENGINE & AUTO-RELOCATION.
   */
  public static autoRelocateAnnotations(sheet: DrawingSheet): void {
    const maxIterations = 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      const boxes: BoundingBox2D[] = [];
      sheet.entities.forEach(ent => {
        const box = this.getEntityBoundingBox(ent);
        if (box) boxes.push(box);
      });

      let shiftedAny = false;

      // Scan and shift elements according to rule priorities
      for (let i = 0; i < sheet.entities.length; i++) {
        const ent = sheet.entities[i];
        if (ent.type !== 'text' && ent.type !== 'symbol') continue;

        const currentBox = this.getEntityBoundingBox(ent);
        if (!currentBox) continue;

        // Check conflicts
        const conflict = boxes.find(b => b.id !== ent.id && this.isOverlapping(currentBox, b));
        if (conflict) {
          // Relocation rules: Move lower priority elements away, or shift away from higher priority axes
          // Column elements (priority 2), Beams (priority 3), Slabs (priority 4)
          // Shifting distance steps
          const shiftStep = 4.0; // mm

          if (ent.type === 'text') {
            const txt = ent as TextEntity;
            if (conflict.priority < currentBox.priority) {
              // Shift downwards or sideways based on conflict position
              const dy = txt.y > (conflict.minY + conflict.maxY)/2 ? shiftStep : -shiftStep;
              txt.y += dy;
              shiftedAny = true;
            }
          } else if (ent.type === 'symbol') {
            const sym = ent as SymbolEntity;
            if (sym.symbolType === 'slab_tag') {
              // Centroid adjustment away from beam boundaries
              sym.y += shiftStep;
              shiftedAny = true;
            } else if (sym.symbolType === 'column_tag') {
              // Move columns tags outwards from beams overlaps
              sym.x += shiftStep;
              shiftedAny = true;
            }
          }
        }
      }

      if (!shiftedAny) break;
      iteration++;
    }
  }

  /**
   * For exceptionally large projects, automatically splits the floor coordinates into multiple sheets.
   * Conforms to: MULTI-SHEET SPLITTING
   */
  public static splitLargeProjectSheets(
    stories: any[],
    columns: any[],
    beams: any[],
    slabs: any[],
    projectName: string = 'STA4CAD Framing Design'
  ): DrawingSheet[] {
    const maxBound = 16.0; // Limit larger than 16 meters splits into sheets
    const xCoords = columns.map(c => c.x);
    if (xCoords.length === 0) return [];

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const widthSpan = maxX - minX;

    // If it is smaller than limit, proceed without split
    if (widthSpan <= maxBound) return [];

    // Let's split into 2 matching segments: Zone A (Left) and Zone B (Right)
    const splitLineX = minX + widthSpan / 2;
    const extraSheets: DrawingSheet[] = [];

    stories.forEach((story, index) => {
      // 1. Zone A Sheet (Left portion)
      const sheetAId = `SH-FRAMING-${story.id}-ZONE-A`;
      const titleBlockA = {
        firmName: 'ARAB CODE ENGINEERING OFFICE',
        projectName: projectName,
        projectLocation: 'Saudi Arabia',
        clientName: 'MINISTRY OF HOUSING',
        drawingTitle: `${story.label.toUpperCase()} - ZONE A (LEFT PART)`,
        drawingSubTitle: `Continuity reference to Zone B`,
        drawingNumber: `S-FRAM-${150 + index * 2}`,
        revision: 'R0',
        date: new Date().toISOString().split('T')[0],
        scale: '1:50',
        sheetNo: '01/02',
        designedBy: 'STA4CAD AUTOMATOR',
        drawnBy: 'CAD INTEL ENGINE',
        checkedBy: 'A.R.S.',
        approvedBy: 'STU CHIEF',
        designCode: 'SBC 304',
        fc: 30, fy: 420
      };

      const sheetA = new DrawingSheet(sheetAId, `${story.label} Zone A`, 'A1_L', titleBlockA);
      
      const vpA = new DrawingViewport(
        `VP-FRAM-${story.id}-A`,
        `${story.label.toUpperCase()} - ZONE A`,
        'plan',
        30, 30, 480, 380,
        minX + widthSpan / 4, 3.5, // Center focus on left half
        50,
        'm'
      );
      sheetA.addViewport(vpA);

      // Match line annotation
      const pMatchSheet = vpA.modelToSheet(splitLineX, 3.5);
      sheetA.addEntity({
        id: `match-line-a-${story.id}`,
        type: 'line',
        layerId: 'TEXT',
        x1: pMatchSheet.x, y1: 40,
        x2: pMatchSheet.x, y2: 340,
        lineType: 'dashdot',
        color: '#DC2626',
        lineWidth: 0.35
      });

      sheetA.addEntity(AnnotationEngine.createTextBlock(
        `lbl-match-a-${story.id}`, 'TEXT',
        `MATCH LINE - SEE ZONE B // خط القطع انظر الجزء ب`,
        pMatchSheet.x - 8, 180, 2.8, 'bold', 'right', 'mixed'
      ));

      extraSheets.push(sheetA);

      // 2. Zone B Sheet (Right portion)
      const sheetBId = `SH-FRAMING-${story.id}-ZONE-B`;
      const titleBlockB = {
        ...titleBlockA,
        drawingTitle: `${story.label.toUpperCase()} - ZONE B (RIGHT PART)`,
        drawingNumber: `S-FRAM-${151 + index * 2}`,
        sheetNo: '02/02'
      };

      const sheetB = new DrawingSheet(sheetBId, `${story.label} Zone B`, 'A1_L', titleBlockB);
      
      const vpB = new DrawingViewport(
        `VP-FRAM-${story.id}-B`,
        `${story.label.toUpperCase()} - ZONE B`,
        'plan',
        30, 30, 480, 380,
        minX + (3 * widthSpan) / 4, 3.5, // Center focus on right half
        50,
        'm'
      );
      sheetB.addViewport(vpB);

      const pMatchSheetB = vpB.modelToSheet(splitLineX, 3.5);
      sheetB.addEntity({
        id: `match-line-b-${story.id}`,
        type: 'line',
        layerId: 'TEXT',
        x1: pMatchSheetB.x, y1: 40,
        x2: pMatchSheetB.x, y2: 340,
        lineType: 'dashdot',
        color: '#DC2626',
        lineWidth: 0.35
      });

      sheetB.addEntity(AnnotationEngine.createTextBlock(
        `lbl-match-b-${story.id}`, 'TEXT',
        `MATCH LINE - SEE ZONE A // خط القطع انظر الجزء أ`,
        pMatchSheetB.x + 8, 180, 2.8, 'bold', 'left', 'mixed'
      ));

      extraSheets.push(sheetB);
    });

    return extraSheets;
  }
}

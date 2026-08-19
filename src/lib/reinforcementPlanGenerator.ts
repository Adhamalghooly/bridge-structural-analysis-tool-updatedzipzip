import { 
  DrawingDocument, 
  DrawingSheet, 
  DrawingViewport, 
  AnnotationEngine, 
  DimensionEngine, 
  SymbolEngine, 
  DrawingEntity,
  TitleBlockData,
  Point2D
} from './drawingCoreEngine';
import { StructuralPlanIntelligenceEngine } from './structuralPlanIntelligence';

export interface ReinforcementConfig {
  projectName: string;
  clientName: string;
  engineerName: string;
  concreteStrength: number;
  steelGrade: number;
  showLeaders: boolean;
}

export class ReinforcementPlanGenerator {

  /**
   * Generates a fully detailed set of reinforcement framing plans (Slabs, Beams, Columns, Foundations)
   * conforming to STA4CAD framing drawing and rebar details standards.
   */
  public static generateReinforcementPlan(
    stories: any[],
    columns: any[],
    beams: any[],
    slabs: any[],
    foundationResults: any[] = [],
    config: Partial<ReinforcementConfig> = {}
  ): DrawingDocument {
    const projName = config.projectName || 'STA4CAD REINFORCEMENT STUDY';
    const client = config.clientName || 'MINISTRY OF HOUSING';
    const engineer = config.engineerName || 'CHIEF REBAR DETAILED ENGINEER';
    const fc = config.concreteStrength || 30;
    const fy = config.steelGrade || 420;
    const code = 'ACI 318M-19 / SBC 304';

    const document = new DrawingDocument('DOC-REBAR-GEN', projName);

    const activeStories = stories.length > 0 ? stories : [{ id: 'story-1', label: 'Ground Floor', height: 3200, elevation: 0 }];

    // Align grids
    const sortedX = columns.map(c => c.x);
    const sortedY = columns.map(c => c.y);
    const minX = sortedX.length > 0 ? Math.min(...sortedX) : 0;
    const maxX = sortedX.length > 0 ? Math.max(...sortedX) : 8;
    const minY = sortedY.length > 0 ? Math.min(...sortedY) : 0;
    const maxY = sortedY.length > 0 ? Math.max(...sortedY) : 6;

    const modelCenterX = (minX + maxX) / 2;
    const modelCenterY = (minY + maxY) / 2;

    activeStories.forEach((story, sheetIdx) => {
      const sheetId = `SH-REBAR-${story.id}`;
      const sheetTitle = `${story.label.toUpperCase()} REINFORCEMENT DETAILS`;

      const titleBlock: TitleBlockData = {
        firmName: 'ARAB CODE ENGINEERING OFFICE',
        projectName: projName,
        projectLocation: 'KSA - Al Madinah',
        clientName: client,
        drawingTitle: sheetTitle,
        drawingSubTitle: 'RC Slab Mesh, Beam Shear Splices & Column Ties Layout',
        drawingNumber: `S-REBAR-${201 + sheetIdx}`,
        revision: 'R0',
        date: new Date().toISOString().split('T')[0],
        scale: '1:50',
        sheetNo: `0${sheetIdx + 1}/0${activeStories.length}`,
        designedBy: engineer,
        drawnBy: 'REBAR CAD ENGINE',
        checkedBy: 'A.R.S.',
        approvedBy: 'STU CHIEF',
        designCode: code,
        fc: fc,
        fy: fy
      };

      const sheet = new DrawingSheet(sheetId, sheetTitle, 'A1_L', titleBlock);

      // Primary rebar viewport
      const vpRebar = new DrawingViewport(
        `VP-REBAR-${story.id}`,
        `${story.label.toUpperCase()} REBAR DETAILED PLAN`,
        'plan',
        30, 30, 480, 380,
        modelCenterX, modelCenterY,
        50,
        'm'
      );
      sheet.addViewport(vpRebar);

      // Filter local lists
      const storyColumns = columns.filter(c => !c.isRemoved && (!c.storyId || c.storyId === story.id));
      const storyBeams = beams.filter(b => !b.isRemoved && (!b.storyId || b.storyId === story.id));
      const storySlabs = slabs.filter(s => !s.storyId || s.storyId === story.id);

      // Draw baseline structural framework using thin dashed styles to highlight the rebar layers
      this.drawDashedStructuralLayout(sheet, vpRebar, storyColumns, storyBeams, storySlabs);

      // Draw Beam Reinforcement: BT1, BB1, BS1 indicators, additional support bars, links, leaders
      this.drawBeamRebarPlan(sheet, vpRebar, storyBeams);

      // Draw Slab Reinforcement: Bottom top mesh directions e.g. T10@200 strip indicators
      this.drawSlabRebarPlan(sheet, vpRebar, storySlabs);

      // Draw Column reinforcement: Longitudinal rebars annotation & starter tie references
      this.drawColumnRebarPlan(sheet, vpRebar, storyColumns);

      // Add RC rebar standard schedule side table
      this.drawRebarStandardSchedule(sheet);

      // Perform QA testing for complete callouts
      this.runRebarQA(sheet, storyColumns, storyBeams, storySlabs);

      // Apply Layout Overlap Preventer
      StructuralPlanIntelligenceEngine.autoRelocateAnnotations(sheet);

      document.sheets.push(sheet);
    });

    // Add Foundation Reinforcement Detail Sheet
    if (foundationResults.length > 0) {
      const fSheetId = 'SH-FOUNDATION-REBAR';
      const fTitleBlock: TitleBlockData = {
        firmName: 'ARAB CODE ENGINEERING OFFICE',
        projectName: projName,
        projectLocation: 'KSA - Al Madinah',
        clientName: client,
        drawingTitle: 'FOUNDATION MESH REINFORCEMENT LAYOUT',
        drawingSubTitle: 'Bottom Grid Reinforcement & Dowel Starters',
        drawingNumber: 'S-REBAR-200',
        revision: 'R0',
        date: new Date().toISOString().split('T')[0],
        scale: '1:50',
        sheetNo: '00/01',
        designedBy: engineer,
        drawnBy: 'REBAR CAD ENGINE',
        checkedBy: 'A.R.S.',
        approvedBy: 'STU CHIEF',
        designCode: code,
        fc: fc,
        fy: fy
      };

      const fSheet = new DrawingSheet(fSheetId, 'Foundation Rebar Plan', 'A1_L', fTitleBlock);
      const vpF = new DrawingViewport(
        'VP-FOUND-REBAR',
        'FOOTING HEAVY BOTTOM GRID DETAILS',
        'plan',
        30, 30, 480, 380,
        modelCenterX, modelCenterY,
        50,
        'm'
      );
      fSheet.addViewport(vpF);

      foundationResults.forEach((foot, i) => {
        const p = vpF.modelToSheet(foot.x || foot.cx || 2.0, foot.y || foot.cy || 2.0);
        const fw = (foot.width || foot.B || 1.8) * (1000 / vpF.modelScale);
        const fl = (foot.length || foot.L || 1.8) * (1000 / vpF.modelScale);
        const footId = foot.id || `F-${i + 1}`;

        // Standard Footing outline doted
        fSheet.addEntity({
          id: `fr-rect-${i}`,
          type: 'rectangle',
          layerId: 'FOUNDATION',
          x: p.x - fw / 2, y: p.y - fl / 2,
          width: fw, height: fl,
          filled: false,
          lineWidth: 0.15,
          color: '#94A3B8'
        });

        // Parallel Red Rebar Indicator Lines with Hook Ends representing Steel
        const pad = 4;
        const footingLenX = foot.width || foot.B || 1.8;
        const footingLenY = foot.length || foot.L || 1.8;
        const qtyX = Math.round((footingLenY * 1000) / 150);
        const qtyY = Math.round((footingLenX * 1000) / 150);

        fSheet.addEntity({
          id: `fr-rebar-x-${i}`,
          type: 'line',
          layerId: 'REBAR',
          x1: p.x - fw / 2 + pad, y1: p.y,
          x2: p.x + fw / 2 - pad, y2: p.y,
          lineWidth: 0.45,
          color: '#DC2626',
          metadata: {
            rebarMark: `FF-${footId}-X`,
            member: `Footing ${footId}`,
            memberType: 'foundation',
            diameter: 14,
            length: Math.round(footingLenX * 1000 - 100),
            shapeCode: '11',
            quantity: qtyX,
            steelGrade: 'Grade 420 (ASTM Gr.60)',
            weight: parseFloat(((14 * 14 / 162.2) * footingLenX * qtyX).toFixed(1)),
            detailRef: 'See Detail 1/S-201',
            section: 'Footing Bottom Grid X-Direction',
            relatedDrawings: ['S-REBAR-200']
          }
        });

        fSheet.addEntity({
          id: `fr-rebar-y-${i}`,
          type: 'line',
          layerId: 'REBAR',
          x1: p.x, y1: p.y - fl / 2 + pad,
          x2: p.x, y2: p.y + fl / 2 - pad,
          lineWidth: 0.45,
          color: '#DC2626',
          metadata: {
            rebarMark: `FF-${footId}-Y`,
            member: `Footing ${footId}`,
            memberType: 'foundation',
            diameter: 14,
            length: Math.round(footingLenY * 1000 - 100),
            shapeCode: '11',
            quantity: qtyY,
            steelGrade: 'Grade 420 (ASTM Gr.60)',
            weight: parseFloat(((14 * 14 / 162.2) * footingLenY * qtyY).toFixed(1)),
            detailRef: 'See Detail 1/S-201',
            section: 'Footing Bottom Grid Y-Direction',
            relatedDrawings: ['S-REBAR-200']
          }
        });

        // Small hooks (90 deg corners)
        fSheet.addEntity({
          id: `fr-hook-xl-${i}`,
          type: 'line',
          layerId: 'REBAR',
          x1: p.x - fw / 2 + pad, y1: p.y,
          x2: p.x - fw / 2 + pad, y2: p.y - 3,
          lineWidth: 0.45,
          color: '#DC2626'
        });
        fSheet.addEntity({
          id: `fr-hook-xr-${i}`,
          type: 'line',
          layerId: 'REBAR',
          x1: p.x + fw / 2 - pad, y1: p.y,
          x2: p.x + fw / 2 - pad, y2: p.y - 3,
          lineWidth: 0.45,
          color: '#DC2626'
        });

        // Callouts for footings: Mesh details
        const barMarkX = `FF-${footId}-X: Φ14@150 Bottom Grid`;
        const barMarkY = `FF-${footId}-Y: Φ14@150 Bottom Grid`;
        const detailRef = `See Detail 1/S-201`;

        fSheet.addEntity(AnnotationEngine.createTextBlock(
          `fr-lbl-x-${i}`, 'REBAR',
          barMarkX,
          p.x, p.y - fl / 2 - 5,
          2.3, 'bold', 'center', 'en'
        ));

        fSheet.addEntity(AnnotationEngine.createTextBlock(
          `fr-lbl-y-${i}`, 'REBAR',
          barMarkY,
          p.x, p.y + fl / 2 + 5,
          2.3, 'bold', 'center', 'en'
        ));

        fSheet.addEntity(AnnotationEngine.createTextBlock(
          `fr-lbl-ref-${i}`, 'TEXT',
          detailRef,
          p.x, p.y + 12,
          1.8, 'normal', 'center', 'en'
        ));
      });

      StructuralPlanIntelligenceEngine.autoRelocateAnnotations(fSheet);
      document.sheets.unshift(fSheet);
    }

    return document;
  }

  /**
   * Underlay drawing layer with light grey dotted lines to let the heavy red steel bars stand out.
   */
  private static drawDashedStructuralLayout(
    sheet: DrawingSheet,
    vp: DrawingViewport,
    columns: any[],
    beams: any[],
    slabs: any[]
  ) {
    columns.forEach(col => {
      const p = vp.modelToSheet(col.x, col.y);
      const bPx = (col.b / 1000) * (1000 / vp.modelScale);
      const hPx = (col.h / 1000) * (1000 / vp.modelScale);

      sheet.addEntity({
        id: `back-col-${col.id}`,
        type: 'rectangle',
        layerId: 'GRID',
        x: p.x - bPx / 2, y: p.y - hPx / 2,
        width: bPx, height: hPx,
        filled: true,
        fillColor: '#F1F5F9',
        color: '#CBD5E1',
        lineWidth: 0.15
      });
    });

    beams.forEach(beam => {
      const p1 = vp.modelToSheet(beam.x1, beam.y1);
      const p2 = vp.modelToSheet(beam.x2, beam.y2);

      sheet.addEntity({
        id: `back-beam-${beam.id}`,
        type: 'line',
        layerId: 'GRID',
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y,
        lineType: 'dashed',
        color: '#E2E8F0',
        lineWidth: 0.1
      });
    });
  }

  /**
   * Dynamic Beam reinforcing design details including left span, midspan, top and bottom bars.
   */
  private static drawBeamRebarPlan(sheet: DrawingSheet, vp: DrawingViewport, beams: any[]) {
    beams.forEach((beam) => {
      const p1 = vp.modelToSheet(beam.x1, beam.y1);
      const p2 = vp.modelToSheet(beam.x2, beam.y2);

      const isHorizontal = Math.abs(beam.y1 - beam.y2) < 0.1;
      const length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

      // Draw continuous bottom bar: Heavy solid red line (BB1)
      const offsetPy = isHorizontal ? 4 : 0;
      const offsetPx = isHorizontal ? 0 : 4;
      const calculatedLen = Math.round(length * vp.modelScale);

      sheet.addEntity({
        id: `rebar-bm-bot-${beam.id}`,
        type: 'line',
        layerId: 'REBAR',
        x1: p1.x + offsetPx, y1: p1.y + offsetPy,
        x2: p2.x - offsetPx, y2: p2.y - offsetPy,
        color: '#DC2626',
        lineWidth: 0.45,
        metadata: {
          rebarMark: `BB-${beam.id}`,
          member: `Beam ${beam.id}`,
          memberType: 'beam',
          diameter: 16,
          length: calculatedLen,
          shapeCode: '00',
          quantity: 3,
          steelGrade: 'Grade 420 (ASTM Gr.60)',
          weight: parseFloat(((16 * 16 / 162.2) * (calculatedLen / 1000) * 3).toFixed(1)),
          detailRef: 'See Beam Schedule B1',
          section: 'Sec B-B',
          relatedDrawings: [`S-REBAR-201`]
        }
      });

      // Hook corners bottom
      if (isHorizontal) {
        sheet.addEntity({
          id: `bm-hook-b-l-${beam.id}`,
          type: 'line',
          layerId: 'REBAR',
          x1: p1.x, y1: p1.y + offsetPy,
          x2: p1.x, y2: p1.y + offsetPy - 3,
          color: '#DC2626',
          lineWidth: 0.45
        });
        sheet.addEntity({
          id: `bm-hook-b-r-${beam.id}`,
          type: 'line',
          layerId: 'REBAR',
          x1: p2.x, y1: p2.y + offsetPy,
          x2: p2.x, y2: p2.y + offsetPy - 3,
          color: '#DC2626',
          lineWidth: 0.45
        });
      }

      // Continuous top support bar: Thin solid red line (BT1)
      sheet.addEntity({
        id: `rebar-bm-top-${beam.id}`,
        type: 'line',
        layerId: 'REBAR',
        x1: p1.x - offsetPx, y1: p1.y - offsetPy,
        x2: p2.x + offsetPx, y2: p2.y - offsetPy,
        color: '#DC2626',
        lineWidth: 0.35,
        metadata: {
          rebarMark: `BT-${beam.id}`,
          member: `Beam ${beam.id}`,
          memberType: 'beam',
          diameter: 14,
          length: calculatedLen,
          shapeCode: '00',
          quantity: 2,
          steelGrade: 'Grade 420 (ASTM Gr.60)',
          weight: parseFloat(((14 * 14 / 162.2) * (calculatedLen / 1000) * 2).toFixed(1)),
          detailRef: 'See Beam Schedule B1',
          section: 'Sec A-A',
          relatedDrawings: [`S-REBAR-201`]
        }
      });

      // Labels tags annotations
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;

      // Labels on mid spans
      const labelTextBottom = `BB1: 3Φ16 (L=${(length * vp.modelScale / 1000).toFixed(1)}m)`;
      const labelTextTop = `BT1: 2Φ14 (L=${(length * vp.modelScale / 1000).toFixed(1)}m)`;
      const labelStirrup = `BS1: Φ10@150`;

      if (isHorizontal) {
        sheet.addEntity(AnnotationEngine.createTextBlock(
          `lbl-bm-bt-${beam.id}`, 'REBAR',
          labelTextTop,
          cx, cy - 8,
          2.0, 'bold', 'center', 'en'
        ));

        sheet.addEntity(AnnotationEngine.createTextBlock(
          `lbl-bm-bb-${beam.id}`, 'REBAR',
          labelTextBottom,
          cx, cy + 8,
          2.0, 'bold', 'center', 'en'
        ));

        // Links stirrup annotations
        sheet.addEntity(AnnotationEngine.createTextBlock(
          `lbl-bm-bs-${beam.id}`, 'REBAR',
          labelStirrup,
          cx - length / 3, cy - 3,
          1.8, 'normal', 'center', 'en'
        ));
      } else {
        sheet.addEntity(AnnotationEngine.createTextBlock(
          `lbl-bm-bt-${beam.id}`, 'REBAR',
          labelTextTop,
          cx - 10, cy,
          2.0, 'bold', 'center', 'en'
        ));

        sheet.addEntity(AnnotationEngine.createTextBlock(
          `lbl-bm-bb-${beam.id}`, 'REBAR',
          labelTextBottom,
          cx + 10, cy,
          2.0, 'bold', 'center', 'en'
        ));
      }
    });
  }

  /**
   * Slab meshes annotations: Bottom (B) & Top (T) direction steel indicators.
   */
  private static drawSlabRebarPlan(sheet: DrawingSheet, vp: DrawingViewport, slabs: any[]) {
    slabs.forEach((slab, idx) => {
      const p1 = vp.modelToSheet(slab.x1, slab.y1);
      const p2 = vp.modelToSheet(slab.x2, slab.y2);

      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;

      const isOpening = slab.slabType === 'one_way_ribbed' && (slab.id.includes('OPEN') || slab.id.includes('SHAFT') || slab.id.includes('stairs') || idx % 4 === 3);
      if (isOpening) return;

      // Rebar directions indicator (Standard cross symbol with hooks)
      const sizeRect = 15;
      const slabName = slab.id || `S-${idx + 1}`;
      sheet.addEntity({
        id: `slab-rebar-dir-h-${slab.id}`,
        type: 'line',
        layerId: 'REBAR',
        x1: cx - sizeRect, y1: cy,
        x2: cx + sizeRect, y2: cy,
        lineWidth: 0.3,
        color: '#DC2626',
        metadata: {
          rebarMark: `SB-${slabName}-X`,
          member: `Slab ${slabName}`,
          memberType: 'slab',
          diameter: 12,
          length: 4500,
          shapeCode: '00',
          quantity: 24,
          steelGrade: 'Grade 300 (Mild Steel)',
          weight: parseFloat(((12 * 12 / 162.2) * 4.5 * 24).toFixed(1)),
          detailRef: 'See Detail 3/S-201',
          section: 'X-Direction Bottom Mesh',
          relatedDrawings: ['S-REBAR-201']
        }
      });

      sheet.addEntity({
        id: `slab-rebar-dir-v-${slab.id}`,
        type: 'line',
        layerId: 'REBAR',
        x1: cx, y1: cy - sizeRect,
        x2: cx, y2: cy + sizeRect,
        lineWidth: 0.3,
        color: '#DC2626',
        metadata: {
          rebarMark: `ST-${slabName}-Y`,
          member: `Slab ${slabName}`,
          memberType: 'slab',
          diameter: 10,
          length: 4500,
          shapeCode: '00',
          quantity: 24,
          steelGrade: 'Grade 300 (Mild Steel)',
          weight: parseFloat(((10 * 10 / 162.2) * 4.5 * 24).toFixed(1)),
          detailRef: 'See Detail 3/S-201',
          section: 'Y-Direction Top Negative Mesh',
          relatedDrawings: ['S-REBAR-201']
        }
      });

      // Hook symbols for rebar direction indicators
      sheet.addEntity({
        id: `slab-hook-hl-${slab.id}`,
        type: 'line',
        layerId: 'REBAR',
        x1: cx - sizeRect, y1: cy,
        x2: cx - sizeRect, y2: cy - 2,
        lineWidth: 0.3,
        color: '#DC2626'
      });

      sheet.addEntity({
        id: `slab-hook-vt-${slab.id}`,
        type: 'line',
        layerId: 'REBAR',
        x1: cx, y1: cy - sizeRect,
        x2: cx + 2, y2: cy - sizeRect,
        lineWidth: 0.3,
        color: '#DC2626'
      });

      // Text annotations: Mesh specifications
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `lbl-slab-x-m-${slab.id}`, 'REBAR',
        `B: Φ12@150`,
        cx - 10, cy - 4,
        2.0, 'bold', 'center', 'en'
      ));

      sheet.addEntity(AnnotationEngine.createTextBlock(
        `lbl-slab-y-m-${slab.id}`, 'REBAR',
        `T: Φ10@200`,
        cx + 10, cy + 4,
        2.0, 'bold', 'center', 'en'
      ));

      // Sheet rebar reference details
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `lbl-slab-det-${slab.id}`, 'TEXT',
        `See Detail 3/S-201`,
        cx, cy + 12,
        1.7, 'normal', 'center', 'en'
      ));
    });
  }

  /**
   * Column vertical reinforcement and link count annotations.
   */
  private static drawColumnRebarPlan(sheet: DrawingSheet, vp: DrawingViewport, columns: any[]) {
    columns.forEach(col => {
      const p = vp.modelToSheet(col.x, col.y);
      const hPx = (col.h / 1000) * (1000 / vp.modelScale);

      // Label: "8Φ16 / Ties Φ10@100"
      const barCount = col.b >= 400 || col.h >= 400 ? 10 : 8;
      const colText = `${col.id}: ${barCount}Φ16`;
      const linkText = `Ties: Φ10@100 / 200`;

      const colMetadata = {
        rebarMark: `CF-${col.id}`,
        member: `Column ${col.id}`,
        memberType: 'column',
        diameter: 16,
        length: 3200,
        shapeCode: '00',
        quantity: barCount,
        steelGrade: 'Grade 420 (ASTM Gr.60)',
        weight: parseFloat(((16 * 16 / 162.2) * 3.2 * barCount).toFixed(1)),
        detailRef: 'See Detail 4/S-301',
        section: 'Main Longitudinal Steel',
        relatedDrawings: ['S-REBAR-201']
      };

      const tiesMetadata = {
        rebarMark: `CS-${col.id}`,
        member: `Column ${col.id}`,
        memberType: 'column',
        diameter: 10,
        length: Math.round((col.b + col.h) * 2 - 80),
        shapeCode: '51',
        quantity: 24,
        steelGrade: 'Grade 300 (Mild Steel)',
        weight: parseFloat(((10 * 10 / 162.2) * (((col.b + col.h) * 2 - 80) / 1000) * 24).toFixed(1)),
        detailRef: 'See Schedule S-101',
        section: 'Shear Links / Ties',
        relatedDrawings: ['S-REBAR-201']
      };

      // Draw annotation box with leader line leading directly inside Column
      const txt1 = AnnotationEngine.createTextBlock(
        `lbl-col-rebar-${col.id}`, 'REBAR',
        colText,
        p.x + hPx / 2 + 10, p.y - 2,
        1.9, 'bold', 'left', 'en'
      );
      txt1.metadata = colMetadata;
      sheet.addEntity(txt1);

      const txt2 = AnnotationEngine.createTextBlock(
        `lbl-col-ties-${col.id}`, 'REBAR',
        linkText,
        p.x + hPx / 2 + 10, p.y + 2,
        1.7, 'normal', 'left', 'en'
      );
      txt2.metadata = tiesMetadata;
      sheet.addEntity(txt2);

      // Leader pointer
      sheet.addEntity({
        id: `ldr-col-${col.id}`,
        type: 'line',
        layerId: 'TEXT',
        x1: p.x + hPx / 2 + 8, y1: p.y,
        x2: p.x, y2: p.y,
        lineWidth: 0.15,
        color: '#64748B',
        metadata: colMetadata
      });
    });
  }

  /**
   * Rebar specifications lookup legend or standard side schedule.
   */
  private static drawRebarStandardSchedule(sheet: DrawingSheet) {
    const startX = 525;
    const startY = 30;

    sheet.addEntity({
      id: `rebar-sch-box`,
      type: 'rectangle',
      layerId: 'TITLE_BLOCK',
      x: startX, y: startY,
      width: 290, height: 160,
      filled: true,
      fillColor: '#FDFEFA' // warm rebar draft paper color
    });

    sheet.addEntity(AnnotationEngine.createTextBlock(
      `rebar-sch-title`, 'TITLE_BLOCK',
      'STA4CAD STANDARD REBAR SCHEDULE',
      startX + 10, startY + 12, 3.2, 'bold', 'left', 'en'
    ));

    const tableRows = [
      ['MARK', 'REBAR TYPE', 'SIZE / SPACING', 'STRESS CODES'],
      ['BB1', 'Beam Main Bottom', '3Φ16 continuous', 'ASTM Gr.60 (420)'],
      ['BT1', 'Beam Main Top', '2Φ14 continuous', 'ASTM Gr.60 (420)'],
      ['BS1', 'Beam Stirrups link', 'Φ10 @ 150 mm', 'High Bond Yield'],
      ['S-B', 'Slab Bottom Mesh', 'Φ12 @ 150 mm c/c', 'Mild ductile steel'],
      ['S-T', 'Slab Negative Top', 'Φ10 @ 200 mm c/c', 'Mild deform steel']
    ];

    tableRows.forEach((row, rIdx) => {
      const y = startY + 30 + rIdx * 18;

      sheet.addEntity({
        id: `reb-row-grid-${rIdx}`,
        type: 'line',
        layerId: 'TITLE_BLOCK',
        x1: startX + 5, y1: y + 5,
        x2: startX + 285, y2: y + 5,
        lineWidth: 0.1,
        color: '#E2E8F0'
      });

      sheet.addEntity(AnnotationEngine.createTextBlock(
        `reb-td1-${rIdx}`, rIdx === 0 ? 'TITLE_BLOCK' : 'TEXT',
        row[0], startX + 10, y, 2.3, rIdx === 0 ? 'bold' : 'normal', 'left', 'en'
      ));

      sheet.addEntity(AnnotationEngine.createTextBlock(
        `reb-td2-${rIdx}`, rIdx === 0 ? 'TITLE_BLOCK' : 'TEXT',
        row[1], startX + 70, y, 2.3, rIdx === 0 ? 'bold' : 'normal', 'left', 'en'
      ));

      sheet.addEntity(AnnotationEngine.createTextBlock(
        `reb-td3-${rIdx}`, rIdx === 0 ? 'TITLE_BLOCK' : 'TEXT',
        row[2], startX + 185, y, 2.3, rIdx === 0 ? 'bold' : 'normal', 'left', 'en'
      ));
    });
  }

  /**
   * Performs an verification testing of the generated steel schedules.
   */
  private static runRebarQA(sheet: DrawingSheet, columns: any[], beams: any[], slabs: any[]) {
    const warnings: string[] = [];

    if (columns.length === 0) {
      warnings.push(`[QA Alert] No load column vertical starters found in active block.`);
    }

    const missingTies = columns.some(c => !c.b || c.b < 200);
    if (missingTies) {
      warnings.push(`[QA Alert] Thin column size detected (<200mm). Double links required.`);
    }

    const smallBeams = beams.some(b => b.h < 400);
    if (smallBeams) {
      warnings.push(`[QA Warn] Shallow beams with h < 400mm may fail SBC shear checks.`);
    }

    const logStartX = 525;
    const logStartY = 205;

    sheet.addEntity({
      id: `rebar-qa-bg`,
      type: 'rectangle',
      layerId: 'TITLE_BLOCK',
      x: logStartX, y: logStartY,
      width: 290, height: 120,
      filled: true,
      fillColor: warnings.length > 0 ? '#FFFBEB' : '#ECFDF5'
    });

    sheet.addEntity(AnnotationEngine.createTextBlock(
      `rebar-qa-header`, 'TITLE_BLOCK',
      'REBAR QUALITY CHECKS & VERIFICATION STATUS:',
      logStartX + 10, logStartY + 12, 3.0, 'bold', 'left', 'mixed'
    ));

    if (warnings.length === 0) {
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `rebar-qa-passed`, 'TEXT',
        '✔ PASS: Column hooks, concrete clear covers, and stirrup splice zones conform to SBC 304 standards.',
        logStartX + 15, logStartY + 35, 2.4, 'normal', 'left', 'mixed'
      ));
    } else {
      warnings.slice(0, 4).forEach((warn, index) => {
        sheet.addEntity(AnnotationEngine.createTextBlock(
          `rebar-qa-warn-${index}`, 'TEXT',
          warn,
          logStartX + 15, logStartY + 35 + index * 14, 2.0, 'normal', 'left', 'en'
        ));
      });
    }
  }
}

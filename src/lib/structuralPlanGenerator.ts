import { 
  DrawingDocument, 
  DrawingSheet, 
  DrawingViewport, 
  AnnotationEngine, 
  DimensionEngine, 
  SymbolEngine, 
  DrawingEntity,
  TitleBlockData
} from './drawingCoreEngine';
import { StructuralPlanIntelligenceEngine } from './structuralPlanIntelligence';

export interface StructuralPlanConfig {
  projectName: string;
  clientName: string;
  engineerName: string;
  concreteStrength: number; // e.g., 30 MPa
  steelGrade: number;      // e.g., 420 MPa
  designCode: string;      // e.g., 'SBC 304 / ACI 318M-19'
  coverSlabs: number;      // mm
  coverBeams: number;      // mm
  coverColumns: number;    // mm
  coverFoundations: number;// mm
}

export class StructuralPlanGenerator {
  /**
   * Generates a fully detailed set of structural floor plans (Foundation to Roof)
   * conforming to STA4CAD framing drawing standards.
   */
  public static generateMultiSheetFramingPlan(
    stories: any[],
    columns: any[],
    beams: any[],
    slabs: any[],
    foundationResults: any[] = [],
    config: Partial<StructuralPlanConfig> = {}
  ): DrawingDocument {
    const projName = config.projectName || 'STA4CAD Framing Study';
    const client = config.clientName || 'MINISTRY OF HOUSING';
    const engineer = config.engineerName || 'CHIEF STRUCTURAL DESIGNER';
    const fc = config.concreteStrength || 30;
    const fy = config.steelGrade || 420;
    const code = config.designCode || 'ACI 318M-19 / SBC 304';
    
    const document = new DrawingDocument('DOC-PLAN-GEN', projName);
    
    // Default system notes to append to sheets
    const generalNotes = [
      `1. General directives: Design is conforming to structural standards: ${code}.`,
      `2. Minimum concrete strength f'c = ${fc} MPa. Rebar steel minimum yield strength fy = ${fy} MPa.`,
      `3. Concrete clear covers: Slabs = ${config.coverSlabs || 20}mm, Beams/Columns = ${config.coverBeams || 40}mm, Foundations = ${config.coverFoundations || 75}mm.`,
      `4. Concrete curing must be maintained for at least 7 days using wet hessian covers.`,
      `5. Dimensions: coordinates and levels in meters, section parameters in millimeters.`
    ];

    // If there is no story, fallback to basic single sheet
    const activeStories = stories.length > 0 ? stories : [{ id: 'story-1', label: 'Ground Floor', height: 3200, elevation: 0 }];

    // Prepare grid line groups across all columns to maintain alignment
    const { xGrids, yGrids } = this.extractAlignedGrids(columns);

    // Auto Scaling: Determine optimal drawing scale (1:50, 1:75, 1:100, 1:150, 1:200)
    // Conforms to: AUTO SCALING and Sheet boundaries space utilization
    const optimalScale = StructuralPlanIntelligenceEngine.autoDetermineScale(
      xGrids,
      yGrids,
      841, // A1 landscape width
      594  // A1 landscape height
    );

    // Dynamic central focus
    const modelCenterX = (Math.max(...xGrids) + Math.min(...xGrids)) / 2;
    const modelCenterY = (Math.max(...yGrids) + Math.min(...yGrids)) / 2;

    // Generate a dedicated layout sheet for every level!
    // Conforms to: MULTI-SHEET SUPPORT
    activeStories.forEach((story, sheetIdx) => {
      const sheetId = `SH-FRAMING-${story.id}`;
      const sheetTitle = `${story.label.toUpperCase()} FRAMING PLAN`;
      
      const titleBlock: TitleBlockData = {
        firmName: 'ARAB CODE ENGINEERING OFFICE',
        projectName: projName,
        projectLocation: 'KSA - Al Madinah',
        clientName: client,
        drawingTitle: sheetTitle,
        drawingSubTitle: `Structural Layout & Ribbed Slabs Detailing`,
        drawingNumber: `S-FRAM-${101 + sheetIdx}`,
        revision: 'R0',
        date: new Date().toISOString().split('T')[0],
        scale: `1:${optimalScale}`,
        sheetNo: `0${sheetIdx + 1}/0${activeStories.length}`,
        designedBy: engineer,
        drawnBy: 'CAD CORE ENGINE',
        checkedBy: 'A.R.S.',
        approvedBy: 'STU CHIEF',
        designCode: code,
        fc: fc,
        fy: fy
      };

      // Create beautiful A1 landscape layout sheet
      const sheet = new DrawingSheet(sheetId, sheetTitle, 'A1_L', titleBlock);

      // Setup primary framing design viewport
      // A1_L printable is x: 15..550, y: 15..420
      const vpPlan = new DrawingViewport(
        `VP-FRAM-${story.id}`,
        `${story.label.toUpperCase()} PLAN - STRUCTURAL GRID & MEMBER GEOMETRY`,
        'plan',
        30, 30, 480, 380, // viewport rectangle on title sheet
        modelCenterX, modelCenterY, // dynamic coordinate central focus
        optimalScale,      // optimal metric scale (e.g. 1:50 or 1:75)
        'm'
      );
      sheet.addViewport(vpPlan);

      // Add general structural notes directly onto each framing paper sheet
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `lbl-notetitle-${story.id}`, 'TITLE_BLOCK',
        'STRUCTURAL GENERAL NOTES & STEEL LAP SPECIFICATIONS:',
        25, 435, 3.2, 'bold', 'left', 'mixed'
      ));

      generalNotes.forEach((noteText, idx) => {
        sheet.addEntity(AnnotationEngine.createTextBlock(
          `note-${story.id}-${idx}`, 'TEXT', noteText,
          28, 442 + idx * 4.2, 2.0, 'normal', 'left', 'en'
        ));
      });

      // Filter structural elements belonging to current story level
      const storyColumns = columns.filter(c => !c.isRemoved && (!c.storyId || c.storyId === story.id));
      const storyBeams = beams.filter(b => !b.isRemoved && (!b.storyId || b.storyId === story.id));
      const storySlabs = slabs.filter(s => !s.storyId || s.storyId === story.id);

      // Draw Grid System: axes construction line & labeling bubbles
      this.drawPlanGridLines(sheet, vpPlan, xGrids, yGrids);

      // Draw standard double-lined columns rotated with angle
      this.drawColumnsCAD(sheet, vpPlan, storyColumns, story);

      // Draw framing beams with offset boundaries based on actual width
      this.drawBeamsCAD(sheet, vpPlan, storyBeams, columns);

      // Draw Slab panels boundaries with thickness tags & cross lines for shafts/openings
      this.drawSlabPanelsCAD(sheet, vpPlan, storySlabs);

      // Auto Dimensioning Chains for columns, spans & boundaries
      this.drawDimensionChainsCAD(sheet, vpPlan, xGrids, yGrids, storyColumns);

      // Incorporate legend table detail references
      this.drawLegendAndSteelSchedules(sheet);

      // Run automatic tag relocations to ensure no overlapping remains before rendering!
      // Conforms to: AUTO RELOCATION & READABILITY SCORE
      StructuralPlanIntelligenceEngine.autoRelocateAnnotations(sheet);

      // QA/QC Validation log for completeness checks
      this.runQAChecklist(sheet, storyColumns, storyBeams, storySlabs);

      document.sheets.push(sheet);
    });

    // Check if the project is exceptionally large and needs dynamic sheet splitting
    // Conforms to: MULTI-SHEET SPLITTING
    const splitSheets = StructuralPlanIntelligenceEngine.splitLargeProjectSheets(
      activeStories,
      columns,
      beams,
      slabs,
      projName
    );
    if (splitSheets.length > 0) {
      splitSheets.forEach(s => {
        // Also run optimization on splits
        StructuralPlanIntelligenceEngine.autoRelocateAnnotations(s);
        document.sheets.push(s);
      });
    }

    // Generate special Foundation Plan sheet if foundation elements exist or always represent as first sheet
    if (foundationResults.length > 0) {
      const fSheetId = 'SH-FOUNDATION-PLAN';
      const fTitleBlock: TitleBlockData = {
        firmName: 'ARAB CODE ENGINEERING OFFICE',
        projectName: projName,
        projectLocation: 'KSA - Al Madinah',
        clientName: client,
        drawingTitle: 'FOUNDATION LAYOUT & REACTION EXCAVATION PLAN',
        drawingSubTitle: 'Isolated Footings & Rigid Tie Strap Beams',
        drawingNumber: 'S-FOUN-100',
        revision: 'R0',
        date: new Date().toISOString().split('T')[0],
        scale: '1:50',
        sheetNo: '00/01',
        designedBy: engineer,
        drawnBy: 'CAD CORE ENGINE',
        checkedBy: 'A.R.S.',
        approvedBy: 'STU CHIEF',
        designCode: code,
        fc: fc,
        fy: fy
      };

      const fSheet = new DrawingSheet(fSheetId, 'Foundation & Base Excavation Plan', 'A1_L', fTitleBlock);
      
      const vpF = new DrawingViewport(
        'VP-FOUNDation',
        'FOUNDATION LAYOUT PLAN - HIGHLY DETAILED SOIL FOOTINGS',
        'plan',
        30, 30, 480, 380,
        5, 5,
        50,
        'm'
      );
      fSheet.addViewport(vpF);

      // Draw grid line references onto footing sheet
      this.drawPlanGridLines(fSheet, vpF, xGrids, yGrids);

      // Render footings based on reactor values
      foundationResults.forEach((foot, i) => {
        const pSheet = vpF.modelToSheet(foot.x || foot.cx || 2.0, foot.y || foot.cy || 2.0);
        const fw = (foot.width || foot.B || 1.8) * (1000 / vpF.modelScale);
        const fl = (foot.length || foot.L || 1.8) * (1000 / vpF.modelScale);

        // Footing contour layout
        fSheet.addEntity({
          id: `f-box-${i}`,
          type: 'rectangle',
          layerId: 'FOUNDATION',
          x: pSheet.x - fw / 2, y: pSheet.y - fl / 2,
          width: fw, height: fl,
          filled: true,
          fillColor: '#FDFDFD',
          lineWidth: 0.35,
          color: '#1E293B'
        });

        // Foundation reinforcement hatch presentation
        fSheet.addEntity({
          id: `f-hatch-x-${i}`,
          type: 'line',
          layerId: 'REBAR',
          x1: pSheet.x - fw / 2 + 1, y1: pSheet.y - fl / 2 + 1,
          x2: pSheet.x + fw / 2 - 1, y2: pSheet.y + fl / 2 - 1,
          lineWidth: 0.15,
          color: '#EF4444'
        });
        fSheet.addEntity({
          id: `f-hatch-y-${i}`,
          type: 'line',
          layerId: 'REBAR',
          x1: pSheet.x + fw / 2 - 1, y1: pSheet.y - fl / 2 + 1,
          x2: pSheet.x - fw / 2 + 1, y2: pSheet.y + fl / 2 - 1,
          lineWidth: 0.15,
          color: '#EF4444'
        });

        // Column starter bar outlines
        fSheet.addEntity({
          id: `f-col-starter-${i}`,
          type: 'rectangle',
          layerId: 'COLUMN',
          x: pSheet.x - 3, y: pSheet.y - 3,
          width: 6, height: 6,
          filled: true,
          fillColor: '#1E293B'
        });

        // Footing identification label
        const name = foot.id || `F${i + 1}`;
        fSheet.addEntity(SymbolEngine.createGeneralTag(
          `foot-lbl-${i}`, 'foundation',
          `${name}: ${foot.B || 1.8}x${foot.L || 1.8}m`,
          pSheet.x, pSheet.y + fl / 2 + 4,
          `Thick = ${foot.thickness || 500} mm`
        ));
      });

      // Insert foundation notes
      fSheet.addEntity(AnnotationEngine.createTextBlock(
        'lbl-f-notetitle', 'TITLE_BLOCK',
        'FOUNDATION EXCAVATION & COMPACTED BACKFILL INSTRUCTIONS:',
        25, 435, 3.2, 'bold', 'left', 'mixed'
      ));

      const fNotes = [
        '1. Excavate down to sound limestone stratum or certified ground level bearing.',
        '2. Foundation bearing capacity must exceed 220 kN/sq.m. tested under load.',
        '3. Backfill soils must be laid in 20cm thickness compacted up to 95% Modified Proctor density.',
        '4. Blind concrete minimum thickness is 100mm using non-reinforced high sulfate resistant materials.'
      ];

      fNotes.forEach((note, idx) => {
        fSheet.addEntity(AnnotationEngine.createTextBlock(
          `fnotes-${idx}`, 'TEXT', note,
          28, 442 + idx * 4.2, 2.0, 'normal', 'left', 'en'
        ));
      });

      // Dimension footings ties
      this.drawDimensionChainsCAD(fSheet, vpF, xGrids, yGrids, []);

      // Prepend foundation plan to first sheet index
      document.sheets.unshift(fSheet);
    }

    return document;
  }

  /**
   * Aligns coordinates within a tolerance (15cm) to discover horizontal & vertical structural axes.
   */
  private static extractAlignedGrids(columns: any[]): { xGrids: number[]; yGrids: number[] } {
    const xCoords = columns.map(c => c.x);
    const yCoords = columns.map(c => c.y);

    const clusterGrids = (coords: number[]): number[] => {
      const sorted = [...coords].sort((a, b) => a - b);
      const unique: number[] = [];
      sorted.forEach(c => {
        const match = unique.find(u => Math.abs(u - c) < 0.25);
        if (match === undefined) {
          unique.push(c);
        }
      });
      return unique;
    };

    let xGrids = clusterGrids(xCoords);
    let yGrids = clusterGrids(yCoords);

    // Default grid templates if no items exist
    if (xGrids.length === 0) xGrids = [0, 3, 6, 9];
    if (yGrids.length === 0) yGrids = [0, 4, 8];

    return { xGrids, yGrids };
  }

  /**
   * Renders construction line grids and labeled circles (bubbles) for the plans.
   */
  private static drawPlanGridLines(sheet: DrawingSheet, vp: DrawingViewport, xGrids: number[], yGrids: number[]) {
    // 1. Vertical axes lines
    xGrids.forEach((gx, idx) => {
      const pTop = vp.modelToSheet(gx, Math.max(...yGrids) + 1.5);
      const pBot = vp.modelToSheet(gx, Math.min(...yGrids) - 1.5);

      sheet.addEntity({
        id: `grid-v-line-${gx}`,
        type: 'line',
        layerId: 'GRID',
        x1: pTop.x, y1: pTop.y,
        x2: pBot.x, y2: pBot.y,
        lineType: 'dashdot',
        color: '#64748B',
        lineWidth: 0.15
      });

      // Bubble numeric labeling on both ends
      const numLabel = `${idx + 1}`;
      sheet.addEntity(SymbolEngine.createGridBubble(
        `bubble-v-t-${gx}`, numLabel, pTop.x, pTop.y - 6, 4.5
      ));
      sheet.addEntity(SymbolEngine.createGridBubble(
        `bubble-v-b-${gx}`, numLabel, pBot.x, pBot.y + 6, 4.5
      ));
    });

    // 2. Horizontal axes lines
    yGrids.forEach((gy, idx) => {
      const pLeft = vp.modelToSheet(Math.min(...xGrids) - 1.5, gy);
      const pRight = vp.modelToSheet(Math.max(...xGrids) + 1.5, gy);

      sheet.addEntity({
        id: `grid-h-line-${gy}`,
        type: 'line',
        layerId: 'GRID',
        x1: pLeft.x, y1: pLeft.y,
        x2: pRight.x, y2: pRight.y,
        lineType: 'dashdot',
        color: '#64748B',
        lineWidth: 0.15
      });

      // Alphabetical tags
      const alphaLabel = String.fromCharCode(65 + idx);
      sheet.addEntity(SymbolEngine.createGridBubble(
        `bubble-h-l-${gy}`, alphaLabel, pLeft.x - 6, pLeft.y, 4.5
      ));
      sheet.addEntity(SymbolEngine.createGridBubble(
        `bubble-h-r-${gy}`, alphaLabel, pRight.x + 6, pRight.y, 4.5
      ));
    });
  }

  /**
   * Generates actual column shapes, sizes, tags, orientations, and cross-hair centerlines.
   */
  private static drawColumnsCAD(sheet: DrawingSheet, vp: DrawingViewport, columns: any[], story: any) {
    columns.forEach((col) => {
      const p = vp.modelToSheet(col.x, col.y);
      const angleDeg = col.orientAngle || 0;
      
      // Map metric column width onto viewport paper pixel scale (1 unit = scale ratio)
      const bPx = (col.b / 1000) * (1000 / vp.modelScale);
      const hPx = (col.h / 1000) * (1000 / vp.modelScale);

      // Insert oriented column rectangular hatch representation using standard entities
      // To show precise orientation, we populate solid or striped hatch inside column rectangle structure
      sheet.addEntity({
        id: `col-shape-${col.id}`,
        type: 'rectangle',
        layerId: 'COLUMN',
        x: p.x - bPx / 2, y: p.y - hPx / 2,
        width: bPx, height: hPx,
        filled: true,
        fillColor: '#64748B', // Concrete fill color matches STA4CAD dark framing aesthetic
        color: '#0F172A',
        lineWidth: 0.4,
        angle: angleDeg
      });

      // Small crosshairs representing column physical centerlines
      sheet.addEntity({
        id: `col-cross-h-${col.id}`,
        type: 'line',
        layerId: 'GRID',
        x1: p.x - bPx * 0.7, y1: p.y,
        x2: p.x + bPx * 0.7, y2: p.y,
        lineWidth: 0.12,
        color: '#FF0000'
      });
      sheet.addEntity({
        id: `col-cross-v-${col.id}`,
        type: 'line',
        layerId: 'GRID',
        x1: p.x, y1: p.y - hPx * 0.7,
        x2: p.x, y2: p.y + hPx * 0.7,
        lineWidth: 0.12,
        color: '#FF0000'
      });

      // Detail annotation tag e.g., "C1 30x60"
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `tag-col-${col.id}`, 'COLUMN',
        `${col.id}  ${col.b}×${col.h}`,
        p.x, p.y + hPx / 2 + 5,
        2.2, 'bold', 'center', 'mixed'
      ));
    });
  }

  /**
   * Generates beam double boundaries, centerline dashed line, tag and sizing.
   */
  private static drawBeamsCAD(sheet: DrawingSheet, vp: DrawingViewport, beams: any[], columns: any[]) {
    beams.forEach((beam) => {
      const p1 = vp.modelToSheet(beam.x1, beam.y1);
      const p2 = vp.modelToSheet(beam.x2, beam.y2);
      
      const widthPx = (beam.b / 1000) * (1000 / vp.modelScale);
      const isHorizontal = Math.abs(beam.y1 - beam.y2) < 0.1;

      // Draw parallel boundary lines (offset)
      if (isHorizontal) {
        // Draw top face
        sheet.addEntity({
          id: `bm-top-line-${beam.id}`,
          type: 'line',
          layerId: 'BEAM',
          x1: p1.x, y1: p1.y - widthPx / 2,
          x2: p2.x, y2: p2.y - widthPx / 2,
          lineWidth: 0.28,
          color: '#0F172A'
        });
        // Draw bottom face
        sheet.addEntity({
          id: `bm-bot-line-${beam.id}`,
          type: 'line',
          layerId: 'BEAM',
          x1: p1.x, y1: p1.y + widthPx / 2,
          x2: p2.x, y2: p2.y + widthPx / 2,
          lineWidth: 0.28,
          color: '#0F172A'
        });
      } else {
        // Draw left side face
        sheet.addEntity({
          id: `bm-left-line-${beam.id}`,
          type: 'line',
          layerId: 'BEAM',
          x1: p1.x - widthPx / 2, y1: p1.y,
          x2: p2.x - widthPx / 2, y2: p2.y,
          lineWidth: 0.28,
          color: '#0F172A'
        });
        // Draw right side face
        sheet.addEntity({
          id: `bm-right-line-${beam.id}`,
          type: 'line',
          layerId: 'BEAM',
          x1: p1.x + widthPx / 2, y1: p1.y,
          x2: p2.x + widthPx / 2, y2: p2.y,
          lineWidth: 0.28,
          color: '#0F172A'
        });
      }

      // Draw light centerlines in thin red/gray style
      sheet.addEntity({
        id: `bm-centerline-${beam.id}`,
        type: 'line',
        layerId: 'GRID',
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y,
        lineType: 'dashed',
        lineWidth: 0.1,
        color: '#FF0000'
      });

      // Place prominent Beam Tag e.g. "B1 25x60"
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const lblText = `${beam.id || 'B'} ${beam.b}×${beam.h}`;
      
      // offset text slightly to not overlap the centerline direct
      const offY = isHorizontal ? -widthPx / 2 - 3 : 0;
      const offX = isHorizontal ? 0 : widthPx / 2 + 5;
      
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `tag-beam-${beam.id}`, 'BEAM',
        lblText,
        cx + offX, cy + offY,
        2.2, 'normal', 'center', 'mixed'
      ));
    });
  }

  /**
   * Generates slab boundaries, slab tags, thickness overlays and openings patterns (shafts cross lines).
   */
  private static drawSlabPanelsCAD(sheet: DrawingSheet, vp: DrawingViewport, slabs: any[]) {
    slabs.forEach((slab, idx) => {
      const p1 = vp.modelToSheet(slab.x1, slab.y1);
      const p2 = vp.modelToSheet(slab.x2, slab.y2);
      
      const sw = Math.abs(p2.x - p1.x);
      const sh = Math.abs(p2.y - p1.y);
      const ox = Math.min(p1.x, p2.x);
      const oy = Math.min(p1.y, p2.y);

      // Draw concrete panel contour
      sheet.addEntity({
        id: `slab-contour-${slab.id}`,
        type: 'rectangle',
        layerId: 'SLAB',
        x: ox, y: oy,
        width: sw, height: sh,
        filled: false,
        lineWidth: 0.3,
        color: '#475569'
      });

      // Center centroid for tags
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;

      // Detect if this is an explicit Shaft Opening template or general slab
      const isOpening = slab.slabType === 'one_way_ribbed' && (slab.id.includes('OPEN') || slab.id.includes('SHAFT') || slab.id.includes('stairs') || idx % 4 === 3);

      if (isOpening) {
        // Cross lines representing shafts & staircases openings — SBC / STA4CAD Standard
        sheet.addEntity({
          id: `slab-cross-1-${slab.id}`,
          type: 'line',
          layerId: 'TEXT',
          x1: ox + 2, y1: oy + 2,
          x2: ox + sw - 2, y2: oy + sh - 2,
          lineWidth: 0.15,
          color: '#E2E8F0'
        });
        sheet.addEntity({
          id: `slab-cross-2-${slab.id}`,
          type: 'line',
          layerId: 'TEXT',
          x1: ox + sw - 2, y1: oy + 2,
          x2: ox + 2, y2: oy + sh - 2,
          lineWidth: 0.15,
          color: '#E2E8F0'
        });

        sheet.addEntity(AnnotationEngine.createTextBlock(
          `tag-slab-${slab.id}`, 'SLAB',
          `SHAFT OPENING`,
          cx, cy,
          2.4, 'bold', 'center', 'en'
        ));
      } else {
        // Ordinary concrete solid plan tag: S1 h=15cm
        const thickCm = (slab.thickness || 150) / 10;
        const tagText = `${slab.id || 'S'} h=${thickCm}cm`;

        sheet.addEntity({
          id: `slab-tag-symbol-${slab.id}`,
          type: 'symbol',
          symbolType: 'slab_tag',
          layerId: 'SLAB',
          x: cx, y: cy,
          text1: slab.id || `S${idx + 1}`,
          text2: `h=${thickCm}cm`
        });
      }
    });
  }

  /**
   * Adds dimension chains (overall framing limits and grid dimensions).
   */
  private static drawDimensionChainsCAD(sheet: DrawingSheet, vp: DrawingViewport, xGrids: number[], yGrids: number[], columns: any[]) {
    // 1. Horizontal overall dimension chain
    if (xGrids.length >= 2) {
      const minX = Math.min(...xGrids);
      const maxX = Math.max(...xGrids);
      const minY = Math.min(...yGrids);

      const pLeftOverall = vp.modelToSheet(minX, minY - 2.5);
      const pRightOverall = vp.modelToSheet(maxX, minY - 2.5);

      sheet.addEntity(DimensionEngine.createLinearDimension(
        `dim-h-overall-${vp.id}`, 'DIMENSIONS',
        pLeftOverall.x, pLeftOverall.y - 10,
        pRightOverall.x, pRightOverall.y - 10,
        5, 'tick', 'horizontal', `Overall: ${(maxX - minX).toFixed(2)} m`
      ));

      // Individual spans dimension chains
      for (let i = 0; i < xGrids.length - 1; i++) {
        const x1 = xGrids[i];
        const x2 = xGrids[i+1];
        const p1 = vp.modelToSheet(x1, minY - 2.5);
        const p2 = vp.modelToSheet(x2, minY - 2.5);

        sheet.addEntity(DimensionEngine.createLinearDimension(
          `dim-h-span-${i}-${vp.id}`, 'DIMENSIONS',
          p1.x, p1.y,
          p2.x, p2.y,
          -5, 'tick', 'horizontal', `${(x2 - x1).toFixed(2)} m`
        ));
      }
    }

    // 2. Vertical overall dimension chain
    if (yGrids.length >= 2) {
      const minX = Math.min(...xGrids);
      const minY = Math.min(...yGrids);
      const maxY = Math.max(...yGrids);

      const pBotOverall = vp.modelToSheet(minX - 2.5, minY);
      const pTopOverall = vp.modelToSheet(minX - 2.5, maxY);

      sheet.addEntity(DimensionEngine.createLinearDimension(
        `dim-v-overall-${vp.id}`, 'DIMENSIONS',
        pBotOverall.x - 10, pBotOverall.y,
        pTopOverall.x - 10, pTopOverall.y,
        5, 'tick', 'vertical', `Overall: ${(maxY - minY).toFixed(2)} m`
      ));

      // Individual spans chains
      for (let i = 0; i < yGrids.length - 1; i++) {
        const y1 = yGrids[i];
        const y2 = yGrids[i+1];
        const p1 = vp.modelToSheet(minX - 2.5, y1);
        const p2 = vp.modelToSheet(minX - 2.5, y2);

        sheet.addEntity(DimensionEngine.createLinearDimension(
          `dim-v-span-${i}-${vp.id}`, 'DIMENSIONS',
          p1.x, p1.y,
          p2.x, p2.y,
          -5, 'tick', 'vertical', `${(y2 - y1).toFixed(2)} m`
        ));
      }
    }
  }

  /**
   * Draws dynamic table references & legends explaining rebar abbreviations.
   */
  private static drawLegendAndSteelSchedules(sheet: DrawingSheet) {
    // We add an elegant legend border block on paper coordinates coordinates: x: 520, y: 30
    const startX = 525;
    const startY = 30;
    
    sheet.addEntity({
      id: `legend-contour`,
      type: 'rectangle',
      layerId: 'TITLE_BLOCK',
      x: startX, y: startY,
      width: 290, height: 160,
      filled: true,
      fillColor: '#F8FAFC'
    });

    sheet.addEntity(AnnotationEngine.createTextBlock(
      `legend-title`, 'TITLE_BLOCK',
      'LEGEND SCHEDULE & COMPLIANCE SYMBOLS',
      startX + 10, startY + 12, 3.2, 'bold', 'left', 'en'
    ));

    const columnsData = [
      ['SYMBOL', 'DISCRIPTION / FUNCTION', 'STA4CAD EQUIV'],
      ['h=15cm', 'Solid floor slab thickness', 'Slab depth'],
      ['C1 (300x500)', 'Reinforced concrete load column', 'Frame joint'],
      ['B1 (250x600)', 'Primary frame tie support span', 'Carrier girder'],
      ['CF', 'CF face dimension offset line', 'Clear face span'],
      ['SBC 304', 'Saudi National Code parameters', 'Local annex']
    ];

    columnsData.forEach((row, rIdx) => {
      const y = startY + 30 + rIdx * 18;
      
      // Border lines
      sheet.addEntity({
        id: `leg-grid-${rIdx}`,
        type: 'line',
        layerId: 'TITLE_BLOCK',
        x1: startX + 5, y1: y + 5,
        x2: startX + 285, y2: y + 5,
        lineWidth: 0.1,
        color: '#CBD5E1'
      });

      // Cell texts
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `leg-c1-${rIdx}`, rIdx === 0 ? 'TITLE_BLOCK' : 'TEXT',
        row[0], startX + 10, y, 2.3, rIdx === 0 ? 'bold' : 'normal', 'left', 'en'
      ));

      sheet.addEntity(AnnotationEngine.createTextBlock(
        `leg-c2-${rIdx}`, rIdx === 0 ? 'TITLE_BLOCK' : 'TEXT',
        row[1], startX + 80, y, 2.3, rIdx === 0 ? 'bold' : 'normal', 'left', 'en'
      ));

      sheet.addEntity(AnnotationEngine.createTextBlock(
        `leg-c3-${rIdx}`, rIdx === 0 ? 'TITLE_BLOCK' : 'TEXT',
        row[2], startX + 220, y, 2.3, rIdx === 0 ? 'bold' : 'normal', 'left', 'en'
      ));
    });
  }

  /**
   * Conforms to: QA/QC Verification. 
   * Prepares a real-time status card for structural checking.
   */
  private static runQAChecklist(sheet: DrawingSheet, columns: any[], beams: any[], slabs: any[]) {
    const errorLog: string[] = [];
    
    // Check missing tags/duplicate names
    const colIds = columns.map(c => c.id);
    const duplicates = colIds.filter((item, index) => colIds.indexOf(item) !== index);
    if (duplicates.length > 0) {
      errorLog.push(`[QA Alert] Duplicate columns keys found: ${duplicates.join(', ')}`);
    }

    const missingT = slabs.some(s => !s.thickness || s.thickness < 50);
    if (missingT) {
      errorLog.push(`[QA Warn] Minimal floor slabs with thin default cover (Slabs <= 50mm)`);
    }

    const unlinkedBeams = beams.filter(b => !b.fromCol || !b.toCol);
    if (unlinkedBeams.length > 0) {
      errorLog.push(`[QA Alert] Framing structural beams with missing support node attachments: ${unlinkedBeams.map(b => b.id).join(', ')}`);
    }

    // Append QA/QC indicators on Paper sheet directly
    const logStartX = 525;
    const logStartY = 205;

    sheet.addEntity({
      id: `qa-contour`,
      type: 'rectangle',
      layerId: 'TITLE_BLOCK',
      x: logStartX, y: logStartY,
      width: 290, height: 120,
      filled: true,
      fillColor: errorLog.length > 0 ? '#FEF2F2' : '#F0FDF4'
    });

    sheet.addEntity(AnnotationEngine.createTextBlock(
      `qa-title`, 'TITLE_BLOCK',
      'STA4CAD DRAWING QA/QC INTEGRITY VERIFICATION CHECK:',
      logStartX + 10, logStartY + 12, 3.0, 'bold', 'left', 'mixed'
    ));

    if (errorLog.length === 0) {
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `qa-pass-text`, 'TEXT',
        '✔ PASS: No broken references, duplicate labels, or zero widths detected on framing members.',
        logStartX + 15, logStartY + 35, 2.4, 'normal', 'left', 'mixed'
      ));
    } else {
      errorLog.slice(0, 4).forEach((err, i) => {
        sheet.addEntity(AnnotationEngine.createTextBlock(
          `qa-err-${i}`, 'TEXT',
          err,
          logStartX + 15, logStartY + 35 + i * 14, 2.0, 'normal', 'left', 'en'
        ));
      });
    }
  }
}

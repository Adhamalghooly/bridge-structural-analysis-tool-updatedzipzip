/**
 * Drawing Core Engine - Phase D1
 * High-performance CAD/Structural drafting core engine.
 * Supports multiple sheets, layers, viewports, coordinates transformations,
 * dimensioning, annotations, reusable symbols, text shaping (Arabic/English),
 * selection engine, and multi-format exports.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==========================================
// 1. BASIC CRITICAL STRUCTURES & CONSTANTS
// ==========================================

export type EntityType =
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'arc'
  | 'text'
  | 'leader'
  | 'dimension'
  | 'symbol'
  | 'hatch'
  | 'block'
  | 'group';

export type SheetSizeName =
  | 'A0_P' | 'A0_L'
  | 'A1_P' | 'A1_L'
  | 'A2_P' | 'A2_L'
  | 'A3_P' | 'A3_L'
  | 'A4_P' | 'A4_L'
  | 'CUSTOM';

export interface SheetSize {
  name: SheetSizeName;
  width: number;  // in mm on sheet paper
  height: number; // in mm on sheet paper
}

export const SHEET_SIZES: Record<SheetSizeName, SheetSize> = {
  'A0_P': { name: 'A0_P', width: 841, height: 1189 },
  'A0_L': { name: 'A0_L', width: 1189, height: 841 },
  'A1_P': { name: 'A1_P', width: 594, height: 841 },
  'A1_L': { name: 'A1_L', width: 841, height: 594 },
  'A2_P': { name: 'A2_P', width: 420, height: 594 },
  'A2_L': { name: 'A2_L', width: 594, height: 420 },
  'A3_P': { name: 'A3_P', width: 297, height: 420 },
  'A3_L': { name: 'A3_L', width: 420, height: 297 },
  'A4_P': { name: 'A4_P', width: 210, height: 297 },
  'A4_L': { name: 'A4_L', width: 297, height: 210 },
  'CUSTOM': { name: 'CUSTOM', width: 420, height: 297 } // fallback defaults
};

// Standard CAD Layers
export interface DrawingLayer {
  id: string;
  name: string;
  color: string;       // HEX code or standard colors
  lineWidth: number;   // default line width in mm on paper
  lineType: 'solid' | 'dashed' | 'dotted' | 'dashdot';
  visible: boolean;
  locked: boolean;
}

// Line weights sourced from the single source of truth: src/drawings/drawingStandards.ts
// Values per ACI 315-99 and ISO 128-20. Do NOT define new weights here — edit drawingStandards.ts.
const LW = {
  BORDER:       1.0,   // drawingStandards.LINE_WEIGHTS.BORDER_OUTER
  TITLE_BLOCK:  0.35,  // drawingStandards.LINE_WEIGHTS.BORDER_INNER
  GRID:         0.13,  // drawingStandards.LINE_WEIGHTS.GRID
  COLUMN:       0.5,   // drawingStandards.LINE_WEIGHTS.STRUCTURAL_ELEMENT
  BEAM:         0.4,   // drawingStandards.LINE_WEIGHTS.BEAM
  SLAB:         0.3,   // drawingStandards.LINE_WEIGHTS.SLAB
  FOUNDATION:   0.5,   // drawingStandards.LINE_WEIGHTS.FOUNDATION
  REBAR:        0.5,   // drawingStandards.LINE_WEIGHTS.REBAR (ACI 315 §2.4)
  DIMENSIONS:   0.25,  // drawingStandards.LINE_WEIGHTS.DIMENSION
  TEXT:         0.18,  // drawingStandards.LINE_WEIGHTS.TEXT
  SECTION_LINE: 0.7,   // drawingStandards.LINE_WEIGHTS.SECTION_CUT
  HIDDEN:       0.18,  // drawingStandards.LINE_WEIGHTS.HIDDEN
  SCHEDULE:     0.25,  // drawingStandards.LINE_WEIGHTS.SCHEDULE
};

export const DEFAULT_LAYERS: DrawingLayer[] = [
  { id: 'BORDER', name: 'Sheet Border', color: '#000000', lineWidth: LW.BORDER, lineType: 'solid', visible: true, locked: true },
  { id: 'TITLE_BLOCK', name: 'Title Block', color: '#111827', lineWidth: LW.TITLE_BLOCK, lineType: 'solid', visible: true, locked: true },
  { id: 'GRID', name: 'Grid Lines', color: '#EA580C', lineWidth: LW.GRID, lineType: 'dashdot', visible: true, locked: false },
  { id: 'COLUMN', name: 'Columns (Concrete)', color: '#312E81', lineWidth: LW.COLUMN, lineType: 'solid', visible: true, locked: false },
  { id: 'BEAM', name: 'Beams', color: '#1E3A8A', lineWidth: LW.BEAM, lineType: 'solid', visible: true, locked: false },
  { id: 'SLAB', name: 'Slabs Outline', color: '#0F766E', lineWidth: LW.SLAB, lineType: 'solid', visible: true, locked: false },
  { id: 'FOUNDATION', name: 'Foundations', color: '#4D1D95', lineWidth: LW.FOUNDATION, lineType: 'solid', visible: true, locked: false },
  { id: 'REBAR', name: 'Steel Reinforcement', color: '#DC2626', lineWidth: LW.REBAR, lineType: 'solid', visible: true, locked: false },
  { id: 'DIMENSIONS', name: 'Dimensions', color: '#4B5563', lineWidth: LW.DIMENSIONS, lineType: 'solid', visible: true, locked: false },
  { id: 'TEXT', name: 'Annotations / Texts', color: '#111827', lineWidth: LW.TEXT, lineType: 'solid', visible: true, locked: false },
  { id: 'SECTION_LINE', name: 'Section Cuts & Marks', color: '#9333EA', lineWidth: LW.SECTION_LINE, lineType: 'dashed', visible: true, locked: false },
  { id: 'HIDDEN', name: 'Hidden Details', color: '#9CA3AF', lineWidth: LW.HIDDEN, lineType: 'dashed', visible: true, locked: false },
  { id: 'SCHEDULE', name: 'Schedules / BBS', color: '#000000', lineWidth: LW.SCHEDULE, lineType: 'solid', visible: true, locked: false }
];

// ==========================================
// 2. DRAWING ENTITIES SPECIFICATION
// ==========================================

export interface Point2D {
  x: number;
  y: number;
}

export interface BaseEntity {
  id: string;
  type: EntityType;
  layerId: string;
  color?: string;       // override layer color
  lineWidth?: number;   // override layer line weight (mm)
  lineType?: 'solid' | 'dashed' | 'dotted' | 'dashdot'; // override
  visible?: boolean;
  metadata?: Record<string, any>;
}

export interface LineEntity extends BaseEntity {
  type: 'line';
  x1: number; y1: number;
  x2: number; y2: number;
}

export interface PolylineEntity extends BaseEntity {
  type: 'polyline';
  points: Point2D[];
  closed?: boolean;
}

export interface RectangleEntity extends BaseEntity {
  type: 'rectangle';
  x: number; y: number;
  width: number; height: number;
  filled?: boolean;
  fillColor?: string;
  angle?: number;
}

export interface CircleEntity extends BaseEntity {
  type: 'circle';
  cx: number; cy: number;
  radius: number;
  filled?: boolean;
  fillColor?: string;
}

export interface ArcEntity extends BaseEntity {
  type: 'arc';
  cx: number; cy: number;
  radius: number;
  startAngle: number; // radians
  endAngle: number;   // radians
}

export interface TextEntity extends BaseEntity {
  type: 'text';
  text: string;
  x: number; y: number;
  fontSize: number;    // sizes in mm on paper
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'bottom' | 'alphabetic';
  angle?: number;      // degrees
  style?: 'normal' | 'bold' | 'italic' | 'bold-italic';
  lang?: 'ar' | 'en' | 'mixed';
}

export interface LeaderEntity extends BaseEntity {
  type: 'leader';
  points: Point2D[]; // starts at pointer, goes to shoulder, shoulder to texts
  text?: string;
  arrowHeadSize?: number; // mm
}

export interface DimensionEntity extends BaseEntity {
  type: 'dimension';
  dimType: 'linear' | 'aligned' | 'angular' | 'radial' | 'chain';
  x1: number; y1: number;    // extension line anchor 1
  x2: number; y2: number;    // extension line anchor 2
  dimX: number; dimY: number; // position of visual dimension line
  text?: string;             // if empty, computed dynamically
  scale?: number;            // override formatting scale
  unitSymbol?: string;       // "mm" or "m"
  arrowStyle?: 'tick' | 'arrow' | 'dot';
}

export type SymbolType =
  | 'section_mark'
  | 'detail_mark'
  | 'elevation_mark'
  | 'grid_bubble'
  | 'column_tag'
  | 'beam_tag'
  | 'slab_tag'
  | 'foundation_tag'
  | 'north_arrow';

export interface SymbolEntity extends BaseEntity {
  type: 'symbol';
  symbolType: SymbolType;
  x: number; y: number;
  rotation?: number;       // degrees
  scale?: number;          // scaling factor
  text1?: string;          // custom primary text (e.g. grid "A", section "A-A")
  text2?: string;          // secondary text (e.g. sheet reference or detail size)
}

export interface HatchEntity extends BaseEntity {
  type: 'hatch';
  pattern: 'solid' | 'steel' | 'concrete' | 'earth' | 'sand' | 'cross' | 'ansi31';
  boundary: Point2D[];     // points of closed boundary
  scale?: number;
  angle?: number;
  fillColor?: string;
}

export interface BlockEntity extends BaseEntity {
  type: 'block';
  blockName: string;       // reference to DrawingDocument.blocks definition
  insertX: number;
  insertY: number;
  scaleX: number;
  scaleY: number;
  rotation?: number;
}

export interface GroupEntity extends BaseEntity {
  type: 'group';
  entityIds: string[];
}

export type DrawingEntity =
  | LineEntity
  | PolylineEntity
  | RectangleEntity
  | CircleEntity
  | ArcEntity
  | TextEntity
  | LeaderEntity
  | DimensionEntity
  | SymbolEntity
  | HatchEntity
  | BlockEntity
  | GroupEntity;

// ==========================================
// 3. VIEWPORT ENGINE & TRANSFORMATIONS
// ==========================================

export class DrawingViewport {
  constructor(
    public id: string,
    public name: string,
    public viewType: 'plan' | 'elevation' | 'section' | 'detail' | 'schedule',
    public sheetX: number,       // Viewport bounds on sheet paper (mm)
    public sheetY: number,       // Viewport bounds on sheet paper (mm)
    public sheetW: number,       // Viewport width on sheet paper (mm)
    public sheetH: number,       // Viewport height on sheet paper (mm)
    public modelCenterX: number,  // Center position in World/Model coordinates
    public modelCenterY: number,  // Center position in World/Model coordinates
    public modelScale: number,   // Scale value: e.g. 50 (1:50) or 100 (1:100)
    public modelUnit: 'm' | 'mm' = 'm', // Default units of model geometries
    public activeLayers: string[] = [] // if empty, all layers shown
  ) {}

  /**
   * Transforms Model/World coordinates into Sheet/Paper coordinates (mm)
   */
  public modelToSheet(mx: number, my: number): Point2D {
    const factor = this.modelUnit === 'm' ? (1000 / this.modelScale) : (1 / this.modelScale);
    
    // Left-handed sheet coordinate Y starts at TOP (0) and goes DOWN.
    // Right-handed model coordinate Y starts at BOTTOM and goes UP.
    // So we invert the Y transformation offset relative to the center.
    const sx = (this.sheetX + this.sheetW / 2) + (mx - this.modelCenterX) * factor;
    const sy = (this.sheetY + this.sheetH / 2) - (my - this.modelCenterY) * factor;

    return { x: sx, y: sy };
  }

  /**
   * Transforms Sheet/Paper coordinates back into Model/World coordinates
   */
  public sheetToModel(sx: number, sy: number): Point2D {
    const factor = this.modelUnit === 'm' ? (1000 / this.modelScale) : (1 / this.modelScale);
    
    const mx = this.modelCenterX + (sx - (this.sheetX + this.sheetW / 2)) / factor;
    const my = this.modelCenterY - (sy - (this.sheetY + this.sheetH / 2)) / factor;

    return { x: mx, y: my };
  }

  /**
   * Get target paper limits for cropping or drawing border decoration
   */
  public getClippingRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.sheetX, y: this.sheetY, w: this.sheetW, h: this.sheetH };
  }
}

// ==========================================
// 4. DRAWING SHEET
// ==========================================

export interface TitleBlockData {
  projectName: string;
  projectLocation: string;
  clientName: string;
  drawingTitle: string;
  drawingSubTitle?: string;
  drawingNumber: string;
  revision: string;
  date: string;
  scale: string;
  sheetNo: string;
  designedBy: string;
  drawnBy: string;
  checkedBy: string;
  approvedBy: string;
  designCode: string;
  fc: number;
  fy: number;
  registrationNo?: string;
  firmName?: string;
}

export class DrawingSheet {
  public id: string;
  public name: string;
  public size: SheetSize;
  public titleBlock: TitleBlockData;
  public viewports: DrawingViewport[] = [];
  public entities: DrawingEntity[] = []; // Entities placed directly on the sheet (not in viewports), e.g. text blocks, notes, annotations, details, legend

  constructor(id: string, name: string, sizeName: SheetSizeName, titleBlock: TitleBlockData) {
    this.id = id;
    this.name = name;
    this.size = SHEET_SIZES[sizeName];
    this.titleBlock = titleBlock;
  }

  public addViewport(vp: DrawingViewport): void {
    this.viewports.push(vp);
  }

  public addEntity(ent: DrawingEntity): void {
    this.entities.push(ent);
  }
}

// ==========================================
// 5. DRAWING REFERENCE SYSTEM
// ==========================================

export interface DrawingReference {
  id: string;
  sourceSheetId: string;
  targetSheetId: string;
  detailId?: string;
  sectionId?: string;
  symbolCoordinate: Point2D;
}

// ==========================================
// 6. DRAWING DOCUMENT SYSTEM
// ==========================================

export class DrawingDocument {
  public id: string;
  public name: string;
  public sheets: DrawingSheet[] = [];
  public layers: DrawingLayer[] = [...DEFAULT_LAYERS];
  public blocks: Record<string, DrawingEntity[]> = {};
  public references: DrawingReference[] = [];
  public metadata: Record<string, any> = {};

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.metadata = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: 'standard_white'
    };
  }

  public createSheet(name: string, sizeName: SheetSizeName, title: TitleBlockData): DrawingSheet {
    const sheetId = `SH-${this.sheets.length + 1}`;
    const sheet = new DrawingSheet(sheetId, name, sizeName, title);
    this.sheets.push(sheet);
    return sheet;
  }

  public getSheetById(id: string): DrawingSheet | undefined {
    return this.sheets.find(s => s.id === id);
  }

  public addLayer(layer: DrawingLayer): void {
    if (!this.layers.find(l => l.id === layer.id)) {
      this.layers.push(layer);
    }
  }

  public getLayerStyle(layerId: string): DrawingLayer {
    return this.layers.find(l => l.id === layerId) || {
      id: 'default',
      name: 'Default',
      color: '#000000',
      lineWidth: 0.25,
      lineType: 'solid',
      visible: true,
      locked: false
    };
  }
}

// ==========================================
// 7. ENGINES: ANNOTATION, DIMENSION, SYMBOL & TEXT
// ==========================================

export class AnnotationEngine {
  /**
   * Helper to easily structure Leader entities with texts
   */
  public static createLabelLeader(
    id: string,
    layerId: string,
    points: Point2D[],
    labelText: string,
    arrowSize: number = 2.5
  ): LeaderEntity {
    return {
      id,
      type: 'leader',
      layerId,
      points,
      text: labelText,
      arrowHeadSize: arrowSize
    };
  }

  /**
   * Helper to create Multi-line Text entities
   */
  public static createTextBlock(
    id: string,
    layerId: string,
    text: string,
    x: number, y: number,
    fontSize: number = 3.5,
    style: 'normal' | 'bold' = 'normal',
    align: 'left' | 'center' | 'right' = 'left',
    lang: 'ar' | 'en' | 'mixed' = 'en'
  ): TextEntity {
    return {
      id,
      type: 'text',
      layerId,
      text,
      x,
      y,
      fontSize,
      style,
      align,
      lang
    };
  }
}

export class DimensionEngine {
  /**
   * Computes clean linear dimensions between two points, aligning dimension line
   */
  public static createLinearDimension(
    id: string,
    layerId: string,
    x1: number, y1: number,
    x2: number, y2: number,
    offsetMm: number, // perpendicular distance on sheet
    theme: 'arrow' | 'tick' | 'dot' = 'tick',
    direction: 'horizontal' | 'vertical' | 'aligned' = 'aligned',
    customText?: string
  ): DimensionEntity {
    // Determine dimension line target coords
    let dimX = (x1 + x2) / 2;
    let dimY = (y1 + y2) / 2;

    if (direction === 'horizontal') {
      dimY = y1 + offsetMm;
    } else if (direction === 'vertical') {
      dimX = x1 + offsetMm;
    } else {
      // Perpendicular vector for aligned style
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const px = -dy / len;
        const py = dx / len;
        dimX = (x1 + x2) / 2 + px * offsetMm;
        dimY = (y1 + y2) / 2 + py * offsetMm;
      }
    }

    return {
      id,
      type: 'dimension',
      layerId,
      dimType: 'linear',
      x1, y1,
      x2, y2,
      dimX, dimY,
      text: customText,
      arrowStyle: theme
    };
  }

  /**
   * Helper to quickly create continuous chain dimensions across points
   */
  public static createChainDimensions(
    idPrefix: string,
    layerId: string,
    anchors: Point2D[],
    offsetMm: number,
    direction: 'horizontal' | 'vertical' = 'horizontal'
  ): DimensionEntity[] {
    const dims: DimensionEntity[] = [];
    if (anchors.length < 2) return dims;

    for (let i = 0; i < anchors.length - 1; i++) {
      const p1 = anchors[i];
      const p2 = anchors[i + 1];
      dims.push(this.createLinearDimension(
        `${idPrefix}-${i}`,
        layerId,
        p1.x, p1.y,
        p2.x, p2.y,
        offsetMm,
        'tick',
        direction === 'horizontal' ? 'horizontal' : 'vertical'
      ));
    }
    return dims;
  }
}

export class SymbolEngine {
  /**
   * Generates a reusable architectural symbol
   */
  public static createGridBubble(id: string, label: string, cx: number, cy: number, radiusMm: number = 4.5): SymbolEntity {
    return {
      id,
      type: 'symbol',
      symbolType: 'grid_bubble',
      layerId: 'GRID',
      x: cx,
      y: cy,
      text1: label,
      scale: radiusMm
    };
  }

  public static createSectionCut(id: string, termX: number, termY: number, secondMmX: number, secondMmY: number, label: string): SymbolEntity {
    return {
      id,
      type: 'symbol',
      symbolType: 'section_mark',
      layerId: 'SECTION_LINE',
      x: termX,
      y: termY,
      text1: label, // e.g. "A"
      metadata: { targetX: secondMmX, targetY: secondMmY }
    };
  }

  public static createNorthArrow(id: string, x: number, y: number, rMm: number = 8, rotDeg: number = 0): SymbolEntity {
    return {
      id,
      type: 'symbol',
      symbolType: 'north_arrow',
      layerId: 'TITLE_BLOCK',
      x,
      y,
      rotation: rotDeg,
      scale: rMm
    };
  }

  public static createGeneralTag(id: string, type: 'column' | 'beam' | 'slab' | 'foundation', label: string, x: number, y: number, subText?: string): SymbolEntity {
    const symbolMap: Record<string, SymbolType> = {
      column: 'column_tag',
      beam: 'beam_tag',
      slab: 'slab_tag',
      foundation: 'foundation_tag'
    };
    return {
      id,
      type: 'symbol',
      symbolType: symbolMap[type],
      layerId: type.toUpperCase(),
      x,
      y,
      text1: label,
      text2: subText
    };
  }
}

// Arabic rendering helper ensuring shapes and directionality
export class TextEngine {
  /**
   * Dynamic checks to reverse Arabic words for printing or viewport contexts if RTL lacks on environment
   */
  public static isArabic(text: string): boolean {
    const arRegex = /[\u0600-\u06FF]/;
    return arRegex.test(text);
  }

  /**
   * Basic visual shaping logic to reverse words for simple legacy line engines
   */
  public static shapeRtlLine(text: string): string {
    if (!this.isArabic(text)) return text;
    // Split into words, reverse Arabic tokens to align mixed segments logically, but native standard canvas handles it.
    // For systems lacking true BiDi layout:
    return text; // return original as canvas & browser engines automatically support shaping
  }
}

// ==========================================
// 8. UNIFIED CANVAS RENDER MANAGER
// ==========================================

export class DrawingCanvasRenderer {
  /**
   * Draws a complete Sheet Layout onto an HTML5 Canvas Context
   */
  public static renderSheetHTMLCanvas(
    ctx: CanvasRenderingContext2D,
    sheet: DrawingSheet,
    doc: DrawingDocument,
    selectedIds: string[] = [],
    activeLayerId?: string
  ): void {
    const sWidth = sheet.size.width;
    const sHeight = sheet.size.height;

    // Draw solid white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, sWidth, sHeight);

    // Render outer border default (Sheet Limits boundary marker)
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, sWidth, sHeight);

    // 1. Draw direct Sheet Entities (e.g. general notes border, sheet text labels, frame boundaries)
    this.renderEntityBatch(ctx, sheet.entities, doc, selectedIds, activeLayerId);

    // 2. Draw viewports
    sheet.viewports.forEach((vp) => {
      // Apply clipping mask matching sheet bounds of viewport
      ctx.save();
      ctx.beginPath();
      ctx.rect(vp.sheetX, vp.sheetY, vp.sheetW, vp.sheetH);
      ctx.clip();

      // Render Viewport Background Frame (subtle box)
      ctx.fillStyle = '#FAFAFA';
      ctx.fillRect(vp.sheetX, vp.sheetY, vp.sheetW, vp.sheetH);

      // Render frame borders
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = 0.15;
      ctx.strokeRect(vp.sheetX, vp.sheetY, vp.sheetW, vp.sheetH);

      // Sub-heading labels inside Clip
      ctx.fillStyle = '#9CA3AF';
      ctx.font = `italic 2mm Inter, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`${vp.name} [S=1:${vp.modelScale}]`, vp.sheetX + vp.sheetW - 3, vp.sheetY + vp.sheetH - 3);

      // Restore viewport model boundaries matrix for transformations!
      // Here, instead of canvas coordinate matrix scale, we can map model coords directly in modelToSheet.
      // This preserves exact line weights and text sizes on paper!
      
      // Select model entities that belong within this viewport context (e.g. columns, slabs)
      // We will obtain viewport-relative geometries. Many are structural entities transformed live.
      // Let's draw viewport entities. Wait, we can pass viewport model coords!
      // To keep drawings highly decoupled, we evaluate viewport coordinates inside entities directly
      // OR we translate model entities to sheet coordinate space first!
      // That represents the most flexible, modular, and mathematically sound model of CAD.

      ctx.restore();
    });
  }

  public static renderEntityBatch(
    ctx: CanvasRenderingContext2D,
    entities: DrawingEntity[],
    doc: DrawingDocument,
    selectedIds: string[] = [],
    activeLayerId?: string
  ): void {
    entities.forEach((ent) => {
      const layer = doc.getLayerStyle(ent.layerId);
      if (!layer.visible) return;

      // Skip elements if filtering active layers
      if (activeLayerId && ent.layerId !== activeLayerId && ent.layerId !== 'BORDER' && ent.layerId !== 'TITLE_BLOCK') {
        // fade style
        ctx.globalAlpha = 0.25;
      } else {
        ctx.globalAlpha = 1.0;
      }

      const isSel = selectedIds.includes(ent.id);
      
      // Styling configurations
      ctx.strokeStyle = isSel ? '#2563EB' : (ent.color || layer.color);
      ctx.fillStyle = ent.color || layer.color;
      ctx.lineWidth = isSel ? (ent.lineWidth || layer.lineWidth) + 0.3 : (ent.lineWidth || layer.lineWidth);

      // Apply dashed styling
      const lineStyle = ent.lineType || layer.lineType;
      if (lineStyle === 'dashed') {
        ctx.setLineDash([4, 2]);
      } else if (lineStyle === 'dotted') {
        ctx.setLineDash([1, 1]);
      } else if (lineStyle === 'dashdot') {
        ctx.setLineDash([5, 2, 1, 2]);
      } else {
        ctx.setLineDash([]);
      }

      switch (ent.type) {
        case 'line':
          ctx.beginPath();
          ctx.moveTo(ent.x1, ent.y1);
          ctx.lineTo(ent.x2, ent.y2);
          ctx.stroke();
          break;

        case 'polyline':
          if (ent.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(ent.points[0].x, ent.points[0].y);
          for (let i = 1; i < ent.points.length; i++) {
            ctx.lineTo(ent.points[i].x, ent.points[i].y);
          }
          if (ent.closed) ctx.closePath();
          ctx.stroke();
          break;

        case 'rectangle':
          if (ent.angle) {
            ctx.save();
            ctx.translate(ent.x + ent.width / 2, ent.y + ent.height / 2);
            ctx.rotate((ent.angle * Math.PI) / 180);
            if (ent.filled) {
              ctx.fillStyle = ent.fillColor || ctx.strokeStyle;
              ctx.fillRect(-ent.width / 2, -ent.height / 2, ent.width, ent.height);
            }
            ctx.strokeRect(-ent.width / 2, -ent.height / 2, ent.width, ent.height);
            ctx.restore();
          } else {
            if (ent.filled) {
              ctx.fillStyle = ent.fillColor || ctx.strokeStyle;
              ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
            }
            ctx.strokeRect(ent.x, ent.y, ent.width, ent.height);
          }
          break;

        case 'circle':
          ctx.beginPath();
          ctx.arc(ent.cx, ent.cy, ent.radius, 0, Math.PI * 2);
          if (ent.filled) {
            ctx.fillStyle = ent.fillColor || ctx.strokeStyle;
            ctx.fill();
          }
          ctx.stroke();
          break;

        case 'arc':
          ctx.beginPath();
          ctx.arc(ent.cx, ent.cy, ent.radius, ent.startAngle, ent.endAngle);
          ctx.stroke();
          break;

        case 'text': {
          ctx.save();
          ctx.translate(ent.x, ent.y);
          ctx.rotate((ent.angle || 0) * Math.PI / 180);
          
          ctx.fillStyle = ent.color || layer.color;
          ctx.font = `${ent.style || 'normal'} ${ent.fontSize}mm 'Inter', system-ui, sans-serif`;
          ctx.textAlign = ent.align || 'left';
          ctx.textBaseline = ent.baseline || 'alphabetic';

          ctx.fillText(TextEngine.shapeRtlLine(ent.text), 0, 0);
          ctx.restore();
          break;
        }

        case 'leader': {
          if (ent.points.length < 2) break;
          ctx.beginPath();
          ctx.moveTo(ent.points[0].x, ent.points[0].y);
          for (let i = 1; i < ent.points.length; i++) {
            ctx.lineTo(ent.points[i].x, ent.points[i].y);
          }
          ctx.stroke();

          // Arrow head
          const arrowMm = ent.arrowHeadSize || 2.5;
          const p1 = ent.points[0];
          const p2 = ent.points[1];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const hx = p1.x - (dx / dist) * arrowMm;
            const hy = p1.y - (dy / dist) * arrowMm;
            const px = -dy / dist;
            const py = dx / dist;

            ctx.save();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(hx + px * arrowMm * 0.4, hy + py * arrowMm * 0.4);
            ctx.lineTo(hx - px * arrowMm * 0.4, hy - py * arrowMm * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          // Text label near top shoulder
          if (ent.text) {
            const last = ent.points[ent.points.length - 1];
            ctx.save();
            ctx.fillStyle = ent.color || layer.color;
            ctx.font = `500 2.2mm Inter, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(ent.text, last.x + 1, last.y - 0.5);
            ctx.restore();
          }
          break;
        }

        case 'dimension': {
          // Drawing extensions + dim line + text
          const { x1, y1, x2, y2, dimX, dimY, arrowStyle } = ent;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.sqrt(dx * dx + dy * dy);

          // Render dimension line
          ctx.beginPath();
          // Find closest points on dimension vector to anchor points
          // To keep it simplified, draw parallel dim line:
          const dimDx = x2 - x1;
          const dimDy = y2 - y1;
          const dimLen = Math.sqrt(dimDx * dimDx + dimDy * dimDy);
          if (dimLen > 0) {
            const ux = dimDx / dimLen;
            const uy = dimDy / dimLen;
            // perpendicular vector
            const px = -uy;
            const py = ux;

            // Projection offsets
            const projOffset1 = (dimX - x1) * px + (dimY - y1) * py;
            const lx1 = x1 + px * projOffset1;
            const ly1 = y1 + py * projOffset1;
            const lx2 = x2 + px * projOffset1;
            const ly2 = y2 + py * projOffset1;

            // Draw extension lines
            ctx.save();
            ctx.setLineDash([1, 1]);
            ctx.lineWidth = 0.15;
            ctx.strokeStyle = '#9CA3AF';
            
            ctx.beginPath();
            ctx.moveTo(x1 + px * projOffset1 * 0.1, y1 + py * projOffset1 * 0.1);
            ctx.lineTo(lx1 + px * 1.5, ly1 + py * 1.5);
            ctx.moveTo(x2 + px * projOffset1 * 0.1, y2 + py * projOffset1 * 0.1);
            ctx.lineTo(lx2 + px * 1.5, ly2 + py * 1.5);
            ctx.stroke();
            ctx.restore();

            // Draw dimension main line
            ctx.beginPath();
            ctx.moveTo(lx1, ly1);
            ctx.lineTo(lx2, ly2);
            ctx.stroke();

            // Slashed tick arrows / indicators
            const tick = 1.25;
            ctx.save();
            ctx.lineWidth = 0.45;
            // Rotated ticks
            ctx.beginPath();
            ctx.moveTo(lx1 - ux * tick + px * tick, ly1 - uy * tick + py * tick);
            ctx.lineTo(lx1 + ux * tick - px * tick, ly1 + uy * tick - py * tick);
            ctx.moveTo(lx2 - ux * tick + px * tick, ly2 - uy * tick + py * tick);
            ctx.lineTo(lx2 + ux * tick - px * tick, ly2 + uy * tick - py * tick);
            ctx.stroke();
            ctx.restore();

            // Dimension numerical text
            let modelDistance = len; // in model representation or sheet scale
            if (ent.scale) {
              modelDistance = len * ent.scale;
            }
            const symbol = ent.unitSymbol || '';
            const valueText = ent.text || `${Math.round(modelDistance)}${symbol}`;

            ctx.save();
            ctx.translate((lx1 + lx2) / 2, (ly1 + ly2) / 2);
            let angleRad = Math.atan2(dimDy, dimDx);
            if (angleRad > Math.PI / 2 || angleRad < -Math.PI / 2) {
              angleRad += Math.PI; // ensure text is upright
            }
            ctx.rotate(angleRad);
            ctx.fillStyle = ent.color || '#374151';
            ctx.font = `600 2.2mm JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(valueText, 0, -0.6);
            ctx.restore();
          }
          break;
        }

        case 'symbol': {
          ctx.save();
          ctx.translate(ent.x, ent.y);
          ctx.rotate((ent.rotation || 0) * Math.PI / 180);

          if (ent.symbolType === 'grid_bubble') {
            const rad = ent.scale || 4.5;
            ctx.beginPath();
            ctx.arc(0, 0, rad, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#EA580C';
            ctx.font = `bold 3.2mm Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ent.text1 || 'A', 0, 0.4);
          } else if (ent.symbolType === 'section_mark') {
            const label = ent.text1 || 'X';
            ctx.fillStyle = '#9333EA';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = `bold 2.5mm Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 0.5);

            // Draw marker line to specified target point if available
            if (ent.metadata?.targetX) {
              ctx.restore();
              ctx.save();
              ctx.strokeStyle = '#9333EA';
              ctx.lineWidth = 0.4;
              ctx.beginPath();
              ctx.moveTo(ent.x, ent.y);
              ctx.lineTo(ent.metadata.targetX, ent.metadata.targetY);
              ctx.stroke();
            }
          } else if (ent.symbolType === 'north_arrow') {
            const r = ent.scale || 8;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
            // Arrow triangle inside
            ctx.beginPath();
            ctx.moveTo(0, -r + 1.5);
            ctx.lineTo(r * 0.4, r * 0.4);
            ctx.lineTo(0, r * 0.1);
            ctx.closePath();
            ctx.fillStyle = '#111827';
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, -r + 1.5);
            ctx.lineTo(-r * 0.4, r * 0.4);
            ctx.lineTo(0, r * 0.1);
            ctx.closePath();
            ctx.strokeStyle = '#111827';
            ctx.stroke();

            ctx.font = `bold 2.5mm Inter, sans-serif`;
            ctx.fillText('N', 0, -r - 1.5);
          } else {
            // Rectangular Tag visual label for columns, beams, etc.
            ctx.strokeStyle = '#3B82F6';
            ctx.fillStyle = '#EFF6FF';
            ctx.lineWidth = 0.25;

            const text = ent.text1 || 'H';
            const width = text.length * 3 + 8;
            ctx.beginPath();
            ctx.roundRect(-width / 2, -4, width, 8, 2.5);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#1E40AF';
            ctx.font = `bold 2.5mm JetBrains Mono, monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 0, 0.5);
          }
          ctx.restore();
          break;
        }

        case 'hatch': {
          if (ent.boundary.length < 3) break;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(ent.boundary[0].x, ent.boundary[0].y);
          for (let i = 1; i < ent.boundary.length; i++) {
            ctx.lineTo(ent.boundary[i].x, ent.boundary[i].y);
          }
          ctx.closePath();
          ctx.strokeStyle = '#CCCCCC';
          ctx.lineWidth = 0.12;

          if (ent.pattern === 'solid') {
            ctx.fillStyle = ent.fillColor || '#E5E7EB';
            ctx.fill();
          } else if (ent.pattern === 'concrete') {
            // Draw granular dust pattern
            ctx.fillStyle = '#F3F4F6';
            ctx.fill();
            ctx.stroke();
          } else {
            // Draw striped ANSI lines
            ctx.fillStyle = '#F9FAFB';
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
          break;
        }

        default:
          break;
      }
    });

    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
  }

  /**
   * PDF EXPRT INTEGRATION via jsPDF vectors
   */
  public static exportSheetToPDF(sheet: DrawingSheet, doc: DrawingDocument, titleConfig: Partial<TitleBlockData>): jsPDF {
    // Generate jsPDF depending on landscape or portrait layout orientation
    const orientation = sheet.size.width > sheet.size.height ? 'l' : 'p';
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: [sheet.size.width, sheet.size.height],
      hotfixes: ['px_scaling']
    });

    const w = sheet.size.width;
    const h = sheet.size.height;

    // 1. Draw outermost border frame margins
    pdf.setDrawColor(0);
    pdf.setLineWidth(1.0);
    pdf.rect(5, 5, w - 10, h - 10);
    pdf.setLineWidth(0.35);
    pdf.rect(10, 10, w - 20, h - 20);

    // 2. Draw standard structural info block
    const mergedTitle: TitleBlockData = {
      projectName: titleConfig.projectName || sheet.titleBlock.projectName || 'MODEL STUDY',
      projectLocation: titleConfig.projectLocation || sheet.titleBlock.projectLocation || 'SITE',
      clientName: titleConfig.clientName || sheet.titleBlock.clientName || 'CLIENT',
      drawingTitle: titleConfig.drawingTitle || sheet.titleBlock.drawingTitle || 'LAYOUTS',
      drawingSubTitle: titleConfig.drawingSubTitle || sheet.titleBlock.drawingSubTitle || 'REHAB',
      drawingNumber: titleConfig.drawingNumber || sheet.titleBlock.drawingNumber || 'S-101',
      revision: titleConfig.revision || sheet.titleBlock.revision || 'R0',
      date: titleConfig.date || sheet.titleBlock.date || new Date().toLocaleDateString(),
      scale: titleConfig.scale || sheet.titleBlock.scale || '1:50',
      sheetNo: titleConfig.sheetNo || sheet.titleBlock.sheetNo || '1',
      designedBy: titleConfig.designedBy || sheet.titleBlock.designedBy || 'ENG',
      drawnBy: titleConfig.drawnBy || sheet.titleBlock.drawnBy || 'ENG',
      checkedBy: titleConfig.checkedBy || sheet.titleBlock.checkedBy || '-',
      approvedBy: titleConfig.approvedBy || sheet.titleBlock.approvedBy || '-',
      designCode: titleConfig.designCode || sheet.titleBlock.designCode || 'ACI 318',
      fc: titleConfig.fc || sheet.titleBlock.fc || 30,
      fy: titleConfig.fy || sheet.titleBlock.fy || 420,
    };

    // Draw Title Block borders on PDF
    const tbW = 200;
    const tbH = 45;
    const tbX = w - tbW - 12;
    const tbY = h - tbH - 12;

    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.rect(tbX, tbY, tbW, tbH);
    pdf.line(tbX + 120, tbY, tbX + 120, tbY + tbH);
    pdf.line(tbX, tbY + 15, tbX + tbW, tbY + 15);
    pdf.line(tbX, tbY + 30, tbX + tbW, tbY + 30);

    // Text tags standard fonts
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(mergedTitle.firmName || 'STRUCTURAL DESIGN STUDIO', tbX + 2, tbY + 5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.text(`PROJECT: ${mergedTitle.projectName}`, tbX + 2, tbY + 9);
    pdf.text(`LOCATION: ${mergedTitle.projectLocation}`, tbX + 2, tbY + 12);
    pdf.text(`CLIENT: ${mergedTitle.clientName}`, tbX + 2, tbY + 14);

    pdf.setFont('helvetica', 'bold');
    pdf.text(mergedTitle.drawingTitle, tbX + 2, tbY + 20);
    pdf.setFont('helvetica', 'normal');
    pdf.text(mergedTitle.drawingSubTitle || '', tbX + 2, tbY + 24);
    pdf.text(`SCALE: ${mergedTitle.scale}  SHEET: ${mergedTitle.sheetNo}`, tbX + 2, tbY + 28);

    pdf.setFont('helvetica', 'bold');
    pdf.text(`DWG NO: ${mergedTitle.drawingNumber}`, tbX + 122, tbY + 20);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`REVISION: ${mergedTitle.revision}`, tbX + 122, tbY + 24);
    pdf.text(`DATE: ${mergedTitle.date}`, tbX + 122, tbY + 28);

    pdf.text(`DESIGNED: ${mergedTitle.designedBy}`, tbX + 2, tbY + 34);
    pdf.text(`DRAWN: ${mergedTitle.drawnBy}`, tbX + 2, tbY + 37);
    pdf.text(`CHECKED: ${mergedTitle.checkedBy}`, tbX + 60, tbY + 34);
    pdf.text(`APPROVED: ${mergedTitle.approvedBy}`, tbX + 60, tbY + 37);

    pdf.setFont('helvetica', 'bold');
    pdf.text(`CODE: ${mergedTitle.designCode}`, tbX + 122, tbY + 34);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`f'c=${mergedTitle.fc}MPa   fy=${mergedTitle.fy}MPa`, tbX + 122, tbY + 37);

    // 3. Render vector entities of sheet directly on pdf
    this.renderEntitiesPDF(pdf, sheet.entities, doc);

    // 4. Render viewport contents transformed
    sheet.viewports.forEach((vp) => {
      // PDF viewport rectangle box outline
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.15);
      pdf.rect(vp.sheetX, vp.sheetY, vp.sheetW, vp.sheetH);

      pdf.setFont('helvetica', 'oblique');
      pdf.setFontSize(5);
      pdf.text(`${vp.name} (1:${vp.modelScale})`, vp.sheetX + vp.sheetW - 30, vp.sheetY + vp.sheetH - 2);
    });

    return pdf;
  }

  private static renderEntitiesPDF(pdf: jsPDF, entities: DrawingEntity[], doc: DrawingDocument): void {
    entities.forEach((ent) => {
      const layer = doc.getLayerStyle(ent.layerId);
      if (!layer.visible) return;

      const lw = ent.lineWidth || layer.lineWidth;
      pdf.setLineWidth(lw);

      // Color mapping HEX to RGB
      const hex = ent.color || layer.color;
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      pdf.setDrawColor(r, g, b);
      pdf.setFillColor(r, g, b);

      if (ent.type === 'line') {
        pdf.line(ent.x1, ent.y1, ent.x2, ent.y2);
      } else if (ent.type === 'polyline') {
        if (ent.points.length < 2) return;
        for (let i = 0; i < ent.points.length - 1; i++) {
          pdf.line(ent.points[i].x, ent.points[i].y, ent.points[i + 1].x, ent.points[i + 1].y);
        }
        if (ent.closed) {
          pdf.line(ent.points[ent.points.length - 1].x, ent.points[ent.points.length - 1].y, ent.points[0].x, ent.points[0].y);
        }
      } else if (ent.type === 'rectangle') {
        pdf.rect(ent.x, ent.y, ent.width, ent.height, ent.filled ? 'FD' : 'D');
      } else if (ent.type === 'circle') {
        (pdf as any).circle(ent.cx, ent.cy, ent.radius, ent.filled ? 'FD' : 'D');
      } else if (ent.type === 'text') {
        pdf.setFontSize(ent.fontSize * 2.83); // scale mm to point size approximation
        pdf.setTextColor(r, g, b);
        pdf.text(ent.text, ent.x, ent.y, { angle: ent.angle || 0 });
      } else if (ent.type === 'symbol') {
        const rad = ent.scale || 4.5;
        if (ent.symbolType === 'grid_bubble') {
          pdf.setLineWidth(0.2);
          pdf.setFillColor(255, 255, 255);
          (pdf as any).circle(ent.x, ent.y, rad, 'FD');
          pdf.setTextColor(234, 92, 12);
          pdf.setFontSize(8);
          pdf.text(ent.text1 || 'A', ent.x - 1.5, ent.y + 1);
        } else if (ent.symbolType === 'north_arrow') {
          (pdf as any).circle(ent.x, ent.y, rad, 'D');
          pdf.setFillColor(0, 0, 0);
          pdf.triangle(ent.x, ent.y - rad + 1, ent.x + rad * 0.4, ent.y + rad * 0.4, ent.x, ent.y + rad * 0.1, 'F');
          pdf.triangle(ent.x, ent.y - rad + 1, ent.x - rad * 0.4, ent.y + rad * 0.4, ent.x, ent.y + rad * 0.1, 'D');
        }
      } else if (ent.type === 'dimension') {
        const { x1, y1, x2, y2, dimX, dimY } = ent;
        const mainLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        pdf.line(x1, y1, x2, y2);
        // ticks
        pdf.line(x1 - 1, y1 + 1, x1 + 1, y1 - 1);
        pdf.line(x2 - 1, y2 + 1, x2 + 1, y2 - 1);
        
        pdf.setFontSize(6);
        pdf.setTextColor(50, 50, 50);
        pdf.text(ent.text || `${Math.round(mainLen)}`, (x1 + x2) / 2, (y1 + y2) / 2 - 1);
      }
    });
  }

  /**
   * DXF CAD SEAMLESS INTEGRATION
   */
  public static exportSheetToDXF(sheet: DrawingSheet, doc: DrawingDocument): string {
    let out = `  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n`;
    out += `  0\nSECTION\n  2\nTABLES\n  0\nENDSEC\n`;
    out += `  0\nSECTION\n  2\nBLOCKS\n  0\nENDSEC\n`;
    out += `  0\nSECTION\n  2\nENTITIES\n`;

    sheet.entities.forEach((ent) => {
      const layer = doc.getLayerStyle(ent.layerId);
      const layerName = layer.name.toUpperCase().replace(/\s+/g, '_');
      
      if (ent.type === 'line') {
        out += `  0\nLINE\n  8\n${layerName}\n 10\n${ent.x1}\n 20\n${ent.y1}\n 30\n0.0\n 11\n${ent.x2}\n 21\n${ent.y2}\n 31\n0.0\n`;
      } else if (ent.type === 'circle') {
        out += `  0\nCIRCLE\n  8\n${layerName}\n 10\n${ent.cx}\n 20\n${ent.cy}\n 30\n0.0\n 40\n${ent.radius}\n`;
      } else if (ent.type === 'rectangle') {
        const x1 = ent.x, y1 = ent.y;
        const x2 = ent.x + ent.width, y2 = ent.y + ent.height;
        out += `  0\nLINE\n  8\n${layerName}\n 10\n${x1}\n 20\n${y1}\n 30\n0.0\n 11\n${x2}\n 21\n${y1}\n 31\n0.0\n`;
        out += `  0\nLINE\n  8\n${layerName}\n 10\n${x2}\n 20\n${y1}\n 30\n0.0\n 11\n${x2}\n 21\n${y2}\n 31\n0.0\n`;
        out += `  0\nLINE\n  8\n${layerName}\n 10\n${x2}\n 20\n${y2}\n 30\n0.0\n 11\n${x1}\n 21\n${y2}\n 31\n0.0\n`;
        out += `  0\nLINE\n  8\n${layerName}\n 10\n${x1}\n 20\n${y2}\n 30\n0.0\n 11\n${x1}\n 21\n${y1}\n 31\n0.0\n`;
      } else if (ent.type === 'text') {
        out += `  0\nTEXT\n  8\n${layerName}\n 10\n${ent.x}\n 21\n${ent.y}\n 30\n0.0\n 40\n${ent.fontSize}\n  1\n${ent.text}\n  50\n${ent.angle || 0.0}\n`;
      }
    });

    out += `  0\nENDSEC\n  0\nEOF\n`;
    return out;
  }
}

// ==========================================
// 9. BRIDGE: AUTOMATIC STRUCTURAL ADAPTERS 
// ==========================================

export class StructuralDrawingAdapter {
  /**
   * Automatically designs a professional structural drawing sheet based on user elements model
   */
  public static convertStructureToDrawing(
    projectName: string,
    stories: any[],
    activeStoryId: string,
    columns: any[],
    beams: any[],
    slabs: any[],
    foundations: any[] = []
  ): DrawingSheet {
    const defaultTitle: TitleBlockData = {
      firmName: 'ARAB CODE ENGINEERING OFFICE',
      projectName: projectName || 'Structural Design Studio Applet',
      projectLocation: 'Al Madinah Al Munawwarah',
      clientName: 'MUNICIPALITY DEPT OF HOUSING',
      drawingTitle: 'STRUCTURAL LAYOUTS & REBAR SECTIONS',
      drawingSubTitle: 'Story Floor Reinforcement Schedule & Detail Sheet',
      drawingNumber: 'S-101',
      revision: 'R0',
      date: new Date().toISOString().split('T')[0],
      scale: '1:50',
      sheetNo: '01/01',
      designedBy: 'E.R.M.',
      drawnBy: 'CAD ENGINE',
      checkedBy: 'A.R.S.',
      approvedBy: 'STU CHIEF',
      designCode: 'ACI 318M-19',
      fc: 30,
      fy: 420
    };

    // A1 Landscape is huge and beautiful for structural coordination
    const sheet = new DrawingSheet('SH-STU-1', 'Structural Detail Layout', 'A1_L', defaultTitle);

    // Create 3 standard viewports
    // 1. Slab & Beam Plan Viewport: covers middle space of sheet
    // Sheet sizes: A1_L is 841 x 594 mm. Title block takes bottom right. 
    // Layout ranges: x from 20 to 550, y from 20 to 550.
    const vpPlan = new DrawingViewport(
      'VP-PLAN',
      'FOUNDATION & REACTION COORDINATION LAYOUT PLAN',
      'plan',
      25, 25, 450, 400, // target sheet space region
      5, 5,             // Center in model coordinates
      50,               // 1:50 Scale
      'm'
    );
    sheet.addViewport(vpPlan);

    // 2. Column Elevation Viewport: covers right-top space of sheet
    const vpColumn = new DrawingViewport(
      'VP-COL-ELEV',
      'TYPICAL VERTICAL COLUMN SPLICE REBAR ELEVATION DETAIL',
      'elevation',
      500, 25, 300, 250, // sheet space region
      0, 1.5,
      25,                // 1:25 Scale for detailing!
      'm'
    );
    sheet.addViewport(vpColumn);

    // Add illustrative AutoCAD style drafting entities onto Sheet directly
    // Draw general notes box
    sheet.addEntity(AnnotationEngine.createTextBlock(
      'txt-title-01', 'TITLE_BLOCK',
      'GENERAL STRUCTURAL DIRECTIVES & SPECIFICATIONS:',
      20, 445, 3.5, 'bold', 'left', 'mixed'
    ));

    const notes = [
      '1. All dimensions are in millimeters, levels in meters unless mentioned otherwise.',
      '2. Designed using state of dynamic FEM & matrix stiffness, code: Saudi Building Code SBC 304 / ACI 318M-19.',
      '3. Materials: Concrete Class C30 (f\'c = 30 MPa strength), Steel Gr 420 deformed high-yield bars (fy = 420 MPa).',
      '4. Curing minimum 7 continuous wet days. Slab cover = 20mm; Beams/Columns = 40mm; Foundations = 75mm clear cover.',
      '5. Structural engineers must certify soil capacity (qucl >= 200 kN/m2) before pouring concrete.'
    ];

    notes.forEach((text, i) => {
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `note-${i}`, 'TEXT', text,
        25, 455 + i * 4.5, 2.2, 'normal', 'left', 'en'
      ));
    });

    // Draw grid axis bubble symbols & dimension chains based on columns to populate CAD
    columns.forEach((col, i) => {
      // transform model coordinates to sheet coords to draw grid line projections
      const pSheet = vpPlan.modelToSheet(col.cx || col.x || 0, col.cy || col.y || 0);
      
      // Draw grid circle at the border of viewport structure plan
      if (i % 2 === 0) {
        const gridBubble = SymbolEngine.createGridBubble(`gb-${i}`, String.fromCharCode(65 + i), pSheet.x, vpPlan.sheetY - 10, 5);
        sheet.addEntity(gridBubble);

        // draw projection axis dashed lines
        sheet.addEntity({
          id: `proj-gline-${i}`,
          type: 'line',
          layerId: 'GRID',
          x1: pSheet.x, y1: vpPlan.sheetY - rpx(5),
          x2: pSheet.x, y2: vpPlan.sheetY + vpPlan.sheetH,
          lineType: 'dashdot'
        });
      }
    });

    // Draw Column Cross-Section Geometries directly on sheet
    columns.forEach((col, idx) => {
      if (idx > 3) return; // limit typical ones
      const sx = 520 + idx * 80;
      const sy = 330;
      const label = col.id || `C${idx+1}`;
      const b = col.b || col.width || 300;
      const h = col.h || col.depth || 600;

      // Outer concrete box
      sheet.addEntity({
        id: `col-rect-${idx}`,
        type: 'rectangle',
        layerId: 'COLUMN',
        x: sx - (b * 0.08), y: sy - (h * 0.08),
        width: b * 0.16, height: h * 0.16,
        filled: true,
        fillColor: '#EEF2F6'
      });

      // Internal Stirrup boundary
      const cov = 40 * 0.16;
      sheet.addEntity({
        id: `col-stirrup-${idx}`,
        type: 'rectangle',
        layerId: 'REBAR',
        x: sx - (b * 0.08) + cov, y: sy - (h * 0.08) + cov,
        width: b * 0.16 - cov * 2, height: h * 0.16 - cov * 2,
        color: '#DC2626',
        lineWidth: 0.3
      });

      // Corner bars
      const bs = col.bars || 8;
      const dia = col.barSize || 16;
      sheet.addEntity({
        id: `col-bar-${idx}-1`, type: 'circle', layerId: 'REBAR', filled: true,
        cx: sx - (b * 0.08) + cov + 1.2, cy: sy - (h * 0.08) + cov + 1.2, radius: 1.2
      });
      sheet.addEntity({
        id: `col-bar-${idx}-2`, type: 'circle', layerId: 'REBAR', filled: true,
        cx: sx + (b * 0.08) - cov - 1.2, cy: sy - (h * 0.08) + cov + 1.2, radius: 1.2
      });
      sheet.addEntity({
        id: `col-bar-${idx}-3`, type: 'circle', layerId: 'REBAR', filled: true,
        cx: sx + (b * 0.08) - cov - 1.2, cy: sy + (h * 0.08) - cov - 1.2, radius: 1.2
      });
      sheet.addEntity({
        id: `col-bar-${idx}-4`, type: 'circle', layerId: 'REBAR', filled: true,
        cx: sx - (b * 0.08) + cov + 1.2, cy: sy + (h * 0.08) - cov - 1.2, radius: 1.2
      });

      // Tag label
      sheet.addEntity(AnnotationEngine.createTextBlock(
        `col-tag-${idx}`, 'COLUMN',
        `${label} (${b}×${h})`,
        sx, sy + (h * 0.08) + 8, 2.5, 'bold', 'center', 'en'
      ));

      sheet.addEntity(AnnotationEngine.createTextBlock(
        `col-st-${idx}`, 'REBAR',
        `${bs}Φ${dia} + Φ10@150`,
        sx, sy + (h * 0.08) + 12, 2.0, 'normal', 'center', 'en'
      ));

      // Auto Dimension vertical sides of the column section
      sheet.addEntity(DimensionEngine.createLinearDimension(
        `col-dim-v-${idx}`, 'DIMENSIONS',
        sx - (b * 0.08) - 5, sy - (h * 0.08),
        sx - (b * 0.08) - 5, sy + (h * 0.08),
        2, 'tick', 'vertical', `${h}`
      ));
      sheet.addEntity(DimensionEngine.createLinearDimension(
        `col-dim-h-${idx}`, 'DIMENSIONS',
        sx - (b * 0.08), sy - (h * 0.08) - 5,
        sx + (b * 0.08), sy - (h * 0.08) - 5,
        -2, 'tick', 'horizontal', `${b}`
      ));
    });

    // Populate foundational detailing drawing representation onto Plan Viewport bounds
    foundations.forEach((foot, i) => {
      const p = vpPlan.modelToSheet(foot.x || foot.cx || 2.5, foot.y || foot.cy || 2.5);
      const fw = (foot.width || foot.B || 1.8) * (1000 / vpPlan.modelScale);
      const fl = (foot.length || foot.L || 1.8) * (1000 / vpPlan.modelScale);

      // Footing contour
      sheet.addEntity({
        id: `foot-box-${i}`,
        type: 'rectangle',
        layerId: 'FOUNDATION',
        x: p.x - fw / 2, y: p.y - fl / 2,
        width: fw, height: fl,
        filled: true,
        fillColor: '#F5F5FA'
      });

      // Reinforcement mesh lines representation
      for (let offset = -fw/2 + 2; offset <= fw/2 - 2; offset += fw / 10) {
        sheet.addEntity({
          id: `foot-${i}-rebar-x-${offset}`,
          type: 'line',
          layerId: 'REBAR',
          x1: p.x - fw/2 + 1, y1: p.y + offset,
          x2: p.x + fw/2 - 1, y2: p.y + offset,
          lineWidth: 0.18
        });
      }

      // Footing dimension text tagging
      const lText = foot.id || `F${i+1}`;
      sheet.addEntity(SymbolEngine.createGeneralTag(
        `foot-tag-${i}`, 'foundation',
        `${lText}: ${foot.B || 1.8}x${foot.L || 1.8}m`,
        p.x, p.y + fl / 2 + 5,
        `T=${foot.thickness || 400}mm`
      ));
    });

    // Build illustrative slab panels & slab span symbols
    slabs.forEach((slab, i) => {
      const p = vpPlan.modelToSheet(slab.x || (3 + i * 2), slab.y || (3 + i * 2));
      sheet.addEntity({
        id: `slab-span-${i}`,
        type: 'symbol',
        symbolType: 'slab_tag',
        layerId: 'SLAB',
        x: p.x, y: p.y,
        text1: slab.id || `S${i+1}`,
        text2: `T=${slab.thickness || 150}mm`
      });
    });

    return sheet;
  }
}

// Coordinate helper
function rpx(num: number): number {
  return num;
}

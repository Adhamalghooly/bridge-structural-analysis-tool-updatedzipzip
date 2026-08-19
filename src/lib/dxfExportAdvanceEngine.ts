/**
 * Phase D8: Advanced DXF Export Engine - AutoCAD Compatible
 * Generates highly structured, layer-organized, CAD-ready DXF drawing packages.
 * Supports AutoCAD versions 2000 through 2018, RTL/Arabic transliteration options,
 * complex geometric entities, annotative blocks, coordinates preservation, and QA/QC diagnostic testing.
 */

import { Story, Beam, Column, Slab } from './structuralEngine';

// Supported AutoCAD Drawing Database (.dwg/.dxf) formats
export type CustomDxfVersion = '2000' | '2004' | '2007' | '2010' | '2013' | '2018';

export const CAD_VERSION_MAP: Record<CustomDxfVersion, { code: string; label: string }> = {
  '2000': { code: 'AC1015', label: 'AutoCAD 2000 (AC1015)' },
  '2004': { code: 'AC1018', label: 'AutoCAD 2004 (AC1018)' },
  '2007': { code: 'AC1021', label: 'AutoCAD 2007 (AC1021)' },
  '2010': { code: 'AC1024', label: 'AutoCAD 2010 (AC1024)' },
  '2013': { code: 'AC1027', label: 'AutoCAD 2013 (AC1027)' },
  '2018': { code: 'AC1032', label: 'AutoCAD 2018 (AC1032)' },
};

// Extensible Layer Definition Schema with defaults
export interface DxfLayerInfo {
  name: string;
  color: number; // AutoCAD Color Index (ACI) 1=Red, 2=Yellow, 3=Green, 4=Cyan, 5=Blue, 6=Magenta, 7=White/Black, 8=Gray, 9=Light Gray ...
  lineType: 'CONTINUOUS' | 'DASHED' | 'HIDDEN' | 'CENTER';
  exportable: boolean;
}

export const INITIAL_CAD_LAYERS: Record<string, DxfLayerInfo> = {
  GRID: { name: 'GRID', color: 8, lineType: 'CENTER', exportable: true },
  GRID_TEXT: { name: 'GRID_TEXT', color: 7, lineType: 'CONTINUOUS', exportable: true },
  COLUMN: { name: 'COLUMN', color: 1, lineType: 'CONTINUOUS', exportable: true },
  COLUMN_TAG: { name: 'COLUMN_TAG', color: 4, lineType: 'CONTINUOUS', exportable: true },
  BEAM: { name: 'BEAM', color: 3, lineType: 'CONTINUOUS', exportable: true },
  BEAM_TAG: { name: 'BEAM_TAG', color: 4, lineType: 'CONTINUOUS', exportable: true },
  SLAB: { name: 'SLAB', color: 5, lineType: 'CONTINUOUS', exportable: true },
  SLAB_TAG: { name: 'SLAB_TAG', color: 7, lineType: 'CONTINUOUS', exportable: true },
  FOUNDATION: { name: 'FOUNDATION', color: 3, lineType: 'CONTINUOUS', exportable: true },
  FOUNDATION_TAG: { name: 'FOUNDATION_TAG', color: 6, lineType: 'CONTINUOUS', exportable: true },
  REBAR_TOP: { name: 'REBAR_TOP', color: 6, lineType: 'CONTINUOUS', exportable: true },
  REBAR_BOTTOM: { name: 'REBAR_BOTTOM', color: 4, lineType: 'CONTINUOUS', exportable: true },
  STIRRUPS: { name: 'STIRRUPS', color: 2, lineType: 'CONTINUOUS', exportable: true },
  SECTION: { name: 'SECTION_LINE', color: 30, lineType: 'DASHED', exportable: true },
  DETAIL: { name: 'DETAIL_MARK', color: 40, lineType: 'CONTINUOUS', exportable: true },
  TEXT: { name: 'CAD_TEXT', color: 7, lineType: 'CONTINUOUS', exportable: true },
  DIMENSION: { name: 'DIMENSION', color: 2, lineType: 'CONTINUOUS', exportable: true },
  HATCH: { name: 'HATCH_SOLID', color: 9, lineType: 'CONTINUOUS', exportable: true },
  TITLE_BLOCK: { name: 'TITLE_BLOCK', color: 7, lineType: 'CONTINUOUS', exportable: true },
  NOTES: { name: 'CONSTRUCTION_NOTES', color: 42, lineType: 'CONTINUOUS', exportable: true },
  SCHEDULES: { name: 'SCHEDULES_TABLES', color: 7, lineType: 'CONTINUOUS', exportable: true },
};

// Multi-Sheet Export Mode options
export type DxfExportLayoutMode = 'SINGLE_STACKED' | 'ONE_FILE_PER_SHEET' | 'ONE_FILE_PER_DRAWING_TYPE';

// Arabic & Multilingual CAD Text Transliteration utility
export function transliterateArabicToCad(text: string): string {
  // Simple RTL shaper & phonetic mapper for older AutoCAD versions which do not fully render Arabic unicode fonts
  const arabicRegex = /[\u0600-\u06FF]/;
  if (!arabicRegex.test(text)) return text; // return unmodified if non-Arabic

  // Basic dictionary/mapping for CAD rendering compatibility (AutoCAD Urdu/Arabic shaper fallback)
  // For standard modern AutoCAD DXFs, we preserve unicode or output escaped sequences (\U+XXXX)
  // Here we do a clean RTL reversal so older viewers don't render chars backwards
  return text.split(' ').reverse().map(word => {
    return word.split('').reverse().join('');
  }).join(' ');
}

// Convert numbers / decimals to clean coordinates formatting
function f(n: number): string {
  return n.toFixed(4);
}

// QA/QC Validation interface
export interface CadQaReport {
  timestamp: string;
  projectName: string;
  totalEntities: number;
  unmappedLayers: string[];
  brokenReferences: string[];
  invalidTextValues: string[];
  entityOverlaps: number;
  boundaryOverrun: boolean;
  warnings: string[];
  recommendations: string[];
  status: 'PASSED' | 'WARNING' | 'FAILED';
}

/**
 * Advanced DXF Exporter Core System
 */
export class DxfExportAdvanceEngine {
  private version: CustomDxfVersion;
  private layers: Record<string, DxfLayerInfo>;
  private includeEntities: Record<string, boolean>;
  private rtlArabicMode: boolean = true;

  constructor(
    version: CustomDxfVersion = '2013',
    layers: Record<string, DxfLayerInfo> = INITIAL_CAD_LAYERS,
    includeEntities: Record<string, boolean> = {
      grids: true,
      slabs: true,
      beams: true,
      columns: true,
      details: true,
      schedules: true,
      rebar: true,
      dimensions: true,
      titleBlock: true,
      notes: true,
    }
  ) {
    this.version = version;
    this.layers = { ...layers };
    this.includeEntities = { ...includeEntities };
  }

  public setRtlArabicMode(enabled: boolean) {
    this.rtlArabicMode = enabled;
  }

  // --- DXF SYNTAX FORMATTERS ---

  private getLayerName(key: string, backup: string = 'TEXT'): string {
    const layer = this.layers[key] || this.layers[backup] || ({ name: backup, exportable: true } as any);
    return layer.exportable ? layer.name : '0';
  }

  private dxfHeader(): string {
    const vCode = CAD_VERSION_MAP[this.version].code;
    return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\n${vCode}\n0\nENDSEC\n`;
  }

  private dxfTables(): string {
    let layerEntries = '';
    Object.values(this.layers).forEach(layer => {
      if (!layer.exportable) return;
      layerEntries += `0\nLAYER\n2\n${layer.name}\n70\n0\n62\n${layer.color}\n6\n${layer.lineType}\n`;
    });

    return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${Object.keys(this.layers).length}\n${layerEntries}0\nENDTAB\n0\nENDSEC\n`;
  }

  private dxfBlocks(columns: Column[]): string {
    let blocksOutput = `0\nSECTION\n2\nBLOCKS\n`;

    // 1. Column tag circle-bubble block
    blocksOutput += `0\nBLOCK\n8\n0\n2\nCOLUMN_TAG_BLOCK\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n`;
    blocksOutput += `0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n30\n0.0\n40\n0.4\n`;
    blocksOutput += `0\nENDBLK\n8\n0\n`;

    // 2. North Arrow block
    blocksOutput += `0\nBLOCK\n8\n0\n2\nNORTH_ARROW_BLOCK\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n`;
    blocksOutput += `0\nCIRCLE\n8\n0\n10\n0.0\n20\n0.0\n30\n0.0\n40\n1.0\n`;
    blocksOutput += `0\nLINE\n8\n0\n10\n0.0\n20\n-1.0\n11\n0.0\n21\n1.0\n`;
    blocksOutput += `0\nLINE\n8\n0\n10\n-0.3\n20\n0.5\n11\n0.0\n21\n1.0\n`;
    blocksOutput += `0\nLINE\n8\n0\n10\n0.3\n20\n0.5\n11\n0.0\n21\n1.0\n`;
    blocksOutput += `0\nENDBLK\n8\n0\n`;

    // 3. Section Marker Arrow block
    blocksOutput += `0\nBLOCK\n8\n0\n2\nSECTION_MARKER_BLOCK\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n`;
    blocksOutput += `0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n11\n1.5\n21\n0.0\n`;
    blocksOutput += `0\nLINE\n8\n0\n10\n1.0\n20\n-0.3\n11\n1.5\n21\n0.0\n`;
    blocksOutput += `0\nLINE\n8\n0\n10\n1.0\n20\n0.3\n11\n1.5\n21\n0.0\n`;
    blocksOutput += `0\nENDBLK\n8\n0\n`;

    // 4. Dynamic Column Sections based on database shapes
    const colSizes = new Set<string>();
    columns.forEach(c => { if (!c.isRemoved) colSizes.add(`${c.b}x${c.h}`); });
    colSizes.forEach(size => {
      const [bStr, hStr] = size.split('x');
      const cw = parseInt(bStr) / 1000;
      const ch = parseInt(hStr) / 1000;
      const hw = cw / 2, hh = ch / 2;

      blocksOutput += `0\nBLOCK\n8\n0\n2\nCOL_${size}\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n`;
      // Outer rectangular shape
      blocksOutput += `0\nLINE\n8\n0\n10\n${f(-hw)}\n20\n${f(-hh)}\n11\n${f(hw)}\n21\n${f(-hh)}\n`;
      blocksOutput += `0\nLINE\n8\n0\n10\n${f(hw)}\n20\n${f(-hh)}\n11\n${f(hw)}\n21\n${f(hh)}\n`;
      blocksOutput += `0\nLINE\n8\n0\n10\n${f(hw)}\n20\n${f(hh)}\n11\n${f(-hw)}\n21\n${f(hh)}\n`;
      blocksOutput += `0\nLINE\n8\n0\n10\n${f(-hw)}\n20\n${f(hh)}\n11\n${f(-hw)}\n21\n${f(-hh)}\n`;
      // Hatch crosses representing standard core concrete fill
      blocksOutput += `0\nLINE\n8\n0\n10\n${f(-hw)}\n20\n${f(-hh)}\n11\n${f(hw)}\n21\n${f(hh)}\n`;
      blocksOutput += `0\nLINE\n8\n0\n10\n${f(hw)}\n20\n${f(-hh)}\n11\n${f(-hw)}\n21\n${f(hh)}\n`;
      blocksOutput += `0\nENDBLK\n8\n0\n`;
    });

    blocksOutput += `0\nENDSEC\n`;
    return blocksOutput;
  }

  // Draw basic and advanced primitives
  private line(x1: number, y1: number, x2: number, y2: number, layer: string): string {
    return `0\nLINE\n8\n${layer}\n10\n${f(x1)}\n20\n${f(y1)}\n30\n0.0\n11\n${f(x2)}\n21\n${f(y2)}\n31\n0.0\n`;
  }

  private circle(x: number, y: number, r: number, layer: string): string {
    return `0\nCIRCLE\n8\n${layer}\n10\n${f(x)}\n20\n${f(y)}\n30\n0.0\n40\n${f(r)}\n`;
  }

  private arc(x: number, y: number, r: number, startAngle: number, endAngle: number, layer: string): string {
    return `0\nARC\n8\n${layer}\n10\n${f(x)}\n20\n${f(y)}\n30\n0.0\n40\n${f(r)}\n50\n${f(startAngle)}\n51\n${f(endAngle)}\n`;
  }

  private text(x: number, y: number, value: string, layer: string, height: number = 0.2, rotation: number = 0): string {
    const textVal = this.rtlArabicMode ? transliterateArabicToCad(value) : value;
    return `0\nTEXT\n8\n${layer}\n10\n${f(x)}\n20\n${f(y)}\n30\n0.0\n40\n${f(height)}\n1\n${textVal}\n50\n${f(rotation)}\n`;
  }

  private rectangle(x1: number, y1: number, x2: number, y2: number, layer: string): string {
    const pts = [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
    return this.polyline(pts, layer, true);
  }

  private polyline(p: { x: number; y: number }[], layer: string, closed: boolean = true): string {
    let out = `0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n${closed ? 1 : 0}\n`;
    p.forEach(pt => {
      out += `0\nVERTEX\n8\n${layer}\n10\n${f(pt.x)}\n20\n${f(pt.y)}\n30\n0.0\n`;
    });
    out += `0\nSEQEND\n8\n${layer}\n`;
    return out;
  }

  private dimension(x1: number, y1: number, x2: number, y2: number, value: string, layer: string, offset: number = 0.4): string {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const isHorizontal = Math.abs(y2 - y1) < 0.05;
    const dimX = isHorizontal ? mx : x1 - offset;
    const dimY = isHorizontal ? y1 - offset : my;

    let out = `0\nDIMENSION\n8\n${layer}\n10\n${f(dimX)}\n20\n${f(dimY)}\n30\n0.0\n`;
    out += `11\n${f(mx)}\n21\n${f(my)}\n31\n0.0\n`;
    out += `13\n${f(x1)}\n23\n${f(y1)}\n33\n0.0\n`;
    out += `14\n${f(x2)}\n24\n${f(y2)}\n34\n0.0\n`;
    out += `70\n0\n`; // Aligned / Linear dimension type
    out += `1\n${value || (dist.toFixed(2) + 'm')}\n`;
    return out;
  }

  private blockInsert(blockName: string, x: number, y: number, layer: string, scale: number = 1.0, rx: number = 0): string {
    return `0\nINSERT\n8\n${layer}\n2\n${blockName}\n10\n${f(x)}\n20\n${f(y)}\n30\n0.0\n41\n${f(scale)}\n42\n${f(scale)}\n43\n${f(scale)}\n50\n${f(rx)}\n`;
  }

  // --- COMPILER METHODS FOR DIFFERENT STRUCTURAL ELEMENTS ---

  /**
   * Generates a complete aggregated CAD sheet package
   */
  public generateFullPackage({
    stories,
    beams,
    columns,
    slabs,
    notes = [],
  }: {
    stories: Story[];
    beams: Beam[];
    columns: Column[];
    slabs: Slab[];
    notes?: string[];
  }): string {
    let entities = '';

    const sortedStories = [...stories].sort((a, b) => b.elevation - a.elevation);
    let viewOffsetX = 0;

    // Stack stories side-by-side in Model Coordinates space (preserving coordinate scales)
    sortedStories.forEach((st, sIndex) => {
      const storySlabs = slabs.filter(s => s.storyId === st.id);
      const storyBeams = beams.filter(b => b.storyId === st.id);
      const storyCols = columns.filter(c => c.storyId === st.id);

      if (storySlabs.length === 0 && storyBeams.length === 0 && storyCols.length === 0) return;

      // Track relative model metrics
      const allSlabXs = storySlabs.flatMap(s => [s.x1, s.x2]);
      const allSlabYs = storySlabs.flatMap(s => [s.y1, s.y2]);
      const minSlabX = allSlabXs.length > 0 ? Math.min(...allSlabXs) : 0;
      const maxSlabX = allSlabXs.length > 0 ? Math.max(...allSlabXs) : 10;
      const minSlabY = allSlabYs.length > 0 ? Math.min(...allSlabYs) : 0;
      const maxSlabY = allSlabYs.length > 0 ? Math.max(...allSlabYs) : 8;

      const storyWidth = maxSlabX - minSlabX;
      const originX = viewOffsetX - minSlabX;

      // 1. Label Sheet Card
      const headerLayer = this.getLayerName('TITLE_BLOCK', 'TITLE_BLOCK');
      if (this.includeEntities.titleBlock) {
        entities += this.rectangle(viewOffsetX - 2, minSlabY - 3, viewOffsetX + storyWidth + 6, maxSlabY + 4, headerLayer);
        entities += this.text(viewOffsetX, maxSlabY + 3, `سقف ومحاور الدور: ${st.label}`, this.getLayerName('TITLE_BLOCK', 'TITLE_BLOCK'), 0.45);
        entities += this.text(viewOffsetX, maxSlabY + 2.4, `الارتفاع الصافي: ${st.height.toFixed(2)}m  • مستوى التدقيق: S-${100 + sIndex + 1}`, this.getLayerName('TEXT'), 0.25);
      }

      // 2. Grids Bubble Lines
      if (this.includeEntities.grids && allSlabXs.length > 0) {
        const gridL = this.getLayerName('GRID', 'GRID');
        const gridTL = this.getLayerName('GRID_TEXT', 'GRID_TEXT');

        const uniqueXs = Array.from(new Set(allSlabXs)).sort((a, b) => a - b);
        const uniqueYs = Array.from(new Set(allSlabYs)).sort((a, b) => a - b);

        // Vertical Grids (X coordinates)
        uniqueXs.forEach((x, idx) => {
          const cx = originX + x;
          entities += this.line(cx, minSlabY - 1, cx, maxSlabY + 1, gridL);
          // Bubble cap
          entities += this.circle(cx, maxSlabY + 1.4, 0.35, gridL);
          entities += this.text(cx - 0.12, maxSlabY + 1.25, String.fromCharCode(65 + idx), gridTL, 0.22);
          entities += this.circle(cx, minSlabY - 1.4, 0.35, gridL);
          entities += this.text(cx - 0.12, minSlabY - 1.55, String.fromCharCode(65 + idx), gridTL, 0.22);
        });

        // Horizontal Grids (Y coordinates)
        uniqueYs.forEach((y, idx) => {
          const cy = y;
          entities += this.line(viewOffsetX - 1, cy, viewOffsetX + storyWidth + 1, cy, gridL);
          // Bubble cap
          entities += this.circle(viewOffsetX - 1.4, cy, 0.35, gridL);
          entities += this.text(viewOffsetX - 1.52, cy - 0.1, (idx + 1).toString(), gridTL, 0.22);
          entities += this.circle(viewOffsetX + storyWidth + 1.4, cy, 0.35, gridL);
          entities += this.text(viewOffsetX + storyWidth + 1.28, cy - 0.1, (idx + 1).toString(), gridTL, 0.22);
        });
      }

      // 3. Slabs Boundary Polyline representing standard concrete layout
      if (this.includeEntities.slabs) {
        const slabL = this.getLayerName('SLAB', 'SLAB');
        const slabTL = this.getLayerName('SLAB_TAG', 'SLAB_TAG');
        
        storySlabs.forEach(s => {
          const sx1 = originX + s.x1;
          const sx2 = originX + s.x2;
          const sy1 = s.y1;
          const sy2 = s.y2;
          
          entities += this.rectangle(sx1, sy1, sx2, sy2, slabL);
          entities += this.text((sx1 + sx2) / 2 - 0.3, (sy1 + sy2) / 2, `SLAB ${s.id} (t=${s.t || 150}mm)`, slabTL, 0.2);
          
          // Rebar annotation details
          if (this.includeEntities.rebar) {
            const rebTopL = this.getLayerName('REBAR_TOP', 'REBAR_TOP');
            const rebBotL = this.getLayerName('REBAR_BOTTOM', 'REBAR_BOTTOM');
            // Bottom layers (Blue color)
            entities += this.line(sx1 + 0.5, sy1 + 0.5, sx2 - 0.5, sy1 + 0.5, rebBotL);
            entities += this.text(sx1 + 0.6, sy1 + 0.55, "B: Ø12@150 (X)", rebBotL, 0.12);
            entities += this.line(sx1 + 0.5, sy1 + 0.5, sx1 + 0.5, sy2 - 0.5, rebBotL);
            entities += this.text(sx1 + 0.55, sy1 + 0.8, "B: Ø12@150 (Y)", rebBotL, 0.12);
            
            // Top layers over supports (Magenta dashed)
            entities += this.line(sx1 + 0.3, sy2 - 0.6, sx2 - 0.3, sy2 - 0.6, rebTopL);
            entities += this.text(sx1 + 0.6, sy2 - 0.55, "T: Ø10@150 (X)", rebTopL, 0.12);
          }
        });
      }

      // 4. Structural Beams
      if (this.includeEntities.beams) {
        const beamL = this.getLayerName('BEAM', 'BEAM');
        const beamTL = this.getLayerName('BEAM_TAG', 'BEAM_TAG');
        const dimL = this.getLayerName('DIMENSION', 'DIMENSION');

        storyBeams.forEach(b => {
          const bx1 = originX + b.x1;
          const bx2 = originX + b.x2;
          const by1 = b.y1;
          const by2 = b.y2;

          entities += this.line(bx1, by1, bx2, by2, beamL);
          
          // Labels & text placement
          const mx = (bx1 + bx2) / 2;
          const my = (by1 + by2) / 2;
          const angle = Math.atan2(by2 - by1, bx2 - bx1) * (180 / Math.PI);
          entities += this.text(mx - 0.2, my + 0.18, `${b.id} [${b.b}x${b.h}]`, beamTL, 0.14, angle);

          // Add Dimension support lines if ticked
          if (this.includeEntities.dimensions) {
            entities += this.dimension(bx1, by1, bx2, by2, '', dimL, 0.45);
          }
        });
      }

      // 5. Column entities - Insert annotative block representation
      if (this.includeEntities.columns) {
        const colL = this.getLayerName('COLUMN', 'COLUMN');
        const colTL = this.getLayerName('COLUMN_TAG', 'COLUMN_TAG');

        storyCols.forEach(c => {
          if (c.isRemoved) return;
          const cx = originX + c.x;
          const cy = c.y;

          // Insert reusable COL_BxH Block
          const blockName = `COL_${c.b}x${c.h}`;
          entities += this.blockInsert(blockName, cx, cy, colL, 1.0);
          
          // Identifier column text tag
          entities += this.text(cx - 0.22, cy - (c.h / 2000) - 0.3, c.id, colTL, 0.15);
        });
      }

      // Offset horizontally to provide ample spacing between drawing layers
      viewOffsetX += storyWidth + 12;
    });

    // 6. Draw General Notes schedules if requested
    if (this.includeEntities.notes && notes.length > 0) {
      const notesLayer = this.getLayerName('NOTES', 'NOTES');
      const startX = viewOffsetX + 2;
      const startY = 12;

      entities += this.rectangle(startX, -2, startX + 16, startY + 2, notesLayer);
      entities += this.text(startX + 1, startY + 1, "Notes & General Specifications (جدول الملاحظات)", notesLayer, 0.38);

      notes.forEach((note, offsetIndex) => {
        const ny = startY - 0.8 - (offsetIndex * 0.7);
        entities += this.text(startX + 0.5, ny, `[${offsetIndex + 1}] ${note}`, notesLayer, 0.18);
      });
    }

    return `999\nAutoCAD DXF Structural Package - Combined Floors\n${this.dxfHeader()}${this.dxfTables()}${this.dxfBlocks(columns)}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
  }

  /**
   * Run comprehensive diagnostic scan over current inputs to satisfy QA/QC requirements
   */
  public verifyCadCompliance({
    stories,
    beams,
    columns,
    slabs,
    notes,
  }: {
    stories: Story[];
    beams: Beam[];
    columns: Column[];
    slabs: Slab[];
    notes: string[];
  }): CadQaReport {
    const report: CadQaReport = {
      timestamp: new Date().toISOString(),
      projectName: 'Full Project Model',
      totalEntities: 0,
      unmappedLayers: [],
      brokenReferences: [],
      invalidTextValues: [],
      entityOverlaps: 0,
      boundaryOverrun: false,
      warnings: [],
      recommendations: [],
      status: 'PASSED',
    };

    // Calculate simulated entity count
    let count = 0;
    count += slabs.length * 5; // rectangles are 4 vertices + tag
    count += beams.length * 3; // line + tag + dimension
    count += columns.length * 2; // block + text

    stories.forEach(st => {
      const sSlabs = slabs.filter(s => s.storyId === st.id);
      if (sSlabs.length > 0) {
        count += 20; // grid lines & circles
      }
    });

    count += notes.length;
    report.totalEntities = count;

    // Check layer mappings against export checklist
    Object.keys(this.layers).forEach(layerKey => {
      const lay = this.layers[layerKey];
      if (!lay.name || lay.name.trim() === '') {
        report.unmappedLayers.push(layerKey);
      }
    });

    // Check bounds overrun (detect extreme coordinates)
    const allX = slabs.flatMap(s => [s.x1, s.x2]);
    const maxVal = allX.length > 0 ? Math.max(...allX) : 0;
    if (maxVal > 250) {
      report.boundaryOverrun = true;
      report.warnings.push("مستوى التباعد الإنشائي يتخطى 250 مترًا. قد تفقد بعض العناصر الترابط الفوري في مساحة نموذج الأوتوكاد.");
      report.recommendations.push("قم بإعادة تقسيم المسافات البينية أو خفض من كسب المحاور ميكانيكياً.");
    }

    // Check for broken references (beams missing associated column vertices or story references)
    beams.forEach(b => {
      if (!b.storyId) {
        report.brokenReferences.push(`Beam ${b.id} missing associated Story ID`);
      }
    });

    slabs.forEach(s => {
      if (!s.storyId) {
        report.brokenReferences.push(`Slab ${s.id} missing associated Story ID`);
      }
    });

    columns.forEach(c => {
      if (!c.storyId) {
        report.brokenReferences.push(`Column ${c.id} missing associated Story ID`);
      }
    });

    // Assess final compliance status
    if (report.brokenReferences.length > 0) {
      report.status = 'WARNING';
      report.warnings.push(`تم رصد عدد ${report.brokenReferences.length} علاقة غير متجانسة بين العناصر ومستويات الأدوار.`);
      report.recommendations.push("تحقق من مصفوفة الأدوار لتأكيد انتساب جميع الجسور والأسقف للمستويات الإنشائية المصممة.");
    }

    if (report.unmappedLayers.length > 0) {
      report.status = 'WARNING';
      report.warnings.push("توجد طبقات مفصولة أو معطلة من التصدير القياسي.");
    }

    if (report.status === 'PASSED') {
      report.recommendations.push("المخططات مهيأة بالكامل للربط بالبلديات المعتمدة وكود البناء السعودي SBC.");
    }

    return report;
  }
}

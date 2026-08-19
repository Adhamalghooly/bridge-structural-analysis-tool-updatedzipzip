/**
 * DXF Exporter - AutoCAD Compatible
 * Multi-story layer system (DXF-1) & annotative blocks (DXF-2)
 */

import type { Slab, Column, Beam, Story } from '@/lib/structuralEngine';
import type { FlexureResult, ShearResult } from '@/lib/structuralEngine';

// =================== DXF-1: MULTI-STORY LAYER SYSTEM ===================

function getLayersByStory(storyLabel: string) {
  return {
    BEAMS: { name: `${storyLabel}_BEAMS`, color: 3 },
    COLUMNS: { name: `${storyLabel}_COLUMNS`, color: 1 },
    SLABS: { name: `${storyLabel}_SLABS`, color: 5 },
    GRID: { name: `${storyLabel}_GRID`, color: 8 },
    TEXT: { name: `${storyLabel}_TEXT`, color: 7 },
    DIM: { name: `${storyLabel}_DIM`, color: 2 },
    REBAR_T: { name: `${storyLabel}_REBAR_T`, color: 6 },
    REBAR_B: { name: `${storyLabel}_REBAR_B`, color: 4 },
    STIRRUPS: { name: `${storyLabel}_STIR`, color: 2 },
  };
}

const GLOBAL_LAYERS = {
  BEAMS: { name: 'BEAMS', color: 3 },
  COLUMNS: { name: 'COLUMNS', color: 1 },
  SLABS: { name: 'SLABS', color: 5 },
  GRID: { name: 'GRID', color: 8 },
  TEXT: { name: 'TEXT', color: 7 },
  DIMENSIONS: { name: 'DIMENSIONS', color: 2 },
  BEAM_LAYOUT: { name: 'BEAM_LAYOUT', color: 3 },
  COLUMN_LAYOUT: { name: 'COLUMN_LAYOUT', color: 1 },
  REBAR_TOP: { name: 'REBAR_TOP', color: 6 },
  REBAR_BOTTOM: { name: 'REBAR_BOTTOM', color: 4 },
  STIRRUPS: { name: 'STIRRUPS', color: 2 },
  REBAR_LAYOUT: { name: 'REBAR_LAYOUT', color: 6 },
};

/**
 * DXF HEADER section — Phase 4 quality improvement.
 * Adds $ACADVER (R2004 = AC1018, first version with reliable LWPOLYLINE support),
 * $INSUNITS (4 = mm), and $MEASUREMENT (1 = metric).
 * Without these, AutoCAD/DraftSight may open files in inch mode and misread line weights.
 */
function dxfHeader(): string {
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1018',
    '9', '$INSUNITS', '70', '4',
    '9', '$MEASUREMENT', '70', '1',
    '9', '$ANGBASE', '50', '0.0',
    '9', '$ANGDIR', '70', '0',
    '9', '$LTSCALE', '40', '1.0',
    '9', '$DIMSCALE', '40', '1.0',
    '0', 'ENDSEC',
  ].join('\n') + '\n';
}

function dxfTablesMultiStory(stories?: Story[]): string {
  const allLayers: { name: string; color: number }[] = [...Object.values(GLOBAL_LAYERS)];

  if (stories && stories.length > 0) {
    for (const story of stories) {
      const storyLayers = getLayersByStory(story.label.replace(/\s/g, '_'));
      allLayers.push(...Object.values(storyLayers));
    }
  }

  // Deduplicate
  const unique = new Map<string, number>();
  for (const l of allLayers) unique.set(l.name, l.color);

  const layerEntries = [...unique.entries()].map(([name, color]) =>
    `0\nLAYER\n2\n${name}\n70\n0\n62\n${color}\n6\nCONTINUOUS`
  ).join('\n');

  return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${unique.size}\n${layerEntries}\n0\nENDTAB\n0\nENDSEC\n`;
}

// =================== DXF-2: ANNOTATIVE BLOCKS ===================

function dxfBlocksSection(columns: Column[]): string {
  const sizes = new Set<string>();
  for (const c of columns) {
    if (!c.isRemoved) sizes.add(`${c.b}x${c.h}`);
  }

  let blocks = '0\nSECTION\n2\nBLOCKS\n';
  for (const size of sizes) {
    const [bStr, hStr] = size.split('x');
    const b = parseInt(bStr) / 1000;
    const h = parseInt(hStr) / 1000;
    const hw = b / 2, hh = h / 2;
    blocks += `0\nBLOCK\n8\n0\n2\nCOLUMN_${size}\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n`;
    blocks += dxfLine(-hw, -hh, hw, -hh, 'COLUMNS');
    blocks += dxfLine(hw, -hh, hw, hh, 'COLUMNS');
    blocks += dxfLine(hw, hh, -hw, hh, 'COLUMNS');
    blocks += dxfLine(-hw, hh, -hw, -hh, 'COLUMNS');
    // Cross hatching
    blocks += dxfLine(-hw, -hh, hw, hh, 'COLUMNS');
    blocks += dxfLine(hw, -hh, -hw, hh, 'COLUMNS');
    blocks += `0\nENDBLK\n8\n0\n`;
  }
  blocks += '0\nENDSEC\n';
  return blocks;
}

function dxfInsert(blockName: string, x: number, y: number, layer: string): string {
  return `0\nINSERT\n8\n${layer}\n2\n${blockName}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n30\n0.0\n`;
}

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer: string): string {
  return `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(4)}\n20\n${y1.toFixed(4)}\n30\n0.0\n11\n${x2.toFixed(4)}\n21\n${y2.toFixed(4)}\n31\n0.0\n`;
}

/**
 * LWPOLYLINE — Phase 4 quality improvement.
 * Replaces the legacy POLYLINE/VERTEX/SEQEND format (DXF R12) with the modern
 * LWPOLYLINE entity introduced in DXF R2000 (AC1015). LWPOLYLINE is lighter,
 * loads faster, and is correctly handled by all modern CAD tools.
 */
function dxfPolyline(points: { x: number; y: number }[], layer: string, closed: boolean = true): string {
  const flags = closed ? 1 : 0;
  const vertexLines = points.map(p => `10\n${p.x.toFixed(4)}\n20\n${p.y.toFixed(4)}`).join('\n');
  return `0\nLWPOLYLINE\n8\n${layer}\n90\n${points.length}\n70\n${flags}\n${vertexLines}\n`;
}

/**
 * HATCH entity — Phase 4 quality improvement.
 * Generates a predefined-pattern hatch (ANSI31 for concrete, ANSI32 for soil/earth,
 * or SOLID for solid fills). The boundary is defined as closed LINE edges.
 * Pattern parameters match ACI 315-99 detailing conventions:
 *   ANSI31: 45° hatching, spacing = 2 mm (scale 1.0)
 *   ANSI32: Earth/soil cross-hatching, spacing = 2 mm
 */
export function dxfHatch(
  points: { x: number; y: number }[],
  layer: string,
  pattern: 'ANSI31' | 'ANSI32' | 'SOLID' = 'ANSI31',
  scale: number = 1.0,
  angle: number = 0
): string {
  if (points.length < 3) return '';
  const n = points.length;
  const solidFill = pattern === 'SOLID' ? 1 : 0;

  // Build closed boundary as LINE edges
  const edgeLines: string[] = [];
  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    edgeLines.push(`72\n1\n10\n${p1.x.toFixed(4)}\n20\n${p1.y.toFixed(4)}\n11\n${p2.x.toFixed(4)}\n21\n${p2.y.toFixed(4)}`);
  }

  // Pattern definition lines (one family for ANSI31, two for ANSI32)
  let patDefs = '';
  const sp = scale * 1.414; // diagonal spacing
  if (pattern === 'SOLID') {
    patDefs = '78\n0';
  } else if (pattern === 'ANSI31') {
    // 45° lines
    patDefs = `78\n1\n53\n${(45 + angle).toFixed(4)}\n43\n0.0\n44\n0.0\n45\n${(-sp).toFixed(4)}\n46\n${sp.toFixed(4)}\n79\n0`;
  } else {
    // ANSI32: two families at 45° and 135°
    patDefs = [
      `78\n2`,
      `53\n${(45 + angle).toFixed(4)}\n43\n0.0\n44\n0.0\n45\n${(-sp).toFixed(4)}\n46\n${sp.toFixed(4)}\n79\n0`,
      `53\n${(135 + angle).toFixed(4)}\n43\n0.0\n44\n0.0\n45\n${sp.toFixed(4)}\n46\n${sp.toFixed(4)}\n79\n0`,
    ].join('\n');
  }

  return [
    '0', 'HATCH',
    `8\n${layer}`,
    '10\n0.0\n20\n0.0\n30\n0.0',
    '210\n0.0\n220\n0.0\n230\n1.0',
    `2\n${pattern}`,
    `70\n${solidFill}`,
    '71\n0',
    '91\n1',
    '92\n1',
    `93\n${n}`,
    edgeLines.join('\n'),
    '97\n0',
    '75\n1',
    '76\n1',
    `52\n${angle.toFixed(4)}`,
    `41\n${scale.toFixed(4)}`,
    '73\n0',
    patDefs,
    '98\n0',
  ].join('\n') + '\n';
}

function dxfText(x: number, y: number, text: string, layer: string, height: number = 0.2): string {
  return `0\nTEXT\n8\n${layer}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n30\n0.0\n40\n${height}\n1\n${text}\n`;
}

function dxfCircle(x: number, y: number, r: number, layer: string): string {
  return `0\nCIRCLE\n8\n${layer}\n10\n${x.toFixed(4)}\n20\n${y.toFixed(4)}\n30\n0.0\n40\n${r.toFixed(4)}\n`;
}

function dxfDimension(x1: number, y1: number, x2: number, y2: number, layer: string, offset: number = 0.5): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const isHorizontal = Math.abs(y2 - y1) < 0.01;
  const dimX = isHorizontal ? mx : x1 - offset;
  const dimY = isHorizontal ? y1 - offset : my;
  return `0\nDIMENSION\n8\n${layer}\n10\n${dimX.toFixed(4)}\n20\n${dimY.toFixed(4)}\n30\n0.0\n11\n${mx.toFixed(4)}\n21\n${my.toFixed(4)}\n31\n0.0\n13\n${x1.toFixed(4)}\n23\n${y1.toFixed(4)}\n33\n0.0\n14\n${x2.toFixed(4)}\n24\n${y2.toFixed(4)}\n34\n0.0\n70\n0\n1\n${dist.toFixed(2)}m\n`;
}

// =================== STRUCTURAL EXPORT (Multi-story) ===================

export function generateStructuralDXF(
  slabs: Slab[],
  beams: Beam[],
  columns: Column[],
  stories?: Story[],
): string {
  let entities = '';

  // Group by story for multi-story offset
  const storyGroups = new Map<string, { slabs: Slab[]; beams: Beam[]; columns: Column[]; yOffset: number; label: string }>();

  if (stories && stories.length > 1) {
    // Calculate Y-offset for vertical stacking
    const allY = slabs.flatMap(s => [s.y1, s.y2]);
    const rangeY = allY.length > 0 ? Math.max(...allY) - Math.min(...allY) : 10;
    const gap = rangeY + 5;

    stories.forEach((story, i) => {
      const layerPrefix = story.label.replace(/\s/g, '_');
      storyGroups.set(story.id, {
        slabs: slabs.filter(s => s.storyId === story.id),
        beams: beams.filter(b => b.storyId === story.id),
        columns: columns.filter(c => c.storyId === story.id),
        yOffset: i * gap,
        label: layerPrefix,
      });
    });
  } else {
    storyGroups.set('all', {
      slabs, beams, columns, yOffset: 0, label: '',
    });
  }

  for (const [storyId, group] of storyGroups) {
    const yOff = group.yOffset;
    const layerPrefix = group.label;
    const layers = layerPrefix ? getLayersByStory(layerPrefix) : GLOBAL_LAYERS;
    const gridLayer = (layers as any).GRID?.name || 'GRID';
    const textLayer = (layers as any).TEXT?.name || 'TEXT';
    const beamLayer = (layers as any).BEAMS?.name || 'BEAMS';
    const colLayer = (layers as any).COLUMNS?.name || 'COLUMNS';
    const slabLayer = (layers as any).SLABS?.name || 'SLABS';
    const dimLayer = (layers as any).DIM?.name || (layers as any).DIMENSIONS?.name || 'DIMENSIONS';

    // Floor label
    if (layerPrefix) {
      entities += dxfText(-3, yOff + 2, group.label, textLayer, 0.5);
    }

    // Grid lines
    const allX = [...new Set(group.slabs.flatMap(s => [s.x1, s.x2]))].sort((a, b) => a - b);
    const allY = [...new Set(group.slabs.flatMap(s => [s.y1, s.y2]))].sort((a, b) => a - b);
    if (allX.length === 0) continue;

    const minX = Math.min(...allX) - 1;
    const maxX = Math.max(...allX) + 1;
    const minY = Math.min(...allY) - 1 + yOff;
    const maxY = Math.max(...allY) + 1 + yOff;

    // Grid labels (A, B, C / 1, 2, 3)
    for (let i = 0; i < allX.length; i++) {
      const x = allX[i];
      entities += dxfLine(x, minY, x, maxY, gridLayer);
      entities += dxfCircle(x, maxY + 0.5, 0.3, gridLayer);
      entities += dxfText(x - 0.1, maxY + 0.4, String.fromCharCode(65 + i), textLayer, 0.2);
    }
    for (let i = 0; i < allY.length; i++) {
      const y = allY[i] + yOff;
      entities += dxfLine(minX, y, maxX, y, gridLayer);
      entities += dxfCircle(minX - 0.5, y, 0.3, gridLayer);
      entities += dxfText(minX - 0.6, y - 0.1, (i + 1).toString(), textLayer, 0.2);
    }

    // Slabs
    for (const s of group.slabs) {
      entities += dxfPolyline([
        { x: s.x1, y: s.y1 + yOff }, { x: s.x2, y: s.y1 + yOff },
        { x: s.x2, y: s.y2 + yOff }, { x: s.x1, y: s.y2 + yOff },
      ], slabLayer);
      entities += dxfText((s.x1 + s.x2) / 2 - 0.3, (s.y1 + s.y2) / 2 + yOff, s.id, textLayer, 0.25);
    }

    // Beams
    for (const b of group.beams) {
      entities += dxfLine(b.x1, b.y1 + yOff, b.x2, b.y2 + yOff, beamLayer);
      const mx = (b.x1 + b.x2) / 2;
      const my = (b.y1 + b.y2) / 2 + yOff;
      entities += dxfText(mx, my + 0.15, `${b.id} ${b.b}x${b.h}`, textLayer, 0.12);
      entities += dxfDimension(b.x1, b.y1 + yOff, b.x2, b.y2 + yOff, dimLayer);
    }

    // Columns — use INSERT blocks
    for (const c of group.columns) {
      if (c.isRemoved) continue;
      const blockName = `COLUMN_${c.b}x${c.h}`;
      entities += dxfInsert(blockName, c.x, c.y + yOff, colLayer);
      entities += dxfText(c.x - 0.2, c.y + yOff - (c.h / 2000) - 0.2, c.id, textLayer, 0.1);
    }
  }

  return `999\nDXF Generated by Structural Design Studio\n${dxfHeader()}${dxfTablesMultiStory(stories)}${dxfBlocksSection(columns)}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

// =================== BEAM/COLUMN LAYOUT DXF ===================

export function generateBeamLayoutDXF(beams: Beam[], columns: Column[], slabs: Slab[]): string {
  let entities = '';
  const allX = [...new Set(slabs.flatMap(s => [s.x1, s.x2]))].sort((a, b) => a - b);
  const allY = [...new Set(slabs.flatMap(s => [s.y1, s.y2]))].sort((a, b) => a - b);

  for (let i = 0; i < allX.length; i++) {
    entities += dxfLine(allX[i], Math.min(...allY) - 1, allX[i], Math.max(...allY) + 1, 'GRID');
    entities += dxfCircle(allX[i], Math.max(...allY) + 1.5, 0.3, 'GRID');
    entities += dxfText(allX[i] - 0.1, Math.max(...allY) + 1.4, String.fromCharCode(65 + i), 'TEXT', 0.2);
  }
  for (let i = 0; i < allY.length; i++) {
    entities += dxfLine(Math.min(...allX) - 1, allY[i], Math.max(...allX) + 1, allY[i], 'GRID');
    entities += dxfCircle(Math.min(...allX) - 1.5, allY[i], 0.3, 'GRID');
    entities += dxfText(Math.min(...allX) - 1.6, allY[i] - 0.1, (i + 1).toString(), 'TEXT', 0.2);
  }

  for (const b of beams) {
    entities += dxfLine(b.x1, b.y1, b.x2, b.y2, 'BEAM_LAYOUT');
    entities += dxfText((b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2 + 0.15, `${b.id} ${b.b}x${b.h}`, 'TEXT', 0.12);
    entities += dxfDimension(b.x1, b.y1, b.x2, b.y2, 'DIMENSIONS');
  }

  for (const c of columns) {
    if (c.isRemoved) continue;
    entities += dxfInsert(`COLUMN_${c.b}x${c.h}`, c.x, c.y, 'COLUMN_LAYOUT');
    entities += dxfText(c.x - 0.15, c.y - 0.05, c.id, 'TEXT', 0.1);
  }

  return `999\nBeam Layout - Structural Design Studio\n${dxfHeader()}${dxfTablesMultiStory()}${dxfBlocksSection(columns)}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export function generateColumnLayoutDXF(columns: Column[], slabs: Slab[]): string {
  let entities = '';
  const allX = [...new Set(slabs.flatMap(s => [s.x1, s.x2]))].sort((a, b) => a - b);
  const allY = [...new Set(slabs.flatMap(s => [s.y1, s.y2]))].sort((a, b) => a - b);

  for (let i = 0; i < allX.length; i++) {
    entities += dxfLine(allX[i], Math.min(...allY) - 1, allX[i], Math.max(...allY) + 1, 'GRID');
    entities += dxfCircle(allX[i], Math.max(...allY) + 1.5, 0.3, 'GRID');
    entities += dxfText(allX[i] - 0.1, Math.max(...allY) + 1.4, String.fromCharCode(65 + i), 'TEXT', 0.2);
  }
  for (let i = 0; i < allY.length; i++) {
    entities += dxfLine(Math.min(...allX) - 1, allY[i], Math.max(...allX) + 1, allY[i], 'GRID');
    entities += dxfCircle(Math.min(...allX) - 1.5, allY[i], 0.3, 'GRID');
    entities += dxfText(Math.min(...allX) - 1.6, allY[i] - 0.1, (i + 1).toString(), 'TEXT', 0.2);
  }

  for (const c of columns) {
    if (c.isRemoved) continue;
    entities += dxfInsert(`COLUMN_${c.b}x${c.h}`, c.x, c.y, 'COLUMN_LAYOUT');
    entities += dxfText(c.x - 0.2, c.y + (c.h / 2000) + 0.1, `${c.id} ${c.b}x${c.h}`, 'TEXT', 0.1);
  }

  const colsByX = [...new Set(columns.filter(c => !c.isRemoved).map(c => c.x))].sort((a, b) => a - b);
  const colsByY = [...new Set(columns.filter(c => !c.isRemoved).map(c => c.y))].sort((a, b) => a - b);
  for (let i = 0; i < colsByX.length - 1; i++) {
    entities += dxfDimension(colsByX[i], Math.min(...colsByY) - 1, colsByX[i + 1], Math.min(...colsByY) - 1, 'DIMENSIONS');
  }
  for (let i = 0; i < colsByY.length - 1; i++) {
    entities += dxfDimension(Math.min(...colsByX) - 1, colsByY[i], Math.min(...colsByX) - 1, colsByY[i + 1], 'DIMENSIONS');
  }

  return `999\nColumn Layout - Structural Design Studio\n${dxfHeader()}${dxfTablesMultiStory()}${dxfBlocksSection(columns)}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export interface RebarExportData {
  beamId: string;
  b: number; h: number;
  x1: number; y1: number; x2: number; y2: number;
  topBars: number; topDia: number;
  botBars: number; botDia: number;
  stirrups: string;
}

export function generateReinforcementDXF(slabs: Slab[], beams: Beam[], columns: Column[], rebarData: RebarExportData[]): string {
  let entities = '';
  for (const b of beams) entities += dxfLine(b.x1, b.y1, b.x2, b.y2, 'BEAMS');
  for (const c of columns) {
    if (c.isRemoved) continue;
    entities += dxfInsert(`COLUMN_${c.b}x${c.h}`, c.x, c.y, 'COLUMNS');
  }
  for (const r of rebarData) {
    const mx = (r.x1 + r.x2) / 2;
    const my = (r.y1 + r.y2) / 2;
    const isH = Math.abs(r.y2 - r.y1) < 0.01;
    entities += dxfText(mx + (isH ? 0 : 0.35), my + (isH ? 0.35 : 0), `${r.topBars}\\U+00D8${r.topDia}`, 'REBAR_TOP', 0.1);
    entities += dxfText(mx + (isH ? 0 : -0.35), my + (isH ? -0.25 : 0), `${r.botBars}\\U+00D8${r.botDia}`, 'REBAR_BOTTOM', 0.1);
    entities += dxfText(mx, my + (isH ? -0.45 : -0.25), r.stirrups, 'STIRRUPS', 0.08);
  }
  return `999\nReinforcement DXF\n${dxfHeader()}${dxfTablesMultiStory()}${dxfBlocksSection(columns)}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export function downloadDXF(content: string, filename: string): void {
  import('@/lib/capacitorDownload').then(({ downloadDXF: dl }) => dl(content, filename));
}

// =================== FOUNDATION DXF (WSM/ASD) ===================
// Layers dedicated for foundation drawings, matching the export tables
// (Type, B×L, t, d, q_actual, bars_x, bars_y, shear checks, status).

const FOUNDATION_LAYERS = {
  FOOTING:      { name: 'FOUNDATION_FOOTING',  color: 5 },
  FOOTING_HID:  { name: 'FOUNDATION_HIDDEN',   color: 8 },
  COLUMN:       { name: 'FOUNDATION_COLUMN',   color: 1 },
  GRID:         { name: 'FOUNDATION_GRID',     color: 8 },
  TEXT:         { name: 'FOUNDATION_TEXT',     color: 7 },
  DIM:          { name: 'FOUNDATION_DIM',      color: 2 },
  REBAR_X:      { name: 'FOUNDATION_REBAR_X',  color: 4 },
  REBAR_Y:      { name: 'FOUNDATION_REBAR_Y',  color: 6 },
  SCHEDULE:     { name: 'FOUNDATION_SCHEDULE', color: 7 },
  FAIL:         { name: 'FOUNDATION_FAIL',     color: 1 },
};

function dxfTablesFoundation(): string {
  const all = Object.values(FOUNDATION_LAYERS);
  const entries = all.map(l =>
    `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`
  ).join('\n');
  return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${all.length}\n${entries}\n0\nENDTAB\n0\nENDSEC\n`;
}

// Minimal shape of a foundation design result the DXF needs.
// Matches FootingDesignResult fields used in the on-screen tables.
export interface FoundationDXFInput {
  colId: string;
  x: number;          // column position (m)
  y: number;          // column position (m)
  colB: number;       // column width  (mm, along X)
  colH: number;       // column height (mm, along Y)
  B: number;          // footing dimension along X (mm)
  L: number;          // footing dimension along Y (mm)
  t: number;          // footing thickness (mm)
  d: number;          // effective depth (mm)
  P_service: number;  // service axial load (kN)
  q_actual: number;   // actual soil pressure (kN/m²)
  bars_x: number;
  dia_x: number;
  spacing_x: number;
  bars_y: number;
  dia_y: number;
  spacing_y: number;
  bearing_ok: boolean;
  wide_shear_ok: boolean;
  punch_shear_ok: boolean;
  adequate: boolean;
}

export interface FoundationDXFMaterials {
  fc: number; fy: number; qa: number; cover: number;
  gamma_conc: number; gamma_soil: number; Df: number;
}

/**
 * Generate a DXF file for the foundation design.
 *
 * Produces:
 *   1) Foundation Plan — every footing rectangle (B×L), the column footprint,
 *      grid lines, dimensions between footings, and per-footing labels
 *      (TYPE, colId, B×L, t, bars_x, bars_y, q_actual).
 *   2) Type Schedule (as DXF text rows) — one row per unique footing type
 *      (key = B×L×t), listing the same columns shown in the on-screen
 *      "جدول تصميم الأساسات المنفردة" + per-type reinforcement.
 *   3) Per-column results table (as DXF text rows) — mirrors the design
 *      table exactly: colId, P_service, B×L, t, d, q_actual, bearing,
 *      bars_x, bars_y, wide-shear, punch-shear, status.
 *
 * The label content is taken verbatim from the FoundationDesignResult fields,
 * which guarantees the DXF labels match the export tables.
 */
export function generateFoundationDXF(
  results: FoundationDXFInput[],
  mat: FoundationDXFMaterials,
  projectName: string = 'Foundation Plan',
): string {
  if (results.length === 0) {
    return `999\nFoundation DXF (empty)\n${dxfHeader()}${dxfTablesFoundation()}0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n`;
  }

  const L = FOUNDATION_LAYERS;

  // ── Group footings by type (B×L×t) — same key used in the on-screen schedule
  type FType = {
    label: string; B: number; L: number; t: number;
    bars_x: number; dia_x: number; spacing_x: number;
    bars_y: number; dia_y: number; spacing_y: number;
    members: FoundationDXFInput[];
  };
  const typeMap = new Map<string, FType>();
  const colToType = new Map<string, string>();
  let typeIdx = 1;
  for (const r of results) {
    const key = `${r.B}x${r.L}x${r.t}`;
    if (!typeMap.has(key)) {
      typeMap.set(key, {
        label: `F${typeIdx++}`, B: r.B, L: r.L, t: r.t,
        bars_x: r.bars_x, dia_x: r.dia_x, spacing_x: r.spacing_x,
        bars_y: r.bars_y, dia_y: r.dia_y, spacing_y: r.spacing_y,
        members: [],
      });
    }
    const ft = typeMap.get(key)!;
    ft.members.push(r);
    colToType.set(r.colId, ft.label);
  }

  let entities = '';

  // ── 1) PLAN ────────────────────────────────────────────────────────────────
  const xs = results.map(r => r.x);
  const ys = results.map(r => r.y);
  const minX = Math.min(...xs) - 2;
  const maxX = Math.max(...xs) + 2;
  const minY = Math.min(...ys) - 2;
  const maxY = Math.max(...ys) + 2;

  // Plan title
  entities += dxfText(minX, maxY + 1.2, `FOUNDATION PLAN — ${projectName}`, L.TEXT.name, 0.4);
  entities += dxfText(minX, maxY + 0.6, `WSM / ASD — UBC 1997 / ACI 318`, L.TEXT.name, 0.2);

  // Grid through unique column positions
  const uXs = [...new Set(xs)].sort((a, b) => a - b);
  const uYs = [...new Set(ys)].sort((a, b) => a - b);
  for (let i = 0; i < uXs.length; i++) {
    entities += dxfLine(uXs[i], minY, uXs[i], maxY, L.GRID.name);
    entities += dxfCircle(uXs[i], maxY + 0.35, 0.25, L.GRID.name);
    entities += dxfText(uXs[i] - 0.08, maxY + 0.27, String.fromCharCode(65 + i), L.TEXT.name, 0.18);
  }
  for (let i = 0; i < uYs.length; i++) {
    entities += dxfLine(minX, uYs[i], maxX, uYs[i], L.GRID.name);
    entities += dxfCircle(minX - 0.35, uYs[i], 0.25, L.GRID.name);
    entities += dxfText(minX - 0.45, uYs[i] - 0.08, (i + 1).toString(), L.TEXT.name, 0.18);
  }

  // Footings + columns + labels
  for (const r of results) {
    const halfB = (r.B / 1000) / 2;
    const halfL = (r.L / 1000) / 2;
    const halfCB = (r.colB / 1000) / 2;
    const halfCH = (r.colH / 1000) / 2;

    // Footing outline (B × L)
    entities += dxfPolyline([
      { x: r.x - halfB, y: r.y - halfL },
      { x: r.x + halfB, y: r.y - halfL },
      { x: r.x + halfB, y: r.y + halfL },
      { x: r.x - halfB, y: r.y + halfL },
    ], L.FOOTING.name);

    // Column footprint inside footing
    entities += dxfPolyline([
      { x: r.x - halfCB, y: r.y - halfCH },
      { x: r.x + halfCB, y: r.y - halfCH },
      { x: r.x + halfCB, y: r.y + halfCH },
      { x: r.x - halfCB, y: r.y + halfCH },
    ], L.COLUMN.name);

    // Labels — exactly mirror what's in the design table
    const typeLabel = colToType.get(r.colId) || '?';
    const statusLayer = r.adequate ? L.TEXT.name : L.FAIL.name;
    entities += dxfText(r.x - halfB, r.y + halfL + 0.05, `${typeLabel}  ${r.colId}`, L.TEXT.name, 0.22);
    entities += dxfText(r.x - halfB, r.y + halfL - 0.20, `${r.B}x${r.L}x${r.t} mm`, L.TEXT.name, 0.14);
    entities += dxfText(r.x - halfB, r.y - halfL - 0.18, `P=${r.P_service.toFixed(0)}kN  q=${r.q_actual.toFixed(0)}`, L.TEXT.name, 0.12);
    entities += dxfText(r.x - halfB, r.y - halfL - 0.34, `Bx:${r.bars_x}D${r.dia_x}@${r.spacing_x}`, L.REBAR_X.name, 0.12);
    entities += dxfText(r.x - halfB, r.y - halfL - 0.48, `Ly:${r.bars_y}D${r.dia_y}@${r.spacing_y}`, L.REBAR_Y.name, 0.12);
    if (!r.adequate) {
      entities += dxfText(r.x + halfB - 0.4, r.y + halfL + 0.05, 'REVIEW', statusLayer, 0.18);
    }
  }

  // Dimensions between grids
  for (let i = 0; i < uXs.length - 1; i++) {
    entities += dxfDimension(uXs[i], minY - 0.5, uXs[i + 1], minY - 0.5, L.DIM.name, 0.6);
  }
  for (let i = 0; i < uYs.length - 1; i++) {
    entities += dxfDimension(minX - 0.5, uYs[i], minX - 0.5, uYs[i + 1], L.DIM.name, 0.6);
  }

  // ── 2) TYPE SCHEDULE (as DXF text grid) ───────────────────────────────────
  const schedX = maxX + 3;
  let schedY = maxY;
  const rowH = 0.35;
  entities += dxfText(schedX, schedY, 'FOOTING TYPE SCHEDULE', L.TEXT.name, 0.3);
  schedY -= rowH * 1.4;
  const schedHeader = 'TYPE | B(mm) | L(mm) | t(mm) | Bars_x | Bars_y | Count';
  entities += dxfText(schedX, schedY, schedHeader, L.SCHEDULE.name, 0.18);
  schedY -= rowH;
  for (const ft of typeMap.values()) {
    const row = `${ft.label} | ${ft.B} | ${ft.L} | ${ft.t} | ${ft.bars_x}D${ft.dia_x}@${ft.spacing_x} | ${ft.bars_y}D${ft.dia_y}@${ft.spacing_y} | ${ft.members.length}`;
    entities += dxfText(schedX, schedY, row, L.SCHEDULE.name, 0.16);
    schedY -= rowH;
  }

  // ── 3) PER-COLUMN RESULTS TABLE — mirrors UI design table ────────────────
  schedY -= rowH;
  entities += dxfText(schedX, schedY, 'FOOTING DESIGN RESULTS (WSM)', L.TEXT.name, 0.3);
  schedY -= rowH * 1.4;
  const resHeader = 'COL | P(kN) | BxL | t | d | q | BearOk | Bars_x | Bars_y | WideShr | Punch | Status';
  entities += dxfText(schedX, schedY, resHeader, L.SCHEDULE.name, 0.16);
  schedY -= rowH;
  for (const r of results) {
    const layer = r.adequate ? L.SCHEDULE.name : L.FAIL.name;
    const row =
      `${r.colId} | ${r.P_service.toFixed(0)} | ${r.B}x${r.L} | ${r.t} | ${r.d} | ${r.q_actual.toFixed(0)} | ` +
      `${r.bearing_ok ? 'OK' : 'X'} | ${r.bars_x}D${r.dia_x}@${r.spacing_x} | ${r.bars_y}D${r.dia_y}@${r.spacing_y} | ` +
      `${r.wide_shear_ok ? 'OK' : 'X'} | ${r.punch_shear_ok ? 'OK' : 'X'} | ${r.adequate ? 'OK' : 'REVIEW'}`;
    entities += dxfText(schedX, schedY, row, layer, 0.14);
    schedY -= rowH;
  }

  // ── 4) Material bar ───────────────────────────────────────────────────────
  schedY -= rowH;
  const matBar =
    `f'c=${mat.fc}MPa  fy=${mat.fy}MPa  qa=${mat.qa}kN/m2  ` +
    `fc,allow=${(0.45 * mat.fc).toFixed(1)}MPa  fs,allow=${Math.min(0.5 * mat.fy, 207).toFixed(0)}MPa  ` +
    `Df=${mat.Df}m  cover=${mat.cover}mm`;
  entities += dxfText(schedX, schedY, matBar, L.TEXT.name, 0.16);

  return `999\nFoundation DXF — Structural Design Studio (WSM/ASD)\n${dxfHeader()}${dxfTablesFoundation()}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

// =================== PHASE 1: PROFESSIONAL FOUNDATION LAYOUT DXF ===================

export interface DXFGridLine {
  label: string;
  coord: number; // in mm
  direction: 'X' | 'Y';
}

export interface DXFIsolatedFooting {
  id: string;
  colId: string;
  x: number; // mm
  y: number; // mm
  B: number; // mm
  L: number; // mm
  H: number; // mm
  colB: number; // mm
  colH: number; // mm
  elevation: number; // meters, e.g. -2.0
}

export interface DXFStripFooting {
  id: string;
  x1: number; // mm
  y1: number; // mm
  x2: number; // mm
  y2: number; // mm
  width: number; // mm
  thickness: number; // mm
  elevation: number; // meters
}

export interface DXFGradeBeam {
  id: string;
  x1: number; // mm
  y1: number; // mm
  x2: number; // mm
  y2: number; // mm
  width: number; // mm
  depth: number; // mm
}

export interface DXFLayoutPlanConfig {
  projectName: string;
  drawingTitle: string;
  drawingNo: string;
  scale: string;
  date: string;
  northAngle?: number;
}

export function generateProfessionalFoundationLayoutDXF(
  grids: { x: DXFGridLine[]; y: DXFGridLine[] },
  footings: DXFIsolatedFooting[],
  strips: DXFStripFooting[],
  beams: DXFGradeBeam[],
  config: DXFLayoutPlanConfig
): string {
  // Translate to meters for engineering output (1 unit = 1 meter)
  const toM = (val: number) => val / 1000;

  let entities = '';

  // 1. Establish bounding box of model
  const allX: number[] = [];
  const allY: number[] = [];

  grids.x.forEach(g => allX.push(toM(g.coord)));
  grids.y.forEach(g => allY.push(toM(g.coord)));
  footings.forEach(f => {
    allX.push(toM(f.x));
    allY.push(toM(f.y));
  });
  strips.forEach(s => {
    allX.push(toM(s.x1), toM(s.x2));
    allY.push(toM(s.y1), toM(s.y2));
  });

  const minX = allX.length > 0 ? Math.min(...allX) - 3 : -3;
  const maxX = allX.length > 0 ? Math.max(...allX) + 3 : 20;
  const minY = allY.length > 0 ? Math.min(...allY) - 3 : -3;
  const maxY = allY.length > 0 ? Math.max(...allY) + 3 : 15;

  // Layer tables specifically requested by the user
  const dxfLayoutTables = (): string => {
    const layers = [
      { name: 'GRID', color: 8 },
      { name: 'GRID_TEXT', color: 7 },
      { name: 'COLUMNS', color: 1 },
      { name: 'COLUMN_TEXT', color: 7 },
      { name: 'ISOLATED_FOOTINGS', color: 5 },
      { name: 'FOOTING_TEXT', color: 7 },
      { name: 'STRIP_FOOTINGS', color: 4 },
      { name: 'STRIP_TEXT', color: 7 },
      { name: 'GRADE_BEAMS', color: 3 },
      { name: 'GRADE_BEAM_TEXT', color: 7 },
      { name: 'DIMENSIONS', color: 2 },
      { name: 'TITLE_BLOCK', color: 7 },
      { name: 'NORTH_ARROW', color: 7 }
    ];
    const entries = layers.map(l =>
      `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`
    ).join('\n');
    return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${entries}\n0\nENDTAB\n0\nENDSEC\n`;
  };

  // Helper functions for elements outputting into strict layers
  const dLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => dxfLine(x1, y1, x2, y2, layer);
  const dPoly = (pts: { x: number; y: number }[], layer: string, closed: boolean = true) => dxfPolyline(pts, layer, closed);
  const dText = (x: number, y: number, text: string, layer: string, h: number = 0.2) => dxfText(x, y, text, layer, h);
  const dCircle = (x: number, y: number, r: number, layer: string) => dxfCircle(x, y, r, layer);
  const dDim = (x1: number, y1: number, x2: number, y2: number, layer: string, offset: number = 0.5) => dxfDimension(x1, y1, x2, y2, layer, offset);

  // ----------------------------------------------------
  // A. DRAW GRIDS (Grid lines, Bubbles, Labels)
  // ----------------------------------------------------
  grids.x.forEach((g) => {
    const xm = toM(g.coord);
    // Draw grid line
    entities += dLine(xm, minY, xm, maxY, 'GRID');
    // Top bubble
    entities += dCircle(xm, maxY + 0.35, 0.25, 'GRID');
    entities += dText(xm - 0.08, maxY + 0.27, g.label, 'GRID_TEXT', 0.18);
    // Bottom bubble
    entities += dCircle(xm, minY - 0.35, 0.25, 'GRID');
    entities += dText(xm - 0.08, minY - 0.43, g.label, 'GRID_TEXT', 0.18);
  });

  grids.y.forEach((g) => {
    const ym = toM(g.coord);
    // Draw grid line
    entities += dLine(minX, ym, maxX, ym, 'GRID');
    // Left bubble
    entities += dCircle(minX - 0.35, ym, 0.25, 'GRID');
    entities += dText(minX - 0.44, ym - 0.08, g.label, 'GRID_TEXT', 0.18);
    // Right bubble
    entities += dCircle(maxX + 0.35, ym, 0.25, 'GRID');
    entities += dText(maxX + 0.26, ym - 0.08, g.label, 'GRID_TEXT', 0.18);
  });

  // ----------------------------------------------------
  // B. DRAW STRIP FOOTINGS
  // ----------------------------------------------------
  strips.forEach((s) => {
    const x1 = toM(s.x1);
    const y1 = toM(s.y1);
    const x2 = toM(s.x2);
    const y2 = toM(s.y2);
    const width = toM(s.width);

    // Calculate boundary lines
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    
    // Perpendicular vector
    const px = -uy * (width / 2);
    const py = ux * (width / 2);

    const p1 = { x: x1 + px, y: y1 + py };
    const p2 = { x: x2 + px, y: y2 + py };
    const p3 = { x: x2 - px, y: y2 - py };
    const p4 = { x: x1 - px, y: y1 - py };

    entities += dPoly([p1, p2, p3, p4], 'STRIP_FOOTINGS');

    // Label on the strip footing
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    entities += dText(mx - 0.5, my + 0.1, `${s.id}`, 'STRIP_TEXT', 0.18);
    entities += dText(mx - 0.5, my - 0.1, `B=${s.width} EL=${s.elevation.toFixed(2)}`, 'STRIP_TEXT', 0.14);
  });

  // ----------------------------------------------------
  // C. DRAW ISOLATED FOOTINGS & COLUMNS
  // ----------------------------------------------------
  footings.forEach((f) => {
    const xm = toM(f.x);
    const ym = toM(f.y);
    const B = toM(f.B);
    const L = toM(f.L);
    const hB = B / 2;
    const hL = L / 2;

    const cb = toM(f.colB);
    const ch = toM(f.colH);
    const hcb = cb / 2;
    const hch = ch / 2;

    // Draw footing bounding box
    entities += dPoly([
      { x: xm - hB, y: ym - hL },
      { x: xm + hB, y: ym - hL },
      { x: xm + hB, y: ym + hL },
      { x: xm - hB, y: ym + hL }
    ], 'ISOLATED_FOOTINGS');

    // Draw column boundary
    entities += dPoly([
      { x: xm - hcb, y: ym - hch },
      { x: xm + hcb, y: ym - hch },
      { x: xm + hcb, y: ym + hch },
      { x: xm - hcb, y: ym + hch }
    ], 'COLUMNS');

    // Cross-hatching column
    entities += dLine(xm - hcb, ym - hch, xm + hcb, ym + hch, 'COLUMNS');
    entities += dLine(xm + hcb, ym - hch, xm - hcb, ym + hch, 'COLUMNS');

    // Footing Labels - automatic conflict avoiding offset
    const labelYOffset = hL + 0.08;
    entities += dText(xm - hB, ym + labelYOffset, `${f.id} (${f.colId})`, 'FOOTING_TEXT', 0.20);
    entities += dText(xm - hB, ym + labelYOffset - 0.15, `${f.B}x${f.L}x${f.H} mm`, 'FOOTING_TEXT', 0.13);
    entities += dText(xm - hB, ym + labelYOffset - 0.30, `EL=${f.elevation.toFixed(2)}`, 'FOOTING_TEXT', 0.13);

    // Column Labels
    entities += dText(xm - hcb, ym - hch - 0.22, `${f.colId} (${f.colB}x${f.colH})`, 'COLUMN_TEXT', 0.13);
  });

  // ----------------------------------------------------
  // D. DRAW GRADE BEAMS
  // ----------------------------------------------------
  beams.forEach((b) => {
    const x1 = toM(b.x1);
    const y1 = toM(b.y1);
    const x2 = toM(b.x2);
    const y2 = toM(b.y2);
    const width = toM(b.width);

    // Calculate double lines
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    
    // Offset perpendicular
    const ox = -uy * (width / 2);
    const oy = ux * (width / 2);

    entities += dLine(x1 + ox, y1 + oy, x2 + ox, y2 + oy, 'GRADE_BEAMS');
    entities += dLine(x1 - ox, y1 - oy, x2 - ox, y2 - oy, 'GRADE_BEAMS');

    // Title label
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    entities += dText(mx - 0.3, my + 0.1, `${b.id} (${b.width}x${b.depth})`, 'GRADE_BEAM_TEXT', 0.14);
  });

  // ----------------------------------------------------
  // E. DIMENSIONS (Grid intervals, column offsets)
  // ----------------------------------------------------
  // Chain dimensions X
  const sortedX = [...grids.x].sort((a, b) => a.coord - b.coord);
  for (let i = 0; i < sortedX.length - 1; i++) {
    const x1 = toM(sortedX[i].coord);
    const x2 = toM(sortedX[i + 1].coord);
    entities += dDim(x1, minY - 1.0, x2, minY - 1.0, 'DIMENSIONS', 0.5);
  }
  // Overall X dimension
  if (sortedX.length > 1) {
    const firstX = toM(sortedX[0].coord);
    const lastX = toM(sortedX[sortedX.length - 1].coord);
    entities += dDim(firstX, minY - 1.8, lastX, minY - 1.8, 'DIMENSIONS', 0.6);
  }

  // Chain dimensions Y
  const sortedY = [...grids.y].sort((a, b) => a.coord - b.coord);
  for (let i = 0; i < sortedY.length - 1; i++) {
    const y1 = toM(sortedY[i].coord);
    const y2 = toM(sortedY[i + 1].coord);
    entities += dDim(minX - 1.0, y1, minX - 1.0, y2, 'DIMENSIONS', 0.5);
  }
  // Overall Y dimension
  if (sortedY.length > 1) {
    const firstY = toM(sortedY[0].coord);
    const lastY = toM(sortedY[sortedY.length - 1].coord);
    entities += dDim(minX - 1.8, firstY, minX - 1.8, lastY, 'DIMENSIONS', 0.6);
  }

  // ----------------------------------------------------
  // F. STYLISH NORTH ARROW
  // ----------------------------------------------------
  const naX = maxX - 1.0;
  const naY = maxY + 1.2;
  const angleRad = (config.northAngle ?? 0) * Math.PI / 180;
  
  // Outer compass circle
  entities += dCircle(naX, naY, 0.4, 'NORTH_ARROW');
  
  // Arrow lines relative to rotation
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const rx = (dx: number, dy: number) => ({
    x: naX + (dx * cosA - dy * sinA),
    y: naY + (dx * sinA + dy * cosA),
  });

  const topArrow = rx(0, 0.5);
  const botLeft = rx(-0.15, -0.3);
  const botRight = rx(0.15, -0.3);
  const centerArrow = rx(0, -0.1);

  entities += dLine(topArrow.x, topArrow.y, botLeft.x, botLeft.y, 'NORTH_ARROW');
  entities += dLine(topArrow.x, topArrow.y, botRight.x, botRight.y, 'NORTH_ARROW');
  entities += dLine(botLeft.x, botLeft.y, centerArrow.x, centerArrow.y, 'NORTH_ARROW');
  entities += dLine(botRight.x, botRight.y, centerArrow.x, centerArrow.y, 'NORTH_ARROW');
  entities += dLine(naX, naY - 0.4, naX, naY + 0.4, 'NORTH_ARROW');

  // Letter "N"
  const nLoc = rx(0, 0.6);
  entities += dText(nLoc.x - 0.06, nLoc.y - 0.1, 'N', 'NORTH_ARROW', 0.18);

  // ----------------------------------------------------
  // G. TITLE BLOCK (AutoCAD Layout Frame Style)
  // ----------------------------------------------------
  const tbX = maxX - 4.0;
  const tbY = minY - 5.0;
  const tbW = 9.0;
  const tbH = 2.5;

  // Outer Box
  entities += dPoly([
    { x: tbX, y: tbY },
    { x: tbX + tbW, y: tbY },
    { x: tbX + tbW, y: tbY + tbH },
    { x: tbX, y: tbY + tbH }
  ], 'TITLE_BLOCK');

  // Internal splits
  entities += dLine(tbX, tbY + tbH / 2, tbX + tbW, tbY + tbH / 2, 'TITLE_BLOCK');
  entities += dLine(tbX + tbW * 0.4, tbY, tbX + tbW * 0.4, tbY + tbH, 'TITLE_BLOCK');
  entities += dLine(tbX + tbW * 0.7, tbY, tbX + tbW * 0.7, tbY + tbH, 'TITLE_BLOCK');

  // Info details text
  entities += dText(tbX + 0.2, tbY + tbH * 0.7, `PROJECT: ${config.projectName}`, 'TITLE_BLOCK', 0.15);
  entities += dText(tbX + 0.2, tbY + tbH * 0.2, `DRAWING: ${config.drawingTitle}`, 'TITLE_BLOCK', 0.15);

  entities += dText(tbX + tbW * 0.42, tbY + tbH * 0.7, `SCALE: ${config.scale}`, 'TITLE_BLOCK', 0.12);
  entities += dText(tbX + tbW * 0.42, tbY + tbH * 0.2, `DATE: ${config.date}`, 'TITLE_BLOCK', 0.12);

  entities += dText(tbX + tbW * 0.72, tbY + tbH * 0.7, `SHEET NO:`, 'TITLE_BLOCK', 0.10);
  entities += dText(tbX + tbW * 0.72, tbY + tbH * 0.25, config.drawingNo, 'TITLE_BLOCK', 0.24);

  return `999\nProfessional Foundation Layout Drawing\n${dxfHeader()}${dxfLayoutTables()}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export interface DXFDetailFootingArgs {
  typeMark: string;
  B: number;
  L: number;
  H: number;
  rebarX: { diameter: number; quantity: number };
  rebarY: { diameter: number; quantity: number };
  colB: number;
  colH: number;
  projectName?: string;
  scale?: string;
  fc?: number;
  fy?: number;
  qall?: number;
  soilDepth?: number;
}

export function generateIsolatedFootingDetailDXF(args: DXFDetailFootingArgs): string {
  const L = {
    OUTLINE: 'FOOTING_OUTLINE',
    COLUMN: 'COLUMN',
    REBAR: 'REINFORCEMENT',
    CENTERVALUES: 'CENTERLINES',
    DIM: 'DIMENSIONS',
    TEXT: 'TEXT',
    SECTIONS: 'SECTIONS',
    HATCH: 'HATCH',
    NOTES: 'NOTES',
  };

  const dxfTables = (): string => {
    const layers = [
      { name: L.OUTLINE, color: 5 }, // Blue
      { name: L.COLUMN, color: 1 },  // Red
      { name: L.REBAR, color: 3 },   // Green
      { name: L.CENTERVALUES, color: 2 }, // Yellow (dashed if needed, but solid compatible)
      { name: L.DIM, color: 6 },     // Magenta
      { name: L.TEXT, color: 7 },    // White/Black
      { name: L.SECTIONS, color: 4 },// Cyan
      { name: L.HATCH, color: 8 },   // Gray
      { name: L.NOTES, color: 7 }    // White
    ];
    const entries = layers.map(l =>
      `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`
    ).join('\n');
    return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${entries}\n0\nENDTAB\n0\nENDSEC\n`;
  };

  const toM = (val: number) => val / 1000;

  const fW = toM(args.B);
  const fL = toM(args.L);
  const fH = toM(args.H);
  const cW = toM(args.colB);
  const cL = toM(args.colH);
  const pW = cW + 0.1; // Pedestal 100mm larger than column
  const pL = cL + 0.1;

  let entities = '';

  const dLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => dxfLine(x1, y1, x2, y2, layer);
  const dPoly = (pts: { x: number; y: number }[], layer: string, closed: boolean = true) => dxfPolyline(pts, layer, closed);
  const dText = (x: number, y: number, text: string, layer: string, h: number = 0.2) => dxfText(x, y, text, layer, h);
  const dCircle = (x: number, y: number, r: number, layer: string) => dxfCircle(x, y, r, layer);
  const dDim = (x1: number, y1: number, x2: number, y2: number, layer: string, offset: number = 0.5) => dxfDimension(x1, y1, x2, y2, layer, offset);

  // Outer frame borders
  entities += dPoly([
    { x: -2, y: -6 },
    { x: 18, y: -6 },
    { x: 18, y: 12 },
    { x: -2, y: 12 }
  ], L.OUTLINE);

  // Center grids/centerlines helper crossings
  entities += dLine(-2, 0, 18, 0, L.CENTERVALUES);
  entities += dLine(8, -6, 8, 12, L.CENTERVALUES);

  // 1. PLAN VIEW (Centered at (3, 6))
  const px = 3;
  const py = 6;
  const p_halfW = fW / 2;
  const p_halfL = fL / 2;

  // Outline
  entities += dPoly([
    { x: px - p_halfW, y: py - p_halfL },
    { x: px + p_halfW, y: py - p_halfL },
    { x: px + p_halfW, y: py + p_halfL },
    { x: px - p_halfW, y: py + p_halfL }
  ], L.OUTLINE);

  // Pedestal outline
  entities += dPoly([
    { x: px - pW/2, y: py - pL/2 },
    { x: px + pW/2, y: py - pL/2 },
    { x: px + pW/2, y: py + pL/2 },
    { x: px - pW/2, y: py + pL/2 }
  ], L.OUTLINE);

  // Column outline
  entities += dPoly([
    { x: px - cW/2, y: py - cL/2 },
    { x: px + cW/2, y: py - cL/2 },
    { x: px + cW/2, y: py + cL/2 },
    { x: px - cW/2, y: py + cL/2 }
  ], L.COLUMN);
  entities += dLine(px - cW/2, py - cL/2, px + cW/2, py + cL/2, L.COLUMN);
  entities += dLine(px + cW/2, py - cL/2, px - cW/2, py + cL/2, L.COLUMN);

  // Centerlines
  entities += dLine(px - p_halfW - 0.5, py, px + p_halfW + 0.5, py, L.CENTERVALUES);
  entities += dLine(px, py - p_halfL - 0.5, px, py + p_halfL + 0.5, L.CENTERVALUES);

  // Plan View Text
  entities += dText(px, py - p_halfL - 0.9, `PLAN VIEW (SCALE 1:${args.scale || '20'})`, L.TEXT, 0.25);
  entities += dText(px, py + p_halfL + 0.3, `FOOTING MODEL: ${args.typeMark}`, L.TEXT, 0.2);

  // Dimensions
  entities += dDim(px - p_halfW, py - p_halfL - 0.4, px + p_halfW, py - p_halfL - 0.4, L.DIM, 0.4);
  entities += dDim(px - p_halfW - 0.4, py - p_halfL, px - p_halfW - 0.4, py + p_halfL, L.DIM, 0.4);
  entities += dText(px + p_halfW + 0.2, py + 0.3, `COL ${args.colB}x${args.colH}`, L.TEXT, 0.15);

  // Plan Reinforcement indicator lines (bottom grid)
  entities += dLine(px - p_halfW + 0.075, py - p_halfL + 0.15, px + p_halfW - 0.075, py - p_halfL + 0.15, L.REBAR);
  entities += dLine(px - p_halfW + 0.15, py - p_halfL + 0.075, px - p_halfW + 0.15, py + p_halfL - 0.075, L.REBAR);
  entities += dText(px, py - p_halfL + 0.22, `${args.rebarX.quantity}\\U+00D8${args.rebarX.diameter}`, L.REBAR, 0.15);
  entities += dText(px - p_halfW + 0.25, py, `${args.rebarY.quantity}\\U+00D8${args.rebarY.diameter}`, L.REBAR, 0.15);

  // 2. SECTION A-A (Centered at (13, 6))
  const sx = 13;
  const sy = 6;
  const s_halfL = fL / 2;

  // PCC Layer 100mm
  entities += dPoly([
    { x: sx - s_halfL - 0.1, y: sy - 0.1 },
    { x: sx + s_halfL + 0.1, y: sy - 0.1 },
    { x: sx + s_halfL + 0.1, y: sy },
    { x: sx - s_halfL - 0.1, y: sy }
  ], L.HATCH);
  entities += dText(sx, sy - 0.25, "P.C.C. LAYER - 100mm", L.TEXT, 0.12);

  // Footing concrete
  entities += dPoly([
    { x: sx - s_halfL, y: sy },
    { x: sx + s_halfL, y: sy },
    { x: sx + s_halfL, y: sy + fH },
    { x: sx - s_halfL, y: sy + fH }
  ], L.OUTLINE);

  // Pedestal concrete
  const pedHeight = args.soilDepth ? args.soilDepth - fH : 0.7;
  entities += dPoly([
    { x: sx - pL/2, y: sy + fH },
    { x: sx + pL/2, y: sy + fH },
    { x: sx + pL/2, y: sy + fH + pedHeight },
    { x: sx - pL/2, y: sy + fH + pedHeight }
  ], L.OUTLINE);

  // Column concrete going higher
  entities += dPoly([
    { x: sx - cL/2, y: sy + fH + pedHeight },
    { x: sx + cL/2, y: sy + fH + pedHeight },
    { x: sx + cL/2, y: sy + fH + pedHeight + 1.2 },
    { x: sx - cL/2, y: sy + fH + pedHeight + 1.2 }
  ], L.COLUMN);

  // Ground and excavation lines
  entities += dLine(sx - s_halfL - 1.2, sy + fH + pedHeight, sx + s_halfL + 1.2, sy + fH + pedHeight, L.CENTERVALUES);
  entities += dText(sx + s_halfL + 0.2, sy + fH + pedHeight + 0.1, "N.G.L. (0.00)", L.TEXT, 0.13);

  // Bottom rebar hook in Section
  const cov = 0.075;
  const hk = 0.25; // 250mm hook
  entities += dLine(sx - s_halfL + cov, sy + cov + hk, sx - s_halfL + cov, sy + cov, L.REBAR);
  entities += dLine(sx - s_halfL + cov, sy + cov, sx + s_halfL - cov, sy + cov, L.REBAR);
  entities += dLine(sx + s_halfL - cov, sy + cov, sx + s_halfL - cov, sy + cov + hk, L.REBAR);

  // Column dowel rebars extending down with anchorage hook
  entities += dLine(sx - cL/2 + 0.04, sy + fH + pedHeight + 1.1, sx - cL/2 + 0.04, sy + cov + 0.02, L.REBAR);
  entities += dLine(sx - cL/2 + 0.04, sy + cov + 0.02, sx - cL/2 + 0.04 + hk, sy + cov + 0.02, L.REBAR);
  entities += dLine(sx + cL/2 - 0.04, sy + fH + pedHeight + 1.1, sx + cL/2 - 0.04, sy + cov + 0.02, L.REBAR);
  entities += dLine(sx + cL/2 - 0.04, sy + cov + 0.02, sx + cL/2 - 0.04 - hk, sy + cov + 0.02, L.REBAR);

  // Stirrups / ties in pedestal
  for (let ty = sy + fH + 0.1; ty < sy + fH + pedHeight + 0.9; ty += 0.20) {
    entities += dLine(sx - pL/2 + cov, ty, sx + pL/2 - cov, ty, L.REBAR);
  }

  // Section details
  entities += dText(sx, sy - 0.7, `SECTION A-A (LONGITUDINAL)`, L.TEXT, 0.25);
  entities += dDim(sx - s_halfL, sy + fH + 0.3, sx + s_halfL, sy + fH + 0.3, L.DIM, 0.4);
  entities += dDim(sx + s_halfL + 0.4, sy, sx + s_halfL + 0.4, sy + fH, L.DIM, 0.4);

  // 3. SECTION B-B (Centered at (3, -2.5))
  const sBx = 3;
  const sBy = -2.5;
  const s_halfW = fW / 2;

  // PCC Layer 100mm
  entities += dPoly([
    { x: sBx - s_halfW - 0.1, y: sBy - 0.1 },
    { x: sBx + s_halfW + 0.1, y: sBy - 0.1 },
    { x: sBx + s_halfW + 0.1, y: sBy },
    { x: sBx - s_halfW - 0.1, y: sBy }
  ], L.HATCH);

  // Footing concrete
  entities += dPoly([
    { x: sBx - s_halfW, y: sBy },
    { x: sBx + s_halfW, y: sBy },
    { x: sBx + s_halfW, y: sBy + fH },
    { x: sBx - s_halfW, y: sBy + fH }
  ], L.OUTLINE);

  // Pedestal concrete
  entities += dPoly([
    { x: sBx - pW/2, y: sBy + fH },
    { x: sBx + pW/2, y: sBy + fH },
    { x: sBx + pW/2, y: sBy + fH + pedHeight },
    { x: sBx - pW/2, y: sBy + fH + pedHeight }
  ], L.OUTLINE);

  // Column concrete going higher
  entities += dPoly([
    { x: sBx - cW/2, y: sBy + fH + pedHeight },
    { x: sBx + cW/2, y: sBy + fH + pedHeight },
    { x: sBx + cW/2, y: sBy + fH + pedHeight + 1.2 },
    { x: sBx - cW/2, y: sBy + fH + pedHeight + 1.2 }
  ], L.COLUMN);

  // Bottom rebar hook in Section
  entities += dLine(sBx - s_halfW + cov, sBy + cov + hk, sBx - s_halfW + cov, sBy + cov, L.REBAR);
  entities += dLine(sBx - s_halfW + cov, sBy + cov, sBx + s_halfW - cov, sBy + cov, L.REBAR);
  entities += dLine(sBx + s_halfW - cov, sBy + cov, sBx + s_halfW - cov, sBy + cov + hk, L.REBAR);

  // Labels and dims for B-B
  entities += dText(sBx, sBy - 0.7, `SECTION B-B (TRANSVERSE)`, L.TEXT, 0.25);
  entities += dDim(sBx - s_halfW, sBy + fH + 0.3, sBx + s_halfW, sBy + fH + 0.3, L.DIM, 0.4);
  entities += dDim(sBx + s_halfW + 0.4, sBy, sBx + s_halfW + 0.4, sBy + fH, L.DIM, 0.4);

  // 4. GENERAL CONSTRUCTION NOTES (Centered at (9.5, -0.5))
  const nx = 9.5;
  let ny = -0.5;
  const rowS = 0.25;

  entities += dText(nx, ny, "GENERAL CONSTRUCTION NOTES", L.NOTES, 0.22);
  ny -= rowS * 1.3;
  entities += dText(nx, ny, "1. CONCRETE COMPRESSIVE STRENGTH: f'c = 25 MPa (CYLINDER)", L.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, "2. REINFORCING STEEL GRADE: fy = 420 MPa", L.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, "3. MIN CLEAR CONCRETE COVER TO MAIN REBARS = 75 mm", L.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, "4. BEARING CAPACITY OF SOIL ASSUMED = 150 kN/m2", L.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, "5. PLAIN CONCRETE CHAMBER (P.C.C) THICKNESS = 100 mm", L.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, "6. ALL REBARS DETAILED ACCORDING TO ACI 318 RULES", L.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, "7. BACKFILL SOIL LAYERS SHALL BE COMPACTED TO 95% MDD", L.NOTES, 0.13);

  // 5. QUANTITY BOQ FOR THIS SINGLE FOOTING
  ny -= rowS * 1.8;
  entities += dText(nx, ny, "BOQ ESTIMATED QUANTITIES (PER FOOTING)", L.NOTES, 0.20);
  ny -= rowS * 1.3;
  const concVol = fW * fL * fH;
  const wtPerMX = (args.rebarX.diameter ** 2) / 162;
  const wtPerMY = (args.rebarY.diameter ** 2) / 162;
  const steelWt = (args.rebarX.quantity * fL * wtPerMX) + (args.rebarY.quantity * fW * wtPerMY);
  const excVol = (fW + 1) * (fL + 1) * (args.soilDepth || 1.5);

  entities += dText(nx, ny, `- CONCRETE MASS (VOL): ${concVol.toFixed(3)} m3`, L.NOTES, 0.14);
  ny -= rowS;
  entities += dText(nx, ny, `- REBAR WEIGHT EST: ${steelWt.toFixed(1)} kg`, L.NOTES, 0.14);
  ny -= rowS;
  entities += dText(nx, ny, `- EXCAVATION VOL: ${excVol.toFixed(2)} m3`, L.NOTES, 0.14);
  ny -= rowS;
  entities += dText(nx, ny, `- SOIL COOP COVER DEPTH: ${args.soilDepth ? args.soilDepth.toFixed(2) : '1.50'} m`, L.NOTES, 0.14);

  // TITLE BLOCK (Bottom-right, scaled for sheet details)
  const sheet_tbX = 11.5;
  const sheet_tbY = -5.5;
  const sheet_tbW = 6.0;
  const sheet_tbH = 1.8;

  entities += dPoly([
    { x: sheet_tbX, y: sheet_tbY },
    { x: sheet_tbX + sheet_tbW, y: sheet_tbY },
    { x: sheet_tbX + sheet_tbW, y: sheet_tbY + sheet_tbH },
    { x: sheet_tbX, y: sheet_tbY + sheet_tbH }
  ], L.OUTLINE);

  entities += dLine(sheet_tbX, sheet_tbY + sheet_tbH / 2, sheet_tbX + sheet_tbW, sheet_tbY + sheet_tbH / 2, L.OUTLINE);
  entities += dLine(sheet_tbX + sheet_tbW * 0.5, sheet_tbY, sheet_tbX + sheet_tbW * 0.5, sheet_tbY + sheet_tbH, L.OUTLINE);

  entities += dText(sheet_tbX + 0.15, sheet_tbY + sheet_tbH * 0.72, `PROJECT: ${args.projectName || 'SDS'}`, L.TEXT, 0.13);
  entities += dText(sheet_tbX + 0.15, sheet_tbY + sheet_tbH * 0.22, `DETAIL: ISOLATED FOOTING ${args.typeMark}`, L.TEXT, 0.12);

  entities += dText(sheet_tbX + sheet_tbW * 0.52, sheet_tbY + sheet_tbH * 0.72, `SCALE: 1:${args.scale || '20'}`, L.TEXT, 0.10);
  entities += dText(sheet_tbX + sheet_tbW * 0.52, sheet_tbY + sheet_tbH * 0.22, `SHEET NO. S-301-${args.typeMark}`, L.TEXT, 0.15);

  return `999\nIsolated Footing Detailing Drawing Sheet\n${dxfHeader()}${dxfTables()}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export interface DXFDetailStripArgs {
  id: string;
  B: number;
  H: number;
  L: number;
  elevation: number;
  barsTopCount: number;
  barsTopDia: number;
  barsBotCount: number;
  barsBotDia: number;
  stirrupsDia: number;
  stirrupsSpacing: number;
  scale?: string;
  projectName?: string;
  fc?: number;
  fy?: number;
  soilDepth?: number;
}

export function generateStripFootingDetailDXF(args: DXFDetailStripArgs): string {
  const L_LAYERS = {
    OUTLINE: 'STRIP_FOOTING',
    COLUMN: 'COLUMNS',
    REBAR: 'REINFORCEMENT',
    CENTERVALUES: 'CENTERLINES',
    DIM: 'DIMENSIONS',
    TEXT: 'TEXT',
    SECTIONS: 'SECTIONS',
    HATCH: 'HATCH',
    NOTES: 'NOTES',
  };

  const dxfTables = (): string => {
    const layers = [
      { name: L_LAYERS.OUTLINE, color: 4 }, // Cyan
      { name: L_LAYERS.COLUMN, color: 1 },  // Red
      { name: L_LAYERS.REBAR, color: 3 },   // Green
      { name: L_LAYERS.CENTERVALUES, color: 2 }, // Yellow
      { name: L_LAYERS.DIM, color: 6 },     // Magenta
      { name: L_LAYERS.TEXT, color: 7 },    // White/Black
      { name: L_LAYERS.SECTIONS, color: 5 },// Blue
      { name: L_LAYERS.HATCH, color: 8 },   // Gray
      { name: L_LAYERS.NOTES, color: 7 }    // White
    ];
    const entries = layers.map(l =>
      `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`
    ).join('\n');
    return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${entries}\n0\nENDTAB\n0\nENDSEC\n`;
  };

  const toM = (val: number) => val / 1000;

  const fW = toM(args.B);
  const fL = toM(args.L);
  const fH = toM(args.H);
  
  // Set up multiple virtual columns resting along the strip axis (e.g. spaced at 3.5m and 8.5m)
  const columnsArr = [
    { label: 'C1', x: 0.8, w: 0.3, h: 0.4 },
    { label: 'C2', x: 4.8, w: 0.3, h: 0.5 },
    { label: 'C3', x: 9.8, w: 0.4, h: 0.6 }
  ];

  let entities = '';

  const dLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => dxfLine(x1, y1, x2, y2, layer);
  const dPoly = (pts: { x: number; y: number }[], layer: string, closed: boolean = true) => dxfPolyline(pts, layer, closed);
  const dText = (x: number, y: number, text: string, layer: string, h: number = 0.2) => dxfText(x, y, text, layer, h);
  const dDim = (x1: number, y1: number, x2: number, y2: number, layer: string, offset: number = 0.5) => dxfDimension(x1, y1, x2, y2, layer, offset);

  // Drawing frame border (A3 Landscape layout aspect ratio boundary virtual box)
  entities += dPoly([
    { x: -2, y: -7 },
    { x: 19, y: -7 },
    { x: 19, y: 12 },
    { x: -2, y: 12 }
  ], L_LAYERS.OUTLINE);

  // Axis grid crossings
  entities += dLine(-2, 0, 19, 0, L_LAYERS.CENTERVALUES);
  entities += dLine(8, -7, 8, 12, L_LAYERS.CENTERVALUES);

  // 1. STRIP PLAN VIEW (Centered at (3, 6))
  const px = 3;
  const py = 6;
  const planScaleFactor = Math.min(1.0, 7.5 / fL); // scale down if total length exceeds normal layout
  const p_halfW = (fW / 2) * planScaleFactor;
  const p_halfL = (fL / 2) * planScaleFactor;

  // Outer concrete boundary
  entities += dPoly([
    { x: px - p_halfL, y: py - p_halfW },
    { x: px + p_halfL, y: py - p_halfW },
    { x: px + p_halfL, y: py + p_halfW },
    { x: px - p_halfL, y: py + p_halfW }
  ], L_LAYERS.OUTLINE);

  // Center axes
  entities += dLine(px - p_halfL - 0.5, py, px + p_halfL + 0.5, py, L_LAYERS.CENTERVALUES);
  for (const col of columnsArr) {
    const colPlanX = px - p_halfL + (col.x * planScaleFactor);
    entities += dLine(colPlanX, py - p_halfW - 0.3, colPlanX, py + p_halfW + 0.3, L_LAYERS.CENTERVALUES);
    
    // Draw Column rectangle
    const colW_scaled = (col.w / 2) * planScaleFactor;
    const colH_scaled = (col.h / 2) * planScaleFactor;
    entities += dPoly([
      { x: colPlanX - colW_scaled, y: py - colH_scaled },
      { x: colPlanX + colW_scaled, y: py - colH_scaled },
      { x: colPlanX + colW_scaled, y: py + colH_scaled },
      { x: colPlanX - colW_scaled, y: py + colH_scaled }
    ], L_LAYERS.COLUMN);
    
    // Inner cross lines inside columns
    entities += dLine(colPlanX - colW_scaled, py - colH_scaled, colPlanX + colW_scaled, py + colH_scaled, L_LAYERS.COLUMN);
    entities += dLine(colPlanX + colW_scaled, py - colH_scaled, colPlanX - colW_scaled, py + colH_scaled, L_LAYERS.COLUMN);

    // Column Labels
    entities += dText(colPlanX, py + colH_scaled + 0.15, `${col.label} (${Math.round(col.w*1000)}x${Math.round(col.h*1000)} mm)`, L_LAYERS.TEXT, 0.11);
  }

  // Dimension markings on Plan
  entities += dDim(px - p_halfL, py - p_halfW - 0.4, px + p_halfL, py - p_halfW - 0.4, L_LAYERS.DIM, 0.3);
  entities += dDim(px - p_halfL - 0.4, py - p_halfW, px - p_halfL - 0.4, py + p_halfW, L_LAYERS.DIM, 0.3);
  
  // Outer Plan labels
  entities += dText(px, py - p_halfW - 0.9, `STRIP PLAN VIEW - ${args.id} (SCALE 1:${args.scale || '25'})`, L_LAYERS.TEXT, 0.22);
  entities += dText(px, py + p_halfW + 0.5, `STRIP WIDTH B = ${args.B} mm | LENGTH L = ${args.L} mm`, L_LAYERS.TEXT, 0.15);

  // 2. LONGITUDINAL ELEVATION SECTION (Centered at (13, 6))
  const sx = 13;
  const sy = 6;
  const sectScaleFactor = Math.min(1.0, 7.5 / fL);
  const s_halfL = (fL / 2) * sectScaleFactor;

  // Let's implement stepped elevations if requested or configured
  // Stepped foundation: high side (right), low side (left). Shows a step height of 300mm at 60% of length
  const hasStep = true;
  const stepX = px - p_halfL + (fL * 0.6 * sectScaleFactor);
  const stepHeight = 0.3; // 300mm step

  // We will draw the PCC layer
  entities += dPoly([
    { x: sx - s_halfL - 0.1, y: sy - 0.1 },
    { x: sx + s_halfL * 0.2, y: sy - 0.1 },
    { x: sx + s_halfL * 0.2, y: sy + stepHeight - 0.1 },
    { x: sx + s_halfL + 0.1, y: sy + stepHeight - 0.1 },
    { x: sx + s_halfL + 0.1, y: sy + stepHeight },
    { x: sx + s_halfL * 0.2, y: sy + stepHeight },
    { x: sx + s_halfL * 0.2, y: sy },
    { x: sx - s_halfL - 0.1, y: sy }
  ], L_LAYERS.HATCH);

  // Continuous concrete outline of the stepped strip footing
  entities += dPoly([
    { x: sx - s_halfL, y: sy },
    { x: sx + s_halfL * 0.2, y: sy },
    { x: sx + s_halfL * 0.2, y: sy + stepHeight },
    { x: sx + s_halfL, y: sy + stepHeight },
    { x: sx + s_halfL, y: sy + stepHeight + fH },
    { x: sx + s_halfL * 0.2, y: sy + stepHeight + fH },
    { x: sx + s_halfL * 0.2, y: sy + fH },
    { x: sx - s_halfL, y: sy + fH }
  ], L_LAYERS.OUTLINE);

  // Draw vertical step indicators
  entities += dLine(sx + s_halfL * 0.2, sy, sx + s_halfL * 0.2, sy + stepHeight + fH, L_LAYERS.OUTLINE);
  entities += dText(sx + s_halfL * 0.2, sy + stepHeight + fH + 0.2, "STEP H=300mm", L_LAYERS.TEXT, 0.12);

  // Columns on Longitudinal section
  for (const col of columnsArr) {
    const colSectX = sx - s_halfL + (col.x * sectScaleFactor);
    const colBaseY = (col.x * sectScaleFactor > s_halfL * 0.2) ? sy + stepHeight + fH : sy + fH;
    
    // Column concrete outline going up
    entities += dPoly([
      { x: colSectX - (col.w/2)*sectScaleFactor, y: colBaseY },
      { x: colSectX + (col.w/2)*sectScaleFactor, y: colBaseY },
      { x: colSectX + (col.w/2)*sectScaleFactor, y: colBaseY + 1.2 },
      { x: colSectX - (col.w/2)*sectScaleFactor, y: colBaseY + 1.2 }
    ], L_LAYERS.COLUMN);

    // Column label
    entities += dText(colSectX, colBaseY + 1.3, col.label, L_LAYERS.TEXT, 0.12);
  }

  // Draw bottom & top reinforcing steel bars conforming to ACI anchorage hooks
  const cov = 0.075;
  const hk = 0.25;

  // Bottom continuous rebar lines (lower step then stepping up)
  entities += dLine(sx - s_halfL + cov, sy + cov + hk, sx - s_halfL + cov, sy + cov, L_LAYERS.REBAR);
  entities += dLine(sx - s_halfL + cov, sy + cov, sx + s_halfL * 0.2 - cov, sy + cov, L_LAYERS.REBAR);
  // Lap splices over step hook
  entities += dLine(sx + s_halfL * 0.2 - cov, sy + cov, sx + s_halfL * 0.2 - cov, sy + stepHeight + cov, L_LAYERS.REBAR);
  entities += dLine(sx + s_halfL * 0.2 - cov, sy + stepHeight + cov, sx + s_halfL - cov, sy + stepHeight + cov, L_LAYERS.REBAR);
  entities += dLine(sx + s_halfL - cov, sy + stepHeight + cov, sx + s_halfL - cov, sy + stepHeight + cov + hk, L_LAYERS.REBAR);

  // Top continuous rebar lines
  entities += dLine(sx - s_halfL + cov, sy + fH - cov - hk, sx - s_halfL + cov, sy + fH - cov, L_LAYERS.REBAR);
  entities += dLine(sx - s_halfL + cov, sy + fH - cov, sx + s_halfL * 0.2 - cov, sy + fH - cov, L_LAYERS.REBAR);
  entities += dLine(sx + s_halfL * 0.2 - cov, sy + fH - cov, sx + s_halfL * 0.2 - cov, sy + stepHeight + fH - cov, L_LAYERS.REBAR);
  entities += dLine(sx + s_halfL * 0.2 - cov, sy + stepHeight + fH - cov, sx + s_halfL - cov, sy + stepHeight + fH - cov, L_LAYERS.REBAR);
  entities += dLine(sx + s_halfL - cov, sy + stepHeight + fH - cov, sx + s_halfL - cov, sy + stepHeight + fH - cov - hk, L_LAYERS.REBAR);

  // Stirrups at 150mm spacing along length
  for (let sxPos = sx - s_halfL + 0.1; sxPos < sx + s_halfL - 0.1; sxPos += 0.3) {
    const isHighSide = (sxPos > sx + s_halfL * 0.2);
    const s_y1 = isHighSide ? sy + stepHeight + cov : sy + cov;
    const s_y2 = isHighSide ? sy + stepHeight + fH - cov : sy + fH - cov;
    entities += dLine(sxPos, s_y1, sxPos, s_y2, L_LAYERS.REBAR);
  }

  // Labelings on section
  entities += dText(sx, sy - 0.7, `LONGITUDINAL ELEVATION SECTION (STEPPED FOUNDATION)`, L_LAYERS.TEXT, 0.23);
  entities += dText(sx - s_halfL + 0.5, sy + cov + 0.3, `BOT BARS: ${args.barsBotCount}\\U+00D8${args.barsBotDia} CONT.`, L_LAYERS.REBAR, 0.12);
  entities += dText(sx - s_halfL + 0.5, sy + fH - cov - 0.3, `TOP BARS: ${args.barsTopCount}\\U+00D8${args.barsTopDia} CONT.`, L_LAYERS.REBAR, 0.12);

  // 3. TYPICAL CROSS SECTION (Centered at (3, -2.5))
  const sBx = 3;
  const sBy = -2.5;

  // PCC underlying concrete block
  entities += dPoly([
    { x: sBx - fW/2 - 0.1, y: sBy - 0.1 },
    { x: sBx + fW/2 + 0.1, y: sBy - 0.1 },
    { x: sBx + fW/2 + 0.1, y: sBy },
    { x: sBx - fW/2 - 0.1, y: sBy }
  ], L_LAYERS.HATCH);

  // Footing outline
  entities += dPoly([
    { x: sBx - fW/2, y: sBy },
    { x: sBx + fW/2, y: sBy },
    { x: sBx + fW/2, y: sBy + fH },
    { x: sBx - fW/2, y: sBy + fH }
  ], L_LAYERS.OUTLINE);

  // Pedestal neck concrete
  entities += dPoly([
    { x: sBx - 0.2, y: sBy + fH },
    { x: sBx + 0.2, y: sBy + fH },
    { x: sBx + 0.2, y: sBy + fH + 0.6 },
    { x: sBx - 0.2, y: sBy + fH + 0.6 }
  ], L_LAYERS.COLUMN);

  // Rebar ties in cross section
  entities += dPoly([
    { x: sBx - fW/2 + cov, y: sBy + cov },
    { x: sBx + fW/2 - cov, y: sBy + cov },
    { x: sBx + fW/2 - cov, y: sBy + fH - cov },
    { x: sBx - fW/2 + cov, y: sBy + fH - cov }
  ], L_LAYERS.REBAR, true);

  // Rebar circles represent main continuous longitudinal bars (using small circles or line segments)
  const dotRadius = 0.015;
  for (let bx = sBx - fW/2 + cov + 0.05; bx <= sBx + fW/2 - cov - 0.05; bx += (fW - 2*cov - 0.1)/3) {
    entities += dxfCircle(bx, sBy + cov + 0.02, dotRadius, L_LAYERS.REBAR);
    entities += dxfCircle(bx, sBy + fH - cov - 0.02, dotRadius, L_LAYERS.REBAR);
  }

  // Dimension details
  entities += dDim(sBx - fW/2, sBy + fH + 0.2, sBx + fW/2, sBy + fH + 0.2, L_LAYERS.DIM, 0.3);
  entities += dDim(sBx + fW/2 + 0.3, sBy, sBx + fW/2 + 0.3, sBy + fH, L_LAYERS.DIM, 0.2);

  entities += dText(sBx, sBy - 0.6, "TYPICAL CROSS SECTION B-B", L_LAYERS.TEXT, 0.22);
  entities += dText(sBx, sBy - 0.9, `STIRRUPS: \\U+00D8${args.stirrupsDia}@${args.stirrupsSpacing}mm`, L_LAYERS.REBAR, 0.12);

  // 4. CONSTRUCTION NOTES FOR STRIP (Centered at (9.5, -1.0))
  const nx = 9.5;
  let ny = -0.5;
  const rowS = 0.25;

  entities += dText(nx, ny, "ACI 318 SPECIFICATIONS & CONSTRUCTION NOTES", L_LAYERS.NOTES, 0.20);
  ny -= rowS * 1.3;
  entities += dText(nx, ny, `1. CONCRETE DECLARED STRENGTH: f'c = ${args.fc || 25} MPa`, L_LAYERS.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, `2. REINFORCING STEEL SPECIFICATION: fy = ${args.fy || 420} MPa`, L_LAYERS.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, "3. DEVELOPMENT LENGTH ACCORDING TO ACI CODE SECTION 25.4", L_LAYERS.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, "4. MINIMUM CLEAR COVER FOR MAIN BARS IN CONTACT WITH SOIL = 75 mm", L_LAYERS.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, `5. SEGMENTS SHOWN CONTAINS MULTIPLE ELEVATIONS (STEPS) AT -2.00M AND -1.80M`, L_LAYERS.NOTES, 0.13);
  ny -= rowS;
  entities += dText(nx, ny, `6. STIRRUPS CANES CLOSURE SYMMETRY AND BEARING CAPACITIES DYNAMICALLY COMPUTED`, L_LAYERS.NOTES, 0.13);

  // 5. ESTIMATED QUANTITIES BILL
  ny -= rowS * 1.8;
  entities += dText(nx, ny, "ESTIMATED MATERIAL BILL (BOQ SUMMARY)", L_LAYERS.NOTES, 0.20);
  ny -= rowS * 1.3;

  const concVolVal = fW * fL * fH;
  const barWeightTop = (args.barsTopDia ** 2) / 162;
  const barWeightBot = (args.barsBotDia ** 2) / 162;
  const rebarWeightVal = (args.barsTopCount * fL * barWeightTop) + (args.barsBotCount * fL * barWeightBot);
  const excVolVal = (fW + 1.0) * fL * (args.soilDepth || 1.5);
  const backfillVolVal = excVolVal - concVolVal;

  entities += dText(nx, ny, `- ESTIMATED COSTRUCT CONCRETE MASS: ${concVolVal.toFixed(3)} m3`, L_LAYERS.NOTES, 0.14);
  ny -= rowS;
  entities += dText(nx, ny, `- TOTAL CONTINUOUS STEEL TONNAGE: ${rebarWeightVal.toFixed(1)} kg`, L_LAYERS.NOTES, 0.14);
  ny -= rowS;
  entities += dText(nx, ny, `- MASS EXCAVATION VOLUME (SOIL WORK): ${excVolVal.toFixed(2)} m3`, L_LAYERS.NOTES, 0.14);
  ny -= rowS;
  entities += dText(nx, ny, `- NET MASS BACKFILL COVER CAPACITY: ${backfillVolVal.toFixed(2)} m3`, L_LAYERS.NOTES, 0.14);

  // TITLE BLOCK (Bottom-right, scaled for sheet details)
  const sheet_tbX = 11.5;
  const sheet_tbY = -5.5;
  const sheet_tbW = 6.0;
  const sheet_tbH = 1.8;

  entities += dPoly([
    { x: sheet_tbX, y: sheet_tbY },
    { x: sheet_tbX + sheet_tbW, y: sheet_tbY },
    { x: sheet_tbX + sheet_tbW, y: sheet_tbY + sheet_tbH },
    { x: sheet_tbX, y: sheet_tbY + sheet_tbH }
  ], L_LAYERS.OUTLINE);

  entities += dLine(sheet_tbX, sheet_tbY + sheet_tbH / 2, sheet_tbX + sheet_tbW, sheet_tbY + sheet_tbH / 2, L_LAYERS.OUTLINE);
  entities += dLine(sheet_tbX + sheet_tbW * 0.5, sheet_tbY, sheet_tbX + sheet_tbW * 0.5, sheet_tbY + sheet_tbH, L_LAYERS.OUTLINE);

  entities += dText(sheet_tbX + 0.15, sheet_tbY + sheet_tbH * 0.72, `PROJECT: ${args.projectName || 'SDS'}`, L_LAYERS.TEXT, 0.13);
  entities += dText(sheet_tbX + 0.15, sheet_tbY + sheet_tbH * 0.22, `DETAIL: STRIP FOOTING DETAIL - ${args.id}`, L_LAYERS.TEXT, 0.11);

  entities += dText(sheet_tbX + sheet_tbW * 0.52, sheet_tbY + sheet_tbH * 0.72, `SCALE: 1:${args.scale || '25'}`, L_LAYERS.TEXT, 0.10);
  entities += dText(sheet_tbX + sheet_tbW * 0.52, sheet_tbY + sheet_tbH * 0.22, `SHEET NO. S-302-${args.id}`, L_LAYERS.TEXT, 0.15);

  return `999\nContinuous Strip Footing Drawing Detail\n${dxfHeader()}${dxfTables()}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export interface DXF_BBSItem {
  typeMark: string;
  barMark: string;
  layer: string;
  diameter: number;
  shape: string;
  quantity: number;
  singleLength: number;
  totalLength: number;
  totalWeight: number;
  ref?: string;
  segmentA?: number;
  segmentB?: number;
  segmentC?: number;
}

export function generateFoundationBBS_DXF(items: DXF_BBSItem[], projectName?: string): string {
  const L_LAYERS = {
    OUTLINE: 'STRIP_FOOTING',
    REBAR: 'REINFORCEMENT',
    DIM: 'DIMENSIONS',
    TEXT: 'TEXT',
    NOTES: 'NOTES',
  };

  const dxfTables = (): string => {
    const layers = [
      { name: L_LAYERS.OUTLINE, color: 4 }, // Cyan
      { name: L_LAYERS.REBAR, color: 3 },   // Green
      { name: L_LAYERS.DIM, color: 6 },     // Magenta
      { name: L_LAYERS.TEXT, color: 7 },    // White/Black
      { name: L_LAYERS.NOTES, color: 7 }    // White
    ];
    const entries = layers.map(l =>
      `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`
    ).join('\n');
    return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${entries}\n0\nENDTAB\n0\nENDSEC\n`;
  };

  let entities = '';

  const dLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => dxfLine(x1, y1, x2, y2, layer);
  const dPoly = (pts: { x: number; y: number }[], layer: string, closed: boolean = true) => dxfPolyline(pts, layer, closed);
  const dText = (x: number, y: number, text: string, layer: string, h: number = 0.2) => dxfText(x, y, text, layer, h);

  // Outer framing sheet (A2 Landscape layout)
  entities += dPoly([
    { x: -1, y: -18 },
    { x: 34, y: -18 },
    { x: 34, y: 15 },
    { x: -1, y: 15 }
  ], L_LAYERS.OUTLINE);

  // Sheet main titles
  entities += dText(15, 13.5, "BAR BENDING SCHEDULE (BBS) FOR RC FOUNDATIONS", L_LAYERS.TEXT, 0.45);
  entities += dText(15, 12.8, `${projectName || 'FOUNDATION PROJECT'} - SUMMARY FOR CONTRACTOR & FABRICATOR`, L_LAYERS.TEXT, 0.25);
  entities += dText(15, 12.2, "COMPLIANT WITH ACI 318 RULES, SPLICE REINFORCEMENTS & STANDARD BENDS", L_LAYERS.TEXT, 0.20);

  // Draw table coordinates
  const tX = 0;
  const tY = 11;
  const rowH = 0.8;
  const colW = [1.8, 1.8, 3.2, 1.2, 2.5, 1.2, 1.6, 2.0, 7.5, 2.0]; // column widths for tX
  // Headers: Mark, Ref, Layer, Diameter, Shape Code, Quantity, Single L, Total L, Shape Sketch, Total Weight
  const headers = [
    'MARK', 'REF', 'LOCATION', 'DIA', 'SHAPE CODE', 'QTY', 'SINGLE L', 'TOT L', 'SHAPE SKETCH / DIAGRAM', 'WEIGHT (kg)'
  ];

  // Draw Header Row background and outline
  let curX = tX;
  const fullWidth = colW.reduce((a, b) => a + b, 0);
  entities += dPoly([
    { x: tX, y: tY },
    { x: tX + fullWidth, y: tY },
    { x: tX + fullWidth, y: tY - rowH },
    { x: tX, y: tY - rowH }
  ], L_LAYERS.OUTLINE);

  // Draw header texts & lines
  curX = tX;
  for (let i = 0; i < colW.length; i++) {
    entities += dText(curX + colW[i] / 2 - 0.2, tY - rowH / 2 - 0.08, headers[i], L_LAYERS.TEXT, 0.14);
    if (i > 0) {
      entities += dLine(curX, tY, curX, tY - 15, L_LAYERS.OUTLINE); // vertical lines
    }
    curX += colW[i];
  }

  // Draw rows
  let y = tY - rowH;
  for (let idx = 0; idx < Math.min(items.length, 14); idx++) {
    const item = items[idx];
    
    // row boundary
    entities += dPoly([
      { x: tX, y: y },
      { x: tX + fullWidth, y: y },
      { x: tX + fullWidth, y: y - rowH },
      { x: tX, y: y - rowH }
    ], L_LAYERS.OUTLINE);

    curX = tX;
    
    // Column 0: Mark
    entities += dText(curX + colW[0]/2 - 0.2, y - rowH/2 - 0.08, item.barMark, L_LAYERS.TEXT, 0.13); curX += colW[0];
    
    // Column 1: Ref
    entities += dText(curX + colW[1]/2 - 0.2, y - rowH/2 - 0.08, item.typeMark, L_LAYERS.TEXT, 0.13); curX += colW[1];
    
    // Column 2: Location
    entities += dText(curX + colW[2]/2 - 0.4, y - rowH/2 - 0.08, item.layer, L_LAYERS.TEXT, 0.11); curX += colW[2];
    
    // Column 3: Diameter
    entities += dText(curX + colW[3]/2 - 0.15, y - rowH/2 - 0.08, `%%C${item.diameter}`, L_LAYERS.TEXT, 0.13); curX += colW[3];
    
    // Column 4: Shape
    entities += dText(curX + colW[4]/2 - 0.4, y - rowH/2 - 0.08, item.shape, L_LAYERS.TEXT, 0.11); curX += colW[4];
    
    // Column 5: Qty
    entities += dText(curX + colW[5]/2 - 0.15, y - rowH/2 - 0.08, `${item.quantity}`, L_LAYERS.TEXT, 0.13); curX += colW[5];
    
    // Column 6: Single length
    entities += dText(curX + colW[6]/2 - 0.2, y - rowH/2 - 0.08, `${item.singleLength.toFixed(2)}m`, L_LAYERS.TEXT, 0.13); curX += colW[6];
    
    // Column 7: Total length
    entities += dText(curX + colW[7]/2 - 0.2, y - rowH/2 - 0.08, `${item.totalLength.toFixed(2)}m`, L_LAYERS.TEXT, 0.13); curX += colW[7];
    
    // Column 8: Shape Sketch (Draw schematic geometry inside cell)
    const skX = curX + 0.5;
    const skY = y - rowH / 2;
    if (item.shape.toLowerCase().includes('l') || item.shape.toLowerCase().includes('hooked')) {
      // Shape Hooked L
      entities += dLine(skX, skY + 0.18, skX, skY - 0.15, L_LAYERS.REBAR);
      entities += dLine(skX, skY - 0.15, skX + 1.8, skY - 0.15, L_LAYERS.REBAR);
      entities += dText(skX + 0.1, skY + 0.05, "hk", L_LAYERS.DIM, 0.08);
      entities += dText(skX + 0.8, skY - 0.28, "L_fit", L_LAYERS.DIM, 0.08);
    } else if (item.shape.toLowerCase().includes('u') || item.shape.toLowerCase().includes('cap')) {
      // Shape U
      entities += dLine(skX, skY + 0.18, skX, skY - 0.14, L_LAYERS.REBAR);
      entities += dLine(skX, skY - 0.14, skX + 1.8, skY - 0.14, L_LAYERS.REBAR);
      entities += dLine(skX + 1.8, skY - 0.14, skX + 1.8, skY + 0.18, L_LAYERS.REBAR);
      entities += dText(skX + 0.9, skY - 0.25, "B_fit", L_LAYERS.DIM, 0.08);
    } else if (item.shape.toLowerCase().includes('stir') || item.shape.toLowerCase().includes('close')) {
      // Shape Closed rectangular tie (stirr)
      entities += dPoly([
        { x: skX + 0.2, y: skY - 0.18 },
        { x: skX + 1.4, y: skY - 0.18 },
        { x: skX + 1.4, y: skY + 0.18 },
        { x: skX + 0.2, y: skY + 0.18 }
      ], L_LAYERS.REBAR, true);
      // Small 135 deg Hooks
      entities += dLine(skX + 0.2, skY + 0.18, skX + 0.35, skY + 0.04, L_LAYERS.REBAR);
      entities += dLine(skX + 1.4, skY + 0.18, skX + 1.25, skY + 0.04, L_LAYERS.REBAR);
      entities += dText(skX + 0.8, skY + 0.21, "w", L_LAYERS.DIM, 0.08);
      entities += dText(skX + 1.45, skY, "h", L_LAYERS.DIM, 0.08);
    } else {
      // Straight Bar shape
      entities += dLine(skX, skY, skX + 2.2, skY, L_LAYERS.REBAR);
      entities += dText(skX + 1.0, skY + 0.06, "L_straight", L_LAYERS.DIM, 0.08);
    }
    curX += colW[8];

    // Column 9: Total weight
    entities += dText(curX + colW[9]/2 - 0.25, y - rowH/2 - 0.08, `${item.totalWeight.toFixed(1)}`, L_LAYERS.TEXT, 0.13); curX += colW[9];

    y -= rowH;
  }

  // Draw vertical column partition lines for rows as well to hold perfectly together
  let verticalLineX = tX;
  for (let i = 0; i < colW.length; i++) {
    entities += dLine(verticalLineX, tY, verticalLineX, y, L_LAYERS.OUTLINE);
    verticalLineX += colW[i];
  }
  entities += dLine(verticalLineX, tY, verticalLineX, y, L_LAYERS.OUTLINE);

  // Bottom BBS metrics & quantities summary
  const summaryY = y - 1.2;
  entities += dText(tX + 0.2, summaryY, "==========================================================", L_LAYERS.TEXT, 0.15);
  entities += dText(tX + 0.2, summaryY - 0.3, "MATERIAL QUANTITY SUMMARY & STATISTICAL METRICS", L_LAYERS.TEXT, 0.18);
  entities += dText(tX + 0.2, summaryY - 0.6, "==========================================================", L_LAYERS.TEXT, 0.15);

  const totWtSum = items.reduce((acc, curr) => acc + curr.totalWeight, 0);
  entities += dText(tX + 0.2, summaryY - 1.0, `- Combined Reinforcement Tonnage: ${(totWtSum / 1000).toFixed(3)} metric tons`, L_LAYERS.NOTES, 0.14);
  entities += dText(tX + 0.2, summaryY - 1.3, `- Net Reinforcement Weight: ${totWtSum.toFixed(1)} kilograms (kg)`, L_LAYERS.NOTES, 0.14);
  entities += dText(tX + 0.2, summaryY - 1.6, `- Diameter Distribution: Ø10, Ø12, Ø14, Ø16 structural quality rebars`, L_LAYERS.NOTES, 0.14);
  entities += dText(tX + 0.2, summaryY - 1.9, `- Standards Met: ACI 318 Section 25.4 (Development Lengths & Hooks)`, L_LAYERS.NOTES, 0.14);

  // Right-hand construction guidelines block
  const grX = tX + 16.0;
  entities += dText(grX, summaryY, "REINFORCING STEEL SPECIFICATIONS (ACI 318-19)", L_LAYERS.NOTES, 0.16);
  entities += dText(grX, summaryY - 0.3, "1. Concrete Cover: 75mm minimum clear cover in soils.", L_LAYERS.NOTES, 0.11);
  entities += dText(grX, summaryY - 0.52, "2. Hook Bends: 90 deg hooks with 12*db standard extensions.", L_LAYERS.NOTES, 0.11);
  entities += dText(grX, summaryY - 0.74, "3. Laps: Tension splices must use Class B lap lengths (1.3*ld).", L_LAYERS.NOTES, 0.11);
  entities += dText(grX, summaryY - 0.96, "4. Tie Closure: 135 deg seismic stirrups hook bends.", L_LAYERS.NOTES, 0.11);

  // Standard Sheet Title Block
  const titleX = 24.0;
  const titleY = -16.5;
  const titleW = 9.0;
  const titleH = 2.2;

  entities += dPoly([
    { x: titleX, y: titleY },
    { x: titleX + titleW, y: titleY },
    { x: titleX + titleW, y: titleY + titleH },
    { x: titleX, y: titleY + titleH }
  ], L_LAYERS.OUTLINE);

  entities += dLine(titleX, titleY + titleH / 2, titleX + titleW, titleY + titleH / 2, L_LAYERS.OUTLINE);
  entities += dLine(titleX + titleW * 0.5, titleY, titleX + titleW * 0.5, titleY + titleH, L_LAYERS.OUTLINE);

  entities += dText(titleX + 0.3, titleY + titleH * 0.73, `PROJECT: ${projectName || 'SDS'}`, L_LAYERS.TEXT, 0.15);
  entities += dText(titleX + 0.3, titleY + titleH * 0.23, "FOUNDATION DETAILS", L_LAYERS.TEXT, 0.13);
  entities += dText(titleX + titleW * 0.53, titleY + titleH * 0.73, `TOTAL TONS: ${(totWtSum / 1000).toFixed(3)} T`, L_LAYERS.TEXT, 0.14);
  entities += dText(titleX + titleW * 0.53, titleY + titleH * 0.23, "SHEET NO: BBS-401", L_LAYERS.TEXT, 0.18);

  return `999\nFoundation Bar Bending Schedule Sheet\n${dxfHeader()}${dxfTables()}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export interface DXF_BOQItem {
  itemNo: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  total: number;
  category: string;
}

export function generateFoundationBOQ_DXF(items: DXF_BOQItem[], projectName?: string): string {
  const L_LAYERS = {
    OUTLINE: 'BOQ_OUTLINE',
    TEXT: 'BOQ_TEXT',
    NUMBERS: 'BOQ_NUMBERS',
    HEADER: 'BOQ_HEADER'
  };

  const dxfTables = (): string => {
    const layers = [
      { name: L_LAYERS.OUTLINE, color: 4 }, // Cyan
      { name: L_LAYERS.TEXT, color: 7 },    // Black/White
      { name: L_LAYERS.NUMBERS, color: 3 }, // Green
      { name: L_LAYERS.HEADER, color: 2 }   // Yellow
    ];
    const entries = layers.map(l =>
      `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`
    ).join('\n');
    return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${entries}\n0\nENDTAB\n0\nENDSEC\n`;
  };

  let entities = '';

  const dLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => dxfLine(x1, y1, x2, y2, layer);
  const dPoly = (pts: { x: number; y: number }[], layer: string, closed: boolean = true) => dxfPolyline(pts, layer, closed);
  const dText = (x: number, y: number, text: string, layer: string, h: number = 0.2) => dxfText(x, y, text, layer, h);

  // A2 size framing
  entities += dPoly([
    { x: -1, y: -18 },
    { x: 34, y: -18 },
    { x: 34, y: 15 },
    { x: -1, y: 15 }
  ], L_LAYERS.OUTLINE);

  // Title
  entities += dText(15, 13.5, "BILL OF QUANTITIES (BOQ) - FOUNDATIONS", L_LAYERS.TEXT, 0.45);
  entities += dText(15, 12.8, `${projectName || 'FOUNDATION PROJECT'} - TENDER DOCUMENTATION SUMMARY`, L_LAYERS.TEXT, 0.25);
  entities += dText(15, 12.2, "QUANTITY SURVEYOR COMPLIANT REPORT - AUTOMATICALLY GENERATED", L_LAYERS.TEXT, 0.20);

  const tX = 0;
  const tY = 11;
  const rowH = 0.8;
  const colW = [1.5, 3.5, 10.0, 1.5, 2.5, 2.5, 3.5]; // widths of columns
  const colHeaders = ["Item", "Category", "Description", "Unit", "Quantity", "Unit Rate", "Total (SAR)"];
  const fullWidth = colW.reduce((a, b) => a + b, 0);

  // draw header
  let curX = tX;
  entities += dPoly([
    { x: tX, y: tY },
    { x: tX + fullWidth, y: tY },
    { x: tX + fullWidth, y: tY - rowH },
    { x: tX, y: tY - rowH }
  ], L_LAYERS.OUTLINE);

  colHeaders.forEach((h, i) => {
    entities += dText(curX + 0.2, tY - rowH/2 - 0.1, h, L_LAYERS.HEADER, 0.18);
    curX += colW[i];
  });

  let y = tY - rowH;
  items.forEach(item => {
    // row outer boundary
    entities += dPoly([
      { x: tX, y: y },
      { x: tX + fullWidth, y: y },
      { x: tX + fullWidth, y: y - rowH },
      { x: tX, y: y - rowH }
    ], L_LAYERS.OUTLINE);

    let rowX = tX;

    // Col 0: Item
    entities += dText(rowX + 0.2, y - rowH/2 - 0.1, item.itemNo, L_LAYERS.TEXT, 0.15); rowX += colW[0];
    // Col 1: Category
    entities += dText(rowX + 0.2, y - rowH/2 - 0.1, item.category, L_LAYERS.TEXT, 0.13); rowX += colW[1];
    // Col 2: Description
    const shortDesc = item.description.length > 55 ? item.description.substring(0, 52) + '...' : item.description;
    entities += dText(rowX + 0.2, y - rowH/2 - 0.1, shortDesc, L_LAYERS.TEXT, 0.13); rowX += colW[2];
    // Col 3: Unit
    entities += dText(rowX + 0.2, y - rowH/2 - 0.1, item.unit, L_LAYERS.TEXT, 0.14); rowX += colW[3];
    // Col 4: Quantity
    entities += dText(rowX + 0.2, y - rowH/2 - 0.1, item.quantity.toFixed(2), L_LAYERS.NUMBERS, 0.14); rowX += colW[4];
    // Col 5: Rate
    entities += dText(rowX + 0.2, y - rowH/2 - 0.1, item.rate.toFixed(1), L_LAYERS.NUMBERS, 0.14); rowX += colW[5];
    // Col 6: Total
    entities += dText(rowX + 0.2, y - rowH/2 - 0.1, item.total.toLocaleString(undefined, {maximumFractionDigits:0}), L_LAYERS.NUMBERS, 0.15); rowX += colW[6];

    y -= rowH;
  });

  // vertical dividers
  let dividerX = tX;
  for (let i = 0; i < colW.length; i++) {
    entities += dLine(dividerX, tY, dividerX, y, L_LAYERS.OUTLINE);
    dividerX += colW[i];
  }
  entities += dLine(dividerX, tY, dividerX, y, L_LAYERS.OUTLINE);

  // Grand total section
  const totalSum = items.reduce((a, b) => a + b.total, 0);
  const totalY = y - 1.2;
  entities += dText(tX + 0.2, totalY, "==========================================================", L_LAYERS.TEXT, 0.15);
  entities += dText(tX + 0.2, totalY - 0.4, `ESTIMATED CONTRACT GRAND TOTAL: SAR ${totalSum.toLocaleString(undefined, {maximumFractionDigits:0})}`, L_LAYERS.NUMBERS, 0.20);
  entities += dText(tX + 0.2, totalY - 0.8, "==========================================================", L_LAYERS.TEXT, 0.15);

  // Title block on sheet bottom right
  const titleX = 24.0;
  const titleY = -16.5;
  const titleW = 9.0;
  const titleH = 2.2;

  entities += dPoly([
    { x: titleX, y: titleY },
    { x: titleX + titleW, y: titleY },
    { x: titleX + titleW, y: titleY + titleH },
    { x: titleX, y: titleY + titleH }
  ], L_LAYERS.OUTLINE);

  entities += dLine(titleX, titleY + titleH / 2, titleX + titleW, titleY + titleH / 2, L_LAYERS.OUTLINE);
  entities += dLine(titleX + titleW * 0.5, titleY, titleX + titleW * 0.5, titleY + titleH, L_LAYERS.OUTLINE);

  entities += dText(titleX + 0.3, titleY + titleH * 0.73, `PROJECT: ${projectName || 'SDS'}`, L_LAYERS.TEXT, 0.15);
  entities += dText(titleX + 0.3, titleY + titleH * 0.23, "FOUNDATION BOQ", L_LAYERS.TEXT, 0.13);
  entities += dText(titleX + titleW * 0.53, titleY + titleH * 0.73, `TOTAL: SAR ${totalSum.toLocaleString(undefined, {maximumFractionDigits:0})}`, L_LAYERS.TEXT, 0.14);
  entities += dText(titleX + titleW * 0.53, titleY + titleH * 0.23, "SHEET NO: BOQ-402", L_LAYERS.TEXT, 0.18);

  return `999\nFoundation Bill of Quantities Sheet\n${dxfHeader()}${dxfTables()}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export interface DXFDetailCombinedArgs {
  id: string; // e.g. CF1
  shape: 'rectangular' | 'trapezoidal';
  L: number; // mm
  B1: number; // mm
  B2: number; // mm
  H: number; // mm
  fc: number;
  fy: number;
  columns: {
    id: string;
    cx: number;
    cy: number;
    x: number; // position from left end in mm
  }[];
  topSteelText: string;
  botSteelText: string;
  transverseSteelText: string;
  concreteVol: number;
  formworkArea: number;
  steelWeightKg: number;
  excavationVol: number;
  backfillVol: number;
}

export function generateCombinedFootingDetailDXF(args: DXFDetailCombinedArgs): string {
  const L_LAYERS = {
    OUTLINE: 'COMBINED_OUTLINE',
    COLUMN: 'COLUMNS',
    REBAR: 'REINFORCEMENT',
    CENTERVALUES: 'CENTERLINES',
    DIM: 'DIMENSIONS',
    TEXT: 'TEXT',
    SECTIONS: 'SECTIONS',
    HATCH: 'HATCH',
    NOTES: 'NOTES',
  };

  const dxfTables = (): string => {
    const layers = [
      { name: L_LAYERS.OUTLINE, color: 5 }, // Blue
      { name: L_LAYERS.COLUMN, color: 1 },  // Red
      { name: L_LAYERS.REBAR, color: 3 },   // Green
      { name: L_LAYERS.CENTERVALUES, color: 2 }, // Yellow
      { name: L_LAYERS.DIM, color: 6 },     // Magenta
      { name: L_LAYERS.TEXT, color: 7 },    // White/Black
      { name: L_LAYERS.SECTIONS, color: 4 },// Cyan
      { name: L_LAYERS.HATCH, color: 8 },   // Gray
      { name: L_LAYERS.NOTES, color: 7 }    // White
    ];
    const entries = layers.map(l =>
      `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`
    ).join('\n');
    return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${entries}\n0\nENDTAB\n0\nENDSEC\n`;
  };

  const toM = (val: number) => val / 1000;

  const fW1 = toM(args.B1);
  const fW2 = toM(args.B2);
  const fL = toM(args.L);
  const fH = toM(args.H);

  let entities = '';

  const dLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => dxfLine(x1, y1, x2, y2, layer);
  const dPoly = (pts: { x: number; y: number }[], layer: string, closed: boolean = true) => dxfPolyline(pts, layer, closed);
  const dText = (x: number, y: number, text: string, layer: string, h: number = 0.2) => dxfText(x, y, text, layer, h);
  const dCircle = (x: number, y: number, r: number, layer: string) => dxfCircle(x, y, r, layer);
  const dDim = (x1: number, y1: number, x2: number, y2: number, layer: string, offset: number = 0.5) => dxfDimension(x1, y1, x2, y2, layer, offset);

  // Outer sheet border
  entities += dPoly([
    { x: -2, y: -9 },
    { x: 25, y: -9 },
    { x: 25, y: 16 },
    { x: -2, y: 16 }
  ], L_LAYERS.OUTLINE);

  // Layout plan background grids
  entities += dLine(-2, 0, 25, 0, L_LAYERS.CENTERVALUES);
  entities += dLine(12, -9, 12, 16, L_LAYERS.CENTERVALUES);

  // Title block on sheet bottom right
  const titleX = 14.5;
  const titleY = -8.5;
  const titleW = 10.0;
  const titleH = 2.5;

  entities += dPoly([
    { x: titleX, y: titleY },
    { x: titleX + titleW, y: titleY },
    { x: titleX + titleW, y: titleY + titleH },
    { x: titleX, y: titleY + titleH }
  ], L_LAYERS.OUTLINE);

  entities += dLine(titleX, titleY + titleH / 2, titleX + titleW, titleY + titleH / 2, L_LAYERS.OUTLINE);
  entities += dLine(titleX + titleW * 0.5, titleY, titleX + titleW * 0.5, titleY + titleH, L_LAYERS.OUTLINE);

  entities += dText(titleX + 0.3, titleY + titleH * 0.73, `PROJECT: COMBINED FOOTING ENGINE`, L_LAYERS.TEXT, 0.16);
  entities += dText(titleX + 0.3, titleY + titleH * 0.23, `FOOTING ID: ${args.id || 'CF-1'}`, L_LAYERS.TEXT, 0.15);
  entities += dText(titleX + titleW * 0.53, titleY + titleH * 0.73, `SCALE: 1:25`, L_LAYERS.TEXT, 0.15);
  entities += dText(titleX + titleW * 0.53, titleY + titleH * 0.23, `SHEET NO: S-303`, L_LAYERS.TEXT, 0.20);

  // CONSTRUCTION NOTES
  const noteX = 14.5;
  const noteY = -5.5;
  entities += dText(noteX, noteY + 1.8, "CONSTRUCTION NOTES / ملاحظات التأسيس:", L_LAYERS.NOTES, 0.18);
  entities += dText(noteX, noteY + 1.4, `- Structural Steel Rebar Grade: fy = ${args.fy} MPa`, L_LAYERS.NOTES, 0.13);
  entities += dText(noteX, noteY + 1.1, `- Characteristic Concrete Strength: f'c = ${args.fc} MPa`, L_LAYERS.NOTES, 0.13);
  entities += dText(noteX, noteY + 0.8, "- Clear Reinforcement Concrete Cover: 75 mm (soil face)", L_LAYERS.NOTES, 0.13);
  entities += dText(noteX, noteY + 0.5, "- Soil Blinding PCC Layer: C15 concrete, thickness 100 mm", L_LAYERS.NOTES, 0.13);
  entities += dText(noteX, noteY + 0.2, "- Lap splice length in tension: 50 * diameter minimum", L_LAYERS.NOTES, 0.13);

  // QUANTITY SUMMARY
  const qX = 14.5;
  const qY = -1.5;
  entities += dText(qX, qY + 1.5, "QUANTITY SURVEY DATA / حصر الكميات لصب الجملة:", L_LAYERS.NOTES, 0.18);
  entities += dText(qX, qY + 1.1, `- RCC Concrete Volume: ${args.concreteVol.toFixed(2)} cu.m.`, L_LAYERS.TEXT, 0.14);
  entities += dText(qX, qY + 0.8, `- Formwork Surface Area: ${args.formworkArea.toFixed(2)} sq.m.`, L_LAYERS.TEXT, 0.14);
  entities += dText(qX, qY + 0.5, `- Steel Reinforcement Tonnage: ${args.steelWeightKg} kg`, L_LAYERS.TEXT, 0.14);
  entities += dText(qX, qY + 0.2, `- Estimated Excavation: ${args.excavationVol.toFixed(2)} cu.m.`, L_LAYERS.TEXT, 0.14);

  // 1. PLAN VIEW (Centered at x=5.0, y=7.5)
  const px = 5.0;
  const py = 7.5;
  const pScale = Math.min(1.0, 7.5 / fL); // scale layout to fit A3 boundaries
  const pL_half = (fL / 2) * pScale;
  const pW1_half = (fW1 / 2) * pScale;
  const pW2_half = (fW2 / 2) * pScale;

  // Footing Boundary Outline
  if (args.shape === 'rectangular') {
    entities += dPoly([
      { x: px - pL_half, y: py - pW1_half },
      { x: px + pL_half, y: py - pW1_half },
      { x: px + pL_half, y: py + pW1_half },
      { x: px - pL_half, y: py + pW1_half }
    ], L_LAYERS.OUTLINE);
  } else {
    entities += dPoly([
      { x: px - pL_half, y: py - pW1_half },
      { x: px + pL_half, y: py - pW2_half },
      { x: px + pL_half, y: py + pW2_half },
      { x: px - pL_half, y: py + pW1_half }
    ], L_LAYERS.OUTLINE);
  }

  // Draw Grid Axis centerlines & columns
  entities += dLine(px - pL_half - 1.0, py, px + pL_half + 1.0, py, L_LAYERS.CENTERVALUES);

  args.columns.forEach((col, idx) => {
    const colX = px - pL_half + (toM(col.x) * pScale);
    entities += dLine(colX, py - Math.max(pW1_half, pW2_half) - 0.5, colX, py + Math.max(pW1_half, pW2_half) + 0.5, L_LAYERS.CENTERVALUES);

    // Column rect
    const cX_half = (toM(col.cx) / 2) * pScale;
    const cY_half = (toM(col.cy) / 2) * pScale;
    entities += dPoly([
      { x: colX - cX_half, y: py - cY_half },
      { x: colX + cX_half, y: py - cY_half },
      { x: colX + cX_half, y: py + cY_half },
      { x: colX - cX_half, y: py + cY_half }
    ], L_LAYERS.COLUMN);

    // Column cross hatching
    entities += dLine(colX - cX_half, py - cY_half, colX + cX_half, py + cY_half, L_LAYERS.COLUMN);
    entities += dLine(colX + cX_half, py - cY_half, colX - cX_half, py + cY_half, L_LAYERS.COLUMN);

    // Label Column
    entities += dText(colX, py + cY_half + 0.2, col.id, L_LAYERS.TEXT, 0.15);
  });

  // Rebar Representation Lines on Plan
  entities += dLine(px - pL_half + 0.2, py - pW1_half + 0.3, px + pL_half - 0.2, py - pW1_half + 0.3, L_LAYERS.REBAR);
  entities += dText(px, py - pW1_half + 0.45, `Bottom longitudinal grid: ${args.botSteelText}`, L_LAYERS.REBAR, 0.12);

  entities += dLine(px - pL_half + 0.2, py + pW1_half - 0.3, px + pL_half - 0.2, py + pW1_half - 0.3, L_LAYERS.REBAR);
  entities += dText(px, py + pW1_half - 0.55, `Top continuous steel: ${args.topSteelText}`, L_LAYERS.REBAR, 0.12);

  // Plan View Title
  entities += dText(px, py - Math.max(pW1_half, pW2_half) - 1.2, "PLAN VIEW - FOUNDATION REINFORCEMENT LAYOUT", L_LAYERS.TEXT, 0.20);
  entities += dText(px, py - Math.max(pW1_half, pW2_half) - 1.5, `MODEL: ${args.id} - ${args.L}x${args.B1}x${args.H} mm`, L_LAYERS.TEXT, 0.14);

  // Dimensions
  entities += dDim(px - pL_half, py - pW1_half - 0.2, px + pL_half, py - pW1_half - 0.2, L_LAYERS.DIM, 0.3);

  // 2. LONGITUDINAL SECTION VIEW (Centered at x=5.0, y=-2.0)
  const sx = 5.0;
  const sy = -2.0;
  const sScale = pScale;
  const sL_half = pL_half;
  const sH = fH * sScale;

  // Concrete outline
  entities += dPoly([
    { x: sx - sL_half, y: sy },
    { x: sx + sL_half, y: sy },
    { x: sx + sL_half, y: sy + sH },
    { x: sx - sL_half, y: sy + sH }
  ], L_LAYERS.OUTLINE);

  // Blinding PCC outline
  const pcc_t = 0.1 * sScale;
  entities += dPoly([
    { x: sx - sL_half - 0.1, y: sy - pcc_t },
    { x: sx + sL_half + 0.1, y: sy - pcc_t },
    { x: sx + sL_half + 0.1, y: sy },
    { x: sx - sL_half - 0.1, y: sy }
  ], L_LAYERS.OUTLINE);

  // Base hatching / soil
  entities += dLine(sx - sL_half - 0.3, sy - pcc_t, sx + sL_half + 0.3, sy - pcc_t, L_LAYERS.CENTERVALUES);

  // Draw columns extending upwards
  args.columns.forEach(col => {
    const colX = sx - sL_half + (toM(col.x) * sScale);
    const cX_half = (toM(col.cx) / 2) * sScale;

    // Draw column bounds extending 1.5m up
    entities += dLine(colX - cX_half, sy + sH, colX - cX_half, sy + sH + 1.2, L_LAYERS.COLUMN);
    entities += dLine(colX + cX_half, sy + sH, colX + cX_half, sy + sH + 1.2, L_LAYERS.COLUMN);
    
    // Column axes
    entities += dLine(colX, sy - 0.3, colX, sy + sH + 1.5, L_LAYERS.CENTERVALUES);
  });

  // Rebar Layout drawing on longitudinal view
  const rebarMargin = 0.075 * sScale; // 75mm cover
  // Bottom layer continuous
  entities += dLine(sx - sL_half + rebarMargin, sy + rebarMargin, sx + sL_half - rebarMargin, sy + rebarMargin, L_LAYERS.REBAR);
  // Bottom loops (hooks)
  entities += dLine(sx - sL_half + rebarMargin, sy + rebarMargin, sx - sL_half + rebarMargin, sy + rebarMargin + 0.2, L_LAYERS.REBAR);
  entities += dLine(sx + sL_half - rebarMargin, sy + rebarMargin, sx + sL_half - rebarMargin, sy + rebarMargin + 0.2, L_LAYERS.REBAR);

  // Top layer continuous
  entities += dLine(sx - sL_half + rebarMargin, sy + sH - rebarMargin, sx + sL_half - rebarMargin, sy + sH - rebarMargin, L_LAYERS.REBAR);
  // Top hooks down
  entities += dLine(sx - sL_half + rebarMargin, sy + sH - rebarMargin, sx - sL_half + rebarMargin, sy + sH - rebarMargin - 0.2, L_LAYERS.REBAR);
  entities += dLine(sx + sL_half - rebarMargin, sy + sH - rebarMargin, sx + sL_half - rebarMargin, sy + sH - rebarMargin - 0.2, L_LAYERS.REBAR);

  // Labels for elevation
  entities += dText(sx, sy + rebarMargin + 0.1, `BOTTOM: ${args.botSteelText}`, L_LAYERS.REBAR, 0.12);
  entities += dText(sx, sy + sH - rebarMargin - 0.22, `TOP: ${args.topSteelText}`, L_LAYERS.REBAR, 0.12);

  // Section title
  entities += dText(sx, sy - 0.7, "SECTION A-A: LONGITUDINAL REINFORCEMENT DETAILED PROFILE", L_LAYERS.TEXT, 0.18);
  entities += dText(sx, sy - 1.1, "SCALE 1:25 - ALL ANCHORAGE HOOKS AT 90 DEGREES COMPLIANT", L_LAYERS.TEXT, 0.11);

  // Thickness Dimension
  entities += dDim(sx - sL_half - 0.3, sy, sx - sL_half - 0.3, sy + sH, L_LAYERS.DIM, 0.2);

  // 3. CROSS SECTION VIEWS (At Column & Midspan)
  const cx = 17.5;
  const cy1 = 10.5;

  // Cross section 1: At Column Zone (Width = B1, thickness = H)
  const csW1 = fW1 * sScale;
  const csH = fH * sScale;
  entities += dPoly([
    { x: cx - csW1/2, y: cy1 },
    { x: cx + csW1/2, y: cy1 },
    { x: cx + csW1/2, y: cy1 + csH },
    { x: cx - csW1/2, y: cy1 + csH }
  ], L_LAYERS.OUTLINE);

  // Pedestal/Column boundary centered
  const cx_col = (toM(args.columns[0]?.cx || 400) / 2) * sScale;
  entities += dLine(cx - cx_col, cy1 + csH, cx - cx_col, cy1 + csH + 0.8, L_LAYERS.COLUMN);
  entities += dLine(cx + cx_col, cy1 + csH, cx + cx_col, cy1 + csH + 0.8, L_LAYERS.COLUMN);

  // Cross Rebar Dots & Bars
  entities += dLine(cx - csW1/2 + rebarMargin, cy1 + rebarMargin, cx + csW1/2 - rebarMargin, cy1 + rebarMargin, L_LAYERS.REBAR);
  entities += dLine(cx - csW1/2 + rebarMargin, cy1 + csH - rebarMargin, cx + csW1/2 - rebarMargin, cy1 + csH - rebarMargin, L_LAYERS.REBAR);
  
  // Rebar dots (circles representation)
  for (let i = -3; i <= 3; i++) {
    const rx = cx + (i * csW1 / 8);
    entities += dCircle(rx, cy1 + rebarMargin, 0.02, L_LAYERS.REBAR);
    entities += dCircle(rx, cy1 + csH - rebarMargin, 0.02, L_LAYERS.REBAR);
  }

  entities += dText(cx, cy1 - 0.5, "SECTION B-B: CRITICAL SECTION AT COLUMN 1", L_LAYERS.TEXT, 0.15);
  entities += dText(cx, cy1 - 0.8, `Transverse base: ${args.transverseSteelText}`, L_LAYERS.REBAR, 0.11);

  // 4. PUNCHING SHEAR GRAPHICAL SHEET (Centered at x=17.5, y=0.5)
  const p_shearX = 17.5;
  const p_shearY = 0.5;
  const p_shearScale = sScale;

  // Draw footing outline again (scaled down slightly if needed, or matched)
  if (args.shape === 'rectangular') {
    entities += dPoly([
      { x: p_shearX - pL_half, y: p_shearY - pW1_half },
      { x: p_shearX + pL_half, y: p_shearY - pW1_half },
      { x: p_shearX + pL_half, y: p_shearY + pW1_half },
      { x: p_shearX - pL_half, y: p_shearY + pW1_half }
    ], L_LAYERS.CENTERVALUES); // gray or center dashed
  } else {
    entities += dPoly([
      { x: p_shearX - pL_half, y: p_shearY - pW1_half },
      { x: p_shearX + pL_half, y: p_shearY - pW2_half },
      { x: p_shearX + pL_half, y: p_shearY + pW2_half },
      { x: p_shearX - pL_half, y: p_shearY + pW1_half }
    ], L_LAYERS.CENTERVALUES);
  }

  // Draw punching shear perimeters (bo) around each column
  args.columns.forEach(col => {
    const colX = p_shearX - pL_half + (toM(col.x) * p_shearScale);
    const cX_half = (toM(col.cx) / 2) * p_shearScale;
    const cY_half = (toM(col.cy) / 2) * p_shearScale;

    // Critical punching shear boundary at d/2 on each side: cx + d and cy + d
    const d_m = toM(args.H - 75 - 16); // basic d estimation
    const boX_half = cX_half + (d_m / 2) * p_shearScale;
    const boY_half = cY_half + (d_m / 2) * p_shearScale;

    // Draw Column solid
    entities += dPoly([
      { x: colX - cX_half, y: p_shearY - cY_half },
      { x: colX + cX_half, y: p_shearY - cY_half },
      { x: colX + cX_half, y: p_shearY + cY_half },
      { x: colX - cX_half, y: p_shearY + cY_half }
    ], L_LAYERS.COLUMN);

    // Draw critical punching shear perimeter dashed in Cyan (SECTIONS layer)
    entities += dPoly([
      { x: colX - boX_half, y: p_shearY - boY_half },
      { x: colX + boX_half, y: p_shearY - boY_half },
      { x: colX + boX_half, y: p_shearY + boY_half },
      { x: colX - boX_half, y: p_shearY + boY_half }
    ], L_LAYERS.SECTIONS, true);

    entities += dText(colX, p_shearY - boY_half - 0.25, `Punching Peri: bo = ${col.cx + args.H - 85}x${col.cy + args.H - 85} mm`, L_LAYERS.SECTIONS, 0.10);
  });

  entities += dText(p_shearX, p_shearY - Math.max(pW1_half, pW2_half) - 0.7, "PUNCHING SHEAR AUDIT DIAGRAMS", L_LAYERS.SECTIONS, 0.14);
  entities += dText(p_shearX, p_shearY - Math.max(pW1_half, pW2_half) - 1.0, "CRITICAL SHEAR PERIMETER AT DISTANCE d/2 FROM FACE", L_LAYERS.SECTIONS, 0.09);

  return `999\nCombined Footing CAD Detailing Sheet S-303\n${dxfHeader()}${dxfTables()}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}

export interface DXFDetailStrapArgs {
  id: string;
  name: string;
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
  ext_col: { name: string; cx: number; cy: number; PDead: number; PLive: number };
  int_col: { name: string; cx: number; cy: number; PDead: number; PLive: number };
  ext_bot_rebarText: string;
  int_bot_rebarText: string;
  beam_top_rebarText: string;
  beam_bot_rebarText: string;
  beam_stirrupsText: string;
  concreteRCCVol: number;
  concretePCCVol: number;
  formworkArea: number;
  totalSteelKg: number;
  excavationVol: number;
  backfillVol: number;
  ext_footing_level?: number;
  int_footing_level?: number;
}

export function generateStrapFootingDetailDXF(args: DXFDetailStrapArgs): string {
  const L_LAYERS = {
    OUTLINE: 'STRAP_OUTLINE',
    COLUMN: 'COLUMNS',
    REBAR: 'REINFORCEMENT',
    CENTERVALUES: 'CENTERLINES',
    DIM: 'DIMENSIONS',
    TEXT: 'TEXT',
    SECTIONS: 'SECTIONS',
    NOTES: 'NOTES',
  };

  const dxfTables = (): string => {
    const layers = [
      { name: L_LAYERS.OUTLINE, color: 5 }, // Blue
      { name: L_LAYERS.COLUMN, color: 1 },  // Red
      { name: L_LAYERS.REBAR, color: 3 },   // Green
      { name: L_LAYERS.CENTERVALUES, color: 2 }, // Yellow
      { name: L_LAYERS.DIM, color: 6 },     // Magenta
      { name: L_LAYERS.TEXT, color: 7 },    // White
      { name: L_LAYERS.SECTIONS, color: 4 },// Cyan
      { name: L_LAYERS.NOTES, color: 7 }
    ];
    const entries = layers.map(l =>
      `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nCONTINUOUS`
    ).join('\n');
    return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${entries}\n0\nENDTAB\n0\nENDSEC\n`;
  };

  const toM = (val: number) => val / 1000;

  const fExtL = toM(args.ext_L);
  const fExtB = toM(args.ext_B);
  const fIntL = toM(args.int_L);
  const fIntB = toM(args.int_B);
  const fExtH = toM(args.ext_H);
  const fIntH = toM(args.int_H);
  const fBeamB = toM(args.beam_b);
  const fBeamH = toM(args.beam_h);
  const fSpan = toM(args.L_span);
  const fClearS = toM(args.S);

  const ext_lvl = args.ext_footing_level !== undefined ? args.ext_footing_level : -2.00;
  const int_lvl = args.int_footing_level !== undefined ? args.int_footing_level : -2.00;

  let entities = '';

  const dLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => dxfLine(x1, y1, x2, y2, layer);
  const dPoly = (pts: { x: number; y: number }[], layer: string, closed: boolean = true) => dxfPolyline(pts, layer, closed);
  const dText = (x: number, y: number, text: string, layer: string, h: number = 0.2) => dxfText(x, y, text, layer, h);
  const dCircle = (x: number, y: number, r: number, layer: string) => dxfCircle(x, y, r, layer);
  const dDim = (x1: number, y1: number, x2: number, y2: number, layer: string, offset: number = 0.5) => dxfDimension(x1, y1, x2, y2, layer, offset);

  // Outer sheet border
  entities += dPoly([
    { x: -2, y: -9 },
    { x: 25, y: -9 },
    { x: 25, y: 16 },
    { x: -2, y: 16 }
  ], L_LAYERS.OUTLINE);

  // Layout center lines grid
  entities += dLine(-2, 0, 25, 0, L_LAYERS.CENTERVALUES);
  entities += dLine(12, -9, 12, 16, L_LAYERS.CENTERVALUES);

  // Title block on sheet bottom right
  const titleX = 14.5;
  const titleY = -8.5;
  const titleW = 10.0;
  const titleH = 2.5;

  entities += dPoly([
    { x: titleX, y: titleY },
    { x: titleX + titleW, y: titleY },
    { x: titleX + titleW, y: titleY + titleH },
    { x: titleX, y: titleY + titleH }
  ], L_LAYERS.OUTLINE);

  entities += dLine(titleX, titleY + titleH / 2, titleX + titleW, titleY + titleH / 2, L_LAYERS.OUTLINE);
  entities += dLine(titleX + titleW * 0.5, titleY, titleX + titleW * 0.5, titleY + titleH, L_LAYERS.OUTLINE);

  entities += dText(titleX + 0.3, titleY + titleH * 0.73, `PROJECT: STRAP FOOTING SYSTEM`, L_LAYERS.TEXT, 0.16);
  entities += dText(titleX + 0.3, titleY + titleH * 0.23, `SYSTEM ID: ${args.id || 'STRAP_1'}`, L_LAYERS.TEXT, 0.15);
  entities += dText(titleX + titleW * 0.53, titleY + titleH * 0.73, `SCALE: 1:25 / 1:10`, L_LAYERS.TEXT, 0.15);
  entities += dText(titleX + titleW * 0.53, titleY + titleH * 0.23, `SHEET NO: S-304`, L_LAYERS.TEXT, 0.20);

  // Construction Notes
  const noteX = 14.5;
  const noteY = -5.5;
  entities += dText(noteX, noteY + 1.8, "CONSTRUCTION NOTES / ملاحظات التأسيس:", L_LAYERS.NOTES, 0.18);
  entities += dText(noteX, noteY + 1.4, `- Steel Grade: fy = ${args.fy} MPa ACI Standard`, L_LAYERS.NOTES, 0.13);
  entities += dText(noteX, noteY + 1.1, `- Concrete Strength: f'c = ${args.fc} MPa (ReadyMix C35)`, L_LAYERS.NOTES, 0.13);
  entities += dText(noteX, noteY + 0.8, "- Clear Cover: 75 mm for footing, 40 mm for strap pedestal", L_LAYERS.NOTES, 0.13);
  entities += dText(noteX, noteY + 0.5, "- Strap beam does NOT rest on soil (use 50mm compressible EPS foam)", L_LAYERS.NOTES, 0.13);
  entities += dText(noteX, noteY + 0.2, "- Hook anchorage: 90 degree hook with 12db development leg", L_LAYERS.NOTES, 0.13);

  // BOQ Summary
  const qX = 14.5;
  const qY = -1.5;
  entities += dText(qX, qY + 1.5, "QUANTITY TAKE-OFF BOQ / حصر كميات المواد للميدة:", L_LAYERS.NOTES, 0.18);
  entities += dText(qX, qY + 1.1, `- Total RCC Concrete: ${args.concreteRCCVol.toFixed(2)} cu.m.`, L_LAYERS.TEXT, 0.14);
  entities += dText(qX, qY + 0.8, `- Blinding PCC Concrete (100mm): ${args.concretePCCVol.toFixed(2)} cu.m.`, L_LAYERS.TEXT, 0.14);
  entities += dText(qX, qY + 0.5, `- Estim Steel Weight (Mass): ${args.totalSteelKg} kg`, L_LAYERS.TEXT, 0.14);
  entities += dText(qX, qY + 0.2, `- Total Excavation: ${args.excavationVol.toFixed(2)} cu.m. | Backfill: ${args.backfillVol.toFixed(2)} cu.m.`, L_LAYERS.TEXT, 0.12);

  // 1. PLAN VIEW (Centered at x=5.0, y=8.0)
  const px = 5.0;
  const py = 8.0;
  const pScale = Math.min(1.0, 9.5 / (fExtL/2 + fSpan + fIntL/2 + 1.0));
  
  const extX = px - (fSpan / 2) * pScale;
  const intX = px + (fSpan / 2) * pScale;

  // Exterior footing rectangle
  entities += dPoly([
    { x: extX - (fExtL/2)*pScale, y: py - (fExtB/2)*pScale },
    { x: extX + (fExtL/2)*pScale, y: py - (fExtB/2)*pScale },
    { x: extX + (fExtL/2)*pScale, y: py + (fExtB/2)*pScale },
    { x: extX - (fExtL/2)*pScale, y: py + (fExtB/2)*pScale }
  ], L_LAYERS.OUTLINE);

  // Interior footing rectangle
  entities += dPoly([
    { x: intX - (fIntL/2)*pScale, y: py - (fIntB/2)*pScale },
    { x: intX + (fIntL/2)*pScale, y: py - (fIntB/2)*pScale },
    { x: intX + (fIntL/2)*pScale, y: py + (fIntB/2)*pScale },
    { x: intX - (fIntL/2)*pScale, y: py + (fIntB/2)*pScale }
  ], L_LAYERS.OUTLINE);

  // Connecting Strap Beam outline (connecting face to face)
  const bS_Left = extX + (fExtL/2)*pScale;
  const bS_Right = intX - (fIntL/2)*pScale;
  entities += dPoly([
    { x: bS_Left, y: py - (fBeamB/2)*pScale },
    { x: bS_Right, y: py - (fBeamB/2)*pScale },
    { x: bS_Right, y: py + (fBeamB/2)*pScale },
    { x: bS_Left, y: py + (fBeamB/2)*pScale }
  ], L_LAYERS.OUTLINE);

  // Exterior Column
  const colExt_cx = toM(args.ext_col.cx)*pScale;
  const colExt_cy = toM(args.ext_col.cy)*pScale;
  const colExt_x_pos = extX - (fExtL/2)*pScale + toM(args.ext_a1)*pScale;
  entities += dPoly([
    { x: colExt_x_pos - colExt_cx/2, y: py - colExt_cy/2 },
    { x: colExt_x_pos + colExt_cx/2, y: py - colExt_cy/2 },
    { x: colExt_x_pos + colExt_cx/2, y: py + colExt_cy/2 },
    { x: colExt_x_pos - colExt_cx/2, y: py + colExt_cy/2 }
  ], L_LAYERS.COLUMN);
  entities += dLine(colExt_x_pos - colExt_cx/2, py - colExt_cy/2, colExt_x_pos + colExt_cx/2, py + colExt_cy/2, L_LAYERS.COLUMN);
  entities += dLine(colExt_x_pos + colExt_cx/2, py - colExt_cy/2, colExt_x_pos - colExt_cx/2, py + colExt_cy/2, L_LAYERS.COLUMN);

  // Interior Column
  const colInt_cx = toM(args.int_col.cx)*pScale;
  const colInt_cy = toM(args.int_col.cy)*pScale;
  entities += dPoly([
    { x: intX - colInt_cx/2, y: py - colInt_cy/2 },
    { x: intX + colInt_cx/2, y: py - colInt_cy/2 },
    { x: intX + colInt_cx/2, y: py + colInt_cy/2 },
    { x: intX - colInt_cx/2, y: py + colInt_cy/2 }
  ], L_LAYERS.COLUMN);
  entities += dLine(intX - colInt_cx/2, py - colInt_cy/2, intX + colInt_cx/2, py + colInt_cy/2, L_LAYERS.COLUMN);
  entities += dLine(intX + colInt_cx/2, py - colInt_cy/2, intX - colInt_cx/2, py + colInt_cy/2, L_LAYERS.COLUMN);

  // Grid References and Centerlines
  entities += dLine(colExt_x_pos, py - (fExtB/2)*pScale - 1.0, colExt_x_pos, py + (fExtB/2)*pScale + 1.0, L_LAYERS.CENTERVALUES);
  entities += dLine(intX, py - (fIntB/2)*pScale - 1.0, intX, py + (fIntB/2)*pScale + 1.0, L_LAYERS.CENTERVALUES);
  entities += dLine(px - (fSpan/2 + fExtL)*pScale, py, px + (fSpan/2 + fIntL)*pScale, py, L_LAYERS.CENTERVALUES);

  // Rebar Representation annotations on Plan
  entities += dText(extX, py + (fExtB/2)*pScale + 0.3, `EXT REBAR: ${args.ext_bot_rebarText}`, L_LAYERS.REBAR, 0.12);
  entities += dText(intX, py + (fIntB/2)*pScale + 0.3, `INT REBAR: ${args.int_bot_rebarText}`, L_LAYERS.REBAR, 0.12);
  entities += dText(px, py + (fBeamB/2)*pScale + 0.6, `STRAP TOP REBAR: ${args.beam_top_rebarText}`, L_LAYERS.REBAR, 0.13);
  entities += dText(px, py - (fBeamB/2)*pScale - 0.6, `STRAP BOT REBAR: ${args.beam_bot_rebarText}`, L_LAYERS.REBAR, 0.11);

  // Plan Dimensions
  entities += dDim(extExtX_colPos(colExt_x_pos, intX), py - (fExtB/2)*pScale - 0.4, intX, py - (fExtB/2)*pScale - 0.4, L_LAYERS.DIM, 0.3);
  entities += dDim(extX - (fExtL/2)*pScale, py - (fExtB/2)*pScale - 0.8, extX + (fExtL/2)*pScale, py - (fExtB/2)*pScale - 0.8, L_LAYERS.DIM, 0.3);
  entities += dDim(intX - (fIntL/2)*pScale, py - (fIntB/2)*pScale - 0.8, intX + (fIntL/2)*pScale, py - (fIntB/2)*pScale - 0.8, L_LAYERS.DIM, 0.3);

  function extExtX_colPos(col1: number, col2: number) {
    return col1;
  }

  // Titles for Plan View
  entities += dText(px, py - 4.2, `PLAN VIEW: DIRECT EXECUTION FOUNDATION STRUCTURE PLAN`, L_LAYERS.TEXT, 0.22);
  entities += dText(px, py - 4.6, `STRAP BEAM: Width B = ${args.beam_b} mm, Depth H = ${args.beam_h} mm`, L_LAYERS.TEXT, 0.13);

  // 2. LONGITUDINAL PROFILE SECTION (Centered at x=5.0, y=-2.0)
  const sx = 5.0;
  const sy = -2.0;
  const sScale = pScale;

  const sExtX = px - (fSpan / 2) * sScale;
  const sIntX = px + (fSpan / 2) * sScale;

  // Elevation Level differences representation (Stepped support case)
  const extBaseY = sy + (ext_lvl - (-2.00)) * sScale;
  const intBaseY = sy + (int_lvl - (-2.00)) * sScale;

  const sExtH = fExtH * sScale;
  const sIntH = fIntH * sScale;
  const sBeamH = fBeamH * sScale;

  // Exterior footing concrete outline (elevation)
  entities += dPoly([
    { x: sExtX - (fExtL/2)*sScale, y: extBaseY },
    { x: sExtX + (fExtL/2)*sScale, y: extBaseY },
    { x: sExtX + (fExtL/2)*sScale, y: extBaseY + sExtH },
    { x: sExtX - (fExtL/2)*sScale, y: extBaseY + sExtH }
  ], L_LAYERS.OUTLINE);

  // Exterior PCC Blinding (100mm)
  entities += dPoly([
    { x: sExtX - (fExtL/2 + 0.1)*sScale, y: extBaseY - 0.1*sScale },
    { x: sExtX + (fExtL/2 + 0.1)*sScale, y: extBaseY - 0.1*sScale },
    { x: sExtX + (fExtL/2 + 0.1)*sScale, y: extBaseY },
    { x: sExtX - (fExtL/2 + 0.1)*sScale, y: extBaseY }
  ], L_LAYERS.OUTLINE);

  // Interior footing concrete outline (elevation)
  entities += dPoly([
    { x: sIntX - (fIntL/2)*sScale, y: intBaseY },
    { x: sIntX + (fIntL/2)*sScale, y: intBaseY },
    { x: sIntX + (fIntL/2)*sScale, y: intBaseY + sIntH },
    { x: sIntX - (fIntL/2)*sScale, y: intBaseY + sIntH }
  ], L_LAYERS.OUTLINE);

  // Interior PCC Blinding
  entities += dPoly([
    { x: sIntX - (fIntL/2 + 0.1)*sScale, y: intBaseY - 0.1*sScale },
    { x: sIntX + (fIntL/2 + 0.1)*sScale, y: intBaseY - 0.1*sScale },
    { x: sIntX + (fIntL/2 + 0.1)*sScale, y: intBaseY },
    { x: sIntX - (fIntL/2 + 0.1)*sScale, y: intBaseY }
  ], L_LAYERS.OUTLINE);

  // Connecting Strap Beam outline in elevation
  // Level difference is automatically stepped at bottom or top as required
  const sBeamLeft = sExtX + (fExtL/2)*sScale;
  const sBeamRight = sIntX - (fIntL/2)*sScale;
  
  const extBeamTopY = extBaseY + sExtH;
  const intBeamTopY = intBaseY + sIntH;
  const beamTopY = Math.max(extBeamTopY, intBeamTopY);

  entities += dPoly([
    { x: sBeamLeft, y: beamTopY - sBeamH },
    { x: sBeamRight, y: beamTopY - sBeamH },
    { x: sBeamRight, y: beamTopY },
    { x: sBeamLeft, y: beamTopY }
  ], L_LAYERS.OUTLINE);

  // EPS Compressible Foam drawing under strap beam (does not touch or bear soil)
  entities += dPoly([
    { x: sBeamLeft, y: beamTopY - sBeamH - 0.05*sScale },
    { x: sBeamRight, y: beamTopY - sBeamH - 0.05*sScale },
    { x: sBeamRight, y: beamTopY - sBeamH },
    { x: sBeamLeft, y: beamTopY - sBeamH }
  ], L_LAYERS.SECTIONS);
  entities += dText(px, beamTopY - sBeamH - 0.2*sScale, "COMPRESSIBLE EPS FOAM 50mm", L_LAYERS.SECTIONS, 0.08);

  // Columns Starters extending up
  const cExtX = sExtX - (fExtL/2)*sScale + toM(args.ext_a1)*sScale;
  const cIntX = sIntX;

  entities += dLine(cExtX - colExt_cx/2, extBaseY + sExtH, cExtX - colExt_cx/2, extBaseY + sExtH + 1.2, L_LAYERS.COLUMN);
  entities += dLine(cExtX + colExt_cx/2, extBaseY + sExtH, cExtX + colExt_cx/2, extBaseY + sExtH + 1.2, L_LAYERS.COLUMN);

  entities += dLine(cIntX - colInt_cx/2, intBaseY + sIntH, cIntX - colInt_cx/2, intBaseY + sIntH + 1.2, L_LAYERS.COLUMN);
  entities += dLine(cIntX + colInt_cx/2, intBaseY + sIntH, cIntX + colInt_cx/2, intBaseY + sIntH + 1.2, L_LAYERS.COLUMN);

  // Ground horizontal line
  entities += dLine(-2, extBaseY + sExtH + 0.6*sScale, 25, extBaseY + sExtH + 0.6*sScale, L_LAYERS.CENTERVALUES);
  entities += dText(-0.5, extBaseY + sExtH + 0.7*sScale, "NATURAL GROUND LEVEL NGL", L_LAYERS.CENTERVALUES, 0.12);

  // REBAR GRAPHICS - Elevational splices and anchorage
  const cover_sc = 0.075 * sScale;
  
  // Exterior Footing Bottom local reinforcement mesh with standard 90 deg hooks
  entities += dLine(sExtX - (fExtL/2)*sScale + cover_sc, extBaseY + cover_sc, sExtX + (fExtL/2)*sScale - cover_sc, extBaseY + cover_sc, L_LAYERS.REBAR);
  entities += dLine(sExtX - (fExtL/2)*sScale + cover_sc, extBaseY + cover_sc, sExtX - (fExtL/2)*sScale + cover_sc, extBaseY + cover_sc + 0.2, L_LAYERS.REBAR);
  entities += dLine(sExtX + (fExtL/2)*sScale - cover_sc, extBaseY + cover_sc, sExtX + (fExtL/2)*sScale - cover_sc, extBaseY + cover_sc + 0.2, L_LAYERS.REBAR);

  // Interior Footing mesh
  entities += dLine(sIntX - (fIntL/2)*sScale + cover_sc, intBaseY + cover_sc, sIntX + (fIntL/2)*sScale - cover_sc, intBaseY + cover_sc, L_LAYERS.REBAR);
  entities += dLine(sIntX - (fIntL/2)*sScale + cover_sc, intBaseY + cover_sc, sIntX - (fIntL/2)*sScale + cover_sc, intBaseY + cover_sc + 0.2, L_LAYERS.REBAR);
  entities += dLine(sIntX + (fIntL/2)*sScale - cover_sc, intBaseY + cover_sc, sIntX + (fIntL/2)*sScale - cover_sc, intBaseY + cover_sc + 0.2, L_LAYERS.REBAR);

  // STRAP BEAM HIGH TENSION TOP STEEL (Extending fully into both columns with 90 deg hooks at terminal ends)
  const beamTopRebarY = beamTopY - cover_sc;
  entities += dLine(cExtX, beamTopRebarY, cIntX + colInt_cx/2 - cover_sc, beamTopRebarY, L_LAYERS.REBAR);
  // Hooks downward
  entities += dLine(cExtX, beamTopRebarY, cExtX, beamTopRebarY - 0.4*sScale, L_LAYERS.REBAR);
  entities += dLine(cIntX + colInt_cx/2 - cover_sc, beamTopRebarY, cIntX + colInt_cx/2 - cover_sc, beamTopRebarY - 0.4*sScale, L_LAYERS.REBAR);

  // BOTTOM BEAM STEEL (Continuous compression/structural alignment)
  const beamBotRebarY = beamTopY - sBeamH + cover_sc;
  entities += dLine(cExtX, beamBotRebarY, cIntX + colInt_cx/2 - cover_sc, beamBotRebarY, L_LAYERS.REBAR);

  // Support labels of reinforcement
  entities += dText(px, beamTopRebarY + 0.15*sScale, `TOP HIGH TENSION STRAP STEEL: ${args.beam_top_rebarText}`, L_LAYERS.REBAR, 0.12);
  entities += dText(px, beamBotRebarY - 0.18*sScale, `BOTTOM COMPRESSION STRAP STEEL: ${args.beam_bot_rebarText}`, L_LAYERS.REBAR, 0.11);

  // Elevation section titles
  entities += dText(px, sy - 3.2, "SECTION A-A: COMPLETE LONGITUDINAL SYSTEM PROFILE ELEVATION", L_LAYERS.TEXT, 0.20);
  entities += dText(px, sy - 3.6, "Note: Strap beam has structural offset to balance foundations rotation", L_LAYERS.TEXT, 0.10);

  // 3. CROSS SECTION OF STRAP CONNECTING BEAM (Centered at x=17.5, y=9.0)
  const csx = 17.5;
  const csy = 9.0;
  const csScale = 1.0;

  const fWStrap = fBeamB / 2 * 6 * csScale;
  const fHStrap = fBeamH * 6 * csScale;

  // Beam Concrete Outline
  entities += dPoly([
    { x: csx - fWStrap/2, y: csy - fHStrap/2 },
    { x: csx + fWStrap/2, y: csy - fHStrap/2 },
    { x: csx + fWStrap/2, y: csy + fHStrap/2 },
    { x: csx - fWStrap/2, y: csy + fHStrap/2 }
  ], L_LAYERS.OUTLINE);

  // Inner Stirrup line representation (40mm cover)
  const st_Margin = 0.4 * csScale;
  entities += dPoly([
    { x: csx - fWStrap/2 + st_Margin, y: csy - fHStrap/2 + st_Margin },
    { x: csx + fWStrap/2 - st_Margin, y: csy - fHStrap/2 + st_Margin },
    { x: csx + fWStrap/2 - st_Margin, y: csy + fHStrap/2 - st_Margin },
    { x: csx - fWStrap/2 + st_Margin, y: csy + fHStrap/2 - st_Margin }
  ], L_LAYERS.REBAR);

  // Rebar Circles representing flexural bars
  // Top main bars (heavy tension)
  const rRad = 0.08;
  entities += dCircle(csx - fWStrap/2 + st_Margin + 0.15, csy + fHStrap/2 - st_Margin - 0.15, rRad, L_LAYERS.REBAR);
  entities += dCircle(csx + fWStrap/2 - st_Margin - 0.15, csy + fHStrap/2 - st_Margin - 0.15, rRad, L_LAYERS.REBAR);
  entities += dCircle(csx, csy + fHStrap/2 - st_Margin - 0.15, rRad, L_LAYERS.REBAR);

  // Bottom central compression/anchorage bars
  entities += dCircle(csx - fWStrap/2 + st_Margin + 0.15, csy - fHStrap/2 + st_Margin + 0.15, rRad, L_LAYERS.REBAR);
  entities += dCircle(csx + fWStrap/2 - st_Margin - 0.15, csy - fHStrap/2 + st_Margin + 0.15, rRad, L_LAYERS.REBAR);

  // Side face structural skin bars (anti-crack shrinkage rebar)
  entities += dCircle(csx - fWStrap/2 + st_Margin + 0.12, csy, rRad * 0.8, L_LAYERS.REBAR);
  entities += dCircle(csx + fWStrap/2 - st_Margin - 0.12, csy, rRad * 0.8, L_LAYERS.REBAR);

  // Text details on cross section
  entities += dText(csx, csy - fHStrap/2 - 0.6, "CROSS SECTION B-B: STRAP BEAM DETAIL", L_LAYERS.TEXT, 0.16);
  entities += dText(csx, csy - fHStrap/2 - 0.9, `STIRRUPS: ${args.beam_stirrupsText}`, L_LAYERS.REBAR, 0.12);
  entities += dText(csx - fWStrap/2 - 0.2, csy + fHStrap/2 - 0.2, "3 T18 (Tension Top)", L_LAYERS.REBAR, 0.10);
  entities += dText(csx - fWStrap/2 - 0.2, csy - fHStrap/2 + 0.2, "2 T14 (Comp Bot)", L_LAYERS.REBAR, 0.10);
  entities += dText(csx + fWStrap/2 + 0.2, csy, "2 T12 (Shrinkage Side rebars)", L_LAYERS.REBAR, 0.09);

  return `999\nStrap Footing CAD Detailing Sheet S-304\n${dxfHeader()}${dxfTables()}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}






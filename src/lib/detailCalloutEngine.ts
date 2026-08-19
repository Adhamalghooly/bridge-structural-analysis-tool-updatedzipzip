/**
 * Detail Callout Engine - Phase D4 Dual-Link System
 * Connects structural layouts, sections, reinforcement plans, schedules, and details.
 * Manages click navigation, automatic numbering, cascade re-numbering, and QA audits.
 */

import { DrawingSheet } from './drawingCoreEngine';

export type CalloutType =
  | 'detail'       // e.g. Detail 1/S-201
  | 'section'      // e.g. Section A-A
  | 'elevation'    // e.g. North Side Elev.
  | 'schedule'     // e.g. See Beam Schedule B1
  | 'sheet'        // e.g. Match line, see Sheet S-201
  | 'continuation';// e.g. Continued on Sheet S-102

export interface CalloutMark {
  id: string;
  type: CalloutType;
  mark: string;           // E.g. "Detail 1/S-201"
  number: string;         // E.g. "1", "4", "A"
  targetSheetNo: string;  // E.g. "S-201"
  targetSheetId: string;  // E.g. "SH-FOUNDATION-REBAR"
  sourceSheetId: string;  // Origin sheet e.g. "SH-STORY-1"
  title: string;          // Human description
  x: number;              // Paper space position X (mm)
  y: number;              // Paper space position Y (mm)
  radius?: number;        // Hotspot click area size (mm)
  description: string;
  section?: string;       // Structural component section
  targetFocusX?: number;  // Pan focus point x when clicked
  targetFocusY?: number;  // Pan focus point y
  targetZoom?: number;    // Zoom alignment level
}

export interface QAValidationIssue {
  id: string;
  severity: 'high' | 'medium' | 'info';
  type: 'broken' | 'duplicate' | 'orphan' | 'mismatch';
  message: string;
  relatedCalloutId?: string;
  remedyActionName: string;
  remedyPayload?: any;
}

export class DetailCalloutEngine {
  /**
   * Generates a fully populated relational database of drawing references
   */
  public static buildDefaultCallouts(
    sheets: DrawingSheet[],
    sheetNumberMap: Record<string, string>
  ): CalloutMark[] {
    const callouts: CalloutMark[] = [];

    // Base mock coordinate sets representing prominent hotspots on typical structural sheets
    // Let's map references centered on slab panels, columns, and footing blocks
    sheets.forEach(sheet => {
      const sheetNo = sheetNumberMap[sheet.id] || 'S-101';

      if (sheet.id.includes('STORY') || sheet.id.includes('story')) {
        // Floor Plan Sheets
        // Point to Foundation Detail on S-201
        callouts.push({
          id: `ref-found-${sheet.id}`,
          type: 'detail',
          mark: `Detail 1/${sheetNumberMap['SH-FOUNDATION-REBAR'] || 'S-201'}`,
          number: '1',
          targetSheetNo: sheetNumberMap['SH-FOUNDATION-REBAR'] || 'S-201',
          targetSheetId: 'SH-FOUNDATION-REBAR',
          sourceSheetId: sheet.id,
          title: 'Footing Bottom Rebar Grid',
          x: 40,
          y: 40,
          radius: 12,
          description: 'Anchored double mesh base placement. Controls flexural tensile cracks in heavy footings.',
          targetFocusX: 180,
          targetFocusY: 200,
          targetZoom: 1.3
        });

        // Point to Section A-A slab section
        callouts.push({
          id: `ref-section-a-${sheet.id}`,
          type: 'section',
          mark: 'Section A-A',
          number: 'A',
          targetSheetNo: sheetNo,
          targetSheetId: sheet.id,
          sourceSheetId: sheet.id,
          title: 'Continuous Top Beam Steel Rebar reinforcement profile',
          x: 230,
          y: 190,
          radius: 10,
          description: 'Hogging negative steel moments. Placed directly over rigid support nodes.',
          targetFocusX: 200,
          targetFocusY: 150,
          targetZoom: 1.1
        });

        // Point to Beam Schedule
        callouts.push({
          id: `ref-beam-sched-${sheet.id}`,
          type: 'schedule',
          mark: `See Beam Schedule B1`,
          number: 'B1',
          targetSheetNo: sheetNumberMap['SH-STU-1'] || 'S-301',
          targetSheetId: sheets.find(s => s.id === 'SH-STU-1') ? 'SH-STU-1' : sheet.id,
          sourceSheetId: sheet.id,
          title: 'Main Framing Schedule (STA4CAD standard template)',
          x: 100,
          y: 350,
          radius: 14,
          description: 'Standard sizing schema detailing clear span longitudinal bars and seismic shear ties stirrups.',
          targetFocusX: 400,
          targetFocusY: 250,
          targetZoom: 0.95
        });

        // Point to Column Detail S-301
        callouts.push({
          id: `ref-col-det-${sheet.id}`,
          type: 'detail',
          mark: `Detail 4/${sheetNumberMap['SH-STU-1'] || 'S-301'}`,
          number: '4',
          targetSheetNo: sheetNumberMap['SH-STU-1'] || 'S-301',
          targetSheetId: sheets.find(s => s.id === 'SH-STU-1') ? 'SH-STU-1' : sheet.id,
          sourceSheetId: sheet.id,
          title: 'Column Longitudinal Starters',
          x: 320,
          y: 120,
          radius: 11,
          description: 'Overlapping compression starters with robust confinement links. Built to resist ground acceleration.',
          targetFocusX: 120,
          targetFocusY: 340,
          targetZoom: 1.4
        });
      }

      if (sheet.id.includes('FOUNDATION') || sheet.id.includes('found')) {
        // Foundation rebar sheet
        // Link to Detail 3/S-201 (Slab Detail)
        callouts.push({
          id: `ref-slab-det-f`,
          type: 'detail',
          mark: `Detail 3/${sheetNumberMap['SH-STORY-1'] || 'S-101'}`,
          number: '3',
          targetSheetNo: sheetNumberMap['SH-STORY-1'] || 'S-101',
          targetSheetId: 'SH-STORY-1',
          sourceSheetId: sheet.id,
          title: 'Slab Column Junction Anchorages',
          x: 60,
          y: 320,
          radius: 10,
          description: 'Negative reinforcement hooks transferring column load cleanly into surrounding deck.',
          targetFocusX: 250,
          targetFocusY: 220,
          targetZoom: 1.25
        });

        // Link Section B-B
        callouts.push({
          id: `ref-sec-b-f`,
          type: 'section',
          mark: 'Section B-B',
          number: 'B',
          targetSheetNo: sheetNo,
          targetSheetId: sheet.id,
          sourceSheetId: sheet.id,
          title: 'Deep Pad Column Connection Cut',
          x: 270,
          y: 150,
          radius: 12,
          description: 'Transverse shear planes. Assures structural resistance against critical punching failures.',
          targetFocusX: 100,
          targetFocusY: 80,
          targetZoom: 1.15
        });
      }
    });

    return callouts;
  }

  /**
   * Run real-time QA audit testing for reference link integrity
   */
  public static validateReferences(
    callouts: CalloutMark[],
    sheetNumberMap: Record<string, string>,
    sheets: DrawingSheet[]
  ): QAValidationIssue[] {
    const issues: QAValidationIssue[] = [];
    const validSheetNumbers = new Set(Object.values(sheetNumberMap));

    // Keep track of counts to identify duplicate callout numbers on the same sheet
    const groupKeyMap = new Map<string, string[]>();

    callouts.forEach(c => {
      // 1. Broken link check: points to a sheet number that does not exist or sheet mapping is invalid
      if (!validSheetNumbers.has(c.targetSheetNo)) {
        issues.push({
          id: `issue-broken-${c.id}`,
          severity: 'high',
          type: 'broken',
          message: `Broken reference "${c.mark}" placed on sheet "${sheetNumberMap[c.sourceSheetId] || 'Plan'}". Referenced Sheet "${c.targetSheetNo}" does not exist in compiler database.`,
          relatedCalloutId: c.id,
          remedyActionName: 'Re-route to closest sheet',
          remedyPayload: { calloutId: c.id, targetSheetNo: Object.values(sheetNumberMap)[0] || 'S-101' }
        });
      }

      // 2. Duplicate active callout definitions check
      const groupKey = `${c.sourceSheetId}-${c.type}-${c.number}`;
      if (!groupKeyMap.has(groupKey)) {
        groupKeyMap.set(groupKey, []);
      }
      groupKeyMap.get(groupKey)!.push(c.id);
    });

    // Check for duplicates
    groupKeyMap.forEach((ids, key) => {
      if (ids.length > 1) {
        const firstId = ids[0];
        const duplicates = ids.slice(1);
        duplicates.forEach(dupId => {
          const c = callouts.find(x => x.id === dupId);
          if (c) {
            issues.push({
              id: `issue-dup-${c.id}`,
              severity: 'medium',
              type: 'duplicate',
              message: `Duplicate Callout Numbering "${c.type.toUpperCase()} ${c.number}" detected on database for Sheet "${sheetNumberMap[c.sourceSheetId] || 'Plan'}".`,
              relatedCalloutId: c.id,
              remedyActionName: 'Auto-Assign next sequential number',
              remedyPayload: { calloutId: c.id, type: c.type, sourceSheetId: c.sourceSheetId }
            });
          }
        });
      }
    });

    // 3. Check for orphan records: sheets that are referenced but never mentioned (or sheets that aren't accessed)
    sheets.forEach(sheet => {
      const sNo = sheetNumberMap[sheet.id];
      if (sNo) {
        const isReferenced = callouts.some(c => c.targetSheetNo === sNo);
        if (!isReferenced && sheets.length > 2 && !sNo.startsWith('S-101')) {
          issues.push({
            id: `issue-orphan-${sheet.id}`,
            severity: 'info',
            type: 'orphan',
            message: `Orphan Sheet Notice: Sheet "${sNo}" ("${sheet.titleBlock.drawingTitle}") has no active plan layout tag callout referencing it yet.`,
            remedyActionName: 'Deploy Auto-Callout bubble on Plan',
            remedyPayload: { targetSheetId: sheet.id, targetSheetNo: sNo }
          });
        }
      }
    });

    return issues;
  }

  /**
   * Automatically re-routes sheet numbers and cascades updates to all referencing texts
   */
  public static cascadeSheetNumberUpdate(
    sheets: DrawingSheet[],
    sheetId: string,
    newNumber: string,
    currentCallouts: CalloutMark[],
    oldNumber: string
  ): { updatedSheets: DrawingSheet[]; updatedCallouts: CalloutMark[] } {
    // 1. Update callouts Database
    const updatedCallouts = currentCallouts.map(c => {
      const isTarget = c.targetSheetId === sheetId;
      if (isTarget) {
        // e.g. Detail 1/S-201 becomes Detail 1/STR-999
        let newMark = c.mark;
        if (c.type === 'detail') {
          newMark = `Detail ${c.number}/${newNumber}`;
        } else if (c.type === 'schedule') {
          newMark = `See Schedule /${newNumber}`;
        } else if (c.type === 'sheet') {
          newMark = `See Sheet ${newNumber}`;
        }
        return {
          ...c,
          targetSheetNo: newNumber,
          mark: newMark
        };
      }
      return c;
    });

    // 2. Scan and edit structural drawings text entities on all sheets to match new sheet code!
    // Crawl both plan CAD sheets and foundation detail sheets
    const updatedSheets = sheets.map(sheet => {
      // Find all text entities, leaders and blocks containing old sheet patterns (e.g. "S-201")
      // Substitute with new values (e.g. "STR-999")
      const updatedEntities = sheet.entities.map(ent => {
        if (ent.type === 'text' && ent.text) {
          let t = ent.text;
          const escapedOld = oldNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(escapedOld, 'g');
          if (regex.test(t)) {
            t = t.replace(regex, newNumber);
          }
          return { ...ent, text: t };
        }

        if (ent.metadata && ent.metadata.detailRef) {
          let ref = ent.metadata.detailRef;
          const escapedOld = oldNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(escapedOld, 'g');
          if (regex.test(ref)) {
            ref = ref.replace(regex, newNumber);
          }
          return {
            ...ent,
            metadata: {
              ...ent.metadata,
              detailRef: ref
            }
          };
        }

        return ent;
      });

      // Update actual Title Block drawingNumber
      const updatedTitleBlock = { ...sheet.titleBlock };
      if (sheet.id === sheetId) {
        updatedTitleBlock.drawingNumber = newNumber;
      }

      // Re-assign entities array safely preserving original class hierarchy if any
      const newSheet = Object.assign(Object.create(Object.getPrototypeOf(sheet)), sheet);
      newSheet.entities = updatedEntities;
      newSheet.titleBlock = updatedTitleBlock;
      return newSheet;
    });

    return { updatedSheets, updatedCallouts };
  }

  /**
   * Renders beautiful colored interactive overlays directly on the canvas space
   */
  public static renderCalloutGraphicsOnCanvas(
    ctx: CanvasRenderingContext2D,
    callouts: CalloutMark[],
    activeSheetId: string,
    hoveredCalloutId: string | null
  ): void {
    const activeCallouts = callouts.filter(c => c.sourceSheetId === activeSheetId);

    activeCallouts.forEach(c => {
      const isHovered = c.id === hoveredCalloutId;

      ctx.save();
      // Design settings based on Hover attributes
      ctx.strokeStyle = isHovered ? '#6366F1' : '#4F46E5';
      ctx.fillStyle = isHovered ? 'rgba(99, 102, 241, 0.12)' : 'rgba(79, 70, 229, 0.04)';
      ctx.lineWidth = isHovered ? 0.75 : 0.55;

      // Draw Section cuts vs. Circular hot bubbles
      if (c.type === 'section') {
        // Draw elegant Section cut indicator arrows and dashed line
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        // Section lines across the structural zones
        ctx.moveTo(c.x - 30, c.y);
        ctx.lineTo(c.x + 30, c.y);
        ctx.stroke();

        ctx.setLineDash([]);
        // Left pointer head
        ctx.beginPath();
        ctx.moveTo(c.x - 30, c.y);
        ctx.lineTo(c.x - 26, c.y - 12);
        ctx.lineTo(c.x - 34, c.y - 12);
        ctx.closePath();
        ctx.fillStyle = isHovered ? '#6366F1' : '#4F46E5';
        ctx.fill();

        // Right pointer head
        ctx.beginPath();
        ctx.moveTo(c.x + 30, c.y);
        ctx.lineTo(c.x + 34, c.y - 12);
        ctx.lineTo(c.x + 26, c.y - 12);
        ctx.closePath();
        ctx.fillStyle = isHovered ? '#6366F1' : '#4F46E5';
        ctx.fill();

        // Draw Section Mark text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 3.2px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.number, c.x - 30, c.y - 9);
        ctx.fillText(c.number, c.x + 30, c.y - 9);

        // Border highlighting box on section centers
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius || 10, 0, 2 * Math.PI);
        if (isHovered) {
          ctx.strokeStyle = '#6366F1';
          ctx.stroke();
        }
      } else {
        // Standard Detail double-bubble reference key
        ctx.setLineDash([2, 1.5]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius || 10, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.setLineDash([]);
        // Center horizontal partition line
        const r = c.radius || 10;
        ctx.beginPath();
        ctx.moveTo(c.x - r, c.y);
        ctx.lineTo(c.x + r, c.y);
        ctx.stroke();

        // Detail standard top index
        ctx.fillStyle = isHovered ? '#4338CA' : '#1E1B4B';
        ctx.font = 'bold 3px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(c.number, c.x, c.y - 0.5);

        // Drawing target sheet number bottom index
        ctx.font = '600 2.5px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(c.targetSheetNo, c.x, c.y + 0.8);

        // Draw a small "Callout Hover Flag" above if mouse hovered
        if (isHovered) {
          ctx.fillStyle = '#111827';
          ctx.fillRect(c.x - 30, c.y - r - 12, 60, 10);
          ctx.strokeStyle = '#6366F1';
          ctx.strokeRect(c.x - 30, c.y - r - 12, 60, 10);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 2.5px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(c.title, c.x, c.y - r - 7);

          // Draw a leader link indicator line leading to a highlighted target bounding box
          ctx.strokeStyle = '#6366F1';
          ctx.lineWidth = 0.35;
          ctx.setLineDash([1, 1]);
          ctx.beginPath();
          ctx.moveTo(c.x, c.y - r);
          ctx.lineTo(c.x, c.y - r - 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    });
  }
}

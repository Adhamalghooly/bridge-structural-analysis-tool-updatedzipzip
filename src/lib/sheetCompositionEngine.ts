/**
 * Phase D7: Sheet Composition Engine - Core Types and Logic
 * Supports multi-sheet CAD drawing layout compilation, automatic scaling, viewports,
 * title block system, legends, revision tracking, and validation.
 */

export type SheetSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'Custom';
export type SheetOrientation = 'portrait' | 'landscape';

export interface SheetDimensions {
  width: number; // in mm
  height: number; // in mm
}

export const SHEET_DIMENSIONS: Record<Exclude<SheetSize, 'Custom'>, SheetDimensions> = {
  A0: { width: 1189, height: 841 },
  A1: { width: 841, height: 594 },
  A2: { width: 594, height: 420 },
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
};

export type ViewportType = 
  | 'plan' 
  | 'section' 
  | 'detail' 
  | 'schedule' 
  | 'legend' 
  | 'generalNotes';

export interface Viewport {
  id: string;
  type: ViewportType;
  title: string;
  scale: string; // e.g. '1:50', '1:20'
  x: number; // offset in mm from sheet margin-left
  y: number; // offset in mm from sheet margin-top
  width: number; // target viewport width in mm on paper
  height: number; // target viewport height in mm on paper
  referenceId: string; // e.g. storyId for plans, beamId for beam details, etc.
  clipped?: boolean;
}

export type SheetType =
  | 'generalNotes'
  | 'foundation'
  | 'structuralPlan'
  | 'beamDetail'
  | 'columnDetail'
  | 'slabDetail'
  | 'section'
  | 'schedule'
  | 'reinforcement'
  | 'combined';

export interface Revision {
  id: string;
  number: string; // e.g., "Rev A", "Rev 1"
  date: string;
  description: string;
  designer: string;
}

export interface TitleBlockInfo {
  projectName: string;
  projectNumber: string;
  client: string;
  consultant: string;
  drawingTitle: string;
  drawingNumber: string; // e.g. S-101
  scale: string;
  date: string;
  designer: string;
  checker: string;
  approver: string;
  revision: string;
}

export interface DrawingSheet {
  id: string;
  type: SheetType;
  title: string;
  sheetNo: string; // S-001, S-101 ...
  size: SheetSize;
  customWidth?: number; // millimetres
  customHeight?: number;
  orientation: SheetOrientation;
  viewports: Viewport[];
  margin: number; // mm, default typically 10 or 20
  revisions: Revision[];
}

export interface SheetValidationIssue {
  id: string;
  type: 'overflow' | 'overlap' | 'missing-view' | 'missing-schedule' | 'missing-notes' | 'empty-sheet';
  severity: 'warning' | 'error';
  message: string;
}

export const SCALES = ['1:10', '1:20', '1:25', '1:50', '1:75', '1:100', '1:150', '1:200'];

// Default general construction notes
export const DEFAULT_GENERAL_NOTES = [
  "جميع أبعاد اللوحة مأخوذة بالمليمتر (mm) ما لم يذكر خلاف ذلك كتابة على المخططات.",
  "المقاومة المميزة للخرسانة المسلحة عند عمر 28 يوماً لا تقل عن fc' = 30 MPa لجميع الجسور والأسقف والقواعد والرقاب.",
  "مقاومة الأعمدة الإنشائية المميزة لا تقل عن fc' = 35 MPa لرفع الكفاءة الانضغاطية ومقاومة الأحمال الرأسية.",
  "الحديد المستخدم عالي المقاومة المشوه Grade 60 بمقاومة خضوع تجريبية لا تقل عن fy = 420 MPa طبقاً للمواصفات السعودية والخليجية المعتمدة.",
  "يرعى أن غطاء حماية حديد التسليح الصافي (Clear Concrete Cover): 50 مم للقواعد المعرضة للتربة، و 25 مم للأعمدة والجسور والأسقف.",
  "تعد وصلات الشد في أسياخ التسليح تراكبية بطول لا يقل عن 60Ø أو 600 مم أيهما أكبر، مع توزيع الوصلات بشكل تبادلي بين المقاطع.",
  "تصب الخرسانة المسلحة وتدمك ميكانيكياً باستخدام الهزازات الميكانيكية لضمان عدم حدوث تعشيش، مع المحافظة على ري الخرسانة بالمياه لمدة 7 أيام متتالية.",
  "أحمال التصميم المعتمدة: الحمل الحي للغرف السكنية = 2.0 kN/m²، وحمل التغطيات والتشطيبات = 1.5 kN/m².",
  "يجب مطابقة اللوحات الإنشائية مع اللوحات المعمارية والصحية والكهربائية قبل البدء في أعمال الحفر أو صب القوالب الخرسانية لتثبيت مسارات الأنابيب وتمرير الخدمات."
];

// Symbols & Legend database items
export interface LegendItem {
  symbol: string;
  meaning: string;
  description: string;
}

export const SYMBOLS_LEGEND: LegendItem[] = [
  { symbol: "Ø / T", meaning: "قطر سيخ حديد التسليح", description: "يشير إلى قطر سيخ حديد التسليح بالمليمتر (مثال: Ø14 تشير لقطر 14مم)" },
  { symbol: "@", meaning: "تباعد حديد التسليح", description: "المسافة البينية بين مراكز أسيخ التسليح أو الكانات (مثال: @ 150 مم)" },
  { symbol: "BT Marks", meaning: "Beam Top Reinforcement Marks", description: "أسياخ التسليح العلوي الإضافي للجسور عند المساند والركائز لمقاومة العزوم السالبة" },
  { symbol: "BB Marks", meaning: "Beam Bottom Reinforcement Marks", description: "أسياخ التسليح السفلي المستمر أو الإضافي للجسور لمقاومة العزوم الموجبة في منتصف البحر" },
  { symbol: "S1, S2 ...", meaning: "معرف القصة الإنشائية (Story ID)", description: "رمز يحدد موقع وتكرار القصة أو السقف في المبنى" },
  { symbol: "C1, C2 ...", meaning: "معرف العمود الإنشائي (Column ID)", description: "ترميز يطابق القطاع العرضي للعمود مع جدول قطاعات وتفاصيل تسليح الأعمدة" },
  { symbol: "B1, B2 ...", meaning: "معرف الجسر الخرساني (Beam ID)", description: "رمز يشير إلى المقطع المخطط للجسر وجدول تفاصيل تسليح الجسور" },
];

/**
 * Automatically select the best scale to represent content in a given viewport area
 */
export function selectBestScale(contentRealWidthMm: number, targetViewportWidthMm: number): string {
  const ratio = contentRealWidthMm / targetViewportWidthMm;
  // find next standard scale that accommodates it Safely
  const match = SCALES.find(s => {
    const scaleVal = parseInt(s.split(':')[1]);
    return scaleVal >= ratio;
  });
  return match || '1:100';
}

/**
 * Calculates paper dimensions in mm
 */
export function getSheetSizeMm(size: SheetSize, customWidth?: number, customHeight?: number): SheetDimensions {
  if (size === 'Custom') {
    return { width: customWidth || 500, height: customHeight || 400 };
  }
  return SHEET_DIMENSIONS[size];
}

/**
 * Auto-layout viewports inside a sheet boundary with spacing guidelines
 */
export function calculateAutoLayout(
  sheet: DrawingSheet,
  availableViewports: Omit<Viewport, 'x' | 'y'>[]
): Viewport[] {
  const { width, height } = getSheetSizeMm(sheet.size, sheet.customWidth, sheet.customHeight);
  const margin = sheet.margin;
  
  // Available printable field
  const printableW = width - margin * 2 - 120; // reserve 120mm on the right or bottom for Title Block & Legends
  const printableH = height - margin * 2;
  
  const placed: Viewport[] = [];
  let currentX = margin;
  let currentY = margin;
  let maxRowHeight = 0;
  
  for (const vp of availableViewports) {
    // If it doesn't fit in current row, wrap to next row
    if (currentX + vp.width > printableW) {
      currentX = margin;
      currentY += maxRowHeight + 10; // add 10ms spacing
      maxRowHeight = 0;
    }
    
    // If it doesn't fit in the remaining height, create warning or limit
    if (currentY + vp.height > printableH) {
      // clip or put overlapping
      placed.push({
        ...vp,
        x: currentX,
        y: currentY,
      });
    } else {
      placed.push({
        ...vp,
        x: currentX,
        y: currentY,
      });
      currentX += vp.width + 10; // 10mm spacing
      maxRowHeight = Math.max(maxRowHeight, vp.height);
    }
  }
  
  return placed;
}

/**
 * Validates drawing sheet content and checks of overlaps or sheet overflows
 */
export function validateSheet(sheet: DrawingSheet): SheetValidationIssue[] {
  const issues: SheetValidationIssue[] = [];
  const { width, height } = getSheetSizeMm(sheet.size, sheet.customWidth, sheet.customHeight);
  const margin = sheet.margin;
  
  if (sheet.viewports.length === 0) {
    issues.push({
      id: `${sheet.id}-empty`,
      type: 'empty-sheet',
      severity: 'warning',
      message: 'اللوحة فارغة تماماً ولا تحتوي على أي مساقط أو مجدولات تفريد.'
    });
    return issues;
  }
  
  // Outer borders for general viewport boundaries
  const rightBoundary = width - margin;
  const bottomBoundary = height - margin;
  
  // Check title block overlap: ISO standard title block usually of size 180mm x 60mm placing bottom right.
  const isLandscape = sheet.orientation === 'landscape';
  const titleBlockW = 140;
  const titleBlockH = 65;
  const tbMinX = width - margin - titleBlockW;
  const tbMinY = height - margin - titleBlockH; // Standard Bottom Right layout in inverted rendering
  
  sheet.viewports.forEach((vp) => {
    // Check sheet border overflows
    const vpRight = vp.x + vp.width;
    const vpBottom = vp.y + vp.height;
    
    if (vpRight > width || vpBottom > height || vp.x < 0 || vp.y < 0) {
      issues.push({
        id: `${sheet.id}-overflow-${vp.id}`,
        type: 'overflow',
        severity: 'error',
        message: `المسقط المسمى "${vp.title || vp.type}" يتخطى حدود السطح الطباعي المسموح به للورق.`
      });
    }
    
    // Check title block overlaps
    const overlapsTb = (
      vp.x < width - margin &&
      vpRight > tbMinX &&
      vp.y < height - margin &&
      vpBottom > tbMinY &&
      // check if it's placed in bottom-right region or right band
      vp.x >= (width - 150)
    );
    
    if (overlapsTb && vp.type !== 'generalNotes') {
      issues.push({
        id: `${sheet.id}-overlap-tb-${vp.id}`,
        type: 'overlap',
        severity: 'warning',
        message: `المسقط "${vp.title}" قد يتداخل جزئياً مع كتلة العنوان (Title Block) بالركن الأيمن للوحة.`
      });
    }
  });
  
  // Check missing schedules or details for specific sheet types
  if (sheet.type === 'beamDetail' && !sheet.viewports.some(v => v.type === 'detail' || v.type === 'schedule')) {
    issues.push({
      id: `${sheet.id}-missing-beam-det`,
      type: 'missing-view',
      severity: 'warning',
      message: 'مخطط تفاصيل الجسور لا يحتوي على تفاصيل تسليح الجسور أو مجدول المقاطع.'
    });
  }
  
  if (sheet.type === 'reinforcement' && !sheet.viewports.some(v => v.type === 'schedule')) {
    issues.push({
      id: `${sheet.id}-missing-bbs`,
      type: 'missing-schedule',
      severity: 'warning',
      message: 'لوحة التسليح والكميات لا تحتوي على جدول تفريد الحديد الإجمالي (BBS).'
    });
  }
  
  return issues;
}

/**
 * Generate a CAD-quality DXF specification code log representational file
 * that can be copy-pasted or exported to launch standard CAD generation
 */
export function generateDXFSheetScript(sheet: DrawingSheet, titleBlock: TitleBlockInfo): string {
  const { width, height } = getSheetSizeMm(sheet.size, sheet.customWidth, sheet.customHeight);
  let dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n`;
  
  // Tables section with layers
  dxf += `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n10\n0\nENDTAB\n`;
  dxf += `0\nTABLE\n2\nLAYER\n70\n10\n`;
  
  // Layers declaration
  const layers = ['BORDER', 'VIEWPORT', 'TITLE_BLOCK', 'TEXT_ARABIC', 'LEGEND'];
  layers.forEach((layer, i) => {
    dxf += `0\nLAYER\n2\n${layer}\n70\n64\n62\n${i + 1}\n6\nContinuous\n`;
  });
  dxf += `0\nENDTAB\n0\nENDSEC\n`;
  
  // Entities section containing sheet outlines, title blocks, viewports
  dxf += `0\nSECTION\n2\nENTITIES\n`;
  
  // 1. Draw Paper border
  dxf += `0\nPOLYLINE\n8\nBORDER\n66\n1\n70\n1\n`;
  // vertices
  const points = [
    {x: 0, y: 0},
    {x: width, y: 0},
    {x: width, y: height},
    {x: 0, y: height}
  ];
  points.forEach(pt => {
    dxf += `0\nVERTEX\n8\nBORDER\n10\n${pt.x}\n20\n${pt.y}\n30\n0.0\n`;
  });
  dxf += `0\nSEQEND\n`;

  // 2. Draw Margins
  const margin = sheet.margin;
  dxf += `0\nPOLYLINE\n8\nBORDER\n66\n1\n70\n1\n`;
  const mPoints = [
    {x: margin, y: margin},
    {x: width - margin, y: margin},
    {x: width - margin, y: height - margin},
    {x: margin, y: height - margin}
  ];
  mPoints.forEach(pt => {
    dxf += `0\nVERTEX\n8\nBORDER\n10\n${pt.x}\n20\n${pt.y}\n30\n0.0\n`;
  });
  dxf += `0\nSEQEND\n`;

  // 3. Draw Title Block (at bottom right margin)
  const tbW = 140;
  const tbH = 65;
  const tbx1 = width - margin - tbW;
  const tby1 = margin;
  const tbx2 = width - margin;
  const tby2 = margin + tbH;

  dxf += `0\nPOLYLINE\n8\nTITLE_BLOCK\n66\n1\n70\n1\n`;
  const tbPoints = [
    {x: tbx1, y: tby1},
    {x: tbx2, y: tby1},
    {x: tbx2, y: tby2},
    {x: tbx1, y: tby2}
  ];
  tbPoints.forEach(pt => {
    dxf += `0\nVERTEX\n8\nTITLE_BLOCK\n10\n${pt.x}\n20\n${pt.y}\n30\n0.0\n`;
  });
  dxf += `0\nSEQEND\n`;

  // Horizontal divider lines inside title block
  const linesCount = 4;
  for (let i = 1; i < linesCount; i++) {
    const ly = tby1 + (tbH / linesCount) * i;
    dxf += `0\nLINE\n8\nTITLE_BLOCK\n10\n${tbx1}\n20\n${ly}\n30\n0.0\n11\n${tbx2}\n21\n${ly}\n31\n0.0\n`;
  }

  // Draw CAD annotation references
  dxf += `0\nTEXT\n8\nTEXT_ARABIC\n10\n${tbx1 + 5}\n20\n${tby1 + 5}\n40\n3.5\n1\nPROJECT: ${titleBlock.projectName}\n`;
  dxf += `0\nTEXT\n8\nTEXT_ARABIC\n10\n${tbx1 + 5}\n20\n${tby1 + 20}\n40\n3.5\n1\nCLIENT: ${titleBlock.client}\n`;
  dxf += `0\nTEXT\n8\nTEXT_ARABIC\n10\n${tbx1 + 5}\n20\n${tby1 + 35}\n40\n3.5\n1\nDRWG NO: ${titleBlock.drawingNumber} (${sheet.sheetNo})\n`;
  dxf += `0\nTEXT\n8\nTEXT_ARABIC\n10\n${tbx2 - 35}\n20\n${tby1 + 50}\n40\n4.5\n1\nSCALE: ${sheet.viewports[0]?.scale || '1:50'}\n`;

  // 4. Viewport boundaries
  sheet.viewports.forEach(vp => {
    dxf += `0\nPOLYLINE\n8\nVIEWPORT\n66\n1\n70\n1\n`;
    const vpPt = [
      {x: vp.x, y: vp.y},
      {x: vp.x + vp.width, y: vp.y},
      {x: vp.x + vp.width, y: vp.y + vp.height},
      {x: vp.x, y: vp.y + vp.height}
    ];
    vpPt.forEach(pt => {
      dxf += `0\nVERTEX\n8\nVIEWPORT\n10\n${pt.x}\n20\n${pt.y}\n30\n0.0\n`;
    });
    dxf += `0\nSEQEND\n`;

    // Label for viewport
    dxf += `0\nTEXT\n8\nTEXT_ARABIC\n10\n${vp.x + 2}\n20\n${vp.y + vp.height + 2}\n40\n3.0\n1\n${vp.title} - Scale ${vp.scale}\n`;
  });

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}

/**
 * Creates sample template sheets for general structure plan compiling
 */
export function generateDefaultSheets(projectName?: string): DrawingSheet[] {
  const pName = projectName || 'مشروع المبنى السكني النموذجي';
  const defaultRevisions: Revision[] = [
    { id: 'rev-0', number: '00', date: new Date().toISOString().split('T')[0], description: 'الإصدار المبدئي المعتمد للتصاريح الإنشائية والبلدية', designer: 'ENG. S.A.' }
  ];

  return [
    {
      id: 'sheet-1',
      type: 'generalNotes',
      title: 'جدول الملاحظات الإنشائية العامة والاشتراطات والمصطلحات',
      sheetNo: 'S-001',
      size: 'A1',
      orientation: 'landscape',
      margin: 15,
      revisions: [...defaultRevisions],
      viewports: [
        {
          id: 'v-0-1',
          type: 'generalNotes',
          title: 'دفتر المواصفات الفنية وملاحظات صب ودمك الخرسانة وحديد التسليح الجسور',
          scale: 'NTS',
          x: 20,
          y: 20,
          width: 500,
          height: 480,
          referenceId: 'all'
        },
        {
          id: 'v-0-2',
          type: 'legend',
          title: 'دليل ومخطط الرموز والمصطلحات الموحد',
          scale: 'NTS',
          x: 540,
          y: 20,
          width: 260,
          height: 480,
          referenceId: 'symbols'
        }
      ]
    },
    {
      id: 'sheet-2',
      type: 'structuralPlan',
      title: 'مخطط سقف وقوالب القالب الخرساني والجسور الإنشائية - القصة الأولى S1',
      sheetNo: 'S-101',
      size: 'A0',
      orientation: 'landscape',
      margin: 15,
      revisions: [...defaultRevisions],
      viewports: [
        {
          id: 'v-1-1',
          type: 'plan',
          title: 'مخطط تسليح الأسقف والقوالب الخرسانية (Framing Plan) - الدور الأول S1',
          scale: '1:50',
          x: 25,
          y: 25,
          width: 600,
          height: 550,
          referenceId: 'story-first'
        },
        {
          id: 'v-1-2',
          type: 'schedule',
          title: 'مجدول تسليح بلاطة السقف الصماء والكمرات الإضافية',
          scale: '1:100',
          x: 650,
          y: 25,
          width: 360,
          height: 250,
          referenceId: 'slabs'
        },
        {
          id: 'v-1-3',
          type: 'legend',
          title: 'رموز تسليح الحديد والمقاطع الموحدة',
          scale: 'NTS',
          x: 650,
          y: 290,
          width: 360,
          height: 250,
          referenceId: 'rebar-legend'
        }
      ]
    },
    {
      id: 'sheet-3',
      type: 'beamDetail',
      title: 'مخطط التفريد وتفاصيل الحديد الطولي والعرضي للجسور - الدور الأول S1',
      sheetNo: 'S-201',
      size: 'A1',
      orientation: 'landscape',
      margin: 15,
      revisions: [...defaultRevisions],
      viewports: [
        {
          id: 'v-2-1',
          type: 'detail',
          title: 'تفريد حديد الجسور الأرضية والجسور الرئيسية B1-B5 بالتفصيل',
          scale: '1:25',
          x: 20,
          y: 20,
          width: 480,
          height: 240,
          referenceId: 'beam-det-all'
        },
        {
          id: 'v-2-2',
          type: 'section',
          title: 'القطاعات العرضية والأطواق للجسور الرئيسية لمقاومة عزم اللي والقص',
          scale: '1:10',
          x: 20,
          y: 280,
          width: 480,
          height: 220,
          referenceId: 'beam-sec-all'
        },
        {
          id: 'v-2-3',
          type: 'schedule',
          title: 'مجدول تفاصيل حديد تسليح الجسور التفصيلي STA4CAD Coordinated',
          scale: '1:100',
          x: 520,
          y: 20,
          width: 280,
          height: 480,
          referenceId: 'beam-schedule-embed'
        }
      ]
    },
    {
      id: 'sheet-4',
      type: 'columnDetail',
      title: 'مخطط قطاعات وتفاصيل تسليح الأعمدة ومجدول الأطواق والرقاب',
      sheetNo: 'S-301',
      size: 'A1',
      orientation: 'landscape',
      margin: 15,
      revisions: [...defaultRevisions],
      viewports: [
        {
          id: 'v-3-1',
          type: 'detail',
          title: 'مخطط قطاعات تسليح الأعمدة C1-C8 والمحاور الرئيسية بالقصة الأول',
          scale: '1:10',
          x: 20,
          y: 20,
          width: 450,
          height: 480,
          referenceId: 'col-detail-panel'
        },
        {
          id: 'v-3-2',
          type: 'schedule',
          title: 'مجدول تسليح الأعمدة والأطواق الرأسية الكانات المستمرة',
          scale: '1:100',
          x: 490,
          y: 20,
          width: 310,
          height: 480,
          referenceId: 'column-schedule-embed'
        }
      ]
    },
    {
      id: 'sheet-5',
      type: 'reinforcement',
      title: 'مجدول تفريد حديد التسليح ونظام الكميات الموحد (BBS Summary Sheet)',
      sheetNo: 'S-401',
      size: 'A0',
      orientation: 'landscape',
      margin: 15,
      revisions: [...defaultRevisions],
      viewports: [
        {
          id: 'v-4-1',
          type: 'schedule',
          title: 'مجدول تفريد حديد التسليح الإجمالي الشامل (BBS) لجميع العناصر الإنشائية',
          scale: '1:100',
          x: 25,
          y: 25,
          width: 1100,
          height: 600,
          referenceId: 'rebar-bbs-all'
        }
      ]
    }
  ];
}

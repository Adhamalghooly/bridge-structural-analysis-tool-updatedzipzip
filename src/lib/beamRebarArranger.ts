/**
 * Beam Reinforcement Arrangement Engine (PHASE S1.5)
 * According to ACI 318-19 and drawing standards.
 * Converts theoretical areas of reinforcement into practical, constructible bar selections,
 * curtailment zones, development lengths, stirrup distributions, BBS, and BOQ.
 */

import { calculateDevelopmentLengths } from './structuralEngine';

export interface BarOption {
  dia: number; // Support: 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40
  area: number; // mm²
  weight: number; // kg/m
}

export const SUPPORTED_BARS: BarOption[] = [
  { dia: 8, area: 50.27, weight: 0.395 },
  { dia: 10, area: 78.54, weight: 0.617 },
  { dia: 12, area: 113.10, weight: 0.888 },
  { dia: 14, area: 153.94, weight: 1.208 },
  { dia: 16, area: 201.06, weight: 1.578 },
  { dia: 18, area: 254.47, weight: 1.998 },
  { dia: 20, area: 314.16, weight: 2.466 },
  { dia: 22, area: 380.13, weight: 2.984 },
  { dia: 25, area: 490.87, weight: 3.853 },
  { dia: 28, area: 615.75, weight: 4.834 },
  { dia: 32, area: 804.25, weight: 6.313 },
  { dia: 36, area: 1017.88, weight: 7.990 },
  { dia: 40, area: 1256.64, weight: 9.865 },
];

export interface RegionCandidate {
  bars: { count: number; dia: number }[];
  providedAs: number; // mm²
  excessAs: number; // mm²
  excessPercent: number; // %
  layersCount: number;
  clearSpacing: number; // mm
  congested: boolean;
  score: number; // Higher is better (0-100)
  explanation: string; // e.g., "3Ø20 (1 Layer) - Clean & Spaced"
}

export interface RebarZone {
  continuous: { count: number; dia: number }[];
  additional?: { count: number; dia: number }[];
  allBars: { count: number; dia: number }[];
  providedAs: number;
  requiredAs: number;
  layers: { count: number; dia: number }[][]; // Bars per layer
  candidates: RegionCandidate[];
}

export interface StirrupLayout {
  dia: number;
  legs: number;
  leftZone: { spacing: number; length: number; count: number };
  midZone: { spacing: number; length: number; count: number };
  rightZone: { spacing: number; length: number; count: number };
  barMark: string;
}

export interface BBSItem {
  mark: string; // BT1, BT2, etc.
  dia: number;
  shapeCode: number; // 0=straight, 20=L-bend, 37=stirrup
  count: number;
  length: number; // mm
  weightPerItem: number; // kg
  totalWeight: number; // kg
  bendDetails: string;
}

export interface CurtailmentData {
  mark: string;
  barDesc: string;
  startX: number; // From left face, mm
  endX: number; // From left face, mm
  length: number; // mm
  anchorage: string; // "L-Hook", "Straight"
}

export interface CongestionStatus {
  hasIssue: boolean;
  severity: 'low' | 'moderate' | 'high';
  message: string;
}

export interface BeamRebarLayout {
  beamId: string;
  spanName: string;
  b: number; // mm
  h: number; // mm
  length: number; // mm (total)
  fc: number;
  fy: number;
  fyt: number;
  cover: number; // mm
  
  // Zones
  topRegions: {
    left: RebarZone;
    mid: RebarZone;
    right: RebarZone;
  };
  bottomRegions: {
    left: RebarZone;
    mid: RebarZone;
    right: RebarZone;
  };
  
  // Detailing properties
  developmentLengths: { [dia: number]: any };
  stirrups: StirrupLayout;
  curtailments: CurtailmentData[];
  bbs: BBSItem[];
  boq: {
    concreteVolume: number; // m³
    steelWeight: number; // kg
    reinforcementRatio: number; // kg/m³
    estimatedCost: number; // $
  };
  warnings: string[];
  congestion: CongestionStatus;
}

/**
 * Main Beam Enrichment Detailing Engine
 */
export function arrangeBeamReinforcement(params: {
  beamId: string;
  spanName?: string;
  width: number; // b in mm (e.g., 250, 300)
  depth: number; // h in mm (e.g., 600, 700)
  length: number; // L in mm (e.g., 5000)
  fc: number; // MPa
  fy: number; // MPa
  fyt: number; // MPa
  asTopReqLeft: number; // mm²
  asTopReqMid: number; // mm²
  asTopReqRight: number; // mm²
  asBotReqLeft: number; // mm²
  asBotReqMid: number; // mm²
  asBotReqRight: number; // mm²
  shearVuMax: number; // kN
  shearSpacingReq?: number; // mm (optional, from shear design)
  cover?: number; // mm (default 40)
  stirrupDia?: number; // mm (default 10)
  aggregateSize?: number; // mm (default 20)
}): BeamRebarLayout {
  const {
    beamId,
    spanName = `Span ${beamId}`,
    width,
    depth,
    length,
    fc,
    fy,
    fyt,
    asTopReqLeft,
    asTopReqMid,
    asTopReqRight,
    asBotReqLeft,
    asBotReqMid,
    asBotReqRight,
    shearVuMax,
    shearSpacingReq = 200,
    cover = 40,
    stirrupDia = 10,
    aggregateSize = 20,
  } = params;

  const warnings: string[] = [];

  // 1. SELECT FEASIBLE COMBINATIONS FOR A GIVEN REQUIRED AREA (As)
  // Considers single/multiple bar sizes and computes layers
  const generateCandidates = (
    reqAs: number,
    isTop: boolean
  ): RegionCandidate[] => {
    const candidates: RegionCandidate[] = [];
    if (reqAs <= 0) reqAs = 100; // minimum clamp

    // Try single-size bar arrangements
    for (const opt of SUPPORTED_BARS) {
      if (opt.dia < 12 || opt.dia > 32) continue; // standard beam reinforcement diameters

      // Calculate bar count to satisfy area
      const minBars = 2; // Need at least 2 bars for layout constructability
      let count = Math.max(minBars, Math.ceil(reqAs / opt.area));
      
      while (count <= 10) {
        const provAs = count * opt.area;
        const excess = provAs - reqAs;
        const excessPct = (excess / reqAs) * 100;

        // Skip massive over-reinforcement unless it's the minimum 2 bars constraint
        if (pctOverLimit(count, excessPct, opt.dia)) {
          count++;
          continue;
        }

        // Space check
        const { layersCount, clearSpacing, congested } = calculateLayerArrangement(
          count,
          opt.dia,
          width,
          cover,
          stirrupDia,
          aggregateSize
        );

        if (layersCount > 3) {
          count++;
          continue; // Unconstructible
        }

        // Score this candidate
        const score = computeCandidateScore({
          count,
          dia: opt.dia,
          excessPct,
          layersCount,
          congested,
          isMixed: false,
        });

        candidates.push({
          bars: [{ count, dia: opt.dia }],
          providedAs: Math.round(provAs),
          excessAs: Math.round(excess),
          excessPercent: Math.round(excessPct),
          layersCount,
          clearSpacing: Math.round(clearSpacing * 10) / 10,
          congested,
          score,
          explanation: `${count}Ø${opt.dia} (${layersCount} Layer${layersCount > 1 ? 's' : ''}) - Spac: ${Math.round(clearSpacing)}mm`,
        });

        break; // Increment diameter next instead of adding unnecessary excessive bars of the same size
      }
    }

    // Try a few common mixed-size bar arrangements (e.g., 2Ø20 + 2Ø16)
    const mixedPairs = [
      [20, 16],
      [22, 18],
      [25, 20],
      [18, 14],
      [16, 12],
    ];

    for (const [dia1, dia2] of mixedPairs) {
      const opt1 = SUPPORTED_BARS.find(o => o.dia === dia1)!;
      const opt2 = SUPPORTED_BARS.find(o => o.dia === dia2)!;

      // Assume 2 base bars of dia1 (continuous) and N extra bars of dia2
      for (let extraCount = 1; extraCount <= 4; extraCount++) {
        const provAs = 2 * opt1.area + extraCount * opt2.area;
        if (provAs < reqAs) continue;

        const excess = provAs - reqAs;
        const excessPct = (excess / reqAs) * 100;
        if (excessPct > 45) continue;

        const totalBars = 2 + extraCount;
        const maxDia = Math.max(dia1, dia2);

        // Treat spacing using max diameter for safety
        const { layersCount, clearSpacing, congested } = calculateLayerArrangement(
          totalBars,
          maxDia,
          width,
          cover,
          stirrupDia,
          aggregateSize
        );

        if (layersCount > 3) continue;

        const score = computeCandidateScore({
          count: totalBars,
          dia: maxDia,
          excessPct,
          layersCount,
          congested,
          isMixed: true,
        });

        candidates.push({
          bars: [
            { count: 2, dia: dia1 },
            { count: extraCount, dia: dia2 },
          ],
          providedAs: Math.round(provAs),
          excessAs: Math.round(excess),
          excessPercent: Math.round(excessPct),
          layersCount,
          clearSpacing: Math.round(clearSpacing * 10) / 10,
          congested,
          score,
          explanation: `2Ø${dia1} + ${extraCount}Ø${dia2} (${layersCount}L), Spac: ${Math.round(clearSpacing)}mm`,
        });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // If completely empty, push a fallback heavy-duty candidate
    if (candidates.length === 0) {
      candidates.push({
        bars: [{ count: 4, dia: 25 }],
        providedAs: 1964,
        excessAs: Math.max(0, 1964 - reqAs),
        excessPercent: Math.max(0, (1964 - reqAs)/reqAs * 100),
        layersCount: 2,
        clearSpacing: 25,
        congested: true,
        score: 10,
        explanation: '4Ø25 (Fallback/Congested)',
      });
    }

    return candidates;
  };

  // Helper helper to limit candidates with too high excess area
  function pctOverLimit(count: number, excessPct: number, dia: number): boolean {
    if (count === 2) return false; // Allowed because 2 bars is absolute constructability min
    if (excessPct > 55) return true;
    return false;
  }

  // Calculate concrete properties for spacing
  function calculateLayerArrangement(
    count: number,
    dia: number,
    w: number,
    cov: number,
    stirDia: number,
    aggSize: number
  ) {
    const usableWidth = w - 2 * cov - 2 * stirDia;
    // Minimum clear spacing: max of 25mm, bar diameter (dia), 4/3 of aggregate size
    const minSpacing = Math.max(25, dia, 1.33 * aggSize);

    // Check how many fit per layer
    // For n bars, we have n-1 spaces. Length occupied = n * dia + (n-1) * spacing
    // usableWidth >= n * dia + (n-1) * minSpacing -> usableWidth + minSpacing >= n * (dia + minSpacing)
    let maxBarsPerLayer = Math.floor((usableWidth + minSpacing) / (dia + minSpacing));
    if (maxBarsPerLayer < 1) maxBarsPerLayer = 1;

    let layersCount = Math.ceil(count / maxBarsPerLayer);
    const barsInFirstLayer = Math.min(count, maxBarsPerLayer);
    
    let clearSpacing = 0;
    if (barsInFirstLayer > 1) {
      clearSpacing = (usableWidth - barsInFirstLayer * dia) / (barsInFirstLayer - 1);
    } else {
      clearSpacing = usableWidth - dia; // only one bar
    }

    const congested = clearSpacing < minSpacing || layersCount > 2;
    return {
      layersCount,
      clearSpacing,
      congested,
    };
  }

  // Scoring weights
  function computeCandidateScore(info: {
    count: number;
    dia: number;
    excessPct: number;
    layersCount: number;
    congested: boolean;
    isMixed: boolean;
  }): number {
    let score = 100;
    // 1. Penalty for excess steel (economical optimization)
    score -= info.excessPct * 1.5;

    // 2. Penalty for layer counts (we prefer 1 layer)
    if (info.layersCount === 2) score -= 15;
    if (info.layersCount >= 3) score -= 40;

    // 3. Penalty for mixed bar diameters (harder to manage onsite)
    if (info.isMixed) score -= 12;

    // 4. Heavy penalty for congestion
    if (info.congested) score -= 35;

    // 5. Penalty for extreme bar sizes (Ø8-Ø10 too small, Ø36+ too heavy and hard to bend)
    if (info.dia < 14) score -= 8;
    if (info.dia > 28) score -= 15;

    return Math.max(5, Math.min(100, Math.round(score)));
  }

  // Generate candidates for all 6 critical regions
  const topCandidatesLeft = generateCandidates(asTopReqLeft, true);
  const topCandidatesMid = generateCandidates(asTopReqMid, true);
  const topCandidatesRight = generateCandidates(asTopReqRight, true);
  
  const botCandidatesLeft = generateCandidates(asBotReqLeft, false);
  const botCandidatesMid = generateCandidates(asBotReqMid, false);
  const botCandidatesRight = generateCandidates(asBotReqRight, false);

  // 2. FORMAL ARRANGEMENT: COORDINATING CONTINUOUS vs EXTRA BARS
  // Top Continuous: We select the continuous bars based on Top Mid demands, minimum of 2 bars.
  // Standard recommendation: Two bars are continuous across the top (usually Ø14 or Ø16) to support stirrups.
  const selectTopLayout = () => {
    // Top Continuous: Let's use the best candidate for Mid, or a solid minimum 2Ø14/16
    const midBest = topCandidatesMid[0];
    let contCount = 2;
    let contDia = 16; // default solid standard

    // Extract dominant bar diameter from Midspan Top
    const mainMidBar = midBest.bars[0];
    if (mainMidBar) {
      contCount = Math.max(2, mainMidBar.count);
      contDia = mainMidBar.dia;
    }

    // Top Left: compare to continuous
    const leftBest = topCandidatesLeft[0];
    const leftDia = leftBest.bars[0]?.dia || contDia;
    const leftCount = leftBest.providedAs / (SUPPORTED_BARS.find(o => o.dia === leftDia)!.area);

    let leftAddCount = 0;
    let leftAddDia = leftDia;

    if (leftBest.providedAs > contCount * (SUPPORTED_BARS.find(o => o.dia === contDia)!.area)) {
      // Need extra negative steel at Left Support
      leftAddCount = Math.max(1, Math.ceil((leftBest.providedAs - contCount * (SUPPORTED_BARS.find(o => o.dia === contDia)!.area)) / (SUPPORTED_BARS.find(o => o.dia === leftDia)!.area)));
      leftAddDia = leftDia;
    }

    // Top Right: compare to continuous
    const rightBest = topCandidatesRight[0];
    const rightDia = rightBest.bars[0]?.dia || contDia;
    
    let rightAddCount = 0;
    let rightAddDia = rightDia;

    if (rightBest.providedAs > contCount * (SUPPORTED_BARS.find(o => o.dia === contDia)!.area)) {
      rightAddCount = Math.max(1, Math.ceil((rightBest.providedAs - contCount * (SUPPORTED_BARS.find(o => o.dia === contDia)!.area)) / (SUPPORTED_BARS.find(o => o.dia === rightDia)!.area)));
      rightAddDia = rightDia;
    }

    return {
      continuous: [{ count: contCount, dia: contDia }],
      regions: {
        left: {
          continuous: [{ count: contCount, dia: contDia }],
          additional: leftAddCount > 0 ? [{ count: leftAddCount, dia: leftAddDia }] : undefined,
          allBars: leftAddCount > 0 
            ? [{ count: contCount, dia: contDia }, { count: leftAddCount, dia: leftAddDia }]
            : [{ count: contCount, dia: contDia }],
          providedAs: contCount * getArea(contDia) + leftAddCount * getArea(leftAddDia),
          requiredAs: asTopReqLeft,
          layers: leftAddCount > 0 ? [[{ count: contCount, dia: contDia }], [{ count: leftAddCount, dia: leftAddDia }]] : [[{ count: contCount, dia: contDia }]],
          candidates: topCandidatesLeft
        },
        mid: {
          continuous: [{ count: contCount, dia: contDia }],
          allBars: [{ count: contCount, dia: contDia }],
          providedAs: contCount * getArea(contDia),
          requiredAs: asTopReqMid,
          layers: [[{ count: contCount, dia: contDia }]],
          candidates: topCandidatesMid
        },
        right: {
          continuous: [{ count: contCount, dia: contDia }],
          additional: rightAddCount > 0 ? [{ count: rightAddCount, dia: rightAddDia }] : undefined,
          allBars: rightAddCount > 0 
            ? [{ count: contCount, dia: contDia }, { count: rightAddCount, dia: rightAddDia }]
            : [{ count: contCount, dia: contDia }],
          providedAs: contCount * getArea(contDia) + rightAddCount * getArea(rightAddDia),
          requiredAs: asTopReqRight,
          layers: rightAddCount > 0 ? [[{ count: contCount, dia: contDia }], [{ count: rightAddCount, dia: rightAddDia }]] : [[{ count: contCount, dia: contDia }]],
          candidates: topCandidatesRight
        }
      }
    };
  };

  const selectBottomLayout = () => {
    // Bottom continuous: must run full span, based on support tension or minimum tension (at least 2 bars, e.g. 2Ø16)
    // Often we design continuous bottom based on left/right bottom demands, then add extra top-performing bars at midspan.
    const leftBest = botCandidatesLeft[0];
    const rightBest = botCandidatesRight[0];
    const midBest = botCandidatesMid[0];

    // Base continuous bars: use the maximum of left or right requirements, but capped/clamped reasonably to 2 bars
    let contCount = 2;
    let contDia = 16; 

    const baseBarsSource = leftBest.providedAs > rightBest.providedAs ? leftBest : rightBest;
    if (baseBarsSource.bars[0]) {
      contDia = baseBarsSource.bars[0].dia;
      contCount = Math.max(2, Math.min(3, baseBarsSource.bars[0].count)); // continuous bottom generally 2 or 3 bars
    }

    const contArea = contCount * getArea(contDia);

    // Midspan extra positive reinforcement
    let midAddCount = 0;
    let midAddDia = contDia;
    if (midBest.providedAs > contArea) {
      midAddDia = midBest.bars[0]?.dia || contDia;
      midAddCount = Math.max(1, Math.ceil((midBest.providedAs - contArea) / getArea(midAddDia)));
    }

    // Bottom Left Extra (if continuous doesn't satisfy)
    let leftAddCount = 0;
    let leftAddDia = contDia;
    if (leftBest.providedAs > contArea) {
      leftAddDia = leftBest.bars[0]?.dia || contDia;
      leftAddCount = Math.max(1, Math.ceil((leftBest.providedAs - contArea) / getArea(leftAddDia)));
    }

    // Bottom Right Extra
    let rightAddCount = 0;
    let rightAddDia = contDia;
    if (rightBest.providedAs > contArea) {
      rightAddDia = rightBest.bars[0]?.dia || contDia;
      rightAddCount = Math.max(1, Math.ceil((rightBest.providedAs - contArea) / getArea(rightAddDia)));
    }

    return {
      continuous: [{ count: contCount, dia: contDia }],
      regions: {
        left: {
          continuous: [{ count: contCount, dia: contDia }],
          additional: leftAddCount > 0 ? [{ count: leftAddCount, dia: leftAddDia }] : undefined,
          allBars: leftAddCount > 0 
            ? [{ count: contCount, dia: contDia }, { count: leftAddCount, dia: leftAddDia }]
            : [{ count: contCount, dia: contDia }],
          providedAs: contArea + (leftAddCount * getArea(leftAddDia)),
          requiredAs: asBotReqLeft,
          layers: leftAddCount > 0 ? [[{ count: contCount, dia: contDia }], [{ count: leftAddCount, dia: leftAddDia }]] : [[{ count: contCount, dia: contDia }]],
          candidates: botCandidatesLeft
        },
        mid: {
          continuous: [{ count: contCount, dia: contDia }],
          additional: midAddCount > 0 ? [{ count: midAddCount, dia: midAddDia }] : undefined,
          allBars: midAddCount > 0 
            ? [{ count: contCount, dia: contDia }, { count: midAddCount, dia: midAddDia }]
            : [{ count: contCount, dia: contDia }],
          providedAs: contArea + (midAddCount * getArea(midAddDia)),
          requiredAs: asBotReqMid,
          layers: midAddCount > 0 ? [[{ count: contCount, dia: contDia }], [{ count: midAddCount, dia: midAddDia }]] : [[{ count: contCount, dia: contDia }]],
          candidates: botCandidatesMid
        },
        right: {
          continuous: [{ count: contCount, dia: contDia }],
          additional: rightAddCount > 0 ? [{ count: rightAddCount, dia: rightAddDia }] : undefined,
          allBars: rightAddCount > 0 
            ? [{ count: contCount, dia: contDia }, { count: rightAddCount, dia: rightAddDia }]
            : [{ count: contCount, dia: contDia }],
          providedAs: contArea + (rightAddCount * getArea(rightAddDia)),
          requiredAs: asBotReqRight,
          layers: rightAddCount > 0 ? [[{ count: contCount, dia: contDia }], [{ count: rightAddCount, dia: rightAddDia }]] : [[{ count: contCount, dia: contDia }]],
          candidates: botCandidatesRight
        }
      }
    };
  };

  const topLayout = selectTopLayout();
  const botLayout = selectBottomLayout();

  // Helper helper to get area
  function getArea(dia: number): number {
    return SUPPORTED_BARS.find(o => o.dia === dia)?.area || 100;
  }

  // 3. CURTAILMENT ENGINE & HOOK CALCULATIONS
  // ACI 318 Standard detailing rules:
  // - Top continuous bars: run across the whole beam length.
  // - Top support extra bars: extend 0.3 * L (30% of span length) from the support face.
  // - Bottom continuous bars: run full length, with lap splice rules.
  // - Bottom extra midspan bars: start at 1/8 * L (12.5% of span length) and extend to 7/8 * L.
  const curtailments: CurtailmentData[] = [];

  // Top Continuous Bars
  const topCont = topLayout.continuous[0];
  curtailments.push({
    mark: 'BT1',
    barDesc: `${topCont.count}Ø${topCont.dia} Continuous Top`,
    startX: 0,
    endX: length,
    length: length,
    anchorage: 'L-Hook',
  });

  // Top Left Extra Support Bars
  const topLeftAdd = topLayout.regions.left.additional?.[0];
  if (topLeftAdd) {
    const extLength = Math.max(800, Math.ceil(length * 0.3));
    curtailments.push({
      mark: 'BT2',
      barDesc: `${topLeftAdd.count}Ø${topLeftAdd.dia} Left Extra Top Support`,
      startX: 0,
      endX: extLength,
      length: extLength,
      anchorage: 'L-Hook',
    });
  }

  // Top Right Extra Support Bars
  const topRightAdd = topLayout.regions.right.additional?.[0];
  if (topRightAdd) {
    const extLength = Math.max(800, Math.ceil(length * 0.3));
    curtailments.push({
      mark: 'BT3',
      barDesc: `${topRightAdd.count}Ø${topRightAdd.dia} Right Extra Top Support`,
      startX: length - extLength,
      endX: length,
      length: extLength,
      anchorage: 'L-Hook',
    });
  }

  // Bottom Continuous Bars
  const botCont = botLayout.continuous[0];
  curtailments.push({
    mark: 'BB1',
    barDesc: `${botCont.count}Ø${botCont.dia} Continuous Bottom`,
    startX: 0,
    endX: length,
    length: length,
    anchorage: 'L-Hook',
  });

  // Bottom Midspan Extra Positive Bars
  const botMidAdd = botLayout.regions.mid.additional?.[0];
  if (botMidAdd) {
    const startOffset = Math.ceil(length * 0.125);
    const endOffset = length - startOffset;
    const itemLen = endOffset - startOffset;
    curtailments.push({
      mark: 'BB2',
      barDesc: `${botMidAdd.count}Ø${botMidAdd.dia} Midspan Extra Bottom`,
      startX: startOffset,
      endX: endOffset,
      length: itemLen,
      anchorage: 'Straight',
    });
  }

  // 4. DEVELOPMENT LENGTH ENGINE
  // Retrieve ACI development lengths for all unique bar diameters used
  const usedDias = Array.from(new Set([
    topCont.dia,
    topLeftAdd?.dia,
    topRightAdd?.dia,
    botCont.dia,
    botMidAdd?.dia,
  ].filter((d): d is number => !!d)));

  const developmentLengths: { [dia: number]: any } = {};
  for (const dia of usedDias) {
    developmentLengths[dia] = calculateDevelopmentLengths(dia, fy, fc, cover, 150);
  }

  // 5. STIRRUP DESIGN ENGINE
  // Choose standard spacing: rounded to nice increments (50mm, 25mm)
  // Support Zone: Left and right 2 * depth (critical region) spacing
  // Midspan Zone: transit spacing
  const selectStirrups = (): StirrupLayout => {
    // Round support spacing down to 100 or 150 or 200
    let supportSpac = 100;
    if (shearSpacingReq > 150) supportSpac = 150;
    else if (shearSpacingReq > 100) supportSpac = 100;
    else supportSpac = 75; // very high shear

    const midSpac = Math.min(300, Math.floor((depth / 2) / 25) * 25); // d/2 spacing rule ACI

    const supportLength = Math.max(1000, Math.ceil(2 * depth)); // zone of high shear
    const leftCount = Math.ceil(supportLength / supportSpac) + 1;
    const rightCount = leftCount;
    const midLength = length - 2 * supportLength;
    const midCount = midLength > 0 ? Math.ceil(midLength / midSpac) + 1 : 0;

    return {
      dia: stirrupDia,
      legs: 2,
      leftZone: { spacing: supportSpac, length: supportLength, count: leftCount },
      midZone: { spacing: midSpac, length: Math.max(0, midLength), count: midCount },
      rightZone: { spacing: supportSpac, length: supportLength, count: rightCount },
      barMark: 'BS1',
    };
  };

  const stirrups = selectStirrups();

  // 6. BAR BENDING SCHEDULE (BBS) ENGINE
  // Structural schedules for list items including Hook details, count, weights
  const bbs: BBSItem[] = [];

  const getWeight = (dia: number) => {
    return SUPPORTED_BARS.find(o => o.dia === dia)?.weight || 0.617;
  };

  // Bar Marks:
  // - BT1 (Top continuous)
  const lhookLength = Math.max(200, Math.ceil((depth - 2 * cover) * 0.8)); // Standard hook at column ends
  
  bbs.push({
    mark: 'BT1',
    dia: topCont.dia,
    shapeCode: 20, // L-Bend
    count: topCont.count,
    length: length + 2 * lhookLength,
    weightPerItem: (length + 2 * lhookLength) / 1000 * getWeight(topCont.dia),
    totalWeight: topCont.count * ((length + 2 * lhookLength) / 1000) * getWeight(topCont.dia),
    bendDetails: `Straight: ${length}mm, Bend: 2x${lhookLength}mm`,
  });

  if (topLeftAdd) {
    const itemLen = Math.ceil(length * 0.3);
    bbs.push({
      mark: 'BT2',
      dia: topLeftAdd.dia,
      shapeCode: 20,
      count: topLeftAdd.count,
      length: itemLen + lhookLength,
      weightPerItem: (itemLen + lhookLength) / 1000 * getWeight(topLeftAdd.dia),
      totalWeight: topLeftAdd.count * ((itemLen + lhookLength) / 1000) * getWeight(topLeftAdd.dia),
      bendDetails: `Straight: ${itemLen}mm, Hook: ${lhookLength}mm`,
    });
  }

  if (topRightAdd) {
    const itemLen = Math.ceil(length * 0.3);
    bbs.push({
      mark: 'BT3',
      dia: topRightAdd.dia,
      shapeCode: 20,
      count: topRightAdd.count,
      length: itemLen + lhookLength,
      weightPerItem: (itemLen + lhookLength) / 1000 * getWeight(topRightAdd.dia),
      totalWeight: topRightAdd.count * ((itemLen + lhookLength) / 1000) * getWeight(topRightAdd.dia),
      bendDetails: `Straight: ${itemLen}mm, Hook: ${lhookLength}mm`,
    });
  }

  bbs.push({
    mark: 'BB1',
    dia: botCont.dia,
    shapeCode: 20,
    count: botCont.count,
    length: length + 2 * lhookLength,
    weightPerItem: (length + 2 * lhookLength) / 1000 * getWeight(botCont.dia),
    totalWeight: botCont.count * ((length + 2 * lhookLength) / 1000) * getWeight(botCont.dia),
    bendDetails: `Straight: ${length}mm, Bend: 2x${lhookLength}mm`,
  });

  if (botMidAdd) {
    const startOffset = Math.ceil(length * 0.125);
    const itemLen = length - 2 * startOffset;
    bbs.push({
      mark: 'BB2',
      dia: botMidAdd.dia,
      shapeCode: 0, // Straight
      count: botMidAdd.count,
      length: itemLen,
      weightPerItem: itemLen / 1000 * getWeight(botMidAdd.dia),
      totalWeight: botMidAdd.count * (itemLen / 1000) * getWeight(botMidAdd.dia),
      bendDetails: `Straight Cut: ${itemLen}mm`,
    });
  }

  // Stirrups: shapeCode 37 (Closed stirrups)
  // Stirrup perimeter length: 2 * (w - 2 * cover) + 2 * (h - 2 * cover) + 2 * hookLength
  const innerW = width - 2 * cover;
  const innerH = depth - 2 * cover;
  const stirrupHook = Math.max(75, 6 * stirrupDia);
  const stirrupTotalLen = 2 * innerW + 2 * innerH + 2 * stirrupHook;
  const totalStirrupCount = stirrups.leftZone.count + stirrups.midZone.count + stirrups.rightZone.count;

  bbs.push({
    mark: 'BS1',
    dia: stirrupDia,
    shapeCode: 37,
    count: totalStirrupCount,
    length: stirrupTotalLen,
    weightPerItem: stirrupTotalLen / 1000 * getWeight(stirrupDia),
    totalWeight: totalStirrupCount * (stirrupTotalLen / 1000) * getWeight(stirrupDia),
    bendDetails: `Prism Outer: ${innerW}x${innerH}mm, Hook bend: 2x${Math.round(stirrupHook)}mm`,
  });

  // 7. BOQ & WEIGHT ESTIMATION
  const totalSteelWeight = bbs.reduce((sum, item) => sum + item.totalWeight, 0);
  const concreteVolume = (width / 1000) * (depth / 1000) * (length / 1000);
  const reinforcementRatio = totalSteelWeight / concreteVolume; // kg/m³
  
  // Cost estimation (e.g., $1.1 per kg steel fabrication, $130 per cubic meter concrete)
  const estimatedCost = totalSteelWeight * 1.15 + concreteVolume * 140;

  // 8. GEOMETRY-BASED CONGESTION WARNINGS AND QC
  const barSpacingIssue = topLayout.regions.left.candidates[0]?.congested ||
                          botLayout.regions.mid.candidates[0]?.congested;
  
  const minTopRebarArea = 0.0018 * width * depth; // ACI temperature-shrinkage minimum guideline
  const maxAllowableRatio = 0.025 * width * depth; // standard ACI flexure maximum ratio

  const topRebarAreaLeft = topLayout.regions.left.providedAs;
  const botRebarAreaMid = botLayout.regions.mid.providedAs;

  if (topRebarAreaLeft < minTopRebarArea) {
    warnings.push(`تحذير: مساحة حديد التسليح العلوي باليسار (${Math.round(topRebarAreaLeft)} mm²) أقل من الحد الأدنى المقترح (${Math.round(minTopRebarArea)} mm²).`);
  }
  if (botRebarAreaMid > maxAllowableRatio) {
    warnings.push(`تحذير: نسبة حديد التسليح السفلي بمنتصف البحر (${Math.round(botRebarAreaMid)} mm²) تتجاوز الحد الأقصى الآمن المسموح به (${Math.round(maxAllowableRatio)} mm²)، خطر الفشل القصف.`);
  }

  // Detect layer feasibility and width constraints
  let severeCongestion = false;
  let severity: 'low' | 'moderate' | 'high' = 'low';
  let congestionMsg = 'تصميم مثالي: توزيع مريح للحديد والخرسانة في طبقة واحدة.';

  if (barSpacingIssue) {
    severeCongestion = true;
    severity = 'moderate';
    congestionMsg = 'تحذير: تباعد حديد التسليح ضيق. يوصى بصفين أو استخدام أقطار أكبر لتقليل الازدحام.';
  }

  const maxTotalBars = Math.max(
    topCont.count + (topLeftAdd?.count || 0),
    topCont.count + (topRightAdd?.count || 0),
    botCont.count + (botMidAdd?.count || 0)
  );

  if (maxTotalBars > 7 && width < 300) {
    severeCongestion = true;
    severity = 'high';
    congestionMsg = 'ازدحام حديدي حاد: عدد الأسياخ كبير جداً لعرض المقطع الحالي! قد تحدث فراغات تعشيش.';
  }

  return {
    beamId,
    spanName,
    b: width,
    h: depth,
    length,
    fc,
    fy,
    fyt,
    cover,
    topRegions: topLayout.regions,
    bottomRegions: botLayout.regions,
    developmentLengths,
    stirrups,
    curtailments,
    bbs,
    boq: {
      concreteVolume: Math.round(concreteVolume * 1000) / 1000,
      steelWeight: Math.round(totalSteelWeight * 10) / 10,
      reinforcementRatio: Math.round(reinforcementRatio),
      estimatedCost: Math.round(estimatedCost),
    },
    warnings,
    congestion: {
      hasIssue: severeCongestion,
      severity,
      message: congestionMsg,
    },
  };
}

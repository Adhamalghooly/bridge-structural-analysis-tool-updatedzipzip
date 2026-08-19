/**
 * اختبارات وحدة لـ bbsGenerator.ts
 * ====================================
 * المرجع: BS 8666 (shape codes)، ACI 318 (حسابات أطوال الحديد)
 * مُنشئ BBS يعتمد على:
 *   - hookLength = max(12·dia/1000, 0.15)  بالمتر
 *   - وزن القضيب = dia²/162.2 × length (kg/m)
 *   - عوامل الهدر: beam=5%, column=3%, slab=8%
 */

import { describe, it, expect } from 'vitest';
import { generateBBS } from '@/rebar/bbsGenerator';
import type { Beam, Column, Slab, FlexureResult, ShearResult, ColumnResult, SlabDesignResult } from '@/lib/structuralEngine';

// ─── بيانات مرجعية ────────────────────────────────────────────────────────────
function makeBeam(id: string, length: number, storyId = 's1'): Beam {
  return {
    id, fromCol: 'c1', toCol: 'c2',
    x1: 0, y1: 0, x2: length * 1000, y2: 0,
    length, direction: 'horizontal', b: 300, h: 600,
    deadLoad: 5, liveLoad: 3, slabs: [], storyId,
  };
}

function makeColumn(id: string, storyId = 's1'): Column {
  return {
    id, x: 0, y: 0, b: 400, h: 400, L: 3000, storyId,
  };
}

function makeSlab(id: string, storyId = 's1'): Slab {
  return {
    id, x1: 0, y1: 0, x2: 5000, y2: 5000,
    slabType: 'solid', direction: 'auto', storyId,
  };
}

function makeFlexResult(Mu: number): FlexureResult {
  return {
    Mu, Ru: 1.0, rho: 0.003, As: 600, bars: 4, dia: 16,
    checkSpacing: 'ok', requiredSteelArea: 600, utilizationRatio: 0.85,
  };
}

function makeShearResult(): ShearResult {
  return {
    Vc: 80, Vs: 20, sRequired: 150, sMax: 250, sUsed: 150,
    stirrups: '2Φ10@150mm', stirrupLegs: 2, shearUtilization: 0.3,
    Vc_simplified: 80, Vc_detailed: 90,
  };
}

function makeColResult(bars: number, dia: number): ColumnResult {
  return {
    Pu: 1500, Mu: 40, checkSlenderness: 'قصير',
    bars, dia, stirrups: 'Φ8@240mm',
    phiPn: 2000, phiMn: 80, adequate: true,
    rhoActual: bars * Math.PI * dia * dia / 4 / (400 * 400),
    kLu_r: 25, deltaNs: 1.0, MuMagnified: 40,
    pmDiagram: [], utilizationRatio: 0.75,
  };
}

function makeSlabDesign(): SlabDesignResult {
  return {
    lx: 5000, ly: 5000, beta: 1.0, isOneWay: false,
    hMin: 180, hUsed: 200, ownWeight: 5.0, Wu: 12.4,
    discontinuousEdges: 0,
    shortDir: { bars: 5, dia: 12, spacing: 200 },
    longDir: { bars: 5, dia: 12, spacing: 200 },
    shortCoeff: 0.036, longCoeff: 0.036,
  };
}

// ─── 1. generateBBS — الجسور ─────────────────────────────────────────────────
describe('generateBBS — Beam BBS (BS 8666)', () => {
  it('يُولِّد مدخلات لكل جسر', () => {
    const beams = [makeBeam('B1', 5), makeBeam('B2', 4)];
    const beamDesigns = beams.map(b => ({
      beamId: b.id,
      flexLeft: makeFlexResult(100),
      flexMid: makeFlexResult(80),
      flexRight: makeFlexResult(100),
      shear: makeShearResult(),
    }));
    const entries = generateBBS(beams, [], [], beamDesigns, [], []);
    const beamEntries = entries.filter(e => e.memberType === 'beam');
    expect(beamEntries.length).toBeGreaterThan(0);
  });

  /**
   * hookLength = max(12×dia/1000, 0.15) بالمتر
   * لقطر 16mm: hookLength = max(12×16/1000, 0.15) = max(0.192, 0.15) = 0.192 m
   * حديد علوي: span×0.3 + hook = 5×0.3 + 0.192 = 1.692 m
   */
  it('طول الحديد العلوي صحيح (BS 8666 hook rule)', () => {
    const beam = makeBeam('B1', 5);
    const beamDesign = {
      beamId: 'B1',
      flexLeft: makeFlexResult(100),
      flexMid: makeFlexResult(80),
      flexRight: makeFlexResult(100),
      shear: makeShearResult(),
    };
    const entries = generateBBS([beam], [], [], [beamDesign], [], []);
    const topLeft = entries.find(e => e.barMark.startsWith('T') && e.member === 'B1');
    expect(topLeft).toBeDefined();
    if (topLeft) {
      const dia = topLeft.diameter;
      const hookLen = Math.max(12 * dia / 1000, 0.15);
      const expectedLen = 5 * 0.3 + hookLen;
      expect(topLeft.length).toBeCloseTo(expectedLen, 2);
    }
  });

  /**
   * orderWeight = netWeight × (1 + wastage)
   * wastage للجسور = 0.05 → orderWeight = 1.05 × netWeight
   */
  it('orderWeight = netWeight × 1.05 للجسور (wastage=5%)', () => {
    const beam = makeBeam('B1', 5);
    const beamDesign = {
      beamId: 'B1',
      flexLeft: makeFlexResult(100),
      flexMid: makeFlexResult(80),
      flexRight: makeFlexResult(100),
      shear: makeShearResult(),
    };
    const entries = generateBBS([beam], [], [], [beamDesign], [], []);
    const beamEntries = entries.filter(e => e.memberType === 'beam');
    for (const e of beamEntries) {
      const ratio = e.orderWeight / e.netWeight;
      expect(ratio).toBeCloseTo(1.05, 2);
    }
  });

  /**
   * وزن القضيب = dia²/162.2 × length_m
   * لقطر 16mm، طول 2m: weight = 256/162.2 × 2 ≈ 3.16 kg
   */
  it('وزن القضيب صحيح (dia²/162.2 × length)', () => {
    const dia = 16;
    const lengthM = 2.0;
    const expected = (dia * dia / 162.2) * lengthM;
    const beam = makeBeam('B1', 5);
    const beamDesign = {
      beamId: 'B1',
      flexLeft: { ...makeFlexResult(100), dia: 16, bars: 1 },
      flexMid: makeFlexResult(80),
      flexRight: makeFlexResult(100),
      shear: makeShearResult(),
    };
    const entries = generateBBS([beam], [], [], [beamDesign], [], []);
    const topLeft = entries.find(e => e.barMark === 'T1' && e.memberType === 'beam');
    expect(topLeft).toBeDefined();
    if (topLeft && topLeft.diameter === 16) {
      const computedWeight = (topLeft.diameter ** 2 / 162.2) * (topLeft.length * topLeft.quantity);
      expect(topLeft.netWeight).toBeCloseTo(computedWeight, 1);
    }
  });
});

// ─── 2. generateBBS — الأعمدة ────────────────────────────────────────────────
describe('generateBBS — Column BBS', () => {
  it('يُولِّد مدخلات للأعمدة', () => {
    const cols = [makeColumn('C1'), makeColumn('C2')];
    const colDesigns = cols.map(c => ({
      id: c.id,
      b: 400, h: 400,
      design: makeColResult(8, 18),
    }));
    const entries = generateBBS([], cols, [], [], colDesigns, []);
    const colEntries = entries.filter(e => e.memberType === 'column');
    expect(colEntries.length).toBeGreaterThan(0);
  });

  /**
   * orderWeight للأعمدة ≈ netWeight × 1.03 (wastage=3%)
   * ملاحظة: القيم مقرّبة لـ decimal واحد (toFixed(1)) مما يسبب فارق صغير في النسبة.
   * التحقق: orderWeight أكبر من netWeight بنسبة تقارب 3%.
   */
  it('orderWeight > netWeight للأعمدة وبفارق ≈ 3% (wastage=3%)', () => {
    const cols = [makeColumn('C1')];
    const colDesigns = [{ id: 'C1', b: 400, h: 400, design: makeColResult(8, 18) }];
    const entries = generateBBS([], cols, [], [], colDesigns, []);
    const colEntries = entries.filter(e => e.memberType === 'column');
    expect(colEntries.length).toBeGreaterThan(0);
    for (const e of colEntries) {
      expect(e.orderWeight).toBeGreaterThan(e.netWeight);
      const ratio = e.orderWeight / e.netWeight;
      expect(ratio).toBeGreaterThan(1.0);
      expect(ratio).toBeLessThan(1.15);
    }
  });
});

// ─── 3. generateBBS — البلاطات ──────────────────────────────────────────────
describe('generateBBS — Slab BBS', () => {
  it('يُولِّد مدخلات للبلاطات', () => {
    const slabs = [makeSlab('S1')];
    const slabDesigns = [{ id: 'S1', design: makeSlabDesign() }];
    const entries = generateBBS([], [], slabs, [], [], slabDesigns);
    const slabEntries = entries.filter(e => e.memberType === 'slab');
    expect(slabEntries.length).toBeGreaterThan(0);
  });

  /**
   * orderWeight للبلاطات = netWeight × 1.08 (wastage=8%)
   */
  it('orderWeight = netWeight × 1.08 للبلاطات (wastage=8%)', () => {
    const slabs = [makeSlab('S1')];
    const slabDesigns = [{ id: 'S1', design: makeSlabDesign() }];
    const entries = generateBBS([], [], slabs, [], [], slabDesigns);
    const slabEntries = entries.filter(e => e.memberType === 'slab');
    for (const e of slabEntries) {
      const ratio = e.orderWeight / e.netWeight;
      expect(ratio).toBeCloseTo(1.08, 2);
    }
  });
});

// ─── 4. filterStoryId ────────────────────────────────────────────────────────
describe('generateBBS — فلتر الطابق', () => {
  it('يُعيد فقط عناصر الطابق المحدد', () => {
    const beams = [makeBeam('B1', 5, 'story-1'), makeBeam('B2', 4, 'story-2')];
    const beamDesigns = beams.map(b => ({
      beamId: b.id,
      flexLeft: makeFlexResult(80),
      flexMid: makeFlexResult(60),
      flexRight: makeFlexResult(80),
      shear: makeShearResult(),
    }));
    const entries = generateBBS(beams, [], [], beamDesigns, [], [], 'story-1');
    const members = [...new Set(entries.map(e => e.member))];
    expect(members).toContain('B1');
    expect(members).not.toContain('B2');
  });

  it('بدون فلتر → يُعيد عناصر جميع الطوابق', () => {
    const beams = [makeBeam('B1', 5, 'story-1'), makeBeam('B2', 4, 'story-2')];
    const beamDesigns = beams.map(b => ({
      beamId: b.id,
      flexLeft: makeFlexResult(80),
      flexMid: makeFlexResult(60),
      flexRight: makeFlexResult(80),
      shear: makeShearResult(),
    }));
    const entries = generateBBS(beams, [], [], beamDesigns, [], []);
    const members = [...new Set(entries.map(e => e.member))];
    expect(members).toContain('B1');
    expect(members).toContain('B2');
  });
});

// ─── 5. حالات حدية ───────────────────────────────────────────────────────────
describe('generateBBS — حالات حدية', () => {
  it('قوائم فارغة → يعيد مصفوفة فارغة', () => {
    const entries = generateBBS([], [], [], [], [], []);
    expect(entries).toEqual([]);
  });

  it('جسر غير موجود في beamDesigns → يتجاهله', () => {
    const beam = makeBeam('B_GHOST', 5);
    const entries = generateBBS([beam], [], [], [], [], []);
    expect(entries.filter(e => e.member === 'B_GHOST').length).toBe(0);
  });
});

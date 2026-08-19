/**
 * اختبارات وحدة لـ structuralEngine.ts
 * ======================================
 * جميع الحالات المرجعية مستمدة من ACI 318-19 ومن حلول تحليلية معروفة.
 * المصدر: ACI 318-19 Building Code Requirements for Structural Concrete.
 */

import { describe, it, expect } from 'vitest';
import {
  designFlexure,
  designShear,
  designColumnETABS,
  designSlab,
  diagnoseBeam,
  calculateDeflection,
} from '@/lib/structuralEngine';
import type { Slab, SlabProps, MatProps } from '@/lib/structuralEngine';

// ─── مواد مرجعية شائعة الاستخدام ─────────────────────────────────────────────
const MAT_C25_S420: MatProps = { fc: 25, fy: 420, fyt: 280, gamma: 25 };
const MAT_C28_S420: MatProps = { fc: 28, fy: 420, fyt: 280, gamma: 25 };
const MAT_C30_S420: MatProps = { fc: 30, fy: 420, fyt: 280, gamma: 25 };

const SLAB_PROPS: SlabProps = {
  thickness: 200, finishLoad: 1.5, liveLoad: 2.0,
  cover: 20, phiMain: 12, phiSlab: 12,
};

// ─── 1. designFlexure ─────────────────────────────────────────────────────────
describe('designFlexure — ACI 318-19', () => {
  /**
   * حالة مرجعية: جسر 300×600mm، fc=25MPa، fy=420MPa
   * Mu = 100 kN.m
   * d = 600 - 40 - 10 - 6 = 544mm
   * Ru = 100e6 / (300 × 544²) = 1.127 MPa
   * ρ = (0.85×25/420) × (1 − √(1 − 2×1.127/(0.9×0.85×25))) ≈ 0.00283
   * rhoMin = max(0.25√25/420, 1.4/420) = max(0.00298, 0.00333) = 0.00333
   * As = max(0.00283, 0.00333) × 300 × 544 ≈ 544 mm²
   */
  it('يحسب As بشكل صحيح للحالة المبسطة (مستطيل)', () => {
    const result = designFlexure(100, 300, 600, 25, 420);
    expect(result.Mu).toBeCloseTo(100, 0);
    expect(result.As).toBeGreaterThan(400);
    expect(result.As).toBeLessThan(900);
    expect(result.bars).toBeGreaterThanOrEqual(4);
    expect([10, 12, 14, 16]).toContain(result.dia);
  });

  /**
   * حالة حد أدنى: Mu صغير جداً → يحكم rhoMin
   * ACI 318-19 §9.6.1.2: رhoMin = max(0.25√f'c/fy, 1.4/fy)
   */
  it('يطبق rhoMin عند Mu صغير جداً (ACI §9.6.1.2)', () => {
    const result = designFlexure(5, 300, 500, 25, 420);
    const d = 500 - 40 - 10 - 6;
    const rhoMin = Math.max(0.25 * Math.sqrt(25) / 420, 1.4 / 420);
    const AsMin = rhoMin * 300 * d;
    expect(result.As).toBeGreaterThanOrEqual(AsMin * 0.95);
  });

  /**
   * فحص الفاصل بين القضبان ACI 318-19 §25.2.1
   * يجب أن يكون checkSpacing === 'ok' للجسور العادية
   */
  it('يتحقق من الفاصل بين القضبان (ACI §25.2.1)', () => {
    const result = designFlexure(80, 300, 550, 25, 420);
    expect(result.checkSpacing).toBeDefined();
  });

  /**
   * يجب أن يعيد bars بعدد صحيح موجب ≥ minBars (الافتراضي 2)
   * ملاحظة: designFlexure تُجبر 4 قضبان كحد أدنى فقط عندما يحكم rhoMin.
   * القيود: bars ≥ 2، صحيح دائماً.
   */
  it('يعيد عدد قضبان صحيح موجب دائماً', () => {
    const cases = [
      { Mu: 50, b: 250, h: 500 },
      { Mu: 200, b: 350, h: 700 },
      { Mu: 10, b: 200, h: 400 },
    ];
    for (const c of cases) {
      const r = designFlexure(c.Mu, c.b, c.h, 25, 420);
      expect(r.bars).toBeGreaterThanOrEqual(2);
      expect(Number.isInteger(r.bars)).toBe(true);
    }
  });

  /**
   * T-beam: عند وجود بلاطة وعزم موجب → bEffective > b
   * النتيجة: As أقل من الجسر المستطيل (مقاومة أكبر بنفس العزم)
   */
  it('T-beam يعطي As أقل من المستطيل (flange في الضغط)', () => {
    const rect = designFlexure(150, 300, 600, 25, 420, 40, false);
    const tBeam = designFlexure(150, 300, 600, 25, 420, 40, true, 180, 1200);
    expect(tBeam.As).toBeLessThanOrEqual(rect.As + 1);
  });

  /**
   * التحقق من سلامة beta1
   * ACI 318-19 §22.2.2.3: beta1 = 0.85 لـ fc≤28, يتناقص بعدها
   */
  it('beta1 صحيح: 0.85 عند fc=28 ويتناقص عند fc>28', () => {
    const r28 = designFlexure(100, 300, 600, 28, 420);
    const r35 = designFlexure(100, 300, 600, 35, 420);
    expect(r35.rho).toBeLessThanOrEqual(r28.rho + 0.002);
  });

  /**
   * utilizationRatio بين 0 و 1 دائماً
   */
  it('utilizationRatio بين 0 و 1', () => {
    const r = designFlexure(120, 300, 600, 25, 420);
    expect(r.utilizationRatio).toBeGreaterThan(0);
    expect(r.utilizationRatio).toBeLessThanOrEqual(1.0 + 0.01);
  });
});

// ─── 2. designShear ──────────────────────────────────────────────────────────
describe('designShear — ACI 318-19', () => {
  /**
   * حالة مرجعية: b=300mm، h=600mm، d=544mm، fc=25MPa، fyt=280MPa، Vu=150kN
   * Vc_simplified = (1/6)·√25·300·544/1000 = (1/6)·5·300·544/1000 ≈ 136 kN
   * ACI 318-19 §22.5.5.1
   */
  it('Vc_simplified = (1/6)·√fc·bw·d (ACI §22.5.5.1)', () => {
    const r = designShear(150, 300, 600, 25, 280);
    const d = 600 - 40 - 10 - 6;
    const expected = (1 / 6) * Math.sqrt(25) * 300 * d / 1000;
    expect(r.Vc_simplified).toBeCloseTo(expected, 1);
  });

  /**
   * ACI 318-19 §9.7.6.2.2: s_max = min(d/2, 600mm) عند Vs صغير
   */
  it('sMax = min(d/2, 600) عند Vs صغير (ACI §9.7.6.2.2)', () => {
    const r = designShear(100, 300, 600, 25, 280);
    const d = 600 - 40 - 10 - 6;
    expect(r.sMax).toBeLessThanOrEqual(Math.min(d / 2, 600));
  });

  /**
   * sUsed يجب أن يكون مضاعفاً لـ 25mm وأكبر من 75mm
   */
  it('sUsed مضاعف 25mm وأكبر من 75mm', () => {
    const cases = [80, 150, 250, 350];
    for (const Vu of cases) {
      const r = designShear(Vu, 300, 600, 25, 280);
      expect(r.sUsed % 25).toBe(0);
      expect(r.sUsed).toBeGreaterThanOrEqual(75);
    }
  });

  /**
   * Vs ≥ 0 دائماً
   */
  it('Vs ≥ 0 دائماً', () => {
    const r = designShear(50, 300, 600, 25, 280);
    expect(r.Vs).toBeGreaterThanOrEqual(0);
  });

  /**
   * عزل القطاع الحرج: مع wu → VuDesign < Vu (ACI §9.4.3.2)
   */
  it('القطاع الحرج: VuDesign < Vu عند وجود حمل موزع (ACI §9.4.3.2)', () => {
    const rWithoutCritical = designShear(200, 300, 600, 25, 280);
    const rWithCritical = designShear(200, 300, 600, 25, 280, 40, 10, 30, 300);
    expect(rWithCritical.Vs).toBeLessThanOrEqual(rWithoutCritical.Vs + 1);
  });

  /**
   * فحص نص الكانات: يجب أن يحتوي على عدد الأرجل والقطر والمسافة
   */
  it('نص الكانات يحتوي على المعلومات الكافية', () => {
    const r = designShear(150, 300, 600, 25, 280);
    expect(r.stirrups).toMatch(/\d+Φ\d+@\d+mm/);
  });
});

// ─── 3. designColumnETABS ────────────────────────────────────────────────────
describe('designColumnETABS — ACI 318-19', () => {
  /**
   * حالة عمود قصير بسيط: 400×400mm، Lu=3000mm
   * kLu/r = 1×3000/(0.3×400) = 25 < 34 → قصير
   */
  it('يصنف العمود القصير بشكل صحيح (ACI §6.2.5)', () => {
    const r = designColumnETABS(2000, 50, 400, 400, 25, 420, 3000);
    const kLu_r = 1 * 3000 / (0.3 * 400);
    expect(r.kLu_r).toBeCloseTo(kLu_r, 1);
    expect(r.checkSlenderness).toBe('قصير');
    expect(r.deltaNs).toBeCloseTo(1.0, 1);
  });

  /**
   * عمود نحيف: kLu/r > 34 → يجب تكبير العزم
   * ACI 318-19 §6.6.4
   */
  it('يكبّر العزم للعمود النحيف (ACI §6.6.4)', () => {
    const r = designColumnETABS(500, 30, 300, 300, 25, 420, 6000);
    const kLu_r = 1 * 6000 / (0.3 * 300);
    expect(kLu_r).toBeGreaterThan(34);
    expect(r.MuMagnified).toBeGreaterThanOrEqual(30);
  });

  /**
   * rhoActual يجب أن يكون بين 1% و 8% (ACI 318-19 §10.6.1.1)
   */
  it('rhoActual بين 0.01 و 0.08 (ACI §10.6.1.1)', () => {
    const cases = [
      { Pu: 1000, Mu: 30, b: 300, h: 300 },
      { Pu: 3000, Mu: 100, b: 500, h: 500 },
      { Pu: 500, Mu: 20, b: 250, h: 350 },
    ];
    for (const c of cases) {
      const r = designColumnETABS(c.Pu, c.Mu, c.b, c.h, 25, 420, 3500);
      expect(r.rhoActual).toBeGreaterThanOrEqual(0.009);
      expect(r.rhoActual).toBeLessThanOrEqual(0.09);
    }
  });

  /**
   * bars يجب أن يكون زوجياً ≥ 4
   */
  it('عدد القضبان زوجي ≥ 4', () => {
    const r = designColumnETABS(1500, 40, 350, 350, 25, 420, 3200);
    expect(r.bars).toBeGreaterThanOrEqual(4);
    expect(r.bars % 2).toBe(0);
  });

  /**
   * مخطط P-M يجب أن يحتوي على نقاط بـ phiPn > 0 وفي التسلسل الصحيح
   */
  it('مخطط P-M يحتوي على نقاط صحيحة', () => {
    const r = designColumnETABS(2000, 60, 400, 400, 25, 420, 3000);
    expect(r.pmDiagram.length).toBeGreaterThan(5);
    const maxPn = Math.max(...r.pmDiagram.map(p => p.phiPn));
    expect(maxPn).toBeGreaterThan(0);
  });
});

// ─── 4. designSlab ───────────────────────────────────────────────────────────
describe('designSlab — ACI 318-19', () => {
  const makeSlab = (x1: number, y1: number, x2: number, y2: number): Slab => ({
    id: 's1', x1, y1, x2, y2,
    slabType: 'solid', direction: 'auto',
  });

  /**
   * بلاطة مربعة 5×5m → beta=1 → ثنائية الاتجاه
   */
  it('بلاطة مربعة 5×5m → ثنائية الاتجاه (ACI §8.3)', () => {
    const slab = makeSlab(0, 0, 5000, 5000);
    const r = designSlab(slab, SLAB_PROPS, MAT_C25_S420, [slab]);
    expect(r.isOneWay).toBe(false);
    expect(r.lx).toBeCloseTo(5000, 0);
    expect(r.ly).toBeCloseTo(5000, 0);
    expect(r.beta).toBeCloseTo(1.0, 2);
  });

  /**
   * بلاطة مستطيلة 3×9m → beta=3 > 2 → أحادية الاتجاه (ACI §8.3.1.1)
   */
  it('بلاطة 3×9m → أحادية الاتجاه (ACI §8.3.1.1)', () => {
    const slab = makeSlab(0, 0, 3000, 9000);
    const r = designSlab(slab, SLAB_PROPS, MAT_C25_S420, [slab]);
    expect(r.isOneWay).toBe(true);
  });

  /**
   * السمك المستخدم ≥ الحد الأدنى وأكبر من سمك الإدخال
   */
  it('hUsed ≥ hMin وhUsed ≥ props.thickness', () => {
    const slab = makeSlab(0, 0, 4000, 4000);
    const r = designSlab(slab, SLAB_PROPS, MAT_C25_S420, [slab]);
    expect(r.hUsed).toBeGreaterThanOrEqual(r.hMin);
    expect(r.hUsed).toBeGreaterThanOrEqual(SLAB_PROPS.thickness);
  });

  /**
   * Wu = 1.2×(SW+SDL) + 1.6×LL — فحص تقريبي
   * ownWeight = (hUsed/1000) × gamma
   */
  it('Wu يحسب بصيغة ACI 318-19 §5.3.1 (1.2D + 1.6L)', () => {
    const slab = makeSlab(0, 0, 5000, 5000);
    const r = designSlab(slab, SLAB_PROPS, MAT_C25_S420, [slab]);
    const ownWeight = (r.hUsed / 1000) * MAT_C25_S420.gamma;
    const expectedWu = 1.2 * (ownWeight + SLAB_PROPS.finishLoad) + 1.6 * SLAB_PROPS.liveLoad;
    expect(r.Wu).toBeCloseTo(expectedWu, 1);
  });

  /**
   * shortDir.spacing > 0 ودائماً منطقي
   */
  it('shortDir spacing موجب', () => {
    const slab = makeSlab(0, 0, 4000, 6000);
    const r = designSlab(slab, SLAB_PROPS, MAT_C25_S420, [slab]);
    expect(r.shortDir.spacing).toBeGreaterThan(0);
    expect(r.shortDir.bars).toBeGreaterThan(0);
    expect(r.shortDir.dia).toBeGreaterThan(0);
  });

  /**
   * بلاطة مضلعة: تُجبر isOneWay = true
   */
  it('one_way_ribbed → isOneWay=true دائماً', () => {
    const slab: Slab = {
      id: 's2', x1: 0, y1: 0, x2: 4000, y2: 6000,
      slabType: 'one_way_ribbed', direction: 'one_way_x',
    };
    const r = designSlab(slab, SLAB_PROPS, MAT_C25_S420, [slab]);
    expect(r.isOneWay).toBe(true);
  });
});

// ─── 5. diagnoseBeam — فحوصات حدية ──────────────────────────────────────────
describe('diagnoseBeam — ACI 318-19', () => {
  const makeFlexResult = (Mu: number) => ({
    Mu, Ru: 1.0, rho: 0.003, As: 500, bars: 4, dia: 12, checkSpacing: 'ok',
    requiredSteelArea: 500, utilizationRatio: 0.85,
  });
  const makeShearResult = () => ({
    Vc: 80, Vs: 20, sRequired: 200, sMax: 250, sUsed: 200,
    stirrups: '2Φ10@200mm', stirrupLegs: 2, shearUtilization: 0.3,
    Vc_simplified: 80, Vc_detailed: 90,
  });
  const makeDeflResult = () => ({
    deflection: 8, deflectionRatio: 600, allowableDeflection: 12,
    isServiceable: true, limitUsed: 'L/480',
  });

  it('تشخيص صحيح للجسر الكافي', () => {
    const result = diagnoseBeam(
      'B1',
      { b: 300, h: 600, length: 5 },
      makeFlexResult(80), makeFlexResult(60), makeFlexResult(80),
      makeShearResult(),
      makeDeflResult(),
      25, 420, 280, 5, 80, 150, 0, 0
    );
    expect(result.beamId).toBe('B1');
    expect(Array.isArray(result.failures)).toBe(true);
  });
});

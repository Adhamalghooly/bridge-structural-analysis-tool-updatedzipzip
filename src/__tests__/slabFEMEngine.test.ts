/**
 * اختبارات وحدة لمحرك FEM — Mindlin Shell + Assembler
 * =====================================================
 * الحالات المرجعية:
 * - مصفوفة الجساءة: Bathe & Dvorkin (1985), MITC4.
 * - التكامل: Cook et al., "Concepts and Applications of FEA" 4th Ed.
 * - التوازن: مجموع قوى العقد = q × مساحة العنصر (شرط ضروري).
 */

import { describe, it, expect } from 'vitest';
import {
  elementStiffness,
  elementLoadVector,
  SLAB_STIFFNESS_REDUCTION,
} from '@/slabFEMEngine/mindlinShell';
import {
  assembleSystem,
  reconstructDisplacements,
  extractReactions,
} from '@/slabFEMEngine/assembler';
import { meshSlab } from '@/slabFEMEngine/mesh';
import type { FEMNode, FEMElement } from '@/slabFEMEngine/types';
import type { SlabProps, MatProps } from '@/lib/structuralEngine';

// ─── مواد مرجعية ─────────────────────────────────────────────────────────────
const MAT: MatProps = { fc: 25, fy: 420, fyt: 280, gamma: 25 };

const SLAB: SlabProps = {
  thickness: 200, finishLoad: 1.5, liveLoad: 2.0,
  cover: 20, phiMain: 12, phiSlab: 12,
};

// ─── عنصر مرجعي: مربع 1000×1000mm ───────────────────────────────────────────
function makeSingleElement(): { elem: FEMElement; nodes: FEMNode[] } {
  const nodes: FEMNode[] = [
    { x: 0,    y: 0,    isFixed: false },
    { x: 1000, y: 0,    isFixed: false },
    { x: 1000, y: 1000, isFixed: false },
    { x: 0,    y: 1000, isFixed: false },
  ];
  const elem: FEMElement = { nodeIds: [0, 1, 2, 3] };
  return { elem, nodes };
}

// ─── 1. elementStiffness ─────────────────────────────────────────────────────
describe('elementStiffness — Mindlin MITC4', () => {
  it('تعيد مصفوفة 12×12 (144 عنصر)', () => {
    const { elem, nodes } = makeSingleElement();
    const ke = elementStiffness(elem, nodes, SLAB, MAT);
    expect(ke.length).toBe(144);
  });

  it('المصفوفة متماثلة (Kij ≈ Kji)', () => {
    const { elem, nodes } = makeSingleElement();
    const ke = elementStiffness(elem, nodes, SLAB, MAT);
    for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        expect(ke[i * 12 + j]).toBeCloseTo(ke[j * 12 + i], 3);
      }
    }
  });

  it('عناصر القطر الرئيسي ≥ 0 (شرط المصفوفة الموجبة شبه المحددة)', () => {
    const { elem, nodes } = makeSingleElement();
    const ke = elementStiffness(elem, nodes, SLAB, MAT);
    for (let i = 0; i < 12; i++) {
      expect(ke[i * 12 + i]).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * SLAB_STIFFNESS_REDUCTION = 0.25
   * ACI 318-19 §6.6.3.1: الجساءة الفعالة = 0.25·Ig
   */
  it('معامل تخفيض الجساءة = 0.25 (ACI §6.6.3.1)', () => {
    expect(SLAB_STIFFNESS_REDUCTION).toBeCloseTo(0.25, 5);
  });

  /**
   * التحقق من تأثير السُمك: مضاعفة t ترفع جساءة الانحناء بنسبة t³.
   * لكن الـ DOF الأول (UZ) يجمع انحناء وقص، لذلك نقارن الجساءة الإجمالية.
   * عند t=200 مقابل t=100: النسبة يجب أن تكون > 1 (يزيد مع السُمك).
   * Db ∝ t³ (نسبة 8)، Ds ∝ t (نسبة 2) → النسبة الكلية بين 2 و 8.
   * المصدر: Bathe & Dvorkin (1985), Cook et al.
   */
  it('الجساءة تزيد مع السُمك (Db ∝ t³, Cook et al.)', () => {
    const { elem, nodes } = makeSingleElement();
    const slab100: SlabProps = { ...SLAB, thickness: 100 };
    const slab200: SlabProps = { ...SLAB, thickness: 200 };
    const ke100 = elementStiffness(elem, nodes, slab100, MAT);
    const ke200 = elementStiffness(elem, nodes, slab200, MAT);

    // نجمع مجموع عناصر القطر الرئيسي كمقياس للجساءة الكلية
    let sum100 = 0, sum200 = 0;
    for (let i = 0; i < 12; i++) {
      sum100 += Math.abs(ke100[i * 12 + i]);
      sum200 += Math.abs(ke200[i * 12 + i]);
    }
    expect(sum200).toBeGreaterThan(sum100);
  });

  /**
   * وضع الجسم الصلب UZ: إذا طُبّق إزاحة UZ = 1 على جميع العقد مع RX=RY=0
   * فإن المحصلة [K·u] يجب أن تكون ≈ 0 لـ DOFs الإزاحة (rigid body translation).
   * d = [1,0,0, 1,0,0, 1,0,0, 1,0,0]
   * المصدر: Cook et al., Concepts and Applications of FEA §4.4
   */
  it('وضع الجسم الصلب (UZ rigid body) → Ke·d ≈ 0', () => {
    const { elem, nodes } = makeSingleElement();
    const ke = elementStiffness(elem, nodes, SLAB, MAT);
    const d = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]; // UZ=1, RX=RY=0
    const result = new Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        result[i] += ke[i * 12 + j] * d[j];
      }
    }
    // فقط DOFs الـ UZ (indices 0,3,6,9) يجب أن تكون ≈ 0
    const uzDOFs = [0, 3, 6, 9];
    for (const idx of uzDOFs) {
      expect(Math.abs(result[idx])).toBeLessThan(1e-3);
    }
  });

  it('جساءة العنصر المربع تتناسب مع fc بشكل صحيح (Ec ∝ √fc)', () => {
    const { elem, nodes } = makeSingleElement();
    const mat25: MatProps = { ...MAT, fc: 25 };
    const mat36: MatProps = { ...MAT, fc: 36 };
    const ke25 = elementStiffness(elem, nodes, SLAB, mat25);
    const ke36 = elementStiffness(elem, nodes, SLAB, mat36);
    // Ec = 4700√fc → Ec36/Ec25 = √36/√25 = 6/5 = 1.2
    // الجساءة تتناسب مع Ec → النسبة ≈ 1.2
    const ratio = ke36[0] / ke25[0];
    expect(ratio).toBeCloseTo(1.2, 1);
  });
});

// ─── 2. elementLoadVector ────────────────────────────────────────────────────
describe('elementLoadVector — تكامل Gauss', () => {
  it('تعيد متجه 12 عنصر', () => {
    const { elem, nodes } = makeSingleElement();
    const fe = elementLoadVector(elem, nodes, 0.01);
    expect(fe.length).toBe(12);
  });

  /**
   * الحمل الإجمالي على العنصر = q × مساحة العنصر
   * المساحة = 1000×1000 = 1e6 mm²
   * q = 0.01 N/mm² → F_total = 0.01×1e6 = 10,000 N
   * المصدر: Cook et al., Concepts and Applications of FEA §6.4
   */
  it('مجموع قوى UZ = q × مساحة (equilibrium)', () => {
    const { elem, nodes } = makeSingleElement();
    const q = 0.01; // N/mm²
    const area = 1000 * 1000; // mm²
    const fe = elementLoadVector(elem, nodes, q);
    const totalFz = fe[0] + fe[3] + fe[6] + fe[9]; // UZ indices: 0,3,6,9
    expect(totalFz).toBeCloseTo(q * area, 1);
  });

  it('لا توجد عزوم (RX, RY) للضغط المنتظم', () => {
    const { elem, nodes } = makeSingleElement();
    const fe = elementLoadVector(elem, nodes, 0.01);
    const momentDOFs = [1, 2, 4, 5, 7, 8, 10, 11];
    for (const idx of momentDOFs) {
      expect(Math.abs(fe[idx])).toBeLessThan(1e-6);
    }
  });

  it('القوة تتناسب خطياً مع q', () => {
    const { elem, nodes } = makeSingleElement();
    const fe1 = elementLoadVector(elem, nodes, 0.01);
    const fe2 = elementLoadVector(elem, nodes, 0.02);
    expect(fe2[0]).toBeCloseTo(2 * fe1[0], 3);
  });

  it('التوزيع المتساوٍ على العقد الأربعة (تناظر)', () => {
    const { elem, nodes } = makeSingleElement();
    const fe = elementLoadVector(elem, nodes, 0.01);
    // للعنصر المربع المتماثل، كل عقدة تأخذ نفس القوة
    expect(fe[0]).toBeCloseTo(fe[3], 3);
    expect(fe[3]).toBeCloseTo(fe[6], 3);
    expect(fe[6]).toBeCloseTo(fe[9], 3);
  });
});

// ─── 3. assembleSystem ───────────────────────────────────────────────────────
describe('assembleSystem — شبكة بلاطة بسيطة', () => {
  /**
   * بلاطة مربعة 2000×2000mm
   * meshSlab(slab, beams=[], columns=[], meshDensity=2)
   * يجب أن تنتج نظاماً صالحاً مع freeDOFs > 0 وF_f غير فارغة
   */
  it('يعيد نظاماً محلولاً صالحاً', () => {
    const slab = {
      id: 's1', x1: 0, y1: 0, x2: 2000, y2: 2000,
      slabType: 'solid' as const, direction: 'auto' as const,
    };
    const mesh = meshSlab(slab, [], [], 2);
    expect(mesh).toBeDefined();
    expect(mesh.nodes.length).toBeGreaterThan(0);
    expect(mesh.elements.length).toBeGreaterThan(0);

    const q = 0.01; // N/mm²
    const sys = assembleSystem(mesh, SLAB, MAT, q);

    expect(sys.nDOF).toBe(mesh.nodes.length * 3);
    expect(sys.freeDOFs.length).toBeGreaterThan(0);
    expect(sys.F_f.length).toBe(sys.freeDOFs.length);
    expect(sys.K_ff.length).toBe(sys.freeDOFs.length * sys.freeDOFs.length);
  });

  it('حجم K_ff = freeDOFs²', () => {
    const slab = {
      id: 's1', x1: 0, y1: 0, x2: 1000, y2: 1000,
      slabType: 'solid' as const, direction: 'auto' as const,
    };
    const mesh = meshSlab(slab, [], [], 2);
    const sys = assembleSystem(mesh, SLAB, MAT, 0.01);
    expect(sys.K_ff.length).toBe(sys.freeDOFs.length ** 2);
  });

  it('مجموع قوى F_full ≈ q × مساحة البلاطة (توازن عالمي)', () => {
    const slab = {
      id: 's1', x1: 0, y1: 0, x2: 2000, y2: 2000,
      slabType: 'solid' as const, direction: 'auto' as const,
    };
    const mesh = meshSlab(slab, [], [], 2);
    const q = 0.01; // N/mm²
    const sys = assembleSystem(mesh, SLAB, MAT, q);

    // مجموع DOFs الـ UZ فقط (كل ثالث ابتداءً من 0)
    let totalFz = 0;
    for (let i = 0; i < sys.nDOF; i += 3) {
      totalFz += sys.F_full[i];
    }
    const area = 2000 * 2000; // mm²
    expect(totalFz).toBeCloseTo(q * area, -2); // tolerance ±100N
  });

  it('freeDOFs + fixedDOFs = nDOF', () => {
    const slab = {
      id: 's1', x1: 0, y1: 0, x2: 2000, y2: 2000,
      slabType: 'solid' as const, direction: 'auto' as const,
    };
    const mesh = meshSlab(slab, [], [], 2);
    const sys = assembleSystem(mesh, SLAB, MAT, 0.01);
    expect(sys.freeDOFs.length + sys.fixedDOFs.length).toBe(sys.nDOF);
  });
});

// ─── 4. reconstructDisplacements + extractReactions ──────────────────────────
// توقيعات الدوال الفعلية:
//   reconstructDisplacements(d_free, freeDOFs, nDOF) → number[]
//   extractReactions(K_full, d_full, F_full, fixedDOFs, nDOF) → Map<number, number>
describe('reconstructDisplacements + extractReactions', () => {
  it('reconstructDisplacements تعيد متجهاً بحجم nDOF', () => {
    const slab = {
      id: 's1', x1: 0, y1: 0, x2: 1000, y2: 1000,
      slabType: 'solid' as const, direction: 'auto' as const,
    };
    const mesh = meshSlab(slab, [], [], 2);
    const sys = assembleSystem(mesh, SLAB, MAT, 0.01);
    const dFree = new Array(sys.freeDOFs.length).fill(0.5);
    const dFull = reconstructDisplacements(dFree, sys.freeDOFs, sys.nDOF);
    expect(dFull.length).toBe(sys.nDOF);
  });

  it('DOFs المثبّتة تكون صفراً في dFull', () => {
    const slab = {
      id: 's1', x1: 0, y1: 0, x2: 1000, y2: 1000,
      slabType: 'solid' as const, direction: 'auto' as const,
    };
    const mesh = meshSlab(slab, [], [], 2);
    const sys = assembleSystem(mesh, SLAB, MAT, 0.01);
    const dFree = new Array(sys.freeDOFs.length).fill(0.5);
    const dFull = reconstructDisplacements(dFree, sys.freeDOFs, sys.nDOF);
    for (const dof of sys.fixedDOFs) {
      expect(dFull[dof]).toBe(0);
    }
  });

  it('extractReactions تعيد Map بحجم fixedDOFs', () => {
    const slab = {
      id: 's1', x1: 0, y1: 0, x2: 1000, y2: 1000,
      slabType: 'solid' as const, direction: 'auto' as const,
    };
    const mesh = meshSlab(slab, [], [], 2);
    const sys = assembleSystem(mesh, SLAB, MAT, 0.01);
    const dFree = new Array(sys.freeDOFs.length).fill(0);
    const dFull = reconstructDisplacements(dFree, sys.freeDOFs, sys.nDOF);
    const reactions = extractReactions(sys.K_full, dFull, sys.F_full, sys.fixedDOFs, sys.nDOF);
    expect(reactions.size).toBe(sys.fixedDOFs.length);
  });

  it('ردود الفعل كلها قابلة للوصول كأرقام', () => {
    const slab = {
      id: 's1', x1: 0, y1: 0, x2: 1000, y2: 1000,
      slabType: 'solid' as const, direction: 'auto' as const,
    };
    const mesh = meshSlab(slab, [], [], 2);
    const sys = assembleSystem(mesh, SLAB, MAT, 0.01);
    const dFree = new Array(sys.freeDOFs.length).fill(0);
    const dFull = reconstructDisplacements(dFree, sys.freeDOFs, sys.nDOF);
    const reactions = extractReactions(sys.K_full, dFull, sys.F_full, sys.fixedDOFs, sys.nDOF);
    for (const [dof, r] of reactions) {
      expect(typeof dof).toBe('number');
      expect(typeof r).toBe('number');
      expect(isNaN(r)).toBe(false);
    }
  });
});

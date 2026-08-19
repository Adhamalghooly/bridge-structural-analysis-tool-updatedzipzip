/**
 * Beam End Releases — أنواع وثوابت تحرير نهايات الجسور
 * =====================================================
 * مستخرجة من Index.tsx في المرحلة 2 من إعادة الهيكلة.
 * يُشار إليها في: الجدول الإدخالي لتحرير النهايات، محرر التحرير اليدوي،
 * ومحلِّل الإطارات (للتمرير إلى محركات التحليل).
 *
 * إشارة ETABS: U1/U2/U3/R1/R2/R3 (نفس تسميات ETABS Beam End Releases).
 */

export type ReleaseDOF = 'ux' | 'uy' | 'uz' | 'rx' | 'ry' | 'rz';

export type BeamEndReleaseState = Record<
  'nodeI' | 'nodeJ',
  Record<ReleaseDOF, boolean>
>;

export const EMPTY_BEAM_END_RELEASES: BeamEndReleaseState = {
  nodeI: { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
  nodeJ: { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
};

export const RELEASE_DOF_META: { key: ReleaseDOF; etabs: string; desc: string }[] = [
  { key: 'ux', etabs: 'U1', desc: 'تحرير محوري' },
  { key: 'uy', etabs: 'U2', desc: 'تحرير قص محلي' },
  { key: 'uz', etabs: 'U3', desc: 'تحرير قص عمودي' },
  { key: 'rx', etabs: 'R1', desc: 'تحرير لَي' },
  { key: 'ry', etabs: 'R2', desc: 'تحرير عزم حول Y' },
  { key: 'rz', etabs: 'R3', desc: 'تحرير عزم حول Z' },
];

export const createEmptyBeamEndReleases = (): BeamEndReleaseState => ({
  nodeI: { ...EMPTY_BEAM_END_RELEASES.nodeI },
  nodeJ: { ...EMPTY_BEAM_END_RELEASES.nodeJ },
});

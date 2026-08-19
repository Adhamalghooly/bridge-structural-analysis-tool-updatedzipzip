/**
 * Barrel exports for all Zustand stores.
 * استخدم هذا الملف لاستيراد أي store بدلاً من الاستيراد المباشر.
 *
 * نمط الاستخدام:
 *   import { useModelStore, useAnalysisStore, useUIStore } from '@/stores';
 */

export { useModelStore } from './modelStore';
export type { ModelState, ModelActions, ModelStore } from './modelStore';

export { useAnalysisStore } from './analysisStore';
export type { AnalysisState, AnalysisActions, AnalysisStore } from './analysisStore';

export { useUIStore } from './uiStore';
export type { UIState, UIActions, UIStore, MainTab } from './uiStore';

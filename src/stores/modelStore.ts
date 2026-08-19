/**
 * Model Store — إدارة النموذج الإنشائي
 * =======================================
 * نطاق المسؤولية: البلاطات، الأعمدة، الجسور، الطوابق، المواد، الخصائص.
 * يُستخدم بدلاً من الأجزاء المقابلة في AppState.
 *
 * ملاحظة المرحلة 2: هذا الـ store يوازي AppState الحالي ولا يستبدله بعد.
 * الهدف: توفير طبقة مستقلة قابلة للاختبار تُعدّ مصدر الحقيقة للنموذج.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Slab,
  Column,
  Beam,
  MatProps,
  SlabProps,
  Story,
} from '@/lib/structuralEngine';

// ─── الحالة الافتراضية ────────────────────────────────────────────────────────

const DEFAULT_MAT: MatProps = {
  fc: 25,
  fy: 420,
  fyt: 280,
  gamma: 25,
  stirrupDia: 10,
};

const DEFAULT_SLAB_PROPS: SlabProps = {
  thickness: 200,
  finishLoad: 1.5,
  liveLoad: 2.0,
  cover: 40,
  phiMain: 12,
  phiSlab: 12,
};

const DEFAULT_STORY: Story = {
  id: 'ST1',
  label: 'الدور الأول',
  height: 4000,
  elevation: 0,
};

// ─── واجهة الـ Store ──────────────────────────────────────────────────────────

export interface ModelState {
  // ── النموذج الهندسي ──
  slabs: Slab[];
  columns: Column[];
  beams: Beam[];
  extraBeams: Beam[];
  extraColumns: Column[];

  // ── الطوابق ──
  stories: Story[];
  selectedStoryId: string;

  // ── المواد ──
  mat: MatProps;
  slabProps: SlabProps;
  ribbedSlabProps: {
    s?: number;
    tf?: number;
    hb?: number;
    bw?: number;
    fillerType?: 'block' | 'foam' | 'none';
  };

  // ── أبعاد العناصر الافتراضية ──
  beamB: number;
  beamH: number;
  colB: number;
  colH: number;
  colL: number;
  colLBelow: number;
  colTopEndCondition: 'F' | 'P';
  colBottomEndCondition: 'F' | 'P';

  // ── تعديلات يدوية ──
  beamOverrides: Record<string, {
    b?: number; h?: number; wallLoad?: number;
    x1?: number; y1?: number; x2?: number; y2?: number;
    z?: number; name?: string;
  }>;
  slabPropsOverrides: Record<number, {
    thickness?: number; finishLoad?: number;
    liveLoad?: number; cover?: number;
  }>;
  colOverrides: Record<string, {
    b?: number; h?: number; L?: number;
    x?: number; y?: number; orientAngle?: number;
    topEndCondition?: 'F' | 'P'; bottomEndCondition?: 'F' | 'P';
    releaseI?: any; releaseJ?: any;
  }>;
  removedColumnIds: string[];
  removedBeamIds: string[];

  // ── خصائص تحليلية ──
  ignoreSlab: boolean;
  beamStiffnessFactor: number;
  colStiffnessFactor: number;
  colRigidEndOffsets: Record<string, boolean>;
  supportRestraints: Record<string, {
    ux: boolean; uy: boolean; uz: boolean;
    rx: boolean; ry: boolean; rz: boolean;
  }>;

  // ── إصدار النموذج (للتحقق من التغييرات) ──
  modelVersion: number;
}

export interface ModelActions {
  setSlabs: (slabs: Slab[]) => void;
  addSlab: (slab: Slab) => void;
  removeSlab: (index: number) => void;
  updateSlabVertices: (index: number, vertices: { x: number; y: number }[]) => void;
  setSlabPropsOverride: (areaId: number, override: ModelState['slabPropsOverrides'][number]) => void;

  setColumns: (columns: Column[]) => void;
  setBeams: (beams: Beam[]) => void;
  setExtraBeams: (beams: Beam[]) => void;
  addExtraBeam: (beam: Beam) => void;
  removeExtraBeam: (id: string) => void;
  setExtraColumns: (columns: Column[]) => void;
  addExtraColumn: (column: Column) => void;
  removeExtraColumn: (id: string) => void;

  setMat: (mat: Partial<MatProps>) => void;
  setSlabProps: (props: Partial<SlabProps>) => void;
  setRibbedSlabProps: (props: ModelState['ribbedSlabProps']) => void;

  setBeamB: (v: number) => void;
  setBeamH: (v: number) => void;
  setColB: (v: number) => void;
  setColH: (v: number) => void;
  setColL: (v: number) => void;
  setColLBelow: (v: number) => void;
  setColTopEnd: (v: 'F' | 'P') => void;
  setColBottomEnd: (v: 'F' | 'P') => void;

  setBeamOverride: (beamId: string, override: ModelState['beamOverrides'][string]) => void;
  setColOverride: (colId: string, override: ModelState['colOverrides'][string]) => void;
  toggleColumnRemoval: (colId: string) => void;
  toggleBeamRemoval: (beamId: string) => void;

  addStory: () => void;
  removeStory: (storyId: string) => void;
  updateStory: (storyId: string, updates: Partial<Story>) => void;
  selectStory: (storyId: string) => void;
  setStories: (stories: Story[]) => void;

  setIgnoreSlab: (v: boolean) => void;
  setBeamStiffnessFactor: (v: number) => void;
  setColStiffnessFactor: (v: number) => void;
  setColRigidOffset: (colId: string, enabled: boolean) => void;
  setSupportRestraint: (
    posKey: string,
    restraints: ModelState['supportRestraints'][string]
  ) => void;

  incModelVersion: () => void;
  reset: () => void;
}

export type ModelStore = ModelState & ModelActions;

// ─── الحالة الابتدائية ────────────────────────────────────────────────────────

const initialModelState: ModelState = {
  slabs: [],
  columns: [],
  beams: [],
  extraBeams: [],
  extraColumns: [],

  stories: [DEFAULT_STORY],
  selectedStoryId: 'ST1',

  mat: DEFAULT_MAT,
  slabProps: DEFAULT_SLAB_PROPS,
  ribbedSlabProps: { s: 500, tf: 80, hb: 250, bw: 150, fillerType: 'block' },

  beamB: 300,
  beamH: 600,
  colB: 400,
  colH: 400,
  colL: 4000,
  colLBelow: 0,
  colTopEndCondition: 'F',
  colBottomEndCondition: 'F',

  beamOverrides: {},
  slabPropsOverrides: {},
  colOverrides: {},
  removedColumnIds: [],
  removedBeamIds: [],

  ignoreSlab: false,
  beamStiffnessFactor: 0.35,
  colStiffnessFactor: 0.70,
  colRigidEndOffsets: {},
  supportRestraints: {},

  modelVersion: 0,
};

// ─── الـ Store ─────────────────────────────────────────────────────────────────

export const useModelStore = create<ModelStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialModelState,

    setSlabs: (slabs) => set({ slabs, modelVersion: get().modelVersion + 1 }),
    addSlab: (slab) => set((s) => ({ slabs: [...s.slabs, slab], modelVersion: s.modelVersion + 1 })),
    removeSlab: (index) => set((s) => ({
      slabs: s.slabs.filter((_, i) => i !== index),
      modelVersion: s.modelVersion + 1,
    })),
    updateSlabVertices: (index, vertices) => set((s) => ({
      slabs: s.slabs.map((sl, i) => i === index ? { ...sl, vertices } : sl),
      modelVersion: s.modelVersion + 1,
    })),
    setSlabPropsOverride: (areaId, override) => set((s) => ({
      slabPropsOverrides: { ...s.slabPropsOverrides, [areaId]: override },
    })),

    setColumns: (columns) => set({ columns }),
    setBeams: (beams) => set({ beams }),
    setExtraBeams: (extraBeams) => set({ extraBeams }),
    addExtraBeam: (beam) => set((s) => ({ extraBeams: [...s.extraBeams, beam] })),
    removeExtraBeam: (id) => set((s) => ({ extraBeams: s.extraBeams.filter((b) => b.id !== id) })),
    setExtraColumns: (extraColumns) => set({ extraColumns }),
    addExtraColumn: (column) => set((s) => ({ extraColumns: [...s.extraColumns, column] })),
    removeExtraColumn: (id) => set((s) => ({
      extraColumns: s.extraColumns.filter((c) => c.id !== id),
    })),

    setMat: (mat) => set((s) => ({ mat: { ...s.mat, ...mat } })),
    setSlabProps: (props) => set((s) => ({ slabProps: { ...s.slabProps, ...props } })),
    setRibbedSlabProps: (ribbedSlabProps) => set({ ribbedSlabProps }),

    setBeamB: (beamB) => set({ beamB }),
    setBeamH: (beamH) => set({ beamH }),
    setColB: (colB) => set({ colB }),
    setColH: (colH) => set({ colH }),
    setColL: (colL) => set({ colL }),
    setColLBelow: (colLBelow) => set({ colLBelow }),
    setColTopEnd: (colTopEndCondition) => set({ colTopEndCondition }),
    setColBottomEnd: (colBottomEndCondition) => set({ colBottomEndCondition }),

    setBeamOverride: (beamId, override) => set((s) => ({
      beamOverrides: { ...s.beamOverrides, [beamId]: { ...s.beamOverrides[beamId], ...override } },
    })),
    setColOverride: (colId, override) => set((s) => ({
      colOverrides: { ...s.colOverrides, [colId]: { ...s.colOverrides[colId], ...override } },
    })),
    toggleColumnRemoval: (colId) => set((s) => ({
      removedColumnIds: s.removedColumnIds.includes(colId)
        ? s.removedColumnIds.filter((id) => id !== colId)
        : [...s.removedColumnIds, colId],
      modelVersion: s.modelVersion + 1,
    })),
    toggleBeamRemoval: (beamId) => set((s) => ({
      removedBeamIds: s.removedBeamIds.includes(beamId)
        ? s.removedBeamIds.filter((id) => id !== beamId)
        : [...s.removedBeamIds, beamId],
      modelVersion: s.modelVersion + 1,
    })),

    addStory: () => set((s) => {
      const maxNum = s.stories.reduce((m, st) => {
        const n = parseInt(st.id.replace('ST', ''));
        return isNaN(n) ? m : Math.max(m, n);
      }, 0);
      const newId = `ST${maxNum + 1}`;
      const lastStory = s.stories[s.stories.length - 1];
      const newStory: Story = {
        id: newId,
        label: `الدور ${maxNum + 1}`,
        height: lastStory?.height ?? 4000,
        elevation: (lastStory?.elevation ?? 0) + (lastStory?.height ?? 4000),
      };
      return { stories: [...s.stories, newStory] };
    }),
    removeStory: (storyId) => set((s) => ({
      stories: s.stories.filter((st) => st.id !== storyId),
    })),
    updateStory: (storyId, updates) => set((s) => ({
      stories: s.stories.map((st) => st.id === storyId ? { ...st, ...updates } : st),
    })),
    selectStory: (selectedStoryId) => set({ selectedStoryId }),
    setStories: (stories) => set({ stories }),

    setIgnoreSlab: (ignoreSlab) => set({ ignoreSlab }),
    setBeamStiffnessFactor: (beamStiffnessFactor) => set({ beamStiffnessFactor }),
    setColStiffnessFactor: (colStiffnessFactor) => set({ colStiffnessFactor }),
    setColRigidOffset: (colId, enabled) => set((s) => ({
      colRigidEndOffsets: { ...s.colRigidEndOffsets, [colId]: enabled },
    })),
    setSupportRestraint: (posKey, restraints) => set((s) => ({
      supportRestraints: { ...s.supportRestraints, [posKey]: restraints },
    })),

    incModelVersion: () => set((s) => ({ modelVersion: s.modelVersion + 1 })),
    reset: () => set(initialModelState),
  }))
);

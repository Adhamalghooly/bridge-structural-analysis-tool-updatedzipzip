/**
 * Analysis Store — إدارة حالة التحليل الإنشائي
 * ===============================================
 * نطاق المسؤولية: نتائج التحليل، المحرك المختار، التشخيصات.
 */

import { create } from 'zustand';
import type { FrameResult, BeamOnBeamConnection } from '@/lib/structuralEngine';
import type { EngineType } from '@/lib/analysisController';
import type { WorkerDiagnostics } from '@/core/workers/workerTypes';

// ─── الواجهة ──────────────────────────────────────────────────────────────────

export interface AnalysisState {
  analyzed: boolean;
  frameResults: FrameResult[];
  bobConnections: BeamOnBeamConnection[];
  selectedEngine: EngineType;
  supportRestraints: Record<string, {
    ux: boolean; uy: boolean; uz: boolean;
    rx: boolean; ry: boolean; rz: boolean;
  }>;
  frameEndReleases: Record<string, {
    nodeI: { ux: boolean; uy: boolean; uz: boolean; rx: boolean; ry: boolean; rz: boolean };
    nodeJ: { ux: boolean; uy: boolean; uz: boolean; rx: boolean; ry: boolean; rz: boolean };
  }>;
  transientFrameEndReleases: Record<string, {
    nodeI: { ux: boolean; uy: boolean; uz: boolean; rx: boolean; ry: boolean; rz: boolean };
    nodeJ: { ux: boolean; uy: boolean; uz: boolean; rx: boolean; ry: boolean; rz: boolean };
  }>;
  workerDiagnostics: WorkerDiagnostics | null;
  isAnalyzing: boolean;
  etabsImportMode: boolean;
  etabsAnalysisData: {
    beamId: string; story: string;
    Mleft: number; Mmid: number; Mright: number; Vu: number;
  }[];
  bobManualPrimary: Record<string, 'horizontal' | 'vertical'>;
}

export interface AnalysisActions {
  setAnalyzed: (v: boolean) => void;
  setFrameResults: (results: FrameResult[]) => void;
  setBobConnections: (connections: BeamOnBeamConnection[]) => void;
  setEngine: (engine: EngineType) => void;
  setSupportRestraint: (
    posKey: string,
    restraints: AnalysisState['supportRestraints'][string]
  ) => void;
  setFrameEndRelease: (
    posKey: string,
    nodeI: AnalysisState['frameEndReleases'][string]['nodeI'],
    nodeJ: AnalysisState['frameEndReleases'][string]['nodeJ'],
  ) => void;
  setTransientFrameEndRelease: (
    posKey: string,
    nodeI: AnalysisState['transientFrameEndReleases'][string]['nodeI'],
    nodeJ: AnalysisState['transientFrameEndReleases'][string]['nodeJ'],
  ) => void;
  clearTransientReleases: () => void;
  setWorkerDiagnostics: (d: WorkerDiagnostics | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setEtabsImportMode: (v: boolean) => void;
  setEtabsAnalysisData: (data: AnalysisState['etabsAnalysisData']) => void;
  setBobManualPrimary: (colId: string, direction: 'horizontal' | 'vertical' | null) => void;
  resetAnalysis: () => void;
}

export type AnalysisStore = AnalysisState & AnalysisActions;

// ─── الحالة الابتدائية ────────────────────────────────────────────────────────

const initialAnalysisState: AnalysisState = {
  analyzed: false,
  frameResults: [],
  bobConnections: [],
  selectedEngine: 'legacy_3d',
  supportRestraints: {},
  frameEndReleases: {},
  transientFrameEndReleases: {},
  workerDiagnostics: null,
  isAnalyzing: false,
  etabsImportMode: false,
  etabsAnalysisData: [],
  bobManualPrimary: {},
};

// ─── الـ Store ─────────────────────────────────────────────────────────────────

export const useAnalysisStore = create<AnalysisStore>()((set, get) => ({
  ...initialAnalysisState,

  setAnalyzed: (analyzed) => set({ analyzed }),
  setFrameResults: (frameResults) => set({ frameResults, analyzed: true }),
  setBobConnections: (bobConnections) => set({ bobConnections }),
  setEngine: (selectedEngine) => set({ selectedEngine }),

  setSupportRestraint: (posKey, restraints) => set((s) => ({
    supportRestraints: { ...s.supportRestraints, [posKey]: restraints },
  })),
  setFrameEndRelease: (posKey, nodeI, nodeJ) => set((s) => ({
    frameEndReleases: { ...s.frameEndReleases, [posKey]: { nodeI, nodeJ } },
  })),
  setTransientFrameEndRelease: (posKey, nodeI, nodeJ) => set((s) => ({
    transientFrameEndReleases: { ...s.transientFrameEndReleases, [posKey]: { nodeI, nodeJ } },
  })),
  clearTransientReleases: () => set({ transientFrameEndReleases: {} }),

  setWorkerDiagnostics: (workerDiagnostics) => set({ workerDiagnostics }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setEtabsImportMode: (etabsImportMode) => set({ etabsImportMode }),
  setEtabsAnalysisData: (etabsAnalysisData) => set({ etabsAnalysisData }),

  setBobManualPrimary: (colId, direction) => set((s) => {
    const next = { ...s.bobManualPrimary };
    if (direction === null) {
      delete next[colId];
    } else {
      next[colId] = direction;
    }
    return { bobManualPrimary: next };
  }),

  resetAnalysis: () => set({
    analyzed: false,
    frameResults: [],
    bobConnections: [],
    workerDiagnostics: null,
    isAnalyzing: false,
  }),
}));

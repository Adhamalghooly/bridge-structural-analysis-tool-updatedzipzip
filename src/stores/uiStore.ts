/**
 * UI Store — إدارة حالة الواجهة
 * =================================
 * نطاق المسؤولية: التبويبات، الأدوات، الحوارات، الحالات المؤقتة للواجهة.
 * لا يحتوي على أي منطق هندسي.
 */

import { create } from 'zustand';
import type { ToolType } from '@/components/ToolPalette';

export type MainTab = 'inputs' | 'analysis' | 'design' | 'reports' | 'drawings';

// ─── الواجهة ──────────────────────────────────────────────────────────────────

export interface UIState {
  activeTab: string;
  mainTab: MainTab;
  mode: 'auto' | 'manual';
  activeTool: ToolType;
  pendingNode: { x: number; y: number } | null;

  selectedNodeId: number | null;
  selectedFrameId: number | null;
  selectedAreaId: number | null;
  selectedElement: { type: 'beam' | 'column' | 'slab'; id: string } | null;

  modalOpen: boolean;
  elemPropsOpen: boolean;
  elemPropsFrameId: number | null;
  elemPropsAreaId: number | null;
  elemPropsNodeId: number | null;
  diagramOpen: boolean;
  diagramData: any;

  savedMessage: string;
  manualColumnsGenerated: boolean;
  manualBeamsGenerated: boolean;

  titleBlockConfig: {
    projectName: string;
    clientName: string;
    projectLocation: string;
    drawingTitle: string;
    firmName: string;
    designedBy: string;
    checkedBy: string;
    drawnBy: string;
    approvedBy: string;
    revision: string;
    date: string;
    scale: string;
    drawingNumber: string;
  };
}

export interface UIActions {
  setActiveTab: (tab: string) => void;
  setMainTab: (tab: MainTab) => void;
  setMode: (mode: 'auto' | 'manual') => void;
  setActiveTool: (tool: ToolType) => void;
  setPendingNode: (node: { x: number; y: number } | null) => void;

  selectNode: (id: number | null) => void;
  selectFrame: (id: number | null) => void;
  selectArea: (id: number | null) => void;
  selectElement: (el: UIState['selectedElement']) => void;

  openModal: (element: { type: 'beam' | 'column' | 'slab'; id: string }) => void;
  closeModal: () => void;
  openElemProps: (opts: { frameId?: number; areaId?: number; nodeId?: number }) => void;
  closeElemProps: () => void;
  openDiagram: (data: any) => void;
  closeDiagram: () => void;

  setSavedMessage: (msg: string) => void;
  clearSavedMessage: () => void;
  setManualColumnsGenerated: (v: boolean) => void;
  setManualBeamsGenerated: (v: boolean) => void;
  updateTitleBlock: (config: Partial<UIState['titleBlockConfig']>) => void;
}

export type UIStore = UIState & UIActions;

// ─── الحالة الابتدائية ────────────────────────────────────────────────────────

const defaultTitleBlock: UIState['titleBlockConfig'] = {
  projectName: 'مشروع إنشائي',
  clientName: '',
  projectLocation: '',
  drawingTitle: 'مخطط إنشائي',
  firmName: 'Structural Master',
  designedBy: '',
  checkedBy: '',
  drawnBy: '',
  approvedBy: '',
  revision: 'A',
  date: new Date().toLocaleDateString('ar-EG'),
  scale: '1:100',
  drawingNumber: 'S-001',
};

const initialUIState: UIState = {
  activeTab: 'model',
  mainTab: 'inputs',
  mode: 'auto',
  activeTool: 'select',
  pendingNode: null,

  selectedNodeId: null,
  selectedFrameId: null,
  selectedAreaId: null,
  selectedElement: null,

  modalOpen: false,
  elemPropsOpen: false,
  elemPropsFrameId: null,
  elemPropsAreaId: null,
  elemPropsNodeId: null,
  diagramOpen: false,
  diagramData: null,

  savedMessage: '',
  manualColumnsGenerated: false,
  manualBeamsGenerated: false,
  titleBlockConfig: defaultTitleBlock,
};

// ─── الـ Store ─────────────────────────────────────────────────────────────────

export const useUIStore = create<UIStore>()((set) => ({
  ...initialUIState,

  setActiveTab: (activeTab) => set({ activeTab }),
  setMainTab: (mainTab) => set({ mainTab }),
  setMode: (mode) => set({ mode }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setPendingNode: (pendingNode) => set({ pendingNode }),

  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  selectFrame: (selectedFrameId) => set({ selectedFrameId }),
  selectArea: (selectedAreaId) => set({ selectedAreaId }),
  selectElement: (selectedElement) => set({ selectedElement }),

  openModal: (element) => set({ modalOpen: true, selectedElement: element }),
  closeModal: () => set({ modalOpen: false, selectedElement: null }),
  openElemProps: ({ frameId, areaId, nodeId }) => set({
    elemPropsOpen: true,
    elemPropsFrameId: frameId ?? null,
    elemPropsAreaId: areaId ?? null,
    elemPropsNodeId: nodeId ?? null,
  }),
  closeElemProps: () => set({
    elemPropsOpen: false,
    elemPropsFrameId: null,
    elemPropsAreaId: null,
    elemPropsNodeId: null,
  }),
  openDiagram: (diagramData) => set({ diagramOpen: true, diagramData }),
  closeDiagram: () => set({ diagramOpen: false, diagramData: null }),

  setSavedMessage: (savedMessage) => set({ savedMessage }),
  clearSavedMessage: () => set({ savedMessage: '' }),
  setManualColumnsGenerated: (manualColumnsGenerated) => set({ manualColumnsGenerated }),
  setManualBeamsGenerated: (manualBeamsGenerated) => set({ manualBeamsGenerated }),
  updateTitleBlock: (config) => set((s) => ({
    titleBlockConfig: { ...s.titleBlockConfig, ...config },
  })),
}));

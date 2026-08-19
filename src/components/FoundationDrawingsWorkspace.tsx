/**
 * FoundationDrawingsWorkspace — Phase 5 unified foundation drawings workspace.
 *
 * Merges three previously independent panels into one coherent UI:
 *   1. المخططات التفصيلية  → FoundationDrawingsPanel   (visual footing drawings & details)
 *   2. التصدير والإدارة     → FoundationDrawingsExportPanel (DXF/PDF export + sheet manager)
 *
 * Design principle: thin wrapper only. Each child component retains its own state.
 * One function is moved at a time — never merge implementations in one go.
 *
 * DXF exports use the Phase 4 improvements:
 *   - AC1018 HEADER with $INSUNITS=4 (mm) and $MEASUREMENT=1 (metric)
 *   - LWPOLYLINE instead of legacy POLYLINE/VERTEX/SEQEND
 *   - ANSI31/ANSI32 HATCH entities for concrete and soil patterns
 */

import React, { useState } from 'react';
import { Layers, Download, PenTool } from 'lucide-react';
import type { Column } from '@/lib/structuralEngine';
import FoundationDrawingsPanel from './FoundationDrawingsPanel';
import FoundationDrawingsExportPanel from './FoundationDrawingsExportPanel';

export interface FoundationDrawingsWorkspaceProps {
  columns: Column[];
  colLoads3D?: Map<string, {
    P_service?: number;
    Pu?: number;
    Mx?: number;
    My?: number;
    MxBot?: number;
    MyBot?: number;
    Vu?: number;
  }>;
  fc?: number;
  fy?: number;
  qall?: number;
  gammaConc?: number;
  gammaSoil?: number;
  soilCoverDepth?: number;
  projectName?: string;
  titleBlockConfig?: any;
  analyzed?: boolean;
  foundationResults?: any[];
  foundationMat?: any;
  userFootings?: Record<string, { B: number; L: number; H: number }>;
  fdnAssignments?: Record<string, 'isolated' | 'strip' | 'combined' | 'strap'>;
  stripFootingsList?: any[];
  foundationDb?: any;
}

type WorkspaceTab = 'drawings' | 'export';

export default function FoundationDrawingsWorkspace({
  columns = [],
  colLoads3D,
  fc = 25,
  fy = 420,
  qall = 150,
  gammaConc = 24,
  gammaSoil = 18,
  soilCoverDepth = 1.2,
  projectName = 'Structural Design Studio',
  titleBlockConfig = {},
  analyzed = false,
  foundationResults = [],
  foundationMat = null,
  userFootings = {},
  fdnAssignments = {},
  stripFootingsList = [],
  foundationDb,
}: FoundationDrawingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('drawings');

  const tabDefs: { id: WorkspaceTab; labelAr: string; labelEn: string; icon: React.ReactNode }[] = [
    {
      id: 'drawings',
      labelAr: 'المخططات التفصيلية',
      labelEn: 'Detailed Drawings',
      icon: <PenTool className="h-3.5 w-3.5" />,
    },
    {
      id: 'export',
      labelAr: 'التصدير والإدارة',
      labelEn: 'Export & Sheet Management',
      icon: <Download className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 overflow-x-auto bg-muted/40 border border-border rounded-xl p-1 snap-x">
        {tabDefs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 min-h-[40px] snap-center border ${
              activeTab === tab.id
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-100'
                : 'bg-background hover:bg-muted text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.labelAr}</span>
            <span className="sm:hidden">{tab.labelAr.split(' ')[0]}</span>
          </button>
        ))}

        <div className="flex items-center gap-1.5 mr-auto px-2 py-1 text-xs text-muted-foreground select-none">
          <Layers className="h-3.5 w-3.5 text-violet-400" />
          <span className="hidden md:inline">
            {tabDefs.find((t) => t.id === activeTab)?.labelEn}
          </span>
        </div>
      </div>

      {/* ── Tab: Detailed Drawings (FoundationDrawingsPanel) ── */}
      {activeTab === 'drawings' && (
        <FoundationDrawingsPanel
          columns={columns}
          colLoads3D={colLoads3D}
          fc={fc}
          fy={fy}
          qall={qall}
          gammaConc={gammaConc}
          gammaSoil={gammaSoil}
          soilCoverDepth={soilCoverDepth}
          projectName={projectName}
          titleBlockConfig={titleBlockConfig}
          analyzed={analyzed}
          foundationResults={foundationResults}
          foundationMat={foundationMat}
        />
      )}

      {/* ── Tab: Export & Sheet Management (FoundationDrawingsExportPanel) ── */}
      {activeTab === 'export' && (
        <FoundationDrawingsExportPanel
          columns={columns}
          colLoads3D={colLoads3D}
          fc={fc}
          fy={fy}
          qall={qall}
          gammaConc={gammaConc}
          gammaSoil={gammaSoil}
          soilCoverDepth={soilCoverDepth}
          projectName={projectName}
          titleBlockConfig={titleBlockConfig}
          analyzed={analyzed}
          foundationResults={foundationResults}
          foundationMat={foundationMat}
          userFootings={userFootings}
          fdnAssignments={fdnAssignments}
          stripFootingsList={stripFootingsList}
          foundationDb={foundationDb}
        />
      )}
    </div>
  );
}

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calculator, Zap, Ruler } from 'lucide-react';
import type { AppAction, AppState } from '@/pages/indexReducer';
import { StorySelector } from '@/components/StorySelector';
import ETABSAnalysisImport from '@/components/ETABSAnalysisImport';
import type { ETABSColumnResult, ETABSReaction } from '@/components/ETABSAnalysisImport';
import FoundationDesignPanel from '@/components/FoundationDesignPanel';
import DesignComparisonPanel from '@/components/DesignComparisonPanel';
import SlabDesignPanel from '@/components/SlabDesignPanel';
import { ENGINE_LABELS, type EngineType } from '@/lib/analysisController';
import { calculateDeflection } from '@/lib/structuralEngine';
import type { BeamDiagnostic } from '@/lib/structuralEngine';

interface DesignTabPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  columns: any[];
  beams: any[];
  beamsWithLoads: any[];
  isAllStories: boolean;
  beamDesigns: any[];
  colDesigns: any[];
  slabDesigns: any[];
  splitBeamGroups: Record<string, string[]>;
  beamDiagnostics: Map<string, BeamDiagnostic>;
  colLoads3D: any;
  getBeamDisplayName: (beamId: string, mergedCarrierIds?: string[] | null) => string;
  getBentUpData: (beamId: string) => any;
  handleSelectElement: (type: 'beam' | 'column' | 'slab', id: string) => void;
  designSource: 'app' | 'etabs';
  setDesignSource: React.Dispatch<React.SetStateAction<'app' | 'etabs'>>;
  designExecuted: boolean;
  setDesignExecuted: React.Dispatch<React.SetStateAction<boolean>>;
  etabsColumnResults: ETABSColumnResult[];
  setEtabsColumnResults: React.Dispatch<React.SetStateAction<ETABSColumnResult[]>>;
  etabsReactions: ETABSReaction[];
  setEtabsReactions: React.Dispatch<React.SetStateAction<ETABSReaction[]>>;
  frameResults: any[];
  connectionManagerOpen: boolean;
  setConnectionManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  bentUpResults: any;
}

const DesignTabPanel: React.FC<DesignTabPanelProps> = ({
  state, dispatch,
  columns, beams, beamsWithLoads, isAllStories,
  beamDesigns, colDesigns, slabDesigns, splitBeamGroups, beamDiagnostics, colLoads3D,
  getBeamDisplayName, getBentUpData, handleSelectElement,
  designSource, setDesignSource, designExecuted, setDesignExecuted,
  etabsColumnResults, setEtabsColumnResults, etabsReactions, setEtabsReactions,
  frameResults, connectionManagerOpen, setConnectionManagerOpen, bentUpResults,
}) => {
  const {
    stories, selectedStoryId, slabs, mat, slabProps,
    analyzed, selectedEngine, etabsAnalysisData, bobConnections,
    titleBlockConfig, ribbedSlabProps, supportDb, foundationDb,
    fdnAssignments, stripFootingsList, manualJointOverrides,
  } = state;

  const [designSubTab, setDesignSubTab] = React.useState<'beams_cols' | 'foundations' | 'comparison' | 'slabs'>('beams_cols');

  return (
                <div className="space-y-4">
              {/* ── Source Selector Card ── */}
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-500/5">
                <CardContent className="py-3 px-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Zap size={14} className="text-blue-500 shrink-0" />
                    <span className="text-xs font-bold">مصدر نتائج التحليل للتصميم</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={`px-3 py-2 rounded border text-xs font-medium transition-all ${designSource === 'app' ? 'bg-blue-600 text-white border-blue-600' : 'border-border hover:bg-muted'}`}
                      onClick={() => { setDesignSource('app'); setDesignExecuted(false); }}
                    >
                      محركات التطبيق الداخلية
                    </button>
                    <button
                      className={`px-3 py-2 rounded border text-xs font-medium transition-all ${designSource === 'etabs' ? 'bg-orange-600 text-white border-orange-600' : 'border-border hover:bg-muted'}`}
                      onClick={() => { setDesignSource('etabs'); setDesignExecuted(false); }}
                    >
                      نتائج ETABS (xlsx)
                    </button>
                  </div>

                  {/* App engine selector */}
                  {designSource === 'app' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">محرك التحليل:</span>
                      <select
                        className="h-8 rounded border border-input bg-background px-2 text-xs flex-1 min-w-[160px] max-w-[260px]"
                        value={selectedEngine}
                        onChange={e => { dispatch({ type: 'SET_ENGINE', engine: e.target.value as any }); setDesignExecuted(false); }}
                      >
                        {(Object.entries(ENGINE_LABELS) as [string, string][]).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      {!analyzed && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">يلزم تشغيل التحليل أولاً</Badge>}
                    </div>
                  )}

                  {/* ETABS import */}
                  {designSource === 'etabs' && (
                    <ETABSAnalysisImport
                      appliedBeamCount={etabsAnalysisData.length}
                      appliedColCount={etabsColumnResults.length}
                      appliedReactionCount={etabsReactions.length}
                      initialBeams={etabsAnalysisData as any}
                      initialCols={etabsColumnResults as any}
                      initialReactions={etabsReactions}
                      onApplyBeams={(results) => {
                        dispatch({ type: 'SET_ETABS_ANALYSIS_DATA', data: results });
                        setDesignExecuted(false);
                      }}
                      onApplyColumns={(cols) => setEtabsColumnResults(cols)}
                      onApplyReactions={(reacts) => setEtabsReactions(reacts)}
                    />
                  )}

                  {/* Design button */}
                  <Button
                    className="w-full min-h-[48px] gap-2 text-sm font-bold"
                    disabled={
                      (designSource === 'app' && !analyzed) ||
                      (designSource === 'etabs' && etabsAnalysisData.length === 0)
                    }
                    onClick={() => setDesignExecuted(true)}
                  >
                    <Calculator size={16} />
                    تشغيل التصميم
                    {designExecuted && beamDesigns.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{beamDesigns.length} جسر</Badge>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* ── Design Sub-Tabs ── */}
              <div className="flex gap-1 rounded-lg bg-muted p-1">
                <button
                  className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${
                    designSubTab === 'beams_cols'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDesignSubTab('beams_cols')}
                >
                  تصميم الجسور والأعمدة
                </button>
                <button
                  className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${
                    designSubTab === 'slabs'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDesignSubTab('slabs')}
                >
                  تصميم البلاطات الهوردي
                </button>
                <button
                  className={`flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all ${
                    designSubTab === 'comparison'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDesignSubTab('comparison')}
                >
                  مقارنة النتائج
                </button>
              </div>

              {/* ── Comparison Sub-Tab ── */}
              {designSubTab === 'comparison' && (
                <DesignComparisonPanel
                  beams={beamsWithLoads}
                  slabs={slabs}
                  slabProps={slabProps}
                  mat={mat}
                  stories={stories}
                  frameResults={frameResults}
                  etabsAnalysisData={etabsAnalysisData}
                  analyzed={analyzed}
                  columns={columns}
                  colDesigns={colDesigns}
                  etabsColumnResults={etabsColumnResults}
                  splitBeamGroups={splitBeamGroups}
                />
              )}

              {/* ── Slab Design Sub-Tab ── */}
              {designSubTab === 'slabs' && (
                <SlabDesignPanel
                  slabs={slabs}
                  slabProps={slabProps}
                  mat={mat}
                  ribbedSlabProps={state.ribbedSlabProps}
                  columns={columns}
                  beams={beamsWithLoads}
                />
              )}

              {/* ── Foundation Design Sub-Tab ── */}
              {designSubTab === 'foundations' && (
                <FoundationDesignPanel
                  columns={columns}
                  beams={beamsWithLoads}
                  supportDb={state.supportDb}
                  colDesigns={colDesigns}
                  colLoads3D={colLoads3D}
                  etabsReactions={etabsReactions.length > 0 ? etabsReactions : undefined}
                  titleBlockConfig={titleBlockConfig}
                  mat={mat}
                  onResultsChange={(res, mat) => {
                    dispatch({ type: 'SET_FOUNDATION_RESULTS', results: res });
                    dispatch({ type: 'SET_FOUNDATION_MAT', mat: mat });
                  }}
                  foundationDb={state.foundationDb}
                  onFoundationDbChange={(db) => dispatch({ type: 'SET_FOUNDATION_DB', db })}
                  fdnAssignments={state.fdnAssignments}
                  onFdnAssignmentsChange={(asg) => dispatch({ type: 'SET_FDN_ASSIGNMENTS', assignments: asg })}
                  stripFootingsList={state.stripFootingsList}
                  onStripFootingsChange={(list) => dispatch({ type: 'SET_STRIP_FOOTINGS_LIST', list: list })}
                  userFootings={state.userFootings}
                  onUserFootingsChange={(f) => dispatch({ type: 'SET_USER_FOOTINGS', footings: f })}
                />
              )}

              {/* ── Beams & Columns Design Sub-Tab ── */}
              {designSubTab === 'beams_cols' && (
              <>
              {/* ── Results (only after designExecuted) ── */}
              {!designExecuted ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    {designSource === 'etabs' && etabsAnalysisData.length === 0
                      ? 'استورد ملف نتائج ETABS ثم اضغط "تشغيل التصميم"'
                      : designSource === 'app' && !analyzed
                      ? 'شغّل التحليل من تبويب التحليل ثم اضغط "تشغيل التصميم"'
                      : 'اضغط "تشغيل التصميم" لعرض نتائج التصميم'
                    }
                  </CardContent>
                </Card>
              ) : (
              <div className="space-y-4">
                {/* Story filter for design */}
                <StorySelector
                  stories={stories} selectedStoryId={selectedStoryId}
                  onSelectStory={id => dispatch({ type: 'SELECT_STORY', storyId: id })}
                  onAddStory={() => dispatch({ type: 'ADD_STORY' })}
                  onRemoveStory={id => dispatch({ type: 'REMOVE_STORY', storyId: id })}
                  onUpdateStory={(id, updates) => dispatch({ type: 'UPDATE_STORY', storyId: id, updates })}
                  onCopyElements={(from, to) => dispatch({ type: 'COPY_STORY_ELEMENTS', fromStoryId: from, toStoryId: to })}
                  compact
                />
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">تصميم الجسور - الانحناء والتشوه والتشخيص</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['الدور','الجسر','علوي يسار','سفلي أقصى','علوي يمين','δ (mm)','L/δ','L كلي (م)','الحالة','التشخيص'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {stories.map(story => 
                          (isAllStories || story.id === selectedStoryId) &&
                          beamDesigns.filter(d => {
                            let beam = beamsWithLoads.find(b => b.id === d.beamId);
                            if (!beam && (d as any).mergedCarrierIds) {
                              beam = beamsWithLoads.find(b => (d as any).mergedCarrierIds.includes(b.id));
                            }
                            return beam?.storyId === story.id;
                          }).map(d => {
                          const bent = getBentUpData(d.beamId);
                          const topLeftBars = bent ? Math.max(bent.additionalTopLeft, 2) : d.flexLeft.bars;
                          const topRightBars = bent ? Math.max(bent.additionalTopRight, 2) : d.flexRight.bars;
                          const diag = beamDiagnostics.get(d.beamId);
                          return (
                          <React.Fragment key={`${story.id}-${d.beamId}`}>
                          <TableRow className="cursor-pointer" onClick={() => handleSelectElement('beam', d.beamId)}>
                            <TableCell className="text-xs font-medium text-muted-foreground">{story.label}</TableCell>
                            <TableCell className="font-mono text-xs font-bold">{getBeamDisplayName(d.beamId, (d as any).mergedCarrierIds)}</TableCell>
                            <TableCell className="font-mono text-xs">{topLeftBars}Φ{d.flexLeft.dia}</TableCell>
                            <TableCell className="font-mono text-xs">{d.flexMid.bars}Φ{d.flexMid.dia}</TableCell>
                            <TableCell className="font-mono text-xs">{topRightBars}Φ{d.flexRight.dia}</TableCell>
                            <TableCell className="font-mono text-xs">{d.deflection.deflection.toFixed(1)}</TableCell>
                            <TableCell className="font-mono text-xs">{d.deflection.deflectionRatio.toFixed(0)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {(() => {
                                // For beams with mergedCarrierIds, d.span is already the total span (all segments merged)
                                const mergedIds2 = (d as any).mergedCarrierIds as string[] | undefined;
                                if (mergedIds2 && mergedIds2.length >= 2) {
                                  return <span className="text-accent font-bold">{d.span.toFixed(2)}</span>;
                                }
                                // Legacy BOB connection logic for 2-segment beams
                                const carrierConn2 = bobConnections.find(c => c.primaryBeamId === d.beamId);
                                const contConn2 = bobConnections.find(c => c.continuationBeamId === d.beamId);
                                if (carrierConn2 && carrierConn2.continuationBeamId) {
                                  const contB = beamsWithLoads.find(b => b.id === carrierConn2.continuationBeamId);
                                  if (contB) return <span className="text-accent font-bold">{(d.span + contB.length / 1000).toFixed(2)}</span>;
                                }
                                if (contConn2) {
                                  const primB = beamsWithLoads.find(b => b.id === contConn2.primaryBeamId);
                                  if (primB) return <span className="text-accent font-bold">{(primB.length / 1000 + d.span).toFixed(2)}</span>;
                                }
                                return <span className="text-muted-foreground">—</span>;
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={diag?.isAdequate ? "default" : "destructive"} className="text-[10px]">
                                {diag?.isAdequate ? 'آمن ✓' : 'تجاوز ✗'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px]">
                              {diag && !diag.isAdequate && (
                                <span className="text-destructive font-medium">{diag.overallStatus}</span>
                              )}
                            </TableCell>
                          </TableRow>
                          {diag && !diag.isAdequate && diag.failures.map((f, idx) => {
                            // Calculate deflection suggestion for deflection failures
                            let deflSuggestion: { hRequired: number; note: string } | null = null;
                            if (f.type === 'deflection') {
                              const beamForDefl = beamsWithLoads.find(b => b.id === d.beamId)
                                ?? ((d as any).mergedCarrierIds as string[] | undefined)?.map((id: string) => beamsWithLoads.find(b => b.id === id)).find(Boolean);
                              if (beamForDefl) {
                                // Binary-search / step-search for minimum h that satisfies deflection
                                const bw = beamForDefl.b;
                                const wD = beamForDefl.deadLoad;
                                const wL = beamForDefl.liveLoad;
                                const span = d.span;
                                
                                // Run a fresh, precise step-search for minimum h that satisfies deflection based on allowable values
                                let hReq = beamForDefl.h;
                                const allowableDefl = d.deflection.allowableDeflection;
                                const testAs = d.flexMid?.As || 0;
                                
                                for (let hTry = Math.ceil((beamForDefl.h + 50) / 50) * 50; hTry <= 2500; hTry += 50) {
                                  const testDefl = calculateDeflection(span, bw, hTry, mat.fc, wD, wL, testAs, 'both-ends', 'B', testAs * 0.3, 1.0, 60);
                                  if (testDefl.deflection <= allowableDefl || testDefl.isServiceable) {
                                    hReq = hTry;
                                    break;
                                  }
                                }
                                if (hReq > beamForDefl.h) {
                                  // Also check if adding more steel helps (increase As by 50%)
                                  const moreAs = d.flexMid.As * 1.5;
                                  const testWithMoreSteel = calculateDeflection(span, bw, beamForDefl.h, mat.fc, wD, wL, moreAs, 'both-ends', 'B', moreAs * 0.35, 1.0, 60);
                                  const steelHelps = testWithMoreSteel.isServiceable;
                                  deflSuggestion = {
                                    hRequired: hReq,
                                    note: steelHelps
                                      ? `أو زيادة التسليح السفلي (As) بنسبة ≥50% — زيادة As تصغّر Ie وتقلل الترخيم`
                                      : `زيادة التسليح وحدها غير كافية — يجب تعديل الأبعاد`,
                                  };
                                }
                              }
                            }
                            return (
                            <TableRow key={`${d.beamId}-fail-${idx}`} className="bg-destructive/5 border-0">
                              <TableCell colSpan={10} className="py-1 px-4">
                                <div className="flex flex-col gap-0.5 text-[11px]">
                                  <div className="flex items-start gap-2">
                                    <Badge variant="outline" className="text-[9px] shrink-0 border-destructive text-destructive">
                                      {f.aciRef}
                                    </Badge>
                                    <span className="text-destructive">{f.description} (تجاوز {f.exceedPercent.toFixed(0)}%)</span>
                                  </div>
                                  <div className="text-muted-foreground mr-2">
                                    💡 <strong>الحل:</strong> {f.solution}
                                  </div>
                                  {deflSuggestion && (
                                    <div className="mr-2 mt-0.5 flex flex-col gap-0.5">
                                      <span className="text-blue-700 dark:text-blue-400 font-semibold">
                                        📐 الارتفاع المقترح لتحقيق الترخيم: <strong>h = {deflSuggestion.hRequired} mm</strong>
                                        {' '}(الحالي: {(beamsWithLoads.find(b => b.id === d.beamId) ?? ((d as any).mergedCarrierIds as string[] | undefined)?.map((id: string) => beamsWithLoads.find(b => b.id === id)).find(Boolean))?.h ?? '—'} mm)
                                      </span>
                                      <span className="text-muted-foreground text-[10px]">
                                        ℹ️ {deflSuggestion.note}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                          </React.Fragment>
                          );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* ── As (mm²) Table ── */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">مساحة حديد التسليح المطلوبة As (mm²) - الجسور</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['الدور','الجسر','b×h','As يسار (mm²)','As وسط (mm²)','As يمين (mm²)','As_min (mm²)','ρ% يسار','ρ% وسط','ρ% يمين'].map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {stories.map(story =>
                          (isAllStories || story.id === selectedStoryId) &&
                          beamDesigns.filter(d => {
                            let beam = beamsWithLoads.find(b => b.id === d.beamId);
                            if (!beam && (d as any).mergedCarrierIds) {
                              beam = beamsWithLoads.find(b => (d as any).mergedCarrierIds.includes(b.id));
                            }
                            return beam?.storyId === story.id;
                          }).map(d => {
                            let beam = beamsWithLoads.find(b => b.id === d.beamId);
                            if (!beam && (d as any).mergedCarrierIds) {
                              beam = beamsWithLoads.find(b => (d as any).mergedCarrierIds.includes(b.id));
                            }
                            const bw = beam?.b ?? 250;
                            const hh = beam?.h ?? 500;
                            const dEff = hh - 40 - 12;  // approx effective depth
                            const As_min = Math.max(0.25 * Math.sqrt(mat.fc) / mat.fy * bw * dEff, 1.4 / mat.fy * bw * dEff);
                            const AsL = d.flexLeft.As ?? (d.flexLeft.bars * Math.PI * d.flexLeft.dia ** 2 / 4);
                            const AsMid = d.flexMid.As ?? (d.flexMid.bars * Math.PI * d.flexMid.dia ** 2 / 4);
                            const AsR = d.flexRight.As ?? (d.flexRight.bars * Math.PI * d.flexRight.dia ** 2 / 4);
                            const rhoL = (AsL / (bw * dEff) * 100);
                            const rhoMid = (AsMid / (bw * dEff) * 100);
                            const rhoR = (AsR / (bw * dEff) * 100);
                            return (
                              <TableRow key={`as-${story.id}-${d.beamId}`} className="cursor-pointer" onClick={() => handleSelectElement('beam', d.beamId)}>
                                <TableCell className="text-xs text-muted-foreground">{story.label}</TableCell>
                                <TableCell className="font-mono text-xs font-bold">{getBeamDisplayName(d.beamId, (d as any).mergedCarrierIds)}</TableCell>
                                <TableCell className="font-mono text-xs">{bw}×{hh}</TableCell>
                                <TableCell className="font-mono text-xs font-bold text-blue-700">{AsL.toFixed(0)}</TableCell>
                                <TableCell className="font-mono text-xs font-bold text-green-700">{AsMid.toFixed(0)}</TableCell>
                                <TableCell className="font-mono text-xs font-bold text-blue-700">{AsR.toFixed(0)}</TableCell>
                                <TableCell className="font-mono text-xs text-amber-600">{As_min.toFixed(0)}</TableCell>
                                <TableCell className={`font-mono text-xs ${rhoL > 2.5 ? 'text-destructive font-bold' : ''}`}>{rhoL.toFixed(2)}%</TableCell>
                                <TableCell className={`font-mono text-xs ${rhoMid > 2.5 ? 'text-destructive font-bold' : ''}`}>{rhoMid.toFixed(2)}%</TableCell>
                                <TableCell className={`font-mono text-xs ${rhoR > 2.5 ? 'text-destructive font-bold' : ''}`}>{rhoR.toFixed(2)}%</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">تصميم القص</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['الدور','الجسر','Vu','Vc','Vs','الكانات'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {stories.map(story =>
                          (isAllStories || story.id === selectedStoryId) &&
                          beamDesigns.filter(d => {
                            let beam = beamsWithLoads.find(b => b.id === d.beamId);
                            if (!beam && (d as any).mergedCarrierIds) {
                              beam = beamsWithLoads.find(b => (d as any).mergedCarrierIds.includes(b.id));
                            }
                            return beam?.storyId === story.id;
                          }).map(d => (
                            <TableRow key={`${story.id}-${d.beamId}`}>
                              <TableCell className="text-xs font-medium text-muted-foreground">{story.label}</TableCell>
                              <TableCell className="font-mono text-xs font-bold">{getBeamDisplayName(d.beamId, (d as any).mergedCarrierIds)}</TableCell>
                              <TableCell className="font-mono text-xs">{d.Vu.toFixed(1)}</TableCell>
                              <TableCell className="font-mono text-xs">{d.shear.Vc.toFixed(1)}</TableCell>
                              <TableCell className="font-mono text-xs">{d.shear.Vs.toFixed(1)}</TableCell>
                              <TableCell className="font-mono text-xs">{d.shear.stirrups}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">تصميم الأعمدة (Bresler - ثنائي المحور)</CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2 gap-1 shrink-0"
                        onClick={() => setConnectionManagerOpen(true)}
                        title="ربط الجسور بالأعمدة يدوياً عندما لا تتطابق الإحداثيات"
                      >
                        🔗 اتصالات يدوية
                        {manualJointOverrides.length > 0 && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1 mr-0.5 bg-blue-100 text-blue-700">
                            {manualJointOverrides.length}
                          </Badge>
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground">Mx / My</span> = عزوم التحليل من النموذج ثلاثي الأبعاد (kN·m) ·
                      <span className="font-semibold text-foreground"> Mx* / My*</span> = عزوم التصميم المضخّمة (kN·m، تشمل δns للأعمدة النحيفة وفق ACI 318-19 §6.6.4.5)
                    </p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        {['الدور','العمود','Pu (kN)','Mx (kN·m)','My (kN·m)','Mx* (kN·m)','My* (kN·m)','Bresler','النحافة','الحالة','التسليح'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      </TableRow></TableHeader>
                      <TableBody>
                        {stories.map((story) =>
                          (isAllStories || story.id === selectedStoryId) &&
                          colDesigns.filter(c => c.storyId === story.id).map(c => {
                            return (
                          <TableRow key={`${story.id}-${c.id}`} className="cursor-pointer" onClick={() => handleSelectElement('column', c.id)}>
                            <TableCell className="text-xs font-medium text-muted-foreground">{story.label}</TableCell>
                            <TableCell className="font-mono text-xs">{c.id}</TableCell>
                            <TableCell className="font-mono text-xs font-bold">{c.Pu.toFixed(1)}</TableCell>
                            <TableCell className="font-mono text-xs text-blue-600 dark:text-blue-400">{c.Mx.toFixed(1)}</TableCell>
                            <TableCell className="font-mono text-xs text-blue-600 dark:text-blue-400">{c.My.toFixed(1)}</TableCell>
                            <TableCell className="font-mono text-xs font-semibold">{c.design.MxMagnified.toFixed(1)}</TableCell>
                            <TableCell className="font-mono text-xs font-semibold">{c.design.MyMagnified.toFixed(1)}</TableCell>
                            <TableCell className="font-mono text-xs">{c.design.breslerRatio.toFixed(2)}</TableCell>
                            <TableCell className="text-xs">
                              {c.design.checkSlenderness}
                              {c.design.isSlenderX && (
                                <span className="block text-destructive text-[10px] mt-0.5">
                                  X: نحيف (kLu/r={c.design.kLu_rx.toFixed(1)}) → B المطلوب ≥ {c.design.requiredBForNonSlender}mm {c.b >= c.design.requiredBForNonSlender ? '✓' : `(الحالي ${c.b}mm)`}
                                </span>
                              )}
                              {c.design.isSlenderY && (
                                <span className="block text-destructive text-[10px] mt-0.5">
                                  Y: نحيف (kLu/r={c.design.kLu_ry.toFixed(1)}) → H المطلوب ≥ {c.design.requiredHForNonSlender}mm {c.h >= c.design.requiredHForNonSlender ? '✓' : `(الحالي ${c.h}mm)`}
                                </span>
                              )}
                              {c.design.suggestRotation && (
                                <span className="block text-accent text-[10px] mt-0.5 font-semibold">
                                  💡 {c.design.rotationReason}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={c.design.biaxialAdequate ? "default" : "destructive"} className="text-[10px]">
                                {c.design.biaxialAdequate ? 'آمن' : 'غير آمن'}
                              </Badge>
                              {!c.design.biaxialAdequate && c.design.requiredBForSafety && (
                                <div className="text-[9px] text-destructive mt-0.5 font-bold leading-tight">
                                  ⇒ {c.design.requiredBForSafety}×{c.design.requiredHForSafety}mm
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{c.design.bars}Φ{c.design.dia}</TableCell>
                          </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Bent-Up Bars Table */}
                {bentUpResults.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">تكسيح الحديد (Bent-up Bars) - ACI 318-19</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    {bentUpResults.map(fr => (
                      <div key={fr.frameId} className="mb-4">
                        <p className="text-xs font-semibold mb-1 text-primary">{fr.frameId}</p>
                        <Table>
                          <TableHeader><TableRow>
                            {['الجسر','سفلي أصلي','مكسح','سفلي متبقي','علوي مطلوب L','علوي مطلوب R','مساهمة تكسيح L','مساهمة تكسيح R','علوي إضافي','علوي نهائي'].map(h => <TableHead key={h} className="text-[10px]">{h}</TableHead>)}
                          </TableRow></TableHeader>
                          <TableBody>
                            {fr.beams.map(b => (
                              <TableRow key={b.beamId}>
                                <TableCell className="font-mono text-xs font-bold">{getBeamDisplayName(b.beamId)}</TableCell>
                                <TableCell className="font-mono text-xs">{b.originalBottomBars}Φ{b.bottomDia}</TableCell>
                                <TableCell className="font-mono text-xs">{b.bentUp.bentBarsCount}Φ{b.bentUp.bentDia}</TableCell>
                                <TableCell className="font-mono text-xs">{b.bentUp.remainingBottomBars}Φ{b.bottomDia}</TableCell>
                                <TableCell className="font-mono text-xs">{b.requiredTopLeft}</TableCell>
                                <TableCell className="font-mono text-xs">{b.requiredTopRight}</TableCell>
                                <TableCell className="font-mono text-xs">{b.bentContributionLeft}</TableCell>
                                <TableCell className="font-mono text-xs">{b.bentContributionRight}</TableCell>
                                <TableCell className="font-mono text-xs">{Math.max(b.additionalTopLeft, b.additionalTopRight)}</TableCell>
                                <TableCell className="font-mono text-xs font-bold">{b.finalTopBars}Φ{b.topDia}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                )}

                {/* Slab Punching Shear */}
                {slabDesigns.some(s => s.design.punchingShear) && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">فحص الثقب (Punching Shear)</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          {['البلاطة','Vu','Vc','معامل الأمان','الحالة'].map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                        </TableRow></TableHeader>
                        <TableBody>
                          {slabDesigns.filter(s => s.design.punchingShear).map(s => (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono text-xs">{s.id}</TableCell>
                              <TableCell className="font-mono text-xs">{s.design.punchingShear!.Vu.toFixed(1)}</TableCell>
                              <TableCell className="font-mono text-xs">{s.design.punchingShear!.Vc.toFixed(1)}</TableCell>
                              <TableCell className="font-mono text-xs">{s.design.punchingShear!.punchingSafetyFactor.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge variant={s.design.punchingShear!.adequate ? "default" : "destructive"} className="text-[10px]">
                                  {s.design.punchingShear!.adequate ? 'آمن' : 'غير آمن'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
              )}
              </>
              )}
            </div>
  );
};

export default DesignTabPanel;

import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Layers, Settings2, Zap, Bot, Upload, Plus, Trash2, Shapes, Merge, Search, Copy, CheckSquare, Wand2, Crosshair } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { AppAction } from '@/pages/indexReducer';
import type { AppState } from '@/pages/indexReducer';
import { StorySelector } from '@/components/StorySelector';
import AutoDesignPanel from '@/components/AutoDesignPanel';
import SupportManagerPanel from '@/components/SupportManagerPanel';
import ManualConnectionManager from '@/components/ManualConnectionManager';
import AIAssistantPanel from '@/ai/structuralAssistant/AIAssistantPanel';
import GenerativeDesignDashboard from '@/generative/GenerativeDesignDashboard';
import ETABSFullImportPanel from '@/components/ETABSFullImportPanel';
import type { ETABSImportedData } from '@/components/ETABSFullImportPanel';
import ETABSEdbImportPanel from '@/components/ETABSEdbImportPanel';
import type { EdbImportedData } from '@/components/ETABSEdbImportPanel';
import type { ETABSReaction, ETABSColumnResult } from '@/components/ETABSAnalysisImport';
import type { Column, Slab, Story, Beam } from '@/lib/structuralEngine';
import type { AutoDesignResult } from '@/lib/autoDesigner';
import type { EvaluatedOption } from '@/generative/types';
import { generateColumns, generateBeams } from '@/lib/structuralEngine';
import { findCollinearGroups, mergeCollinearBeams, detectBeamIntersections } from '@/lib/beamUtils';

/** مربع إدخال رقمي يقبل الأرقام السالبة والعشرية أثناء الكتابة — يُرسِل القيمة فقط عند مغادرة الحقل */
function NumericInput({ value, onCommit, className, step, placeholder }: {
  value: number;
  onCommit: (val: number) => void;
  className?: string;
  step?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = React.useState(String(value));
  const isFocused = React.useRef(false);
  React.useEffect(() => {
    if (!isFocused.current) setLocal(String(value));
  }, [value]);
  return (
    <Input
      type="number"
      step={step ?? 'any'}
      value={local}
      className={className}
      placeholder={placeholder}
      onFocus={() => { isFocused.current = true; }}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        isFocused.current = false;
        const parsed = parseFloat(local);
        if (!isNaN(parsed)) { onCommit(parsed); setLocal(String(parsed)); }
        else setLocal(String(value));
      }}
    />
  );
}

interface SlabsInputPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  columns: any[];
  beams: any[];
  isAllStories: boolean;
  storyFilteredSlabs: Slab[];
  getStoryLabel: (storyId?: string) => string;
  slabDesigns: any[];
  slabMergeGroups: any[];
  availableElevations: number[];
  selectedBeamIds: Set<string>;
  setSelectedBeamIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEtabsReactions: React.Dispatch<React.SetStateAction<any[]>>;
  etabsReactions: any[];
  handleColumnSupportChange: (...args: any[]) => void;
  handleSupportRestraintsChange: (posKeys: string[], restraints: any) => void;
  connectionManagerOpen: boolean;
  setConnectionManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  computeSlabUnionPolygon: (slabs: Slab[]) => { x: number; y: number }[] | null;
  selectAllBeams: () => void;
  clearBeamSelection: () => void;
  handleMergeBeams: () => void;
  handleIntersect: () => void;
  toggleBeamSelection: (id: string) => void;
  getBeamNodeId: (x: number, y: number, z: number) => string;
  openBeamReleaseEditor: (beam: any) => void;
  getBeamReleaseState: (beam: any) => any;
  runAnalysis: () => void;
}

const SlabsInputPanel: React.FC<SlabsInputPanelProps> = ({
  state, dispatch,
  columns, beams, isAllStories, storyFilteredSlabs, getStoryLabel,
  slabDesigns, slabMergeGroups, availableElevations,
  selectedBeamIds, setSelectedBeamIds,
  setEtabsReactions, etabsReactions,
  handleColumnSupportChange, handleSupportRestraintsChange,
  connectionManagerOpen, setConnectionManagerOpen,
  computeSlabUnionPolygon, selectAllBeams, clearBeamSelection,
  handleMergeBeams, handleIntersect, toggleBeamSelection,
  getBeamNodeId, openBeamReleaseEditor, getBeamReleaseState, runAnalysis,
}) => {
  const { stories, selectedStoryId, slabs, mat, slabProps, beamB, beamH, colB, colH,
    extraBeams, extraColumns, etabsImportMode, bobConnections, etabsAnalysisData,
    frameEndReleases, beamOverrides, colOverrides, removedBeamIds, removedColumnIds,
    ribbedSlabProps, colL,
  } = state;

  const [beamSearch, setBeamSearch] = React.useState('');
  const [copyBeamDestinationType, setCopyBeamDestinationType] = React.useState<'existing' | 'manual'>('existing');
  const [copyBeamManualElevation, setCopyBeamManualElevation] = React.useState<string>('0.00');
  const [copyBeamNewStoryHeight, setCopyBeamNewStoryHeight] = React.useState<string>('3.00');
  const [copyBeamElementType, setCopyBeamElementType] = React.useState<'beams' | 'beams_columns' | 'beams_slabs' | 'beams_slabs_columns'>('beams_slabs');
  const [colSearch, setColSearch] = React.useState('');
  const [slabSearch, setSlabSearch] = React.useState('');
  const [polygonEditorSlabIndex, setPolygonEditorSlabIndex] = React.useState<number | null>(null);
  const [manualMergeSelectedIds, setManualMergeSelectedIds] = React.useState<Set<string>>(new Set());

  const beamsWithLoads = beams;

  return (
                <Tabs defaultValue="slabs-main" className="h-full flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/30 px-2 shrink-0 h-auto overflow-x-auto flex-nowrap">
                <TabsTrigger value="slabs-main" className="text-[11px] gap-1 min-h-[36px] shrink-0"><Layers size={12} />الإدخال</TabsTrigger>
                <TabsTrigger value="slabs-beams-tab" className="text-[11px] gap-1 min-h-[36px] shrink-0 text-blue-600 dark:text-blue-400"><Settings2 size={12} />جسور</TabsTrigger>
                <TabsTrigger value="slabs-cols-tab" className="text-[11px] gap-1 min-h-[36px] shrink-0 text-emerald-600 dark:text-emerald-400"><Settings2 size={12} />أعمدة</TabsTrigger>
                <TabsTrigger value="slabs-slabs-tab" className="text-[11px] gap-1 min-h-[36px] shrink-0 text-violet-600 dark:text-violet-400"><Layers size={12} />بلاطات</TabsTrigger>
                <TabsTrigger value="slabs-supports-tab" className="text-[11px] gap-1 min-h-[36px] shrink-0 text-amber-650 dark:text-amber-400"><Settings2 size={12} />مساند وركائز</TabsTrigger>
                <TabsTrigger value="slabs-generative" className="text-[11px] gap-1 min-h-[36px] shrink-0 text-accent"><Zap size={12} />تصميم توليدي</TabsTrigger>
                <TabsTrigger value="slabs-ai" className="text-[11px] gap-1 min-h-[36px] shrink-0 text-accent"><Bot size={12} />المساعد الذكي</TabsTrigger>
                <TabsTrigger value="slabs-etabs-import" className="text-[11px] gap-1 min-h-[36px] shrink-0 text-orange-600 dark:text-orange-400"><Upload size={12} />ETABS (جداول Excel)</TabsTrigger>
                <TabsTrigger value="slabs-edb-import" className="text-[11px] gap-1 min-h-[36px] shrink-0 text-blue-600 dark:text-blue-400"><Upload size={12} />ETABS (ملف .e2k)</TabsTrigger>
              </TabsList>
              <TabsContent value="slabs-main" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <div className="space-y-4 max-w-5xl">
                  {/* Story filter for this tab */}
                  <StorySelector
                    stories={stories}
                    selectedStoryId={selectedStoryId}
                    onSelectStory={id => dispatch({ type: 'SELECT_STORY', storyId: id })}
                    onAddStory={() => dispatch({ type: 'ADD_STORY' })}
                    onRemoveStory={id => dispatch({ type: 'REMOVE_STORY', storyId: id })}
                    onUpdateStory={(id, updates) => dispatch({ type: 'UPDATE_STORY', storyId: id, updates })}
                    onCopyElements={(from, to) => dispatch({ type: 'COPY_STORY_ELEMENTS', fromStoryId: from, toStoryId: to })}
                    compact
                  />
                  
                  {/* Slabs table */}
                  <Card>
                    <CardHeader className="pb-2 flex-row items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-sm">إحداثيات البلاطات (م) - {isAllStories ? 'جميع الأدوار' : getStoryLabel(selectedStoryId)}</CardTitle>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          يدعم البلاطات المستطيلة والمضلعة غير المنتظمة — اضغط <Shapes size={10} className="inline" /> لتحرير نقاط المضلع
                        </p>
                      </div>
                      <Button onClick={() => dispatch({ type: 'ADD_SLAB', slab: { id: `S${slabs.length + 1}`, x1: 0, y1: 0, x2: 5, y2: 4, storyId: selectedStoryId === '__ALL__' ? stories[0]?.id : selectedStoryId } })} size="sm" variant="outline" className="min-h-[44px] gap-1"><Plus size={14} /> إضافة بلاطة</Button>
                    </CardHeader>
                    {/* Bulk Type/Direction Controls */}
                    <div className="px-4 pb-3 flex flex-wrap gap-2 items-center border-b border-border">
                      <span className="text-xs font-medium text-muted-foreground shrink-0">تغيير جماعي:</span>
                      <div className="flex items-center gap-1.5">
                        <select
                          id="bulk-slab-type"
                          defaultValue=""
                          className="h-9 text-xs border border-input rounded-md px-2 bg-background text-foreground"
                        >
                          <option value="" disabled>نوع البلاطة...</option>
                          <option value="solid">مصمتة Solid</option>
                          <option value="one_way_ribbed">هوردي Ribbed</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs gap-1 border-violet-400 text-violet-700 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950"
                          onClick={() => {
                            const sel = (document.getElementById('bulk-slab-type') as HTMLSelectElement)?.value;
                            if (!sel) return;
                            dispatch({
                              type: 'BULK_UPDATE_SLABS',
                              key: 'slabType',
                              value: sel,
                              storyId: isAllStories ? undefined : selectedStoryId,
                            });
                          }}
                        >
                          <CheckSquare size={12} /> تطبيق النوع
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          id="bulk-slab-dir"
                          defaultValue=""
                          className="h-9 text-xs border border-input rounded-md px-2 bg-background text-foreground"
                        >
                          <option value="" disabled>اتجاه الفرش...</option>
                          <option value="auto">تلقائي Auto</option>
                          <option value="X">اتجاه X</option>
                          <option value="Y">اتجاه Y</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 text-xs gap-1 border-blue-400 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                          onClick={() => {
                            const sel = (document.getElementById('bulk-slab-dir') as HTMLSelectElement)?.value;
                            if (!sel) return;
                            dispatch({
                              type: 'BULK_UPDATE_SLABS',
                              key: 'direction',
                              value: sel,
                              storyId: isAllStories ? undefined : selectedStoryId,
                            });
                          }}
                        >
                          <Crosshair size={12} /> تطبيق الاتجاه
                        </Button>
                      </div>
                    </div>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {[...(isAllStories ? ['الدور'] : []),'الاسم','X1','Y1','X2','Y2','الدور / المنسوب Z','Lx','Ly','نوع البلاطة','مسار الفرش (الحمل)','مضلع','حذف'].map(h => (
                              <TableHead key={h} className="text-xs">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {storyFilteredSlabs.map((s) => {
                            const i = slabs.indexOf(s);
                            const sd = slabDesigns.find(sd => sd.id === s.id)?.design;
                            const isPolygon = !!(s.vertices && s.vertices.length >= 3);
                            const isEditingPolygon = polygonEditorSlabIndex === i;
                            const colSpanFull = isAllStories ? 13 : 12;
                            return (
                              <React.Fragment key={`${s.storyId}-${s.id}`}>
                                <TableRow className={isPolygon ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}>
                                  {isAllStories && <TableCell className="text-xs font-medium text-muted-foreground">{getStoryLabel(s.storyId)}</TableCell>}
                                  <TableCell><Input value={s.id} onChange={e => dispatch({ type: 'UPDATE_SLAB', index: i, key: 'id', value: e.target.value })} className="h-10 w-16 font-mono text-xs" /></TableCell>
                                  {isPolygon ? (
                                    <>
                                      <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">{s.x1.toFixed(2)}</TableCell>
                                      <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">{s.y1.toFixed(2)}</TableCell>
                                      <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">{s.x2.toFixed(2)}</TableCell>
                                      <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">{s.y2.toFixed(2)}</TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell><NumericInput value={s.x1} onCommit={val => dispatch({ type: 'UPDATE_SLAB', index: i, key: 'x1', value: String(val) })} className="h-10 w-16 font-mono text-xs" /></TableCell>
                                      <TableCell><NumericInput value={s.y1} onCommit={val => dispatch({ type: 'UPDATE_SLAB', index: i, key: 'y1', value: String(val) })} className="h-10 w-16 font-mono text-xs" /></TableCell>
                                      <TableCell><NumericInput value={s.x2} onCommit={val => dispatch({ type: 'UPDATE_SLAB', index: i, key: 'x2', value: String(val) })} className="h-10 w-16 font-mono text-xs" /></TableCell>
                                      <TableCell><NumericInput value={s.y2} onCommit={val => dispatch({ type: 'UPDATE_SLAB', index: i, key: 'y2', value: String(val) })} className="h-10 w-16 font-mono text-xs" /></TableCell>
                                    </>
                                  )}
                                  <TableCell>
                                    <select
                                      value={s.storyId || ''}
                                      onChange={e => dispatch({ type: 'UPDATE_SLAB', index: i, key: 'storyId', value: e.target.value })}
                                      className="h-10 text-xs border border-input rounded-md px-1 bg-background text-foreground w-28"
                                    >
                                      {stories.map(st => (
                                        <option key={st.id} value={st.id}>
                                          {st.label} (+{((st.elevation ?? 0) + st.height).toFixed(0)})
                                        </option>
                                      ))}
                                    </select>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{sd?.lx.toFixed(1)}</TableCell>
                                  <TableCell className="font-mono text-xs">{sd?.ly.toFixed(1)}</TableCell>
                                  <TableCell>
                                    <select
                                      value={s.slabType || 'solid'}
                                      onChange={e => dispatch({ type: 'UPDATE_SLAB', index: i, key: 'slabType', value: e.target.value })}
                                      className="h-10 text-xs border border-input rounded-md px-1 bg-background text-foreground w-[130px] font-medium text-blue-600 dark:text-blue-400"
                                    >
                                      <option value="solid">مصمتة Solid</option>
                                      <option value="one_way_ribbed">هوردي Ribbed</option>
                                    </select>
                                  </TableCell>
                                  <TableCell>
                                    <select
                                      value={s.direction || 'auto'}
                                      onChange={e => dispatch({ type: 'UPDATE_SLAB', index: i, key: 'direction', value: e.target.value })}
                                      className="h-10 text-xs border border-input rounded-md px-1 bg-background text-foreground w-[100px]"
                                    >
                                      <option value="auto">تلقائي Auto</option>
                                      <option value="X">اتجاه X</option>
                                      <option value="Y">اتجاه Y</option>
                                    </select>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      variant={isPolygon ? 'default' : 'outline'}
                                      size="sm"
                                      title={isPolygon ? `مضلع (${s.vertices!.length} نقطة) — اضغط لتعديل` : 'تحويل إلى بلاطة مضلعة'}
                                      className={`h-10 w-10 p-0 ${isEditingPolygon ? 'ring-2 ring-blue-400' : ''}`}
                                      onClick={() => setPolygonEditorSlabIndex(isEditingPolygon ? null : i)}
                                    >
                                      <Shapes size={13} />
                                    </Button>
                                  </TableCell>
                                  <TableCell><Button onClick={() => { dispatch({ type: 'REMOVE_SLAB', index: i }); if (polygonEditorSlabIndex === i) setPolygonEditorSlabIndex(null); }} variant="ghost" size="sm" className="text-destructive h-10 w-10 p-0"><Trash2 size={14} /></Button></TableCell>
                                </TableRow>
                                {/* Polygon Vertex Editor Sub-Row */}
                                {isEditingPolygon && (
                                  <TableRow>
                                    <TableCell colSpan={colSpanFull} className="p-3 bg-blue-50/60 dark:bg-blue-950/30">
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                            <Shapes size={12} />
                                            محرر نقاط المضلع — البلاطة {s.id}
                                            {isPolygon && <Badge variant="secondary" className="text-[9px] mr-1">{s.vertices!.length} نقطة</Badge>}
                                          </p>
                                          <div className="flex gap-1">
                                            {isPolygon && (
                                              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => { dispatch({ type: 'UPDATE_SLAB_VERTICES', index: i, vertices: [] }); }}>
                                                إزالة المضلع (عودة للمستطيل)
                                              </Button>
                                            )}
                                            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
                                              const currentVerts = s.vertices && s.vertices.length >= 3
                                                ? [...s.vertices]
                                                : [
                                                    { x: s.x1, y: s.y1 },
                                                    { x: s.x2, y: s.y1 },
                                                    { x: s.x2, y: s.y2 },
                                                    { x: s.x1, y: s.y2 },
                                                  ];
                                              dispatch({ type: 'UPDATE_SLAB_VERTICES', index: i, vertices: [...currentVerts, { x: s.x2, y: s.y2 }] });
                                            }}>
                                              <Plus size={10} className="mr-1" />إضافة نقطة
                                            </Button>
                                          </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                          أدخل إحداثيات نقاط المضلع بالترتيب (عكس عقارب الساعة). الإحداثيات بالمتر. الـ bounding box يُحسب تلقائياً.
                                        </p>
                                        <div className="overflow-x-auto">
                                          <table className="text-xs w-auto border-collapse">
                                            <thead>
                                              <tr className="text-muted-foreground">
                                                <th className="text-right px-2 py-1 font-medium">النقطة</th>
                                                <th className="text-right px-2 py-1 font-medium">X (م)</th>
                                                <th className="text-right px-2 py-1 font-medium">Y (م)</th>
                                                <th className="px-2 py-1"></th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(s.vertices && s.vertices.length >= 3
                                                ? s.vertices
                                                : [
                                                    { x: s.x1, y: s.y1 },
                                                    { x: s.x2, y: s.y1 },
                                                    { x: s.x2, y: s.y2 },
                                                    { x: s.x1, y: s.y2 },
                                                  ]
                                              ).map((v, vi) => {
                                                const verts = s.vertices && s.vertices.length >= 3
                                                  ? s.vertices
                                                  : [
                                                      { x: s.x1, y: s.y1 },
                                                      { x: s.x2, y: s.y1 },
                                                      { x: s.x2, y: s.y2 },
                                                      { x: s.x1, y: s.y2 },
                                                    ];
                                                return (
                                                  <tr key={vi} className="border-t border-border/40">
                                                    <td className="px-2 py-0.5 text-muted-foreground">P{vi + 1}</td>
                                                    <td className="px-2 py-0.5">
                                                      <Input
                                                        type="number" step="any" inputMode="decimal"
                                                        value={v.x}
                                                        onChange={e => {
                                                          const newVerts = verts.map((vv, j) => j === vi ? { ...vv, x: parseFloat(e.target.value) || 0 } : vv);
                                                          dispatch({ type: 'UPDATE_SLAB_VERTICES', index: i, vertices: newVerts });
                                                        }}
                                                        className="h-7 w-20 font-mono text-xs"
                                                      />
                                                    </td>
                                                    <td className="px-2 py-0.5">
                                                      <Input
                                                        type="number" step="any" inputMode="decimal"
                                                        value={v.y}
                                                        onChange={e => {
                                                          const newVerts = verts.map((vv, j) => j === vi ? { ...vv, y: parseFloat(e.target.value) || 0 } : vv);
                                                          dispatch({ type: 'UPDATE_SLAB_VERTICES', index: i, vertices: newVerts });
                                                        }}
                                                        className="h-7 w-20 font-mono text-xs"
                                                      />
                                                    </td>
                                                    <td className="px-2 py-0.5">
                                                      {verts.length > 3 && (
                                                        <Button
                                                          variant="ghost" size="sm"
                                                          className="h-7 w-7 p-0 text-destructive"
                                                          onClick={() => {
                                                            const newVerts = verts.filter((_, j) => j !== vi);
                                                            dispatch({ type: 'UPDATE_SLAB_VERTICES', index: i, vertices: newVerts });
                                                          }}
                                                        >
                                                          <Trash2 size={11} />
                                                        </Button>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                        {(s.vertices && s.vertices.length >= 3) && (
                                          <p className="text-[10px] text-muted-foreground">
                                            Bounding box: X [{s.x1.toFixed(2)} → {s.x2.toFixed(2)}] م | Y [{s.y1.toFixed(2)} → {s.y2.toFixed(2)}] م
                                          </p>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Auto-Detected Slab Merge Panel — shows when adjacent slabs share a free edge */}
                  {slabMergeGroups.length > 0 && (
                    <Card className="border-yellow-400 dark:border-yellow-600">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                          <Merge size={15} />
                          بلاطات متجاورة مكتشفة تلقائياً ({slabMergeGroups.length})
                        </CardTitle>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          البلاطات التالية متجاورة ولا يوجد جسر بينها — يجب دمجها لنقل الأحمال صحيحاً وتصميمها كبلاطة واحدة
                        </p>
                      </CardHeader>
                      <CardContent className="overflow-x-auto pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">البلاطات المراد دمجها</TableHead>
                              <TableHead className="text-xs">الأبعاد بعد الدمج</TableHead>
                              <TableHead className="text-xs">الدور</TableHead>
                              <TableHead className="text-xs"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {slabMergeGroups.map((group, gi) => {
                              const { compositeRect, subSlabIds } = group;
                              const w = Math.abs(compositeRect.x2 - compositeRect.x1).toFixed(2);
                              const h = Math.abs(compositeRect.y2 - compositeRect.y1).toFixed(2);
                              const stLabel = stories.find(st => st.id === compositeRect.storyId)?.label ?? compositeRect.storyId;
                              return (
                                <TableRow key={gi}>
                                  <TableCell className="font-mono text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                                    {subSlabIds.join(' + ')}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{w} × {h} م</TableCell>
                                  <TableCell className="text-xs">{stLabel}</TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs gap-1"
                                      onClick={() => {
                                        const newId = `M${subSlabIds.join('')}`;
                                        const newSlab: Slab = {
                                          id: newId,
                                          x1: compositeRect.x1,
                                          y1: compositeRect.y1,
                                          x2: compositeRect.x2,
                                          y2: compositeRect.y2,
                                          storyId: compositeRect.storyId ?? '',
                                        };
                                        const remaining = slabs.filter(s => !subSlabIds.includes(s.id));
                                        dispatch({ type: 'SET_SLABS', slabs: [...remaining, newSlab] });
                                      }}
                                    >
                                      <Merge size={12} />دمج
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Manual Slab Merge Panel */}
                  <Card className="border-blue-300 dark:border-blue-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <Merge size={15} />
                        دمج يدوي للبلاطات
                        {manualMergeSelectedIds.size > 0 && (
                          <Badge variant="secondary" className="text-[10px]">{manualMergeSelectedIds.size} محددة</Badge>
                        )}
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        حدد بلاطتين أو أكثر من القائمة أدناه ثم اضغط "دمج" — تُنشأ بلاطة مركبة واحدة بحدود اتحاد البلاطات المحددة الفعلية
                      </p>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {storyFilteredSlabs.map(s => (
                          <button
                            key={s.id}
                            className={`text-xs px-2.5 py-1 rounded-md border font-mono transition-colors ${
                              manualMergeSelectedIds.has(s.id)
                                ? 'bg-blue-500 text-white border-blue-600 dark:bg-blue-600'
                                : 'bg-background border-border hover:bg-muted'
                            }`}
                            onClick={() => {
                              const next = new Set(manualMergeSelectedIds);
                              if (next.has(s.id)) next.delete(s.id);
                              else next.add(s.id);
                              setManualMergeSelectedIds(next);
                            }}
                          >
                            {s.id}
                          </button>
                        ))}
                        {storyFilteredSlabs.length === 0 && (
                          <p className="text-xs text-muted-foreground">لا توجد بلاطات في هذا الدور</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-9 gap-1"
                          disabled={manualMergeSelectedIds.size < 2}
                          onClick={() => {
                            const selectedSlabs = slabs.filter(s => manualMergeSelectedIds.has(s.id));
                            if (selectedSlabs.length < 2) return;
                            const ids = [...manualMergeSelectedIds];
                            const newId = `M${ids.join('')}`;
                            const unionVerts = computeSlabUnionPolygon(selectedSlabs);
                            let newSlab: Slab;
                            if (unionVerts && unionVerts.length >= 3) {
                              const x1 = Math.min(...unionVerts.map(p => p.x));
                              const y1 = Math.min(...unionVerts.map(p => p.y));
                              const x2 = Math.max(...unionVerts.map(p => p.x));
                              const y2 = Math.max(...unionVerts.map(p => p.y));
                              const isSimpleRect = unionVerts.length === 4 &&
                                unionVerts.every(p => (p.x === x1 || p.x === x2) && (p.y === y1 || p.y === y2));
                              newSlab = {
                                id: newId, x1, y1, x2, y2,
                                ...(isSimpleRect ? {} : { vertices: unionVerts }),
                                storyId: selectedSlabs[0].storyId ?? '',
                              };
                            } else {
                              const x1 = Math.min(...selectedSlabs.map(s => Math.min(s.x1, s.x2)));
                              const y1 = Math.min(...selectedSlabs.map(s => Math.min(s.y1, s.y2)));
                              const x2 = Math.max(...selectedSlabs.map(s => Math.max(s.x1, s.x2)));
                              const y2 = Math.max(...selectedSlabs.map(s => Math.max(s.y1, s.y2)));
                              newSlab = { id: newId, x1, y1, x2, y2, storyId: selectedSlabs[0].storyId ?? '' };
                            }
                            const remaining = slabs.filter(s => !manualMergeSelectedIds.has(s.id));
                            dispatch({ type: 'SET_SLABS', slabs: [...remaining, newSlab] });
                            setManualMergeSelectedIds(new Set());
                          }}
                        >
                          <Merge size={13} />دمج البلاطات المحددة
                        </Button>
                        {manualMergeSelectedIds.size > 0 && (
                          <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setManualMergeSelectedIds(new Set())}>
                            إلغاء التحديد
                          </Button>
                        )}
                        {manualMergeSelectedIds.size >= 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            {(() => {
                              const sel = slabs.filter(s => manualMergeSelectedIds.has(s.id));
                              const uv = computeSlabUnionPolygon(sel);
                              const isComplex = uv && uv.length > 4;
                              const totalArea = uv
                                ? (() => {
                                    let a = 0;
                                    for (let i = 0, j = uv.length - 1; i < uv.length; j = i++)
                                      a += uv[j].x * uv[i].y - uv[i].x * uv[j].y;
                                    return Math.abs(a / 2).toFixed(2);
                                  })()
                                : null;
                              return isComplex
                                ? `شكل مركب (${uv!.length} نقطة) — مساحة: ${totalArea} م²`
                                : (() => {
                                    const w = (Math.max(...sel.map(s => Math.max(s.x1,s.x2))) - Math.min(...sel.map(s => Math.min(s.x1,s.x2)))).toFixed(2);
                                    const h2 = (Math.max(...sel.map(s => Math.max(s.y1,s.y2))) - Math.min(...sel.map(s => Math.min(s.y1,s.y2)))).toFixed(2);
                                    return `${w} × ${h2} م`;
                                  })();
                            })()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Generate Beams Button */}
                  <Card>
                    <CardContent className="py-3">
                      <Button 
                        onClick={() => dispatch({ type: 'GENERATE_BEAMS_MANUAL' })} 
                        className="w-full min-h-[44px] gap-2"
                        variant="outline"
                      >
                        <Wand2 size={16} />إنشاء الجسور تلقائياً
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        ينشئ الجسور بناءً على مواقع الأعمدة والبلاطات الحالية
                      </p>
                    </CardContent>
                  </Card>

                  {/* Beams table - Editable with Wall Loads */}
                  <Card>
                    <CardHeader className="pb-2 space-y-2">
                      <div className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm">الجسور ({beams.length})</CardTitle>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                          const id = `BM${extraBeams.length + 1}`;
                          dispatch({ type: 'ADD_EXTRA_BEAM', beam: {
                            id, fromCol: '', toCol: '', x1: 0, y1: 0, x2: 5, y2: 0,
                            length: 5, direction: 'horizontal', b: beamB, h: beamH,
                            deadLoad: 0, liveLoad: 0, wallLoad: 0, slabs: [],
                          }});
                        }}><Plus size={14} className="mr-1" />إضافة جسر</Button>
                      </div>
                      {/* Merge & Intersect toolbar */}
                      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={selectAllBeams}>
                          <CheckSquare size={12} />تحديد الكل
                        </Button>
                        {selectedBeamIds.size > 0 && (
                          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={clearBeamSelection}>
                            إلغاء التحديد ({selectedBeamIds.size})
                          </Button>
                        )}
                        <Button
                          size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                          disabled={selectedBeamIds.size < 2}
                          onClick={handleMergeBeams}
                        >
                          <Merge size={12} />دمج المستقيمة
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                          onClick={handleIntersect}
                        >
                          <Crosshair size={12} />Intersect
                        </Button>
                        {selectedBeamIds.size > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            محدد: {selectedBeamIds.size} جسر
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {['✓','الجسر','عقدة البداية','عقدة النهاية','X1','Y1','X2','Y2','المنسوب Z','الدور','الطول','العرض','الارتفاع','حمل جدار (kN/m)','تحرير الأطراف','حذف'].map(h => (
                              <TableHead key={h} className="text-xs">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {beams.filter(b => !removedBeamIds.includes(b.id)).map(b => {
                            const isExtra = extraBeams.some(eb => eb.id === b.id);
                            const wallLoad = beamOverrides[b.id]?.wallLoad || b.wallLoad || 0;
                            const releaseState = getBeamReleaseState(b);
                            const hasRelease = Object.values(releaseState.nodeI).some(Boolean) || Object.values(releaseState.nodeJ).some(Boolean);
                            const releasedEndsCount = Number(Object.values(releaseState.nodeI).some(Boolean)) + Number(Object.values(releaseState.nodeJ).some(Boolean));
                            return (
                            <TableRow key={b.id} className={selectedBeamIds.has(b.id) ? 'bg-primary/10' : ''}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedBeamIds.has(b.id)}
                                  onCheckedChange={() => toggleBeamSelection(b.id)}
                                />
                              </TableCell>
                              <TableCell className="p-1">
                                <Input
                                  value={b.name ?? b.id}
                                  className="h-8 w-24 font-mono text-xs font-semibold bg-background"
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (isExtra) dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { name: val } });
                                    else dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { name: val } });
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{getBeamNodeId(b.x1, b.y1, b.z ?? 0)}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{getBeamNodeId(b.x2, b.y2, b.z ?? 0)}</TableCell>
                              <TableCell>
                                <NumericInput value={b.x1} className="h-8 w-16 font-mono text-xs"
                                  onCommit={val => {
                                    if (isExtra) dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { x1: val } });
                                    else dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { x1: val } });
                                  }} />
                              </TableCell>
                              <TableCell>
                                <NumericInput value={b.y1} className="h-8 w-16 font-mono text-xs"
                                  onCommit={val => {
                                    if (isExtra) dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { y1: val } });
                                    else dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { y1: val } });
                                  }} />
                              </TableCell>
                              <TableCell>
                                <NumericInput value={b.x2} className="h-8 w-16 font-mono text-xs"
                                  onCommit={val => {
                                    if (isExtra) dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { x2: val } });
                                    else dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { x2: val } });
                                  }} />
                              </TableCell>
                              <TableCell>
                                <NumericInput value={b.y2} className="h-8 w-16 font-mono text-xs"
                                  onCommit={val => {
                                    if (isExtra) dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { y2: val } });
                                    else dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { y2: val } });
                                  }} />
                              </TableCell>
                              <TableCell>
                                <NumericInput value={b.z ?? 0} className="h-8 w-16 font-mono text-xs"
                                  onCommit={val => {
                                    if (isExtra) dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { z: val } });
                                    else dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { z: val } });
                                  }} />
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{getStoryLabel(b.storyId)}</TableCell>
                              <TableCell className="font-mono text-xs">{b.length.toFixed(2)}</TableCell>
                              <TableCell>
                                <Input type="number" value={b.b} className="h-8 w-16 font-mono text-xs"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) {
                                      dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { b: val } });
                                    } else {
                                      dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { b: val } });
                                    }
                                  }} />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={b.h} className="h-8 w-16 font-mono text-xs"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) {
                                      dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { h: val } });
                                    } else {
                                      dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { h: val } });
                                    }
                                  }} />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={wallLoad} className="h-8 w-20 font-mono text-xs"
                                  placeholder="0"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) {
                                      dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { wallLoad: val } });
                                    } else {
                                      dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { wallLoad: val } });
                                    }
                                  }} />
                              </TableCell>
                              <TableCell>
                                <div className="flex min-w-[150px] items-center gap-2">
                                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => openBeamReleaseEditor(b)}>
                                    تحرير
                                  </Button>
                                  <Badge variant={hasRelease ? 'default' : 'outline'} className="text-[10px] whitespace-nowrap">
                                    {hasRelease ? `محرر ${releasedEndsCount}/2` : 'بدون تحرير'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button onClick={() => {
                                    if (isExtra) {
                                      dispatch({ type: 'REMOVE_EXTRA_BEAM', id: b.id });
                                    } else {
                                      dispatch({ type: 'TOGGLE_BEAM_REMOVAL', beamId: b.id });
                                    }
                                  }}
                                    variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0"><Trash2 size={14} /></Button>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* ── Beam-on-Beam Splitting Tool ── */}
                  {(() => {
                    const TOL = 0.005; // 5mm tolerance in meters

                    const pointOnSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): boolean => {
                      const dAB = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
                      if (dAB < TOL) return false;
                      const dAP = Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
                      const dPB = Math.sqrt((bx - px) ** 2 + (by - py) ** 2);
                      if (dAP < TOL || dPB < TOL) return false; // ignore endpoints
                      return Math.abs(dAP + dPB - dAB) < TOL;
                    };

                    // For each active beam, find intersection points from other beams' endpoints
                    type SplitCandidate = {
                      primaryBeam: Beam;
                      secondaryBeams: { secId: string; px: number; py: number }[];
                    };

                    const activeBs = beams.filter(b => !removedBeamIds.includes(b.id));
                    const candidates: SplitCandidate[] = [];

                    for (const primary of activeBs) {
                      const intersections: { secId: string; px: number; py: number }[] = [];
                      for (const sec of activeBs) {
                        if (sec.id === primary.id) continue;
                        // Check both endpoints of the secondary beam
                        if (pointOnSegment(sec.x1, sec.y1, primary.x1, primary.y1, primary.x2, primary.y2)) {
                          // Check not already added
                          const key = `${sec.x1.toFixed(3)}_${sec.y1.toFixed(3)}`;
                          if (!intersections.some(i => `${i.px.toFixed(3)}_${i.py.toFixed(3)}` === key)) {
                            intersections.push({ secId: sec.id, px: sec.x1, py: sec.y1 });
                          }
                        }
                        if (pointOnSegment(sec.x2, sec.y2, primary.x1, primary.y1, primary.x2, primary.y2)) {
                          const key = `${sec.x2.toFixed(3)}_${sec.y2.toFixed(3)}`;
                          if (!intersections.some(i => `${i.px.toFixed(3)}_${i.py.toFixed(3)}` === key)) {
                            intersections.push({ secId: sec.id, px: sec.x2, py: sec.y2 });
                          }
                        }
                      }
                      if (intersections.length > 0) {
                        candidates.push({ primaryBeam: primary, secondaryBeams: intersections });
                      }
                    }

                    if (candidates.length === 0) return null;

                    const handleSplitBeam = (primary: Beam) => {
                      const candidate = candidates.find(c => c.primaryBeam.id === primary.id);
                      if (!candidate) return;

                      const isExtra = extraBeams.some(eb => eb.id === primary.id);

                      // Sort intersection points along the beam direction
                      const dx = primary.x2 - primary.x1;
                      const dy = primary.y2 - primary.y1;
                      const pts = candidate.secondaryBeams.map(s => ({
                        ...s,
                        t: Math.abs(dx) > Math.abs(dy)
                          ? (s.px - primary.x1) / (dx || 1)
                          : (s.py - primary.y1) / (dy || 1),
                      })).sort((a, b) => a.t - b.t);

                      // Build segment endpoints: start → pt1 → pt2 → ... → end
                      const segPoints: { x: number; y: number }[] = [
                        { x: primary.x1, y: primary.y1 },
                        ...pts.map(p => ({ x: p.px, y: p.py })),
                        { x: primary.x2, y: primary.y2 },
                      ];

                      // Remove original beam
                      if (isExtra) {
                        dispatch({ type: 'REMOVE_EXTRA_BEAM', id: primary.id });
                      } else {
                        dispatch({ type: 'TOGGLE_BEAM_REMOVAL', beamId: primary.id });
                      }

                      // Add split segments as extra beams
                      for (let i = 0; i < segPoints.length - 1; i++) {
                        const p1 = segPoints[i];
                        const p2 = segPoints[i + 1];
                        const segLen = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                        const newId = `${primary.id}-${i + 1}`;
                        dispatch({
                          type: 'ADD_EXTRA_BEAM',
                          beam: {
                            id: newId,
                            fromCol: '', toCol: '',
                            x1: p1.x, y1: p1.y,
                            x2: p2.x, y2: p2.y,
                            z: primary.z,
                            length: segLen,
                            direction: primary.direction,
                            b: primary.b, h: primary.h,
                            deadLoad: primary.deadLoad ?? 0,
                            liveLoad: primary.liveLoad ?? 0,
                            wallLoad: primary.wallLoad ?? 0,
                            slabs: [],
                            storyId: primary.storyId,
                          },
                        });
                      }
                    };

                    const handleSplitAll = () => {
                      for (const c of candidates) {
                        handleSplitBeam(c.primaryBeam);
                      }
                    };

                    return (
                      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-sm text-amber-700 dark:text-amber-400">
                                تقسيم الجسور الحاملة
                              </CardTitle>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                تم رصد {candidates.length} جسر حامل تستند عليه جسور محمولة — يجب تقسيمها لضمان صحة مصفوفة الجساءة
                              </p>
                            </div>
                            <Button size="sm" variant="default" className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white shrink-0" onClick={handleSplitAll}>
                              تقسيم الكل
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {['الجسر الحامل', 'الجسور المحمولة', 'نقاط الارتكاز (X, Y)', 'عدد الأجزاء', 'تقسيم'].map(h => (
                                  <TableHead key={h} className="text-xs">{h}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {candidates.map(({ primaryBeam: pb, secondaryBeams }) => (
                                <TableRow key={pb.id}>
                                  <TableCell className="font-mono text-xs font-bold">{pb.id}</TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex flex-wrap gap-1">
                                      {secondaryBeams.map(s => (
                                        <Badge key={s.secId} variant="outline" className="text-[10px] font-mono">{s.secId}</Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono text-muted-foreground">
                                    <div className="space-y-0.5">
                                      {secondaryBeams.map(s => (
                                        <div key={`${s.px}_${s.py}`}>({s.px.toFixed(2)}, {s.py.toFixed(2)})</div>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs font-mono">{secondaryBeams.length + 1}</TableCell>
                                  <TableCell>
                                    <Button size="sm" variant="outline" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100" onClick={() => handleSplitBeam(pb)}>
                                      تقسيم
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* ── Nodes Table (derived from model) ── */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">نقاط النموذج (العقد)</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      {(() => {
                        // Build unique nodes from columns and beams
                        const nodeMap = new Map<string, { id: string; x: number; y: number; z: number; elements: string[] }>();
                        const tol = 0.001; // m tolerance
                        const getKey = (x: number, y: number, z: number) =>
                          `${Math.round(x / tol) * tol},${Math.round(y / tol) * tol},${Math.round(z / tol) * tol}`;

                        // Add nodes from active columns
                        for (const c of columns.filter(cc => !cc.isRemoved)) {
                          const zTop = ((c.zTop ?? 0) / 1000);
                          const zBot = ((c.zBottom ?? 0) / 1000);
                          const keyTop = getKey(c.x, c.y, zTop);
                          const keyBot = getKey(c.x, c.y, zBot);
                          if (!nodeMap.has(keyTop)) nodeMap.set(keyTop, { id: `N-${nodeMap.size + 1}`, x: c.x, y: c.y, z: zTop, elements: [] });
                          nodeMap.get(keyTop)!.elements.push(c.id);
                          if (!nodeMap.has(keyBot)) nodeMap.set(keyBot, { id: `N-${nodeMap.size + 1}`, x: c.x, y: c.y, z: zBot, elements: [] });
                          nodeMap.get(keyBot)!.elements.push(c.id);
                        }

                        // Add nodes from active beams
                        for (const b of beams.filter(bb => !removedBeamIds.includes(bb.id))) {
                          const bz = ((b.z ?? 0) / 1000);
                          const key1 = getKey(b.x1, b.y1, bz);
                          const key2 = getKey(b.x2, b.y2, bz);
                          if (!nodeMap.has(key1)) nodeMap.set(key1, { id: `N-${nodeMap.size + 1}`, x: b.x1, y: b.y1, z: bz, elements: [] });
                          nodeMap.get(key1)!.elements.push(b.id);
                          if (!nodeMap.has(key2)) nodeMap.set(key2, { id: `N-${nodeMap.size + 1}`, x: b.x2, y: b.y2, z: bz, elements: [] });
                          nodeMap.get(key2)!.elements.push(b.id);
                        }

                        const modelNodes = [...nodeMap.values()];
                        // Re-number
                        modelNodes.forEach((n, i) => { n.id = `N${i + 1}`; });

                        return (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {['العقدة', 'X (م)', 'Y (م)', 'Z (م)', 'العناصر المتصلة'].map(h => (
                                  <TableHead key={h} className="text-xs">{h}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {modelNodes.map(n => (
                                <TableRow key={n.id}>
                                  <TableCell className="font-mono text-xs font-semibold">{n.id}</TableCell>
                                  <TableCell className="font-mono text-xs">{n.x.toFixed(2)}</TableCell>
                                  <TableCell className="font-mono text-xs">{n.y.toFixed(2)}</TableCell>
                                  <TableCell className="font-mono text-xs">{n.z.toFixed(2)}</TableCell>
                                  <TableCell className="text-xs">{n.elements.join(', ')}</TableCell>
                                </TableRow>
                              ))}
                              {modelNodes.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-4">
                                    لا توجد نقاط — أضف بلاطات وأعمدة أولاً
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Columns table - Editable */}
                  <Card>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">الأعمدة ({columns.filter(c => !c.isRemoved).length})</CardTitle>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                        const id = `CM${extraColumns.length + 1}`;
                        dispatch({ type: 'ADD_EXTRA_COLUMN', column: { id, x: 0, y: 0, b: colB, h: colH, L: colL } });
                      }}><Plus size={14} className="mr-1" />إضافة عمود</Button>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                             {['العمود','X','Y','Z أسفل','Z أعلى','الدور','العرض','العمق','الارتفاع','زاوية (°)','الحالة','إزالة/استعادة','حذف'].map(h => (
                               <TableHead key={h} className="text-xs">{h}</TableHead>
                             ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {columns.map(c => {
                            const isExtra = extraColumns.some(ec => ec.id === c.id);
                            return (
                            <TableRow key={c.id} className={c.isRemoved ? 'opacity-40' : ''}>
                              <TableCell className="font-mono text-xs">{c.id}</TableCell>
                              <TableCell>
                                <Input type="number" value={c.x} className="h-8 w-16 font-mono text-xs"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) dispatch({ type: 'UPDATE_EXTRA_COLUMN', id: c.id, updates: { x: val } });
                                    else dispatch({ type: 'SET_COL_OVERRIDE', colId: c.id, override: { x: val } });
                                  }} />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={c.y} className="h-8 w-16 font-mono text-xs"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) dispatch({ type: 'UPDATE_EXTRA_COLUMN', id: c.id, updates: { y: val } });
                                    else dispatch({ type: 'SET_COL_OVERRIDE', colId: c.id, override: { y: val } });
                                  }} />
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {(c.zBottom ?? 0).toFixed(0)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {(c.zTop ?? 0).toFixed(0)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{getStoryLabel(c.storyId)}</TableCell>
                              <TableCell>
                                <Input type="number" value={c.b} className="h-8 w-16 font-mono text-xs"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) {
                                      dispatch({ type: 'UPDATE_EXTRA_COLUMN', id: c.id, updates: { b: val } });
                                    } else {
                                      dispatch({ type: 'SET_COL_OVERRIDE', colId: c.id, override: { b: val } });
                                    }
                                  }} />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={c.h} className="h-8 w-16 font-mono text-xs"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) {
                                      dispatch({ type: 'UPDATE_EXTRA_COLUMN', id: c.id, updates: { h: val } });
                                    } else {
                                      dispatch({ type: 'SET_COL_OVERRIDE', colId: c.id, override: { h: val } });
                                    }
                                  }} />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={c.L} className="h-8 w-16 font-mono text-xs"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) {
                                      dispatch({ type: 'UPDATE_EXTRA_COLUMN', id: c.id, updates: { L: val } });
                                    } else {
                                      dispatch({ type: 'SET_COL_OVERRIDE', colId: c.id, override: { L: val } });
                                    }
                                  }} />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={c.orientAngle ?? 0} className="h-8 w-16 font-mono text-xs"
                                  title="زاوية توجيه المقطع: 0°=b على محور X، 90°=b على محور Y"
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    if (isExtra) {
                                      dispatch({ type: 'UPDATE_EXTRA_COLUMN', id: c.id, updates: { orientAngle: val } });
                                    } else {
                                      dispatch({ type: 'SET_COL_OVERRIDE', colId: c.id, override: { orientAngle: val } });
                                    }
                                  }} />
                              </TableCell>
                              <TableCell>
                                <Badge variant={c.isRemoved ? "destructive" : "default"} className="text-[10px]">
                                  {c.isRemoved ? 'محذوف' : 'فعال'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {!isExtra && (
                                  <Button onClick={() => dispatch({ type: 'TOGGLE_COLUMN_REMOVAL', colId: c.id })} variant="ghost" size="sm" className="h-8 text-xs">
                                    {c.isRemoved ? 'استعادة' : 'إزالة'}
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell>
                                {isExtra && (
                                  <Button onClick={() => dispatch({ type: 'REMOVE_EXTRA_COLUMN', id: c.id })}
                                    variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0"><Trash2 size={14} /></Button>
                                )}
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              {/* ── ركائز ومساند tab ── */}
              <TabsContent value="slabs-supports-tab" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <SupportManagerPanel
                  columns={columns}
                  beams={beamsWithLoads}
                  stories={stories}
                  supportDb={state.supportDb || { supports: [], assignments: [], restraints: {}, springs: {} }}
                  analyzed={state.analyzed}
                  onUpdateSupportDb={(db) => {
                    dispatch({ type: 'SET_SUPPORT_DB', db });
                  }}
                  triggerAnalysis={runAnalysis}
                />
              </TabsContent>
              {/* ── جسور tab ── */}
              <TabsContent value="slabs-beams-tab" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <div className="space-y-3 max-w-5xl">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="بحث في الجسور (رقم الجسر، الدور...)"
                      value={beamSearch}
                      onChange={e => setBeamSearch(e.target.value)}
                      className="h-8 text-xs max-w-xs"
                    />
                    {beamSearch && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setBeamSearch('')}>مسح</Button>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {beams.filter(b => !removedBeamIds.includes(b.id) && (!beamSearch || b.id.toLowerCase().includes(beamSearch.toLowerCase()) || getStoryLabel(b.storyId).includes(beamSearch))).length} جسر
                    </span>
                  </div>

                  {/* أداة نسخ الجسور بين الأدوار والرقاب */}
                  <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/10 dark:bg-blue-950/5">
                    <CardHeader className="pb-2">
                       <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Copy size={13} className="text-blue-500" />
                        نسخ ونمذجة الجسور والأسقف لجميع الأدوار والمناسيب
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-[10px] md:text-[11px] text-muted-foreground leading-relaxed">
                        تتيح لك هذه الأداة نسخ العناصر وبلاطاتها (بما في ذلك الجسور المعرّفة وتعديلاتها وأحمالها) من دور مصدر إلى دور أو منسوب مستقبل آخر تحدده أنت (مثل نسخ جسور الدور الأول للميدة عند المنسوب صفر أو للدور الثاني) دون الحاجة لإدخالها يدوياً.
                      </p>

                      <div className="flex flex-col gap-4">
                        {/* تحديد فئة العناصر المراد نسخها */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 block">العناصر المطلوب نسخها:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-1 bg-muted/60 rounded-md border border-border">
                            <Button 
                              type="button"
                              variant={copyBeamElementType === 'beams' ? 'default' : 'ghost'} 
                              className="text-[10px] h-7 px-1 py-0 font-semibold" 
                              onClick={() => setCopyBeamElementType('beams')}
                            >
                              الجسور فقط ▬
                            </Button>
                            <Button 
                              type="button"
                              variant={copyBeamElementType === 'beams_columns' ? 'default' : 'ghost'} 
                              className="text-[10px] h-7 px-1 py-0 font-semibold text-emerald-600 dark:text-emerald-400" 
                              onClick={() => setCopyBeamElementType('beams_columns')}
                            >
                              الجسور والأعمدة ☷
                            </Button>
                            <Button 
                              type="button"
                              variant={copyBeamElementType === 'beams_slabs' ? 'default' : 'ghost'} 
                              className="text-[10px] h-7 px-1 py-0 font-semibold" 
                              onClick={() => setCopyBeamElementType('beams_slabs')}
                            >
                              الجسور والبلاطات ▤
                            </Button>
                            <Button 
                              type="button"
                              variant={copyBeamElementType === 'beams_slabs_columns' ? 'default' : 'ghost'} 
                              className="text-[10px] h-7 px-1 py-0 font-semibold text-blue-600 dark:text-blue-400" 
                              onClick={() => setCopyBeamElementType('beams_slabs_columns')}
                            >
                              الكل ☲
                            </Button>
                          </div>
                        </div>

                        {/* اختيار الدور المصدر ومحدد الوجهة */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium whitespace-nowrap text-muted-foreground">الدور المصدر:</span>
                            <select 
                              id="copy-beam-source-story"
                              className="bg-background text-xs rounded border border-border px-2 py-1.5 font-medium outline-none text-foreground flex-1"
                              defaultValue={stories[0]?.id || ""}
                            >
                              {stories.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-muted-foreground">نوع الوجهة (المنسوب المستقبل):</span>
                            <div className="flex gap-2 p-1 bg-muted/60 rounded-md border border-border">
                              <Button 
                                type="button"
                                variant={copyBeamDestinationType === 'existing' ? 'default' : 'ghost'} 
                                className="flex-1 text-[11px] h-7 px-2 py-0" 
                                onClick={() => setCopyBeamDestinationType('existing')}
                              >
                                دور معرّف مسبقاً
                              </Button>
                              <Button 
                                type="button"
                                variant={copyBeamDestinationType === 'manual' ? 'default' : 'ghost'} 
                                className="flex-1 text-[11px] h-7 px-2 py-0 animate-pulse bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30" 
                                onClick={() => setCopyBeamDestinationType('manual')}
                              >
                                إدخال منسوب يدوي ✎
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* إعدادات وجهة النسخ التفاعلية */}
                        <div className="p-3 bg-background/50 rounded-lg border border-border/80 space-y-3">
                          {copyBeamDestinationType === 'existing' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-medium whitespace-nowrap text-muted-foreground">نسخ إلى الدور الهدف:</span>
                              <select 
                                id="copy-beam-target-story"
                                className="bg-background text-xs rounded border border-border px-2 py-1.5 font-medium outline-none text-foreground min-w-[180px]"
                                defaultValue=""
                              >
                                <option value="">اختر دور هدف...</option>
                                {stories.map(s => (
                                  <option key={s.id} value={s.id}>{s.label} (منسوب {(s.elevation / 1000).toFixed(2)}م - {(s.height/1000).toFixed(2)}م)</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="space-y-3.5">
                              {/* المنسوب الهدف */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">المنسوب المطلوب بالمتر (م):</span>
                                <div className="flex items-center gap-1.5">
                                  <Input 
                                    type="number"
                                    step="0.05"
                                    value={copyBeamManualElevation}
                                    onChange={e => setCopyBeamManualElevation(e.target.value)}
                                    className="h-8 text-xs w-24 font-mono text-center"
                                    placeholder="مثال: 0.0"
                                  />
                                  <span className="text-xs text-muted-foreground font-medium">متر (m)</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <span className="text-[10px] text-muted-foreground sm:ml-2">خيارات سريعة:</span>
                                  <Button 
                                    size="sm"
                                    type="button"
                                    variant="outline" 
                                    className="h-6 text-[10px] px-2 py-0 bg-secondary/80" 
                                    onClick={() => setCopyBeamManualElevation("0.00")}
                                  >
                                    0.0م (الميدة)
                                  </Button>
                                  <Button 
                                    size="sm"
                                    type="button"
                                    variant="outline" 
                                    className="h-6 text-[10px] px-2 py-0 bg-secondary/80" 
                                    onClick={() => setCopyBeamManualElevation("1.50")}
                                  >
                                    1.5م (ميدة مرتفعة)
                                  </Button>
                                  <Button 
                                    size="sm"
                                    type="button"
                                    variant="outline" 
                                    className="h-6 text-[10px] px-2 py-0 bg-secondary/80" 
                                    onClick={() => setCopyBeamManualElevation("3.00")}
                                  >
                                    3.00م
                                  </Button>
                                </div>
                              </div>

                              {/* ارتفاع الدور الجديد */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2.5 border-t border-border/40">
                                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">ارتفاع الدور الجديد بالمتر (م):</span>
                                <div className="flex items-center gap-1.5">
                                  <Input 
                                    type="number"
                                    step="0.05"
                                    value={copyBeamNewStoryHeight}
                                    onChange={e => setCopyBeamNewStoryHeight(e.target.value)}
                                    className="h-8 text-xs w-24 font-mono text-center border-indigo-200 dark:border-indigo-900"
                                    placeholder="مثال: 3.0"
                                  />
                                  <span className="text-xs text-muted-foreground font-medium">متر (m)</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  (طول رقاب الأعمدة أو ارتفاع الجدران المقترح لهذا المستوى)
                                </span>
                              </div>

                              <div className="text-[10px] text-muted-foreground leading-relaxed space-y-1 bg-indigo-50/5 p-2 rounded border border-indigo-100/30">
                                <p>
                                  💡 <strong>توضيح هندسي:</strong> لتجنب تداخل المستويات الإنشائية، فإن عناصر الأسقف والجسور يتم تحميلها دائماً على <strong>قمة دور معين</strong> (سقفه). 
                                </p>
                                <p>
                                  عند إدخال منسوب كالميدة (مثلاً 0م أو 1.5م)، فإن المستوى الإنشائي تحتها يمثل (رقاب الأعمدة)، وسينشأ دور جديد بارتفاع الرقاب المحدد أعلاه (مثلاً 1.5م أو 3م) حتى لا يختل منسوب الأدوار العليا (مثل الدور الأول بقائه على الارتفاع المعتاد 3م).
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* زر التنفيذ */}
                        <div className="flex justify-end">
                          <Button 
                            type="button"
                            size="sm" 
                            className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold px-6 w-full sm:w-auto"
                            onClick={() => {
                              const sourceEl = document.getElementById('copy-beam-source-story') as HTMLSelectElement | null;
                              const fromId = sourceEl?.value;
                              if (!fromId) {
                                alert('يرجى اختيار الدور المصدر أولاً.');
                                return;
                              }

                              let finalTargetStoryId = "";
                              let finalTargetStoryLabel = "";
                              let finalStories: Story[] = [...stories];

                              if (copyBeamDestinationType === 'existing') {
                                const targetEl = document.getElementById('copy-beam-target-story') as HTMLSelectElement | null;
                                const toId = targetEl?.value;
                                if (!toId) {
                                  alert('يرجى اختيار الدور المستقبل أولاً.');
                                  return;
                                }
                                if (fromId === toId) {
                                  alert('الدور المصدر والدور المستقبل متطابقان! يرجى اختيار دورين مختلفين.');
                                  return;
                                }
                                finalTargetStoryId = toId;
                                finalTargetStoryLabel = stories.find(s => s.id === toId)?.label || toId;
                              } else {
                                // Manual elevation input
                                const targetElevM = parseFloat(copyBeamManualElevation);
                                if (isNaN(targetElevM) || targetElevM < 0) {
                                  alert('يرجى إدخال منسوب صحيح يدوياً وقيمته أكبر من أو تساوي الصفر (مثال: 0 للميدة بالأسفل أو 3.2 للدور المتكرر).');
                                  return;
                                }

                                const newStoryHeightM = parseFloat(copyBeamNewStoryHeight);
                                if (isNaN(newStoryHeightM) || newStoryHeightM <= 0) {
                                  alert('يرجى إدخال ارتفاع صحيح للدور المطلوب إنشاؤه.');
                                  return;
                                }

                                const newStoryHeightMm = Math.round(newStoryHeightM * 1000);
                                const targetElevMm = Math.round(targetElevM * 1000);
                                
                                // Internal helper function to insert story at target Elev
                                const recalcElevations = (stList: Story[]): Story[] => {
                                   let superstructureStartIndex = 0;
                                   for (let i = 0; i < stList.length; i++) {
                                     const s = stList[i];
                                     const isBelowGround = s.id.toLowerCase().includes('mida') || 
                                                           s.id.toLowerCase().includes('pedestal') ||
                                                           s.label.includes('ميدة') || 
                                                           s.label.includes('الميدة') || 
                                                           s.label.includes('رقاب');
                                     if (!isBelowGround) {
                                       superstructureStartIndex = i;
                                       break;
                                     }
                                   }

                                   const updatedStories = [...stList];
                                   
                                   let elev = 0;
                                   for (let i = superstructureStartIndex; i < updatedStories.length; i++) {
                                     updatedStories[i] = { ...updatedStories[i], elevation: elev };
                                     elev += updatedStories[i].height;
                                   }
                                   
                                   elev = 0;
                                   for (let i = superstructureStartIndex - 1; i >= 0; i--) {
                                     elev -= updatedStories[i].height;
                                     updatedStories[i] = { ...updatedStories[i], elevation: elev };
                                   }
                                   
                                   return updatedStories;
                                 };
                                 const _ignoredRecalc = (stList: Story[]): Story[] => {
                                  let elev = 0;
                                  return stList.map(s => {
                                    const updated = { ...s, elevation: elev };
                                    elev += s.height;
                                    return updated;
                                  });
                                };

                                // Check if an existing story already ends at exactly targetElevMm
                                let foundStory = false;
                                for (const s of stories) {
                                  const top = (s.elevation ?? 0) + s.height;
                                  if (Math.abs(top - targetElevMm) < 15) {
                                    finalTargetStoryId = s.id;
                                    finalTargetStoryLabel = s.label;
                                    foundStory = true;
                                    break;
                                  }
                                }

                                if (!foundStory) {
                                  // Case 1: Target is near zero (e.g. Mida)
                                  if (targetElevMm <= 15) {
                                    const newId = `ST_MIDA_${Date.now().toString().slice(-4)}`;
                                    const newStory: Story = {
                                      id: newId,
                                      label: `الميدة (منسوب ${(targetElevMm/1000).toFixed(2)}م)`,
                                      height: newStoryHeightMm, // Dynamic height specified by user
                                      elevation: 0
                                    };
                                    finalStories = recalcElevations([newStory, ...stories]);
                                    finalTargetStoryId = newId;
                                    finalTargetStoryLabel = newStory.label;
                                  } else {
                                    // Case 2: Falling within some floor ranges
                                    let cumulative = 0;
                                    let inserted = false;
                                    for (let i = 0; i < stories.length; i++) {
                                      const s = stories[i];
                                      const top = cumulative + s.height;
                                      if (targetElevMm > cumulative && targetElevMm < top) {
                                        const firstPartHeight = targetElevMm - cumulative;
                                        const secondPartHeight = top - targetElevMm;
                                        
                                        const newId = `ST_NEW_${Date.now().toString().slice(-4)}`;
                                        const newStory: Story = {
                                          id: newId,
                                          label: `منسوب ${(targetElevMm / 1000).toFixed(2)}م`,
                                          height: firstPartHeight,
                                          elevation: cumulative
                                        };

                                        const updatedStories = [...stories];
                                        updatedStories[i] = { ...s, height: secondPartHeight };
                                        updatedStories.splice(i, 0, newStory);

                                        finalStories = recalcElevations(updatedStories);
                                        finalTargetStoryId = newId;
                                        finalTargetStoryLabel = newStory.label;
                                        inserted = true;
                                        break;
                                      }
                                      cumulative = top;
                                    }

                                    // Case 3: Above top floor
                                    if (!inserted) {
                                      const heightNeeded = targetElevMm - cumulative;
                                      const newId = `ST_TOP_${Date.now().toString().slice(-4)}`;
                                      const newStory: Story = {
                                        id: newId,
                                        label: `منسوب ${(targetElevMm / 1000).toFixed(2)}م`,
                                        height: Math.max(heightNeeded, 500),
                                        elevation: cumulative
                                      };
                                      finalStories = recalcElevations([...stories, newStory]);
                                      finalTargetStoryId = newId;
                                      finalTargetStoryLabel = newStory.label;
                                    }
                                  }
                                }

                                if (fromId === finalTargetStoryId) {
                                  alert('الدور المصدر يطابق المنسوب المدخل! يرجى اختيار منسوب آخر.');
                                  return;
                                }
                              }

                              // Generate overrides copying map by tracking beam sequential index
                              const sortedOrigins = [...stories].sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));
                              const sortedTargets = [...finalStories].sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));
                              
                              const sourceStorySortedIdx = sortedOrigins.findIndex(s => s.id === fromId);
                              const targetStorySortedIdx = sortedTargets.findIndex(s => s.id === finalTargetStoryId);

                              const sourceAutoBeams = beams.filter(b => b.storyId === fromId && !b.id.includes('-') && !extraBeams.some(eb => eb.id === b.id));
                              const targetOverrides: Record<string, any> = {};

                              if (sourceStorySortedIdx !== -1 && targetStorySortedIdx !== -1 && sourceAutoBeams.length > 0) {
                                const N = sourceAutoBeams.length;
                                const fromOffset = sourceStorySortedIdx * N;
                                const toOffset = targetStorySortedIdx * N;
                                
                                for (let i = 0; i < N; i++) {
                                  const sourceBeamId = `B${fromOffset + i + 1}`;
                                  const targetBeamId = `B${toOffset + i + 1}`;
                                  const ov = beamOverrides[sourceBeamId];
                                  if (ov) {
                                    const cleanedOv = { ...ov };
                                    if (cleanedOv.z !== undefined) {
                                      delete cleanedOv.z;
                                    }
                                    targetOverrides[targetBeamId] = cleanedOv;
                                  }
                                }
                              }

                              // Copy overrides for extra beams
                              const sourceExtraBeams = extraBeams.filter(eb => eb.storyId === fromId);
                              for (const eb of sourceExtraBeams) {
                                const ov = beamOverrides[eb.id];
                                if (ov) {
                                  const cleanedOv = { ...ov };
                                  if (cleanedOv.z !== undefined) {
                                    delete cleanedOv.z;
                                  }
                                  targetOverrides[`${eb.id}-${finalTargetStoryId}`] = cleanedOv;
                                }
                              }

                              // Generate column overrides copying map
                              const baseCols = generateColumns(slabs);
                              const targetColOverrides: Record<string, any> = {};
                              if (sourceStorySortedIdx !== -1 && targetStorySortedIdx !== -1 && baseCols.length > 0) {
                                const Nc = baseCols.length;
                                const fromOffsetC = sourceStorySortedIdx * Nc;
                                const toOffsetC = targetStorySortedIdx * Nc;
                                
                                for (let i = 0; i < Nc; i++) {
                                  const sourceColId = `C${fromOffsetC + i + 1}`;
                                  const targetColId = `C${toOffsetC + i + 1}`;
                                  const ov = colOverrides[sourceColId];
                                  if (ov) {
                                    targetColOverrides[targetColId] = { ...ov };
                                  }
                                  
                                  const legacySourceId = `${baseCols[i].id}_${fromId}`;
                                  const legacyTargetId = `${baseCols[i].id}_${finalTargetStoryId}`;
                                  const legacyOv = colOverrides[legacySourceId];
                                  if (legacyOv) {
                                    targetColOverrides[legacyTargetId] = { ...legacyOv };
                                  }
                                }
                              }

                              dispatch({ 
                                type: 'COPY_BEAMS_BETWEEN_STORIES', 
                                fromStoryId: fromId, 
                                toStoryId: finalTargetStoryId, 
                                overridesToCopy: targetOverrides,
                                colOverridesToCopy: targetColOverrides,
                                stories: finalStories,
                                copyType: copyBeamElementType
                              });

                              if (copyBeamDestinationType === 'existing') {
                                const targetEl = document.getElementById('copy-beam-target-story') as HTMLSelectElement | null;
                                if (targetEl) targetEl.value = ""; // Reset Target dropdown selection
                              }

                              let elemTypeLabel = "الجسور";
                              if (copyBeamElementType === 'beams_columns') elemTypeLabel = "الجسور والأعمدة";
                              if (copyBeamElementType === 'beams_slabs') elemTypeLabel = "الجسور والبلاطات";
                              if (copyBeamElementType === 'beams_slabs_columns') elemTypeLabel = "الجسور والبلاطات والأعمدة";

                              alert(`تم نسخ ${elemTypeLabel} بالكامل من "${stories.find(s => s.id === fromId)?.label}" إلى "${finalTargetStoryLabel}" بنجاح.`);
                            }}
                          >
                            <Copy size={13} />
                            ابدأ نسخ العناصر ميكانيكياً للمنسوب
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="overflow-x-auto pt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {['الجسر','X1','Y1','X2','Y2','الدور','الطول','العرض','الارتفاع','حمل جدار (kN/m)'].map(h => (
                              <TableHead key={h} className="text-xs">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {beams.filter(b =>
                            !removedBeamIds.includes(b.id) &&
                            (!beamSearch || (b.name || b.id).toLowerCase().includes(beamSearch.toLowerCase()) || getStoryLabel(b.storyId).includes(beamSearch))
                          ).map(b => {
                            const isExtra = extraBeams.some(eb => eb.id === b.id);
                            const wallLoad = beamOverrides[b.id]?.wallLoad || b.wallLoad || 0;
                            return (
                              <TableRow key={b.id}>
                                <TableCell className="p-1">
                                  <Input
                                    value={b.name ?? b.id}
                                    className="h-8 w-24 font-mono text-xs font-semibold bg-background"
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (isExtra) dispatch({ type: 'UPDATE_EXTRA_BEAM', id: b.id, updates: { name: val } });
                                      else dispatch({ type: 'SET_BEAM_OVERRIDE', beamId: b.id, override: { name: val } });
                                    }}
                                  />
                                </TableCell>
                                <TableCell><Input type="number" value={b.x1} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_BEAM',id:b.id,updates:{x1:val}}); else dispatch({type:'SET_BEAM_OVERRIDE',beamId:b.id,override:{x1:val}}); }} /></TableCell>
                                <TableCell><Input type="number" value={b.y1} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_BEAM',id:b.id,updates:{y1:val}}); else dispatch({type:'SET_BEAM_OVERRIDE',beamId:b.id,override:{y1:val}}); }} /></TableCell>
                                <TableCell><Input type="number" value={b.x2} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_BEAM',id:b.id,updates:{x2:val}}); else dispatch({type:'SET_BEAM_OVERRIDE',beamId:b.id,override:{x2:val}}); }} /></TableCell>
                                <TableCell><Input type="number" value={b.y2} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_BEAM',id:b.id,updates:{y2:val}}); else dispatch({type:'SET_BEAM_OVERRIDE',beamId:b.id,override:{y2:val}}); }} /></TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{getStoryLabel(b.storyId)}</TableCell>
                                <TableCell className="font-mono text-xs">{b.length.toFixed(2)}</TableCell>
                                <TableCell><Input type="number" value={b.b} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_BEAM',id:b.id,updates:{b:val}}); else dispatch({type:'SET_BEAM_OVERRIDE',beamId:b.id,override:{b:val}}); }} /></TableCell>
                                <TableCell><Input type="number" value={b.h} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_BEAM',id:b.id,updates:{h:val}}); else dispatch({type:'SET_BEAM_OVERRIDE',beamId:b.id,override:{h:val}}); }} /></TableCell>
                                <TableCell><Input type="number" value={wallLoad} className="h-8 w-20 font-mono text-xs" placeholder="0" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_BEAM',id:b.id,updates:{wallLoad:val}}); else dispatch({type:'SET_BEAM_OVERRIDE',beamId:b.id,override:{wallLoad:val}}); }} /></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── أعمدة tab ── */}
              <TabsContent value="slabs-cols-tab" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <div className="space-y-3 max-w-5xl">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="بحث في الأعمدة (رقم العمود، الدور...)"
                      value={colSearch}
                      onChange={e => setColSearch(e.target.value)}
                      className="h-8 text-xs max-w-xs"
                    />
                    {colSearch && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setColSearch('')}>مسح</Button>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {columns.filter(c => !c.isRemoved && (!colSearch || c.id.toLowerCase().includes(colSearch.toLowerCase()) || getStoryLabel(c.storyId).includes(colSearch))).length} عمود
                    </span>
                  </div>
                  <Card>
                    <CardContent className="overflow-x-auto pt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {['العمود','X','Y','الدور','العرض (مم)','العمق (مم)','الارتفاع (مم)','الزاوية (°)','الحالة'].map(h => (
                              <TableHead key={h} className="text-xs">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {columns.filter(c =>
                            !c.isRemoved &&
                            (!colSearch || c.id.toLowerCase().includes(colSearch.toLowerCase()) || getStoryLabel(c.storyId).includes(colSearch))
                          ).map(c => {
                            const isExtra = extraColumns.some(ec => ec.id === c.id);
                            return (
                              <TableRow key={c.id}>
                                <TableCell className="font-mono text-xs font-bold">{c.id}</TableCell>
                                <TableCell><NumericInput value={c.x} className="h-8 w-16 font-mono text-xs" onCommit={val => { if(isExtra) dispatch({type:'UPDATE_EXTRA_COLUMN',id:c.id,updates:{x:val}}); else dispatch({type:'SET_COL_OVERRIDE',colId:c.id,override:{x:val}}); }} /></TableCell>
                                <TableCell><NumericInput value={c.y} className="h-8 w-16 font-mono text-xs" onCommit={val => { if(isExtra) dispatch({type:'UPDATE_EXTRA_COLUMN',id:c.id,updates:{y:val}}); else dispatch({type:'SET_COL_OVERRIDE',colId:c.id,override:{y:val}}); }} /></TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{getStoryLabel(c.storyId)}</TableCell>
                                <TableCell><Input type="number" value={c.b} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_COLUMN',id:c.id,updates:{b:val}}); else dispatch({type:'SET_COL_OVERRIDE',colId:c.id,override:{b:val}}); }} /></TableCell>
                                <TableCell><Input type="number" value={c.h} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_COLUMN',id:c.id,updates:{h:val}}); else dispatch({type:'SET_COL_OVERRIDE',colId:c.id,override:{h:val}}); }} /></TableCell>
                                <TableCell><Input type="number" value={c.L} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_COLUMN',id:c.id,updates:{L:val}}); else dispatch({type:'SET_COL_OVERRIDE',colId:c.id,override:{L:val}}); }} /></TableCell>
                                <TableCell><Input type="number" value={c.orientAngle??0} className="h-8 w-16 font-mono text-xs" onChange={e => { const val = parseFloat(e.target.value)||0; if(isExtra) dispatch({type:'UPDATE_EXTRA_COLUMN',id:c.id,updates:{orientAngle:val}}); else dispatch({type:'SET_COL_OVERRIDE',colId:c.id,override:{orientAngle:val}}); }} /></TableCell>
                                <TableCell><Badge variant="default" className="text-[10px]">فعال</Badge></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── بلاطات tab ── */}
              <TabsContent value="slabs-slabs-tab" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <div className="space-y-3 max-w-5xl">
                  <div className="flex items-center flex-wrap gap-2">
                    <Input
                      placeholder="بحث في البلاطات (رقم البلاطة، الدور...)"
                      value={slabSearch}
                      onChange={e => setSlabSearch(e.target.value)}
                      className="h-8 text-xs max-w-xs"
                    />
                    {slabSearch && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSlabSearch('')}>مسح</Button>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {slabs.filter(s => !slabSearch || s.id.toLowerCase().includes(slabSearch.toLowerCase()) || getStoryLabel(s.storyId).includes(slabSearch)).length} بلاطة
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium mr-2">| تغيير جماعي:</span>
                    <select id="bulk-slab-type2" defaultValue="" className="h-8 text-[11px] border border-input rounded px-1 bg-background text-foreground">
                      <option value="" disabled>النوع...</option>
                      <option value="solid">مصمتة Solid</option>
                      <option value="one_way_ribbed">هوردي Ribbed</option>
                    </select>
                    <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1 border-violet-400 text-violet-700 dark:text-violet-400" onClick={() => {
                      const sel = (document.getElementById('bulk-slab-type2') as HTMLSelectElement)?.value;
                      if (sel) dispatch({ type: 'BULK_UPDATE_SLABS', key: 'slabType', value: sel });
                    }}><CheckSquare size={11} /> نوع</Button>
                    <select id="bulk-slab-dir2" defaultValue="" className="h-8 text-[11px] border border-input rounded px-1 bg-background text-foreground">
                      <option value="" disabled>الاتجاه...</option>
                      <option value="auto">تلقائي</option>
                      <option value="X">X</option>
                      <option value="Y">Y</option>
                    </select>
                    <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1 border-blue-400 text-blue-700 dark:text-blue-400" onClick={() => {
                      const sel = (document.getElementById('bulk-slab-dir2') as HTMLSelectElement)?.value;
                      if (sel) dispatch({ type: 'BULK_UPDATE_SLABS', key: 'direction', value: sel });
                    }}><Crosshair size={11} /> اتجاه</Button>
                  </div>
                  <Card>
                    <CardContent className="overflow-x-auto pt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {['البلاطة','X1','Y1','X2','Y2','الدور','Lx (م)','Ly (م)','نوع البلاطة','مسار الفرش (الحمل)'].map(h => (
                              <TableHead key={h} className="text-xs">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {slabs.filter(s =>
                            !slabSearch || s.id.toLowerCase().includes(slabSearch.toLowerCase()) || getStoryLabel(s.storyId).includes(slabSearch)
                          ).map(s => {
                            const i = slabs.indexOf(s);
                            const sd = slabDesigns.find(sd => sd.id === s.id)?.design;
                            return (
                              <TableRow key={`${s.storyId}-${s.id}`}>
                                <TableCell><Input value={s.id} onChange={e => dispatch({type:'UPDATE_SLAB',index:i,key:'id',value:e.target.value})} className="h-8 w-16 font-mono text-xs" /></TableCell>
                                <TableCell><Input type="number" step="any" value={s.x1} onChange={e => dispatch({type:'UPDATE_SLAB',index:i,key:'x1',value:e.target.value})} className="h-8 w-16 font-mono text-xs" /></TableCell>
                                <TableCell><Input type="number" step="any" value={s.y1} onChange={e => dispatch({type:'UPDATE_SLAB',index:i,key:'y1',value:e.target.value})} className="h-8 w-16 font-mono text-xs" /></TableCell>
                                <TableCell><Input type="number" step="any" value={s.x2} onChange={e => dispatch({type:'UPDATE_SLAB',index:i,key:'x2',value:e.target.value})} className="h-8 w-16 font-mono text-xs" /></TableCell>
                                <TableCell><Input type="number" step="any" value={s.y2} onChange={e => dispatch({type:'UPDATE_SLAB',index:i,key:'y2',value:e.target.value})} className="h-8 w-16 font-mono text-xs" /></TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{getStoryLabel(s.storyId)}</TableCell>
                                <TableCell className="font-mono text-xs">{sd?.lx.toFixed(1) ?? '—'}</TableCell>
                                <TableCell className="font-mono text-xs">{sd?.ly.toFixed(1) ?? '—'}</TableCell>
                                <TableCell>
                                  <select
                                    value={s.slabType || 'solid'}
                                    onChange={e => dispatch({type:'UPDATE_SLAB',index:i,key:'slabType',value:e.target.value})}
                                    className="h-8 text-[11px] border border-input rounded px-1 bg-background text-foreground font-medium text-blue-600 dark:text-blue-400"
                                  >
                                    <option value="solid">مصمتة Solid</option>
                                    <option value="one_way_ribbed">هوردي Ribbed</option>
                                  </select>
                                </TableCell>
                                <TableCell>
                                  <select
                                    value={s.direction || 'auto'}
                                    onChange={e => dispatch({type:'UPDATE_SLAB',index:i,key:'direction',value:e.target.value})}
                                    className="h-8 text-[11px] border border-input rounded px-1 bg-background text-foreground"
                                  >
                                    <option value="auto">تلقائي Auto</option>
                                    <option value="X">اتجاه X</option>
                                    <option value="Y">اتجاه Y</option>
                                  </select>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="slabs-generative" className="flex-1 overflow-hidden mt-0">
                <GenerativeDesignDashboard
                  onApplyOption={(ev: EvaluatedOption) => {
                    dispatch({
                      type: 'APPLY_GENERATIVE',
                      slabs: (ev.option.slabs?.length ? ev.option.slabs : slabs) as Slab[],
                      beamB: ev.option.sections.beamB,
                      beamH: ev.option.sections.beamH,
                      colB: ev.option.sections.colB,
                      colH: ev.option.sections.colH,
                    });
                  }}
                />
              </TabsContent>
              <TabsContent value="slabs-ai" className="flex-1 overflow-hidden mt-0">
                <AIAssistantPanel
                  onModelGenerated={(newSlabs) => {
                    dispatch({ type: 'SET_SLABS', slabs: newSlabs });
                    dispatch({ type: 'SET_MODE', mode: 'auto' });
                    dispatch({ type: 'SET_ACTIVE_TAB', tab: 'modeler' });
                  }}
                  onClose={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'modeler' })}
                />
              </TabsContent>
              <TabsContent value="slabs-etabs-import" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <ETABSFullImportPanel stories={stories} onApply={(data) => {
                  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

                  // ── دالة اكتشاف الدور بحسب المنسوب (بالمتر) ──
                  const detectStoryId = (zMeters: number): string => {
                    if (!stories.length) return 'ST1';
                    const zMm = zMeters * 1000;
                    let bestId = stories[0].id;
                    let bestDiff = Infinity;
                    for (const s of stories) {
                      const topElev = (s.elevation ?? 0) + s.height;
                      const diff = Math.abs(topElev - zMm);
                      if (diff < bestDiff) { bestDiff = diff; bestId = s.id; }
                    }
                    return bestId;
                  };

                  // ── 1. تحويل البلاطات — الدور يُحدَّد من متوسط منسوب نقاطها ──
                  const newSlabs: Slab[] = [];
                  for (const s of data.slabs) {
                    const coords = s.nodes.map(nId => nodeMap.get(nId)).filter(Boolean);
                    if (coords.length >= 3) {
                      const xs = coords.map(c => c!.x);
                      const ys = coords.map(c => c!.y);
                      const avgZ = coords.reduce((sum, c) => sum + c!.z, 0) / coords.length;
                      const detectedStoryId = detectStoryId(avgZ);
                      newSlabs.push({
                        id: s.id,
                        x1: Math.min(...xs), y1: Math.min(...ys),
                        x2: Math.max(...xs), y2: Math.max(...ys),
                        storyId: detectedStoryId,
                        thickness: s.thickness,
                      });
                    }
                  }

                  // ── 2. تحويل الجسور — الدور يُحدَّد من متوسط منسوب نقطتَي الجسر ──
                  const newBeams: Beam[] = [];
                  for (const b of data.beams) {
                    const ni = nodeMap.get(b.nodeI);
                    const nj = nodeMap.get(b.nodeJ);
                    if (!ni || !nj) continue;
                    const dx = nj.x - ni.x;
                    const dy = nj.y - ni.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const direction: 'horizontal' | 'vertical' = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
                    const avgZ = (ni.z + nj.z) / 2;
                    const detectedStoryId = detectStoryId(avgZ);
                    
                    let actB = beamB;
                    let actH = beamH;
                    if (b.section) {
                      const match = b.section.match(/(\d+)\s*[xX*]\s*(\d+)/);
                      if (match) {
                        let d1 = parseInt(match[1], 10);
                        let d2 = parseInt(match[2], 10);
                        if (d1 < 100) d1 *= 10;
                        if (d2 < 100) d2 *= 10;
                        actB = Math.min(d1, d2);
                        actH = Math.max(d1, d2);
                      }
                    }

                    newBeams.push({
                      id: b.id,
                      fromCol: b.nodeI,
                      toCol: b.nodeJ,
                      x1: ni.x, y1: ni.y,
                      x2: nj.x, y2: nj.y,
                      z: avgZ * 1000,                   // تحويل م → مم
                      length: len,
                      direction,
                      b: actB,
                      h: actH,
                      deadLoad: 0,
                      liveLoad: 0,
                      slabs: [],
                      storyId: detectedStoryId,
                    });
                  }

                  // ── 3. تحويل الأعمدة — الدور يُحدَّد من منسوب النقطة العلوية (nodeJ) ──
                  const newColumns: Column[] = [];
                  for (const c of data.columns) {
                    const ni = nodeMap.get(c.nodeI);
                    const nj = nodeMap.get(c.nodeJ);
                    if (!ni) continue;
                    const zBot = (ni.z ?? 0) * 1000;    // م → مم
                    const zTop = nj ? (nj.z ?? 0) * 1000 : zBot + colL;
                    const L = Math.max(zTop - zBot, colL);
                    // الدور يُحدَّد من النقطة العلوية للعمود
                    const topZ = nj ? nj.z : (zTop / 1000);
                    const detectedStoryId = detectStoryId(topZ);

                    let actB = colB;
                    let actH = colH;
                    if (c.section) {
                      const match = c.section.match(/(\d+)\s*[xX*]\s*(\d+)/);
                      if (match) {
                        let d1 = parseInt(match[1], 10);
                        let d2 = parseInt(match[2], 10);
                        if (d1 < 100) d1 *= 10;
                        if (d2 < 100) d2 *= 10;
                        actB = d1;
                        actH = d2;
                      }
                    }

                    newColumns.push({
                      id: c.id,
                      x: ni.x,
                      y: ni.y,
                      b: actB,
                      h: actH,
                      L,
                      zBottom: zBot,
                      zTop: zTop,
                      storyId: detectedStoryId,
                    });
                  }

                  // ── 4. رفع البيانات إلى الحالة مع تفعيل وضع الاستيراد ──
                  if (newSlabs.length > 0 || newBeams.length > 0 || newColumns.length > 0) {
                    if (newSlabs.length > 0) dispatch({ type: 'SET_SLABS', slabs: newSlabs });
                    dispatch({ type: 'SET_EXTRA_BEAMS', beams: newBeams });
                    dispatch({ type: 'SET_EXTRA_COLUMNS', columns: newColumns });
                    dispatch({ type: 'SET_ETABS_IMPORT_MODE', value: true });
                    dispatch({ type: 'SAVE_SNAPSHOT', message: `✓ ETABS: ${newColumns.length} عمود | ${newBeams.length} جسر | ${newSlabs.length} بلاطة` });
                  }
                }} />
              </TabsContent>

              {/* ── EDB / E2K File Import ── */}
              <TabsContent value="slabs-edb-import" className="flex-1 overflow-y-auto p-3 md:p-4 mt-0 pb-20 md:pb-4">
                <ETABSEdbImportPanel
                  onApply={(edbData: EdbImportedData) => {
                    const jointMap = new Map(edbData.joints.map(j => [j.id, j]));

                    // ── تحديد الدور بناءً على المنسوب Z (بالمتر) ──
                    const detectStoryId = (zMeters: number): string => {
                      if (!stories.length) return 'ST1';
                      const zMm = zMeters * 1000;
                      let bestId = stories[0].id;
                      let bestDiff = Infinity;
                      for (const s of stories) {
                        const topElev = (s.elevation ?? 0) + s.height;
                        const diff = Math.abs(topElev - zMm);
                        if (diff < bestDiff) { bestDiff = diff; bestId = s.id; }
                      }
                      return bestId;
                    };

                    // ── استخراج fc وfy من المواد ──
                    const concMat = edbData.materials.find(m =>
                      m.type === 'CONCRETE' || m.type === 'CONC' || m.type.includes('CONC')
                    );
                    if (concMat?.fc && concMat.fc > 1) {
                      dispatch({ type: 'SET_MAT', mat: { ...mat, fc: concMat.fc } });
                    }
                    if (concMat?.fy && concMat.fy > 10) {
                      dispatch({ type: 'SET_MAT', mat: { ...mat, fy: concMat.fy } });
                    }

                    // ── خريطة المقاطع ──
                    const sectionMap = new Map(edbData.sections.map(s => [s.id, s]));
                    const areaSectionMap = new Map(edbData.areaSections.map(s => [s.id, s]));

                    // ── 1. تحويل الجسور ──
                    const newBeams: Beam[] = [];
                    for (const f of edbData.frames.filter(f => f.elementType === 'beam')) {
                      const ji = jointMap.get(f.jointI);
                      const jj = jointMap.get(f.jointJ);
                      if (!ji || !jj) continue;
                      const dx = jj.x - ji.x;
                      const dy = jj.y - ji.y;
                      const len = Math.sqrt(dx * dx + dy * dy);
                      if (len < 0.01) continue;
                      const direction: 'horizontal' | 'vertical' =
                        Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
                      const avgZ = (ji.z + jj.z) / 2;
                      const sec = sectionMap.get(f.section);
                      newBeams.push({
                        id: f.id,
                        fromCol: f.jointI,
                        toCol: f.jointJ,
                        x1: ji.x, y1: ji.y,
                        x2: jj.x, y2: jj.y,
                        z: avgZ * 1000,
                        length: len,
                        direction,
                        b: sec ? Math.round(sec.b) : beamB,
                        h: sec ? Math.round(sec.h) : beamH,
                        deadLoad: 0,
                        liveLoad: 0,
                        slabs: [],
                        storyId: detectStoryId(avgZ),
                      });
                    }

                    // ── 2. تحويل الأعمدة ──
                    const newColumns: Column[] = [];
                    for (const f of edbData.frames.filter(f => f.elementType === 'column')) {
                      const ji = jointMap.get(f.jointI);
                      const jj = jointMap.get(f.jointJ);
                      if (!ji || !jj) continue;
                      const zBot = Math.min(ji.z, jj.z);
                      const zTop = Math.max(ji.z, jj.z);
                      const height = (zTop - zBot) * 1000; // mm
                      if (height < 10) continue;
                      const sec = sectionMap.get(f.section);
                      const topJoint = zTop === jj.z ? jj : ji;
                      newColumns.push({
                        id: f.id,
                        x: topJoint.x,
                        y: topJoint.y,
                        b: sec ? Math.round(sec.b) : colB,
                        h: sec ? Math.round(sec.h) : colH,
                        L: Math.round(height),
                        zBottom: zBot * 1000,
                        zTop: zTop * 1000,
                        storyId: detectStoryId(zTop),
                      });
                    }

                    // ── 3. تحويل البلاطات ──
                    const newSlabs: Slab[] = [];
                    for (const a of edbData.areas) {
                      const coords = a.joints.map(jId => jointMap.get(jId)).filter(Boolean);
                      if (coords.length < 3) continue;
                      const xs = coords.map(c => c!.x);
                      const ys = coords.map(c => c!.y);
                      const avgZ = coords.reduce((sum, c) => sum + c!.z, 0) / coords.length;
                      const areaSec = areaSectionMap.get(a.section);
                      if (areaSec?.thickness && areaSec.thickness > 0) {
                        dispatch({ type: 'SET_SLAB_PROPS', props: { ...slabProps, thickness: Math.round(areaSec.thickness) } });
                      }
                      newSlabs.push({
                        id: a.id,
                        x1: Math.min(...xs), y1: Math.min(...ys),
                        x2: Math.max(...xs), y2: Math.max(...ys),
                        storyId: detectStoryId(avgZ),
                      });
                    }

                    // ── 4. تحويل ردود الأفعال لتصميم الأساسات ──
                    if (edbData.hasAnalysisResults && edbData.reactions.length > 0) {
                      // تجميع ردود الأفعال لكل عقدة (مجموع الحالات)
                      const reactionMap = new Map<string, { Fz: number; count: number }>();
                      for (const r of edbData.reactions) {
                        const lc = r.loadCase.toUpperCase();
                        if (lc.includes('DEAD') || lc.includes('LIVE') || lc.includes('DL') || lc.includes('LL')) {
                          const existing = reactionMap.get(r.joint) ?? { Fz: 0, count: 0 };
                          reactionMap.set(r.joint, {
                            Fz: existing.Fz + Math.abs(r.Fz),
                            count: existing.count + 1,
                          });
                        }
                      }
                      // تحويل إلى ETABSReaction format for FoundationDesignPanel
                      const etabsReacts = Array.from(reactionMap.entries())
                        .filter(([, v]) => v.Fz > 0.01)
                        .map(([joint, v]) => ({
                          joint,
                          P_DL: v.Fz * 0.6, // تقدير: 60% DL
                          P_LL: v.Fz * 0.4, // تقدير: 40% LL
                        }));
                      if (etabsReacts.length > 0) {
                        setEtabsReactions(etabsReacts as any);
                      }
                    }

                    // ── 5. تطبيق البيانات ──
                    if (newSlabs.length > 0) dispatch({ type: 'SET_SLABS', slabs: newSlabs });
                    if (newBeams.length > 0) dispatch({ type: 'SET_EXTRA_BEAMS', beams: newBeams });
                    if (newColumns.length > 0) dispatch({ type: 'SET_EXTRA_COLUMNS', columns: newColumns });
                    dispatch({ type: 'SET_ETABS_IMPORT_MODE', value: true });
                    dispatch({
                      type: 'SAVE_SNAPSHOT',
                      message: `✓ ETABS E2K: ${newColumns.length} عمود | ${newBeams.length} جسر | ${newSlabs.length} بلاطة`,
                    });
                  }}
                />
              </TabsContent>
            </Tabs>
  );
};

export default SlabsInputPanel;

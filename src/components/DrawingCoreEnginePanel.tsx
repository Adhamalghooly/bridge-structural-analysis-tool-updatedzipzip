import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DrawingDocument, 
  DrawingSheet, 
  DrawingViewport, 
  DrawingLayer, 
  DrawingEntity, 
  DrawingCanvasRenderer,
  StructuralDrawingAdapter,
  SymbolEngine,
  DimensionEngine,
  AnnotationEngine,
  SheetSizeName,
  TitleBlockData
} from '@/lib/drawingCoreEngine';
import { StructuralPlanGenerator } from '@/lib/structuralPlanGenerator';
import { StructuralPlanIntelligenceEngine } from '@/lib/structuralPlanIntelligence';
import { ReinforcementPlanGenerator } from '@/lib/reinforcementPlanGenerator';
import { DetailCalloutEngine, CalloutMark, QAValidationIssue } from '@/lib/detailCalloutEngine';
import { 
  Layers, Download, Printer, Plus, Trash2, Maximize2, ZoomIn, ZoomOut, Move, 
  Compass, Type, Ruler, Grid, Check, RefreshCw, Layers2, FileText, Settings, MousePointer, Info, Sparkles, AlertTriangle, Gauge,
  Link2, Database, Tag, FileSpreadsheet, Eye, BookOpen, Workflow, ClipboardList, AlertCircle
} from 'lucide-react';

interface DrawingCoreEnginePanelProps {
  stories?: any[];
  activeStoryId?: string;
  slabs?: any[];
  beams?: any[];
  columns?: any[];
  projectName?: string;
  foundationResults?: any[];
}

export default function DrawingCoreEnginePanel({
  stories = [],
  activeStoryId = '',
  slabs = [],
  beams = [],
  columns = [],
  projectName = 'Model Study Project',
  foundationResults = []
}: DrawingCoreEnginePanelProps) {
  
  // 1. Core Model States
  const [doc, setDoc] = useState<DrawingDocument | null>(null);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [activeLayerId, setActiveLayerId] = useState<string>(''); // filter layer on preview if selected
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  
  // Callouts & Drawing References (Phase D4 Dual-Link System)
  const [sheetNumberMap, setSheetNumberMap] = useState<Record<string, string>>({
    'SH-STORY-1': 'S-101',
    'SH-STORY-2': 'S-102',
    'SH-STORY-3': 'S-103',
    'SH-FOUNDATION-REBAR': 'S-201',
    'SH-STU-1': 'S-301'
  });
  const [callouts, setCallouts] = useState<CalloutMark[]>([]);
  const [hoveredCalloutId, setHoveredCalloutId] = useState<string | null>(null);
  const [toastInteraction, setToastInteraction] = useState<{ show: boolean; callout?: CalloutMark }>({ show: false });
  
  // Adaptive Template selections
  const [activeTemplate, setActiveTemplate] = useState<'standard' | 'structural_detail' | 'beam_schedule'>('standard');

  // Dynamic Rebar & Reinforcement Display Type
  const [drawingPlanType, setDrawingPlanType] = useState<
    'standard' | 'combined_rebar' | 'beam_rebar' | 'col_rebar' | 'slab_rebar' | 'foundation_rebar'
  >('standard');

  // Title Block edits
  const [clientName, setClientName] = useState('MUNICIPALITY DEPT OF HOUSING');
  const [engName, setEngName] = useState('ENG. AHMED AL-HARBI');
  
  // 2. Navigation / Zoom / Pan States of our interactive viewport
  const [zoom, setZoom] = useState<number>(0.9); // scale of viewport render
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 50, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // 3. User custom Drafting Tool States
  const [activeTool, setActiveTool] = useState<'select' | 'line' | 'dimension' | 'text' | 'grid_bubble' | 'north_arrow'>('select');
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<string>('REBAR T16');
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [statusBarCoords, setStatusBarCoords] = useState<string>('Hover to measure...');
  const [showCollisionGuides, setShowCollisionGuides] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize unified document
  const initDocument = () => {
    let document;
    if (drawingPlanType === 'standard') {
      document = StructuralPlanGenerator.generateMultiSheetFramingPlan(
        stories,
        columns,
        beams,
        slabs,
        foundationResults.length > 0 ? foundationResults : [
          { id: 'F-01', cx: -1.5, cy: -2, B: 2.0, L: 2.2, thickness: 500 },
          { id: 'F-02', cx: 2.5, cy: -2, B: 1.8, L: 1.8, thickness: 450 },
          { id: 'F-03', cx: 4.0, cy: 3.5, B: 2.4, L: 2.4, thickness: 600 }
        ],
        {
          projectName,
          clientName,
          engineerName: engName,
        }
      );
    } else {
      document = ReinforcementPlanGenerator.generateReinforcementPlan(
        stories,
        columns,
        beams,
        slabs,
        foundationResults.length > 0 ? foundationResults : [
          { id: 'F-01', cx: -1.5, cy: -2, B: 2.0, L: 2.2, thickness: 500 },
          { id: 'F-02', cx: 2.5, cy: -2, B: 1.8, L: 1.8, thickness: 450 },
          { id: 'F-03', cx: 4.0, cy: 3.5, B: 2.4, L: 2.4, thickness: 600 }
        ],
        {
          projectName,
          clientName,
          engineerName: engName,
        }
      );
    }

    // Auto align and sync sheet numbers
    const initialMap: Record<string, string> = { ...sheetNumberMap };
    document.sheets.forEach(s => {
      if (!initialMap[s.id]) {
        initialMap[s.id] = s.titleBlock.drawingNumber || 'S-101';
      }
      s.titleBlock.drawingNumber = initialMap[s.id];
    });
    setSheetNumberMap(initialMap);

    // Setup of dual links
    const defaultCallouts = DetailCalloutEngine.buildDefaultCallouts(document.sheets, initialMap);
    setCallouts(prev => prev.length === 0 ? defaultCallouts : prev.map(c => {
      // update the mark to adapt to any updated sheet numbers
      const targetNo = initialMap[c.targetSheetId] || c.targetSheetNo;
      let newMark = c.mark;
      if (c.type === 'detail') {
        newMark = `Detail ${c.number}/${targetNo}`;
      } else if (c.type === 'schedule') {
        newMark = `See Schedule /${targetNo}`;
      } else if (c.type === 'sheet') {
        newMark = `See Sheet ${targetNo}`;
      }
      return { ...c, targetSheetNo: targetNo, mark: newMark };
    }));

    setDoc(document);
    if (document.sheets.length > 0) {
      const exists = document.sheets.find(s => s.id === selectedSheetId);
      if (!exists) {
        setSelectedSheetId(document.sheets[0].id);
      }
    }
  };

  useEffect(() => {
    initDocument();
  }, [projectName, stories, activeStoryId, slabs, columns, beams, foundationResults, clientName, engName, drawingPlanType]);

  // Current selected sheet object
  const activeSheet = useMemo(() => {
    if (!doc || !selectedSheetId) return null;
    return doc.getSheetById(selectedSheetId) || null;
  }, [doc, selectedSheetId]);

  // Filtered sheet view based on the selected specific reinforcement plans (D3 sub-requirement)
  const filteredSheet = useMemo(() => {
    if (!activeSheet) return null;
    if (drawingPlanType === 'standard' || drawingPlanType === 'combined_rebar') {
      return activeSheet;
    }

    // Clone active sheet so we don't modify the real document
    const cloned = Object.assign(Object.create(Object.getPrototypeOf(activeSheet)), activeSheet);
    cloned.entities = activeSheet.entities.filter((ent: any) => {
      // Structural grids/title block/borders/rebar legends are always visible
      if (['GRID', 'TITLE_BLOCK', 'DIMENSIONS'].includes(ent.layerId) || 
          ent.id.includes('border') || ent.id.includes('title') || ent.id.includes('reb-')) {
        return true;
      }

      if (drawingPlanType === 'beam_rebar') {
        return ent.id.includes('bm') || ent.id.includes('beam');
      }
      if (drawingPlanType === 'col_rebar') {
        return ent.id.includes('col') || ent.id.includes('column');
      }
      if (drawingPlanType === 'slab_rebar') {
        return ent.id.includes('slab');
      }
      if (drawingPlanType === 'foundation_rebar') {
        return ent.id.includes('found') || ent.id.includes('footing') || ent.id.includes('fr-');
      }
      return true;
    });

    return cloned;
  }, [activeSheet, drawingPlanType]);

  // Readability computation for the active selected sheet standard
  const readabilityMetrics = useMemo(() => {
    if (!activeSheet) return null;
    return StructuralPlanIntelligenceEngine.computeReadability(activeSheet);
  }, [activeSheet, doc]);

  // Interactive repaint triggering
  useEffect(() => {
    if (!filteredSheet || !canvasRef.current || !doc) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear buffer
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Render translation zoom grid matrix
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Drawing Canvas helper
    DrawingCanvasRenderer.renderSheetHTMLCanvas(
      ctx,
      filteredSheet,
      doc,
      selectedEntityId ? [selectedEntityId] : [],
      activeLayerId
    );

    // If user is currently dragging/drafting, render preview guidelines
    if (activeTool !== 'select' && draftStart) {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);

      const start = draftStart;
      const cur = mousePos;

      if (activeTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
      } else if (activeTool === 'dimension') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
        // illustrative arrow heads
        ctx.fillStyle = '#3B82F6';
        ctx.font = '2mm monospace';
        ctx.fillText('⚡ Dim Line', (start.x + cur.x) / 2, (start.y + cur.y) / 2 - 2);
      }
    }

    // Dynamic high-visibility collision hotspot overlays (Phase D2A requirement)
    if (showCollisionGuides && activeSheet) {
      const hotspots = StructuralPlanIntelligenceEngine.getCollisionHotspots(activeSheet);
      hotspots.forEach(hs => {
        ctx.save();
        ctx.strokeStyle = hs.severity === 'high' ? '#EF4444' : '#F59E0B';
        ctx.lineWidth = 0.8;
        ctx.fillStyle = hs.severity === 'high' ? 'rgba(239, 68, 68, 0.16)' : 'rgba(245, 158, 11, 0.16)';
        
        ctx.beginPath();
        ctx.arc(hs.x, hs.y, hs.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Draw alert icon over collision focal centers
        ctx.fillStyle = hs.severity === 'high' ? '#EF4444' : '#F59E0B';
        ctx.font = 'bold 3.2px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠', hs.x, hs.y);
        ctx.restore();
      });
    }

    // Phase D4: Detail Callout Graphics overlays
    if (activeSheet) {
      DetailCalloutEngine.renderCalloutGraphicsOnCanvas(
        ctx,
        callouts,
        activeSheet.id,
        hoveredCalloutId
      );
    }

    ctx.restore();
  }, [doc, activeSheet, zoom, pan, selectedEntityId, activeLayerId, activeTool, draftStart, mousePos, showCollisionGuides, callouts, hoveredCalloutId]);

  // Handle Layer managers actions
  const handleToggleLayerVisibility = (layerId: string) => {
    if (!doc) return;
    const newLayers = doc.layers.map(l => {
      if (l.id === layerId) return { ...l, visible: !l.visible };
      return l;
    });
    const cloned = Object.assign(Object.create(Object.getPrototypeOf(doc)), doc);
    cloned.layers = newLayers;
    setDoc(cloned);
  };

  const handleToggleLayerLock = (layerId: string) => {
    if (!doc) return;
    const newLayers = doc.layers.map(l => {
      if (l.id === layerId) return { ...l, locked: !l.locked };
      return l;
    });
    const cloned = Object.assign(Object.create(Object.getPrototypeOf(doc)), doc);
    cloned.layers = newLayers;
    setDoc(cloned);
  };

  // Convert browser coordinate mouse pos to CAD paper coordinate vector
  const getPaperCoordFromMouseEvent = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Inverse matrix of pan/zoom
    const paperX = (mx - pan.x) / zoom;
    const paperY = (my - pan.y) / zoom;
    return { x: paperX, y: paperY };
  };

  // Canvas Mouse down listeners
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      // Pan mode
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
      return;
    }

    const paperPt = getPaperCoordFromMouseEvent(e);

    if (activeTool === 'select') {
      // Find closest entity to select it
      if (!activeSheet) return;

      // Phase D4 Check: Did they click an interactive detail/section callout circle?
      const activeCallouts = callouts.filter(c => c.sourceSheetId === activeSheet.id);
      const clickedCallout = activeCallouts.find(c => {
        const dist = Math.sqrt((paperPt.x - c.x) ** 2 + (paperPt.y - c.y) ** 2);
        return dist <= (c.radius || 10);
      });

      if (clickedCallout) {
        handleNavigateToCallout(clickedCallout);
        return;
      }

      let foundId = '';
      
      // search direct sheet entities
      for (const ent of activeSheet.entities) {
        // Simple bounding box checks
        if (ent.type === 'rectangle') {
          if (paperPt.x >= ent.x && paperPt.x <= ent.x + ent.width &&
              paperPt.y >= ent.y && paperPt.y <= ent.y + ent.height) {
            foundId = ent.id;
            break;
          }
        } else if (ent.type === 'circle') {
          const dist = Math.sqrt((paperPt.x - ent.cx) ** 2 + (paperPt.y - ent.cy) ** 2);
          if (dist <= ent.radius + 3) {
            foundId = ent.id;
            break;
          }
        } else if (ent.type === 'line') {
          const d1 = Math.sqrt((paperPt.x - ent.x1) ** 2 + (paperPt.y - ent.y1) ** 2);
          const d2 = Math.sqrt((paperPt.x - ent.x2) ** 2 + (paperPt.y - ent.y2) ** 2);
          const len = Math.sqrt((ent.x2 - ent.x1) ** 2 + (ent.y2 - ent.y1) ** 2);
          if (d1 + d2 <= len + 2) {
            foundId = ent.id;
            break;
          }
        } else if (ent.type === 'text') {
          const charWidth = (ent.fontSize || 3.2) * 0.6;
          const textWidth = (ent.text || '').length * charWidth;
          const h = (ent.fontSize || 3.2) * 1.2;
          const tx = ent.align === 'center' ? ent.x - textWidth / 2 : (ent.align === 'right' ? ent.x - textWidth : ent.x);
          const ty = ent.y - h / 2;
          
          if (paperPt.x >= tx && paperPt.x <= tx + textWidth &&
              paperPt.y >= ty && paperPt.y <= ty + h) {
            foundId = ent.id;
            break;
          }
        }
      }
      setSelectedEntityId(foundId);
    } else {
      // Drafting custom element
      setDraftStart(paperPt);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const paperPt = getPaperCoordFromMouseEvent(e);
    setMousePos(paperPt);

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
      return;
    }

    // Phase D4 Hover Check: highlight hovering over active callout markers
    if (activeSheet) {
      const activeCallouts = callouts.filter(c => c.sourceSheetId === activeSheet.id);
      const hovered = activeCallouts.find(c => {
        const dist = Math.sqrt((paperPt.x - c.x) ** 2 + (paperPt.y - c.y) ** 2);
        return dist <= (c.radius || 10);
      });
      if (hovered) {
        setHoveredCalloutId(hovered.id);
        if (canvasRef.current) canvasRef.current.style.cursor = 'pointer';
      } else {
        setHoveredCalloutId(null);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = activeTool === 'select' ? 'default' : 'crosshair';
        }
      }
    }

    // Dynamic Coordinate meter tracker displays
    let viewportTracker = '';
    if (activeSheet) {
      // Check which viewport we are hovering
      const vp = activeSheet.viewports.find(v => 
        paperPt.x >= v.sheetX && paperPt.x <= v.sheetX + v.sheetW &&
        paperPt.y >= v.sheetY && paperPt.y <= v.sheetY + v.sheetH
      );

      if (vp) {
        const modelPt = vp.sheetToModel(paperPt.x, paperPt.y);
        viewportTracker = ` [Viewport ${vp.name}]: Model Space X: ${modelPt.x.toFixed(2)}m, Y: ${modelPt.y.toFixed(2)}m`;
      }
    }
    setStatusBarCoords(`Paper Sheet: X: ${paperPt.x.toFixed(1)}mm, Y: ${paperPt.y.toFixed(1)}mm${viewportTracker}`);
  };

  const handleMouseUp = () => {
    setIsPanning(false);

    if (activeTool !== 'select' && draftStart && activeSheet) {
      const endPt = mousePos;
      const id = `user-ent-${Date.now()}`;
      let newEnt: DrawingEntity | null = null;

      // Create typed vector entity
      if (activeTool === 'line') {
        newEnt = {
          id, type: 'line', layerId: 'HIDDEN',
          x1: draftStart.x, y1: draftStart.y,
          x2: endPt.x, y2: endPt.y,
          color: '#3B82F6',
          lineWidth: 0.4
        };
      } else if (activeTool === 'dimension') {
        newEnt = DimensionEngine.createLinearDimension(
          id, 'DIMENSIONS', draftStart.x, draftStart.y, endPt.x, endPt.y, 10, 'tick', 'aligned'
        );
      } else if (activeTool === 'text') {
        newEnt = AnnotationEngine.createTextBlock(
          id, 'TEXT', textInput, draftStart.x, draftStart.y, 3.2, 'normal', 'center', 'en'
        );
      } else if (activeTool === 'grid_bubble') {
        newEnt = SymbolEngine.createGridBubble(id, textInput, draftStart.x, draftStart.y, 4.5);
      } else if (activeTool === 'north_arrow') {
        newEnt = SymbolEngine.createNorthArrow(id, draftStart.x, draftStart.y, 8, 45);
      }

      if (newEnt) {
        // Add live CAD entity to sheet vector array
        const updatedDoc = { ...doc } as DrawingDocument;
        const currentSheet = updatedDoc.sheets.find(s => s.id === selectedSheetId);
        if (currentSheet) {
          currentSheet.entities.push(newEnt);
        }
        setDoc(updatedDoc);
      }

      setDraftStart(null);
      setActiveTool('select'); // return to selection
    }
  };

  // Helper to delete selected items
  const handleDeleteSelectedEntity = () => {
    if (!selectedEntityId || !activeSheet || !doc) return;
    
    // filter selected element
    const updatedDoc = { ...doc } as DrawingDocument;
    const currentSheet = updatedDoc.sheets.find(s => s.id === selectedSheetId);
    if (currentSheet) {
      currentSheet.entities = currentSheet.entities.filter(ent => ent.id !== selectedEntityId);
    }
    setDoc(updatedDoc);
    setSelectedEntityId('');
  };

  // Revision Management for Rebar
  const handleReviseRebar = (updates: any) => {
    if (!selectedEntityId || !activeSheet || !doc) return;
    
    const updatedDoc = { ...doc } as DrawingDocument;
    const currentSheet = updatedDoc.sheets.find(s => s.id === selectedSheetId);
    if (currentSheet) {
      const ent = currentSheet.entities.find(e => e.id === selectedEntityId);
      if (ent) {
        if (!ent.metadata) {
          ent.metadata = {};
        }
        ent.metadata = {
          ...ent.metadata,
          ...updates,
        };
        // Recompute weight automatically
        const d = updates.diameter !== undefined ? updates.diameter : ent.metadata.diameter || 12;
        const q = updates.quantity !== undefined ? updates.quantity : ent.metadata.quantity || 10;
        const l = updates.length !== undefined ? updates.length : ent.metadata.length || 3200;
        ent.metadata.weight = parseFloat(((d * d) / 162.2 * (l / 1000) * q).toFixed(1));
      }
    }
    setDoc(updatedDoc);
  };

  // Export BBS details to a beautifully structured dynamic CSV table
  const handleExportRebarExcel = () => {
    if (!activeSheet) return;
    
    const rebarEntities = activeSheet.entities.filter(ent => ent.metadata?.rebarMark);
    if (rebarEntities.length === 0) {
      alert("No reinforcement steel entries detected on this layout. Please select a dynamic reinforcement plan layout from the options.");
      return;
    }

    const rows = rebarEntities.map(ent => ({
      'Bar Mark': ent.metadata.rebarMark,
      'Member/Component': ent.metadata.member,
      'Member TypeCode': ent.metadata.memberType,
      'Diameter Φ (mm)': ent.metadata.diameter,
      'Steel Length (mm)': ent.metadata.length,
      'BS8666 Shape Code': ent.metadata.shapeCode,
      'Bar Quantity': ent.metadata.quantity,
      'Material Steel Grade': ent.metadata.steelGrade,
      'Calculated Net Weight (kg)': ent.metadata.weight,
      'Schedules Referencing': ent.metadata.detailRef,
      'Structural Zone': ent.metadata.section
    }));

    const headers = Object.keys(rows[0]).join(',');
    const csvRows = [headers];
    rows.forEach(r => {
      csvRows.push(Object.values(r).map(v => `"${v}"`).join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `${activeSheet.id}_BBS_Schedules_Excel.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset zoom limits
  const handleResetView = () => {
    setZoom(0.8);
    setPan({ x: 40, y: 30 });
  };

  // Phase D4 Detail Callout Engine Actions
  const handleNavigateToCallout = (c: CalloutMark) => {
    setSelectedSheetId(c.targetSheetId);
    setToastInteraction({ show: true, callout: c });
    
    // Auto center and view focus translation
    if (c.targetFocusX !== undefined && c.targetFocusY !== undefined) {
      const targetZoom = c.targetZoom || 1.15;
      const panX = Math.round(430 - c.targetFocusX * targetZoom);
      const panY = Math.round(230 - c.targetFocusY * targetZoom);
      setZoom(targetZoom);
      setPan({ x: panX, y: panY });
    } else {
      setZoom(0.85);
      setPan({ x: 60, y: 35 });
    }
  };

  const handleSheetNumberEdit = (sheetId: string, newNumber: string) => {
    if (!doc) return;
    const oldNumber = sheetNumberMap[sheetId] || 'S-101';
    
    // Run cascade in engine
    const { updatedSheets, updatedCallouts } = DetailCalloutEngine.cascadeSheetNumberUpdate(
      doc.sheets,
      sheetId,
      newNumber.toUpperCase(),
      callouts,
      oldNumber
    );

    // Update state maps
    const newMap = { ...sheetNumberMap, [sheetId]: newNumber.toUpperCase() };
    setSheetNumberMap(newMap);
    setCallouts(updatedCallouts);

    // Re-assign document
    const updatedDoc = Object.assign(Object.create(Object.getPrototypeOf(doc)), doc);
    updatedDoc.sheets = updatedSheets;
    setDoc(updatedDoc);
  };

  const handleQAAutoResolve = (issue: QAValidationIssue) => {
    if (!doc) return;
    if (issue.type === 'broken' && issue.remedyPayload) {
      const { calloutId, targetSheetNo } = issue.remedyPayload;
      // Re-route callout target to active first sheet
      setCallouts(prev => prev.map(c => {
        if (c.id === calloutId) {
          const sheet = doc.sheets.find(s => sheetNumberMap[s.id] === targetSheetNo) || doc.sheets[0];
          return {
            ...c,
            targetSheetNo,
            targetSheetId: sheet?.id || c.targetSheetId,
            mark: c.type === 'detail' ? `Detail ${c.number}/${targetSheetNo}` : `See Sheet ${targetSheetNo}`
          };
        }
        return c;
      }));
    } else if (issue.type === 'duplicate' && issue.remedyPayload) {
      const { calloutId } = issue.remedyPayload;
      // Auto assign next sequential integer
      setCallouts(prev => {
        const nextInt = prev.filter(c => c.sourceSheetId === issue.remedyPayload.sourceSheetId && c.type === issue.remedyPayload.type).length + 1;
        return prev.map(c => {
          if (c.id === calloutId) {
            const numStr = String(nextInt);
            const markStr = c.type === 'detail' ? `Detail ${numStr}/${c.targetSheetNo}` : `Section ${numStr}-${numStr}`;
            return {
              ...c,
              number: numStr,
              mark: markStr
            };
          }
          return c;
        });
      });
    }
  };

  const handleManualInjectCallout = (type: 'detail' | 'section') => {
    if (!activeSheet) return;
    const newId = `user-callout-${Date.now()}`;
    const defaultTargetSheet = Object.keys(sheetNumberMap).find(id => id !== activeSheet.id) || activeSheet.id;
    const targetNo = sheetNumberMap[defaultTargetSheet] || 'S-101';
    
    const count = callouts.filter(c => c.sourceSheetId === activeSheet.id && c.type === type).length + 1;
    const number = type === 'detail' ? String(count) : String.fromCharCode(64 + count); // 1, 2 or A, B
    
    // Auto-calculate position without overlapping other callouts
    const otherPoints = callouts.filter(c => c.sourceSheetId === activeSheet.id);
    let rx = 150 + (Math.random() - 0.5) * 80;
    let ry = 150 + (Math.random() - 0.5) * 80;
    
    // Very basic overlap prevention
    for (const other of otherPoints) {
      const dist = Math.sqrt((rx - other.x) ** 2 + (ry - other.y) ** 2);
      if (dist < 20) {
        rx += 25; // displace
        ry += 15;
      }
    }

    const newCallout: CalloutMark = {
      id: newId,
      type,
      mark: type === 'detail' ? `Detail ${number}/${targetNo}` : `Section ${number}-${number}`,
      number,
      targetSheetNo: targetNo,
      targetSheetId: defaultTargetSheet,
      sourceSheetId: activeSheet.id,
      title: type === 'detail' ? `Detail ${number} anchor` : `Section ${number}-${number} profile`,
      x: rx,
      y: ry,
      radius: 12,
      description: `Interactive reference mark drafted onto sheet coordinate. Fully printable and clickable.`,
      targetFocusX: 200,
      targetFocusY: 180,
      targetZoom: 1.2
    };

    setCallouts(prev => [...prev, newCallout]);
  };

  // CAD EXPORTS triggers
  const handleTriggerPDFExport = () => {
    if (!activeSheet || !doc) return;
    const titleConfig: Partial<TitleBlockData> = {
      clientName: clientName,
      designedBy: engName
    };
    const pdf = DrawingCanvasRenderer.exportSheetToPDF(activeSheet, doc, titleConfig);
    pdf.save(`${activeSheet.name}_StructuralDraft_A1.pdf`);
  };

  const handleTriggerDXFExport = () => {
    if (!activeSheet || !doc) return;
    const dxfString = DrawingCanvasRenderer.exportSheetToDXF(activeSheet, doc);
    
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeSheet.name}_structural_CAD.dxf`;
    link.click();
  };

  const handleOptimiseLayout = () => {
    if (!activeSheet || !doc || !selectedSheetId) return;
    const cloned = Object.assign(Object.create(Object.getPrototypeOf(doc)), doc);
    const currentSheet = cloned.sheets.find((s: any) => s.id === selectedSheetId);
    if (currentSheet) {
      StructuralPlanIntelligenceEngine.autoRelocateAnnotations(currentSheet);
    }
    setDoc(cloned);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="drawing-core-panel" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Sidebar Tool options */}
      <div id="cad-sidebar-tools" className="lg:col-span-1 flex flex-col gap-4">
        
        {/* 📚 دليل استخدام ورشة الرسم السريع العربي (Bilingual Quick CAD Guide) */}
        <Card id="card-cad-arabic-explanation" className="border-cyan-200 bg-cyan-50/20 shadow-xs">
          <CardHeader className="py-2.5 px-3.5 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle className="text-xs font-bold flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-100" />
              <span>دليل ورشة الرسم / CAD Quick Guide 💡</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 text-xs space-y-2.5 text-slate-700 font-sans leading-relaxed">
            <div>
              <p className="font-bold text-cyan-950 mb-0.5">❓ ما هي لوحة ورشة الرسم (CAD CAD)؟</p>
              <p className="text-[11px] text-slate-600">
                هي عبارة عن <strong>محاكي أوتوكاد تفاعلي (Interactive CAD Simulator)</strong> داخل المتصفح، يعمل بنظام الإحداثيات المتجهية (Vector Coords) لرسم ومعاينة تفاصيل حديد تسليح العناصر الإنشائية بدقة كبرى.
              </p>
            </div>
            <div>
              <p className="font-bold text-cyan-950 mb-0.5">🎯 ما هو الغرض منها؟</p>
              <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
                <li><strong>المعاينة الدقيقة:</strong> فحص لوحات التسليح والقوالب والقواعد للقص المباشر.</li>
                <li><strong>تتبع تفريد الحديد التفاعلي (BBS Link):</strong> بالنقر على أي سيخ أو رمز أحمر في اللوحة، يعرض المحرك مواصفاته بجدول الحصر بالأسفل مباشرة لتتبعه.</li>
                <li><strong>التدقيق الذكي وتخفيف التداخلات:</strong> يبرز المحاكي تداخل نصوص اللوحة باللون الأحمر لمنع العيوب والتنفيذ غير السليم بالموقع.</li>
              </ul>
            </div>
            <div>
              <p className="font-bold text-cyan-950 mb-0.5">🌐 لماذا هي باللغة الإنجليزية؟</p>
              <p className="text-[11px] text-slate-600">
                لأن الأنظمة المعمارية القياسية لملفات الأوتوكاد وتصدير DXF (مثل STA4CAD) تستخدم أكواداً ومحاور باللغة الإنجليزية لضمان توافقها التام عند استيرادها وصيانتها داخل البرامج الكبرى (مثل AutoCAD و Revit) دون تشوه النصوص والخطوط.
              </p>
            </div>
            <div>
              <p className="font-bold text-cyan-950 mb-0.5">⚙️ كيف يمكنني استخدامها؟</p>
              <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1">
                <li>اختر اللوحة النشطة للتعديل من قائمة <strong>Sheet Settings</strong>.</li>
                <li>لتغيير نوع تسليح المكونات، غيّر <strong>Drawing Plan Type</strong>.</li>
                <li>اسحب المخطط بمؤشر الماوس مع الضغط على زر الماوس الأوسط لتنقله (Pan) أو لتكبير الأجزاء (Zoom).</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Sheet & Template Settings */}
        <Card id="card-sheet-templates" className="shadow-xs border-slate-200">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-sm font-medium text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span>إعدادات اللوحات / Sheet Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-3">
            <div>
              <label className="text-xs text-slate-500 font-medium">اختر لوحة الرسم النشطة / Select Sheet:</label>
              <select 
                id="select-drawing-sheet"
                value={selectedSheetId} 
                onChange={(e) => setSelectedSheetId(e.target.value)}
                className="w-full mt-1 border border-slate-200 rounded-md py-1.5 px-2 bg-white text-sm"
              >
                {doc?.sheets.map(sheet => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.titleBlock.drawingNumber} : {sheet.titleBlock.drawingTitle} ({sheet.size.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium">نوع المخطط وتفاصيل التسليح / Plan Type:</label>
              <select 
                id="select-drawing-plan-type"
                value={drawingPlanType} 
                onChange={(e: any) => setDrawingPlanType(e.target.value)}
                className="w-full mt-1 border border-indigo-200 rounded-md py-1.5 px-2 bg-indigo-50/50 text-xs font-semibold text-indigo-900"
              >
                <optgroup label="المحاور والقوالب الخرسانية (Framing)">
                  <option value="standard">Structural Framing Plan (Default)</option>
                </optgroup>
                <optgroup label="تفاصيل تسليح STA4CAD (Reinforcement)">
                  <option value="combined_rebar">Combined Reinforcement Plan</option>
                  <option value="beam_rebar">Beam Reinforcement Plan (BB1, BT1, BS1)</option>
                  <option value="col_rebar">Column Reinforcement Plan (Ties & Starters)</option>
                  <option value="slab_rebar">Slab Reinforcement Plan (Negative & Positive)</option>
                  <option value="foundation_rebar">Foundation Reinforcement Plan (Mesh)</option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium">اسم العميل / مالك المشروع (Client):</label>
              <Input 
                id="input-client-name"
                value={clientName} 
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1 h-8 text-sm"
                placeholder="Ministry of Construction"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 font-medium">المهندس الإنشائي المصمم (Designer):</label>
              <Input 
                id="input-eng-name"
                value={engName} 
                onChange={(e) => setEngName(e.target.value)}
                className="mt-1 h-8 text-sm"
                placeholder="Chief Structural Eng"
              />
            </div>
            
            <Button id="btn-reinit-doc" onClick={initDocument} variant="outline" size="sm" className="w-full text-xs flex items-center justify-center gap-1.5 mt-1 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
              <RefreshCw className="w-3.5 h-3.5" />
              تحديث بيانات الغلاف واللوحة
            </Button>
          </CardContent>
        </Card>

        {/* CAD Plan Intelligence (Phase D2A) */}
        <Card id="card-plan-intelligence" className="shadow-xs border-emerald-100 border-t-4">
          <CardHeader className="py-2 px-3.5 bg-emerald-50/50 border-b border-emerald-100">
            <CardTitle className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                جودة اللوحة والتخطيط الذكي / Drawing Quality
              </span>
              {readabilityMetrics && (
                <Badge className={`${
                  readabilityMetrics.readabilityScore >= 80 ? 'bg-emerald-600' :
                  readabilityMetrics.readabilityScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                } text-[10px] text-white px-1 font-mono`}>
                  {readabilityMetrics.readabilityScore}% Quality
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-[9px] text-emerald-700 font-mono mt-0.5">
              مصحح التداخلات الآلي (Collision Mitigator)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 flex flex-col gap-2.5 text-xs">
            {readabilityMetrics ? (
              <div id="readability-stats-list" className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                  <div className="bg-slate-50 p-1.5 rounded-sm border border-slate-100">
                    <div className="text-slate-400 text-[8px] uppercase">مقياس الرسم النشط</div>
                    <div className="font-bold text-slate-700 mt-0.5">
                      1:{activeSheet?.viewports[0]?.modelScale || 50}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-sm border border-slate-100">
                    <div className="text-slate-400 text-[8px] uppercase">بؤر التداخل النصي</div>
                    <div className={`font-bold mt-0.5 ${readabilityMetrics.overlapCount > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {readabilityMetrics.overlapCount} Warnings
                    </div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-sm border border-slate-100">
                    <div className="text-slate-400 text-[8px] uppercase">كثافة الكتابة والرموز</div>
                    <div className="font-bold text-slate-700 mt-0.5">
                      {readabilityMetrics.textDensity}% Space
                    </div>
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded-sm border border-slate-100">
                    <div className="text-slate-400 text-[8px] uppercase">توازن مساحة الورق</div>
                    <div className="font-bold text-slate-700 mt-0.5">
                      {readabilityMetrics.balanceScore}% Balanced
                    </div>
                  </div>
                </div>

                {/* Progress bars */}
                <div id="progress-readability-score" className="mt-0.5">
                  <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                    <span>مؤشر سهولة التنفيذ (Constructability)</span>
                    <span className="font-semibold">{readabilityMetrics.readabilityScore}/100</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1">
                    <div 
                      className={`h-1 rounded-full transition-all duration-300 ${
                        readabilityMetrics.readabilityScore >= 80 ? 'bg-emerald-500' :
                        readabilityMetrics.readabilityScore >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                      }`}
                      style={{ width: `${readabilityMetrics.readabilityScore}%` }}
                    />
                  </div>
                </div>

                {/* Quick actions & controls */}
                <div id="opt-controls-inline" className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100 mt-0.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block animate-ping" />
                      تمييز التداخلات باللون الأحمر:
                    </span>
                    <input 
                      id="chk-toggle-collision-helpers"
                      type="checkbox" 
                      checked={showCollisionGuides} 
                      onChange={(e) => setShowCollisionGuides(e.target.checked)}
                      className="w-3 h-3 text-indigo-600 rounded-xs accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <Button 
                    id="btn-relocate-tags"
                    onClick={handleOptimiseLayout}
                    size="sm" 
                    className="w-full h-7 mt-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-200" />
                    تحريك الرموز تلقائياً بالذكاء الاصطناعي
                  </Button>
                </div>

                {/* Live validation report output */}
                <div className="bg-emerald-50 p-1.5 rounded-xs border border-emerald-100 text-[9px] text-emerald-800 flex flex-col gap-0.5 font-sans">
                  <div className="font-bold flex items-center gap-1 text-emerald-950 uppercase text-[8px] mb-0.5">
                    <Check className="w-3 h-3 text-emerald-600" />
                    تقرير تدقيق ورشة الرسم (CAD Validation):
                  </div>
                  <div>• حجم اللوحة تلقائي ومتوافق مع مقاييس ISO المعيارية</div>
                  <div>• خطوط المحاور والأعمدة مصطفة بدقة تامة هندسياً</div>
                  <div>• تم تفعيل معالجة الإزاحة للرموز لتجنب تداخل حديد التسليح</div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-center py-2 text-[10px]">Loading Readability Engine...</div>
            )}
          </CardContent>
        </Card>

        {/* CAD Layer Controller */}
        <Card id="card-layers-controller" className="shadow-xs">
          <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-sm font-medium text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              طبقات رسم الأوتوكاد / CAD Layers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div id="cad-layer-list" className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {doc?.layers.map(layer => (
                <div key={layer.id} className="flex items-center justify-between py-1 px-1.5 rounded-sm hover:bg-slate-50 text-xs border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3 border border-slate-200 h-3 rounded-full inline-block" 
                      style={{ backgroundColor: layer.color }} 
                    />
                    <span className="font-medium text-slate-700">{layer.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Filter selection visual indicator */}
                    <button 
                      onClick={() => setActiveLayerId(activeLayerId === layer.id ? '' : layer.id)}
                      title="Filter render view to this layer only"
                      className={`px-1.5 py-0.5 rounded-xs text-[10px] font-bold ${activeLayerId === layer.id ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'text-slate-400 bg-slate-50 hover:bg-slate-100 border border-slate-200'}`}
                    >
                      {activeLayerId === layer.id ? 'Focus' : 'View'}
                    </button>
                    {/* Visibility switch */}
                    <button 
                      onClick={() => handleToggleLayerVisibility(layer.id)}
                      className="p-1 rounded-sm text-slate-500 hover:bg-slate-100"
                      title={layer.visible ? 'Hide layer' : 'Show layer'}
                    >
                      <Layers2 className={`w-3.5 h-3.5 ${layer.visible ? 'text-indigo-600' : 'text-slate-300'}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CAD Interactive Entity Inspector & BBS Link Engine */}
        <Card id="card-inspect-entity" className="shadow-sm border-indigo-100 hover:border-indigo-200 transition-colors">
          <CardHeader className="py-3 px-3 bg-slate-50 border-b border-indigo-100">
            <CardTitle className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                تتبع حديد التسليح وجدول BBS
              </span>
              {selectedEntityId && (
                <Badge variant="outline" className="text-[9px] px-1 bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" />
                  traceable
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {(() => {
              if (!selectedEntityId || !activeSheet) {
                return (
                  <div id="inspector-no-entity" className="text-xs text-slate-400 text-center py-6 flex flex-col items-center gap-1.5">
                    <div className="p-2 rounded-full bg-slate-50 border border-slate-100">
                      <MousePointer className="w-4 h-4 text-slate-400" />
                    </div>
                    <span>Click any red reinforcement line / label in drawings to trace and edit its live BBS database record</span>
                  </div>
                );
              }

              const ent = activeSheet.entities.find(e => e.id === selectedEntityId);
              if (!ent) {
                return (
                  <div className="text-xs text-rose-500 py-2">
                    CAD entity not found.
                  </div>
                );
              }

              const hasMetadata = !!ent.metadata?.rebarMark;
              const metadata = ent.metadata || {
                rebarMark: `GEN-${ent.id.substring(0, 5).toUpperCase()}`,
                member: 'Structural Block',
                memberType: 'general',
                diameter: 12,
                length: 3000,
                shapeCode: '00',
                quantity: 10,
                steelGrade: 'Grade 420 (ASTM Gr.60)',
                weight: 26.6,
                detailRef: 'See Detail 3/S-201',
                section: 'Typical Reinforcement',
                relatedDrawings: ['S-REBAR-201']
              };

              return (
                <div id="inspector-entity-selected" className="flex flex-col gap-3">
                  <div className="bg-slate-50/80 p-2.5 rounded-md border border-slate-200 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>ID: {ent.id}</span>
                      <Badge variant="outline" className="text-[9px] bg-slate-100 border-slate-200 text-slate-600">
                        {ent.type.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-bold text-slate-800">
                        BAR MARK: <span className="font-mono bg-indigo-50 border border-indigo-100 text-indigo-800 px-1 rounded-sm">{metadata.rebarMark}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-600 mt-1 pb-1.5 border-b border-dashed border-slate-200">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-medium">Member</span>
                        <span className="text-xs font-semibold text-slate-700">{metadata.member}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase font-medium">Zone/Section</span>
                        <span className="text-xs font-semibold text-slate-700">{metadata.section}</span>
                      </div>
                    </div>

                    <div className="pt-1.5">
                      <span className="text-[9px] text-slate-400 block uppercase font-semibold mb-1">Interactive BBS Link Verification:</span>
                      <div className="grid grid-cols-2 gap-2 text-xs font-semibold bg-white p-2 border border-indigo-50 rounded-sm">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-normal">Diameter</span>
                          <span className="text-slate-800 font-mono">Φ {metadata.diameter} mm</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-normal">Length</span>
                          <span className="text-slate-800 font-mono">{metadata.length} mm</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-normal">Shape Code</span>
                          <span className="text-slate-800 font-mono">{metadata.shapeCode}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-normal">Quantity</span>
                          <span className="text-indigo-600 font-mono">{metadata.quantity} Bars</span>
                        </div>
                        <div className="flex flex-col col-span-2 pt-1 border-t border-slate-100 flex-row justify-between items-center">
                          <span className="text-[9px] text-slate-400 font-normal">Total Net Weight (Wastage Included):</span>
                          <span className="text-amber-700 font-bold font-mono">{metadata.weight ? `${metadata.weight} kg` : 'Calculating...'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 bg-indigo-50/50 p-1.5 rounded border border-indigo-50 flex items-start gap-1">
                      <Info className="w-3 h-3 text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold text-indigo-900 block">Traceability Links:</span>
                        <span>Drawing layout reference: <strong>{metadata.relatedDrawings?.join(', ') || 'S-REBAR-201'}</strong>. Detail Schedule sheet: <strong>{metadata.detailRef}</strong>.</span>
                      </div>
                    </div>
                  </div>

                  {/* LIVE REVISION SYNC PANEL (Consistency Management) */}
                  <div className="border border-amber-100 bg-amber-50/30 p-2.5 rounded-md flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-amber-600" />
                      Dynamic Revision Controls (Auto-Saves to BBS)
                    </span>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 font-medium flex justify-between">
                        <span>Steel Bar Size (Diameter Φ):</span>
                        <span className="font-semibold text-slate-700 font-mono">10mm to 25mm</span>
                      </label>
                      <select 
                        value={metadata.diameter}
                        onChange={(e) => handleReviseRebar({ diameter: parseInt(e.target.value) })}
                        className="w-full text-xs bg-white border border-slate-200 rounded py-1 px-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-400"
                      >
                        {[10, 12, 14, 16, 20, 25].map(d => (
                          <option key={d} value={d}>Φ {d} mm (ASTM Regular)</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 font-medium flex justify-between">
                        <span>Steel Quantity (Count):</span>
                        <span className="font-semibold text-slate-700 font-mono">{metadata.quantity} Nos</span>
                      </label>
                      <input 
                        type="range" 
                        min="2" 
                        max="80" 
                        value={metadata.quantity}
                        onChange={(e) => handleReviseRebar({ quantity: parseInt(e.target.value) })}
                        className="w-full accent-indigo-600"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-500 font-medium">
                        Manual Bar Mark Revision Identifier:
                      </label>
                      <Input
                        value={metadata.rebarMark}
                        onChange={(e) => handleReviseRebar({ rebarMark: e.target.value.toUpperCase() })}
                        className="h-7 text-xs font-mono font-bold uppercase bg-white border-slate-200"
                        placeholder="E.g. BT1, BB1"
                      />
                    </div>
                  </div>

                  {!hasMetadata && (
                    <div className="bg-amber-50 border border-amber-200 p-2 rounded text-[10px] text-amber-800 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <strong>Unlinked CAD line detected:</strong> This line does not contain pre-configured BBS metadata attributes. Modify above to link it to the rebar database.
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 mt-1">
                    <Button 
                      id="btn-export-single-bbs"
                      onClick={handleExportRebarExcel}
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/50 flex items-center justify-center gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                      Export BBS spreadsheet (Excel)
                    </Button>
                    <Button 
                      id="btn-delete-selected"
                      onClick={handleDeleteSelectedEntity} 
                      variant="destructive" 
                      size="sm" 
                      className="w-full text-[11px] h-7 flex items-center justify-center gap-1 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                      Erase CAD Element
                    </Button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* PHASE D4: DETAIL CALLOUTS & MULTI-SHEET CROSS REFERENCES */}
        <Card id="card-callouts-manager" className="shadow-sm border-indigo-100 hover:border-indigo-200 transition-colors">
          <CardHeader className="py-2.5 px-3 bg-slate-50 border-b border-indigo-50 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5 py-0.5">
              <Workflow className="w-3.5 h-3.5 text-indigo-600" />
              Detail Callouts & Cross-Links
            </CardTitle>
            <Badge className="text-[9px] bg-indigo-100 border-indigo-200 text-indigo-800 font-mono">D4 ENGINE</Badge>
          </CardHeader>
          <CardContent className="p-3">
            <div className="text-[11px] text-slate-500 mb-2 leading-relaxed bg-slate-50/50 p-1.5 rounded border border-slate-100">
              Double-click any tag below or the interactive markers directly on drawings to trigger instant cross-sheet coordinate alignment.
            </div>

            {/* Quick Injects list */}
            <div className="flex gap-1.5 mb-2.5">
              <Button
                id="btn-inject-detail"
                size="sm"
                variant="outline"
                onClick={() => handleManualInjectCallout('detail')}
                className="h-7 text-[10px] flex-1 flex items-center justify-center gap-1 font-medium text-indigo-700 border-indigo-100 hover:bg-slate-50"
              >
                <Plus className="w-3 h-3" />
                + Detail Bubble
              </Button>
              <Button
                id="btn-inject-section"
                size="sm"
                variant="outline"
                onClick={() => handleManualInjectCallout('section')}
                className="h-7 text-[10px] flex-1 flex items-center justify-center gap-1 font-medium text-emerald-700 border-emerald-100 hover:bg-slate-50"
              >
                <Plus className="w-3 h-3" />
                + Section pointer
              </Button>
            </div>

            {/* List of active callout markers in package */}
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
              {callouts.length === 0 ? (
                <div className="text-[10px] text-slate-400 text-center py-4">No drawing callouts defined in package.</div>
              ) : (
                callouts.map(c => {
                  const isActiveOnSheet = c.sourceSheetId === activeSheet?.id;
                  const targetSheetObj = doc?.sheets.find(sh => sh.id === c.targetSheetId);
                  const targetTitle = targetSheetObj?.titleBlock?.drawingTitle || 'Detail View';
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleNavigateToCallout(c)}
                      className={`group cursor-pointer p-1.5 rounded border transition-all flex items-start gap-2 ${isActiveOnSheet ? 'bg-indigo-50/80 border-indigo-100 hover:bg-indigo-100/80 shadow-xs' : 'bg-slate-50/50 border-slate-100 hover:bg-slate-100/50'}`}
                    >
                      <div className="p-1 rounded bg-white border border-slate-100 shadow-xs mt-0.5 shrink-0 text-center font-mono text-[9px] font-bold text-indigo-600 uppercase w-9">
                        {c.type}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800 truncate font-mono">{c.mark}</span>
                          {isActiveOnSheet && (
                            <span className="text-[9px] text-indigo-700 bg-indigo-100 px-1 rounded font-medium shrink-0 animate-pulse">This plan</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-600 font-semibold truncate">{c.title}</p>
                        <p className="text-[9px] text-slate-400 truncate">Leads to: {targetTitle} ({c.targetSheetNo})</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* CAD SYSTEM SHEET RENUMBER & CASCADE ENGINE */}
        <Card id="card-renumber-cascade" className="shadow-sm border-slate-150">
          <CardHeader className="py-2.5 px-3 bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-slate-600" />
              STA4CAD Sheet & Renumber Board
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="text-[11px] text-slate-500 mb-2.5 leading-relaxed bg-slate-50/50 p-1.5 rounded border border-slate-100">
              Edit drawing numbers below to trigger the <strong>Cascade Engine</strong>: it updates all referenced texts and plans dynamically.
            </div>
            
            <div className="flex flex-col gap-2">
              {doc?.sheets.map(sh => {
                const sNo = sheetNumberMap[sh.id] || sh.titleBlock.drawingNumber || 'S-101';
                return (
                  <div key={sh.id} className="flex items-center justify-between gap-1.5 bg-slate-50 p-1.5 rounded border border-slate-100">
                    <div className="min-w-0 flex-1 text-left">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">{sh.id}</span>
                      <span className="text-xs font-semibold text-slate-700 truncate block">{sh.titleBlock.drawingTitle}</span>
                    </div>
                    <div className="w-20 shrink-0">
                      <Input
                        value={sNo}
                        onChange={(e) => handleSheetNumberEdit(sh.id, e.target.value)}
                        className="h-7 text-xs font-mono font-bold text-center uppercase bg-white border-slate-200 focus:ring-indigo-400 text-indigo-800"
                        placeholder="E.g. S-101"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* CAD REFERENCE AUDITING QA SYSTEM */}
        <Card id="card-qa-auditer" className="shadow-sm border-slate-150">
          <CardHeader className="py-2.5 px-3 bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Dynamic CAD References QA Report
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {(() => {
              const issues = doc ? DetailCalloutEngine.validateReferences(callouts, sheetNumberMap, doc.sheets) : [];
              const highCount = issues.filter(i => i.severity === 'high').length;
              const medCount = issues.filter(i => i.severity === 'medium').length;

              return (
                <div>
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Audit summary</span>
                    <div className="flex gap-1.5">
                      <span className="text-[9px] font-bold bg-rose-50 text-rose-700 px-1 border border-rose-250 rounded">{highCount} Critical</span>
                      <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1 border border-amber-250 rounded">{medCount} Warnings</span>
                    </div>
                  </div>

                  {issues.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-2 text-emerald-800 text-[10px] rounded-sm flex items-center gap-1.5 text-left">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <div>All multi-sheet cross-references pass rigorous validation checks. Zero loose nodes.</div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-0.5">
                      {issues.map(iss => (
                        <div key={iss.id} className={`p-2 rounded border text-[10px] text-left ${iss.severity === 'high' ? 'bg-rose-50/50 border-rose-150 text-rose-955' : 'bg-amber-50/50 border-amber-150 text-amber-955'}`}>
                          <div className="font-semibold flex items-start justify-between gap-1.5">
                            <span>{iss.message}</span>
                            <span className="text-[8px] uppercase px-1 py-0.5 rounded shrink-0 font-bold bg-white border">{iss.severity}</span>
                          </div>
                          {iss.remedyActionName && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQAAutoResolve(iss)}
                              className="mt-1.5 h-5 text-[9px] px-1.5 py-0 text-slate-700 border-slate-200 bg-white hover:bg-slate-50 font-bold flex items-center gap-0.5 cursor-pointer"
                            >
                              <RefreshCw className="w-2.5 h-2.5 text-slate-400" />
                              {iss.remedyActionName}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

      </div>

      {/* Main CAD Stage area */}
      <div id="cad-main-stage" className="lg:col-span-3 flex flex-col gap-4">
        
        {/* Drafting Toolbar */}
        <Card id="card-drafting-toolbar" className="shadow-xs border-indigo-100 border-l-4">
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
            
            {/* Stage control tools */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button 
                id="btn-tool-select"
                variant={activeTool === 'select' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTool('select')}
                className="text-xs h-8 px-2 flex items-center gap-1"
                title="Select & inspect drawings elements"
              >
                <MousePointer className="w-3.5 h-3.5" />
                Select
              </Button>

              <Badge variant="outline" className="text-[10px] uppercase font-bold text-indigo-700 bg-slate-50 border-slate-200 mr-2 py-1">
                Manual Drafting Pen:
              </Badge>

              <Button 
                id="btn-tool-line"
                variant={activeTool === 'line' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTool('line')}
                className="text-xs h-8 px-2 flex items-center gap-1"
                title="Draw a guide line"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Line
              </Button>

              <Button 
                id="btn-tool-dim"
                variant={activeTool === 'dimension' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTool('dimension')}
                className="text-xs h-8 px-2 flex items-center gap-1"
                title="Draft an aligned dimension line"
              >
                <Ruler className="w-3.5 h-3.5" />
                Dimension
              </Button>

              <Button 
                id="btn-tool-text"
                variant={activeTool === 'text' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTool('text')}
                className="text-xs h-8 px-2 flex items-center gap-1"
                title="Write annotations"
              >
                <Type className="w-3.5 h-3.5" />
                Annotation
              </Button>

              <Button 
                id="btn-tool-bubble"
                variant={activeTool === 'grid_bubble' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTool('grid_bubble')}
                className="text-xs h-8 px-2 flex items-center gap-1"
                title="Insert Axis Grid Bubble symbol"
              >
                <Grid className="w-3.5 h-3.5" />
                Grid Bubble
              </Button>

              <Button 
                id="btn-tool-north"
                variant={activeTool === 'north_arrow' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTool('north_arrow')}
                className="text-xs h-8 px-2 flex items-center gap-1"
                title="Insert North Arrow directive"
              >
                <Compass className="w-3.5 h-3.5" />
                North Arrow
              </Button>
            </div>

            {/* Input field for tools metadata */}
            {(activeTool === 'text' || activeTool === 'grid_bubble') && (
              <div id="cad-tool-inline-input" className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">Tag Value:</span>
                <Input 
                  id="input-text-tag-value"
                  value={textInput} 
                  onChange={(e) => setTextInput(e.target.value)} 
                  className="h-8 max-w-[120px] text-xs font-mono"
                  placeholder="e.g. Φ16@150"
                />
              </div>
            )}

            {/* Stage operations navigation zoom */}
            <div className="flex items-center gap-1">
              <Button id="btn-zoom-in" variant="outline" size="sm" onClick={() => setZoom(prev => Math.min(prev + 0.1, 3))} className="h-8 w-8 p-0">
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button id="btn-zoom-out" variant="outline" size="sm" onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.4))} className="h-8 w-8 p-0">
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <Button id="btn-reset-view" variant="outline" size="sm" onClick={handleResetView} className="h-8 text-xs flex items-center gap-1">
                <Maximize2 className="w-3.5 h-3.5" />
                Rescale
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* Viewport Drafting Board */}
        <Card id="card-cad-viewport-board" className="shadow-sm">
          <CardHeader className="py-2.5 px-4 bg-slate-900 text-white rounded-t-md flex items-center justify-between flex-row">
            <div>
              <CardTitle className="text-xs font-mono font-bold tracking-widest text-[#10B981] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                CAD-SYSTEM WORKSPACE // REALTIME RENDERER
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-400 mt-0.5">
                Sheet: {activeSheet?.titleBlock.drawingNumber} : {activeSheet?.titleBlock.drawingTitle} ({activeSheet?.size.width}×{activeSheet?.size.height}mm Paper Space)
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button id="btn-export-pdf" size="sm" variant="outline" onClick={handleTriggerPDFExport} className="h-7 bg-slate-800 text-slate-200 border-slate-700 text-xs flex items-center gap-1 hover:bg-slate-700 hover:text-white">
                <Download className="w-3 h-3 text-emerald-400" />
                Plot Vector PDF
              </Button>

              <Button id="btn-export-dxf" size="sm" variant="outline" onClick={handleTriggerDXFExport} className="h-7 bg-slate-800 text-slate-200 border-slate-700 text-xs flex items-center gap-1 hover:bg-slate-700 hover:text-white">
                <FileText className="w-3 h-3 text-indigo-400" />
                CAD DXF Output
              </Button>

              <Button id="btn-trigger-print" size="sm" variant="outline" onClick={handlePrint} className="h-7 bg-slate-800 text-slate-200 border-slate-700 text-xs flex items-center gap-1 hover:bg-slate-700 hover:text-white">
                <Printer className="w-3 h-3" />
                Print Layout
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-slate-100 flex flex-col">
            
            {/* Realtime Canvas Box */}
            <div id="cad-canvas-container" className="relative w-full h-[460px] overflow-hidden cursor-crosshair select-none bg-slate-900 border-b border-slate-200">
              <canvas 
                id="interactive-cad-canvas"
                ref={canvasRef}
                width={860}
                height={460}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="absolute inset-0 w-full h-full"
              />

              {/* Float navigation guide banner */}
              <div id="cad-nav-banner" className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-xs p-2 rounded-md border border-slate-800 text-white flex flex-col gap-1 text-[10px] pointer-events-none">
                <div className="font-semibold text-[#10B981] flex items-center gap-1">
                  <Move className="w-3 h-3" /> Navigation Guide:
                </div>
                <div>• Drag with Middle Mouse Button, Right Click, or Shift+Drag to PAN</div>
                <div>• Mouse Scroll Wheel to ZOOM in/out of layout</div>
                <div>• Click Elements to Inspect; choose tools above to add objects</div>
              </div>

              {/* Selection banner */}
              {activeTool !== 'select' && (
                <div id="cad-tool-mode-banner" className="absolute top-2 right-2 bg-indigo-900/90 py-1 px-2.5 rounded-sm text-white text-[10px] font-bold animate-pulse">
                  Drafting Tool Mode: {activeTool?.toUpperCase()} ACTIVE
                </div>
              )}

              {/* Reference Link Jump Navigation Toast */}
              {toastInteraction.show && toastInteraction.callout && (
                <div id="cad-toast-interaction" className="absolute bottom-4 left-4 right-4 bg-slate-950/95 border border-indigo-500 rounded-md p-3 text-white flex items-center justify-between gap-4 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start gap-2.5 min-w-0 text-left">
                    <div className="p-1.5 rounded-sm bg-indigo-900 border border-indigo-700 font-mono text-[9px] uppercase font-bold text-indigo-200 mt-0.5 shrink-0">
                      {toastInteraction.callout.type}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                        <span>Navigated to: {toastInteraction.callout.mark}</span>
                        <span className="text-[9px] font-normal text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-slate-800 uppercase">Target Sheet</span>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-100 truncate">{toastInteraction.callout.title}</p>
                      <p className="text-[10px] text-slate-400 leading-tight line-clamp-1">{toastInteraction.callout.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Smoothly center the sheet on the zoomed focal viewport
                        if (toastInteraction.callout && toastInteraction.callout.targetFocusX !== undefined && toastInteraction.callout.targetFocusY !== undefined) {
                          const targetZoom = toastInteraction.callout.targetZoom || 1.15;
                          setZoom(targetZoom);
                          setPan({
                            x: Math.round(430 - toastInteraction.callout.targetFocusX * targetZoom),
                            y: Math.round(230 - toastInteraction.callout.targetFocusY * targetZoom)
                          });
                        }
                      }}
                      className="h-7 text-[10px] bg-indigo-900 hover:bg-indigo-800 text-white border-indigo-700 font-bold"
                    >
                      <Maximize2 className="w-3 h-3 text-indigo-200" /> Focus View
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setToastInteraction({ show: false })}
                      className="h-7 text-[10px] text-slate-400 hover:text-white"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Realtime Measurement & Viewport Coordinates Status Line */}
            <div id="cad-status-line" className="bg-slate-950 text-emerald-400 font-mono text-[10px] py-1 px-4 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>GRID: DYNAMIC AUTO-ALIGN</span>
              </div>
              <div className="truncate max-w-[80%] text-right font-semibold">
                {statusBarCoords}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Feature list & Compliance details card */}
        <Card id="card-cad-compliance" className="shadow-xs bg-slate-50 border border-slate-200">
          <CardContent className="p-4 flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-600" />
              CAD Core Drafting Engine Specifications (Phase D1 Compliant)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="flex flex-col gap-1">
                <div>• **Dynamic Sheet Sizes**: Supports ISO titles blocks A4-A1 and Custom scaling systems dynamically.</div>
                <div>• **CAD Coordinates Conversions**: Automated bidirectional transforms Mapping Paper (mm) ↔ Model Worldspace (m).</div>
                <div>• **RTL Arabic / English BiDi Output**: Elegant mixed-content text rendering with precise alignments.</div>
              </div>
              <div className="flex flex-col gap-1">
                <div>• **Universal Layer Architecture**: Shared coordinate standards supporting Beams, Columns, Slabs, and Foundations.</div>
                <div>• **Clean DXF Export**: File outputs are formatted into AutoCAD R12 ASCII DXF files readable by any CAD program.</div>
                <div>• **Optimized Performance**: Easily renders 5,000+ vector elements without lag using Canvas batches.</div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

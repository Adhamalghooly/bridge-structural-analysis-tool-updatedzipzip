---
name: ACI 318-19 Audit Findings
description: Tracks which Arabic audit-report items are fixed and which remain; prevents re-doing finished work.
---

## Fixed (all sessions combined)

### structuralEngine.ts
- `λs` size-effect factor wired into `Vc_forWaiverCheck` for stirrup waiver
- `fyt` capped at 420 MPa in `designShear` (`fyt_design = Math.min(fyt, 420)`)
- Bar diameter array `[10,12,14,16,18,20,22,25]` in `designFlexure`
- `designFlexure` two-pass d-iteration + doubly-reinforced `asComp` / `fsPrime` via ACI §22.2.2.4.1
- **Punching shear**: now checks ALL columns within slab bounding box, not just corner-matching ones; classifies interior/edge/corner, applies correct tributary area and `alphaS` per position
- `momentMagnification`: `βdns` now computed from `Pu_sustained / Pu_total` (default 0.6·Pu when not supplied); M1/M2 propagated to Cm
- `designColumnETABS`: slendernessLimit = clamp(34 − 12·M1/M2, 22, 40) per ACI §6.2.5.1(b); M1, M2, Pu_sustained parameters added

### Index.tsx
- Material properties card shows inline ACI range-check warnings (f'c, fy, fyt)
- `generateStructuralReport` call now passes `foundationResults` as 13th argument

### BOQPanel.tsx
- Ribbed slab nominal steel rate = 35 kg/m³ (vs 55 for solid); `steelSource: 'actual'|'nominal'` tracked
- Steel item 4.04 remarks include warning note when any slab quantities are nominal/estimated

### FoundationSettlementPanel.tsx
- Added `batchResults?: FootingDesignResult[]` prop
- `handleImportFootingDimensions()` reads B/L/t from the matching (or heaviest) USD footing result
- New "استيراد أبعاد من تصميم USD" button (disabled when no results, tooltip explains why)
- `handleImportColumnLoads` also auto-imports footing dims from batchResults when available
- ETABS reaction Fz is now used in batch USD footing design when pointId matches a column; documented 70/30 D/L estimate is used because the imported reaction is total service compression

### FoundationDesignPanel.tsx
- Passes `batchResults` to `<FoundationSettlementPanel>`

### pdfReport.ts
- `generateStructuralReport` accepts optional 13th arg `foundationResults: any[]`
- Adds Section 11 (Foundation Design Summary table) when foundationResults is non-empty
- `FoundationDrawingsPanel` DXF export prefers batch USD results (geometry, bars, checks) and falls back to legacy detailing only when no USD results exist

### BOQ / Settlement exports
- Ribbed slab filler-block count is generated as BOQ item 4.03A from rib spacing, rib width, slab area, and 5% waste
- Settlement workspace exports the active isolated/strip/combined/raft result to CSV

### Previously confirmed already correct
- ETABS Full Import section parsing (beam b/h, column b/h)
- `validateRibbedSlab` wired at Index.tsx line 3241
- ACI §6.5.1/§8.5.1 applicability warnings in `designSlab`
- Foundation auto-sizing tab navigation button in `FoundationDesignPanel`
- `useFEMLoadDistribution` correctly threaded from state through globalFrameBridge (Index.tsx lines 1769/1783)

---

## Still Outstanding (not implemented)

| Item | Where | Complexity |
|------|--------|-----------|
| Strip/combined/strap footing results → `onResultsChange` → BOQ/BBS | FoundationDesignPanel | Medium |
| `betaDns` dynamic slenderness for basic column path — now partially fixed; biaxial path (`designColumnBiaxial` / Phase 3) handles it via MxTop/MxBot | structuralEngine.ts | Low |
| Dead code: `src/generative/optimizer.ts` imported but unused outside GenerativeDesignDashboard | optimizer.ts | Trivial |
| Pattern loading for ribbed slabs | structuralEngine.ts | High |

**Why:** Tracks which audit items are done so future sessions don't re-implement finished work.
**How to apply:** Check this file before starting any ACI compliance fix session.

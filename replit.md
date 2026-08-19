# Slab and Footing Designer — Structural Master Pro

## Project Overview
An advanced structural engineering web app for analysis, design, and detailing of RC structures per ACI 318-19. Features include:
- Slab, beam, and column design (one-way, two-way, ribbed slabs)
- Foundation design: isolated, strip, combined, strap footings
- 2D/3D frame analysis + FEM slab-beam coupled analysis
- ETABS import/comparison
- BOQ, reinforcement schedules, DXF/PDF export
- AI structural assistant (Gemini API)
- Capacitor/Android target

## Stack
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **UI**: Radix UI components (shadcn/ui pattern)
- **3D**: Three.js / @react-three/fiber
- **Analysis**: Custom FEM engine in TypeScript (src/slabFEMEngine/, src/lib/)
- **Mobile**: Capacitor (Android)

## Run
```
npm run dev   # starts on port 3000
```

## Environment
- `GEMINI_API_KEY` required for AI assistant features (set in .env.local)

## Architecture Notes
- `src/pages/Index.tsx` — main shell; dual state: `mainTab` (section) + `activeTab` (sub-tab via Radix Tabs)
- `src/pages/indexReducer.ts` — all app state and actions
- `src/lib/structuralEngine.ts` — core ACI 318-19 design functions
- `src/components/BottomNav.tsx` — mobile bottom navigation (maps to mainTab)
- Mobile nav: tapping sections dispatches correct `activeTab` values matching `<TabsContent value=...>` elements

## Key Implementation Notes
- BottomNav 'foundations' → dispatches `activeTab='foundations'`; 'solver' → `activeTab='design'` (NOT the sub-item IDs which differ)
- FEM load distribution toggle: `state.useFEMLoadDistribution` — UI in AnalysisTabPanel
- ACI §6.5.1 warnings are surfaced in `SlabDesignResult.warnings[]` and displayed in SlabDesignPanel

## User Preferences
- Engineering accuracy per ACI 318-19 is the top priority
- Arabic UI language throughout

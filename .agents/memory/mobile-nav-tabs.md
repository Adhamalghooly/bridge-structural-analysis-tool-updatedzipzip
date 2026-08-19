---
name: Mobile nav tab mapping
description: BottomNav section IDs vs TabsContent values — they differ for foundations/solver, causing blank screens on mobile.
---

# Mobile Navigation Tab Mapping

## Rule
In `src/pages/Index.tsx`, the BottomNav `onTabChange` handler must map section IDs to the correct `<TabsContent value=...>` values, which differ for two sections:

| BottomNav section id | subs[0].id | TabsContent value needed |
|---|---|---|
| `foundations` | `foundation` | **`foundations`** |
| `solver` | `beam-design` | **`design`** |
| `inputs` | `input` | `input` (matches) |
| `modeling` | `modeler` | `modeler` (matches) |
| `projects` | null | `projects` |

**Why:** The `Tabs` component at line ~2900 uses `value={activeTab}`. On mobile, only `setMainTab(tab)` was called without updating `activeTab` — so the TabsContent never matched and nothing showed.

**How to apply:** Any new top-level section added to BottomNav must be checked: does `subs[0].id` match the `<TabsContent value>` for that section? If not, add an explicit mapping in the `onTabChange` handler.

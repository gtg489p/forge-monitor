# Pareto Explorer — Visualization Research Report

_Generated: 2026-02-27_

## Executive Summary

The forge-monitor Pareto Explorer currently shows 4 of 12 KPIs on a static parallel coordinates chart with no solution drill-down, no quality metrics, and no front comparison capability. The biggest opportunity is unlocking the full 12-KPI space with dynamic axis selection, adding per-point quality metrics (crowding distance, dominance depth) that require near-zero compute, and enabling multi-front overlay comparison — all achievable with ECharts config changes and React state management rather than custom rendering. The highest-leverage first build is the **Axis Selector + Brush/Filter UX + Crowding Distance coloring** trio, which transforms the tool from a static display into an interactive exploration system in roughly one week of work.

## Current State

The Pareto Explorer (`ParetoExplorer.tsx`) renders a single `ParetoParallelCoords` component with 4 hardcoded axes (`makespan_days`, `flowtime_days`, `labor_cost`, `tardiness_days`) out of 12 available KPIs in `ParetoMetrics`. The chart supports basic axis brushing via `axisareaselected` and continuous color mapping via `visualMap`, but provides no filter feedback (no count, no chips, no clear button). There is no way to inspect individual solutions, compare fronts across throughput levels, visualize front quality metrics, or export data. The `AXIS_LABELS` map in `paretoTypes.ts` only covers the 4 primary objectives — 8 KPIs are invisible to users without code changes. All computation is client-side, fetching data from `/api/pareto/front` via `useParetoFront`.

## Recommended Roadmap

### Phase 1 — Quick Wins (1-2 days each)

**1. Brush + Filter Feedback Bar**
- **Value:** Closes the cognitive loop — users currently brush axes and get no confirmation of what was filtered. Adding a count display ("47 / 312 solutions") and per-axis filter chips with clear buttons makes the tool feel responsive and trustworthy.
- **Implementation:** New `FilterBar.tsx` component between controls and chart. Track `ActiveFilter[]` state from `axisareaselected` event payloads. Each chip shows axis name + formatted range + "x" to clear. Use `dispatchAction({ type: 'axisAreaClear', parallelAxisId })` for per-axis clearing (ECharts 5.5+).
- **Code sketch:**
```tsx
<div className="flex items-center gap-2 px-3 py-2 text-xs">
  <span className="text-zinc-300">
    Filtered: {filteredCount} / {totalCount}
  </span>
  {filters.map(f => (
    <span key={f.axisIndex}
      className="bg-blue-500/20 border border-blue-500/40 text-blue-300
                 rounded-full px-3 py-1">
      {AXIS_LABELS[f.axisKey]}: {f.range[0].toFixed(1)}–{f.range[1].toFixed(1)}
      <button onClick={() => onClearFilter(f.axisIndex)} className="ml-1">×</button>
    </span>
  ))}
  <button onClick={onClearAll} className="text-zinc-500 hover:text-zinc-200">
    Clear All
  </button>
</div>
```

**2. Crowding Distance Coloring**
- **Value:** The cheapest quality metric (<1ms for 1000 points, 12 objectives). Colors points by isolation — sparse regions (high CD, cool colors) need more exploration, dense regions (low CD, warm colors) are well-covered. Immediately actionable without any new UI chrome.
- **Implementation:** Add `computeCrowdingDistance()` utility (~40 lines TS, O(m·n·log n)). Add "Crowding Distance" option to the existing color-by dropdown. Map normalized CD to existing `visualMap` color range.
- **Code sketch:**
```typescript
export function computeCrowdingDistance(
  points: ParetoMetrics[], objectives: (keyof ParetoMetrics)[]
): number[] {
  const n = points.length;
  if (n <= 2) return new Array(n).fill(Infinity);
  const cd = new Float64Array(n);
  for (const obj of objectives) {
    const sorted = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => points[a][obj] - points[b][obj]);
    const range = points[sorted[n-1]][obj] - points[sorted[0]][obj];
    cd[sorted[0]] = Infinity; cd[sorted[n-1]] = Infinity;
    if (range === 0) continue;
    for (let i = 1; i < n - 1; i++)
      cd[sorted[i]] += (points[sorted[i+1]][obj] - points[sorted[i-1]][obj]) / range;
  }
  return Array.from(cd);
}
```

**3. CSV/JSON Export**
- **Value:** Unblocks downstream workflows (Excel, Python notebooks, scheduling systems). Zero charting complexity — pure browser Blob download.
- **Implementation:** `ExportButton.tsx` dropdown in controls bar. Options: "Export Visible (CSV)", "Export All (CSV)", "Export Visible (JSON)". CSV includes all 12 KPIs + schedule_id + objective + solve_time + flattened throughput_gallons.
- **Code sketch:**
```typescript
function exportCSV(points: ParetoFrontPoint[], filename: string) {
  const kpiKeys = Object.keys(points[0]?.pareto_metrics ?? {});
  const headers = ['schedule_id', 'objective', 'solve_time', ...kpiKeys];
  const rows = points.map(p => [
    p.schedule_id, p.objective, p.solve_time,
    ...kpiKeys.map(k => p.pareto_metrics[k as keyof ParetoMetrics])
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
```

**4. Expand AXIS_LABELS to All 12 KPIs**
- **Value:** Foundation for every feature that follows. Currently only 4 KPIs have labels — the other 8 render as raw keys. Trivial change, big impact.
- **Implementation:** Update `paretoTypes.ts` to include all 12 entries in `AXIS_LABELS` and export an `ALL_KPI_KEYS` constant.
- **Code sketch:**
```typescript
export const ALL_KPI_KEYS: (keyof ParetoMetrics)[] = [
  "makespan_days", "flowtime_days", "labor_cost", "tardiness_days",
  "restock_cost", "fg_holding_cost", "fg_shipping_cost",
  "material_holding_cost", "wc_idle_minutes_total",
  "product_shift_concentration", "product_weekday_concentration",
  "product_work_center_concentration",
];

export const AXIS_LABELS: Record<string, string> = {
  makespan_days: "Makespan (days)",
  flowtime_days: "Flowtime (days)",
  labor_cost: "Labor Cost ($)",
  tardiness_days: "Tardiness (days)",
  restock_cost: "Restock Cost ($)",
  fg_holding_cost: "FG Holding ($)",
  fg_shipping_cost: "FG Shipping ($)",
  material_holding_cost: "Material Holding ($)",
  wc_idle_minutes_total: "WC Idle (min)",
  product_shift_concentration: "Shift Concentration",
  product_weekday_concentration: "Weekday Concentration",
  product_work_center_concentration: "WC Concentration",
};
```

### Phase 2 — Core Upgrades (3-5 days each)

**1. Dynamic Axis Selector with Drag-to-Reorder**
- **Value:** Unlocking 8 hidden KPIs is the single largest information-density gain. Axis reordering is cited in every parallel coordinates best-practice paper as essential — different axis orderings expose different trade-off structures. This is the foundation feature that makes all other improvements more powerful.
- **Implementation:** New `AxisSelector.tsx` using `@dnd-kit/sortable` for drag-reorder. State: `selectedAxes: (keyof ParetoMetrics)[]` initialized to `PRIMARY_OBJECTIVES`. `ParetoParallelCoords` receives `axes` prop instead of importing `PRIMARY_OBJECTIVES`. Min 2 axes, max 8 axes enforced. Both `parallelAxis` config and `series.data` mapping regenerated dynamically from selected axes.
- **Dependencies:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Phase 1 AXIS_LABELS expansion must be complete.

**2. Heatmap Correlation Matrix + Multi-Front Overlay**
- **Value:** Two complementary features that answer "which KPIs conflict?" and "which front is better?" The correlation heatmap (Pearson r between all 12 KPI pairs) reveals true Pareto trade-offs (r ≈ -1) and redundant objectives (r ≈ +1). Multi-front overlay enables throughput-level comparison by rendering multiple parallel series with distinct colors + legend toggle.
- **Implementation:**
  - Correlation: Pure TS computation (O(n·k²), trivial for n<5000, k=12). ECharts native `type: 'heatmap'` with diverging blue-red color scale. Click cell to add that KPI pair to parallel coords axes.
  - Overlay: Change `ParetoParallelCoords` to accept `Map<string, ParetoFrontPoint[]>` of named front groups. One `{ type: "parallel" }` series per group with distinct color. ECharts `legend` for toggling.
- **Dependencies:** Phase 1 (AXIS_LABELS expansion), Phase 2 Axis Selector (for dynamic axis control).

**3. Solution Inspector Panel**
- **Value:** Bridges exploration and action. Currently clicking a line does nothing — there's no path from "this line looks interesting" to "dispatch this schedule." A right-side slide-out panel showing all 12 KPIs with mini bar charts, metadata, and action buttons ("Pin Solution", "View Dispatch") transforms the tool from visualization to decision support.
- **Implementation:** New `SolutionInspector.tsx` (320px right panel). Selection via brush-then-click (when brush narrows to <20, show clickable list) and zrender-level nearest-line detection on chart click. `dispatchAction({ type: 'highlight' })` for visual emphasis.
- **Dependencies:** None, but benefits from Axis Selector and Brush Filter being in place.

### Phase 3 — Advanced (1+ week each)

**1. PCA/UMAP Dimensionality Reduction Scatter**
- **Value:** Parallel coordinates shows individual dimensions but hides global structure. A 2D projection reveals clusters, outliers, and the overall shape of the Pareto front. PCA (instant, deterministic, ~15KB via `ml-pca`) for default view; UMAP (~25KB via `umap-js`, async) as toggle for nonlinear structure. Cross-view linked brushing — select a cluster in the scatter, see those solutions highlighted in parallel coords — is the key interaction.
- **Implementation:** Normalize all KPIs to [0,1] before projection. ECharts scatter with `brush` component for region selection. Show explained variance badge for PCA. Shared `brushedIds: Set<string>` state via React context or Zustand.
- **Dependencies:** `ml-pca`, `umap-js`, Phase 2 shared state architecture.

**2. Front Growth Timeline + Animated Replay**
- **Value:** Shows whether the solver is making progress. A line chart with hypervolume + point count over time is the most informative "is optimization working?" display. Animated replay (progressive `setOption` with play/pause/speed controls) lets users watch the front build up, revealing strategy effectiveness and convergence behavior.
- **Implementation:** `FrontGrowthChart.tsx` (ECharts dual-axis line, dataZoom). `useFrontReplay` hook sorting points by `created_at`, bucketing into ~60 time slices, progressive reveal via `setInterval`. Strategy-colored parallel coords (categorical `visualMap` by `objective` field).
- **Dependencies:** `/api/pareto/timeline` endpoint (or client-side cumulative HV from sorted front data).

## Visualization Technique Deep Dives

### N-Dimensional Visualization

Seven techniques were evaluated for handling 12 KPIs on the Pareto front:

| Technique | Feasibility | Value | Verdict |
|-----------|------------|-------|---------|
| Enhanced Parallel Coords | High (native ECharts) | High | **Yes — Priority 1** |
| Heatmap Correlation Matrix | High (native heatmap) | High | **Yes — Priority 2** |
| PCA/UMAP Scatter | High (scatter output) | High | **Yes — Priority 3** |
| Scatter Plot Matrix (SPLOM) | Medium (multi-grid) | Medium | Conditional (only if >6 axes) |
| Radar/Spider Chart | High (native) | Low | **No** — misleading beyond 6 axes |
| 3D Scatter (echarts-gl) | Medium (+400KB dep) | Low | **No** — rotation UX is poor |
| Self-Organizing Maps | Low (custom render) | Low | **No** — overkill for <10k points |

**Recommended approach:** Enhanced parallel coordinates as the primary view (dynamic axes, density-aware opacity at 0.15-0.3 base, `visualMap` color encoding, `axisExpandable` for >6 axes). Correlation heatmap as a companion for "which KPIs matter?" discovery. PCA scatter as an overview panel for global front structure with linked brushing to parallel coords.

**Key insight:** Edge bundling and density heatmap overlays are not worth implementing. Setting `lineStyle.opacity` to 0.2 with `emphasis.lineStyle.opacity: 1.0` achieves 80% of density visualization at 0% implementation cost. ECharts' `progressive: 500` rendering handles performance for up to 5000 lines.

### Front Completeness & Quality Metrics

Nine quality metrics were evaluated for measuring "how good is our exploration?":

| Metric | Compute Cost (1000pts, 12D) | Value | Verdict |
|--------|---------------------------|-------|---------|
| **Crowding Distance** | <1ms (O(m·n·log n)) | Very High | **Yes — implement first** |
| **Dominance Depth (NSGA-II sort)** | ~20-50ms (O(m·n²)) | High | **Yes — implement second** |
| **Hypervolume (MC approx)** | ~200ms-2s (Web Worker) | Very High | **Yes — implement third** |
| Spread/Spacing (Schott) | <5ms | Medium | Yes (gauge badges) |
| Maximum Spread | <1ms | Medium | Yes (bar chart) |
| IGD/IGD+ | <10ms | Medium | Conditional (needs reference set) |
| Coverage Ratio | Same as MC HV | Medium | Subsume into HV gauge |
| Hypervolume (exact) | Infeasible >6D | — | No |
| Attainment Surfaces (EAF) | No JS lib; needs multi-run | Low | No |

**Recommended approach:** Crowding distance first (2-3 hours, colors existing chart), then dominance depth (3-4 hours, rank-based coloring), then Monte Carlo hypervolume in a Web Worker (6-8 hours, gauge + sparkline). Crowding distance is the single cheapest and most per-point-informative metric — it decorates existing visualizations with zero additional UI and can run on every SSE update.

**Key insight:** Exact hypervolume computation is exponential in dimension count and infeasible beyond 6D. Monte Carlo approximation with 100K samples gives <1% error and runs in ~500ms-2s for 12D with 1000 points. Must use a Web Worker to avoid UI blocking. Reference point selection (nadir + 10% margin per axis) must be persisted for comparable HV values across updates.

### Exploration Dynamics

Seven techniques were evaluated for showing how the Pareto front grows over time:

| Technique | Data Needs | Complexity | Value | Verdict |
|-----------|-----------|-----------|-------|---------|
| **Front Growth Timeline** | Timestamped snapshots | S | Very High | **Yes — immediate** |
| **Strategy Comparison** | `objective` field (exists) | S | Very High | **Yes — immediate** |
| **Animated Front Evolution** | `created_at` ordering | M | Very High | **Yes — next sprint** |
| Convergence Indicator | HV time series | S | High | Stretch goal |
| "Surprise" Point Detection | Dominance delta | M | High | Defer to Phase 2 |
| Exploration vs Exploitation | Spread + HV delta | M | High | Defer to Phase 2 |
| Objective Space Heatmap | 2D projection + time | L | Medium | Skip |

**Recommended approach:** Front Growth Timeline (ECharts dual-axis line with `dataZoom`) as the foundational chart — it answers "is the solver making progress?" and validates the timeline data pipeline. Strategy Comparison (categorical color in parallel coords by `objective` field + stacked area chart) for zero-cost insight using existing data. Animated replay (custom `setOption` loop with play/pause, not ECharts `timeline` component) for highest impact after the foundation is laid.

**Key insight:** Strategy-colored parallel coordinates requires only changing the `visualMap` from continuous to categorical based on the `objective` field already present on every `ParetoFrontPoint`. This immediately reveals which solver strategy (chebyshev, eps-sweep, box-bnb) finds solutions in which region of objective space — zero new data required.

### Multi-Front Comparison

Seven techniques were evaluated for comparing fronts across throughput levels and solver strategies:

| Technique | ECharts Feasibility | Complexity | Value | Verdict |
|-----------|-------------------|-----------|-------|---------|
| **Overlay Fronts (parallel)** | High (native multi-series) | S | High | **Yes — P0** |
| **Summary Delta Cards** | High (pure React) | S | High | **Yes — P0** |
| **Dominance Comparison** | High (bar chart) | S | High | **Yes — P0** |
| **Throughput Scaling** | High (small multiples) | M | High | **Yes — P0** |
| Difference View | Medium | M | Medium | P1 |
| Side-by-Side SPLOM | Low | L | Medium | Defer |
| Animated Transition | Medium | L | Low-Medium | Defer |

**Recommended approach:** Overlay fronts on parallel coordinates (one series per group, distinct colors, legend toggle) as the primary comparison mode — it's ~50 lines of change to the existing component. Summary delta cards (front size delta, best-value deltas per objective, dominance counts) for quantitative "which front wins?" answers. Throughput scaling via small multiples (grid of parallel coordinate panels with shared axis scales) for the most domain-valuable view.

**Key insight:** Animated morphing between fronts via `universalTransition` is visually compelling but carries medium-high risk — ECharts' `universalTransition` was designed for scatter/bar/pie, not parallel series. Lines may produce artifacts when point counts differ. Defer to presentation-mode only.

### UX & Interaction

Eight UX features were evaluated:

| Feature | Difficulty | UX Value | Priority |
|---------|-----------|----------|----------|
| **Axis Selector** | M | High | P0 |
| **Solution Inspector** | M | High | P0 |
| **Brush + Filter UX** | S | High | P0 |
| Export | S | Medium | P1 |
| Pinning/Bookmarking | M | Medium | P1 |
| KPI Weight Sliders | M | Medium | P1 |
| Tour/Highlights (knee point, most balanced) | M | Medium | P1 |
| Density Mode | L | Medium | P2 (only if >2000 pts) |

**Recommended approach:** Brush + Filter first (quick win, immediate feedback), then Axis Selector (foundation feature), then Solution Inspector (bridges exploration to action). The research literature (PAVED, Cajot et al.) specifically identifies "selection and drill-down" as the critical interaction gap for engineering teams using parallel coordinates on Pareto fronts.

**Key insight:** ECharts parallel series do not emit reliable `click` events with `dataIndex` on individual lines — this is a known limitation. The workaround is two-pronged: (1) brush-then-click via a filtered solution list when brush narrows to <20, and (2) zrender-level `instance.getZr().on('click')` with nearest-polyline detection computed from axis pixel positions.

## Architecture Notes

### Changes to `paretoTypes.ts`
- Export `ALL_KPI_KEYS` constant array of all 12 KPI keys
- Expand `AXIS_LABELS` to cover all 12 KPIs
- Add `ALL_KPI_LABELS` type for the full set
- Consider adding unit metadata per KPI for formatting

### Changes to `ParetoParallelCoords.tsx`
- Accept `axes: (keyof ParetoMetrics)[]` prop instead of using hardcoded `PRIMARY_OBJECTIVES`
- Accept `fronts: Map<string, ParetoFrontPoint[]>` for comparison mode (or keep `points` for single-front mode)
- Dynamically generate `parallelAxis` and `series.data` from `axes` prop
- Bind `visualMap.dimension` to `axes.indexOf(colorBy)` with fallback
- Support categorical `visualMap` (piecewise) for strategy coloring mode
- Expose `onFiltersChange` callback with typed `ActiveFilter[]`
- Use `notMerge={true}` (already set) to prevent stale axis ghosts on axis count changes

### Changes to `ParetoExplorer.tsx`
- Add state: `selectedAxes`, `activeFilters`, `filteredIndices`, `selectedSolutionIdx`, `colorMode`
- Add components: `AxisSelector`, `FilterBar`, `SolutionInspector`, `ExportButton`
- Layout: axis selector above chart, filter bar between controls and chart, inspector as right slide-out panel, tabbed lower panel for growth timeline / strategy chart / correlation heatmap

### New shared state architecture
All views (parallel coords, correlation heatmap, projection scatter, growth timeline) need shared state:
```typescript
interface ParetoExplorerState {
  selectedKpis: string[];          // ordered list of active KPI keys
  colorByKpi: string;              // KPI used for color encoding
  colorMode: 'objective' | 'strategy' | 'crowdingDistance' | 'rank';
  brushedIds: Set<string>;         // solutions highlighted by any brush
  pinnedIds: Set<number>;          // pinned schedule_ids
  selectedSolutionIdx: number | null;
  activeFilters: ActiveFilter[];
}
```
Use React context or a lightweight store (Zustand) to share across components. When a brush event fires in any view, update `brushedIds` and all views re-render to highlight only those solutions.

### Proposed component layout
```
+--------------------------------------------------+
| Pareto Explorer                    <- Dashboard   |
+--------------------------------------------------+
| [Axes: drag chips]  [+ Add axis]                  |
+--------------------------------------------------+
| Filtered: 47/312  [Makespan: 2.1-4.5 x] [Clear] |
+--------------------------------------------------+
| Controls: [Color by v] [Mode: Obj|Strat|CD|Rank] |
|           [Export v]                               |
+--------------------------------------------------+
| Parallel Coordinates (400px)  | Solution Inspector |
|                               | (slide-out, 320px) |
+--------------------------------------------------+
| Tabs: [Correlation] [Growth] [Strategy]           |
| +----------------------------------------------+ |
| | Correlation Heatmap / Growth / Strategy Area  | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

## Key Insights

- **Crowding distance is the single best bang-for-buck feature.** <1ms compute, zero UI overhead (just a new color-by option), gives immediately actionable insight about which front regions need more exploration. Implement in the first session.

- **8 of 12 KPIs are completely invisible to users.** The `AXIS_LABELS` map only covers 4 keys. Expanding it is a 5-minute change that unblocks every downstream feature.

- **ECharts parallel coordinates have a blind spot for click selection.** Individual line hit-testing is unreliable. The pragmatic workaround — brush-to-narrow then click from a filtered list — actually produces a better UX than direct click because it forces the user to scope their selection first.

- **Opacity-based density (0.15-0.3 base) eliminates the need for edge bundling or custom density rendering.** Combined with `emphasis.lineStyle.opacity: 1.0` on hover, this achieves perceptual density visualization for free via ECharts config.

- **Exact hypervolume is infeasible beyond 6 dimensions.** Monte Carlo approximation is the standard approach for many-objective (>5D) problems. 100K samples with a Web Worker provides <1% error in ~500ms-2s for 12D.

- **Strategy coloring is a zero-cost insight.** The `objective` field already exists on every `ParetoFrontPoint`. Switching `visualMap` from continuous to categorical by strategy name immediately reveals solver behavior patterns.

- **Correlation heatmap answers "which KPIs matter?" before users choose axes.** Strong negative correlation (r ≈ -1) identifies true Pareto trade-offs; strong positive (r ≈ +1) identifies redundant objectives that can be dropped. This is the discovery step before detailed exploration.

- **Small multiples with shared axis scales are the gold standard for throughput comparison.** Unlike overlay (which becomes spaghetti at >3 fronts) or animation (which requires sequential viewing), small multiples allow instant side-by-side comparison without interaction.

- **Dominance depth coloring reveals front quality at a glance.** Rank 1 (true Pareto) in bright color, rank 2+ progressively muted. Users immediately see which solutions are truly competitive vs. dominated.

- **The PCA explained-variance badge is essential for interpretability.** If PC1+PC2 explain only 40% of variance, the 2D projection is misleading. Users need to see this number to calibrate their trust in the projection.

## Implementation Priority Matrix

| Feature | Value (1-5) | Complexity (1-5) | Priority Score | Recommended Sprint |
|---------|------------|------------------|----------------|-------------------|
| AXIS_LABELS expansion (all 12 KPIs) | 4 | 1 | **20.0** | Sprint 1 |
| Brush + Filter feedback bar | 5 | 1 | **25.0** | Sprint 1 |
| Crowding Distance coloring | 5 | 1 | **25.0** | Sprint 1 |
| CSV/JSON Export | 3 | 1 | **15.0** | Sprint 1 |
| Dynamic Axis Selector (drag-reorder) | 5 | 3 | **8.3** | Sprint 2 |
| Dominance Depth rank coloring | 4 | 2 | **10.0** | Sprint 2 |
| Strategy-colored parallel coords | 4 | 1 | **20.0** | Sprint 2 |
| Overlay multi-front comparison | 5 | 2 | **12.5** | Sprint 2 |
| Summary Delta Cards | 4 | 2 | **10.0** | Sprint 2 |
| Solution Inspector panel | 5 | 3 | **8.3** | Sprint 3 |
| Heatmap Correlation Matrix | 4 | 2 | **10.0** | Sprint 3 |
| MC Hypervolume (Web Worker) | 4 | 3 | **6.7** | Sprint 3 |
| Front Growth Timeline | 4 | 2 | **10.0** | Sprint 3 |
| Throughput Small Multiples | 4 | 3 | **6.7** | Sprint 4 |
| KPI Weight Sliders | 3 | 3 | **5.0** | Sprint 4 |
| Pinning / Bookmarking | 3 | 3 | **5.0** | Sprint 4 |
| PCA/UMAP Scatter Projection | 4 | 4 | **5.0** | Sprint 5 |
| Animated Front Replay | 4 | 3 | **6.7** | Sprint 5 |
| Tour/Highlight (knee point) | 3 | 3 | **5.0** | Sprint 5 |
| Convergence Gauge | 3 | 2 | **7.5** | Sprint 5 |
| Density Mode | 2 | 5 | **2.0** | Backlog |
| 3D Scatter (echarts-gl) | 1 | 3 | **1.7** | Not recommended |
| Radar/Spider Charts | 1 | 2 | **2.5** | Not recommended |
| Self-Organizing Maps | 1 | 5 | **1.0** | Not recommended |

_Priority Score = Value × (5 / Complexity). Higher is better. Scores above 10 are strong candidates for near-term implementation._

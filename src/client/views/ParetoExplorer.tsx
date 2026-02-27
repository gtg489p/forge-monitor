import { useState, useMemo, useCallback } from "react";
import { ParetoParallelCoords } from "../components/ParetoParallelCoords.js";
import type { ActiveFilter } from "../components/ParetoParallelCoords.js";
import { ParetoControls } from "../components/ParetoControls.js";
import type { ColorMode } from "../components/ParetoControls.js";
import { ParetoSummaryBar } from "../components/ParetoSummaryBar.js";
import { AxisSelector } from "../components/AxisSelector.js";
import { FilterBar } from "../components/FilterBar.js";
import { SolutionInspector } from "../components/SolutionInspector.js";
import { useParetoFront } from "../hooks/useParetoData.js";
import { computeCrowdingDistance } from "../lib/paretoMath.js";
import type { ParetoMetrics } from "../lib/paretoTypes.js";
import { loadAxisSelection, saveAxisSelection } from "../lib/paretoTypes.js";

export function ParetoExplorer() {
  const [throughput, setThroughput] = useState<string | undefined>();
  const [colorBy, setColorBy] = useState<ColorMode>("tardiness_days");
  const [selectedAxes, setSelectedAxes] = useState<(keyof ParetoMetrics)[]>(loadAxisSelection);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const { data, loading, error } = useParetoFront(throughput);

  const handleAxesChange = useCallback((axes: (keyof ParetoMetrics)[]) => {
    setSelectedAxes(axes);
    saveAxisSelection(axes);
    setActiveFilters([]); // clear filters when axes change
  }, []);

  const points = data ?? [];

  // Compute crowding distance when that color mode is active
  const crowdingValues = useMemo(() => {
    if (colorBy !== "crowding_distance" || points.length === 0) return undefined;
    const metrics = points.map((p) => p.pareto_metrics);
    return computeCrowdingDistance(metrics, selectedAxes);
  }, [colorBy, points, selectedAxes]);

  // Compute filtered count
  const filteredCount = useMemo(() => {
    if (activeFilters.length === 0) return points.length;
    return points.filter((p) =>
      activeFilters.every((f) => {
        const val = p.pareto_metrics[f.axisKey];
        return val >= f.range[0] && val <= f.range[1];
      }),
    ).length;
  }, [points, activeFilters]);

  if (loading)
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <span className="text-zinc-600 text-sm">Loading Pareto front...</span>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <span className="text-red-400 text-sm">Error: {error}</span>
      </div>
    );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Pareto Explorer</h1>
        <a
          href="#/"
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          &larr; Back to Dashboard
        </a>
      </div>

      <ParetoSummaryBar points={points} />
      <AxisSelector selected={selectedAxes} onChange={handleAxesChange} />
      <ParetoControls
        points={points}
        throughput={throughput}
        onThroughputChange={setThroughput}
        colorBy={colorBy}
        onColorByChange={setColorBy}
      />

      <FilterBar
        filters={activeFilters}
        filteredCount={filteredCount}
        totalCount={points.length}
        onClearFilter={(axisIndex) =>
          setActiveFilters((prev) => prev.filter((f) => f.axisIndex !== axisIndex))
        }
        onClearAll={() => setActiveFilters([])}
      />

      <div className="flex gap-4 mt-4">
        <div className={`rounded-xl border border-zinc-800 bg-zinc-900 p-5 ${selectedPointIdx !== null ? "flex-1" : "w-full"}`}>
          {points.length > 0 ? (
            <ParetoParallelCoords
              points={points}
              axes={selectedAxes}
              colorBy={colorBy === "crowding_distance" ? selectedAxes[0] : colorBy}
              customColorValues={crowdingValues}
              customColorLabel={colorBy === "crowding_distance" ? "Crowding Distance" : undefined}
              onFiltersChange={setActiveFilters}
              onPointClick={setSelectedPointIdx}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">
              No Pareto front data available.
            </div>
          )}
        </div>

        {selectedPointIdx !== null && points[selectedPointIdx] && (
          <SolutionInspector
            point={points[selectedPointIdx]}
            onClose={() => setSelectedPointIdx(null)}
          />
        )}
      </div>

      {colorBy === "crowding_distance" && (
        <p className="text-xs text-zinc-500 mt-2">
          Blue = sparse region (needs exploration) &middot; Red = dense (well covered)
        </p>
      )}
    </div>
  );
}

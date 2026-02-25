import { useState } from "react";
import { ParetoParallelCoords } from "../components/ParetoParallelCoords.js";
import { ParetoControls } from "../components/ParetoControls.js";
import { ParetoSummaryBar } from "../components/ParetoSummaryBar.js";
import { useParetoFront } from "../hooks/useParetoData.js";
import type { PrimaryObjective } from "../lib/paretoTypes.js";

export function ParetoExplorer() {
  const [throughput, setThroughput] = useState<string | undefined>();
  const [colorBy, setColorBy] = useState<PrimaryObjective>("tardiness_days");
  const { data, loading, error } = useParetoFront(throughput);

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

  const points = data ?? [];

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
      <ParetoControls
        points={points}
        throughput={throughput}
        onThroughputChange={setThroughput}
        colorBy={colorBy}
        onColorByChange={setColorBy}
      />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 mt-4">
        {points.length > 0 ? (
          <ParetoParallelCoords points={points} colorBy={colorBy} />
        ) : (
          <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">
            No Pareto front data available.
          </div>
        )}
      </div>
    </div>
  );
}

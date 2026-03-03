import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TriageProgressBarProps {
  /** Total number of Pareto front solutions being triaged. */
  total: number;
  /** Number of triage solves completed so far. */
  completed: number;
  /** Number of solutions that survived (feasible under disruption). */
  feasible: number;
  /** Number of solutions that broke (infeasible under disruption). */
  infeasible: number;
  /** Elapsed time in milliseconds since triage started. */
  elapsed: number;
  /** Partial disruption score (percentage of front that broke). */
  disruptionScore?: number;
  /** Whether the triage is fully complete. */
  isComplete?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TriageProgressBar({
  total,
  completed,
  feasible,
  infeasible,
  elapsed,
  disruptionScore,
  isComplete = false,
}: TriageProgressBarProps) {
  const pending = total - completed;
  const pctComplete = total > 0 ? (completed / total) * 100 : 0;
  const pctFeasible = total > 0 ? (feasible / total) * 100 : 0;
  const pctInfeasible = total > 0 ? (infeasible / total) * 100 : 0;

  const scoreLabel = useMemo(() => {
    if (disruptionScore == null) return null;
    return `${disruptionScore.toFixed(0)}%`;
  }, [disruptionScore]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest">
          {isComplete ? "Triage Complete" : "Triage In Progress"}
        </h2>
        <span className="text-sm font-mono text-zinc-400 tabular-nums">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Progress bar — stacked segments */}
      <div className="w-full h-4 rounded-full bg-zinc-800 overflow-hidden flex mb-3">
        {/* Feasible (green) segment */}
        {pctFeasible > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${pctFeasible}%` }}
          />
        )}
        {/* Infeasible (red) segment */}
        {pctInfeasible > 0 && (
          <div
            className="h-full bg-red-500 transition-all duration-500 ease-out"
            style={{ width: `${pctInfeasible}%` }}
          />
        )}
        {/* Remaining (pending) is the bar background (zinc-800) */}
      </div>

      {/* Completion text */}
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-zinc-400 font-mono tabular-nums">
          {completed}/{total}
        </span>
        <span className="text-zinc-500">
          {pctComplete.toFixed(0)}% checked
        </span>
      </div>

      {/* Legend row */}
      <div className="flex items-center gap-5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-zinc-300">{feasible} Survive</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-zinc-300">{infeasible} Break</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-zinc-600" />
          <span className="text-zinc-400">{pending} Pending</span>
        </span>
      </div>

      {/* Disruption score (if available) */}
      {scoreLabel && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">
            Disruption Score
          </span>
          <span
            className={`text-lg font-bold font-mono tabular-nums ${
              disruptionScore != null && disruptionScore >= 50
                ? "text-red-400"
                : disruptionScore != null && disruptionScore >= 25
                  ? "text-amber-400"
                  : "text-emerald-400"
            }`}
          >
            {scoreLabel}
            {!isComplete && (
              <span className="text-xs text-zinc-500 ml-1">(partial)</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

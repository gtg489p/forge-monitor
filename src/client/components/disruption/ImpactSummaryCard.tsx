import type { ImpactMetrics } from "../../lib/disruptionTypes.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImpactSummaryCardProps {
  impact: ImpactMetrics;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DeltaKPI {
  label: string;
  value: number;
  unit: string;
  /** Format function for the value. */
  format: (v: number) => string;
}

function formatDollars(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDays(v: number): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)} day${Math.abs(v) !== 1 ? "s" : ""}`;
}

function formatPercent(v: number): string {
  return `${v.toFixed(0)}%`;
}

function DeltaArrow({ value }: { value: number }) {
  if (value > 0) {
    return <span className="text-red-400 text-xs ml-1">&#9650;</span>; // up triangle (bad)
  }
  if (value < 0) {
    return <span className="text-emerald-400 text-xs ml-1">&#9660;</span>; // down triangle (good)
  }
  return <span className="text-zinc-500 text-xs ml-1">&#9472;</span>; // dash (no change)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactSummaryCard({ impact }: ImpactSummaryCardProps) {
  const deltas: DeltaKPI[] = [
    {
      label: "Labor Cost",
      value: impact.cost_impact.labor_cost_delta,
      unit: "$",
      format: formatDollars,
    },
    {
      label: "Makespan",
      value: impact.cost_impact.makespan_delta_days,
      unit: "days",
      format: formatDays,
    },
    {
      label: "Tardiness",
      value: impact.cost_impact.tardiness_delta_days,
      unit: "days",
      format: formatDays,
    },
  ];

  const scoreColor =
    impact.disruption_score >= 50
      ? "text-red-400"
      : impact.disruption_score >= 25
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest mb-4">
        Impact Summary
      </h2>

      {/* Top row: disruption score + recovery time */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">
            Disruption Score
          </p>
          <p className={`text-2xl font-bold font-mono tabular-nums mt-1 ${scoreColor}`}>
            {formatPercent(impact.disruption_score)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest">
            Recovery Time
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-cyan-400">
            {impact.recovery_metrics.time_to_first_feasible_ms < 1000
              ? `${impact.recovery_metrics.time_to_first_feasible_ms}ms`
              : `${(impact.recovery_metrics.time_to_first_feasible_ms / 1000).toFixed(1)}s`}
          </p>
        </div>
      </div>

      {/* Delta KPIs grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {deltas.map((d) => (
          <div
            key={d.label}
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-center"
          >
            <p className="text-xs text-zinc-500 mb-1">{d.label}</p>
            <p className="text-sm font-bold font-mono tabular-nums text-zinc-100">
              {d.format(d.value)}
              <DeltaArrow value={d.value} />
            </p>
          </div>
        ))}
      </div>

      {/* Operational impact summary */}
      <div className="border-t border-zinc-800 pt-3 flex items-center justify-between text-xs text-zinc-400">
        <span>
          Runs Affected:{" "}
          <span className="text-zinc-200 font-mono">
            {impact.operational_impact.runs_affected}
          </span>
        </span>
        <span>
          Products Delayed:{" "}
          <span className="text-zinc-200 font-mono">
            {impact.operational_impact.products_delayed.length > 0
              ? impact.operational_impact.products_delayed.join(", ")
              : "None"}
          </span>
        </span>
        <span>
          Capacity:{" "}
          <span className="text-zinc-200 font-mono">
            -{formatPercent(impact.operational_impact.capacity_reduction_pct)}
          </span>
        </span>
      </div>

      {/* Recovery feasibility */}
      <div className="mt-3 pt-3 border-t border-zinc-800 text-xs">
        {impact.recovery_metrics.full_recovery_possible ? (
          <span className="text-emerald-400">
            Full recovery is possible
          </span>
        ) : (
          <span className="text-amber-400">
            Full recovery may not be achievable with current constraints
          </span>
        )}
        {impact.recovery_metrics.best_recovery_cost > 0 && (
          <span className="text-zinc-500 ml-2">
            (estimated recovery cost: {formatDollars(impact.recovery_metrics.best_recovery_cost)})
          </span>
        )}
      </div>
    </div>
  );
}

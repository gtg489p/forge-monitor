import type { ParetoFrontPoint } from "../lib/paretoTypes.js";
import { AXIS_LABELS } from "../lib/paretoTypes.js";

interface Props {
  points: ParetoFrontPoint[];
}

function bestValue(
  points: ParetoFrontPoint[],
  key: keyof ParetoFrontPoint["pareto_metrics"],
): number | null {
  if (points.length === 0) return null;
  return Math.min(...points.map((p) => p.pareto_metrics[key]));
}

function formatValue(key: string, value: number | null): string {
  if (value === null) return "—";
  if (key === "labor_cost") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (key === "makespan_days" || key === "tardiness_days") return `${value.toFixed(1)} min`;
  return value.toFixed(2);
}

const STATS = [
  { key: "makespan_days" as const, color: "text-cyan-400" },
  { key: "flowtime_days" as const, color: "text-violet-400" },
  { key: "labor_cost" as const, color: "text-emerald-400" },
  { key: "tardiness_days" as const, color: "text-amber-400" },
];

export function ParetoSummaryBar({ points }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest">
          Front Size
        </p>
        <p className="text-2xl font-bold text-zinc-100 font-mono tabular-nums mt-1">
          {points.length}
        </p>
      </div>
      {STATS.map(({ key, color }) => (
        <div
          key={key}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <p className="text-xs text-zinc-500 uppercase tracking-widest">
            Best {AXIS_LABELS[key]}
          </p>
          <p
            className={`text-lg font-bold font-mono tabular-nums mt-1 ${color}`}
          >
            {formatValue(key, bestValue(points, key))}
          </p>
        </div>
      ))}
    </div>
  );
}

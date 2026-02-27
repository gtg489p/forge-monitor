import { useEffect } from "react";
import type { ParetoFrontPoint } from "../lib/paretoTypes.js";
import { ALL_OBJECTIVES } from "../lib/paretoTypes.js";

interface Props {
  point: ParetoFrontPoint;
  onClose: () => void;
}

function formatKpiValue(unit: string, value: number): string {
  if (unit === "$")
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (unit === "min") return `${value.toFixed(1)} min`;
  if (unit === "days") return `${value.toFixed(2)} days`;
  return value.toFixed(3);
}

export function SolutionInspector({ point, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="w-80 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-5 overflow-y-auto max-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">Solution Details</h3>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 text-lg leading-none"
          title="Close (Esc)"
        >
          &times;
        </button>
      </div>

      <div className="space-y-1 mb-4">
        <Row label="Schedule ID" value={String(point.schedule_id)} />
        <Row label="Objective" value={point.objective} />
        <Row label="Solve Status" value={point.solve_status} />
        <Row label="Solve Time" value={`${point.solve_time.toFixed(1)}s`} />
      </div>

      <h4 className="text-xs text-zinc-400 uppercase tracking-widest mb-2">
        KPIs
      </h4>
      <div className="space-y-1 mb-4">
        {ALL_OBJECTIVES.map(({ key, label, unit }) => (
          <Row
            key={key}
            label={label}
            value={formatKpiValue(unit, point.pareto_metrics[key])}
          />
        ))}
      </div>

      {Object.keys(point.throughput_gallons).length > 0 && (
        <>
          <h4 className="text-xs text-zinc-400 uppercase tracking-widest mb-2">
            Throughput (gal)
          </h4>
          <div className="space-y-1">
            {Object.entries(point.throughput_gallons)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([product, gallons]) => (
                <Row
                  key={product}
                  label={product}
                  value={gallons.toLocaleString()}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200 font-mono tabular-nums">{value}</span>
    </div>
  );
}

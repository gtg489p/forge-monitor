import type { ActiveFilter } from "./ParetoParallelCoords.js";
import { AXIS_LABELS, ALL_OBJECTIVES } from "../lib/paretoTypes.js";

interface Props {
  filters: ActiveFilter[];
  filteredCount: number;
  totalCount: number;
  onClearFilter: (axisIndex: number) => void;
  onClearAll: () => void;
}

function formatRange(axisKey: string, lo: number, hi: number): string {
  const obj = ALL_OBJECTIVES.find((o) => o.key === axisKey);
  const unit = obj?.unit ?? "";

  if (unit === "$") {
    return `$${lo.toLocaleString(undefined, { maximumFractionDigits: 0 })} – $${hi.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (unit === "min" || unit === "days") {
    return `${lo.toFixed(1)} – ${hi.toFixed(1)} ${unit}`;
  }
  return `${lo.toFixed(2)} – ${hi.toFixed(2)}`;
}

export function FilterBar({
  filters,
  filteredCount,
  totalCount,
  onClearFilter,
  onClearAll,
}: Props) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 text-xs flex-wrap">
      <span className="text-zinc-300 font-medium whitespace-nowrap">
        Showing {filteredCount} / {totalCount}
      </span>

      {filters.map((f) => (
        <span
          key={f.axisIndex}
          className="inline-flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded-full px-3 py-1"
        >
          {AXIS_LABELS[f.axisKey] ?? f.axisKey}:{" "}
          {formatRange(f.axisKey, f.range[0], f.range[1])}
          <button
            onClick={() => onClearFilter(f.axisIndex)}
            className="ml-1 hover:text-white"
            title="Clear this filter"
          >
            &times;
          </button>
        </span>
      ))}

      <button
        onClick={onClearAll}
        className="text-zinc-500 hover:text-zinc-200 ml-auto whitespace-nowrap"
      >
        Clear All
      </button>
    </div>
  );
}

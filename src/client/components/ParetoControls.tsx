import type { ParetoFrontPoint, PrimaryObjective } from "../lib/paretoTypes.js";
import { PRIMARY_OBJECTIVES, AXIS_LABELS } from "../lib/paretoTypes.js";

interface Props {
  points: ParetoFrontPoint[];
  throughput: string | undefined;
  onThroughputChange: (value: string | undefined) => void;
  colorBy: PrimaryObjective;
  onColorByChange: (value: PrimaryObjective) => void;
}

export function ParetoControls({
  points,
  throughput,
  onThroughputChange,
  colorBy,
  onColorByChange,
}: Props) {
  // Extract unique throughput groups from points
  const throughputGroups = Array.from(
    new Set(
      points.map((p) =>
        Object.entries(p.throughput_gallons)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}:${v}`)
          .join(","),
      ),
    ),
  ).sort();

  return (
    <div className="flex items-center gap-4 mt-4">
      <div className="flex items-center gap-2">
        <label className="text-xs text-zinc-400">Color by:</label>
        <select
          value={colorBy}
          onChange={(e) => onColorByChange(e.target.value as PrimaryObjective)}
          className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
        >
          {PRIMARY_OBJECTIVES.map((key) => (
            <option key={key} value={key}>
              {AXIS_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {throughputGroups.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">Throughput:</label>
          <select
            value={throughput ?? ""}
            onChange={(e) =>
              onThroughputChange(e.target.value || undefined)
            }
            className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
          >
            <option value="">All</option>
            {throughputGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

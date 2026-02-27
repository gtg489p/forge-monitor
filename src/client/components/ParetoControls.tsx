import type { ParetoMetrics } from "../lib/paretoTypes.js";
import type { ParetoFrontPoint } from "../lib/paretoTypes.js";
import { ALL_OBJECTIVES, AXIS_LABELS } from "../lib/paretoTypes.js";

export type ColorMode = keyof ParetoMetrics | "crowding_distance";

interface Props {
  points: ParetoFrontPoint[];
  throughput: string | undefined;
  onThroughputChange: (value: string | undefined) => void;
  colorBy: ColorMode;
  onColorByChange: (value: ColorMode) => void;
}

export function ParetoControls({
  points,
  throughput,
  onThroughputChange,
  colorBy,
  onColorByChange,
}: Props) {
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
          onChange={(e) => onColorByChange(e.target.value as ColorMode)}
          className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
        >
          {ALL_OBJECTIVES.map(({ key }) => (
            <option key={key} value={key}>
              {AXIS_LABELS[key]}
            </option>
          ))}
          <option value="crowding_distance">Crowding Distance</option>
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

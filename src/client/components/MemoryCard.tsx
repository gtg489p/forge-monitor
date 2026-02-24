import { AreaChart } from "@tremor/react";
import type { MetricSnapshot } from "../../types.js";
import { formatTime } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
}

export function MemoryCard({ snapshots, latest }: Props) {
  const data = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    "Memory %": Number(s.memory.percent.toFixed(1)),
  }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Memory
          </p>
          {latest != null ? (
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">
              {latest.memory.used.toFixed(1)} GB /{" "}
              {latest.memory.total.toFixed(1)} GB
            </p>
          ) : (
            <p className="text-xs text-zinc-600 mt-0.5">RAM utilization</p>
          )}
        </div>
        <span className="text-2xl font-bold text-violet-400 tabular-nums font-mono">
          {latest != null ? `${latest.memory.percent.toFixed(1)}%` : "—"}
        </span>
      </div>

      <AreaChart
        className="h-40"
        data={data}
        index="time"
        categories={["Memory %"]}
        colors={["violet"]}
        valueFormatter={(v) => `${v.toFixed(1)}%`}
        showLegend={false}
        showGridLines={true}
        showAnimation={false}
        minValue={0}
        maxValue={100}
        yAxisWidth={45}
      />
    </div>
  );
}

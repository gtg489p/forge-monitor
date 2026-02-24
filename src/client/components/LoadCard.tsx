import { AreaChart } from "@tremor/react";
import type { MetricSnapshot } from "../../types.js";
import { formatTime } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
}

export function LoadCard({ snapshots, latest }: Props) {
  const data = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    "Load 1m": s.load.avg1,
    "Load 5m": s.load.avg5,
    "Load 15m": s.load.avg15,
  }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Load Average
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">1 min · 5 min · 15 min</p>
        </div>
        {latest != null ? (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-zinc-500">1m</p>
              <p className="text-lg font-bold text-indigo-400 font-mono tabular-nums">
                {latest.load.avg1.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-zinc-500">5m</p>
              <p className="text-lg font-bold text-purple-400 font-mono tabular-nums">
                {latest.load.avg5.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-zinc-500">15m</p>
              <p className="text-lg font-bold text-pink-400 font-mono tabular-nums">
                {latest.load.avg15.toFixed(2)}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-zinc-600 text-2xl font-bold">—</span>
        )}
      </div>

      <AreaChart
        className="h-40"
        data={data}
        index="time"
        categories={["Load 1m", "Load 5m", "Load 15m"]}
        colors={["indigo", "purple", "pink"]}
        valueFormatter={(v) => v.toFixed(2)}
        showLegend={true}
        showGridLines={true}
        showAnimation={false}
        autoMinValue={true}
        yAxisWidth={45}
      />
    </div>
  );
}

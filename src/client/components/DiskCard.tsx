import { AreaChart } from "@tremor/react";
import type { MetricSnapshot } from "../../types.js";
import { formatTime, formatMBs } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
}

export function DiskCard({ snapshots, latest }: Props) {
  const data = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    "Read MB/s": s.disk.read,
    "Write MB/s": s.disk.write,
  }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Disk I/O
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">Read + Write throughput</p>
        </div>
        {latest != null ? (
          <div className="text-right">
            <p className="text-sm font-bold text-blue-400 font-mono tabular-nums">
              R&nbsp;{formatMBs(latest.disk.read)}
            </p>
            <p className="text-sm font-bold text-amber-400 font-mono tabular-nums">
              W&nbsp;{formatMBs(latest.disk.write)}
            </p>
          </div>
        ) : (
          <span className="text-zinc-600 text-2xl font-bold">—</span>
        )}
      </div>

      <AreaChart
        className="h-40"
        data={data}
        index="time"
        categories={["Read MB/s", "Write MB/s"]}
        colors={["blue", "amber"]}
        valueFormatter={(v) => `${v.toFixed(2)} MB/s`}
        showLegend={true}
        showGridLines={true}
        showAnimation={false}
        autoMinValue={true}
        yAxisWidth={60}
      />
    </div>
  );
}

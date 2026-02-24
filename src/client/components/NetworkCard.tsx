import { AreaChart } from "@tremor/react";
import type { MetricSnapshot } from "../../types.js";
import { formatTime, formatMBs } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
}

export function NetworkCard({ snapshots, latest }: Props) {
  const data = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    "RX MB/s": s.network.rx,
    "TX MB/s": s.network.tx,
  }));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Network I/O
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">RX + TX throughput</p>
        </div>
        {latest != null ? (
          <div className="text-right">
            <p className="text-sm font-bold text-emerald-400 font-mono tabular-nums">
              RX&nbsp;{formatMBs(latest.network.rx)}
            </p>
            <p className="text-sm font-bold text-rose-400 font-mono tabular-nums">
              TX&nbsp;{formatMBs(latest.network.tx)}
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
        categories={["RX MB/s", "TX MB/s"]}
        colors={["emerald", "rose"]}
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

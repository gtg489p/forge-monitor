import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import type { MetricSnapshot } from "../../types.js";
import { formatTime, formatMBs } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
}

const SERIES_CONFIG = [
  { name: "Read MB/s", key: "read" as const, color: "#3b82f6" },
  { name: "Write MB/s", key: "write" as const, color: "#f59e0b" },
];

export function DiskCard({ snapshots, latest }: Props) {
  const chartData = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    read: s.disk.read,
    write: s.disk.write,
  }));

  const option: EChartsOption = {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    grid: { top: 8, right: 12, bottom: 24, left: 60, containLabel: false },
    legend: {
      show: true,
      bottom: 0,
      textStyle: { color: "#a1a1aa", fontSize: 10 },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => formatMBs(v as number),
    },
    xAxis: {
      type: "category",
      data: chartData.map((d) => d.time),
      boundaryGap: false,
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, formatter: (v: number) => formatMBs(v) },
    },
    series: SERIES_CONFIG.map((s) => ({
      name: s.name,
      type: "line" as const,
      data: chartData.map((d) => d[s.key]),
      showSymbol: false,
      lineStyle: { color: s.color, width: 1.5 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: s.color + "4D" },
          { offset: 1, color: s.color + "05" },
        ]),
      },
      itemStyle: { color: s.color },
    })),
  };

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

      <ReactECharts
        option={option}
        theme="forgeMonitor"
        style={{ height: 160 }}
        notMerge={true}
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}

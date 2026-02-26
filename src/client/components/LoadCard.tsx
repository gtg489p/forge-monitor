import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import type { MetricSnapshot } from "../../types.js";
import { formatTime } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
}

const SERIES_CONFIG = [
  { name: "Load 1m", key: "avg1" as const, color: "#6366f1" },
  { name: "Load 5m", key: "avg5" as const, color: "#a855f7" },
  { name: "Load 15m", key: "avg15" as const, color: "#ec4899" },
];

export function LoadCard({ snapshots, latest }: Props) {
  const chartData = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    avg1: s.load.avg1,
    avg5: s.load.avg5,
    avg15: s.load.avg15,
  }));

  const option: EChartsOption = {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    grid: { top: 8, right: 12, bottom: 24, left: 45, containLabel: false },
    legend: {
      show: true,
      bottom: 0,
      textStyle: { color: "#a1a1aa", fontSize: 10 },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => (v as number).toFixed(2),
    },
    xAxis: {
      type: "category",
      data: chartData.map((d) => d.time),
      boundaryGap: false,
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 10, formatter: (v: number) => v.toFixed(2) },
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
            System Load Average
          </p>
          <p className="text-xs text-zinc-600 mt-0.5" title="1m / 5m / 15m rolling average of runnable processes. Values above CPU core count indicate saturation.">
            1m · 5m · 15m — values &gt; core count = saturation
          </p>
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

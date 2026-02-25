import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import type { MetricSnapshot } from "../../types.js";
import { formatTime } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
}

export function MemoryCard({ snapshots, latest }: Props) {
  const chartData = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    value: Number(s.memory.percent.toFixed(1)),
  }));

  const option: EChartsOption = {
    animation: false,
    grid: { top: 8, right: 12, bottom: 24, left: 45, containLabel: false },
    xAxis: {
      type: "category",
      data: chartData.map((d) => d.time),
      boundaryGap: false,
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { formatter: (v: number) => `${v}%`, fontSize: 10 },
    },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => `${(v as number).toFixed(1)}%`,
    },
    series: [
      {
        name: "Memory %",
        type: "line",
        data: chartData.map((d) => d.value),
        showSymbol: false,
        lineStyle: { color: "#8b5cf6", width: 1.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(139,92,246,0.3)" },
            { offset: 1, color: "rgba(139,92,246,0.02)" },
          ]),
        },
        itemStyle: { color: "#8b5cf6" },
      },
    ],
  };

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

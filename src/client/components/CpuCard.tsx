import { useState, memo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import type { MetricSnapshot } from "../../types.js";
import { formatTime } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
}

// 5-tier color system
function coreTierBg(load: number): string {
  if (load >= 90) return "bg-red-500";
  if (load >= 75) return "bg-orange-500";
  if (load >= 50) return "bg-amber-500";
  if (load >= 25) return "bg-cyan-600";
  return "bg-zinc-700";
}

function coreTierText(load: number): string {
  if (load >= 90) return "text-red-400";
  if (load >= 75) return "text-orange-400";
  if (load >= 50) return "text-amber-400";
  if (load >= 25) return "text-cyan-400";
  return "text-zinc-500";
}

function coreTierBorder(load: number): string {
  if (load >= 75) return "border-red-500/50";
  return "border-zinc-700";
}

function coreTierFill(load: number): string {
  if (load >= 90) return "#ef4444";
  if (load >= 75) return "#f97316";
  if (load >= 50) return "#f59e0b";
  if (load >= 25) return "#0891b2";
  return "#3f3f46";
}

interface CoreTileProps {
  coreIndex: number;
  data: MetricSnapshot[];
}

const CoreTile = memo(
  function CoreTile({ coreIndex, data }: CoreTileProps) {
    const sparkData = data.slice(-30).map((s) => s.cpuCores?.[coreIndex] ?? 0);
    const current = sparkData.length > 0 ? sparkData[sparkData.length - 1] : 0;
    const fill = coreTierFill(current);

    const sparkOption: EChartsOption = {
      animation: false,
      grid: { top: 0, right: 0, bottom: 0, left: 0 },
      xAxis: { type: "category", show: false, data: sparkData.map((_, i) => i) },
      yAxis: { type: "value", show: false, min: 0, max: 100 },
      series: [
        {
          type: "line",
          data: sparkData,
          showSymbol: false,
          lineStyle: { color: fill, width: 1 },
          areaStyle: { color: fill, opacity: 0.3 },
        },
      ],
    };

    return (
      <div
        className={`border ${coreTierBorder(current)} bg-zinc-800 rounded p-1.5 flex flex-col h-16`}
      >
        <div className="flex items-start justify-between">
          <span className="text-[10px] text-zinc-400 leading-none">
            C{coreIndex}
          </span>
          <span className={`text-sm font-bold leading-none tabular-nums ${coreTierText(current)}`}>
            {current.toFixed(0)}%
          </span>
        </div>
        <div className="flex-1 mt-1 min-h-0">
          <ReactECharts
            option={sparkOption}
            theme="forgeMonitor"
            style={{ height: "100%", width: "100%" }}
            notMerge={true}
            opts={{ renderer: "canvas", width: "auto", height: "auto" }}
          />
        </div>
      </div>
    );
  },
  (prev, next) => {
    if (prev.coreIndex !== next.coreIndex) return false;
    if (prev.data.length !== next.data.length) return false;
    const prevLast = prev.data[prev.data.length - 1];
    const nextLast = next.data[next.data.length - 1];
    return prevLast?.cpuCores?.[prev.coreIndex] === nextLast?.cpuCores?.[next.coreIndex];
  },
);

export function CpuCard({ snapshots, latest }: Props) {
  const [showCores, setShowCores] = useState(false);

  const cores = latest?.cpuCores ?? [];
  const coreCount = cores.length;

  // Stats
  const maxCore = coreCount > 0 ? Math.max(...cores) : 0;
  const avgCore =
    coreCount > 0 ? cores.reduce((a, b) => a + b, 0) / coreCount : 0;
  const hotCores = cores.filter((c) => c > 75).length;
  const stdDev =
    coreCount > 0
      ? Math.sqrt(
          cores.reduce((sum, c) => sum + (c - avgCore) ** 2, 0) / coreCount,
        )
      : 0;

  const chartData = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    value: Number(s.cpu.toFixed(1)),
  }));

  const option: EChartsOption = {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
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
        name: "CPU %",
        type: "line",
        data: chartData.map((d) => d.value),
        showSymbol: false,
        lineStyle: { color: "#06b6d4", width: 1.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(6,182,212,0.3)" },
            { offset: 1, color: "rgba(6,182,212,0.02)" },
          ]),
        },
        itemStyle: { color: "#06b6d4" },
      },
    ],
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            CPU Usage
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">Overall utilization</p>
        </div>
        <span className="text-2xl font-bold text-cyan-400 tabular-nums font-mono">
          {latest != null ? `${latest.cpu.toFixed(1)}%` : "—"}
        </span>
      </div>

      {/* Stats row */}
      {coreCount > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <span className="text-xs text-zinc-500">
            Avg: <span className="text-zinc-400">{avgCore.toFixed(1)}%</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-zinc-500">
            Hot (&gt;75%): <span className="text-zinc-400">{hotCores} cores</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-zinc-500">
            Max Core: <span className="text-zinc-400">{maxCore.toFixed(1)}%</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-zinc-500">
            Std Dev: <span className="text-zinc-400">{stdDev.toFixed(1)}%</span>
          </span>
        </div>
      )}

      {/* Thermal strip */}
      {coreCount > 0 && (
        <div className="flex flex-wrap gap-0.5 mb-3">
          {cores.map((load, i) => (
            <div
              key={i}
              title={`Core ${i}: ${load.toFixed(1)}%`}
              className={`w-2 h-2 rounded-sm cursor-pointer ${coreTierBg(load)}`}
            />
          ))}
        </div>
      )}

      {/* Main chart */}
      <ReactECharts
        option={option}
        theme="forgeMonitor"
        style={{ height: 160 }}
        notMerge={true}
        opts={{ renderer: "canvas" }}
      />

      {/* Toggle button */}
      {coreCount > 0 && (
        <div className="flex justify-center mt-3">
          <button
            onClick={() => setShowCores((v) => !v)}
            className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-full px-3 py-1 transition-colors cursor-pointer"
          >
            {showCores ? "▲ Hide Cores" : "▼ Show Cores"}
          </button>
        </div>
      )}

      {/* Expandable core grid */}
      {showCores && coreCount > 0 && (
        <div className="grid grid-cols-8 gap-1.5 mt-3">
          {cores.map((_, i) => (
            <CoreTile key={i} coreIndex={i} data={snapshots} />
          ))}
        </div>
      )}
    </div>
  );
}

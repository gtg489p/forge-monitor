import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import type { MetricSnapshot, GpuSnapshot } from "../../types.js";
import { formatTime } from "../lib/format.js";

interface Props {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
  gpuIndex: number;
}

export function GpuCard({ snapshots, latest, gpuIndex }: Props) {
  const gpu: GpuSnapshot | undefined = latest?.gpus?.[gpuIndex];
  if (!gpu) return null;

  const utilData = snapshots.map((s) => ({
    time: formatTime(s.timestamp),
    value: s.gpus?.[gpuIndex]?.utilizationGpu ?? 0,
  }));

  const vramData = snapshots.map((s) => {
    const g = s.gpus?.[gpuIndex];
    if (!g || !g.vramTotal) return 0;
    return Math.round((g.vramUsed / g.vramTotal) * 1000) / 10;
  });

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
    xAxis: {
      type: "category",
      data: utilData.map((d) => d.time),
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
        name: "GPU Util",
        type: "line",
        data: utilData.map((d) => d.value),
        showSymbol: false,
        lineStyle: { color: "#a855f7", width: 1.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(168,85,247,0.3)" },
            { offset: 1, color: "rgba(168,85,247,0.02)" },
          ]),
        },
        itemStyle: { color: "#a855f7" },
      },
      {
        name: "VRAM",
        type: "line",
        data: vramData,
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

  const vramUsedGB = (gpu.vramUsed / 1024).toFixed(1);
  const vramTotalGB = (gpu.vramTotal / 1024).toFixed(1);
  const vramPct = gpu.vramTotal > 0
    ? ((gpu.vramUsed / gpu.vramTotal) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            GPU {gpuIndex}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">
            {gpu.model}
          </p>
        </div>
        <span className="text-2xl font-bold text-purple-400 tabular-nums font-mono">
          {gpu.utilizationGpu.toFixed(0)}%
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="text-xs text-zinc-500">
          VRAM:{" "}
          <span className="text-cyan-400 font-mono">
            {vramUsedGB}/{vramTotalGB} GB ({vramPct}%)
          </span>
        </span>
        {gpu.temperatureGpu > 0 && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">
              Temp: <span className="text-zinc-300 font-mono">{gpu.temperatureGpu}°C</span>
            </span>
          </>
        )}
        {gpu.clockCore > 0 && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">
              Core: <span className="text-zinc-300 font-mono">{gpu.clockCore} MHz</span>
            </span>
          </>
        )}
        {gpu.clockMemory > 0 && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">
              Mem: <span className="text-zinc-300 font-mono">{gpu.clockMemory} MHz</span>
            </span>
          </>
        )}
        {gpu.fanSpeed > 0 && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-500">
              Fan: <span className="text-zinc-300 font-mono">{gpu.fanSpeed}%</span>
            </span>
          </>
        )}
      </div>

      {/* VRAM bar */}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full bg-cyan-500 rounded-full transition-all"
          style={{ width: `${Math.min(100, Number(vramPct))}%` }}
        />
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

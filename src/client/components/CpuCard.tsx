import { useState, memo } from "react";
import { AreaChart } from "@tremor/react";
import {
  AreaChart as ReAreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
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
    const sparkData = data.slice(-30).map((s) => ({
      v: s.cpuCores?.[coreIndex] ?? 0,
    }));
    const current = sparkData.length > 0 ? sparkData[sparkData.length - 1].v : 0;
    const fill = coreTierFill(current);

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
          <ResponsiveContainer width="100%" height="100%">
            <ReAreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Area
                type="monotone"
                dataKey="v"
                stroke={fill}
                fill={fill}
                fillOpacity={0.3}
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            </ReAreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.coreIndex === next.coreIndex &&
    JSON.stringify(prev.data.slice(-30).map((s) => s.cpuCores?.[prev.coreIndex] ?? 0)) ===
      JSON.stringify(next.data.slice(-30).map((s) => s.cpuCores?.[next.coreIndex] ?? 0)),
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
    "CPU %": Number(s.cpu.toFixed(1)),
  }));

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
            Max Core: <span className="text-zinc-400">{maxCore.toFixed(1)}%</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-zinc-500">
            Avg: <span className="text-zinc-400">{avgCore.toFixed(1)}%</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-xs text-zinc-500">
            Hot (&gt;75%): <span className="text-zinc-400">{hotCores} cores</span>
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
      <AreaChart
        className="h-40"
        data={chartData}
        index="time"
        categories={["CPU %"]}
        colors={["cyan"]}
        valueFormatter={(v) => `${v.toFixed(1)}%`}
        showLegend={false}
        showGridLines={true}
        showAnimation={false}
        minValue={0}
        maxValue={100}
        yAxisWidth={45}
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

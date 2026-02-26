import { useState, useMemo } from "react";
import { useMetrics } from "../hooks/useMetrics.js";
import { CpuCard } from "../components/CpuCard.js";
import { MemoryCard } from "../components/MemoryCard.js";
import { DiskCard } from "../components/DiskCard.js";
import { NetworkCard } from "../components/NetworkCard.js";
import { LoadCard } from "../components/LoadCard.js";
import { GpuCard } from "../components/GpuCard.js";
import { TimeSelector } from "../components/TimeSelector.js";
import { downsample } from "../lib/downsample.js";

export function LocalDashboard() {
  const { snapshots, latest, connected } = useMetrics();
  const [horizonMinutes, setHorizonMinutes] = useState(5);

  const windowedSnapshots = useMemo(() => {
    const points = horizonMinutes * 60;
    const sliced = snapshots.slice(-points);
    return downsample(sliced, 300, horizonMinutes * 60 * 1000);
  }, [snapshots, horizonMinutes]);

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Forge Monitor
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time system metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#/pareto"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800 rounded px-2 py-1"
          >
            Pareto Explorer
          </a>
          <TimeSelector value={horizonMinutes} onChange={setHorizonMinutes} />
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected ? "bg-emerald-500 shadow-[0_0_6px_#10b981]" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-zinc-500">
              {connected ? "Live" : "Reconnecting…"}
            </span>
          </div>
        </div>
      </header>

      {/* Row 1: CPU + Memory */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <CpuCard snapshots={windowedSnapshots} latest={latest} />
        <MemoryCard snapshots={windowedSnapshots} latest={latest} />
      </div>

      {/* Row 2: GPUs (if present) */}
      {(latest?.gpus?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 gap-4 mb-4">
          {latest!.gpus!.map((_, i) => (
            <GpuCard
              key={i}
              snapshots={windowedSnapshots}
              latest={latest}
              gpuIndex={i}
            />
          ))}
        </div>
      )}

      {/* Row 3: Disk I/O + Network I/O */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <DiskCard snapshots={windowedSnapshots} latest={latest} />
        <NetworkCard snapshots={windowedSnapshots} latest={latest} />
      </div>

      {/* Row 4: Load Average full-width */}
      <div className="mb-4">
        <LoadCard snapshots={windowedSnapshots} latest={latest} />
      </div>

      <footer className="mt-6 text-center text-xs text-zinc-700">
        Updates every 1 s · 18000 point ring buffer (5 h history)
      </footer>
    </div>
  );
}

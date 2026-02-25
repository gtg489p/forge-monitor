import { useState, useEffect } from "react";
import { useFleet } from "../hooks/useFleet.js";
import { NodeCard } from "../components/NodeCard.js";
import { FleetSummaryBar } from "../components/FleetSummaryBar.js";

interface Props {
  onNodeClick: (nodeId: string) => void;
}

export function FleetOverview({ onNodeClick }: Props) {
  const { nodes, connected } = useFleet();
  const nodeList = Array.from(nodes.values());
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/jobs/counts-by-worker")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, number>) => setJobCounts(data))
      .catch(() => {});
    const iv = setInterval(() => {
      fetch("/api/jobs/counts-by-worker")
        .then((r) => (r.ok ? r.json() : {}))
        .then((data: Record<string, number>) => setJobCounts(data))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Forge Monitor
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Fleet Overview</p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="#/pareto"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800 rounded px-2 py-1"
          >
            Pareto Explorer
          </a>
          <a
            href="#/jobs"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800 rounded px-2 py-1"
          >
            Job Queue
          </a>
          <FleetSummaryBar nodes={nodeList} />
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

      {nodeList.length === 0 ? (
        <div className="text-center text-zinc-600 mt-24">
          <p className="text-lg mb-2">No nodes registered yet.</p>
          <p className="text-sm">
            Deploy an agent to a server to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {nodeList.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              activeJobs={jobCounts[node.id] ?? 0}
              onClick={() => onNodeClick(node.id)}
            />
          ))}
        </div>
      )}

      <footer className="mt-6 text-center text-xs text-zinc-700">
        Fleet updates every 2 s · agent pushes every 5 s
      </footer>
    </div>
  );
}

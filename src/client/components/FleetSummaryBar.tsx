import type { NodeWithStatus } from "../hooks/useFleet.js";

interface Props {
  nodes: NodeWithStatus[];
}

export function FleetSummaryBar({ nodes }: Props) {
  const online = nodes.filter((n) => n.status === "online").length;
  const busiest = nodes
    .filter((n) => n.latest != null)
    .sort((a, b) => (b.latest!.cpu - a.latest!.cpu))[0];

  return (
    <div className="flex items-center gap-4 text-sm text-zinc-400">
      <span>
        <span className="text-zinc-200 font-mono">{nodes.length}</span> nodes
      </span>
      <span>
        <span className="text-emerald-400 font-mono">{online}</span> online
      </span>
      {busiest && (
        <span>
          busiest:{" "}
          <span className="text-zinc-300">{busiest.name}</span>{" "}
          <span className="font-mono text-zinc-200">{busiest.latest!.cpu.toFixed(1)}%</span>
        </span>
      )}
    </div>
  );
}

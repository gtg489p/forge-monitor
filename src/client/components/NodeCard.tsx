import { memo } from "react";
import type { NodeWithStatus } from "../hooks/useFleet.js";
import { NodeSparkline } from "./NodeSparkline.js";

interface Props {
  node: NodeWithStatus;
  activeJobs?: number;
  onClick?: () => void;
}

const STATUS_DOT: Record<NodeWithStatus["status"], string> = {
  online: "bg-emerald-500 shadow-[0_0_6px_#10b981]",
  degraded: "bg-yellow-500",
  offline: "bg-red-500",
};

export const NodeCard = memo(function NodeCard({ node, activeJobs, onClick }: Props) {
  const cpu = node.latest?.cpu ?? 0;
  const mem = node.latest?.memory.percent ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block flex-shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[node.status]}`} />
          <span className="text-sm font-medium text-zinc-200 truncate">{node.name}</span>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {activeJobs != null && activeJobs > 0 && (
            <span className="text-xs bg-amber-900 text-amber-300 px-1.5 py-0.5 rounded font-medium">
              {activeJobs} job{activeJobs !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-zinc-500">{node.status}</span>
        </div>
      </div>

      <div className="flex gap-4 text-xs text-zinc-400 mb-2">
        <span>
          CPU{" "}
          <span className="text-zinc-200 font-mono">{cpu.toFixed(1)}%</span>
        </span>
        <span>
          Mem{" "}
          <span className="text-zinc-200 font-mono">{mem.toFixed(1)}%</span>
        </span>
      </div>

      <NodeSparkline snapshots={node.history} />
    </button>
  );
});

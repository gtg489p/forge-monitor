import type { JobStatus } from "../../types.js";

const STYLES: Record<JobStatus, string> = {
  pending: "bg-zinc-700 text-zinc-300",
  assigned: "bg-blue-900 text-blue-300",
  running: "bg-amber-900 text-amber-300",
  completed: "bg-emerald-900 text-emerald-300",
  failed: "bg-red-900 text-red-300",
  quarantined: "bg-purple-900 text-purple-300",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}

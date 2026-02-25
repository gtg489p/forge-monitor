import { memo } from "react";
import type { Job } from "../../types.js";
import { JobStatusBadge } from "./JobStatusBadge.js";

interface Props {
  job: Job;
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function duration(start: number | null, end: number | null): string {
  if (!start) return "—";
  const ms = (end ?? Date.now()) - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export const JobCard = memo(function JobCard({ job }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-zinc-400 font-mono text-xs truncate">
            {job.id.slice(0, 8)}
          </span>
          <span className="text-zinc-200 font-medium">{job.type}</span>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
        <span>
          created <span className="text-zinc-400">{timeAgo(job.created_at)}</span>
        </span>
        {job.worker_id && (
          <span>
            worker <span className="text-zinc-400 font-mono">{job.worker_id}</span>
          </span>
        )}
        {job.claimed_at && (
          <span>
            runtime{" "}
            <span className="text-zinc-400">
              {duration(job.claimed_at, job.completed_at)}
            </span>
          </span>
        )}
        <span>
          attempts{" "}
          <span className="text-zinc-400">
            {job.attempts}/{job.max_attempts}
          </span>
        </span>
        {job.priority > 0 && (
          <span>
            priority <span className="text-zinc-400">{job.priority}</span>
          </span>
        )}
      </div>

      {job.fail_reason && (
        <div className="mt-1.5 text-xs text-red-400 truncate">
          {job.fail_reason}
        </div>
      )}
    </div>
  );
});

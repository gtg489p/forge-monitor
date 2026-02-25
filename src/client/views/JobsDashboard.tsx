import { useState } from "react";
import { useJobs } from "../hooks/useJobs.js";
import { JobCard } from "../components/JobCard.js";
import type { JobStatus } from "../../types.js";

const FILTERS: { label: string; value: JobStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Pending", value: "pending" },
  { label: "Running", value: "running" },
  { label: "Completed", value: "completed" },
  { label: "Failed", value: "failed" },
  { label: "Quarantined", value: "quarantined" },
];

interface Props {
  onBack: () => void;
}

export function JobsDashboard({ onBack }: Props) {
  const [filter, setFilter] = useState<JobStatus | undefined>(undefined);
  const { jobs, connected } = useJobs(filter);

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            &larr; Fleet
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              Job Queue
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-emerald-500 shadow-[0_0_6px_#10b981]" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-zinc-500">
            {connected ? "Live" : "Reconnecting\u2026"}
          </span>
        </div>
      </header>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-zinc-700 text-zinc-100"
                : "bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {jobs.length === 0 ? (
        <div className="text-center text-zinc-600 mt-24">
          <p className="text-lg mb-2">No jobs found.</p>
          <p className="text-sm">
            Create jobs via the API: POST /api/jobs
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      <footer className="mt-6 text-center text-xs text-zinc-700">
        Live updates via SSE · Read-only dashboard
      </footer>
    </div>
  );
}

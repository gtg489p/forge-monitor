import { useState, useEffect, useCallback } from "react";
import type { Job, JobStatus } from "../../types.js";

export interface JobsState {
  jobs: Job[];
  connected: boolean;
  refresh: () => void;
}

export function useJobs(statusFilter?: JobStatus): JobsState {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [connected, setConnected] = useState(false);

  const fetchJobs = useCallback(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/jobs?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Job[]) => setJobs(data))
      .catch(() => {});
  }, [statusFilter]);

  useEffect(() => {
    fetchJobs();

    // SSE for live updates
    const es = new EventSource("/api/jobs/events");
    let cancelled = false;

    es.onopen = () => {
      if (!cancelled) setConnected(true);
    };

    es.addEventListener("job:created", () => { if (!cancelled) fetchJobs(); });
    es.addEventListener("job:assigned", () => { if (!cancelled) fetchJobs(); });
    es.addEventListener("job:completed", () => { if (!cancelled) fetchJobs(); });
    es.addEventListener("job:failed", () => { if (!cancelled) fetchJobs(); });
    es.addEventListener("job:quarantined", () => { if (!cancelled) fetchJobs(); });

    // Also handle generic message events (broadcastJobEvent sends with event: prefix in data)
    es.onmessage = () => {
      if (!cancelled) fetchJobs();
    };

    es.onerror = () => {
      if (!cancelled) setConnected(false);
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [fetchJobs]);

  return { jobs, connected, refresh: fetchJobs };
}

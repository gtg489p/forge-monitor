export interface MetricSnapshot {
  timestamp: number;
  cpu: number; // percentage 0-100
  cpuCores: number[]; // per-core load percentages 0-100
  memory: {
    percent: number; // 0-100
    used: number; // GB
    total: number; // GB
  };
  disk: {
    read: number; // MB/s
    write: number; // MB/s
  };
  network: {
    rx: number; // MB/s
    tx: number; // MB/s
  };
  load: {
    avg1: number;
    avg5: number;
    avg15: number;
  };
}

// ---------------------------------------------------------------------------
// Job Queue Types
// ---------------------------------------------------------------------------

export type JobStatus =
  | "pending"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "quarantined";

export interface Job {
  id: string;
  type: string;
  params: string;           // JSON blob
  status: JobStatus;
  priority: number;
  worker_id: string | null;
  result: string | null;    // JSON blob
  result_hash: string | null;
  created_at: number;
  claimed_at: number | null;
  heartbeat_at: number | null;
  completed_at: number | null;
  attempts: number;
  max_attempts: number;
  max_runtime_ms: number;
  fail_reason: string | null;
  fail_history: string;     // JSON array
  solver_url: string | null;
  solver_checksum: string | null;
}

export interface WorkerRecord {
  id: string;
  name: string | null;
  cores: number;
  ram_gb: number;
  tags: string;             // JSON array
  registered_at: number;
  last_heartbeat: number | null;
}

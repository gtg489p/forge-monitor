import { getDb } from "./db.js";
import type { Job, WorkerRecord } from "../types.js";

// ---------------------------------------------------------------------------
// Create job
// ---------------------------------------------------------------------------

export function createJob(input: {
  type: string;
  params?: string;
  priority?: number;
  max_attempts?: number;
  max_runtime_ms?: number;
  solver_url?: string;
  solver_checksum?: string;
}): Job {
  const db = getDb();
  const row = db
    .prepare(
      `INSERT INTO jobs (type, params, priority, max_attempts, max_runtime_ms, solver_url, solver_checksum)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      input.type,
      input.params ?? "{}",
      input.priority ?? 0,
      input.max_attempts ?? 3,
      input.max_runtime_ms ?? 300000,
      input.solver_url ?? null,
      input.solver_checksum ?? null
    ) as Job;
  return row;
}

// ---------------------------------------------------------------------------
// Get single job
// ---------------------------------------------------------------------------

export function getJob(id: string): Job | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job) ?? null;
}

// ---------------------------------------------------------------------------
// List jobs (with optional status filter)
// ---------------------------------------------------------------------------

export function listJobs(opts: {
  status?: string;
  limit?: number;
  offset?: number;
}): Job[] {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  if (opts.status) {
    return db
      .prepare(
        "SELECT * FROM jobs WHERE status = ? ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?"
      )
      .all(opts.status, limit, offset) as Job[];
  }
  return db
    .prepare(
      "SELECT * FROM jobs ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?"
    )
    .all(limit, offset) as Job[];
}

// ---------------------------------------------------------------------------
// Claim job (atomic)
// ---------------------------------------------------------------------------

export function claimJob(
  workerId: string,
  types?: string[]
): Job | null {
  const db = getDb();
  const txn = db.transaction(() => {
    let query: string;
    let params: unknown[];

    if (types?.length) {
      const placeholders = types.map(() => "?").join(",");
      query = `SELECT * FROM jobs WHERE status = 'pending' AND type IN (${placeholders}) ORDER BY priority DESC, created_at ASC LIMIT 1`;
      params = types;
    } else {
      query = `SELECT * FROM jobs WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1`;
      params = [];
    }

    const job = db.prepare(query).get(...params) as Job | undefined;
    if (!job) return null;

    const now = Date.now();
    db.prepare(
      `UPDATE jobs SET status = 'assigned', worker_id = ?, claimed_at = ?, heartbeat_at = ?, attempts = attempts + 1 WHERE id = ?`
    ).run(workerId, now, now, job.id);

    return { ...job, status: "assigned" as const, worker_id: workerId, claimed_at: now, heartbeat_at: now, attempts: job.attempts + 1 };
  });

  return txn();
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

export function heartbeatJob(
  jobId: string,
  workerId: string
): { ok: boolean; conflict: boolean } {
  const db = getDb();
  const job = db.prepare("SELECT worker_id, status FROM jobs WHERE id = ?").get(jobId) as
    | { worker_id: string; status: string }
    | undefined;

  if (!job) return { ok: false, conflict: false };
  if (job.worker_id !== workerId) return { ok: false, conflict: true };

  // Also transition assigned → running on first heartbeat after exec start
  const newStatus = job.status === "assigned" ? "running" : job.status;
  db.prepare("UPDATE jobs SET heartbeat_at = ?, status = ? WHERE id = ?").run(
    Date.now(),
    newStatus,
    jobId
  );
  return { ok: true, conflict: false };
}

// ---------------------------------------------------------------------------
// Submit result (idempotent)
// ---------------------------------------------------------------------------

export function submitResult(
  jobId: string,
  workerId: string,
  result: string,
  resultHash?: string,
  idempotencyKey?: string
): { ok: boolean; conflict: boolean; duplicate: boolean } {
  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Job | undefined;
  if (!job) return { ok: false, conflict: false, duplicate: false };

  // Idempotency check — already completed with same hash
  if (job.status === "completed") {
    const key = idempotencyKey ?? resultHash;
    if (key && job.result_hash === key) {
      return { ok: true, conflict: false, duplicate: true };
    }
    return { ok: false, conflict: true, duplicate: false };
  }

  if (job.worker_id !== workerId) return { ok: false, conflict: true, duplicate: false };

  db.prepare(
    `UPDATE jobs SET status = 'completed', result = ?, result_hash = ?, completed_at = ? WHERE id = ?`
  ).run(result, resultHash ?? null, Date.now(), jobId);

  return { ok: true, conflict: false, duplicate: false };
}

// ---------------------------------------------------------------------------
// Fail job
// ---------------------------------------------------------------------------

export function failJob(
  jobId: string,
  workerId: string,
  reason: string
): { ok: boolean; conflict: boolean; newStatus: string } {
  const db = getDb();
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Job | undefined;
  if (!job) return { ok: false, conflict: false, newStatus: "" };
  if (job.worker_id !== workerId) return { ok: false, conflict: true, newStatus: "" };

  const history: unknown[] = JSON.parse(job.fail_history);
  history.push({ reason, worker_id: workerId, ts: Date.now() });

  const newAttempts = job.attempts; // already incremented on claim
  const newStatus = newAttempts >= job.max_attempts ? "quarantined" : "pending";

  db.prepare(
    `UPDATE jobs SET status = ?, worker_id = CASE WHEN ? = 'pending' THEN NULL ELSE worker_id END,
     claimed_at = CASE WHEN ? = 'pending' THEN NULL ELSE claimed_at END,
     heartbeat_at = CASE WHEN ? = 'pending' THEN NULL ELSE heartbeat_at END,
     fail_reason = ?, fail_history = ? WHERE id = ?`
  ).run(newStatus, newStatus, newStatus, newStatus, reason, JSON.stringify(history), jobId);

  return { ok: true, conflict: false, newStatus };
}

// ---------------------------------------------------------------------------
// Cancel job
// ---------------------------------------------------------------------------

export function cancelJob(id: string): boolean {
  const db = getDb();
  const res = db
    .prepare(
      `UPDATE jobs SET status = 'failed', fail_reason = 'cancelled' WHERE id = ? AND status IN ('pending', 'assigned')`
    )
    .run(id);
  return res.changes > 0;
}

// ---------------------------------------------------------------------------
// Reaper — reclaim stale jobs
// ---------------------------------------------------------------------------

export function reapStaleJobs(): { reclaimed: number; quarantined: number; timedOut: number } {
  const db = getDb();
  const now = Date.now();

  // 1. Reclaim jobs where heartbeat timed out (60s)
  const stale = db
    .prepare(
      `UPDATE jobs
       SET status = 'pending', worker_id = NULL, claimed_at = NULL, heartbeat_at = NULL
       WHERE status IN ('assigned', 'running')
         AND heartbeat_at < ?
         AND attempts < max_attempts
       RETURNING id`
    )
    .all(now - 60_000);

  // 2. Quarantine jobs that exceeded max_attempts
  const qRes = db
    .prepare(
      `UPDATE jobs SET status = 'quarantined'
       WHERE status = 'pending' AND attempts >= max_attempts`
    )
    .run();

  // 3. Quarantine jobs that exceeded max_runtime_ms
  const tRes = db
    .prepare(
      `UPDATE jobs SET status = 'quarantined', fail_reason = 'max_runtime_exceeded'
       WHERE status IN ('assigned', 'running')
         AND claimed_at IS NOT NULL
         AND (? - claimed_at) > max_runtime_ms`
    )
    .run(now);

  return {
    reclaimed: stale.length,
    quarantined: qRes.changes,
    timedOut: tRes.changes,
  };
}

// ---------------------------------------------------------------------------
// Register / update worker
// ---------------------------------------------------------------------------

export function registerWorker(input: {
  worker_id: string;
  name?: string;
  cores: number;
  ram_gb: number;
  tags: string[];
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO workers (id, name, cores, ram_gb, tags, last_heartbeat)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = COALESCE(excluded.name, workers.name),
       cores = excluded.cores,
       ram_gb = excluded.ram_gb,
       tags = excluded.tags,
       last_heartbeat = excluded.last_heartbeat`
  ).run(
    input.worker_id,
    input.name ?? null,
    input.cores,
    input.ram_gb,
    JSON.stringify(input.tags),
    Date.now()
  );
}

// ---------------------------------------------------------------------------
// Job counts by worker (for dashboard badges)
// ---------------------------------------------------------------------------

export function jobCountsByWorker(): Map<string, number> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT worker_id, COUNT(*) as count FROM jobs
       WHERE status IN ('assigned', 'running') AND worker_id IS NOT NULL
       GROUP BY worker_id`
    )
    .all() as { worker_id: string; count: number }[];

  const map = new Map<string, number>();
  for (const row of rows) map.set(row.worker_id, row.count);
  return map;
}

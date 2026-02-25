# Job Queue Implementation Spec

> Written 2026-02-25. Current state: Fleet monitoring complete (Phase 1+2 done). Hub is in-memory, Bun/Hono. This spec implements Phase 3: distributed job dispatch.

---

## 1. SQLite Schema

The hub currently stores fleet state in-memory (`Map<string, NodeRecord>`). Job queue requires persistence. Add SQLite via `bun:sqlite`.

```sql
-- file: src/hub/db.ts — run on hub startup

CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type            TEXT NOT NULL,                    -- e.g. "prodplan", "benchmark"
  params          TEXT NOT NULL DEFAULT '{}',       -- JSON blob, solver-specific
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','assigned','running','completed','failed','quarantined')),
  priority        INTEGER NOT NULL DEFAULT 0,       -- higher = more important
  worker_id       TEXT,                             -- node_id of claiming worker
  result          TEXT,                             -- JSON blob, solver output
  result_hash     TEXT,                             -- sha256 of result for idempotency
  created_at      INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000),
  claimed_at      INTEGER,
  heartbeat_at    INTEGER,
  completed_at    INTEGER,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  max_runtime_ms  INTEGER NOT NULL DEFAULT 300000,  -- 5 min default
  fail_reason     TEXT,
  fail_history    TEXT NOT NULL DEFAULT '[]',        -- JSON array of {reason, worker_id, ts}
  solver_url      TEXT,                             -- URL to download solver binary/script
  solver_checksum TEXT                              -- sha256 of solver for verification
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_priority
  ON jobs(status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_jobs_worker
  ON jobs(worker_id, status);

CREATE TABLE IF NOT EXISTS workers (
  id              TEXT PRIMARY KEY,                  -- matches node_id from fleet
  name            TEXT,
  cores           INTEGER NOT NULL DEFAULT 1,
  ram_gb          REAL NOT NULL DEFAULT 1.0,
  tags            TEXT NOT NULL DEFAULT '[]',        -- JSON array, e.g. ["gpu","ephemeral"]
  registered_at   INTEGER NOT NULL DEFAULT (unixepoch('now','subsec') * 1000),
  last_heartbeat  INTEGER
);
```

**SQLite config (set on connection open):**
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
```

---

## 2. Hub Routes (new)

All job routes mount under the existing hub-mode Hono app. Auth: same `FORGE_INGEST_SECRET` bearer token.

### Job Management (called by producers — CLI, API, dashboard)

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `POST` | `/api/jobs` | Bearer | Enqueue job. Body: `{type, params, priority?, max_attempts?, max_runtime_ms?, solver_url?, solver_checksum?}`. Returns `{id, status}`. |
| `GET` | `/api/jobs` | Bearer | List jobs. Query: `?status=pending&limit=50&offset=0`. Returns `Job[]`. |
| `GET` | `/api/jobs/:id` | Bearer | Get single job detail. Returns `Job`. |
| `DELETE` | `/api/jobs/:id` | Bearer | Cancel job (only if `pending` or `assigned`). Sets status to `failed`, fail_reason to `"cancelled"`. Returns 204. |

### Worker Endpoints (called by agent/worker)

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `POST` | `/api/workers/register` | Bearer | Register/update worker capabilities. Body: `{worker_id, name?, cores, ram_gb, tags}`. Upserts into `workers` table. Returns 204. |
| `POST` | `/api/jobs/claim` | Bearer | Atomically claim next available job. Body: `{worker_id, types?}`. Uses `BEGIN IMMEDIATE`. Filters by worker capability if `types` specified. Returns `Job \| null` (204 if no job). |
| `POST` | `/api/jobs/:id/heartbeat` | Bearer | Worker heartbeat for running job. Body: `{worker_id}`. Updates `heartbeat_at`. Returns 204. 409 if job not assigned to this worker. |
| `POST` | `/api/jobs/:id/result` | Bearer | Submit result. Body: `{worker_id, result, result_hash?}`. Header: `X-Idempotency-Key` (optional, falls back to `result_hash`). Idempotent — duplicate submission returns 200 (not error). Sets status to `completed`, `completed_at`. Returns 200. |
| `POST` | `/api/jobs/:id/fail` | Bearer | Report failure. Body: `{worker_id, reason}`. Increments `attempts`, appends to `fail_history`. If `attempts >= max_attempts` → `quarantined`. Else → `pending` (re-queued). Returns 200. |

### SSE (dashboard)

| Method | Path | Auth | Behavior |
|--------|------|------|----------|
| `GET` | `/api/jobs/events` | None | SSE stream. Pushes job state changes to connected dashboards. Events: `job:created`, `job:assigned`, `job:completed`, `job:failed`, `job:quarantined`. |

### Claim Logic (critical path)

```typescript
function claimJob(workerId: string, types?: string[]): Job | null {
  const db = getDb();
  // BEGIN IMMEDIATE prevents concurrent claims
  const txn = db.transaction(() => {
    // Find highest-priority pending job this worker can handle
    let query = `
      SELECT * FROM jobs
      WHERE status = 'pending'
      ${types?.length ? `AND type IN (${types.map(() => '?').join(',')})` : ''}
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
    `;
    const job = db.prepare(query).get(...(types ?? []));
    if (!job) return null;

    db.prepare(`
      UPDATE jobs
      SET status = 'assigned', worker_id = ?, claimed_at = ?, heartbeat_at = ?, attempts = attempts + 1
      WHERE id = ?
    `).run(workerId, Date.now(), Date.now(), job.id);

    return { ...job, status: 'assigned', worker_id: workerId };
  });
  return txn();
}
```

### Reaper (stale job reclaimer)

Runs on hub every 15 seconds:

```typescript
function reapStaleJobs(): void {
  const now = Date.now();
  const db = getDb();

  // 1. Reclaim jobs where heartbeat timed out (60s)
  const stale = db.prepare(`
    UPDATE jobs
    SET status = 'pending', worker_id = NULL, claimed_at = NULL, heartbeat_at = NULL
    WHERE status IN ('assigned', 'running')
      AND heartbeat_at < ?
      AND attempts < max_attempts
    RETURNING id, worker_id
  `).all(now - 60_000);

  // 2. Quarantine jobs that exceeded max_attempts
  db.prepare(`
    UPDATE jobs
    SET status = 'quarantined'
    WHERE status = 'pending'
      AND attempts >= max_attempts
  `).run();

  // 3. Quarantine jobs that exceeded max_runtime_ms
  db.prepare(`
    UPDATE jobs
    SET status = 'quarantined', fail_reason = 'max_runtime_exceeded'
    WHERE status IN ('assigned', 'running')
      AND claimed_at IS NOT NULL
      AND (? - claimed_at) > max_runtime_ms
  `).run(now);

  if (stale.length > 0) {
    console.log(`[reaper] reclaimed ${stale.length} stale jobs`);
  }
}

// Start on hub boot
setInterval(reapStaleJobs, 15_000);
```

---

## 3. Worker Agent Design (Bun, v1)

Extends the existing `agent/agent.ts`. The agent already pushes metrics. Add job execution alongside.

### New env vars

```env
# Existing
HUB_URL=https://your-hub.railway.app
NODE_ID=worker-01
FORGE_INGEST_SECRET=...
NODE_NAME=Worker 01
PUSH_INTERVAL_MS=5000

# New for job queue
WORKER_ENABLED=true              # opt-in to job execution (default false)
WORKER_CORES=8                   # advertised core count
WORKER_RAM_GB=16                 # advertised RAM
WORKER_TAGS=[]                   # JSON array, e.g. ["gpu","ephemeral"]
WORKER_TYPES=[]                  # JSON array of job types to accept, empty = all
JOB_POLL_INTERVAL_MS=5000        # how often to poll for jobs (default 5s)
SOLVER_CACHE_DIR=~/.forge-monitor/solvers  # where to cache downloaded solvers
```

### Worker lifecycle

```
1. Startup
   ├── Register capabilities: POST /api/workers/register
   ├── Start metrics push loop (existing, unchanged)
   └── Start job poll loop (new)

2. Job poll loop (every JOB_POLL_INTERVAL_MS)
   ├── POST /api/jobs/claim {worker_id, types}
   ├── If null → sleep, retry next interval
   └── If job claimed → execute job

3. Execute job
   ├── Download solver if solver_url present
   │   ├── Check SOLVER_CACHE_DIR for cached binary matching solver_checksum
   │   ├── If miss → download, verify sha256, cache
   │   └── If checksum mismatch → fail job ("solver_checksum_mismatch")
   ├── Set job status to "running": POST /api/jobs/:id/heartbeat
   ├── Spawn solver as subprocess: Bun.spawn([solverPath, '--params', JSON.stringify(job.params)])
   ├── Start heartbeat loop: POST /api/jobs/:id/heartbeat every 10s
   ├── Wait for subprocess to complete (timeout: job.max_runtime_ms)
   ├── On success → POST /api/jobs/:id/result {result, result_hash: sha256(result)}
   └── On failure → POST /api/jobs/:id/fail {reason}

4. After job completes → return to step 2 (immediate re-poll, no delay)
```

### Key design points

- **One job at a time** per worker (v1). Simplifies heartbeat, subprocess management, resource accounting. Multi-job = v2.
- **Solver as subprocess.** Workers never embed solver logic. Hub sends `solver_url` + `solver_checksum` per job. Worker downloads, verifies sha256, caches locally, runs as child process. Solver updates are independent of worker updates.
- **Heartbeat goroutine.** Separate `setInterval` during job execution. 10s interval. If hub doesn't hear in 60s, reaper reclaims the job.
- **Graceful shutdown.** On SIGINT/SIGTERM: finish current job (give it 30s), then exit. Don't claim new jobs.
- **No inbound ports.** All communication is outbound HTTP to hub. Worker behind NAT is fine.

### File structure

```
agent/
├── agent.ts          # MODIFY — add worker registration + job loop
├── worker.ts         # NEW — job claim, execute, heartbeat, solver download
├── solver-cache.ts   # NEW — download/verify/cache solver binaries
├── .env.example      # MODIFY — add new env vars
├── install.sh        # unchanged
└── install.ps1       # unchanged
```

---

## 4. State Machine

```
                    ┌─────────────────────────────┐
                    │                             │
                    ▼                             │
  ┌─────────┐   claim   ┌──────────┐   start   ┌─────────┐
  │ pending  │ ────────► │ assigned │ ────────► │ running │
  └─────────┘           └──────────┘           └─────────┘
       ▲                     │                    │    │
       │                     │ heartbeat          │    │
       │                     │ timeout            │    │
       │                     │ (< max_attempts)   │    │
       │                     ▼                    │    │
       └──── re-queue ◄─── reaper                │    │
                                                  │    │
                            ┌─────────────┐       │    │
                            │ completed   │ ◄─────┘    │
                            └─────────────┘            │
                                                       │
                            ┌─────────────┐            │
                            │   failed    │ ◄──────────┘
                            └─────────────┘    (attempts < max)
                                  │                    │
                                  │ re-queued          │
                                  ▼                    │
                            ┌─────────────┐            │
                            │ quarantined │ ◄──────────┘
                            └─────────────┘  (attempts >= max
                                              OR max_runtime exceeded)
```

Transitions:
- `pending → assigned`: worker claims via `POST /api/jobs/claim`
- `assigned → running`: worker sends first heartbeat after starting subprocess
- `running → completed`: worker submits result
- `running → failed → pending`: worker reports failure, attempts < max_attempts → re-queue
- `running → quarantined`: attempts >= max_attempts OR max_runtime exceeded
- `assigned/running → pending`: reaper reclaims (heartbeat timeout 60s, attempts < max)
- `assigned/running → quarantined`: reaper reclaims but attempts >= max_attempts
- `pending/assigned → failed`: manual cancel via `DELETE /api/jobs/:id`

---

## 5. Railway Setup

### Persistent Volume (required)

SQLite needs a persistent volume on Railway. Without it, the database is wiped on every deploy.

```
Railway Dashboard → forge-monitor service → Settings → Volumes
Mount path: /data
Size: 1 GB (sufficient for millions of job records)
```

**Env var:**
```
SQLITE_PATH=/data/forge-monitor.sqlite
```

The hub opens the database at this path. Locally (`HUB_MODE=true` without Railway), defaults to `./forge-monitor.sqlite`.

### Env vars (complete set for hub)

```env
HUB_MODE=true
FORGE_INGEST_SECRET=<generate-strong-token>
SQLITE_PATH=/data/forge-monitor.sqlite    # Railway persistent volume
PORT=3000                                 # Railway auto-sets this
```

### WAL Mode

WAL mode is set via PRAGMA on connection open. This is safe on Railway's persistent volume (single-process, single-hub). WAL gives concurrent reads during writes — important because the reaper writes while HTTP handlers read.

---

## 6. Files to Create/Modify

### New files

| File | Purpose | ~Lines |
|------|---------|--------|
| `src/hub/db.ts` | SQLite connection, schema init, pragmas, `getDb()` singleton | ~60 |
| `src/hub/jobs.ts` | All job routes: CRUD, claim, result, fail, SSE events, reaper | ~250 |
| `src/hub/jobs-db.ts` | Database query functions: claimJob, createJob, updateJob, listJobs, reapStaleJobs | ~150 |
| `agent/worker.ts` | Job claim loop, solver execution, heartbeat, graceful shutdown | ~180 |
| `agent/solver-cache.ts` | Download solver from URL, verify sha256, cache on disk | ~60 |
| `src/types.ts` | Add `Job`, `Worker`, `JobStatus` types (extend existing file) | +40 |
| `src/client/views/JobsDashboard.tsx` | Job queue dashboard view: table of jobs, status filters, SSE live updates | ~120 |
| `src/client/hooks/useJobs.ts` | SSE + REST hook for job dashboard | ~60 |
| `src/client/components/JobCard.tsx` | Single job row: type, status, worker, timing, result preview | ~50 |
| `src/client/components/JobStatusBadge.tsx` | Colored badge for job status | ~25 |

### Modified files

| File | Changes |
|------|---------|
| `src/server.ts` | Import and mount job routes in hub mode. Initialize SQLite on startup. |
| `src/hub/ingest.ts` | No changes — job routes are separate. |
| `src/hub/nodes.ts` | Add worker capability lookup (join with `workers` table for fleet display). |
| `src/client/router.tsx` | Add `#/jobs` route → `JobsDashboard`. |
| `src/client/views/FleetOverview.tsx` | Add job count badge per node (query from jobs where worker_id = node). |
| `src/client/components/NodeCard.tsx` | Show active job count chip. |
| `agent/agent.ts` | Import worker module, call `startWorker()` if `WORKER_ENABLED=true`. Register worker capabilities on startup. |
| `agent/.env.example` | Add new env vars. |
| `package.json` | No new dependencies — `bun:sqlite` is built-in, `crypto` for sha256 is built-in. |

---

## 7. Implementation Order

Each step is independently testable before proceeding.

### Phase A — Database + Core API

1. **`src/hub/db.ts`** — SQLite singleton, schema creation, pragmas.
   Test: `bun run src/hub/db.ts` creates `forge-monitor.sqlite` with tables.

2. **`src/types.ts`** — Add `Job`, `JobStatus`, `WorkerRecord` types.

3. **`src/hub/jobs-db.ts`** — Database functions: `createJob()`, `claimJob()`, `getJob()`, `listJobs()`, `submitResult()`, `failJob()`, `cancelJob()`, `reapStaleJobs()`, `registerWorker()`.
   Test: unit-test the claim logic with concurrent transactions.

4. **`src/hub/jobs.ts`** — Hono routes mounting all endpoints from section 2. Wire up reaper interval.
   Test: `curl -X POST /api/jobs` to create, `curl -X POST /api/jobs/claim` to claim, etc.

5. **`src/server.ts`** — Import db init + job routes in hub mode.
   Test: `HUB_MODE=true bun run src/server.ts`, verify `/api/jobs` returns `[]`.

### Phase B — Worker Agent

6. **`agent/solver-cache.ts`** — Solver download, sha256 verify, disk cache.
   Test: download a test URL, verify checksum matches.

7. **`agent/worker.ts`** — Job poll loop, subprocess execution, heartbeat, graceful shutdown.
   Test: create a job via curl, start agent with `WORKER_ENABLED=true`, watch it claim and execute.

8. **`agent/agent.ts`** — Integrate worker startup (conditional on `WORKER_ENABLED`).
   Test: full flow — agent pushes metrics AND claims/runs jobs.

### Phase C — Dashboard

9. **`src/client/hooks/useJobs.ts`** — REST fetch + SSE for live job updates.

10. **`src/client/components/JobStatusBadge.tsx`** + **`JobCard.tsx`** — UI components.

11. **`src/client/views/JobsDashboard.tsx`** — Job table with status filters, live updates.

12. **`src/client/router.tsx`** — Add `#/jobs` route.

13. **`src/client/views/FleetOverview.tsx`** + **`NodeCard.tsx`** — Add job count badges.

### Phase D — Hardening

14. **Reaper tuning** — Verify reaper correctly reclaims stale jobs under load. Add logging.

15. **Idempotent result submission** — Verify `X-Idempotency-Key` / `result_hash` dedup works.

16. **Graceful agent shutdown** — Test SIGINT during active job. Verify job completes or is re-queued.

17. **Railway deployment** — Add persistent volume, set `SQLITE_PATH`, deploy, verify persistence across redeploys.

---

## 8. What This Spec Does NOT Include (deliberate)

- **Job dependencies / DAG engine.** Not in v1. Producers enqueue jobs in dependency order externally.
- **Multi-job per worker.** v1 = one job at a time. Simpler heartbeat, resource tracking.
- **Go worker binary.** v2 for wider distribution. Bun worker ships first.
- **PostgreSQL migration.** Only needed when scaling to multiple hub instances. SQLite handles thousands of jobs/workers fine.
- **SSE job channel to workers.** Workers poll. SSE push to workers is a v2 optimization (reduces claim latency from 5s avg to ~instant). Polling is simpler and works through proxies/firewalls.
- **Capability-based routing.** The `workers` table stores capabilities and tags from day 1, but v1 claim logic only filters by `types`. Advanced routing (match job requirements to worker capabilities) = v2.
- **Dashboard job creation UI.** v1 jobs are created via API/CLI. Dashboard is read-only.

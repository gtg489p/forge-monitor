import { createHash } from "crypto";
import { getSolver } from "./solver-cache.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const HUB_URL = process.env.HUB_URL?.replace(/\/$/, "");
const NODE_ID = process.env.NODE_ID;
const SECRET = process.env.FORGE_INGEST_SECRET;
const WORKER_CORES = Number(process.env.WORKER_CORES ?? 1);
const WORKER_RAM_GB = Number(process.env.WORKER_RAM_GB ?? 1);
const WORKER_TAGS: string[] = JSON.parse(process.env.WORKER_TAGS ?? "[]");
const WORKER_TYPES: string[] = JSON.parse(process.env.WORKER_TYPES ?? "[]");
const JOB_POLL_INTERVAL_MS = Number(process.env.JOB_POLL_INTERVAL_MS ?? 5000);

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${SECRET}`,
};

// ---------------------------------------------------------------------------
// Job type (matches hub schema)
// ---------------------------------------------------------------------------

interface Job {
  id: string;
  type: string;
  params: string;
  status: string;
  max_runtime_ms: number;
  solver_url: string | null;
  solver_checksum: string | null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let running = true;
let currentJob: Job | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function registerWorker(): Promise<void> {
  try {
    await fetch(`${HUB_URL}/api/workers/register`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        worker_id: NODE_ID,
        name: process.env.NODE_NAME ?? NODE_ID,
        cores: WORKER_CORES,
        ram_gb: WORKER_RAM_GB,
        tags: WORKER_TAGS,
      }),
      signal: AbortSignal.timeout(5000),
    });
    console.log("[worker] registered capabilities");
  } catch (err) {
    console.warn("[worker] registration failed:", err);
  }
}

async function claimJob(): Promise<Job | null> {
  try {
    const res = await fetch(`${HUB_URL}/api/jobs/claim`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        worker_id: NODE_ID,
        types: WORKER_TYPES.length ? WORKER_TYPES : undefined,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 204) return null;
    if (!res.ok) return null;
    return (await res.json()) as Job;
  } catch {
    return null;
  }
}

async function sendHeartbeat(jobId: string): Promise<boolean> {
  try {
    const res = await fetch(`${HUB_URL}/api/jobs/${jobId}/heartbeat`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ worker_id: NODE_ID }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function submitResult(
  jobId: string,
  result: string,
  resultHash: string
): Promise<void> {
  try {
    await fetch(`${HUB_URL}/api/jobs/${jobId}/result`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ worker_id: NODE_ID, result, result_hash: resultHash }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error(`[worker] failed to submit result for ${jobId}:`, err);
  }
}

async function reportFailure(jobId: string, reason: string): Promise<void> {
  try {
    await fetch(`${HUB_URL}/api/jobs/${jobId}/fail`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ worker_id: NODE_ID, reason }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`[worker] failed to report failure for ${jobId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Job execution
// ---------------------------------------------------------------------------

async function executeJob(job: Job): Promise<void> {
  currentJob = job;
  console.log(`[worker] executing job ${job.id} type=${job.type}`);

  // Start heartbeat
  heartbeatTimer = setInterval(() => sendHeartbeat(job.id), 10_000);
  // Send initial heartbeat (transitions assigned → running)
  await sendHeartbeat(job.id);

  try {
    let solverPath: string | null = null;

    // Download solver if specified
    if (job.solver_url) {
      const result = await getSolver(job.solver_url, job.solver_checksum);
      if ("error" in result) {
        await reportFailure(job.id, result.error);
        return;
      }
      solverPath = result.path;
    }

    // Run solver as subprocess
    if (solverPath) {
      const proc = Bun.spawn([solverPath, "--params", job.params], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, JOB_ID: job.id, JOB_TYPE: job.type, JOB_PARAMS: job.params },
      });

      // Wait with timeout
      const timeoutMs = job.max_runtime_ms || 300_000;
      const timer = setTimeout(() => {
        proc.kill();
      }, timeoutMs);

      const exitCode = await proc.exited;
      clearTimeout(timer);

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      if (exitCode !== 0) {
        await reportFailure(job.id, `exit code ${exitCode}: ${stderr.slice(0, 500)}`);
        return;
      }

      const hash = createHash("sha256").update(stdout).digest("hex");
      await submitResult(job.id, stdout, hash);
    } else {
      // No solver — job type is informational or params-only
      // Submit empty result
      const result = JSON.stringify({ status: "completed", message: "no solver configured" });
      const hash = createHash("sha256").update(result).digest("hex");
      await submitResult(job.id, result, hash);
    }

    console.log(`[worker] job ${job.id} completed`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[worker] job ${job.id} failed:`, reason);
    await reportFailure(job.id, reason);
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    currentJob = null;
  }
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------

async function pollLoop(): Promise<void> {
  if (!running) return;

  const job = await claimJob();
  if (job) {
    await executeJob(job);
    // Immediate re-poll after job completes
    if (running) pollLoop();
  } else {
    // No job — wait and retry
    pollTimer = setTimeout(pollLoop, JOB_POLL_INTERVAL_MS);
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal: string): void {
  console.log(`[worker] received ${signal}, shutting down...`);
  running = false;

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  if (currentJob) {
    console.log(`[worker] waiting for current job ${currentJob.id} to finish (30s max)...`);
    // Give current job 30s to finish — the heartbeat timer will keep it alive
    setTimeout(() => {
      console.log("[worker] shutdown timeout — exiting");
      process.exit(0);
    }, 30_000);
  } else {
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function startWorker(): Promise<void> {
  if (!HUB_URL || !NODE_ID || !SECRET) {
    console.error("[worker] cannot start — missing HUB_URL, NODE_ID, or FORGE_INGEST_SECRET");
    return;
  }

  console.log(
    `[worker] starting — cores=${WORKER_CORES} ram=${WORKER_RAM_GB}GB tags=${JSON.stringify(WORKER_TAGS)} poll=${JOB_POLL_INTERVAL_MS}ms`
  );

  await registerWorker();

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  pollLoop();
}

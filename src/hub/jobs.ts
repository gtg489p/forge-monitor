import type { Hono } from "hono";
import type { SSEClient } from "./relay.js";
import {
  createJob,
  getJob,
  listJobs,
  cancelJob,
  claimJob,
  heartbeatJob,
  submitResult,
  failJob,
  reapStaleJobs,
  registerWorker,
  jobCountsByWorker,
} from "./jobs-db.js";

// ---------------------------------------------------------------------------
// Auth (reuse same token as ingest)
// ---------------------------------------------------------------------------

const SECRET = process.env.FORGE_INGEST_SECRET;

function checkAuth(authHeader: string | undefined): boolean {
  if (!SECRET) return true;
  return authHeader === `Bearer ${SECRET}`;
}

// ---------------------------------------------------------------------------
// Job SSE clients
// ---------------------------------------------------------------------------

const jobClients = new Set<SSEClient>();

function broadcastJobEvent(event: string, data: unknown): void {
  if (jobClients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of jobClients) {
    client.send(payload);
  }
}

// Overloaded send for SSE: uses raw write since event: prefix needed
function createJobSSEStream(): { readable: ReadableStream<Uint8Array>; client: SSEClient } {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const client: SSEClient = {
    send(data: string) {
      // data may already contain event: prefix from broadcastJobEvent
      writer.write(encoder.encode(data)).catch(() => {});
    },
    close() {
      writer.close().catch(() => {});
    },
  };
  return { readable, client };
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

// ---------------------------------------------------------------------------
// Mount job routes
// ---------------------------------------------------------------------------

export function mountJobRoutes(app: Hono): void {
  // -------------------------------------------------------------------------
  // POST /api/jobs — create job
  // -------------------------------------------------------------------------
  app.post("/api/jobs", async (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json<{
      type: string;
      params?: Record<string, unknown>;
      priority?: number;
      max_attempts?: number;
      max_runtime_ms?: number;
      solver_url?: string;
      solver_checksum?: string;
    }>();
    if (!body.type) return c.json({ error: "type is required" }, 400);

    const job = createJob({
      type: body.type,
      params: body.params ? JSON.stringify(body.params) : "{}",
      priority: body.priority,
      max_attempts: body.max_attempts,
      max_runtime_ms: body.max_runtime_ms,
      solver_url: body.solver_url,
      solver_checksum: body.solver_checksum,
    });

    broadcastJobEvent("job:created", job);
    return c.json({ id: job.id, status: job.status }, 201);
  });

  // -------------------------------------------------------------------------
  // GET /api/jobs — list jobs (no auth — dashboard read-only, matches /api/fleet)
  // -------------------------------------------------------------------------
  app.get("/api/jobs", (c) => {
    const status = c.req.query("status");
    const limit = Number(c.req.query("limit") ?? 50);
    const offset = Number(c.req.query("offset") ?? 0);
    return c.json(listJobs({ status, limit, offset }));
  });

  // -------------------------------------------------------------------------
  // GET /api/jobs/events — SSE stream for dashboard
  // -------------------------------------------------------------------------
  app.get("/api/jobs/events", (c) => {
    const { readable, client } = createJobSSEStream();
    jobClients.add(client);

    c.req.raw.signal.addEventListener("abort", () => {
      jobClients.delete(client);
      client.close();
    });

    return new Response(readable, { headers: SSE_HEADERS });
  });

  // -------------------------------------------------------------------------
  // GET /api/jobs/counts-by-worker — job count per worker for badges (no auth — dashboard)
  // -------------------------------------------------------------------------
  app.get("/api/jobs/counts-by-worker", (c) => {
    const counts = jobCountsByWorker();
    return c.json(Object.fromEntries(counts));
  });

  // -------------------------------------------------------------------------
  // POST /api/jobs/claim — atomic claim
  // -------------------------------------------------------------------------
  app.post("/api/jobs/claim", async (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json<{ worker_id: string; types?: string[] }>();
    if (!body.worker_id) return c.json({ error: "worker_id required" }, 400);

    const job = claimJob(body.worker_id, body.types);
    if (!job) return c.body(null, 204);

    broadcastJobEvent("job:assigned", job);
    return c.json(job);
  });

  // -------------------------------------------------------------------------
  // GET /api/jobs/:id — get single job (no auth — dashboard)
  // -------------------------------------------------------------------------
  app.get("/api/jobs/:id", (c) => {
    const job = getJob(c.req.param("id"));
    if (!job) return c.json({ error: "not found" }, 404);
    return c.json(job);
  });

  // -------------------------------------------------------------------------
  // DELETE /api/jobs/:id — cancel job
  // -------------------------------------------------------------------------
  app.delete("/api/jobs/:id", (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const id = c.req.param("id");
    const ok = cancelJob(id);
    if (!ok) return c.json({ error: "not found or not cancellable" }, 404);
    const job = getJob(id);
    broadcastJobEvent("job:failed", job);
    return c.body(null, 204);
  });

  // -------------------------------------------------------------------------
  // POST /api/workers/register
  // -------------------------------------------------------------------------
  app.post("/api/workers/register", async (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json<{
      worker_id: string;
      name?: string;
      cores: number;
      ram_gb: number;
      tags: string[];
    }>();
    if (!body.worker_id) return c.json({ error: "worker_id required" }, 400);

    registerWorker(body);
    return c.body(null, 204);
  });

  // -------------------------------------------------------------------------
  // POST /api/jobs/:id/heartbeat
  // -------------------------------------------------------------------------
  app.post("/api/jobs/:id/heartbeat", async (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json<{ worker_id: string }>();
    const { ok, conflict } = heartbeatJob(c.req.param("id"), body.worker_id);
    if (conflict) return c.json({ error: "job not assigned to this worker" }, 409);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.body(null, 204);
  });

  // -------------------------------------------------------------------------
  // POST /api/jobs/:id/result
  // -------------------------------------------------------------------------
  app.post("/api/jobs/:id/result", async (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json<{
      worker_id: string;
      result: unknown;
      result_hash?: string;
    }>();
    const idempotencyKey = c.req.header("X-Idempotency-Key");
    const resultStr = typeof body.result === "string" ? body.result : JSON.stringify(body.result);
    const { ok, conflict, duplicate } = submitResult(
      c.req.param("id"),
      body.worker_id,
      resultStr,
      body.result_hash,
      idempotencyKey ?? undefined
    );
    if (conflict) return c.json({ error: "job not assigned to this worker or already completed" }, 409);
    if (!ok) return c.json({ error: "not found" }, 404);

    if (!duplicate) {
      const job = getJob(c.req.param("id"));
      broadcastJobEvent("job:completed", job);
    }
    return c.json({ ok: true, duplicate });
  });

  // -------------------------------------------------------------------------
  // POST /api/jobs/:id/fail
  // -------------------------------------------------------------------------
  app.post("/api/jobs/:id/fail", async (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const body = await c.req.json<{ worker_id: string; reason: string }>();
    const { ok, conflict, newStatus } = failJob(
      c.req.param("id"),
      body.worker_id,
      body.reason
    );
    if (conflict) return c.json({ error: "job not assigned to this worker" }, 409);
    if (!ok) return c.json({ error: "not found" }, 404);

    const job = getJob(c.req.param("id"));
    const event = newStatus === "quarantined" ? "job:quarantined" : "job:failed";
    broadcastJobEvent(event, job);
    return c.json({ ok: true, newStatus });
  });
}

// ---------------------------------------------------------------------------
// Reaper — runs every 15s
// ---------------------------------------------------------------------------

let reaperInterval: ReturnType<typeof setInterval> | null = null;

export function startReaper(): void {
  if (reaperInterval) return;
  reaperInterval = setInterval(() => {
    const { reclaimed, quarantined, timedOut } = reapStaleJobs();
    if (reclaimed > 0 || quarantined > 0 || timedOut > 0) {
      console.log(
        `[reaper] reclaimed=${reclaimed} quarantined=${quarantined} timedOut=${timedOut}`
      );
    }
  }, 15_000);
}

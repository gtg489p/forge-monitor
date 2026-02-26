import si from "systeminformation";
import os from "os";
import type { Hono } from "hono";
import type { MetricSnapshot, GpuSnapshot } from "../types.js";

// ---------------------------------------------------------------------------
// History ring buffer
// ---------------------------------------------------------------------------

const HISTORY_SIZE = 18000;
const history: MetricSnapshot[] = [];

// ---------------------------------------------------------------------------
// SSE client registry
// ---------------------------------------------------------------------------

interface SSEClient {
  send: (data: string) => void;
  close: () => void;
}

const clients = new Set<SSEClient>();

function broadcast(snapshot: MetricSnapshot): void {
  const payload = JSON.stringify(snapshot);
  for (const client of clients) {
    client.send(payload);
  }
}

// ---------------------------------------------------------------------------
// Metrics collection
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// ---------------------------------------------------------------------------
// GPU collection — runs on its own cadence (si.graphics() is slow ~200ms)
// Cached result is merged into every snapshot.
// ---------------------------------------------------------------------------

let cachedGpus: GpuSnapshot[] = [];

async function collectGpus(): Promise<GpuSnapshot[]> {
  try {
    const gfx = await withTimeout(si.graphics(), 3000);
    if (!gfx.controllers || gfx.controllers.length === 0) return [];
    return gfx.controllers.map((c, i) => ({
      index: i,
      model: c.model ?? "Unknown",
      vendor: c.vendor ?? "Unknown",
      vramTotal: c.memoryTotal ?? c.vram ?? 0,
      vramUsed: c.memoryUsed ?? 0,
      utilizationGpu: c.utilizationGpu ?? 0,
      utilizationMemory: c.utilizationMemory ?? 0,
      clockCore: c.clockCore ?? 0,
      clockMemory: c.clockMemory ?? 0,
      temperatureGpu: c.temperatureGpu ?? 0,
      fanSpeed: c.fanSpeed ?? 0,
    }));
  } catch {
    return [];
  }
}

// Refresh GPU data every 2s (si.graphics is expensive)
collectGpus().then((g) => { cachedGpus = g; }).catch(() => {});
setInterval(async () => {
  cachedGpus = await collectGpus();
}, 2000);

export async function collectMetrics(): Promise<MetricSnapshot> {
  const [cpuLoad, mem, fsStats, netStats] = await withTimeout(
    Promise.all([si.currentLoad(), si.mem(), si.fsStats(), si.networkStats("*")]),
    900
  );

  const netArray = Array.isArray(netStats) ? netStats : [netStats];
  const rxSec = netArray.reduce((sum, n) => sum + (n.rx_sec ?? 0), 0);
  const txSec = netArray.reduce((sum, n) => sum + (n.tx_sec ?? 0), 0);

  const [avg1, avg5, avg15] = os.loadavg();

  const snapshot: MetricSnapshot = {
    timestamp: Date.now(),
    cpu: Math.round(cpuLoad.currentLoad * 10) / 10,
    cpuCores: cpuLoad.cpus.map((c) => Math.round(c.load * 10) / 10),
    memory: {
      // mem.used = MemTotal - MemFree - Buffers - Cached
      percent: Math.round((mem.used / mem.total) * 1000) / 10,
      used: Math.round((mem.used / 1073741824) * 100) / 100,
      total: Math.round((mem.total / 1073741824) * 100) / 100,
    },
    disk: {
      read: Math.round(Math.max(0, (fsStats.rx_sec ?? 0) / 1048576) * 100) / 100,
      write: Math.round(Math.max(0, (fsStats.wx_sec ?? 0) / 1048576) * 100) / 100,
    },
    network: {
      rx: Math.round(Math.max(0, rxSec / 1048576) * 100) / 100,
      tx: Math.round(Math.max(0, txSec / 1048576) * 100) / 100,
    },
    load: {
      avg1: Math.round(avg1 * 100) / 100,
      avg5: Math.round(avg5 * 100) / 100,
      avg15: Math.round(avg15 * 100) / 100,
    },
  };

  if (cachedGpus.length > 0) {
    snapshot.gpus = cachedGpus;
  }

  return snapshot;
}

// Warm up systeminformation — fire-and-forget, don't block startup
collectMetrics().catch(() => {});

setInterval(async () => {
  try {
    const snapshot = await collectMetrics();
    history.push(snapshot);
    if (history.length > HISTORY_SIZE + 60) history.splice(0, history.length - HISTORY_SIZE);
    broadcast(snapshot);
  } catch (err) {
    console.error("[metrics] collection error:", err);
  }
}, 1000);

export function getLocalClients(): Set<SSEClient> {
  return clients;
}

export function mountLocalRoutes(app: Hono): void {
  // SSE stream
  app.get("/api/events", (c) => {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const client: SSEClient = {
      send(data: string) {
        writer
          .write(encoder.encode(`data: ${data}\n\n`))
          .catch(() => {
            clients.delete(client);
          });
      },
      close() {
        clients.delete(client);
        writer.close().catch(() => {});
      },
    };

    clients.add(client);

    // Send latest snapshot immediately so the client isn't blank
    if (history.length > 0) {
      client.send(JSON.stringify(history[history.length - 1]));
    }

    c.req.raw.signal.addEventListener("abort", () => client.close());

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  // Snapshot (history)
  app.get("/api/snapshot", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? HISTORY_SIZE), HISTORY_SIZE);
    return c.json(history.slice(-limit));
  });
}

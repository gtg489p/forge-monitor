import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import si from "systeminformation";
import os from "os";
import type { MetricSnapshot } from "./types.js";

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

async function collectMetrics(): Promise<MetricSnapshot> {
  const [cpuLoad, mem, fsStats, netStats] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsStats(),
    si.networkStats("*"),
  ]);

  const netArray = Array.isArray(netStats) ? netStats : [netStats];
  const rxSec = netArray.reduce((sum, n) => sum + (n.rx_sec ?? 0), 0);
  const txSec = netArray.reduce((sum, n) => sum + (n.tx_sec ?? 0), 0);

  const [avg1, avg5, avg15] = os.loadavg();

  return {
    timestamp: Date.now(),
    cpu: Math.round(cpuLoad.currentLoad * 10) / 10,
    cpuCores: cpuLoad.cpus.map((c) => Math.round(c.load * 10) / 10),
    memory: {
      percent: Math.round((mem.active / mem.total) * 1000) / 10,
      used: Math.round((mem.active / 1073741824) * 100) / 100,
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
}

// Warm up systeminformation (first call often returns 0 for rates)
// Warm up systeminformation — fire-and-forget, don't block startup
// (top-level await can hang in constrained containers like Railway)
collectMetrics().catch(() => {});

setInterval(async () => {
  try {
    const snapshot = await collectMetrics();
    history.push(snapshot);
    if (history.length > HISTORY_SIZE) history.shift();
    broadcast(snapshot);
  } catch (err) {
    console.error("[metrics] collection error:", err);
  }
}, 1000);

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono();

app.use("*", cors());

// SSE stream ----------------------------------------------------------------
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

// Snapshot (history) --------------------------------------------------------
app.get("/api/snapshot", (c) => {
  return c.json(history);
});

// Health check --------------------------------------------------------------
app.get("/api/health", (c) => c.json({ ok: true, clients: clients.size }));

// Static files (built React SPA) --------------------------------------------
app.use("/*", serveStatic({ root: "./dist" }));

// SPA fallback — serve index.html for any unmatched route -------------------
app.notFound(async (c) => {
  try {
    const html = await Bun.file("./dist/index.html").text();
    return c.html(html);
  } catch {
    return c.text("Not found — run `bun run build` first.", 404);
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3000);
console.log(`[forge-monitor] listening on http://localhost:${port}`);

export default {
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};

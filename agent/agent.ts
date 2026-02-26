#!/usr/bin/env bun
/**
 * Forge Monitor Push Agent
 *
 * Collects local metrics and pushes them to a hub at HUB_URL.
 * Buffers up to 180 snapshots offline and replays as a batch on reconnect.
 *
 * Required env vars:
 *   HUB_URL              — e.g. https://your-hub.railway.app
 *   NODE_ID              — url-safe identifier, e.g. "web-01"
 *   FORGE_INGEST_SECRET  — shared bearer token (must match hub)
 *
 * Optional:
 *   NODE_NAME            — display name (defaults to NODE_ID)
 *   PUSH_INTERVAL_MS     — push cadence in ms (default: 5000)
 */

import si from "systeminformation";
import os from "os";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const HUB_URL = process.env.HUB_URL?.replace(/\/$/, "");
const NODE_ID = process.env.NODE_ID;
const SECRET = process.env.FORGE_INGEST_SECRET;
const NODE_NAME = process.env.NODE_NAME ?? NODE_ID ?? "unknown";
const PUSH_INTERVAL_MS = Number(process.env.PUSH_INTERVAL_MS ?? 5000);
const BUFFER_SIZE = 180;

if (!HUB_URL || !NODE_ID || !SECRET) {
  console.error(
    "[agent] Missing required env vars: HUB_URL, NODE_ID, FORGE_INGEST_SECRET"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Metrics (local copy — agent runs standalone, no import from server)
// ---------------------------------------------------------------------------

interface GpuSnapshot {
  index: number;
  model: string;
  vendor: string;
  vramTotal: number;
  vramUsed: number;
  utilizationGpu: number;
  utilizationMemory: number;
  clockCore: number;
  clockMemory: number;
  temperatureGpu: number;
  fanSpeed: number;
}

interface MetricSnapshot {
  timestamp: number;
  cpu: number;
  cpuCores: number[];
  memory: { percent: number; used: number; total: number };
  disk: { read: number; write: number };
  network: { rx: number; tx: number };
  load: { avg1: number; avg5: number; avg15: number };
  gpus?: GpuSnapshot[];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// ---------------------------------------------------------------------------
// GPU collection — cached, refreshed every 2s
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

collectGpus().then((g) => { cachedGpus = g; }).catch(() => {});
setInterval(async () => { cachedGpus = await collectGpus(); }, 2000);

async function collectMetrics(): Promise<MetricSnapshot> {
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

// ---------------------------------------------------------------------------
// Push helpers
// ---------------------------------------------------------------------------

const BASE_HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${SECRET}`,
  "X-Node-Name": NODE_NAME,
};

async function pushSingle(snapshot: MetricSnapshot): Promise<boolean> {
  try {
    const res = await fetch(`${HUB_URL}/api/ingest/${NODE_ID}`, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function pushBatch(snapshots: MetricSnapshot[]): Promise<boolean> {
  try {
    const res = await fetch(`${HUB_URL}/api/ingest/${NODE_ID}/batch`, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify(snapshots),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Offline buffer
// ---------------------------------------------------------------------------

const buffer: MetricSnapshot[] = [];
let offline = false;

function addToBuffer(snapshot: MetricSnapshot): void {
  buffer.push(snapshot);
  if (buffer.length > BUFFER_SIZE) buffer.shift();
}

// ---------------------------------------------------------------------------
// Main push loop
// ---------------------------------------------------------------------------

// Warm up systeminformation — first call often returns 0 for rates
collectMetrics().catch(() => {});

console.log(
  `[agent] node=${NODE_ID} hub=${HUB_URL} interval=${PUSH_INTERVAL_MS}ms buffer=${BUFFER_SIZE}`
);

setInterval(async () => {
  let snapshot: MetricSnapshot;
  try {
    snapshot = await collectMetrics();
  } catch (err) {
    console.error("[agent] metrics collection failed:", err);
    return;
  }

  addToBuffer(snapshot);

  if (offline) {
    // Try batch replay
    const ok = await pushBatch([...buffer]);
    if (ok) {
      console.log(`[agent] reconnected — replayed ${buffer.length} buffered snapshots`);
      buffer.length = 0;
      offline = false;
    } else {
      console.warn(`[agent] still offline — buffering (${buffer.length}/${BUFFER_SIZE})`);
    }
    return;
  }

  const ok = await pushSingle(snapshot);
  if (!ok) {
    offline = true;
    console.warn("[agent] push failed — going offline, buffering...");
  }
}, PUSH_INTERVAL_MS);

// ---------------------------------------------------------------------------
// Worker (opt-in via WORKER_ENABLED=true)
// ---------------------------------------------------------------------------

if (process.env.WORKER_ENABLED === "true") {
  const { startWorker } = await import("./worker.js");
  startWorker();
}

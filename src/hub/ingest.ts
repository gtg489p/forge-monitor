import type { Hono } from "hono";
import type { MetricSnapshot } from "../types.js";
import { upsertNode, getAllNodes, nodeRegistry } from "./nodes.js";
import { fleetClients, nodeClients, broadcastFleet, broadcastToNode } from "./relay.js";
import type { SSEClient } from "./relay.js";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

const SECRET = process.env.FORGE_INGEST_SECRET;

function checkAuth(authHeader: string | undefined): boolean {
  if (!SECRET) return true; // no secret = open (dev)
  return authHeader === `Bearer ${SECRET}`;
}

// ---------------------------------------------------------------------------
// SSE stream helper
// ---------------------------------------------------------------------------

function createSSEStream(): { readable: ReadableStream<Uint8Array>; client: SSEClient } {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const client: SSEClient = {
    send(data: string) {
      writer.write(encoder.encode(`data: ${data}\n\n`)).catch(() => {});
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
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

// ---------------------------------------------------------------------------
// Mount all hub routes
// ---------------------------------------------------------------------------

export function mountHubRoutes(app: Hono): void {
  // --------------------------------------------------------------------------
  // POST /api/ingest/:nodeId — single metric push
  // --------------------------------------------------------------------------
  app.post("/api/ingest/:nodeId", async (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const nodeId = c.req.param("nodeId");
    const nodeName = c.req.header("X-Node-Name");
    const snapshot: MetricSnapshot = await c.req.json();

    upsertNode(nodeId, snapshot, nodeName);
    broadcastFleet(nodeId);
    broadcastToNode(nodeId, JSON.stringify(snapshot));

    return c.body(null, 204);
  });

  // --------------------------------------------------------------------------
  // POST /api/ingest/:nodeId/batch — offline batch replay
  // --------------------------------------------------------------------------
  app.post("/api/ingest/:nodeId/batch", async (c) => {
    if (!checkAuth(c.req.header("Authorization"))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const nodeId = c.req.param("nodeId");
    const nodeName = c.req.header("X-Node-Name");
    const snapshots: MetricSnapshot[] = await c.req.json();

    for (const snapshot of snapshots) {
      upsertNode(nodeId, snapshot, nodeName);
    }
    // Broadcast latest only
    broadcastFleet(nodeId);
    if (snapshots.length > 0) {
      broadcastToNode(nodeId, JSON.stringify(snapshots[snapshots.length - 1]));
    }

    return c.body(null, 204);
  });

  // --------------------------------------------------------------------------
  // GET /api/fleet — list all nodes with status (last 60 history for sparkline)
  // --------------------------------------------------------------------------
  app.get("/api/fleet", (c) => {
    return c.json(getAllNodes(60));
  });

  // --------------------------------------------------------------------------
  // GET /api/fleet/events — SSE fan-out to fleet dashboard
  // --------------------------------------------------------------------------
  app.get("/api/fleet/events", (c) => {
    const { readable, client } = createSSEStream();
    fleetClients.add(client);

    // Send current state immediately so dashboard populates on connect
    const nodes = getAllNodes(60);
    for (const node of nodes) {
      client.send(JSON.stringify(node));
    }

    c.req.raw.signal.addEventListener("abort", () => {
      fleetClients.delete(client);
      client.close();
    });

    return new Response(readable, { headers: SSE_HEADERS });
  });

  // --------------------------------------------------------------------------
  // GET /api/nodes/:id/snapshot — full per-node history (360pt)
  // --------------------------------------------------------------------------
  app.get("/api/nodes/:id/snapshot", (c) => {
    const id = c.req.param("id");
    const node = nodeRegistry.get(id);
    if (!node) return c.json({ error: "not found" }, 404);
    const limit = Math.min(Number(c.req.query("limit") ?? 360), 360);
    return c.json(node.history.slice(-limit));
  });

  // --------------------------------------------------------------------------
  // GET /api/nodes/:id/events — per-node SSE (NodeDashboard)
  // --------------------------------------------------------------------------
  app.get("/api/nodes/:id/events", (c) => {
    const id = c.req.param("id");
    const { readable, client } = createSSEStream();

    if (!nodeClients.has(id)) nodeClients.set(id, new Set());
    nodeClients.get(id)!.add(client);

    // Send latest snapshot immediately
    const node = nodeRegistry.get(id);
    if (node?.latest) {
      client.send(JSON.stringify(node.latest));
    }

    c.req.raw.signal.addEventListener("abort", () => {
      nodeClients.get(id)?.delete(client);
      client.close();
    });

    return new Response(readable, { headers: SSE_HEADERS });
  });
}

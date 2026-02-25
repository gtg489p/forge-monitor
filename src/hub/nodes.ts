import type { MetricSnapshot } from "../types.js";

// ---------------------------------------------------------------------------
// NodeRecord — in-memory store per node
// ---------------------------------------------------------------------------

export interface NodeRecord {
  id: string;
  name: string;
  lastSeen: number;        // ms timestamp
  history: MetricSnapshot[]; // capped at NODE_HISTORY_SIZE
  latest: MetricSnapshot | null;
}

export interface NodeWithStatus extends Omit<NodeRecord, "history"> {
  status: "online" | "degraded" | "offline";
  history: MetricSnapshot[]; // may be subset (e.g. last 60 for sparkline)
}

export const NODE_HISTORY_SIZE = 360;

export const nodeRegistry = new Map<string, NodeRecord>();

// ---------------------------------------------------------------------------
// Status calculation
// ---------------------------------------------------------------------------

export function getStatus(node: NodeRecord): "online" | "degraded" | "offline" {
  const age = Date.now() - node.lastSeen;
  if (age < 15_000) return "online";
  if (age < 60_000) return "degraded";
  return "offline";
}

// ---------------------------------------------------------------------------
// Upsert — auto-register on first push
// ---------------------------------------------------------------------------

export function upsertNode(
  id: string,
  snapshot: MetricSnapshot,
  name?: string
): NodeRecord {
  let node = nodeRegistry.get(id);
  if (!node) {
    node = { id, name: name ?? id, lastSeen: Date.now(), history: [], latest: null };
    nodeRegistry.set(id, node);
    console.log(`[hub] registered node: ${id}`);
  }
  if (name) node.name = name;
  node.lastSeen = Date.now();
  node.latest = snapshot;
  node.history.push(snapshot);
  if (node.history.length > NODE_HISTORY_SIZE + 10) {
    node.history.splice(0, node.history.length - NODE_HISTORY_SIZE);
  }
  return node;
}

// ---------------------------------------------------------------------------
// List all nodes — limits history for fleet broadcast (sparkline only)
// ---------------------------------------------------------------------------

export function getAllNodes(historyLimit = 60): NodeWithStatus[] {
  return Array.from(nodeRegistry.values()).map((node) => ({
    id: node.id,
    name: node.name,
    lastSeen: node.lastSeen,
    status: getStatus(node),
    latest: node.latest,
    history: node.history.slice(-historyLimit),
  }));
}

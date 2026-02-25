import { nodeRegistry, getStatus } from "./nodes.js";

// ---------------------------------------------------------------------------
// SSE client interface
// ---------------------------------------------------------------------------

export interface SSEClient {
  send: (data: string) => void;
  close: () => void;
}

// ---------------------------------------------------------------------------
// Client registries
// ---------------------------------------------------------------------------

/** Clients watching the fleet overview (all nodes) */
export const fleetClients = new Set<SSEClient>();

/** Clients watching a specific node detail view */
export const nodeClients = new Map<string, Set<SSEClient>>();

// ---------------------------------------------------------------------------
// Fleet broadcast — 2s throttle per node
// ---------------------------------------------------------------------------

const lastFleetBroadcast = new Map<string, number>();
const FLEET_THROTTLE_MS = 2000;

export function broadcastFleet(nodeId: string): void {
  if (fleetClients.size === 0) return;

  const now = Date.now();
  const last = lastFleetBroadcast.get(nodeId) ?? 0;
  if (now - last < FLEET_THROTTLE_MS) return;
  lastFleetBroadcast.set(nodeId, now);

  const node = nodeRegistry.get(nodeId);
  if (!node) return;

  // Only send last 60 history points — sufficient for sparkline
  const payload = JSON.stringify({
    id: node.id,
    name: node.name,
    lastSeen: node.lastSeen,
    status: getStatus(node),
    latest: node.latest,
    history: node.history.slice(-60),
  });

  for (const client of fleetClients) {
    client.send(payload);
  }
}

// ---------------------------------------------------------------------------
// Per-node broadcast — real-time to NodeDashboard
// ---------------------------------------------------------------------------

export function broadcastToNode(nodeId: string, payload: string): void {
  const clients = nodeClients.get(nodeId);
  if (!clients || clients.size === 0) return;
  for (const client of clients) {
    client.send(payload);
  }
}

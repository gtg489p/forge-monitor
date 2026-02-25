import { useState, useEffect } from "react";
import type { MetricSnapshot } from "../../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodeWithStatus {
  id: string;
  name: string;
  lastSeen: number;
  status: "online" | "degraded" | "offline";
  latest: MetricSnapshot | null;
  history: MetricSnapshot[]; // last 60 points (sparkline)
}

export interface FleetState {
  nodes: Map<string, NodeWithStatus>;
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFleet(): FleetState {
  const [state, setState] = useState<FleetState>({
    nodes: new Map(),
    connected: false,
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    async function init() {
      // Pre-populate from REST snapshot
      try {
        const res = await fetch("/api/fleet");
        if (!cancelled && res.ok) {
          const data: NodeWithStatus[] = await res.json();
          setState((prev) => {
            const nodes = new Map(prev.nodes);
            for (const node of data) nodes.set(node.id, node);
            return { ...prev, nodes };
          });
        }
      } catch {
        // Non-fatal — SSE will supply live updates
      }

      if (cancelled) return;

      // Live SSE stream
      es = new EventSource("/api/fleet/events");

      es.onopen = () => {
        if (!cancelled) setState((prev) => ({ ...prev, connected: true }));
      };

      es.onmessage = (e: MessageEvent) => {
        if (cancelled) return;
        try {
          const node: NodeWithStatus = JSON.parse(e.data as string);
          setState((prev) => {
            const nodes = new Map(prev.nodes);
            nodes.set(node.id, node);
            return { ...prev, nodes, connected: true };
          });
        } catch {
          // Malformed frame — skip
        }
      };

      es.onerror = () => {
        if (!cancelled) setState((prev) => ({ ...prev, connected: false }));
      };
    }

    init();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  return state;
}

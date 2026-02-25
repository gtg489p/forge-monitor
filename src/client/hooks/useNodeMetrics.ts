import { useState, useEffect } from "react";
import type { MetricSnapshot } from "../../types.js";
import { addToRingBuffer } from "../lib/ringBuffer.js";

const MAX_POINTS = 360;

export interface NodeMetricsState {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
  connected: boolean;
}

export function useNodeMetrics(nodeId: string): NodeMetricsState {
  const [state, setState] = useState<NodeMetricsState>({
    snapshots: [],
    latest: null,
    connected: false,
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    // Reset state when nodeId changes
    setState({ snapshots: [], latest: null, connected: false });

    async function init() {
      // Pre-populate from history snapshot
      try {
        const res = await fetch(`/api/nodes/${nodeId}/snapshot?limit=360`);
        if (!cancelled && res.ok) {
          const data: MetricSnapshot[] = await res.json();
          if (data.length > 0) {
            setState((prev) => ({
              ...prev,
              snapshots: data,
              latest: data[data.length - 1],
            }));
          }
        }
      } catch {
        // Non-fatal
      }

      if (cancelled) return;

      // Live SSE stream
      es = new EventSource(`/api/nodes/${nodeId}/events`);

      es.onopen = () => {
        if (!cancelled) setState((prev) => ({ ...prev, connected: true }));
      };

      es.onmessage = (e: MessageEvent) => {
        if (cancelled) return;
        try {
          const snapshot: MetricSnapshot = JSON.parse(e.data as string);
          setState((prev) => ({
            snapshots: addToRingBuffer(prev.snapshots, snapshot, MAX_POINTS),
            latest: snapshot,
            connected: true,
          }));
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
  }, [nodeId]);

  return state;
}

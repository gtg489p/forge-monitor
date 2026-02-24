import { useState, useEffect } from "react";
import type { MetricSnapshot } from "../../types.js";
import { addToRingBuffer } from "../lib/ringBuffer.js";

const MAX_POINTS = 300;

export interface MetricsState {
  snapshots: MetricSnapshot[];
  latest: MetricSnapshot | null;
  connected: boolean;
}

export function useMetrics(): MetricsState {
  const [state, setState] = useState<MetricsState>({
    snapshots: [],
    latest: null,
    connected: false,
  });

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    async function init() {
      // Pre-populate from history snapshot
      try {
        const res = await fetch("/api/snapshot");
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
        // Non-fatal — SSE will supply live data
      }

      if (cancelled) return;

      // Live SSE stream
      es = new EventSource("/api/events");

      es.onopen = () => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, connected: true }));
        }
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
        if (!cancelled) {
          setState((prev) => ({ ...prev, connected: false }));
        }
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

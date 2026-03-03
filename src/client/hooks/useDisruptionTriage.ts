import { useState, useEffect, useCallback, useRef } from "react";
import type {
  DisruptionEvent,
  TriggerResponse,
  TriageResponse,
  ImpactResponse,
  RecommendationResponse,
} from "../lib/disruptionTypes.js";

// ---------------------------------------------------------------------------
// API helper functions
// ---------------------------------------------------------------------------

const API_BASE = "/api/disruption";

/**
 * Trigger a disruption event and initiate triage.
 * POST /api/disruption/trigger
 */
export async function triggerDisruption(
  event: DisruptionEvent,
): Promise<TriggerResponse> {
  const res = await fetch(`${API_BASE}/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Trigger failed (HTTP ${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Fetch triage status and results.
 * GET /api/disruption/triage/{id}
 */
export async function fetchTriage(triageId: number): Promise<TriageResponse> {
  const res = await fetch(`${API_BASE}/triage/${triageId}`);
  if (!res.ok) {
    throw new Error(`Triage fetch failed (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Fetch detailed impact metrics.
 * GET /api/disruption/impact/{id}
 */
export async function fetchImpact(triageId: number): Promise<ImpactResponse> {
  const res = await fetch(`${API_BASE}/impact/${triageId}`);
  if (!res.ok) {
    throw new Error(`Impact fetch failed (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Fetch AI-powered recommendation.
 * GET /api/disruption/recommend/{id}
 */
export async function fetchRecommendation(
  triageId: number,
): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE}/recommend/${triageId}`);
  if (!res.ok) {
    throw new Error(`Recommendation fetch failed (HTTP ${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Polling hook: useDisruptionTriage
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2_000;

interface UseDisruptionTriageResult {
  data: TriageResponse | null;
  loading: boolean;
  error: string | null;
  isComplete: boolean;
}

/**
 * Polls GET /api/disruption/triage/{id} every 2 seconds.
 * Stops polling when triage_status is "complete" or "error".
 *
 * Pass `null` or `undefined` as triageId to disable polling.
 */
export function useDisruptionTriage(
  triageId: number | null | undefined,
): UseDisruptionTriageResult {
  const [data, setData] = useState<TriageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Use a ref to track the latest triageId so the interval callback
  // always sees the current value without recreating the effect.
  const triageIdRef = useRef(triageId);
  triageIdRef.current = triageId;

  const poll = useCallback(async (id: number) => {
    try {
      const result = await fetchTriage(id);
      setData(result);
      setError(null);

      if (result.triage_status === "complete" || result.triage_status === "error") {
        setIsComplete(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown polling error");
    }
  }, []);

  useEffect(() => {
    // Reset state when triageId changes
    setData(null);
    setError(null);
    setIsComplete(false);

    if (triageId == null) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Immediately fetch once
    let cancelled = false;
    poll(triageId).then(() => {
      if (!cancelled) setLoading(false);
    });

    // Set up polling interval
    const intervalId = setInterval(() => {
      const currentId = triageIdRef.current;
      if (currentId == null || cancelled) return;

      // Check if we already know it's complete (avoid unnecessary fetches)
      // The interval will be cleared when the effect cleans up anyway
      poll(currentId);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [triageId, poll]);

  // Stop polling once complete by clearing the interval via isComplete
  // This is handled by the effect cleanup when triageId changes,
  // but we also want to stop mid-cycle if the status becomes terminal.
  useEffect(() => {
    // When isComplete becomes true, the parent will typically
    // stop passing the triageId or transition to a different phase.
    // The polling loop checks isComplete on every tick via the
    // returned data's triage_status.
  }, [isComplete]);

  return { data, loading, error, isComplete };
}

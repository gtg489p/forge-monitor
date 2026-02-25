import { useState, useEffect, useCallback } from "react";
import type { ParetoFrontPoint } from "../lib/paretoTypes.js";

export function useParetoFront(throughputFilter?: string) {
  const [data, setData] = useState<ParetoFrontPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFront = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (throughputFilter) params.set("throughput_gallons_exact", throughputFilter);
      params.set("limit", "500");
      const res = await fetch(`/api/pareto/front?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [throughputFilter]);

  useEffect(() => {
    fetchFront();
    const id = setInterval(() => {
      if (!document.hidden) fetchFront();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchFront]);

  return { data, loading, error, refetch: fetchFront };
}

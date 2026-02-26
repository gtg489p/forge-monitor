import type { MetricSnapshot } from "../../types.js";

/**
 * Downsample snapshots using timestamp-aligned buckets.
 * Buckets are anchored to epoch time so the same snapshot always lands
 * in the same bucket — historical points never shift when new data arrives.
 *
 * @param horizonMs  Total time window in ms (e.g. 10 * 60 * 1000).
 *                   Used to compute a stable bucket width.
 */
export function downsample(
  snapshots: MetricSnapshot[],
  targetPoints: number,
  horizonMs?: number
): MetricSnapshot[] {
  if (snapshots.length <= targetPoints) return snapshots;

  const firstTs = snapshots[0].timestamp;
  const lastTs = snapshots[snapshots.length - 1].timestamp;
  const rangeMs = horizonMs ?? (lastTs - firstTs);
  if (rangeMs <= 0) return snapshots;

  // Round bucket width up to the nearest whole second for stability
  const bucketMs = Math.max(1000, Math.ceil(rangeMs / targetPoints / 1000) * 1000);

  const result: MetricSnapshot[] = [];
  let prevBucket = -1;

  for (const s of snapshots) {
    const bucket = Math.floor(s.timestamp / bucketMs);
    if (bucket !== prevBucket) {
      result.push(s);
      prevBucket = bucket;
    }
  }

  // Always include the latest snapshot
  const last = snapshots[snapshots.length - 1];
  if (result[result.length - 1] !== last) {
    result.push(last);
  }

  return result;
}

import type { MetricSnapshot } from "../../types.js";

export function downsample(
  snapshots: MetricSnapshot[],
  targetPoints: number
): MetricSnapshot[] {
  if (snapshots.length <= targetPoints) return snapshots;

  const step = Math.floor(snapshots.length / targetPoints);
  const result = snapshots.filter((_, i) => i % step === 0).slice(0, targetPoints);

  // Always include the latest snapshot
  const last = snapshots[snapshots.length - 1];
  if (result[result.length - 1] !== last) {
    result[result.length - 1] = last;
  }

  return result;
}

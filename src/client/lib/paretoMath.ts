import type { ParetoMetrics } from "./paretoTypes.js";

/**
 * Compute crowding distance for each point across the given objectives.
 * O(m * n * log n) where m = objectives, n = points.
 * Boundary points get Infinity; if range is 0 on an axis, that axis is skipped.
 */
export function computeCrowdingDistance(
  points: ParetoMetrics[],
  objectives: (keyof ParetoMetrics)[],
): number[] {
  const n = points.length;
  if (n <= 2) return new Array(n).fill(Infinity);

  const cd = new Float64Array(n);

  for (const obj of objectives) {
    const sorted = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => points[a][obj] - points[b][obj],
    );

    const range = points[sorted[n - 1]][obj] - points[sorted[0]][obj];
    cd[sorted[0]] = Infinity;
    cd[sorted[n - 1]] = Infinity;

    if (range === 0) continue;

    for (let i = 1; i < n - 1; i++) {
      cd[sorted[i]] +=
        (points[sorted[i + 1]][obj] - points[sorted[i - 1]][obj]) / range;
    }
  }

  return Array.from(cd);
}

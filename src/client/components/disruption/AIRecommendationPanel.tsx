import type { AIRecommendation } from "../../lib/disruptionTypes.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIRecommendationPanelProps {
  recommendation: AIRecommendation;
  /** Called when user accepts the recommended schedule. */
  onAccept: (scheduleId: number | undefined) => void;
  /** Called when user wants to explore more solutions. */
  onExploreMore: () => void;
  /** Whether exploration is currently in progress. */
  exploring?: boolean;
}

// ---------------------------------------------------------------------------
// Action label mapping
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  accept_best_survivor: "Accept Best Survivor",
  expedite_runs: "Expedite Runs",
  wait_for_exploration: "Wait for New Front",
  rerun_failed_batch: "Re-run Failed Batch",
  shift_production: "Shift Production",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIRecommendationPanel({
  recommendation,
  onAccept,
  onExploreMore,
  exploring = false,
}: AIRecommendationPanelProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest mb-4">
        AI Recommendation
      </h2>

      {/* Primary recommendation */}
      <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/30 p-4 mb-4">
        <div className="flex items-start gap-3">
          <span className="text-cyan-400 text-lg mt-0.5">&#10003;</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-100">
              {actionLabel(recommendation.action)}
              {recommendation.schedule_id != null && (
                <span className="text-zinc-500 font-normal ml-1">
                  (Schedule #{recommendation.schedule_id})
                </span>
              )}
            </p>
            <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
              &ldquo;{recommendation.rationale}&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Alternatives */}
      {recommendation.alternatives.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">
            Alternatives
          </p>
          <ul className="space-y-2">
            {recommendation.alternatives.map((alt, i) => (
              <li
                key={i}
                className="text-sm text-zinc-400 flex items-start gap-2"
              >
                <span className="text-zinc-600 mt-0.5">&#8226;</span>
                <div>
                  <span className="text-zinc-300 font-medium">
                    {actionLabel(alt.action)}
                  </span>
                  {alt.estimated_cost != null && (
                    <span className="text-zinc-500 ml-1">
                      (est. ${alt.estimated_cost.toLocaleString()})
                    </span>
                  )}
                  {alt.estimated_time_minutes != null && (
                    <span className="text-zinc-500 ml-1">
                      (est. {alt.estimated_time_minutes} min)
                    </span>
                  )}
                  {alt.benefit && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {alt.benefit}
                    </p>
                  )}
                  {alt.expected_improvement && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {alt.expected_improvement}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer notifications */}
      {recommendation.customer_notifications &&
        recommendation.customer_notifications.length > 0 && (
          <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">
              Customer Impact
            </p>
            <div className="space-y-1">
              {recommendation.customer_notifications.map((cn, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-zinc-300">
                    {cn.customer} (Product {cn.product_id})
                  </span>
                  {cn.delay_days > 0 ? (
                    <span className="text-amber-400">
                      +{cn.delay_days} day{cn.delay_days !== 1 ? "s" : ""} delay
                    </span>
                  ) : (
                    <span className="text-emerald-400">No impact</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          className="flex-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2.5 text-sm transition-colors"
          onClick={() => onAccept(recommendation.schedule_id)}
        >
          Accept Plan
        </button>
        <button
          className="flex-1 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 font-medium py-2.5 text-sm transition-colors disabled:border-zinc-800 disabled:text-zinc-600"
          onClick={onExploreMore}
          disabled={exploring}
        >
          {exploring ? "Exploring..." : "Explore More"}
        </button>
      </div>
    </div>
  );
}

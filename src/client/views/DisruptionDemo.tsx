import { useState, useCallback } from "react";
import { DisruptionTriggerPanel } from "../components/disruption/DisruptionTriggerPanel.js";
import { TriageProgressBar } from "../components/disruption/TriageProgressBar.js";
import { ImpactSummaryCard } from "../components/disruption/ImpactSummaryCard.js";
import { AIRecommendationPanel } from "../components/disruption/AIRecommendationPanel.js";
import {
  useDisruptionTriage,
  triggerDisruption,
  fetchImpact,
  fetchRecommendation,
} from "../hooks/useDisruptionTriage.js";
import type {
  DisruptionEvent,
  DisruptionPhase,
  ImpactMetrics,
  AIRecommendation,
} from "../lib/disruptionTypes.js";

// ---------------------------------------------------------------------------
// DisruptionDemo — main view wiring all sub-components together
// ---------------------------------------------------------------------------

export function DisruptionDemo() {
  // Phase state machine
  const [phase, setPhase] = useState<DisruptionPhase>("trigger");
  const [triageId, setTriageId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Results loaded after triage completes
  const [impact, setImpact] = useState<ImpactMetrics | null>(null);
  const [recommendation, setRecommendation] =
    useState<AIRecommendation | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [loadingRec, setLoadingRec] = useState(false);
  const [exploring, setExploring] = useState(false);

  // Polling hook — active only when triageId is set and phase is "triaging"
  const activePollId = phase === "triaging" ? triageId : null;
  const { data: triageData, isComplete } = useDisruptionTriage(activePollId);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /** User submits a disruption event from the trigger panel. */
  const handleTrigger = useCallback(async (event: DisruptionEvent) => {
    setPhase("triaging");
    setErrorMessage(null);
    setImpact(null);
    setRecommendation(null);

    try {
      const result = await triggerDisruption(event);
      setTriageId(result.triage_id);
    } catch (e) {
      setPhase("error");
      setErrorMessage(e instanceof Error ? e.message : "Trigger failed");
    }
  }, []);

  /** When triage completes, load impact + recommendation. */
  const loadResults = useCallback(async (id: number) => {
    setPhase("results");

    // Load impact and recommendation in parallel
    setLoadingImpact(true);
    setLoadingRec(true);

    try {
      const impactRes = await fetchImpact(id);
      setImpact(impactRes.impact);
    } catch {
      // Impact endpoint might not exist yet; degrade gracefully
      setImpact(null);
    } finally {
      setLoadingImpact(false);
    }

    try {
      const recRes = await fetchRecommendation(id);
      setRecommendation(recRes.recommendation);
    } catch {
      // Recommendation endpoint might not exist yet; degrade gracefully
      setRecommendation(null);
    } finally {
      setLoadingRec(false);
    }
  }, []);

  // Transition from triaging to results when complete
  if (isComplete && phase === "triaging" && triageId != null) {
    // Trigger async loading (the condition prevents re-triggering)
    loadResults(triageId);
  }

  /** Accept the recommended schedule. */
  const handleAccept = useCallback(
    async (scheduleId: number | undefined) => {
      if (scheduleId == null) return;
      try {
        // Set as active schedule via existing API
        await fetch("/api/active-schedule/set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedule_id: scheduleId }),
        });
        // Navigate back to dashboard
        window.location.hash = "#/";
      } catch {
        // Silently fail — user can retry
      }
    },
    [],
  );

  /** Request more exploration on the disrupted state. */
  const handleExploreMore = useCallback(async () => {
    if (triageId == null) return;
    setExploring(true);
    try {
      await fetch("/api/disruption/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triage_id: triageId }),
      });
    } catch {
      // Silently fail
    }
    // Keep exploring state for UI feedback;
    // user can navigate away or wait
  }, [triageId]);

  /** Reset to initial trigger phase. */
  const handleReset = useCallback(() => {
    setPhase("trigger");
    setTriageId(null);
    setImpact(null);
    setRecommendation(null);
    setErrorMessage(null);
    setExploring(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Disruption Demo</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Simulate disruptions and see real-time triage of optimal schedules
          </p>
        </div>
        <div className="flex items-center gap-3">
          {phase !== "trigger" && (
            <button
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-800 rounded px-2 py-1"
              onClick={handleReset}
            >
              New Disruption
            </button>
          )}
          <a
            href="#/"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            &larr; Back to Dashboard
          </a>
        </div>
      </div>

      {/* Error state */}
      {phase === "error" && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-5 mb-6">
          <p className="text-sm text-red-400">
            {errorMessage || "An unknown error occurred."}
          </p>
          <button
            className="mt-3 text-xs text-red-300 hover:text-red-100 underline"
            onClick={handleReset}
          >
            Try again
          </button>
        </div>
      )}

      {/* Phase: Trigger */}
      {phase === "trigger" && (
        <div className="max-w-xl mx-auto">
          <DisruptionTriggerPanel onTrigger={handleTrigger} />
        </div>
      )}

      {/* Phase: Triaging (trigger panel + progress bar side by side) */}
      {phase === "triaging" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DisruptionTriggerPanel onTrigger={handleTrigger} disabled />
          {triageData?.progress ? (
            <TriageProgressBar
              total={triageData.progress.total}
              completed={triageData.progress.completed}
              feasible={triageData.progress.feasible}
              infeasible={triageData.progress.infeasible}
              elapsed={triageData.elapsed_ms ?? 0}
              disruptionScore={triageData.partial_disruption_score ?? undefined}
            />
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex items-center justify-center">
              <span className="text-zinc-500 text-sm">
                Initializing triage...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Phase: Results */}
      {phase === "results" && (
        <div className="space-y-4">
          {/* Final progress bar (complete state) */}
          {triageData?.progress && (
            <TriageProgressBar
              total={triageData.progress.total}
              completed={triageData.progress.completed}
              feasible={triageData.progress.feasible}
              infeasible={triageData.progress.infeasible}
              elapsed={triageData.elapsed_ms ?? 0}
              disruptionScore={
                triageData.results?.disruption_score ??
                triageData.partial_disruption_score ??
                undefined
              }
              isComplete
            />
          )}

          {/* Impact + AI Recommendation row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Impact summary */}
            {loadingImpact ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex items-center justify-center">
                <span className="text-zinc-500 text-sm">
                  Computing impact metrics...
                </span>
              </div>
            ) : impact ? (
              <ImpactSummaryCard impact={impact} />
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest mb-3">
                  Triage Results
                </h2>
                {triageData?.results ? (
                  <div className="space-y-2 text-sm text-zinc-300">
                    <p>
                      Survivors:{" "}
                      <span className="text-emerald-400 font-mono">
                        {triageData.results.survivor_count}
                      </span>
                    </p>
                    <p>
                      Broken:{" "}
                      <span className="text-red-400 font-mono">
                        {triageData.results.broken_count}
                      </span>
                    </p>
                    <p>
                      Disruption Score:{" "}
                      <span className="text-amber-400 font-mono">
                        {triageData.results.disruption_score?.toFixed(0)}%
                      </span>
                    </p>
                    {triageData.results.recovery_time_ms != null && (
                      <p>
                        Recovery Time:{" "}
                        <span className="text-cyan-400 font-mono">
                          {(triageData.results.recovery_time_ms / 1000).toFixed(1)}s
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Impact data not available.
                  </p>
                )}
              </div>
            )}

            {/* AI Recommendation */}
            {loadingRec ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex items-center justify-center">
                <span className="text-zinc-500 text-sm">
                  Generating AI recommendation...
                </span>
              </div>
            ) : recommendation ? (
              <AIRecommendationPanel
                recommendation={recommendation}
                onAccept={handleAccept}
                onExploreMore={handleExploreMore}
                exploring={exploring}
              />
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest mb-3">
                  AI Recommendation
                </h2>
                <p className="text-sm text-zinc-500">
                  Recommendation not yet available. The AI recommendation
                  endpoint may not be configured.
                </p>
              </div>
            )}
          </div>

          {/* Survivors detail table */}
          {triageData?.results?.survivors &&
            triageData.results.survivors.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest mb-3">
                  Survivors ({triageData.results.survivors.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800">
                        <th className="pb-2 pr-4 font-medium">
                          Original Schedule
                        </th>
                        <th className="pb-2 pr-4 font-medium">
                          Triage Schedule
                        </th>
                        <th className="pb-2 pr-4 font-medium text-right">
                          Labor Cost
                        </th>
                        <th className="pb-2 pr-4 font-medium text-right">
                          Makespan
                        </th>
                        <th className="pb-2 font-medium text-right">
                          Tardiness
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {triageData.results.survivors.map((s) => (
                        <tr
                          key={s.triage_schedule_id}
                          className="border-b border-zinc-800/50"
                        >
                          <td className="py-2 pr-4 font-mono text-zinc-300">
                            #{s.original_schedule_id}
                          </td>
                          <td className="py-2 pr-4 font-mono text-emerald-400">
                            #{s.triage_schedule_id}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-zinc-300">
                            {s.delta_kpis.labor_cost != null
                              ? `+$${s.delta_kpis.labor_cost.toLocaleString()}`
                              : "--"}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono text-zinc-300">
                            {s.delta_kpis.makespan_days != null
                              ? `+${s.delta_kpis.makespan_days.toFixed(1)}d`
                              : "--"}
                          </td>
                          <td className="py-2 text-right font-mono text-zinc-300">
                            {s.delta_kpis.tardiness_days != null
                              ? `+${s.delta_kpis.tardiness_days.toFixed(1)}d`
                              : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* Broken detail table */}
          {triageData?.results?.broken &&
            triageData.results.broken.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest mb-3">
                  Broken ({triageData.results.broken.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-800">
                        <th className="pb-2 pr-4 font-medium">
                          Original Schedule
                        </th>
                        <th className="pb-2 pr-4 font-medium">
                          Triage Dispatch
                        </th>
                        <th className="pb-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {triageData.results.broken.map((b) => (
                        <tr
                          key={b.original_schedule_id}
                          className="border-b border-zinc-800/50"
                        >
                          <td className="py-2 pr-4 font-mono text-zinc-300">
                            #{b.original_schedule_id}
                          </td>
                          <td className="py-2 pr-4 font-mono text-zinc-500">
                            #{b.triage_dispatch_id}
                          </td>
                          <td className="py-2 text-red-400">{b.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

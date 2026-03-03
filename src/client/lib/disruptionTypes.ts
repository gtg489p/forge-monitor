import type { ParetoMetrics } from "./paretoTypes.js";

// ---------------------------------------------------------------------------
// Disruption event types
// ---------------------------------------------------------------------------

export const DISRUPTION_EVENT_TYPES = [
  "mat_shortage",
  "wc_downtime",
  "labor_shortage",
  "rush_order",
  "supplier_delay",
  "quality_hold",
] as const;

export type DisruptionEventType = (typeof DISRUPTION_EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<DisruptionEventType, string> = {
  mat_shortage: "Material Shortage",
  wc_downtime: "Machine Down",
  labor_shortage: "Staff Shortage",
  rush_order: "Rush Order",
  supplier_delay: "Supplier Delay",
  quality_hold: "Quality Hold",
};

// ---------------------------------------------------------------------------
// Event config shapes (per event type)
// ---------------------------------------------------------------------------

export interface MaterialShortageConfig {
  material_reductions: Record<string, number>;
  material_limits?: {
    material_id: number;
    window_start: string;
    window_end: string;
    max_cum_qty: number;
  }[];
  note?: string;
}

export interface WcDowntimeConfig {
  downtime_windows: {
    work_center_id: number;
    start_minute: number;
    end_minute: number;
    reason?: string;
  }[];
  note?: string;
}

export interface LaborShortageConfig {
  labor_limits: {
    max_headcount: number;
    shift_type: string;
    date_range?: [string, string];
  }[];
  note?: string;
}

export interface RushOrderConfig {
  additional_runs: {
    product_id: number;
    gallons: number;
    due_date: string;
    priority?: "high" | "normal";
  }[];
  note?: string;
}

export interface SupplierDelayConfig {
  material_delays: Record<string, number>;
  material_limits?: {
    material_id: number;
    window_start: string;
    window_end: string;
    max_cum_qty: number;
  }[];
  note?: string;
}

export interface QualityHoldConfig {
  failed_run: {
    production_run_id: number;
    product_id: number;
    gallons: number;
    reason: string;
  };
  rerun_required: boolean;
  waste_cost?: number;
  note?: string;
}

export type DisruptionEventConfig =
  | MaterialShortageConfig
  | WcDowntimeConfig
  | LaborShortageConfig
  | RushOrderConfig
  | SupplierDelayConfig
  | QualityHoldConfig;

// ---------------------------------------------------------------------------
// Disruption event (the trigger payload)
// ---------------------------------------------------------------------------

export interface DisruptionEvent {
  event_type: DisruptionEventType;
  event_config: DisruptionEventConfig;
  baseline_factory_changelog_id: number;
  baseline_throughput_gallons: Record<string, number>;
  options?: {
    triage_timeout_sec?: number;
    use_relative_anchors?: boolean;
    auto_explore?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Triage progress (polling response)
// ---------------------------------------------------------------------------

export interface TriageProgress {
  total: number;
  completed: number;
  feasible: number;
  infeasible: number;
  pending: number;
}

export interface SurvivorDetail {
  original_schedule_id: number;
  triage_schedule_id: number;
  delta_kpis: Partial<Record<keyof ParetoMetrics, number>>;
}

export interface BrokenDetail {
  original_schedule_id: number;
  triage_dispatch_id: number;
  reason: string;
}

export interface BestSurvivor {
  original_schedule_id: number;
  triage_schedule_id: number;
  total_cost_delta: number;
  kpis: Partial<ParetoMetrics>;
}

export interface TriageResults {
  survivor_count: number;
  broken_count: number;
  disruption_score: number;
  recovery_time_ms: number;
  survivors: SurvivorDetail[];
  broken: BrokenDetail[];
  best_survivor: BestSurvivor | null;
}

export interface TriageResponse {
  triage_id: number;
  triage_status: "pending" | "triaging" | "complete" | "error";
  event_type?: DisruptionEventType;
  event_description?: string;
  baseline_pareto_size: number;
  progress?: TriageProgress;
  partial_disruption_score?: number;
  recovery_time_ms?: number | null;
  elapsed_ms?: number;
  results?: TriageResults;
}

// ---------------------------------------------------------------------------
// Trigger response (immediate)
// ---------------------------------------------------------------------------

export interface TriggerResponse {
  triage_id: number;
  disrupted_factory_changelog_id: number;
  baseline_pareto_size: number;
  triage_dispatch_count: number;
  triage_status: string;
  message: string;
  poll_url: string;
}

// ---------------------------------------------------------------------------
// Impact metrics
// ---------------------------------------------------------------------------

export interface CostImpact {
  labor_cost_delta: number;
  tardiness_delta_days: number;
  makespan_delta_days: number;
  total_weighted_cost_delta: number;
}

export interface OperationalImpact {
  runs_affected: number;
  products_delayed: string[];
  capacity_reduction_pct: number;
}

export interface RecoveryMetrics {
  time_to_first_feasible_ms: number;
  time_to_new_front_ms: number | null;
  best_recovery_cost: number;
  full_recovery_possible: boolean;
}

export interface ImpactMetrics {
  disruption_score: number;
  cost_impact: CostImpact;
  operational_impact: OperationalImpact;
  recovery_metrics: RecoveryMetrics;
}

export interface ImpactResponse {
  triage_id: number;
  impact: ImpactMetrics;
}

// ---------------------------------------------------------------------------
// AI recommendation
// ---------------------------------------------------------------------------

export interface AlternativeAction {
  action: string;
  affected_runs?: number[];
  estimated_cost?: number;
  estimated_time_minutes?: number;
  benefit?: string;
  expected_improvement?: string;
}

export interface CustomerNotification {
  product_id: number;
  customer: string;
  delay_days: number;
  action: string;
}

export interface AIRecommendation {
  action: string;
  schedule_id?: number;
  rationale: string;
  alternatives: AlternativeAction[];
  customer_notifications?: CustomerNotification[];
}

export interface RecommendationResponse {
  triage_id: number;
  recommendation: AIRecommendation;
}

// ---------------------------------------------------------------------------
// Exploration
// ---------------------------------------------------------------------------

export interface ExploreRequest {
  triage_id: number;
  exploration_config?: {
    operators?: string[];
    max_dispatches?: number;
    timeout_minutes?: number;
  };
}

export interface ExploreResponse {
  triage_id: number;
  exploration_status: string;
  dispatches_created: number;
  disrupted_factory_changelog_id: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Disruption demo view state machine
// ---------------------------------------------------------------------------

export type DisruptionPhase =
  | "trigger"       // User selecting disruption type
  | "triaging"      // Triage in progress
  | "results"       // Triage complete, showing results
  | "exploring"     // Optional: new Pareto exploration running
  | "error";        // Something went wrong

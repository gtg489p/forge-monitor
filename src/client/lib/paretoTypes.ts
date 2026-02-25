export interface ParetoMetrics {
  labor_cost: number;
  restock_cost: number;
  flowtime_days: number;
  makespan_days: number;
  tardiness_days: number;
  fg_holding_cost: number;
  fg_shipping_cost: number;
  material_holding_cost: number;
  wc_idle_minutes_total: number;
  product_shift_concentration: number;
  product_weekday_concentration: number;
  product_work_center_concentration: number;
}

export interface ParetoFrontPoint {
  schedule_id: number;
  created_at: string;
  objective: string;
  solve_status: string;
  solve_time: number;
  throughput_gallons: Record<string, number>;
  pareto_metrics: ParetoMetrics;
  dispatch: Record<string, unknown>;
}

export type ParetoFrontResponse = ParetoFrontPoint[];

export const PRIMARY_OBJECTIVES = [
  "makespan_days",
  "flowtime_days",
  "labor_cost",
  "tardiness_days",
] as const;

export type PrimaryObjective = (typeof PRIMARY_OBJECTIVES)[number];

export const AXIS_LABELS: Record<string, string> = {
  makespan_days: "Makespan (min)",
  flowtime_days: "Flowtime (days)",
  labor_cost: "Labor Cost ($)",
  tardiness_days: "Tardiness (min)",
};

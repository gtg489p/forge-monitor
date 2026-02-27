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

export const ALL_OBJECTIVES: { key: keyof ParetoMetrics; label: string; unit: string }[] = [
  { key: "makespan_days",                     label: "Makespan",              unit: "min" },
  { key: "flowtime_days",                     label: "Flowtime",              unit: "days" },
  { key: "labor_cost",                        label: "Labor Cost",            unit: "$" },
  { key: "tardiness_days",                    label: "Tardiness",             unit: "min" },
  { key: "fg_holding_cost",                   label: "FG Holding Cost",       unit: "$" },
  { key: "fg_shipping_cost",                  label: "Shipping Cost",         unit: "$" },
  { key: "restock_cost",                      label: "Restock Cost",          unit: "$" },
  { key: "material_holding_cost",             label: "Material Holding",      unit: "$" },
  { key: "wc_idle_minutes_total",             label: "WC Idle Time",          unit: "min" },
  { key: "product_shift_concentration",       label: "Shift Concentration",   unit: "" },
  { key: "product_weekday_concentration",     label: "Weekday Concentration", unit: "" },
  { key: "product_work_center_concentration", label: "WC Concentration",      unit: "" },
];

export const AXIS_LABELS: Record<string, string> = Object.fromEntries(
  ALL_OBJECTIVES.map(({ key, label, unit }) => [key, unit ? `${label} (${unit})` : label]),
);

export const DEFAULT_AXES: (keyof ParetoMetrics)[] = [
  "makespan_days",
  "flowtime_days",
  "labor_cost",
  "tardiness_days",
];

const STORAGE_KEY = "pareto-axis-selection";

export function loadAxisSelection(): (keyof ParetoMetrics)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AXES;
    const parsed = JSON.parse(raw) as string[];
    const validKeys = new Set(ALL_OBJECTIVES.map((o) => o.key));
    const valid = parsed.filter((k): k is keyof ParetoMetrics => validKeys.has(k as keyof ParetoMetrics));
    return valid.length >= 2 ? valid : DEFAULT_AXES;
  } catch {
    return DEFAULT_AXES;
  }
}

export function saveAxisSelection(axes: (keyof ParetoMetrics)[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(axes));
}

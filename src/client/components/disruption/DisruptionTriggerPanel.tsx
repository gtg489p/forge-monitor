import { useState, useCallback } from "react";
import type {
  DisruptionEventType,
  DisruptionEvent,
  DisruptionEventConfig,
  MaterialShortageConfig,
  WcDowntimeConfig,
  LaborShortageConfig,
  RushOrderConfig,
  SupplierDelayConfig,
  QualityHoldConfig,
} from "../../lib/disruptionTypes.js";
import {
  DISRUPTION_EVENT_TYPES,
  EVENT_TYPE_LABELS,
} from "../../lib/disruptionTypes.js";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DisruptionTriggerPanelProps {
  /** Called when the user submits a disruption trigger. */
  onTrigger: (event: DisruptionEvent) => void;
  /** Whether a triage is currently in progress (disables the form). */
  disabled?: boolean;
  /** Baseline factory_changelog_id to use. */
  baselineFactoryChangelogId?: number;
  /** Baseline throughput vector. */
  baselineThroughputGallons?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Default event configs per type
// ---------------------------------------------------------------------------

function defaultConfig(eventType: DisruptionEventType): DisruptionEventConfig {
  switch (eventType) {
    case "mat_shortage":
      return {
        material_reductions: {},
        note: "",
      } satisfies MaterialShortageConfig;
    case "wc_downtime":
      return {
        downtime_windows: [
          { work_center_id: 0, start_minute: 1440, end_minute: 4320, reason: "" },
        ],
        note: "",
      } satisfies WcDowntimeConfig;
    case "labor_shortage":
      return {
        labor_limits: [
          { max_headcount: 2, shift_type: "Second", date_range: undefined },
        ],
        note: "",
      } satisfies LaborShortageConfig;
    case "rush_order":
      return {
        additional_runs: [
          { product_id: 30, gallons: 6000, due_date: "", priority: "high" },
        ],
        note: "",
      } satisfies RushOrderConfig;
    case "supplier_delay":
      return {
        material_delays: {},
        note: "",
      } satisfies SupplierDelayConfig;
    case "quality_hold":
      return {
        failed_run: {
          production_run_id: 0,
          product_id: 0,
          gallons: 0,
          reason: "",
        },
        rerun_required: true,
        note: "",
      } satisfies QualityHoldConfig;
  }
}

// ---------------------------------------------------------------------------
// Sub-forms per event type
// ---------------------------------------------------------------------------

function MaterialShortageForm({
  config,
  onChange,
}: {
  config: MaterialShortageConfig;
  onChange: (c: MaterialShortageConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-zinc-400">Material ID</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="6"
          onChange={(e) => {
            const id = e.target.value;
            onChange({
              ...config,
              material_reductions: { [id]: Number(Object.values(config.material_reductions)[0] || 500) },
            });
          }}
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Reduced quantity (units available)</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="500"
          onChange={(e) => {
            const qty = Number(e.target.value);
            const id = Object.keys(config.material_reductions)[0] || "6";
            onChange({ ...config, material_reductions: { [id]: qty } });
          }}
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Note</span>
        <input
          type="text"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="Resin supplier delivery delayed"
          value={config.note || ""}
          onChange={(e) => onChange({ ...config, note: e.target.value })}
        />
      </label>
    </div>
  );
}

function WcDowntimeForm({
  config,
  onChange,
}: {
  config: WcDowntimeConfig;
  onChange: (c: WcDowntimeConfig) => void;
}) {
  const window = config.downtime_windows[0] ?? {
    work_center_id: 0,
    start_minute: 1440,
    end_minute: 4320,
    reason: "",
  };
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-zinc-400">Work Center ID</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="3"
          value={window.work_center_id || ""}
          onChange={(e) =>
            onChange({
              ...config,
              downtime_windows: [
                { ...window, work_center_id: Number(e.target.value) },
              ],
            })
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-zinc-400">Start (minute)</span>
          <input
            type="number"
            className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            value={window.start_minute}
            onChange={(e) =>
              onChange({
                ...config,
                downtime_windows: [
                  { ...window, start_minute: Number(e.target.value) },
                ],
              })
            }
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">End (minute)</span>
          <input
            type="number"
            className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            value={window.end_minute}
            onChange={(e) =>
              onChange({
                ...config,
                downtime_windows: [
                  { ...window, end_minute: Number(e.target.value) },
                ],
              })
            }
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-zinc-400">Reason</span>
        <input
          type="text"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="Emergency pump replacement"
          value={window.reason || ""}
          onChange={(e) =>
            onChange({
              ...config,
              downtime_windows: [{ ...window, reason: e.target.value }],
            })
          }
        />
      </label>
    </div>
  );
}

function LaborShortageForm({
  config,
  onChange,
}: {
  config: LaborShortageConfig;
  onChange: (c: LaborShortageConfig) => void;
}) {
  const limit = config.labor_limits[0] ?? {
    max_headcount: 2,
    shift_type: "Second",
  };
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-zinc-400">Shift</span>
        <select
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          value={limit.shift_type}
          onChange={(e) =>
            onChange({
              ...config,
              labor_limits: [{ ...limit, shift_type: e.target.value }],
            })
          }
        >
          <option value="First">First</option>
          <option value="Second">Second</option>
          <option value="Third">Third</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Max headcount available</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          value={limit.max_headcount}
          onChange={(e) =>
            onChange({
              ...config,
              labor_limits: [
                { ...limit, max_headcount: Number(e.target.value) },
              ],
            })
          }
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Note</span>
        <input
          type="text"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="3 second-shift operators called out"
          value={config.note || ""}
          onChange={(e) => onChange({ ...config, note: e.target.value })}
        />
      </label>
    </div>
  );
}

function RushOrderForm({
  config,
  onChange,
}: {
  config: RushOrderConfig;
  onChange: (c: RushOrderConfig) => void;
}) {
  const run = config.additional_runs[0] ?? {
    product_id: 30,
    gallons: 6000,
    due_date: "",
    priority: "high" as const,
  };
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-zinc-400">Product ID</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          value={run.product_id}
          onChange={(e) =>
            onChange({
              ...config,
              additional_runs: [{ ...run, product_id: Number(e.target.value) }],
            })
          }
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Gallons</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          value={run.gallons}
          onChange={(e) =>
            onChange({
              ...config,
              additional_runs: [{ ...run, gallons: Number(e.target.value) }],
            })
          }
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Due date</span>
        <input
          type="date"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          value={run.due_date}
          onChange={(e) =>
            onChange({
              ...config,
              additional_runs: [{ ...run, due_date: e.target.value }],
            })
          }
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Note</span>
        <input
          type="text"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="Emergency order from Acme Corp"
          value={config.note || ""}
          onChange={(e) => onChange({ ...config, note: e.target.value })}
        />
      </label>
    </div>
  );
}

function SupplierDelayForm({
  config,
  onChange,
}: {
  config: SupplierDelayConfig;
  onChange: (c: SupplierDelayConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-zinc-400">Material ID</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="8"
          onChange={(e) => {
            const id = e.target.value;
            const delay = Number(Object.values(config.material_delays)[0] || 7200);
            onChange({ ...config, material_delays: { [id]: delay } });
          }}
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Delay (minutes until available)</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="7200"
          onChange={(e) => {
            const delay = Number(e.target.value);
            const id = Object.keys(config.material_delays)[0] || "8";
            onChange({ ...config, material_delays: { [id]: delay } });
          }}
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Note</span>
        <input
          type="text"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="Pigment supplier delayed 5 days"
          value={config.note || ""}
          onChange={(e) => onChange({ ...config, note: e.target.value })}
        />
      </label>
    </div>
  );
}

function QualityHoldForm({
  config,
  onChange,
}: {
  config: QualityHoldConfig;
  onChange: (c: QualityHoldConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs text-zinc-400">Failed Production Run ID</span>
        <input
          type="number"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          value={config.failed_run.production_run_id || ""}
          onChange={(e) =>
            onChange({
              ...config,
              failed_run: {
                ...config.failed_run,
                production_run_id: Number(e.target.value),
              },
            })
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-zinc-400">Product ID</span>
          <input
            type="number"
            className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            value={config.failed_run.product_id || ""}
            onChange={(e) =>
              onChange({
                ...config,
                failed_run: {
                  ...config.failed_run,
                  product_id: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-400">Gallons</span>
          <input
            type="number"
            className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            value={config.failed_run.gallons || ""}
            onChange={(e) =>
              onChange({
                ...config,
                failed_run: {
                  ...config.failed_run,
                  gallons: Number(e.target.value),
                },
              })
            }
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-zinc-400">Failure reason</span>
        <input
          type="text"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="Viscosity out of spec"
          value={config.failed_run.reason}
          onChange={(e) =>
            onChange({
              ...config,
              failed_run: { ...config.failed_run, reason: e.target.value },
            })
          }
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="rounded bg-zinc-800 border-zinc-700 text-cyan-500 focus:ring-cyan-500"
          checked={config.rerun_required}
          onChange={(e) =>
            onChange({ ...config, rerun_required: e.target.checked })
          }
        />
        <span className="text-xs text-zinc-400">Re-run required</span>
      </label>
      <label className="block">
        <span className="text-xs text-zinc-400">Note</span>
        <input
          type="text"
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          placeholder="Product 31 batch failed viscosity QC"
          value={config.note || ""}
          onChange={(e) => onChange({ ...config, note: e.target.value })}
        />
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config form dispatcher
// ---------------------------------------------------------------------------

function ConfigForm({
  eventType,
  config,
  onChange,
}: {
  eventType: DisruptionEventType;
  config: DisruptionEventConfig;
  onChange: (c: DisruptionEventConfig) => void;
}) {
  switch (eventType) {
    case "mat_shortage":
      return (
        <MaterialShortageForm
          config={config as MaterialShortageConfig}
          onChange={onChange}
        />
      );
    case "wc_downtime":
      return (
        <WcDowntimeForm
          config={config as WcDowntimeConfig}
          onChange={onChange}
        />
      );
    case "labor_shortage":
      return (
        <LaborShortageForm
          config={config as LaborShortageConfig}
          onChange={onChange}
        />
      );
    case "rush_order":
      return (
        <RushOrderForm
          config={config as RushOrderConfig}
          onChange={onChange}
        />
      );
    case "supplier_delay":
      return (
        <SupplierDelayForm
          config={config as SupplierDelayConfig}
          onChange={onChange}
        />
      );
    case "quality_hold":
      return (
        <QualityHoldForm
          config={config as QualityHoldConfig}
          onChange={onChange}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DisruptionTriggerPanel({
  onTrigger,
  disabled = false,
  baselineFactoryChangelogId,
  baselineThroughputGallons,
}: DisruptionTriggerPanelProps) {
  const [selectedEventType, setSelectedEventType] =
    useState<DisruptionEventType>("mat_shortage");
  const [eventConfig, setEventConfig] = useState<DisruptionEventConfig>(
    defaultConfig("mat_shortage"),
  );

  const handleEventTypeChange = useCallback(
    (type: DisruptionEventType) => {
      setSelectedEventType(type);
      setEventConfig(defaultConfig(type));
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    const event: DisruptionEvent = {
      event_type: selectedEventType,
      event_config: eventConfig,
      baseline_factory_changelog_id: baselineFactoryChangelogId ?? 27,
      baseline_throughput_gallons: baselineThroughputGallons ?? {
        "30": 10500,
        "31": 10500,
        "32": 10500,
      },
      options: {
        triage_timeout_sec: 10,
        use_relative_anchors: true,
        auto_explore: false,
      },
    };
    onTrigger(event);
  }, [
    selectedEventType,
    eventConfig,
    baselineFactoryChangelogId,
    baselineThroughputGallons,
    onTrigger,
  ]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest mb-4">
        Simulate Disruption
      </h2>

      {/* Event type selector */}
      <label className="block mb-4">
        <span className="text-xs text-zinc-400">Event Type</span>
        <select
          className="mt-1 block w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
          value={selectedEventType}
          disabled={disabled}
          onChange={(e) =>
            handleEventTypeChange(e.target.value as DisruptionEventType)
          }
        >
          {DISRUPTION_EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      {/* Dynamic config form */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 mb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
          {EVENT_TYPE_LABELS[selectedEventType]} Config
        </p>
        <ConfigForm
          eventType={selectedEventType}
          config={eventConfig}
          onChange={setEventConfig}
        />
      </div>

      {/* Submit button */}
      <button
        className="w-full rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium py-2.5 text-sm transition-colors"
        disabled={disabled}
        onClick={handleSubmit}
      >
        {disabled ? "Triage In Progress..." : "Run Triage"}
      </button>
    </div>
  );
}

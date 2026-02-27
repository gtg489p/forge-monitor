import type { ParetoMetrics } from "../lib/paretoTypes.js";
import { ALL_OBJECTIVES } from "../lib/paretoTypes.js";

interface Props {
  selected: (keyof ParetoMetrics)[];
  onChange: (axes: (keyof ParetoMetrics)[]) => void;
}

export function AxisSelector({ selected, onChange }: Props) {
  const selectedSet = new Set(selected);

  function toggle(key: keyof ParetoMetrics) {
    if (selectedSet.has(key)) {
      if (selected.length <= 2) return; // min 2
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  function moveUp(key: keyof ParetoMetrics) {
    const idx = selected.indexOf(key);
    if (idx <= 0) return;
    const next = [...selected];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  }

  function moveDown(key: keyof ParetoMetrics) {
    const idx = selected.indexOf(key);
    if (idx < 0 || idx >= selected.length - 1) return;
    const next = [...selected];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mt-4">
      <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">
        Axes ({selected.length} / {ALL_OBJECTIVES.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_OBJECTIVES.map(({ key, label }) => {
          const active = selectedSet.has(key);
          const selIdx = selected.indexOf(key);
          return (
            <span
              key={key}
              className={`inline-flex items-center gap-1 text-xs rounded-full px-3 py-1 border cursor-pointer select-none transition-colors ${
                active
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <button
                onClick={() => toggle(key)}
                className="hover:text-white"
                title={active ? `Remove ${label}` : `Add ${label}`}
              >
                {label}
              </button>
              {active && (
                <>
                  <button
                    onClick={() => moveUp(key)}
                    disabled={selIdx === 0}
                    className="text-[10px] leading-none opacity-60 hover:opacity-100 disabled:opacity-20"
                    title="Move left"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => moveDown(key)}
                    disabled={selIdx === selected.length - 1}
                    className="text-[10px] leading-none opacity-60 hover:opacity-100 disabled:opacity-20"
                    title="Move right"
                  >
                    ▶
                  </button>
                </>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

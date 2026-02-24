interface Props {
  value: number;
  onChange: (minutes: number) => void;
}

const OPTIONS = [
  { label: "5m", value: 5 },
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "5h", value: 300 },
];

export function TimeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-cyan-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

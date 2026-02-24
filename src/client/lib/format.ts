export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatMBs(value: number): string {
  if (value >= 1000) return `${(value / 1024).toFixed(1)} GB/s`;
  if (value >= 1) return `${value.toFixed(1)} MB/s`;
  return `${(value * 1024).toFixed(0)} KB/s`;
}

export function fmt2(value: number): string {
  return value.toFixed(2);
}

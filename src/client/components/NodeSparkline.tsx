import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { MetricSnapshot } from "../../types.js";
import { memo } from "react";

interface Props {
  snapshots: MetricSnapshot[];
}

export const NodeSparkline = memo(function NodeSparkline({ snapshots }: Props) {
  const data = snapshots.slice(-60).map((s) => ({ v: s.cpu }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke="#10b981"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

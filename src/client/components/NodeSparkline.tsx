import ReactECharts from "echarts-for-react";
import type { MetricSnapshot } from "../../types.js";
import { memo } from "react";

interface Props {
  snapshots: MetricSnapshot[];
}

export const NodeSparkline = memo(function NodeSparkline({ snapshots }: Props) {
  const data = snapshots.slice(-60).map((s) => s.cpu);

  const option = {
    animation: false,
    grid: { top: 2, right: 0, bottom: 2, left: 0 },
    xAxis: { type: "category" as const, show: false, data: data.map((_, i) => i) },
    yAxis: { type: "value" as const, show: false, min: 0, max: 100 },
    series: [
      {
        type: "line" as const,
        data,
        showSymbol: false,
        lineStyle: { color: "#10b981", width: 1.5 },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      theme="forgeMonitor"
      style={{ height: 32, width: "100%" }}
      notMerge={true}
      opts={{ renderer: "canvas" }}
    />
  );
});

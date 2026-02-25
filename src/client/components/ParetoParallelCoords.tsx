import { useRef, useEffect, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { ParetoFrontPoint, PrimaryObjective } from "../lib/paretoTypes.js";
import { PRIMARY_OBJECTIVES, AXIS_LABELS } from "../lib/paretoTypes.js";

interface Props {
  points: ParetoFrontPoint[];
  colorBy: PrimaryObjective;
  onBrush?: (filteredIndices: number[] | null) => void;
}

export function ParetoParallelCoords({ points, colorBy, onBrush }: Props) {
  const chartRef = useRef<ReactECharts>(null);

  const colorDim = PRIMARY_OBJECTIVES.indexOf(colorBy);
  const colorValues = points.map((p) => p.pareto_metrics[colorBy]);

  const option: EChartsOption = useMemo(
    () => ({
      visualMap: {
        type: "continuous",
        dimension: colorDim,
        min: colorValues.length ? Math.min(...colorValues) : 0,
        max: colorValues.length ? Math.max(...colorValues) : 100,
        inRange: { color: ["#3b82f6", "#f59e0b", "#ef4444"] },
        text: ["High", "Low"],
        orient: "vertical",
        right: 0,
        top: "center",
        calculable: true,
      },
      parallelAxis: PRIMARY_OBJECTIVES.map((key, dim) => ({
        dim,
        name: AXIS_LABELS[key],
        type: "value" as const,
        nameLocation: "start" as const,
      })),
      parallel: {
        left: 60,
        right: 80,
        top: 40,
        bottom: 30,
        parallelAxisDefault: {
          type: "value",
          nameGap: 20,
          nameTextStyle: { color: "#e4e4e7", fontSize: 12 },
          realtime: false,
        },
      },
      series: [
        {
          type: "parallel",
          data: points.map((p) =>
            PRIMARY_OBJECTIVES.map((k) => p.pareto_metrics[k]),
          ),
          lineStyle: { width: 1.5, opacity: 0.4 },
          emphasis: { lineStyle: { width: 3, opacity: 1.0 } },
          smooth: false,
          progressive: 500,
        },
      ],
    }),
    [points, colorDim, colorValues],
  );

  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || !onBrush) return;

    const handler = (event: Record<string, unknown>) => {
      const intervals = (event.intervals ?? {}) as Record<
        string,
        [number, number]
      >;
      if (Object.keys(intervals).length === 0) {
        onBrush(null);
        return;
      }
      const filtered: number[] = [];
      points.forEach((p, i) => {
        const values = PRIMARY_OBJECTIVES.map((k) => p.pareto_metrics[k]);
        const passes = Object.entries(intervals).every(([axisIdx, range]) => {
          const [lo, hi] = range;
          return (
            values[Number(axisIdx)] >= lo && values[Number(axisIdx)] <= hi
          );
        });
        if (passes) filtered.push(i);
      });
      onBrush(filtered);
    };

    instance.on("axisareaselected", handler);
    return () => {
      instance.off("axisareaselected", handler);
    };
  }, [points, onBrush]);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      theme="forgeMonitor"
      style={{ height: 400, width: "100%" }}
      notMerge={true}
      opts={{ renderer: "canvas" }}
    />
  );
}

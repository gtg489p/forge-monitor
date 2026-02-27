import { useRef, useEffect, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { ParetoFrontPoint, ParetoMetrics } from "../lib/paretoTypes.js";
import { AXIS_LABELS } from "../lib/paretoTypes.js";

export interface ActiveFilter {
  axisIndex: number;
  axisKey: keyof ParetoMetrics;
  range: [number, number];
}

interface Props {
  points: ParetoFrontPoint[];
  axes: (keyof ParetoMetrics)[];
  colorBy: keyof ParetoMetrics;
  /** Optional per-point custom color values (e.g. crowding distance). Overrides colorBy. */
  customColorValues?: number[];
  customColorLabel?: string;
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  onPointClick?: (index: number) => void;
}

export function ParetoParallelCoords({
  points,
  axes,
  colorBy,
  customColorValues,
  customColorLabel,
  onFiltersChange,
  onPointClick,
}: Props) {
  const chartRef = useRef<ReactECharts>(null);

  const colorDim = axes.indexOf(colorBy);
  const useCustomColor = customColorValues && customColorValues.length === points.length;

  const colorMin = useMemo(() => {
    if (useCustomColor) return Math.min(...customColorValues);
    const vals = points.map((p) => p.pareto_metrics[colorBy]);
    return vals.length ? Math.min(...vals) : 0;
  }, [points, colorBy, useCustomColor, customColorValues]);

  const colorMax = useMemo(() => {
    if (useCustomColor) return Math.max(...customColorValues);
    const vals = points.map((p) => p.pareto_metrics[colorBy]);
    return vals.length ? Math.max(...vals) : 100;
  }, [points, colorBy, useCustomColor, customColorValues]);

  const option: EChartsOption = useMemo(
    () => ({
      visualMap: {
        type: "continuous",
        dimension: useCustomColor ? axes.length : colorDim,
        min: colorMin,
        max: colorMax,
        inRange: useCustomColor
          ? { color: ["#ef4444", "#f59e0b", "#3b82f6"] } // red(dense) → blue(sparse)
          : { color: ["#3b82f6", "#f59e0b", "#ef4444"] },
        text: useCustomColor ? ["Sparse", "Dense"] : ["High", "Low"],
        orient: "vertical",
        right: 0,
        top: "center",
        calculable: true,
      },
      parallelAxis: axes.map((key, dim) => ({
        dim,
        name: AXIS_LABELS[key] ?? key,
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
          data: points.map((p, i) => {
            const row = axes.map((k) => p.pareto_metrics[k]);
            if (useCustomColor) row.push(customColorValues[i]);
            return row;
          }),
          lineStyle: { width: 1.5, opacity: 0.3 },
          emphasis: { lineStyle: { width: 3, opacity: 1.0 } },
          smooth: false,
          progressive: 500,
        },
      ],
    }),
    [points, axes, colorDim, colorMin, colorMax, useCustomColor, customColorValues],
  );

  // Brush filter events
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || !onFiltersChange) return;

    const handler = (event: Record<string, unknown>) => {
      const intervals = (event.intervals ?? {}) as Record<string, [number, number]>;
      const filters: ActiveFilter[] = Object.entries(intervals).map(([axisIdx, range]) => ({
        axisIndex: Number(axisIdx),
        axisKey: axes[Number(axisIdx)],
        range,
      }));
      onFiltersChange(filters);
    };

    instance.on("axisareaselected", handler);
    return () => {
      instance.off("axisareaselected", handler);
    };
  }, [axes, onFiltersChange]);

  // Click handler for solution inspector
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance || !onPointClick) return;

    const zr = instance.getZr();
    const clickHandler = (params: { offsetX: number; offsetY: number }) => {
      // Use ECharts convertFromPixel to find nearest point
      // For parallel coords, we compute distance to each polyline
      const { offsetX, offsetY } = params;
      const model = instance.getModel() as unknown as {
        getComponent: (type: string) => { coordinateSystem?: { dimensions: { length: number }; axisModels: { axis: { toGlobalCoord: (v: number) => number; dataToCoord: (v: number) => number } }[] } } | undefined;
      };
      const parallelModel = model.getComponent("parallel");
      if (!parallelModel?.coordinateSystem) return;

      const cs = parallelModel.coordinateSystem;
      const axisModels = cs.axisModels;
      if (!axisModels || axisModels.length === 0) return;

      let bestIdx = -1;
      let bestDist = Infinity;

      for (let i = 0; i < points.length; i++) {
        const vals = axes.map((k) => points[i].pareto_metrics[k]);
        let totalDist = 0;
        let segCount = 0;
        for (let a = 0; a < axisModels.length - 1; a++) {
          const ax1 = axisModels[a].axis;
          const ax2 = axisModels[a + 1].axis;
          const x1 = ax1.toGlobalCoord(ax1.dataToCoord(vals[a]));
          const x2 = ax2.toGlobalCoord(ax2.dataToCoord(vals[a + 1]));
          // Approximate: closest point on segment to click
          const y1 = x1, y2 = x2; // parallel axes are vertical, so this is the horizontal layout
          // Actually in parallel coords, axes are vertical lines at fixed x positions
          // Each axis has a fixed x, and the data maps to y on that axis
          // We need to compute distance from click to the polyline
          // Skip complex geometry — just sum y-distance at each axis
          const axisX = ax1.toGlobalCoord(0);
          if (Math.abs(offsetX - axisX) < 40) {
            const dataY = ax1.toGlobalCoord(ax1.dataToCoord(vals[a]));
            totalDist += Math.abs(offsetY - dataY);
            segCount++;
          }
        }
        if (segCount > 0) {
          const avgDist = totalDist / segCount;
          if (avgDist < bestDist) {
            bestDist = avgDist;
            bestIdx = i;
          }
        }
      }

      if (bestIdx >= 0 && bestDist < 20) {
        onPointClick(bestIdx);
      }
    };

    zr.on("click", clickHandler);
    return () => {
      zr.off("click", clickHandler);
    };
  }, [points, axes, onPointClick]);

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

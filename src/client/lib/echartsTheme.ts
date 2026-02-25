import * as echarts from "echarts";

export const forgeMonitorTheme: Record<string, unknown> = {
  backgroundColor: "transparent",

  color: [
    "#06b6d4", "#8b5cf6", "#3b82f6", "#f59e0b",
    "#10b981", "#f43f5e", "#6366f1", "#a855f7", "#ec4899",
  ],

  textStyle: {
    color: "#a1a1aa",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  },

  title: {
    textStyle: { color: "#e4e4e7" },
    subtextStyle: { color: "#71717a" },
  },

  legend: {
    textStyle: { color: "#a1a1aa" },
  },

  categoryAxis: {
    axisLine: { lineStyle: { color: "#27272a" } },
    axisTick: { lineStyle: { color: "#27272a" } },
    axisLabel: { color: "#71717a" },
    splitLine: { lineStyle: { color: "#18181b" } },
  },

  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#71717a" },
    splitLine: { lineStyle: { color: "#27272a" } },
  },

  tooltip: {
    backgroundColor: "#27272a",
    borderColor: "#3f3f46",
    textStyle: { color: "#e4e4e7" },
  },

  line: {
    smooth: false,
    symbol: "none",
    lineStyle: { width: 1.5 },
  },

  parallelAxis: {
    axisLine: { lineStyle: { color: "#3f3f46" } },
    axisTick: { lineStyle: { color: "#3f3f46" } },
    axisLabel: { color: "#a1a1aa" },
    splitLine: { show: false },
    nameTextStyle: { color: "#e4e4e7" },
  },

  radar: {
    axisLine: { lineStyle: { color: "#3f3f46" } },
    splitLine: { lineStyle: { color: "#27272a" } },
    splitArea: { areaStyle: { color: ["transparent", "rgba(39,39,42,0.3)"] } },
    axisName: { color: "#a1a1aa" },
  },

  visualMap: {
    textStyle: { color: "#a1a1aa" },
    inRange: { color: ["#3b82f6", "#f59e0b", "#ef4444"] },
  },

  toolbox: {
    iconStyle: { borderColor: "#71717a" },
  },

  dataZoom: {
    backgroundColor: "transparent",
    dataBackgroundColor: "#27272a",
    fillerColor: "rgba(6,182,212,0.15)",
    handleColor: "#06b6d4",
    textStyle: { color: "#a1a1aa" },
  },
};

echarts.registerTheme("forgeMonitor", forgeMonitorTheme);

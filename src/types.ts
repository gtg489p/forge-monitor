export interface MetricSnapshot {
  timestamp: number;
  cpu: number; // percentage 0-100
  cpuCores: number[]; // per-core load percentages 0-100
  memory: {
    percent: number; // 0-100
    used: number; // GB
    total: number; // GB
  };
  disk: {
    read: number; // MB/s
    write: number; // MB/s
  };
  network: {
    rx: number; // MB/s
    tx: number; // MB/s
  };
  load: {
    avg1: number;
    avg5: number;
    avg15: number;
  };
}

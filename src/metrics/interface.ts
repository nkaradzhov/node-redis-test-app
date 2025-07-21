import type { MetricsStateData, AggregatedMetrics } from "./metrics-state";

export interface IMetricsState {
  recordCommandSuccess: (commandName: string, latencyMs: number) => void;
  recordCommandError: (
    commandName: string,
    latencyMs: number,
    errorType?: string
  ) => void;
  getMetricsState: (startTime: number, currentTime: number) => MetricsStateData;
  getAggregatedMetrics: () => AggregatedMetrics;
}

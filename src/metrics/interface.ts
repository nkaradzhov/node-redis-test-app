export interface MetricsData {
  duration: number;
  totalCommandsCount: number;
  successfulCommandsCount: number;
  failedCommandsCount: number;
  successRate: number;
  overallThroughput: number;
  avgReconnectionDurationMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  medianLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
}

export interface IMetricsState {
  recordCommand: (
    commandName: string,
    latencyMs: number,
    errorType?: string
  ) => void;
  recordPubSubCommand: (
    type: "publish" | "receive",
    channel: string,
    subscriberId?: string
  ) => void;
  recordReconnectionDuration: (durationMs: number) => void;
  recordConnectionAttempt: (success: boolean) => void;
  recordReconnectionAttempt: () => void;
  getMetrics: (startTime: number, currentTime: number) => MetricsData;
  getLatencyPercentiles: () => {
    medianLatencyMs: number | "unavailable";
    p95LatencyMs: number | "unavailable";
    p99LatencyMs: number | "unavailable";
  };
}

export const WorkloadRunnerState = {
  Connecting: "connecting",
  Running: "running",
  Completed: "completed",
  Error: "error",
  Stopped: "stopped",
} as const;

export type WorkloadRunnerState =
  (typeof WorkloadRunnerState)[keyof typeof WorkloadRunnerState];

export interface TestResults {
  app_name: string;
  instance_id: string;
  run_id: string;
  version: string;
  test_duration: string;
  workload_name: string;
  total_commands_count: number;
  successful_commands_count: number;
  failed_commands_count: number;
  success_rate: string;
  overall_throughput: number;
  avg_reconnection_duration_ms: number;
  run_start: number;
  run_end: number;
  min_latency_ms: number;
  max_latency_ms: number;
  avg_latency_ms: number;
  median_latency_ms: number | "unavailable";
  p95_latency_ms: number | "unavailable";
  p99_latency_ms: number | "unavailable";
}

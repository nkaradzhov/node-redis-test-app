export const LoggerModule = {
  RedisClient: "redis-client",
  WorkloadRunner: "workload-runner",
  MetricsProxy: "metrics-proxy",
  Main: "main",
} as const;

export const LoggerAction = {
  RedisClientError: "redis-client-exception",
  WorkloadConnectClients: "workload-connect-clients",
  WorkloadRunning: "workload-running",
  WorkloadCompleted: "workload-completed",
  Metrics: "metrics",
  MainError: "main-error",
  ExecuteCommand: "execute-command",
} as const;

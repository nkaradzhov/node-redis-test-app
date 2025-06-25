export const MetricName = {
  RedisCommandLatency: "redis.command.latency",
  RedisOperationsTotal: "redis.operations.total",
  RedisOperationsSuccess: "redis.operations.success",
  RedisOperationsError: "redis.operations.error",
  RedisOperationsRate: "redis.operations.rate",
  RedisOperationsCount: "redis.operations.count",
} as const;

export const MetricLabel = {
  InstanceId: "instance_id",
  RunId: "run_id",
  Command: "command",
  Status: "status",
  Type: "type",
} as const;

export const MetricStatus = {
  Success: "success",
  Error: "error",
} as const;

export const MetricType = {
  Total: "total",
  Successful: "successful",
  Error: "error",
} as const;

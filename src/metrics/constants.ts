/**
 * Metric names as defined in the Redis Testing Metrics Specification
 */
export const MetricName = {
  RedisOperationsTotal: "redis_operations_total",
  RedisOperationDuration: "redis_operation_duration",
  RedisConnectionsTotal: "redis_connections_total",
  RedisReconnectionDuration: "redis_reconnection_duration_ms",
} as const;

/**
 * Metric labels as defined in the Redis Testing Metrics Specification
 */
export const MetricLabel = {
  Operation: "operation",
  Status: "status",
  AppName: "app_name",
  InstanceId: "instance_id",
  Version: "version",
  ErrorType: "error_type",
} as const;

/**
 * Status values for metrics
 */
export const MetricStatus = {
  Success: "success",
  Error: "error",
} as const;

/**
 * Error type classifications as defined in the specification
 */
export const ErrorType = {
  None: "none",
  Timeout: "timeout",
  ConnectionError: "connection_error",
  CommandError: "command_error",
  MemoryError: "memory_error",
  AuthError: "auth_error",
  ClusterError: "cluster_error",
  Unknown: "unknown",
} as const;

/**
 * Histogram buckets for operation duration (in milliseconds)
 * As specified in the Redis Testing Metrics Specification
 */
export const OperationDurationBuckets = [
  0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
] as const;

/**
 * Histogram buckets for reconnection duration (in milliseconds)
 * As specified in the Redis Testing Metrics Specification
 */
export const ReconnectionDurationBuckets = [
  100, 500, 1000, 2000, 5000, 10000, 30000, 60000,
] as const;

import type { IMetricsState } from "./interface";

/**
 * Pure Node.js metrics state storage without OTEL dependencies.
 * Stores metrics data in memory and provides calculation methods.
 */
export interface MetricsStateData {
  operations: {
    total: number;
    successful: number;
    errors: number;
  };
  opsPerSec: number;
  successfulOpsPerSec: number;
  errorOpsPerSec: number;
  elapsedSeconds: number;
}

/**
 * Aggregated metrics for latency tracking without storing individual operations
 */
export interface AggregatedMetrics {
  totalOps: number;
  successfulOps: number;
  errorOps: number;
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  medianLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  avgLatencyMs: number;
  connectionAttempts: number;
  successfulConnections: number;
  averageReconnectionDurationMs: number;
  reconnectionCount: number;
}

/**
 * Pure Node.js class for storing metrics state without OTEL dependencies.
 * Uses aggregated metrics only to prevent memory leaks from unbounded arrays.
 * Provides methods for recording metrics and calculating derived values.
 */
export class MetricsState implements IMetricsState {
  private static instance: MetricsState;

  // Core counters
  private totalOperations = 0;
  private successfulOperations = 0;
  private errorOperations = 0;
  private pubSubOperations = 0;
  private publishOperations = 0;
  private receiveOperations = 0;

  // Aggregated latency tracking (no individual operation storage)
  private totalLatencyMs = 0;
  private minLatencyMs = Number.MAX_SAFE_INTEGER;
  private maxLatencyMs = 0;

  // Connection metrics (aggregated)
  private connectionAttempts = 0;
  private successfulConnections = 0;

  // Reconnection metrics (aggregated)
  private totalReconnectionDurationMs = 0;
  private reconnectionCount = 0;

  // Store all latency values for accurate percentile calculations
  private readonly latencyValues: number[] = [];

  private constructor(private readonly enableLatencyTracking: boolean) {
    // Private constructor for singleton pattern
  }

  public static getInstance(
    { enableLatencyTracking }: { enableLatencyTracking: boolean } = {
      enableLatencyTracking: false,
    }
  ): MetricsState {
    if (!this.instance) {
      this.instance = new MetricsState(enableLatencyTracking);
    }
    return this.instance;
  }

  /**
   * Record a failed command execution
   * @param _commandName - Name of the Redis command (not used in aggregated metrics)
   * @param latencyMs - Command execution latency in milliseconds
   * @param errorType - Type of error that occurred (not used in aggregated metrics)
   */
  recordCommand(
    _commandName: string,
    latencyMs: number,
    errorType?: string
  ): void {
    this.totalOperations++;
    this.errorOperations += errorType ? 1 : 0;
    this.successfulOperations += errorType ? 0 : 1;

    // Update aggregated latency metrics
    this.totalLatencyMs += latencyMs;
    this.minLatencyMs = Math.min(this.minLatencyMs, latencyMs);
    this.maxLatencyMs = Math.max(this.maxLatencyMs, latencyMs);

    if (this.enableLatencyTracking) {
      this.latencyValues.push(latencyMs);
    }
  }

  /**
   * Record a connection attempt
   * @param success - Whether the connection was successful
   */
  recordConnectionAttempt(success: boolean): void {
    this.connectionAttempts++;
    if (success) {
      this.successfulConnections++;
    }
  }

  /**
   * Record a reconnection attempt
   */
  recordReconnectionAttempt(): void {
    this.reconnectionCount++;
  }

  /**
   * Record reconnection duration
   * @param durationMs - Duration of the reconnection attempt in milliseconds
   */
  recordReconnectionDuration(durationMs: number): void {
    this.reconnectionCount++;
    this.totalReconnectionDurationMs += durationMs;
  }

  recordPubSubCommand(
    type: "publish" | "receive",
    _channel: string,
    _subscriberId?: string
  ): void {
    this.pubSubOperations++;
    if (type === "publish") {
      this.publishOperations++;
    } else {
      this.receiveOperations++;
    }
  }

  /**
   * Calculate exact percentile from values
   * @param percentile - Percentile to calculate (0.5 for median, 0.95 for p95, etc.)
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    // Sort values (create copy to avoid modifying original array)
    const sorted = [...values].sort((a, b) => a - b);
    const index = percentile * (sorted.length - 1);

    // Linear interpolation between adjacent values
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower]!;
    }

    const weight = index - lower;
    return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
  }

  public getMetrics(startTime: number, currentTime: number) {
    const duration = currentTime - startTime;

    return {
      duration: Number(duration.toFixed(2)),
      totalCommandsCount: this.totalOperations,
      successfulCommandsCount: this.successfulOperations,
      failedCommandsCount: this.errorOperations,
      successRate: Number(this.successfulOperations / this.totalOperations),
      overallThroughput: Number(
        (this.totalOperations / (duration / 1000)).toFixed(2)
      ),
      avgReconnectionDurationMs: Number(
        this.reconnectionCount > 0
          ? (this.totalReconnectionDurationMs / this.reconnectionCount).toFixed(
              2
            )
          : 0
      ),
      totalLatencyMs: Number(this.totalLatencyMs.toFixed(2)),
      minLatencyMs: Number(this.minLatencyMs.toFixed(2)),
      maxLatencyMs: Number(this.maxLatencyMs.toFixed(2)),
      avgLatencyMs: Number(
        (this.totalLatencyMs / this.totalOperations).toFixed(2)
      ),
      ...(this.enableLatencyTracking && {
        medianLatencyMs: Number(
          this.calculatePercentile(this.latencyValues, 0.5).toFixed(2)
        ),
        p95LatencyMs: Number(
          this.calculatePercentile(this.latencyValues, 0.95).toFixed(2)
        ),
        p99LatencyMs: Number(
          this.calculatePercentile(this.latencyValues, 0.99).toFixed(2)
        ),
      }),
    };
  }
}

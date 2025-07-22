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
  connectionAttempts: number;
  successfulConnections: number;
  totalReconnectionDurationMs: number;
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

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): MetricsState {
    if (!this.instance) {
      this.instance = new MetricsState();
    }
    return this.instance;
  }

  /**
   * Record a successful command execution
   * @param _commandName - Name of the Redis command (not used in aggregated metrics)
   * @param latencyMs - Command execution latency in milliseconds
   */
  recordCommandSuccess(_commandName: string, latencyMs: number): void {
    this.totalOperations++;
    this.successfulOperations++;

    // Update aggregated latency metrics
    this.totalLatencyMs += latencyMs;
    this.minLatencyMs = Math.min(this.minLatencyMs, latencyMs);
    this.maxLatencyMs = Math.max(this.maxLatencyMs, latencyMs);
  }

  /**
   * Record a failed command execution
   * @param _commandName - Name of the Redis command (not used in aggregated metrics)
   * @param latencyMs - Command execution latency in milliseconds
   * @param _errorType - Type of error that occurred (not used in aggregated metrics)
   */
  recordCommandError(
    _commandName: string,
    latencyMs: number,
    _errorType?: string
  ): void {
    this.totalOperations++;
    this.errorOperations++;

    // Update aggregated latency metrics
    this.totalLatencyMs += latencyMs;
    this.minLatencyMs = Math.min(this.minLatencyMs, latencyMs);
    this.maxLatencyMs = Math.max(this.maxLatencyMs, latencyMs);
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
   * Record reconnection duration
   * @param durationMs - Duration of the reconnection attempt in milliseconds
   */
  recordReconnectionDuration(durationMs: number): void {
    this.reconnectionCount++;
    this.totalReconnectionDurationMs += durationMs;
  }

  /**
   * Get current metrics state with calculated rates
   * @param startTime - Start time for rate calculations
   * @param currentTime - Current time for rate calculations
   */
  getMetricsState(startTime: number, currentTime: number): MetricsStateData {
    const elapsedSeconds = (currentTime - startTime) / 1000;
    const opsPerSec =
      elapsedSeconds > 0 ? this.totalOperations / elapsedSeconds : 0;
    const successfulOpsPerSec =
      elapsedSeconds > 0 ? this.successfulOperations / elapsedSeconds : 0;
    const errorOpsPerSec =
      elapsedSeconds > 0 ? this.errorOperations / elapsedSeconds : 0;

    return {
      operations: {
        total: this.totalOperations,
        successful: this.successfulOperations,
        errors: this.errorOperations,
      },
      opsPerSec: Number(opsPerSec.toFixed(2)),
      successfulOpsPerSec: Number(successfulOpsPerSec.toFixed(2)),
      errorOpsPerSec: Number(errorOpsPerSec.toFixed(2)),
      elapsedSeconds,
    };
  }

  /**
   * Get aggregated metrics (new method for accessing aggregated data)
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return {
      totalOps: Number(this.totalOperations.toFixed(2)),
      successfulOps: Number(this.successfulOperations.toFixed(2)),
      errorOps: Number(this.errorOperations.toFixed(2)),
      totalLatencyMs: Number(this.totalLatencyMs.toFixed(2)),
      minLatencyMs:
        this.minLatencyMs === Number.MAX_SAFE_INTEGER
          ? 0
          : Number(this.minLatencyMs.toFixed(2)),
      maxLatencyMs: Number(this.maxLatencyMs.toFixed(2)),
      connectionAttempts: Number(this.connectionAttempts.toFixed(2)),
      successfulConnections: Number(this.successfulConnections.toFixed(2)),
      totalReconnectionDurationMs: Number(
        this.totalReconnectionDurationMs.toFixed(2)
      ),
      reconnectionCount: Number(this.reconnectionCount.toFixed(2)),
    };
  }
}

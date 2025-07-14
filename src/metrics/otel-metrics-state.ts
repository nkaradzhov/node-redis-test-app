import type { Meter } from "@opentelemetry/api";

import type { EnvConfig } from "../common";
import type {
  MetricsState,
  MetricsStateData,
  AggregatedMetrics,
} from "./metrics-state";
import {
  MetricName,
  MetricStatus,
  ErrorType,
  OperationDurationBuckets,
  ReconnectionDurationBuckets,
} from "./constants";
import type { IMetricsState } from "./interface";

/**
 * Interface that matches the complete MetricsState public API
 */
export interface IOtelMetricsState extends IMetricsState {
  recordConnectionAttempt: (success: boolean) => void;
  recordReconnectionDuration: (durationMs: number) => void;
  getMetricsState: (startTime: number, currentTime: number) => MetricsStateData;
  getAggregatedMetrics: () => AggregatedMetrics;
}

/**
 * Composition-based class that wraps MetricsState with OTEL metrics reporting.
 * This class contains a MetricsState instance and shares the same interface,
 * while also tracking metrics in OpenTelemetry instruments.
 */
export class OtelMetricsState implements IOtelMetricsState {
  private readonly baseLabels: Record<string, string>;

  // OTEL Metrics instruments
  private readonly operationsCounter;
  private readonly operationDurationHistogram;
  private readonly connectionsCounter;
  private readonly reconnectionDurationHistogram;

  constructor(
    private readonly meter: Meter,
    private readonly metricsState: MetricsState,
    envConfig: EnvConfig
  ) {
    // Initialize base labels
    this.baseLabels = {
      app_name: envConfig.APP_NAME,
      instance_id: envConfig.INSTANCE_ID,
      version: envConfig.VERSION,
      run_id: envConfig.RUN_ID,
    };

    // Initialize OTEL metrics instruments
    this.operationsCounter = this.meter.createCounter(
      MetricName.RedisOperationsTotal,
      {
        description: "Total number of Redis operations executed",
        unit: "1",
      }
    );

    this.operationDurationHistogram = this.meter.createHistogram(
      MetricName.RedisOperationDuration,
      {
        description: "Duration of Redis operations in milliseconds",
        unit: "ms",
        advice: {
          explicitBucketBoundaries: [...OperationDurationBuckets],
        },
      }
    );

    this.connectionsCounter = this.meter.createCounter(
      MetricName.RedisConnectionsTotal,
      {
        description: "Total number of Redis connection attempts",
        unit: "1",
      }
    );

    this.reconnectionDurationHistogram = this.meter.createHistogram(
      MetricName.RedisReconnectionDuration,
      {
        description: "Duration of Redis reconnection attempts in milliseconds",
        unit: "ms",
        advice: {
          explicitBucketBoundaries: [...ReconnectionDurationBuckets],
        },
      }
    );
  }

  /**
   * Record a successful Redis command execution
   * @param commandName - Name of the Redis command (e.g., 'GET', 'SET')
   * @param latencyMs - Command execution latency in milliseconds
   */
  recordCommandSuccess(commandName: string, latencyMs: number): void {
    // Record in internal MetricsState
    this.metricsState.recordCommandSuccess(commandName, latencyMs);

    // Record in OTEL metrics
    const labels = {
      ...this.baseLabels,
      operation: commandName,
      status: MetricStatus.Success,
      error_type: ErrorType.None,
    };

    this.operationsCounter.add(1, labels);
    this.operationDurationHistogram.record(latencyMs, labels);
  }

  /**
   * Record a failed Redis command execution
   * @param commandName - Name of the Redis command (e.g., 'GET', 'SET')
   * @param latencyMs - Command execution latency in milliseconds
   * @param errorType - Type of error that occurred (optional, defaults to 'unknown')
   */
  recordCommandError(
    commandName: string,
    latencyMs: number,
    errorType?: string
  ): void {
    // Record in internal MetricsState
    this.metricsState.recordCommandError(commandName, latencyMs, errorType);

    // Record in OTEL metrics
    const labels = {
      ...this.baseLabels,
      operation: commandName,
      status: MetricStatus.Error,
      error_type: errorType ?? ErrorType.Unknown,
    };

    this.operationsCounter.add(1, labels);
    this.operationDurationHistogram.record(latencyMs, labels);
  }

  /**
   * Record a connection attempt
   * @param success - Whether the connection was successful
   */
  recordConnectionAttempt(success: boolean): void {
    // Record in internal MetricsState
    this.metricsState.recordConnectionAttempt(success);

    // Record in OTEL metrics
    const labels = {
      ...this.baseLabels,
      status: success ? MetricStatus.Success : MetricStatus.Error,
    };

    this.connectionsCounter.add(1, labels);
  }

  /**
   * Record reconnection duration
   * @param durationMs - Duration of the reconnection attempt in milliseconds
   */
  recordReconnectionDuration(durationMs: number): void {
    // Record in internal MetricsState
    this.metricsState.recordReconnectionDuration(durationMs);

    // Record in OTEL metrics
    this.reconnectionDurationHistogram.record(durationMs, this.baseLabels);
  }

  /**
   * Get current metrics state with calculated rates
   * @param startTime - Start time for rate calculations
   * @param currentTime - Current time for rate calculations
   */
  getMetricsState(startTime: number, currentTime: number): MetricsStateData {
    return this.metricsState.getMetricsState(startTime, currentTime);
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return this.metricsState.getAggregatedMetrics();
  }
}

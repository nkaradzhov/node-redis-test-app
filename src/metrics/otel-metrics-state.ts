import type { Meter } from "@opentelemetry/api";

import type { EnvConfig } from "../common";
import type { MetricsState } from "./metrics-state";
import {
  MetricName,
  MetricStatus,
  ErrorType,
  OperationDurationBuckets,
  ReconnectionDurationBuckets,
} from "./constants";
import type { IMetricsState } from "./interface";

/**
 * Composition-based class that wraps MetricsState with OTEL metrics reporting.
 * This class contains a MetricsState instance and shares the same interface,
 * while also tracking metrics in OpenTelemetry instruments.
 */
export class OtelMetricsState implements IMetricsState {
  private readonly baseLabels: Record<string, string>;

  // OTEL Metrics instruments
  private readonly operationsCounter;
  private readonly operationDurationHistogram;
  private readonly connectionsCounter;
  private readonly reconnectionCounter;
  private readonly reconnectionDurationHistogram;
  private readonly pubSubCounter;

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

    this.reconnectionCounter = this.meter.createCounter(
      MetricName.RedisReconnectionTotal,
      {
        description: "Total number of Redis reconnection attempts",
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

    this.pubSubCounter = this.meter.createCounter(MetricName.RedisPubSubTotal, {
      description: "Total number of Redis Pub/Sub operations",
      unit: "1",
    });
  }

  /**
   * Record a failed Redis command execution
   * @param commandName - Name of the Redis command (e.g., 'GET', 'SET')
   * @param latencyMs - Command execution latency in milliseconds
   * @param errorType - Type of error that occurred (optional, defaults to 'unknown')
   */
  recordCommand(
    commandName: string,
    latencyMs: number,
    errorType?: string
  ): void {
    // Record in internal MetricsState
    this.metricsState.recordCommand(commandName, latencyMs, errorType);

    // Record in OTEL metrics
    const labels = {
      ...this.baseLabels,
      operation: commandName,
      status: errorType ? MetricStatus.Error : MetricStatus.Success,
      ...(errorType && { error_type: errorType ?? ErrorType.Unknown }),
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
   * Record a reconnection attempt
   */
  recordReconnectionAttempt(): void {
    // Record in internal MetricsState
    this.metricsState.recordReconnectionAttempt();

    // Record in OTEL metrics
    this.reconnectionCounter.add(1, this.baseLabels);
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

  recordPubSubCommand(
    type: "publish" | "receive",
    channel: string,
    subscriberId?: string
  ): void {
    // Record in internal MetricsState
    this.metricsState.recordPubSubCommand(type, channel, subscriberId);

    // Record in OTEL metrics
    const labels = {
      ...this.baseLabels,
      channel,
      operation_type: type,
      subscriber_id: subscriberId ?? "",
      status: MetricStatus.Success,
    };

    this.pubSubCounter.add(1, labels);
  }

  /**
   * Get current metrics state with calculated rates
   * @param startTime - Start time for rate calculations
   * @param currentTime - Current time for rate calculations
   * @returns Current metrics state data with rates
   */
  getMetrics(startTime: number, currentTime: number) {
    return this.metricsState.getMetrics(startTime, currentTime);
  }

  getLatencyPercentiles() {
    return this.metricsState.getLatencyPercentiles();
  }
}

import type { Meter } from "@opentelemetry/api";

import type { EnvConfig } from "../common";
import { MetricName, MetricStatus, MetricType } from "./constants";

export interface ProxyMetricsReporter {
  recordCommandSuccess: (commandName: string, latencyMs: number) => void;
  recordCommandError: (commandName: string, latencyMs: number) => void;
}

/**
 * Metrics reporter using OpenTelemetry metrics API
 * Similar to the lettuce test app MetricsReporter but using OTEL instead of Micrometer
 */
export class MetricsReporter implements ProxyMetricsReporter {
  private static instance: MetricsReporter;

  // Internal state for calculations
  private totalOperations = 0;
  private successfulOperations = 0;
  private errorOperations = 0;

  private readonly instanceLabels: Record<string, string>;

  // Metrics instruments
  private readonly operationsCounter;
  private readonly operationsSuccessCounter;
  private readonly operationsErrorCounter;
  private readonly commandLatencyHistogram;
  private readonly operationsPerSecondGauge;
  private readonly totalOperationsGauge;

  private constructor(
    private readonly meter: Meter,
    envConfig: EnvConfig
  ) {
    // Initialize instance-specific labels
    this.instanceLabels = {
      instance_id: envConfig.INSTANCE_ID,
      run_id: envConfig.RUN_ID,
    };

    // Initialize counters
    this.operationsCounter = this.meter.createCounter(
      MetricName.RedisOperationsTotal,
      {
        description: "Total number of Redis operations",
      }
    );

    this.operationsSuccessCounter = this.meter.createCounter(
      MetricName.RedisOperationsSuccess,
      {
        description: "Number of successful Redis operations",
      }
    );

    this.operationsErrorCounter = this.meter.createCounter(
      MetricName.RedisOperationsError,
      {
        description: "Number of failed Redis operations",
      }
    );

    // Initialize histogram
    this.commandLatencyHistogram = this.meter.createHistogram(
      MetricName.RedisOperationLatency,
      {
        description: "Redis command execution latency in milliseconds",
        unit: "ms",
      }
    );

    // Initialize observable gauges
    this.operationsPerSecondGauge = this.meter.createObservableGauge(
      MetricName.RedisOperationsRate,
      {
        description: "Current operations per second",
        unit: "ops/sec",
      }
    );

    this.totalOperationsGauge = this.meter.createObservableGauge(
      MetricName.RedisOperationsCount,
      {
        description: "Total operations count",
      }
    );
  }

  public static getInstance(meter: Meter, envConfig: EnvConfig) {
    if (!this.instance) {
      this.instance = new MetricsReporter(meter, envConfig);
    }
    return this.instance;
  }

  /**
   * Setup the metrics reporter with the start time of the workload
   */
  public init(startTime: number): void {
    this.operationsPerSecondGauge.addCallback((observableResult) => {
      const { opsPerSec, successfulOpsPerSec, errorOpsPerSec } =
        this.getMetricsState(startTime, performance.now());

      observableResult.observe(opsPerSec, this.instanceLabels);
      observableResult.observe(successfulOpsPerSec, {
        ...this.instanceLabels,
        type: MetricType.Successful,
      });
      observableResult.observe(errorOpsPerSec, {
        ...this.instanceLabels,
        type: MetricType.Error,
      });
    });

    this.totalOperationsGauge.addCallback((observableResult) => {
      observableResult.observe(this.totalOperations, {
        ...this.instanceLabels,
        type: MetricType.Total,
      });
      observableResult.observe(this.successfulOperations, {
        ...this.instanceLabels,
        type: MetricType.Successful,
      });
      observableResult.observe(this.errorOperations, {
        ...this.instanceLabels,
        type: MetricType.Error,
      });
    });
  }

  /**
   * Record a successful Redis command execution
   * @param commandName - Name of the Redis command (e.g., 'GET', 'SET')
   * @param latencyMs - Command execution latency in milliseconds
   */
  recordCommandSuccess(commandName: string, latencyMs: number): void {
    const labels = {
      ...this.instanceLabels,
      command: commandName,
      status: MetricStatus.Success,
    };
    const commandLabels = { ...this.instanceLabels, command: commandName };

    this.operationsCounter.add(1, labels);
    this.operationsSuccessCounter.add(1, commandLabels);
    this.commandLatencyHistogram.record(latencyMs, labels);

    this.totalOperations++;
    this.successfulOperations++;
  }

  /**
   * Record a failed Redis command execution
   * @param commandName - Name of the Redis command (e.g., 'GET', 'SET')
   * @param latencyMs - Command execution latency in milliseconds
   * @param error - Error that occurred
   */
  recordCommandError(commandName: string, latencyMs: number): void {
    const labels = {
      ...this.instanceLabels,
      command: commandName,
      status: MetricStatus.Error,
    };
    const commandLabels = { ...this.instanceLabels, command: commandName };

    this.operationsCounter.add(1, labels);
    this.operationsErrorCounter.add(1, commandLabels);
    this.commandLatencyHistogram.record(latencyMs, labels);

    this.totalOperations++;
    this.errorOperations++;
  }

  /**
   * Get current metrics state (for compatibility with existing code)
   */
  getMetricsState(startTime: number, currentTime: number) {
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
}

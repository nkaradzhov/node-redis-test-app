import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { MetricsReporter } from "./metrics-reporter";
import type { Meter } from "@opentelemetry/api";

describe("MetricsReporter", () => {
  const mockMeter: Meter = {
    createCounter: mock.fn(() => ({
      add: mock.fn(),
    })),
    createHistogram: mock.fn(() => ({
      record: mock.fn(),
    })),
    createObservableGauge: mock.fn(() => ({
      addCallback: mock.fn(),
      removeCallback: mock.fn(),
    })),
    createUpDownCounter: mock.fn(),
    createObservableCounter: mock.fn(),
    createObservableUpDownCounter: mock.fn(),
    createGauge: mock.fn(),
    addBatchObservableCallback: mock.fn(),
    removeBatchObservableCallback: mock.fn(),
  };

  const mockEnvConfig = {
    INSTANCE_ID: "test-instance",
    RUN_ID: "test-run",
    WORKLOAD: "test-workload",
    LOG_LEVEL: "info" as const,
    METRICS_INTERVAL_MS: 1000,
  };

  let metricsReporter: MetricsReporter;

  beforeEach(() => {
    // Reset the singleton instance for each test
    // @ts-expect-error - Accessing private static property for testing
    MetricsReporter.instance = undefined;
    metricsReporter = MetricsReporter.getInstance(mockMeter, mockEnvConfig);
  });

  it("should track successful operations", () => {
    // Record some successful operations
    metricsReporter.recordCommandSuccess("GET", 10);
    metricsReporter.recordCommandSuccess("SET", 15);

    // Get the metrics state
    const state = metricsReporter.getMetricsState(0, performance.now());

    // Verify the state
    assert.strictEqual(state.operations.total, 2);
    assert.strictEqual(state.operations.successful, 2);
    assert.strictEqual(state.operations.errors, 0);
  });

  it("should track error operations", () => {
    // Record some error operations
    metricsReporter.recordCommandError("GET", 10);
    metricsReporter.recordCommandError("SET", 15);

    // Get the metrics state
    const state = metricsReporter.getMetricsState(0, performance.now());

    // Verify the state
    assert.strictEqual(state.operations.total, 2);
    assert.strictEqual(state.operations.successful, 0);
    assert.strictEqual(state.operations.errors, 2);
  });

  it("should track mixed operations", () => {
    // Record a mix of successful and error operations
    metricsReporter.recordCommandSuccess("GET", 10);
    metricsReporter.recordCommandError("SET", 15);
    metricsReporter.recordCommandSuccess("HGET", 5);

    // Get the metrics state
    const state = metricsReporter.getMetricsState(0, performance.now());

    // Verify the state
    assert.strictEqual(state.operations.total, 3);
    assert.strictEqual(state.operations.successful, 2);
    assert.strictEqual(state.operations.errors, 1);
  });

  it("should calculate operations per second", () => {
    // Set up a known start time
    const startTime = performance.now() - 1000; // 1 second ago

    // Record some operations
    metricsReporter.recordCommandSuccess("GET", 10);
    metricsReporter.recordCommandSuccess("SET", 15);
    metricsReporter.recordCommandError("DEL", 5);

    // Test with explicit current time
    const currentTime = startTime + 2000; // 2 seconds after start
    const state = metricsReporter.getMetricsState(startTime, currentTime);

    // Verify the exact values for rates
    assert.strictEqual(state.elapsedSeconds, 2);
    assert.strictEqual(state.opsPerSec, 1.5);
    assert.strictEqual(state.successfulOpsPerSec, 1);
    assert.strictEqual(state.errorOpsPerSec, 0.5);
  });
});

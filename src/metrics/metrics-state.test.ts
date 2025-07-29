import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { MetricsState } from "./metrics-state";
import { ErrorType } from "./constants";

describe("MetricsState", () => {
  let metricsState: MetricsState;

  beforeEach(() => {
    // Reset the singleton instance for each test
    // @ts-expect-error - Accessing private static property for testing
    MetricsState.instance = undefined;
    metricsState = MetricsState.getInstance({
      enableLatencyTracking: true,
    });
  });

  it("should track successful operations", () => {
    // Record some successful operations
    metricsState.recordCommand("GET", 10);
    metricsState.recordCommand("SET", 15);

    // Get the metrics state
    const metrics = metricsState.getMetrics(0, performance.now());

    // Verify the state
    assert.strictEqual(metrics.totalCommandsCount, 2);
    assert.strictEqual(metrics.successfulCommandsCount, 2);
    assert.strictEqual(metrics.failedCommandsCount, 0);
  });

  it("should track error operations", () => {
    // Record some error operations
    metricsState.recordCommand("GET", 10, ErrorType.Timeout);
    metricsState.recordCommand("SET", 15, ErrorType.ConnectionError);

    // Get the metrics state
    const metrics = metricsState.getMetrics(0, performance.now());

    // Verify the state
    assert.strictEqual(metrics.totalCommandsCount, 2);
    assert.strictEqual(metrics.successfulCommandsCount, 0);
    assert.strictEqual(metrics.failedCommandsCount, 2);
  });

  it("should track mixed operations", () => {
    // Record a mix of successful and error operations
    metricsState.recordCommand("GET", 10);
    metricsState.recordCommand("SET", 15, ErrorType.Timeout);
    metricsState.recordCommand("HGET", 5);

    // Get the metrics state
    const metrics = metricsState.getMetrics(0, performance.now());

    // Verify the state
    assert.strictEqual(metrics.totalCommandsCount, 3);
    assert.strictEqual(metrics.successfulCommandsCount, 2);
    assert.strictEqual(metrics.failedCommandsCount, 1);
  });

  it("should calculate operations per second", () => {
    // Set up a known start time
    const startTime = performance.now() - 1000; // 1 second ago

    // Record some operations
    metricsState.recordCommand("GET", 10);
    metricsState.recordCommand("SET", 15);
    metricsState.recordCommand("DEL", 5, ErrorType.Timeout);

    // Test with explicit current time
    const currentTime = startTime + 2000; // 2 seconds after start
    const state = metricsState.getMetrics(startTime, currentTime);

    // Verify the exact values for rates
    assert.strictEqual(state.totalCommandsCount, 3);
    assert.strictEqual(state.successfulCommandsCount, 2);
    assert.strictEqual(state.failedCommandsCount, 1);
    assert.strictEqual(state.successRate, 0.67);
    assert.strictEqual(state.overallThroughput, 1.5);
  });

  it("should record reconnection duration", () => {
    // Record reconnection durations
    metricsState.recordReconnectionDuration(1500);
    metricsState.recordReconnectionDuration(3000);

    // Verify the method completes without error (actual metric verification would require more complex setup)

    const metrics = metricsState.getMetrics(0, performance.now());
    assert.strictEqual(metrics.avgReconnectionDurationMs, 2250);
  });

  it("should provide aggregated metrics without storing individual operations", () => {
    // Record various operations
    metricsState.recordCommand("GET", 5);
    metricsState.recordCommand("SET", 10);
    metricsState.recordCommand("DEL", 15, ErrorType.Timeout);
    metricsState.recordReconnectionDuration(1000);
    metricsState.recordReconnectionDuration(2000);

    const metrics = metricsState.getMetrics(0, 3000);

    assert.strictEqual(metrics.minLatencyMs, 5);
    assert.strictEqual(metrics.maxLatencyMs, 15);
    assert.strictEqual(metrics.avgLatencyMs, 10);
    assert.strictEqual(metrics.medianLatencyMs, 10);
    assert.strictEqual(metrics.p95LatencyMs, 14.5);
    assert.strictEqual(metrics.p99LatencyMs, 14.9);
    assert.strictEqual(metrics.totalLatencyMs, 30);
    assert.strictEqual(metrics.totalCommandsCount, 3);
    assert.strictEqual(metrics.successfulCommandsCount, 2);
    assert.strictEqual(metrics.failedCommandsCount, 1);
    assert.strictEqual(metrics.successRate, 0.67);
    assert.strictEqual(metrics.overallThroughput, 1); // 1 operation per second
    assert.strictEqual(metrics.avgReconnectionDurationMs, 1500);
  });
});

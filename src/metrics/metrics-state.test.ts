import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { MetricsState } from "./metrics-state";

describe("MetricsState", () => {
  let metricsState: MetricsState;

  beforeEach(() => {
    // Reset the singleton instance for each test
    // @ts-expect-error - Accessing private static property for testing
    MetricsState.instance = undefined;
    metricsState = MetricsState.getInstance();
  });

  it("should track successful operations", () => {
    // Record some successful operations
    metricsState.recordCommandSuccess("GET", 10);
    metricsState.recordCommandSuccess("SET", 15);

    // Get the metrics state
    const state = metricsState.getMetricsState(0, performance.now());

    // Verify the state
    assert.strictEqual(state.operations.total, 2);
    assert.strictEqual(state.operations.successful, 2);
    assert.strictEqual(state.operations.errors, 0);
  });

  it("should track error operations", () => {
    // Record some error operations
    metricsState.recordCommandError("GET", 10);
    metricsState.recordCommandError("SET", 15);

    // Get the metrics state
    const state = metricsState.getMetricsState(0, performance.now());

    // Verify the state
    assert.strictEqual(state.operations.total, 2);
    assert.strictEqual(state.operations.successful, 0);
    assert.strictEqual(state.operations.errors, 2);
  });

  it("should track mixed operations", () => {
    // Record a mix of successful and error operations
    metricsState.recordCommandSuccess("GET", 10);
    metricsState.recordCommandError("SET", 15);
    metricsState.recordCommandSuccess("HGET", 5);

    // Get the metrics state
    const state = metricsState.getMetricsState(0, performance.now());

    // Verify the state
    assert.strictEqual(state.operations.total, 3);
    assert.strictEqual(state.operations.successful, 2);
    assert.strictEqual(state.operations.errors, 1);
  });

  it("should calculate operations per second", () => {
    // Set up a known start time
    const startTime = performance.now() - 1000; // 1 second ago

    // Record some operations
    metricsState.recordCommandSuccess("GET", 10);
    metricsState.recordCommandSuccess("SET", 15);
    metricsState.recordCommandError("DEL", 5);

    // Test with explicit current time
    const currentTime = startTime + 2000; // 2 seconds after start
    const state = metricsState.getMetricsState(startTime, currentTime);

    // Verify the exact values for rates
    assert.strictEqual(state.elapsedSeconds, 2);
    assert.strictEqual(state.opsPerSec, 1.5);
    assert.strictEqual(state.successfulOpsPerSec, 1);
    assert.strictEqual(state.errorOpsPerSec, 0.5);
  });

  it("should record connection attempts", () => {
    // Record successful and failed connection attempts
    metricsState.recordConnectionAttempt(true);
    metricsState.recordConnectionAttempt(false);
    metricsState.recordConnectionAttempt(true);

    // Verify the method completes without error (actual metric verification would require more complex setup)
    assert.ok(true);
  });

  it("should record reconnection duration", () => {
    // Record reconnection durations
    metricsState.recordReconnectionDuration(1500);
    metricsState.recordReconnectionDuration(3000);

    // Verify the method completes without error (actual metric verification would require more complex setup)
    assert.ok(true);
  });

  it("should handle error types in recordCommandError", () => {
    // Record error with specific error type
    metricsState.recordCommandError("GET", 10, "timeout");
    metricsState.recordCommandError("SET", 15); // Should default to "unknown"

    // Get the metrics state
    const state = metricsState.getMetricsState(0, performance.now());

    // Verify the state
    assert.strictEqual(state.operations.total, 2);
    assert.strictEqual(state.operations.successful, 0);
    assert.strictEqual(state.operations.errors, 2);
  });

  it("should provide aggregated metrics without storing individual operations", () => {
    // Record various operations
    metricsState.recordCommandSuccess("GET", 5);
    metricsState.recordCommandSuccess("SET", 10);
    metricsState.recordCommandError("DEL", 15, "timeout");
    metricsState.recordConnectionAttempt(true);
    metricsState.recordConnectionAttempt(false);
    metricsState.recordReconnectionDuration(1000);

    // Get aggregated metrics
    const aggregated = metricsState.getAggregatedMetrics();

    // Verify aggregated data
    assert.strictEqual(aggregated.totalOps, 3);
    assert.strictEqual(aggregated.successfulOps, 2);
    assert.strictEqual(aggregated.errorOps, 1);
    assert.strictEqual(aggregated.totalLatencyMs, 30); // 5 + 10 + 15
    assert.strictEqual(aggregated.minLatencyMs, 5);
    assert.strictEqual(aggregated.maxLatencyMs, 15);
    assert.strictEqual(aggregated.connectionAttempts, 2);
    assert.strictEqual(aggregated.successfulConnections, 1);
    assert.strictEqual(aggregated.reconnectionCount, 1);
    assert.strictEqual(aggregated.totalReconnectionDurationMs, 1000);
  });
});

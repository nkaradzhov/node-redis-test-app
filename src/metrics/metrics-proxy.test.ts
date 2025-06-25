import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { MetricsProxy } from "./metrics-proxy";
import type { ILogger } from "../common";

describe("MetricsProxy", () => {
  const testObject = {
    successfulMethod: async () => "success",
    failingMethod: async () => {
      throw new Error("test error");
    },
  };

  const mockReporter = {
    recordCommandSuccess: mock.fn(),
    recordCommandError: mock.fn(),
  };

  const mockLogger: ILogger = {
    error: mock.fn(),
    info: mock.fn(),
  };

  beforeEach(() => {
    mockReporter.recordCommandSuccess.mock.resetCalls();
    mockReporter.recordCommandError.mock.resetCalls();
  });

  it("should create proxy that records successful method calls", async () => {
    const proxy = new MetricsProxy(mockReporter, mockLogger);

    const proxiedObject = proxy.createProxy(testObject);
    const result = await proxiedObject.successfulMethod();

    assert.strictEqual(result, "success");
    assert.strictEqual(mockReporter.recordCommandSuccess.mock.callCount(), 1);
    assert.strictEqual(mockReporter.recordCommandError.mock.callCount(), 0);

    const [name, time] =
      mockReporter.recordCommandSuccess.mock.calls[0]!.arguments;
    assert.strictEqual(name, "successfulMethod");
    assert.ok(typeof time === "number" && time >= 0);
  });

  it("should create proxy that records failed method calls", async () => {
    const proxy = new MetricsProxy(mockReporter, mockLogger);

    const proxiedObject = proxy.createProxy(testObject);

    await assert.rejects(async () => {
      await proxiedObject.failingMethod();
    });

    assert.strictEqual(mockReporter.recordCommandSuccess.mock.callCount(), 0);
    assert.strictEqual(mockReporter.recordCommandError.mock.callCount(), 1);
  });

  it("should pass through non-function properties unchanged", () => {
    const proxy = new MetricsProxy(mockReporter, mockLogger);

    const objectWithNonFunctionalProperties = {
      stringProperty: "test value",
      numberProperty: 42,
      someMethod: () => "method result",
    };

    const proxiedObject = proxy.createProxy(objectWithNonFunctionalProperties);

    assert.strictEqual(proxiedObject.stringProperty, "test value");
    assert.strictEqual(proxiedObject.numberProperty, 42);
    assert.strictEqual(mockReporter.recordCommandSuccess.mock.callCount(), 0);
    assert.strictEqual(mockReporter.recordCommandError.mock.callCount(), 0);
  });

  it("should preserve method arguments and context", async () => {
    const proxy = new MetricsProxy(mockReporter, mockLogger);

    const objectWithArgs = {
      async methodWithArgs(arg1: string, arg2: number) {
        return `${this.prefix}-${arg1}-${arg2}`;
      },
      prefix: "test",
    };

    const proxiedObject = proxy.createProxy(objectWithArgs);
    const result = await proxiedObject.methodWithArgs("hello", 123);

    assert.strictEqual(result, "test-hello-123");
    assert.strictEqual(mockReporter.recordCommandSuccess.mock.callCount(), 1);
  });

  it("should convert synchronous methods to async", async () => {
    const proxy = new MetricsProxy(mockReporter, mockLogger);

    const objectWithSyncMethod = {
      syncMethod() {
        return "sync result";
      },
    };

    const proxiedObject = proxy.createProxy(objectWithSyncMethod);

    // The method should now return a Promise
    const result = proxiedObject.syncMethod() as unknown;
    assert.ok(result instanceof Promise, "Sync method should return a Promise");

    // And we can await it
    const awaitedResult = await (result as Promise<string>);
    assert.strictEqual(awaitedResult, "sync result");
    assert.strictEqual(mockReporter.recordCommandSuccess.mock.callCount(), 1);
  });
});

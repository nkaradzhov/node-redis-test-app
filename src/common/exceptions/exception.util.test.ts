import { describe, it } from "node:test";
import assert from "node:assert";
import { parseError, ApplicationException } from "./exception.util";
import { ErrorType } from "./error-types";

describe("parseError", () => {
  it("should handle standard Error objects", () => {
    const originalError = new Error("test error message");
    const parsedError = parseError(originalError);
    
    assert.ok(parsedError instanceof ApplicationException);
    assert.strictEqual(parsedError.type, ErrorType.Unknown);
    assert.strictEqual(parsedError.message, "test error message");
  });

  it("should handle Redis connection errors", () => {
    // Mock a Redis connection error
    class ConnectionTimeoutError extends Error {
      constructor() {
        super("connection timed out");
      }
    }
    
    const originalError = new ConnectionTimeoutError();
    const parsedError = parseError(originalError);
    
    assert.strictEqual(parsedError.type, ErrorType.ConnectionError);
    assert.strictEqual(parsedError.message, "connection timed out");
  });

  it("should handle Redis timeout errors", () => {
    class TimeoutError extends Error {
      constructor() {
        super("operation timed out");
      }
    }
    
    const originalError = new TimeoutError();
    const parsedError = parseError(originalError);
    
    assert.strictEqual(parsedError.type, ErrorType.CommandTimeout);
    assert.strictEqual(parsedError.message, "operation timed out");
  });

  it("should handle Redis command errors", () => {
    class ErrorReply extends Error {
      constructor() {
        super("invalid command");
      }
    }
    
    const originalError = new ErrorReply();
    const parsedError = parseError(originalError);
    
    assert.strictEqual(parsedError.type, ErrorType.CommandError);
    assert.strictEqual(parsedError.message, "invalid command");
  });

  it("should handle non-Error objects", () => {
    const nonError = { message: "not an error" };
    const parsedError = parseError(nonError);
    
    assert.strictEqual(parsedError.type, ErrorType.Unknown);
    assert.strictEqual(parsedError.message, "[object Object]");
  });

  it("should handle primitive values", () => {
    const testCases = [
      { input: "string error", expected: "string error" },
      { input: 123, expected: "123" },
      { input: null, expected: "null" },
      { input: undefined, expected: "undefined" },
      { input: true, expected: "true" },
    ];
    
    for (const { input, expected } of testCases) {
      const parsedError = parseError(input);
      assert.strictEqual(parsedError.type, ErrorType.Unknown);
      assert.strictEqual(parsedError.message, expected);
    }
  });
});
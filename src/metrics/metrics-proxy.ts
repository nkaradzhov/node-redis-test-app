import { LoggerAction, type ILogger } from "../common";
import { parseError } from "../common/exceptions";
import type { IMetricsState } from "./interface";

/**
 * Proxy handler that wraps Redis client methods to automatically track metrics.
 * This proxy converts ALL methods to async, including originally synchronous ones,
 * to provide consistent metrics tracking. Synchronous methods will be wrapped
 * in async functions and their return values will be awaited.
 * This is similar to the lettuce test app's MetricsProxy but for a Node.js Redis client.
 */
export class MetricsProxy {
  /**
   * Creates a new MetricsProxy instance that wraps the target Redis client.
   * @param metricsReporter The reporter for sending metrics.
   */
  constructor(
    private readonly metricsState: IMetricsState,
    private readonly logger: ILogger
  ) {}

  /**
   * Creates a proxy wrapper around the provided object that intercepts method calls
   * to track metrics. ALL methods are converted to async functions, including
   * originally synchronous ones, to provide consistent metrics tracking.
   * @param object The object (typically a Redis client) to wrap with metrics tracking.
   * @returns A proxied version of the object where all methods return Promises.
   */
  public createProxy<T extends object>(targetObject: T): T {
    return new Proxy(targetObject, {
      get: (target, prop, receiver) => {
        const originalMethod = Reflect.get(target, prop, receiver);

        // Only wrap methods, not properties.
        if (typeof originalMethod !== "function") {
          return originalMethod;
        }

        const methodName = String(prop);

        // Return a new async function that wraps the original method.
        return async (...args: unknown[]) => {
          const startTime = performance.now();
          try {
            // Await the result. This works for both sync and async methods.
            const result = await originalMethod.apply(target, args);
            const latencyMs = performance.now() - startTime;
            this.metricsState.recordCommandSuccess(methodName, latencyMs);
            return result;
          } catch (error) {
            const latencyMs = performance.now() - startTime;

            const appError = parseError(error);

            this.metricsState.recordCommandError(
              methodName,
              latencyMs,
              appError.type
            );

            this.logger.error(appError, {
              msg: "Error executing Redis command",
              context: {
                action: LoggerAction.ExecuteCommand,
                command: methodName,
                type: appError.type,
              },
            });

            // Re-throw the error to maintain original behavior.
            throw error;
          }
        };
      },
    });
  }
}

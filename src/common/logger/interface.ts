import type { ApplicationException } from "../exceptions";
import type { LoggerAction } from "./constants";

export type LogContext = {
  action: (typeof LoggerAction)[keyof typeof LoggerAction];
} & Record<string, unknown>;

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, context: LogContext): void;
  error(
    error: ApplicationException,
    context: { msg?: string; context: LogContext }
  ): void;
}

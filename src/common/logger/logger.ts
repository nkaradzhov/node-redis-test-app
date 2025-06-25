import type { Logger as OtelLogger } from "@opentelemetry/api-logs";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import pino from "pino";

import type { EnvConfig } from "../config";
import type { ILogger, LogContext } from "./interface";

export class LoggerFactory {
  private readonly logger: pino.Logger;

  constructor(private readonly envConfig: EnvConfig) {
    this.logger = pino({
      base: {
        instanceId: envConfig.INSTANCE_ID,
        runId: envConfig.RUN_ID,
        timestamp: pino.stdTimeFunctions.epochTime,
      },
      level: envConfig.LOG_LEVEL,
    });
  }

  createLogger(module: string) {
    return new Logger(this.logger, module, this.envConfig);
  }
}

export class Logger implements ILogger {
  public readonly childLogger: pino.Logger;
  private readonly otelLogger: OtelLogger;

  constructor(
    logger: pino.Logger,
    private readonly component: string,
    private readonly envConfig: EnvConfig
  ) {
    this.childLogger = logger.child({ component: this.component });
    this.otelLogger = logs.getLogger(this.component, "1.0.0");
  }

  info(message: string, context: LogContext) {
    // Log to Pino (console/files)
    this.childLogger.info(context, message);

    // Send to OpenTelemetry (Loki via Grafana Alloy)
    this.otelLogger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: "INFO",
      body: message,
      attributes: {
        ...context,
        component: this.component,
        instanceId: this.envConfig.INSTANCE_ID,
        runId: this.envConfig.RUN_ID,
      },
    });
  }

  error(
    error: unknown,
    { msg, context }: { msg?: string; context: LogContext }
  ) {
    let errorMessage;
    let errorStack;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
      this.childLogger.error(error, errorMessage, context);
    } else {
      errorMessage = String(error);
      this.childLogger.error(
        new Error(errorMessage),
        msg ?? errorMessage,
        context
      );
    }

    // Send to OpenTelemetry (Loki via Grafana Alloy)
    this.otelLogger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: msg ?? errorMessage,
      attributes: {
        ...context,
        error: errorMessage,
        stack: errorStack,
        component: this.component,
        instanceId: this.envConfig.INSTANCE_ID,
        runId: this.envConfig.RUN_ID,
      },
    });
  }
}

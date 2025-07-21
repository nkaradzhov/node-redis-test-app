import type { Logger as OtelLogger } from "@opentelemetry/api-logs";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import pino from "pino";

import type { EnvConfig } from "../config";
import type { ILogger, LogContext } from "./interface";
import type { ApplicationException } from "../exceptions";

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
    // TODO REMOVE THIS
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
    error: ApplicationException,
    { msg, context }: { msg?: string; context: LogContext }
  ) {
    this.childLogger.error(error, msg ?? error.message, context);

    // Send to OpenTelemetry (Loki via Grafana Alloy)
    // TODO REMOVE THIS
    this.otelLogger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: msg ?? error.message,
      attributes: {
        ...context,
        error: error.message,
        stack: error.stack,
        component: this.component,
        instanceId: this.envConfig.INSTANCE_ID,
        runId: this.envConfig.RUN_ID,
      },
    });
  }
}

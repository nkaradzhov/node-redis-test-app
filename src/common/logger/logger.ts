import pino from "pino";

import type { EnvConfig } from "../config";
import type { ILogger, LogContext } from "./interface";
import type { ApplicationException } from "../exceptions";
import path from "node:path";
export class LoggerFactory {
  private readonly logger: pino.Logger;

  constructor(private readonly envConfig: EnvConfig) {
    const baseConfig = {
      base: {
        instanceId: envConfig.INSTANCE_ID,
        runId: envConfig.RUN_ID,
        timestamp: pino.stdTimeFunctions.epochTime,
      },
      level: envConfig.LOG_LEVEL,
    };

    const streams: pino.StreamEntry[] = [
      {
        stream: envConfig.LOG_PRETTY
          ? pino.transport({
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
              },
            })
          : process.stdout,
      },
      {
        stream: pino.destination({
          dest: path.join(
            process.cwd(),
            "out",
            this.envConfig.RUN_ID,
            this.envConfig.INSTANCE_ID,
            "app.log"
          ),
          sync: false,
          mkdir: true,
        }),
      },
    ];

    this.logger = pino(baseConfig, pino.multistream(streams));
  }

  createLogger(module: string) {
    return new Logger(this.logger, module);
  }
}

export class Logger implements ILogger {
  public readonly childLogger: pino.Logger;

  constructor(
    logger: pino.Logger,
    private readonly component: string
  ) {
    this.childLogger = logger.child({ component: this.component });
  }

  info(message: string, context: LogContext) {
    this.childLogger.info(context, message);
  }

  error(
    error: ApplicationException,
    { msg, context }: { msg?: string; context: LogContext }
  ) {
    this.childLogger.error(error, msg ?? error.message, context);
  }
}

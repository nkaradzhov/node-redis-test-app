import { metrics } from "@opentelemetry/api";

import { KeyAndPayloadGenerator } from "./util";
import {
  LoggerAction,
  LoggerFactory,
  LoggerModule,
  parseAppConfig,
  parseEnvConfig,
} from "./common";
import type { IMetricsState } from "./metrics";
import { MetricsProxy, MetricsState } from "./metrics";
import { RedisClientFactory } from "./client";
import { WorkloadRunner, WorkloadExecutorFactory } from "./workloads";
import { parseError } from "./common/exceptions";
import { OtelMetricsState } from "./metrics/otel-metrics-state";

async function main() {
  const envConfig = parseEnvConfig();

  const loggerFactory = new LoggerFactory(envConfig);

  const logger = loggerFactory.createLogger(LoggerModule.Main);

  try {
    const config = parseAppConfig(envConfig.WORKLOAD);

    let metricsState: IMetricsState;

    if (envConfig.ENABLE_OTEL) {
      const meter = metrics.getMeter(envConfig.APP_NAME, envConfig.VERSION);
      metricsState = new OtelMetricsState(
        meter,
        MetricsState.getInstance({
          enableLatencyTracking: false, // Disable latency tracking if OTEL is enabled
        }),
        envConfig
      );
    } else {
      metricsState = MetricsState.getInstance({
        enableLatencyTracking:
          config.runner.test.workload.maxDuration !== Infinity, // Enable latency tracking only for timed workloads
      });
    }

    const redisClientFactory = new RedisClientFactory(
      new MetricsProxy(
        metricsState,
        loggerFactory.createLogger(LoggerModule.MetricsProxy)
      ),
      config,
      metricsState,
      loggerFactory.createLogger(LoggerModule.RedisClient)
    );

    const workloadRunner = new WorkloadRunner(
      config,
      envConfig,
      new KeyAndPayloadGenerator(
        config.runner.test.workload.options.keyGenerationStrategy,
        config.runner.test.workload.options.keyPattern,
        config.runner.test.workload.options.keyRangeMin,
        config.runner.test.workload.options.keyRangeMax,
        config.runner.test.workload.options.valueSize
      ),
      loggerFactory.createLogger(LoggerModule.WorkloadRunner),
      redisClientFactory,
      new WorkloadExecutorFactory(),
      metricsState
    );

    // Setup signal handlers for graceful shutdown
    const handleShutdown = (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`, {
        action: LoggerAction.MainError,
      });
      workloadRunner.emit("app:shutdown");
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));

    await workloadRunner.run();
  } catch (error) {
    logger.error(parseError(error), {
      msg: "Error running workload",
      context: {
        action: LoggerAction.MainError,
      },
    });

    throw error;
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Error running workload:", err);

  // Make sure all logs have been written if an error occurs
  setTimeout(() => {
    process.exit(1);
  }, 500);
});

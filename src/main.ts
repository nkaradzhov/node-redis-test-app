import { metrics } from "@opentelemetry/api";

import { KeyAndPayloadGenerator } from "./util";
import {
  LoggerAction,
  LoggerFactory,
  LoggerModule,
  parseAppConfig,
  parseEnvConfig,
} from "./common";
import { MetricsReporter, MetricsProxy } from "./metrics";
import { RedisClientFactory } from "./client";
import { WorkloadRunner, WorkloadHandler } from "./workloads";

async function main() {
  const envConfig = parseEnvConfig();

  const loggerFactory = new LoggerFactory(envConfig);

  const logger = loggerFactory.createLogger(LoggerModule.Main);

  try {
    const config = parseAppConfig(envConfig.WORKLOAD);

    const metricsReporter = MetricsReporter.getInstance(
      metrics.getMeter("node-redis-test-app", "1.0.0"),
      envConfig
    );

    const redisClientFactory = new RedisClientFactory(
      new MetricsProxy(
        metricsReporter,
        loggerFactory.createLogger(LoggerModule.MetricsProxy)
      ),
      config,
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
      new WorkloadHandler(),
      metricsReporter
    );

    await workloadRunner.run();
  } catch (error) {
    logger.error(error, {
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
  process.exit(1);
});

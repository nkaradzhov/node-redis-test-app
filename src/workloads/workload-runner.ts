import { setTimeout } from "timers/promises";

import {
  type ILogger,
  type AppConfig,
  type EnvConfig,
  LoggerAction,
} from "../common";
import type { RedisClientFactory } from "../client";
import type { KeyAndPayloadGenerator } from "../util";
import type { MetricsReporter } from "../metrics";
import type {
  WorkloadExecutor,
  WorkloadExecutorFactory,
} from "./workload-executor-factory";

export class WorkloadRunner {
  constructor(
    private readonly config: AppConfig,
    private readonly envConfig: EnvConfig,
    private readonly generator: KeyAndPayloadGenerator,
    private readonly logger: ILogger,
    private readonly redisClientFactory: RedisClientFactory,
    private readonly workloadSetupFactory: WorkloadExecutorFactory,
    private readonly metricsReporter: MetricsReporter
  ) {}

  async run() {
    let metricsInterval: NodeJS.Timeout | undefined;
    const startTime = performance.now();

    try {
      const clients = [];

      for (let i = 0; i < this.config.runner.test.clients; i++) {
        clients.push(this.redisClientFactory.create());
      }

      const connectResults = await Promise.allSettled(
        clients.map((client) => client.connect())
      );

      const successfulConnections = connectResults.filter(
        (result) => result.status === "fulfilled"
      ).length;

      this.logger.info(
        `Successfully connected ${successfulConnections} out of ${clients.length} clients`,
        { action: LoggerAction.WorkloadConnectClients }
      );

      const setupExecutor = this.workloadSetupFactory.createExecutor(
        this.config.runner.test.workload.type
      );

      const workloadExecutors = await Promise.all(
        clients.map(async (client) => {
          return setupExecutor(
            client,
            this.config,
            this.generator,
            this.metricsReporter
          );
        })
      );

      const clientPromises = workloadExecutors.map(async (executor) => {
        return this.executeWorkload(executor, startTime);
      });

      this.metricsReporter.init(startTime);

      metricsInterval = setInterval(() => {
        const { opsPerSec, operations } = this.metricsReporter.getMetricsState(
          startTime,
          performance.now()
        );

        this.logger.info("Operations per second:", {
          action: "metrics",
          opsPerSec,
          errors: operations.errors,
          successfulOperations: operations.successful,
        });
      }, this.envConfig.METRICS_INTERVAL_MS);

      await Promise.allSettled(clientPromises);

      // Calculate the total time
      const totalTime = performance.now() - startTime;
      this.logger.info(
        "All workloads completed. Total time: ${totalTime}ms. Disconnecting clients...",
        {
          action: LoggerAction.WorkloadCompleted,
          totalTimeMs: totalTime,
        }
      );

      await Promise.allSettled(
        workloadExecutors.map((executor) => executor.teardown())
      );
    } catch (error) {
      this.logger.error(error, {
        msg: "Error running workloads",
        context: {
          action: LoggerAction.WorkloadRunning,
        },
      });
    } finally {
      if (metricsInterval) {
        clearInterval(metricsInterval);
      }

      // Calculate the total time
      const totalTime = performance.now() - startTime;
      this.logger.info("All workloads completed. Total time: ${totalTime}ms.", {
        action: LoggerAction.WorkloadCompleted,
        totalTimeMs: totalTime,
      });
    }
  }

  private hasReachedMaxDuration(startTime: number, currentTime: number) {
    return (
      startTime + this.config.runner.test.workload.maxDuration < currentTime
    );
  }

  private hasReachedMaxIterations(iterationCounter: number) {
    if (!this.config.runner.test.workload.options.iterationCount) {
      return false;
    }

    return (
      iterationCounter >=
      this.config.runner.test.workload.options.iterationCount
    );
  }

  private async executeWorkload(
    workloadExecutor: WorkloadExecutor,
    startTime: number
  ): Promise<void> {
    let iterationCounter = 0;

    while (
      !this.hasReachedMaxDuration(startTime, performance.now()) &&
      !this.hasReachedMaxIterations(iterationCounter)
    ) {
      const batchPromises: Promise<unknown>[] = [];

      for (
        let i = 0;
        i < this.config.runner.test.workload.options.batchSize;
        i++
      ) {
        batchPromises.push(...workloadExecutor.handler());
      }

      await Promise.allSettled(batchPromises);

      // Delay after each iteration if configured
      if (this.config.runner.test.workload.options.delayAfterIteration) {
        await setTimeout(
          this.config.runner.test.workload.options.delayAfterIteration
        );
      }

      iterationCounter++;
    }
  }
}

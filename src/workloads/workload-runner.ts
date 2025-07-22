import { setTimeout } from "timers/promises";
import { EventEmitter } from "node:events";

import {
  type ILogger,
  type AppConfig,
  type EnvConfig,
  LoggerAction,
  redactFields,
} from "../common";
import type { RedisClientFactory } from "../client";
import type { KeyAndPayloadGenerator } from "../util";
import type { IMetricsState } from "../metrics";
import type {
  WorkloadExecutor,
  WorkloadExecutorFactory,
} from "./workload-executor-factory";
import { parseError } from "../common/exceptions";
import { writeFileSync } from "node:fs";

export class WorkloadRunner extends EventEmitter {
  private isShuttingDown = false;

  constructor(
    private readonly config: AppConfig,
    private readonly envConfig: EnvConfig,
    private readonly generator: KeyAndPayloadGenerator,
    private readonly logger: ILogger,
    private readonly redisClientFactory: RedisClientFactory,
    private readonly workloadSetupFactory: WorkloadExecutorFactory,
    private readonly metricsState: IMetricsState
  ) {
    super();
    this.on("app:shutdown", () => {
      if (!this.isShuttingDown) {
        this.isShuttingDown = true;
        this.logger.info("Shutdown requested, stopping workload execution", {
          action: LoggerAction.WorkloadCompleted,
        });
      }
    });
  }

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
            this.metricsState
          );
        })
      );

      const clientPromises = workloadExecutors.map(async (executor) => {
        return this.executeWorkload(executor, startTime);
      });

      metricsInterval = setInterval(() => {
        const { opsPerSec, operations } = this.metricsState.getMetricsState(
          startTime,
          performance.now()
        );
        const { totalLatencyMs, minLatencyMs, maxLatencyMs } =
          this.metricsState.getAggregatedMetrics();

        this.logger.info("Current metrics:", {
          action: "metrics",
          opsPerSec,
          errors: operations.errors,
          successfulOperations: operations.successful,
          totalLatencyMs,
          minLatencyMs,
          maxLatencyMs,
        });
      }, this.envConfig.METRICS_INTERVAL_MS);

      this.logger.info("Waiting for client promises to complete...", {
        action: LoggerAction.WorkloadRunning,
        shutdownRequested: this.isShuttingDown,
      });

      const results = await Promise.allSettled(clientPromises);

      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      this.logger.info("Client promises completed", {
        action: LoggerAction.WorkloadRunning,
        fulfilled,
        rejected,
        total: results.length,
      });

      // Calculate the total time
      const totalTime = performance.now() - startTime;
      this.logger.info("Disconnecting clients...", {
        action: LoggerAction.WorkloadCompleted,
        totalTimeMs: totalTime,
      });

      await Promise.allSettled(
        workloadExecutors.map((executor) => executor.teardown())
      );
    } catch (error) {
      this.logger.error(parseError(error), {
        msg: "Error running workloads",
        context: {
          action: LoggerAction.WorkloadRunning,
        },
      });
    } finally {
      if (metricsInterval) {
        clearInterval(metricsInterval);
      }

      const metricsPath = `out/${this.envConfig.RUN_ID}/${this.envConfig.INSTANCE_ID}/metrics.json`;
      const configPath = `out/${this.envConfig.RUN_ID}/${this.envConfig.INSTANCE_ID}/config.json`;
      const envPath = `out/${this.envConfig.RUN_ID}/${this.envConfig.INSTANCE_ID}/env.json`;
      const aggregatedMetrics = this.metricsState.getAggregatedMetrics();

      writeFileSync(metricsPath, JSON.stringify(aggregatedMetrics));

      writeFileSync(configPath, JSON.stringify(redactFields(this.config)));

      writeFileSync(envPath, JSON.stringify(redactFields(this.envConfig)));

      this.logger.info("Output files written", {
        action: LoggerAction.WorkloadCompleted,
        paths: { metricsPath, configPath, envPath },
      });

      // Calculate the total time
      const totalTime = performance.now() - startTime;
      this.logger.info(
        `All workloads completed. Total time: ${totalTime.toFixed(2)}ms.`,
        {
          action: LoggerAction.WorkloadCompleted,
          totalTimeMs: totalTime,
        }
      );
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
      !this.isShuttingDown &&
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

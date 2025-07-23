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
import { WorkloadRunnerState } from "./workloads.type";

export class WorkloadRunner extends EventEmitter {
  private state: WorkloadRunnerState = WorkloadRunnerState.Connecting;

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
      if (this.state !== WorkloadRunnerState.Stopped) {
        this.state = this.updateState(WorkloadRunnerState.Stopped);

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
      // Test connection before starting workload
      const isRedisReachable = await this.isRedisReachable();

      if (!isRedisReachable) {
        throw new Error("Redis connection test failed. Aborting...");
      }

      this.state = this.updateState(WorkloadRunnerState.Running);

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

      this.logger.info("Starting workload execution...", {
        action: LoggerAction.WorkloadRunning,
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

      this.state = this.updateState(WorkloadRunnerState.Completed);
    } catch (error) {
      this.logger.error(parseError(error), {
        msg: "Error running workloads",
        context: {
          action: LoggerAction.WorkloadRunning,
        },
      });

      this.state = this.updateState(WorkloadRunnerState.Error);
    } finally {
      if (metricsInterval) {
        clearInterval(metricsInterval);
      }

      const metricsPath = `out/${this.envConfig.RUN_ID}/${this.envConfig.INSTANCE_ID}/metrics.json`;
      const configPath = `out/${this.envConfig.RUN_ID}/${this.envConfig.INSTANCE_ID}/config.json`;
      const envPath = `out/${this.envConfig.RUN_ID}/${this.envConfig.INSTANCE_ID}/env.json`;
      const aggregatedMetrics = this.metricsState.getAggregatedMetrics();

      writeFileSync(
        metricsPath,
        JSON.stringify({
          ...aggregatedMetrics,
          workloadRunnerState: this.state,
        })
      );

      writeFileSync(configPath, JSON.stringify(redactFields(this.config)));

      writeFileSync(envPath, JSON.stringify(redactFields(this.envConfig)));

      this.logger.info("Output files written", {
        action: LoggerAction.WorkloadCompleted,
        paths: { metricsPath, configPath, envPath },
      });

      const message =
        this.state === WorkloadRunnerState.Completed
          ? "Workload completed successfully"
          : "Workload completed with errors or stopped early";

      // Calculate the total time
      const totalTime = performance.now() - startTime;
      this.logger.info(`${message}. Total time: ${totalTime.toFixed(2)}ms.`, {
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
      this.state !== WorkloadRunnerState.Stopped &&
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

  private updateState(newState: WorkloadRunnerState) {
    if (this.state === WorkloadRunnerState.Stopped) {
      return WorkloadRunnerState.Stopped;
    }

    return newState;
  }

  private async isRedisReachable(): Promise<boolean> {
    this.logger.info("Testing Redis connection...", {
      action: LoggerAction.WorkloadConnectClients,
    });

    const testClient = this.redisClientFactory.create({
      withProxy: false,
    });

    let isConnected = false;

    try {
      await testClient.connect();

      const clientConnected = await testClient.isConnected();

      if (!clientConnected) {
        throw new Error("Connection check failed");
      }

      // Test connection with a simple get command
      await testClient.get("__connection_test__");

      this.logger.info("Connection test successful", {
        action: LoggerAction.WorkloadConnectClients,
        result: "success",
      });

      isConnected = true;
    } catch (error) {
      this.logger.error(parseError(error), {
        msg: "Test Client failed to connect to Redis",
        context: {
          action: LoggerAction.WorkloadConnectClients,
          result: "failure",
        },
      });

      isConnected = false;
    } finally {
      // Always disconnect the test client
      try {
        await testClient.disconnect();
      } catch (disconnectError) {
        this.logger.error(parseError(disconnectError), {
          msg: "Error disconnecting test client",
          context: {
            action: LoggerAction.WorkloadConnectClients,
          },
        });
      }
    }

    return isConnected;
  }
}

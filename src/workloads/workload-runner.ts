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
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { TestResults } from "./workloads.type";
import { WorkloadRunnerState } from "./workloads.type";
import { Duration } from "luxon";

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
    const startTimestamp = Date.now();

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
        this.logger.info("Current metrics:", {
          action: "metrics",
          ...this.metricsState.getMetrics(startTime, performance.now()),
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

      this.writeFinalTestResults({
        startTime,
        currentTime: performance.now(),
        startTimestamp,
        endTimestamp: Date.now(),
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

  private writeFinalTestResults({
    startTime,
    currentTime,
    startTimestamp,
    endTimestamp,
  }: {
    startTime: number;
    currentTime: number;
    startTimestamp: number;
    endTimestamp: number;
  }) {
    const outPath = `out/${this.envConfig.RUN_ID}/${this.envConfig.INSTANCE_ID}`;

    const resultsPath = `${outPath}/${this.config.runner.test.outputFilename}.json`;
    const configPath = `${outPath}/config.json`;
    const envPath = `${outPath}/env.json`;

    const metrics = this.metricsState.getMetrics(startTime, currentTime);

    const results: TestResults = {
      app_name: this.envConfig.APP_NAME,
      instance_id: this.envConfig.INSTANCE_ID,
      run_id: this.envConfig.RUN_ID,
      version: this.envConfig.VERSION,
      test_duration: `${Duration.fromMillis(metrics.duration).as("seconds").toFixed(2)}s`,
      workload_name: this.config.runner.test.workload.type,
      total_commands_count: metrics.totalCommandsCount,
      successful_commands_count: metrics.successfulCommandsCount,
      failed_commands_count: metrics.failedCommandsCount,
      success_rate: `${(metrics.successRate * 100).toFixed(2)}%`,
      overall_throughput: metrics.overallThroughput,
      avg_reconnection_duration_ms: metrics.avgReconnectionDurationMs,
      run_start: startTimestamp,
      run_end: endTimestamp,
      min_latency_ms: metrics.minLatencyMs,
      max_latency_ms: metrics.maxLatencyMs,
      median_latency_ms: metrics.medianLatencyMs || "unavailable",
      p95_latency_ms: metrics.p95LatencyMs || "unavailable",
      p99_latency_ms: metrics.p99LatencyMs || "unavailable",
      avg_latency_ms: metrics.avgLatencyMs,
    };

    if (!existsSync(outPath)) {
      try {
        mkdirSync(
          `out/${this.envConfig.RUN_ID}/${this.envConfig.INSTANCE_ID}`,
          {
            recursive: true,
          }
        );
      } catch (error) {
        this.logger.error(parseError(error), {
          msg: "Error creating output directory",
          context: {
            action: LoggerAction.WorkloadCompleted,
          },
        });

        return;
      }
    }

    try {
      writeFileSync(
        resultsPath,
        JSON.stringify({
          ...results,
          workloadRunnerState: this.state,
        })
      );
      writeFileSync(configPath, JSON.stringify(redactFields(this.config)));
      writeFileSync(envPath, JSON.stringify(redactFields(this.envConfig)));

      this.logger.info("Output files written", {
        action: LoggerAction.WorkloadCompleted,
        paths: { resultsPath, configPath, envPath },
      });
    } catch (error) {
      this.logger.error(parseError(error), {
        msg: "Error writing results files",
        context: {
          action: LoggerAction.WorkloadCompleted,
        },
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
      await testClient.connect({ withMetrics: false });

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

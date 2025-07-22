import type { IRedisClient } from "../client";
import type { AppConfig } from "../common";
import { WorkloadType } from "../common";
import type { IMetricsState } from "../metrics";
import type { KeyAndPayloadGenerator } from "../util";

export interface WorkloadExecutor {
  handler: () => Promise<unknown>[];
  teardown: () => Promise<unknown>;
}

export type WorkloadSetup = (
  client: IRedisClient,
  config: AppConfig,
  generator: KeyAndPayloadGenerator,
  metricsState: IMetricsState
) => Promise<WorkloadExecutor>;

export class WorkloadExecutorFactory {
  public createExecutor(workloadType: string): WorkloadSetup {
    switch (workloadType) {
      case WorkloadType.GetSet:
        return this.createGetSetSetup;
      case WorkloadType.PubSub:
        return this.createPubSubSetup;
      case WorkloadType.Multi:
        return this.createMultiSetup;
      case WorkloadType.RedisCommands:
        return this.createRedisCommandsSetup;
      default:
        throw new Error(`Handler not found for workload type: ${workloadType}`);
    }
  }

  private async createGetSetSetup(
    client: IRedisClient,
    config: AppConfig,
    generator: KeyAndPayloadGenerator
  ): Promise<WorkloadExecutor> {
    return {
      handler: () => {
        const value = generator.generatePayload();
        const key = generator.generateKey();
        if (Math.random() < config.runner.test.workload.options.getSetRatio) {
          return [client.set(key, value)];
        } else {
          return [client.get(key)];
        }
      },
      teardown: async () => {
        return client.disconnect();
      },
    };
  }

  private async createPubSubSetup(
    client: IRedisClient,
    _config: AppConfig,
    generator: KeyAndPayloadGenerator,
    metricsState: IMetricsState
  ): Promise<WorkloadExecutor> {
    const pubSubClient = await client.duplicate();
    const channel = generator.generateKey();

    await pubSubClient.subscribe(channel, () => {
      metricsState.recordCommandSuccess("received", 0);
    });

    return {
      handler: () => {
        return [client.publish(channel, generator.generatePayload())];
      },
      teardown: async () => {
        return Promise.all([pubSubClient.disconnect(), client.disconnect()]);
      },
    };
  }

  private async createMultiSetup(
    client: IRedisClient,
    config: AppConfig,
    generator: KeyAndPayloadGenerator,
    _metricsState: IMetricsState
  ): Promise<WorkloadExecutor> {
    return {
      handler: () => {
        const value = generator.generatePayload();
        const key = generator.generateKey();
        const commands: { name: string; args: unknown[] }[] = [];

        for (
          let i = 0;
          i < config.runner.test.workload.options.transactionSize;
          i++
        ) {
          if (Math.random() < config.runner.test.workload.options.getSetRatio) {
            commands.push({ name: "set", args: [key, value] });
          } else {
            commands.push({ name: "get", args: [key] });
          }
        }

        return [client.multi(commands)];
      },
      teardown: async () => {
        return client.disconnect();
      },
    };
  }

  private async createRedisCommandsSetup(
    client: IRedisClient,
    config: AppConfig,
    generator: KeyAndPayloadGenerator,
    _metricsState: IMetricsState
  ): Promise<WorkloadExecutor> {
    return {
      handler: () => {
        const value = generator.generatePayload();
        const key = generator.generateKey();
        const promises: Promise<unknown>[] = [];

        // Basic operations
        promises.push(client.set(key, value));
        promises.push(client.get(key));
        promises.push(client.del(key));
        promises.push(client.incr("counter"));

        // List operations
        const elements: string[] = [];
        for (
          let i = 0;
          i < config.runner.test.workload.options.elementsCount;
          i++
        ) {
          elements.push(value);
        }

        if (config.runner.test.workload.options.elementsCount > 0) {
          promises.push(client.lpush(`${key}list`, ...elements));
          promises.push(client.lrange(`${key}list`, 0, -1));
          promises.push(
            client.ltrim(
              `${key}list`,
              0,
              config.runner.test.workload.options.elementsCount
            )
          );
        }

        return promises;
      },
      teardown: async () => {
        return client.disconnect();
      },
    };
  }
}

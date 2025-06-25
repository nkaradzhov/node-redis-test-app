import { WorkloadType, type AppConfig } from "../common";
import type { IRedisClient } from "../client";

type IHandler = (
  client: IRedisClient,
  key: string,
  value: string,
  config: AppConfig
) => Promise<unknown>[];

export class WorkloadHandler {
  public createHandler(workloadType: string): IHandler {
    switch (workloadType) {
      case WorkloadType.GetSet:
        return this.getSetHandler;
      case WorkloadType.PubSub:
        return this.pubSubHandler;
      case WorkloadType.Multi:
        return this.multiHandler;
      case WorkloadType.RedisCommands:
        return this.commandsHandler;
      default:
        throw new Error(`Handler not found for workload type: ${workloadType}`);
    }
  }

  private getSetHandler(
    client: IRedisClient,
    key: string,
    value: string,
    config: AppConfig
  ): Promise<unknown>[] {
    if (Math.random() < config.runner.test.workload.options.getSetRatio) {
      return [client.set(key, value)];
    } else {
      return [client.get(key)];
    }
  }

  private pubSubHandler(
    client: IRedisClient,
    key: string,
    value: string,
    _config: AppConfig
  ): Promise<unknown>[] {
    return [client.publish(key, value)];
  }

  private multiHandler(
    client: IRedisClient,
    key: string,
    value: string,
    config: AppConfig
  ): Promise<unknown>[] {
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
  }

  private commandsHandler(
    client: IRedisClient,
    key: string,
    value: string,
    config: AppConfig
  ): Promise<unknown>[] {
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
  }
}

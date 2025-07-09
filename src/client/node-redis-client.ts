import type { createClient, createCluster } from "redis";

import { LoggerAction, type ILogger } from "../common";
import type { IRedisClient } from "./redis-client.interface";

/**
 * Redis client implementation using the 'redis' npm package
 */
export class NodeRedisClient implements IRedisClient {
  constructor(
    private readonly client:
      | ReturnType<typeof createClient>
      | ReturnType<typeof createCluster>,
    private readonly logger: ILogger
  ) {
    this.client.on("error", (err: Error) => {
      this.logger.error(err, {
        msg: "Redis client error",
        context: {
          action: LoggerAction.RedisClientError,
        },
      });
    });
  }

  async connect(): Promise<unknown> {
    return this.client.connect();
  }

  async disconnect(): Promise<void> {
    return this.client.close();
  }

  async duplicate(): Promise<IRedisClient> {
    const duplicateClient = this.client.duplicate();

    await duplicateClient.connect();

    return Promise.resolve(new NodeRedisClient(duplicateClient, this.logger));
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lPush(key, values);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lRange(key, start, stop);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    return this.client.lTrim(key, start, stop);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (channel: string, message: string) => void
  ): Promise<void> {
    this.client.subscribe(channel, callback);
  }

  async unsubscribe(channels?: string[]): Promise<void> {
    if (channels && channels.length > 0) {
      await Promise.all(
        channels.map((channel) => this.client.unsubscribe(channel))
      );
    } else {
      await this.client.unsubscribe();
    }
  }

  async multi(
    commands: { name: "get" | "set"; args: unknown[] }[]
  ): Promise<void> {
    const multi = this.client.multi();

    for (const command of commands) {
      (multi as any)[command.name](...command.args);
    }

    await multi.exec();
  }
}

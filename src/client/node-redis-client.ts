import type { createClient, createCluster } from "redis";

import { LoggerAction, type ILogger } from "../common";
import type { IRedisClient } from "./redis-client.interface";
import { parseError } from "../common/exceptions";

/**
 * Redis client implementation using the 'redis' npm package
 */
export class NodeRedisClient implements IRedisClient {
  #isConnected = false;

  constructor(
    private readonly client:
      | ReturnType<typeof createClient>
      | ReturnType<typeof createCluster>,
    private readonly logger: ILogger
  ) {}

  private attachHandlers() {
    this.client.on("error", (err: Error) => {
      this.#isConnected = false;
      this.logger.error(parseError(err), {
        msg: "Redis client error",
        context: {
          action: LoggerAction.RedisClientError,
        },
      });
    });

    this.client.on("connect", () => {
      this.#isConnected = true;
    });

    this.client.on("end", () => {
      this.#isConnected = false;
    });
  }

  public isConnected(): Promise<boolean> {
    return Promise.resolve(this.#isConnected);
  }

  async connect(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.client.off("error", onError);
        this.client.off("connect", onConnect);
      };

      const onError = (err: Error) => {
        this.logger.error(parseError(err), {
          msg: "Redis client error",
          context: {
            action: LoggerAction.RedisClientError,
          },
        });

        this.#isConnected = false;

        cleanup();
        reject(err);
      };

      const onConnect = () => {
        cleanup();

        this.attachHandlers();

        this.#isConnected = true;

        resolve(undefined);
      };

      this.client.once("error", onError);
      this.client.once("connect", onConnect);

      this.client.connect().catch(onError);
    });
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

import type { createClient, createCluster } from "redis";

import { LoggerAction, type ILogger } from "../common";
import type { IRedisClient } from "./redis-client.interface";
import { parseError } from "../common/exceptions";
import type { IMetricsState } from "../metrics";

/**
 * Redis client implementation using the 'redis' npm package
 */
export class NodeRedisClient implements IRedisClient {
  #isConnected = false;
  #reconnectStartTime = null as number | null;

  constructor(
    private readonly client:
      | ReturnType<typeof createClient>
      | ReturnType<typeof createCluster>,
    private readonly logger: ILogger,
    private readonly metricsState: IMetricsState
  ) {
    this.client.on("ready", () => {
      this.#isConnected = true;

      if (this.#reconnectStartTime) {
        const durationMs = performance.now() - this.#reconnectStartTime;
        this.metricsState.recordReconnectionDuration(durationMs);
        this.#reconnectStartTime = null;
      }
    });

    this.client.on("reconnecting", () => {
      this.#isConnected = false;

      if (!this.#reconnectStartTime) {
        this.metricsState.recordReconnectionAttempt();
        this.#reconnectStartTime = performance.now();
      }
    });

    this.client.on("connect", () => {
      this.#isConnected = true;
    });
  }

  private attachHandlers(
    client: ReturnType<typeof createClient> | ReturnType<typeof createCluster>
  ) {
    client.on("error", (err: Error) => {
      this.#isConnected = false;
      this.logger.error(parseError(err), {
        msg: "Redis client error",
        context: {
          action: LoggerAction.RedisClientError,
        },
      });
    });

    client.on("end", () => {
      this.#isConnected = false;
    });
  }

  public isConnected(): Promise<boolean> {
    return Promise.resolve(this.#isConnected);
  }

  async connect(
    { withMetrics }: { withMetrics?: boolean } = { withMetrics: true }
  ): Promise<unknown> {
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

        if (withMetrics) {
          this.metricsState.recordConnectionAttempt(false);
        }

        cleanup();
        reject(err);
      };

      const onConnect = () => {
        cleanup();

        this.attachHandlers(this.client);

        this.#isConnected = true;

        if (withMetrics) {
          this.metricsState.recordConnectionAttempt(true);
        }

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

    this.attachHandlers(duplicateClient);

    await duplicateClient.connect();

    return Promise.resolve(
      new NodeRedisClient(duplicateClient, this.logger, this.metricsState)
    );
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
      await Promise.allSettled(
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

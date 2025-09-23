import { readFileSync } from "fs";

import { createClient, createCluster } from "redis";
import type { RedisClientOptions } from "redis";

import { NodeRedisClient } from "./node-redis-client";
import type { AppConfig, ILogger } from "../common";
import type { IRedisClient } from "./redis-client.interface";
import type { MetricsProxy } from "../metrics/metrics-proxy";
import type { IMetricsState } from "../metrics";

/**
 * Factory class for creating Redis clients with configurable options.
 * Provides centralized client creation and initialization with support for TLS and socket configurations.
 */
export class RedisClientFactory {
  private readonly clientConfig: RedisClientOptions;

  /**
   * Initialize the factory with app configuration and logger
   * @param appConfig - The parsed app configuration
   * @param logger - Logger instance for the Redis clients
   */
  constructor(
    private readonly metricsProxy: MetricsProxy,
    private readonly appConfig: AppConfig,
    private readonly metricsState: IMetricsState,
    private readonly logger: ILogger
  ) {
    this.clientConfig = this.createNodeRedisClientConfig(appConfig);
  }

  create(
    { withProxy }: { withProxy?: boolean } = { withProxy: true }
  ): IRedisClient {
    if (!withProxy) {
      return this.#create();
    }
    return this.metricsProxy.createProxy(this.#create());
  }

  /**
   * Create a new Redis client instance using the configured options and logger.
   * @returns A Redis client instance implementing IRedisClient
   */
  #create(): IRedisClient {
    const client =
      this.appConfig.runner.test.mode === "cluster"
        ? createCluster({
            rootNodes: [
              {
                url: `redis://${this.appConfig.runner.redis.host}:${this.appConfig.runner.redis.port}`,
              },
            ],
            defaults: this.clientConfig,
            ...this.appConfig.runner.clusterClientOptions,
          })
        : createClient(this.clientConfig);

    return new NodeRedisClient(client, this.logger, this.metricsState);
  }

  /**
   * Create Redis client config from app config
   * @param appConfig - The parsed app configuration
   * @returns Combined Redis client configuration
   */
  private createNodeRedisClientConfig(
    appConfig: AppConfig
  ): RedisClientOptions {
    const { redis, clientOptions } = appConfig.runner;

    const baseSocketOptions = {
      ...(redis.port && { port: redis.port }),
      ...(redis.host && { host: redis.host }),
      connectTimeout: redis.timeout,
      reconnectStrategy: clientOptions.socket?.reconnectStrategy,
      socketTimeout: clientOptions.socket?.socketTimeout,
      keepAlive: clientOptions.socket?.keepAlive,
      keepAliveInitialDelay: clientOptions.socket?.keepAliveInitialDelay,
      noDelay: clientOptions.socket?.noDelay,
    };

    const tlsSocketOptions: Partial<RedisClientOptions["socket"]> = {
      tls: true as const,
      rejectUnauthorized: clientOptions.socket?.rejectUnauthorized,
      passphrase: clientOptions.socket?.passphrase,
      // Read the files sync as this is run before everything else
      // hence there's no need for async as this can happen in the constructor
      key: clientOptions.socket?.key
        ? readFileSync(clientOptions.socket.key, "utf8")
        : undefined,
      cert: clientOptions.socket?.cert
        ? readFileSync(clientOptions.socket.cert, "utf8")
        : undefined,
      ca: clientOptions.socket?.ca
        ? readFileSync(clientOptions.socket.ca, "utf8")
        : undefined,
    };

    // Maintenance-related options for Redis Enterprise
    const maintenanceOptions = {
      maintNotifications: clientOptions.maintNotifications,
      maintEndpointType: clientOptions.maintEndpointType,
      maintRelaxedCommandTimeout: clientOptions.maintRelaxedCommandTimeout,
      maintRelaxedSocketTimeout: clientOptions.maintRelaxedSocketTimeout,
    };

    const socketOptions: RedisClientOptions["socket"] = clientOptions.socket
      ?.tls
      ? {
          ...baseSocketOptions,
          ...tlsSocketOptions,
        }
      : baseSocketOptions;

    return {
      ...(clientOptions.RESP && { RESP: clientOptions.RESP }),

      // Redis connection settings
      ...(redis.url && { url: redis.url }),
      username: redis.username,
      password: redis.password,
      database: redis.database,

      // Client options (matching node-redis configuration)
      socket: socketOptions,
      commandsQueueMaxLength: clientOptions.commandsQueueMaxLength,
      disableOfflineQueue: clientOptions.disableOfflineQueue,
      disableClientInfo: clientOptions.disableClientInfo,
      pingInterval: clientOptions.pingInterval,
      commandOptions: clientOptions.commandOptions,
      ...maintenanceOptions,
    }; // TODO remove this once node-redis is updated
  }
}

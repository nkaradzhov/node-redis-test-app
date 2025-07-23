import * as fs from "fs";
import path from "path";

import { Duration } from "luxon";
import { z } from "zod/v4";
import * as YAML from "yaml";

export const TestMode = {
  Standalone: "standalone",
  Cluster: "cluster",
} as const;

export const WorkloadType = {
  RedisCommands: "redis_commands",
  GetSet: "get_set",
  Multi: "multi",
  PubSub: "pub_sub",
} as const;

export const KeyGenerationStrategy = {
  Random: "random",
  Sequential: "sequential",
} as const;

export type TKeyGenerationStrategy =
  (typeof KeyGenerationStrategy)[keyof typeof KeyGenerationStrategy];

// Custom duration schema that returns milliseconds
const isoDurationMillisecondsSchema = z.iso
  .duration()
  .transform((val) => Duration.fromISO(val).as("milliseconds"));

const RedisClientOptions = z.object({
  // Socket configuration options
  socket: z
    .object({
      noDelay: z.boolean().optional(), // Nagle's algorithm toggle
      keepAlive: z.boolean().optional(), // Keep-alive functionality
      keepAliveInitialDelay: isoDurationMillisecondsSchema.optional(), // Initial delay for keepalive
      tls: z.boolean().optional(), // Enable TLS with simple configuration
      // TLS configuration options
      ca: z.string().optional(), // Certificate Authority
      cert: z.string().optional(), // Client certificate
      key: z.string().optional(), // Client private key
      passphrase: z.string().optional(), // Passphrase for private key
      rejectUnauthorized: z.boolean().optional(), // TLS certificate verification (legacy)
      reconnectStrategy: z.any().optional(), // Custom reconnect strategy function or false
      socketTimeout: isoDurationMillisecondsSchema.optional(), // Socket timeout duration
    })
    .optional(),

  // Command queue and offline behavior
  commandsQueueMaxLength: z.number().int().min(1).optional(), // Max command queue length
  disableOfflineQueue: z.boolean().optional(), // Disable offline queuing

  readonly: z.boolean().optional(), // Readonly mode
  name: z.string().optional(), // Client name

  disableClientInfo: z.boolean().optional(), // Disable client info
  clientInfoTag: z.string().optional(), // Client info tag

  // Health check and monitoring
  pingInterval: isoDurationMillisecondsSchema.optional(), // Send `PING` command at interval
});

export const AppConfigSchema = z.object({
  runner: z.object({
    redis: z.object({
      host: z.string(),
      port: z.number().int().min(1).max(65535),
      username: z.string().optional(),
      password: z.string().optional(),
      database: z.number().int().min(0).optional(),
      timeout: isoDurationMillisecondsSchema.optional(), // Duration string like "1000s" -> returns ms
    }),
    test: z.object({
      mode: z.enum(TestMode),
      clients: z.number().int().min(1),
      workload: z.object({
        type: z.enum(WorkloadType),
        maxDuration: z.union([
          isoDurationMillisecondsSchema,
          z.literal("endless").transform(() => Infinity),
        ]),
        options: z.object({
          batchSize: z.number().int().min(1).default(50),
          getSetRatio: z.number().min(0).max(1).default(0.5),
          valueSize: z.number().int().min(1).default(100),
          iterationCount: z.number().int().min(1).optional().nullable(),
          delayAfterIteration: isoDurationMillisecondsSchema.optional(), // Duration string -> returns ms
          elementsCount: z.number().int().min(1).default(5),
          transactionSize: z.number().int().min(1).default(10),
          keyGenerationStrategy: z
            .enum(KeyGenerationStrategy)
            .default(KeyGenerationStrategy.Random),
          keyPattern: z.string().default("key-%d"),
          keyRangeMin: z.number().int().min(0).default(0),
          keyRangeMax: z.number().int().min(1).default(99999),
        }),
      }),
    }),
    clientOptions: RedisClientOptions,
    clusterClientOptions: z.object({
      minimizeConnections: z.boolean().optional(),
      useReplicas: z.boolean().optional(),
      maxCommandRedirections: z.number().optional(),
    }),
  }),
});

// Type inference from the schema
export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * Parse configuration from a YAML file
 * @param configPath Path to the YAML configuration file
 * @returns Parsed and validated configuration object
 * @throws {Error} When configuration file is not found
 * @throws {Error} When configuration file is empty or contains invalid YAML
 * @throws {z.ZodError} When configuration validation against schema fails
 */
export function parseAppConfig(configPath: string): AppConfig {
  // Check if file exists
  if (!fs.existsSync(path.join(process.cwd(), configPath))) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const fileContent = fs.readFileSync(configPath, "utf8");

  const rawConfig = YAML.parse(fileContent);

  if (!rawConfig) {
    throw new Error("Configuration file is empty or invalid");
  }

  // Validate against schema and return the parsed config
  const validatedConfig = AppConfigSchema.safeParse(rawConfig);

  if (validatedConfig.success) {
    return validatedConfig.data;
  }

  throw z.prettifyError(validatedConfig.error);
}

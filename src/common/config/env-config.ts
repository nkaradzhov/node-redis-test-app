import * as crypto from "crypto";

import { z } from "zod/v4";

export const LogLevel = {
  Info: "info",
  Error: "error",
} as const;

const EnvConfigSchema = z.object({
  INSTANCE_ID: z.string().optional().default(crypto.randomUUID()),
  RUN_ID: z.string().min(1),
  WORKLOAD: z.string().min(1),
  LOG_LEVEL: z.enum(LogLevel),
  METRICS_INTERVAL_MS: z.coerce.number().int().min(1000),
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

export function parseEnvConfig(): EnvConfig {
  return EnvConfigSchema.parse(process.env);
}

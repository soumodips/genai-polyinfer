import { z } from 'zod';

export const ProviderSchema = z.object({
  name: z.string(),
  model: z.string().optional(),
  api_url: z.string(),
  request_structure: z.string(),
  request_header: z.record(z.string()).optional(),
  api_key_from_env: z.array(z.string()),
  responsePath: z.string().optional(),
  order: z.number().optional(),
  api_key_fallback_strategy: z.enum(['first', 'all', 'count', 'indices', 'range', 'subset']).default('first'),
  api_key_fallback_count: z.number().default(2),
  api_key_fallback_indices: z.array(z.number()).optional(),
  api_key_fallback_range_start: z.number().optional(),
  api_key_fallback_range_end: z.number().optional(),
  api_key_fallback_subset_count: z.number().optional(),
  api_key_fallback_subset_from: z.number().optional(),
});

export const ConfigSchema = z.object({
  providers: z.array(ProviderSchema),
  mode: z.enum(['synchronous', 'concurrent']).default('synchronous'),
  consecutive_success: z.number().default(5),
  logging: z.boolean().default(true),
  metrics: z.boolean().default(true),
  cache: z
    .object({ enabled: z.boolean(), ttl: z.number() })
    .default({ enabled: true, ttl: 600000 }),
});

export type Provider = z.infer<typeof ProviderSchema>;
export type Config = z.infer<typeof ConfigSchema>;

let globalConfig: Config | null = null;

/**
 * Initializes the global configuration for the genai-polyinfer library.
 * This should be called once at application startup.
 * @param config - Partial configuration object
 */
export function initConfig(config: Partial<Config>): void {
  globalConfig = loadConfig(config);
}

/**
 * Gets the current global configuration.
 * @returns The global config if initialized, null otherwise
 */
export function getGlobalConfig(): Config | null {
  return globalConfig;
}

/**
 * Loads and validates a configuration object with defaults.
 * @param cfg - Partial configuration object
 * @returns Validated and merged configuration
 */
export function loadConfig(cfg: Partial<Config>): Config {
  return ConfigSchema.parse(cfg as any);
}

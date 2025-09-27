import { Config, Provider, loadConfig, getGlobalConfig } from './config';
import { httpRequest } from './http';
import { makeKey, getCache, setCache } from './cache';
import { log } from './logger';
import { recordSuccess, recordFailure } from './metrics';
import { buildBody, extractText } from './providers/templateAdapter';

const QUIRKY_MESSAGES = [
  'Music is too loud.. come again?',
  'Say again ... s l o w l y',
  "I'm sorry, I didn't catch that.",
  'Could you repeat that?',
  'Pardon me?',
];

export interface Result {
  raw_response: any;
  text: string;
}

export class Orchestrator {
  private config: Config;
  private consecutiveCounts: Record<string, number> = {};

  constructor(config: Partial<Config>) {
    this.config = loadConfig(config);
  }

  public async say(input: string): Promise<Result> {
    const { cache, logging } = this.config;

    if (cache.enabled) {
      const key = makeKey(input, 'global', '');
      const cached = getCache(key);
      if (cached) {
        if (logging) log('Serving from cache:', input);
        return cached;
      }
    }

    if (this.config.mode === 'concurrent') {
      return this.runConcurrent(input);
    } else {
      return this.runSequential(input);
    }
  }

  private async runSequential(input: string): Promise<Result> {
    const { providers, consecutive_success, logging, cache } = this.config;

    for (const provider of providers) {
      try {
        const result = await this.tryProvider(input, provider);
        if (cache.enabled) {
          const key = makeKey(input, 'global', '');
          setCache(key, result, cache.ttl);
        }
        this.consecutiveCounts[provider.name] = (this.consecutiveCounts[provider.name] || 0) + 1;
        if (this.consecutiveCounts[provider.name] >= consecutive_success) {
          if (logging)
            log(`Provider ${provider.name} reached consecutive success limit, switching`);
          this.consecutiveCounts[provider.name] = 0;
          // Move to next, but since it's sequential, just continue loop
        }
        return result;
      } catch (e) {
        if (logging) log(`Provider ${provider.name} failed:`, e);
        continue;
      }
    }

    // All failed
    const quirky = QUIRKY_MESSAGES[Math.floor(Math.random() * QUIRKY_MESSAGES.length)];
    return { raw_response: null, text: quirky };
  }

  private async runConcurrent(input: string): Promise<Result> {
    const { providers, cache } = this.config;
    const promises = providers.map((p: Provider) => this.tryProvider(input, p));
    try {
      const result = await Promise.any(promises);
      if (cache.enabled) {
        const key = makeKey(input, 'global', '');
        setCache(key, result, cache.ttl);
      }
      return result;
    } catch {
      // All promises rejected
      const quirky = QUIRKY_MESSAGES[Math.floor(Math.random() * QUIRKY_MESSAGES.length)];
      return { raw_response: null, text: quirky };
    }
  }

  private async tryProvider(input: string, provider: Provider): Promise<Result> {
    const { logging, metrics, api_key_fallback_strategy, api_key_fallback_count } = this.config;

    if (logging) log(`Trying provider: ${provider.name}`);

    // Collect all available API keys
    const availableApiKeys: string[] = [];
    for (const envVar of provider.api_key_from_env) {
      const val = process.env[envVar];
      if (val) {
        availableApiKeys.push(val);
      }
    }

    // If API keys are available, try with them first using existing logic
    if (availableApiKeys.length > 0) {
      // Determine how many keys to try based on strategy
      let keysToTry: string[];
      switch (api_key_fallback_strategy) {
        case 'first':
          keysToTry = availableApiKeys.slice(0, 1);
          break;
        case 'count':
          keysToTry = availableApiKeys.slice(0, api_key_fallback_count);
          break;
        case 'all':
        default:
          keysToTry = availableApiKeys;
          break;
      }

      if (logging && api_key_fallback_strategy !== 'all') {
        log(`API key fallback strategy: ${api_key_fallback_strategy}, trying ${keysToTry.length} of ${availableApiKeys.length} keys`);
      }

      // Try each API key until one succeeds
      for (let i = 0; i < keysToTry.length; i++) {
        const apiKey = keysToTry[i];
        const keyNumber = availableApiKeys.indexOf(apiKey) + 1;
        const totalKeys = api_key_fallback_strategy === 'all' ? availableApiKeys.length : keysToTry.length;

        if (logging) log(`Trying API key ${keyNumber}/${totalKeys} for ${provider.name}`);

        try {
          const result = await this.tryRequest(input, provider, apiKey);
          if (logging) log(`Success from ${provider.name} with key ${keyNumber}`);
          return result;
        } catch (error) {
          if (logging) log(`Provider ${provider.name} failed with key ${keyNumber}:`, error);
          // Try next API key
          continue;
        }
      }

      // All configured API keys failed
      const strategyInfo = api_key_fallback_strategy === 'all'
        ? `All ${availableApiKeys.length} API keys failed`
        : `${keysToTry.length} of ${availableApiKeys.length} API keys failed (strategy: ${api_key_fallback_strategy})`;

      if (logging) log(`${strategyInfo} for ${provider.name}`);
      if (metrics) recordFailure(provider.name, 0);
      throw new Error(`${strategyInfo} for ${provider.name}`);
    }

    // No API keys available - try without API key (local model support)
    if (logging) log(`No API keys available, attempting ${provider.name} without API key (local model support)`);
    try {
      const result = await this.tryRequest(input, provider, null);
      if (logging) log(`Success from ${provider.name} without API key`);
      return result;
    } catch (error) {
      if (logging) log(`No api key but required for ${provider.name}`);
      if (metrics) recordFailure(provider.name, 0);
      throw new Error(`No API key for ${provider.name}`);
    }
  }

  private async tryRequest(input: string, provider: Provider, apiKey: string | null): Promise<Result> {
    const { logging, metrics } = this.config;

    const bodyStr = buildBody(provider, input);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    // Only add authorization header if API key is provided
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }

    const start = Date.now();
    try {
      const res = await httpRequest(provider.api_url, {
        method: 'POST',
        headers,
        body: bodyStr,
      });
      const latency = Date.now() - start;

      if (!res.ok) {
        if (logging) {
          const keyInfo = apiKey ? `with API key` : `without API key`;
          log(`Provider ${provider.name} failed ${keyInfo}: ${res.status}`);
        }
        if (metrics) recordFailure(provider.name, latency);
        throw new Error(`HTTP ${res.status}`);
      }

      const extracted = extractText(res.body, provider.responsePath);
      if (!extracted) {
        if (logging) {
          const keyInfo = apiKey ? `with API key` : `without API key`;
          log(`No text extracted from ${provider.name} ${keyInfo}`);
        }
        if (metrics) recordFailure(provider.name, latency);
        throw new Error('No text extracted from response');
      }

      if (metrics) recordSuccess(provider.name, latency);

      return { raw_response: res.body, text: extracted };
    } catch (error) {
      if (metrics) recordFailure(provider.name, Date.now() - start);
      throw error;
    }
  }
}

/**
 * Orchestrates a request to configured AI providers.
 * If no config is provided, uses the global config initialized with initConfig().
 * @param input - The text prompt to send to AI providers
 * @param config - Optional configuration. If not provided, uses global config
 * @returns Promise resolving to the result from the first successful provider
 * @throws Error if no config is available
 */
export async function say(input: string, config?: Partial<Config>): Promise<Result> {
  if (!config) {
    const globalCfg = getGlobalConfig();
    if (!globalCfg) {
      throw new Error(
        'No config provided and no global config initialized. Call initConfig() first or pass config to say().'
      );
    }
    config = globalCfg;
  }
  const orchestrator = new Orchestrator(config);
  return orchestrator.say(input);
}

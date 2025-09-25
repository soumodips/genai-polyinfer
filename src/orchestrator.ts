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
    const { logging, metrics } = this.config;

    if (logging) log(`Trying provider: ${provider.name}`);

    // Build API key
    let apiKey = '';
    for (const envVar of provider.api_key_from_env) {
      const val = process.env[envVar];
      if (val) {
        apiKey = val;
        break;
      }
    }
    if (!apiKey) {
      if (logging) log(`No API key found for ${provider.name}`);
      if (metrics) recordFailure(provider.name, 0);
      throw new Error(`No API key for ${provider.name}`);
    }

    const bodyStr = buildBody(provider, input);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    };

    const start = Date.now();
    const res = await httpRequest(provider.api_url, {
      method: 'POST',
      headers,
      body: bodyStr,
    });
    const latency = Date.now() - start;

    if (!res.ok) {
      if (logging) log(`Provider ${provider.name} failed: ${res.status}`);
      if (metrics) recordFailure(provider.name, latency);
      throw new Error(`HTTP error for ${provider.name}: ${res.status}`);
    }

    const extracted = extractText(res.body, provider.responsePath);
    if (!extracted) {
      if (logging) log(`No text extracted from ${provider.name}`);
      if (metrics) recordFailure(provider.name, latency);
      throw new Error(`No text extracted for ${provider.name}`);
    }

    if (logging) log(`Success from ${provider.name}`);
    if (metrics) recordSuccess(provider.name, latency);

    return { raw_response: res.body, text: extracted };
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

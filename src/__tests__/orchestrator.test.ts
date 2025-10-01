import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Orchestrator, say } from '../orchestrator';
import { initConfig } from '../config';

// Mock dependencies
vi.mock('../http', () => ({
  httpRequest: vi.fn(),
}));

vi.mock('../cache', () => ({
  makeKey: vi.fn(),
  getCache: vi.fn(),
  setCache: vi.fn(),
}));

vi.mock('../logger', () => ({
  log: vi.fn(),
}));

vi.mock('../metrics', () => ({
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('../providers/templateAdapter', () => ({
  buildBody: vi.fn(),
  extractText: vi.fn(),
}));

import { httpRequest } from '../http';
import { makeKey, getCache, setCache } from '../cache';
import { log } from '../logger';
import { recordSuccess, recordFailure } from '../metrics';
import { buildBody, extractText } from '../providers/templateAdapter';

describe('Orchestrator', () => {
  const mockConfig = {
    all_intents: ['chat', 'code'],
    providers: [
      {
        name: 'test-provider',
        api_url: 'https://api.test.com',
        request_structure: '{"prompt": "{input}"}',
        api_key_from_env: ['TEST_KEY'],
        responsePath: 'response',
        intent: 'chat',
        api_key_fallback_strategy: 'first' as const,
        api_key_fallback_count: 2,
      },
    ],
    mode: 'synchronous' as const,
    consecutive_success: 5,
    logging: true,
    metrics: true,
    cache: { enabled: true, ttl: 1000 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TEST_KEY', 'test-api-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      const orchestrator = new Orchestrator(mockConfig);
      expect(orchestrator).toBeInstanceOf(Orchestrator);
    });
  });

  describe('say method', () => {
    it('should return cached result if available', async () => {
      const orchestrator = new Orchestrator(mockConfig);
      const cachedResult = { raw_response: {}, text: 'cached' };

      vi.mocked(makeKey).mockReturnValue('cache-key');
      vi.mocked(getCache).mockReturnValue(cachedResult);

      const result = await orchestrator.say('test input');

      expect(getCache).toHaveBeenCalledWith('cache-key');
      expect(result).toBe(cachedResult);
    });

    it('should make API call when not cached', async () => {
      const orchestrator = new Orchestrator(mockConfig);
      const apiResponse = { ok: true, status: 200, body: { response: 'API response' }, rawText: '{}' };

      vi.mocked(makeKey).mockReturnValue('cache-key');
      vi.mocked(getCache).mockReturnValue(undefined);
      vi.mocked(httpRequest).mockResolvedValue(apiResponse);
      vi.mocked(buildBody).mockReturnValue('{"prompt": "test input"}');
      vi.mocked(extractText).mockReturnValue('API response');

      const result = await orchestrator.say('test input');

      expect(httpRequest).toHaveBeenCalled();
      expect(setCache).toHaveBeenCalledWith('cache-key', result, 1000);
      expect(result.text).toBe('API response');
    });

    it('should handle API failure', async () => {
      const orchestrator = new Orchestrator(mockConfig);

      vi.mocked(makeKey).mockReturnValue('cache-key');
      vi.mocked(getCache).mockReturnValue(undefined);
      vi.mocked(httpRequest).mockResolvedValue({ ok: false, status: 500, body: {}, rawText: '' });

      const result = await orchestrator.say('test input');

      expect(result.text).toMatch(/Music is too loud|Say again|I'm sorry|Could you repeat|Pardon me/);
    });
  });

  describe('say function', () => {
    it('should use global config when no config provided', async () => {
      initConfig(mockConfig);
      vi.mocked(makeKey).mockReturnValue('cache-key');
      vi.mocked(getCache).mockReturnValue(undefined);
      vi.mocked(httpRequest).mockResolvedValue({ ok: true, status: 200, body: { response: 'ok' }, rawText: '{}' });
      vi.mocked(buildBody).mockReturnValue('body');
      vi.mocked(extractText).mockReturnValue('ok');

      const result = await say('test');

      expect(result.text).toBe('ok');
    });

    it('should return quirky message when no providers available', async () => {
      initConfig({ providers: [], mode: 'synchronous' });

      const result = await say('test');
      expect(result.text).toMatch(/Music is too loud|Say again|I'm sorry|Could you repeat|Pardon me/);
    });

    it('should filter providers by intent', async () => {
      const configWithIntents = {
        all_intents: ['chat', 'code'],
        providers: [
          {
            name: 'chat-provider',
            api_url: 'https://api.chat.com',
            request_structure: '{"prompt": "{input}"}',
            api_key_from_env: [],
            responsePath: 'response',
            intent: 'chat',
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
          {
            name: 'code-provider',
            api_url: 'https://api.code.com',
            request_structure: '{"prompt": "{input}"}',
            api_key_from_env: [],
            responsePath: 'response',
            intent: 'code',
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
        ],
        mode: 'synchronous' as const,
        consecutive_success: 5,
        logging: false,
        metrics: false,
        cache: { enabled: false, ttl: 1000 },
      };

      vi.mocked(httpRequest).mockResolvedValue({ ok: true, status: 200, body: { response: 'chat response' }, rawText: '{}' });
      vi.mocked(buildBody).mockReturnValue('body');
      vi.mocked(extractText).mockReturnValue('chat response');

      const result = await say('test', { config: configWithIntents, intent: 'chat' });

      expect(result.text).toBe('chat response');
      expect(httpRequest).toHaveBeenCalledWith('https://api.chat.com', expect.any(Object));
    });

    it('should fall back to all providers if no intent matches', async () => {
      const configWithIntents = {
        all_intents: ['chat', 'code'],
        providers: [
          {
            name: 'chat-provider',
            api_url: 'https://api.chat.com',
            request_structure: '{"prompt": "{input}"}',
            api_key_from_env: [],
            responsePath: 'response',
            intent: 'chat',
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
        ],
        mode: 'synchronous' as const,
        consecutive_success: 5,
        logging: false,
        metrics: false,
        cache: { enabled: false, ttl: 1000 },
      };

      vi.mocked(httpRequest).mockResolvedValue({ ok: true, status: 200, body: { response: 'chat response' }, rawText: '{}' });
      vi.mocked(buildBody).mockReturnValue('body');
      vi.mocked(extractText).mockReturnValue('chat response');

      const result = await say('test', { config: configWithIntents, intent: 'code' });

      expect(result.text).toBe('chat response');
    });

    it('should throw error for invalid intent', async () => {
      const configWithIntents = {
        all_intents: ['chat', 'code'],
        providers: [],
        mode: 'synchronous' as const,
        consecutive_success: 5,
        logging: false,
        metrics: false,
        cache: { enabled: false, ttl: 1000 },
      };

      await expect(say('test', { config: configWithIntents, intent: 'invalid' })).rejects.toThrow('Intent \'invalid\' not in all_intents');
    });
  });
});
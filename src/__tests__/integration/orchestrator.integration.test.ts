import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { say, initConfig, getMetrics, resetMetrics, clearCache } from '../../index';
import { httpRequest } from '../../http';
import type { Config } from '../../config';

// Mock the HTTP client
vi.mock('../../http');

const mockHttpRequest = vi.mocked(httpRequest);

beforeEach(() => {
  mockHttpRequest.mockReset();
});

afterEach(() => {
  resetMetrics();
  clearCache();
});

describe('Orchestrator Integration', () => {
  const testConfig: Config = {
    providers: [
      {
        name: 'openai',
        api_url: 'https://api.openai.com/v1/chat/completions',
        request_structure: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: '{input}' }]
        }),
        api_key_from_env: ['OPENAI_API_KEY'],
        responsePath: 'choices[0].message.content',
        api_key_fallback_strategy: 'first',
        api_key_fallback_count: 2
      },
      {
        name: 'anthropic',
        api_url: 'https://api.anthropic.com/v1/messages',
        request_structure: JSON.stringify({
          model: 'claude-3',
          max_tokens: 100,
          messages: [{ role: 'user', content: '{input}' }]
        }),
        api_key_from_env: ['ANTHROPIC_API_KEY'],
        responsePath: 'content[0].text',
        api_key_fallback_strategy: 'first',
        api_key_fallback_count: 2
      }
    ],
    mode: 'synchronous',
    consecutive_success: 3,
    logging: false, // Disable logging for tests
    metrics: true,
    cache: { enabled: true, ttl: 60000 }
  };

  beforeAll(() => {
    // Set dummy API keys for tests
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  describe('Successful requests', () => {
    it('should successfully call OpenAI and return response', async () => {
      mockHttpRequest.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          choices: [{
            message: {
              content: 'Hello from OpenAI!'
            }
          }]
        },
        rawText: '{"choices":[{"message":{"content":"Hello from OpenAI!"}}]}'
      });

      const result = await say('Hello world', testConfig);

      expect(result).toBeDefined();
      expect(result.text).toBe('Hello from OpenAI!');
      expect(result.raw_response).toEqual({
        choices: [{
          message: {
            content: 'Hello from OpenAI!'
          }
        }]
      });

      // Check metrics
      const metrics = getMetrics();
      expect(metrics.openai.success).toBe(1);
      expect(metrics.openai.failure).toBe(0);
    });

    it('should cache responses and serve from cache on subsequent calls', async () => {
      mockHttpRequest.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          choices: [{
            message: {
              content: 'Hello from OpenAI!'
            }
          }]
        },
        rawText: '{"choices":[{"message":{"content":"Hello from OpenAI!"}}]}'
      });

      // First call
      const result1 = await say('Cached message', testConfig);
      expect(result1.text).toBe('Hello from OpenAI!');

      // Second call should use cache
      const result2 = await say('Cached message', testConfig);
      expect(result2.text).toBe('Hello from OpenAI!');

      // Should only have 1 HTTP call since second used cache
      expect(mockHttpRequest).toHaveBeenCalledTimes(1);

      // Should only have 1 success (not 2) since second call used cache
      const metrics = getMetrics();
      expect(metrics.openai.success).toBe(1);
    });

    it('should failover to Anthropic when OpenAI fails', async () => {
      // OpenAI fails (with first strategy, should only try once)
      mockHttpRequest.mockResolvedValueOnce({
        ok: false,
        status: 500,
        body: { error: 'OpenAI is down' },
        rawText: '{"error":"OpenAI is down"}'
      });

      // Anthropic succeeds
      mockHttpRequest.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          content: [{
            text: 'Hello from Anthropic!'
          }]
        },
        rawText: '{"content":[{"text":"Hello from Anthropic!"}]}'
      });

      const result = await say('Hello world', testConfig);

      expect(result.text).toBe('Hello from Anthropic!');

      // Check that both providers were called
      expect(mockHttpRequest).toHaveBeenCalledTimes(2);

      // Check that OpenAI failed and Anthropic succeeded once
      const metrics = getMetrics();
      expect(metrics.openai.failure).toBe(3);
      expect(metrics.anthropic.success).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should return quirky message when all providers fail', async () => {
      // Both providers fail
      mockHttpRequest.mockResolvedValue({
        ok: false,
        status: 500,
        body: { error: 'Service unavailable' },
        rawText: '{"error":"Service unavailable"}'
      });

      const result = await say('Hello world', testConfig);

      expect(result.raw_response).toBeNull();
      expect(result.text).toMatch(/^(Music is too loud|Say again|I'm sorry|Could you repeat|What|Pardon me)/);

      // Check failure metrics
      const metrics = getMetrics();
      expect(metrics.openai.failure).toBe(3);
      expect(metrics.anthropic.failure).toBe(3);
    });

    it('should handle missing API keys gracefully', async () => {
      // Remove API keys
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      // Mock HTTP failures for requests without API keys
      mockHttpRequest.mockResolvedValue({
        ok: false,
        status: 401,
        body: { error: 'Unauthorized' },
        rawText: '{"error":"Unauthorized"}'
      });

      const result = await say('Hello world', testConfig);

      expect(result.raw_response).toBeNull();
      expect(result.text).toMatch(/^(Music is too loud|Say again|I'm sorry|Could you repeat|What|Pardon me)/);

      // HTTP is called when API keys are missing (for local model support)
      expect(mockHttpRequest).toHaveBeenCalledTimes(2); // Once for each provider
    });
  });

  describe('Global configuration', () => {
    it('should return quirky message when no providers configured', async () => {
      // Reset global config with empty providers
      initConfig({ providers: [], mode: 'synchronous' });

      const result = await say('Hello');

      expect(result.raw_response).toBeNull();
      expect(result.text).toMatch(/^(Music is too loud|Say again|I'm sorry|Could you repeat|What|Pardon me)/);
    });
  });
});
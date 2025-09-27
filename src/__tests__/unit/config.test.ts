import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigSchema, ProviderSchema } from '../../config';

describe('Config Module', () => {
  describe('ProviderSchema validation', () => {
    it('should validate a valid provider configuration', () => {
      const validProvider = {
        name: 'openai',
        api_url: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4',
        request_structure: '{"model":"{model}","messages":[{"role":"user","content":"{input}"}]}',
        api_key_from_env: ['OPENAI_API_KEY'],
        responsePath: 'choices[0].message.content',
        api_key_fallback_strategy: 'first',
        api_key_fallback_count: 2,
      };

      const result = ProviderSchema.safeParse(validProvider);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validProvider);
    });

    it('should provide defaults for optional fields', () => {
      const minimalProvider = {
        name: 'test-provider',
        api_url: 'https://api.example.com',
        request_structure: '{"prompt":"{input}"}',
        api_key_from_env: ['API_KEY'],
        api_key_fallback_strategy: 'first',
        api_key_fallback_count: 2,
      };

      const result = ProviderSchema.safeParse(minimalProvider);
      expect(result.success).toBe(true);
      expect(result.data?.model).toBeUndefined();
      expect(result.data?.responsePath).toBeUndefined();
      expect(result.data?.order).toBeUndefined();
      expect(result.data?.api_key_fallback_strategy).toBe('first');
      expect(result.data?.api_key_fallback_count).toBe(2);
    });

    it('should reject invalid provider configurations', () => {
      const invalidProvider = {
        // Missing required fields
        model: 'gpt-4',
      };

      const result = ProviderSchema.safeParse(invalidProvider);
      expect(result.success).toBe(false);
    });

    it('should validate api_key_from_env as array of strings', () => {
      const providerWithMultipleKeys = {
        name: 'multi-key-provider',
        api_url: 'https://api.example.com',
        request_structure: '{"prompt":"{input}"}',
        api_key_from_env: ['PRIMARY_KEY', 'SECONDARY_KEY', 'BACKUP_KEY'],
        api_key_fallback_strategy: 'first',
        api_key_fallback_count: 2,
      };

      const result = ProviderSchema.safeParse(providerWithMultipleKeys);
      expect(result.success).toBe(true);
      expect(result.data?.api_key_from_env).toEqual(['PRIMARY_KEY', 'SECONDARY_KEY', 'BACKUP_KEY']);
    });
  });

  describe('ConfigSchema validation', () => {
    it('should validate a complete configuration', () => {
      const validConfig = {
        providers: [
          {
            name: 'openai',
            api_url: 'https://api.openai.com/v1/chat/completions',
            request_structure: '{"model":"gpt-4","messages":[{"role":"user","content":"{input}"}]}',
            api_key_from_env: ['OPENAI_API_KEY'],
            responsePath: 'choices[0].message.content',
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
        ],
        mode: 'synchronous' as const,
        consecutive_success: 5,
        logging: true,
        metrics: true,
        cache: { enabled: true, ttl: 600000 },
      };

      const result = ConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should provide defaults for optional fields', () => {
      const minimalConfig = {
        providers: [
          {
            name: 'test-provider',
            api_url: 'https://api.example.com',
            request_structure: '{"prompt":"{input}"}',
            api_key_from_env: ['API_KEY'],
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
        ],
      };

      const result = ConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      expect(result.data?.mode).toBe('synchronous');
      expect(result.data?.consecutive_success).toBe(5);
      expect(result.data?.logging).toBe(true);
      expect(result.data?.metrics).toBe(true);
      expect(result.data?.cache).toEqual({ enabled: true, ttl: 600000 });
    });

    it('should reject invalid mode values', () => {
      const invalidConfig = {
        providers: [
          {
            name: 'test-provider',
            api_url: 'https://api.example.com',
            request_structure: '{"prompt":"{input}"}',
            api_key_from_env: ['API_KEY'],
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
        ],
        mode: 'invalid-mode',
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate cache configuration', () => {
      const configWithCache = {
        providers: [
          {
            name: 'test-provider',
            api_url: 'https://api.example.com',
            request_structure: '{"prompt":"{input}"}',
            api_key_from_env: ['API_KEY'],
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
        ],
        cache: { enabled: false, ttl: 300000 },
      };

      const result = ConfigSchema.safeParse(configWithCache);
      expect(result.success).toBe(true);
      expect(result.data?.cache).toEqual({ enabled: false, ttl: 300000 });
    });
  });

  describe('loadConfig function', () => {
    it('should load and validate a valid configuration', () => {
      const config = {
        providers: [
          {
            name: 'test-provider',
            api_url: 'https://api.example.com',
            request_structure: '{"prompt":"{input}"}',
            api_key_from_env: ['API_KEY'],
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
        ],
        mode: 'concurrent' as const,
        logging: false,
      };

      const result = loadConfig(config);
      expect(result.providers).toHaveLength(1);
      expect(result.mode).toBe('concurrent');
      expect(result.logging).toBe(false);
      expect(result.metrics).toBe(true); // default value
    });

    it('should throw on invalid configuration', () => {
      const invalidConfig = {
        providers: [], // Empty providers array
        mode: 'invalid-mode' as any,
      };

      expect(() => loadConfig(invalidConfig)).toThrow();
    });

    it('should merge with defaults', () => {
      const partialConfig = {
        providers: [
          {
            name: 'minimal-provider',
            api_url: 'https://api.example.com',
            request_structure: '{"input":"{input}"}',
            api_key_from_env: ['KEY'],
            api_key_fallback_strategy: 'first' as const,
            api_key_fallback_count: 2,
          },
        ],
      };

      const result = loadConfig(partialConfig);
      expect(result.mode).toBe('synchronous');
      expect(result.consecutive_success).toBe(5);
      expect(result.logging).toBe(true);
      expect(result.metrics).toBe(true);
      expect(result.cache).toEqual({ enabled: true, ttl: 600000 });
    });
  });
});
import { describe, it, expect } from 'vitest';
import { loadConfig, ConfigSchema } from '../config';

describe('Config', () => {
  it('should validate and load config with defaults', () => {
    const partialConfig = {
      providers: [
        {
          name: 'test',
          api_url: 'https://api.test.com',
          request_structure: '{"prompt": "{input}"}',
          api_key_from_env: ['TEST_KEY'],
        },
      ],
      mode: 'synchronous' as const,
    };

    const config = loadConfig(partialConfig);

    expect(config.providers).toHaveLength(1);
    expect(config.mode).toBe('synchronous');
    expect(config.consecutive_success).toBe(5);
    expect(config.logging).toBe(true);
    expect(config.metrics).toBe(true);
    expect(config.cache.enabled).toBe(true);
  });

  it('should throw on invalid config', () => {
    expect(() => loadConfig({})).toThrow();
  });
});
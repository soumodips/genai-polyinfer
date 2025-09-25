import { describe, it, expect, beforeEach } from 'vitest';
import { makeKey, getCache, setCache, clearCache } from '../../cache';

describe('Cache Module', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('makeKey', () => {
    it('should create consistent keys', () => {
      const key1 = makeKey('hello', 'openai', 'gpt-4');
      const key2 = makeKey('hello', 'openai', 'gpt-4');
      expect(key1).toBe(key2);
    });

    it('should handle missing model', () => {
      const key = makeKey('hello', 'openai');
      expect(key).toBe('openai::hello');
    });

    it('should include model when provided', () => {
      const key = makeKey('hello', 'openai', 'gpt-4');
      expect(key).toBe('openai::gpt-4::hello');
    });
  });

  describe('setCache and getCache', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = { text: 'cached response', raw_response: {} };

      setCache(key, value);
      const retrieved = getCache(key);

      expect(retrieved).toEqual(value);
    });

    it('should return undefined for non-existent keys', () => {
      const retrieved = getCache('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should expire cached items', () => {
      const key = 'expiring-key';
      const value = { text: 'will expire', raw_response: {} };

      // Set cache with very short TTL (1ms)
      setCache(key, value, 1);

      // Wait for expiration
      return new Promise(resolve => {
        setTimeout(() => {
          const retrieved = getCache(key);
          expect(retrieved).toBeUndefined();
          resolve(void 0);
        }, 10);
      });
    });

    it('should handle TTL correctly', () => {
      const key = 'ttl-key';
      const value = { text: 'ttl test', raw_response: {} };

      setCache(key, value, 100); // 100ms TTL

      // Should still be available immediately
      const immediate = getCache(key);
      expect(immediate).toEqual(value);

      // Should be expired after TTL
      return new Promise(resolve => {
        setTimeout(() => {
          const expired = getCache(key);
          expect(expired).toBeUndefined();
          resolve(void 0);
        }, 150);
      });
    });
  });

  describe('clearCache', () => {
    it('should clear all cached items', () => {
      const key1 = 'key1';
      const key2 = 'key2';
      const value1 = { text: 'value1', raw_response: {} };
      const value2 = { text: 'value2', raw_response: {} };

      setCache(key1, value1);
      setCache(key2, value2);

      // Verify both are cached
      expect(getCache(key1)).toEqual(value1);
      expect(getCache(key2)).toEqual(value2);

      // Clear cache
      clearCache();

      // Verify both are gone
      expect(getCache(key1)).toBeUndefined();
      expect(getCache(key2)).toBeUndefined();
    });
  });
});
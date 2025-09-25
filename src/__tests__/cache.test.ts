import { describe, it, expect, beforeEach } from 'vitest';
import { makeKey, getCache, setCache, clearCache } from '../cache';

describe('Cache', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('makeKey', () => {
    it('should create a consistent key', () => {
      const key1 = makeKey('input', 'provider', 'model');
      const key2 = makeKey('input', 'provider', 'model');
      expect(key1).toBe(key2);
    });

    it('should create different keys for different inputs', () => {
      const key1 = makeKey('input1', 'provider', 'model');
      const key2 = makeKey('input2', 'provider', 'model');
      expect(key1).not.toBe(key2);
    });
  });

  describe('getCache and setCache', () => {
    it('should store and retrieve cached data', () => {
      const key = makeKey('test input', 'test', '');
      const data = { raw_response: {}, text: 'cached response' };

      setCache(key, data, 1000);
      const cached = getCache(key);

      expect(cached).toEqual(data);
    });

    it('should return undefined for non-existent key', () => {
      const cached = getCache('non-existent');
      expect(cached).toBeUndefined();
    });

    it('should handle TTL expiration', async () => {
      const key = makeKey('test', 'test', '');
      const data = { raw_response: {}, text: 'response' };

      setCache(key, data, 10); // 10ms TTL
      expect(getCache(key)).toEqual(data);

      await new Promise(resolve => setTimeout(resolve, 15));
      expect(getCache(key)).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', () => {
      const key1 = makeKey('input1', 'test', '');
      const key2 = makeKey('input2', 'test', '');
      const data = { raw_response: {}, text: 'response' };

      setCache(key1, data, 1000);
      setCache(key2, data, 1000);

      expect(getCache(key1)).toBeDefined();
      expect(getCache(key2)).toBeDefined();

      clearCache();

      expect(getCache(key1)).toBeUndefined();
      expect(getCache(key2)).toBeUndefined();
    });
  });
});
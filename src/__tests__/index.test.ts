import { describe, it, expect } from 'vitest';
import { initConfig, getMetrics, resetMetrics, clearCache } from '../index';

describe('Index exports', () => {
  it('should export initConfig function', () => {
    const config = { providers: [], mode: 'synchronous' as const };
    expect(() => initConfig(config)).not.toThrow();
  });

  it('should export getMetrics function', () => {
    const metrics = getMetrics();
    expect(metrics).toEqual({});
  });

  it('should export resetMetrics function', () => {
    expect(() => resetMetrics()).not.toThrow();
  });

  it('should export clearCache function', () => {
    expect(() => clearCache()).not.toThrow();
  });
});
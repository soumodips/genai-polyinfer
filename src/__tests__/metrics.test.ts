import { describe, it, expect, beforeEach } from 'vitest';
import { recordSuccess, recordFailure, getMetrics, resetMetrics } from '../metrics';

describe('Metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('recordSuccess', () => {
    it('should record successful requests', () => {
      recordSuccess('provider1', 100);
      recordSuccess('provider1', 200);
      recordSuccess('provider2', 150);

      const metrics = getMetrics();
      expect(metrics.provider1.success).toBe(2);
      expect(metrics.provider1.failure).toBe(0);
      expect(metrics.provider1.latency).toBe(300);
      expect(metrics.provider1.count).toBe(2);
      expect(metrics.provider2.success).toBe(1);
    });
  });

  describe('recordFailure', () => {
    it('should record failed requests', () => {
      recordFailure('provider1', 100);
      recordFailure('provider1', 200);

      const metrics = getMetrics();
      expect(metrics.provider1.success).toBe(0);
      expect(metrics.provider1.failure).toBe(2);
      expect(metrics.provider1.latency).toBe(300);
      expect(metrics.provider1.count).toBe(2);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics for all providers', () => {
      recordSuccess('provider1', 100);
      recordFailure('provider2', 200);

      const metrics = getMetrics();
      expect(Object.keys(metrics)).toHaveLength(2);
      expect(metrics.provider1.success).toBe(1);
      expect(metrics.provider2.failure).toBe(1);
    });

    it('should return empty object when no metrics', () => {
      const metrics = getMetrics();
      expect(metrics).toEqual({});
    });
  });

  describe('resetMetrics', () => {
    it('should clear all metrics', () => {
      recordSuccess('provider1', 100);
      recordFailure('provider2', 200);

      expect(Object.keys(getMetrics())).toHaveLength(2);

      resetMetrics();

      expect(getMetrics()).toEqual({});
    });
  });
});
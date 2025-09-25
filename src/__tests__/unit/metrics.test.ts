import { describe, it, expect } from 'vitest';
import { recordSuccess, recordFailure, getMetrics, resetMetrics } from '../../metrics';

describe('Metrics Module', () => {
  describe('recordSuccess', () => {
    it('should record successful requests', () => {
      const provider = 'openai';
      const latency = 150;

      recordSuccess(provider, latency);

      const metrics = getMetrics();
      expect(metrics[provider]).toBeDefined();
      expect(metrics[provider].success).toBe(1);
      expect(metrics[provider].failure).toBe(0);
      expect(metrics[provider].latency).toBe(latency);
      expect(metrics[provider].count).toBe(1);
    });

    it('should accumulate multiple successes', () => {
      const provider = 'anthropic';

      recordSuccess(provider, 100);
      recordSuccess(provider, 200);
      recordSuccess(provider, 50);

      const metrics = getMetrics();
      expect(metrics[provider].success).toBe(3);
      expect(metrics[provider].failure).toBe(0);
      expect(metrics[provider].latency).toBe(350);
      expect(metrics[provider].count).toBe(3);
    });
  });

  describe('recordFailure', () => {
    it('should record failed requests', () => {
      const provider = 'openai';
      const latency = 75;

      recordFailure(provider, latency);

      const metrics = getMetrics();
      expect(metrics[provider]).toBeDefined();
      expect(metrics[provider].success).toBe(0);
      expect(metrics[provider].failure).toBe(1);
      expect(metrics[provider].latency).toBe(latency); // Failures do add latency
      expect(metrics[provider].count).toBe(1);
    });

    it('should accumulate multiple failures', () => {
      const provider = 'gemini';

      recordFailure(provider, 100);
      recordFailure(provider, 200);

      const metrics = getMetrics();
      expect(metrics[provider].failure).toBe(2);
      expect(metrics[provider].success).toBe(0);
      expect(metrics[provider].latency).toBe(300);
      expect(metrics[provider].count).toBe(2);
    });
  });

  describe('mixed success and failure', () => {
    it('should handle mixed metrics correctly', () => {
      const provider = 'mixed-provider';

      recordSuccess(provider, 100);
      recordFailure(provider, 50);
      recordSuccess(provider, 200);
      recordFailure(provider, 75);

      const metrics = getMetrics();
      expect(metrics[provider].success).toBe(2);
      expect(metrics[provider].failure).toBe(2);
      expect(metrics[provider].latency).toBe(425);
      expect(metrics[provider].count).toBe(4);
    });
  });

  describe('getMetrics', () => {
    it('should return a copy of metrics', () => {
      const provider = 'test-provider';
      recordSuccess(provider, 50);

      const metrics1 = getMetrics();
      const metrics2 = getMetrics();

      // Should be equal but not the same reference
      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2);

      // Modifying one shouldn't affect the other
      if (metrics1[provider]) {
        metrics1[provider].success = 999;
      }

      expect(metrics2[provider]?.success).toBe(1);
    });

    it('should return empty object when no metrics recorded', () => {
      resetMetrics();
      const metrics = getMetrics();
      expect(metrics).toEqual({});
    });
  });

  describe('resetMetrics', () => {
    it('should clear all metrics', () => {
      recordSuccess('provider1', 100);
      recordFailure('provider2', 50);
      recordSuccess('provider3', 200);

      // Verify metrics exist
      const beforeReset = getMetrics();
      expect(Object.keys(beforeReset)).toHaveLength(3);

      // Reset metrics
      resetMetrics();

      // Verify metrics are cleared
      const afterReset = getMetrics();
      expect(afterReset).toEqual({});
    });
  });

  describe('multiple providers', () => {
    it('should track metrics separately per provider', () => {
      const provider1 = 'openai';
      const provider2 = 'anthropic';
      const provider3 = 'ollama';

      recordSuccess(provider1, 100);
      recordSuccess(provider2, 200);
      recordFailure(provider2, 50);
      recordSuccess(provider3, 50);

      const metrics = getMetrics();

      expect(metrics[provider1].success).toBe(1);
      expect(metrics[provider1].failure).toBe(0);

      expect(metrics[provider2].success).toBe(1);
      expect(metrics[provider2].failure).toBe(1);

      expect(metrics[provider3].success).toBe(1);
      expect(metrics[provider3].failure).toBe(0);
    });
  });
});
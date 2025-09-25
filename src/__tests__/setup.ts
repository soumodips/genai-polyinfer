import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { clearCache } from '../cache';
import { resetMetrics } from '../metrics';

// Global test setup
beforeAll(() => {
  // Set up test environment
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Clean up after all tests
});

afterEach(() => {
  // Clean up after each test
  clearCache();
  resetMetrics();
});

// Mock fetch for HTTP tests
global.fetch = vi.fn() as any;

// Note: Console methods are not mocked globally to allow logger tests to work
// Individual tests can mock console methods as needed
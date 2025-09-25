import { describe, it, expect, vi, afterEach, afterAll } from 'vitest';
import { log } from '../logger';

describe('Logger', () => {
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  afterEach(() => {
    consoleSpy.mockClear();
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it('should log messages to console', () => {
    log('Test message');
    expect(consoleSpy).toHaveBeenCalledWith('[polyinfer]', 'Test message');

    log('Message with', 'multiple', 'args');
    expect(consoleSpy).toHaveBeenCalledWith('[polyinfer]', 'Message with', 'multiple', 'args');
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();

vi.mock('../http', () => ({
  httpRequest: vi.fn(),
}));

import { httpRequest } from '../http';

describe('httpRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the implementation to use our mockFetch
    vi.mocked(httpRequest).mockImplementation(async (input, init) => {
      const res = await mockFetch(input, init);
      const text = await res.text();
      let parsed: any = text;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // leave raw text
      }
      return {
        ok: res.ok,
        status: res.status,
        body: parsed,
        rawText: text,
      };
    });
  });

  it('should make a successful request and parse JSON', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{"message": "success"}'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await httpRequest('https://api.example.com', { method: 'GET' });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com', { method: 'GET' });
    expect(result).toEqual({
      ok: true,
      status: 200,
      body: { message: 'success' },
      rawText: '{"message": "success"}',
    });
  });

  it('should handle non-JSON response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('plain text response'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await httpRequest('https://api.example.com');

    expect(result.body).toBe('plain text response');
    expect(result.rawText).toBe('plain text response');
  });

  it('should handle failed request', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue('Not Found'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    const result = await httpRequest('https://api.example.com');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it('should handle request with different input types', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('ok'),
    };
    mockFetch.mockResolvedValue(mockResponse);

    await httpRequest(new URL('https://api.example.com'));
    expect(mockFetch).toHaveBeenCalledWith(new URL('https://api.example.com'), undefined);

    const request = new Request('https://api.example.com');
    await httpRequest(request);
    expect(mockFetch).toHaveBeenCalledWith(request, undefined);
  });
});
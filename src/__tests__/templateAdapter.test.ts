import { describe, it, expect } from 'vitest';
import { buildBody, extractText } from '../providers/templateAdapter';

describe('TemplateAdapter', () => {
  describe('buildBody', () => {
    it('should replace placeholders in request structure', () => {
      const provider = {
        name: 'test',
        api_url: 'https://api.test.com',
        request_structure: '{"model": "{model}", "prompt": "{input}"}',
        api_key_from_env: [],
        model: 'gpt-4',
      };

      const result = buildBody(provider, 'Hello world');
      expect(result).toBe('{"model": "gpt-4", "prompt": "Hello world"}');
    });

    it('should handle multiple placeholders', () => {
      const provider = {
        name: 'test',
        api_url: 'https://api.test.com',
        request_structure: '{"model": "{model}", "messages": [{"role": "user", "content": "{input}"}]}',
        api_key_from_env: [],
        model: 'gpt-3.5',
      };

      const result = buildBody(provider, 'Test message');
      expect(result).toBe('{"model": "gpt-3.5", "messages": [{"role": "user", "content": "Test message"}]}');
    });

    it('should handle missing model', () => {
      const provider = {
        name: 'test',
        api_url: 'https://api.test.com',
        request_structure: '{"prompt": "{input}"}',
        api_key_from_env: [],
      };

      const result = buildBody(provider, 'Test');
      expect(result).toBe('{"prompt": "Test"}');
    });
  });

  describe('extractText', () => {
    it('should extract text from response using path', () => {
      const response = {
        choices: [{ message: { content: 'Extracted text' } }],
      };

      const result = extractText(response, 'choices[0].message.content');
      expect(result).toBe('Extracted text');
    });

    it('should extract text from simple path', () => {
      const response = { response: 'Simple text' };

      const result = extractText(response, 'response');
      expect(result).toBe('Simple text');
    });

    it('should return undefined for invalid path', () => {
      const response = { data: 'text' };

      const result = extractText(response, 'invalid.path');
      expect(result).toBeUndefined();
    });

    it('should return undefined for missing path', () => {
      const response = { data: 'text' };

      const result = extractText(response, undefined);
      expect(result).toBeUndefined();
    });

    it('should handle nested arrays and objects', () => {
      const response = {
        results: [
          { output: 'First' },
          { output: 'Second' },
        ],
      };

      const result = extractText(response, 'results[1].output');
      expect(result).toBe('Second');
    });
  });
});
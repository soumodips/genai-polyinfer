import { describe, it, expect } from 'vitest';
import { buildBody, extractText } from '../../providers/templateAdapter';
import type { Provider } from '../../config';

type ProviderCfg = Provider; // Alias for backward compatibility in tests

describe('TemplateAdapter Module', () => {
  describe('buildBody', () => {
    it('should replace {input} placeholder', () => {
      const provider: Partial<ProviderCfg> = {
        request_structure: '{"prompt": "{input}"}',
      };

      const result = buildBody(provider as ProviderCfg, 'Hello world');
      expect(result).toBe('{"prompt": "Hello world"}');
    });

    it('should replace {model} placeholder', () => {
      const provider: Partial<ProviderCfg> = {
        request_structure: '{"model": "{model}", "prompt": "{input}"}',
        model: 'gpt-4',
      };

      const result = buildBody(provider as ProviderCfg, 'Test input');
      expect(result).toBe('{"model": "gpt-4", "prompt": "Test input"}');
    });

    it('should handle missing model gracefully', () => {
      const provider: Partial<ProviderCfg> = {
        request_structure: '{"model": "{model}", "prompt": "{input}"}',
        // No model specified
      };

      const result = buildBody(provider as ProviderCfg, 'Test input');
      expect(result).toBe('{"model": "", "prompt": "Test input"}');
    });

    it('should escape JSON special characters in input', () => {
      const provider: Partial<ProviderCfg> = {
        request_structure: '{"text": "{input}"}',
      };

      const input = 'Hello "world" with \\ backslash and \n newline';
      const result = buildBody(provider as ProviderCfg, input);
      expect(result).toBe('{"text": "Hello \\"world\\" with \\\\ backslash and \\n newline"}');
    });

    it('should handle complex templates', () => {
      const provider: Partial<ProviderCfg> = {
        request_structure: JSON.stringify({
          model: '{model}',
          messages: [{ role: 'user', content: '{input}' }],
          temperature: 0.7,
          max_tokens: 100,
        }),
        model: 'claude-3',
      };

      const result = buildBody(provider as ProviderCfg, 'Explain recursion');
      const parsed = JSON.parse(result);

      expect(parsed.model).toBe('claude-3');
      expect(parsed.messages[0].content).toBe('Explain recursion');
      expect(parsed.temperature).toBe(0.7);
      expect(parsed.max_tokens).toBe(100);
    });

    it('should handle empty request_structure', () => {
      const provider: Partial<ProviderCfg> = {
        request_structure: '',
      };

      const result = buildBody(provider as ProviderCfg, 'test');
      expect(result).toBe('');
    });

    it('should use default template when request_structure is undefined', () => {
      const provider: Partial<ProviderCfg> = {
        // request_structure not provided
      };

      const result = buildBody(provider as ProviderCfg, 'test input');
      expect(result).toBe('{"prompt": "test input"}');
    });
  });

  describe('extractText', () => {
    it('should extract text from OpenAI-style response', () => {
      const response = {
        choices: [{
          message: { content: 'Hello from GPT!' }
        }]
      };

      const result = extractText(response, 'choices[0].message.content');
      expect(result).toBe('Hello from GPT!');
    });

    it('should extract text from Anthropic-style response', () => {
      const response = {
        content: [{
          text: 'Hello from Claude!'
        }]
      };

      const result = extractText(response, 'content[0].text');
      expect(result).toBe('Hello from Claude!');
    });

    it('should extract text from Ollama-style response', () => {
      const response = {
        response: 'Hello from Llama!'
      };

      const result = extractText(response, 'response');
      expect(result).toBe('Hello from Llama!');
    });

    it('should fall back to common patterns when no path provided', () => {
      const openaiResponse = {
        choices: [{ message: { content: 'OpenAI response' } }]
      };
      expect(extractText(openaiResponse)).toBe('OpenAI response');

      const anthropicResponse = {
        content: [{ text: 'Anthropic response' }]
      };
      expect(extractText(anthropicResponse)).toBe('Anthropic response');

      const simpleResponse = {
        text: 'Simple response'
      };
      expect(extractText(simpleResponse)).toBe('Simple response');

      const rawTextResponse = 'Raw text response';
      expect(extractText(rawTextResponse)).toBe('Raw text response');
    });

    it('should handle nested array access', () => {
      const response = {
        results: [
          { content: 'First result' },
          { content: 'Second result' }
        ]
      };

      const result = extractText(response, 'results[1].content');
      expect(result).toBe('Second result');
    });

    it('should handle complex nested paths', () => {
      const response = {
        data: {
          messages: [
            {
              content: {
                text: 'Nested text'
              }
            }
          ]
        }
      };

      const result = extractText(response, 'data.messages[0].content.text');
      expect(result).toBe('Nested text');
    });

    it('should return undefined for invalid paths', () => {
      const response = { valid: 'data' };

      const result = extractText(response, 'invalid.path');
      expect(result).toBeUndefined();
    });

    it('should return undefined for null/undefined response', () => {
      expect(extractText(null)).toBeUndefined();
      expect(extractText(undefined)).toBeUndefined();
    });

    it('should handle responses with content property', () => {
      const response = {
        choices: [{
          content: 'Direct content'
        }]
      };

      const result = extractText(response, 'choices[0].content');
      expect(result).toBe('Direct content');
    });

    it('should prioritize content over other properties', () => {
      const response = {
        choices: [{
          message: {
            content: 'Message content'
          },
          content: 'Direct content'
        }]
      };

      const result = extractText(response, 'choices[0].content');
      expect(result).toBe('Direct content');
    });
  });
});
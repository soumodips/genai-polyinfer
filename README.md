# genai-polyinfer

genai-polyinfer is a TypeScript library for orchestrating multiple GenAI providers via HTTP requests (no provider SDKs). It tries providers sequentially or concurrently, caches responses, tracks metrics, and logs operations. **Configurable API key fallback** - when multiple API keys are configured, you can control whether to try all keys, just the first key, or a specified number of keys. **Local model support** - when no API keys are configured, it automatically attempts requests without authentication for local model servers.

## Install

```bash
npm i genai-polyinfer
```

## Quickstart

Create `polyinfer.config.ts` in your project root (see example below). Then in your app:

### Option 1: Initialize once and use globally

```ts
import { initConfig, say } from 'genai-polyinfer';
import cfg from './polyinfer.config';

initConfig(cfg); // Call once at app start

(async () => {
  const result = await say("Explain recursion like I'm 5");
  console.log(result.text);
})();
```

### Option 2: Pass config each time

```ts
import { say } from 'genai-polyinfer';
import cfg from './polyinfer.config';

(async () => {
  const result = await say("Explain recursion like I'm 5", cfg);
  console.log(result.text);
})();
```

## Configuration Example

Create `polyinfer.config.ts` in your project root:

```ts
import 'dotenv/config';

export default {
  providers: [
    {
      name: 'openai',
      api_url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      request_structure: JSON.stringify({
        model: '{model}',
        messages: [{ role: 'user', content: '{input}' }],
      }),
      api_key_from_env: ['OPENAI_API_KEY'], // Can specify multiple keys for fallback
      // Example with multiple keys: ['OPENAI_API_KEY', 'OPENAI_API_KEY_BACKUP']
      responsePath: 'choices[0].message.content',
    },
    {
      name: 'ollama',
      api_url: 'http://localhost:11434/api/generate',
      model: 'llama2',
      request_structure: JSON.stringify({ model: '{model}', prompt: '{input}' }),
      api_key_from_env: [], // No key for local
      responsePath: 'response',
    },
  ],
  mode: 'synchronous',
  consecutive_success: 5,
  logging: true,
  metrics: true,
  cache: { enabled: true, ttl: 600000 },
} as const;
```

## API Reference

### `initConfig(config: Partial<Config>): void`

Initializes the global config. Call this once at app startup.

### `say(input: string, config?: Partial<Config>): Promise<Result>`

Orchestrates requests to configured providers.

**Parameters:**

- `input`: The text prompt
- `config`: Optional partial config (merged with defaults). If not provided, uses global config from `initConfig()`.

**Returns:**

- Success: `{ raw_response: any, text: string }`
- Failure: `{ raw_response: null, text: quirky_message }`

### `getMetrics(): Record<string, Stats>`

Returns current metrics for each provider.

### `resetMetrics(): void`

Resets all metrics.

### `clearCache(): void`

Clears the in-memory cache.

## Configuration

The config supports:

- **providers**: Array of provider objects with name, api_url, request_structure, api_key_from_env, responsePath
- **mode**: "synchronous" or "concurrent"
- **consecutive_success**: Number of successes before switching providers
- **logging**: Enable console logging
- **metrics**: Track success/failure rates
- **cache**: In-memory caching with TTL
- **Note**: API key fallback strategies are now configured per-provider (see Provider Configuration below)

### Provider Configuration

Each provider supports:

- **name**: Unique identifier for the provider
- **api_url**: The HTTP endpoint for API requests
- **model**: Model name to use (substituted in request_structure)
- **request_structure**: JSON template for the request body
- **api_key_from_env**: Array of environment variable names containing API keys. Supports multiple keys with per-provider fallback strategies
- **api_key_fallback_strategy**: How to handle multiple API keys for this provider - "first" (default, try first available key), "all" (try all until one succeeds), "count" (try specified number of keys), "indices" (try specific key indices), "range" (try keys in a range), or "subset" (try random subset)
- **api_key_fallback_count**: When strategy is "count", specifies how many keys to try (default: 2)
- **api_key_fallback_indices**: When strategy is "indices", array of key indices to try (e.g., [0, 2, 4] for 1st, 3rd, 5th keys)
- **api_key_fallback_range_start**: When strategy is "range", starting index for the range (inclusive)
- **api_key_fallback_range_end**: When strategy is "range", ending index for the range (inclusive)
- **api_key_fallback_subset_count**: When strategy is "subset", number of random keys to try
- **api_key_fallback_subset_from**: When strategy is "subset", try random keys from the first N available keys
- **responsePath**: Path to extract text from the response (e.g., 'choices[0].message.content')

## Local Model Support

When a provider has no API keys configured (`api_key_from_env: []`), the library automatically enables local model support:

1. **First attempt**: Tries the request without any API key (for local model servers)
2. **Fallback**: Only if the no-API-key attempt fails, logs "No api key but required" and throws an error

This enables seamless integration with local model servers like Ollama, LM Studio, or other local inference servers that don't require authentication.

### Example Local Model Configuration

```ts
{
  name: 'ollama',
  api_url: 'http://localhost:11434/api/generate',
  model: 'llama2',
  request_structure: JSON.stringify({ model: '{model}', prompt: '{input}' }),
  api_key_from_env: [], // Empty array enables local model support
  responsePath: 'response',
},
```

## Per-Provider API Key Fallback Strategies

Each provider can now have its own API key fallback strategy, giving you fine-grained control over how each provider handles multiple API keys.

### Available Strategies

1. **'first' (default)** - Only try the first available API key
   ```ts
   api_key_fallback_strategy: 'first'
   ```

2. **'all'** - Try all available API keys until one succeeds
   ```ts
   api_key_fallback_strategy: 'all'
   ```

3. **'count'** - Try the first N keys (specify N with `api_key_fallback_count`)
   ```ts
   api_key_fallback_strategy: 'count',
   api_key_fallback_count: 2
   ```

4. **'indices'** - Try specific key indices (e.g., 1st, 3rd, 5th keys)
   ```ts
   api_key_fallback_strategy: 'indices',
   api_key_fallback_indices: [0, 2, 4] // 1st, 3rd, 5th keys
   ```

5. **'range'** - Try keys in a specific range (e.g., keys 3-5)
   ```ts
   api_key_fallback_strategy: 'range',
   api_key_fallback_range_start: 2, // Start from 3rd key (index 2)
   api_key_fallback_range_end: 4    // End at 5th key (index 4)
   ```

6. **'subset'** - Try a random subset from the first N keys
   ```ts
   api_key_fallback_strategy: 'subset',
   api_key_fallback_subset_count: 3,  // Try 3 random keys
   api_key_fallback_subset_from: 5    // From the first 5 available keys
   ```

### Example Configuration

```ts
{
  name: 'openai',
  api_url: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
  request_structure: JSON.stringify({
    model: '{model}',
    messages: [{ role: 'user', content: '{input}' }],
  }),
  api_key_from_env: ['OPENAI_API_KEY', 'OPENAI_API_KEY_BACKUP'],
  api_key_fallback_strategy: 'first', // Only try first key
  responsePath: 'choices[0].message.content',
},
{
  name: 'gemini',
  api_url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp:generateContent',
  model: 'gemini-2.5-flash',
  request_structure: JSON.stringify({
    contents: [{ parts: [{ text: '{input}' }] }],
  }),
  api_key_from_env: ['GOOGLE_API_KEY_1', 'GOOGLE_API_KEY_2', 'GOOGLE_API_KEY_3', 'GOOGLE_API_KEY_4', 'GOOGLE_API_KEY_5'],
  api_key_fallback_strategy: 'indices',
  api_key_fallback_indices: [0, 2, 4], // Try 1st, 3rd, 5th keys
  responsePath: 'candidates[0].content.parts[0].text',
}
```

This flexibility allows you to:
- Use different strategies for different providers based on their reliability
- Skip problematic keys by using specific indices
- Distribute load across multiple keys using random subsets
- Fine-tune fallback behavior for each provider's requirements

## Notes

- No provider SDKs are used — only HTTP requests.
- Config is a TS file so env vars are available.
- Graceful error handling with quirky failure messages.
- For React apps, call `initConfig(cfg)` in your app's root component or useEffect to initialize globally.
- For automatic config loading from root folder in Node.js, you can use `fs` to read the config file and pass to `initConfig`.
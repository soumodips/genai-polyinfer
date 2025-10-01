# genai-polyinfer

genai-polyinfer is a TypeScript library for orchestrating multiple GenAI providers via HTTP requests (no provider SDKs). It tries providers sequentially or concurrently, caches responses, tracks metrics, and logs operations. **Intent-based provider selection** - filter and prioritize providers based on use case intents. **Configurable API key fallback** - when multiple API keys are configured, you can control whether to try all keys, just the first key, or a specified number of keys. **Local model support** - when no API keys are configured, it automatically attempts requests without authentication for local model servers.

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
  const result = await say("Explain recursion like I'm 5", { config: cfg });
  console.log(result.text);
})();
```

## Configuration Example

Create `polyinfer.config.ts` in your project root:

```ts
import 'dotenv/config';

export default {
  all_intents: ['chat', 'code', 'summary', 'creative', 'analysis'],
  providers: [
    {
      name: 'openai',
      api_url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      request_structure: JSON.stringify({
        model: '{model}',
        messages: [{ role: 'user', content: '{input}' }],
      }),
      request_header: {
        'authorization': 'Bearer {api_key}',
      },
      api_key_from_env: ['OPENAI_API_KEY'], // Can specify multiple keys for fallback
      // Example with multiple keys: ['OPENAI_API_KEY', 'OPENAI_API_KEY_BACKUP']
      intent: ['chat', 'code', 'summary'],
      responsePath: 'choices[0].message.content',
    },
    {
      name: 'anthropic',
      api_url: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-haiku-20240307',
      request_structure: JSON.stringify({
        model: '{model}',
        max_tokens: 1024,
        messages: [{ role: 'user', content: '{input}' }],
      }),
      request_header: {
        'x-api-key': '{api_key}',
      },
      api_key_from_env: ['ANTHROPIC_API_KEY'],
      intent: ['chat', 'analysis'],
      responsePath: 'content[0].text',
    },
    {
      name: 'ollama',
      api_url: 'http://localhost:11434/api/generate',
      model: 'llama2',
      request_structure: JSON.stringify({ model: '{model}', prompt: '{input}' }),
      api_key_from_env: [], // No key for local
      intent: 'chat',
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

### `say(input: string, options?: { config?: Partial<Config>; intent?: string | string[] }): Promise<Result>`

Orchestrates requests to configured providers.

**Parameters:**

- `input`: The text prompt
- `options.config`: Optional partial config (merged with defaults). If not provided, uses global config from `initConfig()`.
- `options.intent`: Optional intent(s) to filter providers. If provided, only providers matching the intent(s) are used, prioritized by match count.

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

- **all_intents**: Array of allowed intent strings for validation
- **providers**: Array of provider objects with name, api_url, request_structure, api_key_from_env, responsePath, intent
- **mode**: "synchronous" or "concurrent"
- **consecutive_success**: Number of successes before switching providers
- **logging**: Enable console logging
- **metrics**: Track success/failure rates
- **cache**: In-memory caching with TTL
- **Note**: API key fallback strategies are now configured per-provider (see Provider Configuration below)
- **Provider Order**: The order of tries follows the order of entries in the providers array in polyinfer.config.ts

### Provider Configuration

Each provider supports:

- **name**: Unique identifier for the provider
- **api_url**: The HTTP endpoint for API requests
- **model**: Model name to use (substituted in request_structure)
- **request_structure**: JSON template for the request body
- **request_header**: Optional object containing custom HTTP headers for the provider (e.g., `{'x-api-key': '{api_key}'}` or `{'authorization': 'Bearer {api_key}'}`)
- **api_key_from_env**: Array of environment variable names containing API keys. Supports multiple keys with per-provider fallback strategies
- **intent**: Optional string or array of strings specifying use case intents this provider supports (must be subset of config's all_intents)
- **api_key_fallback_strategy**: How to handle multiple API keys for this provider - "first" (default, try first available key), "all" (try all until one succeeds), "count" (try specified number of keys), "indices" (try specific key indices), "range" (try keys in a range), or "subset" (try random subset)
- **api_key_fallback_count**: When strategy is "count", specifies how many keys to try (default: 2)
- **api_key_fallback_indices**: When strategy is "indices", array of key indices to try (e.g., [0, 2, 4] for 1st, 3rd, 5th keys)
- **api_key_fallback_range_start**: When strategy is "range", starting index for the range (inclusive)
- **api_key_fallback_range_end**: When strategy is "range", ending index for the range (inclusive)
- **api_key_fallback_subset_count**: When strategy is "subset", number of random keys to try
- **api_key_fallback_subset_from**: When strategy is "subset", try random keys from the first N available keys
- **responsePath**: Path to extract text from the response (e.g., 'choices[0].message.content')

## Provider Ordering

The library processes providers in the exact order they appear in the `providers` array in `polyinfer.config.ts`. This ordering affects:

- **Sequential Mode**: Providers are tried in array order until one succeeds
- **Concurrent Mode**: All providers execute simultaneously, and fastest successful response is returned
- **Consecutive Success Switching**: Provider switching follows the array sequence
- **Best Practice**: Place your most reliable or preferred providers first in the array

### Example Provider Ordering

```typescript
export default {
  providers: [
    { name: 'fast-provider', ... },    // Tried first (most preferred)
    { name: 'reliable-provider', ... }, // Tried second
    { name: 'backup-provider', ... },   // Tried third (fallback)
  ],
  // ...
};
```

## Intent-Based Provider Selection

You can filter and prioritize providers based on use case intents. Define allowed intents in `all_intents` and assign intents to each provider. When calling `say()`, specify the intent to only use matching providers.

### How It Works

1. **Intent Matching**: Providers are filtered to those whose `intent` field contains the requested intent(s)
2. **Prioritization**: Providers are sorted by the number of matching intents (descending), then by original order
3. **Fallback**: If no providers match the intent, all providers are used as fallback

### Example Usage

```ts
// Use only providers that support 'code' intent
const result = await say("Write a function", { intent: 'code' });

// Use providers that support 'chat' or 'summary'
const result = await say("Summarize this text", { intent: ['chat', 'summary'] });

// Combine with config
const result = await say("Hello", { config: myConfig, intent: 'chat' });
```

### Intent Configuration

```ts
export default {
  all_intents: ['chat', 'code', 'summary', 'creative', 'analysis'],
  providers: [
    {
      name: 'openai',
      intent: ['chat', 'code', 'summary'], // Supports multiple intents
      // ... other config
    },
    {
      name: 'anthropic',
      intent: 'analysis', // Single intent
      // ... other config
    },
    {
      name: 'ollama',
      intent: ['chat'], // Array with one intent
      // ... other config
    },
  ],
  // ... other config
};
```

### Benefits

- **Specialization**: Use the best provider for specific use cases
- **Cost Optimization**: Route simple tasks to cheaper providers
- **Performance**: Prioritize faster providers for certain intents
- **Fallback Safety**: Automatically falls back to all providers if needed

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
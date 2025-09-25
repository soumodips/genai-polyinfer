// Simple test script for genai-polyinfer
const { say } = require('./dist/index.cjs.js');

async function test() {
  const config = {
    providers: [
      {
        name: 'mock',
        api_url: 'https://httpbin.org/post',
        request_structure: '{"message": "{input}"}',
        api_key_from_env: [],
        responsePath: 'json.message',
      },
    ],
    mode: 'synchronous',
    consecutive_success: 5,
    logging: true,
    metrics: true,
    cache: { enabled: false, ttl: 600000 },
  };

  try {
    const result = await say('Hello world', config);
    console.log('Result:', result);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
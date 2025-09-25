const cache = new Map<string, { expires: number; value: any }>();

export function makeKey(input: string, provider: string, model?: string) {
  return model ? `${provider}::${model}::${input}` : `${provider}::${input}`;
}

export function getCache(key: string) {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    cache.delete(key);
    return undefined;
  }
  return e.value;
}

export function setCache(key: string, value: any, ttl = 600000) {
  cache.set(key, { value, expires: Date.now() + ttl });
}

export function clearCache() {
  cache.clear();
}

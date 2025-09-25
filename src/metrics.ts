type Stats = { success: number; failure: number; latency: number; count: number };
const METRICS: Record<string, Stats> = {};

export function recordSuccess(provider: string, latency: number) {
  const s = (METRICS[provider] ??= { success: 0, failure: 0, latency: 0, count: 0 });
  s.success++;
  s.latency += latency;
  s.count++;
}

export function recordFailure(provider: string, latency: number) {
  const s = (METRICS[provider] ??= { success: 0, failure: 0, latency: 0, count: 0 });
  s.failure++;
  s.latency += latency;
  s.count++;
}

export function getMetrics() {
  return JSON.parse(JSON.stringify(METRICS));
}

export function resetMetrics() {
  for (const k of Object.keys(METRICS)) delete METRICS[k];
}

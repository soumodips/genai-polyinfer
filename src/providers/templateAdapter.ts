import { Provider } from '../config';

export function buildBody(provider: Provider, input: string) {
  const tpl = provider.request_structure ?? '{"prompt": "{input}"}';
  return tpl.replace(/\{input\}/g, escapeJson(input)).replace(/\{model\}/g, provider.model ?? '');
}

function escapeJson(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function extractText(response: any, path?: string): string | undefined {
  if (!response) return undefined;
  const p = path ?? '';
  if (!p) {
    const tries = [
      response?.choices?.[0]?.message?.content,
      response?.choices?.[0]?.text,
      response?.text,
      response?.output?.[0]?.content,
      response?.result?.content,
      response?.content?.[0]?.text,
    ];
    for (const t of tries) if (typeof t === 'string') return t;
    if (typeof response === 'string') return response;
    return undefined;
  }
  try {
    const normalized = p.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalized.split('.').filter(Boolean);
    let cur: any = response;
    for (const part of parts) {
      if (cur == null) return undefined;
      cur = cur[part];
    }
    if (typeof cur === 'string') return cur;
    if (cur?.content && typeof cur.content === 'string') return cur.content;
    return undefined;
  } catch {
    return undefined;
  }
}

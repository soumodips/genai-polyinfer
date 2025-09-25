interface HttpResponse {
  ok: boolean;
  status: number;
  body: any;
  rawText: string;
}

let _fetch: typeof fetch | undefined = (globalThis as any).fetch;

async function ensureFetch() {
  if (!_fetch) {
    const nf = await import('node-fetch');
    _fetch = nf.default as unknown as typeof fetch;
  }
  return _fetch;
}

export async function httpRequest(
  input: string | URL | Request,
  init?: RequestInit
): Promise<HttpResponse> {
  const f = await ensureFetch();
  const res = await f(input, init);
  const text = await res.text();
  let parsed: any = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // leave raw text
  }
  return {
    ok: res.ok,
    status: res.status,
    body: parsed,
    rawText: text,
  };
}

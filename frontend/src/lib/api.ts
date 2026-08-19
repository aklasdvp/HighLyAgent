/* ============================================================
   HighLyAgent — backend transport layer
   ------------------------------------------------------------
   The backend connection is fully configurable:
   • build-time : VITE_API_URL / VITE_WS_URL / VITE_SIMULATED (.env)
   • runtime    : localStorage overrides (hla.api / hla.ws) — for the
                  local desktop app, survives restarts without rebuild
   ============================================================ */

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AgentReply {
  task_id: string;
  text: string;
  source: 'knowledge' | 'ai';
  similarity: number;
  tools: string[];
  tokens: number;
  cost_usd: number;
  latency_ms: number;
}

const read = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const env = import.meta.env as Record<string, string | undefined>;

export const API_URL: string =
  (read('hla.api') || env.VITE_API_URL || 'https://api.highlyagent.io').replace(/\/+$/, '');

/** Route prefix in front of every REST path. The backend dropped the /api/v1
 *  prefix (see backend commits "remove API version prefix"), so the default is
 *  empty — endpoints live at the root: /auth/login, /projects, /agent/process…
 *  Set VITE_API_PREFIX=/api/v1 if you ever restore a versioned prefix. */
export const API_PREFIX: string = (read('hla.prefix') || env.VITE_API_PREFIX || '').replace(/\/+$/, '');

export const WS_URL: string =
  read('hla.ws') || env.VITE_WS_URL || `${API_URL.replace(/^http/, 'ws')}/ws`;

/** true → dashboard runs on its built-in demo data store (no backend needed).
 *  false → real API calls against VITE_API_URL (JWT login via /api/v1/auth/*). */
export const SIMULATED: boolean = (env.VITE_SIMULATED ?? 'true') !== 'false';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = res.statusText;
    try {
      const body = (await res.json()) as { detail?: { code?: string; message?: string } | string };
      if (body?.detail) {
        if (typeof body.detail === 'string') message = body.detail;
        else { message = body.detail.message ?? message; code = body.detail.code ?? code; }
      }
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const api = {
  health: () =>
    http<{ status: string; version: string; providers: Record<string, boolean> }>('/health'),

  /* ── auth plane (admin JWT — no API key needed) ── */
  setup: (username: string, email: string, password: string) =>
    http<TokenPair>(`${API_PREFIX}/auth/setup`, { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: (identifier: string, password: string) =>
    http<TokenPair>(`${API_PREFIX}/auth/login`, { method: 'POST', body: JSON.stringify({ identifier, password }) }),
  refresh: (refresh_token: string) =>
    http<TokenPair>(`${API_PREFIX}/auth/refresh`, { method: 'POST', body: JSON.stringify({ refresh_token }) }),
  me: (token: string) =>
    http<{ sub: string; role: string }>(`${API_PREFIX}/auth/me`, { headers: bearer(token) }),

  /* ── admin plane ── */
  projects: (token: string) =>
    http<unknown[]>(`${API_PREFIX}/projects`, { headers: bearer(token) }),
  rotateKey: (token: string, projectId: string) =>
    http<{ key: unknown; visible_key: string }>(`${API_PREFIX}/projects/${projectId}/keys/rotate`,
      { method: 'POST', headers: bearer(token) }),

  /* ── client plane — dual-factor: project id + api key, mismatch → 403 ACCESS_DENIED ── */
  agentProcess: (clientId: string, apiKey: string, body: { user_ref: string; text: string }) =>
    http<AgentReply>(`${API_PREFIX}/agent/process`, {
      method: 'POST',
      headers: { 'X-Client-Id': clientId, 'X-API-Key': apiKey },
      body: JSON.stringify(body),
    }),
};

/* ---------------- WebSocket gateway client ---------------- */
export interface GatewayHandle {
  send: (frame: Record<string, unknown>) => void;
  close: () => void;
}

export function connectGateway(
  params: { clientId?: string; token: string },
  on: {
    onFrame: (frame: Record<string, unknown>) => void;
    onOpen?: () => void;
    onClose?: (code: number, reason: string) => void;
  },
): GatewayHandle {
  const qs = new URLSearchParams({ token: params.token });
  if (params.clientId) qs.set('client_id', params.clientId);
  const ws = new WebSocket(`${WS_URL}?${qs.toString()}`);

  ws.onmessage = (ev) => {
    try { on.onFrame(JSON.parse(String(ev.data)) as Record<string, unknown>); } catch { /* malformed frame */ }
  };
  ws.onopen = () => on.onOpen?.();
  ws.onclose = (ev) => on.onClose?.(ev.code, ev.reason);   // 4403 = ACCESS_DENIED (pair mismatch)

  const hb = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"pong"}');
  }, 25_000);

  return {
    send: (frame) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame)); },
    close: () => { clearInterval(hb); ws.close(); },
  };
}

/* ---------------- runtime overrides (local machine) ---------------- */
export const overrides = {
  setApi: (url: string) => { try { localStorage.setItem('hla.api', url); } catch { /* private mode */ } },
  setWs: (url: string) => { try { localStorage.setItem('hla.ws', url); } catch { /* private mode */ } },
  setPrefix: (prefix: string) => { try { localStorage.setItem('hla.prefix', prefix); } catch { /* private mode */ } },
  clear: () => {
    try {
      localStorage.removeItem('hla.api');
      localStorage.removeItem('hla.ws');
      localStorage.removeItem('hla.prefix');
    } catch { /* ignore */ }
  },
};

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppState, AuditEntry, ClientApp, ClientType, KnowledgeEntry, LogEntry, LogLevel,
  ProviderCfg, Tool, Plan, SecuritySettings, Session, SystemConfig, Theme,
} from './data';
import { DEFAULT_SYSTEM, LOG_POOL, genKey, nowIso, seedState, uid } from './data';

const STORAGE_KEY = 'hla_state_v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (Array.isArray(parsed.clients) && Array.isArray(parsed.knowledge) && parsed.metrics) {
        const base = {
          ...seedState(),
          ...parsed,
          system: { ...DEFAULT_SYSTEM, ...(parsed.system ?? {}) },
        } as AppState;
        /* scope legacy/seed knowledge entries across projects */
        const cids = base.clients.map((c) => c.id);
        if (cids.length) {
          base.knowledge = base.knowledge.map((k, i) => (k.clientId ? k : { ...k, clientId: cids[i % cids.length] }));
        }
        return base;
      }
    }
  } catch { /* corrupted → reseed */ }
  return seedState();
}

const log = (level: LogLevel, source: string, message: string): LogEntry =>
  ({ id: uid(), ts: nowIso(), level, source, message });

const audit = (actor: string, action: string, detail: string): AuditEntry =>
  ({ id: uid(), ts: nowIso(), actor, action, detail, ip: actor === 'system' ? 'internal' : '103.204.88.12' });

/* demo credential digest — the real backend uses bcrypt (see backend/app/core.py) */
export const digest = (s: string) => {
  try { return btoa(unescape(encodeURIComponent(`hla::${s}::salt`))); } catch { return 'x'; }
};

const b64 = (o: object) => { try { return btoa(JSON.stringify(o)); } catch { return 'token'; } };

function makeSession(timeoutMin: number, refreshDays: number): Session {
  const now = Date.now();
  return {
    accessToken: b64({ sub: 'admin', role: 'admin', type: 'access', iat: now, exp: now + timeoutMin * 60_000 }),
    refreshToken: b64({ sub: 'admin', role: 'admin', type: 'refresh', iat: now, exp: now + refreshDays * 86_400_000 }),
    issuedAt: now,
    expiresAt: now + timeoutMin * 60_000,
    refreshExpiresAt: now + refreshDays * 86_400_000,
  };
}

export interface QueryRecord {
  hit: boolean;
  tokens: number;
  savedTokens: number;
  costDelta: number;
  latency: number;
}

type Get = () => AppState;

function makeActions(set: React.Dispatch<React.SetStateAction<AppState>>, get: Get) {
  return {
    /* ---------- auth (admin plane — JWT, no API key) ---------- */
    setupAdmin(username: string, email: string, password: string) {
      const s = get();
      if (s.admin) return false;
      const admin = { username: username.trim(), email: email.trim(), passHash: digest(password), createdAt: nowIso() };
      set((st) => ({
        ...st,
        admin,
        session: makeSession(st.system.sessionTimeoutMin, st.system.refreshValidDays),
        audit: [audit(username, 'ADMIN_SETUP', 'initial admin created manually — no auto-configuration'), ...st.audit],
        logs: [log('info', 'auth', `admin "${username}" created — JWT pair issued`), ...st.logs].slice(0, 160),
      }));
      return true;
    },
    login(identifier: string, password: string): boolean {
      const s = get();
      const a = s.admin;
      if (!a) return false;
      const idn = identifier.trim().toLowerCase();
      const okId = a.username.toLowerCase() === idn || a.email.toLowerCase() === idn;
      if (!okId || a.passHash !== digest(password)) {
        set((st) => ({ ...st, audit: [audit(idn || 'unknown', 'LOGIN_FAILED', 'invalid credentials — attempt logged'), ...st.audit], logs: [log('warn', 'auth', `failed login attempt for "${identifier.trim()}"`), ...st.logs].slice(0, 160) }));
        return false;
      }
      set((st) => ({
        ...st,
        session: makeSession(st.system.sessionTimeoutMin, st.system.refreshValidDays),
        audit: [audit(a.username, 'LOGIN', `JWT issued — access ${st.system.sessionTimeoutMin}m / refresh ${st.system.refreshValidDays}d`), ...st.audit],
        logs: [log('info', 'auth', 'admin login ok — JWT pair issued'), ...st.logs].slice(0, 160),
      }));
      return true;
    },
    logout() {
      set((st) => ({
        ...st,
        session: null,
        audit: [audit(st.admin?.username ?? 'admin', 'LOGOUT', 'refresh token revoked'), ...st.audit],
        logs: [log('info', 'auth', 'admin logged out — session destroyed'), ...st.logs].slice(0, 160),
      }));
    },
    refreshSession(): boolean {
      const s = get();
      if (!s.session || Date.now() > s.session.refreshExpiresAt) {
        set((st) => ({ ...st, session: null, logs: [log('warn', 'auth', 'refresh token expired — re-login required'), ...st.logs].slice(0, 160) }));
        return false;
      }
      set((st) => ({
        ...st,
        session: makeSession(st.system.sessionTimeoutMin, st.system.refreshValidDays),
        logs: [log('info', 'auth', 'session refreshed via refresh token (rotation)'), ...st.logs].slice(0, 160),
      }));
      return true;
    },

    /* ---------- theme & system ---------- */
    setTheme(theme: Theme) {
      set((s) => ({ ...s, theme }));
    },
    saveSystem(patch: Partial<SystemConfig>) {
      set((s) => ({
        ...s,
        system: { ...s.system, ...patch },
        audit: [audit(s.admin?.username ?? 'admin', 'SYSTEM_UPDATE', 'system settings saved manually'), ...s.audit],
        logs: [log('info', 'admin', 'system settings updated'), ...s.logs].slice(0, 160),
      }));
    },

    /* ---------- clients ---------- */
    addClient(data: { name: string; type: ClientType; env: string; desc: string }): ClientApp {
      const client: ClientApp = {
        id: uid(), ...data, apiKey: genKey(), status: 'active',
        createdAt: nowIso(), requests: 0, users: 0,
        rateLimitPerMin: get().system.globalRatePerMin,
        allowedOrigins: '',
        webhookUrl: '',
      };
      set((s) => ({
        ...s,
        clients: [client, ...s.clients],
        audit: [audit(s.admin?.username ?? 'admin', 'CLIENT_CREATE', `${client.name} (${client.type}) — key issued`), ...s.audit],
        logs: [log('info', 'admin', `project registered: ${client.name} [${client.env}]`), ...s.logs].slice(0, 160),
      }));
      return client;
    },
    updateClient(id: string, patch: Partial<ClientApp>) {
      set((s) => ({ ...s, clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    },
    removeClient(id: string) {
      set((s) => {
        const c = s.clients.find((x) => x.id === id);
        return {
          ...s,
          clients: s.clients.filter((x) => x.id !== id),
          knowledge: s.knowledge.filter((k) => (k as KnowledgeEntry & { clientId?: string }).clientId !== id),
          users: s.users.filter((u) => u.clientId !== id),
          audit: [audit(s.admin?.username ?? 'admin', 'CLIENT_DELETE', `${c?.name ?? id} — key revoked, data queued for purge`), ...s.audit],
          logs: [log('warn', 'admin', `project deleted: ${c?.name ?? id}`), ...s.logs].slice(0, 160),
        };
      });
    },
    regenKey(id: string): string {
      const key = genKey();
      set((s) => {
        const c = s.clients.find((x) => x.id === id);
        return {
          ...s,
          clients: s.clients.map((x) => (x.id === id ? { ...x, apiKey: key } : x)),
          audit: [audit(s.admin?.username ?? 'admin', 'API_KEY_REGENERATE', `project=${c?.name ?? id} — previous key revoked instantly`), ...s.audit],
          logs: [log('warn', 'auth', `API key rotated for ${c?.name ?? id} — old key invalid`), ...s.logs].slice(0, 160),
        };
      });
      return key;
    },

    /* ---------- knowledge ---------- */
    addKnowledge(e: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt' | 'hits' | 'savedTokens'> & { clientId?: string }) {
      const entry: KnowledgeEntry = { ...e, id: uid(), hits: 0, savedTokens: 0, createdAt: nowIso(), updatedAt: nowIso() };
      set((s) => ({
        ...s,
        knowledge: [entry, ...s.knowledge],
        logs: [log('info', 'knowledge', `training rule added: "${entry.question.slice(0, 48)}"`), ...s.logs].slice(0, 160),
      }));
    },
    updateKnowledge(id: string, patch: Partial<KnowledgeEntry>) {
      set((s) => ({
        ...s,
        knowledge: s.knowledge.map((k) => (k.id === id ? { ...k, ...patch, updatedAt: nowIso() } : k)),
      }));
    },
    removeKnowledge(id: string) {
      set((s) => ({
        ...s,
        knowledge: s.knowledge.filter((k) => k.id !== id),
        logs: [log('warn', 'knowledge', 'entry deleted — vector removed from index'), ...s.logs].slice(0, 160),
      }));
    },
    registerHit(id: string, savedTokens: number) {
      set((s) => ({
        ...s,
        knowledge: s.knowledge.map((k) => (k.id === id ? { ...k, hits: k.hits + 1, savedTokens: k.savedTokens + savedTokens } : k)),
      }));
    },

    /* ---------- tools ---------- */
    addTool(t: Omit<Tool, 'id' | 'executions' | 'avgMs'>) {
      const tool: Tool = { ...t, id: uid(), executions: 0, avgMs: 0 };
      set((s) => ({
        ...s,
        tools: [tool, ...s.tools],
        audit: [audit(s.admin?.username ?? 'admin', 'TOOL_REGISTER', `${tool.name} (${tool.type}) schema validated`), ...s.audit],
        logs: [log('info', 'tool', `registered ${tool.name} — schema valid, ready`), ...s.logs].slice(0, 160),
      }));
    },
    removeTool(id: string) {
      set((s) => ({ ...s, tools: s.tools.filter((t) => t.id !== id) }));
    },
    toggleTool(id: string) {
      set((s) => ({ ...s, tools: s.tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)) }));
    },

    /* ---------- providers ---------- */
    saveProvider(id: string, patch: Partial<ProviderCfg>) {
      set((s) => ({
        ...s,
        providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        audit: [audit(s.admin?.username ?? 'admin', 'PROVIDER_UPDATE', `${id} configuration saved manually`), ...s.audit],
        logs: [log('info', `provider.${id}`, 'configuration applied (manual save)'), ...s.logs].slice(0, 160),
      }));
    },
    toggleProvider(id: string) {
      set((s) => ({
        ...s,
        providers: s.providers.map((p) =>
          p.id === id ? { ...p, enabled: !p.enabled, status: p.enabled ? 'offline' : 'healthy' } : p,
        ),
        logs: [log('info', `provider.${id}`, 'provider toggled via admin'), ...s.logs].slice(0, 160),
      }));
    },
    moveProvider(id: string, dir: -1 | 1) {
      set((s) => {
        const i = s.providers.findIndex((p) => p.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.providers.length) return s;
        const arr = [...s.providers];
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return { ...s, providers: arr };
      });
    },
    saveSystemInstruction(text: string) {
      set((s) => ({
        ...s,
        systemInstruction: text,
        audit: [audit(s.admin?.username ?? 'admin', 'SYSTEM_INSTRUCTION', 'global system instruction updated'), ...s.audit],
      }));
    },

    /* ---------- users ---------- */
    addUser(u: { name: string; email: string; clientId: string; plan: Plan }) {
      set((s) => ({
        ...s,
        users: [...s.users, { id: uid(), ...u, dailyUsed: 0, monthlyUsed: 0, status: 'active' as const }],
        logs: [log('info', 'billing', `user added to project (${u.plan} plan)`), ...s.logs].slice(0, 160),
      }));
    },
    setPlan(id: string, plan: Plan) {
      set((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === id ? { ...u, plan, status: 'active' as const } : u)),
        logs: [log('info', 'billing', `subscription changed → ${plan.toUpperCase()}`), ...s.logs].slice(0, 160),
      }));
    },
    resetUsage(id: string) {
      set((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === id ? { ...u, dailyUsed: 0, monthlyUsed: 0, status: 'active' as const } : u)),
      }));
    },

    /* ---------- workflows ---------- */
    toggleWorkflow(id: string) {
      set((s) => ({ ...s, workflows: s.workflows.map((w) => (w.id === id ? { ...w, active: !w.active } : w)) }));
    },

    /* ---------- logs / audit ---------- */
    addLog(level: LogLevel, source: string, message: string) {
      set((s) => ({ ...s, logs: [log(level, source, message), ...s.logs].slice(0, 160) }));
    },
    clearLogs() {
      set((s) => ({ ...s, logs: [log('info', 'admin', 'runtime log buffer cleared'), ...s.logs.slice(0, 0)] }));
    },

    /* ---------- security ---------- */
    saveSecurity(patch: Partial<SecuritySettings>) {
      set((s) => ({
        ...s,
        security: { ...s.security, ...patch },
        audit: [audit(s.admin?.username ?? 'admin', 'SECURITY_UPDATE', 'security policy saved manually'), ...s.audit],
      }));
    },
    toggleRole(role: string, perm: string) {
      set((s) => ({
        ...s,
        roles: s.roles.map((r) =>
          r.role === role ? { ...r, perms: { ...r.perms, [perm]: !r.perms[perm] } } : r,
        ),
        audit: [audit(s.admin?.username ?? 'admin', 'RBAC_CHANGE', `${role} / ${perm} toggled`), ...s.audit],
      }));
    },

    /* ---------- metrics / agent core ---------- */
    recordQuery(r: QueryRecord) {
      set((s) => {
        const m = s.metrics;
        return {
          ...s,
          metrics: {
            ...m,
            requestsToday: m.requestsToday + 1,
            aiCalls: m.aiCalls + (r.hit ? 0 : 1),
            cacheHits: m.cacheHits + (r.hit ? 1 : 0),
            tokensUsed: m.tokensUsed + (r.hit ? 0 : r.tokens),
            tokensSaved: m.tokensSaved + (r.hit ? r.savedTokens : 0),
            costSaved: +(m.costSaved + r.costDelta).toFixed(4),
            avgLatency: Math.round((m.avgLatency * 0.9 + r.latency * 0.1)),
            connections: m.connections,
            seriesReq: [...m.seriesReq.slice(1), Math.min(100, Math.round(r.latency / 30))],
            seriesHit: [...m.seriesHit.slice(1), r.hit ? 90 : 20],
          },
        };
      });
    },
    learn(question: string, answer: string, category: string, language: 'en' | 'bn' | 'mixed') {
      const entry: KnowledgeEntry = {
        id: `k-${uid()}`, question, answer, category, language,
        source: 'ai-learned', hits: 0, savedTokens: 0, active: true,
        createdAt: nowIso(), updatedAt: nowIso(),
      };
      set((s) => ({
        ...s,
        knowledge: [entry, ...s.knowledge],
        logs: [log('info', 'knowledge', `learned new entry id=${entry.id.slice(0, 10)} source=ai-learned`), ...s.logs].slice(0, 160),
      }));
    },

    resetAll() {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      set(seedState());
    },
  };
}

export type Store = { state: AppState; actions: ReturnType<typeof makeActions> };

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const stateRef = useRef(state);
  stateRef.current = state;
  const actions = useMemo(() => makeActions(setState, () => stateRef.current), []);

  /* persistence */
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
    }, 250);
    return () => clearTimeout(t);
  }, [state]);

  /* live platform simulation — the middleware keeps talking */
  useEffect(() => {
    const iv = setInterval(() => {
      const s = stateRef.current;
      const pool = LOG_POOL;
      const ev = pool[Math.floor(Math.random() * pool.length)];
      const isHit = ev.source === 'knowledge' && ev.message.startsWith('hit');
      const reqDelta = 3 + Math.floor(Math.random() * 9);
      setState((prev) => ({
        ...prev,
        logs: [log(ev.level, ev.source, ev.message), ...prev.logs].slice(0, 160),
        metrics: {
          ...prev.metrics,
          requestsToday: prev.metrics.requestsToday + reqDelta,
          cacheHits: prev.metrics.cacheHits + (isHit ? reqDelta - 1 : Math.floor(Math.random() * 3)),
          aiCalls: prev.metrics.aiCalls + (isHit ? 0 : 1 + Math.floor(Math.random() * 2)),
          connections: Math.max(80, Math.min(260, prev.metrics.connections + Math.floor(Math.random() * 11) - 5)),
          seriesReq: [...prev.metrics.seriesReq.slice(1), 30 + Math.floor(Math.random() * 62)],
          seriesHit: [...prev.metrics.seriesHit.slice(1), 35 + Math.floor(Math.random() * 55)],
        },
        clients: s.clients.map((c, i) =>
          i === Math.floor(Math.random() * s.clients.length) && c.status === 'active'
            ? { ...c, requests: c.requests + Math.floor(Math.random() * 24) }
            : c,
        ),
      }));
    }, 3400);
    return () => clearInterval(iv);
  }, []);

  return <Ctx.Provider value={{ state, actions }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore outside provider');
  return ctx;
}

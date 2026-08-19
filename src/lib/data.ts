/* ============================================================
   HighLyAgent — domain types, seed data & pure utilities
   ============================================================ */

import { WS_URL } from './api';

export type ClientType = 'web' | 'mobile' | 'desktop' | 'iot';
export type Plan = 'free' | 'trial' | 'unlimited';
export type Intent = 'weather' | 'time' | 'order' | 'sales' | 'refund' | 'generic';

export interface ClientApp {
  id: string;
  name: string;
  type: ClientType;
  env: string;
  desc: string;
  apiKey: string;
  status: 'active' | 'suspended';
  createdAt: string;
  requests: number;
  users: number;
  aiConfig?: AIClientConfig;
  allowedOrigins?: string;
  rateLimitPerMin?: number;
  webhookUrl?: string;
}

/* ---------------- auth / session / system (admin plane) ---------------- */
export type Theme = 'dark' | 'light';

export interface AIClientConfig {
  provider: ProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}
export const DEFAULT_AI_CONFIG: AIClientConfig = {
  provider: 'openai', model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 1024, systemPrompt: '',
};

export interface AdminAccount {
  username: string;
  email: string;
  passHash: string;      // demo digest — real backend uses bcrypt
  createdAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  issuedAt: number;
  expiresAt: number;
  refreshExpiresAt: number;
}

export interface SystemConfig {
  gatewayUrl: string;
  localPort: number;
  sessionTimeoutMin: number;
  refreshValidDays: number;
  globalRatePerMin: number;
  enforceClientScope: boolean;
  autoRefreshSession: boolean;
}
export const DEFAULT_SYSTEM: SystemConfig = {
  gatewayUrl: WS_URL,
  localPort: 8090,
  sessionTimeoutMin: 30,
  refreshValidDays: 7,
  globalRatePerMin: 60,
  enforceClientScope: true,
  autoRefreshSession: true,
};

export interface KnowledgeEntry {
  id: string;
  clientId?: string;
  question: string;
  answer: string;
  category: string;
  language: 'en' | 'bn' | 'mixed';
  source: 'ai-learned' | 'manual' | 'training';
  hits: number;
  savedTokens: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: 'server' | 'client';
  schema: string;
  enabled: boolean;
  executions: number;
  avgMs: number;
}

export type ProviderId = 'openai' | 'gemini' | 'claude' | 'deepseek';
export interface ProviderCfg {
  id: ProviderId;
  name: string;
  enabled: boolean;
  apiKey: string;
  models: string[];
  model: string;
  temperature: number;
  maxTokens: number;
  latencyMs: number;
  costPer1k: number;
  status: 'healthy' | 'degraded' | 'offline';
}

export interface UserRec {
  id: string;
  name: string;
  email: string;
  clientId: string;
  plan: Plan;
  dailyUsed: number;
  monthlyUsed: number;
  status: 'active' | 'blocked';
}

export interface WorkflowStep { id: string; label: string; kind: 'tool' | 'ai' | 'condition' | 'notify'; }
export interface Workflow {
  id: string;
  name: string;
  trigger: string;
  steps: WorkflowStep[];
  runs: number;
  successRate: number;
  active: boolean;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export interface LogEntry { id: string; ts: string; level: LogLevel; source: string; message: string; }
export interface AuditEntry { id: string; ts: string; actor: string; action: string; detail: string; ip: string; }

export interface Metrics {
  requestsToday: number;
  aiCalls: number;
  cacheHits: number;
  tokensUsed: number;
  tokensSaved: number;
  costSaved: number;
  avgLatency: number;
  connections: number;
  seriesReq: number[];
  seriesHit: number[];
}

export interface SecuritySettings {
  ratePerMin: number;
  burst: number;
  dailyTokenDefault: number;
  sanitize: boolean;
  csrf: boolean;
  encryption: boolean;
  mtls: boolean;
  auditLog: boolean;
}

export interface RolePerm { role: string; perms: Record<string, boolean>; }

export interface AppState {
  clients: ClientApp[];
  knowledge: KnowledgeEntry[];
  tools: Tool[];
  providers: ProviderCfg[];
  users: UserRec[];
  workflows: Workflow[];
  logs: LogEntry[];
  audit: AuditEntry[];
  metrics: Metrics;
  security: SecuritySettings;
  roles: RolePerm[];
  systemInstruction: string;
  admin: AdminAccount | null;
  session: Session | null;
  theme: Theme;
  system: SystemConfig;
}

/* ---------------- utilities ---------------- */

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const genKey = () => {
  const hex = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `hla_live_${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}`;
};

export const maskKey = (k: string) => `${k.slice(0, 12)}••••••••${k.slice(-4)}`;

export const nowIso = () => new Date().toISOString();
export const isoAgo = (min: number) => new Date(Date.now() - min * 60000).toISOString();
export const timeStr = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
export const dateStr = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmt = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('en-US');
};
export const money = (n: number) => '$' + n.toFixed(n < 1 ? 4 : 2);

export const PLAN_LIMITS: Record<Plan, { daily: number; monthly: number; label: string }> = {
  free: { daily: 2_000, monthly: 40_000, label: 'Free' },
  trial: { daily: 50_000, monthly: 900_000, label: 'Trial' },
  unlimited: { daily: -1, monthly: -1, label: 'Unlimited' },
};

/* ---- similarity (simulated vector search over token overlap) ---- */
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'what', 'how', 'of', 'to', 'in', 'my', 'your', 'কী', 'কোন', 'আমার', 'আজ', 'এখন']);
const tokenize = (s: string) =>
  s.toLowerCase().replace(/[?!।,.'"]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));

export function similarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter++; });
  const union = new Set([...ta, ...tb]).size;
  let score = inter / union;
  if (inter >= 2) score = Math.min(1, score + 0.18);
  return score;
}

export function findKnowledge(q: string, entries: KnowledgeEntry[]): { entry: KnowledgeEntry; score: number } | null {
  let best: { entry: KnowledgeEntry; score: number } | null = null;
  for (const e of entries) {
    if (!e.active) continue;
    const score = similarity(q, e.question);
    if (score > 0.4 && (!best || score > best.score)) best = { entry: e, score };
  }
  return best;
}

/* ---- intent detection (rule-based, bilingual) ---- */
const INTENT_RULES: { intent: Intent; words: string[] }[] = [
  { intent: 'weather', words: ['weather', 'আবহাওয়া', 'তাপমাত্রা', 'বৃষ্টি', 'rain', 'temperature'] },
  { intent: 'time', words: ['time', 'সময়', 'কয়টা', 'clock', 'ঘড়ি'] },
  { intent: 'order', words: ['order', 'অর্ডার', 'track', 'tracking', 'shipment', 'ডেলিভারি'] },
  { intent: 'sales', words: ['sales', 'revenue', 'বিক্রয়', 'আয়', 'report'] },
  { intent: 'refund', words: ['refund', 'রিফান্ড', 'ফেরত', 'return'] },
];
export function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  for (const r of INTENT_RULES) if (r.words.some((w) => t.includes(w))) return r.intent;
  return 'generic';
}
export const isBengali = (s: string) => /[\u0980-\u09FF]/.test(s);

export const INTENT_TOOL: Partial<Record<Intent, string>> = {
  weather: 'weather.fetch',
  time: 'time.current',
  order: 'order.lookup',
  sales: 'sales.summary',
};

/* ---------------- seed ---------------- */

const seedSeries = (base: number, spread: number) =>
  Array.from({ length: 26 }, (_, i) => Math.round(base + Math.sin(i / 3.1) * spread * 0.6 + Math.random() * spread));

export function seedState(): AppState {
  return {
    clients: [
      { id: 'c1', name: 'ShopNex Web', type: 'web', env: 'production', desc: 'E-commerce storefront — React SPA', apiKey: genKey(), status: 'active', createdAt: isoAgo(60 * 24 * 42), requests: 48_210, users: 3_412 },
      { id: 'c2', name: 'ShopNex Mobile', type: 'mobile', env: 'production', desc: 'Android / iOS companion app', apiKey: genKey(), status: 'active', createdAt: isoAgo(60 * 24 * 38), requests: 71_934, users: 8_127 },
      { id: 'c3', name: 'DeskMate', type: 'desktop', env: 'staging', desc: 'Electron productivity assistant', apiKey: genKey(), status: 'active', createdAt: isoAgo(60 * 24 * 19), requests: 6_480, users: 214 },
      { id: 'c4', name: 'AgroSense Hub', type: 'iot', env: 'production', desc: 'Farm sensor gateway · 340 devices', apiKey: genKey(), status: 'active', createdAt: isoAgo(60 * 24 * 12), requests: 15_302, users: 96 },
      { id: 'c5', name: 'MediQueue Kiosk', type: 'iot', env: 'sandbox', desc: 'Hospital queue kiosk (pilot)', apiKey: genKey(), status: 'suspended', createdAt: isoAgo(60 * 24 * 5), requests: 842, users: 12 },
    ],
    knowledge: [
      { id: 'k1', question: 'What is your refund policy?', answer: 'You can request a full refund within 7 days of delivery if the product is unused. Go to Orders → select the item → "Request Refund". Amounts are returned to the original payment method within 3–5 business days.', category: 'policy', language: 'en', source: 'manual', hits: 412, savedTokens: 158_600, active: true, createdAt: isoAgo(60 * 24 * 30), updatedAt: isoAgo(60 * 24 * 2) },
      { id: 'k2', question: 'আমার অর্ডার কোথায়?', answer: 'আপনার অর্ডারটি বর্তমানে ডেলিভারি হাবে আছে। সাধারণত ২৪–৪৮ ঘণ্টার মধ্যে ডেলিভারি সম্পন্ন হয়। Orders পেজ থেকে ট্র্যাকিং আইডি দিয়ে লাইভ লোকেশন দেখতে পারবেন।', category: 'support', language: 'bn', source: 'ai-learned', hits: 268, savedTokens: 101_300, active: true, createdAt: isoAgo(60 * 24 * 21), updatedAt: isoAgo(60 * 24 * 21) },
      { id: 'k3', question: 'How can I reset my password?', answer: 'Open the login screen and tap "Forgot password". Enter your registered email — a reset link valid for 30 minutes will be sent. For security, the link works only once.', category: 'account', language: 'en', source: 'manual', hits: 190, savedTokens: 70_100, active: true, createdAt: isoAgo(60 * 24 * 28), updatedAt: isoAgo(60 * 24 * 28) },
      { id: 'k4', question: 'ডেলিভারি চার্জ কত?', answer: 'ঢাকার ভিতরে ডেলিভারি চার্জ ৬০ টাকা, ঢাকার বাইরে ১২০ টাকা। ২০০০ টাকার বেশি অর্ডারে ডেলিভারি সম্পূর্ণ ফ্রি।', category: 'billing', language: 'bn', source: 'training', hits: 154, savedTokens: 52_900, active: true, createdAt: isoAgo(60 * 24 * 15), updatedAt: isoAgo(60 * 24 * 9) },
      { id: 'k5', question: 'What are your business hours?', answer: 'Support is available Saturday–Thursday, 9:00–22:00 (Asia/Dhaka). Live chat responds in under 2 minutes on average; the agent handles all queries 24/7.', category: 'general', language: 'en', source: 'manual', hits: 97, savedTokens: 34_800, active: true, createdAt: isoAgo(60 * 24 * 11), updatedAt: isoAgo(60 * 24 * 11) },
      { id: 'k6', question: 'How to cancel an order?', answer: 'Orders can be cancelled before they enter "Packed" status. Open Orders → choose the order → Cancel. Prepaid amounts are auto-refunded within 48 hours.', category: 'support', language: 'en', source: 'ai-learned', hits: 61, savedTokens: 22_400, active: false, createdAt: isoAgo(60 * 24 * 7), updatedAt: isoAgo(60 * 24 * 1) },
    ],
    tools: [
      { id: 't1', name: 'weather.fetch', description: 'Current weather by city (OpenMeteo API)', type: 'server', schema: '{\n  "type": "object",\n  "properties": {\n    "city": { "type": "string" }\n  },\n  "required": ["city"]\n}', enabled: true, executions: 1_284, avgMs: 96 },
      { id: 't2', name: 'time.current', description: 'Server time for a timezone', type: 'server', schema: '{\n  "type": "object",\n  "properties": {\n    "timezone": { "type": "string" }\n  }\n}', enabled: true, executions: 862, avgMs: 4 },
      { id: 't3', name: 'order.lookup', description: 'Fetch order status from client backend', type: 'server', schema: '{\n  "type": "object",\n  "properties": {\n    "order_id": { "type": "string" }\n  },\n  "required": ["order_id"]\n}', enabled: true, executions: 2_419, avgMs: 142 },
      { id: 't4', name: 'sales.summary', description: 'Aggregated sales metrics for a date range', type: 'server', schema: '{\n  "type": "object",\n  "properties": {\n    "from": { "type": "string" },\n    "to": { "type": "string" }\n  }\n}', enabled: true, executions: 318, avgMs: 231 },
      { id: 't5', name: 'device.reboot', description: 'Soft-reboot an IoT node (runs on client)', type: 'client', schema: '{\n  "type": "object",\n  "properties": {\n    "device_id": { "type": "string" }\n  },\n  "required": ["device_id"]\n}', enabled: true, executions: 47, avgMs: 1_830 },
      { id: 't6', name: 'ui.navigate', description: 'Deep-link navigation inside client app', type: 'client', schema: '{\n  "type": "object",\n  "properties": {\n    "route": { "type": "string" }\n  },\n  "required": ["route"]\n}', enabled: false, executions: 903, avgMs: 22 },
    ],
    providers: [
      { id: 'openai', name: 'OpenAI', enabled: true, apiKey: 'sk-proj-••••••••••••7f3a', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'], model: 'gpt-4o-mini', temperature: 0.4, maxTokens: 1024, latencyMs: 1_180, costPer1k: 0.0015, status: 'healthy' },
      { id: 'claude', name: 'Anthropic Claude', enabled: true, apiKey: 'sk-ant-••••••••••••b219', models: ['claude-sonnet-4', 'claude-haiku-4'], model: 'claude-haiku-4', temperature: 0.3, maxTokens: 1024, latencyMs: 940, costPer1k: 0.0012, status: 'healthy' },
      { id: 'gemini', name: 'Google Gemini', enabled: true, apiKey: 'AIza-••••••••••••c40d', models: ['gemini-2.0-flash', 'gemini-1.5-pro'], model: 'gemini-2.0-flash', temperature: 0.5, maxTokens: 1024, latencyMs: 720, costPer1k: 0.00035, status: 'degraded' },
      { id: 'deepseek', name: 'DeepSeek', enabled: false, apiKey: '', models: ['deepseek-chat', 'deepseek-reasoner'], model: 'deepseek-chat', temperature: 0.6, maxTokens: 2048, latencyMs: 1_560, costPer1k: 0.00014, status: 'offline' },
    ],
    users: [
      { id: 'u1', name: 'Arif Chowdhury', email: 'arif@shopnex.io', clientId: 'c1', plan: 'unlimited', dailyUsed: 18_410, monthlyUsed: 412_300, status: 'active' },
      { id: 'u2', name: 'Nusrat Jahan', email: 'nusrat@shopnex.io', clientId: 'c2', plan: 'trial', dailyUsed: 31_204, monthlyUsed: 512_900, status: 'active' },
      { id: 'u3', name: 'Tanvir Rahman', email: 'tanvir@deskmate.app', clientId: 'c3', plan: 'free', dailyUsed: 1_740, monthlyUsed: 36_210, status: 'active' },
      { id: 'u4', name: 'Sadia Islam', email: 'sadia@agrosense.bd', clientId: 'c4', plan: 'trial', dailyUsed: 4_860, monthlyUsed: 88_420, status: 'active' },
      { id: 'u5', name: 'Mizanur Khan', email: 'mizan@shopnex.io', clientId: 'c2', plan: 'free', dailyUsed: 2_000, monthlyUsed: 40_000, status: 'blocked' },
      { id: 'u6', name: 'Rafiul Alam', email: 'rafiul@mediqueue.bd', clientId: 'c5', plan: 'free', dailyUsed: 120, monthlyUsed: 1_840, status: 'active' },
    ],
    workflows: [
      {
        id: 'w1', name: 'Order Issue Resolver', trigger: 'intent: order_issue', active: true, runs: 1_238, successRate: 97.2,
        steps: [
          { id: 'w1s1', label: 'order.lookup', kind: 'tool' },
          { id: 'w1s2', label: 'status == delayed?', kind: 'condition' },
          { id: 'w1s3', label: 'Draft apology + ETA', kind: 'ai' },
          { id: 'w1s4', label: 'notification.push', kind: 'notify' },
        ],
      },
      {
        id: 'w2', name: 'IoT Anomaly Response', trigger: 'sensor: anomaly_score > 0.8', active: true, runs: 86, successRate: 91.8,
        steps: [
          { id: 'w2s1', label: 'device.health', kind: 'tool' },
          { id: 'w2s2', label: 'Classify fault (AI)', kind: 'ai' },
          { id: 'w2s3', label: 'device.reboot', kind: 'tool' },
          { id: 'w2s4', label: 'Alert ops channel', kind: 'notify' },
        ],
      },
      {
        id: 'w3', name: 'Daily Sales Digest', trigger: 'cron: 0 8 * * *', active: false, runs: 342, successRate: 99.1,
        steps: [
          { id: 'w3s1', label: 'sales.summary', kind: 'tool' },
          { id: 'w3s2', label: 'Summarize (AI)', kind: 'ai' },
          { id: 'w3s3', label: 'notification.push', kind: 'notify' },
        ],
      },
    ],
    logs: [
      { id: 'l1', ts: isoAgo(0.4), level: 'info', source: 'knowledge', message: "hit q='ডেলিভারি চার্জ কত?' sim=0.94 · 0 AI tokens" },
      { id: 'l2', ts: isoAgo(1.1), level: 'info', source: 'ws.gateway', message: 'client=ShopNexMobile conn established (ttl 3600s)' },
      { id: 'l3', ts: isoAgo(1.9), level: 'info', source: 'provider.openai', message: 'completion model=gpt-4o-mini tokens=388 latency=1.18s' },
      { id: 'l4', ts: isoAgo(2.6), level: 'debug', source: 'memory', message: 'short-term window trimmed user=u2 (kept 12 turns)' },
      { id: 'l5', ts: isoAgo(3.4), level: 'info', source: 'tool', message: 'order.lookup ok order=ORD-88K2M 142ms' },
      { id: 'l6', ts: isoAgo(4.2), level: 'warn', source: 'ratelimit', message: 'client=AgroSenseHub 58/60 rpm — nearing ceiling' },
      { id: 'l7', ts: isoAgo(5.5), level: 'info', source: 'knowledge', message: 'learned new entry id=k-auto-114 source=ai-learned' },
      { id: 'l8', ts: isoAgo(6.8), level: 'error', source: 'provider.gemini', message: '429 quota — fallback to claude (chain pos 2)' },
      { id: 'l9', ts: isoAgo(8.1), level: 'info', source: 'auth', message: 'JWT refresh ok user=u4 scope=agent:read,agent:write' },
      { id: 'l10', ts: isoAgo(9.7), level: 'info', source: 'workflow', message: "Order Issue Resolver completed run #1238 in 2.4s" },
    ],
    audit: [
      { id: 'a1', ts: isoAgo(60 * 5), actor: 'admin@highlyagent', action: 'API_KEY_REGENERATE', detail: 'client=DeskMate — previous key revoked instantly', ip: '103.204.88.12' },
      { id: 'a2', ts: isoAgo(60 * 9), actor: 'admin@highlyagent', action: 'PROVIDER_UPDATE', detail: 'openai.temperature 0.7 → 0.4', ip: '103.204.88.12' },
      { id: 'a3', ts: isoAgo(60 * 26), actor: 'system', action: 'ROLE_CHANGE', detail: 'viewer → manager for ops@shopnex.io', ip: 'internal' },
      { id: 'a4', ts: isoAgo(60 * 31), actor: 'admin@highlyagent', action: 'CLIENT_SUSPEND', detail: 'MediQueue Kiosk — sandbox quota expired', ip: '103.204.88.12' },
      { id: 'a5', ts: isoAgo(60 * 50), actor: 'system', action: 'KEY_ROTATION', detail: 'scheduled rotation: 3 client keys rotated, 0 failures', ip: 'internal' },
    ],
    metrics: {
      requestsToday: 12_847,
      aiCalls: 2_871,
      cacheHits: 9_976,
      tokensUsed: 4_128_500,
      tokensSaved: 14_610_000,
      costSaved: 86.42,
      avgLatency: 142,
      connections: 148,
      seriesReq: seedSeries(62, 34),
      seriesHit: seedSeries(48, 26),
    },
    security: {
      ratePerMin: 60,
      burst: 15,
      dailyTokenDefault: 2000,
      sanitize: true,
      csrf: true,
      encryption: true,
      mtls: false,
      auditLog: true,
    },
    roles: [
      { role: 'Admin', perms: { 'Manage clients': true, 'Configure AI': true, 'Edit knowledge': true, 'View logs': true, 'Billing': true } },
      { role: 'Manager', perms: { 'Manage clients': true, 'Configure AI': false, 'Edit knowledge': true, 'View logs': true, 'Billing': false } },
      { role: 'Viewer', perms: { 'Manage clients': false, 'Configure AI': false, 'Edit knowledge': false, 'View logs': true, 'Billing': false } },
    ],
    systemInstruction:
      'You are the embedded assistant for this client application. Answer concisely in the language the user writes (Bengali or English). When a tool result is provided, ground the answer strictly in that data. Never invent prices, order states or dates.',
    admin: null,
    session: null,
    theme: 'dark',
    system: { ...DEFAULT_SYSTEM },
  };
}

/* ---- live simulation log pool ---- */
export const LOG_POOL: { level: LogLevel; source: string; message: string }[] = [
  { level: 'info', source: 'knowledge', message: "hit q='রিফান্ড পলিসি' sim=0.91 · served from cache" },
  { level: 'info', source: 'ws.gateway', message: 'client=ShopNexWeb heartbeat ok · 42 active sockets' },
  { level: 'info', source: 'provider.openai', message: 'completion tokens=412 latency=1.21s cost=$0.00062' },
  { level: 'debug', source: 'embedder', message: 'embedding 1536-dim cached key=q:9f3a21 (redis ttl 24h)' },
  { level: 'info', source: 'tool', message: 'weather.fetch city=Dhaka 84ms → 29°C partly cloudy' },
  { level: 'warn', source: 'provider.gemini', message: 'p95 latency 2.3s exceeds SLO — chain demoted' },
  { level: 'info', source: 'knowledge', message: 'learned new entry source=ai-learned sim_threshold=0.40' },
  { level: 'info', source: 'auth', message: 'API key hla_live_9f3a•••• verified scope=agent:write' },
  { level: 'debug', source: 'memory', message: 'long-term recall user=u1 → 3 facts injected into prompt' },
  { level: 'info', source: 'workflow', message: 'IoT Anomaly Response armed · trigger sensor>0.8' },
  { level: 'info', source: 'celery', message: 'task reindex-knowledge completed in 3.2s (245 vectors)' },
  { level: 'warn', source: 'ratelimit', message: 'burst absorbed client=DeskMate 14/15 — throttling armed' },
  { level: 'error', source: 'provider.deepseek', message: 'connection refused — provider marked offline (probe 60s)' },
  { level: 'info', source: 'ws.gateway', message: 'client=AgroSenseHub task progress 62% → pushed' },
];

export const SUGGESTED_PROMPTS = [
  'ঢাকায় আজ আবহাওয়া কেমন?',
  "What's the weather in Dhaka?",
  'আমার অর্ডার কোথায়?',
  'What is your refund policy?',
  'ঢাকার সময় এখন কয়টা?',
  'Summarize today’s sales',
];

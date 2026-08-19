import type { ReactNode } from 'react';
import { Badge, Icon, SectionHead } from '../components/ui';
import type { IconName } from '../components/ui';

function Node({ icon, title, sub, tone = 'default' }: { icon: IconName; title: string; sub: string; tone?: 'default' | 'amber' | 'teal' | 'blue' }) {
  const ring = {
    default: 'border-ink-600 hover:border-ink-500',
    amber: 'border-signal-600/50 hover:border-signal-500 bg-signal-900/30',
    teal: 'border-pulse-600/50 hover:border-pulse-500 bg-pulse-900/30',
    blue: 'border-cobalt-500/40 hover:border-cobalt-400 bg-cobalt-900/30',
  };
  const ic = { default: 'text-mist-400', amber: 'text-signal-400', teal: 'text-pulse-400', blue: 'text-cobalt-400' };
  return (
    <div className={`rounded-lg border px-3 py-2.5 bg-ink-800/70 transition-all hover:-translate-y-0.5 ${ring[tone]}`}>
      <p className={`flex items-center gap-1.5 font-mono text-[11px] font-medium text-mist-100`}>
        <Icon name={icon} size={13} className={ic[tone]} /> {title}
      </p>
      <p className="text-[10.5px] text-mist-500 mt-1 leading-snug">{sub}</p>
    </div>
  );
}

function Layer({ tag, title, children, tagTone }: { tag: string; title: string; children: ReactNode; tagTone?: 'amber' | 'teal' | 'blue' }) {
  return (
    <div className="panel relative p-4">
      <div className="absolute -top-2.5 left-4 flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded font-mono text-[9.5px] tracking-[0.16em] uppercase border ${tagTone === 'amber' ? 'bg-signal-900 text-signal-300 border-signal-600/50' : tagTone === 'teal' ? 'bg-pulse-900 text-pulse-300 border-pulse-600/50' : tagTone === 'blue' ? 'bg-cobalt-900 text-cobalt-300 border-cobalt-500/50' : 'bg-ink-800 text-mist-400 border-ink-600'}`}>{tag}</span>
        <span className="font-display font-semibold text-[13px] text-mist-200">{title}</span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-1">
      <div className="dash-v h-7" />
      {label && <span className="font-mono text-[9.5px] uppercase tracking-widest text-mist-600">{label}</span>}
      <div className="dash-v h-7" />
    </div>
  );
}

const PHASES: { n: number; title: string; status: 'done' | 'current' | 'planned'; items: string[] }[] = [
  { n: 1, title: 'Project Structure & Setup', status: 'done', items: ['Monorepo layout', 'venv + requirements.txt', '.env / settings'] },
  { n: 2, title: 'Database Design', status: 'done', items: ['PostgreSQL + pgvector', 'SQLAlchemy models', 'Alembic migrations'] },
  { n: 3, title: 'Authentication System', status: 'done', items: ['JWT access + refresh', 'API key management', 'RBAC + bcrypt'] },
  { n: 4, title: 'AI Provider Layer', status: 'done', items: ['Abstract interface', 'OpenAI / Gemini / Claude', 'Factory + fallback'] },
  { n: 5, title: 'Knowledge Engine', status: 'done', items: ['Vector search (pgvector)', 'Knowledge saver + cache', 'Training system'] },
  { n: 6, title: 'Memory System', status: 'done', items: ['Short-term (Redis)', 'Long-term (PostgreSQL)', 'Memory manager'] },
  { n: 7, title: 'Tool System', status: 'done', items: ['Tool registry', 'JSON-Schema validator', 'Server & client tools'] },
  { n: 8, title: 'Agent Core', status: 'done', items: ['Intent analysis', 'Process-input use case', 'Learn-from-AI use case'] },
  { n: 9, title: 'WebSocket Gateway', status: 'done', items: ['Connection manager', 'Task progress push', 'Task cancellation'] },
  { n: 10, title: 'Admin Control Center', status: 'current', items: ['This dashboard — live', 'Client / key / tool CRUD', 'Test console + logs'] },
  { n: 11, title: 'Subscription & Tokens', status: 'planned', items: ['Free / Trial / Unlimited', 'Daily & monthly limits', 'Payment-ready hooks'] },
  { n: 12, title: 'Security Hardening', status: 'planned', items: ['Rate limiting', 'Encryption manager', 'CSRF + audit trail'] },
  { n: 13, title: 'Testing & QA', status: 'planned', items: ['Unit + integration', 'WebSocket tests', '90%+ coverage'] },
  { n: 14, title: 'Deployment', status: 'planned', items: ['Docker + Compose', 'Kubernetes YAML', 'CI/CD + docs'] },
];

export default function Architecture() {
  return (
    <div>
      <SectionHead
        title="System Architecture"
        desc="One central agent core. Any client — Web, Mobile, Desktop, IoT — speaks to it over WebSocket/REST, and the knowledge loop drives provider spend down by 70–80%."
        right={<Badge tone="teal">v0.9.2 · design rev 4</Badge>}
      />

      <div className="grid lg:grid-cols-4 gap-4">
        {/* diagram */}
        <div className="lg:col-span-3 space-y-0 anim-rise">
          <Layer tag="edge" title="Client Layer — any application">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Node icon="globe" title="Web SPA" sub="React / Vue · JS SDK" tone="blue" />
              <Node icon="phone" title="Mobile" sub="Android / iOS SDK" tone="blue" />
              <Node icon="monitor" title="Desktop" sub="Electron bridge" tone="blue" />
              <Node icon="chip" title="IoT Devices" sub="MQTT → WS bridge" tone="blue" />
            </div>
          </Layer>
          <Connector label="wss:// · https:// · jwt / api-key" />
          <Layer tag="gateway" title="API & WebSocket Gateway" tagTone="blue">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Node icon="wifi" title="Connection Manager" sub="per-client socket pools" />
              <Node icon="lock" title="Auth" sub="JWT · API key · RBAC" />
              <Node icon="sliders" title="Rate Limiter" sub="Redis token bucket" />
              <Node icon="shield" title="Sanitizer" sub="input validation" />
            </div>
          </Layer>
          <Connector label="user input + context" />
          <Layer tag="core" title="Agent Core" tagTone="amber">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Node icon="spark" title="Intent Analyzer" sub="rules → embeddings" tone="amber" />
              <Node icon="pulse" title="Conversation Mgr" sub="sessions + turns" tone="amber" />
              <Node icon="flow" title="Workflow Engine" sub="multi-step DAG tasks" tone="amber" />
              <Node icon="db" title="Memory Manager" sub="short (Redis) + long (PG)" tone="amber" />
            </div>
          </Layer>
          <Connector label="knowledge-first lookup" />
          <div className="grid md:grid-cols-3 gap-4">
            <Layer tag="learn" title="Knowledge Engine" tagTone="teal">
              <div className="space-y-2.5">
                <Node icon="db" title="pgvector Search" sub="cosine sim ≥ 0.40 → cache hit" tone="teal" />
                <Node icon="bolt" title="Redis Knowledge Cache" sub="hot answers, 24h TTL" tone="teal" />
                <Node icon="book" title="Knowledge Saver" sub="learn-from-AI pipeline" tone="teal" />
              </div>
            </Layer>
            <Layer tag="act" title="Tool Runtime">
              <div className="space-y-2.5">
                <Node icon="server" title="Server Tools" sub="weather · orders · sales" />
                <Node icon="chip" title="Client Tools" sub="executed on device, result relayed" />
                <Node icon="check" title="Schema Validator" sub="JSON-Schema enforced" />
              </div>
            </Layer>
            <Layer tag="think" title="AI Provider Layer" tagTone="blue">
              <div className="space-y-2.5">
                <Node icon="plug" title="Provider Factory" sub="OpenAI → Claude → Gemini" tone="blue" />
                <Node icon="refresh" title="Fallback Chain" sub="manual order, auto failover" tone="blue" />
                <Node icon="layers" title="Embeddings" sub="multilingual 1536-dim" tone="blue" />
              </div>
            </Layer>
          </div>
          <Connector label="persistence" />
          <Layer tag="infra" title="Infrastructure">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Node icon="db" title="PostgreSQL 16" sub="+ pgvector extension" />
              <Node icon="bolt" title="Redis 7" sub="cache · memory · queues" />
              <Node icon="flow" title="Celery Workers" sub="reindex · digest · cleanup" />
              <Node icon="layers" title="Docker / K8s" sub="stateless agent pods" />
            </div>
          </Layer>
        </div>

        {/* learning loop explainer */}
        <div className="space-y-4 anim-rise" style={{ animationDelay: '140ms' }}>
          <div className="panel p-5 border-signal-600/40">
            <h3 className="font-display font-semibold text-mist-100 flex items-center gap-2">
              <Icon name="spark" size={16} className="text-signal-400" /> The Self-Learning Loop
            </h3>
            <ol className="mt-4 space-y-3.5">
              {[
                { n: '1', t: 'First ask', d: 'New question → vector search finds nothing (sim < 0.40).' },
                { n: '2', t: 'Agent acts', d: 'Runs tools, calls the AI provider with memory context.' },
                { n: '3', t: 'It learns', d: 'Q + A are embedded and written to pgvector automatically.' },
                { n: '4', t: 'Next ask', d: 'Same / similar question → cache hit. Zero AI tokens.' },
              ].map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="w-6 h-6 shrink-0 rounded-md bg-signal-900 border border-signal-600/50 text-signal-300 font-mono text-[11px] flex items-center justify-center">{s.n}</span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-mist-100">{s.t}</p>
                    <p className="text-[11.5px] text-mist-400 leading-snug">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 pt-4 border-t border-ink-700">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500 mb-1.5">Observed savings</p>
              <p className="font-display font-bold text-[26px] text-signal-300">−77.6% <span className="text-[13px] text-mist-400 font-body font-normal">provider spend after 30 days</span></p>
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="font-display font-semibold text-mist-100 mb-3">Bilingual by design</h3>
            <p className="text-[12px] text-mist-400 leading-relaxed">
              Multilingual embeddings match <span className="text-pulse-300 font-mono text-[11px]">"আমার অর্ডার কোথায়?"</span> and
              <span className="text-pulse-300 font-mono text-[11px]"> "where is my order?"</span> to the same knowledge node. Replies mirror the user's language — বাংলা in, বাংলা out.
            </p>
          </div>
        </div>
      </div>

      {/* roadmap */}
      <div className="mt-8 anim-rise" style={{ animationDelay: '200ms' }}>
        <SectionHead title="Build Roadmap — 14 Phases" desc="Phase 10 (this control center) is live. Phases 11–14 ship next against the same schema." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {PHASES.map((p, i) => (
            <div
              key={p.n}
              className={`panel p-3.5 anim-rise transition-all hover:-translate-y-1 ${p.status === 'current' ? 'border-signal-600/60!' : ''}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-mist-500">PH {String(p.n).padStart(2, '0')}</span>
                <Badge tone={p.status === 'done' ? 'teal' : p.status === 'current' ? 'amber' : 'neutral'}>
                  {p.status === 'done' ? 'shipped' : p.status === 'current' ? 'live now' : 'queued'}
                </Badge>
              </div>
              <p className="font-display font-semibold text-[12.5px] text-mist-100 mt-2 leading-tight">{p.title}</p>
              <ul className="mt-2 space-y-1">
                {p.items.map((it) => (
                  <li key={it} className="text-[10.5px] text-mist-500 flex items-start gap-1.5">
                    <span className={`mt-[5px] w-1 h-1 rounded-full shrink-0 ${p.status === 'planned' ? 'bg-mist-600' : 'bg-pulse-400'}`} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

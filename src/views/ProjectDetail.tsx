import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import type { AIClientConfig, ClientApp, Plan } from '../lib/data';
import { DEFAULT_AI_CONFIG, PLAN_LIMITS, fmt, maskKey } from '../lib/data';
import {
  Badge, Bar, Btn, CLIENT_ICONS, CopyBtn, EmptyState, ErrorState, Field, Icon, IconBtn,
  Modal, Sparkline, StatusDot, Tabs, Toggle, useConfirm,
} from '../components/ui';
import Console from './Console';
import { ToolsView } from './ToolsProviders';
import { LogsView } from './LogsSecurity';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid' as const },
  { id: 'ai', label: 'AI Config', icon: 'sliders' as const },
  { id: 'tools', label: 'Tools', icon: 'wrench' as const },
  { id: 'users', label: 'Users', icon: 'users' as const },
  { id: 'training', label: 'Training', icon: 'book' as const },
  { id: 'console', label: 'Test Console', icon: 'terminal' as const },
  { id: 'logs', label: 'Logs', icon: 'logs' as const },
  { id: 'usage', label: 'Usage & Limits', icon: 'bolt' as const },
  { id: 'settings', label: 'Settings', icon: 'shield' as const },
];

function InfoBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 mb-4 p-3 rounded-lg bg-cobalt-900/50 border border-cobalt-500/30 anim-fade">
      <Icon name="info" size={14} className="text-cobalt-300 shrink-0 mt-0.5" />
      <p className="text-[12px] text-cobalt-300/90 leading-relaxed">{text}</p>
    </div>
  );
}

/* ── Overview ─────────────────────────────────────── */
function OverviewTab({ client, goto }: { client: ClientApp; goto: (t: string) => void }) {
  const { state } = useStore();
  const kb = state.knowledge.filter((k) => k.clientId === client.id || !k.clientId);
  const users = state.users.filter((u) => u.clientId === client.id);
  const saved = kb.reduce((s, k) => s + k.savedTokens, 0);
  const ai = client.aiConfig ?? DEFAULT_AI_CONFIG;
  const provider = state.providers.find((p) => p.id === ai.provider);

  const stats = [
    { l: 'Requests today', v: fmt(client.requests), i: 'pulse' as const, c: 'var(--color-pulse-400)' },
    { l: 'End users', v: fmt(client.users || users.length), i: 'users' as const, c: 'var(--color-cobalt-400)' },
    { l: 'Training rules', v: String(kb.length), i: 'book' as const, c: 'var(--color-signal-400)' },
    { l: 'Tokens saved', v: fmt(saved), i: 'spark' as const, c: 'var(--color-pulse-300)' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {stats.map((s, i) => (
          <div key={s.l} className="panel p-4 anim-rise" style={{ animationDelay: `${i * 50}ms` }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500 flex items-center gap-1.5">
              <span style={{ color: s.c }}><Icon name={s.i} size={12} /></span>{s.l}
            </p>
            <p className="font-display font-bold text-[24px] text-mist-100 mt-1.5 tabular-nums">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="panel p-4 lg:col-span-2 anim-rise" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold text-[14px] text-mist-100">Gateway traffic</h3>
            <Badge tone="teal">live</Badge>
          </div>
          <div className="overflow-hidden">
            <Sparkline data={state.metrics.seriesReq} w={560} h={110} animate />
          </div>
          <p className="font-mono text-[10px] text-mist-600 mt-1">requests / interval — this project shares the platform gateway</p>
        </div>

        <div className="space-y-3">
          <div className="panel p-4 anim-rise" style={{ animationDelay: '180ms' }}>
            <h3 className="font-display font-semibold text-[14px] text-mist-100 mb-3">AI routing</h3>
            <div className="space-y-2 text-[12.5px]">
              <div className="flex justify-between"><span className="text-mist-500">Provider</span><span className="text-mist-200 font-medium">{provider?.name ?? ai.provider}</span></div>
              <div className="flex justify-between"><span className="text-mist-500">Model</span><code className="font-mono text-[11.5px] text-pulse-300">{ai.model}</code></div>
              <div className="flex justify-between"><span className="text-mist-500">Temperature</span><span className="text-mist-200">{ai.temperature.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-mist-500">Rate limit</span><span className="text-mist-200">{client.rateLimitPerMin ?? 60}/min</span></div>
            </div>
            <Btn size="sm" className="w-full mt-3" onClick={() => goto('ai')}><Icon name="sliders" size={13} /> Edit AI config</Btn>
          </div>
          <div className="panel p-4 anim-rise" style={{ animationDelay: '240ms' }}>
            <h3 className="font-display font-semibold text-[14px] text-mist-100 mb-2">Recently learned</h3>
            {kb.filter((k) => k.source === 'ai-learned').slice(0, 3).map((k) => (
              <p key={k.id} className="text-[12px] text-mist-400 truncate py-1 border-b border-ink-700/60 last:border-0">“{k.question}”</p>
            ))}
            {kb.filter((k) => k.source === 'ai-learned').length === 0 && (
              <p className="text-[12px] text-mist-500">No learned entries yet — ask something new in the Test Console.</p>
            )}
            <Btn size="sm" className="w-full mt-3" onClick={() => goto('training')}><Icon name="book" size={13} /> Open training</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── AI Config (manual, per project) ──────────────── */
function AiTab({ client }: { client: ClientApp }) {
  const { state, actions } = useStore();
  const { push } = useToast();
  const saved = client.aiConfig ?? DEFAULT_AI_CONFIG;
  const [form, setForm] = useState<AIClientConfig>({ ...saved });
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const enabled = state.providers.filter((p) => p.enabled);
  const provider = state.providers.find((p) => p.id === form.provider);

  return (
    <div className="grid lg:grid-cols-3 gap-3 items-start">
      <div className="panel p-5 lg:col-span-2 anim-rise">
        <h3 className="font-display font-semibold text-[15px] text-mist-100 mb-1">Model routing</h3>
        <p className="text-[12px] text-mist-500 mb-4">Applied only to this project. Nothing changes until you press Save.</p>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Provider">
            <select className="field" value={form.provider} onChange={(e) => {
              const p = state.providers.find((x) => x.id === e.target.value);
              setForm({ ...form, provider: p?.id ?? form.provider, model: p?.models[0] ?? form.model });
            }}>
              {enabled.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              {enabled.length === 0 && <option value={form.provider}>{form.provider} (disabled — enable in AI Providers)</option>}
            </select>
          </Field>
          <Field label="Model">
            <select className="field" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
              {(provider?.models ?? [form.model]).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        </div>
        <Field label={`Temperature — ${form.temperature.toFixed(2)}`}>
          <input
            type="range" min={0} max={1} step={0.05} value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: +e.target.value })}
            className="w-full accent-[var(--color-signal-400)]"
          />
        </Field>
        <Field label="Max tokens">
          <input type="number" className="field" min={64} max={8192} value={form.maxTokens}
            onChange={(e) => setForm({ ...form, maxTokens: Math.max(64, +e.target.value || 64) })} />
        </Field>
        <Field label="System instruction (project-specific)">
          <textarea className="field text-[13px]!" rows={4} value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            placeholder="e.g. You are ShopNex's support agent. Answer in the customer's language…" />
        </Field>
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 px-5 py-3 border-t border-ink-700 bg-ink-800/95 backdrop-blur flex items-center justify-between rounded-b-[10px]">
          <span className="font-mono text-[10.5px] text-mist-500">{dirty ? 'unsaved changes' : 'in sync with server'}</span>
          <div className="flex gap-2">
            <Btn size="sm" disabled={!dirty} onClick={() => setForm({ ...saved })}>Discard</Btn>
            <Btn size="sm" variant="primary" disabled={!dirty} onClick={() => {
              actions.updateClient(client.id, { aiConfig: form });
              push(`AI config saved for ${client.name}`);
            }}>
              <Icon name="check" size={13} /> Save config
            </Btn>
          </div>
        </div>
      </div>

      <div className="panel p-5 anim-rise" style={{ animationDelay: '120ms' }}>
        <h3 className="font-display font-semibold text-[14px] text-mist-100 mb-1">Fallback chain</h3>
        <p className="text-[12px] text-mist-500 mb-3">Global order — managed in AI Providers.</p>
        <div className="space-y-2">
          {state.providers.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${p.enabled ? 'border-ink-600 bg-ink-900/50' : 'border-ink-700 opacity-50'}`}>
              <span className="font-mono text-[10px] text-mist-600 w-4">{i + 1}</span>
              <span className="text-[12.5px] text-mist-200 grow">{p.name}</span>
              <StatusDot tone={p.enabled ? (p.status === 'healthy' ? 'green' : 'amber') : 'gray'} />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-mist-500 mt-3 leading-relaxed">
          If the chosen provider fails mid-request, the gateway walks this chain automatically.
        </p>
      </div>
    </div>
  );
}

/* ── Training (per-project knowledge) ─────────────── */
function TrainingTab({ client }: { client: ClientApp }) {
  const { state, actions } = useStore();
  const { push } = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ question: '', answer: '', category: 'general', language: 'en' as 'en' | 'bn' | 'mixed' });

  const entries = useMemo(() => state.knowledge.filter((k) => k.clientId === client.id || !k.clientId), [state.knowledge, client.id]);
  const cats = useMemo(() => ['all', ...Array.from(new Set(entries.map((e) => e.category)))], [entries]);
  const filtered = entries.filter((e) =>
    (cat === 'all' || e.category === cat) &&
    (!q.trim() || e.question.toLowerCase().includes(q.toLowerCase()) || e.answer.toLowerCase().includes(q.toLowerCase())),
  );

  const save = () => {
    if (form.question.trim().length < 3 || !form.answer.trim()) return;
    if (modal === 'create') {
      actions.addKnowledge({ ...form, active: true, source: 'training', clientId: client.id });
      push('Training rule added & embedded');
    } else if (editId) {
      actions.updateKnowledge(editId, { ...form });
      push('Training rule updated — vector re-indexed');
    }
    setModal(null); setEditId(null); setForm({ question: '', answer: '', category: 'general', language: 'en' });
  };

  const del = async (id: string) => {
    const ok = await confirm({ title: 'Delete training rule?', message: 'The vector is removed from the index immediately. Cached answers for similar questions stop working.', confirmLabel: 'Delete rule', tone: 'danger' });
    if (ok) { actions.removeKnowledge(id); push('Training rule deleted'); }
  };

  return (
    <div className="panel anim-rise">
      <div className="flex flex-col sm:flex-row gap-2.5 p-4 border-b border-ink-700">
        <div className="relative sm:w-72">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
          <input className="field pl-9!" placeholder="Search rules…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap grow">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-2.5 py-1.5 rounded-lg text-[11.5px] border transition-colors ${cat === c ? 'bg-signal-900 text-signal-300 border-signal-600/50' : 'border-ink-600 text-mist-400 hover:text-mist-200'}`}>
              {c}
            </button>
          ))}
        </div>
        <Btn variant="primary" size="sm" className="shrink-0 self-start sm:self-auto" onClick={() => { setModal('create'); setForm({ question: '', answer: '', category: 'general', language: 'en' }); }}>
          <Icon name="plus" size={13} /> Add rule
        </Btn>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="book" title={entries.length === 0 ? 'No training rules yet' : 'No match'} desc={entries.length === 0 ? 'Add curated answers the agent should always give — or let it learn from the Test Console.' : 'Try a different search or category.'} action={entries.length === 0 ? <Btn variant="primary" onClick={() => setModal('create')}><Icon name="plus" size={13} /> Add rule</Btn> : undefined} />
      ) : (
        <div className="divide-y divide-ink-700 max-h-[520px] overflow-y-auto feed-scroll">
          {filtered.map((e) => (
            <div key={e.id} className="px-4 py-3 hover:bg-ink-750/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="min-w-0 grow">
                  <p className="text-[13.5px] text-mist-100 font-medium leading-snug">{e.question}</p>
                  <p className="text-[12px] text-mist-400 mt-1 leading-relaxed">{e.answer.length > 160 ? e.answer.slice(0, 160) + '…' : e.answer}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Badge tone="amber">{e.category}</Badge>
                    <Badge tone="blue">{e.language}</Badge>
                    <Badge tone={e.source === 'ai-learned' ? 'teal' : 'neutral'}>{e.source}</Badge>
                    <span className="font-mono text-[10px] text-mist-600">{fmt(e.hits)} hits · {fmt(e.savedTokens)} tok saved</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Toggle on={e.active} onChange={() => { actions.updateKnowledge(e.id, { active: !e.active }); push(e.active ? 'Rule paused' : 'Rule activated'); }} />
                  <IconBtn icon="edit" title="Edit rule" onClick={() => { setEditId(e.id); setForm({ question: e.question, answer: e.answer, category: e.category, language: e.language }); setModal('edit'); }} />
                  <IconBtn icon="trash" danger title="Delete rule" onClick={() => del(e.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Edit training rule' : 'Add training rule'}
        footer={<><Btn onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" onClick={save}><Icon name="check" size={13} /> Save rule</Btn></>}
      >
        <Field label="Trigger question (বাংলা or English)">
          <input className="field" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. ডেলিভারি চার্জ কত?" autoFocus />
        </Field>
        <Field label="Answer">
          <textarea className="field text-[13px]!" rows={4} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <input className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Language">
            <select className="field" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as 'en' | 'bn' | 'mixed' })}>
              <option value="en">English</option><option value="bn">বাংলা</option><option value="mixed">Mixed</option>
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ── Users ────────────────────────────────────────── */
function UsersTab({ client }: { client: ClientApp }) {
  const { state, actions } = useStore();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', plan: 'free' as Plan });
  const users = state.users.filter((u) => u.clientId === client.id);

  const usage = (used: number, limit: number) => limit < 0 ? 0 : Math.min(100, (used / limit) * 100);

  return (
    <div className="panel anim-rise">
      <div className="flex items-center justify-between p-4 border-b border-ink-700">
        <p className="text-[12.5px] text-mist-400">{users.length} end-user{users.length === 1 ? '' : 's'} · token ledger per user</p>
        <Btn variant="primary" size="sm" onClick={() => setOpen(true)}><Icon name="plus" size={13} /> Add user</Btn>
      </div>
      {users.length === 0 ? (
        <EmptyState icon="users" title="No users yet" desc="End-users are created automatically on first contact — or add one manually to preset a plan." />
      ) : (
        <div className="overflow-x-auto feed-scroll">
          <table className="w-full">
            <thead><tr>
              <th className="th">User</th><th className="th">Plan</th><th className="th">Daily usage</th><th className="th">Monthly usage</th><th className="th">Status</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {users.map((u) => {
                const lim = PLAN_LIMITS[u.plan];
                return (
                  <tr key={u.id} className="hover:bg-ink-750/40 transition-colors">
                    <td className="td">
                      <p className="text-mist-100 font-medium">{u.name}</p>
                      <p className="font-mono text-[10.5px] text-mist-600">{u.email}</p>
                    </td>
                    <td className="td">
                      <select className="field py-1.5! text-[12px]! w-[110px]" value={u.plan} onChange={(e) => { actions.setPlan(u.id, e.target.value as Plan); push(`${u.name} → ${e.target.value}`); }}>
                        <option value="free">Free</option><option value="trial">Trial</option><option value="unlimited">Unlimited</option>
                      </select>
                    </td>
                    <td className="td min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <div className="w-24"><Bar value={usage(u.dailyUsed, lim.daily)} tone={usage(u.dailyUsed, lim.daily) > 85 ? 'red' : 'teal'} h={5} /></div>
                        <span className="font-mono text-[10.5px] text-mist-500 whitespace-nowrap">{fmt(u.dailyUsed)}{lim.daily < 0 ? ' / ∞' : ` / ${fmt(lim.daily)}`}</span>
                      </div>
                    </td>
                    <td className="td min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <div className="w-24"><Bar value={usage(u.monthlyUsed, lim.monthly)} tone="amber" h={5} /></div>
                        <span className="font-mono text-[10.5px] text-mist-500 whitespace-nowrap">{fmt(u.monthlyUsed)}{lim.monthly < 0 ? ' / ∞' : ` / ${fmt(lim.monthly)}`}</span>
                      </div>
                    </td>
                    <td className="td"><Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge></td>
                    <td className="td text-right">
                      {u.status === 'blocked' && <Btn size="sm" variant="pulse" onClick={() => { actions.resetUsage(u.id); push(`${u.name} unblocked — counters reset`); }}><Icon name="refresh" size={12} /> Unblock</Btn>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add end-user"
        footer={<><Btn onClick={() => setOpen(false)}>Cancel</Btn><Btn variant="primary" onClick={() => {
          if (form.name.trim().length < 2) return;
          actions.addUser({ ...form, clientId: client.id });
          push(`${form.name} added on ${form.plan} plan`);
          setOpen(false); setForm({ name: '', email: '', plan: 'free' });
        }}><Icon name="plus" size={13} /> Add user</Btn></>}>
        <Field label="Name"><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
        <Field label="Email"><input className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Plan">
          <select className="field" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as Plan })}>
            <option value="free">Free — 2K tok/day</option><option value="trial">Trial — 50K tok/day</option><option value="unlimited">Unlimited</option>
          </select>
        </Field>
      </Modal>
    </div>
  );
}

/* ── Usage & Limits ───────────────────────────────── */
function UsageTab({ client }: { client: ClientApp }) {
  const { state, actions } = useStore();
  const { push } = useToast();
  const current = client.rateLimitPerMin ?? 60;
  const [rpm, setRpm] = useState(current);
  const users = state.users.filter((u) => u.clientId === client.id);
  const blocked = users.filter((u) => u.status === 'blocked').length;

  return (
    <div className="grid lg:grid-cols-2 gap-3 items-start">
      <div className="panel p-5 anim-rise">
        <h3 className="font-display font-semibold text-[15px] text-mist-100 mb-1">Project rate limit</h3>
        <p className="text-[12px] text-mist-500 mb-4">Requests per minute accepted from this project before 429.</p>
        <Field label="Requests / minute">
          <input type="number" className="field" min={1} max={5000} value={rpm} onChange={(e) => setRpm(Math.max(1, +e.target.value || 1))} />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn disabled={rpm === current} onClick={() => setRpm(current)}>Discard</Btn>
          <Btn variant="primary" disabled={rpm === current} onClick={() => { actions.updateClient(client.id, { rateLimitPerMin: rpm }); push(`Rate limit saved — ${rpm} req/min`); }}>
            <Icon name="check" size={13} /> Save limit
          </Btn>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            { l: 'Plan defaults', v: '2K / 50K / ∞' },
            { l: 'Users blocked', v: String(blocked) },
            { l: 'Burst window', v: '10s sliding' },
          ].map((s) => (
            <div key={s.l} className="rounded-lg bg-ink-900/60 border border-ink-700 p-3 text-center">
              <p className="font-display font-semibold text-[14px] text-mist-100">{s.v}</p>
              <p className="font-mono text-[9px] uppercase tracking-widest text-mist-600 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-5 anim-rise" style={{ animationDelay: '100ms' }}>
        <h3 className="font-display font-semibold text-[15px] text-mist-100 mb-3">Token consumption by user</h3>
        {users.length === 0 && <p className="text-[12px] text-mist-500">No users yet.</p>}
        <div className="space-y-3">
          {users.map((u) => {
            const lim = PLAN_LIMITS[u.plan];
            const pct = lim.monthly < 0 ? 4 : Math.min(100, (u.monthlyUsed / lim.monthly) * 100);
            return (
              <div key={u.id}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-mist-300">{u.name}</span>
                  <span className="font-mono text-[10.5px] text-mist-500">{fmt(u.monthlyUsed)} tok{lim.monthly > 0 ? ` / ${fmt(lim.monthly)}` : ''}</span>
                </div>
                <Bar value={pct} tone={pct > 85 ? 'red' : pct > 60 ? 'amber' : 'teal'} h={7} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Settings ─────────────────────────────────────── */
function SettingsTab({ client, onDeleted }: { client: ClientApp; onDeleted: () => void }) {
  const { actions } = useStore();
  const { push } = useToast();
  const confirm = useConfirm();
  const initial = {
    name: client.name, desc: client.desc, type: client.type, env: client.env,
    allowedOrigins: client.allowedOrigins ?? '', webhookUrl: client.webhookUrl ?? '',
  };
  const [form, setForm] = useState(initial);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const [newKey, setNewKey] = useState<string | null>(null);

  const regen = async () => {
    const ok = await confirm({ title: 'Regenerate API key?', message: 'The current key is revoked immediately — every client still using it will get 401 INVALID_KEY. The new key is shown exactly once.', confirmLabel: 'Regenerate', tone: 'danger' });
    if (ok) { const k = actions.regenKey(client.id); setNewKey(k); push('API key rotated'); }
  };

  const del = async () => {
    const ok = await confirm({ title: `Delete ${client.name}?`, message: 'Project, API key, knowledge entries and user ledger are removed. This cannot be undone.', confirmLabel: 'Delete forever', tone: 'danger' });
    if (ok) { actions.removeClient(client.id); push(`${client.name} deleted`); onDeleted(); }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-3 items-start">
      <div className="panel p-5 lg:col-span-2 anim-rise">
        <h3 className="font-display font-semibold text-[15px] text-mist-100 mb-4">Project configuration</h3>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Name"><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><input className="field" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></Field>
          <Field label="Platform">
            <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ClientApp['type'] })}>
              <option value="web">Web</option><option value="mobile">Mobile</option><option value="desktop">Desktop</option><option value="iot">IoT</option>
            </select>
          </Field>
          <Field label="Environment">
            <select className="field" value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })}>
              <option value="production">production</option><option value="staging">staging</option><option value="sandbox">sandbox</option>
            </select>
          </Field>
        </div>
        <Field label="Allowed origins (one per line)" hint="CORS allowlist enforced by the gateway.">
          <textarea className="field font-mono text-[11.5px]!" rows={3} value={form.allowedOrigins} onChange={(e) => setForm({ ...form, allowedOrigins: e.target.value })} placeholder="https://shop.example.com" />
        </Field>
        <Field label="Webhook URL (client-tool callbacks)">
          <input className="field font-mono text-[11.5px]!" value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} placeholder="https://api.example.com/hooks/agent" />
        </Field>
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 px-5 py-3 border-t border-ink-700 bg-ink-800/95 backdrop-blur flex items-center justify-between rounded-b-[10px]">
          <span className="font-mono text-[10.5px] text-mist-500">{dirty ? 'unsaved changes' : 'in sync'}</span>
          <div className="flex gap-2">
            <Btn size="sm" disabled={!dirty} onClick={() => setForm(initial)}>Discard</Btn>
            <Btn size="sm" variant="primary" disabled={!dirty || form.name.trim().length < 2} onClick={() => { actions.updateClient(client.id, { ...form }); push('Project settings saved'); }}>
              <Icon name="check" size={13} /> Save settings
            </Btn>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="panel p-5 anim-rise" style={{ animationDelay: '100ms' }}>
          <h3 className="font-display font-semibold text-[14px] text-mist-100 mb-2">Lifecycle</h3>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[12.5px] text-mist-300">Suspended</p>
              <p className="text-[11px] text-mist-500">All ingest returns 403 SUSPENDED</p>
            </div>
            <Toggle on={client.status === 'suspended'} onChange={() => { actions.updateClient(client.id, { status: client.status === 'active' ? 'suspended' : 'active' }); push(client.status === 'active' ? 'Project suspended' : 'Project reactivated'); }} />
          </div>
          <Btn className="w-full mt-2" onClick={regen}><Icon name="refresh" size={13} /> Regenerate API key</Btn>
        </div>
        <div className="panel p-5 border-alarm-500/30! anim-rise" style={{ animationDelay: '160ms' }}>
          <h3 className="font-display font-semibold text-[14px] text-alarm-400 mb-2">Danger zone</h3>
          <p className="text-[11.5px] text-mist-500 mb-3 leading-relaxed">Deleting the project revokes its key and purges knowledge + users.</p>
          <Btn variant="danger" className="w-full" onClick={del}><Icon name="trash" size={13} /> Delete project</Btn>
        </div>
      </div>

      <Modal open={newKey !== null} onClose={() => setNewKey(null)} title="New API key — shown once" width={520}
        footer={<Btn variant="primary" onClick={() => setNewKey(null)}><Icon name="check" size={13} /> I have copied it</Btn>}>
        <p className="text-[12px] text-mist-400 mb-3">Store it now. Only the SHA-256 hash is kept on the server — this exact string will never be shown again.</p>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-ink-950 border border-ink-600">
          <code className="font-mono text-[12px] text-pulse-300 break-all grow">{newKey}</code>
          {newKey && <CopyBtn text={newKey} />}
        </div>
      </Modal>
    </div>
  );
}

/* ── page ─────────────────────────────────────────── */
export default function ProjectDetail({ projectId, onBack, onDeleted }: {
  projectId: string; onBack: () => void; onDeleted: () => void;
}) {
  const { state } = useStore();
  const [tab, setTab] = useState('overview');
  const client = state.clients.find((c) => c.id === projectId);

  if (!client) {
    return (
      <div className="panel">
        <ErrorState
          title="Project not found"
          desc="This project may have been deleted. Its API key is revoked and all client calls now receive 403 ACCESS_DENIED."
          actionLabel="Back to Projects"
          onAction={onBack}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4 anim-rise">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12.5px] text-mist-400 hover:text-pulse-300 transition-colors">
          <Icon name="right" size={13} className="rotate-180" /> Projects
        </button>
        <span className="text-mist-600">/</span>
        <div className="w-9 h-9 rounded-lg bg-ink-750 border border-ink-600 flex items-center justify-center text-signal-400">
          <Icon name={CLIENT_ICONS[client.type] ?? 'globe'} size={17} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-[19px] text-mist-100 truncate">{client.name}</h2>
            <StatusDot tone={client.status === 'active' ? 'green' : 'red'} pulse={client.status === 'active'} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge tone="blue">{client.type}</Badge>
            <Badge tone={client.env === 'production' ? 'teal' : 'amber'}>{client.env}</Badge>
            <span className="font-mono text-[10.5px] text-mist-500">id {client.id.slice(0, 8)}…</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <code className="hidden md:block font-mono text-[10.5px] text-mist-500">{maskKey(client.apiKey)}</code>
          <CopyBtn text={client.apiKey} label="Key" />
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'overview' && <OverviewTab client={client} goto={setTab} />}
        {tab === 'ai' && <AiTab key={client.id} client={client} />}
        {tab === 'tools' && (
          <>
            <InfoBanner text="Tools run on the backend server. The registry is shared by all projects — client-type tools are dispatched to the connected app over WebSocket." />
            <ToolsView />
          </>
        )}
        {tab === 'users' && <UsersTab client={client} />}
        {tab === 'training' && <TrainingTab client={client} />}
        {tab === 'console' && (
          <>
            <InfoBanner text={`Simulated ingest for this project · X-Client-Id ${client.id.slice(0, 8)}… · X-API-Key ••••${client.apiKey.slice(-4)}`} />
            <Console />
          </>
        )}
        {tab === 'logs' && (
          <>
            <InfoBanner text="Aggregated runtime logs for the whole gateway — filter by source (knowledge, ws.gateway, provider, tool…)." />
            <LogsView />
          </>
        )}
        {tab === 'usage' && <UsageTab key={client.id} client={client} />}
        {tab === 'settings' && <SettingsTab key={client.id} client={client} onDeleted={onDeleted} />}
      </div>
    </div>
  );
}

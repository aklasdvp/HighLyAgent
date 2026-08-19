import { useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import type { ProviderCfg, Tool } from '../lib/data';
import { fmt } from '../lib/data';
import { Badge, Btn, EmptyState, Field, Icon, IconBtn, Modal, SectionHead, StatusDot, Toggle } from '../components/ui';

/* ============================ TOOLS ============================ */

const emptyTool = { name: '', description: '', type: 'server' as Tool['type'], schema: '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}' };

export function ToolsView() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyTool);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Tool | null>(null);

  const submit = () => {
    if (!form.name.trim()) { setErr('Tool name is required (e.g. invoice.fetch)'); return; }
    if (!/^[a-z0-9_.]+$/i.test(form.name.trim())) { setErr('Use snake.case names — letters, digits, dot, underscore'); return; }
    try {
      JSON.parse(form.schema);
    } catch {
      setErr('Schema is not valid JSON — fix it before registering');
      return;
    }
    actions.addTool({ name: form.name.trim(), description: form.description.trim(), type: form.type, schema: form.schema, enabled: true });
    push(`${form.name.trim()} registered — schema valid`);
    setOpen(false); setForm(emptyTool); setErr('');
  };

  return (
    <div>
      <SectionHead
        title="Tool Runtime"
        desc="Tools the agent can invoke while reasoning. Server tools run here; client tools are dispatched to the device over WebSocket and their result is relayed back."
        right={<Btn variant="primary" onClick={() => setOpen(true)}><Icon name="plus" size={14} /> Register tool</Btn>}
      />

      {state.tools.length === 0 ? (
        <div className="panel"><EmptyState icon="wrench" title="No tools registered" desc="Register a tool with a JSON schema so the agent can call it." /></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {state.tools.map((t, i) => (
            <div key={t.id} className={`panel p-4 anim-rise transition-all hover:border-ink-500 ${!t.enabled ? 'opacity-55' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${t.type === 'server' ? 'border-pulse-600/40 text-pulse-400 bg-pulse-900/40' : 'border-cobalt-500/30 text-cobalt-400 bg-cobalt-900/40'}`}>
                    <Icon name={t.type === 'server' ? 'server' : 'chip'} size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono font-medium text-[13px] text-mist-100 truncate">{t.name}</p>
                    <Badge tone={t.type === 'server' ? 'teal' : 'blue'} className="mt-0.5">{t.type} tool</Badge>
                  </div>
                </div>
                <Toggle on={t.enabled} onChange={() => actions.toggleTool(t.id)} />
              </div>
              <p className="text-[11.5px] text-mist-400 mt-2.5 leading-snug">{t.description}</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink-700">
                <span className="font-mono text-[10.5px] text-mist-500"><span className="text-mist-200">{fmt(t.executions)}</span> runs</span>
                <span className="font-mono text-[10.5px] text-mist-500"><span className="text-mist-200">{t.avgMs ? `${t.avgMs}ms` : '—'}</span> avg</span>
                <span className="flex-1" />
                <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="font-mono text-[10px] uppercase tracking-wider text-cobalt-400 hover:text-cobalt-300 flex items-center gap-1 transition-colors">
                  schema <Icon name={expanded === t.id ? 'up' : 'down'} size={11} />
                </button>
                <IconBtn icon="trash" danger title="Delete tool" onClick={() => setConfirmDel(t)} />
              </div>
              {expanded === t.id && (
                <pre className="anim-rise mt-3 font-mono text-[10.5px] leading-relaxed text-pulse-300 bg-ink-950 border border-ink-700 rounded-lg p-3 overflow-x-auto feed-scroll">{t.schema}</pre>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Register tool" width={560}>
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label="Tool name">
            <input className="field font-mono" autoFocus value={form.name} placeholder="invoice.fetch"
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr(''); }} />
          </Field>
          <Field label="Runs on">
            <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Tool['type'] })}>
              <option value="server">server</option><option value="client">client</option>
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input className="field" value={form.description} placeholder="What the agent gains by calling this"
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="JSON schema (arguments)" hint="Validated on registration. The agent's calls are checked against it at runtime.">
          <textarea className="field font-mono text-[11.5px]!" rows={7} value={form.schema}
            onChange={(e) => { setForm({ ...form, schema: e.target.value }); setErr(''); }} />
        </Field>
        {err && <p className="mb-3 text-[11px] text-alarm-400 flex items-center gap-1"><Icon name="alert" size={11} /> {err}</p>}
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={submit}><Icon name="check" size={13} /> Validate & register</Btn>
        </div>
      </Modal>

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete tool?">
        <p className="text-[13px] text-mist-300 leading-relaxed">
          <span className="font-mono text-mist-100">{confirmDel?.name}</span> will be removed from the registry. Workflows referencing it will fail validation on next run.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={() => setConfirmDel(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { if (confirmDel) actions.removeTool(confirmDel.id); setConfirmDel(null); }}>
            <Icon name="trash" size={13} /> Delete tool
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ============================ PROVIDERS ============================ */

const ProviderDraft = (p: ProviderCfg) => ({ ...p });

export function ProvidersView() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const [drafts, setDrafts] = useState<Record<string, ProviderCfg>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [instr, setInstr] = useState(state.systemInstruction);

  const get = (p: ProviderCfg) => drafts[p.id] ?? ProviderDraft(p);
  const patch = (id: string, part: Partial<ProviderCfg>) => {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? state.providers.find((x) => x.id === id)!), ...part } }));
    setDirty((x) => ({ ...x, [id]: true }));
  };
  const save = (p: ProviderCfg) => {
    actions.saveProvider(p.id, get(p));
    setDirty((x) => ({ ...x, [p.id]: false }));
    push(`${p.name} configuration saved`);
  };

  const chain = state.providers.filter((p) => p.enabled);

  return (
    <div>
      <SectionHead
        title="AI Provider Layer"
        desc="Pluggable providers behind one abstract interface. Everything here is manual — nothing is auto-configured or silently changed."
        right={
          <Badge tone="amber">
            <Icon name="lock" size={10} /> manual config only
          </Badge>
        }
      />

      {/* fallback chain */}
      <div className="panel p-4 mb-4 anim-rise">
        <p className="field-label mb-2!">Fallback chain — order is applied top → bottom on failure</p>
        <div className="flex flex-wrap items-center gap-2">
          {state.providers.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${p.enabled ? 'border-ink-600 bg-ink-800' : 'border-ink-700 opacity-40'}`}>
                <span className="font-mono text-[10px] text-mist-500">{i + 1}</span>
                <StatusDot tone={p.enabled ? (p.status === 'healthy' ? 'green' : 'amber') : 'gray'} />
                <span className="text-[12.5px] font-medium text-mist-100">{p.name}</span>
                {p.enabled && (
                  <span className="flex items-center">
                    <IconBtn icon="up" title="Move up" onClick={() => actions.moveProvider(p.id, -1)} />
                    <IconBtn icon="down" title="Move down" onClick={() => actions.moveProvider(p.id, 1)} />
                  </span>
                )}
              </div>
              {i < state.providers.length - 1 && <Icon name="arrow" size={13} className="text-mist-600" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {state.providers.map((p, i) => {
          const d = get(p);
          return (
            <div key={p.id} className={`panel p-5 anim-rise ${!p.enabled ? 'opacity-70' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusDot tone={p.status === 'healthy' ? 'green' : p.status === 'degraded' ? 'amber' : 'red'} pulse={p.enabled && p.status === 'healthy'} />
                  <div>
                    <h3 className="font-display font-semibold text-mist-100 text-[15px]">{p.name}</h3>
                    <p className="font-mono text-[10px] text-mist-500">${p.costPer1k}/1K tokens · p50 {p.latencyMs}ms · {p.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-mist-500">{p.enabled ? 'enabled' : 'disabled'}</span>
                  <Toggle on={p.enabled} onChange={() => actions.toggleProvider(p.id)} />
                </div>
              </div>

              <div className="mt-4 space-y-3.5">
                <Field label="API key">
                  <div className="flex gap-2">
                    <input
                      className="field font-mono text-[11.5px]!"
                      type={reveal[p.id] ? 'text' : 'password'}
                      value={d.apiKey}
                      placeholder="Paste provider key…"
                      onChange={(e) => patch(p.id, { apiKey: e.target.value })}
                    />
                    <Btn size="sm" onClick={() => setReveal((r) => ({ ...r, [p.id]: !r[p.id] }))} className="px-2.5!">
                      <Icon name={reveal[p.id] ? 'eyeoff' : 'eye'} size={13} />
                    </Btn>
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Model">
                    <select className="field" value={d.model} onChange={(e) => patch(p.id, { model: e.target.value })}>
                      {d.models.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Max tokens">
                    <input className="field font-mono" type="number" value={d.maxTokens}
                      onChange={(e) => patch(p.id, { maxTokens: Math.max(64, +e.target.value || 0) })} />
                  </Field>
                </div>
                <Field label={`Temperature — ${d.temperature.toFixed(1)}`}>
                  <input
                    type="range" min={0} max={2} step={0.1} value={d.temperature}
                    onChange={(e) => patch(p.id, { temperature: +e.target.value })}
                    className="w-full accent-[var(--color-signal-400)]"
                  />
                  <div className="flex justify-between font-mono text-[9.5px] text-mist-600 mt-1">
                    <span>deterministic</span><span>creative</span>
                  </div>
                </Field>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-700">
                <span className={`font-mono text-[10.5px] ${dirty[p.id] ? 'text-signal-300' : 'text-mist-600'}`}>
                  {dirty[p.id] ? '● unsaved changes' : '✓ in sync'}
                </span>
                <Btn variant={dirty[p.id] ? 'primary' : 'ghost'} disabled={!dirty[p.id]} onClick={() => save(p)}>
                  <Icon name="check" size={13} /> Save configuration
                </Btn>
              </div>
            </div>
          );
        })}
      </div>

      {/* system instruction */}
      <div className="panel p-5 mt-4 anim-rise" style={{ animationDelay: '240ms' }}>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="font-display font-semibold text-mist-100">Global system instruction</h3>
            <p className="text-[11.5px] text-mist-500">Prepended to every AI call across all clients. Clients can layer their own on top.</p>
          </div>
          <Badge tone="blue">applied at provider call time</Badge>
        </div>
        <textarea className="field mt-3 font-body text-[13px]!" rows={4} value={instr} onChange={(e) => setInstr(e.target.value)} />
        <div className="flex justify-end mt-3">
          <Btn variant="primary" disabled={instr === state.systemInstruction} onClick={() => actions.saveSystemInstruction(instr)}>
            <Icon name="check" size={13} /> Save instruction
          </Btn>
        </div>
      </div>
    </div>
  );
}

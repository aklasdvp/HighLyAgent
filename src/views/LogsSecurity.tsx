import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import type { LogLevel } from '../lib/data';
import { timeStr, dateStr } from '../lib/data';
import { Badge, Btn, EmptyState, Field, Icon, Modal, SectionHead, StatusDot, Toggle } from '../components/ui';

/* ============================ LOGS ============================ */

const LEVEL_STYLE: Record<LogLevel, { dot: string; badge: 'teal' | 'amber' | 'red' | 'neutral' }> = {
  info: { dot: 'bg-pulse-400', badge: 'teal' },
  warn: { dot: 'bg-signal-400', badge: 'amber' },
  error: { dot: 'bg-alarm-400', badge: 'red' },
  debug: { dot: 'bg-mist-600', badge: 'neutral' },
};

export function LogsView() {
  const { state, actions } = useStore();
  const [tab, setTab] = useState<'runtime' | 'audit'>('runtime');
  const [level, setLevel] = useState<'all' | LogLevel>('all');
  const [source, setSource] = useState('all');
  const [q, setQ] = useState('');
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState(state.logs);

  const sources = useMemo(() => Array.from(new Set(state.logs.map((l) => l.source))).sort(), [state.logs]);
  const shown = paused ? frozen : state.logs;

  const filtered = shown.filter(
    (l) =>
      (level === 'all' || l.level === level) &&
      (source === 'all' || l.source === source) &&
      (!q.trim() || l.message.toLowerCase().includes(q.toLowerCase())),
  );

  const togglePause = () => {
    if (!paused) setFrozen(state.logs);
    setPaused(!paused);
  };

  return (
    <div>
      <SectionHead
        title="Logs & Monitoring"
        desc="Every request path leaves a trace — runtime telemetry on top, an immutable audit trail underneath."
        right={
          tab === 'runtime' ? (
            <>
              <Btn size="sm" variant={paused ? 'pulse' : 'ghost'} onClick={togglePause}>
                <Icon name={paused ? 'play' : 'pause'} size={12} /> {paused ? 'Resume stream' : 'Pause stream'}
              </Btn>
              <Btn size="sm" variant="danger" onClick={actions.clearLogs}><Icon name="trash" size={12} /> Clear</Btn>
            </>
          ) : (
            <Badge tone="blue">{state.audit.length} entries · append-only</Badge>
          )
        }
      />

      <div className="flex gap-1.5 mb-4">
        {(['runtime', 'audit'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-medium text-[13px] border transition-all ${tab === t ? 'bg-ink-750 border-ink-500 text-mist-100' : 'border-ink-700 text-mist-400 hover:text-mist-200'}`}>
            {t === 'runtime' ? 'Runtime logs' : 'Audit trail'}
          </button>
        ))}
      </div>

      {tab === 'runtime' ? (
        <>
          <div className="panel p-3 mb-3 flex flex-wrap items-center gap-2 anim-rise">
            <div className="relative flex-1 min-w-[200px]">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
              <input className="field pl-8! py-1.5!" placeholder="Filter messages…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="field w-[130px]! py-1.5!" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
              <option value="all">all levels</option><option value="info">info</option><option value="warn">warn</option>
              <option value="error">error</option><option value="debug">debug</option>
            </select>
            <select className="field w-[160px]! py-1.5!" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">all sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-mist-500 ml-1">
              <StatusDot tone={paused ? 'amber' : 'green'} pulse={!paused} /> {paused ? 'paused' : 'live'}
            </span>
          </div>

          <div className="panel overflow-hidden anim-rise" style={{ animationDelay: '80ms' }}>
            {filtered.length === 0 ? (
              <EmptyState icon="logs" title="No matching entries" desc="Loosen the filters, or wait for the stream to deliver new events." />
            ) : (
              <div className="max-h-[520px] overflow-y-auto feed-scroll">
                <table className="w-full">
                  <thead className="sticky top-0 bg-ink-850 z-10">
                    <tr><th className="th">Time</th><th className="th">Level</th><th className="th">Source</th><th className="th">Message</th></tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 80).map((l) => (
                      <tr key={l.id} className="hover:bg-ink-800/60 transition-colors">
                        <td className="td font-mono text-[11px] text-mist-400 whitespace-nowrap">{timeStr(l.ts)}</td>
                        <td className="td"><Badge tone={LEVEL_STYLE[l.level].badge}>{l.level}</Badge></td>
                        <td className="td font-mono text-[11px] text-cobalt-300 whitespace-nowrap">{l.source}</td>
                        <td className="td font-mono text-[11.5px] text-mist-200">{l.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="panel overflow-hidden anim-rise">
          <table className="w-full">
            <thead>
              <tr><th className="th">When</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Detail</th><th className="th">IP</th></tr>
            </thead>
            <tbody>
              {state.audit.map((a) => (
                <tr key={a.id} className="hover:bg-ink-800/60 transition-colors">
                  <td className="td font-mono text-[11px] text-mist-400 whitespace-nowrap">{dateStr(a.ts)} · {timeStr(a.ts)}</td>
                  <td className="td text-[12px] text-mist-200">{a.actor}</td>
                  <td className="td"><Badge tone={a.action.includes('DELETE') || a.action.includes('REGENERATE') || a.action.includes('SUSPEND') ? 'red' : a.action.includes('SECURITY') || a.action.includes('RBAC') ? 'amber' : 'blue'}>{a.action}</Badge></td>
                  <td className="td text-[12px] text-mist-300">{a.detail}</td>
                  <td className="td font-mono text-[11px] text-mist-500">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================ SECURITY ============================ */

export function SecurityView() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const [draft, setDraft] = useState({ ...state.security });
  const [resetOpen, setResetOpen] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(state.security);
  const permNames = Array.from(new Set(state.roles.flatMap((r) => Object.keys(r.perms))));

  const switches: { key: keyof typeof draft; label: string; desc: string; icon: 'shield' | 'lock' | 'key' | 'wifi' | 'logs' }[] = [
    { key: 'sanitize', label: 'Input sanitization', desc: 'Strip control chars, neutralize prompt-injection markers before intent analysis', icon: 'shield' },
    { key: 'csrf', label: 'CSRF protection', desc: 'Double-submit tokens on every state-changing admin route', icon: 'key' },
    { key: 'encryption', label: 'Encryption at rest', desc: 'AES-256 for stored API keys and long-term memory columns', icon: 'lock' },
    { key: 'mtls', label: 'Mutual TLS (gateway)', desc: 'Require client certificates on the WebSocket gateway', icon: 'wifi' },
    { key: 'auditLog', label: 'Audit logging', desc: 'Append-only trail for every admin and key-management action', icon: 'logs' },
  ];

  return (
    <div>
      <SectionHead
        title="Security Hardening"
        desc="Gateway-level protections applied before a request ever reaches the agent core. All changes are manual and audited."
        right={<Badge tone="amber"><Icon name="lock" size={10} /> changes are audited</Badge>}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* rate limits */}
        <div className="panel p-5 anim-rise">
          <h3 className="font-display font-semibold text-mist-100 flex items-center gap-2">
            <Icon name="sliders" size={15} className="text-signal-400" /> Rate limits
          </h3>
          <p className="text-[11.5px] text-mist-500 mt-1">Enforced per API key via Redis token bucket.</p>
          <div className="mt-4 space-y-4">
            <Field label="Requests / minute">
              <input className="field font-mono" type="number" value={draft.ratePerMin}
                onChange={(e) => setDraft({ ...draft, ratePerMin: Math.max(1, +e.target.value || 0) })} />
            </Field>
            <Field label="Burst allowance">
              <input className="field font-mono" type="number" value={draft.burst}
                onChange={(e) => setDraft({ ...draft, burst: Math.max(0, +e.target.value || 0) })} />
            </Field>
            <Field label="Default daily token budget" hint="Applied to new Free-tier users.">
              <input className="field font-mono" type="number" value={draft.dailyTokenDefault}
                onChange={(e) => setDraft({ ...draft, dailyTokenDefault: Math.max(100, +e.target.value || 0) })} />
            </Field>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-700">
            <span className={`font-mono text-[10.5px] ${dirty ? 'text-signal-300' : 'text-mist-600'}`}>{dirty ? '● unsaved' : '✓ in sync'}</span>
            <Btn variant={dirty ? 'primary' : 'ghost'} disabled={!dirty} onClick={() => { actions.saveSecurity(draft); push('Rate limits saved & audited'); }}>
              <Icon name="check" size={13} /> Save limits
            </Btn>
          </div>
        </div>

        {/* switches */}
        <div className="panel p-5 anim-rise" style={{ animationDelay: '70ms' }}>
          <h3 className="font-display font-semibold text-mist-100 flex items-center gap-2">
            <Icon name="shield" size={15} className="text-pulse-400" /> Protection layers
          </h3>
          <div className="mt-4 space-y-1.5">
            {switches.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 px-3 py-3 rounded-lg border border-ink-700 hover:border-ink-500 transition-colors">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Icon name={s.icon} size={14} className={state.security[s.key] ? 'text-pulse-400 mt-0.5' : 'text-mist-600 mt-0.5'} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-mist-100">{s.label}</p>
                    <p className="text-[10.5px] text-mist-500 leading-snug">{s.desc}</p>
                  </div>
                </div>
                <Toggle on={!!state.security[s.key]} onChange={() => actions.saveSecurity({ [s.key]: !state.security[s.key] } as never)} />
              </div>
            ))}
          </div>
        </div>

        {/* rbac */}
        <div className="panel p-5 anim-rise" style={{ animationDelay: '140ms' }}>
          <h3 className="font-display font-semibold text-mist-100 flex items-center gap-2">
            <Icon name="users" size={15} className="text-cobalt-400" /> RBAC matrix
          </h3>
          <p className="text-[11.5px] text-mist-500 mt-1">What each role can do in this control center.</p>
          <div className="mt-4 overflow-x-auto feed-scroll">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th px-2!">Permission</th>
                  {state.roles.map((r) => <th key={r.role} className="th px-2! text-center">{r.role}</th>)}
                </tr>
              </thead>
              <tbody>
                {permNames.map((p) => (
                  <tr key={p} className="hover:bg-ink-800/60 transition-colors">
                    <td className="td px-2! text-[11.5px] text-mist-300 whitespace-nowrap">{p}</td>
                    {state.roles.map((r) => (
                      <td key={r.role} className="td px-2! text-center">
                        <button
                          onClick={() => r.role !== 'Admin' && actions.toggleRole(r.role, p)}
                          disabled={r.role === 'Admin'}
                          className={`w-6 h-6 rounded-md border inline-flex items-center justify-center transition-all ${r.perms[p] ? 'bg-pulse-900 border-pulse-600/50 text-pulse-300' : 'bg-ink-900 border-ink-600 text-ink-500'} ${r.role === 'Admin' ? 'opacity-70 cursor-not-allowed' : 'hover:scale-110'}`}
                          title={r.role === 'Admin' ? 'Admin always has full access' : `Toggle for ${r.role}`}
                        >
                          <Icon name={r.perms[p] ? 'check' : 'x'} size={11} />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* danger zone */}
      <div className="panel p-5 mt-4 border-alarm-500/30! anim-rise" style={{ animationDelay: '200ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-alarm-300 flex items-center gap-2"><Icon name="alert" size={15} /> Demo data</h3>
            <p className="text-[11.5px] text-mist-500 mt-1">
              This control center runs on a fully client-side simulation of the middleware (state persists in your browser). Reset it back to the seeded snapshot.
            </p>
          </div>
          <Btn variant="danger" onClick={() => setResetOpen(true)}><Icon name="refresh" size={13} /> Reset demo data</Btn>
        </div>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset all demo data?">
        <p className="text-[13px] text-mist-300 leading-relaxed">
          Everything you've created — clients, keys, learned knowledge, settings — will be replaced with the original seeded snapshot. This mirrors a fresh deployment.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={() => setResetOpen(false)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { actions.resetAll(); setResetOpen(false); }}>
            <Icon name="refresh" size={13} /> Reset everything
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

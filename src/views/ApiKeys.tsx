import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import { dateStr, maskKey } from '../lib/data';
import {
  Badge, Btn, CLIENT_ICONS, CopyBtn, EmptyState, Icon, IconBtn, Modal, SectionHead, StatusDot, useConfirm,
} from '../components/ui';

export default function ApiKeys() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);

  const [simProject, setSimProject] = useState('');
  const [simKeyOwner, setSimKeyOwner] = useState('');
  const [simResult, setSimResult] = useState<null | { ok: boolean; detail: string }>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return state.clients.filter((c) => !s || c.name.toLowerCase().includes(s));
  }, [state.clients, q]);

  const p0 = state.clients[0];
  const p1 = state.clients[1] ?? state.clients[0];
  const simP = simProject || p0?.id || '';
  const simK = simKeyOwner || p1?.id || '';

  const runSim = () => {
    const proj = state.clients.find((c) => c.id === simP);
    const owner = state.clients.find((c) => c.id === simK);
    if (!proj || !owner) return;
    if (proj.status === 'suspended') {
      setSimResult({ ok: false, detail: `403 SUSPENDED — project “${proj.name}” exists but is suspended.` });
    } else if (owner.id === proj.id) {
      setSimResult({ ok: true, detail: `200 OK — key ••••${owner.apiKey.slice(-4)} is bound to ${proj.id.slice(0, 8)}… and matches X-Client-Id. Request accepted.` });
    } else {
      setSimResult({ ok: false, detail: `403 ACCESS_DENIED — key ••••${owner.apiKey.slice(-4)} belongs to “${owner.name}”, but X-Client-Id points to “${proj.name}”. Pairing rejected & audited.` });
    }
    actions.addLog(simK === simP || owner.id === proj.id ? 'info' : 'warn', 'auth',
      owner.id === proj.id ? `scope check ok project=${proj.name}` : `ACCESS_DENIED project=${proj.name} key-of=${owner.name}`);
  };

  const regen = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Regenerate key?',
      message: <>The previous key for “{name}” is revoked <em>immediately</em>. Clients still using it receive <span className="font-mono text-alarm-400">401 INVALID_KEY</span>.</>,
      confirmLabel: 'Regenerate',
      tone: 'danger',
    });
    if (ok) {
      const k = actions.regenKey(id);
      setNewKey({ name, key: k });
      push(`API key rotated for ${name}`);
    }
  };

  return (
    <div>
      <SectionHead
        title="API Keys"
        desc="Every key is bound to exactly one project. Client calls must send X-Client-Id + X-API-Key — the pair is verified on every request."
      />

      <div className="flex items-start gap-2.5 mb-4 p-3.5 rounded-lg bg-signal-900/50 border border-signal-600/30 anim-rise">
        <Icon name="shield" size={15} className="text-signal-300 shrink-0 mt-0.5" />
        <div className="text-[12px] text-signal-300/90 leading-relaxed">
          <span className="font-semibold">Dual-factor access rule:</span> an API key alone is never enough. The gateway compares
          <code className="font-mono mx-1 px-1.5 py-0.5 rounded bg-ink-900/70 text-signal-300">key.client_id == X-Client-Id</code>
          and rejects mismatches with <span className="font-mono">403 ACCESS_DENIED</span>. Keys are stored as SHA-256 hashes — the raw value is shown exactly once.
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-3 items-start">
        <div className="panel xl:col-span-2 anim-rise">
          <div className="p-4 border-b border-ink-700 flex items-center gap-2.5">
            <div className="relative grow max-w-xs">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
              <input className="field pl-9!" placeholder="Search by project…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <span className="font-mono text-[10.5px] text-mist-500 ml-auto">{rows.length} keys</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon="key" title="No keys" desc="Register a project first — its key is issued automatically." />
          ) : (
            <div className="overflow-x-auto feed-scroll">
              <table className="w-full">
                <thead><tr>
                  <th className="th">Project</th><th className="th">Key</th><th className="th">Env</th><th className="th">Created</th><th className="th">Status</th><th className="th text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-ink-750/40 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-md bg-ink-750 border border-ink-600 flex items-center justify-center text-signal-400 shrink-0">
                            <Icon name={CLIENT_ICONS[c.type] ?? 'globe'} size={13} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-mist-100 font-medium truncate">{c.name}</p>
                            <p className="font-mono text-[10px] text-mist-600">{c.id.slice(0, 12)}…</p>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <code className="font-mono text-[11px] text-pulse-300">{revealed[c.id] ? c.apiKey : maskKey(c.apiKey)}</code>
                      </td>
                      <td className="td"><Badge tone={c.env === 'production' ? 'teal' : 'amber'}>{c.env}</Badge></td>
                      <td className="td font-mono text-[11px] text-mist-500">{dateStr(c.createdAt)}</td>
                      <td className="td">
                        <span className="flex items-center gap-1.5">
                          <StatusDot tone={c.status === 'active' ? 'green' : 'red'} />
                          <span className="text-[11.5px] text-mist-400">{c.status}</span>
                        </span>
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn icon={revealed[c.id] ? 'eyeoff' : 'eye'} title={revealed[c.id] ? 'Hide key' : 'Reveal key'} onClick={() => setRevealed((r) => ({ ...r, [c.id]: !r[c.id] }))} />
                          <CopyBtn text={c.apiKey} />
                          <IconBtn icon="refresh" title="Regenerate key" onClick={() => regen(c.id, c.name)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* security simulator */}
        <div className="panel p-5 anim-rise" style={{ animationDelay: '120ms' }}>
          <h3 className="font-display font-semibold text-[14px] text-mist-100 flex items-center gap-2">
            <Icon name="shield" size={15} className="text-signal-400" /> Pairing simulator
          </h3>
          <p className="text-[11.5px] text-mist-500 mt-1 mb-4 leading-relaxed">
            Send any project’s key against any X-Client-Id and see exactly what the gateway decides.
          </p>
          <div className="space-y-3">
            <div>
              <label className="field-label">X-Client-Id (project)</label>
              <select className="field" value={simP} onChange={(e) => { setSimProject(e.target.value); setSimResult(null); }}>
                {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">X-API-Key (key of…)</label>
              <select className="field" value={simK} onChange={(e) => { setSimKeyOwner(e.target.value); setSimResult(null); }}>
                {state.clients.map((c) => <option key={c.id} value={c.id}>{c.name}’s key ••••{c.apiKey.slice(-4)}</option>)}
              </select>
            </div>
            <Btn variant="primary" className="w-full" onClick={runSim} disabled={state.clients.length === 0}>
              <Icon name="bolt" size={13} /> Test pairing
            </Btn>
          </div>

          {simResult && (
            <div className={`anim-pop mt-4 p-3.5 rounded-lg border ${simResult.ok ? 'bg-pulse-900/60 border-pulse-600/40' : 'bg-alarm-900/60 border-alarm-500/40'}`}>
              <p className={`font-mono text-[11px] font-semibold flex items-center gap-1.5 ${simResult.ok ? 'text-pulse-300' : 'text-alarm-300'}`}>
                <Icon name={simResult.ok ? 'check' : 'x'} size={13} />
                {simResult.ok ? '200 OK' : 'REJECTED'}
              </p>
              <p className="text-[11.5px] text-mist-300 mt-1.5 leading-relaxed">{simResult.detail}</p>
              <pre className="mt-2.5 p-2.5 rounded-md bg-ink-950 border border-ink-700 font-mono text-[10px] text-mist-400 overflow-x-auto feed-scroll leading-relaxed">
{`curl -X POST $GATEWAY/api/agent/process \\
  -H "X-Client-Id: ${simP.slice(0, 13)}…" \\
  -H "X-API-Key: hl_live_••••${(state.clients.find((c) => c.id === simK)?.apiKey ?? '').slice(-4)}" \\
  -d '{"user_ref":"u1","text":"হ্যালো"}'`}
              </pre>
            </div>
          )}
        </div>
      </div>

      <Modal open={newKey !== null} onClose={() => setNewKey(null)} title={`New key for ${newKey?.name ?? ''}`} width={520}
        footer={<Btn variant="primary" onClick={() => setNewKey(null)}><Icon name="check" size={13} /> I have copied it</Btn>}>
        <p className="text-[12px] text-mist-400 mb-3">Shown exactly once — only the SHA-256 hash is stored on the server.</p>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-ink-950 border border-ink-600">
          <code className="font-mono text-[12px] text-pulse-300 break-all grow">{newKey?.key}</code>
          {newKey && <CopyBtn text={newKey.key} />}
        </div>
      </Modal>
    </div>
  );
}

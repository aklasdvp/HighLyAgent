import { useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import type { ClientApp, ClientType } from '../lib/data';
import { dateStr, fmt, maskKey } from '../lib/data';
import { Badge, Btn, CLIENT_ICONS, CopyBtn, Field, Icon, IconBtn, Modal, SectionHead, StatusDot, Toggle } from '../components/ui';

const emptyForm = { name: '', type: 'web' as ClientType, env: 'production', desc: '' };

export default function Clients() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<ClientApp | null>(null);
  const [editing, setEditing] = useState<ClientApp | null>(null);
  const [confirmDel, setConfirmDel] = useState<ClientApp | null>(null);
  const [regenFor, setRegenFor] = useState<ClientApp | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');

  const submitCreate = () => {
    if (!form.name.trim()) { setErr('Client name is required'); return; }
    const c = actions.addClient({ ...form, name: form.name.trim() });
    setCreated(c);
    push(`${c.name} registered — API key issued`);
    setCreateOpen(false);
    setForm(emptyForm);
    setErr('');
  };

  const submitEdit = () => {
    if (!editing) return;
    actions.updateClient(editing.id, { name: editing.name, env: editing.env, desc: editing.desc, type: editing.type });
    setEditing(null);
  };

  const confirmRegen = () => {
    if (!regenFor) return;
    const k = actions.regenKey(regenFor.id);
    setCreated({ ...regenFor, apiKey: k });
    setRegenFor(null);
  };

  return (
    <div>
      <SectionHead
        title="Client Applications"
        desc="Every app that talks to the agent core. Each client gets an isolated API key, its own rate limits and a scoped knowledge namespace."
        right={<Btn variant="primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={14} /> Register client</Btn>}
      />

      <div className="panel overflow-x-auto anim-rise">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr>
              <th className="th">Client</th>
              <th className="th">API key</th>
              <th className="th">Status</th>
              <th className="th text-right">Requests</th>
              <th className="th text-right">Users</th>
              <th className="th">Created</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.clients.map((c, i) => (
              <tr key={c.id} className="hover:bg-ink-800/60 transition-colors anim-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <td className="td">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-lg border flex items-center justify-center ${c.type === 'iot' ? 'border-signal-600/40 text-signal-400 bg-signal-900/40' : 'border-cobalt-500/30 text-cobalt-400 bg-cobalt-900/40'}`}>
                      <Icon name={CLIENT_ICONS[c.type]} size={16} />
                    </span>
                    <div>
                      <p className="font-medium text-[13px] text-mist-100 flex items-center gap-2">
                        {c.name}
                        <Badge tone={c.env === 'production' ? 'teal' : c.env === 'staging' ? 'amber' : 'blue'}>{c.env}</Badge>
                      </p>
                      <p className="text-[11px] text-mist-500">{c.desc}</p>
                    </div>
                  </div>
                </td>
                <td className="td">
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-[11px] text-mist-300 bg-ink-900 border border-ink-700 rounded px-2 py-1">
                      {revealed[c.id] ? c.apiKey : maskKey(c.apiKey)}
                    </code>
                    <IconBtn icon={revealed[c.id] ? 'eyeoff' : 'eye'} title={revealed[c.id] ? 'Hide key' : 'Reveal key'} onClick={() => setRevealed((r) => ({ ...r, [c.id]: !r[c.id] }))} />
                    <CopyBtn text={c.apiKey} />
                  </div>
                </td>
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <Toggle on={c.status === 'active'} onChange={() => actions.updateClient(c.id, { status: c.status === 'active' ? 'suspended' : 'active' })} />
                    <span className={`flex items-center gap-1.5 text-[11.5px] ${c.status === 'active' ? 'text-pulse-300' : 'text-alarm-400'}`}>
                      <StatusDot tone={c.status === 'active' ? 'green' : 'red'} /> {c.status}
                    </span>
                  </div>
                </td>
                <td className="td text-right font-mono text-[12px] text-mist-200 tabular-nums">{fmt(c.requests)}</td>
                <td className="td text-right font-mono text-[12px] text-mist-200 tabular-nums">{fmt(c.users)}</td>
                <td className="td font-mono text-[11px] text-mist-400">{dateStr(c.createdAt)}</td>
                <td className="td">
                  <div className="flex items-center justify-end gap-0.5">
                    <IconBtn icon="refresh" title="Regenerate API key" onClick={() => setRegenFor(c)} />
                    <IconBtn icon="edit" title="Edit client" onClick={() => setEditing({ ...c })} />
                    <IconBtn icon="trash" title="Delete client" danger onClick={() => setConfirmDel(c)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Register new client">
        <Field label="Client name">
          <input className="field" autoFocus value={form.name} placeholder="e.g. ShopNex Web"
            onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr(''); }} />
          {err && <p className="mt-1.5 text-[11px] text-alarm-400 flex items-center gap-1"><Icon name="alert" size={11} /> {err}</p>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform type">
            <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ClientType })}>
              <option value="web">Web</option><option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option><option value="iot">IoT</option>
            </select>
          </Field>
          <Field label="Environment">
            <select className="field" value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })}>
              <option value="production">production</option><option value="staging">staging</option><option value="sandbox">sandbox</option>
            </select>
          </Field>
        </div>
        <Field label="Description" hint="Shown to operators in audit trails.">
          <textarea className="field" rows={2} value={form.desc} placeholder="What does this client do?"
            onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Btn onClick={() => setCreateOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={submitCreate}><Icon name="key" size={13} /> Create & issue key</Btn>
        </div>
      </Modal>

      {/* created / key reveal modal */}
      <Modal open={!!created} onClose={() => setCreated(null)} title="API key issued">
        <div className="rounded-lg border border-signal-600/50 bg-signal-900/30 p-4">
          <p className="flex items-center gap-2 text-[12.5px] text-signal-300 font-medium">
            <Icon name="alert" size={14} /> Store this key now — it is shown only once in full.
          </p>
          <code className="block mt-3 font-mono text-[12px] text-mist-100 bg-ink-950 border border-ink-600 rounded-lg p-3 break-all">
            {created?.apiKey}
          </code>
          <div className="mt-3 flex gap-2">
            {created && <CopyBtn text={created.apiKey} label="Copy key" />}
          </div>
        </div>
        <p className="text-[11.5px] text-mist-500 mt-3">
          Client <span className="text-mist-200 font-medium">{created?.name}</span> can now connect via <code className="font-mono text-pulse-300">wss://gateway.highlyagent.io</code> with header <code className="font-mono">X-HLA-Key</code>.
        </p>
        <div className="flex justify-end pt-3"><Btn variant="primary" onClick={() => setCreated(null)}>Done</Btn></div>
      </Modal>

      {/* edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit — ${editing?.name ?? ''}`}>
        {editing && (
          <>
            <Field label="Client name">
              <input className="field" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Platform type">
                <select className="field" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as ClientType })}>
                  <option value="web">Web</option><option value="mobile">Mobile</option>
                  <option value="desktop">Desktop</option><option value="iot">IoT</option>
                </select>
              </Field>
              <Field label="Environment">
                <select className="field" value={editing.env} onChange={(e) => setEditing({ ...editing, env: e.target.value })}>
                  <option value="production">production</option><option value="staging">staging</option><option value="sandbox">sandbox</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea className="field" rows={2} value={editing.desc} onChange={(e) => setEditing({ ...editing, desc: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Btn onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={submitEdit}><Icon name="check" size={13} /> Save changes</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* regen confirm */}
      <Modal open={!!regenFor} onClose={() => setRegenFor(null)} title="Regenerate API key?">
        <p className="text-[13px] text-mist-300 leading-relaxed">
          The current key for <span className="font-semibold text-mist-100">{regenFor?.name}</span> will be
          <span className="text-alarm-400"> revoked immediately</span>. Any deployment still using it will fail authentication until updated. This action is written to the audit trail.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={() => setRegenFor(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={confirmRegen}><Icon name="refresh" size={13} /> Revoke & regenerate</Btn>
        </div>
      </Modal>

      {/* delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete client?">
        <p className="text-[13px] text-mist-300 leading-relaxed">
          Deleting <span className="font-semibold text-mist-100">{confirmDel?.name}</span> revokes its API key, disconnects
          <span className="font-mono text-mist-100"> {fmt(confirmDel?.users ?? 0)}</span> end-users and queues its knowledge namespace for purge. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={() => setConfirmDel(null)}>Keep client</Btn>
          <Btn variant="danger" onClick={() => { if (confirmDel) actions.removeClient(confirmDel.id); setConfirmDel(null); }}>
            <Icon name="trash" size={13} /> Delete permanently
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import type { ClientType } from '../lib/data';
import { fmt, maskKey } from '../lib/data';
import {
  Badge, Btn, CLIENT_ICONS, CopyBtn, EmptyState, Field, Icon, IconBtn, Modal, SectionHead, StatusDot, useConfirm,
} from '../components/ui';

const TYPES: { id: ClientType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'Web' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'iot', label: 'IoT' },
];

export default function Projects({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, actions } = useStore();
  const { push } = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [type, setType] = useState<ClientType | 'all'>('all');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'web' as ClientType, env: 'production', desc: '' });
  const [err, setErr] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return state.clients.filter((c) =>
      (type === 'all' || c.type === type) &&
      (!s || c.name.toLowerCase().includes(s) || c.desc.toLowerCase().includes(s)),
    );
  }, [state.clients, q, type]);

  const create = () => {
    if (form.name.trim().length < 2) return setErr('Project name must be at least 2 characters.');
    const c = actions.addClient({ ...form, name: form.name.trim() });
    push(`${c.name} registered — project API key issued`);
    setOpen(false);
    setForm({ name: '', type: 'web', env: 'production', desc: '' });
    setErr('');
    onOpen(c.id);
  };

  const del = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Delete project?',
      message: <>“{name}” will be removed together with its API key, knowledge entries and user ledger. Client apps using this project will receive <span className="font-mono text-alarm-400">403 ACCESS_DENIED</span>.</>,
      confirmLabel: 'Delete project',
      tone: 'danger',
    });
    if (ok) {
      actions.removeClient(id);
      push(`${name} deleted — key revoked`);
    }
  };

  const toggleSuspend = (id: string, name: string, suspended: boolean) => {
    actions.updateClient(id, { status: suspended ? 'active' : 'suspended' });
    push(`${name} ${suspended ? 'reactivated' : 'suspended'}`);
  };

  return (
    <div>
      <SectionHead
        title="Projects"
        desc="Every client application (Web, Mobile, Desktop, IoT) connects with its own Project ID + API key pair. Nothing is created automatically."
        right={
          <Btn variant="primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={14} /> New Project
          </Btn>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative sm:w-72">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
          <input className="field pl-9!" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                type === t.id
                  ? 'bg-pulse-900 text-pulse-300 border-pulse-600/50'
                  : 'border-ink-600 text-mist-400 hover:text-mist-200 hover:border-ink-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {state.clients.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon="folder"
            title="No projects yet"
            desc="Register your first client application. HighLyAgent never creates default projects — everything is manual by design."
            action={<Btn variant="primary" onClick={() => setOpen(true)}><Icon name="plus" size={14} /> New Project</Btn>}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          <EmptyState icon="search" title="No match" desc={`Nothing matches “${q}” with the current filters.`} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c, i) => (
            <div
              key={c.id}
              className="panel p-4 anim-rise group hover:border-ink-500 transition-all hover:-translate-y-0.5 flex flex-col"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-ink-750 border border-ink-600 flex items-center justify-center text-signal-400 shrink-0">
                  <Icon name={CLIENT_ICONS[c.type] ?? 'globe'} size={19} />
                </div>
                <div className="min-w-0 grow">
                  <button onClick={() => onOpen(c.id)} className="font-display font-semibold text-[15px] text-mist-100 hover:text-pulse-300 transition-colors truncate block text-left">
                    {c.name}
                  </button>
                  <p className="text-[11.5px] text-mist-500 truncate mt-0.5">{c.desc || '—'}</p>
                </div>
                <StatusDot tone={c.status === 'active' ? 'green' : 'red'} pulse={c.status === 'active'} />
              </div>

              <div className="flex items-center gap-1.5 mt-3">
                <Badge tone="blue">{c.type}</Badge>
                <Badge tone={c.env === 'production' ? 'teal' : 'amber'}>{c.env}</Badge>
                <Badge tone={c.status === 'active' ? 'green' : 'red'}>{c.status}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                <div className="rounded-lg bg-ink-900/60 border border-ink-700 py-2">
                  <p className="font-display font-semibold text-[15px] text-mist-100 tabular-nums">{fmt(c.requests)}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-mist-600">req today</p>
                </div>
                <div className="rounded-lg bg-ink-900/60 border border-ink-700 py-2">
                  <p className="font-display font-semibold text-[15px] text-mist-100 tabular-nums">{fmt(c.users)}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-mist-600">users</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-ink-700">
                <code className="font-mono text-[10.5px] text-mist-500 truncate grow">{maskKey(c.apiKey)}</code>
                <CopyBtn text={c.apiKey} />
              </div>

              <div className="flex items-center gap-1.5 mt-3">
                <Btn variant="pulse" size="sm" className="grow" onClick={() => onOpen(c.id)}>
                  Open console <Icon name="arrow" size={12} />
                </Btn>
                <IconBtn
                  icon={c.status === 'active' ? 'pause' : 'play'}
                  title={c.status === 'active' ? 'Suspend project' : 'Reactivate project'}
                  onClick={() => toggleSuspend(c.id, c.name, c.status === 'active')}
                />
                <IconBtn icon="trash" danger title="Delete project" onClick={() => del(c.id, c.name)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register new project"
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={create}><Icon name="plus" size={13} /> Register & issue key</Btn>
          </>
        }
      >
        <Field label="Project name">
          <input className="field" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr(''); }} placeholder="e.g. ShopNex Web" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform">
            <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ClientType })}>
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option>
              <option value="iot">IoT</option>
            </select>
          </Field>
          <Field label="Environment">
            <select className="field" value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })}>
              <option value="production">production</option>
              <option value="staging">staging</option>
              <option value="sandbox">sandbox</option>
            </select>
          </Field>
        </div>
        <Field label="Description">
          <input className="field" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="What does this client do?" />
        </Field>
        {err && <p className="text-[12px] text-alarm-400 flex items-center gap-1.5"><Icon name="alert" size={13} /> {err}</p>}
        <div className="flex items-start gap-2.5 mt-2 p-3 rounded-lg bg-ink-900/70 border border-ink-700">
          <Icon name="key" size={14} className="text-signal-400 shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-mist-400 leading-relaxed">
            A project-scoped API key is generated on registration. Client calls require <span className="font-mono text-mist-300">X-Client-Id</span> + <span className="font-mono text-mist-300">X-API-Key</span> — a mismatch is rejected with 403.
          </p>
        </div>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import type { SystemConfig, Theme } from '../lib/data';
import { Badge, Btn, Field, Icon, SectionHead, Toggle, useConfirm } from '../components/ui';

export default function SystemSettings() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<SystemConfig>({ ...state.system });
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.system);

  const save = () => {
    actions.saveSystem(draft);
    push('System settings saved & audited');
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset demo data?',
      message: 'All projects, knowledge, users and logs return to the seeded state. The admin account is removed — you will run first-boot setup again.',
      confirmLabel: 'Reset everything',
      tone: 'danger',
    });
    if (ok) { actions.resetAll(); push('Workspace reset to factory state', 'warn'); }
  };

  return (
    <div>
      <SectionHead
        title="System Settings"
        desc="Gateway connection, session policy and runtime defaults. Every value is manual — nothing is auto-configured."
        right={
          <>
            <Btn disabled={!dirty} onClick={() => setDraft({ ...state.system })}>Discard</Btn>
            <Btn variant="primary" disabled={!dirty} onClick={save}><Icon name="check" size={13} /> Save settings</Btn>
          </>
        }
      />

      <div className="grid lg:grid-cols-2 gap-3 items-start">
        <div className="space-y-3">
          <div className="panel p-5 anim-rise">
            <h3 className="font-display font-semibold text-[15px] text-mist-100 mb-1 flex items-center gap-2">
              <Icon name="server" size={15} className="text-pulse-400" /> Backend connection
            </h3>
            <p className="text-[12px] text-mist-500 mb-4">The dashboard (local) talks to the agent core (your VPS) over this endpoint.</p>
            <Field label="Gateway URL (REST + WSS)">
              <input className="field font-mono text-[11.5px]!" value={draft.gatewayUrl} onChange={(e) => setDraft({ ...draft, gatewayUrl: e.target.value })} />
            </Field>
            <Field label="Local console port" hint="serve-dist.mjs binds 127.0.0.1 — never a public interface.">
              <input type="number" className="field" min={1024} max={65535} value={draft.localPort} onChange={(e) => setDraft({ ...draft, localPort: +e.target.value || 8090 })} />
            </Field>
            <div className="flex items-center gap-2 mt-2">
              <Badge tone="teal">docker compose</Badge>
              <Badge tone="blue">auto-restart</Badge>
              <Badge tone="amber">TLS required</Badge>
            </div>
          </div>

          <div className="panel p-5 anim-rise" style={{ animationDelay: '90ms' }}>
            <h3 className="font-display font-semibold text-[15px] text-mist-100 mb-1 flex items-center gap-2">
              <Icon name="lock" size={15} className="text-signal-400" /> Session & access policy
            </h3>
            <p className="text-[12px] text-mist-500 mb-4">JWT access tokens are short-lived; refresh tokens rotate on every use.</p>
            <div className="grid grid-cols-2 gap-x-4">
              <Field label="Session timeout (min)">
                <input type="number" className="field" min={5} max={480} value={draft.sessionTimeoutMin} onChange={(e) => setDraft({ ...draft, sessionTimeoutMin: Math.max(5, +e.target.value || 30) })} />
              </Field>
              <Field label="Refresh validity (days)">
                <input type="number" className="field" min={1} max={30} value={draft.refreshValidDays} onChange={(e) => setDraft({ ...draft, refreshValidDays: Math.max(1, +e.target.value || 7) })} />
              </Field>
            </div>
            <div className="flex items-center justify-between py-2.5 border-t border-ink-700">
              <div>
                <p className="text-[12.5px] text-mist-300">Auto-refresh before expiry</p>
                <p className="text-[11px] text-mist-500">Silently rotates the access token 0s before timeout</p>
              </div>
              <Toggle on={draft.autoRefreshSession} onChange={() => setDraft({ ...draft, autoRefreshSession: !draft.autoRefreshSession })} />
            </div>
            <div className="flex items-center justify-between py-2.5 border-t border-ink-700">
              <div>
                <p className="text-[12.5px] text-mist-300">Enforce project ↔ key pairing</p>
                <p className="text-[11px] text-mist-500">X-Client-Id must match the key’s project — 403 on mismatch</p>
              </div>
              <Toggle on={draft.enforceClientScope} onChange={() => setDraft({ ...draft, enforceClientScope: !draft.enforceClientScope })} />
            </div>
            <Field label="Global rate limit (req/min per project)">
              <input type="number" className="field" min={1} max={5000} value={draft.globalRatePerMin} onChange={(e) => setDraft({ ...draft, globalRatePerMin: Math.max(1, +e.target.value || 60) })} />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <div className="panel p-5 anim-rise" style={{ animationDelay: '140ms' }}>
            <h3 className="font-display font-semibold text-[15px] text-mist-100 mb-1 flex items-center gap-2">
              <Icon name="sun" size={15} className="text-signal-400" /> Appearance
            </h3>
            <p className="text-[12px] text-mist-500 mb-4">Theme applies instantly and is remembered on this machine.</p>
            <div className="grid grid-cols-2 gap-3">
              {(['dark', 'light'] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { actions.setTheme(t); push(`${t === 'dark' ? 'Dark' : 'Light'} theme applied`); }}
                  className={`p-3.5 rounded-lg border text-left transition-all ${state.theme === t ? 'border-pulse-500 bg-pulse-900/50 shadow-[0_0_0_3px_rgba(35,191,165,0.12)]' : 'border-ink-600 hover:border-ink-500'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={t === 'dark' ? 'moon' : 'sun'} size={15} className={state.theme === t ? 'text-pulse-300' : 'text-mist-500'} />
                    <span className="font-display font-semibold text-[13.5px] text-mist-100 capitalize">{t}</span>
                    {state.theme === t && <Icon name="check" size={13} className="text-pulse-300 ml-auto" />}
                  </div>
                  <div className={`h-10 rounded-md border ${t === 'dark' ? 'bg-ink-950 border-ink-600' : 'bg-[#f1f4f8] border-[#c2cedd]'}`}>
                    <div className={`m-2 h-2 w-12 rounded ${t === 'dark' ? 'bg-ink-600' : 'bg-[#c2cedd]'}`} />
                    <div className={`mx-2 h-2 w-8 rounded ${t === 'dark' ? 'bg-ink-700' : 'bg-[#dfe6ee]'}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-5 anim-rise" style={{ animationDelay: '200ms' }}>
            <h3 className="font-display font-semibold text-[15px] text-mist-100 mb-1 flex items-center gap-2">
              <Icon name="info" size={15} className="text-cobalt-300" /> Runtime
            </h3>
            <div className="space-y-2 text-[12.5px] mt-3">
              <div className="flex justify-between"><span className="text-mist-500">Console version</span><code className="font-mono text-[11.5px] text-mist-300">v2.4.1 · local build</code></div>
              <div className="flex justify-between"><span className="text-mist-500">Backend</span><code className="font-mono text-[11.5px] text-mist-300">FastAPI · uvicorn ×2 · Celery</code></div>
              <div className="flex justify-between"><span className="text-mist-500">Data plane</span><code className="font-mono text-[11.5px] text-mist-300">PostgreSQL 16 + pgvector · Redis 7</code></div>
              <div className="flex justify-between"><span className="text-mist-500">Local runner</span><code className="font-mono text-[11.5px] text-mist-300">PM2 / systemd / Electron</code></div>
            </div>
          </div>

          <div className="panel p-5 border-alarm-500/30! anim-rise" style={{ animationDelay: '260ms' }}>
            <h3 className="font-display font-semibold text-[14px] text-alarm-400 mb-2">Danger zone</h3>
            <p className="text-[11.5px] text-mist-500 mb-3 leading-relaxed">
              Wipes the local workspace (projects, knowledge, logs, admin account) and returns to first-boot setup.
            </p>
            <Btn variant="danger" onClick={reset}><Icon name="trash" size={13} /> Reset demo data</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

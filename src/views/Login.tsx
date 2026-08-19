import { useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import { Btn, Field, Icon } from '../components/ui';

function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="drop-shadow-[0_0_18px_rgba(242,169,59,0.35)]">
      <rect width="32" height="32" rx="8" fill="var(--color-ink-800)" stroke="var(--color-ink-600)" />
      <circle cx="16" cy="10" r="3.2" fill="var(--color-signal-400)" />
      <circle cx="9" cy="22" r="2.5" fill="var(--color-pulse-400)" />
      <circle cx="23" cy="22" r="2.5" fill="var(--color-pulse-400)" />
      <path d="M16 13 9.6 20M16 13l6.4 7M11.5 22h9" stroke="var(--color-signal-400)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Login() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const isSetup = !state.admin;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(0);

  const fail = (msg: string) => { setErr(msg); setShake((x) => x + 1); };

  const submitSetup = () => {
    if (username.trim().length < 3) return fail('Username must be at least 3 characters.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return fail('Enter a valid email address.');
    if (password.length < 8) return fail('Password must be at least 8 characters.');
    if (password !== confirm) return fail('Passwords do not match.');
    if (actions.setupAdmin(username, email, password)) {
      push('Admin workspace initialized — welcome to HighLyAgent');
    }
  };

  const submitLogin = () => {
    if (!identifier.trim() || !password) return fail('Enter your username/email and password.');
    if (actions.login(identifier, password)) {
      push('Signed in — session secured with JWT');
    } else {
      fail('Invalid credentials. The attempt was written to the audit log.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-6 anim-rise">
          <LogoMark />
          <h1 className="font-display font-bold text-[24px] text-mist-100 mt-3 tracking-tight">HighLyAgent</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mist-500 mt-1">
            {isSetup ? 'First boot · admin setup' : 'Admin Control Center'}
          </p>
        </div>

        <div key={shake} className={`panel p-6 anim-pop ${shake ? 'shake' : ''}`}>
          {isSetup ? (
            <>
              <div className="flex items-start gap-2.5 mb-5 p-3 rounded-lg bg-signal-900/60 border border-signal-600/30">
                <Icon name="info" size={15} className="text-signal-300 shrink-0 mt-0.5" />
                <p className="text-[12px] text-signal-300/90 leading-relaxed">
                  No admin exists yet. Create one manually — HighLyAgent never auto-provisions accounts, projects or providers.
                </p>
              </div>
              <Field label="Username">
                <input className="field" value={username} onChange={(e) => { setUsername(e.target.value); setErr(''); }} placeholder="e.g. opsadmin" autoFocus />
              </Field>
              <Field label="Email">
                <input className="field" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} placeholder="you@company.com" />
              </Field>
              <Field label="Password" hint="Minimum 8 characters — stored as a bcrypt hash on the server.">
                <input className="field" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(''); }} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submitSetup()} />
              </Field>
              <Field label="Confirm password">
                <input className="field" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr(''); }} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submitSetup()} />
              </Field>
              {err && <p className="text-[12px] text-alarm-400 mb-3 flex items-center gap-1.5"><Icon name="alert" size={13} /> {err}</p>}
              <Btn variant="primary" className="w-full" onClick={submitSetup}>
                <Icon name="shield" size={14} /> Create admin & enter console
              </Btn>
            </>
          ) : (
            <>
              <Field label="Username or email">
                <input className="field" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setErr(''); }} placeholder="opsadmin / you@company.com" autoFocus />
              </Field>
              <Field label="Password">
                <input className="field" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(''); }} placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && submitLogin()} />
              </Field>
              {err && <p className="text-[12px] text-alarm-400 mb-3 flex items-center gap-1.5"><Icon name="alert" size={13} /> {err}</p>}
              <Btn variant="primary" className="w-full" onClick={submitLogin}>
                <Icon name="lock" size={14} /> Sign in
              </Btn>
              <p className="text-[11px] text-mist-500 text-center mt-4 leading-relaxed">
                Access token {state.system.sessionTimeoutMin} min · refresh {state.system.refreshValidDays} days ·
                unauthorized access is blocked and audited.
              </p>
            </>
          )}
        </div>

        <p className="text-center font-mono text-[10.5px] text-mist-600 mt-5 anim-rise" style={{ animationDelay: '150ms' }}>
          console runs on <span className="text-mist-400">127.0.0.1:{state.system.localPort}</span> · agent core on your VPS
        </p>
      </div>
    </div>
  );
}

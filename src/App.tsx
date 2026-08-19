import { useEffect, useMemo, useRef, useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { ToastProvider, useToast } from './components/toast';
import {
  Badge, Breadcrumb, ConfirmProvider, Icon, IconBtn, PageSkeleton, StatusDot, useConfirm,
} from './components/ui';
import type { IconName } from './components/ui';
import Login from './views/Login';
import Overview from './views/Overview';
import Projects from './views/Projects';
import ProjectDetail from './views/ProjectDetail';
import { ProvidersView } from './views/ToolsProviders';
import ApiKeys from './views/ApiKeys';
import SystemSettings from './views/SystemSettings';
import { LogsView } from './views/LogsSecurity';
import Architecture from './views/Architecture';
import Backend from './views/Backend';

/* ---------------- routing ---------------- */
type Route =
  | { name: 'dashboard' }
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'providers' }
  | { name: 'keys' }
  | { name: 'settings' }
  | { name: 'logs' }
  | { name: 'architecture' }
  | { name: 'backend' };

const NAV: { section: string; items: { route: Route['name']; label: string; icon: IconName }[] }[] = [
  { section: 'Monitor', items: [
    { route: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { route: 'logs', label: 'Logs', icon: 'logs' },
  ]},
  { section: 'Build', items: [
    { route: 'projects', label: 'Projects', icon: 'folder' },
    { route: 'providers', label: 'AI Providers', icon: 'plug' },
    { route: 'keys', label: 'API Keys', icon: 'key' },
  ]},
  { section: 'Platform', items: [
    { route: 'architecture', label: 'Architecture', icon: 'layers' },
    { route: 'backend', label: 'Backend & Prod', icon: 'server' },
  ]},
  { section: 'System', items: [
    { route: 'settings', label: 'System Settings', icon: 'sliders' },
  ]},
];

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/* ---------------- sidebar ---------------- */
function SidebarContent({ route, go, onNavigate }: { route: Route; go: (r: Route) => void; onNavigate?: () => void }) {
  const { state } = useStore();
  const active = route.name === 'project' ? 'projects' : route.name;
  return (
    <div className="flex flex-col h-full">
      <button onClick={() => { go({ name: 'dashboard' }); onNavigate?.(); }} className="flex items-center gap-2.5 px-4 h-14 border-b border-ink-700 shrink-0">
        <svg width="26" height="26" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="8" fill="var(--color-ink-750)" stroke="var(--color-ink-600)" />
          <circle cx="16" cy="10" r="3" fill="var(--color-signal-400)" />
          <circle cx="9" cy="22" r="2.3" fill="var(--color-pulse-400)" />
          <circle cx="23" cy="22" r="2.3" fill="var(--color-pulse-400)" />
          <path d="M16 13 9.6 20M16 13l6.4 7M11.5 22h9" stroke="var(--color-signal-400)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div className="text-left">
          <p className="font-display font-bold text-[14.5px] text-mist-100 leading-none">HighLyAgent</p>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-mist-500 mt-1">AI Middleware</p>
        </div>
      </button>

      <nav className="grow overflow-y-auto feed-scroll py-3 px-2.5 space-y-4">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mist-600 px-2.5 mb-1.5">{group.section}</p>
            {group.items.map((it) => {
              const on = active === it.route;
              return (
                <button
                  key={it.route}
                  onClick={() => { go({ name: it.route } as Route); onNavigate?.(); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all relative ${
                    on ? 'bg-ink-750 text-mist-100 font-medium' : 'text-mist-400 hover:text-mist-200 hover:bg-ink-800'
                  }`}
                >
                  {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-signal-400" />}
                  <Icon name={it.icon} size={15} className={on ? 'text-signal-400' : ''} />
                  {it.label}
                  {it.route === 'projects' && (
                    <span className="ml-auto font-mono text-[10px] text-mist-500 bg-ink-700 rounded px-1.5 py-0.5">{state.clients.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-ink-700 shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-ink-800">
          <StatusDot tone="green" pulse />
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-mist-400 truncate">127.0.0.1:{state.system.localPort}</p>
            <p className="font-mono text-[8.5px] uppercase tracking-widest text-mist-600">local console · v2.4.1</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- shell ---------------- */
function Shell() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const confirm = useConfirm();
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const firstRender = useRef(true);

  const session = state.session;
  const theme = state.theme;

  /* theme → document */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  /* 1s ticker for the session countdown */
  useEffect(() => {
    const iv = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  /* session expiry → auto refresh / logout */
  useEffect(() => {
    if (!session) return;
    const ms = session.expiresAt - Date.now();
    const onExpire = () => {
      if (state.system.autoRefreshSession) {
        if (actions.refreshSession()) push('Session auto-refreshed via refresh token');
        else push('Refresh token expired — please sign in again', 'warn');
      } else {
        actions.logout();
        push('Session timed out — signed out', 'warn');
      }
    };
    if (ms <= 0) { onExpire(); return; }
    const t = setTimeout(onExpire, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt, session?.accessToken, state.system.autoRefreshSession]);

  /* perceived loading on route change */
  const routeKey = route.name === 'project' ? `project:${route.id}` : route.name;
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 320);
    return () => clearTimeout(t);
  }, [routeKey]);

  const go = (r: Route) => setRoute(r);

  const projectName = route.name === 'project' ? state.clients.find((c) => c.id === route.id)?.name ?? 'Project' : '';
  const crumbs = useMemo(() => {
    const home = { label: 'HighLyAgent', onClick: () => go({ name: 'dashboard' }) };
    switch (route.name) {
      case 'dashboard': return [home, { label: 'Dashboard' }];
      case 'projects': return [home, { label: 'Projects' }];
      case 'project': return [home, { label: 'Projects', onClick: () => go({ name: 'projects' }) }, { label: projectName }];
      case 'providers': return [home, { label: 'AI Providers' }];
      case 'keys': return [home, { label: 'API Keys' }];
      case 'settings': return [home, { label: 'System Settings' }];
      case 'logs': return [home, { label: 'Logs' }];
      case 'architecture': return [home, { label: 'Architecture' }];
      case 'backend': return [home, { label: 'Backend & Prod' }];
    }
  }, [route, projectName]);

  const doLogout = async () => {
    setMenu(false);
    const ok = await confirm({ title: 'Sign out?', message: 'Your access and refresh tokens are revoked. The audit log records the logout.', confirmLabel: 'Sign out', tone: 'primary' });
    if (ok) { actions.logout(); push('Signed out — tokens revoked'); }
  };

  const remaining = session ? session.expiresAt - nowTs : 0;
  const warn = remaining < 60_000;

  const view = () => {
    switch (route.name) {
      case 'dashboard': return <Overview />;
      case 'projects': return <Projects onOpen={(id) => go({ name: 'project', id })} />;
      case 'project': return <ProjectDetail projectId={route.id} onBack={() => go({ name: 'projects' })} onDeleted={() => go({ name: 'projects' })} />;
      case 'providers': return <ProvidersView />;
      case 'keys': return <ApiKeys />;
      case 'settings': return <SystemSettings />;
      case 'logs': return <LogsView />;
      case 'architecture': return <Architecture />;
      case 'backend': return <Backend />;
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 border-r border-ink-700 bg-ink-900/70 backdrop-blur sticky top-0 h-screen">
        <SidebarContent route={route} go={go} />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm anim-fade" onClick={() => setDrawer(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-ink-900 border-r border-ink-700 anim-rise">
            <SidebarContent route={route} go={go} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="grow min-w-0 flex flex-col">
        {/* topbar */}
        <header className="h-14 border-b border-ink-700 bg-ink-900/70 backdrop-blur sticky top-0 z-40 flex items-center gap-3 px-4">
          <button className="lg:hidden p-1.5 -ml-1 rounded-md text-mist-400 hover:text-mist-100 hover:bg-ink-750" onClick={() => setDrawer(true)} title="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <Breadcrumb items={crumbs} />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:flex items-center gap-1.5 font-mono text-[10.5px] text-mist-500">
              <StatusDot tone="green" pulse /> ws
            </span>
            {session && (
              <span
                title="Access token expires — auto-refreshes via refresh token"
                className={`hidden sm:flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-md border tabular-nums ${
                  warn ? 'border-signal-600/50 text-signal-300 bg-signal-900/60' : 'border-ink-600 text-mist-400'
                }`}
              >
                <Icon name="clock" size={12} />
                {fmtClock(remaining)}
                <button
                  className="hover:text-pulse-300 transition-colors"
                  title="Refresh session now"
                  onClick={() => { if (actions.refreshSession()) push('Session refreshed — new access token issued'); }}
                >
                  <Icon name="refresh" size={12} />
                </button>
              </span>
            )}
            <IconBtn icon={theme === 'dark' ? 'sun' : 'moon'} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => { actions.setTheme(theme === 'dark' ? 'light' : 'dark'); push(`${theme === 'dark' ? 'Light' : 'Dark'} theme applied`); }} />
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-signal-500 to-signal-600 text-ink-950 font-display font-bold text-[13px] flex items-center justify-center hover:scale-105 transition-transform"
                title="Account"
              >
                {(state.admin?.username ?? 'A').slice(0, 1).toUpperCase()}
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 w-56 panel rounded-lg! anim-pop overflow-hidden" style={{ boxShadow: 'var(--shadow-pop)' }}>
                    <div className="px-3.5 py-3 border-b border-ink-700">
                      <p className="text-[13px] text-mist-100 font-medium truncate">{state.admin?.username}</p>
                      <p className="font-mono text-[10.5px] text-mist-500 truncate">{state.admin?.email}</p>
                      <Badge tone="amber" className="mt-1.5">admin</Badge>
                    </div>
                    <button onClick={doLogout} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-mist-300 hover:bg-ink-750 hover:text-alarm-400 transition-colors">
                      <Icon name="logout" size={14} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* content */}
        <main className="grow px-4 sm:px-6 py-5 max-w-[1440px] w-full mx-auto">
          {loading ? <PageSkeleton /> : <div key={routeKey} className="anim-fade">{view()}</div>}
        </main>
      </div>
    </div>
  );
}

/* ---------------- root: auth gate ---------------- */
function Root() {
  const { state } = useStore();
  if (!state.admin || !state.session) return <Login />;
  return <Shell />;
}

export default function App() {
  return (
    <StoreProvider>
      <ConfirmProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </ConfirmProvider>
    </StoreProvider>
  );
}

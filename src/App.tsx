import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { ToastProvider } from './components/toast';
import { Icon, StatusDot } from './components/ui';
import type { IconName } from './components/ui';
import Overview from './views/Overview';
import Architecture from './views/Architecture';
import Console from './views/Console';
import Knowledge from './views/Knowledge';
import { ToolsView, ProvidersView } from './views/ToolsProviders';
import { UsersView, WorkflowsView } from './views/UsersWorkflows';
import Clients from './views/Clients';
import { LogsView, SecurityView } from './views/LogsSecurity';
import Backend from './views/Backend';

type Route =
  | 'overview' | 'architecture' | 'console'
  | 'knowledge' | 'tools' | 'providers' | 'workflows'
  | 'clients' | 'users' | 'backend' | 'logs' | 'security';

const NAV: { group: string; items: { id: Route; label: string; icon: IconName }[] }[] = [
  {
    group: 'Monitor',
    items: [
      { id: 'overview', label: 'Overview', icon: 'grid' },
      { id: 'architecture', label: 'Architecture', icon: 'layers' },
      { id: 'console', label: 'Test Console', icon: 'terminal' },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { id: 'knowledge', label: 'Knowledge Base', icon: 'book' },
      { id: 'tools', label: 'Tools', icon: 'wrench' },
      { id: 'providers', label: 'AI Providers', icon: 'plug' },
      { id: 'workflows', label: 'Workflows', icon: 'flow' },
    ],
  },
  {
    group: 'Platform',
    items: [
      { id: 'clients', label: 'Clients & Keys', icon: 'key' },
      { id: 'users', label: 'Users & Plans', icon: 'users' },
      { id: 'backend', label: 'Backend & Prod', icon: 'server' },
      { id: 'logs', label: 'Logs & Audit', icon: 'logs' },
      { id: 'security', label: 'Security', icon: 'shield' },
    ],
  },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hidden sm:block text-right leading-tight">
      <p className="font-mono text-[13px] text-mist-200 tabular-nums">{now.toLocaleTimeString('en-GB', { hour12: false })}</p>
      <p className="hidden md:block text-[9.5px] text-mist-600">{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
    </div>
  );
}

function Shell() {
  const { state } = useStore();
  const [route, setRoute] = useState<Route>('overview');
  const [navOpen, setNavOpen] = useState(false);

  const totalTok = state.metrics.tokensUsed + state.metrics.tokensSaved;
  const spend = totalTok ? Math.min(100, (state.metrics.tokensUsed / totalTok) * 100) : 0;
  const flat = NAV.flatMap((g) => g.items);
  const activeItem = flat.find((i) => i.id === route);

  const go = (r: Route) => { setRoute(r); setNavOpen(false); };

  const view =
    route === 'overview' ? <Overview /> :
    route === 'architecture' ? <Architecture /> :
    route === 'console' ? <Console /> :
    route === 'knowledge' ? <Knowledge /> :
    route === 'tools' ? <ToolsView /> :
    route === 'providers' ? <ProvidersView /> :
    route === 'workflows' ? <WorkflowsView /> :
    route === 'clients' ? <Clients /> :
    route === 'users' ? <UsersView /> :
    route === 'backend' ? <Backend /> :
    route === 'logs' ? <LogsView /> :
    <SecurityView />;

  return (
    <div className="min-h-screen">
      {/* mobile backdrop */}
      {navOpen && (
        <div className="fixed inset-0 z-30 bg-ink-950/75 backdrop-blur-sm lg:hidden anim-fade" onClick={() => setNavOpen(false)} />
      )}

      {/* sidebar */}
      <aside className={`feed-scroll fixed inset-y-0 left-0 z-40 w-[238px] overflow-y-auto bg-ink-900/95 backdrop-blur-md border-r border-ink-700 flex flex-col transition-transform duration-300 ease-out ${navOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* logo */}
        <button onClick={() => go('overview')} className="flex items-center gap-3 px-5 h-[62px] border-b border-ink-700 shrink-0 text-left w-full hover:bg-ink-800/50 transition-colors">
          <span className="w-8 h-8 rounded-lg bg-signal-400 flex items-center justify-center shadow-[0_0_20px_rgba(242,169,59,0.35)]">
            <Icon name="bolt" size={17} className="text-ink-950" strokeWidth={2.4} />
          </span>
          <span>
            <span className="font-display font-bold text-[16.5px] text-mist-100 leading-none block">
              HighLy<span className="text-signal-400">Agent</span>
            </span>
            <span className="font-mono text-[8.5px] tracking-[0.18em] text-mist-600 uppercase">AI Middleware OS</span>
          </span>
        </button>

        {/* nav */}
        <nav className="flex-1 px-3 py-3">
          {NAV.map((g) => (
            <div key={g.group} className="mb-4">
              <p className="px-2.5 mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-mist-600">{g.group}</p>
              {g.items.map((item) => {
                const active = route === item.id;
                return (
                  <button key={item.id} onClick={() => go(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-[9px] rounded-lg text-[13px] font-medium mb-0.5 transition-all duration-150 relative ${active ? 'bg-ink-750 text-mist-50' : 'text-mist-400 hover:text-mist-100 hover:bg-ink-800'}`}>
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-signal-400" />}
                    <Icon name={item.icon} size={15} className={active ? 'text-signal-400' : ''} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* footer */}
        <div className="px-3 pb-4 shrink-0">
          <div className="rounded-lg border border-ink-700 bg-ink-800/60 p-3">
            <div className="flex items-center gap-2">
              <StatusDot tone="green" pulse />
              <p className="font-mono text-[11px] text-mist-200">agent-core v2.4.1</p>
            </div>
            <p className="text-[10px] text-mist-600 mt-1">ap-south-1 · uptime 99.98% · ws 128</p>
          </div>
          <p className="text-center font-mono text-[9px] text-mist-700 mt-3">HighLyAgent © 2026 · self-learning</p>
        </div>
      </aside>

      {/* main column */}
      <div className="lg:pl-[238px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 h-[62px] bg-ink-950/85 backdrop-blur-md border-b border-ink-700/80 flex items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setNavOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-mist-300 hover:bg-ink-800 transition-colors" aria-label="Open navigation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-mist-600 hidden sm:block">admin control center</p>
            <h1 className="font-display font-semibold text-[15px] text-mist-100 leading-tight truncate">{activeItem?.label}</h1>
          </div>
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-pulse-600/40 bg-pulse-900/30">
              <StatusDot tone="green" pulse />
              <span className="font-mono text-[10px] text-pulse-300">wss live</span>
            </span>
            <div className="hidden lg:block w-32">
              <div className="flex justify-between font-mono text-[9px] text-mist-500 mb-1">
                <span>token burn</span>
                <span className={spend > 80 ? 'text-alarm-400' : 'text-mist-400'}>{Math.round(spend)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${spend > 80 ? 'bg-alarm-500' : spend > 55 ? 'bg-signal-400' : 'bg-pulse-500'}`} style={{ width: `${spend}%` }} />
              </div>
            </div>
            <Clock />
            <span className="w-8 h-8 rounded-full bg-ink-700 border border-ink-600 flex items-center justify-center font-display font-bold text-[11px] text-signal-300 shrink-0">AD</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-5 lg:p-7 w-full max-w-[1480px] mx-auto" key={route}>
          {view}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}

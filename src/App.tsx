import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { ToastProvider } from './components/toast';
import { fmt } from './lib/data';
import { Badge, Icon, StatusDot } from './components/ui';
import type { IconName } from './components/ui';
import Overview from './views/Overview';
import Architecture from './views/Architecture';
import Clients from './views/Clients';
import Knowledge from './views/Knowledge';
import { ProvidersView, ToolsView } from './views/ToolsProviders';
import Console from './views/Console';
import { UsersView, WorkflowsView } from './views/UsersWorkflows';
import { LogsView, SecurityView } from './views/LogsSecurity';

/* ---------------- navigation ---------------- */
type ViewId = 'overview' | 'architecture' | 'clients' | 'knowledge' | 'tools' | 'providers' | 'console' | 'users' | 'workflows' | 'logs' | 'security';

const NAV: { group: string; items: { id: ViewId; label: string; icon: IconName }[] }[] = [
  {
    group: 'Command',
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
      { id: 'logs', label: 'Logs & Audit', icon: 'logs' },
      { id: 'security', label: 'Security', icon: 'shield' },
    ],
  },
];

const TITLES: Record<ViewId, string> = {
  overview: 'Mission Control', architecture: 'System Architecture', console: 'Agent Test Console',
  knowledge: 'Knowledge Engine', tools: 'Tool Runtime', providers: 'AI Provider Layer',
  workflows: 'Workflow Engine', clients: 'Clients & API Keys', users: 'Users & Subscriptions',
  logs: 'Logs & Monitoring', security: 'Security Hardening',
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <svg width="34" height="34" viewBox="0 0 32 32">
        <rect width="32" height="32" rx="8" fill="var(--color-ink-800)" stroke="var(--color-ink-600)" />
        <path d="M9 7v18M23 7v18M9 16h14" stroke="var(--color-signal-400)" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="23" cy="9" r="3.2" fill="var(--color-pulse-400)" />
        <circle cx="9" cy="23" r="2.2" fill="var(--color-cobalt-400)" />
      </svg>
      <div>
        <p className="font-display font-bold text-[15px] text-mist-100 leading-none tracking-tight">
          HighLy<span className="text-signal-400">Agent</span>
        </p>
        <p className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-mist-500 mt-1">AI middleware</p>
      </div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="font-mono text-[11px] text-mist-400 tabular-nums hidden md:flex items-center gap-1.5">
      <Icon name="clock" size={12} className="text-mist-500" />
      {now.toLocaleTimeString('en-GB')} <span className="text-mist-600">GMT+6</span>
    </span>
  );
}

function Shell() {
  const { state } = useStore();
  const [view, setView] = useState<ViewId>('overview');
  const [drawer, setDrawer] = useState(false);

  const hitRate = (state.metrics.cacheHits / (state.metrics.cacheHits + state.metrics.aiCalls)) * 100;
  const budgetPct = Math.min(100, (state.metrics.tokensUsed / 6_000_000) * 100);

  const nav = (
    <nav className="flex-1 overflow-y-auto feed-scroll px-3 py-4 space-y-5">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-3 font-mono text-[9.5px] uppercase tracking-[0.2em] text-mist-600 mb-1.5">{g.group}</p>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = view === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => { setView(it.id); setDrawer(false); }}
                  className={`relative w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${active ? 'bg-ink-750 text-mist-100' : 'text-mist-400 hover:text-mist-100 hover:bg-ink-800'}`}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-signal-400" />}
                  <Icon name={it.icon} size={15} className={active ? 'text-signal-400' : ''} />
                  {it.label}
                  {it.id === 'console' && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pulse-400 blink" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="px-4 py-3.5 border-t border-ink-700">
      <div className="flex items-center gap-2.5">
        <StatusDot tone="green" pulse />
        <div className="flex-1">
          <p className="font-mono text-[10.5px] text-mist-300">all systems operational</p>
          <p className="font-mono text-[9px] text-mist-600">agent-core v0.9.2 · region ap-south-1</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between font-mono text-[9.5px] text-mist-500 mb-1">
          <span>monthly token budget</span><span>{budgetPct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-ink-700 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-pulse-500 to-signal-400" style={{ width: `${budgetPct}%`, transition: 'width 0.8s ease' }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[236px] bg-ink-900/90 backdrop-blur border-r border-ink-700 z-40">
        <div className="py-4 px-3 border-b border-ink-700"><Logo /></div>
        {nav}
        {footer}
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="anim-pop absolute inset-y-0 left-0 w-[260px] bg-ink-900 border-r border-ink-700 flex flex-col">
            <div className="py-4 px-3 border-b border-ink-700 flex items-center justify-between">
              <Logo />
              <button onClick={() => setDrawer(false)} className="p-2 text-mist-400 hover:text-mist-100"><Icon name="x" size={18} /></button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* main column */}
      <div className="lg:pl-[236px] flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-ink-950/80 backdrop-blur border-b border-ink-700">
          <div className="flex items-center gap-3 px-4 md:px-7 h-[54px]">
            <button className="lg:hidden p-2 -ml-2 text-mist-300 hover:text-mist-100" onClick={() => setDrawer(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-[15px] text-mist-100 truncate">{TITLES[view]}</h1>
            </div>
            <div className="flex-1" />
            <div className="hidden sm:flex items-center gap-2">
              <Badge tone="teal"><Icon name="bolt" size={9} /> hit {hitRate.toFixed(0)}%</Badge>
              <Badge tone="neutral">prod · v0.9.2</Badge>
            </div>
            <span className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-mist-400 border border-ink-700 rounded-lg px-2.5 py-1.5">
              <StatusDot tone="green" pulse /> ws · {state.metrics.connections} conn
            </span>
            <Clock />
            <div className="flex items-center gap-2 pl-2 border-l border-ink-700">
              <span className="w-7 h-7 rounded-full bg-signal-900 border border-signal-600/50 flex items-center justify-center font-display font-bold text-[10px] text-signal-300">AR</span>
              <div className="hidden xl:block leading-tight">
                <p className="text-[11.5px] font-medium text-mist-100">Arif R.</p>
                <p className="font-mono text-[9px] text-mist-500 uppercase tracking-wider">admin</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-7 py-6 w-full max-w-[1440px] mx-auto">
          <div key={view} className="anim-rise">
            {view === 'overview' && <Overview />}
            {view === 'architecture' && <Architecture />}
            {view === 'console' && <Console />}
            {view === 'knowledge' && <Knowledge />}
            {view === 'tools' && <ToolsView />}
            {view === 'providers' && <ProvidersView />}
            {view === 'workflows' && <WorkflowsView />}
            {view === 'clients' && <Clients />}
            {view === 'users' && <UsersView />}
            {view === 'logs' && <LogsView />}
            {view === 'security' && <SecurityView />}
          </div>
        </main>

        <footer className="px-7 py-4 border-t border-ink-800 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-mist-600">HighLyAgent · Universal AI Middleware — self-learning core · {fmt(state.metrics.requestsToday)} requests today</p>
          <p className="font-mono text-[10px] text-mist-600">gateway.highlyagent.io · wss + rest · ap-south-1</p>
        </footer>
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

import { useStore } from '../lib/store';
import { fmt, money, timeStr } from '../lib/data';
import { Badge, Bar, Icon, Ring, SectionHead, Sparkline, Stat, StatusDot } from '../components/ui';
import { CLIENT_ICONS } from '../components/ui';

const LEVEL_TONE: Record<string, 'teal' | 'amber' | 'red' | 'gray'> = {
  info: 'teal', warn: 'amber', error: 'red', debug: 'gray',
};

export default function Overview() {
  const { state } = useStore();
  const m = state.metrics;
  const hitRate = (m.cacheHits / (m.cacheHits + m.aiCalls)) * 100;

  const topKnowledge = [...state.knowledge].sort((a, b) => b.hits - a.hits).slice(0, 5);
  const platformAgg = (['web', 'mobile', 'desktop', 'iot'] as const).map((t) => {
    const cs = state.clients.filter((c) => c.type === t);
    return { type: t, count: cs.length, requests: cs.reduce((a, c) => a + c.requests, 0) };
  });
  const maxReq = Math.max(...platformAgg.map((p) => p.requests), 1);

  return (
    <div>
      <SectionHead
        title="Mission Control"
        desc="Live view of the agent core — every request, cache hit and AI call across all connected clients."
        right={
          <Badge tone="amber">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-400 blink" />
            self-learning active
          </Badge>
        }
      />

      {/* stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Requests today" value={fmt(m.requestsToday)} icon="pulse" color="var(--color-pulse-400)" delay={0}
          spark={<Sparkline data={m.seriesReq} w={84} h={34} />}
          sub={<span className="text-pulse-400 font-mono text-[10.5px]">▲ live stream</span>} />
        <Stat label="Cache hit rate" value={`${hitRate.toFixed(1)}%`} icon="db" color="var(--color-signal-400)" delay={50}
          spark={<Sparkline data={m.seriesHit} w={84} h={34} color="var(--color-signal-400)" />}
          sub={<span className="font-mono text-[10.5px] text-mist-500">{fmt(m.cacheHits)} hits · {fmt(m.aiCalls)} AI calls</span>} />
        <Stat label="API cost saved" value={money(m.costSaved)} icon="dollar" color="var(--color-pulse-400)" delay={100}
          sub={<span className="text-signal-300 font-mono text-[10.5px]">−{Math.round((1 - m.aiCalls / (m.aiCalls + m.cacheHits)) * 100)}% provider spend</span>} />
        <Stat label="Tokens saved" value={fmt(m.tokensSaved)} icon="spark" color="var(--color-signal-400)" delay={150}
          sub={<span className="font-mono text-[10.5px] text-mist-500">{fmt(m.tokensUsed)} used by AI</span>} />
        <Stat label="Active connections" value={m.connections} icon="wifi" color="var(--color-cobalt-400)" delay={200}
          sub={<span className="flex items-center gap-1.5"><StatusDot tone="green" pulse /><span className="font-mono text-[10.5px] text-mist-500">websocket mesh</span></span>} />
        <Stat label="Avg latency" value={`${m.avgLatency}ms`} icon="clock" color="var(--color-pulse-400)" delay={250}
          sub={<span className="font-mono text-[10.5px] text-mist-500">cache path p50</span>} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        {/* request stream */}
        <div className="panel p-5 lg:col-span-2 anim-rise" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-display font-semibold text-mist-100">Request stream</h3>
              <p className="text-[11.5px] text-mist-500">requests / tick across all clients — last 26 ticks</p>
            </div>
            <div className="flex items-center gap-4 text-[10.5px] font-mono uppercase tracking-wider text-mist-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-[3px] rounded bg-pulse-400" />requests</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-[3px] rounded bg-signal-400" />cache hits</span>
            </div>
          </div>
          <div className="relative mt-3">
            <svg viewBox="0 0 600 150" className="w-full h-[150px]" preserveAspectRatio="none">
              <defs>
                <linearGradient id="ovg1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-pulse-400)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-pulse-400)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="ovg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-signal-400)" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="var(--color-signal-400)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" x2="600" y1={150 * f} y2={150 * f} stroke="var(--color-ink-700)" strokeDasharray="3 5" />
              ))}
              {(() => {
                const norm = (arr: number[]) => {
                  const max = Math.max(...arr), min = Math.min(...arr), r = max - min || 1;
                  return arr.map((v, i) => `${((i / (arr.length - 1)) * 600).toFixed(1)},${(142 - ((v - min) / r) * 120).toFixed(1)}`);
                };
                const a = norm(m.seriesReq), b = norm(m.seriesHit);
                return (
                  <>
                    <polygon points={`0,150 ${a.join(' ')} 600,150`} fill="url(#ovg1)" />
                    <polyline points={a.join(' ')} fill="none" stroke="var(--color-pulse-400)" strokeWidth="2" className="draw-line" />
                    <polygon points={`0,150 ${b.join(' ')} 600,150`} fill="url(#ovg2)" />
                    <polyline points={b.join(' ')} fill="none" stroke="var(--color-signal-400)" strokeWidth="2" className="draw-line" />
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-ink-700">
            <div className="flex items-center gap-3">
              <Ring value={hitRate} size={64} stroke={6} label="hit" />
              <div>
                <p className="font-display font-semibold text-mist-100 text-sm">Knowledge cache</p>
                <p className="text-[11px] text-mist-500 leading-snug">repeat queries served with zero AI spend</p>
              </div>
            </div>
            <div className="col-span-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500 mb-2">Requests by platform</p>
              <div className="space-y-2">
                {platformAgg.map((p) => (
                  <div key={p.type} className="flex items-center gap-2.5">
                    <span className="text-mist-400 w-4"><Icon name={CLIENT_ICONS[p.type]} size={14} /></span>
                    <span className="font-mono text-[11px] text-mist-300 w-16 capitalize">{p.type}</span>
                    <div className="flex-1"><Bar value={(p.requests / maxReq) * 100} h={5} tone={p.type === 'iot' ? 'amber' : 'teal'} /></div>
                    <span className="font-mono text-[11px] text-mist-400 w-14 text-right tabular-nums">{fmt(p.requests)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* live feed */}
        <div className="panel anim-rise flex flex-col" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-700">
            <h3 className="font-display font-semibold text-mist-100 flex items-center gap-2">
              Live wire <StatusDot tone="green" pulse />
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-mist-500">streaming</span>
          </div>
          <div className="flex-1 overflow-y-auto feed-scroll px-2 py-2 max-h-[380px]">
            {state.logs.slice(0, 14).map((l) => (
              <div key={l.id} className="flex gap-2.5 px-3 py-2 rounded-lg hover:bg-ink-800 transition-colors anim-rise">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${l.level === 'error' ? 'bg-alarm-400' : l.level === 'warn' ? 'bg-signal-400' : l.level === 'debug' ? 'bg-mist-600' : 'bg-pulse-400'}`} />
                <div className="min-w-0">
                  <p className="font-mono text-[11.5px] text-mist-200 leading-snug break-words">{l.message}</p>
                  <p className="font-mono text-[9.5px] text-mist-600 mt-0.5">{timeStr(l.ts)} · {l.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bottom row */}
      <div className="grid lg:grid-cols-5 gap-4 mt-4">
        <div className="panel lg:col-span-3 anim-rise" style={{ animationDelay: '220ms' }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-700">
            <h3 className="font-display font-semibold text-mist-100">Most-cached knowledge</h3>
            <Badge tone="teal">top 5 by hits</Badge>
          </div>
          <table className="w-full">
            <thead>
              <tr><th className="th">Question</th><th className="th">Source</th><th className="th text-right">Hits</th><th className="th text-right">Tokens saved</th></tr>
            </thead>
            <tbody>
              {topKnowledge.map((k) => (
                <tr key={k.id} className="hover:bg-ink-800/60 transition-colors">
                  <td className="td text-[12.5px] text-mist-200 max-w-[280px] truncate">{k.question}</td>
                  <td className="td">
                    <Badge tone={k.source === 'ai-learned' ? 'amber' : k.source === 'training' ? 'blue' : 'neutral'}>
                      {k.source}
                    </Badge>
                  </td>
                  <td className="td text-right font-mono text-[12px] text-pulse-300 tabular-nums">{fmt(k.hits)}</td>
                  <td className="td text-right font-mono text-[12px] text-signal-300 tabular-nums">{fmt(k.savedTokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel lg:col-span-2 anim-rise" style={{ animationDelay: '260ms' }}>
          <div className="px-5 py-3.5 border-b border-ink-700">
            <h3 className="font-display font-semibold text-mist-100">Provider fallback chain</h3>
          </div>
          <div className="p-4 space-y-1.5">
            {state.providers.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${p.enabled ? 'border-ink-700 bg-ink-800/50 hover:border-ink-500' : 'border-transparent opacity-45'}`}>
                <span className="font-mono text-[10px] text-mist-500 w-4">{i + 1}.</span>
                <StatusDot tone={p.status === 'healthy' ? 'green' : p.status === 'degraded' ? 'amber' : 'red'} pulse={p.enabled && p.status === 'healthy'} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-mist-100">{p.name}</p>
                  <p className="font-mono text-[10px] text-mist-500">{p.model} · {p.latencyMs}ms · ${p.costPer1k}/1K tok</p>
                </div>
                <Badge tone={p.status === 'healthy' ? 'teal' : p.status === 'degraded' ? 'amber' : 'red'}>{p.status}</Badge>
              </div>
            ))}
            <p className="text-[11px] text-mist-500 px-3 pt-2 flex items-center gap-1.5">
              <Icon name="info" size={12} className="text-cobalt-400" />
              Chain order is manual — failures fall through top → bottom.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 text-center font-mono text-[10px] text-mist-600 flex items-center justify-center gap-2">
        <span className={LEVEL_TONE.info ? 'text-pulse-600' : ''}>●</span> telemetry refreshes every ~3.4s from the simulated middleware
      </div>
    </div>
  );
}

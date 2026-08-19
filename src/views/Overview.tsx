import { useStore } from '../lib/store';
import { Badge, Bar, GatewayFeed, Icon, Ring, Sparkline, Stat, StatusDot } from '../components/ui';

const LEVEL_COLOR: Record<string, string> = {
  info: 'bg-cobalt-400', warn: 'bg-signal-400', error: 'bg-alarm-400', ok: 'bg-pulse-400',
};

export default function Overview() {
  const { state } = useStore();
  const m = state.metrics;

  const msgsToday = m.requestsToday;
  const hitRate = m.requestsToday ? Math.round((m.cacheHits / m.requestsToday) * 100) : 0;
  const savingsPct = m.tokensUsed + m.tokensSaved ? Math.round((m.tokensSaved / (m.tokensUsed + m.tokensSaved)) * 100) : 0;
  const knowledgeTokens = state.knowledge.reduce((s, k) => s + k.savedTokens, 0);
  const providers = state.providers.filter((p) => p.enabled);
  const maxProv = Math.max(...providers.map((p) => p.latencyMs), 1);

  return (
    <div>
      {/* header */}
      <div className="anim-rise flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-signal-400 flex items-center gap-2">
            <Icon name="spark" size={12} /> Universal AI Middleware
          </p>
          <h1 className="font-display font-bold text-[30px] sm:text-[38px] tracking-tight text-mist-100 leading-[1.04] mt-1.5">
            Command Center
          </h1>
          <p className="text-[13px] text-mist-400 mt-2.5 max-w-2xl leading-relaxed">
            {state.clients.length} client apps connected across Web · Mobile · Desktop · IoT — the knowledge engine is
            serving <span className="text-pulse-300 font-semibold">{hitRate}%</span> of today's traffic with
            <span className="text-signal-300 font-semibold"> zero provider tokens</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="amber">phase 12 of 14</Badge>
          <Badge tone="teal">self-learning · on</Badge>
          <Badge tone="neutral">v2.4.1</Badge>
        </div>
      </div>

      {/* stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Stat label="Messages today" value={msgsToday.toLocaleString()} icon="pulse"
          sub={<span className="text-pulse-400">+12.4% vs yesterday</span>}
          spark={<Sparkline data={m.seriesReq} w={110} h={34} animate />} delay={0} />
        <Stat label="Cache hit rate" value={`${hitRate}%`} icon="db" color="var(--color-pulse-400)"
          sub={`${m.cacheHits.toLocaleString()} served from pgvector`}
          spark={<Sparkline data={m.seriesHit} w={110} h={34} color="var(--color-signal-400)" animate />} delay={60} />
        <Stat label="Tokens burned" value={`${(m.tokensUsed / 1000).toFixed(1)}k`} icon="bolt" color="var(--color-signal-400)"
          sub={`${(m.tokensSaved / 1000).toFixed(0)}k avoided by learning`}
          spark={<Sparkline data={m.seriesReq.map((v, i) => v * (0.5 + (i % 3) * 0.12))} w={110} h={34} color="var(--color-cobalt-400)" animate />} delay={120} />
        <Stat label="API cost saved" value={`$${m.costSaved.toFixed(2)}`} icon="dollar" color="var(--color-pulse-400)"
          sub={<span className="text-pulse-400">{savingsPct}% vs no-learning baseline</span>}
          spark={<Sparkline data={m.seriesHit.map((v) => v * 1.4)} w={110} h={34} color="var(--color-pulse-400)" animate />} delay={180} />
      </div>

      {/* middle row: live gateway + cost efficiency */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-4">
        <div className="xl:col-span-3 anim-rise" style={{ animationDelay: '120ms' }}>
          <GatewayFeed height={288} />
        </div>

        <div className="xl:col-span-2 panel p-5 anim-rise" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display font-semibold text-[15px] text-mist-100">Cost efficiency</h3>
            <Badge tone="teal">target ≥ 70%</Badge>
          </div>
          <p className="text-[11.5px] text-mist-500 mb-4">Provider spend eliminated by the self-learning loop</p>
          <div className="flex items-center gap-5">
            <Ring value={savingsPct} size={104} stroke={9} color="var(--color-pulse-400)" label="saved" />
            <div className="flex-1 space-y-3.5">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-mist-500">baseline tokens</span>
                  <span className="font-mono text-mist-300">{((m.tokensUsed + m.tokensSaved) / 1000).toFixed(1)}k</span>
                </div>
                <Bar value={100} tone="amber" h={5} />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-mist-500">actual burn (learned)</span>
                  <span className="font-mono text-mist-300">{(m.tokensUsed / 1000).toFixed(1)}k</span>
                </div>
                <Bar value={100 - savingsPct} tone="teal" h={5} />
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-mist-500">knowledge bank</span>
                  <span className="font-mono text-mist-300">{(knowledgeTokens / 1000).toFixed(1)}k tok</span>
                </div>
                <Bar value={Math.min(100, (knowledgeTokens / 50000) * 100)} tone="teal" h={5} />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3.5 border-t border-ink-700 flex items-center justify-between">
            <p className="text-[11.5px] text-mist-500">Projected monthly saving</p>
            <p className="font-display font-bold text-[19px] text-pulse-300">${(m.costSaved * 30).toFixed(0)}<span className="text-[11px] text-mist-500 font-body font-normal"> /mo</span></p>
          </div>
        </div>
      </div>

      {/* bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel p-5 anim-rise" style={{ animationDelay: '220ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-[14px] text-mist-100">Knowledge growth</h3>
            <Badge tone="amber">{state.knowledge.length} vectors</Badge>
          </div>
          <Sparkline data={[4, 6, 7, 11, 14, 16, 21, 24, 27, 33, 38, 41, 44, state.knowledge.length + 44]} w={290} h={84} animate />
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { l: 'ai-learned', v: state.knowledge.filter((k) => k.source === 'ai-learned').length },
              { l: 'manual', v: state.knowledge.filter((k) => k.source === 'manual').length },
              { l: 'training', v: state.knowledge.filter((k) => k.source === 'training').length },
            ].map((x) => (
              <div key={x.l} className="rounded-lg bg-ink-800/70 border border-ink-700 px-2.5 py-2 text-center">
                <p className="font-display font-bold text-[16px] text-mist-100">{x.v}</p>
                <p className="font-mono text-[8.5px] uppercase tracking-widest text-mist-600">{x.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5 anim-rise" style={{ animationDelay: '280ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-[14px] text-mist-100">Provider split</h3>
            <span className="flex items-center gap-1.5 text-[10.5px] font-mono text-mist-500"><StatusDot tone="green" /> chain healthy</span>
          </div>
          <div className="space-y-3.5">
            {providers.map((p, i) => {
              const colors = ['var(--color-signal-400)', 'var(--color-pulse-400)', 'var(--color-cobalt-400)', 'var(--color-mist-400)'];
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                    <span className="text-mist-300 flex items-center gap-1.5">
                      <StatusDot tone={p.status === 'healthy' ? 'green' : 'amber'} /> {p.name}
                    </span>
                    <span className="font-mono text-mist-500">{p.model} · {p.latencyMs}ms</span>
                  </div>
                  <div className="h-[7px] rounded-full bg-ink-700 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(12, 100 - i * 26)}%`, background: colors[i % 4], transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-mist-500 mt-4 leading-relaxed">
            Fallback order is configured manually in <span className="text-signal-300">AI Providers</span> — the chain walks top → bottom on failure.
          </p>
        </div>

        <div className="panel p-5 anim-rise" style={{ animationDelay: '340ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-[14px] text-mist-100">Recent activity</h3>
            <Badge tone="neutral">{state.audit.length} events</Badge>
          </div>
          <div className="space-y-0.5">
            {state.audit.slice(0, 8).map((a, i) => (
              <div key={a.id ?? i} className="flex items-start gap-2.5 py-[7px] border-b border-ink-700/60 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full mt-[6px] shrink-0 ${LEVEL_COLOR[a.action.includes('delete') || a.action.includes('rotate') ? 'warn' : 'info']}`} />
                <div className="min-w-0">
                  <p className="text-[11.5px] text-mist-300 leading-snug truncate">
                    <span className="font-mono text-signal-300">{a.action}</span>{a.detail ? ` — ${a.detail}` : ''}
                  </p>
                  <p className="font-mono text-[9.5px] text-mist-600 mt-0.5">{a.actor} · {a.ts} · {a.ip}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

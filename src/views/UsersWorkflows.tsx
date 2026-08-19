import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import type { Plan, Workflow } from '../lib/data';
import { PLAN_LIMITS, fmt } from '../lib/data';
import { Badge, Bar, Btn, Icon, SectionHead, Toggle } from '../components/ui';
import type { IconName } from '../components/ui';

const KIND_ICON: Record<Workflow['steps'][number]['kind'], IconName> = {
  tool: 'wrench', ai: 'spark', condition: 'flow', notify: 'send',
};
const KIND_TONE: Record<Workflow['steps'][number]['kind'], string> = {
  tool: 'border-pulse-600/50 text-pulse-300 bg-pulse-900/40',
  ai: 'border-signal-600/50 text-signal-300 bg-signal-900/40',
  condition: 'border-cobalt-500/40 text-cobalt-300 bg-cobalt-900/40',
  notify: 'border-ink-500 text-mist-300 bg-ink-750',
};

/* ============================ USERS ============================ */

export function UsersView() {
  const { state, actions } = useStore();
  const clientName = (id: string) => state.clients.find((c) => c.id === id)?.name ?? '—';

  const usagePct = (used: number, limit: number) => (limit < 0 ? 8 : Math.min(100, (used / limit) * 100));

  return (
    <div>
      <SectionHead
        title="Users & Subscriptions"
        desc="End-users across every client application. Token budgets are enforced at the gateway — when a limit is hit, the agent returns a graceful limit-exceeded response instead of calling a provider."
      />

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        {(['free', 'trial', 'unlimited'] as Plan[]).map((p, i) => {
          const l = PLAN_LIMITS[p];
          const count = state.users.filter((u) => u.plan === p).length;
          return (
            <div key={p} className="panel p-4 anim-rise hover:border-ink-500 transition-colors" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between">
                <Badge tone={p === 'unlimited' ? 'amber' : p === 'trial' ? 'blue' : 'neutral'}>{l.label}</Badge>
                <span className="font-display font-bold text-[20px] text-mist-100">{count} <span className="text-[11px] font-body font-normal text-mist-500">users</span></span>
              </div>
              <p className="font-mono text-[11px] text-mist-400 mt-3">
                {l.daily < 0 ? '∞' : fmt(l.daily)} tok/day · {l.monthly < 0 ? '∞' : fmt(l.monthly)} tok/month
              </p>
              <p className="text-[11px] text-mist-500 mt-1">{p === 'free' ? 'Agent answers + 1 tool call per turn' : p === 'trial' ? 'Full tool access, workflows enabled' : 'Dedicated throughput, priority chain'}</p>
            </div>
          );
        })}
      </div>

      <div className="panel overflow-x-auto anim-rise" style={{ animationDelay: '160ms' }}>
        <table className="w-full min-w-[820px]">
          <thead>
            <tr>
              <th className="th">User</th>
              <th className="th">Client</th>
              <th className="th">Plan</th>
              <th className="th" style={{ width: 200 }}>Daily tokens</th>
              <th className="th" style={{ width: 200 }}>Monthly tokens</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => {
              const l = PLAN_LIMITS[u.plan];
              const dPct = usagePct(u.dailyUsed, l.daily);
              const mPct = usagePct(u.monthlyUsed, l.monthly);
              const overDaily = l.daily > 0 && u.dailyUsed >= l.daily;
              return (
                <tr key={u.id} className="hover:bg-ink-800/60 transition-colors">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-ink-700 border border-ink-600 flex items-center justify-center font-display font-semibold text-[11px] text-signal-300">
                        {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </span>
                      <div>
                        <p className="text-[12.5px] font-medium text-mist-100 flex items-center gap-2">
                          {u.name}
                          {u.status === 'blocked' && <Badge tone="red">limit exceeded</Badge>}
                        </p>
                        <p className="font-mono text-[10.5px] text-mist-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td text-[12px] text-mist-300">{clientName(u.clientId)}</td>
                  <td className="td">
                    <select className="field w-[120px]! py-1.5! text-[12px]!" value={u.plan}
                      onChange={(e) => actions.setPlan(u.id, e.target.value as Plan)}>
                      <option value="free">Free</option><option value="trial">Trial</option><option value="unlimited">Unlimited</option>
                    </select>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><Bar value={dPct} h={6} tone={overDaily ? 'red' : dPct > 80 ? 'amber' : 'teal'} /></div>
                      <span className="font-mono text-[10.5px] text-mist-400 w-[92px] text-right tabular-nums">
                        {fmt(u.dailyUsed)} / {l.daily < 0 ? '∞' : fmt(l.daily)}
                      </span>
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><Bar value={mPct} h={6} tone={mPct > 80 ? 'amber' : 'teal'} /></div>
                      <span className="font-mono text-[10.5px] text-mist-400 w-[92px] text-right tabular-nums">
                        {fmt(u.monthlyUsed)} / {l.monthly < 0 ? '∞' : fmt(l.monthly)}
                      </span>
                    </div>
                  </td>
                  <td className="td text-right">
                    <Btn size="sm" variant={u.status === 'blocked' ? 'pulse' : 'subtle'} onClick={() => actions.resetUsage(u.id)}>
                      <Icon name="refresh" size={11} /> {u.status === 'blocked' ? 'Unblock & reset' : 'Reset usage'}
                    </Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================ WORKFLOWS ============================ */

export function WorkflowsView() {
  const { state, actions } = useStore();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<Record<string, number>>({});
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const simulate = (w: Workflow) => {
    if (runningId) return;
    setRunningId(w.id);
    setLiveSteps({ [w.id]: 0 });
    w.steps.forEach((_, i) => {
      timersRef.current.push(setTimeout(() => {
        setLiveSteps((s) => ({ ...s, [w.id]: i + 1 }));
        if (i === w.steps.length - 1) {
          timersRef.current.push(setTimeout(() => {
            setRunningId(null);
            actions.addLog('info', 'workflow', `${w.name} test run completed — ${w.steps.length} steps ok`);
          }, 500));
        }
      }, 650 * (i + 1)));
    });
  };

  return (
    <div>
      <SectionHead
        title="Workflow Engine"
        desc="Multi-step automations the agent triggers on intents, schedules or sensor events. Steps run as a DAG — tools, AI reasoning, conditions and notifications."
        right={<Badge tone="blue">celery-backed execution</Badge>}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {state.workflows.map((w, wi) => {
          const done = liveSteps[w.id] ?? -1;
          const isRunning = runningId === w.id;
          return (
            <div key={w.id} className={`panel p-5 anim-rise flex flex-col ${!w.active ? 'opacity-60' : ''}`} style={{ animationDelay: `${wi * 70}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold text-mist-100 text-[15px]">{w.name}</h3>
                  <p className="font-mono text-[10.5px] text-mist-500 mt-1">trigger: <span className="text-cobalt-300">{w.trigger}</span></p>
                </div>
                <Toggle on={w.active} onChange={() => actions.toggleWorkflow(w.id)} />
              </div>

              <ol className="mt-4 space-y-0 flex-1">
                {w.steps.map((s, i) => {
                  const st = !isRunning && done < 0 ? 'idle' : i < done ? 'done' : i === done ? 'run' : 'wait';
                  return (
                    <li key={s.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-300 ${KIND_TONE[s.kind]} ${st === 'run' ? 'ring-2 ring-signal-400/50 scale-110' : ''} ${st === 'wait' ? 'opacity-40' : ''}`}>
                          <Icon name={KIND_ICON[s.kind]} size={12} />
                        </span>
                        {i < w.steps.length - 1 && <span className={`w-px flex-1 my-1 ${st === 'done' ? 'bg-pulse-500' : 'bg-ink-600'}`} style={{ minHeight: 14 }} />}
                      </div>
                      <div className="pb-4">
                        <p className={`font-mono text-[11.5px] ${st === 'run' ? 'text-signal-300' : st === 'wait' ? 'text-mist-500' : 'text-mist-200'}`}>{s.label}</p>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-mist-600">{s.kind}{st === 'run' ? ' · running' : st === 'done' ? ' · ok' : ''}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="flex items-center justify-between pt-3 border-t border-ink-700">
                <div className="font-mono text-[10.5px] text-mist-500">
                  <span className="text-mist-200">{fmt(w.runs)}</span> runs · <span className="text-pulse-300">{w.successRate}%</span> ok
                </div>
                <Btn size="sm" variant={isRunning ? 'ghost' : 'pulse'} disabled={isRunning || !w.active} onClick={() => simulate(w)}>
                  {isRunning ? <><span className="w-3 h-3 rounded-full border-2 border-signal-400 border-t-transparent spin" /> Running…</> : <><Icon name="play" size={11} /> Test run</>}
                </Btn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

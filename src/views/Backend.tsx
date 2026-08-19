import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import { Badge, Btn, CopyBtn, GatewayFeed, Icon, SectionHead, Sparkline, StatusDot } from '../components/ui';
import type { IconName } from '../components/ui';

import mainPy from '../../backend/app/main.py?raw';
import gatewayPy from '../../backend/app/gateway.py?raw';
import agentPy from '../../backend/app/agent.py?raw';
import providersPy from '../../backend/app/providers.py?raw';
import knowledgePy from '../../backend/app/knowledge.py?raw';
import corePy from '../../backend/app/core.py?raw';
import composeYml from '../../docker-compose.yml?raw';
import k8sYaml from '../../deploy/k8s.yaml?raw';
import dockerfileRaw from '../../backend/Dockerfile?raw';
import ciYml from '../../.github/workflows/ci-cd.yml?raw';
import reqsTxt from '../../backend/requirements.txt?raw';

/* ── source files registry (reads the real repo files) ── */
const FILES: { path: string; lang: 'python' | 'yaml' | 'docker' | 'text'; desc: string; code: string }[] = [
  { path: 'backend/app/main.py', lang: 'python', desc: 'FastAPI entrypoint · CORS · rate limiting · lifespan', code: mainPy },
  { path: 'backend/app/gateway.py', lang: 'python', desc: 'WebSocket gateway · connection manager · task progress & cancellation', code: gatewayPy },
  { path: 'backend/app/agent.py', lang: 'python', desc: 'Agent core · intent → knowledge → tools → provider → learn', code: agentPy },
  { path: 'backend/app/knowledge.py', lang: 'python', desc: 'Knowledge engine · pgvector cosine search · Redis cache · knowledge saver', code: knowledgePy },
  { path: 'backend/app/providers.py', lang: 'python', desc: 'AI provider layer · OpenAI / Gemini / Claude / DeepSeek · manual fallback chain', code: providersPy },
  { path: 'backend/app/core.py', lang: 'python', desc: 'Config · async DB · JWT + API keys · RBAC', code: corePy },
  { path: 'backend/Dockerfile', lang: 'docker', desc: 'Non-root image · healthcheck · uvicorn workers', code: dockerfileRaw },
  { path: 'docker-compose.yml', lang: 'yaml', desc: 'Full stack · pgvector + Redis + API + Celery worker/beat + admin', code: composeYml },
  { path: 'deploy/k8s.yaml', lang: 'yaml', desc: 'Namespace · Deployment · HPA (3→12) · Ingress + TLS · WS timeouts', code: k8sYaml },
  { path: '.github/workflows/ci-cd.yml', lang: 'yaml', desc: 'CI/CD · ruff + mypy · pytest ≥90% cov · GHCR push · k8s rollout', code: ciYml },
  { path: 'backend/requirements.txt', lang: 'text', desc: 'Pinned dependencies', code: reqsTxt },
];

/* ── tiny syntax highlighter ── */
function hlLine(line: string, lang: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let re: RegExp;
  if (lang === 'python') {
    re = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@\w+)|\b(def|class|import|from|return|async|await|if|elif|else|for|while|try|except|finally|with|as|raise|lambda|pass|yield|assert|global|del)\b|\b(None|True|False|self)\b|\b(not|in|is|or|and)\b|(\b\d+(?:\.\d+)?\b)/g;
  } else if (lang === 'yaml') {
    re = /(#.*$)|("(?:[^"\\]|\\.)*"|'[^']*')|^(\s*(?:- )?[\w./-]+(?=\s*:))|\b(true|false|null)\b|(\b\d+(?:\.\d+)?\b)/g;
  } else if (lang === 'docker') {
    re = /(#.*$)|("(?:[^"\\]|\\.)*")|^(FROM|RUN|COPY|ENV|EXPOSE|WORKDIR|CMD|HEALTHCHECK|USER|ARG|AS)\b|(\b\d+(?:\.\d+)?\b)/g;
  } else {
    re = /(#.*$)|(\b\d+(?:\.\d+)?\b)/g;
  }
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(<span key={k++}>{line.slice(last, m.index)}</span>);
    const g = m.slice(1);
    const cls = g[0] ? 'text-mist-600 italic'
      : g[1] ? 'text-pulse-300'
      : g[2] ? (lang === 'yaml' ? 'text-signal-300' : 'text-signal-400')
      : g[3] ? 'text-alarm-300'
      : g[4] ? 'text-cobalt-300'
      : 'text-mist-300';
    parts.push(<span key={k++} className={cls}>{m[0]}</span>);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < line.length) parts.push(<span key={k++}>{line.slice(last)}</span>);
  return parts;
}

function CodePanel({ code, lang, maxHeight = 480 }: { code: string; lang: string; maxHeight?: number }) {
  const lines = useMemo(() => code.replace(/\n$/, '').split('\n'), [code]);
  return (
    <div className="feed-scroll overflow-auto rounded-lg border border-ink-700 bg-ink-950" style={{ maxHeight }}>
      <pre className="font-mono text-[11px] leading-[1.75] p-3">
        {lines.map((ln, i) => (
          <div key={i} className="flex hover:bg-ink-800/60 rounded-sm">
            <span className="select-none w-9 shrink-0 text-right pr-3 text-mist-700 tabular-nums">{i + 1}</span>
            <code className="whitespace-pre text-mist-300">{hlLine(ln, lang)}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

/* ── deploy pipeline ── */
const STAGES = ['Checkout', 'Lint & Type-check', 'Test Suite · 90% cov', 'Build Image', 'Push → GHCR', 'K8s Rollout'];

export default function Backend() {
  const { actions } = useStore();
  const { push } = useToast();
  const [tab, setTab] = useState<'gateway' | 'source' | 'deploy'>('gateway');
  const [sel, setSel] = useState(0);
  const [running, setRunning] = useState(false);
  const [stageIdx, setStageIdx] = useState(-1);            // -1 idle · 0..5 running · 6 done
  const [version, setVersion] = useState('2.4.1');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const deploy = () => {
    if (running) return;
    setRunning(true); setStageIdx(0);
    let i = 0;
    timer.current = setInterval(() => {
      i += 1;
      setStageIdx(i);
      if (i >= STAGES.length) {
        if (timer.current) clearInterval(timer.current);
        setRunning(false);
        const next = '2.4.2';
        setVersion(next);
        actions.addLog('info', 'audit', `deployment.rollout.succeeded env=production version=v${next}`);
        push(`Production rollout complete — v${next} live`);
      }
    }, 720);
  };

  const file = FILES[sel];
  const tabs: { id: typeof tab; label: string; icon: IconName }[] = [
    { id: 'gateway', label: 'Live Gateway', icon: 'wifi' },
    { id: 'source', label: 'Source Code', icon: 'server' },
    { id: 'deploy', label: 'Deployment', icon: 'bolt' },
  ];

  return (
    <div>
      <SectionHead
        title="Backend & Production"
        desc="FastAPI + pgvector + Redis + Celery — the real service code ships in /backend. Inspect the source, watch the live gateway and run production rollouts."
        right={<Badge tone="amber">v{version} · python 3.11 · fastapi 0.115</Badge>}
      />

      {/* tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-ink-700 text-signal-300 border border-ink-600' : 'text-mist-400 border border-transparent hover:text-mist-200 hover:bg-ink-800'}`}>
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── GATEWAY ── */}
      {tab === 'gateway' && (
        <div className="grid gap-4 xl:grid-cols-3 anim-fade">
          <div className="xl:col-span-2"><GatewayFeed title="wss://api.highlyagent.io/ws" height={380} /></div>
          <div className="space-y-4">
            <div className="panel p-4">
              <p className="field-label">Gateway endpoints</p>
              <div className="space-y-2.5 mt-1">
                {[
                  { l: 'WebSocket', v: 'wss://api.highlyagent.io/ws' },
                  { l: 'REST base', v: 'https://api.highlyagent.io/api/v1' },
                  { l: 'Health', v: 'https://api.highlyagent.io/health' },
                ].map((e) => (
                  <div key={e.l} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-mist-600">{e.l}</p>
                      <p className="font-mono text-[11.5px] text-mist-200 truncate">{e.v}</p>
                    </div>
                    <CopyBtn text={e.v} />
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-4">
              <p className="field-label">Frame protocol</p>
              <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                {[
                  ['→', 'chat · cancel · tool_result · pong', 'text-mist-400'],
                  ['←', 'progress · answer · tool_request', 'text-pulse-300'],
                  ['←', 'error · cancelled · ping', 'text-signal-300'],
                ].map(([d, t, c], i) => (
                  <div key={i} className="flex gap-2 items-baseline">
                    <span className={`${c} font-semibold`}>{d}</span>
                    <span className="text-mist-400">{t}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-mist-500 mt-3 leading-relaxed">
                Client tools are dispatched to the connected device and resolved via <span className="font-mono text-mist-300">tool_result</span> futures — works for Web, Mobile, Desktop & IoT sockets alike.
              </p>
            </div>
            <div className="panel p-4">
              <p className="field-label">Edge regions</p>
              <div className="mt-2 space-y-2">
                {[
                  { r: 'ap-south-1 · Mumbai', ms: 18, ok: true },
                  { r: 'eu-west-1 · Ireland', ms: 41, ok: true },
                  { r: 'us-east-1 · Virginia', ms: 87, ok: true },
                ].map((x) => (
                  <div key={x.r} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[12px] text-mist-300"><StatusDot tone="green" pulse={x.ms < 25} /> {x.r}</span>
                    <span className="font-mono text-[11px] text-mist-400">{x.ms}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SOURCE ── */}
      {tab === 'source' && (
        <div className="grid gap-4 lg:grid-cols-[250px_1fr] anim-fade">
          <div className="panel overflow-hidden h-fit lg:sticky lg:top-[74px]">
            <p className="px-3.5 py-2.5 border-b border-ink-700 font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500">
              repository · main
            </p>
            <div className="feed-scroll overflow-y-auto max-h-[70vh]">
              {FILES.map((f, i) => (
                <button key={f.path} onClick={() => setSel(i)}
                  className={`w-full text-left px-3.5 py-2 border-l-2 transition-colors ${i === sel ? 'border-signal-500 bg-ink-750' : 'border-transparent hover:bg-ink-800'}`}>
                  <p className={`font-mono text-[11px] truncate ${i === sel ? 'text-signal-300' : 'text-mist-300'}`}>{f.path}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div>
                <p className="font-mono text-[13px] text-mist-100">{file.path}</p>
                <p className="text-[11.5px] text-mist-500">{file.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{file.code.split('\n').length} lines</Badge>
                <CopyBtn text={file.code} label="Copy" />
              </div>
            </div>
            <CodePanel code={file.code} lang={file.lang} maxHeight={620} />
          </div>
        </div>
      )}

      {/* ── DEPLOY ── */}
      {tab === 'deploy' && (
        <div className="space-y-4 anim-fade">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="panel p-5 lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-semibold text-[15px] text-mist-100">Release pipeline</h3>
                  <p className="text-[11.5px] text-mist-500">GitHub Actions → GHCR → Kubernetes rolling rollout</p>
                </div>
                <Btn variant={running ? 'ghost' : 'primary'} disabled={running} onClick={deploy}>
                  <Icon name={running ? 'refresh' : 'bolt'} size={13} className={running ? 'spin' : ''} />
                  {running ? 'Rolling out…' : stageIdx === STAGES.length ? 'Redeploy' : 'Deploy to production'}
                </Btn>
              </div>
              <div className="space-y-1">
                {STAGES.map((s, i) => {
                  const state = stageIdx > i || stageIdx === STAGES.length ? 'done' : stageIdx === i ? 'run' : 'idle';
                  return (
                    <div key={s} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${state === 'done' ? 'border-pulse-600/30 bg-pulse-900/25' : state === 'run' ? 'border-signal-600/40 bg-signal-900/20' : 'border-ink-700 bg-ink-900/40'}`}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        {state === 'done' ? <span className="text-pulse-400"><Icon name="check" size={13} /></span>
                          : state === 'run' ? <span className="spin inline-flex text-signal-400"><Icon name="refresh" size={13} /></span>
                          : <span className="w-1.5 h-1.5 rounded-full bg-mist-700" />}
                      </span>
                      <span className={`text-[13px] ${state === 'idle' ? 'text-mist-500' : 'text-mist-100'}`}>{s}</span>
                      {state === 'done' && <span className="ml-auto font-mono text-[10px] text-pulse-400">ok</span>}
                      {state === 'run' && <span className="ml-auto font-mono text-[10px] text-signal-400">running</span>}
                    </div>
                  );
                })}
              </div>
              {stageIdx === STAGES.length && (
                <div className="mt-3 tick-in flex items-center gap-2 px-3 py-2.5 rounded-lg border border-pulse-600/40 bg-pulse-900/30">
                  <Icon name="check" size={14} className="text-pulse-400" />
                  <p className="text-[12.5px] text-pulse-300">v{version} is live — 3 pods rolled, zero downtime. Entry written to the audit log.</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-3">
              {[
                { env: 'production', cluster: 'eks · ap-south-1', pods: '3/3', cpu: 42, mem: 57, ver: `v${version}` },
                { env: 'staging', cluster: 'eks · ap-south-1', pods: '2/2', cpu: 18, mem: 31, ver: `v${version}` },
                { env: 'dev', cluster: 'kind · local', pods: '1/1', cpu: 7, mem: 22, ver: 'v2.5.0-dev.3' },
              ].map((e) => (
                <div key={e.env} className="panel p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-display font-semibold text-[13.5px] text-mist-100">
                      <StatusDot tone="green" pulse={e.env === 'production'} /> {e.env}
                    </span>
                    <Badge tone={e.env === 'production' ? 'amber' : 'neutral'}>{e.ver}</Badge>
                  </div>
                  <p className="font-mono text-[10.5px] text-mist-500 mt-0.5">{e.cluster} · {e.pods} pods</p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {[{ l: 'cpu', v: e.cpu }, { l: 'mem', v: e.mem }].map((m) => (
                      <div key={m.l}>
                        <div className="flex justify-between font-mono text-[9.5px] text-mist-500 mb-1"><span>{m.l}</span><span>{m.v}%</span></div>
                        <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
                          <div className="h-full rounded-full bg-pulse-500" style={{ width: `${m.v}%`, transition: 'width 1s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[12px] text-mist-200">docker-compose.yml</p>
                <CopyBtn text={composeYml} label="Copy" />
              </div>
              <CodePanel code={composeYml} lang="yaml" maxHeight={300} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[12px] text-mist-200">deploy/k8s.yaml</p>
                <CopyBtn text={k8sYaml} label="Copy" />
              </div>
              <CodePanel code={k8sYaml} lang="yaml" maxHeight={300} />
            </div>
          </div>

          <div className="panel p-4">
            <p className="field-label">Stack services</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
              {[
                { n: 'api', d: 'FastAPI · uvicorn', i: 'server' as IconName },
                { n: 'gateway', d: 'WebSocket /ws', i: 'wifi' as IconName },
                { n: 'worker', d: 'Celery ×4', i: 'bolt' as IconName },
                { n: 'beat', d: 'scheduler', i: 'clock' as IconName },
                { n: 'postgres', d: 'pgvector · pg16', i: 'db' as IconName },
                { n: 'redis', d: 'cache · STM · broker', i: 'layers' as IconName },
              ].map((s) => (
                <div key={s.n} className="rounded-lg border border-ink-700 bg-ink-900/50 p-2.5 hover:border-ink-500 transition-colors">
                  <Icon name={s.i} size={14} className="text-signal-400" />
                  <p className="font-mono text-[11.5px] text-mist-100 mt-1.5">{s.n}</p>
                  <p className="text-[10px] text-mist-500">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

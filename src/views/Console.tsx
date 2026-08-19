import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import type { Intent } from '../lib/data';
import { INTENT_TOOL, SUGGESTED_PROMPTS, detectIntent, findKnowledge, fmt, isBengali, maskKey } from '../lib/data';
import { Badge, Btn, Icon, StatusDot } from '../components/ui';

type StepStatus = 'pending' | 'running' | 'done' | 'cancelled' | 'skipped';
interface PipeStep { label: string; detail: string; status: StepStatus; ms?: number }
interface ChatMsg {
  id: number;
  role: 'user' | 'agent' | 'system';
  text: string;
  meta?: { source: 'cache' | 'ai'; provider?: string; tokens?: number; cost?: number; latencyMs: number; tool?: string; sim?: number };
}

class Cancelled extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function synthesize(intent: Intent, bn: boolean): string {
  const temp = 26 + Math.floor(Math.random() * 7);
  const dhakaTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka', hour12: true }).format(new Date());
  switch (intent) {
    case 'weather':
      return bn
        ? `ঢাকায় এখন ${temp}°C, আংশিক মেঘলা আকাশ। বাতাসের গতি ১২ কিমি/ঘণ্টা, আর্দ্রতা ৭৪%। বিকেলের দিকে হালকা বৃষ্টির সম্ভাবনা রয়েছে — ছাতা সাথে রাখুন।`
        : `It's currently ${temp}°C in Dhaka with partly cloudy skies. Wind 12 km/h, humidity 74%. Light rain is possible later this afternoon — keep an umbrella handy.`;
    case 'time':
      return bn ? `ঢাকায় এখন সময় ${dhakaTime} (Asia/Dhaka, GMT+6)।` : `The current time in Dhaka is ${dhakaTime} (Asia/Dhaka, GMT+6).`;
    case 'order': {
      const id = `ORD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      return bn
        ? `আপনার সাম্প্রতিক অর্ডার ${id} বর্তমানে "ডেলিভারি হাব"-এ রয়েছে এবং ২৪–৪৮ ঘণ্টার মধ্যে পৌঁছে যাবে। কুরিয়ার হাব ছাড়লে আপনি SMS পাবেন।`
        : `Your latest order ${id} is currently at the delivery hub and should arrive within 24–48 hours. You'll get an SMS the moment it leaves with the courier.`;
    }
    case 'sales': {
      const rev = (180 + Math.random() * 90).toFixed(1);
      return bn
        ? `আজকের বিক্রয় সারাংশ: মোট আয় ৳${rev}K, অর্ডার ২১৪টি, গড় অর্ডার ভ্যালু ৳${Math.round(+rev * 1000 / 214)}। গতকালের তুলনায় আয় +১২.৪%। শীর্ষ ক্যাটাগরি: ইলেকট্রনিক্স।`
        : `Today's sales summary: gross revenue ৳${rev}K across 214 orders, average order value ৳${Math.round(+rev * 1000 / 214)}. Revenue is up 12.4% vs yesterday. Top category: electronics.`;
    }
    case 'refund':
      return bn
        ? `রিফান্ড পেতে Orders পেজ থেকে আইটেমটি নির্বাচন করে "Request Refund" চাপুন। ডেলিভারির ৭ দিনের মধ্যে, অব্যবহৃত পণ্যে সম্পূর্ণ টাকা ফেরত পাওয়া যায়।`
        : `To get a refund, open Orders, select the item and tap "Request Refund". Unused products are fully refundable within 7 days of delivery.`;
    default:
      return bn
        ? `আমি প্রশ্নটি বুঝেছি এবং সংশ্লিষ্ট তথ্য যাচাই করে উত্তর তৈরি করেছি। ভবিষ্যতে একই ধরনের প্রশ্ন আসলে আমি এটি সরাসরি Knowledge Base থেকে — কোনো AI কল ছাড়াই — উত্তর দেব।`
        : `I've understood the request and grounded this answer in the client's live data. Next time a similar question arrives, I'll answer directly from the Knowledge Base — no AI call needed.`;
  }
}

export default function Console() {
  const { state, actions } = useStore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 0, role: 'agent',
      text: 'Test console connected via wss://gateway.highlyagent.io (simulated). Send a message — watch the pipeline choose between the knowledge cache and an AI call. Ask the same thing twice to see self-learning kick in.',
      meta: { source: 'cache', latencyMs: 4 },
    },
  ]);
  const [steps, setSteps] = useState<PipeStep[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const cancelRef = useRef(false);
  const idRef = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [session, setSession] = useState({ queries: 0, hits: 0, misses: 0, saved: 0 });

  const provider = state.providers.find((p) => p.enabled) ?? state.providers[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, steps]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const setStep = (i: number, patch: Partial<PipeStep>) =>
    setSteps((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));

  const guard = () => { if (cancelRef.current) throw new Cancelled(); };

  async function runStep(i: number, ms: number) {
    setStep(i, { status: 'running' });
    await sleep(ms);
    guard();
  }

  async function ask(text: string) {
    if (running || !text.trim()) return;
    cancelRef.current = false;
    setRunning(true);
    setProgress(4);
    setElapsed(0);
    const t0 = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - t0), 90);

    const uid1 = idRef.current++;
    setMessages((m) => [...m, { id: uid1, role: 'user', text }]);
    setSession((s) => ({ ...s, queries: s.queries + 1 }));

    const intent = detectIntent(text);
    const bn = isBengali(text);
    const toolName = INTENT_TOOL[intent];
    const tool = toolName ? state.tools.find((t) => t.name === toolName && t.enabled) : undefined;

    const plan: PipeStep[] = [
      { label: 'Authenticate', detail: `X-HLA-Key ${maskKey(state.clients[0]?.apiKey ?? 'hla_live_demo').slice(0, 18)}…`, status: 'pending' },
      { label: 'Analyze intent', detail: `intent=${intent} · lang=${bn ? 'bn' : 'en'}`, status: 'pending' },
      { label: 'Vector search · pgvector', detail: 'cosine scan over knowledge index', status: 'pending' },
      { label: 'Respond', detail: '', status: 'pending' },
    ];
    setSteps(plan);

    try {
      await runStep(0, 420); setProgress(16);
      setStep(0, { status: 'done', detail: 'scope=agent:write · rate 12/60 rpm', ms: 38 });

      await runStep(1, 520); setProgress(30);
      setStep(1, { status: 'done', ms: 51 });

      const match = findKnowledge(text, state.knowledge);
      await runStep(2, 640);
      setProgress(46);

      if (match) {
        setStep(2, { status: 'done', detail: `best sim=${match.score.toFixed(2)} ≥ 0.40 → CACHE HIT`, ms: 22 });
        await runStep(3, 400);
        setStep(3, { status: 'done', label: 'Serve from Knowledge Base', detail: `entry ${match.entry.id.slice(0, 10)} · 0 AI tokens · $0.0000`, ms: 9 });
        setProgress(100);

        const latency = Date.now() - t0;
        const savedTokens = 320 + Math.floor(Math.random() * 120);
        const costDelta = +((savedTokens / 1000) * provider.costPer1k * 4).toFixed(5);
        actions.registerHit(match.entry.id, savedTokens);
        actions.recordQuery({ hit: true, tokens: 0, savedTokens, costDelta, latency });
        actions.addLog('info', 'knowledge', `test-console hit q='${text.slice(0, 32)}' sim=${match.score.toFixed(2)}`);
        setSession((s) => ({ ...s, hits: s.hits + 1, saved: +(s.saved + costDelta).toFixed(4) }));
        setMessages((m) => [...m, {
          id: idRef.current++, role: 'agent', text: match.entry.answer,
          meta: { source: 'cache', latencyMs: latency, sim: match.score, tokens: 0, cost: 0 },
        }]);
      } else {
        setStep(2, { status: 'done', detail: 'best sim=0.21 < 0.40 → cache miss', ms: 24 });

        const mid: PipeStep[] = [];
        if (tool) mid.push({ label: `Execute tool · ${tool.name}`, detail: 'schema-validated args', status: 'pending' });
        mid.push({ label: `Call provider · ${provider.name}`, detail: `${provider.model} · temp ${provider.temperature.toFixed(1)}`, status: 'pending' });
        mid.push({ label: 'Learn → Knowledge Base', detail: 'embed Q+A · write pgvector', status: 'pending' });
        setSteps([...plan.slice(0, 3), ...mid, plan[3]]);

        let idx = 3;
        if (tool) {
          await runStep(idx, 780);
          setProgress(58);
          setStep(idx, { status: 'done', detail: intent === 'weather' ? '{city:"Dhaka"} → 29°C ok' : intent === 'time' ? '{tz:"Asia/Dhaka"} → ok' : intent === 'order' ? '{order_id:"ORD-88K2M"} → in_transit' : '{range:"today"} → 214 rows', ms: tool.avgMs || 96 });
          idx++;
        }

        // provider call with streaming progress
        setStep(idx, { status: 'running' });
        const tokens = 300 + Math.floor(Math.random() * 260);
        for (let p = 58; p <= 86; p += 2 + Math.floor(Math.random() * 3)) {
          await sleep(110);
          guard();
          setProgress(p);
        }
        setStep(idx, { status: 'done', detail: `${tokens} tokens · fallback chain pos 1`, ms: provider.latencyMs });
        idx++;

        const answer = synthesize(intent, bn);
        await runStep(idx, 700);
        setStep(idx, { status: 'done', detail: 'embedding 1536-dim stored · ttl ∞', ms: 63 });
        setProgress(94);
        idx++;

        await runStep(idx, 380);
        setStep(idx, { status: 'done', label: 'Stream answer to client', detail: 'pushed over websocket', ms: 12 });
        setProgress(100);

        const latency = Date.now() - t0;
        const cost = +((tokens / 1000) * provider.costPer1k * 3).toFixed(5);
        actions.recordQuery({ hit: false, tokens, savedTokens: 0, costDelta: 0, latency });
        actions.learn(text.trim(), answer, intent === 'generic' ? 'general' : intent, bn ? 'bn' : 'en');
        actions.addLog('info', `provider.${provider.id}`, `test-console completion tokens=${tokens} latency=${(latency / 1000).toFixed(2)}s`);
        setSession((s) => ({ ...s, misses: s.misses + 1 }));
        setMessages((m) => [...m, {
          id: idRef.current++, role: 'agent', text: answer,
          meta: { source: 'ai', provider: provider.name, tokens, cost, latencyMs: latency, tool: tool?.name },
        }, {
          id: idRef.current++, role: 'system',
          text: `Learned: this Q+A was embedded into the Knowledge Base (source: ai-learned). Ask it again — next response costs $0.00.`,
        }]);
      }
    } catch (e) {
      if (e instanceof Cancelled) {
        setSteps((s) => s.map((st) => (st.status === 'running' ? { ...st, status: 'cancelled' } : st.status === 'pending' ? { ...st, status: 'skipped' } : st)));
        setProgress(0);
        setMessages((m) => [...m, { id: idRef.current++, role: 'system', text: 'Task cancelled — no tokens were billed for the interrupted provider call.' }]);
        actions.addLog('warn', 'ws.gateway', 'test-console task cancelled by admin');
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setRunning(false);
    }
  }

  const clear = () => {
    setMessages([{ id: idRef.current++, role: 'system', text: 'Conversation cleared. The Knowledge Base keeps everything it has learned.' }]);
    setSteps([]); setProgress(0); setSession({ queries: 0, hits: 0, misses: 0, saved: 0 });
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-[21px] text-mist-100 tracking-tight">Agent Test Console</h2>
          <p className="text-[12.5px] text-mist-400 mt-0.5">Talk to the middleware exactly like a client SDK would — and watch the self-learning loop in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="teal">{session.queries} queries</Badge>
          <Badge tone="amber">{session.hits} cache hits</Badge>
          <Badge tone="blue">{session.misses} AI calls</Badge>
          <Badge tone="teal">${session.saved.toFixed(4)} saved</Badge>
          <Btn size="sm" onClick={clear}><Icon name="trash" size={12} /> Clear</Btn>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_330px] gap-4">
        {/* chat */}
        <div className="panel flex flex-col anim-rise" style={{ minHeight: 520 }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto feed-scroll p-5 space-y-4" style={{ maxHeight: 520 }}>
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end anim-rise">
                  <div className="max-w-[78%] rounded-xl rounded-tr-sm border border-cobalt-500/40 bg-cobalt-900/40 px-4 py-2.5">
                    <p className="text-[13px] text-mist-100 leading-relaxed">{m.text}</p>
                  </div>
                </div>
              ) : m.role === 'system' ? (
                <div key={m.id} className="flex justify-center anim-rise">
                  <p className="font-mono text-[10.5px] text-mist-500 bg-ink-800 border border-ink-700 rounded-full px-3.5 py-1.5 text-center max-w-[90%]">
                    <Icon name="spark" size={10} className="inline mr-1.5 -mt-0.5 text-signal-400" />{m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start anim-rise">
                  <div className="max-w-[85%]">
                    <div className="rounded-xl rounded-tl-sm border border-ink-600 bg-ink-800 px-4 py-3">
                      <p className="text-[13px] text-mist-100 leading-relaxed">{m.text}</p>
                    </div>
                    {m.meta && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge tone={m.meta.source === 'cache' ? 'amber' : 'blue'}>
                          {m.meta.source === 'cache' ? <><Icon name="db" size={9} /> knowledge cache</> : <><Icon name="plug" size={9} /> {m.meta.provider}</>}
                        </Badge>
                        <span className="font-mono text-[10px] text-mist-500">{m.meta.latencyMs}ms</span>
                        {m.meta.sim !== undefined && <span className="font-mono text-[10px] text-pulse-300">sim {m.meta.sim.toFixed(2)}</span>}
                        {m.meta.tokens !== undefined && m.meta.source === 'ai' && <span className="font-mono text-[10px] text-mist-500">{m.meta.tokens} tok</span>}
                        {m.meta.cost !== undefined && (
                          <span className={`font-mono text-[10px] ${m.meta.cost === 0 ? 'text-pulse-300' : 'text-signal-300'}`}>
                            {m.meta.cost === 0 ? '$0.0000' : `$${m.meta.cost.toFixed(4)}`}
                          </span>
                        )}
                        {m.meta.tool && <span className="font-mono text-[10px] text-cobalt-300">⚙ {m.meta.tool}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {running && (
              <div className="flex justify-start anim-rise">
                <div className="rounded-xl rounded-tl-sm border border-ink-600 bg-ink-800 px-4 py-3 flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-pulse-400 blink" style={{ animationDelay: `${i * 0.25}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* suggestions */}
          <div className="px-5 pt-3 flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((s) => (
              <button key={s} disabled={running} onClick={() => { setInput(s); }}
                className="px-2.5 py-1 rounded-full border border-ink-600 text-[11px] text-mist-300 hover:border-signal-600/60 hover:text-signal-300 hover:bg-signal-900/30 transition-all disabled:opacity-40">
                {s}
              </button>
            ))}
          </div>

          {/* input */}
          <div className="p-4">
            <div className="flex gap-2">
              <input
                className="field py-2.5!"
                placeholder="বাংলা বা English — যেকোনো প্রশ্ন পাঠান…"
                value={input}
                disabled={running}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { ask(input); setInput(''); } }}
              />
              {running ? (
                <Btn variant="danger" onClick={() => { cancelRef.current = true; }}>
                  <Icon name="stop" size={13} /> Cancel task
                </Btn>
              ) : (
                <Btn variant="primary" onClick={() => { ask(input); setInput(''); }} disabled={!input.trim()}>
                  <Icon name="send" size={13} /> Send
                </Btn>
              )}
            </div>
          </div>
        </div>

        {/* pipeline monitor */}
        <div className="space-y-4 anim-rise" style={{ animationDelay: '100ms' }}>
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-mist-100 flex items-center gap-2">
                Task pipeline {running && <StatusDot tone="amber" pulse />}
              </h3>
              <span className="font-mono text-[11px] text-mist-400 tabular-nums">{running ? `${(elapsed / 1000).toFixed(1)}s` : 'idle'}</span>
            </div>
            {running && (
              <div className="mb-3">
                <div className="w-full h-1.5 rounded-full bg-ink-700 overflow-hidden">
                  <div className="bar-live h-full rounded-full" style={{ width: `${progress}%`, transition: 'width 0.25s ease' }} />
                </div>
                <p className="font-mono text-[10px] text-mist-500 mt-1 text-right">{progress}% — progress pushed to client via WS</p>
              </div>
            )}
            {steps.length === 0 ? (
              <div className="py-8 text-center">
                <Icon name="flow" size={26} className="mx-auto text-mist-600" />
                <p className="text-[11.5px] text-mist-500 mt-3 leading-relaxed px-2">
                  Send a message to see each stage:<br />auth → intent → vector search → tool → provider → learn
                </p>
              </div>
            ) : (
              <ol className="space-y-1">
                {steps.map((s, i) => (
                  <li key={i} className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${s.status === 'running' ? 'bg-ink-800 border border-ink-600' : 'border border-transparent'}`}>
                    <span className="mt-0.5 shrink-0">
                      {s.status === 'done' && <span className="w-4 h-4 rounded-full bg-pulse-900 border border-pulse-600/50 flex items-center justify-center text-pulse-300"><Icon name="check" size={9} /></span>}
                      {s.status === 'running' && <span className="w-4 h-4 rounded-full border-2 border-signal-400 border-t-transparent spin" />}
                      {s.status === 'pending' && <span className="w-4 h-4 rounded-full border border-ink-500" />}
                      {s.status === 'cancelled' && <span className="w-4 h-4 rounded-full bg-alarm-900 border border-alarm-500/50 flex items-center justify-center text-alarm-300"><Icon name="x" size={9} /></span>}
                      {s.status === 'skipped' && <span className="w-4 h-4 rounded-full border border-ink-600 flex items-center justify-center text-mist-600"><Icon name="right" size={9} /></span>}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[12px] font-medium leading-tight ${s.status === 'done' ? 'text-mist-100' : s.status === 'running' ? 'text-signal-300' : s.status === 'cancelled' ? 'text-alarm-300' : 'text-mist-500'}`}>
                        {s.label} {s.ms !== undefined && s.status === 'done' && <span className="font-mono text-[9.5px] text-mist-500 font-normal">·{s.ms}ms</span>}
                      </p>
                      {s.detail && <p className="font-mono text-[10px] text-mist-500 mt-0.5 break-words">{s.detail}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="panel p-4">
            <h3 className="font-display font-semibold text-mist-100 mb-2.5 flex items-center gap-2">
              <Icon name="spark" size={14} className="text-signal-400" /> Why this saves money
            </h3>
            <p className="text-[11.5px] text-mist-400 leading-relaxed">
              First ask: full pipeline, <span className="font-mono text-signal-300">~{fmt(provider.latencyMs)}ms</span> and a billed AI completion.
              The Q+A is embedded and stored. Every similar ask after that is a
              <span className="text-pulse-300 font-medium"> pgvector hit — zero tokens</span>, answered in ~100ms.
              Across thousands of users this compounds to <span className="text-signal-300 font-medium">70–80% lower provider spend</span>.
            </p>
            <div className="mt-3 pt-3 border-t border-ink-700 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="font-display font-bold text-[16px] text-mist-100 tabular-nums">{fmt(state.metrics.cacheHits)}</p>
                <p className="font-mono text-[8.5px] uppercase tracking-wider text-mist-500">hits today</p>
              </div>
              <div>
                <p className="font-display font-bold text-[16px] text-signal-300 tabular-nums">${state.metrics.costSaved.toFixed(2)}</p>
                <p className="font-mono text-[8.5px] uppercase tracking-wider text-mist-500">saved</p>
              </div>
              <div>
                <p className="font-display font-bold text-[16px] text-pulse-300 tabular-nums">{state.knowledge.length}</p>
                <p className="font-mono text-[8.5px] uppercase tracking-wider text-mist-500">learned nodes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

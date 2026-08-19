import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import {
  LayoutGrid, Layers, KeyRound, BookOpenText, Wrench, PlugZap, TerminalSquare, Users,
  GitBranch, ScrollText, ShieldCheck, Search, Plus, X, Copy, Check, RefreshCw, Trash2,
  Pencil, AlertTriangle, Globe2, Smartphone, Monitor, Cpu, Send, Square, ChevronUp,
  ChevronDown, ChevronRight, Clock3, Database, Activity, SlidersHorizontal, Zap, Eye,
  EyeOff, Pause, Play, Lock, Server, Sparkles, Info, Wifi, ArrowRight, DollarSign,
  Sun, Moon, LogOut, FolderKanban, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ---------------- icon registry ---------------- */
export const ICONS = {
  grid: LayoutGrid, layers: Layers, key: KeyRound, book: BookOpenText, wrench: Wrench,
  plug: PlugZap, terminal: TerminalSquare, users: Users, flow: GitBranch, logs: ScrollText,
  shield: ShieldCheck, search: Search, plus: Plus, x: X, copy: Copy, check: Check,
  refresh: RefreshCw, trash: Trash2, edit: Pencil, alert: AlertTriangle, globe: Globe2,
  phone: Smartphone, monitor: Monitor, chip: Cpu, send: Send, stop: Square, up: ChevronUp,
  down: ChevronDown, right: ChevronRight, clock: Clock3, db: Database, pulse: Activity,
  sliders: SlidersHorizontal, bolt: Zap, eye: Eye, eyeoff: EyeOff, pause: Pause,
  play: Play, lock: Lock, server: Server, spark: Sparkles, info: Info, wifi: Wifi,
  arrow: ArrowRight, dollar: DollarSign, sun: Sun, moon: Moon, logout: LogOut,
  folder: FolderKanban, help: HelpCircle,
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, className = '', strokeWidth = 1.8 }: {
  name: IconName; size?: number; className?: string; strokeWidth?: number;
}) {
  const Cmp: LucideIcon = ICONS[name];
  return <Cmp size={size} className={className} strokeWidth={strokeWidth} />;
}

export const CLIENT_ICONS: Record<string, IconName> = {
  web: 'globe', mobile: 'phone', desktop: 'monitor', iot: 'chip',
};

/* ---------------- buttons ---------------- */
export function Btn({ children, onClick, variant = 'ghost', size = 'md', disabled, className = '', title, type = 'button' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'subtle' | 'pulse';
  size?: 'sm' | 'md'; disabled?: boolean; className?: string; title?: string; type?: 'button' | 'submit';
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap';
  const sizes = { sm: 'text-xs px-2.5 py-1.5', md: 'text-[13px] px-3.5 py-2' };
  const variants = {
    primary: 'bg-signal-400 text-ink-950 hover:bg-signal-300 shadow-[0_4px_16px_rgba(242,169,59,0.25)]',
    pulse: 'bg-pulse-500 text-ink-950 hover:bg-pulse-400 shadow-[0_4px_16px_rgba(35,191,165,0.25)]',
    ghost: 'border border-ink-600 text-mist-200 hover:border-ink-500 hover:bg-ink-750',
    danger: 'border border-alarm-500/40 text-alarm-400 hover:bg-alarm-900/40',
    subtle: 'text-mist-400 hover:text-mist-100 hover:bg-ink-750',
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function IconBtn({ icon, onClick, title, danger }: { icon: IconName; onClick?: () => void; title?: string; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${danger ? 'text-mist-500 hover:text-alarm-400 hover:bg-alarm-900/40' : 'text-mist-500 hover:text-mist-100 hover:bg-ink-700'}`}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}

/* ---------------- badges / chips ---------------- */
export function Badge({ children, tone = 'neutral', className = '' }: {
  children: ReactNode; tone?: 'neutral' | 'amber' | 'teal' | 'red' | 'blue' | 'green'; className?: string;
}) {
  const tones = {
    neutral: 'bg-ink-700 text-mist-300 border-ink-600',
    amber: 'bg-signal-900 text-signal-300 border-signal-600/40',
    teal: 'bg-pulse-900 text-pulse-300 border-pulse-600/40',
    red: 'bg-alarm-900 text-alarm-300 border-alarm-500/40',
    blue: 'bg-cobalt-900 text-cobalt-300 border-cobalt-500/40',
    green: 'bg-pulse-900 text-pulse-300 border-pulse-600/40',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10.5px] tracking-wide uppercase ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusDot({ tone, pulse }: { tone: 'green' | 'amber' | 'red' | 'gray'; pulse?: boolean }) {
  const map = { green: 'bg-pulse-400', amber: 'bg-signal-400', red: 'bg-alarm-400', gray: 'bg-mist-600' };
  return (
    <span className="relative inline-flex w-2 h-2">
      {pulse && <span className={`absolute inset-0 rounded-full ${map[tone]} ping-soft`} />}
      <span className={`relative w-2 h-2 rounded-full ${map[tone]}`} />
    </span>
  );
}

/* ---------------- toggle ---------------- */
export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 disabled:opacity-40 shrink-0 ${on ? 'bg-pulse-500' : 'bg-ink-600'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-ink-950 transition-transform duration-200 ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

/* ---------------- modal (scrollable body + sticky bottom footer) ---------------- */
export function Modal({ open, onClose, title, children, footer, width = 480 }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm anim-fade" onClick={onClose} />
      <div
        className="anim-pop relative panel rounded-t-xl! sm:rounded-xl! w-full flex flex-col max-h-[88vh] sm:max-h-[80vh]"
        style={{ width, maxWidth: '100%', boxShadow: 'var(--shadow-pop)' }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-700 shrink-0">
          <h3 className="font-display font-semibold text-[15px] text-mist-100">{title}</h3>
          <IconBtn icon="x" onClick={onClose} title="Close" />
        </div>
        <div className="p-5 overflow-y-auto feed-scroll grow">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-ink-700 flex items-center justify-end gap-2 shrink-0 bg-ink-800/60 rounded-b-xl!">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- confirm dialog ---------------- */
export interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setReq({ ...o, resolve })),
    [],
  );
  const close = (v: boolean) => { req?.resolve(v); setReq(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {req && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm anim-fade" onClick={() => close(false)} />
          <div className="anim-pop relative panel p-5 w-[420px] max-w-full" style={{ boxShadow: 'var(--shadow-pop)' }}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${req.tone === 'danger' ? 'bg-alarm-900 text-alarm-400' : 'bg-pulse-900 text-pulse-300'}`}>
                <Icon name={req.tone === 'danger' ? 'alert' : 'info'} size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-[15px] text-mist-100">{req.title}</h3>
                <div className="text-[12.5px] text-mist-400 mt-1 leading-relaxed">{req.message}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Btn onClick={() => close(false)}>Cancel</Btn>
              <Btn variant={req.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
                {req.confirmLabel ?? 'Confirm'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* ---------------- form bits ---------------- */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="field-label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] text-mist-500">{hint}</p>}
    </div>
  );
}

/* ---------------- breadcrumb ---------------- */
export function Breadcrumb({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12.5px] min-w-0 overflow-hidden">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          {i > 0 && <Icon name="right" size={12} className="text-mist-600 shrink-0" />}
          {it.onClick ? (
            <button onClick={it.onClick} className="text-mist-400 hover:text-pulse-300 transition-colors truncate">
              {it.label}
            </button>
          ) : (
            <span className="text-mist-200 font-medium truncate">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ---------------- tabs (project sub-navigation) ---------------- */
export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string; icon?: IconName }[]; active: string; onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto feed-scroll border-b border-ink-700 -mx-1 px-1">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] whitespace-nowrap transition-colors ${
              on ? 'text-mist-100 font-medium' : 'text-mist-500 hover:text-mist-300'
            }`}
          >
            {t.icon && <Icon name={t.icon} size={14} className={on ? 'text-signal-400' : ''} />}
            {t.label}
            <span className={`absolute left-2 right-2 -bottom-px h-[2px] rounded-full transition-all duration-200 ${on ? 'bg-signal-400' : 'bg-transparent'}`} />
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- skeleton / error ---------------- */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="anim-fade">
      <Skeleton className="h-7 w-56 mb-2" />
      <Skeleton className="h-4 w-80 mb-6" />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />)}
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function ErrorState({ title, desc, actionLabel, onAction }: {
  title: string; desc: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center anim-fade">
      <div className="w-12 h-12 rounded-xl bg-alarm-900 border border-alarm-500/40 flex items-center justify-center text-alarm-400 mb-3">
        <Icon name="alert" size={22} />
      </div>
      <p className="font-display font-semibold text-mist-200">{title}</p>
      <p className="text-xs text-mist-500 mt-1 max-w-sm">{desc}</p>
      {actionLabel && onAction && (
        <Btn variant="danger" className="mt-4" onClick={onAction}>{actionLabel}</Btn>
      )}
    </div>
  );
}

/* ---------------- sparkline ---------------- */
export function Sparkline({ data, w = 120, h = 36, color = 'var(--color-pulse-400)', animate }: {
  data: number[]; w?: number; h?: number; color?: string; animate?: boolean;
}) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 3 - ((v - min) / range) * (h - 8),
  ]);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={`url(#g${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" className={animate ? 'draw-line' : ''} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={color} />
    </svg>
  );
}

/* ---------------- ring gauge ---------------- */
export function Ring({ value, size = 72, stroke = 7, color = 'var(--color-signal-400)', label }: {
  value: number; size?: number; stroke?: number; color?: string; label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, value) / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink-700)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-mist-100" style={{ fontSize: size / 4.6 }}>{Math.round(value)}%</span>
        {label && <span className="font-mono text-[8.5px] uppercase tracking-widest text-mist-500">{label}</span>}
      </div>
    </div>
  );
}

/* ---------------- progress bar ---------------- */
export function Bar({ value, tone = 'teal', h = 6 }: { value: number; tone?: 'teal' | 'amber' | 'red' | 'live'; h?: number }) {
  const tones = { teal: 'bg-pulse-500', amber: 'bg-signal-400', red: 'bg-alarm-500' };
  return (
    <div className="w-full rounded-full bg-ink-700 overflow-hidden" style={{ height: h }}>
      <div
        className={tone === 'live' ? 'bar-live h-full rounded-full' : `${tones[tone]} h-full rounded-full`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </div>
  );
}

/* ---------------- copy button ---------------- */
export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setOk(true);
    setTimeout(() => setOk(false), 1600);
  };
  return (
    <Btn size="sm" variant={ok ? 'pulse' : 'ghost'} onClick={copy} title="Copy to clipboard">
      <Icon name={ok ? 'check' : 'copy'} size={13} />
      {label && <span>{ok ? 'Copied' : label}</span>}
    </Btn>
  );
}

/* ---------------- stat card ---------------- */
export function Stat({ label, value, sub, icon, spark, color, delay = 0 }: {
  label: string; value: ReactNode; sub?: ReactNode; icon: IconName; spark?: ReactNode; color?: string; delay?: number;
}) {
  return (
    <div className="panel p-4 anim-rise group hover:border-ink-500 transition-colors" style={{ animationDelay: `${delay}ms` } as CSSProperties}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500 flex items-center gap-1.5">
            <span style={{ color }}><Icon name={icon} size={12} /></span>
            {label}
          </p>
          <p className="font-display font-bold text-[26px] leading-tight text-mist-100 mt-1.5 tabular-nums truncate">{value}</p>
          {sub && <div className="text-[11.5px] text-mist-400 mt-1">{sub}</div>}
        </div>
        {spark && <div className="mt-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">{spark}</div>}
      </div>
    </div>
  );
}

/* ---------------- section header ---------------- */
export function SectionHead({ title, desc, right }: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 className="font-display font-bold text-[21px] text-mist-100 tracking-tight">{title}</h2>
        {desc && <p className="text-[12.5px] text-mist-400 mt-0.5 max-w-xl">{desc}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon: IconName; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center anim-fade">
      <div className="w-12 h-12 rounded-xl bg-ink-750 border border-ink-600 flex items-center justify-center text-mist-500 mb-3">
        <Icon name={icon} size={22} />
      </div>
      <p className="font-display font-semibold text-mist-200">{title}</p>
      <p className="text-xs text-mist-500 mt-1 max-w-xs">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- live gateway feed (real-time ws simulation) ---------------- */
export type FeedFrame = { id: number; ts: string; kind: string; text: string };

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const CHAT_SAMPLES = [
  '"ঢাকায় আজ আবহাওয়া কেমন?"', '"What is 128 × 46?"', '"order #8841 status"',
  '"রিফান্ড পলিসি কী?"', '"convert 250 usd to bdt"', '"সাইন-আপ বাটন কাজ করছে না"',
  '"refund my last order"', '"show pricing plans"', '"ডিভাইস রিবুট কম্যান্ড পাঠাও"',
  '"current time in dhaka"', '"track parcel BD-2291"', '"API rate limit কত?"',
];

const FEED_POOL: { kind: string; weight: number; make: () => string }[] = [
  { kind: 'msg', weight: 28, make: () => `chat · ${pick(CHAT_SAMPLES)}` },
  { kind: 'hit', weight: 22, make: () => `KB HIT · sim ${(0.62 + Math.random() * 0.36).toFixed(2)} · 0 tokens` },
  { kind: 'ai', weight: 13, make: () => { const t = 90 + Math.floor(Math.random() * 340); return `AI ${pick(['openai/gpt-4o-mini', 'claude/claude-haiku-4', 'gemini/gemini-2.0-flash'])} · ${t} tok · $${(t * 0.0000021).toFixed(5)}`; } },
  { kind: 'tool', weight: 11, make: () => `TOOL ${pick(['weather.fetch', 'math.calculate', 'currency.convert', 'orders.lookup', 'device.reboot'])} · ${40 + Math.floor(Math.random() * 260)}ms` },
  { kind: 'conn', weight: 9, make: () => `${Math.random() > 0.45 ? '+ CONN' : '− CLOSE'} ${pick(['nova-pos-web', 'nova-pos-mobile', 'shopio-desktop', 'farm-iot-hub', 'medibook-app'])} · ${pick(['api-key', 'jwt'])}` },
  { kind: 'hb', weight: 13, make: () => `heartbeat · ${118 + Math.floor(Math.random() * 30)} sockets · rtt ${14 + Math.floor(Math.random() * 26)}ms` },
  { kind: 'err', weight: 2, make: () => pick(['RATE LIMIT 429 · backoff 2s', 'provider timeout · failover → claude', 'schema invalid · tool blocked', 'token quota hit · user u_1947', 'ACCESS_DENIED · key/project mismatch']), },
];

function weightedFrame(): { kind: string; text: string } {
  const total = FEED_POOL.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of FEED_POOL) { r -= p.weight; if (r <= 0) return { kind: p.kind, text: p.make() }; }
  return { kind: 'hb', text: 'heartbeat' };
}

function seedFrames(): FeedFrame[] {
  const now = Date.now();
  return Array.from({ length: 9 }, (_, i) => {
    const f = weightedFrame();
    return { id: i, ts: new Date(now - (9 - i) * 1100).toLocaleTimeString('en-GB', { hour12: false }), ...f };
  }).reverse();
}

export function useGatewayFeed(active = true) {
  const [frames, setFrames] = useState<FeedFrame[]>(seedFrames);
  const [latency, setLatency] = useState<number[]>(() => Array.from({ length: 18 }, () => 18 + Math.random() * 30));
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ connections: 128, msgsPerMin: 342, p50: 24, errRate: 0.2 });
  const counter = useRef(100);

  useEffect(() => {
    if (!active || paused) return;
    const iv = setInterval(() => {
      counter.current += 1;
      const f = weightedFrame();
      const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
      setFrames((prev) => [{ id: counter.current, ts, ...f }, ...prev].slice(0, 26));
      setLatency((prev) => [...prev.slice(1), 16 + Math.random() * 36]);
      setStats((s) => ({
        connections: clamp(s.connections + Math.floor(Math.random() * 5) - 2, 112, 154),
        msgsPerMin: clamp(s.msgsPerMin + Math.floor(Math.random() * 25) - 12, 280, 470),
        p50: Math.round(clamp(18 + Math.random() * 30, 14, 62)),
        errRate: Math.max(0, +(s.errRate + (Math.random() * 0.16 - 0.08)).toFixed(2)),
      }));
    }, 1000);
    return () => clearInterval(iv);
  }, [active, paused]);

  return { frames, latency, stats, paused, toggle: () => setPaused((p) => !p) };
}

const FEED_COLOR: Record<string, string> = {
  msg: 'text-mist-300', hit: 'text-pulse-300', ai: 'text-signal-300',
  tool: 'text-cobalt-300', conn: 'text-pulse-400', hb: 'text-mist-600', err: 'text-alarm-400',
};

export function GatewayFeed({ title = 'Live Gateway Feed', height = 252 }: { title?: string; height?: number }) {
  const { frames, stats, latency, paused, toggle } = useGatewayFeed();
  return (
    <div className="panel overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusDot tone="green" pulse />
          <h3 className="font-display font-semibold text-[14px] text-mist-100 truncate">{title}</h3>
          <Badge tone="teal">wss</Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:block"><Sparkline data={latency} w={72} h={22} /></div>
          <IconBtn icon={paused ? 'play' : 'pause'} onClick={toggle} title={paused ? 'Resume stream' : 'Pause stream'} />
        </div>
      </div>
      <div className="grid grid-cols-4 divide-x divide-ink-700 border-b border-ink-700">
        {[
          { l: 'Sockets', v: String(stats.connections) },
          { l: 'Msgs/min', v: String(stats.msgsPerMin) },
          { l: 'p50', v: `${stats.p50}ms` },
          { l: 'Err %', v: `${stats.errRate.toFixed(1)}` },
        ].map((s) => (
          <div key={s.l} className="px-2 py-2 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-mist-600">{s.l}</p>
            <p className="font-display font-semibold text-[15px] text-mist-100 tabular-nums leading-tight">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="scanlines feed-scroll overflow-y-auto px-3.5 py-2.5 font-mono text-[11px] leading-[1.95] flex-1" style={{ maxHeight: height }}>
        {frames.map((f) => (
          <div key={f.id} className="tick-in flex gap-2.5 whitespace-nowrap">
            <span className="text-mist-600 shrink-0">{f.ts}</span>
            <span className={FEED_COLOR[f.kind] ?? 'text-mist-400'}>{f.text}</span>
          </div>
        ))}
        {paused && <div className="text-mist-500 mt-1">— stream paused —</div>}
      </div>
    </div>
  );
}

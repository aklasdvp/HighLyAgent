import { useEffect, useId, useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import {
  LayoutGrid, Layers, KeyRound, BookOpenText, Wrench, PlugZap, TerminalSquare, Users,
  GitBranch, ScrollText, ShieldCheck, Search, Plus, X, Copy, Check, RefreshCw, Trash2,
  Pencil, AlertTriangle, Globe2, Smartphone, Monitor, Cpu, Send, Square, ChevronUp,
  ChevronDown, ChevronRight, Clock3, Database, Activity, SlidersHorizontal, Zap, Eye,
  EyeOff, Pause, Play, Lock, Server, Sparkles, Info, Wifi, ArrowRight, DollarSign,
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
  arrow: ArrowRight, dollar: DollarSign,
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
export function Btn({ children, onClick, variant = 'ghost', size = 'md', disabled, className = '', title }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'subtle' | 'pulse';
  size?: 'sm' | 'md'; disabled?: boolean; className?: string; title?: string;
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
    <button title={title} disabled={disabled} onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
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
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 disabled:opacity-40 ${on ? 'bg-pulse-500' : 'bg-ink-600'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-ink-950 transition-transform duration-200 ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

/* ---------------- modal ---------------- */
export function Modal({ open, onClose, title, children, width = 480 }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="anim-pop relative panel rounded-xl!" style={{ width, maxWidth: '100%', boxShadow: 'var(--shadow-pop)' }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-700">
          <h3 className="font-display font-semibold text-[15px] text-mist-100">{title}</h3>
          <IconBtn icon="x" onClick={onClose} title="Close" />
        </div>
        <div className="p-5 max-h-[78vh] overflow-y-auto feed-scroll">{children}</div>
      </div>
    </div>
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
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500 flex items-center gap-1.5">
            <span style={{ color }}><Icon name={icon} size={12} /></span>
            {label}
          </p>
          <p className="font-display font-bold text-[26px] leading-tight text-mist-100 mt-1.5 tabular-nums">{value}</p>
          {sub && <div className="text-[11.5px] text-mist-400 mt-1">{sub}</div>}
        </div>
        {spark && <div className="mt-1 opacity-80 group-hover:opacity-100 transition-opacity">{spark}</div>}
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

export function EmptyState({ icon, title, desc }: { icon: IconName; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-xl bg-ink-750 border border-ink-600 flex items-center justify-center text-mist-500 mb-3">
        <Icon name={icon} size={22} />
      </div>
      <p className="font-display font-semibold text-mist-200">{title}</p>
      <p className="text-xs text-mist-500 mt-1 max-w-xs">{desc}</p>
    </div>
  );
}

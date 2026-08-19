import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useToast } from '../components/toast';
import type { KnowledgeEntry } from '../lib/data';
import { dateStr, findKnowledge, fmt, similarity, timeStr } from '../lib/data';
import { Badge, Btn, EmptyState, Field, Icon, IconBtn, Modal, SectionHead, Stat, Toggle } from '../components/ui';

type SourceFilter = 'all' | 'ai-learned' | 'manual' | 'training';

const emptyForm = { question: '', answer: '', category: 'support', language: 'en' as KnowledgeEntry['language'], source: 'manual' as KnowledgeEntry['source'] };

export default function Knowledge() {
  const { state, actions } = useStore();
  const { push } = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [langFilter, setLangFilter] = useState<'all' | 'en' | 'bn' | 'mixed'>('all');
  const [form, setForm] = useState(emptyForm);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<KnowledgeEntry | null>(null);
  const [err, setErr] = useState('');

  const results = useMemo(() => {
    let list = state.knowledge;
    if (filter !== 'all') list = list.filter((k) => k.source === filter);
    if (langFilter !== 'all') list = list.filter((k) => k.language === langFilter);
    if (query.trim()) {
      return list
        .map((k) => ({ k, score: similarity(query, k.question) }))
        .filter((r) => r.score > 0.05)
        .sort((a, b) => b.score - a.score);
    }
    return list.map((k) => ({ k, score: null as number | null })).sort((a, b) => b.k.hits - a.k.hits);
  }, [state.knowledge, query, filter, langFilter]);

  const totalHits = state.knowledge.reduce((a, k) => a + k.hits, 0);
  const totalSaved = state.knowledge.reduce((a, k) => a + k.savedTokens, 0);
  const learned = state.knowledge.filter((k) => k.source === 'ai-learned').length;

  const topMatch = query.trim() ? findKnowledge(query, state.knowledge) : null;

  const submit = () => {
    if (!form.question.trim() || !form.answer.trim()) { setErr('Both question and answer are required'); return; }
    if (modal === 'create') {
      actions.addKnowledge({ ...form, active: true });
      push('Entry saved & embedded (1536-dim)');
    } else if (editingId) {
      actions.updateKnowledge(editingId, { ...form });
      push('Entry updated — vector re-indexed');
    }
    setModal(null); setForm(emptyForm); setEditingId(null); setErr('');
  };

  return (
    <div>
      <SectionHead
        title="Knowledge Engine"
        desc="The agent's learned memory. Every entry is embedded (1536-dim) and served via pgvector cosine search — hits cost zero AI tokens."
        right={<Btn variant="primary" onClick={() => { setModal('create'); setForm(emptyForm); }}><Icon name="plus" size={14} /> Add entry</Btn>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="Entries" value={state.knowledge.length} icon="book" color="var(--color-pulse-400)" />
        <Stat label="AI-learned" value={learned} icon="spark" color="var(--color-signal-400)" sub={<span className="font-mono text-[10.5px] text-mist-500">added by the agent itself</span>} />
        <Stat label="Total cache hits" value={fmt(totalHits)} icon="db" color="var(--color-pulse-400)" />
        <Stat label="Tokens saved" value={fmt(totalSaved)} icon="dollar" color="var(--color-signal-400)" />
      </div>

      {/* search + filters */}
      <div className="panel p-4 mb-4 anim-rise">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-500" />
            <input
              className="field pl-9!"
              placeholder="Semantic search — try “রিফান্ড পলিসি” or “where is my order”…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'ai-learned', 'manual', 'training'] as SourceFilter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1.5 rounded-lg font-mono text-[10.5px] uppercase tracking-wide border transition-all ${filter === f ? 'bg-signal-900 border-signal-600/60 text-signal-300' : 'border-ink-600 text-mist-400 hover:border-ink-500 hover:text-mist-200'}`}>
                {f === 'all' ? 'all' : f}
              </button>
            ))}
            <span className="w-px h-6 bg-ink-600 mx-1" />
            {(['all', 'en', 'bn'] as const).map((l) => (
              <button key={l} onClick={() => setLangFilter(l)}
                className={`px-2.5 py-1.5 rounded-lg font-mono text-[10.5px] uppercase border transition-all ${langFilter === l ? 'bg-pulse-900 border-pulse-600/60 text-pulse-300' : 'border-ink-600 text-mist-400 hover:border-ink-500 hover:text-mist-200'}`}>
                {l === 'all' ? 'any' : l}
              </button>
            ))}
          </div>
        </div>
        {query.trim() && (
          <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] anim-rise ${topMatch ? 'border-pulse-600/50 bg-pulse-900/30 text-pulse-300' : 'border-alarm-500/40 bg-alarm-900/30 text-alarm-300'}`}>
            <Icon name={topMatch ? 'check' : 'alert'} size={13} />
            {topMatch
              ? <>Best match sim=<span className="font-mono font-semibold">{topMatch.score.toFixed(2)}</span> ≥ 0.40 → the agent would serve this from cache, <span className="font-semibold">0 AI tokens</span>.</>
              : <>No match above threshold 0.40 → the agent would call the AI provider, then <span className="font-semibold">learn</span> the answer.</>}
          </div>
        )}
      </div>

      {/* list */}
      {results.length === 0 ? (
        <div className="panel"><EmptyState icon="book" title="Nothing matches" desc="Adjust the filters or add a new knowledge entry manually." /></div>
      ) : (
        <div className="space-y-2.5">
          {results.map(({ k, score }, i) => (
            <div key={k.id} className={`panel p-4 anim-rise transition-all hover:border-ink-500 ${!k.active ? 'opacity-55' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[13.5px] text-mist-100">{k.question}</p>
                    <Badge tone={k.source === 'ai-learned' ? 'amber' : k.source === 'training' ? 'blue' : 'neutral'}>{k.source}</Badge>
                    <Badge tone="neutral">{k.language}</Badge>
                    <Badge tone="neutral">{k.category}</Badge>
                    {score !== null && (
                      <span className="font-mono text-[10.5px] text-pulse-300 bg-pulse-900 border border-pulse-600/50 rounded px-1.5 py-0.5">sim {(score * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <p className="text-[12px] text-mist-400 mt-1.5 leading-relaxed line-clamp-2">{k.answer}</p>
                  <p className="font-mono text-[10px] text-mist-600 mt-2">
                    updated {dateStr(k.updatedAt)} · {timeStr(k.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="font-display font-bold text-[17px] text-pulse-300 tabular-nums">{fmt(k.hits)}</p>
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-mist-500">hits</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-[17px] text-signal-300 tabular-nums">{fmt(k.savedTokens)}</p>
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-mist-500">tok saved</p>
                  </div>
                  <div className="flex items-center gap-1 pl-2 border-l border-ink-700">
                    <Toggle on={k.active} onChange={() => actions.updateKnowledge(k.id, { active: !k.active })} />
                    <IconBtn icon="edit" title="Edit entry" onClick={() => {
                      setEditingId(k.id);
                      setForm({ question: k.question, answer: k.answer, category: k.category, language: k.language, source: k.source });
                      setModal('edit');
                    }} />
                    <IconBtn icon="trash" title="Delete entry" danger onClick={() => setConfirmDel(k)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* create/edit modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Add knowledge entry' : 'Edit knowledge entry'} width={560}>
        <Field label="Question (canonical form)">
          <input className="field" autoFocus value={form.question} placeholder="e.g. How do I track my order?"
            onChange={(e) => { setForm({ ...form, question: e.target.value }); setErr(''); }} />
        </Field>
        <Field label="Answer served on cache hit">
          <textarea className="field" rows={4} value={form.answer}
            placeholder="The exact response the agent should return — no AI call will be made."
            onChange={(e) => { setForm({ ...form, answer: e.target.value }); setErr(''); }} />
        </Field>
        {err && <p className="mb-3 text-[11px] text-alarm-400 flex items-center gap-1"><Icon name="alert" size={11} /> {err}</p>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Category">
            <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['support', 'billing', 'policy', 'account', 'general', 'technical'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Language">
            <select className="field" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as KnowledgeEntry['language'] })}>
              <option value="en">en</option><option value="bn">bn</option><option value="mixed">mixed</option>
            </select>
          </Field>
          <Field label="Source">
            <select className="field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as KnowledgeEntry['source'] })}>
              <option value="manual">manual</option><option value="training">training</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn onClick={() => setModal(null)}>Cancel</Btn>
          <Btn variant="primary" onClick={submit}><Icon name="check" size={13} /> {modal === 'create' ? 'Save & embed' : 'Save changes'}</Btn>
        </div>
      </Modal>

      {/* delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete knowledge entry?">
        <p className="text-[13px] text-mist-300 leading-relaxed">
          “{confirmDel?.question}” and its vector will be removed from the index. Future similar questions will trigger AI calls again until re-learned.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={() => setConfirmDel(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { if (confirmDel) actions.removeKnowledge(confirmDel.id); setConfirmDel(null); }}>
            <Icon name="trash" size={13} /> Delete entry
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

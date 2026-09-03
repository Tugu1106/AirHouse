'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Send, User, Sparkles } from 'lucide-react';
import { useData } from './DataProvider';

interface Pending {
  tool: string;
  args: Record<string, unknown>;
  summary: string;
}

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  tools?: string[];
  model?: string;
  pending?: Pending;
  resolved?: boolean;
}

const EXAMPLES = [
  'How many desktops are in Central Mall?',
  'What items does Bat have?',
  'List employees with no assigned items.',
  'Which branch has the most laptops?',
];

export function AiChat() {
  const { refresh } = useData();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong.');
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: data.reply || '(no answer)',
            tools: data.tools,
            model: data.model,
            pending: data.pending,
          },
        ]);
      }
    } catch {
      setError('Could not reach the assistant.');
    } finally {
      setLoading(false);
    }
  };

  const confirmPending = async (idx: number, pending: Pending) => {
    setMessages((m) => m.map((x, i) => (i === idx ? { ...x, resolved: true } : x)));
    setLoading(true);
    try {
      const res = await fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: pending.tool, args: pending.args }),
      });
      const data = await res.json();
      if (data.ok) void refresh(); // keep Inventory/Employees/Map in sync
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: data.message || (data.ok ? 'Done.' : 'That didn’t work.') },
      ]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Could not run that action.' }]);
    } finally {
      setLoading(false);
    }
  };

  const cancelPending = (idx: number) => {
    setMessages((m) =>
      m
        .map((x, i) => (i === idx ? { ...x, resolved: true } : x))
        .concat({ role: 'assistant', content: 'Cancelled — nothing was changed.' }),
    );
  };

  return (
    <div className="panel flex h-[calc(100vh-9rem)] flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/15 text-brand-light ring-1 ring-brand/30">
          <Bot className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div>
          <h1 className="text-base font-semibold text-white">Assistant</h1>
          <p className="text-xs text-slate-400">Ask about inventory, employees, and branches · read-only</p>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && !error && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-slate-800 text-brand-light">
              <Sparkles className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <p className="mt-3 text-sm text-slate-400">Ask a question to get started.</p>
            <div className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ${
                m.role === 'user'
                  ? 'bg-slate-800 text-slate-300 ring-slate-700'
                  : 'bg-brand/15 text-brand-light ring-brand/30'
              }`}
            >
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </span>
            <div className={`max-w-[80%] ${m.role === 'user' ? 'text-right' : ''}`}>
              <div
                className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-brand text-white'
                    : 'border border-slate-800 bg-slate-800/50 text-slate-100'
                }`}
              >
                {m.content}
              </div>
              {m.pending && !m.resolved && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
                  <div className="text-xs font-medium text-amber-200">{m.pending.summary}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => confirmPending(i, m.pending!)}
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-light"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => cancelPending(i)}
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {(m.tools?.length || m.model) && (
                <div className="mt-1 text-[11px] text-slate-600">
                  {m.tools?.length ? `looked up: ${m.tools.join(', ')}` : ''}
                  {m.tools?.length && m.model ? ' · ' : ''}
                  {m.model ? m.model.replace(':free', '') : ''}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand-light ring-1 ring-brand/30">
              <Bot className="h-4 w-4" />
            </span>
            <div className="rounded-2xl border border-slate-800 bg-slate-800/50 px-4 py-3">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-slate-800 px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your assets…"
          className="field"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand text-white transition hover:bg-brand-light disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

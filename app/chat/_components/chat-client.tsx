'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

// Patient-name prompts read more naturally for clinicians than auth-IDs.
// The LLM chains getActiveAuths -> find auth by patient name -> getAuthDetails,
// which fits inside stepCountIs(8) on /api/chat.
const SUGGESTED_PROMPTS = [
  'What\'s the status of Aaliyah Johnson\'s prior auth?',
  'Compare Aaliyah Johnson and Marcus Chen — why did one auto-approve and the other escalate?',
  'Summarize Aetna\'s policy on Botox for chronic migraine',
  'Which auths haven\'t been processed yet?',
];

export function ChatClient() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState('');
  const isResponding = status === 'streaming' || status === 'submitted';

  function send(text: string) {
    if (!text.trim() || isResponding) return;
    sendMessage({ text });
    setInput('');
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900">AI Assistant — Prior Auth Helper</h1>
          <p className="text-xs text-slate-500 mt-0.5">Ask about active auths, payer policies, or specific cases</p>
        </div>
        <Link href="/autopilot" className="text-xs text-blue-600 hover:underline">← Auto-Pilot</Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="text-3xl">💬</div>
            <p className="text-sm text-slate-500 max-w-md">
              I can look up active prior authorizations, fetch the latest verdict for a specific case,
              or summarize what Aetna&apos;s policy says about a procedure. Try one of these:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full mt-2">
              {SUGGESTED_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  disabled={isResponding}
                  className="text-left text-xs px-3 py-2.5 border border-slate-200 rounded-lg bg-white hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
        {isResponding && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="text-xs text-slate-400 italic px-2">thinking…</div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="border-t border-slate-200 bg-white px-6 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about an auth, a policy, or the queue…"
            rows={1}
            disabled={isResponding}
            className="flex-1 min-h-[40px] max-h-32 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 resize-none"
          />
          <button
            type="submit"
            disabled={isResponding || !input.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageRow({ message }: { message: ReturnType<typeof useChat>['messages'][number] }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-3xl space-y-2', isUser ? 'items-end' : 'items-start')}>
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            // User messages stay plain — they typed them. Assistant messages
            // get markdown rendering since the LLM emits **bold**, lists, etc.
            return isUser ? (
              <div
                key={i}
                className="rounded-lg px-3 py-2 text-sm whitespace-pre-wrap bg-blue-600 text-white"
              >
                {part.text}
              </div>
            ) : (
              <div
                key={i}
                className="rounded-lg px-3.5 py-2.5 text-sm bg-white border border-slate-200 text-slate-800"
              >
                <AssistantMarkdown text={part.text} />
              </div>
            );
          }
          if (part.type.startsWith('tool-')) {
            return <ToolCallChip key={i} part={part as ToolPart} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

// Custom-styled markdown renderer so the LLM's **bold**, lists, and links
// render properly inside the chat bubble. Each element gets a Tailwind
// class via the components prop instead of pulling in @tailwindcss/typography.
function AssistantMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="leading-relaxed [&:not(:first-child)]:mt-2">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mt-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mt-2">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children }) => (
          <code className="font-mono text-[0.85em] bg-slate-100 text-slate-800 px-1 py-0.5 rounded">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="font-mono text-xs bg-slate-100 text-slate-800 p-2 rounded my-2 overflow-x-auto">{children}</pre>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{children}</a>
        ),
        h1: ({ children }) => <h3 className="font-semibold text-slate-900 mt-3 mb-1">{children}</h3>,
        h2: ({ children }) => <h3 className="font-semibold text-slate-900 mt-3 mb-1">{children}</h3>,
        h3: ({ children }) => <h3 className="font-semibold text-slate-900 mt-3 mb-1">{children}</h3>,
        // GFM table styling — kept compact so it fits inside the chat bubble.
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b border-slate-200 last:border-0">{children}</tr>,
        th: ({ children }) => (
          <th className="text-left font-semibold text-slate-700 px-2 py-1.5 border-b border-slate-300">{children}</th>
        ),
        td: ({ children }) => <td className="px-2 py-1.5 text-slate-700 align-top">{children}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

interface ToolPart {
  type: string;
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function ToolCallChip({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false);
  const toolName = part.type.replace(/^tool-/, '');
  const done = part.state === 'output-available' || part.state === 'output-error';
  const isError = part.state === 'output-error';
  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition-colors',
          isError
            ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
            : done
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-50 border-slate-200 text-slate-600',
        )}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Wrench className="h-3 w-3" />
        <span className="font-mono">{toolName}</span>
        {!done && <span className="text-slate-400 italic">running…</span>}
        {isError && <span className="text-red-600">error</span>}
      </button>
      {open && (
        <div className="mt-1 p-2 bg-slate-50 rounded border border-slate-200 text-xs space-y-2">
          {part.input !== undefined && (
            <div>
              <div className="text-slate-400 uppercase tracking-wide text-xs mb-1">input</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words text-slate-700">
{JSON.stringify(part.input, null, 2)}
              </pre>
            </div>
          )}
          {part.output !== undefined && (
            <div>
              <div className="text-slate-400 uppercase tracking-wide text-xs mb-1">output</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words text-slate-700 max-h-64 overflow-y-auto">
{JSON.stringify(part.output, null, 2)}
              </pre>
            </div>
          )}
          {isError && part.errorText && (
            <div className="text-red-600">{part.errorText}</div>
          )}
        </div>
      )}
    </div>
  );
}

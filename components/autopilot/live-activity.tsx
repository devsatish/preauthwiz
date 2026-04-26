'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TraceEvent } from '@/lib/schemas/trace';

interface ActivityEntry {
  id: string;
  event: TraceEvent;
}

function EventRow({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { event } = entry;

  const hasDetail =
    event.type === 'agent_completed' ||
    event.type === 'tool_called' ||
    event.type === 'tool_result';

  const getIcon = () => {
    if (event.type === 'agent_started') return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    if (event.type === 'agent_completed') return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    if (event.type === 'run_error') return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    return <div className="h-2 w-2 rounded-full bg-slate-300 mt-0.5" />;
  };

  const getLabel = () => {
    if (event.type === 'agent_started') return `${event.subagent} starting`;
    if (event.type === 'agent_completed') {
      const latency = event.latency_ms ? ` · ${(event.latency_ms / 1000).toFixed(1)}s` : '';
      const tokens = event.input_tokens != null ? ` · ${event.input_tokens + (event.output_tokens ?? 0)} tok` : '';
      return `${event.subagent} complete${latency}${tokens}`;
    }
    if (event.type === 'tool_called') return `→ ${event.tool} called`;
    if (event.type === 'tool_result') return `← ${event.tool} result`;
    if (event.type === 'run_completed') return `Run complete · ${event.verdict} · ${event.latency_ms}ms`;
    if (event.type === 'run_error') return `Error: ${event.error}`;
    return event.type;
  };

  const getDetail = () => {
    if (event.type === 'agent_completed' && event.output) {
      return JSON.stringify(event.output, null, 2);
    }
    if (event.type === 'tool_called') return JSON.stringify(event.input, null, 2);
    if (event.type === 'tool_result') return JSON.stringify(event.output, null, 2);
    return null;
  };

  const detail = getDetail();

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors',
          hasDetail && detail ? 'cursor-pointer' : 'cursor-default',
        )}
        onClick={() => hasDetail && detail && setExpanded(!expanded)}
        disabled={!hasDetail || !detail}
      >
        {getIcon()}
        <span className="text-xs text-slate-700 flex-1 font-mono">{getLabel()}</span>
        {event.type === 'agent_completed' && (
          <span className="text-xs text-slate-400 font-mono">{event.model}</span>
        )}
        {hasDetail && detail && (
          expanded
            ? <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
        )}
      </button>
      {expanded && detail && (
        <pre className="px-4 pb-3 text-xs font-mono text-slate-600 bg-slate-50 overflow-x-auto max-h-60 border-t border-slate-100">
          {detail}
        </pre>
      )}
    </div>
  );
}

export function LiveActivity({ events }: { events: ActivityEntry[] }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        Events will appear here when the run starts
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {events.map((entry) => (
        <EventRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export type { ActivityEntry };
